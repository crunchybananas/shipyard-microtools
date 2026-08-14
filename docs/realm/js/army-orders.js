// ════════════════════════════════════════════════════════════
// Army orders — one authoritative policy for posture, anchors, leashes,
// and immediate retargeting. Soldiers remain autonomous combatants; the
// player gives them intent rather than steering individual units.
// ════════════════════════════════════════════════════════════

import { G, rngRange } from './state.js?realm=195';

export const ARMY_ORDERS = Object.freeze(['defend', 'rally', 'patrol', 'guard', 'explore']);

const ORDER_META = Object.freeze({
  defend: Object.freeze({ icon: '🛡️', label: 'Defend', detail: 'Hold near the company yard and intercept nearby threats.' }),
  rally: Object.freeze({ icon: '🚩', label: 'Rally', detail: 'Hold a tight line around the planted rally flag.' }),
  patrol: Object.freeze({ icon: '🧱', label: 'Patrol', detail: 'Walk the realm\'s completed walls and towers.' }),
  guard: Object.freeze({ icon: '👁️', label: 'Guard', detail: 'Protect one chosen building and threats near it.' }),
  explore: Object.freeze({ icon: '🧭', label: 'Explore', detail: 'Escort the Founder while the expedition charts the frontier.' }),
});

export function armyOrderMeta(order = G.armyStance) {
  return ORDER_META[order] || ORDER_META.defend;
}

export function liveGuardBuilding(state = G) {
  const point = state.armyGuardPoint;
  if (!point) return null;
  const building = state.buildingGrid?.[point.y]?.[point.x] || null;
  return building
    && state.buildings.includes(building)
    && building.buildProgress >= 1
    ? building
    : null;
}

export function setArmyTargets(state = G) {
  const guard = liveGuardBuilding(state);
  for (const soldier of state.soldiers) {
    let center = null;
    let radius = 3;
    if (state.armyStance === 'rally' && state.rallyPoint) {
      center = state.rallyPoint;
      radius = 2;
    } else if (state.armyStance === 'guard' && guard) {
      center = guard;
      radius = 2;
    } else if (state.armyStance === 'explore' && state.avatar) {
      center = state.avatar;
      radius = 2;
    } else if (state.armyStance === 'defend' && soldier.homeBuilding) {
      center = soldier.homeBuilding;
    }
    if (center) {
      soldier.tx = center.x + rngRange(-radius, radius);
      soldier.ty = center.y + rngRange(-radius, radius);
    }
    // Re-anchor patrols and any posture without an immediate center next tick.
    soldier.stateTimer = 1;
  }
}

export function applyArmyStance(stance, state = G) {
  if (!ARMY_ORDERS.includes(stance)) return { ok: false, reason: 'bad-stance' };
  if (stance === 'rally' && !state.rallyPoint) return { ok: false, reason: 'no-rally-point' };
  if (stance === 'guard' && !liveGuardBuilding(state)) return { ok: false, reason: 'no-guard-target' };
  if (stance === 'explore' && !state.avatar) return { ok: false, reason: 'no-founder' };
  state.armyStance = stance;
  setArmyTargets(state);
  return { ok: true, stance };
}

export function applyRallyOrder(x, y, state = G) {
  if (x === null || y === null) {
    state.rallyPoint = null;
    return applyArmyStance('defend', state);
  }
  state.rallyPoint = { x, y };
  state.armyStance = 'rally';
  setArmyTargets(state);
  return { ok: true, stance: 'rally', point: Object.freeze({ x, y }) };
}

export function applyGuardOrder(x, y, state = G) {
  const building = state.buildingGrid?.[y]?.[x] || null;
  if (!building || !state.buildings.includes(building)) return { ok: false, reason: 'no-building' };
  if (building.buildProgress < 1) return { ok: false, reason: 'under-construction' };
  state.armyGuardPoint = { x: building.x, y: building.y };
  state.armyStance = 'guard';
  setArmyTargets(state);
  return { ok: true, stance: 'guard', building };
}

export function clearGuardOrderForBuilding(building, state = G) {
  if (
    !state.armyGuardPoint
    || state.armyGuardPoint.x !== building.x
    || state.armyGuardPoint.y !== building.y
  ) return false;
  state.armyGuardPoint = null;
  if (state.armyStance === 'guard') state.armyStance = 'defend';
  setArmyTargets(state);
  return true;
}

export function armyOrderCenter(soldier, state = G) {
  if (state.armyStance === 'rally' && state.rallyPoint) return state.rallyPoint;
  if (state.armyStance === 'guard') return liveGuardBuilding(state);
  if (state.armyStance === 'explore') return state.avatar || null;
  if (state.armyStance === 'defend') return soldier.homeBuilding || null;
  return null;
}

export function armyOrderAnchor(soldier, state = G) {
  const center = armyOrderCenter(soldier, state);
  if (center) {
    const radius = state.armyStance === 'defend' ? 3 : 2;
    return { x: center.x + rngRange(-radius, radius), y: center.y + rngRange(-radius, radius) };
  }
  if (state.armyStance === 'patrol') {
    if (!state._patrolPosts || state._patrolPostsBuildingCount !== state.buildings.length) {
      state._patrolPosts = state.buildings.filter(building => (
        building.buildProgress >= 1
        && (building.type === 'wall' || building.type === 'tower')
      ));
      state._patrolPostsBuildingCount = state.buildings.length;
    }
    const posts = state._patrolPosts;
    if (posts.length) {
      soldier._postIdx = ((soldier._postIdx ?? (state.soldiers.indexOf(soldier) * 7)) + 1) % posts.length;
      const post = posts[soldier._postIdx];
      return { x: post.x + rngRange(-1, 1), y: post.y + rngRange(-1, 1) };
    }
    if (!state._patrolEmptyNotified) {
      state._patrolEmptyNotified = true;
      state.particles.push({ tx: soldier.x, ty: soldier.y, offsetY: -14, text: 'No walls to patrol', alpha: 1.3, vy: -0.12, decay: 0.014, type: 'speech' });
    }
  }
  return soldier.homeBuilding
    ? { x: soldier.homeBuilding.x + rngRange(-3, 3), y: soldier.homeBuilding.y + rngRange(-3, 3) }
    : null;
}

export function armyMayEngage(soldier, enemy, state = G) {
  const distanceToSoldier = Math.hypot(enemy.x - soldier.x, enemy.y - soldier.y);
  if (state.armyStance === 'rally' || state.armyStance === 'guard' || state.armyStance === 'explore') {
    const center = armyOrderCenter(soldier, state);
    if (!center) return false;
    const leash = state.armyStance === 'rally' ? 8 : 10;
    return distanceToSoldier < 12 && Math.hypot(enemy.x - center.x, enemy.y - center.y) < leash;
  }
  return distanceToSoldier < 12;
}

export function refreshEscortTarget(soldier, state = G) {
  if (state.armyStance !== 'explore' || !state.avatar) return false;
  if (Math.hypot(soldier.tx - state.avatar.x, soldier.ty - state.avatar.y) <= 3) return false;
  const anchor = armyOrderAnchor(soldier, state);
  if (!anchor) return false;
  soldier.tx = anchor.x;
  soldier.ty = anchor.y;
  soldier.stateTimer = Math.min(soldier.stateTimer || 1, 30);
  return true;
}
