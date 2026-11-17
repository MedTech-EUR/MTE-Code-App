#!/usr/bin/env node
/**
 * Makes the PNG images that browsers and social networks need, from files in public/:
 *
 *   public/favicon-32x32.png  32×32, the MedTech Europe figure from public/favicon.svg.
 *     The tab icon for browsers that do not use SVG icons.
 *   public/share-image.png    1200×630, the logo (public/logo.png) on white.
 *     The preview image when a page is shared on LinkedIn, Teams, etc. (og:image).
 *
 * public/favicon.svg is the figure from public/home-backdrop.svg, upright and in full colour,
 * in a square frame. Run this again only if the logo changes. It needs Playwright, which is
 * not a project dependency:
 *
 *   npm install --no-save playwright && npx playwright install chromium
 *   node scripts/make-brand-images.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PURPLE = '#7654A1'; // the brand purple (AGENTS.md, "Brand Colors")

const dataUrl = async (file, type) =>
  `data:${type};base64,${(await readFile(path.join(PUBLIC, file))).toString('base64')}`;

const images = [
  {
    out: 'favicon-32x32.png',
    width: 32,
    height: 32,
    transparent: true,
    html: async () => `<img src="${await dataUrl('favicon.svg', 'image/svg+xml')}" style="width:32px;height:32px">`,
  },
  {
    out: 'share-image.png',
    width: 1200,
    height: 630,
    // logo.png is 2305×239; at 960 px wide it is about 100 px high. The purple strip at the
    // bottom matches the share image of ethicalmedtech.eu.
    html: async () =>
      `<img src="${await dataUrl('logo.png', 'image/png')}" style="width:960px;height:auto">` +
      `<div style="position:absolute;left:0;right:0;bottom:0;height:16px;background:${PURPLE}"></div>`,
  },
];

const browser = await chromium.launch();
for (const img of images) {
  const page = await browser.newPage({ viewport: { width: img.width, height: img.height } });
  const background = img.transparent ? 'transparent' : '#fff';
  await page.setContent(
    `<body style="margin:0;width:${img.width}px;height:${img.height}px;background:${background};display:flex;align-items:center;justify-content:center;position:relative">${await img.html()}</body>`,
  );
  await page.screenshot({ path: path.join(PUBLIC, img.out), omitBackground: Boolean(img.transparent) });
  console.log(`[brand] public/${img.out} (${img.width}×${img.height})`);
}
await browser.close();
