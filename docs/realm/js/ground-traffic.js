// Deterministic local capacity for peaceful ground actors. Core callers may
// move their own actors; shell callers pass only shell-owned movers so the
// presentation layer never mutates authoritative simulation entities.

import { G, MAP_H, MAP_W, TILE } from './state.js?realm=188';

export const GROUND_ACTOR_SPACE = 0.60;

function canOccupy(actor, x, y) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (rx < 0 || rx >= MAP_W || ry < 0 || ry >= MAP_H) return false;
  const tile = G.map[ry]?.[rx];
  if (tile === TILE.WATER || tile === TILE.MOUNTAIN || tile === undefined) return false;
  const building = G.buildingGrid[ry]?.[rx];
  if (!building || building.type === 'road') return true;
  return rx === Math.round(actor.x) && ry === Math.round(actor.y);
}

function uniqueActors(actors) {
  return [...new Set((actors || []).filter(actor => (
    actor && Number.isFinite(actor.x) && Number.isFinite(actor.y)
  )))];
}

export function resolveGroundTraffic({
  movers,
  blockers = movers,
  minimumSpace = GROUND_ACTOR_SPACE,
} = {}) {
  const movableActors = uniqueActors(movers);
  if (movableActors.length === 0) return;
  const movable = new Set(movableActors);
  const actors = uniqueActors([...(blockers || []), ...movableActors]);
  const actorIndex = new Map(actors.map((actor, index) => [actor, index]));
  const minimumSpace2 = minimumSpace * minimumSpace;
  const bucketSize = minimumSpace;
  const bucketStride = Math.ceil(MAP_W / bucketSize) + 4;

  for (let pass = 0; pass < 3; pass++) {
    const buckets = new Map();
    for (let index = 0; index < actors.length; index++) {
      const actor = actors[index];
      const key = Math.floor(actor.y / bucketSize) * bucketStride
        + Math.floor(actor.x / bucketSize);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }

    for (const a of movableActors) {
      const first = actorIndex.get(a);
      const cellX = Math.floor(a.x / bucketSize);
      const cellY = Math.floor(a.y / bucketSize);
      for (let y = cellY - 1; y <= cellY + 1; y++) {
        for (let x = cellX - 1; x <= cellX + 1; x++) {
          for (const second of buckets.get(y * bucketStride + x) || []) {
            const b = actors[second];
            if (b === a || (movable.has(b) && second <= first)) continue;
            const canMoveA = true;
            const canMoveB = movable.has(b);

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distance2 = dx * dx + dy * dy;
            if (distance2 >= minimumSpace2) continue;

            let axisX;
            let axisY;
            let distance;
            if (distance2 < 0.000001) {
              const angle = ((first * 73 + second * 151 + pass * 97) % 360) * Math.PI / 180;
              axisX = Math.cos(angle);
              axisY = Math.sin(angle);
              distance = 0;
            } else {
              distance = Math.sqrt(distance2);
              axisX = dx / distance;
              axisY = dy / distance;
            }
            const totalPush = minimumSpace - distance + 0.0001;
            const aShare = canMoveB ? totalPush * 0.5 : totalPush;
            const bShare = canMoveA && canMoveB ? totalPush * 0.5 : canMoveB ? totalPush : 0;
            const nextAX = a.x + axisX * aShare;
            const nextAY = a.y + axisY * aShare;
            const nextBX = b.x - axisX * bShare;
            const nextBY = b.y - axisY * bShare;
            if (aShare > 0 && canOccupy(a, nextAX, nextAY)) { a.x = nextAX; a.y = nextAY; }
            if (bShare > 0 && canOccupy(b, nextBX, nextBY)) { b.x = nextBX; b.y = nextBY; }
          }
        }
      }
    }
  }
}
