// ════════════════════════════════════════════════════════════
// Renderer — isometric canvas, building sprites, minimap
// ════════════════════════════════════════════════════════════

import { G, TILE, TILE_COLORS, BUILDINGS, TW, TH, MAP_W, MAP_H, getSeasonData, getDaylight } from './state.js';
import { renderBoats, renderFlocks, renderBalloons, renderAurora, renderWolves, renderGlowMushrooms, renderGroundMist, renderLanterns, renderCarts, renderRainbow, renderHawks, renderConstellations, renderPuddles, renderBonfire, renderFootprints, renderLensFlare, renderSnowmen, renderBlossoms, enhRenderWorld, enhRenderScreen } from './enhancements.js';

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
  }
  ctx.globalAlpha = 1;

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

      // Grass/sand shade variation via position hash + season tint.
      // Loop 13 (render S3): prior code used 4 discrete color buckets for grass,
      // which left ~13pt jumps between adjacent tiles — the seam was visible as a
      // diamond lattice over every field (fresh-eyes critique #5). Now we draw
      // from a shared base with small continuous offsets, so tile-to-tile deltas
      // are ~3pt max and the grid reads as natural meadow variation instead of
      // a bisected checkerboard.
      if (tile === TILE.GRASS || tile === TILE.SAND) {
        const h = ((x * 374761 + y * 668265) & 0xff);
        const n1 = ((h & 0xf) / 15) - 0.5;  // -0.5 .. 0.5
        const n2 = (((h >> 4) & 0xf) / 15) - 0.5;
        if (tile === TILE.GRASS) {
          const r = 74 + Math.round(n1 * 6);
          const g = 168 + Math.round(n2 * 10);
          const b = 80 + Math.round(n1 * 4);
          tileColor = shiftColor(`rgb(${r},${g},${b})`, seasonShift);
        } else {
          const r = 228 + Math.round(n1 * 8);
          const g = 186 + Math.round(n2 * 6);
          const b = 116 + Math.round(n1 * 6);
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
      if (tile !== TILE.WATER && (x + y) % 2 === 0) {
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
        // User feedback: "less transparencies" — bump 0.7→1.0 so tufts read as clear grass blades, not ghosts
        ctx.globalAlpha = daylight;
        // Reduced from gh<140 (~55%) to gh<70 (~27%) — was too busy, read as noise/artifacts
        if (gh < 70) {
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
        if (G.season === 'spring' && gh > 192) {
          ctx.fillStyle = ['#f0a0c0','#ffe066','#a0c0f0'][gh % 3];
          // User feedback: "less transparencies" — bump 0.8→1.0 for crisp spring flower dots
          ctx.globalAlpha = daylight;
          const fx = s.x - 6 + (gh % 12), fy = s.y - 2 + ((gh >> 3) % 5);
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
          // User feedback: "less transparencies" — bump 0.8→1.0 for distinct clover trefoils
          ctx.globalAlpha = daylight;
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

        // Base shadow — scaled with baseHW so wider mountains have bigger shadow
        ctx.globalAlpha = daylight * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 5, baseHW + 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = daylight;

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

      // Valid-tile highlight: when a building is selected, highlight all viewport
      // tiles where placement is valid with a gentle pulsing green tint.
      if (G.selectedBuild && !(G.hoveredTile && G.hoveredTile.x===x && G.hoveredTile.y===y)) {
        if (canPlaceCheck(G.selectedBuild, x, y)) {
          const pulse = 0.18 + 0.12 * Math.sin(G.gameTick * 0.08 + (x+y)*0.3);
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - TH/2);
          ctx.lineTo(s.x + TW/2, s.y);
          ctx.lineTo(s.x, s.y + TH/2);
          ctx.lineTo(s.x - TW/2, s.y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
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
    // Loop 52 (render S4): citizens stay readable at night. Prior alpha was
    // plain `daylight`, so at night (daylight ~0.5) they dimmed to half —
    // players couldn't see their villagers moving around after dark.
    // Floor citizen alpha at 0.85 so they remain legible; the scene still
    // reads as night via dim tiles/buildings and the warm-window glow.
    ctx.globalAlpha = Math.max(0.85, daylight);

    // Walking bob when moving — smooth sine, reduced amplitude.
    // Idle citizens still get a small breathing bob so they don't look frozen.
    // Loop 4 (render S3): phase derived from name-hash instead of c.x so
    // neighbors don't bob in stadium-wave lockstep. Prior (c.x * N) meant
    // two citizens on adjacent tiles had near-identical phase.
    const isMoving = c.path && c.pathIdx < (c.path?.length ?? 0);
    const phaseHash = (c.name.charCodeAt(0) * 91 + (c.name.charCodeAt(1) || 11) * 41) % 360;
    const phaseOffset = phaseHash * Math.PI / 180;
    const bob = isMoving
      ? Math.sin(G.gameTick * 0.2 + phaseOffset) * 0.8
      : Math.sin(G.gameTick * 0.05 + phaseOffset) * 0.35;
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
    // Loop 4 (render S3): social orientation — idle citizens face the
    // nearest neighbor within 1.4 tiles. Makes clusters read as a
    // conversation, not strangers standing back-to-back. Only fires
    // when no movement direction is set.
    if (faceX === 0 && faceZ === 0) {
      let nearest = null, ndMin = 1.4;
      for (const other of G.citizens) {
        if (other === c) continue;
        const odx = other.x - c.x, ody = other.y - c.y;
        const nd = Math.sqrt(odx * odx + ody * ody);
        if (nd < ndMin) { ndMin = nd; nearest = other; }
      }
      if (nearest) {
        const sdx = nearest.x - c.x, sdy = nearest.y - c.y;
        faceX = sdx > 0.1 ? 1 : sdx < -0.1 ? -1 : 0;
        faceZ = sdy > 0.1 ? 1 : sdy < -0.1 ? -1 : 0;
      }
    }
    // In iso: screen Y = (worldX + worldY)*TH/2, so moving away from camera
    // (up on screen) = faceX + faceZ < 0. Prior "faceX>0 && faceZ<0" only caught
    // one diagonal; this catches all rearward-facing directions.
    const facingAway = faceX + faceZ < 0;

    // Derived per-citizen constants used across head, neck, eyes, cheeks
    const skinHash = (c.name.charCodeAt(0) * 53 + (c.name.charCodeAt(1) || 29) * 17) % 4;
    // Tones chosen to stay clearly distinct from all job body colors (no warm-orange clashes)
    const skinColor = ['#ffe0c0', '#f5c99a', '#d0845a', '#9e5c38'][skinHash];
    const faceScreenX = faceX - faceZ; // screen-X component of movement direction
    // Lean into walk direction — body + head shift slightly forward
    const walkLean = isMoving ? faceScreenX * 0.9 : 0;
    const headX = s.x + faceScreenX * 0.5 + walkLean * 0.4;
    const headY = cy - 19;  // Loop 1 (render S3): dropped 1px so jaw overlaps body top, kills the "severed head" read

    // Job color — vibrant saturated palette so citizens stand out
    let bodyColor = '#8899bb';
    if (c.jobBuilding) {
      const jt = c.jobBuilding.type;
      if (jt === 'farm') bodyColor = '#4ec820';
      else if (jt === 'lumber') bodyColor = '#c07820';
      else if (jt === 'quarry' || jt === 'mine') bodyColor = '#5080a8';
      else if (jt === 'market') bodyColor = '#f0a800';
      else if (jt === 'barracks') bodyColor = '#3858a0';
      else if (jt === 'tavern') bodyColor = '#c83820';
      else bodyColor = '#5080c8';
    }
    if (c.state === 'eating') bodyColor = '#20d860';

    // Loop 43 (render S4): killed the job-colored ground ring. Fresh-eyes
    // critique: "colored rings read as UI selection indicators stacked on
    // every unit — visually noisy and removes weight." Now just a proper
    // soft elliptical drop-shadow with feathered edge via stacked alphas.
    // Reserve any colored ring for SELECTED citizen only (handled later).
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 7.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 5.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 3.2, 1.4, 0, 0, Math.PI * 2);
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

    // Loop 41 (render S3 revisited): rebuilt the citizen silhouette so
    // they have actual LEGS between body and feet, and proper arms instead
    // of shoulder stubs. Prior layout had body-bottom (cy-0.6) and feet
    // (cy-1) touching, so citizens read as floating torsos.
    //
    // New stack, bottom-up:
    //   Feet: cy+1 (below old position to clear room)
    //   Legs: 2 thin vertical rectangles from cy+1 to cy-4 (pants color)
    //   Body: ellipse centered at cy-9 (moved up 1px), 5.2×6.6
    //   Arms: elongated ovals from cy-10 to cy-5, slight outward angle
    //   Head: unchanged (cy-19, r=6.3)
    // Loop 48 (render S4): real walk cycle. Prior code had feet sliding
    // left/right via sine — looked slidey. Now each foot follows a proper
    // up+forward swing phase then a planted stance phase, mirrored L/R.
    // stepL is positive during left-foot swing, negative during right.
    const walkPhase = G.gameTick * 0.22 + phaseOffset;
    const stepSin = Math.sin(walkPhase);
    const step = isMoving ? stepSin * 1.5 : 0;
    const pantsColor = '#3a2618';
    // Per-foot lift: the foot is UP when it's swinging forward (cos>0),
    // PLANTED when cos<0. Use half-rectified cosines so only the swing
    // half has lift. Foot L swings on cos>0, foot R on cos<0.
    const cosP = Math.cos(walkPhase);
    const liftL = isMoving ? Math.max(0, cosP) * 1.6 : 0;
    const liftR = isMoving ? Math.max(0, -cosP) * 1.6 : 0;
    // Forward shift also comes from the same phase — foot ahead when lifted
    const shiftL = isMoving ? Math.max(0, cosP) * 1.1 : 0;
    const shiftR = isMoving ? Math.max(0, -cosP) * 1.1 : 0;

    // Legs
    ctx.fillStyle = pantsColor;
    const legL_x = s.x - 2.0 + shiftL * 0.6 - step * 0.15;
    const legR_x = s.x + 2.0 - shiftR * 0.6 + step * 0.15;
    const legL_len = 5 - liftL * 0.6;  // leg shortens when foot lifts
    const legR_len = 5 - liftR * 0.6;
    ctx.fillRect(legL_x - 1.2, cy - 1 - liftL - legL_len, 2.4, legL_len);
    ctx.fillRect(legR_x - 1.2, cy - 1 - liftR - legR_len, 2.4, legR_len);
    // Leg highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(legL_x - 1.2, cy - 1 - liftL - legL_len, 0.6, legL_len);
    ctx.fillRect(legR_x - 1.2, cy - 1 - liftR - legR_len, 0.6, legR_len);

    // Feet — lifted by liftL/liftR for the swing arc
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.ellipse(legL_x, cy + 0.5 - liftL, 2.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(legR_x, cy + 0.5 - liftR, 2.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — torso ellipse, slightly tapered (shoulders wider than waist).
    // Draw as two overlapping ellipses for subtle taper without bespoke
    // path code.
    const bodyX = s.x + walkLean * 0.35;
    const bodyTilt = walkLean * 0.055;
    ctx.fillStyle = bodyColor;
    // Lower body (narrower waist)
    ctx.beginPath();
    ctx.ellipse(bodyX, cy - 7, 4.6, 4.5, bodyTilt, 0, Math.PI * 2);
    ctx.fill();
    // Upper body (broader shoulders)
    ctx.beginPath();
    ctx.ellipse(bodyX, cy - 11, 5.4, 4.2, bodyTilt, 0, Math.PI * 2);
    ctx.fill();
    // Shadow side
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(bodyX + 1.6, cy - 8.5, 4.2, 5.3, bodyTilt, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    // Loop 46 (render S4): removed the body and arm strokes. Agent #5:
    // "mix of crisp outlines and soft halos — likely upscaled low-res
    // art + vector at different render paths." Was from stroked body
    // ellipses + unstroked head/legs/hands. Unified by dropping all
    // outlines — silhouette now reads from shape + shadow contrast.

    // Arms — elongated ovals, one slightly in front of body.
    const armSwing = isMoving ? step * 0.6 : 0;
    ctx.fillStyle = bodyColor;
    // Left arm (hangs down and out, full shoulder-to-hand length)
    ctx.beginPath();
    ctx.ellipse(bodyX - 5.8, cy - 8 + armSwing, 1.6, 3.8, Math.PI * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Right arm
    ctx.beginPath();
    ctx.ellipse(bodyX + 5.8, cy - 8 - armSwing, 1.6, 3.8, -Math.PI * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Hands — small skin-tone dots at the arm bottoms so the eye reads
    // where the arm ends. Huge silhouette improvement at any zoom.
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(bodyX - 5.8, cy - 4.5 + armSwing, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyX + 5.8, cy - 4.5 - armSwing, 1.1, 0, Math.PI * 2); ctx.fill();

    // Neck stub — bridging body to head, X averaged between body and head positions
    // Loop 1 (render S3): widened 2.2×2.6 → 3.0×3.0 so neck is 45% of head width
    // (was 35%) — less "ball on a bottle"; and top extends past head bottom to overlap
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse((bodyX + headX) * 0.5, cy - 15, 3.0, 3.0, bodyTilt, 0, Math.PI * 2);
    ctx.fill();

    // Head — large for chibi proportions (oversized head = cute, scaled ~1.4x)
    // Loop 1 (render S3): dropped the dark head outline. The full-circumference
    // rgba(10,5,0,0.55) stroke at the jawline read as a literal gap between head
    // and neck (the "severed" look). Silhouette holds from skin-vs-body contrast.
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 6.3, 0, Math.PI * 2);
    ctx.fill();

    // Hair — vibrant colors, cap shifts based on facing direction
    // When facing away, hair sits on the camera-visible (back) side of the head.
    // When facing camera, hair sits on the back/opposite side from the face.
    // Loop 9 (render S3): hair silhouette variants. Prior code used a single
    // arc shape — 4 colors × 1 silhouette × 4 skins = "four villagers, one
    // haircut" per fresh-eyes critique #1b. Now 4 colors × 4 silhouettes ×
    // 4 skins = real crowd variety. Shape is keyed to (name_hash >> 3) so
    // two citizens sharing a hair COLOR can still differ in shape.
    const hairColorIdx = (c.name.charCodeAt(0) * 31 + c.name.charCodeAt(1)) % 4;
    const hairShapeIdx = ((c.name.charCodeAt(0) * 13 + (c.name.charCodeAt(1) || 17) * 7) >> 1) % 4;
    ctx.fillStyle = ['#5c3a18','#c08020','#3a1a3a','#e8704a'][hairColorIdx];
    const hairOffX = facingAway ? faceX * 0.5 : -faceX * 0.6;
    const hairStart = facingAway ? Math.PI * 0.65 : Math.PI * 0.85;
    const hairEnd   = facingAway ? Math.PI * 2.35 : Math.PI * 2.15;

    if (hairShapeIdx === 0) {
      // Variant 0: classic cap (the original silhouette)
      ctx.beginPath();
      ctx.arc(headX + hairOffX, headY - 1.4, 5.9, hairStart, hairEnd);
      ctx.closePath();
      ctx.fill();
    } else if (hairShapeIdx === 1) {
      // Variant 1: tall tuft — cap + cowlick/spike on top
      ctx.beginPath();
      ctx.arc(headX + hairOffX, headY - 1.4, 5.9, hairStart, hairEnd);
      ctx.closePath();
      ctx.fill();
      // Small tuft blob above the crown
      ctx.beginPath();
      ctx.ellipse(headX + hairOffX - faceX * 1.2, headY - 5.8, 2.4, 2.2, -0.2 * faceX, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairShapeIdx === 2) {
      // Variant 2: asymmetric side-parting — wider on one side
      ctx.beginPath();
      ctx.arc(headX + hairOffX + 0.8 * (facingAway ? -faceX : faceX), headY - 1.1, 6.0, hairStart - 0.25, hairEnd + 0.15);
      ctx.closePath();
      ctx.fill();
      // Bang falling forward over the "short" side
      if (!facingAway) {
        ctx.beginPath();
        ctx.ellipse(headX - faceX * 2.8, headY - 1.8, 1.6, 1.1, 0.3 * faceX, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Variant 3: buzzed / close-cropped — much smaller radius
      ctx.beginPath();
      ctx.arc(headX + hairOffX, headY - 1.9, 4.6, hairStart + 0.15, hairEnd - 0.15);
      ctx.closePath();
      ctx.fill();
    }

    // Hair sheen — shape-aware upper-front highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.3;
    const sheenR = hairShapeIdx === 3 ? 3.9 : 4.8;
    ctx.beginPath();
    ctx.arc(headX + hairOffX - 0.5, headY - 2.2, sheenR, hairStart, hairStart + Math.PI * 0.6);
    ctx.stroke();

    // Face — eyes and mouth on facing side, hidden when facing away
    // Loop 1 (render S3): widened eye spacing ±1.7 → ±2.0 and shrank whites 1.6 → 1.3;
    // prior config had inner edges at ±0.1 so the whites touched at centerline, making
    // the face read as "goggles" at zoom ≥2. Now inner edges sit ~0.7px apart.
    // Loop 47 (render S4): dot-eyes instead of white-eyes. Prior whites
    // radius 1.3 with pupils 0.9 left a ~0.4px white ring around each
    // pupil that read as spectacles, especially at zoom 5+. Now: dark
    // dots directly on skin with a tiny single-pixel white glint.
    // Classic cute-character eye treatment (Peanuts/Sanrio).
    if (!facingAway && G.camera.zoom >= 0.8) {
      const eyeX = headX + faceScreenX * 0.8;
      const eyeDX = 2.0;
      // Solid dark eye dots
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.arc(eyeX - eyeDX, headY + 0.7, 1.2, 0, Math.PI * 2);
      ctx.arc(eyeX + eyeDX, headY + 0.7, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // Single bright glint upper-left of each eye (lively highlight)
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(eyeX - eyeDX - 0.4, headY + 0.7 - 0.4, 0.35, 0, Math.PI * 2);
      ctx.arc(eyeX + eyeDX - 0.4, headY + 0.7 - 0.4, 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Eyebrows — thin arcs above each eye
      ctx.strokeStyle = 'rgba(55,28,8,0.75)';
      ctx.lineWidth = 0.85;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(eyeX - eyeDX, headY - 0.2, 1.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeX + eyeDX, headY - 0.2, 1.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    // Mouth — state-driven expression. Loop 28 (render S3): was always a
    // smile at zoom ≥1.5; now also shows at zoom ≥1.2 (less close) and
    // varies by c.state (eating = O, working = neutral line, hungry = frown,
    // default = smile). Cheeks stay at zoom ≥1.5 threshold.
    if (!facingAway && G.camera.zoom >= 1.2) {
      ctx.strokeStyle = 'rgba(80,50,30,0.75)';
      ctx.fillStyle = 'rgba(80,50,30,0.8)';
      ctx.lineWidth = 0.9;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const mouthX = headX + faceScreenX * 0.5;
      const mouthY = headY + 2.2;
      if (c.state === 'eating') {
        // Small O for eating
        ctx.beginPath();
        ctx.arc(mouthX, mouthY, 0.9, 0, Math.PI * 2);
        ctx.stroke();
      } else if (c.hunger > 70) {
        // Frown — inverted smile curve
        ctx.beginPath();
        ctx.moveTo(mouthX - 1.2, mouthY + 0.3);
        ctx.quadraticCurveTo(mouthX, mouthY - 0.9, mouthX + 1.2, mouthY + 0.3);
        ctx.stroke();
      } else if (c.state === 'working') {
        // Neutral concentration line
        ctx.beginPath();
        ctx.moveTo(mouthX - 1.0, mouthY - 0.2);
        ctx.lineTo(mouthX + 1.0, mouthY - 0.2);
        ctx.stroke();
      } else {
        // Default smile
        ctx.beginPath();
        ctx.moveTo(mouthX - 1.2, mouthY - 0.4);
        ctx.quadraticCurveTo(mouthX, mouthY + 0.9, mouthX + 1.2, mouthY - 0.4);
        ctx.stroke();
      }
    }
    if (!facingAway && G.camera.zoom >= 1.5) {
      // Rosy cheeks — soft blush at close zoom
      ctx.fillStyle = 'rgba(240,100,80,0.22)';
      ctx.beginPath();
      ctx.ellipse(headX + faceScreenX * 0.4 - 2.8, headY + 2.2, 2.2, 1.5, 0, 0, Math.PI * 2);
      ctx.ellipse(headX + faceScreenX * 0.4 + 2.8, headY + 2.2, 2.2, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (G.camera.zoom >= 0.7) {
      // Loop 51 (render S4): carry tool while WALKING to/from job too, not
      // just at work. Citizens now visibly wield their trade tool during
      // walk_to_work (heading out) and walk_to_deliver (heading back).
      // Slightly smaller + more upright when walking so it reads as
      // "carried" vs "in use".
      const showTool = c.jobBuilding && (
        c.state === 'working' ||
        c.state === 'walk_to_work' ||
        c.state === 'walk_to_deliver'
      );
      if (showTool) {
        const jt = c.jobBuilding.type;
        const isWalking = c.state !== 'working';
        // Loop 53 (render S4): tool carried on the LEADING side when walking
        // (opposite the face direction so it doesn't block the face).
        // Before: tool was always +right-offset — blocked the eyes when a
        // citizen walked leftward.
        const toolSide = isWalking && faceScreenX !== 0 ? -faceScreenX : 1;
        const toolX = s.x + (isWalking ? 6 : 8) * toolSide;
        const toolY = cy - (isWalking ? 12 : 11);
        const toolScale = isWalking ? 0.85 : 1.0;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.translate(toolX, toolY);
        ctx.scale(toolScale, toolScale);
        if (jt === 'mine' || jt === 'quarry') {
          // Pickaxe — when walking, shouldered at steeper angle
          ctx.rotate(isWalking ? -0.8 : -0.4);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
          ctx.strokeStyle = '#aaa';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke();
        } else if (jt === 'lumber') {
          // Axe — shouldered when walking (vertical) vs swung when working (tilted)
          ctx.rotate(isWalking ? 0.0 : 0.3);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
          ctx.fillStyle = '#aaa';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2.5, -1); ctx.lineTo(1.5, 2); ctx.closePath(); ctx.fill();
        } else if (jt === 'farm') {
          // Scythe — long handle, curved blade. Carry vertical when walking.
          ctx.rotate(isWalking ? 0.15 : 0);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -1); ctx.stroke();
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(-1, -1, 2.5, 0, Math.PI * 0.9); ctx.stroke();
        } else if (jt === 'fisherman') {
          // Fishing rod — long thin rod with line
          ctx.rotate(isWalking ? -0.2 : 0.1);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.0;
          ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(1, -5); ctx.stroke();
          // Line
          ctx.strokeStyle = 'rgba(220,220,220,0.7)';
          ctx.lineWidth = 0.4;
          ctx.beginPath(); ctx.moveTo(1, -5); ctx.lineTo(2.5, 2); ctx.stroke();
        } else if (jt === 'blacksmith') {
          // Hammer — short handle with rect head
          ctx.rotate(isWalking ? 0.2 : 0.6);
          ctx.strokeStyle = '#8b5e3c';
          ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4); ctx.stroke();
          ctx.fillStyle = '#666';
          ctx.fillRect(-1.5, -1, 3, 2);
        } else {
          ctx.fillStyle = '#ccc';
          ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // Emote bubble above head (suppress working emote — tool icon handles it)
      // Idle is handled by the '?' indicator after 3s; showing 💤 for all idle citizens makes Day 1 look dead
      const emote = c.state==='eating' ? '🍎' :
        c.state==='working' ? null : c.state==='foraging' ? '🌿' :
        (c.state==='walk_to_work'||c.state==='walk_to_deliver') ? '🚶' : null;
      if (emote && G.gameTick % 120 < 80) { // show emote 80 of every 120 ticks (flicker)
        ctx.globalAlpha = 0.75;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emote, s.x, cy - 28);
        ctx.globalAlpha = daylight;
      }

      // Carrying indicator — tiny pack peeking over the shoulder blade, on the
      // side opposite from facing. The old r=3 dot at chest-height read as a
      // debug pip stamped on the body; shrinking + lifting it to the shoulder
      // edge and adding a thin strap makes it scan as a bindle being carried.
      // Loop 54 (render S4): carrying indicator polish.
      // - Food color shifted from bright #4ade80 (interface green) to a
      //   warmer apple #d96060 so it reads as "fruits in a sack", not
      //   a UI status light.
      // - Pack drawn as a rounded bindle (ellipse, slightly taller than
      //   wide) with a darker knot at the top for the strap tie-off.
      // - Strap rendered brown instead of near-black outline so it
      //   reads as a leather/rope strap rather than a stroke artifact.
      if (c.carrying) {
        const cc = {
          wood:'#a3714f', stone:'#9ca3af', food:'#d96060',
          gold:'#ffd166', iron:'#60a5fa',
        }[c.carrying] || '#ddd';
        const px = s.x - faceScreenX * 4;
        const py = cy - 14;
        // Rope/leather strap from shoulder
        ctx.strokeStyle = 'rgba(90,60,30,0.75)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(px + faceScreenX * 1.3, py + 1);
        ctx.lineTo(s.x + faceScreenX * 1.3, cy - 5);
        ctx.stroke();
        // Bindle — vertical oval for a bulky pack
        ctx.fillStyle = cc;
        ctx.beginPath();
        ctx.ellipse(px, py + 0.2, 1.7, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Darker tie-knot at top of pack
        ctx.fillStyle = 'rgba(60,35,15,0.85)';
        ctx.beginPath();
        ctx.ellipse(px, py - 1.6, 1.3, 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Subtle highlight on sunlit side of pack
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(px - 0.6, py - 0.3, 0.7, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } // end zoom >= 0.7

    // Hover highlight ring
    if (c === hoveredCitizen) {
      ctx.strokeStyle = 'rgba(255,209,102,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, cy - 10, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Selected citizen — elliptical ring at feet + faint arc overhead.
    // Loop 57 (render S4): prior was a big circle centered at chest. Looked
    // like a targeting reticle from above. Now anchored at the feet (where
    // the drop shadow is) using iso-flattened ellipse + a subtle overhead
    // crescent so the selection reads across zoom levels without fighting
    // the new shadow system.
    if (c === G.selectedCitizen) {
      const pulse = 0.55 + 0.35 * Math.sin(G.gameTick * 0.1);
      // Feet ring — iso-flat ellipse
      ctx.strokeStyle = `rgba(120,210,255,${pulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, 8, 3.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Overhead crescent — light arc above head for easy finding in a crowd
      ctx.strokeStyle = `rgba(120,210,255,${pulse * 0.75})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(s.x, cy - 28, 4.5, Math.PI * 1.15, Math.PI * 1.85);
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
    // Loop 39 (render S3): tooltip now also shows hunger status with a
    // small bar, and includes carrying-cargo info if applicable.
    const hs = toScreen(hoveredCitizen.x, hoveredCitizen.y);
    const name = hoveredCitizen.name;
    const stateLabel = {
      idle:'Idle', find_job:'Looking for work', walk_to_work:'Going to work',
      working:'Working', walk_to_deliver:'Delivering', deliver:'Delivering',
      foraging:'Foraging', eating:'Eating',
    }[hoveredCitizen.state] || hoveredCitizen.state;
    const jobLabel = hoveredCitizen.jobBuilding ? BUILDINGS[hoveredCitizen.jobBuilding.type]?.name : null;
    const line2 = jobLabel ? `${stateLabel} · ${jobLabel}` : stateLabel;
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
    // Per-enemy visual variety from fixed spawn variant
    const eVariant = e.variant ?? 0; // 0=swordsman, 1=spearman, 2=berserker
    const eHash = eVariant * 2.1; // stable phase offset for eye pulse
    if (G.camera.zoom < 0.6) {
      ctx.fillStyle = ['#5a1a1a','#3a2a3a','#6a1818'][eVariant];
      ctx.beginPath();
      ctx.arc(es.x, es.y - 4, 3, 0, Math.PI*2);
      ctx.fill();
      continue;
    }
    // Danger ground ring — red-tinted so raiders read as threat, not citizens
    ctx.fillStyle = 'rgba(200,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(es.x, es.y + 1, 8, 3.5, 0, 0, Math.PI*2);
    ctx.fill();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(es.x, es.y + 2, 5, 2, 0, 0, Math.PI*2);
    ctx.fill();
    // Loop 56 (render S4): raider silhouette rebuild — added legs/greaves,
    // real arms, hulking shoulders for a menacing stance. Prior raiders
    // were the pre-L41 citizen shape (floating torso + helmet). Now they
    // have full chibi proportions but with brutal details (heavier build,
    // spiked helm, armored greaves instead of cloth legs).
    const eMoving = Math.hypot(e.tx - e.x, e.ty - e.y) > 0.3;
    const ePhase = G.gameTick * 0.24 + (eHash & 0xff) * 0.04;
    const eBob = eMoving ? Math.sin(ePhase) * 0.7 : 0;
    const eStepSin = Math.sin(ePhase);
    const eStep = eMoving ? eStepSin * 1.5 : 0;
    const eCosP = Math.cos(ePhase);
    const edx = e.tx - e.x, edy = e.ty - e.y;
    const eDist = Math.hypot(edx, edy) || 1;
    const eFaceX = edx / eDist > 0.1 ? 1 : edx / eDist < -0.1 ? -1 : 0;
    const eFaceZ = edy / eDist > 0.1 ? 1 : edy / eDist < -0.1 ? -1 : 0;
    const eFaceScreenX = eFaceX - eFaceZ;
    const eLean = eMoving ? eFaceScreenX * 0.9 : 0;
    const eBodyX = es.x + eLean * 0.35;
    const eBodyTilt = eLean * 0.055;
    const eCY = es.y + eBob;

    // Greaves (metal leg plates) — bit heavier than citizen pants
    const greaveColor = '#22222a';
    const eLiftL = eMoving ? Math.max(0, eCosP) * 1.4 : 0;
    const eLiftR = eMoving ? Math.max(0, -eCosP) * 1.4 : 0;
    const eShiftL = eMoving ? Math.max(0, eCosP) * 1.0 : 0;
    const eShiftR = eMoving ? Math.max(0, -eCosP) * 1.0 : 0;
    const eLegLx = es.x - 2.2 + eShiftL * 0.5 - eStep * 0.15;
    const eLegRx = es.x + 2.2 - eShiftR * 0.5 + eStep * 0.15;
    const eLegLen = 5;
    ctx.fillStyle = greaveColor;
    ctx.fillRect(eLegLx - 1.4, es.y - 1 - eLiftL - (eLegLen - eLiftL * 0.4), 2.8, eLegLen - eLiftL * 0.4);
    ctx.fillRect(eLegRx - 1.4, es.y - 1 - eLiftR - (eLegLen - eLiftR * 0.4), 2.8, eLegLen - eLiftR * 0.4);
    // Metal highlight on greaves (sheen)
    ctx.fillStyle = 'rgba(140,140,160,0.3)';
    ctx.fillRect(eLegLx - 1.4, es.y - 1 - eLiftL - (eLegLen - eLiftL * 0.4), 0.6, eLegLen - eLiftL * 0.4);
    ctx.fillRect(eLegRx - 1.4, es.y - 1 - eLiftR - (eLegLen - eLiftR * 0.4), 0.6, eLegLen - eLiftR * 0.4);
    // Heavy boots
    ctx.fillStyle = '#18181f';
    ctx.beginPath();
    ctx.ellipse(eLegLx, es.y + 0.5 - eLiftL, 2.8, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(eLegRx, es.y + 0.5 - eLiftR, 2.8, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — hulking shoulders + waist. Armor plate colors
    const bodyColors = ['#3a2030', '#2a2a3a', '#3a1818'];
    ctx.fillStyle = bodyColors[eVariant];
    // Lower torso (armor skirt/waist)
    ctx.beginPath();
    ctx.ellipse(eBodyX, eCY - 7, 4.8, 4.6, eBodyTilt, 0, Math.PI * 2);
    ctx.fill();
    // Upper torso — wider than citizens for brute look
    ctx.beginPath();
    ctx.ellipse(eBodyX, eCY - 11, 6.0, 4.5, eBodyTilt, 0, Math.PI * 2);
    ctx.fill();
    // Shoulder pauldrons — dark metal knobs at each shoulder
    ctx.fillStyle = '#1a1a20';
    ctx.beginPath();
    ctx.ellipse(eBodyX - 5.5, eCY - 12, 2.0, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(eBodyX + 5.5, eCY - 12, 2.0, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // Armour trim (chest band)
    ctx.fillStyle = ['#6a3a48','#3a4060','#6a2828'][eVariant];
    ctx.fillRect(eBodyX - 4.2, eCY - 8.5, 8.4, 1.3);

    // Arms — longer hanging ovals with spiked shoulders
    const eArmSwing = eMoving ? eStepSin * 0.6 : 0;
    ctx.fillStyle = ['#4a2a3a','#2a2a4a','#4a1a1a'][eVariant];
    ctx.beginPath();
    ctx.ellipse(eBodyX - 6.2, eCY - 8 + eArmSwing, 1.7, 3.6, Math.PI * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(eBodyX + 6.2, eCY - 8 - eArmSwing, 1.7, 3.6, -Math.PI * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Gauntlets (metal hand covers) at arm ends
    ctx.fillStyle = '#3a3a42';
    ctx.beginPath();
    ctx.arc(eBodyX - 6.2, eCY - 4.5 + eArmSwing, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(eBodyX + 6.2, eCY - 4.5 - eArmSwing, 1.2, 0, Math.PI * 2); ctx.fill();

    // Head — helmet (slightly smaller than citizen head — visor visible)
    const eHeadX = eBodyX + eFaceScreenX * 0.4;
    ctx.fillStyle = '#1a1010';
    ctx.beginPath();
    ctx.arc(eHeadX, eCY - 15, 4.0, 0, Math.PI * 2);
    ctx.fill();
    // Helmet brim (horizontal bar)
    ctx.fillStyle = ['#5a3a40','#3a3a50','#5a2a2a'][eVariant];
    ctx.fillRect(eHeadX - 4.8, eCY - 13.5, 9.6, 1.3);
    // Spike on top of helmet (new — makes silhouette unmistakably hostile)
    ctx.fillStyle = '#4a3a30';
    ctx.beginPath();
    ctx.moveTo(eHeadX, eCY - 19);
    ctx.lineTo(eHeadX - 1, eCY - 16.5);
    ctx.lineTo(eHeadX + 1, eCY - 16.5);
    ctx.closePath();
    ctx.fill();
    // Red eye glow — pulsing
    ctx.fillStyle = '#ff4040';
    ctx.globalAlpha = Math.max(0.85, daylight) * (0.7 + 0.3 * Math.sin(G.gameTick * 0.12 + eHash));
    ctx.beginPath();
    ctx.arc(eHeadX - 1.3, eCY - 15, 0.75, 0, Math.PI * 2);
    ctx.arc(eHeadX + 1.3, eCY - 15, 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.max(0.85, daylight);
    // Weapon — axe, spear, or club depending on variant
    if (G.camera.zoom >= 0.7) {
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(eBodyX + 5, es.y - 8 + eBob);
      if (eVariant === 0) {
        // Axe: handle + wedge head
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -5); ctx.stroke();
        ctx.fillStyle = '#8a8890';
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, -3); ctx.lineTo(1, 0); ctx.closePath(); ctx.fill();
      } else if (eVariant === 1) {
        // Spear: long handle + tip
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -7); ctx.stroke();
        ctx.fillStyle = '#a0a0b0';
        ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(1, -5); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill();
      } else {
        // Club: thick handle + knob
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -4); ctx.stroke();
        ctx.fillStyle = '#5a3a10';
        ctx.beginPath(); ctx.arc(0, -5, 2, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    // HP bar
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(es.x - 7, es.y - 22, 14, 2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(es.x - 7, es.y - 22, 14 * (e.hp/e.maxHp), 2);
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

  // ── Animals ─────────────────────────────────────────────
  if (G.animals && G.camera.zoom >= 0.6) {
    for (const a of G.animals) {
      const as = toScreen(a.x, a.y);
      if (as.x < -20 || as.x > logicalW + 20 || as.y < -20 || as.y > logicalH + 20) continue;
      ctx.globalAlpha = daylight;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(as.x, as.y + 3, 4, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Walking bob
      const isWalking = a.state === 'walk';
      const bob = isWalking ? Math.sin(G.gameTick * 0.2 + a.phase) * 0.8 : 0;

      if (a.type === 'deer') {
        // Brown body
        ctx.fillStyle = '#8a6a40';
        ctx.beginPath();
        ctx.ellipse(as.x, as.y - 3 + bob, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head (small, forward)
        ctx.fillStyle = '#9a7a50';
        ctx.beginPath();
        ctx.arc(as.x + 3, as.y - 5 + bob, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Antlers (at high zoom)
        if (G.camera.zoom >= 1.3) {
          ctx.strokeStyle = '#5a3a1a';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(as.x + 3, as.y - 7 + bob);
          ctx.lineTo(as.x + 4.5, as.y - 9 + bob);
          ctx.moveTo(as.x + 3, as.y - 7 + bob);
          ctx.lineTo(as.x + 2, as.y - 9 + bob);
          ctx.stroke();
        }
        // Tiny legs (4 small lines)
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(as.x - 2, as.y - 1); ctx.lineTo(as.x - 2, as.y + 2);
        ctx.moveTo(as.x + 2, as.y - 1); ctx.lineTo(as.x + 2, as.y + 2);
        ctx.stroke();
      } else if (a.type === 'sheep') {
        // Fluffy white body
        ctx.fillStyle = '#f0ece0';
        ctx.beginPath();
        ctx.ellipse(as.x, as.y - 2 + bob, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fluff bumps
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(as.x + i * 1.5, as.y - 3.5 + bob, 1, 0, Math.PI * 2);
          ctx.fill();
        }
        // Dark head
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(as.x + 3, as.y - 3 + bob, 1.3, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(as.x - 1.5, as.y); ctx.lineTo(as.x - 1.5, as.y + 2);
        ctx.moveTo(as.x + 1.5, as.y); ctx.lineTo(as.x + 1.5, as.y + 2);
        ctx.stroke();
      } else if (a.type === 'chicken') {
        // White body
        ctx.fillStyle = '#f4f2e8';
        ctx.beginPath();
        ctx.ellipse(as.x, as.y - 2 + bob, 2, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Red comb
        ctx.fillStyle = '#c02020';
        ctx.beginPath();
        ctx.arc(as.x + 1.5, as.y - 3.5 + bob, 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.fillStyle = '#d4a020';
        ctx.beginPath();
        ctx.moveTo(as.x + 2.3, as.y - 3 + bob);
        ctx.lineTo(as.x + 3.2, as.y - 2.8 + bob);
        ctx.lineTo(as.x + 2.3, as.y - 2.5 + bob);
        ctx.closePath();
        ctx.fill();
      }
    }
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
    // Blue-tinted dark multiply overlay. Cap darkness at 0.7 so night
    // stays playable — was going nearly black at daylight=0, making
    // citizens and buildings impossible to see.
    const cappedDarkness = Math.min(darkness, 0.7);
    const tintR = Math.round(255 - cappedDarkness * 160);
    const tintG = Math.round(255 - cappedDarkness * 150);
    const tintB = Math.round(255 - cappedDarkness * 100);
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
  // ── Hot air balloons (loop 6+) ──────────────────────────────
  renderBalloons(ctx);

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
    if (!G._lightningTimer) G._lightningTimer = 300 + Math.random() * 600;
    G._lightningTimer--;
    if (G._lightningTimer <= 0) {
      G._lightningFlash = 3; // 3 frames of flash
      G._lightningTimer = 300 + Math.random() * 600;
    }
    if (G._lightningFlash > 0) {
      G._lightningFlash--;
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
    G.raidFlash = Math.max(0, G.raidFlash - 0.018);
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

  // Screen-space vignette removed — handled by WebGL post-processing (postfx.js)

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
  if (!def) return; // guard against unknown building types
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
    // Shadow length scales with sun angle — dramatically longer at dawn/dusk
    const sunAngle = Math.abs(daylight - 0.7) * 3; // 0 at midday (~0.7), peaks at dawn/dusk
    const shadowMultiplier = 1 + sunAngle; // shadows 1x at noon, up to ~3x at sunrise/set
    const shadowLen = buildingH * 0.8 * shadowMultiplier;
    // Warm shadow tint during golden hours
    const dayT = G.dayPhase / G.dayLength;
    const isGolden = (dayT < 0.15 || (dayT > 0.55 && dayT < 0.75));
    const shadowBaseColor = isGolden ? '120,60,40' : '0,0,0';
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
    shadowGrad.addColorStop(0, `rgba(${shadowBaseColor},0.45)`);
    shadowGrad.addColorStop(0.6, `rgba(${shadowBaseColor},0.2)`);
    shadowGrad.addColorStop(1, `rgba(${shadowBaseColor},0)`);
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
    case 'house': drawHouse(ctx, s, b); break;
    case 'farm': drawFarm(ctx, s, b); break;
    case 'lumber': drawLumber(ctx, s, b); break;
    case 'quarry': drawQuarry(ctx, s); break;
    case 'mine': drawMine(ctx, s); break;
    case 'market': drawMarket(ctx, s, b); break;
    case 'barracks': drawBarracks(ctx, s); break;
    case 'archery': drawArchery(ctx, s); break;
    case 'tower': drawTower(ctx, s); break;
    case 'well': drawWell(ctx, s); break;
    case 'tavern': drawTavern(ctx, s, b); break;
    case 'wall': drawWall(ctx, s, b); break;
    case 'road': drawRoad(ctx, s); break;
    case 'tradingpost': drawTradingPost(ctx, s, b); break;
    case 'castle': drawCastle(ctx, s); break;
    case 'granary': drawGranary(ctx, s); break;
    case 'church': drawChurch(ctx, s, b); break;
    case 'school': drawSchool(ctx, s); break;
    case 'windmill': drawWindmill(ctx, s, b); break;
    case 'bakery': drawBakery(ctx, s); break;
    case 'chickencoop': drawChickenCoop(ctx, s); break;
    case 'cowpen': drawCowPen(ctx, s); break;
    case 'fisherman': drawFisherman(ctx, s, b); break;
    case 'blacksmith': drawBlacksmith(ctx, s, b); break;
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

function drawHouse(ctx, s, b) {
  // Loop 18 (render S3): per-building hash variance. Every house was
  // identical (same red roof, same chimney position, same window). Now
  // 4 roof variants × 2 chimney positions × double-window chance.
  // Stable: hash from b.x/b.y so the same house keeps the same look.
  const h = b ? (((b.x * 37 + b.y * 53) & 0xff)) : 0;
  const roofVar = h & 0x3;
  const chimneyRight = (h >> 4) & 0x1;
  const extraWindow = (h >> 5) & 0x1;

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
  // Side wall (iso depth)
  ctx.fillStyle = '#a87c4e';
  ctx.beginPath();
  ctx.moveTo(s.x+9, s.y-20); ctx.lineTo(s.x+14, s.y-17);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+9, s.y-4);
  ctx.closePath();
  ctx.fill();

  // Roof variants — color + peak height depend on hash
  const roofCfg = [
    { top: '#d44030', bottom: '#a02820', side: '#a02e23', peakY: 32 },  // classic red tile (steep)
    { top: '#8a9aae', bottom: '#5a6a80', side: '#4e5e72', peakY: 28 },  // slate blue-grey (low-pitch)
    { top: '#c2a04e', bottom: '#8e6e26', side: '#886020', peakY: 34 },  // golden thatch (tall straw)
    { top: '#6a9a54', bottom: '#48703a', side: '#3c5e2e', peakY: 30 },  // moss green
  ][roofVar];

  const roofGrad = ctx.createLinearGradient(s.x, s.y - roofCfg.peakY, s.x, s.y-20);
  roofGrad.addColorStop(0, roofCfg.top);
  roofGrad.addColorStop(1, roofCfg.bottom);
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(s.x-12, s.y-20); ctx.lineTo(s.x, s.y - roofCfg.peakY);
  ctx.lineTo(s.x+12, s.y-20); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = roofCfg.side;
  ctx.beginPath();
  ctx.moveTo(s.x+12, s.y-20); ctx.lineTo(s.x, s.y - roofCfg.peakY);
  ctx.lineTo(s.x+5, s.y - roofCfg.peakY + 3); ctx.lineTo(s.x+16, s.y-17);
  ctx.closePath();
  ctx.fill();

  // Thatch variant gets horizontal strand detail
  if (roofVar === 2) {
    ctx.strokeStyle = 'rgba(40,28,8,0.35)';
    ctx.lineWidth = 0.5;
    for (let yy = s.y - 28; yy <= s.y - 20; yy += 2) {
      ctx.beginPath();
      const halfW = ((s.y - 20 - yy) / (roofCfg.peakY - 20)) * 12;
      ctx.moveTo(s.x - halfW, yy);
      ctx.lineTo(s.x + halfW, yy);
      ctx.stroke();
    }
  }

  // Subtle warm glow on lower wall
  const warmGlow = ctx.createLinearGradient(s.x, s.y - 8, s.x, s.y - 4);
  warmGlow.addColorStop(0, 'rgba(255, 220, 150, 0)');
  warmGlow.addColorStop(1, 'rgba(255, 200, 120, 0.15)');
  ctx.fillStyle = warmGlow;
  ctx.fillRect(s.x - 9, s.y - 8, 18, 4);
  // Door
  ctx.fillStyle = '#4a2a12';
  ctx.fillRect(s.x-3, s.y-10, 6, 6);
  // Doorstep
  ctx.fillStyle = 'rgba(50, 45, 40, 0.6)';
  ctx.fillRect(s.x - 4, s.y - 4, 8, 2);
  // Window(s)
  ctx.fillStyle = '#ffeebb';
  ctx.fillRect(s.x+4, s.y-18, 3, 3);
  if (extraWindow) ctx.fillRect(s.x-7, s.y-18, 3, 3);
  // Chimney — position varies + matches roof side accent for shingle variants
  const chimneyX = chimneyRight ? s.x + 5 : s.x - 9;
  const chimneyColor = roofVar === 1 ? '#5a6a70' : '#7a6a5a';
  ctx.fillStyle = chimneyColor;
  ctx.fillRect(chimneyX, s.y-35, 4, 8);
  // Chimney cap
  ctx.fillStyle = roofVar === 1 ? '#40505a' : '#5a4a3a';
  ctx.fillRect(chimneyX - 1, s.y - 36, 6, 2);
}

function drawFarm(ctx, s, b) {
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

  // --- Crops: alternate columns. Loop 19 (render S3): crop TYPE varies per
  // farm via position hash so different farms show different crops. Types:
  // 0 wheat (green stems + golden heads, current), 1 pumpkins (orange
  // ground fruit), 2 corn (tall yellow-green stalks with tassels), 3 flax
  // (thin blue-flower stems).
  const cropCols = [-10, -5, 0, 5];
  const farmHash = b ? (((b.x * 37 + b.y * 53) & 0xff)) : 0;
  const cropType = farmHash & 0x3;
  for (let ci = 0; ci < cropCols.length; ci++) {
    const cx = s.x + cropCols[ci];
    const isRipe = ci % 2 === 1;
    if (cropType === 0) {
      // Wheat — original
      ctx.strokeStyle = isRipe ? '#8b7020' : '#3a7a10';
      ctx.lineWidth = 1;
      for (let row = -3; row <= 2; row++) {
        const cy = s.y + row * 2.8;
        const stemIdx = ci * 6 + (row + 3);
        const sway = Math.sin((G.gameTick || 0) * 0.05 + stemIdx * 0.3) * 0.4;
        ctx.beginPath(); ctx.moveTo(cx, cy + 1); ctx.lineTo(cx + sway, cy - 3); ctx.stroke();
        ctx.fillStyle = isRipe ? '#d4a017' : '#4db820';
        ctx.fillRect(cx - (isRipe ? 1 : 2) + sway, cy - 5, isRipe ? 2 : 4, 2);
        ctx.fillStyle = isRipe ? '#c8901a' : '#3aaa10';
        ctx.fillRect(cx - 1 + sway * 0.5, cy - 3, 2, 1);
      }
    } else if (cropType === 1) {
      // Pumpkins — round orange fruit on ground, low vines
      for (let row = -3; row <= 2; row++) {
        const cy = s.y + row * 2.8;
        const stemIdx = ci * 6 + (row + 3);
        // Small green vine
        ctx.strokeStyle = '#2a6a10';
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(cx - 1, cy); ctx.lineTo(cx + 1, cy - 1); ctx.stroke();
        // Pumpkin ~every 3rd row
        if ((row + stemIdx) % 3 === 0) {
          ctx.fillStyle = '#d76b1a';
          ctx.beginPath(); ctx.ellipse(cx, cy - 1, 2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a6a1a';
          ctx.beginPath(); ctx.moveTo(cx, cy - 2.5); ctx.lineTo(cx + 0.7, cy - 3.5); ctx.stroke();
        }
      }
    } else if (cropType === 2) {
      // Corn — tall stalks with yellow tassels
      for (let row = -3; row <= 2; row++) {
        const cy = s.y + row * 2.8;
        const stemIdx = ci * 6 + (row + 3);
        const sway = Math.sin((G.gameTick || 0) * 0.05 + stemIdx * 0.3) * 0.3;
        // Stalk
        ctx.strokeStyle = '#6aa224';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy + 1); ctx.lineTo(cx + sway, cy - 6); ctx.stroke();
        // Leaves
        ctx.strokeStyle = '#7abb2a';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx - 2, cy - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + sway, cy - 4); ctx.lineTo(cx + 2, cy - 3); ctx.stroke();
        // Tassel at top when ripe
        if (isRipe) {
          ctx.fillStyle = '#e8d650';
          ctx.fillRect(cx - 0.6 + sway, cy - 7, 1.4, 1.2);
        }
      }
    } else {
      // Flax — thin stems with small blue flowers
      ctx.strokeStyle = '#5a7a3a';
      ctx.lineWidth = 0.7;
      for (let row = -3; row <= 2; row++) {
        const cy = s.y + row * 2.8;
        const stemIdx = ci * 6 + (row + 3);
        const sway = Math.sin((G.gameTick || 0) * 0.05 + stemIdx * 0.3) * 0.5;
        ctx.beginPath(); ctx.moveTo(cx, cy + 1); ctx.lineTo(cx + sway, cy - 4); ctx.stroke();
        // Little blue flower on top
        ctx.fillStyle = isRipe ? '#b0c8e8' : '#6a82b8';
        ctx.fillRect(cx - 0.6 + sway, cy - 5, 1.2, 1.2);
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

function drawLumber(ctx, s, b) {
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
  // Loop 21 (render S3): per-building hash variance. Log pile size, axe/saw
  // tool choice, sawdust density vary per mill. Taller pile = active camp;
  // smaller pile = recently shipped out.
  const h = b ? (((b.x * 73 + b.y * 41) & 0xff)) : 0;
  const pileHeight = 1 + (h & 0x3);  // 1-4 rows of logs
  const pileWide = (h >> 2) & 0x1;    // extra column
  const toolVariant = (h >> 3) & 0x3; // 0 axe, 1 two-hand saw, 2 both, 3 just stump
  const sawdustHeavy = (h >> 5) & 0x1;

  // Log pile
  const logColors = ['#c4844e', '#b07040', '#a06030'];
  const cols = pileWide ? 4 : 3;
  for (let row = 0; row < pileHeight; row++) {
    for (let col = 0; col < cols; col++) {
      const lx = s.x-18 + col*5;
      const ly = s.y - 3 - row*4;
      ctx.fillStyle = logColors[col % 3];
      ctx.beginPath(); ctx.ellipse(lx, ly, 3, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(lx, ly, 1.5, 1, 0, 0, Math.PI*2); ctx.stroke();
    }
  }

  // Tools: axe / two-hand saw / both / stump only
  if (toolVariant === 0 || toolVariant === 2) {
    // Axe — handle + blade leaning against wall
    ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s.x+13, s.y-4); ctx.lineTo(s.x+16, s.y-14); ctx.stroke();
    ctx.fillStyle = '#8a9aaa';
    ctx.beginPath();
    ctx.moveTo(s.x+16, s.y-14); ctx.lineTo(s.x+19, s.y-17); ctx.lineTo(s.x+19, s.y-12); ctx.closePath();
    ctx.fill();
  }
  if (toolVariant === 1 || toolVariant === 2) {
    // Two-hand saw on a sawhorse
    ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 1.1;
    // Sawhorse
    ctx.beginPath(); ctx.moveTo(s.x+10, s.y+0); ctx.lineTo(s.x+13, s.y-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x+17, s.y+0); ctx.lineTo(s.x+14, s.y-4); ctx.stroke();
    ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(s.x+10, s.y-4); ctx.lineTo(s.x+18, s.y-4); ctx.stroke();
    // Saw blade flat on top
    ctx.fillStyle = '#b4bec8';
    ctx.fillRect(s.x+11, s.y-6, 6, 1.2);
    // Teeth
    ctx.strokeStyle = '#707880'; ctx.lineWidth = 0.5;
    for (let tx = s.x+11; tx <= s.x+17; tx += 0.7) {
      ctx.beginPath(); ctx.moveTo(tx, s.y-4.8); ctx.lineTo(tx+0.3, s.y-4.2); ctx.stroke();
    }
  }
  if (toolVariant === 3) {
    // Chopping stump with axe stuck in it
    ctx.fillStyle = '#7a5030';
    ctx.beginPath(); ctx.ellipse(s.x+14, s.y-2, 4, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,5,0.6)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(s.x+14, s.y-2, 2, 1, 0, 0, Math.PI*2); ctx.stroke();
    // Axe handle sticking up
    ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(s.x+14, s.y-3); ctx.lineTo(s.x+14, s.y-10); ctx.stroke();
    // Axe blade at top
    ctx.fillStyle = '#a0a8b4';
    ctx.beginPath();
    ctx.moveTo(s.x+14, s.y-10); ctx.lineTo(s.x+17, s.y-12); ctx.lineTo(s.x+14, s.y-13);
    ctx.closePath(); ctx.fill();
  }

  // Sawdust density
  ctx.fillStyle = 'rgba(210,165,90,0.6)';
  const dustSpots = sawdustHeavy
    ? [[-8,1],[-5,2],[-3,1],[3,2],[6,1],[9,2],[-10,3],[2,3],[-6,4],[8,3]]
    : [[-8,1],[-5,2],[-3,1],[3,2],[6,1]];
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

function drawMarket(ctx, s, b) {
  // Loop 38 (render S3): awning color + displayed goods vary per market.
  // Before: every market was a red-striped awning with 1 gold + 1 green
  // good. Now 4 awning colors × 3 goods-display variants.
  const mkHash = b ? (((b.x * 79 + b.y * 37) & 0xff)) : 0;
  const awningPalette = [
    { top: '#f05545', bottom: '#c0302090' },  // red (classic)
    { top: '#5a8ad0', bottom: '#304a9090' },  // blue
    { top: '#6ab040', bottom: '#407020A0' },  // green
    { top: '#c8a040', bottom: '#906010A0' },  // gold
  ][mkHash & 0x3];
  const goodsVar = (mkHash >> 2) & 0x3;

  // Counter
  ctx.fillStyle = '#c89460';
  ctx.fillRect(s.x-12, s.y-8, 24, 6);
  // Awning — subtle top-to-bottom gradient
  const awningGrad = ctx.createLinearGradient(s.x, s.y-20, s.x, s.y-8);
  awningGrad.addColorStop(0, awningPalette.top);
  awningGrad.addColorStop(1, awningPalette.bottom);
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
  // Goods on counter — variant picks different commodity pairs
  if (goodsVar === 0) {
    // Gold bread + green apples (original)
    ctx.fillStyle = '#ffd166'; ctx.fillRect(s.x-6, s.y-12, 4, 3);
    ctx.fillStyle = '#4ade80'; ctx.fillRect(s.x+2, s.y-12, 4, 3);
  } else if (goodsVar === 1) {
    // Cloth bolts — red + blue
    ctx.fillStyle = '#c04040'; ctx.fillRect(s.x-7, s.y-13, 5, 4);
    ctx.fillStyle = '#4060b0'; ctx.fillRect(s.x+2, s.y-13, 5, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(s.x-7, s.y-12); ctx.lineTo(s.x-2, s.y-12); ctx.stroke();
  } else if (goodsVar === 2) {
    // Spices — small amber + orange cones
    ctx.fillStyle = '#e0a030';
    ctx.beginPath();
    ctx.moveTo(s.x-5, s.y-12); ctx.lineTo(s.x-3, s.y-9); ctx.lineTo(s.x-7, s.y-9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c85020';
    ctx.beginPath();
    ctx.moveTo(s.x+3, s.y-12); ctx.lineTo(s.x+5, s.y-9); ctx.lineTo(s.x+1, s.y-9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a3018';
    ctx.beginPath();
    ctx.moveTo(s.x-1, s.y-12); ctx.lineTo(s.x+1, s.y-10); ctx.lineTo(s.x-3, s.y-10); ctx.closePath(); ctx.fill();
  } else {
    // Pottery — urn + bowl silhouettes
    ctx.fillStyle = '#b87040';
    ctx.beginPath(); ctx.ellipse(s.x-4, s.y-10, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d89060';
    ctx.beginPath(); ctx.ellipse(s.x-4, s.y-11.5, 1.4, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#906040';
    ctx.beginPath(); ctx.ellipse(s.x+3, s.y-10, 3, 1.2, 0, 0, Math.PI); ctx.fill();
  }
  // Thin bottom edge stripe matches awning top
  ctx.fillStyle = awningPalette.top;
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

function drawTavern(ctx, s, b) {
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
  // Loop 27 (render S3): per-tavern sign board + sign-emblem variance.
  // Every tavern had the same gold-banded sign. Now the board color and its
  // emblem (mug / boar / crown / anchor) vary per-building.
  const tavHash = b ? (((b.x * 59 + b.y * 31) & 0xff)) : 0;
  const signColors = [
    { board: '#c8922a', accent: '#ffd166' },  // classic gold (original)
    { board: '#8e3f2a', accent: '#e08260' },  // burgundy
    { board: '#3a5a84', accent: '#8fb8d4' },  // navy blue
    { board: '#4e6a30', accent: '#a0c070' },  // mossy green
  ][tavHash & 0x3];
  const emblemType = (tavHash >> 2) & 0x3;
  // Sign bracket
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x-12, s.y-16, 2, 8);
  ctx.fillRect(s.x-16, s.y-16, 7, 1);
  // Board
  ctx.fillStyle = signColors.board;
  ctx.fillRect(s.x-17, s.y-15, 8, 5);
  // Top accent band
  ctx.fillStyle = signColors.accent;
  ctx.fillRect(s.x-16, s.y-14, 6, 1);
  // Emblem — tiny symbol in the middle of the board
  ctx.fillStyle = signColors.accent;
  if (emblemType === 0) {
    // Mug — rect + handle
    ctx.fillRect(s.x-14, s.y-13, 2, 2);
    ctx.strokeStyle = signColors.accent;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(s.x-11.5, s.y-12, 0.8, -Math.PI/2, Math.PI/2); ctx.stroke();
  } else if (emblemType === 1) {
    // Boar head — triangle ear + blob
    ctx.fillRect(s.x-14, s.y-12, 2.5, 1.5);
    ctx.beginPath();
    ctx.moveTo(s.x-13, s.y-13); ctx.lineTo(s.x-14, s.y-13); ctx.lineTo(s.x-13, s.y-11.5);
    ctx.closePath(); ctx.fill();
  } else if (emblemType === 2) {
    // Crown — three bumps
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(s.x-14 + i*1.2, s.y-12.5 + (i === 1 ? -0.5 : 0), 0.8, 1);
    }
    ctx.fillRect(s.x-14, s.y-11.5, 3.2, 0.6);
  } else {
    // Anchor — vertical + crossbar
    ctx.fillRect(s.x-13, s.y-13, 0.6, 3);
    ctx.fillRect(s.x-14, s.y-12, 2.4, 0.6);
    ctx.beginPath();
    ctx.arc(s.x-12.7, s.y-10.5, 1, 0, Math.PI); ctx.fill();
  }
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
  // Check which neighbors are also walls. In this iso:
  //   E = (x+1,y) → screen +TW/2, +TH/2  (down-right)
  //   S = (x,y+1) → screen -TW/2, +TH/2  (down-left)
  //   W = (x-1,y) → screen -TW/2, -TH/2  (up-left)
  //   N = (x,y-1) → screen +TW/2, -TH/2  (up-right)
  const hasN = b && G.buildingGrid[b.y-1]?.[b.x]?.type === 'wall';
  const hasS = b && G.buildingGrid[b.y+1]?.[b.x]?.type === 'wall';
  const hasE = b && G.buildingGrid[b.y]?.[b.x+1]?.type === 'wall';
  const hasW = b && G.buildingGrid[b.y]?.[b.x-1]?.type === 'wall';

  // Connectors first so the post draws over the junction.
  // Each connector is a diagonal band running from this post's top
  // to the neighbor's post top (neighbor center.y - 14, same as own post).
  const topY = -13;   // near post top (post top = -14)
  const botY = -3;    // ribbon thickness
  ctx.fillStyle = '#7a7068';
  const band = (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(s.x + 3, s.y + topY);
    ctx.lineTo(s.x + dx, s.y + dy + topY);
    ctx.lineTo(s.x + dx, s.y + dy + botY);
    ctx.lineTo(s.x + 3, s.y + botY);
    ctx.closePath();
    ctx.fill();
  };
  const bandLeft = (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(s.x - 3, s.y + topY);
    ctx.lineTo(s.x + dx, s.y + dy + topY);
    ctx.lineTo(s.x + dx, s.y + dy + botY);
    ctx.lineTo(s.x - 3, s.y + botY);
    ctx.closePath();
    ctx.fill();
  };
  if (hasE) band(TW/2, TH/2);    // down-right
  if (hasN) band(TW/2, -TH/2);   // up-right
  if (hasS) bandLeft(-TW/2, TH/2);   // down-left
  if (hasW) bandLeft(-TW/2, -TH/2);  // up-left

  // Main wall post
  ctx.fillStyle = '#8a8078';
  ctx.fillRect(s.x - 4, s.y - 14, 8, 14);
  // Top cap
  ctx.fillStyle = '#9a9088';
  ctx.fillRect(s.x - 5, s.y - 16, 10, 3);
  // Merlon
  ctx.fillRect(s.x - 2, s.y - 19, 4, 3);
}

function drawRoad(ctx, s) {
  // Loop 24 (render S3): added wheel ruts (two parallel darker grooves),
  // lightened cobble density, and mixed cobble sizes/colors so roads read
  // as trodden paths rather than a uniform stamped texture.
  const hw = 24, hh = 12;
  // Base road fill
  ctx.fillStyle = '#8a7a60';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x, s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.fill();
  // Lighter center panel (sun-baked center)
  ctx.fillStyle = '#a09078';
  const hw2 = 16, hh2 = 8;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh2);
  ctx.lineTo(s.x + hw2, s.y);
  ctx.lineTo(s.x, s.y + hh2);
  ctx.lineTo(s.x - hw2, s.y);
  ctx.closePath();
  ctx.fill();
  // Wheel ruts — two faint grooves running diagonally along the iso axes
  ctx.strokeStyle = 'rgba(60,45,25,0.22)';
  ctx.lineWidth = 1.2;
  for (const off of [-3, 3]) {
    ctx.beginPath();
    ctx.moveTo(s.x - hw2 + 1, s.y + off * 0.5);
    ctx.lineTo(s.x + hw2 - 1, s.y + off * 0.5);
    ctx.stroke();
  }
  // Cobblestones — mixed sizes + tones
  const cobbles = [
    {dx: -12, dy: 0, r: 1.6, a: 0.14},
    {dx: -6, dy: -2, r: 1.1, a: 0.10},
    {dx: -4, dy: 3, r: 1.4, a: 0.12},
    {dx: 2, dy: -3, r: 1.2, a: 0.11},
    {dx: 4, dy: 2, r: 1.5, a: 0.13},
    {dx: 9, dy: -1, r: 1.0, a: 0.09},
    {dx: 12, dy: 2, r: 1.3, a: 0.11},
    {dx: 0, dy: 4, r: 0.9, a: 0.09},
  ];
  for (const c of cobbles) {
    ctx.fillStyle = `rgba(0,0,0,${c.a})`;
    ctx.beginPath();
    ctx.arc(s.x + c.dx, s.y + c.dy, c.r, 0, Math.PI * 2);
    ctx.fill();
    // Small lighter edge on top-left of each for relief
    ctx.fillStyle = `rgba(255,255,255,${c.a * 0.45})`;
    ctx.beginPath();
    ctx.arc(s.x + c.dx - 0.4, s.y + c.dy - 0.4, c.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
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

function drawChurch(ctx, s, b) {
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
  // Loop 34 (render S3): stained-glass palette varies per building.
  // Blue dominant / rose dominant / amber dominant / deep-green monastic.
  const churchHash = b ? (((b.x * 67 + b.y * 43) & 0xff)) : 0;
  const glassPalette = [
    { base: '#4488cc', left: '#cc4444', right: '#ddaa22' }, // classic (original)
    { base: '#a24a6a', left: '#f0b0c0', right: '#8a3a52' }, // rose
    { base: '#d09030', left: '#f0c050', right: '#a06010' }, // amber
    { base: '#3a6a52', left: '#5aa07a', right: '#1a4030' }, // monastic green
  ][churchHash & 0x3];
  ctx.fillStyle = glassPalette.base;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 14, 3, Math.PI, 0);
  ctx.lineTo(s.x + 3, s.y - 9);
  ctx.lineTo(s.x - 3, s.y - 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glassPalette.left;
  ctx.beginPath();
  ctx.arc(s.x - 1, s.y - 14, 1.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glassPalette.right;
  ctx.beginPath();
  ctx.arc(s.x + 1, s.y - 14, 1.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Steeple top ornament — bell (most common), weathervane, or small statue.
  const topOrnament = (churchHash >> 2) & 0x3;
  if (topOrnament === 0 || topOrnament === 1) {
    // Bell (two of the four slots — most common)
    ctx.fillStyle = '#c8a030';
    ctx.beginPath(); ctx.arc(s.x, s.y - 36, 2, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a08020';
    ctx.fillRect(s.x - 0.5, s.y - 35, 1, 2);
  } else if (topOrnament === 2) {
    // Weathervane — rooster silhouette on a horizontal arrow
    ctx.strokeStyle = '#6a4820'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s.x - 2, s.y - 36); ctx.lineTo(s.x + 2, s.y - 36); ctx.stroke();
    ctx.fillStyle = '#6a4820';
    ctx.beginPath();
    ctx.moveTo(s.x + 2, s.y - 36); ctx.lineTo(s.x + 3.5, s.y - 37); ctx.lineTo(s.x + 3.5, s.y - 35);
    ctx.closePath(); ctx.fill();
    // Tiny rooster blob
    ctx.beginPath();
    ctx.ellipse(s.x - 0.5, s.y - 37.5, 1.2, 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(s.x - 1, s.y - 38.5, 0.5, 1);
  } else {
    // Small saint statue — rectangular body + round head
    ctx.fillStyle = '#b0a898';
    ctx.fillRect(s.x - 1, s.y - 37, 2, 3);
    ctx.beginPath(); ctx.arc(s.x, s.y - 38, 1.1, 0, Math.PI * 2); ctx.fill();
    // Raised arms
    ctx.strokeStyle = '#b0a898'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(s.x - 1, s.y - 36); ctx.lineTo(s.x - 2, s.y - 37.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x + 1, s.y - 36); ctx.lineTo(s.x + 2, s.y - 37.5); ctx.stroke();
  }
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

function drawFisherman(ctx, s, b) {
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

  // Loop 33 (render S3): per-hut catch variants. Some huts have a bucket
  // of cod (orange), some have crab pots, some have hanging fish drying.
  const fhash = b ? (((b.x * 53 + b.y * 31) & 0xff)) : 0;
  const catchVar = fhash & 0x3;
  if (catchVar === 0) {
    // Classic bucket of fish
    ctx.fillStyle = '#888880';
    ctx.fillRect(s.x - 1, s.y - 8, 5, 4);
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(s.x - 1, s.y - 9, 5, 1);
    ctx.fillStyle = '#f07040';
    ctx.beginPath(); ctx.arc(s.x + 1.5, s.y - 6, 1.2, 0, Math.PI * 2); ctx.fill();
  } else if (catchVar === 1) {
    // Crab pot (cylindrical mesh with lid)
    ctx.fillStyle = '#a08050';
    ctx.beginPath(); ctx.ellipse(s.x + 2, s.y - 5, 3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6a5030';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(s.x + 2, s.y - 5 - i * 1.2, 3 - i * 0.2, 1.3 - i * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(s.x + 0.5, s.y - 8.5, 3, 0.6);
  } else if (catchVar === 2) {
    // Fish drying rack (3 fish hanging from a crossbar)
    ctx.strokeStyle = '#8a6a30';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x - 2, s.y - 9); ctx.lineTo(s.x + 6, s.y - 9); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const fx = s.x - 1 + i * 2.5;
      ctx.strokeStyle = 'rgba(180,160,120,0.8)';
      ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(fx, s.y - 9); ctx.lineTo(fx, s.y - 6); ctx.stroke();
      // Fish body
      ctx.fillStyle = '#c4a070';
      ctx.beginPath();
      ctx.ellipse(fx, s.y - 5, 0.9, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fish tail
      ctx.fillStyle = '#a88450';
      ctx.beginPath();
      ctx.moveTo(fx, s.y - 3.5); ctx.lineTo(fx - 0.8, s.y - 2.5); ctx.lineTo(fx + 0.8, s.y - 2.5);
      ctx.closePath(); ctx.fill();
    }
  } else {
    // Lobster trap stack (2 wooden boxes)
    ctx.fillStyle = '#6a4a28';
    ctx.fillRect(s.x, s.y - 9, 5, 3);
    ctx.fillRect(s.x + 1, s.y - 12, 4, 3);
    ctx.strokeStyle = '#8a6a48';
    ctx.lineWidth = 0.4;
    // Lattice lines
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(s.x + i * 1.5, s.y - 9); ctx.lineTo(s.x + i * 1.5, s.y - 6); ctx.stroke();
    }
    // Visible red lobster antenna
    ctx.strokeStyle = '#c02020';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(s.x + 4.5, s.y - 6); ctx.lineTo(s.x + 5.5, s.y - 7); ctx.stroke();
  }

  // Door
  ctx.fillStyle = '#4a2e10';
  ctx.fillRect(s.x - 3, s.y - 14, 6, 8);
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(s.x - 2.5, s.y - 13.5, 2.5, 7);
}

function drawBlacksmith(ctx, s, b) {
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

  // --- Forge window — warm glow. Loop 37 (render S3): fire color varies
  // per-smithy. Most forges are the classic orange-amber, but some are
  // cooler-burning blue/purple (elemental), green (alchemical), or
  // white-hot (master smith). Bright core pulses slightly with gameTick.
  const bsHash = b ? (((b.x * 89 + b.y * 41) & 0xff)) : 0;
  const firePalette = [
    { outer: '255,180,40', mid: '255,100,10', core: '255,220,80' },  // classic amber (most common)
    { outer: '255,180,40', mid: '255,100,10', core: '255,220,80' },  // (repeat — 2 of 6 slots)
    { outer: '160,100,255', mid: '100,40,200', core: '220,180,255' }, // purple-magical
    { outer: '90,220,180', mid: '40,160,120', core: '200,255,220' },  // alchemical green
    { outer: '255,240,200', mid: '230,210,160', core: '255,255,255' },// white-hot
    { outer: '80,160,230', mid: '40,100,200', core: '180,220,255' },  // blue
  ][bsHash % 6];
  const pulse = 0.9 + 0.1 * Math.sin((G.gameTick || 0) * 0.12 + bsHash);
  const forgeGlow = ctx.createRadialGradient(s.x - 4, s.y - 14, 1, s.x - 4, s.y - 14, 6);
  forgeGlow.addColorStop(0, `rgba(${firePalette.outer},${0.9 * pulse})`);
  forgeGlow.addColorStop(0.5, `rgba(${firePalette.mid},0.5)`);
  forgeGlow.addColorStop(1, `rgba(${firePalette.mid},0)`);
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
  ctx.fillStyle = `rgba(${firePalette.core},${0.7 * pulse})`;
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
  const t = G.gameTick * 0.015; // slower base rate — reduces per-tile flicker
  // Per-tile phase offset so neighbouring tiles don't animate in lockstep
  const phase = (tx * 2.3 + ty * 1.7) % (Math.PI * 2);

  // ── Layer 1: deep colour base with slow hue shift ────────────
  const colorShift = 0.5 + 0.5 * Math.sin(t * 0.6 + phase);
  const cr = Math.round(18 + colorShift * 16);
  const cg = Math.round(78 + colorShift * 38);
  const cb = Math.round(178 + colorShift * 30);
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 2: gentle shimmer overlay ─────────────────────────
  // Loop 6 (render S3): shimmer halved (0.18+0.12 → 0.08+0.06) and hue darkened
  // toward the base so cyan doesn't crust tile edges. Fresh-eyes critique
  // #2 saw the tiles as "disconnected blue diamonds with hard white borders".
  const shimmer = 0.08 + 0.06 * Math.sin(t * 0.9 + phase + 1.5);
  ctx.globalAlpha = a * shimmer;
  ctx.fillStyle = 'rgba(70,150,210,1)';
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 3: animated wave crests ────────────────────────────
  ctx.lineWidth = 1.5;
  const waveRows = [-8, -3, 2, 7];
  for (let i = 0; i < waveRows.length; i++) {
    const rowY = waveRows[i];
    const dir = (i % 2 === 0) ? 1 : -1;
    // Softer alpha oscillation — avoids rapid per-tile flicker
    // Loop 6 (render S3): wave crest alpha reduced (0.3+0.2 → 0.18+0.12)
    // and color shifted from near-white to a muted blue-white so waves
    // look like water movement, not painted lines on puzzle pieces.
    const wAlpha = 0.18 + 0.12 * Math.sin(t * 1.4 + phase + i * 1.3);
    ctx.globalAlpha = a * Math.max(0.05, wAlpha);
    ctx.strokeStyle = 'rgba(180,215,235,1)';
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
  const numGlints = 2;
  for (let gi = 0; gi < numGlints; gi++) {
    const gPhase = phase + gi * 2.1;
    const gx = x + Math.sin(t * 0.8 + gPhase) * 14;
    const gy = y + Math.cos(t * 0.6 + gPhase) * 7;
    const gSize = 2.0 + 1.2 * Math.abs(Math.sin(t * 1.8 + gPhase));
    const gAlpha = 0.35 + 0.25 * Math.sin(t * 2.0 + gPhase); // gentle, ~3s cycle
    ctx.globalAlpha = a * Math.max(0, gAlpha);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(gx, gy, gSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * Math.max(0, gAlpha) * 0.35;
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

// ── Minimap ─────────────────────────────────────────────────
const MINI_COLORS = {0:'#1a6aaa',1:'#d4a76a',2:'#4a7c4f',3:'#2d5a30',4:'#6b7280',5:'#4b6fa0',6:'#4a4a5a'};
// Loop 36 (render S3): expanded to cover fisherman/archery/blacksmith/
// bakery/windmill/chickencoop/cowpen (previously rendered as white fallback)
const MINI_BUILD = {
  house:'#d4a574', farm:'#7cb342', lumber:'#a3714f',
  quarry:'#8a8e9a', mine:'#5a85b8', market:'#e8a040',
  barracks:'#6a7a8a', tower:'#8a8a9a', church:'#e0e0e0',
  castle:'#ffd166', tavern:'#c07040', wall:'#7a7a7a',
  road:'#8a7a60', well:'#60a5fa', granary:'#c7a060',
  tradingpost:'#e8a040', school:'#d4b890',
  fisherman:'#4a90c8', archery:'#8a4a3a', blacksmith:'#aa5a30',
  bakery:'#dca858', windmill:'#e0d0a0', chickencoop:'#e8d060',
  cowpen:'#a88050',
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

  // Terrain tiles — explored tiles at normal color, unexplored as dimmed silhouette
  // (was '#070810' which matched the #08090f background — island was invisible on Day 1)
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (G.fog[y][x]) {
        mc.globalAlpha = 1;
        mc.fillStyle = MINI_COLORS[G.map[y][x]] || '#111';
      } else {
        // Show island shape at low alpha so player can see the map from turn 1
        mc.globalAlpha = 0.28;
        mc.fillStyle = MINI_COLORS[G.map[y][x]] || '#111';
      }
      mc.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  mc.globalAlpha = 1;

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
