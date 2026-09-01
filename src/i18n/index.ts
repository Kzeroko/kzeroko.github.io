import { DEFAULT_LOCALE, LOCALES } from './locales.mjs';
import { UI, type UIKey } from './ui';

export type LocaleCode = 'en' | 'zh-cn';

export interface Locale {
  code: LocaleCode;
  htmlLang: string;
  label: string;
  short: string;
  dateLocale: string;
}

export const locales = LOCALES as readonly Locale[];
export const localeCodes = locales.map((locale) => locale.code);
export const defaultLocale = DEFAULT_LOCALE as LocaleCode;

const localeByCode = new Map(locales.map((locale) => [locale.code, locale]));

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && localeByCode.has(value as LocaleCode);
}

export function getLocale(code: string | undefined): Locale {
  return localeByCode.get(code as LocaleCode) ?? localeByCode.get(defaultLocale)!;
}

/**
 * Returns a translator bound to one language.
 *
 * Missing keys fall back to English rather than rendering the raw key, so a
 * half-finished translation degrades into a readable page instead of debris.
 */
export function useTranslations(lang: LocaleCode) {
  const table = UI[lang] ?? UI[defaultLocale];
  return function t(key: UIKey): string {
    return table[key] ?? UI.en[key] ?? key;
  };
}

export type Translator = ReturnType<typeof useTranslations>;

/** Builds a site-absolute, trailing-slash URL inside one language. */
export function localePath(lang: LocaleCode, ...segments: (string | number)[]): string {
  const parts = segments
    .flatMap((segment) => String(segment).split('/'))
    .map((segment) => segment.trim())
    .filter(Boolean);
  return `/${[lang, ...parts].join('/')}/`;
}

/**
 * Splits a pathname into its language and the remainder.
 * `/zh-cn/wiki/comfort/` -> `{ lang: 'zh-cn', rest: 'wiki/comfort' }`
 */
export function splitLocalePath(pathname: string): { lang: LocaleCode; rest: string } {
  const [first = '', ...rest] = pathname.replace(/^\/+|\/+$/g, '').split('/');
  return isLocale(first)
    ? { lang: first, rest: rest.join('/') }
    : { lang: defaultLocale, rest: [first, ...rest].filter(Boolean).join('/') };
}

/** The same page in another language, used by the language switcher. */
export function switchLocalePath(pathname: string, target: LocaleCode): string {
  const { rest } = splitLocalePath(pathname);
  return localePath(target, rest);
}

export function formatDate(date: Date, lang: LocaleCode): string {
  return new Intl.DateTimeFormat(getLocale(lang).dateLocale, {
    year: 'numeric',
    month: lang === 'zh-cn' ? 'numeric' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Rough reading time. CJK is counted per character (~340 chars/min) and Latin
 * per word (~200 wpm), which keeps the estimate honest in both languages.
 */
export function readingTime(source: string, lang: LocaleCode): number {
  const cjk = (source.match(/[㐀-鿿豈-﫿぀-ヿ]/g) ?? []).length;
  const words = source.replace(/[㐀-鿿豈-﫿぀-ヿ]/g, ' ').split(/\s+/).filter(Boolean).length;
  const minutes = cjk / 340 + words / (lang === 'zh-cn' ? 220 : 200);
  return Math.max(1, Math.round(minutes));
}

export type { UIKey };
