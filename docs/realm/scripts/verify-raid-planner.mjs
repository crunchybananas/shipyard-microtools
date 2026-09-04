#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RAID_PLANNER_CONTRACT,
  planRaidIntent,
  raidPlanDiagnostics,
} from '../js/raid-planner.js?realm=198';

function blockedGrid(width, height) {
  return { width, height, cells: new Uint8Array(width * height) };
}

function openGrid(width, height) {
  return { width, height, cells: new Uint8Array(width * height).fill(1) };
}

function nodeOf(grid, x, y) {
  return y * grid.width + x;
}

function setOpen(grid, x, y, open = true) {
  grid.cells[nodeOf(grid, x, y)] = open ? 1 : 0;
}

function carveRow(grid, y, fromX, toX) {
  for (let x = fromX; x <= toX; x++) setOpen(grid, x, y);
}

function fixedField(grid) {
  return new Int32Array(grid.width * grid.height);
}

function pathHas(plan, x, y) {
  return plan.path.some(point => point.x === x && point.y === y);
}

function assertFrozenPlan(plan) {
  assert.equal(Object.isFrozen(plan), true, 'plan root must be frozen');
  assert.equal(Object.isFrozen(plan.path), true, 'path must be frozen');
  assert.equal(Object.isFrozen(plan.waypoints), true, 'waypoints must be frozen');
  assert.equal(Object.isFrozen(plan.breaches), true, 'breaches must be frozen');
  assert.equal(Object.isFrozen(plan.costs), true, 'cost breakdown must be frozen');
  assert.equal(Object.isFrozen(plan.rationaleTokens), true, 'rationale tokens must be frozen');
  for (const point of plan.path) assert.equal(Object.isFrozen(point), true, 'path point must be frozen');
  for (const point of plan.waypoints) assert.equal(Object.isFrozen(point), true, 'waypoint must be frozen');
  for (const breach of plan.breaches) assert.equal(Object.isFrozen(breach), true, 'breach must be frozen');
  if (plan.objective) assert.equal(Object.isFrozen(plan.objective), true, 'objective must be frozen');
}

function assertFixedCosts(plan) {
  for (const key of ['travel', 'breach', 'exposure', 'congestion', 'value', 'total']) {
    assert.equal(Number.isSafeInteger(plan.costs[key]), true, `${key} must be a safe fixed integer`);
  }
  assert.equal(
    plan.costs.total,
    plan.costs.travel
      + plan.costs.breach
      + plan.costs.exposure
      + plan.costs.congestion
      - plan.costs.value,
    RAID_PLANNER_CONTRACT.scoreFormula,
  );
}

function assertNoCornerCuts(grid, path) {
  for (let i = 1; i < path.length; i++) {
    const before = path[i - 1];
    const after = path[i];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0), 'non-adjacent path step');
    if (dx !== 0 && dy !== 0) {
      assert.notEqual(grid.cells[nodeOf(grid, before.x + dx, before.y)], 0, 'diagonal cut a horizontal corner');
      assert.notEqual(grid.cells[nodeOf(grid, before.x, before.y + dy)], 0, 'diagonal cut a vertical corner');
    }
  }
}

function commonInput(grid, objective = { id: 'keep', label: 'the keep', x: 6, y: 2, value: 0 }) {
  return {
    grid,
    start: { x: 0, y: 2 },
    approach: 'west',
    objectives: [objective],
    attacker: { dps: 10, count: 1 },
  };
}

// One search must weigh walking around a barrier against breaking through it.
// A healthy wall costs ten movement-cell equivalents, so the one-row detour
// wins even though the direct geometry is shorter.
const detourGrid = blockedGrid(7, 5);
carveRow(detourGrid, 2, 0, 6);
setOpen(detourGrid, 3, 2, false);
carveRow(detourGrid, 1, 2, 4);
const healthyWall = planRaidIntent({
  ...commonInput(detourGrid),
  destructibles: [{ id: 'west-wall', label: 'western wall', x: 3, y: 2, hp: 100 }],
});
assert.equal(healthyWall.status, 'planned');
assert.equal(healthyWall.objectiveId, 'keep');
assert.equal(healthyWall.breach, null, 'healthy wall should lose to the open detour');
assert.equal(healthyWall.costs.travel, 8000);
assert.equal(healthyWall.costs.breach, 0);
assert.equal(pathHas(healthyWall, 3, 1), true, 'detour did not use the open upper lane');
assert.equal(pathHas(healthyWall, 3, 2), false, 'detour illegally crossed the healthy wall');
assertNoCornerCuts(detourGrid, healthyWall.path);
assertFixedCosts(healthyWall);
assertFrozenPlan(healthyWall);

// Lowering only the known HP makes the same search prefer a breach. At ten DPS
// the 5 HP wall contributes exactly 500 fixed breach-time units.
const weakWall = planRaidIntent({
  ...commonInput(detourGrid),
  destructibles: [{ id: 'west-wall', label: 'western wall', x: 3, y: 2, hp: 5 }],
});
assert.equal(weakWall.status, 'planned');
assert.deepEqual(weakWall.breach, {
  id: 'west-wall',
  label: 'western wall',
  x: 3,
  y: 2,
  hpFixed: 5000,
  cost: 500,
});
assert.equal(weakWall.costs.travel, 6000);
assert.equal(weakWall.costs.breach, 500);
assert.equal(weakWall.costs.total, 6500);
assert.equal(pathHas(weakWall, 3, 2), true, 'weak breach did not beat the long detour');
assert.ok(weakWall.waypoints.some(point => point.x === 3 && point.y === 2), 'breach cell must remain a waypoint');
assert.ok(weakWall.rationaleTokens.includes('Breach western wall at 3,2.'));
assertNoCornerCuts(detourGrid, weakWall.path);
assertFixedCosts(weakWall);
assertFrozenPlan(weakWall);

// Defensive exposure is an explicit belief field. It diverts the route without
// changing topology and is absent from the selected route's final cost.
const exposureGrid = blockedGrid(7, 5);
carveRow(exposureGrid, 2, 0, 6);
carveRow(exposureGrid, 1, 2, 4);
const direct = planRaidIntent(commonInput(exposureGrid));
assert.equal(pathHas(direct, 3, 2), true, 'zero-exposure control should use the direct route');
const exposure = fixedField(exposureGrid);
exposure[nodeOf(exposureGrid, 3, 2)] = 4000;
const screened = planRaidIntent({ ...commonInput(exposureGrid), defenseExposure: exposure });
assert.equal(screened.status, 'planned');
assert.equal(pathHas(screened, 3, 2), false, 'planner ignored known defensive exposure');
assert.equal(screened.costs.exposure, 0);
assert.equal(screened.costs.travel, 6828);
assert.ok(screened.rationaleTokens.includes('Avoid known defensive exposure.'));
assertNoCornerCuts(exposureGrid, screened.path);
assertFixedCosts(screened);

// Equal northern/southern corridors split deterministically. Feeding the first
// assignment back as fixed corridor pressure sends an equivalent second intent
// down the other lane, with no random or actor-order branch.
const splitGrid = blockedGrid(7, 5);
carveRow(splitGrid, 2, 0, 1);
carveRow(splitGrid, 2, 5, 6);
carveRow(splitGrid, 1, 1, 5);
carveRow(splitGrid, 3, 1, 5);
const firstAssignment = planRaidIntent(commonInput(splitGrid));
assert.equal(pathHas(firstAssignment, 3, 1), true, 'stable node tie should choose the northern corridor');
assert.equal(pathHas(firstAssignment, 3, 3), false);
const pressure = fixedField(splitGrid);
for (const point of firstAssignment.path) {
  if (point.y === 1) pressure[nodeOf(splitGrid, point.x, point.y)] = 1200;
}
const secondAssignment = planRaidIntent({ ...commonInput(splitGrid), corridorPressure: pressure });
assert.equal(pathHas(secondAssignment, 3, 1), false, 'second intent reused an assigned corridor');
assert.equal(pathHas(secondAssignment, 3, 3), true, 'second intent did not split to the equivalent free corridor');
assert.equal(secondAssignment.costs.congestion, 0);
assert.ok(secondAssignment.rationaleTokens.includes('Use an uncommitted assault corridor.'));
assertNoCornerCuts(splitGrid, secondAssignment.path);

// Stable objective and route ties do not depend on input array order. Value is
// a reward in the same fixed score, not a separate post-hoc random preference.
const tieGrid = openGrid(5, 1);
const tieInput = {
  grid: tieGrid,
  start: { x: 2, y: 0 },
  approach: 'north',
  attackerDps: 10,
  attackerCount: 2,
};
const tiedA = planRaidIntent({
  ...tieInput,
  objectives: [
    { id: 'bravo', x: 4, y: 0, value: 0 },
    { id: 'alpha', x: 0, y: 0, value: 0 },
  ],
});
const tiedB = planRaidIntent({
  ...tieInput,
  objectives: [
    { id: 'alpha', x: 0, y: 0, value: 0 },
    { id: 'bravo', x: 4, y: 0, value: 0 },
  ],
});
assert.equal(tiedA.objectiveId, 'alpha');
assert.deepEqual(tiedA.path, [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
assert.deepEqual(tiedA, tiedB, 'input objective order changed an exact tie');
const tiedDiagnostics = raidPlanDiagnostics(tiedA);
assert.equal(Object.isFrozen(tiedDiagnostics), true, 'diagnostics must be immutable');
assert.equal(tiedDiagnostics.fingerprint, raidPlanDiagnostics(tiedB).fingerprint);
assert.equal(tiedDiagnostics.fingerprint, 'raid-plan-v1-42fafb24');

const valuePlan = planRaidIntent({
  grid: openGrid(5, 1),
  start: { x: 0, y: 0 },
  attacker: { dps: 10, count: 1 },
  objectives: [
    { id: 'near', x: 1, y: 0, value: 0 },
    { id: 'valuable', x: 4, y: 0, value: 3001 },
  ],
});
assert.equal(valuePlan.objectiveId, 'valuable');
assert.deepEqual(valuePlan.costs, {
  travel: 4000,
  breach: 0,
  exposure: 0,
  congestion: 0,
  value: 3001,
  total: 999,
});
assertFixedCosts(valuePlan);

// An exact diagonal through two closed shoulders is unreachable. When a side
// cell is destructible, the planner must occupy and pay for that cell before
// reaching the diagonal destination; it still cannot phase through the corner.
const cornerGrid = blockedGrid(2, 2);
setOpen(cornerGrid, 0, 0);
setOpen(cornerGrid, 1, 1);
const cornerBlocked = planRaidIntent({
  grid: cornerGrid,
  start: { x: 0, y: 0 },
  objectives: [{ id: 'diagonal', x: 1, y: 1 }],
  attacker: { dps: 10, count: 1 },
});
assert.equal(cornerBlocked.status, 'no-plan');
assert.equal(cornerBlocked.reason, 'unreachable-objectives');
const cornerBreached = planRaidIntent({
  grid: cornerGrid,
  start: { x: 0, y: 0 },
  objectives: [{ id: 'diagonal', x: 1, y: 1 }],
  destructibles: [{ id: 'door', x: 1, y: 0, hp: 1 }],
  attacker: { dps: 10, count: 1 },
});
assert.deepEqual(cornerBreached.path, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
assert.equal(cornerBreached.costs.breach, 100);

// Invalid objectives are ignored, and all-invalid or unreachable sets return a
// frozen no-plan value instead of throwing into the simulation tick.
const invalidTarget = planRaidIntent({
  grid: openGrid(3, 1),
  start: { x: 0, y: 0 },
  objectives: [{ id: 'outside', x: 99, y: 99 }],
  attacker: { dps: 10, count: 1 },
});
assert.equal(invalidTarget.status, 'no-plan');
assert.equal(invalidTarget.reason, 'no-valid-objectives');
assertFrozenPlan(invalidTarget);
const unreachableTarget = planRaidIntent({
  grid: { width: 3, height: 1, cells: [1, 0, 1] },
  start: { x: 0, y: 0 },
  objectives: [{ id: 'island', x: 2, y: 0 }],
  attacker: { dps: 10, count: 1 },
});
assert.equal(unreachableTarget.status, 'no-plan');
assert.equal(unreachableTarget.reason, 'unreachable-objectives');
assert.deepEqual(unreachableTarget.path, []);
assertFrozenPlan(unreachableTarget);
const oversized = planRaidIntent({
  grid: openGrid(81, 1),
  start: { x: 0, y: 0 },
  objectives: [{ id: 'far', x: 80, y: 0 }],
  attacker: { dps: 10, count: 1 },
});
assert.equal(oversized.reason, 'invalid-grid', 'planner must enforce its 80x80 bound');

// Only explicitly named contract fields matter. Global state, tile-wear-like
// unknown fields, and unknown objective facts cannot perturb the diagnostic.
const hiddenFixture = {
  grid: { ...openGrid(4, 1), tileWear: [255, 255, 0, 0], hiddenFort: 'east' },
  start: { x: 0, y: 0 },
  approach: 'west',
  objectives: [{ id: 'store', x: 3, y: 0, value: 0, hiddenValue: 999999 }],
  attacker: { dps: 10, count: 1 },
};
globalThis.G = { tileWear: [[255]], secretObjective: 'elsewhere' };
const hiddenA = planRaidIntent(hiddenFixture);
globalThis.G = { tileWear: [[0]], secretObjective: 'store' };
const hiddenB = planRaidIntent({
  ...hiddenFixture,
  grid: { ...hiddenFixture.grid, tileWear: [0, 0, 255, 255], hiddenFort: 'west' },
  objectives: [{ ...hiddenFixture.objectives[0], hiddenValue: 0 }],
});
delete globalThis.G;
assert.deepEqual(hiddenA, hiddenB, 'unknown or global facts changed the plan');
assert.equal(raidPlanDiagnostics(hiddenA).fingerprint, raidPlanDiagnostics(hiddenB).fingerprint);

// The production maximum is a hard finite bound. This open fixture also proves
// exact fixed diagonal travel at full 80x80 size.
const maxGrid = openGrid(80, 80);
const maxPlan = planRaidIntent({
  grid: maxGrid,
  start: { x: 0, y: 0 },
  objectives: [{ id: 'far-corner', x: 79, y: 79 }],
  attacker: { dps: 10, count: 1 },
});
assert.equal(maxPlan.status, 'planned');
assert.equal(maxPlan.expandedNodes <= 6400, true);
assert.equal(maxPlan.path.length, 80);
assert.equal(maxPlan.costs.travel, 79 * RAID_PLANNER_CONTRACT.diagonalCostNumerator);
assertNoCornerCuts(maxGrid, maxPlan.path);

const source = await readFile(new URL('../js/raid-planner.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /^\s*import\s/m, 'planner must stay dependency-free');
assert.doesNotMatch(source, /Math\.random|\bdocument\b|\bwindow\b|\btileWear\b/, 'planner references forbidden state/platform inputs');

console.log('[raid-planner] PASS — deterministic route/breach tradeoffs, defense exposure, corridor splitting, stable tie/hash, corner safety, bounded search, immutable diagnostics, invalid/unreachable safety, and explicit-input isolation');
