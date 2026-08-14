// Physical citizen meal routing.
//
// Food inventory remains authoritative in building-inventory.js. These
// helpers choose a deterministic reachable pantry approach and manage the
// visible walk/wait/resume activities; consumption itself stays with the
// state machine so it happens only at physical arrival.

import { G } from './state.js?realm=195';
import { findPath, isWalkable } from './pathfinding.js?realm=195';
import {
  findReachableFoodStore,
  isFoodStore,
  storedFood,
} from './building-inventory.js?realm=195';
import { citizenHasValidResidence } from './residences.js?realm=195';
import {
  assignedCitizenBuilding,
  citizenStableHash,
  setCitizenActivity,
} from './citizen-activity.js?realm=195';
import {
  blacklistCitizenTarget,
  citizenManhattanDistance,
  citizenTargetCrowdPenalty,
  citizenTargetIsBlacklisted,
  clearCitizenPath,
  pathCitizenTo,
} from './citizen-navigation.js?realm=195';
import { pathCitizenToWork } from './citizen-work.js?realm=195';

export const CITIZEN_MEAL_INTERRUPTIBLE_ACTIVITIES = new Set([
  'idle', 'find_job', 'walk_to_work', 'working', 'leisure',
]);

const FOOD_RETRY_BASE_TICKS = 72;
const FOOD_RETRY_SPREAD_TICKS = 37;

function foodRetryTicks(citizen) {
  return FOOD_RETRY_BASE_TICKS
    + (citizenStableHash(citizen) % FOOD_RETRY_SPREAD_TICKS);
}

function foodStoreApproaches(citizen, building) {
  if (!isFoodStore(building)) return [];
  const bx = Math.round(building.x);
  const by = Math.round(building.y);
  const candidates = [];
  for (let radius = 1; radius <= 1; radius++) {
    for (let y = by - radius; y <= by + radius; y++) {
      for (let x = bx - radius; x <= bx + radius; x++) {
        if (Math.max(Math.abs(x - bx), Math.abs(y - by)) !== radius) continue;
        if (!isWalkable(x, y)) continue;
        const crowd = citizenTargetCrowdPenalty(citizen, x, y);
        const fromHere = citizenManhattanDistance(citizen.x, citizen.y, x, y);
        const jitter = ((citizenStableHash(citizen) ^ (x * 1597334677) ^ (y * 3812015801)) >>> 0)
          / 0xffffffff * 0.2;
        candidates.push({
          x,
          y,
          score: radius * 1.8 + fromHere * 0.12 + crowd * 5.5 + jitter,
        });
      }
    }
  }
  candidates.sort((first, second) => (
    first.score - second.score || first.y - second.y || first.x - second.x
  ));
  return candidates;
}

export function reachableCitizenFoodRoute(citizen, building) {
  if (citizenTargetIsBlacklisted(citizen, building.x, building.y)) return null;
  for (const approach of foodStoreApproaches(citizen, building)) {
    const route = findPath(
      Math.round(citizen.x),
      Math.round(citizen.y),
      approach.x,
      approach.y,
    );
    if (route) return { approach, route };
  }
  return null;
}

export function citizenFoodTargetStillValid(citizen) {
  return !!citizen._foodTarget
    && isFoodStore(citizen._foodTarget)
    && storedFood(citizen._foodTarget) > 0;
}

export function citizenAtFoodTarget(citizen, building = citizen._foodTarget) {
  if (!building) return false;
  const goal = citizen._pathGoal;
  if (
    goal
    && Math.max(Math.abs(goal.x - building.x), Math.abs(goal.y - building.y)) <= 3
    && Math.hypot(citizen.x - goal.x, citizen.y - goal.y) <= 0.82
  ) return true;
  return foodStoreApproaches(citizen, building)
    .some(approach => Math.hypot(citizen.x - approach.x, citizen.y - approach.y) <= 0.82);
}

function waitForFood(citizen, reason = 'food-shortage') {
  const wasWaiting = citizen.activity.kind === 'waiting_for_food';
  citizen._foodTarget = null;
  clearCitizenPath(citizen);
  citizen.tx = citizen.x;
  citizen.ty = citizen.y;
  setCitizenActivity(citizen, 'waiting_for_food', {
    reason,
    timer: foodRetryTicks(citizen),
  });
  if (!wasWaiting) {
    G.particles.push({
      tx: citizen.x,
      ty: citizen.y,
      offsetY: -25,
      text: reason === 'food-source-empty' ? 'Pantry empty' : 'Need reachable food',
      alpha: 1.3,
      vy: -0.12,
      decay: 0.016,
      type: 'speech',
    });
  }
  return true;
}

export function beginCitizenFoodRoute(citizen, shortageReason = 'food-shortage') {
  if (citizen.carrying && citizen.carryAmount > 0) return false;
  const routes = new Map();
  const store = findReachableFoodStore(citizen, {
    mode: 'withdraw',
    isReachable: building => {
      if (
        building.type === 'house'
        && (citizen.home !== building || !citizenHasValidResidence(citizen))
      ) return false;
      const route = reachableCitizenFoodRoute(citizen, building);
      if (route) routes.set(building, route);
      return !!route;
    },
  });
  if (!store) return waitForFood(citizen, shortageReason);

  const route = routes.get(store);
  citizen._foodTarget = store;
  clearCitizenPath(citizen);
  setCitizenActivity(citizen, 'walk_to_eat', { reason: 'route-to-food' });
  if (
    route
    && pathCitizenTo(citizen, route.approach.x, route.approach.y, { exact: true })
  ) return true;
  blacklistCitizenTarget(citizen, store.x, store.y);
  citizen._foodTarget = null;
  return beginCitizenFoodRoute(citizen, shortageReason);
}

export function resumeCitizenAfterMeal(citizen) {
  citizen._foodTarget = null;
  clearCitizenPath(citizen);
  const workplace = assignedCitizenBuilding(citizen);
  if (workplace && G.buildings.includes(workplace)) {
    setCitizenActivity(citizen, 'walk_to_work', { reason: 'route-to-work' });
    pathCitizenToWork(citizen);
  } else {
    setCitizenActivity(citizen, 'find_job', { reason: 'seek-work', timer: 5 });
  }
}
