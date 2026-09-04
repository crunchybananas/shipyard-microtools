// Native module Worker entry. It owns only cloned grid snapshots and delegates
// all route semantics to the same pure kernel used on the main thread.

import { findPathOnGrid } from './pathfinding-kernel.js?realm=198';

let activeGeneration = 0;
let grids = new Map();

function postError(message, reason) {
  globalThis.postMessage({
    type: 'route-error',
    generation: message.generation,
    requestId: message.request?.requestId ?? null,
    obstacleEpoch: message.request?.obstacleEpoch ?? message.obstacleEpoch ?? null,
    reason,
  });
}

globalThis.addEventListener('message', event => {
  const message = event.data;
  if (!message || !Number.isSafeInteger(message.generation)) return;
  if (message.generation < activeGeneration) return;
  if (message.generation > activeGeneration) {
    activeGeneration = message.generation;
    grids = new Map();
  }

  if (message.type === 'grid') {
    if (message.snapshot?.obstacleEpoch !== message.obstacleEpoch) {
      postError(message, 'grid-epoch-mismatch');
      return;
    }
    for (const epoch of grids.keys()) {
      if (epoch < message.obstacleEpoch) grids.delete(epoch);
    }
    grids.set(message.obstacleEpoch, message.snapshot);
    return;
  }
  if (message.type !== 'route') return;
  const request = message.request;
  const snapshot = grids.get(request?.obstacleEpoch);
  if (!snapshot) {
    postError(message, 'grid-missing');
    return;
  }
  try {
    const result = findPathOnGrid(
      snapshot,
      request.sx,
      request.sy,
      request.ex,
      request.ey,
      request.maxExpanded,
    );
    globalThis.postMessage({
      type: 'route-result',
      generation: message.generation,
      requestId: request.requestId,
      obstacleEpoch: request.obstacleEpoch,
      result,
    });
  } catch (error) {
    postError(message, error instanceof Error ? error.message : 'route-failed');
  }
});
