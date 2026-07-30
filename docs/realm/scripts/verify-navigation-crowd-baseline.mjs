// Deterministic Engine-v2 Phase 0C navigation/crowd baseline.
//
// Former defect baseline, promoted to a correctness gate. The independent
// controls and deterministic rerun remain, but weighted routing and crowd
// separation must now satisfy their acceptance thresholds.

import assert from 'node:assert/strict';
import runtimeContract from '../runtime-contract.json?realm=183' with { type: 'json' };
import {
  G,
  MAP_H,
  MAP_W,
  TILE,
  setSeed,
} from '../js/state.js?realm=183';
import {
  findPath,
  stepEntityToward,
} from '../js/pathfinding.js?realm=183';
import { updateCitizens } from '../js/citizens.js?realm=183';

const SQRT2 = Math.SQRT2;
const MINIMUM_ACTOR_SEPARATION = 0.58;
const DIRS = Object.freeze([
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
]);

function rounded(value, digits = 12) {
  return Number(value.toFixed(digits));
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function lastPoint(path) {
  return path?.[path.length - 1] || null;
}

function configureWorld(fill = TILE.GRASS) {
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
  G.fog = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.buildings = [];
  G.citizens = [];
  G.soldiers = [];
  G.enemies = [];
  G.particles = [];
  G.tileWear = null;
  G.resources = {
    wood: 0, stone: 0, food: 100, gold: 0, iron: 0,
    wheat: 0, flour: 0, planks: 0, tools: 0,
  };
  G.population = 0;
  G.nextActorId = 1;
  G.day = 1;
  G.dayLength = 3600;
  G.dayPhase = G.dayLength / 2;
  G.gameTick = 0;
  G.speed = 1;
  G.season = 'spring';
  G.weather = 'clear';
  G.obstacleEpoch = 1;
  G.eventModifiers = {
    foodProd: 1,
    goldProd: 1,
    happinessOffset: 0,
    speedMult: 1,
  };
  setSeed(1);
}

function makeBuilding(type, x, y) {
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
  };
}

function addRoad(x, y) {
  const road = makeBuilding('road', x, y);
  G.buildings.push(road);
  G.buildingGrid[y][x] = road;
}

function fixtureWalkable(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  const tile = G.map[y][x];
  if (tile === TILE.WATER || tile === TILE.MOUNTAIN) return false;
  const building = G.buildingGrid[y]?.[x];
  return !building || building.type === 'road';
}

function fixtureMoveCost(x, y) {
  return G.buildingGrid[y]?.[x]?.type === 'road' ? 0.5 : 1;
}

class OracleHeap {
  constructor() {
    this.nodes = [];
  }

  get size() {
    return this.nodes.length;
  }

  push(key, cost) {
    const entry = { key, cost };
    this.nodes.push(entry);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.nodes[parent].cost <= cost) break;
      this.nodes[index] = this.nodes[parent];
      index = parent;
    }
    this.nodes[index] = entry;
  }

  pop() {
    if (!this.nodes.length) return null;
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (this.nodes.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.nodes.length) break;
        let child = left;
        if (right < this.nodes.length && this.nodes[right].cost < this.nodes[left].cost) child = right;
        if (this.nodes[child].cost >= last.cost) break;
        this.nodes[index] = this.nodes[child];
        index = child;
      }
      this.nodes[index] = last;
    }
    return first;
  }
}

// Independent Dijkstra oracle. It intentionally shares no search structures,
// heuristic, nearest-goal snapping, or closed-set policy with pathfinding.js.
function dijkstra(start, goal) {
  if (!fixtureWalkable(start.x, start.y) || !fixtureWalkable(goal.x, goal.y)) return null;
  const startKey = start.y * MAP_W + start.x;
  const goalKey = goal.y * MAP_W + goal.x;
  const distance = new Float64Array(MAP_W * MAP_H);
  distance.fill(Infinity);
  const previous = new Int32Array(MAP_W * MAP_H);
  previous.fill(-1);
  const settled = new Uint8Array(MAP_W * MAP_H);
  const heap = new OracleHeap();
  distance[startKey] = 0;
  heap.push(startKey, 0);

  while (heap.size) {
    const current = heap.pop();
    if (!current || settled[current.key]) continue;
    if (current.cost !== distance[current.key]) continue;
    settled[current.key] = 1;
    if (current.key === goalKey) break;

    const x = current.key % MAP_W;
    const y = (current.key / MAP_W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!fixtureWalkable(nx, ny)) continue;
      if (dx && dy && (!fixtureWalkable(x + dx, y) || !fixtureWalkable(x, y + dy))) continue;
      const nextKey = ny * MAP_W + nx;
      if (settled[nextKey]) continue;
      const stepDistance = dx && dy ? SQRT2 : 1;
      const nextCost = current.cost + stepDistance * fixtureMoveCost(nx, ny);
      if (nextCost >= distance[nextKey]) continue;
      distance[nextKey] = nextCost;
      previous[nextKey] = current.key;
      heap.push(nextKey, nextCost);
    }
  }

  if (!Number.isFinite(distance[goalKey])) return null;
  const path = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    assert.notEqual(cursor, -1, 'Dijkstra predecessor chain must reach its start');
    path.unshift({ x: cursor % MAP_W, y: (cursor / MAP_W) | 0 });
    cursor = previous[cursor];
  }
  return { path, cost: distance[goalKey] };
}

function routeMetrics(start, path) {
  let previous = start;
  let cost = 0;
  let roadSteps = 0;
  for (const point of path || []) {
    const dx = Math.abs(point.x - previous.x);
    const dy = Math.abs(point.y - previous.y);
    assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0, `route contains a non-adjacent step ${pointKey(previous)} -> ${pointKey(point)}`);
    const onRoad = G.buildingGrid[point.y]?.[point.x]?.type === 'road';
    cost += (dx && dy ? SQRT2 : 1) * (onRoad ? 0.5 : 1);
    if (onRoad) roadSteps++;
    previous = point;
  }
  return { cost, roadSteps };
}

function weightedAStarFinding() {
  configureWorld();
  const start = { x: 10, y: 10 };
  const goal = { x: 21, y: 10 };
  // The first road step is diagonal and initially has f=11.121..., while
  // every direct grass node has f=11. A* settles the goal before exploring
  // the cheaper road row. The final diagonal lands on grass, yielding the
  // exact independent optimum 9*0.5 + sqrt(2)*0.5 + sqrt(2).
  for (let x = 11; x <= 20; x++) addRoad(x, 11);

  const astarPath = findPath(start.x, start.y, goal.x, goal.y);
  const oracle = dijkstra(start, goal);
  assert.ok(astarPath, 'weighted fixture must produce an A* route');
  assert.ok(oracle, 'weighted fixture must produce a Dijkstra route');
  assert.deepEqual(lastPoint(astarPath), goal, 'A* route must reach the exact requested goal');
  assert.deepEqual(lastPoint(oracle.path), goal, 'Dijkstra route must reach the exact requested goal');
  const astar = routeMetrics(start, astarPath);
  const oracleMetrics = routeMetrics(start, oracle.path);
  assert.equal(rounded(astar.cost), rounded(oracle.cost), 'weighted A* must match the independent Dijkstra oracle');
  assert.equal(rounded(oracleMetrics.cost), rounded(oracle.cost));
  assert.equal(astar.roadSteps, oracleMetrics.roadSteps, 'weighted A* must select the same number of road steps as the oracle');

  return {
    classification: 'control',
    start,
    goal,
    roadTiles: Array.from({ length: 10 }, (_, index) => ({ x: 11 + index, y: 11 })),
    astarCost: rounded(astar.cost),
    oracleCost: rounded(oracle.cost),
    costGap: rounded(astar.cost - oracle.cost),
    astarRoadSteps: astar.roadSteps,
    oracleRoadSteps: oracleMetrics.roadSteps,
    astarPath: astarPath.map(pointKey),
    oraclePath: oracle.path.map(pointKey),
  };
}

function diagonalCornerControls() {
  const start = { x: 10, y: 10 };
  const goal = { x: 11, y: 11 };

  configureWorld(TILE.WATER);
  for (const point of [start, goal, { x: 11, y: 10 }, { x: 10, y: 11 }]) G.map[point.y][point.x] = TILE.GRASS;
  const openPath = findPath(start.x, start.y, goal.x, goal.y);
  const openOracle = dijkstra(start, goal);
  const openMover = { x: start.x, y: start.y };
  const openMoved = stepEntityToward(openMover, goal.x, goal.y, 2);
  assert.deepEqual(openPath, Object.assign([{ ...goal }], { goal: { ...goal } }), 'open diagonal should be one A* step');
  assert.ok(openOracle, 'open diagonal should be reachable to Dijkstra');
  assert.equal(rounded(openOracle.cost), rounded(SQRT2));
  assert.equal(openMoved, true, 'straight mover should cross a fully open diagonal');
  assert.deepEqual(openMover, goal, 'open diagonal mover should reach its goal');

  configureWorld(TILE.WATER);
  G.map[start.y][start.x] = TILE.GRASS;
  G.map[goal.y][goal.x] = TILE.GRASS;
  const closedPath = findPath(start.x, start.y, goal.x, goal.y);
  const closedOracle = dijkstra(start, goal);
  const closedMover = { x: start.x, y: start.y };
  const closedMoved = stepEntityToward(closedMover, goal.x, goal.y, 2);
  assert.equal(closedPath, null, 'A* must not cut between two blocked orthogonal tiles');
  assert.equal(closedOracle, null, 'Dijkstra control must also reject the closed corner');
  assert.equal(closedMoved, false, 'straight mover must not cut the same closed corner');
  assert.deepEqual(closedMover, start, 'blocked diagonal mover must stay put');

  return {
    classification: 'control',
    openDiagonalCost: rounded(SQRT2),
    openDiagonalSteps: openPath.length,
    closedDiagonalAStar: closedPath,
    closedDiagonalOracle: closedOracle,
    closedDiagonalMoverMoved: closedMoved,
  };
}

function unreachableControls() {
  const start = { x: 9, y: 10 };
  const goal = { x: 31, y: 10 };
  configureWorld(TILE.WATER);
  for (let y = 9; y <= 11; y++) {
    for (let x = 8; x <= 10; x++) G.map[y][x] = TILE.GRASS;
    for (let x = 30; x <= 32; x++) G.map[y][x] = TILE.GRASS;
  }
  const disconnectedPath = findPath(start.x, start.y, goal.x, goal.y);
  const disconnectedOracle = dijkstra(start, goal);
  assert.equal(disconnectedPath, null, 'A* must report two walkable but disconnected islands as unreachable');
  assert.equal(disconnectedOracle, null, 'Dijkstra must confirm the disconnected control');

  for (let x = start.x; x <= goal.x; x++) G.map[10][x] = TILE.GRASS;
  const connectedPath = findPath(start.x, start.y, goal.x, goal.y);
  const connectedOracle = dijkstra(start, goal);
  assert.ok(connectedPath, 'opening a one-tile corridor must make the same endpoints reachable');
  assert.ok(connectedOracle, 'Dijkstra must reach the opened control corridor');
  assert.deepEqual(lastPoint(connectedPath), goal);
  assert.deepEqual(lastPoint(connectedOracle.path), goal);
  assert.equal(rounded(routeMetrics(start, connectedPath).cost), 22);
  assert.equal(rounded(connectedOracle.cost), 22);

  return {
    classification: 'control',
    start,
    goal,
    disconnectedAStar: disconnectedPath,
    disconnectedOracle,
    connectedCost: rounded(connectedOracle.cost),
    connectedSteps: connectedPath.length,
  };
}

function makeMovingCitizen(name, start, goal, heartbeat) {
  const path = findPath(start.x, start.y, goal.x, goal.y);
  assert.ok(path, `${name} must start with a valid authored path`);
  assert.deepEqual(lastPoint(path), goal, `${name} path must reach its exact goal`);
  const actorId = G.nextActorId++;
  return {
    actorId,
    identity: {
      name,
      appearanceId: `identity-${String(((actorId - 1) % 2) + 1).padStart(2, '0')}`,
    },
    profession: { kind: 'settler', sinceTick: 0, reason: 'spawn-settler' },
    assignment: null,
    activity: { kind: 'idle', sinceTick: 0, reason: 'spawn-idle' },
    activityTimer: 100,
    x: start.x,
    y: start.y,
    tx: goal.x,
    ty: goal.y,
    faceX: 0,
    faceZ: 0,
    speed: 0.03,
    hunger: 0,
    rest: 100,
    needs: { joy: 55, faith: 55 },
    path,
    pathIdx: 0,
    _requestedTx: goal.x,
    _requestedTy: goal.y,
    _pathEpoch: G.obstacleEpoch,
    _pathStartedAt: 0,
    _hb: heartbeat,
    carrying: null,
    carryAmount: 0,
  };
}

function runOpposingPair({ firstStart, firstGoal, secondStart, secondGoal, ticks }) {
  const first = makeMovingCitizen('Traffic A', firstStart, firstGoal, 1);
  const second = makeMovingCitizen('Traffic B', secondStart, secondGoal, 1);
  G.citizens = [first, second];
  G.population = 2;
  const initialOrder = first.x - second.x;
  let previousOrder = initialOrder;
  let minimumSeparation = Infinity;
  let minimumTick = null;
  let crossingTick = null;
  let crossingDistance = null;
  let ticksInsidePersonalSpace = 0;

  for (let tick = 1; tick <= ticks; tick++) {
    G.gameTick = tick;
    updateCitizens();
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (distance < minimumSeparation) {
      minimumSeparation = distance;
      minimumTick = tick;
    }
    if (distance < 0.5) ticksInsidePersonalSpace++;
    const order = first.x - second.x;
    if (crossingTick === null && previousOrder < 0 && order >= 0) {
      crossingTick = tick;
      crossingDistance = distance;
    }
    previousOrder = order;
    assert.ok(Number.isFinite(first.x) && Number.isFinite(first.y));
    assert.ok(Number.isFinite(second.x) && Number.isFinite(second.y));
  }

  assert.ok(initialOrder < 0, 'opposing pair control must begin in left-to-right order');
  assert.ok(
    first.x > second.x,
    `opposing pair must actually exchange order, not merely approach: first=${first.x},${first.y} second=${second.x},${second.y}`,
  );
  assert.notEqual(crossingTick, null, 'opposing pair must cross within the bounded run');
  return {
    minimumSeparation: rounded(minimumSeparation),
    minimumTick,
    crossingTick,
    crossingDistance: rounded(crossingDistance),
    ticksInsidePersonalSpace,
    final: {
      first: { x: rounded(first.x), y: rounded(first.y) },
      second: { x: rounded(second.x), y: rounded(second.y) },
    },
  };
}

function headOnFinding() {
  configureWorld();
  const metrics = runOpposingPair({
    firstStart: { x: 20, y: 20 },
    firstGoal: { x: 24, y: 20 },
    secondStart: { x: 22, y: 20 },
    secondGoal: { x: 18, y: 20 },
    ticks: 80,
  });
  assert.ok(metrics.minimumSeparation >= MINIMUM_ACTOR_SEPARATION, `head-on separation fell to ${metrics.minimumSeparation}`);
  return { classification: 'control', ...metrics };
}

function doorwayFinding() {
  configureWorld();
  // A full-height mountain wall with exactly one open cell at (20,20).
  for (let y = 0; y < MAP_H; y++) if (y !== 20) G.map[y][20] = TILE.MOUNTAIN;
  const metrics = runOpposingPair({
    firstStart: { x: 18, y: 20 },
    firstGoal: { x: 22, y: 20 },
    secondStart: { x: 22, y: 20 },
    secondGoal: { x: 18, y: 20 },
    ticks: 110,
  });
  assert.ok(metrics.minimumSeparation >= MINIMUM_ACTOR_SEPARATION, `doorway separation fell to ${metrics.minimumSeparation}`);
  return {
    classification: 'control',
    doorway: { x: 20, y: 20, widthTiles: 1 },
    ...metrics,
  };
}

function intersectionFinding() {
  configureWorld();
  const west = makeMovingCitizen('West', { x: 18, y: 20 }, { x: 22, y: 20 }, 1);
  const east = makeMovingCitizen('East', { x: 22, y: 20 }, { x: 18, y: 20 }, 2);
  const north = makeMovingCitizen('North', { x: 20, y: 18 }, { x: 20, y: 22 }, 3);
  const south = makeMovingCitizen('South', { x: 20, y: 22 }, { x: 20, y: 18 }, 4);
  const citizens = [west, east, north, south];
  const goals = new Map([
    [west, { x: 22, y: 20 }],
    [east, { x: 18, y: 20 }],
    [north, { x: 20, y: 22 }],
    [south, { x: 20, y: 18 }],
  ]);
  G.citizens = citizens;
  G.population = citizens.length;

  let minimumSeparation = Infinity;
  let minimumTick = null;
  let minimumPair = null;
  let maximumCenterOccupancy = 0;
  let ticksWithThreeOrMoreAtCenter = 0;
  let ticksWithFourAtCenter = 0;
  let horizontalCrossingTick = null;
  let verticalCrossingTick = null;
  let allRoutesCompleteTick = null;
  const completedRoutes = new Set();
  let priorHorizontalOrder = west.x - east.x;
  let priorVerticalOrder = north.y - south.y;

  for (let tick = 1; tick <= 360; tick++) {
    G.gameTick = tick;
    updateCitizens();
    for (let first = 0; first < citizens.length; first++) {
      for (let second = first + 1; second < citizens.length; second++) {
        const distance = Math.hypot(
          citizens[first].x - citizens[second].x,
          citizens[first].y - citizens[second].y,
        );
        if (distance < minimumSeparation) {
          minimumSeparation = distance;
          minimumTick = tick;
          minimumPair = [citizens[first].identity.name, citizens[second].identity.name];
        }
      }
    }
    const centerOccupancy = citizens.filter(citizen => Math.hypot(citizen.x - 20, citizen.y - 20) < 0.5).length;
    maximumCenterOccupancy = Math.max(maximumCenterOccupancy, centerOccupancy);
    if (centerOccupancy >= 3) ticksWithThreeOrMoreAtCenter++;
    if (centerOccupancy === 4) ticksWithFourAtCenter++;

    const horizontalOrder = west.x - east.x;
    if (horizontalCrossingTick === null && priorHorizontalOrder < 0 && horizontalOrder >= 0) horizontalCrossingTick = tick;
    priorHorizontalOrder = horizontalOrder;
    const verticalOrder = north.y - south.y;
    if (verticalCrossingTick === null && priorVerticalOrder < 0 && verticalOrder >= 0) verticalCrossingTick = tick;
    priorVerticalOrder = verticalOrder;
    for (const citizen of citizens) {
      const goal = goals.get(citizen);
      // Separation may immediately move a newly arrived actor off the exact
      // waypoint to preserve personal space. Reaching the goal's half-tile
      // arrival area is the real navigation contract.
      if (Math.hypot(citizen.x - goal.x, citizen.y - goal.y) < 0.55) completedRoutes.add(citizen);
    }
    if (allRoutesCompleteTick === null && completedRoutes.size === citizens.length) {
      allRoutesCompleteTick = tick;
      break;
    }
  }

  const metrics = {
    classification: 'control',
    center: { x: 20, y: 20, occupancyRadius: 0.5 },
    minimumSeparation: rounded(minimumSeparation),
    minimumTick,
    minimumPair,
    horizontalCrossingTick,
    verticalCrossingTick,
    maximumCenterOccupancy,
    ticksWithThreeOrMoreAtCenter,
    ticksWithFourAtCenter,
    allRoutesCompleteTick,
  };
  assert.ok(
    minimumSeparation >= MINIMUM_ACTOR_SEPARATION,
    `intersection separation fell to ${metrics.minimumSeparation} at tick ${minimumTick} (${minimumPair?.join(' / ')})`,
  );
  assert.ok(horizontalCrossingTick && verticalCrossingTick, 'both opposing axes must exchange order');
  assert.notEqual(
    allRoutesCompleteTick,
    null,
    `all intersection routes must complete within the bounded run: ${citizens.map(citizen => `${citizen.identity.name}@${rounded(citizen.x)},${rounded(citizen.y)}:${citizen.pathIdx}/${citizen.path?.length ?? 0}`).join(' ')}`,
  );
  return metrics;
}

function runSuite() {
  return {
    schema: 'realm.engine-v2.navigation-crowd-baseline',
    schemaVersion: 1,
    promotedAtRevision: runtimeContract.moduleRevision,
    reproducedRuntime: {
      moduleRevision: runtimeContract.moduleRevision,
      simulationVersion: runtimeContract.simulationVersion,
      coreSystemOrderVersion: runtimeContract.coreSystemOrderVersion,
    },
    controls: {
      diagonalCorners: diagonalCornerControls(),
      unreachable: unreachableControls(),
    },
    findings: {
      weightedAStar: weightedAStarFinding(),
      headOn: headOnFinding(),
      doorway: doorwayFinding(),
      intersection: intersectionFinding(),
    },
  };
}

const baseline = runSuite();
const rerun = runSuite();
assert.deepEqual(rerun, baseline, 'complete Phase 0C suite must be deterministic across a clean state reset');

const findings = Object.entries(baseline.findings);
const defects = findings.filter(([, finding]) => finding.classification === 'known-defect');
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(baseline, null, 2));
} else {
  console.log('[navigation-crowd-baseline] controls verified: diagonal/corner rules and connected/disconnected reachability');
  for (const [name, finding] of findings) {
    const summary = name === 'weightedAStar'
      ? `A*=${finding.astarCost}, oracle=${finding.oracleCost}, gap=${finding.costGap}`
      : name === 'intersection'
        ? `min=${finding.minimumSeparation}, four-at-center=${finding.ticksWithFourAtCenter} ticks`
        : `min=${finding.minimumSeparation}, crossed-at=${finding.crossingTick}`;
    console.log(`  ${finding.classification === 'control' ? '✓' : '!'} ${name}: ${summary}`);
  }
  console.log(`[navigation-crowd-baseline] CORRECTNESS VERIFIED on runtime realm=${runtimeContract.moduleRevision}; ${defects.length} known defects remain`);
}

if (process.argv.includes('--require-correct') && defects.length) {
  console.error(`[navigation-crowd-baseline] CORRECTNESS FAILED: ${defects.length} recorded navigation/crowd defects remain`);
  process.exitCode = 1;
}
