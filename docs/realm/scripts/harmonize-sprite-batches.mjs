// Palette harmonization — pulls each role's work/carry batch (the later,
// off-palette generation) toward its walk/idle batch (the canonical art)
// with per-channel Reinhard statistics transfer over opaque pixels.
// Geometry/alpha untouched, so feet registration and size metadata stay
// valid; only the color distribution moves. Dry-run strips by default.
//
// Usage:
//   node scripts/harmonize-sprite-batches.mjs --strip farmer   # /tmp A/B
//   node scripts/harmonize-sprite-batches.mjs --write [roles…] # bake PNGs

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTOR_DIR = join(__dirname, '..', 'assets', 'sprites', 'actors-compiled');
const ALL = ['settler','farmer','rancher','lumber','miner','stonecutter','fisher','trader','innkeeper','builder','blacksmith','guard','scholar','forager'];
// Queue roles with a measured batch break (loop/docs/sprite-repaint-queue.md)
const QUEUE = ['farmer','builder','blacksmith','miner','guard','lumber'];

const args = process.argv.slice(2);
const stripRole = args.includes('--strip') ? (args[args.indexOf('--strip') + 1] || 'farmer') : null;
const doWrite = args.includes('--write');
const roles = stripRole ? [stripRole] : (args.filter(a => ALL.includes(a)).length ? args.filter(a => ALL.includes(a)) : QUEUE);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

for (const role of roles) {
  const buf = await readFile(join(ACTOR_DIR, `${role}.png`));
  const res = await page.evaluate(async ({ b64, write }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const FW = 64, FH = 84;
    // rows 0-7 = idle+walk (reference), rows 8-15 = work+carry (source)
    const stats = (y0, y1) => {
      const d = cx.getImageData(0, y0 * FH, cv.width, (y1 - y0) * FH).data;
      const m = [0, 0, 0], m2 = [0, 0, 0]; let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue;
        for (let c = 0; c < 3; c++) { m[c] += d[i + c]; m2[c] += d[i + c] * d[i + c]; }
        n++;
      }
      const mean = m.map(v => v / n);
      const std = m2.map((v, c) => Math.sqrt(Math.max(1, v / n - mean[c] * mean[c])));
      return { mean, std, n };
    };
    const ref = stats(0, 8);
    const src = stats(8, 16);
    // damp the std ratio (full equalization can overcook contrast)
    const k = ref.std.map((s, c) => {
      const r = s / src.std[c];
      return 1 + (r - 1) * 0.75;
    });
    const id = cx.getImageData(0, 8 * FH, cv.width, 8 * FH);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      for (let c = 0; c < 3; c++) {
        d[i + c] = Math.max(0, Math.min(255, (d[i + c] - src.mean[c]) * k[c] + ref.mean[c] * 0.85 + src.mean[c] * 0.15 - src.mean[c] * 0 + (ref.mean[c] - src.mean[c]) * 0.0));
      }
    }
    cx.putImageData(id, 0, 8 * FH);
    return {
      refMean: ref.mean.map(Math.round), srcMean: src.mean.map(Math.round),
      png: cv.toDataURL('image/png'),
    };
  }, { b64: buf.toString('base64'), write: doWrite });
  console.log(`${role}: walk-era mean rgb(${res.refMean}) ← work-era rgb(${res.srcMean})`);
  const out = Buffer.from(res.png.split(',')[1], 'base64');
  if (doWrite) {
    await writeFile(join(ACTOR_DIR, `${role}.png`), out);
    console.log(`  baked into actors-compiled/${role}.png`);
  } else {
    await writeFile(`/tmp/harmonized-${role}.png`, out);
    console.log(`  preview /tmp/harmonized-${role}.png`);
  }
}
await browser.close();
