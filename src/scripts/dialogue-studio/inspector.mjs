import { ACTIONS, REQUIREMENTS, blank, findAction, findRequirement } from '../../lib/dialogue/catalog.mjs';
import { describeText, editText } from '../../lib/dialogue/editing.mjs';
import { choicesOf, keyPrefix } from '../../lib/dialogue/graph.mjs';
import { STATE_TYPES, renameState, setOwn, stateType } from '../../lib/dialogue/model.mjs';
import { button, h, icon, preserveFocus } from './dom.mjs';
import { describeIssue, flatten } from './text.mjs';

const LANGS = [['en_us', 'English'], ['zh_cn', '简体中文']];
const pretty = value => JSON.stringify(value, null, 2);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Commits text on input, but waits for an IME composition (Chinese, Japanese…) to finish first. */
function onText(el, commit) {
  el.addEventListener('input', event => { if (!event.isComposing) commit(el.value); });
  el.addEventListener('compositionend', () => commit(el.value));
  return el;
}

export class Inspector {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.forced = new Map();
    root.addEventListener('focusout', () => app.store.breakCoalesce());
  }

  render() { preserveFocus(this.root, () => this.build()); }

  focusFirst() {
    this.app.showInspector('inspect');
    requestAnimationFrame(() => this.root.querySelector('textarea, input:not([type=checkbox])')?.focus());
  }

  build() {
    const t = this.t, entry = this.app.entry;
    this.root.replaceChildren();
    if (!entry) { this.root.append(h('div', { class: 'ds-empty-panel' }, icon('graph', 28), h('p', { text: t('Open or create a dialogue to edit it here.', '打开或新建对话后，在这里编辑。') }))); return; }
    const names = [...this.app.selection].filter(name => Object.hasOwn(entry.dialogue.states, name));
    if (names.length === 1) this.nodeForm(entry, names[0]);
    else if (names.length > 1) this.multiForm(names);
    else this.documentForm(entry);
  }

  /* --------------------------------------------------------------- pieces -- */

  edit(label, fn, options = {}) {
    const entry = this.app.entry;
    return this.app.run(() => this.app.store.mutate(label, tx => fn(tx.edit(entry.id), tx), { ...options, source: options.coalesce ? 'inspector' : null }));
  }

  section(title, { iconName, count, open = true, actions, id } = {}) {
    const body = h('div', { class: 'ds-section__body' });
    const details = h('details', { class: 'ds-section', open, dataset: id ? { section: id } : {} },
      h('summary', { class: 'ds-section__summary' },
        iconName ? icon(iconName, 14) : null,
        h('span', { class: 'ds-section__title', text: title }),
        count !== undefined ? h('span', { class: 'ds-count', text: String(count) }) : null,
        h('span', { class: 'ds-section__chevron' }, icon('chevronDown', 14))),
      actions ? h('div', { class: 'ds-section__actions' }, actions) : null,
      body);
    this.root.append(details);
    return body;
  }

  field(label, control, hint) {
    return h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: label }), control, hint ? h('small', { class: 'ds-field__hint', text: hint }) : null);
  }

  /**
   * Text editor for one component. Translation keys show both languages side by side so the
   * writer never has to leave the node; literal and rich text stay available.
   */
  textEditor({ id, label, component, suggest, setComponent, optional = false }) {
    const t = this.t, store = this.app.store, wrap = h('div', { class: 'ds-text' });
    if (component === undefined) {
      wrap.append(h('div', { class: 'ds-text__head' }, h('span', { class: 'ds-field__label', text: label })),
        button(optional ? t('Add text', '添加文本') : t('Add a translation key', '添加翻译键'), { icon: 'plus', variant: 'soft', onclick: () => setComponent({ translate: suggest }) }));
      return wrap;
    }
    const natural = describeText(component), described = { ...natural, mode: this.forced.get(id) ?? natural.mode };
    const modes = [['key', t('Key', '翻译键')], ['literal', t('Literal', '直接文本')], ['advanced', 'JSON']];
    const switcher = h('div', { class: 'ds-seg ds-seg--small', attrs: { role: 'radiogroup', 'aria-label': `${label} · ${t('format', '格式')}` } }, modes.map(([mode, name]) => h('button', {
      type: 'button', class: 'ds-seg__item', attrs: { role: 'radio', 'aria-checked': String(described.mode === mode) },
      onclick: () => this.app.run(() => {
        if (mode === described.mode) return;
        if (mode === 'advanced') { this.forced.set(id, 'advanced'); this.render(); return; }
        this.forced.delete(id);
        if (mode === natural.mode) { this.render(); return; }
        const lang = this.app.previewLang, shown = flatten(component, key => store.text(lang, key)).text;
        setComponent(editText(Array.isArray(component) ? {} : component, mode, mode === 'key' ? suggest : shown), null, tx => {
          if (mode === 'key' && shown && !store.text(lang, suggest)) tx.text(lang, suggest, shown);
        });
      }),
    }, name)));
    wrap.append(h('div', { class: 'ds-text__head' }, h('span', { class: 'ds-field__label', text: label }), switcher,
      optional ? h('button', { type: 'button', class: 'ds-btn ds-btn--icon ds-btn--ghost', attrs: { 'aria-label': t('Remove text', '移除文本'), title: t('Remove text', '移除文本') }, onclick: () => setComponent(undefined) }, icon('close', 14)) : null));

    if (described.mode === 'key') {
      const key = described.value;
      const keyInput = h('input', { class: 'ds-input ds-mono', value: key, spellcheck: false, dataset: { field: `${id}:key` }, attrs: { 'aria-label': t('Translation key', '翻译键') } });
      keyInput.addEventListener('change', () => this.app.run(() => this.renameKey(component, key, keyInput.value.trim(), setComponent)));
      const auto = key !== suggest ? h('button', { type: 'button', class: 'ds-btn ds-btn--icon ds-btn--ghost', attrs: { 'aria-label': t('Use the suggested key', '使用建议的键名'), title: suggest }, onclick: () => this.app.run(() => this.renameKey(component, key, suggest, setComponent)) }, icon('refresh', 14)) : null;
      wrap.append(h('div', { class: 'ds-text__key' }, keyInput, auto));
      for (const [lang, name] of LANGS) {
        const area = onText(h('textarea', { class: 'ds-input ds-textarea', rows: 2, value: store.text(lang, key), placeholder: t('Not written yet · exported as ""', '尚未填写 · 导出为 ""'), dataset: { field: `${id}:${lang}` }, attrs: { lang: lang === 'zh_cn' ? 'zh-CN' : 'en', 'aria-label': `${label} · ${name}` } }),
          value => this.app.setText(lang, key, value));
        wrap.append(h('label', { class: 'ds-text__lang' }, h('span', { class: 'ds-text__tag', text: lang === 'zh_cn' ? '中' : 'EN' }), area));
      }
      const uses = store.usage(key);
      if (uses > 1) wrap.append(h('small', { class: 'ds-field__hint' }, icon('link', 12), t(`Shared by ${uses} places. Editing the text changes all of them.`, `有 ${uses} 处共用此键，改文本会一起改。`)));
    } else if (described.mode === 'literal') {
      wrap.append(onText(h('textarea', { class: 'ds-input ds-textarea', rows: 2, value: described.value, dataset: { field: `${id}:literal` }, attrs: { 'aria-label': label } }),
        value => setComponent(editText(component, 'literal', value), `${id}:literal`)));
      wrap.append(h('small', { class: 'ds-field__hint', text: t('Literal text shows as written in both languages.', '直接文本在两种语言下显示相同内容。') }));
    } else {
      const area = h('textarea', { class: 'ds-input ds-textarea ds-mono', rows: 4, value: pretty(component), spellcheck: false, dataset: { field: `${id}:json` }, attrs: { 'aria-label': `${label} JSON` } });
      wrap.append(area, h('div', { class: 'ds-row' }, button(t('Apply JSON', '应用 JSON'), { icon: 'check', variant: 'soft', onclick: () => this.app.run(() => {
        const value = JSON.parse(area.value);
        if (!(typeof value === 'string' || Array.isArray(value) || object(value))) throw Error(t('Text must be a string, object or array.', '文本必须是字符串、对象或数组。'));
        this.forced.delete(id);
        setComponent(value);
      }) })));
    }
    return wrap;
  }

  /** Switching keys carries the written text along when this was the key's only use. */
  renameKey(component, from, to, setComponent) {
    const t = this.t, store = this.app.store;
    if (!to) throw Error(t('A translation key cannot be empty.', '翻译键不能为空。'));
    if (to === from) return;
    const carry = store.usage(from) <= 1 && LANGS.every(([lang]) => !store.text(lang, to));
    setComponent(editText(component, 'key', to), null, tx => {
      if (!carry) return;
      for (const [lang] of LANGS) {
        const value = store.text(lang, from);
        if (value) { tx.text(lang, to, value); tx.text(lang, from, undefined); }
      }
    });
  }

  numberInput(value, commit, attrs = {}) {
    const input = h('input', { type: 'number', class: 'ds-input', value: value ?? '', attrs: { step: 1, ...attrs } });
    input.addEventListener('change', () => { const number = Number(input.value); if (Number.isInteger(number)) commit(number); else input.value = value ?? ''; });
    return input;
  }

  /** Form for one action or requirement object, driven by its catalogue spec. */
  specFields(spec, value, commit, id) {
    const t = this.t, grid = h('div', { class: 'ds-grid2' });
    for (const field of spec.fields) {
      const current = Object.hasOwn(value, field.name) ? value[field.name] : undefined;
      const set = next => commit(field.name, next);
      let control;
      if (field.kind === 'bool') {
        control = h('input', { type: 'checkbox', checked: current ?? field.default ?? false, dataset: { field: `${id}:${field.name}` }, onchange: event => set(event.target.checked) });
        grid.append(h('label', { class: 'ds-check' }, control, h('span', { class: 'ds-mono', text: field.name })));
        continue;
      }
      if (field.kind === 'int') control = this.numberInput(current ?? field.default, set, { placeholder: field.default ?? '' });
      else if (field.kind === 'enum') control = h('select', { class: 'ds-input', onchange: event => set(event.target.value) }, field.options.map(option => h('option', { value: option, text: option, selected: (current ?? field.default) === option })));
      else {
        control = h('input', { class: `ds-input${field.kind === 'id' ? ' ds-mono' : ''}`, value: current ?? '', spellcheck: false, placeholder: field.kind === 'id' ? 'namespace:path' : field.default ?? '' });
        control.addEventListener('change', () => set(control.value));
      }
      control.dataset.field = `${id}:${field.name}`;
      grid.append(this.field(field.name + (field.required ? ' *' : ''), control, field.default !== undefined && !field.required ? t(`Default: ${field.default}`, `默认：${field.default}`) : null));
    }
    return grid;
  }

  jsonBlock(value, apply, id, rows = 6) {
    const t = this.t, area = h('textarea', { class: 'ds-input ds-textarea ds-mono', rows, value: pretty(value), spellcheck: false, dataset: { field: id } });
    return h('div', { class: 'ds-stack' }, area, h('div', { class: 'ds-row' },
      button(t('Apply JSON', '应用 JSON'), { icon: 'check', variant: 'soft', onclick: () => this.app.run(() => apply(JSON.parse(area.value))) }),
      button(t('Revert', '还原'), { icon: 'undo', variant: 'ghost', onclick: () => { area.value = pretty(value); } })));
  }

  /* ------------------------------------------------------------ node form -- */

  nodeForm(entry, name) {
    const t = this.t, doc = entry.dialogue, state = object(doc.states[name]) ? doc.states[name] : {}, type = stateType(state);
    const prefix = keyPrefix(entry.path), canvas = this.app.canvas;
    const setState = (label, fn, options) => this.edit(label, (e, tx) => fn(e.dialogue.states[name], tx, e), options);

    // Header: identity, type and the node-level actions.
    const idInput = h('input', { class: 'ds-input ds-mono', value: name, spellcheck: false, dataset: { field: 'state-id' }, attrs: { 'aria-label': t('Node ID', '节点 ID') } });
    idInput.addEventListener('change', () => this.app.run(() => {
      const next = idInput.value.trim();
      if (next === name) return;
      this.app.store.mutate(t('Rename node', '重命名节点'), tx => {
        const e = tx.edit(entry.id);
        renameState(e.dialogue, name, next);
        const layout = { ...canvas.positions(), ...e.layout };
        if (layout[name]) { setOwn(layout, next, layout[name]); delete layout[name]; }
        e.layout = layout;
      });
      this.app.select([next]);
    }));
    const head = h('div', { class: 'ds-inspector-head' },
      h('div', { class: 'ds-inspector-head__row' },
        h('span', { class: `ds-type-dot ds-type-dot--${type}` }, icon({ default: 'message', end_dialogue: 'stop', ask_confirmation: 'question' }[type] ?? 'message', 14)),
        idInput),
      h('div', { class: 'ds-seg', attrs: { role: 'radiogroup', 'aria-label': t('Node type', '节点类型') } }, STATE_TYPES.map(value => h('button', {
        type: 'button', class: 'ds-seg__item', attrs: { role: 'radio', 'aria-checked': String(type === value) },
        onclick: () => type !== value && setState(t('Change node type', '更改节点类型'), current => {
          if (value === 'default') delete current.type; else current.type = value;
          if (value !== 'end_dialogue' && !choicesOf(current).length) current.choices = [{ text: { translate: `${prefix}.${name}.reply_1` }, next: '' }];
        }),
      }, { default: t('Dialogue', '对话'), end_dialogue: t('End', '结束'), ask_confirmation: t('Confirm', '确认') }[value]))),
      h('div', { class: 'ds-row ds-row--wrap' },
        doc.start_at === name
          ? h('span', { class: 'ds-badge ds-badge--start ds-badge--lg' }, icon('flag', 12), t('Start node', '起始节点'))
          : button(t('Set as start', '设为起点'), { icon: 'flag', variant: 'soft', onclick: () => this.app.run(() => canvas.setStart(name)) }),
        button(t('Duplicate', '复制一份'), { icon: 'copy', variant: 'ghost', onclick: () => this.app.run(() => canvas.duplicate()) }),
        button(t('Delete', '删除'), { icon: 'trash', variant: 'ghost-danger', onclick: () => this.app.run(() => canvas.deleteSelected()) })));
    this.root.append(head);

    const issues = this.app.store.check(entry.id).issues.filter(issue => issue.state === name);
    if (issues.length) this.root.append(h('ul', { class: 'ds-issues-inline' }, issues.map(issue => h('li', { class: `is-${issue.level}` }, icon('alert', 12), h('span', { text: describeIssue(issue, t) })))));

    // Line
    if (type !== 'end_dialogue' || state.text !== undefined) {
      const body = this.section(type === 'end_dialogue' ? t('Text', '文本') : t('NPC line', 'NPC 台词'), { iconName: 'message', id: 'line' });
      body.append(this.textEditor({
        id: `${name}.text`, label: t('Line', '台词'), component: state.text, suggest: `${prefix}.${name}`, optional: type === 'end_dialogue',
        setComponent: (value, coalesce, extra) => setState(t('Edit line', '编辑台词'), (current, tx) => {
          if (value === undefined) delete current.text; else current.text = value;
          extra?.(tx);
        }, { coalesce: coalesce ?? null }),
      }));
    }

    // Replies
    if (type !== 'end_dialogue' || choicesOf(state).length) {
      const choices = choicesOf(state);
      const body = this.section(t('Player replies', '玩家选项'), { iconName: 'list', count: choices.length, id: 'replies' });
      choices.forEach((choice, index) => body.append(this.replyCard(entry, name, choice, index, choices.length, setState)));
      if (!choices.length) body.append(h('p', { class: 'ds-muted', text: t('No replies yet. A dialogue node needs at least one.', '还没有选项。对话节点至少需要一个选项。') }));
      body.append(button(t('Add reply', '添加选项'), { icon: 'plus', variant: 'soft', onclick: () => this.app.run(() => canvas.addReply(name)) }));
    }

    // Actions
    const actions = Array.isArray(state.actions) ? state.actions : [];
    const actionBody = this.section(t('Actions', '行为'), { iconName: 'zap', count: actions.length, open: actions.length > 0, id: 'actions' });
    if (doc.start_at === name && actions.length) actionBody.append(h('p', { class: 'ds-note is-warning', text: t('Actions on the start node do not run when the dialogue opens. Move them to a node reached through a reply.', '起始节点的行为在打开对话时不会执行，请移到由选项进入的节点上。') }));
    actions.forEach((action, index) => actionBody.append(this.actionCard(name, action, index, actions.length, setState)));
    const picker = h('select', { class: 'ds-input', attrs: { 'aria-label': t('Action type', '行为类型') } },
      h('option', { value: '', text: t('Add an action…', '添加行为…') }),
      ACTIONS.map(spec => h('option', { value: spec.type, text: spec.type })),
      h('option', { value: '__custom', text: t('Custom action (JSON)', '自定义行为（JSON）') }));
    picker.addEventListener('change', () => {
      const value = picker.value;
      if (!value) return;
      setState(t('Add action', '添加行为'), current => {
        if (!Array.isArray(current.actions)) current.actions = [];
        current.actions.push(value === '__custom' ? { type: 'namespace:action' } : blank(findAction(value)));
      });
    });
    actionBody.append(picker);

    // Raw JSON
    const raw = this.section(t('Node JSON', '节点 JSON'), { iconName: 'terminal', open: false, id: 'json' });
    raw.append(h('p', { class: 'ds-muted', text: t('Everything the form does not cover lives here. Custom fields are kept when you edit with the form.', '表单没覆盖到的字段都在这里。用表单编辑时，自定义字段会保留。') }),
      this.jsonBlock(state, value => {
        if (!object(value)) throw Error(t('A node must be a JSON object.', '节点必须是 JSON 对象。'));
        this.app.store.mutate(t('Edit node JSON', '编辑节点 JSON'), tx => { setOwn(tx.edit(entry.id).dialogue.states, name, value); });
      }, `${name}:json`, 10));

    if (this.app.focusReply !== null && this.app.focusReply !== undefined) {
      const card = this.root.querySelector(`[data-reply-card="${this.app.focusReply}"]`);
      this.app.focusReply = null;
      if (card) { card.open = true; requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest' })); }
    }
  }

  replyCard(entry, name, choice, index, total, setState) {
    const t = this.t, doc = entry.dialogue, prefix = keyPrefix(entry.path), canvas = this.app.canvas;
    if (!object(choice)) return h('p', { class: 'ds-note is-error', text: t(`Reply ${index + 1} is not an object. Fix it in Node JSON.`, `选项 ${index + 1} 不是对象，请在节点 JSON 中修正。`) });
    const setChoice = (label, fn, options) => setState(label, (state, tx) => fn(state.choices[index], tx), options);
    const lang = this.app.previewLang, preview = flatten(choice.text, key => this.app.store.text(lang, key), key => this.app.store.text(lang === 'en_us' ? 'zh_cn' : 'en_us', key));
    const linked = typeof choice.next === 'string' && Object.hasOwn(doc.states, choice.next);
    const card = h('details', { class: 'ds-reply-card', dataset: { replyCard: String(index) }, open: total <= 2 },
      h('summary', { class: 'ds-reply-card__summary' },
        h('span', { class: 'ds-reply-card__index', text: String(index + 1) }),
        h('span', { class: `ds-reply-card__text${preview.text ? '' : ' is-missing'}`, text: preview.text || preview.key || t('Empty reply', '空选项') }),
        h('span', { class: `ds-reply-card__target${linked ? '' : ' is-broken'}` }, icon(linked ? 'chevronRight' : 'unlink', 12), linked ? choice.next : t('Not linked', '未连接'))));

    card.append(this.textEditor({
      id: `${name}.c${index}.text`, label: t('Reply text', '选项文本'), component: choice.text, suggest: `${prefix}.${name}.reply_${index + 1}`,
      setComponent: (value, coalesce, extra) => setChoice(t('Edit reply', '编辑选项'), (current, tx) => { current.text = value ?? { translate: `${prefix}.${name}.reply_${index + 1}` }; extra?.(tx); }, { coalesce: coalesce ?? null }),
    }));

    const target = h('select', { class: 'ds-input', dataset: { field: `${name}.c${index}.next` } },
      h('option', { value: '', text: t('— Not linked —', '— 未连接 —'), selected: !linked }),
      h('optgroup', { attrs: { label: t('Nodes', '节点') } }, Object.keys(doc.states).map(state => h('option', { value: state, text: state === name ? `${state} (${t('this node', '本节点')})` : state, selected: choice.next === state }))),
      h('optgroup', { attrs: { label: t('Create', '新建') } },
        h('option', { value: '__new:dialogue', text: t('+ New dialogue node', '+ 新建对话节点') }),
        h('option', { value: '__new:end', text: t('+ New end node', '+ 新建结束节点') })));
    target.addEventListener('change', () => this.app.run(() => {
      const value = target.value;
      if (value.startsWith('__new:')) {
        const origin = canvas.pos.get(name) ?? canvas.center(), g = canvas.geom.get(name);
        canvas.addNode(value.slice(6), [origin[0] + (g?.w ?? 260) + 100, origin[1] + index * 90], { name, index });
      } else setChoice(t('Link reply', '连接选项'), current => { current.next = value; });
    }));
    const jump = linked ? button(t('Go to node', '前往节点'), { icon: 'chevronRight', variant: 'ghost', compact: true, onclick: () => { this.app.select([choice.next]); canvas.reveal(choice.next); } }) : null;
    card.append(this.field(t('Goes to', '跳转到'), h('div', { class: 'ds-row' }, target, jump)));

    // Condition
    const requirement = choice.requirement, spec = requirement ? findRequirement(requirement.type) : null;
    const condition = h('select', { class: 'ds-input', dataset: { field: `${name}.c${index}.req` } },
      h('option', { value: '', text: t('Always available', '始终可选'), selected: !requirement }),
      REQUIREMENTS.map(item => h('option', { value: item.type, text: item.type, selected: requirement?.type === item.type })),
      h('option', { value: '__custom', text: t('Custom condition (JSON)', '自定义条件（JSON）'), selected: !!requirement && !spec }));
    condition.addEventListener('change', () => setChoice(t('Change condition', '更改条件'), current => {
      if (!condition.value) { delete current.requirement; delete current.requirement_tip; }
      else current.requirement = condition.value === '__custom' ? { type: 'namespace:condition' } : blank(findRequirement(condition.value));
    }));
    card.append(this.field(t('Condition', '条件'), condition));
    if (requirement && spec) card.append(this.specFields(spec, requirement, (field, value) => setChoice(t('Edit condition', '编辑条件'), current => { current.requirement[field] = value; }), `${name}.c${index}.req`));
    else if (requirement) card.append(this.jsonBlock(requirement, value => {
      if (!object(value)) throw Error(t('A condition must be a JSON object.', '条件必须是 JSON 对象。'));
      setChoice(t('Edit condition', '编辑条件'), current => { current.requirement = value; });
    }, `${name}.c${index}.reqjson`, 4));
    if (requirement) card.append(this.textEditor({
      id: `${name}.c${index}.tip`, label: t('Shown when unavailable', '不可选时的提示'), component: choice.requirement_tip, optional: true,
      suggest: `${prefix}.${name}.reply_${index + 1}.tip`,
      setComponent: (value, coalesce, extra) => setChoice(t('Edit condition tip', '编辑条件提示'), (current, tx) => {
        if (value === undefined) delete current.requirement_tip; else current.requirement_tip = value;
        extra?.(tx);
      }, { coalesce: coalesce ?? null }),
    }));

    card.append(h('div', { class: 'ds-row ds-row--end' },
      button(t('Move up', '上移'), { icon: 'arrowUp', variant: 'ghost', compact: true, disabled: index === 0, onclick: () => this.moveReply(setState, index, -1) }),
      button(t('Move down', '下移'), { icon: 'arrowDown', variant: 'ghost', compact: true, disabled: index === total - 1, onclick: () => this.moveReply(setState, index, 1) }),
      button(t('Remove reply', '移除选项'), { icon: 'trash', variant: 'ghost-danger', onclick: () => setState(t('Remove reply', '移除选项'), state => { state.choices.splice(index, 1); }) })));
    return card;
  }

  moveReply(setState, index, delta) {
    this.app.focusReply = index + delta;
    setState(this.t('Reorder replies', '调整选项顺序'), state => {
      const [item] = state.choices.splice(index, 1);
      state.choices.splice(index + delta, 0, item);
    });
  }

  actionCard(name, action, index, total, setState) {
    const t = this.t, spec = object(action) ? findAction(action.type) : null;
    const setAction = (label, fn) => setState(label, state => fn(state.actions, state));
    const card = h('div', { class: 'ds-action-card' },
      h('div', { class: 'ds-action-card__head' },
        icon('zap', 14),
        h('code', { class: 'ds-action-card__type', text: object(action) ? String(action.type ?? '?') : '?' }),
        button(t('Move up', '上移'), { icon: 'arrowUp', variant: 'ghost', compact: true, disabled: index === 0, onclick: () => setAction(t('Reorder actions', '调整行为顺序'), list => { list.splice(index - 1, 0, ...list.splice(index, 1)); }) }),
        button(t('Move down', '下移'), { icon: 'arrowDown', variant: 'ghost', compact: true, disabled: index === total - 1, onclick: () => setAction(t('Reorder actions', '调整行为顺序'), list => { list.splice(index + 1, 0, ...list.splice(index, 1)); }) }),
        button(t('Remove action', '移除行为'), { icon: 'trash', variant: 'ghost-danger', compact: true, onclick: () => setAction(t('Remove action', '移除行为'), list => { list.splice(index, 1); }) })));
    if (spec && spec.fields.length) card.append(this.specFields(spec, action, (field, value) => setAction(t('Edit action', '编辑行为'), list => { list[index][field] = value; }), `${name}.a${index}`));
    else if (spec) card.append(h('p', { class: 'ds-muted', text: t('No settings.', '无需设置。') }));
    else card.append(this.jsonBlock(action, value => {
      if (!object(value) || typeof value.type !== 'string') throw Error(t('An action needs a "type".', '行为需要 "type" 字段。'));
      setAction(t('Edit action', '编辑行为'), list => { list[index] = value; });
    }, `${name}.a${index}:json`, 4));
    return card;
  }

  /* -------------------------------------------------------- other modes -- */

  multiForm(names) {
    const t = this.t, canvas = this.app.canvas;
    this.root.append(h('div', { class: 'ds-inspector-head' },
      h('p', { class: 'ds-inspector-head__title', text: t(`${names.length} nodes selected`, `已选择 ${names.length} 个节点`) }),
      h('p', { class: 'ds-muted ds-wrap', text: names.join(', ') }),
      h('div', { class: 'ds-row ds-row--wrap' },
        button(t('Duplicate', '复制一份'), { icon: 'copy', variant: 'soft', onclick: () => this.app.run(() => canvas.duplicate()) }),
        button(t('Copy', '复制'), { icon: 'copy', variant: 'ghost', onclick: () => this.app.run(() => canvas.copy()) }),
        button(t('Delete', '删除'), { icon: 'trash', variant: 'ghost-danger', onclick: () => this.app.run(() => canvas.deleteSelected()) }))),
    h('p', { class: 'ds-muted', text: t('Drag any selected node to move them together. Shift-click adds or removes a node.', '拖动任意一个选中节点即可整体移动。按住 Shift 点击可增减选择。') }));
  }

  documentForm(entry) {
    const t = this.t, doc = entry.dialogue, store = this.app.store, status = store.docStatus(entry.id);
    const states = Object.keys(doc.states ?? {}), replies = Object.values(doc.states ?? {}).reduce((sum, state) => sum + choicesOf(state).length, 0);
    this.root.append(h('div', { class: 'ds-inspector-head' },
      h('p', { class: 'ds-inspector-head__eyebrow', text: t('Dialogue file', '对话文件') }),
      h('p', { class: 'ds-inspector-head__path ds-mono', text: entry.path }),
      h('div', { class: 'ds-stats' },
        h('span', {}, h('strong', { text: String(states.length) }), t('nodes', '个节点')),
        h('span', {}, h('strong', { text: String(replies) }), t('replies', '个选项')),
        h('span', { class: status.missing ? 'is-warn' : '' }, h('strong', { text: String(status.missing) }), t('texts to write', '条待写文本')),
        h('span', { class: status.errors ? 'is-error' : '' }, h('strong', { text: String(status.errors) }), t('errors', '个错误'))),
      h('div', { class: 'ds-row ds-row--wrap' },
        button(t('Move / rename', '移动 / 重命名'), { icon: 'edit', variant: 'soft', onclick: () => this.app.io.moveDocuments([entry.id]) }),
        button(t('Duplicate', '复制一份'), { icon: 'copy', variant: 'ghost', onclick: () => this.app.io.duplicateDocument(entry.id) }),
        button(t('Export JSON', '导出 JSON'), { icon: 'download', variant: 'ghost', onclick: () => this.app.io.exportCurrent() }),
        button(t('Delete', '删除'), { icon: 'trash', variant: 'ghost-danger', onclick: () => this.app.io.deleteDocuments([entry.id]) }))));

    const settings = this.section(t('Settings', '设置'), { iconName: 'edit', id: 'doc-settings' });
    const start = h('select', { class: 'ds-input', dataset: { field: 'doc-start' } }, states.map(name => h('option', { value: name, text: name, selected: doc.start_at === name })));
    start.addEventListener('change', () => this.edit(t('Set start node', '设置起点'), e => { e.dialogue.start_at = start.value; }));
    settings.append(this.field(t('Start node', '起始节点'), start));
    settings.append(h('label', { class: 'ds-check' },
      h('input', { type: 'checkbox', checked: doc.unskippable === true, dataset: { field: 'doc-unskippable' }, onchange: event => this.edit(t('Toggle unskippable', '切换不可跳过'), e => { if (event.target.checked) e.dialogue.unskippable = true; else delete e.dialogue.unskippable; }) }),
      h('span', { text: t('Unskippable (unskippable: true)', '不可跳过（unskippable: true）') })));
    settings.append(this.field(t('Key prefix for new text', '新文本的键名前缀'), h('code', { class: 'ds-code-block', text: keyPrefix(entry.path) })));

    const tips = this.section(t('Working on the graph', '画布操作'), { iconName: 'keyboard', open: states.length <= 3, id: 'doc-tips' });
    tips.append(h('ul', { class: 'ds-tips' },
      h('li', { text: t('Drag from a reply\'s ● to a node to link it. Drop on empty space to create a node there.', '从选项右侧的 ● 拖到节点上即可连线；拖到空白处会在那里新建节点。') }),
      h('li', { text: t('Double-click the canvas to add a node. Right-click for more.', '双击画布添加节点，右键查看更多操作。') }),
      h('li', { text: t('Drag empty space to pan, scroll to zoom, Shift-drag to select several nodes.', '拖动空白处平移，滚轮缩放，按住 Shift 拖动可框选。') })));

    const raw = this.section(t('Dialogue JSON', '对话 JSON'), { iconName: 'terminal', open: false, id: 'doc-json' });
    raw.append(this.jsonBlock(doc, value => {
      if (!object(value) || !object(value.states)) throw Error(t('A dialogue needs a "states" object.', '对话需要 "states" 对象。'));
      store.mutate(t('Edit dialogue JSON', '编辑对话 JSON'), tx => { tx.edit(entry.id).dialogue = value; });
      this.app.select([]);
    }, 'doc:json', 14));
  }
}

