// 238 the-screenshot-critic: comprehensive live-game visual audit.
// Captures the full 11-sprite grid at default zoom + closer zoom +
// dawn/midday/dusk/night lighting variants. Reports cache state +
// page errors. Output PNGs land in scripts/screenshots/critic-*.png

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const SHOTS = join(REALM_ROOT, 'scripts/screenshots');

const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(`[console] ${m.text()}`); });

await page.goto(`${server.origin}/index.html`);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

// Enter the game
const easy = await page.$('.diff-btn'); if (easy) await easy.click();
const start = await page.$('button:has-text("New Game"), #start-game-btn');
if (start) await start.click();
await page.waitForTimeout(1500);

// Place all 11 sprite-bearing types in a clustered settlement.
await page.evaluate(() => {
  window.G.buildings = window.G.buildings || [];
  // Two rows of 6 + 5 buildings near map center
  const types = ['castle', 'church', 'tower', 'windmill', 'tavern', 'barracks',
                 'house', 'house', 'granary', 'market', 'bakery', 'blacksmith'];
  let cx = 36, cy = 36;
  for (const t of types) {
    window.G.buildings.push({
      type: t, x: cx, y: cy,
      hp: 100, maxHp: 100,
      workers: [], assigned: [],
      buildProgress: 1,
    });
    cx += 3;
    if (cx > 50) { cx = 36; cy += 3; }
  }
  // Center camera on the cluster.
  if (window.G.camera) {
    window.G.camera.x = 0;
    window.G.camera.y = 1280;
    window.G.camera.zoom = 1.4;
  }
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
