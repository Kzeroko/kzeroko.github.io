import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

import { isLocale, localePath, type LocaleCode } from '../i18n';

/** Drafts are visible while running `astro dev`, hidden in production builds. */
const SHOW_DRAFTS = import.meta.env.DEV;

/**
 * Entry ids are `<lang>/<...slug>`. Splitting here keeps that convention in one
 * place, so changing the on-disk layout later touches a single function.
 */
export function parseEntryId(id: string): { lang: LocaleCode; slug: string } {
  const [head = '', ...rest] = id.split('/');
  if (!isLocale(head)) {
    throw new Error(
      `Content id "${id}" is not language-prefixed. Move the file under a "<lang>/" directory.`
    );
  }
  return { lang: head, slug: rest.join('/') };
}

export function entrySlug(entry: { id: string }): string {
  return parseEntryId(entry.id).slug;
}

/** Every collection in this project carries an optional `draft` flag. */
type Draftable = { id: string; data: { draft?: boolean } };

function published<T extends Draftable>(entries: T[]): T[] {
  return SHOW_DRAFTS ? entries : entries.filter((entry) => !entry.data.draft);
}

async function localised<K extends CollectionKey>(
  collection: K,
  lang: LocaleCode
): Promise<CollectionEntry<K>[]> {
  const entries = await getCollection(collection, (entry: { id: string }) =>
    entry.id.startsWith(`${lang}/`)
  );
  return published(entries as unknown as Draftable[]) as unknown as CollectionEntry<K>[];
}

/* ----------------------------------------------------------------- wiki -- */

export type WikiEntry = CollectionEntry<'wiki'>;

const WIKI_CATEGORY_ORDER = ['core', 'combat', 'crafting', 'world'] as const;
export type WikiCategory = (typeof WIKI_CATEGORY_ORDER)[number];

export async function getWikiPages(lang: LocaleCode): Promise<WikiEntry[]> {
  const entries = await localised('wiki', lang);
  return entries.sort(
    (a, b) =>
      WIKI_CATEGORY_ORDER.indexOf(a.data.category) - WIKI_CATEGORY_ORDER.indexOf(b.data.category) ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title)
  );
}

export interface WikiGroup {
  category: WikiCategory;
  entries: WikiEntry[];
}

/** Wiki pages grouped for the sidebar, preserving the canonical category order. */
export async function getWikiGroups(lang: LocaleCode): Promise<WikiGroup[]> {
  const pages = await getWikiPages(lang);
  return WIKI_CATEGORY_ORDER.map((category) => ({
    category,
    entries: pages.filter((entry) => entry.data.category === category),
  })).filter((group) => group.entries.length > 0);
}

/* ---------------------------------------------------------------- codex -- */

export type CodexEntry = CollectionEntry<'codex'>;
export type CodexKind = CodexEntry['data']['kind'];

export const CODEX_SECTIONS = ['world', 'character', 'faction', 'location', 'race'] as const;

export async function getCodexEntries(lang: LocaleCode, kind?: CodexKind): Promise<CodexEntry[]> {
  const entries = await localised('codex', lang);
  return entries
    .filter((entry) => !kind || entry.data.kind === kind)
    .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

export async function getCodexSections(lang: LocaleCode) {
  const entries = await getCodexEntries(lang);
  return CODEX_SECTIONS.map((kind) => ({
    kind,
    entries: entries.filter((entry) => entry.data.kind === kind),
  })).filter((section) => section.entries.length > 0);
}

/* ----------------------------------------------------------------- blog -- */

export type BlogEntry = CollectionEntry<'blog'>;

export async function getBlogPosts(lang: LocaleCode): Promise<BlogEntry[]> {
  const entries = await localised('blog', lang);
  return entries.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/** Featured posts first, then reverse-chronological — used by the blog index. */
export async function getRankedBlogPosts(lang: LocaleCode): Promise<BlogEntry[]> {
  const posts = await getBlogPosts(lang);
  return [...posts].sort(
    (a, b) => Number(b.data.featured) - Number(a.data.featured) || b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
}

/**
 * URL form of a tag. Whitespace becomes a hyphen and case is normalised;
 * non-Latin tags are left intact and percent-encoded by the browser.
 */
export function tagSlug(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

export async function getBlogTags(lang: LocaleCode): Promise<{ tag: string; count: number }[]> {
  const posts = await getBlogPosts(lang);
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ---------------------------------------------------------------- pages -- */

export type PageEntry = CollectionEntry<'pages'>;

export async function getPages(lang: LocaleCode): Promise<PageEntry[]> {
  return localised('pages', lang);
}

export async function getPageBySlug(lang: LocaleCode, slug: string): Promise<PageEntry | undefined> {
  const pages = await getPages(lang);
  return pages.find((page) => entrySlug(page) === slug);
}

/* ----------------------------------------------------------------- urls -- */

const SECTION_BY_COLLECTION = {
  wiki: 'wiki',
  codex: 'codex',
  blog: 'blog',
} as const;

export function collectionPath(
  collection: keyof typeof SECTION_BY_COLLECTION,
  lang: LocaleCode,
  slug: string
): string {
  return localePath(lang, SECTION_BY_COLLECTION[collection], slug);
}

export function wikiPath(lang: LocaleCode, entry: { id: string }): string {
  return collectionPath('wiki', lang, entrySlug(entry));
}

export function codexPath(lang: LocaleCode, entry: { id: string }): string {
  return collectionPath('codex', lang, entrySlug(entry));
}

export function blogPath(lang: LocaleCode, entry: { id: string }): string {
  return collectionPath('blog', lang, entrySlug(entry));
}

export function blogTagPath(lang: LocaleCode, tag: string): string {
  return localePath(lang, 'blog/tags', tagSlug(tag));
}

/* ------------------------------------------------------- static path help -- */

/**
 * Builds `getStaticPaths` entries for one language-scoped collection.
 * Slugs are shared across languages, which is what makes the language
 * switcher able to stay on the same page.
 */
export async function localisedPaths<K extends 'wiki' | 'codex' | 'blog' | 'pages'>(
  collection: K,
  langs: readonly LocaleCode[]
) {
  const all = await getCollection(collection);
  return published(all)
    .map((entry) => {
      const { lang, slug } = parseEntryId(entry.id);
      return { lang, slug, entry };
    })
    .filter(({ lang }) => langs.includes(lang))
    .map(({ lang, slug, entry }) => ({
      params: { lang, slug },
      props: { entry },
    }));
}
