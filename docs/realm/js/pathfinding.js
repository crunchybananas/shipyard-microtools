// ════════════════════════════════════════════════════════════
// A* Pathfinding — binary heap, 8-directional, road bonus
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js?realm=195';
import {
  createPathfindingGridSnapshot,
  findPathOnGrid,
  isGridCellWalkable,
  nearestWalkableGridTile,
} from './pathfinding-kernel.js?realm=195';
import { resetPathfindingService } from './pathfinding-service.js?realm=195';

let cachedGridSnapshot = null;
let cachedMapIdentity = null;
let cachedBuildingGridIdentity = null;

export function getPathfindingGridSnapshot() {
  const obstacleEpoch = G.obstacleEpoch || 0;
  const worldIdentityChanged = !!cachedGridSnapshot
    && (cachedMapIdentity !== G.map || cachedBuildingGridIdentity !== G.buildingGrid);
  if (worldIdentityChanged && cachedGridSnapshot.obstacleEpoch === obstacleEpoch) {
    // A new map/grid identity at the same epoch is a different generated or
    // hydrated world, not an in-place topology edit. No pending route from the
    // previous identity is valid in the replacement world.
    resetPathfindingService({ preserveWorkerTransport: true });
  }
  if (
    !cachedGridSnapshot
    || cachedGridSnapshot.obstacleEpoch !== obstacleEpoch
    || cachedMapIdentity !== G.map
    || cachedBuildingGridIdentity !== G.buildingGrid
  ) {
    cachedGridSnapshot = createPathfindingGridSnapshot({
      width: MAP_W,
      height: MAP_H,
      obstacleEpoch,
      map: G.map,
      buildingGrid: G.buildingGrid,
      blockedTerrain: [TILE.WATER, TILE.MOUNTAIN],
    });
    cachedMapIdentity = G.map;
    cachedBuildingGridIdentity = G.buildingGrid;
  }
  return cachedGridSnapshot;
}

export function isWalkable(x, y) {
  return isGridCellWalkable(getPathfindingGridSnapshot(), x, y);
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
  return nearestWalkableGridTile(getPathfindingGridSnapshot(), x, y, maxR, fromX, fromY);
}

export function findPath(sx, sy, ex, ey, maxIter = MAP_W * MAP_H) {
  findPathCalls++;
  lastExpandedNodes = 0;
  const result = findPathOnGrid(getPathfindingGridSnapshot(), sx, sy, ex, ey, maxIter);
  lastExpandedNodes = result.expandedNodes;
  if (!result.path) return null;
  const path = result.path;
  path.goal = result.goal;
  return path;
}
