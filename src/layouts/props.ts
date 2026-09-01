import type { LocaleCode } from '../i18n';

/**
 * Props every layout forwards to `BaseLayout`.
 *
 * Declared in a `.ts` module so the specialised layouts can extend it with a
 * plain `interface … extends`, rather than importing a type across `.astro`
 * module boundaries.
 */
export interface BaseLayoutProps {
  lang: LocaleCode;
  title: string;
  description: string;
  /** OG image path; falls back to the site card. */
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  publishedTime?: Date;
  modifiedTime?: Date;
  /** Extra JSON-LD graphs merged after the WebSite node. */
  jsonLd?: unknown[];
  /** Home page uses `Site — Tagline` instead of `Page · Site`. */
  isHome?: boolean;
  /**
   * Overrides where the language switcher and the hreflang alternates point,
   * per language. Needed for pages that do not exist at the same slug in every
   * language — blog tag pages, for instance, whose tags differ by language.
   */
  translatedPaths?: Partial<Record<LocaleCode, string>>;
  /**
   * `'full'` renders the site header and footer. `'bare'` renders neither —
   * used by the 404 page, which is served for every unmatched path in both
   * languages and would otherwise show one language's chrome around bilingual
   * content.
   */
  chrome?: 'full' | 'bare';
  mainClass?: string;
  bodyClass?: string;
}
