// ════════════════════════════════════════════════════════════
// FX spawns callable from CORE files (ENGINE.md rule 4): plain-data
// pushes to G.particles — headless-safe, excluded from the determinism
// hash. Visual jitter is a stateless hash: presentation never advances the
// simulation RNG stream and can be culled/decayed independently by the shell.
// Particle UPDATE/decay lives shell-side (particles.js).
// ════════════════════════════════════════════════════════════

import { G } from './state.js?realm=166';

export function visualJitter(tx, ty, salt) {
  let value = Math.imul(Math.round(tx * 4096), 0x45d9f3b);
  value ^= Math.imul(Math.round(ty * 4096), 0x119de1f3);
  value ^= Math.imul(G.gameTick | 0, 0x27d4eb2d);
  value ^= Math.imul(salt | 0, 0x165667b1);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

export function spawnDust(tx, ty) {
  for (let i = 0; i < 8; i++) {
    const unit = channel => visualJitter(tx, ty, i * 11 + channel);
    G.particles.push({
      tx: tx + (unit(1) - 0.5) * 0.6,
      ty: ty + (unit(2) - 0.5) * 0.6,
      offsetY: -5 - unit(3) * 10,
      text: null,
      alpha: 0.5 + unit(4) * 0.3,
      vy: -0.2 - unit(5) * 0.15,
      decay: 0.008 + unit(6) * 0.005,
      type: 'dust',
      size: 1.5 + unit(7) * 2,
      vx: (unit(8) - 0.5) * 0.3,
    });
  }
}

// Shared melee-impact burst: called from BOTH soldier strikes and raider
// counter-attacks so hits read identically in both directions.
export function spawnClashFX(tx, ty) {
  G.particles.push({
    tx, ty, offsetY: -10,
    text: '⚔️', alpha: 1.1, vy: -0.2, decay: 0.05, type: 'text',
  });
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + visualJitter(tx, ty, 100 + k) * 0.5;
    G.particles.push({
      tx, ty, offsetY: -8,
      text: null, alpha: 1.0,
      vx: Math.cos(ang) * 0.22, vy: Math.sin(ang) * 0.22 - 0.08,
      decay: 0.08, type: 'spark',
      size: 1.1, color: k === 0 ? '#ffcc00' : '#ffffff',
    });
  }
}
