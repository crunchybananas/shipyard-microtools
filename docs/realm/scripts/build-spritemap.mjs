// Build a bitmap sprite atlas from the current SVG building roster.
//
// This intentionally uses the existing Playwright install from the verify
// scripts so the repo does not gain a heavyweight image dependency.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const OUT = join(REALM_ROOT, 'assets', 'sprites', 'buildings-atlas.png');

const TYPES = [
  'granary', 'castle', 'church', 'windmill',
  'tower', 'house', 'tavern', 'blacksmith',
  'market', 'bakery', 'barracks', 'townhall',
  'well',
];
const CELL = 128;
const COLS = 4;
const ROWS = Math.ceil(TYPES.length / COLS);

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: COLS * CELL, height: ROWS * CELL } });
const page = await context.newPage();
const assetBase = `${server.origin}/assets/sprites/`;

try {
  await page.goto(`${server.origin}/index.html`);
  await page.waitForLoadState('domcontentloaded');
  const dataUrl = await page.evaluate(async ({ types, cell, cols, assetBase }) => {
    const canvas = document.createElement('canvas');
    canvas.width = cols * cell;
    canvas.height = Math.ceil(types.length / cols) * cell;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${src}`));
      img.src = src;
    });

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const img = await loadImage(`${assetBase}${type}.svg`);
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * cell;
      ctx.drawImage(img, x, y, cell, cell);
    }

    return canvas.toDataURL('image/png');
  }, { types: TYPES, cell: CELL, cols: COLS, assetBase });

  await writeFile(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`[spritemap] wrote ${OUT}`);
  console.log(`[spritemap] ${TYPES.length} frames, ${COLS}x${ROWS}, ${CELL}px cells`);
} finally {
  await browser.close();
  await server.stop();
}
