import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { RESOURCES } from '../js/catalog.js';
import { perMinute } from '../js/calendar.js';
import { resourceDetails } from '../js/resource-details.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .000002, `${actual} != ${expected}`);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function build(state, type) {
  const tile = sim.listTiles().find(tile => sim.canBuild(state, type, tile.x, tile.z).ok);
  assert.ok(tile, `A valid ${type} site exists`);
  const result = sim.build(state, type, tile.x, tile.z); assert.equal(result.ok, true, result.reason);
  for (let second = 0; sim.constructionQueue(state).length && second < 300; second++) sim.tick(state, 1);
  assert.equal(sim.constructionQueue(state).length, 0);
  return result.building;
}

test('resource snapshots are pure, reject unknown keys, and distinguish physical capacity', () => {
  const state = freeze(sim.createGame()), before = JSON.stringify(state);
  assert.equal(resourceDetails(state, '__proto__'), null);
  assert.equal(resourceDetails(state, 'nonsense'), null);
  for (const key of sim.RESOURCE_NAMES) {
    const detail = resourceDetails(state, key);
    assert.equal(detail.capacity, RESOURCES[key].physical ? sim.storageCapacity(state)[key] : null);
    near(detail.rates.net, perMinute(sim.rates(state)[key]));
  }
  assert.equal(JSON.stringify(state), before);
});

test('food separates real workplace consumption from averaged resident meals', () => {
  const state = sim.createGame(), school = build(state, 'school');
  sim.setWorkers(state, school.id, 2);
  const detail = resourceDetails(state, 'food'), daily = sim.rates(state);
  assert.ok(detail.rates.produced > 0);
  assert.ok(detail.rates.workplaceUsed > 0);
  near(detail.rates.workplaceUsed, perMinute(school.production.input.food));
  near(detail.rates.residentUsed, perMinute(daily.foodConsumed));
  near(detail.rates.net, detail.rates.produced - detail.rates.workplaceUsed - detail.rates.residentUsed);
  assert.ok(detail.sources.some(item => item.id === 'hearth'));
  assert.ok(detail.sinks.some(item => item.id === school.id && item.rate > 0));
});

test('the next meal uses the real 90-second work clock and current modified consumption', () => {
  const state = sim.createGame();
  state.time = 20; state.subsecond = .25; state.policies.charter = 'forge';
  state.resources.food = 19; sim.setWorkers(state, 'hearth', 2);
  const detail = resourceDetails(state, 'food');
  near(detail.meal.secondsUntil, 69.75);
  near(detail.meal.amount, state.population * .8 * 1.15);
  assert.equal(detail.meal.pantryMeals, Math.floor(19 / detail.meal.amount));
  assert.equal(detail.decline, null);
});

test('food never reports a starvation countdown when full storage stops a producer', () => {
  const state = sim.createGame(), orchard = build(state, 'orchard');
  sim.pauseBuilding(state, 'hearth', true);
  state.resources.food = sim.storageCapacity(state).food; sim.setWorkers(state, orchard.id, 2);
  const detail = resourceDetails(state, 'food');
  assert.equal(detail.full, true); assert.equal(detail.storageLimited, true);
  assert.equal(detail.sources.find(item => item.id === orchard.id).rate, 0);
  assert.ok(detail.rates.net < 0); assert.equal(detail.decline, null);
  assert.equal(detail.meal.pantryMeals, Math.floor(detail.stock / detail.meal.amount));
  state.resources.food -= 20; sim.setWorkers(state, orchard.id, 2);
  const resumed = resourceDetails(state, 'food');
  assert.equal(resumed.full, false); assert.ok(resumed.rates.produced > 0);
});

test('material estimates appear only for negative current flow and use actual inputs', () => {
  const state = sim.createGame(); state.research.completed.push('milling');
  Object.assign(state.resources, { wood: 100, stone: 100, planks: 30, flour: 60 });
  const bakery = build(state, 'bakery'); sim.pauseBuilding(state, 'hearth', true);
  state.resources.food = 10; sim.setWorkers(state, bakery.id, 2);
  const wood = resourceDetails(state, 'wood');
  assert.ok(wood.rates.net < 0); near(wood.rates.workplaceUsed, perMinute(bakery.production.input.wood));
  near(wood.decline.seconds, wood.stock / -wood.rates.net * 60);
  assert.equal(resourceDetails(state, 'food').decline, null);
  sim.pauseBuilding(state, bakery.id, true);
  assert.equal(resourceDetails(state, 'wood').decline, null);
});

test('paused and unstaffed producers remain actionable with zero actual contribution', () => {
  const state = sim.createGame(), orchard = build(state, 'orchard');
  sim.setWorkers(state, orchard.id, 0);
  let item = resourceDetails(state, 'food').sources.find(item => item.id === orchard.id);
  assert.equal(item.rate, 0); assert.equal(item.reason, 'No workers requested');
  sim.setWorkers(state, orchard.id, 2); sim.pauseBuilding(state, orchard.id, true);
  item = resourceDetails(state, 'food').sources.find(item => item.id === orchard.id);
  assert.equal(item.rate, 0); assert.equal(item.reason, 'Work paused');
  assert.equal(item.id, orchard.id);
  const types = resourceDetails(state, 'food').producerTypes;
  assert.ok(types.includes('orchard') && types.includes('garden') && types.includes('bakery'));
  assert.ok(!types.includes('hearth'));
});
