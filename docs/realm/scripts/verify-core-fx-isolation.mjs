// Executable proof that CORE presentation work is observational only.
// Three fresh processes run the same full deterministic scenario while the
// particle sink stores, suppresses, or reorders/inflates every descriptor.
// Dedicated fire fixtures additionally prove that dousing and stochastic
// burnout consume the exact same gameplay RNG under all presentation modes.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { G, MAP_H, MAP_W, TILE, getSeed, setSeed } from '../js/state.js?realm=198';
import { updateFires } from '../js/economy.js?realm=198';
import { visualJitter } from '../js/fx.js?realm=198';
import { updateWalkers } from '../js/walkers.js?realm=198';
import { runDeterminismScenario } from './determinism-harness.mjs';

const MODES = ['control', 'suppress', 'perturb'];
const RESULT_PREFIX = 'REALM_CORE_FX_RESULT=';

function sha(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildingFixture(type, x, y, overrides = {}) {
  return {
    type,
    x,
    y,
    hp: 100,
    active: true,
    prodTimer: 0,
    produced: null,
    prodShowCount: 0,
    level: 1,
    buildProgress: 1,
    buildTotal: 1,
    buildStartedAt: 0,
    ...overrides,
  };
}

function presentationSink(mode) {
  const queue = [];
  const stats = { descriptors: 0, douseSignals: 0 };
  Object.defineProperty(queue, 'push', {
    configurable: true,
    value(...items) {
      stats.descriptors += items.length;
      stats.douseSignals += items.filter(item => item?.text === '💧 Doused!').length;
      if (mode === 'suppress') return queue.length;
      if (mode === 'perturb') {
        for (let index = items.length - 1; index >= 0; index--) {
          const item = items[index];
          // Extra/reordered visual work must be free to call visualJitter: it
          // is a stateless hash and therefore cannot advance gameplay RNG.
          const probe = visualJitter(item?.tx || 0, item?.ty || 0, 9000 + stats.descriptors + index);
          Array.prototype.push.call(queue, { type: 'fx-isolation-probe', probe }, item);
        }
        if (queue.length > 2048) queue.splice(0, queue.length - 1024);
        return queue.length;
      }
      return Array.prototype.push.apply(queue, items);
    },
  });
  return { queue, stats };
}

function runFireTrial({ mode, seed, withWell }) {
  const sink = presentationSink(mode);
  const burning = buildingFixture('house', 40, 40, {
    hp: 10_000,
    onFire: true, _fireTimer: 0,
  });
  const well = buildingFixture('well', 41, 40, {
    onFire: false, _fireTimer: 0,
  });
  G.buildings = withWell ? [burning, well] : [burning];
  G.particles = sink.queue;
  G.gameTick = 0;
  setSeed(seed);

  let endedAt = null;
  for (let tick = 1; tick <= 301; tick++) {
    G.gameTick = tick;
    if (mode === 'perturb') {
      // Model extra descriptors being generated before the ordinary fire FX.
      visualJitter(burning.x, burning.y, 8003);
      visualJitter(burning.x, burning.y, 8002);
      visualJitter(burning.x, burning.y, 8001);
    }
    updateFires();
    if (!burning.onFire) {
      endedAt = tick;
      break;
    }
  }

  const authoritative = {
    endedAt,
    fireTimer: burning._fireTimer,
    hp: burning.hp,
    onFire: burning.onFire,
    outcome: sink.stats.douseSignals ? 'doused' : 'burnout',
  };
  return {
    authoritative,
    authoritativeHash: sha(authoritative),
    rngSeed: getSeed(),
    presentationDescriptors: sink.stats.descriptors,
  };
}

function runWonderHaulerTrial(mode) {
  const sink = presentationSink(mode);
  const site = buildingFixture('wonder', 40, 40);
  const store = buildingFixture('storehouse', 44, 40);
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.buildingGrid[site.y][site.x] = site;
  G.buildingGrid[store.y][store.x] = store;
  G.buildings = [site, store];
  G.citizens = Array.from({ length: 4 }, (_, index) => ({
    actorId: index + 1,
    assignment: { building: site },
    activity: { kind: 'working' },
  }));
  G.walkers = [];
  G.wonder = { placed: true, stage: 0, delivered: {} };
  G.particles = sink.queue;
  G.gameTick = 200;
  G.dayLength = 3600;
  G.dayPhase = 1200;
  setSeed(0x51a7e);
  const before = getSeed();
  updateWalkers();
  const after = getSeed();
  const hauler = G.walkers.find(walker => walker.hauler);
  return {
    before,
    after,
    count: G.walkers.length,
    hauler: !!hauler,
    source: hauler ? { x: hauler.src.x, y: hauler.src.y } : null,
    target: hauler ? { x: hauler.tx, y: hauler.ty } : null,
  };
}

if (process.env.REALM_CORE_FX_CHILD === '1') {
  const mode = process.env.REALM_CORE_FX_MODE;
  if (!MODES.includes(mode)) throw new Error(`Unknown presentation mode: ${mode}`);
  const scenarioSink = presentationSink(mode);
  G.particles = scenarioSink.queue;
  const scenario = runDeterminismScenario({ seed: 12345 });
  const result = {
    mode,
    scenario: {
      worldHash: scenario.worldHash,
      replayHash: scenario.replayHash,
      rngSeed: getSeed(),
      tick: scenario.tick,
      commandCount: scenario.commandCount,
      presentationDescriptors: scenarioSink.stats.descriptors,
    },
    douse: runFireTrial({ mode, seed: 1, withWell: true }),
    burnout: runFireTrial({ mode, seed: 424242, withWell: false }),
    wonderHauler: runWonderHaulerTrial(mode),
  };
  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`);
  process.exit(0);
}

function run(mode) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, REALM_CORE_FX_CHILD: '1', REALM_CORE_FX_MODE: mode },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(`${mode} child failed:\n${child.stderr || child.stdout}`);
  }
  const line = child.stdout.split('\n').find(value => value.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${mode} child did not emit a result:\n${child.stdout}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

let failures = 0;
function pass(message) { console.log(`  ✓ ${message}`); }
function fail(message, detail = '') {
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
  failures++;
}
function same(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(message);
  else fail(message, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log('[core-fx-isolation] full-core control/suppression/perturbation…');
const results = Object.fromEntries(MODES.map(mode => [mode, run(mode)]));
const control = results.control;
for (const mode of ['suppress', 'perturb']) {
  same(
    {
      worldHash: results[mode].scenario.worldHash,
      replayHash: results[mode].scenario.replayHash,
      rngSeed: results[mode].scenario.rngSeed,
    },
    {
      worldHash: control.scenario.worldHash,
      replayHash: control.scenario.replayHash,
      rngSeed: control.scenario.rngSeed,
    },
    `${mode}ed/reordered FX preserves full-core authoritative hash and RNG`,
  );
  for (const trial of ['douse', 'burnout']) {
    same(
      {
        hash: results[mode][trial].authoritativeHash,
        rngSeed: results[mode][trial].rngSeed,
        state: results[mode][trial].authoritative,
      },
      {
        hash: control[trial].authoritativeHash,
        rngSeed: control[trial].rngSeed,
        state: control[trial].authoritative,
      },
      `${trial}: ${mode}ed/reordered flame FX preserves outcome, hash, and RNG`,
    );
  }
  same(
    results[mode].wonderHauler,
    control.wonderHauler,
    `presentation-only wonder hauler is invariant in ${mode} mode`,
  );
}

if (control.douse.authoritative.outcome === 'doused' && control.douse.authoritative.endedAt <= 300) {
  pass(`well douses the fire stochastically at tick ${control.douse.authoritative.endedAt}`);
} else {
  fail('douse fixture did not exercise stochastic dousing', JSON.stringify(control.douse.authoritative));
}
if (control.burnout.authoritative.outcome === 'burnout' && control.burnout.authoritative.endedAt <= 300) {
  pass(`unassisted fire burns out stochastically at tick ${control.burnout.authoritative.endedAt}`);
} else {
  fail('burnout fixture did not exercise stochastic burnout', JSON.stringify(control.burnout.authoritative));
}
if (control.wonderHauler.hauler && control.wonderHauler.count === 1 &&
    control.wonderHauler.before === control.wonderHauler.after) {
  pass('presentation-only wonder hauler routes without consuming gameplay RNG');
} else {
  fail('wonder hauler consumed gameplay RNG or did not spawn', JSON.stringify(control.wonderHauler));
}
if (results.suppress.scenario.presentationDescriptors > 0 && results.perturb.scenario.presentationDescriptors > 0) {
  pass(`non-vacuous full-core proof observed ${control.scenario.presentationDescriptors} presentation descriptors`);
} else {
  fail('full-core scenario emitted no presentation descriptors');
}

if (failures) {
  console.error(`[core-fx-isolation] FAILED — ${failures} assertion${failures === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`[core-fx-isolation] OK — ${control.scenario.worldHash.slice(0, 20)}…, RNG ${control.scenario.rngSeed}`);
