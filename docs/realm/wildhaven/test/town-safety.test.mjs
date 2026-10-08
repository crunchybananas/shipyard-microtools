import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/sim.js';
import { dailyPressure } from '../js/pressure.js';
import { townSafety } from '../js/town-safety.js';

function coastalTown() {
  const state = createGame(); state.won = true; state.population = 20;
  state.citizens = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, job: 'idle' }));
  dailyPressure(state); state.day = state.pressure.nextIncidentDay; dailyPressure(state);
  return state;
}
test('quiet, scheduled future raids and friendly troops do not invent an active warning', () => {
  const state = createGame(); state.frontier.nextRaidAt = 500;
  state.frontier.units.push({ faction: state.frontier.neighbors[0].id, status: 'active' });
  assert.equal(townSafety(state).level, 'calm');
});
test('coastal incidents and arriving frontier raids both appear with their real clocks', () => {
  const state = coastalTown();
  assert.equal(townSafety(state).level, 'approaching');
  assert.match(townSafety(state).label, /^Sails/);
  state.frontier.clock = 40; state.frontier.warning = { amount: 3, attackAt: 130 };
  const status = townSafety(state);
  assert.equal(status.label, 'Raid in 1m 30s at 1×');
  assert.match(status.secondary, /^Sails in /); assert.equal(status.destination, 'frontier');
  assert.match(status.description, /3 raiders arrive in 1m 30s/);
  assert.match(status.description, /Town → Watch/);
});
test('an active raid outranks simultaneous incoming/coastal warnings and cannot report calm', () => {
  const state = coastalTown(); state.frontier.raidActive = true;
  state.frontier.warning = { amount: 2, attackAt: 200 };
  const before = structuredClone(state), status = townSafety(state);
  assert.equal(status.level, 'active'); assert.equal(status.label, 'Raid underway');
  assert.match(status.secondary, /Raid in .*Sails in /);
  assert.match(status.description, /raid is underway/); assert.match(status.description, /raiders arrive/); assert.match(status.description, /Town → Watch/);
  assert.deepEqual(state, before);
});
test('hostility uses simulation relations and clears when enemies leave, die or make peace', () => {
  const state = createGame(), neighbor = state.frontier.neighbors[0];
  const unit = { faction: neighbor.id, status: 'active' }; state.frontier.units.push(unit);
  neighbor.status = 'war'; assert.equal(townSafety(state).label, 'Hostile troops on the island');
  neighbor.status = 'neutral'; assert.equal(townSafety(state).level, 'calm');
  unit.faction = 'raiders'; assert.equal(townSafety(state).level, 'active');
  for (const status of ['dead', 'released']) { unit.status = status; assert.equal(townSafety(state).level, 'calm'); }
});
