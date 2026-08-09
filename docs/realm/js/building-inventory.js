// Authoritative physical food inventory.
//
// G.resources.food remains the compatibility wallet used by existing UI and
// affordability checks, but it is an exact aggregate mirror of food stored in
// live completed House pantries, Granaries, and Storehouses. Food in a
// producer's output buffer or a citizen's hands is not wallet-owned until a
// physical deposit succeeds.

import { G, BUILDINGS, MAP_W, MAP_H, TILE } from './state.js?realm=191';

const FOOD_STORE_TYPES = new Set(['house', 'granary', 'storehouse']);

export const FOOD_STORAGE_CAPACITY = Object.freeze({
  house: 8,
  granary: 30,
  storehouse: 40,
  founderStockpile: 120,
});

function assertState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.buildings)) {
    throw new TypeError('Food inventory requires a realm state with buildings.');
  }
  if (!state.resources || typeof state.resources.food !== 'number' || !Number.isFinite(state.resources.food)) {
    throw new TypeError('Food inventory requires a finite global food mirror.');
  }
}

function assertAmount(amount, label = 'Food amount') {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

function inventoryFood(building) {
  const amount = building?.inventory?.food;
  if (amount === undefined) return 0;
  assertAmount(amount, 'Stored food');
  return amount;
}

function isLiveCompleted(building, state) {
  return !!building
    && state.buildings.includes(building)
    && building.active === true
    && building.buildProgress >= 1;
}

function sortedFoodStores(origin, state, predicate, isReachable) {
  const ox = Number.isFinite(origin?.x) ? origin.x : 0;
  const oy = Number.isFinite(origin?.y) ? origin.y : 0;
  return state.buildings
    .map((building, index) => ({ building, index }))
    .filter(({ building }) => (
      isFoodStore(building, state)
      && predicate(building)
      && isReachable(building, origin)
    ))
    .sort((a, b) => (
      Math.abs(a.building.x - ox) + Math.abs(a.building.y - oy)
      - Math.abs(b.building.x - ox) - Math.abs(b.building.y - oy)
      || a.index - b.index
    ))
    .map(entry => entry.building);
}

function mutationResult(values) {
  return Object.freeze(values);
}

export function foodCapacity(building) {
  if (!building || !FOOD_STORE_TYPES.has(building.type)) return 0;
  if (building.type === 'storehouse' && building.founderStockpile === true) {
    return FOOD_STORAGE_CAPACITY.founderStockpile;
  }
  return FOOD_STORAGE_CAPACITY[building.type] || BUILDINGS[building.type]?.foodStore || 0;
}

export function authoredBuildingCount(state = G) {
  return (state.buildings || []).reduce(
    (count, building) => count + (building.founderStockpile === true ? 0 : 1),
    0,
  );
}

export function isFoodStore(building, state = G) {
  return FOOD_STORE_TYPES.has(building?.type)
    && isLiveCompleted(building, state)
    && foodCapacity(building) > 0;
}

export function storedFood(building) {
  return inventoryFood(building);
}

export function foodSpace(building, state = G) {
  if (!isFoodStore(building, state)) return 0;
  return Math.max(0, foodCapacity(building) - storedFood(building));
}

export function canDepositFood(building, requested = 1, state = G) {
  assertAmount(requested, 'Requested food deposit');
  return isFoodStore(building, state) && requested > 0 && foodSpace(building, state) > 0;
}

export function depositFood(building, requested, state = G) {
  assertState(state);
  assertAmount(requested, 'Requested food deposit');
  if (!isFoodStore(building, state)) {
    return mutationResult({ accepted: 0, remainder: requested, reason: 'invalid-store' });
  }
  const accepted = Math.min(requested, foodSpace(building, state));
  if (accepted <= 0) {
    return mutationResult({ accepted: 0, remainder: requested, reason: 'storage-full' });
  }
  building.inventory ||= { food: 0 };
  if (!Object.hasOwn(building.inventory, 'food')) building.inventory.food = 0;
  building.inventory.food = storedFood(building) + accepted;
  state.resources.food += accepted;
  return mutationResult({
    accepted,
    remainder: requested - accepted,
    reason: accepted === requested ? null : 'storage-full',
  });
}

export function withdrawFood(building, requested, state = G) {
  assertState(state);
  assertAmount(requested, 'Requested food withdrawal');
  if (!isFoodStore(building, state)) {
    return mutationResult({ taken: 0, remainder: requested, reason: 'invalid-store' });
  }
  const taken = Math.min(requested, storedFood(building));
  if (taken <= 0) {
    return mutationResult({ taken: 0, remainder: requested, reason: 'storage-empty' });
  }
  if (state.resources.food < taken) {
    throw new Error('Food mirror is lower than the physical withdrawal.');
  }
  building.inventory.food -= taken;
  state.resources.food -= taken;
  return mutationResult({
    taken,
    remainder: requested - taken,
    reason: taken === requested ? null : 'storage-empty',
  });
}

export function foodStores(state = G, {
  withFood = false,
  withSpace = false,
} = {}) {
  assertState(state);
  return Object.freeze(state.buildings.filter(building => (
    isFoodStore(building, state)
    && (!withFood || storedFood(building) > 0)
    && (!withSpace || foodSpace(building, state) > 0)
  )));
}

export function findReachableFoodStore(origin, {
  mode = 'withdraw',
  isReachable = () => true,
  state = G,
} = {}) {
  assertState(state);
  if (mode !== 'withdraw' && mode !== 'deposit') {
    throw new TypeError(`Unknown food store lookup mode: ${mode}`);
  }
  if (typeof isReachable !== 'function') throw new TypeError('Food reachability must be a function.');
  const predicate = mode === 'withdraw'
    ? building => storedFood(building) > 0
    : building => foodSpace(building, state) > 0;
  return sortedFoodStores(origin, state, predicate, isReachable)[0] || null;
}

export function withdrawFoodFromStores(requested, {
  origin = null,
  isReachable = () => true,
  state = G,
} = {}) {
  assertState(state);
  assertAmount(requested, 'Requested realm food withdrawal');
  if (typeof isReachable !== 'function') throw new TypeError('Food reachability must be a function.');
  let remainder = requested;
  const sources = [];
  const stores = sortedFoodStores(
    origin,
    state,
    building => storedFood(building) > 0,
    isReachable,
  );
  for (const building of stores) {
    if (remainder <= 0) break;
    const result = withdrawFood(building, remainder, state);
    if (result.taken <= 0) continue;
    sources.push(Object.freeze({
      type: building.type,
      x: building.x,
      y: building.y,
      amount: result.taken,
    }));
    remainder = result.remainder;
  }
  return mutationResult({
    taken: requested - remainder,
    remainder,
    sources: Object.freeze(sources),
  });
}

export function depositFoodAcrossStores(requested, {
  origin = null,
  isReachable = () => true,
  state = G,
} = {}) {
  assertState(state);
  assertAmount(requested, 'Requested realm food deposit');
  if (typeof isReachable !== 'function') throw new TypeError('Food reachability must be a function.');
  let remainder = requested;
  const destinations = [];
  const stores = sortedFoodStores(
    origin,
    state,
    building => foodSpace(building, state) > 0,
    isReachable,
  );
  for (const building of stores) {
    if (remainder <= 0) break;
    const result = depositFood(building, remainder, state);
    if (result.accepted <= 0) continue;
    destinations.push(Object.freeze({
      type: building.type,
      x: building.x,
      y: building.y,
      amount: result.accepted,
    }));
    remainder = result.remainder;
  }
  return mutationResult({
    accepted: requested - remainder,
    remainder,
    destinations: Object.freeze(destinations),
  });
}

// Bootstrap adopts food already present in the compatibility wallet. Unlike a
// delivery, seeding must not increment that wallet a second time.
export function seedBuildingFood(building, amount, state = G) {
  assertState(state);
  assertAmount(amount, 'Seed food');
  if (!isFoodStore(building, state)) throw new Error('Seed food requires a live completed food store.');
  if (storedFood(building) !== 0) throw new Error('Seed food requires an empty building inventory.');
  if (amount > foodCapacity(building)) throw new RangeError('Seed food exceeds building capacity.');
  if (amount > state.resources.food) throw new RangeError('Seed food exceeds the global compatibility wallet.');
  building.inventory = { food: amount };
  return amount;
}

// Fresh realms gain one deterministic, free stockpile near the founder's
// clearing. This is initialization, never save migration: current saves are
// already physical and incompatible development saves reject at validation.
export function establishFounderStockpile(state = G) {
  assertState(state);
  state.storyFlags ||= {};
  const existing = state.buildings.find(candidate => candidate.founderStockpile === true) || null;
  if (existing) {
    if (state.storyFlags.physicalFoodInventory !== true || !foodConservationReport(state).conserved) {
      throw new Error('Founder stockpile is not a valid current physical-food realm.');
    }
    return existing;
  }
  if (state.storyFlags.physicalFoodInventory === true || state.buildings.some(store => store.inventory !== undefined)) {
    throw new Error('Founder stockpile initialization requires an uninitialized fresh realm.');
  }
  const startingFood = state.resources.food;
  assertAmount(startingFood, 'Starting food');
  if (startingFood > FOOD_STORAGE_CAPACITY.founderStockpile) {
    throw new RangeError('Starting food exceeds founder stockpile capacity.');
  }

  const centerX = Math.floor(MAP_W / 2);
  const centerY = Math.floor(MAP_H / 2);
  const candidates = [{ x: centerX + 3, y: centerY }];
  for (let radius = 1; radius <= 8; radius++) {
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        if (Math.abs(x - centerX) + Math.abs(y - centerY) !== radius) continue;
        candidates.push({ x, y });
      }
    }
  }
  const site = candidates.find(({ x, y }) => (
    x >= 0 && x < MAP_W && y >= 0 && y < MAP_H
    && state.map?.[y]?.[x] !== TILE.WATER
    && state.map?.[y]?.[x] !== TILE.MOUNTAIN
    && !state.buildingGrid[y]?.[x]
  ));
  if (!site) throw new Error('No valid tile remains for the founder stockpile.');

  const building = {
    type: 'storehouse', x: site.x, y: site.y, hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0, level: 1,
    buildProgress: 1, buildTotal: 1, buildStartedAt: 0, completeTick: 0,
    founderStockpile: true,
  };
  state.buildings.push(building);
  state.buildingGrid[site.y][site.x] = building;
  state.obstacleEpoch = (state.obstacleEpoch || 0) + 1;
  seedBuildingFood(building, startingFood, state);
  state.storyFlags.physicalFoodInventory = true;
  return building;
}

export function discardBuildingFood(building, state = G) {
  const amount = storedFood(building);
  if (amount <= 0) return 0;
  return withdrawFood(building, amount, state).taken;
}

export function relocateBuildingFood(building, state = G) {
  assertState(state);
  const original = storedFood(building);
  let remainder = original;
  const destinations = sortedFoodStores(
    building,
    state,
    candidate => candidate !== building && foodSpace(candidate, state) > 0,
    () => true,
  );
  for (const destination of destinations) {
    if (remainder <= 0) break;
    const moved = Math.min(remainder, foodSpace(destination, state));
    if (moved <= 0) continue;
    withdrawFood(building, moved, state);
    depositFood(destination, moved, state);
    remainder -= moved;
  }
  return mutationResult({ transferred: original - remainder, remainder });
}

export function foodConservationReport(state = G) {
  assertState(state);
  let stored = 0;
  const invalid = [];
  for (const building of state.buildings) {
    if (building.inventory === undefined) continue;
    try {
      const amount = storedFood(building);
      if (!isFoodStore(building, state) || amount > foodCapacity(building)) {
        invalid.push(Object.freeze({ type: building.type, x: building.x, y: building.y, amount }));
      }
      stored += amount;
    } catch (_error) {
      invalid.push(Object.freeze({ type: building.type, x: building.x, y: building.y, amount: null }));
    }
  }
  const wallet = state.resources.food;
  return Object.freeze({
    wallet,
    stored,
    delta: wallet - stored,
    conserved: invalid.length === 0 && wallet === stored,
    invalid: Object.freeze(invalid),
  });
}
