#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G, MAP_H, MAP_W, TILE, createResourceStock, setSeed,
} from '../js/state.js?realm=198';
import { makeCitizen } from '../js/world.js?realm=198';
import { makeAvatar } from '../js/avatar.js?realm=198';
import { updateCitizens } from '../js/citizens.js?realm=198';
import { updateEnemies } from '../js/combat.js?realm=198';
import {
  claimCitizenAssignment,
  onCitizenTransition,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=198';
import {
  citizenAtResidencePortal,
  citizenHasValidResidence,
  citizenIsIndoors,
  houseResidentCapacity,
  residencePortalForCitizen,
} from '../js/residences.js?realm=198';
import { prepareSave, serializeGame } from '../js/save-state.js?realm=198';
import { establishFounderStockpile } from '../js/building-inventory.js?realm=198';
import { resetPathfindingService } from '../js/pathfinding-service.js?realm=198';

function resetCore(seed = 91_801) {
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
    deathMarkers: [],
    resources: createResourceStock({ wood: 10, food: 100, gold: 10 }),
    population: 0,
    maxPop: 20,
    day: 3,
    dayPhase: 1_200,
    dayLength: 3_600,
    gameTick: 12,
    obstacleEpoch: 0,
    tileWear: null,
    season: 'spring',
    difficulty: 'normal',
    researchedTechs: new Set(['agriculture', 'forestry']),
    eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
    stats: {
      buildingsBuilt: 0, buildingsLost: 0, citizensBorn: 0, citizensDied: 0,
      raidsFaced: 1, raidsSurvived: 0, enemiesKilled: 0, goldEarned: 0,
      daysLived: 0, housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
    },
    storyFlags: {},
    namedCharacters: {},
    notificationLog: [],
    totalResourcesGathered: 0,
    avatar: makeAvatar(40, 40),
    _raidSpawnCount: 0,
    _raidStolen: null,
    _lastRaidFireDay: 3,
  });
  establishFounderStockpile();
}

function addBuilding(type, x, y) {
  const building = {
    type, x, y, hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, completeTick: 0,
  };
  G.buildings.push(building);
  G.buildingGrid[y][x] = building;
  return building;
}

function addCitizen(name, x, y) {
  const citizen = makeCitizen(x, y);
  citizen.identity.name = name;
  citizen.speed = 0.25;
  citizen._hb = 0;
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function raider(x, y) {
  return {
    x, y, tx: x + 1, ty: y,
    hp: 30, maxHp: 30, damage: 7, plunderGoal: 100,
    type: 'raider', state: 'approach', variant: 0, attackTimer: 999,
  };
}

function stepCitizensUntil(predicate, limit = 400) {
  for (let step = 0; step < limit; step++) {
    if (predicate()) return step;
    G.gameTick++;
    updateCitizens();
  }
  assert.fail(`citizen condition did not resolve within ${limit} ticks`);
}

// Every resident hears a realm-wide raid alarm, but immunity begins only at
// their own House portal. Their job assignment remains owned throughout.
resetCore();
const house = addBuilding('house', 20, 20);
const farm = addBuilding('farm', 28, 20);
const resident = addCitizen('Portal Resident', 27, 20);
resident.home = house;
claimCitizenAssignment(resident, farm, { reason: 'job-market' });
transitionCitizenActivity(resident, 'working', 'arrived-at-work');
const transitions = [];
const stopTransitions = onCitizenTransition(event => {
  if (event.actorId === resident.actorId) transitions.push(event);
});
G.enemies = [raider(55, 55)];
updateCitizens();
assert.equal(resident.activity.kind, 'seek_shelter', 'distant active raid did not interrupt safe work');
assert.equal(resident.assignment.building, farm, 'shelter alarm erased the resident job');
assert.equal(citizenIsIndoors(resident), false, 'resident hid before reaching home');
assert.ok(residencePortalForCitizen(resident), 'completed owned House exposed no portal');

const hpBeforeArrival = resident.hp ?? 100;
G.enemies[0].x = resident.x;
G.enemies[0].y = resident.y;
G.enemies[0].tx = resident.x + 1;
G.enemies[0].ty = resident.y;
updateEnemies();
assert.ok(resident.hp < hpBeforeArrival, 'resident became invulnerable before portal arrival');
assert.equal(resident.activity.kind, 'seek_shelter', 'raider hit erased the own-home route');

G.enemies[0].x = 55;
G.enemies[0].y = 55;
G.enemies[0].tx = 55;
G.enemies[0].ty = 55;
stepCitizensUntil(() => resident.activity.kind === 'sheltered');
assert.equal(citizenAtResidencePortal(resident), true, 'shelter entry was not portal-gated');
assert.equal(citizenIsIndoors(resident), true);
const shelteredHp = resident.hp;
G.enemies[0].x = resident.x;
G.enemies[0].y = resident.y;
G.enemies[0].tx = resident.x + 1;
G.enemies[0].ty = resident.y;
for (let hit = 0; hit < 20; hit++) updateEnemies();
assert.equal(resident.hp, shelteredHp, 'genuinely indoor resident took raider damage');
assert.equal(resident.assignment.building, farm);
assert.equal(
  prepareSave(serializeGame({ savedAt: 189 })).ok,
  true,
  'explicit shelter activity broke the existing Save/Continue shape',
);

G.enemies = [];
G.gameTick++;
updateCitizens();
assert.equal(resident.activity.kind, 'find_job');
assert.equal(resident.activity.reason, 'raid-cleared');
assert.equal(citizenIsIndoors(resident), false, 'daytime resident remained hidden after raid clear');
assert.equal(resident.assignment.building, farm);
assert.deepEqual(
  transitions.filter(event => event.field === 'activity').map(event => event.reason),
  ['raid-shelter', 'shelter-entered', 'raid-cleared'],
  'shelter lifecycle was missing explicit causal ledger entries',
);
stopTransitions();

// Capacity and residence ownership remain authoritative. Four valid sleepers
// are already home and shelter without waking; an over-capacity fifth actor
// with a forged home reference remains exterior and flees.
resetCore(91_802);
const capacityHouse = addBuilding('house', 20, 20);
const sleepers = [];
for (let index = 0; index < houseResidentCapacity(capacityHouse) + 1; index++) {
  const sleeper = addCitizen(`Sleeper ${index + 1}`, 21, 20);
  sleeper.home = capacityHouse;
  transitionCitizenActivity(sleeper, 'sleep', 'sleep-rest');
  sleepers.push(sleeper);
}
assert.ok(sleepers.slice(0, 4).every(citizen => citizenHasValidResidence(citizen)));
assert.equal(citizenHasValidResidence(sleepers[4]), false);
G.enemies = [raider(55, 55)];
updateCitizens();
assert.ok(sleepers.slice(0, 4).every(citizen => citizen.activity.kind === 'sheltered'));
assert.ok(sleepers.slice(0, 4).every(citizen => citizenIsIndoors(citizen)));
assert.equal(sleepers[4].activity.kind, 'flee');
assert.equal(sleepers[4].activity.reason, 'shelter-unreachable');
assert.equal(citizenIsIndoors(sleepers[4]), false);

// A night-time all-clear resumes real sleep, then the ordinary dawn wake beat
// brings the resident back outside instead of teleporting them into work.
G.dayPhase = 3_100;
G.enemies = [];
G.gameTick++;
updateCitizens();
assert.ok(sleepers.slice(0, 4).every(citizen => citizen.activity.kind === 'sleep'));
assert.ok(sleepers.slice(0, 4).every(citizen => citizen.activity.reason === 'raid-cleared'));
G.dayPhase = 1_200;
G.gameTick = 24;
updateCitizens();
assert.ok(sleepers.slice(0, 4).every(citizen => citizen.activity.kind === 'find_job'));
assert.ok(sleepers.slice(0, 4).every(citizen => citizen.activity.reason === 'wake-day'));

// A valid residence with no walkable portal cannot hide its owner. The home
// reference remains authoritative, while the exterior actor takes open flight
// and remains vulnerable.
resetCore(91_803);
const islandedHouse = addBuilding('house', 30, 30);
for (let y = 27; y <= 33; y++) {
  for (let x = 27; x <= 33; x++) {
    if (x !== islandedHouse.x || y !== islandedHouse.y) G.map[y][x] = TILE.WATER;
  }
}
const islandedResident = addCitizen('Islanded Resident', 20, 20);
islandedResident.home = islandedHouse;
transitionCitizenActivity(islandedResident, 'working', 'arrived-at-work');
G.enemies = [raider(55, 55)];
updateCitizens();
assert.equal(residencePortalForCitizen(islandedResident), null);
assert.equal(islandedResident.activity.kind, 'flee');
assert.equal(islandedResident.activity.reason, 'shelter-unreachable');
assert.equal(islandedResident.home, islandedHouse, 'failed route rewrote residence ownership');
assert.equal(citizenIsIndoors(islandedResident), false);
const islandedHp = islandedResident.hp ?? 100;
G.enemies[0].x = islandedResident.x;
G.enemies[0].y = islandedResident.y;
G.enemies[0].tx = islandedResident.x + 1;
G.enemies[0].ty = islandedResident.y;
updateEnemies();
assert.ok(islandedResident.hp < islandedHp, 'unreachable resident received shelter immunity');

// Cargo is a protected obligation: deposit once at the real destination,
// then answer the still-active raid alarm. No implicit drop or duplication.
resetCore(91_804);
const cargoHouse = addBuilding('house', 20, 20);
const storehouse = addBuilding('storehouse', 25, 20);
const carrier = addCitizen('Sheltering Carrier', 24, 20);
carrier.home = cargoHouse;
carrier.carrying = 'wood';
carrier.carryAmount = 3;
carrier._deliveryTarget = storehouse;
transitionCitizenActivity(carrier, 'deliver', 'cargo-delivered');
carrier.activityTimer = 0;
G.enemies = [raider(55, 55)];
const woodBefore = G.resources.wood;
updateCitizens();
assert.equal(G.resources.wood, woodBefore + 3, 'raid alarm dropped or duplicated protected cargo');
assert.equal(carrier.carrying, null);
assert.equal(carrier.carryAmount, 0);
assert.notEqual(carrier.activity.kind, 'sheltered', 'carrier teleported home before delivery handoff');
stepCitizensUntil(() => carrier.activity.kind === 'sheltered');
assert.equal(G.resources.wood, woodBefore + 3, 'post-delivery shelter route credited cargo twice');
assert.equal(citizenIsIndoors(carrier), true);

// A carrier whose producer and destination are both gone has no live delivery
// obligation to finish before taking cover. The payload remains embodied while
// its owner shelters and returns to the delivery state after the all-clear.
resetCore(91_805);
const orphanHome = addBuilding('house', 20, 20);
const orphanCarrier = addCitizen('Orphaned Sheltering Carrier', 25, 20);
orphanCarrier.home = orphanHome;
orphanCarrier.carrying = 'wheat';
orphanCarrier.carryAmount = 2;
orphanCarrier._deliveryTarget = null;
orphanCarrier.assignment = null;
transitionCitizenActivity(orphanCarrier, 'needs_delivery', 'cargo-ready');
G.enemies = [raider(55, 55)];
updateCitizens();
assert.equal(orphanCarrier.activity.kind, 'seek_shelter', 'targetless physical cargo suppressed the raid alarm');
stepCitizensUntil(() => orphanCarrier.activity.kind === 'sheltered');
assert.equal(citizenIsIndoors(orphanCarrier), true);
assert.equal(orphanCarrier.carrying, 'wheat', 'sheltering deleted orphaned cargo');
assert.equal(orphanCarrier.carryAmount, 2);
G.enemies = [];
G.gameTick++;
updateCitizens();
assert.equal(orphanCarrier.activity.kind, 'find_job');
stepCitizensUntil(() => orphanCarrier.activity.kind === 'needs_delivery');
assert.equal(orphanCarrier.carrying, 'wheat', 'all-clear recovery deleted orphaned cargo');
assert.equal(orphanCarrier.carryAmount, 2);

console.log('[raid-shelters] PASS — realm-wide own-home alarm, pre-arrival vulnerability, portal/capacity gates, indoor immunity, sleeper continuity, unreachable flight, active-cargo handoff, orphan-cargo cover, and normal all-clear exit');
