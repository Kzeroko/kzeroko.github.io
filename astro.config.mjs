// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { rehypeEnhance } from './src/plugins/rehype-enhance.mjs';
import { DEFAULT_LOCALE, LOCALES } from './src/i18n/locales.mjs';

const localeCodes = LOCALES.map((locale) => locale.code);

/** Legacy Starlight URLs kept alive so old links and search results still land somewhere useful. */
const legacyRedirects = Object.fromEntries(
  localeCodes.flatMap((lang) => {
    const legacy = lang === 'zh-cn' ? 'zh-cn' : 'en';
    /** @type {[string, string][]} */
    const pairs = [
      [`/${legacy}/ktm2/ktm2modpack`, `/${lang}/ktm2/`],
      [`/${legacy}/ktm2/contents/customcontents`, `/${lang}/ktm2/`],
      [`/${legacy}/ktm2/contents/isekaiseries`, `/${lang}/ktm2/modules/`],
      [`/${legacy}/ktm2/contents/wip`, `/${lang}/ktm2/roadmap/`],
      [`/${legacy}/ktm2/contents/lore`, `/${lang}/codex/`],
      [`/${legacy}/ktm2/contents/wiki/comfort`, `/${lang}/wiki/comfort/`],
      [`/${legacy}/ktm2/contents/wiki/element`, `/${lang}/wiki/elements/`],
      [`/${legacy}/ktm2/contents/wiki/forgery`, `/${lang}/wiki/forgery/`],
      [`/${legacy}/ktm2/contents/wiki/leveling`, `/${lang}/wiki/leveling/`],
      [`/${legacy}/ktm2/contents/wiki/skillslot`, `/${lang}/wiki/equipment-skills/`],
      [`/${legacy}/ktm2/contents/wiki/effects_and_attributes`, `/${lang}/wiki/attributes-and-effects/`],
    ];
    return pairs;
  })
);

// https://astro.build/config
export default defineConfig({
  site: 'https://kentomahou.com',
  /*
   * 'ignore' rather than 'always': every link this site generates already ends
   * in a slash, but the JSON and RSS endpoints are real files with extensions,
   * and 'always' makes the dev server demand a trailing slash for those too —
   * a URL that would then 404 in production.
   */
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // Content-hashed asset names so the CDN can cache aggressively.
    assets: '_assets',
  },
  image: {
    // Portraits are the largest images on the site; cap the widths we ever generate.
    responsiveStyles: true,
    layout: 'constrained',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  redirects: legacyRedirects,
  markdown: {
    rehypePlugins: [rehypeEnhance],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      wrap: false,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(LOCALES.map((locale) => [locale.code, locale.htmlLang])),
      },
      filter: (page) => !page.includes('/404'),
    }),
  ],
});
