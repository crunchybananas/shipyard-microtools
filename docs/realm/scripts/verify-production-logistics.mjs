#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G,
  MAP_H,
  MAP_W,
  TILE,
  createResourceStock,
  setSeed,
} from '../js/state.js?realm=198';
import { makeCitizen } from '../js/world.js?realm=198';
import { updateCitizens } from '../js/citizens.js?realm=198';
import { updateProduction } from '../js/economy.js?realm=198';
import { removeBuilding } from '../js/building-lifecycle.js?realm=198';
import {
  PHYSICAL_RESOURCE_KEYS,
  resourceCapacity,
  storedResource,
} from '../js/building-inventory.js?realm=198';
import {
  claimCitizenAssignment,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=198';
import { setCitizenActivity } from '../js/citizen-activity.js?realm=198';
import { clearCitizenPath } from '../js/citizen-navigation.js?realm=198';
import { resetPathfindingService } from '../js/pathfinding-service.js?realm=198';

function stats() {
  return {
    buildingsBuilt: 0,
    buildingsLost: 0,
    raidsFaced: 0,
    citizensBorn: 0,
    citizensDied: 0,
    raidsSurvived: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    daysLived: 0,
    housesEvolved: 0,
    scenariosWon: [],
    everHadBuilding: {},
  };
}

function resetWorld(seed = 197_061) {
  resetPathfindingService();
  resetCitizenOwnershipRuntime();
  setSeed(seed);
  Object.assign(G, {
    map: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS)),
    fog: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true)),
    buildingGrid: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null)),
    buildings: [],
    citizens: [],
    nextActorId: 1,
    soldiers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    caravans: [],
    walkers: [],
    animals: [],
    resources: createResourceStock(),
    resourceRates: createResourceStock(),
    population: 0,
    maxPop: 20,
    happiness: 50,
    defense: 0,
    day: 2,
    dayPhase: 1_800,
    dayLength: 3_600,
    gameTick: 100,
    speed: 1,
    obstacleEpoch: 1,
    tileWear: null,
    season: 'spring',
    weather: 'clear',
    difficulty: 'normal',
    scenario: 'peaceful_start',
    researchedTechs: new Set(['agriculture', 'forestry']),
    currentResearch: null,
    eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
    activeEvent: null,
    stats: stats(),
    storyFlags: { physicalFoodInventory: true, physicalSupplyWeb: true },
    storyState: { lastProverbSeason: null, raid: null },
    namedCharacters: {},
    totalResourcesGathered: 0,
    avatar: null,
    wonder: null,
    selectedBuilding: null,
    _refreshPanelFor: null,
    _undoStack: [],
    _dailyFoodConsumed: 0,
    _patrolPosts: null,
    _patrolPostsBuildingCount: -1,
  });
  G.debug.disableEvents = true;
}

function addBuilding(type, x, y, extra = {}) {
  const building = {
    type,
    x,
    y,
    hp: 100,
    active: true,
    prodTimer: 0,
    produced: null,
    prodShowCount: 0,
    level: 1,
    buildProgress: 1,
    buildTotal: 1,
    buildStartedAt: 0,
    inventory: {},
    ...extra,
  };
  G.buildings.push(building);
  G.buildingGrid[y][x] = building;
  return building;
}

function addCitizen(name, x, y) {
  const citizen = makeCitizen(x, y);
  citizen.identity.name = name;
  citizen._hb = 7;
  citizen.hunger = 0;
  citizen.rest = 100;
  citizen.needs.joy = 80;
  citizen.needs.faith = 80;
  citizen.activityTimer = 10_000;
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function staff(building, name = `${building.type} worker`) {
  const worker = addCitizen(name, building.x - 1, building.y);
  claimCitizenAssignment(worker, building, { reason: 'job-market' });
  transitionCitizenActivity(worker, 'working', 'arrived-at-work');
  worker.activityTimer = 10_000;
  return worker;
}

function giveCargo(citizen, resource, amount, target = null) {
  citizen.carrying = resource;
  citizen.carryAmount = amount;
  citizen._deliveryTarget = target;
  clearCitizenPath(citizen);
  setCitizenActivity(citizen, target ? 'walk_to_deliver' : 'needs_delivery', {
    reason: target ? 'route-to-delivery' : 'cargo-ready',
    timer: 0,
  });
}

function tick(count = 1) {
  for (let index = 0; index < count; index++) {
    G.gameTick++;
    updateCitizens();
  }
}

function deliverNow(citizen) {
  const target = citizen._deliveryTarget;
  assert.ok(target, `${citizen.identity.name} has no delivery target`);
  clearCitizenPath(citizen);
  citizen.x = target.x - 1;
  citizen.y = target.y;
  citizen.tx = citizen.x;
  citizen.ty = citizen.y;
  setCitizenActivity(citizen, 'deliver', { reason: 'cargo-delivered', timer: 0 });
  tick();
}

assert.deepEqual(PHYSICAL_RESOURCE_KEYS, ['food', 'wheat', 'flour']);

// Live adoption and physical arrival: the state machine takes a real Farm
// batch, adopts the staffed Windmill only after pathTo accepts its approach,
// and credits both the local bin and compatibility mirror on arrival.
resetWorld();
const farm = addBuilding('farm', 10, 10, { produced: { wheat: 3 } });
const mill = addBuilding('windmill', 14, 10, { workforcePriority: 'high' });
const bakery = addBuilding('bakery', 18, 10, { workforcePriority: 'high' });
const farmer = staff(farm, 'Farm handoff');
const miller = staff(mill, 'Mill handoff');
const baker = staff(bakery, 'Bakery handoff');
farmer.activityTimer = 0;
tick();
assert.equal(farmer.carrying, 'wheat');
assert.equal(farmer.carryAmount, 3);
assert.equal(farmer._deliveryTarget, mill, 'Farm wheat did not adopt the live Windmill');
assert.equal(farmer.activity.kind, 'walk_to_deliver');
assert.ok(farmer._pathRequest, 'broker target was adopted without an accepted path request');
assert.equal(storedResource(mill, 'wheat'), 0, 'wheat arrived before its carrier');
assert.equal(G.resources.wheat, 0, 'wheat mirror changed before physical arrival');

deliverNow(farmer);
assert.equal(storedResource(mill, 'wheat'), 3);
assert.equal(G.resources.wheat, 3);
assert.equal(G.totalResourcesGathered, 3);
assert.equal(farmer.carrying, null);

// The same physical stock feeds the real conversion cycle, whose flour batch
// is then picked up and brokered to the Bakery rather than credited remotely.
mill.prodTimer = Math.floor(G.dayLength / 5) - 1;
updateProduction();
assert.equal(storedResource(mill, 'wheat'), 0, 'Windmill did not consume its delivered wheat bin');
assert.equal(G.resources.wheat, 0, 'wheat mirror did not follow Windmill consumption');
assert.deepEqual(mill.produced, { flour: 3 });
assert.equal(G.resources.flour, 0, 'Windmill output entered the mirror before hauling');
miller.activityTimer = 0;
miller.tx = miller.x;
miller.ty = miller.y;
tick();
assert.equal(miller.carrying, 'flour');
assert.equal(miller.carryAmount, 3);
assert.equal(miller._deliveryTarget, bakery, 'Windmill flour did not adopt the live Bakery');
assert.ok(miller._pathRequest, 'Bakery target was adopted without an accepted path request');
deliverNow(miller);
assert.equal(storedResource(bakery, 'flour'), 3);
assert.equal(G.resources.flour, 3);
assert.equal(G.totalResourcesGathered, 6);
baker.activityTimer = 10_000;

// A saturated or absent grain network leaves raw output at the producer. The
// worker still skips that blocked wheat to carry a routable ration, then can
// go home and sleep instead of becoming a permanently hungry cargo actor.
resetWorld(197_069);
const bufferedFarm = addBuilding('farm', 10, 10, {
  produced: { wheat: 4, food: 1 },
});
const workerHome = addBuilding('house', 12, 10, { inventory: { food: 0 } });
const bufferedFarmer = staff(bufferedFarm, 'Buffered farmer');
bufferedFarmer.home = workerHome;
bufferedFarmer.activityTimer = 0;
tick();
assert.equal(bufferedFarmer.carrying, 'food', 'blocked wheat prevented a routable ration pickup');
assert.equal(bufferedFarmer.carryAmount, 1);
assert.deepEqual(bufferedFarm.produced, { wheat: 4 }, 'unroutable wheat left its physical producer');
deliverNow(bufferedFarmer);
assert.equal(storedResource(workerHome, 'food'), 1);
setCitizenActivity(bufferedFarmer, 'working', { reason: 'arrived-at-work', timer: 0 });
bufferedFarmer.x = bufferedFarm.x - 1;
bufferedFarmer.y = bufferedFarm.y;
bufferedFarmer.tx = bufferedFarmer.x;
bufferedFarmer.ty = bufferedFarmer.y;
tick();
assert.equal(bufferedFarmer.carrying, null, 'worker lifted wheat without a reservable destination');
assert.deepEqual(bufferedFarm.produced, { wheat: 4 }, 'failed reservation consumed buffered wheat');
G.dayPhase = 2_800;
for (let ticks = 0; ticks < 500 && bufferedFarmer.activity.kind !== 'sleep'; ticks++) tick();
assert.equal(bufferedFarmer.activity.kind, 'sleep', 'blocked production prevented the resident from sleeping');
assert.deepEqual(bufferedFarm.produced, { wheat: 4 }, 'night scheduling lost buffered wheat');

// Reservation ordering happens inside the live citizen iteration: the first
// load reserves the Windmill's final slots and the second carrier picks bulk
// storage instead of planning into already-promised capacity.
resetWorld(197_062);
const reservedMill = addBuilding('windmill', 12, 10, { workforcePriority: 'high' });
const reserveStore = addBuilding('storehouse', 15, 10);
staff(reservedMill, 'Reservation miller');
const millCapacity = resourceCapacity(reservedMill, 'wheat');
reservedMill.inventory.wheat = millCapacity - 3;
G.resources.wheat = millCapacity - 3;
const firstCarrier = addCitizen('First carrier', 10, 10);
const secondCarrier = addCitizen('Second carrier', 10, 11);
giveCargo(firstCarrier, 'wheat', 3);
giveCargo(secondCarrier, 'wheat', 1);
tick();
assert.equal(firstCarrier._deliveryTarget, reservedMill);
assert.equal(secondCarrier._deliveryTarget, reserveStore, 'second carrier ignored the first live reservation');

// An oversized load uses the last positive converter slots, credits only the
// accepted amount, and immediately keeps its remainder physical while routing
// to another store.
resetWorld(197_066);
const partialMill = addBuilding('windmill', 12, 10, { workforcePriority: 'high' });
const partialStore = addBuilding('storehouse', 15, 10);
staff(partialMill, 'Partial miller');
const partialCapacity = resourceCapacity(partialMill, 'wheat');
partialMill.inventory.wheat = partialCapacity - 2;
G.resources.wheat = partialCapacity - 2;
const partialCarrier = addCitizen('Partial carrier', 10, 10);
giveCargo(partialCarrier, 'wheat', 5);
tick();
assert.equal(partialCarrier._deliveryTarget, partialMill);
deliverNow(partialCarrier);
assert.equal(storedResource(partialMill, 'wheat'), partialCapacity);
assert.equal(G.resources.wheat, partialCapacity);
assert.equal(G.totalResourcesGathered, 2, 'partial arrival gathered more than its accepted amount');
assert.equal(partialCarrier.carrying, 'wheat');
assert.equal(partialCarrier.carryAmount, 3);
assert.equal(partialCarrier._deliveryTarget, partialStore, 'partial remainder did not acquire another store');
assert.equal(partialCarrier.activity.kind, 'walk_to_deliver');

// Stale incompatible and full targets are rejected by the generic physical
// capacity contract, then rebound on the next delivery decision.
resetWorld(197_063);
const incompatibleMill = addBuilding('windmill', 12, 10);
const acceptingBakery = addBuilding('bakery', 15, 10, { workforcePriority: 'high' });
staff(acceptingBakery, 'Reroute baker');
const flourCarrier = addCitizen('Incompatible carrier', 10, 10);
giveCargo(flourCarrier, 'flour', 2, incompatibleMill);
tick();
assert.equal(flourCarrier._deliveryTarget, null, 'incompatible target reference survived invalidation');
assert.equal(flourCarrier.activity.kind, 'needs_delivery');
tick();
assert.equal(flourCarrier._deliveryTarget, acceptingBakery, 'incompatible grain target was not rebound');
assert.equal(flourCarrier.activity.kind, 'walk_to_deliver');

resetWorld(197_064);
const fullMill = addBuilding('windmill', 12, 10, {
  inventory: { wheat: resourceCapacity({ type: 'windmill' }, 'wheat') },
});
const overflowStore = addBuilding('granary', 15, 10);
G.resources.wheat = storedResource(fullMill, 'wheat');
const overflowCarrier = addCitizen('Full target carrier', 10, 10);
giveCargo(overflowCarrier, 'wheat', 2, fullMill);
tick();
assert.equal(overflowCarrier._deliveryTarget, null, 'full target reference survived invalidation');
tick();
assert.equal(overflowCarrier._deliveryTarget, overflowStore, 'full grain target was not rerouted');

// The authoritative removal lifecycle clears a delivery reference and route;
// the still-carried payload then acquires the remaining compatible store.
resetWorld(197_065);
const doomedMill = addBuilding('windmill', 12, 10, { workforcePriority: 'high' });
const recoveryStore = addBuilding('storehouse', 15, 10);
staff(doomedMill, 'Doomed miller');
const demolitionCarrier = addCitizen('Demolition carrier', 10, 10);
giveCargo(demolitionCarrier, 'wheat', 2);
tick();
assert.equal(demolitionCarrier._deliveryTarget, doomedMill);
removeBuilding(doomedMill, { cause: 'manual' });
assert.equal(demolitionCarrier._deliveryTarget, null, 'demolition retained a stale delivery reference');
assert.equal(demolitionCarrier.activity.kind, 'needs_delivery');
assert.equal(demolitionCarrier.path, null, 'demolition retained a stale delivery route');
for (let ticks = 0; ticks < 90 && !demolitionCarrier._deliveryTarget; ticks++) tick();
assert.equal(demolitionCarrier._deliveryTarget, recoveryStore, 'demolished target cargo did not recover');

// If both the destination and producing assignment disappear, the payload is
// still physical—but it may no longer hold its carrier's body hostage. The
// carrier eats and sleeps with the load, then resumes delivery when storage
// returns instead of starving in a permanent needs_delivery loop.
resetWorld(197_070);
const orphanFarm = addBuilding('farm', 10, 10);
const orphanMill = addBuilding('windmill', 14, 10, { workforcePriority: 'high' });
const orphanHome = addBuilding('house', 20, 10, { inventory: { food: 2 } });
G.resources.food = 2;
const orphanCarrier = staff(orphanFarm, 'Orphaned carrier');
orphanCarrier.home = orphanHome;
orphanCarrier.speed = 0.34;
giveCargo(orphanCarrier, 'wheat', 2, orphanMill);
removeBuilding(orphanMill, { cause: 'manual' });
removeBuilding(orphanFarm, { cause: 'manual' });
assert.equal(orphanCarrier.assignment, null);
assert.equal(orphanCarrier._deliveryTarget, null);
assert.equal(orphanCarrier.activity.kind, 'needs_delivery');
assert.equal(orphanCarrier.carrying, 'wheat');
orphanCarrier.hunger = 80;
G.dayPhase = 1_200;
for (let ticks = 0; ticks < 500 && orphanCarrier.hunger > 20; ticks++) tick();
assert.equal(orphanCarrier.hunger, 20, 'blocked carrier could not eat a physical meal');
assert.equal(storedResource(orphanHome, 'food'), 1);
assert.equal(orphanCarrier.carrying, 'wheat', 'meal route deleted orphaned cargo');
assert.equal(orphanCarrier.carryAmount, 2);
G.dayPhase = 3_100;
for (let ticks = 0; ticks < 500 && orphanCarrier.activity.kind !== 'sleep'; ticks++) tick();
assert.equal(orphanCarrier.activity.kind, 'sleep', 'blocked carrier could not sleep with cargo');
assert.equal(orphanCarrier.carrying, 'wheat');
G.dayPhase = 1_200;
const restoredStorage = addBuilding('storehouse', 24, 10);
G.obstacleEpoch++;
for (let ticks = 0; ticks < 700 && orphanCarrier.carrying; ticks++) tick();
assert.equal(orphanCarrier.carrying, null, `rested carrier did not resume delivery when storage returned: ${JSON.stringify({
  activity: orphanCarrier.activity,
  x: orphanCarrier.x,
  y: orphanCarrier.y,
  tx: orphanCarrier.tx,
  ty: orphanCarrier.ty,
  target: orphanCarrier._deliveryTarget?.type || null,
  pathIdx: orphanCarrier.pathIdx,
  pathLength: orphanCarrier.path?.length || 0,
  pending: !!orphanCarrier._pathRequest,
  requestedX: orphanCarrier._requestedTx,
  requestedY: orphanCarrier._requestedTy,
  pathGoal: orphanCarrier._pathGoal,
})}`);
assert.equal(storedResource(restoredStorage, 'wheat'), 2);
assert.equal(G.resources.wheat, 2);

// Non-physical compatibility guard: gold retains its old distance-bounded
// Market preference instead of inheriting the grain broker.
resetWorld(197_067);
const remoteMarket = addBuilding('market', 30, 10);
const nearbyGoldStore = addBuilding('storehouse', 12, 10);
const remoteGoldCarrier = addCitizen('Remote gold carrier', 10, 10);
giveCargo(remoteGoldCarrier, 'gold', 2);
tick();
assert.equal(remoteGoldCarrier._deliveryTarget, nearbyGoldStore);

resetWorld(197_068);
const reachableMarket = addBuilding('market', 20, 10);
addBuilding('storehouse', 12, 10);
const localGoldCarrier = addCitizen('Local gold carrier', 10, 10);
giveCargo(localGoldCarrier, 'gold', 2);
tick();
assert.equal(localGoldCarrier._deliveryTarget, reachableMarket);

console.log('[production-logistics] PASS — live Farm→Windmill→Bakery hauling, transactional buffered output, physical mirrors, reservations, partial/capacity reroutes, demolition/orphan recovery, embodied needs, and legacy gold preference');
