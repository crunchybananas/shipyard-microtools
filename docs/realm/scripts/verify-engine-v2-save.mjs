#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, getSeed, setSeed } from '../js/state.js?realm=197';
import { generateWorld, makeCitizen } from '../js/world.js?realm=197';
import { coreTick } from '../js/sim.js?realm=197';
import { removeBuilding, undoLastBuildingPlacement } from '../js/building-lifecycle.js?realm=197';
import { missions } from '../js/missions.js?realm=197';
import { initChronicle } from '../js/log.js?realm=197';
import {
  commitGameLoad,
  commitGameLoadForTest,
  prepareSave,
  serializeGame,
} from '../js/save-state.js?realm=197';
import { hasSave, loadGame, saveGame } from '../js/save.js?realm=197';
import { decodeGraphState, encodeGraphState, SAVE_KEY, validateSave } from '../js/save-schema.js?realm=197';
import { establishFounderStockpile } from '../js/building-inventory.js?realm=197';
import {
  claimCitizenAssignment,
  renameCitizen,
  transitionCitizenActivity,
  workersForBuilding,
} from '../js/citizen-ownership.js?realm=197';
import {
  citizenRenderCacheSize,
  citizenRenderRecord,
  resetCitizenRenderCache,
} from '../js/citizen-render-cache.js?realm=197';
import {
  getCitizenTransitionLedger,
  initCitizenInspector,
  resetCitizenTransitionLedger,
} from '../js/citizen-inspector.js?realm=197';

function clone(value) {
  return structuredClone(value);
}

function nodeFor(envelope, reference) {
  assert.equal(reference?.$, 'ref');
  return envelope.state.nodes[reference.id];
}

function objectValue(envelope, objectReference, key) {
  const node = nodeFor(envelope, objectReference);
  assert.equal(node.kind, 'object');
  const entry = node.entries.find(([name]) => name === key);
  assert.ok(entry, `missing encoded field ${key}`);
  return entry[1];
}

function replaceObjectValue(envelope, objectReference, key, value) {
  const node = nodeFor(envelope, objectReference);
  const entry = node.entries.find(([name]) => name === key);
  assert.ok(entry, `missing encoded field ${key}`);
  entry[1] = value;
}

function collectionItem(envelope, gameKey, index = 0) {
  const collection = nodeFor(envelope, objectValue(envelope, envelope.state.roots.game, gameKey));
  assert.ok(collection.items[index], `missing encoded ${gameKey}[${index}]`);
  return collection.items[index];
}

function nestedObjectReference(envelope, ownerReference, key) {
  const reference = objectValue(envelope, ownerReference, key);
  assert.equal(reference?.$, 'ref', `${key} must be an encoded object reference`);
  return reference;
}

function injectObjectValue(envelope, objectReference, key, value) {
  const node = nodeFor(envelope, objectReference);
  assert.equal(node.entries.some(([name]) => name === key), false, `encoded field ${key} already exists`);
  node.entries.push([key, value]);
}

function deleteObjectValue(envelope, objectReference, key) {
  const node = nodeFor(envelope, objectReference);
  const before = node.entries.length;
  node.entries = node.entries.filter(([name]) => name !== key);
  assert.equal(node.entries.length, before - 1, `missing encoded field ${key}`);
}

function injectDetachedProjectileTarget(envelope) {
  const targetId = envelope.state.nodes.length;
  envelope.state.nodes.push({
    kind: 'object',
    entries: [['x', 4], ['y', 4], ['hp', 10], ['arbitraryNestedState', true]],
  });
  const projectileId = envelope.state.nodes.length;
  envelope.state.nodes.push({
    kind: 'object',
    entries: [
      ['x', 1], ['y', 1], ['tx', 4], ['ty', 4],
      ['target', { $: 'ref', id: targetId }], ['damage', 8], ['life', 20], ['type', 'arrow'],
    ],
  });
  const projectiles = nodeFor(envelope, objectValue(envelope, envelope.state.roots.game, 'projectiles'));
  projectiles.items.push({ $: 'ref', id: projectileId });
}

function liveSentinel() {
  return {
    bytes: JSON.stringify(serializeGame()),
    seed: getSeed(),
    map: G.map,
    fog: G.fog,
    buildings: G.buildings,
    citizens: G.citizens,
    grid: G.buildingGrid,
    avatar: G.avatar,
    rootEntries: Object.entries(G),
    missionValues: missions.map(mission => [mission.done, mission._celebratedTick]),
  };
}

function assertUnchanged(before, label) {
  assert.equal(JSON.stringify(serializeGame()), before.bytes, `${label}: serialized live world changed`);
  assert.equal(getSeed(), before.seed, `${label}: RNG changed`);
  assert.equal(G.map, before.map, `${label}: map identity changed`);
  assert.equal(G.fog, before.fog, `${label}: fog identity changed`);
  assert.equal(G.buildings, before.buildings, `${label}: buildings identity changed`);
  assert.equal(G.citizens, before.citizens, `${label}: citizens identity changed`);
  assert.equal(G.buildingGrid, before.grid, `${label}: grid identity changed`);
  assert.equal(G.avatar, before.avatar, `${label}: avatar identity changed`);
  assert.deepEqual(Object.keys(G), before.rootEntries.map(([key]) => key), `${label}: root key order changed`);
  for (const [key, value] of before.rootEntries) {
    assert.equal(G[key], value, `${label}: root field ${key} changed`);
  }
  assert.deepEqual(missions.map(mission => [mission.done, mission._celebratedTick]), before.missionValues, `${label}: missions changed`);
}

setSeed(8675309);
generateWorld();
initChronicle();

// Give the golden fixture real linked relationships so graph/reference checks
// exercise building-grid and actor-owned citizen assignment links.
const citizen = G.citizens[0];
const building = {
  type: 'farm', x: 39, y: 39, hp: 100, prodTimer: 17, level: 1,
  buildProgress: 1, buildTotal: 1, active: true, produced: null,
  buildStartedAt: 0, prodShowCount: 0, visits: {}, trainTimer: 0,
};
G.buildings.push(building);
G.buildingGrid[building.y][building.x] = building;
G.armyGuardPoint = { x: building.x, y: building.y };
G.armyStance = 'guard';
G.armyObjective = { x: 42, y: 42, mode: 'attack-move' };
establishFounderStockpile();
assert.equal(claimCitizenAssignment(citizen, building, { reason: 'job-market' }), true);
assert.deepEqual(workersForBuilding(building), [citizen]);
assert.equal(Object.hasOwn(building, 'workers'), false);
citizen.home = null;
const sharedPath = [{ x: 40, y: 40 }, { x: 41, y: 40 }];
sharedPath.goal = { x: 41, y: 40 };
citizen.path = sharedPath;
citizen.pathIdx = 1;
G.avatar.path = sharedPath;
G.avatar.pathIdx = 1;
G._undoStack = [{ b: building, flagsSnapshot: { physicalFoodInventory: true }, chronicleLen: 0 }];
missions[0].done = true;
missions[0]._celebratedTick = 42;

// Arrows whose enemy already left the live collection retain only the exact
// impact data updateProjectiles still consumes. This positive control pairs
// with the hostile arbitraryNestedState rejection below.
const detachedImpact = { x: 44, y: 40, hp: 0 };
G.projectiles.push({
  x: 42, y: 40, tx: 44, ty: 40,
  target: detachedImpact, damage: 8, life: 20, type: 'arrow',
});

const golden = serializeGame({ savedAt: 123456 });
assert.equal(validateSave(golden).ok, true, 'fresh writer output must satisfy structural schema');
const goldenPrepared = prepareSave(JSON.stringify(golden));
assert.equal(goldenPrepared.ok, true, goldenPrepared.error?.message);

const gameRef = golden.state.roots.game;
const mapRef = objectValue(golden, gameRef, 'map');
const seasonValue = objectValue(golden, gameRef, 'season');
assert.equal(seasonValue, 'spring');

// Mechanical root coverage: every admitted authoritative field must reject a
// deliberately wrong wire kind. This complements save-state's import-time
// allowed-key/validator registry equality check.
let rootWrongKindRejections = 0;
for (const [key, encoded] of nodeFor(golden, gameRef).entries) {
  const value = clone(golden);
  const wrongKind = encoded === null || typeof encoded === 'object'
    ? false
    : typeof encoded === 'number'
      ? 'wrong-kind'
      : typeof encoded === 'string'
        ? 0
        : 0;
  replaceObjectValue(value, value.state.roots.game, key, wrongKind);
  const result = prepareSave(value);
  assert.equal(result.ok, false, `${key}: wrong root kind bypassed its validator`);
  rootWrongKindRejections++;
}
assert.equal(rootWrongKindRejections, 75, 'authoritative root validator coverage changed without updating the gate');

const fixtures = [];
function fixture(name, mutate) {
  const value = clone(golden);
  mutate(value);
  fixtures.push([name, value]);
}

fixture('wrong schema', value => { value.schema = 'realm.not-engine-v2'; });
fixture('older save version', value => { value.saveVersion--; });
fixture('newer save version', value => { value.saveVersion++; });
fixture('older simulation version', value => { value.simulationVersion--; });
fixture('newer simulation version', value => { value.simulationVersion++; });
fixture('wrong system-order version', value => { value.coreSystemOrderVersion = 'sha256:wrong'; });
fixture('missing required field', value => { delete value.coreSystemOrderVersion; });
fixture('extra incompatible field', value => { value.legacy = true; });
fixture('unknown game root field', value => {
  nodeFor(value, value.state.roots.game).entries.push(['hitchhiker', true]);
});
fixture('missing initialized root field', value => {
  const node = nodeFor(value, value.state.roots.game);
  node.entries = node.entries.filter(([key]) => key !== 'citizens');
});
fixture('missing formerly lazy root field', value => {
  const node = nodeFor(value, value.state.roots.game);
  node.entries = node.entries.filter(([key]) => key !== '_moodDelta');
});
fixture('unknown citizen field', value => {
  injectObjectValue(value, collectionItem(value, 'citizens'), 'arbitraryBrain', true);
});
for (const legacyField of ['name', 'jobBuilding', 'visualJob', 'state', 'stateTimer']) {
  fixture(`removed citizen field ${legacyField}`, value => {
    injectObjectValue(value, collectionItem(value, 'citizens'), legacyField, true);
  });
}
fixture('removed reciprocal building workers field', value => {
  injectObjectValue(value, collectionItem(value, 'buildings'), 'workers', true);
});
fixture('identity unknown nested field', value => {
  const identity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'identity');
  injectObjectValue(value, identity, 'legacyAlias', 'forbidden');
});
fixture('identity missing required name', value => {
  const identity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'identity');
  deleteObjectValue(value, identity, 'name');
});
fixture('identity malformed appearance key', value => {
  const identity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'identity');
  replaceObjectValue(value, identity, 'appearanceId', '../legacy.svg');
});
fixture('identity unknown current-art appearance key', value => {
  const identity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'identity');
  replaceObjectValue(value, identity, 'appearanceId', 'identity-03');
});
fixture('citizen missing authoritative assignment field', value => {
  deleteObjectValue(value, collectionItem(value, 'citizens'), 'assignment');
});
fixture('profession unknown nested field', value => {
  const profession = nestedObjectReference(value, collectionItem(value, 'citizens'), 'profession');
  injectObjectValue(value, profession, 'temporaryRole', true);
});
fixture('profession invalid enum', value => {
  const profession = nestedObjectReference(value, collectionItem(value, 'citizens'), 'profession');
  replaceObjectValue(value, profession, 'kind', 'random-townsperson');
});
fixture('profession invalid causal reason', value => {
  const profession = nestedObjectReference(value, collectionItem(value, 'citizens'), 'profession');
  replaceObjectValue(value, profession, 'reason', 'observer-inferred');
});
fixture('profession kind and establishment reason disagree', value => {
  const profession = nestedObjectReference(value, collectionItem(value, 'citizens'), 'profession');
  replaceObjectValue(value, profession, 'reason', 'spawn-settler');
});
fixture('profession transition from the future', value => {
  const profession = nestedObjectReference(value, collectionItem(value, 'citizens'), 'profession');
  replaceObjectValue(value, profession, 'sinceTick', 1);
});
fixture('assignment unknown nested field', value => {
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  injectObjectValue(value, assignment, 'workerIndex', 0);
});
fixture('assignment invalid purpose', value => {
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  replaceObjectValue(value, assignment, 'purpose', 'accidental-retraining');
});
fixture('valid-enum assignment purpose disagrees with vocation', value => {
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  replaceObjectValue(value, assignment, 'purpose', 'temporary');
});
fixture('assignment invalid causal reason', value => {
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  replaceObjectValue(value, assignment, 'reason', 'renderer-guessed');
});
fixture('release-only reason stored as live assignment cause', value => {
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  replaceObjectValue(value, assignment, 'reason', 'citizen-removed');
});
fixture('assignment transition from the future', value => {
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  replaceObjectValue(value, assignment, 'sinceTick', 1);
});
fixture('activity unknown nested field', value => {
  const activity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'activity');
  injectObjectValue(value, activity, 'timer', 1);
});
fixture('activity invalid enum', value => {
  const activity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'activity');
  replaceObjectValue(value, activity, 'kind', 'teleporting');
});
fixture('activity invalid causal reason', value => {
  const activity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'activity');
  replaceObjectValue(value, activity, 'reason', 'observer-inferred');
});
fixture('activity transition from the future', value => {
  const activity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'activity');
  replaceObjectValue(value, activity, 'sinceTick', 1);
});
fixture('duplicate citizen actor ID', value => {
  const first = collectionItem(value, 'citizens', 0);
  const second = collectionItem(value, 'citizens', 1);
  replaceObjectValue(value, second, 'actorId', objectValue(value, first, 'actorId'));
});
fixture('citizen allocator not above live actor IDs', value => {
  replaceObjectValue(value, value.state.roots.game, 'nextActorId', citizen.actorId);
});
fixture('derived staffing exceeds building capacity', value => {
  const first = collectionItem(value, 'citizens', 0);
  const second = collectionItem(value, 'citizens', 1);
  replaceObjectValue(value, second, 'assignment', clone(objectValue(value, first, 'assignment')));
  const profession = nestedObjectReference(value, second, 'profession');
  replaceObjectValue(value, profession, 'kind', 'farmer');
  replaceObjectValue(value, profession, 'reason', 'first-vocation');
});
fixture('realm-laid road accepts no citizen construction assignment', value => {
  const encodedBuilding = collectionItem(value, 'buildings');
  replaceObjectValue(value, encodedBuilding, 'type', 'road');
  replaceObjectValue(value, encodedBuilding, 'buildProgress', 0.5);
  const assignment = nestedObjectReference(value, collectionItem(value, 'citizens'), 'assignment');
  replaceObjectValue(value, assignment, 'duty', 'construction');
  replaceObjectValue(value, assignment, 'purpose', 'temporary');
});
fixture('invalid dimensions', value => { nodeFor(value, objectValue(value, value.state.roots.game, 'map')).items.pop(); });
fixture('invalid tile enum', value => {
  const mapNode = nodeFor(value, objectValue(value, value.state.roots.game, 'map'));
  nodeFor(value, mapNode.items[0]).items[0] = 99;
});
fixture('non-finite number', value => { replaceObjectValue(value, value.state.roots.game, 'gameTick', Infinity); });
fixture('negative zero', value => { replaceObjectValue(value, value.state.roots.game, 'gameTick', -0); });
fixture('invalid enum', value => { replaceObjectValue(value, value.state.roots.game, 'season', 'monsoon'); });
fixture('population wrong scalar type', value => {
  replaceObjectValue(value, value.state.roots.game, 'population', 'three citizens');
});
fixture('population disagrees with citizen collection', value => {
  const citizens = nodeFor(value, objectValue(value, value.state.roots.game, 'citizens'));
  replaceObjectValue(value, value.state.roots.game, 'population', citizens.items.length + 1);
});
fixture('building active wrong scalar type', value => {
  const buildings = nodeFor(value, objectValue(value, value.state.roots.game, 'buildings'));
  replaceObjectValue(value, buildings.items[0], 'active', 'yes');
});
fixture('army stance enum', value => {
  replaceObjectValue(value, value.state.roots.game, 'armyStance', 'retreat');
});
fixture('company objective mode', value => {
  const objective = objectValue(value, value.state.roots.game, 'armyObjective');
  replaceObjectValue(value, objective, 'mode', 'teleport');
});
fixture('company supply readiness mismatch', value => {
  const supply = objectValue(value, value.state.roots.game, 'armySupply');
  replaceObjectValue(value, supply, 'readiness', 'starving');
});
fixture('sparse nested stats collection', value => {
  const stats = objectValue(value, value.state.roots.game, 'stats');
  const scenariosWon = nodeFor(value, objectValue(value, stats, 'scenariosWon'));
  scenariosWon.items.push({ $: 'hole' });
});
fixture('nested citizen needs scalar type', value => {
  const citizens = nodeFor(value, objectValue(value, value.state.roots.game, 'citizens'));
  const needs = objectValue(value, citizens.items[0], 'needs');
  replaceObjectValue(value, needs, 'joy', 'ecstatic');
});
fixture('initialized death-marker collection replaced with null', value => {
  replaceObjectValue(value, value.state.roots.game, 'deathMarkers', null);
});
fixture('active-realm avatar replaced with null', value => {
  replaceObjectValue(value, value.state.roots.game, 'avatar', null);
});
fixture('detached projectile target smuggles arbitrary state', injectDetachedProjectileTarget);
fixture('invalid graph reference', value => { value.state.roots.game.id = value.state.nodes.length; });
fixture('unreachable graph node', value => { value.state.nodes.push({ kind: 'object', entries: [] }); });
fixture('unsafe graph object key', value => { nodeFor(value, value.state.roots.game).entries.push(['constructor', true]); });
fixture('null-prototype wire node', value => { Object.setPrototypeOf(value.state.nodes[0], null); });
fixture('duplicate mission id', value => { value.state.roots.missions[1].id = value.state.roots.missions[0].id; });
fixture('unknown mission reference', value => { value.state.roots.missions[0].id = 'removed-mission'; });
fixture('legacy raw undo shape', value => {
  const undo = nodeFor(value, objectValue(value, value.state.roots.game, '_undoStack'));
  const entry = nodeFor(value, undo.items[0]);
  entry.entries = entry.entries.filter(([key]) => key !== 'flagsSnapshot');
});
fixture('path index outside waypoint bounds', value => {
  const citizens = nodeFor(value, objectValue(value, value.state.roots.game, 'citizens'));
  replaceObjectValue(value, citizens.items[0], 'pathIdx', 999);
});
fixture('building-grid reference mismatch', value => {
  const gridNode = nodeFor(value, objectValue(value, value.state.roots.game, 'buildingGrid'));
  const rowNode = nodeFor(value, gridNode.items[building.y]);
  const citizensNode = nodeFor(value, objectValue(value, value.state.roots.game, 'citizens'));
  rowNode.items[building.x] = clone(citizensNode.items[0]);
});
fixtures.push(['malformed JSON', '{"schema":']);

for (const [name, raw] of fixtures) {
  const before = liveSentinel();
  const result = prepareSave(raw);
  assert.equal(result.ok, false, `${name}: invalid fixture was accepted`);
  assertUnchanged(before, name);
}

// Codec rejection matrix: every unsupported JavaScript shape fails before
// JSON can erase semantics. The array accessor probe additionally proves the
// getter is never invoked during rejection.
function codecReject(name, value) {
  assert.throws(() => encodeGraphState(value, 1, []), undefined, name);
}
codecReject('negative zero number', { value: -0 });
codecReject('negative zero float view', { value: new Float32Array([-0]) });
codecReject('null-prototype object', { value: Object.create(null) });
codecReject('Map', { value: new Map([['x', 1]]) });
codecReject('Date', { value: new Date(0) });
codecReject('ArrayBuffer', { value: new ArrayBuffer(4) });
codecReject('sliced typed-array view', { value: new Uint8Array(new ArrayBuffer(4), 1, 2) });
{
  const buffer = new ArrayBuffer(2);
  codecReject('shared typed-array buffer', { a: new Uint8Array(buffer), b: new Uint8Array(buffer) });
}
{
  const value = { visible: true };
  Object.defineProperty(value, 'hidden', { value: 1, enumerable: false });
  codecReject('non-enumerable object state', value);
}
codecReject('non-writable object state', Object.freeze({ value: 1 }));
{
  const value = { okay: 1 };
  value[Symbol('secret')] = 2;
  codecReject('symbol-keyed object state', value);
}
{
  let invoked = false;
  const array = [];
  Object.defineProperty(array, '0', {
    get() { invoked = true; return 1; }, enumerable: true, configurable: true,
  });
  codecReject('array index accessor', { array });
  assert.equal(invoked, false, 'rejected array accessor must never be invoked');
}
{
  let root = { leaf: true };
  for (let i = 0; i < 520; i++) root = { child: root };
  codecReject('excessive graph depth', root);
}

// Undefined is an explicit tagged value (not lossy JSON behavior), while an
// array hole remains a hole. Own-key order must survive mixed integer/string
// keys exactly as ECMAScript exposes it.
{
  const array = [undefined, , 'tail'];
  array.goal = { x: 2, y: 3 };
  const ordered = {};
  ordered.stone = 1;
  ordered[10] = 'ten';
  ordered[2] = 'two';
  ordered.wood = 2;
  const state = encodeGraphState({ explicit: undefined, array, ordered }, 1, []);
  const decoded = decodeGraphState(state);
  assert.equal(Object.prototype.hasOwnProperty.call(decoded, 'explicit'), true);
  assert.equal(decoded.explicit, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(decoded.array, 0), true);
  assert.equal(Object.prototype.hasOwnProperty.call(decoded.array, 1), false);
  assert.deepEqual(decoded.array.goal, { x: 2, y: 3 });
  assert.deepEqual(Object.keys(decoded.ordered), ['2', '10', 'stone', 'wood']);
}

{
  const before = liveSentinel();
  const result = commitGameLoad({});
  assert.equal(result.ok, false, 'unprepared candidate must be rejected');
  assertUnchanged(before, 'unprepared commit');
}

{
  const faultCandidate = prepareSave(golden);
  assert.equal(faultCandidate.ok, true);
  const before = liveSentinel();
  const result = commitGameLoadForTest(faultCandidate.value, 7);
  assert.equal(result.ok, false, 'injected mid-commit fault must fail closed');
  assert.equal(result.error.code, 'commit-failed');
  assertUnchanged(before, 'injected mid-commit rollback');
}

// A valid prepared candidate is detached: later live mutations cannot alter it,
// and commit restores its complete linked graph atomically.
const prepared = prepareSave(golden);
assert.equal(prepared.ok, true);
assert.equal(Object.isFrozen(prepared.value), true, 'prepared token must be opaque and frozen');
assert.throws(() => { prepared.value.savedAt = 9; }, TypeError, 'prepared token must reject tampering');
G.resources.food = -987;
renameCitizen(G.citizens[0], 'Mutated after preparation', 'player-rename');
setSeed(1);
missions[0].done = false;
const committed = commitGameLoad(prepared.value);
assert.equal(committed.ok, true, committed.error?.message);
assert.equal(committed.value.savedAt, 123456);
assert.notEqual(G.resources.food, -987);
assert.notEqual(G.citizens[0].identity.name, 'Mutated after preparation');
assert.equal(getSeed(), golden.state.roots.rngSeed);
assert.equal(missions[0].done, true);
assert.equal(missions[0]._celebratedTick, 42);
assert.equal(G.buildingGrid[building.y][building.x], G.buildings[0]);
assert.deepEqual(G.armyGuardPoint, { x: building.x, y: building.y });
assert.equal(G.armyStance, 'guard');
assert.deepEqual(G.armyObjective, { x: 42, y: 42, mode: 'attack-move' });
assert.deepEqual(G.armySupply, {
  version: 1,
  lastProcessedDay: 1,
  missedDawns: 0,
  shortage: 'none',
  readiness: 'ready',
  lastCharge: { food: 0, iron: 0 },
});
assert.equal(Object.hasOwn(G.buildings[0], 'workers'), false);
assert.equal(G.citizens[0].assignment.building, G.buildings[0]);
assert.deepEqual(workersForBuilding(G.buildings[0]), [G.citizens[0]]);
assert.deepEqual(G.citizens[0].path.goal, { x: 41, y: 40 });
assert.equal(G.avatar.path, G.citizens[0].path, 'avatar/citizen path alias was not preserved');
assert.equal(G._undoStack[0].b, G.buildings[0], 'undo building alias was not preserved');
assert.deepEqual(G.projectiles[0].target, detachedImpact, 'detached projectile impact snapshot was not committed exactly');
assert.notEqual(G.projectiles[0].target, detachedImpact, 'prepared projectile snapshot retained a live object reference');
assert.equal(commitGameLoad(prepared.value).ok, false, 'prepared tokens must be single-use');

// Building destruction owns the complete actor/reference lifecycle. A save
// taken in the very next instruction must remain valid without normalizing or
// weakening authoritative links in the serializer.
const retainedBuilding = {
  type: 'well', x: 38, y: 39, hp: 100, prodTimer: 0, level: 1,
  buildProgress: 1, buildTotal: 1, active: true, produced: null,
  buildStartedAt: 0, prodShowCount: 0, visits: {}, trainTimer: 0,
};
G.buildings.push(retainedBuilding);
G.buildingGrid[retainedBuilding.y][retainedBuilding.x] = retainedBuilding;
const removedBuilding = G.buildings[0];
G.citizens[0].home = removedBuilding;
G.citizens[0].carrying = 'wood';
G.citizens[0].carryAmount = 2;
G.citizens[0]._deliveryTarget = removedBuilding;
transitionCitizenActivity(G.citizens[0], 'walk_to_deliver', 'route-to-delivery');
G.citizens[0].activityTimer = 1;
G.citizens[0]._leisureTarget = { x: removedBuilding.x, y: removedBuilding.y, kind: removedBuilding.type };
G.soldiers = [{
  x: 40, y: 40, tx: 40, ty: 40, hp: 75, maxHp: 75,
  homeBuilding: removedBuilding, garrison: removedBuilding,
  name: 'Fixture Guard', type: 'swordsman', state: 'patrol', stateTimer: 1,
}];
G.caravans = [{ x: 40, y: 40, tx: 1, ty: 1, homeX: 39, homeY: 39, phase: 'outbound', gold: 5, speed: 0.03, building: removedBuilding }];
G.walkers = [
  { x: 40, y: 40, tx: 40, ty: 40, home: removedBuilding, color: '#fff', emoji: '⛪', life: 10, visitedHouses: new Set() },
  { x: 40, y: 40, tx: 40, ty: 40, home: retainedBuilding, color: '#fff', emoji: '💧', life: 10, visitedHouses: new Set([removedBuilding]) },
];
G.animals = [{ type: 'cow', x: 40, y: 40, tx: 40, ty: 40, home: removedBuilding }];
G.carts = [{ x: 1, y: 1, tx: 39, ty: 39, state: 'arriving', stateTimer: 0, market: removedBuilding, path: null, pathIdx: 0 }];
G.selectedBuilding = removedBuilding;
G._refreshPanelFor = removedBuilding;
G._patrolPosts = [removedBuilding];
G._patrolPostsBuildingCount = G.buildings.length;
G.storyFlags = { marker: 'after-builds', physicalFoodInventory: true };
G.chronicle = [
  { day: G.day, season: G.season, tick: G.gameTick, text: 'before retained', tag: 'misc' },
  { day: G.day, season: G.season, tick: G.gameTick, text: 'after retained', tag: 'misc' },
];
G._undoStack = [
  { b: retainedBuilding, flagsSnapshot: { marker: 'before-retained', physicalFoodInventory: true }, chronicleLen: 1 },
  { b: removedBuilding, flagsSnapshot: { marker: 'before-removed', physicalFoodInventory: true }, chronicleLen: 2 },
];
removeBuilding(removedBuilding, { cause: 'manual' });
assert.equal(G.buildings.includes(removedBuilding), false);
assert.equal(G.citizens[0].assignment, null);
assert.equal(G.citizens[0].home, null);
assert.equal(G.citizens[0]._deliveryTarget, null);
assert.equal(G.citizens[0].activity.kind, 'needs_delivery');
assert.equal(G.citizens[0].carrying, 'wood');
assert.equal(G.citizens[0].carryAmount, 2);
assert.equal(G.citizens[0]._leisureTarget, null);
assert.equal(G.soldiers[0].homeBuilding, null);
assert.equal(G.soldiers[0].garrison, null);
assert.equal(G.caravans[0].building, null);
assert.equal(G.walkers.length, 1);
assert.equal(G.walkers[0].visitedHouses.has(removedBuilding), false);
assert.equal(G.animals.length, 0);
assert.equal(G.carts.length, 0);
assert.equal(G.selectedBuilding, null);
assert.equal(G._refreshPanelFor, null);
assert.equal(G._patrolPosts, null);
assert.equal(G.armyGuardPoint, null);
assert.equal(G.armyStance, 'defend');
assert.equal(G._undoStack.length, 1);
assert.equal(G._undoStack[0].b, retainedBuilding, 'destruction should remove only its own stale undo entry');
assert.equal(undoLastBuildingPlacement(), true, 'UNDO after demolition should reach the newest still-live build');
assert.equal(G.buildings.includes(retainedBuilding), false);
assert.deepEqual(G.storyFlags, { marker: 'before-retained', physicalFoodInventory: true });
assert.equal(G.chronicle.length, 1);
const immediatePostDemolition = serializeGame();
assert.equal(prepareSave(immediatePostDemolition).ok, true, 'immediate post-demolition save must be valid');

// Presentation queues are resettable browser state, not realm state. A paused
// or core-only fast-forward must not inflate the save or revive stale effects.
G.particles = Array.from({ length: 25_000 }, (_, index) => ({
  type: 'quota-probe-never-persist', index, text: 'x'.repeat(32),
}));
G.animals = [{ type: 'deer', x: 1, y: 1 }];
G.carts = [{ state: 'arriving', market: G.buildings[0] || null }];
G.selectedBuilding = G.buildings[0] || null;
G.selectedCitizenId = G.citizens[0]?.actorId || null;
const renderRecord = citizenRenderRecord(G.citizens[0].actorId);
renderRecord.animationKey = 'render-state-never-persist';
renderRecord.laneX = 0.375;
G._commandLog = [{ type: 'command-log-never-persist', tick: G.gameTick }];
const compactEnvelope = serializeGame();
const compactText = JSON.stringify(compactEnvelope);
assert.equal(compactText.includes('quota-probe-never-persist'), false, 'particle queue leaked into the save');
assert.equal(compactText.includes('render-state-never-persist'), false, 'entity render state leaked into the save');
assert.equal(compactText.includes('command-log-never-persist'), false, 'replay provenance leaked into the save');
assert.ok(compactText.length < 1_000_000, `resettable presentation state inflated save to ${compactText.length} bytes`);
const compactPrepared = prepareSave(compactEnvelope);
assert.equal(compactPrepared.ok, true);
assert.equal(commitGameLoad(compactPrepared.value).ok, true);
assert.deepEqual(G.particles, []);
assert.deepEqual(G.animals, []);
assert.deepEqual(G.carts, []);
assert.equal(G.selectedBuilding, null);
assert.equal(G.selectedCitizenId, null);
assert.equal(Object.hasOwn(G.citizens[0], '_actorAnimationKey'), false);
assert.equal(Object.hasOwn(G.citizens[0], '_laneX'), false);
assert.deepEqual(G._commandLog, []);
resetCitizenRenderCache();
assert.equal(citizenRenderCacheSize(), 0);

// Storage shell: only a valid current-epoch key enables Continue. Superseded
// keys and shapes are deliberately outside this development contract.
const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
assert.equal(hasSave(), false, 'empty current epoch must not enable Continue');
initCitizenInspector({ enabled: true });
resetCitizenTransitionLedger();
assert.equal(renameCitizen(G.citizens[0], 'Ledger Before Rejected Load', 'player-rename'), true);
const ledgerCountBeforeRejectedLoads = getCitizenTransitionLedger({ limit: 2_000 }).length;
assert.ok(ledgerCountBeforeRejectedLoads > 0, 'load reset fixture did not populate transition ledger');

// Public load boundary: a blob can have the exact current epoch header and a
// structurally valid graph while still carrying invalid current-game data.
// Exercise the storage-backed loadGame() surface (not only prepareSave()) and
// prove every rejection is observationally atomic for the live realm.
const publicLoadFixtures = [];
function publicLoadFixture(name, mutate) {
  const value = clone(golden);
  mutate(value);
  publicLoadFixtures.push([name, JSON.stringify(value)]);
}

publicLoadFixture('scalar gameTick type', value => {
  replaceObjectValue(value, value.state.roots.game, 'gameTick', 'not-an-integer');
});
publicLoadFixture('season enum', value => {
  replaceObjectValue(value, value.state.roots.game, 'season', 'monsoon');
});
publicLoadFixture('map row collection width', value => {
  const map = nodeFor(value, objectValue(value, value.state.roots.game, 'map'));
  nodeFor(value, map.items[0]).items.pop();
});
publicLoadFixture('nested resource scalar', value => {
  const resources = objectValue(value, value.state.roots.game, 'resources');
  replaceObjectValue(value, resources, 'food', 'bottomless');
});
publicLoadFixture('citizen activity state', value => {
  const activity = nestedObjectReference(value, collectionItem(value, 'citizens'), 'activity');
  replaceObjectValue(value, activity, 'kind', 'teleporting');
});
publicLoadFixture('population wrong scalar type', value => {
  replaceObjectValue(value, value.state.roots.game, 'population', 'three citizens');
});
publicLoadFixture('population count mismatch', value => {
  const citizens = nodeFor(value, objectValue(value, value.state.roots.game, 'citizens'));
  replaceObjectValue(value, value.state.roots.game, 'population', citizens.items.length + 1);
});
publicLoadFixture('building active wrong scalar type', value => {
  const buildings = nodeFor(value, objectValue(value, value.state.roots.game, 'buildings'));
  replaceObjectValue(value, buildings.items[0], 'active', 'yes');
});
publicLoadFixture('army stance enum', value => {
  replaceObjectValue(value, value.state.roots.game, 'armyStance', 'retreat');
});
publicLoadFixture('sparse nested stats collection', value => {
  const stats = objectValue(value, value.state.roots.game, 'stats');
  const scenariosWon = nodeFor(value, objectValue(value, stats, 'scenariosWon'));
  scenariosWon.items.push({ $: 'hole' });
});
publicLoadFixture('nested citizen needs scalar type', value => {
  const citizens = nodeFor(value, objectValue(value, value.state.roots.game, 'citizens'));
  const needs = objectValue(value, citizens.items[0], 'needs');
  replaceObjectValue(value, needs, 'joy', 'ecstatic');
});
publicLoadFixture('initialized death-marker collection replaced with null', value => {
  replaceObjectValue(value, value.state.roots.game, 'deathMarkers', null);
});
publicLoadFixture('active-realm avatar replaced with null', value => {
  replaceObjectValue(value, value.state.roots.game, 'avatar', null);
});
publicLoadFixture('detached projectile target smuggles arbitrary state', injectDetachedProjectileTarget);

for (const [name, raw] of publicLoadFixtures) {
  values.set(SAVE_KEY, raw);
  const before = liveSentinel();
  assert.equal(hasSave(), false, `${name}: malformed current-epoch blob enabled Continue`);
  assert.equal(loadGame(), false, `${name}: public loadGame accepted malformed current-epoch blob`);
  assert.equal(values.get(SAVE_KEY), raw, `${name}: rejected blob was rewritten or removed`);
  assertUnchanged(before, `public load rejection (${name})`);
  assert.equal(
    getCitizenTransitionLedger({ limit: 2_000 }).length,
    ledgerCountBeforeRejectedLoads,
    `${name}: rejected load reset transition ledger`,
  );
}

values.delete(SAVE_KEY);
assert.equal(saveGame(), true, 'current save shell should write successfully');
assert.equal(values.has(SAVE_KEY), true, 'current save key was not written');
assert.equal(hasSave(), true, 'fresh current save must enable Continue');
assert.equal(renameCitizen(G.citizens[0], 'Ledger After Saved State', 'player-rename'), true);
assert.ok(
  getCitizenTransitionLedger({ limit: 2_000 }).length > ledgerCountBeforeRejectedLoads,
  'post-save transition did not enter the ledger',
);
assert.equal(loadGame(), true, 'valid in-game load should commit');
assert.deepEqual(
  getCitizenTransitionLedger({ limit: 2_000 }),
  [],
  'successful in-game load retained transitions from the replaced realm',
);

// Luna's 41-death regression: the core owns the durable grave-history bound.
// A shell/render pass must not be required to make a canonical post-tick save
// admissible. Restore the known-good realm, expand it to 41 valid citizens,
// kill all 41 in one canonical tick, and prove FIFO retention plus round-trip.
{
  const restored = prepareSave(golden);
  assert.equal(restored.ok, true, restored.error?.message);
  assert.equal(commitGameLoad(restored.value).ok, true, 'death-marker fixture could not restore its clean realm');

  while (G.citizens.length < 41) {
    G.citizens.push(makeCitizen(40 + (G.citizens.length % 3) * 0.1, 40));
  }
  G.citizens.forEach((candidate, index) => {
    renameCitizen(candidate, `Veto Citizen ${index}`, 'player-rename');
    candidate.hp = 0;
  });
  G.population = 41;
  G.maxPop = 41;
  G.deathMarkers = [];

  const beforeDeaths = serializeGame();
  assert.equal(validateSave(beforeDeaths).ok, true, '41-death fixture must satisfy the wire schema before ticking');
  const admittedBeforeDeaths = prepareSave(beforeDeaths);
  assert.equal(admittedBeforeDeaths.ok, true, admittedBeforeDeaths.error?.message);

  coreTick();
  assert.equal(G.citizens.length, 0, 'canonical tick did not remove all 41 zero-HP citizens');
  assert.equal(G.population, 0, 'canonical tick did not reconcile population after 41 deaths');
  assert.equal(G.deathMarkers.length, 40, 'canonical core retained more than the newest 40 death markers');
  assert.deepEqual(
    G.deathMarkers.map(marker => marker.name),
    Array.from({ length: 40 }, (_, index) => `Veto Citizen ${39 - index}`),
    'death-marker FIFO did not retain the newest 40 graves in canonical order',
  );

  const afterDeaths = serializeGame();
  const admittedAfterDeaths = prepareSave(afterDeaths);
  assert.equal(admittedAfterDeaths.ok, true, admittedAfterDeaths.error?.message);
  assert.equal(commitGameLoad(admittedAfterDeaths.value).ok, true, '41-death save did not commit');
  assert.equal(G.deathMarkers.length, 40, '41-death save round-trip changed the grave bound');
  assert.deepEqual(
    G.deathMarkers.map(marker => marker.name),
    Array.from({ length: 40 }, (_, index) => `Veto Citizen ${39 - index}`),
    '41-death save round-trip changed grave history',
  );
}

console.log(`[engine-v2-save] OK — ${rootWrongKindRejections}/75 root-kind rejections, ${fixtures.length} strict preparation rejections, ${publicLoadFixtures.length} atomic public-load rejections, detached commit, clean storage epoch, and bounded 41-death round-trip`);
