// Renderer-owned citizen continuity. This cache is presentation state only:
// it is never attached to simulation citizens, saved, or hashed.

const records = new Map();
const STRIDE_TILES = 1.12;
const STOP_HOLD_TICKS = 6;

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
      dirKey: null,
      dirPending: null,
      dirPendingMs: 0,
      animationKey: null,
      animationStartedAt: null,
      motion: null,
      trail: [],
    };
    records.set(actorId, record);
  }
  return record;
}

// Sample world displacement at the same interpolated position that is drawn.
// Route intent and _movedAt cannot prove movement: separation can cancel an
// accepted step before the final citizen position reaches the renderer.
export function sampleCitizenMotion(citizen, position, tick) {
  return sampleActorMotion(citizenRenderRecord(citizen.actorId), citizen, position, tick);
}

// The Founder can temporarily use citizen art while his images decode. Its
// continuity lives in the renderer's WeakMap, outside the citizen ID cache.
export function sampleActorMotion(record, citizen, position, tick) {
  let motion = record.motion;
  const elapsed = motion ? tick - motion.tick : 0;
  const distance = motion ? Math.hypot(position.x - motion.x, position.y - motion.y) : 0;
  if (!motion || elapsed < 0 || elapsed > 30 || distance > 1.5 || (elapsed === 0 && distance > .00001)) {
    const previousDistance = Number.isFinite(citizen.previousX) && Number.isFinite(citizen.previousY)
      ? Math.hypot(citizen.x - citizen.previousX, citizen.y - citizen.previousY) : 0;
    const arrivingInMotion = previousDistance > .00001 && previousDistance < 1.5;
    motion = record.motion = {
      x: position.x, y: position.y, tick, phase: 0,
      lastMovedAt: arrivingInMotion ? tick : null,
      moving: arrivingInMotion, deltaTicks: 0, distance: 0,
    };
    return motion;
  }
  if (elapsed > 0 && distance > .00001) {
    motion.phase = (motion.phase + distance / STRIDE_TILES) % 1;
    motion.lastMovedAt = tick;
  }
  const moving = motion.lastMovedAt !== null && tick - motion.lastMovedAt < STOP_HOLD_TICKS;
  if (!moving && motion.moving) {
    // A brief path gap holds its pose. A longer wait settles once onto the
    // nearest authored contact; it cannot keep cycling while standing still.
    motion.phase = (Math.round(motion.phase * 2) / 2) % 1;
  }
  motion.x = position.x; motion.y = position.y; motion.tick = tick;
  motion.moving = moving; motion.deltaTicks = elapsed; motion.distance = distance;
  return motion;
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
      dirKey: record.dirKey,
      dirPending: record.dirPending,
      dirPendingMs: record.dirPendingMs,
      animationKey: record.animationKey,
      animationStartedAt: record.animationStartedAt,
      builder: record.builder ? Object.freeze({ ...record.builder,
        drawn: record.builder.drawn ? Object.freeze({ ...record.builder.drawn }) : null }) : null,
      motion: record.motion ? Object.freeze({ ...record.motion }) : null,
      trail: Object.freeze(record.trail.map(point => Object.freeze({ ...point }))),
    }));
}
