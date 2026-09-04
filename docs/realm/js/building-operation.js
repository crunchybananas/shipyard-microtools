// One player-facing definition of when a finished building can provide its
// ordinary benefit. Construction sites are never operational; staffed
// buildings also require at least their catalogued workforce.

import { G, BUILDINGS } from './state.js?realm=198';
import { staffingCount, workersForBuilding } from './citizen-ownership.js?realm=198';

const MILITARY_BUILDINGS = new Set(['barracks', 'archery']);

export function isBuildingComplete(building) {
  return !!building && building.active === true && building.buildProgress >= 1;
}

export function activeStaffingCount(building) {
  return workersForBuilding(building)
    .filter(citizen => citizen.activity?.kind === 'working')
    .length;
}

// Civilian staffing remains the source of truth for citizen ownership. A
// completed training yard may also be kept operational by its own live,
// non-garrisoned company. This is a derived crew slot, not a citizen
// assignment, so soldiers never displace a farm, mine, or other civilian job.
export function militaryCrewForBuilding(building) {
  if (!MILITARY_BUILDINGS.has(building?.type) || !isBuildingComplete(building)) return [];
  return (G.soldiers || []).filter(soldier => (
    soldier?.homeBuilding === building
    && !soldier.garrison
    && (soldier.hp ?? 0) > 0
  ));
}

export function effectiveActiveStaffingCount(building) {
  const needed = BUILDINGS[building?.type]?.workers || 0;
  if (needed === 0) return 0;
  const civilianActive = activeStaffingCount(building);
  const militaryCrew = Math.min(needed, militaryCrewForBuilding(building).length);
  return Math.min(needed, civilianActive + militaryCrew);
}

export function isBuildingOperational(building) {
  if (!isBuildingComplete(building)) return false;
  const needed = BUILDINGS[building.type]?.workers || 0;
  return needed === 0 || effectiveActiveStaffingCount(building) >= needed;
}

export function buildingOperationLabel(building) {
  if (!isBuildingComplete(building)) return 'Under construction';
  if (building.onFire) return 'On fire';
  if ((building.hp ?? 100) < 35) return 'Badly damaged';
  const needed = BUILDINGS[building.type]?.workers || 0;
  const staffed = needed ? staffingCount(building) : 0;
  const active = needed ? activeStaffingCount(building) : 0;
  const military = needed ? militaryCrewForBuilding(building).length : 0;
  const effective = needed ? effectiveActiveStaffingCount(building) : 0;
  if (needed && effective < needed && staffed < needed) return `Needs workers (${staffed}/${needed})`;
  if (needed && effective < needed) return `Closed — workers off duty (${effective}/${needed} crew present)`;
  if (needed && military > 0) {
    return `Operating (${active} civilian${active === 1 ? '' : 's'} + ${military} soldier${military === 1 ? '' : 's'})`;
  }
  return needed ? `Operating (${active}/${needed} workers on duty)` : 'Operational';
}
