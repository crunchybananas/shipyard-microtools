// Realm verify-batch driver. Uses the existing Playwright install at
// /Users/cloken/code/peel/admin/node_modules/playwright to avoid
// adding a heavy dep to this monorepo.
//
// Usage:
//   node docs/realm/scripts/verify.mjs [--game | --sandbox | --logic | --all]
//
// Defaults to --all. Non-headless so the user can watch.
//
// Loop 215 → 216: Phase B verification driver. Bridge replaced by
// Playwright per chrome-extension MCP outage.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(REALM_ROOT, 'scripts/screenshots');

const server = await ensureServer();
console.log(`[verify] http origin ${server.origin} (started=${server.started})`);
const ORIGIN = server.origin;
const GAME_PATH = `${ORIGIN}/index.html`;
const SANDBOX_PATH = `${ORIGIN}/svg-test/index.html`;

const args = process.argv.slice(2);
const flags = {
  game: args.includes('--game') || args.includes('--all') || args.length === 0,
  sandbox: args.includes('--sandbox') || args.includes('--all') || args.length === 0,
  logic: args.includes('--logic') || args.includes('--all') || args.length === 0,
  hold: args.includes('--hold'),  // keep browser open at end
};

// Default headless for overnight autonomy. Set HEADED=1 to see the
// browser window for debug.
const HEADLESS = process.env.HEADED !== '1';
console.log(`[verify] launching chromium (headless=${HEADLESS})…`);
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// ─── 1. live game smoke test ─────────────────────────────────
if (flags.game) {
  console.log('\n[verify] === LIVE GAME SMOKE ===');
  const page = await ctx.newPage();
  const consoleMessages = [];
  page.on('console', m => consoleMessages.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => consoleMessages.push(`[pageerror] ${e.message}`));

  await page.goto(GAME_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);  // let modules + initial render settle

  // Try to bypass title screen if there is one.
  const startBtn = await page.$('button:has-text("Start"), button:has-text("Begin"), .diff-btn');
  if (startBtn) {
    console.log('[verify] clicking start/diff button to enter game');
    await startBtn.click();
    await page.waitForTimeout(1000);
  }

  // Snapshot core game state via window.G (if exposed).
  const state = await page.evaluate(() => {
    if (typeof window.G === 'undefined') return { exposed: false };
    return {
      exposed: true,
      day: window.G.day,
      season: window.G.season,
      population: window.G.population,
      buildings: (window.G.buildings || []).length,
      chronicleLen: (window.G.chronicle || []).length,
      lastRaidDay: window.G.lastRaidDay,
      realmEnded: window.G.realmEnded,
      namedCharacters: window.G.namedCharacters && Object.keys(window.G.namedCharacters),
      stats_raidsSurvived: window.G.stats?.raidsSurvived,
    };
  });
  console.log('[verify] G state:', JSON.stringify(state, null, 2));

  await page.screenshot({ path: join(SCREENSHOT_DIR, 'game-initial.png'), fullPage: false });
  console.log('[verify] saved screenshots/game-initial.png');

  if (consoleMessages.length) {
    console.log('[verify] console output (last 20):');
    consoleMessages.slice(-20).forEach(m => console.log('  ', m));
  }
  await page.close();
}

// ─── 2. sandbox SVG sprite check ────────────────────────────
if (flags.sandbox) {
  console.log('\n[verify] === SVG SANDBOX (11 sprites) ===');
  const page = await ctx.newPage();
  await page.goto(SANDBOX_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const sprites = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img, object, svg'));
    return imgs.slice(0, 50).map(el => ({
      tag: el.tagName,
      src: el.src || el.data || '(inline svg)',
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
  });
  console.log(`[verify] sandbox elements found: ${sprites.length}`);
  sprites.slice(0, 15).forEach(s => console.log(`  ${s.tag} ${s.width}×${s.height} ${s.src.slice(-50)}`));

  await page.screenshot({ path: join(SCREENSHOT_DIR, 'sandbox.png'), fullPage: true });
  console.log('[verify] saved screenshots/sandbox.png (full page)');
  await page.close();
}

// ─── 3. logic correctness queue ─────────────────────────────
if (flags.logic) {
  console.log('\n[verify] === LOGIC CORRECTNESS QUEUE ===');
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(GAME_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const startBtn = await page.$('button:has-text("Start"), button:has-text("Begin"), .diff-btn');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(1000); }

  // Pull the diagnostic surface.
  const diag = await page.evaluate(() => {
    if (typeof window.G === 'undefined') return { exposed: false };
    const g = window.G;
    return {
      exposed: true,
      // 192/197: G.realmEnded reachable
      realmEnded_field: 'realmEnded' in g,
      realmEnded_initial: g.realmEnded,
      // 211: G.lastRaidDay infrastructure
      lastRaidDay_field_initial: g.lastRaidDay,
      // 201: bard mechanic plumbing
      namedCharacters_initial: g.namedCharacters && Object.keys(g.namedCharacters),
      // 206/209: raid spawn site reachable
      nextRaidDay: g.nextRaidDay,
      raidInterval: g.raidInterval,
      // NARRATIVE_BEATS sanity (33+ entries with recent flags)
      hasFlag_first_long_evening: g.storyFlags?.first_long_evening,
      hasFlag_first_cold_morning: g.storyFlags?.first_cold_morning,
      hasFlag_fields_know_realm: g.storyFlags?.fields_know_realm,
      hasFlag_first_sigh_seen: g.storyFlags?.first_sigh_seen,
      hasFlag_sustained_peace_known: g.storyFlags?.sustained_peace_known,
    };
  });
  console.log('[verify] diagnostic:', JSON.stringify(diag, null, 2));

  if (errors.length) {
    console.log('[verify] PAGE ERRORS:');
    errors.forEach(e => console.log('  ', e));
  } else {
    console.log('[verify] no page errors');
  }
  await page.close();
}

if (flags.hold) {
  console.log('\n[verify] --hold passed; keeping browser open. Ctrl-C to exit.');
  await new Promise(() => {});
} else {
  await browser.close();
  await server.stop();
  console.log('\n[verify] done. Browser closed.');
}
