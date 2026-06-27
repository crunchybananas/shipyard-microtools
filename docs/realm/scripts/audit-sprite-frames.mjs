// Audits per-role actor sprite rows for animation continuity and alpha
// artifacts. This complements the live animation verifier by inspecting every
// source-sheet row, not just a few runtime examples.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors-compiled');
const SHOTS = join(ROOT, 'scripts', 'screenshots');

const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];
const ROLES = [
  'settler', 'farmer', 'rancher', 'lumber', 'miner', 'stonecutter',
  'fisher', 'trader', 'innkeeper', 'builder', 'blacksmith', 'guard',
  'scholar', 'forager',
];

function scoreRow(frames) {
  const nonBlank = frames.filter((f) => f.pixels > 0);
  const widths = nonBlank.map((f) => f.w);
  const heights = nonBlank.map((f) => f.h);
  const pixels = nonBlank.map((f) => f.pixels);
  const centerJumps = [];
  const widthJumps = [];
  const heightJumps = [];
  const pixelRatios = [];

  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (!a.pixels || !b.pixels) continue;
    centerJumps.push(Math.hypot(a.cx - b.cx, a.cy - b.cy));
    widthJumps.push(Math.abs(a.w - b.w));
    heightJumps.push(Math.abs(a.h - b.h));
    pixelRatios.push(Math.max(a.pixels, b.pixels) / Math.max(1, Math.min(a.pixels, b.pixels)));
  }

  const blankCount = frames.length - nonBlank.length;
  const maxCenterJump = Math.max(0, ...centerJumps);
  const maxWidthJump = Math.max(0, ...widthJumps);
  const maxHeightJump = Math.max(0, ...heightJumps);
  const maxPixelRatio = Math.max(1, ...pixelRatios);
  const fragmentPixels = Math.max(0, ...frames.map((f) => f.fragmentPixels));
  const fragmentCount = Math.max(0, ...frames.map((f) => f.fragmentCount));
  const edgePixels = Math.max(0, ...frames.map((f) => f.edgePixels));
  const widthRange = widths.length ? Math.max(...widths) - Math.min(...widths) : 0;
  const heightRange = heights.length ? Math.max(...heights) - Math.min(...heights) : 0;
  const pixelRangeRatio = pixels.length ? Math.max(...pixels) / Math.max(1, Math.min(...pixels)) : 1;

  let score = 0;
  score += blankCount * 100;
  score += Math.max(0, maxCenterJump - 9) * 5;
  score += Math.max(0, maxWidthJump - 10) * 3;
  score += Math.max(0, maxHeightJump - 10) * 3;
  score += Math.max(0, widthRange - 14) * 2;
  score += Math.max(0, heightRange - 14) * 2;
  score += Math.max(0, maxPixelRatio - 1.35) * 40;
  score += Math.max(0, pixelRangeRatio - 1.55) * 20;
  score += Math.max(0, fragmentPixels - 70) * 0.35;
  score += Math.max(0, fragmentCount - 5) * 5;
  score += Math.max(0, edgePixels - 220) * 0.04;

  return {
    score,
    blankCount,
    maxCenterJump,
    maxWidthJump,
    maxHeightJump,
    widthRange,
    heightRange,
    maxPixelRatio,
    pixelRangeRatio,
    fragmentPixels,
    fragmentCount,
    edgePixels,
  };
}

await mkdir(SHOTS, { recursive: true });

const sheets = {};
for (const role of ROLES) {
  const bytes = await readFile(join(ACTOR_DIR, `${role}.png`));
  sheets[role] = `data:image/png;base64,${bytes.toString('base64')}`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const audit = await page.evaluate(async ({ sheets, roles, actions, dirs, frameW, frameH, frames }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function frameStats(ctx, sx, sy) {
    const image = ctx.getImageData(sx, sy, frameW, frameH);
    const data = image.data;
    const opaque = new Uint8Array(frameW * frameH);
    let minX = frameW;
    let minY = frameH;
    let maxX = -1;
    let maxY = -1;
    let pixels = 0;
    let sumX = 0;
    let sumY = 0;
    let edgePixels = 0;

    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const i = (y * frameW + x) * 4;
        if (data[i + 3] <= 18) continue;
        opaque[y * frameW + x] = 1;
        pixels++;
        sumX += x;
        sumY += y;
        if (x <= 1 || x >= frameW - 2 || y <= 1 || y >= frameH - 2) edgePixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (!pixels) {
      return {
        pixels: 0, minX: 0, minY: 0, maxX: 0, maxY: 0,
        w: 0, h: 0, cx: 0, cy: 0, edgePixels: 0,
        fragmentPixels: 0, fragmentCount: 0,
      };
    }

    const visited = new Uint8Array(frameW * frameH);
    const sizes = [];
    const queue = [];
    for (let start = 0; start < opaque.length; start++) {
      if (!opaque[start] || visited[start]) continue;
      visited[start] = 1;
      queue.length = 0;
      queue.push(start);
      let size = 0;
      for (let q = 0; q < queue.length; q++) {
        const idx = queue[q];
        size++;
        const x = idx % frameW;
        const y = Math.floor(idx / frameW);
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < frameW - 1 ? idx + 1 : -1,
          y > 0 ? idx - frameW : -1,
          y < frameH - 1 ? idx + frameW : -1,
        ];
        for (const next of neighbors) {
          if (next < 0 || !opaque[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      sizes.push(size);
    }
    sizes.sort((a, b) => b - a);
    const fragmentPixels = sizes.slice(1).reduce((sum, n) => sum + n, 0);
    const fragmentCount = sizes.slice(1).filter((n) => n >= 4).length;

    return {
      pixels,
      minX,
      minY,
      maxX,
      maxY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      cx: sumX / pixels,
      cy: sumY / pixels,
      edgePixels,
      fragmentPixels,
      fragmentCount,
    };
  }

  const rows = [];
  const rowCanvas = document.createElement('canvas');
  rowCanvas.width = frameW * frames;
  rowCanvas.height = frameH;
  const rowCtx = rowCanvas.getContext('2d', { willReadFrequently: true });

  for (const role of roles) {
    const img = await loadImage(sheets[role]);
    const sheet = document.createElement('canvas');
    sheet.width = img.naturalWidth;
    sheet.height = img.naturalHeight;
    const ctx = sheet.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      for (let dirIndex = 0; dirIndex < dirs.length; dirIndex++) {
        const rowIndex = actionIndex * dirs.length + dirIndex;
        const y = rowIndex * frameH;
        const framesOut = [];
        for (let frame = 0; frame < frames; frame++) {
          framesOut.push(frameStats(ctx, frame * frameW, y));
        }
        rowCtx.clearRect(0, 0, rowCanvas.width, rowCanvas.height);
        rowCtx.drawImage(img, 0, y, rowCanvas.width, frameH, 0, 0, rowCanvas.width, frameH);
        rows.push({
          role,
          action: actions[actionIndex],
          dir: dirs[dirIndex],
          rowIndex,
          frames: framesOut,
          dataUrl: rowCanvas.toDataURL('image/png'),
        });
      }
    }
  }
  return rows;
}, { sheets, roles: ROLES, actions: ACTIONS, dirs: DIRS, frameW: FRAME_W, frameH: FRAME_H, frames: FRAMES });

const reports = audit.map((row) => ({
  role: row.role,
  action: row.action,
  dir: row.dir,
  rowIndex: row.rowIndex,
  ...scoreRow(row.frames),
}));
reports.sort((a, b) => b.score - a.score);

const worst = reports.slice(0, 18);
const rowByKey = new Map(audit.map((row) => [`${row.role}/${row.action}/${row.dir}`, row]));

const proofDataUrl = await page.evaluate(async ({ worst, rows }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  const scale = 2;
  const labelW = 236;
  const rowW = 512 * scale;
  const rowH = 84 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = labelW + rowW;
  canvas.height = worst.length * rowH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#181511';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '16px sans-serif';
  ctx.textBaseline = 'top';
  for (let i = 0; i < worst.length; i++) {
    const item = worst[i];
    const key = `${item.role}/${item.action}/${item.dir}`;
    const row = rows[key];
    const img = await loadImage(row.dataUrl);
    const y = i * rowH;
    ctx.fillStyle = i % 2 ? '#201b15' : '#181511';
    ctx.fillRect(0, y, canvas.width, rowH);
    ctx.fillStyle = '#f3ead7';
    ctx.fillText(`${i + 1}. ${key}`, 10, y + 12);
    ctx.fillStyle = '#c7bda8';
    ctx.fillText(`score ${item.score.toFixed(1)}`, 10, y + 34);
    ctx.fillText(`jump ${item.maxCenterJump.toFixed(1)}  size ${item.widthRange}/${item.heightRange}`, 10, y + 56);
    ctx.fillText(`frag ${item.fragmentPixels}/${item.fragmentCount}`, 10, y + 78);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, labelW, y, rowW, rowH);
  }
  return canvas.toDataURL('image/png');
}, {
  worst,
  rows: Object.fromEntries([...rowByKey.entries()].map(([key, row]) => [key, { dataUrl: row.dataUrl }])),
});

const proofBytes = Buffer.from(proofDataUrl.split(',')[1], 'base64');
await writeFile(join(SHOTS, 'sprite-audit-worst-rows.png'), proofBytes);
await writeFile(join(SHOTS, 'sprite-audit-report.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), worst, reports }, null, 2)}\n`);

for (const item of worst.slice(0, 12)) {
  console.log(`[sprite-audit] ${item.role}/${item.action}/${item.dir} score=${item.score.toFixed(1)} blank=${item.blankCount} center=${item.maxCenterJump.toFixed(1)} size=${item.widthRange}/${item.heightRange} pixelRatio=${item.pixelRangeRatio.toFixed(2)} fragments=${item.fragmentPixels}/${item.fragmentCount}`);
}
console.log('[sprite-audit] wrote scripts/screenshots/sprite-audit-report.json');
console.log('[sprite-audit] wrote scripts/screenshots/sprite-audit-worst-rows.png');

await browser.close();
