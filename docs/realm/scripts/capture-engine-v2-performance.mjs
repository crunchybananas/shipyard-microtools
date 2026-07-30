// Engine v2 Phase 1A same-host performance gate.
//
// This is deliberately a capture-and-gate command, not a portable benchmark.
// RFC 0003's +5% budget is meaningful only against the realm-163 capture on
// the same Apple M4/browser stack. Every run writes both JSON and Markdown,
// including failed gates, so a red result remains inspectable evidence.

import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { performance as nodePerformance } from 'node:perf_hooks';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimeContract from '../runtime-contract.json?realm=174' with { type: 'json' };
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'loop', 'engine-v2', 'baselines');
const BASELINE_FILE = join(OUT_DIR, 'performance-v163.json');
const OUT_JSON = join(OUT_DIR, `performance-v${runtimeContract.moduleRevision}.json`);
const OUT_MARKDOWN = join(OUT_DIR, `performance-v${runtimeContract.moduleRevision}.md`);

const REQUIRED_TRIALS = 5;
const CORE_BATCH_TICKS = 120;
const CORE_BATCH_SAMPLES = 20;
const CORE_WARMUP_TICKS = 1800;
const STEADY_RENDER_SAMPLES = 120;
const PARTICLE_RENDER_SAMPLES = 60;
const DRAW_COUNT_SAMPLES = 8;
const SAVE_SAMPLES = 5;
const RAF_SAMPLES = 120;
const SNAPSHOT_ACTOR_COUNTS = Object.freeze([100, 250]);
const SNAPSHOT_WARMUP_SAMPLES = 5;
const SNAPSHOT_SAMPLES = 30;
const MAX_REGRESSION_RATIO = 1.05;
const MAX_SAVE_BYTES = 1024 * 1024;
const MAX_SNAPSHOT_CACHE_BYTES_PER_ACTOR = 16 * 1024;
const MAX_RELEASED_STRESS_HEAP_BYTES = 1024 * 1024;

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return parsed;
}

const trialCount = Math.max(
  REQUIRED_TRIALS,
  positiveInteger(process.env.REALM_PERF_TRIALS || REQUIRED_TRIALS, 'REALM_PERF_TRIALS'),
);

function stats(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.some(value => !Number.isFinite(value))) {
    throw new TypeError('Performance statistics require one or more finite samples.');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = value => sorted[Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * value),
  )];
  return {
    samples: sorted.length,
    min: sorted[0],
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1),
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function chromiumVersion(userAgent) {
  return /(?:HeadlessChrome|Chrome)\/([0-9.]+)/.exec(userAgent || '')?.[1] || null;
}

function environmentFingerprint(host, browser) {
  return {
    platform: host.platform,
    release: host.release,
    cpuModel: host.cpuModel,
    logicalCpuCount: host.logicalCpuCount,
    node: host.node,
    chromium: chromiumVersion(browser.userAgent),
    hardwareConcurrency: browser.hardwareConcurrency,
    deviceMemory: browser.deviceMemory,
    devicePixelRatio: browser.devicePixelRatio,
    viewport: browser.viewport,
  };
}

function comparison(observed, baseline, ratio = MAX_REGRESSION_RATIO) {
  const limit = baseline * ratio;
  return {
    observed,
    baseline,
    limit,
    ratio: observed / baseline,
    percentChange: ((observed / baseline) - 1) * 100,
    pass: observed <= limit,
  };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatInteger(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : 'n/a';
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const sign = value < 0 ? '-' : '';
  const amount = Math.abs(value);
  if (amount >= 1024 * 1024) return `${sign}${(amount / (1024 * 1024)).toFixed(2)} MiB`;
  if (amount >= 1024) return `${sign}${(amount / 1024).toFixed(1)} KiB`;
  return `${sign}${Math.round(amount)} B`;
}

function actorAtlasBudget(finalState) {
  // Realm 163's flattened actor contract is one atlas draw for each citizen,
  // soldier, service walker, caravan, enemy, and the founder. Animals use the
  // ambient atlas. The reference fixture has no caravans or enemies.
  return (
    finalState.citizens
    + finalState.soldiers
    + finalState.walkers
    + finalState.caravans
    + finalState.enemies
    + 1
  );
}

function referenceFixtureRecord(setup, finalState) {
  return {
    placed: setup.placed,
    population: setup.population,
    buildings: setup.buildings,
    finalState: {
      gameTick: finalState.gameTick,
      day: finalState.day,
      population: finalState.population,
      buildings: finalState.buildings,
      citizens: finalState.citizens,
      soldiers: finalState.soldiers,
      enemies: finalState.enemies,
      walkers: finalState.walkers,
      caravans: finalState.caravans,
    },
  };
}

function passGate(id, description, evidence = {}) {
  return { id, description, pass: true, ...evidence };
}

function failGate(id, description, evidence = {}) {
  return { id, description, pass: false, ...evidence };
}

function gate(id, description, passed, evidence = {}) {
  return passed
    ? passGate(id, description, evidence)
    : failGate(id, description, evidence);
}

async function runTrial(browser, server, host, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [];

  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
  });

  // Count Canvas2D drawImage submissions without changing production code.
  // Timings are captured with the meter disabled; draw counts use a separate
  // short pass so wrapper overhead cannot contaminate the +5% timing gate.
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    const state = {
      active: false,
      total: 0,
      actorAtlas: 0,
      bySource: Object.create(null),
    };
    const sourceName = source => {
      const url = source?.currentSrc || source?.src || '';
      if (typeof url === 'string' && url) {
        try {
          const parsed = new URL(url, location.href);
          return parsed.pathname.split('/').at(-1) || parsed.pathname;
        } catch {
          return url;
        }
      }
      if (source instanceof HTMLCanvasElement) return '[canvas]';
      if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) return '[offscreen-canvas]';
      if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) return '[image-bitmap]';
      return `[${source?.constructor?.name || 'unknown'}]`;
    };
    CanvasRenderingContext2D.prototype.drawImage = function drawImageMeter(...args) {
      if (state.active) {
        const name = sourceName(args[0]);
        state.total++;
        state.bySource[name] = (state.bySource[name] || 0) + 1;
        if (/^actors-atlas(?:-[a-z]+)?\.png$/.test(name)) state.actorAtlas++;
      }
      return Reflect.apply(original, this, args);
    };
    window.__realmPerfDrawMeter = Object.freeze({
      start() {
        state.total = 0;
        state.actorAtlas = 0;
        state.bySource = Object.create(null);
        state.active = true;
      },
      stop() {
        state.active = false;
        return {
          total: state.total,
          actorAtlas: state.actorAtlas,
          bySource: { ...state.bySource },
        };
      },
    });
  });

  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');

  async function collectMemory(label) {
    const started = nodePerformance.now();
    await cdp.send('HeapProfiler.collectGarbage');
    const gcCollectionMs = nodePerformance.now() - started;
    const metrics = await cdp.send('Performance.getMetrics');
    const values = Object.fromEntries(metrics.metrics.map(metric => [metric.name, metric.value]));
    const browserMemory = await page.evaluate(() => {
      const memory = performance.memory;
      return memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null;
    });
    return {
      label,
      gcCollectionMs,
      jsHeapUsedBytes: values.JSHeapUsedSize ?? browserMemory?.usedJSHeapSize ?? null,
      jsHeapTotalBytes: values.JSHeapTotalSize ?? browserMemory?.totalJSHeapSize ?? null,
      jsHeapLimitBytes: browserMemory?.jsHeapSizeLimit ?? null,
      domNodes: values.Nodes ?? null,
      documents: values.Documents ?? null,
      listeners: values.JSEventListeners ?? null,
    };
  }

  try {
    const revision = runtimeContract.moduleRevision;
    await page.goto(`${server.gameUrl}?runtimecapture=1&v=phase1a-perf-${revision}-trial-${index}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.dispatch);
    await page.evaluate(() => {
      const name = document.getElementById('kingdom-name-input');
      if (name) name.value = 'Engine V2 Perf';
      window.startNewGame();
      window.G.speed = 0;
    });

    const setup = await page.evaluate(async () => {
      const economy = await import('./js/economy.js?realm=174');
      const g = window.G;
      g.speed = 0;
      g.debug.disableEvents = true;
      g.nextRaidDay = 9999;
      for (const key of Object.keys(g.resources)) g.resources[key] = 100000;
      g.researchedTechs = new Set([
        'agriculture', 'forestry', 'masonry', 'engineering', 'metallurgy',
        'commerce', 'military', 'brewing', 'architecture', 'baking',
        'husbandry', 'smithing', 'archery', 'guilds', 'monuments',
      ]);
      g.era = 3;
      g.eraStartDay = { 1: 1, 2: 1, 3: 1 };
      for (const row of g.fog) row.fill(true);

      const candidates = [];
      const centerX = Math.round(g.map[0].length / 2);
      const centerY = Math.round(g.map.length / 2);
      for (let y = 1; y < g.map.length - 1; y++) {
        for (let x = 1; x < g.map[y].length - 1; x++) {
          candidates.push({ x, y, distance: Math.abs(x - centerX) + Math.abs(y - centerY) });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      const placed = [];
      const place = type => {
        for (const { x, y } of candidates) {
          const result = g.debug.dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
          if (!result.ok) continue;
          placed.push({ type, x, y });
          return;
        }
        throw new Error(`Could not place performance fixture building ${type}`);
      };
      const plan = [
        ...Array(15).fill('house'),
        ...Array(4).fill('farm'),
        ...Array(3).fill('lumber'),
        ...Array(3).fill('quarry'),
        ...Array(2).fill('mine'),
        ...Array(2).fill('storehouse'),
        ...Array(2).fill('granary'),
        ...Array(2).fill('market'),
        ...Array(2).fill('tavern'),
        ...Array(2).fill('school'),
        ...Array(2).fill('blacksmith'),
        'barracks', 'archery', 'church', 'well', 'windmill', 'bakery',
      ];
      for (const type of plan) place(type);
      for (const building of g.buildings) building.buildProgress = 1;
      economy.trySpawnSettlers(80);
      g.resources.food = 100000;
      g.nextRaidDay = 9999;
      const viewX = placed.reduce((sum, building) => sum + building.x, 0) / placed.length;
      const viewY = placed.reduce((sum, building) => sum + building.y, 0) / placed.length;
      g.camera.x = (viewX - viewY) * 32;
      g.camera.y = (viewX + viewY) * 16;
      return {
        placed,
        population: g.population,
        buildings: g.buildings.length,
        camera: { x: g.camera.x, y: g.camera.y, zoom: g.camera.zoom },
      };
    });

    if (setup.population < 50 || setup.buildings < 40) {
      throw new Error(`Performance fixture is too small: ${JSON.stringify(setup)}`);
    }

    // Render until all production atlases are decoded. A cold/partially decoded
    // frame is neither a valid timing sample nor valid draw-count evidence.
    await page.waitForFunction(() => (
      window.__realm?.spriteCache?.().every(record => record.state === 'ready')
    ), { timeout: 30_000 });
    await page.evaluate(() => {
      for (let i = 0; i < 12; i++) window.forceRender();
    });
    const memoryAfterSetup = await collectMemory('after-setup');

    const core = await page.evaluate(async ({
      warmupTicks,
      batchTicks,
      batchSamples,
    }) => {
      const { coreTick } = await import('./js/sim.js?realm=174');
      const g = window.G;
      for (let i = 0; i < warmupTicks; i++) coreTick();
      const durations = [];
      for (let batch = 0; batch < batchSamples; batch++) {
        const start = performance.now();
        for (let tick = 0; tick < batchTicks; tick++) coreTick();
        durations.push(performance.now() - start);
      }
      return {
        batchTicks,
        durations,
        gameTick: g.gameTick,
        day: g.day,
        population: g.population,
        buildings: g.buildings.length,
        citizens: g.citizens.length,
        soldiers: g.soldiers.length,
        enemies: g.enemies.length,
        walkers: g.walkers.length,
        caravans: g.caravans.length,
        particles: g.particles.length,
        activePaths: g.citizens.filter(citizen => citizen.path).length,
      };
    }, {
      warmupTicks: CORE_WARMUP_TICKS,
      batchTicks: CORE_BATCH_TICKS,
      batchSamples: CORE_BATCH_SAMPLES,
    });

    const renderParticleStressProfile = await page.evaluate(async ({ samples }) => {
      const render = await import('./js/render.js?realm=174');
      render.setRenderProfiling(true);
      for (let i = 0; i < samples; i++) window.forceRender();
      const profile = render.getRenderProfile();
      render.setRenderProfiling(false);
      return profile;
    }, { samples: PARTICLE_RENDER_SAMPLES });

    const renderSteadyProfile = await page.evaluate(async ({ samples }) => {
      const render = await import('./js/render.js?realm=174');
      window.G.particles.length = 0;
      for (let i = 0; i < 10; i++) window.forceRender();
      render.setRenderProfiling(true);
      for (let i = 0; i < samples; i++) window.forceRender();
      const profile = render.getRenderProfile();
      render.setRenderProfiling(false);
      return profile;
    }, { samples: STEADY_RENDER_SAMPLES });

    const drawCounts = await page.evaluate(samples => {
      const meter = window.__realmPerfDrawMeter;
      const fullFrame = [];
      const citizenOnly = [];
      for (let i = 0; i < samples; i++) {
        meter.start();
        window.forceRender();
        fullFrame.push(meter.stop());
      }

      const g = window.G;
      const held = {
        avatar: g.avatar,
        soldiers: g.soldiers,
        walkers: g.walkers,
        caravans: g.caravans,
        enemies: g.enemies,
      };
      try {
        g.avatar = null;
        g.soldiers = [];
        g.walkers = [];
        g.caravans = [];
        g.enemies = [];
        for (let i = 0; i < samples; i++) {
          meter.start();
          window.forceRender();
          citizenOnly.push(meter.stop());
        }
      } finally {
        Object.assign(g, held);
      }
      return { fullFrame, citizenOnly };
    }, DRAW_COUNT_SAMPLES);

    const actualRenderCache = await page.evaluate(async () => {
      const cache = await import('./js/citizen-render-cache.js?realm=174');
      window.forceRender();
      const records = cache.inspectCitizenRenderCache();
      const live = new Set(window.G.citizens.map(citizen => citizen.actorId));
      return {
        liveCitizens: live.size,
        cacheSize: records.length,
        bounded: records.length <= live.size,
        onlyLiveActorIds: records.every(record => live.has(record.actorId)),
        uniqueActorIds: new Set(records.map(record => record.actorId)).size === records.length,
      };
    });

    const save = await page.evaluate(async ({ samples }) => {
      const { serializeGame } = await import('./js/save-state.js?realm=174');
      const durations = [];
      let bytes = 0;
      for (let i = 0; i < samples; i++) {
        const start = performance.now();
        const json = JSON.stringify(serializeGame({ savedAt: 0 }));
        durations.push(performance.now() - start);
        bytes = new TextEncoder().encode(json).byteLength;
      }
      return { durations, bytes };
    }, { samples: SAVE_SAMPLES });

    const rafDurations = await page.evaluate(async samples => {
      const values = [];
      let previous = await new Promise(resolve => requestAnimationFrame(resolve));
      for (let i = 0; i < samples; i++) {
        const now = await new Promise(resolve => requestAnimationFrame(resolve));
        values.push(now - previous);
        previous = now;
      }
      return values;
    }, RAF_SAMPLES);

    const browserInfo = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory ?? null,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    }));

    const memoryAfterWorkload = await collectMemory('after-workload');
    const retainedHeapDeltaBytes = (
      memoryAfterSetup.jsHeapUsedBytes !== null && memoryAfterWorkload.jsHeapUsedBytes !== null
        ? memoryAfterWorkload.jsHeapUsedBytes - memoryAfterSetup.jsHeapUsedBytes
        : null
    );

    // Synthetic snapshot/cache heap probes must not race the live renderer's
    // per-frame cache pruning. All real timing, draw, rAF, and workload-memory
    // measurements are complete above. Disable future scheduling, then cross a
    // native frame boundary so the already queued game loop drains once.
    await page.evaluate(() => new Promise(resolve => {
      if (document.visibilityState !== 'visible') {
        throw new Error('Snapshot/cache probe requires a visible page.');
      }
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = () => 0;
      nativeRequestAnimationFrame(() => nativeRequestAnimationFrame(resolve));
    }));

    const snapshotCacheProbes = [];
    for (const actorCount of SNAPSHOT_ACTOR_COUNTS) {
      const before = await collectMemory(`snapshot-cache-${actorCount}-before`);
      const allocation = await page.evaluate(async ({
        actorCount: count,
        warmupSamples,
        samples,
      }) => {
        const presentation = await import('./js/citizen-presentation.js?realm=174');
        const cache = await import('./js/citizen-render-cache.js?realm=174');
        const source = window.G.citizens;
        if (!source.length) throw new Error('Snapshot probe requires live citizens.');
        const inputs = Array.from({ length: count }, (_, index) => {
          const template = source[index % source.length];
          return {
            ...template,
            actorId: index + 1,
            identity: { ...template.identity },
            profession: { ...template.profession },
            activity: { ...template.activity },
            assignment: template.assignment
              ? { ...template.assignment, building: template.assignment.building }
              : null,
            path: null,
            pathIdx: 0,
          };
        });

        for (let i = 0; i < warmupSamples; i++) {
          presentation.buildCitizenPresentations(inputs);
        }
        const durations = [];
        let retained = null;
        for (let i = 0; i < samples; i++) {
          const started = performance.now();
          retained = presentation.buildCitizenPresentations(inputs);
          durations.push(performance.now() - started);
        }

        cache.resetCitizenRenderCache();
        for (const snapshot of retained) {
          const record = cache.citizenRenderRecord(snapshot.actorId);
          record.trail.push({ x: snapshot.x, y: snapshot.y });
        }
        const records = cache.inspectCitizenRenderCache();
        const immutable = Object.isFrozen(retained) && retained.every(snapshot => (
          Object.isFrozen(snapshot)
          && Object.isFrozen(snapshot.identity)
          && Object.isFrozen(snapshot.profession)
          && Object.isFrozen(snapshot.activity)
          && Object.isFrozen(snapshot.needs)
          && Object.isFrozen(snapshot.pathRemaining)
          && (!snapshot.assignment || (
            Object.isFrozen(snapshot.assignment)
            && Object.isFrozen(snapshot.assignment.building)
          ))
        ));
        const assignmentReferenceFree = retained.every((snapshot, snapshotIndex) => {
          const input = inputs[snapshotIndex];
          return !snapshot.assignment || snapshot.assignment.building !== input.assignment?.building;
        });
        window.__realmPerfRetainedSnapshotProbe = retained;
        return {
          actorCount: count,
          durations,
          snapshotCount: retained.length,
          uniqueActorIds: new Set(retained.map(snapshot => snapshot.actorId)).size,
          immutable,
          assignmentReferenceFree,
          cacheSize: records.length,
          cacheUniqueActorIds: new Set(records.map(record => record.actorId)).size,
          cacheRecordsDetached: records.every(record => (
            Object.isFrozen(record)
            && Object.isFrozen(record.trail)
            && record.trail.length === 1
          )),
        };
      }, {
        actorCount,
        warmupSamples: SNAPSHOT_WARMUP_SAMPLES,
        samples: SNAPSHOT_SAMPLES,
      });

      const retained = await collectMemory(`snapshot-cache-${actorCount}-retained`);
      const cleanup = await page.evaluate(async ({
        actorCount: count,
      }) => {
        const cache = await import('./js/citizen-render-cache.js?realm=174');
        const liveHalf = Array.from({ length: Math.floor(count / 2) }, (_, index) => index + 1);
        const afterPrune = cache.pruneCitizenRenderCache(liveHalf);
        const expectedAfterPrune = liveHalf.length;
        window.__realmPerfRetainedSnapshotProbe = null;
        cache.resetCitizenRenderCache();
        return {
          afterPrune,
          expectedAfterPrune,
          afterReset: cache.citizenRenderCacheSize(),
        };
      }, { actorCount });
      const released = await collectMemory(`snapshot-cache-${actorCount}-released`);
      const retainedDeltaBytes = retained.jsHeapUsedBytes - before.jsHeapUsedBytes;
      const releasedDeltaBytes = released.jsHeapUsedBytes - before.jsHeapUsedBytes;
      snapshotCacheProbes.push({
        actorCount,
        buildMs: stats(allocation.durations),
        buildMicrosecondsPerActor: stats(allocation.durations.map(
          duration => duration * 1000 / actorCount,
        )),
        snapshotCount: allocation.snapshotCount,
        uniqueActorIds: allocation.uniqueActorIds,
        immutable: allocation.immutable,
        assignmentReferenceFree: allocation.assignmentReferenceFree,
        cache: {
          size: allocation.cacheSize,
          uniqueActorIds: allocation.cacheUniqueActorIds,
          recordsDetached: allocation.cacheRecordsDetached,
          afterPrune: cleanup.afterPrune,
          expectedAfterPrune: cleanup.expectedAfterPrune,
          afterReset: cleanup.afterReset,
        },
        memory: {
          before,
          retained,
          released,
          retainedDeltaBytes,
          retainedBytesPerActor: Math.max(0, retainedDeltaBytes) / actorCount,
          releasedDeltaBytes,
        },
      });
    }

    if (errors.length) {
      throw new Error(`Browser errors: ${errors.join(' | ')}`);
    }

    const renderPassNames = [
      'skyCamera',
      'terrainFog',
      'entitiesWorld',
      'particles',
      'worldOverlays',
      'screenOverlays',
    ];
    const profilePasses = profile => Object.fromEntries(renderPassNames.map(
      pass => [pass, stats(profile.map(sample => sample[pass]))],
    ));
    const drawStats = records => ({
      totalDrawImages: stats(records.map(record => record.total)),
      actorAtlasDrawImages: stats(records.map(record => record.actorAtlas)),
      bySource: Object.fromEntries(
        [...new Set(records.flatMap(record => Object.keys(record.bySource)))].sort().map(source => [
          source,
          stats(records.map(record => record.bySource[source] || 0)),
        ]),
      ),
    });

    return {
      index,
      host,
      browser: browserInfo,
      setup,
      finalState: {
        gameTick: core.gameTick,
        day: core.day,
        population: core.population,
        buildings: core.buildings,
        citizens: core.citizens,
        soldiers: core.soldiers,
        enemies: core.enemies,
        walkers: core.walkers,
        caravans: core.caravans,
        particles: core.particles,
        activePaths: core.activePaths,
      },
      measurements: {
        coreBatchMs: { batchTicks: core.batchTicks, ...stats(core.durations) },
        coreMicrosecondsPerTick: stats(core.durations.map(
          milliseconds => milliseconds * 1000 / core.batchTicks,
        )),
        renderSteadyMs: stats(renderSteadyProfile.map(sample => sample.total)),
        renderPassMs: profilePasses(renderSteadyProfile),
        renderParticleStressMs: {
          particles: core.particles,
          ...stats(renderParticleStressProfile.map(sample => sample.total)),
        },
        renderParticleStressPassMs: profilePasses(renderParticleStressProfile),
        drawCounts: {
          fullFrame: drawStats(drawCounts.fullFrame),
          citizenOnly: drawStats(drawCounts.citizenOnly),
        },
        rafIntervalMs: stats(rafDurations),
        saveSerializeMs: stats(save.durations),
        saveBytes: save.bytes,
        actualRenderCache,
        memory: {
          afterSetup: memoryAfterSetup,
          afterWorkload: memoryAfterWorkload,
          retainedHeapDeltaBytes,
        },
        snapshotCacheProbes,
      },
    };
  } finally {
    await context.close();
  }
}

function aggregateTrials(trials) {
  const aggregateMetric = getter => stats(trials.map(getter));
  const actorCounts = Object.fromEntries(SNAPSHOT_ACTOR_COUNTS.map(actorCount => {
    const probes = trials.map(trial => (
      trial.measurements.snapshotCacheProbes.find(probe => probe.actorCount === actorCount)
    ));
    if (probes.some(probe => !probe)) throw new Error(`Missing ${actorCount}-actor snapshot/cache probe.`);
    return [actorCount, {
      buildMsMedianAcrossTrials: aggregateMetric(trial => (
        trial.measurements.snapshotCacheProbes.find(probe => probe.actorCount === actorCount).buildMs.median
      )),
      buildMicrosecondsPerActorMedianAcrossTrials: aggregateMetric(trial => (
        trial.measurements.snapshotCacheProbes.find(
          probe => probe.actorCount === actorCount,
        ).buildMicrosecondsPerActor.median
      )),
      retainedHeapDeltaBytes: stats(probes.map(probe => probe.memory.retainedDeltaBytes)),
      retainedBytesPerActor: stats(probes.map(probe => probe.memory.retainedBytesPerActor)),
      releasedHeapDeltaBytes: stats(probes.map(probe => probe.memory.releasedDeltaBytes)),
    }];
  }));

  return {
    coreMicrosecondsPerTick: aggregateMetric(
      trial => trial.measurements.coreMicrosecondsPerTick.median,
    ),
    renderSteadyMs: aggregateMetric(trial => trial.measurements.renderSteadyMs.median),
    renderParticleStressMs: aggregateMetric(
      trial => trial.measurements.renderParticleStressMs.median,
    ),
    actorAtlasDrawsPerFullFrame: aggregateMetric(
      trial => trial.measurements.drawCounts.fullFrame.actorAtlasDrawImages.median,
    ),
    actorAtlasDrawsPerCitizenOnlyFrame: aggregateMetric(
      trial => trial.measurements.drawCounts.citizenOnly.actorAtlasDrawImages.median,
    ),
    totalDrawImagesPerFullFrame: aggregateMetric(
      trial => trial.measurements.drawCounts.fullFrame.totalDrawImages.median,
    ),
    saveSerializeMs: aggregateMetric(trial => trial.measurements.saveSerializeMs.median),
    saveBytes: aggregateMetric(trial => trial.measurements.saveBytes),
    rafIntervalMs: aggregateMetric(trial => trial.measurements.rafIntervalMs.median),
    retainedHeapDeltaBytes: aggregateMetric(
      trial => trial.measurements.memory.retainedHeapDeltaBytes,
    ),
    gcAfterSetupMs: aggregateMetric(
      trial => trial.measurements.memory.afterSetup.gcCollectionMs,
    ),
    gcAfterWorkloadMs: aggregateMetric(
      trial => trial.measurements.memory.afterWorkload.gcCollectionMs,
    ),
    snapshotCacheProbes: actorCounts,
  };
}

function buildGates({ baseline, host, trials, aggregate, fixtureSignature }) {
  const gates = [];
  const baselineFingerprint = environmentFingerprint(baseline.host, baseline.browser);
  const currentFingerprints = trials.map(trial => environmentFingerprint(host, trial.browser));
  const currentFingerprintSignature = stableJson(currentFingerprints[0]);
  const trialsShareEnvironment = currentFingerprints.every(
    fingerprint => stableJson(fingerprint) === currentFingerprintSignature,
  );
  const sameBaselineHost = stableJson(currentFingerprints[0]) === stableJson(baselineFingerprint);
  gates.push(gate(
    'repeated-same-host-trials',
    `At least ${REQUIRED_TRIALS} independent trials share the realm-163 host/browser fingerprint.`,
    trials.length >= REQUIRED_TRIALS && trialsShareEnvironment && sameBaselineHost,
    {
      trials: trials.length,
      requiredTrials: REQUIRED_TRIALS,
      baselineFingerprint,
      currentFingerprint: currentFingerprints[0],
    },
  ));

  const baselineFixtureSignature = sha256(stableJson(referenceFixtureRecord(
    baseline.scenario,
    baseline.finalState,
  )));
  gates.push(gate(
    'reference-town-fixture',
    'Every trial reproduces the exact realm-163 reference-town setup and final actor counts.',
    fixtureSignature === baselineFixtureSignature,
    {
      observedSha256: fixtureSignature,
      baselineSha256: baselineFixtureSignature,
      deterministicDiagnostics: {
        baseline: {
          particles: baseline.finalState.particles,
          activePaths: baseline.finalState.activePaths,
        },
        trials: trials.map(trial => ({
          particles: trial.finalState.particles,
          activePaths: trial.finalState.activePaths,
        })),
      },
    },
  ));

  const core = comparison(
    aggregate.coreMicrosecondsPerTick.median,
    baseline.measurements.coreMicrosecondsPerTick.median,
  );
  gates.push(gate(
    'core-plus-five-percent',
    'Median-of-trial core cost is no more than +5% over realm 163.',
    core.pass,
    core,
  ));

  const render = comparison(
    aggregate.renderSteadyMs.median,
    baseline.measurements.renderSteadyMs.median,
  );
  gates.push(gate(
    'steady-render-plus-five-percent',
    'Median-of-trial steady render cost is no more than +5% over realm 163.',
    render.pass,
    render,
  ));

  const retainedHeap = comparison(
    aggregate.retainedHeapDeltaBytes.median,
    baseline.measurements.memory.retainedHeapDeltaBytes,
  );
  gates.push(gate(
    'retained-heap-plus-five-percent',
    'Median post-GC reference-town retained-heap delta is no more than +5% over realm 163.',
    retainedHeap.pass,
    retainedHeap,
  ));

  const baselineActorDraws = actorAtlasBudget(baseline.finalState);
  const currentActorDraws = aggregate.actorAtlasDrawsPerFullFrame.max;
  const allCitizenOnlyOneDraw = trials.every(trial => {
    const citizenCount = trial.finalState.citizens;
    const actorDraws = trial.measurements.drawCounts.citizenOnly.actorAtlasDrawImages;
    return actorDraws.min === citizenCount && actorDraws.max === citizenCount;
  });
  gates.push(gate(
    'flattened-actor-draw-count',
    'The reference town does not exceed realm 163 actor-atlas draws, and each citizen remains one flattened draw.',
    currentActorDraws <= baselineActorDraws && allCitizenOnlyOneDraw,
    {
      observedFullFrameMaximum: currentActorDraws,
      baselineFullFrameBudget: baselineActorDraws,
      observedCitizenOnlyMaximum: aggregate.actorAtlasDrawsPerCitizenOnlyFrame.max,
      expectedCitizenOnly: baseline.finalState.citizens,
      baselineDerivation: 'citizens + soldiers + walkers + caravans + enemies + founder',
    },
  ));

  const actualCachesPass = trials.every(trial => {
    const cache = trial.measurements.actualRenderCache;
    return cache.bounded && cache.onlyLiveActorIds && cache.uniqueActorIds;
  });
  gates.push(gate(
    'actual-render-cache-bound',
    'The real renderer cache stays unique, actor-ID keyed, and bounded by live citizens.',
    actualCachesPass,
    {
      trials: trials.map(trial => trial.measurements.actualRenderCache),
    },
  ));

  for (const actorCount of SNAPSHOT_ACTOR_COUNTS) {
    const probes = trials.map(trial => trial.measurements.snapshotCacheProbes.find(
      probe => probe.actorCount === actorCount,
    ));
    const structuralPass = probes.every(probe => (
      probe.snapshotCount === actorCount
      && probe.uniqueActorIds === actorCount
      && probe.immutable
      && probe.assignmentReferenceFree
      && probe.cache.size === actorCount
      && probe.cache.uniqueActorIds === actorCount
      && probe.cache.recordsDetached
      && probe.cache.afterPrune === probe.cache.expectedAfterPrune
      && probe.cache.afterReset === 0
    ));
    const memory = aggregate.snapshotCacheProbes[actorCount];
    const memoryPass = (
      memory.retainedBytesPerActor.max <= MAX_SNAPSHOT_CACHE_BYTES_PER_ACTOR
      && memory.releasedHeapDeltaBytes.max <= MAX_RELEASED_STRESS_HEAP_BYTES
    );
    gates.push(gate(
      `snapshot-cache-${actorCount}`,
      `${actorCount}-actor snapshots are immutable/reference-free; cache prune/reset and retained-heap bounds pass.`,
      structuralPass && memoryPass,
      {
        actorCount,
        retainedBytesPerActorMaximum: memory.retainedBytesPerActor.max,
        retainedBytesPerActorBudget: MAX_SNAPSHOT_CACHE_BYTES_PER_ACTOR,
        releasedHeapDeltaMaximum: memory.releasedHeapDeltaBytes.max,
        releasedHeapDeltaBudget: MAX_RELEASED_STRESS_HEAP_BYTES,
      },
    ));
  }

  gates.push(gate(
    'save-comfort-limit',
    'Every representative current-schema save remains below 1 MiB.',
    aggregate.saveBytes.max < MAX_SAVE_BYTES,
    {
      observedMaximum: aggregate.saveBytes.max,
      limit: MAX_SAVE_BYTES,
    },
  ));

  return gates;
}

function markdownReport(result) {
  const coreGate = result.gates.find(item => item.id === 'core-plus-five-percent');
  const renderGate = result.gates.find(item => item.id === 'steady-render-plus-five-percent');
  const heapGate = result.gates.find(item => item.id === 'retained-heap-plus-five-percent');
  const drawGate = result.gates.find(item => item.id === 'flattened-actor-draw-count');
  const fixtureGate = result.gates.find(item => item.id === 'reference-town-fixture');
  const verdict = result.pass ? 'PASS' : 'FAIL';
  const lines = [
    `# Engine v2 Phase 1A performance evidence (realm ${result.moduleRevision})`,
    '',
    `Verdict: **${verdict}**`,
    '',
    `Captured ${result.capturedAt} as ${result.configuration.trials} independent browser contexts in one Chromium process on the same host. Raw per-trial profiles, memory snapshots, draw-source counts, and gate evidence are in [\`performance-v${result.moduleRevision}.json\`](performance-v${result.moduleRevision}.json).`,
    '',
    'The timing gate compares the median of each trial’s median to the realm-163 Apple M4 reference-town baseline. Timed renders run with draw instrumentation disabled. Draw counts are collected in a separate pass.',
    '',
    '## Realm-163 budget comparison',
    '',
    '| Gate | Realm 163 | Realm ' + result.moduleRevision + ' | Limit | Change | Verdict |',
    '| --- | ---: | ---: | ---: | ---: | :---: |',
    `| Fixed-step core | ${formatNumber(coreGate.baseline, 1)} µs/tick | ${formatNumber(coreGate.observed, 1)} µs/tick | ${formatNumber(coreGate.limit, 1)} µs/tick | ${formatNumber(coreGate.percentChange, 2)}% | ${coreGate.pass ? 'PASS' : 'FAIL'} |`,
    `| Steady Canvas render | ${formatNumber(renderGate.baseline, 2)} ms | ${formatNumber(renderGate.observed, 2)} ms | ${formatNumber(renderGate.limit, 2)} ms | ${formatNumber(renderGate.percentChange, 2)}% | ${renderGate.pass ? 'PASS' : 'FAIL'} |`,
    `| Post-GC retained delta | ${formatBytes(heapGate.baseline)} | ${formatBytes(heapGate.observed)} | ${formatBytes(heapGate.limit)} | ${formatNumber(heapGate.percentChange, 2)}% | ${heapGate.pass ? 'PASS' : 'FAIL'} |`,
    `| Actor-atlas draws/frame | ${formatInteger(drawGate.baselineFullFrameBudget)} | ${formatInteger(drawGate.observedFullFrameMaximum)} max | no increase | — | ${drawGate.pass ? 'PASS' : 'FAIL'} |`,
    `| Save payload | < ${formatBytes(result.budgets.maximumSaveBytes)} | ${formatBytes(result.aggregate.saveBytes.max)} max | < ${formatBytes(result.budgets.maximumSaveBytes)} | — | ${result.gates.find(item => item.id === 'save-comfort-limit').pass ? 'PASS' : 'FAIL'} |`,
    '',
    '## Repeated reference-town trials',
    '',
    '| Trial | Core median | Steady render median | Actor draws | Retained delta | Cache/live | Save |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...result.trials.map(trial => (
      `| ${trial.index} | ${formatNumber(trial.measurements.coreMicrosecondsPerTick.median, 1)} µs/tick | ${formatNumber(trial.measurements.renderSteadyMs.median, 2)} ms | ${formatInteger(trial.measurements.drawCounts.fullFrame.actorAtlasDrawImages.max)} | ${formatBytes(trial.measurements.memory.retainedHeapDeltaBytes)} | ${trial.measurements.actualRenderCache.cacheSize}/${trial.measurements.actualRenderCache.liveCitizens} | ${formatBytes(trial.measurements.saveBytes)} |`
    )),
    '',
    `Fixture identity holds setup, tick/day, and final actor counts exact. Non-gating deterministic diagnostics changed from ${fixtureGate.deterministicDiagnostics.baseline.particles} particles / ${fixtureGate.deterministicDiagnostics.baseline.activePaths} active paths on realm 163 to ${fixtureGate.deterministicDiagnostics.trials[0].particles} / ${fixtureGate.deterministicDiagnostics.trials[0].activePaths} in every realm ${result.moduleRevision} trial; full values remain in the JSON evidence.`,
    '',
    '## Snapshot/cache stress',
    '',
    'The 100/250 actor counts are the explicit Realm actor-output stress sizes from RFC 0002. They are also used here to exercise Phase 1A’s immutable presentation and renderer-owned cache boundary.',
    '',
    '| Actors | Snapshot median/actor | Retained/actor max | Released delta max | Structural gate |',
    '| ---: | ---: | ---: | ---: | :---: |',
    ...SNAPSHOT_ACTOR_COUNTS.map(actorCount => {
      const aggregate = result.aggregate.snapshotCacheProbes[actorCount];
      const actorGate = result.gates.find(item => item.id === `snapshot-cache-${actorCount}`);
      return `| ${actorCount} | ${formatNumber(aggregate.buildMicrosecondsPerActorMedianAcrossTrials.median, 2)} µs | ${formatBytes(aggregate.retainedBytesPerActor.max)} | ${formatBytes(aggregate.releasedHeapDeltaBytes.max)} | ${actorGate.pass ? 'PASS' : 'FAIL'} |`;
    }),
    '',
    'Each probe proves the returned array and nested presentation records are frozen, assignment summaries do not retain building references, actor IDs are unique, cache size equals the requested actor count, pruning reaches the exact live half, and reset reaches zero.',
    '',
    '## Gate ledger',
    '',
    ...result.gates.map(item => `- ${item.pass ? 'PASS' : 'FAIL'} — \`${item.id}\`: ${item.description}`),
    '',
    '## Reproduce',
    '',
    '```sh',
    `REALM_PORT=4753 REALM_PERF_TRIALS=${REQUIRED_TRIALS} node scripts/capture-engine-v2-performance.mjs`,
    '```',
    '',
    'This command intentionally exits non-zero after writing both reports when any gate fails.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

await mkdir(OUT_DIR, { recursive: true });
const baseline = JSON.parse(await readFile(BASELINE_FILE, 'utf8'));
if (baseline.moduleRevision !== 163) {
  throw new Error(`Expected realm-163 baseline, found realm ${baseline.moduleRevision}.`);
}
if (!baseline.measurements?.memory || !baseline.measurements?.coreMicrosecondsPerTick || !baseline.measurements?.renderSteadyMs) {
  throw new Error('Realm-163 baseline lacks required core/render/memory evidence.');
}

const host = {
  platform: platform(),
  release: release(),
  cpuModel: cpus()[0]?.model || 'unknown',
  logicalCpuCount: cpus().length,
  node: process.version,
};
const server = await ensureServer();
const browser = await chromium.launch({ headless: true });

try {
  const trials = [];
  for (let index = 1; index <= trialCount; index++) {
    console.log(`[phase1a-performance] trial ${index}/${trialCount}`);
    trials.push(await runTrial(browser, server, host, index));
  }

  const fixtureRecords = trials.map(trial => referenceFixtureRecord(
    trial.setup,
    trial.finalState,
  ));
  const fixtureSignatures = fixtureRecords.map(record => sha256(stableJson(record)));
  const oneFixture = fixtureSignatures.every(signature => signature === fixtureSignatures[0]);
  const fixtureSignature = oneFixture ? fixtureSignatures[0] : 'trials-disagree';
  const aggregate = aggregateTrials(trials);
  const gates = buildGates({
    baseline,
    host,
    trials,
    aggregate,
    fixtureSignature,
  });
  const result = {
    schema: 'realm.engine-v2.phase1a-performance-evidence',
    schemaVersion: 2,
    moduleRevision: runtimeContract.moduleRevision,
    baselineRevision: baseline.moduleRevision,
    capturedAt: new Date().toISOString(),
    pass: gates.every(item => item.pass),
    host,
    browser: trials[0].browser,
    configuration: {
      trials: trialCount,
      independentBrowserContexts: true,
      sharedBrowserProcess: true,
      coreWarmupTicks: CORE_WARMUP_TICKS,
      coreBatchTicks: CORE_BATCH_TICKS,
      coreBatchSamples: CORE_BATCH_SAMPLES,
      steadyRenderSamples: STEADY_RENDER_SAMPLES,
      particleRenderSamples: PARTICLE_RENDER_SAMPLES,
      drawCountSamples: DRAW_COUNT_SAMPLES,
      saveSamples: SAVE_SAMPLES,
      rafSamples: RAF_SAMPLES,
      snapshotActorCounts: SNAPSHOT_ACTOR_COUNTS,
      snapshotWarmupSamples: SNAPSHOT_WARMUP_SAMPLES,
      snapshotSamples: SNAPSHOT_SAMPLES,
    },
    budgets: {
      maximumRegressionRatio: MAX_REGRESSION_RATIO,
      maximumRegressionPercent: (MAX_REGRESSION_RATIO - 1) * 100,
      realm163CoreMicrosecondsPerTickMedian: baseline.measurements.coreMicrosecondsPerTick.median,
      realm163RenderSteadyMsMedian: baseline.measurements.renderSteadyMs.median,
      realm163RetainedHeapDeltaBytes: baseline.measurements.memory.retainedHeapDeltaBytes,
      realm163ActorAtlasDrawsPerFrame: actorAtlasBudget(baseline.finalState),
      maximumSaveBytes: MAX_SAVE_BYTES,
      maximumSnapshotCacheBytesPerActor: MAX_SNAPSHOT_CACHE_BYTES_PER_ACTOR,
      maximumReleasedStressHeapBytes: MAX_RELEASED_STRESS_HEAP_BYTES,
    },
    fixture: {
      sha256: fixtureSignature,
      trialSignatures: fixtureSignatures,
      scenario: trials[0].setup,
      finalState: trials[0].finalState,
    },
    aggregate,
    gates,
    trials,
    provenance: {
      script: relative(ROOT, fileURLToPath(import.meta.url)),
      baseline: relative(ROOT, BASELINE_FILE),
      rfc: 'loop/engine-v2/RFC-0003-STABLE-ACTOR-OWNERSHIP.md',
      interpretation: 'Same-host Phase 1A acceptance gate; wall times are not portable across machines.',
    },
  };

  await writeFile(OUT_JSON, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(OUT_MARKDOWN, markdownReport(result));
  console.log(`[phase1a-performance] wrote ${OUT_JSON}`);
  console.log(`[phase1a-performance] wrote ${OUT_MARKDOWN}`);
  console.log(
    `[phase1a-performance] ${result.pass ? 'PASS' : 'FAIL'}: `
    + `${aggregate.coreMicrosecondsPerTick.median.toFixed(1)}us/tick, `
    + `${aggregate.renderSteadyMs.median.toFixed(2)}ms steady render, `
    + `${aggregate.actorAtlasDrawsPerFullFrame.max} actor draws max`,
  );
  if (!result.pass) {
    for (const failed of gates.filter(item => !item.pass)) {
      console.error(`[phase1a-performance] FAIL ${failed.id}: ${failed.description}`);
    }
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.stop();
}
