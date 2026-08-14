#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, MAP_H, MAP_W, TILE, setSeed } from '../js/state.js?realm=195';
import { dispatch } from '../js/commands.js?realm=195';
import {
  armyMayEngage,
  armyOrderAnchor,
  armyOrderMeta,
  liveGuardBuilding,
} from '../js/army-orders.js?realm=195';
import { updateSoldiers } from '../js/soldiers.js?realm=195';
import { removeBuilding } from '../js/building-lifecycle.js?realm=195';

function building(type, x, y, buildProgress = 1) {
  const value = {
    type, x, y, hp: 100, active: buildProgress >= 1,
    buildProgress, buildTotal: 1, level: 1,
    prodTimer: 0, produced: null, prodShowCount: 0,
    buildStartedAt: 0, completeTick: 0,
  };
  G.buildings.push(value);
  G.buildingGrid[y][x] = value;
  return value;
}

function soldier(name, x, y, homeBuilding) {
  return {
    name, type: 'swordsman', x, y, tx: x, ty: y,
    hp: 75, maxHp: 75, homeBuilding, garrison: null,
    state: 'patrol', stateTimer: 1, attackTimer: 0,
  };
}

setSeed(93_410);
Object.assign(G, {
  map: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS)),
  buildingGrid: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null)),
  buildings: [], soldiers: [], enemies: [], projectiles: [], particles: [],
  citizens: [], walkers: [], caravans: [], animals: [], carts: [], schoolKids: [],
  armyStance: 'defend', rallyPoint: null, armyGuardPoint: null,
  _patrolPosts: null, _patrolPostsBuildingCount: -1, _patrolEmptyNotified: false,
  avatar: { x: 40, y: 40 }, gameTick: 1, _commandLog: [],
  resources: { wood: 0, stone: 0, food: 0, gold: 0, iron: 0, wheat: 0, flour: 0, planks: 0, tools: 0 },
  maxPop: 0, defense: 0,
  stats: { buildingsLost: 0 },
  storyFlags: { physicalFoodInventory: true }, chronicle: [],
  selectedBuilding: null, _refreshPanelFor: null, _undoStack: [],
});

const barracks = building('barracks', 20, 20);
const farm = building('farm', 28, 20);
const wallA = building('wall', 24, 24);
const wallB = building('tower', 30, 24);
const unfinished = building('house', 34, 20, 0.5);
const guardA = soldier('Mara Pike', 20, 20, barracks);
const guardB = soldier('Ivo Flint', 20, 21, barracks);
G.soldiers = [guardA, guardB];

assert.equal(dispatch({ type: 'SET_STANCE', stance: 'retreat' }).reason, 'bad-stance');
assert.equal(dispatch({ type: 'SET_GUARD', x: unfinished.x, y: unfinished.y }).reason, 'under-construction');
assert.equal(dispatch({ type: 'SET_GUARD', x: 79, y: 79 }).reason, 'no-building');
assert.equal(dispatch({ type: 'SET_GUARD', x: farm.x, y: farm.y, hidden: true }).reason, 'unknown-command-field');

const guardOrder = dispatch({ type: 'SET_GUARD', x: farm.x, y: farm.y });
assert.equal(guardOrder.ok, true);
assert.equal(G.armyStance, 'guard');
assert.deepEqual(G.armyGuardPoint, { x: farm.x, y: farm.y });
assert.equal(liveGuardBuilding(), farm);
for (const unit of G.soldiers) {
  assert.ok(Math.abs(unit.tx - farm.x) <= 2 && Math.abs(unit.ty - farm.y) <= 2, 'guard order did not retarget immediately');
}
assert.deepEqual(armyOrderMeta(), {
  icon: '👁️', label: 'Guard', detail: 'Protect one chosen building and threats near it.',
});

const bait = { x: 40, y: 20, hp: 20 };
guardA.x = 39.6; guardA.y = 20;
assert.equal(armyMayEngage(guardA, bait), false, 'guard company accepted bait outside its objective leash');
const localThreat = { x: 29, y: 20, hp: 20 };
guardA.x = 28.6; guardA.y = 20;
assert.equal(armyMayEngage(guardA, localThreat), true, 'guard company ignored a threat beside its objective');
G.enemies = [localThreat];
updateSoldiers();
assert.equal(localThreat.hp, 15, 'guard company did not attack a local threat');
G.enemies = [];

assert.equal(dispatch({ type: 'SET_STANCE', stance: 'explore' }).ok, true);
assert.equal(G.armyStance, 'explore');
G.avatar.x = 52; G.avatar.y = 44;
for (const unit of G.soldiers) { unit.tx = 28; unit.ty = 20; }
updateSoldiers();
for (const unit of G.soldiers) {
  assert.ok(Math.abs(unit.tx - G.avatar.x) <= 2 && Math.abs(unit.ty - G.avatar.y) <= 2, 'escort target did not follow the Founder');
}

assert.equal(dispatch({ type: 'SET_STANCE', stance: 'patrol' }).ok, true);
const patrolAnchor = armyOrderAnchor(guardA);
assert.ok([wallA, wallB].some(post => Math.abs(patrolAnchor.x - post.x) <= 1 && Math.abs(patrolAnchor.y - post.y) <= 1), 'patrol ignored completed fortifications');

assert.equal(dispatch({ type: 'SET_RALLY', x: 42, y: 32 }).ok, true);
assert.equal(G.armyStance, 'rally');
assert.deepEqual(G.rallyPoint, { x: 42, y: 32 });
assert.equal(dispatch({ type: 'SET_RALLY', x: null, y: null }).ok, true);
assert.equal(G.armyStance, 'defend');
assert.equal(G.rallyPoint, null);

dispatch({ type: 'SET_GUARD', x: farm.x, y: farm.y });
removeBuilding(farm, { cause: 'manual' });
assert.equal(G.armyGuardPoint, null, 'demolished guard target remained authoritative');
assert.equal(G.armyStance, 'defend', 'demolished guard target did not return the company to defend');

console.log('[army-orders] PASS — strict commands, immediate rally/guard, local threat leash, wall patrol, Founder escort, and demolition recovery');
