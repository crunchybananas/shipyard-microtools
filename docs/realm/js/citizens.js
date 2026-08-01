// ══════════���══════════════════��══════════════════════════════
// Citizen AI — state machine with A* pathfinding
// ══════════════���═══════════════════════════���═════════════════

import { G, BUILDINGS, MAP_W, MAP_H, rng, rngInt, getSeasonData, getDayPeriod, getDifficulty, TILE } from './state.js?realm=185';
import { findPath, isWalkable, nearestWalkableTile } from './pathfinding.js?realm=185';
import { getCitizenSpeedMult } from './events.js?realm=185';
import { buildingCapacity } from './building-lifecycle.js?realm=185';
import { revealAround } from './world.js?realm=185';
import { visualJitter } from './fx.js?realm=185';
import {
  assignmentDutyForBuilding,
  assignmentPurposeForCitizen,
  citizenStaffingCapacity,
  claimCitizenAssignment,
  releaseCitizenAssignment,
  staffingCount,
  transitionCitizenActivity,
  vocationForBuilding,
} from './citizen-ownership.js?realm=185';

const DEFAULT_ACTIVITY_REASON = Object.freeze({
  idle: 'idle-wait',
  find_job: 'seek-work',
  walk_to_work: 'route-to-work',
  working: 'arrived-at-work',
  walk_to_deliver: 'route-to-delivery',
  needs_delivery: 'cargo-needs-storage',
  deliver: 'cargo-delivered',
  foraging: 'forage-started',
  eating: 'eat-food',
  go_home: 'route-home',
  sleep: 'sleep-rest',
  leisure: 'leisure-started',
});

function setActivity(citizen, kind, {
  reason = DEFAULT_ACTIVITY_REASON[kind],
  timer = 0,
} = {}) {
  const changed = transitionCitizenActivity(citizen, kind, reason);
  // The decision cadence is scheduler state, not the causal activity clock.
  // A same-kind request preserves activity.sinceTick and emits no event while
  // still allowing the state machine to schedule its next decision.
  citizen.activityTimer = timer;
  return changed;
}

function assignedBuilding(citizen) {
  return citizen.assignment?.building || null;
}

function dist2(ax, ay, bx, by) {
  return Math.abs(ax-bx) + Math.abs(ay-by);
}

// Find nearest building of a given type (or any type if typeOrNull is null).
// Used to route delivering citizens to a real drop-off instead of the map center.
function nearestBuilding(c, typeOrNull) {
  let best = null, bestD = Infinity;
  for (const b of G.buildings) {
    if (typeOrNull && b.type !== typeOrNull) continue;
    const d = dist2(c.x, c.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

// Chain targets win only within reach: a windmill across the island must
// not beat the granary next door (AI-audit deferred fix). The carrier
// takes the chain target when it is close (<=18 Manhattan tiles — dist2
// above is Manhattan, not squared), or when it is no worse than twice as
// far as the best generic store.
function preferChainTarget(c, primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  const dp = dist2(c.x, c.y, primary.x, primary.y);
  if (dp <= 18) return primary;
  return dp <= dist2(c.x, c.y, fallback.x, fallback.y) * 2 ? primary : fallback;
}

function buildingsByType(c, types) {
  const results = [];
  const seen = new Set();
  for (const type of types) {
    const matches = G.buildings
      .filter(b => b.type === type && !seen.has(b))
      .sort((a, b) => dist2(c.x, c.y, a.x, a.y) - dist2(c.x, c.y, b.x, b.y));
    for (const building of matches) {
      seen.add(building);
      results.push(building);
    }
  }
  return results;
}

// A carrier needs an ordered *set* of destinations, not only the nearest one.
// Islands and newly placed buildings can make the visually closest store
// unreachable; trying the next real building prevents an endless repath loop.
function deliveryTargets(c, resKey) {
  let primaryType = null;
  let storageTypes;
  if (resKey === 'food') storageTypes = ['granary', 'storehouse', 'house'];
  else if (resKey === 'wheat') { primaryType = 'windmill'; storageTypes = ['granary', 'storehouse', 'house']; }
  else if (resKey === 'flour') { primaryType = 'bakery'; storageTypes = ['granary', 'storehouse', 'house']; }
  else if (resKey === 'gold') { primaryType = 'market'; storageTypes = ['storehouse', 'house']; }
  else storageTypes = ['storehouse', 'granary', 'house'];

  const storage = buildingsByType(c, storageTypes);
  if (!primaryType) return storage;
  const primary = buildingsByType(c, [primaryType]);
  const preferred = preferChainTarget(c, primary[0], storage[0]);
  // Keep the intended production chain when it is sensible, but make all
  // nearby stores viable fallbacks before asking a worker to cross the island.
  return preferred === primary[0]
    ? [...primary, ...storage]
    : [...storage, ...primary];
}

function requestDeliveryStorage(c) {
  setActivity(c, 'needs_delivery', { timer: 90 + rngInt(0, 60) });
  clearPath(c);
  c._deliveryTarget = null;
  const now = G.gameTick || 0;
  if (!c._needsDeliveryNoticeAt || now - c._needsDeliveryNoticeAt > 180) {
    c._needsDeliveryNoticeAt = now;
    G.particles.push({
      tx: c.x, ty: c.y, offsetY: -28,
      text: 'Need storage',
      alpha: 1.25, vy: -0.12, decay: 0.018, type: 'speech',
    });
  }
}

function citizenHash(c) {
  const actorId = Number.isSafeInteger(c?.actorId) ? c.actorId : 0;
  let h = Math.imul(actorId ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function targetCrowdPenalty(c, x, y) {
  let penalty = 0;
  for (const other of G.citizens || []) {
    if (other === c) continue;
    const dist = Math.hypot(other.x - x, other.y - y);
    if (dist < 0.72) penalty += 1.6;
    if (Math.round(other.tx ?? other.x) === x && Math.round(other.ty ?? other.y) === y) penalty += 1.1;
    const goal = other.path?.goal;
    if (goal && goal.x === x && goal.y === y) penalty += 1.1;
  }
  return penalty;
}

function chooseCrowdAwareTarget(c, tx, ty) {
  const rx = Math.round(tx), ry = Math.round(ty);
  const directCrowd = targetCrowdPenalty(c, rx, ry);
  if (isWalkable(rx, ry) && directCrowd < 1.2) return { x: rx, y: ry };

  const candidates = [];
  const maxR = isWalkable(rx, ry) ? 2 : 4;
  for (let y = ry - maxR; y <= ry + maxR; y++) {
    for (let x = rx - maxR; x <= rx + maxR; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (!isWalkable(x, y)) continue;
      const ring = Math.abs(x - rx) + Math.abs(y - ry);
      if (ring > maxR) continue;
      const crowd = targetCrowdPenalty(c, x, y);
      const fromHere = Math.abs(x - c.x) + Math.abs(y - c.y);
      const roadBonus = G.buildingGrid[y]?.[x]?.type === 'road' ? -0.35 : 0;
      const jitter = ((citizenHash(c) ^ (x * 73856093) ^ (y * 19349663)) >>> 0) / 0xffffffff * 0.18;
      candidates.push({
        x, y,
        score: ring * 2.0 + fromHere * 0.16 + crowd * 4.5 + roadBonus + jitter,
      });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || { x: rx, y: ry };
}

function compressPath(path) {
  if (!path || path.length <= 2) return path;
  const compact = [path[0]];
  let lastDx = 0, lastDy = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const cur = path[i];
    const dx = Math.sign(cur.x - prev.x);
    const dy = Math.sign(cur.y - prev.y);
    if (i > 1 && (dx !== lastDx || dy !== lastDy)) compact.push(prev);
    lastDx = dx;
    lastDy = dy;
  }
  compact.push(path[path.length - 1]);
  compact.goal = path.goal;
  return compact;
}

const BLACKLIST_TICKS = 600;

function blacklistTarget(c, x, y) {
  c._noGo = c._noGo || {};
  c._noGo[`${Math.round(x)},${Math.round(y)}`] = G.gameTick;
}

function isBlacklisted(c, x, y) {
  const t = c._noGo?.[`${Math.round(x)},${Math.round(y)}`];
  return t !== undefined && G.gameTick - t < BLACKLIST_TICKS;
}

function releaseJob(c, { unreachable = false } = {}) {
  const job = assignedBuilding(c);
  if (unreachable) {
    if (job) blacklistTarget(c, job.x, job.y);
    if (c.workTarget) blacklistTarget(c, c.workTarget.x, c.workTarget.y);
  }
  releaseCitizenAssignment(c, unreachable ? 'path-unreachable' : 'assignment-invalid');
  c.workTarget = null;
}

function watchProgress(c) {
  const goalActive = (c.path && c.pathIdx < c.path.length) ||
    c.activity.kind === 'walk_to_work' || c.activity.kind === 'walk_to_deliver' ||
    c.activity.kind === 'needs_delivery' || c.activity.kind === 'foraging';
  if (!goalActive) { c._wdBest = null; c._wdTicks = 0; return; }
  const gx = c._requestedTx ?? c.tx ?? c.x;
  const gy = c._requestedTy ?? c.ty ?? c.y;
  const d = Math.hypot(gx - c.x, gy - c.y);
  if (c._wdBest == null || d < c._wdBest - 0.2) { c._wdBest = d; c._wdTicks = 0; return; }
  c._wdTicks = (c._wdTicks || 0) + 1;
  if (c._wdTicks > 120) {
    blacklistTarget(c, gx, gy);
    if (assignedBuilding(c) && c.activity.kind === 'walk_to_work') {
      releaseJob(c, { unreachable: true });
      G.particles.push({ tx: c.x, ty: c.y, offsetY: -26, text: "Can't reach it!", alpha: 1.25, vy: -0.12, decay: 0.016, type: 'speech' });
    }
    clearPath(c);
    setActivity(c, 'idle', { reason: 'path-unreachable', timer: 20 + rngInt(0, 15) });
    c._wdBest = null;
    c._wdTicks = 0;
    // carrying is kept — the find_job/heartbeat guards route it to delivery
  }
}

function pathTo(c, tx, ty) {
  c._requestedTx = tx;
  c._requestedTy = ty;
  const target = chooseCrowdAwareTarget(c, tx, ty);
  c._pathGoal = target;
  c.path = compressPath(findPath(Math.round(c.x), Math.round(c.y), target.x, target.y));
  c.pathIdx = 0;
  c._pathStartedAt = c.path ? G.gameTick : null;
  c._pathEpoch = G.obstacleEpoch || 0;
  c._stuckTicks = 0;
  c._lastPathX = c.x;
  c._lastPathY = c.y;
  if (c.path) {
    const goal = c.path.goal || c.path[c.path.length - 1] || { x: tx, y: ty };
    c.tx = goal.x;
    c.ty = goal.y;
    c._pathFailedAt = 0;
  } else {
    c.tx = c.x;
    c.ty = c.y;
    c._pathFailedAt = G.gameTick || 0;
  }
  return !!c.path;
}

function routeDelivery(c, resKey) {
  for (const dropoff of deliveryTargets(c, resKey)) {
    if (isBlacklisted(c, dropoff.x, dropoff.y)) continue;
    if (pathTo(c, dropoff.x, dropoff.y)) {
      c._deliveryTarget = dropoff;
      return true;
    }
    // Do not keep assigning an islanded store on the next heartbeat. The
    // short target blacklist expires after the map or settlement can change.
    blacklistTarget(c, dropoff.x, dropoff.y);
  }
  c._deliveryTarget = null;
  return false;
}

function deliveryTargetStillValid(c) {
  return !!c._deliveryTarget && G.buildings.includes(c._deliveryTarget);
}

// Deterministic right-of-way prevents crossing and opposing citizens from
// entering the same space. Separation then supplies a visible passing lane
// and remains the fallback for newly spawned or stationary crowds. This radius
// is large enough to keep actor silhouettes distinct without pushing walkers
// a full tile away from their route.
const PERSONAL_SPACE = 0.60;

function tileWalkable(x, y) {
  const mx = Math.round(x), my = Math.round(y);
  return isWalkable(mx, my);
}

function terrainWalkable(x, y) {
  const mx = Math.round(x), my = Math.round(y);
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return false;
  const t = G.map[my]?.[mx];
  return t !== undefined && t !== TILE.WATER && t !== TILE.MOUNTAIN;
}

function resourceWorkTarget(c, b, tileType, radius = 7) {
  const bx = Math.round(b.x), by = Math.round(b.y);
  let best = null, bestScore = Infinity;
  for (let y = by - radius; y <= by + radius; y++) {
    for (let x = bx - radius; x <= bx + radius; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (G.map[y]?.[x] !== tileType) continue;
      if (G.buildingGrid[y]?.[x] && G.buildingGrid[y][x].type !== 'road') continue;
      if (!terrainWalkable(x, y) || !isWalkable(x, y)) continue;
      const fromMill = dist2(x, y, bx, by);
      if (fromMill > radius) continue;
      const fromCitizen = dist2(c.x, c.y, x, y);
      const crowd = targetCrowdPenalty(c, x, y);
      const jitter = ((citizenHash(c) ^ (x * 374761393) ^ (y * 668265263)) >>> 0) / 0xffffffff * 0.2;
      const score = fromMill * 2.2 + fromCitizen * 0.16 + crowd * 3.5 + jitter;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y, resource: tileType };
      }
    }
  }
  return best;
}

function buildingEdgeWorkTarget(c, b, radius = 2) {
  const bx = Math.round(b.x), by = Math.round(b.y);
  let best = null, bestScore = Infinity;
  for (let y = by - radius; y <= by + radius; y++) {
    for (let x = bx - radius; x <= bx + radius; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (!isWalkable(x, y)) continue;
      const ring = dist2(x, y, bx, by);
      if (ring < 1 || ring > radius) continue;
      const crowd = targetCrowdPenalty(c, x, y);
      const roadBonus = G.buildingGrid[y]?.[x]?.type === 'road' ? -0.45 : 0;
      const jitter = ((citizenHash(c) ^ (x * 83492791) ^ (y * 2654435761)) >>> 0) / 0xffffffff * 0.18;
      const score = ring * 1.7 + dist2(c.x, c.y, x, y) * 0.16 + crowd * 3.8 + roadBonus + jitter;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

function workTargetForBuilding(c, b) {
  if (!b) return { x: c.x, y: c.y };
  if (isConstructionSite(b)) return buildingEdgeWorkTarget(c, b, 2) || { x: b.x, y: b.y };
  if (b.type === 'lumber') return resourceWorkTarget(c, b, TILE.FOREST, 7) || buildingEdgeWorkTarget(c, b, 3) || { x: b.x, y: b.y };
  if (b.type === 'quarry') return resourceWorkTarget(c, b, TILE.STONE, 5) || buildingEdgeWorkTarget(c, b, 2) || { x: b.x, y: b.y };
  if (b.type === 'mine') return resourceWorkTarget(c, b, TILE.IRON, 5) || buildingEdgeWorkTarget(c, b, 2) || { x: b.x, y: b.y };
  const def = BUILDINGS[b.type];
  if (def?.workers || def?.prod) return buildingEdgeWorkTarget(c, b, 2) || { x: b.x, y: b.y };
  return { x: b.x, y: b.y };
}

function pathToWork(c) {
  const target = workTargetForBuilding(c, assignedBuilding(c));
  c.workTarget = target;
  pathTo(c, target.x, target.y);
}

function settlementAnchor(c) {
  return nearestBuilding(c, 'house') ||
    nearestBuilding(c, 'storehouse') ||
    nearestBuilding(c, 'granary') ||
    nearestBuilding(c, null) ||
    { x: Math.round(MAP_W / 2), y: Math.round(MAP_H / 2) };
}

function idleLoiterTarget(c) {
  const anchor = settlementAnchor(c);
  const ax = Math.round(anchor.x), ay = Math.round(anchor.y);
  let best = null, bestScore = Infinity;
  for (let y = ay - 5; y <= ay + 5; y++) {
    for (let x = ax - 5; x <= ax + 5; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (!isWalkable(x, y)) continue;
      const ring = dist2(x, y, ax, ay);
      if (ring < 1 || ring > 5) continue;
      const fromHere = dist2(c.x, c.y, x, y);
      const crowd = targetCrowdPenalty(c, x, y);
      // Idle life gathers where towns live: on roads and by doorsteps —
      // not in a loose mob in an open field.
      const roadBonus = G.buildingGrid[y]?.[x]?.type === 'road' ? -1.0 : 0;
      const doorstep = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => G.buildingGrid[y + ay]?.[x + ax]?.type === 'house') ? -0.6 : 0;
      const jitter = ((citizenHash(c) ^ (x * 92837111) ^ (y * 689287499)) >>> 0) / 0xffffffff * 0.22;
      const score = Math.abs(ring - 3) * 1.6 + fromHere * 0.18 + crowd * 4 + roadBonus + doorstep + jitter;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best || chooseCrowdAwareTarget(c, ax, ay);
}

function standingOnBlockedTile(c) {
  const mx = Math.round(c.x), my = Math.round(c.y);
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return false;
  const t = G.map[my]?.[mx];
  const b = G.buildingGrid[my]?.[mx];
  return t !== TILE.WATER && t !== TILE.MOUNTAIN && !!b && b.type !== 'road';
}

function evacuateBlockedCitizen(c) {
  if (!standingOnBlockedTile(c)) { c._evacTarget = null; return false; }
  const mx = Math.round(c.x), my = Math.round(c.y);
  // K-candidate escape with per-citizen rotation: if the current exit stays
  // corner-blocked for ~90 ticks, try the next ring tile instead of
  // deterministically retrying the same one forever. The original errand
  // (_requestedTx/Ty) is never touched — an escaped carrier resumes its
  // delivery instead of dumping cargo at the evacuation spot.
  c._evacTicks = (c._evacTicks || 0) + 1;
  let target = c._evacTarget;
  if (!target || !tileWalkable(target.x, target.y) || c._evacTicks > 90) {
    const candidates = [];
    for (let r = 1; r <= 4 && candidates.length < 8; r++) {
      for (let yy = my - r; yy <= my + r; yy++) {
        for (let xx = mx - r; xx <= mx + r; xx++) {
          if (Math.abs(xx - mx) !== r && Math.abs(yy - my) !== r) continue;
          if (tileWalkable(xx, yy)) candidates.push({ x: xx, y: yy });
        }
      }
    }
    if (!candidates.length) return true; // fully entombed — wait for a demolish
    c._evacRot = ((c._evacRot || 0) + 1) % candidates.length;
    target = candidates[c._evacRot];
    c._evacTarget = target;
    c._evacTicks = 0;
  }

  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.001) {
    // ~2x walk speed: urgent but no longer a 10x teleport-skate
    const step = Math.min(0.06, d);
    const nx = c.x + (dx / d) * step;
    const ny = c.y + (dy / d) * step;
    // Evacuation goes through the same step gate as every other mover, so
    // escaping one footprint can never tunnel through a neighbouring one.
    if (canStepCitizen(c, nx, ny)) {
      c.x = nx;
      c.y = ny;
      c._movedAt = G.gameTick;
    }
    c.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
    c.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
  }

  if (!standingOnBlockedTile(c)) {
    c._evacTarget = null;
    c._evacTicks = 0;
    clearPath(c);
    // Resume the interrupted errand rather than standing dazed
    if (c._requestedTx !== undefined && (c.activity.kind === 'walk_to_deliver' || c.activity.kind === 'walk_to_work' || c.activity.kind === 'needs_delivery')) {
      replanToRequestedTarget(c);
    }
  }
  return true;
}

function canStepCitizen(c, nx, ny) {
  const rx = Math.round(nx), ry = Math.round(ny);
  const cx = Math.round(c.x), cy = Math.round(c.y);
  if (tileWalkable(nx, ny)) {
    // Mirror the A* no-corner-cut rule: a diagonal tile transition needs
    // both orthogonal neighbours open too, or citizens slip between two
    // diagonally adjacent buildings placed after the path was planned.
    if (rx !== cx && ry !== cy && (!tileWalkable(rx, cy) || !tileWalkable(cx, ry))) return false;
    return true;
  }
  // If a player drops a building onto/against a citizen, their rounded
  // current tile can be blocked for several frames. Let them shuffle within
  // that one tile toward the exit — but never cross into a DIFFERENT
  // blocked tile (buildings are 1x1, so any further blocked tile is another
  // building, and crossing it is the tunnelling bug).
  return standingOnBlockedTile(c) && rx === cx && ry === cy && terrainWalkable(nx, ny);
}

const YIELD_BUCKET_SIZE = 1.1;
const YIELD_BUCKET_STRIDE = Math.ceil(MAP_W / YIELD_BUCKET_SIZE) + 4;
let yieldBucketsTick = -1;
let yieldBucketsCitizens = null;
let yieldBucketsCount = -1;
let yieldBuckets = new Map();

function currentYieldBuckets() {
  if (
    yieldBucketsTick === G.gameTick
    && yieldBucketsCitizens === G.citizens
    && yieldBucketsCount === G.citizens.length
  ) return yieldBuckets;

  yieldBucketsTick = G.gameTick;
  yieldBucketsCitizens = G.citizens;
  yieldBucketsCount = G.citizens.length;
  yieldBuckets = new Map();
  for (const citizen of G.citizens) {
    if (!isActivelyMoving(citizen)) continue;
    const cellX = Math.floor(citizen.x / YIELD_BUCKET_SIZE);
    const cellY = Math.floor(citizen.y / YIELD_BUCKET_SIZE);
    const key = cellY * YIELD_BUCKET_STRIDE + cellX;
    const bucket = yieldBuckets.get(key);
    if (bucket) bucket.push(citizen);
    else yieldBuckets.set(key, [citizen]);
  }
  return yieldBuckets;
}

function shouldYieldToCitizen(c, nx, ny) {
  if (!isActivelyMoving(c)) return false;
  const direction = activeMovementDirection(c);
  if (!direction) return false;
  const buckets = currentYieldBuckets();
  const cellX = Math.floor(c.x / YIELD_BUCKET_SIZE);
  const cellY = Math.floor(c.y / YIELD_BUCKET_SIZE);
  for (let y = cellY - 1; y <= cellY + 1; y++) {
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      for (const other of buckets.get(y * YIELD_BUCKET_STRIDE + x) || []) {
        if (other === c || (other.actorId || 0) >= (c.actorId || 0)) continue;
        const otherDirection = activeMovementDirection(other);
        if (!otherDirection) continue;
        const alignment = direction.x * otherDirection.x + direction.y * otherDirection.y;
        // Following traffic can naturally queue. Crossing and opposing
        // traffic need a deterministic right-of-way decision before they
        // enter the same personal-space area; post-move separation remains a
        // safety net, not the primary traffic rule.
        if (alignment >= 0.45) continue;
        const currentDistance = Math.hypot(c.x - other.x, c.y - other.y);
        if (currentDistance >= YIELD_BUCKET_SIZE) continue;
        const nextDistance = Math.hypot(nx - other.x, ny - other.y);
        if (nextDistance < currentDistance && nextDistance < 0.8) return true;
      }
    }
  }
  return false;
}

function replanToRequestedTarget(c) {
  const tx = Math.round(c._requestedTx ?? c.tx ?? c.x);
  const ty = Math.round(c._requestedTy ?? c.ty ?? c.y);
  pathTo(c, tx, ty);
}

// ── Job market (Phase 3c) ───────────────────────────────────────────
// Greedy-nearest is replaced by utility scoring: distance, dynamic
// priority (a thin larder surges food jobs), the wonder's pull, and a
// hysteresis bonus for the current job so citizens don't thrash between
// equidistant workplaces. Deterministic — ties break by building order.
const FOOD_JOBS = new Set(['farm', 'fisherman', 'chickencoop', 'cowpen', 'bakery', 'windmill']);

let _foodDaysTick = -1, _foodDaysVal = 99;
function foodDaysLeft() {
  if (_foodDaysTick !== G.gameTick) {
    _foodDaysTick = G.gameTick;
    const daily = Math.max(1, Math.ceil(G.population * getDifficulty().foodMult));
    const stock = (G.resources.food || 0) + (G.resources.wheat || 0) + (G.resources.flour || 0);
    _foodDaysVal = stock / daily;
  }
  return _foodDaysVal;
}


function isConstructionSite(b) {
  return b.buildProgress < 1 && citizenStaffingCapacity(b) > 0;
}

function scoreJob(c, b) {
  let score = -dist2(c.x, c.y, b.x, b.y);
  const days = foodDaysLeft();
  if (days < 3 && FOOD_JOBS.has(b.type)) score += (3 - days) * 14;
  if (isConstructionSite(b)) score += 12; // fresh sites pull a crew fast
  if (b.type === 'wonder') score += 6; // the great work draws hands
  if (assignedBuilding(c) === b) score += 6; // hysteresis
  if (!isConstructionSite(b) && c.profession.kind !== 'settler') {
    score += vocationForBuilding(b) === c.profession.kind ? 18 : -8;
  }
  return score;
}

// ── Homes & schedule (Phase 3a) ─────────────────────────────────────
// Citizens sleep in an assigned house at night. Assignment is lazy
// (first nightfall, or when the old home is gone) and respects tier
// capacity via buildingCapacity. Homeless citizens bed down near the
// settlement anchor — visible pressure to build housing.
function assignHome(c) {
  const counts = new Map();
  for (const other of G.citizens) {
    if (other.home) counts.set(other.home, (counts.get(other.home) || 0) + 1);
  }
  let best = null, bestD = Infinity;
  for (const b of G.buildings) {
    if (b.type !== 'house') continue;
    if (b.buildProgress < 1) continue;
    if ((counts.get(b) || 0) >= buildingCapacity(b)) continue;
    const d = dist2(c.x, c.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  c.home = best;
  return best;
}

function goHome(c) {
  if (!c.home || !G.buildings.includes(c.home)) assignHome(c);
  clearPath(c);
  setActivity(c, 'go_home');
  if (c.home) {
    const spot = nearestWalkableTile(Math.round(c.home.x), Math.round(c.home.y), 3) || { x: c.home.x, y: c.home.y };
    pathTo(c, spot.x, spot.y);
  } else {
    const t = idleLoiterTarget(c);
    pathTo(c, t.x, t.y);
  }
}

// States that must not be interrupted by nightfall: carriers finish
// their delivery first (goods in hand are an obligation), sleepers and
// homeward walkers are already handled.
const NIGHT_EXEMPT = new Set(['sleep', 'go_home', 'walk_to_deliver', 'deliver', 'needs_delivery']);

// Raid awareness for the schedule: a citizen with raiders nearby must
// never be marched home into the fight (the flee response in combat.js
// owns them), and sleepers wake when danger gets close.
function enemyNear(c, r) {
  for (const e of G.enemies) {
    if (Math.abs(e.x - c.x) < r && Math.abs(e.y - c.y) < r) return true;
  }
  return false;
}

function clearPath(c) {
  c.path = null;
  c.pathIdx = 0;
  c._pathStartedAt = null;
  c._stuckTicks = 0;
}

function startWorking(c, activityTimer) {
  // Preserve the final approach direction for the complete work beat. This
  // keeps pick, axe, and hammer rows from flicking between directions when
  // an otherwise-stationary worker has neighbours nearby.
  c._workFaceX = c.faceX || 0;
  c._workFaceZ = c.faceZ || 0;
  setActivity(c, 'working', { timer: activityTimer });
  clearPath(c);
}

function isActivelyMoving(c) {
  return c.path && c.pathIdx < c.path.length;
}

function activeMovementDirection(c) {
  if (!isActivelyMoving(c)) return null;
  const target = c.path[c.pathIdx];
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const length = Math.hypot(dx, dy);
  return length > 0.0001 ? { x: dx / length, y: dy / length } : null;
}

function separationAxis(a, b, dx, dy, d2, pass) {
  const ad = activeMovementDirection(a);
  const bd = activeMovementDirection(b);
  if (ad && bd && ad.x * bd.x + ad.y * bd.y < -0.45) {
    // Opposing walkers need a deterministic passing lane. Pure radial
    // separation makes a one-tile doorway an permanent tug-of-war; the
    // perpendicular lane lets one pass on each half of the tile.
    const travelX = ad.x - bd.x;
    const travelY = ad.y - bd.y;
    const sign = (a.actorId || 0) <= (b.actorId || 0) ? 1 : -1;
    // Lock the lane to the dominant travel axis. Recomputing a continuously
    // rotated perpendicular while the walkers are offset introduces a small
    // backwards component that can exactly cancel forward motion in a door.
    if (Math.abs(travelX) >= Math.abs(travelY)) {
      return { x: 0, y: sign, perpendicular: true };
    }
    return {
      x: sign,
      y: 0,
      perpendicular: true,
    };
  }
  if (d2 >= 0.0004) {
    const distance = Math.sqrt(d2);
    return { x: dx / distance, y: dy / distance, perpendicular: false };
  }
  const angle = (
    ((a.actorId || 0) * 37 + (b.actorId || 0) * 53 + pass * 97) % 360
  ) * Math.PI / 180;
  return { x: Math.cos(angle), y: Math.sin(angle), perpendicular: false };
}

function applyCitizenSeparation() {
  const cs = G.citizens;
  const r2 = PERSONAL_SPACE * PERSONAL_SPACE;
  const opposingLookahead = 1.25;
  const opposingLookahead2 = opposingLookahead * opposingLookahead;
  const bucketSize = 1;
  const bucketStride = MAP_W + 8;
  for (let pass = 0; pass < 4; pass++) {
    const buckets = new Map();
    for (let index = 0; index < cs.length; index++) {
      const citizen = cs[index];
      const key = Math.floor(citizen.y / bucketSize) * bucketStride
        + Math.floor(citizen.x / bucketSize);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }

    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      const cellX = Math.floor(a.x / bucketSize);
      const cellY = Math.floor(a.y / bucketSize);
      for (let by = cellY - 2; by <= cellY + 2; by++) {
        for (let bx = cellX - 2; bx <= cellX + 2; bx++) {
          for (const j of buckets.get(by * bucketStride + bx) || []) {
            if (j <= i) continue;
            const b = cs[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            const axis = separationAxis(a, b, dx, dy, d2, pass);
            let totalPush;
            if (axis.perpendicular) {
              if (d2 >= opposingLookahead2) continue;
              const lateralGap = Math.abs(dx * axis.x + dy * axis.y);
              if (lateralGap >= PERSONAL_SPACE) continue;
              totalPush = PERSONAL_SPACE - lateralGap + 0.0001;
            } else {
              if (d2 >= r2) continue;
              totalPush = PERSONAL_SPACE - Math.sqrt(d2) + 0.0001;
            }
            const halfPush = totalPush * 0.5;
            const nextA = {
              x: a.x + axis.x * halfPush,
              y: a.y + axis.y * halfPush,
            };
            const nextB = {
              x: b.x - axis.x * halfPush,
              y: b.y - axis.y * halfPush,
            };
            const canMoveA = canStepCitizen(a, nextA.x, nextA.y);
            const canMoveB = canStepCitizen(b, nextB.x, nextB.y);
            if (canMoveA && canMoveB) {
              a.x = nextA.x; a.y = nextA.y;
              b.x = nextB.x; b.y = nextB.y;
            } else if (canMoveA) {
              const fullX = a.x + axis.x * totalPush;
              const fullY = a.y + axis.y * totalPush;
              if (canStepCitizen(a, fullX, fullY)) { a.x = fullX; a.y = fullY; }
            } else if (canMoveB) {
              const fullX = b.x - axis.x * totalPush;
              const fullY = b.y - axis.y * totalPush;
              if (canStepCitizen(b, fullX, fullY)) { b.x = fullX; b.y = fullY; }
            }
          }
        }
      }
    }
  }
}

export function updateCitizens() {
  for (const c of G.citizens) {
    // ── Decision heartbeat (AI audit): obligations preempt from ANY state
    // on a short cadence — the brain no longer waits for the body to stop.
    if ((G.gameTick + (c._hb ?? (c._hb = citizenHash(c) % 12))) % 12 === 0) {
      // Eat on the go: a quick bite from the realm stores keeps busy or
      // stuck citizens from saturating at hunger 100 and crawling.
      if (c.hunger > 75 && G.resources.food > 0 && c.activity.kind !== 'eating') {
        G.resources.food--;
        c.hunger = Math.max(0, c.hunger - 60);
        G.particles.push({ tx: c.x, ty: c.y, offsetY: -26, text: '🍞', alpha: 1.2, vy: -0.15, decay: 0.02, type: 'text' });
      }
      // Idle carriers deliver immediately instead of waiting out the timer.
      if (c.activity.kind === 'idle' && c.carrying && c.carryAmount > 0) {
        setActivity(c, 'needs_delivery', { reason: 'cargo-ready' });
        clearPath(c);
      }
      // Self-heal any over-long idle (flee aftermath left stale 260-tick timers).
      if (c.activity.kind === 'idle' && c.activityTimer > 140) c.activityTimer = 60;

      // ── Schedule (Phase 3a) ──────────────────────────────────────
      const period = getDayPeriod();
      const threatened = G.enemies.length > 0 && enemyNear(c, 6);
      // Flee flag clears once the danger passes (it used to stick forever
      // — set in combat.js, never reset). While fleeing, citizens sprint.
      if (c._fleeing && !threatened) c._fleeing = false;
      if (period === 'night' && !NIGHT_EXEMPT.has(c.activity.kind) && !threatened && !(c.carrying && c.carryAmount > 0)) {
        goHome(c);
      } else if (c.activity.kind === 'sleep' && (period !== 'night' || threatened)) {
        // Dawn: wake with a stagger so the morning rush reads as a town
        // waking up, not a synchronized swarm. Danger wakes sleepers
        // immediately — the combat flee response takes them from there.
        setActivity(c, threatened ? 'idle' : 'find_job', {
          reason: threatened ? 'threat-response' : 'wake-day',
          timer: threatened ? 0 : rngInt(0, 40),
        });
        clearPath(c);
        c.rest = Math.min(100, c.rest ?? 100);
        if (threatened) {
          G.particles.push({ tx: c.x, ty: c.y, offsetY: -24, text: '❗', alpha: 1.3, vy: -0.12, decay: 0.02, type: 'speech' });
        }
      } else if (c.activity.kind === 'go_home' && threatened) {
        // Abort the walk home if raiders cut the path — flee instead.
        setActivity(c, 'idle', { reason: 'threat-response' });
        clearPath(c);
      }
      // Rest drains while awake and active; sleep restores it (below).
      if (c.activity.kind !== 'sleep' && c.activity.kind !== 'idle') {
        c.rest = Math.max(0, (c.rest ?? 100) - 0.35);
      }

      // ── Needs (Phase 3b) — joy and faith drain slowly; taverns and
      // churches (via walkers or dusk visits) restore them. Mood feeds
      // realm happiness with a bounded contribution (economy.js).
      if (!c.needs) c.needs = { joy: 55, faith: 55 };
      c.needs.joy = Math.max(0, c.needs.joy - 0.10);
      c.needs.faith = Math.max(0, c.needs.faith - 0.06);

      // Food crisis (Phase 3c): when the larder runs under two days,
      // non-food workers start downing tools — into an open food job if
      // one exists, otherwise into foraging (find_job's shortage branch
      // sends the unemployed after berries/game). Either way the colony
      // visibly reallocates labor under pressure and recovers its old
      // jobs once the granary refills.
      const currentAssignment = assignedBuilding(c);
      if (foodDaysLeft() < 2
          && currentAssignment && !FOOD_JOBS.has(currentAssignment.type)
          && (c.activity.kind === 'working' || c.activity.kind === 'walk_to_work')
          && rng() < 0.04) {
        releaseCitizenAssignment(c, 'food-crisis');
        c.workTarget = null;
        setActivity(c, 'find_job', { reason: 'food-crisis' });
        clearPath(c);
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -26,
          text: 'To the fields!', alpha: 1.2, vy: -0.12, decay: 0.016, type: 'speech',
        });
      }

      // Dusk leisure: unoccupied citizens with a low need seek the venue
      // that satisfies it — the town square fills in the evening. One
      // trip per day; night sends everyone home from the tavern.
      if (period === 'dusk' && !threatened && c._leisureDay !== G.day
          && (c.activity.kind === 'idle' || c.activity.kind === 'find_job')
          && !(c.carrying && c.carryAmount > 0)) {
        const wantJoy = c.needs.joy < 45;
        const wantFaith = c.needs.faith < 45;
        if (wantJoy || wantFaith) {
          const kind = (wantJoy && (!wantFaith || c.needs.joy <= c.needs.faith)) ? 'tavern' : 'church';
          const venue = nearestBuilding(c, kind) || nearestBuilding(c, kind === 'tavern' ? 'church' : 'tavern');
          if (venue && dist2(c.x, c.y, venue.x, venue.y) <= 25) {
            c._leisureDay = G.day;
            c._leisureTarget = { x: venue.x, y: venue.y, kind: venue.type };
            setActivity(c, 'leisure');
            clearPath(c);
            pathTo(c, venue.x, venue.y);
          }
        }
      }
    }

    // ── Universal progress watchdog: no measurable progress toward the
    // active goal for ~120 ticks -> give up cleanly instead of orbiting.
    watchProgress(c);

    if (evacuateBlockedCitizen(c)) continue;

    // Track tile wear — citizens walking over tiles gradually create dirt paths
    const _wx = Math.round(c.x), _wy = Math.round(c.y);
    if (_wx >= 0 && _wx < MAP_W && _wy >= 0 && _wy < MAP_H) {
      if (!G.tileWear) {
        G.tileWear = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
      }
      const tile = G.map[_wy][_wx];
      if (tile !== TILE.WATER && tile !== TILE.MOUNTAIN) {
        const cur = G.tileWear[_wy][_wx];
        if (cur < 200 && G.gameTick % 30 === 0) {
          G.tileWear[_wy][_wx] = cur + 1;
        }
      }
    }

    // Reveal fog around citizen after movement
    const _cx = Math.round(c.x), _cy = Math.round(c.y);
    if (_cx >= 0 && _cx < MAP_W && _cy >= 0 && _cy < MAP_H) {
      if (!G.fog[_cy][_cx]) {
        revealAround(_cx, _cy, 2);
      }
    }

    // Hungry emote — derive the cadence from actor identity instead of
    // storing a presentation timer or advancing the simulation RNG.
    if (c.hunger > 70) {
      const emoteInterval = 120; // every 2 seconds at 1x
      if ((G.gameTick + citizenHash(c)) % emoteInterval === 0) {
        const emote = c.hunger >= 90 ? '❗' : '🍽️';
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -22,
          text: emote,
          alpha: 1.4, vy: -0.1, decay: 0.015, type: 'speech',
        });
      }
    }

    // Follow path if we have one
    if (c.path && c.pathIdx < c.path.length) {
      // Building topology changes are rare, while a delayed collision with a
      // newly blocked compressed segment is expensive. Replan immediately on
      // an epoch change rather than validating only the sparse waypoints.
      if (c._pathEpoch !== (G.obstacleEpoch || 0)) {
        c._pathEpoch = G.obstacleEpoch || 0;
        replanToRequestedTarget(c);
        continue;
      }
      const wp = c.path[c.pathIdx];
      if (!isWalkable(wp.x, wp.y)) {
        replanToRequestedTarget(c);
        continue;
      }
      const dx = wp.x - c.x, dy = wp.y - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 0.005) {
        c.x = wp.x;
        c.y = wp.y;
        c.pathIdx++;
      } else {
        let spd = c.speed * getSeasonData().speedMult * getCitizenSpeedMult();
        // Road speed bonus
        const gx = Math.round(c.x), gy = Math.round(c.y);
        if (gx >= 0 && gx < MAP_W && gy >= 0 && gy < MAP_H) {
          const b = G.buildingGrid[gy]?.[gx];
          if (b && b.type === 'road') spd *= 2;
        }
        // Hunger speed penalty: up to -40% at hunger 100, kicks in above 60
        if (c.hunger > 60) {
          const penalty = Math.min(0.4, (c.hunger - 60) / 100);
          spd *= (1 - penalty);
        }
        // Exhaustion: below 30 energy, up to -25% speed (Phase 3a)
        if ((c.rest ?? 100) < 30) spd *= 0.75 + ((c.rest ?? 100) / 30) * 0.25;
        if (c._fleeing) spd *= 1.35; // panic sprint — flight should read as flight
        const step = Math.min(spd, d);
        const nx = c.x + (dx/d) * step;
        const ny = c.y + (dy/d) * step;
        const beforeX = c.x, beforeY = c.y;
        if (shouldYieldToCitizen(c, nx, ny)) {
          // Lower actor IDs have right of way through a contested crossing.
        } else if (canStepCitizen(c, nx, ny)) {
          c.x = nx;
          c.y = ny;
          // Consume the waypoint on the same tick that reaches it. The old
          // 0.15-tile early cutoff both cut visible corners and inserted an
          // idle simulation beat between path segments.
          if (step >= d - 0.000001) {
            c.x = wp.x;
            c.y = wp.y;
            c.pathIdx++;
          }
          // Render reads this for walk-row hysteresis: paths empty for a
          // single frame between arrival and the next repath, and raw
          // path-presence flapped the walk/idle rows (visible flicker).
          c._movedAt = G.gameTick;
          if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) {
            c.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
            c.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
          }
          const moved = Math.hypot(c.x - beforeX, c.y - beforeY);
          const progressMoved = Math.hypot(c.x - (c._lastPathX ?? c.x), c.y - (c._lastPathY ?? c.y));
          if (moved < 0.001 || progressMoved < 0.01) c._stuckTicks = (c._stuckTicks || 0) + 1;
          else {
            c._stuckTicks = 0;
            c._lastPathX = c.x;
            c._lastPathY = c.y;
          }
          if ((c._stuckTicks || 0) > 45) replanToRequestedTarget(c);
        } else {
          replanToRequestedTarget(c);
        }
      }
      continue; // still moving — next citizen
    }

    if (c.path && c.pathIdx >= c.path.length) {
      clearPath(c);
    }

    // No path or path complete — fallback straight-line for non-pathfound movement
    if (!c.path && c.activity.kind !== 'walk_to_work' && c.activity.kind !== 'walk_to_deliver' && c.activity.kind !== 'foraging') {
      const dx = c.tx - c.x, dy = c.ty - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.1) {
        let spd = c.speed * getCitizenSpeedMult();
        if (c.hunger > 60) {
          const penalty = Math.min(0.4, (c.hunger - 60) / 100);
          spd *= (1 - penalty);
        }
        if (c._fleeing) spd *= 1.35; // panic sprint
        const step = Math.min(spd, d);
        const nx = c.x + (dx/d) * step;
        const ny = c.y + (dy/d) * step;
        if (canStepCitizen(c, nx, ny)) {
          c.x = nx;
          c.y = ny;
          c._movedAt = G.gameTick;
          if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) {
            c.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
            c.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
          }
        } else {
          clearPath(c);
          c.tx = c.x;
          c.ty = c.y;
        }
        continue;
      }
    }

    // Arrived or no movement needed — run state machine
    c.activityTimer -= 1;
    if (c.activityTimer > 0) continue;
    runStateMachine(c);
  }
  // After all movement — apply personal-space separation
  applyCitizenSeparation();
}

function runStateMachine(c) {
  switch (c.activity.kind) {
    case 'idle':
    case 'find_job':
      // Carried goods are an obligation: a citizen holding cargo delivers it
      // before seeking new work or loitering — this was the stranded-carrier
      // freeze (idle with wood in hand, goods leaked from the economy).
      if (c.carrying && c.carryAmount > 0) {
        setActivity(c, 'needs_delivery', { reason: 'cargo-ready' });
        clearPath(c);
        break;
      }
      // Hungry? Eat first. Citizen eats when hunger > 70 and food is available.
      if (c.hunger > 70 && G.resources.food > 0) {
        G.resources.food--;
        c.hunger = Math.max(0, c.hunger - 60);
        setActivity(c, 'eating', { timer: 20 });
        c.path = null;
        return;
      }

      // Pick the best job by utility score (Phase 3c) — not merely the
      // nearest. Under a food crisis the colony visibly reallocates
      // labor toward farms and bakeries.
      let job = assignedBuilding(c);
      if (!job || !G.buildings.includes(job)) {
        if (job) releaseCitizenAssignment(c, 'assignment-invalid');
        job = null;
        let bestScore = -Infinity, bestB = null;
        for (const b of G.buildings) {
          if (isBlacklisted(c, b.x, b.y)) continue;
          const def = BUILDINGS[b.type];
          if (!def) continue; // guard against unknown building types (corrupt save, etc.)
          const site = isConstructionSite(b);
          if (!site && !def.prod && !def.workers) continue;
          // A site under construction offers BUILDER slots regardless of the
          // finished building's staffing; production slots take over after.
          const needed = citizenStaffingCapacity(b);
          if (staffingCount(b) >= needed) continue;
          const score = scoreJob(c, b);
          if (score > bestScore) { bestScore = score; bestB = b; }
        }
        if (bestB) {
          const reason = isConstructionSite(bestB)
            ? 'construction'
            : (foodDaysLeft() < 2 && FOOD_JOBS.has(bestB.type) ? 'food-crisis' : 'job-market');
          claimCitizenAssignment(c, bestB, {
            duty: assignmentDutyForBuilding(bestB),
            purpose: assignmentPurposeForCitizen(c, bestB),
            reason,
          });
          job = bestB;
        }
      }

      if (job) {
        setActivity(c, 'walk_to_work');
        pathToWork(c);
        if (!c.path) {
          // An unreachable worksite used to win the utility score again on
          // the next idle tick, pinning a citizen in an assign/fail loop.
          releaseJob(c, { unreachable: true });
          setActivity(c, 'idle', { reason: 'path-unreachable', timer: 25 + rngInt(0, 35) });
        }
      } else {
        // No building job — forage from nearby resource tiles
        const gx = Math.round(c.x), gy = Math.round(c.y);
        let forageTarget = null;
        let forageDist = Infinity;
        const searchR = 6;
        for (let dy = -searchR; dy <= searchR; dy++) {
          for (let dx = -searchR; dx <= searchR; dx++) {
            const nx = gx+dx, ny = gy+dy;
            if (nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) continue;
            if (!G.fog[ny][nx]) continue;
            const tile = G.map[ny][nx];
            // Forage from forest, stone, or sand (berries)
            if (tile === 3 || tile === 4 || tile === 1) {
              const d = Math.abs(dx)+Math.abs(dy);
              if (d < forageDist && !G.buildingGrid[ny]?.[nx]) {
                forageDist = d;
                forageTarget = { x: nx, y: ny, tile };
              }
            }
          }
        }

        const needsFood = G.resources.food < Math.max(20, G.population * 6);
        if (forageTarget && (needsFood || rng() < 0.25)) {
          setActivity(c, 'foraging');
          c.forageTarget = forageTarget;
          pathTo(c, forageTarget.x, forageTarget.y);
        } else {
          // Truly idle — loiter near settlement anchors instead of taking
          // long, map-center wander paths that read as aimless churn.
          const target = idleLoiterTarget(c);
          pathTo(c, target.x, target.y);
          setActivity(c, 'idle', { timer: 120 + rngInt(0, 140) });
        }
      }
      break;

    case 'walk_to_work':
      if (!assignedBuilding(c) || !G.buildings.includes(assignedBuilding(c))) {
        releaseJob(c);
        setActivity(c, 'find_job', { reason: 'assignment-invalid' });
        clearPath(c);
        break;
      }
      if (!c.workTarget || (c.workTarget.resource != null && G.map[c.workTarget.y]?.[c.workTarget.x] !== c.workTarget.resource)) {
        c.workTarget = workTargetForBuilding(c, assignedBuilding(c));
      }
      if (dist2(c.x, c.y, c.workTarget.x, c.workTarget.y) > 1.8) {
        pathToWork(c);
        if (c.path) break;
        releaseJob(c, { unreachable: true });
        setActivity(c, 'idle', { reason: 'path-unreachable', timer: 25 + rngInt(0, 35) });
        break;
      }
      // Arrived at workplace
      startWorking(c, 60 + rngInt(0, 30));
      break;

    case 'working':
      if (!assignedBuilding(c) || !G.buildings.includes(assignedBuilding(c))) {
        releaseJob(c);
        setActivity(c, 'find_job', { reason: 'assignment-invalid' });
        clearPath(c);
        break;
      }
      // Resource nodes are consumed/changed by the sim. Reacquire a valid
      // exterior work tile before the next production beat instead of
      // continuing to animate against an empty patch of ground.
      if (c.workTarget?.resource != null &&
          G.map[c.workTarget.y]?.[c.workTarget.x] !== c.workTarget.resource) {
        c.workTarget = workTargetForBuilding(c, assignedBuilding(c));
        setActivity(c, 'walk_to_work');
        pathToWork(c);
        if (!c.path) {
          releaseJob(c, { unreachable: true });
          setActivity(c, 'idle', { reason: 'path-unreachable', timer: 25 + rngInt(0, 35) });
        }
        break;
      }
      // Work-site feedback: periodic chips/grain at the workplace so labor
      // reads as labor even between production cycles.
      const workplace = assignedBuilding(c);
      if (workplace && G.gameTick % 24 === 0) {
        const salt = citizenHash(c);
        const unit = channel => visualJitter(workplace.x, workplace.y, salt + channel);
        if (unit(710) < 0.6) {
          G.particles.push({
            tx: workplace.x + (unit(711) - 0.5) * 0.5,
            ty: workplace.y + (unit(712) - 0.5) * 0.5,
            offsetY: -6, text: null, alpha: 0.85,
            vx: (unit(713) - 0.5) * 0.25, vy: -0.15, decay: 0.05,
            type: 'spark', size: 1.0, color: '#c9a86a',
          });
        }
      }
      // Done working — check if building produced something
      if (workplace) {
        const def = BUILDINGS[workplace.type] || {};
        if ((def.prod || def.convert) && workplace.produced) {
          // Pick up the goods
          const [resKey, amount] = Object.entries(workplace.produced)[0] || [];
          if (resKey) {
            c.carrying = resKey;
            c.carryAmount = amount;
            workplace.produced = null;
            setActivity(c, 'walk_to_deliver', { reason: 'cargo-ready' });
            // User-reported: citizens were walking to map midpoint (MAP_W/2, MAP_H/2)
            // because "town center" was an imaginary coordinate, not a building.
            // Pick a real drop-off: resource-specific storage if present
            // (granary/storehouse for food and goods, market for gold), then
            // nearest house only as a last inhabited fallback.
            if (!routeDelivery(c, resKey)) {
              requestDeliveryStorage(c);
            }
            return;
          }
        }
      }
      // No completed output yet. Stay at the existing workstation instead
      // of taking a 10-tick find_job/idle detour; that detour froze the work
      // row between production checks and made miners look broken.
      startWorking(c, 10 + rngInt(0, 6));
      break;

    case 'needs_delivery': {
      if (c.carrying && c.carryAmount > 0 && routeDelivery(c, c.carrying)) {
        setActivity(c, 'walk_to_deliver');
        break;
      }
      const target = idleLoiterTarget(c);
      if (dist2(c.x, c.y, target.x, target.y) > 1.5) pathTo(c, target.x, target.y);
      requestDeliveryStorage(c);
      break;
    }

    case 'walk_to_deliver':
      if (!c.carrying || c.carryAmount <= 0) {
        c._deliveryTarget = null;
        setActivity(c, 'find_job', { reason: 'cargo-delivered' });
        clearPath(c);
        break;
      }
      if (!deliveryTargetStillValid(c)) {
        setActivity(c, 'needs_delivery');
        clearPath(c);
        break;
      }
      if (c.path && c.pathIdx < c.path.length) break;
      // Arrival counts against the SNAPPED path goal too: the raw request
      // can sit on an unwalkable tile whose ring the citizen legitimately
      // reached — retrying forever from 2.3 tiles away was the orbit bug.
      if (dist2(c.x, c.y, c._requestedTx ?? c.tx, c._requestedTy ?? c.ty) > 2.2 &&
          !(c._pathGoal && dist2(c.x, c.y, c._pathGoal.x, c._pathGoal.y) <= 1.2)) {
        blacklistTarget(c, c._deliveryTarget.x, c._deliveryTarget.y);
        if (routeDelivery(c, c.carrying)) break;
        requestDeliveryStorage(c);
        break;
      }
      // Arrived at delivery point
      setActivity(c, 'deliver');
      clearPath(c);
      break;

    case 'deliver':
      // Only credit a delivery near the actual dropoff — 'Delivered!' in an
      // empty field on a failed repath was a lie AND skipped chain routing.
      if (c.carrying && c.carryAmount > 0 &&
          (!deliveryTargetStillValid(c) ||
            dist2(c.x, c.y, c._deliveryTarget.x, c._deliveryTarget.y) > 4)) {
        if (c._deliveryTarget) blacklistTarget(c, c._deliveryTarget.x, c._deliveryTarget.y);
        requestDeliveryStorage(c);
        break;
      }
      if (c.carrying && c.carryAmount > 0) {
        G.totalResourcesGathered = (G.totalResourcesGathered || 0) + c.carryAmount;
        G.resources[c.carrying] = (G.resources[c.carrying] || 0) + c.carryAmount;
        // Resource number float
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: 0,
          text: `+${c.carryAmount} ${resEmoji(c.carrying)}`,
          alpha: 1.5, vy: -0.3, type: 'text',
        });
        // Speech bubble
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -28,
          text: 'Delivered!',
          alpha: 1.2, vy: -0.12, decay: 0.018, type: 'speech',
        });
      }
      c.carrying = null;
      c.carryAmount = 0;
      c._deliveryTarget = null;
      c.workTarget = null;
      setActivity(c, 'find_job', { reason: 'cargo-delivered', timer: 5 });
      break;

    case 'foraging':
      if (c.forageTarget && dist2(c.x, c.y, c.forageTarget.x, c.forageTarget.y) > 1.2) {
        pathTo(c, c.forageTarget.x, c.forageTarget.y);
        if (c.path) break;
        c.forageTarget = null;
        setActivity(c, 'find_job', { reason: 'path-unreachable', timer: 20 });
        clearPath(c);
        break;
      }
      // Arrived at forage tile — gather a small amount
      if (c.forageTarget) {
        const t = c.forageTarget.tile;
        const res = t === 3 ? 'wood' : t === 4 ? 'stone' : 'food';
        const amount = 1;
        G.resources[res] = (G.resources[res] || 0) + amount;
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: 0,
          text: `+${amount} ${resEmoji(res)}`,
          alpha: 1.2, vy: -0.3, type: 'text',
        });
        // "Found!" bubble removed — the +resource text already communicates the event.
        // Adding a separate speech bubble was redundant and confusing at a distance.
        // resource already credited above — no phantom carry pose
        c.carrying = null;
        c.carryAmount = 0;
      }
      c.forageTarget = null;
      setActivity(c, 'find_job', { reason: 'forage-complete' }); // immediately look for building jobs
      clearPath(c);
      break;

    case 'eating':
      setActivity(c, 'find_job', { timer: 5 });
      clearPath(c);
      break;

    case 'go_home':
      // Shared mover walks the path; when it's exhausted we're home.
      if (c.path && c.pathIdx < c.path.length) break;
      setActivity(c, 'sleep', { timer: 60 });
      clearPath(c);
      break;

    case 'leisure': {
      if (c.path && c.pathIdx < c.path.length) break;
      const venue = c._leisureTarget;
      c._leisureTarget = null;
      if (venue) {
        if (!c.needs) c.needs = { joy: 55, faith: 55 };
        if (venue.kind === 'tavern') {
          c.needs.joy = Math.min(100, c.needs.joy + 40);
        } else {
          c.needs.faith = Math.min(100, c.needs.faith + 40);
        }
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -24,
          text: venue.kind === 'tavern' ? '🍺' : '🙏',
          alpha: 1.1, vy: -0.08, decay: 0.014, type: 'speech',
        });
        // Linger at the venue until night calls everyone home.
        setActivity(c, 'idle', { reason: 'leisure-complete', timer: 90 + rngInt(0, 60) });
      } else {
        setActivity(c, 'find_job', { reason: 'leisure-complete', timer: 5 });
      }
      clearPath(c);
      break;
    }

    case 'sleep':
      // Sleep restores energy; the dawn heartbeat wakes us. Re-enter on
      // a slow cadence and breathe the occasional 💤 so night reads as
      // rest, not a freeze.
      c.rest = Math.min(100, (c.rest ?? 100) + 0.15 * 60);
      if (visualJitter(c.x, c.y, 900 + citizenHash(c)) < 0.25) {
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -24,
          text: '💤', alpha: 0.9, vy: -0.06, decay: 0.012, type: 'speech',
        });
      }
      c.activityTimer = 60;
      break;

    default:
      setActivity(c, 'idle', { reason: 'assignment-invalid', timer: 10 });
      clearPath(c);
  }
}

function resEmoji(k) {
  return {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️'}[k] || k;
}
