// Extracts each role's identity palette from its WALK rows (the canonical
// art the cast is known by): dominant clusters for skin, hair/hat, top,
// bottom, boots — feeds the sprite forge so a fresh-start cast keeps the
// game's established color language.
import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors-compiled');
const ROLES = ['settler','farmer','rancher','lumber','miner','stonecutter','fisher','trader','innkeeper','builder','blacksmith','guard','scholar','forager'];
const FRAME_W = 64, FRAME_H = 84;

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
const palettes = {};
for (const role of ROLES) {
  const buf = await readFile(join(ACTOR_DIR, `${role}.png`));
  palettes[role] = await page.evaluate(async ({ b64, FRAME_W, FRAME_H }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    // walk/down row = row 4; sample by body zone (y bands of the 54px figure,
    // feet at 79): hat/hair 25-36, face 32-42, torso 42-58, legs 58-72, boots 72-79
    const zones = { head: [25, 38], face: [33, 42], torso: [43, 58], legs: [59, 71], boots: [72, 79] };
    const out = {};
    for (const [zone, [y0, y1]] of Object.entries(zones)) {
      const counts = new Map();
      for (let f = 0; f < 8; f++) {
        const data = cx.getImageData(f * FRAME_W, 4 * FRAME_H + y0, FRAME_W, y1 - y0).data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const r = data[i] >> 4, g = data[i + 1] >> 4, b = data[i + 2] >> 4;
          const k = (r << 8) | (g << 4) | b;
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) =>
        '#' + [(k >> 8) & 0xf, (k >> 4) & 0xf, k & 0xf].map(v => (v * 17).toString(16).padStart(2, '0')).join(''));
      out[zone] = top;
    }
    return out;
  }, { b64: buf.toString('base64'), FRAME_W, FRAME_H });
}
await browser.close();
await writeFile(join(__dirname, 'sprite-forge-palettes.json'), JSON.stringify(palettes, null, 2));
console.log('wrote scripts/sprite-forge-palettes.json');
for (const [role, p] of Object.entries(palettes)) console.log(role.padEnd(12), 'torso', p.torso[0], 'legs', p.legs[0], 'head', p.head[0], 'boots', p.boots[0]);
