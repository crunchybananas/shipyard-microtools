// ════════════════════════════════════════════════════════════
// Enhancements — incremental ambient features added across
// the autonomous improvement loops. Each block is self-contained
// and additive; do not remove prior blocks.
// ════════════════════════════════════════════════════════════

import { G, TILE, TW, TH, MAP_W, MAP_H, getDaylight } from './state.js';

function toScreen(tx, ty) { return { x: (tx - ty) * TW / 2, y: (tx + ty) * TH / 2 }; }

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
