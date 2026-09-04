// Deterministic congestion correctness gate for Realm 193.
//
// This fixture stresses the citizen state machine rather than only the path
// planner: twenty hungry citizens share one physical doorway and pantry, and
// twenty authored routes exchange sides through the same one-tile opening.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  G,
  MAP_H,
  MAP_W,
  TILE,
  createResourceStock,
  setSeed,
} from '../js/state.js?realm=198';
import { makeCitizen } from '../js/world.js?realm=198';
import { makeAvatar } from '../js/avatar.js?realm=198';
import {
  findPath,
} from '../js/pathfinding.js?realm=198';
import { resetPathfindingService } from '../js/pathfinding-service.js?realm=198';
import { updateCitizens } from '../js/citizens.js?realm=198';
import { pathCitizenTo } from '../js/citizen-navigation.js?realm=198';
import {
  assignmentDutyForBuilding,
  assignmentPurposeForCitizen,
  claimCitizenAssignment,
  commandAssignCitizen,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=198';
import { storedFood } from '../js/building-inventory.js?realm=198';
import {
  commitGameLoad,
  prepareSave,
  serializeGame,
} from '../js/save-state.js?realm=198';

const MAX_TICKS = 1200;
const MAX_ACTIVE_STALL = 90;
const HARD_FLOOR = 0.295;
const PREFERRED_SPACE = 0.55;
const MAX_SOFT_OVERLAP_TICKS = 360;

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function resetWorld(seed = 190191) {
  resetPathfindingService();
  resetCitizenOwnershipRuntime();
  setSeed(seed);
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.GRASS));
  G.fog = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.buildings = [];
  G.citizens = [];
  G.soldiers = [];
  G.enemies = [];
  G.projectiles = [];
  G.walkers = [];
  G.caravans = [];
  G.particles = [];
  G.chronicle = [];
  G.deathMarkers = [];
  G.tileWear = null;
  G.resources = createResourceStock();
  G.resourceRates = createResourceStock();
  G.population = 0;
  G.maxPop = 40;
  G.nextActorId = 1;
  G.happiness = 50;
  G.defense = 0;
  G.day = 1;
  G.dayLength = 3600;
  G.dayPhase = 1800;
  G.gameTick = 0;
  G.speed = 1;
  G.season = 'spring';
  G.weather = 'clear';
  G.difficulty = 'normal';
  G.scenario = 'peaceful_start';
  G.kingdomName = 'Traffic Test';
  G.obstacleEpoch = 1;
  G.nextRaidDay = 8;
  G.raidInterval = 8;
  G.lastRaidDay = null;
  G.lastDeathDay = null;
  G.lastUnderpopDay = null;
  G.realmEnded = false;
  G.activeEvent = null;
  G.eventModifiers = {
    foodProd: 1,
    goldProd: 1,
    happinessOffset: 0,
    speedMult: 1,
  };
  G.rallyPoint = null;
  G.armyStance = 'defend';
  G.won = false;
  G.era = 1;
  G.eraStartDay = { 1: 1 };
  G.wonder = null;
  G.currentResearch = null;
  G.researchedTechs = new Set(['agriculture', 'forestry']);
  G.avatar = makeAvatar(40, 40);
  G.notificationLog = [];
  G.storyFlags = { physicalFoodInventory: true, physicalSupplyWeb: true };
  G.storyState = { lastProverbSeason: null, raid: null };
  G.namedCharacters = {};
  G.totalResourcesGathered = 0;
  G._dailyFoodConsumed = 0;
  G._lastDevolveNotice = null;
  G._lastRaidFireDay = null;
  G._milestone10 = false;
  G._milestone25 = false;
  G._milestone50 = false;
  G._milestone75 = false;
  G._moodDelta = 0;
  G._patrolEmptyNotified = false;
  G._patrolPosts = null;
  G._patrolPostsBuildingCount = -1;
  G._raidSide = null;
  G._raidSpawnCount = 0;
  G._raidStolen = null;
  G._raidWarningGiven = false;
  G._scenarioWon = false;
  G._undoStack = [];
  G.stats = {
    buildingsBuilt: 0,
    buildingsLost: 0,
    raidsFaced: 0,
    citizensBorn: 0,
    citizensDied: 0,
    raidsSurvived: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    daysLived: 0,
    housesEvolved: 0,
    scenariosWon: [],
    everHadBuilding: {},
  };
  G.debug.disableEvents = true;
}

function completedBuilding(type, x, y, extra = {}) {
  const building = {
    type,
    x,
    y,
    hp: 100,
    active: true,
    prodTimer: 0,
    produced: null,
    prodShowCount: 0,
    level: 1,
    buildProgress: 1,
    buildTotal: 1,
    buildStartedAt: 0,
    ...extra,
  };
  G.buildings.push(building);
  G.buildingGrid[y][x] = building;
  return building;
}

function openOneTileDoor(x = 20, y = 20) {
  for (let row = 0; row < MAP_H; row++) {
    if (row !== y) G.map[row][x] = TILE.MOUNTAIN;
  }
}

function spawnCitizen(x, y, name, speed = 0.06) {
  const citizen = makeCitizen(x, y);
  citizen.identity.name = name;
  citizen.speed = speed;
  citizen._hb = 11;
  citizen.activityTimer = 0;
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function authorRoute(citizen, goal, activityKind = 'leisure') {
  const path = findPath(Math.round(citizen.x), Math.round(citizen.y), goal.x, goal.y);
  assert.ok(path, `${citizen.identity.name} must have a route to ${goal.x},${goal.y}`);
  citizen.path = path;
  citizen.pathIdx = 0;
  citizen.tx = goal.x;
  citizen.ty = goal.y;
  citizen._requestedTx = goal.x;
  citizen._requestedTy = goal.y;
  citizen._pathGoal = { x: goal.x, y: goal.y };
  citizen._pathStartedAt = G.gameTick;
  citizen._pathEpoch = G.obstacleEpoch;
  citizen._lastPathX = citizen.x;
  citizen._lastPathY = citizen.y;
  citizen._stuckTicks = 0;
  citizen._wdBest = null;
  citizen._wdTicks = 0;
  transitionCitizenActivity(citizen, activityKind, activityKind === 'leisure' ? 'leisure-started' : 'route-to-work');
  citizen.activityTimer = 0;
  if (activityKind === 'leisure') citizen._leisureTarget = { ...goal, kind: 'tavern' };
}

function createTrafficMetrics(citizens) {
  return {
    last: new Map(citizens.map(citizen => [citizen, { x: citizen.x, y: citizen.y }])),
    stalls: new Map(citizens.map(citizen => [citizen, 0])),
    maxStall: 0,
    minSeparation: Infinity,
    softRuns: new Map(),
    maxSoftOverlap: 0,
  };
}

function observeTraffic(metrics, citizens) {
  for (const citizen of citizens) {
    const prior = metrics.last.get(citizen);
    const moved = Math.hypot(citizen.x - prior.x, citizen.y - prior.y);
    const active = !!citizen.path && citizen.pathIdx < citizen.path.length;
    const stall = active && moved < 0.001 ? (metrics.stalls.get(citizen) || 0) + 1 : 0;
    metrics.stalls.set(citizen, stall);
    metrics.maxStall = Math.max(metrics.maxStall, stall);
    prior.x = citizen.x;
    prior.y = citizen.y;
  }
  for (let first = 0; first < citizens.length; first++) {
    for (let second = first + 1; second < citizens.length; second++) {
      const distance = Math.hypot(
        citizens[first].x - citizens[second].x,
        citizens[first].y - citizens[second].y,
      );
      metrics.minSeparation = Math.min(metrics.minSeparation, distance);
      const key = `${citizens[first].actorId}:${citizens[second].actorId}`;
      const run = distance < PREFERRED_SPACE ? (metrics.softRuns.get(key) || 0) + 1 : 0;
      metrics.softRuns.set(key, run);
      metrics.maxSoftOverlap = Math.max(metrics.maxSoftOverlap, run);
    }
  }
}

function setupDiners() {
  resetWorld(88191);
  openOneTileDoor();
  const store = completedBuilding('storehouse', 24, 20, {
    inventory: { food: 20 },
    founderStockpile: true,
  });
  G.resources.food = 20;
  const citizens = [];
  for (let index = 0; index < 20; index++) {
    const citizen = spawnCitizen(
      13 + (index % 3),
      14 + Math.floor(index / 3),
      `Diner ${String(index + 1).padStart(2, '0')}`,
    );
    citizen.hunger = 80;
    citizen._hb = 11;
    citizens.push(citizen);
  }
  return { store, citizens };
}

function runDiners({ stopAt = MAX_TICKS } = {}) {
  const { store, citizens } = setupDiners();
  const metrics = createTrafficMetrics(citizens);
  const ate = new Set();
  let completionTick = null;
  let assignedApproaches = 0;
  let falseShortage = 0;
  for (let tick = 1; tick <= stopAt; tick++) {
    G.gameTick = tick;
    updateCitizens();
    if (tick === 1) {
      assignedApproaches = new Set(citizens.map(citizen => (
        `${citizen._pathGoal?.x},${citizen._pathGoal?.y}`
      ))).size;
    }
    observeTraffic(metrics, citizens);
    for (const citizen of citizens) {
      if (citizen.hunger <= 20) ate.add(citizen.actorId);
      if (citizen.activity.kind === 'waiting_for_food' && storedFood(store) > 0) falseShortage++;
    }
    if (ate.size === citizens.length) {
      completionTick = tick;
      break;
    }
  }
  return {
    store,
    citizens,
    metrics,
    result: {
      ate: ate.size,
      completionTick,
      assignedApproaches,
      falseShortage,
      foodRemaining: storedFood(store),
      dailyConsumed: G._dailyFoodConsumed,
      maxStall: metrics.maxStall,
      minSeparation: round(metrics.minSeparation),
      maxSoftOverlap: metrics.maxSoftOverlap,
      blacklistedStore: citizens.filter(citizen => citizen._noGo?.['24,20'] !== undefined).length,
      stalled: citizens.filter(citizen => citizen.hunger > 20).map(citizen => ({
        id: citizen.actorId,
        position: [round(citizen.x, 3), round(citizen.y, 3)],
        activity: citizen.activity,
        path: [citizen.pathIdx, citizen.path?.length ?? 0],
        goal: citizen._pathGoal,
        stuck: citizen._stuckTicks,
        watchdog: citizen._wdTicks,
        noGo: citizen._noGo,
      })),
    },
  };
}

function setupBidirectional() {
  resetWorld(99191);
  openOneTileDoor();
  const citizens = [];
  const goals = new Map();
  for (let index = 0; index < 10; index++) {
    const left = spawnCitizen(11 + (index % 2), 13 + index, `West ${index + 1}`);
    const right = spawnCitizen(28 + (index % 2), 13 + index, `East ${index + 1}`);
    const leftGoal = { x: 28 + (index % 2), y: 22 - index };
    const rightGoal = { x: 11 + (index % 2), y: 22 - index };
    authorRoute(left, leftGoal);
    authorRoute(right, rightGoal);
    citizens.push(left, right);
    goals.set(left, leftGoal);
    goals.set(right, rightGoal);
  }
  return { citizens, goals };
}

function runBidirectional({ stopAt = MAX_TICKS } = {}) {
  const { citizens, goals } = setupBidirectional();
  const metrics = createTrafficMetrics(citizens);
  const completed = new Set();
  let completionTick = null;
  for (let tick = 1; tick <= stopAt; tick++) {
    G.gameTick = tick;
    updateCitizens();
    observeTraffic(metrics, citizens);
    for (const citizen of citizens) {
      const goal = goals.get(citizen);
      if (Math.hypot(citizen.x - goal.x, citizen.y - goal.y) <= 0.55) {
        completed.add(citizen.actorId);
      }
    }
    if (completed.size === citizens.length) {
      completionTick = tick;
      break;
    }
  }
  return {
    citizens,
    goals,
    metrics,
    result: {
      completed: completed.size,
      completionTick,
      maxStall: metrics.maxStall,
      minSeparation: round(metrics.minSeparation),
      maxSoftOverlap: metrics.maxSoftOverlap,
      blacklists: citizens.filter(citizen => Object.keys(citizen._noGo || {}).length > 0).length,
      stalled: citizens.filter(citizen => !completed.has(citizen.actorId)).map(citizen => ({
        id: citizen.actorId,
        position: [round(citizen.x, 3), round(citizen.y, 3)],
        goal: goals.get(citizen),
        path: [citizen.pathIdx, citizen.path?.length ?? 0],
        stuck: citizen._stuckTicks,
        watchdog: citizen._wdTicks,
        activity: citizen.activity,
      })),
    },
  };
}

function staleCrownReassignmentFinding() {
  resetWorld(77191);
  const oldFarm = completedBuilding('farm', 10, 10);
  const newFarm = completedBuilding('farm', 30, 30);
  const citizen = spawnCitizen(9, 10, 'Crown Worker');
  claimCitizenAssignment(citizen, oldFarm, {
    duty: assignmentDutyForBuilding(oldFarm),
    purpose: assignmentPurposeForCitizen(citizen, oldFarm),
    reason: 'player-command',
  });
  transitionCitizenActivity(citizen, 'working', 'arrived-at-work');
  citizen.workTarget = { x: 9, y: 10 };
  citizen.path = findPath(9, 10, 9, 11);
  citizen.pathIdx = 0;
  citizen._requestedTx = 9;
  citizen._requestedTy = 11;
  citizen._pathGoal = { x: 9, y: 11 };
  citizen._stuckTicks = 42;
  citizen._wdTicks = 91;
  citizen._wdBest = 2;

  const command = commandAssignCitizen(citizen.actorId, newFarm.x, newFarm.y);
  assert.deepEqual(command, { ok: true });
  assert.equal(citizen.assignment.building, newFarm, 'Crown reassignment must atomically own the new workplace');
  assert.equal(citizen.assignment.reason, 'player-command');
  assert.equal(citizen.workTarget, null, 'old work target must be cleared at command time');
  assert.equal(citizen.path, null, 'old route must be cleared at command time');
  assert.equal(citizen._requestedTx, undefined, 'old route locator must not survive reassignment');
  assert.equal(citizen._requestedTy, undefined, 'old route locator must not survive reassignment');
  assert.equal(citizen._wdTicks, 0, 'old watchdog debt must not survive reassignment');

  G.gameTick = 1;
  updateCitizens();
  assert.equal(citizen.assignment.building, newFarm);
  assert.equal(citizen.assignment.reason, 'player-command');
  assert.ok(citizen.workTarget, 'new Crown workplace must establish a fresh work target');
  assert.ok(
    Math.hypot(citizen.workTarget.x - newFarm.x, citizen.workTarget.y - newFarm.y) <= 3,
    'fresh work target must belong to the newly commanded workplace',
  );
  return {
    actorId: citizen.actorId,
    oldFarm: `${oldFarm.x},${oldFarm.y}`,
    newFarm: `${newFarm.x},${newFarm.y}`,
    newWorkTarget: `${citizen.workTarget.x},${citizen.workTarget.y}`,
    assignmentReason: citizen.assignment.reason,
  };
}

function noGoPruningFinding() {
  resetWorld(66191);
  const citizen = spawnCitizen(10, 10, 'Prune Test');
  citizen._hb = 0;
  citizen.activityTimer = 100;
  citizen._noGo = { '1,1': 0, '2,2': 500 };
  G.gameTick = 700;
  updateCitizens();
  assert.equal(citizen._noGo?.['1,1'], undefined, 'expired no-go entries must be pruned');
  assert.equal(citizen._noGo?.['2,2'], 500, 'live no-go entries must remain authoritative');
  return { remaining: citizen._noGo };
}

function saveContinuationFinding() {
  setupBidirectional();
  const midpoint = 360;
  for (let tick = 1; tick <= midpoint; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  const midpointSave = serializeGame({ savedAt: 0 });
  const prepared = prepareSave(midpointSave);
  assert.equal(prepared.ok, true, prepared.ok ? undefined : `${prepared.error.path}: ${prepared.error.message}`);

  for (let tick = midpoint + 1; tick <= MAX_TICKS; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  const uninterrupted = JSON.stringify(serializeGame({ savedAt: 0 }));

  const committed = commitGameLoad(prepared.value);
  assert.equal(committed.ok, true, committed.ok ? undefined : committed.error.message);
  resetCitizenOwnershipRuntime();
  for (let tick = midpoint + 1; tick <= MAX_TICKS; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  const resumed = JSON.stringify(serializeGame({ savedAt: 0 }));
  assert.equal(resumed, uninterrupted, 'save continuation must be byte-identical after a live traffic queue');
  return {
    midpoint,
    finalTick: G.gameTick,
    sha256: createHash('sha256').update(resumed).digest('hex'),
  };
}

function pendingRequestSaveFinding(offsetTicks) {
  resetWorld(880_192 + offsetTicks);
  const citizen = spawnCitizen(5, 5, `Pending T+${offsetTicks}`);
  citizen._hb = 11;
  citizen.activityTimer = 999;
  G.gameTick = 10;
  assert.equal(pathCitizenTo(citizen, 15, 5, { exact: true }), true);
  assert.equal(citizen._pathRequest?.requestedTick, 10);
  assert.equal(citizen._pathRequest?.readyTick, 15);
  for (let elapsed = 0; elapsed < offsetTicks; elapsed++) {
    G.gameTick++;
    updateCitizens();
  }
  assert.ok(citizen._pathRequest, 'pending route resolved before its fixed ready tick');

  const savedTick = G.gameTick;
  const prepared = prepareSave(serializeGame({ savedAt: 0 }));
  assert.equal(prepared.ok, true, prepared.ok ? undefined : `${prepared.error.path}: ${prepared.error.message}`);

  for (let tick = savedTick + 1; tick <= 40; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  const uninterrupted = JSON.stringify(serializeGame({ savedAt: 0 }));

  resetPathfindingService();
  const committed = commitGameLoad(prepared.value);
  assert.equal(committed.ok, true, committed.ok ? undefined : committed.error.message);
  resetCitizenOwnershipRuntime();
  for (let tick = savedTick + 1; tick <= 40; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  const resumed = JSON.stringify(serializeGame({ savedAt: 0 }));
  assert.equal(
    resumed,
    uninterrupted,
    `pending route saved at requestedTick+${offsetTicks} must resume byte-identically`,
  );
  return {
    savedTick,
    requestedTick: 10,
    readyTick: 15,
    sha256: createHash('sha256').update(resumed).digest('hex'),
  };
}

function selectiveEpochFinding() {
  setupBidirectional();
  for (let tick = 1; tick <= 12; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  completedBuilding('well', 70, 70);
  G.obstacleEpoch++;
  G.gameTick++;
  updateCitizens();
  const unrelatedEpochReplans = G.citizens
    .filter(citizen => citizen._pathRequest).length;
  assert.equal(
    unrelatedEpochReplans,
    0,
    'an unrelated building epoch must preserve every still-valid citizen route',
  );
  assert.equal(
    G.citizens.filter(citizen => citizen.path && citizen.pathIdx < citizen.path.length).length,
    20,
    'selective validation must retain all twenty active authored routes',
  );

  resetWorld(55191);
  for (let index = 0; index < 20; index++) {
    const citizen = spawnCitizen(5, 2 + index * 3, `Epoch ${index + 1}`);
    authorRoute(citizen, { x: 30, y: 2 + index * 3 });
  }
  for (let tick = 1; tick <= 5; tick++) {
    G.gameTick = tick;
    updateCitizens();
  }
  completedBuilding('well', 15, 2);
  G.obstacleEpoch++;
  G.gameTick++;
  updateCitizens();
  const intersectedReplans = G.citizens
    .filter(citizen => citizen._pathRequest).length;
  assert.equal(
    intersectedReplans,
    1,
    'a new obstacle intersecting one of twenty remaining routes must replan exactly that route',
  );
  return {
    activeRoutes: 20,
    unrelatedEpochReplans,
    singleIntersectedRouteReplans: intersectedReplans,
  };
}

function runSuite() {
  const firstDiners = runDiners().result;
  const secondDiners = runDiners().result;
  assert.deepEqual(secondDiners, firstDiners, 'diner fixture must rerun deterministically');
  assert.equal(firstDiners.ate, 20, '20/20 diners must consume stocked physical food');
  assert.ok(firstDiners.completionTick && firstDiners.completionTick <= MAX_TICKS);
  assert.ok(firstDiners.assignedApproaches >= 6, 'food service must distribute stable approach slots');
  assert.equal(firstDiners.falseShortage, 0, 'traffic waits must never masquerade as empty food');
  assert.equal(firstDiners.foodRemaining, 0);
  assert.equal(firstDiners.dailyConsumed, 20);
  assert.equal(firstDiners.blacklistedStore, 0, 'a live food queue must not blacklist its pantry');
  assert.ok(firstDiners.maxStall <= MAX_ACTIVE_STALL, `diner active stall reached ${firstDiners.maxStall}`);
  assert.ok(firstDiners.minSeparation >= HARD_FLOOR, `diner hard separation fell to ${firstDiners.minSeparation}`);
  assert.ok(firstDiners.maxSoftOverlap <= MAX_SOFT_OVERLAP_TICKS, `diner soft overlap lasted ${firstDiners.maxSoftOverlap} ticks`);

  const firstRoutes = runBidirectional().result;
  const secondRoutes = runBidirectional().result;
  assert.deepEqual(secondRoutes, firstRoutes, 'bidirectional fixture must rerun deterministically');
  assert.equal(firstRoutes.completed, 20, '20/20 bidirectional routes must complete');
  assert.ok(firstRoutes.completionTick && firstRoutes.completionTick <= MAX_TICKS);
  assert.equal(firstRoutes.blacklists, 0, 'traffic waits must not create topology blacklists');
  assert.ok(firstRoutes.maxStall <= MAX_ACTIVE_STALL, `route active stall reached ${firstRoutes.maxStall}`);
  assert.ok(firstRoutes.minSeparation >= HARD_FLOOR, `route hard separation fell to ${firstRoutes.minSeparation}`);
  assert.ok(firstRoutes.maxSoftOverlap <= MAX_SOFT_OVERLAP_TICKS, `route soft overlap lasted ${firstRoutes.maxSoftOverlap} ticks`);

  return {
    schema: 'realm.citizen-congestion',
    schemaVersion: 1,
    thresholds: {
      actors: 20,
      maximumTicks: MAX_TICKS,
      maximumContinuousActiveStall: MAX_ACTIVE_STALL,
      hardActorFloor: HARD_FLOOR,
      preferredActorSpace: PREFERRED_SPACE,
      maximumSoftOverlapTicks: MAX_SOFT_OVERLAP_TICKS,
    },
    crownReassignment: staleCrownReassignmentFinding(),
    noGoPruning: noGoPruningFinding(),
    diners: firstDiners,
    bidirectional: firstRoutes,
    selectiveEpoch: selectiveEpochFinding(),
    pendingRequestSave: {
      atRequestedTick: pendingRequestSaveFinding(0),
      atRequestedTickPlusOne: pendingRequestSaveFinding(1),
    },
    saveContinuation: saveContinuationFinding(),
  };
}

const report = runSuite();
console.log(JSON.stringify(report, null, 2));
console.log('[citizen-congestion] VERIFIED: 20 physical diners and 20 bidirectional routes clear deterministic one-tile traffic without false topology failures');
