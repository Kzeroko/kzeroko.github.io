/** Current Blabber documents stay intact; editor state never replaces their schema. */
export const FORMAT = 'isekai-dialogue-workspace';
export const VERSION = 1;
export const STATE_TYPES = ['default', 'end_dialogue', 'ask_confirmation'];
export const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idPattern = /^[a-z0-9_.-]+:[a-z0-9/._-]+$/;
const unsafeNames = ['__proto__', 'constructor', 'prototype'];
export const isIdentifier = value => typeof value === 'string' && idPattern.test(value);
export const safePath = path => typeof path === 'string' && /^[a-z0-9_./-]+\.json$/.test(path) && !path.startsWith('/') && !path.split('/').some(p => p === '..' || p === '.' || !p);
export const stateType = state => String(state?.type ?? 'default').toLowerCase();

/** Own-property write that cannot touch the prototype, whatever the key. */
export function setOwn(target, key, value) {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

export function translationKeys(value, keys = new Set()) {
  if (Array.isArray(value)) value.forEach(item => translationKeys(item, keys));
  else if (object(value)) {
    if (typeof value.translate === 'string') keys.add(value.translate);
    Object.values(value).forEach(item => translationKeys(item, keys));
  }
  return keys;
}

/**
 * `errors` and `warnings` keep their plain-string form for scripts that already consume them;
 * `issues` carries the same findings with the state and choice they belong to.
 */
export function validateDialogue(doc) {
  const issues = [];
  const report = (level, state, choice, message) => issues.push({ level, state, choice, message });
  const bad = (message, state = null, choice = null) => report('error', state, choice, message);
  const done = () => ({
    errors: issues.filter(i => i.level === 'error').map(i => i.message),
    warnings: issues.filter(i => i.level === 'warning').map(i => i.message),
    issues,
  });
  const text = (value, at, state, choice) => {
    if (typeof value === 'string') return;
    if (Array.isArray(value) && value.length) { value.forEach(v => text(v, at, state, choice)); return; }
    if (!object(value) || !['text','translate','selector','score','keybind','nbt'].some(k => k in value)) bad(`${at}: expected a Minecraft text component.`, state, choice);
  };
  if (!object(doc)) { bad('Dialogue must be an object.'); return done(); }
  if ('start' in doc) bad('start is not a runtime field; use start_at.');
  if (!object(doc.states) || !Object.keys(doc.states).length) { bad('states must be a nonempty object.'); return done(); }
  if (typeof doc.start_at !== 'string' || !Object.hasOwn(doc.states, doc.start_at)) bad('start_at must name an existing state.');
  if ('unskippable' in doc && typeof doc.unskippable !== 'boolean') bad('unskippable must be boolean.');
  if (Object.keys(doc.states).length > 2000) bad('A dialogue may contain at most 2,000 editor states.');
  const graph = new Map(), ends = new Set();
  for (const [name, state] of Object.entries(doc.states)) {
    if (!object(state)) { bad(`${name}: state must be an object.`, name); continue; }
    if (!name || unsafeNames.includes(name)) bad(`${name}: unsafe state name.`, name);
    const type = stateType(state);
    if (!STATE_TYPES.includes(type)) bad(`${name}: unknown state type ${type}.`, name);
    if ('action' in state) bad(`${name}: singular action is retired; use actions.`, name);
    if ('text' in state) text(state.text, `${name}.text`, name);
    if ('actions' in state && !Array.isArray(state.actions)) bad(`${name}.actions must be an array.`, name);
    for (const action of Array.isArray(state.actions) ? state.actions : []) {
      if (!object(action) || !isIdentifier(action.type)) { bad(`${name}: action needs a namespaced type.`, name); continue; }
      if (['blabber:command','blabber:redirect','isekaiexpansion:reveal_energy','isekaiexpansion:reveal_rank'].includes(action.type) && typeof action.value !== 'string') bad(`${name}: ${action.type} requires string value.`, name);
      if (action.type === 'blabber:redirect' && !isIdentifier(action.value)) bad(`${name}: redirect value must be an identifier.`, name);
      if (action.type === 'isekaiexpansion:give_item' && !isIdentifier(action.item)) bad(`${name}: give_item requires item ID.`, name);
      if (action.type === 'isekaiexpansion:emote' && (typeof action.emote !== 'string' || !action.emote.trim())) bad(`${name}: emote requires a name.`, name);
      if (action.type === 'isekaiexpansion:emoji' && !isIdentifier(action.emoji)) bad(`${name}: emoji requires a catalogue ID.`, name);
    }
    if (name === doc.start_at && state.actions?.length) report('warning', name, null, `${name}: initial-state actions are not executed when opening a dialogue.`);
    if ('choices' in state && !Array.isArray(state.choices)) bad(`${name}.choices must be an array.`, name);
    const choices = Array.isArray(state.choices) ? state.choices : [];
    if (type === 'end_dialogue') ends.add(name);
    else if (!choices.length) bad(`${name}: a non-ending state needs a choice.`, name);
    const destinations = [];
    for (const [index, choice] of choices.entries()) {
      const at = `${name}.choices[${index}]`;
      if (!object(choice)) { bad(`${at}: expected object.`, name, index); continue; }
      text(choice.text, `${at}.text`, name, index);
      if (choice.next === '' || choice.next === undefined) bad(`${at}: destination is not linked.`, name, index);
      else if (typeof choice.next !== 'string' || !Object.hasOwn(doc.states, choice.next)) bad(`${at}: destination does not exist.`, name, index);
      else destinations.push(choice.next);
      if ('requirement' in choice && (!object(choice.requirement) || !isIdentifier(choice.requirement.type))) bad(`${at}: requirement needs a namespaced type.`, name, index);
      if (choice.requirement?.type === 'blabber:player_level' && !Number.isInteger(choice.requirement.value)) bad(`${at}: player_level requires integer value.`, name, index);
      if ('requirement_tip' in choice) text(choice.requirement_tip, `${at}.requirement_tip`, name, index);
    }
    graph.set(name, destinations);
  }
  const reachable = new Set(), queue = [doc.start_at];
  while (queue.length) { const name = queue.pop(); if (reachable.has(name)) continue; reachable.add(name); queue.push(...(graph.get(name) ?? [])); }
  for (const name of graph.keys()) if (!reachable.has(name)) report('warning', name, null, `${name}: unreachable from start.`);
  const canEnd = new Set(ends), reverse = new Map();
  for (const [from, targets] of graph) for (const target of targets) { if (!reverse.has(target)) reverse.set(target, []); reverse.get(target).push(from); }
  const work = [...ends];
  while (work.length) for (const parent of reverse.get(work.pop()) ?? []) if (!canEnd.has(parent)) { canEnd.add(parent); work.push(parent); }
  for (const name of reachable) if (graph.has(name) && !canEnd.has(name)) bad(`${name}: no reachable end_dialogue state.`, name);
  return done();
}

export function renameState(doc, from, to) {
  if (!Object.hasOwn(doc.states, from) || !to.trim() || Object.hasOwn(doc.states, to) || unsafeNames.includes(to)) throw Error('Choose a new, nonempty state ID.');
  doc.states = Object.fromEntries(Object.entries(doc.states).map(([key, state]) => [key === from ? to : key, state]));
  if (doc.start_at === from) doc.start_at = to;
  for (const state of Object.values(doc.states)) for (const choice of state.choices ?? []) if (choice.next === from) choice.next = to;
}

export function deleteState(doc, name, replacement) {
  if (Object.keys(doc.states).length < 2) throw Error('Keep at least one state.');
  if (!replacement || replacement === name || !Object.hasOwn(doc.states, replacement)) throw Error('Choose a replacement for incoming choices and start.');
  if (doc.start_at === name) doc.start_at = replacement;
  for (const state of Object.values(doc.states)) for (const choice of state.choices ?? []) if (choice.next === name) choice.next = replacement;
  delete doc.states[name];
}

export function nextStateId(doc, base = 'state') {
  if (base !== 'state' && !Object.hasOwn(doc.states, base)) return base;
  let index = base === 'state' ? 1 : 2;
  while (Object.hasOwn(doc.states, `${base}_${index}`)) index++;
  return `${base}_${index}`;
}
export function emptyWorkspace() { return { format: FORMAT, version: VERSION, documents: [], translations: { en_us: {}, zh_cn: {} } }; }

/** Node positions are editor metadata beside the dialogue; malformed layout is dropped rather than rejected. */
function cleanLayout(layout) {
  if (!object(layout)) return undefined;
  const result = {};
  for (const [name, point] of Object.entries(layout)) {
    if (Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) setOwn(result, name, [point[0], point[1]]);
  }
  return Object.keys(result).length ? result : undefined;
}

export function parseWorkspace(value) {
  if (!object(value) || value.format !== FORMAT || value.version !== VERSION || !Array.isArray(value.documents) || value.documents.length > 5000) throw Error('Unsupported workspace. Use the current version.');
  const paths = new Set();
  for (const entry of value.documents) {
    if (!object(entry) || !safePath(entry.path) || paths.has(entry.path) || !object(entry.dialogue)) throw Error('Invalid or duplicate dialogue path.');
    paths.add(entry.path);
  }
  if (!object(value.translations?.en_us) || !object(value.translations?.zh_cn)) throw Error('Both language dictionaries are required.');
  for (const lang of Object.values(value.translations)) for (const value of Object.values(lang)) if (typeof value !== 'string') throw Error('Translations must be strings.');
  const result = clone(value);
  for (const entry of result.documents) {
    const layout = cleanLayout(entry.layout);
    if (layout) entry.layout = layout; else delete entry.layout;
  }
  if ('name' in result && typeof result.name !== 'string') delete result.name;
  return result;
}

export function validateWorkspace(workspace) {
  const errors = [], warnings = [], paths = new Set();
  for (const entry of workspace.documents) {
    if (!safePath(entry.path) || paths.has(entry.path)) errors.push(`Invalid or duplicate path: ${entry.path}`);
    paths.add(entry.path);
    const result = validateDialogue(entry.dialogue);
    errors.push(...result.errors.map(e => `${entry.path}: ${e}`)); warnings.push(...result.warnings.map(e => `${entry.path}: ${e}`));
  }
  if (!workspace.documents.length) errors.push('Add a dialogue first.');
  return { errors, warnings };
}
