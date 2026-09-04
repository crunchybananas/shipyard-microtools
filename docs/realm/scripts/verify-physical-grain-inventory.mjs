#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  MAP_H, MAP_W, TILE, createResourceStock,
} from '../js/state.js?realm=198';
import {
  PHYSICAL_RESOURCE_KEYS,
  canDepositFood,
  depositFood,
  depositFoodAcrossStores,
  depositResource,
  depositResourceAcrossStores,
  discardBuildingResources,
  establishFounderStockpile,
  findReachableFoodStore,
  findReachableResourceStore,
  foodCapacity,
  foodConservationReport,
  foodSpace,
  foodStores,
  isFoodStore,
  isResourceStore,
  relocateBuildingResources,
  resourceCapacity,
  resourceConservationReport,
  resourceSpace,
  resourceStores,
  storedFood,
  storedResource,
  withdrawFood,
  withdrawFoodFromStores,
  withdrawResource,
  withdrawResourceFromStores,
} from '../js/building-inventory.js?realm=198';

function completeBuilding(type, x, y, extras = {}) {
  return {
    type, x, y, hp: 100, active: true, prodTimer: 0, produced: null,
    prodShowCount: 0, level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, completeTick: 0, ...extras,
  };
}

function localState(buildings = [], resources = {}) {
  return { buildings, resources: createResourceStock(resources) };
}

// Every physical resource has an explicit, building-specific capacity. The
// founder exception remains food-only; its grain capacity is a normal
// Storehouse capacity.
{
  const house = completeBuilding('house', 0, 0);
  const granary = completeBuilding('granary', 1, 0);
  const storehouse = completeBuilding('storehouse', 2, 0);
  const founder = completeBuilding('storehouse', 3, 0, { founderStockpile: true });
  const windmill = completeBuilding('windmill', 4, 0);
  const bakery = completeBuilding('bakery', 5, 0);
  const incomplete = { ...completeBuilding('granary', 6, 0), buildProgress: 0.5 };
  const state = localState([house, granary, storehouse, founder, windmill, bakery, incomplete]);

  assert.deepEqual(PHYSICAL_RESOURCE_KEYS, ['food', 'wheat', 'flour']);
  assert.equal(resourceCapacity(house, 'food'), 8);
  assert.equal(resourceCapacity(granary, 'food'), 30);
  assert.equal(resourceCapacity(storehouse, 'food'), 40);
  assert.equal(resourceCapacity(founder, 'food'), 120);
  assert.equal(resourceCapacity(windmill, 'wheat'), 24);
  assert.equal(resourceCapacity(granary, 'wheat'), 60);
  assert.equal(resourceCapacity(storehouse, 'wheat'), 40);
  assert.equal(resourceCapacity(bakery, 'flour'), 18);
  assert.equal(resourceCapacity(granary, 'flour'), 30);
  assert.equal(resourceCapacity(storehouse, 'flour'), 40);
  assert.equal(resourceCapacity(founder, 'wheat'), 40);
  assert.equal(resourceCapacity(founder, 'flour'), 40);
  assert.equal(resourceCapacity(house, 'wheat'), 0);
  assert.equal(resourceCapacity(windmill, 'flour'), 0);
  assert.equal(isResourceStore(incomplete, 'wheat', state), false);
  assert.equal(resourceSpace(windmill, 'wheat', state), 24);
}

// Partial mutations change the physical count and its compatibility wallet by
// precisely the same amount. Generic inventories are allowed to omit a key
// after its count returns to zero.
{
  const windmill = completeBuilding('windmill', 0, 0);
  const bakery = completeBuilding('bakery', 1, 0);
  const storehouse = completeBuilding('storehouse', 2, 0);
  const state = localState([windmill, bakery, storehouse]);

  assert.deepEqual(depositResource(windmill, 'wheat', 30, state), {
    accepted: 24, remainder: 6, reason: 'storage-full',
  });
  assert.equal(state.resources.wheat, 24);
  assert.equal(storedResource(windmill, 'wheat'), 24);
  assert.deepEqual(withdrawResource(windmill, 'wheat', 10, state), {
    taken: 10, remainder: 0, reason: null,
  });
  assert.equal(state.resources.wheat, 14);
  assert.deepEqual(withdrawResource(windmill, 'wheat', 20, state), {
    taken: 14, remainder: 6, reason: 'storage-empty',
  });
  assert.equal(state.resources.wheat, 0);
  assert.equal(Object.hasOwn(windmill.inventory, 'wheat'), false);

  assert.deepEqual(depositResource(bakery, 'flour', 25, state), {
    accepted: 18, remainder: 7, reason: 'storage-full',
  });
  assert.deepEqual(depositResource(storehouse, 'food', 5, state), {
    accepted: 5, remainder: 0, reason: null,
  });
  assert.deepEqual(depositResource(storehouse, 'wheat', 7, state), {
    accepted: 7, remainder: 0, reason: null,
  });
  assert.deepEqual(depositResource(storehouse, 'flour', 9, state), {
    accepted: 9, remainder: 0, reason: null,
  });
  assert.deepEqual(
    { food: state.resources.food, wheat: state.resources.wheat, flour: state.resources.flour },
    { food: 5, wheat: 7, flour: 27 },
  );
  assert.equal(resourceConservationReport('food', state).conserved, true);
  assert.equal(resourceConservationReport('wheat', state).conserved, true);
  assert.equal(resourceConservationReport('flour', state).conserved, true);
}

// Realm-wide selection is deterministic by path distance then building order,
// and a reachability predicate excludes disconnected stores from both lookup
// and transfer.
{
  const first = completeBuilding('granary', 1, 0);
  const second = completeBuilding('granary', 0, 1);
  const remote = completeBuilding('storehouse', 5, 5);
  const state = localState([first, second, remote]);
  depositResource(first, 'wheat', 2, state);
  depositResource(second, 'wheat', 2, state);
  depositResource(remote, 'wheat', 2, state);

  assert.equal(findReachableResourceStore('wheat', { x: 0, y: 0 }, { state }), first);
  assert.equal(findReachableResourceStore('wheat', { x: 0, y: 0 }, {
    state,
    isReachable: building => building !== first,
  }), second);
  assert.equal(findReachableResourceStore('wheat', { x: 0, y: 0 }, {
    state,
    isReachable: () => false,
  }), null);
  assert.deepEqual(resourceStores('wheat', state, { withResource: true }), [first, second, remote]);
  assert.deepEqual(withdrawResourceFromStores('wheat', 5, {
    state,
    origin: { x: 0, y: 0 },
    isReachable: building => building !== remote,
  }), {
    taken: 4,
    remainder: 1,
    sources: [
      { type: 'granary', x: 1, y: 0, amount: 2 },
      { type: 'granary', x: 0, y: 1, amount: 2 },
    ],
  });
  assert.equal(state.resources.wheat, 2);
  assert.equal(storedResource(remote, 'wheat'), 2);

  const bakery = completeBuilding('bakery', 1, 1);
  state.buildings.push(bakery);
  assert.deepEqual(depositResourceAcrossStores('flour', 50, {
    state,
    origin: { x: 0, y: 0 },
    isReachable: building => building === bakery,
  }), {
    accepted: 18,
    remainder: 32,
    destinations: [{ type: 'bakery', x: 1, y: 1, amount: 18 }],
  });
  assert.equal(state.resources.flour, 18);
  assert.equal(resourceConservationReport('flour', state).conserved, true);
}

// Demolition primitives relocate each resource independently into compatible
// capacity, preserve the wallet while moving, then discard only overflow.
{
  const source = completeBuilding('storehouse', 0, 0);
  const pantry = completeBuilding('house', 1, 0);
  const windmill = completeBuilding('windmill', 0, 1);
  const bakery = completeBuilding('bakery', 1, 1);
  const state = localState([source, pantry, windmill, bakery]);

  depositResource(source, 'food', 5, state);
  depositResource(source, 'wheat', 10, state);
  depositResource(source, 'flour', 8, state);
  depositResource(pantry, 'food', 7, state);
  depositResource(windmill, 'wheat', 22, state);
  depositResource(bakery, 'flour', 15, state);
  const before = { food: state.resources.food, wheat: state.resources.wheat, flour: state.resources.flour };

  assert.deepEqual(relocateBuildingResources(source, state), {
    transferred: { food: 1, wheat: 2, flour: 3 },
    remainder: { food: 4, wheat: 8, flour: 5 },
  });
  assert.deepEqual(
    { food: state.resources.food, wheat: state.resources.wheat, flour: state.resources.flour },
    before,
    'relocation must not change compatibility mirrors',
  );
  assert.deepEqual(discardBuildingResources(source, state), { food: 4, wheat: 8, flour: 5 });
  assert.deepEqual(
    { food: state.resources.food, wheat: state.resources.wheat, flour: state.resources.flour },
    { food: 8, wheat: 24, flour: 18 },
  );
  assert.deepEqual(source.inventory, {});
  for (const resource of PHYSICAL_RESOURCE_KEYS) {
    assert.equal(resourceConservationReport(resource, state).conserved, true);
  }
}

// Legacy food calls retain their result shapes, food-only state compatibility,
// deterministic ordering, zero-key behavior, and conservation report shape.
{
  const house = completeBuilding('house', 1, 0);
  const granary = completeBuilding('granary', 0, 1);
  const state = { buildings: [house, granary], resources: { food: 0 } };

  assert.equal(foodCapacity(house), 8);
  assert.equal(isFoodStore(house, state), true);
  assert.equal(canDepositFood(house, 1, state), true);
  assert.deepEqual(depositFoodAcrossStores(41, { state, origin: { x: 0, y: 0 } }), {
    accepted: 38,
    remainder: 3,
    destinations: [
      { type: 'house', x: 1, y: 0, amount: 8 },
      { type: 'granary', x: 0, y: 1, amount: 30 },
    ],
  });
  assert.equal(storedFood(house), 8);
  assert.equal(foodSpace(house, state), 0);
  assert.equal(findReachableFoodStore({ x: 0, y: 0 }, { state }), house);
  assert.deepEqual(foodStores(state, { withFood: true }), [house, granary]);
  assert.deepEqual(withdrawFoodFromStores(9, { state, origin: { x: 0, y: 0 } }), {
    taken: 9,
    remainder: 0,
    sources: [
      { type: 'house', x: 1, y: 0, amount: 8 },
      { type: 'granary', x: 0, y: 1, amount: 1 },
    ],
  });
  assert.deepEqual(house.inventory, { food: 0 }, 'legacy food withdrawals retain their zero key');
  assert.deepEqual(withdrawFood(granary, 30, state), {
    taken: 29, remainder: 1, reason: 'storage-empty',
  });
  assert.deepEqual(depositFood(house, 0, state), {
    accepted: 0, remainder: 0, reason: 'storage-full',
  });
  assert.deepEqual(foodConservationReport(state), {
    wallet: 0, stored: 0, delta: 0, conserved: true, invalid: [],
  });
}

// Founder initialization marks both physical-food compatibility and the wider
// supply-web foundation, including when an already valid founder is revisited.
{
  const state = {
    buildings: [],
    resources: { food: 9 },
    storyFlags: {},
    map: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS)),
    buildingGrid: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null)),
    obstacleEpoch: 0,
  };
  const founder = establishFounderStockpile(state);
  assert.equal(storedFood(founder), 9);
  assert.equal(state.storyFlags.physicalFoodInventory, true);
  assert.equal(state.storyFlags.physicalSupplyWeb, true);
  delete state.storyFlags.physicalSupplyWeb;
  assert.equal(establishFounderStockpile(state), founder);
  assert.equal(state.storyFlags.physicalSupplyWeb, true);
}

console.log('[physical-grain-inventory] OK — capacities, partial transfer, exact mirrors, reachability, relocation/discard, founder flag, and food compatibility');
