// Removes tiny disconnected alpha particles from selected work rows. This is
// for sprite-sheet hygiene only: the main actor, tool, stump/anvil, and other
// substantial components are preserved.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors');
const OUT_DIR = join(ROOT, 'tmp', 'realm-graphics-round-106');

const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];

const TARGETS = [
  { role: 'lumber', action: 'work', dirs: ['down', 'up'], minKeep: 84 },
];

function bufferFromDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

await mkdir(OUT_DIR, { recursive: true });

const roles = [...new Set(TARGETS.map((target) => target.role))];
const sheets = {};
for (const role of roles) {
  const bytes = await readFile(join(ACTOR_DIR, `${role}.png`));
  sheets[role] = `data:image/png;base64,${bytes.toString('base64')}`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const result = await page.evaluate(async ({ actions, dirs, frameW, frameH, frames, sheets, targets }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function componentsFor(image) {
    const { data, width, height } = image;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 18) mask[y * width + x] = 1;
      }
    }
    const visited = new Uint8Array(width * height);
    const components = [];
    const queue = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
      visited[start] = 1;
      queue.length = 0;
      queue.push(start);
      const pixels = [];
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      for (let q = 0; q < queue.length; q++) {
        const idx = queue[q];
        pixels.push(idx);
        const x = idx % width;
        const y = Math.floor(idx / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < width - 1 ? idx + 1 : -1,
          y > 0 ? idx - width : -1,
          y < height - 1 ? idx + width : -1,
        ];
        for (const next of neighbors) {
          if (next >= 0 && mask[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      components.push({ pixels, size: pixels.length, minX, minY, maxX, maxY });
    }
    components.sort((a, b) => b.size - a.size);
    return components;
  }

  function near(a, b, pad) {
    return !(
      a.maxX < b.minX - pad ||
      a.minX > b.maxX + pad ||
      a.maxY < b.minY - pad ||
      a.minY > b.maxY + pad
    );
  }

  function scrubFrame(ctx, sx, sy, minKeep) {
    const image = ctx.getImageData(sx, sy, frameW, frameH);
    const components = componentsFor(image);
    if (components.length <= 1) return 0;
    const primary = components[0];
    let removed = 0;
    for (const component of components.slice(1)) {
      const keep = component.size >= minKeep || near(component, primary, 2);
      if (keep) continue;
      removed += component.size;
      for (const idx of component.pixels) image.data[idx * 4 + 3] = 0;
    }
    if (removed > 0) ctx.putImageData(image, sx, sy);
    return removed;
  }

  function drawProof(ctx, before, after, target, slot) {
    const actionIndex = actions.indexOf(target.action);
    const y = slot * 188;
    ctx.fillStyle = slot % 2 ? '#191612' : '#11100d';
    ctx.fillRect(0, y, ctx.canvas.width, 188);
    ctx.fillStyle = '#efe7d3';
    ctx.font = '15px sans-serif';
    ctx.fillText(`${target.role}/${target.action} ${target.dirs.join(',')}`, 12, y + 22);
    ctx.fillStyle = '#bdb29d';
    ctx.fillText('before', 12, y + 59);
    ctx.fillText('after', 12, y + 146);
    ctx.imageSmoothingEnabled = false;
    const firstDir = dirs.indexOf(target.dirs[0]);
    const rowY = (actionIndex * dirs.length + firstDir) * frameH;
    ctx.drawImage(before, 0, rowY, frameW * frames, frameH, 92, y + 12, frameW * frames, frameH);
    ctx.drawImage(after, 0, rowY, frameW * frames, frameH, 92, y + 100, frameW * frames, frameH);
  }

  const modified = {};
  const proofRows = [];
  const removedRows = [];

  for (const role of Object.keys(sheets)) {
    const img = await loadImage(sheets[role]);
    const before = document.createElement('canvas');
    before.width = img.naturalWidth;
    before.height = img.naturalHeight;
    before.getContext('2d').drawImage(img, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    for (const target of targets.filter((item) => item.role === role)) {
      let removed = 0;
      for (const dir of target.dirs) {
        const rowIndex = actions.indexOf(target.action) * dirs.length + dirs.indexOf(dir);
        const y = rowIndex * frameH;
        for (let frame = 0; frame < frames; frame++) {
          removed += scrubFrame(ctx, frame * frameW, y, target.minKeep);
        }
      }
      proofRows.push({ target, before, after: canvas });
      removedRows.push({ role: target.role, action: target.action, dirs: target.dirs, removed });
    }
    modified[role] = canvas.toDataURL('image/png');
  }

  const proof = document.createElement('canvas');
  proof.width = 620;
  proof.height = proofRows.length * 188;
  const proofCtx = proof.getContext('2d');
  proofCtx.fillStyle = '#11100d';
  proofCtx.fillRect(0, 0, proof.width, proof.height);
  proofRows.forEach((row, i) => drawProof(proofCtx, row.before, row.after, row.target, i));

  return { modified, removedRows, proof: proof.toDataURL('image/png') };
}, { actions: ACTIONS, dirs: DIRS, frameW: FRAME_W, frameH: FRAME_H, frames: FRAMES, sheets, targets: TARGETS });

await browser.close();

for (const [role, dataUrl] of Object.entries(result.modified)) {
  await writeFile(join(ACTOR_DIR, `${role}.png`), bufferFromDataUrl(dataUrl));
  await writeFile(join(OUT_DIR, `${role}-particle-scrubbed.png`), bufferFromDataUrl(dataUrl));
}
await writeFile(join(OUT_DIR, 'work-particle-scrub-proof.png'), bufferFromDataUrl(result.proof));

console.log('[work-particle-scrub] removed alpha pixels:');
for (const row of result.removedRows) {
  console.log(`[work-particle-scrub] ${row.role}/${row.action}/${row.dirs.join(',')} removed=${row.removed}`);
}
console.log(`[work-particle-scrub] wrote ${join(OUT_DIR, 'work-particle-scrub-proof.png')}`);
