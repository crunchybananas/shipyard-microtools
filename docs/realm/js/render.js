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
  // Viewport culling — isometric needs all 4 screen corners
  const c0 = screenToWorld(0, 0);
  const c1 = screenToWorld(C.width, 0);
  const c2 = screenToWorld(0, C.height);
  const c3 = screenToWorld(C.width, C.height);
  const pad = 2;
  const minX = Math.max(0, Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - pad);
  const maxX = Math.min(MAP_W-1, Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + pad);
  const minY = Math.max(0, Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - pad);
  const maxY = Math.min(MAP_H-1, Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + pad);

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
      const tileDepth = tile === TILE.WATER ? 2 : tile === TILE.SAND ? 3 : tile === TILE.MOUNTAIN ? 8 : 4;

      // Top face
      ctx.fillStyle = tileColor;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - TH/2);
      ctx.lineTo(s.x + TW/2, s.y);
      ctx.lineTo(s.x, s.y + TH/2);
      ctx.lineTo(s.x - TW/2, s.y);
      ctx.closePath();
      ctx.fill();

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

      // Grass tufts and tiny flowers on grass tiles
      if (tile === TILE.GRASS && G.season !== 'winter') {
        const gh = ((x * 271 + y * 619) & 0xff);
        ctx.globalAlpha = daylight * 0.6;
        if (gh < 60) {
          ctx.fillStyle = G.season === 'autumn' ? '#8a9a50' : '#3a8a3a';
          const gx = s.x - 8 + (gh % 16), gy = s.y - 4 + ((gh >> 4) % 6);
          ctx.beginPath();
          ctx.moveTo(gx, gy); ctx.lineTo(gx - 1, gy - 3); ctx.lineTo(gx + 1, gy - 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 3, gy - 4); ctx.lineTo(gx + 4, gy - 1);
          ctx.fill();
        }
        if (gh > 220 && G.season === 'spring') {
          ctx.fillStyle = ['#f0a0c0','#ffe066','#a0c0f0'][gh % 3];
          ctx.globalAlpha = daylight * 0.7;
          const fx = s.x - 6 + (gh % 12), fy = s.y - 2 + ((gh >> 3) % 5);
          ctx.beginPath();
          ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = daylight;
      }

      // Tile features
      if (tile === TILE.FOREST) drawTree(ctx, s.x, s.y-8, daylight, seasonShift);
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
      else if (tile === TILE.WATER) drawWater(ctx, s.x, s.y, daylight, x, y);
      else if (tile === TILE.MOUNTAIN) {
        const mh = ((x * 37 + y * 53) & 0xff);
        // Shadow at base
        ctx.globalAlpha = daylight * 0.2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = daylight;
        // Back peak (taller, farther)
        ctx.fillStyle = '#6a6a7a';
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y + 4);
        ctx.lineTo(s.x - 4, s.y - 16 - (mh % 6));
        ctx.lineTo(s.x + 2, s.y - 10);
        ctx.lineTo(s.x + 6, s.y + 4);
        ctx.closePath();
        ctx.fill();
        // Front peak (shorter, closer)
        ctx.fillStyle = '#7a7a8a';
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y + 4);
        ctx.lineTo(s.x + 3, s.y - 12 - (mh % 4));
        ctx.lineTo(s.x + 8, s.y - 6);
        ctx.lineTo(s.x + 12, s.y + 4);
        ctx.closePath();
        ctx.fill();
        // Lit face (sunlight side)
        ctx.fillStyle = '#8a8a9a';
        ctx.beginPath();
        ctx.moveTo(s.x + 3, s.y - 12 - (mh % 4));
        ctx.lineTo(s.x + 8, s.y - 6);
        ctx.lineTo(s.x + 12, s.y + 4);
        ctx.lineTo(s.x + 3, s.y + 2);
        ctx.closePath();
        ctx.fill();
        // Snow cap
        ctx.fillStyle = 'rgba(230,240,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y - 14 - (mh % 6));
        ctx.lineTo(s.x - 6, s.y - 10);
        ctx.lineTo(s.x - 1, s.y - 11);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s.x + 3, s.y - 10 - (mh % 4));
        ctx.lineTo(s.x + 1, s.y - 7);
        ctx.lineTo(s.x + 6, s.y - 6);
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
          // Draw a directional gradient toward each unexplored neighbor
          if (fogN) {
            const g = ctx.createLinearGradient(s.x, s.y - hh, s.x, s.y);
            g.addColorStop(0, 'rgba(10,14,26,0.72)');
            g.addColorStop(1, 'rgba(10,14,26,0)');
            ctx.fillStyle = g;
            ctx.fillRect(s.x - hw, s.y - hh, TW, hh);
          }
          if (fogS) {
            const g = ctx.createLinearGradient(s.x, s.y + hh, s.x, s.y);
            g.addColorStop(0, 'rgba(10,14,26,0.72)');
            g.addColorStop(1, 'rgba(10,14,26,0)');
            ctx.fillStyle = g;
            ctx.fillRect(s.x - hw, s.y, TW, hh);
          }
          if (fogW) {
            const g = ctx.createLinearGradient(s.x - hw, s.y, s.x, s.y);
            g.addColorStop(0, 'rgba(10,14,26,0.72)');
            g.addColorStop(1, 'rgba(10,14,26,0)');
            ctx.fillStyle = g;
            ctx.fillRect(s.x - hw, s.y - hh, hw, TH);
          }
          if (fogE) {
            const g = ctx.createLinearGradient(s.x + hw, s.y, s.x, s.y);
            g.addColorStop(0, 'rgba(10,14,26,0.72)');
            g.addColorStop(1, 'rgba(10,14,26,0)');
            ctx.fillStyle = g;
            ctx.fillRect(s.x, s.y - hh, hw, TH);
          }
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
    ctx.arc(s.x, cy - 7, 4, 0, Math.PI * 2);
    ctx.fill();
    // Body outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(s.x, cy - 14, 3, 0, Math.PI * 2);
    ctx.fill();

    // Hair (tiny variation)
    const hairHash = (c.name.charCodeAt(0) * 31 + c.name.charCodeAt(1)) % 4;
    ctx.fillStyle = ['#3a2a1a','#8a6a3a','#2a2a2a','#c08050'][hairHash];
    ctx.beginPath();
    ctx.arc(s.x, cy - 13.5, 2, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // Emote bubble above head
    const emote = c.state==='idle' ? '💤' : c.state==='eating' ? '🍎' :
      c.state==='working' ? '⚒️' : c.state==='foraging' ? '🌿' :
      (c.state==='walk_to_work'||c.state==='walk_to_deliver') ? '🚶' : null;
    if (emote && G.gameTick % 120 < 80) { // show emote 80 of every 120 ticks (flicker)
      ctx.globalAlpha = 0.7;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(emote, s.x, cy - 18);
      ctx.globalAlpha = daylight;
    }

    // Hover highlight ring
    if (c === hoveredCitizen) {
      ctx.strokeStyle = 'rgba(255,209,102,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, cy - 6, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Carrying indicator (resource on shoulder)
    if (c.carrying) {
      const cc = {wood:'#a3714f',stone:'#9ca3af',food:'#4ade80',gold:'#ffd166',iron:'#60a5fa'}[c.carrying] || '#fff';
      ctx.fillStyle = cc;
      ctx.fillRect(s.x + 2, cy - 10, 3, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(s.x + 2, cy - 10, 3, 1);
    }
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

  ctx.globalAlpha = 1;
  ctx.restore();

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
      const sx = px * C.width;
      const sy = py * C.height * 0.65;
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
    const moonX = C.width * 0.82;
    const moonY = C.height * 0.14;
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

  // ── Screen-space vignette (atmospheric edge fog) ──────────
  const vw = C.width, vh = C.height;
  const vigSize = Math.min(vw, vh) * 0.4;
  const vig = ctx.createRadialGradient(vw/2, vh/2, Math.min(vw,vh)*0.3, vw/2, vh/2, Math.max(vw,vh)*0.7);
  vig.addColorStop(0, 'rgba(10,14,26,0)');
  vig.addColorStop(1, 'rgba(10,14,26,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);

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

  // Shadow (scaled)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y+9, 20, 8, 0, 0, Math.PI*2);
  ctx.fill();

  // Scale up buildings by 1.3x for visual presence
  // groundY shifts the anchor down so buildings sit on the tile surface
  const groundY = s.y + 4;
  ctx.save();
  ctx.translate(s.x, groundY);
  ctx.scale(1.3, 1.3);
  ctx.translate(-s.x, -groundY);

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
    case 'castle': drawCastle(ctx, s); break;
    case 'granary': drawGranary(ctx, s); break;
    case 'church': drawChurch(ctx, s); break;
    case 'school': drawSchool(ctx, s); break;
    default: drawGeneric(ctx, s, def); break;
  }
  ctx.restore(); // undo the 1.3x scale

  // Snow cap on roofs in winter
  if (G.season === 'winter' && b.type !== 'road' && b.type !== 'wall' && b.type !== 'farm' && b.type !== 'quarry') {
    ctx.fillStyle = 'rgba(230,240,255,0.85)';
    // Snow sits on top of the building — approximate roof peak
    const snowY = b.type === 'tower' ? s.y - 34 : b.type === 'church' ? s.y - 38 : s.y - 24;
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
    // Warm point light around the building
    const glowR = b.type === 'castle' ? 40 : b.type === 'church' ? 32 : 24;
    const glowY = b.type === 'tower' ? s.y - 18 : b.type === 'castle' ? s.y - 16 : s.y - 10;
    const glow = ctx.createRadialGradient(s.x, glowY, 2, s.x, glowY, glowR);
    glow.addColorStop(0, 'rgba(255,220,140,0.55)');
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, glowY, glowR, 0, Math.PI * 2);
    ctx.fill();
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
    const wy = b.type === 'tower' ? s.y - 44 : b.type === 'church' ? s.y - 46 : b.type === 'castle' ? s.y - 50 : s.y - 34;
    ctx.fillText(`${have}/${needed}👤`, s.x, wy);
    ctx.globalAlpha = daylight;
  }

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
  // Walls
  ctx.fillStyle = '#c89460';
  ctx.fillRect(s.x-9, s.y-20, 18, 16);
  // Side wall (iso depth)
  ctx.fillStyle = '#a87c4e';
  ctx.beginPath();
  ctx.moveTo(s.x+9, s.y-20); ctx.lineTo(s.x+14, s.y-17);
  ctx.lineTo(s.x+14, s.y-1); ctx.lineTo(s.x+9, s.y-4);
  ctx.closePath();
  ctx.fill();
  // Roof
  ctx.fillStyle = '#c43527';
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
  // Main body
  ctx.fillStyle = '#d4d0c8';
  ctx.fillRect(s.x - 10, s.y - 22, 20, 18);
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
  // Window (stained glass)
  ctx.fillStyle = '#4488cc';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 14, 3, Math.PI, 0);
  ctx.lineTo(s.x + 3, s.y - 9);
  ctx.lineTo(s.x - 3, s.y - 9);
  ctx.closePath();
  ctx.fill();
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

  // Shadow on ground
  ctx.globalAlpha = a * 0.15;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 5, 12, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;

  // Trunk with bark texture
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 3, y - 3, 6, 11);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x - 1, y - 2, 3, 9);

  // Rounded canopy layers using arcs for organic look
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.arc(x, y - 6, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.arc(x - 3, y - 14, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c3;
  ctx.beginPath();
  ctx.arc(x + 3, y - 20, 8, 0, Math.PI * 2);
  ctx.fill();
  // Highlight spots for volume
  ctx.fillStyle = c4;
  ctx.globalAlpha = a * 0.5;
  ctx.beginPath();
  ctx.arc(x - 4, y - 17, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 2, y - 9, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
}

function drawRock(ctx, x, y, a) {
  ctx.globalAlpha = a*0.9;
  ctx.fillStyle = '#7a7a88';
  ctx.beginPath(); ctx.moveTo(x-6,y+2); ctx.lineTo(x-4,y-6); ctx.lineTo(x+3,y-5); ctx.lineTo(x+6,y+2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a8a98';
  ctx.beginPath(); ctx.moveTo(x+2,y); ctx.lineTo(x+4,y-4); ctx.lineTo(x+8,y-2); ctx.lineTo(x+7,y+1); ctx.closePath(); ctx.fill();
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
  const t = G.gameTick * 0.018;
  // Per-tile phase offset so neighbouring tiles don't animate in lockstep
  const phase = (tx * 2.3 + ty * 1.7) % (Math.PI * 2);

  // ── Layer 1: deep colour gradient across the diamond ────────
  // Shift between deep navy and rich cobalt with a gentle pulse
  const depthPulse = 0.12 + 0.06 * Math.sin(t * 0.6 + phase);
  ctx.globalAlpha = a * (0.55 + depthPulse);
  ctx.fillStyle = 'rgba(18,100,195,1)';   // deep base
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 2: mid-water colour tint (lighter cobalt) ─────────
  ctx.globalAlpha = a * (0.35 + 0.1 * Math.sin(t * 0.9 + phase + 1));
  ctx.fillStyle = 'rgba(55,165,245,1)';
  ctx.beginPath();
  ctx.moveTo(x, y - 16); ctx.lineTo(x + 32, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 32, y);
  ctx.closePath();
  ctx.fill();

  // ── Layer 3: animated wave crests (sinusoidal stripes) ──────
  // Three wave bands spaced vertically across the tile
  ctx.lineWidth = 1;
  const waveRows = [-8, 0, 8];
  for (let i = 0; i < waveRows.length; i++) {
    const rowY = waveRows[i];
    // Alternate direction so adjacent rows look natural
    const dir = (i % 2 === 0) ? 1 : -1;
    const wAlpha = 0.28 + 0.14 * Math.sin(t * 1.4 + phase + i * 1.1);
    ctx.globalAlpha = a * wAlpha;
    ctx.strokeStyle = `rgba(200,235,255,1)`;
    ctx.beginPath();
    // Clip wave to the diamond by stepping through isometric x-range
    // The diamond at row offset rowY spans from -halfW to +halfW
    // where halfW = 32 * (1 - |rowY|/16)
    const halfW = 32 * (1 - Math.abs(rowY) / 18);
    const step = 4;
    let started = false;
    for (let dx = -halfW; dx <= halfW; dx += step) {
      const wx = x + dx;
      // Two overlapping sine waves travelling in opposite directions
      const wy = y + rowY * 0.5
        + Math.sin(t * 1.6 * dir + dx * 0.22 + phase + i) * 1.8
        + Math.sin(t * 0.9 + dx * 0.14 + phase * 0.5) * 1.0;
      if (!started) { ctx.moveTo(wx, wy); started = true; }
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  // ── Layer 4: bright specular glints (2–3 tiny sparkles) ────
  const numGlints = 2 + ((tx * 3 + ty * 7) & 1); // 2 or 3 per tile
  for (let g = 0; g < numGlints; g++) {
    // Deterministic but animated position
    const gPhase = phase + g * 2.1;
    const gx = x + Math.sin(t * 0.8 + gPhase) * 14;
    const gy = y + Math.cos(t * 0.6 + gPhase) * 7;
    const gSize = 1.5 + 1.0 * Math.sin(t * 2.5 + gPhase);
    const gAlpha = 0.45 + 0.35 * Math.sin(t * 3.0 + gPhase);
    ctx.globalAlpha = a * Math.max(0, gAlpha);
    ctx.fillStyle = 'rgba(240,252,255,1)';
    ctx.beginPath();
    ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Layer 5: foam at land-adjacent edges ────────────────────
  // Check all 4 cardinal neighbours; draw a white arc on each land edge
  const neighbours = [
    { dx:  0, dy: -1, ex: x,      ey: y - 16, ax: x - 32, ay: y,      bx: x + 32, by: y      }, // top
    { dx:  1, dy:  0, ex: x + 32, ey: y,      ax: x,      ay: y - 16, bx: x,      by: y + 16 }, // right
    { dx:  0, dy:  1, ex: x,      ey: y + 16, ax: x - 32, ay: y,      bx: x + 32, by: y      }, // bottom
    { dx: -1, dy:  0, ex: x - 32, ey: y,      ax: x,      ay: y - 16, bx: x,      by: y + 16 }, // left
  ];
  const foamPulse = 0.55 + 0.2 * Math.sin(t * 1.2 + phase);
  ctx.lineWidth = 1.5;
  for (const n of neighbours) {
    const nx = tx + n.dx, ny = ty + n.dy;
    const isLand = nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H
      && G.map[ny][nx] !== TILE.WATER;
    if (!isLand) continue;
    // Draw a short foamy stroke along the shared edge using a midpoint
    ctx.globalAlpha = a * foamPulse;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    // Midpoints of the two half-edges that form the shared diamond side
    const m1x = (n.ex + n.ax) / 2, m1y = (n.ey + n.ay) / 2;
    const m2x = (n.ex + n.bx) / 2, m2y = (n.ey + n.by) / 2;
    ctx.moveTo(m1x, m1y); ctx.lineTo(n.ex, n.ey); ctx.lineTo(m2x, m2y);
    ctx.stroke();
    // Secondary softer foam halo
    ctx.globalAlpha = a * foamPulse * 0.35;
    ctx.strokeStyle = 'rgba(200,235,255,1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m1x, m1y); ctx.lineTo(n.ex, n.ey); ctx.lineTo(m2x, m2y);
    ctx.stroke();
    ctx.lineWidth = 1.5;
  }

  ctx.globalAlpha = a; // restore
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
  const br = screenToWorld(C.width, C.height - 50);
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
