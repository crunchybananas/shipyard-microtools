// Citizen workplace target selection and stable work-facing lifecycle.
//
// This module deliberately owns no assignment policy. Callers choose and own
// the workplace; these helpers only turn that authoritative assignment into a
// deterministic physical destination.

import { BUILDINGS, G, MAP_H, MAP_W, TILE } from './state.js?realm=193';
import { isWalkable } from './pathfinding.js?realm=193';
import { isWorkforceConstructionSite } from './workforce-policy.js?realm=193';
import {
  assignedCitizenBuilding,
  citizenStableHash,
  setCitizenActivity,
} from './citizen-activity.js?realm=193';
import {
  chooseCitizenCrowdAwareTarget,
  citizenManhattanDistance,
  citizenTargetCrowdPenalty,
  clearCitizenPath,
  pathCitizenTo,
} from './citizen-navigation.js?realm=193';
import { citizenTerrainIsWalkable } from './citizen-traffic.js?realm=193';

function nearestBuilding(citizen, typeOrNull) {
  let best = null;
  let bestDistance = Infinity;
  for (const building of G.buildings) {
    if (typeOrNull && building.type !== typeOrNull) continue;
    const distance = citizenManhattanDistance(citizen.x, citizen.y, building.x, building.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = building;
    }
  }
  return best;
}

function resourceWorkTarget(citizen, building, tileType, radius = 7) {
  const bx = Math.round(building.x);
  const by = Math.round(building.y);
  let best = null;
  let bestScore = Infinity;
  for (let y = by - radius; y <= by + radius; y++) {
    for (let x = bx - radius; x <= bx + radius; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (G.map[y]?.[x] !== tileType) continue;
      if (G.buildingGrid[y]?.[x] && G.buildingGrid[y][x].type !== 'road') continue;
      if (!citizenTerrainIsWalkable(x, y) || !isWalkable(x, y)) continue;
      const fromBuilding = citizenManhattanDistance(x, y, bx, by);
      if (fromBuilding > radius) continue;
      const fromCitizen = citizenManhattanDistance(citizen.x, citizen.y, x, y);
      const crowd = citizenTargetCrowdPenalty(citizen, x, y);
      const jitter = ((citizenStableHash(citizen) ^ (x * 374761393) ^ (y * 668265263)) >>> 0)
        / 0xffffffff * 0.2;
      const score = fromBuilding * 2.2 + fromCitizen * 0.16 + crowd * 3.5 + jitter;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y, resource: tileType };
      }
    }
  }
  return best;
}

function buildingEdgeWorkTarget(citizen, building, radius = 2) {
  const bx = Math.round(building.x);
  const by = Math.round(building.y);
  let best = null;
  let bestScore = Infinity;
  for (let y = by - radius; y <= by + radius; y++) {
    for (let x = bx - radius; x <= bx + radius; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (!isWalkable(x, y)) continue;
      const ring = citizenManhattanDistance(x, y, bx, by);
      if (ring < 1 || ring > radius) continue;
      const crowd = citizenTargetCrowdPenalty(citizen, x, y);
      const roadBonus = G.buildingGrid[y]?.[x]?.type === 'road' ? -0.45 : 0;
      const jitter = ((citizenStableHash(citizen) ^ (x * 83492791) ^ (y * 2654435761)) >>> 0)
        / 0xffffffff * 0.18;
      const score = ring * 1.7
        + citizenManhattanDistance(citizen.x, citizen.y, x, y) * 0.16
        + crowd * 3.8
        + roadBonus
        + jitter;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

export function citizenWorkTargetForBuilding(citizen, building) {
  if (!building) return { x: citizen.x, y: citizen.y };
  if (isWorkforceConstructionSite(building)) {
    return buildingEdgeWorkTarget(citizen, building, 2) || { x: building.x, y: building.y };
  }
  if (building.type === 'lumber') {
    return resourceWorkTarget(citizen, building, TILE.FOREST, 7)
      || buildingEdgeWorkTarget(citizen, building, 3)
      || { x: building.x, y: building.y };
  }
  if (building.type === 'quarry') {
    return resourceWorkTarget(citizen, building, TILE.STONE, 5)
      || buildingEdgeWorkTarget(citizen, building, 2)
      || { x: building.x, y: building.y };
  }
  if (building.type === 'mine') {
    return resourceWorkTarget(citizen, building, TILE.IRON, 5)
      || buildingEdgeWorkTarget(citizen, building, 2)
      || { x: building.x, y: building.y };
  }
  const definition = BUILDINGS[building.type];
  if (definition?.workers || definition?.prod) {
    return buildingEdgeWorkTarget(citizen, building, 2) || { x: building.x, y: building.y };
  }
  return { x: building.x, y: building.y };
}

export function pathCitizenToWork(citizen) {
  const target = citizenWorkTargetForBuilding(citizen, assignedCitizenBuilding(citizen));
  citizen.workTarget = target;
  return pathCitizenTo(citizen, target.x, target.y);
}

function settlementAnchor(citizen) {
  return nearestBuilding(citizen, 'house')
    || nearestBuilding(citizen, 'storehouse')
    || nearestBuilding(citizen, 'granary')
    || nearestBuilding(citizen, null)
    || { x: Math.round(MAP_W / 2), y: Math.round(MAP_H / 2) };
}

export function citizenIdleLoiterTarget(citizen) {
  const anchor = settlementAnchor(citizen);
  const ax = Math.round(anchor.x);
  const ay = Math.round(anchor.y);
  let best = null;
  let bestScore = Infinity;
  for (let y = ay - 5; y <= ay + 5; y++) {
    for (let x = ax - 5; x <= ax + 5; x++) {
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (!isWalkable(x, y)) continue;
      const ring = citizenManhattanDistance(x, y, ax, ay);
      if (ring < 1 || ring > 5) continue;
      const fromHere = citizenManhattanDistance(citizen.x, citizen.y, x, y);
      const crowd = citizenTargetCrowdPenalty(citizen, x, y);
      const roadBonus = G.buildingGrid[y]?.[x]?.type === 'road' ? -1.0 : 0;
      const doorstep = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
        ([dx, dy]) => G.buildingGrid[y + dy]?.[x + dx]?.type === 'house',
      ) ? -0.6 : 0;
      const jitter = ((citizenStableHash(citizen) ^ (x * 92837111) ^ (y * 689287499)) >>> 0)
        / 0xffffffff * 0.22;
      const score = Math.abs(ring - 3) * 1.6
        + fromHere * 0.18
        + crowd * 4
        + roadBonus
        + doorstep
        + jitter;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best || chooseCitizenCrowdAwareTarget(citizen, ax, ay);
}

export function startCitizenWorking(citizen, activityTimer) {
  citizen._workFaceX = citizen.faceX || 0;
  citizen._workFaceZ = citizen.faceZ || 0;
  setCitizenActivity(citizen, 'working', { timer: activityTimer });
  clearCitizenPath(citizen);
}
