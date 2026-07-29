// Scrubs stray alpha debris from compiled actor sheets: tiny disconnected
// pixel islands (generation artifacts around tools in the later batches)
// that read as flashes when the loop plays. Conservative: only erases
// components with area < 18px whose bbox sits > 5px clear of the frame's
// main component. Dry-run by default; --write rewrites the PNGs (git holds
// the originals).
//
// Usage: node docs/realm/scripts/scrub-sprite-debris.mjs [--write]

import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTOR_DIR = join(__dirname, '..', 'assets', 'sprites', 'actors-compiled');
const ROLES = ['settler','farmer','rancher','lumber','miner','stonecutter','fisher','trader','innkeeper','builder','blacksmith','guard','scholar','forager'];
const FRAME_W = 64, FRAME_H = 84, FRAMES = 8, ROWS = 16;
const WRITE = process.argv.includes('--write');

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
let totalErased = 0;
for (const role of ROLES) {
  const buf = await readFile(join(ACTOR_DIR, `${role}.png`));
  const res = await page.evaluate(async ({ b64, FRAME_W, FRAME_H, FRAMES, ROWS, write }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    let erased = 0;
    const details = [];
    for (let row = 0; row < ROWS; row++) {
      for (let f = 0; f < FRAMES; f++) {
        const ox = f * FRAME_W, oy = row * FRAME_H;
        const id = cx.getImageData(ox, oy, FRAME_W, FRAME_H);
        const a = id.data;
        const seen = new Int32Array(FRAME_W * FRAME_H).fill(-1);
        const comps = [];
        for (let i = 0; i < FRAME_W * FRAME_H; i++) {
          if (seen[i] >= 0 || a[i * 4 + 3] < 24) continue;
          // BFS
          const q = [i]; seen[i] = comps.length;
          let area = 0, minX = FRAME_W, maxX = 0, minY = FRAME_H, maxY = 0;
          const px = [];
          while (q.length) {
            const p = q.pop(); px.push(p); area++;
            const x = p % FRAME_W, y = (p / FRAME_W) | 0;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            for (const [dx2, dy2] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
              const nx = x + dx2, ny = y + dy2;
              if (nx < 0 || nx >= FRAME_W || ny < 0 || ny >= FRAME_H) continue;
              const ni = ny * FRAME_W + nx;
              if (seen[ni] < 0 && a[ni * 4 + 3] >= 24) { seen[ni] = comps.length; q.push(ni); }
            }
          }
          comps.push({ area, minX, maxX, minY, maxY, px });
        }
        if (comps.length < 2) continue;
        const main = comps.reduce((m, c) => c.area > m.area ? c : m);
        for (const c of comps) {
          if (c === main || c.area >= 18) continue;
          const gap = Math.max(
            c.minX > main.maxX ? c.minX - main.maxX : main.minX > c.maxX ? main.minX - c.maxX : 0,
            c.minY > main.maxY ? c.minY - main.maxY : main.minY > c.maxY ? main.minY - c.maxY : 0,
          );
          if (gap <= 5) continue;
          for (const p of c.px) { a[p * 4 + 3] = 0; }
          erased++;
          details.push(`r${row}f${f} area${c.area} gap${gap}`);
        }
        if (write) cx.putImageData(id, ox, oy);
      }
    }
    return { erased, details: details.slice(0, 8), png: write ? cv.toDataURL('image/png') : null };
  }, { b64: buf.toString('base64'), FRAME_W, FRAME_H, FRAMES, ROWS, write: WRITE });
  if (res.erased) {
    console.log(`${role}: ${res.erased} debris islands${WRITE ? ' ERASED' : ''} — ${res.details.join(', ')}${res.erased > 8 ? ', …' : ''}`);
    totalErased += res.erased;
    if (WRITE && res.png) {
      await writeFile(join(ACTOR_DIR, `${role}.png`), Buffer.from(res.png.split(',')[1], 'base64'));
    }
  }
}
await browser.close();
console.log(`[scrub] ${totalErased} debris islands ${WRITE ? 'erased and sheets rewritten' : 'found (dry run — use --write)'}`);
