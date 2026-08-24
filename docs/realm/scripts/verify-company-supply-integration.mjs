#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G, MAP_H, MAP_W, TILE, createResourceStock, setSeed,
} from '../js/state.js?realm=197';
import { applyCompanyObjective, companyObjective, resetCompanyCommandRuntime } from '../js/army-orders.js?realm=197';
import { createCompanySupplyState } from '../js/company-supply.js?realm=197';
import { processCompanySupplyAtDawn } from '../js/sim.js?realm=197';
import { updateSoldiers } from '../js/soldiers.js?realm=197';
import { resetPathfindingService } from '../js/pathfinding-service.js?realm=197';

function soldier(name, x, y) {
  return {
    name, type: 'swordsman', x, y, tx: x, ty: y,
    hp: 75, maxHp: 75, homeBuilding: null, garrison: null,
    state: 'patrol', stateTimer: 1, attackTimer: 0,
  };
}

resetPathfindingService();
resetCompanyCommandRuntime(G, { clearObjective: true });
setSeed(1447);
Object.assign(G, {
  map: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS)),
  fog: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true)),
  buildingGrid: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null)),
  buildings: [], citizens: [],
  soldiers: [soldier('Ada Pike', 20, 20), soldier('Bram Vale', 20, 21), soldier('Cora Flint', 19, 20)],
  enemies: [], projectiles: [], particles: [], walkers: [], caravans: [],
  resources: createResourceStock({ food: 3, iron: 1 }),
  armyStance: 'defend', rallyPoint: null, armyGuardPoint: null, armyObjective: null,
  armySupply: createCompanySupplyState(1),
  obstacleEpoch: 0, gameTick: 1, day: 2, dayPhase: 0, dayLength: 3600,
  tileWear: null,
  stats: { citizensDied: 0, enemiesKilled: 0 },
});

const storehouse = {
  type: 'storehouse', x: 10, y: 10, hp: 100, active: true,
  buildProgress: 1, buildTotal: 1, buildStartedAt: 0,
  prodTimer: 0, produced: null, prodShowCount: 0, level: 1,
  inventory: { food: 3 },
};
G.buildings.push(storehouse);
G.buildingGrid[storehouse.y][storehouse.x] = storehouse;

assert.equal(applyCompanyObjective(24, 20, 'attack-move').ok, true);
const supplied = processCompanySupplyAtDawn();
assert.equal(supplied.readiness, 'ready');
assert.deepEqual(supplied.charged, { food: 3, iron: 1 });
assert.equal(storehouse.inventory.food, 0, 'company food did not leave the physical store');
assert.equal(G.resources.food, 0, 'physical company food did not update the compatibility wallet');
assert.equal(G.resources.iron, 0);
assert.ok(companyObjective(), 'a supplied dawn cancelled Advance');

G.day = 3;
const strained = processCompanySupplyAtDawn();
assert.equal(strained.readiness, 'strained');
assert.ok(companyObjective(), 'one missed dawn cancelled the risk-taking Advance order');

G.day = 4;
const starving = processCompanySupplyAtDawn();
assert.equal(starving.readiness, 'starving');
assert.equal(companyObjective(), null, 'two missed dawns did not cancel Advance');
assert.equal(G.armyStance, 'defend', 'starving company did not fall back to Defend');

storehouse.inventory.food = 3;
G.resources.food = 3;
G.resources.iron = 1;
G.day = 5;
const recovered = processCompanySupplyAtDawn();
assert.equal(recovered.readiness, 'ready');
assert.equal(G.armySupply.missedDawns, 0);
assert.equal(G.resources.food, 0);
assert.equal(storehouse.inventory.food, 0);

// Readiness affects the real soldier damage path, not only a report number.
const attacker = soldier('Dara Ash', 30, 30);
const target = { x: 30.2, y: 30, hp: 20 };
G.soldiers = [attacker];
G.enemies = [target];
G.armySupply.readiness = 'ready';
G.armySupply.missedDawns = 0;
G.armySupply.shortage = 'none';
updateSoldiers();
assert.equal(target.hp, 15, 'ready soldier damage was not applied');

target.hp = 20;
attacker.attackTimer = 0;
G.armySupply.readiness = 'strained';
G.armySupply.missedDawns = 1;
G.armySupply.shortage = 'food';
updateSoldiers();
assert.equal(target.hp, 15.75, 'strained soldier damage multiplier was not applied');

console.log('[company-supply-integration] PASS — physical dawn upkeep, readiness, Advance fallback, recovery, and combat penalty');
