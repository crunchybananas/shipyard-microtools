import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { CALENDAR_DAY_SECONDS, calendarDay, calendarFraction, workPosition, perMinute, secondsUntil, until } from '../js/calendar.js';

test('the calendar takes six minutes while four economy cycles run at their original speed', () => {
  const state = sim.createGame();
  sim.tick(state, 90);
  assert.equal(state.day, 2); // existing meals, arrivals, quotas and deadline clock
  assert.equal(state.stats.harvests, 1);
  assert.equal(state.frontier.clock, 90);
  assert.equal(calendarDay(state), 1);
  assert.equal(calendarFraction(state), .25);
  sim.tick(state, 269.75);
  assert.equal(calendarDay(state), 1);
  assert.ok(calendarFraction(state) > .999);
  sim.tick(state, .25);
  assert.equal(calendarDay(state), 2);
  assert.equal(calendarFraction(state), 0);
  assert.equal(state.stats.harvests, 4);
  assert.equal(state.frontier.clock, CALENDAR_DAY_SECONDS);
});

test('old saves keep their displayed day and time, then advance at the slower calendar pace', () => {
  const original = sim.createGame(); sim.tick(original, 217.25);
  const old = JSON.parse(sim.serialize(original)); delete old.calendarEpoch;
  const loaded = sim.restore(old);
  assert.ok(loaded);
  assert.equal(calendarDay(loaded), old.day);
  const phase = (old.time + old.subsecond) / sim.DAY_LENGTH;
  assert.ok(Math.abs(calendarFraction(loaded) - phase) < 1e-8);
  assert.equal(calendarDay(loaded, 1), 1);
  assert.deepEqual(loaded.resources, old.resources);
  assert.deepEqual(loaded.frontier, original.frontier);
  sim.tick(loaded, 45);
  assert.ok(Math.abs(calendarFraction(loaded) - phase - .125) < 1e-8);
  const again = sim.restore(sim.serialize(loaded));
  assert.ok(again);
  assert.equal(again.calendarEpoch, loaded.calendarEpoch);
  assert.equal(calendarDay(again), calendarDay(loaded));
  assert.equal(calendarFraction(again), calendarFraction(loaded));
  assert.equal(workPosition(again), workPosition(loaded));
});

test('calendar metadata cannot be negative, non-finite, or ahead of the saved work clock', () => {
  for (const bad of [-1, null, '0', 1, Infinity]) {
    const saved = JSON.parse(sim.serialize(sim.createGame())); saved.calendarEpoch = bad;
    assert.equal(sim.restore(saved), null, `Rejected ${String(bad)}`);
  }
});

test('rate and deadline presentation retain actual gameplay duration at normal speed', () => {
  const state = sim.createGame(); sim.tick(state, 30.25);
  assert.equal(perMinute(12), 8);
  assert.equal(secondsUntil(state, 3), 149.75);
  assert.equal(until(state, 3), '2m 30s');
  assert.equal(until(state, 1), '0s');
  const before = sim.serialize(state); sim.tick(state, 0);
  assert.equal(sim.serialize(state), before);
});
