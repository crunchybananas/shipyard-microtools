import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, objective, build, tick, pauseBuilding, BUILDINGS } from '../js/sim.js';
import { RESEARCH, progressionObjective } from '../js/progression.js';
import { objectiveChecklist, objectiveGuidance } from '../js/objective-checklist.js';

const at = (state, step) => objectiveChecklist(state, { step, complete: false });
const get = (rows, id) => { const row = rows.find(item => item.id === id); assert.ok(row, id); return row; };
const residents = (state, n) => { state.population = n; state.citizens = Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}` })); };
function add(state, type, extra = {}) {
  const building = { id: `b${state.buildings.length + 1}`, type, status: 'ready', paused: false, level: 1, workerIds: ['c1'], production: { efficiency: 1 }, ...extra };
  state.buildings.push(building); return building;
}
function fulfilledTown(charter = 'breadbasket') {
  const state = createGame(); state.won = true; residents(state, 75);
  state.buildings.find(b => b.type === 'bell').restored = true;
  for (const type of ['cottage', 'cottage', 'cottage', 'orchard', 'garden', 'lumber', 'quarry', 'school', 'well', 'market', 'clinic', 'manor']) add(state, type);
  for (const type of ['sawmill', 'smith', 'toolmaker']) add(state, type, { level: 2 });
  Object.assign(state.resources, { food: 800, tools: 12, cloth: 12, gold: 1000 });
  state.research.completed = Object.keys(RESEARCH);
  state.policies.charter = charter;
  state.contracts.completed = 6;
  state.routes.completed = 12; state.routes.reputation = { reedbank: 4, stonehaven: 4 };
  Object.assign(state.imports, { completed: 20, exportsCompleted: 12, exported: { food: 800, grain: 240, ale: 80, iron: 120, tools: 90 } });
  state.serviceCoverage = { water: .6, health: .6, community: .5 };
  state.foodPotentialBalance = 1; state.foodBalance = 1;
  state.pressure.defended = 3; state.pressure.paid = 0;
  return state;
}
const workplace = (state, type) => state.buildings.find(building => building.type === type);
function currentChapter(state, step) {
  state.milestones = Array.from({ length: step }, (_, i) => `chapter_${i}`);
  const ambition = progressionObjective(state);
  assert.equal(ambition.step, step);
  return objectiveChecklist(state, ambition);
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

test('opening cottage checklist follows actual construction and changes to food when finished', () => {
  const state = createGame();
  assert.deepEqual(objectiveChecklist(state).map(({ id, current, target, complete }) => ({ id, current, target, complete })), [{ id: 'built-cottage', current: 0, target: 1, complete: false }]);
  const result = build(state, 'cottage', -2, 2); assert.equal(result.ok, true, result.reason);
  tick(state, 3);
  const progress = objectiveChecklist(state)[0];
  assert.equal(progress.unit, '%'); assert.ok(progress.current > 0 && progress.current < 100);
  assert.equal(progress.current, result.building.progress / result.building.workRequired * 100);
  pauseBuilding(state, result.building.id, true);
  assert.match(objectiveChecklist(state)[0].detail, /paused/);
  pauseBuilding(state, result.building.id, false); tick(state, 30);
  assert.equal(objective(state).step, 1);
  assert.equal(objectiveChecklist(state)[0].id, 'built-food');
});

test('pre-bell building requirements stay separate from later staffing and population requirements', () => {
  const state = createGame();
  for (const type of ['cottage', 'cottage', 'cottage', 'orchard', 'garden', 'lumber', 'quarry']) add(state, type, { paused: true, workerIds: [], production: { efficiency: 0 } });
  assert.equal(at(state, 1)[0].complete, true);
  assert.ok(at(state, 2).every(row => row.complete));
  assert.ok(at(state, 3).every(row => row.complete));
  assert.equal(at(state, 3).some(row => row.id === 'residents'), false);
  assert.equal(objective(state).step, 4);
  assert.equal(objectiveChecklist(state)[0].current, 6);
  state.won = true;
  assert.equal(at(state, 1)[0].complete, false);
  assert.ok(at(state, 2).every(row => !row.complete));
  assert.equal(get(at(state, 3), 'residents').target, 10);
});

test('bell costs are itemized and queued restoration never asks to pay reserved materials again', () => {
  const state = createGame(); const bell = workplace(state, 'bell');
  Object.assign(state.resources, { wood: 9, stone: 25, food: 7 });
  const rows = at(state, 5);
  for (const [resource, target] of Object.entries(BUILDINGS.bell.cost)) {
    assert.equal(get(rows, `stock-${resource}`).current, state.resources[resource]);
    assert.equal(get(rows, `stock-${resource}`).target, target);
  }
  assert.equal(get(rows, 'restore-bell').complete, false);
  Object.assign(bell, { status: 'building', progress: 23, workRequired: 90 });
  const queued = at(state, 5);
  assert.equal(queued.length, 1); assert.equal(queued[0].current, 23 / 90 * 100);
  assert.equal(queued[0].unit, '%'); assert.match(queued[0].detail, /already paid/);
});

test('every chapter and specialty exposes only satisfied rows when its actual requirements are fulfilled', () => {
  for (const charter of ['breadbasket', 'forge', 'freeport']) {
    const state = fulfilledTown(charter);
    assert.equal(progressionObjective(state).complete, true);
    for (let step = 0; step <= 9; step++) {
      const rows = at(state, step);
      assert.ok(rows.length > 0, `${charter} chapter ${step}`);
      assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
      assert.ok(rows.every(row => row.complete), `${charter} chapter ${step}`);
      for (const row of rows) { assert.ok(row.label && row.unit); assert.ok(Number.isFinite(row.current) && Number.isFinite(row.target)); }
    }
  }
  const undecided = fulfilledTown(); undecided.policies.charter = null;
  assert.deepEqual(currentChapter(undecided, 9).map(row => [row.id, row.complete]), [['town-path', false]]);
});

test('each ordinary chapter blocker agrees with the authoritative selected objective', () => {
  const cases = [
    [0, 'built-cottage', s => { s.buildings = s.buildings.filter(b => b.type !== 'cottage'); }],
    [1, 'working-food', s => { workplace(s, 'orchard').workerIds = []; workplace(s, 'garden').workerIds = []; }],
    [2, 'working-lumber', s => { workplace(s, 'lumber').workerIds = []; }],
    [2, 'working-quarry', s => { workplace(s, 'quarry').production.efficiency = 0; }],
    [3, 'built-cottage', s => { s.buildings.splice(s.buildings.findIndex(b => b.type === 'cottage'), 1); }],
    [3, 'built-food', s => { workplace(s, 'garden').paused = true; }],
    [3, 'residents', s => residents(s, 9)],
    [4, 'restore-bell', s => { workplace(s, 'bell').paused = true; }],
    [5, 'residents', s => residents(s, 19)],
    [5, 'stock-food', s => { s.resources.food = 39.99; }],
    [5, 'working-school', s => { workplace(s, 'school').workerIds = []; }],
    [5, 'built-well', s => { workplace(s, 'well').paused = true; }],
    [5, 'research-count', s => { s.research.completed = ['joinery', 'barter']; }],
    [6, 'residents', s => residents(s, 39)],
    [6, 'stock-tools', s => { s.resources.tools = 11.99; }],
    [6, 'stock-cloth', s => { s.resources.cloth = 11.99; }],
    [6, 'working-market', s => { workplace(s, 'market').workerIds = []; }],
    [6, 'working-clinic', s => { workplace(s, 'clinic').production.efficiency = 0; }],
    [6, 'coverage-water', s => { s.serviceCoverage.water = .4999; }],
    [6, 'coverage-health', s => { s.serviceCoverage.health = .3999; }],
    [7, 'delivery-orders', s => { s.contracts.completed = 5; }],
    [7, 'coastal-trade', s => { s.routes.completed = 2; s.imports.exportsCompleted = 8; }],
    [7, 'stock-gold', s => { s.resources.gold = 199.99; }],
    [7, 'built-manor', s => { workplace(s, 'manor').status = 'building'; }],
    [7, 'town-path', s => { s.policies.charter = null; }],
    [8, 'residents', s => residents(s, 74)],
    [8, 'stock-food', s => { s.resources.food = 149.99; }],
    [8, 'sustainable-food', s => { s.foodPotentialBalance = -.01; }],
    [8, 'coverage-water', s => { s.serviceCoverage.water = .5999; }],
    [8, 'coverage-health', s => { s.serviceCoverage.health = .5999; }],
    [8, 'coverage-community', s => { s.serviceCoverage.community = .4999; }],
    [8, 'coastal-incidents', s => { s.pressure.defended = 2; }],
  ];
  for (const [step, id, block] of cases) {
    const state = fulfilledTown(); block(state);
    const rows = currentChapter(state, step);
    assert.equal(get(rows, id).complete, false, `chapter ${step}: ${id}`);
    assert.ok(rows.some(row => !row.complete));
  }
});

test('working service rows accept real partial work but reject no workers and blocked production', () => {
  const state = fulfilledTown(), school = workplace(state, 'school');
  school.production = { efficiency: .01, blockedReason: 'Needs food' };
  assert.equal(get(at(state, 5), 'working-school').complete, true);
  school.production.efficiency = 0;
  assert.equal(get(at(state, 5), 'working-school').complete, false);
  school.production = { blockedReason: '' };
  assert.equal(get(at(state, 5), 'working-school').complete, true, 'Same fallback as staffedService');
  school.production.blockedReason = 'Storage full';
  assert.equal(get(at(state, 5), 'working-school').complete, false);
  school.production.efficiency = 1; school.workerIds = [];
  assert.equal(get(at(state, 5), 'working-school').complete, false);
  school.workerIds = ['c1']; school.paused = true;
  assert.equal(get(at(state, 5), 'working-school').complete, false);
});

test('coastal trade and harvest alternatives never add incomplete routes together', () => {
  const state = fulfilledTown(); state.routes.completed = 2; state.imports.exportsCompleted = 8;
  let trade = get(at(state, 7), 'coastal-trade');
  assert.equal(trade.complete, false);
  assert.deepEqual(trade.alternatives.map(row => [row.current, row.target]), [[2, 3], [8, 12]]);
  state.routes.completed = 3; assert.equal(get(at(state, 7), 'coastal-trade').complete, true);
  state.routes.completed = 0; state.imports.exportsCompleted = 12;
  assert.equal(get(at(state, 7), 'coastal-trade').complete, true);
  state.imports.exported.grain = 120; state.imports.exported.ale = 40;
  assert.equal(get(at(state, 9), 'export-harvest').complete, false);
  state.imports.exported.grain = 240; assert.equal(get(at(state, 9), 'export-harvest').complete, true);
  state.imports.exported.grain = 0; state.imports.exported.ale = 80;
  assert.equal(get(at(state, 9), 'export-harvest').complete, true);
});

test('coverage compares actual supplied shares before display rounding', () => {
  const state = fulfilledTown();
  for (const value of [.5999, NaN, Infinity, undefined, -.4]) {
    state.serviceCoverage.water = value;
    const water = get(at(state, 8), 'coverage-water');
    assert.equal(water.complete, false);
    assert.ok(Number.isFinite(water.current) && water.current >= 0);
  }
  state.serviceCoverage.water = .5999;
  assert.equal(Math.round(get(at(state, 8), 'coverage-water').current), 60);
  assert.equal(get(at(state, 8), 'coverage-water').complete, false);
  state.serviceCoverage.water = .6;
  assert.equal(get(at(state, 8), 'coverage-water').complete, true);
});

test('food sustainability uses supplied potential at a full pantry and its documented fallback', () => {
  const state = fulfilledTown(); state.foodBalance = -50; state.foodPotentialBalance = 0;
  assert.equal(get(at(state, 8), 'sustainable-food').complete, true);
  state.resources.food = 100000; state.foodPotentialBalance = -.001;
  assert.equal(get(at(state, 8), 'sustainable-food').complete, false);
  delete state.foodPotentialBalance; state.foodBalance = 1;
  assert.equal(get(at(state, 8), 'sustainable-food').complete, true);
  state.foodBalance = NaN;
  assert.equal(get(at(state, 8), 'sustainable-food').complete, false);
});

test('Forge requires real defenses and upgraded open industry, but no invented staffing condition', () => {
  const state = fulfilledTown('forge');
  state.pressure.defended = 0; state.pressure.paid = 3;
  assert.equal(get(at(state, 8), 'coastal-incidents').complete, true);
  assert.equal(get(currentChapter(state, 9), 'prepared-defenses').complete, false);
  for (const b of state.buildings.filter(b => BUILDINGS[b.type]?.category === 'industry')) { b.workerIds = []; b.production.efficiency = 0; }
  assert.equal(get(at(state, 9), 'improved-industry').complete, true);
  workplace(state, 'sawmill').paused = true;
  assert.equal(get(at(state, 9), 'improved-industry').complete, false);
  workplace(state, 'sawmill').paused = false; workplace(state, 'smith').level = 1;
  assert.equal(get(at(state, 9), 'improved-industry').complete, false);
});

test('specialty export, stock and named-research blockers match authoritative final ambitions', () => {
  const cases = [
    ['breadbasket', 'export-food', s => { s.imports.exported.food = 799; }],
    ['breadbasket', 'stock-food', s => { s.resources.food = 299; }],
    ['breadbasket', 'stock-gold', s => { s.resources.gold = 599; }],
    ['breadbasket', 'research-cultivation', s => { s.research.completed = s.research.completed.filter(id => id !== 'cultivation'); }],
    ['breadbasket', 'research-milling', s => { s.research.completed = s.research.completed.filter(id => id !== 'milling'); }],
    ['forge', 'export-iron', s => { s.imports.exported.iron = 119; }],
    ['forge', 'export-tools', s => { s.imports.exported.tools = 89; }],
    ['forge', 'research-mastercraft', s => { s.research.completed = s.research.completed.filter(id => id !== 'mastercraft'); }],
    ['freeport', 'voyages', s => { s.routes.completed = 11; }],
    ['freeport', 'imported-shipments', s => { s.imports.completed = 19; s.imports.byResource.tools = 10000; }],
    ['freeport', 'trusted-harbors', s => { s.routes.reputation = { reedbank: 12, stonehaven: 3, far_sound: 3 }; }],
    ['freeport', 'stock-gold', s => { s.resources.gold = 999; }],
    ['freeport', 'research-coastal_routes', s => { s.research.completed = s.research.completed.filter(id => id !== 'coastal_routes'); }],
  ];
  for (const [charter, id, block] of cases) {
    const state = fulfilledTown(charter); block(state);
    assert.equal(get(currentChapter(state, 9), id).complete, false, `${charter} ${id}`);
  }
});

test('recorded milestones and current chapter selection survive later spending and demolition', () => {
  const state = fulfilledTown(); state.milestones = Array.from({ length: 6 }, (_, i) => `chapter_${i}`);
  state.buildings = state.buildings.filter(b => b.type !== 'cottage' && b.type !== 'school'); state.resources.food = 0;
  state.resources.tools = 1;
  assert.equal(objective(state).step, 6);
  assert.equal(get(objectiveChecklist(state), 'stock-tools').complete, false);
  assert.equal(objectiveChecklist(state).some(row => row.id === 'built-cottage' || row.id === 'working-school'), false);
  state.milestones = Array.from({ length: 10 }, (_, i) => `chapter_${i}`);
  assert.deepEqual(objectiveChecklist(state), []);
  assert.equal(objectiveGuidance(state), null);
});

test('post-bell population comes from named citizens and reads do not alter a frozen town', () => {
  const state = fulfilledTown(); state.population = 1000; residents(state, 19); state.population = 1000;
  assert.equal(get(at(state, 5), 'residents').current, 19);
  const before = JSON.stringify(state); freeze(state);
  for (let step = 0; step <= 9; step++) { objectiveChecklist(state, { step }); objectiveGuidance(state, { step }); }
  objectiveChecklist(state); objectiveGuidance(state);
  assert.equal(JSON.stringify(state), before);
});

test('short guidance supplies a reason and existing action destination without extra state', () => {
  const state = createGame(), before = JSON.stringify(state);
  const roof = objectiveGuidance(state);
  assert.equal(roof.type, 'cottage'); assert.match(roof.why, /beds/);
  for (const won of [false, true]) {
    state.won = won;
    for (let step = 0; step < (won ? 10 : 6); step++) {
      const hint = objectiveGuidance(state, { step, type: 'cottage' });
      assert.ok(hint.title && hint.why && hint.label);
      assert.ok(hint.why.length < 140);
      assert.ok(hint.type || hint.tab || hint.buildingId || hint.resource);
    }
  }
  state.won = false;
  assert.equal(JSON.stringify(state), before);
  add(state, 'cottage');
  const additional = objectiveGuidance(state, { step: 3, type: 'cottage' });
  assert.equal(additional.type, 'cottage', 'More homes requires a new plan, not inspection of the first home');
});

test('guidance resumes an accepted garden and routes sole remaining well and path requirements', () => {
  const opening = createGame(); add(opening, 'cottage');
  const garden = add(opening, 'garden', { status: 'queued', paused: true });
  assert.equal(objective(opening).step, 1);
  const food = objectiveGuidance(opening);
  assert.equal(food.buildingId, garden.id); assert.equal(food.type, undefined);
  const town = fulfilledTown();
  const well = workplace(town, 'well'); well.paused = true;
  assert.equal(objectiveGuidance(town, { step: 5 }).buildingId, well.id);
  assert.match(get(at(town, 5), 'built-well').detail, /Resume/);
  town.buildings = town.buildings.filter(b => b.id !== well.id);
  assert.equal(objectiveGuidance(town, { step: 5 }).type, 'well');
  town.policies.charter = null;
  assert.equal(objectiveGuidance(town, { step: 7 }).tab, 'council');
  const manor = workplace(town, 'manor'); manor.paused = true;
  assert.equal(objectiveGuidance(town, { step: 7 }).buildingId, manor.id);
  town.contracts.completed = 5;
  assert.equal(objectiveGuidance(town, { step: 7 }).tab, 'trade');
});

test('contextual guidance shows at most one relevant production chain while imports remain valid', () => {
  const town = fulfilledTown(); town.research.completed = ['joinery'];
  assert.deepEqual(objectiveGuidance(town, { step: 5 }).chain, ['Grain farm', 'Windmill', 'Bakery', 'Food']);
  town.resources.tools = 0;
  assert.deepEqual(objectiveGuidance(town, { step: 6 }).chain, ['Iron mine', 'Smithy', 'Toolmaker', 'Tools']);
  town.resources.tools = 12; town.resources.cloth = 0;
  const cloth = objectiveGuidance(town, { step: 6 });
  assert.equal(cloth.resource, 'cloth'); assert.match(cloth.why, /imported/);
  assert.deepEqual(cloth.chain, ['Flax field', 'Weaver', 'Cloth']);
  town.resources.cloth = 12;
  assert.equal(get(at(town, 6), 'stock-cloth').complete, true);
  assert.equal(objectiveGuidance(town, { step: 6 }).chain, undefined);
  town.policies.charter = 'breadbasket';
  assert.deepEqual(objectiveGuidance(town, { step: 9 }).chain, ['Grain farm', 'Windmill', 'Bakery', 'Food']);
});
