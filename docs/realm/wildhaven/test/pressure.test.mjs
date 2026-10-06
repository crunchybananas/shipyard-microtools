import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RESOURCE_NAMES, getBuildingSpec } from '../js/catalog.js';
import { createProgressionState } from '../js/progression.js';
import { createPressureState, normalizePressure, coastalReadiness, pressureOptions, actOnPressure, tickPressure, dailyPressure } from '../js/pressure.js';
import * as sim from '../js/sim.js';

// Explicit small pressure fixtures isolate threat terms from town-building progression.
function fixture(guards = 0) {
  const state = {
    day: 1, time: 0, won: true, population: 20, resources: Object.fromEntries(RESOURCE_NAMES.map(key => [key, 100])),
    storage: Object.fromEntries(RESOURCE_NAMES.map(key => [key, 1000])), ...createProgressionState(), pressure: createPressureState(),
    buildings: [{ id: 'watch', type: 'barracks', status: 'ready', level: 1, paused: false, production: { efficiency: guards / 3 } }],
    citizens: Array.from({ length: 20 }, (_, i) => ({ id: `c${i + 1}`, job: i < guards ? 'guard' : 'idle', workplace: i < guards ? 'watch' : null })),
  };
  return state;
}
function warning(state) { dailyPressure(state); state.day += 2; const result = dailyPressure(state); assert.ok(pressureOptions(state).active); return result; }

test('coastal warnings require restored bell and twenty real citizens; every incident gives three days', () => {
  const state = fixture(); state.won = false; dailyPressure(state); assert.equal(state.pressure.nextIncidentDay, null);
  state.won = true; state.citizens.pop(); dailyPressure(state); assert.equal(state.pressure.nextIncidentDay, null);
  state.citizens.push({ id: 'c20', job: 'idle', workplace: null });
  dailyPressure(state); assert.equal(state.pressure.nextIncidentDay, 3); assert.equal(state.pressure.active, null);
  state.day = 2; dailyPressure(state); assert.equal(state.pressure.active, null);
  state.day = 3; assert.match(dailyPressure(state).events[0].text, /At most/);
  const option = pressureOptions(state).active; assert.equal(option.deadline, 6); assert.equal(option.daysLeft, 3);
  state.time = 45; assert.equal(pressureOptions(state).active.daysLeft, 2.5);
  state.day = 5; state.time = 0; dailyPressure(state); assert.ok(state.pressure.active);
});

test('paying spends the published demand once, grants no defense reward, and guarantees five quiet days', () => {
  const state = fixture(); warning(state); const option = pressureOptions(state).active, before = { ...state.resources };
  const result = actOnPressure(state, 'pay'); assert.equal(result.outcome, 'paid'); assert.equal(state.resources.food, before.food - option.demand.food);
  assert.equal(state.resources.gold, before.gold); assert.equal(state.pressure.paid, 1);
  assert.equal(actOnPressure(state, 'pay').ok, false); assert.equal(state.resources.food, before.food - option.demand.food);
  const next = state.pressure.nextIncidentDay; assert.equal(next, state.day + 5);
  for (state.day++; state.day < next; state.day++) { dailyPressure(state); assert.equal(state.pressure.active, null); }
  dailyPressure(state); assert.equal(state.pressure.active.templateId, 'timber_runners');
});

test('an unaffordable demand and repeated shelter actions are inert', () => {
  const state = fixture(); warning(state); state.resources.food = 0;
  const before = structuredClone(state); assert.equal(actOnPressure(state, 'pay').ok, false); assert.deepEqual(state, before);
  const wood = state.resources.wood, planks = state.resources.planks;
  assert.equal(actOnPressure(state, 'shelter').ok, true); assert.equal(state.resources.wood, wood - 8); assert.equal(state.resources.planks, planks - 6);
  assert.equal(actOnPressure(state, 'shelter').ok, false); assert.equal(state.resources.wood, wood - 8);
  assert.equal(actOnPressure(state, 'invent-reward').ok, false);
  const fractional = fixture(); warning(fractional); fractional.resources.wood = 7.999999; fractional.resources.planks = 5.999999;
  assert.equal(actOnPressure(fractional, 'shelter').ok, true); assert.equal(fractional.resources.wood, 0); assert.equal(fractional.resources.planks, 0);
});

test('warehouses and temporary shelter measurably lower the maximum loss; people and buildings are untouched', () => {
  const state = fixture(); warning(state); const unprotected = pressureOptions(state).active.maximumLoss;
  state.buildings.push({ id: 'store', type: 'warehouse', status: 'ready', level: 3, paused: false });
  assert.equal(pressureOptions(state).active.warehouseProtection, .2);
  actOnPressure(state, 'shelter'); const option = pressureOptions(state).active;
  assert.equal(option.maximumLoss.food, Math.ceil(unprotected.food * .8 * .6));
  const citizens = structuredClone(state.citizens), buildings = structuredClone(state.buildings), before = { ...state.resources };
  state.day = option.deadline; const result = dailyPressure(state);
  assert.equal(result.outcome, 'raided'); assert.equal(state.resources.food, before.food - option.projectedLoss.food);
  assert.deepEqual(state.citizens, citizens); assert.deepEqual(state.buildings, buildings); assert.equal(state.pressure.losses, 1);
  for (const [key, amount] of Object.entries(result.loss)) assert.ok(amount <= option.maximumLoss[key]);
  assert.match(result.reason, /Everyone is safe/);
});

test('actual supplied guards need patrol time; instant staffing cannot trigger a free defense reward', () => {
  const state = fixture(3); warning(state); const before = state.resources.gold;
  assert.equal(coastalReadiness(state).readiness, 3); assert.equal(pressureOptions(state).active.canDefend, false);
  tickPressure(state, 45); assert.equal(pressureOptions(state).active.preparedness, .5);
  assert.equal(actOnPressure(state, 'defend').ok, false); assert.equal(state.resources.gold, before);
  tickPressure(state, 45); const option = pressureOptions(state).active; assert.equal(option.canDefend, true);
  const result = actOnPressure(state, 'defend'); assert.equal(result.outcome, 'defended'); assert.equal(state.resources.gold, before + option.reward.gold);
  assert.equal(state.routes.reputation.reedbank, 1); assert.equal(state.pressure.defended, 1);
  assert.equal(actOnPressure(state, 'defend').ok, false); assert.equal(state.routes.reputation.reedbank, 1);
});

test('guard input shortages, vacancies and pauses reduce readiness and patrol work honestly', () => {
  const state = fixture(3); warning(state); state.buildings[0].production.efficiency = .5;
  assert.equal(coastalReadiness(state).readiness, 1.5); tickPressure(state, 90);
  assert.equal(pressureOptions(state).active.preparedness, .5); assert.equal(pressureOptions(state).active.canDefend, false);
  state.buildings[0].production.efficiency = 0; tickPressure(state, 90); assert.equal(pressureOptions(state).active.preparedness, .5);
  state.buildings[0].production.efficiency = 1; state.buildings[0].paused = true; assert.equal(coastalReadiness(state).readiness, 0);
  state.buildings[0].paused = false; state.citizens.forEach(c => { c.job = 'idle'; }); assert.equal(coastalReadiness(state).readiness, 0);
});

test('researched organization and actual skill change the required guard labor', () => {
  const state = fixture(3); warning(state); actOnPressure(state, 'pay'); state.day = state.pressure.nextIncidentDay; dailyPressure(state);
  assert.equal(pressureOptions(state).active.requiredReadiness, 4);
  assert.equal(pressureOptions(state).active.canDefend, false);
  state.research.completed.push('watchkeeping', 'navigation'); state.buildings[0].production.efficiency = 1.1;
  assert.ok(coastalReadiness(state).readiness > 4); tickPressure(state, 90);
  assert.equal(pressureOptions(state).active.canDefend, true);
  const lessSkilled = fixture(3); lessSkilled.research.completed = [...state.research.completed];
  assert.ok(coastalReadiness(lessSkilled).readiness < 4);
});

test('partial defense lowers actual theft and zero stock cannot become negative', () => {
  const state = fixture(1); warning(state); tickPressure(state, 90); const option = pressureOptions(state).active;
  assert.ok(option.projectedLoss.food > 0 && option.projectedLoss.food < option.maximumLoss.food);
  state.resources.wood = 0; state.day = option.deadline; const result = dailyPressure(state);
  assert.equal(result.loss.wood, 0); assert.equal(state.resources.wood, 0); assert.equal(state.pressure.defended, 0);
  const saved = JSON.stringify(state); dailyPressure(state); assert.equal(JSON.stringify(state), saved);
});

test('a prepared supplied watch automatically defends at the announced deadline', () => {
  const state = fixture(3); warning(state); tickPressure(state, 90); const before = state.resources.food;
  state.day = state.pressure.active.deadline; const result = dailyPressure(state);
  assert.equal(result.outcome, 'defended'); assert.equal(state.resources.food, before); assert.equal(state.routes.reputation.reedbank, 1);
});

test('all four incidents rotate deterministically, scale within bounds and leave recovery time', () => {
  const state = fixture(); warning(state); const types = [];
  for (let i = 0; i < 8; i++) {
    types.push(state.pressure.active.templateId); const option = pressureOptions(state).active;
    assert.equal(option.deadline - option.announcedDay, 3); assert.ok(option.requiredReadiness >= 3 && option.requiredReadiness <= 10);
    state.day = option.deadline; dailyPressure(state); const quiet = state.pressure.nextIncidentDay;
    assert.equal(quiet, state.day + 5); state.day = quiet; dailyPressure(state);
  }
  assert.deepEqual(types.slice(0, 4), types.slice(4)); assert.equal(new Set(types).size, 4);
  const large = fixture(); large.citizens = Array.from({ length: 75 }, (_, i) => ({ id: `c${i + 1}`, job: 'idle' })); warning(large);
  assert.equal(large.pressure.active.tier, 2); assert.equal(pressureOptions(large).active.requiredReadiness, 7);
});

test('canonical terms, patrol progress and one-time resolution survive normalization; malformed saves fail', () => {
  const state = fixture(3); warning(state); tickPressure(state, 34); actOnPressure(state, 'shelter');
  const copy = structuredClone(state); normalizePressure(copy); assert.deepEqual(copy.pressure, state.pressure);
  tickPressure(copy, 56); assert.equal(actOnPressure(copy, 'defend').outcome, 'defended');
  normalizePressure(copy); assert.equal(actOnPressure(copy, 'defend').ok, false);
  const corruptions = [p => p.active.watchProgress = Infinity, p => p.active.watchProgress = 100000, p => p.active.deadline += 8, p => p.active.tier = 5, p => p.active.templateId = 'free_gold', p => p.defended = 1, p => p.nextIncidentDay = 999, p => p.version = 2];
  for (const corrupt of corruptions) { const invalid = structuredClone(state); corrupt(invalid.pressure); assert.throws(() => normalizePressure(invalid)); }
  const tampered = structuredClone(state); tampered.pressure.active.reward = { gold: 100000 }; normalizePressure(tampered);
  assert.deepEqual(pressureOptions(tampered).active.reward, { gold: 12 });
  const legacy = fixture(); delete legacy.pressure; normalizePressure(legacy); assert.deepEqual(legacy.pressure, createPressureState());
});

test('earned campaign integration preserves active incidents, actual labor and partial patrols through save/load', async () => {
  // This checkpoint was earned from createGame; this continuation adds no resources or unlocks.
  const raw = await readFile(new URL('../review/campaign-foundation-save.json', import.meta.url), 'utf8');
  let state = sim.restore(raw); assert.ok(state); assert.equal(state.pressure.sequence, 0);
  // The stock-target bot had released harvesters at its checkpoint; ongoing patrols need meals.
  for (const b of state.buildings.filter(b => ['barracks', 'orchard', 'garden'].includes(b.type))) sim.setWorkers(state, b.id, getBuildingSpec(b.type, b.level).workers);
  while (!state.pressure.active) sim.tick(state, 1);
  sim.tick(state, 37); assert.ok(state.pressure.active.watchProgress > 0);
  const saved = sim.serialize(state), restored = sim.restore(saved); assert.ok(restored); assert.deepEqual(restored.pressure, state.pressure);
  for (let i = 0; i < 60; i++) { sim.tick(state, 1); sim.tick(restored, 1); }
  assert.deepEqual(restored.resources, state.resources); assert.deepEqual(restored.pressure, state.pressure);
  assert.equal(sim.actOnPressure(restored, 'defend').ok, true); assert.equal(restored.pressure.defended, 1);
  const finished = sim.restore(sim.serialize(restored)); assert.ok(finished); assert.equal(sim.actOnPressure(finished, 'defend').ok, false);
  const invalid = JSON.parse(saved); invalid.pressure.active.watchProgress = -1; assert.equal(sim.restore(invalid), null);
  assert.ok(restored.events.some(event => event.type === 'defense'));
  assert.equal(sim.workforce(restored).assigned + sim.workforce(restored).idle, restored.population);
});
