#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, MAP_H, MAP_W, createResourceStock, setSeed } from '../js/state.js?realm=192';
import { generateWorld } from '../js/world.js?realm=192';
import { canPlace } from '../js/economy.js?realm=192';
import { dispatch } from '../js/commands.js?realm=192';
import {
  claimCitizenAssignment,
  createCitizenOwnership,
  resetCitizenOwnershipRuntime,
  staffingCount,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=192';
import {
  AUTO_REASSIGN_COOLDOWN_TICKS,
  buildingAcceptsAutomaticWorkers,
  reviewAutomaticAssignment,
  scoreCitizenJob,
  workforcePolicySnapshot,
} from '../js/workforce-policy.js?realm=192';
import { commitGameLoad, prepareSave, serializeGame } from '../js/save-state.js?realm=192';
import { establishFounderStockpile } from '../js/building-inventory.js?realm=192';

// Save/Continue proof over the real current graph.
setSeed(731_991);
generateWorld();
Object.assign(G.resources, createResourceStock({
  wood: 10_000, stone: 10_000, food: 100, gold: 100,
  iron: 100, wheat: 100, flour: 100, planks: 100, tools: 100,
}));
establishFounderStockpile();
for (const row of G.fog) row.fill(true);
let placement = null;
for (let y = 1; y < MAP_H - 1 && !placement; y++) {
  for (let x = 1; x < MAP_W - 1; x++) {
    if (canPlace('farm', x, y)) { placement = { x, y }; break; }
  }
}
assert.ok(placement, 'save fixture found no Farm placement');
assert.equal(dispatch({ type: 'PLACE_BUILDING', building: 'farm', ...placement }).ok, true);
assert.equal(dispatch({ type: 'SET_WORKFORCE_PRIORITY', ...placement, priority: 'high' }).ok, true);
const saved = serializeGame({ savedAt: 189 });
G.buildingGrid[placement.y][placement.x].workforcePriority = 'low';
const prepared = prepareSave(saved);
assert.equal(prepared.ok, true, prepared.error?.message);
assert.equal(commitGameLoad(prepared.value).ok, true);
const restoredFarm = G.buildingGrid[placement.y][placement.x];
assert.equal(restoredFarm.workforcePriority, 'high', 'Save/Continue lost workforce priority');
restoredFarm.workforcePriority = 'off';
assert.throws(
  () => serializeGame(),
  /Off-duty buildings may retain only Crown-ordered workers/,
  'writer admitted an AI assignment at an off-duty building',
);
restoredFarm.workforcePriority = 'urgent';
assert.throws(() => serializeGame(), /Unknown workforce priority/, 'writer admitted an unknown policy enum');
restoredFarm.workforcePriority = 'high';

function resetFixture() {
  G.gameTick = 0;
  G.nextActorId = 1;
  G.citizens = [];
  G.population = 0;
  G.buildings = [];
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.resources = createResourceStock({ food: 100, wheat: 100, flour: 100 });
  G._commandLog = [];
  resetCitizenOwnershipRuntime();
}

function addBuilding(type, x, y, workforcePriority = undefined) {
  const building = {
    type, x, y, hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1, buildStartedAt: 0,
    ...(workforcePriority ? { workforcePriority } : {}),
  };
  G.buildings.push(building);
  G.buildingGrid[y][x] = building;
  return building;
}

function addCitizen(name, x, y) {
  const citizen = {
    ...createCitizenOwnership(name),
    x, y, tx: x, ty: y, speed: 0.03,
    carrying: null, carryAmount: 0, hunger: 0, rest: 100,
    needs: { joy: 55, faith: 55 }, home: null,
    activityTimer: 0, path: null, pathIdx: 0,
  };
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function assignWorking(citizen, building, reason) {
  assert.equal(claimCitizenAssignment(citizen, building, { reason }), true);
  transitionCitizenActivity(citizen, 'working', 'arrived-at-work');
  citizen.activityTimer = 10_000;
}

resetFixture();
const priorityFarm = addBuilding('farm', 18, 20);
const bakery = addBuilding('bakery', 20, 20);
const market = addBuilding('market', 22, 20);
const mine = addBuilding('mine', 24, 20);
const automaticFarmer = addCitizen('Automatic Farmer', bakery.x, bakery.y);
const automaticTrader = addCitizen('Automatic Trader', market.x, market.y);
const crownMiner = addCitizen('Crown Miner', mine.x, mine.y);
assignWorking(automaticFarmer, bakery, 'job-market');
assignWorking(automaticTrader, market, 'job-market');
assignWorking(crownMiner, mine, 'player-command');
G.gameTick = AUTO_REASSIGN_COOLDOWN_TICKS + 10;

const high = dispatch({
  type: 'SET_WORKFORCE_PRIORITY',
  x: priorityFarm.x,
  y: priorityFarm.y,
  priority: 'high',
});
assert.equal(high.ok, true);
assert.equal(high.reassigned, 1, 'new high-priority vacancy did not pull from a full workforce');
assert.equal(automaticFarmer.assignment.building, priorityFarm, 'deterministic vocation fit did not win the high-priority slot');
assert.equal(automaticFarmer.assignment.reason, 'workforce-policy');
assert.equal(automaticFarmer.profession.kind, 'farmer', 'policy reassignment morphed stable profession identity');
assert.equal(automaticTrader.assignment.building, market, 'lower-ranked automatic candidate moved unexpectedly');
assert.equal(crownMiner.assignment.building, mine, 'Crown order moved during automatic rebalance');
assert.equal(staffingCount(priorityFarm), 1);
assert.equal(staffingCount(bakery), 0, 'atomic reassignment retained the old slot');
assert.deepEqual(G._commandLog.at(-1), {
  type: 'SET_WORKFORCE_PRIORITY',
  x: priorityFarm.x,
  y: priorityFarm.y,
  priority: 'high',
  tick: G.gameTick,
});
assert.deepEqual(workforcePolicySnapshot(priorityFarm), {
  priority: 'high', capacity: 1, staffed: 1,
  aiWorkers: 1, crownWorkers: 0, acceptsAutomaticWorkers: true,
});

const automaticMiner = addCitizen('Automatic Miner', mine.x, mine.y);
assignWorking(automaticMiner, mine, 'job-market');
const off = dispatch({
  type: 'SET_WORKFORCE_PRIORITY',
  x: mine.x,
  y: mine.y,
  priority: 'off',
});
assert.equal(off.ok, true);
assert.equal(off.released, 1, 'off policy did not release its AI worker');
assert.equal(automaticMiner.assignment, null);
assert.equal(crownMiner.assignment.building, mine, 'off policy erased a Crown order');
assert.equal(buildingAcceptsAutomaticWorkers(mine), false);
const offProbe = addCitizen('Off Probe', mine.x, mine.y);
assert.throws(
  () => claimCitizenAssignment(offProbe, mine, { reason: 'job-market' }),
  /closed to automatic staffing/,
  'off building accepted a direct AI claim',
);
assert.equal(claimCitizenAssignment(offProbe, mine, { reason: 'player-command' }), true, 'off policy blocked an explicit Crown order');

// Continuous review honors both a meaningful improvement threshold and the
// assignment-age cooldown. The first target is only eleven tiles nearer; the
// six-point current-job hysteresis leaves a five-point gain, below threshold.
resetFixture();
const currentFarm = addBuilding('farm', 30, 30);
const modestFarm = addBuilding('farm', 19, 30);
const decisiveFarm = addBuilding('farm', 18, 30, 'high');
const reviewer = addCitizen('Review Farmer', 19, 30);
assignWorking(reviewer, currentFarm, 'job-market');
assert.equal(reviewAutomaticAssignment(reviewer), false, 'cooldown permitted an immediate reassignment');
G.gameTick = AUTO_REASSIGN_COOLDOWN_TICKS;
decisiveFarm.workforcePriority = 'off';
assert.ok(scoreCitizenJob(reviewer, modestFarm) > scoreCitizenJob(reviewer, currentFarm));
assert.equal(reviewAutomaticAssignment(reviewer), false, 'sub-threshold improvement caused job thrash');
decisiveFarm.workforcePriority = 'high';
assert.equal(reviewAutomaticAssignment(reviewer), true, 'material high-priority improvement was ignored after cooldown');
assert.equal(reviewer.assignment.building, decisiveFarm);
assert.equal(reviewer.profession.kind, 'farmer');

console.log('[building-workforce-priority] PASS — command policy, Crown veto, off duty, deterministic full-workforce transfer, cooldown, threshold, and Save/Continue');
