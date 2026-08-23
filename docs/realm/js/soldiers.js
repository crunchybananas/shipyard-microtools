// ════════════════════════════════════════════════════════════
// Soldiers — AI update for soldier units
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, rng, rngRange, TILE } from './state.js?realm=196';
import { stepEntityToward, nearestWalkableTile } from './pathfinding.js?realm=196';
import { spawnClashFX } from './fx.js?realm=196';
import { sfx as playSound } from './log.js?realm=196';
import { recordDeathMarker } from './death-markers.js?realm=196';
import { workersForBuilding } from './citizen-ownership.js?realm=196';
import {
  armyMayEngage,
  armyOrderAnchor,
  companyObjective,
  moveSoldierToTarget,
  refreshEscortTarget,
  resetCompanyCommandRuntime,
  updateCompanyMovement,
} from './army-orders.js?realm=196';
import { readinessMultipliers } from './company-supply.js?realm=196';

function companyMultipliers() {
  return readinessMultipliers(G.armySupply?.readiness);
}

function soldierDamage(s) {
  let damage = 5;
  for (const b of G.buildings) {
    if (b.type !== 'blacksmith' || workersForBuilding(b).length === 0) continue;
    const d = Math.sqrt((b.x - s.x) ** 2 + (b.y - s.y) ** 2);
    if (d < 8) { damage *= 1.5; break; }
  }
  return damage * companyMultipliers().damage;
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

    refreshEscortTarget(s);

    // Find the nearest enemy allowed by this order's leash. Guard, rally,
    // and escort companies protect their objective instead of chasing bait.
    let nearestEnemy = null, nearestDist = Infinity;
    for (const e of G.enemies) {
      const d = Math.sqrt((e.x-s.x)**2 + (e.y-s.y)**2);
      if (d < nearestDist && armyMayEngage(s, e)) { nearestEnemy = e; nearestDist = d; }
    }

    if (nearestEnemy) {
      // Archer AI — ranged unit stays at distance and fires arrows
      if (s.type === 'archer') {
        const idealRange = 5;
        if (nearestDist < idealRange - 1) {
          // Too close — back up (collision-checked, slides along buildings)
          stepEntityToward(s, s.x - (nearestEnemy.x - s.x), s.y - (nearestEnemy.y - s.y), 0.02 * Math.max(1, nearestDist) * companyMultipliers().movement);
        } else if (nearestDist < idealRange + 2) {
          // In range — fire arrow
          s.attackTimer = (s.attackTimer || 0) - 1;
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
          moveSoldierToTarget(s, nearestEnemy, G, 0.035 * companyMultipliers().movement);
        }
        continue; // skip default melee logic
      }

      // Melee soldier AI
      const dx = nearestEnemy.x - s.x, dy = nearestEnemy.y - s.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.5) {
        moveSoldierToTarget(s, nearestEnemy, G, 0.04 * companyMultipliers().movement);
      } else {
        // Attack cooldown
        s.attackTimer = (s.attackTimer || 0) - 1;
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
      continue;
    }

    // Company Command v1 owns movement while an Advance/Attack-move objective
    // is active. This route is A* planned and formation-slot specific; it must
    // consume the tick even when the unit has arrived so the legacy random
    // patrol fallback cannot pull the company away from its objective.
    if (companyObjective(G) && updateCompanyMovement(s, G, 0.035 * companyMultipliers().movement)) continue;

    // No enemy — patrol
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.1) {
      if (!stepEntityToward(s, s.tx, s.ty, 0.03 * companyMultipliers().movement)) {
        // Blocked — pick a fresh reachable patrol point instead of grinding
        const t = nearestWalkableTile(Math.round(s.x + rngRange(-4, 4)), Math.round(s.y + rngRange(-4, 4)), 4);
        if (t) { s.tx = t.x; s.ty = t.y; }
      }
    } else {
      s.stateTimer--;
      if (s.stateTimer <= 0) {
        s.stateTimer = 60 + Math.floor(rng() * 120);
        const anchor = armyOrderAnchor(s);
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
      recordDeathMarker({ x: s.x, y: s.y, name: s.name || 'Soldier', cause: 'battle' });
    }
  }
  if (G.soldiers.length === 0 && companyObjective(G)) {
    resetCompanyCommandRuntime(G, { clearObjective: true });
  }
}
