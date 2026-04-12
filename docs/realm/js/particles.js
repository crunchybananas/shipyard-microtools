// ════════════════════════════════════════════════════════════
// Particles — floating resource numbers, smoke, sparkles
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

export function updateParticles() {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.offsetY += p.vy;
    p.alpha -= 0.012;
    if (p.alpha <= 0) G.particles.splice(i, 1);
  }
}

export function spawnParticle(tx, ty, text) {
  G.particles.push({ tx, ty, offsetY: 0, text, alpha: 1.5, vy: -0.4 });
}
