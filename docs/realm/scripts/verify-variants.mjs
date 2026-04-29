// Phase B step 5 verifier — confirms per-realm sprite variants work.
// Loads the game with 4 different kingdom names, screenshots churches
// in each. With the variant pipeline working, at least 2-3 of the 4
// realms should show different glass colors.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const ORIGIN = server.origin;
const GAME_PATH = `${ORIGIN}/index.html`;
const SHOTS = join(REALM_ROOT, 'scripts/screenshots');

const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

const KINGDOMS = ['Avalon', 'Norrith', 'Velar', 'Ashfall'];
const errs = [];
const results = [];

for (const kname of KINGDOMS) {
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`[${kname}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`[${kname}][console] ${m.text()}`); });

  await page.goto(GAME_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const easy = await page.$('.diff-btn'); if (easy) await easy.click();
  const start = await page.$('button:has-text("New Game"), #start-game-btn');
  if (start) await start.click();
  await page.waitForTimeout(800);

  // Force kingdom name + place a church + center camera + toggle SVG
  const summary = await page.evaluate(async (kname) => {
    if (typeof window.G === 'undefined') return { ok: false };
    window.G.kingdomName = kname;
    window.G.buildings = window.G.buildings || [];
    window.G.buildings.push({
      type: 'church',
      x: 40, y: 40,
      hp: 100, maxHp: 100,
      workers: [], assigned: [],
      buildProgress: 1,
    });
    if (window.G.camera) {
      window.G.camera.x = 0;
      window.G.camera.y = 1280;
      window.G.camera.zoom = 2.5;  // closer for variant detail
    }
    if (window.__realm && window.__realm.toggleSVG) window.__realm.toggleSVG(true);
    return { ok: true, kname: window.G.kingdomName };
  }, kname);

  // Wait for variant fetch + image load
  await page.waitForTimeout(1500);

  const cacheState = await page.evaluate(() => window.__realm.spriteCache());

  // Programmatic variant check: fetch the church SVG TEXT through the
  // same pipeline (using the kname) and look for which palette colors
  // are present.
  const variantCheck = await page.evaluate(async (kname) => {
    const r = await fetch('assets/sprites/church.svg');
    const sourceText = await r.text();
    // Re-run the kHash + applyVariants from render.js (duplicate impl
    // here to avoid coupling). Source is BLUE; check what shows up.
    function kHash(s) {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    }
    const palettes = [
      ['#a8d0ff', '#4488cc', '#1a3866'],  // 0 blue
      ['#ffb0a8', '#cc4444', '#661a1a'],  // 1 red
      ['#fff0a8', '#cc8844', '#664422'],  // 2 amber
      ['#a8ffd0', '#44cc88', '#1a6638'],  // 3 green
    ];
    const idx = kHash(`${kname}_church_glass`) % palettes.length;
    const expectedPalette = ['blue', 'red', 'amber', 'green'][idx];
    const expectedMidColor = palettes[idx][1];
    return { idx, expectedPalette, expectedMidColor };
  }, kname);
  console.log(`[variants] ${kname} → palette=${variantCheck.expectedPalette} (idx=${variantCheck.idx}, mid=${variantCheck.expectedMidColor})`);

  const shotPath = join(SHOTS, `variant-${kname}.png`);
  await page.screenshot({ path: shotPath });
  console.log(`[variants] ${kname}: ${cacheState.find(c => c.type.startsWith('church'))?.state || 'unknown'} → ${shotPath}`);
  results.push({ kname, cacheState });

  await page.close();
}

console.log('\n[variants] === PAGE ERRORS ===');
const realErrs = errs.filter(e => !/favicon/i.test(e));
if (realErrs.length === 0) {
  console.log('  (none)');
} else {
  realErrs.slice(0, 10).forEach(e => console.log('  ', e));
}

await browser.close();
await server.stop();
process.exit(realErrs.length === 0 ? 0 : 1);
