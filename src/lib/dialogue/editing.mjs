import { translationKeys } from './model.mjs';

/** Form edits preserve Minecraft formatting, extra text and custom choice metadata. */
export function describeText(value) {
  if (typeof value === 'string') return { mode: 'literal', value };
  if (value && !Array.isArray(value)) {
    if (typeof value.translate === 'string') return { mode: 'key', value: value.translate };
    if (typeof value.text === 'string') return { mode: 'literal', value: value.text };
  }
  return value === undefined ? { mode: 'key', value: '' } : { mode: 'advanced', value: JSON.stringify(value) };
}

export function editText(original, mode, value) {
  if (mode === 'advanced') return structuredClone(original);
  const component = original && typeof original === 'object' && !Array.isArray(original) ? structuredClone(original) : {};
  for (const field of ['text', 'translate', 'selector', 'score', 'keybind', 'nbt']) delete component[field];
  component[mode === 'key' ? 'translate' : 'text'] = value;
  return component;
}

export function nextReplyKey(workspace, path, state, draft) {
  const used = translationKeys(draft);
  for (const dictionary of Object.values(workspace.translations)) for (const key of Object.keys(dictionary)) used.add(key);
  const prefix = `dialogue.isekaiexpansion.${path.slice(0,-5).replaceAll('/','.')}.${state}.reply_`;
  let index = 1;
  while (used.has(`${prefix}${index}`)) index++;
  return `${prefix}${index}`;
}
