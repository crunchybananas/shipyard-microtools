// Browser-shell transport for the core-safe routing service. Importing this
// module is harmless in Node; a native module Worker is created only when the
// shell explicitly starts the client and the platform provides Worker.

import {
  acceptPathfindingWorkerMessage,
  beginPathfindingShadowMode,
  drainPathfindingWorkerMessages,
  promotePathfindingWorkerAuthority,
  resetPathfindingService,
  useSynchronousPathfindingService,
} from './pathfinding-service.js?realm=196';

let worker = null;

export function startPathfindingWorkerClient() {
  if (worker) return true;
  if (typeof Worker !== 'function') return false;
  worker = new Worker(new URL('./pathfinding-worker.js?realm=196', import.meta.url), { type: 'module', name: 'realm-pathfinding' });
  worker.addEventListener('message', event => {
    if (acceptPathfindingWorkerMessage(event.data)) {
      // The core service permits promotion only after at least one exact
      // main/Worker comparison and vetoes it after any mismatch.
      promotePathfindingWorkerAuthority();
    }
  });
  worker.addEventListener('error', () => {
    // The deterministic service remains usable: every due request falls back
    // to the main-thread kernel at its fixed ready tick.
    stopPathfindingWorkerClient();
  });
  beginPathfindingShadowMode();
  return true;
}

export function pumpPathfindingWorkerClient() {
  if (!worker) return 0;
  const messages = drainPathfindingWorkerMessages();
  for (const message of messages) worker.postMessage(message);
  return messages.length;
}

export function stopPathfindingWorkerClient() {
  if (worker) worker.terminate();
  worker = null;
  useSynchronousPathfindingService();
}

export function resetPathfindingWorkerClient() {
  const restart = !!worker;
  stopPathfindingWorkerClient();
  resetPathfindingService();
  return restart ? startPathfindingWorkerClient() : false;
}

export function pathfindingWorkerClientActive() {
  return !!worker;
}
