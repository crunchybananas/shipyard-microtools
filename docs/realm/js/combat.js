// ════════════════════════════════════════════════════════════
// Combat — enemy AI, tower firing, projectile movement
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, rng } from './state.js?realm=188';

// Raiders torch what they sack: a small per-hit arson chance on wooden
// stock, throttled to ONE blaze per raid-day — drama, not annihilation.
// Wells still auto-douse (economy.updateFires), so placement matters.
const RAID_FLAMMABLE = new Set(['house', 'tavern', 'bakery', 'lumber', 'windmill', 'farm', 'granary', 'storehouse']);

// Shared sack logic: every building strike pockets stores (gold first,
// then food, then wood) and counts toward the raider's plunder goal, so
// a warband stalled at the walls still fills its bags and LEAVES instead
// of besieging forever. Slain raiders drop their bags (see death block).
function stealFrom(e, dmg) {
  e.plundered = (e.plundered || 0) + dmg;
  let stole = 0;
  for (const k of ['gold', 'food', 'wood']) {
    if (stole >= 2) break;
    const take = Math.min(2 - stole, Math.floor(G.resources[k] || 0));
    if (take > 0) {
      G.resources[k] -= take;
      stole += take;
      e.loot = e.loot || {};
      e.loot[k] = (e.loot[k] || 0) + take;
      G._raidStolen = G._raidStolen || {};
      G._raidStolen[k] = (G._raidStolen[k] || 0) + take;
    }
  }
  if (stole > 0 && visualJitter(e.x, e.y, 301) < 0.35) {
    G.particles.push({ tx: e.x, ty: e.y, offsetY: -18, text: '💰', alpha: 1.1, vy: -0.14, decay: 0.02, type: 'text' });
  }
}
function maybeIgnite(b, notifyFn) {
  if (b.onFire || !RAID_FLAMMABLE.has(b.type)) return;
  if (G._lastRaidFireDay === G.day) return;
  if (rng() < 0.02) {
    b.onFire = true;
    b._fireTimer = 0;
    G._lastRaidFireDay = G.day;
    notifyFn(`🔥 Raiders set the ${BUILDINGS[b.type]?.name || b.type} ablaze!`, 'danger');
  }
}
import { stepEntityToward } from './pathfinding.js?realm=188';
import { spawnClashFX, visualJitter } from './fx.js?realm=188';

// Melee tuning in one place: engage range, disengage range, raider damage,
// raider attack cooldown (soldier-side numbers live in soldiers.js).
const MILCFG = { engage: 2.0, disengage: 2.5, raiderDmg: 4, raiderCooldown: 55 };
import { sfx as playSound } from './log.js?realm=188';
import { removeBuilding } from './building-lifecycle.js?realm=188';
import { announce as notify } from './log.js?realm=188';
import { chronicle } from './log.js?realm=188';
import { recordDeathMarker } from './death-markers.js?realm=188';
import {
  removeCitizenFromWorld,
  transitionCitizenActivity,
} from './citizen-ownership.js?realm=188';

function detachProjectileTargets(enemy) {
  let snapshot = null;
  for (const projectile of G.projectiles) {
    if (projectile.target !== enemy) continue;
    snapshot ||= { x: enemy.x, y: enemy.y, hp: enemy.hp };
    projectile.target = snapshot;
  }
}

export function updateEnemies() {
  // Morale break: when a raid has lost more than 60% of its fighters, the
  // survivors break and flee — raids resolve with drama instead of a grind.
  if (G._raidSpawnCount && G.gameTick % 60 === 0) {
    const fighting = G.enemies.filter(e => !e.retreating).length;
    if (fighting > 0 && fighting <= Math.ceil(G._raidSpawnCount * 0.4)) {
      for (const e of G.enemies) {
        if (e.retreating) continue;
        e.retreating = true;
        const dxEdge = Math.min(e.x, MAP_W - 1 - e.x) <= Math.min(e.y, MAP_H - 1 - e.y);
        e.tx = dxEdge ? (e.x < MAP_W / 2 ? 0 : MAP_W - 1) : e.x;
        e.ty = dxEdge ? e.y : (e.y < MAP_H / 2 ? 0 : MAP_H - 1);
      }
      G._raidSpawnCount = 0;
      notify('The raiders break and flee!', 'success');
    }
    if (fighting === 0) G._raidSpawnCount = 0;
  }
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    // Raiders fight back: engage the nearest soldier in reach instead of
    // walking through the battle line. Never overwrites e.tx/ty — the raid
    // target survives the skirmish.
    if (!e.retreating) {
      if (e.engaged && (e.engaged.hp <= 0 || !G.soldiers.includes(e.engaged) ||
          Math.hypot(e.engaged.x - e.x, e.engaged.y - e.y) > MILCFG.disengage)) {
        e.engaged = null;
      }
      if (!e.engaged) {
        let ns = null, nd = Infinity;
        for (const s of G.soldiers) {
          if (s.garrison) continue;
          const d2 = Math.hypot(s.x - e.x, s.y - e.y);
          if (d2 < nd) { nd = d2; ns = s; }
        }
        if (ns && nd <= MILCFG.engage) e.engaged = ns;
      }
      if (e.engaged) {
        e.attackTimer = (e.attackTimer || 0) - 1;
        if (e.attackTimer <= 0) {
          e.attackTimer = MILCFG.raiderCooldown;
          e.engaged.hp -= MILCFG.raiderDmg;
          e.attackCue = 12;
          spawnClashFX(e.engaged.x, e.engaged.y);
        }
        continue; // locked in melee — no movement this tick
      }
    }
    // Check if there's a wall in path — enemies must go around walls
    const nx = Math.round(e.x), ny = Math.round(e.y);
    const wall = G.buildingGrid[ny]?.[nx];
    if (wall && wall.type === 'wall' && wall.hp > 0) {
      // Attack wall instead of passing through
      wall.hp -= 0.35;
      maybeIgnite(wall, notify);
      if (G.gameTick % 40 === 0) stealFrom(e, 2); // breaching counts toward the goal
      if (G.gameTick % 30 === 0) {
        G.particles.push({ tx: wall.x, ty: wall.y, offsetY: -6, text: null, alpha: 0.9, vx: (visualJitter(wall.x, wall.y, 302)-0.5)*0.3, vy: -0.18, decay: 0.06, type: 'spark', size: 1.2, color: '#b9b9b9' });
      }
      if (wall.hp <= 0) {
        removeBuilding(wall, { cause: 'raid' });
      }
      continue; // don't move this tick
    }

    // Move toward target — collision-checked; raiders batter what blocks them
    const dx = e.tx - e.x, dy = e.ty - e.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.3) {
      // Retreating raiders leave the map unobstructed (edge tiles can be
      // water); advancing raiders respect footprints and siege blockers.
      const raiderOpen = e.retreating
        ? () => true
        : (x, y) => { const bb = G.buildingGrid[y]?.[x]; return !bb || bb.type === 'road'; };
      // Forced march far from town, combat pace once close; looted
      // raiders sprint for the edge. Kills the 30-45s dead air between
      // the horn and the fight without changing the battle itself.
      const distC = Math.abs(e.x - MAP_W / 2) + Math.abs(e.y - MAP_H / 2);
      const marchSpd = e.retreating ? 0.045 : (distC > 22 ? 0.05 : 0.02);
      if (e.retreating && (e.plundered || 0) > 0 && G.gameTick % 90 === 0) {
        G.particles.push({ tx: e.x, ty: e.y, offsetY: -16, text: '💰', alpha: 1.0, vy: -0.1, decay: 0.02, type: 'text' });
      }
      const moved = stepEntityToward(e, e.tx, e.ty, marchSpd, raiderOpen);
      if (!moved && !e.retreating) {
        // Blocked by a building — attack it (walls and everything else),
        // so sieges resolve instead of raiders milling at the perimeter.
        const bx = Math.round(e.x) + Math.sign(Math.round(e.tx) - Math.round(e.x));
        const by = Math.round(e.y) + Math.sign(Math.round(e.ty) - Math.round(e.y));
        const blocker = G.buildingGrid[by]?.[bx] || G.buildingGrid[Math.round(e.y)]?.[bx] || G.buildingGrid[by]?.[Math.round(e.x)];
        if (blocker && blocker.hp > 0) {
          blocker.hp -= 0.35;
          maybeIgnite(blocker, notify);
          if (G.gameTick % 40 === 0) stealFrom(e, 2);
          if (G.gameTick % 30 === 0) {
            G.particles.push({ tx: blocker.x, ty: blocker.y, offsetY: -6, text: null, alpha: 0.9, vx: (visualJitter(blocker.x, blocker.y, 303)-0.5)*0.3, vy: -0.18, decay: 0.06, type: 'spark', size: 1.2, color: '#b9b9b9' });
          }
          if (blocker.hp <= 0) removeBuilding(blocker, { cause: 'raid' });
        } else {
          // Boxed in with nothing to hit — skirt sideways
          e.tx += (rng() - 0.5) * 5;
          e.ty += (rng() - 0.5) * 5;
        }
      }
    } else if (e.retreating) {
      // Reached the retreat edge — gone, with whatever they carried.
      detachProjectileTargets(e);
      G.enemies.splice(i, 1);
      if (G.enemies.length === 0 && G._raidStolen && Object.values(G._raidStolen).some(v => v > 0)) {
        const parts = Object.entries(G._raidStolen).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
        notify(`💰 The raiders escaped with ${parts}.`, 'danger');
        G._raidStolen = null;
      }
      continue;
    } else {
      // Arrived at town center — attack nearest building
      const target = G.buildings.reduce((best, b) => {
        if (!b.hp || b.hp <= 0) return best;
        const bd = Math.abs(b.x - e.x) + Math.abs(b.y - e.y);
        return !best || bd < best.d ? { b, d: bd } : best;
      }, null);
      if (target) {
        e.attackTimer = (e.attackTimer || 0) - 1;
        if (e.attackTimer > 0) continue;
        e.attackTimer = 55;
        const dmg = e.damage || 7;
        target.b.hp -= dmg;
        maybeIgnite(target.b, notify);
        stealFrom(e, dmg);
        if (target.b.hp <= 0) {
          removeBuilding(target.b, { cause: 'raid' });
          e.plundered = e.plunderGoal || e.plundered;
        }
        if ((e.plundered || 0) >= (e.plunderGoal || 35)) {
          e.retreating = true;
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
      // Raiders should scare citizens into fleeing, not erase the town
      // population before the player can react.
      c.hp = (c.hp !== undefined ? c.hp : 100) - 0.08;
      // Loop 71 (render S4): set a hurt timer so the renderer can flash the
      // citizen red briefly. Refresh on each damage tick so continuous harm
      // reads as a sustained flash rather than stuttering.
      c.hurtTimer = 12;
      // Flee behavior: set target away from enemy toward map center
      if (!c._fleeing) {
        G.particles.push({ tx: c.x, ty: c.y, offsetY: -26, text: '😱', alpha: 1.3, vy: -0.15, decay: 0.02, type: 'text' });
      }
      if (!c._fleeing || G.gameTick % 20 === 0) {
        c._fleeing = true;
        // Shelter instinct: run for the nearest house; open flight only
        // when no roof is close enough.
        let shelter = null, sd = Infinity;
        for (const hb of G.buildings) {
          if (hb.type !== 'house') continue;
          const hd = Math.abs(hb.x - c.x) + Math.abs(hb.y - c.y);
          if (hd < sd) { sd = hd; shelter = hb; }
        }
        if (shelter && sd < 14) {
          c.tx = Math.max(1, Math.min(MAP_W - 2, shelter.x + (dx / (d || 1))));
          c.ty = Math.max(1, Math.min(MAP_H - 2, shelter.y + (dy / (d || 1))));
        } else {
          c.tx = Math.max(1, Math.min(MAP_W - 2, c.x + (dx / (d || 1)) * 5));
          c.ty = Math.max(1, Math.min(MAP_H - 2, c.y + (dy / (d || 1)) * 5));
        }
        transitionCitizenActivity(c, 'idle', 'combat-recovery');
        c.activityTimer = 0;
        c.path = null;
        c.pathIdx = 0;
      }
    }

    // Die if hp drops to 0
    if (e.hp <= 0) {
      detachProjectileTargets(e);
      G.enemies.splice(i, 1);
      if (G.stats) G.stats.enemiesKilled++;
      // Loop 209 (the-fixer, 206 filed): rival's symmetric +reward arm.
      // 206 shipped the difficulty bump (rivalMult ×1.10 raider count);
      // 209 ships the cooperative-arm pair: +5 gold per raider slain
      // when rival is named. Per 105 filing's "might include +reward
      // for successful defense" clause. Adversarial-AND-rewarding shape:
      // the rival sends more raiders AND each one is worth more when
      // killed. Net balance: realm faces ~+10% raider count for ~+50
      // gold per typical late-game raid (10 raiders × 5 gold). Silent
      // — no toast/chronicle (matches 034 named-character invariant
      // + 206 silent-mechanic discipline). 6 named-cast mechanics now
      // shipped fully; only mayor structural-unlock remains.
      if (G.namedCharacters?.rival) {
        G.resources.gold += 5;
      }
      // Slain raiders drop their loot bag where they fall.
      if (e.loot) {
        let dropped = 0;
        for (const [k, v] of Object.entries(e.loot)) {
          G.resources[k] = (G.resources[k] || 0) + v;
          if (G._raidStolen?.[k]) G._raidStolen[k] = Math.max(0, G._raidStolen[k] - v);
          dropped += v;
        }
        if (dropped > 0) {
          G.particles.push({ tx: e.x, ty: e.y, offsetY: -14, text: `+${dropped} recovered`, alpha: 1.3, vy: -0.15, decay: 0.014, type: 'text' });
        }
      }
      playSound('demolish');
      // Death particles — dramatic blood splat effect
      for (let p = 0; p < 8; p++) {
        const unit = channel => visualJitter(e.x, e.y, 400 + p * 5 + channel);
        G.particles.push({
          tx: e.x + (unit(1)-0.5)*0.3, ty: e.y + (unit(2)-0.5)*0.3,
          offsetY: -5 - unit(3)*10,
          text: p < 2 ? '💀' : '•',
          alpha: 1.5, vy: -0.15 - unit(4)*0.15, decay: 0.03,
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
    if (c.carrying && c.carryAmount > 0) G.resources[c.carrying] = (G.resources[c.carrying] || 0) + c.carryAmount;
    removeCitizenFromWorld(c);
    if (G.stats) G.stats.citizensDied = (G.stats.citizensDied || 0) + 1;
    G.lastDeathDay = G.day;  // Loop 228 (sustained-state #2 infrastructure)
    playSound('death');
    G.particles.push({
      tx: c.x, ty: c.y, offsetY: -20,
      text: `💀 ${c.identity.name}`,
      alpha: 2.0, vy: -0.25, decay: 0.012, type: 'text',
      color: '#8a1a1a',
    });
    // Loop 77 (render S4): persistent gravestone at actual death tile
    // (replaces earlier random-house spawn). Name + day recorded so
    // hovering a grave can eventually surface who fell where.
    recordDeathMarker({ x: c.x, y: c.y, name: c.identity.name, cause: 'raid' });
    // Loop 077 (the-fixer, 076 HIGH): {chronicle:false} on the
    // notify so the direct chronicle('death') below is the sole
    // chronicle row for a raider-kill. 076 audit caught this
    // duplicate (notify→tag:raid + direct→tag:death).
    try { notify(`${c.identity.name} was slain by raiders!`, 'danger', { chronicle: false }); } catch(_e){}
    try { chronicle(`${c.identity.name} fell to raiders. Their name joins the stone.`, 'death'); } catch(_e){}
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
        if (G.gameTick % 10 === 0) playSound('combat');
        // Loop 67 (render S4): dedicated impact burst on projectile hit.
        // 5 small white sparks radiating from the impact point, fade fast.
        const hx = p.target.x, hy = p.target.y;
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 + visualJitter(hx, hy, 500 + k) * 0.4;
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
      const spd = 0.3;
      p.x += (dx/d) * spd;
      p.y += (dy/d) * spd;
    }
  }
}

export function updateTowers() {
  // Towers fire at nearby enemies
  for (const b of G.buildings) {
    if (b.type !== 'tower' && b.type !== 'barracks') continue;
    // A scaffold doesn't shoot: no fire until construction completes.
    if (b.buildProgress < 1) continue;
    b.fireTimer = (b.fireTimer || 0) - 1;
    if (b.fireTimer > 0) continue;
    // Find nearest enemy
    // Garrisoned towers see further and reload faster; archer occupants
    // sharpen every arrow. Player sentence: "a manned tower shoots roughly
    // twice as fast and a third further."
    const occupants = b.type === 'tower' ? G.soldiers.filter(s => s.garrison === b) : [];
    const range = b.type === 'tower' ? (occupants.length ? 13 : 10) : 6;
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
      b.fireTimer = Math.max(25, 60 - 20 * occupants.length) / smithBonus;
      const archerBonus = occupants.filter(s => s.type === 'archer').length * 2;
      G.projectiles.push({
        x: b.x, y: b.y, tx: target.x, ty: target.y,
        target, damage: 10 + archerBonus, life: 40,
        type: 'arrow',
      });
    }
  }
}
