// Deterministic Engine-v2 Phase 0C worksite, invalidation, and mixed-traffic
// correctness gate. These fixtures retain the original Phase 0C measurements
// while requiring bounded separation, immediate obstacle invalidation, and
// stable actor ownership.

import assert from 'node:assert/strict';
import runtimeContract from '../runtime-contract.json?realm=171' with { type: 'json' };
import {
  G,
  MAP_H,
  MAP_W,
  TILE,
  createResourceStock,
  setSeed,
} from '../js/state.js?realm=171';
import {
  findPath,
  getPathfindingDiagnostics,
} from '../js/pathfinding.js?realm=171';
import { updateCitizens } from '../js/citizens.js?realm=171';
import { updateSoldiers } from '../js/soldiers.js?realm=171';
import { updateWalkers } from '../js/walkers.js?realm=171';
import { updateAnimals } from '../js/animals.js?realm=171';
import {
  createCitizenOwnership,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=171';
import { buildCitizenPresentation } from '../js/citizen-presentation.js?realm=171';

const RECORDED_REVISION = 171;
const RECORDED_SAVE_VERSION = 4;
const RECORDED_SIMULATION_VERSION = 3;
const MINIMUM_ACTOR_SEPARATION = 0.40;

function rounded(value, digits = 12) {
  return Number(value.toFixed(digits));
}

function configureWorld(fill = TILE.GRASS) {
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
  G.fog = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.buildings = [];
  G.citizens = [];
  G.soldiers = [];
  G.enemies = [];
  G.projectiles = [];
  G.walkers = [];
  G.animals = [];
  G.caravans = [];
  G.particles = [];
  G.tileWear = null;
  G.resources = createResourceStock({ food: 1000 });
  G.population = 0;
  G.maxPop = 100;
  G.nextActorId = 1;
  G.day = 1;
  G.dayLength = 3600;
  G.dayPhase = G.dayLength / 2;
  G.gameTick = 0;
  G.speed = 1;
  G.season = 'spring';
  G.weather = 'clear';
  G.difficulty = 'normal';
  G.obstacleEpoch = 1;
  G.armyStance = 'defend';
  G.rallyPoint = null;
  G.eventModifiers = {
    foodProd: 1,
    goldProd: 1,
    happinessOffset: 0,
    speedMult: 1,
  };
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
  setSeed(0x5eed1234);
  resetCitizenOwnershipRuntime();
}

function makeCitizen(displayName, x, y, overrides = {}) {
  const {
    activityKind = 'idle',
    activityReason = activityKind === 'idle' ? 'spawn-idle' : 'seek-work',
    activityTimer = 100,
    ...fields
  } = overrides;
  const citizen = {
    ...createCitizenOwnership(displayName),
    x,
    y,
    tx: x,
    ty: y,
    faceX: 0,
    faceZ: 0,
    speed: 0.03,
    hunger: 0,
    rest: 100,
    needs: { joy: 55, faith: 55 },
    activityTimer,
    path: null,
    pathIdx: 0,
    _hb: 1,
    carrying: null,
    carryAmount: 0,
    hurtTimer: 0,
    ...fields,
  };
  if (activityKind !== 'idle') {
    transitionCitizenActivity(citizen, activityKind, activityReason);
  }
  return citizen;
}

function makeBuilding(type, x, y, overrides = {}) {
  return {
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
    ...overrides,
  };
}

function compressPath(path) {
  if (!path || path.length <= 2) return path;
  const compact = [path[0]];
  let lastDx = 0;
  let lastDy = 0;
  for (let index = 1; index < path.length; index++) {
    const previous = path[index - 1];
    const current = path[index];
    const dx = Math.sign(current.x - previous.x);
    const dy = Math.sign(current.y - previous.y);
    if (index > 1 && (dx !== lastDx || dy !== lastDy)) compact.push(previous);
    lastDx = dx;
    lastDy = dy;
  }
  compact.push(path[path.length - 1]);
  compact.goal = path.goal;
  return compact;
}

function ownershipSnapshot(citizen) {
  const snapshot = buildCitizenPresentation(citizen);
  const assignment = snapshot.assignment;
  return {
    identity: `${snapshot.actorId}:${snapshot.identity.appearanceId}`,
    profession: snapshot.profession.kind,
    assignment: assignment
      ? `${assignment.duty}@${assignment.building.x},${assignment.building.y}:${assignment.purpose}`
      : null,
    activity: snapshot.activity.kind,
    variant: snapshot.variant,
  };
}

function makeOwnershipTracker(citizens) {
  const previous = new Map(citizens.map(citizen => [citizen.actorId, ownershipSnapshot(citizen)]));
  const totals = {
    identity: 0,
    profession: 0,
    assignment: 0,
    activity: 0,
    variant: 0,
  };
  return {
    sample() {
      for (const citizen of citizens) {
        const before = previous.get(citizen.actorId);
        const after = ownershipSnapshot(citizen);
        for (const field of Object.keys(totals)) {
          if (before[field] !== after[field]) totals[field]++;
        }
        previous.set(citizen.actorId, after);
      }
    },
    snapshot() {
      return { ...totals };
    },
    reset() {
      for (const field of Object.keys(totals)) totals[field] = 0;
      for (const citizen of citizens) {
        previous.set(citizen.actorId, ownershipSnapshot(citizen));
      }
    },
  };
}

function activeCitizenRoute(citizen) {
  return !!citizen.path && citizen.pathIdx < citizen.path.length;
}

function countBlockedTick(counter, key, actor, intendedBefore, beforeX, beforeY) {
  if (!intendedBefore) return;
  if (Math.hypot(actor.x - beforeX, actor.y - beforeY) < 0.000001) {
    counter[key] = (counter[key] || 0) + 1;
  }
}

function minimumPairDistance(actors) {
  let distance = Infinity;
  let pair = null;
  for (let first = 0; first < actors.length; first++) {
    for (let second = first + 1; second < actors.length; second++) {
      const candidate = Math.hypot(
        actors[first].actor.x - actors[second].actor.x,
        actors[first].actor.y - actors[second].actor.y,
      );
      if (candidate < distance) {
        distance = candidate;
        pair = [actors[first].label, actors[second].label];
      }
    }
  }
  return { distance, pair };
}

function worksiteCongestionScenario() {
  configureWorld();
  const northMine = makeBuilding('mine', 20, 19);
  const southMine = makeBuilding('mine', 20, 21);
  for (const mine of [northMine, southMine]) {
    G.map[mine.y][mine.x] = TILE.IRON;
    G.buildings.push(mine);
    G.buildingGrid[mine.y][mine.x] = mine;
  }
  // Both legal two-worker mines share one exterior ore tile. The production
  // target selector and crowd-aware path target are exercised without
  // overstaffing either building.
  G.map[20][21] = TILE.IRON;

  const citizens = [
    makeCitizen('North West', 14, 17, {
      activityKind: 'find_job', activityReason: 'seek-work', activityTimer: 0, _hb: 1,
    }),
    makeCitizen('North East', 26, 17, {
      activityKind: 'find_job', activityReason: 'seek-work', activityTimer: 0, _hb: 2,
    }),
    makeCitizen('South West', 14, 23, {
      activityKind: 'find_job', activityReason: 'seek-work', activityTimer: 0, _hb: 3,
    }),
    makeCitizen('South East', 26, 23, {
      activityKind: 'find_job', activityReason: 'seek-work', activityTimer: 0, _hb: 4,
    }),
  ];
  const workerStarts = citizens.map(citizen => ({
    actorId: citizen.actorId,
    x: citizen.x,
    y: citizen.y,
  }));
  G.citizens = citizens;
  G.population = citizens.length;
  const ownership = makeOwnershipTracker(citizens);
  const pathCallsBefore = getPathfindingDiagnostics().findPathCalls;

  // Tick one is assignment and initial planning, reported separately from
  // churn. Subsequent identity changes are instability, not initialization.
  G.gameTick = 1;
  updateCitizens();
  ownership.sample();
  const assignmentTransitions = ownership.snapshot();
  ownership.reset();
  const initialPathCalls = getPathfindingDiagnostics().findPathCalls - pathCallsBefore;

  let minimumSeparation = Infinity;
  let minimumTick = null;
  let minimumPair = null;
  let ticksInsidePersonalSpace = 0;
  let maximumWorkersNearSharedTile = 0;
  let allWorkingTick = null;
  let settledWorkingTicks = 0;
  const blockedTicks = Object.fromEntries(citizens.map(citizen => [`actor-${citizen.actorId}`, 0]));

  for (let tick = 2; tick <= 720; tick++) {
    G.gameTick = tick;
    const before = citizens.map(citizen => ({
      citizen,
      x: citizen.x,
      y: citizen.y,
      intended: activeCitizenRoute(citizen),
    }));
    updateCitizens();
    ownership.sample();
    for (const sample of before) {
      countBlockedTick(
        blockedTicks,
        `actor-${sample.citizen.actorId}`,
        sample.citizen,
        sample.intended,
        sample.x,
        sample.y,
      );
    }
    const closest = minimumPairDistance(citizens.map(citizen => ({
      label: `actor-${citizen.actorId}`,
      actor: citizen,
    })));
    if (closest.distance < minimumSeparation) {
      minimumSeparation = closest.distance;
      minimumTick = tick;
      minimumPair = closest.pair;
    }
    if (closest.distance < 0.5) ticksInsidePersonalSpace++;
    const nearSharedTile = citizens.filter(citizen => Math.hypot(citizen.x - 21, citizen.y - 20) < 1).length;
    maximumWorkersNearSharedTile = Math.max(maximumWorkersNearSharedTile, nearSharedTile);
    if (citizens.every(citizen => citizen.activity.kind === 'working')) {
      if (allWorkingTick === null) allWorkingTick = tick;
      settledWorkingTicks++;
      if (settledWorkingTicks >= 90) break;
    } else {
      settledWorkingTicks = 0;
    }
  }

  const totalPathCalls = getPathfindingDiagnostics().findPathCalls - pathCallsBefore;
  return {
    classification: 'control',
    finding: 'legal-worksite-workers-maintain-local-capacity',
    fixture: {
      buildings: ['mine@20,19', 'mine@20,21'],
      legalWorkerSlots: 4,
      sharedOreTile: { x: 21, y: 20 },
      workerStarts,
    },
    ticksRun: G.gameTick,
    pathCallCount: totalPathCalls,
    initialPathCallCount: initialPathCalls,
    replanCount: totalPathCalls - initialPathCalls,
    blockedTimeTicks: blockedTicks,
    totalBlockedTimeTicks: Object.values(blockedTicks).reduce((sum, value) => sum + value, 0),
    assignmentTransitions,
    ownershipTransitions: ownership.snapshot(),
    minimumSeparation: rounded(minimumSeparation),
    minimumTick,
    minimumPair,
    ticksInsidePersonalSpace,
    maximumWorkersNearSharedTile,
    allWorkingTick,
    final: citizens.map(citizen => {
      const snapshot = buildCitizenPresentation(citizen);
      return {
        actorId: snapshot.actorId,
        appearanceId: snapshot.identity.appearanceId,
        profession: snapshot.profession.kind,
        assignment: snapshot.assignment,
        variant: snapshot.variant,
        activity: snapshot.activity.kind,
        x: rounded(citizen.x),
        y: rounded(citizen.y),
        workTarget: citizen.workTarget
          ? { x: citizen.workTarget.x, y: citizen.workTarget.y }
          : null,
      };
    }),
  };
}

function dynamicObstacleScenario() {
  configureWorld();
  const start = { x: 10, y: 20 };
  const goal = { x: 22, y: 20 };
  const pathCallsBefore = getPathfindingDiagnostics().findPathCalls;
  const authored = compressPath(findPath(start.x, start.y, goal.x, goal.y));
  assert.ok(authored, 'dynamic-obstacle fixture must begin with a valid route');
  const citizen = makeCitizen('Route Inspector', start.x, start.y, {
    tx: goal.x,
    ty: goal.y,
    activityTimer: 100,
    path: authored,
    pathIdx: 0,
    _requestedTx: goal.x,
    _requestedTy: goal.y,
    _pathGoal: { ...goal },
    _pathEpoch: G.obstacleEpoch,
    _pathStartedAt: 0,
    _lastPathX: start.x,
    _lastPathY: start.y,
  });
  G.citizens = [citizen];
  G.population = 1;
  const ownership = makeOwnershipTracker([citizen]);
  const initialPathCalls = getPathfindingDiagnostics().findPathCalls - pathCallsBefore;
  const obstacle = makeBuilding('wall', 15, 20);
  const obstacleTick = 20;
  let replanTick = null;
  let completionTick = null;
  let blockedTimeTicks = 0;
  let minimumObstacleDistance = Infinity;
  let previousPathCalls = getPathfindingDiagnostics().findPathCalls;

  for (let tick = 1; tick <= 720; tick++) {
    G.gameTick = tick;
    if (tick === obstacleTick) {
      G.buildings.push(obstacle);
      G.buildingGrid[obstacle.y][obstacle.x] = obstacle;
      G.obstacleEpoch++;
    }
    const beforeX = citizen.x;
    const beforeY = citizen.y;
    const intended = activeCitizenRoute(citizen);
    updateCitizens();
    ownership.sample();
    if (intended && Math.hypot(citizen.x - beforeX, citizen.y - beforeY) < 0.000001) blockedTimeTicks++;
    minimumObstacleDistance = Math.min(minimumObstacleDistance, Math.hypot(citizen.x - obstacle.x, citizen.y - obstacle.y));
    const pathCalls = getPathfindingDiagnostics().findPathCalls;
    if (replanTick === null && pathCalls > previousPathCalls) replanTick = tick;
    previousPathCalls = pathCalls;
    if (tick > obstacleTick && Math.hypot(citizen.x - goal.x, citizen.y - goal.y) < 0.01) {
      completionTick = tick;
      break;
    }
  }

  const totalPathCalls = getPathfindingDiagnostics().findPathCalls - pathCallsBefore;
  assert.notEqual(replanTick, null, 'dynamic obstacle must eventually cause a replan');
  assert.notEqual(completionTick, null, 'dynamic obstacle detour must finish within the bounded run');
  const snapshot = buildCitizenPresentation(citizen);
  return {
    classification: 'control',
    finding: 'obstacle-epoch-invalidates-compressed-route-immediately',
    fixture: {
      start,
      goal,
      obstacle: { x: obstacle.x, y: obstacle.y, placedAtTick: obstacleTick },
      compressedInitialWaypoints: authored.map(point => ({ x: point.x, y: point.y })),
    },
    ticksRun: G.gameTick,
    pathCallCount: totalPathCalls,
    initialPathCallCount: initialPathCalls,
    replanCount: totalPathCalls - initialPathCalls,
    blockedTimeTicks,
    obstacleEpochInvalidationLatencyTicks: replanTick - obstacleTick,
    replanTick,
    completionTick,
    minimumObstacleCenterDistance: rounded(minimumObstacleDistance),
    ownershipTransitions: ownership.snapshot(),
    final: {
      actorId: snapshot.actorId,
      appearanceId: snapshot.identity.appearanceId,
      x: rounded(citizen.x),
      y: rounded(citizen.y),
      profession: snapshot.profession.kind,
      assignment: snapshot.assignment,
      activity: snapshot.activity.kind,
      variant: snapshot.variant,
    },
  };
}

function mixedTrafficScenario() {
  configureWorld();
  const pathCallsBefore = getPathfindingDiagnostics().findPathCalls;
  const citizenPath = findPath(18, 20, 24, 20);
  assert.ok(citizenPath, 'mixed traffic citizen route must be valid');
  const citizen = makeCitizen('Miner', 18, 20, {
    tx: 24,
    ty: 20,
    path: citizenPath,
    pathIdx: 0,
    _requestedTx: 24,
    _requestedTy: 20,
    _pathGoal: { x: 24, y: 20 },
    _pathEpoch: G.obstacleEpoch,
    _pathStartedAt: 0,
    _lastPathX: 18,
    _lastPathY: 20,
  });
  const soldier = {
    name: 'Guard', type: 'soldier', x: 22, y: 20, tx: 16, ty: 20,
    hp: 100, attackTimer: 0, stateTimer: 999,
  };
  const walkerHome = makeBuilding('well', 20, 18);
  const walker = {
    x: 20, y: 18, tx: 20, ty: 24, home: walkerHome,
    life: 999, visitedHouses: new Set(), emoji: 'water', color: '#60a5fa',
  };
  const animal = {
    type: 'chicken', x: 20, y: 22, tx: 20, ty: 16,
    anchorX: 20, anchorY: 22, state: 'walk', stateTimer: 999,
    phase: 0, facing: 1, _walkTimeout: 999, _stuckTicks: 0,
  };
  G.citizens = [citizen];
  G.soldiers = [soldier];
  G.walkers = [walker];
  G.animals = [animal];
  G.population = 1;
  const ownership = makeOwnershipTracker([citizen]);
  const actors = [
    { label: 'citizen', actor: citizen, intent: () => activeCitizenRoute(citizen) },
    { label: 'soldier', actor: soldier, intent: () => Math.hypot(soldier.tx - soldier.x, soldier.ty - soldier.y) > 0.1 },
    { label: 'walker', actor: walker, intent: () => Math.hypot(walker.tx - walker.x, walker.ty - walker.y) > 0.15 },
    { label: 'animal', actor: animal, intent: () => animal.state === 'walk' },
  ];
  const blockedTicks = Object.fromEntries(actors.map(actor => [actor.label, 0]));
  let minimumSeparation = Infinity;
  let minimumTick = null;
  let minimumPair = null;
  let ticksWithPairInsidePersonalSpace = 0;
  let maximumCenterOccupancy = 0;
  let ticksWithAllFourAtCenter = 0;

  for (let tick = 1; tick <= 110; tick++) {
    G.gameTick = tick;
    const before = actors.map(entry => ({
      ...entry,
      x: entry.actor.x,
      y: entry.actor.y,
      intended: entry.intent(),
    }));
    updateCitizens();
    updateSoldiers();
    updateWalkers();
    updateAnimals();
    ownership.sample();
    for (const entry of before) {
      countBlockedTick(blockedTicks, entry.label, entry.actor, entry.intended, entry.x, entry.y);
    }
    const closest = minimumPairDistance(actors);
    if (closest.distance < minimumSeparation) {
      minimumSeparation = closest.distance;
      minimumTick = tick;
      minimumPair = closest.pair;
    }
    if (closest.distance < 0.5) ticksWithPairInsidePersonalSpace++;
    const centerOccupancy = actors.filter(entry => Math.hypot(entry.actor.x - 20, entry.actor.y - 20) < 0.5).length;
    maximumCenterOccupancy = Math.max(maximumCenterOccupancy, centerOccupancy);
    if (centerOccupancy === actors.length) ticksWithAllFourAtCenter++;
  }

  const totalPathCalls = getPathfindingDiagnostics().findPathCalls - pathCallsBefore;
  return {
    classification: 'control',
    finding: 'mixed-ground-actors-share-local-capacity',
    fixture: {
      center: { x: 20, y: 20, occupancyRadius: 0.5 },
      actorTypes: actors.map(entry => entry.label),
      ticks: 110,
    },
    ticksRun: G.gameTick,
    pathCallCount: totalPathCalls,
    initialPathCallCount: 1,
    replanCount: totalPathCalls - 1,
    blockedTimeTicks: blockedTicks,
    totalBlockedTimeTicks: Object.values(blockedTicks).reduce((sum, value) => sum + value, 0),
    ownershipTransitions: ownership.snapshot(),
    minimumSeparation: rounded(minimumSeparation),
    minimumTick,
    minimumPair,
    ticksWithPairInsidePersonalSpace,
    maximumCenterOccupancy,
    ticksWithAllFourAtCenter,
    final: actors.map(entry => ({
      type: entry.label,
      x: rounded(entry.actor.x),
      y: rounded(entry.actor.y),
    })),
  };
}

function runSuite() {
  assert.equal(runtimeContract.moduleRevision, RECORDED_REVISION, 'recorded traffic artifact must be recaptured after a runtime revision change');
  assert.equal(runtimeContract.saveVersion, RECORDED_SAVE_VERSION, 'recorded traffic artifact must be recaptured after a save-version change');
  assert.equal(runtimeContract.simulationVersion, RECORDED_SIMULATION_VERSION, 'recorded traffic artifact must be recaptured after a simulation-version change');
  return {
    schema: 'realm.engine-v2.phase0c-traffic-baseline',
    schemaVersion: 2,
    recordedRevision: RECORDED_REVISION,
    runtime: {
      moduleRevision: runtimeContract.moduleRevision,
      saveVersion: runtimeContract.saveVersion,
      simulationVersion: runtimeContract.simulationVersion,
      coreSystemOrderVersion: runtimeContract.coreSystemOrderVersion,
    },
    measurementDefinitions: {
      pathCallCount: 'All production findPath invocations, including failed calls, measured by before/after snapshots of a read-only module counter.',
      replanCount: 'Production findPath calls after fixture-authored or first-assignment planning calls.',
      blockedTimeTicks: 'Ticks with movement intent at tick start and less than 0.000001 tile of displacement.',
      ownershipTransitions: 'Changes observed through immutable presentation snapshots: actorId plus appearanceId, profession, assignment summary, activity, and presentation variant.',
    },
    scenarios: {
      worksiteCongestion: worksiteCongestionScenario(),
      dynamicObstacleInvalidation: dynamicObstacleScenario(),
      mixedGroundActorTraffic: mixedTrafficScenario(),
    },
  };
}

function assertCorrectness(baseline) {
  const worksite = baseline.scenarios.worksiteCongestion;
  assert.equal(worksite.classification, 'control');
  assert.equal(worksite.final.length, worksite.fixture.legalWorkerSlots);
  assert.ok(worksite.final.every(worker => (
    worker.profession === 'miner'
    && worker.variant === 'miner'
    && worker.assignment?.duty === 'mine'
    && worker.assignment?.purpose === 'vocation'
  )));
  assert.ok(worksite.final.every(worker => worker.activity === 'working'));
  assert.ok(
    worksite.minimumSeparation >= MINIMUM_ACTOR_SEPARATION,
    `worksite separation fell to ${worksite.minimumSeparation}`,
  );
  assert.ok(worksite.totalBlockedTimeTicks <= 120, `worksite traffic blocked for ${worksite.totalBlockedTimeTicks} ticks`);

  const invalidation = baseline.scenarios.dynamicObstacleInvalidation;
  assert.equal(invalidation.classification, 'control');
  assert.ok(invalidation.obstacleEpochInvalidationLatencyTicks <= 1, `obstacle invalidation took ${invalidation.obstacleEpochInvalidationLatencyTicks} ticks`);
  assert.equal(invalidation.replanCount, 1, 'dynamic obstacle must replan exactly once in the recorded fixture');
  assert.ok(invalidation.blockedTimeTicks <= 1, `dynamic obstacle blocked movement for ${invalidation.blockedTimeTicks} ticks`);

  const mixed = baseline.scenarios.mixedGroundActorTraffic;
  assert.equal(mixed.classification, 'control');
  assert.ok(mixed.minimumSeparation >= MINIMUM_ACTOR_SEPARATION, `mixed actor separation fell to ${mixed.minimumSeparation}`);
}

const baseline = runSuite();
assertCorrectness(baseline);
const rerun = runSuite();
assertCorrectness(rerun);
assert.deepEqual(rerun, baseline, 'complete traffic baseline must repeat exactly after a clean world reset');

const findings = Object.entries(baseline.scenarios).filter(([, scenario]) => scenario.classification === 'known-defect');
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(baseline, null, 2));
} else {
  const worksite = baseline.scenarios.worksiteCongestion;
  console.log(`[phase0c-traffic-baseline] realm=${baseline.recordedRevision}; worksite paths=${worksite.pathCallCount}, replans=${worksite.replanCount}, blocked=${worksite.totalBlockedTimeTicks}`);
  for (const [name, scenario] of Object.entries(baseline.scenarios)) {
    const detail = name === 'worksiteCongestion'
      ? `minimum separation=${scenario.minimumSeparation}, inside-personal-space=${scenario.ticksInsidePersonalSpace} ticks`
      : name === 'dynamicObstacleInvalidation'
        ? `invalidation latency=${scenario.obstacleEpochInvalidationLatencyTicks} ticks, blocked=${scenario.blockedTimeTicks}`
        : `minimum separation=${scenario.minimumSeparation}, four-at-center=${scenario.ticksWithAllFourAtCenter} ticks`;
    console.log(`  ${scenario.classification === 'control' ? '✓' : '!'} ${name}: ${detail}`);
  }
  console.log(`[phase0c-traffic-baseline] CORRECTNESS VERIFIED; ${findings.length} known defects remain`);
}

if (process.argv.includes('--require-correct') && findings.length) {
  console.error(`[phase0c-traffic-baseline] CORRECTNESS FAILED: ${findings.length} recorded traffic defects remain`);
  process.exitCode = 1;
}
