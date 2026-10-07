import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, getBuildingSpec } from '../js/catalog.js';
import { RESEARCH } from '../js/progression.js';
import { createGame, objective, villageNeeds } from '../js/sim.js';
import { buildingFacts, researchRequirements, nextTownStep, rankContracts } from '../js/clarity.js';

test('building explanations distinguish flour from food and give the real labor chain', () => {
  const mill = buildingFacts('windmill'), bread = buildingFacts('bakery');
  assert.deepEqual(mill.input.map(r => [r.id, r.amount]), [['grain', 24]]);
  assert.deepEqual(mill.output.map(r => [r.id, r.amount]), [['flour', 18]]);
  assert.equal(mill.jobs, 2); assert.match(mill.payoff, /bakery/);
  assert.deepEqual(bread.input.map(r => [r.id, r.amount]), [['flour', 18], ['wood', 4]]);
  assert.equal(bread.output[0].id, 'food'); assert.equal(bread.output[0].amount, 84);
  assert.equal(buildingFacts('farm').output[0].id, 'grain');
});

test('all catalog levels explain actual scaled recipes, staffing and capacity without edits', () => {
  const before = JSON.stringify(BUILDINGS);
  for (const type of Object.keys(BUILDINGS)) for (const level of [1, 2, 3]) {
    const facts = buildingFacts(type, level), spec = getBuildingSpec(type, level);
    assert.ok(facts.payoff.length && facts.shortFlow.length, type);
    assert.equal(facts.jobs, spec.workers, type);
    assert.deepEqual(Object.fromEntries(facts.input.map(r => [r.id, r.amount])), spec.recipe.input, type);
    assert.deepEqual(Object.fromEntries(facts.output.map(r => [r.id, r.amount])), spec.recipe.output, type);
    assert.equal(facts.housing, spec.housing, type);
    if (spec.service) assert.equal(facts.service.capacity, spec.service.capacity * spec.service.strength, type);
  }
  assert.equal(JSON.stringify(BUILDINGS), before);
});

test('research choice exposes every prerequisite instead of only the first blocker', () => {
  const state = createGame(); state.research.completed = ['cultivation'];
  assert.deepEqual(researchRequirements(state, RESEARCH.milling), [
    { id: 'cultivation', name: 'Fieldcraft', met: true },
    { id: 'joinery', name: 'Timber framing', met: false },
  ]);
  assert.deepEqual(researchRequirements(state, RESEARCH.public_health).map(r => r.id), ['civic_order', 'logistics']);
});

test('bell handoff chooses one actionable school/research step and preserves the town', () => {
  const state = createGame(), ambition = { step: 5 }, needs = villageNeeds(state);
  assert.equal(nextTownStep(state, ambition, needs), null);
  state.won = true;
  assert.equal(nextTownStep(state, ambition, needs).type, 'school');
  const school = { id: 'b9', type: 'school', status: 'building', level: 1, workerIds: [] }; state.buildings.push(school);
  assert.equal(nextTownStep(state, ambition, needs).tab, 'construction');
  school.status = 'ready'; school.production = { efficiency: 0 };
  assert.equal(nextTownStep(state, ambition, needs).buildingId, school.id);
  school.production.efficiency = 1;
  assert.equal(nextTownStep(state, ambition, needs).tab, 'council');
  state.research.active = { id: 'joinery', progress: 30 };
  const before = JSON.stringify(state), next = nextTownStep(state, ambition, needs);
  assert.equal(next.progress, 30 / RESEARCH.joinery.duration);
  assert.match(next.description, /sawmill/); assert.equal(JSON.stringify(state), before);
  state.resources.tools = 12; assert.equal(nextTownStep(state, { step: 6 }, needs), null);
});

test('trade puts deliverable active and available stocked orders first without altering offers', () => {
  const offers = [
    { id: 'future', canAccept: true, requirements: { planks: 18 } },
    { id: 'food', canAccept: true, requirements: { food: 18 } },
    { id: 'waiting', status: 'active', canComplete: false, requirements: { wood: 24 } },
    { id: 'deliver', status: 'active', canComplete: true, requirements: { food: 12 } },
  ];
  assert.deepEqual(rankContracts(offers, { planks: 0, food: 30, wood: 0 }).map(c => c.id), ['deliver', 'waiting', 'food', 'future']);
  assert.deepEqual(offers.map(c => c.id), ['future', 'food', 'waiting', 'deliver']);
});

test('next action accounts for upgraded school upkeep and paused water service', () => {
  const state = createGame(); state.won = true;
  const school = { id: 'b9', type: 'school', status: 'ready', level: 3, workerIds: [], production: { efficiency: 0 } };
  state.buildings.push(school);
  assert.match(nextTownStep(state, { step: 5 }, villageNeeds(state)).count, /3\.6 food\/min/);
  school.production.efficiency = 1; state.research.completed = ['cultivation', 'joinery', 'barter']; state.resources.food = 40;
  state.buildings.push({ id: 'b10', type: 'well', status: 'ready', level: 1, paused: true });
  assert.equal(nextTownStep(state, { step: 5 }, villageNeeds(state)).buildingId, 'b10');
  state.buildings.push({ id: 'b11', type: 'well', status: 'ready', level: 1, paused: false });
  assert.equal(nextTownStep(state, { step: 5 }, villageNeeds(state)).title, 'Welcome twenty neighbors');
});


test('tools milestone points to current stock without creating a storage action or changing goods', () => {
  const state = createGame(); state.won = true; state.resources.tools = 4;
  const before = JSON.stringify(state), step = nextTownStep(state, { step: 6 }, villageNeeds(state));
  assert.equal(step.resource, 'tools'); assert.equal(step.tab, 'stores');
  assert.equal(step.count, '4 / 12 tools in stock'); assert.match(step.description, /automatically/);
  assert.equal(step.progress, 1 / 3); assert.equal(JSON.stringify(state), before);
  state.resources.tools = 12; assert.equal(nextTownStep(state, { step: 6 }, villageNeeds(state)), null);
});
