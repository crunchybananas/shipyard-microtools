// ════════════════════════════════════════════════════════════
// Enhancements — incremental ambient features added across
// the autonomous improvement loops. Each block is self-contained
// and additive; do not remove prior blocks.
// ════════════════════════════════════════════════════════════

import { G, TILE, TW, TH, MAP_W, MAP_H, getDaylight } from './state.js';

function toScreen(tx, ty) { return { x: (tx - ty) * TW / 2, y: (tx + ty) * TH / 2 }; }

// ── Loop 22: Cherry blossom canopy on forest tiles in spring
export function renderBlossoms(ctx) {
  if (G.season !== 'spring' || G.camera.zoom < 0.7) return;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 28 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.FOREST) continue;
      const h = ((tx * 2654435761) ^ (ty * 1597463007)) >>> 0;
      if (h % 100 > 25) continue; // 25% of forest tiles bloom
      const s = toScreen(tx, ty);
      // Cluster of 5-7 pink puffs
      const N = 5 + (h % 3);
      const isWhite = h & 8;
      for (let i = 0; i < N; i++) {
        const off = ((h + i * 911) % 100) / 100;
        const off2 = ((h + i * 1373) % 100) / 100;
        const px = s.x + (off - 0.5) * 14;
        const py = s.y - 8 + (off2 - 0.5) * 6;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = isWhite ? '#ffeef5' : (i & 1 ? '#ffb0c8' : '#ff8aa8');
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px - 0.4, py - 0.4, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Loop 21: Spontaneous snowmen near houses in winter ────
export function updateSnowmen() {
  if (G.season !== 'winter') { if (G.snowmen) G.snowmen.length = 0; return; }
  if (!G.snowmen) G.snowmen = [];
  if (G.gameTick % 800 === 0 && G.snowmen.length < 6) {
    const houses = G.buildings.filter(b => b.type === 'house');
    if (!houses.length) return;
    const h = houses[Math.floor(Math.random() * houses.length)];
    const ox = (Math.random() - 0.5) * 3;
    const oy = (Math.random() - 0.5) * 3;
    const x = h.x + ox, y = h.y + oy;
    const tx = Math.round(x), ty = Math.round(y);
    if (G.map[ty] && G.map[ty][tx] === TILE.GRASS && !(G.buildingGrid[ty] && G.buildingGrid[ty][tx])) {
      G.snowmen.push({ x, y, hatColor: ['#c02020','#202060','#206020','#604010'][Math.floor(Math.random()*4)] });
    }
  }
}
export function renderSnowmen(ctx) {
  if (G.season !== 'winter' || !G.snowmen || !G.snowmen.length || G.camera.zoom < 0.7) return;
  for (const sm of G.snowmen) {
    const s = toScreen(sm.x, sm.y);
    // Body
    ctx.fillStyle = '#fcfcff';
    ctx.beginPath(); ctx.arc(s.x, s.y + 1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x, s.y - 3.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x, s.y - 7, 1.8, 0, Math.PI * 2); ctx.fill();
    // Hat
    ctx.fillStyle = sm.hatColor;
    ctx.fillRect(s.x - 2, s.y - 9, 4, 1.5);
    ctx.fillRect(s.x - 2.5, s.y - 7.7, 5, 0.5);
    // Eyes & carrot
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 0.8, s.y - 7.3, 0.5, 0.5);
    ctx.fillRect(s.x + 0.4, s.y - 7.3, 0.5, 0.5);
    ctx.fillStyle = '#ff8030';
    ctx.fillRect(s.x - 0.2, s.y - 6.7, 0.6, 0.4);
    // Arms (stick)
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(s.x - 2.3, s.y - 4); ctx.lineTo(s.x - 5, s.y - 6);
    ctx.moveTo(s.x + 2.3, s.y - 4); ctx.lineTo(s.x + 5, s.y - 6);
    ctx.stroke();
  }
}

// ── Loop 20: Sun lens flare (animates with day phase) ──────
export function renderLensFlare(ctx, logicalW, logicalH) {
  const dayl = getDaylight();
  if (dayl < 0.6) return;
  const t = G.dayPhase / G.dayLength;
  // Sun horizontally moves across upper area — left at dawn, right at dusk
  const sunFrac = Math.min(1, Math.max(0, (t - 0.05) / 0.7));
  const sx = sunFrac * logicalW * 0.85 + logicalW * 0.075;
  const sy = logicalH * 0.18;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Main sun glow
  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90);
  grad.addColorStop(0, `rgba(255,250,210,${dayl * 0.55})`);
  grad.addColorStop(0.4, `rgba(255,210,140,${dayl * 0.18})`);
  grad.addColorStop(1, 'rgba(255,210,140,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(sx, sy, 90, 0, Math.PI * 2);
  ctx.fill();
  // Lens flare ghosts along axis from sun through screen center
  const cx = logicalW / 2, cy = logicalH / 2;
  const dx = cx - sx, dy = cy - sy;
  const flareSpots = [
    { t: 0.5, r: 28, color: `rgba(255,170,80,${dayl * 0.15})` },
    { t: 0.85, r: 18, color: `rgba(160,200,255,${dayl * 0.12})` },
    { t: 1.2,  r: 38, color: `rgba(255,100,160,${dayl * 0.10})` },
    { t: 1.55, r: 12, color: `rgba(180,255,180,${dayl * 0.13})` },
  ];
  for (const f of flareSpots) {
    const fx = sx + dx * f.t;
    const fy = sy + dy * f.t;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, f.r);
    fg.addColorStop(0, f.color);
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Loop 19: Footprints in snow (winter only) ──────────────
export function updateFootprints() {
  if (G.season !== 'winter') { if (G.footprints) G.footprints.length = 0; return; }
  if (!G.footprints) G.footprints = [];
  // Each citizen leaves a print every ~20 ticks
  if (G.gameTick % 20 === 0 && G.citizens) {
    for (const c of G.citizens) {
      if (G.footprints.length > 200) break;
      G.footprints.push({ x: c.x, y: c.y, age: 0, life: 600 });
    }
  }
  for (let i = G.footprints.length - 1; i >= 0; i--) {
    G.footprints[i].age += G.speed;
    if (G.footprints[i].age >= G.footprints[i].life) G.footprints.splice(i, 1);
  }
}
export function renderFootprints(ctx) {
  if (G.season !== 'winter' || !G.footprints || !G.footprints.length || G.camera.zoom < 0.7) return;
  ctx.save();
  for (const fp of G.footprints) {
    const fade = 1 - (fp.age / fp.life);
    if (fade <= 0) continue;
    const s = toScreen(fp.x, fp.y);
    ctx.globalAlpha = fade * 0.45;
    ctx.fillStyle = '#7088a8';
    ctx.beginPath();
    ctx.ellipse(s.x - 1, s.y + 2, 0.9, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s.x + 1, s.y + 3, 0.9, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Loop 18: Town bonfire when happiness is high ────────────
function townCenter() {
  if (!G.buildings.length) return null;
  let sx = 0, sy = 0;
  for (const b of G.buildings) { sx += b.x; sy += b.y; }
  return { x: sx / G.buildings.length, y: sy / G.buildings.length };
}
export function renderBonfire(ctx) {
  if ((G.happiness || 0) < 65) return;
  const tc = townCenter();
  if (!tc) return;
  const s = toScreen(tc.x, tc.y);
  const dayl = getDaylight();
  const nightStrength = Math.max(0, Math.min(1, (0.85 - dayl) / 0.4));
  ctx.save();
  // Logs
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(s.x - 5, s.y + 1, 10, 1.5);
  ctx.fillRect(s.x - 4, s.y + 2.5, 8, 1.2);
  // Flame (additive when night)
  if (nightStrength > 0.05) ctx.globalCompositeOperation = 'screen';
  const tt = G.gameTick * 0.18;
  for (let i = 0; i < 3; i++) {
    const flick = 0.7 + 0.3 * Math.sin(tt + i * 1.7);
    const grad = ctx.createRadialGradient(s.x, s.y - 4, 1, s.x, s.y - 4, 14 * flick);
    grad.addColorStop(0, `rgba(255,240,140,${0.9 * flick})`);
    grad.addColorStop(0.5, `rgba(255,140,40,${0.6 * flick})`);
    grad.addColorStop(1, 'rgba(180,40,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(s.x + Math.sin(tt * 0.7 + i) * 1.2, s.y - 4 - i * 1.2, 6 * flick, 10 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Halo light at night
  if (nightStrength > 0.1) {
    const hgrad = ctx.createRadialGradient(s.x, s.y - 4, 5, s.x, s.y - 4, 60);
    hgrad.addColorStop(0, `rgba(255,180,80,${nightStrength * 0.35})`);
    hgrad.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = hgrad;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 4, 60, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Loop 17: Wet ground puddles after rain ─────────────────
let _puddleAge = 0;
let _prevWeather2 = null;
const PUDDLE_DURATION = 2000;
export function updatePuddles() {
  if (_prevWeather2 === 'rain' && G.weather !== 'rain') {
    _puddleAge = PUDDLE_DURATION;
  }
  _prevWeather2 = G.weather;
  if (_puddleAge > 0) _puddleAge -= G.speed;
}
export function renderPuddles(ctx) {
  if (_puddleAge <= 0 || G.camera.zoom < 0.7) return;
  const fade = Math.min(1, _puddleAge / 400);
  const cx = G.camera.x, cy = G.camera.y;
  const range = 28 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = G.map[ty][tx];
      if (tile !== TILE.GRASS && tile !== TILE.SAND) continue;
      const h = ((tx * 0x1f1f) ^ (ty * 0x3b3b)) >>> 0;
      if (h % 100 > 22) continue; // only ~22% of tiles have a puddle
      const s = toScreen(tx, ty);
      const ox = ((h % 17) - 8);
      const oy = ((h >> 4) % 7) - 3;
      const w = 8 + (h % 5);
      const hh = 3 + (h % 3);
      // Reflective base
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = '#7daed8';
      ctx.beginPath();
      ctx.ellipse(s.x + ox, s.y + oy, w, hh, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sky glint
      ctx.globalAlpha = 0.4 * fade;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.ellipse(s.x + ox - w * 0.3, s.y + oy - hh * 0.3, w * 0.4, hh * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Loop 16: Constellation patterns connecting bright stars ─
// Hand-crafted "constellation" line patterns drawn at fixed
// screen-space positions, only at deep night.
const CONSTELLATIONS = [
  // each: array of [xFrac, yFrac] points; lines connect sequentially
  { name: 'dragon',  pts: [[0.12,0.10],[0.16,0.13],[0.21,0.11],[0.26,0.14],[0.30,0.12],[0.34,0.16],[0.32,0.21]] },
  { name: 'cup',     pts: [[0.50,0.08],[0.54,0.12],[0.58,0.08],[0.54,0.16],[0.54,0.20]] },
  { name: 'archer',  pts: [[0.74,0.18],[0.77,0.13],[0.80,0.18],[0.83,0.13],[0.81,0.22]] },
];
export function renderConstellations(ctx, logicalW, logicalH) {
  const dayl = getDaylight();
  const nightStrength = Math.max(0, Math.min(1, (0.7 - dayl) / 0.25));
  if (nightStrength < 0.1) return;
  ctx.save();
  ctx.strokeStyle = `rgba(180,200,255,${nightStrength * 0.18})`;
  ctx.lineWidth = 0.8;
  ctx.fillStyle = `rgba(220,235,255,${nightStrength * 0.95})`;
  for (const c of CONSTELLATIONS) {
    // Lines
    ctx.beginPath();
    for (let i = 0; i < c.pts.length; i++) {
      const [fx, fy] = c.pts[i];
      const x = fx * logicalW, y = fy * logicalH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Brighter star at each vertex
    for (const [fx, fy] of c.pts) {
      const x = fx * logicalW, y = fy * logicalH;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      // Cross sparkle
      ctx.strokeStyle = `rgba(220,235,255,${nightStrength * 0.55})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
      ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
      ctx.stroke();
      ctx.strokeStyle = `rgba(180,200,255,${nightStrength * 0.18})`;
      ctx.lineWidth = 0.8;
    }
  }
  ctx.restore();
}

// ── Loop 15: Hawks circling overhead casting shadows ───────
export function updateHawks(logicalW, logicalH) {
  if (!G.hawks) G.hawks = [];
  if (G.gameTick % 800 === 0 && G.hawks.length < 1 && getDaylight() > 0.7 && Math.random() < 0.5) {
    G.hawks.push({
      cx: Math.random() * logicalW,
      cy: Math.random() * logicalH * 0.55 + 80,
      radius: 60 + Math.random() * 40,
      angle: Math.random() * Math.PI * 2,
      angVel: 0.012 + Math.random() * 0.008,
      life: 1500 + Math.random() * 500,
    });
  }
  for (let i = G.hawks.length - 1; i >= 0; i--) {
    const h = G.hawks[i];
    h.angle += h.angVel * G.speed;
    h.life -= G.speed;
    if (h.life <= 0) G.hawks.splice(i, 1);
  }
}
export function renderHawks(ctx) {
  if (!G.hawks || !G.hawks.length) return;
  ctx.save();
  for (const h of G.hawks) {
    const x = h.cx + Math.cos(h.angle) * h.radius;
    const y = h.cy + Math.sin(h.angle) * h.radius * 0.5;
    const wing = Math.sin(G.gameTick * 0.12) * 6;
    // Hawk silhouette — wider than birds
    ctx.fillStyle = 'rgba(40,30,25,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings as triangles
    ctx.beginPath();
    ctx.moveTo(x - 9, y + wing * 0.3);
    ctx.lineTo(x - 1, y);
    ctx.lineTo(x - 6, y + wing);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 9, y + wing * 0.3);
    ctx.lineTo(x + 1, y);
    ctx.lineTo(x + 6, y + wing);
    ctx.closePath();
    ctx.fill();
    // Tail fan
    ctx.beginPath();
    ctx.moveTo(x - 1, y);
    ctx.lineTo(x + 1, y);
    ctx.lineTo(x, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ── Loop 14: Rainbow after rain stops ──────────────────────
let _prevWeather = null;
let _rainbowAge = 0;
const RAINBOW_DURATION = 1500; // game ticks
export function updateRainbow() {
  if (!G.weather) G.weather = 'clear';
  if (_prevWeather === 'rain' && G.weather !== 'rain') {
    _rainbowAge = RAINBOW_DURATION;
  }
  _prevWeather = G.weather;
  if (_rainbowAge > 0) _rainbowAge -= G.speed;
}
export function renderRainbow(ctx, logicalW, logicalH) {
  if (_rainbowAge <= 0) return;
  if (getDaylight() < 0.55) return;
  const fade = Math.min(1, _rainbowAge / 400) * Math.min(1, (RAINBOW_DURATION - _rainbowAge) / 200 + 0.3);
  const cx = logicalW * 0.7;
  const cy = logicalH + 50;
  const rOuter = Math.min(logicalW, logicalH) * 0.85;
  const colors = [
    'rgba(255,80,80,', 'rgba(255,160,60,', 'rgba(255,230,80,',
    'rgba(80,200,80,', 'rgba(80,160,255,', 'rgba(120,100,220,', 'rgba(200,80,200,',
  ];
  ctx.save();
  ctx.lineWidth = 8;
  for (let i = 0; i < colors.length; i++) {
    const r = rOuter - i * 9;
    ctx.strokeStyle = colors[i] + (0.45 * fade) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Loop 13: Wandering merchant carts (visit market) ───────
export function updateCarts() {
  if (!G.carts) G.carts = [];
  const markets = G.buildings.filter(b => b.type === 'market');
  if (markets.length === 0) { G.carts.length = 0; return; }
  // Spawn one cart per market max; respawn after delivery
  if (G.gameTick % 600 === 0 && G.carts.length < markets.length && G.carts.length < 3) {
    // Spawn at map edge, target a random market
    const m = markets[Math.floor(Math.random() * markets.length)];
    const edge = Math.floor(Math.random() * 4);
    let sx, sy;
    if (edge === 0) { sx = 0; sy = Math.floor(Math.random() * MAP_H); }
    else if (edge === 1) { sx = MAP_W - 1; sy = Math.floor(Math.random() * MAP_H); }
    else if (edge === 2) { sx = Math.floor(Math.random() * MAP_W); sy = 0; }
    else { sx = Math.floor(Math.random() * MAP_W); sy = MAP_H - 1; }
    G.carts.push({
      x: sx, y: sy, tx: m.x, ty: m.y,
      state: 'arriving', stateTimer: 0, market: m,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }
  for (let i = G.carts.length - 1; i >= 0; i--) {
    const c = G.carts[i];
    const dx = c.tx - c.x, dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (c.state === 'arriving') {
      if (d < 0.6) {
        c.state = 'unloading';
        c.stateTimer = 200;
      } else {
        const spd = 0.025 * G.speed;
        // Skip impassable tiles
        const stepX = (dx / d) * Math.min(spd, d);
        const stepY = (dy / d) * Math.min(spd, d);
        c.x += stepX; c.y += stepY;
      }
    } else if (c.state === 'unloading') {
      c.stateTimer -= G.speed;
      if (c.stateTimer <= 0) {
        c.state = 'leaving';
        // pick edge target
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { c.tx = 0; c.ty = c.y; }
        else if (edge === 1) { c.tx = MAP_W - 1; c.ty = c.y; }
        else if (edge === 2) { c.tx = c.x; c.ty = 0; }
        else { c.tx = c.x; c.ty = MAP_H - 1; }
      }
    } else if (c.state === 'leaving') {
      if (c.x <= 0.3 || c.x >= MAP_W - 1.3 || c.y <= 0.3 || c.y >= MAP_H - 1.3) {
        G.carts.splice(i, 1);
        continue;
      }
      const spd = 0.025 * G.speed;
      c.x += (dx / d) * Math.min(spd, d);
      c.y += (dy / d) * Math.min(spd, d);
    }
  }
}
export function renderCarts(ctx) {
  if (!G.carts || !G.carts.length || G.camera.zoom < 0.5) return;
  const dayl = getDaylight();
  for (const c of G.carts) {
    const s = toScreen(c.x, c.y);
    const bob = Math.sin(G.gameTick * 0.15 + c.bobPhase) * 0.4;
    ctx.globalAlpha = dayl;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 4, 10, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cart bed (brown plank)
    ctx.fillStyle = '#7a4a20';
    ctx.fillRect(s.x - 7, s.y - 4 + bob, 14, 4);
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(s.x - 7, s.y - 4 + bob, 14, 1);
    // Canvas cover (arched)
    ctx.fillStyle = '#e8dcb0';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 5 + bob, 7, 4, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#a08858';
    ctx.lineWidth = 0.5;
    for (let r = -2; r <= 2; r++) {
      ctx.beginPath();
      ctx.arc(s.x, s.y - 5 + bob, 7, Math.PI + (r + 2) * 0.5, Math.PI + (r + 2) * 0.5 + 0.01);
      ctx.stroke();
    }
    // Wheels
    ctx.fillStyle = '#3a2410';
    ctx.beginPath(); ctx.arc(s.x - 5, s.y + 1, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 5, s.y + 1, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5028';
    ctx.beginPath(); ctx.arc(s.x - 5, s.y + 1, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 5, s.y + 1, 0.8, 0, Math.PI * 2); ctx.fill();
    // Horse pulling (small) — drawn ahead of cart in motion direction
    if (c.state !== 'unloading') {
      const mdx = c.tx - c.x, mdy = c.ty - c.y;
      const md = Math.hypot(mdx, mdy) || 1;
      const hsx = s.x + (mdx / md) * 9;
      const hsy = s.y + bob - 2;
      ctx.fillStyle = '#6a4828';
      ctx.beginPath();
      ctx.ellipse(hsx, hsy, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hsx + (mdx / md) * 2.5, hsy - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Loop 12: Festival lanterns strung between adjacent houses
// When two houses are close (≤ 3 tiles), draw a string of glowing
// lanterns between them. Active any time, brighter at night.
function lanternColor(idx) {
  return ['#ff8c4a','#ffd166','#ffb0c8','#a4f0ff','#c0ffae'][idx % 5];
}
export function renderLanterns(ctx) {
  if (G.camera.zoom < 0.7) return;
  const houses = G.buildings.filter(b => b.type === 'house' || b.type === 'tavern');
  if (houses.length < 2) return;
  const dayl = getDaylight();
  const nightStrength = Math.max(0, Math.min(1, (0.85 - dayl) / 0.4));
  ctx.save();
  // Find pairs of close houses (each pair drawn once, dedupe by sorted id)
  const seen = new Set();
  for (let i = 0; i < houses.length; i++) {
    for (let j = i + 1; j < houses.length; j++) {
      const a = houses[i], b = houses[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 9) continue; // > 3 tiles
      const key = i + ':' + j;
      if (seen.has(key)) continue;
      seen.add(key);
      const sa = toScreen(a.x, a.y);
      const sb = toScreen(b.x, b.y);
      const ax = sa.x, ay = sa.y - 22;
      const bx = sb.x, by = sb.y - 22;
      // Sag the string
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2 + 8;
      // Draw rope
      ctx.strokeStyle = 'rgba(40,28,16,0.7)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();
      // Lanterns at parameter steps
      const N = 5;
      for (let k = 1; k < N; k++) {
        const t = k / N;
        const lx = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
        const ly = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
        const col = lanternColor((i + j + k));
        // Glow halo (additive at night)
        if (nightStrength > 0.05) {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = nightStrength * 0.7;
          const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
          grad.addColorStop(0, col);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(lx, ly, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        // Lantern body
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 1.6, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Cap & base
        ctx.fillStyle = '#3a2410';
        ctx.fillRect(lx - 1.2, ly - 2.6, 2.4, 0.6);
        ctx.fillRect(lx - 1, ly + 2, 2, 0.5);
      }
    }
  }
  ctx.restore();
}

// ── Loop 11: Dawn ground mist drifting over land ───────────
export function renderGroundMist(ctx, logicalW, logicalH) {
  const t = G.dayPhase / G.dayLength;
  // Strongest at early dawn (t 0.05..0.18), fade out
  let strength = 0;
  if (t > 0.02 && t < 0.22) {
    strength = 1 - Math.abs(t - 0.1) / 0.1;
  } else if (t > 0.62 && t < 0.78) {
    strength = (1 - Math.abs(t - 0.7) / 0.08) * 0.6; // weaker dusk mist
  }
  if (strength <= 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // Three soft horizontal bands of mist
  const tt = G.gameTick * 0.003;
  for (let band = 0; band < 3; band++) {
    const yBase = logicalH * (0.55 + band * 0.12);
    ctx.globalAlpha = strength * (0.18 - band * 0.04);
    ctx.fillStyle = '#e8eef5';
    ctx.beginPath();
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= logicalW; x += 30) {
      const y = yBase + Math.sin(x * 0.004 + tt + band) * 14 + Math.sin(x * 0.012 + tt * 1.5 + band) * 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(logicalW, yBase + 70);
    ctx.lineTo(0, yBase + 70);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ── Loop 10: Glowing mushroom clusters in dark forest ──────
// Deterministically placed (seeded by tile coords) — render only at night
export function renderGlowMushrooms(ctx) {
  const t = G.dayPhase / G.dayLength;
  const nightStrength = Math.max(0, Math.min(1, (0.75 - getDaylight()) / 0.3));
  if (nightStrength < 0.05 || G.camera.zoom < 0.7) return;
  // Iterate over visible tiles only via camera bounds
  const cx = G.camera.x, cy = G.camera.y;
  const range = 28 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2; // approx center tile
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.FOREST) continue;
      // Stable hash to decide if this tile has a mushroom cluster (~12% of forest tiles)
      const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      if (h % 100 > 12) continue;
      const s = toScreen(tx, ty);
      const cluster = 2 + (h % 3);
      for (let i = 0; i < cluster; i++) {
        const off = ((h + i * 911) % 100) / 100;
        const off2 = ((h + i * 1373) % 100) / 100;
        const mx = s.x + (off - 0.5) * 18;
        const my = s.y + (off2 - 0.5) * 8 + 2;
        const pulse = 0.6 + 0.4 * Math.sin(G.gameTick * 0.05 + i + tx + ty);
        const a = nightStrength * pulse;
        // Cyan-green glow halo
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 6);
        grad.addColorStop(0, `rgba(120,255,200,${a * 0.85})`);
        grad.addColorStop(1, 'rgba(120,255,200,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, 6, 0, Math.PI * 2);
        ctx.fill();
        // Bright core
        ctx.fillStyle = `rgba(220,255,230,${a})`;
        ctx.beginPath();
        ctx.arc(mx, my, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// ── Loop 9: Wolves prowling near forest at night ────────────
export function updateWolves() {
  if (!G.wolves) G.wolves = [];
  const t = G.dayPhase / G.dayLength;
  const isNight = t > 0.72 || t < 0.08;
  // Spawn 1-2 wolves at dusk near forest
  if (isNight && G.gameTick % 400 === 0 && G.wolves.length < 2 && Math.random() < 0.5) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.FOREST) {
        G.wolves.push({
          x, y, tx: x + (Math.random() - 0.5) * 4, ty: y + (Math.random() - 0.5) * 4,
          phase: Math.random() * Math.PI * 2,
          howlTimer: 200 + Math.random() * 400,
        });
        break;
      }
    }
  }
  // Cull at sunrise
  if (!isNight && G.wolves.length > 0 && G.gameTick % 60 === 0) {
    G.wolves.shift();
  }
  for (const w of G.wolves) {
    const dx = w.tx - w.x, dy = w.ty - w.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.3) {
      // pick new target near forest tile
      let tries = 8;
      while (tries-- > 0) {
        const nx = Math.max(1, Math.min(MAP_W - 2, w.x + (Math.random() - 0.5) * 6));
        const ny = Math.max(1, Math.min(MAP_H - 2, w.y + (Math.random() - 0.5) * 6));
        const tile = G.map[Math.round(ny)] && G.map[Math.round(ny)][Math.round(nx)];
        if (tile === TILE.FOREST || tile === TILE.GRASS) { w.tx = nx; w.ty = ny; break; }
      }
    } else {
      const spd = 0.018 * G.speed;
      w.x += (dx / d) * Math.min(spd, d);
      w.y += (dy / d) * Math.min(spd, d);
    }
    w.howlTimer -= G.speed;
    if (w.howlTimer <= 0) { w.howling = 30; w.howlTimer = 400 + Math.random() * 600; }
    if (w.howling > 0) w.howling -= G.speed;
  }
}
export function renderWolves(ctx) {
  if (!G.wolves || !G.wolves.length || G.camera.zoom < 0.5) return;
  const t = G.dayPhase / G.dayLength;
  const isNight = t > 0.7 || t < 0.1;
  if (!isNight) return;
  for (const w of G.wolves) {
    const s = toScreen(w.x, w.y);
    const bob = Math.sin(G.gameTick * 0.18 + w.phase) * 0.6;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 3, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body — dark grey
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 2 + bob, 4.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head with snout
    ctx.fillStyle = '#444450';
    ctx.beginPath();
    ctx.arc(s.x + 3, s.y - 4 + bob, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(s.x + 4, s.y - 4 + bob, 2, 1);
    // Ears
    ctx.fillStyle = '#2a2a30';
    ctx.beginPath();
    ctx.moveTo(s.x + 2.3, s.y - 5.2 + bob);
    ctx.lineTo(s.x + 3, s.y - 6.5 + bob);
    ctx.lineTo(s.x + 3.5, s.y - 5.2 + bob);
    ctx.fill();
    // Eyes (yellow glow)
    ctx.fillStyle = 'rgba(255, 220, 80, 0.95)';
    ctx.beginPath();
    ctx.arc(s.x + 3.5, s.y - 4 + bob, 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y - 2 + bob);
    ctx.lineTo(s.x - 6, s.y - 3.5 + bob);
    ctx.stroke();
    // Howling — small text/wavy lines
    if (w.howling > 0) {
      ctx.globalAlpha = w.howling / 30;
      ctx.strokeStyle = 'rgba(220,220,255,0.7)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(s.x + 8, s.y - 6, 3, -1, 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x + 10, s.y - 7, 5, -1, 1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ── Loop 7: Aurora borealis on winter nights ────────────────
export function renderAurora(ctx, logicalW, logicalH) {
  if (G.season !== 'winter') return;
  const t = G.dayPhase / G.dayLength;
  if (t < 0.78 && t > 0.05) return; // night only
  const nightStrength = Math.min(1, Math.max(0, (0.7 - getDaylight()) / 0.3));
  if (nightStrength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const baseY = logicalH * 0.18;
  const tt = G.gameTick * 0.005;
  // Three undulating ribbons of color
  const ribbons = [
    { color: '#3effa0', alpha: 0.18 * nightStrength, offset: 0,    h: 60 },
    { color: '#7af0ff', alpha: 0.13 * nightStrength, offset: 1.1,  h: 80 },
    { color: '#c060ff', alpha: 0.10 * nightStrength, offset: 2.2,  h: 50 },
  ];
  for (const r of ribbons) {
    ctx.fillStyle = r.color;
    ctx.globalAlpha = r.alpha;
    ctx.beginPath();
    const yTop = baseY + r.offset * 18;
    ctx.moveTo(0, yTop);
    for (let x = 0; x <= logicalW; x += 30) {
      const y = yTop + Math.sin(x * 0.005 + tt + r.offset) * 22 + Math.sin(x * 0.013 + tt * 1.4) * 12;
      ctx.lineTo(x, y);
    }
    for (let x = logicalW; x >= 0; x -= 30) {
      const y = yTop + r.h + Math.sin(x * 0.005 + tt + r.offset) * 22 + Math.sin(x * 0.013 + tt * 1.4) * 12;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ── Loop 6: Hot air balloons drifting overhead ─────────────
const BALLOON_COLORS = [
  ['#d63b3b','#f0c14a'], ['#3b6dd6','#f0e8d4'], ['#3bd66e','#a04ad6'],
  ['#d6973b','#3b3bd6'], ['#d63bb6','#f5dc70'],
];
export function updateBalloons(logicalW, logicalH) {
  if (!G.balloons) G.balloons = [];
  const t = G.dayPhase / G.dayLength;
  const isDay = t > 0.15 && t < 0.65;
  if (isDay && G.gameTick % 1200 === 0 && G.balloons.length < 1 && Math.random() < 0.5) {
    const goingRight = Math.random() < 0.5;
    G.balloons.push({
      x: goingRight ? -60 : (logicalW || 1500) + 60,
      y: (logicalH || 800) * (0.18 + Math.random() * 0.25),
      vx: (goingRight ? 1 : -1) * (0.25 + Math.random() * 0.2),
      bobPhase: Math.random() * Math.PI * 2,
      colorIdx: Math.floor(Math.random() * BALLOON_COLORS.length),
      size: 22 + Math.random() * 8,
    });
  }
  for (let i = G.balloons.length - 1; i >= 0; i--) {
    const b = G.balloons[i];
    b.x += b.vx;
    if (b.x < -120 || b.x > (logicalW || 1500) + 120) G.balloons.splice(i, 1);
  }
}
export function renderBalloons(ctx) {
  if (!G.balloons || !G.balloons.length) return;
  for (const b of G.balloons) {
    const bob = Math.sin(G.gameTick * 0.02 + b.bobPhase) * 2.5;
    const cy = b.y + bob;
    const [c1, c2] = BALLOON_COLORS[b.colorIdx];
    ctx.save();
    // Balloon envelope (teardrop)
    const grad = ctx.createRadialGradient(b.x - b.size * 0.3, cy - b.size * 0.3, b.size * 0.2, b.x, cy, b.size);
    grad.addColorStop(0, c2);
    grad.addColorStop(0.5, c1);
    grad.addColorStop(1, '#3a1818');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(b.x, cy, b.size * 0.85, b.size, 0, 0, Math.PI * 2);
    ctx.fill();
    // Vertical stripes
    ctx.strokeStyle = c2;
    ctx.lineWidth = 1.2;
    for (let s = -2; s <= 2; s++) {
      ctx.beginPath();
      ctx.moveTo(b.x + s * b.size * 0.18, cy - b.size * 0.7);
      ctx.quadraticCurveTo(b.x + s * b.size * 0.22, cy, b.x + s * b.size * 0.18, cy + b.size * 0.6);
      ctx.stroke();
    }
    // Ropes
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.size * 0.5, cy + b.size * 0.6);
    ctx.lineTo(b.x - b.size * 0.3, cy + b.size * 1.3);
    ctx.moveTo(b.x + b.size * 0.5, cy + b.size * 0.6);
    ctx.lineTo(b.x + b.size * 0.3, cy + b.size * 1.3);
    ctx.stroke();
    // Basket
    ctx.fillStyle = '#7a4a20';
    ctx.fillRect(b.x - b.size * 0.35, cy + b.size * 1.25, b.size * 0.7, b.size * 0.35);
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(b.x - b.size * 0.35, cy + b.size * 1.55, b.size * 0.7, 1.5);
    ctx.restore();
  }
}

// ── Loop 5: Migrating bird flocks in V formation ──────────
export function updateFlocks(logicalW, logicalH) {
  if (!G.flocks) G.flocks = [];
  // Spawn at dawn or dusk only
  const t = G.dayPhase / G.dayLength;
  const isDawnDusk = (t > 0.05 && t < 0.18) || (t > 0.62 && t < 0.78);
  if (isDawnDusk && G.gameTick % 600 === 0 && G.flocks.length < 1 && Math.random() < 0.6) {
    const goingRight = Math.random() < 0.5;
    const count = 7 + Math.floor(Math.random() * 6);
    const baseY = logicalH * (0.08 + Math.random() * 0.18);
    G.flocks.push({
      x: goingRight ? -80 : logicalW + 80,
      y: baseY,
      vx: (goingRight ? 1 : -1) * (1.2 + Math.random() * 0.5),
      vy: 0,
      count,
      phase: 0,
    });
  }
  for (let i = G.flocks.length - 1; i >= 0; i--) {
    const f = G.flocks[i];
    f.x += f.vx; f.y += Math.sin(G.gameTick * 0.01 + f.phase) * 0.15;
    if (f.x < -200 || f.x > (logicalW || 2000) + 200) G.flocks.splice(i, 1);
  }
}

export function renderFlocks(ctx, logicalW, logicalH) {
  if (!G.flocks || !G.flocks.length) return;
  const t = G.dayPhase / G.dayLength;
  const isDawnDusk = (t > 0.05 && t < 0.22) || (t > 0.58 && t < 0.82);
  ctx.save();
  for (const f of G.flocks) {
    // Silhouette dark against sky, slight orange tint at dusk
    ctx.strokeStyle = isDawnDusk ? 'rgba(40,25,15,0.85)' : 'rgba(30,30,40,0.7)';
    ctx.lineWidth = 1.3;
    const dir = f.vx >= 0 ? 1 : -1;
    for (let k = 0; k < f.count; k++) {
      // V formation: two rows fanning back
      const row = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1);
      const idx = Math.ceil(k / 2);
      const bx = f.x - dir * idx * 14;
      const by = f.y + row * idx * 6;
      const wing = Math.sin(G.gameTick * 0.35 + k * 0.6) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 5 * dir, by + wing);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 5 * dir, by + wing);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Loop 4: Wandering fishing boats on open water ───────────
function findWaterCluster() {
  // Find a large connected water area; return a spawn coordinate
  for (let attempts = 0; attempts < 50; attempts++) {
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (!G.map[y] || G.map[y][x] !== TILE.WATER) continue;
    // Need at least 6 water tiles in a 5x5 box
    let count = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && G.map[ny][nx] === TILE.WATER) count++;
    }
    if (count >= 8) return { x, y };
  }
  return null;
}

export function updateBoats() {
  if (!G.boats) G.boats = [];
  // Spawn rate: try every 200 ticks if under 4 boats
  if (G.gameTick % 200 === 0 && G.boats.length < 4) {
    const spot = findWaterCluster();
    if (spot) {
      G.boats.push({
        x: spot.x, y: spot.y,
        tx: spot.x + (Math.random() - 0.5) * 6,
        ty: spot.y + (Math.random() - 0.5) * 6,
        bobPhase: Math.random() * Math.PI * 2,
        kind: Math.random() < 0.7 ? 'fish' : 'sail',
        wakeT: 0,
      });
    }
  }
  for (let i = G.boats.length - 1; i >= 0; i--) {
    const b = G.boats[i];
    const dx = b.tx - b.x, dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.3) {
      // Pick new water target nearby
      let tries = 12;
      while (tries-- > 0) {
        const nx = Math.max(1, Math.min(MAP_W - 2, b.x + (Math.random() - 0.5) * 8));
        const ny = Math.max(1, Math.min(MAP_H - 2, b.y + (Math.random() - 0.5) * 8));
        if (G.map[Math.round(ny)] && G.map[Math.round(ny)][Math.round(nx)] === TILE.WATER) {
          b.tx = nx; b.ty = ny; break;
        }
      }
    } else {
      const spd = 0.012 * G.speed;
      const stepX = (dx / d) * Math.min(spd, d);
      const stepY = (dy / d) * Math.min(spd, d);
      // Only move if next tile is still water
      const nxR = Math.round(b.x + stepX), nyR = Math.round(b.y + stepY);
      if (G.map[nyR] && G.map[nyR][nxR] === TILE.WATER) {
        b.x += stepX; b.y += stepY;
      } else {
        // Force new target
        b.tx = b.x; b.ty = b.y;
      }
    }
    b.wakeT += G.speed;
    // Despawn occasionally to refresh
    if (Math.random() < 0.0001) G.boats.splice(i, 1);
  }
}

export function renderBoats(ctx) {
  if (!G.boats || !G.boats.length || G.camera.zoom < 0.5) return;
  const daylight = getDaylight();
  for (const b of G.boats) {
    const s = toScreen(b.x, b.y);
    const bob = Math.sin(G.gameTick * 0.06 + b.bobPhase) * 0.6;
    ctx.globalAlpha = daylight;
    // Wake (small white V trail behind boat)
    ctx.strokeStyle = 'rgba(220,235,255,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x - 6, s.y + 4 + bob * 0.3);
    ctx.lineTo(s.x, s.y + bob * 0.5);
    ctx.lineTo(s.x - 6, s.y - 4 + bob * 0.3);
    ctx.stroke();
    // Hull (dark wood ellipse)
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + bob, 6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hull rim
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(s.x - 6, s.y + bob - 2.2, 12, 0.7);
    if (b.kind === 'sail') {
      // Mast and triangular sail
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + bob - 1);
      ctx.lineTo(s.x, s.y + bob - 11);
      ctx.stroke();
      ctx.fillStyle = '#f0e8d4';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + bob - 11);
      ctx.lineTo(s.x + 5, s.y + bob - 3);
      ctx.lineTo(s.x, s.y + bob - 3);
      ctx.closePath();
      ctx.fill();
    } else {
      // Fishing pole
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(s.x - 2, s.y + bob - 1);
      ctx.lineTo(s.x + 6, s.y + bob - 7);
      ctx.stroke();
      // Line
      ctx.strokeStyle = 'rgba(40,40,40,0.6)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(s.x + 6, s.y + bob - 7);
      ctx.lineTo(s.x + 8, s.y + bob + 2);
      ctx.stroke();
      // Tiny figure
      ctx.fillStyle = '#604030';
      ctx.beginPath();
      ctx.arc(s.x - 1, s.y + bob - 2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════
// Aggregator hooks — called once from main.js and render.js,
// dispatch all enhancement update/render functions in defined order.
// New loops can append entries to these arrays without touching
// main.js / render.js.
// ════════════════════════════════════════════════════════════

const _updaters = [];        // [{ fn, needsScreen?:bool }]
const _worldRenderers = [];  // [(ctx)=>...]    drawn in world transform
const _screenRenderers = []; // [(ctx, w, h)=>...]  drawn in screen space

export function registerUpdater(fn, needsScreen=false) { _updaters.push({fn, needsScreen}); }
export function registerWorldRenderer(fn) { _worldRenderers.push(fn); }
export function registerScreenRenderer(fn) { _screenRenderers.push(fn); }

export function enhUpdateAll(logicalW, logicalH) {
  for (const u of _updaters) {
    if (u.needsScreen) u.fn(logicalW, logicalH);
    else u.fn();
  }
}
export function enhRenderWorld(ctx) {
  for (const fn of _worldRenderers) fn(ctx);
}
export function enhRenderScreen(ctx, logicalW, logicalH) {
  for (const fn of _screenRenderers) fn(ctx, logicalW, logicalH);
}

// Existing loops 4-22 are wired explicitly in main.js / render.js.
// From loop 23 onward, new features should call register* below — they will
// then be dispatched by enhUpdateAll / enhRenderWorld / enhRenderScreen,
// which are invoked once from main.js / render.js, eliminating import edits.
//
// Loop boundaries (registration order = render order):
// (none yet — loop 23+ adds here)


// ── Loop 23: Smoking volcano (rare; one mountain peak) ─────
let _volcanoTile = null;
function findVolcanoTile() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (G.map[y] && G.map[y][x] === TILE.MOUNTAIN) return { x, y };
  }
  return null;
}
function getVolcano() {
  if (_volcanoTile !== null) return _volcanoTile || null;
  // Only init if mountains exist
  let hasMountain = false;
  for (let y = 0; y < MAP_H && !hasMountain; y++)
    for (let x = 0; x < MAP_W; x++)
      if (G.map[y] && G.map[y][x] === TILE.MOUNTAIN) { hasMountain = true; break; }
  if (!hasMountain) { _volcanoTile = false; return null; }
  _volcanoTile = findVolcanoTile() || false;
  return _volcanoTile || null;
}
function updateVolcano() {
  const v = getVolcano();
  if (!v) return;
  if (!G.volcanoSmoke) G.volcanoSmoke = [];
  if (G.gameTick % 18 === 0 && G.volcanoSmoke.length < 14) {
    G.volcanoSmoke.push({
      ox: (Math.random() - 0.5) * 4,
      oy: 0,
      vy: -0.3 - Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.05,
      size: 4 + Math.random() * 3,
      alpha: 0.6 + Math.random() * 0.2,
    });
  }
  for (let i = G.volcanoSmoke.length - 1; i >= 0; i--) {
    const p = G.volcanoSmoke[i];
    p.oy += p.vy * G.speed;
    p.ox += p.vx * G.speed;
    p.size += 0.05 * G.speed;
    p.alpha -= 0.004 * G.speed;
    if (p.alpha <= 0) G.volcanoSmoke.splice(i, 1);
  }
}
function renderVolcano(ctx) {
  const v = getVolcano();
  if (!v || G.camera.zoom < 0.5) return;
  const s = toScreen(v.x, v.y);
  // Glowing crater (orange)
  ctx.save();
  const tt = G.gameTick * 0.1;
  const pulse = 0.7 + 0.3 * Math.sin(tt);
  ctx.globalCompositeOperation = 'screen';
  const grad = ctx.createRadialGradient(s.x, s.y - 24, 0, s.x, s.y - 24, 12);
  grad.addColorStop(0, `rgba(255,180,40,${0.85 * pulse})`);
  grad.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 24, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Smoke plumes
  for (const p of G.volcanoSmoke) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = '#7a6a64';
    ctx.beginPath();
    ctx.arc(s.x + p.ox, s.y - 28 + p.oy, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
registerUpdater(updateVolcano);
registerWorldRenderer(renderVolcano);

// ── Loop 24: Floating status bubbles above buildings ───────
// Indicates idle workers (?) or low food (!) etc.
function renderStatusBubbles(ctx) {
  if (G.camera.zoom < 0.7) return;
  for (const b of G.buildings) {
    let icon = null, color = null;
    if ((b.workersNeeded || 0) > (b.workers ? b.workers.length : 0) && b.type !== 'house' && b.type !== 'wall' && b.type !== 'road' && b.type !== 'tower' && b.type !== 'well') {
      icon = '?'; color = '#ffd166';
    } else if (b.type === 'farm' && G.resources && G.resources.food < 15) {
      icon = '!'; color = '#f97070';
    }
    if (!icon) continue;
    const s = toScreen(b.x, b.y);
    const bob = Math.sin(G.gameTick * 0.05 + (b.x + b.y) * 0.7) * 1.5;
    const cx = s.x, cy = s.y - 36 + bob;
    // Bubble
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy + 4);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx + 2, cy + 4);
    ctx.closePath();
    ctx.fill();
    // Icon
    ctx.fillStyle = color;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy + 0.5);
  }
}
registerWorldRenderer(renderStatusBubbles);

// ── Loop 25: Rare dragon flyover (screen space) ────────────
function updateDragon(logicalW, logicalH) {
  if (!G.dragon) {
    if (G.gameTick % 2400 === 0 && Math.random() < 0.15) {
      const goingRight = Math.random() < 0.5;
      G.dragon = {
        x: goingRight ? -120 : (logicalW || 1500) + 120,
        y: (logicalH || 800) * (0.10 + Math.random() * 0.18),
        vx: (goingRight ? 1 : -1) * 1.5,
        wing: 0,
        scale: 1.0,
        breath: 0,
      };
    }
    return;
  }
  const d = G.dragon;
  d.x += d.vx * G.speed;
  d.wing += 0.18 * G.speed;
  d.breath = Math.max(0, d.breath - G.speed);
  if (Math.random() < 0.005) d.breath = 25;
  if (d.x < -200 || d.x > (logicalW || 1500) + 200) G.dragon = null;
}
function renderDragon(ctx) {
  const d = G.dragon;
  if (!d) return;
  ctx.save();
  ctx.translate(d.x, d.y);
  if (d.vx < 0) ctx.scale(-1, 1);
  // Body
  ctx.fillStyle = '#3a2050';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-40, -3);
  ctx.lineTo(-46, 0);
  ctx.lineTo(-40, 3);
  ctx.closePath();
  ctx.fill();
  // Tail spike
  ctx.beginPath();
  ctx.moveTo(-46, 0);
  ctx.lineTo(-50, -4);
  ctx.lineTo(-50, 4);
  ctx.closePath();
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.ellipse(22, -2, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Horns
  ctx.fillStyle = '#1a0a30';
  ctx.beginPath();
  ctx.moveTo(24, -6); ctx.lineTo(28, -11); ctx.lineTo(26, -5); ctx.closePath();
  ctx.fill();
  // Wings (animated)
  const wingOff = Math.sin(d.wing) * 14;
  ctx.fillStyle = 'rgba(80,30,120,0.9)';
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.lineTo(-12, -22 - wingOff);
  ctx.lineTo(8, -10 - wingOff * 0.4);
  ctx.lineTo(8, -2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(-10, 18 + wingOff * 0.6);
  ctx.lineTo(8, 8 + wingOff * 0.4);
  ctx.lineTo(8, 2);
  ctx.closePath();
  ctx.fill();
  // Fire breath
  if (d.breath > 0) {
    const a = d.breath / 25;
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(38, -1, 0, 38, -1, 22);
    grad.addColorStop(0, `rgba(255,240,140,${a * 0.95})`);
    grad.addColorStop(0.5, `rgba(255,120,40,${a * 0.7})`);
    grad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(40, -1, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateDragon, true);
registerScreenRenderer(renderDragon);
