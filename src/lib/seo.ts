import { getLocale, locales, splitLocalePath, type LocaleCode } from '../i18n';
import { SITE } from '../data/site';

export interface SeoInput {
  title: string;
  description: string;
  lang: LocaleCode;
  pathname: string;
  /** Absolute or root-relative image URL for OG/Twitter cards. */
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  publishedTime?: Date;
  modifiedTime?: Date;
  /** Per-language overrides for pages that are not at the same slug everywhere. */
  translatedPaths?: Partial<Record<LocaleCode, string>>;
}

export interface SeoOutput {
  title: string;
  description: string;
  canonical: string;
  image: string;
  type: 'website' | 'article';
  noindex: boolean;
  alternates: { hrefLang: string; href: string }[];
  publishedTime?: string;
  modifiedTime?: string;
}

function absolute(path: string): string {
  return new URL(path, SITE.url).toString();
}

/** Normalises to a single trailing slash, matching `trailingSlash: 'always'`. */
function normalisePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return `${trimmed || ''}/`;
}

export function buildSeo(input: SeoInput): SeoOutput {
  const path = normalisePath(input.pathname);
  const { rest } = splitLocalePath(path);

  // Most pages exist at the same slug in every language, so alternates are
  // derived. `translatedPaths` covers the exceptions.
  const alternates = [
    ...locales.map((locale) => ({
      hrefLang: getLocale(locale.code).htmlLang,
      href: absolute(
        input.translatedPaths?.[locale.code] ??
          `/${[locale.code, rest].filter(Boolean).join('/')}/`
      ),
    })),
    { hrefLang: 'x-default', href: absolute('/') },
  ];

  return {
    title: input.title,
    description: input.description,
    canonical: absolute(path),
    image: absolute(input.image ?? '/og-default.png'),
    type: input.type ?? 'website',
    noindex: input.noindex ?? false,
    alternates,
    publishedTime: input.publishedTime?.toISOString(),
    modifiedTime: input.modifiedTime?.toISOString(),
  };
}

/** Page `<title>` — the bare site name on the home page, `Page · Site` elsewhere. */
export function formatTitle(title: string, siteTitle: string, isHome: boolean): string {
  return isHome ? `${siteTitle} — ${title}` : `${title} · ${siteTitle}`;
}

export interface BreadcrumbEntry {
  name: string;
  href: string;
}

export function breadcrumbJsonLd(entries: BreadcrumbEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: absolute(entry.href),
    })),
  };
}

export function websiteJsonLd(lang: LocaleCode, siteTitle: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteTitle,
    description,
    url: SITE.url,
    inLanguage: getLocale(lang).htmlLang,
    author: { '@type': 'Person', name: SITE.author, url: SITE.url },
  };
}

export function articleJsonLd(seo: SeoOutput, lang: LocaleCode) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: seo.title,
    description: seo.description,
    image: seo.image,
    url: seo.canonical,
    inLanguage: getLocale(lang).htmlLang,
    datePublished: seo.publishedTime,
    dateModified: seo.modifiedTime ?? seo.publishedTime,
    author: { '@type': 'Person', name: SITE.author },
    publisher: { '@type': 'Person', name: SITE.author },
  };
}
