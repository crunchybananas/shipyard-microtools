// ════════════════════════════════════════════════════════════
// Army orders — one authoritative policy for posture, anchors, leashes,
// and immediate retargeting. Soldiers remain autonomous combatants; the
// player gives them intent rather than steering individual units.
// ════════════════════════════════════════════════════════════

import { G, MAP_H, MAP_W, rngRange } from './state.js?realm=196';
import { findPath, isWalkable, nearestWalkableTile } from './pathfinding.js?realm=196';

export const ARMY_ORDERS = Object.freeze(['defend', 'rally', 'patrol', 'guard', 'explore']);

// The objective is authoritative saved player intent. Route plans remain
// transient WeakMap state: they are rebuilt from the objective after load or
// whenever topology changes, keeping the strict soldier surface compact.
let SOLDIER_ROUTES = new WeakMap();
let SOLDIER_COMBAT_ROUTES = new WeakMap();

const FORMATION_OFFSETS = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: -1 }),
  Object.freeze({ x: 1, y: -1 }),
  Object.freeze({ x: -1, y: 1 }),
  Object.freeze({ x: 1, y: 1 }),
]);

const COMPANY_MODES = Object.freeze(['advance', 'attack-move']);

const ORDER_META = Object.freeze({
  defend: Object.freeze({ icon: '🛡️', label: 'Defend', detail: 'Hold near the company yard and intercept nearby threats.' }),
  rally: Object.freeze({ icon: '🚩', label: 'Rally', detail: 'Hold a tight line around the planted rally flag.' }),
  patrol: Object.freeze({ icon: '🧱', label: 'Patrol', detail: 'Walk the realm\'s completed walls and towers.' }),
  guard: Object.freeze({ icon: '👁️', label: 'Guard', detail: 'Protect one chosen building and threats near it.' }),
  explore: Object.freeze({ icon: '🧭', label: 'Explore', detail: 'Escort the Founder while the expedition charts the frontier.' }),
});

export function companyObjective(state = G) {
  return state.armyObjective || null;
}

export function resetCompanyCommandRuntime(state = G, { clearObjective = false } = {}) {
  SOLDIER_ROUTES = new WeakMap();
  SOLDIER_COMBAT_ROUTES = new WeakMap();
  if (clearObjective) state.armyObjective = null;
}

function companyMembers(state) {
  return (state.soldiers || [])
    .map((soldier, index) => ({ soldier, index }))
    .filter(({ soldier }) => !soldier.garrison)
    .sort((a, b) => (
      compareStableStrings(String(a.soldier.name || ''), String(b.soldier.name || ''))
      || a.index - b.index
    ))
    .map(({ soldier }) => soldier);
}

// Locale-sensitive collation is intentionally avoided: formation assignment
// must match in every browser and in the headless deterministic verifier.
function compareStableStrings(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function formationOffset(soldier, members) {
  const index = Math.max(0, members.indexOf(soldier));
  if (index < FORMATION_OFFSETS.length) return FORMATION_OFFSETS[index];
  const ring = Math.floor(Math.sqrt(index));
  const side = Math.max(1, ring * 2);
  const offset = index - ring * ring;
  const edge = Math.floor(offset / side);
  const along = (offset % side) - Math.floor(side / 2);
  if (edge === 0) return { x: along, y: -ring };
  if (edge === 1) return { x: ring, y: along };
  if (edge === 2) return { x: -along, y: ring };
  return { x: -ring, y: -along };
}

function objectiveDestination(objective, soldier, members, state) {
  const offset = formationOffset(soldier, members);
  const requestedX = objective.x + offset.x;
  const requestedY = objective.y + offset.y;
  return nearestWalkableTile(
    requestedX,
    requestedY,
    4,
    Math.round(soldier.x),
    Math.round(soldier.y),
  );
}

function routeForSoldier(soldier, objective, members, state) {
  const goal = objectiveDestination(objective, soldier, members, state);
  if (!goal) return null;
  const path = findPath(
    Math.round(soldier.x),
    Math.round(soldier.y),
    goal.x,
    goal.y,
  );
  if (!path) return null;
  return {
    path,
    pathIdx: 0,
    goal,
    obstacleEpoch: state.obstacleEpoch || 0,
  };
}

function planCompanyRoutes(objective, state) {
  const members = companyMembers(state);
  if (!members.length) return { ok: false, reason: 'no-company' };
  const routes = new Map();
  for (const soldier of members) {
    const route = routeForSoldier(soldier, objective, members, state);
    if (!route) return { ok: false, reason: 'no-route', soldier: soldier.name || 'soldier' };
    routes.set(soldier, route);
  }
  return { ok: true, members, routes };
}

export function applyCompanyObjective(x, y, mode = 'attack-move', state = G) {
  if (!COMPANY_MODES.includes(mode)) return { ok: false, reason: 'bad-company-mode' };
  if (state.armySupply?.readiness === 'starving') return { ok: false, reason: 'company-starving' };
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return { ok: false, reason: 'invalid-company-point' };
  }
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) {
    return { ok: false, reason: 'company-point-out-of-bounds' };
  }
  if (!isWalkable(x, y)) return { ok: false, reason: 'company-point-unwalkable' };

  const objective = { x, y, mode };
  const planned = planCompanyRoutes(objective, state);
  if (!planned.ok) return planned;

  state.armyObjective = objective;
  for (const soldier of planned.members) SOLDIER_ROUTES.set(soldier, planned.routes.get(soldier));
  // Garrisoned soldiers are not members and their tower order remains intact.
  for (const soldier of state.soldiers || []) {
    if (!planned.members.includes(soldier)) {
      SOLDIER_ROUTES.delete(soldier);
      SOLDIER_COMBAT_ROUTES.delete(soldier);
    }
    soldier.stateTimer = 1;
  }
  return { ok: true, objective, members: planned.members.length };
}

function moveAlongRoute(soldier, route, speed) {
  while (route.pathIdx < route.path.length) {
    const waypoint = route.path[route.pathIdx];
    const distance = Math.hypot(waypoint.x - soldier.x, waypoint.y - soldier.y);
    if (distance <= 0.12) {
      soldier.x = waypoint.x;
      soldier.y = waypoint.y;
      route.pathIdx++;
      continue;
    }
    return { active: true, moved: stepEntityTowardWithRoute(soldier, waypoint, speed) };
  }
  return { active: true, moved: false };
}

// Keep the route follower in this module so soldier AI has one route-aware
// movement surface. A direct step is still useful between A* waypoints; if a
// topology change blocks it, the caller replans rather than wandering.
function stepEntityTowardWithRoute(soldier, waypoint, speed) {
  // Imported lazily would create a cycle through soldiers.js; the local
  // stepping primitive is intentionally tiny and mirrors pathfinding's
  // collision-checked candidates. Route waypoints themselves are walkable.
  const dx = waypoint.x - soldier.x;
  const dy = waypoint.y - soldier.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.0001) return false;
  const step = Math.min(speed, distance);
  const cx = Math.round(soldier.x);
  const cy = Math.round(soldier.y);
  const candidates = [
    [soldier.x + (dx / distance) * step, soldier.y + (dy / distance) * step],
    [soldier.x + Math.sign(dx) * step, soldier.y],
    [soldier.x, soldier.y + Math.sign(dy) * step],
  ];
  for (const [nx, ny] of candidates) {
    const rx = Math.round(nx), ry = Math.round(ny);
    if (rx === cx && ry === cy) { soldier.x = nx; soldier.y = ny; return true; }
    if (!isWalkable(rx, ry)) continue;
    if (rx !== cx && ry !== cy && (!isWalkable(rx, cy) || !isWalkable(cx, ry))) continue;
    soldier.x = nx;
    soldier.y = ny;
    return true;
  }
  return false;
}

export function updateCompanyMovement(soldier, state = G, speed = 0.035) {
  const objective = companyObjective(state);
  const members = companyMembers(state);
  if (!objective || !members.includes(soldier) || soldier.garrison) return false;
  let route = SOLDIER_ROUTES.get(soldier);
  if (!route || route.obstacleEpoch !== (state.obstacleEpoch || 0)) {
    route = routeForSoldier(soldier, objective, members, state);
    if (!route) return true;
    SOLDIER_ROUTES.set(soldier, route);
  }
  const result = moveAlongRoute(soldier, route, speed);
  if (!result.moved && route.pathIdx < route.path.length) {
    const replanned = routeForSoldier(soldier, objective, members, state);
    if (replanned) SOLDIER_ROUTES.set(soldier, replanned);
  }
  return result.active;
}

export function moveSoldierToTarget(soldier, target, state = G, speed = 0.04) {
  let route = SOLDIER_COMBAT_ROUTES.get(soldier);
  const targetMoved = route && Math.hypot(target.x - route.targetX, target.y - route.targetY) > 0.75;
  if (!route || route.obstacleEpoch !== (state.obstacleEpoch || 0) || targetMoved || route.pathIdx >= route.path.length) {
    const goal = nearestWalkableTile(Math.round(target.x), Math.round(target.y), 2, Math.round(soldier.x), Math.round(soldier.y));
    const path = goal ? findPath(Math.round(soldier.x), Math.round(soldier.y), goal.x, goal.y) : null;
    route = path ? {
      path,
      pathIdx: 0,
      obstacleEpoch: state.obstacleEpoch || 0,
      targetX: target.x,
      targetY: target.y,
    } : null;
    if (route) SOLDIER_COMBAT_ROUTES.set(soldier, route);
  }
  if (!route) return false;
  const result = moveAlongRoute(soldier, route, speed);
  if (!result.moved && route.pathIdx < route.path.length) {
    SOLDIER_COMBAT_ROUTES.delete(soldier);
  }
  return result.moved;
}

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
  resetCompanyCommandRuntime(state, { clearObjective: true });
  state.armyStance = stance;
  setArmyTargets(state);
  return { ok: true, stance };
}

export function applyRallyOrder(x, y, state = G) {
  if (x === null || y === null) {
    state.rallyPoint = null;
    return applyArmyStance('defend', state);
  }
  resetCompanyCommandRuntime(state, { clearObjective: true });
  state.rallyPoint = { x, y };
  state.armyStance = 'rally';
  setArmyTargets(state);
  return { ok: true, stance: 'rally', point: Object.freeze({ x, y }) };
}

export function applyGuardOrder(x, y, state = G) {
  const building = state.buildingGrid?.[y]?.[x] || null;
  if (!building || !state.buildings.includes(building)) return { ok: false, reason: 'no-building' };
  if (building.buildProgress < 1) return { ok: false, reason: 'under-construction' };
  resetCompanyCommandRuntime(state, { clearObjective: true });
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
  resetCompanyCommandRuntime(state, { clearObjective: true });
  state.armyGuardPoint = null;
  if (state.armyStance === 'guard') state.armyStance = 'defend';
  setArmyTargets(state);
  return true;
}

export function armyOrderCenter(soldier, state = G) {
  const objective = companyObjective(state);
  if (objective) return objective;
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
  const objective = companyObjective(state);
  if (objective) {
    const leash = objective.mode === 'attack-move' ? 10 : 4;
    return distanceToSoldier < 12
      && Math.hypot(enemy.x - objective.x, enemy.y - objective.y) < leash;
  }
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
