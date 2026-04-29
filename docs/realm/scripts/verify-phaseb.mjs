// Phase B step 1 verifier — confirms the scaffolding loads cleanly,
// that the toggle works, and that flipping the flag doesn't crash.

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

// Default headless. HEADED=1 to see the window.
const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(`[console] ${m.text()}`); });

console.log('[phaseb] loading game…');
await page.goto(GAME_PATH);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

// Enter the game
const easy = await page.$('.diff-btn'); if (easy) await easy.click();
const newGame = await page.$('button:has-text("New Game"), #start-game-btn');
if (newGame) await newGame.click();
await page.waitForTimeout(1500);

// Build a row of sprite-eligible structures across the screen + center
// camera on them so we can visually compare flag-on vs flag-off.
const placed = await page.evaluate(async () => {
  if (typeof window.G === 'undefined') return { ok: false };
  window.G.buildings = window.G.buildings || [];
  const types = ['granary', 'castle', 'church', 'windmill', 'tower', 'house', 'tavern', 'blacksmith', 'market', 'bakery', 'barracks'];
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
  // Center camera on tile (40, 38) using iso projection.
  // screenX = (cx - cy) * TW/2 = (40-38) * 32 = 64
  // screenY = (cx + cy) * TH/2 = (40+38) * 16 = 1248
  if (window.G.camera) {
    window.G.camera.x = 64;
    window.G.camera.y = 1248;
    window.G.camera.zoom = 1.6;
  }
  return { ok: true, count: window.G.buildings.length };
});
console.log(`[phaseb] placed ${placed.count} buildings, centered camera`);
await page.waitForTimeout(800);

await page.screenshot({ path: join(SHOTS, 'phaseb-flag-off.png') });
console.log('[phaseb] saved phaseb-flag-off.png (flag default = false; canvas drawGranary)');

// Flip the SVG flag and reload caches.
const flipped = await page.evaluate(() => {
  if (!window.__realm || !window.__realm.toggleSVG) return { ok: false, reason: 'no __realm.toggleSVG' };
  const result = window.__realm.toggleSVG(true);
  return { ok: true, flagState: result };
});
console.log(`[phaseb] toggleSVG(true) → ${JSON.stringify(flipped)}`);

// Wait for sprites to preload + render
await page.waitForTimeout(2500);

const cache = await page.evaluate(() => window.__realm.spriteCache());
console.log(`[phaseb] sprite cache after toggle:`, cache);

await page.screenshot({ path: join(SHOTS, 'phaseb-flag-on.png') });
console.log('[phaseb] saved phaseb-flag-on.png (flag = true; SVG path active)');

// Toggle back off and verify
await page.evaluate(() => window.__realm.toggleSVG(false));
await page.waitForTimeout(500);
await page.screenshot({ path: join(SHOTS, 'phaseb-flag-back-off.png') });
console.log('[phaseb] saved phaseb-flag-back-off.png (toggled back; canvas again)');

// Winter mode test — verify _WINTER_CAPS compose on SVG path (218 step 3).
// Force G.season=winter on both paths and screenshot.
await page.evaluate(() => { window.G.season = 'winter'; });
await page.waitForTimeout(300);
await page.screenshot({ path: join(SHOTS, 'phaseb-winter-canvas.png') });
console.log('[phaseb] saved phaseb-winter-canvas.png (winter + canvas)');

await page.evaluate(() => window.__realm.toggleSVG(true));
await page.waitForTimeout(800);
await page.screenshot({ path: join(SHOTS, 'phaseb-winter-svg.png') });
console.log('[phaseb] saved phaseb-winter-svg.png (winter + SVG; caps should compose on top)');

// Page errors
console.log('\n[phaseb] === PAGE ERRORS ===');
const realErrs = errs.filter(e => !/favicon/i.test(e));
if (realErrs.length === 0) {
  console.log('  (none)');
} else {
  realErrs.slice(-10).forEach(e => console.log('  ', e));
}

await browser.close();
await server.stop();
process.exit(realErrs.length === 0 ? 0 : 1);
