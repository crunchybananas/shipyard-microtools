// Deterministic residence policy. Houses do not own mutable resident arrays;
// a citizen's existing `home` reference remains authoritative and occupancy is
// derived from the live citizen collection.

import { G, HOUSE_TIERS } from './state.js?realm=193';
import { nearestWalkableTile } from './pathfinding.js?realm=193';

export function houseResidentCapacity(house) {
  if (!house || house.type !== 'house') return 0;
  const level = Math.max(1, Math.min(HOUSE_TIERS.length, Math.trunc(house.level || 1)));
  return HOUSE_TIERS[level - 1].cap;
}

export function isCompletedHouse(house, buildings = G.buildings) {
  return !!house
    && house.type === 'house'
    && house.buildProgress >= 1
    && buildings.includes(house);
}

export function residentsForHouse(house, citizens = G.citizens) {
  if (!house || house.type !== 'house') return Object.freeze([]);
  return Object.freeze(
    citizens
      .filter(citizen => citizen.home === house)
      .sort((a, b) => a.actorId - b.actorId),
  );
}

export function citizenHasValidResidence(citizen, {
  buildings = G.buildings,
  citizens = G.citizens,
} = {}) {
  const home = citizen?.home;
  if (!isCompletedHouse(home, buildings)) return false;
  const residents = residentsForHouse(home, citizens);
  const index = residents.indexOf(citizen);
  return index >= 0 && index < houseResidentCapacity(home);
}

export function assignCitizenResidence(citizen, {
  buildings = G.buildings,
  citizens = G.citizens,
} = {}) {
  if (citizenHasValidResidence(citizen, { buildings, citizens })) return citizen.home;
  citizen.home = null;

  let best = null;
  let bestDistance = Infinity;
  for (const house of buildings) {
    if (!isCompletedHouse(house, buildings)) continue;
    if (residentsForHouse(house, citizens).length >= houseResidentCapacity(house)) continue;
    const distance = Math.abs(citizen.x - house.x) + Math.abs(citizen.y - house.y);
    if (
      distance < bestDistance
      || (distance === bestDistance && best && (house.y < best.y || (house.y === best.y && house.x < best.x)))
    ) {
      best = house;
      bestDistance = distance;
    }
  }
  citizen.home = best;
  return best;
}

// A House footprint is blocked terrain, so its portal is the nearest
// walkable tile on the resident's approach side. Passing the resident as the
// origin keeps the choice deterministic while avoiding one global doorway
// becoming an exterior crowd bottleneck.
export function residencePortalForCitizen(citizen, {
  buildings = G.buildings,
  citizens = G.citizens,
} = {}) {
  if (!citizenHasValidResidence(citizen, { buildings, citizens })) return null;
  return nearestWalkableTile(
    Math.round(citizen.home.x),
    Math.round(citizen.home.y),
    3,
    Math.round(citizen.x),
    Math.round(citizen.y),
  );
}

export function citizenAtResidencePortal(citizen, {
  buildings = G.buildings,
  citizens = G.citizens,
} = {}) {
  const portal = residencePortalForCitizen(citizen, { buildings, citizens });
  if (!portal) return false;
  return Math.hypot(citizen.x - portal.x, citizen.y - portal.y) <= 0.8;
}

export function citizenIsIndoors(citizen, buildings = G.buildings) {
  if (!['sleep', 'sheltered'].includes(citizen?.activity?.kind)) return false;
  return citizenAtResidencePortal(citizen, { buildings });
}
