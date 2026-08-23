// Citizen residence schedule and raid-shelter transitions.
//
// Residence ownership remains authoritative in residences.js. This module
// only coordinates the citizen activity/path fields needed to physically
// reach, enter, and leave that owned home.

import { G, MAP_H, MAP_W, getDayPeriod, rngInt } from './state.js?realm=196';
import {
  assignCitizenResidence,
  citizenAtResidencePortal,
  citizenHasValidResidence,
  residencePortalForCitizen,
} from './residences.js?realm=196';
import { setCitizenActivity } from './citizen-activity.js?realm=196';
import {
  blacklistCitizenTarget,
  citizenTargetIsBlacklisted,
  clearCitizenPath,
  pathCitizenTo,
} from './citizen-navigation.js?realm=196';
import { citizenIdleLoiterTarget } from './citizen-work.js?realm=196';

const RAID_SHELTER_INTERRUPTIBLE = new Set([
  'idle', 'find_job', 'walk_to_work', 'working', 'foraging', 'eating',
  'walk_to_eat', 'waiting_for_food', 'go_home', 'sleep', 'leisure',
  'seek_shelter', 'flee',
]);

const DELIVERY_OBLIGATION_ACTIVITIES = new Set([
  'needs_delivery', 'walk_to_deliver', 'deliver',
]);

export const CITIZEN_NIGHT_EXEMPT_ACTIVITIES = new Set([
  'sleep', 'go_home', 'walk_to_deliver', 'deliver', 'needs_delivery',
  'walk_to_eat', 'eating',
]);

function citizenHasDeliveryObligation(citizen) {
  return !!(citizen.carrying && citizen.carryAmount > 0)
    || DELIVERY_OBLIGATION_ACTIVITIES.has(citizen.activity.kind);
}

function nearestRaidEnemy(citizen) {
  let nearest = null;
  let bestDistance = Infinity;
  for (const enemy of G.enemies) {
    const distance = Math.hypot(citizen.x - enemy.x, citizen.y - enemy.y);
    if (distance < bestDistance) {
      nearest = enemy;
      bestDistance = distance;
    }
  }
  return nearest;
}

function clearShelterInterruptedIntent(citizen) {
  citizen.forageTarget = null;
  citizen._foodTarget = null;
  citizen._leisureTarget = null;
  citizen.workTarget = null;
  clearCitizenPath(citizen);
}

export function enterCitizenRaidShelter(citizen) {
  if (!citizenAtResidencePortal(citizen)) return false;
  clearShelterInterruptedIntent(citizen);
  citizen._fleeing = false;
  setCitizenActivity(citizen, 'sheltered', { reason: 'shelter-entered', timer: 60 });
  return true;
}

export function sendCitizenHome(citizen) {
  if (!citizenHasValidResidence(citizen)) assignCitizenResidence(citizen);
  clearCitizenPath(citizen);
  setCitizenActivity(citizen, 'go_home');
  if (citizen.home) {
    const portal = residencePortalForCitizen(citizen);
    if (!portal || !pathCitizenTo(citizen, portal.x, portal.y, { exact: true })) citizen.home = null;
  } else {
    const target = citizenIdleLoiterTarget(citizen);
    pathCitizenTo(citizen, target.x, target.y);
  }
}

export function beginCitizenOpenRaidFlight(citizen, reason = 'shelter-unreachable') {
  const enemy = nearestRaidEnemy(citizen);
  clearCitizenPath(citizen);
  setCitizenActivity(citizen, 'flee', { reason, timer: 30 });
  citizen._fleeing = true;
  if (!enemy) {
    citizen.tx = citizen.x;
    citizen.ty = citizen.y;
    return;
  }
  const dx = citizen.x - enemy.x;
  const dy = citizen.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  citizen.tx = Math.max(1, Math.min(MAP_W - 2, citizen.x + (dx / length) * 6));
  citizen.ty = Math.max(1, Math.min(MAP_H - 2, citizen.y + (dy / length) * 6));
}

export function seekCitizenRaidShelter(citizen) {
  if (citizenHasDeliveryObligation(citizen)) return false;
  if (!RAID_SHELTER_INTERRUPTIBLE.has(citizen.activity.kind)) return false;
  if (
    !citizenHasValidResidence(citizen)
    || citizenTargetIsBlacklisted(citizen, citizen.home.x, citizen.home.y)
  ) {
    clearShelterInterruptedIntent(citizen);
    beginCitizenOpenRaidFlight(citizen);
    return true;
  }
  if (enterCitizenRaidShelter(citizen)) return true;

  const portal = residencePortalForCitizen(citizen);
  clearShelterInterruptedIntent(citizen);
  setCitizenActivity(citizen, 'seek_shelter', { reason: 'raid-shelter' });
  if (!portal || !pathCitizenTo(citizen, portal.x, portal.y, { exact: true })) {
    blacklistCitizenTarget(citizen, citizen.home.x, citizen.home.y);
    beginCitizenOpenRaidFlight(citizen);
  }
  return true;
}

export function leaveCitizenRaidShelter(citizen) {
  citizen._fleeing = false;
  clearCitizenPath(citizen);
  citizen.rest = Math.min(100, citizen.rest ?? 100);
  if (getDayPeriod() === 'night' && citizenAtResidencePortal(citizen)) {
    setCitizenActivity(citizen, 'sleep', { reason: 'raid-cleared', timer: 60 });
  } else {
    setCitizenActivity(citizen, 'find_job', { reason: 'raid-cleared', timer: rngInt(0, 40) });
  }
}

export function citizenEnemyNear(citizen, radius) {
  for (const enemy of G.enemies) {
    if (
      Math.abs(enemy.x - citizen.x) < radius
      && Math.abs(enemy.y - citizen.y) < radius
    ) return true;
  }
  return false;
}
