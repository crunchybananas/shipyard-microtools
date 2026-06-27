// Audits walk rows for a different failure mode than the continuity audit:
// clean frames that still read as a one-foot walk. The heuristic focuses on
// boot/lower-leg alpha in the bottom of each frame and looks for alternating
// left/right weight in front/back rows plus meaningful stride variation in
// side rows.

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

await mkdir(SHOTS, { recursive: true });

const sheets = {};
for (const role of ROLES) {
  const bytes = await readFile(join(ACTOR_DIR, `${role}.png`));
  sheets[role] = `data:image/png;base64,${bytes.toString('base64')}`;
}

function scoreGait(dir, frames) {
  const frontBack = dir === 'down' || dir === 'up';
  // Front/back gait reads through perspective depth: the advancing boot
  // reaches farther down-screen. Horizontal centroid bias is dominated by
  // costume asymmetry and falsely penalizes painterly rows whose legs touch.
  // Side gait still uses horizontal lower-body balance and stride span.
  const balances = frames.map((f) => (
    frontBack ? f.footDepthBalance : f.footBalance
  ));
  const spans = frames.map((f) => f.footSpan);
  const strideRange = Math.max(...spans) - Math.min(...spans);
  const balanceRange = Math.max(...balances) - Math.min(...balances);
  const signs = balances.map((n) => (Math.abs(n) < 0.9 ? 0 : Math.sign(n)));
  const nonZeroSigns = signs.filter(Boolean);
  const positive = nonZeroSigns.filter((n) => n > 0).length;
  const negative = nonZeroSigns.filter((n) => n < 0).length;
  let signChanges = 0;
  for (let i = 1; i < nonZeroSigns.length; i++) {
    if (nonZeroSigns[i] !== nonZeroSigns[i - 1]) signChanges++;
  }

  let score = 0;
  if (frontBack) {
    score += Math.max(0, 2 - Math.min(positive, negative)) * 28;
    score += Math.max(0, 3 - signChanges) * 18;
    score += Math.max(0, 5 - balanceRange) * 5;
  } else {
    score += Math.max(0, 7 - strideRange) * 7;
    score += Math.max(0, 4 - balanceRange) * 3;
  }
  score += Math.max(0, 2 - Math.min(...frames.map((f) => f.lowerComponents))) * 8;

  return {
    score,
    footBalanceRange: balanceRange,
    footSpanRange: strideRange,
    signChanges,
    positiveFrames: positive,
    negativeFrames: negative,
    balances,
    spans,
    balanceMetric: frontBack ? 'depth' : 'horizontal',
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const rows = await page.evaluate(async ({ sheets, roles, actions, dirs, frameW, frameH, frames }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function lowerStats(ctx, sx, sy, dir) {
    const image = ctx.getImageData(sx, sy, frameW, frameH);
    const data = image.data;
    const startY = 57;
    const footY = 62;
    let lowerPixels = 0;
    let lowerSumX = 0;
    let minFootX = frameW;
    let maxFootX = -1;
    let leftPixels = 0;
    let rightPixels = 0;
    let leftMaxFootY = -1;
    let rightMaxFootY = -1;
    const mask = new Uint8Array(frameW * frameH);

    for (let y = startY; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const i = (y * frameW + x) * 4;
        if (data[i + 3] <= 28) continue;
        const frontBack = dir === 'down' || dir === 'up';
        if (frontBack && (x < 16 || x > 48)) continue;
        const isChromaFringe = data[i + 1] > 115 && data[i] < 130 && data[i + 2] < 130;
        if (isChromaFringe) continue;
        const darkness = 255 - Math.max(data[i], data[i + 1], data[i + 2]);
        const bootish = y >= footY && darkness > 25;
        if (!bootish) continue;
        mask[y * frameW + x] = 1;
        lowerPixels++;
        lowerSumX += x;
        if (x < minFootX) minFootX = x;
        if (x > maxFootX) maxFootX = x;
        if (x < frameW / 2) {
          leftPixels++;
          leftMaxFootY = Math.max(leftMaxFootY, y);
        } else {
          rightPixels++;
          rightMaxFootY = Math.max(rightMaxFootY, y);
        }
      }
    }

    const visited = new Uint8Array(frameW * frameH);
    const sizes = [];
    const queue = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
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
          y > startY ? idx - frameW : -1,
          y < frameH - 1 ? idx + frameW : -1,
        ];
        for (const next of neighbors) {
          if (next < 0 || !mask[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      sizes.push(size);
    }
    sizes.sort((a, b) => b - a);

    const footCx = lowerPixels ? lowerSumX / lowerPixels : frameW / 2;
    return {
      lowerPixels,
      footCx,
      footBalance: lowerPixels ? footCx - frameW / 2 : 0,
      footDepthBalance: leftMaxFootY >= 0 && rightMaxFootY >= 0
        ? rightMaxFootY - leftMaxFootY
        : 0,
      footSpan: maxFootX >= minFootX ? maxFootX - minFootX + 1 : 0,
      leftPixels,
      rightPixels,
      lowerComponents: sizes.filter((n) => n >= 10).length,
      componentSizes: sizes.slice(0, 4),
    };
  }

  const out = [];
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
    const actionIndex = actions.indexOf('walk');
    for (let dirIndex = 0; dirIndex < dirs.length; dirIndex++) {
      const y = (actionIndex * dirs.length + dirIndex) * frameH;
      const frameStats = [];
      for (let frame = 0; frame < frames; frame++) {
        frameStats.push(lowerStats(ctx, frame * frameW, y, dirs[dirIndex]));
      }
      rowCtx.clearRect(0, 0, rowCanvas.width, frameH);
      rowCtx.drawImage(img, 0, y, rowCanvas.width, frameH, 0, 0, rowCanvas.width, frameH);
      out.push({
        role,
        action: 'walk',
        dir: dirs[dirIndex],
        frames: frameStats,
        dataUrl: rowCanvas.toDataURL('image/png'),
      });
    }
  }
  return out;
}, { sheets, roles: ROLES, actions: ACTIONS, dirs: DIRS, frameW: FRAME_W, frameH: FRAME_H, frames: FRAMES });

const reports = rows.map((row) => ({
  role: row.role,
  action: row.action,
  dir: row.dir,
  ...scoreGait(row.dir, row.frames),
}));
reports.sort((a, b) => b.score - a.score);
const worst = reports.slice(0, 20);
const rowByKey = new Map(rows.map((row) => [`${row.role}/${row.action}/${row.dir}`, row]));

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
  const labelW = 300;
  const rowW = 512 * scale;
  const rowH = 84 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = labelW + rowW;
  canvas.height = worst.length * rowH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#181511';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '15px sans-serif';
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
    ctx.fillText(`${i + 1}. ${key}`, 10, y + 10);
    ctx.fillStyle = '#c7bda8';
    ctx.fillText(`gait ${item.score.toFixed(1)}  signs +${item.positiveFrames}/-${item.negativeFrames}`, 10, y + 32);
    ctx.fillText(`changes ${item.signChanges}  balance ${item.footBalanceRange.toFixed(1)}  span ${item.footSpanRange.toFixed(1)}`, 10, y + 54);
    ctx.fillText(item.balances.map((n) => n.toFixed(1)).join(' '), 10, y + 76);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, labelW, y, rowW, rowH);
    ctx.strokeStyle = 'rgba(250,210,80,0.9)';
    ctx.lineWidth = 1;
    for (let f = 0; f < 8; f++) {
      const cx = labelW + f * 64 * scale + 32 * scale;
      ctx.beginPath();
      ctx.moveTo(cx, y + 57 * scale);
      ctx.lineTo(cx, y + 84 * scale);
      ctx.stroke();
    }
  }
  return canvas.toDataURL('image/png');
}, {
  worst,
  rows: Object.fromEntries([...rowByKey.entries()].map(([key, row]) => [key, { dataUrl: row.dataUrl }])),
});

await writeFile(join(SHOTS, 'walk-gait-audit-report.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), worst, reports }, null, 2)}\n`);
await writeFile(join(SHOTS, 'walk-gait-audit-worst-rows.png'), Buffer.from(proofDataUrl.split(',')[1], 'base64'));

for (const item of worst.slice(0, 14)) {
  console.log(`[walk-gait] ${item.role}/${item.action}/${item.dir} gait=${item.score.toFixed(1)} signs=+${item.positiveFrames}/-${item.negativeFrames} changes=${item.signChanges} balance=${item.footBalanceRange.toFixed(1)} span=${item.footSpanRange.toFixed(1)}`);
}
console.log('[walk-gait] wrote scripts/screenshots/walk-gait-audit-report.json');
console.log('[walk-gait] wrote scripts/screenshots/walk-gait-audit-worst-rows.png');

await browser.close();
