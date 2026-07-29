// Realm verify-batch driver. Playwright is declared by the repository so this
// gate runs identically on local workstations and CI.
//
// Usage:
//   node docs/realm/scripts/verify.mjs [--game | --logic | --all]
//
// Defaults to live game + logic. Graphics verification targets the canonical
// painted-PNG canvas renderer only.
//
// Loop 215 → 216: Phase B verification driver. Bridge replaced by
// Playwright per chrome-extension MCP outage.

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(REALM_ROOT, 'scripts/screenshots');

const server = await ensureServer();
console.log(`[verify] game url ${server.gameUrl} (mode=${server.mode}, started=${server.started})`);
const GAME_PATH = server.gameUrl;

const args = process.argv.slice(2);
const flags = {
  game: args.includes('--game') || args.includes('--all') || args.length === 0,
  logic: args.includes('--logic') || args.includes('--all') || args.length === 0,
  hold: args.includes('--hold'),  // keep browser open at end
};

// Default headless for overnight autonomy. Set HEADED=1 to see the
// browser window for debug.
const HEADLESS = process.env.HEADED !== '1';
console.log(`[verify] launching chromium (headless=${HEADLESS})…`);
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const failures = [];

async function startGameIfNeeded(page) {
  const started = await page.evaluate(() => {
    if (!document.body.classList.contains('title-active')) return false;
    if (typeof window.startNewGame === 'function') {
      window.startNewGame();
      return true;
    }
    return false;
  });
  if (started) {
    console.log('[verify] starting game from title screen');
    await page.waitForTimeout(1000);
  }
}

async function verifyFarmPlacement(page) {
  // The tutorial pulse intentionally animates this button, so a normal
  // Playwright click can wait forever for geometric stability even though the
  // control is visible and enabled. Force keeps this smoke test focused on
  // the actual build-command path.
  await page.locator('[data-build-key="farm"]').click({ force: true });
  await page.waitForTimeout(100);

  const target = await page.evaluate(() => {
    const g = window.G;
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    const TW = 64, TH = 32;
    const candidates = [];
    for (let y = 0; y < g.map.length; y++) {
      for (let x = 0; x < g.map[y].length; x++) {
        if (g.map[y][x] !== 2 || !g.fog[y]?.[x] || g.buildingGrid[y]?.[x]) continue;
        const sx = (x - y) * TW / 2;
        const sy = (x + y) * TH / 2;
        const clientX = rect.left + (sx - g.camera.x) * g.camera.zoom + rect.width / 2;
        const clientY = rect.top + (sy - g.camera.y) * g.camera.zoom + rect.height / 2;
        if (clientX > 80 && clientX < rect.width - 80 && clientY > 80 && clientY < rect.height - 180) {
          candidates.push({ x, y, clientX, clientY });
        }
      }
    }
    candidates.sort((a, b) => {
      const ac = Math.hypot(a.clientX - rect.width / 2, a.clientY - rect.height / 2);
      const bc = Math.hypot(b.clientX - rect.width / 2, b.clientY - rect.height / 2);
      return ac - bc;
    });
    return {
      beforeWood: g.resources.wood,
      beforeBuildings: g.buildings.length,
      target: candidates[0] || null,
    };
  });

  if (!target.target) throw new Error('No visible explored grass tile found for farm placement smoke test');
  await page.mouse.move(target.target.clientX, target.target.clientY);
  await page.mouse.click(target.target.clientX, target.target.clientY);
  await page.waitForTimeout(300);

  const placed = await page.evaluate(({ beforeWood, beforeBuildings }) => ({
    selectedBuild: window.G.selectedBuild,
    woodDelta: beforeWood - window.G.resources.wood,
    newBuildings: window.G.buildings.length - beforeBuildings,
    farm: window.G.buildings.find(b => b.type === 'farm') || null,
  }), target);
  if (!placed.farm || placed.newBuildings !== 1) {
    throw new Error(`Farm placement failed: ${JSON.stringify(placed)}`);
  }
  console.log(`[verify] farm placement ok at ${placed.farm.x},${placed.farm.y} (wood delta ${placed.woodDelta})`);
}

// ─── 1. live game smoke test ─────────────────────────────────
if (flags.game) {
  console.log('\n[verify] === LIVE GAME SMOKE ===');
  const page = await ctx.newPage();
  const consoleMessages = [];
  const browserErrors = [];
  page.on('console', m => {
    const message = `[${m.type()}] ${m.text()}`;
    consoleMessages.push(message);
    if (m.type() === 'error') browserErrors.push(message);
  });
  page.on('pageerror', e => {
    const message = `[pageerror] ${e.message}`;
    consoleMessages.push(message);
    browserErrors.push(message);
  });

  await page.goto(GAME_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);  // let modules + initial render settle

  await startGameIfNeeded(page);
  await verifyFarmPlacement(page);

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
  if (browserErrors.length) failures.push(...browserErrors.map(message => `live game: ${message}`));
  await page.close();
}

// ─── 2. logic correctness queue ─────────────────────────────
if (flags.logic) {
  console.log('\n[verify] === LOGIC CORRECTNESS QUEUE ===');
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(GAME_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  await startGameIfNeeded(page);

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
  if (errors.length) failures.push(...errors.map(message => `logic page: ${message}`));
  await page.close();

  // Embedded and preview contexts can report "hidden" from boot while still
  // being watched. The timer-driven branch must paint the minimap too.
  console.log('\n[verify] === HIDDEN-BOOT MINIMAP ===');
  const hiddenPage = await ctx.newPage();
  await hiddenPage.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { get: () => true });
  });
  const hiddenErrors = [];
  hiddenPage.on('pageerror', error => hiddenErrors.push(error.message));
  await hiddenPage.goto(GAME_PATH);
  await hiddenPage.waitForLoadState('domcontentloaded');
  await hiddenPage.waitForTimeout(2000);
  await startGameIfNeeded(hiddenPage);
  await hiddenPage.waitForTimeout(1500);
  const minimap = await hiddenPage.evaluate(() => {
    const canvas = document.getElementById('minimap');
    if (!canvas) return { exists: false };
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 255) opaque++;
      colors.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
    }
    return {
      exists: true,
      visibilityState: document.visibilityState,
      opaqueFraction: opaque / (pixels.length / 4),
      distinctColors: colors.size,
    };
  });
  if (hiddenErrors.length) {
    failures.push(...hiddenErrors.map(message => `hidden-boot page: ${message}`));
  }
  if (!minimap.exists) failures.push('hidden-boot minimap canvas is missing');
  if (minimap.visibilityState !== 'hidden') failures.push('hidden-boot visibility override failed');
  if (minimap.opaqueFraction < 0.9 || minimap.distinctColors < 8) {
    failures.push(`hidden-boot minimap did not paint: ${JSON.stringify(minimap)}`);
  } else {
    console.log('[verify] minimap paints under hidden-boot visibility');
  }
  await hiddenPage.close();
}

if (flags.hold) {
  console.log('\n[verify] --hold passed; keeping browser open. Ctrl-C to exit.');
  await new Promise(() => {});
} else {
  await browser.close();
  await server.stop();
  if (failures.length) {
    console.error(`\n[verify] FAILED — ${failures.length} browser error${failures.length === 1 ? '' : 's'}`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  }
  console.log('\n[verify] done. Browser closed.');
}
