import { choicesOf } from '../../lib/dialogue/graph.mjs';
import { stateType } from '../../lib/dialogue/model.mjs';
import { button, h, icon } from './dom.mjs';
import { describeIssue, flatten, shortType } from './text.mjs';

/** Plays the open dialogue the way the game walks it; conditions and actions are shown, not run. */
export class Preview {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.trail = []; this.docId = null; this.follow = true;
  }

  reset() { this.trail = []; this.render(); }

  render() {
    const t = this.t, entry = this.app.entry;
    this.root.replaceChildren();
    if (!entry) { this.root.append(h('div', { class: 'ds-empty-panel' }, icon('play', 28), h('p', { text: t('Open a dialogue to play it through.', '打开对话后可以试玩。') }))); return; }
    const doc = entry.dialogue;
    if (entry.id !== this.docId) { this.docId = entry.id; this.trail = []; }
    this.trail = this.trail.filter(name => Object.hasOwn(doc.states, name));
    if (!this.trail.length && Object.hasOwn(doc.states, doc.start_at)) this.trail = [doc.start_at];
    const name = this.trail.at(-1), state = doc.states[name] ?? {};
    const lang = this.app.previewLang, other = lang === 'en_us' ? 'zh_cn' : 'en_us';
    const lookup = key => this.app.store.text(lang, key), fallback = key => this.app.store.text(other, key);
    const show = component => {
      if (component === undefined) return h('em', { class: 'ds-muted', text: t('(no text)', '（无文本）') });
      const result = flatten(component, lookup, fallback);
      if (result.fallback) return h('span', { class: 'ds-fallback' }, h('b', { text: other === 'zh_cn' ? '中' : 'EN' }), result.text);
      return result.text ? result.text : result.key ? h('code', { class: 'ds-missing-key', text: result.key }) : h('em', { class: 'ds-muted', text: t('(rich text)', '（富文本）') });
    };

    this.root.append(h('div', { class: 'ds-play__bar' },
      h('div', { class: 'ds-seg ds-seg--small', attrs: { role: 'radiogroup', 'aria-label': t('Preview language', '预览语言') } },
        [['en_us', 'EN'], ['zh_cn', '中文']].map(([value, label]) => h('button', { type: 'button', class: 'ds-seg__item', attrs: { role: 'radio', 'aria-checked': String(lang === value) }, onclick: () => this.app.setPreviewLang(value) }, label))),
      h('label', { class: 'ds-check ds-check--small' }, h('input', { type: 'checkbox', checked: this.follow, onchange: event => { this.follow = event.target.checked; } }), h('span', { text: t('Follow on canvas', '画布跟随') })),
      button(t('Restart', '重来'), { icon: 'refresh', variant: 'ghost', compact: true, onclick: () => this.go(null) })));

    this.root.append(h('ol', { class: 'ds-play__trail', attrs: { 'aria-label': t('Visited nodes', '已走过的节点') } }, this.trail.map((item, index) => h('li', {},
      h('button', { type: 'button', class: `ds-chip${index === this.trail.length - 1 ? ' is-current' : ''}`, onclick: () => { this.trail = this.trail.slice(0, index + 1); this.after(); } }, item)))));

    const stage = h('div', { class: 'ds-play__stage' });
    if (!name) { stage.append(h('p', { class: 'ds-note is-error', text: t('start_at does not point to a node.', 'start_at 没有指向任何节点。') })); this.root.append(stage); return; }
    const actions = Array.isArray(state.actions) ? state.actions : [];
    if (actions.length && this.trail.length > 1) stage.append(h('div', { class: 'ds-play__actions' }, actions.map(action => h('span', { class: 'ds-chip ds-chip--zap' }, icon('zap', 11), shortType(action?.type)))));
    if (state.text !== undefined || stateType(state) !== 'end_dialogue') stage.append(h('div', { class: 'ds-play__line' }, h('span', { class: 'ds-play__speaker', text: 'NPC' }), h('p', {}, show(state.text))));
    if (stateType(state) === 'end_dialogue') {
      stage.append(h('p', { class: 'ds-play__end' }, icon('stop', 14), t('The conversation ends here.', '对话在此结束。')),
        button(t('Play again', '再玩一次'), { icon: 'refresh', variant: 'soft', onclick: () => this.go(null) }));
    } else {
      const replies = h('div', { class: 'ds-play__replies' });
      choicesOf(state).forEach((choice, index) => {
        const target = choice?.next, ok = typeof target === 'string' && Object.hasOwn(this.app.entry.dialogue.states, target);
        const requirement = choice?.requirement;
        replies.append(h('button', { type: 'button', class: 'ds-play__reply', disabled: !ok, onclick: () => this.go(target) },
          h('span', { class: 'ds-play__num', text: String(index + 1) }),
          h('span', { class: 'ds-play__reply-text' }, show(choice?.text)),
          requirement ? h('span', { class: 'ds-chip ds-chip--lock' }, icon('lock', 11), requirement.type === 'blabber:player_level' ? t(`Level ${requirement.value}+`, `等级 ${requirement.value}+`) : shortType(requirement.type)) : null,
          ok ? null : h('span', { class: 'ds-chip ds-chip--error', text: t('not linked', '未连接') })));
      });
      if (!choicesOf(state).length) replies.append(h('p', { class: 'ds-note is-error', text: t('No replies — the player would be stuck here.', '没有选项，玩家会卡在这里。') }));
      stage.append(replies);
    }
    this.root.append(stage, h('p', { class: 'ds-muted ds-small', text: t('Conditions and actions are listed for review; the preview does not run game logic. Empty text shows its key.', '条件与行为仅作展示，预览不会执行游戏逻辑。未填写的文本显示键名。') }));
  }

  go(name) {
    if (name === null) this.trail = [];
    else this.trail.push(name);
    this.after();
  }

  after() {
    this.render();
    const current = this.trail.at(-1);
    if (this.follow && current) { this.app.select([current], { fromPreview: true }); this.app.canvas.reveal(current); }
  }
}

/** Structural problems for the open dialogue, then a workspace-wide list to jump between files. */
export class IssuesPanel {
  constructor(app, root) { this.app = app; this.root = root; this.t = app.t; }

  render() {
    const t = this.t, store = this.app.store, entry = this.app.entry;
    this.root.replaceChildren();
    if (entry) {
      const result = store.check(entry.id);
      const head = h('div', { class: 'ds-issues__head' }, h('h3', { text: t('This dialogue', '当前对话') }),
        h('span', { class: `ds-count${result.errors.length ? ' is-error' : ''}`, text: String(result.issues.length) }));
      this.root.append(head);
      if (!result.issues.length) this.root.append(h('p', { class: 'ds-note is-ok' }, icon('check', 14), t('No structural problems. Unwritten text never blocks export.', '结构没有问题。未填写的文本不影响导出。')));
      else this.root.append(h('ul', { class: 'ds-issues' }, result.issues.map(issue => h('li', {},
        h('button', { type: 'button', class: `ds-issue is-${issue.level}`, onclick: () => { if (issue.state && Object.hasOwn(entry.dialogue.states, issue.state)) { this.app.select([issue.state]); this.app.canvas.reveal(issue.state); if (issue.choice !== null) this.app.focusReply = issue.choice; this.app.showInspector('inspect'); } } },
          icon('alert', 14),
          h('span', { class: 'ds-issue__text' }, issue.state ? h('code', { text: issue.state }) : null, h('span', { text: describeIssue(issue, t) })))))));
    }
    const others = store.documents.filter(item => item.id !== entry?.id).map(item => ({ item, result: store.check(item.id) })).filter(({ result }) => result.errors.length)
      .sort((a, b) => b.result.errors.length - a.result.errors.length);
    const paths = new Map();
    for (const item of store.documents) paths.set(item.path, (paths.get(item.path) ?? 0) + 1);
    const duplicates = [...paths].filter(([, count]) => count > 1);
    this.root.append(h('div', { class: 'ds-issues__head' }, h('h3', { text: t('Other files with errors', '其它有错误的文件') }), h('span', { class: `ds-count${others.length ? ' is-error' : ''}`, text: String(others.length) })));
    if (duplicates.length) this.root.append(h('p', { class: 'ds-note is-error', text: t(`Duplicate paths: ${duplicates.map(([path]) => path).join(', ')}`, `路径重复：${duplicates.map(([path]) => path).join('、')}`) }));
    if (!others.length) this.root.append(h('p', { class: 'ds-muted', text: t('None.', '没有。') }));
    else this.root.append(h('ul', { class: 'ds-issues' }, others.slice(0, 300).map(({ item, result }) => h('li', {},
      h('button', { type: 'button', class: 'ds-issue is-error', onclick: () => this.app.open(item.id) },
        h('span', { class: 'ds-count is-error', text: String(result.errors.length) }),
        h('span', { class: 'ds-issue__text' }, h('span', { class: 'ds-mono ds-wrap', text: item.path }), h('small', { text: describeIssue(result.issues.find(issue => issue.level === 'error'), t) })))))));
    if (others.length > 300) this.root.append(h('p', { class: 'ds-muted', text: t(`${others.length - 300} more. Fix these first.`, `还有 ${others.length - 300} 个，先修这些。`) }));
  }
}
