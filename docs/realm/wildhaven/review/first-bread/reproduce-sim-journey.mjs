/**
 * Simulation evidence, NOT browser playthrough.
 * Run: node docs/realm/wildhaven/review/first-bread/reproduce-sim-journey.mjs
 * Starts with the byte-for-byte authentic Day 5 browser-earned save beside this
 * file. Normal game APIs spend every construction/research cost and advance
 * workers/production. No resources, research, buildings or citizens are injected.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as sim from '../../js/sim.js';
import * as progression from '../../js/progression.js';
import { BUILDINGS } from '../../js/catalog.js';
import { firstBreadStep } from '../../js/bread-guide.js';

const file = name => new URL(name, import.meta.url);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const input = fs.readFileSync(file('sim-authentic-day5-save.json'));
const state = sim.restore(JSON.parse(input));
assert.ok(state?.won && state.day === 5 && state.population === 14);
const ok = result => { assert.equal(result.ok, true, result.reason); return result; };
const save = (name, value) => {
  const bytes = sim.serialize(value);
  fs.writeFileSync(file(name), `${bytes}\n`);
  assert.ok(sim.restore(bytes), `${name} restores as a valid save`);
  return { file: name, sha256: hash(`${bytes}\n`), day: value.day, population: value.population };
};
const tiles = sim.listTiles();
function legalSite(s, type) {
  for (const tile of tiles) for (let rotation = 0; rotation < 4; rotation++) {
    if (sim.canBuild(s, type, tile.x, tile.z, rotation).ok) return { x: tile.x, z: tile.z, rotation };
  }
  assert.fail(`No legal ${type} site found`);
}
function spendRecord(before, after) {
  return Object.fromEntries(Object.keys(before).filter(key => before[key] !== after[key]).map(key => [key, Number((before[key] - after[key]).toFixed(6))]));
}
const checkpoints = {}, actions = [], transitions = [];
let preBakery = null, bakerySite = null, minimumFood = state.resources.food, lastTitle = '', completedAt = null;
ok(progression.setTownGoal(state, 'first_bread'));
actions.push({ second: 0, action: 'setTownGoal', goal: 'first_bread', cost: {} });
for (let second = 0; second < 1800; second++) {
  const daily = sim.rates(state), step = firstBreadStep(state, { daily });
  assert.ok(step, 'The selected first-bread goal remains active');
  minimumFood = Math.min(minimumFood, state.resources.food);
  if (step.title !== lastTitle) {
    transitions.push({ second, day: state.day, population: state.population, step, resources: structuredClone(state.resources), foodRate: daily.food, idle: sim.workforce(state).idle });
    lastTitle = step.title;
  }
  if (step.finishGoal) { completedAt = second; break; }
  if (step.type) {
    const site = legalSite(state, step.type);
    if (step.type === 'bakery') {
      preBakery = sim.serialize(state); bakerySite = site;
      checkpoints.preBakery = save('sim-pre-bakery-save.json', state);
    }
    const before = structuredClone(state.resources);
    const result = ok(sim.build(state, step.type, site.x, site.z, site.rotation));
    const paid = spendRecord(before, state.resources);
    assert.deepEqual(paid, Object.fromEntries(Object.entries(BUILDINGS[step.type].cost).filter(([, amount]) => amount > 0)), `Full ${step.type} cost is paid`);
    actions.push({ second, action: 'build', type: step.type, buildingId: result.building.id, site, cost: paid });
  } else if (step.researchId && !state.research.active) {
    const before = structuredClone(state.resources);
    ok(progression.startResearch(state, step.researchId));
    const paid = spendRecord(before, state.resources);
    assert.deepEqual(paid, progression.RESEARCH[step.researchId].cost, `Full ${step.researchId} cost is paid`);
    actions.push({ second, action: 'startResearch', id: step.researchId, cost: paid });
  } else if (step.workforceId) {
    assert.fail(`Journey needs a staffing decision: ${step.description}`);
  } else if (step.buildingId) {
    const workplace = state.buildings.find(b => b.id === step.buildingId);
    assert.ok(workplace.production?.efficiency > 0, `Journey needs an input decision: ${step.description}`);
  }
  sim.tick(state, 1);
}
assert.notEqual(completedAt, null, 'Normal actions must reach actual first bread');
assert.ok(state.guidance.firstBread);
assert.ok(minimumFood > 0, 'The journey does not exhaust food');
assert.ok(preBakery && bakerySite);
checkpoints.firstBread = save('sim-first-bread-save.json', state);

// A separately labelled checkpoint branch for a real browser staffing/finish test.
// The supported setPriority API puts the bakery behind the occupied workplaces.
// Builders still finish normally. No food production or milestone is fabricated.
const staged = sim.restore(preBakery);
const bakery = ok(sim.build(staged, 'bakery', bakerySite.x, bakerySite.z, bakerySite.rotation)).building;
ok(sim.setPriority(staged, bakery.id, 100));
let stagingSeconds = 0;
while (bakery.status !== 'ready' && stagingSeconds < 300) { sim.tick(staged, 1); stagingSeconds++; }
assert.equal(bakery.status, 'ready');
assert.equal(staged.guidance.firstBread, null);
assert.equal(bakery.desiredWorkers, 2);
assert.equal(bakery.workerIds.length, 0);
checkpoints.readyUnproduced = save('sim-bakery-ready-unproduced-save.json', staged);

// Read-only forecasts and selecting the goal must not claim production.
const stagedSerialized = sim.serialize(staged);
const stagedGuidance = firstBreadStep(staged, { paused: true, daily: sim.rates(staged) });
assert.equal(stagedGuidance.title, 'Give the bakery its workers');
assert.equal(stagedGuidance.label, 'Find available workers');
assert.equal(stagedGuidance.workforceId, bakery.id);
assert.equal(sim.serialize(staged), stagedSerialized);

const sourceNames = ['sim.js', 'catalog.js', 'progression.js', 'bread-guide.js'];
const sourceHashes = Object.fromEntries(sourceNames.map(name => [name, hash(fs.readFileSync(new URL(`../../js/${name}`, import.meta.url)))]));
const report = {
  method: 'In-memory simulation from an authentic browser-earned Day 5 bell-town save. This journey was not browser played. Every construction and research action uses normal game APIs and pays full costs; no resources, discoveries, citizens or buildings are injected.',
  input: { file: 'sim-authentic-day5-save.json', sha256: hash(input), originalPath: 'Wildhaven-playthrough/earned-final-save.json', day: 5, population: 14 },
  sourceHashes,
  result: { passed: true, simulatedSeconds: completedAt, day: state.day, population: state.population, minimumFood, firstBread: state.guidance.firstBread, resources: state.resources, researchCompleted: state.research.completed, staffingInterventions: 0, foodStayedPositive: true },
  actions, transitions, checkpoints,
  readyUnproducedBranch: { method: 'Restore the pre-bakery checkpoint, build the bakery normally at the recorded site, set priority to 100 through the supported setPriority API, and let builders finish. Priority 100 puts it behind occupied workplaces. This is a staging branch, not the uninterrupted successful journey; the UI exposes Raise priority rather than setting the numeric value to 100.', bakeryId: bakery.id, site: bakerySite, additionalSeconds: stagingSeconds, requestedBakers: 2, actualBakers: 0, priority: 100, firstBread: staged.guidance.firstBread, nextStep: stagedGuidance, browserFinish: 'Follow Find available workers, then Raise priority for the bakery, and resume time. Check that actual production earns firstBread; reload to confirm persistence.' },
};
fs.writeFileSync(file('sim-journey-trace.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: true, simulatedSeconds: completedAt, day: state.day, firstBread: state.guidance.firstBread, checkpoints }, null, 2));
