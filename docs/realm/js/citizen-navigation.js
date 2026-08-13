// Citizen route intent, topology validation, and temporary target avoidance.
//
// All fields written here are existing Engine-v2 citizen save fields. The
// caller owns activity decisions and failure policy.

import { G, MAP_H, MAP_W } from './state.js?realm=193';
import { getPathfindingGridSnapshot, isWalkable } from './pathfinding.js?realm=193';
import {
  enqueuePathfindingRequest,
  makePathfindingRequest,
  takePathfindingResult,
} from './pathfinding-service.js?realm=193';
import { citizenIsIndoors } from './residences.js?realm=193';
import { citizenStableHash } from './citizen-activity.js?realm=193';
import { clearCitizenRouteState } from './citizen-route-state.js?realm=193';

const BLACKLIST_TICKS = 600;

export function citizenManhattanDistance(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function citizenTargetCrowdPenalty(citizen, x, y) {
  let penalty = 0;
  for (const other of G.citizens || []) {
    if (other === citizen || citizenIsIndoors(other)) continue;
    const distance = Math.hypot(other.x - x, other.y - y);
    if (distance < 0.72) penalty += 1.6;
    if (Math.round(other.tx ?? other.x) === x && Math.round(other.ty ?? other.y) === y) penalty += 1.1;
    const goal = other.path?.goal;
    if (goal && goal.x === x && goal.y === y) penalty += 1.1;
  }
  return penalty;
}

export function chooseCitizenCrowdAwareTarget(citizen, tx, ty) {
  const rx = Math.round(tx);
  const ry = Math.round(ty);
  const directCrowd = citizenTargetCrowdPenalty(citizen, rx, ry);
  if (isWalkable(rx, ry) && directCrowd < 1.2) return { x: rx, y: ry };

  const candidates = [];
  const maxRadius = isWalkable(rx, ry) ? 2 : 4;
  for (let y = ry - maxRadius; y <= ry + maxRadius; y++) {
    for (let x = rx - maxRadius; x <= rx + maxRadius; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (!isWalkable(x, y)) continue;
      const ring = Math.abs(x - rx) + Math.abs(y - ry);
      if (ring > maxRadius) continue;
      const crowd = citizenTargetCrowdPenalty(citizen, x, y);
      const fromHere = Math.abs(x - citizen.x) + Math.abs(y - citizen.y);
      const roadBonus = G.buildingGrid[y]?.[x]?.type === 'road' ? -0.35 : 0;
      const jitter = ((citizenStableHash(citizen) ^ (x * 73856093) ^ (y * 19349663)) >>> 0)
        / 0xffffffff * 0.18;
      candidates.push({
        x,
        y,
        score: ring * 2.0 + fromHere * 0.16 + crowd * 4.5 + roadBonus + jitter,
      });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || { x: rx, y: ry };
}

function compressCitizenPath(path) {
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

export function clearCitizenPath(citizen) {
  clearCitizenRouteState(citizen);
}

function beginCitizenPathRequest(citizen, target) {
  const snapshot = getPathfindingGridSnapshot();
  const request = makePathfindingRequest({
    actorId: citizen.actorId,
    obstacleEpoch: snapshot.obstacleEpoch,
    requestedTick: G.gameTick,
    sx: Math.round(citizen.x),
    sy: Math.round(citizen.y),
    ex: target.x,
    ey: target.y,
    maxExpanded: null,
  });
  enqueuePathfindingRequest(request, snapshot);
  // Service requests are frozen defensively; citizens store an ordinary
  // writable data clone so the strict save encoder can accept the exact same
  // shape without serializing service internals.
  citizen._pathRequest = { ...request };
  // A truthy empty route preserves the existing immediate caller contract:
  // the route has been accepted, but cannot move until its fixed ready tick.
  citizen.path = [];
  citizen.pathIdx = 0;
  citizen._pathStartedAt = null;
  citizen._pathEpoch = snapshot.obstacleEpoch;
  citizen._stuckTicks = 0;
  citizen._lastPathX = citizen.x;
  citizen._lastPathY = citizen.y;
  citizen.tx = target.x;
  citizen.ty = target.y;
  return true;
}

function applyCitizenPathResult(citizen, result) {
  citizen._pathRequest = null;
  citizen.path = compressCitizenPath(result.path);
  citizen.pathIdx = 0;
  citizen._pathStartedAt = citizen.path ? G.gameTick : null;
  citizen._pathEpoch = result.obstacleEpoch;
  citizen._stuckTicks = 0;
  citizen._lastPathX = citizen.x;
  citizen._lastPathY = citizen.y;
  if (citizen.path) {
    const goal = citizen.path.goal
      || citizen.path[citizen.path.length - 1]
      || citizen._pathGoal
      || { x: citizen._requestedTx, y: citizen._requestedTy };
    citizen.tx = goal.x;
    citizen.ty = goal.y;
    citizen._pathFailedAt = 0;
    return true;
  }
  citizen.tx = citizen.x;
  citizen.ty = citizen.y;
  citizen._pathFailedAt = G.gameTick || 0;
  return false;
}

export function pathCitizenTo(citizen, tx, ty, { exact = false } = {}) {
  if (
    !citizen._pathRequest
    && citizen._pathFailedAt === G.gameTick
    && citizen._requestedTx === tx
    && citizen._requestedTy === ty
  ) return false;

  if (
    citizen._pathRequest
    && citizen._requestedTx === tx
    && citizen._requestedTy === ty
  ) return true;

  clearCitizenPath(citizen);
  citizen._requestedTx = tx;
  citizen._requestedTy = ty;
  const target = exact
    ? { x: Math.round(tx), y: Math.round(ty) }
    : chooseCitizenCrowdAwareTarget(citizen, tx, ty);
  citizen._pathGoal = target;
  return beginCitizenPathRequest(citizen, target);
}

export function advanceCitizenPathRequest(citizen) {
  const pending = citizen._pathRequest;
  if (!pending) return 'none';

  const obstacleEpoch = G.obstacleEpoch || 0;
  if (pending.obstacleEpoch !== obstacleEpoch) {
    clearCitizenPath(citizen);
    const target = citizen._pathGoal || {
      x: Math.round(citizen._requestedTx ?? citizen.tx ?? citizen.x),
      y: Math.round(citizen._requestedTy ?? citizen.ty ?? citizen.y),
    };
    beginCitizenPathRequest(citizen, target);
    return 'pending';
  }

  // Re-enqueueing every tick is intentionally idempotent. It reconstructs
  // service-local state after save/load without serializing a result or any
  // Worker timing, while the saved request retains its original ready tick.
  enqueuePathfindingRequest(pending, getPathfindingGridSnapshot());
  const result = takePathfindingResult(pending.requestId, {
    gameTick: G.gameTick,
    obstacleEpoch,
  });
  if (result.status === 'pending') return 'pending';
  if (result.status === 'ready') {
    return applyCitizenPathResult(citizen, result) ? 'ready' : 'failed';
  }

  // A missing/consumed record can only arise from an external service reset.
  // Reissue the same effective goal at the current authoritative tick.
  clearCitizenPath(citizen);
  const target = citizen._pathGoal || {
    x: Math.round(citizen._requestedTx ?? citizen.tx ?? citizen.x),
    y: Math.round(citizen._requestedTy ?? citizen.ty ?? citizen.y),
  };
  beginCitizenPathRequest(citizen, target);
  return 'pending';
}

export function replanCitizenToRequestedTarget(citizen) {
  const tx = Math.round(citizen._requestedTx ?? citizen.tx ?? citizen.x);
  const ty = Math.round(citizen._requestedTy ?? citizen.ty ?? citizen.y);
  pathCitizenTo(citizen, tx, ty);
}

export function pruneCitizenNoGo(citizen) {
  if (!citizen._noGo) return;
  for (const [coordinate, tick] of Object.entries(citizen._noGo)) {
    if (G.gameTick - tick >= BLACKLIST_TICKS) delete citizen._noGo[coordinate];
  }
  if (Object.keys(citizen._noGo).length === 0) delete citizen._noGo;
}

export function blacklistCitizenTarget(citizen, x, y) {
  pruneCitizenNoGo(citizen);
  citizen._noGo = citizen._noGo || {};
  citizen._noGo[`${Math.round(x)},${Math.round(y)}`] = G.gameTick;
}

export function citizenTargetIsBlacklisted(citizen, x, y) {
  const tick = citizen._noGo?.[`${Math.round(x)},${Math.round(y)}`];
  return tick !== undefined && G.gameTick - tick < BLACKLIST_TICKS;
}

function routeSegmentWalkable(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return isWalkable(toX, toY);
  let priorX = fromX;
  let priorY = fromY;
  for (let step = 1; step <= steps; step++) {
    const x = Math.round(fromX + dx * step / steps);
    const y = Math.round(fromY + dy * step / steps);
    if (x === priorX && y === priorY) continue;
    if (!isWalkable(x, y)) return false;
    if (
      x !== priorX
      && y !== priorY
      && (!isWalkable(x, priorY) || !isWalkable(priorX, y))
    ) return false;
    priorX = x;
    priorY = y;
  }
  return true;
}

export function remainingCitizenRouteIsWalkable(citizen) {
  if (!citizen.path || citizen.pathIdx >= citizen.path.length) return true;
  let x = Math.round(citizen.x);
  let y = Math.round(citizen.y);
  for (let index = citizen.pathIdx; index < citizen.path.length; index++) {
    const waypoint = citizen.path[index];
    if (!routeSegmentWalkable(x, y, waypoint.x, waypoint.y)) return false;
    x = waypoint.x;
    y = waypoint.y;
  }
  return true;
}
