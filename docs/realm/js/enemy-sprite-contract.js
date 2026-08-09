// Canonical painted-raider sprite contract shared by the offline compiler and
// the live renderer. Enemy simulation state remains gameplay-owned; this file
// describes only deterministic presentation rows and atlas addressing.

export const ENEMY_FRAME_W = 64;
export const ENEMY_FRAME_H = 84;
export const ENEMY_FRAMES = 8;
export const ENEMY_DIRECTIONS = Object.freeze(['down', 'up', 'left', 'right']);
export const ENEMY_ACTIONS = Object.freeze(['idle', 'walk', 'attack', 'retreat']);
export const ENEMY_VARIANTS = Object.freeze([
  'ash-reaver',
  'iron-lancer',
  'bone-breaker',
]);

export const ENEMY_RUNTIME_ATLASES = Object.freeze([
  Object.freeze({ key: 'native', file: 'enemies-atlas-native.png', frameW: 27, frameH: 35 }),
  Object.freeze({ key: 'default', file: 'enemies-atlas-default.png', frameW: 35, frameH: 46 }),
  Object.freeze({ key: 'double', file: 'enemies-atlas-double.png', frameW: 54, frameH: 70 }),
  Object.freeze({ key: 'review', file: 'enemies-atlas.png', frameW: 64, frameH: 84 }),
]);

export function enemyAtlasRowIndex(variant, action, direction) {
  const variantIndex = typeof variant === 'number'
    ? variant
    : ENEMY_VARIANTS.indexOf(variant);
  const actionIndex = ENEMY_ACTIONS.indexOf(action);
  const directionIndex = ENEMY_DIRECTIONS.indexOf(direction);
  if (
    variantIndex < 0 || variantIndex >= ENEMY_VARIANTS.length
    || actionIndex < 0 || directionIndex < 0
  ) return -1;
  return (
    (variantIndex * ENEMY_ACTIONS.length + actionIndex)
    * ENEMY_DIRECTIONS.length
    + directionIndex
  );
}

export function enemyAtlasFrameRect(
  variant,
  action,
  direction,
  frame = 0,
  frameW = ENEMY_FRAME_W,
  frameH = ENEMY_FRAME_H,
) {
  const row = enemyAtlasRowIndex(variant, action, direction);
  if (row < 0) return null;
  const normalizedFrame = (
    (Math.floor(frame) % ENEMY_FRAMES) + ENEMY_FRAMES
  ) % ENEMY_FRAMES;
  return {
    sx: normalizedFrame * frameW,
    sy: row * frameH,
    sw: frameW,
    sh: frameH,
    row,
    frame: normalizedFrame,
  };
}
