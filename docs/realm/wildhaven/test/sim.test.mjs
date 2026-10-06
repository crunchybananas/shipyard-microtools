import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, RESOURCE_NAMES, DAY_LENGTH, VERSION, createGame, terrainAt, isLand, groundHeight, listTiles, canBuild, build, demolish, undo, tick, serialize, restore, objective, rates, workforce, constructionQueue, cancelConstruction, reorderConstruction, queueUpgrade, canUpgrade, buildingStatus, setWorkers, setBuilderTarget, pauseBuilding, setPriority, citizenSkill, storageCapacity, villageNeeds, trade, tradeOffer } from '../js/sim.js';
import { getBuildingSpec } from '../js/catalog.js';
import { startResearch } from '../js/progression.js';

const fund = state => { for (const key of RESOURCE_NAMES) state.resources[key] = 2000; };
const unlock = (state, ...ids) => { state.research.completed.push(...ids.filter(id => !state.research.completed.includes(id))); };
function place(state, type, x, z) {
  if (x === undefined) ({ x, z } = listTiles().find(tile => canBuild(state, type, tile.x, tile.z).ok) || {});
  const rotation = (['cottage', 'clinic'].includes(type) ? [1, 0, 2, 3] : [0, 1, 2, 3]).find(r => canBuild(state, type, x, z, r).ok) ?? 0;
  const result = build(state, type, x, z, rotation); assert.equal(result.ok, true, `${type} ${x},${z}: ${result.reason}`); return result.building;
}
function finish(state) {
  setBuilderTarget(state, Math.min(6, state.population));
  for (let seconds = 0; constructionQueue(state).length && seconds < 2000; seconds++) tick(state, 1);
  assert.equal(constructionQueue(state).length, 0, 'Construction should complete with workers and reserved materials');
}
function completed(state, type, x, z) { const building = place(state, type, x, z); finish(state); return building; }
function conserve(state) {
  const labor = workforce(state), seen = new Set();
  assert.equal(labor.builders + labor.employed + labor.idle, state.population);
  for (const b of state.buildings) for (const id of b.workerIds) { assert.ok(!seen.has(id), `${id} double assigned`); seen.add(id); assert.equal(state.citizens.find(c => c.id === id)?.workplace, b.id); }
  assert.equal(seen.size, labor.assigned);
  for (const c of state.citizens) assert.equal(c.workplace !== null, seen.has(c.id));
}

test('terrain stays deterministic and construction footprints fit the expanded island', () => {
  assert.equal(listTiles().length, 57 * 47); assert.equal(terrainAt(-6, -3).kind, 'forest'); assert.equal(terrainAt(6, -4).kind, 'rock');
  assert.equal(terrainAt(0, 0).kind, 'path'); assert.equal(terrainAt(0, -5).buildable, false); assert.equal(terrainAt(2, 8).buildable, false);
  assert.ok(groundHeight(0, -5) > 1.5); assert.ok(Math.abs(groundHeight(1, -3) - groundHeight(1.01, -3)) < 0.02);
  for (const tile of listTiles().filter(t => t.buildable)) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) assert.ok(isLand(tile.x + dx, tile.z + dz));
});

test('construction escrows materials and creates neither housing nor output until completion', () => {
  const state = createGame(); pauseBuilding(state, 'hearth', true); setBuilderTarget(state, 0);
  const before = { ...state.resources }, cottage = place(state, 'cottage', -2, 2), orchard = place(state, 'orchard', 2, 0);
  assert.equal(state.resources.wood, before.wood - BUILDINGS.cottage.cost.wood - BUILDINGS.orchard.cost.wood);
  assert.equal(cottage.status, 'queued'); assert.equal(rates(state).capacity, 6);
  const food = state.resources.food; tick(state, 20); assert.equal(state.resources.food, food); assert.equal(orchard.progress, 0);
  assert.equal(buildingStatus(state, orchard).efficiency, 0); assert.match(buildingStatus(state, orchard).reason, /Assign builders/);
  setBuilderTarget(state, 2); tick(state, 5); assert.ok(cottage.progress > 0 && cottage.progress < cottage.workRequired); assert.equal(orchard.progress, 0);
  finish(state); assert.equal(rates(state).capacity, 10); assert.equal(orchard.status, 'ready'); assert.ok(rates(state).foodProduced > 0); conserve(state);
});

test('queue priority switches builders; pause releases workers and resumes remaining work', () => {
  const state = createGame(), a = place(state, 'cottage', -2, 2), b = place(state, 'garden', 2, 0);
  tick(state, 3); const progress = a.progress;
  assert.equal(reorderConstruction(state, b.id, 'up').ok, true); tick(state, 2);
  assert.equal(a.progress, progress); assert.ok(b.progress > 0); assert.equal(state.citizens.filter(c => c.job === 'builder').every(c => c.workplace === b.id), true);
  pauseBuilding(state, b.id, true); tick(state, 2); assert.ok(a.progress > progress);
  const pausedProgress = b.progress; pauseBuilding(state, a.id, true); tick(state, 2); assert.equal(b.progress, pausedProgress); assert.equal(workforce(state).builders, 0);
  pauseBuilding(state, b.id, false); tick(state, 1); assert.ok(b.progress > pausedProgress); conserve(state);
});

test('cancellation returns only unused escrow and cannot duplicate refunds', () => {
  const state = createGame(); pauseBuilding(state, 'hearth', true);
  const before = { ...state.resources }, first = place(state, 'cottage', -2, 2);
  assert.equal(undo(state).ok, true); assert.deepEqual(state.resources, before); assert.equal(undo(state).ok, false);
  const b = place(state, 'cottage', -2, 2); tick(state, 6);
  const expected = Object.fromEntries(Object.entries(b.escrow).map(([key, value]) => [key, Math.floor(value * (1 - b.progress / b.workRequired) + 1e-7)]));
  const balance = { ...state.resources }, result = cancelConstruction(state, b.id); assert.equal(result.ok, true); assert.deepEqual(result.refund, expected);
  for (const [key, value] of Object.entries(expected)) assert.equal(state.resources[key], balance[key] + value);
  const saved = serialize(state); assert.equal(cancelConstruction(state, b.id).ok, false); assert.equal(serialize(state), saved); assert.equal(state.buildings.some(x => x.id === first.id), false); conserve(state);
});

test('finite labor is conserved through shortages, manual allocation and construction', () => {
  const state = createGame(); fund(state);
  const orchard = completed(state, 'orchard', 2, 0), lumber = completed(state, 'lumber', -3, -3), quarry = completed(state, 'quarry', 4, -3);
  conserve(state); assert.equal(workforce(state).builders, 0); assert.equal(workforce(state).assigned, 6); assert.equal(state.buildings.find(b => b.id === 'hearth').workerIds.length, 0);
  setWorkers(state, orchard.id, 0); assert.ok(state.buildings.find(b => b.id === 'hearth').workerIds.length > 0); conserve(state);
  pauseBuilding(state, lumber.id, true); assert.equal(lumber.workerIds.length, 0); conserve(state);
  const site = place(state, 'cottage', -2, 2); setBuilderTarget(state, 4); assert.equal(workforce(state).builders, 4); assert.equal(site.workerIds.length, 4); conserve(state);
  setBuilderTarget(state, 0); assert.equal(workforce(state).builders, 0); conserve(state);
  assert.equal(setWorkers(state, quarry.id, 999).ok, false); assert.equal(setBuilderTarget(state, 99).ok, false);
});

test('input-starved workshops report the blocker, consume no phantom inputs, and stop when paused', () => {
  const state = createGame(); fund(state); unlock(state, 'milling');
  const mill = completed(state, 'windmill', 2, 0); setPriority(state, mill.id, 0); setWorkers(state, mill.id, 2);
  state.resources.grain = 0; state.resources.flour = 0; tick(state, 10);
  assert.equal(state.resources.flour, 0); assert.match(buildingStatus(state, mill).blockedReason, /grain/);
  state.resources.grain = 2; const before = state.resources.grain; tick(state, 9);
  const recipe = getBuildingSpec('windmill').recipe;
  assert.ok(state.resources.flour > 0); assert.ok(state.resources.grain < before); assert.ok(Math.abs(state.resources.flour / (before - state.resources.grain) - recipe.output.flour / recipe.input.grain) < 0.0001);
  pauseBuilding(state, mill.id, true); const paused = { grain: state.resources.grain, flour: state.resources.flour }; tick(state, 8);
  assert.equal(state.resources.grain, paused.grain); assert.equal(state.resources.flour, paused.flour); assert.equal(mill.workerIds.length, 0);
});

test('wood-to-planks production is limited by labor and storage without destroying existing overflow', () => {
  const state = createGame(); fund(state); unlock(state, 'joinery');
  const saw = completed(state, 'sawmill', 2, 0); setPriority(state, saw.id, 0); pauseBuilding(state, 'hearth', true);
  state.resources.wood = 100; state.resources.planks = 0; setWorkers(state, saw.id, 1); tick(state, 10); const half = state.resources.planks;
  state.resources.planks = 0; state.resources.wood = 100; setWorkers(state, saw.id, 2); tick(state, 10); assert.ok(state.resources.planks > half * 1.98);
  state.resources.planks = storageCapacity(state).planks; const timber = state.resources.wood; tick(state, 2); assert.equal(state.resources.wood, timber); assert.match(buildingStatus(state, saw).blockedReason, /Storage full/);
  state.resources.planks += 100; tick(state, 2); assert.equal(state.resources.planks, storageCapacity(state).planks + 100);
});

test('upgrades reserve inputs, close production, retain housing and require research for level three', () => {
  const state = createGame(); fund(state);
  const cottage = completed(state, 'cottage', -2, 2); const beds = rates(state).capacity;
  assert.equal(queueUpgrade(state, cottage.id).ok, true); assert.equal(rates(state).capacity, beds); assert.equal(cottage.level, 1); assert.equal(cottage.constructionKind, 'upgrade');
  tick(state, 2); const cancellation = cancelConstruction(state, cottage.id); assert.equal(cancellation.ok, true); assert.equal(cottage.level, 1); assert.equal(cottage.status, 'ready');
  assert.equal(queueUpgrade(state, cottage.id).ok, true); finish(state); assert.equal(cottage.level, 2); assert.equal(rates(state).capacity, 6 + getBuildingSpec('cottage', 2).housing);
  assert.equal(canUpgrade(state, cottage.id).ok, false); assert.match(canUpgrade(state, cottage.id).reason, /mastercraft/);
  unlock(state, 'mastercraft'); assert.equal(queueUpgrade(state, cottage.id).ok, true); finish(state); assert.equal(cottage.level, 3); assert.equal(canUpgrade(state, cottage.id).ok, false);
  const orchard = completed(state, 'orchard', 2, 0); state.resources.food = 100; assert.equal(queueUpgrade(state, orchard.id).ok, true); assert.equal(buildingStatus(state, orchard).efficiency, 0); assert.match(buildingStatus(state, orchard).reason, /builders|Waiting/);
});

test('actual job practice increases retained expertise; blocked and paused work earns none', () => {
  const state = createGame(); fund(state); unlock(state, 'milling');
  const mill = completed(state, 'windmill', 2, 0); pauseBuilding(state, 'hearth', true); setWorkers(state, mill.id, 2); state.resources.grain = 50; state.resources.flour = 0;
  tick(state, 20); const worker = state.citizens.find(c => c.workplace === mill.id), xp = worker.experience.miller;
  assert.ok(xp >= 20); assert.ok(citizenSkill(worker, 'miller') > 1); assert.ok(citizenSkill({ experience: { miller: 72000 } }, 'miller') <= 1.2);
  state.resources.grain = 0; tick(state, 10); assert.equal(worker.experience.miller, xp);
  pauseBuilding(state, mill.id, true); tick(state, 10); assert.equal(worker.experience.miller, xp);
  const saved = restore(serialize(state)); assert.equal(saved.citizens.find(c => c.id === worker.id).experience.miller, xp);
});

test('save/load mid-project preserves progress, escrow, identities and deterministic continuation', () => {
  const state = createGame(); const building = place(state, 'cottage', -2, 2); tick(state, 3.4);
  const loaded = restore(serialize(state)); assert.ok(loaded); const site = loaded.buildings.find(b => b.id === building.id);
  assert.equal(site.progress, building.progress); assert.deepEqual(site.escrow, building.escrow); assert.equal(loaded.subsecond, state.subsecond); assert.deepEqual(loaded.citizens.map(c => c.name), state.citizens.map(c => c.name));
  tick(state, 30.6); tick(loaded, 30.6);
  assert.deepEqual(loaded.resources, state.resources); assert.deepEqual(loaded.citizens, state.citizens); assert.equal(site.status, building.status); conserve(loaded);
});

test('fixed-step integration produces identical economy for different render frame partitions', () => {
  const a = createGame(), b = createGame(); place(a, 'cottage', -2, 2); place(b, 'cottage', -2, 2);
  tick(a, 45); for (let i = 0; i < 180; i++) tick(b, .25);
  assert.deepEqual(a.resources, b.resources); assert.deepEqual(a.citizens, b.citizens); assert.deepEqual(a.buildings, b.buildings); assert.equal(a.time, b.time);
});

test('defensive saves reject forged escrow, duplicate labor, impossible sites and corrupted construction', () => {
  const state = createGame(); place(state, 'cottage', -2, 2); tick(state, 3);
  const original = serialize(state), reject = change => { const data = JSON.parse(original); change(data); assert.equal(restore(data), null); };
  reject(s => s.buildings[2].escrow.wood = 100000);
  reject(s => s.buildings[2].progress = s.buildings[2].workRequired);
  reject(s => s.buildings[2].progress = -1);
  reject(s => s.buildings[2].x = 12);
  reject(s => s.buildings[2].investment.wood = 10000);
  reject(s => s.citizens.push({ ...s.citizens[0] }));
  reject(s => s.citizens[0].name = '<script>');
  reject(s => s.citizens[0].experience.builder = Infinity);
  reject(s => s.resources.food = -1);
  reject(s => s.builderTarget = 999);
  reject(s => s.lastTradeDay = s.day + 1);
  reject(s => s.subsecond = 1);
  const forgedAssignments = JSON.parse(original); for (const c of forgedAssignments.citizens) { c.job = 'builder'; c.workplace = 'hearth'; }
  const normalized = restore(forgedAssignments); assert.ok(normalized); conserve(normalized); assert.equal(workforce(normalized).builders, normalized.builderTarget);
});

test('v1 villages migrate to complete level-one buildings and named citizens without losing original stock', () => {
  const legacy = { version: 1, resources: { wood: 600, stone: 40, food: 28 }, population: 7, day: 4, time: 12.5, elapsed: 282.5, won: false, buildings: [
    { id: 'hearth', type: 'hearth', x: 0, z: 2, rotation: 0, builtDay: 1 },
    { id: 'bell', type: 'bell', x: 0, z: -5, rotation: 0, builtDay: 1, restored: false },
    { id: 'b1', type: 'cottage', x: -2, z: 2, rotation: 2, builtDay: 2 },
  ] };
  const state = restore(JSON.stringify(legacy)); assert.ok(state); assert.equal(state.version, VERSION); assert.equal(state.migratedFromVersion, 1);
  assert.equal(state.resources.wood, 600); assert.equal(state.resources.stone, 40); assert.equal(state.population, 7); assert.equal(state.citizens.length, 7); assert.equal(state.buildings[2].status, 'ready'); assert.equal(state.buildings[2].level, 1); assert.equal(state.lastTradeDay, 0); assert.equal(state.subsecond, .5); conserve(state);
});

test('empty pantry and zero material stores retain a real-worker recovery route', () => {
  const state = createGame(); for (const key of RESOURCE_NAMES) state.resources[key] = 0;
  tick(state, DAY_LENGTH * 3); assert.ok(state.resources.wood >= 6); assert.ok(state.resources.stone >= 3); assert.ok(state.resources.food >= 0); assert.equal(state.population, 6);
  const garden = place(state, 'garden', 2, 0); finish(state); assert.equal(garden.status, 'ready'); assert.ok(garden.workerIds.length > 0); conserve(state);
});

test('housing, food and morale explain migration; employed buildings actually grow the settlement', () => {
  const state = createGame(); assert.match(state.migration.reason, /housing/);
  place(state, 'cottage', -2, 2); place(state, 'orchard', 2, 0); finish(state); tick(state, DAY_LENGTH);
  assert.ok(state.population > 6); assert.equal(new Set(state.citizens.map(c => c.id)).size, state.population); assert.equal(new Set(state.citizens.map(c => c.name)).size, state.population); conserve(state);
  assert.equal(demolish(state, state.buildings.find(b => b.type === 'cottage').id).ok, false);
});

test('landing exchanges preserve breakfast, persist the daily visit and cannot be refunded through construction', () => {
  const state = createGame(); pauseBuilding(state, 'hearth', true); const original = { ...state.resources };
  const b = place(state, 'garden', 2, 0); assert.equal(trade(state, 'wood').ok, true); assert.equal(undo(state).ok, true);
  assert.equal(state.resources.wood, original.wood + 12); assert.equal(state.resources.food, original.food - 12); assert.equal(tradeOffer(state, 'stone').ok, false);
  const loaded = restore(serialize(state)); assert.ok(loaded); assert.equal(tradeOffer(loaded, 'stone').ok, false); assert.equal(cancelConstruction(state, b.id).ok, false);
  for (const resource of ['food', '__proto__', 'constructor', null]) assert.equal(trade(state, resource).ok, false);
});

test('invalid mutations and invalid deltas are inert', () => {
  const state = createGame(), before = serialize(state);
  for (const input of [NaN, Infinity, -10, '10']) tick(state, input);
  for (const type of ['__proto__', 'constructor', 'unknown']) assert.equal(build(state, type, 2, 0).ok, false);
  assert.equal(build(state, 'garden', 1.5, 2).ok, false); assert.equal(build(state, 'garden', 0, 0).ok, false);
  assert.equal(serialize(state), before); assert.equal(objective(state).step, 0);
});

test('supplied schools make real research progress; one scholar works at half strength', () => {
  const state = createGame(); fund(state); const school = completed(state, 'school', 2, 0);
  setPriority(state, school.id, 0); setWorkers(state, school.id, 1); pauseBuilding(state, 'hearth', true);
  assert.equal(startResearch(state, 'joinery').ok, true); tick(state, 10);
  assert.ok(state.research.active.progress >= 5 && state.research.active.progress < 5.1);
  const progress = state.research.active.progress; state.resources.food = 0; tick(state, 5);
  assert.equal(state.research.active.progress, progress); assert.match(school.production.blockedReason, /food/);
  const restored = restore(serialize(state)); assert.ok(restored); assert.equal(restored.research.active.progress, progress);
});

test('grain, flour and bread form a functioning staffed chain with no starting ingredients', () => {
  const state = createGame(); fund(state); unlock(state, 'cultivation', 'joinery', 'milling');
  completed(state, 'cottage', -2, 2); tick(state, DAY_LENGTH * 2);
  completed(state, 'farm', 2, 0); completed(state, 'windmill', 3, 0); completed(state, 'bakery', 4, 0);
  pauseBuilding(state, 'hearth', true); state.resources.grain = 0; state.resources.flour = 0; state.resources.food = 0; state.resources.wood = 100;
  tick(state, DAY_LENGTH);
  assert.ok(state.resources.grain > 0); assert.ok(state.buildings.find(b => b.type === 'windmill').production.output.flour > 0); assert.ok(state.resources.food > 0); assert.ok(state.resources.wood < 100);
  for (const type of ['farm', 'windmill', 'bakery']) assert.ok(state.buildings.find(b => b.type === type).production.efficiency > 0);
  conserve(state);
});

test('service coverage depends on homes inside the actual neighborhood radius', () => {
  const state = createGame(); fund(state); completed(state, 'cottage', -2, 2);
  const well = completed(state, 'well', -3, 2);
  assert.equal(villageNeeds(state).services.water.coverage, 1);
  completed(state, 'cottage', 6, 2);
  assert.equal(villageNeeds(state).services.water.coveredHomes, 2);
  assert.equal(villageNeeds(state).services.water.totalHomes, 3);
  assert.equal(villageNeeds(state).services.water.coverage, 10 / 14);
  pauseBuilding(state, well.id, true); assert.equal(villageNeeds(state).services.water.coverage, 0);
});

test('ordinary construction and labor reach the first bell without ending the larger town game', () => {
  const state = createGame();
  for (const [type, x, z] of [['cottage', -2, 2], ['orchard', 2, 0], ['lumber', -3, -3], ['quarry', 4, -3], ['garden', 3, 0], ['cottage', -2, 3], ['cottage', -2, 4]]) completed(state, type, x, z);
  for (let day = 0; !canBuild(state, 'bell', 0, -5).ok && day < 8; day++) tick(state, DAY_LENGTH);
  assert.equal(canBuild(state, 'bell', 0, -5).ok, true); const bell = place(state, 'bell', 0, -5);
  assert.equal(state.won, false); assert.equal(bell.restored, false); finish(state);
  assert.equal(state.won, true); assert.equal(bell.restored, true); assert.equal(objective(state).complete, false);
  const loaded = restore(serialize(state)); assert.ok(loaded); assert.equal(loaded.won, true); assert.equal(objective(loaded).complete, false); conserve(loaded);
});

test('a seeded management sequence conserves people and stock through repeated mid-work reloads', () => {
  let state = createGame(), seed = 74381;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let turn = 0; turn < 300; turn++) {
    const action = random(7), buildings = state.buildings.filter(b => !['hearth', 'bell'].includes(b.type)), b = buildings[random(Math.max(1, buildings.length))];
    if (action === 0) {
      const type = ['cottage', 'garden', 'orchard', 'lumber', 'quarry', 'school', 'well'][random(7)];
      const sites = listTiles().filter(t => canBuild(state, type, t.x, t.z).ok);
      if (sites.length) { const site = sites[random(sites.length)]; build(state, type, site.x, site.z); }
    } else if (action === 1 && b) pauseBuilding(state, b.id);
    else if (action === 2 && b) setWorkers(state, b.id, random((getBuildingSpec(b.type, b.level).workers || 0) + 1));
    else if (action === 3) setBuilderTarget(state, random(Math.min(state.population, 6) + 1));
    else if (action === 4 && b && b.status !== 'ready') reorderConstruction(state, b.id, random(2) ? 'up' : 'down');
    else if (action === 5 && b) demolish(state, b.id);
    else if (action === 6) trade(state, random(2) ? 'wood' : 'stone');
    tick(state, random(30) + .25); conserve(state);
    for (const key of RESOURCE_NAMES) assert.ok(Number.isFinite(state.resources[key]) && state.resources[key] >= 0);
    if (turn % 11 === 0) {
      const loaded = restore(serialize(state)); assert.ok(loaded, `Reload failed at management turn ${turn}`);
      assert.deepEqual(loaded.resources, state.resources); assert.deepEqual(loaded.citizens, state.citizens); conserve(loaded); state = loaded;
    }
  }
});

test('fixture towns need water, supplied health and community coverage at meaningful growth thresholds', () => {
  const state = createGame(); fund(state); unlock(state, 'public_health', 'civic_order');
  const homes = [];
  // Legacy dense neighborhood fixture: services must work on grandfathered saves too.
  for (const x of [-2, -3]) for (const z of [0, 1, 2, 3, 4]) { const home = completed(state, 'cottage'); home.x = x; home.z = z; home.rotation = 0; homes.push(home); }
  const populationFixture = count => {
    state.citizens = Array.from({ length: count }, (_, i) => ({ id: `c${i + 1}`, name: `Resident ${i + 1}`, arrivalDay: 1, job: 'idle', workplace: null, experience: {} }));
    state.population = count; state.nextCitizenId = count + 1; setBuilderTarget(state, 0);
  };
  populationFixture(19); assert.equal(villageNeeds(state).migration.expected, 1);
  populationFixture(20); assert.equal(villageNeeds(state).migration.eligible, false); assert.match(villageNeeds(state).migration.reason, /wells/);
  const well = completed(state, 'well', -1, 2); assert.equal(villageNeeds(state).migration.eligible, true);
  populationFixture(40); assert.equal(villageNeeds(state).migration.eligible, false); assert.match(villageNeeds(state).migration.reason, /clinics/);
  const clinic = completed(state, 'clinic', -1, 1); assert.equal(villageNeeds(state).migration.eligible, true);
  pauseBuilding(state, clinic.id, true); assert.equal(villageNeeds(state).migration.eligible, false); pauseBuilding(state, clinic.id, false);
  for (const home of homes) { assert.equal(queueUpgrade(state, home.id).ok, true); finish(state); }
  // Denser housing needs larger services, even when the buildings remain in reach.
  assert.equal(queueUpgrade(state, well.id).ok, true); finish(state);
  assert.equal(queueUpgrade(state, clinic.id).ok, true); finish(state);
  populationFixture(60); assert.equal(villageNeeds(state).migration.eligible, false); assert.match(villageNeeds(state).migration.reason, /chapel|brewhouse/);
  const chapel = completed(state, 'chapel', 1, 3); assert.equal(villageNeeds(state).migration.eligible, false);
  assert.equal(queueUpgrade(state, chapel.id).ok, true); finish(state); assert.equal(villageNeeds(state).migration.eligible, true);
});
