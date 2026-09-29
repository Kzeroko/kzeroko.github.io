import { FORMAT, safePath, setOwn } from './model.mjs';
import { languages } from './export.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const ignored = new Set(['manifest.json', 'translation-todo.json', 'package.json']);

/**
 * Maps an uploaded file's relative location to a dialogue resource path. Anything under a
 * `blabber_dialogues` folder keeps the part after it; a picked folder drops its own name.
 */
export function dialoguePath(relative, { stripRoot = false } = {}) {
  const parts = String(relative).replaceAll('\\', '/').split('/').filter(part => part && part !== '.');
  const marker = parts.lastIndexOf('blabber_dialogues');
  if (marker >= 0) return parts.slice(marker + 1).join('/');
  if (stripRoot && parts.length > 1) return parts.slice(1).join('/');
  return parts.join('/');
}

/**
 * Reads the "Copy for AI" brief back as one dictionary per language. Returns null for anything else.
 */
export function textBrief(value) {
  if (!object(value) || value.format !== 'isekai-dialogue-text-brief' || !Array.isArray(value.entries)) return null;
  const result = {};
  for (const lang of languages) {
    const values = {};
    for (const entry of value.entries) if (object(entry) && typeof entry.key === 'string' && typeof entry[lang] === 'string') setOwn(values, entry.key, entry[lang]);
    result[lang] = values;
  }
  return result;
}

/**
 * Sorts uploaded JSON into one workspace, language dictionaries and dialogue documents.
 * Documents with structural problems are still accepted so they can be fixed in the editor;
 * only files that are not dialogue-shaped are skipped.
 * @param {{ path: string, text: string, stripRoot?: boolean }[]} files
 */
export function classifyImport(files) {
  const result = { workspace: null, dialogues: [], dictionaries: [], skipped: [], ignored: 0 };
  const seen = new Set();
  for (const file of files) {
    const base = file.path.replaceAll('\\', '/').split('/').pop() ?? '';
    if (!base.toLowerCase().endsWith('.json')) { result.ignored++; continue; }
    let value;
    try { value = JSON.parse(file.text.replace(/^\uFEFF/, '')); } catch { result.skipped.push({ path: file.path, reason: 'json' }); continue; }
    if (object(value) && value.format === FORMAT) {
      if (result.workspace) result.skipped.push({ path: file.path, reason: 'workspace' });
      else result.workspace = { path: file.path, value };
      continue;
    }
    const brief = textBrief(value);
    if (brief) { for (const [lang, values] of Object.entries(brief)) result.dictionaries.push({ lang, values, path: file.path }); continue; }
    if (ignored.has(base) || object(value) && typeof value.format === 'string' && value.format.startsWith('isekai-dialogue-')) { result.ignored++; continue; }
    const lang = base.replace(/\.json$/i, '').toLowerCase();
    if (languages.includes(lang) && object(value)) {
      if (Object.values(value).every(text => typeof text === 'string')) result.dictionaries.push({ lang, values: value, path: file.path });
      else result.skipped.push({ path: file.path, reason: 'dictionary' });
      continue;
    }
    if (!object(value) || !object(value.states)) { result.skipped.push({ path: file.path, reason: 'shape' }); continue; }
    const path = dialoguePath(file.path, { stripRoot: file.stripRoot });
    if (!safePath(path)) { result.skipped.push({ path: file.path, reason: 'path' }); continue; }
    if (seen.has(path)) { result.skipped.push({ path: file.path, reason: 'duplicate' }); continue; }
    seen.add(path);
    result.dialogues.push({ path, dialogue: value });
  }
  return result;
}
