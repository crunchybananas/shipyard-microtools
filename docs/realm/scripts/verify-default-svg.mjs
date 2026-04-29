// Phase B step 6 verifier — confirms _USE_SVG_SPRITES = true is the
// default. Loads game, places buildings, screenshots WITHOUT calling
// toggleSVG. SVG sprites should render directly.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const ORIGIN = server.origin;
const GAME_PATH = `${ORIGIN}/index.html`;
const SHOTS = join(REALM_ROOT, 'scripts/screenshots');

const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(`[console] ${m.text()}`); });

await page.goto(GAME_PATH);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

const easy = await page.$('.diff-btn'); if (easy) await easy.click();
const start = await page.$('button:has-text("New Game"), #start-game-btn');
if (start) await start.click();
await page.waitForTimeout(1500);

// Probe: is the flag default true now?
const probe = await page.evaluate(() => {
  if (!window.__realm) return { ok: false, reason: 'no __realm' };
  const cache = window.__realm.spriteCache();
  return { ok: true, cacheSize: cache.length, cache };
});
console.log('[default-svg] sprite cache after init:', probe);

// Place all 11 sprite-bearing types on screen
await page.evaluate(() => {
  window.G.buildings = window.G.buildings || [];
  const types = ['granary', 'castle', 'church', 'windmill', 'tower', 'house', 'tavern', 'blacksmith', 'market', 'bakery', 'barracks', 'townhall'];
  let cx = 35, cy = 35;
  for (const t of types) {
    window.G.buildings.push({
      type: t, x: cx, y: cy,
      hp: 100, maxHp: 100,
      workers: [], assigned: [],
      buildProgress: 1,
    });
    cx += 3;
    if (cx > 50) { cx = 35; cy += 3; }
  }
  if (window.G.camera) {
    window.G.camera.x = 64;
    window.G.camera.y = 1248;
    window.G.camera.zoom = 1.6;
  }
});
await page.waitForTimeout(1200);  // let lazy variants finish loading

await page.screenshot({ path: join(SHOTS, 'phaseb-default-svg.png') });
console.log('[default-svg] saved phaseb-default-svg.png — should show SVG sprites without any toggle call');

// Confirm cache shows kname-specific entries (per-realm variants triggered)
const finalCache = await page.evaluate(() => window.__realm.spriteCache());
const knameCacheCount = finalCache.filter(c => c.type.includes('__') && !c.type.endsWith('__')).length;
console.log(`[default-svg] cache has ${finalCache.length} total entries; ${knameCacheCount} are per-kingdom variants`);

console.log('\n[default-svg] === PAGE ERRORS ===');
const realErrs = errs.filter(e => !/favicon/i.test(e));
if (realErrs.length === 0) {
  console.log('  (none)');
} else {
  realErrs.slice(0, 10).forEach(e => console.log('  ', e));
}

await browser.close();
await server.stop();
process.exit(realErrs.length === 0 ? 0 : 1);
