// ════════════════════════════════════════════════════════════
// Soldiers — AI update for soldier units
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, rng, rngRange } from './state.js';

export function updateSoldiers() {
  for (const s of G.soldiers) {
    // Move toward target
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.1) {
      const spd = 0.03 * G.speed;
      s.x += (dx/d) * Math.min(spd, d);
      s.y += (dy/d) * Math.min(spd, d);
    } else {
      // Arrived - pick new patrol target near barracks
      s.stateTimer--;
      if (s.stateTimer <= 0) {
        s.stateTimer = 60 + Math.floor(rng() * 120);
        if (s.homeBuilding) {
          s.tx = s.homeBuilding.x + rngRange(-3, 3);
          s.ty = s.homeBuilding.y + rngRange(-3, 3);
        }
      }
    }
  }
}
