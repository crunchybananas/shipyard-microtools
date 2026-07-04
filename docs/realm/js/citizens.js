// ══════════���══════════════════��══════════════════════════════
// Citizen AI — state machine with A* pathfinding
// ══════════════���═══════════════════════════���═════════════════

import { G, BUILDINGS, MAP_W, MAP_H, rng, rngInt, rngRange, getSeasonData, getDayPeriod, getDifficulty, TILE } from './state.js?realm=132';
import { findPath, isWalkable, nearestWalkableTile } from './pathfinding.js?realm=132';
import { getCitizenSpeedMult } from './events.js?realm=132';
import { houseCap, needsBuilders, BUILDER_SLOTS } from './economy.js?realm=132';
import { revealAround } from './world.js?realm=132';

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

function deliveryDropoff(c, resKey) {
  if (resKey === 'food') {
    return nearestBuilding(c, 'granary') || nearestBuilding(c, 'storehouse') || nearestBuilding(c, 'house');
  }
  // Production chain: wheat walks to the mill, flour walks to the bakery,
  // so the goods visibly flow farm -> windmill -> bakery -> granary.
  if (resKey === 'wheat') {
    const store = nearestBuilding(c, 'granary') || nearestBuilding(c, 'storehouse') || nearestBuilding(c, 'house');
    return preferChainTarget(c, nearestBuilding(c, 'windmill'), store);
  }
  if (resKey === 'flour') {
    const store = nearestBuilding(c, 'granary') || nearestBuilding(c, 'storehouse') || nearestBuilding(c, 'house');
    return preferChainTarget(c, nearestBuilding(c, 'bakery'), store);
  }
  if (resKey === 'gold') {
    const store = nearestBuilding(c, 'storehouse') || nearestBuilding(c, 'house');
    return preferChainTarget(c, nearestBuilding(c, 'market'), store);
  }
  return nearestBuilding(c, 'storehouse') || nearestBuilding(c, 'granary') || nearestBuilding(c, 'house');
}

function requestDeliveryStorage(c) {
  c.state = 'needs_delivery';
  c.stateTimer = 90 + rngInt(0, 60);
  clearPath(c);
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
  const label = c?.name || `${Math.round((c?.x || 0) * 10)},${Math.round((c?.y || 0) * 10)}`;
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

function watchProgress(c) {
  const goalActive = (c.path && c.pathIdx < c.path.length) ||
    c.state === 'walk_to_work' || c.state === 'walk_to_deliver' ||
    c.state === 'needs_delivery' || c.state === 'foraging';
  if (!goalActive) { c._wdBest = null; c._wdTicks = 0; return; }
  const gx = c._requestedTx ?? c.tx ?? c.x;
  const gy = c._requestedTy ?? c.ty ?? c.y;
  const d = Math.hypot(gx - c.x, gy - c.y);
  if (c._wdBest == null || d < c._wdBest - 0.2) { c._wdBest = d; c._wdTicks = 0; return; }
  c._wdTicks = (c._wdTicks || 0) + 1;
  if (c._wdTicks > 120) {
    blacklistTarget(c, gx, gy);
    if (c.jobBuilding && c.state === 'walk_to_work') {
      c.jobBuilding.workers = (c.jobBuilding.workers || []).filter(w => w !== c);
      c.jobBuilding = null;
      c.workTarget = null;
      G.particles.push({ tx: c.x, ty: c.y, offsetY: -26, text: "Can't reach it!", alpha: 1.25, vy: -0.12, decay: 0.016, type: 'speech' });
    }
    clearPath(c);
    c.state = 'idle';
    c.stateTimer = 20 + rngInt(0, 15);
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
}

// Loop 3 → Loop 7 (render S3): citizens respect each other, but don't get
// stuck. User-reported bug after L3: citizens could freeze in place because
// separation fought their movement. Now:
//   - Both-moving pairs: no separation (they'll walk past each other on paths).
//   - Mixed pairs (one moving, one idle): 40% strength on the moving citizen,
//     full on the idle one.
//   - Both-idle pairs: full strength.
// Also shrank PERSONAL_SPACE 0.75 → 0.55 — 0.75 was knocking pathing citizens
// off their waypoints even before the stuck bug manifested.
const PERSONAL_SPACE = 0.50;
const SEP_STRENGTH = 0.16;

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
  const target = workTargetForBuilding(c, c.jobBuilding);
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
    if (c._requestedTx !== undefined && (c.state === 'walk_to_deliver' || c.state === 'walk_to_work' || c.state === 'needs_delivery')) {
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

let _openFoodJobTick = -1, _openFoodJobVal = false;
function hasOpenFoodJob() {
  if (_openFoodJobTick !== G.gameTick) {
    _openFoodJobTick = G.gameTick;
    _openFoodJobVal = G.buildings.some(b => {
      if (!FOOD_JOBS.has(b.type)) return false;
      const def = BUILDINGS[b.type];
      return def && (def.workers || 0) > (b.workers?.length || 0);
    });
  }
  return _openFoodJobVal;
}

function isConstructionSite(b) {
  return b.buildProgress !== undefined && b.buildProgress < 1 && needsBuilders(b.type);
}

function scoreJob(c, b) {
  let score = -dist2(c.x, c.y, b.x, b.y);
  const days = foodDaysLeft();
  if (days < 3 && FOOD_JOBS.has(b.type)) score += (3 - days) * 14;
  if (isConstructionSite(b)) score += 12; // fresh sites pull a crew fast
  if (b.type === 'wonder') score += 6; // the great work draws hands
  if (c.jobBuilding === b) score += 6; // hysteresis
  return score;
}

// ── Homes & schedule (Phase 3a) ─────────────────────────────────────
// Citizens sleep in an assigned house at night. Assignment is lazy
// (first nightfall, or when the old home is gone) and respects tier
// capacity via houseCap. Homeless citizens bed down near the
// settlement anchor — visible pressure to build housing.
function assignHome(c) {
  const counts = new Map();
  for (const other of G.citizens) {
    if (other.home) counts.set(other.home, (counts.get(other.home) || 0) + 1);
  }
  let best = null, bestD = Infinity;
  for (const b of G.buildings) {
    if (b.type !== 'house') continue;
    if (b.buildProgress !== undefined && b.buildProgress < 1) continue;
    if ((counts.get(b) || 0) >= houseCap(b)) continue;
    const d = dist2(c.x, c.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  c.home = best;
  return best;
}

function goHome(c) {
  if (!c.home || !G.buildings.includes(c.home)) assignHome(c);
  clearPath(c);
  c.state = 'go_home';
  c.stateTimer = 0;
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
  c._stuckTicks = 0;
}

function isActivelyMoving(c) {
  return c.path && c.pathIdx < c.path.length;
}

function applyCitizenSeparation() {
  const cs = G.citizens;
  const r2 = PERSONAL_SPACE * PERSONAL_SPACE;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      const aMoving = isActivelyMoving(a);
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        const bMoving = isActivelyMoving(b);
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        if (aMoving && bMoving && d2 > 0.09) continue;
        let nx, ny, d;
        if (d2 < 0.0004) {
          const angle = (i * 37 + j * 53 + pass * 97) % 360 * Math.PI / 180;
          nx = Math.cos(angle);
          ny = Math.sin(angle);
          d = 0.02;
        } else {
          d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
        }
        const baseP = ((PERSONAL_SPACE - d) / PERSONAL_SPACE) * SEP_STRENGTH * (pass === 0 ? 0.72 : 0.44);
        // Moving citizens get less push so their path is corrected, not derailed.
        const aWeight = aMoving ? 0.22 : 1.0;
        const bWeight = bMoving ? 0.22 : 1.0;
        const ax = a.x + nx * baseP * 0.5 * aWeight;
        const ay = a.y + ny * baseP * 0.5 * aWeight;
        const bx = b.x - nx * baseP * 0.5 * bWeight;
        const by = b.y - ny * baseP * 0.5 * bWeight;
        if (canStepCitizen(a, ax, ay)) { a.x = ax; a.y = ay; }
        if (canStepCitizen(b, bx, by)) { b.x = bx; b.y = by; }
      }
    }
  }
}

export function updateCitizens() {
  // Loop 71 (render S4): decrement hurtTimer each sim tick so the flash fades.
  for (const c of G.citizens) {
    if (c.hurtTimer > 0) c.hurtTimer -= 1;
  }
  for (const c of G.citizens) {
    // ── Decision heartbeat (AI audit): obligations preempt from ANY state
    // on a short cadence — the brain no longer waits for the body to stop.
    if ((G.gameTick + (c._hb ?? (c._hb = citizenHash(c) % 12))) % 12 === 0) {
      // Eat on the go: a quick bite from the realm stores keeps busy or
      // stuck citizens from saturating at hunger 100 and crawling.
      if (c.hunger > 75 && G.resources.food > 0 && c.state !== 'eating') {
        G.resources.food--;
        c.hunger = Math.max(0, c.hunger - 60);
        G.particles.push({ tx: c.x, ty: c.y, offsetY: -26, text: '🍞', alpha: 1.2, vy: -0.15, decay: 0.02, type: 'text' });
      }
      // Idle carriers deliver immediately instead of waiting out the timer.
      if (c.state === 'idle' && c.carrying && c.carryAmount > 0) {
        c.state = 'needs_delivery';
        c.stateTimer = 0;
        clearPath(c);
      }
      // Self-heal any over-long idle (flee aftermath left stale 260-tick timers).
      if (c.state === 'idle' && c.stateTimer > 140) c.stateTimer = 60;

      // ── Schedule (Phase 3a) ──────────────────────────────────────
      const period = getDayPeriod();
      const threatened = G.enemies.length > 0 && enemyNear(c, 6);
      // Flee flag clears once the danger passes (it used to stick forever
      // — set in combat.js, never reset). While fleeing, citizens sprint.
      if (c._fleeing && !threatened) c._fleeing = false;
      if (period === 'night' && !NIGHT_EXEMPT.has(c.state) && !threatened && !(c.carrying && c.carryAmount > 0)) {
        goHome(c);
      } else if (c.state === 'sleep' && (period !== 'night' || threatened)) {
        // Dawn: wake with a stagger so the morning rush reads as a town
        // waking up, not a synchronized swarm. Danger wakes sleepers
        // immediately — the combat flee response takes them from there.
        c.state = threatened ? 'idle' : 'find_job';
        c.stateTimer = threatened ? 0 : rngInt(0, 40);
        clearPath(c);
        c.rest = Math.min(100, c.rest ?? 100);
        if (threatened) {
          G.particles.push({ tx: c.x, ty: c.y, offsetY: -24, text: '❗', alpha: 1.3, vy: -0.12, decay: 0.02, type: 'speech' });
        }
      } else if (c.state === 'go_home' && threatened) {
        // Abort the walk home if raiders cut the path — flee instead.
        c.state = 'idle';
        c.stateTimer = 0;
        clearPath(c);
      }
      // Rest drains while awake and active; sleep restores it (below).
      if (c.state !== 'sleep' && c.state !== 'idle') {
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
      if (foodDaysLeft() < 2
          && c.jobBuilding && !FOOD_JOBS.has(c.jobBuilding.type)
          && (c.state === 'working' || c.state === 'walk_to_work')
          && rng() < 0.04) {
        c.jobBuilding.workers = (c.jobBuilding.workers || []).filter(w => w !== c);
        c.jobBuilding = null;
        c.workTarget = null;
        c.state = 'find_job';
        c.stateTimer = 0;
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
          && (c.state === 'idle' || c.state === 'find_job')
          && !(c.carrying && c.carryAmount > 0)) {
        const wantJoy = c.needs.joy < 45;
        const wantFaith = c.needs.faith < 45;
        if (wantJoy || wantFaith) {
          const kind = (wantJoy && (!wantFaith || c.needs.joy <= c.needs.faith)) ? 'tavern' : 'church';
          const venue = nearestBuilding(c, kind) || nearestBuilding(c, kind === 'tavern' ? 'church' : 'tavern');
          if (venue && dist2(c.x, c.y, venue.x, venue.y) <= 25) {
            c._leisureDay = G.day;
            c._leisureTarget = { x: venue.x, y: venue.y, kind: venue.type };
            c.state = 'leisure';
            c.stateTimer = 0;
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

    // Hungry emote — show 🍽️ whenever hunger is high (the on-the-go bite
    // usually resolves it, but the player should still see the need)
    if (c.hunger > 70) {
      const emoteInterval = 120; // every 2 seconds at 1x
      if (!c._hungerEmoteTimer) c._hungerEmoteTimer = Math.floor(rng() * emoteInterval);
      c._hungerEmoteTimer--;
      if (c._hungerEmoteTimer <= 0) {
        c._hungerEmoteTimer = emoteInterval + Math.floor(rng() * 60);
        const emote = c.hunger >= 90 ? '❗' : '🍽️';
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -22,
          text: emote,
          alpha: 1.4, vy: -0.1, decay: 0.015, type: 'speech',
        });
      }
    } else {
      c._hungerEmoteTimer = 0;
    }

    // Follow path if we have one
    if (c.path && c.pathIdx < c.path.length) {
      // Obstacle epoch: when any building is placed or removed, validate the
      // REMAINING waypoints once instead of discovering the blockage by
      // walking into it (compressPath means mid-segment tiles are caught by
      // the per-step gate below).
      if (c._pathEpoch !== (G.obstacleEpoch || 0)) {
        c._pathEpoch = G.obstacleEpoch || 0;
        let stale = false;
        for (let wi = c.pathIdx; wi < c.path.length; wi++) {
          if (!isWalkable(c.path[wi].x, c.path[wi].y)) { stale = true; break; }
        }
        if (stale) {
          replanToRequestedTarget(c);
          continue;
        }
      }
      const wp = c.path[c.pathIdx];
      if (!isWalkable(wp.x, wp.y)) {
        replanToRequestedTarget(c);
        continue;
      }
      const dx = wp.x - c.x, dy = wp.y - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 0.15) {
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
        if (canStepCitizen(c, nx, ny)) {
          c.x = nx;
          c.y = ny;
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
    if (!c.path && c.state !== 'walk_to_work' && c.state !== 'walk_to_deliver' && c.state !== 'foraging') {
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
    c.stateTimer -= 1;
    if (c.stateTimer > 0) continue;
    runStateMachine(c);
  }
  // After all movement — apply personal-space separation
  applyCitizenSeparation();
}

function runStateMachine(c) {
  switch (c.state) {
    case 'idle':
    case 'find_job':
      // Carried goods are an obligation: a citizen holding cargo delivers it
      // before seeking new work or loitering — this was the stranded-carrier
      // freeze (idle with wood in hand, goods leaked from the economy).
      if (c.carrying && c.carryAmount > 0) {
        c.state = 'needs_delivery';
        c.stateTimer = 0;
        clearPath(c);
        break;
      }
      // Hungry? Eat first. Citizen eats when hunger > 70 and food is available.
      if (c.hunger > 70 && G.resources.food > 0) {
        G.resources.food--;
        c.hunger = Math.max(0, c.hunger - 60);
        c.state = 'eating';
        c.stateTimer = 20;
        c.path = null;
        return;
      }

      // Pick the best job by utility score (Phase 3c) — not merely the
      // nearest. Under a food crisis the colony visibly reallocates
      // labor toward farms and bakeries.
      if (!c.jobBuilding || !G.buildings.includes(c.jobBuilding)) {
        c.jobBuilding = null;
        let bestScore = -Infinity, bestB = null;
        for (const b of G.buildings) {
          if (isBlacklisted(c, b.x, b.y)) continue;
          const def = BUILDINGS[b.type];
          if (!def) continue; // guard against unknown building types (corrupt save, etc.)
          const site = isConstructionSite(b);
          if (!site && !def.prod && !def.workers) continue;
          // A site under construction offers BUILDER slots regardless of the
          // finished building's staffing; production slots take over after.
          const needed = site ? BUILDER_SLOTS : (def.workers || 0);
          if (b.workers.length >= needed) continue;
          if (b.workers.includes(c)) continue;
          const score = scoreJob(c, b);
          if (score > bestScore) { bestScore = score; bestB = b; }
        }
        if (bestB) {
          c.jobBuilding = bestB;
          bestB.workers.push(c);
        }
      }

      if (c.jobBuilding) {
        c.state = 'walk_to_work';
        pathToWork(c);
        if (!c.path) {
          c.jobBuilding.workers = (c.jobBuilding.workers || []).filter(w => w !== c);
          c.jobBuilding = null;
          c.workTarget = null;
          c.state = 'idle';
          c.stateTimer = 25 + rngInt(0, 35);
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
          c.state = 'foraging';
          c.forageTarget = forageTarget;
          pathTo(c, forageTarget.x, forageTarget.y);
        } else {
          // Truly idle — loiter near settlement anchors instead of taking
          // long, map-center wander paths that read as aimless churn.
          const target = idleLoiterTarget(c);
          pathTo(c, target.x, target.y);
          c.state = 'idle';
          c.stateTimer = 120 + rngInt(0, 140);
        }
      }
      break;

    case 'walk_to_work':
      if (!c.jobBuilding || !G.buildings.includes(c.jobBuilding)) {
        c.jobBuilding = null;
        c.workTarget = null;
        c.state = 'find_job';
        c.stateTimer = 0;
        clearPath(c);
        break;
      }
      if (!c.workTarget || (c.workTarget.resource != null && G.map[c.workTarget.y]?.[c.workTarget.x] !== c.workTarget.resource)) {
        c.workTarget = workTargetForBuilding(c, c.jobBuilding);
      }
      if (dist2(c.x, c.y, c.workTarget.x, c.workTarget.y) > 1.8) {
        pathToWork(c);
        if (c.path) break;
        c.jobBuilding.workers = (c.jobBuilding.workers || []).filter(w => w !== c);
        c.jobBuilding = null;
        c.workTarget = null;
        c.state = 'idle';
        c.stateTimer = 25 + rngInt(0, 35);
        break;
      }
      // Arrived at workplace
      c.state = 'working';
      c.stateTimer = 60 + rngInt(0, 30);
      clearPath(c);
      break;

    case 'working':
      // Work-site feedback: periodic chips/grain at the workplace so labor
      // reads as labor even between production cycles.
      if (c.jobBuilding && G.gameTick % 24 === 0 && rng() < 0.6) {
        G.particles.push({
          tx: c.jobBuilding.x + (rng() - 0.5) * 0.5,
          ty: c.jobBuilding.y + (rng() - 0.5) * 0.5,
          offsetY: -6, text: null, alpha: 0.85,
          vx: (rng() - 0.5) * 0.25, vy: -0.15, decay: 0.05,
          type: 'spark', size: 1.0, color: '#c9a86a',
        });
      }
      // Done working — check if building produced something
      if (c.jobBuilding) {
        const def = BUILDINGS[c.jobBuilding.type] || {};
        if ((def.prod || def.convert) && c.jobBuilding.produced) {
          // Pick up the goods
          const [resKey, amount] = Object.entries(c.jobBuilding.produced)[0] || [];
          if (resKey) {
            c.carrying = resKey;
            c.carryAmount = amount;
            c.jobBuilding.produced = null;
            c.state = 'walk_to_deliver';
            // User-reported: citizens were walking to map midpoint (MAP_W/2, MAP_H/2)
            // because "town center" was an imaginary coordinate, not a building.
            // Pick a real drop-off: resource-specific storage if present
            // (granary/storehouse for food and goods, market for gold), then
            // nearest house only as a last inhabited fallback.
            const dropoff = deliveryDropoff(c, resKey);
            if (dropoff) {
              pathTo(c, dropoff.x, dropoff.y);
            } else {
              requestDeliveryStorage(c);
            }
            return;
          }
        }
      }
      // Nothing to carry — cycle back to working
      c.state = 'find_job';
      c.stateTimer = 10;
      clearPath(c);
      break;

    case 'needs_delivery': {
      const dropoff = c.carrying ? deliveryDropoff(c, c.carrying) : null;
      if (dropoff) {
        c.state = 'walk_to_deliver';
        pathTo(c, dropoff.x, dropoff.y);
        break;
      }
      const target = idleLoiterTarget(c);
      if (dist2(c.x, c.y, target.x, target.y) > 1.5) pathTo(c, target.x, target.y);
      requestDeliveryStorage(c);
      break;
    }

    case 'walk_to_deliver':
      if (c.path && c.pathIdx < c.path.length) break;
      // Arrival counts against the SNAPPED path goal too: the raw request
      // can sit on an unwalkable tile whose ring the citizen legitimately
      // reached — retrying forever from 2.3 tiles away was the orbit bug.
      if (dist2(c.x, c.y, c._requestedTx ?? c.tx, c._requestedTy ?? c.ty) > 2.2 &&
          !(c._pathGoal && dist2(c.x, c.y, c._pathGoal.x, c._pathGoal.y) <= 1.2)) {
        pathTo(c, c._requestedTx ?? c.tx, c._requestedTy ?? c.ty);
        if (c.path) break;
      }
      // Arrived at delivery point
      c.state = 'deliver';
      c.stateTimer = 0;
      clearPath(c);
      break;

    case 'deliver':
      // Only credit a delivery near the actual dropoff — 'Delivered!' in an
      // empty field on a failed repath was a lie AND skipped chain routing.
      if (c.carrying && c.carryAmount > 0 &&
          dist2(c.x, c.y, c._requestedTx ?? c.x, c._requestedTy ?? c.y) > 4) {
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
      c.workTarget = null;
      c.state = 'find_job';
      c.stateTimer = 5;
      break;

    case 'foraging':
      if (c.forageTarget && dist2(c.x, c.y, c.forageTarget.x, c.forageTarget.y) > 1.2) {
        pathTo(c, c.forageTarget.x, c.forageTarget.y);
        if (c.path) break;
        c.forageTarget = null;
        c.state = 'find_job';
        c.stateTimer = 20;
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
      c.state = 'find_job';
      c.stateTimer = 0; // immediately look for building jobs
      clearPath(c);
      break;

    case 'eating':
      c.state = 'find_job';
      c.stateTimer = 5;
      clearPath(c);
      break;

    case 'go_home':
      // Shared mover walks the path; when it's exhausted we're home.
      if (c.path && c.pathIdx < c.path.length) break;
      c.state = 'sleep';
      c.stateTimer = 60;
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
        c.state = 'idle';
        c.stateTimer = 90 + rngInt(0, 60);
      } else {
        c.state = 'find_job';
        c.stateTimer = 5;
      }
      clearPath(c);
      break;
    }

    case 'sleep':
      // Sleep restores energy; the dawn heartbeat wakes us. Re-enter on
      // a slow cadence and breathe the occasional 💤 so night reads as
      // rest, not a freeze.
      c.rest = Math.min(100, (c.rest ?? 100) + 0.15 * 60);
      if (rng() < 0.25) {
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -24,
          text: '💤', alpha: 0.9, vy: -0.06, decay: 0.012, type: 'speech',
        });
      }
      c.stateTimer = 60;
      break;

    default:
      c.state = 'idle';
      c.stateTimer = 10;
      clearPath(c);
  }
}

function resEmoji(k) {
  return {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️'}[k] || k;
}
