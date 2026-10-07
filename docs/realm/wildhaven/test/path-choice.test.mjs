import test from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH, setPolicy } from '../js/progression.js';
import { createGame } from '../js/sim.js';
import { nextPathResearch, pathRequirement } from '../js/path-choice.js';

test('path guidance follows unfinished prerequisite leaves through the charter', () => {
  const state = createGame();
  for (const id of ['civic_order', 'barter', 'joinery', 'logistics', 'town_charter']) {
    assert.equal(nextPathResearch(state), id);
    assert.ok(RESEARCH[id].prerequisites.every(required => state.research.completed.includes(required)));
    state.research.completed.push(id);
  }
  assert.equal(nextPathResearch(state), null);
  assert.equal(pathRequirement(state), null);
});

test('path guidance explains school construction, staffing, supply and ongoing research without mutations', () => {
  const state = createGame();
  assert.deepEqual(pathRequirement(state), { kind: 'build' });
  const school = { id: 'test-school', type: 'school', status: 'building', production: { efficiency: 0 } };
  state.buildings.push(school);
  assert.deepEqual(pathRequirement(state), { kind: 'school', buildingId: school.id, building: true });
  school.status = 'ready';
  assert.deepEqual(pathRequirement(state), { kind: 'school', buildingId: school.id, building: false });
  school.production.efficiency = 1; school.paused = true;
  assert.equal(pathRequirement(state).kind, 'school');
  school.paused = false;
  assert.deepEqual(pathRequirement(state), { kind: 'research', researchId: 'civic_order', active: false });
  state.research.active = { id: 'joinery', progress: 4, duration: 75 };
  const before = JSON.stringify(state);
  assert.deepEqual(pathRequirement(state), { kind: 'research', researchId: 'joinery', active: true });
  assert.equal(JSON.stringify(state), before);
});

test('path choice continues to use the actual charter gate and switch cost', () => {
  const state = createGame();
  assert.equal(setPolicy(state, 'forge').ok, false);
  state.research.completed.push('town_charter');
  state.resources.gold = 100; state.resources.knowledge = 50;
  assert.equal(setPolicy(state, 'forge').ok, true);
  assert.equal(state.resources.gold, 100); assert.equal(state.resources.knowledge, 50);
  assert.equal(setPolicy(state, 'breadbasket').ok, true);
  assert.equal(state.resources.gold, 40); assert.equal(state.resources.knowledge, 25);
  assert.equal(state.policies.charter, 'breadbasket');
});
