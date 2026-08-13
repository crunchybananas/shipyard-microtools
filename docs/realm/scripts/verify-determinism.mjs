// Non-vacuous deterministic replay gate for the one canonical Realm graph.
//
// Four fresh processes prove:
//   1. exact executed state at tick 43,200 and a real midpoint checkpoint;
//   2. byte-identical canonical results for same seed + same commands;
//   3. different seeds change the derived terrain map (not a seed field);
//   4. one extra accepted command changes world state even though command-log
//      and test-label metadata are excluded from the world hash.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimeContract from '../runtime-contract.json?realm=193' with { type: 'json' };
import {
  CORE_SYSTEM_ORDER,
  canonicalJson,
  hashCanonical,
  strictCanonicalize,
} from './determinism-harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureFile = join(
  __dirname,
  'fixtures',
  'determinism',
  `simulation-v${runtimeContract.simulationVersion}.json`,
);
const WRITE_FIXTURE = process.argv.includes('--write');

if (process.env.REALM_DETERMINISM_CHILD === '1') {
  const { runDeterminismScenario } = await import('./determinism-harness.mjs');
  const result = runDeterminismScenario({
    seed: Number(process.env.REALM_DETERMINISM_SEED),
    changedCommand: process.env.REALM_DETERMINISM_CHANGED === '1',
    hostileParticleSchedule: process.env.REALM_DETERMINISM_PARTICLES === '1',
    mutateChronicle: process.env.REALM_DETERMINISM_CHRONICLE === '1',
  });
  process.stdout.write(`REALM_DETERMINISM_RESULT=${canonicalJson(result)}\n`);
  process.exit(0);
}

function fail(message, detail = '') {
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
  failures++;
}

function pass(message) {
  console.log(`  ✓ ${message}`);
}

function equal(actual, expected, label) {
  const a = canonicalJson(actual);
  const e = canonicalJson(expected);
  if (a !== e) {
    fail(label, `expected ${e}, got ${a}`);
    return false;
  }
  pass(label);
  return true;
}

function run(seed, changedCommand = false, hostileParticleSchedule = false, mutateChronicle = false) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: {
      ...process.env,
      REALM_DETERMINISM_CHILD: '1',
      REALM_DETERMINISM_SEED: String(seed),
      REALM_DETERMINISM_CHANGED: changedCommand ? '1' : '0',
      REALM_DETERMINISM_PARTICLES: hostileParticleSchedule ? '1' : '0',
      REALM_DETERMINISM_CHRONICLE: mutateChronicle ? '1' : '0',
    },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(`child seed=${seed} changed=${changedCommand} failed:\n${child.stderr || child.stdout}`);
  }
  const line = child.stdout.split('\n').find(value => value.startsWith('REALM_DETERMINISM_RESULT='));
  if (!line) throw new Error(`child seed=${seed} did not emit a result:\n${child.stdout}`);
  return JSON.parse(line.slice('REALM_DETERMINISM_RESULT='.length));
}

let failures = 0;
console.log('[determinism] strict canonicalizer…');
equal(strictCanonicalize({ z: 1, a: [true, null] }), { a: [true, null], z: 1 }, 'sorts object keys without changing values');
for (const [label, value] of [
  ['undefined', { bad: undefined }],
  ['function', { bad() {} }],
  ['non-finite number', { bad: Infinity }],
  ['negative zero', { bad: -0 }],
  ['Map', new Map([['a', 1]])],
  ['Set', new Set(['a'])],
  ['cycle', (() => { const value = {}; value.self = value; return value; })()],
  ['sparse array', (() => { const value = []; value.length = 1; return value; })()],
  ['symbol-keyed property', { [Symbol('hidden')]: true }],
]) {
  try {
    strictCanonicalize(value);
    fail(`rejects ${label}`);
  } catch {
    pass(`rejects ${label}`);
  }
}

const pathWithGoalA = [{ x: 1, y: 2 }];
pathWithGoalA.goal = { x: 8, y: 9 };
const pathWithGoalB = [{ x: 1, y: 2 }];
pathWithGoalB.goal = { x: 9, y: 9 };
equal(strictCanonicalize(pathWithGoalA), {
  $array: [{ x: 1, y: 2 }],
  $properties: { goal: { x: 8, y: 9 } },
}, 'preserves named enumerable array properties such as path.goal');
if (hashCanonical(pathWithGoalA) !== hashCanonical(pathWithGoalB)) pass('named array properties affect canonical hashes');
else fail('named array properties were erased from canonical hashes');

equal(CORE_SYSTEM_ORDER, runtimeContract.coreSystemOrder, 'executable system order matches runtime-contract.json');

let fixture = WRITE_FIXTURE ? null : JSON.parse(readFileSync(fixtureFile, 'utf8'));
if (fixture && fixture.simulationVersion !== runtimeContract.simulationVersion) {
  fail('fixture simulation version matches runtime contract');
}

console.log('[determinism] run A (seed 12345)…');
const a = run(12345);
console.log(`[determinism] run B (seed 12345 repeat)…`);
const b = run(12345);
console.log('[determinism] run C (seed 99999 derived-map control)…');
const c = run(99999);
console.log('[determinism] run D (seed 12345 + accepted SET_RALLY)…');
const d = run(12345, true);
console.log('[determinism] run E (seed 12345 + hostile shell particle schedule)…');
const e = run(12345, false, true);
console.log('[determinism] run F (seed 12345 + changed chronicle history)…');
const f = run(12345, false, false, true);

if (WRITE_FIXTURE) {
  fixture = {
    simulationVersion: runtimeContract.simulationVersion,
    commandCount: a.commandCount,
    applied: a.applied,
    checkpoint: a.checkpoints[0],
    finalPopulation: a.population,
    finalBuildings: a.buildings,
    mapFingerprint: a.mapFingerprint,
    worldHash: a.worldHash,
    replayHash: a.replayHash,
    story: a.story,
  };
  writeFileSync(fixtureFile, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  pass(`wrote reviewed simulation-v${runtimeContract.simulationVersion} fixture`);
}

equal({ tick: a.tick, day: a.day, dayPhase: a.dayPhase }, { tick: 43200, day: 13, dayPhase: 0 }, 'executes exactly twelve complete game days');
equal(a.identity, { rootEqualsCommands: true, rootEqualsCore: true }, 'root imports, dispatch(), and coreTick() share the exact G object');
equal(a.contract, {
  simulationVersion: runtimeContract.simulationVersion,
  coreSystemOrderVersion: runtimeContract.coreSystemOrderVersion,
}, 'child executed the authoritative runtime contract');
equal(a.applied, fixture.applied, 'all scripted command outcomes and placements match exactly');
equal(a.commandCount, fixture.commandCount, 'accepted command-log count matches exactly');
equal(a.checkpoints, [fixture.checkpoint], 'tick 21,600 checkpoint matches exact state and hash');
equal(a.buildings, fixture.finalBuildings, 'final building state matches exactly and is non-empty');
if (!a.buildings.length) fail('final building state is non-empty');
else pass(`final building state is non-empty (${a.buildings.length})`);
equal({
  population: a.population,
  mapFingerprint: a.mapFingerprint,
  worldHash: a.worldHash,
  replayHash: a.replayHash,
}, {
  population: fixture.finalPopulation,
  mapFingerprint: fixture.mapFingerprint,
  worldHash: fixture.worldHash,
  replayHash: fixture.replayHash,
}, 'golden simulation and replay hashes match');
equal(a.story, fixture.story, 'story milestones run at exact deterministic core ticks');

if (canonicalJson(a) === canonicalJson(b)) pass('same seed + commands produce byte-identical canonical results');
else fail('same seed + commands diverged', `${a.worldHash} != ${b.worldHash}`);

if (a.mapFingerprint !== c.mapFingerprint) {
  pass('different seed changes terrain-derived map fingerprint (seed value is not hashed)');
} else {
  fail('different seed did not change terrain-derived map fingerprint');
}

if (canonicalJson(a) === canonicalJson(e)) {
  pass('initial particle saturation and shell queue evolution cannot alter core state or RNG');
} else {
  fail('shell-owned particle evolution leaked into authoritative simulation', `${a.replayHash} != ${e.replayHash}`);
}

if (f.worldHash !== a.worldHash && f.replayHash !== a.replayHash) {
  pass('future-affecting chronicle history participates in simulation and replay hashes');
} else {
  fail('chronicle history was erased from a future-state hash');
}

const changedApplication = d.applied.find(command => command.label === 'set-rally');
equal(changedApplication, {
  at: 15000,
  label: 'set-rally',
  ok: true,
  reason: null,
  spot: null,
}, 'changed control command is accepted');
equal(d.changedCommandState, {
  armyStance: 'rally',
  rallyPoint: { x: 31, y: 37 },
}, 'accepted changed command has an asserted world-state consequence');
equal(d.commandCount, a.commandCount + 1, 'changed run records exactly one additional accepted command');
if (d.worldHash !== a.worldHash) {
  pass('accepted command changes simulation-state hash with command/test metadata excluded');
} else {
  fail('accepted command did not change metadata-free simulation state');
}

if (failures) {
  console.error(`[determinism] FAILED — ${failures} assertion${failures === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`[determinism] OK — tick ${a.tick}, day ${a.day}, ${a.buildings.length} buildings, ${a.commandCount} accepted commands`);
