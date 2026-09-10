// SHELL: saved Blender architecture projected into ordinary PNG layers. The
// building's existing position, tier and construction progress own the choice;
// this module never changes construction, collision, residents or save data.
import {G, TW, TH} from './state.js?realm=198';
import {makeAtlasLoader} from './atlas-loader.js?realm=198';
import {buildingLightIntensity} from './building-lighting.js?realm=198';

const ROOT = 'assets/sprites/architecture/homes/';
const WIDTH = 112, HEIGHT = 140, ANCHOR_X = .5, ANCHOR_Y = .78;
const MAX_DETAIL = 12, MAX_IN_FLIGHT = 2;
const STEPS = ['Setting out', 'Footings', 'Stone plinth', 'Floor joists', 'Uprights', 'Wall frames',
  'Lower infill', 'Upper infill', 'Gables', 'Roof trusses', 'Roof battens', 'Eaves',
  'Roof covering', 'Ridge and chimney', 'Joinery', 'Complete'];
const MAPS = {
  'complete-summer': {width: 128, height: 160, columns: 3, rows: 4},
  'complete-winter': {width: 128, height: 160, columns: 3, rows: 4},
  'construction-summer': {width: 64, height: 80, columns: 15, rows: 12},
  'construction-winter': {width: 64, height: 80, columns: 15, rows: 12},
  ground: {width: 64, height: 80, columns: 16, rows: 12},
  emission: {width: 256, height: 320, columns: 3, rows: 4},
  spill: {width: 128, height: 160, columns: 3, rows: 4},
};
const base = new Map(), detail = new Map(), masks = new Map();
let frame = 0, maskReadbacks = 0;
let anchorState = 'idle', chimneys = null;
let familyReady = false;

export function prepareHouseSprites() {
  if (anchorState === 'idle') {
    anchorState = 'loading';
    fetch(`${ROOT}anchors.json`).then(response => {
      if (!response.ok) throw new Error('House anchors unavailable');
      return response.json();
    }).then(data => {
      if (data.profile !== 'carpentered-homes-v1' || data.chimneys?.length !== 12 || data.chimneys.some((c, row) =>
        c.row !== row || !Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x <= 0 || c.x >= 1 || c.y <= 0 || c.y >= 1)) throw new Error('Invalid house anchors');
      chimneys = data.chimneys; anchorState = 'ready';
    }).catch(() => {anchorState = 'failed';});
  }
  for (const name of Object.keys(MAPS)) {
    if (!base.has(name)) base.set(name, makeAtlasLoader(`${ROOT}${name}.png`));
    base.get(name)();
  }
}

export function houseFamilyReady() {
  if (familyReady) return true;
  prepareHouseSprites();
  familyReady = anchorState === 'ready' && [...base].every(([name, load]) => {
    const image = load(), spec = MAPS[name];
    return image?.naturalWidth === spec.width * spec.columns && image.naturalHeight === spec.height * spec.rows;
  });
  return familyReady;
}

export function beginHouseSpritesFrame() {frame++;}

export function houseArtKey(building) {
  const variant = ((Math.imul(building.x | 0, 73856093) ^ Math.imul(building.y | 0, 19349663)) >>> 0) % 3;
  const tier = Math.min(4, Math.max(1, Math.floor(building.level || 1)));
  const step = building.buildProgress >= 1 ? 15 : Math.min(14, Math.max(0, Math.floor((building.buildProgress || 0) * 15)));
  return {variant, tier, step, row: (tier - 1) * 3 + variant};
}

export function houseConstructionStage(building) {return STEPS[houseArtKey(building).step];}

export function houseChimney(building) {
  if (building.type !== 'house' || !houseFamilyReady()) return null;
  const mouth = chimneys[houseArtKey(building).row];
  return {x: (mouth.x - ANCHOR_X) * WIDTH, y: (mouth.y - ANCHOR_Y) * HEIGHT};
}

function detailedFrame(key) {
  let entry = detail.get(key);
  if (entry) {
    entry.usedAt = frame;
    const image = entry.load();
    return image?.naturalWidth === 512 && image.naturalHeight === 640 ? image : null;
  }
  if ([...detail.values()].filter(e => e.load.state === 'loading').length >= MAX_IN_FLIGHT) return null;
  if (detail.size >= MAX_DETAIL) {
    const oldest = [...detail].filter(([, e]) => e.load.state !== 'loading' && e.usedAt < frame - 2)
      .sort((a, b) => a[1].usedAt - b[1].usedAt)[0];
    if (!oldest) return null;
    const image = oldest[1].load(); if (image) image.src = '';
    detail.delete(oldest[0]);
  }
  entry = {load: makeAtlasLoader(`${ROOT}detail/${key}.png`), usedAt: frame};
  detail.set(key, entry); entry.load(); return null;
}

function baseFrame(key, layer, season) {
  const {variant, tier, step, row} = key;
  const name = layer === 'body' ? `${step === 15 ? 'complete' : 'construction'}-${season}` : layer;
  const spec = MAPS[name], image = base.get(name)();
  const complete = name.startsWith('complete') || name === 'emission' || name === 'spill';
  return {image, sx: (complete ? variant : step) * spec.width, sy: (complete ? tier - 1 : row) * spec.height,
    sw: spec.width, sh: spec.height, name};
}

export function drawHouseLayer(ctx, building, point, layer = 'body', daylight = 1) {
  if (building.type !== 'house' || !houseFamilyReady()) return false;
  const key = houseArtKey(building);
  if ((layer === 'emission' || layer === 'spill') && key.step !== 15) return true;
  const season = G.season === 'winter' ? 'winter' : 'summer';
  let source = baseFrame(key, layer, season);
  if (layer === 'body') {
    const t = ctx.getTransform();
    const image = HEIGHT * Math.hypot(t.c, t.d) > source.sh ? detailedFrame(`${season}-${key.row}-${key.step}`) : null;
    if (image) source = {image, sx: 0, sy: 0, sw: 512, sh: 640};
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (layer === 'ground') ctx.globalAlpha *= .72 + Math.max(0, Math.min(1, daylight)) * .28;
  if (layer === 'emission' || layer === 'spill') {
    const intensity = buildingLightIntensity(building, G.dayPhase, G.dayLength, G.gameTick);
    if (intensity <= .001) {ctx.restore(); return true;}
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= intensity;
  }
  ctx.drawImage(source.image, source.sx, source.sy, source.sw, source.sh,
    point.x - WIDTH * ANCHOR_X, point.y - HEIGHT * ANCHOR_Y, WIDTH, HEIGHT);
  ctx.restore(); return true;
}

// Click the authored body, including taller roofs and projecting scaffolds.
// Summer/winter use identical geometry, so only two small alpha masks are
// retained. No detail image readback or whole-canvas probing happens on input.
export function hitHouse(building, point, x, y) {
  if (building.type !== 'house' || !houseFamilyReady()) return null;
  // A construction project owns its whole ground cell, including the empty
  // space between setting-out lines. Thin individual pegs are not its button.
  if (building.buildProgress < 1 && Math.abs(x - point.x) / (TW / 2) + Math.abs(y - point.y) / (TH / 2) <= 1) return true;
  const source = baseFrame(houseArtKey(building), 'body', 'summer');
  const u = (x - point.x) / WIDTH + ANCHOR_X, v = (y - point.y) / HEIGHT + ANCHOR_Y;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  if (!masks.has(source.name)) {
    const canvas = document.createElement('canvas'); canvas.width = source.image.naturalWidth; canvas.height = source.image.naturalHeight;
    const pen = canvas.getContext('2d', {willReadFrequently: true}); pen.drawImage(source.image, 0, 0);
    const rgba = pen.getImageData(0, 0, canvas.width, canvas.height).data, alpha = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    masks.set(source.name, {alpha, width: canvas.width}); maskReadbacks++; canvas.width = 0;
  }
  const {alpha, width} = masks.get(source.name), cx = Math.floor(u * source.sw), cy = Math.floor(v * source.sh);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const px = cx + dx, py = cy + dy;
    if (px >= 0 && px < source.sw && py >= 0 && py < source.sh && alpha[(source.sy + py) * width + source.sx + px] > 24) return true;
  }
  return false;
}

export function inspectHouseSprites() {
  const ready = houseFamilyReady();
  const maps = [...base].map(([name, load]) => ({name, state: load.state, url: load.url,
    decodedBytes: load.state === 'ready' ? MAPS[name].width * MAPS[name].columns * MAPS[name].height * MAPS[name].rows * 4 : 0}));
  const frames = [...detail].map(([key, entry]) => ({key, state: entry.load.state, url: entry.load.url,
    decodedBytes: entry.load.state === 'ready' ? 512 * 640 * 4 : 0}));
  return {profile: 'carpentered-homes-v1', ready, anchorState, anchor: {x: ANCHOR_X, y: ANCHOR_Y}, width: WIDTH, height: HEIGHT,
    maps, detail: frames, maxDetailFrames: MAX_DETAIL, maxInFlight: MAX_IN_FLIGHT, maskReadbacks,
    decodedBytes: [...maps, ...frames].reduce((sum, item) => sum + item.decodedBytes, 0),
    maskBytes: [...masks.values()].reduce((sum, mask) => sum + mask.alpha.byteLength, 0)};
}
