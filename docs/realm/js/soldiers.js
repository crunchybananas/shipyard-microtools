// ════════════════════════════════════════════════════════════
// Soldiers — AI update for soldier units
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, rng, rngRange } from './state.js';

function soldierDamage(s) {
  let damage = 5;
  for (const b of G.buildings) {
    if (b.type !== 'blacksmith' || !b.workers || b.workers.length === 0) continue;
    const d = Math.sqrt((b.x - s.x) ** 2 + (b.y - s.y) ** 2);
    if (d < 8) { damage *= 1.5; break; }
  }
  return damage;
}

export function updateSoldiers() {
  for (const s of G.soldiers) {
    // Find nearest enemy
    let nearestEnemy = null, nearestDist = Infinity;
    for (const e of G.enemies) {
      const d = Math.sqrt((e.x-s.x)**2 + (e.y-s.y)**2);
      if (d < nearestDist) { nearestEnemy = e; nearestDist = d; }
    }

    if (nearestEnemy && nearestDist < 12) {
      // Move toward enemy
      const dx = nearestEnemy.x - s.x, dy = nearestEnemy.y - s.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.5) {
        const spd = 0.04 * G.speed;
        s.x += (dx/d) * Math.min(spd, d);
        s.y += (dy/d) * Math.min(spd, d);
      } else {
        // Attack cooldown
        s.attackTimer = (s.attackTimer || 0) - G.speed;
        if (s.attackTimer <= 0) {
          s.attackTimer = 40;
          nearestEnemy.hp -= soldierDamage(s);
          // Slash particle
          G.particles.push({
            tx: nearestEnemy.x, ty: nearestEnemy.y, offsetY: -10,
            text: '⚔️', alpha: 1.2, vy: -0.2, decay: 0.04, type: 'text',
          });
        }
      }
      // If soldier takes damage back
      const enemyAttackTimer = (nearestEnemy.attackTimer = (nearestEnemy.attackTimer || 0) - G.speed);
      if (enemyAttackTimer <= 0 && d < 1.0) {
        nearestEnemy.attackTimer = 50;
        s.hp -= 3;
      }
      continue;
    }

    // No enemy — patrol
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.1) {
      const spd = 0.03 * G.speed;
      s.x += (dx/d) * Math.min(spd, d);
      s.y += (dy/d) * Math.min(spd, d);
    } else {
      s.stateTimer--;
      if (s.stateTimer <= 0) {
        s.stateTimer = 60 + Math.floor(rng() * 120);
        if (G.rallyPoint) {
          s.tx = G.rallyPoint.x + (Math.random()*4 - 2);
          s.ty = G.rallyPoint.y + (Math.random()*4 - 2);
        } else if (s.homeBuilding) {
          s.tx = s.homeBuilding.x + rngRange(-3, 3);
          s.ty = s.homeBuilding.y + rngRange(-3, 3);
        }
      }
    }
  }

  // Remove dead soldiers
  for (let i = G.soldiers.length - 1; i >= 0; i--) {
    if (G.soldiers[i].hp <= 0) {
      G.soldiers.splice(i, 1);
      G.stats.citizensDied = (G.stats.citizensDied || 0) + 1;
    }
  }
}
