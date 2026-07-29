// Renderer-owned citizen continuity. This cache is presentation state only:
// it is never attached to simulation citizens, saved, or hashed.

const records = new Map();

function assertActorId(actorId) {
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw new TypeError('Citizen render cache keys must be positive safe actor IDs.');
  }
}

export function citizenRenderRecord(actorId) {
  assertActorId(actorId);
  let record = records.get(actorId);
  if (!record) {
    record = {
      laneX: 0,
      laneY: 0,
      dirKey: null,
      dirPending: null,
      dirPendingMs: 0,
      animationKey: null,
      animationStartedAt: null,
      trail: [],
    };
    records.set(actorId, record);
  }
  return record;
}

export function pruneCitizenRenderCache(liveActorIds) {
  const live = new Set(liveActorIds);
  for (const actorId of records.keys()) {
    if (!live.has(actorId)) records.delete(actorId);
  }
  return records.size;
}

export function resetCitizenRenderCache() {
  records.clear();
}

export function citizenRenderCacheSize() {
  return records.size;
}

export function inspectCitizenRenderCache() {
  return [...records.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([actorId, record]) => Object.freeze({
      actorId,
      laneX: record.laneX,
      laneY: record.laneY,
      dirKey: record.dirKey,
      dirPending: record.dirPending,
      dirPendingMs: record.dirPendingMs,
      animationKey: record.animationKey,
      animationStartedAt: record.animationStartedAt,
      trail: Object.freeze(record.trail.map(point => Object.freeze({ ...point }))),
    }));
}
