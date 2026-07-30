#!/usr/bin/env node

// Shell-driven visual evidence for the current Engine v2 checkpoint. Unlike
// the deterministic core fixture, this advances the same core+ambient cadence
// a browser host uses, refreshes the HUD, and records bounded presentation
// queues before taking player-facing screenshots.

import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureServer } from './_serve.mjs';
import runtimeContract from '../runtime-contract.json?realm=173' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'loop', 'engine-v2', 'baselines', `v${runtimeContract.moduleRevision}`, 'playable');
const VERIFY = process.argv.includes('--verify');
const TICKS = 7_200;

await mkdir(OUT, { recursive: true });
const server = await ensureServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
});

try {
  await page.goto(`${server.gameUrl}?runtimecapture=1&v=engine-v2-playable-${runtimeContract.moduleRevision}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.step);
  await page.evaluate(() => {
    const name = document.getElementById('kingdom-name-input');
    if (name) name.value = 'Engine V2 Playable';
    window.startNewGame();
    window.G.speed = 0;
  });
  await page.waitForTimeout(600);

  await page.evaluate(async () => {
    const economy = await import('./js/economy.js?realm=173');
    const ui = await import('./js/ui.js?realm=173');
    const g = window.G;
    g.speed = 0;
    g.debug.disableEvents = true;
    g.nextRaidDay = 9999;
    Object.assign(g.resources, {
      wood: 10000, stone: 10000, food: 10000, gold: 10000, iron: 10000,
      wheat: 1000, flour: 1000, planks: 1000, tools: 1000,
    });
    g.researchedTechs = new Set([
      'agriculture', 'forestry', 'masonry', 'engineering', 'metallurgy',
      'commerce', 'military', 'brewing', 'architecture', 'baking',
      'husbandry', 'smithing', 'archery', 'guilds', 'monuments',
    ]);
    g.era = 3;
    g.eraStartDay = { 1: 1, 2: 1, 3: 1 };
    for (const row of g.fog) row.fill(true);

    const candidates = [];
    for (let y = 1; y < g.map.length - 1; y++) {
      for (let x = 1; x < g.map[y].length - 1; x++) {
        candidates.push({ x, y, distance: Math.abs(x - 40) + Math.abs(y - 40) });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const placed = [];
    for (const type of [
      'house', 'house', 'house', 'house', 'farm', 'farm', 'lumber', 'quarry',
      'mine', 'storehouse', 'granary', 'market', 'tavern', 'blacksmith',
      'barracks', 'school',
    ]) {
      const spot = candidates.find(({ x, y }) => g.debug.dispatch({
        type: 'PLACE_BUILDING', building: type, x, y,
      }).ok);
      if (!spot) throw new Error(`Could not place ${type}`);
      placed.push({ type, x: spot.x, y: spot.y });
    }
    economy.trySpawnSettlers(12);
    g.resources.food = 10000;
    g.nextRaidDay = 9999;
    const viewX = placed.reduce((sum, value) => sum + value.x, 0) / placed.length;
    const viewY = placed.reduce((sum, value) => sum + value.y, 0) / placed.length;
    g.camera.x = (viewX - viewY) * 32;
    g.camera.y = (viewX + viewY) * 16;
    ui.renderBuildBar();
    ui.updateUI();
    g.debug.step(7200);
    ui.updateUI();
    window.forceRender();
  });

  const manifest = await page.evaluate(revision => {
    const g = window.G;
    return {
      moduleRevision: revision,
      executionMode: 'browser-core-plus-shell',
      gameTick: g.gameTick,
      day: g.day,
      population: g.population,
      buildings: g.buildings.length,
      hud: document.getElementById('day-display')?.textContent || '',
      presentation: {
        particles: g.particles?.length || 0,
        animals: g.animals?.length || 0,
        birds: g.birds?.length || 0,
        carts: g.carts?.length || 0,
        footprints: g.footprints?.length || 0,
      },
      pageErrors: [],
    };
  }, runtimeContract.moduleRevision);
  manifest.pageErrors = [...errors];
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  if (manifest.gameTick !== TICKS || manifest.day !== 3) {
    throw new Error(`playable fixture reached tick ${manifest.gameTick}, day ${manifest.day}; expected ${TICKS}/3`);
  }
  if (!/^Year 1, Day 3\b/.test(manifest.hud)) {
    throw new Error(`HUD is not synchronized with day 3: ${JSON.stringify(manifest.hud)}`);
  }
  if (manifest.presentation.particles > 500) {
    throw new Error(`playable particle queue is not bounded: ${manifest.presentation.particles}`);
  }

  if (VERIFY) {
    const expected = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
    for (const field of ['moduleRevision', 'executionMode', 'gameTick', 'day', 'population', 'buildings']) {
      if (manifest[field] !== expected[field]) {
        throw new Error(`playable manifest ${field} changed: expected ${expected[field]}, got ${manifest[field]}`);
      }
    }
  } else {
    await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    const originalPhase = await page.evaluate(() => window.G.dayPhase);
    for (const [name, fraction] of [['dawn', 0.20], ['day', 0.50], ['dusk', 0.76], ['night', 0.93]]) {
      await page.evaluate(async value => {
        const ui = await import('./js/ui.js?realm=173');
        window.G.dayPhase = Math.round(window.G.dayLength * value);
        ui.updateUI();
        window.forceRender();
      }, fraction);
      await page.waitForTimeout(80);
      await page.screenshot({ path: join(OUT, `${name}.png`) });
    }
    await page.evaluate(value => { window.G.dayPhase = value; }, originalPhase);
  }

  console.log(`✓ shell-driven HUD matches tick ${manifest.gameTick}, day ${manifest.day}`);
  console.log(`✓ bounded presentation ${JSON.stringify(manifest.presentation)}`);
  console.log(`[engine-v2-playable-baseline] ${VERIFY ? 'verified' : 'wrote'} ${OUT}`);
} finally {
  await browser.close();
  await server.stop();
}
