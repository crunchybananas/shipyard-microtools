import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { calendarDay, calendarFraction } from '../js/calendar.js';
import { createReadingClock } from '../js/reading-clock.js';
import { seasonInfo, festivalQuote, festivalStatus, effectiveMorale, householdMeal } from '../js/seasons.js';

// Date fixtures skip the opening campaign; timing and economy assertions below
// advance the real simulator. No wall-clock time or browser save is involved.
function setClock(state, seconds) {
  state.day = Math.floor(seconds / 90) + 1;
  state.time = Math.floor(seconds % 90);
  state.subsecond = seconds % 1;
  state.elapsed = seconds;
  state.frontier.clock = seconds;
  return state;
}
const at = seconds => setClock(sim.createGame(), seconds);
const autumn = () => at(2160.25);
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('three calendar days per season, twelve per year, with exact transitions', () => {
  const state = sim.createGame();
  assert.equal(seasonInfo(state).label, 'Spring 1 · Year 1');
  assert.equal(seasonInfo(state).secondsUntilAutumn, 2160);
  for (const [seconds, id, day, year] of [[1079.75, 'spring', 3, 1], [1080, 'summer', 1, 1], [2160, 'autumn', 1, 1], [3240, 'winter', 1, 1], [4320, 'spring', 1, 2]]) {
    setClock(state, seconds);
    const info = seasonInfo(state);
    assert.equal(info.id, id); assert.equal(info.day, day); assert.equal(info.year, year);
    assert.equal(info.calendarDay, calendarDay(state));
    assert.ok(info.progress >= 0 && info.progress < 1);
    if (seconds % 1080 === 0) assert.equal(info.secondsUntilSeason, 1080);
  }
  setClock(state, 3239.75);
  assert.equal(seasonInfo(state).secondsUntilAutumn, 0);
  sim.tick(state, .25);
  assert.equal(seasonInfo(state).id, 'winter');
  assert.equal(seasonInfo(state).secondsUntilAutumn, 3240);
});

test('old v1-v4 saves acquire empty optional history without changing their displayed date or supplies', () => {
  for (const version of [1, 2, 3, 4]) {
    const raw = JSON.parse(sim.serialize(at(577.25)));
    raw.version = version; delete raw.seasons; delete raw.calendarEpoch;
    if (version === 1) raw.time += raw.subsecond;
    const restored = sim.restore(raw);
    assert.ok(restored, `v${version} accepted`);
    assert.deepEqual(restored.seasons, { lastFestivalYear: 0, festival: null });
    assert.equal(calendarDay(restored), raw.day);
    assert.equal(seasonInfo(restored).calendarDay, raw.day);
    assert.equal(seasonInfo(restored).id, 'autumn');
    for (const key of ['wood', 'stone', 'food']) assert.equal(restored.resources[key], raw.resources[key]);
    const phase = calendarFraction(restored);
    sim.tick(restored, 90);
    assert.ok(Math.abs(calendarFraction(restored) - phase - .25) < 1e-8);
  }
});

test('pure date, status and quote reads do not create metadata, debit food, or advance paused time', () => {
  const state = autumn(); delete state.seasons;
  const before = sim.serialize(state); freeze(state);
  for (let i = 0; i < 3; i++) {
    assert.equal(seasonInfo(state).id, 'autumn');
    assert.equal(festivalStatus(state).active, false);
    assert.equal(festivalQuote(state).ok, true);
    assert.equal(effectiveMorale(state), state.morale);
  }
  assert.equal(sim.serialize(state), before);
});

test('an active festival in a migrated fractional calendar retains its date and timer after reload', () => {
  const raw = JSON.parse(sim.serialize(at(577.25))); delete raw.calendarEpoch; delete raw.seasons;
  const migrated = sim.restore(raw); assert.ok(migrated);
  assert.equal(seasonInfo(migrated).id, 'autumn');
  assert.equal(sim.celebrateHarvest(migrated).ok, true);
  sim.tick(migrated, 137.5);
  const status = festivalStatus(migrated), date = seasonInfo(migrated);
  const loaded = sim.restore(sim.serialize(migrated)); assert.ok(loaded);
  assert.equal(loaded.calendarEpoch, migrated.calendarEpoch);
  assert.deepEqual(festivalStatus(loaded), status);
  assert.deepEqual(seasonInfo(loaded), date);
  assert.equal(status.remainingSeconds, 222.5);
  sim.tick(loaded, 222.5);
  assert.equal(festivalStatus(loaded).active, false);
  assert.equal(festivalQuote(loaded).ok, false);
});

test('the quote states scaling cost, modified two-meal reserve and exact affordability', () => {
  const state = autumn();
  assert.equal(festivalQuote(state).cost.food, 12);
  state.population = 20; // pricing-only fixture; no labor or save assertion
  state.policies.charter = 'forge'; state.research.completed.push('public_health');
  const quote = festivalQuote(state);
  assert.equal(quote.cost.food, 30);
  assert.equal(quote.mealFood, 17.48);
  assert.equal(quote.mealFood, householdMeal(state));
  assert.equal(quote.reserveFood, 35);
  state.resources.food = quote.cost.food + quote.reserveFood - .000001;
  assert.equal(festivalQuote(state).ok, false);
  const before = sim.serialize(state);
  assert.equal(sim.celebrateHarvest(state).ok, false);
  assert.equal(sim.serialize(state), before);
  state.resources.food += .000001;
  assert.equal(sim.celebrateHarvest(state).ok, true);
  assert.equal(state.resources.food, quote.reserveFood);
  state.policies.charter = 'breadbasket';
  assert.equal(householdMeal(state), 15.96);
});

test('spring, summer and winter cannot host even with surplus food', () => {
  for (const seconds of [0, 1080, 3240]) {
    const state = at(seconds), before = sim.serialize(state);
    assert.match(festivalQuote(state).reason, /autumn/);
    assert.equal(sim.celebrateHarvest(state).ok, false);
    assert.equal(sim.serialize(state), before);
  }
});

test('confirmation requotes changed food, population and season without spending', () => {
  for (const change of [
    state => { state.resources.food = 21; },
    state => { state.population = 100; },
    state => setClock(state, 3240),
  ]) {
    const state = autumn(); assert.equal(festivalQuote(state).ok, true);
    change(state); const before = sim.serialize(state);
    assert.equal(sim.celebrateHarvest(state).ok, false);
    assert.equal(sim.serialize(state), before);
  }
});

test('one charge and one journal event per town year, including reload; next autumn unlocks again', () => {
  const state = autumn(), food = state.resources.food, base = state.morale;
  const result = sim.celebrateHarvest(state);
  assert.equal(result.ok, true); assert.equal(state.resources.food, food - result.cost.food);
  assert.equal(state.morale, base); assert.equal(effectiveMorale(state), base + 8);
  assert.equal(state.events.filter(event => event.type === 'festival').length, 1);
  const before = sim.serialize(state);
  assert.equal(sim.celebrateHarvest(state).ok, false); assert.equal(sim.serialize(state), before);
  const restored = sim.restore(before); assert.ok(restored);
  assert.equal(festivalStatus(restored).active, true);
  assert.equal(sim.celebrateHarvest(restored).ok, false);
  setClock(restored, 6480.25);
  assert.equal(seasonInfo(restored).year, 2);
  assert.equal(sim.celebrateHarvest(restored).ok, true);
  assert.equal(restored.events.filter(event => event.type === 'festival').length, 2);
});

test('morale overlay changes migration immediately, caps at 100, and never writes the baseline', () => {
  const state = sim.createGame();
  assert.equal(sim.build(state, 'cottage', -2, 2).ok, true); sim.tick(state, 30);
  assert.equal(state.buildings.find(b => b.type === 'cottage').status, 'ready');
  setClock(state, 2160.25); state.morale = 40;
  assert.equal(sim.villageNeeds(state).migration.eligible, false);
  assert.equal(sim.celebrateHarvest(state).ok, true);
  assert.equal(state.morale, 40); assert.equal(sim.villageNeeds(state).morale, 48);
  assert.equal(sim.rates(state).happiness, 48); assert.equal(sim.rates(state).morale, 48);
  assert.equal(state.migration.eligible, true);
  state.morale = 98; assert.equal(effectiveMorale(state), 100); assert.equal(state.morale, 98);
});

test('fractional duration expires exactly after 360 simulated seconds, including a winter crossing', () => {
  const state = at(3239.75);
  assert.equal(sim.celebrateHarvest(state).ok, true);
  sim.tick(state, 359.75);
  assert.equal(seasonInfo(state).id, 'winter');
  assert.equal(festivalStatus(state).remainingSeconds, .25);
  const loaded = sim.restore(sim.serialize(state)); assert.ok(loaded);
  assert.equal(festivalStatus(loaded).remainingSeconds, .25);
  sim.tick(loaded, .25);
  assert.equal(festivalStatus(loaded).active, false);
  assert.equal(festivalStatus(loaded).remainingSeconds, 0);
  assert.equal(effectiveMorale(loaded), loaded.morale);
  assert.equal(festivalStatus(loaded).celebratedThisYear, true);
});

test('fractional expiry immediately refreshes cached arrival guidance and signals a visual change', () => {
  const state = sim.createGame();
  assert.equal(sim.build(state, 'cottage', -2, 2).ok, true); sim.tick(state, 30);
  setClock(state, 2160.25); state.morale = 40;
  assert.equal(sim.celebrateHarvest(state).ok, true);
  assert.equal(state.migration.eligible, true);
  // Stage the final quarter-second with the same household and baseline: this
  // boundary must update the cached guidance even though no economy tick runs.
  setClock(state, 2520);
  const result = sim.tick(state, .25);
  assert.equal(result.days, 0); assert.equal(result.changed, true);
  assert.equal(state.morale, 40);
  assert.equal(state.migration.eligible, false);
  assert.deepEqual(state.migration, sim.villageNeeds(state).migration);
});

test('reading pause and reload preserve duration; the existing speed multiplier advances only simulation time', () => {
  const state = autumn(); sim.celebrateHarvest(state);
  const reading = createReadingClock(3), before = sim.serialize(state);
  sim.tick(state, 15 * reading.observe(true));
  assert.equal(sim.serialize(state), before);
  const loaded = sim.restore(before); assert.ok(loaded);
  loaded.elapsed += 100000; // elapsed is not the authoritative festival clock
  assert.equal(festivalStatus(loaded).remainingSeconds, 360);
  sim.tick(loaded, 10 * reading.observe(false));
  assert.equal(festivalStatus(loaded).remainingSeconds, 330);
  assert.equal(sim.restore(sim.serialize(loaded)).seasons.festival.startedAt, state.seasons.festival.startedAt);
});

test('a large tick and fractional ticks agree on expiry and baseline morale; no bonus leaks into future morale', () => {
  const large = autumn(); large.morale = 40; large.resources.food = 180;
  const control = sim.restore(sim.serialize(large));
  const quote = sim.celebrateHarvest(large); control.resources.food -= quote.cost.food;
  const split = sim.restore(sim.serialize(large));
  sim.tick(large, 450);
  for (let i = 0; i < 1800; i++) sim.tick(split, .25);
  sim.tick(control, 450);
  assert.equal(festivalStatus(large).active, false);
  assert.equal(large.morale, split.morale); assert.equal(large.morale, control.morale);
  assert.equal(effectiveMorale(large), control.morale);
  assert.deepEqual(festivalStatus(large), festivalStatus(split));
  assert.deepEqual(large.resources, split.resources);
});

test('malformed optional festival data cannot grant a bonus or invalidate an otherwise valid town', () => {
  for (const invalid of [undefined, null, [], 'autumn', { lastFestivalYear: -1 }, { lastFestivalYear: Infinity },
    { festival: { year: 1, startedAt: NaN } }, { festival: { year: 1, startedAt: 2161 } },
    { festival: { year: 2, startedAt: 2160 } }, { festival: { year: 1, startedAt: 0 } },
    { festival: { year: 1, startedAt: '2160' } }, { festival: [] }]) {
    const raw = JSON.parse(sim.serialize(autumn())); raw.seasons = invalid;
    const loaded = sim.restore(raw); assert.ok(loaded);
    assert.equal(festivalStatus(loaded).active, false);
    assert.deepEqual(loaded.seasons, { lastFestivalYear: 0, festival: null });
    assert.equal(loaded.resources.food, raw.resources.food);
  }
  const raw = JSON.parse(sim.serialize(autumn()));
  raw.seasons = { lastFestivalYear: 1, festival: { year: 1, startedAt: Infinity } };
  const loaded = sim.restore(raw); assert.ok(loaded);
  assert.equal(loaded.seasons.lastFestivalYear, 1);
  assert.equal(festivalQuote(loaded).ok, false);
  raw.seasons = { lastFestivalYear: 0, festival: { year: 1, startedAt: 2160 } };
  assert.equal(sim.restore(raw).seasons.lastFestivalYear, 1, 'A valid record retains the annual charge history');
});

test('towns keep independent seasons and festival history across save switching', () => {
  const home = autumn(), companion = at(0), otherAutumn = autumn();
  sim.celebrateHarvest(home);
  assert.equal(festivalQuote(otherAutumn).ok, true);
  assert.equal(festivalStatus(companion).active, false);
  const saves = [home, companion, otherAutumn].map(sim.serialize);
  sim.tick(home, 360);
  assert.equal(festivalStatus(home).active, false);
  const restored = saves.map(sim.restore);
  assert.equal(festivalStatus(restored[0]).active, true);
  assert.equal(seasonInfo(restored[1]).id, 'spring');
  assert.equal(festivalStatus(restored[2]).active, false);
  assert.equal(sim.celebrateHarvest(restored[2]).ok, true);
  assert.equal(restored[0].seasons.festival.startedAt, 2160.25);
});
