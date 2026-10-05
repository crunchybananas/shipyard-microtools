import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as sim from '../js/sim.js';
import { getBuildingSpec } from '../js/catalog.js';

function finish(state) {
  sim.setBuilderTarget(state, Math.min(6, state.population));
  for (let seconds = 0; sim.constructionQueue(state).length && seconds < 1000; seconds++) sim.tick(state, 1);
  assert.equal(sim.constructionQueue(state).length, 0);
}
function build(state, type, x, z) {
  if (x === undefined) ({ x, z } = sim.listTiles().find(t => sim.canBuild(state, type, t.x, t.z).ok));
  const rotation = (type === 'clinic' ? [1, 0, 2, 3] : [0, 1, 2, 3]).find(r => sim.canBuild(state, type, x, z, r).ok) ?? 0;
  const result = sim.build(state, type, x, z, rotation); assert.equal(result.ok, true, result.reason); finish(state); return result.building;
}
function townFixture() {
  const state = sim.createGame(); for (const key of sim.RESOURCE_NAMES) state.resources[key] = 2000;
  state.research.completed.push('public_health', 'civic_order', 'mastercraft');
  // Explicit legacy dense-neighborhood fixture; placement access is tested separately.
  for (const x of [-2, -3]) for (const z of [0, 1, 2, 3, 4]) { const home = build(state, 'cottage'); home.x = x; home.z = z; home.rotation = 0; }
  return state;
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function conservation(access) {
  for (const [kind, service] of Object.entries(access.services)) {
    assert.ok(service.served <= service.capacity + 1e-6); assert.ok(service.served <= service.demand + 1e-6);
    near(service.served, access.homes.reduce((sum, home) => sum + home.served[kind], 0));
    near(service.served, service.providers.reduce((sum, provider) => sum + provider.served, 0));
    for (const home of access.homes) assert.ok(home.coverage[kind] >= 0 && home.coverage[kind] <= 1);
  }
}

test('clinic access is finite and falls with actual staff or input supply instead of granting binary coverage', () => {
  const state = townFixture(), clinic = build(state, 'clinic', -1, 1);
  sim.setWorkers(state, clinic.id, 2); const full = sim.villageNeeds(state);
  assert.equal(full.services.health.demand, 46); assert.ok(full.services.health.coverage < 1);
  sim.setWorkers(state, clinic.id, 1); const half = sim.villageNeeds(state);
  assert.ok(half.services.health.served < full.services.health.served * .51);
  assert.ok(half.services.health.coverage < .4); conservation(half);
  sim.pauseBuilding(state, 'hearth', true); state.resources.food = .005; sim.setWorkers(state, clinic.id, 1);
  const scarce = sim.villageNeeds(state); assert.ok(scarce.services.health.served < half.services.health.served);
  near(scarce.services.health.capacity, getBuildingSpec('clinic').service.capacity * clinic.production.efficiency);
  state.resources.cloth = 0; sim.setWorkers(state, clinic.id, 1); assert.equal(sim.villageNeeds(state).services.health.served, 0);
  state.resources.food = 100; state.resources.cloth = 10; sim.pauseBuilding(state, clinic.id, true);
  assert.equal(sim.villageNeeds(state).services.health.served, 0);
});

test('well upgrades serve denser housing, while overlapping wells cannot count the same demand twice', () => {
  const state = townFixture(), well = build(state, 'well', -1, 2);
  const initial = sim.villageNeeds(state); assert.equal(initial.services.water.capacity, 35); near(initial.services.water.served, 35); near(initial.services.water.coverage, 35 / 46);
  assert.equal(sim.queueUpgrade(state, well.id).ok, true); assert.equal(sim.villageNeeds(state).services.water.served, 0);
  finish(state); const improved = sim.villageNeeds(state); assert.equal(improved.services.water.capacity, 52); assert.equal(improved.services.water.coverage, 1);
  build(state, 'well', 1, 2); const overlapping = sim.villageNeeds(state);
  assert.equal(overlapping.services.water.capacity, 87); assert.equal(overlapping.services.water.served, 46); assert.equal(overlapping.services.water.unusedCapacity, 41);
  conservation(overlapping);
});

// Geometry fixtures isolate mixed catchments and scarce provider capacity.
function spatialFixture() {
  const state = sim.createGame(); state.resources.food = 100;
  const home = (id, x) => ({ id, type: 'cottage', x, z: 0, status: 'ready', level: 3, paused: false });
  const provider = (id, type, x, z, efficiency = 1) => ({ id, type, x, z, status: 'ready', level: 1, paused: false, production: { efficiency } });
  return { state, home, provider };
}

test('faith and leisure serve mixed neighborhoods jointly, with overlapping community access capped per home', () => {
  const { state, home, provider } = spatialFixture();
  state.buildings = [home('west-a', -6), home('west-b', -4), home('east-a', 4), home('east-b', 6), provider('chapel', 'chapel', -6, -1), provider('brewery', 'brewery', 6, 1)];
  const mixed = sim.villageNeeds(state); assert.equal(mixed.services.faith.coverage, .5); assert.equal(mixed.services.leisure.coverage, .5); assert.equal(mixed.services.community.coverage, 1); conservation(mixed);
  state.buildings.find(b => b.id === 'brewery').x = -6;
  const overlapping = sim.villageNeeds(state); assert.equal(overlapping.services.community.coverage, .5);
  assert.equal(overlapping.services.community.served, 20); assert.equal(overlapping.services.community.unusedCapacity, 28);
  assert.equal(overlapping.homes.find(h => h.id === 'east-a').coverage.community, 0); conservation(overlapping);
});

test('overlapping catchments redirect scarce service capacity instead of stranding reachable homes', () => {
  const { state, home, provider } = spatialFixture();
  state.buildings = [home('west', -3), home('east', 2), provider('central-clinic', 'clinic', 0, 0, 1 / 3), provider('east-clinic', 'clinic', 6, 0, 1 / 3)];
  const access = sim.villageNeeds(state); assert.equal(access.services.health.capacity, 20); assert.equal(access.services.health.served, 20);
  assert.equal(access.homes.find(h => h.id === 'west').coverage.health, 1); assert.equal(access.homes.find(h => h.id === 'east').coverage.health, 1); conservation(access);
});

test('service upgrades raise actual access at the same staffing and close service during construction', () => {
  const state = townFixture(), clinic = build(state, 'clinic', -1, 1); sim.setWorkers(state, clinic.id, 2);
  const before = sim.villageNeeds(state).services.health.served;
  assert.equal(sim.queueUpgrade(state, clinic.id).ok, true); assert.equal(sim.villageNeeds(state).services.health.capacity, 0);
  finish(state); const after = sim.villageNeeds(state); assert.equal(clinic.workerIds.length, 2); assert.ok(after.services.health.served > before); assert.equal(after.services.health.coverage, 1);
  const restored = sim.restore(sim.serialize(state)); assert.ok(restored); assert.equal(sim.villageNeeds(restored).services.health.coverage, after.services.health.coverage);
  sim.tick(state, 1); sim.tick(restored, 1); assert.deepEqual(sim.villageNeeds(restored).services, sim.villageNeeds(state).services);
});

test('existing upgraded v2 saves preserve citizens and stock when the new upgrade needs fewer posts', async () => {
  const raw = JSON.parse(await readFile(new URL('../review/campaign-pressure-save.json', import.meta.url), 'utf8'));
  const legacy = raw.buildings.find(b => b.level === 2 && b.type === 'orchard'); assert.ok(legacy); legacy.desiredWorkers = 3;
  const restored = sim.restore(raw); assert.ok(restored); assert.deepEqual(restored.resources, raw.resources); assert.equal(restored.population, raw.population);
  assert.equal(restored.buildings.find(b => b.id === legacy.id).desiredWorkers, 2);
  legacy.desiredWorkers = 100; assert.equal(sim.restore(raw), null);
});

test('potential food balance ignores full shelves while retaining actual staff and input constraints', () => {
  const state = sim.createGame(); assert.ok(state.foodPotentialBalance > 0, 'The starting staffed hearth is a real food source');
  for (const key of sim.RESOURCE_NAMES) state.resources[key] = 100;
  const orchard = build(state, 'orchard', 2, 0); sim.pauseBuilding(state, 'hearth', true);
  state.resources.food = sim.storageCapacity(state).food; sim.setWorkers(state, orchard.id, 2);
  assert.ok(state.foodBalance < 0); assert.ok(state.foodPotentialBalance > 0);
  sim.setWorkers(state, orchard.id, 0); assert.ok(state.foodPotentialBalance < 0);
  const serialized = JSON.parse(sim.serialize(state)); assert.equal('foodPotentialBalance' in serialized, false); assert.equal('serviceCoverage' in serialized, false);
  const restored = sim.restore(serialized); assert.ok(restored); assert.equal(restored.foodPotentialBalance, state.foodPotentialBalance);
  state.research.completed.push('milling'); const bakery = build(state, 'bakery', 3, 0);
  state.resources.flour = 0; sim.setWorkers(state, bakery.id, 2); assert.ok(state.foodPotentialBalance < 0, 'An unstocked oven does not count as sustainable potential food');
});
