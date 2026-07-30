#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, getSeed, setSeed } from '../js/state.js?realm=171';
import { makeCitizen } from '../js/world.js?realm=171';
import { dispatch } from '../js/commands.js?realm=171';
import {
  claimCitizenAssignment,
  commandAssignCitizen,
  createCitizenOwnership,
  getAssignmentRevision,
  onCitizenTransition,
  releaseCitizenAssignment,
  removeCitizenFromWorld,
  renameCitizen,
  resetCitizenOwnershipRuntime,
  staffingCount,
  transitionCitizenActivity,
  validateCitizenOwnership,
  workersForBuilding,
} from '../js/citizen-ownership.js?realm=171';

function reset() {
  G.gameTick = 0;
  G.nextActorId = 1;
  G.citizens = [];
  G.buildings = [];
  resetCitizenOwnershipRuntime();
}

function building(type, x, y, buildProgress = 1) {
  const value = { type, x, y, buildProgress };
  G.buildings.push(value);
  return value;
}

function citizen(name) {
  const value = createCitizenOwnership(name);
  G.citizens.push(value);
  return value;
}

reset();
const events = [];
const stop = onCitizenTransition(event => events.push(event));
const ada = citizen('Ada Stone');
const bjorn = citizen('Bjorn Brook');
assert.deepEqual([ada.actorId, bjorn.actorId, G.nextActorId], [1, 2, 3]);
assert.notEqual(ada.identity.appearanceId, bjorn.identity.appearanceId);

const mine = building('mine', 10, 11);
assert.equal(commandAssignCitizen(ada.actorId, 10, 11).ok, true);
assert.equal(ada.profession.kind, 'miner');
assert.equal(ada.assignment.purpose, 'vocation');
assert.equal(staffingCount(mine), 1);
assert.deepEqual(workersForBuilding(mine).map(value => value.actorId), [1]);

const revisionAfterClaim = getAssignmentRevision();
assert.deepEqual(commandAssignCitizen(ada.actorId, 10, 11), { ok: false, reason: 'already-assigned' });
assert.equal(getAssignmentRevision(), revisionAfterClaim);
assert.equal(events.filter(event => event.field === 'assignment').length, 1);

assert.equal(claimCitizenAssignment(bjorn, mine), true);
assert.equal(staffingCount(mine), 2, 'same-tick derived staffing must see the second claim');
assert.throws(() => {
  const third = citizen('Celia Field');
  claimCitizenAssignment(third, mine);
}, /fully staffed/);

const site = building('farm', 12, 11, 0.5);
assert.equal(claimCitizenAssignment(ada, site), true);
assert.equal(ada.assignment.purpose, 'temporary');
assert.equal(ada.assignment.duty, 'construction');
assert.equal(ada.profession.kind, 'miner', 'temporary construction must not morph vocation');
assert.equal(staffingCount(mine), 1);
assert.equal(staffingCount(site), 1);
assert.throws(
  () => claimCitizenAssignment(ada, site, { reason: 'citizen-removed' }),
  /Unknown assignment claim transition reason/,
);

G.gameTick = 8;
assert.equal(transitionCitizenActivity(ada, 'working', 'arrived-at-work'), true);
const activitySince = ada.activity.sinceTick;
assert.equal(transitionCitizenActivity(ada, 'working', 'arrived-at-work'), false);
assert.equal(ada.activity.sinceTick, activitySince);

const identityBefore = {
  actorId: ada.actorId,
  appearanceId: ada.identity.appearanceId,
  profession: ada.profession,
  assignment: ada.assignment,
  activity: ada.activity,
};
assert.equal(renameCitizen(ada, 'Realm Namesake', 'story-namesake'), true);
assert.equal(ada.actorId, identityBefore.actorId);
assert.equal(ada.identity.appearanceId, identityBefore.appearanceId);
assert.equal(ada.profession, identityBefore.profession);
assert.equal(ada.assignment, identityBefore.assignment);
assert.equal(ada.activity, identityBefore.activity);

const assignmentEvent = events.find(event => event.field === 'assignment' && event.newValue?.building);
assert.ok(assignmentEvent);
assert.equal(Object.isFrozen(assignmentEvent), true);
assert.equal(Object.isFrozen(assignmentEvent.newValue), true);
assert.equal(Object.isFrozen(assignmentEvent.newValue.building), true);
assert.notEqual(assignmentEvent.newValue.building, mine);
assert.deepEqual(assignmentEvent.newValue.building, { type: 'mine', x: 10, y: 11 });

assert.equal(releaseCitizenAssignment(ada, 'path-unreachable'), true);
assert.equal(ada.assignment, null);
assert.equal(ada.profession.kind, 'miner');
assert.equal(staffingCount(site), 0);
assert.throws(
  () => releaseCitizenAssignment(bjorn, 'job-market'),
  /Unknown assignment release transition reason/,
);

G.citizens = G.citizens.filter(value => value !== bjorn);
const next = citizen('Dag Dale');
assert.equal(next.actorId, 4, 'actor IDs must not be reused after removal');

const stateBeforeOverflow = {
  nextActorId: G.nextActorId,
  citizenCount: G.citizens.length,
};
G.nextActorId = next.actorId;
setSeed(0x24680);
const seedBeforeAllocatorCollision = getSeed();
assert.throws(() => makeCitizen(4, 5), /greater than every live citizen/);
assert.equal(getSeed(), seedBeforeAllocatorCollision, 'allocator collision consumed gameplay RNG');
assert.equal(G.nextActorId, next.actorId);
G.nextActorId = stateBeforeOverflow.nextActorId;

G.citizens.push(ada);
assert.throws(() => createCitizenOwnership('Duplicate Live Probe'), /appears more than once|Duplicate live/);
G.citizens.pop();
assert.equal(G.nextActorId, stateBeforeOverflow.nextActorId);

G.nextActorId = Number.MAX_SAFE_INTEGER;
assert.throws(() => createCitizenOwnership('Overflow Probe'), /exhausted/);
assert.equal(G.nextActorId, Number.MAX_SAFE_INTEGER);
assert.equal(G.citizens.length, stateBeforeOverflow.citizenCount);
setSeed(0x13579);
const seedBeforeRejectedSpawn = getSeed();
assert.throws(() => makeCitizen(4, 5), /exhausted/);
assert.equal(getSeed(), seedBeforeRejectedSpawn, 'rejected spawn consumed gameplay RNG');
assert.equal(G.nextActorId, Number.MAX_SAFE_INTEGER);
assert.equal(G.citizens.length, stateBeforeOverflow.citizenCount);

reset();
const commandCitizen = citizen('Command Tick Probe');
const commandFarm = building('farm', 20, 21);
G._commandLog = [];
G.gameTick = 17;
const acceptedCommand = {
  type: 'ASSIGN_CITIZEN',
  actorId: commandCitizen.actorId,
  x: commandFarm.x,
  y: commandFarm.y,
  tick: 999999,
};
assert.deepEqual(
  dispatch(acceptedCommand),
  { ok: true },
);
assert.deepEqual(G._commandLog.at(-1), {
  type: 'ASSIGN_CITIZEN',
  actorId: commandCitizen.actorId,
  x: commandFarm.x,
  y: commandFarm.y,
  tick: 17,
});
assert.equal(Object.isFrozen(G._commandLog.at(-1)), true, 'accepted command log record stayed mutable');
acceptedCommand.actorId = Number.MAX_SAFE_INTEGER;
assert.equal(
  G._commandLog.at(-1).actorId,
  commandCitizen.actorId,
  'accepted command log retained the caller object',
);

const logLengthBeforeUnknown = G._commandLog.length;
const cyclicExtra = { label: 'must-never-enter-command-log' };
cyclicExtra.self = cyclicExtra;
assert.deepEqual(
  dispatch({
    type: 'RELEASE_CITIZEN',
    actorId: commandCitizen.actorId,
    extra: cyclicExtra,
  }),
  { ok: false, reason: 'unknown-command-field', field: 'extra' },
);
assert.equal(commandCitizen.assignment?.building, commandFarm, 'unknown command field reached its handler');
assert.equal(G._commandLog.length, logLengthBeforeUnknown, 'rejected cyclic extra entered command log');
assert.doesNotThrow(() => JSON.stringify(G._commandLog), 'accepted command log is not replay-serializable');

const cyclicActorId = {};
cyclicActorId.self = cyclicActorId;
assert.deepEqual(
  dispatch({ type: 'RELEASE_CITIZEN', actorId: cyclicActorId }),
  { ok: false, reason: 'invalid-command-field', field: 'actorId' },
);
assert.equal(commandCitizen.assignment?.building, commandFarm, 'object-valued actorId reached its handler');
assert.equal(G._commandLog.length, logLengthBeforeUnknown);

let listenerAfterFailureRan = false;
const originalConsoleError = console.error;
const stopThrowingListener = onCitizenTransition(() => {
  throw new Error('intentional observer failure');
});
const stopTrailingListener = onCitizenTransition(() => {
  listenerAfterFailureRan = true;
});
try {
  console.error = () => {};
  assert.doesNotThrow(() => {
    transitionCitizenActivity(commandCitizen, 'working', 'arrived-at-work');
  });
} finally {
  console.error = originalConsoleError;
  stopThrowingListener();
  stopTrailingListener();
}
assert.equal(listenerAfterFailureRan, true, 'throwing observer prevented later transition observers');

const road = building('road', 22, 21, 0.25);
assert.throws(
  () => claimCitizenAssignment(commandCitizen, road, { reason: 'player-command' }),
  /no citizen staffing capacity/,
);
assert.equal(commandCitizen.assignment?.building, commandFarm);

commandCitizen.profession.reason = 'spawn-settler';
assert.equal(validateCitizenOwnership(commandCitizen).ok, false, 'mismatched profession reason was accepted');
commandCitizen.profession.reason = 'first-vocation';
G.selectedCitizenId = commandCitizen.actorId;
const populationBeforeRemoval = G.population = G.citizens.length;
removeCitizenFromWorld(commandCitizen);
assert.equal(G.citizens.includes(commandCitizen), false);
assert.equal(G.population, populationBeforeRemoval - 1);
assert.equal(G.selectedCitizenId, null, 'citizen removal retained a dead selection');
assert.equal(staffingCount(commandFarm), 0);

stop();
console.log('[citizen-ownership] OK — stable IDs, atomic causal ownership, and same-tick derived staffing');
