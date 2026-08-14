// Citizen activity ownership helpers.
//
// This module owns causal activity defaults and stable actor hashing. It does
// not schedule decisions; citizens.js remains the authoritative tick driver.

import { transitionCitizenActivity } from './citizen-ownership.js?realm=195';

export const DEFAULT_CITIZEN_ACTIVITY_REASON = Object.freeze({
  idle: 'idle-wait',
  find_job: 'seek-work',
  walk_to_work: 'route-to-work',
  working: 'arrived-at-work',
  walk_to_deliver: 'route-to-delivery',
  needs_delivery: 'cargo-needs-storage',
  deliver: 'cargo-delivered',
  foraging: 'forage-started',
  walk_to_eat: 'route-to-food',
  waiting_for_food: 'food-shortage',
  eating: 'eat-food',
  go_home: 'route-home',
  sleep: 'sleep-rest',
  leisure: 'leisure-started',
  seek_shelter: 'raid-shelter',
  sheltered: 'shelter-entered',
  flee: 'threat-response',
});

export function setCitizenActivity(citizen, kind, {
  reason = DEFAULT_CITIZEN_ACTIVITY_REASON[kind],
  timer = 0,
} = {}) {
  const changed = transitionCitizenActivity(citizen, kind, reason);
  // Decision cadence is scheduler state, not the causal activity clock. A
  // same-kind request preserves sinceTick and emits no transition while still
  // allowing the state machine to schedule its next decision.
  citizen.activityTimer = timer;
  return changed;
}

export function assignedCitizenBuilding(citizen) {
  return citizen.assignment?.building || null;
}

export function citizenStableHash(citizen) {
  const actorId = Number.isSafeInteger(citizen?.actorId) ? citizen.actorId : 0;
  let hash = Math.imul(actorId ^ 0x9e3779b9, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}
