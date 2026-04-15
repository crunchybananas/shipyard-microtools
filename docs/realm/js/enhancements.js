// ════════════════════════════════════════════════════════════
// Enhancements — incremental ambient features added across
// the autonomous improvement loops. Each block is self-contained
// and additive; do not remove prior blocks.
// ════════════════════════════════════════════════════════════

import { G, TILE, TW, TH, MAP_W, MAP_H, getDaylight } from './state.js';

function toScreen(tx, ty) { return { x: (tx - ty) * TW / 2, y: (tx + ty) * TH / 2 }; }

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
