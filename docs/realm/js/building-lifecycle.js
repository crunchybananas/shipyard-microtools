// ════════════════════════════════════════════════════════════
// Authoritative building removal lifecycle.
//
// Every exit from the live building set — player demolition, fire, raid,
// and undo — comes through removeBuilding(). Cause policy changes refunds,
// statistics, and feedback; structural teardown is deliberately identical.
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, HOUSE_TIERS } from './state.js?realm=182';
import { nearestWalkableTile } from './pathfinding.js?realm=182';
import { announce, chronicle, sfx } from './log.js?realm=182';
import {
  releaseAssignmentsForBuilding,
  transitionCitizenActivity,
} from './citizen-ownership.js?realm=182';

const REMOVAL_CAUSES = new Set(['manual', 'fire', 'raid', 'undo']);
const ASSIGNMENT_BOUND_ACTIVITIES = new Set(['idle', 'find_job', 'walk_to_work', 'working']);

export function buildingCapacity(building) {
  if (building.type !== 'house') return BUILDINGS[building.type]?.pop || 0;
  const level = Math.max(1, Math.min(HOUSE_TIERS.length, Math.trunc(building.level)));
  return HOUSE_TIERS[level - 1].cap;
}

function assertLiveBuilding(building, cause) {
  if (!REMOVAL_CAUSES.has(cause)) throw new TypeError(`Unknown building removal cause: ${cause}`);
  if (!building || typeof building !== 'object') throw new TypeError('Building removal requires a building object.');
  if (!BUILDINGS[building.type]) throw new TypeError(`Cannot remove unknown building type: ${building.type}`);
  const index = G.buildings.indexOf(building);
  if (index < 0) throw new Error(`Cannot ${cause}-remove a building that is not live.`);
  if (G.buildingGrid[building.y]?.[building.x] !== building) {
    throw new Error(`Cannot ${cause}-remove ${building.type}: building grid disagrees with the live collection.`);
  }
  return index;
}

function clearCitizenReference(citizen, building, assignmentReleased) {
  const activityBefore = citizen.activity.kind;
  const lostHome = citizen.home === building;
  const lostDelivery = citizen._deliveryTarget === building;
  const lostLeisure = (
    citizen._leisureTarget?.x === building.x
    && citizen._leisureTarget?.y === building.y
  );

  if (assignmentReleased) citizen.workTarget = null;
  if (lostHome) {
    citizen.home = null;
  }
  if (lostDelivery) {
    citizen._deliveryTarget = null;
    delete citizen._requestedTx;
    delete citizen._requestedTy;
    citizen._pathGoal = null;
  }
  if (lostLeisure) citizen._leisureTarget = null;

  let nextActivity = null;
  if (
    (lostDelivery || assignmentReleased)
    && citizen.carrying
    && citizen.carryAmount > 0
  ) {
    nextActivity = 'needs_delivery';
  } else if (lostHome && (activityBefore === 'sleep' || activityBefore === 'go_home')) {
    nextActivity = 'idle';
  } else if (lostLeisure && activityBefore === 'leisure') {
    nextActivity = 'find_job';
  } else if (assignmentReleased && ASSIGNMENT_BOUND_ACTIVITIES.has(activityBefore)) {
    nextActivity = 'find_job';
  } else if (lostDelivery) {
    nextActivity = 'find_job';
  }

  if (nextActivity !== null) {
    transitionCitizenActivity(citizen, nextActivity, 'building-removed');
    citizen.activityTimer = 0;
    citizen.path = null;
    citizen.pathIdx = 0;
  }
}

function clearBuildingReferences(building) {
  const released = new Set(releaseAssignmentsForBuilding(building, 'building-removed'));
  for (const citizen of G.citizens) clearCitizenReference(citizen, building, released.has(citizen));

  for (const soldier of G.soldiers) {
    if (soldier.homeBuilding === building) soldier.homeBuilding = null;
    if (soldier.garrison === building) {
      soldier.garrison = null;
      const spot = nearestWalkableTile(building.x, building.y, 3);
      if (spot) {
        soldier.x = spot.x;
        soldier.y = spot.y;
        soldier.tx = spot.x;
        soldier.ty = spot.y;
      }
    }
  }

  for (const caravan of G.caravans) {
    if (caravan.building === building) caravan.building = null;
  }

  G.walkers = G.walkers.filter(walker => walker.home !== building && walker.src !== building);
  for (const walker of G.walkers) walker.visitedHouses?.delete(building);
  G.animals = G.animals.filter(animal => animal.home !== building);
  if (Array.isArray(G.carts)) G.carts = G.carts.filter(cart => cart.market !== building);
  if (Array.isArray(G.schoolKids)) G.schoolKids = G.schoolKids.filter(kid => kid.school !== building);

  if (G.selectedBuilding === building) G.selectedBuilding = null;
  if (G._refreshPanelFor === building) G._refreshPanelFor = null;

  // Patrol posts are a derived cache of wall/tower references. Always
  // invalidate it: collection length alone cannot detect a remove+place swap.
  G._patrolPosts = null;
  G._patrolPostsBuildingCount = -1;

  // A destroyed placement cannot remain an undo target. This also makes the
  // next undo reach the newest building that is still live.
  if (Array.isArray(G._undoStack)) {
    G._undoStack = G._undoStack.filter(entry => entry.b !== building);
  }

  building.caravanOut = false;
  building.onFire = false;
  building.active = false;
}

function applyCausePolicy(building, cause, undoEntry) {
  const def = BUILDINGS[building.type];
  if (cause === 'manual' || cause === 'undo') {
    const refundScale = cause === 'undo' ? 1 : 0.5;
    for (const [resource, cost] of Object.entries(def.cost)) {
      G.resources[resource] = (G.resources[resource] || 0) + Math.floor(cost * refundScale);
    }
  }

  if ((cause === 'fire' || cause === 'raid') && G.stats) {
    G.stats.buildingsLost = (G.stats.buildingsLost || 0) + 1;
  }

  if (cause === 'undo') {
    G.storyFlags = undoEntry.flagsSnapshot;
    G.chronicle.length = undoEntry.chronicleLen;
    sfx('click');
    return;
  }

  if (cause === 'fire') {
    announce(`🔥 ${def.name} burned down!`, 'danger', { chronicle: false });
    G.cameraShake = Math.max(G.cameraShake || 0, 10);
  }
  if (cause === 'raid' && building.type === 'wonder' && G.wonder) {
    chronicle('The Hall of Ages is thrown down. Its foundations remember what was owed.', 'raid');
  }
  sfx('demolish');
}

export function removeBuilding(building, { cause, undoEntry = null } = {}) {
  const index = assertLiveBuilding(building, cause);
  if (cause === 'undo') {
    if (!undoEntry || G._undoStack?.at(-1) !== undoEntry || undoEntry.b !== building) {
      throw new Error('Undo removal requires the current top placement entry.');
    }
    if (!undoEntry.flagsSnapshot || !Number.isSafeInteger(undoEntry.chronicleLen)) {
      throw new Error('Undo placement entry is incomplete.');
    }
  } else if (undoEntry !== null) {
    throw new Error('Only undo removal accepts an undo entry.');
  }

  const capacity = buildingCapacity(building);
  const defense = BUILDINGS[building.type].defense || 0;

  clearBuildingReferences(building);
  G.buildings.splice(index, 1);
  G.buildingGrid[building.y][building.x] = null;
  G.maxPop = Math.max(0, G.maxPop - capacity);
  G.defense = Math.max(0, G.defense - defense);
  G.obstacleEpoch = (G.obstacleEpoch || 0) + 1;

  if (building.type === 'wonder' && G.wonder) G.wonder.placed = false;
  applyCausePolicy(building, cause, undoEntry);
  return true;
}

export function undoLastBuildingPlacement() {
  if (!Array.isArray(G._undoStack) || G._undoStack.length === 0) return false;
  const entry = G._undoStack.at(-1);
  removeBuilding(entry.b, { cause: 'undo', undoEntry: entry });
  return true;
}
