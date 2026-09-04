#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, MAP_H, MAP_W, TILE, createResourceStock, setSeed } from '../js/state.js?realm=198';
import { checkRaids } from '../js/economy.js?realm=198';
import { rankedRaidTargets, raidTargetForIndex } from '../js/raid-targeting.js?realm=198';
import { updateEnemies } from '../js/combat.js?realm=198';

function stats() {
  return {
    buildingsBuilt: 0, buildingsLost: 0, raidsFaced: 0,
    citizensBorn: 0, citizensDied: 0, raidsSurvived: 0,
    enemiesKilled: 0, goldEarned: 0, daysLived: 0,
    housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
  };
}

function building(type, x, y, hp = 100) {
  return {
    type, x, y, hp, active: true,
    buildProgress: 1, buildTotal: 1, level: 1,
    prodTimer: 0, produced: null, prodShowCount: 0,
  };
}

function resetEncounter() {
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.buildings = [];
  G.soldiers = [];
  G.citizens = [];
  G.enemies = [];
  G.projectiles = [];
  G.particles = [];
  G.resources = createResourceStock({ food: 100, gold: 10 });
  G.stats = stats();
  G.namedCharacters = {};
  G.storyFlags = {};
  G.scenario = 'peaceful_start';
  G.difficulty = 'normal';
  G.era = 1;
  G.day = 8;
  G.dayPhase = 0;
  G.gameTick = 1;
  G.nextRaidDay = 8;
  G.raidInterval = 8;
  G._raidSide = 1;
  G._raidSpawnCount = 0;
  G._raidStolen = null;
  G._raidWarningGiven = false;
  G._lastRaidFireDay = null;
  G.defense = 0;
}

function put(buildingRef) {
  G.buildings.push(buildingRef);
  G.buildingGrid[buildingRef.y][buildingRef.x] = buildingRef;
  return buildingRef;
}

// The ranking is strategic first, approach second, then map coordinates. A
// road never attracts the raid, and walls are only targets if nothing else is
// left to sack.
resetEncounter();
const storehouse = put(building('storehouse', 43, 40));
const farm = put(building('farm', 44, 39));
const road = put(building('road', 42, 40));
const wall = put(building('wall', 45, 40));
assert.deepEqual(rankedRaidTargets(G, 1).slice(0, 2), [storehouse, farm]);
assert.equal(rankedRaidTargets(G, 1).includes(road), false);
assert.equal(rankedRaidTargets(G, 1).includes(wall), false);

const wallOnly = [storehouse, farm, road, wall];
G.buildings = [wall];
G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
G.buildingGrid[wall.y][wall.x] = wall;
assert.deepEqual(rankedRaidTargets(G, 1), [wall], 'walls must be the final fallback target');
G.buildings = wallOnly;
G.buildingGrid[storehouse.y][storehouse.x] = storehouse;
G.buildingGrid[farm.y][farm.x] = farm;
G.buildingGrid[road.y][road.x] = road;

// Spawn uses the same ranked contract and round-robins the two-raider wave.
setSeed(812_440);
G._raidSide = null;
checkRaids();
assert.equal(G.enemies.length, 2);
assert.ok(Number.isSafeInteger(G._raidSide) && G._raidSide >= 0 && G._raidSide <= 3, 'direct spawn did not retain its rolled approach');
const spawnedSide = G._raidSide;
assert.deepEqual(
  G.enemies.map(enemy => ({ x: enemy.tx, y: enemy.ty })),
  [0, 1].map(index => {
    const target = raidTargetForIndex(index, G, spawnedSide);
    return { x: target.x, y: target.y };
  }),
  'spawn did not assign distinct strategic targets in ranked order',
);

// A wall between a raider and its assigned Storehouse takes damage before the
// Storehouse does. The existing 0.35/tick siege rate is intentionally retained.
resetEncounter();
const breachWall = put(building('wall', 41, 40));
const breachTarget = put(building('storehouse', 43, 40));
const breacher = {
  x: 40, y: 40, tx: breachTarget.x, ty: breachTarget.y,
  hp: 30, maxHp: 30, damage: 7, plunderGoal: 30,
  type: 'raider', state: 'approach', variant: 0,
};
G.enemies = [breacher];
for (let tick = 0; tick < 100; tick++) updateEnemies();
assert.ok(breachWall.hp < 100, 'intervening wall was not breached');
assert.equal(breachTarget.hp, 100, 'target building was damaged before its wall blocker');
assert.deepEqual({ x: breacher.tx, y: breacher.ty }, { x: 43, y: 40 }, 'breach changed strategic target coordinates');

// Destroyed targets retarget deterministically to the next ranked live target.
resetEncounter();
const destroyed = put(building('storehouse', 43, 40, 0));
const northTarget = put(building('farm', 45, 10));
const southTarget = put(building('farm', 45, 70));
G.buildingGrid[destroyed.y][destroyed.x] = null;
G.buildings = [northTarget, southTarget];
G._raidSide = 2;
const retargeting = {
  x: destroyed.x, y: destroyed.y, tx: destroyed.x, ty: destroyed.y,
  hp: 30, maxHp: 30, damage: 7, plunderGoal: 30,
  type: 'raider', state: 'approach', variant: 0,
};
G.enemies = [retargeting];
updateEnemies();
assert.deepEqual({ x: retargeting.tx, y: retargeting.ty }, { x: southTarget.x, y: southTarget.y });
assert.equal(G._raidSide, 2, 'retargeting lost the active raid approach');

// Existing enemy tx/ty fields carry targets; no target-specific save field was
// introduced by this slice.
const allowedEnemyFields = new Set([
  'x', 'y', 'tx', 'ty', 'hp', 'maxHp', 'damage', 'plunderGoal', 'type', 'state',
  'variant', 'attackTimer', 'engaged', 'loot', 'plundered', 'retreating', 'attackCue',
]);
for (const key of Object.keys(retargeting)) assert.equal(allowedEnemyFields.has(key), true, `new enemy save field: ${key}`);

// Target assignment is pure and repeatable for the same fixture.
assert.equal(raidTargetForIndex(0, G, 2), southTarget);
assert.equal(raidTargetForIndex(1, G, 2), northTarget);

const escaping = {
  x: 0, y: 0, tx: 0, ty: 0, hp: 30, maxHp: 30, damage: 7,
  plunderGoal: 30, type: 'raider', state: 'approach', variant: 0, retreating: true,
};
G.enemies = [escaping];
G._raidSide = 2;
updateEnemies();
assert.equal(G._raidSide, null, 'active raid approach was not cleared after the last raider escaped');

console.log('[raid-target-contract] PASS — priority/approach ranking, round-robin spawn targets, road exclusion, wall breach, deterministic retarget, and existing enemy save surface');
