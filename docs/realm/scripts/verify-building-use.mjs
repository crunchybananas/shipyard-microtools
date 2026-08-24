#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, BUILDINGS } from '../js/state.js?realm=197';
import {
  buildingUseReport,
  verifyBuildingUseCoverage,
} from '../js/building-use.js?realm=197';
import {
  claimCitizenAssignment,
  createCitizenOwnership,
  resetCitizenOwnershipRuntime,
  transitionCitizenActivity,
} from '../js/citizen-ownership.js?realm=197';

function building(type, x, y, extra = {}) {
  return {
    type, x, y, hp: 100, active: true,
    buildProgress: 1, buildTotal: 1, level: 1,
    prodTimer: 0, produced: null,
    ...extra,
  };
}

function citizen(name, x, y) {
  return {
    ...createCitizenOwnership(name),
    x, y, tx: x, ty: y,
    activityTimer: 0,
    path: null,
    pathIdx: 0,
    hunger: 0,
    rest: 100,
    needs: { joy: 55, faith: 55 },
  };
}

const coverage = verifyBuildingUseCoverage();
assert.equal(coverage.complete, true);
assert.equal(coverage.covered, Object.keys(BUILDINGS).length);
assert.deepEqual(coverage.missing, []);

const farm = building('farm', 40, 40);
const house = building('house', 41, 40, { inventory: { food: 4 } });
const barracks = building('barracks', 42, 40, {
  recruitType: 'swordsman',
  recruitName: 'Mara Reed',
  trainTimer: 90,
});
const wall = building('wall', 43, 40);
const road = building('road', 44, 40);
const stockpile = building('storehouse', 45, 40, {
  founderStockpile: true,
  inventory: { food: 12 },
});
const farmer = citizen('Edda Field', 40, 40);
const sleeper = citizen('Ivo Hearth', 41, 40);
const instructorA = citizen('Bram Drill', 42, 40);
const instructorB = citizen('Sela Drill', 42, 40);

Object.assign(G, {
  buildings: [farm, house, barracks, wall, road, stockpile],
  citizens: [farmer, sleeper, instructorA, instructorB],
  soldiers: [],
  enemies: [{ x: 43.5, y: 40, hp: 20 }],
  walkers: [],
  carts: [],
  avatar: { x: 44, y: 40, name: 'The Founder' },
});
resetCitizenOwnershipRuntime();

claimCitizenAssignment(farmer, farm, { reason: 'job-market' });
transitionCitizenActivity(farmer, 'working', 'arrived-at-work');
sleeper.home = house;
transitionCitizenActivity(sleeper, 'sleep', 'sleep-rest');
claimCitizenAssignment(instructorA, barracks, { reason: 'job-market' });
claimCitizenAssignment(instructorB, barracks, { reason: 'job-market' });
transitionCitizenActivity(instructorA, 'working', 'arrived-at-work');
transitionCitizenActivity(instructorB, 'working', 'arrived-at-work');

const farmReport = buildingUseReport(farm);
assert.equal(farmReport.people, 'Edda Field');
assert.match(farmReport.activity, /1\/1 workers/);
assert.match(farmReport.strategic, /Pulling its farmer into the army stops/);

const houseReport = buildingUseReport(house);
assert.equal(houseReport.people, 'Ivo Hearth');
assert.match(houseReport.activity, /sleeping inside/);
assert.match(houseReport.strategic, /raid shelter/);

const barracksReport = buildingUseReport(barracks);
assert.match(barracksReport.people, /Bram Drill/);
assert.match(barracksReport.activity, /2 instructors drilling Mara Reed/);
assert.match(barracksReport.strategic, /own company can keep/);

G.soldiers = [{
  name: 'Mara Reed', type: 'swordsman', hp: 75, maxHp: 75,
  homeBuilding: barracks, garrison: null,
}];
const companyBarracksReport = buildingUseReport(barracks);
assert.match(companyBarracksReport.people, /Company: Mara Reed/);
assert.match(companyBarracksReport.activity, /soldier crew drilling Mara Reed/);

const wallReport = buildingUseReport(wall);
assert.match(wallReport.people, /no permanent crew/i);
assert.match(wallReport.activity, /Holding 1 raider/);

const roadReport = buildingUseReport(road);
assert.match(roadReport.people, /Founder/);
assert.match(roadReport.activity, /traveller crossing now/);

const stockpileReport = buildingUseReport(stockpile);
assert.match(stockpileReport.people, /Citizens and delivery carriers/);
assert.match(stockpileReport.activity, /12\/120 rations/);
assert.match(stockpileReport.strategic, /opening realm lives from these physical rations/);

for (const report of [farmReport, houseReport, barracksReport, wallReport, roadReport, stockpileReport]) {
  assert.equal(Object.isFrozen(report), true);
  assert.deepEqual(Object.keys(report), ['type', 'people', 'activity', 'strategic']);
}

console.log(`[building-use] PASS — ${coverage.covered}/${coverage.total} building roles plus live Farm, House, Barracks, Wall, Road, and Founder Stockpile activity`);
