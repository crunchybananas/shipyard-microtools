// Deterministic fixed-tick routing scheduler. This core-safe module contains no
// Worker, Promise, or wall-clock dependency. A shell client drains plain
// messages and injects plain results; headless simulation simply uses the
// synchronous kernel fallback at the same authoritative ready tick.

import { findPathOnGrid } from './pathfinding-kernel.js?realm=197';

// Five ticks crosses at least one browser event-loop boundary even when the
// visible shell advances four simulation ticks in one 4x-speed frame.
export const PATHFINDING_READY_DELAY_TICKS = 5;
// A late shadow response may still validate the Worker after the synchronous
// result was consumed. Keep that comparison window bounded so an absent or
// failed transport cannot retain route records for the rest of the session.
export const PATHFINDING_SHADOW_RETENTION_TICKS = 120;
export const PATHFINDING_MODES = Object.freeze({
  SYNC: 'sync',
  SHADOW: 'shadow',
  WORKER: 'worker',
});

let generation = 1;
let mode = PATHFINDING_MODES.SYNC;
let grids = new Map();
let requests = new Map();
let sentGrids = new Set();
let sentRequests = new Set();
let newestObstacleEpoch = -1;
let diagnostics = freshDiagnostics();

function freshDiagnostics() {
  return {
    shadowMatches: 0,
    shadowMismatches: 0,
    workerResponses: 0,
    workerAuthorities: 0,
    syncFallbacks: 0,
    workerErrors: 0,
    rejectedResponses: 0,
  };
}

function assertInteger(value, name, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be an integer >= ${minimum}.`);
  }
}

function canonicalMaxExpanded(request, snapshot) {
  return request.maxExpanded === null ? snapshot.width * snapshot.height : request.maxExpanded;
}

function canonicalNumber(value) {
  return Object.is(value, -0) ? '0' : String(value);
}

function canonicalRequestId(request) {
  return [
    'pf',
    request.obstacleEpoch,
    request.requestedTick,
    request.actorId,
    canonicalNumber(request.sx),
    canonicalNumber(request.sy),
    canonicalNumber(request.ex),
    canonicalNumber(request.ey),
    request.maxExpanded === null ? 'auto' : request.maxExpanded,
  ].join(':');
}

function validateRequest(request) {
  if (!request || typeof request.requestId !== 'string') {
    throw new TypeError('Invalid pathfinding request.');
  }
  assertInteger(request.actorId, 'Pathfinding actorId', { minimum: 1 });
  assertInteger(request.obstacleEpoch, 'Pathfinding obstacleEpoch');
  assertInteger(request.requestedTick, 'Pathfinding requestedTick');
  for (const [name, value] of Object.entries({
    sx: request.sx,
    sy: request.sy,
    ex: request.ex,
    ey: request.ey,
  })) {
    if (!Number.isFinite(value)) throw new TypeError(`Pathfinding ${name} must be finite.`);
  }
  if (request.maxExpanded !== null) assertInteger(request.maxExpanded, 'Pathfinding maxExpanded');
  const expectedReadyTick = request.requestedTick + PATHFINDING_READY_DELAY_TICKS;
  if (!Number.isSafeInteger(expectedReadyTick)) throw new RangeError('Pathfinding readyTick overflow.');
  if (request.readyTick !== expectedReadyTick) throw new RangeError('Invalid pathfinding readyTick.');
  if (request.requestId !== canonicalRequestId(request)) throw new Error('Invalid pathfinding requestId.');
}

function queryShape(request, snapshot) {
  return {
    requestId: request.requestId,
    actorId: request.actorId,
    obstacleEpoch: request.obstacleEpoch,
    requestedTick: request.requestedTick,
    readyTick: request.readyTick,
    sx: request.sx,
    sy: request.sy,
    ex: request.ex,
    ey: request.ey,
    maxExpanded: canonicalMaxExpanded(request, snapshot),
  };
}

function sameQuery(a, b) {
  return a.requestId === b.requestId
    && a.actorId === b.actorId
    && a.obstacleEpoch === b.obstacleEpoch
    && a.requestedTick === b.requestedTick
    && a.readyTick === b.readyTick
    && a.sx === b.sx && a.sy === b.sy
    && a.ex === b.ex && a.ey === b.ey
    && a.maxExpanded === b.maxExpanded;
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y } : null;
}

function cloneKernelResult(result) {
  return {
    path: result.path ? result.path.map(clonePoint) : null,
    goal: clonePoint(result.goal),
    expandedNodes: result.expandedNodes,
  };
}

function validKernelResult(result) {
  if (!result || !Number.isSafeInteger(result.expandedNodes) || result.expandedNodes < 0) return false;
  if (result.path === null) return result.goal === null;
  if (!Array.isArray(result.path) || !result.goal) return false;
  const points = [...result.path, result.goal];
  return points.every(point => point
    && Number.isInteger(point.x) && Number.isInteger(point.y));
}

export function pathfindingResultsEqual(a, b) {
  if (!validKernelResult(a) || !validKernelResult(b)) return false;
  if (a.expandedNodes !== b.expandedNodes) return false;
  if ((a.path === null) !== (b.path === null)) return false;
  if (a.goal?.x !== b.goal?.x || a.goal?.y !== b.goal?.y) return false;
  if (a.path === null) return true;
  if (a.path.length !== b.path.length) return false;
  return a.path.every((point, index) => (
    point.x === b.path[index].x && point.y === b.path[index].y
  ));
}

function computeSync(record) {
  if (!record.syncResult) {
    record.syncResult = findPathOnGrid(
      record.snapshot,
      record.query.sx,
      record.query.sy,
      record.query.ex,
      record.query.ey,
      record.query.maxExpanded,
    );
  }
  return record.syncResult;
}

function compareShadow(record) {
  if (!record.workerResult || record.shadowCompared) return;
  record.shadowCompared = true;
  if (pathfindingResultsEqual(computeSync(record), record.workerResult)) diagnostics.shadowMatches++;
  else {
    diagnostics.shadowMismatches++;
    // A mismatch discovered after the first clean route has already promoted
    // authority must still fail closed. Timing may decide when it is observed,
    // but it can never leave a known-divergent Worker authoritative.
    useSynchronousPathfindingService();
  }
}

function deleteRecord(requestId) {
  const record = requests.get(requestId);
  if (!record) return;
  const obstacleEpoch = record.query.obstacleEpoch;
  requests.delete(requestId);
  sentRequests.delete(requestId);
  const epochInUse = [...requests.values()]
    .some(candidate => candidate.query.obstacleEpoch === obstacleEpoch);
  if (!epochInUse) {
    grids.delete(obstacleEpoch);
    sentGrids.delete(obstacleEpoch);
  }
}

function pruneConsumed(currentTick) {
  for (const [requestId, record] of requests) {
    if (record.consumedAtTick === null) continue;
    if (record.workerFailed
      || currentTick - record.consumedAtTick >= PATHFINDING_SHADOW_RETENTION_TICKS) {
      deleteRecord(requestId);
    }
  }
}

function advanceObstacleEpoch(obstacleEpoch) {
  if (obstacleEpoch <= newestObstacleEpoch) return;
  newestObstacleEpoch = obstacleEpoch;
  for (const [requestId, record] of requests) {
    if (record.query.obstacleEpoch < obstacleEpoch) deleteRecord(requestId);
  }
  for (const epoch of grids.keys()) {
    if (epoch < obstacleEpoch) grids.delete(epoch);
  }
  for (const epoch of sentGrids) {
    if (epoch < obstacleEpoch) sentGrids.delete(epoch);
  }
}

export function makePathfindingRequest({
  actorId,
  obstacleEpoch,
  requestedTick,
  sx,
  sy,
  ex,
  ey,
  maxExpanded = null,
} = {}) {
  assertInteger(actorId, 'Pathfinding actorId', { minimum: 1 });
  assertInteger(obstacleEpoch, 'Pathfinding obstacleEpoch');
  assertInteger(requestedTick, 'Pathfinding requestedTick');
  for (const [name, value] of Object.entries({ sx, sy, ex, ey })) {
    if (!Number.isFinite(value)) throw new TypeError(`Pathfinding ${name} must be finite.`);
  }
  if (maxExpanded !== null) assertInteger(maxExpanded, 'Pathfinding maxExpanded');
  const readyTick = requestedTick + PATHFINDING_READY_DELAY_TICKS;
  if (!Number.isSafeInteger(readyTick)) throw new RangeError('Pathfinding readyTick overflow.');
  return Object.freeze({
    requestId: canonicalRequestId({
      actorId,
      obstacleEpoch,
      requestedTick,
      sx, sy, ex, ey,
      maxExpanded,
    }),
    actorId,
    obstacleEpoch,
    requestedTick,
    readyTick,
    sx, sy, ex, ey,
    maxExpanded,
  });
}

export function enqueuePathfindingRequest(request, snapshot) {
  validateRequest(request);
  if (!snapshot || !(snapshot.cells instanceof Uint8Array)) throw new TypeError('Invalid pathfinding grid snapshot.');
  if (snapshot.obstacleEpoch !== request.obstacleEpoch) {
    throw new RangeError('Pathfinding request and grid obstacleEpoch disagree.');
  }
  pruneConsumed(request.requestedTick);
  if (request.obstacleEpoch < newestObstacleEpoch) {
    // A saved request against superseded topology is intentionally left
    // missing. Its owner can deterministically issue a fresh route.
    return request.requestId;
  }
  advanceObstacleEpoch(request.obstacleEpoch);
  const query = queryShape(request, snapshot);
  const priorGrid = grids.get(snapshot.obstacleEpoch);
  if (priorGrid && priorGrid !== snapshot) {
    throw new Error('A new grid identity at the same obstacleEpoch requires a service generation reset.');
  }
  grids.set(snapshot.obstacleEpoch, snapshot);

  const existing = requests.get(request.requestId);
  if (existing) {
    if (!sameQuery(existing.query, query)) throw new Error(`Pathfinding requestId collision: ${request.requestId}`);
    return request.requestId;
  }
  const record = {
    query,
    snapshot,
    syncResult: null,
    workerResult: null,
    workerFailed: false,
    shadowCompared: false,
    consumedAtTick: null,
  };
  if (mode !== PATHFINDING_MODES.WORKER) computeSync(record);
  requests.set(request.requestId, record);
  return request.requestId;
}

export function cancelPathfindingRequest(requestId) {
  if (typeof requestId !== 'string') return false;
  if (!requests.has(requestId)) return false;
  deleteRecord(requestId);
  return true;
}

function requestOrder(a, b) {
  return (a.requestedTick - b.requestedTick)
    || (a.actorId - b.actorId)
    || (a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0);
}

export function drainPathfindingWorkerMessages() {
  if (mode === PATHFINDING_MODES.SYNC) return [];
  const unsent = [...requests.values()]
    .filter(record => !sentRequests.has(record.query.requestId))
    .sort((a, b) => requestOrder(a.query, b.query));
  const epochs = [...new Set(unsent.map(record => record.query.obstacleEpoch))]
    .filter(epoch => !sentGrids.has(epoch))
    .sort((a, b) => a - b);
  const messages = [];
  for (const obstacleEpoch of epochs) {
    messages.push({
      type: 'grid',
      generation,
      obstacleEpoch,
      snapshot: grids.get(obstacleEpoch),
    });
    sentGrids.add(obstacleEpoch);
  }
  for (const record of unsent) {
    messages.push({ type: 'route', generation, request: { ...record.query } });
    sentRequests.add(record.query.requestId);
  }
  return messages;
}

export function acceptPathfindingWorkerMessage(message) {
  if (!message
    || (message.type !== 'route-result' && message.type !== 'route-error')
    || message.generation !== generation) {
    diagnostics.rejectedResponses++;
    return false;
  }
  const record = requests.get(message.requestId);
  if (!record || message.obstacleEpoch !== record.query.obstacleEpoch) {
    diagnostics.rejectedResponses++;
    return false;
  }
  if (message.type === 'route-error') {
    diagnostics.workerErrors++;
    record.workerFailed = true;
    if (record.consumedAtTick !== null) deleteRecord(message.requestId);
    return true;
  }
  if (!validKernelResult(message.result)) {
    diagnostics.rejectedResponses++;
    return false;
  }
  diagnostics.workerResponses++;
  record.workerResult = cloneKernelResult(message.result);
  if (mode === PATHFINDING_MODES.SHADOW || record.syncResult) compareShadow(record);
  if (record.consumedAtTick !== null && record.shadowCompared) deleteRecord(message.requestId);
  return true;
}

function readyPayload(record, result) {
  const path = result.path ? result.path.map(clonePoint) : null;
  if (path) path.goal = clonePoint(result.goal);
  return {
    status: 'ready',
    requestId: record.query.requestId,
    obstacleEpoch: record.query.obstacleEpoch,
    requestedTick: record.query.requestedTick,
    readyTick: record.query.readyTick,
    path,
    expandedNodes: result.expandedNodes,
  };
}

export function takePathfindingResult(requestId, { gameTick, obstacleEpoch } = {}) {
  assertInteger(gameTick, 'Pathfinding result gameTick');
  assertInteger(obstacleEpoch, 'Pathfinding result obstacleEpoch');
  pruneConsumed(gameTick);
  const record = requests.get(requestId);
  if (!record) return { status: 'missing', requestId };
  if (record.consumedAtTick !== null) return { status: 'consumed', requestId };
  if (obstacleEpoch !== record.query.obstacleEpoch) {
    deleteRecord(requestId);
    return { status: 'stale', requestId };
  }
  if (gameTick < record.query.readyTick) {
    return { status: 'pending', requestId, readyTick: record.query.readyTick };
  }

  let result;
  if (mode === PATHFINDING_MODES.WORKER && record.workerResult) {
    result = record.workerResult;
    diagnostics.workerAuthorities++;
  } else {
    result = computeSync(record);
    if (mode === PATHFINDING_MODES.WORKER) diagnostics.syncFallbacks++;
  }
  record.consumedAtTick = gameTick;
  const payload = readyPayload(record, result);
  if (mode !== PATHFINDING_MODES.SHADOW || record.shadowCompared || record.workerFailed) {
    deleteRecord(requestId);
  }
  return payload;
}

export function beginPathfindingShadowMode() {
  mode = PATHFINDING_MODES.SHADOW;
  for (const record of requests.values()) computeSync(record);
  return true;
}

export function promotePathfindingWorkerAuthority() {
  if (mode !== PATHFINDING_MODES.SHADOW
    || diagnostics.shadowMatches < 1
    || diagnostics.shadowMismatches > 0) return false;
  mode = PATHFINDING_MODES.WORKER;
  return true;
}

export function useSynchronousPathfindingService() {
  mode = PATHFINDING_MODES.SYNC;
  // A later Worker instance must receive fresh grid and route messages; these
  // markers describe the terminated transport, not authoritative core state.
  sentGrids.clear();
  sentRequests.clear();
}

export function resetPathfindingService({ preserveWorkerTransport = false } = {}) {
  const restartInShadow = preserveWorkerTransport && mode !== PATHFINDING_MODES.SYNC;
  generation++;
  // A surviving shell transport may continue across a generated/hydrated
  // world identity, but authority never does: the new generation must earn a
  // fresh exact shadow comparison before using Worker output.
  mode = restartInShadow ? PATHFINDING_MODES.SHADOW : PATHFINDING_MODES.SYNC;
  grids = new Map();
  requests = new Map();
  sentGrids = new Set();
  sentRequests = new Set();
  newestObstacleEpoch = -1;
  diagnostics = freshDiagnostics();
  return generation;
}

export function getPathfindingServiceReport() {
  const active = [...requests.values()].filter(record => record.consumedAtTick === null);
  return Object.freeze({
    generation,
    mode,
    newestObstacleEpoch,
    pendingRequests: active.length,
    retainedShadowRequests: requests.size - active.length,
    gridSnapshots: grids.size,
    queuedDispatches: active.filter(record => !sentRequests.has(record.query.requestId)).length,
    ...diagnostics,
  });
}
