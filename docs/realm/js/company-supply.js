// Deterministic company supply rules. This module deliberately has no import
// from the global game state: the simulation owns the timing and passes an
// explicit supply state, resource ledger, and company snapshot.

export const COMPANY_SUPPLY_VERSION = 1;

export const COMPANY_READINESS = Object.freeze({
  READY: 'ready',
  STRAINED: 'strained',
  STARVING: 'starving',
});

const READINESS_MULTIPLIERS = Object.freeze({
  [COMPANY_READINESS.READY]: Object.freeze({ damage: 1, movement: 1 }),
  [COMPANY_READINESS.STRAINED]: Object.freeze({ damage: 0.85, movement: 0.9 }),
  [COMPANY_READINESS.STARVING]: Object.freeze({ damage: 0.65, movement: 0.75 }),
});

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeCount(value, label) {
  if (value === undefined || value === null) return null;
  return nonNegativeInteger(value, label);
}

function livingSoldierCount(soldiers, soldierCount) {
  const explicitCount = normalizeCount(soldierCount, 'soldierCount');
  if (explicitCount !== null) return explicitCount;
  if (!Array.isArray(soldiers)) return 0;
  return soldiers.filter(soldier => soldier?.hp === undefined || soldier.hp > 0).length;
}

function activeCompanyCount(soldierCount, companyCount) {
  const explicitCount = normalizeCount(companyCount, 'companyCount');
  if (explicitCount !== null) return explicitCount;
  return soldierCount > 0 ? 1 : 0;
}

export function createCompanySupplyState(initialDay = 0) {
  nonNegativeInteger(initialDay, 'initialDay');
  return {
    version: COMPANY_SUPPLY_VERSION,
    lastProcessedDay: initialDay,
    missedDawns: 0,
    shortage: 'none',
    readiness: COMPANY_READINESS.READY,
    lastCharge: { food: 0, iron: 0 },
  };
}

export function companySupplyCost({ soldierCount = 0, companyCount = null } = {}) {
  const soldiers = nonNegativeInteger(soldierCount, 'soldierCount');
  const companies = activeCompanyCount(soldiers, companyCount);
  return Object.freeze({
    food: soldiers,
    iron: companies,
  });
}

export function readinessMultipliers(readiness) {
  return READINESS_MULTIPLIERS[readiness] || READINESS_MULTIPLIERS[COMPANY_READINESS.READY];
}

function shortageFor(foodPaid, ironPaid) {
  if (foodPaid && ironPaid) return 'none';
  if (!foodPaid && !ironPaid) return 'both';
  return foodPaid ? 'iron' : 'food';
}

function report(state, cost, actualCharge, processed, reason = null) {
  return Object.freeze({
    processed,
    reason,
    day: state.lastProcessedDay,
    cost: Object.freeze({ ...cost }),
    charged: Object.freeze({ ...actualCharge }),
    missedDawns: state.missedDawns,
    shortage: state.shortage,
    readiness: state.readiness,
    multipliers: readinessMultipliers(state.readiness),
  });
}

/**
 * Charge one company at a dawn. Repeated calls for the same day are no-ops.
 *
 * `resources` is a mutable explicit ledger. Callers that use physical food
 * stores may provide `spendFood(amount)`, returning the amount actually taken;
 * iron is always charged from `resources.iron` here. No resource goes below 0.
 */
export function updateCompanySupply(state, {
  day,
  resources,
  soldiers,
  soldierCount,
  companyCount,
  spendFood,
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('state is required');
  nonNegativeInteger(day, 'day');
  if (!resources || typeof resources !== 'object') throw new TypeError('resources are required');

  const count = livingSoldierCount(soldiers, soldierCount);
  const companies = activeCompanyCount(count, companyCount);
  const cost = companySupplyCost({ soldierCount: count, companyCount: companies });
  if (day <= state.lastProcessedDay) {
    return report(state, cost, { food: 0, iron: 0 }, false, 'already-processed');
  }

  const availableFood = Number.isFinite(resources.food) ? Math.max(0, resources.food) : 0;
  const requestedFood = cost.food;
  const takenFood = requestedFood === 0
    ? 0
    : (typeof spendFood === 'function'
      ? Math.min(requestedFood, Math.max(0, Number(spendFood(requestedFood)) || 0))
      : Math.min(requestedFood, availableFood));
  if (typeof spendFood !== 'function') resources.food = availableFood - takenFood;

  const availableIron = Number.isFinite(resources.iron) ? Math.max(0, resources.iron) : 0;
  const takenIron = Math.min(cost.iron, availableIron);
  resources.iron = availableIron - takenIron;

  const foodPaid = takenFood === requestedFood;
  const ironPaid = takenIron === cost.iron;
  const fullySupplied = foodPaid && ironPaid;
  state.lastProcessedDay = day;
  state.lastCharge = { food: takenFood, iron: takenIron };
  if (fullySupplied) {
    state.missedDawns = 0;
    state.shortage = 'none';
    state.readiness = COMPANY_READINESS.READY;
  } else if (count === 0) {
    // An empty company has no upkeep and should never inherit a shortage.
    state.missedDawns = 0;
    state.shortage = 'none';
    state.readiness = COMPANY_READINESS.READY;
  } else {
    state.missedDawns = Math.min(2, state.missedDawns + 1);
    state.shortage = shortageFor(foodPaid, ironPaid);
    state.readiness = state.missedDawns >= 2
      ? COMPANY_READINESS.STARVING
      : COMPANY_READINESS.STRAINED;
  }
  return report(state, cost, state.lastCharge, true);
}

export function companySupplyReport(state, {
  soldiers,
  soldierCount,
  companyCount,
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('state is required');
  const count = livingSoldierCount(soldiers, soldierCount);
  const cost = companySupplyCost({
    soldierCount: count,
    companyCount: activeCompanyCount(count, companyCount),
  });
  return report(state, cost, state.lastCharge || { food: 0, iron: 0 }, false);
}
