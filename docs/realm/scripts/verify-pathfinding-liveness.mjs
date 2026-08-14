import assert from 'node:assert/strict';
import { G, MAP_H, MAP_W, TILE } from '../js/state.js?realm=195';
import {
  findPath,
  getPathfindingDiagnostics,
} from '../js/pathfinding.js?realm=195';
import { resolveGroundTraffic } from '../js/ground-traffic.js?realm=195';

function configureWorld(fill = TILE.GRASS) {
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
}

function addOpen(x, y) {
  G.map[y][x] = TILE.GRASS;
}

function addBuilding(type, x, y) {
  const building = { type, x, y };
  G.buildingGrid[y][x] = building;
  return building;
}

function assertRouteTopology(path, start) {
  let previous = start;
  for (const point of path) {
    const dx = Math.abs(point.x - previous.x);
    const dy = Math.abs(point.y - previous.y);
    assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0, `non-adjacent route step ${previous.x},${previous.y} -> ${point.x},${point.y}`);
    if (dx && dy) {
      assert.equal(G.buildingGrid[previous.y]?.[point.x] ?? null, null, 'diagonal route crossed a blocked horizontal neighbour');
      assert.equal(G.buildingGrid[point.y]?.[previous.x] ?? null, null, 'diagonal route crossed a blocked vertical neighbour');
    }
    previous = point;
  }
}

function longMapRoute() {
  configureWorld();
  const start = { x: 2, y: 2 };
  const goal = { x: 70, y: 55 };
  const path = findPath(start.x, start.y, goal.x, goal.y);
  const diagnostics = getPathfindingDiagnostics();
  assert.ok(path, 'default planner budget must cross the 80x80 map');
  assert.deepEqual(path.goal, goal);
  assert.deepEqual(path.at(-1), goal);
  assert.equal(path.length, 68, 'empty-map route must use the octile shortest path');
  assert.ok(diagnostics.lastExpandedNodes <= MAP_W * MAP_H, 'search may expand each map cell at most once');
  assertRouteTopology(path, start);

  const bounded = findPath(start.x, start.y, goal.x, goal.y, 1);
  assert.equal(bounded, null, 'legacy numeric fifth argument must remain the expansion cap');
  assert.equal(getPathfindingDiagnostics().lastExpandedNodes, 1);
  return { path: path.map(point => ({ ...point })), expanded: diagnostics.lastExpandedNodes };
}

function reachableBlockedEndpoint() {
  configureWorld(TILE.WATER);
  addOpen(10, 20);
  addOpen(19, 20); // closer by Manhattan distance, but disconnected
  for (let y = 20; y <= 22; y++) addOpen(10, y);
  for (let x = 10; x <= 20; x++) addOpen(x, 22);
  addOpen(20, 21);
  addOpen(20, 20);
  addBuilding('house', 20, 20);

  const path = findPath(10, 20, 20, 20);
  assert.ok(path, 'planner must try every endpoint in the nearest walkable ring');
  assert.deepEqual(path.goal, { x: 20, y: 21 }, 'planner must select the reachable adjacent endpoint');
  assert.deepEqual(path.at(-1), path.goal);
  return path.map(point => ({ ...point }));
}

function fartherReachableEndpoint() {
  configureWorld(TILE.WATER);
  addOpen(20, 20);
  addBuilding('house', 20, 20);
  addOpen(19, 20); // the sole radius-one candidate is disconnected
  for (let x = 10; x <= 18; x++) addOpen(x, 22);

  const path = findPath(10, 22, 20, 20);
  assert.ok(path, 'planner must advance outward after proving the nearer endpoint ring unreachable');
  assert.equal(
    Math.max(Math.abs(path.goal.x - 20), Math.abs(path.goal.y - 20)),
    2,
    'fallback endpoint must come from the next reachable radius',
  );
  assert.deepEqual(path.at(-1), path.goal);
  return path.map(point => ({ ...point }));
}

function endpointCostAndTie() {
  function symmetricFixture(withEastRoad) {
    configureWorld(TILE.WATER);
    addOpen(20, 10);
    addOpen(20, 20);
    addBuilding('house', 20, 20);
    for (const x of [19, 21]) {
      addOpen(x, 10);
      for (let y = 11; y <= 20; y++) addOpen(x, y);
    }
    if (withEastRoad) {
      for (let y = 10; y <= 20; y++) addBuilding('road', 21, y);
    }
    return findPath(20, 10, 20, 20);
  }

  const lowerCost = symmetricFixture(true);
  assert.ok(lowerCost);
  assert.deepEqual(lowerCost.goal, { x: 21, y: 19 }, 'weighted route cost must beat coordinate preference');
  const tied = symmetricFixture(false);
  assert.ok(tied);
  assert.deepEqual(tied.goal, { x: 19, y: 19 }, 'equal-cost endpoints must use row-major coordinate order');
  return { lowerCostGoal: { ...lowerCost.goal }, tiedGoal: { ...tied.goal } };
}

function topologySafeProjection() {
  configureWorld();
  addBuilding('wall', 11, 10);
  addBuilding('wall', 10, 11);
  const diagonal = { x: 10.45, y: 10.45 };
  const diagonalBlocker = { x: 10.1, y: 10.1 };
  resolveGroundTraffic({ movers: [diagonal], blockers: [diagonal, diagonalBlocker] });
  assert.deepEqual(diagonal, { x: 10.45, y: 10.45 }, 'projection must not cross a diagonally closed corner');

  configureWorld();
  addBuilding('wall', 12, 10);
  const swept = { x: 10, y: 10 };
  const sweptBlocker = { x: 9, y: 10 };
  resolveGroundTraffic({
    movers: [swept],
    blockers: [swept, sweptBlocker],
    minimumSpace: 6,
  });
  assert.deepEqual(swept, { x: 10, y: 10 }, 'large projection must not hop over an intervening blocked tile');
  return { diagonal: { ...diagonal }, swept: { ...swept } };
}

function runSuite() {
  return {
    longMap: longMapRoute(),
    reachableEndpoint: reachableBlockedEndpoint(),
    fartherReachableEndpoint: fartherReachableEndpoint(),
    endpointSelection: endpointCostAndTie(),
    projection: topologySafeProjection(),
  };
}

const first = runSuite();
const second = runSuite();
assert.deepEqual(second, first, 'planner and topology projection must rerun deterministically');

console.log(`[pathfinding-liveness] VERIFIED long-route expanded=${first.longMap.expanded}/${MAP_W * MAP_H}; reachable endpoint=${first.endpointSelection.lowerCostGoal.x},${first.endpointSelection.lowerCostGoal.y}; deterministic rerun`);
