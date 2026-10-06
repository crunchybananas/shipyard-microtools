import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as sim from '../js/sim.js';

const fixture = () => { const state = sim.createGame(); for (const key of sim.RESOURCE_NAMES) state.resources[key] = 1000; return state; };

test('rotated entrances reserve clear neighboring cells, and rejected placement spends nothing', () => {
  const state = fixture();
  assert.equal(sim.canBuild(state, 'cottage', 1, 2, 3).ok, false, 'West entrance would face the hearth');
  assert.equal(sim.canBuild(state, 'cottage', 1, 2, 1).ok, true);
  const first = sim.build(state, 'cottage', 1, 2, 1); assert.equal(first.ok, true); assert.deepEqual(sim.buildingEntrance(first.building), { x: 2, z: 2 });
  const before = sim.serialize(state), blocked = sim.build(state, 'garden', 2, 2, 0);
  assert.equal(blocked.ok, false); assert.match(blocked.reason, /neighboring building’s entrance/); assert.equal(sim.serialize(state), before);
  assert.equal(sim.canBuild(state, 'cottage', 3, 3, 4).ok, false);
});

test('the entrance must face navigable terrain, including deterministic scenery and shoreline', () => {
  const state = fixture(); assert.equal(sim.hasNaturalObstacle(5, -3), true);
  assert.equal(sim.canBuild(state, 'quarry', 4, -3, 1).ok, false); assert.equal(sim.canBuild(state, 'quarry', 4, -3, 0).ok, true);
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const shore = sim.listTiles().filter(t => t.buildable).flatMap(t => directions.map(([dx, dz], rotation) => ({ ...t, rotation, front: { x: t.x + dx, z: t.z + dz } }))).find(t => !sim.isLand(t.front.x, t.front.z));
  assert.ok(shore); assert.equal(sim.canBuild(state, 'cottage', shore.x, shore.z, shore.rotation).ok, false);
});

test('construction cannot isolate an otherwise open entrance behind neighboring buildings', () => {
  const state = fixture();
  assert.equal(sim.build(state, 'cottage', 1, 1, 0).ok, true);
  assert.equal(sim.build(state, 'garden', 1, 3, 1).ok, true);
  const verdict = sim.canBuild(state, 'cottage', 2, 2, 0);
  assert.equal(verdict.ok, false); assert.match(verdict.reason, /cut off a neighboring entrance/);
});

test('old v2 densely packed neighborhoods remain loadable under new construction access rules', async () => {
  const raw = await readFile(new URL('../review/campaign-pressure-save.json', import.meta.url), 'utf8');
  const state = sim.restore(raw); assert.ok(state); assert.equal(state.population, 87);
  assert.ok(state.buildings.some(b => { const front = sim.buildingEntrance(b); return sim.getBuildingAt(state, front.x, front.z); }), 'Checkpoint exercises grandfathered blocked entrances');
  assert.deepEqual(state.resources, JSON.parse(raw).resources);
});
