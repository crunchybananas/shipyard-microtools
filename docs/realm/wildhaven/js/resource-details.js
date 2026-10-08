import { BUILDINGS, RESOURCES, getBuildingSpec } from './catalog.js';
import { perMinute, WORK_CYCLE_SECONDS } from './calendar.js';
import { rates, buildingStatus } from './sim.js';

/** A read-only snapshot of current throughput, not a promise of future stock. */
export function resourceDetails(state, key) {
  if (!Object.hasOwn(RESOURCES, key)) return null;
  const current = rates(state), sources = [], sinks = [];
  let produced = 0, workplaceUsed = 0;
  for (const building of state.buildings) {
    const recipe = getBuildingSpec(building.type, building.level).recipe;
    const production = current.buildings[building.id];
    const output = production.output?.[key] || 0, input = production.input?.[key] || 0;
    produced += output; workplaceUsed += input;
    if (!(recipe.output?.[key] > 0 || recipe.input?.[key] > 0)) continue;
    const status = buildingStatus(state, building);
    const entry = { id: building.id, type: building.type, name: BUILDINGS[building.type].name,
      workers: status.workers, wanted: status.desiredWorkers, maxWorkers: status.maxWorkers,
      status: status.label, reason: status.reason, storageLimited: production.blockedReason === 'Storage full' };
    if (recipe.output?.[key] > 0) sources.push({ ...entry, rate: perMinute(output) });
    if (recipe.input?.[key] > 0) sinks.push({ ...entry, rate: perMinute(input) });
  }
  const stock = state.resources[key] || 0, capacity = RESOURCES[key].physical ? current.storage[key] : null;
  const residentUsed = key === 'food' ? current.foodConsumed : 0;
  const net = perMinute(current[key] || 0);
  return {
    key, name: RESOURCES[key].name, stock, capacity,
    full: capacity !== null && stock >= capacity - 1e-6,
    storageLimited: sources.some(source => source.storageLimited),
    rates: { produced: perMinute(produced), workplaceUsed: perMinute(workplaceUsed), residentUsed: perMinute(residentUsed), net },
    sources, sinks,
    producerTypes: Object.keys(BUILDINGS).filter(type => type !== 'hearth' && BUILDINGS[type].recipe.output?.[key] > 0),
    meal: key === 'food' ? {
      amount: residentUsed,
      secondsUntil: Math.max(0, WORK_CYCLE_SECONDS - (state.time || 0) - (state.subsecond || 0)),
      pantryMeals: residentUsed > 0 ? Math.floor((stock + 1e-6) / residentUsed) : null,
    } : null,
    // Meals are discrete and production can resume after eating. Food therefore
    // uses the pantry-only meal count, never a misleading starvation countdown.
    decline: key !== 'food' && net < -1e-6 ? { seconds: stock / -net * 60 } : null,
  };
}
