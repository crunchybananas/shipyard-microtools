#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, MAP_H, MAP_W, TILE, setSeed } from '../js/state.js?realm=198';
import { generateWorld } from '../js/world.js?realm=198';
import { checkRaids } from '../js/economy.js?realm=198';
import { updateSoldiers } from '../js/soldiers.js?realm=198';
import { updateEnemies } from '../js/combat.js?realm=198';
import { depositFood } from '../js/building-inventory.js?realm=198';

function stats() {
  return {
    buildingsBuilt: 0, buildingsLost: 0, raidsFaced: 0,
    citizensBorn: 0, citizensDied: 0, raidsSurvived: 0,
    enemiesKilled: 0, goldEarned: 0, daysLived: 0,
    housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
  };
}

function resetEncounter() {
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS));
  G.soldiers = [];
  G.enemies = [];
  G.projectiles = [];
  G.citizens = [];
  G.buildings = [];
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.particles = [];
  G.resources = {
    wood: 0, stone: 0, food: 0, gold: 0, iron: 0,
    wheat: 0, flour: 0, planks: 0, tools: 0,
  };
  G.stats = stats();
  G.storyState = { lastProverbSeason: null, raid: null };
  G.namedCharacters = {};
  G._raidSpawnCount = 0;
  G._raidStolen = null;
  G.notificationLog = [];
  G.gameTick = 1;
}

function swordsman(name, x, y, homeBuilding = null) {
  return {
    x, y, tx: x, ty: y,
    homeBuilding, name, type: 'swordsman',
    hp: 75, maxHp: 75, state: 'patrol', stateTimer: 0,
  };
}

// A lethal soldier blow is terminal before the enemy turn. The complete
// existing reward/loot/projectile-detach path must still run exactly once.
resetEncounter();
const guard = swordsman('Living control', 20, 20);
const deadRaider = {
  x: 20.5, y: 20, tx: 40, ty: 40,
  hp: 0, maxHp: 24, type: 'raider',
  engaged: guard, attackTimer: 0,
  loot: { gold: 2, food: 3 },
};
const projectile = {
  x: 10, y: 10, tx: deadRaider.x, ty: deadRaider.y,
  target: deadRaider, damage: 8, life: 20, type: 'arrow',
};
G.soldiers = [guard];
G.enemies = [deadRaider];
G.projectiles = [projectile];
G.namedCharacters.rival = { name: 'The Audit Rival' };
G._raidSpawnCount = 1;
G._raidStolen = { gold: 2, food: 3 };
G.gameTick = 60;
const recoveryStore = finishedBuilding('storehouse', 22, 20);
G.buildings.push(recoveryStore);
G.buildingGrid[recoveryStore.y][recoveryStore.x] = recoveryStore;

updateEnemies();
assert.equal(guard.hp, 75, 'dead raider took an engagement turn');
assert.equal(G.enemies.length, 0, 'dead raider remained live');
assert.equal(G.stats.enemiesKilled, 1, 'dead raider was not credited exactly once');
assert.equal(G.resources.gold, 7, 'rival reward or dropped gold was lost');
assert.equal(G.resources.food, 3, 'dropped food was lost');
assert.equal(G._raidStolen, null, 'terminal recovery retained a stale raid ledger');
assert.notEqual(projectile.target, deadRaider, 'projectile retained a removed target');
assert.deepEqual(projectile.target, { x: deadRaider.x, y: deadRaider.y, hp: deadRaider.hp });
assert.equal(G._raidSpawnCount, 0, 'dead raider remained in the morale fighting count');

const exactOnce = {
  kills: G.stats.enemiesKilled,
  gold: G.resources.gold,
  food: G.resources.food,
  particles: G.particles.length,
};
updateEnemies();
assert.deepEqual({
  kills: G.stats.enemiesKilled,
  gold: G.resources.gold,
  food: G.resources.food,
  particles: G.particles.length,
}, exactOnce, 'removed raider resolved more than once');

// A slain raider cannot pour food into a full pantry. Unrecovered loot is
// lost, reported, and the ledger still closes exactly once.
resetEncounter();
const fullPantry = finishedBuilding('house', 22, 20);
G.buildings.push(fullPantry);
G.buildingGrid[fullPantry.y][fullPantry.x] = fullPantry;
depositFood(fullPantry, 8);
const overflowRaider = {
  x: 20.5, y: 20, tx: 40, ty: 40,
  hp: 0, maxHp: 24, type: 'raider', loot: { food: 3 },
};
G.enemies = [overflowRaider];
G._raidStolen = { food: 3 };
updateEnemies();
assert.equal(G.resources.food, 8, 'full pantry minted recovered food');
assert.equal(G._raidStolen, null, 'capacity-limited death leaked plunder into the next raid');
assert.equal(G.notificationLog.filter(entry => entry.text.includes('could not all be stored')).length, 1);
updateEnemies();
assert.equal(G.notificationLog.filter(entry => entry.text.includes('could not all be stored')).length, 1, 'capacity loss reported twice');

// Live control: the terminal pass must not suppress a legitimate enemy turn.
resetEncounter();
const liveGuard = swordsman('Live target', 20, 20);
const liveRaider = {
  x: 20.5, y: 20, tx: 40, ty: 40,
  hp: 24, maxHp: 24, type: 'raider',
  engaged: liveGuard, attackTimer: 0,
};
G.soldiers = [liveGuard];
G.enemies = [liveRaider];
updateEnemies();
assert.equal(liveGuard.hp, 71, 'live raider did not take its valid attack turn');
assert.equal(G.enemies[0], liveRaider);
assert.equal(G.stats.enemiesKilled, 0);

function moraleRaider(id, { hp = 30, retreating = false } = {}) {
  return {
    x: 10 + id, y: 20, tx: 40, ty: 40,
    hp, maxHp: 30, damage: 7, plunderGoal: 30,
    type: 'raider', state: 'approach', variant: id % 3,
    retreating,
  };
}

function prepareMoraleEncounter(enemies) {
  resetEncounter();
  const objective = finishedBuilding('storehouse', 40, 40);
  G.buildings.push(objective);
  G.buildingGrid[objective.y][objective.x] = objective;
  G.enemies = enemies;
  G._raidSpawnCount = 5;
  G.storyState.raid = { day: 8, killsStart: 0, deathsStart: 0 };
  G.day = 8;
  G.gameTick = 60;
  return objective;
}

// Successful withdrawals are not casualties. Four comrades already leaving
// cannot frighten the final active fighter when nobody has died.
const missionActive = moraleRaider(4);
prepareMoraleEncounter([
  moraleRaider(0, { retreating: true }),
  moraleRaider(1, { retreating: true }),
  moraleRaider(2, { retreating: true }),
  moraleRaider(3, { retreating: true }),
  missionActive,
]);
updateEnemies();
assert.notEqual(missionActive.retreating, true, 'successful withdrawals were counted as morale casualties');

// Exactly three deaths in a five-raider band is exactly 60%, so the two
// survivors hold. A fourth death crosses the strict line and breaks the last.
const exactSurvivors = [moraleRaider(3), moraleRaider(4)];
prepareMoraleEncounter([
  moraleRaider(0, { hp: 0 }),
  moraleRaider(1, { hp: 0 }),
  moraleRaider(2, { hp: 0 }),
  ...exactSurvivors,
]);
updateEnemies();
assert.equal(G.stats.enemiesKilled, 3);
assert.ok(exactSurvivors.every(enemy => !enemy.retreating), 'exactly 60% casualties broke morale');

const brokenSurvivor = moraleRaider(4);
prepareMoraleEncounter([
  moraleRaider(0, { hp: 0 }),
  moraleRaider(1, { hp: 0 }),
  moraleRaider(2, { hp: 0 }),
  moraleRaider(3, { hp: 0 }),
  brokenSurvivor,
]);
updateEnemies();
assert.equal(G.stats.enemiesKilled, 4);
assert.equal(brokenSurvivor.retreating, true, 'more than 60% casualties did not break morale');
assert.equal(G._raidSpawnCount, 0);
assert.equal(G.notificationLog.filter(entry => entry.text === 'The raiders break and flee!').length, 1);

function finishedBuilding(type, x, y) {
  return {
    type, x, y, hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, completeTick: 0,
  };
}

function rallyForSide(side) {
  if (side === 0) return { x: 40, y: 28 };
  if (side === 1) return { x: 52, y: 40 };
  if (side === 2) return { x: 40, y: 52 };
  return { x: 28, y: 40 };
}

function runFirstRaid(seed, side) {
  setSeed(seed);
  generateWorld();
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS));
  G.fog = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.projectiles = [];
  G.particles = [];
  G.enemies = [];
  G.deathMarkers = [];
  G.stats = stats();
  G.resources = {
    wood: 100, stone: 100, food: 100, gold: 100, iron: 100,
    wheat: 0, flour: 0, planks: 100, tools: 0,
  };
  G.population = G.citizens.length;
  G.scenario = 'military_rise';
  G.difficulty = 'normal';
  G.era = 2;
  G.day = 8;
  G.dayPhase = 0;
  G.dayLength = 3600;
  G.gameTick = 7 * G.dayLength;
  G.nextRaidDay = 8;
  G.raidInterval = 8;
  G._raidSide = side;
  G._raidSpawnCount = 0;
  G._raidStolen = null;
  G._lastRaidFireDay = null;
  G.namedCharacters = { rival: { name: 'The Audit Rival', noticedDay: 1 } };
  // This balance fixture starts at the authored battle beat. The first military
  // raid is intentionally gated until scouting and rally placement have latched.
  G.storyFlags = { firstMusterStep: 6, firstRaidApproach: side };
  G.armyStance = 'rally';
  G.rallyPoint = rallyForSide(side);

  const house = finishedBuilding('house', 38, 39);
  const farm = finishedBuilding('farm', 42, 39);
  const barracks = finishedBuilding('barracks', 40, 43);
  G.buildings = [house, farm, barracks];
  for (const building of G.buildings) G.buildingGrid[building.y][building.x] = building;
  G.soldiers = [
    swordsman('First', 39.65, 43, barracks),
    swordsman('Second', 40, 43, barracks),
    swordsman('Third', 40.35, 43, barracks),
  ];

  checkRaids();
  assert.equal(G.enemies.length, 2, 'normal era-2 first raid changed size');
  let ticks = 0;
  let lethalEnemyTurns = 0;
  while (G.enemies.length > 0 && ticks < 5000) {
    G.gameTick++;
    updateSoldiers();
    const deadBeforeEnemyTurn = new Set(G.enemies.filter(enemy => enemy.hp <= 0));
    updateEnemies();
    for (const enemy of deadBeforeEnemyTurn) {
      if (G.enemies.includes(enemy)) lethalEnemyTurns++;
    }
    assert.ok(G.enemies.every(enemy => enemy.hp > 0), 'terminal enemy survived its resolution turn');
    ticks++;
  }

  assert.ok(ticks < 5000, `first raid did not resolve for seed ${seed}, side ${side}: ${JSON.stringify({
    enemies: G.enemies.map(enemy => ({ x: enemy.x, y: enemy.y, tx: enemy.tx, ty: enemy.ty, hp: enemy.hp, retreating: enemy.retreating, attackTimer: enemy.attackTimer, engagedHp: enemy.engaged?.hp, pathIdx: enemy.raidPathIdx, pathLength: enemy.raidPath?.length, objectiveId: enemy.raidIntent?.objectiveId })),
    soldiers: G.soldiers.map(soldier => ({ x: soldier.x, y: soldier.y, hp: soldier.hp })),
    buildings: G.buildings.map(building => ({ type: building.type, x: building.x, y: building.y, hp: building.hp })),
  })}`);
  assert.equal(lethalEnemyTurns, 0);
  assert.equal(G.soldiers.length, 3, `undead damage cost a defender for seed ${seed}, side ${side}`);
  assert.equal(G.stats.citizensDied, 0, `first raid recorded a false defender death for seed ${seed}, side ${side}`);
  return {
    ticks,
    kills: G.stats.enemiesKilled,
    hp: G.soldiers.reduce((total, soldier) => total + soldier.hp, 0),
  };
}

const outcomes = [];
for (let seed = 0; seed < 8; seed++) {
  for (let side = 0; side < 4; side++) outcomes.push(runFirstRaid(18900 + seed, side));
}
assert.ok(outcomes.every(outcome => outcome.kills >= 1));
assert.ok(outcomes.every(outcome => outcome.hp > 0));

const slowest = Math.max(...outcomes.map(outcome => outcome.ticks));
const lowestArmyHp = Math.min(...outcomes.map(outcome => outcome.hp));
console.log(`[combat-terminal-death] PASS — exact-once terminal resolution, live attack control, 32/32 three-swordsman first raids (slowest ${slowest} ticks, minimum army HP ${lowestArmyHp})`);
