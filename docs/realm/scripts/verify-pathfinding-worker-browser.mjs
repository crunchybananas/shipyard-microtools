#!/usr/bin/env node

// Production-browser proof for Realm's deterministic pathfinding Worker.
//
// This gate deliberately separates three contracts:
//   1. the production client constructs a native module Worker;
//   2. the shared pure kernel is byte-identical on the main thread and Worker;
//   3. the deterministic service publishes only at its authored ready tick and
//      falls back synchronously when transport is absent or late.

import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = join(root, 'scripts', 'screenshots');
const reportPath = join(reportDir, 'pathfinding-worker-browser-report.json');
const runtimeContract = JSON.parse(
  await readFile(join(root, 'runtime-contract.json'), 'utf8'),
);
assert.equal(
  runtimeContract.moduleRevision,
  193,
  'Update pathfinding Worker browser imports with the runtime revision',
);

const browserErrors = [];
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// Observe native construction and transport without replacing the Worker. The
// production client must still execute the browser's actual module Worker path.
await context.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.__pathfindingWorkerProof = {
    constructors: [],
    sent: [],
    received: [],
  };
  class ObservedWorker extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      const summarize = message => ({
        type: message?.type ?? null,
        generation: message?.generation ?? null,
        obstacleEpoch: message?.obstacleEpoch ?? message?.request?.obstacleEpoch ?? null,
        requestId: message?.requestId ?? message?.request?.requestId ?? null,
      });
      window.__pathfindingWorkerProof.constructors.push({
        url: String(url),
        type: options?.type ?? null,
      });
      this.addEventListener('message', event => {
        window.__pathfindingWorkerProof.received.push(summarize(event.data));
      });
      const nativePostMessage = this.postMessage.bind(this);
      this.postMessage = (message, transfer) => {
        window.__pathfindingWorkerProof.sent.push(summarize(message));
        return transfer === undefined
          ? nativePostMessage(message)
          : nativePostMessage(message, transfer);
      };
    }
  }
  Object.defineProperty(window, 'Worker', {
    configurable: true,
    writable: true,
    value: ObservedWorker,
  });
});

const page = await context.newPage();
page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

try {
  await mkdir(reportDir, { recursive: true });
  await page.goto(`${server.gameUrl}?verifyPathfindingWorker=193`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && typeof window.G?.debug?.dispatch === 'function'
  ));
  await page.locator('#kingdom-name-input').fill('Pathfinding Worker Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(() => window.setSpeed(0));

  const result = await page.evaluate(async () => {
    const state = await import('./js/state.js?realm=193');
    const kernel = await import('./js/pathfinding-kernel.js?realm=193');
    const service = await import('./js/pathfinding-service.js?realm=193');
    const client = await import('./js/pathfinding-client.js?realm=193');
    const g = window.G;
    if (state.G !== g) throw new Error('Worker verifier imported a split runtime state identity');

    const jsonBytes = value => new TextEncoder().encode(JSON.stringify(value));
    const bytesEqual = (left, right) => (
      left.byteLength === right.byteLength
      && left.every((value, index) => value === right[index])
    );
    const sha256 = async value => {
      const digest = await crypto.subtle.digest('SHA-256', jsonBytes(value));
      return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    };

    const makeGrid = ({ width = 80, height = 80, epoch = 11, mutate } = {}) => {
      const map = Array.from({ length: height }, () => Array(width).fill('grass'));
      const buildingGrid = Array.from({ length: height }, () => Array(width).fill(null));
      mutate?.({ map, buildingGrid, width, height });
      return kernel.createPathfindingGridSnapshot({
        width,
        height,
        obstacleEpoch: epoch,
        map,
        buildingGrid,
        blockedTerrain: ['water', 'mountain'],
      });
    };

    const fixtures = [
      {
        name: 'blocked-goal',
        snapshot: makeGrid({ epoch: 11, mutate: ({ map }) => {
          map[63][63] = 'mountain';
          map[62][63] = 'mountain';
          map[63][62] = 'mountain';
        } }),
        requests: [{ sx: 4, sy: 4, ex: 63, ey: 63, maxExpanded: 6400 }],
      },
      {
        name: 'road-preference',
        snapshot: makeGrid({ epoch: 12, mutate: ({ buildingGrid }) => {
          for (let x = 5; x <= 70; x++) buildingGrid[18][x] = { type: 'road' };
          for (let y = 18; y <= 64; y++) buildingGrid[y][70] = { type: 'road' };
        } }),
        requests: [{ sx: 5, sy: 18, ex: 70, ey: 64, maxExpanded: 6400 }],
      },
      {
        name: 'long-route',
        snapshot: makeGrid({ epoch: 13, mutate: ({ map }) => {
          for (let x = 8; x < 72; x += 8) {
            const gap = x % 16 === 0 ? 70 : 9;
            for (let y = 5; y < 75; y++) if (y !== gap) map[y][x] = 'water';
          }
        } }),
        requests: [{ sx: 4, sy: 4, ex: 75, ey: 75, maxExpanded: 6400 }],
      },
      {
        name: 'batched',
        snapshot: makeGrid({ epoch: 14, mutate: ({ map, buildingGrid }) => {
          for (let y = 12; y <= 68; y += 8) {
            for (let x = 4; x < 76; x++) buildingGrid[y][x] = { type: 'road' };
          }
          for (let x = 16; x <= 64; x += 16) {
            for (let y = 4; y < 76; y++) buildingGrid[y][x] = { type: 'road' };
          }
          for (let y = 20; y <= 60; y += 20) {
            for (let x = 22; x <= 58; x++) if (x % 16 !== 0) map[y][x] = 'mountain';
          }
        } }),
        requests: Array.from({ length: 48 }, (_, index) => ({
          sx: 3 + (index % 8),
          sy: 3 + ((index * 7) % 18),
          ex: 76 - (index % 9),
          ey: 76 - ((index * 11) % 20),
          maxExpanded: 6400,
        })),
      },
    ];

    const canonicalKernelResult = value => ({
      path: value.path ? value.path.map(point => ({ x: point.x, y: point.y })) : null,
      goal: value.goal ? { x: value.goal.x, y: value.goal.y } : null,
      expandedNodes: value.expandedNodes,
    });
    const canonicalServiceResult = value => ({
      path: value.path ? value.path.map(point => ({ x: point.x, y: point.y })) : null,
      goal: value.path?.goal ? { x: value.path.goal.x, y: value.path.goal.y } : null,
      expandedNodes: value.expandedNodes,
    });
    const waitUntil = async (label, predicate, timeoutMs = 10_000) => {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    };
    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const makeRequest = ({ actorId, snapshot, requestedTick, query }) => (
      service.makePathfindingRequest({
        actorId,
        obstacleEpoch: snapshot.obstacleEpoch,
        requestedTick,
        ...query,
      })
    );
    const workerMessage = (generation, request, syncResult, overrides = {}) => ({
      type: 'route-result',
      generation,
      requestId: request.requestId,
      obstacleEpoch: request.obstacleEpoch,
      result: syncResult,
      ...overrides,
    });

    // Start the real production shell client. Its first route is deliberately
    // a shadow result so promotion has observed parity before any Worker answer
    // becomes authoritative.
    client.stopPathfindingWorkerClient();
    service.resetPathfindingService();
    requireCondition(client.startPathfindingWorkerClient(), 'Production Worker client did not start');
    requireCondition(client.pathfindingWorkerClientActive(), 'Production Worker client is not active');
    requireCondition(
      service.getPathfindingServiceReport().mode === service.PATHFINDING_MODES.SHADOW,
      'Production Worker client did not enter shadow mode',
    );
    const pilotSnapshot = fixtures[0].snapshot;
    const pilotQuery = fixtures[0].requests[0];
    const pilotRequest = makeRequest({
      actorId: 1,
      snapshot: pilotSnapshot,
      requestedTick: 10,
      query: pilotQuery,
    });
    service.enqueuePathfindingRequest(pilotRequest, pilotSnapshot);
    const pilotPending = service.takePathfindingResult(pilotRequest.requestId, {
      gameTick: pilotRequest.readyTick - 1,
      obstacleEpoch: pilotRequest.obstacleEpoch,
    });
    requireCondition(pilotPending.status === 'pending', 'Pilot became visible before its fixed ready tick');
    const pilotReady = service.takePathfindingResult(pilotRequest.requestId, {
      gameTick: pilotRequest.readyTick,
      obstacleEpoch: pilotRequest.obstacleEpoch,
    });
    requireCondition(pilotReady.status === 'ready', 'Shadow pilot was not synchronously ready at its fixed tick');
    const pilotDispatchCount = client.pumpPathfindingWorkerClient();
    requireCondition(pilotDispatchCount === 2, `Pilot dispatch count was ${pilotDispatchCount}, expected grid + route`);
    await waitUntil('native Worker shadow response and automatic promotion', () => (
      service.getPathfindingServiceReport().workerResponses >= 1
      && service.getPathfindingServiceReport().mode === service.PATHFINDING_MODES.WORKER
    ));
    const autoPromotionReport = service.getPathfindingServiceReport();
    requireCondition(autoPromotionReport.shadowMatches === 1, 'Native Worker pilot did not match sync shadow semantics');
    requireCondition(autoPromotionReport.shadowMismatches === 0, 'Native Worker pilot mismatched sync shadow semantics');
    requireCondition(
      autoPromotionReport.mode === service.PATHFINDING_MODES.WORKER,
      'Production client did not automatically promote after clean shadow parity',
    );

    // Enqueue each epoch's parity cases in reverse order. The deterministic
    // service must sort same-epoch dispatches by requestedTick/actorId rather
    // than Map insertion order, and the Worker must preserve that order.
    let nextActorId = 100;
    const requestedTick = 100;
    const workItems = fixtures.flatMap(fixture => fixture.requests.map(query => {
      const request = makeRequest({
        actorId: nextActorId++,
        snapshot: fixture.snapshot,
        requestedTick,
        query,
      });
      return { fixture: fixture.name, snapshot: fixture.snapshot, query, request };
    }));
    const byteParity = [];
    const sentRouteIds = [];
    const receivedRouteIds = [];
    const expectedRouteIds = [];
    let batchedSyncKernelMs = null;
    let batchedWorkerRoundTripMs = null;
    for (const fixture of fixtures) {
      const fixtureItems = workItems.filter(item => item.fixture === fixture.name);
      for (const item of [...fixtureItems].reverse()) {
        service.enqueuePathfindingRequest(item.request, item.snapshot);
      }
      const syncStartedAt = performance.now();
      const syncResults = fixtureItems.map(item => canonicalKernelResult(kernel.findPathOnGrid(
        item.snapshot,
        item.query.sx,
        item.query.sy,
        item.query.ex,
        item.query.ey,
        item.query.maxExpanded,
      )));
      const fixtureSyncMs = performance.now() - syncStartedAt;
      const workerResponsesBefore = service.getPathfindingServiceReport().workerResponses;
      const sentRoutesBefore = window.__pathfindingWorkerProof.sent.filter(message => message.type === 'route').length;
      const receivedRoutesBefore = window.__pathfindingWorkerProof.received.filter(message => message.type === 'route-result').length;
      const expectedFixtureIds = [...fixtureItems]
        .sort((a, b) => (
          (a.request.requestedTick - b.request.requestedTick)
          || (a.request.actorId - b.request.actorId)
          || a.request.requestId.localeCompare(b.request.requestId)
        ))
        .map(item => item.request.requestId);
      const workerStartedAt = performance.now();
      const dispatchCount = client.pumpPathfindingWorkerClient();
      await waitUntil(`native Worker ${fixture.name} parity`, () => (
        service.getPathfindingServiceReport().workerResponses
          === workerResponsesBefore + fixtureItems.length
      ));
      const fixtureWorkerMs = performance.now() - workerStartedAt;
      const fixtureSentIds = window.__pathfindingWorkerProof.sent
        .filter(message => message.type === 'route')
        .slice(sentRoutesBefore)
        .map(message => message.requestId);
      const fixtureReceivedIds = window.__pathfindingWorkerProof.received
        .filter(message => message.type === 'route-result')
        .slice(receivedRoutesBefore)
        .map(message => message.requestId);
      requireCondition(
        JSON.stringify(fixtureSentIds) === JSON.stringify(expectedFixtureIds),
        `${fixture.name} production dispatch order was not deterministic`,
      );
      requireCondition(
        JSON.stringify(fixtureReceivedIds) === JSON.stringify(expectedFixtureIds),
        `${fixture.name} Worker response order diverged from request order`,
      );
      requireCondition(
        dispatchCount === fixtureItems.length + 1,
        `${fixture.name} dispatch count ${dispatchCount} omitted its grid or a route`,
      );
      sentRouteIds.push(...fixtureSentIds);
      receivedRouteIds.push(...fixtureReceivedIds);
      expectedRouteIds.push(...expectedFixtureIds);
      if (fixture.name === 'batched') {
        batchedSyncKernelMs = fixtureSyncMs;
        batchedWorkerRoundTripMs = fixtureWorkerMs;
      }

      for (let index = 0; index < fixtureItems.length; index++) {
        const item = fixtureItems[index];
        const pending = service.takePathfindingResult(item.request.requestId, {
          gameTick: item.request.readyTick - 1,
          obstacleEpoch: item.request.obstacleEpoch,
        });
        requireCondition(pending.status === 'pending', `${item.request.requestId} became ready early`);
        const ready = service.takePathfindingResult(item.request.requestId, {
          gameTick: item.request.readyTick,
          obstacleEpoch: item.request.obstacleEpoch,
        });
        requireCondition(ready.status === 'ready', `${item.request.requestId} missed its fixed ready tick`);
        const workerResult = canonicalServiceResult(ready);
        const syncResult = syncResults[index];
        const identical = bytesEqual(jsonBytes(syncResult), jsonBytes(workerResult));
        requireCondition(identical, `${item.fixture} ${item.request.requestId} was not byte-identical`);
        byteParity.push({
          fixture: item.fixture,
          requestId: item.request.requestId,
          pathLength: workerResult.path?.length ?? null,
          expandedNodes: workerResult.expandedNodes,
          digest: await sha256(workerResult),
          identical,
        });
      }
    }
    const nativeAuthorityReport = service.getPathfindingServiceReport();
    requireCondition(
      nativeAuthorityReport.workerAuthorities === workItems.length,
      'Verified native Worker did not author every parity result',
    );
    requireCondition(nativeAuthorityReport.syncFallbacks === 0, 'On-time native Worker batch used sync fallback');

    // Controlled service mode: inject a valid shadow result to promote without
    // transport, then prove that response reordering changes neither readyTick
    // nor bytes, a missing response falls back at exactly readyTick, and stale
    // obstacle epochs are rejected rather than applied.
    client.stopPathfindingWorkerClient();
    service.resetPathfindingService();
    service.beginPathfindingShadowMode();
    const controlledPilotSnapshot = makeGrid({ epoch: 30 });
    const controlledPilotQuery = { sx: 2, sy: 2, ex: 70, ey: 70, maxExpanded: 6400 };
    const controlledPilot = makeRequest({
      actorId: 300,
      snapshot: controlledPilotSnapshot,
      requestedTick: 300,
      query: controlledPilotQuery,
    });
    service.enqueuePathfindingRequest(controlledPilot, controlledPilotSnapshot);
    const controlledMessages = service.drainPathfindingWorkerMessages();
    const controlledGeneration = service.getPathfindingServiceReport().generation;
    const controlledPilotSync = kernel.findPathOnGrid(
      controlledPilotSnapshot,
      controlledPilotQuery.sx,
      controlledPilotQuery.sy,
      controlledPilotQuery.ex,
      controlledPilotQuery.ey,
      controlledPilotQuery.maxExpanded,
    );
    requireCondition(controlledMessages.length === 2, 'Controlled pilot did not emit grid + route');
    requireCondition(
      service.acceptPathfindingWorkerMessage(workerMessage(
        controlledGeneration,
        controlledPilot,
        controlledPilotSync,
      )),
      'Controlled shadow response was rejected',
    );
    requireCondition(service.promotePathfindingWorkerAuthority(), 'Controlled service failed promotion');
    service.takePathfindingResult(controlledPilot.requestId, {
      gameTick: controlledPilot.readyTick,
      obstacleEpoch: controlledPilot.obstacleEpoch,
    });

    const reorderedSnapshot = makeGrid({ epoch: 31 });
    const reorderedItems = [303, 301, 302].map((actorId, index) => {
      const query = {
        sx: 4 + index,
        sy: 6 + index,
        ex: 70 - index,
        ey: 68 - index,
        maxExpanded: 6400,
      };
      const request = makeRequest({ actorId, snapshot: reorderedSnapshot, requestedTick: 400, query });
      const syncResult = kernel.findPathOnGrid(
        reorderedSnapshot, query.sx, query.sy, query.ex, query.ey, query.maxExpanded,
      );
      service.enqueuePathfindingRequest(request, reorderedSnapshot);
      return { request, syncResult };
    });
    const controlledDispatch = service.drainPathfindingWorkerMessages();
    const controlledRouteIds = controlledDispatch
      .filter(message => message.type === 'route')
      .map(message => message.request.requestId);
    const controlledExpectedIds = [...reorderedItems]
      .sort((a, b) => a.request.actorId - b.request.actorId)
      .map(item => item.request.requestId);
    requireCondition(
      JSON.stringify(controlledRouteIds) === JSON.stringify(controlledExpectedIds),
      'Controlled dispatch did not sort same-tick actors deterministically',
    );
    for (const item of [...reorderedItems].reverse()) {
      requireCondition(service.acceptPathfindingWorkerMessage(workerMessage(
        controlledGeneration,
        item.request,
        item.syncResult,
      )), `Reordered response ${item.request.requestId} was rejected`);
    }
    const reorderedReady = reorderedItems.map(item => {
      const pending = service.takePathfindingResult(item.request.requestId, {
        gameTick: item.request.readyTick - 1,
        obstacleEpoch: item.request.obstacleEpoch,
      });
      const ready = service.takePathfindingResult(item.request.requestId, {
        gameTick: item.request.readyTick,
        obstacleEpoch: item.request.obstacleEpoch,
      });
      requireCondition(pending.status === 'pending', 'Reordered response became authoritative early');
      requireCondition(ready.status === 'ready', 'Reordered response missed fixed ready tick');
      requireCondition(
        bytesEqual(jsonBytes(canonicalKernelResult(item.syncResult)), jsonBytes(canonicalServiceResult(ready))),
        'Reordered response changed authoritative path bytes',
      );
      return { requestId: item.request.requestId, readyTick: ready.readyTick };
    });

    const lateSnapshot = makeGrid({ epoch: 32 });
    const lateQuery = { sx: 5, sy: 5, ex: 72, ey: 72, maxExpanded: 6400 };
    const lateRequest = makeRequest({
      actorId: 320,
      snapshot: lateSnapshot,
      requestedTick: 500,
      query: lateQuery,
    });
    const lateSync = kernel.findPathOnGrid(
      lateSnapshot, lateQuery.sx, lateQuery.sy, lateQuery.ex, lateQuery.ey, lateQuery.maxExpanded,
    );
    service.enqueuePathfindingRequest(lateRequest, lateSnapshot);
    service.drainPathfindingWorkerMessages();
    const latePending = service.takePathfindingResult(lateRequest.requestId, {
      gameTick: lateRequest.readyTick - 1,
      obstacleEpoch: lateRequest.obstacleEpoch,
    });
    const lateReady = service.takePathfindingResult(lateRequest.requestId, {
      gameTick: lateRequest.readyTick,
      obstacleEpoch: lateRequest.obstacleEpoch,
    });
    requireCondition(latePending.status === 'pending', 'Late response fallback became authoritative early');
    requireCondition(lateReady.status === 'ready', 'Late response did not fall back at fixed ready tick');
    requireCondition(
      bytesEqual(jsonBytes(canonicalKernelResult(lateSync)), jsonBytes(canonicalServiceResult(lateReady))),
      'Late Worker fallback changed authoritative path bytes',
    );
    const rejectedLateBefore = service.getPathfindingServiceReport().rejectedResponses;
    const lateAccepted = service.acceptPathfindingWorkerMessage(workerMessage(
      controlledGeneration,
      lateRequest,
      lateSync,
    ));
    requireCondition(lateAccepted === false, 'Late Worker response replaced deterministic fallback');
    requireCondition(
      service.getPathfindingServiceReport().rejectedResponses === rejectedLateBefore + 1,
      'Late Worker response did not increment rejection evidence',
    );

    const staleSnapshot = makeGrid({ epoch: 33 });
    const staleQuery = { sx: 6, sy: 6, ex: 60, ey: 60, maxExpanded: 6400 };
    const staleRequest = makeRequest({
      actorId: 330,
      snapshot: staleSnapshot,
      requestedTick: 600,
      query: staleQuery,
    });
    const staleSync = kernel.findPathOnGrid(
      staleSnapshot, staleQuery.sx, staleQuery.sy, staleQuery.ex, staleQuery.ey, staleQuery.maxExpanded,
    );
    service.enqueuePathfindingRequest(staleRequest, staleSnapshot);
    service.drainPathfindingWorkerMessages();
    const rejectedBefore = service.getPathfindingServiceReport().rejectedResponses;
    const staleAccepted = service.acceptPathfindingWorkerMessage(workerMessage(
      controlledGeneration,
      staleRequest,
      staleSync,
      { obstacleEpoch: staleRequest.obstacleEpoch + 1 },
    ));
    requireCondition(staleAccepted === false, 'Mismatched obstacle-epoch response was accepted');
    requireCondition(
      service.getPathfindingServiceReport().rejectedResponses === rejectedBefore + 1,
      'Mismatched obstacle-epoch response did not increment rejection evidence',
    );
    const staleResult = service.takePathfindingResult(staleRequest.requestId, {
      gameTick: staleRequest.readyTick,
      obstacleEpoch: staleRequest.obstacleEpoch + 1,
    });
    requireCondition(staleResult.status === 'stale', 'Superseded obstacle epoch did not reject queued route');
    const controlledReport = service.getPathfindingServiceReport();
    requireCondition(controlledReport.syncFallbacks === 1, 'Late controlled response did not use one sync fallback');

    // Worker-unavailable fallback uses the production client feature check and
    // remains unavailable through readyTick; authoritative bytes and timing
    // must match the same pure kernel.
    client.stopPathfindingWorkerClient();
    service.resetPathfindingService();
    const observedWorker = window.Worker;
    window.Worker = undefined;
    const unavailableStarted = client.startPathfindingWorkerClient();
    window.Worker = observedWorker;
    requireCondition(unavailableStarted === false, 'Production client claimed to start without Worker support');
    const unavailableSnapshot = makeGrid({ epoch: 40 });
    const unavailableQuery = { sx: 3, sy: 3, ex: 73, ey: 69, maxExpanded: 6400 };
    const unavailableRequest = makeRequest({
      actorId: 400,
      snapshot: unavailableSnapshot,
      requestedTick: 700,
      query: unavailableQuery,
    });
    const unavailableSync = kernel.findPathOnGrid(
      unavailableSnapshot,
      unavailableQuery.sx,
      unavailableQuery.sy,
      unavailableQuery.ex,
      unavailableQuery.ey,
      unavailableQuery.maxExpanded,
    );
    service.enqueuePathfindingRequest(unavailableRequest, unavailableSnapshot);
    const unavailablePending = service.takePathfindingResult(unavailableRequest.requestId, {
      gameTick: unavailableRequest.readyTick - 1,
      obstacleEpoch: unavailableRequest.obstacleEpoch,
    });
    const unavailableReady = service.takePathfindingResult(unavailableRequest.requestId, {
      gameTick: unavailableRequest.readyTick,
      obstacleEpoch: unavailableRequest.obstacleEpoch,
    });
    requireCondition(unavailablePending.status === 'pending', 'Unavailable Worker fallback became ready early');
    requireCondition(unavailableReady.status === 'ready', 'Unavailable Worker fallback missed fixed ready tick');
    requireCondition(
      bytesEqual(
        jsonBytes(canonicalKernelResult(unavailableSync)),
        jsonBytes(canonicalServiceResult(unavailableReady)),
      ),
      'Unavailable Worker fallback changed authoritative path bytes',
    );
    requireCondition(
      service.getPathfindingServiceReport().mode === service.PATHFINDING_MODES.SYNC,
      'Unavailable Worker fallback left synchronous service mode',
    );

    const workerProof = window.__pathfindingWorkerProof;
    const nativeConstructors = workerProof.constructors.filter(entry => (
      entry.url.includes('/js/pathfinding-worker.js?realm=193')
      && entry.type === 'module'
    ));
    requireCondition(nativeConstructors.length >= 1, 'Production client did not construct the revisioned native module Worker');

    return {
      fixtureNames: fixtures.map(fixture => fixture.name),
      browserSupportsWorker: typeof Worker === 'function',
      fixedReadyDelayTicks: service.PATHFINDING_READY_DELAY_TICKS,
      nativeWorker: {
        constructors: workerProof.constructors,
        sentCount: workerProof.sent.length,
        receivedCount: workerProof.received.length,
        routeRequestOrder: sentRouteIds,
        routeResponseOrder: receivedRouteIds,
        productionModuleWorkerLoaded: nativeConstructors.length >= 1,
      },
      byteParity,
      allParityBytesIdentical: byteParity.every(entry => entry.identical),
      autoPromotionReport,
      nativeAuthorityReport,
      deterministicTiming: {
        deterministicDispatchOrder: controlledRouteIds,
        expectedDispatchOrder: controlledExpectedIds,
        reorderedResponseIds: [...reorderedItems].reverse().map(item => item.request.requestId),
        reorderedReady,
        lateFallback: {
          requestId: lateRequest.requestId,
          pendingAt: lateRequest.readyTick - 1,
          readyAt: lateReady.readyTick,
          lateResponseAccepted: lateAccepted,
        },
        unavailableFallback: {
          requestId: unavailableRequest.requestId,
          pendingAt: unavailableRequest.readyTick - 1,
          readyAt: unavailableReady.readyTick,
        },
      },
      staleEpoch: {
        mismatchedResponseAccepted: staleAccepted,
        resultStatus: staleResult.status,
        rejectedResponses: controlledReport.rejectedResponses,
      },
      controlledReport,
      performance: {
        note: 'Informational wall-clock sample only; intentionally not a release speed gate.',
        fixture: 'batched',
        routeCount: fixtures.find(fixture => fixture.name === 'batched').requests.length,
        syncKernelMs: Number(batchedSyncKernelMs.toFixed(3)),
        workerRoundTripMs: Number(batchedWorkerRoundTripMs.toFixed(3)),
        syncRoutesPerSecond: Number((48 * 1000 / batchedSyncKernelMs).toFixed(1)),
        workerResponsesPerSecond: Number((48 * 1000 / batchedWorkerRoundTripMs).toFixed(1)),
      },
      byteHelperSelfCheck: bytesEqual(jsonBytes({ ok: true }), jsonBytes({ ok: true })),
    };
  });

  const report = {
    schema: 'realm.pathfinding-worker-browser.v1',
    runtimeRevision: runtimeContract.moduleRevision,
    generatedAt: new Date().toISOString(),
    passed: browserErrors.length === 0
      && result.allParityBytesIdentical
      && result.nativeWorker.productionModuleWorkerLoaded
      && result.nativeAuthorityReport.workerAuthorities === result.byteParity.length
      && result.nativeAuthorityReport.syncFallbacks === 0
      && result.staleEpoch.resultStatus === 'stale',
    browserErrors,
    result,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  assert.equal(result.browserSupportsWorker, true, 'Browser does not expose native Worker support');
  assert.equal(result.byteHelperSelfCheck, true, 'Byte comparison self-check failed');
  assert.equal(result.fixedReadyDelayTicks, 5, 'Worker ready-tick contract changed unexpectedly');
  assert.equal(result.nativeWorker.productionModuleWorkerLoaded, true, 'Native module Worker did not load');
  assert.equal(result.allParityBytesIdentical, true, 'Sync/Worker route bytes diverged');
  assert.equal(
    result.nativeAuthorityReport.workerAuthorities,
    result.byteParity.length,
    'Not every verified Worker result became authoritative',
  );
  assert.equal(result.nativeAuthorityReport.syncFallbacks, 0, 'On-time native Worker unexpectedly fell back');
  assert.equal(result.staleEpoch.mismatchedResponseAccepted, false, 'Stale obstacle response was accepted');
  assert.equal(result.staleEpoch.resultStatus, 'stale', 'Stale obstacle request was not rejected');
  assert.deepEqual(browserErrors, [], 'Pathfinding Worker browser emitted page/console errors');
  console.log(
    `[pathfinding-worker] fixtures=${result.fixtureNames.join(',')} parity=${result.byteParity.length}/${result.byteParity.length}`,
  );
  console.log(
    `[pathfinding-worker] workerAuthorities=${result.nativeAuthorityReport.workerAuthorities} `
      + `fallbacks=${result.controlledReport.syncFallbacks} stale=${result.staleEpoch.resultStatus}`,
  );
  console.log(
    `[pathfinding-worker] performance sync=${result.performance.syncKernelMs}ms `
      + `worker-roundtrip=${result.performance.workerRoundTripMs}ms (${result.performance.routeCount} routes; informational)`,
  );
  console.log(`[pathfinding-worker] report: ${reportPath}`);
} finally {
  await context.close();
  await browser.close();
  await server.stop();
}
