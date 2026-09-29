import { FORMAT, VERSION, clone, emptyWorkspace, parseWorkspace, setOwn, translationKeys, validateDialogue } from '../../lib/dialogue/model.mjs';
import { languages, translationCatalog } from '../../lib/dialogue/export.mjs';

const HISTORY_LIMIT = 200;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Records what a mutation touches so it can be undone exactly: whole-document snapshots for the
 * few documents an edit changes, and old/new values for each translation it writes.
 */
class Transaction {
  constructor(store) { this.store = store; this.docs = new Map(); this.texts = new Map(); }
  snapshot(entry) {
    return entry ? { index: this.store.indexOf(entry.id), path: entry.path, dialogue: clone(entry.dialogue), layout: clone(entry.layout) } : null;
  }
  edit(id) {
    const entry = this.store.doc(id);
    if (!entry) throw Error('Dialogue not found.');
    if (!this.docs.has(id)) this.docs.set(id, { before: this.snapshot(entry) });
    return entry;
  }
  add({ path, dialogue, layout = {} }, index = this.store.ws.documents.length) {
    const entry = { id: this.store.nextId(), path, dialogue, layout };
    this.docs.set(entry.id, { before: null });
    this.store.ws.documents.splice(index, 0, entry);
    return entry;
  }
  remove(id) {
    const entry = this.edit(id);
    this.store.ws.documents.splice(this.store.indexOf(entry.id), 1);
  }
  text(lang, key, value) {
    const dictionary = this.store.ws.translations[lang], id = `${lang}\u0000${key}`;
    if (!this.texts.has(id)) this.texts.set(id, { lang, key, before: Object.hasOwn(dictionary, key) ? dictionary[key] : undefined });
    if (value === undefined) delete dictionary[key]; else setOwn(dictionary, key, value);
  }
  rollback() {
    for (const [id, change] of [...this.docs].reverse()) this.store.apply(id, change.before);
    for (const change of [...this.texts.values()].reverse()) this.store.applyText(change.lang, change.key, change.before);
  }
  finish() {
    for (const [id, change] of this.docs) {
      change.after = this.snapshot(this.store.doc(id));
      if (change.before && change.after && same(change.before, change.after)) this.docs.delete(id);
    }
    for (const [id, change] of this.texts) {
      const dictionary = this.store.ws.translations[change.lang];
      change.after = Object.hasOwn(dictionary, change.key) ? dictionary[change.key] : undefined;
      if (change.after === change.before) this.texts.delete(id);
    }
    return this.docs.size || this.texts.size ? { docs: this.docs, texts: this.texts } : null;
  }
}

export class Store {
  constructor() {
    this.sequence = 0;
    this.listeners = new Set();
    this.load(emptyWorkspace());
  }

  nextId() { return ++this.sequence; }
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(change) { for (const listener of this.listeners) listener(change); }

  /** Replaces the workspace. Documents get in-memory IDs so a path can change without losing identity. */
  load(value, { emit = false } = {}) {
    const ws = parseWorkspace(value);
    this.ws = {
      format: FORMAT, version: VERSION, name: ws.name,
      translations: ws.translations,
      documents: ws.documents.map(entry => ({ id: this.nextId(), path: entry.path, dialogue: entry.dialogue, layout: entry.layout ?? {} })),
    };
    this.undoStack = []; this.redoStack = []; this.coalesce = null;
    this.invalidate();
    if (emit) this.emit({ kind: 'load', docs: new Set(), texts: new Set(), structural: true });
  }

  serialize() {
    return {
      format: FORMAT, version: VERSION, ...(this.ws.name ? { name: this.ws.name } : {}),
      documents: this.ws.documents.map(({ path, dialogue, layout }) => Object.keys(layout ?? {}).length ? { path, dialogue, layout } : { path, dialogue }),
      translations: this.ws.translations,
    };
  }

  get documents() { return this.ws.documents; }
  doc(id) { return this.ws.documents.find(entry => entry.id === id); }
  docByPath(path) { return this.ws.documents.find(entry => entry.path === path); }
  indexOf(id) { return this.ws.documents.findIndex(entry => entry.id === id); }
  text(lang, key) { return Object.hasOwn(this.ws.translations[lang], key) ? this.ws.translations[lang][key] : ''; }

  /**
   * Runs `fn` against a transaction. Throwing inside `fn` restores everything it touched.
   * Edits sharing a `coalesce` key merge into one undo step until `breakCoalesce()`.
   */
  mutate(label, fn, { coalesce = null, source = null } = {}) {
    const tx = new Transaction(this);
    let result;
    try { result = fn(tx); } catch (error) { tx.rollback(); throw error; }
    const entry = tx.finish();
    if (!entry) return result;
    const top = this.undoStack.at(-1);
    if (coalesce && top && top.coalesce === coalesce && this.coalesce === coalesce && !this.redoStack.length) {
      for (const [id, change] of entry.docs) {
        if (top.docs.has(id)) top.docs.get(id).after = change.after; else top.docs.set(id, change);
      }
      for (const [id, change] of entry.texts) {
        if (top.texts.has(id)) top.texts.get(id).after = change.after; else top.texts.set(id, change);
      }
    } else {
      this.undoStack.push({ label, coalesce, docs: entry.docs, texts: entry.texts });
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
    }
    this.coalesce = coalesce;
    this.changed(entry, 'mutate', source, label);
    return result;
  }

  breakCoalesce() { this.coalesce = null; }

  undo() { return this.step(this.undoStack, this.redoStack, 'undo'); }
  redo() { return this.step(this.redoStack, this.undoStack, 'redo'); }
  step(from, to, kind) {
    const entry = from.pop();
    if (!entry) return null;
    if (kind === 'undo') {
      for (const [id, change] of [...entry.docs].reverse()) this.apply(id, change.before);
      for (const change of [...entry.texts.values()].reverse()) this.applyText(change.lang, change.key, change.before);
    } else {
      for (const [id, change] of entry.docs) this.apply(id, change.after);
      for (const change of entry.texts.values()) this.applyText(change.lang, change.key, change.after);
    }
    to.push(entry);
    this.coalesce = null;
    this.changed(entry, kind, null, entry.label);
    return entry;
  }

  apply(id, snapshot) {
    const index = this.indexOf(id);
    if (!snapshot) { if (index >= 0) this.ws.documents.splice(index, 1); return; }
    const data = { id, path: snapshot.path, dialogue: clone(snapshot.dialogue), layout: clone(snapshot.layout) };
    if (index >= 0) this.ws.documents[index] = data;
    else this.ws.documents.splice(Math.min(snapshot.index, this.ws.documents.length), 0, data);
  }

  applyText(lang, key, value) {
    const dictionary = this.ws.translations[lang];
    if (value === undefined) delete dictionary[key]; else setOwn(dictionary, key, value);
  }

  clearHistory() { this.undoStack = []; this.redoStack = []; this.coalesce = null; this.emit({ kind: 'history', docs: new Set(), texts: new Set(), structural: false }); }

  changed(entry, kind, source, label) {
    const docs = new Set(entry.docs.keys()), texts = new Set([...entry.texts.values()].map(change => change.key));
    const structural = [...entry.docs.values()].some(change => !change.before || !change.after || change.before.path !== change.after.path);
    this.invalidate(docs, texts.size > 0);
    this.emit({ kind, docs, texts, structural, source, label });
  }

  /* ------------------------------------------------------------------ caches -- */

  invalidate(docs = null, texts = true) {
    this.catalogCache = null;
    if (!docs) { this.checks = new Map(); this.keys = new Map(); this.status = new Map(); return; }
    for (const id of docs) { this.checks.delete(id); this.keys.delete(id); }
    if (texts) this.status.clear(); else for (const id of docs) this.status.delete(id);
  }

  check(id) {
    if (!this.checks.has(id)) {
      const entry = this.doc(id);
      this.checks.set(id, entry ? validateDialogue(entry.dialogue) : { errors: [], warnings: [], issues: [] });
    }
    return this.checks.get(id);
  }

  keysOf(id) {
    if (!this.keys.has(id)) this.keys.set(id, [...translationKeys(this.doc(id)?.dialogue ?? {})]);
    return this.keys.get(id);
  }

  /** Per-document badge: structural errors and how many referenced texts still lack a language. */
  docStatus(id) {
    if (!this.status.has(id)) {
      const missing = this.keysOf(id).filter(key => languages.some(lang => !this.text(lang, key).trim())).length;
      this.status.set(id, { errors: this.check(id).errors.length, warnings: this.check(id).warnings.length, missing });
    }
    return this.status.get(id);
  }

  catalog() {
    if (!this.catalogCache) {
      const list = translationCatalog(this.ws);
      this.catalogCache = { list, byKey: new Map(list.map(entry => [entry.key, entry])) };
    }
    return this.catalogCache;
  }

  usage(key) { return this.catalog().byKey.get(key)?.sources.length ?? 0; }

  usedKeys() {
    const keys = new Set(Object.keys(this.ws.translations.en_us));
    for (const key of Object.keys(this.ws.translations.zh_cn)) keys.add(key);
    for (const entry of this.ws.documents) for (const key of this.keysOf(entry.id)) keys.add(key);
    return keys;
  }

  totals() {
    let errors = 0, warnings = 0;
    for (const entry of this.ws.documents) { const result = this.check(entry.id); errors += result.errors.length; warnings += result.warnings.length; }
    const duplicate = this.ws.documents.length - new Set(this.ws.documents.map(entry => entry.path)).size;
    const unfinished = this.catalog().list.filter(entry => entry.missing.length).length;
    return { errors: errors + duplicate, warnings, unfinished, keys: this.catalog().list.length };
  }
}
