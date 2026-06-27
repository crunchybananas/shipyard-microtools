// Painted-atlas live-game visual audit for the canonical 2D renderer.
// Captures the full buildable sprite roster at default zoom + closer zoom
// + dawn/midday/dusk/night lighting variants. Reports atlas state + page
// errors. Output PNGs land in scripts/screenshots/critic-*.png

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const SHOTS = join(REALM_ROOT, 'scripts/screenshots');
await mkdir(SHOTS, { recursive: true });

const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(`[console] ${m.text()}`); });

await page.goto(`${server.gameUrl}`);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

// Enter the game
const easy = await page.$('.diff-btn'); if (easy) await easy.click();
const start = await page.$('button:has-text("New Game"), #start-game-btn');
if (start) await start.click();
await page.waitForTimeout(1500);

// Place every live painted-atlas buildable type in a clustered settlement.
await page.evaluate(() => {
  window.G.buildings = [];
  window.G.citizens = [];
  window.G.soldiers = [];
  window.G.selectedBuild = null;
  window.G.selectedBuilding = null;
  window.G.hoveredTile = null;
  if (Array.isArray(window.G.buildingGrid)) {
    for (const row of window.G.buildingGrid) {
      if (Array.isArray(row)) row.fill(null);
    }
  }
  for (let y = 28; y <= 50; y++) {
    for (let x = 30; x <= 56; x++) {
      if (window.G.map?.[y]) window.G.map[y][x] = 2; // grass audit pad
    }
  }
  for (let y = 43; y <= 48; y++) {
    for (let x = 49; x <= 56; x++) {
      if (window.G.map?.[y]) window.G.map[y][x] = y >= 48 ? 0 : 1; // water + beach edge
    }
  }
  const types = [
    'castle', 'church', 'townhall', 'tower', 'windmill',
    'house', 'tavern', 'school', 'market', 'bakery',
    'blacksmith', 'barracks', 'archery', 'granary', 'well',
    'farm', 'lumber', 'quarry', 'mine', 'fisherman',
    'tradingpost', 'chickencoop', 'cowpen', 'wall', 'road',
  ];
  const addBuilding = (type, x, y, extra = {}) => {
    const b = {
      type, x, y,
      hp: 100, maxHp: 100,
      workers: [], assigned: [],
      buildProgress: 1,
      ...extra,
    };
    window.G.buildings.push(b);
    if (window.G.buildingGrid?.[y]) window.G.buildingGrid[y][x] = b;
    return b;
  };
  const startX = 34;
  const startY = 34;
  const cols = 5;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const cx = startX + (i % cols) * 4;
    const cy = startY + Math.floor(i / cols) * 3;
    addBuilding(t, cx, cy);
  }
  const wallCluster = [
    [41, 46], [42, 46], [43, 46],
    [42, 45], [42, 47], [43, 47],
  ];
  for (const [x, y] of wallCluster) {
    addBuilding('wall', x, y);
  }
  // Center camera on the cluster.
  if (window.G.camera) {
    window.G.camera.x = -70;
    window.G.camera.y = 1260;
    window.G.camera.zoom = 1.25;
  }
  window.G.photoMode = true;
  document.body.classList.add('photo-mode');
});
await page.waitForTimeout(1200);  // sprite preload + variant load

const cache = await page.evaluate(() => window.__realm.spriteCache());
console.log(`[critic] sprite cache: ${cache.length} entries (${cache.filter(c => c.state === 'ready').length} ready)`);

// 4 lighting variants. dayPhase ∈ [0, dayLength). Simulate dawn/midday/dusk/night.
const dayLen = await page.evaluate(() => window.G.dayLength || 3600);
const variants = [
  { name: 'dawn',    phase: dayLen * 0.05 },
  { name: 'midday',  phase: dayLen * 0.40 },
  { name: 'dusk',    phase: dayLen * 0.78 },
  { name: 'night',   phase: dayLen * 0.95 },
];

for (const v of variants) {
  await page.evaluate((p) => { window.G.dayPhase = p; }, v.phase);
  await page.waitForTimeout(400);
  const path = join(SHOTS, `critic-${v.name}.png`);
  await page.screenshot({ path });
  console.log(`[critic] saved critic-${v.name}.png (dayPhase=${v.phase.toFixed(0)}/${dayLen})`);
}

// Closer zoom for sprite detail
await page.evaluate(() => {
  window.G.camera.zoom = 2.2;
  window.G.dayPhase = 1500;  // back to mid-day
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(SHOTS, 'critic-zoom-close.png') });
console.log('[critic] saved critic-zoom-close.png (zoom 2.2)');

// Far zoom
await page.evaluate(() => { window.G.camera.zoom = 0.6; });
await page.waitForTimeout(600);
await page.screenshot({ path: join(SHOTS, 'critic-zoom-far.png') });
console.log('[critic] saved critic-zoom-far.png (zoom 0.6)');

// Dedicated connected-wall audit in 2D.
await page.evaluate(() => {
  window.G.season = 'spring';
  window.G.dayPhase = 1500;
  window.G.camera.x = (42 - 46) * 32;
  window.G.camera.y = (42 + 46) * 16;
  window.G.camera.zoom = 2.4;
});
await page.waitForTimeout(700);
await page.screenshot({ path: join(SHOTS, 'critic-walls-2d.png') });
console.log('[critic] saved critic-walls-2d.png');

// Same wall cluster with staged construction reveal.
await page.evaluate(() => {
  const stages = [
    [41, 46, 0.30],
    [42, 46, 0.50],
    [43, 46, 0.72],
    [42, 45, 0.45],
    [42, 47, 0.86],
    [43, 47, 0.62],
  ];
  for (const [x, y, progress] of stages) {
    const b = window.G.buildingGrid?.[y]?.[x];
    if (b?.type === 'wall') b.buildProgress = progress;
  }
});
await page.waitForTimeout(500);
await page.screenshot({ path: join(SHOTS, 'critic-walls-construction-2d.png') });
console.log('[critic] saved critic-walls-construction-2d.png');

await page.evaluate(() => {
  for (const b of window.G.buildings) {
    if (b.type === 'wall') b.buildProgress = 1;
  }
});

// Winter mode
await page.evaluate(() => {
  window.G.season = 'winter';
  window.G.camera.zoom = 1.4;
});
await page.waitForTimeout(500);
await page.screenshot({ path: join(SHOTS, 'critic-winter.png') });
console.log('[critic] saved critic-winter.png');

const realErrs = errs.filter(e => !/favicon/i.test(e));
console.log(`[critic] page errors: ${realErrs.length === 0 ? 'none' : realErrs.length}`);
if (realErrs.length) realErrs.slice(0, 5).forEach(e => console.log('   ', e));

await browser.close();
await server.stop();
process.exit(realErrs.length === 0 ? 0 : 1);
