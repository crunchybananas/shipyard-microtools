// ════════════════════════════════════════════════════════════
// Soldiers — AI update for soldier units
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, rng, rngRange, TILE } from './state.js?realm=115';
import { stepEntityToward, nearestWalkableTile } from './pathfinding.js?realm=115';
import { spawnClashFX } from './particles.js?realm=115';
import { playSound } from './audio.js?realm=115';

function soldierDamage(s) {
  let damage = 5;
  for (const b of G.buildings) {
    if (b.type !== 'blacksmith' || !b.workers || b.workers.length === 0) continue;
    const d = Math.sqrt((b.x - s.x) ** 2 + (b.y - s.y) ** 2);
    if (d < 8) { damage *= 1.5; break; }
  }
  return damage;
}

// Where does this soldier want to stand? The army stance is a posture:
// defend = spread around home barracks, rally = hold at the flag,
// patrol = walk the wall/tower line.
function armyAnchor(s) {
  if (G.armyStance === 'rally' && G.rallyPoint) {
    return { x: G.rallyPoint.x + (Math.random() * 4 - 2), y: G.rallyPoint.y + (Math.random() * 4 - 2) };
  }
  if (G.armyStance === 'patrol') {
    if (!G._patrolPosts || G._patrolPostsBuildingCount !== G.buildings.length) {
      G._patrolPosts = G.buildings.filter(b => b.type === 'wall' || b.type === 'tower');
      G._patrolPostsBuildingCount = G.buildings.length;
    }
    const posts = G._patrolPosts;
    if (posts.length) {
      s._postIdx = ((s._postIdx ?? (G.soldiers.indexOf(s) * 7)) + 1) % posts.length;
      const p = posts[s._postIdx];
      return { x: p.x + rngRange(-1, 1), y: p.y + rngRange(-1, 1) };
    }
    if (!G._patrolEmptyNotified) {
      G._patrolEmptyNotified = true;
      G.particles.push({ tx: s.x, ty: s.y, offsetY: -14, text: 'No walls to patrol', alpha: 1.3, vy: -0.12, decay: 0.014, type: 'speech' });
    }
  }
  if (s.homeBuilding) {
    return { x: s.homeBuilding.x + rngRange(-3, 3), y: s.homeBuilding.y + rngRange(-3, 3) };
  }
  return null;
}

export function updateSoldiers() {
  for (const s of G.soldiers) {
    // Garrisoned soldiers man their tower: pinned, protected, and counted
    // by updateTowers for range/fire-rate — no movement, no melee.
    if (s.garrison) {
      if (!G.buildings.includes(s.garrison)) { s.garrison = null; continue; }
      s.x = s.garrison.x; s.y = s.garrison.y;
      s.tx = s.garrison.x; s.ty = s.garrison.y;
      continue;
    }
    // Track tile wear — soldiers patrolling create dirt paths over time
    const _wx = Math.round(s.x), _wy = Math.round(s.y);
    if (_wx >= 0 && _wx < MAP_W && _wy >= 0 && _wy < MAP_H) {
      if (!G.tileWear) {
        G.tileWear = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
      }
      const tile = G.map[_wy]?.[_wx];
      if (tile !== undefined && tile !== TILE.WATER && tile !== TILE.MOUNTAIN) {
        const cur = G.tileWear[_wy][_wx];
        if (cur < 200 && G.gameTick % 30 === 0) {
          G.tileWear[_wy][_wx] = cur + 1;
        }
      }
    }

    // Find nearest enemy
    let nearestEnemy = null, nearestDist = Infinity;
    for (const e of G.enemies) {
      const d = Math.sqrt((e.x-s.x)**2 + (e.y-s.y)**2);
      if (d < nearestDist) { nearestEnemy = e; nearestDist = d; }
    }

    // Rally stance keeps soldiers on a tight leash: they hold the line at
    // the flag instead of chasing anything that moves across the map.
    const engageRadius = G.armyStance === 'rally' ? 8 : 12;
    if (nearestEnemy && nearestDist < engageRadius) {
      // Archer AI — ranged unit stays at distance and fires arrows
      if (s.type === 'archer') {
        const idealRange = 5;
        if (nearestDist < idealRange - 1) {
          // Too close — back up (collision-checked, slides along buildings)
          stepEntityToward(s, s.x - (nearestEnemy.x - s.x), s.y - (nearestEnemy.y - s.y), 0.02 * G.speed * Math.max(1, nearestDist));
        } else if (nearestDist < idealRange + 2) {
          // In range — fire arrow
          s.attackTimer = (s.attackTimer || 0) - G.speed;
          if (s.attackTimer <= 0) {
            s.attackTimer = 90;
            G.projectiles.push({
              x: s.x, y: s.y,
              tx: nearestEnemy.x, ty: nearestEnemy.y,
              target: nearestEnemy,
              damage: 8, life: 50,
              type: 'arrow',
            });
          }
        } else {
          // Close the gap
          stepEntityToward(s, nearestEnemy.x, nearestEnemy.y, 0.035 * G.speed);
        }
        continue; // skip default melee logic
      }

      // Melee soldier AI
      const dx = nearestEnemy.x - s.x, dy = nearestEnemy.y - s.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.5) {
        stepEntityToward(s, nearestEnemy.x, nearestEnemy.y, 0.04 * G.speed);
      } else {
        // Attack cooldown
        s.attackTimer = (s.attackTimer || 0) - G.speed;
        if (s.attackTimer <= 0) {
          s.attackTimer = 40;
          nearestEnemy.hp -= soldierDamage(s);
          if (G.gameTick % 20 === 0) playSound('click'); // avoid spam
          spawnClashFX(nearestEnemy.x, nearestEnemy.y);
        }
      }
      // Raider counter-attacks now live in combat.js updateEnemies (the
      // e.engaged block) so damage flows exactly once per cooldown in each
      // direction — this block previously double-drove nearestEnemy.attackTimer.
      if (s.attackTimer === 40) nearestEnemy.hurtTimer = 12;
      continue;
    }

    // No enemy — patrol
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.1) {
      if (!stepEntityToward(s, s.tx, s.ty, 0.03 * G.speed)) {
        // Blocked — pick a fresh reachable patrol point instead of grinding
        const t = nearestWalkableTile(Math.round(s.x + rngRange(-4, 4)), Math.round(s.y + rngRange(-4, 4)), 4);
        if (t) { s.tx = t.x; s.ty = t.y; }
      }
    } else {
      s.stateTimer--;
      if (s.stateTimer <= 0) {
        s.stateTimer = 60 + Math.floor(rng() * 120);
        const anchor = armyAnchor(s);
        if (anchor) { s.tx = anchor.x; s.ty = anchor.y; }
      }
    }
  }

  // Remove dead soldiers
  for (let i = G.soldiers.length - 1; i >= 0; i--) {
    if (G.soldiers[i].hp <= 0) {
      const s = G.soldiers[i];
      G.soldiers.splice(i, 1);
      G.stats.citizensDied = (G.stats.citizensDied || 0) + 1;
      G.lastDeathDay = G.day;  // Loop 242 (241 pessimist HIGH fix): soldier death is a death site too
      playSound('death');
      // Loop 77: gravestone marker at soldier's actual falling spot
      if (!G.deathMarkers) G.deathMarkers = [];
      G.deathMarkers.push({ x: s.x, y: s.y, name: s.name || 'Soldier', day: G.day, cause: 'battle' });
    }
  }
}
