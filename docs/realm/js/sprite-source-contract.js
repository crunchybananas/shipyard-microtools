// Canonical motion-sprite source contract shared by the live renderer, Sprite
// Lab/Muster, and Node atlas tooling. Because browser code executes this file,
// it belongs to the versioned runtime graph rather than a queryless scripts/
// side path.

export const FRAME_W = 64;
export const FRAME_H = 84;
export const FRAMES = 8;
export const DIRS = ['down', 'up', 'left', 'right'];
export const ACTIONS = ['idle', 'walk', 'work', 'carry'];

export const ROLES = [
  'settler', 'farmer', 'rancher', 'lumber', 'miner', 'stonecutter',
  'fisher', 'trader', 'innkeeper', 'builder', 'blacksmith', 'guard',
  'scholar', 'forager',
];

export const AMBIENT = ['cart', 'fishboat', 'sailboat', 'cargo', 'deer', 'cow', 'chicken'];

export const ACTOR_BASE_DIRNAME = 'actors';
export const ACTOR_ROW_DIRNAME = 'actor-rows';
export const ACTOR_COMPILED_DIRNAME = 'actors-compiled';
export const ACTOR_ROW_MANIFEST = 'manifest.json';

export const ROLE_SHEET_W = FRAME_W * FRAMES;
export const ROLE_SHEET_H = FRAME_H * DIRS.length * ACTIONS.length;
export const ACTOR_ATLAS_W = ROLE_SHEET_W;
export const ACTOR_ATLAS_H = ROLE_SHEET_H * ROLES.length;
export const AMBIENT_SHEET_W = 48;
export const AMBIENT_SHEET_H = 48;
export const AMBIENT_ATLAS_W = AMBIENT_SHEET_W * AMBIENT.length;
export const AMBIENT_ATLAS_H = AMBIENT_SHEET_H;

export function actorRowKey(role, action, dir) {
  return `${role}/${action}/${dir}`;
}
