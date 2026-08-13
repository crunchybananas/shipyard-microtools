// ══════════���══════════════════��══════════════════════════════
// Citizen AI — state machine with A* pathfinding
// ══════════════���═══════════════════════════���═════════════════

import { G, BUILDINGS, MAP_W, MAP_H, rng, rngInt, getDayPeriod, TILE } from './state.js?realm=193';
import { isWalkable } from './pathfinding.js?realm=193';
import { getCitizenSpeedMult } from './events.js?realm=193';
import { revealAround } from './world.js?realm=193';
import { visualJitter } from './fx.js?realm=193';
import {
  assignmentDutyForBuilding,
  assignmentPurposeForCitizen,
  citizenStaffingCapacity,
  claimCitizenAssignment,
  releaseCitizenAssignment,
  staffingCount,
} from './citizen-ownership.js?realm=193';
import {
  citizenHasValidResidence,
  citizenIsIndoors,
  residencePortalForCitizen,
  residentsForHouse,
} from './residences.js?realm=193';
import { isBuildingOperational } from './building-operation.js?realm=193';
import {
  canDepositFood,
  depositFood,
  findReachableFoodStore,
  withdrawFood,
} from './building-inventory.js?realm=193';
import {
  AUTO_REVIEW_INTERVAL_TICKS,
  buildingAcceptsAutomaticWorkers,
  isFoodWorkplace,
  isWorkforceConstructionSite,
  reviewAutomaticAssignment,
  scoreCitizenJob,
  workforceFoodDaysLeft,
} from './workforce-policy.js?realm=193';
import {
  assignedCitizenBuilding as assignedBuilding,
  citizenStableHash as citizenHash,
  setCitizenActivity as setActivity,
} from './citizen-activity.js?realm=193';
import {
  advanceCitizenPathRequest,
  blacklistCitizenTarget as blacklistTarget,
  citizenManhattanDistance as dist2,
  citizenTargetIsBlacklisted as isBlacklisted,
  clearCitizenPath as clearPath,
  pathCitizenTo as pathTo,
  pruneCitizenNoGo as pruneExpiredNoGo,
  remainingCitizenRouteIsWalkable as remainingCitizenRouteWalkable,
  replanCitizenToRequestedTarget as replanToRequestedTarget,
} from './citizen-navigation.js?realm=193';
import {
  applyCitizenSeparation,
  canCitizenStep as canStepCitizen,
  captureCitizenTrafficProgress,
  citizenIsActivelyMoving as isActivelyMoving,
  citizenStandsOnBlockedTile as standingOnBlockedTile,
  citizenTileIsWalkable as tileWalkable,
  citizenTravelSpeed,
  finishCitizenTrafficProgress,
  noteCitizenTrafficWait,
  resolveCitizenStep,
} from './citizen-traffic.js?realm=193';
import {
  citizenIdleLoiterTarget as idleLoiterTarget,
  citizenWorkTargetForBuilding as workTargetForBuilding,
  pathCitizenToWork as pathToWork,
  startCitizenWorking as startWorking,
} from './citizen-work.js?realm=193';
import {
  CITIZEN_NIGHT_EXEMPT_ACTIVITIES as NIGHT_EXEMPT,
  beginCitizenOpenRaidFlight as beginOpenRaidFlight,
  citizenEnemyNear as enemyNear,
  enterCitizenRaidShelter as enterRaidShelter,
  leaveCitizenRaidShelter as leaveRaidShelter,
  seekCitizenRaidShelter as seekRaidShelter,
  sendCitizenHome as goHome,
} from './citizen-shelter.js?realm=193';
import {
  CITIZEN_MEAL_INTERRUPTIBLE_ACTIVITIES as MEAL_INTERRUPTIBLE_ACTIVITIES,
  beginCitizenFoodRoute as beginFoodRoute,
  citizenAtFoodTarget,
  citizenFoodTargetStillValid as foodTargetStillValid,
  reachableCitizenFoodRoute as reachableFoodRoute,
  resumeCitizenAfterMeal as resumeAfterMeal,
} from './citizen-food.js?realm=193';
import {
  CITIZEN_MEAL_HUNGER_THRESHOLD,
  drainCitizenHeartbeatNeeds,
  feedCitizenMeal,
  restCitizenWhileSheltered,
  restoreCitizenSleepRest,
  satisfyCitizenLeisureNeed,
  settleCitizenWakeRest,
} from './citizen-needs.js?realm=193';

// Chain targets win only within reach: a windmill across the island must
// not beat the granary next door (AI-audit deferred fix). The carrier
// takes the chain target when it is close (<=18 Manhattan tiles — dist2
// above is Manhattan, not squared), or when it is no worse than twice as
// far as the best generic store.
function preferChainTarget(c, primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  const dp = dist2(c.x, c.y, primary.x, primary.y);
  if (dp <= 18) return primary;
  return dp <= dist2(c.x, c.y, fallback.x, fallback.y) * 2 ? primary : fallback;
}

function buildingsByType(c, types) {
  const results = [];
  const seen = new Set();
  for (const type of types) {
    const matches = G.buildings
      .filter(b => b.type === type && !seen.has(b))
      .sort((a, b) => dist2(c.x, c.y, a.x, a.y) - dist2(c.x, c.y, b.x, b.y));
    for (const building of matches) {
      seen.add(building);
      results.push(building);
    }
  }
  return results;
}

// A carrier needs an ordered *set* of destinations, not only the nearest one.
// Islands and newly placed buildings can make the visually closest store
// unreachable; trying the next real building prevents an endless repath loop.
function deliveryTargets(c, resKey) {
  let primaryType = null;
  let storageTypes;
  if (resKey === 'wheat') { primaryType = 'windmill'; storageTypes = ['granary', 'storehouse', 'house']; }
  else if (resKey === 'flour') { primaryType = 'bakery'; storageTypes = ['granary', 'storehouse', 'house']; }
  else if (resKey === 'gold') { primaryType = 'market'; storageTypes = ['storehouse', 'house']; }
  else storageTypes = ['storehouse', 'granary', 'house'];

  const storage = buildingsByType(c, storageTypes);
  if (!primaryType) return storage;
  const primary = buildingsByType(c, [primaryType]);
  const preferred = preferChainTarget(c, primary[0], storage[0]);
  // Keep the intended production chain when it is sensible, but make all
  // nearby stores viable fallbacks before asking a worker to cross the island.
  return preferred === primary[0]
    ? [...primary, ...storage]
    : [...storage, ...primary];
}

function requestDeliveryStorage(c) {
  setActivity(c, 'needs_delivery', { timer: 90 + rngInt(0, 60) });
  clearPath(c);
  c._deliveryTarget = null;
  const now = G.gameTick || 0;
  if (!c._needsDeliveryNoticeAt || now - c._needsDeliveryNoticeAt > 180) {
    c._needsDeliveryNoticeAt = now;
    G.particles.push({
      tx: c.x, ty: c.y, offsetY: -28,
      text: 'Need storage',
      alpha: 1.25, vy: -0.12, decay: 0.018, type: 'speech',
    });
  }
}

function releaseJob(c, { unreachable = false } = {}) {
  const job = assignedBuilding(c);
  if (unreachable) {
    if (job) blacklistTarget(c, job.x, job.y);
    if (c.workTarget) blacklistTarget(c, c.workTarget.x, c.workTarget.y);
  }
  releaseCitizenAssignment(c, unreachable ? 'path-unreachable' : 'assignment-invalid');
  c.workTarget = null;
}

function watchProgress(c) {
  const goalActive = (c.path && c.pathIdx < c.path.length) ||
    c.activity.kind === 'walk_to_work' || c.activity.kind === 'walk_to_deliver' ||
    c.activity.kind === 'walk_to_eat' ||
    c.activity.kind === 'needs_delivery' || c.activity.kind === 'foraging' ||
    c.activity.kind === 'seek_shelter';
  if (!goalActive) { c._wdBest = null; c._wdTicks = 0; return; }
  const gx = c._requestedTx ?? c.tx ?? c.x;
  const gy = c._requestedTy ?? c.ty ?? c.y;
  const d = Math.hypot(gx - c.x, gy - c.y);
  // A live body queue is not failed topology. Direct intents can be visibly
  // cancelled by the post-move hard-floor correction even when the per-actor
  // movement branch accepted them; keep the target and let right-of-way age
  // resolve while another active actor remains in the local traffic cell.
  const queuedByCitizen = G.citizens.some(other => (
    other !== c
    && !citizenIsIndoors(other)
    && isActivelyMoving(other)
    && Math.hypot(c.x - other.x, c.y - other.y) < 1.05
  ));
  if (queuedByCitizen) {
    c._wdBest = d;
    c._wdTicks = 0;
    return;
  }
  if (c._wdBest == null || d < c._wdBest - 0.2) { c._wdBest = d; c._wdTicks = 0; return; }
  c._wdTicks = (c._wdTicks || 0) + 1;
  if (c._wdTicks > 120) {
    blacklistTarget(c, gx, gy);
    if (c.activity.kind === 'seek_shelter') {
      clearPath(c);
      beginOpenRaidFlight(c, 'shelter-unreachable');
      c._wdBest = null;
      c._wdTicks = 0;
      return;
    }
    if (c.activity.kind === 'walk_to_eat') {
      if (c._foodTarget) blacklistTarget(c, c._foodTarget.x, c._foodTarget.y);
      c._foodTarget = null;
      clearPath(c);
      beginFoodRoute(c, 'food-source-empty');
      c._wdBest = null;
      c._wdTicks = 0;
      return;
    }
    if (assignedBuilding(c) && c.activity.kind === 'walk_to_work') {
      releaseJob(c, { unreachable: true });
      G.particles.push({ tx: c.x, ty: c.y, offsetY: -26, text: "Can't reach it!", alpha: 1.25, vy: -0.12, decay: 0.016, type: 'speech' });
    }
    clearPath(c);
    setActivity(c, 'idle', { reason: 'path-unreachable', timer: 20 + rngInt(0, 15) });
    c._wdBest = null;
    c._wdTicks = 0;
    // carrying is kept — the find_job/heartbeat guards route it to delivery
  }
}

function routeDelivery(c, resKey) {
  if (resKey === 'food') {
    const routes = new Map();
    const dropoff = findReachableFoodStore(c, {
      mode: 'deposit',
      isReachable: building => {
        // Do not strand public rations in a private pantry with nobody home to
        // consume them. Occupied Houses remain valid provisioning targets.
        if (
          building.type === 'house'
          && !residentsForHouse(building).some(resident => citizenHasValidResidence(resident))
        ) return false;
        const route = reachableFoodRoute(c, building);
        if (route) routes.set(building, route);
        return !!route;
      },
    });
    if (!dropoff) {
      c._deliveryTarget = null;
      return false;
    }
    const route = routes.get(dropoff);
    if (route && pathTo(c, route.approach.x, route.approach.y, { exact: true })) {
      c._deliveryTarget = dropoff;
      return true;
    }
    blacklistTarget(c, dropoff.x, dropoff.y);
    return routeDelivery(c, resKey);
  }
  for (const dropoff of deliveryTargets(c, resKey)) {
    if (isBlacklisted(c, dropoff.x, dropoff.y)) continue;
    if (pathTo(c, dropoff.x, dropoff.y)) {
      c._deliveryTarget = dropoff;
      return true;
    }
    // Do not keep assigning an islanded store on the next heartbeat. The
    // short target blacklist expires after the map or settlement can change.
    blacklistTarget(c, dropoff.x, dropoff.y);
  }
  c._deliveryTarget = null;
  return false;
}

function deliveryTargetStillValid(c) {
  return !!c._deliveryTarget
    && G.buildings.includes(c._deliveryTarget)
    && (c.carrying !== 'food' || canDepositFood(c._deliveryTarget, 1));
}

function evacuateBlockedCitizen(c) {
  if (!standingOnBlockedTile(c)) { c._evacTarget = null; return false; }
  const mx = Math.round(c.x), my = Math.round(c.y);
  // K-candidate escape with per-citizen rotation: if the current exit stays
  // corner-blocked for ~90 ticks, try the next ring tile instead of
  // deterministically retrying the same one forever. The original errand
  // (_requestedTx/Ty) is never touched — an escaped carrier resumes its
  // delivery instead of dumping cargo at the evacuation spot.
  c._evacTicks = (c._evacTicks || 0) + 1;
  let target = c._evacTarget;
  if (!target || !tileWalkable(target.x, target.y) || c._evacTicks > 90) {
    const candidates = [];
    for (let r = 1; r <= 4 && candidates.length < 8; r++) {
      for (let yy = my - r; yy <= my + r; yy++) {
        for (let xx = mx - r; xx <= mx + r; xx++) {
          if (Math.abs(xx - mx) !== r && Math.abs(yy - my) !== r) continue;
          if (tileWalkable(xx, yy)) candidates.push({ x: xx, y: yy });
        }
      }
    }
    if (!candidates.length) return true; // fully entombed — wait for a demolish
    c._evacRot = ((c._evacRot || 0) + 1) % candidates.length;
    target = candidates[c._evacRot];
    c._evacTarget = target;
    c._evacTicks = 0;
  }

  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.001) {
    // ~2x walk speed: urgent but no longer a 10x teleport-skate
    const step = Math.min(0.06, d);
    const nx = c.x + (dx / d) * step;
    const ny = c.y + (dy / d) * step;
    // Evacuation goes through the same step gate as every other mover, so
    // escaping one footprint can never tunnel through a neighbouring one.
    if (canStepCitizen(c, nx, ny)) {
      c.x = nx;
      c.y = ny;
      c._movedAt = G.gameTick;
    }
    c.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
    c.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
  }

  if (!standingOnBlockedTile(c)) {
    c._evacTarget = null;
    c._evacTicks = 0;
    clearPath(c);
    // Resume the interrupted errand rather than standing dazed
    if (c._requestedTx !== undefined && (c.activity.kind === 'walk_to_deliver' || c.activity.kind === 'walk_to_work' || c.activity.kind === 'needs_delivery')) {
      replanToRequestedTarget(c);
    }
  }
  return true;
}

export function updateCitizens() {
  // Keep wait age tied to net route progress after the shared separation
  // pass. Measuring only the actor's private movement branch made an orbiting
  // crowd look productive even when separation returned everyone to the same
  // place, so right of way never accumulated where it was actually needed.
  const trafficProgressStart = captureCitizenTrafficProgress();
  for (const c of G.citizens) {
    pruneExpiredNoGo(c);
    if (advanceCitizenPathRequest(c) === 'pending') continue;
    const raidActive = G.enemies.length > 0;
    if (c.activity.kind === 'sheltered') {
      if (raidActive && citizenIsIndoors(c)) {
        c._fleeing = false;
        restCitizenWhileSheltered(c);
        continue;
      }
      if (raidActive) beginOpenRaidFlight(c, 'shelter-unreachable');
      else leaveRaidShelter(c);
    } else if (!raidActive && (c.activity.kind === 'flee' || c.activity.kind === 'seek_shelter')) {
      leaveRaidShelter(c);
    }

    // ── Decision heartbeat (AI audit): obligations preempt from ANY state
    // on a short cadence — the brain no longer waits for the body to stop.
    if ((G.gameTick + (c._hb ?? (c._hb = citizenHash(c) % 12))) % 12 === 0) {
      if (raidActive && seekRaidShelter(c)) continue;
      // Hunger interrupts only safe exterior work. Cargo, sleep, and danger
      // keep priority; Crown and AI assignments remain owned while the body
      // walks to a physical pantry.
      if (
        c.hunger > CITIZEN_MEAL_HUNGER_THRESHOLD
        && !(c.carrying && c.carryAmount > 0)
        && MEAL_INTERRUPTIBLE_ACTIVITIES.has(c.activity.kind)
      ) {
        beginFoodRoute(c);
        continue;
      }
      // Idle carriers deliver immediately instead of waiting out the timer.
      if (c.activity.kind === 'idle' && c.carrying && c.carryAmount > 0) {
        setActivity(c, 'needs_delivery', { reason: 'cargo-ready' });
        clearPath(c);
      }
      // Self-heal any over-long idle (flee aftermath left stale 260-tick timers).
      if (c.activity.kind === 'idle' && c.activityTimer > 140) c.activityTimer = 60;

      // ── Schedule (Phase 3a) ──────────────────────────────────────
      const period = getDayPeriod();
      const threatened = G.enemies.length > 0 && enemyNear(c, 6);
      // Flee flag clears once the danger passes (it used to stick forever
      // — set in combat.js, never reset). While fleeing, citizens sprint.
      if (c._fleeing && !threatened) c._fleeing = false;
      if (period === 'night' && !NIGHT_EXEMPT.has(c.activity.kind) && !threatened && !(c.carrying && c.carryAmount > 0)) {
        goHome(c);
      } else if (c.activity.kind === 'sleep' && (period !== 'night' || threatened)) {
        // Dawn: wake with a stagger so the morning rush reads as a town
        // waking up, not a synchronized swarm. Danger wakes sleepers
        // immediately — the combat flee response takes them from there.
        setActivity(c, threatened ? 'idle' : 'find_job', {
          reason: threatened ? 'threat-response' : 'wake-day',
          timer: threatened ? 0 : rngInt(0, 40),
        });
        clearPath(c);
        settleCitizenWakeRest(c);
        if (threatened) {
          G.particles.push({ tx: c.x, ty: c.y, offsetY: -24, text: '❗', alpha: 1.3, vy: -0.12, decay: 0.02, type: 'speech' });
        }
      } else if (c.activity.kind === 'go_home' && threatened) {
        // Abort the walk home if raiders cut the path — flee instead.
        setActivity(c, 'idle', { reason: 'threat-response' });
        clearPath(c);
      }
      // Rest and social needs drain on this heartbeat. Their deterministic
      // arithmetic lives in citizen-needs; scheduling remains here.
      drainCitizenHeartbeatNeeds(c);

      // Food crisis (Phase 3c): when the larder runs under two days,
      // non-food workers start downing tools — into an open food job if
      // one exists, otherwise into foraging (find_job's shortage branch
      // sends the unemployed after berries/game). Either way the colony
      // visibly reallocates labor under pressure and recovers its old
      // jobs once the granary refills.
      // Automatic workers periodically reconsider materially better jobs.
      // Assignment age supplies the cooldown, while Crown orders and need/
      // danger activities remain outside this policy-owned decision.
      if ((G.gameTick + citizenHash(c)) % AUTO_REVIEW_INTERVAL_TICKS === 0) {
        reviewAutomaticAssignment(c, {
          isBlocked: building => isBlacklisted(c, building.x, building.y),
        });
      }

      const currentAssignment = assignedBuilding(c);
      if (workforceFoodDaysLeft() < 2
          && currentAssignment && !isFoodWorkplace(currentAssignment)
          // A direct work order is player strategy, not another suggestion for
          // the utility scorer to silently undo. Ordered citizens still eat,
          // sleep, deliver cargo, flee danger, and recover from unreachable
          // routes; only automatic labor is eligible for crisis reallocation.
          && c.assignment.reason !== 'player-command'
          && (c.activity.kind === 'working' || c.activity.kind === 'walk_to_work')
          && rng() < 0.04) {
        releaseCitizenAssignment(c, 'food-crisis');
        c.workTarget = null;
        setActivity(c, 'find_job', { reason: 'food-crisis' });
        clearPath(c);
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -26,
          text: 'To the fields!', alpha: 1.2, vy: -0.12, decay: 0.016, type: 'speech',
        });
      }

      // Dusk leisure: unoccupied citizens with a low need seek the venue
      // that satisfies it — the town square fills in the evening. One
      // trip per day; night sends everyone home from the tavern.
      if (period === 'dusk' && !threatened && c._leisureDay !== G.day
          && ['idle', 'find_job', 'working', 'walk_to_work'].includes(c.activity.kind)
          && !['tavern', 'church'].includes(currentAssignment?.type)
          && !(c.carrying && c.carryAmount > 0)) {
        const wantJoy = c.needs.joy < 45;
        const wantFaith = c.needs.faith < 45;
        if (wantJoy || wantFaith) {
          const kind = (wantJoy && (!wantFaith || c.needs.joy <= c.needs.faith)) ? 'tavern' : 'church';
          const venues = buildingsByType(c, [kind, kind === 'tavern' ? 'church' : 'tavern'])
            .filter(isBuildingOperational);
          const venue = venues[0] || null;
          if (venue && dist2(c.x, c.y, venue.x, venue.y) <= 25) {
            c._leisureDay = G.day;
            c._leisureTarget = { x: venue.x, y: venue.y, kind: venue.type };
            setActivity(c, 'leisure');
            clearPath(c);
            pathTo(c, venue.x, venue.y);
          }
        }
      }
    }

    // ── Universal progress watchdog: no measurable progress toward the
    // active goal for ~120 ticks -> give up cleanly instead of orbiting.
    // A service approach is an arrival area, not an exact standing pixel.
    // Personal-space correction may keep a citizen a few hundredths from the
    // authored tile; accept the real adjacent arrival before the generic
    // watchdog can reinterpret that occupied slot as an empty pantry.
    if (
      c.activity.kind === 'walk_to_eat'
      && foodTargetStillValid(c)
      && citizenAtFoodTarget(c)
    ) clearPath(c);
    watchProgress(c);
    if (c.activity.kind === 'walk_to_eat' && !foodTargetStillValid(c)) {
      c._foodTarget = null;
      clearPath(c);
      beginFoodRoute(c, 'food-source-empty');
      continue;
    }

    if (evacuateBlockedCitizen(c)) continue;

    // Track tile wear — citizens walking over tiles gradually create dirt paths
    const _wx = Math.round(c.x), _wy = Math.round(c.y);
    if (_wx >= 0 && _wx < MAP_W && _wy >= 0 && _wy < MAP_H) {
      if (!G.tileWear) {
        G.tileWear = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
      }
      const tile = G.map[_wy][_wx];
      if (tile !== TILE.WATER && tile !== TILE.MOUNTAIN) {
        const cur = G.tileWear[_wy][_wx];
        if (cur < 200 && G.gameTick % 30 === 0) {
          G.tileWear[_wy][_wx] = cur + 1;
        }
      }
    }

    // Reveal fog around citizen after movement
    const _cx = Math.round(c.x), _cy = Math.round(c.y);
    if (_cx >= 0 && _cx < MAP_W && _cy >= 0 && _cy < MAP_H) {
      if (!G.fog[_cy][_cx]) {
        revealAround(_cx, _cy, 2);
      }
    }

    // Hungry emote — derive the cadence from actor identity instead of
    // storing a presentation timer or advancing the simulation RNG.
    if (c.hunger > CITIZEN_MEAL_HUNGER_THRESHOLD) {
      const emoteInterval = 120; // every 2 seconds at 1x
      if ((G.gameTick + citizenHash(c)) % emoteInterval === 0) {
        const emote = c.hunger >= 90 ? '❗' : '🍽️';
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -22,
          text: emote,
          alpha: 1.4, vy: -0.1, decay: 0.015, type: 'speech',
        });
      }
    }

    // Follow path if we have one
    if (c.path && c.pathIdx < c.path.length) {
      // Building topology changes are rare, while a delayed collision with a
      // newly blocked compressed segment is expensive. Validate every tile in
      // each remaining compressed segment; unrelated construction keeps the
      // authored route, while a genuine intersection replans immediately.
      if (c._pathEpoch !== (G.obstacleEpoch || 0)) {
        c._pathEpoch = G.obstacleEpoch || 0;
        if (!remainingCitizenRouteWalkable(c)) {
          replanToRequestedTarget(c);
          continue;
        }
      }
      const wp = c.path[c.pathIdx];
      if (!isWalkable(wp.x, wp.y)) {
        replanToRequestedTarget(c);
        continue;
      }
      const dx = wp.x - c.x, dy = wp.y - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 0.005) {
        c.x = wp.x;
        c.y = wp.y;
        c.pathIdx++;
      } else {
        const spd = citizenTravelSpeed(c);
        const step = Math.min(spd, d);
        const nx = c.x + (dx/d) * step;
        const ny = c.y + (dy/d) * step;
        const beforeX = c.x, beforeY = c.y;
        const directTerrainStep = canStepCitizen(c, nx, ny);
        const resolvedStep = resolveCitizenStep(c, nx, ny);
        if (resolvedStep) {
          c.x = resolvedStep.x;
          c.y = resolvedStep.y;
          // Consume the waypoint on the same tick that reaches it. The old
          // 0.15-tile early cutoff both cut visible corners and inserted an
          // idle simulation beat between path segments.
          const waypointDistance = Math.hypot(c.x - wp.x, c.y - wp.y);
          if (waypointDistance <= (resolvedStep.lane ? 0.23 : 0.005)) {
            if (!resolvedStep.lane) {
              c.x = wp.x;
              c.y = wp.y;
            }
            c.pathIdx++;
          }
          // Render reads this for walk-row hysteresis: paths empty for a
          // single frame between arrival and the next repath, and raw
          // path-presence flapped the walk/idle rows (visible flicker).
          c._movedAt = G.gameTick;
          const actualDx = c.x - beforeX;
          const actualDy = c.y - beforeY;
          if (Math.abs(actualDx) > 0.01 || Math.abs(actualDy) > 0.01) {
            c.faceX = actualDx > 0.01 ? 1 : actualDx < -0.01 ? -1 : 0;
            c.faceZ = actualDy > 0.01 ? 1 : actualDy < -0.01 ? -1 : 0;
          }
          const moved = Math.hypot(c.x - beforeX, c.y - beforeY);
          if (resolvedStep.trafficWait) {
            // Lateral clearance is useful movement, but it is not evidence
            // that the authored route or food store is unreachable.
            noteCitizenTrafficWait(c);
          } else {
            const lastPathX = Number.isFinite(c._lastPathX) ? c._lastPathX : beforeX;
            const lastPathY = Number.isFinite(c._lastPathY) ? c._lastPathY : beforeY;
            const progressMoved = Math.hypot(c.x - lastPathX, c.y - lastPathY);
            if (moved < 0.001 || progressMoved < 0.01) c._stuckTicks = (c._stuckTicks || 0) + 1;
            else {
              c._stuckTicks = 0;
              c._lastPathX = c.x;
              c._lastPathY = c.y;
            }
            if ((c._stuckTicks || 0) > 45) replanToRequestedTarget(c);
          }
        } else if (directTerrainStep) {
          noteCitizenTrafficWait(c);
        } else {
          replanToRequestedTarget(c);
        }
      }
      continue; // still moving — next citizen
    }

    if (c.path && c.pathIdx >= c.path.length) {
      clearPath(c);
    }

    // No path or path complete — fallback straight-line for non-pathfound movement
    if (
      !c.path
      && c.activity.kind !== 'walk_to_work'
      && c.activity.kind !== 'walk_to_deliver'
      && c.activity.kind !== 'walk_to_eat'
      && c.activity.kind !== 'foraging'
    ) {
      const dx = c.tx - c.x, dy = c.ty - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.1) {
        let spd = c.speed * getCitizenSpeedMult();
        if (c.hunger > 60) {
          const penalty = Math.min(0.4, (c.hunger - 60) / 100);
          spd *= (1 - penalty);
        }
        if (c._fleeing) spd *= 1.35; // panic sprint
        const step = Math.min(spd, d);
        const nx = c.x + (dx/d) * step;
        const ny = c.y + (dy/d) * step;
        if (canStepCitizen(c, nx, ny)) {
          c.x = nx;
          c.y = ny;
          c._movedAt = G.gameTick;
          if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) {
            c.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
            c.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
          }
        } else {
          clearPath(c);
          c.tx = c.x;
          c.ty = c.y;
        }
        continue;
      }
    }

    // Arrived or no movement needed — run state machine
    c.activityTimer -= 1;
    if (c.activityTimer > 0) continue;
    runStateMachine(c);
  }
  // After all movement — apply personal-space separation
  applyCitizenSeparation();
  finishCitizenTrafficProgress(trafficProgressStart);
}

function runStateMachine(c) {
  switch (c.activity.kind) {
    case 'idle':
    case 'find_job':
      // Carried goods are an obligation: a citizen holding cargo delivers it
      // before seeking new work or loitering — this was the stranded-carrier
      // freeze (idle with wood in hand, goods leaked from the economy).
      if (c.carrying && c.carryAmount > 0) {
        setActivity(c, 'needs_delivery', { reason: 'cargo-ready' });
        clearPath(c);
        break;
      }
      // Hunger resolves through a reachable physical pantry. The compatibility
      // wallet is only a mirror and is never a remote meal source.
      if (c.hunger > CITIZEN_MEAL_HUNGER_THRESHOLD) {
        beginFoodRoute(c);
        break;
      }

      // Pick the best job by utility score (Phase 3c) — not merely the
      // nearest. Under a food crisis the colony visibly reallocates
      // labor toward farms and bakeries.
      let job = assignedBuilding(c);
      if (!job || !G.buildings.includes(job)) {
        if (job) releaseCitizenAssignment(c, 'assignment-invalid');
        job = null;
        let bestScore = -Infinity, bestB = null;
        for (const b of G.buildings) {
          if (isBlacklisted(c, b.x, b.y)) continue;
          const def = BUILDINGS[b.type];
          if (!def) continue; // guard against unknown building types (corrupt save, etc.)
          const site = isWorkforceConstructionSite(b);
          if (!site && !def.prod && !def.workers) continue;
          if (!buildingAcceptsAutomaticWorkers(b)) continue;
          // A site under construction offers BUILDER slots regardless of the
          // finished building's staffing; production slots take over after.
          const needed = citizenStaffingCapacity(b);
          if (staffingCount(b) >= needed) continue;
          const score = scoreCitizenJob(c, b);
          if (score > bestScore) { bestScore = score; bestB = b; }
        }
        if (bestB) {
          const reason = isWorkforceConstructionSite(bestB)
            ? 'construction'
            : (workforceFoodDaysLeft() < 2 && isFoodWorkplace(bestB) ? 'food-crisis' : 'job-market');
          claimCitizenAssignment(c, bestB, {
            duty: assignmentDutyForBuilding(bestB),
            purpose: assignmentPurposeForCitizen(c, bestB),
            reason,
          });
          job = bestB;
        }
      }

      if (job) {
        setActivity(c, 'walk_to_work');
        pathToWork(c);
        if (!c.path) {
          // An unreachable worksite used to win the utility score again on
          // the next idle tick, pinning a citizen in an assign/fail loop.
          releaseJob(c, { unreachable: true });
          setActivity(c, 'idle', { reason: 'path-unreachable', timer: 25 + rngInt(0, 35) });
        }
      } else {
        // No building job — emergency food gathering is a safety valve, not
        // a shadow economy. One lowest-ID unassigned citizen may forage when
        // the larder is below three days; idle citizens never mint wood or
        // stone while the player is reading the opening tutorial.
        const gx = Math.round(c.x), gy = Math.round(c.y);
        let forageTarget = null;
        let forageDist = Infinity;
        const searchR = 6;
        for (let dy = -searchR; dy <= searchR; dy++) {
          for (let dx = -searchR; dx <= searchR; dx++) {
            const nx = gx+dx, ny = gy+dy;
            if (nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) continue;
            if (!G.fog[ny][nx]) continue;
            const tile = G.map[ny][nx];
            // Forest berries and shoreline shellfish are emergency food.
            if (tile === 3 || tile === 1) {
              const d = Math.abs(dx)+Math.abs(dy);
              if (d < forageDist && !G.buildingGrid[ny]?.[nx]) {
                forageDist = d;
                forageTarget = { x: nx, y: ny, tile };
              }
            }
          }
        }

        const reliefForager = G.citizens
          .filter(other => !assignedBuilding(other))
          .reduce((best, other) => !best || other.actorId < best.actorId ? other : best, null);
        const needsFood = workforceFoodDaysLeft() < 3;
        if (
          forageTarget
          && needsFood
          && reliefForager === c
          && G.gameTick >= (c._forageReadyAt || 0)
        ) {
          setActivity(c, 'foraging');
          c.forageTarget = forageTarget;
          pathTo(c, forageTarget.x, forageTarget.y);
        } else {
          // Truly idle — loiter near settlement anchors instead of taking
          // long, map-center wander paths that read as aimless churn.
          const target = idleLoiterTarget(c);
          pathTo(c, target.x, target.y);
          setActivity(c, 'idle', { timer: 120 + rngInt(0, 140) });
        }
      }
      break;

    case 'walk_to_work':
      if (!assignedBuilding(c) || !G.buildings.includes(assignedBuilding(c))) {
        releaseJob(c);
        setActivity(c, 'find_job', { reason: 'assignment-invalid' });
        clearPath(c);
        break;
      }
      if (!c.workTarget || (c.workTarget.resource != null && G.map[c.workTarget.y]?.[c.workTarget.x] !== c.workTarget.resource)) {
        c.workTarget = workTargetForBuilding(c, assignedBuilding(c));
      }
      if (dist2(c.x, c.y, c.workTarget.x, c.workTarget.y) > 1.8) {
        pathToWork(c);
        if (c.path) break;
        releaseJob(c, { unreachable: true });
        setActivity(c, 'idle', { reason: 'path-unreachable', timer: 25 + rngInt(0, 35) });
        break;
      }
      // Arrived at workplace
      startWorking(c, 60 + rngInt(0, 30));
      break;

    case 'working':
      if (!assignedBuilding(c) || !G.buildings.includes(assignedBuilding(c))) {
        releaseJob(c);
        setActivity(c, 'find_job', { reason: 'assignment-invalid' });
        clearPath(c);
        break;
      }
      // Resource nodes are consumed/changed by the sim. Reacquire a valid
      // exterior work tile before the next production beat instead of
      // continuing to animate against an empty patch of ground.
      if (c.workTarget?.resource != null &&
          G.map[c.workTarget.y]?.[c.workTarget.x] !== c.workTarget.resource) {
        c.workTarget = workTargetForBuilding(c, assignedBuilding(c));
        setActivity(c, 'walk_to_work');
        pathToWork(c);
        if (!c.path) {
          releaseJob(c, { unreachable: true });
          setActivity(c, 'idle', { reason: 'path-unreachable', timer: 25 + rngInt(0, 35) });
        }
        break;
      }
      // Work-site feedback: periodic chips/grain at the workplace so labor
      // reads as labor even between production cycles.
      const workplace = assignedBuilding(c);
      if (workplace && G.gameTick % 24 === 0) {
        const salt = citizenHash(c);
        const unit = channel => visualJitter(workplace.x, workplace.y, salt + channel);
        if (unit(710) < 0.6) {
          G.particles.push({
            tx: workplace.x + (unit(711) - 0.5) * 0.5,
            ty: workplace.y + (unit(712) - 0.5) * 0.5,
            offsetY: -6, text: null, alpha: 0.85,
            vx: (unit(713) - 0.5) * 0.25, vy: -0.15, decay: 0.05,
            type: 'spark', size: 1.0, color: '#c9a86a',
          });
        }
      }
      // Done working — check if building produced something
      if (workplace) {
        const def = BUILDINGS[workplace.type] || {};
        if ((def.prod || def.convert) && workplace.produced) {
          // Pick up one resource kind per trip. Mixed-output workplaces keep
          // every other positive batch buffered so carrying food cannot erase
          // the same Farm's wheat harvest.
          const [resKey, amount] = Object.entries(workplace.produced)
            .find(([, value]) => Number.isFinite(value) && value > 0) || [];
          if (resKey) {
            c.carrying = resKey;
            c.carryAmount = amount;
            delete workplace.produced[resKey];
            if (!Object.values(workplace.produced).some(value => Number.isFinite(value) && value > 0)) {
              workplace.produced = null;
            }
            setActivity(c, 'walk_to_deliver', { reason: 'cargo-ready' });
            // User-reported: citizens were walking to map midpoint (MAP_W/2, MAP_H/2)
            // because "town center" was an imaginary coordinate, not a building.
            // Pick a real drop-off: resource-specific storage if present
            // (granary/storehouse for food and goods, market for gold), then
            // nearest house only as a last inhabited fallback.
            if (!routeDelivery(c, resKey)) {
              requestDeliveryStorage(c);
            }
            return;
          }
        }
      }
      // No completed output yet. Stay at the existing workstation instead
      // of taking a 10-tick find_job/idle detour; that detour froze the work
      // row between production checks and made miners look broken.
      startWorking(c, 10 + rngInt(0, 6));
      break;

    case 'needs_delivery': {
      if (c.carrying && c.carryAmount > 0 && routeDelivery(c, c.carrying)) {
        setActivity(c, 'walk_to_deliver');
        break;
      }
      const target = idleLoiterTarget(c);
      if (dist2(c.x, c.y, target.x, target.y) > 1.5) pathTo(c, target.x, target.y);
      requestDeliveryStorage(c);
      break;
    }

    case 'walk_to_deliver':
      if (!c.carrying || c.carryAmount <= 0) {
        c._deliveryTarget = null;
        setActivity(c, 'find_job', { reason: 'cargo-delivered' });
        clearPath(c);
        break;
      }
      if (!deliveryTargetStillValid(c)) {
        setActivity(c, 'needs_delivery');
        clearPath(c);
        break;
      }
      if (c.path && c.pathIdx < c.path.length) break;
      // Arrival counts against the SNAPPED path goal too: the raw request
      // can sit on an unwalkable tile whose ring the citizen legitimately
      // reached — retrying forever from 2.3 tiles away was the orbit bug.
      if (dist2(c.x, c.y, c._requestedTx ?? c.tx, c._requestedTy ?? c.ty) > 2.2 &&
          !(c._pathGoal && dist2(c.x, c.y, c._pathGoal.x, c._pathGoal.y) <= 1.2)) {
        blacklistTarget(c, c._deliveryTarget.x, c._deliveryTarget.y);
        if (routeDelivery(c, c.carrying)) break;
        requestDeliveryStorage(c);
        break;
      }
      // Arrived at delivery point
      setActivity(c, 'deliver');
      clearPath(c);
      break;

    case 'deliver':
      // Only credit a delivery near the actual dropoff — 'Delivered!' in an
      // empty field on a failed repath was a lie AND skipped chain routing.
      if (c.carrying && c.carryAmount > 0 &&
          (!deliveryTargetStillValid(c) ||
            dist2(c.x, c.y, c._deliveryTarget.x, c._deliveryTarget.y) > 4)) {
        if (c._deliveryTarget) blacklistTarget(c, c._deliveryTarget.x, c._deliveryTarget.y);
        requestDeliveryStorage(c);
        break;
      }
      if (c.carrying && c.carryAmount > 0) {
        const resource = c.carrying;
        const requested = c.carryAmount;
        const foodDeposit = resource === 'food'
          ? depositFood(c._deliveryTarget, requested)
          : null;
        const credited = foodDeposit ? foodDeposit.accepted : requested;
        const remainder = foodDeposit ? foodDeposit.remainder : 0;
        if (!foodDeposit) {
          G.resources[resource] = (G.resources[resource] || 0) + credited;
        }
        G.totalResourcesGathered = (G.totalResourcesGathered || 0) + credited;
        // Resource number float
        if (credited > 0) {
          G.particles.push({
            tx: c.x, ty: c.y, offsetY: 0,
            text: `+${credited} ${resEmoji(resource)}`,
            alpha: 1.5, vy: -0.3, type: 'text',
          });
          // Speech bubble
          G.particles.push({
            tx: c.x, ty: c.y, offsetY: -28,
            text: remainder > 0 ? `Stored ${credited}; finding room` : 'Delivered!',
            alpha: 1.2, vy: -0.12, decay: 0.018, type: 'speech',
          });
        }
        if (remainder > 0) {
          c.carryAmount = remainder;
          if (c._deliveryTarget) blacklistTarget(c, c._deliveryTarget.x, c._deliveryTarget.y);
          c._deliveryTarget = null;
          if (routeDelivery(c, resource)) {
            setActivity(c, 'walk_to_deliver', { reason: 'route-to-delivery' });
          } else {
            requestDeliveryStorage(c);
          }
          break;
        }
      }
      c.carrying = null;
      c.carryAmount = 0;
      c._deliveryTarget = null;
      c.workTarget = null;
      setActivity(c, 'find_job', { reason: 'cargo-delivered', timer: 5 });
      break;

    case 'foraging':
      if (c.forageTarget && dist2(c.x, c.y, c.forageTarget.x, c.forageTarget.y) > 1.2) {
        pathTo(c, c.forageTarget.x, c.forageTarget.y);
        if (c.path) break;
        c.forageTarget = null;
        setActivity(c, 'find_job', { reason: 'path-unreachable', timer: 20 });
        clearPath(c);
        break;
      }
      // Arrived at forage tile — gather a small amount
      if (c.forageTarget) {
        const res = 'food';
        const amount = 1;
        // Wild food becomes physical cargo. It is not realm-owned until this
        // citizen reaches a pantry with room through the ordinary delivery
        // contract.
        c.carrying = res;
        c.carryAmount = amount;
      }
      c.forageTarget = null;
      // One emergency trip per day at most. A Farm/Fisherman still wins by a
      // wide margin and is required to grow rather than merely delay hunger.
      c._forageReadyAt = G.gameTick + G.dayLength;
      setActivity(c, 'walk_to_deliver', { reason: 'forage-complete' });
      if (!routeDelivery(c, 'food')) requestDeliveryStorage(c);
      break;

    case 'walk_to_eat': {
      if (c.carrying && c.carryAmount > 0) {
        c._foodTarget = null;
        setActivity(c, 'needs_delivery', { reason: 'cargo-ready' });
        clearPath(c);
        break;
      }
      if (!foodTargetStillValid(c)) {
        c._foodTarget = null;
        beginFoodRoute(c, 'food-source-empty');
        break;
      }
      if (c.path && c.pathIdx < c.path.length) break;
      if (!citizenAtFoodTarget(c)) {
        blacklistTarget(c, c._foodTarget.x, c._foodTarget.y);
        c._foodTarget = null;
        beginFoodRoute(c, 'food-source-empty');
        break;
      }
      const meal = withdrawFood(c._foodTarget, 1);
      if (meal.taken !== 1) {
        c._foodTarget = null;
        beginFoodRoute(c, 'food-source-empty');
        break;
      }
      G._dailyFoodConsumed = (G._dailyFoodConsumed || 0) + meal.taken;
      feedCitizenMeal(c);
      setActivity(c, 'eating', { reason: 'eat-food', timer: 20 });
      clearPath(c);
      G.particles.push({
        tx: c.x, ty: c.y, offsetY: -26,
        text: '🍞', alpha: 1.2, vy: -0.15, decay: 0.02, type: 'text',
      });
      break;
    }

    case 'waiting_for_food':
      if (c.carrying && c.carryAmount > 0) {
        c._foodTarget = null;
        setActivity(c, 'needs_delivery', { reason: 'cargo-ready' });
        clearPath(c);
      } else if (c.hunger <= CITIZEN_MEAL_HUNGER_THRESHOLD) {
        resumeAfterMeal(c);
      } else {
        beginFoodRoute(c);
      }
      break;

    case 'eating':
      resumeAfterMeal(c);
      break;

    case 'seek_shelter': {
      if (G.enemies.length === 0) {
        leaveRaidShelter(c);
        break;
      }
      if (!citizenHasValidResidence(c)) {
        beginOpenRaidFlight(c);
        break;
      }
      if (enterRaidShelter(c)) break;
      const portal = residencePortalForCitizen(c);
      if (!portal || !pathTo(c, portal.x, portal.y, { exact: true })) {
        blacklistTarget(c, c.home.x, c.home.y);
        beginOpenRaidFlight(c);
      }
      break;
    }

    case 'sheltered':
      // Sheltered actors are normally consumed at the top of updateCitizens,
      // before exterior movement and needs. This fallback keeps a direct
      // state-machine call inert rather than exposing an indoor resident.
      c.activityTimer = 60;
      break;

    case 'flee':
      if (G.enemies.length === 0) leaveRaidShelter(c);
      else beginOpenRaidFlight(c);
      break;

    case 'go_home':
      // Shared mover walks the path; when it's exhausted we're home.
      if (c.path && c.pathIdx < c.path.length) break;
      // A failed route is not indoor sleep. Release the unreachable home so
      // the citizen remains visible sleeping rough and retries next night.
      if (c.home && (
        !citizenHasValidResidence(c)
        || dist2(c.x, c.y, c.home.x, c.home.y) > 10
      )) c.home = null;
      setActivity(c, 'sleep', { timer: 60 });
      clearPath(c);
      break;

    case 'leisure': {
      if (c.path && c.pathIdx < c.path.length) break;
      const venue = c._leisureTarget;
      c._leisureTarget = null;
      if (venue) {
        satisfyCitizenLeisureNeed(c, venue.kind);
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -24,
          text: venue.kind === 'tavern' ? '🍺' : '🙏',
          alpha: 1.1, vy: -0.08, decay: 0.014, type: 'speech',
        });
        // Linger at the venue until night calls everyone home.
        setActivity(c, 'idle', { reason: 'leisure-complete', timer: 90 + rngInt(0, 60) });
      } else {
        setActivity(c, 'find_job', { reason: 'leisure-complete', timer: 5 });
      }
      clearPath(c);
      break;
    }

    case 'sleep':
      // Sleep restores energy; the dawn heartbeat wakes us. Re-enter on
      // a slow cadence and breathe the occasional 💤 so night reads as
      // rest, not a freeze.
      restoreCitizenSleepRest(c);
      if (visualJitter(c.x, c.y, 900 + citizenHash(c)) < 0.25) {
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -24,
          text: '💤', alpha: 0.9, vy: -0.06, decay: 0.012, type: 'speech',
        });
      }
      c.activityTimer = 60;
      break;

    default:
      setActivity(c, 'idle', { reason: 'assignment-invalid', timer: 10 });
      clearPath(c);
  }
}

function resEmoji(k) {
  return {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️'}[k] || k;
}
