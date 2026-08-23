import assert from 'node:assert/strict';
import {
  createPathfindingGridSnapshot,
  findPathOnGrid,
} from '../js/pathfinding-kernel.js?realm=196';
import {
  PATHFINDING_MODES,
  PATHFINDING_READY_DELAY_TICKS,
  PATHFINDING_SHADOW_RETENTION_TICKS,
  acceptPathfindingWorkerMessage,
  beginPathfindingShadowMode,
  cancelPathfindingRequest,
  drainPathfindingWorkerMessages,
  enqueuePathfindingRequest,
  getPathfindingServiceReport,
  makePathfindingRequest,
  pathfindingResultsEqual,
  promotePathfindingWorkerAuthority,
  resetPathfindingService,
  takePathfindingResult,
  useSynchronousPathfindingService,
} from '../js/pathfinding-service.js?realm=196';
import {
  pathfindingWorkerClientActive,
  startPathfindingWorkerClient,
} from '../js/pathfinding-client.js?realm=196';

function makeGrid(obstacleEpoch = 1) {
  const width = 24;
  const height = 16;
  const map = Array.from({ length: height }, () => Array(width).fill(1));
  const buildingGrid = Array.from({ length: height }, () => Array(width).fill(null));
  for (let y = 2; y < height - 2; y++) {
    if (y !== 8) buildingGrid[y][12] = { type: 'wall' };
  }
  for (let x = 2; x <= 20; x++) buildingGrid[8][x] = { type: 'road' };
  return createPathfindingGridSnapshot({
    width,
    height,
    obstacleEpoch,
    map,
    buildingGrid,
    blockedTerrain: [0, 6],
  });
}

function request(actorId, requestedTick, obstacleEpoch = 1) {
  return makePathfindingRequest({
    actorId,
    obstacleEpoch,
    requestedTick,
    sx: 2,
    sy: 3 + actorId,
    ex: 20,
    ey: 10 - actorId,
  });
}

function resultFor(routeMessage, snapshot) {
  const query = routeMessage.request;
  return {
    type: 'route-result',
    generation: routeMessage.generation,
    requestId: query.requestId,
    obstacleEpoch: query.obstacleEpoch,
    result: findPathOnGrid(
      snapshot,
      query.sx,
      query.sy,
      query.ex,
      query.ey,
      query.maxExpanded,
    ),
  };
}

function syncFixedTickScenario() {
  resetPathfindingService();
  const snapshot = makeGrid();
  const pending = request(1, 10);
  assert.equal(pending.requestId, 'pf:1:10:1:2:4:20:9:auto');
  assert.equal(pending.readyTick, 10 + PATHFINDING_READY_DELAY_TICKS);
  assert.equal(enqueuePathfindingRequest(pending, snapshot), pending.requestId);
  assert.equal(enqueuePathfindingRequest(pending, snapshot), pending.requestId, 'same saved pending request must re-enqueue idempotently');
  assert.equal(takePathfindingResult(pending.requestId, { gameTick: pending.readyTick - 1, obstacleEpoch: 1 }).status, 'pending');
  const ready = takePathfindingResult(pending.requestId, { gameTick: pending.readyTick, obstacleEpoch: 1 });
  assert.equal(ready.status, 'ready');
  const direct = findPathOnGrid(snapshot, pending.sx, pending.sy, pending.ex, pending.ey, snapshot.width * snapshot.height);
  assert.ok(pathfindingResultsEqual(
    { path: ready.path, goal: ready.path?.goal ?? null, expandedNodes: ready.expandedNodes },
    direct,
  ));
  return { requestId: pending.requestId, readyTick: ready.readyTick, path: ready.path };
}

function shadowOrderingAndAuthorityScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const second = request(2, 20);
  const first = request(1, 20);
  enqueuePathfindingRequest(second, snapshot);
  enqueuePathfindingRequest(first, snapshot);
  const messages = drainPathfindingWorkerMessages();
  assert.deepEqual(messages.map(message => message.type), ['grid', 'route', 'route']);
  const routes = messages.filter(message => message.type === 'route');
  assert.deepEqual(
    routes.map(message => message.request.requestId),
    ['pf:1:20:1:2:4:20:9:auto', 'pf:1:20:2:2:5:20:8:auto'],
    'dispatch order must be tick then actorId',
  );

  // Inject in reverse completion order. Arrival order may alter diagnostics,
  // but never the fixed ready tick or authoritative path.
  for (const route of [...routes].reverse()) {
    assert.equal(acceptPathfindingWorkerMessage(resultFor(route, snapshot)), true);
  }
  assert.equal(getPathfindingServiceReport().shadowMatches, 2);
  assert.equal(takePathfindingResult(first.requestId, { gameTick: first.readyTick - 1, obstacleEpoch: 1 }).status, 'pending');
  const firstReady = takePathfindingResult(first.requestId, { gameTick: first.readyTick, obstacleEpoch: 1 });
  assert.equal(firstReady.status, 'ready');
  assert.equal(promotePathfindingWorkerAuthority(), true, 'matched shadow routes must precede Worker authority');
  const secondReady = takePathfindingResult(second.requestId, { gameTick: second.readyTick, obstacleEpoch: 1 });
  assert.equal(secondReady.status, 'ready');
  assert.equal(getPathfindingServiceReport().workerAuthorities, 1);
  return {
    orderedIds: routes.map(message => message.request.requestId),
    firstPath: firstReady.path,
    secondPath: secondReady.path,
  };
}

function fallbackAndLateShadowScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const shadow = request(3, 30);
  enqueuePathfindingRequest(shadow, snapshot);
  const messages = drainPathfindingWorkerMessages();
  const route = messages.find(message => message.type === 'route');
  const ready = takePathfindingResult(shadow.requestId, { gameTick: shadow.readyTick, obstacleEpoch: 1 });
  assert.equal(ready.status, 'ready', 'late Worker must not delay synchronous ready tick');
  assert.equal(getPathfindingServiceReport().shadowMatches, 0);
  assert.equal(acceptPathfindingWorkerMessage(resultFor(route, snapshot)), true, 'late shadow result remains comparable after consumption');
  assert.equal(getPathfindingServiceReport().shadowMatches, 1);
  assert.equal(promotePathfindingWorkerAuthority(), true);

  const fallback = request(4, 40);
  enqueuePathfindingRequest(fallback, snapshot);
  drainPathfindingWorkerMessages(); // dispatched, deliberately no response
  const fallbackReady = takePathfindingResult(fallback.requestId, { gameTick: fallback.readyTick, obstacleEpoch: 1 });
  assert.equal(fallbackReady.status, 'ready');
  assert.equal(getPathfindingServiceReport().syncFallbacks, 1);
  return { latePath: ready.path, fallbackPath: fallbackReady.path };
}

function canonicalIdentityAndRetentionScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const first = request(1, 70);
  const reroute = makePathfindingRequest({
    actorId: first.actorId,
    obstacleEpoch: first.obstacleEpoch,
    requestedTick: first.requestedTick,
    sx: first.sx,
    sy: first.sy,
    ex: first.ex - 1,
    ey: first.ey,
  });
  assert.notEqual(reroute.requestId, first.requestId, 'same-tick reroutes need distinct canonical query IDs');
  enqueuePathfindingRequest(first, snapshot);
  enqueuePathfindingRequest(reroute, snapshot);
  const initialMessages = drainPathfindingWorkerMessages();
  takePathfindingResult(first.requestId, { gameTick: first.readyTick, obstacleEpoch: 1 });
  assert.equal(getPathfindingServiceReport().retainedShadowRequests, 1);

  const later = request(2, first.readyTick + PATHFINDING_SHADOW_RETENTION_TICKS);
  enqueuePathfindingRequest(later, snapshot);
  assert.equal(getPathfindingServiceReport().retainedShadowRequests, 0, 'absent Worker responses must expire');

  drainPathfindingWorkerMessages();
  const errorRoute = initialMessages.find(message => (
    message.type === 'route' && message.request.requestId === reroute.requestId
  ));
  assert.ok(errorRoute);
  assert.equal(acceptPathfindingWorkerMessage({
    type: 'route-error',
    generation: errorRoute.generation,
    requestId: reroute.requestId,
    obstacleEpoch: reroute.obstacleEpoch,
    reason: 'test-error',
  }), true);
  const errorReady = takePathfindingResult(reroute.requestId, {
    gameTick: reroute.readyTick,
    obstacleEpoch: 1,
  });
  assert.equal(errorReady.status, 'ready', 'Worker errors retain deterministic sync fallback');
  assert.equal(getPathfindingServiceReport().workerErrors, 1);
  assert.equal(getPathfindingServiceReport().retainedShadowRequests, 0, 'failed records must not linger');
  return { firstId: first.requestId, rerouteId: reroute.requestId };
}

function obstacleEpochMemoryScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  let oldestId = null;
  for (let obstacleEpoch = 1; obstacleEpoch <= 64; obstacleEpoch++) {
    const pending = request(1, 100 + obstacleEpoch, obstacleEpoch);
    if (oldestId === null) oldestId = pending.requestId;
    enqueuePathfindingRequest(pending, makeGrid(obstacleEpoch));
  }
  const report = getPathfindingServiceReport();
  assert.equal(report.newestObstacleEpoch, 64);
  assert.equal(report.gridSnapshots, 1, 'historical topology snapshots must remain bounded');
  assert.equal(report.pendingRequests, 1, 'new topology must prune pending routes against stale grids');
  assert.equal(report.queuedDispatches, 1, 'stale unsent request keys must be pruned with their grids');
  assert.equal(takePathfindingResult(oldestId, { gameTick: 1000, obstacleEpoch: 64 }).status, 'missing');

  const staleRequest = request(2, 200, 63);
  enqueuePathfindingRequest(staleRequest, makeGrid(63));
  assert.equal(getPathfindingServiceReport().gridSnapshots, 1, 'late stale re-enqueue must not restore old topology');
  assert.equal(takePathfindingResult(staleRequest.requestId, { gameTick: 1000, obstacleEpoch: 64 }).status, 'missing');
  return { newestObstacleEpoch: report.newestObstacleEpoch, gridSnapshots: report.gridSnapshots };
}

function cancellationScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const pending = request(4, 300);
  enqueuePathfindingRequest(pending, snapshot);
  const route = drainPathfindingWorkerMessages().find(message => message.type === 'route');
  assert.ok(route);
  assert.equal(cancelPathfindingRequest(pending.requestId), true);
  assert.equal(cancelPathfindingRequest(pending.requestId), false, 'cancellation must be idempotent');
  const report = getPathfindingServiceReport();
  assert.equal(report.pendingRequests, 0);
  assert.equal(report.retainedShadowRequests, 0);
  assert.equal(report.gridSnapshots, 0);
  assert.equal(report.queuedDispatches, 0);
  assert.equal(acceptPathfindingWorkerMessage(resultFor(route, snapshot)), false, 'late canceled response must be rejected');
  return { pendingRequests: report.pendingRequests, gridSnapshots: report.gridSnapshots };
}

function transportRestartScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const pending = request(3, 400);
  enqueuePathfindingRequest(pending, snapshot);
  assert.deepEqual(
    drainPathfindingWorkerMessages().map(message => message.type),
    ['grid', 'route'],
  );
  useSynchronousPathfindingService();
  beginPathfindingShadowMode();
  assert.deepEqual(
    drainPathfindingWorkerMessages().map(message => message.type),
    ['grid', 'route'],
    'replacement Worker transport must receive the pending grid and route again',
  );
  return pending.requestId;
}

function sameEpochWorldReplacementScenario() {
  resetPathfindingService();
  const firstGrid = makeGrid(9);
  const first = request(1, 500, 9);
  enqueuePathfindingRequest(first, firstGrid);
  takePathfindingResult(first.requestId, { gameTick: first.readyTick, obstacleEpoch: 9 });
  assert.equal(getPathfindingServiceReport().gridSnapshots, 0);

  const replacementGrid = makeGrid(9);
  const replacement = request(2, 510, 9);
  assert.doesNotThrow(() => enqueuePathfindingRequest(replacement, replacementGrid));
  const conflictingGrid = makeGrid(9);
  assert.throws(
    () => enqueuePathfindingRequest(request(3, 511, 9), conflictingGrid),
    /same obstacleEpoch/,
    'snapshot replacement must remain forbidden while a request uses the prior identity',
  );
  return replacement.requestId;
}

function generationTransportPreservationScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const oldSnapshot = makeGrid(20);
  const oldRequest = request(1, 600, 20);
  enqueuePathfindingRequest(oldRequest, oldSnapshot);
  const oldRoute = drainPathfindingWorkerMessages().find(message => message.type === 'route');
  const oldGeneration = oldRoute.generation;

  const newGeneration = resetPathfindingService({ preserveWorkerTransport: true });
  assert.ok(newGeneration > oldGeneration);
  assert.equal(getPathfindingServiceReport().mode, PATHFINDING_MODES.SHADOW, 'surviving transport must restart in shadow');
  assert.equal(promotePathfindingWorkerAuthority(), false, 'prior-world parity must not preserve Worker authority');
  const newSnapshot = makeGrid(20);
  const newRequest = request(1, 600, 20);
  enqueuePathfindingRequest(newRequest, newSnapshot);
  const messages = drainPathfindingWorkerMessages();
  assert.deepEqual(messages.map(message => message.type), ['grid', 'route']);
  assert.ok(messages.every(message => message.generation === newGeneration));
  assert.equal(acceptPathfindingWorkerMessage(resultFor(oldRoute, oldSnapshot)), false, 'old-world Worker response must be rejected');
  return { advanced: newGeneration > oldGeneration };
}

function staleMismatchAndGenerationScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const stale = request(1, 50);
  enqueuePathfindingRequest(stale, snapshot);
  assert.equal(takePathfindingResult(stale.requestId, { gameTick: stale.readyTick, obstacleEpoch: 2 }).status, 'stale');

  const mismatch = request(2, 51);
  enqueuePathfindingRequest(mismatch, snapshot);
  const route = drainPathfindingWorkerMessages().find(message => message.type === 'route' && message.request.requestId === mismatch.requestId);
  const bad = resultFor(route, snapshot);
  bad.result.expandedNodes++;
  assert.equal(acceptPathfindingWorkerMessage(bad), true);
  assert.equal(getPathfindingServiceReport().shadowMismatches, 1);
  assert.equal(promotePathfindingWorkerAuthority(), false, 'shadow mismatch must veto authority');

  const oldGenerationMessage = resultFor(route, snapshot);
  const oldGeneration = oldGenerationMessage.generation;
  const newGeneration = resetPathfindingService();
  assert.ok(newGeneration > oldGeneration);
  assert.equal(acceptPathfindingWorkerMessage(oldGenerationMessage), false, 'generation reset must reject stale Worker output');
  assert.equal(getPathfindingServiceReport().rejectedResponses, 1);
  return { oldGeneration, newGeneration };
}

function postPromotionMismatchFailsClosedScenario() {
  resetPathfindingService();
  beginPathfindingShadowMode();
  const snapshot = makeGrid();
  const clean = request(1, 60);
  const divergent = request(2, 60);
  enqueuePathfindingRequest(clean, snapshot);
  enqueuePathfindingRequest(divergent, snapshot);
  const routes = drainPathfindingWorkerMessages().filter(message => message.type === 'route');
  const cleanRoute = routes.find(route => route.request.requestId === clean.requestId);
  const divergentRoute = routes.find(route => route.request.requestId === divergent.requestId);
  assert.equal(acceptPathfindingWorkerMessage(resultFor(cleanRoute, snapshot)), true);
  assert.equal(promotePathfindingWorkerAuthority(), true);
  const bad = resultFor(divergentRoute, snapshot);
  bad.result.expandedNodes++;
  assert.equal(acceptPathfindingWorkerMessage(bad), true);
  assert.equal(getPathfindingServiceReport().mode, PATHFINDING_MODES.SYNC, 'known divergence must revoke Worker authority');
  const ready = takePathfindingResult(divergent.requestId, {
    gameTick: divergent.readyTick,
    obstacleEpoch: divergent.obstacleEpoch,
  });
  const direct = findPathOnGrid(
    snapshot,
    divergent.sx,
    divergent.sy,
    divergent.ex,
    divergent.ey,
    snapshot.width * snapshot.height,
  );
  assert.equal(ready.expandedNodes, direct.expandedNodes, 'revoked Worker result must not become authoritative');
  return getPathfindingServiceReport().mode;
}

function runDeterministicSuite() {
  const fixed = syncFixedTickScenario();
  const shadow = shadowOrderingAndAuthorityScenario();
  const fallback = fallbackAndLateShadowScenario();
  const stale = staleMismatchAndGenerationScenario();
  const mismatchFailClosed = postPromotionMismatchFailsClosedScenario();
  const identity = canonicalIdentityAndRetentionScenario();
  const epochs = obstacleEpochMemoryScenario();
  const cancellation = cancellationScenario();
  const transportRestart = transportRestartScenario();
  const sameEpochReplacement = sameEpochWorldReplacementScenario();
  const generationTransport = generationTransportPreservationScenario();
  return {
    delay: PATHFINDING_READY_DELAY_TICKS,
    fixed,
    shadow,
    fallback,
    generationAdvanced: stale.newGeneration > stale.oldGeneration,
    mismatchFailClosed,
    identity,
    epochs,
    cancellation,
    transportRestart,
    sameEpochReplacement,
    generationTransport,
  };
}

const first = runDeterministicSuite();
const second = runDeterministicSuite();
assert.deepEqual(second, first, 'service results and request order must repeat across generation resets');
assert.equal(PATHFINDING_READY_DELAY_TICKS, 5);

if (typeof globalThis.Worker === 'undefined') {
  assert.equal(startPathfindingWorkerClient(), false, 'headless Node must remain synchronous without Worker');
  assert.equal(pathfindingWorkerClientActive(), false);
}

console.log(`[pathfinding-service] VERIFIED delay=T+${first.delay}; deterministic IDs/order; shadow compare; Worker authority; sync fallback; late/stale generation rejection`);
