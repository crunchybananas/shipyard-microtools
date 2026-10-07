import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, build, canBuild, listTiles, tick, serialize, restore, refreshTown, rates, buildingStatus, pauseBuilding, setWorkers, setBuilderTarget, storageCapacity } from '../js/sim.js';
import { importGoods, researchOptions, setTownGoal } from '../js/progression.js';
import { createCompanionStore } from '../js/companion-store.js';

const ok = result => { assert.equal(result.ok, true, result.reason); return result; };
const breadEvents = state => state.events.filter(event => event.type === 'milestone' && event.text.includes('first bread'));
function place(state, type) {
  for (const tile of listTiles()) for (let rotation = 0; rotation < 4; rotation++) {
    if (canBuild(state, type, tile.x, tile.z, rotation).ok) return ok(build(state, type, tile.x, tile.z, rotation)).building;
  }
  assert.fail(`No legal site for ${type}`);
}
function finish(state, building) {
  for (let seconds = 0; building.status !== 'ready' && seconds < 300; seconds++) tick(state, 1);
  assert.equal(building.status, 'ready');
}
function bakeryTown({ finished = true } = {}) {
  const state = createGame();
  Object.assign(state.resources, { wood: 300, stone: 300, planks: 100, food: 40, flour: 0, gold: 100 });
  state.research.completed = ['cultivation', 'joinery', 'milling', 'barter'];
  ok(pauseBuilding(state, 'hearth', true));
  const bakery = place(state, 'bakery');
  if (finished) finish(state, bakery);
  else ok(setBuilderTarget(state, 0));
  Object.assign(state.resources, { food: 40, flour: 18, wood: 100 });
  refreshTown(state);
  assert.equal(state.guidance.firstBread, null, 'Construction and forecast must not earn bread');
  return { state, bakery };
}

test('first-bread plan is reversible and cannot charge or change a charter', () => {
  const state = createGame(), initial = JSON.parse(serialize(state));
  ok(setTownGoal(state, 'first_bread'));
  assert.equal(state.guidance.goal, 'first_bread');
  const chosen = JSON.parse(serialize(state)); delete chosen.guidance; delete initial.guidance;
  assert.deepEqual(chosen, initial);
  const beforeInvalid = serialize(state);
  assert.equal(setTownGoal(state, 'breadbasket').ok, false);
  assert.equal(serialize(state), beforeInvalid);
  ok(setTownGoal(state, null));
  assert.deepEqual(state.guidance, { goal: null, firstBread: null });
});

test('older and malformed optional guidance preserves otherwise valid saves and earned history', () => {
  const raw = JSON.parse(serialize(createGame()));
  raw.events.push({ id: 2, day: 1, text: 'The bakery has made its first bread.', type: 'milestone' }); raw.nextEventId = 3;
  for (const version of [2, 3, 4]) {
    const old = structuredClone(raw); old.version = version; delete old.guidance;
    const restored = restore(old);
    assert.ok(restored);
    assert.deepEqual(restored.guidance, { goal: null, firstBread: null });
    assert.deepEqual(restored.resources, raw.resources);
    assert.ok(restored.events.some(event => event.id === 2), 'Journal survives but cannot establish production');
  }
  for (const guidance of [null, [], 'first_bread', { goal: 'breadbasket', firstBread: true },
    { goal: 'first_bread', firstBread: { day: 2, buildingId: 'b1' } },
    { goal: 'first_bread', firstBread: { day: 1, buildingId: 'hearth' } },
    { goal: 'first_bread', firstBread: { day: 1.5, buildingId: 'b1' } },
    { goal: 'first_bread', firstBread: { day: 1, buildingId: '<script>' } }]) {
    const restored = restore({ ...raw, guidance });
    assert.ok(restored, JSON.stringify(guidance));
    assert.equal(restored.guidance.goal, guidance?.goal === 'first_bread' ? 'first_bread' : null);
    assert.equal(restored.guidance.firstBread, null);
    assert.deepEqual(restored.resources, raw.resources);
  }
});

test('inspecting a productive bakery, restoring and subsecond time do not claim bread', () => {
  const { state, bakery } = bakeryTown();
  ok(setTownGoal(state, 'first_bread'));
  assert.ok(buildingStatus(state, bakery).recipe.output.food > 0);
  assert.ok(rates(state).buildings[bakery.id].output.food > 0);
  researchOptions(state); refreshTown(state);
  const restored = restore(serialize(state));
  assert.ok(restored);
  assert.equal(restored.guidance.firstBread, null);
  assert.equal(breadEvents(restored).length, 0);
  const food = restored.resources.food;
  tick(restored, 0); tick(restored, .5);
  assert.equal(restored.resources.food, food);
  assert.equal(restored.guidance.firstBread, null);
  tick(restored, .5);
  assert.ok(restored.resources.food > food);
  assert.deepEqual(restored.guidance.firstBread, { day: restored.day, buildingId: bakery.id });
});

test('blocked, paused, unstaffed and unfinished bakeries cannot earn first bread', () => {
  const cases = [
    ['paused', state => ok(pauseBuilding(state, state.buildings.find(b => b.type === 'bakery').id, true))],
    ['no flour', state => { state.resources.flour = 0; }],
    ['no fuel', state => { state.resources.wood = 0; }],
    ['no workers', state => ok(setWorkers(state, state.buildings.find(b => b.type === 'bakery').id, 0))],
    ['full pantry', state => { state.resources.food = storageCapacity(state).food; }],
  ];
  for (const [name, block] of cases) {
    const { state } = bakeryTown(); ok(setTownGoal(state, 'first_bread')); block(state); refreshTown(state);
    const food = state.resources.food;
    tick(state, 1);
    assert.equal(state.resources.food, food, name);
    assert.equal(state.guidance.firstBread, null, name);
    assert.equal(breadEvents(state).length, 0, name);
  }
  const { state } = bakeryTown({ finished: false });
  tick(state, 1);
  assert.equal(state.guidance.firstBread, null);
});

test('imported food and other food workplaces cannot masquerade as bakery output', () => {
  const { state, bakery } = bakeryTown(); ok(setTownGoal(state, 'first_bread'));
  ok(pauseBuilding(state, bakery.id, true));
  const market = place(state, 'market'); finish(state, market);
  refreshTown(state);
  const food = state.resources.food;
  ok(importGoods(state, 'import_food'));
  assert.equal(state.resources.food, food + 24);
  assert.equal(state.guidance.firstBread, null);
  ok(pauseBuilding(state, market.id, true));
  const orchard = place(state, 'orchard'); finish(state, orchard);
  const beforeHarvest = state.resources.food;
  tick(state, 1);
  assert.ok(state.resources.food > beforeHarvest);
  assert.equal(state.guidance.firstBread, null);
  assert.equal(breadEvents(state).length, 0);
});

test('actual bread earns one durable milestone without rewards or replay on returning', () => {
  const { state, bakery } = bakeryTown(); ok(setTownGoal(state, 'first_bread'));
  const before = structuredClone(state.resources), stats = structuredClone(state.stats), policy = structuredClone(state.policies);
  const result = tick(state, 1);
  assert.equal(result.changed, true);
  assert.ok(state.resources.food > before.food);
  assert.ok(state.resources.flour < before.flour); assert.ok(state.resources.wood < before.wood);
  assert.equal(state.resources.gold, before.gold); assert.equal(state.resources.knowledge, before.knowledge);
  assert.deepEqual(state.stats, stats); assert.deepEqual(state.policies, policy);
  const earned = { day: state.day, buildingId: bakery.id };
  assert.deepEqual(state.guidance.firstBread, earned);
  assert.equal(breadEvents(state).length, 1);
  let returned = state;
  for (let i = 0; i < 3; i++) {
    returned = restore(serialize(returned)); assert.ok(returned);
    tick(returned, 1);
    assert.deepEqual(returned.guidance.firstBread, earned);
    assert.equal(breadEvents(returned).length, 1);
  }
  ok(setTownGoal(returned, null)); ok(setTownGoal(returned, 'first_bread')); tick(returned, 1);
  assert.deepEqual(returned.guidance.firstBread, earned);
  assert.equal(breadEvents(returned).length, 1);
});

test('existing bakeries record real production without adding an unsolicited goal event', () => {
  const { state, bakery } = bakeryTown();
  tick(state, 1);
  assert.deepEqual(state.guidance.firstBread, { day: state.day, buildingId: bakery.id });
  assert.equal(state.guidance.goal, null);
  assert.equal(breadEvents(state).length, 0);
  ok(setTownGoal(state, 'first_bread')); tick(state, 1);
  assert.equal(breadEvents(state).length, 0, 'Choosing a goal later must not replay a completed production event');
});

test('local home and companion keep independent plans and production evidence', async () => {
  const storage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, String(value)); } };
  const store = createCompanionStore({ storage, locks: null });
  await store.ready;
  const { state: home } = bakeryTown(); ok(setTownGoal(home, 'first_bread')); tick(home, 1);
  const earned = structuredClone(home.guidance);
  ok(store.create({}, home));
  const companion = ok(store.switchTown('companion', home)).state;
  assert.deepEqual(companion.guidance, { goal: null, firstBread: null });
  ok(setTownGoal(companion, 'first_bread')); ok(store.save(companion));
  const returned = ok(store.switchTown('home', companion)).state;
  assert.deepEqual(returned.guidance, earned);
  ok(setTownGoal(returned, null));
  const revisited = ok(store.switchTown('companion', returned)).state;
  assert.deepEqual(revisited.guidance, { goal: 'first_bread', firstBread: null });
  store.release();
});
