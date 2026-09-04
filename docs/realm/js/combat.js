// ════════════════════════════════════════════════════════════
// Combat — enemy AI, tower firing, projectile movement
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TILE, rng } from './state.js?realm=198';
import {
  PHYSICAL_RESOURCE_KEYS,
  depositResourceAcrossStores,
  withdrawFood,
  withdrawResource,
} from './building-inventory.js?realm=198';

// Raiders torch what they sack: a small per-hit arson chance on wooden
// stock, throttled to ONE blaze per raid-day — drama, not annihilation.
// Wells still auto-douse (economy.updateFires), so placement matters.
const RAID_FLAMMABLE = new Set(['house', 'tavern', 'bakery', 'lumber', 'windmill', 'farm', 'granary', 'storehouse']);

const RAID_SUPPLY_PLUNDER_ORDER = Object.freeze(['food', 'flour', 'wheat']);

function assertPlunderRequest(e, requested) {
  if (!e || !Number.isSafeInteger(requested) || requested < 0) {
    throw new TypeError('Raider plunder requires an enemy and a non-negative safe integer amount.');
  }
}

function recordPlunder(e, resource, stole) {
  if (stole > 0) {
    e.plundered = (e.plundered || 0) + stole;
    e.loot = e.loot || {};
    e.loot[resource] = (e.loot[resource] || 0) + stole;
    G._raidStolen = G._raidStolen || {};
    G._raidStolen[resource] = (G._raidStolen[resource] || 0) + stole;
  }
}

function showPlunderCue(e, stole) {
  if (stole > 0 && visualJitter(e.x, e.y, 301) < 0.35) {
    G.particles.push({ tx: e.x, ty: e.y, offsetY: -18, text: '💰', alpha: 1.1, vy: -0.14, decay: 0.02, type: 'text' });
  }
}

// Compatibility entrypoint for food-specific sinks and focused tests.
export function plunderBuildingFood(e, building, requested = 2) {
  assertPlunderRequest(e, requested);
  const stole = withdrawFood(building, requested, G).taken;
  recordPlunder(e, 'food', stole);
  showPlunderCue(e, stole);
  return stole;
}

// A raid hit sacks only goods physically present in the struck structure.
// Finished rations go first, then flour and wheat. Empty walls and workshops
// can never conjure loot from the realm-wide compatibility mirrors.
export function plunderBuildingSupplies(e, building, requested = 2) {
  assertPlunderRequest(e, requested);
  let remainder = requested;
  let total = 0;
  for (const resource of RAID_SUPPLY_PLUNDER_ORDER) {
    if (remainder <= 0) break;
    const stole = withdrawResource(building, resource, remainder, G).taken;
    if (stole <= 0) continue;
    recordPlunder(e, resource, stole);
    total += stole;
    remainder -= stole;
  }
  showPlunderCue(e, total);
  return total;
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

function closeRaidStolenLedger(outcome) {
  if (G.enemies.length > 0 || !G._raidStolen) {
    if (G.enemies.length === 0) G._raidSide = null;
    return false;
  }
  const parts = Object.entries(G._raidStolen)
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(', ');
  if (parts) {
    const message = outcome === 'escape'
      ? `💰 The raiders escaped with ${parts}.`
      : `💰 The raid cost the realm ${parts}; it was carried off or could not all be stored.`;
    notify(message, 'danger');
  }
  G._raidStolen = null;
  G._raidSide = null;
  return true;
}

function clearRaidApproachWhenEmpty() {
  if (G.enemies.length === 0) G._raidSide = null;
}
import { stepEntityToward } from './pathfinding.js?realm=198';
import { spawnClashFX, visualJitter } from './fx.js?realm=198';
import { raidTargetForIndex } from './raid-targeting.js?realm=198';
import {
  RAID_BREACH_DAMAGE_PER_TICK,
  clearRaidRoute,
  raidIntentBreach,
  raidIntentTarget,
  raidRouteNeedsReplan,
  replanRaidRoute,
  routeRaidBandToNearestEdge,
  routeRaiderToNearestEdge,
} from './raid-intelligence.js?realm=198';

// Melee tuning in one place: engage range, disengage range, raider damage,
// raider attack cooldown (soldier-side numbers live in soldiers.js).
const MILCFG = { engage: 2.0, disengage: 2.5, raiderDmg: 4, raiderCooldown: 55 };
const PHYSICAL_RESOURCE_KEY_SET = new Set(PHYSICAL_RESOURCE_KEYS);

function assignedRaidTarget(enemy) {
  const x = Math.round(enemy.tx), y = Math.round(enemy.ty);
  const building = G.buildingGrid[y]?.[x] || null;
  return building
    && G.buildings.includes(building)
    && building.active === true
    && building.buildProgress >= 1
    && building.hp > 0
    && building.type !== 'road'
    ? building
    : null;
}

function ensureRaidTarget(enemy) {
  const current = assignedRaidTarget(enemy);
  if (current) return current;
  const index = Math.max(0, G.enemies.indexOf(enemy));
  const target = raidTargetForIndex(index, G, G._raidSide, MAP_W, MAP_H);
  if (!target) return null;
  enemy.tx = target.x;
  enemy.ty = target.y;
  return target;
}
import { sfx as playSound } from './log.js?realm=198';
import { removeBuilding } from './building-lifecycle.js?realm=198';
import { announce as notify } from './log.js?realm=198';
import { chronicle } from './log.js?realm=198';
import { recordDeathMarker } from './death-markers.js?realm=198';
import {
  removeCitizenFromWorld,
  transitionCitizenActivity,
} from './citizen-ownership.js?realm=198';
import {
  citizenHasValidResidence,
  citizenIsIndoors,
} from './residences.js?realm=198';
import { clearCitizenRouteState } from './citizen-route-state.js?realm=198';

function plannedRaidCellOpen(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  const terrain = G.map?.[y]?.[x];
  if (terrain === TILE.WATER || terrain === TILE.MOUNTAIN || terrain === undefined) return false;
  const building = G.buildingGrid?.[y]?.[x];
  return !building || building.type === 'road';
}

function strikeRaidBlocker(enemy, building, jitterChannel) {
  building.hp -= RAID_BREACH_DAMAGE_PER_TICK;
  maybeIgnite(building, notify);
  if (G.gameTick % 40 === 0) {
    plunderBuildingSupplies(enemy, building, 2);
    if (raidBandHasItsLoot()) withdrawRaidBand('loot');
  }
  if (G.gameTick % 30 === 0) {
    G.particles.push({
      tx: building.x,
      ty: building.y,
      offsetY: -6,
      text: null,
      alpha: 0.9,
      vx: (visualJitter(building.x, building.y, jitterChannel) - 0.5) * 0.3,
      vy: -0.18,
      decay: 0.06,
      type: 'spark',
      size: 1.2,
      color: '#b9b9b9',
    });
  }
  if (building.hp <= 0) removeBuilding(building, { cause: 'raid' });
}

function raidBandLootTotal() {
  return Object.values(G._raidStolen || {}).reduce((sum, amount) => (
    sum + (Number.isFinite(amount) && amount > 0 ? amount : 0)
  ), 0);
}

function raidBandHasItsLoot() {
  const goals = G.enemies
    .filter(enemy => !enemy.retreating && Number.isFinite(enemy.plunderGoal) && enemy.plunderGoal > 0)
    .map(enemy => enemy.plunderGoal);
  return goals.length > 0 && raidBandLootTotal() >= Math.min(...goals);
}

function withdrawRaidBand(reason) {
  const withdrew = routeRaidBandToNearestEdge(G);
  if (withdrew === 0) return false;
  G._raidSpawnCount = 0;
  const message = reason === 'morale'
    ? 'The raiders break and flee!'
    : reason === 'loot'
      ? 'The warband fills its carts and withdraws!'
      : reason === 'blocked'
        ? 'The warband finds no viable assault and withdraws.'
        : 'The warband completes its objective and withdraws!';
  notify(message, reason === 'morale' || reason === 'blocked' ? 'success' : 'event');
  return true;
}

function refreshPlannedRaidTarget(enemy) {
  if (!Array.isArray(enemy.raidPath) || !enemy.raidIntent) return null;
  if (raidRouteNeedsReplan(enemy, G)) {
    const plan = replanRaidRoute(enemy, G);
    if (!plan) {
      withdrawRaidBand('blocked');
      return null;
    }
  }
  return raidIntentTarget(enemy, G);
}

function advancePlannedRaidRoute(enemy, target, speed) {
  const path = enemy.raidPath;
  if (!Array.isArray(path) || path.length === 0 || !Number.isSafeInteger(enemy.raidPathIdx)) {
    enemy.raidPlanEpoch = -1;
    return 'invalid';
  }
  while (enemy.raidPathIdx < path.length) {
    const point = path[enemy.raidPathIdx];
    if (!point || !Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
      enemy.raidPlanEpoch = -1;
      return 'invalid';
    }
    if (Math.hypot(point.x - enemy.x, point.y - enemy.y) > 0.2) break;
    enemy.x = point.x;
    enemy.y = point.y;
    enemy.raidPathIdx++;
  }
  if (enemy.raidPathIdx >= path.length) {
    if (Math.hypot(target.x - enemy.x, target.y - enemy.y) <= 1.6) return 'arrived';
    enemy.raidPlanEpoch = -1;
    return 'invalid';
  }

  const waypoint = path[enemy.raidPathIdx];
  const blocker = G.buildingGrid?.[waypoint.y]?.[waypoint.x] || null;
  if (blocker && blocker.type !== 'road' && blocker.hp > 0) {
    const plannedBreach = raidIntentBreach(enemy, G, waypoint.x, waypoint.y);
    if (plannedBreach !== blocker) {
      // Topology changed without a matching epoch, or the route surface was
      // corrupted. Never opportunistically hit an unplanned structure.
      enemy.raidPlanEpoch = -1;
      return 'invalid';
    }
    const tileX = Math.round(enemy.x);
    const tileY = Math.round(enemy.y);
    if (Math.max(Math.abs(waypoint.x - tileX), Math.abs(waypoint.y - tileY)) <= 1) {
      strikeRaidBlocker(enemy, blocker, 302);
      return 'breaching';
    }
  }

  const currentX = Math.round(enemy.x);
  const currentY = Math.round(enemy.y);
  const currentTerrain = G.map?.[currentY]?.[currentX];
  const waypointTerrain = G.map?.[waypoint.y]?.[waypoint.x];
  const approachingLandfall = currentTerrain === TILE.WATER || waypointTerrain === TILE.WATER;
  const approachCellOpen = (x, y) => {
    const terrain = G.map?.[y]?.[x];
    if (terrain === TILE.WATER) return !G.buildingGrid?.[y]?.[x];
    return plannedRaidCellOpen(x, y);
  };
  const moved = stepEntityToward(
    enemy,
    waypoint.x,
    waypoint.y,
    speed,
    approachingLandfall ? approachCellOpen : plannedRaidCellOpen,
  );
  if (!moved) {
    enemy.raidPlanEpoch = -1;
    return 'invalid';
  }
  return 'moving';
}

function attackRaidTarget(enemy, target) {
  enemy.attackTimer = (enemy.attackTimer || 0) - 1;
  if (enemy.attackTimer > 0) return false;
  enemy.attackTimer = 55;
  target.hp -= enemy.damage || 7;
  maybeIgnite(target, notify);
  plunderBuildingSupplies(enemy, target, 2);
  if (target.hp <= 0) {
    removeBuilding(target, { cause: 'raid' });
    // One strategic sack satisfies the whole band's bounded ambition. Named
    // route breaches remain non-terminal in strikeRaidBlocker().
    withdrawRaidBand('objective');
  } else if (raidBandHasItsLoot()) {
    withdrawRaidBand('loot');
  }
  return true;
}

function detachProjectileTargets(enemy) {
  let snapshot = null;
  for (const projectile of G.projectiles) {
    if (projectile.target !== enemy) continue;
    snapshot ||= { x: enemy.x, y: enemy.y, hp: enemy.hp };
    projectile.target = snapshot;
  }
}

function resolveEnemyDeathAt(index) {
  const e = G.enemies[index];
  if (!e || e.hp > 0) return false;
  detachProjectileTargets(e);
  G.enemies.splice(index, 1);
  clearRaidApproachWhenEmpty();
  if (G.stats) G.stats.enemiesKilled++;
  // Loop 209 (the-fixer, 206 filed): rival's symmetric +reward arm.
  // A named rival makes raids larger and every slain raider worth 5 gold.
  if (G.namedCharacters?.rival) {
    G.resources.gold += 5;
  }
  // Slain raiders recover physical supplies only into compatible live stores.
  // Overflow remains lost; it never reappears in a compatibility mirror.
  if (e.loot) {
    let dropped = 0;
    for (const [k, v] of Object.entries(e.loot)) {
      const recovered = PHYSICAL_RESOURCE_KEY_SET.has(k)
        ? depositResourceAcrossStores(k, v, { origin: e, state: G }).accepted
        : v;
      if (!PHYSICAL_RESOURCE_KEY_SET.has(k)) G.resources[k] = (G.resources[k] || 0) + recovered;
      if (G._raidStolen?.[k]) G._raidStolen[k] = Math.max(0, G._raidStolen[k] - recovered);
      dropped += recovered;
    }
    if (dropped > 0) {
      G.particles.push({ tx: e.x, ty: e.y, offsetY: -14, text: `+${dropped} recovered`, alpha: 1.3, vy: -0.15, decay: 0.014, type: 'text' });
    }
  }
  closeRaidStolenLedger('death');
  playSound('demolish');
  // Death particles — dramatic blood splat effect.
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
  return true;
}

export function updateEnemies() {
  // Soldiers act before enemies in the core contract. Resolve their lethal
  // blows before morale, engagement, movement, or civilian harm so a dead
  // raider can neither take a turn nor remain in the fighting count.
  for (let i = G.enemies.length - 1; i >= 0; i--) resolveEnemyDeathAt(i);

  // Morale counts actual deaths, never comrades already withdrawing with
  // loot. Exactly 60% holds; only losses beyond that line break survivors.
  if (G._raidSpawnCount && G.gameTick % 60 === 0) {
    const killsStart = G.storyState?.raid?.killsStart;
    const casualties = Number.isSafeInteger(killsStart)
      ? Math.max(0, (G.stats?.enemiesKilled || 0) - killsStart)
      : 0;
    if (casualties * 5 > G._raidSpawnCount * 3) withdrawRaidBand('morale');
    if (G.enemies.length === 0) G._raidSpawnCount = 0;
  }
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.retreating && (e.raidPath || e.raidIntent)) clearRaidRoute(e);
    // Raiders fight back: engage the nearest soldier in reach instead of
    // walking through the battle line. Never overwrites e.tx/ty — the raid
    // target survives the skirmish.
    let plannedTarget = null;
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
      plannedTarget = refreshPlannedRaidTarget(e);
      // Legacy/save fallback: enemies without the new bounded route surface
      // retain the established static target and local movement contract.
      if (!plannedTarget) ensureRaidTarget(e);
    }

    // Forced march far from town, combat pace once close; looted raiders
    // retain their established retreat speed and unobstructed edge exit.
    const distC = Math.abs(e.x - MAP_W / 2) + Math.abs(e.y - MAP_H / 2);
    const marchSpd = e.retreating ? 0.045 : (distC > 22 ? 0.05 : 0.02);

    if (!e.retreating && plannedTarget && Array.isArray(e.raidPath)) {
      const routeAction = advancePlannedRaidRoute(e, plannedTarget, marchSpd);
      if (routeAction === 'breaching') continue;
      if (routeAction === 'arrived' && !attackRaidTarget(e, plannedTarget)) continue;
      if (e.retreating) continue;
      // `moving` and a one-tick invalidation both fall through to nearby
      // citizen pressure. An invalid route replans exactly once next tick.
    } else {
      // Legacy movement remains the safe fallback for old saves and for the
      // rare explicit snapshot that yields no route.
      const nx = Math.round(e.x), ny = Math.round(e.y);
      const wall = G.buildingGrid[ny]?.[nx];
      if (wall && wall.type === 'wall' && wall.hp > 0) {
        strikeRaidBlocker(e, wall, 302);
        continue;
      }

      const dx = e.tx - e.x, dy = e.ty - e.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.3) {
        const raiderOpen = e.retreating
          ? () => true
          : (x, y) => {
              const terrain = G.map?.[y]?.[x];
              if (terrain === TILE.WATER) return !G.buildingGrid?.[y]?.[x];
              return plannedRaidCellOpen(x, y);
            };
        if (e.retreating && (e.plundered || 0) > 0 && G.gameTick % 90 === 0) {
          G.particles.push({ tx: e.x, ty: e.y, offsetY: -16, text: '💰', alpha: 1.0, vy: -0.1, decay: 0.02, type: 'text' });
        }
        const moved = stepEntityToward(e, e.tx, e.ty, marchSpd, raiderOpen);
        if (!moved && !e.retreating) {
          const bx = Math.round(e.x) + Math.sign(Math.round(e.tx) - Math.round(e.x));
          const by = Math.round(e.y) + Math.sign(Math.round(e.ty) - Math.round(e.y));
          const blocker = G.buildingGrid[by]?.[bx] || G.buildingGrid[Math.round(e.y)]?.[bx] || G.buildingGrid[by]?.[Math.round(e.x)];
          if (blocker && blocker.hp > 0) {
            strikeRaidBlocker(e, blocker, 303);
          } else {
            const side = ((G.gameTick + Math.max(0, G.enemies.indexOf(e))) & 1) ? 1 : -1;
            stepEntityToward(e, e.x + side * 2, e.y, marchSpd, raiderOpen);
          }
        }
      } else if (e.retreating) {
        // Reached the retreat edge — gone, with whatever they carried.
        detachProjectileTargets(e);
        G.enemies.splice(i, 1);
        clearRaidApproachWhenEmpty();
        closeRaidStolenLedger('escape');
        continue;
      } else {
        const targetBuilding = ensureRaidTarget(e);
        if (targetBuilding) {
          if (!attackRaidTarget(e, targetBuilding)) continue;
          if (e.retreating) continue;
        } else {
          // No buildings left to attack — retain the established nearest-edge
          // retreat instead of leaving a permanent stack at town center.
          routeRaiderToNearestEdge(e);
        }
      }
    }
    // Enemies harm nearby citizens — citizens flee and can die if caught
    for (const c of G.citizens) {
      // A resident becomes untargetable only after the citizen state machine
      // has physically delivered them to their own valid House portal.
      if (citizenIsIndoors(c)) continue;
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
        const blockedCargo = c.activity.kind === 'needs_delivery'
          && !c._deliveryTarget && !G.buildings.includes(c.assignment?.building);
        const deliveryObligation = !blockedCargo && (
          !!(c.carrying && c.carryAmount > 0)
          || ['needs_delivery', 'walk_to_deliver', 'deliver'].includes(c.activity.kind)
        );
        if (deliveryObligation || c.activity.kind === 'seek_shelter') {
          // Cargo routes and an established own-home shelter route survive a
          // hit. The panic sprint flag makes both obligations urgent without
          // silently deleting goods or redirecting residents to another roof.
          continue;
        }
        if (c.activity.kind !== 'flee' && citizenHasValidResidence(c)) {
          transitionCitizenActivity(c, 'seek_shelter', 'raid-shelter');
          c.activityTimer = 0;
          clearCitizenRouteState(c);
          continue;
        }

        // Homeless citizens and residents whose portal route failed remain
        // exterior actors. They run away from the nearest threat and can
        // still be caught; no House proximity grants immunity.
        c.tx = Math.max(1, Math.min(MAP_W - 2, c.x + (dx / (d || 1)) * 5));
        c.ty = Math.max(1, Math.min(MAP_H - 2, c.y + (dy / (d || 1)) * 5));
        transitionCitizenActivity(c, 'flee', 'shelter-unreachable');
        c.activityTimer = 30;
        clearCitizenRouteState(c);
      }
    }

  }

  // Remove citizens that were killed by enemies (hp <= 0 from combat damage)
  // Without this, citizens take damage forever and never actually die.
  for (let i = G.citizens.length - 1; i >= 0; i--) {
    const c = G.citizens[i];
    if (c.hp === undefined || c.hp > 0) continue;
    if (c.carrying && !PHYSICAL_RESOURCE_KEY_SET.has(c.carrying) && c.carryAmount > 0) {
      G.resources[c.carrying] = (G.resources[c.carrying] || 0) + c.carryAmount;
    }
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
