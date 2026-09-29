import { setOwn, translationKeys, validateWorkspace } from './model.mjs';

export const languages = ['en_us', 'zh_cn'];
const pretty = value => JSON.stringify(value, null, 2) + '\n';

/** Reference locations let writers work on a key without guessing its speaker or context. */
export function translationCatalog(workspace) {
  const catalog = new Map();
  function visit(value, path, pointer) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.translate === 'string') {
      if (!catalog.has(value.translate)) catalog.set(value.translate, []);
      catalog.get(value.translate).push({ path, pointer });
    }
    for (const [key, child] of Object.entries(value)) {
      visit(child, path, `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
    }
  }
  for (const entry of workspace.documents) visit(entry.dialogue, entry.path, '');
  return [...catalog].sort(([a], [b]) => a.localeCompare(b)).map(([key, sources]) => ({
    key,
    sources,
    missing: languages.filter(lang => !workspace.translations[lang][key]?.trim()),
  }));
}

/** Blank text is an intentional authoring state, never a structural validation error. */
export function seedTranslations(workspace) {
  for (const { key } of translationCatalog(workspace)) for (const lang of languages) {
    if (!Object.hasOwn(workspace.translations[lang], key)) setOwn(workspace.translations[lang], key, '');
  }
}

export function mergeTranslations(workspace, lang, values) {
  if (!languages.includes(lang) || !values || typeof values !== 'object' || Array.isArray(values)
      || Object.values(values).some(value => typeof value !== 'string')) {
    throw Error('Import en_us.json or zh_cn.json containing translation keys and string values.');
  }
  // An unfinished handoff must not erase a translation already written in the editor.
  for (const [key, value] of Object.entries(values)) {
    if (!value.trim() && workspace.translations[lang][key]?.trim()) continue;
    setOwn(workspace.translations[lang], key, value);
  }
}

export function buildResourceFiles(workspace, { includeWorkspace = false } = {}) {
  const result = validateWorkspace(workspace);
  if (result.errors.length) throw Error(result.errors.join('\n'));
  const catalog = translationCatalog(workspace);
  const files = Object.fromEntries(workspace.documents.map(entry => [
    `data/isekaiexpansion/blabber/blabber_dialogues/${entry.path}`, pretty(entry.dialogue),
  ]));
  for (const lang of languages) {
    files[`language_assemble/categories/dialogues/${lang}.json`] = pretty(Object.fromEntries(
      catalog.map(({ key }) => [key, workspace.translations[lang][key]?.trim() ? workspace.translations[lang][key] : '']),
    ));
  }
  files['translation-todo.json'] = pretty({
    format: 'isekai-dialogue-translation-todo', version: 1,
    entries: catalog.filter(entry => entry.missing.length),
  });
  files['manifest.json'] = pretty({
    format: 'isekai-dialogue-resource-bundle', version: 1,
    files: workspace.documents.map(entry => entry.path), languages,
  });
  if (includeWorkspace) files['studio/workspace.json'] = pretty(workspace);
  files['README.txt'] = [
    'Every referenced translation key is exported in both languages. Empty values are intentional writing tasks.',
    'For writers and AI agents: use translation-todo.json for missing languages and JSON Pointer source locations.',
    'Fill the language JSON values; preserve keys, resource paths, actions and requirements. Do not translate identifiers.',
    'Import the completed en_us.json / zh_cn.json back into Dialogue Studio to merge the text.',
    'studio/workspace.json, when present, reopens this exact workspace in Dialogue Studio, node layout included. It is not a game resource.',
    'Language files are MERGE fragments, not replacements for existing categories. Review resources before installation.',
    'After merging into language_assemble, run gradlew.bat assembleLanguageFiles. Verify custom actions in-game.',
    '',
    '所有引用的翻译键均输出至两种语言；空值是待填写任务。translation-todo.json 提供缺失语言与 JSON Pointer 引用位置。',
    '作者及 AI 只需填写语言 JSON 的值，保留键名、资源路径、行为和条件。可将完成的 en_us.json / zh_cn.json 导回工坊。',
    'studio/workspace.json 用于在对话工坊中原样打开这份工作区（含节点布局），不是游戏资源，不要放进模组。',
    '语言文件为合并片段，请勿覆盖现有分类。审核资源、合并语言文件后，运行 gradlew.bat assembleLanguageFiles。',
  ].join('\n');
  return files;
}

/** A workspace holding only the chosen documents, with the text they reference. */
export function subsetWorkspace(workspace, paths) {
  const wanted = new Set(paths), documents = workspace.documents.filter(entry => wanted.has(entry.path));
  const keys = new Set(documents.flatMap(entry => [...translationKeys(entry.dialogue)]));
  const translations = Object.fromEntries(languages.map(lang => {
    const dictionary = {};
    for (const key of keys) if (Object.hasOwn(workspace.translations[lang], key)) setOwn(dictionary, key, workspace.translations[lang][key]);
    return [lang, dictionary];
  }));
  return { ...workspace, documents, translations };
}

/** Dictionary keys no document references any more. */
export function unusedTranslationKeys(workspace) {
  const used = new Set(workspace.documents.flatMap(entry => [...translationKeys(entry.dialogue)]));
  return [...new Set(languages.flatMap(lang => Object.keys(workspace.translations[lang])))].filter(key => !used.has(key)).sort();
}

export function languageFiles(workspace) {
  const catalog = translationCatalog(workspace);
  return Object.fromEntries(languages.map(lang => [`${lang}.json`, pretty(Object.fromEntries(
    catalog.map(({ key }) => [key, workspace.translations[lang][key]?.trim() ? workspace.translations[lang][key] : '']),
  ))]));
}

export function translationTodo(workspace, keys) {
  const wanted = keys ? new Set(keys) : null;
  return pretty({
    format: 'isekai-dialogue-translation-todo', version: 1,
    entries: translationCatalog(workspace).filter(entry => entry.missing.length && (!wanted || wanted.has(entry.key))),
  });
}
