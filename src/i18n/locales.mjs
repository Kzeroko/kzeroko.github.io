/**
 * Single source of truth for the site's languages.
 *
 * Kept as plain `.mjs` (no TypeScript) so `astro.config.mjs` and the runtime
 * `src/i18n/index.ts` can both import it without a build step.
 */

/**
 * @typedef {Object} Locale
 * @property {'en' | 'zh-cn'} code        URL segment, e.g. `/en/wiki/`.
 * @property {string} htmlLang            BCP-47 tag for `<html lang>` and hreflang.
 * @property {string} label               Name of the language, written in that language.
 * @property {string} short               Compact label for the switcher.
 * @property {string} dateLocale          Intl locale used for date formatting.
 */

/** @type {readonly Locale[]} */
export const LOCALES = [
  { code: 'en', htmlLang: 'en-US', label: 'English', short: 'EN', dateLocale: 'en-US' },
  { code: 'zh-cn', htmlLang: 'zh-CN', label: '简体中文', short: '中文', dateLocale: 'zh-CN' },
];

/** @type {'zh-cn'} */
export const DEFAULT_LOCALE = 'zh-cn';

export const LOCALE_CODES = /** @type {const} */ (LOCALES.map((locale) => locale.code));
