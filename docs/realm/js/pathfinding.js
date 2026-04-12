// ════════════════════════════════════════════════════════════
// A* Pathfinding — binary heap, 8-directional, road bonus
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js';

class BinaryHeap {
  constructor() { this.data = []; }
  get size() { return this.data.length; }
  push(node, f) {
    this.data.push({node, f});
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top?.node;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let best = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].f < this.data[best].f) best = l;
      if (r < n && this.data[r].f < this.data[best].f) best = r;
      if (best === i) break;
      [this.data[best], this.data[i]] = [this.data[i], this.data[best]];
      i = best;
    }
  }
}

function isWalkable(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  const tile = G.map[y][x];
  if (tile === TILE.WATER || tile === TILE.MOUNTAIN) return false;
  const b = G.buildingGrid[y]?.[x];
  if (b && b.type === 'wall') return false;
  return true;
}

function moveCost(x, y) {
  const b = G.buildingGrid[y]?.[x];
  if (b && b.type === 'road') return 0.5;
  return 1.0;
}

const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
const SQRT2 = Math.SQRT2;

export function findPath(sx, sy, ex, ey, maxIter = 2000) {
  sx = Math.round(sx); sy = Math.round(sy);
  ex = Math.round(ex); ey = Math.round(ey);

  if (!isWalkable(ex, ey)) {
    // Find nearest walkable to the target
    for (let r = 1; r <= 3; r++) {
      for (const [dx, dy] of DIRS) {
        const nx = ex + dx*r, ny = ey + dy*r;
        if (isWalkable(nx, ny)) { ex = nx; ey = ny; break; }
      }
      if (isWalkable(ex, ey)) break;
    }
    if (!isWalkable(ex, ey)) return null;
  }
  if (!isWalkable(sx, sy)) return null;
  if (sx === ex && sy === ey) return [{x:ex,y:ey}];

  const key = (x,y) => y * MAP_W + x;
  const gScore = new Map();
  const cameFrom = new Map();
  const open = new BinaryHeap();
  const closed = new Set();

  const startKey = key(sx, sy);
  gScore.set(startKey, 0);
  open.push(startKey, heuristic(sx, sy, ex, ey));

  let iterations = 0;
  while (open.size > 0 && iterations < maxIter) {
    iterations++;
    const current = open.pop();
    if (current === key(ex, ey)) {
      return reconstructPath(cameFrom, current);
    }
    closed.add(current);
    const cx = current % MAP_W, cy = (current / MAP_W) | 0;

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
      const tg = gScore.get(current) + stepCost * moveCost(nx, ny);
      if (tg < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tg);
        cameFrom.set(nk, current);
        open.push(nk, tg + heuristic(nx, ny, ex, ey));
      }
    }
  }
  return null; // no path found
}

function heuristic(x1, y1, x2, y2) {
  const dx = Math.abs(x1 - x2), dy = Math.abs(y1 - y2);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

function reconstructPath(cameFrom, current) {
  const path = [];
  while (cameFrom.has(current)) {
    const x = current % MAP_W, y = (current / MAP_W) | 0;
    path.unshift({x, y});
    current = cameFrom.get(current);
  }
  return path;
}
