/**
 * Generates the raster assets that live in `public/` and cannot be produced by
 * Astro's image pipeline: the social card, the touch icon and the maskable
 * PWA icon.
 *
 * Run with `npm run assets`. Output is committed, so a normal build does not
 * depend on this script.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asset = (path) => resolve(root, 'src/assets/images', path);
const out = (path) => resolve(root, 'public', path);

/**
 * Site icons, all derived from the pack icon so the browser tab, the touch
 * icon and the PWA icon are the same mark the header shows.
 */
async function icons() {
  for (const [size, name, palette] of [
    // The favicon is fetched on every page, so it is palette-quantised; the
    // installable icons keep full colour.
    [128, 'favicon.png', true],
    [180, 'apple-touch-icon.png', false],
    [512, 'icon-512.png', false],
  ]) {
    const png = await sharp(asset('ktm2/ktm2_iconr.webp'))
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9, palette })
      .toBuffer();
    await writeFile(out(name), png);
    console.log(`  ${name} (${size}×${size})`);
  }
}

/**
 * Social card: the night-shrine screenshot, darkened, with the KTM2 wordmark
 * and a caption line. 1200×630 is the size every platform crops from.
 */
async function socialCard() {
  const W = 1200;
  const H = 630;

  // The source screenshots carry a baked-in KTM2 watermark in the top-right
  // corner. Crop it out rather than letting it collide with the wordmark we
  // composite ourselves.
  const background = await sharp(asset('ktm2/ktm2_screenshot_2.webp'))
    .extract({ left: 0, top: 320, width: 2200, height: 1155 })
    .resize(W, H, { fit: 'cover' })
    .modulate({ brightness: 0.62 })
    .toBuffer();

  const wordmark = await sharp(asset('ktm2/ktm2_icon_txt.webp'))
    .resize({ width: 620, kernel: 'nearest' })
    .toBuffer();
  const wordmarkMeta = await sharp(wordmark).metadata();

  const scrim = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#070b12" stop-opacity="0.45"/>
          <stop offset="0.55" stop-color="#070b12" stop-opacity="0.72"/>
          <stop offset="1" stop-color="#070b12" stop-opacity="0.94"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#s)"/>
      <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#35e0c8"/>
    </svg>`);

  const caption = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <style>
        .k { font: 700 34px 'Segoe UI', Arial, sans-serif; fill: #eef4fb; letter-spacing: -0.5px; }
        .s { font: 400 24px 'Segoe UI', Arial, sans-serif; fill: #9fb6cc; }
      </style>
      <text class="k" x="80" y="${H - 118}">Kzeroko's Workshop</text>
      <text class="s" x="80" y="${H - 78}">Minecraft RPG development · kentomahou.com</text>
    </svg>`);

  const png = await sharp(background)
    .composite([
      { input: scrim, top: 0, left: 0 },
      {
        input: wordmark,
        top: Math.round(H / 2 - (wordmarkMeta.height ?? 180) / 2 - 40),
        left: 80,
      },
      { input: caption, top: 0, left: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();

  await writeFile(out('og-default.png'), png);
  console.log(`  og-default.png (${W}×${H})`);
}

/**
 * Watermark-free scene crops.
 *
 * The raw screenshots carry the KTM2 wordmark baked into the top-right corner,
 * which collides with the wordmark the hero composites itself. These derived
 * 16:9 crops keep the interesting part of each shot and drop that corner, and
 * are committed so a normal build never re-runs sharp on a 3200px source.
 */
async function scenes() {
  const derived = resolve(root, 'src/assets/images/ktm2/scenes');
  await mkdir(derived, { recursive: true });

  const CROPS = [
    {
      source: 'ktm2/ktm2_screenshot_2.webp',
      name: 'scene-shrine.webp',
      region: { left: 0, top: 0, width: 2000, height: 1125 },
    },
    {
      source: 'ktm2/ktm2_screenshot_1.webp',
      name: 'scene-temple.webp',
      region: { left: 0, top: 200, width: 2000, height: 1125 },
    },
  ];

  for (const crop of CROPS) {
    const buffer = await sharp(asset(crop.source))
      .extract(crop.region)
      .resize({ width: 1920 })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(resolve(derived, crop.name), buffer);
    console.log(`  scenes/${crop.name} (1920×1080)`);
  }
}

/**
 * Still posters for the recorded GIFs.
 *
 * Astro's image service keeps animation when it transcodes a GIF, so asking it
 * for a "poster" yields a full animated WebP — up to a megabyte, loaded before
 * the reader has decided to watch anything. These single-frame stills are what
 * `GifPlayer` shows until the clip is clicked.
 */
async function gifPosters() {
  const sourceDir = resolve(root, 'src/assets/images/ktm2/wiki/forgery');
  const posterDir = join(sourceDir, 'posters');
  await mkdir(posterDir, { recursive: true });

  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.gif') continue;

    const name = `${basename(entry.name, extname(entry.name))}.webp`;
    const buffer = await sharp(join(sourceDir, entry.name)) // page 0 by default
      .resize({ width: 900, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    await writeFile(join(posterDir, name), buffer);
    console.log(`  forgery/posters/${name} (${(buffer.length / 1024).toFixed(0)} kB)`);
  }
}

await mkdir(out('.'), { recursive: true });
console.log('Generating static assets:');
await icons();
await socialCard();
await scenes();
await gifPosters();
console.log('Done.');
