// ════════════════════════════════════════════════════════════
// A* Pathfinding — binary heap, 8-directional, road bonus
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js?realm=192';

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
    // Route choice is simulation state. Make every tie explicit instead of
    // inheriting incidental heap-array order from insertion history.
    return (a.f - b.f) || (a.h - b.h) || (a.node - b.node);
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._compare(this.data[p], this.data[i]) <= 0) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let best = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this._compare(this.data[l], this.data[best]) < 0) best = l;
      if (r < n && this._compare(this.data[r], this.data[best]) < 0) best = r;
      if (best === i) break;
      [this.data[best], this.data[i]] = [this.data[i], this.data[best]];
      i = best;
    }
  }
}

export function isWalkable(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  const tile = G.map[y][x];
  if (tile === TILE.WATER || tile === TILE.MOUNTAIN) return false;
  const b = G.buildingGrid[y]?.[x];
  if (b && b.type !== 'road') return false;
  return true;
}

function moveCost(x, y) {
  const b = G.buildingGrid[y]?.[x];
  if (b && b.type === 'road') return 0.5;
  return 1.0;
}

// Shared collision-checked step for straight-line movers (walkers, soldiers,
// raiders, caravans, animals). Validates the destination tile against the
// same walkability model A* plans with, forbids diagonal corner cuts, and
// slides along the blocking axis instead of stopping dead. Returns true if
// the entity moved.
export function stepEntityToward(e, tx, ty, spd, walkableFn = isWalkable) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.0001) return false;
  const step = Math.min(spd, d);
  const cx = Math.round(e.x), cy = Math.round(e.y);
  const candidates = [
    [e.x + (dx / d) * step, e.y + (dy / d) * step],
    [e.x + Math.sign(dx) * step, e.y],
    [e.x, e.y + Math.sign(dy) * step],
  ];
  for (const [nx, ny] of candidates) {
    if (nx === e.x && ny === e.y) continue;
    const rx = Math.round(nx), ry = Math.round(ny);
    // Movement within the entity's current tile is always allowed — an
    // entity spawned or trapped inside a footprint must be able to shuffle
    // to the tile edge and exit, exactly like the citizen escape hatch.
    if (rx === cx && ry === cy) { e.x = nx; e.y = ny; return true; }
    if (!walkableFn(rx, ry)) continue;
    // Mirror the A* no-corner-cut rule on diagonal tile transitions.
    if (rx !== cx && ry !== cy && (!walkableFn(rx, cy) || !walkableFn(cx, ry))) continue;
    e.x = nx; e.y = ny;
    return true;
  }
  return false;
}

const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
const SQRT2 = Math.SQRT2;
const MIN_MOVE_COST = 0.5;
const COST_EPSILON = 1e-12;
let findPathCalls = 0;
let lastExpandedNodes = 0;

// Read-only diagnostic surface for deterministic movement baselines. Keeping
// the counter here is the only reliable way for a harness to include failed
// and internal citizen replans without changing planner inputs or actor state.
// It has no reset API: callers take before/after snapshots, so gameplay code
// cannot steer the value and test fixtures remain isolated from one another.
export function getPathfindingDiagnostics() {
  return Object.freeze({ findPathCalls, lastExpandedNodes });
}

export function nearestWalkableTile(x, y, maxR = 5, fromX = x, fromY = y) {
  if (isWalkable(x, y)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    let best = null;
    let bestD = Infinity;
    for (let yy = y - r; yy <= y + r; yy++) {
      for (let xx = x - r; xx <= x + r; xx++) {
        if (Math.abs(xx - x) !== r && Math.abs(yy - y) !== r) continue;
        if (!isWalkable(xx, yy)) continue;
        const d = Math.abs(xx - fromX) + Math.abs(yy - fromY) + (Math.abs(xx - x) + Math.abs(yy - y)) * 0.1;
        if (d < bestD) {
          bestD = d;
          best = { x: xx, y: yy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function walkableRing(x, y, radius) {
  const goals = [];
  for (let yy = y - radius; yy <= y + radius; yy++) {
    for (let xx = x - radius; xx <= x + radius; xx++) {
      if (Math.abs(xx - x) !== radius && Math.abs(yy - y) !== radius) continue;
      if (isWalkable(xx, yy)) goals.push({ x: xx, y: yy });
    }
  }
  // Row-major coordinate order is the endpoint tie contract.
  goals.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return goals;
}

function endpointCandidates(x, y, maxRadius = 7) {
  if (isWalkable(x, y)) return [{ x, y, radius: 0 }];
  const goals = [];
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (const goal of walkableRing(x, y, radius)) goals.push({ ...goal, radius });
  }
  return goals;
}

function heuristicToGoals(x, y, goals) {
  let best = Infinity;
  for (const goal of goals) {
    best = Math.min(best, heuristic(x, y, goal.x, goal.y));
  }
  return best;
}

function searchGoals(sx, sy, goals, maxExpanded) {
  const key = (x,y) => y * MAP_W + x;
  const goalKeys = new Set(goals.map(goal => key(goal.x, goal.y)));
  const goalByKey = new Map(goals.map(goal => [key(goal.x, goal.y), goal]));
  const targetRadius = Math.min(...goals.map(goal => goal.radius));
  const targetGoals = goals.filter(goal => goal.radius === targetRadius);
  const startKey = key(sx, sy);
  if (goalKeys.has(startKey) && goalByKey.get(startKey).radius === targetRadius) {
    const goal = goalByKey.get(startKey);
    const path = [{ x: goal.x, y: goal.y }];
    path.goal = { x: goal.x, y: goal.y };
    return path;
  }

  const gScore = new Map();
  const cameFrom = new Map();
  const open = new BinaryHeap();
  const closed = new Set();
  // The nearest endpoint radius is semantic priority. Aim A* at that ring;
  // farther goals are recorded if encountered, but become eligible only after
  // the reachable component is exhausted and therefore proves the nearer ring
  // unreachable.
  const startH = heuristicToGoals(sx, sy, targetGoals);
  gScore.set(startKey, 0);
  open.push({ node: startKey, g: 0, h: startH, f: startH });

  let expanded = 0;
  let bestGoalKey = null;
  let bestGoalCost = Infinity;
  let bestGoalRadius = Infinity;
  let budgetExhausted = false;
  while (open.size > 0) {
    const entry = open.pop();
    if (!entry) break;
    // An improved node leaves its old heap entry behind. It must consume
    // neither an expansion nor the bounded search budget.
    if (closed.has(entry.node) || entry.g !== gScore.get(entry.node)) continue;
    if (bestGoalRadius === targetRadius && entry.f > bestGoalCost + COST_EPSILON) break;
    if (expanded >= maxExpanded) {
      budgetExhausted = true;
      break;
    }

    closed.add(entry.node);
    expanded++;
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
      if (radius === targetRadius) {
        // Continue through the equal-cost frontier so a lower row-major goal
        // wins a true cost tie even if it was discovered later. Farther-ring
        // goals remain traversable: they may be the route into the nearer ring.
        continue;
      }
    }

    const cx = entry.node % MAP_W, cy = (entry.node / MAP_W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!isWalkable(nx, ny)) continue;
      // Diagonal: can't cut corners
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(cx + dx, cy) || !isWalkable(cx, cy + dy)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;

      const stepCost = (dx !== 0 && dy !== 0) ? SQRT2 : 1;
      const tg = entry.g + stepCost * moveCost(nx, ny);
      if (tg < (gScore.get(nk) ?? Infinity)) {
        const h = heuristicToGoals(nx, ny, targetGoals);
        gScore.set(nk, tg);
        cameFrom.set(nk, entry.node);
        open.push({ node: nk, g: tg, h, f: tg + h });
      }
    }
  }
  lastExpandedNodes = expanded;
  // A farther-ring result is truthful only after the entire reachable
  // component proves every nearer candidate unreachable. A caller-supplied
  // short budget must report failure instead of silently relaxing the goal.
  if (budgetExhausted && bestGoalRadius > targetRadius) return null;
  if (bestGoalKey === null) return null;
  const path = reconstructPath(cameFrom, bestGoalKey);
  const goal = goalByKey.get(bestGoalKey);
  path.goal = { x: goal.x, y: goal.y };
  return path;
}

export function findPath(sx, sy, ex, ey, maxIter = MAP_W * MAP_H) {
  findPathCalls++;
  lastExpandedNodes = 0;
  sx = Math.round(sx); sy = Math.round(sy);
  ex = Math.round(ex); ey = Math.round(ey);

  const start = nearestWalkableTile(sx, sy, 2);
  const goals = endpointCandidates(ex, ey, 7);
  if (!start || goals.length === 0) return null;
  sx = start.x; sy = start.y;
  const maxExpanded = Number.isFinite(maxIter)
    ? Math.max(0, Math.floor(maxIter))
    : MAP_W * MAP_H;
  return searchGoals(sx, sy, goals, maxExpanded);
}

function heuristic(x1, y1, x2, y2) {
  const dx = Math.abs(x1 - x2), dy = Math.abs(y1 - y2);
  return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * MIN_MOVE_COST;
}

function reconstructPath(cameFrom, current) {
  const path = [];
  while (cameFrom.has(current)) {
    const x = current % MAP_W, y = (current / MAP_W) | 0;
    path.push({x, y});
    current = cameFrom.get(current);
  }
  return path.reverse();
}
