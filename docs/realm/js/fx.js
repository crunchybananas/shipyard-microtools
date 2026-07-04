// ════════════════════════════════════════════════════════════
// FX spawns callable from CORE files (ENGINE.md rule 4): plain-data
// pushes to G.particles — headless-safe, excluded from the determinism
// hash, seeded rng() for jitter so the stream stays reproducible.
// Particle UPDATE/decay lives shell-side (particles.js).
// ════════════════════════════════════════════════════════════

import { G, rng } from './state.js?realm=132';

export function spawnDust(tx, ty) {
  for (let i = 0; i < 8; i++) {
    G.particles.push({
      tx: tx + (rng() - 0.5) * 0.6,
      ty: ty + (rng() - 0.5) * 0.6,
      offsetY: -5 - rng() * 10,
      text: null,
      alpha: 0.5 + rng() * 0.3,
      vy: -0.2 - rng() * 0.15,
      decay: 0.008 + rng() * 0.005,
      type: 'dust',
      size: 1.5 + rng() * 2,
      vx: (rng() - 0.5) * 0.3,
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
    const ang = (k / 4) * Math.PI * 2 + rng() * 0.5;
    G.particles.push({
      tx, ty, offsetY: -8,
      text: null, alpha: 1.0,
      vx: Math.cos(ang) * 0.22, vy: Math.sin(ang) * 0.22 - 0.08,
      decay: 0.08, type: 'spark',
      size: 1.1, color: k === 0 ? '#ffcc00' : '#ffffff',
    });
  }
}
