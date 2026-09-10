// SHELL: a complete saved-scene citizen family, drawn in the ordinary painter
// pass. Nothing here changes a citizen's route, activity, cargo or save state.
import { G } from './state.js?realm=198';
import { makeAtlasLoader } from './atlas-loader.js?realm=198';

const DIRECTIONS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
const ACTIONS = { walk: { frames: 24, duration: 1.0666667222976685 },
  idle: { frames: 24, duration: 4 }, work: { frames: 24, duration: 1.6 },
  carry: { frames: 24, duration: 1.0666667222976685 } };
const CELL_HEIGHT = 44, CELL_WIDTH = CELL_HEIGHT * 64 / 84, ANCHOR_Y = .86;
const MAX_DETAIL_ROWS = 12, MAX_IN_FLIGHT = 2;
const base = new Map(), detail = new Map();
let renderFrame = 0;

function small(action) {
  if (!base.has(action)) base.set(action, makeAtlasLoader(`assets/sprites/citizens/builder/${action}-64.png`));
  return base.get(action);
}

export function prepareBuilderSprites() {
  for (const action of Object.keys(ACTIONS)) small(action)();
}

function completeFamilyReady() {
  prepareBuilderSprites();
  return [...base.entries()].every(([action, load]) => {
    const image = load();
    return image && image.naturalWidth === ACTIONS[action].frames * 64 && image.naturalHeight === 84 * 8;
  });
}

export function beginBuilderSpritesFrame() {
  renderFrame++;
}

function detailedRow(action, direction) {
  const key = `${action}-${direction}`;
  let entry = detail.get(key);
  if (entry) {
    entry.usedAt = renderFrame;
    const image = entry.load();
    return image?.naturalWidth === ACTIONS[action].frames * 128 && image.naturalHeight === 168 ? image : null;
  }
  if ([...detail.values()].filter(e => e.load.state === 'loading').length >= MAX_IN_FLIGHT) return null;
  if (detail.size >= MAX_DETAIL_ROWS) {
    const oldest = [...detail.entries()].filter(([, e]) => e.load.state !== 'loading' && e.usedAt < renderFrame - 2)
      .sort((a, b) => a[1].usedAt - b[1].usedAt)[0];
    // Keep currently visible rows resident. A crowd can use the complete small
    // maps instead of decoding and discarding the same facings every frame.
    if (!oldest) return null;
    const image = oldest[1].load();
    if (image) image.src = '';
    detail.delete(oldest[0]);
  }
  entry = { load: makeAtlasLoader(`assets/sprites/citizens/builder/runtime/${action}-128-${direction}.png`), usedAt: renderFrame };
  detail.set(key, entry);
  entry.load();
  return null;
}

export function drawBuilder(ctx, { action, motion, continuity, phaseOffset = 0, faceScreenX, faceScreenY, x, y }) {
  if (!ACTIONS[action] || !completeFamilyReady()) return false;
  const tick = G.gameTick + (G.speed > 0 ? (G._renderAlpha || 0) : 0);
  let state = continuity.builder;
  if (!state || state.action !== action || tick < state.tick || tick - state.tick > 30) {
    const phase = state ? 0 : (phaseOffset / (Math.PI * 2)) % 1;
    state = continuity.builder = { action, startedAt: tick - phase * ACTIONS[action].duration * 60, tick, drawn: null };
  }
  state.tick = tick;
  const phase = action === 'walk' || action === 'carry' ? motion.phase
    : Math.max(0, (tick - state.startedAt) / (ACTIONS[action].duration * 60)) % 1;
  const direction = Math.hypot(faceScreenX, faceScreenY) < .00001 ? (state.drawn?.direction || 's')
    : DIRECTIONS[(Math.round(Math.atan2(faceScreenX, faceScreenY * 2) / (Math.PI / 4)) + 8) % 8];
  const frame = Math.floor(phase * ACTIONS[action].frames + 1e-8) % ACTIONS[action].frames;
  const transform = ctx.getTransform();
  const detailed = CELL_HEIGHT * Math.hypot(transform.c, transform.d) > 84 ? detailedRow(action, direction) : null;
  const image = detailed || small(action)();
  const size = detailed ? 128 : 64, height = size * 84 / 64;
  const row = detailed ? 0 : DIRECTIONS.indexOf(direction);
  ctx.save();
  ctx.imageSmoothingEnabled = true;ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, frame * size, row * height, size, height,
    x - CELL_WIDTH / 2, y - CELL_HEIGHT * ANCHOR_Y, CELL_WIDTH, CELL_HEIGHT);
  ctx.restore();
  state.drawn = { action, direction, phase, frame, size, x, y };
  return true;
}

export function inspectBuilderSprites() {
  const describe = (key, load, size, rows) => ({ key, state: load.state, url: load.url,
    decodedBytes: load.state === 'ready' ? 24 * size * (size * 84 / 64) * rows * 4 : 0 });
  const smallMaps = [...base].map(([action, load]) => describe(action, load, 64, 8));
  const rows = [...detail].map(([key, entry]) => describe(key, entry.load, 128, 1));
  return { character: 'builder', directions: [...DIRECTIONS], actions: ACTIONS,
    cellHeight: CELL_HEIGHT, anchorY: ANCHOR_Y, small: smallMaps, detail: rows,
    maxDetailRows: MAX_DETAIL_ROWS, maxInFlight: MAX_IN_FLIGHT,
    decodedBytes: [...smallMaps, ...rows].reduce((sum, a) => sum + a.decodedBytes, 0) };
}
