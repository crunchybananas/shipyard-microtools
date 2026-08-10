// Deterministic building-side workforce policy.
//
// Buildings own only a small priority enum. Citizen assignment remains owned by
// citizen-ownership.js, and staffing remains derived from those assignments.
// Automatic policy may move only AI-managed workers; a player-command assignment
// is a Crown order and is never reconsidered here.

import { G, BUILDINGS, getDifficulty } from './state.js?realm=192';
import {
  assignmentDutyForBuilding,
  assignmentPurposeForCitizen,
  citizenStaffingCapacity,
  claimCitizenAssignment,
  releaseCitizenAssignment,
  staffingCount,
  transitionCitizenActivity,
  vocationForBuilding,
  workersForBuilding,
} from './citizen-ownership.js?realm=192';

export const WORKFORCE_PRIORITIES = Object.freeze(['high', 'normal', 'low', 'off']);
export const AUTO_REASSIGN_THRESHOLD = 12;
export const AUTO_REASSIGN_COOLDOWN_TICKS = 360;
export const AUTO_REVIEW_INTERVAL_TICKS = 120;

const PRIORITY_SET = new Set(WORKFORCE_PRIORITIES);
const PRIORITY_RANK = Object.freeze({ off: -1, low: 0, normal: 1, high: 2 });
const PRIORITY_SCORE = Object.freeze({ high: 50, normal: 0, low: -18, off: -Infinity });
const FOOD_JOBS = new Set(['farm', 'fisherman', 'chickencoop', 'cowpen', 'bakery', 'windmill']);
const POLICY_INTERRUPTIBLE_ACTIVITIES = new Set(['idle', 'find_job', 'walk_to_work', 'working']);

let foodDaysTick = -1;
let foodDaysValue = 99;

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function assertLiveBuilding(building) {
  if (!building || !G.buildings.includes(building) || !BUILDINGS[building.type]) {
    throw new TypeError('Workforce policy requires a live known building.');
  }
}

function clearWorkRoute(citizen) {
  citizen.workTarget = null;
  citizen.path = null;
  citizen.pathIdx = 0;
  citizen.activityTimer = 0;
}

function redirectAfterAutomaticAssignment(citizen) {
  clearWorkRoute(citizen);
  if (POLICY_INTERRUPTIBLE_ACTIVITIES.has(citizen.activity.kind)) {
    transitionCitizenActivity(citizen, 'walk_to_work', 'workforce-policy');
  }
}

function releaseForOffPolicy(citizen) {
  if (!citizen.assignment || citizen.assignment.reason === 'player-command') return false;
  releaseCitizenAssignment(citizen, 'workforce-policy');
  clearWorkRoute(citizen);
  if (POLICY_INTERRUPTIBLE_ACTIVITIES.has(citizen.activity.kind)) {
    transitionCitizenActivity(citizen, 'find_job', 'workforce-policy');
  }
  return true;
}

function assignmentIsCoolingDown(citizen) {
  const sinceTick = citizen.assignment?.sinceTick;
  return Number.isSafeInteger(sinceTick)
    && G.gameTick - sinceTick < AUTO_REASSIGN_COOLDOWN_TICKS;
}

function canTransferTo(citizen, target) {
  const assignment = citizen.assignment;
  if (assignment?.reason === 'player-command') return false;
  if (assignment?.building === target) return false;
  if (assignment && assignmentIsCoolingDown(citizen)) return false;
  if (!buildingAcceptsAutomaticWorkers(target)) return false;
  return staffingCount(target) < citizenStaffingCapacity(target);
}

function transferDelta(citizen, target) {
  const current = citizen.assignment?.building || null;
  const targetScore = scoreCitizenJob(citizen, target);
  const currentScore = current ? scoreCitizenJob(citizen, current) : -Infinity;
  return targetScore - currentScore;
}

function applyAutomaticTransfer(citizen, target) {
  const changed = claimCitizenAssignment(citizen, target, {
    duty: assignmentDutyForBuilding(target),
    purpose: assignmentPurposeForCitizen(citizen, target),
    reason: 'workforce-policy',
  });
  if (changed) redirectAfterAutomaticAssignment(citizen);
  return changed;
}

function fillHighPriorityVacancies(building) {
  if (workforcePriorityForBuilding(building) !== 'high') return 0;
  let moved = 0;
  while (staffingCount(building) < citizenStaffingCapacity(building)) {
    const candidates = G.citizens
      .filter(citizen => canTransferTo(citizen, building))
      .filter(citizen => {
        const current = citizen.assignment?.building;
        return !current
          || PRIORITY_RANK[workforcePriorityForBuilding(current)] < PRIORITY_RANK.high;
      })
      .map(citizen => ({
        citizen,
        delta: transferDelta(citizen, building),
        targetScore: scoreCitizenJob(citizen, building),
      }))
      .filter(candidate => !Number.isFinite(candidate.delta)
        || candidate.delta >= AUTO_REASSIGN_THRESHOLD)
      .sort((a, b) => (
        b.delta - a.delta
        || b.targetScore - a.targetScore
        || a.citizen.actorId - b.citizen.actorId
      ));
    const candidate = candidates[0];
    if (!candidate || !applyAutomaticTransfer(candidate.citizen, building)) break;
    moved++;
  }
  return moved;
}

export function workforcePriorityForBuilding(building) {
  const priority = building?.workforcePriority ?? 'normal';
  if (!PRIORITY_SET.has(priority)) {
    throw new TypeError(`Unknown workforce priority: ${String(priority)}`);
  }
  return priority;
}

export function isAIManagedAssignment(citizen) {
  return !!citizen?.assignment && citizen.assignment.reason !== 'player-command';
}

export function isWorkforceConstructionSite(building) {
  return !!building
    && building.buildProgress < 1
    && citizenStaffingCapacity(building) > 0;
}

export function buildingAcceptsAutomaticWorkers(building) {
  return workforcePriorityForBuilding(building) !== 'off';
}

export function isFoodWorkplace(building) {
  return FOOD_JOBS.has(building?.type);
}

export function workforceFoodDaysLeft() {
  if (foodDaysTick !== G.gameTick) {
    foodDaysTick = G.gameTick;
    const daily = Math.max(1, Math.ceil(G.population * getDifficulty().foodMult));
    const stock = (G.resources.food || 0)
      + (G.resources.wheat || 0)
      + (G.resources.flour || 0);
    foodDaysValue = stock / daily;
  }
  return foodDaysValue;
}

export function scoreCitizenJob(citizen, building) {
  const priority = workforcePriorityForBuilding(building);
  if (priority === 'off') return -Infinity;
  let score = -distance(citizen, building) + PRIORITY_SCORE[priority];
  const days = workforceFoodDaysLeft();
  if (days < 3 && FOOD_JOBS.has(building.type)) score += (3 - days) * 14;
  if (isWorkforceConstructionSite(building)) score += 12;
  if (building.type === 'wonder') score += 6;
  if (citizen.assignment?.building === building) score += 6;
  if (!isWorkforceConstructionSite(building) && citizen.profession.kind !== 'settler') {
    score += vocationForBuilding(building) === citizen.profession.kind ? 18 : -8;
  }
  return score;
}

export function reviewAutomaticAssignment(citizen, {
  isBlocked = () => false,
} = {}) {
  if (!isAIManagedAssignment(citizen) || citizen._fleeing) return false;
  if (!POLICY_INTERRUPTIBLE_ACTIVITIES.has(citizen.activity.kind)) return false;
  if (assignmentIsCoolingDown(citizen)) return false;

  const current = citizen.assignment.building;
  const currentScore = scoreCitizenJob(citizen, current);
  let best = null;
  let bestScore = currentScore;
  for (const building of G.buildings) {
    if (building === current || isBlocked(building)) continue;
    if (!buildingAcceptsAutomaticWorkers(building)) continue;
    if (citizenStaffingCapacity(building) < 1) continue;
    if (staffingCount(building) >= citizenStaffingCapacity(building)) continue;
    const score = scoreCitizenJob(citizen, building);
    if (score > bestScore) {
      best = building;
      bestScore = score;
    }
  }
  if (!best || bestScore - currentScore < AUTO_REASSIGN_THRESHOLD) return false;
  return applyAutomaticTransfer(citizen, best);
}

export function setBuildingWorkforcePriority(building, priority) {
  assertLiveBuilding(building);
  if (!PRIORITY_SET.has(priority)) return { ok: false, reason: 'bad-workforce-priority' };
  if (citizenStaffingCapacity(building) < 1) return { ok: false, reason: 'no-workforce' };

  const previous = workforcePriorityForBuilding(building);
  building.workforcePriority = priority;
  let released = 0;
  let reassigned = 0;
  if (priority === 'off') {
    for (const citizen of [...workersForBuilding(building)]) {
      if (releaseForOffPolicy(citizen)) released++;
    }
  } else if (priority === 'high') {
    reassigned = fillHighPriorityVacancies(building);
  }
  return { ok: true, priority, previous, released, reassigned };
}

export function workforcePolicySnapshot(building) {
  assertLiveBuilding(building);
  const workers = workersForBuilding(building);
  return Object.freeze({
    priority: workforcePriorityForBuilding(building),
    capacity: citizenStaffingCapacity(building),
    staffed: workers.length,
    aiWorkers: workers.filter(isAIManagedAssignment).length,
    crownWorkers: workers.filter(citizen => citizen.assignment?.reason === 'player-command').length,
    acceptsAutomaticWorkers: buildingAcceptsAutomaticWorkers(building),
  });
}
