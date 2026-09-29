import { button, fill, h, icon } from './dom.mjs';

const ROW = 30, RESULT_ROW = 46, OVERSCAN = 8;
const collator = new Intl.Collator('en', { numeric: true });

/**
 * File tree for thousands of dialogues. Rows are virtualised; single-child folder chains are
 * merged ("trade/relationship") so deep resource paths stay readable in a narrow sidebar.
 */
export class Explorer {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.expanded = new Set(); this.checked = new Set();
    this.bulk = false; this.query = ''; this.rowsCache = [];
    this.build();
  }

  build() {
    const t = this.t;
    this.search = h('input', { type: 'search', class: 'ds-input', placeholder: t('Search paths and text…', '搜索路径或文本…'), attrs: { 'aria-label': t('Search dialogues', '搜索对话') } });
    let timer;
    this.search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { this.query = this.search.value; this.list.scrollTop = 0; this.render(); }, 120); });
    this.search.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); this.list.querySelector('.ds-row-item')?.focus(); } });
    this.summary = h('span', { class: 'ds-panel__meta' });
    this.bulkButton = button(t('Select several', '多选'), { icon: 'checkbox', variant: 'ghost', compact: true, onclick: () => this.setBulk(!this.bulk) });
    this.list = h('div', { class: 'ds-tree', attrs: { role: 'tree', 'aria-label': t('Dialogue files', '对话文件') } });
    this.inner = h('div', { class: 'ds-tree__inner' });
    this.list.append(this.inner);
    this.list.addEventListener('scroll', () => this.draw());
    this.list.addEventListener('keydown', event => this.keys(event));
    this.bulkBar = h('div', { class: 'ds-bulkbar', hidden: true });
    this.emptyEl = h('div', { class: 'ds-empty-panel', hidden: true });
    this.root.append(
      h('div', { class: 'ds-panel__head' },
        h('h2', { class: 'ds-panel__title', text: t('Files', '文件') }), this.summary,
        h('div', { class: 'ds-panel__tools' },
          button(t('New dialogue', '新建对话'), { icon: 'plus', variant: 'ghost', compact: true, onclick: () => this.app.io.newDocument() }),
          this.bulkButton,
          button(t('Collapse all', '全部折叠'), { icon: 'list', variant: 'ghost', compact: true, onclick: () => { this.expanded.clear(); this.render(); } }))),
      h('div', { class: 'ds-panel__search' }, icon('search', 14), this.search),
      this.list, this.emptyEl, this.bulkBar);
    new ResizeObserver(() => this.draw()).observe(this.list);
  }

  setBulk(on) {
    this.bulk = on;
    if (!on) this.checked.clear();
    this.bulkButton.setAttribute('aria-pressed', String(on));
    this.bulkButton.classList.toggle('is-on', on);
    this.render();
  }

  reveal(id) {
    const entry = this.app.store.doc(id);
    if (!entry) return;
    const parts = entry.path.split('/');
    for (let i = 1; i < parts.length; i++) this.expanded.add(parts.slice(0, i).join('/'));
    this.render();
    const index = this.rowsCache.findIndex(row => row.id === id);
    if (index < 0) return;
    const height = this.rowHeight(), top = index * height;
    if (top < this.list.scrollTop || top + height > this.list.scrollTop + this.list.clientHeight) this.list.scrollTop = top - this.list.clientHeight / 2;
    this.draw();
  }

  rowHeight() { return this.query.trim() ? RESULT_ROW : ROW; }

  /* ------------------------------------------------------------- data -- */

  tree() {
    const root = { name: '', prefix: '', folders: new Map(), files: [], count: 0 };
    for (const entry of this.app.store.documents) {
      const parts = entry.path.split('/'), file = parts.pop();
      let node = root;
      node.count++;
      for (const part of parts) {
        const prefix = node.prefix ? `${node.prefix}/${part}` : part;
        if (!node.folders.has(part)) node.folders.set(part, { name: part, prefix, folders: new Map(), files: [], count: 0 });
        node = node.folders.get(part);
        node.count++;
      }
      node.files.push({ name: file.replace(/\.json$/, ''), id: entry.id });
    }
    return root;
  }

  rows() {
    const store = this.app.store, query = this.query.trim().toLowerCase();
    if (query) {
      const words = query.split(/\s+/);
      const matches = store.documents.filter(entry => words.every(word => entry.path.includes(word) || store.keysOf(entry.id).some(key =>
        key.toLowerCase().includes(word) || store.text('en_us', key).toLowerCase().includes(word) || store.text('zh_cn', key).includes(word))));
      return matches.map(entry => {
        const cut = entry.path.lastIndexOf('/');
        return { kind: 'result', id: entry.id, name: entry.path.slice(cut + 1).replace(/\.json$/, ''), folder: entry.path.slice(0, Math.max(0, cut)), depth: 0 };
      });
    }
    const rows = [];
    const walk = (node, depth) => {
      const folders = [...node.folders.values()].sort((a, b) => collator.compare(a.name, b.name));
      for (let folder of folders) {
        let label = folder.name;
        while (folder.folders.size === 1 && !folder.files.length) { folder = [...folder.folders.values()][0]; label += `/${folder.name}`; }
        const open = this.expanded.has(folder.prefix);
        rows.push({ kind: 'folder', name: label, prefix: folder.prefix, count: folder.count, depth, open });
        if (open) walk(folder, depth + 1);
      }
      for (const file of node.files.sort((a, b) => collator.compare(a.name, b.name))) rows.push({ kind: 'doc', id: file.id, name: file.name, depth });
    };
    walk(this.tree(), 0);
    return rows;
  }

  idsIn(prefix) { return this.app.store.documents.filter(entry => entry.path.startsWith(`${prefix}/`)).map(entry => entry.id); }

  /* ------------------------------------------------------------ render -- */

  render() {
    const t = this.t, store = this.app.store, count = store.documents.length;
    this.rowsCache = this.rows();
    this.summary.textContent = this.query.trim() ? t(`${this.rowsCache.length} found`, `找到 ${this.rowsCache.length} 个`) : count.toLocaleString();
    this.emptyEl.hidden = count > 0;
    this.list.hidden = count === 0;
    if (!count) {
      fill(this.emptyEl, icon('files', 28), h('p', { text: t('No dialogues yet.', '还没有对话。') }),
        button(t('New dialogue', '新建对话'), { icon: 'plus', variant: 'primary', onclick: () => this.app.io.newDocument() }),
        button(t('Generate a set', '批量生成'), { icon: 'sparkles', variant: 'soft', onclick: () => this.app.openPanel('generate') }),
        button(t('Import files', '导入文件'), { icon: 'upload', variant: 'soft', onclick: () => this.app.io.pick('files') }));
    }
    this.inner.style.height = `${this.rowsCache.length * this.rowHeight()}px`;
    this.drawn = null;
    this.draw();
    this.renderBulk();
  }

  draw() {
    if (this.list.hidden) return;
    const height = this.rowHeight(), top = this.list.scrollTop, view = this.list.clientHeight || 400;
    const start = Math.max(0, Math.floor(top / height) - OVERSCAN), end = Math.min(this.rowsCache.length, Math.ceil((top + view) / height) + OVERSCAN);
    const key = `${start}:${end}:${this.app.currentId}:${this.checked.size}:${this.rowsCache.length}`;
    if (this.drawn === key) return;
    this.drawn = key;
    const focused = document.activeElement?.closest?.('.ds-row-item')?.dataset.key;
    this.inner.replaceChildren(...this.rowsCache.slice(start, end).map((row, offset) => this.row(row, start + offset, height)));
    if (focused) this.inner.querySelector(`[data-key="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  row(row, index, height) {
    const t = this.t, store = this.app.store, current = row.id === this.app.currentId;
    const key = row.kind === 'folder' ? `f:${row.prefix}` : `d:${row.id}`;
    const el = h('div', {
      class: `ds-row-item ds-row-item--${row.kind}${current ? ' is-current' : ''}`,
      style: { top: `${index * height}px`, height: `${height}px`, '--depth': Math.min(row.depth, 12) },
      tabIndex: -1, dataset: { key, index: String(index) },
      attrs: { role: 'treeitem', 'aria-level': row.depth + 1, 'aria-expanded': row.kind === 'folder' ? String(row.open) : undefined, 'aria-selected': current ? 'true' : undefined },
    });
    if (this.bulk) {
      const ids = row.kind === 'folder' ? this.idsIn(row.prefix) : [row.id];
      const all = ids.length && ids.every(id => this.checked.has(id)), some = ids.some(id => this.checked.has(id));
      const box = h('input', { type: 'checkbox', class: 'ds-row-item__check', checked: all, attrs: { 'aria-label': t('Select', '选择') } });
      box.indeterminate = !all && some;
      box.addEventListener('click', event => { event.stopPropagation(); for (const id of ids) { if (box.checked) this.checked.add(id); else this.checked.delete(id); } this.drawn = null; this.draw(); this.renderBulk(); });
      el.append(box);
    }
    if (row.kind === 'folder') {
      el.append(h('span', { class: 'ds-row-item__chev' }, icon(row.open ? 'chevronDown' : 'chevronRight', 12)), icon('folder', 14),
        h('span', { class: 'ds-row-item__name', text: row.name }), h('span', { class: 'ds-row-item__count', text: String(row.count) }));
    } else {
      const status = store.docStatus(row.id);
      const dot = status.errors ? 'is-error' : status.missing ? 'is-warn' : 'is-ok';
      el.append(h('span', { class: `ds-dot ${dot}`, attrs: { 'aria-label': status.errors ? t('Has errors', '有错误') : status.missing ? t('Text to write', '有待写文本') : t('Ready', '已就绪') } }));
      if (row.kind === 'result') el.append(h('span', { class: 'ds-row-item__stack' }, h('span', { class: 'ds-row-item__name', text: row.name }), h('span', { class: 'ds-row-item__folder', text: row.folder || '/' })));
      else el.append(h('span', { class: 'ds-row-item__name', text: row.name }));
    }
    el.append(h('button', { type: 'button', class: 'ds-row-item__more', tabIndex: -1, attrs: { 'aria-label': t('More actions', '更多操作') }, onclick: event => { event.stopPropagation(); this.menu(row, event.currentTarget); } }, icon('more', 14)));
    el.addEventListener('click', () => this.activate(row));
    el.addEventListener('contextmenu', event => { event.preventDefault(); this.menu(row, { x: event.clientX, y: event.clientY }); });
    return el;
  }

  activate(row) {
    if (row.kind === 'folder') {
      if (this.expanded.has(row.prefix)) this.expanded.delete(row.prefix); else this.expanded.add(row.prefix);
      this.render();
    } else if (this.bulk) {
      if (this.checked.has(row.id)) this.checked.delete(row.id); else this.checked.add(row.id);
      this.drawn = null; this.draw(); this.renderBulk();
    } else this.app.open(row.id);
  }

  keys(event) {
    const item = event.target.closest('.ds-row-item');
    if (!item) return;
    const index = Number(item.dataset.index), row = this.rowsCache[index];
    const go = next => {
      if (next < 0 || next >= this.rowsCache.length) return;
      const height = this.rowHeight();
      if (next * height < this.list.scrollTop) this.list.scrollTop = next * height;
      if ((next + 1) * height > this.list.scrollTop + this.list.clientHeight) this.list.scrollTop = (next + 1) * height - this.list.clientHeight;
      this.draw();
      this.inner.querySelector(`[data-index="${next}"]`)?.focus();
    };
    if (event.key === 'ArrowDown') { event.preventDefault(); go(index + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (index === 0) this.search.focus(); else go(index - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.activate(row); }
    else if (event.key === 'ArrowRight' && row.kind === 'folder' && !row.open) { event.preventDefault(); this.activate(row); }
    else if (event.key === 'ArrowLeft' && row.kind === 'folder' && row.open) { event.preventDefault(); this.activate(row); }
    else if (event.key === 'Delete' && row.kind !== 'folder') { event.preventDefault(); this.app.io.deleteDocuments([row.id]); }
  }

  menu(row, anchor) {
    const t = this.t, io = this.app.io;
    if (row.kind === 'folder') {
      const ids = this.idsIn(row.prefix);
      this.app.ui.menu(anchor, [
        { heading: row.prefix },
        { label: t('New dialogue here…', '在此新建对话…'), icon: 'plus', onSelect: () => io.newDocument(`${row.prefix}/`) },
        { label: t(`Select all ${ids.length} inside`, `选中其中全部 ${ids.length} 个`), icon: 'checkbox', onSelect: () => { this.bulk = true; ids.forEach(id => this.checked.add(id)); this.setBulk(true); } },
        { label: t('Move / rename folder…', '移动 / 重命名文件夹…'), icon: 'edit', onSelect: () => io.moveFolder(row.prefix) },
        { label: t('Export folder as ZIP', '将文件夹导出为 ZIP'), icon: 'download', onSelect: () => io.exportBundle(ids) },
        '-',
        { label: t(`Delete folder (${ids.length})`, `删除文件夹（${ids.length} 个）`), icon: 'trash', danger: true, onSelect: () => io.deleteDocuments(ids) },
      ]);
    } else {
      this.app.ui.menu(anchor, [
        { label: t('Open', '打开'), icon: 'graph', onSelect: () => this.app.open(row.id) },
        { label: t('Move / rename…', '移动 / 重命名…'), icon: 'edit', onSelect: () => io.moveDocuments([row.id]) },
        { label: t('Duplicate…', '复制一份…'), icon: 'copy', onSelect: () => io.duplicateDocument(row.id) },
        { label: t('Export JSON', '导出 JSON'), icon: 'download', onSelect: () => io.exportDocument(row.id) },
        '-',
        { label: t('Delete', '删除'), icon: 'trash', danger: true, onSelect: () => io.deleteDocuments([row.id]) },
      ]);
    }
  }

  renderBulk() {
    const t = this.t, io = this.app.io, ids = [...this.checked].filter(id => this.app.store.doc(id));
    this.checked = new Set(ids);
    this.bulkBar.hidden = !this.bulk;
    if (!this.bulk) return;
    const shown = this.rowsCache.filter(row => row.kind !== 'folder').map(row => row.id);
    fill(this.bulkBar,
      h('div', { class: 'ds-bulkbar__top' },
        h('strong', { text: t(`${ids.length} selected`, `已选 ${ids.length} 个`) }),
        h('button', { type: 'button', class: 'ds-link', onclick: () => { (this.query.trim() ? shown : this.app.store.documents.map(entry => entry.id)).forEach(id => this.checked.add(id)); this.drawn = null; this.draw(); this.renderBulk(); } }, this.query.trim() ? t('Select results', '选中结果') : t('Select all', '全选')),
        h('button', { type: 'button', class: 'ds-link', onclick: () => { this.checked.clear(); this.drawn = null; this.draw(); this.renderBulk(); } }, t('Clear', '清空')),
        button(t('Done', '完成'), { icon: 'close', variant: 'ghost', compact: true, onclick: () => this.setBulk(false) })),
      h('div', { class: 'ds-bulkbar__actions' },
        button(t('Export ZIP', '导出 ZIP'), { icon: 'download', variant: 'soft', disabled: !ids.length, onclick: () => io.exportBundle(ids) }),
        button(t('Move…', '移动…'), { icon: 'edit', variant: 'soft', disabled: !ids.length, onclick: () => io.moveDocuments(ids) }),
        button(t('Delete', '删除'), { icon: 'trash', variant: 'ghost-danger', disabled: !ids.length, onclick: () => io.deleteDocuments(ids) })));
  }
}
