import type { APIRoute, GetStaticPaths } from 'astro';

import { localeCodes, localePath, useTranslations, type LocaleCode } from '../../i18n';
import {
  blogPath,
  codexPath,
  getBlogPosts,
  getCodexEntries,
  getPages,
  getWikiPages,
  wikiPath,
  entrySlug,
} from '../../lib/content';
import { PRIMARY_NAV } from '../../data/site';
import type { SearchDoc } from '../../scripts/search';

/**
 * Build-time search index, one file per language.
 *
 * A pre-built JSON index beats shipping a search engine for a site this size:
 * the whole corpus is a few dozen documents, the file compresses well, and it
 * is fetched only when the reader actually opens the dialog.
 */
export const getStaticPaths = (() => {
  return localeCodes.map((lang) => ({ params: { lang } }));
}) satisfies GetStaticPaths;

/** Strips MDX syntax so the haystack is words, not markup. */
function toPlainText(source: string, limit = 1400): string {
  return source
    .replace(/^---[\s\S]*?---/, '') // frontmatter
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/<[^>]+>/g, ' ') // JSX and HTML tags
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1') // links keep their label
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
    .toLowerCase();
}

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as LocaleCode;
  const t = useTranslations(lang);

  const [wiki, codex, blog, pages] = await Promise.all([
    getWikiPages(lang),
    getCodexEntries(lang),
    getBlogPosts(lang),
    getPages(lang),
  ]);

  const docs: SearchDoc[] = [
    ...wiki.map((entry) => ({
      t: entry.data.title,
      d: entry.data.description,
      u: wikiPath(lang, entry),
      s: 'wiki' as const,
      k: toPlainText(
        `${entry.data.title} ${entry.data.description} ${entry.data.tags.join(' ')} ${entry.body ?? ''}`
      ),
    })),

    ...codex.map((entry) => ({
      t: entry.data.title,
      d: entry.data.summary,
      u: codexPath(lang, entry),
      s: 'codex' as const,
      c: entry.data.character?.epithet,
      k: toPlainText(
        [
          entry.data.title,
          entry.data.summary,
          entry.data.chips.join(' '),
          entry.data.character?.fullName ?? '',
          entry.data.character?.epithet ?? '',
          entry.data.character?.quote ?? '',
          entry.data.character?.traits.map((trait) => `${trait.title} ${trait.body}`).join(' ') ?? '',
          entry.body ?? '',
        ].join(' ')
      ),
    })),

    ...blog.map((entry) => ({
      t: entry.data.title,
      d: entry.data.description,
      u: blogPath(lang, entry),
      s: 'blog' as const,
      k: toPlainText(
        `${entry.data.title} ${entry.data.description} ${entry.data.tags.join(' ')} ${entry.body ?? ''}`
      ),
    })),

    ...pages.map((entry) => ({
      t: entry.data.title,
      d: entry.data.description,
      u: localePath(lang, entrySlug(entry)),
      s: 'page' as const,
      k: toPlainText(`${entry.data.title} ${entry.data.description} ${entry.body ?? ''}`),
    })),

    // Section landings are destinations too — "wiki" should find the wiki.
    ...PRIMARY_NAV.map((item) => ({
      t: item.label[lang],
      d: t('site.tagline'),
      u: localePath(lang, item.path),
      s: 'page' as const,
      k: `${item.label[lang]} ${item.path}`.toLowerCase(),
    })),
  ];

  return new Response(JSON.stringify(docs), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
