import rss from '@astrojs/rss';
import type { APIRoute, GetStaticPaths } from 'astro';

import { getLocale, localeCodes, useTranslations, type LocaleCode } from '../../../i18n';
import { blogPath, getBlogPosts } from '../../../lib/content';
import { SITE } from '../../../data/site';

/** One feed per language, at `/<lang>/blog/rss.xml`. */
export const getStaticPaths = (() => {
  return localeCodes.map((lang) => ({ params: { lang } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async (context) => {
  const lang = context.params.lang as LocaleCode;
  const t = useTranslations(lang);
  const posts = await getBlogPosts(lang);

  return rss({
    title: `${t('site.title')} — ${t('blog.title')}`,
    description: t('blog.lead'),
    site: context.site ?? SITE.url,
    trailingSlash: true,
    customData: `<language>${getLocale(lang).htmlLang}</language>`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: blogPath(lang, post),
      categories: post.data.tags,
    })),
  });
};
