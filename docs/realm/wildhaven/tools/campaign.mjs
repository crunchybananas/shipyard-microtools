/** Earned-resource balance run. No stock, population, research, or building fixture injection. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as sim from '../js/sim.js';
import { BUILDINGS, RESOURCE_NAMES, getBuildingSpec } from '../js/catalog.js';
import * as progression from '../js/progression.js';
import { createSlowStaffingPolicy } from './slow-staffing.mjs';

const MAX_DAYS = Number(process.env.WILDHAVEN_CAMPAIGN_DAYS || 180);
const STRATEGY = process.env.WILDHAVEN_CAMPAIGN_STRATEGY || 'breadbasket';
const SLOW_STAFFING = process.env.WILDHAVEN_CAMPAIGN_SLOW_STAFFING === '1';
if (!['breadbasket', 'freeport', 'forge'].includes(STRATEGY)) throw new Error('Unknown campaign strategy');
const omittedBuildings = new Set(STRATEGY === 'freeport' ? ['mine', 'smith', 'toolmaker', 'flaxfield', 'weaver', 'brewery'] : STRATEGY === 'forge' ? ['farm', 'windmill', 'bakery', 'flaxfield', 'weaver', 'brewery'] : []);
const OUTPUT_PREFIX = process.env.WILDHAVEN_CAMPAIGN_PREFIX || 'campaign-pressure';
if (!/^[a-z][a-z0-9-]{0,60}$/.test(OUTPUT_PREFIX)) throw new Error('Invalid campaign output prefix');
const output = new URL('../review/', import.meta.url);
await mkdir(output, { recursive: true });
const sourcePaths = ['js/sim.js', 'js/island.js', 'js/frontier.js', 'js/catalog.js', 'js/progression.js', 'js/pressure.js', 'tools/campaign.mjs'];
if (SLOW_STAFFING) sourcePaths.push('tools/slow-staffing.mjs', 'tools/slow-campaign.mjs');
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async name => [name, createHash('sha256').update(await readFile(new URL(`../${name}`, import.meta.url))).digest('hex')])));
const report = { startedAt: new Date().toISOString(), strategy: STRATEGY, omittedBuildings: [...omittedBuildings], scope: 'Deterministic automated management using public simulation/progression actions from createGame. All resources, citizens, research and buildings are earned; no funded or unlocked fixtures. Simulated duration does not establish enjoyable human playtime or live renderer behavior.', sourceHashesAtStart: await hashes(), actions: [], staffingChanges: 0, milestones: {}, daily: [], errors: [], checkpointsReloaded: 0 };
let state = sim.createGame(), lastDay = state.day, lastMacroTime = 0, longestMacroGap = 0;
const tiles = sim.listTiles().filter(tile => tile.buildable);
const researchOrder = STRATEGY === 'freeport' ? ['joinery', 'cultivation', 'barter', 'civic_order', 'milling', 'logistics', 'coastal_routes', 'public_health', 'town_charter'] : STRATEGY === 'forge' ? ['joinery', 'cultivation', 'barter', 'civic_order', 'metallurgy', 'logistics', 'watchkeeping', 'textiles', 'public_health', 'mastercraft', 'town_charter'] : ['joinery', 'cultivation', 'barter', 'milling', 'textiles', 'metallurgy', 'logistics', 'civic_order', 'coastal_routes', 'public_health', 'watchkeeping', 'brewing', 'mastercraft', 'town_charter', 'navigation'];
const priorities = { hearth: 0, orchard: 1, garden: 1, farm: 2, windmill: 3, bakery: 4, lumber: 5, quarry: 6, sawmill: 7, school: 8, flaxfield: 9, weaver: 10, mine: 11, smith: 12, toolmaker: 13, brewery: 14, market: 15, clinic: 16, chapel: 17, manor: 18, barracks: 19 };
if (SLOW_STAFFING) report.staffingPolicy = { intervalSeconds: 30, scope: 'One global manual setWorkers, setBuilderTarget, or setPriority mutation per interval; automatic assignment, arrivals and construction completions are simulation behavior.', lowerStockFraction: .65, timberStopBelow: 35, timberResumeAt: 70, actions: [] };
const manageSlowWorkers = createSlowStaffingPolicy({ priorities, researchOrder, resourceTargets, log: action => { report.staffingChanges++; report.staffingPolicy.actions.push(action); } });
const count = type => state.buildings.filter(b => b.type === type).length;
const ready = type => state.buildings.filter(b => b.type === type && b.status === 'ready');
function record(type, detail) { longestMacroGap = Math.max(longestMacroGap, state.elapsed - lastMacroTime); lastMacroTime = state.elapsed; report.actions.push({ time: state.elapsed, day: state.day, type, ...detail }); }
function resourceTargets() {
  return { wood: 140, stone: 130, food: Math.min(sim.storageCapacity(state).food - 5, Math.max(state.policies.charter === 'breadbasket' ? 360 : 75, state.population * 2.5 + 40)), grain: 90, flour: 65, planks: 115, ore: 90, iron: 80, tools: 80, flax: 65, cloth: 85, ale: 70, gold: 1600, knowledge: 200 };
}
function manageWorkers() {
  if (SLOW_STAFFING) return manageSlowWorkers(state);
  const target = state.population >= 20 ? 4 : state.population >= 10 ? 3 : 2;
  if (state.builderTarget !== target) { sim.setBuilderTarget(state, target); report.staffingChanges++; }
  const stock = resourceTargets();
  for (const b of state.buildings) {
    const spec = getBuildingSpec(b.type, b.level), desiredPriority = STRATEGY === 'forge' && b.type === 'barracks' && state.pressure.active ? 5 : priorities[b.type] ?? 20;
    if (b.priority !== desiredPriority) sim.setPriority(state, b.id, desiredPriority);
    if (!spec.workers) continue;
    const outputs = Object.keys(spec.recipe.output);
    let desired = spec.workers;
    if (!['school', 'market'].includes(b.type) && outputs.length && outputs.every(key => state.resources[key] >= stock[key])) desired = 0;
    if (Object.entries(spec.recipe.input).some(([key]) => state.resources[key] < .05)) desired = 0;
    if (b.type === 'school' && researchOrder.every(id => state.research.completed.includes(id))) desired = 0;
    if (b.type === 'market') desired = state.resources.food < Math.max(35, state.population * 1.2) ? 0 : (state.resources.gold > 1600 ? 1 : spec.workers);
    if (spec.recipe.input.wood && state.resources.wood < 35 && !(b.type === 'bakery' && state.resources.food < state.population * 1.3 + 20)) desired = 0;
    if (b.type === 'hearth' && state.population > 20 && state.resources.food > state.population * 1.5 && state.resources.wood > 100 && state.resources.stone > 80) desired = 0;
    if (STRATEGY === 'forge' && b.type === 'barracks' && !state.pressure.active) desired = 0;
    if (b.desiredWorkers !== desired) { sim.setWorkers(state, b.id, desired); report.staffingChanges++; }
  }
}
function siteScore(type, tile) {
  const [x, z] = ['lumber'].includes(type) ? [-5, -2] : ['quarry', 'mine'].includes(type) ? [6, -4] : ['orchard', 'garden', 'farm', 'windmill', 'bakery', 'flaxfield'].includes(type) ? [3, 2] : ['cottage', 'well', 'clinic', 'chapel', 'brewery'].includes(type) ? [-3, 2] : [1, -2];
  return Math.hypot(tile.x - x, tile.z - z) + (tile.kind === 'forest' && !['lumber'].includes(type) ? 3 : 0) + (tile.kind === 'rock' && !['quarry', 'mine'].includes(type) ? 3 : 0);
}
function canPay(cost, reserves = {}) { return Object.entries(cost).every(([key, value]) => state.resources[key] >= value + (reserves[key] || 0)); }
function tryBuild(type, reserves = {}) {
  if (omittedBuildings.has(type)) return false;
  if (!progression.canUnlockBuilding(state, type).ok || !canPay(BUILDINGS[type].cost, reserves)) return false;
  const service = getBuildingSpec(type).service, access = service ? sim.villageNeeds(state).homes : null;
  const kind = ['faith', 'leisure'].includes(service?.kind) ? 'community' : service?.kind;
  const score = tile => service ? siteScore(type, tile) * .1 - access.reduce((sum, home) => sum + (Math.hypot(home.x - tile.x, home.z - tile.z) <= service.radius ? home.beds * (1 - home.coverage[kind]) : 0), 0) : siteScore(type, tile);
  const ordered = type === 'bell' ? [{ x: 0, z: -5 }] : [...tiles].filter(t => !sim.getBuildingAt(state, t.x, t.z)).sort((a, b) => score(a) - score(b));
  let site;
  for (const candidate of ordered) {
    const rotations = [0, 1, 2, 3].sort((a, b) => {
      const left = sim.buildingEntrance({ ...candidate, rotation: a }), right = sim.buildingEntrance({ ...candidate, rotation: b });
      return Math.abs(left.x) - Math.abs(right.x);
    });
    const rotation = rotations.find(value => sim.canBuild(state, type, candidate.x, candidate.z, value).ok);
    if (rotation !== undefined) { site = { ...candidate, rotation }; break; }
  }
  if (!site) return false;
  const result = sim.build(state, type, site.x, site.z, site.rotation);
  if (!result.ok) return false;
  record('build', { building: type, id: result.building.id, x: site.x, z: site.z, rotation: site.rotation }); return true;
}
function buildingPlans() {
  if (sim.constructionQueue(state).length >= 3) return;
  const population = state.population, stock = resourceTargets(), beds = sim.rates(state).capacity;
  const pendingBeds = state.buildings.filter(b => b.status !== 'ready' && b.constructionKind === 'build').reduce((sum, b) => sum + getBuildingSpec(b.type).housing, 0);
  if (!count('cottage') && tryBuild('cottage')) return;
  if (!count('orchard') && tryBuild('orchard')) return;
  if (!count('lumber') && tryBuild('lumber')) return;
  if (!count('quarry') && tryBuild('quarry')) return;
  if (!count('garden') && tryBuild('garden')) return;
  if (count('cottage') < 3 && tryBuild('cottage')) return;
  if (!state.won) { if (sim.canBuild(state, 'bell', 0, -5).ok) tryBuild('bell'); return; }
  const access = sim.villageNeeds(state).services;
  // Spend earned capital on denser civic services when actual access blocks further growth.
  for (const [threshold, kind, target, type] of [[20, 'water', population >= 75 ? .6 : .5, 'well'], [40, 'health', population >= 75 ? .6 : .4, 'clinic'], [60, 'community', population >= 75 ? .5 : .35, 'chapel']]) {
    if (population < threshold || access[kind].coverage + 1e-6 >= target || state.buildings.some(b => b.type === type && b.status !== 'ready')) continue;
    const candidate = ready(type).find(b => b.level < 3 && (!getBuildingSpec(type, b.level).workers || b.production.efficiency > 0));
    if (candidate) {
      const offer = sim.canUpgrade(state, candidate.id);
      if (offer.ok) { const result = sim.queueUpgrade(state, candidate.id); if (result.ok) { record('upgrade', { id: candidate.id, building: type, level: offer.targetLevel, purpose: `${kind} access` }); return; } }
    } else if ((!ready(type).length || ready(type).every(b => b.level === 3 && b.production.efficiency > 0)) && tryBuild(type)) return;
  }
  if (population < 75 && beds + pendingBeds < population + 7 && tryBuild('cottage')) return;
  if (!count('school') && tryBuild('school')) return;
  if (population >= 10 && count('lumber') < 2 && tryBuild('lumber', { wood: 16 })) return;
  if (population >= 12 && count('quarry') < 2 && tryBuild('quarry', { wood: 16 })) return;
  const foodPlaces = count('orchard') + count('garden'), neededFood = Math.min(7, Math.ceil(population / 11) + 1);
  if (foodPlaces < neededFood && (state.resources.food < stock.food * .7 || population > 15) && tryBuild('orchard', { wood: 16 })) return;
  const plans = [
    ['sawmill', 1, 10], ['farm', 1, 12], ['windmill', 1, 14], ['bakery', 1, 14], ['market', 1, 16], ['flaxfield', 1, 18], ['weaver', 1, 18],
    ['mine', 1, 20], ['smith', 1, 20], ['toolmaker', 1, 20], ['warehouse', 1, 20], ['school', 2, 22], ['well', 1, 12],
    ['farm', 2, 30], ['sawmill', 2, 30], ['flaxfield', 2, 32], ['weaver', 2, 32], ['mine', 2, 34], ['smith', 2, 34], ['toolmaker', 2, 34], ['school', 3, 38],
    ['clinic', 1, 32], ['barracks', 2, 40], ['brewery', 1, 38], ['chapel', 1, 40], ['well', 2, 40], ['market', 2, 40], ['manor', 1, 45],
    ['clinic', 2, 60], ['barracks', 4, 65], ['warehouse', 2, 55],
  ];
  if (['freeport', 'forge'].includes(STRATEGY)) plans.push(['chapel', 2, 55]);
  if (STRATEGY === 'forge') plans.push(['barracks', 3, 50]);
  for (const [type, target, minPopulation] of plans) if (population >= minPopulation && count(type) < target && tryBuild(type, { wood: population < 30 ? 16 : 0 })) return;
}
function tradeAndResearch() {
  const foodReserve = Math.max(state.policies.charter === 'breadbasket' ? 320 : 35, state.population * 1.3);
  if (state.won && state.resources.wood < 50 && state.resources.food > foodReserve + 12 && sim.tradeOffer(state, 'wood').ok) { const offer = sim.trade(state, 'wood'); if (offer.ok) record('landing-exchange', { resource: 'wood', cost: offer.cost, amount: offer.amount }); }
  for (const offer of progression.contractOptions(state)) {
    if (STRATEGY === 'freeport' && Object.keys(offer.requirements).some(key => ['cloth', 'iron', 'tools'].includes(key))) continue;
    if (STRATEGY === 'forge' && offer.requirements.cloth) continue;
    const adequate = Object.entries(offer.requirements).every(([key, value]) => state.resources[key] - value >= (key === 'food' ? foodReserve : key === 'wood' && !state.won ? 50 : key === 'stone' && !state.won ? 60 : key === 'tools' ? 15 : 12));
    if (!adequate) continue;
    if (offer.canAccept) { const result = progression.acceptContract(state, offer.id); if (result.ok) record('accept-contract', { id: offer.id, title: offer.title }); }
    const active = progression.contractOptions(state).find(o => o.id === offer.id);
    if (active?.canComplete) { const result = progression.completeContract(state, offer.id); if (result.ok) record('deliver-contract', { id: offer.id, title: offer.title, reward: result.reward }); }
  }
  if (!state.research.active) for (const id of researchOrder) {
    const option = progression.researchOptions(state).find(o => o.id === id);
    if (option?.canStart) { const result = progression.startResearch(state, id); if (result.ok) record('research', { id }); break; }
  }
  if (!state.policies.charter && progression.policyOptions(state).find(p => p.id === STRATEGY)?.canSelect) { const result = progression.setPolicy(state, STRATEGY); if (result.ok) record('charter', { id: STRATEGY }); }
  if (state.policies.charter === 'breadbasket') for (const [id, resource, goal, reserve] of [['export_food', 'food', 800, 200], ['export_grain', 'grain', 240, 45]]) {
    const option = progression.exportOptions(state).find(o => o.id === id);
    if ((state.imports.exported[resource] || 0) < goal && option?.canExport && canPay(option.cost, { [resource]: reserve })) {
      const result = progression.exportGoods(state, id); if (result.ok) record('harbor-export', { id, cost: result.cost, reward: result.reward });
    }
  }
  if (STRATEGY === 'freeport') {
    for (const [id, resource, reserve] of [['export_food', 'food', Math.max(80, state.population * 1.8)], ['export_grain', 'grain', 45], ['export_planks', 'planks', 60]]) {
      const option = progression.exportOptions(state).find(o => o.id === id);
      if (state.resources.gold < 1500 && option?.canExport && canPay(option.cost, { [resource]: reserve })) {
        const result = progression.exportGoods(state, id); if (result.ok) record('harbor-export', { id, cost: result.cost, reward: result.reward });
      }
    }
    for (const [id, resource, target] of [['import_cloth', 'cloth', 30], ['import_tools', 'tools', 40], ['import_iron', 'iron', state.research.completed.includes('town_charter') ? 20 : 8]]) {
      const option = progression.importOptions(state).find(o => o.id === id);
      if (state.resources[resource] < target && option?.canImport && canPay(option.cost, { gold: 30 })) {
        const result = progression.importGoods(state, id); if (result.ok) record('harbor-import', { id, cost: result.cost, reward: result.reward });
      }
    }
  }
  if (STRATEGY === 'forge') {
    for (const [id, resource, goal, reserve] of [['export_iron', 'iron', 120, 30], ['export_tools', 'tools', 90, 25]]) {
      const option = progression.exportOptions(state).find(o => o.id === id);
      if (((state.imports.exported[resource] || 0) < goal || state.resources.gold < 1200) && option?.canExport && canPay(option.cost, { [resource]: reserve })) {
        const result = progression.exportGoods(state, id); if (result.ok) record('harbor-export', { id, cost: result.cost, reward: result.reward });
      }
    }
    for (const [id, resource, target] of [['import_cloth', 'cloth', 30], ['import_food', 'food', Math.max(100, state.population * 1.5)]]) {
      const option = progression.importOptions(state).find(o => o.id === id);
      if (state.resources[resource] < target && option?.canImport && canPay(option.cost, { gold: 40 })) {
        const result = progression.importGoods(state, id); if (result.ok) record('harbor-import', { id, cost: result.cost, reward: result.reward });
      }
    }
  }
  for (const route of progression.routeOptions(state)) if (route.canDispatch && canPay(route.cargo, { food: foodReserve, tools: 12, planks: 20, cloth: 10 })) {
    const result = progression.dispatchRoute(state, route.id); if (result.ok) record('route', { id: route.id, returnDay: result.voyage.returnDay });
  }
}
function upgrades() {
  if (sim.constructionQueue(state).length >= 2 || state.population < 20) return;
  if (state.research.completed.includes('town_charter') && !count('manor')) return;
  if (count('lumber') < 2 || count('quarry') < 2) return;
  const order = STRATEGY === 'forge' ? ['lumber', 'quarry', 'sawmill', 'smith', 'toolmaker', 'orchard', 'cottage', 'school', 'mine', 'warehouse', 'barracks'] : ['cottage', 'sawmill', 'toolmaker', 'orchard', 'school', 'mine', 'smith', 'weaver', 'warehouse', 'bakery', 'windmill', 'farm', 'barracks'];
  for (const type of order) {
    if (type === 'cottage' && sim.rates(state).capacity >= 85) continue;
    const candidate = ready(type).filter(b => b.level < 3).sort((a, b) => a.level - b.level)[0]; if (!candidate) continue;
    const offer = sim.canUpgrade(state, candidate.id);
    if (offer.ok && canPay(offer.cost, { wood: 30, stone: 25, planks: type === 'cottage' && state.stats.upgrades === 0 ? 8 : 25, tools: type === 'cottage' && state.stats.upgrades === 0 ? 0 : 12, cloth: type === 'cottage' && state.stats.upgrades === 0 ? 0 : 12, gold: 25, knowledge: 0 })) {
      const result = sim.queueUpgrade(state, candidate.id); if (result.ok) record('upgrade', { id: candidate.id, building: type, level: offer.targetLevel }); return;
    }
  }
}
function coastalDecisions() {
  const active = sim.pressureOptions(state).active; if (!active) return;
  let action = null;
  if (active.canDefend) action = 'defend';
  else if (active.daysLeft <= 1 && active.readiness < active.requiredReadiness && active.canPay) action = 'pay';
  else if (active.daysLeft <= .5 && active.readiness < active.requiredReadiness && active.canShelter) action = 'shelter';
  if (action) { const result = sim.actOnPressure(state, action); if (result.ok) record('coastal-choice', { id: active.id, title: active.title, action, reason: result.reason }); }
}
function summary() {
  return { day: state.day, elapsedSeconds: state.elapsed, population: state.population, morale: state.morale, housing: sim.rates(state).capacity, workforce: { builders: sim.workforce(state).builders, employed: sim.workforce(state).employed, idle: sim.workforce(state).idle }, resources: Object.fromEntries(RESOURCE_NAMES.map(k => [k, Math.round(state.resources[k] * 100) / 100])), buildings: Object.fromEntries(Object.keys(BUILDINGS).map(type => [type, count(type)]).filter(([, value]) => value)), research: [...state.research.completed], activeResearch: state.research.active?.id || null, upgrades: state.stats.upgrades, contracts: state.contracts.completed, voyages: state.routes.completed, coast: sim.pressureOptions(state).totals, objective: sim.objective(state), migration: state.migration.reason };
}
function invariants() {
  const labor = sim.workforce(state); assert.equal(labor.builders + labor.employed + labor.idle, state.population);
  assert.equal(new Set(state.citizens.map(c => c.id)).size, state.population);
  const assigned = state.buildings.flatMap(b => b.workerIds); assert.equal(new Set(assigned).size, assigned.length); assert.equal(assigned.length, labor.assigned);
  for (const key of RESOURCE_NAMES) assert.ok(Number.isFinite(state.resources[key]) && state.resources[key] >= 0, `Invalid ${key}`);
  assert.equal(state.buildings.some(building => omittedBuildings.has(building.type)), false, 'A specialized campaign built an omitted local chain');
}
function milestone(name, when) { if (when && !report.milestones[name]) report.milestones[name] = { ...summary(), macroActions: report.actions.length }; }
try {
  for (let turn = 0; state.day <= MAX_DAYS; turn++) {
    manageWorkers(); coastalDecisions(); buildingPlans(); tradeAndResearch(); upgrades(); sim.tick(state, 5); invariants();
    milestone('firstBell', state.won); milestone('twentyCitizens', state.population >= 20); milestone('fortyCitizens', state.population >= 40); milestone('seventyFiveCitizens', state.population >= 75);
    milestone('firstUpgrade', state.stats.upgrades > 0); milestone('firstVoyageReturn', state.routes.completed > 0); milestone('charter', !!state.policies.charter); milestone('allResearch', state.research.completed.length === Object.keys(progression.RESEARCH).length);
    milestone('firstCoastalDefense', state.pressure.defended > 0);
    if (state.day !== lastDay) {
      lastDay = state.day; report.daily.push(summary());
      if (state.day % 10 === 0) { const restored = sim.restore(sim.serialize(state)); assert.ok(restored, `Save could not reload at day ${state.day}`); assert.deepEqual(restored.resources, state.resources); state = restored; report.checkpointsReloaded++; }
      if (state.day % 20 === 0) console.log(JSON.stringify({ day: state.day, people: state.population, research: state.research.completed.length, contracts: state.contracts.completed, routes: state.routes.completed, food: Math.round(state.resources.food), macroActions: report.actions.length }));
    }
    if (sim.objective(state).complete) { milestone('allCurrentAmbitions', true); break; }
  }
} catch (error) { report.errors.push(error.stack || error.message); }
report.final = summary(); report.final.services = Object.fromEntries(Object.entries(sim.villageNeeds(state).services).map(([kind, access]) => [kind, { served: access.served, demand: access.demand, capacity: access.capacity, coverage: access.coverage }]));
report.final.harborCounter = state.imports; report.final.foodPotentialBalance = state.foodPotentialBalance;
report.finishedAt = new Date().toISOString(); report.sourceHashesAtEnd = await hashes();
report.sourcesStable = JSON.stringify(report.sourceHashesAtStart) === JSON.stringify(report.sourceHashesAtEnd);
report.longestGapBetweenMacroActionsSeconds = longestMacroGap;
report.pass = !report.errors.length && report.sourcesStable && !!report.milestones.fortyCitizens && !!report.milestones.firstBell && !!report.milestones.firstUpgrade;
report.completeCurrentAmbitions = !!report.milestones.allCurrentAmbitions;
report.limitations = ['Automated economy evidence, not a human gameplay session.', 'Coastal incidents use staffed readiness and timed preparation; tactical combat remains absent.', 'Simulated elapsed time includes waiting for labor, arrivals, research and production.', 'Automated stock-target staffing is more frequent and precise than ordinary player control.'];
if (SLOW_STAFFING) {
  const actions = report.staffingPolicy.actions;
  const gaps = actions.slice(1).map((action, index) => action.time - actions[index].time);
  report.staffingPolicy.minimumGapSeconds = Math.min(...gaps);
  report.staffingPolicy.actionsPerSimulatedMinute = actions.length / (state.elapsed / 60);
  report.staffingPolicy.actionCounts = Object.fromEntries(['workers', 'builders', 'priority'].map(kind => [kind, actions.filter(action => action.kind === kind).length]));
  assert.ok(gaps.every(gap => gap >= 30));
  report.limitations[3] = 'Staffing is globally limited to one mutation per 30 simulated seconds, with stock hysteresis; other construction, trade and research decisions still run every 5 seconds. This tests bounded labor intervention, not a fully human-paced campaign.';
}
await writeFile(new URL(`${OUTPUT_PREFIX}-report.json`, output), JSON.stringify(report, null, 2) + '\n');
await writeFile(new URL(`${OUTPUT_PREFIX}-save.json`, output), sim.serialize(state) + '\n');
console.log(JSON.stringify({ pass: report.pass, completeCurrentAmbitions: report.completeCurrentAmbitions, final: report.final, milestones: Object.fromEntries(Object.entries(report.milestones).map(([key, value]) => [key, { day: value.day, elapsedMinutes: Math.round(value.elapsedSeconds / 60), people: value.population }])), actions: report.actions.length, staffingChanges: report.staffingChanges, longestMacroGap: longestMacroGap, errors: report.errors, stable: report.sourcesStable }, null, 2));
process.exitCode = report.pass ? 0 : 1;
