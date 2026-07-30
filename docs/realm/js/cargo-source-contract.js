// Runtime contract for raster resource payloads attached to actor rows that
// already own a baked cargo container. Payload atlases use the same frame
// dimensions and tier keys as actor atlases so both images share one exact
// destination rectangle.

export const CARGO_RESOURCES = Object.freeze([
  'wood', 'stone', 'food', 'gold', 'iron', 'wheat', 'flour', 'planks', 'tools',
]);

export const CARGO_DIRECTIONS = Object.freeze(['down', 'up', 'left', 'right']);
export const CARGO_OWNER_ROWS = Object.freeze([
  'guard/carry',
  'farmer/carry',
  'lumber/carry',
  'builder/carry',
  'blacksmith/carry',
  'miner/carry',
]);
export const CARGO_FRAMES = 8;

export const CARGO_RUNTIME_ATLASES = Object.freeze([
  Object.freeze({
    key: 'native',
    file: 'cargo-payloads-native.png',
    frameW: 27,
    frameH: 35,
  }),
  Object.freeze({
    key: 'default',
    file: 'cargo-payloads-default.png',
    frameW: 35,
    frameH: 46,
  }),
  Object.freeze({
    key: 'double',
    file: 'cargo-payloads-double.png',
    frameW: 54,
    frameH: 70,
  }),
  Object.freeze({
    key: 'review',
    file: 'cargo-payloads-review.png',
    frameW: 64,
    frameH: 84,
  }),
]);

export function cargoOwnerRow(role, action) {
  return CARGO_OWNER_ROWS.includes(`${role}/${action}`);
}

export function cargoRowIndex(resource, dir) {
  const resourceIndex = CARGO_RESOURCES.indexOf(resource);
  const directionIndex = CARGO_DIRECTIONS.indexOf(dir);
  if (resourceIndex < 0 || directionIndex < 0) return -1;
  return resourceIndex * CARGO_DIRECTIONS.length + directionIndex;
}
