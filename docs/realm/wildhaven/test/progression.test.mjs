import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, JOBS, RESOURCES, RESOURCE_NAMES, getBuildingSpec, getUpgrade } from '../js/catalog.js';
import {
  RESEARCH, POLICIES, ROUTES, createProgressionState, normalizeProgression,
  researchOptions, startResearch, tickProgression, policyOptions, setPolicy,
  canUnlockBuilding, supplyModifiers, contractOptions, acceptContract,
  completeContract, routeOptions, dispatchRoute, dailyProgression, progressionObjective, defenseReadiness,
  importOptions, importGoods, exportOptions, exportGoods, IMPORTS, EXPORTS,
} from '../js/progression.js';

function village() {
  return { day: 1, resources: Object.fromEntries(RESOURCE_NAMES.map(key => [key, 200])), buildings: [], citizens: Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, job: null, workplace: null })), ...createProgressionState() };
}
function staff(state, type, workers = BUILDINGS[type].workers, extra = {}) {
  const building = { id: `${type}-${state.buildings.length}`, type, status: 'ready', level: 1, paused: false, workerIds: [], ...extra };
  for (let index = 0; index < workers; index++) {
    const id = `worker-${state.citizens.length}`;
    state.citizens.push({ id, job: BUILDINGS[type].job, workplace: building.id });
    building.workerIds.push(id);
  }
  if (type === 'barracks' && !building.production) building.production = { efficiency: workers / getBuildingSpec(type, building.level).workers };
  state.buildings.push(building); return building;
}

test('catalog has meaningful complete chains, valid workforce, and immutable shared data', () => {
  assert.equal(Object.keys(BUILDINGS).length, 25);
  assert.equal(RESOURCE_NAMES.length, 14);
  const produced = new Set();
  for (const [type, spec] of Object.entries(BUILDINGS)) {
    assert.ok(spec.work >= 0 && spec.workers >= 0, type);
    assert.ok(!spec.workers || JOBS[spec.job], `${type} job`);
    assert.equal(Object.keys(spec.cost).length, RESOURCE_NAMES.length);
    assert.ok(Object.values(spec.cost).every(value => Number.isFinite(value) && value >= 0));
    assert.ok(spec.recipe.perDay > 0);
    if (spec.unlock) assert.ok(RESEARCH[spec.unlock], `${type} unlock`);
    for (const key of Object.keys(spec.recipe.output)) produced.add(key);
    for (const key of [...Object.keys(spec.recipe.input), ...Object.keys(spec.recipe.output)]) assert.ok(RESOURCES[key]);
  }
  for (const key of RESOURCE_NAMES) assert.ok(produced.has(key), `${key} has a production source`);
  assert.equal(BUILDINGS.flaxfield.recipe.output.flax, 12);
  assert.equal(BUILDINGS.weaver.recipe.input.flax, 8);
  assert.equal(BUILDINGS.toolmaker.recipe.input.iron, 4);
  assert.throws(() => { BUILDINGS.smith.recipe.output.iron = 999; }, TypeError);
});

test('upgrades resolve complete staffing, housing and recipe changes without mutating base data', () => {
  const base = getBuildingSpec('sawmill');
  const second = getBuildingSpec('sawmill', 2), third = getBuildingSpec('sawmill', 3);
  assert.equal(second.workers, base.workers);
  assert.equal(second.recipe.output.planks, base.recipe.output.planks * 1.6);
  assert.equal(third.recipe.input.wood, base.recipe.input.wood * 2.7);
  assert.equal(getBuildingSpec('cottage', 3).housing, 10);
  assert.equal(getBuildingSpec('warehouse', 3).storage, 650);
  assert.equal(getUpgrade('sawmill', 2).requires, 'mastercraft');
  assert.equal(getUpgrade('sawmill', 3), null);
  assert.equal(getBuildingSpec('unknown'), null);
  assert.equal(BUILDINGS.sawmill.recipe.output.planks, 8);
});

test('productive upgrades improve output per worker at every level, including the one-worker garden', () => {
  for (const type of Object.keys(BUILDINGS).filter(type => Object.values(BUILDINGS[type].recipe.output).some(amount => amount > 0) && BUILDINGS[type].upgrades.length)) {
    let previous = 0;
    for (const level of [1, 2, 3]) {
      const spec = getBuildingSpec(type, level), output = Object.values(spec.recipe.output).reduce((sum, amount) => sum + amount, 0);
      const perWorker = output / spec.workers;
      assert.ok(perWorker > previous, `${type} level${level} must improve labor efficiency`); previous = perWorker;
    }
  }
  assert.equal(getBuildingSpec('garden', 3).workers, 1);
  assert.equal(getBuildingSpec('garden', 3).recipe.output.food, 14);
});

test('service upgrades provide explicit larger capacity and radius, with useful upkeep efficiency', () => {
  for (const type of ['well', 'clinic', 'chapel', 'brewery', 'barracks', 'manor']) {
    let priorCapacity = 0, priorRadius = 0;
    for (const level of [1, 2, 3]) {
      const spec = getBuildingSpec(type, level);
      assert.ok(spec.service.capacity > priorCapacity, `${type} capacity level${level}`);
      assert.ok(spec.service.radius > priorRadius, `${type} radius level${level}`);
      assert.equal(spec.service.strength, 1, 'capacity is explicit, not double-multiplied');
      priorCapacity = spec.service.capacity; priorRadius = spec.service.radius;
    }
  }
  for (const type of ['clinic', 'chapel']) {
    let prior = 0;
    for (const level of [1, 2, 3]) {
      const spec = getBuildingSpec(type, level), capacityPerUpkeep = spec.service.capacity / Object.values(spec.recipe.input).reduce((sum, value) => sum + value, 0);
      assert.ok(capacityPerUpkeep > prior, `${type} expands without proportionately expanding upkeep`); prior = capacityPerUpkeep;
    }
  }
});

test('the complete bread chain rewards its added workers, fuel and dependence on inputs', () => {
  const farm = BUILDINGS.farm, mill = BUILDINGS.windmill, bakery = BUILDINGS.bakery;
  assert.equal(farm.recipe.output.grain, mill.recipe.input.grain);
  assert.equal(mill.recipe.output.flour, bakery.recipe.input.flour);
  const workers = farm.workers + mill.workers + bakery.workers;
  const fuelWorkers = bakery.recipe.input.wood / (BUILDINGS.lumber.recipe.output.wood / BUILDINGS.lumber.workers);
  const breadPerWorker = bakery.recipe.output.food / (workers + fuelWorkers);
  const orchardWithGardenPerWorker = BUILDINGS.orchard.recipe.output.food * 1.3 / BUILDINGS.orchard.workers;
  assert.ok(breadPerWorker > orchardWithGardenPerWorker * 1.1, 'advanced chain should repay its startup and supply risks');
  assert.equal(workers, 7);
  assert.ok(bakery.recipe.input.wood > 0);
});

test('every research dependency is reachable and every locked building has a real unlock', () => {
  assert.ok(Object.keys(RESEARCH).length >= 12);
  const learned = new Set();
  for (let pass = 0; pass < 5; pass++) for (const [id, spec] of Object.entries(RESEARCH)) {
    for (const prerequisite of spec.prerequisites) assert.ok(RESEARCH[prerequisite]);
    if (spec.prerequisites.every(id => learned.has(id))) learned.add(id);
    for (const type of spec.unlocks) assert.equal(BUILDINGS[type].unlock, id);
  }
  assert.equal(learned.size, Object.keys(RESEARCH).length);
  assert.deepEqual([...new Set(Object.values(RESEARCH).map(spec => spec.tier))].sort(), [1, 2, 3]);
});

test('research charges once, requires prerequisites, and progresses only with staffed scholars', () => {
  const state = village();
  const knowledge = state.resources.knowledge;
  assert.equal(startResearch(state, 'metallurgy').ok, false);
  assert.equal(startResearch(state, 'cultivation').ok, true);
  assert.equal(state.resources.knowledge, knowledge - RESEARCH.cultivation.cost.knowledge);
  assert.equal(startResearch(state, 'cultivation').ok, false);
  assert.equal(startResearch(state, 'barter').ok, false);
  tickProgression(state, 200);
  assert.equal(state.research.active.progress, 0, 'no free scholarly work');
  const school = staff(state, 'school', 1);
  tickProgression(state, 40);
  assert.equal(state.research.active.progress, 20, 'half staffing makes half progress');
  school.paused = true; tickProgression(state, 40);
  assert.equal(state.research.active.progress, 20);
  school.paused = false; school.production = { blockedReason: 'Needs food' }; tickProgression(state, 40);
  assert.equal(state.research.active.progress, 20);
  delete school.production;
  const completion = tickProgression(state, 110);
  assert.equal(completion.completed, 'cultivation');
  assert.equal(completion.events.length, 1);
  assert.equal(state.research.active, null);
  assert.equal(researchOptions(state).find(option => option.id === 'cultivation').progress, 1);
  assert.equal(tickProgression(state, 200).events.length, 0);
  assert.equal(canUnlockBuilding(state, 'farm').ok, true);
  assert.equal(canUnlockBuilding(state, 'mine').ok, false);
  assert.equal(canUnlockBuilding(state, '__proto__').ok, false);
});

test('research rejects invalid clocks, preserves progress through restore, and applies measured rate once', () => {
  const state = village(); state.research.completed.push('civic_order');
  startResearch(state, 'joinery');
  for (const delta of [0, -1, NaN, Infinity]) tickProgression(state, delta, { researchRate: 1 });
  assert.equal(state.research.active.progress, 0);
  tickProgression(state, 10, { researchRate: 2 });
  assert.equal(state.research.active.progress, 22);
  const restored = normalizeProgression(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.research.active.progress, 22);
  assert.equal(restored.research.active.duration, 75);
});

test('actual supplied school efficiency supports partial input shortages and learned skill', () => {
  const state = village(); startResearch(state, 'joinery');
  const school = staff(state, 'school', 2);
  school.production = { efficiency: 0.4, blockedReason: 'Needs food' };
  tickProgression(state, 10);
  assert.equal(state.research.active.progress, 4);
  school.production = { efficiency: 1.15, blockedReason: '' };
  tickProgression(state, 20);
  assert.equal(state.research.active.progress, 27);
});

test('charters are exclusive, genuinely change supply effects, and charge only for switching', () => {
  const state = village();
  assert.equal(setPolicy(state, 'breadbasket').ok, false);
  state.research.completed = ['town_charter'];
  const original = { ...state.resources };
  assert.equal(setPolicy(state, 'breadbasket').ok, true);
  assert.deepEqual(state.resources, original);
  assert.equal(supplyModifiers(state, 'orchard').production, 1.25);
  assert.equal(supplyModifiers(state, 'sawmill').production, 0.9);
  assert.equal(supplyModifiers(state, 'cottage').foodConsumption, 1.05);
  assert.match(policyOptions(state).find(option => option.id === 'forge').reason, /60 coin.*25 knowledge/, 'an affordable charter change must still disclose its price');
  assert.equal(setPolicy(state, 'forge').ok, true);
  assert.equal(state.policies.charter, 'forge');
  assert.equal(state.resources.gold, original.gold - 60);
  assert.equal(state.resources.knowledge, original.knowledge - 25);
  assert.equal(supplyModifiers(state, 'sawmill').production, 1.25);
  assert.equal(supplyModifiers(state, 'cottage').arrival, -1);
  assert.equal(policyOptions(state).filter(option => option.selected).length, 1);
  const snapshot = JSON.stringify(state.resources);
  assert.equal(setPolicy(state, 'forge').ok, false);
  assert.equal(JSON.stringify(state.resources), snapshot);
  assert.equal(Object.keys(POLICIES).length, 3);
});

test('contract acceptance reserves no resources; delivery atomically spends and rewards once', () => {
  const state = village();
  const option = contractOptions(state)[0], before = { ...state.resources };
  assert.equal(acceptContract(state, option.id).ok, true);
  assert.deepEqual(state.resources, before);
  const accepted = contractOptions(state).find(contract => contract.id === option.id);
  assert.equal(accepted.deadline, state.day + accepted.duration);
  assert.equal(completeContract(state, option.id).ok, true);
  for (const key of RESOURCE_NAMES) assert.equal(state.resources[key], before[key] - (option.requirements[key] || 0) + (option.reward[key] || 0), key);
  const delivered = JSON.stringify(state.resources);
  assert.equal(completeContract(state, option.id).ok, false);
  assert.equal(JSON.stringify(state.resources), delivered);
  assert.equal(state.contracts.completed, 1);
});

test('same-day offers cannot regenerate after completion or repeated dawn processing', () => {
  const state = village();
  const offers = contractOptions(state);
  for (const option of offers) {
    assert.equal(acceptContract(state, option.id).ok, true);
    assert.equal(completeContract(state, option.id).ok, true);
  }
  assert.deepEqual(contractOptions(state), []);
  dailyProgression(state);
  assert.deepEqual(contractOptions(state), []);
  dailyProgression(state);
  assert.equal(state.contracts.completed, 3);
  state.day++;
  dailyProgression(state);
  assert.equal(contractOptions(state).length, 3);
});

test('contract deadlines are visible, inclusive, deterministic and harmless to stored supplies', () => {
  const state = village(); dailyProgression(state);
  const option = contractOptions(state)[0]; acceptContract(state, option.id);
  const deadline = state.contracts.active[0].deadline;
  state.day = deadline; dailyProgression(state);
  assert.equal(state.contracts.active.length, 1);
  const supplies = { ...state.resources };
  state.day++; const result = dailyProgression(state);
  assert.equal(state.contracts.active.length, 0);
  assert.equal(state.contracts.failed, 1);
  assert.ok(result.events.some(event => event.text.includes('No supplies were taken')));
  assert.deepEqual(state.resources, supplies);
  assert.equal(dailyProgression(state).events.length, 0);
  assert.equal(state.contracts.failed, 1);
});

test('routes require real staffing and cargo, return on their public date, and reward only once', () => {
  const state = village(); state.research.completed = ['coastal_routes'];
  state.routes.reputation.reedbank = 2;
  assert.equal(dispatchRoute(state, 'reedbank').ok, false, 'a researched map cannot staff a market');
  const market = staff(state, 'market', 1);
  market.paused = true; assert.equal(dispatchRoute(state, 'reedbank').ok, false);
  market.paused = false;
  const before = { ...state.resources };
  const option = routeOptions(state).find(route => route.id === 'reedbank');
  assert.equal(dispatchRoute(state, 'reedbank').ok, true);
  assert.equal(state.resources.food, before.food - option.cargo.food);
  assert.equal(dispatchRoute(state, 'reedbank').ok, false);
  const voyage = state.routes.active[0];
  state.day = voyage.returnDay - 1; dailyProgression(state);
  assert.equal(state.routes.completed, 0);
  state.day++; dailyProgression(state);
  assert.equal(state.routes.completed, 1);
  assert.equal(state.resources.gold, before.gold + option.reward.gold);
  const delivered = JSON.stringify(state.resources);
  dailyProgression(state); assert.equal(JSON.stringify(state.resources), delivered);
});

test('distant routes need staffed guards, and departure terms survive a charter change and save', () => {
  const state = village(); state.research.completed = ['navigation', 'town_charter'];
  state.routes.reputation.lantern_isles = 4;
  staff(state, 'market', 1);
  assert.equal(dispatchRoute(state, 'lantern_isles').ok, false);
  const watch = staff(state, 'barracks', 4, { level: 2 });
  watch.paused = true; assert.equal(dispatchRoute(state, 'lantern_isles').ok, false);
  watch.paused = false;
  setPolicy(state, 'freeport');
  const expected = routeOptions(state).find(route => route.id === 'lantern_isles').reward;
  assert.equal(dispatchRoute(state, 'lantern_isles').ok, true);
  const restored = normalizeProgression(JSON.parse(JSON.stringify(state)));
  setPolicy(restored, 'forge');
  const before = restored.resources.gold;
  restored.day = restored.routes.active[0].returnDay; dailyProgression(restored);
  assert.equal(restored.resources.gold, before + expected.gold);
  assert.equal(restored.routes.completed, 1);
  assert.equal(Object.keys(ROUTES).length, 4);
});

test('delivery choices build the named harbor relationship needed for profitable voyages', () => {
  const state = village(); state.research.completed = ['coastal_routes']; staff(state, 'market', 1);
  assert.equal(routeOptions(state).find(route => route.id === 'reedbank').canDispatch, false);
  const deliveries = contractOptions(state).filter(order => order.partnerId === 'reedbank');
  assert.equal(deliveries.length, 2);
  for (const order of deliveries) {
    assert.ok(order.description.includes('trust with Reedbank'));
    acceptContract(state, order.id); completeContract(state, order.id);
  }
  assert.equal(state.routes.reputation.reedbank, 2);
  assert.equal(state.routes.reputation.stonehaven, 0, 'other harbors do not get free trust');
  const route = routeOptions(state).find(route => route.id === 'reedbank');
  assert.equal(route.canDispatch, true);
  assert.equal(route.reward.gold, Math.round(ROUTES.reedbank.reward.gold * 1.1 * 1.04));
  dispatchRoute(state, 'reedbank');
  state.policies.charter = 'freeport';
  assert.equal(routeOptions(state).find(route => route.id === 'reedbank').reward.gold, route.reward.gold, 'an active route displays its locked departure terms');
  state.day = state.routes.active[0].returnDay; dailyProgression(state);
  assert.equal(state.routes.reputation.reedbank, 3);
  assert.equal(normalizeProgression(JSON.parse(JSON.stringify(state))).routes.reputation.reedbank, 3);
});

test('watch research changes actual escort readiness and distant dispatch eligibility', () => {
  const state = village(); staff(state, 'market', 1);
  staff(state, 'barracks', 3); staff(state, 'barracks', 3); staff(state, 'barracks', 1);
  assert.equal(defenseReadiness(state), 7);
  state.research.completed = ['watchkeeping', 'navigation'];
  state.routes.reputation.far_sound = 6;
  assert.equal(defenseReadiness(state), 9.2575);
  const route = routeOptions(state).find(route => route.id === 'far_sound');
  assert.equal(route.guards, 7);
  assert.equal(route.requiredReadiness, 8);
  assert.equal(route.canDispatch, true);
  state.buildings.find(building => building.type === 'barracks').paused = true;
  assert.equal(routeOptions(state).find(route => route.id === 'far_sound').canDispatch, false);
});

test('escorts use actual supplied fractional readiness and learned skill, never a token meal for a full watch', () => {
  const state = village(); state.research.completed = ['navigation']; state.routes.reputation.lantern_isles = 4;
  staff(state, 'market', 1);
  const first = staff(state, 'barracks', 3), second = staff(state, 'barracks', 3);
  first.production.efficiency = .1; second.production.efficiency = .1;
  const hungry = routeOptions(state).find(route => route.id === 'lantern_isles');
  assert.equal(hungry.guardCount, 6); assert.equal(hungry.escortReadiness, .69); assert.equal(hungry.canDispatch, false);
  first.production.efficiency = 1;
  assert.equal(routeOptions(state).find(route => route.id === 'lantern_isles').canDispatch, false);
  first.production.efficiency = 1.2;
  assert.equal(routeOptions(state).find(route => route.id === 'lantern_isles').canDispatch, true, 'actual practiced labor may cover the remaining readiness');
  delete first.production;
  assert.equal(routeOptions(state).find(route => route.id === 'lantern_isles').canDispatch, false, 'missing authoritative supply cache creates no guards');
});

test('normalization rejects unknown records and restores canonical costs, rewards and dates', () => {
  const state = village();
  const option = contractOptions(state)[0]; acceptContract(state, option.id);
  state.contracts.active[0].deadline = 10000;
  state.contracts.active[0].reward = { gold: 100000 };
  state.research.completed = ['cultivation', 'cultivation', '__proto__', 'unknown'];
  state.research.active = { id: '__proto__', progress: 100 };
  state.routes.active = [{ id: 'voyage-1', routeId: '__proto__', departedDay: 1 }];
  state.policies.charter = '__proto__';
  normalizeProgression(state);
  assert.deepEqual(state.research.completed, ['cultivation']);
  assert.equal(state.research.active, null);
  assert.equal(state.routes.active.length, 0);
  assert.equal(state.policies.charter, null);
  const clean = contractOptions(state).find(contract => contract.id === option.id);
  assert.equal(clean.deadline, 1 + option.duration);
  assert.deepEqual(clean.reward, option.reward);
});

test('reading progression preserves large legacy stocks; physical rewards respect current storage', () => {
  const state = village(); state.resources.wood = 200000;
  researchOptions(state); policyOptions(state); contractOptions(state); routeOptions(state);
  assert.equal(state.resources.wood, 200000, 'a UI read cannot truncate stored supplies');
  state.research.completed = ['coastal_routes']; staff(state, 'market', 1);
  state.routes.reputation.stonehaven = 2;
  state.storage = { stone: 210 };
  assert.equal(dispatchRoute(state, 'stonehaven').ok, true);
  state.day = state.routes.active[0].returnDay;
  const result = dailyProgression(state);
  assert.equal(state.resources.stone, 210);
  assert.ok(result.events.some(event => event.text.includes('20 stone could not be unloaded')));
  state.day++; dailyProgression(state);
  state.resources.stone = 250;
  assert.equal(dispatchRoute(state, 'stonehaven').ok, true);
  state.day = state.routes.active[0].returnDay; dailyProgression(state);
  assert.equal(state.resources.stone, 250, 'legacy overflow is preserved');
});

test('the restored bell starts a longer series of ambitions, and recorded chapters do not regress', () => {
  const state = village();
  for (let index = 0; index < 3; index++) staff(state, 'cottage', 0);
  staff(state, 'orchard', 2); staff(state, 'garden', 1); staff(state, 'lumber', 2); staff(state, 'quarry', 2);
  staff(state, 'bell', 0, { restored: true });
  const objective = progressionObjective(state);
  assert.equal(objective.step, 5);
  assert.equal(objective.complete, false);
  assert.ok(objective.description.includes('twenty people'));
  dailyProgression(state);
  assert.ok(state.milestones.includes('chapter_4'));
  state.buildings = state.buildings.filter(building => !['cottage', 'garden', 'orchard'].includes(building.type));
  assert.equal(progressionObjective(state).step, 5, 'completed early chapters remain recorded');
});

test('harbor imports cost real coin, need a working market, and retain their daily quota through reload', () => {
  const state = village(), original = { ...state.resources };
  assert.equal(importGoods(state, 'import_tools').ok, false);
  state.research.completed = ['barter'];
  assert.equal(importGoods(state, 'import_tools').ok, false);
  const market = staff(state, 'market', 1); market.production = { efficiency: 0.5 };
  assert.equal(importGoods(state, 'import_tools').ok, true);
  assert.equal(state.resources.gold, original.gold - 28); assert.equal(state.resources.tools, original.tools + 4);
  assert.equal(importGoods(state, 'import_tools').ok, true);
  const restored = normalizeProgression(JSON.parse(JSON.stringify(state)));
  assert.equal(importOptions(restored).find(option => option.id === 'import_tools').remaining, 0);
  const beforeFailure = { ...restored.resources };
  assert.equal(importGoods(restored, 'import_tools').ok, false); assert.deepEqual(restored.resources, beforeFailure);
  restored.day++;
  assert.equal(importOptions(restored).find(option => option.id === 'import_tools').remaining, 2);
  assert.equal(importGoods(restored, 'import_tools').ok, true);
  assert.equal(restored.imports.byResource.tools, 12);
  assert.equal(restored.research.completed.includes('metallurgy'), false, 'tools do not force the metal branch');
});

test('full storage rejects an import before charging, and rounding never creates negative coin', () => {
  const state = village(); state.research.completed = ['barter']; staff(state, 'market', 1);
  state.storage = { tools: state.resources.tools + 3 };
  assert.equal(importGoods(state, 'import_tools').ok, false); assert.equal(state.resources.gold, 200);
  state.storage.tools++;
  state.resources.gold = 27.999999;
  assert.equal(importGoods(state, 'import_tools').ok, true);
  assert.equal(state.resources.gold, 0); assert.equal(state.resources.tools, state.storage.tools);
});

test('exports finance specialty imports and Free Port quotes cannot create a buy-resell profit loop', () => {
  const state = village(); state.research.completed = Object.keys(RESEARCH); state.policies.charter = 'freeport'; staff(state, 'market', 1);
  const before = { ...state.resources }, quote = exportOptions(state).find(option => option.id === 'export_food');
  assert.equal(exportGoods(state, quote.id).ok, true);
  assert.equal(state.resources.food, before.food - quote.cost.food); assert.equal(state.resources.gold, before.gold + quote.reward.gold);
  assert.equal(state.imports.exported.food, 40); assert.equal(state.imports.exportsCompleted, 1);
  assert.equal(importOptions(state)[0].dailyLimit, 3);
  for (const [id, buy] of Object.entries(IMPORTS)) {
    const sellId = `export_${buy.resource}`, sell = EXPORTS[sellId];
    const buyQuote = importOptions(state).find(option => option.id === id), sellQuote = exportOptions(state).find(option => option.id === sellId);
    assert.ok(buyQuote.cost.gold / buy.quantity > sellQuote.reward.gold / sell.quantity, `${buy.resource} round-trip must lose coin even with every trade bonus`);
  }
  state.policies.charter = 'breadbasket';
  const tools = importOptions(state).find(option => option.id === 'import_tools');
  assert.equal(tools.cost.gold, 28); assert.equal(tools.dailyLimit, 2);
});

test('Free Port and Breadbasket final ambitions can finish without local metal or textile chains', () => {
  const state = village(); state.milestones = Array.from({ length: 9 }, (_, index) => `chapter_${index}`);
  state.policies.charter = 'freeport'; state.research.completed = ['barter', 'logistics', 'coastal_routes'];
  state.routes.completed = 12; state.routes.reputation = { reedbank: 4, stonehaven: 4 }; state.resources.gold = 1000; state.imports.completed = 20;
  assert.equal(progressionObjective(state).complete, true);
  assert.equal(state.buildings.length, 0, 'isolated objective fixture has no forced industrial buildings');
  state.policies.charter = 'breadbasket'; state.research.completed = ['cultivation', 'milling'];
  state.imports.exported = { food: 800, grain: 240 }; state.resources.food = 300; state.resources.gold = 600;
  assert.equal(progressionObjective(state).complete, true);
  state.imports.exported.grain = 0; state.imports.exported.ale = 80;
  assert.equal(progressionObjective(state).complete, true, 'grain and ale are alternative specialties');
  state.imports.exported.food = 760;
  assert.equal(progressionObjective(state).specialty, 'breadbasket'); assert.equal(progressionObjective(state).complete, false);
});

test('the large-town ambition requires actual coverage and sustainable staffing, allowing paid coastal peace', () => {
  const state = village(); state.milestones = Array.from({ length: 8 }, (_, index) => `chapter_${index}`);
  state.citizens = Array.from({ length: 75 }, (_, index) => ({ id: `person-${index}` })); state.resources.food = 300;
  state.serviceCoverage = { water: .6, health: .6, community: .5 }; state.pressure = { paid: 3, defended: 0 };
  state.foodBalance = -60; state.foodPotentialBalance = -60;
  assert.equal(progressionObjective(state).step, 8, 'a stockpile alone cannot pretend idle farms are sustainable');
  state.foodPotentialBalance = 10;
  assert.equal(progressionObjective(state).step, 9, 'full pantry throttling does not penalize sufficient staffed food capacity');
  state.serviceCoverage.health = .59;
  assert.equal(progressionObjective(state).step, 8);
});
