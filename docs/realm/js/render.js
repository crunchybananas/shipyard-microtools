// ════════════════════════════════════════════════════════════
// Renderer — isometric canvas, building sprites, minimap
// ════════════════════════════════════════════════════════════

import { G, TILE, TILE_COLORS, BUILDINGS, TW, TH, MAP_W, MAP_H, getSeasonData } from './state.js';

let C, ctx, minimapC, minimapCtx;

export function initRenderer(canvas, minimap) {
  C = canvas;
  ctx = C.getContext('2d');
  minimapC = minimap;
  minimapCtx = minimap.getContext('2d');
}

export function resizeCanvas() {
  C.width = window.innerWidth;
  C.height = window.innerHeight;
}

export function toScreen(tx, ty) {
  return { x: (tx-ty)*TW/2, y: (tx+ty)*TH/2 };
}

export function toWorld(sx, sy) {
  const wx = sx/(TW/2), wy = sy/(TH/2);
  return { x: (wx+wy)/2, y: (wy-wx)/2 };
}

export function screenToWorld(mx, my) {
  const sx = (mx - C.width/2)/G.camera.zoom + G.camera.x;
  const sy = (my - C.height/2)/G.camera.zoom + G.camera.y;
  const w = toWorld(sx, sy);
  return { x: Math.floor(w.x), y: Math.floor(w.y) };
}

function shiftColor(hex, shift) {
  // Shift an RGB hex color by [dr, dg, db]
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1,3),16) + shift[0]));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3,5),16) + shift[1]));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5,7),16) + shift[2]));
  return `rgb(${r},${g},${b})`;
}

function getDaylight() {
  const t = G.dayPhase / G.dayLength;
  if (t < 0.1) return 0.55 + (t/0.1)*0.45;  // dawn
  if (t < 0.6) return 1;                      // day
  if (t < 0.75) return 1 - ((t-0.6)/0.15)*0.35; // dusk
  return 0.65 - ((t-0.75)/0.25)*0.1;          // night (floor 0.55)
}

export function render() {
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, C.width, C.height);

  ctx.save();
  ctx.translate(C.width/2, C.height/2);
  ctx.scale(G.camera.zoom, G.camera.zoom);
  ctx.translate(-G.camera.x, -G.camera.y);

  const daylight = getDaylight();

  // ── Tiles ─────────────────────────────────────────────────
  // Viewport culling
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(C.width, C.height);
  const pad = 4;
  const minX = Math.max(0, Math.floor(tl.x) - pad);
  const maxX = Math.min(MAP_W-1, Math.ceil(br.x) + pad);
  const minY = Math.max(0, Math.floor(tl.y) - pad);
  const maxY = Math.min(MAP_H-1, Math.ceil(br.y) + pad);

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
          ? (h < 0.33 ? '#3d6b42' : h < 0.66 ? '#4a7c4f' : '#558c5a')
          : (h < 0.5 ? '#d4a76a' : '#c99a5c');
        tileColor = shiftColor(shade, seasonShift);
      }

      ctx.fillStyle = tileColor;
      ctx.globalAlpha = daylight;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2);
      ctx.lineTo(s.x + TW/2, s.y);
      ctx.lineTo(s.x, s.y + TH/2);
      ctx.lineTo(s.x - TW/2, s.y);
      ctx.closePath();
      ctx.fill();

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

      // Tile features
      if (tile === TILE.FOREST) drawTree(ctx, s.x, s.y-8, daylight, seasonShift);
      else if (tile === TILE.STONE) drawRock(ctx, s.x, s.y-4, daylight);
      else if (tile === TILE.IRON) drawIronOre(ctx, s.x, s.y-4, daylight);
      else if (tile === TILE.WATER) drawWater(ctx, s.x, s.y, daylight);

      // Hover
      if (G.hoveredTile && G.hoveredTile.x===x && G.hoveredTile.y===y) {
        const valid = G.selectedBuild ? canPlaceCheck(G.selectedBuild, x, y) : true;
        ctx.strokeStyle = G.selectedBuild
          ? (valid ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)')
          : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - TH/2);
        ctx.lineTo(s.x + TW/2, s.y);
        ctx.lineTo(s.x, s.y + TH/2);
        ctx.lineTo(s.x - TW/2, s.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // ── Buildings ─────────────────────────────────────────────
  const sorted = [...G.buildings].sort((a,b) => (a.x+a.y)-(b.x+b.y));
  for (const b of sorted) {
    const s = toScreen(b.x, b.y);
    drawBuilding(ctx, b, s, daylight);
  }

  // ── Citizens ──────────────────────────────────────────────
  for (const c of G.citizens) {
    const s = toScreen(c.x, c.y);
    ctx.globalAlpha = daylight;

    // Walking bob when moving
    const isMoving = c.path && c.pathIdx < (c.path?.length ?? 0);
    const bob = isMoving ? Math.sin(G.gameTick * 0.25 + c.x * 3) * 1.5 : 0;
    const cy = s.y + bob;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(s.x, cy+2, 4, 2, 0, 0, Math.PI*2);
    ctx.fill();

    // Legs (when walking)
    if (isMoving) {
      const legSwing = Math.sin(G.gameTick * 0.3 + c.x * 3) * 2;
      ctx.fillStyle = '#555';
      ctx.fillRect(s.x - 2, cy - 2, 1.5, 3 + legSwing * 0.3);
      ctx.fillRect(s.x + 0.5, cy - 2, 1.5, 3 - legSwing * 0.3);
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

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(s.x, cy - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(s.x, cy - 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Hair (tiny variation)
    const hairHash = (c.name.charCodeAt(0) * 31 + c.name.charCodeAt(1)) % 4;
    ctx.fillStyle = ['#3a2a1a','#8a6a3a','#2a2a2a','#c08050'][hairHash];
    ctx.beginPath();
    ctx.arc(s.x, cy - 13.5, 2, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // Carrying indicator (resource on shoulder)
    if (c.carrying) {
      const cc = {wood:'#a3714f',stone:'#9ca3af',food:'#4ade80',gold:'#ffd166',iron:'#60a5fa'}[c.carrying] || '#fff';
      ctx.fillStyle = cc;
      ctx.fillRect(s.x + 2, cy - 10, 3, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(s.x + 2, cy - 10, 3, 1);
    }
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
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

    if (p.type === 'smoke') {
      const sz = p.size || 2;
      ctx.fillStyle = `rgba(180,180,200,${ctx.globalAlpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y + p.offsetY - 20, sz, 0, Math.PI * 2);
      ctx.fill();
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
    const s = toScreen(G.hoveredTile.x, G.hoveredTile.y);
    const valid = canPlaceCheck(G.selectedBuild, G.hoveredTile.x, G.hoveredTile.y);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - TH/2);
    ctx.lineTo(s.x + TW/2, s.y);
    ctx.lineTo(s.x, s.y + TH/2);
    ctx.lineTo(s.x - TW/2, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(BUILDINGS[G.selectedBuild].icon, s.x, s.y-4);
  }

  // Night overlay
  if (daylight < 0.8) {
    ctx.globalAlpha = (1-daylight) * 0.4;
    ctx.fillStyle = '#0a0e2e';
    ctx.fillRect(-5000,-5000,10000,10000);
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Minimap ───────────────────────────────────────────────
  renderMinimap();

  // ── Selected building highlight ───────────────────────────
  if (G.selectedBuilding) {
    const sb = G.selectedBuilding;
    ctx.save();
    ctx.translate(C.width/2, C.height/2);
    ctx.scale(G.camera.zoom, G.camera.zoom);
    ctx.translate(-G.camera.x, -G.camera.y);
    const s = toScreen(sb.x, sb.y);
    ctx.strokeStyle = 'rgba(129,140,248,0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - TH/2 - 2);
    ctx.lineTo(s.x + TW/2 + 2, s.y);
    ctx.lineTo(s.x, s.y + TH/2 + 2);
    ctx.lineTo(s.x - TW/2 - 2, s.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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
function drawBuilding(ctx, b, s, daylight) {
  const def = BUILDINGS[b.type];
  ctx.globalAlpha = daylight;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y+4, 14, 6, 0, 0, Math.PI*2);
  ctx.fill();

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
    case 'wall': drawWall(ctx, s); break;
    case 'road': drawRoad(ctx, s); break;
    case 'tradingpost': drawTradingPost(ctx, s, b); break;
    default: drawGeneric(ctx, s, def); break;
  }

  // HP bar
  if (b.hp < 100) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(s.x-12, s.y-38, 24, 3);
    ctx.fillStyle = b.hp > 50 ? '#4ade80' : '#f87171';
    ctx.fillRect(s.x-12, s.y-38, 24*(b.hp/100), 3);
  }
}

function drawHouse(ctx, s) {
  // Walls
  ctx.fillStyle = '#d4a574';
  ctx.fillRect(s.x-9, s.y-20, 18, 16);
  // Side wall (iso depth)
  ctx.fillStyle = '#b8905e';
  ctx.beginPath();
  ctx.moveTo(s.x+9, s.y-20); ctx.lineTo(s.x+14, s.y-17);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+9, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Roof
  ctx.fillStyle = '#c0392b';
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
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x-3, s.y-10, 6, 6);
  // Window
  ctx.fillStyle = '#ffeebb';
  ctx.fillRect(s.x+4, s.y-18, 3, 3);
  // Chimney
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(s.x+5, s.y-35, 4, 8);
}

function drawFarm(ctx, s) {
  // Fence posts
  ctx.fillStyle = '#8b6914';
  ctx.fillRect(s.x-14, s.y-6, 2, 6);
  ctx.fillRect(s.x+12, s.y-6, 2, 6);
  ctx.fillRect(s.x-14, s.y+2, 28, 1);
  // Field rows
  ctx.fillStyle = '#6b4e1a';
  for (let i = -12; i < 12; i += 4) {
    ctx.fillRect(s.x+i, s.y-4, 3, 6);
  }
  // Crop tops
  ctx.fillStyle = '#7cb342';
  for (let i = -11; i < 12; i += 4) {
    ctx.fillRect(s.x+i, s.y-8, 2, 4);
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
  ctx.fillStyle = '#d4a574';
  ctx.fillRect(s.x-12, s.y-8, 24, 6);
  // Awning
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(s.x-14, s.y-20); ctx.lineTo(s.x+14, s.y-20);
  ctx.lineTo(s.x+16, s.y-8); ctx.lineTo(s.x-16, s.y-8);
  ctx.closePath();
  ctx.fill();
  // Stripes
  ctx.fillStyle = '#fff';
  for (let i = -12; i < 14; i += 6) {
    ctx.beginPath();
    ctx.moveTo(s.x+i, s.y-20); ctx.lineTo(s.x+i+3, s.y-20);
    ctx.lineTo(s.x+i+4, s.y-8); ctx.lineTo(s.x+i+1, s.y-8);
    ctx.closePath();
    ctx.fill();
  }
  // Goods
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(s.x-6, s.y-12, 4, 3);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(s.x+2, s.y-12, 4, 3);
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
  ctx.fillStyle = '#8a8a9a';
  ctx.fillRect(s.x-6, s.y-34, 12, 30);
  ctx.fillStyle = '#7a7a8a';
  ctx.beginPath();
  ctx.moveTo(s.x+6, s.y-34); ctx.lineTo(s.x+9, s.y-31);
  ctx.lineTo(s.x+9, s.y-1); ctx.lineTo(s.x+6, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Crenellations
  ctx.fillStyle = '#9a9aaa';
  for (let i = -5; i < 6; i += 4) {
    ctx.fillRect(s.x+i, s.y-38, 3, 4);
  }
  // Window slit
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(s.x-1, s.y-22, 2, 5);
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
  ctx.fillStyle = '#b8905e';
  ctx.fillRect(s.x-10, s.y-20, 20, 16);
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
  // Sign
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s.x-12, s.y-14, 2, 8);
  ctx.fillStyle = '#e8c060';
  ctx.fillRect(s.x-16, s.y-14, 6, 4);
  // Windows (warm glow)
  ctx.fillStyle = '#ffe088';
  ctx.fillRect(s.x-5, s.y-18, 4, 3);
  ctx.fillRect(s.x+3, s.y-18, 4, 3);
}

function drawWall(ctx, s) {
  ctx.fillStyle = '#7a7a8a';
  ctx.fillRect(s.x-TW/4, s.y-8, TW/2, 8);
  ctx.fillStyle = '#6a6a7a';
  ctx.fillRect(s.x-TW/4, s.y-10, TW/2, 2);
  // Brick lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  for (let i = -TW/4+4; i < TW/4; i += 6) {
    ctx.beginPath();
    ctx.moveTo(s.x+i, s.y-8); ctx.lineTo(s.x+i, s.y);
    ctx.stroke();
  }
}

function drawRoad(ctx, s) {
  ctx.fillStyle = '#4a4a40';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y-TH/4); ctx.lineTo(s.x+TW/4, s.y);
  ctx.lineTo(s.x, s.y+TH/4); ctx.lineTo(s.x-TW/4, s.y);
  ctx.closePath();
  ctx.fill();
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
  ctx.fillStyle = seasonShift ? shiftColor('#1a4a1f', seasonShift) : '#1a4a1f';
  ctx.beginPath(); ctx.moveTo(x,y-16); ctx.lineTo(x+7,y); ctx.lineTo(x-7,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = seasonShift ? shiftColor('#1f5525', seasonShift) : '#1f5525';
  ctx.beginPath(); ctx.moveTo(x,y-20); ctx.lineTo(x+5,y-8); ctx.lineTo(x-5,y-8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x-1.5, y, 3, 5);
}

function drawRock(ctx, x, y, a) {
  ctx.globalAlpha = a*0.9;
  ctx.fillStyle = '#7a7a88';
  ctx.beginPath(); ctx.moveTo(x-6,y+2); ctx.lineTo(x-4,y-6); ctx.lineTo(x+3,y-5); ctx.lineTo(x+6,y+2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a8a98';
  ctx.beginPath(); ctx.moveTo(x+2,y); ctx.lineTo(x+4,y-4); ctx.lineTo(x+8,y-2); ctx.lineTo(x+7,y+1); ctx.closePath(); ctx.fill();
}

function drawIronOre(ctx, x, y, a) {
  ctx.globalAlpha = a*0.9;
  ctx.fillStyle = '#5577aa';
  ctx.beginPath(); ctx.moveTo(x-5,y+2); ctx.lineTo(x-3,y-5); ctx.lineTo(x+4,y-4); ctx.lineTo(x+5,y+2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#88bbff';
  ctx.fillRect(x-1, y-3, 2, 2);
  ctx.fillRect(x+2, y-1, 2, 2);
}

function drawWater(ctx, x, y, a) {
  ctx.globalAlpha = a * 0.3;
  const t = G.gameTick * 0.02;
  ctx.strokeStyle = 'rgba(150,200,255,0.25)';
  ctx.lineWidth = 0.5;
  for (let i = -8; i < 8; i += 6) {
    ctx.beginPath();
    ctx.moveTo(x+i, y + Math.sin(t+i)*1.5);
    ctx.lineTo(x+i+4, y + Math.sin(t+i+2)*1.5);
    ctx.stroke();
  }
}

// ── Minimap ─────────────────────────────────────────────────
const MINI_COLORS = {0:'#1e3a5f',1:'#d4a76a',2:'#4a7c4f',3:'#2d5a30',4:'#6b7280',5:'#4b6fa0',6:'#4a4a5a'};

function renderMinimap() {
  const mc = minimapCtx;
  const mw = 160, mh = 160;
  const sx = mw/MAP_W, sy = mh/MAP_H;
  mc.fillStyle = '#0a0e1a';
  mc.fillRect(0,0,mw,mh);

  for (let y=0;y<MAP_H;y++) for (let x=0;x<MAP_W;x++) {
    if (!G.fog[y][x]) continue;
    mc.fillStyle = MINI_COLORS[G.map[y][x]] || '#000';
    mc.fillRect(x*sx, y*sy, Math.ceil(sx), Math.ceil(sy));
  }

  mc.fillStyle = '#fff';
  for (const b of G.buildings) {
    mc.fillRect(b.x*sx, b.y*sy, Math.ceil(sx)+1, Math.ceil(sy)+1);
  }

  mc.fillStyle = '#ff0';
  for (const c of G.citizens) {
    mc.fillRect(Math.floor(c.x*sx), Math.floor(c.y*sy), 2, 2);
  }

  // Camera viewport
  const tl = screenToWorld(0, 50);
  const br = screenToWorld(C.width, C.height-50);
  mc.strokeStyle = 'rgba(255,255,255,0.6)';
  mc.lineWidth = 1;
  mc.strokeRect(tl.x*sx, tl.y*sy, (br.x-tl.x)*sx, (br.y-tl.y)*sy);
}
