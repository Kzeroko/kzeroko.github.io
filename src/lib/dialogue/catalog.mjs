/**
 * Actions and requirements the Studio can edit with a form. Anything else stays editable as JSON.
 * Field kinds: id (namespaced identifier), string, int, bool, enum.
 */
export const ACTIONS = [
  { type: 'isekaiexpansion:open_npc_trade', group: 'trade', fields: [] },
  { type: 'blabber:open_trade', group: 'trade', fields: [] },
  { type: 'isekaiexpansion:open_guild_bounties', group: 'trade', fields: [] },
  { type: 'isekaiexpansion:give_item', group: 'reward', fields: [
    { name: 'item', kind: 'id', required: true },
    { name: 'size', kind: 'int', default: 1 },
    { name: 'nbt', kind: 'string', default: '' },
    { name: 'update', kind: 'bool', default: true },
  ] },
  { type: 'isekaiexpansion:reveal_energy', group: 'reward', fields: [{ name: 'value', kind: 'string', required: true, default: '' }] },
  { type: 'isekaiexpansion:reveal_rank', group: 'reward', fields: [{ name: 'value', kind: 'string', required: true, default: '' }] },
  { type: 'isekaiexpansion:emote', group: 'expression', fields: [
    { name: 'emote', kind: 'string', required: true },
    { name: 'force', kind: 'bool', default: true },
  ] },
  { type: 'isekaiexpansion:emoji', group: 'expression', fields: [
    { name: 'emoji', kind: 'id', required: true },
    { name: 'duration_ticks', kind: 'int', default: 70 },
    { name: 'priority', kind: 'int', default: 50 },
    { name: 'policy', kind: 'enum', options: ['replace', 'queue', 'force'], default: 'replace' },
    { name: 'target', kind: 'enum', options: ['dialogue_entity', 'player', 'both'], default: 'dialogue_entity' },
    { name: 'interruptible', kind: 'bool', default: true },
    { name: 'interrupt_on_damage', kind: 'bool', default: true },
  ] },
  { type: 'blabber:command', group: 'flow', fields: [{ name: 'value', kind: 'string', required: true, default: '' }] },
  { type: 'blabber:redirect', group: 'flow', fields: [{ name: 'value', kind: 'id', required: true, default: '' }] },
];

export const REQUIREMENTS = [
  { type: 'blabber:player_level', fields: [{ name: 'value', kind: 'int', required: true, default: 1 }] },
];

export const findAction = type => ACTIONS.find(action => action.type === type);
export const findRequirement = type => REQUIREMENTS.find(requirement => requirement.type === type);

/** A new action or requirement object with every required field filled in. */
export function blank(spec) {
  const value = { type: spec.type };
  for (const field of spec.fields) if (field.required) value[field.name] = field.default ?? (field.kind === 'int' ? 0 : field.kind === 'bool' ? false : '');
  return value;
}
