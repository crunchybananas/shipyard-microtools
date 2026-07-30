#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, BUILDINGS, MAP_H, MAP_W, createResourceStock, setSeed } from '../js/state.js?realm=177';
import { generateWorld } from '../js/world.js?realm=177';
import { placeBuilding, updateFires } from '../js/economy.js?realm=177';
import { buildingCapacity } from '../js/building-lifecycle.js?realm=177';
import { dispatch } from '../js/commands.js?realm=177';
import { updateEnemies } from '../js/combat.js?realm=177';
import { initChronicle } from '../js/log.js?realm=177';
import { prepareSave, serializeGame } from '../js/save-state.js?realm=177';
import {
  claimCitizenAssignment,
  onCitizenTransition,
  transitionCitizenActivity,
  workersForBuilding,
} from '../js/citizen-ownership.js?realm=177';

setSeed(424242);
generateWorld();
initChronicle();
G.resources = createResourceStock({
  wood: 10000, stone: 10000, food: 10000, gold: 10000,
  iron: 10000, wheat: 10000, flour: 10000, planks: 10000, tools: 10000,
});
G._undoStack = [];
G.notificationLog = [];
G.particles = [];
G.soldiers = [];
G.enemies = [];
G.walkers = [];
G.caravans = [];
G.animals = [];
G.carts = [];
G.schoolKids = [];

function findOpenTile() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (G.fog[y]?.[x] && G.map[y][x] !== 0 && G.map[y][x] !== 6 && !G.buildingGrid[y][x]) return { x, y };
    }
  }
  throw new Error('Lifecycle fixture could not find a buildable tile.');
}

function place(type) {
  const tile = findOpenTile();
  assert.equal(placeBuilding(type, tile.x, tile.y), true, `failed to place ${type}`);
  const building = G.buildingGrid[tile.y][tile.x];
  assert.equal(building?.type, type);
  return building;
}

function attachReferenceSurface(building) {
  const citizen = G.citizens[0];
  assert.equal(Object.hasOwn(building, 'workers'), false, 'building must not own a worker array');
  assert.equal(building.buildProgress < 1, true, 'reference fixture expects a construction assignment');
  assert.equal(claimCitizenAssignment(citizen, building, { reason: 'construction' }), true);
  assert.deepEqual(workersForBuilding(building), [citizen], 'derived staffing did not see the claim');
  building.caravanOut = true;
  citizen.home = building;
  citizen.workTarget = { x: building.x, y: building.y };
  citizen._deliveryTarget = building;
  citizen._leisureTarget = { x: building.x, y: building.y, kind: building.type };
  citizen.carrying = 'wood';
  citizen.carryAmount = 2;
  transitionCitizenActivity(citizen, 'walk_to_deliver', 'route-to-delivery');
  citizen.activityTimer = 10;

  G.soldiers = [{
    x: building.x, y: building.y, tx: building.x, ty: building.y,
    homeBuilding: building, garrison: building, name: 'Lifecycle Guard',
    type: 'swordsman', hp: 75, maxHp: 75, state: 'patrol', stateTimer: 1,
  }];
  G.caravans = [{
    x: building.x, y: building.y, tx: 1, ty: 1,
    homeX: building.x, homeY: building.y, phase: 'outbound', gold: 5,
    building, speed: 0.03,
  }];
  G.walkers = [{
    x: building.x, y: building.y, tx: building.x, ty: building.y,
    home: building, src: building, color: '#fff', emoji: '🧪', life: 10,
    visitedHouses: new Set([building]),
  }];
  G.animals = [{
    type: 'cow', x: building.x, y: building.y, tx: building.x, ty: building.y,
    home: building, anchorX: building.x, anchorY: building.y,
    state: 'graze', stateTimer: 1, phase: 0, facing: 1,
  }];
  G.carts = [{
    x: 1, y: 1, tx: building.x, ty: building.y, state: 'arriving',
    stateTimer: 0, market: building, bobPhase: 0, path: null, pathIdx: 0,
  }];
  G.schoolKids = [{ school: building, ang: 0, r: 5, speed: 0.04 }];
  G.selectedBuilding = building;
  G._refreshPanelFor = building;
  G._patrolPosts = [building];
  G._patrolPostsBuildingCount = G.buildings.length;
}

function assertDetached(building, label) {
  assert.equal(G.buildings.includes(building), false, `${label}: building collection`);
  assert.equal(G.buildingGrid[building.y][building.x], null, `${label}: grid cell`);
  assert.equal(Object.hasOwn(building, 'workers'), false, `${label}: reciprocal worker authority`);
  assert.equal(workersForBuilding(building).length, 0, `${label}: derived staffing`);
  assert.equal(building.active, false, `${label}: active effect`);
  assert.equal(building.onFire, false, `${label}: fire effect`);
  assert.equal(building.caravanOut, false, `${label}: caravan flag`);
  for (const citizen of G.citizens) {
    assert.notEqual(citizen.assignment?.building, building, `${label}: citizen assignment`);
    assert.equal(Object.hasOwn(citizen, 'jobBuilding'), false, `${label}: legacy job field`);
    assert.equal(Object.hasOwn(citizen, 'state'), false, `${label}: legacy activity field`);
    assert.notEqual(citizen.home, building, `${label}: citizen home`);
    assert.notEqual(citizen._deliveryTarget, building, `${label}: delivery target`);
    assert.equal(citizen._leisureTarget?.x === building.x && citizen._leisureTarget?.y === building.y, false, `${label}: leisure target`);
  }
  for (const soldier of G.soldiers) {
    assert.notEqual(soldier.homeBuilding, building, `${label}: soldier home`);
    assert.notEqual(soldier.garrison, building, `${label}: garrison`);
  }
  assert.equal(G.caravans.some(caravan => caravan.building === building), false, `${label}: caravan`);
  assert.equal(G.walkers.some(walker => walker.home === building || walker.src === building || walker.visitedHouses?.has(building)), false, `${label}: walker`);
  assert.equal(G.animals.some(animal => animal.home === building), false, `${label}: animal`);
  assert.equal(G.carts.some(cart => cart.market === building), false, `${label}: cart`);
  assert.equal(G.schoolKids.some(kid => kid.school === building), false, `${label}: school child`);
  assert.notEqual(G.selectedBuilding, building, `${label}: selection`);
  assert.notEqual(G._refreshPanelFor, building, `${label}: panel refresh`);
  assert.equal(G._patrolPosts, null, `${label}: patrol cache`);
  assert.equal(G._undoStack.some(entry => entry.b === building), false, `${label}: undo stack`);

  const save = serializeGame();
  const prepared = prepareSave(save);
  assert.equal(prepared.ok, true, `${label}: immediate save invalid: ${prepared.error?.path || ''} ${prepared.error?.message || ''}`);
}

// Player command: half refund and the complete reference surface.
{
  const building = place('market');
  attachReferenceSurface(building);
  const citizen = G.citizens[0];
  const activityEvents = [];
  const stop = onCitizenTransition(event => {
    if (event.actorId === citizen.actorId && event.field === 'activity') activityEvents.push(event);
  });
  const woodBefore = G.resources.wood;
  const stoneBefore = G.resources.stone;
  const lostBefore = G.stats.buildingsLost;
  assert.equal(dispatch({ type: 'DEMOLISH', x: building.x, y: building.y }).ok, true);
  assert.equal(G.resources.wood, woodBefore + Math.floor(BUILDINGS.market.cost.wood / 2), 'manual: wood refund');
  assert.equal(G.resources.stone, stoneBefore + Math.floor(BUILDINGS.market.cost.stone / 2), 'manual: stone refund');
  assert.equal(G.stats.buildingsLost, lostBefore, 'manual: should not count as loss');
  stop();
  assert.equal(citizen.activity.kind, 'needs_delivery', 'manual: carrier lost its delivery obligation');
  assert.deepEqual(
    activityEvents.map(event => event.newValue.kind),
    ['needs_delivery'],
    'manual: carrier cleanup exposed an intermediate activity transition',
  );
  assertDetached(building, 'manual');
}

// Losing a workplace while asleep must not wake or visually remap the actor.
{
  const building = place('market');
  const citizen = G.citizens[0];
  citizen.carrying = null;
  citizen.carryAmount = 0;
  citizen._deliveryTarget = null;
  citizen.home = null;
  assert.equal(claimCitizenAssignment(citizen, building, { reason: 'construction' }), true);
  transitionCitizenActivity(citizen, 'sleep', 'sleep-rest');
  const activityEvents = [];
  const stop = onCitizenTransition(event => {
    if (event.actorId === citizen.actorId && event.field === 'activity') activityEvents.push(event);
  });
  assert.equal(dispatch({ type: 'DEMOLISH', x: building.x, y: building.y }).ok, true);
  stop();
  assert.equal(citizen.assignment, null);
  assert.equal(citizen.activity.kind, 'sleep');
  assert.deepEqual(activityEvents, [], 'workplace removal woke a sleeping citizen');
  assertDetached(building, 'sleeping-worker');
}

// Fire regression #1: an evolved house must remove its tier capacity.
{
  const building = place('house');
  const placedCapacity = buildingCapacity(building);
  building.level = 3;
  G.maxPop += buildingCapacity(building) - placedCapacity;
  const maxPopBefore = G.maxPop;
  const resourcesBefore = structuredClone(G.resources);
  const lostBefore = G.stats.buildingsLost;
  attachReferenceSurface(building);
  building.hp = 0.25;
  building.onFire = true;
  G.gameTick = 1;
  setSeed(12345);
  const noticesBefore = G.notificationLog.length;
  updateFires();
  assert.equal(G.maxPop, maxPopBefore - 8, 'fire house: tier capacity must be removed');
  assert.equal(G.stats.buildingsLost, lostBefore + 1, 'fire house: building loss stat');
  assert.equal(G.notificationLog.length, noticesBefore + 1, 'fire house: exactly one destruction notice');
  assert.deepEqual(G.resources, resourcesBefore, 'fire house: no refund');
  assertDetached(building, 'fire-house');
}

// Fire regression #2: burning a defensive structure must remove defense.
{
  const building = place('tower');
  const defenseBefore = G.defense;
  const lostBefore = G.stats.buildingsLost;
  attachReferenceSurface(building);
  building.hp = 0.25;
  building.onFire = true;
  G.gameTick = 1;
  setSeed(67890);
  updateFires();
  assert.equal(G.defense, defenseBefore - BUILDINGS.tower.defense, 'fire tower: defense must be removed');
  assert.equal(G.stats.buildingsLost, lostBefore + 1, 'fire tower: building loss stat');
  assertDetached(building, 'fire-tower');
}

// Raid integration: exercise the combat hit, not the lifecycle API directly.
{
  const building = place('tower');
  const defenseBefore = G.defense;
  const lostBefore = G.stats.buildingsLost;
  const resourcesBefore = structuredClone(G.resources);
  attachReferenceSurface(building);
  building.hp = 1;
  G.enemies = [{
    x: building.x, y: building.y, tx: building.x, ty: building.y,
    hp: 40, maxHp: 40, damage: 7, plunderGoal: 35,
    type: 'raider', state: 'approach', variant: 0, attackTimer: 0,
  }];
  updateEnemies();
  G.enemies = [];
  assert.equal(G.defense, defenseBefore - BUILDINGS.tower.defense, 'raid: tower defense must be removed');
  assert.equal(G.stats.buildingsLost, lostBefore + 1, 'raid: building loss stat');
  for (const resource of ['stone', 'iron', 'planks']) {
    assert.equal(G.resources[resource], resourcesBefore[resource], `raid: no ${resource} building-cost refund`);
  }
  assertDetached(building, 'raid');
}

// Undo integration: full refund plus story/capacity/defense rollback.
{
  G.storyFlags = { beforePlacement: true };
  G.chronicle = [{ day: G.day, season: G.season, tick: G.gameTick, text: 'before', tag: 'misc' }];
  const resourcesBefore = structuredClone(G.resources);
  const maxPopBefore = G.maxPop;
  const defenseBefore = G.defense;
  const building = place('castle');
  attachReferenceSurface(building);
  G.storyFlags.afterPlacement = true;
  G.chronicle.push({ day: G.day, season: G.season, tick: G.gameTick, text: 'after', tag: 'misc' });
  assert.equal(dispatch({ type: 'UNDO' }).ok, true);
  assert.deepEqual(G.resources, resourcesBefore, 'undo: full resource refund');
  assert.equal(G.maxPop, maxPopBefore, 'undo: castle capacity');
  assert.equal(G.defense, defenseBefore, 'undo: castle defense');
  assert.deepEqual(G.storyFlags, { beforePlacement: true }, 'undo: story flags');
  assert.equal(G.chronicle.length, 1, 'undo: chronicle rollback');
  assertDetached(building, 'undo');
}

console.log('[building-lifecycle] OK — manual, fire house, fire tower, raid combat, undo, references, and immediate saves');
