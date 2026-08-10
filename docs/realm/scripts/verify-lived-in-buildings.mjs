#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G, MAP_H, MAP_W, TILE, createResourceStock, setSeed,
} from '../js/state.js?realm=192';
import { makeCitizen } from '../js/world.js?realm=192';
import { placeBuilding, updateProduction } from '../js/economy.js?realm=192';
import { updateCitizens } from '../js/citizens.js?realm=192';
import {
  claimCitizenAssignment,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=192';
import {
  assignCitizenResidence,
  citizenHasValidResidence,
  citizenIsIndoors,
  houseResidentCapacity,
  residentsForHouse,
} from '../js/residences.js?realm=192';
import { isBuildingOperational } from '../js/building-operation.js?realm=192';
import { depositFood, storedFood, withdrawFood } from '../js/building-inventory.js?realm=192';

function resetCore() {
  resetCitizenOwnershipRuntime();
  setSeed(7331);
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
    caravans: [],
    walkers: [],
    particles: [],
    resources: createResourceStock({ wood: 500, stone: 500, food: 0, gold: 100, iron: 100, planks: 100 }),
    population: 0,
    maxPop: 3,
    happiness: 50,
    defense: 0,
    day: 1,
    dayPhase: 900,
    dayLength: 3600,
    gameTick: 100,
    obstacleEpoch: 0,
    season: 'spring',
    difficulty: 'normal',
    researchedTechs: new Set(['agriculture', 'forestry']),
    eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
    stats: {
      buildingsBuilt: 0, buildingsLost: 0, citizensBorn: 0, citizensDied: 0,
      raidsFaced: 0, raidsSurvived: 0, enemiesKilled: 0, goldEarned: 0,
      daysLived: 0, housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
    },
    storyFlags: {},
    namedCharacters: {},
    totalResourcesGathered: 0,
    avatar: null,
    wonder: null,
    _undoStack: [],
  });
}

function addCitizen(x, y) {
  const citizen = makeCitizen(x, y);
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function finishWithBuilder(building, builder) {
  building.buildProgress = 0.99;
  building.buildTotal = 1;
  claimCitizenAssignment(builder, building, { reason: 'construction' });
  transitionCitizenActivity(builder, 'working', 'arrived-at-work');
  builder.x = building.x + 1;
  builder.y = building.y;
  updateProduction();
  assert.equal(building.buildProgress, 1);
}

resetCore();
const builder = addCitizen(11, 10);
assert.equal(placeBuilding('house', 10, 10), true);
const house = G.buildings[0];
assert.equal(G.maxPop, 3, 'house foundation granted housing before completion');
assert.equal(G.population, 1, 'house foundation spawned residents before completion');
finishWithBuilder(house, builder);
assert.equal(G.maxPop, 7, 'completed hovel did not grant its four beds');
assert.equal(G.population, 2, 'commissioning should welcome one settler, not conjure a full household');

assert.equal(placeBuilding('tower', 13, 10), true);
const tower = G.buildings.find(building => building.type === 'tower');
assert.equal(G.defense, 0, 'tower foundation granted defense before completion');
finishWithBuilder(tower, builder);
assert.equal(G.defense, 15, 'completed tower did not grant defense exactly once');

const secondHouse = {
  type: 'house', x: 16, y: 10, hp: 100, active: true, prodTimer: 0,
  produced: null, prodShowCount: 0, level: 1, buildProgress: 1,
  buildTotal: 1, buildStartedAt: 0,
};
G.buildings.push(secondHouse);
G.buildingGrid[secondHouse.y][secondHouse.x] = secondHouse;
while (G.citizens.length < 6) addCitizen(10, 11 + G.citizens.length);
for (const citizen of G.citizens) assignCitizenResidence(citizen);
assert.equal(residentsForHouse(house).length, houseResidentCapacity(house));
assert.equal(residentsForHouse(secondHouse).length, 2);
assert.ok(G.citizens.every(citizen => citizenHasValidResidence(citizen)));

const sleeper = residentsForHouse(house)[0];
sleeper.x = house.x + 1;
sleeper.y = house.y;
transitionCitizenActivity(sleeper, 'sleep', 'sleep-rest');
assert.equal(citizenIsIndoors(sleeper), true, 'resident at the home portal did not enter the house');
sleeper.x = house.x + 8;
assert.equal(citizenIsIndoors(sleeper), false, 'distant citizen was incorrectly hidden inside a house');

const tavern = {
  type: 'tavern', x: 20, y: 20, hp: 100, active: true, prodTimer: 0,
  produced: null, prodShowCount: 0, level: 1, buildProgress: 1,
  buildTotal: 1, buildStartedAt: 0,
};
G.buildings.push(tavern);
G.buildingGrid[tavern.y][tavern.x] = tavern;
assert.equal(isBuildingOperational(tavern), false, 'unstaffed tavern operated');
const innkeeper = G.citizens.find(citizen => citizen.assignment === null && citizen.activity.kind !== 'sleep');
claimCitizenAssignment(innkeeper, tavern, { reason: 'job-market' });
transitionCitizenActivity(innkeeper, 'working', 'arrived-at-work');
assert.equal(isBuildingOperational(tavern), true, 'completed staffed tavern did not operate');
transitionCitizenActivity(innkeeper, 'sleep', 'sleep-rest');
assert.equal(isBuildingOperational(tavern), false, 'sleeping innkeeper kept the tavern open');
transitionCitizenActivity(innkeeper, 'working', 'arrived-at-work');

resetCore();
for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) G.map[y][x] = TILE.FOREST;
const reliefStore = {
  type: 'storehouse', x: 15, y: 10, hp: 100, active: true, prodTimer: 0,
  produced: null, prodShowCount: 0, level: 1, buildProgress: 1,
  buildTotal: 1, buildStartedAt: 0, inventory: { food: 0 },
};
G.buildings.push(reliefStore);
G.buildingGrid[reliefStore.y][reliefStore.x] = reliefStore;
assert.deepEqual(depositFood(reliefStore, 12, G), { accepted: 12, remainder: 0, reason: null });
const pioneers = [addCitizen(10, 10), addCitizen(10, 11), addCitizen(11, 10)];
const abundantBefore = { ...G.resources };
for (let tick = 0; tick < 1200; tick++) {
  G.gameTick++;
  updateCitizens();
}
assert.equal(G.resources.wood, abundantBefore.wood, 'idle citizens minted free wood');
assert.equal(G.resources.stone, abundantBefore.stone, 'idle citizens minted free stone');
assert.equal(G.resources.food, abundantBefore.food, 'healthy larder triggered unnecessary foraging');

assert.deepEqual(withdrawFood(reliefStore, 10, G), { taken: 10, remainder: 0, reason: null });
assert.equal(G.resources.food, 2);
for (const [index, citizen] of pioneers.entries()) {
  citizen.x = 10 + (index % 2);
  citizen.y = 10 + Math.floor(index / 2);
  citizen.tx = citizen.x;
  citizen.ty = citizen.y;
  citizen.activityTimer = 0;
  transitionCitizenActivity(citizen, 'find_job', 'seek-work');
  citizen.path = null;
  citizen.pathIdx = 0;
}
let emergencyForagers = 0;
let physicalForageCargoSeen = false;
for (let tick = 0; tick < 1400; tick++) {
  G.gameTick++;
  updateCitizens();
  emergencyForagers = Math.max(
    emergencyForagers,
    pioneers.filter(citizen => citizen.activity.kind === 'foraging').length,
  );
  if (!physicalForageCargoSeen && pioneers.some(citizen => (
    citizen.carrying === 'food' && citizen.activity.kind === 'walk_to_deliver'
  ))) {
    physicalForageCargoSeen = true;
    assert.equal(G.resources.food, 2, 'forage gathering minted wallet food before Storehouse arrival');
    assert.equal(storedFood(reliefStore), 2, 'forage gathering remotely filled the Storehouse');
  }
}
assert.equal(emergencyForagers, 1, 'more than one citizen abandoned the settlement for relief forage');
assert.equal(physicalForageCargoSeen, true, 'relief forager never carried the gathered ration home');
assert.equal(G.resources.food, 3, 'relief forage should buy one food-day, not replace a farm');
assert.equal(storedFood(reliefStore), 3, 'relief forage bypassed the completed Storehouse');
assert.equal(G.resources.wood, abundantBefore.wood);
assert.equal(G.resources.stone, abundantBefore.stone);

console.log('[lived-in-buildings] PASS — completion truth, residence capacity, indoor sleep, staffed services, and emergency-only forage');
