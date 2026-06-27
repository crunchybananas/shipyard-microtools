// Raster animation verifier. Confirms the live actor atlas is loaded,
// exposes eight frames, and has real per-frame bitmap motion in several
// role/action/direction rows.

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

await page.goto(`${server.gameUrl}`);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1200);

const start = await page.$('button:has-text("New Game"), #start-game-btn');
if (start) await start.click();
await page.waitForTimeout(1400);
await page.screenshot({ path: join(SHOTS, 'anim-live-actors.png'), fullPage: false });
await page.evaluate(() => {
  if (!window.G || !window.G.camera) return;
  window.G.camera.zoom = 2.2;
  window.forceRender?.();
});
await page.waitForTimeout(500);

const result = await page.evaluate(async () => {
  const atlasInfo = window.__realm?.actorAtlas?.();
  const img = new Image();
  img.decoding = 'async';
  img.src = `assets/sprites/actors-atlas.png?verify=${Date.now()}`;
  await img.decode();

  const frameW = 64;
  const frameH = 84;
  const frames = 8;
  const rows = [
    { label: 'settler walk down', row: 4 },
    { label: 'farmer work right', row: 27 },
    { label: 'guard carry left', row: 191 },
  ];
  const canvas = document.createElement('canvas');
  canvas.width = frameW * frames;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const rowReports = rows.map(({ label, row }) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, row * frameH, frameW * frames, frameH, 0, 0, frameW * frames, frameH);
    const diffs = [];
    for (let f = 0; f < frames - 1; f++) {
      const a = ctx.getImageData(f * frameW, 0, frameW, frameH).data;
      const b = ctx.getImageData((f + 1) * frameW, 0, frameW, frameH).data;
      let delta = 0;
      for (let i = 0; i < a.length; i += 4) {
        delta += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]);
      }
      diffs.push(delta);
    }
    return {
      label,
      minDelta: Math.min(...diffs),
      maxDelta: Math.max(...diffs),
      movingPairs: diffs.filter(d => d > 5000).length,
    };
  });

  return {
    atlasInfo,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    rowReports,
  };
});

await page.screenshot({ path: join(SHOTS, 'anim-live-actors-close.png'), fullPage: false });

let ok = true;
if (result.atlasInfo?.frames !== 8) ok = false;
if (result.naturalWidth !== 512 || result.naturalHeight !== 18816) ok = false;
for (const row of result.rowReports) {
  const pass = row.movingPairs >= 5 && row.minDelta > 1000;
  ok = ok && pass;
  console.log(`[anim] ${pass ? 'ok' : 'fail'} ${row.label}: minDelta=${row.minDelta} maxDelta=${row.maxDelta} movingPairs=${row.movingPairs}/7`);
}

const realErrs = errs.filter(e => !/favicon/i.test(e));
if (realErrs.length) {
  ok = false;
  console.log('[anim] page errors:');
  realErrs.slice(0, 8).forEach(e => console.log('  ', e));
} else {
  console.log('[anim] page errors: none');
}
console.log(`[anim] actor atlas ${result.naturalWidth}x${result.naturalHeight}, frames=${result.atlasInfo?.frames}`);
console.log('[anim] saved screenshots/anim-live-actors.png');
console.log('[anim] saved screenshots/anim-live-actors-close.png');

await browser.close();
await server.stop();
process.exit(ok ? 0 : 1);
