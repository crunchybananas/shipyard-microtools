// Deterministic production-delivery broker.
//
// The broker owns no simulation state. It derives capacity reservations from
// citizens' existing delivery intents, asks the shared pathfinder (or an
// injected route oracle) for real routes, and returns frozen, explainable
// plans. Callers remain responsible for adopting a plan by setting the
// citizen's _deliveryTarget and route state.

import { G, BUILDINGS } from './state.js?realm=198';
import { findPath } from './pathfinding.js?realm=198';
import {
  PHYSICAL_RESOURCE_KEYS,
  isResourceStore,
  resourceCapacity,
  resourceSpace,
  storedResource,
} from './building-inventory.js?realm=198';

const PHYSICAL_RESOURCE_SET = new Set(PHYSICAL_RESOURCE_KEYS);
const CHAIN_INPUTS = new Set(['wheat', 'flour']);
const CHAIN_STORAGE_TYPES = new Set(['granary', 'storehouse']);
const WORKFORCE_SCORE = Object.freeze({ high: 120, normal: 0, low: -80, off: -400 });

function assertState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.buildings) || !Array.isArray(state.citizens)) {
    throw new TypeError('Logistics requires a realm state with buildings and citizens.');
  }
}

function assertResourceKey(key) {
  if (!PHYSICAL_RESOURCE_SET.has(key)) {
    throw new TypeError(`Logistics requires a physical resource key: ${String(key)}`);
  }
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function carriedAmount(citizen) {
  return nonNegativeInteger(citizen?.carryAmount);
}

function isLiveComplete(building, state) {
  return !!building
    && state.buildings.includes(building)
    && building.active === true
    && building.buildProgress >= 1;
}

function directConverter(building, key) {
  return BUILDINGS[building?.type]?.convert?.from === key;
}

function workforceSnapshot(building, state) {
  const required = BUILDINGS[building?.type]?.workers || 0;
  const assigned = state.citizens.filter(citizen => citizen?.assignment?.building === building).length;
  const active = state.citizens.filter(citizen => (
    citizen?.assignment?.building === building
    && citizen.activity?.kind === 'working'
  )).length;
  const priority = building?.workforcePriority ?? 'normal';
  return Object.freeze({
    required,
    assigned,
    active,
    staffed: required === 0 || assigned >= required,
    operational: isLiveComplete(building, state) && (required === 0 || active >= required),
    priority: Object.hasOwn(WORKFORCE_SCORE, priority) ? priority : 'normal',
  });
}

function buildingStatus(building, state, workforce = workforceSnapshot(building, state)) {
  if (!state.buildings.includes(building) || building.active !== true) return 'inactive';
  if (building.buildProgress < 1) return 'under-construction';
  if (building.onFire) return 'on-fire';
  if (workforce.required > 0 && !workforce.staffed) return 'unstaffed';
  if (workforce.required > 0 && !workforce.operational) return 'off-duty';
  return 'operational';
}

function fixedRatio(numerator, denominator, scale = 1000) {
  if (!(denominator > 0)) return 0;
  return Math.max(0, Math.min(scale, Math.floor((numerator * scale) / denominator)));
}

function foodUrgency(state) {
  const population = Math.max(1, nonNegativeInteger(state.population) || state.citizens.length || 1);
  const target = Math.max(8, population * 3);
  const food = Math.max(0, Math.floor(Number(state.resources?.food) || 0));
  return fixedRatio(Math.max(0, target - food), target);
}

function freezePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Route points require finite x/y coordinates.');
  }
  return Object.freeze({ x: point.x, y: point.y });
}

function routeCost(path, start) {
  let x = start.x;
  let y = start.y;
  let cost = 0;
  for (const point of path) {
    const dx = Math.abs(point.x - x);
    const dy = Math.abs(point.y - y);
    // Fixed-point octile length: orthogonal=10, diagonal=14. This uses the
    // actual route returned by the oracle, never endpoint Manhattan distance.
    cost += Math.round(Math.min(dx, dy) * 14 + Math.abs(dx - dy) * 10);
    x = point.x;
    y = point.y;
  }
  return cost;
}

function normalizeRoute(result, citizen, building) {
  if (result === null || result === undefined || result === false) return null;
  const sourcePath = Array.isArray(result) ? result : result.path;
  if (!Array.isArray(sourcePath)) {
    throw new TypeError('A logistics route must be a path array, { path, goal }, or null.');
  }
  const sourceGoal = (!Array.isArray(result) && result.goal)
    || sourcePath.goal
    || sourcePath[sourcePath.length - 1]
    || building;
  const path = Object.freeze(sourcePath.map(freezePoint));
  const goal = freezePoint(sourceGoal);
  return Object.freeze({
    path,
    goal,
    cost: routeCost(path, citizen),
  });
}

function routeTo(citizen, building, key, state, oracle) {
  if (!oracle && state !== G) {
    throw new TypeError('Injected realm states require an injected logistics findRoute oracle.');
  }
  const routeFinder = oracle || findPath;
  // The first four arguments intentionally mirror findPath. Extra context is
  // available to an injected oracle without complicating the default path.
  return normalizeRoute(routeFinder(
    citizen.x,
    citizen.y,
    building.x,
    building.y,
    citizen,
    building,
    key,
    state,
  ), citizen, building);
}

function isCandidate(building, key, state) {
  if (!isLiveComplete(building, state) || !isResourceStore(building, key, state)) return false;
  if (!CHAIN_INPUTS.has(key)) return true;
  // Grain belongs in its production chain or public bulk storage. Private
  // House pantries are intentionally never treated as wheat/flour depots.
  return directConverter(building, key) || CHAIN_STORAGE_TYPES.has(building.type);
}

function componentScore({
  role,
  route,
  shortage,
  inbound,
  operation,
  staffing,
  workforce,
  downstream,
}) {
  return role + route + shortage + inbound + operation + staffing + workforce + downstream;
}

function reasonList({
  building,
  key,
  role,
  stored,
  capacity,
  inbound,
  free,
  requested,
  plannedAmount,
  route,
  workforce,
  urgency,
  components,
}) {
  const reasons = [
    role === 'converter'
      ? `${building.type} directly consumes ${key}`
      : `${building.type} is fallback bulk storage`,
    `route cost ${route.cost}`,
    `${stored}/${capacity} stored; ${inbound} inbound; ${free} free`,
  ];
  if (plannedAmount < requested) reasons.push(`partial delivery ${plannedAmount}/${requested}`);
  if (role === 'converter') {
    reasons.push(workforce.operational
      ? `operational with ${workforce.active}/${workforce.required} active workers`
      : `${buildingStatus(building, { buildings: [building] }, workforce)} with ${workforce.active}/${workforce.required} active workers`);
    reasons.push(`${workforce.priority} workforce priority`);
    reasons.push(`downstream food urgency ${urgency}/1000`);
  }
  reasons.push(`score ${componentScore(components)}`);
  return Object.freeze(reasons);
}

export function inboundResourceAmount(building, key, state = G, {
  excludeCitizen = null,
} = {}) {
  assertState(state);
  assertResourceKey(key);
  let inbound = 0;
  for (const citizen of state.citizens) {
    if (citizen === excludeCitizen) continue;
    if (citizen?.carrying !== key || citizen._deliveryTarget !== building) continue;
    inbound += carriedAmount(citizen);
  }
  if (!Number.isSafeInteger(inbound)) throw new RangeError('Inbound resource reservation exceeds safe integer range.');
  return inbound;
}

export function availableResourceSpace(building, key, state = G, {
  excludeCitizen = null,
} = {}) {
  assertState(state);
  assertResourceKey(key);
  return Math.max(
    0,
    resourceSpace(building, key, state)
      - inboundResourceAmount(building, key, state, { excludeCitizen }),
  );
}

export function rankResourceDestinations(citizen, key, {
  state = G,
  isBlacklisted = () => false,
  findRoute = null,
} = {}) {
  assertState(state);
  assertResourceKey(key);
  if (!citizen || !Number.isFinite(citizen.x) || !Number.isFinite(citizen.y)) {
    throw new TypeError('Logistics ranking requires a citizen with finite x/y coordinates.');
  }
  if (typeof isBlacklisted !== 'function') throw new TypeError('isBlacklisted must be a function.');
  if (findRoute !== null && typeof findRoute !== 'function') throw new TypeError('findRoute must be a function or null.');

  const requested = Math.max(1, carriedAmount(citizen));
  const urgency = CHAIN_INPUTS.has(key) ? foodUrgency(state) : 0;
  const ranked = [];

  state.buildings.forEach((building, buildingIndex) => {
    if (!isCandidate(building, key, state)) return;
    if (isBlacklisted(building, citizen, key)) return;

    const capacity = resourceCapacity(building, key);
    const stored = storedResource(building, key);
    const inbound = inboundResourceAmount(building, key, state, { excludeCitizen: citizen });
    const free = availableResourceSpace(building, key, state, { excludeCitizen: citizen });
    if (!(capacity > 0) || free <= 0) return;
    // A live carrier can use the last slots in a bin and route its remainder
    // elsewhere after arrival. Reservations still count its full cargo, which
    // conservatively closes this target to later plans until that split lands.
    const plannedAmount = Math.min(requested, free);

    const route = routeTo(citizen, building, key, state, findRoute);
    if (!route) return;

    const role = directConverter(building, key) ? 'converter' : 'storage';
    const workforce = workforceSnapshot(building, state);
    const shortagePermille = fixedRatio(free, capacity);
    const inboundPermille = fixedRatio(inbound, capacity);
    const components = Object.freeze({
      role: role === 'converter' ? 260 : 120,
      route: -route.cost * 3,
      shortage: role === 'converter'
        ? Math.floor(shortagePermille * 180 / 1000)
        : Math.floor(shortagePermille * 60 / 1000),
      inbound: -Math.floor(inboundPermille * 180 / 1000),
      operation: role === 'converter' ? (workforce.operational ? 160 : -180) : 0,
      staffing: role === 'converter'
        ? (workforce.required > 0 ? Math.floor(workforce.active * 80 / workforce.required) : 80)
        : 0,
      workforce: role === 'converter' ? WORKFORCE_SCORE[workforce.priority] : 0,
      downstream: role === 'converter' ? Math.floor(urgency * 520 / 1000) : 0,
    });
    const score = componentScore(components);
    const reasons = reasonList({
      building,
      key,
      role,
      stored,
      capacity,
      inbound,
      free,
      requested,
      plannedAmount,
      route,
      workforce,
      urgency,
      components,
    });
    ranked.push(Object.freeze({
      building,
      buildingIndex,
      key,
      role,
      score,
      routeCost: route.cost,
      route: route.path,
      goal: route.goal,
      stored,
      capacity,
      inbound,
      free,
      requested,
      plannedAmount,
      status: buildingStatus(building, state, workforce),
      workforce,
      downstreamFoodUrgency: urgency,
      components,
      reasons,
    }));
  });

  ranked.sort((a, b) => b.score - a.score || a.buildingIndex - b.buildingIndex);
  return Object.freeze(ranked);
}

export function planResourceDelivery(citizen, key, options = {}) {
  return rankResourceDestinations(citizen, key, options)[0] || null;
}

export function resourceFlowReport(building, state = G) {
  assertState(state);
  if (!building || typeof building !== 'object') {
    throw new TypeError('Resource flow reporting requires a building.');
  }
  const buildingIndex = state.buildings.indexOf(building);
  const workforce = workforceSnapshot(building, state);
  const resources = {};
  for (const key of PHYSICAL_RESOURCE_KEYS) {
    const capacity = resourceCapacity(building, key);
    const stored = storedResource(building, key);
    const inbound = inboundResourceAmount(building, key, state);
    const free = availableResourceSpace(building, key, state);
    resources[key] = Object.freeze({
      key,
      stored,
      capacity,
      inbound,
      free,
      status: capacity <= 0
        ? 'unsupported'
        : free <= 0 ? 'full-or-reserved' : inbound > 0 ? 'receiving' : stored > 0 ? 'stocked' : 'empty',
    });
  }
  return Object.freeze({
    buildingIndex,
    type: building.type || null,
    x: Number.isFinite(building.x) ? building.x : null,
    y: Number.isFinite(building.y) ? building.y : null,
    status: buildingStatus(building, state, workforce),
    workforce,
    resources: Object.freeze(resources),
  });
}
