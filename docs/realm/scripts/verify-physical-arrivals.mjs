#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G, MAP_H, MAP_W, TILE, createResourceStock, setSeed,
} from '../js/state.js?realm=197';
import { makeCitizen } from '../js/world.js?realm=197';
import { updateCitizens } from '../js/citizens.js?realm=197';
import { sendCitizenHome } from '../js/citizen-shelter.js?realm=197';
import {
  claimCitizenAssignment,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=197';
import {
  assignCitizenResidence,
  citizenIsIndoors,
} from '../js/residences.js?realm=197';
import { resetPathfindingService } from '../js/pathfinding-service.js?realm=197';

function resetCore() {
  resetPathfindingService();
  resetCitizenOwnershipRuntime();
  setSeed(195_0423);
  Object.assign(G, {
    map: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS)),
    fog: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true)),
    buildingGrid: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null)),
    buildings: [], citizens: [], nextActorId: 1,
    soldiers: [], enemies: [], projectiles: [], particles: [],
    caravans: [], walkers: [], animals: [],
    resources: createResourceStock({ food: 20 }),
    population: 0, maxPop: 20, happiness: 50, defense: 0,
    day: 1, dayPhase: 2_500, dayLength: 3_600, gameTick: 0,
    obstacleEpoch: 0, tileWear: null, season: 'spring', difficulty: 'normal',
    eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
    stats: {
      buildingsBuilt: 0, buildingsLost: 0, raidsFaced: 0, citizensBorn: 0,
      citizensDied: 0, raidsSurvived: 0, enemiesKilled: 0, goldEarned: 0,
      daysLived: 0, housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
    },
    storyFlags: { physicalFoodInventory: true }, namedCharacters: {},
    avatar: null, wonder: null, _undoStack: [],
  });
}

function building(type, x, y, extra = {}) {
  return {
    type, x, y, hp: 100, active: true, prodTimer: 0, produced: null,
    prodShowCount: 0, level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, ...extra,
  };
}

function citizen(x, y, speed = 0.4) {
  const value = makeCitizen(x, y);
  value.speed = speed;
  value.activityTimer = 0;
  value.hunger = 0;
  value.rest = 20;
  value.needs.joy = 20;
  value.needs.faith = 20;
  G.citizens.push(value);
  G.population = G.citizens.length;
  return value;
}

function addBuilding(value) {
  G.buildings.push(value);
  G.buildingGrid[value.y][value.x] = value;
  return value;
}

function tick(count = 1) {
  for (let index = 0; index < count; index++) {
    G.gameTick++;
    updateCitizens();
  }
}

// A venue five tiles behind a complete water ring is close enough to be
// selected for dusk leisure, but the citizen can only reach the ring's outer
// edge. The visit must fail without granting the venue's social benefit.
resetCore();
const tavern = addBuilding(building('tavern', 20, 20));
for (let y = 16; y <= 24; y++) {
  for (let x = 16; x <= 24; x++) {
    if (Math.max(Math.abs(x - tavern.x), Math.abs(y - tavern.y)) <= 4) G.map[y][x] = TILE.WATER;
  }
}
const innkeeper = citizen(5, 5);
claimCitizenAssignment(innkeeper, tavern, { reason: 'job-market' });
transitionCitizenActivity(innkeeper, 'working', 'arrived-at-work');
innkeeper.activityTimer = 10_000;
const visitor = citizen(20, 10);
visitor._hb = 0;
const joyBefore = visitor.needs.joy;
tick(180);
assert.ok(visitor.needs.joy <= joyBefore, 'unreachable tavern restored Joy remotely');
assert.equal(visitor.activity.kind, 'idle', 'failed leisure visit did not return to a visible idle state');
assert.equal(visitor.activity.reason, 'path-unreachable', 'failed leisure visit lost its truthful reason');
assert.equal(visitor._leisureTarget, null, 'failed leisure visit retained a phantom target');

// A stale/outdoor sleep state is immediately made visible as idle and cannot
// restore Rest or acquire an indoor presentation flag.
resetCore();
const homeless = citizen(10, 10);
transitionCitizenActivity(homeless, 'sleep', 'sleep-rest');
const restBefore = homeless.rest;
tick();
assert.equal(homeless.rest, restBefore, 'outdoor sleep restored Rest');
assert.equal(homeless.activity.kind, 'idle', 'outdoor sleep remained presented as Sleeping');
assert.equal(homeless.activity.reason, 'path-unreachable', 'outdoor sleep lost its truthful reason');
assert.equal(citizenIsIndoors(homeless), false, 'homeless citizen was marked indoors');

// An owned but unreachable house follows the same truthful failure path. The
// citizen may approach the outside of the water ring, but never receives
// indoor Rest or disappears from the map.
resetCore();
G.dayPhase = 3_000;
const islandHouse = addBuilding(building('house', 20, 20));
for (let y = 16; y <= 24; y++) {
  for (let x = 16; x <= 24; x++) {
    if (Math.max(Math.abs(x - islandHouse.x), Math.abs(y - islandHouse.y)) <= 4) G.map[y][x] = TILE.WATER;
  }
}
const stranded = citizen(20, 10);
assignCitizenResidence(stranded);
const strandedRestBefore = stranded.rest;
sendCitizenHome(stranded);
tick(220);
assert.ok(stranded.rest <= strandedRestBefore, 'unreachable house restored Rest remotely');
assert.equal(stranded.activity.kind, 'idle', 'unreachable home route did not return to a visible idle state');
assert.equal(stranded.activity.reason, 'path-unreachable', 'unreachable home route lost its truthful reason');
assert.equal(citizenIsIndoors(stranded), false, 'unreachable home route marked the citizen indoors');

// A real home portal still grants the intended sleep benefit.
resetCore();
const house = addBuilding(building('house', 20, 20));
const sleeper = citizen(20, 18);
G.dayPhase = 3_000;
assignCitizenResidence(sleeper);
sleeper.x = house.x + 1;
sleeper.y = house.y;
transitionCitizenActivity(sleeper, 'sleep', 'sleep-rest');
assert.equal(citizenIsIndoors(sleeper), true, 'reachable home portal was not considered indoors');
const housedRestBefore = sleeper.rest;
tick(65);
assert.ok(sleeper.rest > housedRestBefore, 'indoor sleep did not restore Rest');
assert.equal(sleeper.activity.kind, 'sleep', 'indoor sleeper woke before dawn');

console.log('[physical-arrivals] PASS — unreachable leisure and outdoor sleep grant no benefits; reachable home sleep remains restorative');
