// Capture The Island from an arbitrary docs/ tree.
//
// Handles BOTH eras. Feb 2026 was a 2D SVG point-and-click (#btn-new, #scene-container);
// from June 2026 it is ABYME, a 3D world behind a Begin gate and an intro camera move.
// Everything is feature-detected so one script covers the whole history.
//
// usage: node capture-island.mjs <docsRoot> <outDir> <label>

import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const [docsRootArg, outDirArg, label] = process.argv.slice(2);
const docsRoot = resolve(docsRootArg);
const outDir = resolve(outDirArg);
await mkdir(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.avif': 'image/avif', '.hdr': 'image/vnd.radiance',
};

const server = await new Promise((res, rej) => {
  const s = createServer(async (req, response) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const target = normalize(join(docsRoot, pathname));
      if (target !== docsRoot && !target.startsWith(docsRoot + sep)) return response.writeHead(403).end();
      const info = await stat(target);
      if (!info.isFile()) return response.writeHead(404).end();
      response.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream' });
      createReadStream(target).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  s.once('error', rej);
  s.listen(0, '127.0.0.1', () => res(s));
});
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const shot = (name) => page.screenshot({ path: join(outDir, `${label}-${name}.png`) });

try {
  await page.goto(`${base}/the-island/?debug&mute&localstack`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const era = await page.evaluate(() => (typeof window.ABYME !== 'undefined' ? '3d' : '2d'));
  console.log(`  ${label}: detected ${era} era`);

  if (era === '3d') {
    // Wait for the Begin gate, clear any save so the world starts clean, then boot
    // through the gate and fast-forward the intro camera.
    await page.waitForFunction(() => document.getElementById('btn-begin'), null, { timeout: 30_000 });
    await page.evaluate(() => {
      try {
        localStorage.setItem('abyme-muted', '1');
        ['abyme-save', 'abyme-ledger-v2'].forEach(k => localStorage.removeItem(k));
      } catch (_) { /* storage blocked — the gate still works */ }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.ABYME !== 'undefined' && document.getElementById('btn-begin'), null, { timeout: 30_000 });
    await page.evaluate(() => document.getElementById('btn-begin').click());
    await page.waitForTimeout(2500);
    // setIntroT exists on current builds; the June build may not have it yet, in
    // which case simply waiting the intro out is enough.
    const skipped = await page.evaluate(() => {
      if (window.ABYME && typeof window.ABYME.setIntroT === 'function') { window.ABYME.setIntroT(99); return true; }
      return false;
    });
    await page.waitForTimeout(skipped ? 3500 : 12_000);
    const world = await page.evaluate(() => {
      const A = window.ABYME;
      const p = A?.player?.pos;
      return { pos: p ? { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) } : null,
               intro: typeof A?.setIntroT === 'function' };
    });
    console.log(`  ${label}: player ${JSON.stringify(world.pos)} introSkip=${world.intro}`);
  } else {
    // 2D SVG era: start a new game and let the first scene draw.
    const newGame = await page.$('#btn-new');
    if (newGame) { await newGame.click(); await page.waitForTimeout(1200); }
    // Dismiss any name/confirm dialog the old build may raise.
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
  }

  await page.mouse.move(3, 3);
  await page.waitForTimeout(800);
  await shot('view');
  console.log(`  ${label}: captured, errors=${errors.length}${errors.length ? ` — ${errors[0].slice(0, 130)}` : ''}`);
} finally {
  await browser.close();
  await new Promise(d => server.close(d));
}
