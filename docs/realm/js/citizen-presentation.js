// Citizen-to-shell boundary for Engine v2 Phase 1A.
//
// Simulation citizens keep authoritative ownership and movement state. The
// renderer and normal UI receive this immutable, reference-free projection so
// temporary work cannot be mistaken for identity and drawing cannot mutate the
// simulation graph.

import { G, RESOURCE_KEYS } from './state.js?realm=184';
import {
  CITIZEN_ACTIVITIES,
  CITIZEN_APPEARANCE_IDS,
  getAssignmentRevision,
  validateCitizenOwnership,
} from './citizen-ownership.js?realm=184';

const CITIZEN_ACTIVITY_SET = new Set(CITIZEN_ACTIVITIES);
const CITIZEN_APPEARANCE_ID_SET = new Set(CITIZEN_APPEARANCE_IDS);
const CARRIED_RESOURCE_SET = new Set(RESOURCE_KEYS);

const PRESENTATION_VARIANT_BY_PROFESSION = Object.freeze({
  settler: 'settler',
  farmer: 'farmer',
  rancher: 'rancher',
  lumber: 'lumber',
  stonecutter: 'stonecutter',
  blacksmith: 'blacksmith',
  miner: 'miner',
  fisher: 'fisher',
  innkeeper: 'innkeeper',
  trader: 'trader',
  guard: 'guard',
  scholar: 'scholar',
  builder: 'builder',
});

const ACTION_BY_ACTIVITY = Object.freeze({
  working: 'work',
  foraging: 'work',
  eating: 'work',
  walk_to_deliver: 'carry',
  needs_delivery: 'carry',
  deliver: 'carry',
});

function assertFiniteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Citizen presentation ${field} must be finite.`);
  }
}

function assertOptionalFiniteNumber(value, field) {
  if (value !== undefined) assertFiniteNumber(value, field);
}

function assertOptionalTimelineTick(value, field) {
  if (
    value !== undefined
    && value !== null
    && (!Number.isSafeInteger(value) || value < 0 || value > G.gameTick)
  ) {
    throw new TypeError(`Citizen presentation ${field} must be a current non-negative tick.`);
  }
}

function assertFacing(value, field) {
  if (value !== undefined && ![-1, 0, 1].includes(value)) {
    throw new TypeError(`Citizen presentation ${field} must be -1, 0, or 1.`);
  }
}

function freezePoint(point) {
  if (point === null) return null;
  if (
    typeof point !== 'object'
    || Object.getPrototypeOf(point) !== Object.prototype
    || Reflect.ownKeys(point).length !== 2
    || !Object.hasOwn(point, 'x')
    || !Object.hasOwn(point, 'y')
    || !Number.isInteger(point.x)
    || !Number.isInteger(point.y)
  ) {
    throw new TypeError('Citizen presentation path points require exact integer x/y fields.');
  }
  return Object.freeze({ x: point.x, y: point.y });
}

function validatePresentationState(citizen, selectedActorId) {
  if (
    selectedActorId !== null
    && (!Number.isSafeInteger(selectedActorId) || selectedActorId < 1)
  ) {
    throw new TypeError('Citizen presentation selectedActorId must be null or a positive safe integer.');
  }

  for (const field of ['x', 'y', 'tx', 'ty', 'carryAmount', 'hunger', 'rest']) {
    assertFiniteNumber(citizen[field], field);
  }
  if (citizen.carryAmount < 0) {
    throw new TypeError('Citizen presentation carryAmount must not be negative.');
  }
  if (citizen.hunger < 0 || citizen.hunger > 100 || citizen.rest < 0 || citizen.rest > 100) {
    throw new TypeError('Citizen presentation hunger and rest must be between 0 and 100.');
  }
  if (citizen.carrying !== null && !CARRIED_RESOURCE_SET.has(citizen.carrying)) {
    throw new TypeError(`Citizen presentation has unknown cargo '${String(citizen.carrying)}'.`);
  }
  if ((citizen.carrying === null) !== (citizen.carryAmount === 0)) {
    throw new TypeError('Citizen presentation cargo kind and amount disagree.');
  }

  const needs = citizen.needs;
  if (
    !needs
    || typeof needs !== 'object'
    || Object.getPrototypeOf(needs) !== Object.prototype
    || Reflect.ownKeys(needs).length !== 2
    || !Object.hasOwn(needs, 'joy')
    || !Object.hasOwn(needs, 'faith')
  ) {
    throw new TypeError('Citizen presentation needs require exact joy and faith fields.');
  }
  for (const field of ['joy', 'faith']) {
    assertFiniteNumber(needs[field], `needs.${field}`);
    if (needs[field] < 0 || needs[field] > 100) {
      throw new TypeError(`Citizen presentation needs.${field} must be between 0 and 100.`);
    }
  }

  if (citizen.path === null) {
    if (citizen.pathIdx !== 0) {
      throw new TypeError('Citizen presentation null paths require pathIdx 0.');
    }
  } else if (
    !Array.isArray(citizen.path)
    || !Number.isSafeInteger(citizen.pathIdx)
    || citizen.pathIdx < 0
    || citizen.pathIdx > citizen.path.length
  ) {
    throw new TypeError('Citizen presentation requires a null path or a bounded path array/index.');
  }

  assertOptionalFiniteNumber(citizen._px, 'previous x');
  assertOptionalFiniteNumber(citizen._py, 'previous y');
  if ((citizen._px === undefined) !== (citizen._py === undefined)) {
    throw new TypeError('Citizen presentation previous coordinates must be present together.');
  }
  assertOptionalTimelineTick(citizen._pathStartedAt, 'pathStartedAt');
  assertOptionalTimelineTick(citizen._movedAt, 'movedAt');
  for (const [field, label] of [
    ['faceX', 'faceX'],
    ['faceZ', 'faceZ'],
    ['_workFaceX', 'workFaceX'],
    ['_workFaceZ', 'workFaceZ'],
  ]) {
    assertFacing(citizen[field], label);
  }
  if (citizen.hp !== undefined) assertFiniteNumber(citizen.hp, 'hp');
  if (citizen.hurtTimer !== undefined) {
    assertFiniteNumber(citizen.hurtTimer, 'hurtTimer');
    if (citizen.hurtTimer < 0) {
      throw new TypeError('Citizen presentation hurtTimer must not be negative.');
    }
  }
  if (
    citizen._stuckTicks !== undefined
    && (!Number.isSafeInteger(citizen._stuckTicks) || citizen._stuckTicks < 0)
  ) {
    throw new TypeError('Citizen presentation waitAge must be a non-negative safe integer.');
  }
}

function assignmentSummary(assignment) {
  if (!assignment) return null;
  const building = assignment.building;
  if (!building || !Number.isInteger(building.x) || !Number.isInteger(building.y)) {
    throw new TypeError('Citizen presentation requires a live integer building locator.');
  }
  return Object.freeze({
    kind: assignment.kind,
    building: Object.freeze({
      type: building.type,
      x: building.x,
      y: building.y,
      complete: building.buildProgress >= 1,
    }),
    duty: assignment.duty,
    purpose: assignment.purpose,
    sinceTick: assignment.sinceTick,
    reason: assignment.reason,
  });
}

export function presentationVariantForIdentity(appearanceId, professionKind) {
  if (!CITIZEN_APPEARANCE_ID_SET.has(appearanceId)) {
    throw new TypeError(`No citizen presentation appearance for '${appearanceId}'.`);
  }
  const variant = PRESENTATION_VARIANT_BY_PROFESSION[professionKind];
  if (!variant) throw new TypeError(`No citizen presentation variant for profession '${professionKind}'.`);
  return variant;
}

export function presentationActionForActivity(activityKind, carrying, isMoving) {
  if (!CITIZEN_ACTIVITY_SET.has(activityKind)) {
    throw new TypeError(`No citizen presentation action for activity '${activityKind}'.`);
  }
  if (carrying || ACTION_BY_ACTIVITY[activityKind] === 'carry') return 'carry';
  if (ACTION_BY_ACTIVITY[activityKind] === 'work') return 'work';
  return isMoving ? 'walk' : 'idle';
}

export function buildCitizenPresentation(citizen, {
  selectedActorId = null,
  buildings = new Set(G.buildings),
} = {}) {
  if (!citizen || !Number.isSafeInteger(citizen.actorId) || citizen.actorId < 1) {
    throw new TypeError('Citizen presentation requires a positive safe actorId.');
  }
  if (!citizen.identity || !citizen.profession || !citizen.activity) {
    throw new TypeError(`Citizen ${citizen.actorId} is missing Phase 1A ownership state.`);
  }
  const ownership = validateCitizenOwnership(citizen, buildings);
  if (!ownership.ok) {
    throw new TypeError(`Citizen ${citizen.actorId} cannot cross the presentation boundary: ${ownership.error.message}`);
  }
  validatePresentationState(citizen, selectedActorId);

  const pathActive = !!(citizen.path && citizen.pathIdx < citizen.path.length);
  const currentWaypoint = pathActive ? citizen.path[citizen.pathIdx] : null;
  const previousWaypoint = pathActive && citizen.pathIdx > 0
    ? citizen.path[citizen.pathIdx - 1]
    : null;
  const selected = citizen.actorId === selectedActorId;
  const pathRemaining = selected && pathActive
    ? Object.freeze(citizen.path.slice(citizen.pathIdx).map(freezePoint))
    : Object.freeze([]);
  const activity = Object.freeze({
    kind: citizen.activity.kind,
    sinceTick: citizen.activity.sinceTick,
    reason: citizen.activity.reason,
  });
  const profession = Object.freeze({
    kind: citizen.profession.kind,
    sinceTick: citizen.profession.sinceTick,
    reason: citizen.profession.reason,
  });
  const identity = Object.freeze({
    name: citizen.identity.name,
    appearanceId: citizen.identity.appearanceId,
  });

  return Object.freeze({
    presentationKind: 'citizen',
    actorId: citizen.actorId,
    identity,
    profession,
    assignment: assignmentSummary(citizen.assignment),
    activity,
    variant: presentationVariantForIdentity(identity.appearanceId, profession.kind),
    x: citizen.x,
    y: citizen.y,
    tx: citizen.tx,
    ty: citizen.ty,
    previousX: citizen._px,
    previousY: citizen._py,
    pathActive,
    pathCurrent: freezePoint(currentWaypoint),
    pathPrevious: freezePoint(previousWaypoint),
    pathRemaining,
    pathStartedAt: citizen._pathStartedAt ?? null,
    movedAt: citizen._movedAt ?? null,
    faceX: citizen.faceX || 0,
    faceZ: citizen.faceZ || 0,
    workFaceX: citizen._workFaceX || 0,
    workFaceZ: citizen._workFaceZ || 0,
    carrying: citizen.carrying,
    carryAmount: citizen.carryAmount,
    hunger: citizen.hunger,
    rest: citizen.rest,
    needs: Object.freeze({
      joy: citizen.needs?.joy ?? 55,
      faith: citizen.needs?.faith ?? 55,
    }),
    hp: citizen.hp,
    hurtTimer: citizen.hurtTimer ?? 0,
    waitAge: citizen._stuckTicks ?? 0,
    selected,
  });
}

export function buildCitizenPresentations(citizens, options) {
  if (!Array.isArray(citizens)) throw new TypeError('Citizen presentation input must be an array.');
  const batchOptions = {
    ...options,
    buildings: options?.buildings || new Set(G.buildings),
  };
  return Object.freeze(citizens.map(citizen => buildCitizenPresentation(citizen, batchOptions)));
}

let currentPresentationCache = null;

export function buildCurrentCitizenPresentations() {
  const assignmentRevision = getAssignmentRevision();
  if (
    currentPresentationCache
    && currentPresentationCache.tick === G.gameTick
    && currentPresentationCache.selectedActorId === G.selectedCitizenId
    && currentPresentationCache.citizens === G.citizens
    && currentPresentationCache.citizenCount === G.citizens.length
    && currentPresentationCache.buildings === G.buildings
    && currentPresentationCache.buildingCount === G.buildings.length
    && currentPresentationCache.assignmentRevision === assignmentRevision
  ) {
    return currentPresentationCache.value;
  }

  const value = buildCitizenPresentations(G.citizens, {
    selectedActorId: G.selectedCitizenId,
  });
  currentPresentationCache = {
    tick: G.gameTick,
    selectedActorId: G.selectedCitizenId,
    citizens: G.citizens,
    citizenCount: G.citizens.length,
    buildings: G.buildings,
    buildingCount: G.buildings.length,
    assignmentRevision,
    value,
  };
  return value;
}
