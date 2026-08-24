#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, setSeed } from '../js/state.js?realm=197';
import { generateWorld } from '../js/world.js?realm=197';
import { dispatch } from '../js/commands.js?realm=197';
import {
  FIRST_MUSTER_STEPS,
  updateFirstMusterChapter,
} from '../js/first-muster.js?realm=197';
import { checkRaids } from '../js/economy.js?realm=197';
import {
  commitGameLoad,
  prepareSave,
  serializeGame,
} from '../js/save-state.js?realm=197';
import {
  getPostRaidRecoveryReport,
  getPostRaidRecoverySnapshot,
  updatePostRaidRecovery,
} from '../js/post-raid-recovery.js?realm=197';
import { checkScenarioComplete, getActiveScenario } from '../js/scenarios.js?realm=197';
import {
  claimCitizenAssignment,
  resetCitizenOwnershipRuntime,
} from '../js/citizen-ownership.js?realm=197';
import {
  assignCitizenResidence,
  residencePortalForCitizen,
} from '../js/residences.js?realm=197';
import { establishFounderStockpile } from '../js/building-inventory.js?realm=197';

function reset(seed = 18950) {
  setSeed(seed);
  generateWorld();
  G.scenario = 'military_rise';
  G.storyFlags = {};
  G.enemies = [];
  G.buildings = [];
  G.soldiers = [];
  G.projectiles = [];
  G._commandLog = [];
  G._raidSide = null;
  G.gameTick = 100;
  G.avatar.scoutingFinds = 3;
  G.population = G.citizens.length;
  G.stats.raidsFaced = 0;
  G.stats.raidsSurvived = 0;
  establishFounderStockpile();
  resetCitizenOwnershipRuntime();
}

function commandMutationSnapshot() {
  return JSON.stringify({
    storyFlags: G.storyFlags,
    resources: G.resources,
    population: G.population,
    commandLog: G._commandLog,
  });
}

function finishedBuilding(type, x, y, buildStartedAt = 0) {
  return {
    type, x, y, hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt, completeTick: buildStartedAt + 1,
  };
}

function addHousehold(citizenIndex = 2, x = 46, y = 40) {
  const house = finishedBuilding('house', x, y, 0);
  G.buildings.push(house);
  G.buildingGrid[y][x] = house;
  G.maxPop += 4;
  const citizen = G.citizens[citizenIndex];
  assert.ok(citizen, `missing household citizen ${citizenIndex}`);
  assert.equal(assignCitizenResidence(citizen), house);
  const portal = residencePortalForCitizen(citizen);
  assert.ok(portal, 'household House did not expose a walkable portal');
  citizen.x = portal.x;
  citizen.y = portal.y;
  citizen.tx = portal.x;
  citizen.ty = portal.y;
  return { house, citizen, portal };
}

function setSleepingAt(citizen, sinceTick, portal) {
  citizen.x = portal.x;
  citizen.y = portal.y;
  citizen.tx = portal.x;
  citizen.ty = portal.y;
  citizen.activity = { kind: 'sleep', sinceTick, reason: 'sleep-rest' };
}

function unlockRecovery(approach = null) {
  G.storyFlags.firstMusterStep = FIRST_MUSTER_STEPS.length;
  G.enemies = [];
  if (approach !== null) G.storyFlags.firstRaidApproach = approach;
  G._raidSide = null;
  updatePostRaidRecovery();
}

// Invalid, early, active-raid, and repeat commands fail without mutation or
// replay-log entries.
reset();
let before = commandMutationSnapshot();
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 1 }).reason, 'invalid-command-field');
assert.equal(commandMutationSnapshot(), before);
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'tribute' }).reason, 'invalid-doctrine');
assert.equal(commandMutationSnapshot(), before);
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'explore' }).reason, 'first-muster-incomplete');
assert.equal(commandMutationSnapshot(), before);
assert.ok(getPostRaidRecoveryReport().choices.every(choice => choice.status === 'locked' && !choice.enabled));

G.storyFlags.firstMusterStep = FIRST_MUSTER_STEPS.length;
G.enemies = [{ hp: 24 }];
before = commandMutationSnapshot();
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'explore' }).reason, 'raid-active');
assert.equal(commandMutationSnapshot(), before);

// The full scout -> spawn/clear handoff preserves the known first approach.
// The active side remains available through combat for deterministic
// retargeting, then combat clears it when the final raider resolves.
G.enemies = [];
G.storyFlags.firstMusterStep = 4;
G._raidSide = null;
updateFirstMusterChapter();
const firstRaidApproach = G.storyFlags.firstRaidApproach;
assert.ok(Number.isSafeInteger(firstRaidApproach));
assert.equal(G._raidSide, firstRaidApproach);
// Rally placement is latched before the campaign-owned first battle can use
// its calendar. The separate raid-gate verifier proves the warning runway.
G.storyFlags.firstMusterStep = 6;
G.day = 8;
G.dayPhase = 0;
G.nextRaidDay = 8;
G.era = 2;
G.eraStartDay = { 1: 1, 2: 1 };
G.difficulty = 'normal';
checkRaids();
assert.ok(G.enemies.length > 0, 'first raid did not spawn');
assert.equal(G._raidSide, firstRaidApproach, 'live raid did not retain the scouted approach');
G.enemies = [];
G._raidSide = null; // resolved-raid state; combat clearing is covered separately
G.storyFlags.firstMusterStep = FIRST_MUSTER_STEPS.length;
const choiceReport = getPostRaidRecoveryReport();
assert.equal(choiceReport.unlocked, true);
assert.equal(choiceReport.canChoose, true);
assert.equal(choiceReport.approach.side, firstRaidApproach);
assert.equal(choiceReport.approach.persisted, true);
assert.equal(choiceReport.primary, null);
assert.deepEqual(choiceReport.choices.map(choice => choice.id), ['rebuild', 'fortify', 'explore']);
assert.ok(choiceReport.choices.every(choice => choice.status === 'available' && choice.enabled));
assert.equal(getActiveScenario().objectives[0].id, 'choose_recovery_doctrine');
assert.equal(checkScenarioComplete(), false, 'scenario won before recovery choice');

const resourcesBeforeChoice = JSON.stringify(G.resources);
const populationBeforeChoice = G.population;
const household = addHousehold(2);
// A resident already asleep before the choice is not a post-raid recovery.
setSleepingAt(household.citizen, G.gameTick, household.portal);
const chosen = dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'explore' });
assert.equal(chosen.ok, true);
assert.equal(JSON.stringify(G.resources), resourcesBeforeChoice, 'doctrine choice granted resources');
assert.equal(G.population, populationBeforeChoice, 'doctrine choice granted population');
let report = getPostRaidRecoverySnapshot();
assert.equal(report.selected, 'explore');
assert.equal(report.primary.id, 'chart_new_find');
assert.deepEqual(report.primary.progress, { current: 0, target: 1, baseline: 3, totalFinds: 3 });
assert.deepEqual(report.stabilization, {
  current: 0,
  target: 1,
  choiceTick: 100,
  eligibleResidents: 1,
  resident: null,
});
assert.equal(report.choices.filter(choice => choice.status === 'selected').length, 1);
assert.equal(report.choices.filter(choice => choice.status === 'unavailable').length, 2);
assert.equal(getActiveScenario().objectives[0].id, 'chart_new_find');

before = commandMutationSnapshot();
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'fortify' }).reason, 'doctrine-already-chosen');
assert.equal(commandMutationSnapshot(), before);

updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().complete, false);
G.avatar.scoutingFinds = 4;
updatePostRaidRecovery();
report = getPostRaidRecoveryReport();
assert.equal(report.complete, false, 'doctrine completion alone finished recovery');
assert.equal(report.primary.id, 'stabilize_household');
assert.equal(report.primary.progress.current, 0, 'pre-choice sleep satisfied stabilization');
// A sleeping state away from the resident's own portal is not physical
// arrival, even when the activity began after the doctrine choice.
G.gameTick = 101;
setSleepingAt(household.citizen, 101, { x: household.portal.x + 6, y: household.portal.y });
updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().complete, false, 'outdoor sleep satisfied stabilization');
assert.equal(getPostRaidRecoveryReport().stabilization.resident, null);
setSleepingAt(household.citizen, 101, household.portal);
updatePostRaidRecovery();
report = getPostRaidRecoveryReport();
assert.equal(report.complete, true, 'post-choice sleep at the own House portal did not finish recovery');
assert.equal(report.primary.id, 'stabilize_household');
assert.equal(report.primary.status, 'completed');
assert.equal(report.stabilization.resident.actorId, household.citizen.actorId);
assert.equal(JSON.stringify(G.resources), resourcesBeforeChoice, 'doctrine completion granted resources');
assert.equal(G.population, populationBeforeChoice, 'doctrine completion granted population');
assert.equal(checkScenarioComplete(), true, 'completed recovery did not finish the scenario');
G.gameTick = 102;
household.citizen.activity = { kind: 'idle', sinceTick: 102, reason: 'idle-wait' };
assert.equal(updatePostRaidRecovery().complete, true, 'waking a completed household rewound recovery');
G.avatar.scoutingFinds = 0;
assert.equal(getPostRaidRecoveryReport().complete, true, 'completed doctrine rewound');
assert.equal(getPostRaidRecoveryReport().primary.progress.current, 1, 'latched objective displayed regressed progress');
assert.ok(Object.values(G.storyFlags).every(value =>
  typeof value === 'boolean' || typeof value === 'string' || Number.isFinite(value)
));
assert.deepEqual(JSON.parse(JSON.stringify(getPostRaidRecoverySnapshot())), getPostRaidRecoverySnapshot());
const savedRecovery = prepareSave(JSON.stringify(serializeGame({ savedAt: 18950 })));
assert.equal(savedRecovery.ok, true, savedRecovery.error?.message);
assert.equal(commitGameLoad(savedRecovery.value).ok, true);
assert.equal(G.storyFlags.postRaidDoctrine, 'explore');
assert.equal(G.storyFlags.postRaidExploreBaseline, 3);
assert.equal(G.storyFlags.postRaidRecoveryComplete, true);
assert.equal(getPostRaidRecoveryReport().complete, true, 'save round-trip lost recovery completion');

// Rebuild: an old staffed farm cannot auto-complete the choice. A second farm
// staffed later in the same simulation tick does count, proving the scalar
// baseline distinguishes command order without rejecting legitimate actions.
reset(18951);
const farm = finishedBuilding('farm', 42, 40, 20);
const secondFarm = finishedBuilding('farm', 44, 40, 20);
G.buildings = [G.buildings.find(building => building.founderStockpile), farm, secondFarm];
G.buildingGrid[farm.y][farm.x] = farm;
G.buildingGrid[secondFarm.y][secondFarm.x] = secondFarm;
G.gameTick = 100;
const rebuildHousehold = addHousehold(2, 46, 40);
setSleepingAt(rebuildHousehold.citizen, G.gameTick, rebuildHousehold.portal);
const farmer = G.citizens[0];
claimCitizenAssignment(farmer, farm, { reason: 'player-command' });
farmer.activity = { kind: 'working', sinceTick: 100, reason: 'work-cycle' };
unlockRecovery(0);
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'rebuild' }).ok, true);
updatePostRaidRecovery();
report = getPostRaidRecoveryReport();
assert.equal(report.complete, false);
assert.equal(report.primary.progress.current, 0, 'pre-choice staffing completed Rebuild');
assert.equal(report.primary.progress.baseline, 1);
assert.equal(report.primary.progress.operational, 1);
assert.equal(report.primary.progress.targetBuilding, null);

const secondFarmer = G.citizens[1];
claimCitizenAssignment(secondFarmer, secondFarm, { reason: 'player-command' });
secondFarmer.activity = { kind: 'working', sinceTick: 100, reason: 'work-cycle' };
updatePostRaidRecovery();
report = getPostRaidRecoveryReport();
assert.equal(report.complete, false, 'Rebuild doctrine alone completed recovery');
assert.equal(report.primary.id, 'stabilize_household');
assert.equal(report.doctrine.progress.operational, 2);
assert.equal(report.doctrine.progress.targetBuilding.x, secondFarm.x);
G.gameTick = 101;
setSleepingAt(rebuildHousehold.citizen, 101, rebuildHousehold.portal);
updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().complete, true, 'Rebuild path did not complete after post-choice household sleep');

// Fortify: only one more completed defense in the preserved directional
// approach qualifies. A pre-choice defense with the same buildStartedAt as the
// choice cannot auto-complete it; a same-tick completion still can.
reset(18952);
const oldTower = finishedBuilding('tower', 50, 40, 100);
G.buildings = [G.buildings.find(building => building.founderStockpile), oldTower];
G.buildingGrid[oldTower.y][oldTower.x] = oldTower;
const fortifyHousehold = addHousehold(2, 46, 40);
setSleepingAt(fortifyHousehold.citizen, G.gameTick, fortifyHousehold.portal);
unlockRecovery(1);
assert.equal(dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'fortify' }).ok, true);
updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().primary.progress.current, 0, 'existing Tower completed Fortify');
assert.equal(getPostRaidRecoveryReport().primary.progress.baseline, 1);

const wrongSide = finishedBuilding('wall', 30, 40, 101);
G.buildings.push(wrongSide);
G.buildingGrid[wrongSide.y][wrongSide.x] = wrongSide;
updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().complete, false, 'wrong approach completed Fortify');

const eastWall = finishedBuilding('wall', 50, 42, 101);
eastWall.buildProgress = 0.5;
G.buildings.push(eastWall);
G.buildingGrid[eastWall.y][eastWall.x] = eastWall;
updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().complete, false, 'foundation completed Fortify');
eastWall.buildProgress = 1;
updatePostRaidRecovery();
report = getPostRaidRecoveryReport();
assert.equal(report.complete, false, 'Fortify doctrine alone completed recovery');
assert.equal(report.primary.id, 'stabilize_household');
assert.equal(report.doctrine.progress.approach, 'east');
assert.equal(report.doctrine.progress.directional, true);
assert.equal(report.doctrine.progress.targetBuilding.type, 'wall');
G.gameTick = 101;
setSleepingAt(fortifyHousehold.citizen, 101, fortifyHousehold.portal);
updatePostRaidRecovery();
assert.equal(getPostRaidRecoveryReport().complete, true, 'Fortify path did not complete after post-choice household sleep');

console.log('[post-raid-recovery] PASS — exclusive command choice, persisted approach, truthful Rebuild/Fortify/Explore objectives, exact progress, and latched completion');
