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

// Scroll the largest windmill img into view, then capture viewport bbox.
const box = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  const wm = imgs.filter(i => i.src.includes('windmill.svg')).sort((a,b) => b.width - a.width)[0];
  if (!wm) return null;
  wm.scrollIntoView({ block: 'center' });
  const r = wm.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
});
if (!box) { console.log('[anim] windmill.svg not found in sandbox'); process.exit(1); }
await page.waitForTimeout(300);  // let scroll settle
console.log(`[anim] windmill bbox: ${JSON.stringify(box)}`);

const shot1 = join(SHOTS, 'anim-windmill-t0.png');
const shot2 = join(SHOTS, 'anim-windmill-t4s.png');

await page.screenshot({ path: shot1, clip: box });
console.log(`[anim] saved t=0 screenshot`);

// 4 seconds at 8s rotation = 180°, sails should be visibly different.
await page.waitForTimeout(4000);
await page.screenshot({ path: shot2, clip: box });
console.log(`[anim] saved t=4s screenshot`);

// Compare file sizes (PNG compression is content-sensitive; identical
// frames produce nearly-identical sizes).
const s1 = statSync(shot1).size;
const s2 = statSync(shot2).size;
const buf1 = readFileSync(shot1);
const buf2 = readFileSync(shot2);
const identical = buf1.length === buf2.length && buf1.equals(buf2);
console.log(`[anim] t0 size=${s1}B, t4s size=${s2}B, byte-identical=${identical}`);

if (identical) {
  console.log('[anim] ✗ FAIL — frames are byte-identical; animation not running');
  await browser.close();
  await server.stop();
  process.exit(1);
}
console.log('[anim] ✓ PASS — frames differ; sail animation active');

await browser.close();
await server.stop();
process.exit(0);
