// ════════════════════════════════════════════════════════════
// Combat — enemy AI, tower firing, projectile movement
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H } from './state.js';
import { playSound } from './audio.js';
import { demolishBuilding } from './economy.js';
import { notify } from './notifications.js';
import { chronicle } from './story.js';

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
        // Use demolishBuilding so defense/maxPop/workers are all cleaned up properly
        demolishBuilding(wall, true);
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
    } else if (e.retreating) {
      // Reached the retreat edge — leave the map regardless of buildings
      G.enemies.splice(i, 1);
      continue;
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
          // Proper cleanup: frees workers, decrements maxPop/defense, refunds partial resources
          demolishBuilding(target.b, true);
        }
      } else {
        // No buildings left to attack — retreat toward the nearest map edge
        // and despawn on arrival. Without this, raids that wipe the settlement
        // leave every surviving enemy spinning on the town-center tile forever;
        // later raid days pile more enemies on top (observed in deep-play:
        // 108-159 raiders stacked on tile (40,40) by Year 3 after pop hit 0,
        // HUD skull counter climbing unbounded while the map sat frozen).
        e.retreating = true;
        // Pick whichever axis (x or y) is closer to its nearer edge
        const distX = Math.min(e.x, MAP_W - 1 - e.x);
        const distY = Math.min(e.y, MAP_H - 1 - e.y);
        if (distX < distY) {
          e.tx = e.x < MAP_W / 2 ? 0 : MAP_W - 1;
          e.ty = e.y;
        } else {
          e.tx = e.x;
          e.ty = e.y < MAP_H / 2 ? 0 : MAP_H - 1;
        }
      }
    }
    // Enemies harm nearby citizens — citizens flee and can die if caught
    for (const c of G.citizens) {
      const dx = c.x - e.x, dy = c.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 2.5) continue;
      // Citizen takes 0.3 dmg/frame when within 2.5 tiles of an enemy
      c.hp = (c.hp !== undefined ? c.hp : 100) - 0.3 * G.speed;
      // Loop 71 (render S4): set a hurt timer so the renderer can flash the
      // citizen red briefly. Refresh on each damage tick so continuous harm
      // reads as a sustained flash rather than stuttering.
      c.hurtTimer = 12;
      // Flee behavior: set target away from enemy toward map center
      if (!c._fleeing || G.gameTick % 20 === 0) {
        c._fleeing = true;
        const flx = Math.max(1, Math.min(MAP_W-2, c.x + (dx / (d||1)) * 5));
        const fly = Math.max(1, Math.min(MAP_H-2, c.y + (dy / (d||1)) * 5));
        c.tx = flx; c.ty = fly;
        c.state = 'idle';
        c.path = null;
      }
    }

    // Die if hp drops to 0
    if (e.hp <= 0) {
      G.enemies.splice(i, 1);
      if (G.stats) G.stats.enemiesKilled++;
      playSound('demolish');
      // Death particles — dramatic blood splat effect
      for (let p = 0; p < 8; p++) {
        G.particles.push({
          tx: e.x + (Math.random()-0.5)*0.3, ty: e.y + (Math.random()-0.5)*0.3,
          offsetY: -5 - Math.random()*10,
          text: p < 2 ? '💀' : '•',
          alpha: 1.5, vy: -0.15 - Math.random()*0.15, decay: 0.03,
          type: 'text',
          color: '#8a1a1a',
        });
      }
    }
  }

  // Remove citizens that were killed by enemies (hp <= 0 from combat damage)
  // Without this, citizens take damage forever and never actually die.
  for (let i = G.citizens.length - 1; i >= 0; i--) {
    const c = G.citizens[i];
    if (c.hp === undefined || c.hp > 0) continue;
    G.citizens.splice(i, 1);
    if (c.jobBuilding) c.jobBuilding.workers = (c.jobBuilding.workers || []).filter(w => w !== c);
    G.population = Math.max(0, G.population - 1);
    if (G.stats) G.stats.citizensDied = (G.stats.citizensDied || 0) + 1;
    playSound('death');
    G.particles.push({
      tx: c.x, ty: c.y, offsetY: -20,
      text: `💀 ${c.name || 'Settler'}`,
      alpha: 2.0, vy: -0.25, decay: 0.012, type: 'text',
      color: '#8a1a1a',
    });
    // Loop 77 (render S4): persistent gravestone at actual death tile
    // (replaces earlier random-house spawn). Name + day recorded so
    // hovering a grave can eventually surface who fell where.
    if (!G.deathMarkers) G.deathMarkers = [];
    G.deathMarkers.push({ x: c.x, y: c.y, name: c.name || 'Settler', day: G.day, cause: 'raid' });
    // Loop 077 (the-fixer, 076 HIGH): {chronicle:false} on the
    // notify so the direct chronicle('death') below is the sole
    // chronicle row for a raider-kill. 076 audit caught this
    // duplicate (notify→tag:raid + direct→tag:death).
    try { notify(`${c.name || 'A settler'} was slain by raiders!`, 'danger', { chronicle: false }); } catch(_e){}
    try { chronicle(`${c.name || 'A settler'} fell to raiders. Their name joins the stone.`, 'death'); } catch(_e){}
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
        p.target.hurtTimer = 12;
        if (G.gameTick % 10 === 0) playSound('combat');
        // Loop 67 (render S4): dedicated impact burst on projectile hit.
        // 5 small white sparks radiating from the impact point, fade fast.
        const hx = p.target.x, hy = p.target.y;
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 + Math.random() * 0.4;
          G.particles.push({
            tx: hx, ty: hy, offsetY: -8,
            text: null, alpha: 1.0,
            vx: Math.cos(ang) * 0.25, vy: Math.sin(ang) * 0.25 - 0.1,
            decay: 0.06, type: 'spark',
            size: 1.2, color: '#ffffff',
          });
        }
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
    const range = b.type === 'tower' ? 10 : 6;
    let target = null, bestD = Infinity;
    for (const e of G.enemies) {
      const d = Math.sqrt((e.x-b.x)**2 + (e.y-b.y)**2);
      if (d < range && d < bestD) { target = e; bestD = d; }
    }
    if (target) {
      // Loop 105 (the-fixer, 101/102 sibling): named smith adds +5%
      // projectile damage. Same pattern as teacher (101 research) and
      // merchant (102 trade). Third named-character → mechanic
      // graduation. Silent effect — no UI, no chronicle beat.
      //
      // Loop 153 (the-fixer, closes 120 MEDIUM): swapped from +5%
      // damage to +5% fire-rate. 120's balance audit found the damage
      // axis ran into integer HP-rounding at common raider HPs
      // (10→10.5 damage rarely changed kill counts). Fire-rate is
      // continuous — affects every shot at every HP. Same ~5% DPS
      // magnitude but now perceivable in every engagement.
      const smithBonus = G.namedCharacters?.smith ? 1.05 : 1;
      b.fireTimer = 60 / smithBonus; // 60 ticks base; ~57.1 with smith
      G.projectiles.push({
        x: b.x, y: b.y, tx: target.x, ty: target.y,
        target, damage: 10, life: 40,
        type: 'arrow',
      });
    }
  }
}
