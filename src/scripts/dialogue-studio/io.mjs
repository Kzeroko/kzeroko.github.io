import { decodeText, unzip, zipCompressed } from '../../lib/dialogue/archive.mjs';
import { buildResourceFiles, languageFiles, languages, subsetWorkspace, translationTodo } from '../../lib/dialogue/export.mjs';
import { keyPrefix, rekeyDialogue } from '../../lib/dialogue/graph.mjs';
import { classifyImport, textBrief } from '../../lib/dialogue/importer.mjs';
import { parseWorkspace, safePath, translationKeys, validateDialogue } from '../../lib/dialogue/model.mjs';
import { templates } from '../../lib/dialogue/templates.mjs';
import { download, h, slug, stamp } from './dom.mjs';

const MAX_FILE = 64 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Import, export and the file-level operations (new, move, duplicate, delete). */
export class IO {
  constructor(app) {
    this.app = app; this.t = app.t;
    this.filesInput = h('input', { type: 'file', multiple: true, accept: '.json,.zip,application/json,application/zip', hidden: true });
    this.folderInput = h('input', { type: 'file', multiple: true, hidden: true, attrs: { webkitdirectory: true } });
    for (const [input, folder] of [[this.filesInput, false], [this.folderInput, true]]) {
      input.addEventListener('change', () => this.app.run(async () => { try { await this.importFiles([...input.files], folder); } finally { input.value = ''; } }));
      app.root.append(input);
    }
  }

  get store() { return this.app.store; }
  pick(kind) { (kind === 'folder' ? this.folderInput : this.filesInput).click(); }

  /* ---------------------------------------------------------------- import -- */

  async read(file, path, stripRoot) {
    if (file.size > MAX_FILE) throw Error(this.t(`${file.name} is larger than 64 MB.`, `${file.name} 超过 64 MB。`));
    if (/\.zip$/i.test(file.name)) {
      const entries = await unzip(file);
      return Object.entries(entries).map(([name, data]) => ({ path: name, text: decodeText(data), stripRoot: false }));
    }
    return [{ path, text: await file.text(), stripRoot }];
  }

  async importFiles(files, folder = false) {
    const entries = [];
    for (const file of files) entries.push(...await this.read(file, file.webkitRelativePath || file.name, folder && !!file.webkitRelativePath));
    await this.importEntries(entries);
  }

  /** Dropped folders are walked recursively; dropped files behave like picked files. */
  async importDrop(dataTransfer) {
    const items = [...dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
    if (!items.length) { await this.importFiles([...dataTransfer.files]); return; }
    const entries = [];
    const walk = async (entry, root) => {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        entries.push(...await this.read(file, entry.fullPath.replace(/^\//, ''), root));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let batch;
        do {
          batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          for (const child of batch) await walk(child, true);
        } while (batch.length);
      }
    };
    for (const item of items) await walk(item, item.isDirectory);
    await this.importEntries(entries);
  }

  async importEntries(entries) {
    const t = this.t, store = this.store, result = classifyImport(entries);
    if (result.workspace) { await this.importWorkspace(result.workspace.value, result.workspace.path); return; }
    if (!result.dialogues.length && !result.dictionaries.length) {
      await this.report(result, t('Nothing to import', '没有可导入的内容'));
      return;
    }
    const clashes = result.dialogues.filter(entry => store.docByPath(entry.path));
    let mode = 'skip';
    if (clashes.length) {
      mode = await this.app.ui.dialog({
        title: t('Some files already exist', '部分文件已存在'),
        description: t(`${clashes.length} of ${result.dialogues.length} dialogues have a path that is already in this session.`, `${result.dialogues.length} 个对话中有 ${clashes.length} 个路径已在当前工作区。`),
        body: h('ul', { class: 'ds-dialog__list' }, clashes.slice(0, 6).map(entry => h('li', { class: 'ds-mono', text: entry.path })), clashes.length > 6 ? h('li', { class: 'ds-muted', text: t(`…and ${clashes.length - 6} more`, `……还有 ${clashes.length - 6} 个`) }) : null),
        actions: [{ label: t('Cancel', '取消'), value: null }, { label: t('Keep mine', '保留现有'), value: 'skip' }, { label: t('Replace them', '替换'), value: 'replace', variant: 'primary' }],
      });
      if (!mode) return;
    }
    const incoming = result.dialogues.filter(entry => mode === 'replace' || !store.docByPath(entry.path));
    if (store.documents.length + incoming.filter(entry => !store.docByPath(entry.path)).length > 5000) throw Error(t('A workspace holds at most 5,000 dialogues.', '一个工作区最多 5,000 个对话。'));
    let first = null, texts = 0;
    store.mutate(t('Import', '导入'), tx => {
      for (const entry of incoming) {
        const existing = store.docByPath(entry.path);
        let id;
        if (existing) { const target = tx.edit(existing.id); target.dialogue = entry.dialogue; target.layout = {}; id = existing.id; }
        else id = tx.add({ path: entry.path, dialogue: entry.dialogue }).id;
        first ??= id;
      }
      for (const { lang, values } of result.dictionaries) for (const [key, value] of Object.entries(values)) {
        if (!value.trim() && store.text(lang, key).trim()) continue;
        if (store.text(lang, key) !== value) { tx.text(lang, key, value); texts++; }
      }
    });
    if (first && (!this.app.entry || result.dialogues.length)) this.app.open(first);
    const summary = [
      incoming.length ? t(`${incoming.length} dialogues`, `${incoming.length} 个对话`) : null,
      texts ? t(`${texts} texts`, `${texts} 条文本`) : null,
      clashes.length && mode === 'skip' ? t(`${clashes.length} kept as they were`, `${clashes.length} 个保持原样`) : null,
    ].filter(Boolean).join(t(', ', '，'));
    this.app.ui.toast(`${t('Imported', '已导入')} ${summary || t('nothing new', '无新内容')}.`, { kind: 'success', action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
    if (result.skipped.length) await this.report(result, t('Some files were skipped', '部分文件被跳过'));
  }

  async report(result, title) {
    const t = this.t;
    const reasons = {
      json: t('not valid JSON', '不是有效的 JSON'), shape: t('not a dialogue (needs "states")', '不是对话文件（缺少 "states"）'),
      path: t('path must be lowercase a–z, 0–9, _ . - /', '路径只能包含小写 a–z、0–9 和 _ . - /'), duplicate: t('same path twice in this import', '本次导入中路径重复'),
      dictionary: t('language file with non-text values', '语言文件中有非文本值'), workspace: t('only one workspace per import', '一次只能导入一个工作区'),
    };
    await this.app.ui.dialog({
      title,
      description: result.skipped.length ? t(`${result.skipped.length} files were not imported.`, `${result.skipped.length} 个文件未导入。`) : t('No dialogue, language or workspace JSON was found.', '没有找到对话、语言或工作区 JSON。'),
      body: result.skipped.length ? h('ul', { class: 'ds-dialog__list' }, result.skipped.slice(0, 40).map(item => h('li', {}, h('span', { class: 'ds-mono', text: item.path }), h('small', { text: ` — ${reasons[item.reason] ?? item.reason}` })))) : null,
    });
  }

  async importWorkspace(value, source) {
    const t = this.t, workspace = parseWorkspace(value);
    const choice = await this.app.ui.dialog({
      title: t('Open workspace backup', '打开工作区备份'),
      description: t(`${source} holds ${workspace.documents.length} dialogues. Open it as its own session, or merge it into the one you have open?`, `${source} 中有 ${workspace.documents.length} 个对话。作为新的工作区打开，还是合并进当前工作区？`),
      actions: [{ label: t('Cancel', '取消'), value: null }, { label: t('Merge into this one', '合并到当前'), value: 'merge' }, { label: t('Open as new session', '作为新工作区打开'), value: 'open', variant: 'primary' }],
    });
    if (choice === 'open') {
      await this.app.sessions.create(workspace, workspace.name || source.split('/').pop().replace(/\.json$/i, ''));
      this.app.ui.toast(t('Opened as a new session. Your previous session is still in the Sessions panel.', '已作为新工作区打开，之前的工作区仍在「工作区」面板里。'), { kind: 'success' });
    } else if (choice === 'merge') {
      await this.importEntries([
        ...workspace.documents.map(entry => ({ path: `blabber_dialogues/${entry.path}`, text: JSON.stringify(entry.dialogue) })),
        ...languages.map(lang => ({ path: `${lang}.json`, text: JSON.stringify(workspace.translations[lang]) })),
      ]);
    }
  }

  async pasteTexts() {
    const t = this.t;
    const area = h('textarea', { class: 'ds-input ds-textarea ds-mono', rows: 10, placeholder: '{ "dialogue.isekaiexpansion.…": "…" }', attrs: { autofocus: true, 'aria-label': t('Text JSON', '文本 JSON') } });
    const lang = h('select', { class: 'ds-input' }, h('option', { value: 'en_us', text: 'en_us · English' }), h('option', { value: 'zh_cn', text: 'zh_cn · 简体中文' }));
    const ok = await this.app.ui.dialog({
      title: t('Paste text', '粘贴文本'), wide: true,
      description: t('Paste the brief from "Copy for AI" once it is filled in, or a plain { key: text } dictionary. Empty values never overwrite text you already wrote.', '粘贴填好的「复制给 AI」内容，或普通的 { 键: 文本 } 字典。空值不会覆盖已写好的文本。'),
      body: h('div', { class: 'ds-stack' }, area, h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: t('Language for a plain dictionary', '普通字典对应的语言') }), lang)),
      actions: [{ label: t('Cancel', '取消'), value: false }, { label: t('Merge text', '合并文本'), value: true, variant: 'primary' }],
    });
    if (!ok) return;
    const value = JSON.parse(area.value), brief = textBrief(value);
    if (!brief && (!object(value) || Object.values(value).some(item => typeof item !== 'string'))) throw Error(t('Expected the AI brief or an object of key → text.', '需要 AI 简报格式，或 键 → 文本 的对象。'));
    await this.importEntries(brief ? languages.map(code => ({ path: `${code}.json`, text: JSON.stringify(brief[code]) })) : [{ path: `${lang.value}.json`, text: area.value }]);
  }

  /* ---------------------------------------------------------------- export -- */

  name(kind, ext) { return `${kind}-${slug(this.app.sessions.current?.name)}-${stamp()}.${ext}`; }

  async exportBundle(ids = null) {
    const t = this.t, workspace = this.store.serialize();
    const paths = ids ? ids.map(id => this.store.doc(id)?.path).filter(Boolean) : null;
    const subset = paths ? subsetWorkspace(workspace, paths) : workspace;
    const broken = subset.documents.map(entry => [entry.path, validateDialogue(entry.dialogue).errors]).filter(([, errors]) => errors.length);
    if (!subset.documents.length) throw Error(t('Nothing to export yet.', '还没有可导出的内容。'));
    if (broken.length) {
      const go = await this.app.ui.dialog({
        title: t('Fix structure before exporting', '导出前请先修正结构'),
        description: t(`${broken.length} dialogues have structural errors. Unwritten text is fine; broken links and missing endings are not.`, `${broken.length} 个对话有结构错误。文本没写完没关系，但断开的连线和缺失的结束节点必须修正。`),
        body: h('ul', { class: 'ds-dialog__list' }, broken.slice(0, 8).map(([path, errors]) => h('li', {}, h('span', { class: 'ds-mono', text: path }), h('small', { text: ` — ${errors[0]}` })))),
        actions: [{ label: t('Close', '关闭'), value: null }, { label: t('Show problems', '查看问题'), value: 'show', variant: 'primary' }],
      });
      if (go === 'show') {
        const target = this.store.docByPath(broken[0][0]);
        if (target) this.app.open(target.id);
        this.app.showInspector('issues');
      }
      return;
    }
    const files = buildResourceFiles(subset, { includeWorkspace: true });
    download(this.name(paths ? 'isekai-dialogues-part' : 'isekai-dialogues', 'zip'), await zipCompressed(files));
    this.app.ui.toast(t(`Exported ${subset.documents.length} dialogues with both language files, the to-do list and a workspace copy.`, `已导出 ${subset.documents.length} 个对话，含双语文件、待办清单和工作区副本。`), { kind: 'success' });
  }

  exportDocument(id) {
    const entry = this.store.doc(id);
    if (!entry) return;
    download(entry.path.split('/').pop(), JSON.stringify(entry.dialogue, null, 2) + '\n');
    if (validateDialogue(entry.dialogue).errors.length) this.app.ui.toast(this.t('Exported, but this dialogue still has structural errors.', '已导出，但这个对话仍有结构错误。'), { kind: 'error' });
  }

  exportCurrent() { if (this.app.entry) this.exportDocument(this.app.entry.id); }

  async exportText() {
    const workspace = this.store.serialize();
    const files = { ...languageFiles(workspace), 'translation-todo.json': translationTodo(workspace) };
    download(this.name('dialogue-text', 'zip'), await zipCompressed(files));
  }

  exportTodo() { download('translation-todo.json', translationTodo(this.store.serialize())); }

  exportBackup() { this.app.sessions.backup(this.app.sessions.current.id); }

  /* ------------------------------------------------------------ documents -- */

  pathField(label, value) {
    const input = h('input', { class: 'ds-input ds-mono', value, spellcheck: false, attrs: { autofocus: true, 'aria-label': label } });
    requestAnimationFrame(() => { const end = value.endsWith('.json') ? value.length - 5 : value.length; input.setSelectionRange(value.lastIndexOf('/') + 1, end); });
    return input;
  }

  checkPath(path, ignore = new Set()) {
    const t = this.t;
    if (!safePath(path)) throw Error(t('Use a relative lowercase path ending in .json, e.g. npc/unique/my_npc/menu/talk/interact/relationship/normal/repeat.json', '请使用以 .json 结尾的小写相对路径，例如 npc/unique/my_npc/menu/talk/interact/relationship/normal/repeat.json'));
    const other = this.store.docByPath(path);
    if (other && !ignore.has(other.id)) throw Error(t(`${path} already exists.`, `${path} 已存在。`));
  }

  async prompt(title, value, description) {
    const input = h('input', { class: 'ds-input', value, attrs: { autofocus: true, 'aria-label': title } });
    const ok = await this.app.ui.dialog({ title, description, body: input, actions: [{ label: this.t('Cancel', '取消'), value: false }, { label: this.t('Save', '保存'), value: true, variant: 'primary' }] });
    return ok ? input.value : null;
  }

  async newDocument(prefix = '') {
    const t = this.t;
    const path = this.pathField(t('Resource path', '资源路径'), `${prefix}new_dialogue.json`);
    const names = { conversation: t('Simple conversation', '日常对话'), choice: t('Branching conversation', '分支对话'), trade: t('NPC trade', 'NPC 交易'), requirement: t('Conditional reply', '条件选项') };
    const template = h('select', { class: 'ds-input' }, Object.keys(templates).map(key => h('option', { value: key, text: names[key] ?? key })));
    const ok = await this.app.ui.dialog({
      title: t('New dialogue', '新建对话'),
      body: h('div', { class: 'ds-stack' },
        h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: t('Resource path', '资源路径') }), path,
          h('small', { class: 'ds-field__hint', text: t('Relative to data/isekaiexpansion/blabber/blabber_dialogues/.', '相对于 data/isekaiexpansion/blabber/blabber_dialogues/。') })),
        h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: t('Start from', '起始模板') }), template)),
      actions: [{ label: t('Cancel', '取消'), value: false }, { label: t('Create', '创建'), value: true, variant: 'primary' }],
    });
    if (!ok) return;
    const value = path.value.trim();
    this.checkPath(value);
    const dialogue = JSON.parse(JSON.stringify(templates[template.value].document).replaceAll('$key', keyPrefix(value)));
    const id = this.store.mutate(t('New dialogue', '新建对话'), tx => tx.add({ path: value, dialogue }).id);
    this.app.open(id, { view: 'graph' });
  }

  /** Moves documents, optionally renaming keys that follow the old path so text stays attached. */
  async moveDocuments(ids) {
    const t = this.t, store = this.store, entries = ids.map(id => store.doc(id)).filter(Boolean);
    if (!entries.length) return;
    const single = entries.length === 1;
    const common = single ? entries[0].path : commonPrefix(entries.map(entry => entry.path));
    const from = h('input', { class: 'ds-input ds-mono', value: common, spellcheck: false, attrs: { 'aria-label': t('Replace', '替换') } });
    const to = single ? this.pathField(t('New path', '新路径'), common) : h('input', { class: 'ds-input ds-mono', value: common, spellcheck: false, attrs: { autofocus: true, 'aria-label': t('With', '替换为') } });
    const rekey = h('input', { type: 'checkbox', checked: true });
    const ok = await this.app.ui.dialog({
      title: single ? t('Move or rename dialogue', '移动或重命名对话') : t(`Move ${entries.length} dialogues`, `移动 ${entries.length} 个对话`),
      body: h('div', { class: 'ds-stack' },
        single ? null : h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: t('Replace this part of each path', '把路径中的这一段') }), from),
        h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: single ? t('New path', '新路径') : t('With', '替换为') }), to),
        h('label', { class: 'ds-check' }, rekey, h('span', { text: t('Also rename translation keys that follow the old path, and carry their text over', '同时重命名跟随旧路径的翻译键，并带上已写的文本') }))),
      actions: [{ label: t('Cancel', '取消'), value: false }, { label: t('Move', '移动'), value: true, variant: 'primary' }],
    });
    if (!ok) return;
    const plan = entries.map(entry => ({ entry, path: single ? to.value.trim() : entry.path.startsWith(from.value) ? to.value + entry.path.slice(from.value.length) : entry.path })).filter(item => item.path !== item.entry.path);
    if (!plan.length) return;
    const moving = new Set(plan.map(item => item.entry.id)), targets = new Set();
    for (const item of plan) {
      this.checkPath(item.path, moving);
      if (targets.has(item.path)) throw Error(t(`Two dialogues would both become ${item.path}.`, `有两个对话都会变成 ${item.path}。`));
      targets.add(item.path);
    }
    store.mutate(t('Move dialogues', '移动对话'), tx => {
      const pairs = [];
      for (const { entry, path } of plan) {
        const target = tx.edit(entry.id);
        if (rekey.checked) {
          const result = rekeyDialogue(target.dialogue, keyPrefix(target.path), keyPrefix(path));
          target.dialogue = result.dialogue; pairs.push(...result.pairs);
        }
        target.path = path;
      }
      carryText(store, tx, pairs, true);
    });
    this.app.ui.toast(t(`Moved ${plan.length} dialogues.`, `已移动 ${plan.length} 个对话。`), { kind: 'success', action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
  }

  async moveFolder(prefix) {
    const ids = this.store.documents.filter(entry => entry.path.startsWith(`${prefix}/`)).map(entry => entry.id);
    await this.moveDocuments(ids);
  }

  async duplicateDocument(id) {
    const t = this.t, store = this.store, entry = store.doc(id);
    if (!entry) return;
    let suggestion = entry.path.replace(/\.json$/, '_copy.json'), n = 2;
    while (store.docByPath(suggestion)) suggestion = entry.path.replace(/\.json$/, `_copy_${n++}.json`);
    const path = this.pathField(t('New path', '新路径'), suggestion), rekey = h('input', { type: 'checkbox', checked: true });
    const ok = await this.app.ui.dialog({
      title: t('Duplicate dialogue', '复制对话'),
      body: h('div', { class: 'ds-stack' }, h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: t('New path', '新路径') }), path),
        h('label', { class: 'ds-check' }, rekey, h('span', { text: t('Give the copy its own translation keys (text is copied)', '副本使用自己的翻译键（复制已写文本）') }))),
      actions: [{ label: t('Cancel', '取消'), value: false }, { label: t('Duplicate', '复制'), value: true, variant: 'primary' }],
    });
    if (!ok) return;
    const value = path.value.trim();
    this.checkPath(value);
    const newId = store.mutate(t('Duplicate dialogue', '复制对话'), tx => {
      const result = rekey.checked ? rekeyDialogue(entry.dialogue, keyPrefix(entry.path), keyPrefix(value)) : { dialogue: structuredClone(entry.dialogue), pairs: [] };
      const added = tx.add({ path: value, dialogue: result.dialogue, layout: structuredClone(entry.layout) }, store.indexOf(entry.id) + 1);
      carryText(store, tx, result.pairs, false);
      return added.id;
    });
    this.app.open(newId);
  }

  async deleteDocuments(ids) {
    const t = this.t, store = this.store, entries = ids.map(id => store.doc(id)).filter(Boolean);
    if (!entries.length) return;
    const ok = await this.app.ui.confirm(
      entries.length === 1 ? t('Delete this dialogue?', '删除这个对话？') : t(`Delete ${entries.length} dialogues?`, `删除 ${entries.length} 个对话？`),
      entries.length === 1 ? `${entries[0].path}\n${t('You can undo this.', '可以撤销。')}` : t('You can undo this. Their text stays in the session until you clean up unused text.', '可以撤销。它们的文本会留在工作区里，直到你清理未使用的文本。'),
      { danger: true, ok: t('Delete', '删除') });
    if (!ok) return;
    store.mutate(t('Delete dialogues', '删除对话'), tx => { for (const entry of entries) tx.remove(entry.id); });
    this.app.explorer.checked.clear();
    this.app.ui.toast(t(`Deleted ${entries.length} dialogues.`, `已删除 ${entries.length} 个对话。`), { action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
  }
}

function commonPrefix(paths) {
  let prefix = paths[0] ?? '';
  for (const path of paths) while (!path.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix.slice(0, prefix.lastIndexOf('/') + 1);
}

/** Copies text from renamed keys; on a move, drops the old keys that nothing uses any more. */
function carryText(store, tx, pairs, move) {
  for (const [from, to] of pairs) for (const lang of languages) {
    const value = store.text(lang, from);
    if (value && !store.text(lang, to)) tx.text(lang, to, value);
  }
  if (!move) return;
  const used = new Set(store.documents.flatMap(entry => [...translationKeys(entry.dialogue)]));
  for (const [from] of pairs) if (!used.has(from)) for (const lang of languages) if (Object.hasOwn(store.ws.translations[lang], from)) tx.text(lang, from, undefined);
}
