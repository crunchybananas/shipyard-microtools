// ════════════════════════════════════════════════════════════
// Particles — floating resource numbers, smoke, sparkles
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

export function updateParticles() {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.offsetY += p.vy;
    p.alpha -= p.decay || 0.012;
    // Smoke drifts sideways
    if (p.type === 'smoke') {
      p.tx += (Math.sin(G.gameTick * 0.01 + p.tx) * 0.002);
      p.size = (p.size || 2) + 0.015;
    }
    if (p.alpha <= 0) G.particles.splice(i, 1);
  }
}

export function spawnParticle(tx, ty, text) {
  G.particles.push({ tx, ty, offsetY: 0, text, alpha: 1.5, vy: -0.4, type: 'text' });
}

export function spawnSmoke(tx, ty) {
  G.particles.push({
    tx: tx + (Math.random() - 0.5) * 0.1,
    ty: ty + (Math.random() - 0.5) * 0.1,
    offsetY: -30 - Math.random() * 5,
    text: null,
    alpha: 0.35 + Math.random() * 0.15,
    vy: -0.15 - Math.random() * 0.1,
    decay: 0.003 + Math.random() * 0.002,
    type: 'smoke',
    size: 1.5 + Math.random(),
  });
}

export function updateSmokeEmitters() {
  if (G.gameTick % 8 !== 0) return; // emit every 8 ticks
  for (const b of G.buildings) {
    if (b.type === 'house' || b.type === 'tavern' || b.type === 'lumber') {
      if (G.particles.length < 200) { // cap total particles
        spawnSmoke(b.x, b.y);
      }
    }
  }
}
