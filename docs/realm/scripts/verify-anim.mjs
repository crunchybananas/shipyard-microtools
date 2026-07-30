// Raster animation verifier. Confirms the live actor atlas is loaded,
// exposes eight frames, and has real per-frame bitmap motion in several
// role/action/direction rows.

import { chromium } from '@playwright/test';
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

await page.goto(`${server.gameUrl}?runtimecapture=1&v=anim-verify-${Date.now()}`);
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

// Runtime capture is a browser-inspection hook, not a recorder. It should
// publish once, remain still during gameplay, and refresh only when asked.
await page.waitForFunction(() => document.getElementById('realm-runtime-capture')?.dataset.tick != null);
const passiveCaptureBefore = await page.evaluate(() => {
  const sink = document.getElementById('realm-runtime-capture');
  return { tick: sink?.dataset.tick, srcLength: sink?.src?.length || 0 };
});
await page.waitForTimeout(950);
const passiveCaptureAfter = await page.evaluate(() => {
  const sink = document.getElementById('realm-runtime-capture');
  return { tick: sink?.dataset.tick, srcLength: sink?.src?.length || 0 };
});
const explicitCapture = await page.evaluate(async () => {
  const before = document.getElementById('realm-runtime-capture')?.dataset.tick;
  const data = await window.captureRealmFrame?.();
  const sink = document.getElementById('realm-runtime-capture');
  return {
    before,
    after: sink?.dataset.tick,
    dataLength: data?.length || 0,
  };
});

const result = await page.evaluate(async () => {
  const renderModule = await import('./js/render.js?realm=178');
  const { ACTOR_REGISTRATION } = await import('./js/actor-registration.js?realm=178');
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
    { label: 'miner work down', row: 72 },
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

  const ambient = new Image();
  ambient.decoding = 'async';
  ambient.src = `assets/sprites/ambient-atlas.png?verify=${Date.now()}`;
  await ambient.decode();
  const ambientCanvas = document.createElement('canvas');
  ambientCanvas.width = 48;
  ambientCanvas.height = 48;
  const ambientCtx = ambientCanvas.getContext('2d', { willReadFrequently: true });
  const ambientReports = [
    { type: 'deer', cell: 4 },
    { type: 'cow', cell: 5 },
    { type: 'chicken', cell: 6 },
  ].map(({ type, cell }) => {
    ambientCtx.clearRect(0, 0, 48, 48);
    ambientCtx.drawImage(ambient, cell * 48, 0, 48, 48, 0, 0, 48, 48);
    const data = ambientCtx.getImageData(0, 0, 48, 48).data;
    let visible = 0, transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 24) visible++;
      if (data[i] === 0) transparent++;
    }
    return { type, visible, transparent };
  });

  const animationProbe = {};
  window.G.gameTick = 100;
  const idle0 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'idle');
  window.G.gameTick = 122;
  const idle1 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'idle');
  window.G.gameTick = 123;
  const walk0 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'walk', { isMoving: true });
  window.G.gameTick = 130;
  const walk1 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'walk', { isMoving: true });
  window.G.gameTick = 131;
  const carryHold0 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'carry');
  window.G.gameTick = 200;
  const carryHold1 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'carry');
  window.G.gameTick = 201;
  const carryMove0 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'carry', { isMoving: true });
  window.G.gameTick = 208;
  const carryMove1 = renderModule.actorAnimationFrame(animationProbe, 'miner', 'carry', { isMoving: true });

  return {
    atlasInfo,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    rowReports,
    ambientWidth: ambient.naturalWidth,
    ambientHeight: ambient.naturalHeight,
    ambientReports,
    registrationsHaveNoScale: Object.values(ACTOR_REGISTRATION).every((entry) => !Object.hasOwn(entry, 's')),
    animationFrames: { idle0, idle1, walk0, walk1, carryHold0, carryHold1, carryMove0, carryMove1 },
  };
});

await page.screenshot({ path: join(SHOTS, 'anim-live-actors-close.png'), fullPage: false });

let ok = true;
if (result.atlasInfo?.frames !== 8) ok = false;
if (result.naturalWidth !== 512 || result.naturalHeight !== 18816) ok = false;
const passiveCaptureStable = passiveCaptureBefore.tick === passiveCaptureAfter.tick &&
  passiveCaptureBefore.srcLength === passiveCaptureAfter.srcLength && passiveCaptureBefore.srcLength > 1000;
const explicitCaptureWorked = explicitCapture.dataLength > 1000 &&
  Number(explicitCapture.after) >= Number(explicitCapture.before);
ok = ok && passiveCaptureStable && explicitCaptureWorked;
console.log(`[anim] ${passiveCaptureStable ? 'ok' : 'fail'} runtime capture remains idle without a request: tick=${passiveCaptureBefore.tick}`);
console.log(`[anim] ${explicitCaptureWorked ? 'ok' : 'fail'} explicit runtime capture: ${explicitCapture.before} -> ${explicitCapture.after}`);

const framePolicy = result.animationFrames.idle0 === 0 && result.animationFrames.idle1 === 1 &&
  result.animationFrames.walk0 === 0 && result.animationFrames.walk1 === 1 &&
  result.animationFrames.carryHold0 === 0 && result.animationFrames.carryHold1 === 0 &&
  result.animationFrames.carryMove0 === 0 && result.animationFrames.carryMove1 === 1;
ok = ok && framePolicy && result.registrationsHaveNoScale;
console.log(`[anim] ${framePolicy ? 'ok' : 'fail'} action epochs + idle/carry frame policy: ${JSON.stringify(result.animationFrames)}`);
console.log(`[anim] ${result.registrationsHaveNoScale ? 'ok' : 'fail'} actor registration contains anchor offsets only`);

const ambientDimensions = result.ambientWidth === 336 && result.ambientHeight === 48;
ok = ok && ambientDimensions;
console.log(`[anim] ${ambientDimensions ? 'ok' : 'fail'} ambient atlas ${result.ambientWidth}x${result.ambientHeight}`);
for (const sprite of result.ambientReports) {
  const pass = sprite.visible > 80 && sprite.transparent > 500;
  ok = ok && pass;
  console.log(`[anim] ${pass ? 'ok' : 'fail'} ${sprite.type} atlas cell: visible=${sprite.visible} transparent=${sprite.transparent}`);
}
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
