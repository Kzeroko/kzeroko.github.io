import { GraphCanvas } from './canvas.mjs';
import { fill, h, isTyping } from './dom.mjs';
import { Explorer } from './explorer.mjs';
import { Generator } from './generator.mjs';
import { Inspector } from './inspector.mjs';
import { IO } from './io.mjs';
import { IssuesPanel, Preview } from './panels.mjs';
import { Sessions } from './sessions.mjs';
import { Store } from './store.mjs';
import { TextTable } from './texts.mjs';
import { UI } from './ui.mjs';

const SETTINGS = 'isekai-dialogue-studio:settings';
const DEFAULTS = { wheel: 'zoom', snap: true, minimap: true, side: 288, insp: 380, panel: 'files', inspector: true };
const NARROW = '(max-width: 1100px)', PHONE = '(max-width: 760px)';
const SINGULAR = { dialogues: 'dialogue', nodes: 'node', texts: 'text', keys: 'key', 'text keys': 'text key', replies: 'reply', errors: 'error', files: 'file', sessions: 'session', steps: 'step', notes: 'note' };
/** English copy is written in the plural; a count of exactly one is corrected here rather than at every call. */
const singular = text => text.replace(/(^|[^\d.,])1 (text keys|dialogues|nodes|texts|keys|replies|errors|files|sessions|steps|notes)\b/g, (_, before, word) => `${before}1 ${SINGULAR[word]}`);

class App {
  constructor(root) {
    this.root = root;
    this.lang = root.dataset.lang;
    this.t = (en, zh) => this.lang === 'zh-cn' ? zh : singular(en);
    this.q = selector => root.querySelector(selector);
    this.settings = { ...DEFAULTS, ...(() => { try { return JSON.parse(localStorage.getItem(SETTINGS)) ?? {}; } catch { return {}; } })() };
    this.previewLang = this.lang === 'zh-cn' ? 'zh_cn' : 'en_us';
    this.selection = new Set(); this.currentId = null; this.focusReply = null; this.clipboard = null;
    this.view = 'graph'; this.tab = 'inspect'; this.panel = null; this.spaceHeld = false;

    this.store = new Store();
    this.ui = new UI(this);
    this.canvas = new GraphCanvas(this, this.q('[data-canvas]'));
    this.explorer = new Explorer(this, this.q('[data-panel-view="files"]'));
    this.generator = new Generator(this, this.q('[data-panel-view="generate"]'));
    this.sessions = new Sessions(this, this.q('[data-panel-view="sessions"]'));
    this.inspector = new Inspector(this, this.q('[data-tab-view="inspect"]'));
    this.preview = new Preview(this, this.q('[data-tab-view="play"]'));
    this.issues = new IssuesPanel(this, this.q('[data-tab-view="issues"]'));
    this.texts = new TextTable(this, this.q('[data-texts]'));
    this.io = new IO(this);
    this.store.on(change => this.changed(change));

    this.applyLayout();
    this.openPanel(matchMedia(NARROW).matches ? null : this.settings.panel, { save: false });
    this.showInspector(matchMedia(PHONE).matches ? null : this.settings.inspector ? 'inspect' : null, { save: false });
    this.bind();
    this.renderHelp();
    this.run(() => this.sessions.init()).then(() => root.classList.add('is-ready'));
  }

  get entry() { return this.store.doc(this.currentId); }

  async run(fn) {
    try { return await fn(); }
    catch (error) { console.error(error); this.ui.toast(error.message || String(error), { kind: 'error' }); return undefined; }
  }

  saveSettings() { try { localStorage.setItem(SETTINGS, JSON.stringify(this.settings)); } catch { /* per-browser convenience only */ } }

  /* ------------------------------------------------------------- workspace -- */

  loadWorkspace(value, meta) {
    this.store.load(value);
    if (meta?.name) this.store.ws.name = meta.name;
    this.currentId = (meta?.lastPath && this.store.docByPath(meta.lastPath)?.id) ?? this.store.documents[0]?.id ?? null;
    this.selection = new Set(); this.focusReply = null;
    this.canvas.views.clear(); this.canvas.docId = null;
    this.explorer.expanded.clear(); this.explorer.checked.clear();
    this.preview.reset();
    if (this.currentId) this.explorer.reveal(this.currentId); else this.explorer.render();
    this.refreshAll();
  }

  refreshAll() {
    this.syncCanvas({ force: true });
    this.inspector.render();
    if (this.view === 'text') this.texts.render();
    this.renderTab(); this.renderTitle(); this.renderHistory(); this.renderStatus();
    if (this.panel === 'sessions') this.sessions.render();
  }

  open(id, { view } = {}) {
    if (!this.store.doc(id)) return;
    this.currentId = id; this.selection = new Set(); this.focusReply = null;
    this.sessions.remember(this.entry.path);
    if (view && view !== this.view) this.setView(view);
    this.syncCanvas();
    this.explorer.reveal(id);
    this.inspector.render(); this.renderTab(); this.renderTitle(); this.statusSoon();
    if (this.view === 'text' && this.texts.scope !== 'all') this.texts.render();
    if (matchMedia(NARROW).matches && this.panel === 'files') this.openPanel(null);
  }

  select(names, { quiet = false } = {}) {
    this.selection = new Set(names);
    this.canvas.updateSelection();
    if (!quiet) this.inspector.render();
  }

  setText(lang, key, value, source = 'inspector') {
    this.store.mutate(this.t('Edit text', '编辑文本'), tx => tx.text(lang, key, value), { coalesce: `text:${lang}:${key}`, source });
  }

  setPreviewLang(lang) {
    this.previewLang = lang;
    this.canvas.refreshTexts(); this.canvas.drawWires();
    this.preview.render();
    this.q('[data-preview-lang]').textContent = lang === 'zh_cn' ? '中文' : 'EN';
  }

  undo() { if (this.store.undo()) this.flash('undo'); }
  redo() { if (this.store.redo()) this.flash('redo'); }
  flash(kind) { const entry = (kind === 'undo' ? this.store.redoStack : this.store.undoStack).at(-1); if (entry) this.setHint(`${kind === 'undo' ? this.t('Undid', '已撤销') : this.t('Redid', '已重做')}: ${entry.label}`); }

  changed(change) {
    const pending = this.pending ??= { docs: new Set(), texts: new Set(), sources: new Set(), structural: false };
    change.docs.forEach(id => pending.docs.add(id));
    change.texts.forEach(key => pending.texts.add(key));
    pending.sources.add(change.source ?? 'app');
    pending.structural ||= change.structural;
    if (change.kind !== 'history') this.sessions.schedule();
    if (!this.frame) { this.frame = true; queueMicrotask(() => this.flushChanges()); }
  }

  flushChanges() {
    const pending = this.pending;
    this.pending = null; this.frame = 0;
    if (!pending) return;
    if (this.currentId !== null && !this.store.doc(this.currentId)) { this.currentId = this.store.documents[0]?.id ?? null; this.selection = new Set(); }
    if (this.currentId === null && this.store.documents.length) this.currentId = this.store.documents[0].id;
    const entry = this.entry;
    if (entry) for (const name of this.selection) if (!Object.hasOwn(entry.dialogue.states, name)) this.selection.delete(name);
    const only = source => pending.sources.size === 1 && pending.sources.has(source);
    if (pending.docs.size) this.explorer.render(); else this.explorerSoon();
    this.syncCanvas({ texts: pending.texts.size > 0 });
    if (!only('inspector')) this.inspector.render();
    if (this.view === 'text' && !only('table')) this.texts.render();
    this.renderTab(); this.renderTitle(); this.renderHistory(); this.statusSoon();
    if (this.panel === 'sessions' && pending.docs.size) this.sessions.render();
  }

  syncCanvas(options = {}) {
    if (this.view !== 'graph') { this.canvasStale = true; return; }
    this.canvas.sync({ ...options, force: options.force || this.canvasStale });
    this.canvasStale = false;
    this.q('[data-welcome]').hidden = !!this.entry;
    this.q('[data-canvas-tools]').hidden = !this.entry;
    this.q('[data-minimap]').hidden = !this.entry || !this.settings.minimap;
  }

  explorerSoon() { clearTimeout(this.explorerTimer); this.explorerTimer = setTimeout(() => this.explorer.render(), 400); }
  statusSoon() { clearTimeout(this.statusTimer); this.statusTimer = setTimeout(() => this.renderStatus(), 300); }

  /* --------------------------------------------------------------- chrome -- */

  applyLayout() {
    this.root.style.setProperty('--ds-side', `${this.settings.side}px`);
    this.root.style.setProperty('--ds-insp', `${this.settings.insp}px`);
    this.q('[data-minimap]').hidden = !this.settings.minimap || !this.entry;
  }

  openPanel(name, { save = true } = {}) {
    this.panel = name && name === this.panel && save ? null : name;
    this.root.dataset.panel = this.panel ?? '';
    for (const el of this.root.querySelectorAll('[data-panel-view]')) el.hidden = el.dataset.panelView !== this.panel;
    for (const el of this.root.querySelectorAll('[data-open-panel]')) el.setAttribute('aria-pressed', String(el.dataset.openPanel === this.panel));
    if (this.panel === 'sessions') this.sessions.render();
    if (this.panel === 'files') this.explorer.render();
    if (this.panel === 'generate') this.generator.render();
    if (save && !matchMedia(NARROW).matches) { this.settings.panel = this.panel; this.saveSettings(); }
  }

  showInspector(tab, { save = true } = {}) {
    this.tab = tab;
    this.root.dataset.inspector = tab ? 'open' : '';
    for (const el of this.root.querySelectorAll('[data-tab]')) { el.setAttribute('aria-selected', String(el.dataset.tab === tab)); el.tabIndex = el.dataset.tab === tab ? 0 : -1; }
    for (const el of this.root.querySelectorAll('[data-tab-view]')) el.hidden = el.dataset.tabView !== tab;
    this.q('[data-action="toggle-inspector"]')?.setAttribute('aria-pressed', String(!!tab));
    this.renderTab();
    if (save && !matchMedia(PHONE).matches) { this.settings.inspector = !!tab; this.saveSettings(); }
  }

  renderTab() {
    if (this.tab === 'inspect') return;
    if (this.tab === 'play') this.preview.render();
    if (this.tab === 'issues') this.issues.render();
  }

  setView(view) {
    this.view = view;
    this.root.dataset.view = view;
    for (const el of this.root.querySelectorAll('[data-set-view]')) el.setAttribute('aria-checked', String(el.dataset.setView === view));
    this.q('[data-graph-view]').hidden = view !== 'graph';
    this.q('[data-texts]').hidden = view !== 'text';
    if (view === 'graph') this.syncCanvas({ force: true });
    else this.texts.render();
  }

  renderTitle() {
    const crumb = this.q('[data-crumb]'), entry = this.entry;
    if (!entry) { crumb.replaceChildren(h('span', { class: 'ds-crumb__file', text: this.t('No dialogue open', '未打开对话') })); return; }
    const cut = entry.path.lastIndexOf('/');
    fill(crumb,
      cut > 0 ? h('span', { class: 'ds-crumb__folder' }, h('bdi', { text: entry.path.slice(0, cut + 1) })) : null,
      h('span', { class: 'ds-crumb__file', text: entry.path.slice(cut + 1).replace(/\.json$/, '') }));
    crumb.title = entry.path;
  }

  renderHistory() {
    const undo = this.q('[data-action="undo"]'), redo = this.q('[data-action="redo"]');
    const last = this.store.undoStack.at(-1), next = this.store.redoStack.at(-1);
    undo.disabled = !last; redo.disabled = !next;
    undo.setAttribute('aria-label', last ? `${this.t('Undo', '撤销')}: ${last.label}` : this.t('Undo', '撤销'));
    redo.setAttribute('aria-label', next ? `${this.t('Redo', '重做')}: ${next.label}` : this.t('Redo', '重做'));
  }

  renderStatus() {
    const t = this.t, totals = this.store.totals(), count = this.store.documents.length;
    this.q('[data-stat-docs]').textContent = t(`${count.toLocaleString()} dialogues`, `${count.toLocaleString()} 个对话`);
    this.q('[data-stat-text]').textContent = t(`${totals.unfinished.toLocaleString()} texts to write`, `${totals.unfinished.toLocaleString()} 条待写文本`);
    const errors = this.q('[data-stat-errors]');
    errors.textContent = totals.errors ? t(`${totals.errors} errors`, `${totals.errors} 个错误`) : t('No errors', '无错误');
    errors.closest('button').classList.toggle('is-error', totals.errors > 0);
    this.q('[data-issue-count]').textContent = totals.errors ? String(totals.errors) : '';
  }

  setSaveState(state) {
    const t = this.t, el = this.q('[data-save]');
    const text = { saved: t('Saved in this browser', '已保存在本机'), saving: t('Saving…', '保存中…'), error: t('Not saved — download a backup', '未保存，请下载备份'), memory: t('Storage blocked — download a backup', '存储被禁用，请下载备份') }[state];
    el.dataset.state = state;
    el.querySelector('span').textContent = text;
  }

  setHint(text) {
    const el = this.q('[data-hint]');
    el.textContent = text;
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => { el.textContent = ''; }, 2500);
  }

  onZoom(z) { this.q('[data-zoom]').textContent = `${Math.round(z * 100)}%`; }

  renderHelp() {
    const t = this.t, root = this.q('[data-panel-view="help"]');
    const keys = [
      [t('Undo / redo', '撤销 / 重做'), 'Ctrl Z · Ctrl Shift Z'],
      [t('Save now', '立即保存'), 'Ctrl S'],
      [t('Add node', '添加节点'), t('Double-click canvas', '双击画布')],
      [t('Link a reply', '连接选项'), t('Drag ● to a node', '把 ● 拖到节点上')],
      [t('Pan', '平移'), t('Drag empty space · Space + drag', '拖动空白处 · 空格 + 拖动')],
      [t('Zoom', '缩放'), t('Wheel · + / − · 0 = 100%', '滚轮 · + / − · 0 = 100%')],
      [t('Box select', '框选'), t('Shift + drag', 'Shift + 拖动')],
      [t('Select all', '全选'), 'Ctrl A'],
      [t('Copy / paste / duplicate', '复制 / 粘贴 / 复制一份'), 'Ctrl C · Ctrl V · Ctrl D'],
      [t('Delete nodes', '删除节点'), 'Delete'],
      [t('Move nodes', '移动节点'), t('Arrow keys (Shift = further)', '方向键（Shift 移动更远）')],
      [t('Fit to view / tidy layout', '适应窗口 / 整理布局'), 'F · L'],
      [t('Edit the selected node', '编辑选中节点'), 'Enter'],
      [t('Previous / next file', '上一个 / 下一个文件'), 'Alt ↑ · Alt ↓'],
      [t('Search files', '搜索文件'), '/'],
    ];
    const setting = (label, input) => h('label', { class: 'ds-check' }, input, h('span', { text: label }));
    const wheel = h('select', { class: 'ds-input' }, [['zoom', t('Mouse wheel zooms', '滚轮缩放')], ['pan', t('Mouse wheel pans (Ctrl + wheel zooms)', '滚轮平移（Ctrl + 滚轮缩放）')]].map(([value, label]) => h('option', { value, text: label, selected: this.settings.wheel === value })));
    wheel.addEventListener('change', () => { this.settings.wheel = wheel.value; this.saveSettings(); });
    fill(root,
      h('div', { class: 'ds-panel__head' }, h('h2', { class: 'ds-panel__title', text: t('Shortcuts & settings', '快捷键与设置') })),
      h('div', { class: 'ds-panel__scroll' },
        h('dl', { class: 'ds-keys' }, keys.map(([label, combo]) => [h('dt', { text: label }), h('dd', { text: combo })])),
        h('h3', { class: 'ds-subhead', text: t('Settings', '设置') }),
        h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: t('Mouse wheel', '鼠标滚轮') }), wheel),
        setting(t('Snap nodes to the grid (hold Alt to place freely)', '节点吸附网格（按住 Alt 自由放置）'), h('input', { type: 'checkbox', checked: this.settings.snap, onchange: e => { this.settings.snap = e.target.checked; this.saveSettings(); } })),
        setting(t('Show the minimap', '显示小地图'), h('input', { type: 'checkbox', checked: this.settings.minimap, onchange: e => { this.settings.minimap = e.target.checked; this.saveSettings(); this.applyLayout(); this.canvas.scheduleMinimap(); } })),
        h('h3', { class: 'ds-subhead', text: t('Reference', '参考') }),
        h('ul', { class: 'ds-tips' },
          h('li', {}, h('a', { href: `/${this.lang}/dev/dialogue-tools/`, text: t('How Dialogue Studio works', '对话工坊使用说明') })),
          h('li', {}, h('a', { href: `/${this.lang}/wiki/dialogue-data/`, text: t('Dialogue data format and NPC routes', '对话数据格式与 NPC 路由') })))));
  }

  /* --------------------------------------------------------------- events -- */

  bind() {
    const root = this.root;
    root.addEventListener('click', event => {
      const target = event.target.closest('[data-action], [data-open-panel], [data-tab], [data-set-view], [data-canvas-action]');
      if (!target || !root.contains(target)) return;
      this.run(() => this.command(target, event));
    });
    this.q('[role="tablist"][data-tabs]').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const tabs = [...root.querySelectorAll('[data-tab]')], index = tabs.findIndex(tab => tab.dataset.tab === this.tab);
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      this.showInspector(next.dataset.tab); next.focus();
    });
    document.addEventListener('keydown', event => this.key(event));
    document.addEventListener('keyup', event => { if (event.code === 'Space') { this.spaceHeld = false; root.classList.remove('is-space'); } });
    addEventListener('blur', () => { this.spaceHeld = false; root.classList.remove('is-space'); });
    this.q('[data-canvas]').addEventListener('pointerdown', () => { if (matchMedia(NARROW).matches && this.panel) this.openPanel(null); });

    for (const handle of root.querySelectorAll('[data-resize]')) handle.addEventListener('pointerdown', event => this.resize(event, handle.dataset.resize));

    let depth = 0;
    const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files');
    root.addEventListener('dragenter', event => { if (!hasFiles(event)) return; event.preventDefault(); depth++; root.classList.add('is-dropping'); });
    root.addEventListener('dragover', event => { if (hasFiles(event)) event.preventDefault(); });
    root.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) root.classList.remove('is-dropping'); });
    root.addEventListener('drop', event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); depth = 0; root.classList.remove('is-dropping');
      this.run(() => this.io.importDrop(event.dataTransfer));
    });

    addEventListener('beforeunload', event => { if (this.sessions.dirty) { this.run(() => this.sessions.flush()); event.preventDefault(); } });
    addEventListener('pagehide', () => { this.run(() => this.sessions.flush()); });
    matchMedia(NARROW).addEventListener('change', () => this.openPanel(matchMedia(NARROW).matches ? null : this.settings.panel, { save: false }));
    matchMedia(PHONE).addEventListener('change', () => this.showInspector(matchMedia(PHONE).matches || !this.settings.inspector ? null : this.tab ?? 'inspect', { save: false }));
  }

  command(target) {
    const t = this.t;
    if (target.dataset.openPanel) { this.openPanel(target.dataset.openPanel); return; }
    if (target.dataset.tab) { this.showInspector(target.dataset.tab); return; }
    if (target.dataset.setView) { this.setView(target.dataset.setView); return; }
    const canvas = this.canvas;
    switch (target.dataset.canvasAction) {
      case 'add': { const rect = target.getBoundingClientRect(); canvas.library({ x: rect.left, y: rect.bottom + 6 }, canvas.center()); return; }
      case 'tidy': canvas.tidy(); return;
      case 'fit': canvas.fit(); return;
      case 'zoom-in': canvas.zoomBy(1.2); return;
      case 'zoom-out': canvas.zoomBy(1 / 1.2); return;
      case 'zoom-reset': canvas.zoomTo(1); return;
      default: break;
    }
    switch (target.dataset.action) {
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'toggle-inspector': this.showInspector(this.tab ? null : 'inspect'); break;
      case 'preview-lang': this.setPreviewLang(this.previewLang === 'en_us' ? 'zh_cn' : 'en_us'); break;
      case 'issues': this.showInspector('issues'); break;
      case 'new': this.io.newDocument(); break;
      case 'import-files': this.io.pick('files'); break;
      case 'import-folder': this.io.pick('folder'); break;
      case 'import': this.ui.menu(target, [
        { label: t('Files (JSON or ZIP)…', '文件（JSON 或 ZIP）…'), icon: 'file', onSelect: () => this.io.pick('files') },
        { label: t('A whole folder…', '整个文件夹…'), icon: 'folder', onSelect: () => this.io.pick('folder') },
        { label: t('Paste text JSON…', '粘贴文本 JSON…'), icon: 'languages', onSelect: () => this.io.pasteTexts() },
        '-',
        { heading: t('Or drop files and folders anywhere on the Studio.', '也可以把文件或文件夹直接拖进工坊。') },
      ]); break;
      case 'export': this.ui.menu(target, [
        { label: t('Resource bundle (ZIP)', '资源包（ZIP）'), icon: 'download', hint: t('all', '全部'), onSelect: () => this.io.exportBundle() },
        { label: t('Selected files as bundle', '所选文件导出为资源包'), icon: 'checkbox', disabled: !this.explorer.checked.size, hint: String(this.explorer.checked.size || ''), onSelect: () => this.io.exportBundle([...this.explorer.checked]) },
        { label: t('This dialogue (JSON)', '当前对话（JSON）'), icon: 'file', disabled: !this.entry, onSelect: () => this.io.exportCurrent() },
        '-',
        { label: t('Language files + to-do (ZIP)', '语言文件 + 待办（ZIP）'), icon: 'languages', onSelect: () => this.io.exportText() },
        { label: t('Translation to-do only', '仅翻译待办'), icon: 'list', onSelect: () => this.io.exportTodo() },
        '-',
        { label: t('Workspace backup', '工作区备份'), icon: 'save', onSelect: () => this.io.exportBackup() },
      ]); break;
      default: break;
    }
  }

  key(event) {
    if (!this.root.isConnected || this.ui.dialogEl.open) return;
    const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase(), typing = isTyping(event.target);
    if (mod && key === 's') { event.preventDefault(); this.run(async () => { await this.sessions.flush(); this.setHint(this.t('Saved.', '已保存。')); }); return; }
    if (typing) { if (event.key === 'Escape') event.target.blur(); return; }
    if (event.target.closest?.('.ds-menu')) return;
    if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && key === 'y') { event.preventDefault(); this.redo(); return; }
    if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); this.step(event.key === 'ArrowDown' ? 1 : -1); return; }
    if (event.key === '/') { event.preventDefault(); this.openPanel('files', { save: false }); this.explorer.search.focus(); return; }
    if (this.view !== 'graph' || !this.entry) return;
    const onButton = event.target.closest?.('button, a, summary');
    if (event.code === 'Space' && !onButton) { event.preventDefault(); this.spaceHeld = true; this.root.classList.add('is-space'); return; }
    if (onButton && (event.key === 'Enter' || event.code === 'Space')) return;
    const canvas = this.canvas, grid = event.shiftKey ? 100 : 20;
    const run = fn => { event.preventDefault(); this.run(fn); };
    if (mod && key === 'a') run(() => this.select(Object.keys(this.entry.dialogue.states)));
    else if (mod && key === 'c') run(() => canvas.copy());
    else if (mod && key === 'v') run(() => canvas.paste());
    else if (mod && key === 'd') run(() => canvas.duplicate());
    else if (mod) return;
    else if (event.key === 'Delete' || event.key === 'Backspace') run(() => canvas.deleteSelected());
    else if (key === 'f') run(() => canvas.fit(this.selection.size > 1 ? [...this.selection] : undefined));
    else if (key === 'l') run(() => canvas.tidy());
    else if (key === '0') run(() => canvas.zoomTo(1));
    else if (key === '+' || key === '=') run(() => canvas.zoomBy(1.2));
    else if (key === '-') run(() => canvas.zoomBy(1 / 1.2));
    else if (event.key === 'Escape') run(() => { this.ui.dismiss(); this.select([]); });
    else if (event.key === 'Enter' && this.selection.size === 1) run(() => this.inspector.focusFirst());
    else if (event.key.startsWith('Arrow') && this.selection.size) {
      const delta = { ArrowLeft: [-grid, 0], ArrowRight: [grid, 0], ArrowUp: [0, -grid], ArrowDown: [0, grid] }[event.key];
      run(() => canvas.nudge(...delta));
    }
  }

  step(direction) {
    const rows = this.explorer.rows().filter(row => row.kind !== 'folder');
    const ids = rows.length ? rows.map(row => row.id) : this.store.documents.map(entry => entry.id);
    if (!ids.length) return;
    const index = ids.indexOf(this.currentId);
    this.open(ids[(index + direction + ids.length) % ids.length] ?? ids[0]);
  }

  resize(event, which) {
    event.preventDefault();
    const handle = event.currentTarget, startX = event.clientX, start = this.settings[which];
    handle.setPointerCapture(event.pointerId);
    const limits = which === 'side' ? [220, 520] : [300, 640];
    const move = e => {
      const delta = which === 'side' ? e.clientX - startX : startX - e.clientX;
      this.settings[which] = Math.round(Math.max(limits[0], Math.min(limits[1], start + delta)));
      this.applyLayout();
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); this.saveSettings(); this.canvas.scheduleMinimap(); this.explorer.draw(); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
  }
}

class DialogueStudioElement extends HTMLElement {
  connectedCallback() {
    if (this.app) return;
    this.app = new App(this);
  }
}

if (!customElements.get('dialogue-studio')) customElements.define('dialogue-studio', DialogueStudioElement);

