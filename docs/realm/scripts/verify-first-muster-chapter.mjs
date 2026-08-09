#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, setSeed } from '../js/state.js?realm=191';
import { generateWorld } from '../js/world.js?realm=191';
import {
  claimCitizenAssignment,
  resetCitizenOwnershipRuntime,
} from '../js/citizen-ownership.js?realm=191';
import {
  FIRST_MUSTER_STATE_PATH,
  FIRST_MUSTER_STEPS,
  getFirstMusterReport,
  updateFirstMusterChapter,
} from '../js/first-muster.js?realm=191';
import { checkScenarioComplete, getActiveScenario } from '../js/scenarios.js?realm=191';
import { on, off } from '../js/bus.js?realm=191';

function finishedBuilding(type, x) {
  return {
    type, x, y: 40,
    hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, completeTick: 0,
  };
}

function assertSinglePrimary(expectedId) {
  const report = getFirstMusterReport();
  assert.equal(report.primary?.id || null, expectedId);
  assert.equal(report.steps.filter(step => step.status === 'current').length, expectedId ? 1 : 0);
  assert.equal(getActiveScenario().objectives.length, 1, 'scenario exposed more than one primary objective');
  if (expectedId) assert.equal(getActiveScenario().objectives[0].id, expectedId);
  return report;
}

setSeed(18907);
generateWorld();
G.scenario = 'military_rise';
G.storyFlags = {};
G.buildings = [];
G.soldiers = [];
G.enemies = [];
G.rallyPoint = null;
G.armyStance = 'defend';
G.stats.raidsFaced = 0;
G.stats.raidsSurvived = 0;
G._raidSide = null;
resetCitizenOwnershipRuntime();
const advances = [];
const captureAdvance = payload => advances.push(payload);
on('first-muster-advanced', captureAdvance);

assert.equal(FIRST_MUSTER_STATE_PATH, 'storyFlags.firstMusterStep');
assert.deepEqual(
  FIRST_MUSTER_STEPS.map(step => step.id),
  ['food_source', 'house', 'staff_barracks', 'muster_three', 'scout_approach', 'plant_rally', 'survive_raid'],
);
const opening = assertSinglePrimary('food_source');
assert.deepEqual(opening.steps.map(step => step.status), [
  'current', 'future', 'future', 'future', 'future', 'future', 'future',
]);
assert.equal(checkScenarioComplete(), false);

const farm = finishedBuilding('farm', 42);
G.buildings.push(farm);
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, 1);
assert.deepEqual(
  { completed: advances[0].completed.id, next: advances[0].next.id, currentIndex: advances[0].currentIndex, total: advances[0].total },
  { completed: 'food_source', next: 'house', currentIndex: 1, total: FIRST_MUSTER_STEPS.length },
  'chapter did not emit one actionable progression fact',
);
const housed = assertSinglePrimary('house');
assert.equal(housed.steps[0].status, 'completed');

const house = finishedBuilding('house', 43);
G.buildings.push(house);
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, 2);
assertSinglePrimary('staff_barracks');

const barracks = finishedBuilding('barracks', 44);
G.buildings.push(barracks);
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, 2, 'unstaffed Barracks advanced the chapter');
claimCitizenAssignment(G.citizens[0], barracks, { reason: 'player-command' });
claimCitizenAssignment(G.citizens[1], barracks, { reason: 'player-command' });
const staffed = assertSinglePrimary('staff_barracks');
assert.deepEqual(staffed.primary.progress, { current: 2, target: 2 });
updateFirstMusterChapter();
assertSinglePrimary('muster_three');

G.soldiers.push({ type: 'swordsman' }, { type: 'swordsman' }, { type: 'swordsman' });
updateFirstMusterChapter();
const scouting = assertSinglePrimary('scout_approach');
assert.equal(scouting.primary.focus, 'founder');
assert.equal(scouting.primary.action, 'follow-founder');
assert.match(scouting.primary.text, /locate the raiders' approach/);

G.avatar.scoutingFinds = 1;
updateFirstMusterChapter();
const rally = assertSinglePrimary('plant_rally');
assert.ok(Number.isSafeInteger(G._raidSide) && G._raidSide >= 0 && G._raidSide <= 3, 'Founder discovery did not lock the raid approach');
const approach = ['north', 'east', 'south', 'west'][G._raidSide];
assert.match(rally.primary.detail, new RegExp(`from the ${approach}`), 'rally objective did not expose the charted approach');
assert.equal(advances.at(-1).approach, approach, 'shell event did not receive the Founder intelligence');

G.rallyPoint = { x: 52, y: 40 };
G.armyStance = 'rally';
updateFirstMusterChapter();
assertSinglePrimary('survive_raid');

G.stats.raidsFaced = 1;
G.enemies = [];
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, 6, 'raid spawn counted as survived before resolution');
G.stats.raidsSurvived = 1;
G.enemies = [{ type: 'raider' }];
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, 6, 'active raid counted as survived');
G.enemies = [];
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, FIRST_MUSTER_STEPS.length);
const complete = assertSinglePrimary(null);
assert.equal(complete.complete, true);
assert.ok(complete.steps.every(step => step.status === 'completed'));
assert.equal(checkScenarioComplete(), false, 'scenario won before the post-raid recovery choice');
assert.equal(getActiveScenario().objectives[0].id, 'choose_recovery_doctrine');
assert.equal(getActiveScenario().objectives[0].check(), false);
assert.equal(advances.length, FIRST_MUSTER_STEPS.length, 'chapter progression feedback did not fire exactly once per completed beat');

// Completed steps are latched: post-raid casualties or demolished buildings
// cannot rewind an authored chapter after the player already lived it.
G.buildings = [];
G.soldiers = [];
G.avatar.scoutingFinds = 0;
G.rallyPoint = null;
assert.equal(getFirstMusterReport().complete, true);
assert.equal(JSON.parse(JSON.stringify(G.storyFlags)).firstMusterStep, FIRST_MUSTER_STEPS.length);

// Even a fully prepared debug state advances one chapter beat per cadence.
G.storyFlags.firstMusterStep = 0;
G.buildings = [farm, house, barracks];
G.soldiers = [{}, {}, {}];
G.avatar.scoutingFinds = 1;
G.rallyPoint = { x: 50, y: 50 };
G.stats.raidsFaced = 1;
G.stats.raidsSurvived = 1;
resetCitizenOwnershipRuntime();
claimCitizenAssignment(G.citizens[0], barracks, { reason: 'player-command' });
claimCitizenAssignment(G.citizens[1], barracks, { reason: 'player-command' });
updateFirstMusterChapter();
assert.equal(G.storyFlags.firstMusterStep, 1, 'chapter skipped multiple primary objectives in one cadence');
off('first-muster-advanced', captureAdvance);

console.log('[first-muster-chapter] PASS — sequential primary objective, Founder scouting beat, latched save cursor, and raid completion');
