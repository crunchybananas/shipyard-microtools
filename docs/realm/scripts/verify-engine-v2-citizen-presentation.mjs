#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G } from '../js/state.js?realm=172';
import {
  CITIZEN_APPEARANCE_IDS,
  createCitizenOwnership,
} from '../js/citizen-ownership.js?realm=172';
import {
  buildCitizenPresentation,
  presentationActionForActivity,
  presentationVariantForIdentity,
} from '../js/citizen-presentation.js?realm=172';
import {
  citizenRenderCacheSize,
  citizenRenderRecord,
  pruneCitizenRenderCache,
  resetCitizenRenderCache,
} from '../js/citizen-render-cache.js?realm=172';

globalThis.location ||= new URL('http://127.0.0.1/index.html');
const { actorAnimationFrame } = await import('../js/render.js?realm=172');

G.gameTick = 12;
G.nextActorId = 1;
const ownership = createCitizenOwnership('Frozen Renderer');
const citizen = {
  ...ownership,
  x: 4,
  y: 5,
  tx: 6,
  ty: 5,
  speed: 0.02,
  carrying: null,
  carryAmount: 0,
  hunger: 10,
  rest: 90,
  needs: { joy: 55, faith: 55 },
  home: null,
  activityTimer: 0,
  path: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
  pathIdx: 0,
  faceX: 1,
  faceZ: 0,
};
const before = structuredClone(citizen);
const snapshot = buildCitizenPresentation(citizen, { selectedActorId: citizen.actorId });
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(Object.isFrozen(snapshot.identity), true);
assert.equal(Object.isFrozen(snapshot.pathRemaining), true);
assert.equal(Object.isFrozen(snapshot.needs), true);
assert.equal(snapshot.variant, 'settler');
assert.equal(snapshot.waitAge, 0);
assert.equal(presentationActionForActivity(snapshot.activity.kind, snapshot.carrying, true), 'walk');
assert.throws(
  () => presentationActionForActivity('teleporting', null, true),
  /No citizen presentation action/,
);

const hostileActivity = structuredClone(citizen);
hostileActivity.activity.kind = 'teleporting';
assert.throws(
  () => buildCitizenPresentation(hostileActivity),
  /cannot cross the presentation boundary/,
);
const hostileIdentity = structuredClone(citizen);
hostileIdentity.identity.legacyAlias = 'retired';
assert.throws(
  () => buildCitizenPresentation(hostileIdentity),
  /cannot cross the presentation boundary/,
);
const missingAssignment = structuredClone(citizen);
delete missingAssignment.assignment;
assert.throws(
  () => buildCitizenPresentation(missingAssignment),
  /cannot cross the presentation boundary/,
);
const unknownAppearance = structuredClone(citizen);
unknownAppearance.identity.appearanceId = 'identity-03';
assert.throws(
  () => buildCitizenPresentation(unknownAppearance),
  /cannot cross the presentation boundary/,
);
assert.throws(
  () => presentationVariantForIdentity('identity-03', 'miner'),
  /No citizen presentation appearance/,
);

for (const appearanceId of CITIZEN_APPEARANCE_IDS) {
  const currentArtMiner = structuredClone(citizen);
  currentArtMiner.identity.appearanceId = appearanceId;
  currentArtMiner.profession = {
    kind: 'miner',
    sinceTick: 0,
    reason: 'first-vocation',
  };
  const minerSnapshot = buildCitizenPresentation(currentArtMiner);
  assert.equal(minerSnapshot.identity.appearanceId, appearanceId);
  assert.equal(minerSnapshot.variant, 'miner', `${appearanceId} changed current miner role semantics`);
}

const liveFarm = { type: 'farm', x: 8, y: 8, buildProgress: 1 };
G.buildings = [liveFarm];
const assignedCitizen = {
  ...structuredClone(citizen),
  profession: { kind: 'farmer', sinceTick: 0, reason: 'first-vocation' },
  assignment: {
    kind: 'work',
    building: liveFarm,
    duty: 'farm',
    purpose: 'vocation',
    sinceTick: 0,
    reason: 'job-market',
  },
};
assert.equal(buildCitizenPresentation(assignedCitizen).assignment.building.type, 'farm');
const coercibleFarmKey = { toString() { return 'farm'; } };
const hostileDutyReference = {
  ...assignedCitizen,
  assignment: { ...assignedCitizen.assignment, duty: coercibleFarmKey },
};
assert.throws(
  () => buildCitizenPresentation(hostileDutyReference),
  /cannot cross the presentation boundary/,
  'object-valued assignment duty crossed by string coercion',
);
const hostileTypeBuilding = { ...liveFarm, type: coercibleFarmKey };
G.buildings = [hostileTypeBuilding];
const hostileBuildingTypeReference = {
  ...assignedCitizen,
  assignment: {
    ...assignedCitizen.assignment,
    building: hostileTypeBuilding,
    duty: coercibleFarmKey,
  },
};
assert.throws(
  () => buildCitizenPresentation(hostileBuildingTypeReference),
  /cannot cross the presentation boundary/,
  'object-valued building type crossed by string coercion',
);
G.buildings = [];

for (const [label, mutate] of [
  ['object-valued position', value => { value.x = { tile: 4 }; }],
  ['object-valued cargo', value => { value.carrying = { kind: 'wood' }; }],
  ['malformed path point', value => { value.path[0].x = '5'; }],
  ['malformed needs', value => { value.needs = { joy: 55, faith: { value: 55 } }; }],
  ['negative wait age', value => { value._stuckTicks = -1; }],
]) {
  const hostile = structuredClone(citizen);
  mutate(hostile);
  assert.throws(
    () => buildCitizenPresentation(hostile),
    undefined,
    `${label} crossed the presentation boundary`,
  );
}
const waitingCitizen = structuredClone(citizen);
waitingCitizen._stuckTicks = 7;
const waitingSnapshot = buildCitizenPresentation(waitingCitizen);
assert.equal(waitingSnapshot.waitAge, 7);
assert.equal(Object.isFrozen(waitingSnapshot), true);

resetCitizenRenderCache();
assert.equal(actorAnimationFrame(snapshot, snapshot.variant, 'walk', { isMoving: true }), 0);
G.gameTick += 7;
assert.equal(actorAnimationFrame(snapshot, snapshot.variant, 'walk', { isMoving: true }), 1);
assert.deepEqual(citizen, before, 'render animation must not mutate the simulation citizen');
assert.equal(Object.hasOwn(citizen, '_actorAnimationKey'), false);
assert.equal(citizenRenderCacheSize(), 1);

citizenRenderRecord(9);
assert.equal(citizenRenderCacheSize(), 2);
assert.equal(pruneCitizenRenderCache([citizen.actorId]), 1);
assert.equal(pruneCitizenRenderCache([]), 0);

console.log('[citizen-presentation] OK — frozen snapshots and bounded renderer-owned continuity');
