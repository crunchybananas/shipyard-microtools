#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G, MAP_H, MAP_W, TILE, createResourceStock, setSeed,
} from '../js/state.js?realm=191';
import { makeCitizen } from '../js/world.js?realm=191';
import { makeAvatar } from '../js/avatar.js?realm=191';
import { updateCitizens } from '../js/citizens.js?realm=191';
import {
  claimCitizenAssignment,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=191';
import {
  foodConservationReport,
  storedFood,
} from '../js/building-inventory.js?realm=191';
import { prepareSave, serializeGame } from '../js/save-state.js?realm=191';

function resetCore(seed = 190_501) {
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
    animals: [],
    caravans: [],
    walkers: [],
    deathMarkers: [],
    resources: createResourceStock(),
    population: 0,
    maxPop: 20,
    happiness: 60,
    defense: 0,
    day: 3,
    dayPhase: 1_200,
    dayLength: 3_600,
    gameTick: 12,
    obstacleEpoch: 0,
    tileWear: null,
    season: 'spring',
    difficulty: 'normal',
    scenario: 'peaceful_start',
    researchedTechs: new Set(['agriculture', 'forestry']),
    eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
    stats: {
      buildingsBuilt: 0, buildingsLost: 0, citizensBorn: 0, citizensDied: 0,
      raidsFaced: 0, raidsSurvived: 0, enemiesKilled: 0, goldEarned: 0,
      daysLived: 0, housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
    },
    storyFlags: { physicalFoodInventory: true },
    namedCharacters: {},
    notificationLog: [],
    totalResourcesGathered: 0,
    avatar: makeAvatar(40, 40),
    _raidSpawnCount: 0,
    _raidStolen: null,
  });
}

function addBuilding(type, x, y, { food, founderStockpile = false } = {}) {
  const building = {
    type, x, y, hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, completeTick: 0,
  };
  if (food !== undefined) building.inventory = { food };
  if (founderStockpile) building.founderStockpile = true;
  G.buildings.push(building);
  G.buildingGrid[y][x] = building;
  if (food) G.resources.food += food;
  return building;
}

function addCitizen(name, x, y) {
  const citizen = makeCitizen(x, y);
  citizen.identity.name = name;
  citizen.speed = 0.34;
  citizen.hunger = 80;
  citizen.rest = 100;
  citizen.activityTimer = 0;
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function heartbeat(citizen) {
  citizen._hb = (12 - ((G.gameTick + 1) % 12)) % 12;
  tick();
}

function tick(count = 1) {
  for (let index = 0; index < count; index++) {
    G.gameTick++;
    updateCitizens();
  }
}

function tickUntil(label, predicate, limit = 500) {
  for (let elapsed = 0; elapsed <= limit; elapsed++) {
    if (predicate()) return elapsed;
    tick();
  }
  assert.fail(`${label} did not settle within ${limit} citizen ticks`);
}

function raider(x = 70, y = 70) {
  return {
    x, y, tx: x - 1, ty: y,
    hp: 30, maxHp: 30, damage: 7, plunderGoal: 30,
    type: 'raider', state: 'approach', variant: 0, attackTimer: 999,
  };
}

// A Crown worker leaves their body at work, not their ownership. Neither the
// physical store nor its compatibility mirror changes until portal arrival.
resetCore();
const crownStore = addBuilding('storehouse', 20, 20, { food: 3 });
const crownFarm = addBuilding('farm', 32, 20);
const crownWorker = addCitizen('Crown Diner', 31, 20);
claimCitizenAssignment(crownWorker, crownFarm, { reason: 'player-command' });
transitionCitizenActivity(crownWorker, 'working', 'arrived-at-work');
const crownAssignment = crownWorker.assignment;
const crownWalletBefore = G.resources.food;
heartbeat(crownWorker);
assert.equal(crownWorker.activity.kind, 'walk_to_eat');
assert.equal(crownWorker.activity.reason, 'route-to-food');
assert.equal(crownWorker._foodTarget, crownStore);
assert.equal(crownWorker.assignment, crownAssignment, 'meal route replaced the Crown order');
assert.equal(crownWorker.hunger, 80, 'hunger fell before physical arrival');
assert.equal(storedFood(crownStore), 3, 'pantry changed before physical arrival');
assert.equal(G.resources.food, crownWalletBefore, 'global mirror paid for a remote meal');
const crownRouteSave = prepareSave(serializeGame({ savedAt: 190 }));
assert.equal(crownRouteSave.ok, true, crownRouteSave.failure?.message || crownRouteSave.error?.message);

const crownApproachTicks = tickUntil('Crown worker eating at the Storehouse', () => (
  crownWorker.activity.kind === 'eating'
));
assert.ok(crownApproachTicks > 0, 'meal completed without a visible route');
assert.ok(Math.abs(crownWorker.x - crownStore.x) + Math.abs(crownWorker.y - crownStore.y) <= 2.1);
assert.equal(crownWorker.hunger, 20);
assert.equal(storedFood(crownStore), 2);
assert.equal(G.resources.food, crownWalletBefore - 1);
assert.equal(crownWorker.assignment, crownAssignment);
tickUntil('Crown worker returning to work', () => (
  ['walk_to_work', 'working'].includes(crownWorker.activity.kind)
));
assert.equal(crownWorker.assignment, crownAssignment);
assert.equal(crownWorker.assignment.reason, 'player-command');

// Empty and unreachable stores never act as a remote wallet. The actor waits
// visibly on a bounded cadence, then takes the newly reachable fallback.
resetCore(190_502);
const islandStore = addBuilding('storehouse', 20, 20, { food: 1 });
for (let y = 17; y <= 23; y++) {
  for (let x = 17; x <= 23; x++) {
    if (x !== islandStore.x || y !== islandStore.y) G.map[y][x] = TILE.WATER;
  }
}
const waitingFarm = addBuilding('farm', 36, 20);
const waitingWorker = addCitizen('Waiting Diner', 35, 20);
claimCitizenAssignment(waitingWorker, waitingFarm, { reason: 'player-command' });
transitionCitizenActivity(waitingWorker, 'working', 'arrived-at-work');
const waitingAssignment = waitingWorker.assignment;
heartbeat(waitingWorker);
assert.equal(waitingWorker.activity.kind, 'waiting_for_food');
assert.equal(waitingWorker.activity.reason, 'food-shortage');
assert.equal(waitingWorker._foodTarget ?? null, null);
assert.equal(waitingWorker.assignment, waitingAssignment);
assert.equal(waitingWorker.hunger, 80);
assert.equal(G.resources.food, 1, 'unreachable physical food was remotely consumed');
const waitingSince = waitingWorker.activity.sinceTick;
tick(150);
assert.equal(waitingWorker.activity.kind, 'waiting_for_food');
assert.equal(waitingWorker.activity.sinceTick, waitingSince, 'bounded retry thrashed activity ownership');
assert.equal(G.resources.food, 1);

const fallbackGranary = addBuilding('granary', 30, 20, { food: 1 });
tickUntil('waiting diner retargeting to reachable food', () => (
  waitingWorker.activity.kind === 'walk_to_eat'
), 150);
assert.equal(waitingWorker._foodTarget, fallbackGranary);
assert.equal(waitingWorker.assignment, waitingAssignment);
tickUntil('waiting diner consuming fallback food', () => waitingWorker.activity.kind === 'eating');
assert.equal(storedFood(islandStore), 1);
assert.equal(storedFood(fallbackGranary), 0);
assert.equal(G.resources.food, 1);

// House pantries are private to their resident; public stores serve everyone.
// A homeless citizen walks past another household's nearer meal, while that
// household's resident may legitimately use it.
resetCore(190_507);
const privatePantry = addBuilding('house', 20, 20, { food: 1 });
const publicGranary = addBuilding('granary', 30, 20, { food: 1 });
const outsider = addCitizen('Pantry Outsider', 18, 20);
heartbeat(outsider);
assert.equal(outsider.activity.kind, 'walk_to_eat');
assert.equal(outsider._foodTarget, publicGranary, 'citizen claimed another household pantry');
const resident = addCitizen('Pantry Resident', 18, 21);
resident.home = privatePantry;
heartbeat(resident);
assert.equal(resident.activity.kind, 'walk_to_eat');
assert.equal(resident._foodTarget, privatePantry, 'resident ignored their reachable home pantry');

// Food cargo fills only available space, keeps the exact remainder in hand,
// and continues to the next physical store without minting wallet food.
resetCore(190_503);
const nearlyFullHouse = addBuilding('house', 20, 20, { food: 7 });
const overflowStore = addBuilding('storehouse', 28, 20, { food: 0 });
const carrier = addCitizen('Food Carrier', 21, 20);
carrier.home = nearlyFullHouse;
carrier.hunger = 100;
carrier.carrying = 'food';
carrier.carryAmount = 3;
carrier._deliveryTarget = nearlyFullHouse;
transitionCitizenActivity(carrier, 'deliver', 'cargo-delivered');
carrier.activityTimer = 0;
const deliveryWalletBefore = G.resources.food;
tick();
assert.equal(storedFood(nearlyFullHouse), 8);
assert.equal(carrier.carrying, 'food');
assert.equal(carrier.carryAmount, 2);
assert.equal(G.resources.food, deliveryWalletBefore + 1);
assert.equal(carrier.activity.kind, 'walk_to_deliver');
assert.equal(carrier._deliveryTarget, overflowStore);
tickUntil('food carrier depositing exact remainder', () => carrier.carrying === null);
assert.equal(storedFood(overflowStore), 2);
assert.equal(G.resources.food, deliveryWalletBefore + 3);
assert.equal(carrier.carryAmount, 0);
assert.equal(foodConservationReport().conserved, true);

// Automatic deliveries skip an empty private pantry so food cannot become
// inaccessible to every citizen. Public stores remain deterministic fallback.
resetCore(190_508);
const emptyHouse = addBuilding('house', 20, 20, { food: 0 });
const publicStore = addBuilding('storehouse', 28, 20, { food: 0 });
const publicCarrier = addCitizen('Public Pantry Carrier', 21, 20);
publicCarrier.hunger = 0;
publicCarrier.carrying = 'food';
publicCarrier.carryAmount = 1;
transitionCitizenActivity(publicCarrier, 'needs_delivery', 'cargo-needs-storage');
publicCarrier.activityTimer = 0;
tick();
assert.equal(publicCarrier.activity.kind, 'walk_to_deliver');
assert.equal(publicCarrier._deliveryTarget, publicStore, 'food was routed into an unoccupied private pantry');
assert.equal(storedFood(emptyHouse), 0);

// Mixed Farm output survives one-resource-at-a-time hauling. Picking up the
// ration must not erase the wheat batch waiting for its next trip.
resetCore(190_506);
addBuilding('storehouse', 20, 20, { food: 0 });
const mixedFarm = addBuilding('farm', 28, 20);
mixedFarm.produced = { food: 1, wheat: 3 };
const mixedCarrier = addCitizen('Mixed Harvest Carrier', 29, 20);
mixedCarrier.hunger = 0;
claimCitizenAssignment(mixedCarrier, mixedFarm, { reason: 'player-command' });
transitionCitizenActivity(mixedCarrier, 'working', 'arrived-at-work');
mixedCarrier.workTarget = { x: mixedCarrier.x, y: mixedCarrier.y };
mixedCarrier.activityTimer = 0;
tick();
assert.equal(mixedCarrier.carrying, 'food');
assert.equal(mixedCarrier.carryAmount, 1);
assert.deepEqual(mixedFarm.produced, { wheat: 3 }, 'food pickup erased buffered wheat');

// Foraged food also enters the same physical delivery boundary: gathering
// creates cargo, not wallet food, and only the pantry arrival owns the unit.
resetCore(190_505);
const forageStore = addBuilding('storehouse', 20, 20, { food: 0 });
const forager = addCitizen('Physical Forager', 28, 20);
forager.hunger = 0;
forager.forageTarget = { x: 28, y: 20, tile: TILE.FOREST };
G.map[20][28] = TILE.FOREST;
transitionCitizenActivity(forager, 'foraging', 'forage-started');
forager.activityTimer = 0;
tick();
assert.equal(forager.carrying, 'food');
assert.equal(forager.carryAmount, 1);
assert.equal(forager.activity.kind, 'walk_to_deliver');
assert.equal(G.resources.food, 0, 'forage arrival minted remote wallet food');
tickUntil('foraged food reaching physical storage', () => forager.carrying === null);
assert.equal(storedFood(forageStore), 1);
assert.equal(G.resources.food, 1);
assert.equal(foodConservationReport().conserved, true);

// Cargo, sleep, and raid shelter stay ahead of hunger.
resetCore(190_504);
const invariantStore = addBuilding('storehouse', 20, 20, { food: 5 });
const invariantHouse = addBuilding('house', 30, 30, { food: 0 });
const cargoCitizen = addCitizen('Obligated Carrier', 22, 20);
cargoCitizen.hunger = 100;
cargoCitizen.carrying = 'wood';
cargoCitizen.carryAmount = 2;
cargoCitizen._deliveryTarget = invariantStore;
transitionCitizenActivity(cargoCitizen, 'walk_to_deliver', 'route-to-delivery');
cargoCitizen.activityTimer = 100;
heartbeat(cargoCitizen);
assert.notEqual(cargoCitizen.activity.kind, 'walk_to_eat');
assert.equal(cargoCitizen.carrying, 'wood');

const sleeper = addCitizen('Sleeping Diner', 31, 30);
sleeper.home = invariantHouse;
sleeper.hunger = 100;
transitionCitizenActivity(sleeper, 'sleep', 'sleep-rest');
sleeper.activityTimer = 100;
G.dayPhase = 3_100;
heartbeat(sleeper);
assert.equal(sleeper.activity.kind, 'sleep');
assert.equal(sleeper.hunger, 100);

const shelteringWorker = addCitizen('Sheltering Diner', 38, 30);
shelteringWorker.home = invariantHouse;
shelteringWorker.hunger = 100;
transitionCitizenActivity(shelteringWorker, 'working', 'arrived-at-work');
G.dayPhase = 1_200;
G.enemies = [raider()];
heartbeat(shelteringWorker);
assert.equal(shelteringWorker.activity.kind, 'seek_shelter');
assert.equal(shelteringWorker._foodTarget ?? null, null);
assert.equal(storedFood(invariantStore), 5);

console.log(
  `[citizen-food-routes] PASS — Crown route/return (${crownApproachTicks} ticks), arrival-only withdrawal, private/occupied pantry policy, bounded shortage fallback, mixed harvest + physical forage conservation, exact partial deposits, save-valid target, and cargo/sleep/raid priority`,
);
