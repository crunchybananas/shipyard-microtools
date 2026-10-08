import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RESOURCE_NAMES, getBuildingSpec } from '../js/catalog.js';
import { createProgressionState } from '../js/progression.js';
import { COASTAL_PACING, createPressureState, normalizePressure, coastalReadiness, pressureOptions, actOnPressure, tickPressure, dailyPressure } from '../js/pressure.js';
import { coastalDefenseGuidance } from '../js/defense-guidance.js';
import { secondsUntil } from '../js/calendar.js';
import { createReadingClock } from '../js/reading-clock.js';
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
function warning(state) { dailyPressure(state); state.day = state.pressure.nextIncidentDay; const result = dailyPressure(state); assert.ok(pressureOptions(state).active); return result; }

test('coastal warnings require restored bell and twenty real citizens, then six minutes before warning and six to prepare', () => {
  const state = fixture(); state.won = false; dailyPressure(state); assert.equal(state.pressure.nextIncidentDay, null);
  state.won = true; state.citizens.pop(); dailyPressure(state); assert.equal(state.pressure.nextIncidentDay, null);
  state.citizens.push({ id: 'c20', job: 'idle', workplace: null });
  dailyPressure(state); assert.equal(state.pressure.nextIncidentDay, 5); assert.equal(state.pressure.active, null);
  assert.equal(pressureOptions(state).nextWarningSeconds, COASTAL_PACING.firstWarningSeconds);
  state.day = 4; dailyPressure(state); assert.equal(state.pressure.active, null);
  state.day = 5; assert.match(dailyPressure(state).events[0].text, /At most/);
  const option = pressureOptions(state).active; assert.equal(option.deadline, 9); assert.equal(option.daysLeft, 4); assert.equal(option.secondsLeft, COASTAL_PACING.warningSeconds);
  state.time = 45; assert.equal(pressureOptions(state).active.daysLeft, 3.5);
  state.day = 8; state.time = 0; dailyPressure(state); assert.ok(state.pressure.active);
});

test('paying spends the published demand once, grants no defense reward, and guarantees twelve quiet minutes', () => {
  const state = fixture(); warning(state); const option = pressureOptions(state).active, before = { ...state.resources };
  const result = actOnPressure(state, 'pay'); assert.equal(result.outcome, 'paid'); assert.equal(state.resources.food, before.food - option.demand.food);
  assert.equal(state.resources.gold, before.gold); assert.equal(state.pressure.paid, 1);
  assert.equal(actOnPressure(state, 'pay').ok, false); assert.equal(state.resources.food, before.food - option.demand.food);
  const next = state.pressure.nextIncidentDay; assert.equal(next, state.day + 8);
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
  assert.match(result.reason, /This cargo incident harmed no residents or buildings/);
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
    assert.equal(option.deadline - option.announcedDay, 4); assert.ok(option.requiredReadiness >= 3 && option.requiredReadiness <= 10);
    state.day = option.deadline; dailyPressure(state); const quiet = state.pressure.nextIncidentDay;
    assert.equal(quiet, state.day + 8); state.day = quiet; dailyPressure(state);
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
  const corruptions = [p => p.active.watchProgress = Infinity, p => p.active.watchProgress = 100000, p => p.active.deadline += 8, p => p.active.deadline = String(p.active.deadline), p => p.active.tier = 5, p => p.active.templateId = 'free_gold', p => p.defended = 1, p => p.nextIncidentDay = 999, p => p.version = 3];
  for (const corrupt of corruptions) { const invalid = structuredClone(state); corrupt(invalid.pressure); assert.throws(() => normalizePressure(invalid)); }
  const tampered = structuredClone(state); tampered.pressure.active.reward = { gold: 100000 }; normalizePressure(tampered);
  assert.deepEqual(pressureOptions(tampered).active.reward, { gold: 12 });
  const legacy = fixture(); delete legacy.pressure; normalizePressure(legacy); assert.deepEqual(legacy.pressure, createPressureState());
});

test('legacy active warnings migrate without changing deadlines, patrols, shelter or rewards', () => {
  const state = fixture(3); warning(state); tickPressure(state, 34); actOnPressure(state, 'shelter');
  state.pressure.version = 1; state.pressure.active.deadline = state.pressure.active.announcedDay + 3;
  state.day++; state.time = 17; state.subsecond = .25;
  const before = structuredClone(state.pressure), option = pressureOptions(state).active;
  normalizePressure(state);
  assert.deepEqual(state.pressure, { ...before, version: 2 });
  assert.equal(pressureOptions(state).active.secondsLeft, option.secondsLeft);
  const again = structuredClone(state); normalizePressure(again); assert.deepEqual(again.pressure, state.pressure);
  state.day = before.active.deadline; state.time = 0; state.subsecond = 0;
  assert.equal(dailyPressure(state).outcome, 'raided');
  assert.equal(state.pressure.nextIncidentDay, state.day + 8, 'New recovery follows the preserved old deadline');
  const invalid = fixture(); warning(invalid); invalid.pressure.version = 1;
  assert.throws(() => normalizePressure(invalid), 'A legacy record cannot silently acquire a longer active warning');
});

test('legacy pending and recovery dates survive unchanged, including overdue dormant schedules', () => {
  const pending = fixture(); pending.pressure.version = 1; pending.pressure.nextIncidentDay = 3;
  normalizePressure(pending); assert.equal(pending.pressure.nextIncidentDay, 3);
  pending.day = 8; pending.citizens.pop(); pending.population = 19;
  assert.equal(dailyPressure(pending).changed, false); normalizePressure(pending);
  assert.equal(pending.pressure.nextIncidentDay, 3); assert.equal(pending.pressure.active, null);
  pending.citizens.push({ id: 'c20', job: 'idle' }); pending.population = 20;
  dailyPressure(pending); assert.equal(pending.pressure.active.announcedDay, 8); assert.equal(pending.pressure.active.deadline, 12);
  const recovered = fixture(); warning(recovered); actOnPressure(recovered, 'pay');
  recovered.pressure.version = 1; recovered.pressure.graceUntilDay = recovered.day + 5;
  recovered.pressure.nextIncidentDay = recovered.pressure.graceUntilDay;
  const before = structuredClone(recovered.pressure); normalizePressure(recovered);
  assert.deepEqual(recovered.pressure, { ...before, version: 2 });
});

test('partial-cycle resolutions always grant at least twelve minutes and remain reloadable', () => {
  for (const [time, subsecond] of [[0, 0], [0, .25], [89, .75]]) {
    const state = fixture(); warning(state); state.time = time; state.subsecond = subsecond;
    assert.equal(actOnPressure(state, 'pay').ok, true);
    const remaining = secondsUntil(state, state.pressure.nextIncidentDay);
    assert.ok(remaining >= COASTAL_PACING.recoverySeconds);
    assert.ok(remaining < COASTAL_PACING.recoverySeconds + 90);
    const before = structuredClone(state.pressure); normalizePressure(state); assert.deepEqual(state.pressure, before);
    state.day = state.pressure.nextIncidentDay - 1; state.time = 89; state.subsecond = .75;
    dailyPressure(state); assert.equal(state.pressure.active, null);
    state.day++; state.time = 0; state.subsecond = 0;
    dailyPressure(state); assert.equal(pressureOptions(state).active.secondsLeft, 360);
  }
  const initial = fixture(); initial.time = 89; initial.subsecond = .75; dailyPressure(initial);
  assert.ok(pressureOptions(initial).nextWarningSeconds >= 360);
});

test('new cargo warnings wait through physical warnings and raids without resetting a due schedule', () => {
  const state = fixture(); dailyPressure(state); state.day = state.pressure.nextIncidentDay;
  const scheduled = state.pressure.nextIncidentDay;
  state.frontier = { warning: { id: 'physical-warning' }, raidActive: false };
  assert.equal(dailyPressure(state).changed, false); assert.equal(pressureOptions(state).announcementDeferred, true);
  state.day += 5; normalizePressure(state);
  assert.equal(state.pressure.nextIncidentDay, scheduled); assert.equal(state.pressure.sequence, 0);
  state.frontier.warning = null; state.frontier.raidActive = true;
  assert.equal(dailyPressure(state).changed, false);
  state.frontier.raidActive = false; state.frontier.nextRaidAt = 99999;
  assert.equal(dailyPressure(state).changed, true);
  assert.equal(pressureOptions(state).active.secondsLeft, 360);
  assert.equal(state.pressure.sequence, 1, 'A future physical timer does not deadlock the cargo warning');
});

test('an already announced cargo deadline resolves on time even alongside a saved physical threat', () => {
  const state = fixture(); warning(state); const deadline = state.pressure.active.deadline;
  state.frontier = { warning: { id: 'legacy-overlap' }, raidActive: true };
  state.day = deadline - 1; assert.equal(dailyPressure(state).changed, false);
  assert.equal(state.pressure.active.deadline, deadline);
  state.day = deadline; assert.equal(dailyPressure(state).outcome, 'raided');
  assert.equal(state.pressure.losses, 1); assert.equal(state.frontier.raidActive, true);
});

test('patrol estimates include fractions, shortages and the minimum real patrol work', () => {
  const state = fixture(3); warning(state);
  assert.equal(pressureOptions(state).active.patrolSecondsRemaining, 90);
  state.research.completed.push('watchkeeping', 'navigation'); state.buildings[0].production.efficiency = 1.2;
  assert.equal(pressureOptions(state).active.patrolSecondsRemaining, 90, 'Excess readiness cannot skip patrol work');
  state.research.completed = []; state.buildings[0].production.efficiency = 1 / 3;
  assert.equal(pressureOptions(state).active.patrolSecondsRemaining, 270);
  tickPressure(state, 270);
  assert.equal(pressureOptions(state).active.patrolSecondsRemaining, 0);
  assert.equal(pressureOptions(state).active.canDefend, false, 'Finished patrol work cannot replace current supplied readiness');
  state.buildings[0].production.efficiency = 0;
  assert.equal(pressureOptions(state).active.readinessShortfall, 3);
  const late = fixture(3); warning(late); late.day = late.pressure.active.deadline - 1; late.time = 89; late.subsecond = .75;
  assert.equal(pressureOptions(late).active.secondsLeft, .25);
  assert.equal(pressureOptions(late).active.canPrepareInTime, false);
  assert.match(coastalDefenseGuidance(late).timeWarning, /miss the deadline/);
});

test('cargo guidance is pure, routes real blockers, and never counts company troops or walls as guards', () => {
  const state = fixture(); state.buildings = [];
  assert.equal(coastalDefenseGuidance(state).nextStep.researchId, 'civic_order');
  state.research.completed.push('civic_order'); assert.equal(coastalDefenseGuidance(state).nextStep.researchId, 'watchkeeping');
  state.research.completed.push('watchkeeping'); assert.equal(coastalDefenseGuidance(state).nextStep.type, 'barracks');
  state.buildings.push({ id: 'watch', type: 'barracks', status: 'queued', paused: false });
  assert.equal(coastalDefenseGuidance(state).nextStep.buildingId, 'watch');
  Object.assign(state.buildings[0], { status: 'ready', level: 1, production: { efficiency: 1 }, workerIds: ['fake'], desiredWorkers: 3 });
  state.frontier = { units: [{ faction: 'player', kind: 'spearman', status: 'active' }], fortifications: [{ type: 'wall', status: 'ready' }] };
  warning(state);
  assert.equal(coastalDefenseGuidance(state).readiness, 0);
  assert.equal(coastalDefenseGuidance(state).nextStep.id, 'supplied-guards');
  state.resources.food = 0; assert.equal(coastalDefenseGuidance(state).nextStep.resource, 'food');
  state.resources.food = 100;
  for (const citizen of state.citizens.slice(0, 3)) Object.assign(citizen, { job: 'guard', workplace: 'watch' });
  assert.equal(coastalDefenseGuidance(state).nextStep.kind, 'wait');
  tickPressure(state, 90); assert.equal(coastalDefenseGuidance(state).nextStep.action, 'defend');
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
  const before = JSON.stringify(state); freeze(state);
  const guide = coastalDefenseGuidance(state); assert.match(guide.distinction, /separate|physical enemies/);
  assert.equal(JSON.stringify(state), before);
});

test('guidance finds usable watch capacity instead of pointing at an already full house', () => {
  const state = fixture(3); warning(state); actOnPressure(state, 'pay'); state.day = state.pressure.nextIncidentDay; dailyPressure(state);
  assert.equal(pressureOptions(state).active.requiredReadiness, 4);
  assert.equal(coastalDefenseGuidance(state).nextStep.kind, 'build');
  assert.equal(coastalDefenseGuidance(state).nextStep.type, 'barracks');
  const second = { id: 'second-watch', type: 'barracks', status: 'ready', level: 1, paused: true, desiredWorkers: 0, production: { efficiency: 0 } };
  state.buildings.push(second);
  assert.equal(coastalDefenseGuidance(state).nextStep.buildingId, 'second-watch');
  assert.match(coastalDefenseGuidance(state).nextStep.detail, /Resume/);
  second.paused = false;
  assert.equal(coastalDefenseGuidance(state).nextStep.buildingId, 'second-watch');
  second.desiredWorkers = 3;
  assert.equal(coastalDefenseGuidance(state).nextStep.tab, 'workforce');
  state.resources.food = .01; state.buildings[0].production.blockedReason = 'Needs food'; state.buildings[0].production.efficiency = .1;
  assert.equal(coastalDefenseGuidance(state).nextStep.resource, 'food');
});

test('an unprepared town gets an honest deadline warning and an available cargo response', () => {
  const state = fixture(); warning(state); state.day = state.pressure.active.deadline - 1; state.time = 80;
  let guide = coastalDefenseGuidance(state);
  assert.equal(guide.readiness, 0); assert.match(guide.timeWarning, /Even a full-strength watch/);
  assert.equal(guide.nextStep.action, 'pay');
  state.resources.food = 0; guide = coastalDefenseGuidance(state);
  assert.equal(guide.nextStep.action, 'shelter');
  assert.match(guide.nextStep.detail, /reduce maximum cargo loss by 40%/);
});

test('a real saved town with an overdue dormant legacy schedule restores without losing its date', async () => {
  const raw = JSON.parse(await readFile(new URL('../review/campaign-foundation-save.json', import.meta.url), 'utf8'));
  raw.citizens = raw.citizens.slice(0, 19); raw.population = 19; raw.builderTarget = Math.min(19, raw.builderTarget);
  raw.pressure = { ...createPressureState(), version: 1, nextIncidentDay: raw.day - 2 };
  const state = sim.restore(raw); assert.ok(state);
  assert.equal(state.pressure.nextIncidentDay, raw.day - 2);
  const again = sim.restore(sim.serialize(state)); assert.ok(again);
  assert.deepEqual(again.pressure, state.pressure);
});

test('real simulation pause freezes cargo time; three-times speed advances the same deterministic deadline', async () => {
  const raw = await readFile(new URL('../review/campaign-foundation-save.json', import.meta.url), 'utf8');
  const original = sim.restore(raw); assert.ok(original);
  original.pressure = createPressureState();
  dailyPressure(original);
  const normal = sim.restore(sim.serialize(original)), fast = sim.restore(sim.serialize(original));
  const clock = createReadingClock(3), before = sim.serialize(fast);
  sim.tick(fast, 30 * clock.observe(true)); assert.equal(sim.serialize(fast), before);
  sim.tick(normal, 30); sim.tick(fast, 30 * clock.observe(false));
  const initialSeconds = pressureOptions(original).nextWarningSeconds;
  assert.equal(pressureOptions(normal).nextWarningSeconds, initialSeconds - 30);
  assert.equal(pressureOptions(fast).nextWarningSeconds, initialSeconds - 90);
  const loaded = sim.restore(sim.serialize(fast)); assert.ok(loaded);
  assert.equal(loaded.pressure.nextIncidentDay, fast.pressure.nextIncidentDay);
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
