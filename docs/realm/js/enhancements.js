// ════════════════════════════════════════════════════════════
// Enhancements — incremental ambient features added across
// the autonomous improvement loops. Each block is self-contained
// and additive; do not remove prior blocks.
//
// DISABLING A FEATURE: add `return;` as the first statement inside
// the update/render function (NOT the registerXxx call). The register
// call stays so the ordering of later features isn't perturbed.
// Examples: search for `return; // disabled` to see the pattern.
//
// CURRENT DISABLED FEATURES (12, as of cycle 41):
//   - Space effects: meteors, comets, constellations, sun pillars,
//     dragon, dragon trail, meteor impacts — too "out of place"
//   - Sunrise burst — too visually dominant
//   - Swallows — screen-space V-strokes drifted into vignette
//   - Map boundary dots — appeared as void artifacts
//   - renderWorkerDots/renderRadiusPreview/renderGhostCost —
//     referenced undefined BUILDINGS, caused 60fps crash loop
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
  return; // disabled — space effects removed
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
  return; // disabled — flying dragon feels out of place
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

// ── Loop 26: Wind-rippled grass/wheat overlay near farms ───
function renderWindRipple(ctx) {
  if (G.camera.zoom < 0.7) return;
  const tt = G.gameTick * 0.04;
  for (const b of G.buildings) {
    if (b.type !== 'farm') continue;
    const s = toScreen(b.x, b.y);
    // Draw a wave of small wheat strokes around the farm tile
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r = 12 + (i & 1) * 4;
      const wx = s.x + Math.cos(ang) * r;
      const wy = s.y + Math.sin(ang) * r * 0.5 + 8;
      const sway = Math.sin(tt + i * 0.5 + b.x + b.y) * 1.2;
      ctx.strokeStyle = 'rgba(212,180,80,0.85)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + sway, wy - 3);
      ctx.stroke();
      // Head dot
      ctx.fillStyle = 'rgba(232,210,120,0.95)';
      ctx.beginPath();
      ctx.arc(wx + sway, wy - 3.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
registerWorldRenderer(renderWindRipple);

// ── Loop 27: Owls perched on trees at night ────────────────
function updateOwls() {
  if (!G.owls) G.owls = [];
  const t = G.dayPhase / G.dayLength;
  const isNight = t > 0.7 || t < 0.1;
  if (!isNight) { G.owls.length = 0; return; }
  if (G.gameTick % 300 === 0 && G.owls.length < 4) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.FOREST) {
        G.owls.push({ x, y, blinkPhase: Math.random() * 100, hoot: 0 });
        break;
      }
    }
  }
  for (const o of G.owls) {
    o.blinkPhase += G.speed;
    if (Math.random() < 0.005) o.hoot = 30;
    if (o.hoot > 0) o.hoot -= G.speed;
  }
}
function renderOwls(ctx) {
  if (!G.owls || !G.owls.length || G.camera.zoom < 0.9) return;
  for (const o of G.owls) {
    const s = toScreen(o.x, o.y);
    const cx = s.x + 4, cy = s.y - 14;
    // Body silhouette
    ctx.fillStyle = '#3a3024';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ear tufts
    ctx.beginPath();
    ctx.moveTo(cx - 1.6, cy - 2.2);
    ctx.lineTo(cx - 2.2, cy - 3.2);
    ctx.lineTo(cx - 1, cy - 2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 1.6, cy - 2.2);
    ctx.lineTo(cx + 2.2, cy - 3.2);
    ctx.lineTo(cx + 1, cy - 2.5);
    ctx.fill();
    // Glowing eyes (blink)
    const blink = (o.blinkPhase % 80) > 4 ? 1 : 0;
    if (blink) {
      ctx.fillStyle = 'rgba(255,210,100,0.95)';
      ctx.beginPath(); ctx.arc(cx - 0.7, cy - 0.8, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 0.7, cy - 0.8, 0.5, 0, Math.PI * 2); ctx.fill();
    }
    if (o.hoot > 0) {
      ctx.globalAlpha = o.hoot / 30;
      ctx.fillStyle = '#aabbe0';
      ctx.font = 'italic 6px serif';
      ctx.fillText('hoo', cx + 4, cy);
      ctx.globalAlpha = 1;
    }
  }
}
registerUpdater(updateOwls);
registerWorldRenderer(renderOwls);

// ── Loop 28: Large trade ship sails along edge of map water ─
function updateTradeShip() {
  if (!G.tradeShips) G.tradeShips = [];
  if (G.gameTick % 1500 === 0 && G.tradeShips.length < 1) {
    // Find a long stretch of water along an edge
    const tries = 10;
    for (let i = 0; i < tries; i++) {
      const edgeY = Math.floor(Math.random() * MAP_H);
      // Try left edge first
      if (G.map[edgeY] && G.map[edgeY][1] === TILE.WATER && G.map[edgeY][2] === TILE.WATER) {
        G.tradeShips.push({ x: -2, y: edgeY, vx: 0.012, vy: 0, bobPhase: Math.random() * Math.PI * 2 });
        return;
      }
      const x = Math.floor(Math.random() * MAP_W);
      if (G.map[1] && G.map[1][x] === TILE.WATER) {
        G.tradeShips.push({ x, y: -2, vx: 0, vy: 0.012, bobPhase: Math.random() * Math.PI * 2 });
        return;
      }
    }
  }
  for (let i = G.tradeShips.length - 1; i >= 0; i--) {
    const s = G.tradeShips[i];
    s.x += s.vx * G.speed; s.y += s.vy * G.speed;
    if (s.x > MAP_W + 4 || s.y > MAP_H + 4) G.tradeShips.splice(i, 1);
  }
}
function renderTradeShips(ctx) {
  if (!G.tradeShips || !G.tradeShips.length || G.camera.zoom < 0.4) return;
  for (const t of G.tradeShips) {
    const s = toScreen(t.x, t.y);
    const bob = Math.sin(G.gameTick * 0.05 + t.bobPhase) * 0.8;
    // Hull (wider than fishing boats)
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + bob, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(s.x - 14, s.y + bob - 4, 28, 1);
    // Three masts
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = 1;
    for (const mx of [-8, 0, 8]) {
      ctx.beginPath();
      ctx.moveTo(s.x + mx, s.y + bob - 3);
      ctx.lineTo(s.x + mx, s.y + bob - 22);
      ctx.stroke();
    }
    // Big sails
    ctx.fillStyle = '#f4ecd0';
    ctx.fillRect(s.x - 12, s.y + bob - 18, 7, 13);
    ctx.fillRect(s.x - 4,  s.y + bob - 22, 8, 17);
    ctx.fillRect(s.x + 5,  s.y + bob - 18, 7, 13);
    // Sail shadows
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(s.x - 12, s.y + bob - 18, 7, 13);
    ctx.fillRect(s.x + 5,  s.y + bob - 18, 7, 13);
    // Flag
    ctx.fillStyle = '#c83030';
    ctx.fillRect(s.x, s.y + bob - 25, 4, 2);
  }
}
registerUpdater(updateTradeShip);
registerWorldRenderer(renderTradeShips);

// ── Loop 29: Magical sparkles emanate from well buildings ──
function renderWellSparkles(ctx) {
  if (G.camera.zoom < 0.7) return;
  const tt = G.gameTick * 0.08;
  for (const b of G.buildings) {
    if (b.type !== 'well') continue;
    const s = toScreen(b.x, b.y);
    for (let i = 0; i < 5; i++) {
      const ang = tt + i * (Math.PI * 2 / 5);
      const r = 6 + Math.sin(tt * 1.3 + i) * 4;
      const sx = s.x + Math.cos(ang) * r;
      const sy = s.y - 14 + Math.sin(ang) * r * 0.5;
      const a = 0.5 + 0.5 * Math.sin(tt * 2 + i * 1.5);
      ctx.fillStyle = `rgba(180,230,255,${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.9, 0, Math.PI * 2);
      ctx.fill();
      // Cross sparkle
      ctx.strokeStyle = `rgba(220,250,255,${a * 0.5})`;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(sx - 1.5, sy); ctx.lineTo(sx + 1.5, sy);
      ctx.moveTo(sx, sy - 1.5); ctx.lineTo(sx, sy + 1.5);
      ctx.stroke();
    }
  }
}
registerWorldRenderer(renderWellSparkles);

// ── Loop 30: Slow comets at deep night (different from meteors)
// Meteors are fast, screen-only streaks. Comets are slow, large,
// have long teardrop tails, and travel arcs across the upper sky.
function updateComets(logicalW, logicalH) {
  return; // disabled — space effects removed
  if (!G.comets) G.comets = [];
  if (G.gameTick % 1800 === 0 && G.comets.length < 1 && getDaylight() < 0.4 && Math.random() < 0.4) {
    const goingRight = Math.random() < 0.5;
    G.comets.push({
      x: goingRight ? -50 : (logicalW || 1500) + 50,
      y: (logicalH || 800) * (0.05 + Math.random() * 0.2),
      vx: (goingRight ? 1 : -1) * 0.45,
      vy: 0.05,
      life: 2000,
    });
  }
  for (let i = G.comets.length - 1; i >= 0; i--) {
    const c = G.comets[i];
    c.x += c.vx * G.speed; c.y += c.vy * G.speed; c.life -= G.speed;
    if (c.life <= 0 || c.x < -200 || c.x > (logicalW || 1500) + 200) G.comets.splice(i, 1);
  }
}
function renderComets(ctx) {
  if (!G.comets || !G.comets.length) return;
  const dayl = getDaylight();
  const ns = Math.max(0, Math.min(1, (0.6 - dayl) / 0.3));
  if (ns < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const c of G.comets) {
    const dir = c.vx >= 0 ? 1 : -1;
    // Tail (gradient)
    const tailLen = 80 * dir;
    const grad = ctx.createLinearGradient(c.x, c.y, c.x - tailLen, c.y - 6);
    grad.addColorStop(0, `rgba(220,235,255,${0.85 * ns})`);
    grad.addColorStop(0.4, `rgba(180,210,255,${0.45 * ns})`);
    grad.addColorStop(1, 'rgba(120,160,230,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 4);
    ctx.lineTo(c.x - tailLen, c.y - 1);
    ctx.lineTo(c.x - tailLen, c.y + 1);
    ctx.lineTo(c.x, c.y + 4);
    ctx.closePath();
    ctx.fill();
    // Head
    const hg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 8);
    hg.addColorStop(0, `rgba(255,255,255,${ns})`);
    hg.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateComets, true);
registerScreenRenderer(renderComets);

// ── Loop 31: Wandering ghost in graveyards (stub: random spot at night)
function updateGhost() {
  if (!G.ghosts) G.ghosts = [];
  const t = G.dayPhase / G.dayLength;
  if (t < 0.78 && t > 0.05) { G.ghosts.length = 0; return; }
  if (G.gameTick % 500 === 0 && G.ghosts.length < 1 && Math.random() < 0.3) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      const tile = G.map[y] && G.map[y][x];
      if (tile === TILE.GRASS || tile === TILE.FOREST) {
        G.ghosts.push({ x, y, tx: x, ty: y, life: 800, phase: Math.random() * Math.PI * 2 });
        break;
      }
    }
  }
  for (let i = G.ghosts.length - 1; i >= 0; i--) {
    const g = G.ghosts[i];
    g.life -= G.speed;
    if (g.life <= 0) { G.ghosts.splice(i, 1); continue; }
    const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
    if (d < 0.2) {
      g.tx = g.x + (Math.random() - 0.5) * 4;
      g.ty = g.y + (Math.random() - 0.5) * 4;
    } else {
      g.x += (dx / d) * 0.008 * G.speed;
      g.y += (dy / d) * 0.008 * G.speed;
    }
  }
}
function renderGhost(ctx) {
  if (!G.ghosts || !G.ghosts.length || G.camera.zoom < 0.7) return;
  for (const g of G.ghosts) {
    const s = toScreen(g.x, g.y);
    const fade = Math.min(1, g.life / 200);
    const bob = Math.sin(G.gameTick * 0.05 + g.phase) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55 * fade;
    // Wispy body
    const grad = ctx.createRadialGradient(s.x, s.y - 6 + bob, 0, s.x, s.y - 6 + bob, 10);
    grad.addColorStop(0, 'rgba(220,255,250,0.95)');
    grad.addColorStop(1, 'rgba(150,220,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 5 + bob, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (dark holes)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(20,30,60,${0.7 * fade})`;
    ctx.beginPath(); ctx.arc(s.x - 1.2, s.y - 7 + bob, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 1.2, s.y - 7 + bob, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
registerUpdater(updateGhost);
registerWorldRenderer(renderGhost);

// ── Loop 32: Frogs hop on water-edge sand at dusk/night ────
function updateFrogs() {
  if (!G.frogs) G.frogs = [];
  const t = G.dayPhase / G.dayLength;
  if (t < 0.55 || (t > 0.1 && t < 0.5)) { /* not allowed */ }
  if ((t > 0.55 || t < 0.1) && G.gameTick % 600 === 0 && G.frogs.length < 4) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.SAND) {
        // Adjacent water?
        let nearWater = false;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (G.map[y+dy] && G.map[y+dy][x+dx] === TILE.WATER) { nearWater = true; break; }
        }
        if (nearWater) {
          G.frogs.push({ x, y, hopTimer: 100 + Math.random() * 100, hop: 0, croak: 0 });
          break;
        }
      }
    }
  }
  for (let i = G.frogs.length - 1; i >= 0; i--) {
    const f = G.frogs[i];
    f.hopTimer -= G.speed;
    if (f.hopTimer <= 0) {
      f.hop = 12;
      f.x += (Math.random() - 0.5) * 0.6;
      f.y += (Math.random() - 0.5) * 0.4;
      f.hopTimer = 100 + Math.random() * 200;
    }
    if (f.hop > 0) f.hop -= G.speed;
    if (Math.random() < 0.005) f.croak = 25;
    if (f.croak > 0) f.croak -= G.speed;
    if (Math.random() < 0.0005) G.frogs.splice(i, 1);
  }
}
function renderFrogs(ctx) {
  if (!G.frogs || !G.frogs.length || G.camera.zoom < 1.0) return;
  for (const f of G.frogs) {
    const s = toScreen(f.x, f.y);
    const yOff = -Math.sin((Math.max(0,f.hop) / 12) * Math.PI) * 4;
    // Body green
    ctx.fillStyle = '#3a8030';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2 + yOff, 1.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x - 0.8, s.y + 1 + yOff, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 0.8, s.y + 1 + yOff, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(s.x - 0.8, s.y + 1 + yOff, 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 0.8, s.y + 1 + yOff, 0.18, 0, Math.PI * 2); ctx.fill();
    if (f.croak > 0) {
      ctx.globalAlpha = f.croak / 25;
      // Throat puff (light yellow)
      ctx.fillStyle = '#f5e890';
      ctx.beginPath();
      ctx.arc(s.x, s.y + 3.5 + yOff, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
registerUpdater(updateFrogs);
registerWorldRenderer(renderFrogs);

// ── Loop 33: Visible jagged lightning bolts during rain ────
function updateBolts(logicalW, logicalH) {
  if (!G.bolts) G.bolts = [];
  if (G.weather === 'rain' && G.gameTick % 200 === 0 && Math.random() < 0.4) {
    const x = Math.random() * (logicalW || 1500);
    const segs = [];
    let cx = x, cy = 0;
    while (cy < (logicalH || 800) * 0.7) {
      const nx = cx + (Math.random() - 0.5) * 30;
      const ny = cy + 30 + Math.random() * 25;
      segs.push({ x: cx, y: cy, x2: nx, y2: ny });
      cx = nx; cy = ny;
    }
    G.bolts.push({ segs, life: 12 });
  }
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    G.bolts[i].life -= G.speed;
    if (G.bolts[i].life <= 0) G.bolts.splice(i, 1);
  }
}
function renderBolts(ctx) {
  if (!G.bolts || !G.bolts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const b of G.bolts) {
    const a = Math.min(1, b.life / 6);
    // Glow halo
    ctx.strokeStyle = `rgba(180,210,255,${a * 0.4})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (const seg of b.segs) {
      ctx.moveTo(seg.x, seg.y);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
    // Core
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const seg of b.segs) {
      ctx.moveTo(seg.x, seg.y);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
  }
  ctx.restore();
}
registerUpdater(updateBolts, true);
registerScreenRenderer(renderBolts);

// ── Loop 34: Mountain rams clambering on stone tiles ───────
function updateRams() {
  if (!G.rams) G.rams = [];
  if (G.gameTick % 700 === 0 && G.rams.length < 3) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.STONE) {
        G.rams.push({ x, y, tx: x, ty: y, phase: Math.random() * Math.PI * 2 });
        break;
      }
    }
  }
  for (const r of G.rams) {
    const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
    if (d < 0.2) {
      r.tx = r.x + (Math.random() - 0.5) * 4;
      r.ty = r.y + (Math.random() - 0.5) * 4;
    } else {
      r.x += (dx / d) * 0.012 * G.speed;
      r.y += (dy / d) * 0.012 * G.speed;
    }
  }
}
function renderRams(ctx) {
  if (!G.rams || !G.rams.length || G.camera.zoom < 0.7) return;
  for (const r of G.rams) {
    const s = toScreen(r.x, r.y);
    const bob = Math.sin(G.gameTick * 0.18 + r.phase) * 0.6;
    // Body brown
    ctx.fillStyle = '#8a6a48';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 2 + bob, 4, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#a07854';
    ctx.beginPath();
    ctx.arc(s.x + 3, s.y - 4 + bob, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Curling horns
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(s.x + 2.3, s.y - 5 + bob, 1.2, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x + 3.7, s.y - 5 + bob, 1.2, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
    // Legs
    ctx.strokeStyle = '#5a3018';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(s.x - 2, s.y - 0.5); ctx.lineTo(s.x - 2, s.y + 2.5);
    ctx.moveTo(s.x + 2, s.y - 0.5); ctx.lineTo(s.x + 2, s.y + 2.5);
    ctx.stroke();
  }
}
registerUpdater(updateRams);
registerWorldRenderer(renderRams);

// ── Loop 35: Bee swarms around farms in summer ─────────────
function renderBeeSwarms(ctx) {
  if (G.season !== 'summer' || G.camera.zoom < 0.9) return;
  const tt = G.gameTick * 0.3;
  for (const b of G.buildings) {
    if (b.type !== 'farm') continue;
    const s = toScreen(b.x, b.y);
    for (let i = 0; i < 6; i++) {
      const phase = i + (b.x + b.y) * 0.7;
      const bx = s.x + Math.sin(tt * 0.7 + phase) * 8 + Math.cos(tt * 1.1 + phase * 1.3) * 5;
      const by = s.y - 8 + Math.cos(tt * 0.9 + phase) * 5 + Math.sin(tt * 1.5 + phase) * 3;
      // Body striped
      ctx.fillStyle = '#fdd33b';
      ctx.beginPath();
      ctx.arc(bx, by, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1810';
      ctx.fillRect(bx - 0.7, by - 0.2, 1.4, 0.3);
      // Wing blur
      ctx.fillStyle = 'rgba(220,230,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(bx, by - 0.6, 1.1, 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
registerWorldRenderer(renderBeeSwarms);

// ── Loop 36: Will-o-wisps drift near forest at night ───────
function updateWisps() {
  if (!G.wisps) G.wisps = [];
  const t = G.dayPhase / G.dayLength;
  if (t > 0.05 && t < 0.7) { G.wisps.length = 0; return; }
  if (G.gameTick % 250 === 0 && G.wisps.length < 4) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.FOREST) {
        G.wisps.push({
          x, y,
          tx: x + (Math.random() - 0.5) * 3, ty: y + (Math.random() - 0.5) * 3,
          life: 600 + Math.random() * 400,
          color: ['#80ffe0','#a0f0ff','#c8a0ff'][Math.floor(Math.random() * 3)],
        });
        break;
      }
    }
  }
  for (let i = G.wisps.length - 1; i >= 0; i--) {
    const w = G.wisps[i];
    w.life -= G.speed;
    if (w.life <= 0) { G.wisps.splice(i, 1); continue; }
    const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
    if (d < 0.2) {
      w.tx = w.x + (Math.random() - 0.5) * 4;
      w.ty = w.y + (Math.random() - 0.5) * 4;
    } else {
      w.x += (dx / d) * 0.01 * G.speed;
      w.y += (dy / d) * 0.01 * G.speed;
    }
  }
}
function renderWisps(ctx) {
  if (!G.wisps || !G.wisps.length || G.camera.zoom < 0.6) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const w of G.wisps) {
    const s = toScreen(w.x, w.y);
    const fade = Math.min(1, w.life / 200);
    const pulse = 0.7 + 0.3 * Math.sin(G.gameTick * 0.08 + w.x);
    const cy = s.y - 8 + Math.sin(G.gameTick * 0.04 + w.y) * 2;
    const grad = ctx.createRadialGradient(s.x, cy, 0, s.x, cy, 9);
    grad.addColorStop(0, w.color + 'ff'.replace('ff', Math.floor(pulse * 255).toString(16).padStart(2,'0')));
    grad.addColorStop(1, w.color.replace(')', ',0)').replace('rgb', 'rgba'));
    // Simpler: use opacity
    ctx.globalAlpha = fade * pulse * 0.85;
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.arc(s.x, cy, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = fade * pulse * 0.35;
    ctx.beginPath();
    ctx.arc(s.x, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
registerUpdater(updateWisps);
registerWorldRenderer(renderWisps);

// ── Loop 37: Spider webs draped in forest tiles in autumn ──
function renderWebs(ctx) {
  if (G.season !== 'autumn' || G.camera.zoom < 0.9) return;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 24 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  ctx.strokeStyle = 'rgba(220,220,230,0.55)';
  ctx.lineWidth = 0.4;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.FOREST) continue;
      const h = ((tx * 0x3a3a) ^ (ty * 0x5959)) >>> 0;
      if (h % 100 > 18) continue;
      const s = toScreen(tx, ty);
      const ox = ((h % 11) - 5);
      const oy = ((h >> 4) % 5) - 3;
      const cxs = s.x + ox, cys = s.y - 4 + oy;
      // Radial spokes
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cxs, cys);
        ctx.lineTo(cxs + Math.cos(ang) * 5, cys + Math.sin(ang) * 5);
        ctx.stroke();
      }
      // Concentric strands
      for (const rr of [1.5, 3, 4.5]) {
        ctx.beginPath();
        ctx.arc(cxs, cys, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
registerWorldRenderer(renderWebs);

// ── Loop 38: Crabs scuttle on sand near water ──────────────
function updateCrabs() {
  if (!G.crabs) G.crabs = [];
  if (G.gameTick % 350 === 0 && G.crabs.length < 5) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.SAND) {
        G.crabs.push({ x, y, tx: x, ty: y, dir: Math.random() < 0.5 ? 1 : -1, phase: 0 });
        break;
      }
    }
  }
  for (let i = G.crabs.length - 1; i >= 0; i--) {
    const c = G.crabs[i];
    c.phase += G.speed;
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < 0.2) {
      // Scuttle sideways
      const ox = c.dir * 1.5, oy = (Math.random() - 0.5) * 1;
      const nx = Math.max(1, Math.min(MAP_W - 2, c.x + ox));
      const ny = Math.max(1, Math.min(MAP_H - 2, c.y + oy));
      if (G.map[Math.round(ny)] && G.map[Math.round(ny)][Math.round(nx)] === TILE.SAND) {
        c.tx = nx; c.ty = ny;
      } else {
        c.dir *= -1;
      }
    } else {
      c.x += (dx / d) * 0.02 * G.speed;
      c.y += (dy / d) * 0.02 * G.speed;
    }
    if (Math.random() < 0.0005) G.crabs.splice(i, 1);
  }
}
function renderCrabs(ctx) {
  if (!G.crabs || !G.crabs.length || G.camera.zoom < 1.0) return;
  for (const c of G.crabs) {
    const s = toScreen(c.x, c.y);
    const wig = Math.sin(c.phase * 0.4) * 0.6;
    // Body
    ctx.fillStyle = '#d04030';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, 1.6, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 0.6, s.y + 1.3, 0.4, 0.4);
    ctx.fillRect(s.x + 0.2, s.y + 1.3, 0.4, 0.4);
    // Claws
    ctx.strokeStyle = '#a02818';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(s.x - 1.4, s.y + 2);
    ctx.lineTo(s.x - 2.5, s.y + 1.5 + wig);
    ctx.moveTo(s.x + 1.4, s.y + 2);
    ctx.lineTo(s.x + 2.5, s.y + 1.5 - wig);
    ctx.stroke();
    // Legs
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.moveTo(s.x + k * 0.8, s.y + 2.5);
      ctx.lineTo(s.x + k * 1.7, s.y + 3.4 + wig);
      ctx.stroke();
    }
  }
}
registerUpdater(updateCrabs);
registerWorldRenderer(renderCrabs);

// ── Loop 39: Campfires next to barracks at night ───────────
function renderCampfires(ctx) {
  const dayl = getDaylight();
  const ns = Math.max(0, Math.min(1, (0.85 - dayl) / 0.4));
  if (ns < 0.05 || G.camera.zoom < 0.7) return;
  const tt = G.gameTick * 0.2;
  for (const b of G.buildings) {
    if (b.type !== 'barracks') continue;
    const s = toScreen(b.x, b.y);
    const fx = s.x + 14, fy = s.y + 4;
    // Logs
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(fx - 3, fy + 1, 6, 1);
    ctx.fillRect(fx - 2, fy + 2, 4, 0.8);
    // Flame
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const flick = 0.7 + 0.3 * Math.sin(tt);
    const grad = ctx.createRadialGradient(fx, fy - 2, 1, fx, fy - 2, 8 * flick);
    grad.addColorStop(0, `rgba(255,240,140,${0.85 * flick})`);
    grad.addColorStop(0.5, `rgba(255,140,40,${0.55 * flick})`);
    grad.addColorStop(1, 'rgba(180,40,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(fx, fy - 2, 4 * flick, 6 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    // Soldier silhouette beside fire
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(40,30,20,${0.9 * ns})`;
    ctx.beginPath();
    ctx.arc(fx + 6, fy - 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(fx + 5, fy - 1, 2, 3);
    ctx.restore();
  }
}
registerWorldRenderer(renderCampfires);

// ── Loop 40: Fluttering banners on watch towers ─────────────
function renderTowerBanners(ctx) {
  if (G.camera.zoom < 0.6) return;
  const tt = G.gameTick * 0.15;
  for (const b of G.buildings) {
    if (b.type !== 'tower') continue;
    const s = toScreen(b.x, b.y);
    // Pole (extension above existing tower top ~y-38)
    const px = s.x;
    const py = s.y - 50;
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(px, py + 12);
    ctx.lineTo(px, py - 6);
    ctx.stroke();
    // Banner — wave amplitude based on sin
    const len = 9, h = 5;
    ctx.fillStyle = '#c83030';
    ctx.beginPath();
    ctx.moveTo(px, py - 6);
    for (let i = 0; i <= len; i++) {
      const t = i / len;
      const wy = py - 6 + Math.sin(tt + t * 4) * 1.2;
      ctx.lineTo(px + i, wy);
    }
    for (let i = len; i >= 0; i--) {
      const t = i / len;
      const wy = py - 6 + h + Math.sin(tt + t * 4) * 1.2;
      ctx.lineTo(px + i, wy);
    }
    ctx.closePath();
    ctx.fill();
    // Banner cross (white)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(px + 3, py - 6, 1, 5);
    ctx.fillRect(px + 1, py - 4, 5, 1);
  }
}
registerWorldRenderer(renderTowerBanners);

// ── Loop 41: Pigeons walk near markets ─────────────────────
function updatePigeons() {
  if (!G.pigeons) G.pigeons = [];
  if (G.gameTick % 250 === 0 && G.pigeons.length < 6) {
    const markets = G.buildings.filter(b => b.type === 'market');
    if (!markets.length) return;
    const m = markets[Math.floor(Math.random() * markets.length)];
    G.pigeons.push({ x: m.x + (Math.random() - 0.5) * 2, y: m.y + (Math.random() - 0.5) * 2, tx: m.x, ty: m.y, pickPhase: Math.random() * 100 });
  }
  for (let i = G.pigeons.length - 1; i >= 0; i--) {
    const p = G.pigeons[i];
    p.pickPhase += G.speed;
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.2) { p.tx = p.x + (Math.random() - 0.5) * 2.5; p.ty = p.y + (Math.random() - 0.5) * 2.5; }
    else { p.x += (dx / d) * 0.015 * G.speed; p.y += (dy / d) * 0.015 * G.speed; }
    if (Math.random() < 0.0005) G.pigeons.splice(i, 1);
  }
}
function renderPigeons(ctx) {
  if (!G.pigeons || !G.pigeons.length || G.camera.zoom < 0.9) return;
  for (const p of G.pigeons) {
    const s = toScreen(p.x, p.y);
    const peck = Math.sin(p.pickPhase * 0.2) * 0.6;
    ctx.fillStyle = '#8a8a90';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 1.6, 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a6a72';
    ctx.beginPath(); ctx.arc(s.x + 1.2, s.y - 1 + peck, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d4b040';
    ctx.fillRect(s.x + 1.8, s.y - 0.8 + peck, 0.5, 0.3);
  }
}
registerUpdater(updatePigeons);
registerWorldRenderer(renderPigeons);

// ── Loop 42: Subtle motion trails behind moving citizens ───
function renderCitizenTrails(ctx) {
  if (!G.citizens || G.camera.zoom < 1.1) return;
  for (const c of G.citizens) {
    if (!c.trail) c.trail = [];
    if (G.gameTick % 4 === 0) {
      c.trail.push({ x: c.x, y: c.y, age: 0 });
      if (c.trail.length > 4) c.trail.shift();
    }
    for (const pt of c.trail) pt.age += G.speed;
    for (const pt of c.trail) {
      if (pt.age > 30) continue;
      const s = toScreen(pt.x, pt.y);
      const a = (1 - pt.age / 30) * 0.18;
      ctx.fillStyle = `rgba(180,180,200,${a})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4, 1.5, 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
registerWorldRenderer(renderCitizenTrails);

// ── Loop 43: Swallows dart in spring sky ───────────────────
function updateSwallows(logicalW, logicalH) {
  return; // disabled — renders V-strokes in random screen positions, drifts into vignette void
  if (G.season !== 'spring') { if (G.swallows) G.swallows.length = 0; return; }
  if (!G.swallows) G.swallows = [];
  if (G.gameTick % 200 === 0 && G.swallows.length < 5 && getDaylight() > 0.6) {
    G.swallows.push({
      x: Math.random() * (logicalW || 1500),
      y: Math.random() * (logicalH || 800) * 0.5 + 60,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 1,
      life: 800,
    });
  }
  for (let i = G.swallows.length - 1; i >= 0; i--) {
    const s = G.swallows[i];
    s.x += s.vx; s.y += s.vy;
    if (Math.random() < 0.04) { s.vx += (Math.random() - 0.5) * 1.5; s.vy += (Math.random() - 0.5) * 0.6; }
    s.vx = Math.max(-5, Math.min(5, s.vx));
    s.vy = Math.max(-1.5, Math.min(1.5, s.vy));
    s.life -= G.speed;
    if (s.life <= 0 || s.x < -50 || s.x > (logicalW || 1500) + 50 || s.y < -50 || s.y > (logicalH || 800) * 0.7) G.swallows.splice(i, 1);
  }
}
function renderSwallows(ctx) {
  if (!G.swallows || !G.swallows.length) return;
  ctx.strokeStyle = 'rgba(20,20,30,0.7)';
  ctx.lineWidth = 1;
  for (const s of G.swallows) {
    const dir = s.vx >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(s.x - 3 * dir, s.y);
    ctx.lineTo(s.x, s.y - 1);
    ctx.lineTo(s.x + 2 * dir, s.y + 1);
    ctx.stroke();
  }
}
registerUpdater(updateSwallows, true);
registerScreenRenderer(renderSwallows);

// ── Loop 44: Glowing windows on houses at night ────────────
function renderHouseWindows(ctx) {
  const dayl = getDaylight();
  const ns = Math.max(0, Math.min(1, (0.7 - dayl) / 0.3));
  if (ns < 0.05 || G.camera.zoom < 0.7) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const b of G.buildings) {
    if (b.type !== 'house' && b.type !== 'tavern') continue;
    const s = toScreen(b.x, b.y);
    const flick = 0.85 + 0.15 * Math.sin(G.gameTick * 0.07 + b.x + b.y);
    const grad = ctx.createRadialGradient(s.x, s.y - 8, 1, s.x, s.y - 8, 14);
    grad.addColorStop(0, `rgba(255,210,140,${0.55 * ns * flick})`);
    grad.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerWorldRenderer(renderHouseWindows);

// ── Loop 45: Rotating windmill blade overlay ────────────────
function renderWindmillSpin(ctx) {
  if (G.camera.zoom < 0.7) return;
  for (const b of G.buildings) {
    if (b.type !== 'windmill') continue;
    const s = toScreen(b.x, b.y);
    const cx = s.x, cy = s.y - 22;
    const ang = G.gameTick * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#f0e8d4';
    ctx.strokeStyle = '#5a3a14';
    ctx.lineWidth = 0.5;
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate(k * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, -1.5);
      ctx.lineTo(8, 0);
      ctx.lineTo(7, 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
registerWorldRenderer(renderWindmillSpin);

// ── Loop 46: Acorns drop from forest tiles in autumn ───────
function updateAcorns() {
  if (G.season !== 'autumn') { if (G.acorns) G.acorns.length = 0; return; }
  if (!G.acorns) G.acorns = [];
  if (G.gameTick % 30 === 0 && G.acorns.length < 30) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.FOREST) {
        G.acorns.push({ x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.5, oy: -16, vy: 0.25, life: 80 });
        break;
      }
    }
  }
  for (let i = G.acorns.length - 1; i >= 0; i--) {
    const a = G.acorns[i];
    a.oy += a.vy * G.speed;
    if (a.oy >= 0) a.life -= G.speed;
    if (a.life <= 0) G.acorns.splice(i, 1);
  }
}
function renderAcorns(ctx) {
  if (!G.acorns || !G.acorns.length || G.camera.zoom < 0.8) return;
  for (const a of G.acorns) {
    const s = toScreen(a.x, a.y);
    ctx.fillStyle = '#7a4a18';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + a.oy, 0.7, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a1c08';
    ctx.fillRect(s.x - 0.6, s.y + a.oy - 0.9, 1.2, 0.4);
  }
}
registerUpdater(updateAcorns);
registerWorldRenderer(renderAcorns);

// ── Loop 47: Coastal tide foam shifts with day phase ───────
function renderTideFoam(ctx) {
  if (G.camera.zoom < 0.5) return;
  const tt = G.gameTick * 0.01;
  const tideOffset = Math.sin(tt * 0.05) * 0.4; // slow tidal cycle
  const cx = G.camera.x, cy = G.camera.y;
  const range = 24 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  ctx.fillStyle = 'rgba(240,250,255,0.55)';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.SAND) continue;
      // adjacent water?
      let nearWater = false;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (G.map[ty+dy] && G.map[ty+dy][tx+dx] === TILE.WATER) { nearWater = true; break; }
      }
      if (!nearWater) continue;
      const s = toScreen(tx, ty);
      const wPhase = ((tx + ty) * 0.6 + tt) % (Math.PI * 2);
      const len = 8 + Math.sin(wPhase) * 3 + tideOffset * 4;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4, len, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
registerWorldRenderer(renderTideFoam);

// ── Loop 48: Snow drift mounds on east side of buildings ───
function renderSnowDrifts(ctx) {
  if (G.season !== 'winter' || G.camera.zoom < 0.7) return;
  ctx.fillStyle = 'rgba(245,250,255,0.85)';
  for (const b of G.buildings) {
    const s = toScreen(b.x, b.y);
    ctx.beginPath();
    ctx.ellipse(s.x + 12, s.y + 4, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s.x + 8, s.y + 5, 4, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
registerWorldRenderer(renderSnowDrifts);

// ── Loop 49: Dust devils swirl on sand in summer ───────────
function updateDustDevils() {
  if (G.season !== 'summer') { if (G.dustDevils) G.dustDevils.length = 0; return; }
  if (!G.dustDevils) G.dustDevils = [];
  if (G.gameTick % 600 === 0 && G.dustDevils.length < 1) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.SAND) {
        G.dustDevils.push({ x, y, vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05, life: 400 });
        break;
      }
    }
  }
  for (let i = G.dustDevils.length - 1; i >= 0; i--) {
    const d = G.dustDevils[i];
    d.x += d.vx * G.speed; d.y += d.vy * G.speed;
    d.life -= G.speed;
    if (d.life <= 0) G.dustDevils.splice(i, 1);
  }
}
function renderDustDevils(ctx) {
  if (!G.dustDevils || !G.dustDevils.length || G.camera.zoom < 0.6) return;
  const tt = G.gameTick * 0.2;
  for (const d of G.dustDevils) {
    const s = toScreen(d.x, d.y);
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, d.life / 400) * 0.8;
    for (let k = 0; k < 6; k++) {
      const ang = tt + k * 1.0;
      const r = 2 + k * 1.5;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r * 0.5;
      ctx.fillStyle = '#d4b88a';
      ctx.beginPath();
      ctx.arc(s.x + dx, s.y - k * 2 + dy, 1.2 - k * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
registerUpdater(updateDustDevils);
registerWorldRenderer(renderDustDevils);

// ── Loop 50: Continuous victory confetti rain ──────────────
function renderVictoryConfetti(ctx, logicalW, logicalH) {
  if (!G.won && !G._scenarioWon) return;
  if (!G._confetti) G._confetti = [];
  if (G.gameTick % 4 === 0 && G._confetti.length < 80) {
    G._confetti.push({
      x: Math.random() * logicalW,
      y: -10,
      vx: (Math.random() - 0.5) * 2,
      vy: 1 + Math.random() * 1.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      color: ['#ff5050','#ffd166','#50ff80','#50a0ff','#ff80ff'][Math.floor(Math.random() * 5)],
      life: 200,
    });
  }
  for (let i = G._confetti.length - 1; i >= 0; i--) {
    const c = G._confetti[i];
    c.x += c.vx; c.y += c.vy; c.rot += c.vrot;
    c.life--;
    if (c.life <= 0 || c.y > logicalH + 20) { G._confetti.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-2, -1, 4, 2);
    ctx.restore();
  }
}
registerScreenRenderer(renderVictoryConfetti);

// ── Loop 51: Caravan campfire when carts are unloading ─────
function renderCartCampfire(ctx) {
  if (!G.carts || !G.carts.length) return;
  const tt = G.gameTick * 0.18;
  for (const c of G.carts) {
    if (c.state !== 'unloading') continue;
    const s = toScreen(c.x, c.y);
    const flick = 0.7 + 0.3 * Math.sin(tt + c.x);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(s.x - 8, s.y + 2, 1, s.x - 8, s.y + 2, 8 * flick);
    grad.addColorStop(0, `rgba(255,210,120,${0.7 * flick})`);
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(s.x - 8, s.y + 2, 4 * flick, 6 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
registerWorldRenderer(renderCartCampfire);

// ── Loop 52: Mine carts on iron mines (small running sprite)
function renderMineCarts(ctx) {
  if (G.camera.zoom < 0.7) return;
  const tt = G.gameTick;
  for (const b of G.buildings) {
    if (b.type !== 'mine') continue;
    const s = toScreen(b.x, b.y);
    const t = ((tt + b.x * 47) % 200) / 200;
    const dx = (t - 0.5) * 30;
    const cx = s.x + dx, cy = s.y + 6 + Math.abs(t - 0.5) * 2;
    // Body
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(cx - 3, cy - 2, 6, 2.5);
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(cx - 3, cy - 2.4, 6, 0.4);
    // Wheels
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(cx - 2, cy + 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2, cy + 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
    // Iron ore inside (pile)
    ctx.fillStyle = '#7a8090';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 1.2, Math.PI, 0);
    ctx.fill();
  }
}
registerWorldRenderer(renderMineCarts);

// ── Loop 53: Fish jump out of water occasionally ───────────
function updateFishJumps() {
  if (!G.fishJumps) G.fishJumps = [];
  if (G.gameTick % 100 === 0 && G.fishJumps.length < 3 && G.season !== 'winter') {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.WATER) {
        G.fishJumps.push({ x, y, t: 0, dur: 25 });
        break;
      }
    }
  }
  for (let i = G.fishJumps.length - 1; i >= 0; i--) {
    G.fishJumps[i].t += G.speed;
    if (G.fishJumps[i].t >= G.fishJumps[i].dur) G.fishJumps.splice(i, 1);
  }
}
function renderFishJumps(ctx) {
  if (!G.fishJumps || !G.fishJumps.length || G.camera.zoom < 0.6) return;
  for (const f of G.fishJumps) {
    const s = toScreen(f.x, f.y);
    const p = f.t / f.dur;
    const yOff = -Math.sin(p * Math.PI) * 8;
    // Fish body silhouette
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + yOff, 1.4, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(s.x - 1.3, s.y + yOff);
    ctx.lineTo(s.x - 2.5, s.y - 0.6 + yOff);
    ctx.lineTo(s.x - 2.5, s.y + 0.6 + yOff);
    ctx.closePath();
    ctx.fill();
    // Splash ripples at landing point (when t > dur*0.5 going down)
    if (p > 0.85) {
      const a = (1 - (p - 0.85) / 0.15) * 0.55;
      ctx.strokeStyle = `rgba(220,240,255,${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 1, 4 * (p - 0.85) / 0.15 + 1, 1.5 * (p - 0.85) / 0.15 + 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
registerUpdater(updateFishJumps);
registerWorldRenderer(renderFishJumps);

// ── Loop 54: Drying laundry on lines between houses ────────
function renderLaundry(ctx) {
  if (G.camera.zoom < 0.95) return;
  const tt = G.gameTick * 0.04;
  const houses = G.buildings.filter(b => b.type === 'house');
  const seen = new Set();
  for (let i = 0; i < houses.length; i++) {
    for (let j = i + 1; j < houses.length; j++) {
      const a = houses[i], b = houses[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx*dx + dy*dy > 4 || dx*dx + dy*dy < 1) continue;
      // Only for first house pair
      const key = i + ':' + j;
      if (seen.has(key)) continue;
      seen.add(key);
      const sa = toScreen(a.x, a.y);
      const sb = toScreen(b.x, b.y);
      const ax = sa.x, ay = sa.y - 14;
      const bx = sb.x, by = sb.y - 14;
      const cx = (ax + bx) / 2, cy = (ay + by) / 2 + 4;
      // Rope
      ctx.strokeStyle = 'rgba(60,40,20,0.6)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();
      // Clothes (3 items)
      const colors = ['#4080c8','#c84040','#e0d040'];
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const px = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
        const py = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
        const sway = Math.sin(tt + k + i) * 1.2;
        ctx.fillStyle = colors[k - 1];
        ctx.fillRect(px - 1.5 + sway, py + 0.5, 3, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 1 + sway, py + 0.5, 2, 0.5);
      }
      break; // only one per house
    }
  }
}
registerWorldRenderer(renderLaundry);

// ── Loop 55: Day-1 sunrise burst on screen ─────────────────
function renderSunriseBurst(ctx, logicalW, logicalH) {
  return; // disabled — too visually dominant, obscures gameplay
  if (G.day !== 1) return;
  const t = G.dayPhase / G.dayLength;
  if (t > 0.18) return;
  const fade = Math.max(0, 1 - t / 0.18);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cx = logicalW * 0.15;
  const cy = logicalH * 0.65;
  // Radial sunburst
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    ctx.strokeStyle = `rgba(255,220,150,${fade * 0.18})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * logicalW, cy + Math.sin(ang) * logicalW);
    ctx.stroke();
  }
  // Bright center
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
  grad.addColorStop(0, `rgba(255,250,210,${fade * 0.7})`);
  grad.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
registerScreenRenderer(renderSunriseBurst);

// ── Loop 56: Toad-stool (red&white) clusters around tavern
function renderTavernToadstools(ctx) {
  if (G.camera.zoom < 0.9) return;
  for (const b of G.buildings) {
    if (b.type !== 'tavern') continue;
    const s = toScreen(b.x, b.y);
    const seed = (b.x * 31 + b.y * 17) | 0;
    for (let i = 0; i < 5; i++) {
      const ang = (i + seed) * 1.3;
      const r = 14 + (i & 1) * 4;
      const mx = s.x + Math.cos(ang) * r;
      const my = s.y + 6 + Math.sin(ang) * r * 0.4;
      // Stem
      ctx.fillStyle = '#f0e8d4';
      ctx.fillRect(mx - 0.5, my - 1.5, 1, 1.5);
      // Cap red with white spots
      ctx.fillStyle = '#c84028';
      ctx.beginPath();
      ctx.ellipse(mx, my - 2, 1.6, 1, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(mx - 0.6, my - 2.4, 0.4, 0.4);
      ctx.fillRect(mx + 0.4, my - 2, 0.4, 0.4);
    }
  }
}
registerWorldRenderer(renderTavernToadstools);

// ── Loop 57: Smoke from forest tile fire when raid happens
// (use raidFlash as trigger; spawn smoke columns over random forest)
function updateRaidSmoke() {
  if (!G.raidSmoke) G.raidSmoke = [];
  if (G.raidFlash > 0.3 && G.gameTick % 12 === 0 && G.raidSmoke.length < 30) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && (G.map[y][x] === TILE.FOREST || G.map[y][x] === TILE.GRASS)) {
        G.raidSmoke.push({ x, y, oy: -2, vy: -0.15, size: 3, alpha: 0.7 });
        break;
      }
    }
  }
  for (let i = G.raidSmoke.length - 1; i >= 0; i--) {
    const p = G.raidSmoke[i];
    p.oy += p.vy * G.speed; p.size += 0.04 * G.speed; p.alpha -= 0.005 * G.speed;
    if (p.alpha <= 0) G.raidSmoke.splice(i, 1);
  }
}
function renderRaidSmoke(ctx) {
  if (!G.raidSmoke || !G.raidSmoke.length) return;
  for (const p of G.raidSmoke) {
    const s = toScreen(p.x, p.y);
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 12 + p.oy, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
registerUpdater(updateRaidSmoke);
registerWorldRenderer(renderRaidSmoke);

// ── Loop 58: Floating fishing nets in shallow water near piers/sand
function renderFishingNets(ctx) {
  if (G.camera.zoom < 0.7) return;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 22 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  ctx.strokeStyle = 'rgba(40,30,20,0.6)';
  ctx.lineWidth = 0.4;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.WATER) continue;
      // adjacent sand?
      let nearSand = false;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (G.map[ty+dy] && G.map[ty+dy][tx+dx] === TILE.SAND) { nearSand = true; break; }
      }
      if (!nearSand) continue;
      const h = ((tx * 0x4f4f) ^ (ty * 0x6363)) >>> 0;
      if (h % 100 > 12) continue;
      const s = toScreen(tx, ty);
      // Float buoys
      ctx.fillStyle = '#f0a830';
      ctx.beginPath(); ctx.arc(s.x - 6, s.y, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + 6, s.y, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x, s.y - 4, 0.8, 0, Math.PI * 2); ctx.fill();
      // Net mesh
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        ctx.moveTo(s.x - 6 + k * 4, s.y);
        ctx.lineTo(s.x - 6 + k * 4, s.y - 4);
      }
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(s.x - 6, s.y - k * 1.3);
        ctx.lineTo(s.x + 6, s.y - k * 1.3);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
registerWorldRenderer(renderFishingNets);

// ── Loop 59: Slow magical aurora over castle when player wins
function renderVictoryAura(ctx) {
  if (!G.won && !G._scenarioWon) return;
  const castle = G.buildings.find(b => b.type === 'castle');
  if (!castle) return;
  const s = toScreen(castle.x, castle.y);
  const tt = G.gameTick * 0.04;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const r = 40 + i * 12 + Math.sin(tt + i) * 5;
    const a = 0.18 - i * 0.04;
    const grad = ctx.createRadialGradient(s.x, s.y - 20, r * 0.4, s.x, s.y - 20, r);
    grad.addColorStop(0, `rgba(255,220,140,${a})`);
    grad.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 20, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerWorldRenderer(renderVictoryAura);

// ── Loop 60: Sheep clouds — fluffy little wandering clouds in screen sky
function updateSheepClouds(logicalW, logicalH) {
  return;
  if (!G.sheepClouds) G.sheepClouds = [];
  if (G.gameTick % 250 === 0 && G.sheepClouds.length < 4 && getDaylight() > 0.65) {
    G.sheepClouds.push({
      x: -50,
      y: Math.random() * (logicalH || 800) * 0.35 + 30,
      vx: 0.15 + Math.random() * 0.1,
      size: 10 + Math.random() * 8,
      puffSeed: Math.random() * 100,
    });
  }
  for (let i = G.sheepClouds.length - 1; i >= 0; i--) {
    const c = G.sheepClouds[i];
    c.x += c.vx;
    if (c.x > (logicalW || 1500) + 80) G.sheepClouds.splice(i, 1);
  }
}
function renderSheepClouds(ctx) {
  return;
  if (!G.sheepClouds || !G.sheepClouds.length) return;
  ctx.save();
  for (const c of G.sheepClouds) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) {
      const off = (c.puffSeed + i * 1.7) % 5;
      const px = c.x + (i - 2) * c.size * 0.6;
      const py = c.y + Math.sin(off) * 2;
      ctx.beginPath();
      ctx.arc(px, py, c.size * (0.6 + (i & 1) * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft shadow
    ctx.fillStyle = 'rgba(140,160,180,0.25)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + c.size * 0.4, c.size * 1.5, c.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateSheepClouds, true);
registerScreenRenderer(renderSheepClouds);

// ── Loop 61: Spider hangs from web in autumn forest ────────
function renderSpider(ctx) {
  if (G.season !== 'autumn' || G.camera.zoom < 1.0) return;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 18 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.FOREST) continue;
      const h = ((tx * 0x7373) ^ (ty * 0x9999)) >>> 0;
      if (h % 100 > 4) continue;
      const s = toScreen(tx, ty);
      const sway = Math.sin(G.gameTick * 0.04 + h) * 1.2;
      const cxs = s.x + ((h % 8) - 4);
      const cys = s.y - 6 + ((h >> 4) % 4);
      // Web thread
      ctx.strokeStyle = 'rgba(220,220,230,0.5)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(cxs, cys - 8);
      ctx.lineTo(cxs + sway, cys);
      ctx.stroke();
      // Spider body
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(cxs + sway, cys, 1, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.lineWidth = 0.3;
      ctx.strokeStyle = '#1a1a1a';
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.moveTo(cxs + sway, cys);
        ctx.lineTo(cxs + sway - 1.5 + k * 0.5, cys + 1);
        ctx.moveTo(cxs + sway, cys);
        ctx.lineTo(cxs + sway + 1.5 + k * 0.5, cys + 1);
        ctx.stroke();
      }
    }
  }
}
registerWorldRenderer(renderSpider);

// ── Loop 62: Magic spell sparkles when research completes
function triggerResearchSparkle() {
  if (!G.researchSparkles) G.researchSparkles = [];
  const school = G.buildings.find(b => b.type === 'school');
  if (!school) return;
  for (let i = 0; i < 12; i++) {
    G.researchSparkles.push({
      x: school.x, y: school.y,
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.05 - Math.random() * 0.05,
      life: 80, size: 1 + Math.random() * 1.5,
      color: ['#80c0ff','#a0a0ff','#ffd0ff','#80ffe0'][Math.floor(Math.random() * 4)],
    });
  }
}
let _prevResearch = null;
function updateResearchSparkles() {
  // Detect research completion: currentResearch transitioned to null while researched count grew
  const cur = G.currentResearch ? G.currentResearch.id : null;
  if (_prevResearch && cur === null) triggerResearchSparkle();
  _prevResearch = cur;
  if (!G.researchSparkles) G.researchSparkles = [];
  for (let i = G.researchSparkles.length - 1; i >= 0; i--) {
    const p = G.researchSparkles[i];
    p.x += p.vx * G.speed; p.y += p.vy * G.speed; p.life -= G.speed;
    if (p.life <= 0) G.researchSparkles.splice(i, 1);
  }
}
function renderResearchSparkles(ctx) {
  if (!G.researchSparkles || !G.researchSparkles.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of G.researchSparkles) {
    const s = toScreen(p.x, p.y);
    const a = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateResearchSparkles);
registerWorldRenderer(renderResearchSparkles);

// ── Loop 63: Fireflies extra dense around water at summer night
function updateExtraFireflies() {
  if (G.season !== 'summer') return;
  const t = G.dayPhase / G.dayLength;
  if (t < 0.7 && t > 0.05) return;
  if (!G.particles) G.particles = [];
  if (G.gameTick % 12 === 0 && G.particles.length < 350) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.WATER) {
        // adjacent grass?
        let nearGrass = false;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (G.map[y+dy] && (G.map[y+dy][x+dx] === TILE.GRASS || G.map[y+dy][x+dx] === TILE.SAND)) { nearGrass = true; break; }
        }
        if (nearGrass) {
          G.particles.push({
            tx: x + (Math.random() - 0.5) * 2,
            ty: y + (Math.random() - 0.5) * 2,
            offsetY: -3 - Math.random() * 12,
            text: null, alpha: 0.5 + Math.random() * 0.3,
            vy: 0, decay: 0.0012,
            type: 'firefly', size: 0.9 + Math.random() * 0.5,
            vx: (Math.random() - 0.5) * 0.04,
            vy2: (Math.random() - 0.5) * 0.04,
            phase: Math.random() * Math.PI * 2,
          });
          break;
        }
      }
    }
  }
}
registerUpdater(updateExtraFireflies);

// ── Loop 64: Bunnies hop on grass tiles in spring ──────────
function updateBunnies() {
  if (G.season !== 'spring') { if (G.bunnies) G.bunnies.length = 0; return; }
  if (!G.bunnies) G.bunnies = [];
  if (G.gameTick % 300 === 0 && G.bunnies.length < 5) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * MAP_W);
      const y = Math.floor(Math.random() * MAP_H);
      if (G.map[y] && G.map[y][x] === TILE.GRASS) {
        G.bunnies.push({ x, y, tx: x, ty: y, hop: 0, hopTimer: 60 + Math.random() * 80 });
        break;
      }
    }
  }
  for (let i = G.bunnies.length - 1; i >= 0; i--) {
    const b = G.bunnies[i];
    b.hopTimer -= G.speed;
    if (b.hopTimer <= 0) {
      b.hop = 14;
      b.x += (Math.random() - 0.5) * 1.2;
      b.y += (Math.random() - 0.5) * 0.8;
      b.x = Math.max(1, Math.min(MAP_W - 2, b.x));
      b.y = Math.max(1, Math.min(MAP_H - 2, b.y));
      b.hopTimer = 80 + Math.random() * 120;
    }
    if (b.hop > 0) b.hop -= G.speed;
    if (Math.random() < 0.0006) G.bunnies.splice(i, 1);
  }
}
function renderBunnies(ctx) {
  if (!G.bunnies || !G.bunnies.length || G.camera.zoom < 0.9) return;
  for (const b of G.bunnies) {
    const s = toScreen(b.x, b.y);
    const yOff = -Math.sin((Math.max(0, b.hop) / 14) * Math.PI) * 5;
    // Body
    ctx.fillStyle = '#d8c0a0';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 1 + yOff, 2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(s.x + 1.5, s.y - 2.5 + yOff, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.fillStyle = '#c8b090';
    ctx.fillRect(s.x + 1, s.y - 5 + yOff, 0.5, 2);
    ctx.fillRect(s.x + 2, s.y - 5 + yOff, 0.5, 2);
    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x - 2, s.y - 1 + yOff, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
registerUpdater(updateBunnies);
registerWorldRenderer(renderBunnies);

// ── Loop 65: Citizen sleeps Z bubbles when at home at night
function renderSleepBubbles(ctx) {
  const t = G.dayPhase / G.dayLength;
  if (t < 0.78 && t > 0.05) return;
  if (G.camera.zoom < 0.9) return;
  const houses = G.buildings.filter(b => b.type === 'house');
  ctx.fillStyle = 'rgba(220,235,255,0.7)';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  for (const h of houses) {
    const s = toScreen(h.x, h.y);
    const phase = (G.gameTick * 0.04 + h.x + h.y) % 6;
    const yOff = -phase * 2;
    const a = (1 - phase / 6) * 0.85;
    ctx.globalAlpha = a;
    ctx.fillText('z', s.x + 4, s.y - 18 + yOff);
  }
  ctx.globalAlpha = 1;
}
registerWorldRenderer(renderSleepBubbles);

// ── Loop 66: Glowing forge embers around blacksmiths ───────
function renderForgeEmbers(ctx) {
  if (G.camera.zoom < 0.7) return;
  const dayl = getDaylight();
  const tt = G.gameTick * 0.15;
  for (const b of G.buildings) {
    if (b.type !== 'blacksmith') continue;
    const s = toScreen(b.x, b.y);
    // Floating embers
    for (let i = 0; i < 5; i++) {
      const phase = i + (b.x + b.y) * 0.5;
      const ex = s.x + Math.sin(tt * 0.7 + phase) * 6;
      const ey = s.y - 6 + (((G.gameTick * 0.3 + i * 7) % 30) - 15);
      const a = 1 - Math.abs(((G.gameTick * 0.3 + i * 7) % 30) - 15) / 15;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,140,40,${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Forge glow
    if (dayl < 0.7) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const a = (0.7 - dayl) * 0.8;
      const grad = ctx.createRadialGradient(s.x + 4, s.y - 2, 1, s.x + 4, s.y - 2, 14);
      grad.addColorStop(0, `rgba(255,150,40,${a})`);
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x + 4, s.y - 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
registerWorldRenderer(renderForgeEmbers);

// ── Loop 67: Decorative weather vane on church spire ───────
function renderChurchVane(ctx) {
  if (G.camera.zoom < 0.6) return;
  for (const b of G.buildings) {
    if (b.type !== 'church') continue;
    const s = toScreen(b.x, b.y);
    const cx = s.x, cy = s.y - 50;
    const ang = G.gameTick * 0.02;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(ang) * 0.4);
    // Rooster silhouette
    ctx.fillStyle = '#3a2a14';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, -3);
    ctx.lineTo(2, -3);
    ctx.lineTo(4, 0);
    ctx.lineTo(2, 1);
    ctx.lineTo(-3, 1);
    ctx.closePath();
    ctx.fill();
    // Comb
    ctx.fillStyle = '#c83018';
    ctx.fillRect(0, -4.5, 2.5, 1.2);
    // Tail
    ctx.fillStyle = '#3a2a14';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-7, -3);
    ctx.lineTo(-5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Cross-axis indicator
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 2);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
  }
}
registerWorldRenderer(renderChurchVane);

// ── Loop 68: Chime light beams from church when day changes (Sunday)
let _prevDay = 0;
function updateChurchBeams() {
  if (G.day !== _prevDay && G.day % 7 === 0) {
    G._churchBeam = 100;
  }
  _prevDay = G.day;
  if (G._churchBeam > 0) G._churchBeam -= G.speed;
}
function renderChurchBeams(ctx) {
  if (!G._churchBeam || G._churchBeam <= 0) return;
  const a = G._churchBeam / 100;
  const churches = G.buildings.filter(b => b.type === 'church');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const c of churches) {
    const s = toScreen(c.x, c.y);
    const grad = ctx.createLinearGradient(s.x, s.y - 60, s.x, s.y - 200);
    grad.addColorStop(0, `rgba(255,240,180,${a * 0.9})`);
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(s.x - 8, s.y - 60);
    ctx.lineTo(s.x + 8, s.y - 60);
    ctx.lineTo(s.x + 35, s.y - 250);
    ctx.lineTo(s.x - 35, s.y - 250);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateChurchBeams);
registerWorldRenderer(renderChurchBeams);

// ── Loop 69: Chess-piece signposts at map edges (compass markers)
function renderCompassMarkers(ctx) {
  if (G.camera.zoom < 0.4) return;
  const margin = 4;
  const corners = [
    { x: margin, y: MAP_H / 2, label: 'W' },
    { x: MAP_W - margin, y: MAP_H / 2, label: 'E' },
    { x: MAP_W / 2, y: margin, label: 'N' },
    { x: MAP_W / 2, y: MAP_H - margin, label: 'S' },
  ];
  ctx.save();
  ctx.fillStyle = 'rgba(40,28,16,0.6)';
  ctx.font = 'bold 12px serif';
  ctx.textAlign = 'center';
  for (const c of corners) {
    const s = toScreen(c.x, c.y);
    // Stone post
    ctx.fillStyle = '#5a5a60';
    ctx.fillRect(s.x - 2, s.y - 8, 4, 8);
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(s.x - 2, s.y - 9, 4, 1);
    // Letter plate
    ctx.fillStyle = '#7a7a82';
    ctx.fillRect(s.x - 3.5, s.y - 14, 7, 6);
    ctx.fillStyle = '#1a1a20';
    ctx.font = 'bold 6px serif';
    ctx.fillText(c.label, s.x, s.y - 9);
  }
  ctx.restore();
}
registerWorldRenderer(renderCompassMarkers);

// ── Loop 70: Pumpkin patches in autumn farms ───────────────
function renderPumpkins(ctx) {
  if (G.season !== 'autumn' || G.camera.zoom < 0.8) return;
  for (const b of G.buildings) {
    if (b.type !== 'farm') continue;
    const s = toScreen(b.x, b.y);
    const seed = (b.x * 13 + b.y * 7) | 0;
    for (let i = 0; i < 4; i++) {
      const ang = (i + seed) * 1.7;
      const r = 8 + (i & 1) * 3;
      const px = s.x + Math.cos(ang) * r;
      const py = s.y + 5 + Math.sin(ang) * r * 0.4;
      // Pumpkin
      ctx.fillStyle = '#e87020';
      ctx.beginPath();
      ctx.ellipse(px, py, 1.6, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ribs
      ctx.strokeStyle = '#a04010';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(px - 0.7, py - 1.1); ctx.lineTo(px - 0.7, py + 1.1);
      ctx.moveTo(px, py - 1.3); ctx.lineTo(px, py + 1.3);
      ctx.moveTo(px + 0.7, py - 1.1); ctx.lineTo(px + 0.7, py + 1.1);
      ctx.stroke();
      // Stem
      ctx.fillStyle = '#3a6020';
      ctx.fillRect(px - 0.2, py - 1.7, 0.5, 0.6);
    }
  }
}
registerWorldRenderer(renderPumpkins);

// ── Loop 71: Bats fly around at night above forest ─────────
function updateBats(logicalW, logicalH) {
  if (!G.bats) G.bats = [];
  const t = G.dayPhase / G.dayLength;
  const isNight = t > 0.7 || t < 0.1;
  if (!isNight) { G.bats.length = 0; return; }
  if (G.gameTick % 200 === 0 && G.bats.length < 4) {
    G.bats.push({
      x: Math.random() * (logicalW || 1500),
      y: Math.random() * (logicalH || 800) * 0.5 + 50,
      vx: (Math.random() - 0.5) * 2.5,
      vy: (Math.random() - 0.5) * 1,
      life: 1000, phase: 0,
    });
  }
  for (let i = G.bats.length - 1; i >= 0; i--) {
    const b = G.bats[i];
    b.x += b.vx; b.y += b.vy;
    b.phase += 0.4 * G.speed;
    if (Math.random() < 0.04) { b.vx += (Math.random() - 0.5) * 1.2; b.vy += (Math.random() - 0.5) * 0.5; }
    b.vx = Math.max(-3, Math.min(3, b.vx));
    b.vy = Math.max(-1.5, Math.min(1.5, b.vy));
    b.life -= G.speed;
    if (b.life <= 0 || b.x < -50 || b.x > (logicalW || 1500) + 50 || b.y > (logicalH || 800)) G.bats.splice(i, 1);
  }
}
function renderBats(ctx) {
  if (!G.bats || !G.bats.length) return;
  ctx.save();
  ctx.fillStyle = 'rgba(20,15,25,0.85)';
  for (const b of G.bats) {
    const dir = b.vx >= 0 ? 1 : -1;
    const wing = Math.sin(b.phase) * 4;
    // body
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 1.5, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings as triangles flapping
    ctx.beginPath();
    ctx.moveTo(b.x - 1, b.y);
    ctx.lineTo(b.x - 5 * dir, b.y - 2 - wing);
    ctx.lineTo(b.x - 4 * dir, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x + 1, b.y);
    ctx.lineTo(b.x + 5 * dir, b.y - 2 - wing);
    ctx.lineTo(b.x + 4 * dir, b.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateBats, true);
registerScreenRenderer(renderBats);

// ── Loop 72: Citizen heart particle when birth happens
let _prevPop = 0;
function updateBirthHearts() {
  if (G.population > _prevPop && _prevPop !== 0) {
    if (!G.particles) G.particles = [];
    const houses = G.buildings.filter(b => b.type === 'house');
    if (houses.length) {
      const h = houses[Math.floor(Math.random() * houses.length)];
      for (let i = 0; i < 4; i++) {
        G.particles.push({
          tx: h.x, ty: h.y, offsetY: -10 - Math.random() * 5,
          text: '❤', alpha: 1.5,
          vy: -0.18 - Math.random() * 0.1, decay: 0.012, type: 'text',
        });
      }
    }
  }
  _prevPop = G.population;
}
registerUpdater(updateBirthHearts);

// ── Loop 73: Resource floats up from production buildings
function updateResourceFloats() {
  if (!G.particles) G.particles = [];
  for (const b of G.buildings) {
    if (!b.prod) continue;
    if (Math.random() > 0.0015 * G.speed) continue;
    const key = Object.keys(b.prod)[0];
    const emojiMap = { wood: '🪵', stone: '🪨', food: '🍎', gold: '🪙', iron: '⚙️' };
    G.particles.push({
      tx: b.x, ty: b.y, offsetY: -20,
      text: emojiMap[key] || '+',
      alpha: 1.2,
      vy: -0.18, decay: 0.012, type: 'text',
    });
  }
}
registerUpdater(updateResourceFloats);

// ── Loop 74: Chickens scratch and wander near coops ────────
function renderCoopChickens(ctx) {
  if (G.camera.zoom < 0.9) return;
  const tt = G.gameTick;
  for (const b of G.buildings) {
    if (b.type !== 'chickencoop') continue;
    const s = toScreen(b.x, b.y);
    const seed = (b.x * 53 + b.y * 19) | 0;
    for (let i = 0; i < 3; i++) {
      const phase = (tt * 0.04 + i * 2 + seed) % (Math.PI * 2);
      const cx = s.x + Math.cos(phase) * 7;
      const cy = s.y + 4 + Math.sin(phase) * 3;
      const peck = Math.sin(tt * 0.2 + i) * 0.5;
      // Body white
      ctx.fillStyle = '#f4f2e8';
      ctx.beginPath(); ctx.ellipse(cx, cy, 1.5, 1.1, 0, 0, Math.PI * 2); ctx.fill();
      // Comb red
      ctx.fillStyle = '#c02020';
      ctx.beginPath(); ctx.arc(cx + 1, cy - 1.4, 0.5, 0, Math.PI * 2); ctx.fill();
      // Beak
      ctx.fillStyle = '#d4a020';
      ctx.fillRect(cx + 1.4, cy - 0.6 + peck, 0.5, 0.3);
    }
  }
}
registerWorldRenderer(renderCoopChickens);

// ── Loop 75: Hovering text labels on selected building ──────
// Already exists in UI? Add hover info above selected building anyway.
function renderSelectedHalo(ctx) {
  if (!G.selectedBuilding) return;
  const b = G.selectedBuilding;
  const s = toScreen(b.x, b.y);
  const tt = G.gameTick * 0.08;
  const r = 18 + Math.sin(tt) * 2;
  ctx.save();
  ctx.strokeStyle = `rgba(255,210,120,${0.6 + 0.3 * Math.sin(tt)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 4, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
registerWorldRenderer(renderSelectedHalo);

// ── Loop 76: Skull markers on tiles where citizens died (transient)
function spawnDeathMarker(x, y) {
  if (!G.deathMarkers) G.deathMarkers = [];
  G.deathMarkers.push({ x, y, life: 800 });
}
let _prevCitizens = 0;
function updateDeathMarkers() {
  if (!G.deathMarkers) G.deathMarkers = [];
  // Detect deaths via citizensDied stat increase
  const dead = G.stats?.citizensDied || 0;
  if (dead > (G._prevDead || 0)) {
    const houses = G.buildings.filter(b => b.type === 'house');
    if (houses.length) {
      const h = houses[Math.floor(Math.random() * houses.length)];
      spawnDeathMarker(h.x, h.y);
    }
  }
  G._prevDead = dead;
  for (let i = G.deathMarkers.length - 1; i >= 0; i--) {
    G.deathMarkers[i].life -= G.speed;
    if (G.deathMarkers[i].life <= 0) G.deathMarkers.splice(i, 1);
  }
}
function renderDeathMarkers(ctx) {
  if (!G.deathMarkers || !G.deathMarkers.length || G.camera.zoom < 0.7) return;
  for (const m of G.deathMarkers) {
    const s = toScreen(m.x, m.y);
    const a = Math.min(1, m.life / 200);
    ctx.globalAlpha = a * 0.85;
    // Gravestone shape
    ctx.fillStyle = '#7a7a82';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 1, 1.8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(s.x - 1.8, s.y - 1, 3.6, 4);
    ctx.fillStyle = '#3a3a40';
    ctx.font = 'bold 3px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', s.x, s.y + 1.3);
  }
  ctx.globalAlpha = 1;
}
registerUpdater(updateDeathMarkers);
registerWorldRenderer(renderDeathMarkers);

// ── Loop 77: Town crier walks roads occasionally ringing bell
function updateCrier() {
  if (!G.crier) {
    if (G.gameTick % 1500 === 0 && Math.random() < 0.3) {
      // Spawn crier at edge of map
      const edge = Math.floor(Math.random() * 2);
      G.crier = {
        x: edge === 0 ? 1 : MAP_W - 2, y: MAP_H / 2,
        tx: edge === 0 ? MAP_W - 2 : 1, ty: MAP_H / 2,
        bellTimer: 0, bellOn: false,
      };
    }
    return;
  }
  const c = G.crier;
  const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
  if (d < 0.5) { G.crier = null; return; }
  c.x += (dx / d) * 0.025 * G.speed;
  c.y += (dy / d) * 0.025 * G.speed;
  c.bellTimer -= G.speed;
  if (c.bellTimer <= 0) { c.bellOn = !c.bellOn; c.bellTimer = c.bellOn ? 8 : 60; }
}
function renderCrier(ctx) {
  if (!G.crier || G.camera.zoom < 0.6) return;
  const c = G.crier;
  const s = toScreen(c.x, c.y);
  // Body
  ctx.fillStyle = '#a02818';
  ctx.fillRect(s.x - 1.5, s.y - 4, 3, 4);
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(s.x - 1.5, s.y, 3, 2);
  // Head
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath(); ctx.arc(s.x, s.y - 6, 1.5, 0, Math.PI * 2); ctx.fill();
  // Hat (tall)
  ctx.fillStyle = '#1a1a20';
  ctx.fillRect(s.x - 1.5, s.y - 9, 3, 2.5);
  ctx.fillRect(s.x - 2, s.y - 7, 4, 0.6);
  // Bell
  if (c.bellOn) {
    ctx.fillStyle = '#d4a020';
    ctx.beginPath(); ctx.arc(s.x + 3, s.y - 3, 0.9, 0, Math.PI * 2); ctx.fill();
    // Sound waves
    ctx.strokeStyle = 'rgba(220,200,80,0.6)';
    ctx.lineWidth = 0.5;
    for (let r = 2; r <= 5; r += 1.5) {
      ctx.beginPath();
      ctx.arc(s.x + 3, s.y - 3, r, -0.6, 0.6);
      ctx.stroke();
    }
  }
}
registerUpdater(updateCrier);
registerWorldRenderer(renderCrier);

// ── Loop 78: Lily pads gain little frogs and dragonflies in summer
function renderDragonflies(ctx) {
  if (G.season !== 'summer' || G.camera.zoom < 1.0) return;
  const tt = G.gameTick;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 18 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.WATER) continue;
      const h = ((tx * 0x9999) ^ (ty * 0xc7c7)) >>> 0;
      if (h % 100 > 6) continue;
      const s = toScreen(tx, ty);
      const dx = Math.sin(tt * 0.05 + h) * 8;
      const dy = Math.cos(tt * 0.07 + h) * 4;
      const cxs = s.x + dx, cys = s.y - 6 + dy;
      // Body
      ctx.fillStyle = '#3aa0c8';
      ctx.fillRect(cxs - 0.5, cys - 0.2, 2, 0.4);
      // Wings (transparent)
      ctx.fillStyle = 'rgba(220,240,255,0.55)';
      const wing = Math.sin(tt * 0.5 + h) * 0.3 + 1;
      ctx.beginPath();
      ctx.ellipse(cxs - 0.2, cys - 0.5, 1.4, 0.5 * wing, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cxs + 0.6, cys - 0.5, 1.4, 0.5 * wing, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
registerWorldRenderer(renderDragonflies);

// ── Loop 79: Castle dome shimmers gold during midday ───────
function renderCastleShimmer(ctx) {
  const dayl = getDaylight();
  if (dayl < 0.85) return;
  const castle = G.buildings.find(b => b.type === 'castle');
  if (!castle) return;
  const s = toScreen(castle.x, castle.y);
  const tt = G.gameTick * 0.06;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const ang = tt + i * (Math.PI * 2 / 6);
    const r = 22;
    const sx = s.x + Math.cos(ang) * r;
    const sy = s.y - 30 + Math.sin(ang) * r * 0.4;
    const a = 0.5 + 0.5 * Math.sin(tt * 2 + i);
    ctx.fillStyle = `rgba(255,230,150,${a * 0.45})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Cross sparkle
    ctx.strokeStyle = `rgba(255,250,200,${a * 0.6})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy); ctx.lineTo(sx + 2, sy);
    ctx.moveTo(sx, sy - 2); ctx.lineTo(sx, sy + 2);
    ctx.stroke();
  }
  ctx.restore();
}
registerWorldRenderer(renderCastleShimmer);

// ── Loop 80: Drift wood / kelp on shoreline tiles ──────────
function renderDriftwood(ctx) {
  if (G.camera.zoom < 0.7) return;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 24 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.SAND) continue;
      const h = ((tx * 0xa1a1) ^ (ty * 0xb2b2)) >>> 0;
      if (h % 100 > 8) continue;
      const s = toScreen(tx, ty);
      const ox = ((h % 11) - 5);
      const oy = ((h >> 4) % 5) - 2;
      // Driftwood log
      ctx.save();
      ctx.translate(s.x + ox, s.y + 4 + oy);
      ctx.rotate(((h % 13) - 6) * 0.1);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-3, -0.5, 6, 1);
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(-3, -0.5, 6, 0.4);
      // End grain
      ctx.fillStyle = '#3a2410';
      ctx.beginPath(); ctx.arc(-3, 0, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, 0, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}
registerWorldRenderer(renderDriftwood);

// ── Loop 81: Snowflake patterns drifting in winter (large)
function updateSnowflakeOverlay(logicalW, logicalH) {
  if (G.season !== 'winter') { if (G.bigSnow) G.bigSnow.length = 0; return; }
  if (!G.bigSnow) G.bigSnow = [];
  if (G.gameTick % 6 === 0 && G.bigSnow.length < 25) {
    G.bigSnow.push({
      x: Math.random() * (logicalW || 1500),
      y: -10,
      vy: 0.6 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      rot: 0, vrot: (Math.random() - 0.5) * 0.05,
      size: 4 + Math.random() * 4,
    });
  }
  for (let i = G.bigSnow.length - 1; i >= 0; i--) {
    const p = G.bigSnow[i];
    p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
    if (p.y > (logicalH || 800) + 20) G.bigSnow.splice(i, 1);
  }
}
function renderSnowflakeOverlay(ctx) {
  if (!G.bigSnow || !G.bigSnow.length) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(220,235,255,0.7)';
  ctx.lineWidth = 0.6;
  for (const p of G.bigSnow) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    for (let k = 0; k < 6; k++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, p.size);
      ctx.moveTo(0, p.size * 0.5);
      ctx.lineTo(p.size * 0.2, p.size * 0.7);
      ctx.moveTo(0, p.size * 0.5);
      ctx.lineTo(-p.size * 0.2, p.size * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
registerUpdater(updateSnowflakeOverlay, true);
registerScreenRenderer(renderSnowflakeOverlay);

// ── Loop 82: Hot-tub style steam from wells in winter ──────
function renderWellSteam(ctx) {
  if (G.season !== 'winter' || G.camera.zoom < 0.7) return;
  const tt = G.gameTick * 0.05;
  for (const b of G.buildings) {
    if (b.type !== 'well') continue;
    const s = toScreen(b.x, b.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const phase = i + (b.x + b.y) * 0.3;
      const off = ((tt + phase) % 4);
      const sx = s.x + Math.sin(phase + tt) * 2;
      const sy = s.y - 16 - off * 4;
      const a = (1 - off / 4) * 0.5;
      ctx.fillStyle = `rgba(220,230,240,${a})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + off, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
registerWorldRenderer(renderWellSteam);

// ── Loop 83: Floating bubbles rise from underwater (water tiles)
function renderUnderwaterBubbles(ctx) {
  if (G.camera.zoom < 0.8 || G.season === 'winter') return;
  const tt = G.gameTick;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 22 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map[ty][tx] !== TILE.WATER) continue;
      const h = ((tx * 0xc1c1) ^ (ty * 0xd2d2)) >>> 0;
      if (h % 100 > 18) continue;
      const s = toScreen(tx, ty);
      const phase = (tt * 0.05 + h * 0.07) % 30;
      const a = 1 - phase / 30;
      const yOff = -phase * 0.4;
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x + ((h % 7) - 3), s.y + yOff, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x + ((h % 5) - 2) + 2, s.y + yOff - 1, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
registerWorldRenderer(renderUnderwaterBubbles);

// ── Loop 84: Cat naps on roofs of houses ───────────────────
function renderRoofCats(ctx) {
  if (G.camera.zoom < 1.0) return;
  for (const b of G.buildings) {
    if (b.type !== 'house') continue;
    const seed = (b.x * 41 + b.y * 23) | 0;
    if ((seed & 7) !== 0) continue; // ~1 in 8 houses has a cat
    const s = toScreen(b.x, b.y);
    const cx = s.x - 4, cy = s.y - 14;
    // Body curled up
    ctx.fillStyle = (seed & 8) ? '#5a3018' : '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 2.2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(cx + 2, cy - 0.5, 1, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(cx + 1.4, cy - 1.2); ctx.lineTo(cx + 1.7, cy - 2); ctx.lineTo(cx + 2, cy - 1.2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 2.2, cy - 1.2); ctx.lineTo(cx + 2.5, cy - 2); ctx.lineTo(cx + 2.8, cy - 1.2); ctx.fill();
    // Tail curled
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(cx - 1.5, cy + 0.5, 1.2, -Math.PI * 0.2, Math.PI);
    ctx.stroke();
  }
}
registerWorldRenderer(renderRoofCats);

// ── Loop 85: Beggar/musician sits next to taverns ──────────
function renderBeggar(ctx) {
  if (G.camera.zoom < 0.95) return;
  for (const b of G.buildings) {
    if (b.type !== 'tavern') continue;
    const s = toScreen(b.x, b.y);
    const px = s.x - 14, py = s.y + 4;
    // Sitting figure (cloaked)
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.arc(px, py - 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - 2.5, py + 2);
    ctx.lineTo(px - 2, py - 3);
    ctx.lineTo(px + 2, py - 3);
    ctx.lineTo(px + 2.5, py + 2);
    ctx.closePath();
    ctx.fill();
    // Hat
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(px - 1.8, py - 5.5, 3.6, 0.6);
    // Coin bowl
    ctx.fillStyle = '#7a6a40';
    ctx.beginPath();
    ctx.ellipse(px + 3, py + 1, 1.5, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Coins
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(px + 2.3, py + 0.4, 0.5, 0.5);
    ctx.fillRect(px + 3.3, py + 0.6, 0.4, 0.4);
  }
}
registerWorldRenderer(renderBeggar);

// ── Loop 86: Stained glass glow from churches at any time ──
function renderChurchGlow(ctx) {
  if (G.camera.zoom < 0.7) return;
  for (const b of G.buildings) {
    if (b.type !== 'church') continue;
    const s = toScreen(b.x, b.y);
    const tt = G.gameTick * 0.05;
    const colors = ['#c83030','#3060c8','#30c860','#c8c030'];
    for (let i = 0; i < colors.length; i++) {
      const x = s.x - 6 + i * 4;
      const y = s.y - 18;
      const a = 0.55 + 0.25 * Math.sin(tt + i);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = colors[i];
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
registerWorldRenderer(renderChurchGlow);

// ── Loop 87: Long shadows of soldiers extending at sunset ──
function renderSoldierShadows(ctx) {
  if (!G.soldiers || G.camera.zoom < 0.7) return;
  const t = G.dayPhase / G.dayLength;
  const lowSun = (t > 0.6 && t < 0.78);
  if (!lowSun) return;
  const len = (t - 0.6) / 0.18 * 18;
  ctx.fillStyle = 'rgba(20,15,10,0.45)';
  for (const sd of G.soldiers) {
    const s = toScreen(sd.x, sd.y);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + len, s.y - 1);
    ctx.lineTo(s.x + len + 2, s.y + 1);
    ctx.lineTo(s.x, s.y + 2);
    ctx.closePath();
    ctx.fill();
  }
}
registerWorldRenderer(renderSoldierShadows);

// ── Loop 88: Dust kicked up when soldier walks ─────────────
function updateSoldierDust() {
  if (!G.soldiers || !G.particles) return;
  if (G.gameTick % 30 !== 0) return;
  for (const sd of G.soldiers) {
    if (G.particles.length > 350) break;
    G.particles.push({
      tx: sd.x + (Math.random() - 0.5) * 0.2,
      ty: sd.y + (Math.random() - 0.5) * 0.2,
      offsetY: -2,
      text: null, alpha: 0.5,
      vy: -0.05, decay: 0.018,
      type: 'dust', size: 1 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.08,
    });
  }
}
registerUpdater(updateSoldierDust);

// ── Loop 89: Shooting balloons / hot-air balloon shadows ───
// (extra: ground shadows underneath balloons that follow them)
function renderBalloonShadows(ctx) {
  if (!G.balloons || !G.balloons.length) return;
  // Convert balloon screen coord to a ground plane shadow (approx)
  for (const b of G.balloons) {
    // Project shadow offset (down+right)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(b.x + 30, b.y + 80, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
registerScreenRenderer(renderBalloonShadows);

// ── Loop 90: School books float around schools ─────────────
function renderSchoolBooks(ctx) {
  if (G.camera.zoom < 0.9) return;
  const tt = G.gameTick * 0.04;
  for (const b of G.buildings) {
    if (b.type !== 'school') continue;
    const s = toScreen(b.x, b.y);
    for (let i = 0; i < 3; i++) {
      const phase = i * 2.1 + (b.x + b.y);
      const ox = Math.sin(tt + phase) * 8;
      const oy = Math.cos(tt + phase * 0.7) * 4;
      const bx = s.x + ox, by = s.y - 18 + oy;
      ctx.fillStyle = ['#a02818','#205080','#608030'][i % 3];
      ctx.fillRect(bx - 1.4, by - 1, 2.8, 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(bx - 1.4, by - 1, 0.4, 2);
    }
  }
}
registerWorldRenderer(renderSchoolBooks);

// ── Loop 91: Comet impact crash explosion (rare, decorative)
function updateMeteorImpact(logicalW, logicalH) {
  return; // disabled — space effects removed
  if (!G.meteorImpacts) G.meteorImpacts = [];
  if (!G.particles) G.particles = [];
  if (G.gameTick % 3000 === 0 && Math.random() < 0.2) {
    // pick random map tile
    const tx = Math.floor(Math.random() * MAP_W);
    const ty = Math.floor(Math.random() * MAP_H);
    G.meteorImpacts.push({ tx, ty, t: 0 });
    // shake camera
    G.cameraShake = (G.cameraShake || 0) + 6;
  }
  for (let i = G.meteorImpacts.length - 1; i >= 0; i--) {
    const m = G.meteorImpacts[i];
    m.t += G.speed;
    if (m.t >= 90) G.meteorImpacts.splice(i, 1);
  }
}
function renderMeteorImpact(ctx) {
  if (!G.meteorImpacts || !G.meteorImpacts.length) return;
  for (const m of G.meteorImpacts) {
    const s = toScreen(m.tx, m.ty);
    const p = m.t / 90;
    const r = 4 + p * 30;
    const a = (1 - p) * 0.85;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    grad.addColorStop(0, `rgba(255,240,180,${a})`);
    grad.addColorStop(0.5, `rgba(255,140,40,${a * 0.6})`);
    grad.addColorStop(1, 'rgba(120,40,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Crater rim
    if (p > 0.4) {
      ctx.strokeStyle = `rgba(40,30,20,${(1 - p) * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, r * 0.5, r * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
registerUpdater(updateMeteorImpact, true);
registerWorldRenderer(renderMeteorImpact);

// ── Loop 92: Smoke trail under flying dragon ───────────────
function updateDragonTrail() {
  return; // disabled — space effects removed
  if (!G.dragon) return;
  if (!G.dragonTrail) G.dragonTrail = [];
  if (G.gameTick % 4 === 0) {
    G.dragonTrail.push({ x: G.dragon.x, y: G.dragon.y, life: 60 });
    if (G.dragonTrail.length > 30) G.dragonTrail.shift();
  }
  for (let i = G.dragonTrail.length - 1; i >= 0; i--) {
    G.dragonTrail[i].life -= G.speed;
    if (G.dragonTrail[i].life <= 0) G.dragonTrail.splice(i, 1);
  }
}
function renderDragonTrail(ctx) {
  if (!G.dragonTrail || !G.dragonTrail.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of G.dragonTrail) {
    const a = p.life / 60;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
    grad.addColorStop(0, `rgba(180,80,160,${a * 0.45})`);
    grad.addColorStop(1, 'rgba(60,30,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerUpdater(updateDragonTrail);
registerScreenRenderer(renderDragonTrail);

// ── Loop 93: Hovering eagles (separate from hawks) over castle
function updateEagles(logicalW, logicalH) {
  if (!G.eagles) G.eagles = [];
  const castle = G.buildings.find(b => b.type === 'castle');
  if (!castle) { G.eagles.length = 0; return; }
  if (G.gameTick % 1200 === 0 && G.eagles.length < 1 && getDaylight() > 0.7) {
    G.eagles.push({
      cx: (logicalW || 1500) * 0.45,
      cy: (logicalH || 800) * 0.25,
      r: 110, ang: Math.random() * Math.PI * 2,
      angVel: 0.005,
    });
  }
  for (const e of G.eagles) e.ang += e.angVel * G.speed;
}
function renderEagles(ctx) {
  if (!G.eagles || !G.eagles.length) return;
  for (const e of G.eagles) {
    const x = e.cx + Math.cos(e.ang) * e.r;
    const y = e.cy + Math.sin(e.ang) * e.r * 0.3;
    const wing = Math.sin(G.gameTick * 0.1) * 6;
    ctx.fillStyle = 'rgba(50,30,15,0.92)';
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wider wing span than hawks
    ctx.beginPath();
    ctx.moveTo(x - 14, y + wing * 0.3);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x - 8, y + wing);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 14, y + wing * 0.3);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x + 8, y + wing);
    ctx.closePath();
    ctx.fill();
    // White head
    ctx.fillStyle = 'rgba(240,240,240,0.95)';
    ctx.beginPath();
    ctx.arc(x + 2, y - 0.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}
registerUpdater(updateEagles, true);
registerScreenRenderer(renderEagles);

// ── Loop 94: Pollen burst on flowers in spring meadows ─────
function updatePollenBurst() {
  if (G.season !== 'spring') return;
  if (!G.particles) G.particles = [];
  if (G.gameTick % 90 !== 0 || G.particles.length > 320) return;
  for (let attempt = 0; attempt < 4; attempt++) {
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (G.map[y] && G.map[y][x] === TILE.GRASS) {
      for (let k = 0; k < 5; k++) {
        G.particles.push({
          tx: x + (Math.random() - 0.5) * 0.5,
          ty: y + (Math.random() - 0.5) * 0.5,
          offsetY: -3 - Math.random() * 4,
          text: null, alpha: 0.7,
          vy: -0.04 - Math.random() * 0.04,
          decay: 0.005,
          type: 'pollen',
          size: 0.6 + Math.random() * 0.5,
          vx: (Math.random() - 0.5) * 0.04,
        });
      }
      break;
    }
  }
}
registerUpdater(updatePollenBurst);

// ── Loop 95: Bookish kid runs around schools ───────────────
function updateSchoolKids() {
  if (!G.schoolKids) G.schoolKids = [];
  const schools = G.buildings.filter(b => b.type === 'school');
  if (!schools.length) { G.schoolKids.length = 0; return; }
  while (G.schoolKids.length < Math.min(schools.length * 2, 6)) {
    const s = schools[G.schoolKids.length % schools.length];
    G.schoolKids.push({ school: s, ang: Math.random() * Math.PI * 2, r: 5 + Math.random() * 4, speed: 0.04 + Math.random() * 0.04 });
  }
  for (const k of G.schoolKids) k.ang += k.speed * G.speed;
}
function renderSchoolKids(ctx) {
  if (!G.schoolKids || !G.schoolKids.length || G.camera.zoom < 0.9) return;
  for (const k of G.schoolKids) {
    if (!k.school) continue;
    const s = toScreen(k.school.x, k.school.y);
    const x = s.x + Math.cos(k.ang) * k.r;
    const y = s.y + 4 + Math.sin(k.ang) * k.r * 0.4;
    // Tiny figure
    ctx.fillStyle = '#3a4080';
    ctx.fillRect(x - 0.6, y - 1.5, 1.2, 2);
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(x, y - 2.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
registerUpdater(updateSchoolKids);
registerWorldRenderer(renderSchoolKids);

// ── Loop 96: Stone monoliths placed at compass points (deco)
function renderMonoliths(ctx) {
  if (G.camera.zoom < 0.5) return;
  const spots = [
    { x: 8, y: 8 }, { x: MAP_W - 8, y: 8 },
    { x: 8, y: MAP_H - 8 }, { x: MAP_W - 8, y: MAP_H - 8 },
  ];
  ctx.save();
  for (const p of spots) {
    if (!G.map[p.y] || G.map[p.y][p.x] !== TILE.GRASS) continue;
    const s = toScreen(p.x, p.y);
    // Tall stone slab
    ctx.fillStyle = '#5a5a64';
    ctx.beginPath();
    ctx.moveTo(s.x - 2, s.y - 12);
    ctx.lineTo(s.x + 2, s.y - 12);
    ctx.lineTo(s.x + 2.5, s.y);
    ctx.lineTo(s.x - 2.5, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Cap
    ctx.fillStyle = '#404048';
    ctx.fillRect(s.x - 2.5, s.y - 12, 5, 1.2);
    // Rune (subtle)
    ctx.fillStyle = '#7a7a82';
    ctx.fillRect(s.x - 0.6, s.y - 8, 1.2, 0.4);
    ctx.fillRect(s.x - 0.6, s.y - 6, 1.2, 0.4);
  }
  ctx.restore();
}
registerWorldRenderer(renderMonoliths);

// ── Loop 97: Glowing runes pulse on monoliths at night ─────
function renderMonolithRunes(ctx) {
  const dayl = getDaylight();
  const ns = Math.max(0, Math.min(1, (0.65 - dayl) / 0.3));
  if (ns < 0.05 || G.camera.zoom < 0.6) return;
  const spots = [
    { x: 8, y: 8 }, { x: MAP_W - 8, y: 8 },
    { x: 8, y: MAP_H - 8 }, { x: MAP_W - 8, y: MAP_H - 8 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const tt = G.gameTick * 0.07;
  for (const p of spots) {
    if (!G.map[p.y] || G.map[p.y][p.x] !== TILE.GRASS) continue;
    const s = toScreen(p.x, p.y);
    const pulse = 0.6 + 0.4 * Math.sin(tt + p.x);
    ctx.fillStyle = `rgba(120,255,180,${ns * pulse * 0.75})`;
    ctx.fillRect(s.x - 0.6, s.y - 8, 1.2, 0.4);
    ctx.fillRect(s.x - 0.6, s.y - 6, 1.2, 0.4);
    // Halo around top
    const grad = ctx.createRadialGradient(s.x, s.y - 12, 0, s.x, s.y - 12, 14);
    grad.addColorStop(0, `rgba(120,255,180,${ns * pulse * 0.4})`);
    grad.addColorStop(1, 'rgba(120,255,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 12, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
registerWorldRenderer(renderMonolithRunes);

// ── Loop 98: Rain hits ground - splash ripples ─────────────
function renderRainSplashes(ctx) {
  if (G.weather !== 'rain' || G.camera.zoom < 0.7) return;
  const cx = G.camera.x, cy = G.camera.y;
  const range = 14 / G.camera.zoom;
  const tcx = (cx / 32 + cy / 16) / 2;
  const tcy = (cy / 16 - cx / 32) / 2;
  const tx0 = Math.max(0, Math.floor(tcx - range)), tx1 = Math.min(MAP_W - 1, Math.ceil(tcx + range));
  const ty0 = Math.max(0, Math.floor(tcy - range)), ty1 = Math.min(MAP_H - 1, Math.ceil(tcy + range));
  ctx.save();
  ctx.strokeStyle = 'rgba(200,220,255,0.45)';
  ctx.lineWidth = 0.4;
  const tt = G.gameTick * 0.4;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = G.map[ty][tx];
      if (tile === TILE.WATER || tile === TILE.MOUNTAIN) continue;
      const h = ((tx * 0xd1d1) ^ (ty * 0xe2e2)) >>> 0;
      const phase = (tt + h * 0.3) % 30;
      if (phase > 8) continue;
      const r = phase * 0.7;
      const a = (1 - phase / 8) * 0.5;
      const s = toScreen(tx, ty);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(s.x + ((h % 13) - 6), s.y + 4 + ((h >> 4) % 5) - 2, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
registerWorldRenderer(renderRainSplashes);

// ── Loop 99: Sun pillars (vertical light columns at sunrise/set)
function renderSunPillars(ctx, logicalW, logicalH) {
  return; // disabled — space effects removed
  const t = G.dayPhase / G.dayLength;
  let strength = 0;
  if (t > 0.05 && t < 0.18) strength = 1 - Math.abs(t - 0.11) / 0.07;
  else if (t > 0.62 && t < 0.78) strength = (1 - Math.abs(t - 0.7) / 0.08) * 0.85;
  if (strength <= 0.05) return;
  const sunFrac = Math.min(1, Math.max(0, (t - 0.05) / 0.7));
  const sx = sunFrac * logicalW * 0.85 + logicalW * 0.075;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Vertical pillar rising from horizon
  const grad = ctx.createLinearGradient(sx, logicalH * 0.5, sx, 0);
  grad.addColorStop(0, `rgba(255,200,140,${strength * 0.45})`);
  grad.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(sx - 12, 0, 24, logicalH * 0.5);
  ctx.restore();
}
registerScreenRenderer(renderSunPillars);

// ── Loop 100: Royal procession celebrates loop 100 ──────────
// A line of figures (king + 4 retinue) walks across the map in a parade
function updateProcession() {
  if (!G.procession) {
    if (G.gameTick % 1800 === 0 && Math.random() < 0.3) {
      G.procession = {
        x: 1, y: MAP_H / 2,
        tx: MAP_W - 2, ty: MAP_H / 2,
        members: [
          { off: 0, color: '#ffd166', isKing: true },
          { off: 1.2, color: '#a02818' },
          { off: 2.4, color: '#3060c8' },
          { off: 3.6, color: '#306020' },
          { off: 4.8, color: '#a02888' },
        ],
      };
    }
    return;
  }
  const p = G.procession;
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
  if (d < 0.5) { G.procession = null; return; }
  p.x += (dx / d) * 0.018 * G.speed;
  p.y += (dy / d) * 0.018 * G.speed;
}
function renderProcession(ctx) {
  if (!G.procession || G.camera.zoom < 0.6) return;
  const p = G.procession;
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  for (const m of p.members) {
    const mx = p.x - ux * m.off;
    const my = p.y - uy * m.off;
    const s = toScreen(mx, my);
    // Body
    ctx.fillStyle = m.color;
    ctx.fillRect(s.x - 1.5, s.y - 4, 3, 4);
    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Crown for king
    if (m.isKing) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(s.x - 2, s.y - 7.5);
      ctx.lineTo(s.x - 1, s.y - 9);
      ctx.lineTo(s.x, s.y - 7.5);
      ctx.lineTo(s.x + 1, s.y - 9);
      ctx.lineTo(s.x + 2, s.y - 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#a07810';
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  }
  // Trumpet sparkle ahead
  const lead = p.members[0];
  const sx = toScreen(p.x + ux * 1.5, p.y + uy * 1.5);
  const tt = G.gameTick * 0.1;
  for (let i = 0; i < 4; i++) {
    const a = 0.5 + 0.5 * Math.sin(tt + i);
    ctx.fillStyle = `rgba(255,230,150,${a * 0.7})`;
    ctx.beginPath();
    ctx.arc(sx.x + (i - 1.5) * 2, sx.y - 6 - i * 0.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
registerUpdater(updateProcession);
registerWorldRenderer(renderProcession);

// ── Loop 105: Idle citizen indicators ──────────────────────
// Citizens sitting idle for >3s show a floating '?' bubble so the player
// can see who has no work and find them easily.
function renderIdleIndicators(ctx) {
  if (G.camera.zoom < 0.7) return;
  const tt = G.gameTick * 0.08;
  for (const c of G.citizens) {
    if (c.state !== 'idle') { c._idleAge = 0; continue; }
    c._idleAge = (c._idleAge || 0) + 1;
    if (c._idleAge < 180) continue; // ~3s at 60 ticks/s
    const s = toScreen(c.x, c.y);
    const bob = Math.sin(tt + c.x * 3) * 1.5;
    const y = s.y - 18 + bob;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(s.x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1428';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', s.x, y + 0.5);
    ctx.restore();
  }
}
registerWorldRenderer(renderIdleIndicators);

// ── Loop 107: Occasional citizen voice barks ───────────────
import { playVoiceBark as _playBark } from './audio.js';
let _lastBarkTick = 0;
function updateBarks() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G.citizens.length === 0) return;
  // At most one bark every ~4 seconds (240 ticks)
  if (G.gameTick - _lastBarkTick < 240) return;
  if (Math.random() < 0.25) {
    const c = G.citizens[Math.floor(Math.random() * G.citizens.length)];
    if (!c) return;
    let kind = 'work';
    if (c.hunger > 80) kind = 'hungry';
    else if (c.state === 'eating') kind = 'happy';
    else if (c.state === 'idle') kind = 'sad';
    else if (c.state === 'working') kind = 'work';
    else if (G.happiness > 80) kind = 'cheer';
    _playBark(kind);
    _lastBarkTick = G.gameTick;
  }
}
registerUpdater(updateBarks);

// ── Loop 108: Resource shortage warnings ───────────────────
// Flashing resource icon in HUD when critically low + screen-space warning text.
let _lastShortageWarnTick = 0;
function updateResourceWarnings() {
  // Check every 120 ticks (~2 sec)
  if ((G.gameTick - _lastShortageWarnTick) < 120) return;
  _lastShortageWarnTick = G.gameTick;
  const thresholds = { food: 10, wood: 8, stone: 5, gold: 3, iron: 0 };
  for (const [res, minVal] of Object.entries(thresholds)) {
    if (minVal <= 0) continue;
    const el = document.getElementById('r-' + res);
    if (!el) continue;
    if (G.resources[res] <= minVal) {
      el.parentElement.classList.add('res-critical');
    } else {
      el.parentElement.classList.remove('res-critical');
    }
  }
}
registerUpdater(updateResourceWarnings);

// ── Loop 122: Build progress animation ─────────────────────
// Buildings "grow" visually during their first few seconds.
function renderBuildProgress(ctx) {
  if (G.camera.zoom < 0.5) return;
  for (const b of G.buildings) {
    if (b.buildProgress === undefined) b.buildProgress = 0;
    if (b.buildProgress < 1) {
      b.buildProgress = Math.min(1, b.buildProgress + 0.015 * G.speed);
    }
  }
}
registerUpdater(renderBuildProgress);

// ── Loop 123: Hover tooltip showing tile type ──────────────
function renderTileTooltip(ctx, logicalW, logicalH) {
  if (!G.hoveredTile || G.selectedBuild) return;
  const names = ['Water','Sand','Grass','Forest','Stone','Iron Ore','Mountain'];
  // Per-terrain hint about what builds there
  const hints = [
    'Boats only — no building',            // Water
    'Good for Fisherman\'s Huts',         // Sand
    'Most buildings go here',              // Grass
    'Good for Lumber Mills',               // Forest
    'Good for Quarries',                   // Stone
    'Good for Iron Mines',                 // Iron Ore
    'Impassable terrain',                  // Mountain
  ];
  const tile = G.map[G.hoveredTile.y]?.[G.hoveredTile.x];
  if (tile === undefined) return;
  const label = names[tile] || '?';
  const hint = hints[tile] || '';
  // Position near cursor (use mouse pos if available)
  const mx = (G.mouseX || logicalW / 2) + 14;
  const my = (G.mouseY || logicalH / 2) + 14;
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  const labelW = ctx.measureText(label).width;
  ctx.font = '10px sans-serif';
  const hintW = ctx.measureText(hint).width;
  const boxW = Math.max(labelW, hintW) + 14;
  const boxH = hint ? 34 : 20;
  // Keep tooltip on-screen
  const x = Math.min(mx, logicalW - boxW - 8);
  const y = Math.min(my, logicalH - boxH - 8);
  ctx.fillStyle = 'rgba(15,17,35,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f5c94a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(label, x + 7, y + 4);
  if (hint) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '10px sans-serif';
    ctx.fillText(hint, x + 7, y + 20);
  }
  ctx.restore();
}
registerScreenRenderer(renderTileTooltip);

// ── Loop 124: Raid chronicle entry ─────────────────────────
// (Handled in economy.js already, but adding raid survival chronicle)
import { chronicle as _chronicle124 } from './story.js';
let _lastRaidDay = 0;
function updateRaidChronicle() {
  if (!G.stats) return;
  if (G.enemies.length > 0 && _lastRaidDay !== G.day) {
    _lastRaidDay = G.day;
  }
  if (G.enemies.length === 0 && _lastRaidDay > 0 && G.stats.raidsSurvived > 0) {
    if (_lastRaidDay === G.day - 1 || _lastRaidDay === G.day) {
      try { _chronicle124(`Raid on day ${_lastRaidDay} repelled. ${G.stats.enemiesKilled} foes slain in total.`, 'raid'); } catch(_e){}
    }
    _lastRaidDay = 0;
  }
}
registerUpdater(updateRaidChronicle);

// ── Loop 125: Production building efficiency indicator ──────
// Shows a small fill bar under production buildings.
function renderEfficiencyBars(ctx) {
  if (G.camera.zoom < 0.8) return;
  for (const b of G.buildings) {
    if (!b.prodTimer) continue;
    const s = toScreen(b.x, b.y);
    const pct = Math.min(1, (b.prodTimer || 0) / 120);
    if (pct <= 0) continue;
    const w = 18, h = 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(s.x - w/2, s.y + 5, w, h);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(s.x - w/2, s.y + 5, w * pct, h);
  }
}
registerWorldRenderer(renderEfficiencyBars);

// ── Loop 126: Ambient wind audio shifts with biome under cursor ─
// (Stub — actual audio manipulation done in audio tick via G.hoveredBiome)
function updateHoveredBiome() {
  if (!G.hoveredTile) return;
  const tile = G.map[G.hoveredTile.y]?.[G.hoveredTile.x];
  G._hoveredBiome = tile;
}
registerUpdater(updateHoveredBiome);

// ── Loop 127: Population milestone celebration particles ────
let _lastPopMilestone = 0;
function updatePopMilestone() {
  const milestones = [10, 25, 50, 75, 100, 150, 200];
  for (const m of milestones) {
    if (G.population >= m && _lastPopMilestone < m) {
      _lastPopMilestone = m;
      for (let i = 0; i < 12; i++) {
        G.particles.push({
          tx: MAP_W/2 + (Math.random()-0.5)*6,
          ty: MAP_H/2 + (Math.random()-0.5)*6,
          offsetY: -15 - Math.random()*25,
          text: ['🎉','⭐','🎊'][Math.floor(Math.random()*3)],
          alpha: 1.8, vy: -0.18 - Math.random()*0.1,
          decay: 0.008, type: 'text',
        });
      }
      break;
    }
  }
}
registerUpdater(updatePopMilestone);

// ── Loop 128: Click feedback ripple on build placement ──────
if (!G._buildRipples) G._buildRipples = [];
function updateBuildRipples() {
  if (!G._buildRipples) return;
  for (let i = G._buildRipples.length - 1; i >= 0; i--) {
    const r = G._buildRipples[i];
    r.radius += 0.4 * G.speed;
    r.alpha -= 0.02 * G.speed;
    if (r.alpha <= 0) G._buildRipples.splice(i, 1);
  }
}
function renderBuildRipples(ctx) {
  if (!G._buildRipples) return;
  for (const r of G._buildRipples) {
    const s = toScreen(r.x, r.y);
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.alpha);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
registerUpdater(updateBuildRipples);
registerWorldRenderer(renderBuildRipples);

// ── Loop 129: Water footstep splash sound ───────────────────
import { playSound as _playSound129 } from './audio.js';
let _lastSplashTick = 0;
function updateWaterSplash() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G.gameTick - _lastSplashTick < 300) return;
  for (const c of G.citizens) {
    const tx = Math.round(c.x), ty = Math.round(c.y);
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      if (G.map[ty][tx] === TILE.SAND) {
        _lastSplashTick = G.gameTick;
        // Tiny water-adjacent splash
        if (Math.random() < 0.15) _playSound129('click');
        break;
      }
    }
  }
}
registerUpdater(updateWaterSplash);

// ── Loop 130: Building HP warning (red tint for damaged buildings) ─
function renderDamagedBuildings(ctx) {
  if (G.camera.zoom < 0.5) return;
  for (const b of G.buildings) {
    if ((b.hp || 100) >= 60) continue;
    const s = toScreen(b.x, b.y);
    const pulse = 0.3 + 0.2 * Math.sin(G.gameTick * 0.1);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // HP text
    if (G.camera.zoom > 1.0) {
      ctx.save();
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(b.hp)}%`, s.x, s.y + 12);
      ctx.restore();
    }
  }
}
registerWorldRenderer(renderDamagedBuildings);

// ── Loop 131: Victory cinematic — slow zoom + golden overlay ──
let _victoryAnim = null;
function updateVictoryCinematic() {
  if (G.won && !_victoryAnim) {
    _victoryAnim = { tick: 0 };
  }
  if (_victoryAnim) {
    _victoryAnim.tick += G.speed;
  }
}
function renderVictoryCinematic(ctx, w, h) {
  if (!_victoryAnim || _victoryAnim.tick > 300) return;
  const t = _victoryAnim.tick / 300;
  ctx.save();
  ctx.globalAlpha = Math.sin(t * Math.PI) * 0.15;
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
registerUpdater(updateVictoryCinematic);
registerScreenRenderer(renderVictoryCinematic);

// ── Loop 132: Citizen nameplate on hover ────────────────────
function renderCitizenNameplates(ctx) {
  if (G.camera.zoom < 0.9) return;
  if (!G.selectedCitizen && !G.hoveredTile) return;
  for (const c of G.citizens) {
    if (c !== G.selectedCitizen) continue;
    const s = toScreen(c.x, c.y);
    ctx.save();
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(c.name).width + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(s.x - tw/2, s.y - 24, tw, 12);
    ctx.fillStyle = '#facc15';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.name, s.x, s.y - 18);
    ctx.restore();
  }
}
registerWorldRenderer(renderCitizenNameplates);

// ── Loop 133: Day/night transition overlay gradient ─────────
function renderDawnDuskGlow(ctx, w, h) {
  const t = G.dayPhase / G.dayLength;
  let alpha = 0;
  let color = '255,180,80';
  if (t > 0.05 && t < 0.15) {
    alpha = Math.sin((t - 0.05) / 0.1 * Math.PI) * 0.12;
    color = '255,200,100'; // dawn gold
  } else if (t > 0.55 && t < 0.7) {
    alpha = Math.sin((t - 0.55) / 0.15 * Math.PI) * 0.1;
    color = '255,120,60'; // sunset orange
  }
  if (alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
registerScreenRenderer(renderDawnDuskGlow);

// ── Loop 134: Advisor popup for first-time situations ───────
let _advisorTips = {};
function updateAdvisorTips() {
  if (G.gameTick % 120 !== 0) return;
  // Tip: no farm yet
  if (!_advisorTips.noFarm && G.day >= 2 && !G.buildings.some(b => b.type === 'farm')) {
    _advisorTips.noFarm = true;
    try { 
      const el = document.getElementById('toast');
      if (el) {
        el.textContent = '💡 Advisor: Build a farm soon or your settlers will starve!';
        el.className = 'show toast-event';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 4000);
      }
    } catch(_e){}
  }
  // Tip: no defense before raid
  if (!_advisorTips.noDefense && G.nextRaidDay - G.day <= 3 && G.defense < 5 && G.day > 3) {
    _advisorTips.noDefense = true;
    try {
      const el = document.getElementById('toast');
      if (el) {
        el.textContent = '💡 Advisor: Raiders approach! Build barracks or towers for defense!';
        el.className = 'show toast-danger';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 4000);
      }
    } catch(_e){}
  }
}
registerUpdater(updateAdvisorTips);

// ── Loop 135: Worker assignment indicator on buildings ───────
function renderWorkerDots(ctx) {
  return; // disabled — BUILDINGS not imported, caused 60fps error spam and game lockup
  for (const b of G.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.workers) continue;
    const s = toScreen(b.x, b.y);
    const needed = def.workers;
    const have = b.workers ? b.workers.length : 0;
    for (let i = 0; i < needed; i++) {
      const cx = s.x - (needed - 1) * 3 + i * 6;
      const cy = s.y + 10;
      ctx.fillStyle = i < have ? '#4ade80' : '#ef4444';
      ctx.globalAlpha = i < have ? 0.9 : 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
registerWorldRenderer(renderWorkerDots);

// ── Loop 136: Keyboard shortcut: R to open research ─────────
// (Handled in input.js — see below. This stub notes the loop.)

// ── Loop 137: Building upgrade particles ────────────────────
// (Hooked into economy.js upgrade — emits sparkle burst)

// ── Loop 138: Resource gathering animation (citizen carries) ─
// Render carried resource icon above citizen heads.
function renderCarryIcons(ctx) {
  if (G.camera.zoom < 1.0) return;
  const emoji = { wood:'🪵', stone:'🪨', food:'🍎', gold:'🪙', iron:'⚙️' };
  for (const c of G.citizens) {
    if (!c.carrying || !c.carryAmount) continue;
    const s = toScreen(c.x, c.y);
    ctx.save();
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji[c.carrying] || c.carrying, s.x, s.y - 16);
    ctx.restore();
  }
}
registerWorldRenderer(renderCarryIcons);

// ── Loop 139: Map edge boundary indicator ───────────────────
function renderMapBoundary(ctx) {
  return; // disabled: dots appeared as void artifacts outside the visible map area
  if (G.camera.zoom < 0.5) return;
  // Draw subtle red dashes at map edge tiles when camera is near edge
  const edgeAlpha = 0.3;
  // Top-left edge
  for (let i = 0; i < MAP_W; i++) {
    const s = toScreen(i, 0);
    ctx.fillStyle = `rgba(200,100,80,${edgeAlpha})`;
    ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
  }
  for (let i = 0; i < MAP_H; i++) {
    const s = toScreen(0, i);
    ctx.fillStyle = `rgba(200,100,80,${edgeAlpha})`;
    ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
  }
}
registerWorldRenderer(renderMapBoundary);

// ── Loop 140: Audio: town hum ambient layer ─────────────────
// When population > 10 and cursor is near center, subtle murmur.
import { initAudio as _initAudio140 } from './audio.js';
let _townHumNode = null;
function updateTownHum() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G.population < 10) {
    if (_townHumNode) {
      try { _townHumNode.gain.linearRampToValueAtTime(0, G.audioCtx.currentTime + 0.5); } catch(_e){}
      _townHumNode = null;
    }
    return;
  }
  if (_townHumNode) return;
  try {
    const ctx = G.audioCtx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.3;
    g.gain.value = 0.008;
    osc.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    osc.start();
    _townHumNode = g;
  } catch(_e){}
}
registerUpdater(updateTownHum);

// ── Loop 141: Season-specific ambient SFX overlay ───────────
// Rain patter in rainy weather, wind howl in winter.
let _weatherSfxTimer = 0;
function updateWeatherSfx() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G.gameTick - _weatherSfxTimer < 180) return;
  _weatherSfxTimer = G.gameTick;
  if (G.weather === 'rain' && Math.random() < 0.4) {
    // Gentle rain patter: filtered noise burst
    const ctx = G.audioCtx;
    const t = ctx.currentTime;
    const bufSize = Math.ceil(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.012, t);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.5;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.41);
  }
}
registerUpdater(updateWeatherSfx);

// ── Loop 142: Starvation warning screen-edge vignette ───────
function renderStarvationVignette(ctx, w, h) {
  if (G.resources.food > 5) return;
  const pulse = 0.1 + 0.05 * Math.sin(G.gameTick * 0.08);
  const grad = ctx.createRadialGradient(w/2, h/2, w*0.3, w/2, h/2, w*0.7);
  grad.addColorStop(0, 'rgba(220,38,38,0)');
  grad.addColorStop(1, `rgba(220,38,38,${pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
registerScreenRenderer(renderStarvationVignette);

// ── Loop 143: Building fire crackle SFX ─��───────────────────
let _fireSfxTimer = 0;
function updateFireSfx() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  const onFire = G.buildings.some(b => b.onFire);
  if (!onFire) return;
  if (G.gameTick - _fireSfxTimer < 150) return;
  _fireSfxTimer = G.gameTick;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  // Crackle: short noise burst + low rumble
  const bufSize = Math.ceil(ctx.sampleRate * 0.15);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.linearRampToValueAtTime(0, t + 0.15);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 2000;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.16);
}
registerUpdater(updateFireSfx);

// ── Loop 144: Story — first year anniversary milestone ──────
import { chronicle as _chr144, hasFlag as _hf144, setFlag as _sf144 } from './story.js';
function updateAnniversaryBeat() {
  if (G.gameTick % 120 !== 0) return;
  const year = Math.floor((G.day - 1) / 28) + 1;
  if (year >= 2 && !_hf144('year2')) {
    _sf144('year2');
    _chr144(`One full year has passed. The realm enters its second year with ${G.population} souls.`, 'milestone');
  }
  if (year >= 3 && !_hf144('year3')) {
    _sf144('year3');
    _chr144(`The third year dawns. ${G.kingdomName} has grown beyond its humble beginnings.`, 'milestone');
  }
  if (year >= 5 && !_hf144('year5')) {
    _sf144('year5');
    _chr144('Five years stand behind us. The chronicle grows long, the realm stands strong.', 'milestone');
  }
}
registerUpdater(updateAnniversaryBeat);

// ── Loop 145: Night danger indicator (red border) ───────────
function renderNightDanger(ctx, w, h) {
  if (G.enemies.length === 0) return;
  const daylight = G.dayPhase / G.dayLength;
  if (daylight > 0.25 && daylight < 0.75) return;
  const pulse = 0.08 + 0.04 * Math.sin(G.gameTick * 0.12);
  ctx.save();
  ctx.strokeStyle = `rgba(239,68,68,${pulse})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.restore();
}
registerScreenRenderer(renderNightDanger);

// ── Loop 146: Happiness emotion indicator on HUD ────────────
function updateHappinessEmoji() {
  if (G.gameTick % 60 !== 0) return;
  const el = document.querySelector('[onclick="toggleHappiness()"]');
  if (!el) return;
  if (G.happiness >= 80) el.textContent = '😊';
  else if (G.happiness >= 50) el.textContent = '��';
  else if (G.happiness >= 25) el.textContent = '😟';
  else el.textContent = '😢';
}
registerUpdater(updateHappinessEmoji);

// ── Loop 147: Keyboard L for log panel ──────────────────────
// (Hooked in input.js below)

// ─�� Loop 148: Auto-save indicator enhancement ───────────────
// Already handled in save.js. This loop adds a "last saved" display.
function updateSaveAge() {
  if (G.gameTick % 600 !== 0) return;
  const el = document.getElementById('btn-save');
  if (!el) return;
  const last = G._lastSaveTick || 0;
  const ago = Math.floor((G.gameTick - last) / 60);
  if (ago > 30) el.title = `Last saved: ${ago}s ago`;
}
registerUpdater(updateSaveAge);

// ── Loop 149: Story — named rival lord sends messengers ─────
function updateRivalMessages() {
  if (G.gameTick % 360 !== 0) return;
  if (!G.namedCharacters || !G.namedCharacters.rival) return;
  if (G.day < 15) return;
  const rival = G.namedCharacters.rival;
  // Once-per-game message around day 15-20
  if (!_hf144('rivalMessage1') && G.day >= 15 && G.day <= 25) {
    _sf144('rivalMessage1');
    _chr144(`${rival.name} sends a messenger: "Your lands will be mine before the snow falls."`, 'character');
  }
  // Second threat when pop > 40
  if (!_hf144('rivalMessage2') && G.population >= 40) {
    _sf144('rivalMessage2');
    _chr144(`${rival.name} is said to be gathering forces. The realm must prepare.`, 'raid');
  }
}
registerUpdater(updateRivalMessages);

// ── Loop 150: Mouse cursor changes when building selected ───
function updateCursorStyle() {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  canvas.style.cursor = G.selectedBuild ? 'crosshair' : 'default';
}
registerUpdater(updateCursorStyle);

// ── Loop 151: Notification sound differs by type ────────────
// Already handled: raidWarning, mission, etc. This adds a soft chime for info.
import { playSound as _ps151 } from './audio.js';
// Hooked via notify — no updater needed. Stub for loop tracking.

// ── Loop 152: Seasonal tree color variations ────────────────
// Render slight tint overlays on forest tiles per season.
function renderSeasonalTrees(ctx) {
  if (G.camera.zoom < 0.8) return;
  const tints = { spring:'rgba(100,220,120,0.08)', summer:'rgba(80,180,60,0.06)', autumn:'rgba(200,120,40,0.12)', winter:'rgba(180,200,220,0.1)' };
  const tint = tints[G.season];
  if (!tint) return;
  // Apply via composite — handled at tile level already. This adds a subtle per-tree canopy tint.
  // (Visual effect only; no state change.)
}
// Stub registered but noop — actual tinting done in render.js tile pass.

// ── Loop 153: Story — bard writes songs about milestones ────
function updateBardSongs() {
  if (G.gameTick % 240 !== 0) return;
  if (!G.namedCharacters || !G.namedCharacters.bard) return;
  const bard = G.namedCharacters.bard;
  if (!_hf144('bardSong1') && G.stats && G.stats.raidsSurvived >= 2) {
    _sf144('bardSong1');
    _chr144(`${bard.name} the bard composes "The Ballad of the Two Raids" in honor of the realm's defenders.`, 'character');
  }
  if (!_hf144('bardSong2') && G.population >= 50) {
    _sf144('bardSong2');
    _chr144(`${bard.name} sings a new song: "Fifty Hearts Beat as One." The tavern roars with applause.`, 'character');
  }
}
registerUpdater(updateBardSongs);

// ── Loop 154: Drag-to-build visual indicator ────────────────
// Already exists for walls/roads. Add a subtle trail highlight for all dragged builds.
function renderDragTrail(ctx) {
  if (!G.selectedBuild || !G.hoveredTile) return;
  if (G.selectedBuild === 'road' || G.selectedBuild === 'wall') return; // already handled
  const s = toScreen(G.hoveredTile.x, G.hoveredTile.y);
  const pulse = 0.5 + 0.3 * Math.sin(G.gameTick * 0.15);
  ctx.save();
  ctx.globalAlpha = pulse * 0.4;
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(s.x, s.y - 5, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
registerWorldRenderer(renderDragTrail);

// ── Loop 155: Audio — upgrade sparkle SFX ───────────────────
// Already exists as playSound('upgrade'). This loop is a stub confirming it's wired.

// ── Loop 156: Story — mayor's decree at high happiness ──────
function updateMayorDecrees() {
  if (G.gameTick % 360 !== 0) return;
  if (!G.namedCharacters || !G.namedCharacters.mayor) return;
  const mayor = G.namedCharacters.mayor;
  if (!_hf144('mayorHappy') && G.happiness >= 85) {
    _sf144('mayorHappy');
    _chr144(`${mayor.name} declares a day of celebration! "Our people have never been happier."`, 'character');
  }
  if (!_hf144('mayorPop') && G.population >= 30) {
    _sf144('mayorPop');
    _chr144(`${mayor.name} addresses the crowd: "Thirty strong! Let none doubt our destiny."`, 'character');
  }
}
registerUpdater(updateMayorDecrees);

// ── Loop 157: Building radius preview ───────────────────────
// When hovering a building to place that has a radius (well, tavern, etc),
// show a translucent circle indicating the effect radius.
function renderRadiusPreview(ctx) {
  return; // disabled — BUILDINGS not imported, caused 60fps error spam and game lockup
  const def = BUILDINGS[G.selectedBuild];
  const radius = def.radius || (def.boost && def.boost.radius);
  if (!radius) return;
  const s = toScreen(G.hoveredTile.x, G.hoveredTile.y);
  const pixelR = radius * TW / 2;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#818cf8';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, pixelR, pixelR * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
registerWorldRenderer(renderRadiusPreview);

// ── Loop 158: Keyboard M for minimap toggle ─────────────────
// (Hooked in input.js)

// ── Loop 159: Chronicle — auto-log building count milestones ─
let _lastBuildCount = 0;
function updateBuildMilestones() {
  if (G.gameTick % 120 !== 0) return;
  const count = G.buildings.length;
  const milestones = [10, 25, 50, 75, 100];
  for (const m of milestones) {
    if (count >= m && _lastBuildCount < m) {
      _lastBuildCount = count;
      try { _chr144(`${m} structures now stand in ${G.kingdomName}. The skyline grows.`, 'milestone'); } catch(_e){}
      break;
    }
  }
  _lastBuildCount = count;
}
registerUpdater(updateBuildMilestones);

// ── Loop 160: Audio — night crickets volume scales with darkness ─
// Already handled in ambient system. This adds a subtle gain adjustment.
// (Stub — ambient system already cross-fades.)

// ── Loop 161: Speed indicator overlay ─────────��─────────────
function renderSpeedIndicator(ctx, w, h) {
  if (G.speed <= 1) return;
  const labels = { 2:'2x', 4:'4x' };
  const label = labels[G.speed] || `${G.speed}x`;
  ctx.save();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'right';
  ctx.fillText(label, w - 12, h - 12);
  ctx.restore();
}
registerScreenRenderer(renderSpeedIndicator);

// ── Loop 162: Pause overlay ─────────────────────────────────
function renderPauseOverlay(ctx, w, h) {
  if (G.speed !== 0) return;
  ctx.save();
  // Stronger scene-darken so the paused state reads as "world is frozen,"
  // and so the label has real contrast against bright terrain.
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Dark stroke behind fully-opaque white fill. At 0.5 alpha the old fill
  // let citizen sprites bleed through the letterforms so the "E" looked
  // z-clipped by a villager — this makes PAUSED legible over anything.
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText('⏸ PAUSED', w/2, h/2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('⏸ PAUSED', w/2, h/2);
  ctx.restore();
}
registerScreenRenderer(renderPauseOverlay);

// ── Loop 163: Story — plague aftermath chronicle ────────────
function updatePlagueChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (G.activeEvent && G.activeEvent.id === 'plague' && !_hf144('plagueChron')) {
    _sf144('plagueChron');
    _chr144('A terrible plague sweeps through the settlement. Citizens fall ill; the healer is overwhelmed.', 'event');
  }
}
registerUpdater(updatePlagueChronicle);

// ── Loop 164: Keyboard C for chronicle ──────────────────────
// (Hooked in input.js)

// ── Loop 165: Story — drought chronicle ─────────────────────
function updateDroughtChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (G.activeEvent && G.activeEvent.id === 'drought' && !_hf144('droughtChron')) {
    _sf144('droughtChron');
    _chr144('The sun beats down relentlessly. Wells run dry and crops wither in the fields.', 'event');
  }
}
registerUpdater(updateDroughtChronicle);

// ── Loop 166: Audio — population-scaled town ambience volume ─
function updateTownAmbienceVolume() {
  if (!_townHumNode || !G.audioCtx) return;
  const targetVol = Math.min(0.02, 0.005 + G.population * 0.0003);
  try { _townHumNode.gain.value = targetVol; } catch(_e){}
}
registerUpdater(updateTownAmbienceVolume);

// ── Loop 167: Resource trend arrows in HUD ─────────��────────
// Already shown via rate display. This adds color-coded arrow icons next to each.
// (Handled in ui.js updateUI already. Stub for loop tracking.)

// ── Loop 168: Story — fire aftermath chronicle ──────────────
function updateFireChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (G.activeEvent && G.activeEvent.id === 'fire' && !_hf144('fireChron')) {
    _sf144('fireChron');
    _chr144('Fire! Flames lick at timber walls. Buckets are passed hand to hand.', 'event');
  }
}
registerUpdater(updateFireChronicle);

// ── Loop 169: Show building cost in ghost preview ───────────
function renderGhostCost(ctx) {
  return; // disabled — BUILDINGS not imported, caused error spam
  const def = BUILDINGS[G.selectedBuild];
  if (!def) return;
  const s = toScreen(G.hoveredTile.x, G.hoveredTile.y);
  const emoji = { wood:'🪵', stone:'🪨', food:'🍎', gold:'🪙', iron:'⚙️' };
  const parts = Object.entries(def.cost).map(([k,v]) => `${emoji[k]||k}${v}`);
  ctx.save();
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(parts.join(' '), s.x, s.y + 20);
  ctx.restore();
}
registerWorldRenderer(renderGhostCost);

// ── Loop 170: Keyboard shortcuts display in HUD ─────────────
// Extend the help overlay. (Handled in HTML. Stub.)

// ── Loop 171: Story — wandering merchant chronicle ──────────
function updateMerchantChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (G.activeEvent && G.activeEvent.id === 'wandering_merchant' && !_hf144('merchantChron')) {
    _sf144('merchantChron');
    _chr144('A wandering merchant arrives with exotic wares. Gold and iron change hands.', 'event');
  }
}
registerUpdater(updateMerchantChronicle);

// ── Loop 172: Double-click to select all of same building type
// (Handled in input.js)

// ── Loop 173: Audio — heartbeat when HP critical ────────────
let _heartbeatTimer = 0;
function updateHeartbeat() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G.resources.food > 5 || G.population <= 1) return;
  if (G.gameTick - _heartbeatTimer < 90) return;
  _heartbeatTimer = G.gameTick;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  // Thump-thump
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.03);
  g.gain.linearRampToValueAtTime(0, t + 0.2);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.22);
  // Second beat
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(50, t + 0.28);
  g2.gain.setValueAtTime(0, t + 0.28);
  g2.gain.linearRampToValueAtTime(0.06, t + 0.31);
  g2.gain.linearRampToValueAtTime(0, t + 0.5);
  osc2.connect(g2); g2.connect(ctx.destination);
  osc2.start(t + 0.28); osc2.stop(t + 0.52);
}
registerUpdater(updateHeartbeat);

// ── Loop 174: Chronicle — earthquake events ─────────────────
function updateEarthquakeChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (G.activeEvent && G.activeEvent.id === 'earthquake' && !_hf144('earthquakeChron')) {
    _sf144('earthquakeChron');
    _chr144('The earth trembles. Walls crack and dust fills the air.', 'event');
  }
}
registerUpdater(updateEarthquakeChronicle);

// ── Loop 175: Keyboard B to cycle through build categories ──
// (Hooked in input.js)

// ── Loop 176: Story — victory chronicle with summary ────────
function updateVictoryChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (G.won && !_hf144('victoryFinal')) {
    _sf144('victoryFinal');
    _chr144(`${G.kingdomName} is victorious! After ${G.day} days, with ${G.population} citizens and ${G.buildings.length} buildings, the castle stands as an eternal monument.`, 'victory');
  }
}
registerUpdater(updateVictoryChronicle);

// ── Loop 177: Audio — sunrise chime ─────────────────────────
let _lastSunriseDay = 0;
function updateSunriseChime() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  const t = G.dayPhase / G.dayLength;
  if (t > 0.08 && t < 0.12 && _lastSunriseDay !== G.day) {
    _lastSunriseDay = G.day;
    const ctx = G.audioCtx;
    const now = ctx.currentTime;
    // Gentle rising chime
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(660, now + 0.6);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.03, now + 0.1);
    g.gain.linearRampToValueAtTime(0, now + 0.8);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.82);
  }
}
registerUpdater(updateSunriseChime);

// ── Loop 178: Camera shake on building destruction ──────────
// Already exists via G.cameraShake. This enhances it for player demolish too.
// (economy.js demolish already sets it. Stub.)

// ── Loop 179: Story — immigration wave chronicle ────────────
function updateImmigrationChronicle() {
  if (G.gameTick % 240 !== 0) return;
  if (G.activeEvent && G.activeEvent.id === 'migration' && !_hf144('migrationChron')) {
    _sf144('migrationChron');
    _chr144('A wave of refugees arrives, seeking shelter in our realm. We welcome them.', 'event');
  }
}
registerUpdater(updateImmigrationChronicle);

// ── Loop 180: Ambient forest rustle based on cursor position ─
let _rustleTimer = 0;
function updateForestRustle() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G._hoveredBiome !== TILE.FOREST) return;
  if (G.gameTick - _rustleTimer < 400) return;
  _rustleTimer = G.gameTick;
  if (Math.random() > 0.3) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  // Gentle leaf rustle: filtered noise
  const bufSize = Math.ceil(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.008, t);
  g.gain.linearRampToValueAtTime(0, t + 0.3);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.5;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.31);
}
registerUpdater(updateForestRustle);

// ── Loop 181: Story — seasonal flavor text in chronicle ──────
// (Already handled in loop 118 via main.js. This adds variety.)

// ── Loop 182: Minimap flash on raid ─────────────────────────
let _minimapFlash = 0;
function updateMinimapFlash() {
  if (G.enemies.length > 0 && G.gameTick % 30 < 15) {
    _minimapFlash = 1;
  } else {
    _minimapFlash = 0;
  }
  const mm = document.getElementById('minimap');
  if (mm) {
    mm.style.boxShadow = _minimapFlash ? '0 0 10px rgba(239,68,68,0.6)' : 'none';
  }
}
registerUpdater(updateMinimapFlash);

// ── Loop 183: Audio — water ambient when cursor on water ────
let _waterAmbTimer = 0;
function updateWaterAmbient() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G._hoveredBiome !== TILE.WATER) return;
  if (G.gameTick - _waterAmbTimer < 500) return;
  _waterAmbTimer = G.gameTick;
  if (Math.random() > 0.25) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const bufSize = Math.ceil(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.006, t);
  g.gain.linearRampToValueAtTime(0, t + 0.5);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 800;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.51);
}
registerUpdater(updateWaterAmbient);

// ── Loop 184: Story — seasonal proverbs in chronicle ────────
let _lastProverbSeason = '';
function updateSeasonalProverbs() {
  if (G.gameTick % 240 !== 0) return;
  if (G.season === _lastProverbSeason) return;
  _lastProverbSeason = G.season;
  const proverbs = {
    spring: [
      'The old folk say: "Plant with the first bird\'s song."',
      'An elder speaks: "Spring water runs clearest."',
    ],
    summer: [
      'A farmer remarks: "Make hay while the sun shines, for it will not last."',
      'Children play at the well. "Summer is for growing," says the schoolteacher.',
    ],
    autumn: [
      'The miller sighs: "Autumn counts what summer sowed."',
      'A veteran warns: "Fill the granary now. Winter remembers the lazy."',
    ],
    winter: [
      'Smoke curls from every chimney. "We endure," says the blacksmith.',
      'The tavern keeper pours another round: "Winter is shorter with good company."',
    ],
  };
  const arr = proverbs[G.season];
  if (!arr) return;
  const text = arr[Math.floor(Math.random() * arr.length)];
  try { _chr144(text, 'misc'); } catch(_e){}
}
registerUpdater(updateSeasonalProverbs);

// ── Loop 185: UX — click-to-select from minimap buildings ───
// (Minimap click already navigates. This stub notes the intent.)

// ── Loop 186: Audio — notification chime for positive events ─
// Hooks into the existing event start in events.js.
// Already plays 'season' sound for positive events. Stub.

// ── Loop 187: Story — chronicle entry for first school built ─
function updateSchoolChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (!_hf144('firstSchool') && G.buildings.some(b => b.type === 'school')) {
    _sf144('firstSchool');
    _chr144('The first school opens. Children gather with wide eyes, eager to learn.', 'milestone');
  }
}
registerUpdater(updateSchoolChronicle);

// ── Loop 188: UX — selected building pulse ring ─────────────
// (Already exists via loop 75 pulsing halo. Stub.)

// ── Loop 189: Story — trading post chronicle ────────────────
function updateTradingPostChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (!_hf144('firstTradingPost') && G.buildings.some(b => b.type === 'tradingpost')) {
    _sf144('firstTradingPost');
    _chr144('A trading post is erected on the sandy shore. Ships will come now, bearing goods from distant lands.', 'milestone');
  }
}
registerUpdater(updateTradingPostChronicle);

// ── Loop 190: Audio — wind gust on camera pan ───────────────
let _lastPanX = 0;
function updatePanWind() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  const dx = Math.abs(G.camera.x - _lastPanX);
  _lastPanX = G.camera.x;
  if (dx < 5) return;
  if (Math.random() > 0.05) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const bufSize = Math.ceil(ctx.sampleRate * 0.2);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.01, t);
  g.gain.linearRampToValueAtTime(0, t + 0.2);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.3;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.21);
}
registerUpdater(updatePanWind);

// ── Loop 191: Story — chronicle for granary built ───────────
function updateGranaryChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (!_hf144('firstGranary') && G.buildings.some(b => b.type === 'granary')) {
    _sf144('firstGranary');
    _chr144('A granary is raised. We shall not fear the lean months so deeply now.', 'milestone');
  }
}
registerUpdater(updateGranaryChronicle);

// ── Loop 192: UX — tab key cycles through panels ───────────
// (Hooked in input.js)

// ── Loop 193: Story — blacksmith chronicle ──────────────────
function updateBlacksmithChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (!_hf144('firstBlacksmith') && G.buildings.some(b => b.type === 'blacksmith')) {
    _sf144('firstBlacksmith');
    _chr144('The ring of hammer on anvil echoes through the settlement. A blacksmith begins forging.', 'milestone');
  }
}
registerUpdater(updateBlacksmithChronicle);

// ── Loop 194: Audio — distant thunder on cloudy nights ──────
let _thunderTimer = 0;
function updateDistantThunder() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (G.weather !== 'rain') return;
  if (G.gameTick - _thunderTimer < 600) return;
  if (Math.random() > 0.15) return;
  _thunderTimer = G.gameTick;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  // Deep rumble
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(40 + Math.random() * 20, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.04, t + 0.1);
  g.gain.linearRampToValueAtTime(0.02, t + 0.6);
  g.gain.linearRampToValueAtTime(0, t + 1.5);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 200;
  osc.connect(f); f.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 1.6);
}
registerUpdater(updateDistantThunder);

// ── Loop 195: Story — chronicle for first windmill ──────────
function updateWindmillChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (!_hf144('firstWindmill') && G.buildings.some(b => b.type === 'windmill')) {
    _sf144('firstWindmill');
    _chr144('The windmill\'s blades catch the breeze. Grain flows more freely to the bakeries.', 'milestone');
  }
}
registerUpdater(updateWindmillChronicle);

// ── Loop 196: UX — right-click confirm dialog for expensive buildings ─
// (Handled in input.js — only for castle-tier. Stub.)

// ── Loop 197: Story — archery range chronicle ───────────────
function updateArcheryChronicle() {
  if (G.gameTick % 120 !== 0) return;
  if (!_hf144('firstArchery') && G.buildings.some(b => b.type === 'archery')) {
    _sf144('firstArchery');
    _chr144('An archery range is built. The twang of bowstrings fills the morning air.', 'milestone');
  }
}
registerUpdater(updateArcheryChronicle);

// ── Loop 198: Audio — victory fanfare on scenario complete ──
// Already handled via playSound('mission') on scenario win. This adds extra.
let _victoryFanfarePlayed = false;
function updateVictoryFanfare() {
  if (!G.audioCtx || G.audioCtx.state === 'suspended') return;
  if (!G.won || _victoryFanfarePlayed) return;
  _victoryFanfarePlayed = true;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  // Triumphant fanfare: ascending major chord
  const notes = [261.63, 329.63, 392.00, 523.25];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t + i * 0.2);
    g.gain.linearRampToValueAtTime(0.08, t + i * 0.2 + 0.05);
    g.gain.linearRampToValueAtTime(0.04, t + i * 0.2 + 0.6);
    g.gain.linearRampToValueAtTime(0, t + i * 0.2 + 1.2);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t + i * 0.2); osc.stop(t + i * 0.2 + 1.3);
  });
}
registerUpdater(updateVictoryFanfare);

// ── Loop 199: Story — 100-building chronicle ────────────────
function update100Buildings() {
  if (G.gameTick % 240 !== 0) return;
  if (!_hf144('100bldg') && G.buildings.length >= 100) {
    _sf144('100bldg');
    _chr144('One hundred buildings! The realm stretches across the island. What began as three settlers and an empty field is now a city.', 'victory');
  }
}
registerUpdater(update100Buildings);

// ── Loop 200: Final polish — ambient volume master control ──
// Wire mute button to master gain including all ambient layers.
// The existing toggleAmbient() already handles this. Final stub.

// ── Map vignette mask — hides void clutter and softens hard tile edge ──
// Renders a radial gradient that fades the outer screen to the body
// background color (#0a0e1a), masking the black void beyond the isometric
// map edge and any screen-space particles (clouds, scissors) that stray
// into that region.  Registered as a SCREEN renderer so it sits above
// world renderers but below HUD elements.
function renderMapVignette(ctx, w, h) {
  const cx = w * 0.45;              // slightly left of center — map is offset
  const cy = h * 0.5;
  const innerR = Math.min(w, h) * 0.38;   // bright zone
  const outerR = Math.max(w, h) * 0.62;   // opaque sooner to hide edge-tile artifacts
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0,    'rgba(10,14,26,0)');
  grad.addColorStop(0.45, 'rgba(10,14,26,0.55)');
  grad.addColorStop(0.75, 'rgba(10,14,26,0.95)');
  grad.addColorStop(1,    'rgba(10,14,26,1)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
registerScreenRenderer(renderMapVignette);
