// Engine v2 Phase 1A citizen ownership.
//
// This module is the sole authority for citizen identity transitions,
// profession, assignment, and activity. Buildings never own worker arrays;
// staffing is a deterministic derived view of citizen assignments.

import { G, BUILDINGS } from './state.js?realm=192';
import { emit, off, on } from './bus.js?realm=192';

export const CONSTRUCTION_STAFF_LIMIT = 2;

export const CITIZEN_PROFESSIONS = Object.freeze([
  'settler', 'farmer', 'rancher', 'lumber', 'stonecutter', 'blacksmith',
  'miner', 'fisher', 'innkeeper', 'trader', 'guard', 'scholar', 'builder',
]);

export const CITIZEN_ACTIVITIES = Object.freeze([
  'idle', 'find_job', 'walk_to_work', 'working', 'walk_to_deliver',
  'needs_delivery', 'deliver', 'foraging', 'walk_to_eat',
  'waiting_for_food', 'eating', 'go_home', 'sleep', 'leisure',
  'seek_shelter', 'sheltered', 'flee',
]);

export const CITIZEN_APPEARANCE_IDS = Object.freeze([
  'identity-01', 'identity-02',
]);

export const IDENTITY_REASONS = Object.freeze([
  'story-namesake', 'player-rename',
]);

export const PROFESSION_REASONS = Object.freeze([
  'spawn-settler', 'first-vocation',
]);

export const ASSIGNMENT_CLAIM_REASONS = Object.freeze([
  'job-market', 'player-command', 'construction', 'food-crisis',
  'workforce-policy',
]);

export const ASSIGNMENT_RELEASE_REASONS = Object.freeze([
  'player-command', 'food-crisis', 'construction-complete',
  'building-removed', 'path-unreachable', 'citizen-removed',
  'assignment-invalid', 'workforce-policy', 'military-recruitment',
]);

export const ACTIVITY_REASONS = Object.freeze([
  'spawn-idle', 'idle-wait', 'seek-work', 'route-to-work', 'arrived-at-work',
  'work-cycle', 'cargo-ready', 'cargo-needs-storage', 'route-to-delivery',
  'cargo-delivered', 'forage-started', 'forage-complete', 'route-to-food',
  'food-shortage', 'food-source-empty', 'eat-food',
  'route-home', 'sleep-rest', 'wake-day', 'leisure-started',
  'leisure-complete', 'path-unreachable', 'building-removed',
  'construction-complete', 'food-crisis', 'threat-response',
  'combat-recovery', 'player-command', 'assignment-invalid',
  'workforce-policy', 'raid-shelter', 'shelter-entered',
  'shelter-unreachable', 'raid-cleared',
]);

const PROFESSION_SET = new Set(CITIZEN_PROFESSIONS);
const ACTIVITY_SET = new Set(CITIZEN_ACTIVITIES);
const APPEARANCE_ID_SET = new Set(CITIZEN_APPEARANCE_IDS);
const IDENTITY_REASON_SET = new Set(IDENTITY_REASONS);
const PROFESSION_REASON_SET = new Set(PROFESSION_REASONS);
const ASSIGNMENT_CLAIM_REASON_SET = new Set(ASSIGNMENT_CLAIM_REASONS);
const ASSIGNMENT_RELEASE_REASON_SET = new Set(ASSIGNMENT_RELEASE_REASONS);
const ACTIVITY_REASON_SET = new Set(ACTIVITY_REASONS);
const REALM_LAID_CONSTRUCTION_TYPES = new Set(['road', 'wall']);

export const VOCATION_BY_BUILDING = Object.freeze({
  farm: 'farmer',
  windmill: 'farmer',
  bakery: 'farmer',
  chickencoop: 'rancher',
  cowpen: 'rancher',
  lumber: 'lumber',
  sawmill: 'lumber',
  quarry: 'stonecutter',
  blacksmith: 'blacksmith',
  mine: 'miner',
  fisherman: 'fisher',
  tavern: 'innkeeper',
  market: 'trader',
  tradingpost: 'trader',
  barracks: 'guard',
  tower: 'guard',
  archery: 'guard',
  school: 'scholar',
  church: 'scholar',
  townhall: 'builder',
  wonder: 'builder',
});

let assignmentRevision = 0;
let staffingRevision = -1;
let staffingCitizens = null;
let staffingIndex = new Map();

function currentTick() {
  if (!Number.isSafeInteger(G.gameTick) || G.gameTick < 0) {
    throw new TypeError('Citizen transitions require a non-negative safe game tick.');
  }
  return G.gameTick;
}

function assertReason(reason, allowed, field) {
  if (!allowed.has(reason)) throw new TypeError(`Unknown ${field} transition reason: ${reason}`);
}

function assertExactRecordKeys(value, expected, field) {
  if (!value || typeof value !== 'object') throw new TypeError(`${field} must be an object.`);
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== expected.length
    || expected.some(key => !Object.hasOwn(value, key))
    || actual.some(key => typeof key !== 'string')
  ) {
    throw new TypeError(`${field} has an unknown or missing field.`);
  }
}

function assertCitizen(citizen) {
  if (!citizen || typeof citizen !== 'object') throw new TypeError('Citizen transition requires a citizen object.');
  if (!Number.isSafeInteger(citizen.actorId) || citizen.actorId < 1) {
    throw new TypeError('Citizen transition requires a positive safe actorId.');
  }
  if (!citizen.identity || !citizen.profession || !citizen.activity) {
    throw new TypeError(`Citizen ${citizen.actorId} is missing ownership state.`);
  }
  return citizen;
}

function assertName(name) {
  if (typeof name !== 'string' || name !== name.trim() || name.length < 1 || name.length > 80) {
    throw new TypeError('Citizen names must be trimmed strings from 1 through 80 characters.');
  }
}

function assertAppearanceId(appearanceId) {
  if (!APPEARANCE_ID_SET.has(appearanceId)) {
    throw new TypeError(`Unknown citizen appearanceId: ${appearanceId}`);
  }
}

function assertLiveBuilding(building) {
  if (!building || typeof building !== 'object' || !G.buildings.includes(building)) {
    throw new TypeError('Citizen assignment requires a live building.');
  }
  if (typeof building.type !== 'string' || !Object.hasOwn(BUILDINGS, building.type)) {
    throw new TypeError('Citizen assignment requires a known string building type.');
  }
  if (!Number.isInteger(building.x) || !Number.isInteger(building.y)) {
    throw new TypeError('Assignment buildings require exact integer coordinates.');
  }
}

function freezeSummary(value) {
  if (value === null) return null;
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') Object.freeze(nested);
  }
  return Object.freeze(value);
}

export function buildingLocator(building) {
  if (!building) return null;
  return Object.freeze({
    type: building.type,
    x: building.x,
    y: building.y,
  });
}

export function summarizeCitizenField(field, value) {
  if (value === null) return null;
  if (field === 'identity') {
    return freezeSummary({ name: value.name, appearanceId: value.appearanceId });
  }
  if (field === 'profession' || field === 'activity') {
    return freezeSummary({ kind: value.kind, sinceTick: value.sinceTick, reason: value.reason });
  }
  if (field === 'assignment') {
    return freezeSummary({
      kind: value.kind,
      building: buildingLocator(value.building),
      duty: value.duty,
      purpose: value.purpose,
      sinceTick: value.sinceTick,
      reason: value.reason,
    });
  }
  throw new TypeError(`Unknown citizen ownership field: ${field}`);
}

function transitionEvent(citizen, field, oldValue, newValue, tick, reason) {
  const event = Object.freeze({
    actorId: citizen.actorId,
    field,
    oldValue: summarizeCitizenField(field, oldValue),
    newValue: summarizeCitizenField(field, newValue),
    tick,
    reason,
  });
  emit('citizen-transition', event);
}

export function onCitizenTransition(listener) {
  if (typeof listener !== 'function') throw new TypeError('Citizen transition listener must be a function.');
  on('citizen-transition', listener);
  return () => off('citizen-transition', listener);
}

export function assertCitizenActorIdAvailable() {
  const next = G.nextActorId;
  if (!Number.isSafeInteger(next) || next < 1) {
    throw new TypeError('G.nextActorId must be a positive safe integer.');
  }
  if (next === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Citizen actor ID space is exhausted.');
  }
  let maxActorId = 0;
  const liveActorIds = new Set();
  for (const citizen of G.citizens) {
    const actorId = citizen?.actorId;
    if (!Number.isSafeInteger(actorId) || actorId < 1) {
      throw new TypeError('Live citizens must have positive safe actor IDs before allocation.');
    }
    if (liveActorIds.has(actorId)) {
      throw new RangeError(`Duplicate live citizen actorId ${actorId}.`);
    }
    liveActorIds.add(actorId);
    maxActorId = Math.max(maxActorId, actorId);
  }
  if (next <= maxActorId) {
    throw new RangeError(`G.nextActorId must be greater than every live citizen actorId (max ${maxActorId}).`);
  }
  return next;
}

export function allocateCitizenActorId() {
  const next = assertCitizenActorIdAvailable();
  G.nextActorId = next + 1;
  return next;
}

export function createCitizenOwnership(name, {
  appearanceId = null,
} = {}) {
  assertName(name);
  if (appearanceId !== null) assertAppearanceId(appearanceId);
  const tick = currentTick();
  const actorId = allocateCitizenActorId();
  const resolvedAppearance = appearanceId
    || CITIZEN_APPEARANCE_IDS[(actorId - 1) % CITIZEN_APPEARANCE_IDS.length];
  return {
    actorId,
    identity: {
      name,
      appearanceId: resolvedAppearance,
    },
    profession: {
      kind: 'settler',
      sinceTick: tick,
      reason: 'spawn-settler',
    },
    assignment: null,
    activity: {
      kind: 'idle',
      sinceTick: tick,
      reason: 'spawn-idle',
    },
  };
}

export function renameCitizen(citizen, name, reason) {
  assertCitizen(citizen);
  assertName(name);
  assertReason(reason, IDENTITY_REASON_SET, 'identity');
  if (citizen.identity.name === name) return false;
  const tick = currentTick();
  const oldValue = citizen.identity;
  const newValue = {
    name,
    appearanceId: oldValue.appearanceId,
  };
  citizen.identity = newValue;
  transitionEvent(citizen, 'identity', oldValue, newValue, tick, reason);
  return true;
}

export function transitionCitizenActivity(citizen, kind, reason) {
  assertCitizen(citizen);
  if (!ACTIVITY_SET.has(kind)) throw new TypeError(`Unknown citizen activity: ${kind}`);
  assertReason(reason, ACTIVITY_REASON_SET, 'activity');
  if (citizen.activity.kind === kind) return false;
  const tick = currentTick();
  const oldValue = citizen.activity;
  const newValue = { kind, sinceTick: tick, reason };
  citizen.activity = newValue;
  transitionEvent(citizen, 'activity', oldValue, newValue, tick, reason);
  return true;
}

export function vocationForBuilding(building) {
  return building ? VOCATION_BY_BUILDING[building.type] || null : null;
}

export function citizenConstructionRequiresStaff(type) {
  if (!BUILDINGS[type]) throw new TypeError(`Unknown construction building type: ${type}`);
  return !REALM_LAID_CONSTRUCTION_TYPES.has(type);
}

export function citizenStaffingCapacity(building) {
  if (!building || typeof building !== 'object' || !BUILDINGS[building.type]) {
    throw new TypeError('Citizen staffing capacity requires a known building.');
  }
  if (typeof building.buildProgress !== 'number' || !Number.isFinite(building.buildProgress)) {
    throw new TypeError('Citizen staffing capacity requires finite build progress.');
  }
  if (building.buildProgress < 1) {
    return citizenConstructionRequiresStaff(building.type) ? CONSTRUCTION_STAFF_LIMIT : 0;
  }
  return BUILDINGS[building.type].workers || 0;
}

export function assignmentPurposeForProfession(professionKind, building) {
  if (!PROFESSION_SET.has(professionKind)) {
    throw new TypeError(`Unknown citizen profession: ${professionKind}`);
  }
  if (!building || typeof building !== 'object' || !BUILDINGS[building.type]) {
    throw new TypeError('Assignment purpose requires a known building.');
  }
  if (building.buildProgress < 1) return 'temporary';
  const vocation = vocationForBuilding(building);
  if (!vocation) return 'temporary';
  return professionKind === 'settler' || professionKind === vocation
    ? 'vocation'
    : 'temporary';
}

export function assignmentPurposeForCitizen(citizen, building) {
  assertCitizen(citizen);
  assertLiveBuilding(building);
  return assignmentPurposeForProfession(citizen.profession.kind, building);
}

export function assignmentDutyForBuilding(building) {
  assertLiveBuilding(building);
  return building.buildProgress < 1 ? 'construction' : building.type;
}

function rebuildStaffingIndex() {
  const index = new Map();
  const ordered = [...G.citizens].sort((a, b) => a.actorId - b.actorId);
  for (const citizen of ordered) {
    const building = citizen.assignment?.building;
    if (!building) continue;
    const workers = index.get(building);
    if (workers) workers.push(citizen);
    else index.set(building, [citizen]);
  }
  for (const [building, workers] of index) index.set(building, Object.freeze(workers));
  staffingIndex = index;
  staffingRevision = assignmentRevision;
  staffingCitizens = G.citizens;
}

function ensureStaffingIndex() {
  if (staffingRevision !== assignmentRevision || staffingCitizens !== G.citizens) {
    rebuildStaffingIndex();
  }
}

export function workersForBuilding(building) {
  ensureStaffingIndex();
  return staffingIndex.get(building) || Object.freeze([]);
}

export function staffingCount(building) {
  return workersForBuilding(building).length;
}

export function getAssignmentRevision() {
  return assignmentRevision;
}

export function resetCitizenOwnershipRuntime() {
  assignmentRevision++;
  staffingRevision = -1;
  staffingCitizens = null;
  staffingIndex = new Map();
}

function prepareAssignment(citizen, building, { duty, purpose, reason }) {
  assertCitizen(citizen);
  assertLiveBuilding(building);
  assertReason(reason, ASSIGNMENT_CLAIM_REASON_SET, 'assignment claim');
  if (building.workforcePriority === 'off' && reason !== 'player-command') {
    throw new RangeError(`${building.type}@${building.x},${building.y} is closed to automatic staffing.`);
  }
  if (!['vocation', 'temporary'].includes(purpose)) {
    throw new TypeError(`Unknown assignment purpose: ${purpose}`);
  }
  if (typeof duty !== 'string' || duty.length < 1 || duty.length > 40) {
    throw new TypeError('Assignment duty must be a bounded non-empty string.');
  }
  const expectedPurpose = assignmentPurposeForCitizen(citizen, building);
  if (purpose !== expectedPurpose) {
    throw new TypeError(`Assignment purpose '${purpose}' disagrees with ownership policy '${expectedPurpose}'.`);
  }
  const expectedDuty = assignmentDutyForBuilding(building);
  if (duty !== expectedDuty) {
    throw new TypeError(`Assignment duty '${duty}' disagrees with building duty '${expectedDuty}'.`);
  }
  const capacity = citizenStaffingCapacity(building);
  if (capacity < 1) throw new RangeError(`${building.type} has no citizen staffing capacity.`);
  const currentWorkers = workersForBuilding(building);
  const alreadyHere = citizen.assignment?.building === building;
  if (!alreadyHere && currentWorkers.length >= capacity) {
    throw new RangeError(`${building.type}@${building.x},${building.y} is fully staffed.`);
  }
  const tick = currentTick();
  return {
    assignment: {
      kind: 'work',
      building,
      duty,
      purpose,
      sinceTick: tick,
      reason,
    },
    profession: citizen.profession.kind === 'settler' && purpose === 'vocation'
      ? {
          kind: vocationForBuilding(building),
          sinceTick: tick,
          reason: 'first-vocation',
        }
      : null,
    tick,
  };
}

export function claimCitizenAssignment(citizen, building, {
  duty = assignmentDutyForBuilding(building),
  purpose = assignmentPurposeForCitizen(citizen, building),
  reason = building.buildProgress < 1 ? 'construction' : 'job-market',
} = {}) {
  const prepared = prepareAssignment(citizen, building, { duty, purpose, reason });
  const oldAssignment = citizen.assignment;
  if (
    oldAssignment?.building === building
    && oldAssignment.duty === duty
    && oldAssignment.purpose === purpose
  ) {
    return false;
  }

  const oldProfession = citizen.profession;
  citizen.assignment = prepared.assignment;
  if (prepared.profession) citizen.profession = prepared.profession;
  assignmentRevision++;

  if (prepared.profession) {
    transitionEvent(
      citizen,
      'profession',
      oldProfession,
      prepared.profession,
      prepared.tick,
      prepared.profession.reason,
    );
  }
  transitionEvent(
    citizen,
    'assignment',
    oldAssignment,
    prepared.assignment,
    prepared.tick,
    reason,
  );
  return true;
}

export function releaseCitizenAssignment(citizen, reason) {
  assertCitizen(citizen);
  assertReason(reason, ASSIGNMENT_RELEASE_REASON_SET, 'assignment release');
  if (citizen.assignment === null) return false;
  const tick = currentTick();
  const oldValue = citizen.assignment;
  citizen.assignment = null;
  assignmentRevision++;
  transitionEvent(citizen, 'assignment', oldValue, null, tick, reason);
  return true;
}

export function removeCitizenFromWorld(citizen, reason = 'citizen-removed') {
  assertCitizen(citizen);
  assertReason(reason, ASSIGNMENT_RELEASE_REASON_SET, 'assignment release');
  const matches = G.citizens
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value === citizen);
  if (matches.length !== 1) {
    throw new RangeError(matches.length
      ? `Citizen actorId ${citizen.actorId} appears more than once in the live collection.`
      : `Citizen actorId ${citizen.actorId} is not live.`);
  }
  releaseCitizenAssignment(citizen, reason);
  // Residence occupancy is derived from live citizen references. Clear the
  // departing actor's reference as part of the same ownership transition so
  // no caller can retain a removed citizen that still claims a realm home.
  citizen.home = null;
  if (G.selectedCitizenId === citizen.actorId) G.selectedCitizenId = null;
  G.citizens.splice(matches[0].index, 1);
  G.population = G.citizens.length;
  return citizen;
}

export function releaseAssignmentsForBuilding(building, reason = 'building-removed') {
  assertLiveBuilding(building);
  const citizens = [...workersForBuilding(building)];
  for (const citizen of citizens) releaseCitizenAssignment(citizen, reason);
  return citizens;
}

export function findCitizenByActorId(actorId) {
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw new TypeError('Citizen lookup requires a positive safe actorId.');
  }
  const matches = G.citizens.filter(citizen => citizen.actorId === actorId);
  if (matches.length !== 1) {
    throw new RangeError(matches.length ? `Duplicate citizen actorId ${actorId}.` : `Missing citizen actorId ${actorId}.`);
  }
  return matches[0];
}

export function findBuildingByLocator(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new TypeError('Building lookup requires exact integer coordinates.');
  }
  const matches = G.buildings.filter(building => building.x === x && building.y === y);
  if (matches.length !== 1) {
    throw new RangeError(matches.length ? `Duplicate building locator ${x},${y}.` : `Missing building locator ${x},${y}.`);
  }
  return matches[0];
}

function clearCommandWorkIntent(citizen) {
  citizen.workTarget = null;
  citizen.path = null;
  citizen.pathIdx = 0;
  delete citizen._requestedTx;
  delete citizen._requestedTy;
  citizen._pathGoal = null;
  citizen._pathStartedAt = null;
  citizen._stuckTicks = 0;
  citizen._wdBest = null;
  citizen._wdTicks = 0;
}

export function commandAssignCitizen(actorId, x, y) {
  const citizen = findCitizenByActorId(actorId);
  const building = findBuildingByLocator(x, y);
  const changed = claimCitizenAssignment(citizen, building, {
    duty: assignmentDutyForBuilding(building),
    purpose: assignmentPurposeForCitizen(citizen, building),
    reason: 'player-command',
  });
  if (!changed) return { ok: false, reason: 'already-assigned' };
  clearCommandWorkIntent(citizen);
  transitionCitizenActivity(citizen, 'walk_to_work', 'player-command');
  citizen.activityTimer = 0;
  return { ok: true };
}

export function commandReleaseCitizen(actorId) {
  const citizen = findCitizenByActorId(actorId);
  const changed = releaseCitizenAssignment(citizen, 'player-command');
  if (!changed) return { ok: false, reason: 'not-assigned' };
  clearCommandWorkIntent(citizen);
  transitionCitizenActivity(citizen, 'idle', 'player-command');
  citizen.activityTimer = 0;
  return { ok: true };
}

export function validateCitizenOwnership(citizen, buildings = new Set(G.buildings)) {
  try {
    assertCitizen(citizen);
    assertExactRecordKeys(citizen.identity, ['name', 'appearanceId'], 'Citizen identity');
    assertExactRecordKeys(citizen.profession, ['kind', 'sinceTick', 'reason'], 'Citizen profession');
    assertExactRecordKeys(citizen.activity, ['kind', 'sinceTick', 'reason'], 'Citizen activity');
    if (!Object.hasOwn(citizen, 'assignment')) {
      throw new TypeError('Citizen ownership is missing assignment.');
    }
    if (citizen.assignment !== null && (!citizen.assignment || typeof citizen.assignment !== 'object')) {
      throw new TypeError('Citizen assignment must be null or an object.');
    }
    assertName(citizen.identity.name);
    assertAppearanceId(citizen.identity.appearanceId);
    if (!PROFESSION_SET.has(citizen.profession.kind)) throw new TypeError('Unknown profession.');
    if (!ACTIVITY_SET.has(citizen.activity.kind)) throw new TypeError('Unknown activity.');
    assertReason(citizen.profession.reason, PROFESSION_REASON_SET, 'profession');
    assertReason(citizen.activity.reason, ACTIVITY_REASON_SET, 'activity');
    const expectedProfessionReason = citizen.profession.kind === 'settler'
      ? 'spawn-settler'
      : 'first-vocation';
    if (citizen.profession.reason !== expectedProfessionReason) {
      throw new TypeError('Citizen profession and establishment reason disagree.');
    }
    for (const record of [citizen.profession, citizen.activity]) {
      if (!Number.isSafeInteger(record.sinceTick) || record.sinceTick < 0 || record.sinceTick > G.gameTick) {
        throw new RangeError('Ownership transition tick is outside the current timeline.');
      }
    }
    if (citizen.assignment !== null) {
      assertExactRecordKeys(
        citizen.assignment,
        ['kind', 'building', 'duty', 'purpose', 'sinceTick', 'reason'],
        'Citizen assignment',
      );
      if (!buildings.has(citizen.assignment.building)) throw new TypeError('Assignment building is not live.');
      if (
        typeof citizen.assignment.building.type !== 'string'
        || !Object.hasOwn(BUILDINGS, citizen.assignment.building.type)
      ) {
        throw new TypeError('Assignment building requires a known string type.');
      }
      if (
        typeof citizen.assignment.duty !== 'string'
        || citizen.assignment.duty.length < 1
        || citizen.assignment.duty.length > 40
      ) {
        throw new TypeError('Assignment duty must be a bounded string.');
      }
      assertReason(citizen.assignment.reason, ASSIGNMENT_CLAIM_REASON_SET, 'assignment claim');
      if (!Number.isSafeInteger(citizen.assignment.sinceTick) || citizen.assignment.sinceTick < 0 || citizen.assignment.sinceTick > G.gameTick) {
        throw new RangeError('Assignment tick is outside the current timeline.');
      }
      if (citizen.assignment.kind !== 'work') throw new TypeError('Unknown assignment kind.');
      if (!['vocation', 'temporary'].includes(citizen.assignment.purpose)) throw new TypeError('Unknown assignment purpose.');
      if (citizen.assignment.duty !== (citizen.assignment.building.buildProgress < 1 ? 'construction' : citizen.assignment.building.type)) {
        throw new TypeError('Assignment duty disagrees with its building.');
      }
      const expectedPurpose = assignmentPurposeForProfession(
        citizen.profession.kind,
        citizen.assignment.building,
      );
      if (citizen.assignment.purpose !== expectedPurpose) {
        throw new TypeError('Assignment purpose disagrees with citizen profession and building state.');
      }
      if (citizenStaffingCapacity(citizen.assignment.building) < 1) {
        throw new TypeError('Assignment building has no citizen staffing capacity.');
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
