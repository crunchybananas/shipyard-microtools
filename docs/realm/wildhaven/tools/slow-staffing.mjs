/** Harness-only policy. One global manual labor action per 30 simulated seconds. */
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { getBuildingSpec } from '../js/catalog.js';

export function createSlowStaffingPolicy({ priorities, researchOrder, resourceTargets, log }) {
  let lastActionTime = -30;
  const memory = new Map();
  const pendingSince = new Map();
  return state => {
    if (state.elapsed - lastActionTime < 30) return;
    const targets = resourceTargets(), candidates = [];
    function propose(kind, building, value, score, reason) {
      const key = `${kind}:${building?.id || 'town'}:${value}`;
      if (!pendingSince.has(key)) pendingSince.set(key, state.elapsed);
      // Old useful requests eventually outrank newly appearing requests.
      candidates.push({ kind, building, value, reason, score: score + Math.min(30, (state.elapsed - pendingSince.get(key)) / 30), key });
    }
    const builders = state.population >= 20 ? 4 : state.population >= 10 ? 3 : 2;
    if (state.builderTarget !== builders) propose('builders', null, builders, 55, 'Adjust construction crew after population growth');
    for (const b of state.buildings) {
      const spec = getBuildingSpec(b.type, b.level);
      if (!spec.workers || b.status !== 'ready') continue;
      const saved = memory.get(b.id) || { stocked: false, wood: false, inputs: false, marketFood: false, hearthSurplus: false };
      const outputs = Object.keys(spec.recipe.output);
      if (outputs.length && !['school', 'market'].includes(b.type)) {
        if (outputs.every(key => state.resources[key] >= targets[key])) saved.stocked = true;
        else if (outputs.some(key => state.resources[key] < targets[key] * .65)) saved.stocked = false;
      }
      if (spec.recipe.input.wood) {
        if (state.resources.wood < 35) saved.wood = true;
        else if (state.resources.wood >= 70) saved.wood = false;
      }
      const inputs = Object.entries(spec.recipe.input);
      if (inputs.some(([key]) => state.resources[key] < .05)) saved.inputs = true;
      else if (inputs.every(([key, amount]) => state.resources[key] >= Math.max(1, amount * .25))) saved.inputs = false;
      const foodFloor = Math.max(35, state.population * 1.2);
      if (state.resources.food < foodFloor) saved.marketFood = true;
      else if (state.resources.food > foodFloor + 25) saved.marketFood = false;
      if (state.population > 20 && state.resources.food > state.population * 1.5 && state.resources.wood > 100 && state.resources.stone > 80) saved.hearthSurplus = true;
      else if (state.resources.food < state.population || state.resources.wood < 65 || state.resources.stone < 50) saved.hearthSurplus = false;
      memory.set(b.id, saved);
      let desired = spec.workers, reason = 'Resume production below the lower stock threshold';
      if (saved.stocked) { desired = 0; reason = 'Release workers at the upper stock threshold'; }
      if (saved.inputs) { desired = 0; reason = 'Release workers until inputs recover to a quarter-day reserve'; }
      if (saved.wood && !(b.type === 'bakery' && state.resources.food < state.population * 1.3 + 20)) { desired = 0; reason = 'Preserve timber; reopen only after 70 wood'; }
      if (b.type === 'school' && researchOrder.every(id => state.research.completed.includes(id))) { desired = 0; reason = 'Strategy research complete'; }
      if (b.type === 'market') { desired = saved.marketFood ? 0 : spec.workers; reason = saved.marketFood ? 'Preserve food for households' : 'Reopen market after food reserve recovers'; }
      if (b.type === 'hearth' && saved.hearthSurplus) { desired = 0; reason = 'Founders released while staples have a safe reserve'; }
      if (b.desiredWorkers !== desired) {
        const shortage = outputs.length ? Math.max(...outputs.map(key => 1 - state.resources[key] / Math.max(1, targets[key]))) : 0;
        const score = desired > 0 ? 50 + Math.max(0, shortage) * 35 : 45;
        propose('workers', b, desired, score, reason);
      }
      const priority = priorities[b.type] ?? 20;
      if (b.priority !== priority) propose('priority', b, priority, b.type === 'hearth' ? 90 : 25, 'Set stable workplace priority once');
    }
    if (!candidates.length) return;
    const action = candidates.sort((a, b) => b.score - a.score)[0];
    const before = action.kind === 'builders' ? state.builderTarget : action.kind === 'workers' ? action.building.desiredWorkers : action.building.priority;
    const result = action.kind === 'builders' ? sim.setBuilderTarget(state, action.value) : action.kind === 'workers' ? sim.setWorkers(state, action.building.id, action.value) : sim.setPriority(state, action.building.id, action.value);
    assert.ok(result.ok, `Slow staffing action failed: ${result.reason}`);
    assert.ok(state.elapsed - lastActionTime >= 30, 'Staffing actions violated the global 30-second limit');
    lastActionTime = state.elapsed;
    pendingSince.delete(action.key);
    log({ time: state.elapsed, day: state.day, kind: action.kind, id: action.building?.id || null, building: action.building?.type || null, before, value: action.value, reason: action.reason });
  };
}
