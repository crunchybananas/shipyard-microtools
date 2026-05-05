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

// Cheat resources & defense and let the game run long enough for events to surface
await page.evaluate(() => {
  const G = window.G;
  if (!G) return;
  Object.assign(G.resources, { wood: 9999, stone: 9999, gold: 9999, food: 9999, iron: 9999 });
  G.defense = 999;
  G.nextRaidDay = 9999;
  G.speed = 4;
});
// Use the in-game fastForward (exposed at window) if available — it advances
// real day count without waiting for animation frames
await page.evaluate(() => {
  const ff = window.G?.debug?.fastForward;
  if (ff) ff(200);
});
await page.waitForTimeout(2000);

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
    citizens: (G.citizens || []).length,
    citizensDied: G.stats?.citizensDied,
    citizensBorn: G.stats?.citizensBorn,
    realmEnded: G.realmEnded,
    activeEvent: G.activeEvent?.name || null,
    happiness: G.happiness,
    tick: G.gameTick,
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
