#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, createResourceStock, setSeed } from '../js/state.js?realm=197';
import { generateWorld, makeCitizen } from '../js/world.js?realm=197';
import { dispatch } from '../js/commands.js?realm=197';
import { trySpawnSettlers } from '../js/economy.js?realm=197';
import {
  claimCitizenAssignment,
  releaseCitizenAssignment,
  resetCitizenOwnershipRuntime,
  staffingCount,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=197';
import {
  recruitmentCandidatePreview,
  recruitmentForBuilding,
  recruitmentStatus,
  updateRecruitment,
} from '../js/military.js?realm=197';
import { residentsForHouse } from '../js/residences.js?realm=197';
import { commitGameLoad, prepareSave, serializeGame } from '../js/save-state.js?realm=197';
import { establishFounderStockpile } from '../js/building-inventory.js?realm=197';
import { effectiveActiveStaffingCount, isBuildingOperational } from '../js/building-operation.js?realm=197';

function finishedBuilding(type, x, y = 40) {
  const building = {
    type, x, y,
    hp: 100, active: true,
    prodTimer: 0, produced: null, prodShowCount: 0,
    level: 1, buildProgress: 1, buildTotal: 1, buildStartedAt: 0,
    completeTick: 0,
  };
  G.buildings.push(building);
  G.buildingGrid[y][x] = building;
  return building;
}

function addCitizen(name, x = 40, y = 40) {
  const citizen = makeCitizen(x, y);
  citizen.identity.name = name;
  G.citizens.push(citizen);
  G.population = G.citizens.length;
  return citizen;
}

function assignActive(citizen, building, reason = 'job-market') {
  assert.equal(claimCitizenAssignment(citizen, building, { reason }), true);
  transitionCitizenActivity(citizen, 'working', 'arrived-at-work');
}

function finishDrill(building, duration) {
  for (let tick = building.trainTimer || 0; tick < duration; tick++) {
    updateRecruitment(building);
  }
}

function resetFixture(seed) {
  G.nextActorId = 1;
  setSeed(seed);
  generateWorld();
  G.population = G.citizens.length;
  G.maxPop = 12;
  G.scenario = 'military_rise';
  G.storyFlags = {};
  G.namedCharacters = {};
  G.buildings = [];
  G.buildingGrid = Array.from({ length: G.map.length }, () => Array(G.map[0].length).fill(null));
  G.soldiers = [];
  G.resources = createResourceStock({ wood: 50, food: 50, iron: 20 });
  establishFounderStockpile();
  G._commandLog = [];
  G.selectedCitizenId = null;
  resetCitizenOwnershipRuntime();
}

// Candidate ordering, protected identities, ownership removal, one-time cost,
// save validity, and the one-instructor continuation rule.
resetFixture(87_123);
const house = finishedBuilding('house', 44);
const barracks = finishedBuilding('barracks', 46);
const farm = finishedBuilding('farm', 48);
const market = finishedBuilding('market', 50);
const [instructorA, instructorB, founder] = G.citizens;
const resident = addCitizen('Ordinary Resident', house.x, house.y);
const crownFarmer = addCitizen('Crown Farmer', farm.x, farm.y);
const automaticTrader = addCitizen('Automatic Trader', market.x, market.y);
const namedTeacher = addCitizen('Protected Teacher', 42, 40);

assignActive(instructorA, barracks);
assignActive(instructorB, barracks);
assignActive(crownFarmer, farm, 'player-command');
assignActive(automaticTrader, market);
founder.home = house;
resident.home = house;
G.storyFlags = {
  physicalFoodInventory: true,
  founders_named: true,
  founder1: founder.identity.name,
  founder2: 'Protected Founder Two',
  founder3: 'Protected Founder Three',
};
G.namedCharacters = {
  teacher: { name: namedTeacher.identity.name, arrivedDay: G.day },
};

const spec = recruitmentForBuilding(barracks);
const previewA = recruitmentCandidatePreview(barracks);
assert.deepEqual(recruitmentCandidatePreview(barracks), previewA, 'candidate preview changed without realm state changing');
assert.equal(previewA.actorId, resident.actorId, 'unassigned ordinary citizen did not outrank AI workers');
assert.equal(Object.isFrozen(previewA), true);
assert.equal(Object.isFrozen(previewA.workplace), true);

const populationBeforeFirst = G.population;
const residentsBeforeFirst = residentsForHouse(house).length;
const resourcesBeforeFirst = { iron: G.resources.iron, food: G.resources.food };
const first = dispatch({ type: 'RECRUIT_UNIT', x: barracks.x, y: barracks.y });
assert.equal(first.ok, true);
assert.deepEqual(first.candidate, previewA, 'queue did not consume its previewed deterministic candidate');
assert.equal(first.name, resident.identity.name, 'queue discarded civilian identity');
assert.equal(G.citizens.includes(resident), false, 'enlisted civilian remained in population');
assert.equal(resident.home, null, 'ownership removal retained the enlisted citizen home reference');
assert.equal(G.population, populationBeforeFirst - 1);
assert.equal(residentsForHouse(house).length, residentsBeforeFirst - 1, 'house occupancy did not release immediately');
assert.equal(G.resources.iron, resourcesBeforeFirst.iron - spec.cost.iron);
assert.equal(G.resources.food, resourcesBeforeFirst.food - spec.cost.food);
assert.equal(G.citizens.includes(founder), true, 'founder identity was consumed');
assert.equal(G.citizens.includes(namedTeacher), true, 'named-character identity was consumed');
assert.equal(G.citizens.includes(crownFarmer), true, 'Crown worker was consumed');

const afterFirstOrder = {
  population: G.population,
  iron: G.resources.iron,
  food: G.resources.food,
  commands: G._commandLog.length,
};
assert.equal(dispatch({ type: 'RECRUIT_UNIT', x: barracks.x, y: barracks.y }).reason, 'queue-busy');
assert.deepEqual({
  population: G.population,
  iron: G.resources.iron,
  food: G.resources.food,
  commands: G._commandLog.length,
}, afterFirstOrder, 'busy repeat order spent or removed twice');
const queuedSave = serializeGame({ savedAt: 189 });
assert.equal(prepareSave(queuedSave).ok, true, 'enlistment queue produced an invalid save graph');

finishDrill(barracks, spec.duration);
assert.equal(G.soldiers[0].name, first.name, 'civilian name changed during drill');
assert.equal(G.soldiers[0].type, 'swordsman');

const secondPreview = recruitmentCandidatePreview(barracks);
assert.equal(secondPreview.actorId, automaticTrader.actorId, 'external AI worker did not outrank a same-yard instructor');
const marketStaffBefore = staffingCount(market);
const second = dispatch({ type: 'RECRUIT_UNIT', x: barracks.x, y: barracks.y });
assert.equal(second.ok, true);
assert.equal(second.candidate.actorId, automaticTrader.actorId);
assert.equal(staffingCount(market), marketStaffBefore - 1, 'enlistment did not create the promised workforce loss');
assert.equal(G.citizens.includes(crownFarmer), true, 'AI workforce loss consumed a Crown order instead');
finishDrill(barracks, spec.duration);
assert.equal(G.soldiers[1].name, second.name);

const thirdPreview = recruitmentCandidatePreview(barracks);
assert.equal(thirdPreview.source, 'ai-worker');
assert.equal(thirdPreview.sameYard, true, 'third recruit did not come from the staffed yard');
const third = dispatch({ type: 'RECRUIT_UNIT', x: barracks.x, y: barracks.y });
assert.equal(third.ok, true);
assert.equal(third.candidate.actorId, thirdPreview.actorId);
assert.equal(staffingCount(barracks), 1, 'same-yard enlistment did not release exactly one instructor slot');
assert.equal(G.citizens.includes(crownFarmer), true);

updateRecruitment(barracks);
assert.equal(barracks.trainTimer, 1, 'one remaining active instructor did not continue drill');
const remainingInstructor = G.citizens.find(citizen => citizen.assignment?.building === barracks);
transitionCitizenActivity(remainingInstructor, 'idle', 'player-command');
for (let i = 0; i < 30; i++) updateRecruitment(barracks);
assert.equal(barracks.trainTimer, 31, 'the live company did not keep the drill yard supplied with crew');
transitionCitizenActivity(remainingInstructor, 'working', 'arrived-at-work');
finishDrill(barracks, spec.duration);
assert.equal(G.soldiers[2].name, third.name);

// A full Crown-staffed yard has no eligible civilian. The failure is visible
// and leaves both workforce and treasury untouched.
releaseCitizenAssignment(remainingInstructor, 'player-command');
assignActive(remainingInstructor, barracks, 'player-command');
assignActive(founder, barracks, 'player-command');
const noCandidateBefore = {
  population: G.population,
  iron: G.resources.iron,
  food: G.resources.food,
  staffing: staffingCount(barracks),
};
assert.equal(recruitmentStatus(barracks).reason, 'no-candidate');
assert.equal(dispatch({ type: 'RECRUIT_UNIT', x: barracks.x, y: barracks.y }).reason, 'no-candidate');
assert.deepEqual({
  population: G.population,
  iron: G.resources.iron,
  food: G.resources.food,
  staffing: staffingCount(barracks),
}, noCandidateBefore, 'no-candidate failure mutated the realm');

// Military scenario feasibility at the real post-House population: the
// commissioned House brings the opening population from three to four. The
// realistic Farm + Barracks fixture proves the company preserves its own drill
// yard crew so the last civilian can keep food production alive.
resetFixture(189_004);
const scenarioHouse = finishedBuilding('house', 44);
const scenarioBarracks = finishedBuilding('barracks', 46);
const scenarioFarm = finishedBuilding('farm', 48);
const scenarioTower = finishedBuilding('tower', 50);
G.maxPop = G.population + 4;
trySpawnSettlers(1); // exact API used when commissionBuilding completes a House
assert.equal(G.population, 4, 'completed military-scenario House did not provide the four-person muster pool');
assert.equal(G.buildings.includes(scenarioHouse), true);
assignActive(G.citizens[2], scenarioFarm);
assignActive(G.citizens[0], scenarioBarracks);
assignActive(G.citizens[1], scenarioBarracks);

const enlistedActorIds = [];
for (let enlistment = 0; enlistment < 3; enlistment++) {
  const preview = recruitmentCandidatePreview(scenarioBarracks);
  assert.ok(preview, `post-House pool had no candidate for enlistment ${enlistment + 1}`);
  assert.deepEqual(recruitmentCandidatePreview(scenarioBarracks), preview);
  const order = dispatch({
    type: 'RECRUIT_UNIT',
    x: scenarioBarracks.x,
    y: scenarioBarracks.y,
  });
  assert.equal(order.ok, true);
  assert.equal(order.candidate.actorId, preview.actorId);
  enlistedActorIds.push(order.candidate.actorId);
  finishDrill(scenarioBarracks, recruitmentForBuilding(scenarioBarracks).duration);
}
assert.equal(new Set(enlistedActorIds).size, 3, 'sequential orders consumed a civilian more than once');
assert.equal(G.soldiers.length, 3);
assert.equal(G.population, 1);
assert.equal(staffingCount(scenarioFarm), 1, 'the food worker was consumed before available drill-yard workers');
assert.equal(isBuildingOperational(scenarioFarm), true, 'Farm closed after the First Muster');
assert.equal(staffingCount(scenarioBarracks), 0, 'the company still consumed a civilian drill-yard worker');
assert.equal(effectiveActiveStaffingCount(scenarioBarracks), 2, 'the live company did not fill the Barracks crew slots');
assert.equal(isBuildingOperational(scenarioBarracks), true, 'Barracks closed despite its live company');
const lastCivilianBeforeRejectedRecruit = {
  population: G.population,
  iron: G.resources.iron,
  food: G.resources.food,
  soldiers: G.soldiers.length,
};
assert.equal(recruitmentStatus(scenarioBarracks).reason, 'minimum-civilian');
assert.equal(dispatch({ type: 'RECRUIT_UNIT', x: scenarioBarracks.x, y: scenarioBarracks.y }).reason, 'minimum-civilian');
assert.deepEqual({
  population: G.population,
  iron: G.resources.iron,
  food: G.resources.food,
  soldiers: G.soldiers.length,
}, lastCivilianBeforeRejectedRecruit, 'minimum-civilian failure mutated the realm');

// Garrisoning excludes soldiers from drill-yard crew. Removing a free soldier
// and round-tripping through the real save graph preserve the derived result;
// no staffing field is persisted or migrated.
scenarioTower.active = true;
G.soldiers[0].garrison = scenarioTower;
assert.equal(effectiveActiveStaffingCount(scenarioBarracks), 2, 'one garrisoned soldier incorrectly removed all Barracks crew');
G.soldiers.splice(1, 1);
assert.equal(effectiveActiveStaffingCount(scenarioBarracks), 1, 'soldier removal did not reduce effective Barracks crew');
const musterSave = prepareSave(serializeGame({ savedAt: 189 }));
assert.equal(musterSave.ok, true, 'realistic Farm + Barracks state failed Save/Continue validation');
assert.equal(commitGameLoad(musterSave.value).ok, true, 'realistic Farm + Barracks save failed to commit');
resetCitizenOwnershipRuntime();
const restoredBarracks = G.buildings.find(building => building.type === 'barracks');
const restoredTower = G.buildings.find(building => building.type === 'tower');
assert.equal(G.soldiers.filter(soldier => soldier.garrison === restoredTower).length, 1, 'garrison reference did not survive Save/Continue');
assert.equal(effectiveActiveStaffingCount(restoredBarracks), 1, 'derived Barracks crew changed across Save/Continue');
G.soldiers[0].garrison = restoredTower;
G.soldiers[1].garrison = restoredTower;
assert.equal(effectiveActiveStaffingCount(restoredBarracks), 0, 'garrisoned soldiers still counted as drill-yard crew');
assert.equal(isBuildingOperational(restoredBarracks), false, 'Barracks remained operational with no free company crew');

console.log('[first-muster] PASS — deterministic citizen enlistment, Crown/named protection, labor and housing loss, exact-once cost, company drill crew, Farm preservation, Save/Continue, and the four-person post-House triple muster');
