// Deterministic citizen rest and social-needs arithmetic.
//
// Scheduling, routing, and activity transitions remain with their respective
// domains. Keeping the numeric need mutations here makes their cadence and
// bounds explicit without adding any save fields or consuming RNG.

export const CITIZEN_MEAL_HUNGER_THRESHOLD = 70;

function ensureCitizenSocialNeeds(citizen) {
  if (!citizen.needs) citizen.needs = { joy: 55, faith: 55 };
  return citizen.needs;
}

export function restCitizenWhileSheltered(citizen) {
  citizen.rest = Math.min(100, (citizen.rest ?? 100) + 0.15);
}

export function settleCitizenWakeRest(citizen) {
  citizen.rest = Math.min(100, citizen.rest ?? 100);
}

export function drainCitizenHeartbeatNeeds(citizen) {
  if (citizen.activity.kind !== 'sleep' && citizen.activity.kind !== 'idle') {
    citizen.rest = Math.max(0, (citizen.rest ?? 100) - 0.35);
  }
  const needs = ensureCitizenSocialNeeds(citizen);
  needs.joy = Math.max(0, needs.joy - 0.10);
  needs.faith = Math.max(0, needs.faith - 0.06);
  return needs;
}

export function satisfyCitizenLeisureNeed(citizen, venueKind) {
  const needs = ensureCitizenSocialNeeds(citizen);
  if (venueKind === 'tavern') {
    needs.joy = Math.min(100, needs.joy + 40);
  } else {
    needs.faith = Math.min(100, needs.faith + 40);
  }
}

export function restoreCitizenSleepRest(citizen) {
  citizen.rest = Math.min(100, (citizen.rest ?? 100) + 0.15 * 60);
}

export function feedCitizenMeal(citizen) {
  citizen.hunger = Math.max(0, citizen.hunger - 60);
}
