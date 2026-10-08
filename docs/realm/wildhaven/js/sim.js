import { createWoodland, restoreWoodland, woodlandStatus, harvestWood, tickWoodland } from './woodland.js';
export { woodlandStatus } from './woodland.js';
import { WORK_CYCLE_SECONDS, workPosition } from './calendar.js';
import { createDiscoveryState, normalizeDiscovery, discoveryModifier } from './discovery.js';
/** Wildhaven v2: named labor, escrowed construction, continuous production and town needs. */
import { BUILDINGS, RESOURCE_NAMES, getBuildingSpec, getUpgrade } from './catalog.js';
import { createProgressionState, normalizeProgression, canUnlockBuilding, supplyModifiers, tickProgression, dailyProgression, progressionObjective } from './progression.js';
import { createFrontierState, normalizeFrontier, frontierAssignments, tickFrontier, gateTransition } from './frontier.js';
import { createPressureState, normalizePressure, tickPressure, dailyPressure, actOnPressure as pressureAction } from './pressure.js';
export { pressureOptions } from './pressure.js';
export { BUILDINGS, RESOURCE_NAMES } from './catalog.js';
import { ISLAND_BOUNDS, ISLAND_REGIONS, ISLAND_NEIGHBORS, isLand, terrainAt, listTiles, hasNaturalObstacle, regionAt, neighborAt, isNeighborCompoundCell } from './island.js';
export { ISLAND_BOUNDS, ISLAND_REGIONS, ISLAND_NEIGHBORS, islandShape, isLand, groundHeight, terrainAt, listTiles, hasNaturalObstacle, regionAt, neighborAt, isNeighborCompoundCell } from './island.js';
export const VERSION = 4;
// Legacy save/API name: this is the work cycle, not the displayed calendar day.
export const DAY_LENGTH = WORK_CYCLE_SECONDS;
const MAX_RESOURCE = 1000000000;
const MAX_BUILDINGS = 1800;
const JOURNAL_LIMIT = 60;
const FIXED = { hearth: { x: 0, z: 2, id: 'hearth' }, bell: { x: 0, z: -5, id: 'bell' } };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 1000000) / 1000000;
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const validInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const validType = type => typeof type === 'string' && Object.hasOwn(BUILDINGS, type);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const emptyResources = () => Object.fromEntries(RESOURCE_NAMES.map(key => [key, 0]));
const isReady = building => building.status === 'ready' && (building.type !== 'bell' || building.restored);
const readyCount = (state, type) => state.buildings.filter(b => b.type === type && isReady(b)).length;
const specFor = b => getBuildingSpec(b.type, b.level || 1);
const modifier = (state, type, key) => {
  const value = supplyModifiers(state, type)?.[key];
  return isFiniteNumber(value) ? value : ['arrival', 'happiness'].includes(key) ? 0 : 1;
};
const citizenNames = ['Ada', 'Bram', 'Cora', 'Dev', 'Elin', 'Finn', 'Greta', 'Hollis', 'Ida', 'Jory', 'Kit', 'Lina', 'Milo', 'Nell', 'Orin', 'Pia', 'Quinn', 'Remy', 'Sage', 'Tess', 'Una', 'Vale', 'Wren', 'Yara'];
function citizen(id, day = 1) {
  const index = id - 1, suffix = Math.floor(index / citizenNames.length);
  return { id: `c${id}`, name: citizenNames[index % citizenNames.length] + (suffix ? ` ${suffix + 1}` : ''), arrivalDay: day, job: 'idle', workplace: null };
}
function addEvent(state, text, type = 'info') {
  state.events.unshift({ id: state.nextEventId++, day: state.day, text, type });
  state.events.length = Math.min(JOURNAL_LIMIT, state.events.length);
}
// A journal is presentation history, not a source of rewards or simulation commands.
// Preserve valid entries without letting malformed optional history reject a village.
function restoreJournal(state, input) {
  const ids = new Set(), entries = [];
  for (const event of Array.isArray(input.events) ? input.events.slice(0, JOURNAL_LIMIT * 4) : []) {
    if (!event || typeof event !== 'object' || Array.isArray(event)
      || !validInteger(event.id, 1, Number.MAX_SAFE_INTEGER / 2) || ids.has(event.id)
      || !validInteger(event.day, 1, state.day)
      || typeof event.text !== 'string' || !event.text.trim() || event.text.length > 640
      || /[\x00-\x1f\x7f]/.test(event.text)) continue;
    ids.add(event.id);
    entries.push({ id: event.id, day: event.day, text: event.text,
      type: typeof event.type === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(event.type) ? event.type : 'info' });
  }
  state.events = entries.sort((a, b) => b.id - a.id).slice(0, JOURNAL_LIMIT);
  const next = (state.events[0]?.id || 0) + 1;
  state.nextEventId = validInteger(input.nextEventId, next, Number.MAX_SAFE_INTEGER / 2)
    ? input.nextEventId : next;
}
function progressionEvents(state, result) { for (const event of result?.events || []) if (typeof event.text === 'string') addEvent(state, event.text, event.type || 'progress'); }
function resourceCost(cost = {}) { return Object.fromEntries(RESOURCE_NAMES.filter(key => cost[key] > 0).map(key => [key, cost[key]])); }
function costMissing(state, cost) { return Object.entries(cost).filter(([key, value]) => (state.resources[key] || 0) + 1e-6 < value); }
function spend(state, cost) { for (const [key, value] of Object.entries(cost)) state.resources[key] = round(Math.max(0, state.resources[key] - value)); }
function refund(state, values) { for (const [key, value] of Object.entries(values)) state.resources[key] = Math.min(MAX_RESOURCE, round(state.resources[key] + value)); }
function constructionCost(type, level) { return level === 1 ? resourceCost(BUILDINGS[type].cost) : resourceCost(getUpgrade(type, level - 1)?.cost); }
function investmentFor(type, level, restored = true) {
  const result = emptyResources();
  if (type === 'hearth' || (type === 'bell' && !restored)) return result;
  for (let current = 1; current <= level; current++) for (const [key, value] of Object.entries(constructionCost(type, current))) result[key] += value;
  return result;
}
function baseBuilding(type, id, x, z, day = 1) {
  const spec = getBuildingSpec(type, 1);
  return { id, type, x, z, rotation: 0, builtDay: day, level: 1, status: 'ready', constructionKind: null, targetLevel: 1, progress: 0, workRequired: 0, escrow: {}, investment: investmentFor(type, 1, type !== 'bell'), queueOrder: 0, desiredWorkers: spec.workers || 0, workerIds: [], paused: false, priority: type === 'hearth' ? 100 : 10, production: null };
}

const gridDirections = [[0, 1], [1, 0], [0, -1], [-1, 0]];
export function buildingEntrance(building) {
  const [dx, dz] = gridDirections[building.rotation || 0]; return { x: building.x + dx, z: building.z + dz };
}
let walkableTerrain;
const navigationCache = new WeakMap();
function terrainNavigation() {
  if (!walkableTerrain) walkableTerrain = new Set(listTiles().filter(t => isLand(t.x, t.z) && isLand(t.x + .2, t.z + .2) && isLand(t.x - .2, t.z - .2) && !hasNaturalObstacle(t.x, t.z) && !isNeighborCompoundCell(t.x, t.z)).map(t => `${t.x},${t.z}`));
  return walkableTerrain;
}
function solidFortifications(state) {
  return (state.frontier?.fortifications || []).filter(f => f.status !== 'ruined' && !(f.type === 'gate' && f.open));
}
function reachedCells(occupied, extra = '', state = null) {
  terrainNavigation();
  const reached = new Set(), queue = [{ x: 0, z: 3 }];
  if (occupied.has('0,3') || extra === '0,3') return reached;
  reached.add('0,3');
  for (let head = 0; head < queue.length; head++) for (const [dx, dz] of gridDirections) {
    const x = queue[head].x + dx, z = queue[head].z + dz, key = `${x},${z}`;
    if (key === extra || reached.has(key) || occupied.has(key) || !walkableTerrain.has(key) || (state && !gateTransition(state, queue[head], { x, z }))) continue;
    reached.add(key); queue.push({ x, z });
  }
  return reached;
}
function placementAccess(state, x, z, rotation) {
  const forts = solidFortifications(state);
  const signature = state.buildings.map(b => `${b.id}:${b.x},${b.z},${b.rotation}`).join('|') + (state.frontier?.fortifications || []).map(f => `${f.id}:${f.x},${f.z},${f.rotation},${f.open},${f.status}`).join('|');
  let cache = navigationCache.get(state);
  if (cache?.signature !== signature) {
    const occupied = new Set([...state.buildings, ...forts].map(b => `${b.x},${b.z}`));
    cache = { signature, occupied, reached: reachedCells(occupied, '', state), entrances: state.buildings.map(buildingEntrance) }; navigationCache.set(state, cache);
  }
  const entrance = buildingEntrance({ x, z, rotation }), entranceKey = `${entrance.x},${entrance.z}`;
  if (!walkableTerrain.has(entranceKey)) return { ok: false, reason: 'Rotate the entrance toward clear land, away from trees, rocks, and the shore.' };
  if (cache.occupied.has(entranceKey)) return { ok: false, reason: 'The entrance faces another building. Rotate it toward an open lane.' };
  if (cache.entrances.some(front => front.x === x && front.z === z)) return { ok: false, reason: 'Keep this square open for the neighboring building’s entrance.' };
  const after = reachedCells(cache.occupied, `${x},${z}`, state);
  if (!after.has(entranceKey)) return { ok: false, reason: 'The entrance needs an open walking route back to the village footpath.' };
  if (cache.entrances.some(front => { const key = `${front.x},${front.z}`; return cache.reached.has(key) && !after.has(key); })) return { ok: false, reason: 'This would cut off a neighboring entrance. Leave a walking lane to the village footpath.' };
  return { ok: true, entrance };
}

/** The same terrain, occupancy and reserved approaches drive every frontier action. */
export function frontierContext(state) {
  const occupied = new Set(state.buildings.map(b => `${b.x},${b.z}`));
  const walkable = terrainNavigation();
  return {
    bounds: ISLAND_BOUNDS, home: { x: 0, z: 3 }, regions: ISLAND_REGIONS, neighbors: ISLAND_NEIGHBORS,
    isLand, regionAt, defenseMultiplier: modifier(state, 'barracks', 'defense'),
    isWalkable: (x, z) => walkable.has(`${Math.round(x)},${Math.round(z)}`) && !occupied.has(`${Math.round(x)},${Math.round(z)}`) && !isNeighborCompoundCell(x, z),
    canPlaceDefense: (type, x, z, rotation = 0, { planned = [] } = {}) => {
      if (occupied.has(`${x},${z}`)) return { ok: false, reason: 'A town building already occupies this square.' };
      if (neighborAt(x, z)) return { ok: false, reason: 'Leave the neighboring settlement and its approach clear.' };
      const tile = terrainAt(x, z);
      if (tile.kind === 'path' && type !== 'gate') return { ok: false, reason: 'Keep the island trail open with a gate.' };
      if (x === 2 && z >= 7) return { ok: false, reason: 'Keep the landing clear.' };
      if (state.buildings.some(b => { const front = buildingEntrance(b); return front.x === x && front.z === z; })) return { ok: false, reason: 'Leave the building entrance open.' };
      const blocked = new Set([...occupied, ...solidFortifications(state).map(f => `${f.x},${f.z}`)]);
      const before = reachedCells(blocked, '', state);
      const proposals = planned.length ? planned : [{ type, x, z, rotation, status: 'building', open: type === 'gate' }];
      for (const p of proposals) if (!(p.type === 'gate' && p.open)) blocked.add(`${p.x},${p.z}`);
      const draft = { ...state, frontier: { ...state.frontier, fortifications: [...state.frontier.fortifications, ...proposals] } };
      const after = reachedCells(blocked, '', draft);
      if (state.buildings.some(b => { const p = buildingEntrance(b), k = `${p.x},${p.z}`; return before.has(k) && !after.has(k); })) return { ok: false, reason: 'This would cut off a town entrance. Leave a gate and walking lane.' };
      return { ok: true };
    },
    canCloseGate: id => {
      const gate = state.frontier?.fortifications.find(f => f.id === id);
      if (!gate) return { ok: false, reason: 'Choose a gate.' };
      const blocked = new Set([...occupied, ...solidFortifications(state).filter(f => f.id !== id).map(f => `${f.x},${f.z}`)]);
      const before = reachedCells(blocked, '', state), after = reachedCells(blocked, `${gate.x},${gate.z}`, state);
      if (state.buildings.some(b => { const p = buildingEntrance(b), k = `${p.x},${p.z}`; return before.has(k) && !after.has(k); })) return { ok: false, reason: 'Closing this gate would cut off a town entrance. Leave another route open.' };
      return { ok: true };
    },
  };
}


export function createGame() {
  const resources = emptyResources(); Object.assign(resources, { wood: 100, stone: 70, food: 65, gold: 30 });
  const hearth = baseBuilding('hearth', 'hearth', 0, 2), bell = baseBuilding('bell', 'bell', 0, -5); bell.restored = false;
  const state = {
    version: VERSION, resources, population: 6, citizens: Array.from({ length: 6 }, (_, i) => ({ ...citizen(i + 1), experience: {} })),
    nextCitizenId: 7, calendarEpoch: 0, day: 1, time: 0, subsecond: 0, elapsed: 0, nextId: 1, nextEventId: 1, nextQueueOrder: 1,
    won: false, undo: null, lastTradeDay: 0, builderTarget: 2, morale: 78, buildings: [hearth, bell], events: [],
    woodland: createWoodland(), stats: { built: 0, arrivals: 0, harvests: 0, upgrades: 0 }, ...createProgressionState(), discovery: createDiscoveryState(), pressure: createPressureState(), frontier: createFrontierState({ regions: ISLAND_REGIONS, neighbors: ISLAND_NEIGHBORS }),
  };
  addEvent(state, 'Six founders share a hearth. Give builders a cottage to raise, then choose who will grow food and gather materials.', 'welcome');
  normalizeProgression(state); reconcileWorkforce(state); refreshProduction(state);
  return state;
}
export function getBuildingAt(state, x, z) { return state.buildings.find(b => b.x === x && b.z === z) || null; }
export function citizenSkill(person, job) { return 1 + Math.min(0.2, Math.max(0, person.experience?.[job] || 0) / 3600 * 0.2); }
function teach(person, job, seconds) { person.experience ||= {}; person.experience[job] = round(Math.min(72000, (person.experience[job] || 0) + seconds)); }
function rawQueue(state) { return state.buildings.filter(b => b.status !== 'ready').sort((a, b) => a.queueOrder - b.queueOrder || a.id.localeCompare(b.id)); }
function activeSite(state) { return rawQueue(state).find(b => !b.paused) || null; }
function housing(state) {
  return state.buildings.reduce((sum, b) => sum + ((b.status === 'ready' || b.constructionKind === 'upgrade') ? (specFor(b).housing || 0) : 0), 0);
}
export function storageCapacity(state) {
  const result = Object.fromEntries(RESOURCE_NAMES.map(key => [key, key === 'gold' || key === 'knowledge' ? 100000 : 200]));
  for (const b of state.buildings) if (isReady(b) && !b.paused) {
    const storage = specFor(b).storage;
    if (isFiniteNumber(storage)) { for (const key of RESOURCE_NAMES) if (!['gold', 'knowledge'].includes(key)) result[key] += storage; }
    else if (storage && typeof storage === 'object') for (const key of RESOURCE_NAMES) result[key] += storage[key] || 0;
  }
  const factor = modifier(state, 'warehouse', 'storage');
  for (const key of RESOURCE_NAMES) if (!['gold', 'knowledge'].includes(key)) result[key] = Math.floor(result[key] * factor);
  return result;
}
function reconcileWorkforce(state) {
  state.population = state.citizens.length;
  const old = new Map(state.citizens.map(c => [c.id, { workplace: c.workplace, job: c.job }]));
  for (const c of state.citizens) { c.workplace = null; c.job = 'idle'; c.experience ||= {}; }
  for (const b of state.buildings) b.workerIds = [];
  const assignments = new Map(frontierAssignments(state).map(a => [a.citizenId, a]));
  for (const c of state.citizens) if (assignments.has(c.id)) { const a = assignments.get(c.id); c.job = a.job; c.workplace = a.workplace; }
  const unused = new Set(state.citizens.filter(c => !assignments.has(c.id)).map(c => c.id));
  const allocate = (building, desired, job) => {
    const candidates = state.citizens.filter(c => unused.has(c.id)).sort((a, b) => {
      const ap = old.get(a.id)?.workplace === building.id, bp = old.get(b.id)?.workplace === building.id;
      return Number(bp) - Number(ap) || citizenSkill(b, job) - citizenSkill(a, job) || Number(a.id.slice(1)) - Number(b.id.slice(1));
    });
    for (const c of candidates.slice(0, desired)) { c.workplace = building.id; c.job = job; building.workerIds.push(c.id); unused.delete(c.id); }
  };
  const current = activeSite(state);
  for (const b of rawQueue(state)) b.status = b === current && state.builderTarget > 0 ? 'building' : 'queued';
  if (current) allocate(current, clamp(state.builderTarget, 0, state.population), 'builder');
  const jobs = state.buildings.filter(b => isReady(b) && !b.paused && (specFor(b).workers || 0) > 0).sort((a, b) => a.priority - b.priority || a.builtDay - b.builtDay || a.id.localeCompare(b.id));
  for (const b of jobs) allocate(b, clamp(b.desiredWorkers, 0, specFor(b).workers), specFor(b).job || b.type);
  state.storage = storageCapacity(state);
}
export function refreshTown(state) { reconcileWorkforce(state); refreshProduction(state); return state; }
export function workforce(state) {
  const builders = state.citizens.filter(c => c.job === 'builder'), employed = state.citizens.filter(c => c.job !== 'builder' && c.job !== 'idle');
  return {
    population: state.citizens.length, builders: builders.length, builderTarget: state.builderTarget, employed: employed.length,
    idle: state.citizens.length - builders.length - employed.length, assigned: builders.length + employed.length,
    builderIds: builders.map(c => c.id), citizens: state.citizens,
    jobs: state.buildings.filter(b => (specFor(b).workers || 0) > 0).map(b => {
      const people = state.citizens.filter(c => c.workplace === b.id && c.job !== 'builder'), job = specFor(b).job || b.type;
      return { id: b.id, type: b.type, name: BUILDINGS[b.type].name, workers: people.length, desired: b.desiredWorkers, max: specFor(b).workers, names: people.map(c => c.name), skillBonus: people.length ? people.reduce((sum, c) => sum + citizenSkill(c, job) - 1, 0) / people.length : 0 };
    }),
  };
}
function cancelRefund(building) {
  const remaining = 1 - clamp(building.progress / Math.max(1, building.workRequired), 0, 1);
  return Object.fromEntries(Object.entries(building.escrow).map(([key, value]) => [key, Math.floor(value * remaining + 1e-7)]));
}
export function constructionQueue(state) { return rawQueue(state).map(b => ({ id: b.id, type: b.type, name: BUILDINGS[b.type].name, kind: b.constructionKind, status: b.status, progress: b.progress, workRequired: b.workRequired, ratio: b.progress / b.workRequired, workers: b.workerIds.length, paused: b.paused, level: b.level, targetLevel: b.targetLevel, refund: cancelRefund(b) })); }
function nearTerrain(x, z, kind) {
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dz) <= 2.05 && terrainAt(x + dx, z + dz).kind === kind) return true;
  return false;
}
function adjacency(state, type, x, z) {
  const ready = state.buildings.filter(isReady), here = { x, z };
  let multiplier = 1, bonus = '', boosted = false;
  if (type === 'lumber') { boosted = nearTerrain(x, z, 'forest'); multiplier = boosted ? 1.5 : 1; bonus = boosted ? 'Woodland site · 50% more timber' : 'Near woodland: 50% more timber'; }
  if (type === 'quarry' || type === 'mine') { boosted = nearTerrain(x, z, 'rock'); multiplier = boosted ? 1.5 : 1; bonus = boosted ? 'Rocky site · 50% more output' : 'Near rock: 50% more output'; }
  if (type === 'orchard') { boosted = ready.some(b => b.type === 'garden' && distance(here, b) <= 2.01); multiplier = boosted ? 1.2 : 1; bonus = boosted ? 'Nearby garden · 20% more fruit' : 'Near a garden: 20% more fruit'; }
  if (type === 'garden') { const helpers = Math.min(3, ready.filter(b => b.type === 'cottage' && distance(here, b) <= 2.01).length); boosted = helpers > 0; multiplier += helpers * 0.1; bonus = helpers ? `${helpers} cottage neighbors · ${helpers * 10}% more food` : 'Each nearby cottage: 10% more food'; }
  return { multiplier, bonus, boosted };
}
function fullRecipe(state, building) {
  const spec = specFor(building), recipe = spec.recipe || { input: {}, output: {}, perDay: 1 }, site = adjacency(state, building.type, building.x, building.z);
  const factor = modifier(state, building.type, 'production') * discoveryModifier(state, building.type), cycles = isFiniteNumber(recipe.perDay) ? recipe.perDay : 1;
  return {
    input: Object.fromEntries(Object.entries(recipe.input || {}).map(([key, value]) => [key, value * cycles])),
    output: Object.fromEntries(Object.entries(recipe.output || {}).map(([key, value]) => [key, value * cycles * factor * site.multiplier])),
    ...site,
  };
}
function potentialProduction(state, building) {
  const spec = specFor(building), recipe = fullRecipe(state, building), workers = building.workerIds.length, required = spec.workers || 0;
  const people = state.citizens.filter(c => c.workplace === building.id && c.job !== 'builder');
  const experience = people.length ? people.reduce((sum, c) => sum + citizenSkill(c, spec.job || building.type), 0) / people.length : 1;
  const staffing = required ? workers / required : 1;
  let efficiency = staffing * experience, blockedReason = '';
  if (building.status !== 'ready') { efficiency = 0; blockedReason = building.constructionKind === 'upgrade' ? 'Closed for upgrading' : 'Under construction'; }
  else if (building.type === 'bell' && !building.restored) { efficiency = 0; blockedReason = 'Awaiting restoration'; }
  else if (building.paused) { efficiency = 0; blockedReason = 'Work paused'; }
  else if (required && !workers) { efficiency = 0; blockedReason = building.desiredWorkers ? 'No workers available' : 'No workers requested'; }
  const staffingReason = required && workers > 0 && workers < required ? `${workers}/${required} workers` : '';
  return { ...emptyResources(), input: recipe.input, output: recipe.output, efficiency, workers, required, blockedReason, staffingReason, bonus: recipe.bonus, boosted: recipe.boosted };
}
function throughput(state, building, dt = 1, mutate = false) {
  const potential = potentialProduction(state, building), factor = dt / DAY_LENGTH;
  let efficiency = potential.efficiency, reason = potential.blockedReason;
  for (const [key, value] of Object.entries(potential.input)) if (value > 0 && efficiency > 0) {
    const available = state.resources[key] / (value * factor);
    if (available < efficiency) { efficiency = Math.max(0, available); reason = `Needs ${key}`; }
  }
  const potentialFood = ((potential.output.food || 0) - (potential.input.food || 0)) * efficiency;
  const outputs = Object.entries(potential.output).filter(([, value]) => value > 0), storage = state.storage || storageCapacity(state);
  if (efficiency > 0 && outputs.length) {
    const room = Math.max(...outputs.map(([key, value]) => Math.max(0, storage[key] - state.resources[key]) / (value * factor)));
    if (room < efficiency) { efficiency = room; reason = 'Storage full'; }
  }
  if (building.type === 'lumber' && potential.output.wood > 0 && efficiency > 0) {
    const available = woodlandStatus(state, building).available / (potential.output.wood * factor);
    if (available < efficiency) { efficiency = available; reason = 'Young woodland growing · workers replant automatically'; }
  }
  const result = { ...potential, input: {}, output: {}, efficiency, potentialFood: round(potentialFood), blockedReason: reason };
  for (const [key, value] of Object.entries(potential.input)) {
    const amount = value * efficiency * factor; result.input[key] = round(amount / factor); result[key] -= result.input[key];
    if (mutate) state.resources[key] = round(Math.max(0, state.resources[key] - amount));
  }
  for (const [key, value] of outputs) {
    const amount = Math.min(Math.max(0, storage[key] - state.resources[key]), value * efficiency * factor);
    result.output[key] = round(amount / factor); result[key] += result.output[key];
    if (mutate) {
      const received = building.type === 'lumber' && key === 'wood' ? harvestWood(state, building, amount) : amount;
      state.resources[key] = round(state.resources[key] + received);
    }
  }
  if (mutate && efficiency > 0 && (outputs.length || specFor(building).service)) {
    const worked = Math.min(1, efficiency / Math.max(0.00001, potential.efficiency));
    for (const c of state.citizens) if (c.workplace === building.id && c.job !== 'builder') teach(c, c.job, dt * worked);
  }
  return result;
}
export function buildingYield(state, type, x, z) {
  const building = state.buildings.find(b => b.type === type && b.x === x && b.z === z);
  if (building) return throughput(state, building);
  if (!validType(type)) return { ...emptyResources(), bonus: '', boosted: false };
  const fake = baseBuilding(type, 'preview', x, z), recipe = fullRecipe(state, fake);
  const values = emptyResources(); for (const [key, value] of Object.entries(recipe.output)) values[key] += value;
  for (const [key, value] of Object.entries(recipe.input)) values[key] -= value;
  return { ...values, ...recipe, workers: specFor(fake).workers || 0, required: specFor(fake).workers || 0, efficiency: 1, blockedReason: '' };
}
function foodUpkeep(state) { return round(state.population * 0.8 * modifier(state, 'hearth', 'foodConsumption')); }
const SERVICE_KINDS = ['water', 'health', 'faith', 'security', 'leisure', 'civic', 'community'];
const SERVICE_CAPACITY = { water: 35, health: 30, faith: 24, security: 30, leisure: 24, civic: 40 };

/** Finite provider-to-home flow. Residual paths let overlapping services reach all feasible homes. */
function allocateService(homes, providers) {
  const demand = homes.reduce((sum, home) => sum + home.beds, 0), capacity = providers.reduce((sum, p) => sum + p.capacity, 0);
  const source = 0, firstProvider = 1, firstHome = providers.length + 1, sink = firstHome + homes.length;
  const graph = Array.from({ length: sink + 1 }, () => []), providerEdges = [], homeEdges = [];
  const edge = (from, to, amount) => {
    const forward = { to, remaining: amount, reverse: graph[to].length }, backward = { to: from, remaining: 0, reverse: graph[from].length };
    graph[from].push(forward); graph[to].push(backward); return forward;
  };
  providers.forEach((provider, i) => {
    providerEdges.push(edge(source, firstProvider + i, provider.capacity));
    // Serve close homes first; augmenting paths preserve capacity when catchments overlap.
    homes.map((home, index) => ({ home, index, distance: distance(home, provider) })).filter(item => item.distance <= provider.radius)
      .sort((a, b) => a.distance - b.distance || a.index - b.index)
      .forEach(({ home, index }) => edge(firstProvider + i, firstHome + index, home.beds));
  });
  homes.forEach((home, i) => homeEdges.push(edge(firstHome + i, sink, home.beds)));
  while (true) {
    const previous = new Array(graph.length).fill(null), queue = [source]; previous[source] = { from: -1 };
    for (let head = 0; head < queue.length && !previous[sink]; head++) {
      const from = queue[head];
      for (let index = 0; index < graph[from].length; index++) {
        const next = graph[from][index];
        if (next.remaining <= 1e-8 || previous[next.to]) continue;
        previous[next.to] = { from, index }; queue.push(next.to);
        if (next.to === sink) break;
      }
    }
    if (!previous[sink]) break;
    let amount = Infinity;
    for (let node = sink; node !== source; node = previous[node].from) amount = Math.min(amount, graph[previous[node].from][previous[node].index].remaining);
    for (let node = sink; node !== source; node = previous[node].from) {
      const next = graph[previous[node].from][previous[node].index]; next.remaining -= amount; graph[node][next.reverse].remaining += amount;
    }
  }
  const allocations = homes.map((home, i) => Math.max(0, home.beds - homeEdges[i].remaining));
  const served = allocations.reduce((sum, amount) => sum + amount, 0);
  return {
    coverage: demand ? clamp(served / demand, 0, 1) : 0, demand, capacity, served, unusedCapacity: Math.max(0, capacity - served),
    coveredHomes: allocations.filter(amount => amount > 1e-8).length,
    fullyCoveredHomes: allocations.filter((amount, i) => amount + 1e-8 >= homes[i].beds).length,
    totalHomes: homes.length, active: providers.filter(p => p.capacity > 1e-8).length,
    providers: providers.map((provider, i) => ({ ...provider, served: Math.max(0, provider.capacity - providerEdges[i].remaining) })), allocations,
  };
}

function serviceAccess(state) {
  const homes = state.buildings.filter(b => (b.status === 'ready' || b.constructionKind === 'upgrade') && (specFor(b).housing || 0) > 0)
    .map(b => ({ id: b.id, x: b.x, z: b.z, beds: specFor(b).housing, coverage: {}, served: {} }));
  const providers = state.buildings.filter(b => specFor(b).service).map(b => {
    const spec = specFor(b), service = spec.service;
    const efficiency = !isReady(b) || b.paused ? 0 : spec.workers ? clamp(b.production?.efficiency || 0, 0, 1.2) : 1;
    const potentialCapacity = (service.capacity ?? SERVICE_CAPACITY[service.kind] ?? 0) * (service.strength || 1);
    return { id: b.id, kind: service.kind, x: b.x, z: b.z, radius: service.radius, potentialCapacity, efficiency, capacity: potentialCapacity * efficiency,
      nearbyDemand: homes.filter(home => distance(home, b) <= service.radius).reduce((sum, home) => sum + home.beds, 0) };
  });
  const services = {};
  for (const kind of SERVICE_KINDS) {
    const relevant = providers.filter(p => kind === 'community' ? p.kind === 'faith' || p.kind === 'leisure' : p.kind === kind);
    const allocation = allocateService(homes, relevant);
    homes.forEach((home, i) => { home.served[kind] = allocation.allocations[i]; home.coverage[kind] = clamp(allocation.allocations[i] / home.beds, 0, 1); });
    const { allocations: _allocations, ...summary } = allocation; services[kind] = summary;
  }
  return { homes, services };
}
export function villageNeeds(state) {
  const food = foodUpkeep(state), beds = housing(state), spare = Math.max(0, beds - state.population), extra = modifier(state, 'cottage', 'arrival');
  let expected = Math.min(Math.max(0, 2 + Math.floor(extra)), spare, Math.max(0, Math.floor((state.resources.food - food) / 4))), reason = 'New settlers can arrive with the next supply boat.';
  if (!spare) { expected = 0; reason = 'More completed housing is needed.'; }
  else if (state.morale < 45) { expected = 0; reason = 'Raise morale to 45 before new settlers arrive.'; }
  else if (state.resources.food < food + 4) { expected = 0; reason = 'Keep the next meal and 4 extra food per newcomer in the pantry.'; }
  const { homes, services } = serviceAccess(state);
  const civicNeeds = [
    { population: 20, coverage: services.water.coverage, target: .5, reason: 'A growing town needs wells covering at least half its housing.' },
    { population: 40, coverage: services.health.coverage, target: .4, reason: 'Staff and supply clinics covering at least 40% of housing before welcoming more citizens.' },
    { population: 60, coverage: services.community.coverage, target: .35, reason: 'Staffed chapels and supplied brewhouses must together serve at least 35% of housing for a larger community.' },
  ];
  for (const need of civicNeeds) if (need.coverage < need.target && expected > 0) {
    if (state.population >= need.population) { expected = 0; reason = need.reason; }
    else expected = Math.min(expected, need.population - state.population);
  }
  return { food: { have: state.resources.food, required: food, satisfied: state.resources.food >= food }, housing: { have: beds, required: state.population, satisfied: beds >= state.population }, services, homes, migration: { eligible: expected > 0, reason, expected }, morale: state.morale };
}
function updateNeeds(state) {
  state.storage = storageCapacity(state); const needs = villageNeeds(state); state.migration = needs.migration;
  state.serviceCoverage = Object.fromEntries(Object.entries(needs.services).map(([kind, service]) => [kind, service.coverage]));
  state.foodBalance = round(state.buildings.reduce((sum, b) => sum + (b.production?.food || 0), 0) - foodUpkeep(state));
  state.foodPotentialBalance = round(state.buildings.reduce((sum, b) => sum + (b.production?.potentialFood || 0), 0) - foodUpkeep(state));
}
export function rates(state) {
  const result = emptyResources(), buildings = {}; let foodProduced = 0;
  for (const b of state.buildings) {
    const current = b.production || throughput(state, b); buildings[b.id] = current;
    for (const key of RESOURCE_NAMES) result[key] += current[key] || 0;
    foodProduced += current.output?.food || 0;
  }
  const foodConsumed = foodUpkeep(state); result.food -= foodConsumed;
  for (const key of RESOURCE_NAMES) result[key] = round(result[key]);
  return { ...result, foodProduced, foodConsumed, capacity: housing(state), happiness: state.morale, morale: state.morale, storage: storageCapacity(state), buildings };
}
function refreshProduction(state) { for (const b of state.buildings) b.production = throughput(state, b); updateNeeds(state); }
export function buildingStatus(state, idOrBuilding) {
  const b = typeof idOrBuilding === 'object' ? idOrBuilding : state.buildings.find(item => item.id === idOrBuilding);
  if (!b) return null;
  const spec = specFor(b), production = b.production || throughput(state, b), queued = b.status !== 'ready';
  const reason = queued ? (b.paused ? 'Construction paused' : b.workerIds.length ? `${b.workerIds.length} builders at work` : state.builderTarget ? 'Waiting for builders ahead in the queue' : 'Assign builders to begin work') : (production.blockedReason || production.staffingReason);
  return { label: queued ? (b.constructionKind === 'upgrade' ? 'Upgrading' : 'Construction') : b.paused ? 'Paused' : production.efficiency ? 'Working' : 'Ready', reason, blockedReason: reason, level: b.level, status: b.status, paused: b.paused, workers: b.workerIds.length, desiredWorkers: b.desiredWorkers, maxWorkers: spec.workers || 0, efficiency: production.efficiency, progress: b.progress, workRequired: b.workRequired, ratio: b.workRequired ? b.progress / b.workRequired : 1, recipe: { input: production.input, output: production.output }, housing: spec.housing || 0 };
}
export function canBuild(state, type, x, z, rotation = 0) {
  if (!validType(type) || type === 'hearth') return { ok: false, reason: 'Choose a building from the tray.' };
  if (!validInteger(x, ISLAND_BOUNDS.minX, ISLAND_BOUNDS.maxX) || !validInteger(z, ISLAND_BOUNDS.minZ, ISLAND_BOUNDS.maxZ)) return { ok: false, reason: 'Choose a square on the island.' };
  if (!validInteger(rotation, 0, 3)) return { ok: false, reason: 'Choose one of the four building rotations.' };
  const preview = buildingYield(state, type, x, z), base = { bonus: preview.bonus, yield: preview, boosted: preview.boosted };
  const fail = reason => ({ ...base, ok: false, reason });
  const unlocked = canUnlockBuilding(state, type); if (!unlocked.ok) return fail(unlocked.reason);
  if (type === 'bell') {
    const bell = getBuildingAt(state, 0, -5);
    if (x !== 0 || z !== -5) return fail('The old bell stands on the northern hill.');
    if (bell.restored || bell.status !== 'ready') return fail(bell.restored ? 'The bell is restored; this is the beginning of a growing town.' : 'The bell is already in the construction queue.');
    if (readyCount(state, 'cottage') < 3 || readyCount(state, 'orchard') + readyCount(state, 'garden') < 2 || state.population < 10) return fail('Needs 3 completed cottages, 2 completed orchards or gardens, and 10 citizens.');
  } else {
    const terrain = terrainAt(x, z);
    if (getBuildingAt(state, x, z)) return fail('There is already a building or construction site here.');
    if (state.frontier?.units.some(u => !['dead','released'].includes(u.status) && (Math.round(u.x) === x && Math.round(u.z) === z || ['move','retreat'].includes(u.order?.type) && Math.round(u.order.x) === x && Math.round(u.order.z) === z))) return fail('Wait for the company to clear this building site and its ordered destination.');
    if (terrain.kind === 'water') return fail('Build on dry land.');
    if (terrain.kind === 'path') return fail('Keep the village footpath open.');
    if (state.frontier?.fortifications.some(f => f.x === x && f.z === z)) return fail('A defense or its remains occupies this square.');
    const region = regionAt(x, z);
    if (region && !state.frontier?.claims.includes(region.id)) return fail(`Survey ${region.name} with a troop, then complete a claiming outpost in Frontier.`);
    if (!terrain.buildable) return fail('Leave room beside the shore.');
    const access = placementAccess(state, x, z, rotation); if (!access.ok) return fail(access.reason); base.entrance = access.entrance;
  }
  const cost = resourceCost(BUILDINGS[type].cost), missing = costMissing(state, cost);
  if (missing.length) return fail(`Needs ${missing.map(([key, value]) => `${Math.ceil(value - state.resources[key])} more ${key}`).join(', ')}.`);
  return { ...base, ok: true, cost, work: BUILDINGS[type].work || 30, reason: `Reserve materials and queue ${BUILDINGS[type].name.toLowerCase()}.` };
}
function queueWork(state, building, kind, targetLevel, cost, work) {
  spend(state, cost); building.status = 'queued'; building.constructionKind = kind; building.targetLevel = targetLevel;
  building.progress = 0; building.workRequired = Math.max(1, work); building.escrow = { ...cost };
  building.queueOrder = state.nextQueueOrder++; building.paused = false; building.production = null;
  reconcileWorkforce(state); refreshProduction(state);
}
export function build(state, type, x, z, rotation = 0) {
  const permission = canBuild(state, type, x, z, rotation); if (!permission.ok) return permission;
  let building;
  if (type === 'bell') building = getBuildingAt(state, 0, -5);
  else {
    building = baseBuilding(type, `b${state.nextId++}`, x, z, state.day);
    building.rotation = validInteger(rotation, 0, 3) ? rotation : 0; building.investment = emptyResources();
    state.buildings.push(building);
  }
  queueWork(state, building, 'build', 1, permission.cost, permission.work);
  for (const unit of state.frontier?.units || []) { unit.path = []; unit.routeAt = -10; }
  state.undo = { id: building.id, day: state.day };
  addEvent(state, `${BUILDINGS[type].name} is planned. Materials reserved; builders will work in queue order.`, 'construction');
  return { ...permission, building };
}
export function canUpgrade(state, id) {
  const b = typeof id === 'object' ? id : state.buildings.find(item => item.id === id);
  if (!b) return { ok: false, reason: 'Choose a completed building.' };
  if (b.status !== 'ready') return { ok: false, reason: 'Finish the current construction first.' };
  if (b.type === 'bell' && !b.restored) return { ok: false, reason: 'Restore the bell before improving it.' };
  const upgrade = getUpgrade(b.type, b.level);
  if (!upgrade) return { ok: false, reason: 'This building is fully developed.' };
  const targetLevel = b.level + 1, cost = resourceCost(upgrade.cost), work = upgrade.work || 60;
  if (upgrade.requires || upgrade.unlock) {
    const research = state.research?.completed || [];
    const required = Array.isArray(upgrade.requires || upgrade.unlock) ? (upgrade.requires || upgrade.unlock) : [upgrade.requires || upgrade.unlock];
    if (!required.every(id => research.includes(id))) return { ok: false, reason: `Research ${required.filter(id => !research.includes(id)).join(', ')} first.`, cost, work, targetLevel };
  }
  const missing = costMissing(state, cost);
  if (missing.length) return { ok: false, reason: `Needs ${missing.map(([key, value]) => `${Math.ceil(value - state.resources[key])} more ${key}`).join(', ')}.`, cost, work, targetLevel };
  return { ok: true, reason: `Upgrade to level ${targetLevel}. Production closes until builders finish.`, cost, work, targetLevel };
}
export function queueUpgrade(state, id) {
  const permission = canUpgrade(state, id); if (!permission.ok) return permission;
  const building = state.buildings.find(b => b.id === (typeof id === 'object' ? id.id : id));
  queueWork(state, building, 'upgrade', permission.targetLevel, permission.cost, permission.work); state.undo = null;
  addEvent(state, `${BUILDINGS[building.type].name} is closed for its level ${permission.targetLevel} upgrade.`, 'upgrade');
  return { ...permission, building };
}
export function reorderConstruction(state, id, direction) {
  const queue = rawQueue(state), index = queue.findIndex(b => b.id === id), step = direction === 'up' || direction === -1 ? -1 : direction === 'down' || direction === 1 ? 1 : 0;
  if (index < 0 || !step || !queue[index + step]) return { ok: false, reason: 'That construction cannot move farther in this direction.' };
  [queue[index].queueOrder, queue[index + step].queueOrder] = [queue[index + step].queueOrder, queue[index].queueOrder];
  reconcileWorkforce(state); refreshProduction(state); return { ok: true, reason: 'Construction priority changed.' };
}
export function cancelConstruction(state, id) {
  const index = state.buildings.findIndex(b => b.id === id), building = state.buildings[index];
  if (!building || building.status === 'ready') return { ok: false, reason: 'Choose an unfinished construction project.' };
  const recovered = cancelRefund(building); refund(state, recovered);
  if (building.constructionKind === 'upgrade' || building.type === 'bell') {
    building.status = 'ready'; building.constructionKind = null; building.targetLevel = building.level;
    building.progress = 0; building.workRequired = 0; building.escrow = {}; building.paused = false;
  } else state.buildings.splice(index, 1);
  state.undo = null; reconcileWorkforce(state); refreshProduction(state);
  addEvent(state, `${BUILDINGS[building.type].name} construction cancelled. Unused materials were recovered.`, 'cancel');
  return { ok: true, reason: 'Unused materials recovered; completed work has consumed its share.', refund: recovered, building };
}
export function undo(state) {
  if (!state.undo) return { ok: false, reason: 'Your latest unfinished building can be cancelled for unused materials.' };
  return cancelConstruction(state, state.undo.id);
}
export function demolish(state, id) {
  const index = state.buildings.findIndex(b => b.id === id), building = state.buildings[index];
  if (!building) return { ok: false, reason: 'Choose a building to remove.' };
  if (building.status !== 'ready') return cancelConstruction(state, id);
  if (building.type === 'hearth' || building.type === 'bell') return { ok: false, reason: 'This is part of the island’s story.' };
  if ((specFor(building).housing || 0) > 0 && housing(state) - specFor(building).housing < state.population) return { ok: false, reason: 'Complete replacement housing before removing an occupied home.' };
  const recovered = Object.fromEntries(Object.entries(building.investment).map(([key, value]) => [key, Math.floor(value * 0.75)]));
  refund(state, recovered); state.buildings.splice(index, 1); state.undo = null;
  for (const unit of state.frontier?.units || []) { unit.path = []; unit.routeAt = -10; } reconcileWorkforce(state); refreshProduction(state);
  addEvent(state, `${BUILDINGS[building.type].name} salvaged. Three quarters of its materials are available again.`, 'remove');
  return { ok: true, reason: 'Recovered 75% of invested materials.', refund: recovered, building };
}
export function setWorkers(state, id, requested) {
  const b = state.buildings.find(item => item.id === id);
  if (!b || !validInteger(requested, 0, specFor(b).workers || 0)) return { ok: false, reason: 'Choose a valid number of workers for this building.' };
  b.desiredWorkers = requested; reconcileWorkforce(state); refreshProduction(state);
  return { ok: true, reason: `${requested} workers requested. Builders and higher priority workplaces are filled first.` };
}
export function setBuilderTarget(state, requested) {
  if (!validInteger(requested, 0, state.population)) return { ok: false, reason: 'Builder target must fit the available population.' };
  state.builderTarget = requested; reconcileWorkforce(state); refreshProduction(state); return { ok: true, reason: `${requested} citizens available for construction.` };
}
export function pauseBuilding(state, id, value) {
  const b = state.buildings.find(item => item.id === id); if (!b) return { ok: false, reason: 'Choose a building.' };
  b.paused = typeof value === 'boolean' ? value : !b.paused; reconcileWorkforce(state); refreshProduction(state);
  return { ok: true, reason: b.paused ? 'Work paused; citizens are available for other jobs.' : 'Work resumed.', paused: b.paused };
}
export function setPriority(state, id, value) {
  const b = state.buildings.find(item => item.id === id); if (!b || !validInteger(value, 0, 100)) return { ok: false, reason: 'Priority must be from 0 to 100; lower numbers are filled first.' };
  b.priority = value; reconcileWorkforce(state); refreshProduction(state); return { ok: true, reason: 'Workplace priority updated.' };
}
function completeConstruction(state, b) {
  const upgrading = b.constructionKind === 'upgrade'; b.level = b.targetLevel; b.status = 'ready'; b.constructionKind = null;
  for (const [key, value] of Object.entries(b.escrow)) b.investment[key] = (b.investment[key] || 0) + value;
  b.escrow = {}; b.progress = b.workRequired; b.desiredWorkers = specFor(b).workers || 0;
  if (state.undo?.id === b.id) state.undo = null;
  if (b.type === 'bell' && !b.restored) {
    b.restored = true; b.restoredDay = state.day; state.won = true; state.wonDay = state.day;
    addEvent(state, 'The bell rings again. Your village is on the map; now choose what kind of town it will become.', 'milestone');
  } else addEvent(state, `${BUILDINGS[b.type].name} ${upgrading ? `reopens at level ${b.level}` : 'is complete'}. ${specFor(b).workers ? 'Its workplace is ready for citizens.' : 'The neighborhood has grown.'}`, upgrading ? 'upgrade' : 'complete');
  state.stats[upgrading ? 'upgrades' : 'built']++;
}
function construct(state, dt) {
  let remaining = dt, completed = 0;
  while (remaining > 1e-8) {
    reconcileWorkforce(state); const site = activeSite(state); if (!site || !site.workerIds.length) break;
    const builders = state.citizens.filter(c => c.workplace === site.id && c.job === 'builder');
    const power = builders.reduce((sum, c) => sum + citizenSkill(c, 'builder'), 0) * modifier(state, site.type, 'construction') * discoveryModifier(state, site.type, 'construction');
    if (!(power > 0)) break;
    const duration = Math.min(remaining, Math.max(0, site.workRequired - site.progress) / power);
    site.progress = Math.min(site.workRequired, round(site.progress + duration * power));
    for (const person of builders) teach(person, 'builder', duration);
    remaining -= duration;
    if (site.progress + 1e-6 >= site.workRequired) { completeConstruction(state, site); completed++; }
    else break;
  }
  return completed;
}
function dawn(state) {
  state.day++; state.time -= DAY_LENGTH; state.stats.harvests++;
  const due = foodUpkeep(state), fed = state.resources.food + 1e-6 >= due;
  state.resources.food = round(Math.max(0, state.resources.food - due));
  const housed = housing(state) >= state.population;
  const access = villageNeeds(state).services;
  const service = ['water', 'health', 'community', 'security', 'civic'].reduce((sum, kind) => sum + access[kind].coverage * 5, 0);
  const target = clamp(60 + (fed ? 10 : -35) + (housed ? 5 : -20) + Math.min(20, service) + modifier(state, 'hearth', 'happiness'), 10, 100);
  state.morale = round(clamp(state.morale + (target - state.morale) * 0.35, 10, 100));
  const needs = villageNeeds(state), arrivals = needs.migration.expected;
  if (arrivals > 0) {
    for (let i = 0; i < arrivals; i++) state.citizens.push({ ...citizen(state.nextCitizenId++, state.day), experience: {} });
    state.resources.food = round(state.resources.food - arrivals * 4); state.stats.arrivals += arrivals;
    addEvent(state, `${arrivals} ${arrivals === 1 ? 'new citizen has' : 'new citizens have'} arrived. Assign their skills to the town’s next task.`, 'arrival');
  } else addEvent(state, `${!fed ? 'The pantry could not feed everyone. Gardens need workers.' : needs.migration.reason}`, fed ? 'dawn' : 'food');
  reconcileWorkforce(state); refreshProduction(state); progressionEvents(state, dailyProgression(state)); reconcileWorkforce(state); refreshProduction(state);
  progressionEvents(state, dailyPressure(state)); updateNeeds(state);
  return arrivals;
}
export function tick(state, dt) {
  const result = { newDay: false, days: 0, arrivals: 0, completed: 0, changed: false, won: state.won, frontierEvents: [] };
  if (!isFiniteNumber(dt) || dt <= 0) return result;
  let remaining = Math.min(dt, DAY_LENGTH * 30);
  state.elapsed = round(state.elapsed + remaining);
  // Combat advances at its authoritative quarter-second boundary. Economy remains
  // one-second deterministic, including when a frame or restored save straddles it.
  while (remaining > 1e-8) {
    const slice = Math.min(remaining, 1 - state.subsecond, .25 - state.frontier.subsecond);
    const assignments = frontierAssignments(state).map(a => `${a.citizenId}:${a.job}:${a.workplace}`).join('|');
    const frontierResult = tickFrontier(state, slice, frontierContext(state));
    progressionEvents(state, frontierResult); result.frontierEvents.push(...frontierResult.events);
    result.changed ||= frontierResult.changed;
    if (frontierResult.casualties.length) {
      const fallen = new Set(frontierResult.casualties);
      state.citizens = state.citizens.filter(c => !fallen.has(c.id)); state.population = state.citizens.length;
      state.builderTarget = Math.min(state.builderTarget, state.population);
    }
    const nextAssignments = frontierAssignments(state).map(a => `${a.citizenId}:${a.job}:${a.workplace}`).join('|');
    if (assignments !== nextAssignments || frontierResult.casualties.length) { reconcileWorkforce(state); refreshProduction(state); }
    state.subsecond = round(state.subsecond + slice); remaining = round(Math.max(0, remaining - slice));
    if (state.subsecond + 1e-8 < 1) continue;
    state.subsecond = round(Math.max(0, state.subsecond - 1));
    const oldJobs = state.citizens.map(c => `${c.id}:${c.workplace}:${c.job}`).join('|');
    result.completed += construct(state, 1); reconcileWorkforce(state);
    result.changed = tickWoodland(state, 1) || result.changed;
    for (const b of state.buildings) b.production = throughput(state, b, 1, true);
    const pressureResult = tickPressure(state, 1); progressionEvents(state, pressureResult); result.changed ||= pressureResult.changed;
    const beforeResearch = JSON.stringify(state.research); progressionEvents(state, tickProgression(state, 1));
    state.time++; if (state.time >= DAY_LENGTH) { result.arrivals += dawn(state); result.days++; result.newDay = true; }
    if (JSON.stringify(state.research) !== beforeResearch) result.changed = true;
    if (state.citizens.map(c => `${c.id}:${c.workplace}:${c.job}`).join('|') !== oldJobs) result.changed = true;
    updateNeeds(state);
  }
  result.changed ||= result.completed > 0 || result.newDay; result.won = state.won; return result;
}
export function tradeOffer(state, resource) {
  const baseAmount = resource === 'wood' ? 12 : resource === 'stone' ? 10 : 0;
  const amount = Math.floor(baseAmount * modifier(state, 'market', 'tradeReward')), reserve = Math.ceil(foodUpkeep(state)), offer = { cost: 12, amount, reserve };
  const fail = reason => ({ ...offer, ok: false, reason });
  if (!baseAmount) return fail('The landing exchanges food for timber or stone.');
  if (state.population < 6) return fail('Supply skiffs stop when 6 citizens call the village home.');
  if (state.lastTradeDay === state.day) return fail('This skiff’s exchange is complete. Another passes every 90 seconds at 1×.');
  if (state.resources.food < offer.cost + reserve) return fail(`Keep ${reserve} food for the next meal. The pantry needs ${offer.cost + reserve} food.`);
  if (state.resources[resource] + amount > storageCapacity(state)[resource]) return fail(`There is no storage room for this ${resource} delivery.`);
  return { ...offer, ok: true, reason: `Exchange 12 food for ${amount} ${resource === 'wood' ? 'timber' : 'stone'}.` };
}
export function trade(state, resource) {
  const offer = tradeOffer(state, resource); if (!offer.ok) return offer;
  state.resources.food = round(state.resources.food - offer.cost); state.resources[resource] += offer.amount; state.lastTradeDay = state.day;
  addEvent(state, `The landing exchanged 12 food for ${offer.amount} ${resource === 'wood' ? 'timber' : 'stone'}.`, 'trade'); updateNeeds(state); return { ...offer, resource };
}
export function actOnPressure(state, action) {
  refreshProduction(state);
  const result = pressureAction(state, action);
  progressionEvents(state, result); refreshProduction(state); return result;
}
export function objective(state) {
  if (state.won) return progressionObjective(state);
  const cottages = readyCount(state, 'cottage'), food = readyCount(state, 'orchard') + readyCount(state, 'garden');
  if (!cottages) {
    const site = state.buildings.find(b => b.type === 'cottage');
    return { title: site ? 'Raise the first roof' : 'Give the builders a beginning', description: site ? 'Builders use real time and labor. Keep two assigned, or choose who can leave another job to help.' : 'Queue a cottage. Materials are reserved now; housing opens when builders finish.', current: site?.progress || 0, total: site?.workRequired || 1, complete: false, step: 0, type: 'cottage' };
  }
  if (!food) return { title: 'Give the harvest a pair of hands', description: 'Complete an orchard or garden, then assign citizens. Empty workplaces produce nothing.', current: 0, total: 1, complete: false, step: 1, type: 'orchard' };
  const industry = Math.min(1, readyCount(state, 'lumber')) + Math.min(1, readyCount(state, 'quarry'));
  if (industry < 2) return { title: 'Build a working settlement', description: 'Complete woodcutting and stoneworks. Match the jobs you request to the citizens available.', current: industry, total: 2, complete: false, step: 2, type: readyCount(state, 'lumber') ? 'quarry' : 'lumber' };
  if (cottages < 3 || food < 2) return { title: 'Make room for the next neighbors', description: `${Math.min(cottages, 3)}/3 finished cottages · ${Math.min(food, 2)}/2 food gardens. Construction and production share the same workers.`, current: Math.min(cottages, 3) + Math.min(food, 2), total: 5, complete: false, step: 3, type: cottages < 3 ? 'cottage' : 'garden' };
  if (state.population < 10) return { title: 'A town needs people', description: `${state.migration?.reason || 'Keep spare housing and food for newcomers.'} Welcome 10 citizens.`, current: state.population, total: 10, complete: false, step: 4 };
  const bell = state.buildings.find(b => b.type === 'bell');
  if (bell.status !== 'ready') return { title: 'Raise a sound across the water', description: 'Finish restoring the bell. This first milestone opens the village’s wider future.', current: bell.progress, total: bell.workRequired, complete: false, step: 5, type: 'bell' };
  const cost = resourceCost(BUILDINGS.bell.cost);
  return { title: 'Put your village on the map', description: 'Restore the bell, then develop workshops, research, services and trade. The town’s story is just beginning.', current: Object.entries(cost).reduce((sum, [key, value]) => sum + Math.min(value, state.resources[key]), 0), total: Object.values(cost).reduce((sum, value) => sum + value, 0), complete: false, step: 5, type: 'bell' };
}
/** The v3 envelope is self-contained; ephemeral assignments/rates are reconciled on load. */
export function serialize(state) {
  const copy = { ...state, undo: null, buildings: state.buildings.map(({ production: _production, workerIds: _workers, ...b }) => b), citizens: state.citizens.map(c => ({ id: c.id, name: c.name, arrivalDay: c.arrivalDay, experience: { ...c.experience }, job: c.job, workplace: c.workplace })) };
  delete copy.storage; delete copy.migration; delete copy.serviceCoverage; delete copy.foodBalance; delete copy.foodPotentialBalance; return JSON.stringify(copy);
}
function validBag(bag, { complete = false } = {}) {
  return !!bag && typeof bag === 'object' && !Array.isArray(bag) && Object.keys(bag).every(key => RESOURCE_NAMES.includes(key) && isFiniteNumber(bag[key]) && bag[key] >= 0 && bag[key] <= MAX_RESOURCE) && (!complete || RESOURCE_NAMES.every(key => isFiniteNumber(bag[key])));
}
function readBasicBuilding(value, day, ids, cells) {
  if (!value || typeof value !== 'object' || !validType(value.type)) return null;
  if (typeof value.id !== 'string' || !/^(?:hearth|bell|b[1-9][0-9]{0,8})$/.test(value.id) || ids.has(value.id)) return null;
  if (!validInteger(value.x, ISLAND_BOUNDS.minX, ISLAND_BOUNDS.maxX) || !validInteger(value.z, ISLAND_BOUNDS.minZ, ISLAND_BOUNDS.maxZ) || !validInteger(value.rotation, 0, 3) || !validInteger(value.builtDay, 1, day)) return null;
  const cell = `${value.x},${value.z}`; if (cells.has(cell)) return null;
  const fixed = FIXED[value.type];
  if (fixed ? value.id !== fixed.id || value.x !== fixed.x || value.z !== fixed.z : !/^b[1-9]/.test(value.id) || !terrainAt(value.x, value.z).buildable) return null;
  const b = baseBuilding(value.type, value.id, value.x, value.z, value.builtDay); b.rotation = value.rotation;
  if (value.type === 'bell') {
    if (typeof value.restored !== 'boolean') return null; b.restored = value.restored;
    if (value.restored) { if (!validInteger(value.restoredDay, 1, day)) return null; b.restoredDay = value.restoredDay; }
  }
  ids.add(value.id); cells.add(cell); return b;
}
function restoreV1(input) {
  if (!input.resources || !['wood', 'stone', 'food'].every(key => isFiniteNumber(input.resources[key]) && input.resources[key] >= 0 && input.resources[key] <= MAX_RESOURCE)) return null;
  if (!validInteger(input.population, 4, 1000) || !Array.isArray(input.buildings) || input.buildings.length < 2 || input.buildings.length > MAX_BUILDINGS) return null;
  const state = createGame(), ids = new Set(), cells = new Set(); state.buildings = [];
  for (const value of input.buildings) { const b = readBasicBuilding(value, input.day, ids, cells); if (!b) return null; b.investment = investmentFor(b.type, 1, b.restored); state.buildings.push(b); }
  if (!ids.has('hearth') || !ids.has('bell') || input.population > housing(state)) return null;
  const bell = state.buildings.find(b => b.id === 'bell'); if (typeof input.won !== 'boolean' || input.won !== bell.restored) return null;
  state.resources = emptyResources(); Object.assign(state.resources, { wood: input.resources.wood, stone: input.resources.stone, food: input.resources.food });
  state.citizens = Array.from({ length: input.population }, (_, i) => ({ ...citizen(i + 1, 1), experience: {} })); state.nextCitizenId = input.population + 1;
  state.day = input.day; state.time = Math.floor(input.time); state.subsecond = input.time % 1; state.elapsed = input.elapsed; state.won = bell.restored;
  if (state.won) state.wonDay = bell.restoredDay;
  state.lastTradeDay = input.lastTradeDay ?? 0; state.migratedFromVersion = 1; state.calendarEpoch = workPosition(state);
  state.nextId = Math.max(0, ...state.buildings.filter(b => /^b\d/.test(b.id)).map(b => Number(b.id.slice(1)))) + 1;
  restoreJournal(state, input);
  addEvent(state, 'Your original village is preserved. Its buildings are complete; citizens now choose real jobs and builders raise the next generation.', 'migration');
  normalizeProgression(state); reconcileWorkforce(state); refreshProduction(state); return state;
}
/** Invalid saves return null. No imported strings become HTML and no imported assignment creates labor. */
export function restore(raw) {
  let input; try { input = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![1, 2, 3, VERSION].includes(input.version)) return null;
  if (!validInteger(input.day, 1, 1000000) || !isFiniteNumber(input.time) || input.time < 0 || input.time >= DAY_LENGTH || !isFiniteNumber(input.elapsed) || input.elapsed < 0 || input.elapsed > DAY_LENGTH * 1000000) return null;
  if (input.calendarEpoch !== undefined && (!isFiniteNumber(input.calendarEpoch) || input.calendarEpoch < 0 || input.calendarEpoch > workPosition(input))) return null;
  if (input.lastTradeDay !== undefined && !validInteger(input.lastTradeDay, 0, input.day)) return null;
  if (input.version === 1) { try { return restoreV1(input); } catch { return null; } }
  if (!validBag(input.resources, { complete: true }) || !Array.isArray(input.buildings) || input.buildings.length < 2 || input.buildings.length > MAX_BUILDINGS) return null;
  if (!Array.isArray(input.citizens) || !validInteger(input.citizens.length, 1, 1000) || input.population !== input.citizens.length || !validInteger(input.builderTarget, 0, input.population)) return null;
  if (!isFiniteNumber(input.morale) || input.morale < 10 || input.morale > 100 || !isFiniteNumber(input.subsecond) || input.subsecond < 0 || input.subsecond >= 1) return null;
  const state = createGame(), ids = new Set(), cells = new Set(), orders = new Set(); state.buildings = [];
  for (const value of input.buildings) {
    const b = readBasicBuilding(value, input.day, ids, cells); if (!b) return null;
    if (!validInteger(value.level, 1, 3) || (value.level > 1 && !getUpgrade(value.type, value.level - 1)) || !['ready', 'queued', 'building'].includes(value.status) || typeof value.paused !== 'boolean' || !validInteger(value.priority, 0, 100)) return null;
    b.level = value.level; b.status = value.status; b.paused = value.paused; b.priority = value.priority;
    // Early v2 upgrades used one extra requested worker per level. Preserve those saves
    // when a rebalance removes a post, without inventing citizens or increasing staffing.
    const currentMax = specFor(b).workers || 0, legacyMax = BUILDINGS[b.type].workers ? BUILDINGS[b.type].workers + b.level - 1 : 0;
    if (!validInteger(value.desiredWorkers, 0, Math.max(currentMax, legacyMax))) return null;
    b.desiredWorkers = Math.min(value.desiredWorkers, currentMax);
    const ceiling = investmentFor(b.type, b.level, b.restored);
    if (!validBag(value.investment) || Object.entries(value.investment).some(([key, amount]) => amount > ceiling[key] + 1e-6)) return null;
    b.investment = { ...emptyResources(), ...value.investment };
    if (b.status === 'ready') {
      if (value.constructionKind !== null || !validBag(value.escrow) || Object.values(value.escrow).some(n => n !== 0)) return null;
      if (!isFiniteNumber(value.progress) || !isFiniteNumber(value.workRequired) || value.progress < 0 || value.workRequired < 0 || value.workRequired > 1000000) return null;
      b.targetLevel = b.level; b.constructionKind = null; b.escrow = {};
      b.workRequired = isFiniteNumber(value.workRequired) ? Math.max(0, value.workRequired) : 0; b.progress = b.workRequired;
    } else {
      if (!['build', 'upgrade'].includes(value.constructionKind) || b.type === 'hearth') return null;
      b.constructionKind = value.constructionKind;
      const target = b.constructionKind === 'build' ? 1 : b.level + 1;
      if (value.targetLevel !== target || target > 3 || (target > 1 && !getUpgrade(b.type, b.level))) return null;
      if (b.constructionKind === 'build' && (b.level !== 1 || (b.type === 'bell' && b.restored) || Object.values(b.investment).some(n => n > 0))) return null;
      if (!validInteger(value.queueOrder, 1, 1000000000) || orders.has(value.queueOrder)) return null;
      if (!isFiniteNumber(value.progress) || !isFiniteNumber(value.workRequired) || value.progress < 0 || value.workRequired <= 0 || value.workRequired > 1000000 || value.progress >= value.workRequired) return null;
      if (!validBag(value.escrow)) return null;
      const expected = constructionCost(b.type, target);
      if (RESOURCE_NAMES.some(key => Math.abs((value.escrow[key] || 0) - (expected[key] || 0)) > 1e-6)) return null;
      b.escrow = { ...value.escrow }; b.progress = value.progress; b.workRequired = value.workRequired; b.targetLevel = target; b.queueOrder = value.queueOrder; orders.add(value.queueOrder);
    }
    state.buildings.push(b);
  }
  if (!ids.has('hearth') || !ids.has('bell') || input.citizens.length > housing(state)) return null;
  const citizens = [], citizenIds = new Set();
  for (const value of input.citizens) {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !/^c[1-9]\d{0,6}$/.test(value.id) || citizenIds.has(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 60 || /[<>\x00-\x1f]/.test(value.name) || !validInteger(value.arrivalDay, 1, input.day)) return null;
    if (!value.experience || typeof value.experience !== 'object' || Array.isArray(value.experience) || Object.keys(value.experience).length > 40 || Object.entries(value.experience).some(([key, amount]) => !/^[a-z][a-z0-9_]{0,30}$/.test(key) || !isFiniteNumber(amount) || amount < 0 || amount > 72000)) return null;
    const workplace = state.buildings.find(b => b.id === value.workplace);
    const jobFits = workplace && (value.job === 'builder' ? workplace.status !== 'ready' : workplace.status === 'ready' && value.job === (specFor(workplace).job || workplace.type));
    citizens.push({ id: value.id, name: value.name, arrivalDay: value.arrivalDay, experience: { ...value.experience }, job: jobFits ? value.job : 'idle', workplace: jobFits ? workplace.id : null }); citizenIds.add(value.id);
  }
  const bell = state.buildings.find(b => b.id === 'bell'); if (typeof input.won !== 'boolean' || input.won !== bell.restored) return null;
  Object.assign(state, {
    resources: { ...input.resources }, citizens, population: citizens.length, builderTarget: input.builderTarget,
    day: input.day, time: input.time, subsecond: input.subsecond, elapsed: input.elapsed, morale: input.morale,
    calendarEpoch: input.calendarEpoch ?? workPosition(input),
    won: bell.restored, lastTradeDay: input.lastTradeDay ?? 0, undo: null,
    nextId: Math.max(0, ...state.buildings.filter(b => /^b\d/.test(b.id)).map(b => Number(b.id.slice(1)))) + 1,
    nextCitizenId: Math.max(...citizens.map(c => Number(c.id.slice(1)))) + 1,
    nextQueueOrder: Math.max(0, ...orders) + 1,
  });
  if (bell.restored) state.wonDay = bell.restoredDay;
  state.stats = Object.fromEntries(['built', 'arrivals', 'harvests', 'upgrades'].map(key => [key, validInteger(input.stats?.[key], 0, 1000000) ? input.stats[key] : 0]));
  for (const key of Object.keys(createProgressionState())) if (Object.hasOwn(input, key)) state[key] = structuredClone(input[key]);
  if (Object.hasOwn(input, 'pressure')) state.pressure = structuredClone(input.pressure);
  if (input.version >= 3) { if (!Object.hasOwn(input, 'frontier')) return null; state.frontier = structuredClone(input.frontier); }
  if (input.version !== VERSION) state.migratedFromVersion = input.version;
  if (input.version === VERSION) { if (!Object.hasOwn(input, 'discovery')) return null; state.discovery = structuredClone(input.discovery); }
  try { state.woodland = restoreWoodland(input.woodland); normalizeProgression(state); normalizePressure(state); normalizeFrontier(state, frontierContext(state)); normalizeDiscovery(state); } catch { return null; }
  restoreJournal(state, input);
  reconcileWorkforce(state); refreshProduction(state); return state;
}
