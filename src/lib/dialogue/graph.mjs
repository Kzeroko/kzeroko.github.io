import { clone, nextStateId, setOwn, stateType } from './model.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Translation-key prefix derived from a resource path, matching the shipped data's convention. */
export const keyPrefix = path => `dialogue.isekaiexpansion.${String(path).replace(/\.json$/, '').replaceAll('/', '.')}`;

export function choicesOf(state) { return object(state) && Array.isArray(state.choices) ? state.choices : []; }

/** Linked destinations per state, in choice order; missing targets are left out. */
export function edges(doc) {
  const result = new Map();
  for (const [name, state] of Object.entries(doc?.states ?? {})) {
    result.set(name, choicesOf(state).map(choice => choice?.next).filter(next => typeof next === 'string' && Object.hasOwn(doc.states, next)));
  }
  return result;
}

export function reachableStates(doc) {
  const graph = edges(doc), seen = new Set(), queue = Object.hasOwn(doc?.states ?? {}, doc?.start_at) ? [doc.start_at] : [];
  while (queue.length) { const name = queue.pop(); if (seen.has(name)) continue; seen.add(name); queue.push(...(graph.get(name) ?? [])); }
  return seen;
}

export function unreachableStates(doc) {
  const seen = reachableStates(doc);
  return Object.keys(doc?.states ?? {}).filter(name => !seen.has(name));
}

/**
 * Layered layout: back edges are ignored, every other edge points right, and each column is ordered
 * by the average row of its parents. States unreachable from the start form separate bands below.
 */
export function autoLayout(doc, { heights = {}, width = 260, gapX = 96, gapY = 28, defaultHeight = 120 } = {}) {
  const states = Object.keys(doc?.states ?? {}), graph = edges(doc), positions = {};
  if (!states.length) return positions;
  const height = name => heights[name] ?? defaultHeight;
  const placed = new Set();
  let bandTop = 0;
  const roots = [doc.start_at, ...states].filter((name, index, all) => Object.hasOwn(doc.states, name) && all.indexOf(name) === index);
  for (const root of roots) {
    if (placed.has(root)) continue;
    // Depth-first order of this component, skipping states an earlier band already placed.
    const status = new Map(), order = [], back = new Set();
    const visit = name => {
      status.set(name, 1);
      for (const next of graph.get(name) ?? []) {
        if (placed.has(next)) continue;
        if (status.get(next) === 1) back.add(`${name}\u0000${next}`);
        else if (!status.has(next)) visit(next);
      }
      status.set(name, 2); order.push(name);
    };
    visit(root);
    const members = order.reverse(), layer = new Map(members.map(name => [name, 0]));
    for (const name of members) for (const next of graph.get(name) ?? []) {
      if (!layer.has(next) || back.has(`${name}\u0000${next}`)) continue;
      layer.set(next, Math.max(layer.get(next), layer.get(name) + 1));
    }
    const columns = [];
    for (const name of members) (columns[layer.get(name)] ??= []).push(name);
    const row = new Map();
    columns.forEach((column, depth) => {
      if (depth) {
        // Average parent row, nudged by reply order so a node's first reply sits above its second.
        const score = name => {
          const parents = members.filter(parent => layer.get(parent) < depth && (graph.get(parent) ?? []).includes(name));
          if (!parents.length) return Infinity;
          return parents.reduce((sum, parent) => {
            const targets = graph.get(parent);
            return sum + (row.get(parent) ?? 0) + targets.indexOf(name) / (targets.length + 1);
          }, 0) / parents.length;
        };
        const scores = new Map(column.map(name => [name, score(name)]));
        column.sort((a, b) => scores.get(a) - scores.get(b));
      }
      column.forEach((name, index) => row.set(name, index));
    });
    const columnHeight = column => column.reduce((sum, name) => sum + height(name), 0) + gapY * (column.length - 1);
    const tallest = Math.max(...columns.map(columnHeight));
    columns.forEach((column, depth) => {
      let y = bandTop + (tallest - columnHeight(column)) / 2;
      for (const name of column) { setOwn(positions, name, [depth * (width + gapX), Math.round(y)]); y += height(name) + gapY; placed.add(name); }
    });
    bandTop += tallest + gapY * 4;
  }
  return positions;
}

/** Deleting states in the canvas unlinks incoming replies instead of guessing a new destination. */
export function removeStates(doc, names) {
  const doomed = new Set(names.filter(name => Object.hasOwn(doc.states, name)));
  if (!doomed.size) return 0;
  if (doomed.size >= Object.keys(doc.states).length) throw Error('Keep at least one node.');
  for (const name of doomed) delete doc.states[name];
  let unlinked = 0;
  for (const state of Object.values(doc.states)) for (const choice of choicesOf(state)) {
    if (object(choice) && doomed.has(choice.next)) { choice.next = ''; unlinked++; }
  }
  if (!Object.hasOwn(doc.states, doc.start_at)) doc.start_at = Object.keys(doc.states)[0];
  return unlinked;
}

/** Visits every translation key in the places a writer edits: state text, reply text and reply tips. */
function textSlots(name, state) {
  const slots = [];
  if (object(state.text) && typeof state.text.translate === 'string') slots.push([state.text, `${name}`]);
  choicesOf(state).forEach((choice, index) => {
    if (!object(choice)) return;
    if (object(choice.text) && typeof choice.text.translate === 'string') slots.push([choice.text, `${name}.reply_${index + 1}`]);
    if (object(choice.requirement_tip) && typeof choice.requirement_tip.translate === 'string') slots.push([choice.requirement_tip, `${name}.reply_${index + 1}.tip`]);
  });
  return slots;
}

function uniqueKey(base, used) {
  if (!used.has(base)) { used.add(base); return base; }
  let index = 2;
  while (used.has(`${base}_${index}`)) index++;
  used.add(`${base}_${index}`);
  return `${base}_${index}`;
}

/**
 * Plans a paste of copied states into `doc`. Names that collide are suffixed, links between copied
 * states follow the copies, and links to states the target lacks are left unlinked. Keys owned by the
 * source dialogue get fresh keys under the target prefix; shared keys such as a common "continue" stay shared.
 */
export function planPaste({ doc, path, fragment, usedKeys = new Set(), offset = [40, 40] }) {
  const rename = {}, states = {}, layout = {}, texts = [];
  const taken = { states: { ...doc.states } };
  for (const name of Object.keys(fragment.states)) {
    const next = nextStateId(taken, name);
    setOwn(rename, name, next); setOwn(taken.states, next, true);
  }
  const sourcePrefix = fragment.path ? `${keyPrefix(fragment.path)}.` : null, targetPrefix = keyPrefix(path);
  for (const [name, original] of Object.entries(fragment.states)) {
    const state = clone(original), newName = rename[name];
    for (const choice of choicesOf(state)) {
      if (!object(choice)) continue;
      if (Object.hasOwn(rename, choice.next)) choice.next = rename[choice.next];
      else if (!Object.hasOwn(doc.states, choice.next)) choice.next = '';
    }
    for (const [component, suffix] of textSlots(newName, state)) {
      const key = component.translate;
      if (sourcePrefix && !key.startsWith(sourcePrefix)) continue;
      const fresh = uniqueKey(`${targetPrefix}.${suffix}`, usedKeys);
      texts.push({ key: fresh, from: key });
      component.translate = fresh;
    }
    setOwn(states, newName, state);
    const point = fragment.layout?.[name];
    if (point) setOwn(layout, newName, [point[0] + offset[0], point[1] + offset[1]]);
  }
  return { rename, states, layout, texts };
}

/** Rewrites keys under one prefix, for moving or duplicating a dialogue to a new path. */
export function rekeyDialogue(dialogue, fromPrefix, toPrefix) {
  const result = clone(dialogue), pairs = [];
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!object(value)) return;
    if (typeof value.translate === 'string' && (value.translate === fromPrefix || value.translate.startsWith(`${fromPrefix}.`))) {
      const next = toPrefix + value.translate.slice(fromPrefix.length);
      if (!pairs.some(([from]) => from === value.translate)) pairs.push([value.translate, next]);
      value.translate = next;
    }
    Object.values(value).forEach(visit);
  };
  visit(result);
  return { dialogue: result, pairs };
}

/** Starting nodes for the canvas library. `key` is the translation key the new node's line uses. */
export const NODE_PRESETS = [
  { id: 'dialogue', type: 'default', make: ({ key, replyKey }) => ({ text: { translate: key }, choices: [{ text: { translate: replyKey }, next: '' }] }) },
  { id: 'end', type: 'end_dialogue', make: () => ({ type: 'end_dialogue' }) },
  { id: 'confirmation', type: 'ask_confirmation', make: ({ key, replyKey }) => ({ type: 'ask_confirmation', text: { translate: key }, choices: [{ text: { translate: replyKey }, next: '' }] }) },
  { id: 'trade', type: 'end_dialogue', make: () => ({ type: 'end_dialogue', actions: [{ type: 'isekaiexpansion:open_npc_trade' }] }) },
  { id: 'villager_trade', type: 'end_dialogue', make: () => ({ type: 'end_dialogue', actions: [{ type: 'blabber:open_trade' }] }) },
  { id: 'give_item', type: 'default', make: ({ key, replyKey }) => ({ text: { translate: key }, actions: [{ type: 'isekaiexpansion:give_item', item: '', size: 1 }], choices: [{ text: { translate: replyKey }, next: '' }] }) },
  { id: 'emoji', type: 'default', make: ({ key, replyKey }) => ({ text: { translate: key }, actions: [{ type: 'isekaiexpansion:emoji', emoji: 'isekaiexpansion:evelina/smile' }], choices: [{ text: { translate: replyKey }, next: '' }] }) },
  { id: 'redirect', type: 'end_dialogue', make: () => ({ type: 'end_dialogue', actions: [{ type: 'blabber:redirect', value: '' }] }) },
  { id: 'command', type: 'end_dialogue', make: () => ({ type: 'end_dialogue', actions: [{ type: 'blabber:command', value: '' }] }) },
  { id: 'bounties', type: 'end_dialogue', make: () => ({ type: 'end_dialogue', actions: [{ type: 'isekaiexpansion:open_guild_bounties' }] }) },
];

export const defaultStateName = presetId => ({ end: 'end', trade: 'trade', villager_trade: 'trade', redirect: 'redirect', command: 'command', bounties: 'bounties', confirmation: 'confirm' })[presetId] ?? 'line';

export { stateType };
