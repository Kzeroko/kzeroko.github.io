import { NODE_PRESETS, autoLayout, choicesOf, defaultStateName, keyPrefix, planPaste, removeStates } from '../../lib/dialogue/graph.mjs';
import { clone, nextStateId, setOwn, stateType, translationKeys } from '../../lib/dialogue/model.mjs';
import { h, icon, svg } from './dom.mjs';
import { flatten, shortType } from './text.mjs';

const GRID = 20, MIN_ZOOM = 0.15, MAX_ZOOM = 2, CLICK_SLOP = 4;
const TYPE_ICON = { default: 'message', end_dialogue: 'stop', ask_confirmation: 'question' };
const PRESET_ICON = { dialogue: 'message', end: 'stop', confirmation: 'question', trade: 'coins', villager_trade: 'coins', give_item: 'gift', emoji: 'smile', redirect: 'redirect', command: 'terminal', bounties: 'scroll' };
const PRESET_TONE = { dialogue: 'accent', confirmation: 'warm', give_item: 'accent', emoji: 'accent' };

function uniqueKey(base, used) {
  let key = base, index = 2;
  while (used.has(key)) key = `${base}_${index++}`;
  used.add(key);
  return key;
}

/**
 * The node editor. Nodes are DOM elements inside a transformed "world"; wires are one SVG in the
 * same world. Positions come from the document's saved layout, or from auto layout when none exists.
 */
export class GraphCanvas {
  constructor(app, root) {
    this.app = app; this.root = root; this.t = app.t;
    this.world = root.querySelector('[data-world]');
    this.wires = root.querySelector('[data-wires]');
    this.nodesEl = root.querySelector('[data-nodes]');
    this.marquee = root.querySelector('[data-marquee]');
    this.minimap = root.querySelector('[data-minimap]');
    this.view = { x: 0, y: 0, z: 1 };
    this.views = new Map();
    this.pos = new Map(); this.geom = new Map(); this.els = new Map();
    this.pointers = new Map();
    this.signature = ''; this.docId = null;
    this.bind();
  }

  get entry() { return this.app.entry; }
  get doc() { return this.entry?.dialogue; }

  /* ------------------------------------------------------------- rendering -- */

  /** Re-renders only when the document's structure changed; otherwise refreshes positions and text. */
  sync({ force = false, texts = false } = {}) {
    const entry = this.entry;
    if (!entry) { this.clear(); return; }
    const signature = JSON.stringify(entry.dialogue);
    if (force || entry.id !== this.docId || signature !== this.signature) { this.render(); return; }
    if (texts) this.refreshTexts();
    this.placeFromLayout();
    this.drawWires(); this.updateSelection(); this.scheduleMinimap();
  }

  clear() {
    this.nodesEl.replaceChildren(); this.wires.replaceChildren();
    this.els.clear(); this.geom.clear(); this.pos.clear();
    this.docId = null; this.signature = '';
    this.scheduleMinimap();
  }

  render() {
    const entry = this.entry;
    if (!entry) { this.clear(); return; }
    const changedDoc = entry.id !== this.docId;
    if (changedDoc && this.docId !== null) this.views.set(this.docId, { ...this.view });
    this.docId = entry.id;
    this.signature = JSON.stringify(entry.dialogue);
    this.nodesEl.replaceChildren(); this.els.clear();
    const fragment = document.createDocumentFragment();
    for (const [name, state] of Object.entries(entry.dialogue.states ?? {})) {
      const el = this.buildNode(name, state);
      this.els.set(name, el); fragment.append(el);
    }
    this.nodesEl.append(fragment);
    this.measure();
    this.placeFromLayout();
    this.drawWires(); this.updateSelection();
    if (changedDoc) {
      const saved = this.views.get(entry.id);
      if (saved) { this.view = saved; this.applyView(); } else this.fit();
    }
    this.scheduleMinimap();
  }

  buildNode(name, raw) {
    const t = this.t, entry = this.entry, state = raw && typeof raw === 'object' ? raw : {};
    const type = stateType(state), known = TYPE_ICON[type] ? type : 'default';
    const issues = this.app.store.check(entry.id).issues.filter(issue => issue.state === name);
    const errors = issues.filter(issue => issue.level === 'error').length, warnings = issues.length - errors;
    const typeLabel = { default: t('Dialogue', '对话'), end_dialogue: t('End', '结束'), ask_confirmation: t('Confirm', '确认') }[known];
    const el = h('article', {
      class: `ds-node ds-node--${known}`, dataset: { node: name },
      attrs: { 'aria-label': `${typeLabel}: ${name}` },
    });
    el.append(
      h('span', { class: 'ds-port ds-port--in', dataset: { portIn: '' } }),
      h('header', { class: 'ds-node__head', dataset: { head: '' } },
        h('span', { class: 'ds-node__type' }, icon(TYPE_ICON[known], 14)),
        h('span', { class: 'ds-node__name', text: name }),
        entry.dialogue.start_at === name ? h('span', { class: 'ds-badge ds-badge--start' }, icon('flag', 11), t('Start', '起点')) : null,
        errors ? h('span', { class: 'ds-badge ds-badge--error', attrs: { 'aria-label': t(`${errors} errors`, `${errors} 个错误`) } }, icon('alert', 11), String(errors))
          : warnings ? h('span', { class: 'ds-badge ds-badge--warn', attrs: { 'aria-label': t(`${warnings} notes`, `${warnings} 个提醒`) } }, icon('alert', 11), String(warnings)) : null),
    );
    const line = this.preview(state.text);
    if (type !== 'end_dialogue' || state.text !== undefined) el.append(h('p', { class: `ds-node__text${line.missing ? ' is-missing' : ''}`, dataset: { text: '' } }, line.label));
    else el.append(h('p', { class: 'ds-node__text is-quiet', dataset: { text: '' } }, t('Conversation ends here', '对话在此结束')));
    const choices = choicesOf(state);
    if (choices.length) {
      el.append(h('ol', { class: 'ds-node__replies' }, choices.map((choice, index) => {
        const reply = this.preview(choice?.text), linked = typeof choice?.next === 'string' && Object.hasOwn(entry.dialogue.states, choice.next);
        return h('li', { class: 'ds-reply', dataset: { reply: String(index) } },
          h('span', { class: `ds-reply__text${reply.missing ? ' is-missing' : ''}`, dataset: { replyText: '' } }, reply.label),
          choice?.requirement ? h('span', { class: 'ds-reply__lock', attrs: { 'aria-label': t('Has a condition', '带条件') } }, icon('lock', 12)) : null,
          h('span', { class: `ds-port ds-port--out${linked ? '' : ' is-unlinked'}`, dataset: { portOut: String(index) }, attrs: { 'aria-label': t(`Reply ${index + 1} link`, `选项 ${index + 1} 连线`) } }));
      })));
    }
    if (type !== 'end_dialogue') el.append(h('button', { type: 'button', class: 'ds-node__add', dataset: { addReply: '' } }, icon('plus', 12), t('Reply', '选项')));
    const actions = Array.isArray(state.actions) ? state.actions : [];
    if (actions.length) {
      el.append(h('footer', { class: 'ds-node__actions' }, icon('zap', 12),
        h('span', { text: actions.slice(0, 2).map(action => shortType(action?.type)).join(' · ') + (actions.length > 2 ? ` +${actions.length - 2}` : '') })));
    }
    return el;
  }

  preview(component) {
    const t = this.t, lang = this.app.previewLang, other = lang === 'en_us' ? 'zh_cn' : 'en_us';
    if (component === undefined) return { label: h('em', { text: t('No text', '无文本') }), missing: true };
    const result = flatten(component, key => this.app.store.text(lang, key), key => this.app.store.text(other, key));
    if (result.fallback) return { label: h('span', { class: 'ds-fallback' }, h('b', { text: other === 'zh_cn' ? '中' : 'EN' }), result.text), missing: true };
    if (result.text) return { label: result.text, missing: false };
    if (result.key) return { label: h('code', { text: result.key }), missing: true };
    return { label: h('em', { text: result.rich ? t('Rich text', '富文本') : t('Empty', '空') }), missing: true };
  }

  /** Text-only refresh after a translation edit: no DOM rebuild, so selection and focus stay put. */
  refreshTexts() {
    const doc = this.doc;
    if (!doc) return;
    for (const [name, el] of this.els) {
      const state = doc.states[name] ?? {}, textEl = el.querySelector('[data-text]');
      if (textEl && !(stateType(state) === 'end_dialogue' && state.text === undefined)) {
        const line = this.preview(state.text);
        textEl.replaceChildren(line.label); textEl.classList.toggle('is-missing', line.missing);
      }
      el.querySelectorAll('[data-reply-text]').forEach((span, index) => {
        const reply = this.preview(choicesOf(state)[index]?.text);
        span.replaceChildren(reply.label); span.classList.toggle('is-missing', reply.missing);
      });
    }
    this.measure();
  }

  measure() {
    this.geom.clear();
    for (const [name, el] of this.els) {
      const head = el.querySelector('[data-head]');
      this.geom.set(name, {
        w: el.offsetWidth, h: el.offsetHeight,
        inY: head.offsetTop + head.offsetHeight / 2,
        outY: [...el.querySelectorAll('[data-reply]')].map(li => li.offsetTop + li.offsetHeight / 2),
      });
    }
  }

  heights() { return Object.fromEntries([...this.geom].map(([name, g]) => [name, g.h])); }

  placeFromLayout() {
    const entry = this.entry, layout = entry.layout ?? {}, names = [...this.els.keys()];
    const missing = names.filter(name => !Array.isArray(layout[name]));
    const auto = missing.length ? autoLayout(entry.dialogue, { heights: this.heights(), width: 260 }) : {};
    this.pos.clear();
    for (const name of names) this.pos.set(name, [...(layout[name] ?? auto[name] ?? [0, 0])]);
    for (const [name, el] of this.els) this.placeEl(name, el);
  }

  placeEl(name, el = this.els.get(name)) {
    const [x, y] = this.pos.get(name);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  positions() { return Object.fromEntries([...this.pos].map(([name, point]) => [name, [...point]])); }

  drawWires() {
    const doc = this.doc;
    this.wires.replaceChildren();
    if (!doc) return;
    const fragment = document.createDocumentFragment(), selected = this.app.selection;
    for (const [name, state] of Object.entries(doc.states)) {
      const g = this.geom.get(name), p = this.pos.get(name);
      if (!g || !p) continue;
      choicesOf(state).forEach((choice, index) => {
        const x1 = p[0] + g.w, y1 = p[1] + (g.outY[index] ?? g.inY), target = choice?.next;
        const tg = this.geom.get(target), tp = this.pos.get(target);
        if (tg && tp) {
          const x2 = tp[0], y2 = tp[1] + tg.inY;
          const active = selected.has(name) || selected.has(target);
          fragment.append(svg('path', { d: curve(x1, y1, x2, y2), class: `ds-wire${active ? ' is-active' : ''}${target === name ? ' is-loop' : ''}` }));
        } else {
          fragment.append(svg('path', { d: `M${x1} ${y1} h28`, class: 'ds-wire is-broken' }));
          if (target) {
            const label = svg('text', { x: x1 + 34, y: y1 + 4, class: 'ds-wire__label' });
            label.textContent = `→ ${target}?`;
            fragment.append(label);
          }
        }
      });
    }
    this.tempWire = svg('path', { class: 'ds-wire is-temp', d: '' });
    fragment.append(this.tempWire);
    this.wires.append(fragment);
  }

  updateSelection() {
    const selected = this.app.selection;
    for (const [name, el] of this.els) el.classList.toggle('is-selected', selected.has(name));
    for (const path of this.wires.querySelectorAll('.ds-wire:not(.is-temp):not(.is-broken)')) path.classList.remove('is-active');
    this.drawWiresSoon();
  }

  drawWiresSoon() {
    if (this.wireFrame) return;
    this.wireFrame = requestAnimationFrame(() => { this.wireFrame = 0; this.drawWires(); });
  }

  /* ---------------------------------------------------------------- viewport -- */

  applyView() {
    const { x, y, z } = this.view;
    this.world.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    this.root.style.setProperty('--grid', `${GRID * z}px`);
    this.root.style.setProperty('--grid-x', `${x}px`);
    this.root.style.setProperty('--grid-y', `${y}px`);
    this.root.classList.toggle('is-far', z < 0.45);
    this.app.onZoom?.(z);
    this.scheduleMinimap();
  }

  bounds(names = [...this.pos.keys()]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const name of names) {
      const p = this.pos.get(name), g = this.geom.get(name);
      if (!p || !g) continue;
      minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0] + g.w); maxY = Math.max(maxY, p[1] + g.h);
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  }

  fit(names) {
    const box = this.bounds(names?.length ? names : undefined), { width, height } = this.root.getBoundingClientRect();
    if (!box || !width) { this.view = { x: width / 2, y: height / 3, z: 1 }; this.applyView(); return; }
    const pad = 64, w = box.maxX - box.minX, hgt = box.maxY - box.minY;
    const z = clamp(Math.min((width - pad * 2) / w, (height - pad * 2) / hgt, 1.1), MIN_ZOOM, MAX_ZOOM);
    this.view = { z, x: (width - w * z) / 2 - box.minX * z, y: (height - hgt * z) / 2 - box.minY * z };
    this.applyView();
  }

  zoomBy(factor, clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    const cx = clientX ?? rect.left + rect.width / 2, cy = clientY ?? rect.top + rect.height / 2;
    const z = clamp(this.view.z * factor, MIN_ZOOM, MAX_ZOOM), ratio = z / this.view.z;
    this.view.x = cx - rect.left - (cx - rect.left - this.view.x) * ratio;
    this.view.y = cy - rect.top - (cy - rect.top - this.view.y) * ratio;
    this.view.z = z;
    this.applyView();
  }

  zoomTo(z) { this.zoomBy(z / this.view.z); }

  toWorld(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    return [(clientX - rect.left - this.view.x) / this.view.z, (clientY - rect.top - this.view.y) / this.view.z];
  }

  center() {
    const rect = this.root.getBoundingClientRect();
    return this.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  reveal(name) {
    const p = this.pos.get(name), g = this.geom.get(name);
    if (!p || !g) return;
    const { width, height } = this.root.getBoundingClientRect(), { x, y, z } = this.view;
    const left = p[0] * z + x, top = p[1] * z + y, right = left + g.w * z, bottom = top + g.h * z;
    if (left >= 16 && top >= 16 && right <= width - 16 && bottom <= height - 16) return;
    this.view.x = width / 2 - (p[0] + g.w / 2) * z;
    this.view.y = height / 2 - (p[1] + g.h / 2) * z;
    this.applyView();
  }

  /* -------------------------------------------------------------- pointer -- */

  bind() {
    const root = this.root;
    root.addEventListener('pointerdown', event => this.down(event));
    root.addEventListener('pointermove', event => this.move(event));
    root.addEventListener('pointerup', event => this.up(event));
    root.addEventListener('pointercancel', event => this.up(event, true));
    root.addEventListener('wheel', event => this.wheel(event), { passive: false });
    root.addEventListener('dblclick', event => this.doubleClick(event));
    root.addEventListener('contextmenu', event => this.contextMenu(event));
    root.addEventListener('click', event => {
      const add = event.target.closest('[data-add-reply]');
      if (add) { event.stopPropagation(); this.app.run(() => this.addReply(add.closest('[data-node]').dataset.node)); }
    });
    this.minimap.addEventListener('pointerdown', event => this.minimapDown(event));
    new ResizeObserver(() => this.scheduleMinimap()).observe(root);
  }

  down(event) {
    if (event.target.closest('[data-canvas-ui], [data-add-reply]')) return;
    this.app.ui.dismiss();
    if (document.activeElement !== this.root) this.root.focus({ preventScroll: true });
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) { this.startPinch(); return; }
    if (this.pointers.size > 2) return;
    const port = event.target.closest('[data-port-out]'), node = event.target.closest('[data-node]');
    const start = { x: event.clientX, y: event.clientY, moved: false };
    if (event.button === 1 || (event.button === 0 && this.app.spaceHeld)) this.drag = { kind: 'pan', ...start, view: { ...this.view } };
    else if (event.button !== 0) return;
    else if (port) {
      const name = port.closest('[data-node]').dataset.node, index = Number(port.dataset.portOut);
      this.drag = { kind: 'wire', ...start, name, index };
      this.root.classList.add('is-wiring');
    } else if (node) {
      const name = node.dataset.node, selection = this.app.selection, toggle = event.shiftKey || event.ctrlKey || event.metaKey;
      if (toggle) {
        const next = new Set(selection);
        if (next.has(name)) next.delete(name); else next.add(name);
        this.app.select([...next]);
        if (!next.has(name)) return;
      } else if (!selection.has(name)) this.app.select([name]);
      const reply = event.target.closest('[data-reply]');
      if (reply && !toggle) this.app.focusReply = Number(reply.dataset.reply);
      const names = [...this.app.selection].filter(item => this.pos.has(item));
      this.drag = { kind: 'node', ...start, name, toggle, names, origin: new Map(names.map(item => [item, [...this.pos.get(item)]])) };
    } else if (event.shiftKey || event.ctrlKey || event.metaKey) {
      this.drag = { kind: 'marquee', ...start, base: new Set(this.app.selection) };
    } else this.drag = { kind: 'pan', ...start, view: { ...this.view } };
    this.root.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  move(event) {
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pinch) { this.updatePinch(); return; }
    const drag = this.drag;
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    drag.moved = true;
    if (drag.kind === 'pan') {
      this.view.x = drag.view.x + dx; this.view.y = drag.view.y + dy;
      this.root.classList.add('is-panning');
      this.applyView();
    } else if (drag.kind === 'node') {
      const z = this.view.z, snap = this.app.settings.snap && !event.altKey;
      for (const [name, [ox, oy]] of drag.origin) {
        let x = ox + dx / z, y = oy + dy / z;
        if (snap) { x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID; }
        this.pos.set(name, [x, y]); this.placeEl(name);
      }
      this.root.classList.add('is-dragging');
      this.drawWiresSoon(); this.scheduleMinimap();
    } else if (drag.kind === 'wire') {
      const g = this.geom.get(drag.name), p = this.pos.get(drag.name), [wx, wy] = this.toWorld(event.clientX, event.clientY);
      this.tempWire?.setAttribute('d', curve(p[0] + g.w, p[1] + g.outY[drag.index], wx, wy));
      const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-node]');
      for (const el of this.els.values()) el.classList.toggle('is-drop-target', el === over);
    } else if (drag.kind === 'marquee') {
      const rect = this.root.getBoundingClientRect();
      const left = Math.min(drag.x, event.clientX) - rect.left, top = Math.min(drag.y, event.clientY) - rect.top;
      Object.assign(this.marquee.style, { left: `${left}px`, top: `${top}px`, width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px` });
      this.marquee.hidden = false;
      const [ax, ay] = this.toWorld(Math.min(drag.x, event.clientX), Math.min(drag.y, event.clientY));
      const [bx, by] = this.toWorld(Math.max(drag.x, event.clientX), Math.max(drag.y, event.clientY));
      const hit = [...this.pos].filter(([name, [x, y]]) => { const g = this.geom.get(name); return x < bx && x + g.w > ax && y < by && y + g.h > ay; }).map(([name]) => name);
      this.app.select([...new Set([...drag.base, ...hit])], { quiet: true });
    }
  }

  up(event, cancelled = false) {
    this.pointers.delete(event.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
    const drag = this.drag;
    this.drag = null;
    this.root.classList.remove('is-panning', 'is-dragging', 'is-wiring');
    for (const el of this.els.values()) el.classList.remove('is-drop-target');
    if (this.tempWire) this.tempWire.setAttribute('d', '');
    this.marquee.hidden = true;
    if (!drag || cancelled) { if (drag?.kind === 'node' && drag.moved) this.placeFromLayout(); return; }
    if (drag.kind === 'pan' && !drag.moved) this.app.select([]);
    else if (drag.kind === 'node') {
      if (drag.moved) this.app.run(() => this.commitPositions(this.t('Move nodes', '移动节点')));
      else if (!drag.toggle) this.app.select([drag.name]);
    } else if (drag.kind === 'wire') {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-node]')?.dataset.node;
      if (target) this.app.run(() => this.connect(drag.name, drag.index, target));
      else if (drag.moved) this.library({ x: event.clientX, y: event.clientY }, this.toWorld(event.clientX, event.clientY), { name: drag.name, index: drag.index });
      else this.app.select([drag.name]);
    } else if (drag.kind === 'marquee') this.app.select([...this.app.selection]);
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.drag = null;
    this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: { ...this.view } };
  }

  updatePinch() {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const pinch = this.pinch, distance = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const rect = this.root.getBoundingClientRect(), z = clamp(pinch.view.z * distance / pinch.distance, MIN_ZOOM, MAX_ZOOM);
    const wx = (pinch.mid.x - rect.left - pinch.view.x) / pinch.view.z, wy = (pinch.mid.y - rect.top - pinch.view.y) / pinch.view.z;
    this.view = { z, x: mid.x - rect.left - wx * z, y: mid.y - rect.top - wy * z };
    this.applyView();
  }

  wheel(event) {
    if (event.target.closest('[data-canvas-ui]')) return;
    event.preventDefault();
    const zoom = event.ctrlKey || event.metaKey || this.app.settings.wheel === 'zoom';
    if (zoom && !(this.app.settings.wheel === 'zoom' && event.shiftKey)) {
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      this.zoomBy(Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)), event.clientX, event.clientY);
    } else {
      this.view.x -= event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      this.view.y -= event.shiftKey && !event.deltaX ? 0 : event.deltaY;
      this.applyView();
    }
  }

  doubleClick(event) {
    if (event.target.closest('[data-canvas-ui], [data-add-reply], [data-port-out]') || !this.entry) return;
    const node = event.target.closest('[data-node]');
    if (node) { this.app.select([node.dataset.node]); this.app.inspector.focusFirst(); return; }
    this.library({ x: event.clientX, y: event.clientY }, this.toWorld(event.clientX, event.clientY));
  }

  contextMenu(event) {
    if (event.target.closest('[data-canvas-ui]') || !this.entry) return;
    event.preventDefault();
    const t = this.t, node = event.target.closest('[data-node]'), point = { x: event.clientX, y: event.clientY }, world = this.toWorld(event.clientX, event.clientY);
    if (node) {
      const name = node.dataset.node;
      if (!this.app.selection.has(name)) this.app.select([name]);
      const many = this.app.selection.size > 1, end = stateType(this.doc.states[name]) === 'end_dialogue';
      this.app.ui.menu(point, [
        !many && { label: t('Set as start', '设为起点'), icon: 'flag', disabled: this.doc.start_at === name, onSelect: () => this.setStart(name) },
        !many && !end && { label: t('Add reply', '添加选项'), icon: 'plus', onSelect: () => this.addReply(name) },
        { label: t('Duplicate', '复制一份'), icon: 'copy', hint: 'Ctrl+D', onSelect: () => this.duplicate() },
        { label: t('Copy', '复制'), icon: 'copy', hint: 'Ctrl+C', onSelect: () => this.copy() },
        '-',
        { label: many ? t(`Delete ${this.app.selection.size} nodes`, `删除 ${this.app.selection.size} 个节点`) : t('Delete node', '删除节点'), icon: 'trash', hint: 'Del', danger: true, onSelect: () => this.deleteSelected() },
      ]);
    } else {
      this.app.ui.menu(point, [
        { label: t('Add node…', '添加节点…'), icon: 'plus', hint: t('Double-click', '双击'), onSelect: () => this.library(point, world) },
        { label: t('Paste', '粘贴'), icon: 'copy', hint: 'Ctrl+V', disabled: !this.app.clipboard, onSelect: () => this.paste(world) },
        { label: t('Select all', '全选'), icon: 'checkbox', hint: 'Ctrl+A', onSelect: () => this.app.select(Object.keys(this.doc.states)) },
        '-',
        { label: t('Tidy layout', '整理布局'), icon: 'layout', hint: 'L', onSelect: () => this.tidy() },
        { label: t('Fit to view', '适应窗口'), icon: 'fit', hint: 'F', onSelect: () => this.fit() },
      ]);
    }
  }

  /** The node library: a searchable list of node presets, like a node editor's add-node search. */
  library(anchor, world, from = null) {
    if (!this.entry) return;
    const t = this.t;
    const names = {
      dialogue: [t('Dialogue line', '对话台词'), t('NPC speaks, the player replies', 'NPC 说话，玩家选择回复')],
      end: [t('End conversation', '结束对话'), t('Closes the dialogue', '关闭对话')],
      confirmation: [t('Confirmation', '确认'), t('ask_confirmation state', 'ask_confirmation 状态')],
      trade: [t('Open NPC trade', '打开 NPC 交易'), 'isekaiexpansion:open_npc_trade'],
      villager_trade: [t('Open villager trade', '打开村民交易'), 'blabber:open_trade'],
      give_item: [t('Give item', '给予物品'), 'isekaiexpansion:give_item'],
      emoji: [t('Emoji reaction', '表情反应'), 'isekaiexpansion:emoji'],
      redirect: [t('Redirect to dialogue', '跳转到其它对话'), 'blabber:redirect'],
      command: [t('Run command', '执行命令'), 'blabber:command'],
      bounties: [t('Open guild bounties', '打开公会悬赏'), 'isekaiexpansion:open_guild_bounties'],
    };
    const items = NODE_PRESETS.map(preset => ({
      label: names[preset.id][0], description: names[preset.id][1], keywords: `${preset.id} ${preset.type}`,
      icon: PRESET_ICON[preset.id], tone: preset.type === 'end_dialogue' ? 'arcane' : PRESET_TONE[preset.id] ?? 'accent',
      onSelect: () => this.addNode(preset.id, world, from),
    }));
    if (this.app.clipboard && !from) items.push({ label: t('Paste copied nodes', '粘贴已复制的节点'), description: t(`${Object.keys(this.app.clipboard.states).length} nodes`, `${Object.keys(this.app.clipboard.states).length} 个节点`), icon: 'copy', tone: 'warm', keywords: 'paste', onSelect: () => this.paste(world) });
    this.app.ui.picker(anchor, items, { placeholder: t('Search nodes…', '搜索节点…'), empty: t('No matching node.', '没有匹配的节点。') });
  }

  /* ------------------------------------------------------------ operations -- */

  editDoc(label, fn, options) {
    const entry = this.entry;
    if (!entry) throw Error(this.t('Open a dialogue first.', '请先打开一个对话。'));
    return this.app.store.mutate(label, tx => fn(tx.edit(entry.id), tx), options);
  }

  /** Writes every current position, so nodes placed by auto layout stay where the user saw them. */
  commitPositions(label, extra = {}) {
    const positions = { ...this.positions(), ...extra };
    this.editDoc(label, entry => { entry.layout = positions; });
  }

  addNode(presetId, world, from = null) {
    const preset = NODE_PRESETS.find(item => item.id === presetId), store = this.app.store;
    const snap = value => Math.round(value / GRID) * GRID;
    const name = this.editDoc(this.t('Add node', '添加节点'), entry => {
      const doc = entry.dialogue, name = nextStateId(doc, defaultStateName(presetId)), used = store.usedKeys(), prefix = keyPrefix(entry.path);
      const state = preset.make({ key: uniqueKey(`${prefix}.${name}`, used), replyKey: uniqueKey(`${prefix}.${name}.reply_1`, used) });
      setOwn(doc.states, name, state);
      entry.layout = { ...this.positions(), [name]: [snap(world[0]), snap(world[1] - 20)] };
      if (from) { const choice = choicesOf(doc.states[from.name])[from.index]; if (choice) choice.next = name; }
      return name;
    });
    this.app.select([name]);
  }

  addReply(name) {
    const store = this.app.store;
    this.editDoc(this.t('Add reply', '添加选项'), entry => {
      const state = entry.dialogue.states[name];
      if (!Array.isArray(state.choices)) state.choices = [];
      const used = store.usedKeys(), base = `${keyPrefix(entry.path)}.${name}.reply_`;
      let index = state.choices.length + 1;
      while (used.has(`${base}${index}`)) index++;
      state.choices.push({ text: { translate: `${base}${index}` }, next: '' });
      entry.layout = this.positions();
    });
    this.app.select([name]);
    this.app.focusReply = choicesOf(this.doc.states[name]).length - 1;
    this.app.inspector.render();
  }

  connect(name, index, target) {
    this.editDoc(this.t('Link reply', '连接选项'), entry => {
      const choice = choicesOf(entry.dialogue.states[name])[index];
      if (!choice) throw Error(this.t('That reply no longer exists.', '该选项已不存在。'));
      choice.next = target;
    });
  }

  setStart(name) { this.editDoc(this.t('Set start node', '设置起点'), entry => { entry.dialogue.start_at = name; }); }

  deleteSelected() {
    const names = [...this.app.selection];
    if (!names.length || !this.entry) return;
    let unlinked = 0;
    this.editDoc(this.t('Delete nodes', '删除节点'), entry => {
      const layout = this.positions();
      unlinked = removeStates(entry.dialogue, names);
      for (const name of names) delete layout[name];
      entry.layout = layout;
    });
    this.app.select([]);
    const t = this.t;
    this.app.ui.toast(
      t(`Deleted ${names.length} node${names.length > 1 ? 's' : ''}${unlinked ? `; ${unlinked} replies are now unlinked` : ''}.`, `已删除 ${names.length} 个节点${unlinked ? `，${unlinked} 个选项失去连线` : ''}。`),
      { action: { label: t('Undo', '撤销'), onClick: () => this.app.undo() } });
  }

  fragment(names = [...this.app.selection]) {
    const doc = this.doc;
    if (!doc || !names.length) return null;
    return {
      path: this.entry.path,
      states: Object.fromEntries(names.filter(name => Object.hasOwn(doc.states, name)).map(name => [name, clone(doc.states[name])])),
      layout: Object.fromEntries(names.filter(name => this.pos.has(name)).map(name => [name, [...this.pos.get(name)]])),
      texts: Object.fromEntries(['en_us', 'zh_cn'].map(lang => [lang, {}])),
    };
  }

  copy() {
    const fragment = this.fragment();
    if (!fragment) return;
    for (const state of Object.values(fragment.states)) for (const key of translationKeys(state)) {
      for (const lang of ['en_us', 'zh_cn']) { const value = this.app.store.text(lang, key); if (value) fragment.texts[lang][key] = value; }
    }
    this.app.clipboard = fragment;
    navigator.clipboard?.writeText(JSON.stringify({ format: 'isekai-dialogue-nodes', ...fragment }, null, 2)).catch(() => {});
    this.app.ui.toast(this.t(`Copied ${Object.keys(fragment.states).length} nodes.`, `已复制 ${Object.keys(fragment.states).length} 个节点。`));
  }

  async paste(world) {
    let fragment = this.app.clipboard;
    if (!fragment) {
      try {
        const value = JSON.parse(await navigator.clipboard.readText());
        if (value?.format === 'isekai-dialogue-nodes' && value.states) fragment = value;
      } catch { /* nothing usable on the clipboard */ }
    }
    if (!fragment || !this.entry) return;
    this.insertFragment(fragment, world ?? this.center());
  }

  duplicate() {
    const fragment = this.fragment();
    if (fragment) this.insertFragment(fragment, null, this.t('Duplicate nodes', '复制节点'));
  }

  insertFragment(fragment, world, label = this.t('Paste nodes', '粘贴节点')) {
    const store = this.app.store;
    const points = Object.values(fragment.layout ?? {});
    const minX = points.length ? Math.min(...points.map(p => p[0])) : 0, minY = points.length ? Math.min(...points.map(p => p[1])) : 0;
    const offset = world ? [Math.round((world[0] - minX) / GRID) * GRID, Math.round((world[1] - minY) / GRID) * GRID] : [GRID * 2, GRID * 2];
    const names = this.editDoc(label, (entry, tx) => {
      const plan = planPaste({ doc: entry.dialogue, path: entry.path, fragment, usedKeys: store.usedKeys(), offset });
      for (const [name, state] of Object.entries(plan.states)) setOwn(entry.dialogue.states, name, state);
      entry.layout = { ...this.positions(), ...plan.layout };
      for (const { key, from } of plan.texts) for (const lang of ['en_us', 'zh_cn']) {
        const value = store.text(lang, from) || fragment.texts?.[lang]?.[from] || '';
        if (value) tx.text(lang, key, value);
      }
      return Object.keys(plan.states);
    });
    this.app.select(names);
  }

  tidy() {
    if (!this.entry) return;
    this.measure();
    const positions = autoLayout(this.doc, { heights: this.heights(), width: 260 });
    this.editDoc(this.t('Tidy layout', '整理布局'), entry => { entry.layout = positions; });
    requestAnimationFrame(() => this.fit());
  }

  nudge(dx, dy) {
    const names = [...this.app.selection].filter(name => this.pos.has(name));
    if (!names.length) return;
    const moved = Object.fromEntries(names.map(name => { const [x, y] = this.pos.get(name); return [name, [x + dx, y + dy]]; }));
    this.commitPositions(this.t('Move nodes', '移动节点'), moved);
  }

  /* ---------------------------------------------------------------- minimap -- */

  scheduleMinimap() {
    if (this.minimapFrame) return;
    this.minimapFrame = requestAnimationFrame(() => { this.minimapFrame = 0; this.drawMinimap(); });
  }

  minimapTransform() {
    const rect = this.root.getBoundingClientRect(), box = this.bounds();
    const [vx, vy] = [-this.view.x / this.view.z, -this.view.y / this.view.z], vw = rect.width / this.view.z, vh = rect.height / this.view.z;
    const minX = Math.min(box?.minX ?? vx, vx), minY = Math.min(box?.minY ?? vy, vy);
    const maxX = Math.max(box?.maxX ?? vx + vw, vx + vw), maxY = Math.max(box?.maxY ?? vy + vh, vy + vh);
    const width = this.minimap.clientWidth, height = this.minimap.clientHeight, pad = 6;
    const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
    const ox = pad + ((width - pad * 2) - (maxX - minX) * scale) / 2 - minX * scale, oy = pad + ((height - pad * 2) - (maxY - minY) * scale) / 2 - minY * scale;
    return { scale, ox, oy, view: [vx, vy, vw, vh] };
  }

  drawMinimap() {
    const canvas = this.minimap;
    if (canvas.hidden || !canvas.clientWidth) return;
    const ratio = devicePixelRatio || 1, width = canvas.clientWidth, height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
    const ctx = canvas.getContext('2d'), style = getComputedStyle(this.root);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!this.pos.size) return;
    const { scale, ox, oy, view } = this.minimapTransform(), selected = this.app.selection;
    const colour = { default: style.getPropertyValue('--c-accent'), end_dialogue: style.getPropertyValue('--c-arcane'), ask_confirmation: style.getPropertyValue('--c-warm') };
    for (const [name, [x, y]] of this.pos) {
      const g = this.geom.get(name);
      if (!g) continue;
      ctx.globalAlpha = selected.has(name) ? 1 : 0.55;
      ctx.fillStyle = colour[stateType(this.doc.states[name])] || colour.default;
      ctx.fillRect(ox + x * scale, oy + y * scale, Math.max(2, g.w * scale), Math.max(2, g.h * scale));
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = style.getPropertyValue('--c-text-muted');
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + view[0] * scale + 0.5, oy + view[1] * scale + 0.5, view[2] * scale, view[3] * scale);
  }

  minimapDown(event) {
    event.preventDefault(); event.stopPropagation();
    const go = e => {
      const rect = this.minimap.getBoundingClientRect(), { scale, ox, oy } = this.minimapTransform(), host = this.root.getBoundingClientRect();
      const wx = (e.clientX - rect.left - ox) / scale, wy = (e.clientY - rect.top - oy) / scale;
      this.view.x = host.width / 2 - wx * this.view.z; this.view.y = host.height / 2 - wy * this.view.z;
      this.applyView();
    };
    go(event);
    const up = () => { removeEventListener('pointermove', go); removeEventListener('pointerup', up); };
    addEventListener('pointermove', go); addEventListener('pointerup', up);
  }
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function curve(x1, y1, x2, y2) {
  const dx = x2 - x1, back = dx < 40;
  const bend = back ? Math.max(80, Math.abs(y2 - y1) / 3, -dx / 3) : Math.max(40, dx / 2);
  return `M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
}

