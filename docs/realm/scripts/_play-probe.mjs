// Play the game for a bit and take screenshots. Helps me see what's
// actually rough when I can't run a full Chrome session. Outputs go
// to /tmp/realm-probe-*.png so I don't pollute scripts/screenshots.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { ensureServer } from './_serve.mjs';
import { writeFile } from 'node:fs/promises';

const server = await ensureServer();
const ORIGIN = server.origin;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
page.on('console', m => consoleMsgs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', e => pageErrors.push(e.message));

await page.goto(`${ORIGIN}/index.html`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

// Title screen → start a new game. Try a few selectors.
const startedNew = await page.evaluate(() => {
  const candidates = ['#title-start-new', '.title-btn.primary', '[onclick*="newGame"]', '.title-btn'];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) { el.click(); return sel; }
  }
  if (typeof window.newGame === 'function') { window.newGame(); return 'window.newGame()'; }
  return null;
});
console.log(`[probe] started new via: ${startedNew}`);
await page.waitForTimeout(1500);

// Snapshot the default 3D diorama view immediately after game start
const shot1 = await page.screenshot({ fullPage: false });
await writeFile('/tmp/realm-probe-1-start-3d.png', shot1);

// Toggle to 2D, screenshot
await page.evaluate(() => window.toggle3D && window.toggle3D());
await page.waitForTimeout(500);
const shot2 = await page.screenshot({ fullPage: false });
await writeFile('/tmp/realm-probe-2-2d-fresh.png', shot2);

// Cheat resources, then place a starter settlement near spawn
await page.evaluate(() => {
  const G = window.G;
  if (!G) return;
  Object.assign(G.resources, { wood: 9999, stone: 9999, gold: 9999, food: 9999, iron: 9999 });
  G.speed = 4;
  // Find a flat spot near the castle to plant a settlement
  const castle = G.buildings.find(b => b.type === 'castle') || { x: 40, y: 30 };
  const layout = [
    ['house',     -3, -2], ['house',     -1, -2], ['house',     1, -2],
    ['farm',      -3,  1], ['farm',       0,  2],
    ['lumber',     3,  1],
    ['well',      -1,  0],
    ['granary',    2, -1],
  ];
  for (const [type, dx, dy] of layout) {
    const tx = Math.max(0, Math.min(79, castle.x + dx));
    const ty = Math.max(0, Math.min(79, castle.y + dy));
    // Try every realm-internal placement helper
    const fn = window.placeBuilding || window.__realm?.placeBuilding;
    if (fn) {
      try { fn(type, tx, ty); } catch {}
    }
  }
});
await page.waitForTimeout(8000); // ~32 sim seconds at speed 4

const shot3 = await page.screenshot({ fullPage: false });
await writeFile('/tmp/realm-probe-3-2d-after-sim.png', shot3);

// Back to 3D after some sim time
await page.evaluate(() => window.toggle3D && window.toggle3D());
await page.waitForTimeout(500);
const shot4 = await page.screenshot({ fullPage: false });
await writeFile('/tmp/realm-probe-4-3d-after-sim.png', shot4);

// Inspect runtime state
const stateInfo = await page.evaluate(() => {
  const G = window.G || {};
  return {
    day: G.day,
    population: G.population,
    maxPop: G.maxPop,
    buildings: (G.buildings || []).length,
    citizens: (G.citizens || []).length,
    enemies: (G.enemies || []).length,
    soldiers: (G.soldiers || []).length,
    resources: G.resources,
    happiness: G.happiness,
    tick: G.gameTick,
    speed: G.speed,
    realmEnded: G.realmEnded,
    fps: window.__realm?.fps || null,
    spriteMode: typeof window.__realm?.spriteMode === 'function' ? window.__realm.spriteMode() : null,
  };
});
console.log('[probe] state:', JSON.stringify(stateInfo, null, 2));
console.log(`[probe] page errors: ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 10)) console.log('  ✗', e);
console.log(`[probe] console msgs: ${consoleMsgs.length}`);
const interesting = consoleMsgs.filter(m => /error|warn|failed|nan|undefined|cannot/i.test(m));
for (const m of interesting.slice(0, 20)) console.log('  !', m);

await browser.close();
await server.stop();
console.log('[probe] screenshots: /tmp/realm-probe-{1..4}.png');
