// ════════════════════════════════════════════════════════════
// Renderer — isometric canvas, building sprites, minimap
// ════════════════════════════════════════════════════════════

import { G, TILE, TILE_COLORS, BUILDINGS, TW, TH, MAP_W, MAP_H, getSeasonData, getDaylight } from './state.js';

let C, ctx, minimapC, minimapCtx;
let logicalW, logicalH;

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
  ctx.translate(logicalW/2, logicalH/2);
  ctx.scale(G.camera.zoom, G.camera.zoom);
  ctx.translate(-G.camera.x, -G.camera.y);

  const daylight = getDaylight();

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

      // Grass shade variation via position hash + season tint
      if (tile === TILE.GRASS || tile === TILE.SAND) {
        const h = ((x * 374761 + y * 668265) & 0xff) / 255;
        const shade = tile === TILE.GRASS
          ? (h < 0.25 ? '#3d8f45' : h < 0.5 ? '#4da854' : h < 0.75 ? '#45a04a' : '#55b558')
          : (h < 0.5 ? '#e8c07a' : '#ddb46e');
        tileColor = shiftColor(shade, seasonShift);
      }

      ctx.globalAlpha = daylight;
      const tileDepth = tile === TILE.WATER ? 4 : tile === TILE.SAND ? 3 : tile === TILE.MOUNTAIN ? 8 : 4;

      // Top face
      ctx.fillStyle = tileColor;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2);
      ctx.lineTo(s.x + TW/2, s.y);
      ctx.lineTo(s.x, s.y + TH/2);
      ctx.lineTo(s.x - TW/2, s.y);
      ctx.closePath();
      ctx.fill();

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

      // Terrain blend: gradient strip at edges bordering different biomes
      if (tile >= TILE.SAND && tile <= TILE.FOREST && showDetails) {
        for (const [dx2, dy2] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = x+dx2, ny = y+dy2;
          if (nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) continue;
          const nTile = G.map[ny][nx];
          if (nTile === tile || nTile === TILE.WATER || nTile === TILE.MOUNTAIN) continue;
          const nColors = TILE_COLORS[nTile];
          // Draw gradient strip - more visible
          ctx.globalAlpha = daylight * 0.2;
          ctx.fillStyle = nColors[0];
          ctx.beginPath();
          ctx.arc(s.x + dx2*14, s.y + dy2*7, 10, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.globalAlpha = daylight;
      }

      // Right side face (darker)
      ctx.fillStyle = tile === TILE.WATER ? 'rgba(5,25,70,0.9)' : shiftColor(tileColor, [-30, -30, -30]);
      ctx.beginPath();
      ctx.moveTo(s.x + TW/2, s.y);
      ctx.lineTo(s.x, s.y + TH/2);
      ctx.lineTo(s.x, s.y + TH/2 + tileDepth);
      ctx.lineTo(s.x + TW/2, s.y + tileDepth);
      ctx.closePath();
      ctx.fill();

      // Left side face (medium dark)
      ctx.fillStyle = tile === TILE.WATER ? 'rgba(8,35,90,0.85)' : shiftColor(tileColor, [-18, -18, -18]);
      ctx.beginPath();
      ctx.moveTo(s.x - TW/2, s.y);
      ctx.lineTo(s.x, s.y + TH/2);
      ctx.lineTo(s.x, s.y + TH/2 + tileDepth);
      ctx.lineTo(s.x - TW/2, s.y + tileDepth);
      ctx.closePath();
      ctx.fill();

      // Cliff edge — darker rocky face where land meets water
      if (tile !== TILE.WATER && showDetails) {
        const waterRight = x < MAP_W-1 && G.map[y][x+1] === TILE.WATER;
        const waterDown  = y < MAP_H-1 && G.map[y+1][x] === TILE.WATER;
        if (waterRight) {
          ctx.globalAlpha = daylight * 0.45;
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
          ctx.globalAlpha = daylight * 0.35;
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
        ctx.globalAlpha = daylight * 0.6;
        if (gh < 80) {
          ctx.fillStyle = G.season === 'autumn' ? '#8a9a50' : '#3a8a3a';
          const gx = s.x - 8 + (gh % 16) + sway, gy = s.y - 4 + ((gh >> 4) % 6);
          ctx.beginPath();
          ctx.moveTo(gx, gy); ctx.lineTo(gx - 1 + sway * 0.5, gy - 3); ctx.lineTo(gx + 1, gy - 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 3 + sway * 0.5, gy - 4); ctx.lineTo(gx + 4, gy - 1);
          ctx.fill();
        }
        if (gh > 220 && G.season === 'spring') {
          ctx.fillStyle = ['#f0a0c0','#ffe066','#a0c0f0'][gh % 3];
          ctx.globalAlpha = daylight * 0.7;
          const fx = s.x - 6 + (gh % 12) + sway * 0.5, fy = s.y - 2 + ((gh >> 3) % 5);
          ctx.beginPath();
          ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = daylight;
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
        const backPeakTop = s.y - 16 - (mh % 6);
        const frontPeakTop = s.y - 12 - (mh % 4);

        // Shadow at base
        ctx.globalAlpha = daylight * 0.28;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 3, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = daylight;

        // Back peak — gradient from dark slate base to lighter grey peak
        const backGrad = ctx.createLinearGradient(s.x - 4, backPeakTop, s.x + 2, s.y + 4);
        backGrad.addColorStop(0, '#9898aa');
        backGrad.addColorStop(0.5, '#606070');
        backGrad.addColorStop(1, '#4a4a58');
        ctx.fillStyle = backGrad;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y + 4);
        ctx.lineTo(s.x - 4, backPeakTop);
        ctx.lineTo(s.x + 2, s.y - 10);
        ctx.lineTo(s.x + 6, s.y + 4);
        ctx.closePath();
        ctx.fill();

        // Front peak — gradient: darker base, mid-grey body
        const frontGrad = ctx.createLinearGradient(s.x + 3, frontPeakTop, s.x + 8, s.y + 4);
        frontGrad.addColorStop(0, '#a0a0b2');
        frontGrad.addColorStop(0.45, '#727282');
        frontGrad.addColorStop(1, '#585868');
        ctx.fillStyle = frontGrad;
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y + 4);
        ctx.lineTo(s.x + 3, frontPeakTop);
        ctx.lineTo(s.x + 8, s.y - 6);
        ctx.lineTo(s.x + 12, s.y + 4);
        ctx.closePath();
        ctx.fill();

        // Lit sunlight face — right-side highlight with gradient
        const litGrad = ctx.createLinearGradient(s.x + 3, frontPeakTop, s.x + 12, s.y + 4);
        litGrad.addColorStop(0, '#c0c0d0');
        litGrad.addColorStop(1, '#8888a0');
        ctx.fillStyle = litGrad;
        ctx.beginPath();
        ctx.moveTo(s.x + 3, frontPeakTop);
        ctx.lineTo(s.x + 8, s.y - 6);
        ctx.lineTo(s.x + 12, s.y + 4);
        ctx.lineTo(s.x + 3, s.y + 2);
        ctx.closePath();
        ctx.fill();

        // Rocky texture lines — thin dark strokes on the mountain face
        ctx.strokeStyle = 'rgba(30,30,45,0.45)';
        ctx.lineWidth = 0.7;
        // Back peak texture lines
        ctx.globalAlpha = daylight * 0.6;
        const backMid = s.y - 10;
        ctx.beginPath();
        ctx.moveTo(s.x - 8, backMid + 2);  ctx.lineTo(s.x - 5, backMid - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x - 6, backMid + 5);  ctx.lineTo(s.x - 2, backMid + 2);
        ctx.stroke();
        // Front peak texture lines
        ctx.beginPath();
        ctx.moveTo(s.x + 1, s.y - 4);  ctx.lineTo(s.x + 5, s.y - 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x - 1, s.y);      ctx.lineTo(s.x + 4, s.y - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x + 4, s.y - 9);  ctx.lineTo(s.x + 7, s.y - 6);
        ctx.stroke();
        ctx.globalAlpha = daylight;

        // Snow cap on back peak — wider, blue-white tint
        ctx.fillStyle = 'rgba(210,230,255,0.92)';
        ctx.beginPath();
        ctx.moveTo(s.x - 4, backPeakTop);
        ctx.lineTo(s.x - 7, backPeakTop + 5);
        ctx.lineTo(s.x - 3, backPeakTop + 6);
        ctx.lineTo(s.x + 0, backPeakTop + 4);
        ctx.lineTo(s.x + 2, s.y - 10);
        ctx.closePath();
        ctx.fill();
        // Highlight on back snow
        ctx.fillStyle = 'rgba(240,250,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(s.x - 4, backPeakTop);
        ctx.lineTo(s.x - 5, backPeakTop + 3);
        ctx.lineTo(s.x - 1, backPeakTop + 2);
        ctx.closePath();
        ctx.fill();

        // Snow cap on front peak — blue-white tint, slightly jagged
        ctx.fillStyle = 'rgba(215,235,255,0.90)';
        ctx.beginPath();
        ctx.moveTo(s.x + 3, frontPeakTop);
        ctx.lineTo(s.x + 1, frontPeakTop + 4);
        ctx.lineTo(s.x + 4, frontPeakTop + 5);
        ctx.lineTo(s.x + 7, frontPeakTop + 3);
        ctx.lineTo(s.x + 8, s.y - 6);
        ctx.closePath();
        ctx.fill();
        // Highlight on front snow
        ctx.fillStyle = 'rgba(240,250,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(s.x + 3, frontPeakTop);
        ctx.lineTo(s.x + 2, frontPeakTop + 2);
        ctx.lineTo(s.x + 5, frontPeakTop + 2);
        ctx.closePath();
        ctx.fill();
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
    const bobRaw = isMoving ? Math.sin(G.gameTick * 0.22 + c.x * 3) : 0;
    const bob = bobRaw * 1.2; // gentler vertical bob
    const cy = s.y + bob;

    // Leg-swing phase (separate so it's decoupled from bob)
    const legPhase = G.gameTick * 0.28 + c.x * 3;

    // Shadow — slightly larger to match bigger body
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(s.x, cy + 3, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs — stroked lines for better look; stride when walking, stubs when idle
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    if (isMoving) {
      const legSwing = Math.sin(legPhase) * 3;
      ctx.beginPath();
      ctx.moveTo(s.x - 1.5, cy - 2);
      ctx.lineTo(s.x - 1.5 - legSwing * 0.3, cy + 5 + legSwing * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x + 1.5, cy - 2);
      ctx.lineTo(s.x + 1.5 + legSwing * 0.3, cy + 5 - legSwing * 0.2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(s.x - 1.5, cy - 2);
      ctx.lineTo(s.x - 1.5, cy + 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x + 1.5, cy - 2);
      ctx.lineTo(s.x + 1.5, cy + 5);
      ctx.stroke();
    }

    // Body — job-colored clothing
    let bodyColor = '#bbb'; // idle: grey
    if (c.jobBuilding) {
      const jt = c.jobBuilding.type;
      if (jt === 'farm') bodyColor = '#7cb342';
      else if (jt === 'lumber') bodyColor = '#a3714f';
      else if (jt === 'quarry' || jt === 'mine') bodyColor = '#6a7a8a';
      else if (jt === 'market') bodyColor = '#e8a040';
      else if (jt === 'barracks') bodyColor = '#5a6a7a';
      else if (jt === 'tavern') bodyColor = '#c07040';
      else bodyColor = '#8899aa';
    }
    if (c.state === 'eating') bodyColor = '#4ade80';

    // Torso — capsule/rounded-rect shape (wider, taller than old circle)
    const torsoW = 5, torsoH = 7, torsoTop = cy - 12, torsoR = 2.5;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(s.x - torsoW, torsoTop, torsoW * 2, torsoH, torsoR);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Arms — swing when walking, hang at sides when idle
    const armSwing = isMoving ? Math.sin(legPhase + Math.PI) * 2.5 : 0;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - torsoW, torsoTop + 1.5);
    ctx.lineTo(s.x - torsoW - 1.5, torsoTop + 4 + armSwing);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x + torsoW, torsoTop + 1.5);
    ctx.lineTo(s.x + torsoW + 1.5, torsoTop + 4 - armSwing);
    ctx.stroke();

    // Head — skin tone, radius 3.5
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(s.x, cy - 17, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Hair — better coverage over top of head
    const hairHash = (c.name.charCodeAt(0) * 31 + c.name.charCodeAt(1)) % 4;
    ctx.fillStyle = ['#3a2a1a','#8a6a3a','#2a2a2a','#c08050'][hairHash];
    ctx.beginPath();
    ctx.arc(s.x, cy - 17.5, 3.2, Math.PI * 0.65, Math.PI * 2.35);
    ctx.closePath();
    ctx.fill();

    // Eyes — only when zoomed in enough
    if (G.camera.zoom >= 1.2) {
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.arc(s.x - 1.3, cy - 17, 0.55, 0, Math.PI * 2);
      ctx.arc(s.x + 1.3, cy - 17, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    if (G.camera.zoom >= 0.7) {
      // Tool icon when working
      if (c.state === 'working' && c.jobBuilding) {
        const jt = c.jobBuilding.type;
        const toolX = s.x + torsoW + 2;
        const toolY = torsoTop + 2;
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
        ctx.fillText(emote, s.x, cy - 23);
        ctx.globalAlpha = daylight;
      }

      // Carrying indicator (resource on shoulder)
      if (c.carrying) {
        const cc = {wood:'#a3714f',stone:'#9ca3af',food:'#4ade80',gold:'#ffd166',iron:'#60a5fa'}[c.carrying] || '#fff';
        ctx.fillStyle = cc;
        ctx.fillRect(s.x + 3, cy - 12, 3, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(s.x + 3, cy - 12, 3, 1);
      }
    } // end zoom >= 0.7

    // Hover highlight ring
    if (c === hoveredCitizen) {
      ctx.strokeStyle = 'rgba(255,209,102,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, cy - 9, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Selected citizen highlight — pulsing ring
    if (c === G.selectedCitizen) {
      const pulse = 0.5 + 0.4 * Math.sin(G.gameTick * 0.1);
      ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, cy - 9, 10, 0, Math.PI * 2);
      ctx.stroke();
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
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.text, s.x, s.y + p.offsetY - 20);
      ctx.shadowBlur = 0;
    }
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

  // Night overlay — gradient instead of flat fill
  if (daylight < 0.8) {
    const overlayAlpha = (1-daylight) * 0.7;
    ctx.globalAlpha = overlayAlpha;
    // Radial gradient: deeper blue at edges, slightly lighter center
    const nightGrad = ctx.createRadialGradient(0, -2000, 500, 0, 0, 7000);
    nightGrad.addColorStop(0, 'rgba(8,10,30,0.6)');
    nightGrad.addColorStop(0.5, 'rgba(5,8,25,0.85)');
    nightGrad.addColorStop(1, 'rgba(2,4,18,1)');
    ctx.fillStyle = nightGrad;
    ctx.fillRect(-5000,-5000,10000,10000);
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
  ctx.globalAlpha = daylight;

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
  }

  // Shadow — soft ground shadow offset to the right
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(s.x + 3, s.y + 4, 14, 5, 0.15, 0, Math.PI*2);
  ctx.fill();

  // Scale up buildings by 1.2x for visual presence
  // Anchor at the building base (s.y) so scaling grows upward, keeping the base pinned to the tile
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(1.2, 1.2);
  ctx.translate(-s.x, -s.y);

  switch (b.type) {
    case 'house': drawHouse(ctx, s); break;
    case 'farm': drawFarm(ctx, s); break;
    case 'lumber': drawLumber(ctx, s); break;
    case 'quarry': drawQuarry(ctx, s); break;
    case 'mine': drawMine(ctx, s); break;
    case 'market': drawMarket(ctx, s); break;
    case 'barracks': drawBarracks(ctx, s); break;
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
    default: drawGeneric(ctx, s, def); break;
  }
  ctx.restore(); // undo the 1.3x scale

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
      ctx.globalAlpha = daylight;
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
      ctx.globalAlpha = daylight;
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
  // Door
  ctx.fillStyle = '#4a2a12';
  ctx.fillRect(s.x-3, s.y-10, 6, 6);
  // Window
  ctx.fillStyle = '#ffeebb';
  ctx.fillRect(s.x+4, s.y-18, 3, 3);
  // Chimney
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(s.x+5, s.y-35, 4, 8);
}

function drawFarm(ctx, s) {
  // Fence posts — richer warm wood tone
  ctx.fillStyle = '#7a4e0e';
  ctx.fillRect(s.x-14, s.y-6, 2, 6);
  ctx.fillRect(s.x+12, s.y-6, 2, 6);
  ctx.fillRect(s.x-14, s.y+2, 28, 2);
  // Additional fence posts for detail
  ctx.fillRect(s.x-5, s.y-6, 2, 6);
  ctx.fillRect(s.x+4, s.y-6, 2, 6);
  // Field rows — darker richer soil
  ctx.fillStyle = '#4e3210';
  for (let i = -12; i < 12; i += 4) {
    ctx.fillRect(s.x+i, s.y-4, 3, 6);
  }
  // Crop tops — more vivid green
  ctx.fillStyle = '#5aab1e';
  for (let i = -11; i < 12; i += 4) {
    ctx.fillRect(s.x+i, s.y-8, 2, 4);
  }
  // Golden ripe crop tips
  ctx.fillStyle = '#d4a017';
  for (let i = -11; i < 12; i += 8) {
    ctx.fillRect(s.x+i, s.y-10, 2, 2);
  }
}

function drawLumber(ctx, s) {
  ctx.fillStyle = '#8b6a4e';
  ctx.fillRect(s.x-10, s.y-18, 20, 14);
  ctx.fillStyle = '#6a5040';
  ctx.beginPath();
  ctx.moveTo(s.x+10, s.y-18); ctx.lineTo(s.x+14, s.y-15);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+10, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Roof
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(s.x-13, s.y-18); ctx.lineTo(s.x, s.y-26);
  ctx.lineTo(s.x+13, s.y-18); ctx.closePath();
  ctx.fill();
  // Log pile
  ctx.fillStyle = '#a3714f';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(s.x-6+i*4, s.y-1, 2.5, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawQuarry(ctx, s) {
  // Pit
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y-TH/2+4); ctx.lineTo(s.x+TW/4, s.y);
  ctx.lineTo(s.x, s.y+TH/2-4); ctx.lineTo(s.x-TW/4, s.y);
  ctx.closePath();
  ctx.fill();
  // Rubble
  ctx.fillStyle = '#7a7a88';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(s.x-5+i*3, s.y-2+((i%2)*3), 2, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawMine(ctx, s) {
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(s.x-10, s.y-16, 20, 12);
  // Entrance arch
  ctx.fillStyle = '#2a2a34';
  ctx.beginPath();
  ctx.arc(s.x, s.y-8, 6, Math.PI, 0);
  ctx.lineTo(s.x+6, s.y-4); ctx.lineTo(s.x-6, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Support beams
  ctx.fillStyle = '#8b6a4e';
  ctx.fillRect(s.x-7, s.y-14, 2, 10);
  ctx.fillRect(s.x+5, s.y-14, 2, 10);
  ctx.fillRect(s.x-7, s.y-15, 14, 2);
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
  ctx.fillStyle = '#5a6070';
  ctx.fillRect(s.x-10, s.y-18, 20, 14);
  ctx.fillStyle = '#4a5060';
  ctx.beginPath();
  ctx.moveTo(s.x+10, s.y-18); ctx.lineTo(s.x+14, s.y-15);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+10, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Flat roof with crenellations
  ctx.fillStyle = '#6a7080';
  ctx.fillRect(s.x-12, s.y-20, 24, 3);
  for (let i = -10; i < 12; i += 5) {
    ctx.fillRect(s.x+i, s.y-24, 3, 4);
  }
  // Flag
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(s.x+8, s.y-30); ctx.lineTo(s.x+16, s.y-27);
  ctx.lineTo(s.x+8, s.y-24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(s.x+7, s.y-30, 2, 14);
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
  ctx.fillStyle = '#8a8a94';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y-4, 8, 5, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#2a5a8a';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y-4, 5, 3, 0, 0, Math.PI*2);
  ctx.fill();
  // Rope post
  ctx.fillStyle = '#6a5a4a';
  ctx.fillRect(s.x+5, s.y-16, 2, 12);
  ctx.fillRect(s.x-2, s.y-16, 9, 2);
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
  // Door
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(s.x-3, s.y-12, 6, 8);
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
  // Dock platform
  ctx.fillStyle = '#8b6a4e';
  ctx.fillRect(s.x - 14, s.y - 6, 28, 6);
  ctx.fillStyle = '#6a5040';
  ctx.fillRect(s.x - 14, s.y - 8, 28, 2);
  // Pier posts
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x - 12, s.y - 2, 2, 6);
  ctx.fillRect(s.x + 10, s.y - 2, 2, 6);
  // Sail/flag
  ctx.fillStyle = '#d4a030';
  ctx.fillRect(s.x + 6, s.y - 24, 2, 18);
  ctx.fillStyle = b.caravanOut ? '#999' : '#e8c060';
  ctx.beginPath();
  ctx.moveTo(s.x + 8, s.y - 22);
  ctx.lineTo(s.x + 18, s.y - 18);
  ctx.lineTo(s.x + 8, s.y - 14);
  ctx.closePath();
  ctx.fill();
  // Crates
  ctx.fillStyle = '#a3714f';
  ctx.fillRect(s.x - 8, s.y - 12, 5, 4);
  ctx.fillStyle = '#8b6a4e';
  ctx.fillRect(s.x - 3, s.y - 11, 4, 3);
  // Status indicator
  if (b.caravanOut) {
    ctx.fillStyle = 'rgba(255,200,50,0.5)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛵ en route', s.x, s.y - 28);
  }
}

function drawCastle(ctx, s) {
  // Grand multi-tower castle
  // Main keep
  ctx.fillStyle = '#8a8a9a';
  ctx.fillRect(s.x-14, s.y-32, 28, 28);
  ctx.fillStyle = '#7a7a8a';
  ctx.beginPath();
  ctx.moveTo(s.x+14, s.y-32); ctx.lineTo(s.x+18, s.y-28);
  ctx.lineTo(s.x+18, s.y); ctx.lineTo(s.x+14, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Crenellations on keep
  ctx.fillStyle = '#9a9aaa';
  for (let i = -12; i < 14; i += 5) {
    ctx.fillRect(s.x + i, s.y - 36, 3, 4);
  }
  // Left tower
  ctx.fillStyle = '#8a8a9a';
  ctx.fillRect(s.x-20, s.y-40, 10, 36);
  ctx.fillStyle = '#9a9aaa';
  for (let i = -19; i < -10; i += 4) {
    ctx.fillRect(s.x + i, s.y - 44, 3, 4);
  }
  // Right tower
  ctx.fillStyle = '#8a8a9a';
  ctx.fillRect(s.x+10, s.y-40, 10, 36);
  ctx.fillStyle = '#9a9aaa';
  for (let i = 11; i < 20; i += 4) {
    ctx.fillRect(s.x + i, s.y - 44, 3, 4);
  }
  // Gate
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 10, 5, Math.PI, 0);
  ctx.lineTo(s.x + 5, s.y - 4);
  ctx.lineTo(s.x - 5, s.y - 4);
  ctx.closePath();
  ctx.fill();
  // Portcullis lines
  ctx.strokeStyle = '#5a5a64';
  ctx.lineWidth = 0.8;
  for (let i = -3; i <= 3; i += 2) {
    ctx.beginPath();
    ctx.moveTo(s.x + i, s.y - 14); ctx.lineTo(s.x + i, s.y - 4);
    ctx.stroke();
  }
  // Flags on towers
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(s.x - 16, s.y - 50, 2, 10);
  ctx.fillRect(s.x + 14, s.y - 50, 2, 10);
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(s.x-14, s.y-50); ctx.lineTo(s.x-6, s.y-47); ctx.lineTo(s.x-14, s.y-44);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s.x+16, s.y-50); ctx.lineTo(s.x+24, s.y-47); ctx.lineTo(s.x+16, s.y-44);
  ctx.closePath(); ctx.fill();
  // Windows
  ctx.fillStyle = '#ffeebb';
  ctx.fillRect(s.x-6, s.y-26, 3, 4);
  ctx.fillRect(s.x+3, s.y-26, 3, 4);
  ctx.fillRect(s.x-6, s.y-18, 3, 4);
  ctx.fillRect(s.x+3, s.y-18, 3, 4);
}

function drawGranary(ctx, s) {
  // Round clay storage building
  ctx.fillStyle = '#c09060';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 10, 10, Math.PI, 0);
  ctx.lineTo(s.x + 10, s.y - 2);
  ctx.lineTo(s.x - 10, s.y - 2);
  ctx.closePath();
  ctx.fill();
  // Dome top
  ctx.fillStyle = '#a07848';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 10, 10, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Door
  ctx.fillStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 4, 3, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Grain texture dots
  ctx.fillStyle = '#d4a870';
  for (let i = -5; i <= 5; i += 3) {
    ctx.fillRect(s.x + i, s.y - 14 + Math.abs(i) * 0.3, 1.5, 1.5);
  }
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
  // Door
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x - 3, s.y - 8, 6, 4);
}

function drawSchool(ctx, s) {
  // Main building
  ctx.fillStyle = '#c4a882';
  ctx.fillRect(s.x - 12, s.y - 18, 24, 14);
  ctx.fillStyle = '#a89070';
  ctx.beginPath();
  ctx.moveTo(s.x + 12, s.y - 18); ctx.lineTo(s.x + 15, s.y - 15);
  ctx.lineTo(s.x + 15, s.y - 1); ctx.lineTo(s.x + 12, s.y - 4);
  ctx.closePath();
  ctx.fill();
  // Flat roof with slight overhang
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(s.x - 14, s.y - 20, 28, 3);
  // Windows (multiple, suggesting classrooms)
  ctx.fillStyle = '#ffeebb';
  for (let i = -8; i <= 6; i += 5) {
    ctx.fillRect(s.x + i, s.y - 16, 3, 3);
  }
  // Door
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x - 2, s.y - 8, 5, 4);
  // Bell tower
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(s.x + 7, s.y - 28, 4, 10);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(s.x + 9, s.y - 25, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Book icon on front
  ctx.fillStyle = '#4a6080';
  ctx.fillRect(s.x - 8, s.y - 12, 4, 3);
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
  const c1 = seasonShift ? shiftColor('#2e7e35', seasonShift) : '#2e7e35';
  const c2 = seasonShift ? shiftColor('#3d9e42', seasonShift) : '#3d9e42';
  const c3 = seasonShift ? shiftColor('#236b28', seasonShift) : '#236b28';
  const c4 = seasonShift ? shiftColor('#55b55a', seasonShift) : '#55b55a';

  // Pick variant based on position
  const variant = ((Math.abs(Math.round(x)) * 7 + Math.abs(Math.round(y)) * 13) % 3);

  // Size variation
  const size = 0.85 + ((Math.abs(Math.round(x)) * 374761 + Math.abs(Math.round(y)) * 668265) & 0xff) / 255 * 0.35;

  // Shadow
  ctx.globalAlpha = a * 0.15;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 4, 10*size, 4*size, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;

  // Trunk
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 2, y - 2, 4, 10);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x - 1, y, 2, 7);

  if (variant === 0) {
    // Round deciduous tree (original but with gradient)
    const grad = ctx.createRadialGradient(x-2, y-10, 2, x, y-4, 14*size);
    grad.addColorStop(0, c4);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c3);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y - 4, 14*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.arc(x - 2, y - 12*size, 9*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 16*size, 6*size, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 1) {
    // Conical pine/spruce tree
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.moveTo(x, y - 22*size);
    ctx.lineTo(x - 10*size, y - 2);
    ctx.lineTo(x + 10*size, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(x, y - 22*size);
    ctx.lineTo(x - 7*size, y - 8);
    ctx.lineTo(x + 7*size, y - 8);
    ctx.closePath();
    ctx.fill();
    // Snow tip or light highlight
    ctx.fillStyle = c4;
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 22*size);
    ctx.lineTo(x - 3*size, y - 16*size);
    ctx.lineTo(x + 3*size, y - 16*size);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = a;
  } else {
    // Bushy/wide oak
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.ellipse(x, y - 6, 16*size, 10*size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 10, 10*size, 7*size, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c4;
    ctx.globalAlpha = a * 0.4;
    ctx.beginPath();
    ctx.arc(x + 5, y - 8, 5*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 6, y - 5, 4*size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
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
  house:'#e8a060', farm:'#7cb342', lumber:'#a3714f', quarry:'#9ca3af',
  mine:'#5577aa', market:'#fbbf24', barracks:'#ef4444', tower:'#f87171',
  wall:'#9ca3af', road:'#6b7280', tradingpost:'#f59e0b', granary:'#d4a76a',
  church:'#e0e0ff', school:'#93c5fd', castle:'#ffd166', tavern:'#c084fc',
  well:'#60a5fa',
};

function renderMinimap() {
  const mc = minimapCtx;
  const mw = minimapC.width, mh = minimapC.height;
  const sx = mw / MAP_W, sy = mh / MAP_H;

  // Background
  mc.fillStyle = '#08090f';
  mc.fillRect(0, 0, mw, mh);

  // Terrain tiles — explored and unexplored (fog = dark)
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (G.fog[y][x]) {
        mc.fillStyle = MINI_COLORS[G.map[y][x]] || '#111';
      } else {
        mc.fillStyle = '#0d0f1a';
      }
      mc.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }

  // Buildings as colored circle dots with a dark halo so they pop against terrain
  // Only show buildings on explored tiles
  for (const b of G.buildings) {
    if (!G.fog[b.y]?.[b.x]) continue;
    const bx = (b.x + 0.5) * sx;
    const by = (b.y + 0.5) * sy;
    const r = b.type === 'castle' ? 4 : b.type === 'tower' || b.type === 'church' ? 3.5 : 3;
    mc.beginPath();
    mc.arc(bx, by, r + 1.5, 0, Math.PI * 2);
    mc.fillStyle = 'rgba(0,0,0,0.65)';
    mc.fill();
    mc.beginPath();
    mc.arc(bx, by, r, 0, Math.PI * 2);
    mc.fillStyle = MINI_BUILD[b.type] || '#fff';
    mc.fill();
  }

  // Citizens as tiny bright yellow dots
  mc.fillStyle = '#facc15';
  for (const c of G.citizens) {
    mc.fillRect(Math.round(c.x * sx) - 0.5, Math.round(c.y * sy) - 0.5, 2, 2);
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

  // Subtle inner vignette for depth
  const vign = mc.createRadialGradient(mw / 2, mh / 2, mw * 0.3, mw / 2, mh / 2, mw * 0.72);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.35)');
  mc.fillStyle = vign;
  mc.fillRect(0, 0, mw, mh);
}
