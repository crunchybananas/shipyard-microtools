// Capture or verify the living-town baseline for the active runtime checkpoint.
// Historical revision directories remain immutable; a runtime revision bump
// creates a new record rather than overwriting prior behavior.

import { chromium } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';
import runtimeContract from '../runtime-contract.json?realm=183' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MODULE_REVISION = runtimeContract.moduleRevision;
const OUT = join(ROOT, 'loop', 'engine-v2', 'baselines', `v${MODULE_REVISION}`);
const TICKS = 7200;
const VERIFY = process.argv.includes('--verify');

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
  await page.goto(`${server.gameUrl}?runtimecapture=1&v=engine-v2-baseline-v${MODULE_REVISION}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.step);

  await page.evaluate(() => {
    const name = document.getElementById('kingdom-name-input');
    if (name) name.value = 'Engine V2 Baseline';
    window.startNewGame();
    window.G.speed = 0;
  });

  const setup = await page.evaluate(async () => {
    const economy = await import('./js/economy.js?realm=183');
    const ui = await import('./js/ui.js?realm=183');
    const g = window.G;
    g.speed = 0;
    g.debug.disableEvents = true;
    g.nextRaidDay = 9999;
    g.resources = {
      wood: 10000, stone: 10000, food: 10000, gold: 10000, iron: 10000,
      wheat: 1000, flour: 1000, planks: 1000, tools: 1000,
    };
    g.researchedTechs = new Set([
      'agriculture', 'forestry', 'masonry', 'engineering', 'metallurgy',
      'commerce', 'military', 'brewing', 'architecture', 'baking',
      'husbandry', 'smithing', 'archery', 'guilds', 'monuments',
    ]);
    g.era = 3;
    g.eraStartDay = { 1: 1, 2: 1, 3: 1 };
    for (const row of g.fog) row.fill(true);

    const placed = [];
    const placeFirst = type => {
      const cx = Math.round(g.map[0].length / 2);
      const cy = Math.round(g.map.length / 2);
      const candidates = [];
      for (let y = 1; y < g.map.length - 1; y++) {
        for (let x = 1; x < g.map[y].length - 1; x++) {
          candidates.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
        }
      }
      candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
      for (const { x, y } of candidates) {
        const result = g.debug.dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
        if (!result.ok) continue;
        placed.push({ type, x, y });
        return true;
      }
      return false;
    };

    for (const type of [
      'house', 'house', 'house', 'house', 'farm', 'farm', 'lumber', 'quarry',
      'mine', 'storehouse', 'granary', 'market', 'tavern', 'blacksmith',
      'barracks', 'school',
    ]) placeFirst(type);

    economy.trySpawnSettlers(12);
    g.resources.food = 10000;
    g.nextRaidDay = 9999;
    const viewX = placed.reduce((sum, b) => sum + b.x, 0) / Math.max(1, placed.length);
    const viewY = placed.reduce((sum, b) => sum + b.y, 0) / Math.max(1, placed.length);
    g.camera.x = (viewX - viewY) * 32;
    g.camera.y = (viewX + viewY) * 16;
    ui.renderBuildBar();
    ui.updateUI();
    return { placed, population: g.population, maxPop: g.maxPop };
  });

  const baseline = await page.evaluate(async ({ revision, ticks }) => {
    const [presentation, ownership, sim] = await Promise.all([
      import('./js/citizen-presentation.js?realm=183'),
      import('./js/citizen-ownership.js?realm=183'),
      import('./js/sim.js?realm=183'),
    ]);
    const g = window.G;
    // The current engine lets requestAnimationFrame drain presentation
    // particles while work effects consume the seeded simulation RNG behind a
    // particle-count cap. Normalize that known Phase 0 leak so this baseline
    // measures the town rather than browser scheduling between evaluate calls.
    g.particles.length = 0;
    const prior = new Map();
    const transitions = {
      role: 0,
      profession: 0,
      assignment: 0,
      activity: 0,
      carrying: 0,
    };
    const sample = citizen => {
      const snapshot = presentation.buildCitizenPresentation(citizen);
      return {
        role: snapshot.variant,
        profession: snapshot.profession.kind,
        assignment: snapshot.assignment
          ? `${snapshot.assignment.building.type}@${snapshot.assignment.building.x},${snapshot.assignment.building.y}:${snapshot.assignment.purpose}`
          : null,
        activity: snapshot.activity.kind,
        carrying: snapshot.carrying || null,
      };
    };
    for (const citizen of g.citizens) prior.set(citizen.actorId, sample(citizen));

    const checkpoints = [];
    for (let tick = 1; tick <= ticks; tick++) {
      sim.coreTick();
      for (const citizen of g.citizens) {
        const next = sample(citizen);
        const before = prior.get(citizen.actorId);
        if (before) {
          if (before.role !== next.role) transitions.role++;
          if (before.profession !== next.profession) transitions.profession++;
          if (before.assignment !== next.assignment) transitions.assignment++;
          if (before.activity !== next.activity) transitions.activity++;
          if (before.carrying !== next.carrying) transitions.carrying++;
        }
        prior.set(citizen.actorId, next);
      }
      if (tick % 1800 === 0) {
        checkpoints.push({
          tick: g.gameTick,
          day: g.day,
          dayPhase: g.dayPhase,
          population: g.population,
          resources: { ...g.resources },
          actors: [...g.citizens].sort((a, b) => a.actorId - b.actorId)
            .map(c => {
              const snapshot = presentation.buildCitizenPresentation(c);
              return [
                snapshot.actorId,
                snapshot.identity.name,
                snapshot.variant,
                snapshot.profession.kind,
                snapshot.activity.kind,
              ];
            }),
        });
      }
    }

    const buildingIndex = building => g.buildings.indexOf(building);
    return {
      schema: 2,
      executionMode: 'deterministic-core-only',
      moduleRevision: revision,
      kingdom: g.kingdomName,
      gameTick: g.gameTick,
      day: g.day,
      dayPhase: g.dayPhase,
      population: g.population,
      maxPop: g.maxPop,
      resources: { ...g.resources },
      transitionCounts: transitions,
      checkpoints,
      citizens: [...g.citizens].sort((a, b) => a.actorId - b.actorId).map(c => ({
        actorId: c.actorId,
        name: c.identity.name,
        appearanceId: c.identity.appearanceId,
        role: presentation.buildCitizenPresentation(c).variant,
        profession: { ...c.profession },
        assignment: c.assignment ? {
          kind: c.assignment.kind,
          buildingIndex: buildingIndex(c.assignment.building),
          duty: c.assignment.duty,
          purpose: c.assignment.purpose,
          sinceTick: c.assignment.sinceTick,
          reason: c.assignment.reason,
        } : null,
        activity: { ...c.activity },
        homeBuildingIndex: c.home ? buildingIndex(c.home) : -1,
        activityTimer: c.activityTimer,
        x: Number(c.x.toFixed(6)),
        y: Number(c.y.toFixed(6)),
        tx: Number(c.tx.toFixed(6)),
        ty: Number(c.ty.toFixed(6)),
        carrying: c.carrying || null,
        carryAmount: c.carryAmount || 0,
        hunger: Number(c.hunger.toFixed(4)),
        rest: Number((c.rest ?? 100).toFixed(4)),
      })),
      buildings: g.buildings.map((b, index) => ({
        index,
        type: b.type,
        x: b.x,
        y: b.y,
        buildProgress: Number(b.buildProgress.toFixed(6)),
        workerActorIds: ownership.workersForBuilding(b).map(worker => worker.actorId),
        produced: b.produced || null,
        prodTimer: b.prodTimer || 0,
      })),
    };
  }, { revision: MODULE_REVISION, ticks: TICKS });

  baseline.fixtureSetup = setup;
  baseline.pageErrors = errors;
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);

  if (VERIFY) {
    const expected = JSON.parse(await readFile(join(OUT, 'state.json'), 'utf8'));
    if (!isDeepStrictEqual(baseline, expected)) {
      const summarize = value => ({
        tick: value.gameTick,
        day: value.day,
        population: value.population,
        buildings: value.buildings.length,
        resources: value.resources,
        transitionCounts: value.transitionCounts,
      });
      throw new Error(`current living-town behavior diverged from the recorded pre-Engine-v2 baseline\n`
        + `expected=${JSON.stringify(summarize(expected))}\n`
        + `actual=${JSON.stringify(summarize(baseline))}`);
    }
    console.log(`[engine-v2-baseline] verified ${OUT}`);
  } else {
    await writeFile(join(OUT, 'state.json'), `${JSON.stringify(baseline, null, 2)}\n`);
    // Core-only state capture intentionally has no screenshots: its shell/UI
    // queues do not advance. Player-facing dawn/day/dusk/night evidence comes
    // from capture-engine-v2-playable-baseline.mjs in vN/playable/.
    console.log(`[engine-v2-baseline] wrote ${OUT}`);
  }
  console.log(`[engine-v2-baseline] tick=${baseline.gameTick} day=${baseline.day} pop=${baseline.population} buildings=${baseline.buildings.length}`);
  console.log(`[engine-v2-baseline] transitions=${JSON.stringify(baseline.transitionCounts)}`);
} finally {
  await browser.close();
  await server.stop();
}
