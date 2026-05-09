// Realm 3D Diorama Renderer
//
// This replaces the old experimental WebGL voxel renderer with a canvas-based
// raised diorama view. It keeps the same exported API so main/input can toggle
// it exactly as before, but it draws from the painted sprite atlases and the
// current game state instead of maintaining a separate visual language.

import { G, TILE, TILE_COLORS, MAP_W, MAP_H, TW, TH, getDaylight } from './state.js';

let canvas = null;
let ctx = null;
let logicalW = 0;
let logicalH = 0;

const TILE_W = 74;
const TILE_H = 38;
const HEIGHT_PX = {
  [TILE.WATER]: 0,
  [TILE.SAND]: 3,
  [TILE.GRASS]: 6,
  [TILE.FOREST]: 6,
  [TILE.STONE]: 7,
  [TILE.IRON]: 7,
  [TILE.MOUNTAIN]: 6,
};

const TOP_TINT = {
  [TILE.WATER]: '#2f6f8f',
  [TILE.SAND]: '#d0aa62',
  [TILE.GRASS]: '#4fb254',
  [TILE.FOREST]: '#337642',
  [TILE.STONE]: '#8a8580',
  [TILE.IRON]: '#587f9e',
  [TILE.MOUNTAIN]: '#77777f',
};

const SIDE_TINT = {
  [TILE.WATER]: '#174c7a',
  [TILE.SAND]: '#9a733c',
  [TILE.GRASS]: '#2f7137',
  [TILE.FOREST]: '#234f2c',
  [TILE.STONE]: '#555358',
  [TILE.IRON]: '#395974',
  [TILE.MOUNTAIN]: '#666670',
};

const TERRAIN_ATLAS = {
  url: 'assets/sprites/terrain-atlas.png',
  cell: 128,
  frames: {
    grass:    { x:   0, y:   0, trim: { x: 12, y: 32, w: 116, h: 84 } },
    forest:   { x: 128, y:   0, trim: { x:  0, y: 31, w: 125, h: 85 } },
    sand:     { x: 256, y:   0, trim: { x:  0, y: 31, w: 128, h: 85 } },
    water:    { x: 384, y:   0, trim: { x:  0, y: 31, w: 114, h: 86 } },
    stone:    { x:   0, y: 128, trim: { x: 12, y:  6, w: 116, h: 86 } },
    iron:     { x: 128, y: 128, trim: { x:  0, y:  6, w: 128, h: 86 } },
    mountain: { x: 256, y: 128, trim: { x:  0, y:  3, w: 128, h: 91 } },
    road:     { x: 384, y: 128, trim: { x:  0, y:  6, w: 114, h: 88 } },
  },
};

const NATURE_ATLAS = {
  url: 'assets/sprites/nature-atlas.png',
  frames: {
    pine:     { x:   0, y:   0, trim: { x: 25, y:  3, w:  81, h: 120 } },
    oak:      { x: 128, y:   0, trim: { x: 12, y: 10, w: 104, h: 110 } },
    birch:    { x: 256, y:   0, trim: { x: 20, y:  3, w:  75, h: 123 } },
    stone:    { x:   0, y: 128, trim: { x: 13, y: 21, w: 102, h:  85 } },
    iron:     { x: 128, y: 128, trim: { x: 11, y: 19, w:  98, h:  86 } },
    mountain: { x: 256, y: 128, trim: { x:  7, y:  8, w: 104, h: 104 } },
    flowers:  { x: 384, y: 128, trim: { x: 11, y: 24, w:  96, h:  85 } },
  },
};

const BUILDING_ATLAS = {
  url: 'assets/sprites/buildings-atlas-painted.png',
  cell: 128,
  cols: 4,
  types: [
    'granary', 'castle', 'church', 'windmill',
    'tower', 'house', 'tavern', 'blacksmith',
    'market', 'bakery', 'barracks', 'townhall',
    'well',
  ],
  trims: {
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
  },
  sizes: {
    granary: 64, castle: 88, church: 84, windmill: 84, tower: 82,
    house: 66, tavern: 70, blacksmith: 68, market: 64, bakery: 66,
    barracks: 70, townhall: 74, well: 50,
  },
};

const SUPPORT_ATLAS = {
  url: 'assets/sprites/support-atlas.png',
  cell: 128,
  cols: 4,
  types: [
    'farm', 'lumber', 'quarry', 'mine',
    'fisherman', 'tradingpost', 'school', 'archery',
    'wall', 'road', 'chickencoop', 'cowpen',
  ],
  trims: {
    farm:        { x:  4, y: 37, w: 124, h:  86 },
    lumber:      { x:  0, y: 23, w: 127, h: 100 },
    quarry:      { x:  5, y: 24, w: 117, h:  99 },
    mine:        { x:  1, y: 23, w: 122, h:  99 },
    fisherman:   { x:  4, y:  9, w: 121, h: 102 },
    tradingpost: { x:  5, y:  6, w: 118, h: 108 },
    school:      { x:  6, y:  2, w: 114, h: 126 },
    archery:     { x:  0, y: 12, w: 124, h: 116 },
    wall:        { x: 11, y:  7, w: 117, h: 121 },
    road:        { x:  0, y:  8, w: 123, h: 120 },
    chickencoop: { x:  3, y:  0, w: 125, h: 128 },
    cowpen:      { x:  0, y:  0, w: 123, h: 128 },
  },
  sizes: {
    farm: 54, lumber: 66, quarry: 62, mine: 64, fisherman: 66,
    tradingpost: 66, school: 68, archery: 62, wall: 44, road: 40,
    chickencoop: 52, cowpen: 56,
  },
};

const ACTOR_ATLAS = {
  url: 'assets/sprites/actors-atlas.png',
  w: 64,
  h: 84,
  frames: 4,
  dirs: ['down', 'up', 'left', 'right'],
  actions: ['idle', 'walk', 'work', 'carry'],
  variants: [
    'settler', 'farmer', 'rancher', 'lumber', 'miner', 'stonecutter',
    'fisher', 'trader', 'innkeeper', 'builder', 'blacksmith', 'guard',
    'scholar', 'forager',
  ],
};

const imgCache = new Map();

function loadImage(url) {
  const cached = imgCache.get(url);
  if (cached) return cached.complete && cached.naturalWidth ? cached : null;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  imgCache.set(url, img);
  return null;
}

function prewarmImages() {
  for (const url of [
    TERRAIN_ATLAS.url,
    NATURE_ATLAS.url,
    BUILDING_ATLAS.url,
    SUPPORT_ATLAS.url,
    ACTOR_ATLAS.url,
  ]) loadImage(url);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function hash2(x, y, salt = 0) {
  let h = ((x * 374761393) ^ (y * 668265263) ^ (salt * 362437)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function shadeColor(hex, amt) {
  let c = hex.startsWith('#') ? hex.slice(1) : hex;
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const num = parseInt(c, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  r = clamp(Math.round(r + amt), 0, 255);
  g = clamp(Math.round(g + amt), 0, 255);
  b = clamp(Math.round(b + amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function tileHeight(tile) {
  return HEIGHT_PX[tile] ?? 10;
}

function iso(tx, ty) {
  return {
    x: (tx - ty) * TILE_W / 2,
    y: (tx + ty) * TILE_H / 2,
  };
}

function worldToScreen(tx, ty) {
  const p = iso(tx, ty);
  const scale = G.camera?.zoom || 1.3;
  const camX = (G.camera?.x || 0) * (TILE_W / TW);
  const camY = (G.camera?.y || 0) * (TILE_H / TH);
  return {
    x: logicalW / 2 + (p.x - camX) * scale,
    y: logicalH / 2 + (p.y - camY) * scale,
  };
}

function screenToWorldRaw(mx, my) {
  const rect = canvas.getBoundingClientRect();
  const cx = (mx - rect.left) * (logicalW / rect.width);
  const cy = (my - rect.top) * (logicalH / rect.height);
  const scale = G.camera?.zoom || 1.3;
  const camX = (G.camera?.x || 0) * (TILE_W / TW);
  const camY = (G.camera?.y || 0) * (TILE_H / TH);
  const sx = (cx - logicalW / 2) / scale + camX;
  const sy = (cy - logicalH / 2) / scale + camY;
  const wx = sx / (TILE_W / 2);
  const wy = sy / (TILE_H / 2);
  return { x: (wx + wy) / 2, y: (wy - wx) / 2 };
}

export function screenToWorld3D(mx, my) {
  return screenToWorldRaw(mx, my);
}

export function screenToTile3D(mx, my) {
  const w = screenToWorld3D(mx, my);
  return {
    x: clamp(Math.round(w.x), 0, MAP_W - 1),
    y: clamp(Math.round(w.y), 0, MAP_H - 1),
  };
}

function projectTile(tx, ty) {
  const s = worldToScreen(tx, ty);
  const scale = G.camera?.zoom || 1.3;
  const tile = G.map?.[ty]?.[tx] ?? TILE.GRASS;
  const h = tileHeight(tile) * scale;
  return { x: s.x, y: s.y - h, baseY: s.y, h, scale, tile };
}

function pathDiamond(p, topY = p.y, inflate = 0) {
  const hw = TILE_W * p.scale / 2 + inflate;
  const hh = TILE_H * p.scale / 2 + inflate * 0.5;
  ctx.beginPath();
  ctx.moveTo(p.x, topY - hh);
  ctx.lineTo(p.x + hw, topY);
  ctx.lineTo(p.x, topY + hh);
  ctx.lineTo(p.x - hw, topY);
  ctx.closePath();
}

function fillDiamond(p, color, topY = p.y, inflate = 0) {
  pathDiamond(p, topY, inflate);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTerrainSprite(tile, p, alpha) {
  const atlas = loadImage(TERRAIN_ATLAS.url);
  if (!atlas) return false;
  const key =
    tile === TILE.WATER ? 'water' :
    tile === TILE.SAND ? 'sand' :
    tile === TILE.GRASS ? 'grass' :
    tile === TILE.FOREST ? 'forest' :
    tile === TILE.STONE ? 'stone' :
    tile === TILE.IRON ? 'iron' :
    tile === TILE.MOUNTAIN ? 'mountain' : null;
  const frame = key ? TERRAIN_ATLAS.frames[key] : null;
  if (!frame) return false;
  const trim = frame.trim;
  const targetW = TILE_W * p.scale * 1.18;
  const targetH = targetW * (trim.h / trim.w);
  ctx.save();
  pathDiamond(p, p.y, 1.4 * p.scale);
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(
    atlas,
    frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
    p.x - targetW / 2,
    p.y - TILE_H * p.scale / 2 - 4 * p.scale,
    targetW,
    targetH
  );
  ctx.restore();
  return true;
}

function groundTileFor3D(tile) {
  return (
    tile === TILE.STONE ||
    tile === TILE.IRON ||
    tile === TILE.FOREST ||
    tile === TILE.MOUNTAIN
  ) ? TILE.GRASS : tile;
}

function drawWaterShoreline(tx, ty, p, hw, hh) {
  const top = { x: p.x, y: p.y - hh };
  const right = { x: p.x + hw, y: p.y };
  const bottom = { x: p.x, y: p.y + hh };
  const left = { x: p.x - hw, y: p.y };
  const edges = [
    { nx: tx - 1, ny: ty, a: top, b: left },
    { nx: tx, ny: ty - 1, a: top, b: right },
    { nx: tx + 1, ny: ty, a: right, b: bottom },
    { nx: tx, ny: ty + 1, a: left, b: bottom },
  ];

  const shoreEdges = edges.filter(edge => {
    if (edge.nx < 0 || edge.nx >= MAP_W || edge.ny < 0 || edge.ny >= MAP_H) return false;
    return (G.map?.[edge.ny]?.[edge.nx] ?? TILE.WATER) !== TILE.WATER;
  });
  if (!shoreEdges.length) return;

  ctx.save();
  pathDiamond(p, p.y, 0.8 * p.scale);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const edge of shoreEdges) {
    const wobble = Math.sin((tx * 1.7 + ty * 2.1 + G.gameTick * 0.035)) * 0.45 * p.scale;
    const ax = edge.a.x * 0.86 + edge.b.x * 0.14;
    const ay = edge.a.y * 0.86 + edge.b.y * 0.14;
    const bx = edge.a.x * 0.14 + edge.b.x * 0.86;
    const by = edge.a.y * 0.14 + edge.b.y * 0.86;
    const mx = (ax + bx) / 2 + wobble;
    const my = (ay + by) / 2 - wobble * 0.35;

    ctx.globalAlpha = 0.23;
    ctx.strokeStyle = '#ebd49a';
    ctx.lineWidth = Math.max(2.2, p.scale * 2.8);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.stroke();

    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#d7f0ef';
    ctx.lineWidth = Math.max(1, p.scale * 1.05);
    ctx.beginPath();
    ctx.moveTo(ax, ay - 0.9 * p.scale);
    ctx.quadraticCurveTo(mx, my - 1.2 * p.scale, bx, by - 0.9 * p.scale);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGroundAccents(tx, ty, groundTile, sourceTile, p, hw, hh) {
  const seed = hash2(tx, ty, 29);
  if (groundTile !== TILE.GRASS && groundTile !== TILE.SAND) return;

  ctx.save();
  pathDiamond(p, p.y, 0.8 * p.scale);
  ctx.clip();

  if (groundTile === TILE.GRASS) {
    const isResourceGround = sourceTile === TILE.FOREST || sourceTile === TILE.STONE || sourceTile === TILE.IRON || sourceTile === TILE.MOUNTAIN;
    const count = isResourceGround ? 1 : 2 + (seed % 2);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, 0.85 * p.scale);
    for (let i = 0; i < count; i++) {
      const h = hash2(tx, ty, 41 + i);
      const px = p.x + (((h & 255) / 255) - 0.5) * hw * 1.22;
      const py = p.y + ((((h >> 8) & 255) / 255) - 0.5) * hh * 1.08;
      const len = (3.6 + ((h >> 16) & 7)) * p.scale;
      const lean = (((h >> 20) & 15) - 7) * 0.16 * p.scale;
      ctx.globalAlpha = isResourceGround ? 0.055 : 0.075;
      ctx.strokeStyle = ((h >> 24) & 1) ? '#e6d789' : '#123f24';
      ctx.beginPath();
      ctx.moveTo(px - len * 0.45, py + len * 0.20);
      ctx.quadraticCurveTo(px + lean, py - len * 0.25, px + len * 0.50, py + len * 0.08);
      ctx.stroke();
    }
  } else if (groundTile === TILE.SAND) {
    const count = 2 + (seed % 3);
    ctx.fillStyle = '#815f32';
    for (let i = 0; i < count; i++) {
      const h = hash2(tx, ty, 71 + i);
      const px = p.x + (((h & 255) / 255) - 0.5) * hw * 1.18;
      const py = p.y + ((((h >> 8) & 255) / 255) - 0.5) * hh * 1.02;
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      ctx.ellipse(px, py, (1.2 + ((h >> 16) & 3) * 0.25) * p.scale, 0.48 * p.scale, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawTile(tx, ty, visible) {
  const tile = G.map?.[ty]?.[tx] ?? TILE.GRASS;
  const groundTile = groundTileFor3D(tile);
  const p = projectTile(tx, ty);
  const hw = TILE_W * p.scale / 2;
  const hh = TILE_H * p.scale / 2;
  const nextX = tx + 1 < MAP_W ? tileHeight(G.map[ty][tx + 1]) * p.scale : 0;
  const nextY = ty + 1 < MAP_H ? tileHeight(G.map[ty + 1][tx]) * p.scale : 0;
  const baseCol = TOP_TINT[groundTile] || TILE_COLORS[groundTile]?.[0] || '#528a4c';
  const sideCol = SIDE_TINT[groundTile] || shadeColor(baseCol, -45);
  const sideThreshold = 2 * p.scale;
  const naturalSideAlpha = tile === TILE.MOUNTAIN ? 0.24 : tile === TILE.STONE || tile === TILE.IRON ? 0.34 : 0.50;
  const sideAlpha = visible ? naturalSideAlpha : Math.min(naturalSideAlpha, 0.12);

  if (p.h > nextY + sideThreshold || tx === 0 || ty === MAP_H - 1) {
    ctx.save();
    ctx.globalAlpha = sideAlpha;
    ctx.fillStyle = shadeColor(sideCol, tile === TILE.MOUNTAIN ? 20 : 6);
    ctx.beginPath();
    ctx.moveTo(p.x - hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x, p.baseY + hh);
    ctx.lineTo(p.x - hw, p.baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (p.h > nextX + sideThreshold || ty === 0 || tx === MAP_W - 1) {
    ctx.save();
    ctx.globalAlpha = sideAlpha + 0.05;
    ctx.fillStyle = shadeColor(sideCol, tile === TILE.MOUNTAIN ? 28 : 14);
    ctx.beginPath();
    ctx.moveTo(p.x + hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x, p.baseY + hh);
    ctx.lineTo(p.x + hw, p.baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const jitterScale =
    groundTile === TILE.GRASS || groundTile === TILE.FOREST ? 0.22 :
    groundTile === TILE.SAND || groundTile === TILE.WATER ? 0.30 :
    0.46;
  const visibleJitter = ((hash2(tx, ty) & 31) - 15) * jitterScale;
  const hiddenJitter = ((hash2(tx, ty, 3) & 15) - 7) * 0.10;
  const topColor = visible
    ? shadeColor(baseCol, visibleJitter)
    : shadeColor(groundTile === TILE.WATER ? '#14314a' : '#26483a', hiddenJitter);
  fillDiamond(p, topColor, p.y, 1.6 * p.scale);
  const terrainAlpha =
    groundTile === TILE.WATER ? 0.46 :
    groundTile === TILE.GRASS ? (tile === TILE.FOREST ? 0.48 : tile === TILE.MOUNTAIN ? 0.42 : tile === groundTile ? 0.42 : 0.38) :
    groundTile === TILE.FOREST ? 0.48 :
    groundTile === TILE.SAND ? 0.46 :
    0.58;
  drawTerrainSprite(groundTile, p, visible ? terrainAlpha : terrainAlpha * 0.12);
  if (visible) drawGroundAccents(tx, ty, groundTile, tile, p, hw, hh);

  if (visible && groundTile === TILE.WATER) {
    const wave = Math.sin((tx * 0.9 + ty * 0.5 + G.gameTick * 0.05)) * 0.5 + 0.5;
    ctx.save();
    pathDiamond(p);
    ctx.clip();
    ctx.globalAlpha = 0.08 + wave * 0.045;
    ctx.strokeStyle = '#c6e5ef';
    ctx.lineWidth = Math.max(1, p.scale * 0.75);
    ctx.beginPath();
    ctx.moveTo(p.x - hw * 0.48, p.y - hh * 0.08);
    ctx.lineTo(p.x + hw * 0.40, p.y + hh * 0.04);
    ctx.stroke();
    ctx.restore();
    drawWaterShoreline(tx, ty, p, hw, hh);
  }

  if (!visible) {
    ctx.save();
    pathDiamond(p, p.y, 1.6 * p.scale);
    const fogGrad = ctx.createLinearGradient(p.x, p.y - hh, p.x, p.y + hh);
    if (tile === TILE.WATER) {
      fogGrad.addColorStop(0, 'rgba(9,31,48,0.34)');
      fogGrad.addColorStop(1, 'rgba(6,18,31,0.44)');
    } else {
      fogGrad.addColorStop(0, 'rgba(24,43,38,0.30)');
      fogGrad.addColorStop(1, 'rgba(10,24,29,0.40)');
    }
    ctx.fillStyle = fogGrad;
    ctx.fill();
    ctx.restore();
  }
}

function drawAtlasFrame(atlasDef, type, x, y, height, alpha = 1, reveal = 1) {
  const atlas = loadImage(atlasDef.url);
  const idx = atlasDef.types?.indexOf(type) ?? -1;
  if (!atlas || idx < 0) return false;
  const trim = atlasDef.trims[type] || { x: 0, y: 0, w: atlasDef.cell, h: atlasDef.cell };
  const frameX = (idx % atlasDef.cols) * atlasDef.cell;
  const frameY = Math.floor(idx / atlasDef.cols) * atlasDef.cell;
  const targetH = height;
  const targetW = targetH * (trim.w / trim.h);
  const r = Math.max(0, Math.min(1, reveal));
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (r < 0.995) {
    const visibleH = Math.max(2, targetH * r);
    ctx.beginPath();
    ctx.rect(x - targetW / 2 - 4 * pScale(), y - visibleH - 2 * pScale(), targetW + 8 * pScale(), visibleH + 4 * pScale());
    ctx.clip();
    ctx.globalAlpha *= 0.48 + r * 0.52;
  }
  ctx.drawImage(
    atlas,
    frameX + trim.x, frameY + trim.y, trim.w, trim.h,
    x - targetW / 2,
    y - targetH,
    targetW,
    targetH
  );
  ctx.restore();
  return true;
}

function pScale() {
  return G.camera?.zoom || 1.3;
}

function drawNature(type, x, y, height, alpha = 1, seed = 0) {
  const atlas = loadImage(NATURE_ATLAS.url);
  const frame = NATURE_ATLAS.frames[type];
  if (!atlas || !frame) return false;
  const trim = frame.trim;
  const variantScale = seed ? 0.92 + ((seed >>> 12) & 15) * 0.012 : 1;
  const targetH = height * variantScale;
  const targetW = targetH * (trim.w / trim.h);
  const flip = !!(seed & 64);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (flip) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      atlas,
      frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
      -targetW / 2,
      y - targetH,
      targetW,
      targetH
    );
  } else {
    ctx.drawImage(
      atlas,
      frame.x + trim.x, frame.y + trim.y, trim.w, trim.h,
      x - targetW / 2,
      y - targetH,
      targetW,
      targetH
    );
  }
  ctx.restore();
  return true;
}

function drawProceduralTree(x, y, scale, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#5a351b';
  ctx.fillRect(-1.7, -13, 3.4, 15);
  const hue = (seed % 3) * 12;
  ctx.fillStyle = hue === 0 ? '#1f7a3a' : hue === 12 ? '#2b8b42' : '#176434';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const top = -36 + i * 9;
    const wide = 13 - i * 2;
    ctx.moveTo(0, top);
    ctx.lineTo(wide, top + 19);
    ctx.lineTo(-wide, top + 19);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTerrainDetail(tx, ty) {
  if (!G.fog?.[ty]?.[tx]) return;
  const tile = G.map?.[ty]?.[tx] ?? TILE.GRASS;
  const p = projectTile(tx, ty);
  const seed = hash2(tx, ty, 11);
  const x = p.x + (((seed & 255) / 255) - 0.5) * TILE_W * p.scale * 0.22;
  const y = p.y + TILE_H * p.scale * 0.18;

  if (tile === TILE.FOREST && (seed % 100) < 58) {
    const roll = seed % 10;
    const treeType = roll < 5 ? 'pine' : roll < 9 ? 'oak' : 'birch';
    const treeH = treeType === 'birch' ? 52 : treeType === 'oak' ? 56 : 60;
    const treeAlpha = treeType === 'birch' ? 0.72 : 0.95;
    drawNature(treeType, x, y + 3 * p.scale, treeH * p.scale, treeAlpha, seed);
  } else if (tile === TILE.STONE && (seed % 100) < 48) {
    drawNature('stone', x, y + 2 * p.scale, 32 * p.scale, 0.90, seed);
  } else if (tile === TILE.IRON && (seed % 100) < 48) {
    drawNature('iron', x, y + 2 * p.scale, 34 * p.scale, 0.90, seed);
  } else if (tile === TILE.MOUNTAIN) {
    drawNature('mountain', p.x, y + 6 * p.scale, 78 * p.scale, 0.95, seed);
  } else if ((tile === TILE.GRASS || tile === TILE.FOREST) && (seed % 100) < 3) {
    drawNature('flowers', x, y + 1 * p.scale, 14 * p.scale, 0.42, seed);
  }
}

function buildingSpriteInfo(type) {
  if (BUILDING_ATLAS.types.includes(type)) {
    return { atlas: BUILDING_ATLAS, height: BUILDING_ATLAS.sizes[type] || 66 };
  }
  if (SUPPORT_ATLAS.types.includes(type)) {
    return { atlas: SUPPORT_ATLAS, height: SUPPORT_ATLAS.sizes[type] || 58 };
  }
  return null;
}

function actorIdentitySeed(c) {
  const label = c?.name || `${Math.round((c?.x || 0) * 10)},${Math.round((c?.y || 0) * 10)}`;
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawConstructionOverlay(b, p, baseX, baseY, progress) {
  if (progress >= 1 || b.type === 'road') return;
  const r = Math.max(0, Math.min(1, progress));
  const scale = p.scale;
  const phase = (G.gameTick || 0) * 0.12 + b.x * 1.7 + b.y * 2.3;
  const w = (b.type === 'wall' ? 28 : (b.type === 'castle' || b.type === 'church' || b.type === 'townhall') ? 48 : 38) * scale;
  const h = (b.type === 'wall' ? 20 : (b.type === 'castle' || b.type === 'church' || b.type === 'tower') ? 62 : 42) * scale;
  const raised = Math.min(h, h * (0.28 + r * 0.72));

  ctx.save();
  ctx.globalAlpha = 0.95 - r * 0.35;
  pathDiamond(p, p.y + TILE_H * scale * 0.08, -2 * scale);
  ctx.fillStyle = 'rgba(82,60,38,0.25)';
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#7c5b35';
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  const left = baseX - w / 2;
  const right = baseX + w / 2;
  const top = baseY - raised;
  const foot = baseY - 4 * scale;
  ctx.beginPath();
  ctx.moveTo(left, foot);
  ctx.lineTo(left + 5 * scale, top);
  ctx.moveTo(right, foot);
  ctx.lineTo(right - 5 * scale, top + 2 * scale);
  ctx.moveTo(left + 5 * scale, top);
  ctx.lineTo(right - 5 * scale, top + 2 * scale);
  ctx.moveTo(left + 7 * scale, foot - 11 * scale);
  ctx.lineTo(right - 7 * scale, top + 11 * scale);
  ctx.moveTo(right - 7 * scale, foot - 10 * scale);
  ctx.lineTo(left + 8 * scale, top + 12 * scale);
  ctx.stroke();

  ctx.fillStyle = 'rgba(196,164,102,0.75)';
  ctx.beginPath();
  ctx.ellipse(baseX + w * 0.34, baseY - 9 * scale + Math.sin(phase) * 2 * scale, 4 * scale, 2 * scale, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawConnectedWall(b, p, baseX, baseY, progress) {
  const r = Math.max(0.08, Math.min(1, progress));
  const scale = p.scale;
  const hasN = b && G.buildingGrid[b.y - 1]?.[b.x]?.type === 'wall';
  const hasS = b && G.buildingGrid[b.y + 1]?.[b.x]?.type === 'wall';
  const hasE = b && G.buildingGrid[b.y]?.[b.x + 1]?.type === 'wall';
  const hasW = b && G.buildingGrid[b.y]?.[b.x - 1]?.type === 'wall';
  const h = 19 * scale * r;
  const low = baseY - 4 * scale;
  const top = baseY - h;

  ctx.save();
  ctx.globalAlpha = 0.45 + 0.55 * r;
  pathDiamond(p, p.y + TILE_H * scale * 0.04, -3 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fill();

  const segment = (dx, dy, shade) => {
    const ex = baseX + dx * scale;
    const ey = baseY + dy * scale;
    ctx.lineCap = 'round';
    ctx.strokeStyle = shade;
    ctx.lineWidth = Math.max(5, 11 * scale);
    ctx.beginPath();
    ctx.moveTo(baseX, low);
    ctx.lineTo(ex, ey - 4 * scale);
    ctx.stroke();

    ctx.strokeStyle = '#8f867d';
    ctx.lineWidth = Math.max(3, 7 * scale);
    ctx.beginPath();
    ctx.moveTo(baseX, top);
    ctx.lineTo(ex, ey - h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(226,210,184,0.32)';
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.beginPath();
    ctx.moveTo(baseX - scale, top - 2 * scale);
    ctx.lineTo(ex - scale, ey - h - 2 * scale);
    ctx.stroke();
  };

  if (hasE) segment(TILE_W / 2, TILE_H / 2, '#5c5752');
  if (hasS) segment(-TILE_W / 2, TILE_H / 2, '#514d49');
  if (!hasE && hasW) segment(-TILE_W / 2, -TILE_H / 2, '#625d58');
  if (!hasS && hasN) segment(TILE_W / 2, -TILE_H / 2, '#6b655f');

  ctx.fillStyle = '#6e6862';
  ctx.fillRect(baseX - 5 * scale, top, 10 * scale, h);
  ctx.fillStyle = '#958b81';
  ctx.fillRect(baseX - 7 * scale, top - 4 * scale, 14 * scale, 4 * scale);
  ctx.fillStyle = '#a1978d';
  ctx.fillRect(baseX - 3 * scale, top - 8 * scale, 6 * scale, 5 * scale);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(baseX - 6 * scale, top - 3 * scale, 12 * scale, scale);
  ctx.restore();

  drawConstructionOverlay(b, p, baseX, baseY, progress);
  drawBuildingEventPulse3D(b, baseX, baseY, scale);
}

function drawBuildingEventPulse3D(b, baseX, baseY, scale) {
  const now = G.gameTick || 0;
  const upgradeAge = Number.isFinite(b.upgradeTick) ? now - b.upgradeTick : Infinity;
  const completeAge = Number.isFinite(b.completeTick) ? now - b.completeTick : Infinity;
  const age = Math.min(upgradeAge, completeAge);
  if (age < 0 || age > 140) return;

  const t = age / 140;
  const isUpgrade = upgradeAge <= completeAge;
  ctx.save();
  ctx.globalAlpha = (1 - t) * (isUpgrade ? 0.72 : 0.48);
  ctx.strokeStyle = isUpgrade ? '#f6d58f' : '#b8e0ad';
  ctx.lineWidth = Math.max(1, (2 - t * 0.8) * scale);
  ctx.beginPath();
  ctx.ellipse(baseX, baseY - 6 * scale, (19 + t * 20) * scale, (8 + t * 9) * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawUpgradeAccents3D(b, baseX, baseY, scale) {
  const level = Math.max(1, b.level || 1);
  if (level < 2 || b.type === 'road' || b.type === 'wall') return;
  const bands = Math.min(3, level - 1);
  const upgradeAge = Number.isFinite(b.upgradeTick) ? (G.gameTick || 0) - b.upgradeTick : Infinity;
  const upgradeBoost = upgradeAge >= 0 && upgradeAge < 140 ? (1 - upgradeAge / 140) * 0.32 : 0;
  const pulse = 0.78 + upgradeBoost + Math.sin((G.gameTick || 0) * 0.06 + b.x * 1.9 + b.y * 1.4) * 0.12;
  const colors = ['#d7c083', '#cfa463', '#bf854c'];
  const width = (b.type === 'castle' || b.type === 'church' || b.type === 'townhall' ? 30 : 24) * scale;
  const baseBandY = baseY - 8 * scale;

  ctx.save();
  ctx.globalAlpha = pulse;
  for (let i = 0; i < bands; i++) {
    const y = baseBandY - i * 3 * scale;
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.beginPath();
    ctx.moveTo(baseX - width / 2, y);
    ctx.lineTo(baseX + width / 2, y);
    ctx.stroke();
  }

  if (level >= 3) {
    const pennantY = baseY - (b.type === 'tower' ? 39 : 30) * scale;
    const flap = Math.sin((G.gameTick || 0) * 0.14 + b.x + b.y) * 1.7 * scale;
    ctx.fillStyle = level >= 4 ? '#e6c18b' : '#d6a864';
    ctx.strokeStyle = 'rgba(78,52,26,0.65)';
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.moveTo(baseX + 9 * scale, pennantY);
    ctx.lineTo(baseX + 15 * scale + flap, pennantY + 2 * scale);
    ctx.lineTo(baseX + 9 * scale, pennantY + 5 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(baseX - 9 * scale, pennantY + 2 * scale);
    ctx.lineTo(baseX - 15 * scale - flap, pennantY + 4 * scale);
    ctx.lineTo(baseX - 9 * scale, pennantY + 7 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBuilding(b) {
  if (!b || b.type === 'road') return;
  const p = projectTile(b.x, b.y);
  const scale = p.scale;
  const baseX = p.x;
  const baseY = p.y + TILE_H * scale * 0.34;
  const visible = G.fog?.[b.y]?.[b.x] !== false;
  if (!visible) return;
  const progress = Math.max(0, Math.min(1, b.buildProgress ?? 1));

  if (b.type === 'wall') {
    drawConnectedWall(b, p, baseX, baseY, progress);
    return;
  }

  const info = buildingSpriteInfo(b.type);
  const spriteH = (info?.height || 62) * scale * 1.12;

  if (info && drawAtlasFrame(info.atlas, b.type, baseX, baseY + 5 * scale, spriteH, 1, progress)) {
    drawConstructionOverlay(b, p, baseX, baseY + 5 * scale, progress);
    if (progress >= 1) {
      drawUpgradeAccents3D(b, baseX, baseY + 5 * scale, scale);
      drawBuildingEventPulse3D(b, baseX, baseY + 5 * scale, scale);
    }
    return;
  }

  ctx.save();
  ctx.fillStyle = '#8c6a3d';
  ctx.fillRect(baseX - 18 * scale, baseY - 42 * scale, 36 * scale, 42 * scale);
  ctx.fillStyle = '#3f2a1b';
  ctx.beginPath();
  ctx.moveTo(baseX - 24 * scale, baseY - 42 * scale);
  ctx.lineTo(baseX, baseY - 64 * scale);
  ctx.lineTo(baseX + 24 * scale, baseY - 42 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function actorVariant(c) {
  const jt = c.jobBuilding?.type;
  if (jt === 'chickencoop' || jt === 'cowpen') return 'rancher';
  if (jt === 'farm' || jt === 'windmill' || jt === 'bakery') return 'farmer';
  if (jt === 'lumber') return 'lumber';
  if (jt === 'quarry') return 'stonecutter';
  if (jt === 'blacksmith') return 'blacksmith';
  if (jt === 'mine') return 'miner';
  if (jt === 'fisherman') return 'fisher';
  if (jt === 'tavern') return 'innkeeper';
  if (jt === 'market' || jt === 'tradingpost') return 'trader';
  if (jt === 'barracks' || jt === 'tower' || jt === 'archery') return 'guard';
  if (jt === 'school' || jt === 'church') return 'scholar';
  if (jt === 'townhall') return 'builder';
  const townfolk = ['settler', 'farmer', 'builder', 'trader', 'scholar', 'forager'];
  const citizenIdx = Array.isArray(G.citizens) ? Math.max(0, G.citizens.indexOf(c)) : 0;
  return townfolk[(actorIdentitySeed(c) + citizenIdx * 5) % townfolk.length];
}

function actorAction(c, moving) {
  if (moving && (c.carrying || c.state === 'walk_to_deliver' || c.state === 'deliver')) return 'carry';
  if (c.state === 'working' || c.state === 'foraging' || c.state === 'eating') return 'work';
  if (moving) return 'walk';
  return 'idle';
}

function actorDir(entity) {
  const dx = (entity.tx ?? entity.x) - entity.x;
  const dy = (entity.ty ?? entity.y) - entity.y;
  const sx = (dx - dy) * TILE_W / 2;
  const sy = (dx + dy) * TILE_H / 2;
  if (Math.abs(sx) > Math.abs(sy) * 1.15) return sx < 0 ? 'left' : 'right';
  return sy < 0 ? 'up' : 'down';
}

function drawActorGroundShadow(x, y, scale, moving, stride, dir, enemy) {
  ctx.save();
  const baseAlpha = enemy ? 0.18 : 0.115;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, 0.75 * scale);

  const markFoot = (cx, cy, len, alpha, tilt = 0) => {
    ctx.strokeStyle = `rgba(3,7,4,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(cx - len * 0.5, cy - tilt);
    ctx.lineTo(cx + len * 0.5, cy + tilt);
    ctx.stroke();
  };

  if (moving) {
    const step = Math.sign(stride || 1);
    const side = dir === 'up' || dir === 'down' ? 1 : 0;
    const footSpreadX = (side ? 2.1 : 3.0) * scale;
    const footSpreadY = (side ? 0.75 : 0.36) * scale;
    const tilt = (dir === 'left' ? -0.18 : dir === 'right' ? 0.18 : 0.08) * scale;
    markFoot(x - footSpreadX * step, y + 1.6 * scale - footSpreadY, 3.0 * scale, baseAlpha, tilt);
    markFoot(x + footSpreadX * step, y + 1.9 * scale + footSpreadY, 2.2 * scale, baseAlpha * 0.55, -tilt);
  } else {
    const side = dir === 'left' || dir === 'right' ? 1 : 0;
    const footSpreadX = (side ? 2.3 : 1.75) * scale;
    const footSpreadY = (side ? 0.28 : 0.55) * scale;
    markFoot(x - footSpreadX, y + 1.75 * scale - footSpreadY, 1.9 * scale, baseAlpha * 0.72);
    markFoot(x + footSpreadX, y + 1.75 * scale + footSpreadY, 1.9 * scale, baseAlpha * 0.72);
  }

  ctx.restore();
}

function drawActor(c, enemy = false) {
  const atlas = loadImage(ACTOR_ATLAS.url);
  const p = projectTile(clamp(Math.floor(c.x), 0, MAP_W - 1), clamp(Math.floor(c.y), 0, MAP_H - 1));
  const base = worldToScreen(c.x, c.y);
  const y = base.y - p.h + TILE_H * p.scale * 0.20;
  const x = base.x;
  const scale = p.scale;
  const hasActivePath = c.path && c.pathIdx < (c.path?.length ?? 0);
  const targetDist = Math.abs((c.tx ?? c.x) - c.x) + Math.abs((c.ty ?? c.y) - c.y);
  const moving = enemy
    ? targetDist > 0.03
    : !!hasActivePath || ((c.state === 'walk_to_work' || c.state === 'walk_to_deliver') && targetDist > 0.14);
  const stride = moving ? Math.sin(G.gameTick * 0.42 + (c.x + c.y) * 2.8) : 0;
  const bob = moving ? Math.abs(stride) * 0.45 * scale : 0;
  const dir = actorDir(c);

  ctx.save();
  drawActorGroundShadow(x, y, scale, moving, stride, dir, enemy);

  if (!atlas) {
    ctx.restore();
    return;
  }

  const variant = enemy ? 'miner' : actorVariant(c);
  const action = enemy ? (moving ? 'walk' : 'idle') : actorAction(c, moving);
  const variantIdx = Math.max(0, ACTOR_ATLAS.variants.indexOf(variant));
  const actionIdx = Math.max(0, ACTOR_ATLAS.actions.indexOf(action));
  const dirIdx = Math.max(0, ACTOR_ATLAS.dirs.indexOf(dir));
  const row = (variantIdx * ACTOR_ATLAS.actions.length + actionIdx) * ACTOR_ATLAS.dirs.length + dirIdx;
  const frameRate = action === 'idle' ? 18 : action === 'work' ? 7 : 8;
  const frame = action === 'idle'
    ? 0
    : Math.floor(G.gameTick / frameRate + (c.x + c.y) * 2) % ACTOR_ATLAS.frames;
  const h = Math.max(20, Math.round(42 * scale));
  const w = Math.round(h * (ACTOR_ATLAS.w / ACTOR_ATLAS.h));
  const dx = Math.round(x - w / 2);
  const dy = Math.round(y - h + 2 * scale - bob);
  if (enemy) ctx.filter = 'hue-rotate(135deg) saturate(0.85) brightness(0.75)';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(atlas, frame * ACTOR_ATLAS.w, row * ACTOR_ATLAS.h, ACTOR_ATLAS.w, ACTOR_ATLAS.h, dx, dy, w, h);
  ctx.restore();
}

function drawSelection() {
  const ht = G.hoveredTile;
  if (!ht || ht.x < 0 || ht.y < 0 || ht.x >= MAP_W || ht.y >= MAP_H) return;
  const p = projectTile(ht.x, ht.y);
  ctx.save();
  ctx.strokeStyle = G.selectedBuild ? '#ffd166' : 'rgba(255,255,255,0.42)';
  ctx.lineWidth = Math.max(1.5, p.scale * 1.4);
  ctx.globalAlpha = G.selectedBuild ? 0.92 : 0.45;
  pathDiamond(p, p.y - 1 * p.scale, 2 * p.scale);
  ctx.stroke();
  ctx.restore();
}

function visibleBounds() {
  const pad = 5;
  const corners = [
    screenToWorldRaw(0, 0),
    screenToWorldRaw(logicalW, 0),
    screenToWorldRaw(0, logicalH),
    screenToWorldRaw(logicalW, logicalH),
  ];
  return {
    minX: clamp(Math.floor(Math.min(...corners.map(c => c.x)) - pad), 0, MAP_W - 1),
    maxX: clamp(Math.ceil(Math.max(...corners.map(c => c.x)) + pad), 0, MAP_W - 1),
    minY: clamp(Math.floor(Math.min(...corners.map(c => c.y)) - pad), 0, MAP_H - 1),
    maxY: clamp(Math.ceil(Math.max(...corners.map(c => c.y)) + pad), 0, MAP_H - 1),
  };
}

function drawSky() {
  const t = (G.dayPhase ?? 0) / (G.dayLength ?? 3600);
  const daylight = getDaylight();
  const grad = ctx.createLinearGradient(0, 0, 0, logicalH);
  const dawn = Math.max(0, 1 - Math.abs(t - 0.15) * 6);
  const dusk = Math.max(0, 1 - Math.abs(t - 0.85) * 6);
  const top = dusk > dawn ? '#557192' : dawn > 0.15 ? '#7799aa' : '#6aa3c9';
  grad.addColorStop(0, daylight < 0.84 ? '#172641' : top);
  grad.addColorStop(1, daylight < 0.84 ? '#0b1224' : '#9ec9d9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#fff8dc';
  ctx.beginPath();
  ctx.ellipse(logicalW * 0.18, logicalH * 0.18, 120, 36, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function initGL3D(c) {
  canvas = c;
  ctx = canvas?.getContext('2d', { alpha: false });
  if (!canvas || !ctx) return false;
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.zIndex = '5';
  canvas.style.imageRendering = 'auto';
  resize3D();
  prewarmImages();
  return true;
}

export function resize3D() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  logicalW = window.innerWidth;
  logicalH = window.innerHeight;
  canvas.width = Math.round(logicalW * dpr);
  canvas.height = Math.round(logicalH * dpr);
  canvas.style.width = `${logicalW}px`;
  canvas.style.height = `${logicalH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function buildTerrainMesh() {
  prewarmImages();
}

export function buildBuildingsMesh() {
  prewarmImages();
}

export function render3D() {
  if (!ctx || !G.map || G.map.length === 0) return;
  prewarmImages();
  drawSky();

  const b = visibleBounds();
  const objects = [];
  for (let y = b.minY; y <= b.maxY; y++) {
    for (let x = b.minX; x <= b.maxX; x++) {
      drawTile(x, y, G.fog?.[y]?.[x] !== false);
      objects.push({ depth: x + y + 0.25, draw: () => drawTerrainDetail(x, y) });
    }
  }

  for (const building of G.buildings || []) {
    if (building.x < b.minX - 1 || building.x > b.maxX + 1 || building.y < b.minY - 1 || building.y > b.maxY + 1) continue;
    objects.push({ depth: building.x + building.y + 0.70, draw: () => drawBuilding(building) });
  }
  for (const c of G.citizens || []) {
    if (c.x < b.minX - 1 || c.x > b.maxX + 1 || c.y < b.minY - 1 || c.y > b.maxY + 1) continue;
    objects.push({ depth: c.x + c.y + 0.95, draw: () => drawActor(c, false) });
  }
  for (const e of G.enemies || []) {
    if (e.x < b.minX - 1 || e.x > b.maxX + 1 || e.y < b.minY - 1 || e.y > b.maxY + 1) continue;
    objects.push({ depth: e.x + e.y + 1.0, draw: () => drawActor(e, true) });
  }

  objects.sort((a, b2) => a.depth - b2.depth);
  for (const obj of objects) obj.draw();
  drawSelection();

  const daylight = getDaylight();
  if (daylight < 0.96) {
    ctx.save();
    ctx.globalAlpha = clamp((0.96 - daylight) * 0.85, 0, 0.32);
    ctx.fillStyle = '#081123';
    ctx.fillRect(0, 0, logicalW, logicalH);
    ctx.restore();
  }

  if (G.weather === 'rain' || G.weather === 'storm') {
    ctx.save();
    ctx.globalAlpha = G.weather === 'storm' ? 0.28 : 0.18;
    ctx.strokeStyle = '#c7ddff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = (hash2(i, G.gameTick, 3) % logicalW);
      const y = (hash2(i, G.gameTick, 9) % logicalH);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 18);
      ctx.stroke();
    }
    ctx.restore();
  }
}
