import { languages } from '../../lib/dialogue/export.mjs';
import { button, fill, h, icon, preserveFocus } from './dom.mjs';

const LABEL = { en_us: 'English', zh_cn: '简体中文' };

function onText(el, commit) {
  el.addEventListener('input', event => { if (!event.isComposing) commit(el.value); });
  el.addEventListener('compositionend', () => commit(el.value));
  return el;
}

/**
 * Every translation key in one table, for writing text in bulk. Filters, find & replace and the
 * AI hand-off work on the filtered set, not just the visible page.
 */
export class TextTable {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.page = 0; this.size = 50; this.query = ''; this.status = 'all'; this.scope = 'all';
    this.build();
  }

  build() {
    const t = this.t;
    this.search = h('input', { type: 'search', class: 'ds-input', placeholder: t('Search keys or text…', '搜索键名或文本…'), attrs: { 'aria-label': t('Search text', '搜索文本') } });
    let timer;
    this.search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { this.query = this.search.value; this.page = 0; this.render(); }, 150); });
    const select = (value, options, onChange, label) => {
      const el = h('select', { class: 'ds-input', attrs: { 'aria-label': label } }, options.map(([key, name]) => h('option', { value: key, text: name, selected: key === value })));
      el.addEventListener('change', () => { onChange(el.value); this.page = 0; this.render(); });
      return el;
    };
    this.statusSelect = select(this.status, [['all', t('All texts', '全部文本')], ['missing', t('Unfinished', '未完成')], ['missing_en', t('English missing', '缺英文')], ['missing_zh', t('Chinese missing', '缺中文')], ['done', t('Complete', '已完成')]], value => { this.status = value; }, t('Status', '状态'));
    this.scopeSelect = select(this.scope, [['all', t('Whole workspace', '整个工作区')], ['folder', t('Current folder', '当前文件夹')], ['doc', t('Current dialogue', '当前对话')]], value => { this.scope = value; }, t('Scope', '范围'));
    this.replaceBox = h('div', { class: 'ds-replace', hidden: true });
    this.meta = h('p', { class: 'ds-panel__meta' });
    this.body = h('div', { class: 'ds-texts__body' });
    this.pager = h('div', { class: 'ds-pager' });
    this.root.append(
      h('div', { class: 'ds-texts__toolbar' },
        h('div', { class: 'ds-panel__search ds-grow' }, icon('search', 14), this.search),
        this.statusSelect, this.scopeSelect,
        button(t('Find & replace', '查找替换'), { icon: 'edit', variant: 'ghost', onclick: () => { this.replaceBox.hidden = !this.replaceBox.hidden; if (!this.replaceBox.hidden) this.buildReplace(); } }),
        button(t('Copy for AI', '复制给 AI'), { icon: 'copy', variant: 'ghost', onclick: () => this.copyForAI() }),
        button(t('Paste text', '粘贴文本'), { icon: 'download', variant: 'ghost', onclick: () => this.app.io.pasteTexts() })),
      this.replaceBox, this.meta, this.body, this.pager);
  }

  entries() {
    const store = this.app.store, entry = this.app.entry, words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const folder = entry ? entry.path.slice(0, entry.path.lastIndexOf('/') + 1) : null;
    return store.catalog().list.filter(item => {
      if (this.scope === 'doc' && !item.sources.some(source => source.path === entry?.path)) return false;
      if (this.scope === 'folder' && !item.sources.some(source => folder !== null && source.path.startsWith(folder))) return false;
      const missing = item.missing;
      if (this.status === 'missing' && !missing.length) return false;
      if (this.status === 'missing_en' && !missing.includes('en_us')) return false;
      if (this.status === 'missing_zh' && !missing.includes('zh_cn')) return false;
      if (this.status === 'done' && missing.length) return false;
      return words.every(word => item.key.toLowerCase().includes(word) || languages.some(lang => store.text(lang, item.key).toLowerCase().includes(word)));
    });
  }

  render() { preserveFocus(this.root, () => this.draw()); }

  draw() {
    const t = this.t, store = this.app.store, list = this.entries(), pages = Math.max(1, Math.ceil(list.length / this.size));
    this.page = Math.min(this.page, pages - 1);
    this.filtered = list;
    const unfinished = store.catalog().list.filter(item => item.missing.length).length;
    this.meta.textContent = t(`${list.length} keys shown · ${unfinished} unfinished in the workspace. Empty text is fine; it exports as "".`, `显示 ${list.length} 个键 · 工作区共 ${unfinished} 个未完成。留空没关系，导出为 ""。`);
    this.body.replaceChildren();
    if (!list.length) this.body.append(h('div', { class: 'ds-empty-panel' }, icon('languages', 28), h('p', { text: store.documents.length ? t('No text matches these filters.', '没有符合筛选的文本。') : t('Texts appear here once you add dialogues.', '添加对话后，文本会出现在这里。') })));
    for (const item of list.slice(this.page * this.size, (this.page + 1) * this.size)) {
      const source = item.sources[0];
      const row = h('div', { class: 'ds-text-row' },
        h('div', { class: 'ds-text-row__key' },
          h('code', { class: 'ds-wrap', text: item.key }),
          h('button', { type: 'button', class: 'ds-link ds-wrap', onclick: () => this.jump(source) }, `${source.path.replace(/\.json$/, '')}${item.sources.length > 1 ? t(` +${item.sources.length - 1} more`, ` 等 ${item.sources.length} 处`) : ''}`)),
        languages.map(lang => h('label', { class: 'ds-text-row__cell' },
          h('span', { class: 'ds-text__tag', text: lang === 'zh_cn' ? '中' : 'EN' }),
          onText(h('textarea', { class: `ds-input ds-textarea${store.text(lang, item.key).trim() ? '' : ' is-empty'}`, rows: 2, value: store.text(lang, item.key), placeholder: t('Not written yet', '尚未填写'), dataset: { field: `${lang}:${item.key}` }, attrs: { lang: lang === 'zh_cn' ? 'zh-CN' : 'en', 'aria-label': `${LABEL[lang]} · ${item.key}` } }),
            value => this.app.setText(lang, item.key, value, 'table')))));
      this.body.append(row);
    }
    fill(this.pager,
      button(t('Previous page', '上一页'), { icon: 'chevronLeft', variant: 'ghost', compact: true, disabled: this.page === 0, onclick: () => { this.page--; this.render(); this.body.scrollTop = 0; } }),
      h('span', { text: t(`Page ${this.page + 1} of ${pages}`, `第 ${this.page + 1} / ${pages} 页`) }),
      button(t('Next page', '下一页'), { icon: 'chevronRight', variant: 'ghost', compact: true, disabled: this.page >= pages - 1, onclick: () => { this.page++; this.render(); this.body.scrollTop = 0; } }),
      (() => {
        const size = h('select', { class: 'ds-input ds-input--small', attrs: { 'aria-label': t('Rows per page', '每页行数') } }, [25, 50, 100, 200].map(value => h('option', { value, text: t(`${value} per page`, `每页 ${value}`), selected: value === this.size })));
        size.addEventListener('change', () => { this.size = Number(size.value); this.page = 0; this.render(); });
        return size;
      })());
    this.body.querySelectorAll('textarea').forEach(area => area.addEventListener('blur', () => area.classList.toggle('is-empty', !area.value.trim())));
  }

  jump(source) {
    const entry = this.app.store.docByPath(source.path);
    if (!entry) return;
    const state = source.pointer.split('/')[2]?.replaceAll('~1', '/').replaceAll('~0', '~');
    const choice = source.pointer.match(/\/choices\/(\d+)\//)?.[1];
    this.app.open(entry.id, { view: 'graph' });
    if (state && Object.hasOwn(entry.dialogue.states, state)) {
      if (choice !== undefined) this.app.focusReply = Number(choice);
      this.app.select([state]);
      requestAnimationFrame(() => this.app.canvas.reveal(state));
    }
  }

  buildReplace() {
    const t = this.t;
    const find = h('input', { class: 'ds-input', placeholder: t('Find', '查找'), attrs: { 'aria-label': t('Find', '查找') } });
    const replace = h('input', { class: 'ds-input', placeholder: t('Replace with', '替换为'), attrs: { 'aria-label': t('Replace with', '替换为') } });
    const lang = h('select', { class: 'ds-input', attrs: { 'aria-label': t('Language', '语言') } }, [['both', t('Both languages', '两种语言')], ['en_us', 'English'], ['zh_cn', '简体中文']].map(([value, label]) => h('option', { value, text: label })));
    const matchCase = h('input', { type: 'checkbox' });
    const apply = () => this.app.run(() => {
      if (!find.value) throw Error(t('Enter the text to find.', '请输入要查找的文本。'));
      const langs = lang.value === 'both' ? languages : [lang.value], store = this.app.store;
      const pattern = new RegExp(find.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase.checked ? 'g' : 'gi');
      let count = 0;
      store.mutate(t('Find and replace', '查找替换'), tx => {
        for (const item of this.filtered ?? []) for (const code of langs) {
          const value = store.text(code, item.key), next = value.replace(pattern, replace.value);
          if (next !== value) { tx.text(code, item.key, next); count++; }
        }
      });
      this.app.ui.toast(t(`Replaced in ${count} texts.`, `已替换 ${count} 条文本。`), { kind: count ? 'success' : 'info', action: count ? { label: t('Undo', '撤销'), onClick: () => this.app.undo() } : undefined });
      this.render();
    });
    fill(this.replaceBox, find, replace, lang, h('label', { class: 'ds-check' }, matchCase, h('span', { text: t('Match case', '区分大小写') })),
      button(t('Replace in shown keys', '在当前筛选中替换'), { icon: 'check', variant: 'primary', onclick: apply }));
    find.focus();
  }

  async copyForAI() {
    const t = this.t, store = this.app.store, list = (this.filtered ?? this.entries()).filter(item => item.missing.length);
    if (!list.length) { this.app.ui.toast(t('Nothing unfinished in this view.', '当前视图没有未完成的文本。')); return; }
    const brief = {
      format: 'isekai-dialogue-text-brief', version: 1,
      instructions: 'Fill the empty en_us and zh_cn values and return this JSON unchanged otherwise. Keep every key. en_us is British English; zh_cn is Simplified Chinese written natively, not translated word for word. Use the other language and used_in as context.',
      entries: list.map(item => ({ key: item.key, en_us: store.text('en_us', item.key), zh_cn: store.text('zh_cn', item.key), used_in: item.sources.map(source => `${source.path}#${source.pointer}`) })),
    };
    await navigator.clipboard.writeText(JSON.stringify(brief, null, 2));
    this.app.ui.toast(t(`Copied ${list.length} unfinished texts with context. When they come back filled in, use Paste text.`, `已复制 ${list.length} 条未完成文本及上下文。填好后用「粘贴文本」导回。`), { kind: 'success' });
  }
}
