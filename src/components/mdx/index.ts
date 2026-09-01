import Callout from './Callout.astro';
import Clip from './Clip.astro';
import ElementMatrix from './ElementMatrix.astro';
import Figure from './Figure.astro';
import Gallery from './Gallery.astro';
import LevelTable from './LevelTable.astro';
import SkillSlots from './SkillSlots.astro';
import Stats from './Stats.astro';
import Steps from './Steps.astro';

/**
 * Components available to every MDX body without an explicit import.
 *
 * Passed as `<Content components={mdxComponents} />` from the layouts. MDX
 * resolves capitalised identifiers it cannot find in scope against this map,
 * so content files stay free of boilerplate import blocks.
 *
 * Anything that needs a build-time image (`Figure`, `Gallery`, `Clip`) still
 * takes the imported `ImageMetadata` as a prop — the import has to live in the
 * MDX file for Astro to process the asset.
 */
export const mdxComponents = {
  Callout,
  Clip,
  ElementMatrix,
  Figure,
  Gallery,
  LevelTable,
  SkillSlots,
  Stats,
  Steps,
};

export type MdxComponents = typeof mdxComponents;
