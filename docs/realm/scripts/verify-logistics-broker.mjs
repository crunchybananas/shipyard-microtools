#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createResourceStock } from '../js/state.js?realm=198';
import {
  PHYSICAL_RESOURCE_KEYS,
  resourceCapacity,
} from '../js/building-inventory.js?realm=198';
import {
  availableResourceSpace,
  inboundResourceAmount,
  planResourceDelivery,
  rankResourceDestinations,
  resourceFlowReport,
} from '../js/logistics.js?realm=198';

function realm({ food = 100, population = 8 } = {}) {
  return {
    buildings: [],
    citizens: [],
    population,
    resources: createResourceStock({ food }),
  };
}

function addBuilding(state, type, x, y, {
  inventory = {},
  workforcePriority = undefined,
} = {}) {
  const building = {
    type,
    x,
    y,
    hp: 100,
    active: true,
    buildProgress: 1,
    buildTotal: 1,
    inventory: { ...inventory },
    ...(workforcePriority ? { workforcePriority } : {}),
  };
  state.buildings.push(building);
  return building;
}

let nextActorId = 1;

function citizen(state, x = 0, y = 0, {
  carrying = null,
  amount = 0,
  target = null,
} = {}) {
  const actor = {
    actorId: nextActorId++,
    x,
    y,
    carrying,
    carryAmount: amount,
    _deliveryTarget: target,
    assignment: null,
    activity: { kind: 'idle' },
  };
  state.citizens.push(actor);
  return actor;
}

function staff(state, building, { active = true } = {}) {
  const worker = citizen(state, building.x, building.y);
  worker.assignment = { building };
  worker.activity = { kind: active ? 'working' : 'idle' };
  return worker;
}

function straightRoute(sx, sy, ex, ey) {
  const path = [];
  let x = sx;
  let y = sy;
  while (x !== ex) {
    x += Math.sign(ex - x);
    path.push({ x, y });
  }
  while (y !== ey) {
    y += Math.sign(ey - y);
    path.push({ x, y });
  }
  return path;
}

function objectRoute(...args) {
  const path = straightRoute(...args.slice(0, 4));
  return { path, goal: path.at(-1) || { x: args[2], y: args[3] } };
}

assert.ok(PHYSICAL_RESOURCE_KEYS.includes('wheat'));
assert.ok(PHYSICAL_RESOURCE_KEYS.includes('flour'));

// One carrier's adopted intent consumes capacity before the next carrier is
// planned. The second whole payload must use storage rather than over-reserve
// the Windmill.
{
  const state = realm({ food: 0 });
  const mill = addBuilding(state, 'windmill', 2, 0, { workforcePriority: 'high' });
  const storage = addBuilding(state, 'storehouse', 3, 0);
  staff(state, mill);
  const capacity = resourceCapacity(mill, 'wheat');
  assert.ok(capacity >= 2, 'Windmill has no useful generic wheat capacity');
  const amount = capacity;
  const first = citizen(state, 0, 0, { carrying: 'wheat', amount });
  const second = citizen(state, 0, 0, { carrying: 'wheat', amount });
  const firstPlan = planResourceDelivery(first, 'wheat', { state, findRoute: objectRoute });
  assert.equal(firstPlan.building, mill, 'urgent first wheat load did not feed the staffed Windmill');
  first._deliveryTarget = firstPlan.building;
  assert.equal(inboundResourceAmount(mill, 'wheat', state), amount);
  assert.equal(availableResourceSpace(mill, 'wheat', state), 0);
  const secondPlan = planResourceDelivery(second, 'wheat', { state, findRoute: objectRoute });
  assert.equal(secondPlan.building, storage, 'second carrier over-reserved Windmill input capacity');
  assert.equal(
    rankResourceDestinations(second, 'wheat', { state, findRoute: objectRoute }).some(plan => plan.building === mill),
    false,
  );
}

// A carrier larger than the final free slots still receives a useful partial
// plan. Its full in-flight reservation conservatively closes the bin to the
// next carrier until the first payload splits at physical arrival.
{
  const state = realm({ food: 0 });
  const mill = addBuilding(state, 'windmill', 2, 0, { workforcePriority: 'high' });
  const storage = addBuilding(state, 'storehouse', 3, 0);
  staff(state, mill);
  const capacity = resourceCapacity(mill, 'wheat');
  mill.inventory.wheat = capacity - 2;
  state.resources.wheat = mill.inventory.wheat;
  const carrier = citizen(state, 0, 0, { carrying: 'wheat', amount: 5 });
  const partial = planResourceDelivery(carrier, 'wheat', { state, findRoute: objectRoute });
  assert.equal(partial.building, mill, 'positive converter space was discarded for an oversized batch');
  assert.equal(partial.free, 2);
  assert.equal(partial.requested, 5);
  assert.equal(partial.plannedAmount, 2);
  assert.match(partial.reasons.join(' | '), /partial delivery 2\/5/);
  carrier._deliveryTarget = mill;
  const follower = citizen(state, 0, 0, { carrying: 'wheat', amount: 1 });
  assert.equal(
    planResourceDelivery(follower, 'wheat', { state, findRoute: objectRoute }).building,
    storage,
    'full in-flight payload did not conservatively close the partial target',
  );
}

// A direct consumer that cannot be reached is not a candidate, even when it
// would otherwise have the highest production-chain utility.
{
  const state = realm({ food: 0 });
  const mill = addBuilding(state, 'windmill', 2, 0, { workforcePriority: 'high' });
  const storage = addBuilding(state, 'granary', 4, 0);
  staff(state, mill);
  const carrier = citizen(state, 0, 0, { carrying: 'wheat', amount: 1 });
  const oracle = (sx, sy, ex, ey) => ex === mill.x && ey === mill.y
    ? null
    : straightRoute(sx, sy, ex, ey);
  const ranked = rankResourceDestinations(carrier, 'wheat', { state, findRoute: oracle });
  assert.equal(ranked.some(plan => plan.building === mill), false, 'unreachable consumer survived ranking');
  assert.equal(ranked[0].building, storage);
}

// With equal staffing, stock, and priority, the real shorter route wins. One
// oracle result is an array and the other is {path, goal}; both contracts are
// normalized into immutable route diagnostics.
{
  const state = realm({ food: 20 });
  const near = addBuilding(state, 'windmill', 3, 0);
  const far = addBuilding(state, 'windmill', 9, 0);
  staff(state, near);
  staff(state, far);
  const carrier = citizen(state, 0, 0, { carrying: 'wheat', amount: 1 });
  const oracle = (sx, sy, ex, ey) => ex === near.x
    ? straightRoute(sx, sy, ex, ey)
    : objectRoute(sx, sy, ex, ey);
  const ranked = rankResourceDestinations(carrier, 'wheat', { state, findRoute: oracle });
  assert.equal(ranked[0].building, near, 'nearby useful consumer lost to a remote equivalent');
  assert.ok(ranked[0].routeCost < ranked[1].routeCost);
  assert.ok(Object.isFrozen(ranked) && Object.isFrozen(ranked[0]));
  assert.ok(Object.isFrozen(ranked[0].route) && Object.isFrozen(ranked[0].goal));
  assert.ok(Object.isFrozen(ranked[0].components) && Object.isFrozen(ranked[0].reasons));
}

// A long trip to an operating converter is normally worse than nearby bulk
// storage, but an acute downstream food shortage makes that conversion worth
// the travel. This proves urgency changes a choice instead of serving as a
// decorative explanation field.
{
  const state = realm({ food: 100, population: 8 });
  const storage = addBuilding(state, 'storehouse', 2, 0);
  const mill = addBuilding(state, 'windmill', 20, 0);
  staff(state, mill);
  const carrier = citizen(state, 0, 0, { carrying: 'wheat', amount: 1 });
  assert.equal(
    planResourceDelivery(carrier, 'wheat', { state, findRoute: objectRoute }).building,
    storage,
    'abundant realm ignored a much closer storage route',
  );
  state.resources.food = 0;
  const urgent = planResourceDelivery(carrier, 'wheat', { state, findRoute: objectRoute });
  assert.equal(urgent.building, mill, 'severe food shortage did not justify the farther consumer');
  assert.ok(urgent.components.downstream > 0);
  assert.match(urgent.reasons.join(' | '), /downstream food urgency/);
}

// Exact score ties resolve only by stable authoritative building order. A
// House never enters grain ranking, even when it is closer than either depot.
{
  const state = realm();
  const house = addBuilding(state, 'house', 1, 0);
  const first = addBuilding(state, 'storehouse', 4, 0);
  const second = addBuilding(state, 'storehouse', 0, 4);
  const carrier = citizen(state, 0, 0, { carrying: 'flour', amount: 1 });
  const once = rankResourceDestinations(carrier, 'flour', { state, findRoute: objectRoute });
  const twice = rankResourceDestinations(carrier, 'flour', { state, findRoute: objectRoute });
  assert.equal(once.some(plan => plan.building === house), false, 'House accepted grain delivery');
  assert.deepEqual(once.map(plan => plan.building), [first, second]);
  assert.deepEqual(twice.map(plan => plan.building), [first, second]);
  assert.equal(once[0].score, once[1].score);
  assert.ok(once[0].buildingIndex < once[1].buildingIndex);
}

// Reports are reference-free except for no mutable building pointer, deeply
// frozen at their diagnostic surfaces, and reconcile physical stock with
// in-flight reservations into the free capacity visible to the player.
{
  const state = realm();
  const mill = addBuilding(state, 'windmill', 5, 5, { inventory: { wheat: 2 } });
  staff(state, mill);
  citizen(state, 0, 0, { carrying: 'wheat', amount: 3, target: mill });
  const capacity = resourceCapacity(mill, 'wheat');
  const report = resourceFlowReport(mill, state);
  assert.deepEqual(
    {
      stored: report.resources.wheat.stored,
      capacity: report.resources.wheat.capacity,
      inbound: report.resources.wheat.inbound,
      free: report.resources.wheat.free,
      status: report.status,
      flowStatus: report.resources.wheat.status,
    },
    {
      stored: 2,
      capacity,
      inbound: 3,
      free: Math.max(0, capacity - 5),
      status: 'operational',
      flowStatus: capacity - 5 > 0 ? 'receiving' : 'full-or-reserved',
    },
  );
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.workforce));
  assert.ok(Object.isFrozen(report.resources));
  assert.ok(Object.isFrozen(report.resources.wheat));
}

console.log('[logistics-broker] PASS — capacity reservations, reachability, useful proximity, shortage utility, stable ties, grain exclusions, and frozen flow reports');
