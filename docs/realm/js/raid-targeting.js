// Pure deterministic raid target ranking. The simulation passes its state and
// active approach explicitly; this module owns no Realm singleton or runtime
// side effects, so spawn and retargeting share one contract.

export const RAID_TARGET_PRIORITY = Object.freeze({
  storehouse: 6,
  granary: 6,
  farm: 5,
  windmill: 5,
  bakery: 5,
  fisherman: 5,
  chickencoop: 5,
  cowpen: 5,
  barracks: 4,
  archery: 4,
  tower: 4,
  house: 3,
});

function compareStableStrings(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function approachDistance(building, side, mapWidth, mapHeight) {
  if (side === 0) return building.y;
  if (side === 1) return mapWidth - 1 - building.x;
  if (side === 2) return mapHeight - 1 - building.y;
  if (side === 3) return building.x;
  return Math.abs(building.x - mapWidth / 2) + Math.abs(building.y - mapHeight / 2);
}

export function rankedRaidTargets(state, side = null, mapWidth = 80, mapHeight = 80) {
  if (!state || !Array.isArray(state.buildings)) return [];
  const live = state.buildings.filter(building => (
    building.active === true
      && building.buildProgress >= 1
      && building.hp > 0
      && building.type !== 'road'
  ));
  const structures = live.filter(building => building.type !== 'wall');
  const candidates = structures.length ? structures : live;
  return candidates.slice().sort((a, b) => (
    (RAID_TARGET_PRIORITY[b.type] || 2) - (RAID_TARGET_PRIORITY[a.type] || 2)
    || approachDistance(a, side, mapWidth, mapHeight) - approachDistance(b, side, mapWidth, mapHeight)
    || a.y - b.y
    || a.x - b.x
    || compareStableStrings(String(a.type), String(b.type))
  ));
}

export function raidTargetForIndex(index, state, side = null, mapWidth = 80, mapHeight = 80) {
  if (!Number.isSafeInteger(index) || index < 0) return null;
  const targets = rankedRaidTargets(state, side, mapWidth, mapHeight);
  return targets.length ? targets[index % targets.length] : null;
}
