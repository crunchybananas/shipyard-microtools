// One player-facing definition of when a finished building can provide its
// ordinary benefit. Construction sites are never operational; staffed
// buildings also require at least their catalogued workforce.

import { BUILDINGS } from './state.js?realm=192';
import { staffingCount, workersForBuilding } from './citizen-ownership.js?realm=192';

export function isBuildingComplete(building) {
  return !!building && building.active === true && building.buildProgress >= 1;
}

export function activeStaffingCount(building) {
  return workersForBuilding(building)
    .filter(citizen => citizen.activity?.kind === 'working')
    .length;
}

export function isBuildingOperational(building) {
  if (!isBuildingComplete(building)) return false;
  const needed = BUILDINGS[building.type]?.workers || 0;
  return needed === 0 || activeStaffingCount(building) >= needed;
}

export function buildingOperationLabel(building) {
  if (!isBuildingComplete(building)) return 'Under construction';
  if (building.onFire) return 'On fire';
  if ((building.hp ?? 100) < 35) return 'Badly damaged';
  const needed = BUILDINGS[building.type]?.workers || 0;
  const staffed = needed ? staffingCount(building) : 0;
  if (needed && staffed < needed) return `Needs workers (${staffed}/${needed})`;
  const active = needed ? activeStaffingCount(building) : 0;
  if (needed && active < needed) return `Closed — workers off duty (${active}/${needed} present)`;
  return needed ? `Operating (${active}/${needed} workers on duty)` : 'Operational';
}
