#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  COMPANY_READINESS,
  companySupplyCost,
  companySupplyReport,
  createCompanySupplyState,
  readinessMultipliers,
  updateCompanySupply,
} from '../js/company-supply.js?realm=197';

const soldiers = [{ hp: 75 }, { hp: 75 }, { hp: 0 }, { hp: 30 }];
const resources = { food: 10, iron: 4 };
const supply = createCompanySupplyState(0);

assert.deepEqual(companySupplyCost({ soldierCount: 3, companyCount: 1 }), { food: 3, iron: 1 });
assert.deepEqual(companySupplyCost({ soldierCount: 0 }), { food: 0, iron: 0 });
assert.deepEqual(readinessMultipliers(COMPANY_READINESS.READY), { damage: 1, movement: 1 });
assert.deepEqual(readinessMultipliers(COMPANY_READINESS.STRAINED), { damage: 0.85, movement: 0.9 });
assert.deepEqual(readinessMultipliers(COMPANY_READINESS.STARVING), { damage: 0.65, movement: 0.75 });

const first = updateCompanySupply(supply, {
  day: 1,
  resources,
  soldiers,
});
assert.equal(first.processed, true);
assert.deepEqual(first.cost, { food: 3, iron: 1 });
assert.deepEqual(first.charged, { food: 3, iron: 1 });
assert.deepEqual(resources, { food: 7, iron: 3 });
assert.equal(supply.readiness, COMPANY_READINESS.READY);
assert.equal(supply.missedDawns, 0);

const duplicate = updateCompanySupply(supply, {
  day: 1,
  resources,
  soldiers,
});
assert.equal(duplicate.processed, false);
assert.equal(duplicate.reason, 'already-processed');
assert.deepEqual(resources, { food: 7, iron: 3 }, 'same dawn charged twice');

// A partial food payment and an iron shortage are both visible, but never
// create negative resources or a debt balance.
resources.food = 2;
resources.iron = 0;
const strained = updateCompanySupply(supply, { day: 2, resources, soldierCount: 3, companyCount: 1 });
assert.deepEqual(strained.charged, { food: 2, iron: 0 });
assert.deepEqual(resources, { food: 0, iron: 0 });
assert.equal(supply.shortage, 'both');
assert.equal(supply.readiness, COMPANY_READINESS.STRAINED);
assert.equal(supply.missedDawns, 1);

const starving = updateCompanySupply(supply, { day: 3, resources, soldierCount: 3, companyCount: 1 });
assert.deepEqual(starving.charged, { food: 0, iron: 0 });
assert.equal(supply.shortage, 'both');
assert.equal(supply.readiness, COMPANY_READINESS.STARVING);
assert.equal(supply.missedDawns, 2);

resources.food = 3;
resources.iron = 1;
const recovered = updateCompanySupply(supply, { day: 4, resources, soldierCount: 3, companyCount: 1 });
assert.equal(recovered.readiness, COMPANY_READINESS.READY);
assert.equal(supply.missedDawns, 0);
assert.equal(supply.shortage, 'none');
assert.deepEqual(recovered.charged, { food: 3, iron: 1 });

const emptyCompany = updateCompanySupply(supply, {
  day: 5,
  resources,
  soldierCount: 0,
  companyCount: 0,
});
assert.deepEqual(emptyCompany.charged, { food: 0, iron: 0 });
assert.equal(emptyCompany.readiness, COMPANY_READINESS.READY);
assert.equal(supply.missedDawns, 0);
const emptyReport = companySupplyReport(supply, { soldierCount: 0 });
assert.equal(emptyReport.processed, false);
assert.deepEqual(emptyReport.cost, emptyCompany.cost);
assert.deepEqual(emptyReport.charged, emptyCompany.charged);
assert.equal(emptyReport.readiness, emptyCompany.readiness);

// A custom food sink lets the simulation connect this pure contract to its
// physical pantry without changing the dawn/readiness rules.
const callbackSupply = createCompanySupplyState(0);
const callbackResources = { food: 99, iron: 2 };
let pantryTaken = 0;
updateCompanySupply(callbackSupply, {
  day: 1,
  resources: callbackResources,
  soldierCount: 2,
  spendFood: amount => {
    pantryTaken += amount;
    return amount;
  },
});
assert.equal(pantryTaken, 2);
assert.equal(callbackResources.food, 99, 'custom food sink should own physical food mutation');
assert.equal(callbackResources.iron, 1);

console.log('Company supply verifier passed: dawn charge, idempotence, shortage, starvation, recovery, empty company, and food sink.');
