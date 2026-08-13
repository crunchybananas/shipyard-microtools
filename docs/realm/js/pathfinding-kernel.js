// Pure deterministic pathfinding kernel. This module deliberately owns no
// Realm state and touches no platform APIs, so the main thread, a module
// Worker, and headless Node all execute the exact same search implementation.

export const GRID_BLOCKED = 0;
export const GRID_GROUND = 1;
export const GRID_ROAD = 2;

const DIRS = Object.freeze([
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
]);
const SQRT2 = Math.SQRT2;
const MIN_MOVE_COST = 0.5;
const COST_EPSILON = 1e-12;

class BinaryHeap {
  constructor() { this.data = []; }
  get size() { return this.data.length; }
  push(entry) {
    this.data.push(entry);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  _compare(a, b) {
    return (a.f - b.f) || (a.h - b.h) || (a.node - b.node);
  }
  _bubbleUp(index) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this._compare(this.data[parent], this.data[index]) <= 0) break;
      [this.data[parent], this.data[index]] = [this.data[index], this.data[parent]];
      index = parent;
    }
  }
  _sinkDown(index) {
    const length = this.data.length;
    while (true) {
      let best = index;
      const left = index * 2 + 1;
      const right = left + 1;
      if (left < length && this._compare(this.data[left], this.data[best]) < 0) best = left;
      if (right < length && this._compare(this.data[right], this.data[best]) < 0) best = right;
      if (best === index) break;
      [this.data[best], this.data[index]] = [this.data[index], this.data[best]];
      index = best;
    }
  }
}
function assertDimension(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer.`);
}

export function createPathfindingGridSnapshot({
  width,
  height,
  obstacleEpoch,
  map,
  buildingGrid,
  blockedTerrain,
} = {}) {
  assertDimension(width, 'Grid width');
  assertDimension(height, 'Grid height');
  if (!Number.isSafeInteger(obstacleEpoch) || obstacleEpoch < 0) {
    throw new TypeError('Grid obstacleEpoch must be a non-negative integer.');
  }
  if (!Array.isArray(map) || !Array.isArray(buildingGrid)) {
    throw new TypeError('Grid snapshot requires map and buildingGrid arrays.');
  }
  const blocked = new Set(blockedTerrain || []);
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const building = buildingGrid[y]?.[x];
      cells[y * width + x] = blocked.has(map[y]?.[x])
        ? GRID_BLOCKED
        : building && building.type !== 'road'
          ? GRID_BLOCKED
          : building?.type === 'road'
            ? GRID_ROAD
            : GRID_GROUND;
    }
  }
  return { width, height, obstacleEpoch, cells };
}

function validSnapshot(grid) {
  return !!grid
    && Number.isSafeInteger(grid.width) && grid.width > 0
    && Number.isSafeInteger(grid.height) && grid.height > 0
    && Number.isSafeInteger(grid.obstacleEpoch) && grid.obstacleEpoch >= 0
    && grid.cells instanceof Uint8Array
    && grid.cells.length === grid.width * grid.height;
}

export function isGridCellWalkable(grid, x, y) {
  return validSnapshot(grid)
    && Number.isInteger(x) && Number.isInteger(y)
    && x >= 0 && x < grid.width && y >= 0 && y < grid.height
    && grid.cells[y * grid.width + x] !== GRID_BLOCKED;
}

function moveCost(grid, x, y) {
  return grid.cells[y * grid.width + x] === GRID_ROAD ? 0.5 : 1;
}

export function nearestWalkableGridTile(grid, x, y, maxR = 5, fromX = x, fromY = y) {
  if (!validSnapshot(grid)) throw new TypeError('Invalid pathfinding grid snapshot.');
  if (isGridCellWalkable(grid, x, y)) return { x, y };
  for (let radius = 1; radius <= maxR; radius++) {
    let best = null;
    let bestDistance = Infinity;
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (Math.abs(xx - x) !== radius && Math.abs(yy - y) !== radius) continue;
        if (!isGridCellWalkable(grid, xx, yy)) continue;
        const distance = Math.abs(xx - fromX) + Math.abs(yy - fromY)
          + (Math.abs(xx - x) + Math.abs(yy - y)) * 0.1;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x: xx, y: yy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function walkableRing(grid, x, y, radius) {
  const goals = [];
  for (let yy = y - radius; yy <= y + radius; yy++) {
    for (let xx = x - radius; xx <= x + radius; xx++) {
      if (Math.abs(xx - x) !== radius && Math.abs(yy - y) !== radius) continue;
      if (isGridCellWalkable(grid, xx, yy)) goals.push({ x: xx, y: yy });
    }
  }
  goals.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return goals;
}

function endpointCandidates(grid, x, y, maxRadius = 7) {
  if (isGridCellWalkable(grid, x, y)) return [{ x, y, radius: 0 }];
  const goals = [];
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (const goal of walkableRing(grid, x, y, radius)) goals.push({ ...goal, radius });
  }
  return goals;
}

function heuristic(x1, y1, x2, y2) {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * MIN_MOVE_COST;
}

function heuristicToGoals(x, y, goals) {
  let best = Infinity;
  for (const goal of goals) best = Math.min(best, heuristic(x, y, goal.x, goal.y));
  return best;
}

function reconstructPath(cameFrom, current, width) {
  const path = [];
  while (cameFrom.has(current)) {
    path.push({ x: current % width, y: (current / width) | 0 });
    current = cameFrom.get(current);
  }
  return path.reverse();
}

function emptyResult(expandedNodes = 0) {
  return { path: null, goal: null, expandedNodes };
}

export function findPathOnGrid(grid, sx, sy, ex, ey, maxIter = grid?.width * grid?.height) {
  if (!validSnapshot(grid)) throw new TypeError('Invalid pathfinding grid snapshot.');
  sx = Math.round(sx); sy = Math.round(sy);
  ex = Math.round(ex); ey = Math.round(ey);
  const start = nearestWalkableGridTile(grid, sx, sy, 2);
  const goals = endpointCandidates(grid, ex, ey, 7);
  if (!start || goals.length === 0) return emptyResult();
  sx = start.x; sy = start.y;
  const maxExpanded = Number.isFinite(maxIter)
    ? Math.max(0, Math.floor(maxIter))
    : grid.width * grid.height;

  const key = (x, y) => y * grid.width + x;
  const goalKeys = new Set(goals.map(goal => key(goal.x, goal.y)));
  const goalByKey = new Map(goals.map(goal => [key(goal.x, goal.y), goal]));
  const targetRadius = Math.min(...goals.map(goal => goal.radius));
  const targetGoals = goals.filter(goal => goal.radius === targetRadius);
  const startKey = key(sx, sy);
  if (goalKeys.has(startKey) && goalByKey.get(startKey).radius === targetRadius) {
    const goal = goalByKey.get(startKey);
    return { path: [{ x: goal.x, y: goal.y }], goal: { x: goal.x, y: goal.y }, expandedNodes: 0 };
  }

  const gScore = new Map();
  const cameFrom = new Map();
  const open = new BinaryHeap();
  const closed = new Set();
  const startH = heuristicToGoals(sx, sy, targetGoals);
  gScore.set(startKey, 0);
  open.push({ node: startKey, g: 0, h: startH, f: startH });

  let expandedNodes = 0;
  let bestGoalKey = null;
  let bestGoalCost = Infinity;
  let bestGoalRadius = Infinity;
  let budgetExhausted = false;
  while (open.size > 0) {
    const entry = open.pop();
    if (!entry) break;
    if (closed.has(entry.node) || entry.g !== gScore.get(entry.node)) continue;
    if (bestGoalRadius === targetRadius && entry.f > bestGoalCost + COST_EPSILON) break;
    if (expandedNodes >= maxExpanded) {
      budgetExhausted = true;
      break;
    }

    closed.add(entry.node);
    expandedNodes++;
    if (goalKeys.has(entry.node)) {
      const radius = goalByKey.get(entry.node).radius;
      if (
        radius < bestGoalRadius
        || (radius === bestGoalRadius && (
          entry.g < bestGoalCost - COST_EPSILON
          || (Math.abs(entry.g - bestGoalCost) <= COST_EPSILON
            && (bestGoalKey === null || entry.node < bestGoalKey))
        ))
      ) {
        bestGoalKey = entry.node;
        bestGoalCost = entry.g;
        bestGoalRadius = radius;
      }
      if (radius === targetRadius) continue;
    }

    const cx = entry.node % grid.width;
    const cy = (entry.node / grid.width) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isGridCellWalkable(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0
        && (!isGridCellWalkable(grid, cx + dx, cy) || !isGridCellWalkable(grid, cx, cy + dy))) continue;
      const nextKey = key(nx, ny);
      if (closed.has(nextKey)) continue;
      const stepCost = dx !== 0 && dy !== 0 ? SQRT2 : 1;
      const tentative = entry.g + stepCost * moveCost(grid, nx, ny);
      if (tentative < (gScore.get(nextKey) ?? Infinity)) {
        const h = heuristicToGoals(nx, ny, targetGoals);
        gScore.set(nextKey, tentative);
        cameFrom.set(nextKey, entry.node);
        open.push({ node: nextKey, g: tentative, h, f: tentative + h });
      }
    }
  }

  if (budgetExhausted && bestGoalRadius > targetRadius) return emptyResult(expandedNodes);
  if (bestGoalKey === null) return emptyResult(expandedNodes);
  const goal = goalByKey.get(bestGoalKey);
  return {
    path: reconstructPath(cameFrom, bestGoalKey, grid.width),
    goal: { x: goal.x, y: goal.y },
    expandedNodes,
  };
}
