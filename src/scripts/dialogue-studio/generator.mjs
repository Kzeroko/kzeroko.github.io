import { generate, races, routes, templates } from '../../lib/dialogue/templates.mjs';
import { button, fill, h, icon, preserveFocus } from './dom.mjs';

const TIERS = ['normal', 'friendly', 'trust', 'married'];
const PHASES = ['initial', 'repeat', 'rapid_repeat'];
const GENDERS = ['male', 'female'];
const SCOPES = ['citizen', 'unique', 'common', 'simple', 'combat', 'villager', 'allegiance'];
const PRESETS = {
  everyday: { routes: ['talk', 'bond', 'farewell'], tiers: TIERS, phases: PHASES },
  romance: { routes: ['bond', 'engage_confirm', 'engage_denied_unready', 'engage_denied_already'], tiers: ['trust', 'married'], phases: PHASES },
  commands: { routes: ['mode_follow', 'mode_stay', 'mode_patrol', 'mode_wander'], tiers: ['friendly', 'trust', 'married'], phases: PHASES },
};

/**
 * Batch generation with toggles instead of comma lists. The preview runs the real generator on
 * every change, so the file count, paths and warnings shown are exactly what "Generate" creates.
 */
export class Generator {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.options = { template: 'conversation', scope: 'citizen', subjects: 'isekaiexpansion_citizen', routes: ['talk'], tiers: ['normal'], phases: ['initial', 'repeat'], genders: ['male', 'female'], variants: 0, bond: 'contract', existing: 'skip' };
    this.build();
  }

  build() {
    const t = this.t;
    this.form = h('div', { class: 'ds-gen' });
    this.previewEl = h('div', { class: 'ds-gen__preview', attrs: { 'aria-live': 'polite' } });
    this.submit = button(t('Generate', '生成'), { icon: 'sparkles', variant: 'primary', onclick: () => this.app.run(() => this.run()) });
    this.root.append(
      h('div', { class: 'ds-panel__head' }, h('h2', { class: 'ds-panel__title', text: t('Generate', '批量生成') })),
      h('div', { class: 'ds-panel__scroll' }, this.form),
      h('div', { class: 'ds-panel__foot' }, this.previewEl, this.submit));
    this.render();
  }

  set(key, value) { this.options[key] = value; this.render(); }

  chips(key, values, { label, hint } = {}) {
    const selected = new Set(this.options[key]);
    return h('fieldset', { class: 'ds-field ds-fieldset' },
      h('legend', { class: 'ds-field__label', text: label }),
      h('div', { class: 'ds-chips' }, values.map(value => h('label', { class: 'ds-chip-toggle' },
        h('input', { type: 'checkbox', checked: selected.has(value), dataset: { field: `${key}:${value}` }, onchange: event => {
          const next = new Set(this.options[key]);
          if (event.target.checked) next.add(value); else next.delete(value);
          this.set(key, values.filter(item => next.has(item)).concat([...next].filter(item => !values.includes(item))));
        } }),
        h('span', { text: value })))),
      hint ? h('small', { class: 'ds-field__hint', text: hint }) : null);
  }

  render() { preserveFocus(this.form, () => this.draw()); }

  draw() {
    const t = this.t, o = this.options, scope = o.scope;
    const templateNames = { conversation: t('Simple conversation', '日常对话'), choice: t('Branching conversation', '分支对话'), trade: t('NPC trade', 'NPC 交易'), requirement: t('Conditional reply', '条件选项') };
    const scopeHints = {
      citizen: t('Citizens (npc/simple/…)', '城镇居民（npc/simple/…）'), unique: t('Named NPCs, one per type key', '有名字的 NPC，每个类型键一套'),
      common: t('Shared fallback for every NPC', '所有 NPC 共用的兜底'), simple: 'npc/simple/…', combat: 'npc/combat/…',
      villager: t('Villager professions', '村民职业'), allegiance: t('Owner conversations by race', '按种族区分的隶属对话'),
    };
    const select = (key, values, label) => {
      const el = h('select', { class: 'ds-input', dataset: { field: key } }, values.map(([value, name]) => h('option', { value, text: name, selected: o[key] === value })));
      el.addEventListener('change', () => {
        if (key === 'scope') {
          const defaults = { allegiance: 'human', villager: 'farmer' };
          if (['human', 'farmer', 'isekaiexpansion_citizen'].includes(o.subjects)) o.subjects = defaults[el.value] ?? 'isekaiexpansion_citizen';
        }
        this.set(key, el.value);
      });
      return this.field(label, el);
    };
    const hidden = {
      subjects: scope === 'common', tiers: ['allegiance', 'villager'].includes(scope), genders: ['unique', 'allegiance', 'villager'].includes(scope),
      variants: ['allegiance', 'villager'].includes(scope), routes: scope === 'villager', phases: scope === 'villager', bond: scope !== 'allegiance',
    };
    const subjects = h('input', { class: 'ds-input ds-mono', dataset: { field: 'subjects' }, value: o.subjects, spellcheck: false, placeholder: scope === 'allegiance' ? 'human, elf' : 'isekaiexpansion_citizen' });
    subjects.addEventListener('change', () => this.set('subjects', subjects.value));
    const custom = h('input', { class: 'ds-input ds-mono', placeholder: t('custom_route, another_route', 'custom_route, another_route'), spellcheck: false });
    custom.addEventListener('change', () => { const extra = custom.value.split(',').map(v => v.trim()).filter(Boolean); this.set('routes', [...new Set([...o.routes.filter(r => routes.includes(r)), ...extra])]); });
    const variants = h('input', { type: 'number', class: 'ds-input', dataset: { field: 'variants' }, min: 0, max: 5, value: o.variants });
    variants.addEventListener('change', () => this.set('variants', Math.max(0, Math.min(5, Number(variants.value) || 0))));

    fill(this.form,
      h('div', { class: 'ds-row ds-row--wrap' },
        h('span', { class: 'ds-field__label', text: t('Presets', '预设') }),
        ...Object.entries({ everyday: t('Everyday', '日常互动'), romance: t('Romance & ring', '恋爱与戒指'), commands: t('Commands', '指令回应') }).map(([key, name]) =>
          button(name, { variant: 'soft', onclick: () => { Object.assign(this.options, structuredClone(PRESETS[key])); this.render(); } }))),
      select('template', [...Object.keys(templates).map(key => [key, templateNames[key] ?? key]), ['custom', t('Current dialogue as template', '以当前对话为模板')]], t('Template', '模板')),
      select('scope', SCOPES.map(value => [value, `${value} · ${scopeHints[value]}`]), t('NPC scope', 'NPC 范围')),
      hidden.subjects ? null : this.field(scope === 'allegiance' ? t('Races', '种族') : scope === 'villager' ? t('Villager professions', '村民职业') : t('NPC type keys', 'NPC 类型键'), subjects, t('Separate several with commas.', '多个用逗号分隔。')),
      scope === 'allegiance' ? h('div', { class: 'ds-chips ds-chips--dense' }, races.map(race => h('button', {
        type: 'button', class: `ds-chip${o.subjects.split(',').map(v => v.trim()).includes(race) ? ' is-current' : ''}`,
        onclick: () => { const list = o.subjects.split(',').map(v => v.trim()).filter(Boolean); this.set('subjects', (list.includes(race) ? list.filter(v => v !== race) : [...list, race]).join(',')); },
      }, race))) : null,
      hidden.bond ? null : this.field(t('Allegiance type', '隶属类型'), h('div', { class: 'ds-seg' }, [['contract', t('Contract', '契约')], ['dark_magic', t('Dark magic', '暗魔法')]].map(([value, name]) =>
        h('button', { type: 'button', class: 'ds-seg__item', dataset: { field: `bond:${value}` }, attrs: { 'aria-checked': String(o.bond === value), role: 'radio' }, onclick: () => this.set('bond', value) }, name)))),
      hidden.routes ? null : this.chips('routes', routes, { label: t('Dialogue routes', '对话入口') }),
      hidden.routes ? null : this.field(t('Custom routes', '自定义入口'), custom),
      hidden.tiers ? null : this.chips('tiers', TIERS, { label: t('Relationship tiers', '关系阶段') }),
      hidden.phases ? null : this.chips('phases', PHASES, { label: t('Phases', '交互阶段') }),
      hidden.genders ? null : this.chips('genders', GENDERS, { label: t('Genders', '性别') }),
      hidden.variants ? null : this.field(t('Scenario variants (0–5)', '情景变体（0–5）'), variants, t('Adds <phase>_scenario_1… files to the random pool.', '额外生成 <phase>_scenario_1… 加入随机池。')),
      this.field(t('When a path already exists', '路径已存在时'), h('div', { class: 'ds-seg' }, [['skip', t('Skip it', '跳过')], ['stop', t('Stop', '中止')]].map(([value, name]) =>
        h('button', { type: 'button', class: 'ds-seg__item', dataset: { field: `existing:${value}` }, attrs: { 'aria-checked': String(o.existing === value), role: 'radio' }, onclick: () => this.set('existing', value) }, name)))),
      h('p', { class: 'ds-muted ds-small', text: t('Romance presets create dialogue routes only. Ring eligibility and spouse binding stay with the game.', '恋爱预设只生成对话入口，戒指资格与配偶绑定仍由游戏判定。') }));
    this.preview();
  }

  field(label, control, hint) {
    return h('label', { class: 'ds-field' }, h('span', { class: 'ds-field__label', text: label }), control, hint ? h('small', { class: 'ds-field__hint', text: hint }) : null);
  }

  plan() {
    const o = this.options;
    const template = o.template === 'custom' ? this.app.entry?.dialogue : undefined;
    if (o.template === 'custom' && !template) throw Error(this.t('Open a dialogue to use it as the template.', '请先打开一个对话作为模板。'));
    return generate({ ...o, template: o.template === 'custom' ? 'conversation' : o.template, routes: o.routes.join(','), tiers: o.tiers.join(','), phases: o.phases.join(','), genders: o.genders.join(',') }, template);
  }

  preview() {
    const t = this.t;
    try {
      const result = this.plan(), existing = new Set(this.app.store.documents.map(entry => entry.path));
      const clash = result.documents.filter(entry => existing.has(entry.path)).length, fresh = result.documents.length - clash;
      fill(this.previewEl,
        h('p', { class: 'ds-gen__count' }, h('strong', { text: String(fresh) }), t(' new dialogues', ' 个新对话'), clash ? h('span', { class: 'ds-muted', text: t(` · ${clash} already exist`, ` · ${clash} 个已存在`) }) : null),
        result.documents.length ? h('ul', { class: 'ds-gen__paths' }, result.documents.slice(0, 3).map(entry => h('li', { class: 'ds-mono', text: entry.path })), result.documents.length > 3 ? h('li', { class: 'ds-muted', text: t(`…and ${result.documents.length - 3} more`, `……还有 ${result.documents.length - 3} 个`) }) : null) : null,
        result.warnings.length ? h('details', { class: 'ds-gen__warn' }, h('summary', {}, icon('alert', 12), t(`${result.warnings.length} skipped combinations`, `跳过了 ${result.warnings.length} 种组合`)), h('ul', {}, result.warnings.map(w => h('li', { text: w })))) : null);
      this.submit.disabled = !fresh || (clash > 0 && this.options.existing === 'stop');
    } catch (error) {
      fill(this.previewEl, h('p', { class: 'ds-note is-error', text: error.message }));
      this.submit.disabled = true;
    }
  }

  run() {
    const t = this.t, store = this.app.store, result = this.plan(), existing = new Set(store.documents.map(entry => entry.path));
    const clash = result.documents.filter(entry => existing.has(entry.path));
    if (clash.length && this.options.existing === 'stop') throw Error(t(`${clash.length} paths already exist.`, `有 ${clash.length} 个路径已存在。`));
    const fresh = result.documents.filter(entry => !existing.has(entry.path));
    if (store.documents.length + fresh.length > 5000) throw Error(t('A workspace holds at most 5,000 dialogues.', '一个工作区最多 5,000 个对话。'));
    let first = null;
    store.mutate(t('Generate dialogues', '批量生成对话'), tx => {
      for (const entry of fresh) { const added = tx.add({ path: entry.path, dialogue: entry.dialogue }); first ??= added.id; }
    });
    if (first) this.app.open(first);
    this.app.ui.toast(t(`Created ${fresh.length} dialogues${clash.length ? `, skipped ${clash.length} existing` : ''}. Their text can stay empty for now.`, `已生成 ${fresh.length} 个对话${clash.length ? `，跳过 ${clash.length} 个已存在的` : ''}。文本可以先空着。`), { kind: 'success', action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
    this.preview();
  }
}
