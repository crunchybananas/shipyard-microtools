// ════════════════════════════════════════════════════════════
// Renderer — isometric canvas, building sprites, minimap
// ════════════════════════════════════════════════════════════

import { G, TILE, TILE_COLORS, BUILDINGS, TW, TH, MAP_W, MAP_H, getSeasonData, getDaylight } from './state.js';

let C, ctx, minimapC, minimapCtx;
let logicalW, logicalH;

// ── FPS counter ───────────────────────────────────────────────
let fpsFrames = 0, fpsTime = 0, fpsDisplay = 0;
export let showFPS = false;
export function toggleFPS() { showFPS = !showFPS; }

// ── Performance caches ────────────────────────────────────────
// Fog-of-war gradient cache keyed by direction ('N'|'S'|'E'|'W')
// These are relative gradients that are re-applied via translate, so they
// can be shared. We store them keyed to a canonical tile position and
// invalidate when the map scrolls far enough (handled by always re-checking
// the logical tile position encoded in the key).
const fogGradCache = {};

// Night glow gradient cache — keyed by "type_glowR" since gradient shape is
// the same for all buildings of the same type; position is applied via ctx offset
const nightGlowCache = new Map();

export function initRenderer(canvas, minimap) {
  C = canvas;
  ctx = C.getContext('2d');
  minimapC = minimap;
  minimapCtx = minimap.getContext('2d');
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

export function render() {
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.save();
  const shake = G.cameraShake || 0;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(logicalW/2 + shakeX, logicalH/2 + shakeY);
  ctx.scale(G.camera.zoom, G.camera.zoom);
  ctx.translate(-G.camera.x, -G.camera.y);
  // Decay shake
  if (G.cameraShake > 0) G.cameraShake -= 0.5;

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
    ctx.globalAlpha = daylight;
  }

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

  const showDetails = G.camera.zoom >= 0.8;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!G.fog[y][x]) continue;
      const tile = G.map[y][x];
      const s = toScreen(x, y);
      const colors = TILE_COLORS[tile];
      let tileColor = colors[(x+y)%2];
      const seasonShift = getSeasonData().tileShift;

      // Water uses large-scale smooth noise — no per-tile checkerboard seams
      if (tile === TILE.WATER) {
        const n = (Math.sin(x * 0.3 + 0.7) + Math.cos(y * 0.4 + 0.5)) * 0.5 + 0.5;
        const tint = Math.floor(n * 20) - 10;
        tileColor = `rgb(${0x18 + tint}, ${0x52 + tint}, ${0xb8 + tint})`;
      }

      // Grass shade variation via position hash + season tint
      if (tile === TILE.GRASS || tile === TILE.SAND) {
        const h = ((x * 374761 + y * 668265) & 0xff) / 255;
        const shade = tile === TILE.GRASS
          ? (h < 0.25 ? '#3d8f45' : h < 0.5 ? '#4da854' : h < 0.75 ? '#45a04a' : '#55b558')
          : (h < 0.5 ? '#e8c07a' : '#ddb46e');
        tileColor = shiftColor(shade, seasonShift);
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

      // Atmospheric haze — outer edge tiles fade to pale blue-grey
      if (tile !== TILE.WATER) {
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

      // Tile texture — subtle noise pattern for visual richness
      // Only draw on every other tile (checkerboard) — halves draw calls with no perceptible loss
      if (tile !== TILE.WATER && (x + y) % 2 === 0) {
        ctx.globalAlpha = daylight * 0.08;
        for (let i = 0; i < 3; i++) {
          const nx = s.x + ((x * 7 + i * 13) % 20) - 10;
          const ny = s.y + ((y * 11 + i * 17) % 12) - 6;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
          ctx.fillRect(nx, ny, 1.5, 1);
        }
        ctx.globalAlpha = daylight;
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
        ctx.globalAlpha = daylight;
      }

      // Side faces — only for non-water tiles that have actual depth
      if (tileDepth > 0) {
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
          const foamPhase = (G.gameTick * 0.05 + x * 0.3 + y * 0.7) % (Math.PI * 2);
          const foamAlpha = 0.3 + 0.4 * Math.sin(foamPhase);
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
          ctx.globalAlpha = daylight * 0.5;
          ctx.fillRect(s.x - 4 + (lh%8), s.y - 2 + ((lh>>3)%5), 2, 1.5);
          ctx.globalAlpha = daylight;
        }
      }

      if (showDetails) {
      // Grass tufts and tiny flowers on grass tiles
      if (tile === TILE.GRASS && G.season !== 'winter') {
        const gh = ((x * 271 + y * 619) & 0xff);
        const sway = Math.sin(G.gameTick * 0.02 + x * 0.5 + y * 0.3) * 1.5;
        ctx.globalAlpha = daylight * 0.7;
        if (gh < 140) {
          ctx.fillStyle = G.season === 'autumn' ? '#8a9a50' : '#3a8a3a';
          const gx = s.x - 8 + (gh % 16) + sway, gy = s.y - 4 + ((gh >> 4) % 6);
          ctx.beginPath();
          ctx.moveTo(gx, gy); ctx.lineTo(gx - 1 + sway * 0.5, gy - 4); ctx.lineTo(gx + 1.5, gy - 3);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 3 + sway * 0.5, gy - 5); ctx.lineTo(gx + 5, gy - 1.5);
          ctx.fill();
          // Third blade for denser tufts
          if (gh < 80) {
            ctx.beginPath();
            ctx.moveTo(gx + 5, gy); ctx.lineTo(gx + 6 + sway * 0.3, gy - 4); ctx.lineTo(gx + 7.5, gy - 2);
            ctx.fill();
          }
        }
        if (G.season === 'spring' && gh > 192) {
          ctx.fillStyle = ['#f0a0c0','#ffe066','#a0c0f0'][gh % 3];
          ctx.globalAlpha = daylight * 0.8;
          const fx = s.x - 6 + (gh % 12) + sway * 0.5, fy = s.y - 2 + ((gh >> 3) % 5);
          ctx.beginPath();
          ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
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
          ctx.globalAlpha = daylight * 0.8;
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
          ctx.globalAlpha = daylight * 0.45;
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
            ctx.globalAlpha = daylight * 0.85;
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
        const mh = ((x * 37 + y * 53) & 0xff);
        // Height variation: 28-36px tall
        const peakH = 28 + (mh % 9);
        // Base shadow
        ctx.globalAlpha = daylight * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 5, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = daylight;

        // Back peak (taller, darker)
        const bx = s.x - 3, byTop = s.y - peakH - (mh % 4);
        ctx.fillStyle = '#5a5a6a';
        ctx.beginPath();
        ctx.moveTo(bx, byTop);
        ctx.lineTo(bx - 14, s.y + 4);
        ctx.lineTo(bx + 14, s.y + 2);
        ctx.closePath(); ctx.fill();

        // Rocky shadow strokes on back peak
        ctx.strokeStyle = 'rgba(20,20,30,0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bx - 3, byTop + 5); ctx.lineTo(bx - 8, s.y);
        ctx.moveTo(bx + 2, byTop + 8); ctx.lineTo(bx + 6, s.y - 2);
        ctx.stroke();

        // Snow cap on back peak
        ctx.fillStyle = 'rgba(240,245,255,0.92)';
        ctx.beginPath();
        ctx.moveTo(bx, byTop);
        ctx.lineTo(bx - 5, byTop + 9);
        ctx.lineTo(bx + 4, byTop + 8);
        ctx.closePath(); ctx.fill();

        // Front peak (shorter, lighter — main visible face)
        const fpeakH = peakH - 6;
        const fx = s.x + 4, fyTop = s.y - fpeakH - (mh % 3);
        ctx.fillStyle = '#7a7a88';
        ctx.beginPath();
        ctx.moveTo(fx, fyTop);
        ctx.lineTo(fx - 12, s.y + 4);
        ctx.lineTo(fx + 12, s.y + 4);
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
        ctx.lineTo(fx - 12, s.y + 4);
        ctx.lineTo(fx - 3, s.y + 4);
        ctx.lineTo(fx, fyTop + 8);
        ctx.closePath(); ctx.fill();

        // Snow cap on front peak (bigger, brighter)
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(fx, fyTop);
        ctx.lineTo(fx - 6, fyTop + 10);
        ctx.lineTo(fx + 5, fyTop + 9);
        ctx.closePath(); ctx.fill();

        // Snow detail lines dripping down
        ctx.fillStyle = 'rgba(240,245,255,0.6)';
        ctx.fillRect(fx - 4, fyTop + 8, 1, 3);
        ctx.fillRect(fx + 2, fyTop + 7, 1, 4);
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
  // Fog gradients only depend on direction (N/S/E/W) — cache 4 objects at the
  // tile origin (0,0), then use ctx.translate so the same gradient reuses every
  // edge tile. This replaces O(edge_tiles * 4) gradient allocations per frame
  // with just 4 cached gradients total.
  function getFogGrad(dir) {
    if (fogGradCache[dir]) return fogGradCache[dir];
    const hw = TW / 2, hh = TH / 2;
    let g;
    if (dir === 'N')      g = ctx.createLinearGradient(0, -hh, 0, 0);
    else if (dir === 'S') g = ctx.createLinearGradient(0, hh, 0, 0);
    else if (dir === 'W') g = ctx.createLinearGradient(-hw, 0, 0, 0);
    else                  g = ctx.createLinearGradient(hw, 0, 0, 0);
    g.addColorStop(0, 'rgba(10,14,26,0.72)');
    g.addColorStop(1, 'rgba(10,14,26,0)');
    fogGradCache[dir] = g;
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

  // ── Buildings ─────────────────────────────────────────────
  const sorted = [...G.buildings].sort((a,b) => (a.x+a.y)-(b.x+b.y));
  for (const b of sorted) {
    const s = toScreen(b.x, b.y);
    drawBuilding(ctx, b, s, daylight);
  }

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
    for (const c of G.citizens) {
      const cs = toScreen(c.x, c.y);
      // Convert mouse from world-tile to screen using camera transform
      const mx = G.hoveredTile.x, my = G.hoveredTile.y;
      const ms = toScreen(mx, my);
      const dx = cs.x - ms.x, dy = cs.y - ms.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestDist) { bestDist = d; hoveredCitizen = c; }
    }
  }

  for (const c of G.citizens) {
    const s = toScreen(c.x, c.y);
    ctx.globalAlpha = daylight;

    // Walking bob when moving — smooth sine, reduced amplitude
    const isMoving = c.path && c.pathIdx < (c.path?.length ?? 0);
    // Compact chibi-style citizen — big head, small body, subtle animation
    const bob = isMoving ? Math.sin(G.gameTick * 0.2 + c.x * 3) * 0.8 : 0;
    const cy = s.y + bob;

    // Facing direction (x = left/right, z = depth/forward-back in iso)
    let faceX = 0, faceZ = 0;
    if (c.path && c.pathIdx < (c.path?.length ?? 0)) {
      const wp = c.path[c.pathIdx];
      const fdx = wp.x - c.x;
      const fdy = wp.y - c.y;
      faceX = fdx > 0.1 ? 1 : fdx < -0.1 ? -1 : 0;
      faceZ = fdy > 0.1 ? 1 : fdy < -0.1 ? -1 : 0;
    } else if (Math.abs(c.tx - c.x) > 0.1) {
      faceX = c.tx > c.x ? 1 : -1;
    }
    // In iso: camera looks from upper-left, facing away = moving up-right (+X, -Y)
    const facingAway = faceX > 0 && faceZ < 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Job color
    let bodyColor = '#aab0b8';
    if (c.jobBuilding) {
      const jt = c.jobBuilding.type;
      if (jt === 'farm') bodyColor = '#6da835';
      else if (jt === 'lumber') bodyColor = '#a07040';
      else if (jt === 'quarry' || jt === 'mine') bodyColor = '#687888';
      else if (jt === 'market') bodyColor = '#d89530';
      else if (jt === 'barracks') bodyColor = '#5a6878';
      else if (jt === 'tavern') bodyColor = '#b06838';
      else bodyColor = '#7888a0';
    }
    if (c.state === 'eating') bodyColor = '#50c870';

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
      if (c === G.selectedCitizen) {
        const pulse = 0.5 + 0.4 * Math.sin(G.gameTick * 0.1);
        ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 4, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      continue;
    }

    // Feet — small ovals, subtle step offset when walking
    const step = isMoving ? Math.sin(G.gameTick * 0.25 + c.x * 3) * 1.5 : 0;
    ctx.fillStyle = '#4a3a2a';
    ctx.beginPath();
    ctx.ellipse(s.x - 2 - step * 0.3, cy - 1, 2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s.x + 2 + step * 0.3, cy - 1, 2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — rounded pill shape with shadow side
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(s.x, cy - 6, 4.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shadow side (lower-right crescent for depth)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(s.x + 1.5, cy - 5, 3.5, 4, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,0,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(s.x, cy - 6, 4.5, 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Head — large for chibi proportions (oversized head = cute)
    const headX = s.x + faceX * 0.5;
    const headY = cy - 14;
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(headX, headY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Hair — cap on top of head
    const hairHash = (c.name.charCodeAt(0) * 31 + c.name.charCodeAt(1)) % 4;
    ctx.fillStyle = ['#3a2a1a','#8a6a3a','#2a2a2a','#c08050'][hairHash];
    ctx.beginPath();
    ctx.arc(headX - faceX * 0.4, headY - 1, 4.2, Math.PI * 0.8, Math.PI * 2.2);
    ctx.closePath();
    ctx.fill();

    // Face — eyes and mouth on facing side, hidden when facing away
    if (!facingAway && G.camera.zoom >= 1.0) {
      const eyeX = headX + faceX * 0.8;
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.arc(eyeX - 1.2, headY + 0.5, 0.6, 0, Math.PI * 2);
      ctx.arc(eyeX + 1.2, headY + 0.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mouth — tiny line, only at closer zoom
    if (!facingAway && G.camera.zoom >= 1.5) {
      ctx.strokeStyle = 'rgba(80,50,30,0.7)';
      ctx.lineWidth = 0.5;
      const mouthX = headX + faceX * 0.5;
      ctx.beginPath();
      ctx.moveTo(mouthX - 0.8, headY + 1.5);
      ctx.lineTo(mouthX + 0.8, headY + 1.5);
      ctx.stroke();
    }

    if (G.camera.zoom >= 0.7) {
      // Tool icon when working
      if (c.state === 'working' && c.jobBuilding) {
        const jt = c.jobBuilding.type;
        const toolX = s.x + 6;
        const toolY = cy - 8;
        ctx.save();
        ctx.lineCap = 'round';
        if (jt === 'mine' || jt === 'quarry') {
          // Pickaxe: angled handle + cross-head
          ctx.translate(toolX, toolY);
          ctx.rotate(-0.4);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
          ctx.strokeStyle = '#aaa';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke();
        } else if (jt === 'lumber') {
          // Axe: handle + filled wedge head
          ctx.translate(toolX, toolY);
          ctx.rotate(0.3);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
          ctx.fillStyle = '#aaa';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2.5, -1); ctx.lineTo(1.5, 2); ctx.closePath(); ctx.fill();
        } else if (jt === 'farm') {
          // Scythe: handle + curved arc blade
          ctx.translate(toolX, toolY);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -1); ctx.stroke();
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(-1, -1, 2.5, 0, Math.PI * 0.9); ctx.stroke();
        } else {
          // Generic tool dot for other job types
          ctx.translate(toolX, toolY);
          ctx.fillStyle = '#ccc';
          ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // Emote bubble above head (suppress working emote — tool icon handles it)
      const emote = c.state==='idle' ? '💤' : c.state==='eating' ? '🍎' :
        c.state==='working' ? null : c.state==='foraging' ? '🌿' :
        (c.state==='walk_to_work'||c.state==='walk_to_deliver') ? '🚶' : null;
      if (emote && G.gameTick % 120 < 80) { // show emote 80 of every 120 ticks (flicker)
        ctx.globalAlpha = 0.75;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emote, s.x, cy - 20);
        ctx.globalAlpha = daylight;
      }

      // Carrying indicator (small colored dot on back, opposite from facing direction)
      if (c.carrying) {
        const cc = {wood:'#a3714f',stone:'#9ca3af',food:'#4ade80',gold:'#ffd166',iron:'#60a5fa'}[c.carrying] || '#fff';
        ctx.fillStyle = cc;
        ctx.beginPath();
        ctx.arc(s.x - faceX * 2.5, cy - 7, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    } // end zoom >= 0.7

    // Hover highlight ring
    if (c === hoveredCitizen) {
      ctx.strokeStyle = 'rgba(255,209,102,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, cy - 7, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Selected citizen highlight — pulsing ring
    if (c === G.selectedCitizen) {
      const pulse = 0.5 + 0.4 * Math.sin(G.gameTick * 0.1);
      ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, cy - 7, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── Service walkers ───────────────────────────────────────
  for (const w of G.walkers) {
    const ws = toScreen(w.x, w.y);
    ctx.globalAlpha = daylight;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(ws.x, ws.y + 2, 3, 1.5, 0, 0, Math.PI*2);
    ctx.fill();
    // Colored robe body
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.ellipse(ws.x, ws.y - 6, 4, 5, 0, 0, Math.PI*2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(ws.x, ws.y - 13, 3.5, 0, Math.PI*2);
    ctx.fill();
    // Small emoji on chest
    if (G.camera.zoom >= 1.2) {
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(w.emoji, ws.x, ws.y - 5);
    }
  }

  // ── Selected citizen path visualization ──────────────────
  if (G.selectedCitizen && G.selectedCitizen.path && G.selectedCitizen.pathIdx < G.selectedCitizen.path.length) {
    const c = G.selectedCitizen;
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = 'rgba(100,200,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const start = toScreen(c.x, c.y);
    ctx.moveTo(start.x, start.y);
    for (let i = c.pathIdx; i < c.path.length; i++) {
      const wp = c.path[i];
      const ws = toScreen(wp.x, wp.y);
      ctx.lineTo(ws.x, ws.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Destination marker
    if (c.path.length > 0) {
      const dest = c.path[c.path.length - 1];
      const ds = toScreen(dest.x, dest.y);
      ctx.fillStyle = 'rgba(100,200,255,0.5)';
      ctx.beginPath();
      ctx.arc(ds.x, ds.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = daylight;
  }

  // ── Soldiers ──────────────────────────────────────────────
  for (const s of G.soldiers) {
    const ss = toScreen(s.x, s.y);
    ctx.globalAlpha = daylight;
    if (G.camera.zoom < 0.6) {
      // Simple dot for far zoom
      ctx.fillStyle = '#5a6a7a';
      ctx.beginPath();
      ctx.arc(ss.x, ss.y - 4, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#c8383f';
      ctx.fillRect(ss.x - 1, ss.y - 7, 2, 2);
      continue;
    }
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(ss.x, ss.y + 2, 4, 2, 0, 0, Math.PI*2);
    ctx.fill();
    if (s.type === 'archer') {
      // Green tunic body
      ctx.fillStyle = '#4a6a2a';
      ctx.beginPath();
      ctx.ellipse(ss.x, ss.y - 6, 4.5, 5, 0, 0, Math.PI*2);
      ctx.fill();
      // Leather cap
      ctx.fillStyle = '#6a4a1a';
      ctx.beginPath();
      ctx.arc(ss.x, ss.y - 13, 4, 0, Math.PI*2);
      ctx.fill();
      // Bow on back
      ctx.strokeStyle = '#8a5a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ss.x - 3, ss.y - 9, 4, -0.5, 0.5);
      ctx.stroke();
    } else {
      // Swordsman — armored, darker metallic
      ctx.fillStyle = '#5a6a7a';
      ctx.beginPath();
      ctx.ellipse(ss.x, ss.y - 6, 4.5, 5, 0, 0, Math.PI*2);
      ctx.fill();
      // Helmet
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(ss.x, ss.y - 13, 4, 0, Math.PI*2);
      ctx.fill();
      // Sword on back
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ss.x - 3, ss.y - 14);
      ctx.lineTo(ss.x + 3, ss.y - 8);
      ctx.stroke();
      // Plume on helmet
      ctx.fillStyle = '#c8383f';
      ctx.beginPath();
      ctx.ellipse(ss.x, ss.y - 16, 1.5, 2, 0, 0, Math.PI*2);
      ctx.fill();
    }
    // HP bar when damaged
    if (s.hp < s.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ss.x - 5, ss.y - 20, 10, 2);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(ss.x - 5, ss.y - 20, 10 * (s.hp / s.maxHp), 2);
    }
  }

  // ── Rally point flag ──────────────────────────────────────
  if (G.rallyPoint) {
    const rs = toScreen(G.rallyPoint.x, G.rallyPoint.y);
    ctx.globalAlpha = 0.9;
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
    const hs = toScreen(hoveredCitizen.x, hoveredCitizen.y);
    const name = hoveredCitizen.name;
    const stateLabel = {
      idle:'Idle', find_job:'Looking for work', walk_to_work:'Going to work',
      working:'Working', walk_to_deliver:'Delivering', deliver:'Delivering',
      foraging:'Foraging', eating:'Eating',
    }[hoveredCitizen.state] || hoveredCitizen.state;
    const jobLabel = hoveredCitizen.jobBuilding ? BUILDINGS[hoveredCitizen.jobBuilding.type]?.name : null;
    const line2 = jobLabel ? `${stateLabel} · ${jobLabel}` : stateLabel;

    ctx.globalAlpha = 0.92;
    ctx.font = 'bold 10px -apple-system,sans-serif';
    const tw = Math.max(ctx.measureText(name).width, ctx.measureText(line2).width) + 12;
    const th = 28;
    const tx = hs.x - tw/2, ty = hs.y - 40;
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
    ctx.fillText(name, hs.x, ty + 11);
    // State
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px -apple-system,sans-serif';
    ctx.fillText(line2, hs.x, ty + 23);
    ctx.globalAlpha = 1;
  }

  // ── Caravans ──────────────────────────────────────────────
  for (const c of G.caravans) {
    // Dust trail behind caravan
    if (G.gameTick % 8 === 0) {
      G.particles.push({
        tx: c.x, ty: c.y, offsetY: -2,
        text: null, alpha: 0.4, vy: 0, decay: 0.02,
        type: 'dust', size: 2, vx: 0,
      });
    }

    const s = toScreen(c.x, c.y);
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

    // Direction arrow
    ctx.fillStyle = c.phase === 'outbound' ? 'rgba(255,100,100,0.5)' : 'rgba(100,255,100,0.5)';
    const angle = Math.atan2(c.ty - c.y, c.tx - c.x);
    ctx.save();
    ctx.translate(s.x, s.y + bob - 18);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(0, -2);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Enemies ───────────────────────────────────────────────
  for (const e of G.enemies) {
    const es = toScreen(e.x, e.y);
    ctx.globalAlpha = daylight;
    if (G.camera.zoom < 0.6) {
      ctx.fillStyle = '#4a2a2a';
      ctx.beginPath();
      ctx.arc(es.x, es.y - 4, 3, 0, Math.PI*2);
      ctx.fill();
      continue;
    }
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(es.x, es.y + 2, 4, 2, 0, 0, Math.PI*2);
    ctx.fill();
    // Dark body
    ctx.fillStyle = '#4a2a2a';
    ctx.beginPath();
    ctx.ellipse(es.x, es.y - 6, 4, 5, 0, 0, Math.PI*2);
    ctx.fill();
    // Dark hood/head
    ctx.fillStyle = '#2a1a1a';
    ctx.beginPath();
    ctx.arc(es.x, es.y - 13, 3.5, 0, Math.PI*2);
    ctx.fill();
    // Red eye glow
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(es.x - 1, es.y - 13, 0.6, 0, Math.PI*2);
    ctx.arc(es.x + 1, es.y - 13, 0.6, 0, Math.PI*2);
    ctx.fill();
    // HP bar
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(es.x - 6, es.y - 20, 12, 2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(es.x - 6, es.y - 20, 12 * (e.hp/e.maxHp), 2);
    }
  }

  // ── Projectiles (arrows) ───────────────────────────────────
  for (const p of G.projectiles) {
    const ps = toScreen(p.x, p.y);
    ctx.globalAlpha = daylight;
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 1.2;
    const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
    ctx.beginPath();
    ctx.moveTo(ps.x - Math.cos(angle) * 4, ps.y - Math.sin(angle) * 2);
    ctx.lineTo(ps.x + Math.cos(angle) * 4, ps.y + Math.sin(angle) * 2);
    ctx.stroke();
    // Arrowhead
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(ps.x + Math.cos(angle) * 4, ps.y + Math.sin(angle) * 2);
    ctx.lineTo(ps.x + Math.cos(angle) * 2 - Math.sin(angle), ps.y + Math.sin(angle) * 1 + Math.cos(angle));
    ctx.lineTo(ps.x + Math.cos(angle) * 2 + Math.sin(angle), ps.y + Math.sin(angle) * 1 - Math.cos(angle));
    ctx.closePath();
    ctx.fill();
  }

  // ── Particles ─────────────────────────────────────────────
  for (const p of G.particles) {
    const s = toScreen(p.tx, p.ty);
    // Skip particles whose screen-space position is outside the viewport
    // (toScreen returns world-space coords; add camera offset to get viewport coords)
    const psx = (s.x - G.camera.x) * G.camera.zoom + logicalW / 2;
    const psy = (s.y + (p.offsetY || 0) - G.camera.y) * G.camera.zoom + logicalH / 2;
    if (psx < -50 || psx > logicalW + 50 || psy < -50 || psy > logicalH + 50) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

    if (p.type === 'smoke') {
      const sz = p.size || 2;
      ctx.fillStyle = `rgba(180,180,200,${ctx.globalAlpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y + p.offsetY - 20, sz, 0, Math.PI * 2);
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
      const sz = p.size || 1.5;
      const drift = (p.vx || 0) * (G.gameTick % 60) * 0.08;
      ctx.fillStyle = p.color || '#ff8c00';
      ctx.beginPath();
      ctx.arc(s.x + drift, s.y + p.offsetY, sz, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'pollen') {
      ctx.fillStyle = `rgba(255, 240, 180, ${ctx.globalAlpha})`;
      ctx.beginPath();
      ctx.arc(s.x + Math.sin(G.gameTick * 0.02 + p.tx) * 4, s.y + p.offsetY, p.size, 0, Math.PI * 2);
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
    } else if (p.type === 'dustmote') {
      const twinkle = 0.5 + 0.5 * Math.sin(G.gameTick * 0.1 + p.phase);
      ctx.fillStyle = `rgba(255, 250, 200, ${ctx.globalAlpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y + p.offsetY, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const scale = 1 + (1 - (p.alpha / 1.5)) * 0.3;
      ctx.save();
      ctx.translate(psx, psy - 20);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ── Cloud shadows ─────────────────────────────────────────
  if (!G.clouds) {
    G.clouds = [
      { x: 100, y: 100, r: 180, vx: 0.15, alpha: 0.18 },
      { x: 400, y: 300, r: 220, vx: 0.12, alpha: 0.15 },
      { x: 700, y: 500, r: 160, vx: 0.18, alpha: 0.22 },
      { x: 1000, y: 800, r: 200, vx: 0.14, alpha: 0.16 },
    ];
  }
  if (daylight > 0.5) {
    for (const cloud of G.clouds) {
      cloud.x += cloud.vx * G.speed;
      if (cloud.x > 3000) cloud.x = -500;
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

    // Render actual building sprite as ghost
    const ghostBuilding = { type: G.selectedBuild, level: 1, workers: [], hp: 100, maxHp: 100 };
    drawBuilding(ctx, ghostBuilding, s, valid ? 0.45 : 0.25);
    ctx.globalAlpha = daylight;
  }

  // Night overlay — multiply-blend so it darkens without washing out color
  if (daylight < 0.95) {
    const darkness = (1 - daylight);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    // Blue-tinted dark multiply overlay
    const tintR = Math.round(255 - darkness * 180);
    const tintG = Math.round(255 - darkness * 170);
    const tintB = Math.round(255 - darkness * 110);
    ctx.fillStyle = `rgb(${tintR},${tintG},${tintB})`;
    ctx.fillRect(-5000, -5000, 10000, 10000);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Sunset/sunrise horizon glow (dawn: t<0.1, dusk: t 0.6–0.75)
  const dayT = G.dayPhase / G.dayLength;
  let horizonAlpha = 0;
  let horizonColor = '255,120,60';
  if (dayT < 0.1) {
    // Dawn: fade in then out quickly
    horizonAlpha = Math.sin((dayT / 0.1) * Math.PI) * 0.55;
    horizonColor = '255,140,60'; // warm orange-gold dawn
  } else if (dayT >= 0.6 && dayT < 0.75) {
    // Dusk: fade in then out
    horizonAlpha = Math.sin(((dayT - 0.6) / 0.15) * Math.PI) * 0.65;
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

  // ── Birds (screen space, fly across sky during day) ──────────
  if (G.birds && G.birds.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    for (let i = G.birds.length - 1; i >= 0; i--) {
      const b = G.birds[i];
      b.x += b.vx;
      if (b.x > logicalW + 50) { G.birds.splice(i, 1); continue; }
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

  // ── Rain overlay (screen space) ───────────────────────────────
  if (G.weather === 'rain' && G.camera.zoom >= 0.6) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#8ab4e0';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 80; i++) {
      const rx = (i * 37 + G.gameTick * 8) % (logicalW + 100) - 50;
      const ry = (i * 53 + G.gameTick * 12) % (logicalH + 100) - 50;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 2, ry + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Raid flash overlay (screen space) ────────────────────────
  if (G.raidFlash > 0) {
    ctx.globalAlpha = G.raidFlash * 0.45;
    ctx.fillStyle = 'rgba(220,30,30,1)';
    ctx.fillRect(0, 0, logicalW, logicalH);
    ctx.globalAlpha = 1;
    G.raidFlash = Math.max(0, G.raidFlash - 0.018);
  }

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

  // Screen-space vignette removed — handled by WebGL post-processing (postfx.js)

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

  // ── Minimap ───────────────────────────────────────────────
  renderMinimap();

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
function drawBuilding(ctx, b, s, daylight) {
  const def = BUILDINGS[b.type];
  const buildAlpha = (b.buildProgress !== undefined && b.buildProgress < 1) ? b.buildProgress : 1;
  // Keep buildings fully opaque — night overlay darkens them later
  ctx.globalAlpha = buildAlpha;

  // Foundation — darken the tile under the building for grounding
  if (b.type !== 'road' && b.type !== 'wall' && b.type !== 'farm') {
    const hw = TW/2, hh = TH/2;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x - hw, s.y);
    ctx.closePath();
    ctx.fill();
    // Worn grass ring — subtle brown tint under buildings at normal+ zoom
    if (b.type !== 'fisherman' && G.camera && G.camera.zoom >= 1.0) {
      ctx.fillStyle = 'rgba(80, 60, 40, 0.12)';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2 + 1);
      ctx.lineTo(s.x + TW/2 - 1, s.y);
      ctx.lineTo(s.x, s.y + TH/2 - 1);
      ctx.lineTo(s.x - TW/2 + 1, s.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // AO contact ring — always at base, grounds the building visually
  if (b.type !== 'road' && b.type !== 'wall') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Long directional shadow — proper isometric cast shadow
  if (b.type !== 'road' && b.type !== 'wall') {
    const buildingH = (b.type === 'castle' || b.type === 'church' || b.type === 'tower') ? 32 :
                      (b.type === 'house' || b.type === 'tavern' || b.type === 'barracks' || b.type === 'bakery') ? 20 : 12;
    // Shadow length = building height projected at light angle
    const shadowLen = buildingH * 0.8;
    // Create a slanted quadrilateral shadow shape
    ctx.globalAlpha = daylight * 0.3;
    ctx.fillStyle = '#1a1010';
    ctx.beginPath();
    // Base of building (4 corners of foundation)
    ctx.moveTo(s.x - 10, s.y + 2);
    ctx.lineTo(s.x + 10, s.y + 2);
    // Shadow tip (projected to lower-right)
    ctx.lineTo(s.x + 10 + shadowLen, s.y + 2 + shadowLen * 0.5);
    ctx.lineTo(s.x - 10 + shadowLen, s.y + 2 + shadowLen * 0.5);
    ctx.closePath();
    // Use radial gradient for soft fade
    const shadowGrad = ctx.createRadialGradient(s.x, s.y + 2, 5, s.x + shadowLen, s.y + 2 + shadowLen * 0.5, shadowLen);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
    shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Ground the sprite: scale from tile-center anchor so buildings grow UP
  // from the ground (not out in all directions), then shift down 4px to
  // place sprite base at visual ground level (tile center in iso).
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(1.1, 1.1);
  ctx.translate(-s.x, -s.y + 3);

  switch (b.type) {
    case 'house': drawHouse(ctx, s); break;
    case 'farm': drawFarm(ctx, s); break;
    case 'lumber': drawLumber(ctx, s); break;
    case 'quarry': drawQuarry(ctx, s); break;
    case 'mine': drawMine(ctx, s); break;
    case 'market': drawMarket(ctx, s); break;
    case 'barracks': drawBarracks(ctx, s); break;
    case 'archery': drawArchery(ctx, s); break;
    case 'tower': drawTower(ctx, s); break;
    case 'well': drawWell(ctx, s); break;
    case 'tavern': drawTavern(ctx, s); break;
    case 'wall': drawWall(ctx, s, b); break;
    case 'road': drawRoad(ctx, s); break;
    case 'tradingpost': drawTradingPost(ctx, s, b); break;
    case 'castle': drawCastle(ctx, s); break;
    case 'granary': drawGranary(ctx, s); break;
    case 'church': drawChurch(ctx, s); break;
    case 'school': drawSchool(ctx, s); break;
    case 'windmill': drawWindmill(ctx, s, b); break;
    case 'bakery': drawBakery(ctx, s); break;
    case 'chickencoop': drawChickenCoop(ctx, s); break;
    case 'cowpen': drawCowPen(ctx, s); break;
    case 'fisherman': drawFisherman(ctx, s); break;
    case 'blacksmith': drawBlacksmith(ctx, s); break;
    default: drawGeneric(ctx, s, def); break;
  }
  ctx.restore(); // undo the 1.3x scale

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
    // Snow cap on roofs in winter
    if (G.season === 'winter' && b.type !== 'road' && b.type !== 'wall' && b.type !== 'farm' && b.type !== 'quarry') {
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      // Snow sits on top of the building — approximate roof peak
      const snowY = b.type === 'tower' ? s.y - 38 : b.type === 'church' ? s.y - 42 : s.y - 28;
      const snowW = b.type === 'tower' ? 8 : b.type === 'church' ? 10 : 14;
      ctx.beginPath();
      ctx.ellipse(s.x, snowY, snowW, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Icicles
      ctx.fillStyle = 'rgba(200,220,255,0.6)';
      for (let i = -snowW + 3; i < snowW; i += 4) {
        ctx.fillRect(s.x + i, snowY + 1, 1, 2 + Math.abs(i % 3));
      }
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
      // Bright window dots
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
    const needed = def.workers || 0;
    if (needed > 0) {
      const have = b.workers.length;
      const full = have >= needed;
      ctx.globalAlpha = 0.85;
      ctx.font = '8px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = full ? 'rgba(74,222,128,0.9)' : 'rgba(251,191,36,0.9)';
      const wy = b.type === 'tower' ? s.y - 48 : b.type === 'church' ? s.y - 50 : b.type === 'castle' ? s.y - 54 : s.y - 38;
      ctx.fillText(`${have}/${needed}👤`, s.x, wy);
      ctx.globalAlpha = 1;
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

function drawHouse(ctx, s) {
  // Walls — gradient for depth
  const wallGrad = ctx.createLinearGradient(s.x, s.y-20, s.x, s.y-4);
  wallGrad.addColorStop(0, '#d4a068');
  wallGrad.addColorStop(1, '#b8844c');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x-9, s.y-20, 18, 16);
  // Highlight along top edge of wall
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-9, s.y-20); ctx.lineTo(s.x+9, s.y-20); ctx.stroke();
  // Side wall (iso depth — keep flat, it's in shadow)
  ctx.fillStyle = '#a87c4e';
  ctx.beginPath();
  ctx.moveTo(s.x+9, s.y-20); ctx.lineTo(s.x+14, s.y-17);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+9, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Roof — gradient for shininess
  const roofGrad = ctx.createLinearGradient(s.x, s.y-32, s.x, s.y-20);
  roofGrad.addColorStop(0, '#d44030');
  roofGrad.addColorStop(1, '#a02820');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(s.x-12, s.y-20); ctx.lineTo(s.x, s.y-32);
  ctx.lineTo(s.x+12, s.y-20); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a02e23';
  ctx.beginPath();
  ctx.moveTo(s.x+12, s.y-20); ctx.lineTo(s.x, s.y-32);
  ctx.lineTo(s.x+5, s.y-29); ctx.lineTo(s.x+16, s.y-17);
  ctx.closePath();
  ctx.fill();
  // Subtle warm glow on lower wall (interior light leaking out)
  const warmGlow = ctx.createLinearGradient(s.x, s.y - 8, s.x, s.y - 4);
  warmGlow.addColorStop(0, 'rgba(255, 220, 150, 0)');
  warmGlow.addColorStop(1, 'rgba(255, 200, 120, 0.15)');
  ctx.fillStyle = warmGlow;
  ctx.fillRect(s.x - 9, s.y - 8, 18, 4);
  // Door
  ctx.fillStyle = '#4a2a12';
  ctx.fillRect(s.x-3, s.y-10, 6, 6);
  // Doorstep — darker stone step
  ctx.fillStyle = 'rgba(50, 45, 40, 0.6)';
  ctx.fillRect(s.x - 4, s.y - 4, 8, 2);
  // Window
  ctx.fillStyle = '#ffeebb';
  ctx.fillRect(s.x+4, s.y-18, 3, 3);
  // Chimney
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(s.x+5, s.y-35, 4, 8);
}

function drawFarm(ctx, s) {
  // --- Ground base — flat tilled earth diamond ---
  ctx.fillStyle = '#3d2408';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - TH/2 + 2);
  ctx.lineTo(s.x + TW/2 - 2, s.y);
  ctx.lineTo(s.x, s.y + TH/2 - 2);
  ctx.lineTo(s.x - TW/2 + 2, s.y);
  ctx.closePath();
  ctx.fill();

  // --- Plowed soil rows — alternating dark furrows ---
  const rowColors = ['#2a1705', '#3d2408', '#4a2d0a'];
  for (let row = -3; row <= 3; row++) {
    const ry = s.y + row * 2.8;
    const halfW = 14 - Math.abs(row) * 1.5;
    ctx.fillStyle = rowColors[(row + 3) % 3];
    ctx.fillRect(s.x - halfW, ry - 1, halfW * 2, 1.8);
  }

  // --- Irrigation channel — right side, blue-grey strip ---
  ctx.strokeStyle = '#4a7a9b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x + 8, s.y - 8);
  ctx.lineTo(s.x + 14, s.y - 2);
  ctx.lineTo(s.x + 10, s.y + 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,190,230,0.5)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(s.x + 9, s.y - 6);
  ctx.lineTo(s.x + 13, s.y - 1);
  ctx.stroke();

  // --- Crops: alternate green (growing) and golden (ripe) columns ---
  const cropCols = [-10, -5, 0, 5];
  for (let ci = 0; ci < cropCols.length; ci++) {
    const cx = s.x + cropCols[ci];
    const isRipe = ci % 2 === 1;
    ctx.strokeStyle = isRipe ? '#8b7020' : '#3a7a10';
    ctx.lineWidth = 1;
    for (let row = -3; row <= 2; row++) {
      const cy = s.y + row * 2.8;
      const stemIdx = ci * 6 + (row + 3);
      const sway = Math.sin((G.gameTick || 0) * 0.05 + stemIdx * 0.3) * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 1);
      ctx.lineTo(cx + sway, cy - 3);
      ctx.stroke();
      if (isRipe) {
        ctx.fillStyle = '#d4a017';
        ctx.fillRect(cx - 1 + sway, cy - 5, 2, 2);
        ctx.fillStyle = '#c8901a';
        ctx.fillRect(cx - 1 + sway * 0.5, cy - 3, 2, 1);
      } else {
        ctx.fillStyle = '#4db820';
        ctx.fillRect(cx - 2 + sway, cy - 5, 4, 2);
        ctx.fillStyle = '#3aaa10';
        ctx.fillRect(cx - 1 + sway * 0.5, cy - 3, 2, 1);
      }
    }
  }

  // --- Fence — posts with two connected horizontal rails ---
  const postXL = s.x - 16, postXR = s.x + 14;
  const postYTop = s.y - 10, postYBot = s.y + 2;
  ctx.strokeStyle = '#7a4e0e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(postXL, postYTop - 3);
  ctx.lineTo(postXR, postYTop - 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(postXL, postYBot - 1);
  ctx.lineTo(postXR, postYBot - 1);
  ctx.stroke();
  const fencePosts = [
    [postXL, postYTop], [postXL + 9, postYTop - 2],
    [postXR - 9, postYTop - 2], [postXR, postYTop],
  ];
  for (const [px, py] of fencePosts) {
    ctx.fillStyle = '#8a5518';
    ctx.fillRect(px - 1, py - 9, 2.5, 1.5);
    ctx.fillStyle = '#6b3f0b';
    ctx.fillRect(px - 1, py - 8, 2.5, 10);
  }

  // --- Scarecrow in back-left corner ---
  const scx = s.x - 11, scy = s.y - 10;
  ctx.strokeStyle = '#5a3808';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(scx, scy + 4); ctx.lineTo(scx, scy - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(scx - 4, scy - 3); ctx.lineTo(scx + 4, scy - 3); ctx.stroke();
  ctx.fillStyle = 'rgba(160,110,60,0.75)';
  ctx.beginPath();
  ctx.moveTo(scx - 4, scy - 3); ctx.lineTo(scx + 4, scy - 3);
  ctx.lineTo(scx, scy + 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d4a87a';
  ctx.beginPath(); ctx.arc(scx, scy - 9, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#5a3808';
  ctx.fillRect(scx - 3, scy - 11, 6, 1.5);
  ctx.fillRect(scx - 1.5, scy - 14, 3, 3);
}

function drawLumber(ctx, s) {
  // Front wall — wood-plank gradient (light top, darker bottom)
  const wallGrad = ctx.createLinearGradient(s.x-10, s.y-18, s.x-10, s.y-4);
  wallGrad.addColorStop(0, '#b8865c');
  wallGrad.addColorStop(1, '#7a5535');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x-10, s.y-18, 20, 14);
  // Horizontal plank lines
  ctx.strokeStyle = 'rgba(60,35,10,0.35)';
  ctx.lineWidth = 0.7;
  for (let py = -14; py <= -6; py += 4) {
    ctx.beginPath(); ctx.moveTo(s.x-10, s.y+py); ctx.lineTo(s.x+10, s.y+py); ctx.stroke();
  }
  // Side face (right)
  const sideGrad = ctx.createLinearGradient(s.x+10, s.y-18, s.x+14, s.y-4);
  sideGrad.addColorStop(0, '#8a6040');
  sideGrad.addColorStop(1, '#5a3820');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(s.x+10, s.y-18); ctx.lineTo(s.x+14, s.y-15);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+10, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Roof (dark shingles)
  const roofGrad = ctx.createLinearGradient(s.x, s.y-26, s.x, s.y-18);
  roofGrad.addColorStop(0, '#4a3828');
  roofGrad.addColorStop(1, '#6a5040');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(s.x-13, s.y-18); ctx.lineTo(s.x, s.y-26);
  ctx.lineTo(s.x+13, s.y-18); ctx.closePath();
  ctx.fill();
  // Roof ridge line
  ctx.strokeStyle = '#3a2818'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s.x-13, s.y-18); ctx.lineTo(s.x, s.y-26); ctx.lineTo(s.x+13, s.y-18); ctx.stroke();
  // Small chimney (sawdust exhaust)
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(s.x+2, s.y-31, 4, 7);
  // Smoke puffs from chimney
  ctx.fillStyle = 'rgba(200,190,175,0.55)';
  ctx.beginPath(); ctx.arc(s.x+4, s.y-33, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(200,190,175,0.35)';
  ctx.beginPath(); ctx.arc(s.x+6, s.y-36, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(200,190,175,0.2)';
  ctx.beginPath(); ctx.arc(s.x+5, s.y-39, 1.5, 0, Math.PI*2); ctx.fill();
  // Door
  ctx.fillStyle = '#3a2510';
  ctx.fillRect(s.x-2, s.y-12, 4, 6);
  // Log pile (left side) — stacked cylinders with end-grain rings
  const logColors = ['#c4844e', '#b07040', '#a06030'];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const lx = s.x-18 + col*5;
      const ly = s.y - 3 - row*4;
      ctx.fillStyle = logColors[col % 3];
      ctx.beginPath(); ctx.ellipse(lx, ly, 3, 2, 0, 0, Math.PI*2); ctx.fill();
      // End-grain ring
      ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(lx, ly, 1.5, 1, 0, 0, Math.PI*2); ctx.stroke();
    }
  }
  // Axe prop — handle + blade leaning against wall
  ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(s.x+13, s.y-4); ctx.lineTo(s.x+16, s.y-14); ctx.stroke();
  ctx.fillStyle = '#8a9aaa';
  ctx.beginPath();
  ctx.moveTo(s.x+16, s.y-14); ctx.lineTo(s.x+19, s.y-17); ctx.lineTo(s.x+19, s.y-12); ctx.closePath();
  ctx.fill();
  // Sawdust scatter around base
  ctx.fillStyle = 'rgba(210,165,90,0.6)';
  const dustSpots = [[-8,1],[-5,2],[-3,1],[3,2],[6,1],[9,2],[-10,3]];
  for (const [dx,dy] of dustSpots) {
    ctx.beginPath(); ctx.arc(s.x+dx, s.y+dy, 1.2, 0, Math.PI*2); ctx.fill();
  }
}

function drawQuarry(ctx, s) {
  // === Open-pit stone quarry — concave terraced excavation ===

  // --- Outermost rim: ground-level stone surround ---
  ctx.fillStyle = '#7a7870';
  ctx.beginPath();
  ctx.moveTo(s.x,        s.y - TH/2 + 1);
  ctx.lineTo(s.x + TW/2 - 2, s.y);
  ctx.lineTo(s.x,        s.y + TH/2 - 1);
  ctx.lineTo(s.x - TW/2 + 2, s.y);
  ctx.closePath();
  ctx.fill();

  // --- Terrace level 1 (outermost step) — medium grey stone ---
  ctx.fillStyle = '#626058';
  ctx.beginPath();
  ctx.moveTo(s.x,      s.y - 11);
  ctx.lineTo(s.x + 20, s.y - 2);
  ctx.lineTo(s.x,      s.y + 9);
  ctx.lineTo(s.x - 20, s.y - 2);
  ctx.closePath();
  ctx.fill();

  // --- Terrace level 2 (mid step) — darker stone, deeper in ---
  ctx.fillStyle = '#4e4c46';
  ctx.beginPath();
  ctx.moveTo(s.x,      s.y - 7);
  ctx.lineTo(s.x + 13, s.y - 1);
  ctx.lineTo(s.x,      s.y + 5);
  ctx.lineTo(s.x - 13, s.y - 1);
  ctx.closePath();
  ctx.fill();

  // --- Pit floor (deepest level) — near-black stone with slight blue tint ---
  const pitFloor = ctx.createRadialGradient(s.x, s.y - 1, 1, s.x, s.y - 1, 8);
  pitFloor.addColorStop(0, '#2a2826');
  pitFloor.addColorStop(1, '#1a1816');
  ctx.fillStyle = pitFloor;
  ctx.beginPath();
  ctx.moveTo(s.x,     s.y - 4);
  ctx.lineTo(s.x + 7, s.y - 0);
  ctx.lineTo(s.x,     s.y + 3);
  ctx.lineTo(s.x - 7, s.y - 0);
  ctx.closePath();
  ctx.fill();

  // --- Terrace ledge lines — step edges with highlights ---
  ctx.strokeStyle = 'rgba(200,195,185,0.45)';
  ctx.lineWidth = 0.8;
  // Outer ledge highlight
  ctx.beginPath();
  ctx.moveTo(s.x - 20, s.y - 2);
  ctx.lineTo(s.x, s.y - 11);
  ctx.lineTo(s.x + 20, s.y - 2);
  ctx.stroke();
  // Mid ledge highlight
  ctx.strokeStyle = 'rgba(180,175,165,0.35)';
  ctx.beginPath();
  ctx.moveTo(s.x - 13, s.y - 1);
  ctx.lineTo(s.x, s.y - 7);
  ctx.lineTo(s.x + 13, s.y - 1);
  ctx.stroke();
  // Shadow under ledges (south sides)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s.x - 20, s.y - 2);
  ctx.lineTo(s.x, s.y + 9);
  ctx.lineTo(s.x + 20, s.y - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.x - 13, s.y - 1);
  ctx.lineTo(s.x, s.y + 5);
  ctx.lineTo(s.x + 13, s.y - 1);
  ctx.stroke();

  // --- Stone blocks stacked on the rim (top-right, ready for transport) ---
  const blockColors = ['#8a8878', '#7a786a', '#9a9888'];
  const blockPositions = [[14, -9], [19, -6], [14, -5], [22, -9]];
  for (let bi = 0; bi < blockPositions.length; bi++) {
    const [bx, by] = blockPositions[bi];
    ctx.fillStyle = blockColors[bi % 3];
    ctx.fillRect(s.x + bx, s.y + by, 5, 3);
    // Top face (lighter)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(s.x + bx, s.y + by, 5, 1);
    // Shadow edge
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s.x + bx + 4, s.y + by, 1, 3);
  }

  // --- Rubble and stone chips scattered on outer rim ---
  const chipData = [
    [-18, -6, 2.5, 1.5, 0.2],
    [-14, -8, 2, 1.2, -0.3],
    [-8, -12, 3, 1.8, 0.5],
    [6, -12, 2, 1.3, 0.1],
    [10, -10, 2.5, 1.5, -0.2],
    [-16, 3, 2, 1.2, 0.4],
    [12, 2, 2.5, 1.6, -0.1],
    [-4, -14, 1.8, 1, 0.3],
  ];
  const chipColors = ['#8a8878', '#7a786a', '#6a6860', '#9a9888'];
  for (let ci = 0; ci < chipData.length; ci++) {
    const [cx, cy, rx, ry, rot] = chipData[ci];
    ctx.fillStyle = chipColors[ci % 4];
    ctx.beginPath();
    ctx.ellipse(s.x + cx, s.y + cy, rx, ry, rot, 0, Math.PI*2);
    ctx.fill();
  }

  // --- Wooden derrick / crane frame (left rim) ---
  // Two angled legs forming an A-frame
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(s.x - 22, s.y - 1);   // left foot
  ctx.lineTo(s.x - 14, s.y - 18);  // apex
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.x - 8,  s.y - 7);   // right foot (on rim)
  ctx.lineTo(s.x - 14, s.y - 18);  // apex
  ctx.stroke();
  // Cross brace
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x - 20, s.y - 8);
  ctx.lineTo(s.x - 10, s.y - 10);
  ctx.stroke();
  // Boom arm extending over the pit
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y - 18);
  ctx.lineTo(s.x - 4,  s.y - 20);  // boom tip
  ctx.stroke();
  // Rope hanging from boom tip
  ctx.strokeStyle = '#c8a870';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(s.x - 4, s.y - 20);
  ctx.lineTo(s.x - 4, s.y - 10);
  ctx.stroke();
  // Hook at rope end
  ctx.strokeStyle = '#5a5a6a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(s.x - 4, s.y - 9, 1.5, 0, Math.PI);
  ctx.stroke();
}

function drawMine(ctx, s) {
  // Rock face — gradient from light grey top to dark base
  const rockGrad = ctx.createLinearGradient(s.x-12, s.y-20, s.x-12, s.y-4);
  rockGrad.addColorStop(0, '#8a8a9a');
  rockGrad.addColorStop(1, '#4a4a58');
  ctx.fillStyle = rockGrad;
  ctx.fillRect(s.x-12, s.y-20, 24, 16);
  // Side face (right) — darker rock
  ctx.fillStyle = '#3e3e4e';
  ctx.beginPath();
  ctx.moveTo(s.x+12, s.y-20); ctx.lineTo(s.x+16, s.y-17);
  ctx.lineTo(s.x+16, s.y-4); ctx.lineTo(s.x+12, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Rock texture cracks on front face
  ctx.strokeStyle = 'rgba(30,30,40,0.4)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(s.x-8, s.y-20); ctx.lineTo(s.x-6, s.y-16); ctx.lineTo(s.x-9, s.y-13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x+5, s.y-19); ctx.lineTo(s.x+8, s.y-15); ctx.stroke();
  // Dark tunnel interior — radial gradient for depth
  const tunnelGrad = ctx.createRadialGradient(s.x, s.y-8, 1, s.x, s.y-8, 7);
  tunnelGrad.addColorStop(0, '#1a1a22');
  tunnelGrad.addColorStop(1, '#0a0a10');
  ctx.fillStyle = tunnelGrad;
  ctx.beginPath();
  ctx.arc(s.x, s.y-8, 7, Math.PI, 0);
  ctx.lineTo(s.x+7, s.y-4); ctx.lineTo(s.x-7, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Wooden support beams — frame around entrance
  ctx.fillStyle = '#7a5530';
  ctx.fillRect(s.x-8, s.y-16, 2.5, 12);   // left post
  ctx.fillRect(s.x+5, s.y-16, 2.5, 12);   // right post
  ctx.fillRect(s.x-8, s.y-17, 15, 2.5);   // lintel
  // Beam grain lines
  ctx.strokeStyle = 'rgba(40,20,5,0.4)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-7.5, s.y-15); ctx.lineTo(s.x-7.5, s.y-5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x+6.5, s.y-15); ctx.lineTo(s.x+6.5, s.y-5); ctx.stroke();
  // Lantern — small yellow glow near entrance
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(s.x-10, s.y-10, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,80,0.3)';
  ctx.beginPath(); ctx.arc(s.x-10, s.y-10, 4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 0.8;
  ctx.strokeRect(s.x-11, s.y-11, 2, 2);
  // Mine cart on short track (right of entrance)
  // Track rails
  ctx.strokeStyle = '#6a6a7a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s.x+8, s.y-3); ctx.lineTo(s.x+20, s.y-3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x+8, s.y-1); ctx.lineTo(s.x+20, s.y-1); ctx.stroke();
  // Tie crossbars
  ctx.lineWidth = 0.5;
  for (let tx = 9; tx < 20; tx += 3) {
    ctx.beginPath(); ctx.moveTo(s.x+tx, s.y-4); ctx.lineTo(s.x+tx, s.y); ctx.stroke();
  }
  // Cart body
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(s.x+12, s.y-8, 8, 5);
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(s.x+12, s.y-4, 8, 1);
  // Cart wheels
  ctx.fillStyle = '#2a2a32';
  ctx.beginPath(); ctx.arc(s.x+14, s.y-3, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(s.x+18, s.y-3, 1.5, 0, Math.PI*2); ctx.fill();
  // Ore pile beside entrance (left) — blue-grey stones
  const oreColors = ['#7a8a9a', '#6a7a8a', '#5a6a7a', '#8a9aaa'];
  const orePos = [[-20,-2],[-17,-4],[-22,-4],[-19,-6],[-16,-2]];
  for (let oi = 0; oi < orePos.length; oi++) {
    ctx.fillStyle = oreColors[oi % oreColors.length];
    ctx.beginPath(); ctx.ellipse(s.x+orePos[oi][0], s.y+orePos[oi][1], 3, 2, 0.3, 0, Math.PI*2); ctx.fill();
  }
}

function drawMarket(ctx, s) {
  // Counter
  ctx.fillStyle = '#c89460';
  ctx.fillRect(s.x-12, s.y-8, 24, 6);
  // Awning — subtle top-to-bottom gradient
  const awningGrad = ctx.createLinearGradient(s.x, s.y-20, s.x, s.y-8);
  awningGrad.addColorStop(0, '#f05545');
  awningGrad.addColorStop(1, '#c0302090');
  ctx.fillStyle = awningGrad;
  ctx.beginPath();
  ctx.moveTo(s.x-14, s.y-20); ctx.lineTo(s.x+14, s.y-20);
  ctx.lineTo(s.x+16, s.y-8); ctx.lineTo(s.x-16, s.y-8);
  ctx.closePath();
  ctx.fill();
  // Highlight along top edge of awning
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-14, s.y-20); ctx.lineTo(s.x+14, s.y-20); ctx.stroke();
  // Stripes
  ctx.fillStyle = '#fff';
  for (let i = -12; i < 14; i += 6) {
    ctx.beginPath();
    ctx.moveTo(s.x+i, s.y-20); ctx.lineTo(s.x+i+3, s.y-20);
    ctx.lineTo(s.x+i+4, s.y-8); ctx.lineTo(s.x+i+1, s.y-8);
    ctx.closePath();
    ctx.fill();
  }
  // Counter shelf edge highlight
  ctx.fillStyle = '#a07040';
  ctx.fillRect(s.x-12, s.y-9, 24, 1);
  // Goods on counter
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(s.x-6, s.y-12, 4, 3);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(s.x+2, s.y-12, 4, 3);
  // Extra awning stripe detail (thin red border along bottom edge)
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(s.x-16, s.y-9, 32, 1);
  // Barrel prop beside stall (left side)
  ctx.fillStyle = '#8b6a4e';
  ctx.beginPath();
  ctx.arc(s.x-15, s.y-5, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#6a5040';
  ctx.fillRect(s.x-18, s.y-6, 6, 1);
  ctx.fillRect(s.x-18, s.y-4, 6, 1);
  // Small crate prop (right side)
  ctx.fillStyle = '#a3714f';
  ctx.fillRect(s.x+12, s.y-8, 5, 4);
  ctx.strokeStyle = '#6a5040';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(s.x+12, s.y-8, 5, 4);
}

function drawBarracks(ctx, s) {
  // --- Isometric side face (right) ---
  const sideGrad = ctx.createLinearGradient(s.x+12, s.y-22, s.x+12, s.y-2);
  sideGrad.addColorStop(0, '#4a5462');
  sideGrad.addColorStop(1, '#333b47');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(s.x+12, s.y-22); ctx.lineTo(s.x+17, s.y-18);
  ctx.lineTo(s.x+17, s.y-1); ctx.lineTo(s.x+12, s.y-5);
  ctx.closePath();
  ctx.fill();

  // --- Main front wall — grey stone gradient, wide & low ---
  const wallGrad = ctx.createLinearGradient(s.x, s.y-26, s.x, s.y-4);
  wallGrad.addColorStop(0, '#6e7a88');
  wallGrad.addColorStop(1, '#48525e');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x-13, s.y-24, 25, 20);
  // Top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(s.x-13, s.y-24); ctx.lineTo(s.x+12, s.y-24); ctx.stroke();

  // --- Stone block texture (horizontal mortar lines) ---
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 0.7;
  for (let py = s.y-21; py < s.y-4; py += 4) {
    ctx.beginPath(); ctx.moveTo(s.x-13, py); ctx.lineTo(s.x+12, py); ctx.stroke();
  }
  // Vertical mortar offsets (staggered courses)
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.5;
  for (let py = s.y-21; py < s.y-4; py += 8) {
    ctx.beginPath(); ctx.moveTo(s.x-7, py); ctx.lineTo(s.x-7, py+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x+1, py); ctx.lineTo(s.x+1, py+4); ctx.stroke();
  }
  for (let py = s.y-25; py < s.y-4; py += 8) {
    ctx.beginPath(); ctx.moveTo(s.x-10, py); ctx.lineTo(s.x-10, py+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x+5, py); ctx.lineTo(s.x+5, py+4); ctx.stroke();
  }

  // --- Flat roof parapet ---
  ctx.fillStyle = '#7a8694';
  ctx.fillRect(s.x-15, s.y-27, 29, 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-15, s.y-27); ctx.lineTo(s.x+14, s.y-27); ctx.stroke();

  // --- Crenellations (merlons) along roofline ---
  ctx.fillStyle = '#828e9c';
  for (let i = -13; i < 14; i += 5) {
    ctx.fillRect(s.x+i, s.y-32, 3, 5);
  }

  // --- Arrow slits (tall thin dark rectangles) ---
  ctx.fillStyle = '#1e2530';
  ctx.fillRect(s.x-9,  s.y-21, 2, 6);   // left slit
  ctx.fillRect(s.x+1,  s.y-21, 2, 6);   // centre slit
  ctx.fillRect(s.x+8,  s.y-21, 2, 6);   // right slit
  // horizontal crossbar on each slit
  ctx.fillStyle = '#2a3240';
  ctx.fillRect(s.x-10, s.y-18, 4, 1);
  ctx.fillRect(s.x,    s.y-18, 4, 1);
  ctx.fillRect(s.x+7,  s.y-18, 4, 1);

  // --- Wooden door with iron bands ---
  // Door frame
  ctx.fillStyle = '#2a3240';
  ctx.fillRect(s.x-4, s.y-14, 8, 10);
  // Door planks (warm wood)
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(s.x-3, s.y-13, 3, 9);
  ctx.fillStyle = '#6a4428';
  ctx.fillRect(s.x,   s.y-13, 3, 9);
  // Iron bands across door
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(s.x-3, s.y-11, 6, 1);
  ctx.fillRect(s.x-3, s.y-7,  6, 1);
  // Door handle
  ctx.fillStyle = '#888';
  ctx.fillRect(s.x-1, s.y-9, 1, 2);

  // --- Flag pole & red banner ---
  ctx.fillStyle = '#8a7a5a';
  ctx.fillRect(s.x+8, s.y-44, 2, 17);
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(s.x+10, s.y-44); ctx.lineTo(s.x+19, s.y-41);
  ctx.lineTo(s.x+10, s.y-38);
  ctx.closePath();
  ctx.fill();
  // White stripe on banner
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(s.x+10, s.y-42, 8, 1);

  // --- Training dummy (prop, left side) ---
  // Post
  ctx.fillStyle = '#6a5030';
  ctx.fillRect(s.x-21, s.y-22, 2, 18);
  // Dummy body (sack)
  ctx.fillStyle = '#c8a870';
  ctx.beginPath();
  ctx.ellipse(s.x-20, s.y-18, 4, 5, 0, 0, Math.PI*2);
  ctx.fill();
  // Dummy head
  ctx.fillStyle = '#d4b888';
  ctx.beginPath();
  ctx.arc(s.x-20, s.y-24, 3, 0, Math.PI*2);
  ctx.fill();
  // Rope binding on dummy body
  ctx.strokeStyle = '#8a6030';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(s.x-24, s.y-18); ctx.lineTo(s.x-16, s.y-18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x-24, s.y-15); ctx.lineTo(s.x-16, s.y-15); ctx.stroke();
}

function drawArchery(ctx, s) {
  // --- Isometric side face ---
  ctx.fillStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.moveTo(s.x+10, s.y-18); ctx.lineTo(s.x+15, s.y-14);
  ctx.lineTo(s.x+15, s.y-1); ctx.lineTo(s.x+10, s.y-5);
  ctx.closePath();
  ctx.fill();

  // --- Main wooden building front wall ---
  const woodGrad = ctx.createLinearGradient(s.x, s.y-22, s.x, s.y-2);
  woodGrad.addColorStop(0, '#a0632a');
  woodGrad.addColorStop(1, '#7a4a1a');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(s.x-12, s.y-20, 22, 16);
  // Wood plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.7;
  for (let py = s.y-20; py < s.y-4; py += 4) {
    ctx.beginPath(); ctx.moveTo(s.x-12, py); ctx.lineTo(s.x+10, py); ctx.stroke();
  }
  // Top edge highlight
  ctx.strokeStyle = 'rgba(255,220,150,0.2)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(s.x-12, s.y-20); ctx.lineTo(s.x+10, s.y-20); ctx.stroke();

  // --- Open-roof shooting lane fence posts ---
  ctx.fillStyle = '#6a3a10';
  ctx.fillRect(s.x-14, s.y-24, 2, 20); // left post
  ctx.fillRect(s.x+12, s.y-24, 2, 20); // right post
  // Horizontal fence rail
  ctx.fillRect(s.x-14, s.y-24, 28, 2);
  ctx.fillRect(s.x-14, s.y-16, 28, 2);

  // --- Archery targets on hay bales (right side) ---
  // Hay bale
  ctx.fillStyle = '#c8a830';
  ctx.fillRect(s.x+4, s.y-14, 8, 8);
  ctx.strokeStyle = '#a08020';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(s.x+4, s.y-14, 8, 8);
  // Target rings (concentric circles)
  ctx.strokeStyle = '#8a0000';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(s.x+8, s.y-10, 3.5, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = '#cc2222';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(s.x+8, s.y-10, 2, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.arc(s.x+8, s.y-10, 0.8, 0, Math.PI*2); ctx.fill();
  // Arrow sticking in target
  ctx.strokeStyle = '#8a5a2a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s.x+5, s.y-13); ctx.lineTo(s.x+8, s.y-10); ctx.stroke();
  // Arrowhead
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(s.x+8, s.y-10, 1, 0, Math.PI*2);
  ctx.fill();

  // --- Bow rack on the left side ---
  ctx.fillStyle = '#6a4010';
  ctx.fillRect(s.x-20, s.y-20, 2, 14); // rack post
  ctx.fillRect(s.x-22, s.y-18, 6, 1);  // rack arm top
  ctx.fillRect(s.x-22, s.y-12, 6, 1);  // rack arm bottom
  // Bow hanging on rack
  ctx.strokeStyle = '#7a5020';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(s.x-19, s.y-15, 3.5, -1.2, 1.2);
  ctx.stroke();
  // Bow string
  ctx.strokeStyle = '#c8a870';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(s.x-19 + 3.5*Math.sin(1.2), s.y-15 - 3.5*Math.cos(1.2));
  ctx.lineTo(s.x-19 + 3.5*Math.sin(-1.2), s.y-15 - 3.5*Math.cos(-1.2));
  ctx.stroke();

  // --- Green pennant flag ---
  ctx.fillStyle = '#5a7a30';
  ctx.fillRect(s.x-2, s.y-30, 1.5, 12);
  ctx.beginPath();
  ctx.moveTo(s.x-0.5, s.y-30);
  ctx.lineTo(s.x+7, s.y-27);
  ctx.lineTo(s.x-0.5, s.y-24);
  ctx.closePath();
  ctx.fill();
}

function drawTower(ctx, s) {
  // Tower body — darker gradient on stone
  const towerGrad = ctx.createLinearGradient(s.x, s.y-40, s.x, s.y);
  towerGrad.addColorStop(0, '#8a8a98');
  towerGrad.addColorStop(1, '#5a5a68');
  ctx.fillStyle = towerGrad;
  ctx.fillRect(s.x-6, s.y-34, 12, 30);
  // Highlight along top edge
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-6, s.y-34); ctx.lineTo(s.x+6, s.y-34); ctx.stroke();
  ctx.fillStyle = '#7a7a8a';
  ctx.beginPath();
  ctx.moveTo(s.x+6, s.y-34); ctx.lineTo(s.x+9, s.y-31);
  ctx.lineTo(s.x+9, s.y-1); ctx.lineTo(s.x+6, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Crenellations (battlements) — wider base + notched tops
  ctx.fillStyle = '#9a9aaa';
  ctx.fillRect(s.x-6, s.y-38, 12, 4);
  ctx.fillStyle = '#8a8a9a';
  for (let i = -5; i < 6; i += 4) {
    ctx.fillRect(s.x+i, s.y-42, 3, 5);
  }
  // Arrow slits (thin dark rectangles on tower body)
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(s.x-1, s.y-28, 2, 5);
  ctx.fillRect(s.x-1, s.y-18, 2, 4);
  // Doorway at base (arched)
  ctx.fillStyle = '#3a3a4a';
  ctx.beginPath();
  ctx.arc(s.x, s.y-6, 3, Math.PI, 0);
  ctx.lineTo(s.x+3, s.y-4); ctx.lineTo(s.x-3, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Stone texture lines on tower face
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.6;
  for (let sy = s.y-32; sy < s.y-4; sy += 5) {
    ctx.beginPath(); ctx.moveTo(s.x-6, sy); ctx.lineTo(s.x+6, sy); ctx.stroke();
  }
}

function drawWell(ctx, s) {
  // Cobblestone base — isometric diamond shape
  ctx.fillStyle = '#9a9088';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + 2);
  ctx.lineTo(s.x + 13, s.y - 4);
  ctx.lineTo(s.x, s.y - 10);
  ctx.lineTo(s.x - 13, s.y - 4);
  ctx.closePath();
  ctx.fill();
  // Cobblestone texture
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.6;
  for (let ci = -2; ci <= 2; ci++) {
    ctx.beginPath();
    ctx.arc(s.x + ci * 4, s.y - 4 + (Math.abs(ci) % 2) * 2, 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stone rim — outer ring (isometric ellipse, gradient)
  const rimGrad = ctx.createLinearGradient(s.x - 9, s.y - 10, s.x + 9, s.y - 10);
  rimGrad.addColorStop(0, '#b0a898');
  rimGrad.addColorStop(0.5, '#d0c8bc');
  rimGrad.addColorStop(1, '#8a8078');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 10, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stone rim — inner ring (slightly darker)
  ctx.fillStyle = '#7a7068';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 10, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dark water inside
  const waterGrad = ctx.createRadialGradient(s.x - 1, s.y - 11, 0, s.x, s.y - 10, 5.5);
  waterGrad.addColorStop(0, '#3a6898');
  waterGrad.addColorStop(1, '#1a3858');
  ctx.fillStyle = waterGrad;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 10, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Water shimmer
  ctx.strokeStyle = 'rgba(120,180,255,0.35)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(s.x - 1, s.y - 10.5, 2.5, 1.2, -0.2, 0, Math.PI * 2);
  ctx.stroke();

  // Stone rim wall cylinder (front arc)
  ctx.fillStyle = '#c8c0b4';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 10, 9, 5.5, 0, 0, Math.PI);
  ctx.lineTo(s.x - 9, s.y - 7);
  ctx.ellipse(s.x, s.y - 7, 9, 5.5, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  // Stone mortar lines on rim wall
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.6;
  for (let mx = -7; mx <= 7; mx += 3.5) {
    ctx.beginPath();
    ctx.moveTo(s.x + mx, s.y - 7);
    ctx.lineTo(s.x + mx, s.y - 10);
    ctx.stroke();
  }

  // Left wooden post
  const postGrad = ctx.createLinearGradient(s.x - 8, 0, s.x - 6, 0);
  postGrad.addColorStop(0, '#7a5a38');
  postGrad.addColorStop(1, '#5a3a18');
  ctx.fillStyle = postGrad;
  ctx.fillRect(s.x - 8, s.y - 24, 2.5, 15);
  // Right wooden post
  ctx.fillStyle = postGrad;
  ctx.fillRect(s.x + 5.5, s.y - 24, 2.5, 15);

  // Crossbar
  const barGrad = ctx.createLinearGradient(s.x - 8, s.y - 24, s.x - 8, s.y - 21);
  barGrad.addColorStop(0, '#a07848');
  barGrad.addColorStop(1, '#7a5830');
  ctx.fillStyle = barGrad;
  ctx.fillRect(s.x - 9, s.y - 24, 20, 3);
  // Crossbar highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x - 9, s.y - 24); ctx.lineTo(s.x + 11, s.y - 24); ctx.stroke();

  // Rope
  ctx.strokeStyle = '#c8a860';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x + 1, s.y - 21);
  ctx.lineTo(s.x + 1, s.y - 13);
  ctx.stroke();
  // Rope coil detail
  ctx.strokeStyle = 'rgba(180,140,80,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 21);
  ctx.lineTo(s.x + 2, s.y - 19);
  ctx.moveTo(s.x, s.y - 19);
  ctx.lineTo(s.x + 2, s.y - 17);
  ctx.stroke();

  // Wooden bucket
  const bucketGrad = ctx.createLinearGradient(s.x - 2, s.y - 14, s.x + 4, s.y - 14);
  bucketGrad.addColorStop(0, '#a07040');
  bucketGrad.addColorStop(1, '#7a5028');
  ctx.fillStyle = bucketGrad;
  ctx.fillRect(s.x - 1, s.y - 13, 5, 5);
  // Bucket hoops
  ctx.strokeStyle = '#5a3a10';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(s.x - 1, s.y - 13, 5, 5);
  ctx.beginPath(); ctx.moveTo(s.x - 1, s.y - 11); ctx.lineTo(s.x + 4, s.y - 11); ctx.stroke();
  // Bucket handle
  ctx.strokeStyle = '#c8a040';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(s.x + 1.5, s.y - 13, 2, Math.PI, 0);
  ctx.stroke();

  // Nearby puddles — suggest water splashing from bucket
  ctx.fillStyle = 'rgba(96, 165, 250, 0.4)';
  ctx.beginPath();
  ctx.ellipse(s.x - 12, s.y + 8, 4, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s.x + 10, s.y + 7, 3, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTavern(ctx, s) {
  // Walls — warm wood gradient, lighter at top
  const woodGrad = ctx.createLinearGradient(s.x, s.y-22, s.x, s.y-4);
  woodGrad.addColorStop(0, '#b88a50');
  woodGrad.addColorStop(1, '#8a6030');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(s.x-10, s.y-20, 20, 16);
  // Highlight along top edge
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-10, s.y-20); ctx.lineTo(s.x+10, s.y-20); ctx.stroke();
  ctx.fillStyle = '#a07848';
  ctx.beginPath();
  ctx.moveTo(s.x+10, s.y-20); ctx.lineTo(s.x+14, s.y-17);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+10, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Warm roof
  ctx.fillStyle = '#d4a030';
  ctx.beginPath();
  ctx.moveTo(s.x-13, s.y-20); ctx.lineTo(s.x, s.y-30);
  ctx.lineTo(s.x+13, s.y-20); ctx.closePath();
  ctx.fill();
  // Wood plank texture on front wall (horizontal lines)
  ctx.strokeStyle = 'rgba(80,50,20,0.25)';
  ctx.lineWidth = 0.8;
  for (let py = s.y-18; py < s.y-4; py += 3) {
    ctx.beginPath(); ctx.moveTo(s.x-10, py); ctx.lineTo(s.x+10, py); ctx.stroke();
  }
  // Sign bracket + hanging sign board
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x-12, s.y-16, 2, 8);
  ctx.fillRect(s.x-16, s.y-16, 7, 1);
  ctx.fillStyle = '#c8922a';
  ctx.fillRect(s.x-17, s.y-15, 8, 5);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(s.x-16, s.y-14, 6, 1);
  // Windows (warm glow)
  ctx.fillStyle = '#ffe088';
  ctx.fillRect(s.x-5, s.y-18, 4, 3);
  ctx.fillRect(s.x+3, s.y-18, 4, 3);
  // Warm door light glow (orange gradient)
  const tavernGlow = ctx.createRadialGradient(s.x, s.y-5, 0, s.x, s.y-5, 8);
  tavernGlow.addColorStop(0, 'rgba(255,150,30,0.40)');
  tavernGlow.addColorStop(1, 'rgba(255,150,30,0)');
  ctx.fillStyle = tavernGlow;
  ctx.fillRect(s.x-8, s.y-13, 16, 11);
  // Subtle warm glow on lower wall (interior light leaking out)
  const tavernWarmGlow = ctx.createLinearGradient(s.x, s.y - 8, s.x, s.y - 4);
  tavernWarmGlow.addColorStop(0, 'rgba(255, 220, 150, 0)');
  tavernWarmGlow.addColorStop(1, 'rgba(255, 200, 120, 0.15)');
  ctx.fillStyle = tavernWarmGlow;
  ctx.fillRect(s.x - 10, s.y - 8, 20, 4);
  // Door
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(s.x-3, s.y-12, 6, 8);
  // Doorstep — darker stone step
  ctx.fillStyle = 'rgba(50, 45, 40, 0.6)';
  ctx.fillRect(s.x - 4, s.y - 4, 8, 2);
}

function drawWall(ctx, s, b) {
  // Check which neighbors are also walls
  const hasN = b && G.buildingGrid[b.y-1]?.[b.x]?.type === 'wall';
  const hasS = b && G.buildingGrid[b.y+1]?.[b.x]?.type === 'wall';
  const hasE = b && G.buildingGrid[b.y]?.[b.x+1]?.type === 'wall';
  const hasW = b && G.buildingGrid[b.y]?.[b.x-1]?.type === 'wall';

  // Main wall post (always drawn)
  ctx.fillStyle = '#8a8078';
  ctx.fillRect(s.x - 4, s.y - 14, 8, 14);
  // Top cap
  ctx.fillStyle = '#9a9088';
  ctx.fillRect(s.x - 5, s.y - 16, 10, 3);
  // Merlon
  ctx.fillRect(s.x - 2, s.y - 19, 4, 3);

  // Connection segments to neighbors
  if (hasE || hasS) {
    // Right connection (toward +x or +y in iso)
    ctx.fillStyle = '#7a7068';
    ctx.beginPath();
    ctx.moveTo(s.x + 4, s.y - 12);
    ctx.lineTo(s.x + TW/2, s.y - 6);
    ctx.lineTo(s.x + TW/2, s.y);
    ctx.lineTo(s.x + 4, s.y);
    ctx.closePath();
    ctx.fill();
  }
  if (hasW || hasN) {
    // Left connection
    ctx.fillStyle = '#8a7a70';
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y - 12);
    ctx.lineTo(s.x - TW/2, s.y - 6);
    ctx.lineTo(s.x - TW/2, s.y);
    ctx.lineTo(s.x - 4, s.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRoad(ctx, s) {
  // Full tile coverage for automatic visual connection
  const hw = 24, hh = 12; // slightly inset from tile edge
  ctx.fillStyle = '#8a7a60';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x, s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.fill();
  // Lighter center
  ctx.fillStyle = '#a09078';
  const hw2 = 16, hh2 = 8;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh2);
  ctx.lineTo(s.x + hw2, s.y);
  ctx.lineTo(s.x, s.y + hh2);
  ctx.lineTo(s.x - hw2, s.y);
  ctx.closePath();
  ctx.fill();
  // Cobblestone dots
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = -2; i <= 2; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.beginPath();
      ctx.arc(s.x + i*6, s.y + j*4, 1.2, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function drawTradingPost(ctx, s, b) {
  // === TRADING POST — wooden dock with moored boat, cargo crates, and pennant ===

  // Water underneath the dock
  const waterGrad = ctx.createLinearGradient(s.x - 16, s.y, s.x + 16, s.y + 4);
  waterGrad.addColorStop(0, '#2a5878');
  waterGrad.addColorStop(1, '#1a3a58');
  ctx.fillStyle = waterGrad;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + 2);
  ctx.lineTo(s.x + 16, s.y - 4);
  ctx.lineTo(s.x + 16, s.y + 2);
  ctx.lineTo(s.x, s.y + 8);
  ctx.lineTo(s.x - 16, s.y + 2);
  ctx.lineTo(s.x - 16, s.y - 4);
  ctx.closePath();
  ctx.fill();
  // Water ripple lines
  ctx.strokeStyle = 'rgba(100,170,220,0.25)';
  ctx.lineWidth = 0.7;
  for (let wr = -10; wr <= 10; wr += 5) {
    ctx.beginPath();
    ctx.moveTo(s.x + wr - 4, s.y + 1);
    ctx.lineTo(s.x + wr + 4, s.y + 1);
    ctx.stroke();
  }

  // Pier support posts below dock level
  ctx.fillStyle = '#4a2e10';
  for (const px of [-11, -4, 4, 11]) {
    ctx.fillRect(s.x + px - 1, s.y - 2, 2, 6);
  }

  // Dock plank platform
  const dockGrad = ctx.createLinearGradient(s.x, s.y - 14, s.x, s.y - 2);
  dockGrad.addColorStop(0, '#a07858');
  dockGrad.addColorStop(1, '#7a5838');
  ctx.fillStyle = dockGrad;
  ctx.fillRect(s.x - 14, s.y - 14, 28, 12);
  // Top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x - 14, s.y - 14); ctx.lineTo(s.x + 14, s.y - 14); ctx.stroke();
  // Plank grain lines
  ctx.strokeStyle = 'rgba(60,35,10,0.22)';
  ctx.lineWidth = 0.7;
  for (let pl = s.y - 12; pl < s.y - 2; pl += 3) {
    ctx.beginPath(); ctx.moveTo(s.x - 14, pl); ctx.lineTo(s.x + 14, pl); ctx.stroke();
  }
  // Dock edge fascia board
  ctx.fillStyle = '#5a3a18';
  ctx.fillRect(s.x - 14, s.y - 14, 28, 2);
  ctx.fillRect(s.x - 14, s.y - 2, 28, 1.5);

  // Small boat hull moored at left side
  const hullGrad = ctx.createLinearGradient(s.x - 14, s.y - 8, s.x - 14, s.y - 2);
  hullGrad.addColorStop(0, '#8b5a28');
  hullGrad.addColorStop(1, '#5a3010');
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y - 8);
  ctx.lineTo(s.x - 4, s.y - 8);
  ctx.lineTo(s.x - 2, s.y - 4);
  ctx.lineTo(s.x - 14, s.y - 4);
  ctx.closePath();
  ctx.fill();
  // Boat gunwale
  ctx.strokeStyle = '#c8903a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y - 8);
  ctx.lineTo(s.x - 4, s.y - 8);
  ctx.lineTo(s.x - 2, s.y - 4);
  ctx.stroke();
  // Boat interior
  ctx.fillStyle = '#4a2808';
  ctx.beginPath();
  ctx.moveTo(s.x - 13, s.y - 7);
  ctx.lineTo(s.x - 5, s.y - 7);
  ctx.lineTo(s.x - 3.5, s.y - 5);
  ctx.lineTo(s.x - 13, s.y - 5);
  ctx.closePath();
  ctx.fill();
  // Mooring rope (dashed)
  ctx.strokeStyle = '#c8a860';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([1.5, 1.5]);
  ctx.beginPath();
  ctx.moveTo(s.x - 9, s.y - 8);
  ctx.lineTo(s.x - 9, s.y - 14);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cargo crates stacked on dock
  const crateGrad = ctx.createLinearGradient(s.x + 2, s.y - 22, s.x + 2, s.y - 14);
  crateGrad.addColorStop(0, '#c09060');
  crateGrad.addColorStop(1, '#8a6030');
  ctx.fillStyle = crateGrad;
  ctx.fillRect(s.x + 2, s.y - 22, 8, 8);
  // Iso top of crate
  ctx.fillStyle = '#b08848';
  ctx.beginPath();
  ctx.moveTo(s.x + 2, s.y - 22); ctx.lineTo(s.x + 6, s.y - 25);
  ctx.lineTo(s.x + 10, s.y - 22); ctx.lineTo(s.x + 6, s.y - 19);
  ctx.closePath(); ctx.fill();
  // Crate straps
  ctx.strokeStyle = 'rgba(60,35,10,0.35)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(s.x + 2, s.y - 22, 8, 8);
  ctx.beginPath(); ctx.moveTo(s.x + 6, s.y - 22); ctx.lineTo(s.x + 6, s.y - 14); ctx.stroke();
  // Second smaller crate
  ctx.fillStyle = '#b07848';
  ctx.fillRect(s.x + 3, s.y - 16, 5, 5);
  ctx.strokeStyle = 'rgba(60,35,10,0.3)';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(s.x + 3, s.y - 16, 5, 5);
  // Barrel beside crates
  const barrelGrad = ctx.createLinearGradient(s.x + 9, 0, s.x + 15, 0);
  barrelGrad.addColorStop(0, '#9a7038');
  barrelGrad.addColorStop(1, '#6a4818');
  ctx.fillStyle = barrelGrad;
  ctx.fillRect(s.x + 9, s.y - 16, 6, 5);
  ctx.fillStyle = '#8a6030';
  ctx.beginPath();
  ctx.ellipse(s.x + 12, s.y - 16, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s.x + 12, s.y - 11, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Barrel hoop
  ctx.strokeStyle = '#5a3010';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(s.x + 9, s.y - 14); ctx.lineTo(s.x + 15, s.y - 14); ctx.stroke();

  // Mast / flag pole with gradient
  const mastGrad = ctx.createLinearGradient(s.x + 5, s.y - 14, s.x + 7, s.y - 14);
  mastGrad.addColorStop(0, '#a07848');
  mastGrad.addColorStop(1, '#6a4820');
  ctx.fillStyle = mastGrad;
  ctx.fillRect(s.x + 5, s.y - 36, 2, 22);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x + 5, s.y - 36); ctx.lineTo(s.x + 5, s.y - 14); ctx.stroke();

  // Pennant — grayed when caravan is out
  const pennantLight = b.caravanOut ? '#888888' : '#e8c060';
  const pennantDark  = b.caravanOut ? '#666666' : '#c8a030';
  ctx.fillStyle = pennantLight;
  ctx.beginPath();
  ctx.moveTo(s.x + 7, s.y - 34);
  ctx.lineTo(s.x + 20, s.y - 28);
  ctx.lineTo(s.x + 7, s.y - 22);
  ctx.closePath();
  ctx.fill();
  // Lower half shading
  ctx.fillStyle = pennantDark;
  ctx.beginPath();
  ctx.moveTo(s.x + 7, s.y - 28);
  ctx.lineTo(s.x + 20, s.y - 28);
  ctx.lineTo(s.x + 7, s.y - 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(s.x + 7, s.y - 34);
  ctx.lineTo(s.x + 20, s.y - 28);
  ctx.lineTo(s.x + 7, s.y - 22);
  ctx.closePath();
  ctx.stroke();

  // Status text when caravan is away
  if (b.caravanOut) {
    ctx.fillStyle = 'rgba(255,200,50,0.55)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛵ en route', s.x, s.y - 40);
  }
}

function drawCastle(ctx, s) {
  // Stone base (wider than walls)
  const baseGrad = ctx.createLinearGradient(s.x, s.y - 2, s.x, s.y + 8);
  baseGrad.addColorStop(0, '#706860');
  baseGrad.addColorStop(1, '#4a4238');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(s.x - 22, s.y - 2, 44, 6);

  // Front wall darker side
  ctx.fillStyle = '#3a3228';
  ctx.fillRect(s.x - 22, s.y + 4, 44, 3);

  // LEFT flanking tower
  const ltGrad = ctx.createLinearGradient(s.x - 18, s.y - 38, s.x - 18, s.y - 2);
  ltGrad.addColorStop(0, '#b0a89a');
  ltGrad.addColorStop(0.5, '#807a6e');
  ltGrad.addColorStop(1, '#5a5448');
  ctx.fillStyle = ltGrad;
  ctx.fillRect(s.x - 22, s.y - 38, 10, 40);
  // Tower right face (darker)
  ctx.fillStyle = '#4a4238';
  ctx.fillRect(s.x - 12, s.y - 36, 2, 38);
  // Tower top parapet
  ctx.fillStyle = '#8a8278';
  ctx.fillRect(s.x - 23, s.y - 42, 12, 4);
  // Merlons
  ctx.fillStyle = '#706860';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(s.x - 22 + i * 4, s.y - 46, 2, 4);
  }
  // Conical roof
  ctx.fillStyle = '#b02020';
  ctx.beginPath();
  ctx.moveTo(s.x - 23, s.y - 42);
  ctx.lineTo(s.x - 17, s.y - 54);
  ctx.lineTo(s.x - 11, s.y - 42);
  ctx.closePath();
  ctx.fill();
  // Roof darker side
  ctx.fillStyle = '#7a1818';
  ctx.beginPath();
  ctx.moveTo(s.x - 17, s.y - 54);
  ctx.lineTo(s.x - 11, s.y - 42);
  ctx.lineTo(s.x - 14, s.y - 48);
  ctx.closePath();
  ctx.fill();
  // Pennant on left tower
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(s.x - 17, s.y - 54);
  ctx.lineTo(s.x - 17, s.y - 62);
  ctx.stroke();
  const pennantSway1 = Math.sin(G.gameTick * 0.08) * 1;
  ctx.fillStyle = '#c02828';
  ctx.beginPath();
  ctx.moveTo(s.x - 17, s.y - 62);
  ctx.lineTo(s.x - 17 + 5 + pennantSway1, s.y - 60);
  ctx.lineTo(s.x - 17 + 4 + pennantSway1, s.y - 57);
  ctx.lineTo(s.x - 17, s.y - 58);
  ctx.closePath();
  ctx.fill();

  // RIGHT flanking tower
  const rtGrad = ctx.createLinearGradient(s.x + 18, s.y - 38, s.x + 18, s.y - 2);
  rtGrad.addColorStop(0, '#a89e8e');
  rtGrad.addColorStop(0.5, '#786e60');
  rtGrad.addColorStop(1, '#524638');
  ctx.fillStyle = rtGrad;
  ctx.fillRect(s.x + 12, s.y - 38, 10, 40);
  ctx.fillStyle = '#403830';
  ctx.fillRect(s.x + 20, s.y - 36, 2, 38);
  ctx.fillStyle = '#7a7268';
  ctx.fillRect(s.x + 11, s.y - 42, 12, 4);
  ctx.fillStyle = '#605850';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(s.x + 12 + i * 4, s.y - 46, 2, 4);
  }
  ctx.fillStyle = '#b02020';
  ctx.beginPath();
  ctx.moveTo(s.x + 11, s.y - 42);
  ctx.lineTo(s.x + 17, s.y - 54);
  ctx.lineTo(s.x + 23, s.y - 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a1818';
  ctx.beginPath();
  ctx.moveTo(s.x + 17, s.y - 54);
  ctx.lineTo(s.x + 23, s.y - 42);
  ctx.lineTo(s.x + 20, s.y - 48);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(s.x + 17, s.y - 54);
  ctx.lineTo(s.x + 17, s.y - 62);
  ctx.stroke();
  const pennantSway2 = Math.sin(G.gameTick * 0.08 + 1) * 1;
  ctx.fillStyle = '#2848c0';
  ctx.beginPath();
  ctx.moveTo(s.x + 17, s.y - 62);
  ctx.lineTo(s.x + 17 + 5 + pennantSway2, s.y - 60);
  ctx.lineTo(s.x + 17 + 4 + pennantSway2, s.y - 57);
  ctx.lineTo(s.x + 17, s.y - 58);
  ctx.closePath();
  ctx.fill();

  // CENTRAL KEEP — the main imposing structure
  const keepGrad = ctx.createLinearGradient(s.x, s.y - 56, s.x, s.y - 2);
  keepGrad.addColorStop(0, '#c0b8a8');
  keepGrad.addColorStop(0.4, '#888070');
  keepGrad.addColorStop(1, '#584f40');
  ctx.fillStyle = keepGrad;
  ctx.fillRect(s.x - 14, s.y - 56, 28, 54);
  // Keep right face (shadow side)
  ctx.fillStyle = '#3a3228';
  ctx.fillRect(s.x + 12, s.y - 54, 2, 52);

  // Stone block texture — horizontal mortar lines
  ctx.strokeStyle = 'rgba(20, 15, 10, 0.25)';
  ctx.lineWidth = 0.5;
  for (let row = 0; row < 8; row++) {
    const y = s.y - 52 + row * 7;
    ctx.beginPath();
    ctx.moveTo(s.x - 14, y);
    ctx.lineTo(s.x + 14, y);
    ctx.stroke();
    // Staggered vertical joints
    const offset = (row % 2) * 4;
    for (let c = -12 + offset; c <= 12; c += 8) {
      ctx.beginPath();
      ctx.moveTo(s.x + c, y);
      ctx.lineTo(s.x + c, y + 7);
      ctx.stroke();
    }
  }

  // Top edge highlight (sunlit)
  ctx.strokeStyle = 'rgba(255, 240, 200, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y - 56);
  ctx.lineTo(s.x + 14, s.y - 56);
  ctx.stroke();

  // Keep top parapet with gold trim
  ctx.fillStyle = '#7a7268';
  ctx.fillRect(s.x - 16, s.y - 60, 32, 4);
  // Gold trim line
  ctx.fillStyle = '#d4a820';
  ctx.fillRect(s.x - 16, s.y - 61, 32, 1.2);
  // Dense crenellations
  ctx.fillStyle = '#605850';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(s.x - 15 + i * 4.5, s.y - 64, 2.5, 4);
  }

  // Windows with warm glow (ALWAYS visible — castle is grand)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const wx = s.x - 11 + col * 6;
      const wy = s.y - 48 + row * 12;
      // Glow halo
      const wGlow = ctx.createRadialGradient(wx + 1.5, wy + 1.5, 0, wx + 1.5, wy + 1.5, 5);
      wGlow.addColorStop(0, 'rgba(255, 220, 140, 0.4)');
      wGlow.addColorStop(1, 'rgba(255, 220, 140, 0)');
      ctx.fillStyle = wGlow;
      ctx.fillRect(wx - 4, wy - 4, 11, 11);
      // Window itself
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(wx, wy, 3, 3);
    }
  }

  // Arrow slits on outer keep walls
  ctx.fillStyle = '#1a1008';
  for (const ax of [s.x - 13, s.x + 11]) {
    ctx.fillRect(ax, s.y - 38, 1.5, 5);
    ctx.fillRect(ax, s.y - 26, 1.5, 5);
    ctx.fillRect(ax, s.y - 14, 1.5, 5);
  }

  // GRAND ENTRANCE ARCH
  // Dark arch opening
  ctx.fillStyle = '#0a0804';
  ctx.beginPath();
  ctx.moveTo(s.x - 5, s.y - 2);
  ctx.lineTo(s.x - 5, s.y - 11);
  ctx.quadraticCurveTo(s.x, s.y - 16, s.x + 5, s.y - 11);
  ctx.lineTo(s.x + 5, s.y - 2);
  ctx.closePath();
  ctx.fill();
  // Stone arch frame
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Portcullis bars
  ctx.strokeStyle = '#302820';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(s.x - 4 + i * 2, s.y - 11);
    ctx.lineTo(s.x - 4 + i * 2, s.y - 3);
    ctx.stroke();
  }
  // Keystone
  ctx.fillStyle = '#9a9084';
  ctx.fillRect(s.x - 1, s.y - 17, 2, 3);

  // CENTRAL ROOF — pyramidal keep cap
  ctx.fillStyle = '#8a1818';
  ctx.beginPath();
  ctx.moveTo(s.x - 16, s.y - 60);
  ctx.lineTo(s.x, s.y - 78);
  ctx.lineTo(s.x + 16, s.y - 60);
  ctx.closePath();
  ctx.fill();
  // Roof shadow side
  ctx.fillStyle = '#5a1010';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 78);
  ctx.lineTo(s.x + 16, s.y - 60);
  ctx.lineTo(s.x + 5, s.y - 66);
  ctx.closePath();
  ctx.fill();
  // Gold spire finial
  ctx.fillStyle = '#d4a820';
  ctx.fillRect(s.x - 0.5, s.y - 84, 1, 6);

  // GOLD FLAG on top (largest, most prominent)
  const flagSway = Math.sin(G.gameTick * 0.06) * 1.5;
  ctx.fillStyle = '#d4a820';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 84);
  ctx.lineTo(s.x + 8 + flagSway, s.y - 82);
  ctx.lineTo(s.x + 7 + flagSway, s.y - 78);
  ctx.lineTo(s.x, s.y - 79);
  ctx.closePath();
  ctx.fill();
  // Cross emblem on flag
  ctx.fillStyle = '#8a6014';
  ctx.fillRect(s.x + 3 + flagSway * 0.5, s.y - 82.5, 0.6, 3);
  ctx.fillRect(s.x + 2 + flagSway * 0.5, s.y - 81, 2.5, 0.6);
}

function drawGranary(ctx, s) {
  // === GRANARY — rounded grain silo with dome, barrel hoops, door, grain sacks ===

  // Grain sack props beside the silo (drawn first so silo overlaps)
  // Sack 1 (left)
  ctx.fillStyle = '#c8a860';
  ctx.beginPath();
  ctx.ellipse(s.x - 13, s.y - 5, 4, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,20,0.35)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(s.x - 13, s.y - 5, 4, 3, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  // Sack 1 tie
  ctx.fillStyle = '#8a5820';
  ctx.fillRect(s.x - 14, s.y - 9, 2, 2);
  // Sack 2 (leaning against silo)
  ctx.fillStyle = '#d4b068';
  ctx.beginPath();
  ctx.ellipse(s.x - 10, s.y - 7, 3, 4.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,20,0.3)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(s.x - 10, s.y - 7, 3, 4.5, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  // Sack 2 tie
  ctx.fillStyle = '#8a5820';
  ctx.fillRect(s.x - 11, s.y - 13, 2, 2);
  // Loose grain pile
  ctx.fillStyle = '#e8c870';
  ctx.beginPath();
  ctx.ellipse(s.x + 12, s.y - 3, 5, 2, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d4a840';
  ctx.beginPath();
  ctx.ellipse(s.x + 12, s.y - 3, 5, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Silo cylinder body — warm earth gradient
  const siloGrad = ctx.createLinearGradient(s.x - 11, s.y - 10, s.x + 11, s.y - 10);
  siloGrad.addColorStop(0, '#c09868');
  siloGrad.addColorStop(0.35, '#e0c090');
  siloGrad.addColorStop(0.7, '#c89060');
  siloGrad.addColorStop(1, '#9a6838');
  ctx.fillStyle = siloGrad;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 10, 11, Math.PI, 0);
  ctx.lineTo(s.x + 11, s.y - 2);
  ctx.lineTo(s.x - 11, s.y - 2);
  ctx.closePath();
  ctx.fill();
  // Cylinder top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 10, 11, Math.PI + 0.2, -0.2);
  ctx.stroke();

  // Wooden barrel hoops around the body
  ctx.strokeStyle = '#6a4818';
  ctx.lineWidth = 1.2;
  for (const hy of [s.y - 5, s.y - 10, s.y - 15]) {
    // Compute half-width at this height for a believable elliptical hoop
    const dy = hy - (s.y - 10);
    const hw = Math.sqrt(Math.max(0, 11 * 11 - dy * dy));
    ctx.beginPath();
    ctx.moveTo(s.x - hw, hy);
    ctx.lineTo(s.x + hw, hy);
    ctx.stroke();
    // Hoop nail dots
    ctx.fillStyle = '#4a2e08';
    ctx.beginPath(); ctx.arc(s.x - hw + 1.5, hy, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + hw - 1.5, hy, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // Dome cap — darker warm tone with radial gradient
  const domeGrad = ctx.createRadialGradient(s.x - 3, s.y - 18, 1, s.x, s.y - 12, 12);
  domeGrad.addColorStop(0, '#e0c08a');
  domeGrad.addColorStop(0.5, '#b88848');
  domeGrad.addColorStop(1, '#8a5c28');
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 10, 11, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Dome highlight arc
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(s.x - 2, s.y - 12, 6, Math.PI + 0.5, Math.PI * 1.8);
  ctx.stroke();
  // Dome cap finial (small knob at top)
  ctx.fillStyle = '#7a4c20';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 21, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Small arched door at base
  ctx.fillStyle = '#3a2008';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 4, 3.5, Math.PI, 0);
  ctx.lineTo(s.x + 3.5, s.y - 2);
  ctx.lineTo(s.x - 3.5, s.y - 2);
  ctx.closePath();
  ctx.fill();
  // Door frame
  ctx.strokeStyle = '#7a5028';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 4, 3.5, Math.PI, 0);
  ctx.moveTo(s.x - 3.5, s.y - 4);
  ctx.lineTo(s.x - 3.5, s.y - 2);
  ctx.moveTo(s.x + 3.5, s.y - 4);
  ctx.lineTo(s.x + 3.5, s.y - 2);
  ctx.stroke();
  // Door hinge dot
  ctx.fillStyle = '#c8a040';
  ctx.beginPath(); ctx.arc(s.x - 2.5, s.y - 4.5, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s.x - 2.5, s.y - 2.5, 0.7, 0, Math.PI * 2); ctx.fill();
}

function drawChurch(ctx, s) {
  // Main body — stone wall gradient
  const stoneGrad = ctx.createLinearGradient(s.x, s.y-26, s.x, s.y-4);
  stoneGrad.addColorStop(0, '#e8e0d8');
  stoneGrad.addColorStop(1, '#c8c0b8');
  ctx.fillStyle = stoneGrad;
  ctx.fillRect(s.x - 10, s.y - 22, 20, 18);
  // Highlight along top edge
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x-10, s.y-22); ctx.lineTo(s.x+10, s.y-22); ctx.stroke();
  ctx.fillStyle = '#b8b0a8';
  ctx.beginPath();
  ctx.moveTo(s.x + 10, s.y - 22); ctx.lineTo(s.x + 14, s.y - 19);
  ctx.lineTo(s.x + 14, s.y - 1); ctx.lineTo(s.x + 10, s.y - 4);
  ctx.closePath();
  ctx.fill();
  // Peaked roof
  ctx.fillStyle = '#6a5a4a';
  ctx.beginPath();
  ctx.moveTo(s.x - 12, s.y - 22); ctx.lineTo(s.x, s.y - 32);
  ctx.lineTo(s.x + 12, s.y - 22); ctx.closePath();
  ctx.fill();
  // Steeple
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(s.x - 2, s.y - 42, 4, 12);
  // Cross
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(s.x - 0.5, s.y - 46, 1, 6);
  ctx.fillRect(s.x - 2, s.y - 44, 4, 1);
  // Stone wall texture (subtle horizontal lines)
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.7;
  for (let sy = s.y-20; sy < s.y-4; sy += 4) {
    ctx.beginPath(); ctx.moveTo(s.x-10, sy); ctx.lineTo(s.x+10, sy); ctx.stroke();
  }
  // Detailed stained glass window (multi-color arched)
  ctx.fillStyle = '#4488cc';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 14, 3, Math.PI, 0);
  ctx.lineTo(s.x + 3, s.y - 9);
  ctx.lineTo(s.x - 3, s.y - 9);
  ctx.closePath();
  ctx.fill();
  // Red pane left, gold pane right
  ctx.fillStyle = '#cc4444';
  ctx.beginPath();
  ctx.arc(s.x - 1, s.y - 14, 1.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ddaa22';
  ctx.beginPath();
  ctx.arc(s.x + 1, s.y - 14, 1.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Small bell inside steeple opening
  ctx.fillStyle = '#c8a030';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 36, 2, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a08020';
  ctx.fillRect(s.x - 0.5, s.y - 35, 1, 2);
  // Subtle warm glow on lower wall (interior light leaking out)
  const churchWarmGlow = ctx.createLinearGradient(s.x, s.y - 8, s.x, s.y - 4);
  churchWarmGlow.addColorStop(0, 'rgba(255, 220, 150, 0)');
  churchWarmGlow.addColorStop(1, 'rgba(255, 200, 120, 0.15)');
  ctx.fillStyle = churchWarmGlow;
  ctx.fillRect(s.x - 10, s.y - 8, 20, 4);
  // Door
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x - 3, s.y - 8, 6, 4);
  // Doorstep — darker stone step
  ctx.fillStyle = 'rgba(50, 45, 40, 0.6)';
  ctx.fillRect(s.x - 4, s.y - 4, 8, 2);
  // Faint window glow from within (always visible — divine light)
  const windowGlow = ctx.createRadialGradient(s.x, s.y - 14, 1, s.x, s.y - 14, 6);
  windowGlow.addColorStop(0, 'rgba(255, 230, 150, 0.4)');
  windowGlow.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = windowGlow;
  ctx.fillRect(s.x - 6, s.y - 20, 12, 12);
}

function drawSchool(ctx, s) {
  // Main building — tall 3-floor stone/plaster with gradient walls
  const wallGrad = ctx.createLinearGradient(s.x-13, s.y-32, s.x-13, s.y-4);
  wallGrad.addColorStop(0, '#d4b890');
  wallGrad.addColorStop(0.5, '#c4a878');
  wallGrad.addColorStop(1, '#a88858');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x-13, s.y-32, 26, 28);
  // Side face (right) — darker plaster
  const sideGrad = ctx.createLinearGradient(s.x+13, s.y-32, s.x+17, s.y-4);
  sideGrad.addColorStop(0, '#a89060');
  sideGrad.addColorStop(1, '#806840');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(s.x+13, s.y-32); ctx.lineTo(s.x+17, s.y-28);
  ctx.lineTo(s.x+17, s.y-4); ctx.lineTo(s.x+13, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Stone block texture on front wall
  ctx.strokeStyle = 'rgba(100,70,30,0.2)'; ctx.lineWidth = 0.5;
  for (let row = -30; row < -6; row += 6) {
    ctx.beginPath(); ctx.moveTo(s.x-13, s.y+row); ctx.lineTo(s.x+13, s.y+row); ctx.stroke();
  }
  // Flat roof / cornice with overhang
  const roofGrad = ctx.createLinearGradient(s.x-15, s.y-34, s.x-15, s.y-31);
  roofGrad.addColorStop(0, '#7a6a5a');
  roofGrad.addColorStop(1, '#6a5a4a');
  ctx.fillStyle = roofGrad;
  ctx.fillRect(s.x-15, s.y-34, 30, 4);
  // Cornice highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(s.x-15, s.y-34, 30, 1);
  // Floor 1 windows — amber warm light
  ctx.fillStyle = '#ffd166';
  for (let i = -9; i <= 5; i += 7) {
    ctx.fillRect(s.x+i, s.y-14, 4, 4);
    // window frame
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 0.7;
    ctx.strokeRect(s.x+i, s.y-14, 4, 4);
    // window sill
    ctx.fillStyle = '#c4a060';
    ctx.fillRect(s.x+i-0.5, s.y-10, 5, 1);
    ctx.fillStyle = '#ffd166';
  }
  // Floor 2 windows
  ctx.fillStyle = '#ffe599';
  for (let i = -9; i <= 5; i += 7) {
    ctx.fillRect(s.x+i, s.y-22, 4, 4);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 0.7;
    ctx.strokeRect(s.x+i, s.y-22, 4, 4);
    ctx.fillStyle = '#c4a060';
    ctx.fillRect(s.x+i-0.5, s.y-18, 5, 1);
    ctx.fillStyle = '#ffe599';
  }
  // Floor 3 windows — near roof
  ctx.fillStyle = '#fff2bb';
  for (let i = -6; i <= 3; i += 9) {
    ctx.fillRect(s.x+i, s.y-30, 3, 3);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 0.5;
    ctx.strokeRect(s.x+i, s.y-30, 3, 3);
  }
  // Door (arched top)
  ctx.fillStyle = '#4a2a0a';
  ctx.fillRect(s.x-3, s.y-9, 6, 5);
  ctx.beginPath(); ctx.arc(s.x, s.y-9, 3, Math.PI, 0); ctx.fill();
  // Door step
  ctx.fillStyle = '#a08060';
  ctx.fillRect(s.x-4, s.y-4, 8, 1.5);
  // Bell tower / cupola above roof (left side)
  const towerGrad = ctx.createLinearGradient(s.x-10, s.y-52, s.x-10, s.y-34);
  towerGrad.addColorStop(0, '#9a8a7a');
  towerGrad.addColorStop(1, '#7a6a5a');
  ctx.fillStyle = towerGrad;
  ctx.fillRect(s.x-11, s.y-52, 10, 18);
  // Tower side face
  ctx.fillStyle = '#665a48';
  ctx.beginPath();
  ctx.moveTo(s.x-1, s.y-52); ctx.lineTo(s.x+2, s.y-50);
  ctx.lineTo(s.x+2, s.y-34); ctx.lineTo(s.x-1, s.y-34);
  ctx.closePath(); ctx.fill();
  // Cupola / pointed roof on tower
  ctx.fillStyle = '#5a4a38';
  ctx.beginPath();
  ctx.moveTo(s.x-13, s.y-52); ctx.lineTo(s.x-6, s.y-60); ctx.lineTo(s.x+1, s.y-52);
  ctx.closePath(); ctx.fill();
  // Bell opening (arch) in tower
  ctx.fillStyle = '#2a1a0a';
  ctx.beginPath(); ctx.arc(s.x-6, s.y-45, 3, Math.PI, 0); ctx.fill();
  ctx.fillRect(s.x-9, s.y-45, 6, 3);
  // Bell (gold circle)
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(s.x-6, s.y-44, 1.5, 0, Math.PI*2); ctx.fill();
  // Finial / weathervane spike on cupola
  ctx.fillStyle = '#c8a840';
  ctx.fillRect(s.x-7, s.y-64, 1.5, 4);
  // Book/scroll decoration on front wall
  // Scroll body
  ctx.fillStyle = '#f5e8c8';
  ctx.fillRect(s.x+4, s.y-28, 6, 5);
  // Scroll rolled ends
  ctx.fillStyle = '#d4c4a0';
  ctx.beginPath(); ctx.ellipse(s.x+4, s.y-25.5, 1, 2.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s.x+10, s.y-25.5, 1, 2.5, 0, 0, Math.PI*2); ctx.fill();
  // Scroll lines
  ctx.strokeStyle = '#a08060'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x+5, s.y-27); ctx.lineTo(s.x+9, s.y-27); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x+5, s.y-25); ctx.lineTo(s.x+9, s.y-25); ctx.stroke();
}

function drawWindmill(ctx, s, b) {
  // Stone base
  const baseGrad = ctx.createLinearGradient(s.x-8, s.y-8, s.x+8, s.y-8);
  baseGrad.addColorStop(0, '#9a8878');
  baseGrad.addColorStop(1, '#7a6858');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.moveTo(s.x-7, s.y-2);
  ctx.lineTo(s.x-5, s.y-22);
  ctx.lineTo(s.x+5, s.y-22);
  ctx.lineTo(s.x+7, s.y-2);
  ctx.closePath();
  ctx.fill();
  // Stone texture lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    const yy = s.y - 8 - i * 5;
    ctx.beginPath();
    ctx.moveTo(s.x - 6 + i * 0.3, yy);
    ctx.lineTo(s.x + 6 - i * 0.3, yy);
    ctx.stroke();
  }
  // Wooden cap at top
  ctx.fillStyle = '#8b5e2a';
  ctx.fillRect(s.x-6, s.y-28, 12, 7);
  ctx.fillStyle = '#6b4418';
  ctx.fillRect(s.x-4, s.y-31, 8, 4);
  // Small door
  ctx.fillStyle = '#4a2e10';
  ctx.fillRect(s.x-2, s.y-8, 4, 6);
  // Rotating blades
  const angle = (G.gameTick * 0.03) % (Math.PI * 2);
  const cx = s.x, cy = s.y - 24;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 4; i++) {
    const a = angle + i * Math.PI / 2;
    ctx.save();
    ctx.rotate(a);
    // Blade: elongated rectangle
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(-1.5, -12, 3, 12);
    // Blade tip
    ctx.fillStyle = '#a07840';
    ctx.fillRect(-2, -14, 4, 3);
    ctx.restore();
  }
  // Hub
  ctx.fillStyle = '#5a3a18';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBakery(ctx, s) {
  // Main building — warm plaster walls
  const wallGrad = ctx.createLinearGradient(s.x-10, s.y-24, s.x+10, s.y-4);
  wallGrad.addColorStop(0, '#d4a87a');
  wallGrad.addColorStop(1, '#b88858');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x-10, s.y-22, 20, 18);
  // Stone base edge
  ctx.fillStyle = '#9a7a5a';
  ctx.fillRect(s.x-10, s.y-6, 20, 4);
  // Roof — warm terracotta
  ctx.fillStyle = '#c05020';
  ctx.beginPath();
  ctx.moveTo(s.x-12, s.y-22);
  ctx.lineTo(s.x, s.y-32);
  ctx.lineTo(s.x+12, s.y-22);
  ctx.closePath();
  ctx.fill();
  // Roof ridge highlight
  ctx.fillStyle = '#e06030';
  ctx.beginPath();
  ctx.moveTo(s.x-3, s.y-28);
  ctx.lineTo(s.x, s.y-32);
  ctx.lineTo(s.x+3, s.y-28);
  ctx.closePath();
  ctx.fill();
  // Chimney
  ctx.fillStyle = '#7a5038';
  ctx.fillRect(s.x+3, s.y-38, 5, 14);
  ctx.fillStyle = '#5a3820';
  ctx.fillRect(s.x+2, s.y-40, 7, 3);
  // Chimney smoke
  const smokePhase = (G.gameTick * 0.04) % (Math.PI * 2);
  for (let i = 0; i < 3; i++) {
    const sy = s.y - 42 - i * 5;
    const sx = s.x + 5.5 + Math.sin(smokePhase + i * 1.2) * 2;
    const alpha = 0.4 - i * 0.12;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(sx, sy, 2 + i * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Door
  ctx.fillStyle = '#4a2e10';
  ctx.fillRect(s.x-3, s.y-14, 6, 8);
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(s.x-2.5, s.y-13.5, 2.5, 7);
  // Bread sign
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🍞', s.x + 6, s.y - 16);
}

function drawChickenCoop(ctx, s) {
  // Small wooden hut — half height of a house
  // Base / floor
  ctx.fillStyle = '#8B5E3C';
  ctx.fillRect(s.x - 9, s.y - 10, 18, 8);
  // Wall shading on right
  ctx.fillStyle = '#6B4422';
  ctx.fillRect(s.x + 5, s.y - 10, 4, 8);
  // Pointed roof
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.moveTo(s.x - 11, s.y - 10);
  ctx.lineTo(s.x, s.y - 20);
  ctx.lineTo(s.x + 11, s.y - 10);
  ctx.closePath();
  ctx.fill();
  // Roof highlight
  ctx.fillStyle = '#C07840';
  ctx.beginPath();
  ctx.moveTo(s.x - 3, s.y - 17);
  ctx.lineTo(s.x, s.y - 20);
  ctx.lineTo(s.x + 3, s.y - 17);
  ctx.closePath();
  ctx.fill();
  // Small door opening (dark arch)
  ctx.fillStyle = '#2a1a08';
  ctx.beginPath();
  ctx.arc(s.x - 2, s.y - 5, 2.5, Math.PI, 0);
  ctx.fillRect(s.x - 4.5, s.y - 5, 5, 3);
  ctx.fill();
  // Perch post on right side
  ctx.fillStyle = '#5a3a18';
  ctx.fillRect(s.x + 7, s.y - 18, 2, 16);
  ctx.fillRect(s.x + 4, s.y - 14, 8, 1.5);
  // Scattered small birds / chicken emoji in front
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🐔', s.x - 6, s.y + 4);
  ctx.font = '5px sans-serif';
  ctx.fillText('🐥', s.x + 2, s.y + 5);
}

function drawCowPen(ctx, s) {
  // Dirt patch inside the pen
  ctx.fillStyle = '#c8a870';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 4, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wooden fence — four sides of a rectangle
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeRect(s.x - 14, s.y - 16, 28, 18);
  // Fence posts at corners and midpoints
  ctx.fillStyle = '#6a4520';
  const postXs = [s.x - 14, s.x - 7, s.x, s.x + 7, s.x + 14];
  for (const px of postXs) {
    ctx.fillRect(px - 1, s.y - 18, 2, 20);
  }
  // Horizontal rails
  ctx.strokeStyle = '#9a7040';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y - 12); ctx.lineTo(s.x + 14, s.y - 12);
  ctx.moveTo(s.x - 14, s.y - 7);  ctx.lineTo(s.x + 14, s.y - 7);
  ctx.stroke();
  // Hay pile in back-left corner
  ctx.fillStyle = '#e8c040';
  ctx.beginPath();
  ctx.ellipse(s.x - 8, s.y - 12, 4, 2.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8a020';
  ctx.fillRect(s.x - 11, s.y - 13, 6, 2);
  // Cow 1 — rounded body with dark spots
  ctx.fillStyle = '#f0ece0';
  ctx.beginPath();
  ctx.ellipse(s.x - 3, s.y - 7, 5, 3, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Spots on cow 1
  ctx.fillStyle = '#5a3a20';
  ctx.beginPath();
  ctx.ellipse(s.x - 4, s.y - 8, 1.5, 1, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s.x - 1, s.y - 6, 1.2, 0.8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Cow 2 — smaller, lighter
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath();
  ctx.ellipse(s.x + 6, s.y - 5, 4, 2.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5030';
  ctx.beginPath();
  ctx.ellipse(s.x + 7, s.y - 6, 1, 0.7, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Small icon label
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🐄', s.x, s.y - 20);
}

function drawFisherman(ctx, s) {
  // Dock platform — weathered planks over sand
  ctx.fillStyle = '#8b6a3a';
  ctx.fillRect(s.x - 14, s.y - 4, 28, 5);
  // Plank lines
  ctx.strokeStyle = '#6a4e28';
  ctx.lineWidth = 0.5;
  for (let i = -12; i < 14; i += 5) {
    ctx.beginPath();
    ctx.moveTo(s.x + i, s.y - 4);
    ctx.lineTo(s.x + i, s.y + 1);
    ctx.stroke();
  }
  // Stilts into water (two legs)
  ctx.fillStyle = '#7a5a2a';
  ctx.fillRect(s.x - 10, s.y, 3, 6);
  ctx.fillRect(s.x + 7, s.y, 3, 6);

  // Main hut body
  const wallGrad = ctx.createLinearGradient(s.x - 9, s.y - 22, s.x + 9, s.y - 4);
  wallGrad.addColorStop(0, '#c8924a');
  wallGrad.addColorStop(1, '#a07038');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x - 9, s.y - 22, 18, 18);
  // Hut left-face shade
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(s.x - 9, s.y - 22, 4, 18);

  // Thatched roof
  ctx.fillStyle = '#b8882a';
  ctx.beginPath();
  ctx.moveTo(s.x - 12, s.y - 22);
  ctx.lineTo(s.x, s.y - 34);
  ctx.lineTo(s.x + 12, s.y - 22);
  ctx.closePath();
  ctx.fill();
  // Thatch highlights
  ctx.strokeStyle = '#d4a840';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const oy = 4 + i * 4;
    const rx = 12 - oy * 0.6;
    ctx.beginPath();
    ctx.moveTo(s.x - rx, s.y - 22 - oy + 4);
    ctx.lineTo(s.x + rx, s.y - 22 - oy + 4);
    ctx.stroke();
  }

  // Fishing pole — tall bamboo pole to the right
  ctx.strokeStyle = '#8b7040';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x + 10, s.y - 4);
  ctx.lineTo(s.x + 12, s.y - 30);
  ctx.stroke();
  // Fishing line
  ctx.strokeStyle = '#c8c8b8';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(s.x + 12, s.y - 30);
  ctx.lineTo(s.x + 18, s.y - 6);
  ctx.stroke();
  // Bobber
  ctx.fillStyle = '#e84040';
  ctx.beginPath();
  ctx.arc(s.x + 18, s.y - 6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(s.x + 18, s.y - 7, 2, Math.PI, Math.PI * 2);
  ctx.fill();

  // Hanging net on left side of hut
  ctx.strokeStyle = '#c8a868';
  ctx.lineWidth = 0.7;
  // Vertical net strings
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(s.x - 14 + i * 2, s.y - 20);
    ctx.lineTo(s.x - 14 + i * 2, s.y - 10);
    ctx.stroke();
  }
  // Horizontal net strings
  for (let j = 0; j < 3; j++) {
    ctx.beginPath();
    ctx.moveTo(s.x - 14, s.y - 20 + j * 4);
    ctx.lineTo(s.x - 8, s.y - 20 + j * 4);
    ctx.stroke();
  }

  // Small boat moored to the left
  ctx.fillStyle = '#7a5030';
  ctx.beginPath();
  ctx.ellipse(s.x - 16, s.y + 2, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9a6840';
  ctx.fillRect(s.x - 21, s.y + 0, 10, 2);
  // Mooring rope
  ctx.strokeStyle = '#a08060';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(s.x - 11, s.y + 1);
  ctx.lineTo(s.x - 11, s.y - 3);
  ctx.stroke();

  // Fish bucket on dock
  ctx.fillStyle = '#888880';
  ctx.fillRect(s.x - 1, s.y - 8, 5, 4);
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(s.x - 1, s.y - 9, 5, 1);
  // Fish in bucket (small orange dot)
  ctx.fillStyle = '#f07040';
  ctx.beginPath();
  ctx.arc(s.x + 1.5, s.y - 6, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Door
  ctx.fillStyle = '#4a2e10';
  ctx.fillRect(s.x - 3, s.y - 14, 6, 8);
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(s.x - 2.5, s.y - 13.5, 2.5, 7);
}

function drawBlacksmith(ctx, s) {
  // --- Isometric side face (right) — dark stone ---
  const sideGrad = ctx.createLinearGradient(s.x + 11, s.y - 22, s.x + 11, s.y - 2);
  sideGrad.addColorStop(0, '#4a3830');
  sideGrad.addColorStop(1, '#2e2420');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(s.x + 11, s.y - 22); ctx.lineTo(s.x + 16, s.y - 18);
  ctx.lineTo(s.x + 16, s.y - 2); ctx.lineTo(s.x + 11, s.y - 6);
  ctx.closePath();
  ctx.fill();

  // --- Main front wall — dark stone gradient ---
  const wallGrad = ctx.createLinearGradient(s.x, s.y - 26, s.x, s.y - 4);
  wallGrad.addColorStop(0, '#6a5a50');
  wallGrad.addColorStop(1, '#3e2e28');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(s.x - 12, s.y - 24, 23, 20);
  // Top edge highlight
  ctx.strokeStyle = 'rgba(255,220,150,0.15)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(s.x - 12, s.y - 24); ctx.lineTo(s.x + 11, s.y - 24); ctx.stroke();

  // --- Stone block texture ---
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.7;
  for (let py = s.y - 21; py < s.y - 4; py += 4) {
    ctx.beginPath(); ctx.moveTo(s.x - 12, py); ctx.lineTo(s.x + 11, py); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let py = s.y - 21; py < s.y - 4; py += 8) {
    ctx.beginPath(); ctx.moveTo(s.x - 6, py); ctx.lineTo(s.x - 6, py + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x + 2, py); ctx.lineTo(s.x + 2, py + 4); ctx.stroke();
  }

  // --- Flat roof parapet ---
  ctx.fillStyle = '#5a4a42';
  ctx.fillRect(s.x - 14, s.y - 27, 27, 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(s.x - 14, s.y - 27); ctx.lineTo(s.x + 13, s.y - 27); ctx.stroke();

  // --- Forge window — warm orange glow ---
  const forgeGlow = ctx.createRadialGradient(s.x - 4, s.y - 14, 1, s.x - 4, s.y - 14, 6);
  forgeGlow.addColorStop(0, 'rgba(255,180,40,0.9)');
  forgeGlow.addColorStop(0.5, 'rgba(255,100,10,0.5)');
  forgeGlow.addColorStop(1, 'rgba(180,40,0,0)');
  ctx.fillStyle = forgeGlow;
  ctx.beginPath();
  ctx.arc(s.x - 4, s.y - 14, 6, 0, Math.PI * 2);
  ctx.fill();
  // Window opening (dark arch)
  ctx.fillStyle = '#1a1008';
  ctx.beginPath();
  ctx.arc(s.x - 4, s.y - 15, 3, Math.PI, 0);
  ctx.lineTo(s.x - 1, s.y - 12); ctx.lineTo(s.x - 7, s.y - 12);
  ctx.closePath();
  ctx.fill();
  // Bright core of fire inside window
  ctx.fillStyle = 'rgba(255,220,80,0.7)';
  ctx.beginPath();
  ctx.arc(s.x - 4, s.y - 15, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // --- Heavy chimney (right side of roof) ---
  ctx.fillStyle = '#4a3830';
  ctx.fillRect(s.x + 4, s.y - 38, 6, 14);
  // Chimney cap
  ctx.fillStyle = '#3a2820';
  ctx.fillRect(s.x + 3, s.y - 39, 8, 2);
  // Stone texture on chimney
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  for (let cy = s.y - 35; cy < s.y - 26; cy += 3) {
    ctx.beginPath(); ctx.moveTo(s.x + 4, cy); ctx.lineTo(s.x + 10, cy); ctx.stroke();
  }

  // --- Door — heavy iron-banded wood ---
  ctx.fillStyle = '#1e1410';
  ctx.fillRect(s.x - 2, s.y - 13, 7, 9);
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(s.x - 1, s.y - 12, 3, 8);
  ctx.fillStyle = '#4a2e12';
  ctx.fillRect(s.x + 2, s.y - 12, 3, 8);
  // Iron bands
  ctx.fillStyle = '#333';
  ctx.fillRect(s.x - 1, s.y - 10, 6, 1);
  ctx.fillRect(s.x - 1, s.y - 7, 6, 1);

  // --- Anvil silhouette (front prop, lower centre) ---
  // Anvil base
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(s.x - 9, s.y - 6, 8, 3);
  // Anvil body
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(s.x - 8, s.y - 10, 6, 4);
  // Anvil horn (right taper)
  ctx.beginPath();
  ctx.moveTo(s.x - 2, s.y - 9); ctx.lineTo(s.x + 1, s.y - 7); ctx.lineTo(s.x - 2, s.y - 6);
  ctx.closePath();
  ctx.fill();
  // Anvil sheen
  ctx.fillStyle = 'rgba(180,180,200,0.3)';
  ctx.fillRect(s.x - 8, s.y - 10, 6, 1);

  // --- Hammer propped against wall ---
  ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(s.x + 11, s.y - 4); ctx.lineTo(s.x + 13, s.y - 15); ctx.stroke();
  // Hammer head
  ctx.fillStyle = '#5a5a68';
  ctx.fillRect(s.x + 10, s.y - 18, 6, 4);
  ctx.fillStyle = 'rgba(200,200,220,0.3)';
  ctx.fillRect(s.x + 10, s.y - 18, 6, 1);

  // --- Warm forge glow ambient (subtle orange on ground) ---
  const ambientGlow = ctx.createRadialGradient(s.x - 4, s.y - 10, 2, s.x - 4, s.y - 10, 14);
  ambientGlow.addColorStop(0, 'rgba(255,120,20,0.12)');
  ambientGlow.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = ambientGlow;
  ctx.beginPath();
  ctx.arc(s.x - 4, s.y - 10, 14, 0, Math.PI * 2);
  ctx.fill();
}

function drawGeneric(ctx, s, def) {
  ctx.fillStyle = '#6b5b4f';
  ctx.fillRect(s.x-8, s.y-18, 16, 14);
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(def.icon, s.x, s.y-20);
}

// ── Terrain details ─────────────────────────────────────────
function drawTree(ctx, x, y, a, seasonShift) {
  ctx.globalAlpha = a;

  // Pick variant based on position hash
  const posHash = (Math.abs(Math.round(x)) * 374761 + Math.abs(Math.round(y)) * 668265) >>> 0;
  const variantPick = posHash % 20;
  let variant;
  if (variantPick < 8) variant = 0;       // pine (40%)
  else if (variantPick < 14) variant = 1;  // oak (30%)
  else if (variantPick < 18) variant = 2;  // birch (20%)
  else variant = 3;                         // dead (10%)

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
  ctx.globalAlpha = a * 0.9;

  // Main large rock — gradient for 3D rounded look
  const mainGrad = ctx.createLinearGradient(x - 6, y - 6, x + 6, y + 2);
  mainGrad.addColorStop(0, '#a0a0b0');
  mainGrad.addColorStop(0.4, '#808090');
  mainGrad.addColorStop(1, '#505060');
  ctx.fillStyle = mainGrad;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 2);
  ctx.lineTo(x - 4, y - 6);
  ctx.lineTo(x + 3, y - 5);
  ctx.lineTo(x + 6, y + 2);
  ctx.closePath();
  ctx.fill();
  // Dark shadow underside on main rock
  ctx.fillStyle = 'rgba(20,20,35,0.3)';
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 2);
  ctx.lineTo(x + 6, y + 2);
  ctx.lineTo(x + 3, y - 1);
  ctx.lineTo(x - 3, y - 1);
  ctx.closePath();
  ctx.fill();
  // Metallic specular highlight — top-left face catch
  ctx.fillStyle = 'rgba(200,205,220,0.55)';
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 6);
  ctx.lineTo(x - 2, y - 8);
  ctx.lineTo(x + 1, y - 6);
  ctx.lineTo(x - 1, y - 4);
  ctx.closePath();
  ctx.fill();

  // Secondary rock (right, slightly smaller) — gradient
  const secGrad = ctx.createLinearGradient(x + 2, y - 4, x + 8, y + 1);
  secGrad.addColorStop(0, '#9898a8');
  secGrad.addColorStop(1, '#585868');
  ctx.fillStyle = secGrad;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + 4, y - 4);
  ctx.lineTo(x + 8, y - 2);
  ctx.lineTo(x + 7, y + 1);
  ctx.closePath();
  ctx.fill();
  // Specular on secondary rock
  ctx.fillStyle = 'rgba(210,215,230,0.5)';
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x + 6, y - 3);
  ctx.lineTo(x + 5, y - 1);
  ctx.lineTo(x + 3, y - 2);
  ctx.closePath();
  ctx.fill();

  // Small pebble cluster — lower left
  ctx.globalAlpha = a * 0.7;
  const pebGrad = ctx.createRadialGradient(x - 5, y + 4, 0.5, x - 5, y + 4, 2.5);
  pebGrad.addColorStop(0, '#b0b0be');
  pebGrad.addColorStop(1, '#606070');
  ctx.fillStyle = pebGrad;
  ctx.beginPath(); ctx.ellipse(x - 5, y + 4, 2.5, 1.5, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - 1, y + 4, 1.8, 1.2, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 3, y + 3, 1.5, 1.0, 0.1, 0, Math.PI * 2); ctx.fill();
}

function drawIronOre(ctx, x, y, a) {
  ctx.globalAlpha = a*0.95;
  ctx.fillStyle = '#4a6cb8';
  ctx.beginPath(); ctx.moveTo(x-5,y+2); ctx.lineTo(x-3,y-5); ctx.lineTo(x+4,y-4); ctx.lineTo(x+5,y+2); ctx.closePath(); ctx.fill();
  // Metallic sheen — brighter highlight
  ctx.globalAlpha = a*0.75;
  ctx.fillStyle = '#a8d4ff';
  ctx.fillRect(x-1, y-4, 3, 3);
  ctx.fillRect(x+2, y-1, 2, 2);
}

function drawWater(ctx, x, y, a, tx, ty) {
  // tx/ty = tile grid coords for per-tile variation and foam detection
  const t = G.gameTick * 0.025; // faster tick for visible motion
  // Per-tile phase offset so neighbouring tiles don't animate in lockstep
  const phase = (tx * 2.3 + ty * 1.7) % (Math.PI * 2);

  // ── Layer 1: deep colour base with oscillating hue shift ────
  // Visibly shifts between deep navy and rich cobalt each cycle
  const colorShift = 0.5 + 0.5 * Math.sin(t * 0.7 + phase);
  const cr = Math.round(18 + colorShift * 20);
  const cg = Math.round(80 + colorShift * 50);
  const cb = Math.round(180 + colorShift * 40);
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 2: bright mid-water shimmer overlay ────────────────
  const shimmer = 0.25 + 0.2 * Math.sin(t * 1.1 + phase + 1.5);
  ctx.globalAlpha = a * shimmer;
  ctx.fillStyle = 'rgba(100,200,255,1)';
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 3: animated wave crests – denser and larger ───────
  // Five wave bands for clearly visible ripples
  ctx.lineWidth = 2;
  const waveRows = [-10, -5, 0, 5, 10];
  for (let i = 0; i < waveRows.length; i++) {
    const rowY = waveRows[i];
    const dir = (i % 2 === 0) ? 1 : -1;
    // Strong alpha oscillation makes crests visibly pulse in/out
    const wAlpha = 0.5 + 0.4 * Math.sin(t * 2.2 + phase + i * 1.3);
    ctx.globalAlpha = a * Math.max(0.1, wAlpha);
    ctx.strokeStyle = 'rgba(210,245,255,1)';
    ctx.beginPath();
    const halfW = 32 * (1 - Math.abs(rowY) / 20);
    const step = 3;
    let started = false;
    for (let dx = -halfW; dx <= halfW; dx += step) {
      const wx = x + dx;
      // Two overlapping sine waves with larger amplitude for visibility
      const wy = y + rowY * 0.6
        + Math.sin(t * 2.4 * dir + dx * 0.28 + phase + i) * 3.5
        + Math.sin(t * 1.3 + dx * 0.18 + phase * 0.5) * 1.8;
      if (!started) { ctx.moveTo(wx, wy); started = true; }
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  // ── Layer 4: bright specular glints – larger and brighter ───
  const numGlints = 3 + ((tx * 3 + ty * 7) & 1); // 3 or 4 per tile
  for (let gi = 0; gi < numGlints; gi++) {
    const gPhase = phase + gi * 1.8;
    const gx = x + Math.sin(t * 1.1 + gPhase) * 18;
    const gy = y + Math.cos(t * 0.8 + gPhase) * 9;
    const gSize = 3.0 + 2.5 * Math.abs(Math.sin(t * 3.5 + gPhase));
    const gAlpha = 0.6 + 0.4 * Math.sin(t * 4.0 + gPhase);
    ctx.globalAlpha = a * Math.max(0, gAlpha);
    // Inner bright white core
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(gx, gy, gSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Outer soft halo
    ctx.globalAlpha = a * Math.max(0, gAlpha) * 0.4;
    ctx.fillStyle = 'rgba(200,240,255,1)';
    ctx.beginPath();
    ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Layer 4b: shimmering highlight streaks (light reflections) ──
  ctx.lineWidth = 1;
  const streakPhase = G.gameTick * 0.008 + tx * 0.1 + ty * 0.07;
  for (let i = 0; i < 2; i++) {
    const off = Math.sin(streakPhase + i * 1.5) * 6;
    const alpha = 0.08 + 0.06 * Math.sin(streakPhase + i * 2);
    ctx.globalAlpha = a * Math.max(0, alpha);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(x - 10 + off, y - 3 + i * 4, 16, 0.8);
  }

  // ── Layer 4c: occasional strong specular flash (sun glint on water) ──
  const flashPhase = G.gameTick * 0.03 + (tx * 0.7 + ty * 0.3);
  const flashIntensity = Math.max(0, Math.sin(flashPhase) - 0.7) * 3; // spikes rarely
  if (flashIntensity > 0) {
    ctx.globalAlpha = a * flashIntensity * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.ellipse(x + (tx*3)%15-7, y + (ty*3)%5-2, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
  }

  // ── Layer 4d: golden sparkles during daytime (sun reflection) ──
  const sparkPhase = (G.gameTick * 0.02) + (tx * 1.7 + ty * 0.9);
  const sparkle = Math.max(0, Math.sin(sparkPhase * 0.3) - 0.85) * 6; // rare bright peak
  if (sparkle > 0 && a > 0.7) {
    ctx.globalAlpha = sparkle * a;
    // Small cross-shaped sparkle
    ctx.strokeStyle = 'rgba(255, 240, 180, 0.9)';
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
  const foamPulse = 0.7 + 0.3 * Math.sin(t * 2.0 + phase);
  for (const n of neighbours) {
    const nx = tx + n.dx, ny = ty + n.dy;
    const isLand = nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H
      && G.map[ny][nx] !== TILE.WATER;
    if (!isLand) continue;
    const m1x = (n.ex + n.ax) / 2, m1y = (n.ey + n.ay) / 2;
    const m2x = (n.ex + n.bx) / 2, m2y = (n.ey + n.by) / 2;
    // Bold primary foam stripe
    ctx.globalAlpha = a * foamPulse;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m1x, m1y); ctx.lineTo(n.ex, n.ey); ctx.lineTo(m2x, m2y);
    ctx.stroke();
    // Secondary softer foam halo
    ctx.globalAlpha = a * foamPulse * 0.5;
    ctx.strokeStyle = 'rgba(200,240,255,1)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(m1x, m1y); ctx.lineTo(n.ex, n.ey); ctx.lineTo(m2x, m2y);
    ctx.stroke();
    // Foam dot clusters along each half of the edge
    ctx.globalAlpha = a * foamPulse * 0.8;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let fi = 0; fi < 5; fi++) {
      const frac = (fi + 1) / 6;
      const fx = m1x + (n.ex - m1x) * frac + Math.sin(t * 3.0 + phase + fi) * 1.5;
      const fy = m1y + (n.ey - m1y) * frac + Math.cos(t * 2.5 + phase + fi) * 1.0;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let fi = 0; fi < 5; fi++) {
      const frac = (fi + 1) / 6;
      const fx = n.ex + (m2x - n.ex) * frac + Math.sin(t * 3.0 + phase + fi + 5) * 1.5;
      const fy = n.ey + (m2y - n.ey) * frac + Math.cos(t * 2.5 + phase + fi + 5) * 1.0;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = a; // restore
  ctx.lineWidth = 1;
}

// ── Minimap ─────────────────────────────────────────────────
const MINI_COLORS = {0:'#1a6aaa',1:'#d4a76a',2:'#4a7c4f',3:'#2d5a30',4:'#6b7280',5:'#4b6fa0',6:'#4a4a5a'};
const MINI_BUILD = {
  house:'#d4a574', farm:'#7cb342', lumber:'#a3714f',
  quarry:'#8a8e9a', mine:'#5a85b8', market:'#e8a040',
  barracks:'#6a7a8a', tower:'#8a8a9a', church:'#e0e0e0',
  castle:'#ffd166', tavern:'#c07040', wall:'#7a7a7a',
  road:'#8a7a60', well:'#60a5fa', granary:'#d4a574',
  tradingpost:'#e8a040', school:'#d4b890',
};
// Tile type for road detection (matches TILE.ROAD in state.js)
const MINI_ROAD_TILE = 5;

function renderMinimap() {
  const mc = minimapCtx;
  const mw = minimapC.width, mh = minimapC.height;
  const sx = mw / MAP_W, sy = mh / MAP_H;

  // Background
  mc.fillStyle = '#08090f';
  mc.fillRect(0, 0, mw, mh);

  // Terrain tiles — explored tiles at normal color, unexplored very dark
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (G.fog[y][x]) {
        mc.fillStyle = MINI_COLORS[G.map[y][x]] || '#111';
      } else {
        // Darker unexplored areas for more visible fog of war
        mc.fillStyle = '#070810';
      }
      mc.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }

  // Roads as tiny brown lines — draw road tiles as connected segments
  mc.strokeStyle = '#6b5a3e';
  mc.lineWidth = 1;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!G.fog[y][x]) continue;
      if (G.map[y][x] !== MINI_ROAD_TILE) continue;
      const cx = (x + 0.5) * sx;
      const cy = (y + 0.5) * sy;
      // Connect to right neighbor
      if (x + 1 < MAP_W && G.fog[y][x+1] && G.map[y][x+1] === MINI_ROAD_TILE) {
        mc.beginPath();
        mc.moveTo(cx, cy);
        mc.lineTo((x + 1.5) * sx, cy);
        mc.stroke();
      }
      // Connect to bottom neighbor
      if (y + 1 < MAP_H && G.fog[y+1][x] && G.map[y+1][x] === MINI_ROAD_TILE) {
        mc.beginPath();
        mc.moveTo(cx, cy);
        mc.lineTo(cx, (y + 1.5) * sy);
        mc.stroke();
      }
    }
  }

  // Buildings as colored circle dots with a dark halo so they pop against terrain
  // Only show buildings on explored tiles
  for (const b of G.buildings) {
    if (!G.fog[b.y]?.[b.x]) continue;
    const bx = (b.x + 0.5) * sx;
    const by = (b.y + 0.5) * sy;
    const r = b.type === 'castle' ? 4 : b.type === 'tower' || b.type === 'church' ? 3.5 : 3;
    // Dark halo
    mc.beginPath();
    mc.arc(bx, by, r + 1.5, 0, Math.PI * 2);
    mc.fillStyle = 'rgba(0,0,0,0.65)';
    mc.fill();
    // Building dot with actual color
    mc.beginPath();
    mc.arc(bx, by, r, 0, Math.PI * 2);
    mc.fillStyle = MINI_BUILD[b.type] || '#fff';
    mc.fill();
  }

  // Citizens as bright yellow dots with a slight glow (3px, up from 2px)
  for (const c of G.citizens) {
    const cx = Math.round(c.x * sx);
    const cy = Math.round(c.y * sy);
    // Glow halo
    mc.fillStyle = 'rgba(250,204,21,0.3)';
    mc.fillRect(cx - 2, cy - 2, 5, 5);
    // Solid dot
    mc.fillStyle = '#facc15';
    mc.fillRect(cx - 1, cy - 1, 3, 3);
  }

  // Enemies on minimap
  for (const e of G.enemies) {
    const mx = (e.x / MAP_W) * minimapC.width;
    const my = (e.y / MAP_H) * minimapC.height;
    mc.fillStyle = '#ef4444';
    mc.beginPath();
    mc.arc(mx, my, 2, 0, Math.PI * 2);
    mc.fill();
  }

  // Soldiers on minimap (blue/green)
  for (const s of G.soldiers) {
    const mx = (s.x / MAP_W) * minimapC.width;
    const my = (s.y / MAP_H) * minimapC.height;
    mc.fillStyle = s.type === 'archer' ? '#22c55e' : '#3b82f6';
    mc.beginPath();
    mc.arc(mx, my, 1.5, 0, Math.PI * 2);
    mc.fill();
  }

  // Camera viewport — dark shadow stroke then bright cyan outline for visibility
  const tl = screenToWorld(0, 50);
  const br = screenToWorld(logicalW, logicalH - 50);
  const vx = tl.x * sx, vy = tl.y * sy;
  const vw = (br.x - tl.x) * sx, vh = (br.y - tl.y) * sy;
  mc.strokeStyle = 'rgba(0,0,0,0.6)';
  mc.lineWidth = 3.5;
  mc.strokeRect(vx, vy, vw, vh);
  mc.strokeStyle = 'rgba(100,220,255,0.95)';
  mc.lineWidth = 1.5;
  mc.strokeRect(vx, vy, vw, vh);

  // Thin border around entire minimap for island definition
  mc.strokeStyle = 'rgba(180,160,120,0.5)';
  mc.lineWidth = 1;
  mc.strokeRect(0.5, 0.5, mw - 1, mh - 1);

  // Subtle inner vignette for depth
  const vign = mc.createRadialGradient(mw / 2, mh / 2, mw * 0.3, mw / 2, mh / 2, mw * 0.72);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.45)');
  mc.fillStyle = vign;
  mc.fillRect(0, 0, mw, mh);
}
