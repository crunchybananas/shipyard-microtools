#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, createResourceStock, setSeed } from '../js/state.js?realm=178';
import { generateWorld } from '../js/world.js?realm=178';
import { dispatch } from '../js/commands.js?realm=178';
import { canPlace } from '../js/economy.js?realm=178';
import { coreTick } from '../js/sim.js?realm=178';
import { renameCitizen } from '../js/citizen-ownership.js?realm=178';
import {
  getCitizenTransitionLedger,
  initCitizenInspector,
  inspectCitizen,
  resetCitizenTransitionLedger,
} from '../js/citizen-inspector.js?realm=178';

setSeed(44017);
generateWorld();
G.debug = { disableEvents: true };
G.nextRaidDay = 9999;
G.resources = createResourceStock({
  wood: 500, stone: 500, food: 500, gold: 500, iron: 100,
  wheat: 100, flour: 100, planks: 100, tools: 100,
});
for (const row of G.fog) row.fill(true);

function place(type) {
  for (let radius = 0; radius < 25; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = 40 + dx;
        const y = 40 + dy;
        if (!canPlace(type, x, y)) continue;
        const result = dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
        if (result.ok) return G.buildingGrid[y][x];
      }
    }
  }
  throw new Error(`No placement found for ${type}`);
}

place('house');
place('farm');
place('storehouse');
initCitizenInspector({ enabled: true });
resetCitizenTransitionLedger();

for (let tick = 0; tick < 1_200; tick++) {
  coreTick();
}

let transitions = getCitizenTransitionLedger({ limit: 2_000 });
assert.ok(transitions.length > 0, 'citizen kernel produced no causal transitions');
assert.ok(transitions.every(entry => typeof entry.reason === 'string' && entry.reason.length > 0));
assert.ok(transitions.every(entry => Number.isSafeInteger(entry.actorId) && entry.actorId > 0));
assert.ok(transitions.every(entry => Number.isSafeInteger(entry.tick) && entry.tick >= 0));
assert.ok(transitions.every(entry => ['identity', 'profession', 'assignment', 'activity'].includes(entry.field)));
assert.ok(transitions.every(entry => !Object.hasOwn(entry, 'source')), 'ledger retained observer-inferred provenance');
assert.doesNotThrow(() => JSON.stringify(transitions), 'causal transition payloads must be serializable');
for (const field of ['assignment', 'activity', 'profession']) {
  assert.ok(transitions.some(entry => entry.field === field), `ledger did not observe ${field}`);
}
assert.equal(transitions.some(entry => entry.field === 'identity'), false, 'citizen identity changed without a causal rename');
assert.ok(transitions.some(entry => entry.field === 'assignment' && ['construction', 'job-market'].includes(entry.reason)));
assert.ok(transitions.some(entry => entry.field === 'activity' && entry.reason === 'route-to-work'));

const assignmentEvent = transitions.find(entry => entry.field === 'assignment' && entry.newValue);
assert.ok(assignmentEvent, 'ledger omitted an accepted assignment claim');
const assignmentBuilding = G.buildings.find(building => (
  building.x === assignmentEvent.newValue.building.x
  && building.y === assignmentEvent.newValue.building.y
));
assert.ok(assignmentBuilding, 'assignment event locator did not resolve to a live building');
assert.notEqual(assignmentEvent.newValue.building, assignmentBuilding, 'event leaked a mutable building reference');
assert.deepEqual(
  Object.keys(assignmentEvent.newValue.building).sort(),
  ['type', 'x', 'y'],
  'assignment event building summary changed shape',
);

const citizen = G.citizens.find(value => value.actorId === assignmentEvent.actorId);
assert.ok(citizen, 'transition actor no longer exists in the fixture');
const beforeRename = {
  actorId: citizen.actorId,
  appearanceId: citizen.identity.appearanceId,
  profession: structuredClone(citizen.profession),
  assignment: citizen.assignment,
  activity: structuredClone(citizen.activity),
};
const oldName = citizen.identity.name;
assert.equal(renameCitizen(citizen, 'Ledger Namesake', 'story-namesake'), true);
assert.equal(citizen.actorId, beforeRename.actorId);
assert.equal(citizen.identity.appearanceId, beforeRename.appearanceId);
assert.deepEqual(citizen.profession, beforeRename.profession);
assert.equal(citizen.assignment, beforeRename.assignment);
assert.deepEqual(citizen.activity, beforeRename.activity);

transitions = getCitizenTransitionLedger({ actorId: citizen.actorId, limit: 2_000 });
const renameEvent = transitions.at(-1);
assert.deepEqual(renameEvent, {
  actorId: citizen.actorId,
  field: 'identity',
  oldValue: { name: oldName, appearanceId: beforeRename.appearanceId },
  newValue: { name: 'Ledger Namesake', appearanceId: beforeRename.appearanceId },
  tick: G.gameTick,
  reason: 'story-namesake',
});

G.selectedCitizenId = citizen.actorId;
const inspected = inspectCitizen(citizen.actorId);
assert.deepEqual(inspected.identity, citizen.identity);
for (const key of [
  'actorId', 'identity', 'profession', 'assignment', 'activity', 'cargo',
  'waitAge', 'lastTransition', 'recentTransitions',
]) {
  assert.ok(Object.prototype.hasOwnProperty.call(inspected, key), `inspector omitted ${key}`);
}
assert.equal(inspected.actorId, citizen.actorId);
assert.equal(inspected.lastTransition.reason, 'story-namesake');

const counts = Object.fromEntries(
  [...new Set(transitions.map(entry => entry.field))].sort().map(field => [
    field,
    transitions.filter(entry => entry.field === field).length,
  ]),
);
console.log(`✓ ${transitions.length} reasoned transitions across ${Object.keys(counts).length} fields`);
console.log('✓ causal rename + immutable assignment locator + actor-ID inspector');
console.log(`[citizen-transition-ledger] OK — ${JSON.stringify(counts)}`);
