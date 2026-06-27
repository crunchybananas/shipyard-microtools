// Exhaustive runtime actor-atlas verifier.
//
// This opens Actor Muster on the real game canvas, walks every responsive
// muster page, and inspects all 224 role/action/direction rows (1,792 frames)
// from the exact runtime atlas used by citizens.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  ACTIONS,
  ACTOR_ATLAS_H,
  ACTOR_ATLAS_W,
  DIRS,
  FRAME_H,
  FRAME_W,
  FRAMES,
  ROLES,
  actorRowKey,
} from './sprite-source-contract.mjs';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOTS = join(ROOT, 'scripts', 'screenshots');
const REPORT_PATH = join(SHOTS, 'all-sprite-maps-report.json');
const server = await ensureServer();
const headless = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(`[console] ${message.text()}`);
});

await page.goto(`${server.gameUrl}?spritemuster=1&verify=${Date.now()}`);
await page.waitForLoadState('domcontentloaded');
await page.waitForFunction(() => window.__realm?.spriteMuster?.report?.().ready === true);

const runtime = await page.evaluate(async ({ roles, actions, dirs, frameW, frameH, frames }) => {
  const atlasInfo = window.__realm.actorAtlas();
  const image = new Image();
  image.decoding = 'async';
  image.src = `assets/sprites/actors-atlas.png?allmaps=${Date.now()}`;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = frameW * frames;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const reports = [];
  const addressFailures = [];

  function frameHash(data) {
    let hash = 2166136261;
    for (let index = 0; index < data.length; index++) {
      hash ^= data[index];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
    const role = roles[roleIndex];
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      const action = actions[actionIndex];
      for (let dirIndex = 0; dirIndex < dirs.length; dirIndex++) {
        const dir = dirs[dirIndex];
        const row = (roleIndex * actions.length + actionIndex) * dirs.length + dirIndex;
        const expectedY = row * frameH;
        const rect = window.__realm.actorFrameRect(role, action, dir, 0);
        if (!rect || rect.row !== row || rect.sy !== expectedY) {
          addressFailures.push({ role, action, dir, expectedRow: row, rect });
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, expectedY, canvas.width, frameH, 0, 0, canvas.width, frameH);
        const frameReports = [];
        const hashes = [];
        const pairDeltas = [];
        let previous = null;

        for (let frame = 0; frame < frames; frame++) {
          const pixels = ctx.getImageData(frame * frameW, 0, frameW, frameH).data;
          let alphaPixels = 0;
          let edgePixels = 0;
          for (let y = 0; y < frameH; y++) {
            for (let x = 0; x < frameW; x++) {
              const alpha = pixels[(y * frameW + x) * 4 + 3];
              if (alpha <= 20) continue;
              alphaPixels++;
              if (x === 0 || y === 0 || x === frameW - 1 || y === frameH - 1) edgePixels++;
            }
          }
          const hash = frameHash(pixels);
          hashes.push(hash);
          frameReports.push({ frame, alphaPixels, edgePixels, hash });
          if (previous) {
            let delta = 0;
            for (let index = 0; index < pixels.length; index += 4) {
              delta += Math.abs(previous[index] - pixels[index]);
              delta += Math.abs(previous[index + 1] - pixels[index + 1]);
              delta += Math.abs(previous[index + 2] - pixels[index + 2]);
              delta += Math.abs(previous[index + 3] - pixels[index + 3]);
            }
            pairDeltas.push(delta);
          }
          previous = pixels;
        }

        reports.push({
          key: `${role}/${action}/${dir}`,
          role,
          action,
          dir,
          row,
          uniqueFrames: new Set(hashes).size,
          movingPairs: pairDeltas.filter((delta) => delta > 1000).length,
          minPairDelta: pairDeltas.length ? Math.min(...pairDeltas) : 0,
          maxPairDelta: pairDeltas.length ? Math.max(...pairDeltas) : 0,
          blankFrames: frameReports.filter((item) => item.alphaPixels === 0).map((item) => item.frame),
          maxEdgePixels: Math.max(...frameReports.map((item) => item.edgePixels)),
          frames: frameReports,
        });
      }
    }
  }

  const mappingCases = [
    ['settler', {}],
    ['farmer', { jobBuilding: { type: 'farm' } }],
    ['rancher', { jobBuilding: { type: 'chickencoop' } }],
    ['lumber', { jobBuilding: { type: 'lumber' } }],
    ['miner', { jobBuilding: { type: 'mine' } }],
    ['stonecutter', { jobBuilding: { type: 'quarry' } }],
    ['fisher', { jobBuilding: { type: 'fisherman' } }],
    ['trader', { jobBuilding: { type: 'market' } }],
    ['innkeeper', { jobBuilding: { type: 'tavern' } }],
    ['builder', { jobBuilding: { type: 'townhall' } }],
    ['blacksmith', { jobBuilding: { type: 'blacksmith' } }],
    ['guard', { jobBuilding: { type: 'barracks' } }],
    ['scholar', { jobBuilding: { type: 'school' } }],
    ['forager', { state: 'foraging' }],
  ].map(([expected, citizen]) => ({
    expected,
    actual: window.__realm.actorMapping.variantForCitizen(citizen),
  }));

  const actionCases = [
    ['idle', {}, false],
    ['walk', {}, true],
    ['work', { state: 'working' }, false],
    ['carry', { carrying: 'wood' }, true],
  ].map(([expected, citizen, moving]) => ({
    expected,
    actual: window.__realm.actorMapping.actionForCitizen(citizen, moving),
  }));

  const directionCases = [
    ['down', 0, 1, false],
    ['up', 0, -1, true],
    ['left', -1, 0, false],
    ['right', 1, 0, false],
  ].map(([expected, x, y, away]) => ({
    expected,
    actual: window.__realm.actorMapping.direction(x, y, away),
  }));

  return {
    atlasInfo,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    reports,
    addressFailures,
    mappingCases,
    actionCases,
    directionCases,
  };
}, {
  roles: ROLES,
  actions: ACTIONS,
  dirs: DIRS,
  frameW: FRAME_W,
  frameH: FRAME_H,
  frames: FRAMES,
});

const musterPages = [];
const musterRows = new Set();
const initial = await page.evaluate(() => window.__realm.spriteMuster.report());
for (let pageIndex = 0; pageIndex < initial.totalPages; pageIndex++) {
  const report = await page.evaluate((index) => window.__realm.spriteMuster.setPage(index), pageIndex);
  if (!report.ready) await page.waitForFunction(() => window.__realm.spriteMuster.report().ready === true);
  const settled = await page.evaluate(() => window.__realm.spriteMuster.report());
  settled.visibleRows.forEach((row) => musterRows.add(row.key));
  const screenshot = join(SHOTS, `actor-muster-${String(pageIndex + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  musterPages.push({
    page: pageIndex,
    visibleRows: settled.visibleRows.length,
    allDrawn: settled.visibleRows.every((row) => row.drawn),
    screenshot,
  });
}

const blankRows = runtime.reports.filter((row) => row.blankFrames.length);
const lowVariety = runtime.reports.filter((row) => row.action !== 'idle' && row.uniqueFrames < 2);
const mappingFailures = [
  ...runtime.mappingCases,
  ...runtime.actionCases,
  ...runtime.directionCases,
].filter((item) => item.actual !== item.expected);
const expectedRows = ROLES.length * ACTIONS.length * DIRS.length;
const expectedFrames = expectedRows * FRAMES;
const realPageErrors = pageErrors.filter((message) => !/favicon/i.test(message));
const failures = [];

if (runtime.naturalWidth !== ACTOR_ATLAS_W || runtime.naturalHeight !== ACTOR_ATLAS_H) {
  failures.push(`atlas dimensions ${runtime.naturalWidth}x${runtime.naturalHeight}`);
}
if (runtime.reports.length !== expectedRows) failures.push(`inspected ${runtime.reports.length}/${expectedRows} rows`);
if (runtime.addressFailures.length) failures.push(`${runtime.addressFailures.length} atlas address mismatch(es)`);
if (blankRows.length) failures.push(`${blankRows.length} row(s) contain blank frames`);
if (lowVariety.length) failures.push(`${lowVariety.length} moving row(s) have fewer than two unique frames`);
if (mappingFailures.length) failures.push(`${mappingFailures.length} live role/action/direction mapping failure(s)`);
if (musterRows.size !== expectedRows) failures.push(`live canvas drew ${musterRows.size}/${expectedRows} rows`);
if (musterPages.some((item) => !item.allDrawn)) failures.push('one or more muster pages did not draw every visible row');
if (realPageErrors.length) failures.push(`${realPageErrors.length} page error(s)`);

const output = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  expectedRows,
  expectedFrames,
  atlas: {
    width: runtime.naturalWidth,
    height: runtime.naturalHeight,
    runtimeInfo: runtime.atlasInfo,
  },
  summary: {
    rowsInspected: runtime.reports.length,
    framesInspected: runtime.reports.reduce((sum, row) => sum + row.frames.length, 0),
    blankRows: blankRows.length,
    lowVarietyRows: lowVariety.length,
    addressFailures: runtime.addressFailures.length,
    mappingFailures: mappingFailures.length,
    liveCanvasRows: musterRows.size,
    liveCanvasPages: musterPages.length,
    pageErrors: realPageErrors.length,
  },
  sourceCounts: initial.sourceCounts,
  mappings: {
    roles: runtime.mappingCases,
    actions: runtime.actionCases,
    directions: runtime.directionCases,
  },
  addressFailures: runtime.addressFailures,
  blankRows: blankRows.map((row) => ({ key: row.key, blankFrames: row.blankFrames })),
  lowVariety: lowVariety.map((row) => ({
    key: row.key,
    uniqueFrames: row.uniqueFrames,
    movingPairs: row.movingPairs,
  })),
  musterPages,
  pageErrors: realPageErrors,
  failures,
  rows: runtime.reports,
};

await writeFile(REPORT_PATH, `${JSON.stringify(output, null, 2)}\n`);
const reportHash = createHash('sha256').update(JSON.stringify(output.rows)).digest('hex').slice(0, 12);

console.log(`[all-sprite-maps] ${failures.length ? 'FAIL' : 'PASS'} ${runtime.reports.length}/${expectedRows} rows, ${output.summary.framesInspected}/${expectedFrames} frames`);
console.log(`[all-sprite-maps] live canvas coverage ${musterRows.size}/${expectedRows} rows across ${musterPages.length} muster page(s)`);
console.log(`[all-sprite-maps] blanks=${blankRows.length} low-variety=${lowVariety.length} address=${runtime.addressFailures.length} mapping=${mappingFailures.length} page-errors=${realPageErrors.length}`);
console.log(`[all-sprite-maps] row digest ${reportHash}`);
console.log(`[all-sprite-maps] wrote ${REPORT_PATH}`);
for (const failure of failures) console.log(`[all-sprite-maps] failure: ${failure}`);

await browser.close();
await server.stop();
process.exit(failures.length ? 1 : 0);
