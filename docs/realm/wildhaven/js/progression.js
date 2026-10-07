/** Research, charters, orders and voyages. Pure game data; no simulation cycle. */
import { BUILDINGS, RESOURCE_NAMES, RESOURCES, getBuildingSpec } from './catalog.js';

const MAX = 1e9;
const own = (object, key) => Object.hasOwn(object, key);
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const integer = (value, fallback = 0) => Number.isInteger(value) && value >= 0 ? value : fallback;
const round = value => Math.round(value * 1000000) / 1000000;
const dayOf = state => Math.max(1, integer(state.day, 1));
const population = state => Array.isArray(state.citizens) ? state.citizens.length : integer(state.population);
const ready = building => (!building.status || building.status === 'ready') && !building.paused;
const buildings = (state, type) => (state.buildings || []).filter(building => building.type === type && ready(building));
const count = (state, type) => buildings(state, type).length;
const researched = (state, id) => (state.research?.completed || []).includes(id);
const amount = (state, key) => Math.max(0, number(state.resources?.[key]));
const costText = cost => Object.entries(cost).map(([key, value]) => `${value} ${RESOURCES[key]?.name.toLowerCase() || key}`).join(' · ');
const missingCost = (state, cost) => Object.entries(cost).filter(([key, value]) => amount(state, key) + 0.00001 < value);
const afford = (state, cost) => missingCost(state, cost).length === 0;
const spend = (state, cost) => { for (const [key, value] of Object.entries(cost)) state.resources[key] = round(Math.max(0, amount(state, key) - value)); };
const award = (state, reward) => {
  const credited = {}, overflow = {};
  for (const [key, value] of Object.entries(reward)) {
    const current = amount(state, key);
    const capacity = RESOURCES[key]?.physical && Number.isFinite(state.storage?.[key]) ? state.storage[key] : MAX;
    // Preserve a legacy overfull stockpile; new cargo cannot extend overflow.
    state.resources[key] = Math.min(Math.max(current, capacity), round(current + value));
    credited[key] = round(state.resources[key] - current);
    if (credited[key] < value) overflow[key] = round(value - credited[key]);
  }
  return { credited, overflow };
};
const event = (text, type = 'progress') => ({ text, type });
const failure = reason => ({ ok: false, reason });

export const RESEARCH = Object.freeze({
  cultivation: { name: 'Fieldcraft', branch: 'agrarian', tier: 1, cost: { knowledge: 12 }, duration: 75, prerequisites: [], unlocks: ['farm'], description: 'Grow grain, and improve the yield of grain farms and kitchen gardens by 10%.', effects: { foodFarming: 1.1 } },
  joinery: { name: 'Timber framing', branch: 'industry', tier: 1, cost: { knowledge: 12 }, duration: 75, prerequisites: [], unlocks: ['sawmill'], description: 'Season timber into planks. Builders complete their work 10% faster.', effects: { construction: 1.1 } },
  barter: { name: 'Fair measures', branch: 'mercantile', tier: 1, cost: { knowledge: 10 }, duration: 60, prerequisites: [], unlocks: ['market'], description: 'Open a market hall. Improve contract and voyage coin by 5%; the landing also offers better terms as trade bonuses grow.', effects: { tradeReward: 1.05 } },
  civic_order: { name: 'Common ground', branch: 'civic', tier: 1, cost: { knowledge: 14 }, duration: 90, prerequisites: [], unlocks: ['chapel'], description: 'Make room for assemblies. Shared records make staffed research 10% faster and add two points of village morale.', effects: { research: 1.1, happiness: 2 } },
  milling: { name: 'Flour and fire', branch: 'agrarian', tier: 2, cost: { knowledge: 25, gold: 8 }, duration: 120, prerequisites: ['cultivation', 'joinery'], unlocks: ['windmill', 'bakery'], description: 'Connect grain fields, a windmill, and bakery ovens for a substantial food surplus.', effects: {} },
  textiles: { name: 'Field to loom', branch: 'industry', tier: 2, cost: { knowledge: 24, gold: 6 }, duration: 120, prerequisites: ['cultivation', 'joinery'], unlocks: ['flaxfield', 'weaver'], description: 'Grow flax and weave cloth for bedding, medical supplies, and valuable cargo.', effects: {} },
  metallurgy: { name: 'Ironworking', branch: 'industry', tier: 2, cost: { knowledge: 30, gold: 12 }, duration: 150, prerequisites: ['joinery'], unlocks: ['mine', 'smith', 'toolmaker'], description: 'Build the complete ore, iron, and tools chain. No workshop can run without its inputs.', effects: {} },
  logistics: { name: 'Dry stores', branch: 'mercantile', tier: 2, cost: { knowledge: 25, gold: 12 }, duration: 120, prerequisites: ['barter', 'joinery'], unlocks: ['warehouse'], description: 'Build warehouses, increase physical storage by 25%, and accept a third delivery order at a time.', effects: { storage: 1.25 } },
  watchkeeping: { name: 'A standing watch', branch: 'defense', tier: 2, cost: { knowledge: 24, gold: 8, tools: 4 }, duration: 120, prerequisites: ['civic_order'], unlocks: ['barracks'], description: 'Assign islanders as guards and escorts. Organized watches improve escort readiness by 15%, reducing the workers needed for distant cargo.', effects: { defense: 1.15 } },
  brewing: { name: 'Harvest gatherings', branch: 'agrarian', tier: 3, cost: { knowledge: 38, gold: 16, tools: 4 }, duration: 180, prerequisites: ['cultivation', 'milling'], unlocks: ['brewery'], description: 'Brew surplus grain into ale for staffed gathering places and profitable coastal cargo.', effects: {} },
  public_health: { name: 'Clean linen', branch: 'civic', tier: 3, cost: { knowledge: 45, gold: 20, tools: 6 }, duration: 180, prerequisites: ['civic_order', 'logistics'], unlocks: ['clinic'], description: 'Open supplied clinics using local or imported linen. Better household practice reduces food consumption by 5%.', effects: { foodConsumption: 0.95 } },
  coastal_routes: { name: 'Coastal partnerships', branch: 'mercantile', tier: 3, cost: { knowledge: 40, gold: 20, tools: 4 }, duration: 180, prerequisites: ['logistics'], unlocks: [], description: 'Send cargo to harbors that trust your deliveries. Improve landing terms and contract or voyage coin by another 10%.', effects: { tradeReward: 1.1 } },
  mastercraft: { name: 'Master workshops', branch: 'industry', tier: 3, cost: { knowledge: 60, gold: 30, tools: 8 }, duration: 240, prerequisites: ['metallurgy', 'textiles'], unlocks: [], description: 'Unlock level-three upgrades. Industry workshops produce 12% more from the same materials.', effects: { industryProduction: 1.12 } },
  town_charter: { name: 'The island charter', branch: 'civic', tier: 3, cost: { knowledge: 70, gold: 40, tools: 10 }, duration: 240, prerequisites: ['civic_order', 'logistics'], unlocks: ['manor'], description: 'Build a town hall and choose one binding charter: Breadbasket, Free Port, or Forge Town. Each has a cost as well as an advantage.', effects: {} },
  navigation: { name: 'Beyond the headland', branch: 'defense', tier: 3, cost: { knowledge: 70, gold: 50, tools: 12 }, duration: 270, prerequisites: ['coastal_routes', 'watchkeeping'], unlocks: [], description: 'Open distant routes that require trusted partners and staffed guards. Prepared escorts raise readiness by another 15%.', effects: { defense: 1.15 } },
});

export const POLICIES = Object.freeze({
  breadbasket: { name: 'Breadbasket', description: 'The island puts its best labor and land into the harvest.', tradeoffs: ['Food and field production +25%', 'Industry production −10%', 'Food consumption +5%'] },
  freeport: { name: 'Free Port', description: 'A generous landing welcomes merchants and new neighbors.', tradeoffs: ['Landing supplies and contract or voyage coin +30%', 'Imported goods cost 15% less; three daily shipments per offer instead of two', 'One additional arrival when all arrival needs are met', 'Food and field production −10%'] },
  forge: { name: 'Forge Town', description: 'Workshops set the rhythm of the town, and skilled trades prosper.', tradeoffs: ['Industry production +25%', 'Food consumption +15%', 'One fewer arrival per arrival opportunity'] },
});
const SWITCH_POLICY_COST = Object.freeze({ gold: 60, knowledge: 25 });

const CONTRACTS = Object.freeze({
  pantry: { title: 'Supper for the ferry crew', description: 'A crew passing the headland needs a proper meal.', requirements: { food: 18 }, reward: { gold: 8, knowledge: 4 }, duration: 4 },
  repairs: { title: 'Mend the neighboring jetty', description: 'Help a nearby harbor repair its landing before the next boat.', requirements: { wood: 24, stone: 10 }, reward: { gold: 12, knowledge: 6 }, duration: 5 },
  provisions: { title: 'A basket and a bundle', description: 'A small, useful delivery to the coast watch.', requirements: { food: 12, wood: 12 }, reward: { gold: 8, knowledge: 5 }, duration: 4 },
  boards: { title: 'Weatherproof the boathouse', description: 'Seasoned boards and a meal for the carpenters.', requirements: { planks: 18, food: 10 }, reward: { gold: 24, knowledge: 10 }, duration: 5, requires: 'joinery' },
  linen: { title: 'Linen for the guesthouse', description: 'A neighboring town is opening its doors to winter visitors.', requirements: { cloth: 12 }, reward: { gold: 28, knowledge: 12 }, duration: 6, requires: 'textiles' },
  ironwork: { title: 'Hinges, axes, and good iron', description: 'The outer islands need tools that will last.', requirements: { iron: 12, tools: 6 }, reward: { gold: 48, knowledge: 18 }, duration: 7, requires: 'metallurgy' },
  gathering: { title: 'A coastwide gathering', description: 'Bring supper, cloth, and barrels for a neighboring harbor festival.', requirements: { food: 40, ale: 12, cloth: 6 }, reward: { gold: 72, knowledge: 24 }, duration: 8, requires: 'brewing' },
  civic: { title: 'Build another town a beginning', description: 'Send the boards, tools, and bedding needed for a new public hall.', requirements: { planks: 40, tools: 12, cloth: 14 }, reward: { gold: 110, knowledge: 38 }, duration: 10, requires: 'town_charter' },
});
const CONTRACT_PARTNERS = Object.freeze({ pantry: 'reedbank', provisions: 'reedbank', repairs: 'stonehaven', boards: 'stonehaven', linen: 'lantern_isles', gathering: 'lantern_isles', ironwork: 'far_sound', civic: 'far_sound' });

export const ROUTES = Object.freeze({
  reedbank: { name: 'Reedbank', description: 'A short food-and-cloth run to a sheltered farming harbor. Provision orders build this partnership.', cargo: { food: 24, cloth: 6 }, reward: { gold: 38, knowledge: 8 }, duration: 3, requires: 'coastal_routes', guards: 0, requiredTrust: 2 },
  stonehaven: { name: 'Stonehaven', description: 'The stonemasons pay for boards and tools, and send stone home in the hold. Repair and board orders build trust here.', cargo: { planks: 20, tools: 8 }, reward: { gold: 55, stone: 30, knowledge: 12 }, duration: 4, requires: 'coastal_routes', guards: 0, requiredTrust: 2 },
  lantern_isles: { name: 'Lantern Isles', description: 'Escort cloth, ale, and tools beyond the headland. Linen and gathering orders build this partnership; the escort needs four points of readiness.', cargo: { cloth: 20, ale: 16, tools: 12 }, reward: { gold: 125, knowledge: 30 }, duration: 6, requires: 'navigation', guards: 4, requiredTrust: 4 },
  far_sound: { name: 'The Far Sound', description: 'A long civic supply voyage for a trusted metalwork partner. The departure escort needs eight points of staffed readiness; no battle is simulated.', cargo: { planks: 45, iron: 20, tools: 20, cloth: 20 }, reward: { gold: 240, knowledge: 55 }, duration: 9, requires: 'navigation', guards: 8, requiredTrust: 6 },
});

/** Fixed quotes make specialization possible without random emergency offers. */
export const IMPORTS = Object.freeze({
  import_food: { name: 'Pantry baskets', resource: 'food', quantity: 24, price: 18 },
  import_grain: { name: 'Sacks of grain', resource: 'grain', quantity: 24, price: 14 },
  import_planks: { name: 'Seasoned boards', resource: 'planks', quantity: 10, price: 26 },
  import_cloth: { name: 'Clean linen', resource: 'cloth', quantity: 6, price: 30 },
  import_iron: { name: 'Iron bars', resource: 'iron', quantity: 6, price: 24 },
  import_tools: { name: 'A crate of tools', resource: 'tools', quantity: 4, price: 28 },
  import_ale: { name: 'Festival barrels', resource: 'ale', quantity: 8, price: 26 },
});
export const EXPORTS = Object.freeze({
  export_food: { name: 'Provision the coast', resource: 'food', quantity: 40, price: 12 },
  export_grain: { name: 'Sell the harvest', resource: 'grain', quantity: 40, price: 12 },
  export_planks: { name: 'Ship seasoned boards', resource: 'planks', quantity: 16, price: 20 },
  export_cloth: { name: 'Sell woven linen', resource: 'cloth', quantity: 10, price: 24 },
  export_iron: { name: 'Supply the smiths', resource: 'iron', quantity: 10, price: 18 },
  export_tools: { name: 'Ship workshop tools', resource: 'tools', quantity: 6, price: 22 },
  export_ale: { name: 'Sell festival barrels', resource: 'ale', quantity: 12, price: 20 },
});

export function createProgressionState() {
  return {
    research: { completed: [], active: null }, policies: { charter: null, changedDay: null },
    contracts: { offers: [], active: [], completed: 0, failed: 0, nextId: 1, offerDay: 0 },
    routes: { active: [], completed: 0, nextId: 1, reputation: {} },
    imports: { day: 1, used: {}, completed: 0, exportsCompleted: 0, byResource: {}, exported: {} },
    milestones: [], progressionDay: 0,
  };
}

/** Normalize only owned progression fields; never replace citizens or buildings. */
export function normalizeProgression(state) {
  if (!state.resources || typeof state.resources !== 'object') state.resources = {};
  // UI option reads must never truncate the simulation's authoritative stock.
  for (const resource of RESOURCE_NAMES) state.resources[resource] = Math.max(0, number(state.resources[resource]));
  const defaults = createProgressionState();
  state.research = state.research && typeof state.research === 'object' ? state.research : defaults.research;
  state.research.completed = [...new Set((Array.isArray(state.research.completed) ? state.research.completed : []).filter(id => typeof id === 'string' && own(RESEARCH, id)))];
  const active = state.research.active;
  state.research.active = active && own(RESEARCH, active.id) && !researched(state, active.id)
    ? { id: active.id, progress: Math.max(0, Math.min(RESEARCH[active.id].duration, number(active.progress))), duration: RESEARCH[active.id].duration, startedDay: Math.max(1, integer(active.startedDay, dayOf(state))) }
    : null;
  state.policies = state.policies && typeof state.policies === 'object' ? state.policies : defaults.policies;
  state.policies.charter = own(POLICIES, state.policies.charter) ? state.policies.charter : null;
  state.policies.changedDay = Number.isInteger(state.policies.changedDay) && state.policies.changedDay > 0 ? state.policies.changedDay : null;
  state.contracts = state.contracts && typeof state.contracts === 'object' ? state.contracts : defaults.contracts;
  for (const key of ['completed', 'failed']) state.contracts[key] = integer(state.contracts[key]);
  state.contracts.offerDay = integer(state.contracts.offerDay);
  state.contracts.nextId = Math.max(1, integer(state.contracts.nextId, 1));
  const validOrder = order => order && typeof order.id === 'string' && /^order-[0-9]+-[a-z_]+$/.test(order.id) && own(CONTRACTS, order.definitionId);
  state.contracts.offers = (Array.isArray(state.contracts.offers) ? state.contracts.offers : []).filter(validOrder).slice(0, 3).map(order => ({ id: order.id, definitionId: order.definitionId, offeredDay: Math.max(1, integer(order.offeredDay, dayOf(state))), status: 'offered' }));
  const orderIds = new Set();
  state.contracts.active = (Array.isArray(state.contracts.active) ? state.contracts.active : []).filter(order => {
    if (!validOrder(order) || orderIds.has(order.id)) return false;
    orderIds.add(order.id); return true;
  }).slice(0, 3).map(order => {
    const acceptedDay = Math.max(1, integer(order.acceptedDay, dayOf(state)));
    return { id: order.id, definitionId: order.definitionId, acceptedDay, deadline: acceptedDay + CONTRACTS[order.definitionId].duration, status: 'active' };
  });
  state.routes = state.routes && typeof state.routes === 'object' ? state.routes : defaults.routes;
  state.routes.completed = integer(state.routes.completed);
  state.routes.reputation = Object.fromEntries(Object.keys(ROUTES).map(id => [id, Math.min(12, integer(state.routes.reputation?.[id]))]));
  state.routes.nextId = Math.max(1, integer(state.routes.nextId, 1));
  const voyageIds = new Set();
  state.routes.active = (Array.isArray(state.routes.active) ? state.routes.active : []).filter(voyage => {
    if (!voyage || !own(ROUTES, voyage.routeId) || typeof voyage.id !== 'string' || !/^voyage-[0-9]+$/.test(voyage.id) || voyageIds.has(voyage.id)) return false;
    voyageIds.add(voyage.id); return true;
  }).slice(0, 4).map(voyage => {
    const departedDay = Math.max(1, integer(voyage.departedDay, dayOf(state)));
    return { id: voyage.id, routeId: voyage.routeId, departedDay, returnDay: departedDay + ROUTES[voyage.routeId].duration, rewardMultiplier: Math.max(1, Math.min(2, number(voyage.rewardMultiplier, 1))) };
  });
  state.routes.nextId = Math.max(state.routes.nextId, ...state.routes.active.map(voyage => Number(voyage.id.slice(7)) + 1));
  state.imports = state.imports && typeof state.imports === 'object' ? state.imports : defaults.imports;
  state.imports.used = state.imports.day === dayOf(state) && state.imports.used && typeof state.imports.used === 'object'
    ? Object.fromEntries(Object.entries(state.imports.used).filter(([id]) => own(IMPORTS, id) || own(EXPORTS, id)).map(([id, value]) => [id, Math.min(3, integer(value))])) : {};
  state.imports.day = dayOf(state); state.imports.completed = integer(state.imports.completed); state.imports.exportsCompleted = integer(state.imports.exportsCompleted);
  for (const key of ['byResource', 'exported']) state.imports[key] = Object.fromEntries(RESOURCE_NAMES.map(resource => [resource, Math.min(MAX, integer(state.imports[key]?.[resource]))]));
  state.milestones = [...new Set((Array.isArray(state.milestones) ? state.milestones : []).filter(value => typeof value === 'string' && /^chapter_[0-9]+$/.test(value)))];
  state.progressionDay = integer(state.progressionDay);
  return state;
}

export function researchOptions(state) {
  normalizeProgression(state);
  return Object.entries(RESEARCH).map(([id, spec]) => {
    const completed = researched(state, id), active = state.research.active?.id === id;
    const needed = spec.prerequisites.filter(prerequisite => !researched(state, prerequisite));
    let reason = 'Scholars are ready to begin.';
    if (completed) reason = 'Already researched.';
    else if (active) reason = 'The scholars are working on this.';
    else if (state.research.active) reason = 'Finish the current research first.';
    else if (needed.length) reason = `First research ${needed.map(key => RESEARCH[key].name).join(' and ')}.`;
    else if (!afford(state, spec.cost)) reason = `Research costs ${costText(spec.cost)}.`;
    const canStart = !completed && !state.research.active && !needed.length && afford(state, spec.cost);
    return { id, ...spec, completed, active, canStart, ok: canStart, reason, progress: completed ? 1 : active ? state.research.active.progress / spec.duration : 0 };
  });
}

export function startResearch(state, id) {
  const option = researchOptions(state).find(option => option.id === id);
  if (!option) return failure('Choose a known field of research.');
  if (!option.canStart) return failure(option.reason);
  spend(state, option.cost);
  state.research.active = { id, progress: 0, duration: option.duration, startedDay: dayOf(state) };
  return { ok: true, reason: `${option.name} begun. Assigned scholars will carry it forward.`, research: state.research.active };
}

export function policyOptions(state) {
  normalizeProgression(state);
  return Object.entries(POLICIES).map(([id, spec]) => {
    const selected = state.policies.charter === id;
    const cost = state.policies.charter ? { ...SWITCH_POLICY_COST } : {};
    let reason = state.policies.charter ? `Change this charter for ${costText(cost)}.` : 'Your first charter is free to adopt.';
    if (!researched(state, 'town_charter')) reason = 'Research The island charter first.';
    else if (selected) reason = 'This is the town’s current charter.';
    else if (!afford(state, cost)) reason = `Changing the charter costs ${costText(cost)}.`;
    const canSelect = researched(state, 'town_charter') && !selected && afford(state, cost);
    return { id, ...spec, cost, selected, canSelect, ok: canSelect, reason };
  });
}

export function setPolicy(state, id) {
  const option = policyOptions(state).find(option => option.id === id);
  if (!option) return failure('Choose Breadbasket, Free Port, or Forge Town.');
  if (!option.canSelect) return failure(option.reason);
  spend(state, option.cost);
  state.policies.charter = id; state.policies.changedDay = dayOf(state);
  return { ok: true, reason: `${option.name} is now the island’s charter.`, policy: id };
}

export function canUnlockBuilding(state, type) {
  if (!own(BUILDINGS, type)) return failure('Choose a known building.');
  const unlock = BUILDINGS[type].unlock;
  return !unlock || researched(state, unlock) ? { ok: true, reason: 'This building is available.' } : failure(`Research ${RESEARCH[unlock]?.name || unlock} first.`);
}

/** Production affects outputs, not recipe consumption; construction is speed. */
export function supplyModifiers(state, type) {
  const modifiers = { production: 1, construction: 1, foodConsumption: 1, tradeReward: 1, arrival: 0, happiness: 0, storage: 1, defense: 1, research: 1 };
  const spec = BUILDINGS[type];
  for (const id of state.research?.completed || []) {
    const effects = RESEARCH[id]?.effects;
    if (!effects) continue;
    for (const key of ['construction', 'foodConsumption', 'tradeReward', 'storage', 'defense', 'research']) modifiers[key] *= effects[key] || 1;
    modifiers.happiness += effects.happiness || 0;
    if (effects.foodFarming && ['farm', 'garden'].includes(type)) modifiers.production *= effects.foodFarming;
    if (effects.industryProduction && spec?.category === 'industry') modifiers.production *= effects.industryProduction;
  }
  const charter = state.policies?.charter;
  const harvest = spec?.category === 'food' || type === 'flaxfield';
  if (charter === 'breadbasket') {
    if (harvest) modifiers.production *= 1.25;
    if (spec?.category === 'industry') modifiers.production *= 0.9;
    modifiers.foodConsumption *= 1.05;
  } else if (charter === 'freeport') {
    modifiers.tradeReward *= 1.3; modifiers.arrival += 1;
    if (harvest) modifiers.production *= 0.9;
  } else if (charter === 'forge') {
    if (spec?.category === 'industry') modifiers.production *= 1.25;
    modifiers.foodConsumption *= 1.15; modifiers.arrival -= 1;
  }
  return modifiers;
}

function staffedSchoolRate(state) {
  return buildings(state, 'school').reduce((sum, building) => {
    if (Number.isFinite(building.production?.efficiency)) return sum + Math.max(0, building.production.efficiency);
    if (building.production?.blockedReason) return sum;
    const spec = getBuildingSpec('school', building.level || 1);
    const workers = building.workerIds?.length ?? (state.citizens || []).filter(citizen => citizen.workplace === building.id && citizen.job === 'scholar').length;
    return sum + Math.min(1, workers / spec.workers);
  }, 0);
}

export function tickProgression(state, dt, services = {}) {
  const result = { events: [] };
  if (!Number.isFinite(dt) || dt <= 0) return result;
  const active = state.research?.active;
  if (!active || !own(RESEARCH, active.id)) return result;
  const rawRate = Number.isFinite(services.researchRate) ? services.researchRate : staffedSchoolRate(state);
  const rate = Math.max(0, rawRate) * supplyModifiers(state, 'school').research;
  active.progress = Math.min(active.duration, active.progress + dt * rate);
  if (active.progress >= active.duration) {
    const id = active.id;
    if (!state.research.completed.includes(id)) state.research.completed.push(id);
    state.research.active = null;
    result.events.push(event(`${RESEARCH[id].name} is understood. ${RESEARCH[id].description}`, 'research'));
    result.completed = id;
  }
  return result;
}

function coinReward(reward, multiplier) {
  return Object.fromEntries(Object.entries(reward).map(([key, value]) => [key, key === 'gold' ? Math.round(value * multiplier) : value]));
}

function refreshOffers(state) {
  const day = dayOf(state);
  if (state.contracts.offerDay === day) return;
  state.contracts.offerDay = day;
  const underway = new Set(state.contracts.active.map(order => order.definitionId));
  const available = Object.keys(CONTRACTS).filter(id => !underway.has(id) && (!CONTRACTS[id].requires || researched(state, CONTRACTS[id].requires)));
  state.contracts.offers = [];
  for (let index = 0; index < Math.min(3, available.length); index++) {
    const definitionId = available[(day * 2 + index) % available.length];
    state.contracts.offers.push({ id: `order-${day}-${definitionId}`, definitionId, offeredDay: day, status: 'offered' });
  }
}

export function contractOptions(state) {
  normalizeProgression(state);
  if (state.contracts.offerDay === 0) refreshOffers(state);
  const capacity = researched(state, 'logistics') ? 3 : 2;
  return [...state.contracts.active, ...state.contracts.offers].map(order => {
    const spec = CONTRACTS[order.definitionId], active = order.status === 'active';
    const partnerId = CONTRACT_PARTNERS[order.definitionId], partner = ROUTES[partnerId].name;
    const expired = active && dayOf(state) > order.deadline;
    const canAccept = !active && state.contracts.active.length < capacity;
    const canComplete = active && !expired && afford(state, spec.requirements);
    const reason = expired ? 'The delivery deadline has passed.' : active
      ? canComplete ? 'The full delivery is ready.' : `Deliver ${costText(spec.requirements)} by day ${order.deadline}.`
      : canAccept ? `Accept now; deliver within ${spec.duration} days. No supplies are taken until you deliver.` : `You can handle ${capacity} orders at once.`;
    return { ...order, ...spec, description: `${spec.description} Delivery earns 1 trust with ${partner}.`, partnerId, partner, trust: state.routes.reputation[partnerId], trustGain: 1, reward: coinReward(spec.reward, supplyModifiers(state, 'market').tradeReward), deadline: active ? order.deadline : dayOf(state) + spec.duration, canAccept, canComplete, ok: active ? canComplete : canAccept, reason };
  });
}

export function acceptContract(state, id) {
  const option = contractOptions(state).find(option => option.id === id);
  if (!option || !option.canAccept) return failure(option?.reason || 'This order is no longer on offer.');
  state.contracts.offers = state.contracts.offers.filter(order => order.id !== id);
  const order = { id, definitionId: option.definitionId, acceptedDay: dayOf(state), deadline: dayOf(state) + option.duration, status: 'active' };
  state.contracts.active.push(order);
  return { ok: true, reason: `${option.title} accepted. Deliver by day ${order.deadline}.`, contract: order };
}

export function completeContract(state, id) {
  const option = contractOptions(state).find(option => option.id === id);
  if (!option || !option.canComplete) return failure(option?.reason || 'Choose an accepted order to deliver.');
  spend(state, option.requirements); const delivery = award(state, option.reward);
  state.contracts.active = state.contracts.active.filter(order => order.id !== id);
  state.contracts.completed++;
  state.routes.reputation[option.partnerId] = Math.min(12, state.routes.reputation[option.partnerId] + 1);
  return { ok: true, reason: `${option.title} delivered. Received ${costText(delivery.credited)}. ${option.partner} trust +1.${Object.keys(delivery.overflow).length ? ' Excess cargo could not fit in storage.' : ''}`, reward: delivery.credited, overflow: delivery.overflow, contract: id, partner: option.partnerId, trust: state.routes.reputation[option.partnerId] };
}

function guards(state) {
  const watch = new Set(buildings(state, 'barracks').map(building => building.id));
  return (state.citizens || []).filter(citizen => citizen.job === 'guard' && watch.has(citizen.workplace)).length;
}

/** Supplied guards and their researched organization, never cosmetic soldiers. */
export function defenseReadiness(state) {
  let supplied = 0;
  for (const building of buildings(state, 'barracks')) {
    const assigned = (state.citizens || []).filter(citizen => citizen.job === 'guard' && citizen.workplace === building.id).length;
    const efficiency = Math.max(0, number(building.production?.efficiency));
    supplied += Math.min(assigned * 1.2, efficiency * getBuildingSpec('barracks', building.level || 1).workers);
  }
  return round(supplied * supplyModifiers(state, 'barracks').defense);
}

const partnerBonus = (state, id) => 1 + Math.min(5, integer(state.routes?.reputation?.[id])) * 0.02;

function staffedMarket(state) {
  return buildings(state, 'market').some(building => {
    const supplied = Number.isFinite(building.production?.efficiency) ? building.production.efficiency > 0 : !building.production?.blockedReason;
    return supplied && (building.workerIds?.length || (state.citizens || []).some(citizen => citizen.workplace === building.id && citizen.job === 'trader'));
  });
}

function goodsOptions(state, buying) {
  normalizeProgression(state);
  const dailyLimit = state.policies.charter === 'freeport' ? 3 : 2;
  return Object.entries(buying ? IMPORTS : EXPORTS).map(([id, spec]) => {
    const price = buying ? Math.ceil(spec.price * (state.policies.charter === 'freeport' ? 0.85 : 1)) : Math.round(spec.price * supplyModifiers(state, 'market').tradeReward);
    const cost = buying ? { gold: price } : { [spec.resource]: spec.quantity };
    const reward = buying ? { [spec.resource]: spec.quantity } : { gold: price };
    const remaining = Math.max(0, dailyLimit - (state.imports.used[id] || 0));
    const room = !buying || !Number.isFinite(state.storage?.[spec.resource]) || amount(state, spec.resource) + spec.quantity <= state.storage[spec.resource] + 1e-6;
    let reason = `${remaining} of ${dailyLimit} shipments left today. ${costText(cost)} → ${costText(reward)}.`;
    if (!researched(state, 'barter')) reason = 'Research Fair measures before opening the harbor counter.';
    else if (!staffedMarket(state)) reason = 'Staff and supply a market hall to receive or sell goods.';
    else if (!remaining) reason = `Today’s ${dailyLimit} shipments are used. The next cargo arrives at dawn.`;
    else if (!room) reason = `Make room for all ${spec.quantity} ${RESOURCES[spec.resource].name.toLowerCase()} before paying for this cargo.`;
    else if (!afford(state, cost)) reason = `This shipment costs ${costText(cost)}.`;
    const ok = researched(state, 'barter') && staffedMarket(state) && remaining > 0 && room && afford(state, cost);
    return { id, name: spec.name, description: buying ? `Buy ${RESOURCES[spec.resource].name.toLowerCase()} from neighboring workshops. Building the local chain is optional.` : `Sell surplus ${RESOURCES[spec.resource].name.toLowerCase()} for coin that can support another specialty.`, cost, reward, dailyLimit, remaining, canImport: buying && ok, canExport: !buying && ok, ok, reason };
  });
}
export const importOptions = state => goodsOptions(state, true);
export const exportOptions = state => goodsOptions(state, false);
function exchangeGoods(state, id, buying) {
  const option = goodsOptions(state, buying).find(option => option.id === id);
  if (!option?.ok) return failure(option?.reason || 'Choose a listed harbor shipment.');
  spend(state, option.cost); const delivered = award(state, option.reward);
  state.imports.used[id] = (state.imports.used[id] || 0) + 1;
  state.imports[buying ? 'completed' : 'exportsCompleted']++;
  const spec = (buying ? IMPORTS : EXPORTS)[id], ledger = state.imports[buying ? 'byResource' : 'exported'];
  ledger[spec.resource] = Math.min(MAX, (ledger[spec.resource] || 0) + spec.quantity);
  return { ok: true, reason: `${option.name}: paid ${costText(option.cost)}; received ${costText(delivered.credited)}. ${option.remaining - 1} shipments left today.`, cost: option.cost, reward: delivered.credited };
}
export const importGoods = (state, id) => exchangeGoods(state, id, true);
export const exportGoods = (state, id) => exchangeGoods(state, id, false);

export function routeOptions(state) {
  normalizeProgression(state);
  return Object.entries(ROUTES).map(([id, spec]) => {
    const voyage = state.routes.active.find(voyage => voyage.routeId === id);
    const trust = state.routes.reputation[id], requiredGuards = Math.ceil(spec.guards / supplyModifiers(state, 'barracks').defense);
    const canDispatch = researched(state, spec.requires) && staffedMarket(state) && !voyage && trust >= spec.requiredTrust && defenseReadiness(state) >= spec.guards && afford(state, spec.cargo);
    let reason = `Cargo returns in ${spec.duration} days.`;
    if (!researched(state, spec.requires)) reason = `Research ${RESEARCH[spec.requires].name} first.`;
    else if (!staffedMarket(state)) reason = 'Staff and supply a market hall before dispatching cargo.';
    else if (voyage) reason = `Already at sea. Returns on day ${voyage.returnDay}.`;
    else if (trust < spec.requiredTrust) reason = `${spec.name} trust ${trust}/${spec.requiredTrust}. Complete delivery orders for this harbor to build a partnership.`;
    else if (defenseReadiness(state) < spec.guards) reason = `Need ${spec.guards} escort readiness; ${defenseReadiness(state).toFixed(1)} ready. About ${requiredGuards} fully supplied guards before experience bonuses. Keep their food supplied.`;
    else if (!afford(state, spec.cargo)) reason = `Cargo requires ${costText(spec.cargo)}.`;
    const rewardMultiplier = voyage?.rewardMultiplier ?? supplyModifiers(state, 'market').tradeReward * partnerBonus(state, id);
    return { id, ...spec, description: `${spec.description} Trust ${trust}/${spec.requiredTrust}; established partners pay up to 10% more coin.`, trust, guards: requiredGuards, guardCount: guards(state), escortReadiness: defenseReadiness(state), requiredReadiness: spec.guards, reward: coinReward(spec.reward, rewardMultiplier), active: !!voyage, returnDay: voyage?.returnDay ?? dayOf(state) + spec.duration, canDispatch, ok: canDispatch, reason };
  });
}

export function dispatchRoute(state, id) {
  const option = routeOptions(state).find(option => option.id === id);
  if (!option || !option.canDispatch) return failure(option?.reason || 'Choose a known coastal route.');
  spend(state, option.cargo);
  const voyage = { id: `voyage-${state.routes.nextId++}`, routeId: id, departedDay: dayOf(state), returnDay: dayOf(state) + option.duration, rewardMultiplier: supplyModifiers(state, 'market').tradeReward * partnerBonus(state, id) };
  state.routes.active.push(voyage);
  return { ok: true, reason: `${option.name} cargo departed. Returns on day ${voyage.returnDay}.`, voyage };
}

function staffedService(state, type) {
  return buildings(state, type).filter(building => {
    const spec = getBuildingSpec(type, building.level || 1);
    if (!spec.workers) return true;
    const supplied = Number.isFinite(building.production?.efficiency) ? building.production.efficiency > 0 : !building.production?.blockedReason;
    return (building.workerIds?.length || 0) > 0 && supplied;
  }).length;
}

function chapters(state) {
  const residents = population(state), stock = state.resources || {};
  const progress = (value, target) => Math.min(target, Math.max(0, number(value)));
  const goal = (id, title, description, values, extra = {}) => ({ id, title, description, current: values.reduce((sum, [value, target]) => sum + progress(value, target), 0), total: values.reduce((sum, [, target]) => sum + target, 0), ...extra });
  const foodPlaces = count(state, 'orchard') + count(state, 'garden');
  const bell = (state.buildings || []).some(building => building.type === 'bell' && building.restored && ready(building));
  const coverage = state.serviceCoverage || {}, ledger = state.imports || {}, sold = ledger.exported || {};
  const peacefulCoasts = (state.pressure?.defended || 0) + (state.pressure?.paid || 0);
  const sustainableFood = number(state.foodPotentialBalance, number(state.foodBalance, -1)) >= 0 ? 1 : 0;
  const learned = ids => ids.filter(id => researched(state, id)).length;
  let specialty;
  if (state.policies?.charter === 'breadbasket') {
    specialty = goal('chapter_9', 'The coast’s table', 'Become a Breadbasket: export 800 food, plus either 240 grain or 80 ale. Keep 300 food and 600 coin in reserve, and study Fieldcraft and Flour and fire. Imported linen and tools can replace local workshops.', [[sold.food, 800], [Math.max(number(sold.grain) / 240, number(sold.ale) / 80), 1], [stock.food, 300], [stock.gold, 600], [learned(['cultivation', 'milling']), 2]], { specialty: 'breadbasket' });
  } else if (state.policies?.charter === 'forge') {
    const workshops = (state.buildings || []).filter(building => ready(building) && BUILDINGS[building.type]?.category === 'industry' && building.level >= 2).length;
    specialty = goal('chapter_9', 'The island that makes', 'Build a Forge Town: export 120 iron and 90 tools, improve three industry workshops, repel three coastal incidents with a prepared watch, and keep 600 coin. Study Timber framing, Ironworking and Master workshops; imports can supply food and linen.', [[sold.iron, 120], [sold.tools, 90], [workshops, 3], [state.pressure?.defended, 3], [stock.gold, 600], [learned(['joinery', 'metallurgy', 'mastercraft']), 3]], { specialty: 'forge' });
  } else if (state.policies?.charter === 'freeport') {
    const partnerships = Object.values(state.routes?.reputation || {}).filter(trust => trust >= 4).length;
    specialty = goal('chapter_9', 'An open harbor', 'Build a Free Port: complete twelve voyages and twenty imported shipments, earn four trust with two harbors, and keep 1,000 coin. Study Fair measures, Dry stores and Coastal partnerships. Local mines, smithies, looms and breweries are optional.', [[state.routes?.completed, 12], [ledger.completed, 20], [partnerships, 2], [stock.gold, 1000], [learned(['barter', 'logistics', 'coastal_routes']), 3]], { specialty: 'freeport' });
  } else {
    specialty = goal('chapter_9', 'Choose the town’s future', 'Choose a Breadbasket, Free Port, or Forge Town charter. Each opens its own final ambition; no town needs every industry or field of research.', [[state.policies?.charter ? 1 : 0, 1]]);
  }
  return [
    goal('chapter_0', 'A home, built by hand', 'Finish a cottage. Builders need time to raise its walls before anyone can move in.', [[count(state, 'cottage'), 1]], { type: 'cottage' }),
    goal('chapter_1', 'A working supper', 'Finish an orchard or garden, then assign islanders to tend it. Fields without workers do not fill a pantry.', [[staffedService(state, 'orchard') + staffedService(state, 'garden'), 1]], { type: 'orchard' }),
    goal('chapter_2', 'The work of a village', 'Staff a woodcutter and stoneworks. Builders, farmers, and material workers share the same small population.', [[staffedService(state, 'lumber'), 1], [staffedService(state, 'quarry'), 1]], { type: count(state, 'lumber') ? 'quarry' : 'lumber' }),
    goal('chapter_3', 'Room around the table', 'Finish three cottages and two food gardens, and welcome ten islanders.', [[count(state, 'cottage'), 3], [foodPlaces, 2], [residents, 10]], { type: count(state, 'cottage') < 3 ? 'cottage' : 'garden' }),
    goal('chapter_4', 'The first ringing', 'Restore the old bell. This is the beginning of a town, with fields, workshops, and coastwide friendships still ahead.', [[bell ? 1 : 0, 1]], { type: 'bell' }),
    goal('chapter_5', 'A village that can teach', 'Welcome twenty people, keep forty food in reserve, staff a school, build a well, and complete three fields of research.', [[residents, 20], [stock.food, 40], [staffedService(state, 'school'), 1], [count(state, 'well'), 1], [state.research?.completed.length, 3]], { type: 'school' }),
    goal('chapter_6', 'Care for a growing town', 'Grow to forty people. Have twelve tools and twelve cloth in stock; made or imported goods enter stores automatically. Staff a market and clinic, and provide water to half the town’s housing and healthcare to 40%.', [[residents, 40], [stock.tools, 12], [stock.cloth, 12], [staffedService(state, 'market'), 1], [staffedService(state, 'clinic'), 1], [coverage.water, .5], [coverage.health, .4]], { type: 'clinic' }),
    goal('chapter_7', 'A place on the coast', 'Complete six delivery orders and either three voyages or twelve harbor-counter exports. Have 200 coin in stock, finish a town hall, and choose a town path.', [[state.contracts?.completed, 6], [Math.max(number(state.routes?.completed), number(ledger.exportsCompleted) / 4), 3], [stock.gold, 200], [count(state, 'manor'), 1], [state.policies?.charter ? 1 : 0, 1]], { type: 'manor' }),
    goal('chapter_8', 'Seventy-five lives', 'Welcome 75 residents with 150 food reserved and enough staffed, supplied food production to cover daily needs. Serve 60% of housing with water and healthcare, and 50% with chapel or brewhouse community access. Resolve three coastal incidents by supplies or prepared defense.', [[residents, 75], [stock.food, 150], [sustainableFood, 1], [coverage.water, .6], [coverage.health, .6], [coverage.community, .5], [peacefulCoasts, 3]], { type: 'cottage' }),
    specialty,
  ];
}

export function progressionObjective(state) {
  const goals = chapters(state);
  const index = goals.findIndex(goal => !(state.milestones || []).includes(goal.id) && goal.current < goal.total);
  if (index === -1) return { title: 'A harbor with a future', description: 'Every town ambition is fulfilled. Keep shaping its neighborhoods, workshops, and coastal friendships.', current: 1, total: 1, complete: true, step: goals.length };
  return { ...goals[index], complete: false, step: index };
}

export function dailyProgression(state) {
  normalizeProgression(state);
  const result = { events: [] };
  const day = dayOf(state);
  if (state.progressionDay >= day) return result;
  state.progressionDay = day;
  const expired = state.contracts.active.filter(order => day > order.deadline);
  state.contracts.active = state.contracts.active.filter(order => day <= order.deadline);
  for (const order of expired) {
    state.contracts.failed++;
    result.events.push(event(`${CONTRACTS[order.definitionId].title} passed its delivery date. No supplies were taken; choose another order when the town is ready.`, 'contract'));
  }
  const returning = state.routes.active.filter(voyage => day >= voyage.returnDay);
  state.routes.active = state.routes.active.filter(voyage => day < voyage.returnDay);
  for (const voyage of returning) {
    const route = ROUTES[voyage.routeId], reward = coinReward(route.reward, voyage.rewardMultiplier);
    const delivery = award(state, reward); state.routes.completed++;
    state.routes.reputation[voyage.routeId] = Math.min(12, state.routes.reputation[voyage.routeId] + 1);
    result.events.push(event(`The ${route.name} cargo has returned. Stored ${costText(delivery.credited)}.${Object.keys(delivery.overflow).length ? ` Storage was full; ${costText(delivery.overflow)} could not be unloaded.` : ''}`, 'voyage'));
  }
  refreshOffers(state);
  for (const chapter of chapters(state)) {
    if (state.milestones.includes(chapter.id)) continue;
    if (chapter.current < chapter.total) break;
    state.milestones.push(chapter.id);
    result.events.push(event(`${chapter.title}: an ambition fulfilled.`, 'milestone'));
  }
  return result;
}
