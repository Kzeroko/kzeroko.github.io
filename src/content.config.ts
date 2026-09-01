import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

import { localeCodes } from './i18n';

const localeEnum = z.enum(['en', 'zh-cn']);

/** Files live at `<collection>/<lang>/<...slug>.mdx`; the language is part of the id. */
const contentGlob = (name: string) =>
  glob({
    base: `./src/content/${name}`,
    pattern: `{${localeCodes.join(',')}}/**/*.{md,mdx}`,
  });

const seo = z.object({
  /** Overrides the OG/Twitter title when the page title is too terse on its own. */
  ogTitle: z.string().optional(),
  noindex: z.boolean().default(false),
});

/* -------------------------------------------------------------------------- */
/* Wiki — player-facing system reference                                       */
/* -------------------------------------------------------------------------- */

const wikiCategories = ['core', 'combat', 'crafting', 'world'] as const;

const wiki = defineCollection({
  loader: contentGlob('wiki'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Groups the page in the sidebar and on the wiki index. */
    category: z.enum(wikiCategories),
    /** Sort weight inside its category; lower comes first. */
    order: z.number().default(100),
    /** Date the underlying game data was last verified against the mod source. */
    updated: z.coerce.date(),
    /** Short line shown on the wiki index card, when the description is too long. */
    tagline: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    seo: seo.optional(),
  }),
});

/* -------------------------------------------------------------------------- */
/* Codex — spoiler-free world canon                                            */
/* -------------------------------------------------------------------------- */

const codexKinds = ['world', 'character', 'faction', 'location', 'race'] as const;
const accents = ['teal', 'amber', 'violet', 'rose', 'green', 'azure'] as const;

const labelledValue = z.object({ label: z.string(), value: z.string() });

const characterSheet = z.object({
  /** Full ceremonial name; the entry `title` may use the short form. */
  fullName: z.string(),
  /** Title line under the name, e.g. "Observer of the Remote Sky Garden". */
  epithet: z.string(),
  /** One line the character would actually say, chosen to be legible cold. */
  quote: z.string(),
  /** Rows of the profile table. Free-form so entries can differ honestly. */
  profile: z.array(labelledValue).default([]),
  /** Named quirks; the body prose expands on them. */
  traits: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
  relations: z.array(z.object({ name: z.string(), note: z.string() })).default([]),
  timeline: z.array(z.object({ when: z.string(), what: z.string() })).default([]),
  /** Scene-tagged lines, drawn from the public layer of the character card. */
  voice: z.array(z.object({ scene: z.string(), line: z.string() })).default([]),
});

const codex = defineCollection({
  loader: contentGlob('codex'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Sentence that has to work on a card with no other context. */
      summary: z.string(),
      kind: z.enum(codexKinds),
      order: z.number().default(100),
      accent: z.enum(accents).default('teal'),
      portrait: image().optional(),
      /** Short tags rendered as chips on index cards. */
      chips: z.array(z.string()).default([]),
      character: characterSheet.optional(),
      draft: z.boolean().default(false),
      seo: seo.optional(),
    }),
});

/* -------------------------------------------------------------------------- */
/* Blog — devlog                                                               */
/* -------------------------------------------------------------------------- */

const blog = defineCollection({
  loader: contentGlob('blog'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      hero: image().optional(),
      heroAlt: z.string().optional(),
      /** Pins a post to the top of the index regardless of date. */
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      seo: seo.optional(),
    }),
});

/* -------------------------------------------------------------------------- */
/* Pages — standalone prose (about, legal, project sub-pages)                   */
/* -------------------------------------------------------------------------- */

const pages = defineCollection({
  loader: contentGlob('pages'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      eyebrow: z.string().optional(),
      hero: image().optional(),
      heroAlt: z.string().optional(),
      updated: z.coerce.date().optional(),
      /** Renders a table of contents rail next to the body. */
      toc: z.boolean().default(false),
      draft: z.boolean().default(false),
      seo: seo.optional(),
    }),
});

export const collections = { wiki, codex, blog, pages };
export { wikiCategories, codexKinds, accents, localeEnum };
