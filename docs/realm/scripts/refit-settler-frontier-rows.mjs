// Derive remaining settler work/carry rows from the locked frontier settler
// idle/walk rows so the default actors do not switch back to old base art.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRS, FRAME_H, FRAME_W, FRAMES, ROLE_SHEET_W } from './sprite-source-contract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SETTLER_ROWS = join(ROOT, 'assets', 'sprites', 'actor-rows', 'settler');
const OUT_DIR = join(ROOT, 'tmp', 'realm-graphics-round-112', 'settler-frontier-rows');

function bufferFromDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function dataUrlFor(path) {
  const bytes = await readFile(path);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

await mkdir(OUT_DIR, { recursive: true });

const sources = {};
for (const dir of DIRS) {
  sources[`idle-${dir}`] = await dataUrlFor(join(SETTLER_ROWS, `idle-${dir}.png`));
  sources[`walk-${dir}`] = await dataUrlFor(join(SETTLER_ROWS, `walk-${dir}.png`));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const result = await page.evaluate(async ({ dirs, frameW, frameH, frames, roleSheetW, sources }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function bundleAnchor(dir, frame) {
    const bob = Math.sin((frame / frames) * Math.PI * 4) * 1.2;
    if (dir === 'down') return { x: 42, y: 47 + bob, side: 1 };
    if (dir === 'up') return { x: 42, y: 48 - bob * 0.4, side: 1 };
    if (dir === 'left') return { x: 20, y: 47 + bob * 0.45, side: -1 };
    return { x: 44, y: 47 + bob * 0.45, side: 1 };
  }

  function drawBundle(ctx, dir, frame, ox) {
    const { x, y, side } = bundleAnchor(dir, frame);
    const cx = ox + x;
    const cy = y;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4d321d';
    ctx.fillStyle = '#8b5a2e';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 7, 8.5, side * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a9763c';
    ctx.beginPath();
    ctx.ellipse(cx - side * 2, cy - 3, 3.5, 3, side * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#60401f';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - side * 5, cy - 2);
    ctx.lineTo(cx + side * 5, cy - 2);
    ctx.stroke();
    ctx.restore();
  }

  const loaded = {};
  for (const [key, dataUrl] of Object.entries(sources)) loaded[key] = await loadImage(dataUrl);
  const rows = {};

  for (const dir of dirs) {
    for (const action of ['work', 'carry']) {
      const source = loaded[`${action === 'work' ? 'idle' : 'walk'}-${dir}`];
      const canvas = document.createElement('canvas');
      canvas.width = roleSheetW;
      canvas.height = frameH;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0);
      if (action === 'carry') {
        for (let frame = 0; frame < frames; frame++) drawBundle(ctx, dir, frame, frame * frameW);
      }
      rows[`${action}-${dir}`] = canvas.toDataURL('image/png');
    }
  }

  const proof = document.createElement('canvas');
  proof.width = roleSheetW;
  proof.height = frameH * 8;
  const proofCtx = proof.getContext('2d');
  proofCtx.fillStyle = '#0f1418';
  proofCtx.fillRect(0, 0, proof.width, proof.height);
  let row = 0;
  for (const action of ['work', 'carry']) {
    for (const dir of dirs) {
      const img = await loadImage(rows[`${action}-${dir}`]);
      proofCtx.drawImage(img, 0, row * frameH);
      row += 1;
    }
  }
  return { rows, proof: proof.toDataURL('image/png') };
}, {
  dirs: DIRS,
  frameW: FRAME_W,
  frameH: FRAME_H,
  frames: FRAMES,
  roleSheetW: ROLE_SHEET_W,
  sources,
});

await browser.close();

for (const [name, dataUrl] of Object.entries(result.rows)) {
  await writeFile(join(OUT_DIR, `settler-${name}.png`), bufferFromDataUrl(dataUrl));
}
await writeFile(join(OUT_DIR, 'settler-frontier-work-carry-proof.png'), bufferFromDataUrl(result.proof));

console.log(`[settler-frontier] wrote ${Object.keys(result.rows).length} row candidate(s) to ${OUT_DIR}`);
