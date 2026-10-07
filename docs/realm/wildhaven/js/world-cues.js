/** Read-only presentation facts shared by the world overlays and their checks. */
import { BUILDINGS, JOBS, getBuildingSpec } from './catalog.js';
import { villageNeeds } from './sim.js';

export function serviceReach(state, type, tile, level = 1) {
  const service = getBuildingSpec(type, level)?.service;
  if (!state || !service || !tile) return null;
  const needs = villageNeeds(state);
  const homes = needs.homes.map(home => ({ ...home, inRange: Math.hypot(home.x - tile.x, home.z - tile.z) <= service.radius }));
  const reachable = homes.filter(home => home.inRange);
  // Identity matters: hovering a new plan over an existing building is still a preview.
  const existing = tile.id && state.buildings.find(building => building.id === tile.id && building.type === type);
  const provider = existing && needs.services[service.kind]?.providers.find(item => item.id === existing.id);
  const potentialCapacity = service.capacity * (service.strength || 1);
  return {
    kind: service.kind, radius: service.radius, homes,
    servedHomes: reachable.length, inRangeHomes: reachable.length, totalHomes: homes.length,
    outsideHomes: homes.length - reachable.length, servedIds: reachable.map(home => home.id),
    nearbyBeds: reachable.reduce((sum, home) => sum + home.beds, 0), potentialCapacity,
    capacity: provider?.capacity ?? potentialCapacity, allocatedBeds: provider?.served ?? null,
    isPreview: !existing,
  };
}

const WORK_ACTIONS = Object.freeze({
  builder: 'Building', lumberjack: 'Chopping timber', quarryworker: 'Cutting stone', miner: 'Mining ore',
  farmer: 'Tending crops', forager: 'Gathering supplies', smith: 'Working the forge', carpenter: 'Sawing planks',
  baker: 'Baking bread', miller: 'Milling flour', weaver: 'Weaving cloth', brewer: 'Brewing ale',
  trader: 'Trading goods', scholar: 'Studying', medic: 'Treating neighbors', chaplain: 'Tending the chapel',
  guard: 'Keeping watch', steward: 'Managing stores',
});

export function residentCue(actor, state, paused = false) {
  if (!actor?.citizen) return null;
  const citizen = actor.citizen, workplace = state?.buildings.find(building => building.id === citizen.workplace);
  const workState = actor.root?.userData.workState;
  const reason = workplace?.production?.efficiency <= 0 && citizen.job !== 'builder' ? workplace.production.blockedReason : null;
  let action;
  if (actor.parcel?.visible) action = `${actor.path?.length ? 'Carrying' : 'Delivering'} ${actor.parcel.userData.cargo}`;
  else if (workplace?.paused) action = 'Workplace paused';
  else if (reason) action = reason;
  else if (workState === 'working') action = workplace?.type === 'orchard' ? 'Picking fruit' : workplace?.type === 'toolmaker' ? 'Forging tools' : WORK_ACTIONS[citizen.job] || 'Working';
  else if (workState === 'foraging') action = 'Gathering supplies';
  else if (workState === 'watching' || actor.activity === 'patrol') action = 'Keeping watch';
  else if (workState === 'walking' || actor.path?.length) action = actor.activity === 'work' ? `Going to ${BUILDINGS[workplace?.type]?.name?.toLowerCase() || 'work'}` : actor.activity === 'gather' ? 'Going to gather' : 'Walking through town';
  else if (actor.activity === 'waiting') action = workplace?.paused ? 'Workplace paused' : actor.root?.userData.workReason?.includes('approach') ? 'Entrance blocked' : 'Waiting for supplies';
  else if (workState === 'unloading') action = 'Unloading goods';
  else action = citizen.job === 'idle' ? 'Available for work' : 'Taking a short break';
  return { name: citizen.name, job: JOBS[citizen.job]?.name || 'Neighbor', action, reason: reason || (actor.activity === 'waiting' ? actor.root?.userData.workReason : null) || null, paused, workplace: BUILDINGS[workplace?.type]?.name || null, color: JOBS[citizen.job]?.color || '#8bb6a2' };
}
