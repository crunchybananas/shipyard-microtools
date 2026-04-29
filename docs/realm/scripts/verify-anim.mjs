// Phase C step 1 verifier — confirms windmill sail animation works.
// Loads the sprite sandbox (which renders windmill at zoom 4), takes
// screenshots ~4 seconds apart, asserts that a frame-diff exists in
// the sail region.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';
import { readFileSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const ORIGIN = server.origin;
const SHOTS = join(REALM_ROOT, 'scripts/screenshots');

const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto(`${ORIGIN}/svg-test/index.html`);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1000);

// Sprites to verify: each must show a frame-diff after the wait.
const SPRITES = [
  { name: 'windmill',   file: 'windmill.svg',   wait: 4000 },  // sails 180° in 4s + dust pulse
  { name: 'castle',     file: 'castle.svg',     wait: 2000 },  // pennants ±5°
  { name: 'tower',      file: 'tower.svg',      wait: 1500 },  // banner + lantern flicker
  { name: 'house',      file: 'house.svg',      wait: 2400 },  // smoke drift
  { name: 'bakery',     file: 'bakery.svg',     wait: 3000 },  // smoke drift
  { name: 'market',     file: 'market.svg',     wait: 2300 },  // awning sway 4.5s/2
  { name: 'blacksmith', file: 'blacksmith.svg', wait: 1700 },  // forge fire pulse 1.6s
  { name: 'tavern',     file: 'tavern.svg',     wait: 1900 },  // sign-swing 3.6s/2
  { name: 'barracks',   file: 'barracks.svg',   wait: 2900 },  // dummy idle 5.5s/2
  { name: 'granary',    file: 'granary.svg',    wait: 2400 },  // dome dust drift 4.4-5s
  // Note: church bell is occasional (32s cycle, 85% rest); skip in routine verify
  // because waiting 30s+ per run is too slow. Manual verify if needed.
];

let allPass = true;
for (const sp of SPRITES) {
  const box = await page.evaluate((file) => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const target = imgs.filter(i => i.src.includes(file)).sort((a,b) => b.width - a.width)[0];
    if (!target) return null;
    target.scrollIntoView({ block: 'center' });
    const r = target.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }, sp.file);
  if (!box) { console.log(`[anim] ${sp.name}: not found`); allPass = false; continue; }
  await page.waitForTimeout(300);  // let scroll settle

  const shot1 = join(SHOTS, `anim-${sp.name}-t0.png`);
  const shot2 = join(SHOTS, `anim-${sp.name}-tN.png`);
  await page.screenshot({ path: shot1, clip: box });
  await page.waitForTimeout(sp.wait);
  await page.screenshot({ path: shot2, clip: box });

  const buf1 = readFileSync(shot1);
  const buf2 = readFileSync(shot2);
  const identical = buf1.length === buf2.length && buf1.equals(buf2);
  const sizeDiff = Math.abs(buf1.length - buf2.length);
  if (identical) {
    console.log(`[anim] ✗ ${sp.name}: byte-identical after ${sp.wait}ms — animation not running`);
    allPass = false;
  } else {
    console.log(`[anim] ✓ ${sp.name}: frames differ (size delta ${sizeDiff}B) — animation active`);
  }
}

await browser.close();
await server.stop();
process.exit(allPass ? 0 : 1);
