// Deterministic citizen collision, local steering, and traffic progress.
//
// This module owns one-tick reservations only. Durable route/activity intent
// remains in existing citizen save fields and citizen-navigation.js.

import { G, MAP_H, MAP_W, TILE, getSeasonData } from './state.js?realm=197';
import { isWalkable } from './pathfinding.js?realm=197';
import { getCitizenSpeedMult } from './events.js?realm=197';
import { citizenIsIndoors } from './residences.js?realm=197';

const PREFERRED_SPACE = 0.55;
const HARD_ACTOR_SPACE = 0.31;
const TRAFFIC_BUCKET_SIZE = 1.2;
const TRAFFIC_BUCKET_STRIDE = Math.ceil(MAP_W / TRAFFIC_BUCKET_SIZE) + 4;

let trafficBucketsTick = -1;
let trafficBucketsCitizens = null;
let trafficBucketsCount = -1;
let trafficBuckets = new Map();
let trafficReservationsTick = -1;
let trafficReservations = [];

export function citizenTileIsWalkable(x, y) {
  return isWalkable(Math.round(x), Math.round(y));
}

export function citizenTerrainIsWalkable(x, y) {
  const mx = Math.round(x);
  const my = Math.round(y);
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return false;
  const tile = G.map[my]?.[mx];
  return tile !== undefined && tile !== TILE.WATER && tile !== TILE.MOUNTAIN;
}

export function citizenStandsOnBlockedTile(citizen) {
  const mx = Math.round(citizen.x);
  const my = Math.round(citizen.y);
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return false;
  const tile = G.map[my]?.[mx];
  const building = G.buildingGrid[my]?.[mx];
  return tile !== TILE.WATER
    && tile !== TILE.MOUNTAIN
    && !!building
    && building.type !== 'road';
}

export function canCitizenStep(citizen, nx, ny) {
  const rx = Math.round(nx);
  const ry = Math.round(ny);
  const cx = Math.round(citizen.x);
  const cy = Math.round(citizen.y);
  if (citizenTileIsWalkable(nx, ny)) {
    if (
      rx !== cx
      && ry !== cy
      && (!citizenTileIsWalkable(rx, cy) || !citizenTileIsWalkable(cx, ry))
    ) return false;
    return true;
  }
  // A citizen covered by a newly placed building may shuffle inside the
  // current tile toward an exit, but may never enter another blocked tile.
  return citizenStandsOnBlockedTile(citizen)
    && rx === cx
    && ry === cy
    && citizenTerrainIsWalkable(nx, ny);
}

export function citizenIsActivelyMoving(citizen) {
  return !!citizen.path && citizen.pathIdx < citizen.path.length;
}

export function activeCitizenMovementDirection(citizen) {
  if (!citizenIsActivelyMoving(citizen)) return null;
  const target = citizen.path[citizen.pathIdx];
  const dx = target.x - citizen.x;
  const dy = target.y - citizen.y;
  const length = Math.hypot(dx, dy);
  return length > 0.0001 ? { x: dx / length, y: dy / length } : null;
}

export function citizenTravelSpeed(citizen) {
  let speed = citizen.speed * getSeasonData().speedMult * getCitizenSpeedMult();
  const gx = Math.round(citizen.x);
  const gy = Math.round(citizen.y);
  if (G.buildingGrid[gy]?.[gx]?.type === 'road') speed *= 2;
  if (citizen.hunger > 60) speed *= 1 - Math.min(0.4, (citizen.hunger - 60) / 100);
  if ((citizen.rest ?? 100) < 30) speed *= 0.75 + ((citizen.rest ?? 100) / 30) * 0.25;
  if (citizen._fleeing) speed *= 1.35;
  return speed;
}

function currentTrafficBuckets() {
  if (
    trafficBucketsTick === G.gameTick
    && trafficBucketsCitizens === G.citizens
    && trafficBucketsCount === G.citizens.length
  ) return trafficBuckets;

  trafficBucketsTick = G.gameTick;
  trafficBucketsCitizens = G.citizens;
  trafficBucketsCount = G.citizens.length;
  trafficBuckets = new Map();
  for (const citizen of G.citizens) {
    if (citizenIsIndoors(citizen)) continue;
    const cellX = Math.floor(citizen.x / TRAFFIC_BUCKET_SIZE);
    const cellY = Math.floor(citizen.y / TRAFFIC_BUCKET_SIZE);
    const key = cellY * TRAFFIC_BUCKET_STRIDE + cellX;
    const bucket = trafficBuckets.get(key);
    if (bucket) bucket.push(citizen);
    else trafficBuckets.set(key, [citizen]);
  }
  return trafficBuckets;
}

function trafficUrgency(citizen) {
  if (citizen.activity.kind === 'seek_shelter' || citizen.activity.kind === 'flee') return 6;
  if (citizen.carrying && citizen.carryAmount > 0) return 5;
  if (citizen.assignment?.reason === 'player-command') return 4;
  if (citizen.activity.kind === 'walk_to_eat') return 3;
  if (citizen.activity.kind === 'walk_to_work') return 2;
  return 1;
}

function trafficPriorityWins(first, second) {
  const urgencyDelta = trafficUrgency(first) - trafficUrgency(second);
  if (urgencyDelta !== 0) return urgencyDelta > 0;
  const firstWait = Math.floor((first._stuckTicks || 0) / 4);
  const secondWait = Math.floor((second._stuckTicks || 0) / 4);
  if (firstWait !== secondWait) return firstWait > secondWait;
  const span = Math.max(1, G.citizens.length);
  const epoch = Math.floor(G.gameTick / 24);
  const firstRank = ((first.actorId || 0) + epoch) % span;
  const secondRank = ((second.actorId || 0) + epoch) % span;
  if (firstRank !== secondRank) return firstRank < secondRank;
  return (first.actorId || 0) < (second.actorId || 0);
}

function projectedCitizenStep(citizen) {
  const direction = activeCitizenMovementDirection(citizen);
  if (!direction) return { x: citizen.x, y: citizen.y };
  const target = citizen.path[citizen.pathIdx];
  const distance = Math.hypot(target.x - citizen.x, target.y - citizen.y);
  const step = Math.min(citizenTravelSpeed(citizen), distance);
  return {
    x: citizen.x + direction.x * step,
    y: citizen.y + direction.y * step,
  };
}

function trafficConflict(citizen, nx, ny) {
  const direction = activeCitizenMovementDirection(citizen);
  if (!direction) return null;
  const buckets = currentTrafficBuckets();
  const cellX = Math.floor(citizen.x / TRAFFIC_BUCKET_SIZE);
  const cellY = Math.floor(citizen.y / TRAFFIC_BUCKET_SIZE);
  for (let y = cellY - 1; y <= cellY + 1; y++) {
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      for (const other of buckets.get(y * TRAFFIC_BUCKET_STRIDE + x) || []) {
        if (other === citizen) continue;
        const currentDistance = Math.hypot(citizen.x - other.x, citizen.y - other.y);
        if (currentDistance >= TRAFFIC_BUCKET_SIZE + 0.15) continue;
        const accepted = trafficReservationsTick === G.gameTick
          ? trafficReservations.find(reservation => reservation.citizen === other)
          : null;
        const hasRightOfWay = !accepted && trafficPriorityWins(citizen, other);
        const otherNext = accepted
          ? accepted
          : hasRightOfWay
            ? other
            : projectedCitizenStep(other);
        const nextDistance = Math.hypot(nx - otherNext.x, ny - otherNext.y);
        if (nextDistance >= PREFERRED_SPACE) continue;
        if (nextDistance >= currentDistance - 0.002 && nextDistance >= HARD_ACTOR_SPACE) continue;
        if (nextDistance < HARD_ACTOR_SPACE) {
          if (hasRightOfWay) continue;
          return {
            yield: !accepted && !!activeCitizenMovementDirection(other),
            other,
          };
        }
      }
    }
  }

  if (trafficReservationsTick !== G.gameTick) {
    trafficReservationsTick = G.gameTick;
    trafficReservations = [];
  }
  for (const reservation of trafficReservations) {
    if (reservation.citizen === citizen) continue;
    if (Math.hypot(nx - reservation.x, ny - reservation.y) < HARD_ACTOR_SPACE) {
      return { yield: false, other: reservation.citizen };
    }
  }
  return null;
}

function reserveCitizenStep(citizen, x, y) {
  if (trafficReservationsTick !== G.gameTick) {
    trafficReservationsTick = G.gameTick;
    trafficReservations = [];
  }
  trafficReservations.push({ citizen, x, y });
}

function opposingTrafficNearby(citizen, direction) {
  return G.citizens.some(other => {
    if (other === citizen || citizenIsIndoors(other)) return false;
    if (Math.hypot(citizen.x - other.x, citizen.y - other.y) > 2.2) return false;
    const otherDirection = activeCitizenMovementDirection(other);
    return !!otherDirection
      && direction.x * otherDirection.x + direction.y * otherDirection.y < -0.4;
  });
}

function opposingLaneIntent(citizen, nx, ny) {
  const direction = activeCitizenMovementDirection(citizen);
  if (!direction || !opposingTrafficNearby(citizen, direction)) return null;
  const waypoint = citizen.path?.[citizen.pathIdx];
  if (!waypoint) return null;
  const horizontal = Math.abs(direction.x) >= Math.abs(direction.y);
  const laneTarget = horizontal
    ? { x: waypoint.x, y: waypoint.y + (Math.sign(direction.x) || 1) * 0.21 }
    : { x: waypoint.x - (Math.sign(direction.y) || 1) * 0.21, y: waypoint.y };
  const dx = laneTarget.x - citizen.x;
  const dy = laneTarget.y - citizen.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.0001) return null;
  const step = Math.min(Math.hypot(nx - citizen.x, ny - citizen.y), distance);
  const x = citizen.x + dx / distance * step;
  const y = citizen.y + dy / distance * step;
  if (!canCitizenStep(citizen, x, y) || trafficConflict(citizen, x, y)) return null;
  reserveCitizenStep(citizen, x, y);
  return { x, y, trafficWait: false, lane: true };
}

export function resolveCitizenStep(citizen, nx, ny) {
  const laneIntent = opposingLaneIntent(citizen, nx, ny);
  if (laneIntent) return laneIntent;
  const canStepDirectly = canCitizenStep(citizen, nx, ny);
  const directConflict = canStepDirectly ? trafficConflict(citizen, nx, ny) : null;
  if (canStepDirectly && !directConflict) {
    reserveCitizenStep(citizen, nx, ny);
    return { x: nx, y: ny, trafficWait: false };
  }
  if (directConflict?.yield) return null;
  const dx = nx - citizen.x;
  const dy = ny - citizen.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.0001) return null;
  const forwardX = dx / length;
  const forwardY = dy / length;
  const lateral = Math.abs(forwardX) >= Math.abs(forwardY)
    ? { x: 0, y: Math.sign(forwardX) || 1 }
    : { x: -Math.sign(forwardY) || -1, y: 0 };
  const waypoint = citizen.path?.[citizen.pathIdx] || { x: nx, y: ny };
  const candidates = [
    { forward: 0, side: 1 },
    { forward: 0.6, side: 0.8 },
    { forward: 0, side: -1 },
    { forward: 0.6, side: -0.8 },
  ].map((candidate, order) => {
    const x = citizen.x + (forwardX * candidate.forward + lateral.x * candidate.side) * length;
    const y = citizen.y + (forwardY * candidate.forward + lateral.y * candidate.side) * length;
    return {
      x,
      y,
      order,
      goalDistance: Math.hypot(waypoint.x - x, waypoint.y - y),
    };
  }).sort((first, second) => first.goalDistance - second.goalDistance || first.order - second.order);
  for (const candidate of candidates) {
    if (
      !canCitizenStep(citizen, candidate.x, candidate.y)
      || trafficConflict(citizen, candidate.x, candidate.y)
    ) continue;
    reserveCitizenStep(citizen, candidate.x, candidate.y);
    return { x: candidate.x, y: candidate.y, trafficWait: true };
  }
  return null;
}

export function noteCitizenTrafficWait(citizen) {
  citizen._stuckTicks = Math.min(600, (citizen._stuckTicks || 0) + 1);
  citizen._wdTicks = 0;
  citizen._wdBest = Math.hypot(
    (citizen._requestedTx ?? citizen.tx ?? citizen.x) - citizen.x,
    (citizen._requestedTy ?? citizen.ty ?? citizen.y) - citizen.y,
  );
}

function separationAxis(first, second, dx, dy, distanceSquared, pass) {
  if (distanceSquared >= 0.0004) {
    const distance = Math.sqrt(distanceSquared);
    return { x: dx / distance, y: dy / distance };
  }
  const angle = (
    ((first.actorId || 0) * 37 + (second.actorId || 0) * 53 + pass * 97) % 360
  ) * Math.PI / 180;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function applyCitizenSeparation() {
  const citizens = G.citizens;
  const radiusSquared = HARD_ACTOR_SPACE * HARD_ACTOR_SPACE;
  const bucketSize = 1;
  const bucketStride = MAP_W + 8;
  for (let pass = 0; pass < 8; pass++) {
    const buckets = new Map();
    for (let index = 0; index < citizens.length; index++) {
      const citizen = citizens[index];
      if (citizenIsIndoors(citizen)) continue;
      const key = Math.floor(citizen.y / bucketSize) * bucketStride
        + Math.floor(citizen.x / bucketSize);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }

    for (let firstIndex = 0; firstIndex < citizens.length; firstIndex++) {
      const first = citizens[firstIndex];
      if (citizenIsIndoors(first)) continue;
      const cellX = Math.floor(first.x / bucketSize);
      const cellY = Math.floor(first.y / bucketSize);
      for (let by = cellY - 2; by <= cellY + 2; by++) {
        for (let bx = cellX - 2; bx <= cellX + 2; bx++) {
          for (const secondIndex of buckets.get(by * bucketStride + bx) || []) {
            if (secondIndex <= firstIndex) continue;
            const second = citizens[secondIndex];
            if (citizenIsIndoors(second)) continue;
            const dx = first.x - second.x;
            const dy = first.y - second.y;
            const distanceSquared = dx * dx + dy * dy;
            const axis = separationAxis(first, second, dx, dy, distanceSquared, pass);
            if (distanceSquared >= radiusSquared) continue;
            const totalPush = HARD_ACTOR_SPACE - Math.sqrt(distanceSquared) + 0.0001;
            const halfPush = totalPush * 0.5;
            const nextFirst = {
              x: first.x + axis.x * halfPush,
              y: first.y + axis.y * halfPush,
            };
            const nextSecond = {
              x: second.x - axis.x * halfPush,
              y: second.y - axis.y * halfPush,
            };
            const canMoveFirst = canCitizenStep(first, nextFirst.x, nextFirst.y);
            const canMoveSecond = canCitizenStep(second, nextSecond.x, nextSecond.y);
            if (canMoveFirst && canMoveSecond) {
              first.x = nextFirst.x;
              first.y = nextFirst.y;
              second.x = nextSecond.x;
              second.y = nextSecond.y;
            } else if (canMoveFirst) {
              const fullX = first.x + axis.x * totalPush;
              const fullY = first.y + axis.y * totalPush;
              if (canCitizenStep(first, fullX, fullY)) {
                first.x = fullX;
                first.y = fullY;
              }
            } else if (canMoveSecond) {
              const fullX = second.x - axis.x * totalPush;
              const fullY = second.y - axis.y * totalPush;
              if (canCitizenStep(second, fullX, fullY)) {
                second.x = fullX;
                second.y = fullY;
              }
            }
          }
        }
      }
    }
  }
}

export function captureCitizenTrafficProgress() {
  const progress = new Map();
  for (const citizen of G.citizens) {
    if (!citizenIsActivelyMoving(citizen)) continue;
    const gx = citizen._requestedTx ?? citizen.tx ?? citizen.x;
    const gy = citizen._requestedTy ?? citizen.ty ?? citizen.y;
    progress.set(citizen, {
      distance: Math.hypot(gx - citizen.x, gy - citizen.y),
      wait: citizen._stuckTicks || 0,
    });
  }
  return progress;
}

export function finishCitizenTrafficProgress(progress) {
  for (const [citizen, start] of progress) {
    if (!G.citizens.includes(citizen) || !citizenIsActivelyMoving(citizen)) continue;
    const gx = citizen._requestedTx ?? citizen.tx ?? citizen.x;
    const gy = citizen._requestedTy ?? citizen.ty ?? citizen.y;
    const distance = Math.hypot(gx - citizen.x, gy - citizen.y);
    citizen._stuckTicks = distance < start.distance - 0.005
      ? 0
      : Math.min(600, start.wait + 1);
  }
}
