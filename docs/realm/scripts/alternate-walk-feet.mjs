// Lower-body-only gait correction for front/back walk rows.
// It mirrors the lower leg/boot band on alternating frames while preserving
// the upper body, so front/back rows can alternate foot contact without
// changing the actor's face, torso, carried-side details, or silhouette scale.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];

const args = process.argv.slice(2);
let bandY = 50;
const bandIdx = args.indexOf('--band-y');
if (bandIdx >= 0) {
  bandY = Number(args[bandIdx + 1]);
  args.splice(bandIdx, 2);
}
const role = args[0];
const dirs = args.slice(1);
if (!role || dirs.length === 0) {
  console.error('usage: node scripts/alternate-walk-feet.mjs [--band-y N] <role> <down|up> [...]');
  process.exit(2);
}
if (!Number.isFinite(bandY) || bandY < 36 || bandY > 62) {
  console.error('--band-y must be a number between 36 and 62');
  process.exit(2);
}

const path = join(ROOT, 'assets', 'sprites', 'actors', `${role}.png`);
const bytes = await readFile(path);
const source = `data:image/png;base64,${bytes.toString('base64')}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = await page.evaluate(async ({ source, dirs, actions, allDirs, frameW, frameH, frames, bandY }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  const img = await loadImage(source);
  const sheet = document.createElement('canvas');
  sheet.width = img.naturalWidth;
  sheet.height = img.naturalHeight;
  const ctx = sheet.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const bandH = frameH - bandY;
  const tmp = document.createElement('canvas');
  tmp.width = frameW;
  tmp.height = bandH;
  const tctx = tmp.getContext('2d');

  for (const dir of dirs) {
    const rowIndex = actions.indexOf('walk') * allDirs.length + allDirs.indexOf(dir);
    if (rowIndex < 0) continue;
    const rowY = rowIndex * frameH;
    for (let frame = 1; frame < frames; frame += 2) {
      const x = frame * frameW;
      tctx.clearRect(0, 0, frameW, bandH);
      tctx.save();
      tctx.translate(frameW, 0);
      tctx.scale(-1, 1);
      tctx.drawImage(sheet, x, rowY + bandY, frameW, bandH, 0, 0, frameW, bandH);
      tctx.restore();
      ctx.clearRect(x, rowY + bandY, frameW, bandH);
      ctx.drawImage(tmp, x, rowY + bandY);
    }
  }
  return sheet.toDataURL('image/png');
}, { source, dirs, actions: ACTIONS, allDirs: DIRS, frameW: FRAME_W, frameH: FRAME_H, frames: FRAMES, bandY });

await browser.close();
await writeFile(path, Buffer.from(out.split(',')[1], 'base64'));
console.log(`[alternate-walk-feet] updated ${path}: ${dirs.join(', ')} bandY=${bandY}`);
