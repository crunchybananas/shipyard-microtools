// ════════════════════════════════════════════════════════════
// Combat — enemy AI, tower firing, projectile movement
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H } from './state.js';

export function updateEnemies() {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    // Check if there's a wall in path — enemies must go around walls
    const nx = Math.round(e.x), ny = Math.round(e.y);
    const wall = G.buildingGrid[ny]?.[nx];
    if (wall && wall.type === 'wall' && wall.hp > 0) {
      // Attack wall instead of passing through
      wall.hp -= 0.5 * G.speed;
      if (wall.hp <= 0) {
        G.buildings = G.buildings.filter(x => x !== wall);
        G.buildingGrid[wall.y][wall.x] = null;
        G.stats.buildingsLost = (G.stats.buildingsLost || 0) + 1;
      }
      continue; // don't move this tick
    }

    // Move toward target
    const dx = e.tx - e.x, dy = e.ty - e.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.3) {
      const spd = 0.02 * G.speed;
      e.x += (dx/d) * Math.min(spd, d);
      e.y += (dy/d) * Math.min(spd, d);
    } else {
      // Arrived at town center — attack nearest building
      const target = G.buildings.reduce((best, b) => {
        if (!b.hp || b.hp <= 0) return best;
        const bd = Math.abs(b.x - e.x) + Math.abs(b.y - e.y);
        return !best || bd < best.d ? { b, d: bd } : best;
      }, null);
      if (target) {
        target.b.hp -= 1;
        if (target.b.hp <= 0) {
          G.buildings = G.buildings.filter(x => x !== target.b);
          G.buildingGrid[target.b.y][target.b.x] = null;
        }
      }
    }
    // Die if hp drops to 0
    if (e.hp <= 0) {
      G.enemies.splice(i, 1);
      if (G.stats) G.stats.enemiesKilled++;
      // Death particles
      for (let p = 0; p < 3; p++) {
        G.particles.push({
          tx: e.x, ty: e.y, offsetY: 0,
          text: '💀', alpha: 1, vy: -0.2, decay: 0.02, type: 'text',
        });
      }
    }
  }
}

export function updateProjectiles() {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < 0.3 || p.life-- <= 0) {
      // Hit target
      if (p.target && p.target.hp !== undefined) {
        p.target.hp -= p.damage;
      }
      G.projectiles.splice(i, 1);
    } else {
      const spd = 0.3 * G.speed;
      p.x += (dx/d) * spd;
      p.y += (dy/d) * spd;
    }
  }
}

export function updateTowers() {
  // Towers fire at nearby enemies
  for (const b of G.buildings) {
    if (b.type !== 'tower' && b.type !== 'barracks') continue;
    b.fireTimer = (b.fireTimer || 0) - G.speed;
    if (b.fireTimer > 0) continue;
    // Find nearest enemy
    const range = b.type === 'tower' ? 8 : 5;
    let target = null, bestD = Infinity;
    for (const e of G.enemies) {
      const d = Math.sqrt((e.x-b.x)**2 + (e.y-b.y)**2);
      if (d < range && d < bestD) { target = e; bestD = d; }
    }
    if (target) {
      b.fireTimer = 60; // 1 sec cooldown
      G.projectiles.push({
        x: b.x, y: b.y, tx: target.x, ty: target.y,
        target, damage: 10, life: 40,
        type: 'arrow',
      });
    }
  }
}
