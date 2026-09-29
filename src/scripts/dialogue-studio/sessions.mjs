import { unusedTranslationKeys } from '../../lib/dialogue/export.mjs';
import { unreachableStates } from '../../lib/dialogue/graph.mjs';
import { emptyWorkspace, parseWorkspace } from '../../lib/dialogue/model.mjs';
import { SessionStore, newSessionId } from '../../lib/dialogue/sessions.mjs';
import { button, download, fill, fmtBytes, h, icon, slug, stamp } from './dom.mjs';

const LEGACY = 'isekai-dialogue-studio-v1', CURRENT = 'isekai-dialogue-studio:session';
const safe = fn => { try { return fn(); } catch { return null; } };

/**
 * Sessions are whole workspaces kept in this browser. Switching never discards anything, so
 * importing a backup or trying a bulk change can happen in a fresh session instead.
 */
export class Sessions {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.db = new SessionStore(); this.available = true;
    this.list = []; this.current = null; this.dirty = false; this.timer = null;
  }

  async init() {
    const t = this.t;
    try { await this.db.open(); this.list = await this.db.list(); }
    catch { this.available = false; this.app.setSaveState('memory'); }
    const legacy = safe(() => localStorage.getItem(LEGACY));
    if (legacy) {
      try {
        const workspace = parseWorkspace(JSON.parse(legacy));
        if (workspace.documents.length && this.available) await this.create(workspace, t('Restored draft', '恢复的草稿'), { open: false });
        if (this.available) localStorage.removeItem(LEGACY);
      } catch { /* an unreadable old draft is left where it is */ }
    }
    const wanted = safe(() => localStorage.getItem(CURRENT));
    const meta = this.list.find(item => item.id === wanted) ?? this.list[0];
    if (meta) {
      try { await this.open(meta.id); return; }
      catch (error) { this.app.ui.toast(`${t('Could not open the last session', '无法打开上次的工作区')}: ${error.message}`, { kind: 'error' }); }
    }
    await this.create(emptyWorkspace(), t('My dialogues', '我的对话'));
  }

  stats(workspace) {
    return { docs: workspace.documents.length, bytes: new Blob([JSON.stringify(workspace)]).size };
  }

  async create(workspace, name, { open = true } = {}) {
    const now = Date.now(), meta = { id: newSessionId(), name, created: now, updated: now, ...this.stats(workspace) };
    if (this.available) await this.db.save(meta, workspace);
    this.list.unshift(meta);
    if (open) await this.open(meta.id, workspace);
    else this.render();
    return meta;
  }

  async open(id, workspace = null) {
    await this.flush();
    const meta = this.list.find(item => item.id === id);
    if (!meta) throw Error('Session not found.');
    const value = workspace ?? (this.available ? await this.db.load(id) : null) ?? emptyWorkspace();
    this.app.loadWorkspace(value, { ...meta, lastPath: this.lastPath(id) ?? meta.lastPath });
    this.current = meta;
    safe(() => localStorage.setItem(CURRENT, id));
    this.app.setSaveState(this.available ? 'saved' : 'memory');
    this.render();
  }

  /** The open file is a per-browser convenience, kept apart so switching files never rewrites the workspace. */
  remember(path) { if (this.current) safe(() => localStorage.setItem(`${CURRENT}:last:${this.current.id}`, path)); }
  lastPath(id) { return safe(() => localStorage.getItem(`${CURRENT}:last:${id}`)); }

  schedule() {
    if (!this.current) return;
    this.dirty = true;
    if (this.available) this.app.setSaveState('saving');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.app.run(() => this.flush()), 700);
  }

  async flush() {
    clearTimeout(this.timer);
    if (!this.dirty || !this.current || !this.available) return;
    this.dirty = false;
    const workspace = this.app.store.serialize();
    const meta = { ...this.current, name: this.current.name, updated: Date.now(), lastPath: this.app.entry?.path, ...this.stats(workspace) };
    try {
      await this.db.save(meta, workspace);
      this.current = meta;
      this.list = [meta, ...this.list.filter(item => item.id !== meta.id)];
      this.app.setSaveState('saved');
      if (this.app.panel === 'sessions') this.render();
    } catch (error) {
      this.dirty = true;
      this.app.setSaveState('error');
      throw Error(`${this.t('Could not save the session', '工作区保存失败')}: ${error.message}. ${this.t('Download a backup now.', '请立即下载备份。')}`);
    }
  }

  async rename(id, name) {
    const clean = name.trim() || this.t('Untitled', '未命名');
    const meta = this.list.find(item => item.id === id);
    if (!meta) return;
    meta.name = clean;
    if (this.current?.id === id) { this.current.name = clean; this.app.store.ws.name = clean; this.app.renderTitle(); this.schedule(); }
    else if (this.available) await this.db.rename(id, clean);
    this.render();
  }

  async duplicate(id) {
    await this.flush();
    const meta = this.list.find(item => item.id === id);
    const workspace = id === this.current?.id ? this.app.store.serialize() : await this.db.load(id);
    await this.create(structuredClone(workspace), this.t(`${meta.name} (copy)`, `${meta.name}（副本）`), { open: false });
    this.app.ui.toast(this.t('Session duplicated.', '已复制工作区。'), { kind: 'success' });
  }

  async remove(ids) {
    const doomed = ids.filter(id => id !== this.current?.id);
    if (!doomed.length) return;
    if (this.available) await this.db.remove(doomed);
    this.list = this.list.filter(item => !doomed.includes(item.id));
    this.render();
  }

  async backup(id) {
    await this.flush();
    const meta = this.list.find(item => item.id === id);
    const workspace = id === this.current?.id ? this.app.store.serialize() : await this.db.load(id);
    download(`dialogue-workspace-${slug(meta?.name)}-${stamp()}.json`, JSON.stringify({ ...workspace, name: meta?.name }, null, 2));
  }

  /* ----------------------------------------------------------------- panel -- */

  async render() {
    const t = this.t, store = this.app.store;
    if (!this.root.isConnected || this.app.panel !== 'sessions') return;
    const current = this.current, others = this.list.filter(item => item.id !== current?.id);
    const rtf = new Intl.RelativeTimeFormat(this.app.lang === 'zh-cn' ? 'zh-CN' : 'en-GB', { numeric: 'auto' });
    const ago = time => {
      const seconds = Math.round((time - Date.now()) / 1000), abs = Math.abs(seconds);
      if (abs < 60) return rtf.format(seconds, 'second');
      if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
      return rtf.format(Math.round(seconds / 86400), 'day');
    };
    const name = h('input', { class: 'ds-input', value: current?.name ?? '', attrs: { 'aria-label': t('Session name', '工作区名称') } });
    name.addEventListener('change', () => this.app.run(() => this.rename(current.id, name.value)));

    const unused = unusedTranslationKeys(store.ws);
    const unreachable = store.documents.map(entry => [entry.id, unreachableStates(entry.dialogue)]).filter(([, names]) => names.length);
    const unreachableCount = unreachable.reduce((sum, [, names]) => sum + names.length, 0);
    const steps = store.undoStack.length + store.redoStack.length;

    const storage = h('p', { class: 'ds-muted ds-small' });
    navigator.storage?.estimate?.().then(({ usage = 0, quota = 0 }) => { storage.textContent = t(`Browser storage: ${fmtBytes(usage)} of ${fmtBytes(quota)} used.`, `浏览器存储：已用 ${fmtBytes(usage)} / ${fmtBytes(quota)}。`); }).catch(() => {});

    fill(this.root,
      h('div', { class: 'ds-panel__head' }, h('h2', { class: 'ds-panel__title', text: t('Sessions', '工作区') }),
        h('div', { class: 'ds-panel__tools' }, button(t('New session', '新建工作区'), { icon: 'plus', variant: 'ghost', compact: true, onclick: () => this.app.run(() => this.create(emptyWorkspace(), t('Untitled session', '未命名工作区'))) }))),
      h('div', { class: 'ds-panel__scroll' },
        this.available ? null : h('p', { class: 'ds-note is-warning', text: t('This browser is blocking storage, so nothing is saved between visits. Download a backup before closing the tab.', '浏览器禁用了本地存储，关闭页面后内容不会保留。关闭前请先下载备份。') }),
        h('section', { class: 'ds-card ds-card--current' },
          h('p', { class: 'ds-card__eyebrow', text: t('Open now', '当前打开') }),
          name,
          h('p', { class: 'ds-muted ds-small', text: t(`${store.documents.length} dialogues · ${store.catalog().list.length} text keys · ${fmtBytes(current?.bytes ?? 0)}`, `${store.documents.length} 个对话 · ${store.catalog().list.length} 个文本键 · ${fmtBytes(current?.bytes ?? 0)}`) }),
          h('div', { class: 'ds-row ds-row--wrap' },
            button(t('Download backup', '下载备份'), { icon: 'download', variant: 'soft', onclick: () => this.app.run(() => this.backup(current.id)) }),
            button(t('Duplicate', '复制一份'), { icon: 'copy', variant: 'ghost', onclick: () => this.app.run(() => this.duplicate(current.id)) }))),
        h('h3', { class: 'ds-subhead', text: t(`Other sessions (${others.length})`, `其它工作区（${others.length}）`) }),
        others.length ? h('ul', { class: 'ds-session-list' }, others.map(meta => h('li', { class: 'ds-session' },
          h('button', { type: 'button', class: 'ds-session__open', onclick: () => this.app.run(() => this.open(meta.id)) },
            icon('layers', 16),
            h('span', { class: 'ds-session__text' }, h('strong', { text: meta.name }), h('small', { text: t(`${meta.docs} dialogues · ${fmtBytes(meta.bytes)} · ${ago(meta.updated)}`, `${meta.docs} 个对话 · ${fmtBytes(meta.bytes)} · ${ago(meta.updated)}`) }))),
          h('button', { type: 'button', class: 'ds-btn ds-btn--icon ds-btn--ghost', attrs: { 'aria-label': t('More actions', '更多操作') }, onclick: event => this.app.ui.menu(event.currentTarget, [
            { label: t('Open', '打开'), icon: 'layers', onSelect: () => this.open(meta.id) },
            { label: t('Rename…', '重命名…'), icon: 'edit', onSelect: async () => { const value = await this.app.io.prompt(t('Rename session', '重命名工作区'), meta.name); if (value !== null) await this.rename(meta.id, value); } },
            { label: t('Duplicate', '复制一份'), icon: 'copy', onSelect: () => this.duplicate(meta.id) },
            { label: t('Download backup', '下载备份'), icon: 'download', onSelect: () => this.backup(meta.id) },
            '-',
            { label: t('Delete', '删除'), icon: 'trash', danger: true, onSelect: async () => { if (await this.app.ui.confirm(t('Delete this session?', '删除这个工作区？'), t(`"${meta.name}" and its ${meta.docs} dialogues will be removed from this browser. This cannot be undone.`, `「${meta.name}」及其中 ${meta.docs} 个对话将从本机删除，无法撤销。`), { danger: true, ok: t('Delete', '删除') })) await this.remove([meta.id]); } },
          ]) }, icon('more', 14))))) : h('p', { class: 'ds-muted ds-small', text: t('None yet. Importing a workspace backup opens it here as its own session.', '暂无。导入工作区备份时，会作为单独的工作区打开。') }),
        h('h3', { class: 'ds-subhead', text: t('Clean up', '清理') }),
        h('ul', { class: 'ds-cleanup' },
          this.cleanupRow(t('Unused text', '未使用的文本'), t(`${unused.length} keys no dialogue references`, `${unused.length} 个没有被引用的键`), unused.length, t('Remove', '移除'), () => this.removeUnused(unused)),
          this.cleanupRow(t('Unreachable nodes', '到不了的节点'), t(`${unreachableCount} nodes in ${unreachable.length} dialogues`, `${unreachable.length} 个对话中共 ${unreachableCount} 个`), unreachableCount, t('Remove', '移除'), () => this.removeUnreachable(unreachable)),
          this.cleanupRow(t('Undo history', '撤销记录'), t(`${steps} steps held in memory`, `内存中保存了 ${steps} 步`), steps, t('Clear', '清空'), () => { store.clearHistory(); this.render(); this.app.renderHistory(); }),
          this.cleanupRow(t('Other sessions', '其它工作区'), t(`${others.length} saved in this browser`, `本机保存了 ${others.length} 个`), others.length, t('Delete all', '全部删除'), async () => {
            if (await this.app.ui.confirm(t('Delete every other session?', '删除所有其它工作区？'), t(`${others.length} sessions will be removed from this browser. The open one stays. This cannot be undone.`, `将从本机删除 ${others.length} 个工作区，当前打开的保留。无法撤销。`), { danger: true, ok: t('Delete all', '全部删除') })) await this.remove(others.map(item => item.id));
          })),
        storage,
        h('button', { type: 'button', class: 'ds-link ds-link--danger', onclick: () => this.app.run(() => this.reset()) }, t('Reset Dialogue Studio on this browser…', '重置本机的对话工坊…'))));
  }

  cleanupRow(title, detail, count, label, run) {
    return h('li', { class: 'ds-cleanup__row' },
      h('span', { class: 'ds-cleanup__text' }, h('strong', { text: title }), h('small', { text: detail })),
      button(label, { variant: 'ghost', disabled: !count, onclick: () => this.app.run(run) }));
  }

  removeUnused(keys) {
    const t = this.t;
    this.app.store.mutate(t('Remove unused text', '移除未使用的文本'), tx => { for (const key of keys) for (const lang of ['en_us', 'zh_cn']) if (Object.hasOwn(this.app.store.ws.translations[lang], key)) tx.text(lang, key, undefined); });
    this.app.ui.toast(t(`Removed ${keys.length} unused keys.`, `已移除 ${keys.length} 个未使用的键。`), { kind: 'success', action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
    this.render();
  }

  removeUnreachable(list) {
    const t = this.t;
    this.app.store.mutate(t('Remove unreachable nodes', '移除到不了的节点'), tx => {
      for (const [id, names] of list) {
        const entry = tx.edit(id);
        for (const name of names) { delete entry.dialogue.states[name]; delete entry.layout?.[name]; }
      }
    });
    this.app.ui.toast(t('Unreachable nodes removed.', '已移除到不了的节点。'), { kind: 'success', action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
    this.render();
  }

  async reset() {
    const t = this.t;
    if (!await this.app.ui.confirm(t('Reset Dialogue Studio?', '重置对话工坊？'), t('Every session saved in this browser is deleted, including the open one. Download backups first if you need them.', '本机保存的所有工作区都会被删除，包括当前打开的。需要的话请先下载备份。'), { danger: true, ok: t('Delete everything', '全部删除') })) return;
    if (this.available) await this.db.remove(this.list.map(item => item.id));
    this.list = []; this.current = null; this.dirty = false;
    safe(() => localStorage.removeItem(CURRENT));
    await this.create(emptyWorkspace(), t('My dialogues', '我的对话'));
  }
}
