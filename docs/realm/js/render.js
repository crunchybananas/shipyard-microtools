// ════════════════════════════════════════════════════════════
// Renderer — isometric canvas, building sprites
// (minimap lives in ./minimap.js)
// ════════════════════════════════════════════════════════════

import { G, TILE, TILE_COLORS, BUILDINGS, TW, TH, MAP_W, MAP_H, getSeasonData, getDaylight } from './state.js?realm=193';
import { renderBoats, renderFlocks, renderAurora, renderWolves, renderGlowMushrooms, renderGroundMist, renderLanterns, renderCarts, renderRainbow, renderHawks, renderConstellations, renderPuddles, renderBonfire, renderFootprints, renderLensFlare, renderSnowmen, renderBlossoms, drawAmbientSprite, enhRenderWorld, enhRenderScreen } from './enhancements.js?realm=193';
import { makeAtlasLoader } from './atlas-loader.js?realm=193';
import { ACTOR_REGISTRATION } from './actor-registration.js?realm=193';
import {
  ACTIONS as ACTOR_ACTIONS,
  ACTOR_RUNTIME_ATLASES,
  DIRS as ACTOR_DIRS,
  FRAME_H as ACTOR_FRAME_H,
  FRAME_W as ACTOR_FRAME_W,
  FRAMES as ACTOR_FRAMES,
  ROLES as ACTOR_VARIANTS,
} from './sprite-source-contract.js?realm=193';
import {
  CARGO_DIRECTIONS,
  CARGO_FRAMES,
  CARGO_OWNER_ROWS,
  CARGO_RESOURCES,
  CARGO_RUNTIME_ATLASES,
  cargoOwnerRow,
  cargoRowIndex,
} from './cargo-source-contract.js?realm=193';
import {
  ENEMY_ACTIONS,
  ENEMY_DIRECTIONS,
  ENEMY_FRAMES,
  ENEMY_RUNTIME_ATLASES,
  ENEMY_VARIANTS,
  enemyAtlasFrameRect,
} from './enemy-sprite-contract.js?realm=193';
import {
  chooseActorRuntimeTier,
  projectedActorSize,
  shouldSmoothActorTier,
} from './render-resolution.js?realm=193';
import {
  buildCurrentCitizenPresentations,
  presentationActionForActivity,
} from './citizen-presentation.js?realm=193';
import {
  citizenRenderRecord,
  pruneCitizenRenderCache,
} from './citizen-render-cache.js?realm=193';
import { staffingCount } from './citizen-ownership.js?realm=193';

let C, ctx;
let logicalW, logicalH;
const nonCitizenAnimationCache = new WeakMap();
const worldDrawQueue = [];

const WORLD_DRAW_KIND = Object.freeze({
  building: 0,
  citizen: 1,
  animal: 2,
  avatar: 3,
  walker: 4,
  soldier: 5,
  caravan: 6,
  enemy: 7,
});

// ── FPS counter ───────────────────────────────────────────────
let fpsFrames = 0, fpsTime = 0, fpsDisplay = 0;
export let showFPS = false;
export function toggleFPS() { showFPS = !showFPS; }

let _renderProfiling = false;
const _renderProfileSamples = [];
const _RENDER_PROFILE_LIMIT = 500;

export function setRenderProfiling(enabled) {
  _renderProfiling = !!enabled;
  if (_renderProfiling) _renderProfileSamples.length = 0;
}

export function getRenderProfile() {
  return _renderProfileSamples.map(sample => ({ ...sample }));
}

function markRenderPass(profile, name) {
  if (!profile) return;
  const now = performance.now();
  profile[name] = now - profile.last;
  profile.last = now;
}

const _RASTER_ATLAS_URL = 'assets/sprites/buildings-atlas-painted.png';
const _RASTER_ATLAS_CELL = 128;
const _RASTER_ATLAS_COLS = 4;
const _RASTER_ATLAS_TYPES = [
  'granary', 'castle', 'church', 'windmill',
  'tower', 'house', 'tavern', 'blacksmith',
  'market', 'bakery', 'barracks', 'townhall',
  'well',
];
const _RASTER_ATLAS_FRAMES = Object.fromEntries(_RASTER_ATLAS_TYPES.map((type, idx) => [
  type,
  {
    x: (idx % _RASTER_ATLAS_COLS) * _RASTER_ATLAS_CELL,
    y: Math.floor(idx / _RASTER_ATLAS_COLS) * _RASTER_ATLAS_CELL,
    w: _RASTER_ATLAS_CELL,
    h: _RASTER_ATLAS_CELL,
  },
]));
const _BUILDING_SPRITE_ALIASES = Object.freeze({
  storehouse: 'granary',
  sawmill: 'lumber',
  wonder: 'castle',
});
function rasterSpriteKey(type) { return _BUILDING_SPRITE_ALIASES[type] || type; }
const _RASTER_ATLAS_TRIMS = {
  granary:    { x: 17, y:  8, w: 100, h: 120 },
  castle:     { x:  3, y:  9, w: 125, h: 114 },
  church:     { x:  0, y:  7, w: 109, h: 118 },
  windmill:   { x:  6, y:  8, w:  97, h: 118 },
  tower:      { x: 19, y:  1, w:  86, h: 123 },
  house:      { x:  2, y: 13, w: 110, h: 106 },
  tavern:     { x:  2, y: 10, w: 113, h: 112 },
  blacksmith: { x:  1, y:  6, w: 112, h: 118 },
  market:     { x:  8, y: 21, w: 105, h:  97 },
  bakery:     { x:  1, y:  9, w: 118, h: 110 },
  barracks:   { x:  0, y:  9, w: 128, h: 109 },
  townhall:   { x:  0, y:  0, w: 112, h: 121 },
  well:       { x: 12, y:  6, w:  94, h: 112 },
};
const _SUPPORT_ATLAS_URL = 'assets/sprites/support-atlas.png';
const _SUPPORT_ATLAS_CELL = 128;
const _SUPPORT_ATLAS_COLS = 4;
const _SUPPORT_ATLAS_TYPES = [
  'farm', 'lumber', 'quarry', 'mine',
  'fisherman', 'tradingpost', 'school', 'archery',
  'wall', 'road', 'chickencoop', 'cowpen',
  'palisade', 'campfire', 'orchard', 'hay',
];
const _SUPPORT_ATLAS_FRAMES = Object.fromEntries(_SUPPORT_ATLAS_TYPES.map((type, idx) => [
  type,
  {
    x: (idx % _SUPPORT_ATLAS_COLS) * _SUPPORT_ATLAS_CELL,
    y: Math.floor(idx / _SUPPORT_ATLAS_COLS) * _SUPPORT_ATLAS_CELL,
    w: _SUPPORT_ATLAS_CELL,
    h: _SUPPORT_ATLAS_CELL,
  },
]));
const _SUPPORT_ATLAS_TRIMS = {
  farm:        { x:  4, y: 37, w: 124, h:  86 },
  lumber:      { x:  0, y: 23, w: 127, h: 100 },
  quarry:      { x:  5, y: 24, w: 117, h:  99 },
  mine:        { x:  1, y: 23, w: 122, h:  99 },
  fisherman:   { x:  4, y:  9, w: 121, h: 102 },
  tradingpost: { x:  5, y:  6, w: 118, h: 108 },
  school:      { x:  6, y:  2, w: 114, h: 126 },
  archery:     { x:  0, y: 12, w: 124, h: 116 },
  wall:        { x:  0, y:  0, w: 123, h:  90 },
  road:        { x:  0, y:  8, w: 123, h: 120 },
  chickencoop: { x:  3, y:  0, w: 125, h: 128 },
  cowpen:      { x:  0, y:  0, w: 123, h: 128 },
  palisade:    { x:  3, y:  0, w: 119, h:  92 },
  campfire:    { x:  1, y:  0, w: 123, h:  90 },
  orchard:     { x:  0, y:  0, w: 128, h:  94 },
  hay:         { x:  0, y:  0, w: 122, h:  90 },
};
const _loadSupportAtlas = makeAtlasLoader(_SUPPORT_ATLAS_URL);

// Keep an optional inspection label while always including the module build
// revision. A stable `?v=release-polish` URL must still fetch a newly compiled
// atlas after a source promotion.
const _ACTOR_ATLAS_REVISION = [
  new URLSearchParams(location.search).get('v'),
  new URL(import.meta.url).searchParams.get('realm'),
].filter(Boolean).join('-');
const _actorAtlasUrl = (file) => _ACTOR_ATLAS_REVISION
  ? `assets/sprites/${file}?realm=${encodeURIComponent(_ACTOR_ATLAS_REVISION)}`
  : `assets/sprites/${file}`;
const _ACTOR_ATLAS_TIERS = ACTOR_RUNTIME_ATLASES.map((tier) => ({
  ...tier,
  load: makeAtlasLoader(_actorAtlasUrl(tier.file)),
}));
const _CARGO_ATLAS_TIERS = CARGO_RUNTIME_ATLASES.map((tier) => ({
  ...tier,
  load: makeAtlasLoader(_actorAtlasUrl(tier.file)),
}));
const _ENEMY_ATLAS_TIERS = ENEMY_RUNTIME_ATLASES.map((tier) => ({
  ...tier,
  load: makeAtlasLoader(_actorAtlasUrl(tier.file)),
}));
const _ACTOR_PREVIEW_CONFIGS = Object.freeze({
  'a5-guard-actions': Object.freeze({
    role: 'guard',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a5-guard-actions/rows-runtime',
    parts: 'watchman/watch-blue',
    bakedCargo: true,
  }),
  'a7-farmer-actions': Object.freeze({
    role: 'farmer',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a7-farmer-actions/rows-runtime',
    parts: 'craftsperson/ochre-work',
    bakedCargo: true,
  }),
  'a8-lumber-actions': Object.freeze({
    role: 'lumber',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a8-lumber-actions/rows-runtime',
    parts: 'woodsman/forest-work',
    bakedCargo: true,
  }),
  'a9-builder-actions': Object.freeze({
    role: 'builder',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a9-builder-actions/rows-runtime',
    parts: 'mason/brick-work',
    bakedCargo: true,
  }),
  'a10-blacksmith-actions': Object.freeze({
    role: 'blacksmith',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a10-blacksmith-actions/rows-runtime',
    parts: 'smith/ember-forge',
    bakedCargo: true,
  }),
  'a11-miner-actions': Object.freeze({
    role: 'miner',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a11-miner-actions/rows-runtime',
    parts: 'deepdelver/slate-brass',
    bakedCargo: true,
  }),
  'a12-stonecutter-actions': Object.freeze({
    role: 'stonecutter',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a12-stonecutter-actions/rows-runtime',
    parts: 'quarrymaster/granite-russet',
    bakedCargo: true,
  }),
  'a13-fisher-actions': Object.freeze({
    role: 'fisher',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a13-fisher-actions/rows-runtime',
    parts: 'harborhand/storm-teal',
    bakedCargo: true,
  }),
  'a14-settler-actions': Object.freeze({
    role: 'settler',
    actions: Object.freeze(['idle', 'walk', 'work', 'carry']),
    dirs: Object.freeze(['down', 'up', 'left', 'right']),
    rows: 'prototypes/actor-pose/output/a14-settler-actions/rows-runtime',
    parts: 'wayfarer/hearth-indigo',
    bakedCargo: true,
  }),
});
const _ACTOR_PREVIEW_ID = new URLSearchParams(location.search).get('actorpreview');
const _ACTOR_PREVIEW = _ACTOR_PREVIEW_CONFIGS[_ACTOR_PREVIEW_ID] || null;
const _actorPreviewEnabled = Boolean(_ACTOR_PREVIEW);
const _ACTOR_PREVIEW_SCOPE = _ACTOR_PREVIEW
  ? Object.freeze({
      role: _ACTOR_PREVIEW.role,
      actions: _ACTOR_PREVIEW.actions,
      dirs: _ACTOR_PREVIEW.dirs,
    })
  : null;
const _ACTOR_PREVIEW_TIERS = _actorPreviewEnabled
  ? new Map(_ACTOR_ATLAS_TIERS.map((tier) => {
      const rows = new Map(_ACTOR_PREVIEW_SCOPE.actions.flatMap((action) => (
        _ACTOR_PREVIEW_SCOPE.dirs.map((dir) => [
          `${action}/${dir}`,
          makeAtlasLoader(_actorAtlasUrl(
            `${_ACTOR_PREVIEW.rows}/${tier.key}`
            + `/${_ACTOR_PREVIEW.parts}/${action}-${dir}.png`
          )),
        ])
      )));
      // The preview is an explicit review surface, so preload its complete
      // action and direction family. Normal game URLs create none of these
      // row-local loaders.
      for (const load of rows.values()) load();
      return [
        tier.key,
        {
          ...tier,
          rows,
        },
      ];
    }))
  : new Map();
let _lastActorAtlasDebugKey = '';

function actorPreviewMatches(role, action, dir) {
  return _actorPreviewEnabled
    && role === _ACTOR_PREVIEW_SCOPE.role
    && _ACTOR_PREVIEW_SCOPE.actions.includes(action)
    && _ACTOR_PREVIEW_SCOPE.dirs.includes(dir);
}

function actorOwnsBakedCargo(role, action) {
  return cargoOwnerRow(role, action)
    || Boolean(
      _ACTOR_PREVIEW?.bakedCargo
      && role === _ACTOR_PREVIEW_SCOPE.role
      && action === 'carry'
    );
}

function actorPreviewSelection(role, action, dir, atlasSelection) {
  if (!actorPreviewMatches(role, action, dir)) return null;
  const tier = _ACTOR_PREVIEW_TIERS.get(atlasSelection.key);
  if (!tier) return null;
  const row = tier.rows.get(`${action}/${dir}`)?.();
  if (!row) return null;
  return { ...tier, row };
}

function actorAtlasSelection(targetCtx, width, height) {
  const projected = projectedActorSize(targetCtx, width, height);
  const preferred = chooseActorRuntimeTier(projected, _ACTOR_ATLAS_TIERS);
  const atlas = preferred.load();
  if (atlas) return publishActorAtlasSelection({ ...preferred, atlas }, projected);

  // Crossing a zoom/DPR boundary must not make actors disappear while a new
  // tier decodes. Prefer any already-decoded tier as a temporary fallback.
  for (const tier of _ACTOR_ATLAS_TIERS) {
    if (tier === preferred || tier.load.state !== 'ready') continue;
    const fallbackAtlas = tier.load();
    if (!fallbackAtlas) continue;
    return publishActorAtlasSelection({
      ...chooseActorRuntimeTier(projected, [tier]),
      atlas: fallbackAtlas,
    }, projected);
  }
  return null;
}

function publishActorAtlasSelection(selection, projected) {
  const debugKey = [
    selection.key,
    Math.round(projected.width * 10),
    Math.round(projected.height * 10),
    selection.pixelPerfect ? selection.integerScale : 'smooth',
  ].join('/');
  if (debugKey !== _lastActorAtlasDebugKey) {
    _lastActorAtlasDebugKey = debugKey;
    G.debug.actorAtlas = {
      tier: selection.key,
      frameW: selection.frameW,
      frameH: selection.frameH,
      projectedW: Math.round(projected.width * 10) / 10,
      projectedH: Math.round(projected.height * 10) / 10,
      pixelPerfect: selection.pixelPerfect,
      integerScale: selection.pixelPerfect ? selection.integerScale : null,
      smoothing: shouldSmoothActorTier(selection),
    };
    if (C) {
      C.dataset.actorAtlasTier = selection.key;
      C.dataset.actorAtlasFrame = `${selection.frameW}x${selection.frameH}`;
      C.dataset.actorAtlasProjected = `${Math.round(projected.width * 10) / 10}x${Math.round(projected.height * 10) / 10}`;
      C.dataset.actorAtlasPixelPerfect = String(selection.pixelPerfect);
      C.dataset.actorAtlasIntegerScale = selection.pixelPerfect
        ? String(selection.integerScale)
        : '';
      C.dataset.actorAtlasSmoothing = String(shouldSmoothActorTier(selection));
    }
  }
  return selection;
}

export function actorVariantForCitizen(c) {
  if (c?.presentationKind === 'citizen' && ACTOR_VARIANTS.includes(c.variant)) return c.variant;
  // The founder is not part of the citizen Phase 1A slice yet.
  if (c === G.avatar) return 'settler';
  throw new TypeError('Renderer received a citizen without a valid presentation snapshot.');
}

export function actorActionForCitizen(c, isMoving) {
  if (c?.presentationKind === 'citizen') {
    return presentationActionForActivity(c.activity.kind, c.carrying, isMoving);
  }
  if (c === G.avatar) return isMoving ? 'walk' : 'idle';
  throw new TypeError('Renderer received an actor without explicit action ownership.');
}

export function actorDirection(faceScreenX, faceScreenY, facingAway) {
  if (Math.abs(faceScreenX) > Math.abs(faceScreenY) * 1.15) return faceScreenX < 0 ? 'left' : 'right';
  return facingAway ? 'up' : 'down';
}

export function actorAtlasRowIndex(role, action, dir) {
  const variantIdx = ACTOR_VARIANTS.indexOf(role);
  const actionIdx = ACTOR_ACTIONS.indexOf(action);
  const dirIdx = ACTOR_DIRS.indexOf(dir);
  if (variantIdx < 0 || actionIdx < 0 || dirIdx < 0) return -1;
  return (variantIdx * ACTOR_ACTIONS.length + actionIdx) * ACTOR_DIRS.length + dirIdx;
}

export function actorAtlasFrameRect(
  role,
  action,
  dir,
  frame = 0,
  frameW = ACTOR_FRAME_W,
  frameH = ACTOR_FRAME_H,
) {
  const row = actorAtlasRowIndex(role, action, dir);
  if (row < 0) return null;
  const normalizedFrame = ((Math.floor(frame) % ACTOR_FRAMES) + ACTOR_FRAMES) % ACTOR_FRAMES;
  return {
    sx: normalizedFrame * frameW,
    sy: row * frameH,
    sw: frameW,
    sh: frameH,
    row,
    frame: normalizedFrame,
  };
}

export function drawActorAtlasFrame(targetCtx, {
  role,
  action,
  dir,
  frame = 0,
  x,
  y,
  width = 27,
  height = 35,
  smoothing,
  alpha = 1,
} = {}) {
  if (!targetCtx || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const selection = actorAtlasSelection(targetCtx, width, height);
  if (!selection) return false;
  const source = actorAtlasFrameRect(
    role,
    action,
    dir,
    frame,
    selection.frameW,
    selection.frameH,
  );
  if (!source) return false;
  const preview = actorPreviewSelection(role, action, dir, selection);
  const sourceImage = preview?.row || selection.atlas;
  const sourceY = preview ? 0 : source.sy;
  targetCtx.save();
  targetCtx.globalAlpha *= alpha;
  const useSmoothing = smoothing ?? shouldSmoothActorTier(selection);
  targetCtx.imageSmoothingEnabled = useSmoothing;
  if (useSmoothing) targetCtx.imageSmoothingQuality = 'high';
  // Registration metadata only aligns the shared feet line. Scaling a whole
  // row from its opaque area made tool-heavy work/carry poses shrink the
  // actor's body by several visible pixels at every action transition.
  // Source art owns body consistency; runtime owns anchor offsets only.
  const reg = ACTOR_REGISTRATION[`${role}/${action}/${dir}`];
  const ddy = reg
    ? ((reg.dy || 0) + (reg.f?.[source.frame] || 0)) * (height / ACTOR_FRAME_H)
    : 0;
  targetCtx.drawImage(
    sourceImage,
    source.sx, sourceY, source.sw, source.sh,
    x, y + ddy, width, height
  );
  targetCtx.restore();
  return true;
}

function enemyAtlasSelection(targetCtx, width, height) {
  const projected = projectedActorSize(targetCtx, width, height);
  const preferred = chooseActorRuntimeTier(projected, _ENEMY_ATLAS_TIERS);
  const atlas = preferred.load();
  let selection = atlas ? { ...preferred, atlas } : null;
  if (!selection) {
    for (const tier of _ENEMY_ATLAS_TIERS) {
      if (tier === preferred || tier.load.state !== 'ready') continue;
      const fallback = tier.load();
      if (!fallback) continue;
      selection = {
        ...chooseActorRuntimeTier(projected, [tier]),
        atlas: fallback,
      };
      break;
    }
  }
  if (selection && C) {
    C.dataset.enemyAtlasTier = selection.key;
    C.dataset.enemyAtlasFrame = `${selection.frameW}x${selection.frameH}`;
    C.dataset.enemyAtlasPixelPerfect = String(selection.pixelPerfect);
    C.dataset.enemyAtlasSmoothing = String(shouldSmoothActorTier(selection));
  }
  return selection;
}

export function enemyActionForRender(enemy) {
  if ((enemy?.attackCue || 0) > 0) return 'attack';
  if (enemy?.retreating) return 'retreat';
  const target = enemy?.engaged || enemy;
  const dx = target === enemy ? (enemy?.tx || 0) - (enemy?.x || 0) : target.x - enemy.x;
  const dy = target === enemy ? (enemy?.ty || 0) - (enemy?.y || 0) : target.y - enemy.y;
  if (enemy?.engaged || ((enemy?.attackTimer || 0) > 0 && Math.hypot(dx, dy) <= 0.3)) {
    return 'attack';
  }
  // Wall/building strikes intentionally do not add presentation fields to
  // gameplay state. Mirror combat's read-only next-cell lookup so a blocked
  // raider uses the authored attack row instead of walking in place.
  const x = Math.round(enemy?.x || 0);
  const y = Math.round(enemy?.y || 0);
  const targetX = Math.round(enemy?.tx || 0);
  const targetY = Math.round(enemy?.ty || 0);
  const stepX = x + Math.sign(targetX - x);
  const stepY = y + Math.sign(targetY - y);
  const blockers = [
    G.buildingGrid[y]?.[x],
    G.buildingGrid[stepY]?.[stepX],
    G.buildingGrid[y]?.[stepX],
    G.buildingGrid[stepY]?.[x],
  ];
  if (blockers.some((building) => building?.hp > 0 && building.type !== 'road')) {
    return 'attack';
  }
  return Math.hypot(dx, dy) > 0.3 && !enemy?.engaged ? 'walk' : 'idle';
}

export function enemyDirectionForRender(enemy) {
  const target = enemy?.engaged || enemy;
  let dx = target === enemy ? (enemy?.tx || 0) - (enemy?.x || 0) : target.x - enemy.x;
  let dy = target === enemy ? (enemy?.ty || 0) - (enemy?.y || 0) : target.y - enemy.y;
  if (Math.hypot(dx, dy) < 0.001) {
    const continuity = actorRenderRecord(enemy);
    return ENEMY_DIRECTIONS.includes(continuity.enemyDirection)
      ? continuity.enemyDirection
      : 'down';
  }
  const screenX = dx - dy;
  const screenY = (dx + dy) * 0.5;
  const direction = Math.abs(screenX) > Math.abs(screenY) * 1.15
    ? (screenX < 0 ? 'left' : 'right')
    : (screenY < 0 ? 'up' : 'down');
  actorRenderRecord(enemy).enemyDirection = direction;
  return direction;
}

export function enemyAnimationFrame(enemy, action) {
  if (action === 'attack' && (enemy?.attackCue || 0) > 0) {
    const remaining = Math.max(0, Math.min(12, enemy?.attackCue || 0));
    return Math.min(ENEMY_FRAMES - 1, Math.floor((12 - remaining) * ENEMY_FRAMES / 12));
  }
  const record = actorRenderRecord(enemy);
  const animationKey = `enemy/${enemy?.variant ?? 0}/${action}`;
  if (record.enemyAnimationKey !== animationKey) {
    record.enemyAnimationKey = animationKey;
    record.enemyAnimationStartedAt = G.gameTick;
  }
  const rate = action === 'idle' ? 14 : action === 'retreat' ? 4 : 6;
  const elapsed = Math.max(0, G.gameTick - (record.enemyAnimationStartedAt ?? G.gameTick));
  return Math.floor(elapsed / rate) % ENEMY_FRAMES;
}

export function drawEnemyAtlasFrame(targetCtx, {
  variant,
  action,
  direction,
  frame = 0,
  x,
  y,
  width = 27,
  height = 35,
  alpha = 1,
} = {}) {
  if (
    !targetCtx || !Number.isFinite(x) || !Number.isFinite(y)
    || !ENEMY_ACTIONS.includes(action) || !ENEMY_DIRECTIONS.includes(direction)
  ) return false;
  const variantIndex = Math.max(0, Math.min(
    ENEMY_VARIANTS.length - 1,
    Number.isSafeInteger(variant) ? variant : ENEMY_VARIANTS.indexOf(variant),
  ));
  const selection = enemyAtlasSelection(targetCtx, width, height);
  if (!selection) return false;
  const source = enemyAtlasFrameRect(
    variantIndex,
    action,
    direction,
    frame,
    selection.frameW,
    selection.frameH,
  );
  if (!source) return false;
  targetCtx.save();
  targetCtx.globalAlpha *= alpha;
  const smoothing = shouldSmoothActorTier(selection);
  targetCtx.imageSmoothingEnabled = smoothing;
  if (smoothing) targetCtx.imageSmoothingQuality = 'high';
  targetCtx.drawImage(
    selection.atlas,
    source.sx, source.sy, source.sw, source.sh,
    x, y, width, height,
  );
  targetCtx.restore();
  return true;
}

export function cargoAtlasFrameRect(
  resource,
  dir,
  frame = 0,
  frameW = ACTOR_FRAME_W,
  frameH = ACTOR_FRAME_H,
) {
  const row = cargoRowIndex(resource, dir);
  if (row < 0) return null;
  const normalizedFrame = ((Math.floor(frame) % CARGO_FRAMES) + CARGO_FRAMES) % CARGO_FRAMES;
  return {
    sx: normalizedFrame * frameW,
    sy: row * frameH,
    sw: frameW,
    sh: frameH,
    row,
    frame: normalizedFrame,
  };
}

export function drawCargoAtlasFrame(targetCtx, {
  role,
  action,
  resource,
  dir,
  frame = 0,
  x,
  y,
  width = 27,
  height = 35,
  alpha = 1,
} = {}) {
  if (
    !targetCtx
    || !actorOwnsBakedCargo(role, action)
    || !Number.isFinite(x)
    || !Number.isFinite(y)
  ) return false;
  const actorSelection = actorAtlasSelection(targetCtx, width, height);
  const tier = actorSelection
    ? _CARGO_ATLAS_TIERS.find((item) => item.key === actorSelection.key)
    : null;
  const atlas = tier?.load();
  const source = tier
    ? cargoAtlasFrameRect(resource, dir, frame, tier.frameW, tier.frameH)
    : null;
  if (!atlas || !source) return false;
  const reg = ACTOR_REGISTRATION[`${role}/${action}/${dir}`];
  const ddy = reg
    ? ((reg.dy || 0) + (reg.f?.[source.frame] || 0)) * (height / ACTOR_FRAME_H)
    : 0;
  targetCtx.save();
  targetCtx.globalAlpha *= alpha;
  const useSmoothing = shouldSmoothActorTier(actorSelection);
  targetCtx.imageSmoothingEnabled = useSmoothing;
  if (useSmoothing) targetCtx.imageSmoothingQuality = 'high';
  targetCtx.drawImage(
    atlas,
    source.sx, source.sy, source.sw, source.sh,
    x, y + ddy, width, height,
  );
  targetCtx.restore();
  return true;
}

function drawCarryLoad(ctx, c, s, cy, faceScreenX, daylight = 1) {
  if (!c.carrying) return;
  const side = faceScreenX ? -Math.sign(faceScreenX) : 1;
  const px = s.x + side * 5.2;
  const py = cy - 13.8;
  ctx.save();
  ctx.globalAlpha = Math.max(0.86, daylight);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (c.carrying === 'wood') {
    ctx.strokeStyle = 'rgba(56,34,18,0.88)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(s.x + side * 1.2, cy - 18.4);
    ctx.lineTo(px - side * 3.4, py - 2.0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x + side * 1.7, cy - 8.2);
    ctx.lineTo(px - side * 3.1, py + 2.8);
    ctx.stroke();

    ctx.translate(px, py);
    ctx.rotate(side * -0.22);
    ctx.fillStyle = 'rgba(18,12,7,0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 3.9, 6.0, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const logs = [
      { y: -2.5, color: '#8b5a36', end: '#d9a66f' },
      { y:  0.0, color: '#a06a3f', end: '#e0b176' },
      { y:  2.5, color: '#7d4d2f', end: '#c89158' },
    ];
    for (const log of logs) {
      ctx.fillStyle = log.color;
      ctx.strokeStyle = 'rgba(54,32,18,0.85)';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.roundRect(-5.1, log.y - 0.8, 10.2, 1.6, 0.8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = log.end;
      ctx.beginPath();
      ctx.arc(-5.0, log.y, 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(71,43,22,0.55)';
      ctx.beginPath();
      ctx.arc(5.0, log.y, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(46,29,17,0.9)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-2.2, -3.4);
    ctx.lineTo(-0.9, 3.4);
    ctx.moveTo(1.3, -3.3);
    ctx.lineTo(2.3, 3.3);
    ctx.stroke();
  } else if (c.carrying === 'stone' || c.carrying === 'iron') {
    ctx.strokeStyle = 'rgba(76,48,24,0.8)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(s.x + side * 1.0, cy - 8);
    ctx.lineTo(px - side * 0.9, py + 2.8);
    ctx.stroke();
    const fill = c.carrying === 'stone' ? '#9ca3af' : '#6ca7c8';
    const shade = c.carrying === 'stone' ? '#6b7280' : '#3d6f8b';
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.roundRect(px - 3.2, py - 2.1, 6.4, 4.6, 1.2);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(px - 2.6, py - 2.8, 5.4, 3.0, 1.0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(35,41,50,0.7)';
    ctx.lineWidth = 0.55;
    ctx.strokeRect(px - 2.4, py - 1.7, 4.8, 3.0);
  } else {
    ctx.strokeStyle = 'rgba(76,48,24,0.8)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(s.x + side * 1.0, cy - 8);
    ctx.lineTo(px - side * 0.9, py + 2.8);
    ctx.stroke();
    const fill = {
      food: '#d96060',
      gold: '#ffd166',
    }[c.carrying] || '#d8d0bb';
    ctx.fillStyle = 'rgba(77,49,27,0.8)';
    ctx.beginPath();
    ctx.ellipse(px, py + 0.2, 2.5, 3.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(px, py - 0.5, 2.1, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(64,38,20,0.8)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(px - 1.5, py - 2.7);
    ctx.quadraticCurveTo(px, py - 4.0, px + 1.5, py - 2.7);
    ctx.stroke();
  }
  ctx.restore();
}

function actorRenderRecord(entity) {
  if (entity?.presentationKind === 'citizen') return citizenRenderRecord(entity.actorId);
  let record = nonCitizenAnimationCache.get(entity);
  if (!record) {
    record = {
      laneX: 0,
      laneY: 0,
      dirKey: null,
      dirPending: null,
      dirPendingMs: 0,
      animationKey: null,
      animationStartedAt: null,
      trail: [],
    };
    nonCitizenAnimationCache.set(entity, record);
  }
  return record;
}

export function actorAnimationFrame(entity, variant, action, {
  isMoving = false,
  phaseOffset = 0,
  hold = false,
} = {}) {
  const frameRate = action === 'idle' ? 22 : action === 'work' ? 6 : 7;
  const framePhase = Math.floor((phaseOffset / (Math.PI * 2)) * ACTOR_FRAMES) % ACTOR_FRAMES;
  const shouldAnimate = !hold && (action === 'idle' || action === 'work' || isMoving);
  const animationKey = `${variant}/${action}/${shouldAnimate ? 'active' : 'hold'}`;
  const animation = actorRenderRecord(entity);
  if (animation.animationKey !== animationKey) {
    const firstAnimation = animation.animationKey == null;
    animation.animationKey = animationKey;
    // The first time an actor is seen, retain its deterministic per-citizen
    // phase. Real action transitions start on the authored contact pose
    // instead of landing on an arbitrary global-tick frame.
    animation.animationStartedAt = G.gameTick - (firstAnimation ? framePhase * frameRate : 0);
  }
  if (!shouldAnimate) return 0;
  const elapsed = Math.max(0, G.gameTick - (animation.animationStartedAt ?? G.gameTick));
  return Math.floor(elapsed / frameRate) % ACTOR_FRAMES;
}

function drawCitizenSpriteIfReady(ctx, c, s, cy, faceScreenX, faceScreenY, facingAway, isMoving, phaseOffset) {
  const variant = actorVariantForCitizen(c);
  const action = actorActionForCitizen(c, isMoving);
  const dir = actorDirection(faceScreenX, faceScreenY, facingAway);
  const row = actorAtlasRowIndex(variant, action, dir);
  if (row < 0) return false;
  const frame = actorAnimationFrame(c, variant, action, { isMoving, phaseOffset });
  const targetW = 27;
  const targetH = 35;
  // Keep the subpixel position produced by lerpEnt(). Rounding here threw
  // away interpolation and reintroduced a one-pixel cadence at common zooms.
  const dx = s.x - targetW / 2;
  const dy = cy + 3 - targetH;
  const drawn = drawActorAtlasFrame(ctx, {
    role: variant,
    action,
    dir,
    frame,
    x: dx,
    y: dy,
    width: targetW,
    height: targetH,
  });
  if (drawn && c.carrying && actorOwnsBakedCargo(variant, action)) {
    drawCargoAtlasFrame(ctx, {
      role: variant,
      action,
      resource: c.carrying,
      dir,
      frame,
      x: dx,
      y: dy,
      width: targetW,
      height: targetH,
    });
  }
  return drawn;
}

// Interpolated draw position (Phase Q: jitter fix). Sim positions step
// per tick; frames between ticks draw at lerp(prev, cur, G._renderAlpha).
// Snap on teleports (evacuation, spawn, load) — never lerp across >1.5 tiles.
function lerpEnt(e) {
  const a = G._renderAlpha ?? 1;
  const px = e.presentationKind === 'citizen' ? e.previousX : e._px;
  const py = e.presentationKind === 'citizen' ? e.previousY : e._py;
  if (px === undefined || py === undefined) return e;
  if (Math.abs(px - e.x) + Math.abs(py - e.y) > 1.5) return e;
  return { x: px + (e.x - px) * a, y: py + (e.y - py) * a };
}

function citizenOnBlockedBuildingTile(c) {
  const mx = Math.round(c.x);
  const my = Math.round(c.y);
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return false;
  const b = G.buildingGrid[my]?.[mx];
  return !!b && b.type !== 'road';
}

const _NATURE_ATLAS_URL = 'assets/sprites/nature-atlas.png';
const _NATURE_ATLAS_FRAMES = {
  pine:     { x:   0, y:   0, trim: { x: 25, y:  3, w:  81, h: 120 } },
  oak:      { x: 128, y:   0, trim: { x: 12, y: 10, w: 104, h: 110 } },
  birch:    { x: 256, y:   0, trim: { x: 20, y:  3, w:  75, h: 123 } },
  dead:     { x: 384, y:   0, trim: { x: 25, y:  7, w:  76, h: 117 } },
  stone:    { x:   0, y: 128, trim: { x: 13, y: 21, w: 102, h:  85 } },
  iron:     { x: 128, y: 128, trim: { x: 11, y: 19, w:  98, h:  86 } },
  mountain: { x: 256, y: 128, trim: { x:  7, y:  8, w: 104, h: 104 } },
  flowers:  { x: 384, y: 128, trim: { x: 11, y: 24, w:  96, h:  85 } },
};
const _loadNatureAtlas = makeAtlasLoader(_NATURE_ATLAS_URL);
function drawNatureSprite(ctx, type, x, baseY, targetH, alpha = 1) {
  const atlas = _loadNatureAtlas();
  const frame = _NATURE_ATLAS_FRAMES[type];
  if (!atlas || !frame) return false;
  const trim = frame.trim;
  const targetW = targetH * (trim.w / trim.h);
  const oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha = oldAlpha * alpha;
  ctx.drawImage(
    atlas,
    frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
    x - targetW / 2, baseY - targetH, targetW, targetH
  );
  ctx.globalAlpha = oldAlpha;
  return true;
}

const _TERRAIN_ATLAS_URL = 'assets/sprites/terrain-atlas.png';
const _TERRAIN_ATLAS_FRAMES = {
  grass:    { x:   0, y:   0, trim: { x: 12, y: 32, w: 116, h: 84 } },
  forest:   { x: 128, y:   0, trim: { x:  0, y: 31, w: 125, h: 85 } },
  sand:     { x: 256, y:   0, trim: { x:  0, y: 31, w: 128, h: 85 } },
  water:    { x: 384, y:   0, trim: { x:  0, y: 31, w: 114, h: 86 } },
  stone:    { x:   0, y: 128, trim: { x: 12, y:  6, w: 116, h: 86 } },
  iron:     { x: 128, y: 128, trim: { x:  0, y:  6, w: 128, h: 86 } },
  mountain: { x: 256, y: 128, trim: { x:  0, y:  3, w: 128, h: 91 } },
  road:     { x: 384, y: 128, trim: { x:  0, y:  6, w: 114, h: 88 } },
};
const _loadTerrainAtlas = makeAtlasLoader(_TERRAIN_ATLAS_URL);
function terrainSpriteKey(tile) {
  if (tile === TILE.WATER) return 'water';
  if (tile === TILE.SAND) return 'sand';
  if (tile === TILE.GRASS) return 'grass';
  if (tile === TILE.FOREST) return 'forest';
  if (tile === TILE.STONE) return 'stone';
  if (tile === TILE.IRON) return 'iron';
  if (tile === TILE.MOUNTAIN) return 'mountain';
  return null;
}
function drawTerrainSprite(ctx, tile, s, alpha = 1, clipToTile = true) {
  const key = terrainSpriteKey(tile);
  const atlas = key ? _loadTerrainAtlas() : null;
  const frame = key ? _TERRAIN_ATLAS_FRAMES[key] : null;
  if (!atlas || !frame) return false;
  const trim = frame.trim;
  const targetW = TW * 1.18;
  const targetH = targetW * (trim.h / trim.w);
  const oldAlpha = ctx.globalAlpha;
  ctx.save();
  if (clipToTile) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - TH / 2);
    ctx.lineTo(s.x + TW / 2, s.y);
    ctx.lineTo(s.x, s.y + TH / 2);
    ctx.lineTo(s.x - TW / 2, s.y);
    ctx.closePath();
    ctx.clip();
  }
  ctx.globalAlpha = oldAlpha * alpha;
  ctx.drawImage(
    atlas,
    frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
    s.x - targetW / 2, s.y - TH / 2 - 4, targetW, targetH
  );
  ctx.restore();
  ctx.globalAlpha = oldAlpha;
  return true;
}
const _loadRasterAtlas = makeAtlasLoader(_RASTER_ATLAS_URL);

// Per-building sprite size table — Phase B step 2 (217), bumped at
// 239 per 238 critic HIGH finding. Original table sized by inspection
// against canvas drawX at zoom 1.0; empirical audit at zoom 1.3
// (default) showed sprites read ~20% undersized vs canvas
// equivalents. Bump applied per-building (some get more height than
// width to preserve characteristic silhouettes). The 1.1× scale of
// the parent envelope still multiplies these.
const _SPRITE_SIZES = {
  granary:    { w: 42, h: 50 },  // +17% / +19%
  storehouse: { w: 42, h: 50 },
  castle:     { w: 54, h: 68 },  // +23% / +21%
  wonder:     { w: 70, h: 88 },  // castle cell at x1.3 — the biggest silhouette on the map
  church:     { w: 48, h: 68 },  // +20% / +21%
  windmill:   { w: 44, h: 64 },  // +16% / +23%
  tower:      { w: 38, h: 64 },  // +19% / +23%
  house:      { w: 50, h: 54 },  // 351: bumped from 42×48 per 349 visual audit
  tavern:     { w: 46, h: 54 },  // +21% / +23%
  blacksmith: { w: 46, h: 52 },  // +21% / +24%
  market:     { w: 50, h: 46 },  // +19% / +21%
  bakery:     { w: 42, h: 50 },  // +17% / +19%
  barracks:   { w: 48, h: 56 },  // +20% / +22%
  townhall:   { w: 54, h: 56 },  // 255: civic-formal — wider than tall;
                                 //   slightly bigger than market for civic presence.
  well:       { w: 36, h: 44 },  // 306: smaller than user-buildable structures
                                 //   (well is supporting; small footprint).
  farm:        { w: 58, h: 38 },
  lumber:      { w: 52, h: 48 },
  sawmill:     { w: 52, h: 48 },
  quarry:      { w: 50, h: 42 },
  mine:        { w: 50, h: 46 },
  fisherman:   { w: 56, h: 50 },
  tradingpost: { w: 56, h: 50 },
  school:      { w: 48, h: 54 },
  archery:     { w: 52, h: 42 },
  wall:        { w: 76, h: 54 },
  road:        { w: 66, h: 30 },
  chickencoop: { w: 46, h: 40 },
  cowpen:      { w: 50, h: 40 },
};

const _BUILDING_SPRITE_CONTRACT = new Map(Object.keys(BUILDINGS).map((type) => {
  const spriteType = rasterSpriteKey(type);
  const support = Object.hasOwn(_SUPPORT_ATLAS_FRAMES, spriteType);
  const frames = support ? _SUPPORT_ATLAS_FRAMES : _RASTER_ATLAS_FRAMES;
  const trims = support ? _SUPPORT_ATLAS_TRIMS : _RASTER_ATLAS_TRIMS;
  const frame = frames[spriteType];
  const trim = trims[spriteType];
  const size = _SPRITE_SIZES[type];
  const missing = [
    !frame && 'frame',
    !trim && 'trim',
    !size && 'size',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`[render] Building sprite contract is incomplete for "${type}" (${missing.join(', ')})`);
  }
  return [type, Object.freeze({ spriteType, support, frame, trim, size })];
}));

function buildingSpriteContract(type) {
  const contract = _BUILDING_SPRITE_CONTRACT.get(type);
  if (!contract) throw new Error(`[render] Unknown building type "${type}"`);
  return contract;
}

function spriteTargetMetrics(type) {
  const { trim, size } = buildingSpriteContract(type);
  const targetH = size.h * 1.1;
  const targetW = Math.max(size.w, size.h * (trim.w / trim.h)) * 1.1;
  return { w: targetW, h: targetH };
}

const _SPRITE_GROUNDING = {
  castle: { w: 0.56, h: 0.18, y: 5, alpha: 0.82 },
  church: { w: 0.50, h: 0.17, y: 5, alpha: 0.76 },
  tower: { w: 0.46, h: 0.16, y: 5, alpha: 0.72 },
  windmill: { w: 0.56, h: 0.18, y: 5, alpha: 0.74 },
  townhall: { w: 0.58, h: 0.18, y: 5, alpha: 0.78 },
  well: { w: 0.44, h: 0.15, y: 4, alpha: 0.62 },
  farm: { w: 0.62, h: 0.12, y: 4, alpha: 0.42 },
  road: { skip: true },
  wall: { w: 0.66, h: 0.13, y: 5, alpha: 0.34 },
  fisherman: { w: 0.62, h: 0.15, y: 4, alpha: 0.50 },
  archery: { w: 0.58, h: 0.15, y: 5, alpha: 0.48 },
  chickencoop: { w: 0.54, h: 0.14, y: 4, alpha: 0.42 },
  cowpen: { w: 0.60, h: 0.14, y: 4, alpha: 0.44 },
};

function drawRasterSpriteGrounding(ctx, b, s, daylight = 1, progress = 1) {
  const spec = _SPRITE_GROUNDING[b.type] || {};
  if (spec.skip) return;

  const m = spriteTargetMetrics(b.type);
  const buildAlpha = 0.45 + Math.max(0, Math.min(1, progress)) * 0.55;
  const lightAlpha = 0.72 + Math.max(0, Math.min(1, daylight)) * 0.28;
  const alpha = (spec.alpha ?? 0.64) * buildAlpha * lightAlpha;
  const rx = Math.max(10, m.w * (spec.w ?? 0.52));
  const ry = Math.max(3.5, m.w * (spec.h ?? 0.16));
  const y = s.y + (spec.y ?? 5);

  ctx.save();
  ctx.fillStyle = `rgba(92, 68, 37, ${0.075 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(s.x + rx * 0.03, y + 1, rx * 1.08, ry * 0.96, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(12, 9, 6, ${0.18 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(s.x + rx * 0.08, y, rx * 0.72, ry * 0.70, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(5, 4, 3, ${0.13 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(s.x, y - ry * 0.18, rx * 0.38, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// drawSpriteIfReady: returns true if it drew the sprite. CALLED FROM
// INSIDE the parent translate/scale envelope in drawBuilding, so damage
// cracks and winter cap compose on top. Step 2 (217): sized per-building
// + bottom-anchored at s.
// Day/night tint is NOT applied here; the screen-space
// `applyNightTint` after the world pass tints the entire frame
// uniformly so per-sprite tinting would double-apply.
function drawImageWithReveal(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, reveal = 1) {
  const r = Math.max(0, Math.min(1, reveal));
  if (r >= 0.995) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  const visibleH = Math.max(2, dh * r);
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx - 4, dy + dh - visibleH - 2, dw + 8, visibleH + 4);
  ctx.clip();
  ctx.globalAlpha *= 0.48 + r * 0.52;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

function wallNeighbors(b) {
  return {
    n: !!(b && G.buildingGrid[b.y - 1]?.[b.x]?.type === 'wall'),
    s: !!(b && G.buildingGrid[b.y + 1]?.[b.x]?.type === 'wall'),
    e: !!(b && G.buildingGrid[b.y]?.[b.x + 1]?.type === 'wall'),
    w: !!(b && G.buildingGrid[b.y]?.[b.x - 1]?.type === 'wall'),
  };
}

const EMPTY_ROAD_NEIGHBORS = Object.freeze({
  xNeg: false,
  xPos: false,
  yNeg: false,
  yPos: false,
});

function roadNeighbors(b) {
  if (!b) return EMPTY_ROAD_NEIGHBORS;
  return {
    xNeg: G.buildingGrid[b.y]?.[b.x - 1]?.type === 'road',
    xPos: G.buildingGrid[b.y]?.[b.x + 1]?.type === 'road',
    yNeg: G.buildingGrid[b.y - 1]?.[b.x]?.type === 'road',
    yPos: G.buildingGrid[b.y + 1]?.[b.x]?.type === 'road',
  };
}

function drawRoadSurface(ctx, b, s, daylight = 1, neighbors = roadNeighbors(b)) {
  const top = { x: s.x, y: s.y - TH / 2 };
  const right = { x: s.x + TW / 2, y: s.y };
  const bottom = { x: s.x, y: s.y + TH / 2 };
  const left = { x: s.x - TW / 2, y: s.y };
  const winter = G.season === 'winter';
  const base = winter ? '#9a896f' : G.season === 'autumn' ? '#9a6b3f' : '#9f7548';
  const edge = winter ? '#625849' : '#65452d';
  const rut = winter ? 'rgba(73,64,53,0.38)' : 'rgba(82,54,34,0.38)';
  const light = Math.max(0, Math.min(1, daylight));

  ctx.save();
  ctx.globalAlpha = 0.88 + light * 0.12;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y - 0.35);
  ctx.lineTo(right.x + 0.7, right.y);
  ctx.lineTo(bottom.x, bottom.y + 0.35);
  ctx.lineTo(left.x - 0.7, left.y);
  ctx.closePath();
  ctx.fill();

  // Wheel ruts run to the midpoint of every connected edge. Opposite arms
  // form a straight lane; adjacent arms form a corner; 3–4 arms form a
  // junction without needing a separate sprite for every road shape.
  const connections = [
    [neighbors.xNeg, -TW / 4, -TH / 4],
    [neighbors.xPos, TW / 4, TH / 4],
    [neighbors.yNeg, TW / 4, -TH / 4],
    [neighbors.yPos, -TW / 4, TH / 4],
  ];
  ctx.strokeStyle = rut;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  for (const [connected, dx, dy] of connections) {
    if (!connected) continue;
    const length = Math.hypot(dx, dy);
    const offsetX = (-dy / length) * 2.2;
    const offsetY = (dx / length) * 2.2;
    ctx.beginPath();
    ctx.moveTo(s.x + offsetX, s.y + offsetY);
    ctx.lineTo(s.x + dx + offsetX, s.y + dy + offsetY);
    ctx.moveTo(s.x - offsetX, s.y - offsetY);
    ctx.lineTo(s.x + dx - offsetX, s.y + dy - offsetY);
    ctx.stroke();
  }

  // Only exposed edges get a border. Shared edges stay open, so neighboring
  // tiles read as one continuous road instead of repeated dirt islands.
  const exposedEdges = [
    [!neighbors.xNeg, top, left],
    [!neighbors.yNeg, top, right],
    [!neighbors.xPos, right, bottom],
    [!neighbors.yPos, left, bottom],
  ];
  ctx.globalAlpha = 0.62 + light * 0.18;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.25;
  ctx.lineCap = 'round';
  for (const [exposed, from, to] of exposedEdges) {
    if (!exposed) continue;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  if (!G.camera || G.camera.zoom >= 0.9) {
    const seed = (((b?.x || 0) * 73856093) ^ ((b?.y || 0) * 19349663)) >>> 0;
    ctx.globalAlpha = 0.22 + light * 0.08;
    ctx.fillStyle = winter ? '#d2c5aa' : '#d0a875';
    for (let i = 0; i < 3; i++) {
      const px = ((seed >>> (i * 5)) & 15) - 7.5;
      const py = ((seed >>> (i * 7 + 3)) & 7) - 3.5;
      ctx.fillRect(s.x + px, s.y + py, 1.4, 0.8);
    }
  }
  ctx.restore();
}

function drawSupportAtlasPiece(ctx, atlas, frame, trim, x, groundY, targetH, reveal = 1, alpha = 1, widthBoost = 1) {
  const targetW = targetH * (trim.w / trim.h) * widthBoost;
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawImageWithReveal(
    ctx,
    atlas,
    frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
    x - targetW / 2, groundY - targetH, targetW, targetH,
    reveal
  );
  ctx.restore();
}

function drawWallSpriteIfReady(ctx, b, s, reveal, contract) {
  const atlas = _loadSupportAtlas();
  if (!atlas) return false;
  const { frame, trim, size: base } = contract;

  const n = wallNeighbors(b);
  const drawPiece = (x, groundY, h, alpha = 1, widthBoost = 1) => {
    drawSupportAtlasPiece(ctx, atlas, frame, trim, x, groundY, h, reveal, alpha, widthBoost);
  };

  // Painted continuity: each east/south neighbor adds an atlas-backed
  // half-step so wall runs read as connected fortifications, not isolated
  // repeated blocks. Neighboring cells own the opposite half-step.
  const linkH = base.h * 0.76;
  if (n.e) drawPiece(s.x + TW * 0.27, s.y + TH * 0.24 + 3, linkH, 0.74, 1.04);
  if (n.s) drawPiece(s.x - TW * 0.27, s.y + TH * 0.24 + 3, linkH, 0.70, 1.04);

  const neighborCount = Number(n.n) + Number(n.s) + Number(n.e) + Number(n.w);
  drawPiece(s.x, s.y, base.h * (neighborCount ? 1 : 0.96), 1, 1.02);
  return true;
}

function drawSpriteIfReady(ctx, b, s, reveal = 1) {
  const contract = buildingSpriteContract(b.type);
  if (b.type === 'wall') return drawWallSpriteIfReady(ctx, b, s, reveal, contract);

  const atlas = contract.support ? _loadSupportAtlas() : _loadRasterAtlas();
  if (!atlas) return false;
  const { frame, trim, size } = contract;
  // Housing tiers read at a glance: hovels sit lower, manors stand taller.
  // Ground-anchored (draw rect is bottom-aligned at s.y), so only height/width scale.
  const tierScale = b.type === 'house' ? [0.9, 1.0, 1.1, 1.22][Math.min(4, b.level) - 1] : 1;
  const targetH = size.h * tierScale;
  const targetW = Math.max(size.w * tierScale, targetH * (trim.w / trim.h));
  drawImageWithReveal(
    ctx,
    atlas,
    frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
    s.x - targetW / 2, s.y - targetH, targetW, targetH,
    reveal
  );
  return true;
}
// Preload painted atlases at module init so the first frame after
// game-start dispatches to bitmap art immediately.
if (typeof window !== 'undefined') {
  setTimeout(() => {
    _loadRasterAtlas();
    _loadSupportAtlas();
    for (const tier of _ACTOR_ATLAS_TIERS) tier.load();
    for (const tier of _CARGO_ATLAS_TIERS) tier.load();
    for (const tier of _ACTOR_PREVIEW_TIERS.values()) tier.load();
    _loadNatureAtlas();
    _loadTerrainAtlas();
  }, 0);
}

// Debug helpers expose atlas readiness without reintroducing legacy toggles.
if (typeof window !== 'undefined') {
  window.__realm = window.__realm || {};
  window.__realm.rasterAtlas = () => ({
    url: _loadRasterAtlas.url,
    state: _loadRasterAtlas.state,
    frames: _RASTER_ATLAS_FRAMES,
  });
  window.__realm.supportAtlas = () => ({
    url: _loadSupportAtlas.url,
    state: _loadSupportAtlas.state,
    frames: _SUPPORT_ATLAS_FRAMES,
  });
  window.__realm.actorAtlas = () => ({
    tiers: _ACTOR_ATLAS_TIERS.map((tier) => ({
      key: tier.key,
      frameW: tier.frameW,
      frameH: tier.frameH,
      url: tier.load.url,
      state: tier.load.state,
    })),
    active: G.debug.actorAtlas || null,
    variants: ACTOR_VARIANTS,
    actions: ACTOR_ACTIONS,
    directions: ACTOR_DIRS,
    frames: ACTOR_FRAMES,
  });
  window.__realm.actorPreview = () => ({
    id: _actorPreviewEnabled ? _ACTOR_PREVIEW_ID : null,
    enabled: _actorPreviewEnabled,
    scope: _ACTOR_PREVIEW_SCOPE,
    bakedCargo: Boolean(_ACTOR_PREVIEW?.bakedCargo),
    tiers: [..._ACTOR_PREVIEW_TIERS.values()].map((tier) => ({
      key: tier.key,
      frameW: tier.frameW,
      frameH: tier.frameH,
      state: [...tier.rows.values()].every((load) => load.state === 'ready')
        ? 'ready'
        : ([...tier.rows.values()].some((load) => load.state === 'error')
            ? 'error'
            : 'loading'),
      rows: [...tier.rows.entries()].map(([key, load]) => ({
        key,
        url: load.url,
        state: load.state,
      })),
    })),
  });
  window.__realm.cargoAtlas = () => ({
    resources: CARGO_RESOURCES,
    directions: CARGO_DIRECTIONS,
    frames: CARGO_FRAMES,
    ownerRows: CARGO_OWNER_ROWS,
    tiers: _CARGO_ATLAS_TIERS.map((tier) => ({
      key: tier.key,
      frameW: tier.frameW,
      frameH: tier.frameH,
      url: tier.load.url,
      state: tier.load.state,
    })),
  });
  window.__realm.cargoFrameRect = (resource, dir, frame = 0) =>
    cargoAtlasFrameRect(resource, dir, frame);
  window.__realm.actorFrameRect = (role, action, dir, frame = 0) =>
    actorAtlasFrameRect(role, action, dir, frame);
  window.__realm.actorMapping = {
    variantForCitizen: (citizen) => actorVariantForCitizen(citizen || {}),
    actionForCitizen: (citizen, isMoving = false) => actorActionForCitizen(citizen || {}, !!isMoving),
    direction: (faceScreenX, faceScreenY, facingAway = false) =>
      actorDirection(Number(faceScreenX) || 0, Number(faceScreenY) || 0, !!facingAway),
  };
  window.__realm.natureAtlas = () => ({
    url: _loadNatureAtlas.url,
    state: _loadNatureAtlas.state,
    frames: _NATURE_ATLAS_FRAMES,
  });
  window.__realm.terrainAtlas = () => ({
    url: _loadTerrainAtlas.url,
    state: _loadTerrainAtlas.state,
    frames: _TERRAIN_ATLAS_FRAMES,
  });
  window.__realm.spriteCache = () => [
    { type: 'buildings-atlas-painted', state: _loadRasterAtlas.state },
    { type: 'support-atlas', state: _loadSupportAtlas.state },
    ..._ACTOR_ATLAS_TIERS.map((tier) => ({
      type: `actors-atlas-${tier.key}`,
      state: tier.load.state,
    })),
    ..._CARGO_ATLAS_TIERS.map((tier) => ({
      type: `cargo-payloads-${tier.key}`,
      state: tier.load.state,
    })),
    ...[..._ACTOR_PREVIEW_TIERS.values()].flatMap((tier) => (
      [...tier.rows.entries()].map(([key, load]) => ({
        type: `actor-preview-${tier.key}-${key.replace('/', '-')}`,
        state: load.state,
      }))
    )),
    { type: 'nature-atlas', state: _loadNatureAtlas.state },
    { type: 'terrain-atlas', state: _loadTerrainAtlas.state },
  ];
}

// ── Performance caches ────────────────────────────────────────
// Night glow gradient cache — keyed by "type_glowR" since gradient shape is
// the same for all buildings of the same type; position is applied via ctx offset
const nightGlowCache = new Map();

// Loop 094 (the-fixer, 086 filed): per-building winter cap geometry.
// Each entry: { w: halfWidth, h: height, y: yOffset-relative-to-s.y }.
// Broke 046's residential-blur cluster by giving each building-type a
// distinct cap silhouette at typical zoom. Buildings not in the table
// use `_default` (the pre-094 baseline). Road/wall/farm/quarry are
// gated out before this map is read.
const _WINTER_CAPS = {
  _default:   { w: 14, h: 3, y: -28 },
  // Tall outliers (pre-094 already distinct)
  tower:      { w: 8,  h: 3, y: -38 },
  church:     { w: 10, h: 3, y: -42 },
  // Residential cluster — 086 found these bit-for-bit identical in
  // winter silhouette. 094 disambiguates via w × h × y variation.
  // Loop 096 (the-fixer, 095 HIGH): 095 screenshot-critic found
  // windmill/granary/lumber had floating caps (visible gap between
  // sprite and ellipse) because 094's y-spread pushed caps above
  // the actual roof geometry. 096 reverts those three y-offsets
  // toward the -28 baseline while PRESERVING width variation — the
  // pixel-diff audit distinctness still holds (width axis), the
  // perceptual roof-conformance returns.
  house:      { w: 13, h: 3, y: -28 },  // baseline residential
  tavern:     { w: 16, h: 3, y: -27 },  // widest + 051 flag already above
  bakery:     { w: 14, h: 4, y: -25 },  // thicker + lower (bread/dome)
  lumber:     { w: 11, h: 3, y: -28 },  // 096: was -29 (floated above chimney)
  market:     { w: 17, h: 2, y: -24 },  // widest + flattest (awning)
  windmill:   { w: 9,  h: 3, y: -28 },  // 096: was -32 (floated above sails)
  // granary: entry removed in 158 — dome-conforming render replaces
  // the ellipse cap for granary specifically (see render block below).
  // Other non-residentials — left at default or small tweaks where distinct
  blacksmith: { w: 14, h: 3, y: -28 },  // baseline (046: blur with barracks)
  barracks:   { w: 13, h: 3, y: -29 },  // slightly narrower + higher
};

export function initRenderer(canvas) {
  C = canvas;
  ctx = C.getContext('2d');
}

export function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  logicalW = window.innerWidth;
  logicalH = window.innerHeight;
  C.width = logicalW * dpr;
  C.height = logicalH * dpr;
  C.style.width = logicalW + 'px';
  C.style.height = logicalH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Invalidate screen-space gradient caches
  nightGlowCache.clear();
}

export function toScreen(tx, ty) {
  return { x: (tx-ty)*TW/2, y: (tx+ty)*TH/2 };
}

// Smooth pan camera to tile (tx,ty) over ~1s. Used by event cinematic hooks.
export function panCameraTo(tx, ty, durMs = 900) {
  const target = toScreen(tx, ty);
  const startX = G.camera.x, startY = G.camera.y;
  const dx = target.x - startX, dy = target.y - startY;
  const t0 = performance.now();
  function step() {
    const t = Math.min(1, (performance.now() - t0) / durMs);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    G.camera.x = startX + dx * ease;
    G.camera.y = startY + dy * ease;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function toWorld(sx, sy) {
  const wx = sx/(TW/2), wy = sy/(TH/2);
  return { x: (wx+wy)/2, y: (wy-wx)/2 };
}

export function screenToWorld(mx, my) {
  const rect = C.getBoundingClientRect();
  const cx = (mx - rect.left) * (logicalW / rect.width);
  const cy = (my - rect.top) * (logicalH / rect.height);
  const sx = (cx - logicalW/2)/G.camera.zoom + G.camera.x;
  const sy = (cy - logicalH/2)/G.camera.zoom + G.camera.y;
  const w = toWorld(sx, sy);
  return { x: Math.round(w.x), y: Math.round(w.y) };
}

function shiftColor(color, shift) {
  let r, g, b;
  if (color.startsWith('#')) {
    r = parseInt(color.slice(1,3),16);
    g = parseInt(color.slice(3,5),16);
    b = parseInt(color.slice(5,7),16);
  } else if (color.startsWith('rgb')) {
    const m = color.match(/(\d+)/g);
    r = +m[0]; g = +m[1]; b = +m[2];
  } else {
    return color;
  }
  return `rgb(${Math.max(0,Math.min(255,r+shift[0]))},${Math.max(0,Math.min(255,g+shift[1]))},${Math.max(0,Math.min(255,b+shift[2]))})`;
}

// getDaylight is imported from state.js

// ── Loop 067 (the-fixer, 066 HIGH) ────────────────────────────
// Shared night-tint overlay. Applies a multiply-blend tint on top
// of the current ctx, using 012's dawn-rose / dusk-amber /
// indigo-night hue-lerp profile. Called from render() for the
// world pass AND from renderBuildingIsolated() so isolated-
// building audits see the same tint the live render shows.
//
// Arguments are explicit (not read from G) so callers in
// offscreen contexts don't need to swap G state.
//
// The fillRect is drawn well beyond any reasonable canvas edge
// so the tint covers both the iso world view (world-transformed
// ctx) and the isolated canvas (identity transform).
export function applyNightTint(ctx, daylight, dayPhase, dayLength) {
  if (daylight >= 0.95) return;
  const darkness = (1 - daylight);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const cappedDarkness = Math.min(darkness, 0.7);
  const dayTNow = (dayPhase ?? 0) / (dayLength ?? 3600);
  let kR, kG, kB;
  if (dayTNow < 0.10) {
    // Dawn — soft rose: R drops least, G medium, B more
    kR = 80; kG = 140; kB = 160;
  } else {
    // Dusk→night: lerp from amber (t=0.70) to indigo (t=1.0).
    // amber:  R 80, G 120, B 180 → keeps warm light, cools distance
    // indigo: R 180, G 140, B 100 → the classic night blue-cast
    const nightBlend = Math.max(0, Math.min(1, (dayTNow - 0.70) / 0.30));
    kR = 80  + (180 - 80)  * nightBlend;
    kG = 120 + (140 - 120) * nightBlend;
    kB = 180 + (100 - 180) * nightBlend;
  }
  const tintR = Math.round(255 - cappedDarkness * kR);
  const tintG = Math.round(255 - cappedDarkness * kG);
  const tintB = Math.round(255 - cappedDarkness * kB);
  ctx.fillStyle = `rgb(${tintR},${tintG},${tintB})`;
  ctx.fillRect(-5000, -5000, 10000, 10000);
  ctx.restore();
}

export function render() {
  const profileStart = _renderProfiling ? performance.now() : 0;
  const profile = _renderProfiling ? { start: profileStart, last: profileStart } : null;
  const citizenPresentations = buildCurrentCitizenPresentations();
  pruneCitizenRenderCache(citizenPresentations.map(citizen => citizen.actorId));
  const selectedCitizen = citizenPresentations.find(citizen => citizen.selected) || null;
  // Loop 76 (render S4): sky gradient varies with day phase. Before, the
  // off-island area was a flat near-black void at all times. Now: warm
  // orange/amber at dawn and dusk, pale blue midday, deep navy at night.
  // Top-to-bottom gradient so horizon warmth reads against the cooler
  // upper sky.
  {
    const t = (G.dayPhase ?? 0) / (G.dayLength ?? 3600);
    // t: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk, 1=midnight
    const dawn = Math.max(0, 1 - Math.abs(t - 0.22) * 8);  // peaks at t=0.22
    const dusk = Math.max(0, 1 - Math.abs(t - 0.78) * 8);  // peaks at t=0.78
    const day  = Math.max(0, Math.min(1, (t - 0.18) * 10)) * Math.max(0, Math.min(1, (0.82 - t) * 10));
    // Choose top/bottom sky colors by phase
    const mix = (a, b, f) => {
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab2 = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb2 = b & 255;
      return `rgb(${Math.round(ar + (br - ar) * f)},${Math.round(ag + (bg - ag) * f)},${Math.round(ab2 + (bb2 - ab2) * f)})`;
    };
    const nightTop = 0x06080f, nightBot = 0x121628;
    const dawnTop = 0x2e2a50, dawnBot = 0xc6703a;
    const dayTop = 0x8fb4de, dayBot = 0xd0dbe8;
    const duskTop = 0x3a2a58, duskBot = 0xd06044;
    // Loop 047 (the-fixer, 045 HIGH finding): midday sky was season-
    // blind. Shift dayTop/dayBot by the season's skyShift so midday
    // reads autumn-amber / winter-cool / etc. Only the `day` blend
    // pulls toward dayTopS — dawn/dusk keep nightTop/dawnTop/duskTop
    // unchanged so 012's hue-variation thread is untouched.
    const seasonSkyShift = (getSeasonData().skyShift) || [0,0,0];
    const shiftHex = (hex, sh) => {
      const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + sh[0]));
      const g = Math.max(0, Math.min(255, ((hex >> 8)  & 255) + sh[1]));
      const b = Math.max(0, Math.min(255, (hex & 255)         + sh[2]));
      return (r << 16) | (g << 8) | b;
    };
    const dayTopS = shiftHex(dayTop, seasonSkyShift);
    const dayBotS = shiftHex(dayBot, seasonSkyShift);
    const lerp2 = (a, b, f) => a * (1 - f) + b * f;
    // Blend: night is default; dawn/dusk/day override by phase amount.
    let topR = ((nightTop >> 16) & 255), topG = ((nightTop >> 8) & 255), topB = nightTop & 255;
    let botR = ((nightBot >> 16) & 255), botG = ((nightBot >> 8) & 255), botB = nightBot & 255;
    const apply = (color, f) => {
      const cr = (color >> 16) & 255, cg = (color >> 8) & 255, cb = color & 255;
      topR = lerp2(topR, cr, f); topG = lerp2(topG, cg, f); topB = lerp2(topB, cb, f);
    };
    const applyBot = (color, f) => {
      const cr = (color >> 16) & 255, cg = (color >> 8) & 255, cb = color & 255;
      botR = lerp2(botR, cr, f); botG = lerp2(botG, cg, f); botB = lerp2(botB, cb, f);
    };
    apply(dawnTop, dawn); applyBot(dawnBot, dawn);
    apply(dayTopS, day); applyBot(dayBotS, day);
    apply(duskTop, dusk); applyBot(duskBot, dusk);
    const grad = ctx.createLinearGradient(0, 0, 0, logicalH);
    grad.addColorStop(0, `rgb(${Math.round(topR)},${Math.round(topG)},${Math.round(topB)})`);
    grad.addColorStop(1, `rgb(${Math.round(botR)},${Math.round(botG)},${Math.round(botB)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, logicalW, logicalH);
    void mix; void nightTop; void dawnTop; void dayTop; void duskTop;
  }

  ctx.save();
  const shake = G.cameraShake || 0;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(logicalW/2 + shakeX, logicalH/2 + shakeY);
  ctx.scale(G.camera.zoom, G.camera.zoom);
  ctx.translate(-G.camera.x, -G.camera.y);

  const daylight = getDaylight();

  // God rays from upper-left (sun direction) — only during daytime
  if (daylight > 0.6) {
    const rayAlpha = (daylight - 0.6) * 0.15;
    ctx.globalAlpha = rayAlpha;
    ctx.fillStyle = 'rgba(255, 245, 210, 0.6)';
    // Draw 4 long beams radiating from upper-left
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(-500 + i * 200, -400);
      ctx.rotate(0.7 + i * 0.04);
      ctx.fillRect(0, 0, 40, 3000);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  markRenderPass(profile, 'skyCamera');

  // ── Tiles ─────────────────────────────────────────────────
  // Viewport culling — isometric needs all 4 screen corners
  const c0 = screenToWorld(0, 0);
  const c1 = screenToWorld(logicalW, 0);
  const c2 = screenToWorld(0, logicalH);
  const c3 = screenToWorld(logicalW, logicalH);
  const pad = 2;
  const minX = Math.max(0, Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - pad);
  const maxX = Math.min(MAP_W-1, Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + pad);
  const minY = Math.max(0, Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - pad);
  const maxY = Math.min(MAP_H-1, Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + pad);

  // Close-up terrain ornaments are surprisingly expensive because they add
  // many tiny path draws per visible tile. Keep them for inspection zooms, but
  // let normal gameplay spend its frame budget on actors and buildings.
  const showDetails = G.camera.zoom >= 1.55;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const tile = G.map[y][x];
      const s = toScreen(x, y);
      if (!G.fog[y][x]) {
        const fogPulse = 0.025 + 0.015 * Math.sin((x * 17 + y * 23 + G.gameTick) * 0.025);
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = tile === TILE.WATER ? '#17314d' : '#223450';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - TH/2);
        ctx.lineTo(s.x + TW/2, s.y);
        ctx.lineTo(s.x, s.y + TH/2);
        ctx.lineTo(s.x - TW/2, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = fogPulse;
        ctx.fillStyle = '#d6e4ff';
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const colors = TILE_COLORS[tile];
      // Two-tone alternation reads as a checkerboard once the night
      // multiply-overlay amplifies relative contrast — flatten it in low
      // light (the dusk tint masks the transition).
      let tileColor = daylight < 0.85 ? colors[0] : colors[(x+y)%2];
      const seasonShift = getSeasonData().tileShift;

      // Water uses large-scale smooth noise — no per-tile checkerboard seams
      if (tile === TILE.WATER) {
        const n = (Math.sin(x * 0.3 + 0.7) + Math.cos(y * 0.4 + 0.5)) * 0.5 + 0.5;
        const tint = Math.floor(n * 10) - 5;
        tileColor = `rgb(${0x22 + tint}, ${0x63 + tint}, ${0x86 + tint})`;
      }

      // Grass/sand shade variation via position hash + season tint.
      // Loop 13 (render S3): prior code used 4 discrete color buckets for grass,
      // which left ~13pt jumps between adjacent tiles — the seam was visible as a
      // diamond lattice over every field (fresh-eyes critique #5). Now we draw
      // from a shared base with small continuous offsets, so tile-to-tile deltas
      // are ~3pt max and the grid reads as natural meadow variation instead of
      // a bisected checkerboard.
      if (tile === TILE.GRASS || tile === TILE.SAND) {
        const h = ((x * 374761 + y * 668265) & 0xff);
        // Night multiply-overlay amplifies relative contrast; damp the
        // per-tile variance in low light so meadows stay meadow, not mesh.
        const varScale = daylight < 0.85 ? 0.35 : 1;
        const n1 = (((h & 0xf) / 15) - 0.5) * varScale;
        const n2 = ((((h >> 4) & 0xf) / 15) - 0.5) * varScale;
        if (tile === TILE.GRASS) {
          const r = 64 + Math.round(n1 * 8);
          const g = 128 + Math.round(n2 * 10);
          const b = 66 + Math.round(n1 * 5);
          tileColor = shiftColor(`rgb(${r},${g},${b})`, seasonShift);
        } else {
          const r = 198 + Math.round(n1 * 8);
          const g = 164 + Math.round(n2 * 6);
          const b = 102 + Math.round(n1 * 6);
          tileColor = shiftColor(`rgb(${r},${g},${b})`, seasonShift);
        }
      }

      ctx.globalAlpha = daylight;
      // Water depth = 0 — water is flat at ocean level, no raised side faces
      const tileDepth = tile === TILE.WATER ? 0 : tile === TILE.SAND ? 3 : tile === TILE.MOUNTAIN ? 8 : 4;

      // Top face
      ctx.fillStyle = tileColor;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2);
      ctx.lineTo(s.x + TW/2, s.y);
      ctx.lineTo(s.x, s.y + TH/2);
      ctx.lineTo(s.x - TW/2, s.y);
      ctx.closePath();
      ctx.fill();
      if (tile === TILE.GRASS || tile === TILE.FOREST) {
        drawTerrainSprite(ctx, tile, s, daylight * 0.88, false);
      } else {
        const terrainAlpha =
          tile === TILE.SAND ? 0.62 :
          tile === TILE.WATER ? 0.56 :
          0.74;
        drawTerrainSprite(ctx, tile, s, daylight * terrainAlpha);
      }

      // Atmospheric haze — outer edge tiles fade to pale blue-grey
      if (tile !== TILE.WATER && showDetails) {
        const centerDist = Math.sqrt(Math.pow(x - MAP_W/2, 2) + Math.pow(y - MAP_H/2, 2)) / (MAP_W/2);
        const haze = Math.max(0, centerDist - 0.6) * 0.4;
        if (haze > 0) {
          ctx.globalAlpha = daylight * haze;
          ctx.fillStyle = 'rgb(200,215,230)';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - TH/2);
          ctx.lineTo(s.x + TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x - TW/2, s.y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }

      // Path wear overlay — tiles citizens walk on gradually darken into worn dirt paths
      if (G.tileWear && tile !== TILE.WATER && tile !== TILE.MOUNTAIN) {
        const wear = G.tileWear[y]?.[x] || 0;
        if (wear > 5) {
          const wearAlpha = Math.min(0.55, wear / 400);
          ctx.globalAlpha = daylight * wearAlpha;
          ctx.fillStyle = '#6a4e2e';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - TH/2);
          ctx.lineTo(s.x + TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x - TW/2, s.y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }

      // Tile texture — subtle noise pattern for visual richness
      // Only draw on every other tile (checkerboard) — halves draw calls with no perceptible loss
      if (tile !== TILE.WATER && showDetails && (x + y) % 2 === 0) {
        ctx.globalAlpha = daylight * 0.08;
        for (let i = 0; i < 3; i++) {
          const nx = s.x + ((x * 7 + i * 13) % 20) - 10;
          const ny = s.y + ((y * 11 + i * 17) % 12) - 6;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
          ctx.fillRect(nx, ny, 1.5, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Terrain blend: multi-step gradient at edges bordering different biomes
      if (tile >= TILE.SAND && tile <= TILE.FOREST && showDetails) {
        for (const [dx2, dy2] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = x+dx2, ny = y+dy2;
          if (nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) continue;
          const nTile = G.map[ny][nx];
          if (nTile === tile || nTile === TILE.WATER || nTile === TILE.MOUNTAIN) continue;
          const nColors = TILE_COLORS[nTile];
          // 3 overlapping circles at different radii, decreasing alpha for soft gradient
          ctx.globalAlpha = daylight * 0.18;
          ctx.fillStyle = nColors[0];
          ctx.beginPath();
          ctx.arc(s.x + dx2 * 16, s.y + dy2 * 8, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = daylight * 0.10;
          ctx.beginPath();
          ctx.arc(s.x + dx2 * 13, s.y + dy2 * 6, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = daylight * 0.06;
          ctx.beginPath();
          ctx.arc(s.x + dx2 * 10, s.y + dy2 * 5, 15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Side faces — only for non-water tiles that have actual depth
      if (tileDepth > 0 && showDetails) {
        // Right side face (darker)
        ctx.fillStyle = shiftColor(tileColor, [-30, -30, -30]);
        ctx.beginPath();
        ctx.moveTo(s.x + TW/2, s.y);
        ctx.lineTo(s.x, s.y + TH/2);
        ctx.lineTo(s.x, s.y + TH/2 + tileDepth);
        ctx.lineTo(s.x + TW/2, s.y + tileDepth);
        ctx.closePath();
        ctx.fill();

        // Left side face (medium dark)
        ctx.fillStyle = shiftColor(tileColor, [-18, -18, -18]);
        ctx.beginPath();
        ctx.moveTo(s.x - TW/2, s.y);
        ctx.lineTo(s.x, s.y + TH/2);
        ctx.lineTo(s.x, s.y + TH/2 + tileDepth);
        ctx.lineTo(s.x - TW/2, s.y + tileDepth);
        ctx.closePath();
        ctx.fill();
      }

      // Cliff edge — darker rocky face where land meets water
      if (tile !== TILE.WATER && showDetails) {
        const waterRight = x < MAP_W-1 && G.map[y][x+1] === TILE.WATER;
        const waterDown  = y < MAP_H-1 && G.map[y+1][x] === TILE.WATER;
        if (waterRight) {
          ctx.globalAlpha = daylight * 0.65;
          ctx.fillStyle = '#2a1a0a';
          ctx.beginPath();
          ctx.moveTo(s.x + TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x, s.y + TH/2 + tileDepth + 2);
          ctx.lineTo(s.x + TW/2, s.y + tileDepth + 2);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
        if (waterDown) {
          ctx.globalAlpha = daylight * 0.55;
          ctx.fillStyle = '#2a1a0a';
          ctx.beginPath();
          ctx.moveTo(s.x - TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x, s.y + TH/2 + tileDepth + 2);
          ctx.lineTo(s.x - TW/2, s.y + tileDepth + 2);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }

      // Beach edge shimmer on sand tiles adjacent to water
      if (tile === TILE.SAND) {
        const hasWater = (
          (x>0 && G.map[y][x-1]===TILE.WATER) ||
          (x<MAP_W-1 && G.map[y][x+1]===TILE.WATER) ||
          (y>0 && G.map[y-1][x]===TILE.WATER) ||
          (y<MAP_H-1 && G.map[y+1][x]===TILE.WATER)
        );
        if (hasWater) {
          const shimmer = 0.08 + 0.04 * Math.sin(G.gameTick * 0.03 + x + y);
          ctx.fillStyle = `rgba(120,180,255,${shimmer})`;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - TH/2);
          ctx.lineTo(s.x + TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x - TW/2, s.y);
          ctx.closePath();
          ctx.fill();
          // Foam bubble animation at shoreline
          const foamPhase = (G.gameTick * 0.02 + x * 0.3 + y * 0.7) % (Math.PI * 2);
          const foamAlpha = 0.25 + 0.2 * Math.sin(foamPhase);
          ctx.globalAlpha = daylight * foamAlpha;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(s.x - 8, s.y + 4, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(s.x + 6, s.y + 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }

      // Beach details — shells and wet sand near water
      if (tile === TILE.SAND && showDetails) {
        const adjWater = (x>0 && G.map[y][x-1]===TILE.WATER) || (x<MAP_W-1 && G.map[y][x+1]===TILE.WATER) ||
                         (y>0 && G.map[y-1][x]===TILE.WATER) || (y<MAP_H-1 && G.map[y+1][x]===TILE.WATER);
        if (adjWater) {
          // Wet sand strip
          ctx.globalAlpha = daylight * 0.2;
          ctx.fillStyle = '#a08850';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + TW/4, s.y + TH/4);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x - TW/4, s.y + TH/4);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
        // Shells/pebbles
        const sh = ((x * 31 + y * 47) & 0xff);
        if (sh < 40) {
          ctx.globalAlpha = daylight * 0.5;
          ctx.fillStyle = '#f0e0c0';
          ctx.beginPath();
          ctx.arc(s.x - 5 + sh%10, s.y + sh%4 - 2, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }

      // Ambient occlusion — darken edges where elevation changes
      if (tile !== TILE.WATER) {
        const adjWater = (
          (x>0 && G.map[y][x-1]===TILE.WATER) ||
          (x<MAP_W-1 && G.map[y][x+1]===TILE.WATER) ||
          (y>0 && G.map[y-1][x]===TILE.WATER) ||
          (y<MAP_H-1 && G.map[y+1][x]===TILE.WATER)
        );
        if (adjWater) {
          ctx.globalAlpha = daylight * 0.15;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + TH/2 - 2);
          ctx.lineTo(s.x + TW/2, s.y - 2);
          ctx.lineTo(s.x + TW/2, s.y + 2);
          ctx.lineTo(s.x, s.y + TH/2 + 2);
          ctx.lineTo(s.x - TW/2, s.y + 2);
          ctx.lineTo(s.x - TW/2, s.y - 2);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }

      // Winter frost overlay on land tiles
      if (G.season === 'winter' && tile !== TILE.WATER && tile !== TILE.SAND) {
        ctx.fillStyle = 'rgba(200,220,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - TH/2);
        ctx.lineTo(s.x + TW/2, s.y);
        ctx.lineTo(s.x, s.y + TH/2);
        ctx.lineTo(s.x - TW/2, s.y);
        ctx.closePath();
        ctx.fill();
      }

      // Autumn leaf specks on grass
      if (G.season === 'autumn' && tile === TILE.GRASS) {
        const lh = ((x*17 + y*31) & 0xff);
        if (lh < 40) {
          ctx.fillStyle = ['#c06020','#d4a030','#a05020'][lh % 3];
          // User feedback: "less transparencies" — bump 0.5→0.85 so autumn leaves read as distinct specks
          ctx.globalAlpha = daylight * 0.85;
          ctx.fillRect(s.x - 4 + (lh%8), s.y - 2 + ((lh>>3)%5), 2, 1.5);
          ctx.globalAlpha = daylight;
        }
      }

      if (showDetails) {
      // Grass tufts and tiny flowers on grass tiles
      if (tile === TILE.GRASS && G.season !== 'winter') {
        const gh = ((x * 271 + y * 619) & 0xff);
        // Tufts are STATIC. The prior per-frame `Math.sin(G.gameTick * 0.02)`
        // sway made every tuft on every grass tile wobble in a different
        // phase — combined effect was a constant low-amplitude shimmer across
        // the whole map that user-reported as "tiles pulsing" and made the
        // tiny 3-blade tuft shapes impossible to identify as grass. Fixed
        // positions let the eye lock onto them as static texture.
        // Keep ground details present, but under the painted terrain texture.
        // Full-opacity dots and blades read as screen noise once the raster atlas
        // is carrying most of the meadow color.
        ctx.globalAlpha = daylight * 0.66;
        // Reduced from gh<140 (~55%) to gh<70 (~27%) — was too busy, read as noise/artifacts
        if (gh < 70) {
          const drewFlower = gh < 5 && drawNatureSprite(ctx, 'flowers', s.x + ((gh % 7) - 3), s.y + 5, 12, daylight * 0.52);
          ctx.globalAlpha = daylight * 0.66;
          if (!drewFlower) {
            ctx.fillStyle = G.season === 'autumn' ? '#8a9a50' : '#3a8a3a';
            const gx = s.x - 8 + (gh % 16), gy = s.y - 4 + ((gh >> 4) % 6);
            ctx.beginPath();
            ctx.moveTo(gx, gy); ctx.lineTo(gx - 1, gy - 4); ctx.lineTo(gx + 1.5, gy - 3);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 3, gy - 5); ctx.lineTo(gx + 5, gy - 1.5);
            ctx.fill();
            // Third blade for denser tufts — also halved from gh<80 to gh<35
            if (gh < 35) {
              ctx.beginPath();
              ctx.moveTo(gx + 5, gy); ctx.lineTo(gx + 6, gy - 4); ctx.lineTo(gx + 7.5, gy - 2);
              ctx.fill();
            }
          }
        }
        if (G.season === 'spring' && gh > 244) {
          ctx.fillStyle = ['#e6a6b9','#d9c763','#91b6c9'][gh % 3];
          ctx.globalAlpha = daylight * 0.42;
          const fx = s.x - 6 + (gh % 12), fy = s.y - 2 + ((gh >> 3) % 5);
          ctx.beginPath();
          ctx.ellipse(fx, fy, 1.05, 0.7, (gh % 5) * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = daylight;
      }

      // Scattered small boulders on grass tiles (~5%)
      if (tile === TILE.GRASS && showDetails) {
        const rh = ((x * 149 + y * 211) & 0xff);
        if (rh < 13) {
          const bx = s.x + (rh % 8) - 4;
          const by = s.y + ((rh >> 3) % 5) - 2;
          ctx.fillStyle = '#6a6560';
          ctx.beginPath();
          ctx.ellipse(bx, by, 2.5, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#8a8580';
          ctx.beginPath();
          ctx.ellipse(bx - 0.5, by - 0.5, 1.2, 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Rare clover patches on grass (~5%, not in winter)
      if (tile === TILE.GRASS && showDetails && G.season !== 'winter') {
        const ch = ((x * 89 + y * 131) & 0xff);
        if (ch < 12) {
          const cx = s.x + (ch % 16) - 8;
          const cy = s.y + ((ch >> 3) % 8) - 4;
          ctx.globalAlpha = daylight * 0.55;
          ctx.fillStyle = '#7ab85a';
          for (let i = 0; i < 3; i++) {
            const ang = i * Math.PI * 2 / 3;
            const lx = cx + Math.cos(ang) * 1.2;
            const ly = cy + Math.sin(ang) * 0.8;
            ctx.beginPath();
            ctx.arc(lx, ly, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = daylight;
        }
      }

      // Pebbles on stone tiles
      if (tile === TILE.STONE) {
        const ph = ((x * 193 + y * 457) & 0xff);
        if (ph < 90) {
          // User feedback: "less transparencies" — bump 0.45→0.85 so pebbles read as solid stones, not smudges
          ctx.globalAlpha = daylight * 0.85;
          ctx.fillStyle = ph < 45 ? '#c0bdb8' : '#a8a5a0';
          const px1 = s.x - 10 + (ph % 20), py1 = s.y - 1 + ((ph >> 4) % 5);
          ctx.beginPath();
          ctx.ellipse(px1, py1, 2.5, 1.5, 0.3, 0, Math.PI * 2);
          ctx.fill();
          if (ph < 50) {
            const px2 = s.x + 3 + (ph % 7), py2 = s.y + 2 - ((ph >> 3) % 4);
            ctx.beginPath();
            ctx.ellipse(px2, py2, 1.8, 1.1, -0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = daylight;
        }
      }

      // Occasional mushrooms on forest tile edges
      if (tile === TILE.FOREST) {
        const fh = ((x * 317 + y * 541) & 0xff);
        if (fh > 230) {
          const hasGrass = (
            (x>0 && G.map[y][x-1]===TILE.GRASS) ||
            (x<MAP_W-1 && G.map[y][x+1]===TILE.GRASS) ||
            (y>0 && G.map[y-1][x]===TILE.GRASS) ||
            (y<MAP_H-1 && G.map[y+1][x]===TILE.GRASS)
          );
          if (hasGrass) {
            const mx = s.x - 10 + (fh % 20), my = s.y - 1 + ((fh >> 4) % 5);
            // User feedback: "less transparencies" — bump 0.85→1.0 for fully-readable mushroom caps
            ctx.globalAlpha = daylight;
            // Stem
            ctx.fillStyle = '#e8d8b0';
            ctx.fillRect(mx - 1, my - 4, 2, 4);
            // Cap
            ctx.fillStyle = fh % 2 === 0 ? '#c03020' : '#8b4513';
            ctx.beginPath();
            ctx.ellipse(mx, my - 4, 4, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Cap highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.ellipse(mx - 1, my - 5, 1.5, 1, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = daylight;
          }
        }
      }

      // Small mushroom clusters on forest tiles (~10%)
      if (tile === TILE.FOREST && showDetails) {
        const mh = ((x * 71 + y * 97) & 0xff);
        if (mh < 25) {
          const mx = s.x + (mh % 14) - 7;
          const my = s.y + ((mh >> 3) % 6) - 1;
          // Red cap with white spots
          ctx.fillStyle = '#c83232';
          ctx.beginPath();
          ctx.ellipse(mx, my, 1.5, 1, 0, Math.PI, 0);
          ctx.fill();
          // White stem
          ctx.fillStyle = '#f0e8d8';
          ctx.fillRect(mx - 0.5, my, 1, 1.5);
          // Spot on cap
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(mx - 0.3, my - 0.5, 0.6, 0.5);
        }
      }

      // Old tree stumps on grass near forest edges (~6%)
      if (tile === TILE.GRASS && showDetails) {
        const nearForest =
          (x > 0 && G.map[y][x-1] === TILE.FOREST) ||
          (x < MAP_W - 1 && G.map[y][x+1] === TILE.FOREST) ||
          (y > 0 && G.map[y-1][x] === TILE.FOREST) ||
          (y < MAP_H - 1 && G.map[y+1][x] === TILE.FOREST);
        if (nearForest) {
          const sh = ((x * 13 + y * 29) & 0xff);
          if (sh < 15) {
            const stx = s.x + (sh % 10) - 5;
            const sty = s.y + ((sh >> 2) % 6) - 3;
            // Stump base
            ctx.fillStyle = '#6a4a2a';
            ctx.beginPath();
            ctx.ellipse(stx, sty, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Top ring (sawn surface)
            ctx.fillStyle = '#b89468';
            ctx.beginPath();
            ctx.ellipse(stx, sty - 0.5, 2.5, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Growth rings
            ctx.strokeStyle = '#8a6a4a';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.ellipse(stx, sty - 0.5, 1.2, 0.7, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Heavily-worn tiles show packed dirt speckles
      if (G.tileWear && G.tileWear[y]?.[x] > 150 && tile !== TILE.WATER && tile !== TILE.MOUNTAIN) {
        ctx.globalAlpha = daylight * 0.35;
        ctx.fillStyle = '#4a3218';
        const sh = ((x * 13 + y * 29) & 0xff);
        ctx.fillRect(s.x - 5 + (sh % 10), s.y - 2 + ((sh >> 3) % 4), 1, 1);
        ctx.fillRect(s.x - 3 + ((sh * 3) % 10), s.y + ((sh * 7) % 4) - 1, 1, 1);
        ctx.globalAlpha = daylight;
      }

      // Lily pads on water (~2%)
      if (tile === TILE.WATER && showDetails) {
        const lh = ((x * 43 + y * 67) & 0xff);
        if (lh < 5) {
          const lpx = s.x + (lh % 10) - 5;
          const lpy = s.y + ((lh >> 2) % 6) - 3;
          ctx.fillStyle = 'rgba(50, 120, 50, 0.7)';
          ctx.beginPath();
          ctx.ellipse(lpx, lpy, 3, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          // Pink flower sometimes
          if (lh < 2) {
            ctx.fillStyle = '#ff9aae';
            ctx.beginPath();
            ctx.arc(lpx, lpy - 0.5, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      } // end showDetails

      // Tile features
      if (tile === TILE.FOREST) {
        if (G.camera.zoom < 0.6) {
          // Simple green dot for far zoom
          ctx.fillStyle = '#3a8a40';
          ctx.globalAlpha = daylight;
          ctx.beginPath();
          ctx.arc(s.x, s.y - 6, 8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawTree(ctx, s.x, s.y-8, daylight, seasonShift);
        }
      }
      else if (tile === TILE.STONE) {
        drawRock(ctx, s.x, s.y-4, daylight);
        // Extra rubble dots for texture
        ctx.globalAlpha = daylight * 0.4;
        ctx.fillStyle = '#aaa';
        const rh = ((x*7+y*13) & 0xf);
        ctx.fillRect(s.x - 8 + rh, s.y + 2, 2, 1.5);
        ctx.fillRect(s.x + 4 - rh%5, s.y - 1, 1.5, 1.5);
      }
      else if (tile === TILE.IRON) drawIronOre(ctx, s.x, s.y-4, daylight);
      else if (tile === TILE.WATER) {
        drawWater(ctx, s.x, s.y, daylight, x, y);
        // Distant ocean mist — fade water tiles near map edges into haze
        const edgeDist = Math.min(x, MAP_W-1-x, y, MAP_H-1-y);
        if (edgeDist < 3) {
          const mistAlpha = (1 - edgeDist / 3) * 0.55;
          const mistPulse = 0.03 * Math.sin(G.gameTick * 0.015 + x * 0.4 + y * 0.3);
          ctx.globalAlpha = daylight * (mistAlpha + mistPulse);
          ctx.fillStyle = '#b8d4f0';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - TH/2);
          ctx.lineTo(s.x + TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x - TW/2, s.y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = daylight;
        }
      }
      else if (tile === TILE.MOUNTAIN) {
        if (drawNatureSprite(ctx, 'mountain', s.x, s.y + 11, 48, daylight)) {
          ctx.globalAlpha = daylight;
        } else {
        // Loop 2 (render S3): per-tile silhouette variance. Before this, every
        // mountain shared identical base widths, peak positions, and snow shape
        // even though `mh` was being computed — only height varied. Fresh-eyes
        // critique called them "identical grey traffic cones stamped in rows".
        // Now width, lean, snow shape, twin-peak vary per tile-hash.
        const mh = ((x * 37 + y * 53) & 0xff);
        const peakH = 28 + (mh % 9);
        // Base half-width: 10-17px (was fixed 14)
        const baseHW = 10 + ((mh >> 1) & 0x7);
        // Horizontal lean: ±3px asymmetry between left/right base
        const lean = ((mh >> 4) & 0x7) - 3;
        // Snow cap asymmetry: picks which side drips lower
        const snowTilt = ((mh >> 2) & 0x3) - 1;
        // Twin peak modifier: ~1 in 4 mountains gets a secondary sub-peak
        const twin = (mh & 0x3) === 0;
        const snowless = (mh & 0x1f) === 0; // ~1 in 32 = bare rocky outcrop

        // Back peak (taller, darker) — apex shifts with lean
        const bx = s.x - 3 + lean, byTop = s.y - peakH - (mh % 4);
        ctx.fillStyle = '#5a5a6a';
        ctx.beginPath();
        ctx.moveTo(bx, byTop);
        ctx.lineTo(bx - baseHW, s.y + 4);
        ctx.lineTo(bx + baseHW - 2, s.y + 2);
        ctx.closePath(); ctx.fill();

        // Rocky shadow strokes on back peak
        ctx.strokeStyle = 'rgba(20,20,30,0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bx - 3, byTop + 5); ctx.lineTo(bx - 8, s.y);
        ctx.moveTo(bx + 2, byTop + 8); ctx.lineTo(bx + 6, s.y - 2);
        ctx.stroke();

        // Snow cap on back peak — asymmetric drip
        if (!snowless) {
          ctx.fillStyle = 'rgba(240,245,255,0.92)';
          ctx.beginPath();
          ctx.moveTo(bx, byTop);
          ctx.lineTo(bx - 5 + snowTilt, byTop + 9);
          ctx.lineTo(bx + 4 - snowTilt, byTop + 8);
          ctx.closePath(); ctx.fill();
        }

        // Front peak (shorter, lighter — main visible face)
        const fpeakH = peakH - 6;
        // Narrower front base — also scaled with baseHW
        const fBaseHW = Math.max(8, baseHW - 2);
        const fx = s.x + 4 - lean, fyTop = s.y - fpeakH - (mh % 3);
        ctx.fillStyle = '#7a7a88';
        ctx.beginPath();
        ctx.moveTo(fx, fyTop);
        ctx.lineTo(fx - fBaseHW, s.y + 4);
        ctx.lineTo(fx + fBaseHW, s.y + 4);
        ctx.closePath(); ctx.fill();

        // Rocky strokes on front peak
        ctx.strokeStyle = 'rgba(40,40,50,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(fx - 3, fyTop + 4); ctx.lineTo(fx - 6, s.y);
        ctx.moveTo(fx + 3, fyTop + 6); ctx.lineTo(fx + 7, s.y);
        ctx.stroke();

        // Sunlit highlight on left face
        ctx.fillStyle = 'rgba(180,180,200,0.35)';
        ctx.beginPath();
        ctx.moveTo(fx, fyTop);
        ctx.lineTo(fx - fBaseHW, s.y + 4);
        ctx.lineTo(fx - 3, s.y + 4);
        ctx.lineTo(fx, fyTop + 8);
        ctx.closePath(); ctx.fill();

        // Twin sub-peak: a shorter secondary ridge rising from the right slope
        if (twin) {
          const tx = fx + 6, tyTop = fyTop + 7 + (mh & 0x3);
          ctx.fillStyle = '#6a6a78';
          ctx.beginPath();
          ctx.moveTo(tx, tyTop);
          ctx.lineTo(tx - 4, s.y + 4);
          ctx.lineTo(tx + 5, s.y + 4);
          ctx.closePath(); ctx.fill();
          // Its own tiny snow dab
          if (!snowless) {
            ctx.fillStyle = 'rgba(240,245,255,0.9)';
            ctx.beginPath();
            ctx.moveTo(tx, tyTop);
            ctx.lineTo(tx - 2, tyTop + 3);
            ctx.lineTo(tx + 2, tyTop + 3);
            ctx.closePath(); ctx.fill();
          }
        }

        // Snow cap on front peak — asymmetric
        if (!snowless) {
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.moveTo(fx, fyTop);
          ctx.lineTo(fx - 6 + snowTilt, fyTop + 10);
          ctx.lineTo(fx + 5 - snowTilt, fyTop + 9);
          ctx.closePath(); ctx.fill();

          ctx.fillStyle = 'rgba(240,245,255,0.6)';
          ctx.fillRect(fx - 4, fyTop + 8, 1, 3);
          ctx.fillRect(fx + 2, fyTop + 7, 1, 4);
        }
        }
      }
      else if (tile === TILE.SAND) {
        // Sand grain dots for beach texture
        ctx.globalAlpha = daylight * 0.3;
        ctx.fillStyle = '#c8a050';
        const sh = ((x*11+y*7) & 0x1f);
        if (sh < 8) {
          ctx.fillRect(s.x - 5 + sh, s.y + (sh%3) - 1, 1.5, 1);
          ctx.fillRect(s.x + 3 - sh%4, s.y - 2 + sh%3, 1, 1.5);
        }
      }

      // Hover
      if (G.hoveredTile && G.hoveredTile.x===x && G.hoveredTile.y===y) {
        const valid = G.selectedBuild ? canPlaceCheck(G.selectedBuild, x, y) : true;
        const hasBuilding = !G.selectedBuild && G.buildings.some(b => b.x===x && b.y===y);
        ctx.strokeStyle = G.selectedBuild
          ? (valid ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)')
          : (hasBuilding ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)');
        ctx.lineWidth = hasBuilding ? 2.5 : 2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - TH/2);
        ctx.lineTo(s.x + TW/2, s.y);
        ctx.lineTo(s.x, s.y + TH/2);
        ctx.lineTo(s.x - TW/2, s.y);
        ctx.closePath();
        ctx.stroke();
        if (hasBuilding) {
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // ── Fog of war soft edges ─────────────────────────────────
  // Fog gradients are created after translating to each tile. Caching these
  // across transforms can pin the gradient to the first edge tile and make the
  // fog look like a dark sheet, so keep this tiny allocation local and correct.
  function getFogGrad(dir) {
    const hw = TW / 2, hh = TH / 2;
    let g;
    if (dir === 'N')      g = ctx.createLinearGradient(0, -hh, 0, 0);
    else if (dir === 'S') g = ctx.createLinearGradient(0, hh, 0, 0);
    else if (dir === 'W') g = ctx.createLinearGradient(-hw, 0, 0, 0);
    else                  g = ctx.createLinearGradient(hw, 0, 0, 0);
    g.addColorStop(0, 'rgba(14,21,36,0.22)');
    g.addColorStop(1, 'rgba(10,14,26,0)');
    return g;
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (G.fog[y]?.[x]) {
        const fogN = y > 0 && !G.fog[y-1]?.[x];
        const fogS = y < MAP_H-1 && !G.fog[y+1]?.[x];
        const fogW = x > 0 && !G.fog[y][x-1];
        const fogE = x < MAP_W-1 && !G.fog[y][x+1];
        if (fogN || fogS || fogW || fogE) {
          const s = toScreen(x, y);
          const hw = TW / 2, hh = TH / 2;
          // Clip to the diamond shape of this tile
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - hh);
          ctx.lineTo(s.x + hw, s.y);
          ctx.lineTo(s.x, s.y + hh);
          ctx.lineTo(s.x - hw, s.y);
          ctx.closePath();
          ctx.clip();
          // Translate so cached origin-relative gradients map onto this tile
          ctx.translate(s.x, s.y);
          if (fogN) { ctx.fillStyle = getFogGrad('N'); ctx.fillRect(-hw, -hh, TW, hh); }
          if (fogS) { ctx.fillStyle = getFogGrad('S'); ctx.fillRect(-hw, 0, TW, hh); }
          if (fogW) { ctx.fillStyle = getFogGrad('W'); ctx.fillRect(-hw, -hh, hw, TH); }
          if (fogE) { ctx.fillStyle = getFogGrad('E'); ctx.fillRect(0, -hh, hw, TH); }
          ctx.restore();
        }
      }
    }
  }

  markRenderPass(profile, 'terrainFog');

  const inWorldView = (x, y, extraPad = 2) => (
    x >= minX - extraPad
    && x <= maxX + extraPad
    && y >= minY - extraPad
    && y <= maxY + extraPad
  );

  // ── Roads ─────────────────────────────────────────────────
  // Roads are terrain, not buildings. Drawing them before the unified world
  // pass keeps every citizen and animal above the surface regardless of iso
  // depth, while neighbor-aware edges make runs and junctions continuous.
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const road = G.buildingGrid[y]?.[x];
      if (road?.type !== 'road' || !G.fog?.[y]?.[x]) continue;
      drawRoadSurface(ctx, road, toScreen(x, y), daylight);
    }
  }

  // ── Buildings ─────────────────────────────────────────────
  // Drawn in the unified painter's-algorithm pass below, interleaved with
  // citizens by isometric depth so actors behind a building are occluded.

  // ── Selected building highlight ─────────────────────────
  if (G.selectedBuilding) {
    const sb = G.selectedBuilding;
    const ss = toScreen(sb.x, sb.y);
    const pulse = 0.5 + 0.3 * Math.sin(G.gameTick * 0.08);

    // Pulsing gold diamond outline
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y - TH/2 - 2);
    ctx.lineTo(ss.x + TW/2 + 2, ss.y);
    ctx.lineTo(ss.x, ss.y + TH/2 + 2);
    ctx.lineTo(ss.x - TW/2 - 2, ss.y);
    ctx.closePath();
    ctx.stroke();

    // Inner glow
    ctx.globalAlpha = pulse * 0.3;
    ctx.fillStyle = 'rgba(255,209,102,0.15)';
    ctx.fill();
    ctx.globalAlpha = daylight;

    // Coverage radius for service buildings
    const selDef = BUILDINGS[G.selectedBuilding.type];
    if (selDef.radius) {
      const r = selDef.radius;
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = selDef.happiness ? '#ffd166' : '#60a5fa';
      ctx.beginPath();
      ctx.ellipse(ss.x, ss.y, r * TW/2, r * TH/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = selDef.happiness ? '#ffd166' : '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = daylight;
    }
  }

  // ── Citizens ──────────────────────────────────────────────
  // Find hovered citizen (closest to mouse in screen space)
  let hoveredCitizen = null;
  if (G.hoveredTile) {
    let bestDist = 20; // pixel radius threshold
    for (const c of citizenPresentations) {
      if (citizenOnBlockedBuildingTile(c)) continue;
      const cs = toScreen(c.x, c.y);
      // Convert mouse from world-tile to screen using camera transform
      const mx = G.hoveredTile.x, my = G.hoveredTile.y;
      const ms = toScreen(mx, my);
      const dx = cs.x - ms.x, dy = cs.y - ms.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestDist) { bestDist = d; hoveredCitizen = c; }
    }
  }

  // Idle citizens turn toward a nearby neighbor so little clusters read as a
  // conversation. This used to scan every citizen from every draw call
  // (quadratic work at exactly the population sizes where busy towns need
  // frames most). A one-tile spatial hash preserves the 1.4-tile rule while
  // keeping the per-frame lookup local.
  const socialNeighbors = new Map();
  if (citizenPresentations.length > 1) {
    const buckets = new Map();
    const bucketKey = (x, y) => `${Math.floor(x)},${Math.floor(y)}`;
    for (const citizen of citizenPresentations) {
      const key = bucketKey(citizen.x, citizen.y);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(citizen);
      else buckets.set(key, [citizen]);
    }
    for (const citizen of citizenPresentations) {
      const bx = Math.floor(citizen.x), by = Math.floor(citizen.y);
      let nearest = null, bestD2 = 1.4 * 1.4;
      // A 1.4-tile radius can cross two floor buckets near a cell boundary.
      for (let y = by - 2; y <= by + 2; y++) {
        for (let x = bx - 2; x <= bx + 2; x++) {
          for (const other of buckets.get(`${x},${y}`) || []) {
            if (other === citizen) continue;
            const dx = other.x - citizen.x, dy = other.y - citizen.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; nearest = other; }
          }
        }
      }
      if (nearest) socialNeighbors.set(citizen, nearest);
    }
  }

  const drawOneCitizen = (cEntity) => {
  for (const c of [cEntity]) {
    const continuity = actorRenderRecord(c);
    // A citizen inside a fresh footprint ghosts at low alpha while
    // evacuating instead of vanishing and rematerializing.
    const cGhost = citizenOnBlockedBuildingTile(c);
    const lp = lerpEnt(c);
    const s = toScreen(lp.x, lp.y);
    const pathActive = c.presentationKind === 'citizen'
      ? c.pathActive
      : !!(c.path && c.pathIdx < (c.path?.length ?? 0));
    const currentWaypoint = c.presentationKind === 'citizen'
      ? c.pathCurrent
      : (pathActive ? c.path[c.pathIdx] : null);
    const previousWaypoint = c.presentationKind === 'citizen'
      ? c.pathPrevious
      : (pathActive && c.pathIdx > 0 ? c.path[c.pathIdx - 1] : null);
    // Road lane offset (render-only): while walking a road tile, drift to
    // the right-hand side of the direction of travel so two-way traffic
    // reads as lanes instead of head-on overlap. The offset EASES in and
    // out — road joins/leaves, corners, and one-frame path gaps must never
    // pop the sprite sideways. World/collision position is untouched.
    let laneTx = 0, laneTy = 0;
    if (pathActive && G.buildingGrid[Math.round(c.y)]?.[Math.round(c.x)]?.type === 'road') {
      // Lane direction comes from the path SEGMENT so the target is constant
      // across each leg; near-waypoint renormalization would swing it.
      const wp = currentWaypoint;
      const from = previousWaypoint;
      const ldx = from ? wp.x - from.x : wp.x - c.x;
      const ldy = from ? wp.y - from.y : wp.y - c.y;
      const llen = Math.hypot(ldx, ldy);
      if (llen > 0.01) { laneTx = -ldy / llen * 0.16; laneTy = ldx / llen * 0.16; }
    }
    const renderDt = G._renderDeltaMs || (1000 / 60);
    const laneEase = 1 - Math.pow(1 - 0.12, renderDt / (1000 / 60));
    continuity.laneX += (laneTx - continuity.laneX) * laneEase;
    continuity.laneY += (laneTy - continuity.laneY) * laneEase;
    if (Math.abs(continuity.laneX) > 0.002 || Math.abs(continuity.laneY) > 0.002) {
      // Keep the render-only lane offset on the interpolated position. Using
      // the simulation coordinates here cancelled lerpEnt() each time a
      // citizen stepped onto a road, producing a visible 60 Hz shimmy.
      const lane = toScreen(lp.x + continuity.laneX, lp.y + continuity.laneY);
      s.x = lane.x; s.y = lane.y;
    }
    ctx.globalAlpha = cGhost ? 0.35 : Math.max(0.85, daylight);
    // Loop 71 (render S4): damage flash. When c.hurtTimer > 0 (set by
    // combat code when a citizen takes damage), render a brief red tint
    // over the full body region via a radial gradient. Timer ticks down
    // in citizens.js so it fades over ~200ms at 1x speed.
    const hurtAlpha = c.hurtTimer > 0 ? Math.min(0.6, c.hurtTimer / 12 * 0.6) : 0;

    // Walking bob when moving — smooth sine, reduced amplitude.
    // Idle citizens stay anchored so they don't read as walking in place.
    // Loop 4 (render S3): phase derived from name-hash instead of c.x so
    // neighbors don't bob in stadium-wave lockstep. Prior (c.x * N) meant
    // two citizens on adjacent tiles had near-identical phase.
    // Walk-row hysteresis: paths routinely empty for a single frame between
    // arrival and the next repath (measured ~2 one-frame walk->idle->walk
    // row flaps per second per moving citizen). citizens.js stamps _movedAt
    // on every real step; holding the walk row briefly absorbs the gap.
    // A path alone is not evidence of motion: a blocked worker used to loop
    // the walk cycle in place until the watchdog fired. Allow only a short
    // startup window before the first real step.
    const movedAt = c.presentationKind === 'citizen' ? c.movedAt : c._movedAt;
    const pathStartedAt = c.presentationKind === 'citizen' ? c.pathStartedAt : c._pathStartedAt;
    const movedRecently = (G.gameTick - (movedAt ?? -999)) < 14;
    const pathWarming = pathActive && pathStartedAt != null &&
      (G.gameTick - pathStartedAt) < 8;
    const isMoving = movedRecently || pathWarming;
    const phaseHash = c.presentationKind === 'citizen'
      ? (Math.imul(c.actorId, 2654435761) >>> 0) % 360
      : 0;
    const phaseOffset = phaseHash * Math.PI / 180;
    const bob = isMoving
      ? Math.sin(G.gameTick * 0.14 + phaseOffset) * 0.55
      : 0;
    const cy = s.y + bob;

    // Facing direction (x = left/right, z = depth/forward-back in iso).
    // Face along the path SEGMENT (previous waypoint -> current), not the
    // instantaneous offset to the waypoint: near arrival the per-axis offset
    // collapses below the 0.1 gate one axis at a time, flashing a wrong
    // direction for a frame at diagonal waypoints (verified by tick-exact
    // simulation). First segment has no previous waypoint — offset form.
    let faceX = 0, faceZ = 0;
    // Work rows are motion, not an orientation lottery. Lock the facing at
    // the moment the worker reaches the site so nearby idle/social movement
    // and a resource-target repath cannot swap directions mid-swing.
    const activityKind = c.presentationKind === 'citizen' ? c.activity.kind : c.state;
    const workFaceX = c.presentationKind === 'citizen' ? c.workFaceX : c._workFaceX;
    const workFaceZ = c.presentationKind === 'citizen' ? c.workFaceZ : c._workFaceZ;
    if (activityKind === 'working' && (workFaceX || workFaceZ)) {
      faceX = workFaceX;
      faceZ = workFaceZ;
    } else if (pathActive) {
      const wp = currentWaypoint;
      const from = previousWaypoint;
      const fdx = from ? wp.x - from.x : wp.x - c.x;
      const fdy = from ? wp.y - from.y : wp.y - c.y;
      const gate = from ? 0.01 : 0.1;
      faceX = fdx > gate ? 1 : fdx < -gate ? -1 : 0;
      faceZ = fdy > gate ? 1 : fdy < -gate ? -1 : 0;
    } else if (Math.abs(c.tx - c.x) > 0.1) {
      faceX = c.tx > c.x ? 1 : -1;
    }
    if (faceX === 0 && faceZ === 0 && (c.faceX || c.faceZ)) {
      faceX = c.faceX || 0;
      faceZ = c.faceZ || 0;
    }
    // Loop 4 (render S3): social orientation — idle citizens face the
    // nearest neighbor within 1.4 tiles. Makes clusters read as a
    // conversation, not strangers standing back-to-back. Only fires
    // when no movement direction is set.
    if (faceX === 0 && faceZ === 0) {
      const nearest = socialNeighbors.get(c);
      if (nearest) {
        const sdx = nearest.x - c.x, sdy = nearest.y - c.y;
        faceX = sdx > 0.1 ? 1 : sdx < -0.1 ? -1 : 0;
        faceZ = sdy > 0.1 ? 1 : sdy < -0.1 ? -1 : 0;
      }
    }
    // Direction hysteresis: a new facing must persist about 67ms
    // before the drawn row changes. Replans and segment boundaries can pass
    // through an intermediate direction for a frame or two; without the
    // hold that reads as a twitch. Measure time rather than render frames so
    // 144Hz displays do not switch directions more than twice as quickly.
    if (faceX || faceZ) {
      const dirKey = faceX + ',' + faceZ;
      if (continuity.dirKey === null || continuity.dirKey === dirKey) {
        continuity.dirKey = dirKey; continuity.dirPending = null; continuity.dirPendingMs = 0;
      } else if (continuity.dirPending === dirKey) {
        continuity.dirPendingMs += renderDt;
        if (continuity.dirPendingMs >= 67) { continuity.dirKey = dirKey; continuity.dirPending = null; continuity.dirPendingMs = 0; }
      } else {
        continuity.dirPending = dirKey; continuity.dirPendingMs = renderDt;
      }
      const held = continuity.dirKey.split(',');
      faceX = +held[0]; faceZ = +held[1];
    }
    // In iso: screen Y = (worldX + worldY)*TH/2, so moving away from camera
    // (up on screen) = faceX + faceZ < 0. Prior "faceX>0 && faceZ<0" only caught
    // one diagonal; this catches all rearward-facing directions.
    const facingAway = faceX + faceZ < 0;

    const faceScreenX = faceX - faceZ; // screen-X component of movement direction
    const faceScreenY = (faceX + faceZ) * 0.5; // screen-depth component; positive walks down/toward camera

    // Job color — vibrant saturated palette so citizens stand out
    const bodyColor = '#8899bb';

    // Loop 43 (render S4): killed the job-colored ground ring. Fresh-eyes
    // critique: "colored rings read as UI selection indicators stacked on
    // every unit — visually noisy and removes weight." Now just a proper
    // soft elliptical drop-shadow with feathered edge via stacked alphas.
    // Reserve any colored ring for SELECTED citizen only (handled later).
    const actorShadowScale = 0.84;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 7.5 * actorShadowScale, 3.2 * actorShadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 5.5 * actorShadowScale, 2.3 * actorShadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 3.2 * actorShadowScale, 1.4 * actorShadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (G.camera.zoom < 0.5) {
      // Tiny dot for very far zoom
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 4, 2, 0, Math.PI*2);
      ctx.fill();
      // Still draw selected/hover rings
      if (c === hoveredCitizen) {
        ctx.strokeStyle = 'rgba(255,209,102,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 4, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (c.presentationKind === 'citizen' && c.selected) {
        const pulse = 0.5 + 0.4 * Math.sin(G.gameTick * 0.1);
        ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 4, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      continue;
    }

    if (drawCitizenSpriteIfReady(ctx, c, s, cy, faceScreenX, faceScreenY, facingAway, isMoving, phaseOffset)) {
      if (G.camera.zoom >= 0.7) {
        const previewRole = actorVariantForCitizen(c);
        const previewAction = actorActionForCitizen(c, isMoving);
        if (!actorOwnsBakedCargo(previewRole, previewAction)) {
          drawCarryLoad(ctx, c, s, cy, faceScreenX, daylight);
        }
      }

      if (hurtAlpha > 0) {
        const hurtGrad = ctx.createRadialGradient(s.x, cy - 12, 2, s.x, cy - 12, 14);
        hurtGrad.addColorStop(0, `rgba(255, 60, 60, ${hurtAlpha})`);
        hurtGrad.addColorStop(1, 'rgba(255, 60, 60, 0)');
        ctx.fillStyle = hurtGrad;
        ctx.beginPath();
        ctx.arc(s.x, cy - 12, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      if (c.hp !== undefined && c.hp < 40 && c.hp > 0 && G.camera.zoom >= 0.8) {
        const droplet = 0.5 + 0.5 * Math.sin(G.gameTick * 0.1 + phaseOffset);
        ctx.globalAlpha = Math.max(0.85, daylight) * (0.6 + 0.4 * droplet);
        ctx.fillStyle = '#c8201c';
        ctx.beginPath();
        ctx.moveTo(s.x, cy - 31);
        ctx.bezierCurveTo(s.x - 1.5, cy - 29, s.x - 1.5, cy - 26, s.x, cy - 25);
        ctx.bezierCurveTo(s.x + 1.5, cy - 26, s.x + 1.5, cy - 29, s.x, cy - 31);
        ctx.fill();
        ctx.globalAlpha = Math.max(0.85, daylight);
      }

      if (c === hoveredCitizen) {
        ctx.strokeStyle = 'rgba(255,209,102,0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2, 7, 3.0, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (c.presentationKind === 'citizen' && c.selected) {
        const pulse = 0.55 + 0.35 * Math.sin(G.gameTick * 0.1);
        ctx.strokeStyle = `rgba(120,210,255,${pulse})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2, 8, 3.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(120,210,255,${pulse * 0.75})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(s.x, cy - 31, 4.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      continue;
    }

    // Actor atlas only: if the sprite sheet is still decoding, keep the
    // ground shadow but do not flash into the old hand-drawn canvas citizen.
    continue;

  }
  };

  const animalRenderSize = {
    deer:    { w: 32, h: 32, shadowW: 6.2, shadowH: 2.0 },
    cow:     { w: 34, h: 32, shadowW: 7.5, shadowH: 2.3 },
    chicken: { w: 21, h: 26, shadowW: 3.2, shadowH: 1.2 },
  };
  function drawOneAnimal(a, interpolated = lerpEnt(a)) {
    if (G.camera.zoom < 0.6) return;
    const style = animalRenderSize[a.type];
    if (!style) return;
    if (interpolated.x < minX - 2 || interpolated.x > maxX + 2 ||
        interpolated.y < minY - 2 || interpolated.y > maxY + 2) return;
    const mapX = Math.round(interpolated.x), mapY = Math.round(interpolated.y);
    if (G.fog?.[mapY]?.[mapX] === false) return;

    const s = toScreen(interpolated.x, interpolated.y);
    const walking = a.state === 'walk' && (G.gameTick - (a._movedAt ?? -999)) < 3;
    // Move the whole painted animal together. The retired procedural version
    // bobbed the torso while its legs stayed planted, which read as broken
    // frame registration rather than a gait.
    const bob = walking ? Math.sin(G.gameTick * 0.18 + (a.phase || 0)) * 0.38 : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0.82, daylight);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2.4, style.shadowW, style.shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    drawAmbientSprite(
      ctx,
      a.type,
      s.x,
      s.y + 3 + bob,
      style.w,
      style.h,
      1,
      (a.facing || 1) < 0,
    );
    ctx.restore();
  }

  // ── Unified world pass: buildings + citizens by iso depth ──
  // Painter's algorithm over x+y; ties draw the building first so actors and
  // animals at a doorway render in front instead of floating over roofs.
  let worldDrawCount = 0;
  const enqueueWorld = (kind, entity, x = entity.x, y = entity.y, order = 1) => {
    let item = worldDrawQueue[worldDrawCount];
    if (!item) {
      item = {};
      worldDrawQueue[worldDrawCount] = item;
    }
    item.kind = kind;
    item.entity = entity;
    item.x = x;
    item.y = y;
    item.depth = x + y;
    item.order = order;
    worldDrawCount++;
  };

  for (const b of G.buildings) {
    if (b.type === 'road') continue;
    if (inWorldView(b.x, b.y, 4)) enqueueWorld(WORLD_DRAW_KIND.building, b, b.x, b.y, 0);
  }
  for (const c of citizenPresentations) {
    if (c.indoors) continue;
    if (inWorldView(c.x, c.y)) enqueueWorld(WORLD_DRAW_KIND.citizen, c);
  }
  for (const a of G.animals || []) {
    const ap = lerpEnt(a);
    if (inWorldView(ap.x, ap.y)) enqueueWorld(WORLD_DRAW_KIND.animal, a, ap.x, ap.y);
  }
  if (G.avatar && inWorldView(G.avatar.x, G.avatar.y)) {
    // The founder rides the citizen sprite path (avatar is citizen-shaped)
    // plus a golden pennant + name so the player can always find themself.
    enqueueWorld(WORLD_DRAW_KIND.avatar, G.avatar);
  }
  // Walkers, soldiers, caravans, and raiders share the same depth pass so no
  // entity ever floats above a building it stands behind. Their draw
  // functions are hoisted declarations defined in their original sections.
  for (const w of G.walkers) {
    if (inWorldView(w.x, w.y)) enqueueWorld(WORLD_DRAW_KIND.walker, w);
  }
  for (const sld of G.soldiers) {
    if (inWorldView(sld.x, sld.y)) enqueueWorld(WORLD_DRAW_KIND.soldier, sld);
  }
  for (const cv of G.caravans) {
    if (inWorldView(cv.x, cv.y)) enqueueWorld(WORLD_DRAW_KIND.caravan, cv);
  }
  for (const en of G.enemies) {
    if (inWorldView(en.x, en.y)) enqueueWorld(WORLD_DRAW_KIND.enemy, en);
  }
  worldDrawQueue.length = worldDrawCount;
  worldDrawQueue.sort((a, b) => a.depth - b.depth || a.order - b.order);
  for (const item of worldDrawQueue) {
    switch (item.kind) {
      case WORLD_DRAW_KIND.building:
        drawBuilding(ctx, item.entity, toScreen(item.x, item.y), daylight);
        break;
      case WORLD_DRAW_KIND.citizen:
        drawOneCitizen(item.entity);
        break;
      case WORLD_DRAW_KIND.animal:
        drawOneAnimal(item.entity, item);
        break;
      case WORLD_DRAW_KIND.avatar:
        drawOneCitizen(item.entity);
        drawFounderMarker(item.entity);
        break;
      case WORLD_DRAW_KIND.walker:
        drawOneWalker(item.entity);
        break;
      case WORLD_DRAW_KIND.soldier:
        drawOneSoldier(item.entity);
        break;
      case WORLD_DRAW_KIND.caravan:
        drawOneCaravan(item.entity);
        break;
      case WORLD_DRAW_KIND.enemy:
        drawOneEnemy(item.entity);
        break;
      default:
        break;
    }
  }

  // ── Founder marker (Phase 3d) ─────────────────────────────
  function drawFounderMarker(a) {
    const alp = lerpEnt(a);
    const s = toScreen(alp.x, alp.y);
    const bob = Math.sin(G.gameTick * 0.08) * 1.5;
    const topY = s.y - 34 + bob;
    // Pennant pole + golden flag
    ctx.save();
    ctx.strokeStyle = 'rgba(70,50,20,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x, topY + 10);
    ctx.lineTo(s.x, topY);
    ctx.stroke();
    const wave = Math.sin(G.gameTick * 0.12) * 1.6;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(s.x, topY);
    ctx.lineTo(s.x + 9 + wave, topY + 2.5);
    ctx.lineTo(s.x, topY + 5);
    ctx.closePath();
    ctx.fill();
    // Name plate when zoomed in enough to read it
    if (G.camera.zoom >= 1.0) {
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const label = a.name || 'The Founder';
      const w = ctx.measureText(label).width + 8;
      ctx.fillRect(s.x - w / 2, topY - 11, w, 10);
      ctx.fillStyle = '#ffe08a';
      ctx.fillText(label, s.x, topY - 3);
    }
    ctx.restore();
  }

  // ── Service walkers (drawn via the unified depth pass) ────
  function drawOneWalker(wEntity) {
  for (const w of [wEntity]) {
    const wlp = lerpEnt(w);
    const ws = toScreen(wlp.x, wlp.y);
    ctx.globalAlpha = Math.max(0.85, daylight);
    // Service walkers use the same painted actor atlas as citizens. Atlas
    // decode has no procedural fallback, so a reload cannot flash a second,
    // incompatible character style into the settlement.
    // Stacked shadow
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.ellipse(ws.x, ws.y + 2, 5.5, 2.4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(ws.x, ws.y + 2, 3.5, 1.6, 0, 0, Math.PI*2); ctx.fill();
    const walkerRole = { church: 'scholar', tavern: 'innkeeper', well: 'settler', market: 'trader', wonder: 'builder' }[w.home?.type] || 'settler';
    const wdx = (w.tx ?? w.x) - w.x, wdy = (w.ty ?? w.y) - w.y;
    const wd = Math.hypot(wdx, wdy);
    const wMoving = wd > 0.15;
    const nfx = wd > 0.001 ? wdx / wd : 0, nfy = wd > 0.001 ? wdy / wd : 0.6;
    const wFaceX = nfx - nfy;
    const wFaceY = (nfx + nfy) * 0.5;
    const wDir = actorDirection(wFaceX, wFaceY, wFaceY < -0.02);
    const wAction = wMoving ? (w.hauler ? 'carry' : 'walk') : 'idle';
    const wPhase = (((w.home?.x || 0) % ACTOR_FRAMES) / ACTOR_FRAMES) * Math.PI * 2;
    const wFrame = actorAnimationFrame(w, walkerRole, wAction, { isMoving: wMoving, phaseOffset: wPhase });
    drawActorAtlasFrame(ctx, {
      role: walkerRole, action: wAction, dir: wDir, frame: wFrame,
      x: ws.x - 13.5, y: ws.y + 3 - 35, width: 27, height: 35,
    });
    // Small emoji badge above the head (service indicator)
    if (G.camera.zoom >= 1.2) {
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(w.emoji, ws.x, ws.y - 34);
    }
  }
  }

  // ── Selected citizen path visualization ──────────────────
  if (selectedCitizen?.pathRemaining.length) {
    const c = selectedCitizen;
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = 'rgba(100,200,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const clp0 = lerpEnt(c);
    const start = toScreen(clp0.x, clp0.y);
    ctx.moveTo(start.x, start.y);
    for (const wp of c.pathRemaining) {
      const ws = toScreen(wp.x, wp.y);
      ctx.lineTo(ws.x, ws.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Destination marker
    if (c.pathRemaining.length > 0) {
      const dest = c.pathRemaining.at(-1);
      const ds = toScreen(dest.x, dest.y);
      ctx.fillStyle = 'rgba(100,200,255,0.5)';
      ctx.beginPath();
      ctx.arc(ds.x, ds.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = daylight;
  }

  // ── Soldiers (drawn via the unified depth pass) ───────────
  function drawOneSoldier(sEntity) {
  for (const s of [sEntity]) {
    const slp = lerpEnt(s);
    const ss = toScreen(slp.x, slp.y);
    // Garrisoned soldier: drawn small on the tower parapet, no shadow —
    // same depth slot as the tower tile so layering stays correct.
    if (s.garrison) {
      ctx.globalAlpha = Math.max(0.85, daylight);
      const garrisonFrame = actorAnimationFrame(s, 'guard', 'idle');
      drawActorAtlasFrame(ctx, {
        role: 'guard', action: 'idle', dir: 'down', frame: garrisonFrame,
        x: ss.x - 9, y: ss.y - 38 - 24, width: 18, height: 24,
      });
      continue;
    }
    // Loop 61 (render S4): soldier silhouette rebuild — proper legs, drop
    // shadow, and body-with-shoulders. Prior shape was the pre-L41 body
    // pill — no legs, toy-looking. Now matches the citizen/raider chibi
    // vocabulary with an ALLIED accent: blue plume (not red like raiders),
    // steel helm, longer arms, chainmail torso.
    ctx.globalAlpha = Math.max(0.85, daylight);
    if (G.camera.zoom < 0.6) {
      ctx.fillStyle = '#5a6a7a';
      ctx.beginPath();
      ctx.arc(ss.x, ss.y - 4, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a7acc';
      ctx.fillRect(ss.x - 1, ss.y - 7, 2, 2);
      continue;
    }
    // Stacked drop shadow (matches citizens)
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.ellipse(ss.x, ss.y + 2, 7.5, 3.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(ss.x, ss.y + 2, 5.5, 2.3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(ss.x, ss.y + 2, 3.2, 1.4, 0, 0, Math.PI*2); ctx.fill();

    // Painted-atlas soldiers: barracks units wear the guard sprites. Attack
    // stance (enemy within reach) uses the guard's spear-thrust work rows and
    // faces the enemy; otherwise walk/idle follows patrol movement.
    const smx = s.x - (s._pdx ?? s.x), smy = s.y - (s._pdy ?? s.y);
    s._pdx = s.x; s._pdy = s.y;
    // Movement memory (same fix as citizens): a single frame's position
    // delta strobed walk/idle rows between steps and collapsed facing to a
    // default whenever the soldier paused. Remember the last real movement
    // and hold the walk row briefly past it.
    if (Math.hypot(smx, smy) > 0.004) {
      s._movedAt = G.gameTick;
      s._mvx = smx; s._mvy = smy;
    }
    let sFx = s._mvx ?? smx, sFy = s._mvy ?? smy;
    let sAction = (G.gameTick - (s._movedAt ?? -999)) < 14 ? 'walk' : 'idle';
    let sNearE = null, sNearD = Infinity;
    for (const e of G.enemies) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < sNearD) { sNearD = d; sNearE = e; }
    }
    // Honest poses: thrust only when actually striking (melee reach) or an
    // archer just loosed a shot — no more stabbing at air from 6 tiles.
    if (sNearE && sNearD <= 1.5) { sAction = 'work'; sFx = sNearE.x - s.x; sFy = sNearE.y - s.y; }
    // Braced spear-wall: rallied soldiers holding the flag while an enemy is
    // on the map (but not yet in reach) lock into the first thrust frame.
    let sBraced = false;
    if (G.armyStance === 'rally' && G.rallyPoint && sNearE && sNearD >= 6 &&
        Math.hypot(s.x - G.rallyPoint.x, s.y - G.rallyPoint.y) <= 2) {
      sAction = 'work'; sBraced = true;
      sFx = sNearE.x - s.x; sFy = sNearE.y - s.y;
    }
    const sLen = Math.hypot(sFx, sFy) || 1;
    const sFaceX = (sFx / sLen) - (sFy / sLen);
    const sFaceY = ((sFx / sLen) + (sFy / sLen)) * 0.5;
    const sDir = actorDirection(sFaceX, sFaceY, sFaceY < -0.02);
    const sFrame = actorAnimationFrame(s, 'guard', sAction, {
      isMoving: sAction === 'walk',
      hold: sBraced,
    });
    drawActorAtlasFrame(ctx, {
      role: 'guard', action: sAction, dir: sDir, frame: sFrame,
      x: ss.x - 13.5, y: ss.y + 3 - 35, width: 27, height: 35,
    });
    if (s.hp < s.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ss.x - 5, ss.y - 22, 10, 2);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(ss.x - 5, ss.y - 22, 10 * (s.hp / s.maxHp), 2);
    }
  }
  }

  // ── Rally point flag ──────────────────────────────────────
  if (G.rallyPoint) {
    const rs = toScreen(G.rallyPoint.x, G.rallyPoint.y);
    // Dim the flag when the army is not rallying to it
    ctx.globalAlpha = G.armyStance === 'rally' ? 0.9 : 0.45;
    // Flag pole
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rs.x, rs.y);
    ctx.lineTo(rs.x, rs.y - 14);
    ctx.stroke();
    // Flag
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(rs.x, rs.y - 14);
    ctx.lineTo(rs.x + 8, rs.y - 11);
    ctx.lineTo(rs.x, rs.y - 8);
    ctx.closePath();
    ctx.fill();
  }

  // ── Citizen hover tooltip ──────────────────────────────────
  if (hoveredCitizen) {
    // Loop 39 (render S3): tooltip now also shows hunger status with a
    // small bar, and includes carrying-cargo info if applicable.
    const hs = toScreen(hoveredCitizen.x, hoveredCitizen.y);
    const name = hoveredCitizen.identity.name;
    const stateLabel = {
      idle:'Idle', find_job:'Looking for work', walk_to_work:'Going to work',
      working:'Working', walk_to_deliver:'Delivering', deliver:'Delivering',
      needs_delivery:'Needs storage', foraging:'Foraging', eating:'Eating',
      walk_to_eat:'Walking to food', waiting_for_food:'Waiting for food',
      go_home:'Going home', sleep:'Sleeping', leisure:'At leisure',
      seek_shelter:'Running home', sheltered:'Sheltered at home', flee:'Fleeing the raid',
    }[hoveredCitizen.activity.kind] || hoveredCitizen.activity.kind;
    const assignment = hoveredCitizen.assignment;
    const jobLabel = assignment ? BUILDINGS[assignment.building.type]?.name : null;
    const vocation = hoveredCitizen.profession.kind;
    const line2 = jobLabel
      ? `${vocation} · ${assignment.purpose === 'temporary' ? 'helping at' : 'assigned to'} ${jobLabel} · ${stateLabel}`
      : `${vocation} · ${stateLabel}`;
    // Line 3: carrying info or hunger warning
    let line3 = '';
    if (hoveredCitizen.carrying && hoveredCitizen.carryAmount > 0) {
      const emoji = {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️'}[hoveredCitizen.carrying] || '•';
      line3 = `Carrying: ${hoveredCitizen.carryAmount} ${emoji}`;
    } else if (hoveredCitizen.hunger > 70) {
      line3 = `⚠️ Hungry (${Math.round(hoveredCitizen.hunger)})`;
    }

    ctx.globalAlpha = 0.92;
    ctx.font = 'bold 10px -apple-system,sans-serif';
    const widths = [ctx.measureText(name).width, ctx.measureText(line2).width];
    if (line3) widths.push(ctx.measureText(line3).width);
    const tw = Math.max(...widths) + 14;
    const th = line3 ? 42 : 32;
    const tx = hs.x - tw/2, ty = hs.y - (th + 16);
    // Background
    ctx.fillStyle = 'rgba(10,14,26,0.88)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Name
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(name, hs.x, ty + 12);
    // State
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '9px -apple-system,sans-serif';
    ctx.fillText(line2, hs.x, ty + 24);
    // Line 3 (carrying or hunger warning)
    if (line3) {
      ctx.fillStyle = line3.startsWith('⚠') ? 'rgba(251,191,36,0.9)' : 'rgba(134,239,172,0.85)';
      ctx.fillText(line3, hs.x, ty + 36);
    }
    // Hunger bar at the bottom — quick glance indicator
    const hungerPct = Math.min(1, Math.max(0, hoveredCitizen.hunger / 100));
    const barY = ty + th - 3;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(tx + 4, barY, tw - 8, 1.5);
    ctx.fillStyle = hungerPct > 0.7 ? '#f87171' : hungerPct > 0.4 ? '#fbbf24' : '#4ade80';
    ctx.fillRect(tx + 4, barY, (tw - 8) * (1 - hungerPct), 1.5);
    ctx.globalAlpha = 1;
  }

  // ── Caravans (drawn via the unified depth pass) ───────────
  function drawOneCaravan(cvEntity) {
  for (const c of [cvEntity]) {
    const clp = lerpEnt(c);
    const s = toScreen(clp.x, clp.y);
    ctx.globalAlpha = daylight;
    const bob = Math.sin(G.gameTick * 0.2 + c.x * 2) * 1;

    // Cart shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + bob + 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cart body
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(s.x - 6, s.y + bob - 5, 12, 6);
    // Wheels
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.arc(s.x - 4, s.y + bob + 2, 2, 0, Math.PI * 2);
    ctx.arc(s.x + 4, s.y + bob + 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Gold cargo (when returning)
    if (c.phase === 'returning') {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(s.x - 3, s.y + bob - 8, 6, 3);
      ctx.fillStyle = '#e8b830';
      ctx.fillRect(s.x - 2, s.y + bob - 7, 4, 1);
    }

    // Driver
    ctx.fillStyle = '#d4a030';
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob - 10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob - 14, 2, 0, Math.PI * 2);
    ctx.fill();

  }
  }

  // ── Enemies (drawn via the unified depth pass) ────────────
  function drawOneEnemy(eEntity) {
  for (const e of [eEntity]) {
    const elp = lerpEnt(e);
    const es = toScreen(elp.x, elp.y);
    ctx.globalAlpha = daylight;
    // Threat ring (quality pass): raiders read as hostile at any light
    // level — a low ember glow underfoot, subtle by day, clear at night.
    ctx.save();
    ctx.globalAlpha = 0.38;
    const emberPulse = 0.8 + Math.sin(G.gameTick * 0.15 + (e.variant ?? 0) * 2.1) * 0.2;
    const eg = ctx.createRadialGradient(es.x, es.y + 2, 1, es.x, es.y + 2, 11 * emberPulse);
    eg.addColorStop(0, 'rgba(255,70,40,0.85)');
    eg.addColorStop(1, 'rgba(255,70,40,0)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(es.x, es.y + 2, 11 * emberPulse, 5.5 * emberPulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Painted production family: 0=ash reaver, 1=iron lancer,
    // 2=bone breaker. The saved integer remains presentation-only.
    const eVariant = Math.max(0, Math.min(ENEMY_VARIANTS.length - 1, e.variant ?? 0));
    // Danger ground ring — red-tinted so raiders read as threat, not citizens
    // (pulses brighter for a few frames after the raider lands a blow)
    ctx.fillStyle = e.attackCue > 0 ? 'rgba(255,40,40,0.5)' : 'rgba(200,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(es.x, es.y + 1, 8, 3.5, 0, 0, Math.PI*2);
    ctx.fill();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(es.x, es.y + 2, 5, 2, 0, 0, Math.PI*2);
    ctx.fill();
    const action = enemyActionForRender(e);
    const direction = enemyDirectionForRender(e);
    const frame = enemyAnimationFrame(e, action);
    const targetW = 27;
    const targetH = 35;
    drawEnemyAtlasFrame(ctx, {
      variant: eVariant,
      action,
      direction,
      frame,
      x: es.x - targetW / 2,
      y: es.y + 3 - targetH,
      width: targetW,
      height: targetH,
      alpha: Math.max(0.85, daylight),
    });
    // HP bar
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(es.x - 7, es.y - 36, 14, 2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(es.x - 7, es.y - 36, 14 * (e.hp/e.maxHp), 2);
    }
  }
  }

  // ── Projectiles (arrows) ───────────────────────────────────
  // Loop 66 (render S4): arrows now have proper length, motion streak,
  // and white fletching at the tail. Prior was an 8px line with a
  // triangular head — read as a dash, no motion feel.
  for (const p of G.projectiles) {
    const ps = toScreen(p.x, p.y);
    const target = toScreen(p.tx, p.ty);
    ctx.globalAlpha = Math.max(0.85, daylight);
    const dxp = target.x - ps.x;
    const dyp = target.y - ps.y;
    const distance = Math.hypot(dxp, dyp) || 1;
    const ca = dxp / distance;
    const sa = dyp / distance;
    // Motion trail — fading line behind the arrowhead (6px fade)
    const grad = ctx.createLinearGradient(
      ps.x - ca * 9, ps.y - sa * 9,
      ps.x + ca * 5, ps.y + sa * 5
    );
    grad.addColorStop(0, 'rgba(255,240,200,0)');
    grad.addColorStop(0.6, 'rgba(255,240,200,0.35)');
    grad.addColorStop(1, 'rgba(255,240,200,0.75)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(ps.x - ca * 9, ps.y - sa * 9);
    ctx.lineTo(ps.x + ca * 5, ps.y + sa * 5);
    ctx.stroke();
    // Shaft — solid brown
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(ps.x - ca * 4, ps.y - sa * 4);
    ctx.lineTo(ps.x + ca * 5, ps.y + sa * 5);
    ctx.stroke();
    // Arrowhead — steel triangle at leading tip
    ctx.fillStyle = '#c8c8d0';
    const tipX = ps.x + ca * 5.5, tipY = ps.y + sa * 5.5;
    ctx.beginPath();
    ctx.moveTo(tipX + ca * 2.5, tipY + sa * 1.5);
    ctx.lineTo(tipX - sa * 1.3, tipY + ca * 1.3);
    ctx.lineTo(tipX + sa * 1.3, tipY - ca * 1.3);
    ctx.closePath();
    ctx.fill();
    // Fletching — V-shaped white feathers at the tail
    const tailX = ps.x - ca * 4, tailY = ps.y - sa * 4;
    ctx.fillStyle = 'rgba(240,240,230,0.85)';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX - ca * 2 - sa * 1.3, tailY - sa * 2 + ca * 1.3);
    ctx.lineTo(tailX - ca * 1.3, tailY - sa * 1.3);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX - ca * 2 + sa * 1.3, tailY - sa * 1 - ca * 1.3);
    ctx.lineTo(tailX - ca * 1.3, tailY - sa * 0.8);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Boats (loop 4+) ─────────────────────────────────────
  renderBoats(ctx);
  // ── Puddles (loop 17+) ──────────────────────────────────
  renderPuddles(ctx);
  // ── Footprints in snow (loop 19+) ───────────────────────
  renderFootprints(ctx);
  // ── Snowmen (loop 21+) ──────────────────────────────────
  renderSnowmen(ctx);
  // ── Cherry blossoms in spring (loop 22+) ────────────────
  renderBlossoms(ctx);
  // ── Loop 23+: aggregator dispatch (world space) ─────────
  enhRenderWorld(ctx);
  // ── Wolves (loop 9+) ─────────────────────────────────────
  renderWolves(ctx);
  // ── Glowing mushrooms (loop 10+) ────────────────────────
  renderGlowMushrooms(ctx);
  // ── Festival lanterns (loop 12+) ────────────────────────
  renderLanterns(ctx);
  // ── Town bonfire (loop 18+) ─────────────────────────────
  renderBonfire(ctx);
  // ── Merchant carts (loop 13+) ───────────────────────────
  renderCarts(ctx);

  markRenderPass(profile, 'entitiesWorld');

  // ── Particles ─────────────────────────────────────────────
  for (const p of G.particles) {
    const s = toScreen(p.tx, p.ty);
    // Skip particles whose screen-space position is outside the viewport
    // (toScreen returns world-space coords; add camera offset to get viewport coords)
    // Loop 274 (the-fixer, 273 [code]): include p.offsetX in the cull check.
    // Particles like 267 shootingstar + 273 lightning use offsetX to position
    // their visible rendered point off the base tile; without offsetX in the
    // psx calculation, large-offsetX particles could be culled even when
    // visible (or render off-screen even though cull thinks they're inside).
    const psx = (s.x + (p.offsetX || 0) - G.camera.x) * G.camera.zoom + logicalW / 2;
    const psy = (s.y + (p.offsetY || 0) - G.camera.y) * G.camera.zoom + logicalH / 2;
    if (psx < -50 || psx > logicalW + 50 || psy < -50 || psy > logicalH + 50) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

    if (p.type === 'smoke') {
      // Loop 68 (render S4): smoke puffs now have an inner core + outer soft
      // halo for a more volumetric look. Prior was a flat disc.
      const sz = p.size || 2;
      const ay = s.y + p.offsetY - 20;
      ctx.fillStyle = `rgba(200,200,210,${ctx.globalAlpha * 0.25})`;
      ctx.beginPath();
      ctx.arc(s.x, ay, sz * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(180,180,200,${ctx.globalAlpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x, ay, sz * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(150,150,170,${ctx.globalAlpha * 0.65})`;
      ctx.beginPath();
      ctx.arc(s.x, ay, sz * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'speech') {
      ctx.font = 'bold 8px -apple-system,sans-serif';
      const tw = ctx.measureText(p.text).width + 8;
      const px = s.x, py = s.y + p.offsetY;
      // Bubble background
      ctx.fillStyle = `rgba(255,255,255,${ctx.globalAlpha * 0.92})`;
      ctx.beginPath();
      ctx.roundRect(px - tw/2, py - 7, tw, 14, 3);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(px - 3, py + 7);
      ctx.lineTo(px, py + 11);
      ctx.lineTo(px + 3, py + 7);
      ctx.closePath();
      ctx.fill();
      // Text
      ctx.fillStyle = `rgba(50,50,70,${ctx.globalAlpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, px, py + 3);
    } else if (p.type === 'dust') {
      const sz = p.size || 2;
      ctx.fillStyle = `rgba(180,160,120,${ctx.globalAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(s.x + (p.vx||0) * G.gameTick * 0.3, s.y + p.offsetY, sz, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'snow') {
      const sz = p.size || 1.5;
      const drift = Math.sin(G.gameTick * 0.015 + p.tx * 2) * 3;
      ctx.fillStyle = `rgba(230,240,255,${ctx.globalAlpha})`;
      ctx.beginPath();
      ctx.arc(s.x + drift, s.y + p.offsetY, sz, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'petal') {
      ctx.fillStyle = p.color || '#ffb0c8';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + p.offsetY, p.size, p.size * 0.6, G.gameTick * 0.02, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'leaf') {
      ctx.save();
      ctx.translate(s.x, s.y + p.offsetY);
      ctx.rotate(p.rotation || 0);
      ctx.fillStyle = p.color || '#c85020';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Leaf vein
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
      ctx.restore();
    } else if (p.type === 'spark') {
      // Loop 69 (render S4): sparks now have a bright core + soft halo
      // and fade with alpha. Prior was a flat solid dot — read as a dot,
      // not a hot glowing ember.
      const sz = p.size || 1.5;
      const drift = (p.vx || 0) * (G.gameTick % 60) * 0.08;
      const baseColor = p.color || '#ff8c00';
      const sx = s.x + drift;
      const sy = s.y + p.offsetY;
      // Outer halo (additive-look via rgba)
      ctx.fillStyle = baseColor + (ctx.globalAlpha < 1 ? '' : '');
      ctx.globalAlpha *= 0.28;
      ctx.beginPath(); ctx.arc(sx, sy, sz * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha /= 0.28;
      // Mid glow
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(sx, sy, sz * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha /= 0.6;
      // Hot bright core (nearly white)
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath(); ctx.arc(sx, sy, sz * 0.55, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'pollen') {
      ctx.fillStyle = `rgba(235, 220, 150, ${ctx.globalAlpha * 0.58})`;
      ctx.beginPath();
      ctx.ellipse(
        s.x + Math.sin(G.gameTick * 0.02 + p.tx) * 3,
        s.y + p.offsetY,
        p.size * 0.85,
        p.size * 0.55,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (p.type === 'firefly') {
      const pulse = 0.5 + 0.5 * Math.sin(G.gameTick * 0.15 + p.phase);
      const alpha = p.alpha * pulse;
      // Outer glow
      const glow = ctx.createRadialGradient(s.x, s.y + p.offsetY, 0, s.x, s.y + p.offsetY, p.size * 5);
      glow.addColorStop(0, `rgba(200, 255, 150, ${alpha})`);
      glow.addColorStop(1, 'rgba(200, 255, 150, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y + p.offsetY, p.size * 5, 0, Math.PI * 2);
      ctx.fill();
      // Core dot
      ctx.fillStyle = `rgba(220, 255, 180, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y + p.offsetY, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'resource-glint') {
      const colors = {
        wood: '#c68a52',
        stone: '#b7bcc2',
        food: '#d8774f',
        gold: '#ffd166',
        iron: '#9fc3da',
      };
      const base = colors[p.resource] || '#d7c28a';
      const pulse = 0.55 + 0.45 * Math.sin(G.gameTick * 0.22 + (p.tx + p.ty) * 3);
      const gx = s.x;
      const gy = s.y + p.offsetY + 1;
      const size = p.size || 1.2;
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * (0.45 + pulse * 0.35);
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, size * 7);
      glow.addColorStop(0, base);
      glow.addColorStop(0.35, `${base}aa`);
      glow.addColorStop(1, `${base}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(gx, gy, size * 6, size * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.75;
      ctx.strokeStyle = '#fff4c7';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(gx - size * 2.4, gy);
      ctx.lineTo(gx + size * 2.4, gy);
      ctx.moveTo(gx, gy - size * 1.4);
      ctx.lineTo(gx, gy + size * 1.1);
      ctx.stroke();
      ctx.restore();
    } else if (p.type === 'dustmote') {
      const twinkle = 0.5 + 0.5 * Math.sin(G.gameTick * 0.1 + p.phase);
      ctx.fillStyle = `rgba(255, 250, 200, ${ctx.globalAlpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y + p.offsetY, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'lightning') {
      // Loop 273 (the-fixer, 272 follow-on): visual sync with storm_passed_
      // _seen beat. DISTANT lightning flash — a soft diffuse glow at the
      // far east edge of viewable sky area when the chronicle entry writes.
      // Intentionally faint to match the prose's "long way off" register.
      // Two-phase brightness: initial flash (alpha 0.65→0.4), then dim
      // secondary flicker (alpha 0.2-0.4 with a 0.5x reduction) — mirrors
      // real distant lightning's primary-then-secondary flash.
      const baseX = s.x + (p.offsetX || 0);
      const baseY = s.y + p.offsetY;
      const flicker = (p.alpha < 0.4 && p.alpha > 0.2) ? 0.5 : 1.0;
      // Big soft halo — warm white-blue (so it contrasts against the
      // night-tinted blue sky). Lightning IS bright; real distant flashes
      // illuminate clouds in pale-yellow-white, not pale-blue (which the
      // sky already is).
      ctx.globalAlpha = p.alpha * flicker;
      const halo = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, 70);
      halo.addColorStop(0, 'rgba(255, 250, 220, 1.0)');
      halo.addColorStop(0.4, 'rgba(255, 240, 180, 0.5)');
      halo.addColorStop(1, 'rgba(200, 180, 120, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(baseX, baseY, 70, 0, Math.PI * 2);
      ctx.fill();
      // Small bright core (the actual visible lightning silhouette)
      ctx.globalAlpha = p.alpha * flicker;
      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.beginPath();
      ctx.arc(baseX, baseY, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'shootingstar') {
      // Loop 267 (the-fixer, 266 follow-on): visual sync with summer_falling_
      // _star beat. Bright head + 10-segment fading trail in screen space.
      // The beat's `after:` callback (story.js) spawns this particle when the
      // chronicle entry writes — a player watching the night sky in summer
      // sees the streak AT the moment the prose lands.
      const baseX = s.x + (p.offsetX || 0);
      const baseY = s.y + p.offsetY;
      // Trail (drawn first so head sits on top). Step length 6px keeps the
      // streak coherent at the typical zoom 1.3; trail spans ~50px back.
      for (let i = 1; i < 11; i++) {
        const t = i / 11;
        const tx = baseX - (p.vxScreen || 0) * 6 * i;
        const ty = baseY - (p.vy || 0) * 6 * i;
        ctx.globalAlpha = p.alpha * (1 - t) * 0.6;
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.arc(tx, ty, 2.4 * (1 - t * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      // Outer halo (large soft glow)
      ctx.globalAlpha = p.alpha * 0.35;
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.arc(baseX, baseY, 9, 0, Math.PI * 2);
      ctx.fill();
      // Inner halo
      ctx.globalAlpha = p.alpha * 0.6;
      ctx.beginPath();
      ctx.arc(baseX, baseY, 5, 0, Math.PI * 2);
      ctx.fill();
      // Bright core (white-hot)
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(baseX, baseY, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Loop 29 (render S3): text floaters now pick a color based on content.
      // "+N 🪵" = wood brown, "+N 🍎" = food red, etc. Boring flat-white
      // before. Also adds a gentle x-drift per-particle so multiple floaters
      // at the same tile fan out instead of stacking.
      const scale = 1 + (1 - (p.alpha / 1.5)) * 0.3;
      ctx.save();
      // Per-particle horizontal drift — seeded by text+alpha for determinism
      if (p._driftX === undefined) {
        const seed = (p.text ? p.text.charCodeAt(0) : 0) * 13 + Math.floor((p.alpha || 0) * 100);
        p._driftX = ((seed % 10) - 5) * 0.18;
      }
      const driftX = p._driftX * (1.5 - (p.alpha || 0));
      ctx.translate(psx + driftX, psy - 20);
      ctx.scale(scale, scale);
      // Pick color by resource emoji in text
      let fill = '#ffffff';
      if (p.text) {
        if (p.text.includes('🪵')) fill = '#d4a270';
        else if (p.text.includes('🪨')) fill = '#c8cad0';
        else if (p.text.includes('🍎')) fill = '#f08260';
        else if (p.text.includes('🪙')) fill = '#ffd166';
        else if (p.text.includes('⚙️')) fill = '#a8c8f0';
        else if (p.text.startsWith('-')) fill = '#f87171';  // loss
        else if (p.text.startsWith('+')) fill = '#86efac';  // gain, default
      }
      ctx.fillStyle = p.color || fill;
      ctx.font = 'bold 11px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  markRenderPass(profile, 'particles');

  // ── Cloud shadows ─────────────────────────────────────────
  if (daylight > 0.5) {
    for (const cloud of G.clouds || []) {
      const cloudAlpha = cloud.alpha * daylight;
      ctx.globalAlpha = cloudAlpha;
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, cloud.r * 0.3, cloud.x, cloud.y, cloud.r);
      grad.addColorStop(0, 'rgba(20,30,40,0.6)');
      grad.addColorStop(1, 'rgba(20,30,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = daylight;
  }

  // ── Build ghost ───────────────────────────────────────────
  if (G.selectedBuild && G.hoveredTile) {
    const ghostX = G.hoveredTile.x, ghostY = G.hoveredTile.y;
    const s = toScreen(ghostX, ghostY);
    const valid = canPlaceCheck(G.selectedBuild, ghostX, ghostY);

    // Tile highlight diamond
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = valid ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - TH/2);
    ctx.lineTo(s.x + TW/2, s.y);
    ctx.lineTo(s.x, s.y + TH/2);
    ctx.lineTo(s.x - TW/2, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = valid ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Composite an isolated building image so preview alpha cannot be
    // overwritten by drawBuilding's internal opacity resets.
    const ghostAlpha = valid ? 0.45 : 0.25;
    const ghostCanvas = renderBuildingIsolated(G.selectedBuild, {
      daylight,
      season: G.season,
      dayPhase: G.dayPhase,
      bgColor: 'rgba(0,0,0,0)',
      applyTint: false,
    });
    ctx.save();
    ctx.globalAlpha = ghostAlpha;
    ctx.drawImage(ghostCanvas, s.x - ghostCanvas.width / 2, s.y - Math.round(ghostCanvas.height * 0.72));
    ctx.restore();
    ctx.globalAlpha = daylight;
  }

  // Night overlay — multiply-blend so it darkens without washing out color.
  // Loop 067 (the-fixer, 066 HIGH): extracted to `applyNightTint` so
  // `renderBuildingIsolated` can re-use the same tint math. Shared
  // function, single source of truth.
  applyNightTint(ctx, daylight, G.dayPhase, G.dayLength);
  ctx.globalAlpha = 1;

  // Sunset/sunrise horizon glow (dawn: t<0.1, dusk: t 0.6–0.75)
  const dayT = G.dayPhase / G.dayLength;
  let horizonAlpha = 0;
  let horizonColor = '255,120,60';
  if (dayT < 0.1) {
    // Dawn: fade in then out quickly
    horizonAlpha = Math.sin((dayT / 0.1) * Math.PI) * 0.8;
    horizonColor = '255,140,60'; // warm orange-gold dawn
  } else if (dayT >= 0.6 && dayT < 0.75) {
    // Dusk: fade in then out
    horizonAlpha = Math.sin(((dayT - 0.6) / 0.15) * Math.PI) * 0.8;
    horizonColor = '220,80,30'; // deeper red-orange dusk
  }
  if (horizonAlpha > 0) {
    // Draw in world-space: a wide horizontal band near the horizon line
    ctx.globalAlpha = horizonAlpha;
    const horizonGrad = ctx.createLinearGradient(0, -600, 0, 600);
    horizonGrad.addColorStop(0, `rgba(${horizonColor},0)`);
    horizonGrad.addColorStop(0.35, `rgba(${horizonColor},0.6)`);
    horizonGrad.addColorStop(0.5, `rgba(${horizonColor},0.85)`);
    horizonGrad.addColorStop(0.65, `rgba(${horizonColor},0.6)`);
    horizonGrad.addColorStop(1, `rgba(${horizonColor},0)`);
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(-5000, -600, 10000, 1200);
  }

  // ── Victory golden tint (world-space overlay) ────────────────
  if (G.won) {
    const shimmer = 0.05 + 0.04 * Math.sin(G.gameTick * 0.03);
    ctx.globalAlpha = shimmer;
    ctx.fillStyle = 'rgba(255,209,102,1)';
    ctx.fillRect(-5000,-5000,10000,10000);
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  markRenderPass(profile, 'worldOverlays');

  // ── Birds (screen space, fly across sky during day) ──────────
  if (G.birds && G.birds.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    for (const b of G.birds) {
      // Skip rendering while still inside the vignette's opaque zone (left ~12% of screen)
      // so birds don't appear to "float in void" at the map edge.
      if (b.x < logicalW * 0.12) continue;
      // V-shape bird silhouette with flapping wings
      const wing = Math.sin(G.gameTick * 0.3 + b.x * 0.01) * 3;
      ctx.beginPath();
      ctx.moveTo(b.x - 4, b.y + wing);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + 4, b.y + wing);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Migrating flocks (loop 5+) ──────────────────────────────
  renderFlocks(ctx, logicalW, logicalH);

  // ── Rain overlay (screen space) ───────────────────────────────
  // Loop 32 (render S3): denser rain during storm, varied droplet lengths,
  // wind shear so drops slant harder in storm weather.
  if ((G.weather === 'rain' || G.weather === 'storm') && G.camera.zoom >= 0.6) {
    ctx.save();
    const isStorm = G.weather === 'storm';
    ctx.globalAlpha = isStorm ? 0.55 : 0.4;
    ctx.strokeStyle = isStorm ? '#7ea4d0' : '#8ab4e0';
    ctx.lineWidth = 0.6;
    const dropCount = isStorm ? 140 : 80;
    const shearX = isStorm ? -5 : -2;
    const shearY = isStorm ? 10 : 6;
    for (let i = 0; i < dropCount; i++) {
      const rx = (i * 37 + G.gameTick * (isStorm ? 14 : 8)) % (logicalW + 100) - 50;
      const ry = (i * 53 + G.gameTick * (isStorm ? 20 : 12)) % (logicalH + 100) - 50;
      // Vary droplet length by hash so some are long streaks, some short
      const len = 0.7 + ((i * 11) % 10) / 20;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + shearX * len, ry + shearY * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Lightning strike during thunderstorm ─────────────────────
  if (G.weather === 'rain' || G.weather === 'storm') {
    if (G._lightningFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 220, ${G._lightningFlash / 3 * 0.8})`;
      ctx.fillRect(-5000, -5000, 10000, 10000);
      ctx.restore();
    }
  }

  // ── Raid flash overlay (screen space) ────────────────────────
  if (G.raidFlash > 0) {
    ctx.globalAlpha = G.raidFlash * 0.45;
    ctx.fillStyle = 'rgba(220,30,30,1)';
    ctx.fillRect(0, 0, logicalW, logicalH);
    ctx.globalAlpha = 1;
  }

  // ── Aurora (loop 7+) — winter nights only ─────────────────
  renderAurora(ctx, logicalW, logicalH);
  // ── Ground mist (loop 11+) — dawn/dusk ───────────────────
  renderGroundMist(ctx, logicalW, logicalH);
  // ── Rainbow after rain (loop 14+) ────────────────────────
  renderRainbow(ctx, logicalW, logicalH);
  // ── Hawks circling (loop 15+) ────────────────────────────
  renderHawks(ctx);
  // ── Constellations (loop 16+) ────────────────────────────
  renderConstellations(ctx, logicalW, logicalH);
  // ── Sun lens flare (loop 20+) ────────────────────────────
  renderLensFlare(ctx, logicalW, logicalH);

  // ── Stars & Moon (screen space, drawn during night/dawn/dusk) ─
  const nightStrength = Math.max(0, (0.8 - daylight) / 0.25); // 0→1 as daylight 0.8→0.55
  if (nightStrength > 0) {
    // ── Stars ──────────────────────────────────────────────────
    // Generate a stable star field seeded by index (no RNG each frame)
    const STAR_COUNT = 180;
    ctx.save();
    for (let i = 0; i < STAR_COUNT; i++) {
      // Pseudo-random but stable positions via deterministic hash
      const px = ((i * 2971 + 7) % 997) / 997;   // 0..1
      const py = ((i * 1867 + 13) % 883) / 883;  // 0..1
      // Keep stars in upper ~65% of screen (sky area)
      const sx = px * logicalW;
      const sy = py * logicalH * 0.65;
      // Twinkle: each star has its own phase offset
      const phase = (i * 0.37) % (Math.PI * 2);
      const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(G.gameTick * 0.04 + phase));
      // Vary star sizes: most tiny, some slightly larger
      const baseSize = i % 11 === 0 ? 2.0 : i % 5 === 0 ? 1.5 : 1.0;
      const alpha = nightStrength * twinkle * (0.7 + 0.3 * Math.sin(phase * 2));
      ctx.globalAlpha = Math.min(1, alpha);
      // Slight blue-white color variation
      const bright = Math.floor(200 + 55 * twinkle);
      const blueShift = i % 3 === 0 ? 255 : bright;
      ctx.fillStyle = `rgb(${bright},${bright},${blueShift})`;
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Moon ───────────────────────────────────────────────────
    ctx.save();
    const moonX = logicalW * 0.82;
    const moonY = logicalH * 0.14;
    const moonR = 22;
    const moonAlpha = nightStrength * 0.92;
    ctx.globalAlpha = moonAlpha;
    // Soft glow halo
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 2.8);
    moonGlow.addColorStop(0, 'rgba(200,210,255,0.35)');
    moonGlow.addColorStop(1, 'rgba(200,210,255,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.8, 0, Math.PI * 2);
    ctx.fill();
    // Moon body (pale silver-white)
    ctx.fillStyle = 'rgb(230,235,255)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    // Crescent shadow: offset circle to carve the crescent
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.55, moonY - moonR * 0.05, moonR * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Screen-space vignette removed — handled by post-processing (postfx.js)

  // ── Meteor shower removed (too space-y, out of place) ──

  // ── Loop 23+: aggregator dispatch (screen space) ─────────
  enhRenderScreen(ctx, logicalW, logicalH);

  // ── FPS counter ───────────────────────────────────────────
  fpsFrames++;
  if (performance.now() - fpsTime > 1000) {
    fpsDisplay = fpsFrames;
    fpsFrames = 0;
    fpsTime = performance.now();
  }
  if (showFPS) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(4, logicalH - 20, 50, 16);
    ctx.fillStyle = fpsDisplay >= 50 ? '#4ade80' : fpsDisplay >= 30 ? '#ffd166' : '#f87171';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${fpsDisplay} FPS`, 8, logicalH - 8);
  }

  if (profile) {
    markRenderPass(profile, 'screenOverlays');
    profile.total = profile.last - profile.start;
    delete profile.start;
    delete profile.last;
    _renderProfileSamples.push(Object.freeze(profile));
    if (_renderProfileSamples.length > _RENDER_PROFILE_LIMIT) {
      _renderProfileSamples.splice(0, _renderProfileSamples.length - _RENDER_PROFILE_LIMIT);
    }
  }

}

function canPlaceCheck(type, x, y) {
  if (x<0||x>=MAP_W||y<0||y>=MAP_H) return false;
  if (!G.fog[y][x]) return false;
  const tile = G.map[y][x];
  if (tile===0||tile===6) return false;
  if (G.buildingGrid[y]?.[x]) return false;
  const def = BUILDINGS[type];
  if (def.on && !def.on.includes(tile)) return false;
  return true;
}

// ── Building sprites ────────────────────────────────────────
function drawConstructionOverlay(ctx, b, s, progress) {
  if (progress >= 1 || b.type === 'road') return;
  const p = Math.max(0, Math.min(1, progress));
  const phase = (G.gameTick || 0) * 0.12 + b.x * 1.7 + b.y * 2.3;
  const w = b.type === 'wall' ? 26 : (b.type === 'castle' || b.type === 'church' || b.type === 'townhall') ? 42 : 34;
  const h = b.type === 'wall' ? 18 : (b.type === 'castle' || b.type === 'church' || b.type === 'tower') ? 54 : 38;
  const raise = Math.min(h, h * (0.28 + p * 0.72));

  ctx.save();
  ctx.globalAlpha = 0.95 - p * 0.35;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = 'rgba(82,60,38,0.22)';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - TH / 2 + 2);
  ctx.lineTo(s.x + TW / 2 - 4, s.y);
  ctx.lineTo(s.x, s.y + TH / 2 - 2);
  ctx.lineTo(s.x - TW / 2 + 4, s.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#7c5b35';
  ctx.lineWidth = 2;
  const left = s.x - w / 2;
  const right = s.x + w / 2;
  const top = s.y - raise;
  const foot = s.y - 3;
  ctx.beginPath();
  ctx.moveTo(left, foot);
  ctx.lineTo(left + 4, top);
  ctx.moveTo(right, foot);
  ctx.lineTo(right - 4, top + 2);
  ctx.moveTo(left + 4, top);
  ctx.lineTo(right - 4, top + 2);
  ctx.moveTo(left + 6, foot - 10);
  ctx.lineTo(right - 6, top + 10);
  ctx.moveTo(right - 6, foot - 9);
  ctx.lineTo(left + 8, top + 12);
  ctx.stroke();

  ctx.strokeStyle = '#b48a54';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const x = left + 7 + i * ((w - 14) / 2);
    ctx.beginPath();
    ctx.moveTo(x, foot - 1);
    ctx.lineTo(x + Math.sin(phase + i) * 1.3, top + 5 + i);
    ctx.stroke();
  }

  if (p > 0.08 && p < 0.96) {
    const lift = Math.sin(phase) * 2;
    ctx.fillStyle = 'rgba(196,164,102,0.75)';
    ctx.beginPath();
    ctx.ellipse(s.x + w * 0.34, s.y - 8 + lift, 4, 2, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(93,68,42,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x + w * 0.34, s.y - 9 + lift);
    ctx.lineTo(s.x + w * 0.42, s.y - 15 + lift);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBuildingEventPulse2D(ctx, b, s) {
  const now = G.gameTick || 0;
  const upgradeAge = Number.isFinite(b.upgradeTick) ? now - b.upgradeTick : Infinity;
  const completeAge = Number.isFinite(b.completeTick) ? now - b.completeTick : Infinity;
  const age = Math.min(upgradeAge, completeAge);
  if (age < 0 || age > 140) return;

  const t = age / 140;
  const isUpgrade = upgradeAge <= completeAge;
  const radiusX = 18 + t * 18;
  const radiusY = 7 + t * 8;
  ctx.save();
  ctx.globalAlpha = (1 - t) * (isUpgrade ? 0.72 : 0.48);
  ctx.strokeStyle = isUpgrade ? '#f6d58f' : '#b8e0ad';
  ctx.lineWidth = 2 - t * 0.8;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 5, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawUpgradeAccents2D(ctx, b, s) {
  const level = b.level;
  if (level < 2 || b.type === 'road' || b.type === 'wall') return;
  const bands = Math.min(3, level - 1);
  const upgradeAge = Number.isFinite(b.upgradeTick) ? (G.gameTick || 0) - b.upgradeTick : Infinity;
  const upgradeBoost = upgradeAge >= 0 && upgradeAge < 140 ? (1 - upgradeAge / 140) * 0.32 : 0;
  const pulse = 0.78 + upgradeBoost + Math.sin((G.gameTick || 0) * 0.06 + b.x * 1.9 + b.y * 1.4) * 0.12;
  const colors = ['#d7c083', '#cfa463', '#bf854c'];
  const baseY = s.y - 7;
  const width = b.type === 'castle' || b.type === 'church' || b.type === 'townhall' ? 28 : 22;

  ctx.save();
  ctx.globalAlpha = pulse;
  for (let i = 0; i < bands; i++) {
    const y = baseY - i * 3;
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x - width / 2, y);
    ctx.lineTo(s.x + width / 2, y);
    ctx.stroke();
  }

  // Pennants at level 3+ make higher tiers obvious during zoomed-out play.
  if (level >= 3) {
    const pennantY = s.y - (b.type === 'tower' ? 36 : 28);
    const flap = Math.sin((G.gameTick || 0) * 0.14 + b.x + b.y) * 1.5;
    ctx.fillStyle = level >= 4 ? '#e6c18b' : '#d6a864';
    ctx.strokeStyle = 'rgba(78,52,26,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x + 9, pennantY);
    ctx.lineTo(s.x + 15 + flap, pennantY + 2);
    ctx.lineTo(s.x + 9, pennantY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x - 9, pennantY + 2);
    ctx.lineTo(s.x - 15 - flap, pennantY + 4);
    ctx.lineTo(s.x - 9, pennantY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Completed buildings share most of their canvas stack. Bake that static
// foundation/grounding/sprite stack by type, house tier, daylight bucket, and
// ring visibility; dynamic construction, damage, weather, glow, and badges
// remain live. The small LRU bound prevents old daylight buckets accumulating.
const _COMPOSITE_SCALE = 2;
const _COMPOSITE_MAX_ZOOM = 2.001;
const _DAYLIGHT_BUCKETS = 12;
const _COMPOSITE_MAX_ENTRIES = 64;
const _buildingCompositeCache = new Map();

function compositeTier(building) {
  return building.type === 'house' ? Math.min(4, building.level || 1) : 0;
}

function bakeBuildingComposite(type, tier, daylight, showRing) {
  const stub = { type, level: tier || 1, buildProgress: 1 };
  const metrics = spriteTargetMetrics(type);
  const tierScale = type === 'house'
    ? [0.9, 1.0, 1.1, 1.22][Math.min(4, tier || 1) - 1]
    : 1;
  const halfWidth = Math.ceil(Math.max(
    metrics.w * tierScale * 0.55,
    metrics.w * 0.72,
    TW / 2,
  ) + 6);
  const topHeight = Math.ceil(metrics.h * tierScale * 1.1 + 8);
  const bottomHeight = Math.ceil(Math.max(TH / 2, metrics.w * 0.20 + 8)) + 4;
  const canvas = document.createElement('canvas');
  canvas.width = (halfWidth * 2) * _COMPOSITE_SCALE;
  canvas.height = (topHeight + bottomHeight) * _COMPOSITE_SCALE;
  const compositeCtx = canvas.getContext('2d');
  compositeCtx.scale(_COMPOSITE_SCALE, _COMPOSITE_SCALE);
  const drew = drawBuildingBase(
    compositeCtx,
    stub,
    { x: halfWidth, y: topHeight },
    daylight,
    1,
    showRing,
  );
  if (!drew) return null;
  return {
    canvas,
    anchorX: halfWidth,
    anchorY: topHeight,
    width: halfWidth * 2,
    height: topHeight + bottomHeight,
  };
}

function blitBuildingComposite(ctx, building, screen, daylight, showRing) {
  const tier = compositeTier(building);
  const daylightBucket = Math.round(
    Math.max(0, Math.min(1, daylight)) * _DAYLIGHT_BUCKETS,
  );
  const key = `${building.type}|${tier}|${daylightBucket}|${showRing ? 1 : 0}`;
  let entry = _buildingCompositeCache.get(key);
  if (entry === undefined) {
    entry = bakeBuildingComposite(
      building.type,
      tier,
      daylightBucket / _DAYLIGHT_BUCKETS,
      showRing,
    );
    if (!entry) return false;
    if (_buildingCompositeCache.size >= _COMPOSITE_MAX_ENTRIES) {
      _buildingCompositeCache.delete(_buildingCompositeCache.keys().next().value);
    }
    _buildingCompositeCache.set(key, entry);
  }
  ctx.drawImage(
    entry.canvas,
    screen.x - entry.anchorX,
    screen.y - entry.anchorY,
    entry.width,
    entry.height,
  );
  return true;
}

function drawBuildingBase(ctx, b, s, daylight, progress, showRing) {

  // Foundation — darken the tile under the building for grounding
  if (b.type !== 'road' && b.type !== 'wall' && b.type !== 'farm') {
    const hw = TW/2, hh = TH/2;
    ctx.fillStyle = 'rgba(24,16,8,0.045)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x - hw, s.y);
    ctx.closePath();
    ctx.fill();
    // Worn grass ring — subtle brown tint under buildings at normal+ zoom
    if (b.type !== 'fisherman' && showRing) {
      ctx.fillStyle = 'rgba(80, 60, 40, 0.065)';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2 + 1);
      ctx.lineTo(s.x + TW/2 - 1, s.y);
      ctx.lineTo(s.x, s.y + TH/2 - 1);
      ctx.lineTo(s.x - TW/2 + 1, s.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRasterSpriteGrounding(ctx, b, s, daylight, progress);

  // Ground the sprite: scale from tile-center anchor so buildings grow UP
  // from the ground (not out in all directions), then shift down 4px to
  // place sprite base at visual ground level (tile center in iso).
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(1.1, 1.1);
  ctx.translate(-s.x, -s.y + 4);

  // Sprite path runs INSIDE the same scale/translate envelope so damage
  // cracks + winter cap (drawn after `restore`) compose on top. Atlas decode
  // is asynchronous, so skip the building for this frame until it is ready.
  const drew = drawSpriteIfReady(ctx, b, s, progress);
  ctx.restore();
  return drew;
}

function drawBuilding(ctx, b, s, daylight) {
  const def = BUILDINGS[b.type];
  if (!def) throw new Error(`[render] Unknown building type "${b.type}"`);
  if (b.type === 'road') {
    drawRoadSurface(ctx, b, s, daylight, EMPTY_ROAD_NEIGHBORS);
    return;
  }
  buildingSpriteContract(b.type);
  const progress = b.buildProgress;
  // Keep buildings fully opaque — night overlay darkens them later
  ctx.globalAlpha = 1;
  const showRing = !!(G.camera && G.camera.zoom >= 1.0);

  let drew = false;
  if (
    progress >= 1
    && b.type !== 'wall'
    && (!G.camera || G.camera.zoom <= _COMPOSITE_MAX_ZOOM)
  ) {
    drew = blitBuildingComposite(ctx, b, s, daylight, showRing);
  }
  if (!drew) drew = drawBuildingBase(ctx, b, s, daylight, progress, showRing);
  if (!drew) return;

  drawConstructionOverlay(ctx, b, s, progress);
  if (progress < 1) {
    // Construction is a project now (builders raise it) — show the site's
    // progress + crew pips so the player can read staffing at a glance.
    if (G.camera.zoom >= 0.7) {
      const bw = 26, bx = s.x - bw / 2, by = s.y - 36;
      ctx.fillStyle = 'rgba(10,10,16,0.72)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(bx, by, bw * progress, 3);
      const crew = staffingCount(b);
      for (let i = 0; i < crew; i++) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(bx + bw + 5 + i * 6, by + 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  drawUpgradeAccents2D(ctx, b, s);
  drawBuildingEventPulse2D(ctx, b, s);

  // Building damage cracks when HP is below 70%
  if (b.hp !== undefined && b.maxHp !== undefined && b.hp < b.maxHp * 0.7) {
    const damage = 1 - (b.hp / b.maxHp);
    ctx.globalAlpha = damage * 0.6;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    // Deterministic crack pattern based on building position
    const h = b.x * 37 + b.y * 73;
    ctx.beginPath();
    ctx.moveTo(s.x - 5, s.y - 15);
    ctx.lineTo(s.x + (h % 10) - 5, s.y - 10);
    ctx.lineTo(s.x + (h % 7), s.y - 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (G.camera.zoom >= 0.5) {
    // Snow cap on roofs in winter. Loop 094 (the-fixer, 086 filed):
    // per-building cap variation breaks 046's residential-blur cluster
    // in winter. Before 094 the residential types (house/tavern/bakery/
    // lumber/market/windmill/granary) all shared w=14 h=3 y=-28, so
    // winter silhouettes were identical. 094's table gives each its
    // own width × height × yOffset geometry. Building-types not in the
    // table use the defaults (14/3/-28).
    if (G.season === 'winter' && b.type !== 'road' && b.type !== 'wall' && b.type !== 'farm' && b.type !== 'quarry') {
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      if (b.type === 'granary' || b.type === 'storehouse') {
        // Loop 158 (the-fixer, closes 095 filed ~63 ticks ago):
        // granary snow CONFORMS to the dome rather than floating as an
        // ellipse above it. drawGranary draws an 11-radius dome
        // centered at y-10; 094's flat ellipse cap (w=15, h=3, y=-26)
        // read as a stacked second dome, and 096's y=-22 adjustment
        // narrowed the gap without fixing the shape mismatch. 158
        // traces the top ~100° of the dome as an arc and fills it as
        // a cap — matches how snow sits on a rounded silo.
        ctx.beginPath();
        ctx.arc(s.x, s.y - 10, 11, Math.PI + 0.55, -0.55);
        ctx.closePath();
        ctx.fill();
        // Icicles drip from the dome surface where snow rests
        ctx.fillStyle = 'rgba(200,220,255,0.6)';
        for (let i = -8; i <= 8; i += 4) {
          const icY = -Math.sqrt(Math.max(0, 121 - i * i)) + (s.y - 10);
          ctx.fillRect(s.x + i, icY + 1, 1, 2 + Math.abs(i % 3));
        }
      } else {
        const cap = _WINTER_CAPS[b.type] || _WINTER_CAPS._default;
        const snowY = s.y + cap.y;
        const snowW = cap.w;
        ctx.beginPath();
        ctx.ellipse(s.x, snowY, snowW, cap.h, 0, 0, Math.PI * 2);
        ctx.fill();
        // Icicles
        ctx.fillStyle = 'rgba(200,220,255,0.6)';
        for (let i = -snowW + 3; i < snowW; i += 4) {
          ctx.fillRect(s.x + i, snowY + 1, 1, 2 + Math.abs(i % 3));
        }
      }
    }
    // Loop 087 (the-fixer, 086 filed): farm + quarry were excluded
    // from snow-caps above because they don't have roofs to cap.
    // Winter farm == summer farm was a real seasonal-signal gap.
    // 087 adds a ground-level dusting over the tile footprint for
    // these two building types. Semi-transparent so the tile
    // beneath still reads.
    if (G.season === 'winter' && (b.type === 'farm' || b.type === 'quarry')) {
      // Loop 099 (the-fixer, 098 MEDIUM): alpha raised 0.35 → 0.55
      // because 098's photographer tick found that summer-green crops
      // showed through the 087 dusting, breaking seasonal consistency.
      // Higher alpha lets the underlying sprite read less vividly but
      // still show (0.55 preserves some sprite detail while making
      // "this is snowy, not green" the dominant perceptual signal).
      ctx.fillStyle = 'rgba(230,240,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2 + 2);
      ctx.lineTo(s.x + TW/2 - 2, s.y);
      ctx.lineTo(s.x, s.y + TH/2 - 2);
      ctx.lineTo(s.x - TW/2 + 2, s.y);
      ctx.closePath();
      ctx.fill();
      // Two frost highlights
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(s.x - 6, s.y - 3, 3, 1);
      ctx.fillRect(s.x + 2, s.y + 1, 4, 1);
    }

    // Night window glow — warm light from inhabited buildings at night
    if (daylight < 0.75 && b.type !== 'road' && b.type !== 'wall' && b.type !== 'farm' && b.type !== 'quarry') {
      const glowAlpha = (0.75 - daylight) * 2; // brighter as it gets darker
      ctx.globalAlpha = glowAlpha;
      // Warm point light around the building.
      // Cache the radial gradient at origin (0,0) keyed by building type; reuse
      // with ctx.translate so we avoid one createRadialGradient per building per frame.
      const glowR = b.type === 'castle' ? 40 : b.type === 'church' ? 32 : 24;
      const glowOffY = b.type === 'tower' ? -22 : b.type === 'castle' ? -20 : -14;
      const glowCacheKey = `${b.type}_${glowR}`;
      let glow = nightGlowCache.get(glowCacheKey);
      if (!glow) {
        glow = ctx.createRadialGradient(0, glowOffY, 2, 0, glowOffY, glowR);
        glow.addColorStop(0, 'rgba(255,220,140,0.55)');
        glow.addColorStop(1, 'rgba(255,220,140,0)');
        nightGlowCache.set(glowCacheKey, glow);
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, glowOffY, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Bright window dots.
      // Loop 59 (render S4): added night windows for the remaining
      // inhabitable buildings. Before: only house/tavern/castle/school/
      // church/barracks lit at night — lumber mill, granary, bakery,
      // fisherman's hut, blacksmith, market, windmill stayed dark holes.
      ctx.fillStyle = `rgba(255,230,150,${glowAlpha * 0.9})`;
      if (b.type === 'house') {
        ctx.fillRect(s.x+3, s.y-15, 5, 5);
      } else if (b.type === 'tavern') {
        ctx.fillRect(s.x-6, s.y-15, 6, 5);
        ctx.fillRect(s.x+2, s.y-15, 6, 5);
      } else if (b.type === 'castle') {
        for (const ox of [-6,3]) for (const oy of [-22,-14]) ctx.fillRect(s.x+ox, s.y+oy, 5, 6);
      } else if (b.type === 'school') {
        for (let i=-8;i<=6;i+=5) ctx.fillRect(s.x+i, s.y-13, 4, 5);
      } else if (b.type === 'church') {
        ctx.fillStyle = `rgba(100,160,255,${glowAlpha * 0.7})`; // blue stained glass
        ctx.beginPath();
        ctx.arc(s.x, s.y-10, 5, Math.PI, 0);
        ctx.fill();
      } else if (b.type === 'barracks') {
        ctx.fillRect(s.x-4, s.y-11, 4, 5);
      } else if (b.type === 'lumber') {
        ctx.fillRect(s.x-5, s.y-14, 4, 4);
      } else if (b.type === 'granary' || b.type === 'storehouse') {
        ctx.fillRect(s.x-3, s.y-13, 6, 4);
      } else if (b.type === 'bakery') {
        // Oven + window — warmer orange for oven
        ctx.fillStyle = `rgba(255,170,70,${glowAlpha * 0.95})`;
        ctx.fillRect(s.x-4, s.y-10, 4, 4);
        ctx.fillStyle = `rgba(255,230,150,${glowAlpha * 0.8})`;
        ctx.fillRect(s.x+3, s.y-14, 4, 4);
      } else if (b.type === 'fisherman') {
        ctx.fillRect(s.x-4, s.y-14, 4, 4);
      } else if (b.type === 'blacksmith') {
        // Forge already glows — add a small window too
        ctx.fillRect(s.x+3, s.y-16, 4, 4);
      } else if (b.type === 'market') {
        // Lantern at stall — not a window
        ctx.fillStyle = `rgba(255,190,100,${glowAlpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(s.x - 12, s.y - 16, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'windmill') {
        ctx.fillRect(s.x-2, s.y-18, 4, 4);
      }
      ctx.globalAlpha = 1;
    }

    // Dawn/dusk warm window glow (when daylight is between 0.5-0.85)
    if (daylight > 0.5 && daylight < 0.85 && G.camera.zoom >= 0.5) {
      const dawnAlpha = Math.min((0.85 - daylight) * 3, (daylight - 0.5) * 3) * 0.4;
      if (dawnAlpha > 0 && (b.type === 'house' || b.type === 'tavern' || b.type === 'church')) {
        ctx.fillStyle = `rgba(255, 200, 120, ${dawnAlpha})`;
        ctx.beginPath();
        ctx.arc(s.x + 4, s.y - 12, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Worker count indicator for buildings that need workers
    // Loop 099 (the-fixer, 098 filed): gate on !G.photoMode so cover-art
    // frames don't show "0/1" UI labels floating above each building.
    // 035's photo-mode hid ~15 HUD elements via CSS but this label is
    // canvas-drawn, invisible to CSS rules.
    const needed = def.workers || 0;
    const showWorkerBadge = G.selectedBuilding === b ||
      (G.hoveredTile && G.hoveredTile.x === b.x && G.hoveredTile.y === b.y);
    if (needed > 0 && !G.photoMode && showWorkerBadge) {
      const have = staffingCount(b);
      const full = have >= needed;
      const label = `${have}/${needed}`;
      const bw = Math.max(18, label.length * 5 + 8);
      const bh = 10;
      const bx = s.x - bw / 2;
      const by = s.y + 10;
      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = full ? 'rgba(13,50,31,0.72)' : 'rgba(55,38,10,0.74)';
      ctx.strokeStyle = full ? 'rgba(86,220,135,0.68)' : 'rgba(251,191,36,0.72)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 5);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.font = '7px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = full ? '#a7f3d0' : '#ffe08a';
      ctx.fillText(label, s.x, by + bh / 2 + 0.5);
      ctx.restore();
    }
  } // end zoom >= 0.5

  // HP bar
  if (b.hp < 100) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(s.x-12, s.y-34, 24, 3);
    ctx.fillStyle = b.hp > 50 ? '#4ade80' : '#f87171';
    ctx.fillRect(s.x-12, s.y-34, 24*(b.hp/100), 3);
  }

  // Building status glow — pulsing red outline for damaged buildings
  if (G.camera.zoom >= 1.0 && b.hp < b.maxHp) {
    const hpRatio = b.hp / b.maxHp;
    if (hpRatio < 0.5) {
      // Damaged: pulsing red outline
      const pulse = 0.3 + 0.2 * Math.sin(G.gameTick * 0.15);
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, 16, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Fire overlay
  if (b.onFire) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = `rgba(255,${100 + Math.sin(G.gameTick * 0.2) * 50},0,0.3)`;
    ctx.fillRect(s.x - 15, s.y - 25, 30, 35);
    ctx.globalAlpha = 1;
  }
}

function drawTree(ctx, x, y, a, seasonShift) {
  ctx.globalAlpha = a;

  // Pick variant based on position hash
  const posHash = (Math.abs(Math.round(x)) * 374761 + Math.abs(Math.round(y)) * 668265) >>> 0;
  const variantPick = posHash % 20;
  let variant;
  if (variantPick < 9) variant = 0;        // pine (45%)
  else if (variantPick < 17) variant = 1;  // oak (40%)
  else if (variantPick < 19) variant = 2;  // birch (10%)
  else variant = 3;                        // dead (5%)

  const natureType = variant === 0 ? 'pine' : variant === 1 ? 'oak' : variant === 2 ? 'birch' : 'dead';
  const natureH = variant === 1 ? 34 : variant === 2 ? 36 : 42;
  const natureAlpha = variant === 2 ? a * 0.74 : a;
  if (drawNatureSprite(ctx, natureType, x, y + 9, natureH, natureAlpha)) return;

  // Shadow
  ctx.globalAlpha = a * 0.15;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 4, 10, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;

  if (variant === 0) {
    // Tall Pine (conifer): slim trunk, stacked triangular layers
    const size = 0.9 + ((posHash >> 8) & 0xff) / 255 * 0.3;
    // Trunk
    ctx.fillStyle = '#4a3018';
    ctx.fillRect(x - 2, y - 2, 3, 10);
    // 3 tiers of pine needles — pointed, overlapping
    const pc1 = seasonShift ? shiftColor('#2a5a20', seasonShift) : '#2a5a20';
    const pc2 = seasonShift ? shiftColor('#3a7030', seasonShift) : '#3a7030';
    ctx.fillStyle = pc1;
    // Bottom tier (widest)
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x - 11*size, y + 3);
    ctx.lineTo(x + 11*size, y + 3);
    ctx.closePath(); ctx.fill();
    // Middle tier
    ctx.fillStyle = pc2;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 8*size, y - 2);
    ctx.lineTo(x + 8*size, y - 2);
    ctx.closePath(); ctx.fill();
    // Top tier (pointed)
    ctx.fillStyle = pc1;
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x - 5*size, y - 8);
    ctx.lineTo(x + 5*size, y - 8);
    ctx.closePath(); ctx.fill();
    // Tiny highlight streak on sunlit side
    ctx.strokeStyle = 'rgba(180,230,140,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - 4*size, y - 5); ctx.lineTo(x - 2*size, y - 10);
    ctx.stroke();
  } else if (variant === 1) {
    // Oak Tree: thick trunk, wide round canopy with lumps
    const size = 0.95 + ((posHash >> 8) & 0xff) / 255 * 0.3;
    // Thick trunk
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x - 3, y - 1, 5, 10);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 1, y - 1, 2, 8);
    // Wide round canopy with 3 overlapping bubbles
    const oc1 = seasonShift ? shiftColor('#3a7a30', seasonShift) : '#3a7a30';
    const oc2 = seasonShift ? shiftColor('#4a9040', seasonShift) : '#4a9040';
    const oc3 = seasonShift ? shiftColor('#5aa550', seasonShift) : '#5aa550';
    ctx.fillStyle = oc1;
    ctx.beginPath();
    ctx.arc(x - 4, y - 6, 8*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4, y - 7, 7*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = oc2;
    ctx.beginPath();
    ctx.arc(x, y - 10, 7*size, 0, Math.PI * 2);
    ctx.fill();
    // Highlight bubbles (top-left)
    ctx.fillStyle = oc3;
    ctx.globalAlpha = a * 0.6;
    ctx.beginPath();
    ctx.arc(x - 3, y - 11, 3.5*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 12, 2.5*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
  } else if (variant === 2) {
    // Birch / skinny tree: thin white trunk with dark marks, narrow elongated canopy
    const size = 0.9 + ((posHash >> 8) & 0xff) / 255 * 0.2;
    // Thin white trunk with black stripes
    ctx.fillStyle = '#e0dcd4';
    ctx.fillRect(x - 1.5, y - 3, 3, 14);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 1.5, y - 1, 3, 1);
    ctx.fillRect(x - 1.5, y + 3, 3, 1);
    ctx.fillRect(x - 1.5, y + 7, 3, 1);
    // Narrow tall canopy — lighter green
    const bc1 = seasonShift ? shiftColor('#4a8a3a', seasonShift) : '#4a8a3a';
    const bc2 = seasonShift ? shiftColor('#6aaa5a', seasonShift) : '#6aaa5a';
    ctx.fillStyle = bc1;
    ctx.beginPath();
    ctx.ellipse(x, y - 9, 6*size, 10*size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bc2;
    ctx.globalAlpha = a * 0.7;
    ctx.beginPath();
    ctx.ellipse(x - 2, y - 11, 3*size, 6*size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
  } else {
    // Dead tree (rare ~10%): just branches, no leaves — grey-brown
    const size = 0.85 + ((posHash >> 8) & 0xff) / 255 * 0.25;
    // Grey-brown trunk
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y - 14*size);
    ctx.stroke();
    // Branches
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x - 6*size, y - 10*size);
    ctx.moveTo(x, y - 7); ctx.lineTo(x + 5*size, y - 13*size);
    ctx.moveTo(x, y - 10); ctx.lineTo(x - 4*size, y - 15*size);
    ctx.moveTo(x + 3, y - 13); ctx.lineTo(x + 4, y - 17*size);
    ctx.stroke();
  }
}

function drawRock(ctx, x, y, a) {
  drawNatureSprite(ctx, 'stone', x, y + 8, 25, a);
}

function drawIronOre(ctx, x, y, a) {
  drawNatureSprite(ctx, 'iron', x, y + 8, 25, a);
}

function drawWater(ctx, x, y, a, tx, ty) {
  // tx/ty = tile grid coords for per-tile variation and foam detection
  const t = G.gameTick * 0.015; // slower base rate — reduces per-tile flicker
  // Per-tile phase offset so neighbouring tiles don't animate in lockstep
  const phase = (tx * 2.3 + ty * 1.7) % (Math.PI * 2);

  // ── Layer 1: deep colour base with slow hue shift ────────────
  const colorShift = 0.5 + 0.5 * Math.sin(t * 0.6 + phase);
  const cr = Math.round(24 + colorShift * 12);
  const cg = Math.round(82 + colorShift * 24);
  const cb = Math.round(130 + colorShift * 24);
  ctx.globalAlpha = a * 0.58;
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 2: gentle shimmer overlay ─────────────────────────
  // Loop 6 (render S3): shimmer halved (0.18+0.12 → 0.08+0.06) and hue darkened
  // toward the base so cyan doesn't crust tile edges. Fresh-eyes critique
  // #2 saw the tiles as "disconnected blue diamonds with hard white borders".
  const shimmer = 0.045 + 0.035 * Math.sin(t * 0.9 + phase + 1.5);
  ctx.globalAlpha = a * shimmer;
  ctx.fillStyle = 'rgba(70,135,165,1)';
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 3: animated wave crests ────────────────────────────
  ctx.lineWidth = 1.1;
  const waveRows = [-5, 4];
  for (let i = 0; i < waveRows.length; i++) {
    const rowY = waveRows[i];
    const dir = (i % 2 === 0) ? 1 : -1;
    // Softer alpha oscillation — avoids rapid per-tile flicker
    // Loop 6 (render S3): wave crest alpha reduced (0.3+0.2 → 0.18+0.12)
    // and color shifted from near-white to a muted blue-white so waves
    // look like water movement, not painted lines on puzzle pieces.
    const wAlpha = 0.10 + 0.07 * Math.sin(t * 1.4 + phase + i * 1.3);
    ctx.globalAlpha = a * Math.max(0.035, wAlpha);
    ctx.strokeStyle = 'rgba(168,205,218,1)';
    ctx.beginPath();
    const halfW = 32 * (1 - Math.abs(rowY) / 20);
    const step = 4;
    let started = false;
    for (let dx = -halfW; dx <= halfW; dx += step) {
      const wx = x + dx;
      const wy = y + rowY * 0.6
        + Math.sin(t * 1.6 * dir + dx * 0.28 + phase + i) * 3.0
        + Math.sin(t * 0.9 + dx * 0.18 + phase * 0.5) * 1.4;
      if (!started) { ctx.moveTo(wx, wy); started = true; }
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  // ── Layer 4: specular glints (2 per tile, slow-moving) ───────
  const numGlints = 1;
  for (let gi = 0; gi < numGlints; gi++) {
    const gPhase = phase + gi * 2.1;
    const gx = x + Math.sin(t * 0.8 + gPhase) * 14;
    const gy = y + Math.cos(t * 0.6 + gPhase) * 7;
    const gSize = 1.4 + 0.8 * Math.abs(Math.sin(t * 1.8 + gPhase));
    const gAlpha = 0.16 + 0.12 * Math.sin(t * 2.0 + gPhase); // gentle, ~3s cycle
    ctx.globalAlpha = a * Math.max(0, gAlpha);
    ctx.fillStyle = 'rgba(220,240,235,1)';
    ctx.beginPath();
    ctx.arc(gx, gy, gSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * Math.max(0, gAlpha) * 0.35;
    ctx.fillStyle = 'rgba(170,220,230,1)';
    ctx.beginPath();
    ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Layer 4b: shimmering highlight streaks (light reflections) ──
  ctx.lineWidth = 1;
  const streakPhase = G.gameTick * 0.008 + tx * 0.1 + ty * 0.07;
  for (let i = 0; i < 1; i++) {
    const off = Math.sin(streakPhase + i * 1.5) * 6;
    const alpha = 0.035 + 0.025 * Math.sin(streakPhase + i * 2);
    ctx.globalAlpha = a * Math.max(0, alpha);
    ctx.fillStyle = 'rgba(220, 240, 235, 0.65)';
    ctx.fillRect(x - 10 + off, y - 3 + i * 4, 16, 0.8);
  }

  // ── Layer 4c: occasional strong specular flash (sun glint on water) ──
  const flashPhase = G.gameTick * 0.03 + (tx * 0.7 + ty * 0.3);
  const flashIntensity = Math.max(0, Math.sin(flashPhase) - 0.7) * 3; // spikes rarely
  if (flashIntensity > 0) {
    ctx.globalAlpha = a * flashIntensity * 0.28;
    ctx.fillStyle = 'rgba(220,240,235,1)';
    ctx.beginPath();
    ctx.ellipse(x + (tx*3)%15-7, y + (ty*3)%5-2, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
  }

  // ── Layer 4d: golden sparkles during daytime (sun reflection) ──
  const sparkPhase = (G.gameTick * 0.02) + (tx * 1.7 + ty * 0.9);
  const sparkle = Math.max(0, Math.sin(sparkPhase * 0.3) - 0.85) * 6; // rare bright peak
  if (sparkle > 0 && a > 0.7) {
    ctx.globalAlpha = sparkle * a * 0.38;
    // Small cross-shaped sparkle
    ctx.strokeStyle = 'rgba(225, 218, 170, 0.75)';
    ctx.lineWidth = 1;
    const sx = x + (tx * 5 % 16) - 8, sy = y + (ty * 3 % 6) - 3;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy);
    ctx.moveTo(sx, sy - 2); ctx.lineTo(sx, sy + 2);
    ctx.stroke();
    ctx.globalAlpha = a;
  }

  // ── Layer 5: foam/whitecaps at land-adjacent edges ───────────
  const neighbours = [
    { dx:  0, dy: -1, ex: x,      ey: y - 16, ax: x - 32, ay: y,      bx: x + 32, by: y      }, // top
    { dx:  1, dy:  0, ex: x + 32, ey: y,      ax: x,      ay: y - 16, bx: x,      by: y + 16 }, // right
    { dx:  0, dy:  1, ex: x,      ey: y + 16, ax: x - 32, ay: y,      bx: x + 32, by: y      }, // bottom
    { dx: -1, dy:  0, ex: x - 32, ey: y,      ax: x,      ay: y - 16, bx: x,      by: y + 16 }, // left
  ];
  // Foam pulses visibly between 0.5 and 1.0
  const foamPulse = 0.42 + 0.18 * Math.sin(t * 2.0 + phase);
  for (const n of neighbours) {
    const nx = tx + n.dx, ny = ty + n.dy;
    const isLand = nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H
      && G.map[ny][nx] !== TILE.WATER;
    if (!isLand) continue;
    const m1x = (n.ex + n.ax) / 2, m1y = (n.ey + n.ay) / 2;
    const m2x = (n.ex + n.bx) / 2, m2y = (n.ey + n.by) / 2;
    // Bold primary foam stripe
    ctx.globalAlpha = a * foamPulse;
    ctx.strokeStyle = 'rgba(225,240,235,0.70)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(m1x, m1y); ctx.lineTo(n.ex, n.ey); ctx.lineTo(m2x, m2y);
    ctx.stroke();
    // Secondary softer foam halo
    ctx.globalAlpha = a * foamPulse * 0.32;
    ctx.strokeStyle = 'rgba(170,220,225,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m1x, m1y); ctx.lineTo(n.ex, n.ey); ctx.lineTo(m2x, m2y);
    ctx.stroke();
    // Foam dot clusters along each half of the edge
    ctx.globalAlpha = a * foamPulse * 0.38;
    ctx.fillStyle = 'rgba(225,240,235,0.72)';
    for (let fi = 0; fi < 3; fi++) {
      const frac = (fi + 1) / 6;
      const fx = m1x + (n.ex - m1x) * frac + Math.sin(t * 3.0 + phase + fi) * 1.5;
      const fy = m1y + (n.ey - m1y) * frac + Math.cos(t * 2.5 + phase + fi) * 1.0;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let fi = 0; fi < 3; fi++) {
      const frac = (fi + 1) / 6;
      const fx = n.ex + (m2x - n.ex) * frac + Math.sin(t * 3.0 + phase + fi + 5) * 1.5;
      const fy = n.ey + (m2y - n.ey) * frac + Math.cos(t * 2.5 + phase + fi + 5) * 1.0;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Layer 6 (loop 8+): Winter ice sheet overlay ─────────────
  if (G.season === 'winter') {
    // Tile-stable freeze fraction so coastline is patchy slush
    const freeze = ((tx * 7 + ty * 11) % 17) / 17 * 0.5 + 0.5; // 0.5..1
    ctx.globalAlpha = a * 0.78 * freeze;
    // Pale ice fill
    ctx.fillStyle = 'rgba(220,238,250,1)';
    ctx.beginPath();
    ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
    ctx.closePath();
    ctx.fill();
    // Cracks (deterministic from tile)
    ctx.strokeStyle = 'rgba(110,140,170,0.55)';
    ctx.lineWidth = 0.6;
    const seedA = ((tx * 13) ^ (ty * 7)) & 7;
    ctx.beginPath();
    ctx.moveTo(x - 20 + seedA, y - 6);
    ctx.lineTo(x - 4, y + 2);
    ctx.lineTo(x + 6, y - 4 + (seedA & 3));
    ctx.lineTo(x + 18, y + 6);
    ctx.stroke();
    // Snow drifts (white blobs)
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(x - 8 + (seedA % 5), y - 2, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 4 - (seedA % 3), 4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = a; // restore
  ctx.lineWidth = 1;
}


// ════════════════════════════════════════════════════════════
// Loop 052 (silent-module): isolated building renderer.
//
// Renders one building onto an offscreen canvas against a known
// background. Unblocks graphics audits that need to see a single
// building's silhouette/palette without the whole world in the way.
// Filed in 046 and 051 after both ticks hit the same ~15-min camera-
// wrangling tax trying to pixel-verify a single sprite. Now every
// future silhouette/palette/color-eye audit is a 1-line debug call.
//
// Usage (console):
//   const c = G.debug.renderBuildingIsolated('tavern');
//   document.body.appendChild(c);  // visual check
//
// Usage (programmatic):
//   const c = G.debug.renderBuildingIsolated('tavern', { daylight: 0.5 });
//   const ctx = c.getContext('2d');
//   const p = ctx.getImageData(...).data;  // pixel-level checks
// ════════════════════════════════════════════════════════════
export function renderBuildingIsolated(type, opts = {}) {
  const def = BUILDINGS[type];
  if (!def) throw new Error(`renderBuildingIsolated: unknown building type "${type}"`);

  const width = opts.width || 100;
  const height = opts.height || 140;
  const daylight = opts.daylight !== undefined ? opts.daylight : 1.0;
  const bgColor = opts.bgColor || '#4fb04f';  // grass green
  const season = opts.season || 'spring';
  // Loop 067: dayPhase defaults to midday if caller didn't set one.
  // Audits that want a dusk/night tint pass explicit phases like
  // 0.78 * dayLength (dusk peak) or 0.05 * dayLength (deep night).
  const dayLengthVal = G.dayLength || 3600;
  const dayPhase = opts.dayPhase !== undefined ? opts.dayPhase : dayLengthVal * 0.5;

  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const octx = off.getContext('2d');
  octx.fillStyle = bgColor;
  octx.fillRect(0, 0, width, height);

  // Mock building sprite position — centered horizontally, 75% down so
  // the building grows up from a visible "ground" line
  const mockBuilding = {
    type, x: 0, y: 0, level: 1, hp: 100, maxHp: 100,
    buildProgress: 1, productionTimer: 0, lastProduced: 0,
  };
  const s = { x: width / 2, y: Math.round(height * 0.72) };

  // Swap in neutral G state so drawBuilding doesn't consult real
  // camera/season/dayPhase. Restore afterward so the main canvas
  // isn't disturbed.
  const origCamera = G.camera;
  const origDayPhase = G.dayPhase;
  const origSeason = G.season;
  G.camera = { x: 0, y: 0, zoom: 1.5 };  // zoom >= 1 enables full-detail branches
  G.dayPhase = dayPhase;  // 067: allow caller-set phase for tint audits
  G.season = season;

  try {
    drawBuilding(octx, mockBuilding, s, daylight);
    // Loop 067: apply the shared night-tint overlay so dusk/night
    // renders through the helper show the same tint the live game
    // shows. Explicit dayPhase + dayLength args — no G swap needed
    // for applyNightTint itself.
    if (opts.applyTint !== false) applyNightTint(octx, daylight, dayPhase, dayLengthVal);
  } finally {
    G.camera = origCamera;
    G.dayPhase = origDayPhase;
    G.season = origSeason;
  }
  return off;
}
