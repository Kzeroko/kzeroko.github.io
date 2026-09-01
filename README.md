<div align="center">

# kentomahou.com

**Kzeroko's Workshop** — personal site, devlog, and the official home of the
**KTM2** modpack and the **Isekai Series** mods.

[![Built with Astro](https://img.shields.io/badge/Built_with-Astro-ff5a03?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![Deployed on GitHub Pages](https://img.shields.io/badge/Deployed_on-GitHub_Pages-121013?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Kzeroko/kzeroko.github.io/actions)

**[kentomahou.com](https://kentomahou.com)**

</div>

---

## What is here

| Section | Path | Contents |
| --- | --- | --- |
| Home | `/{lang}/` | Landing page |
| KTM2 | `/{lang}/ktm2/` | Modpack overview, in-house modules, roadmap |
| Wiki | `/{lang}/wiki/` | Player-facing system reference, verified against the shipped mod data |
| Codex | `/{lang}/codex/` | Spoiler-free canon of Urdas, drawn from the KTM2 WorldDict public layer |
| Devlog | `/{lang}/blog/` | Development notes |
| About | `/{lang}/about/` | Licensing, channels, contact |

Everything exists in **English (`/en/`)** and **简体中文 (`/zh-cn/`)**. The two
languages are written separately rather than machine-translated, and `/` routes
new visitors by browser language while remembering the choice afterwards.

## Stack

- **Astro 5** with the Content Layer, MDX, sitemap and RSS. No UI framework.
- **Zero framework JavaScript.** Pages ship no runtime by default; the theme
  switch, search palette, scroll reveals, table-of-contents tracking and the
  GIF players are small vanilla TypeScript modules under `src/scripts/`.
- **Native cross-document view transitions** via CSS `@view-transition` — no
  client-side router.
- **Build-time search index** (`/{lang}/search.json`), fetched only when the
  search palette is opened. CJK queries are matched with overlapping bigrams.
- **Design tokens** in `src/styles/tokens.css`, with a light and dark palette
  sampled from the game's own art.

## Layout

```text
src/
├── assets/images/      Source images (Astro processes these at build time)
├── components/
│   ├── base/           Icon, Button, Reveal, SmartImage, GifPlayer
│   ├── cards/          LinkCard, PortraitCard, PostCard
│   ├── codex/          CharacterSheet, CharacterAppendix
│   ├── docs/           Sidebar, TableOfContents, Pager, Breadcrumbs
│   ├── home/           Hero
│   ├── layout/         Head, SiteHeader, SiteFooter, SearchDialog, …
│   └── mdx/            Components available to every MDX body without import
├── content/            wiki · codex · blog · pages, each split by language
├── data/               Typed site data: modules, roadmap, elements, level curves
├── i18n/               Locale list, UI strings, path helpers
├── layouts/            Base, Page, Docs, Article, Codex
├── lib/                Content queries and SEO helpers
├── pages/              Routes (`[lang]` dynamic, generated per language)
├── plugins/            Local rehype plugin (table wrapping, heading anchors)
├── scripts/            Client-side TypeScript modules
└── styles/             tokens · reset · base · prose · motion
```

## Working on it

```bash
npm install
npm run dev
```

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:4321` |
| `npm run build` | Typecheck (`astro check`) then build to `dist/` |
| `npm run build:fast` | Build without the typecheck |
| `npm run preview` | Serve the built output |
| `npm run assets` | Regenerate `public/` icons, the social card, and the watermark-free scene crops |

`npm run assets` output is committed, so an ordinary build never re-runs it.

### Adding content

Content files live at `src/content/<collection>/<lang>/<slug>.mdx`. Keep the
**same slug in both languages** — the language switcher relies on it, and a page
that genuinely has no counterpart should pass `translatedPaths` instead.

MDX bodies can use `Callout`, `Steps`, `Figure`, `Gallery`, `Clip`, `Stats`,
`ElementMatrix`, `LevelTable` and `SkillSlots` without importing them; the
layouts supply the component map. Anything taking an image still needs the
`import` so Astro can process the asset.

<details>
<summary>Chinese Markdown note</summary>

CommonMark cannot close emphasis between CJK punctuation and a CJK letter, so
`**先看图纸。**手持` renders literally. Put the full stop outside:
`**先看图纸**。手持`.

</details>

## Deployment

Pushing to `master` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. `CNAME` points the Pages site at
`kentomahou.com`.

## Licence

Site source is available for reference. Original art, models and textures are
all rights reserved — see [About](https://kentomahou.com/en/about/).

Not an official Minecraft product. Not approved by or associated with Mojang or
Microsoft.
