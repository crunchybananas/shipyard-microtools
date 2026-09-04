// Realm-to-planner adapter for deterministic raid intent.
//
// Every simulation fact enters through the explicit `state` argument. This
// module never reads G, presentation-only tile wear, the DOM, or randomness.
// The planner therefore reasons from exactly the world snapshot the simulation
// gives it and produces a small save-shaped surface for each raider.

import { BUILDINGS, MAP_H, MAP_W, TILE } from './state.js?realm=198';
import { storedResource } from './building-inventory.js?realm=198';
import {
  RAID_TARGET_PRIORITY,
  raidTargetForIndex,
  rankedRaidTargets,
} from './raid-targeting.js?realm=198';
import { planRaidIntent } from './raid-planner.js?realm=198';

export const RAID_BREACH_DAMAGE_PER_TICK = 0.35;

export const RAID_ROUTE_CONTRACT = Object.freeze({
  maxObjectives: 32,
  maxPathCells: MAP_W * MAP_H,
  maxLandfallCandidates: 32,
  groundCost: 1000,
  roadCost: 500,
  corridorPressurePerAssignment: 1800,
  towerExposureRadius: 10,
  towerExposureStep: 180,
});

export const RAID_ROUTE_ENEMY_FIELDS = Object.freeze([
  'raidPath',
  'raidPathIdx',
  'raidPlanEpoch',
  'raidIntent',
  'raidBreaches',
]);

const PHYSICAL_LOOT_WEIGHTS = Object.freeze({
  food: 1000,
  wheat: 550,
  flour: 800,
});

function liveCompletedStructure(building) {
  return !!building
    && building.active === true
    && building.buildProgress >= 1
    && Number.isFinite(building.hp)
    && building.hp > 0
    && building.type !== 'road';
}

function terrainIsOpen(tile) {
  return tile !== TILE.WATER && tile !== TILE.MOUNTAIN && tile !== undefined;
}

function stableInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) ? value : fallback;
}

function safeSide(side) {
  return Number.isSafeInteger(side) && side >= 0 && side <= 3 ? side : 0;
}

export function raidStructureId(building) {
  if (!building) return '';
  return `${String(building.type)}@${stableInteger(building.x, -1)},${stableInteger(building.y, -1)}`;
}

export function raidObjectiveValue(building) {
  if (!building) return 0;
  const priority = RAID_TARGET_PRIORITY[building.type] || 2;
  let value = priority * 20_000;
  for (const [resource, weight] of Object.entries(PHYSICAL_LOOT_WEIGHTS)) {
    value += storedResource(building, resource) * weight;
  }
  return Math.min(1_000_000_000, value);
}

export function buildRaidPlanningSnapshot(state) {
  const cells = new Uint8Array(MAP_W * MAP_H);
  const travelCosts = new Uint16Array(MAP_W * MAP_H);
  const defenseExposure = new Uint32Array(MAP_W * MAP_H);
  const destructibles = [];

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const node = y * MAP_W + x;
      const building = state.buildingGrid?.[y]?.[x] || null;
      const terrainOpen = terrainIsOpen(state.map?.[y]?.[x]);
      const road = building?.type === 'road';
      cells[node] = terrainOpen && (!building || road) ? 1 : 0;
      travelCosts[node] = road ? RAID_ROUTE_CONTRACT.roadCost : RAID_ROUTE_CONTRACT.groundCost;
      if (liveCompletedStructure(building)) {
        destructibles.push({
          id: raidStructureId(building),
          label: BUILDINGS[building.type]?.name || building.type,
          x,
          y,
          hp: building.hp,
        });
      }
    }
  }

  const towers = (state.buildings || [])
    .filter(building => liveCompletedStructure(building) && building.type === 'tower')
    .slice()
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const radius = RAID_ROUTE_CONTRACT.towerExposureRadius;
  for (const tower of towers) {
    for (let y = Math.max(0, tower.y - radius); y <= Math.min(MAP_H - 1, tower.y + radius); y++) {
      for (let x = Math.max(0, tower.x - radius); x <= Math.min(MAP_W - 1, tower.x + radius); x++) {
        const dx = x - tower.x;
        const dy = y - tower.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > radius * radius) continue;
        const ringsInsideRange = radius + 1 - Math.ceil(Math.sqrt(distanceSquared));
        const node = y * MAP_W + x;
        defenseExposure[node] = Math.min(
          1_000_000_000,
          defenseExposure[node] + ringsInsideRange * RAID_ROUTE_CONTRACT.towerExposureStep,
        );
      }
    }
  }

  destructibles.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return Object.freeze({
    grid: Object.freeze({ width: MAP_W, height: MAP_H, cells, travelCosts }),
    defenseExposure,
    destructibles: Object.freeze(destructibles.map(entry => Object.freeze(entry))),
  });
}

export function buildRaidCorridorPressure(state, { exclude = null } = {}) {
  const pressure = new Uint32Array(MAP_W * MAP_H);
  for (const enemy of state.enemies || []) {
    if (enemy === exclude || enemy.retreating || !Array.isArray(enemy.raidPath)) continue;
    const from = Math.max(0, stableInteger(enemy.raidPathIdx, 0));
    for (let index = from; index < enemy.raidPath.length; index++) {
      const point = enemy.raidPath[index];
      if (!point || !Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) continue;
      if (point.x < 0 || point.x >= MAP_W || point.y < 0 || point.y >= MAP_H) continue;
      const node = point.y * MAP_W + point.x;
      pressure[node] = Math.min(
        1_000_000_000,
        pressure[node] + RAID_ROUTE_CONTRACT.corridorPressurePerAssignment,
      );
    }
  }
  return pressure;
}

function openEntryCell(state, x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  if (!terrainIsOpen(state.map?.[y]?.[x])) return false;
  const building = state.buildingGrid?.[y]?.[x];
  return !building || building.type === 'road';
}

function waterApproachCell(state, x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  if (state.map?.[y]?.[x] !== TILE.WATER) return false;
  return !state.buildingGrid?.[y]?.[x];
}

function raidApproachPath(previous, startNode, waterNode, landfallNode) {
  const nodes = [landfallNode];
  let cursor = waterNode;
  while (cursor !== -1) {
    nodes.push(cursor);
    if (cursor === startNode) break;
    cursor = previous[cursor];
  }
  if (nodes[nodes.length - 1] !== startNode) return null;
  nodes.reverse();
  return nodes.map(node => Object.freeze({ x: node % MAP_W, y: (node / MAP_W) | 0 }));
}

// Raiders keep their authored offshore spawn, then discover coastline through
// a bounded water-only BFS. Candidate landfalls are ordered by sailing
// distance, then lateral drift from the charted approach. The ground planner
// may try the next coast only when a nearer landing cannot reach any objective.
// This prevents the old depth-first scan from choosing a distant promontory
// and visually tunnelling across the island to get there.
export function findRaidLandfallApproaches(state, start, side, maxCandidates = RAID_ROUTE_CONTRACT.maxLandfallCandidates) {
  const normalizedSide = safeSide(side);
  const origin = {
    x: Math.max(0, Math.min(MAP_W - 1, Math.round(Number(start?.x) || 0))),
    y: Math.max(0, Math.min(MAP_H - 1, Math.round(Number(start?.y) || 0))),
  };
  if (openEntryCell(state, origin.x, origin.y)) {
    const point = Object.freeze({ ...origin });
    return Object.freeze([Object.freeze({ landfall: point, path: Object.freeze([point]) })]);
  }
  if (!waterApproachCell(state, origin.x, origin.y)) return Object.freeze([]);

  const size = MAP_W * MAP_H;
  const startNode = origin.y * MAP_W + origin.x;
  const previous = new Int32Array(size);
  previous.fill(-2);
  previous[startNode] = -1;
  const distance = new Uint16Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  queue[tail++] = startNode;
  const landfalls = new Map();
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (head < tail) {
    const node = queue[head++];
    const x = node % MAP_W;
    const y = (node / MAP_W) | 0;
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const nextNode = ny * MAP_W + nx;
      if (openEntryCell(state, nx, ny)) {
        const candidateDistance = distance[node] + 1;
        const known = landfalls.get(nextNode);
        if (!known || candidateDistance < known.distance || (candidateDistance === known.distance && node < known.waterNode)) {
          landfalls.set(nextNode, { node: nextNode, waterNode: node, distance: candidateDistance });
        }
        continue;
      }
      if (previous[nextNode] !== -2 || !waterApproachCell(state, nx, ny)) continue;
      previous[nextNode] = node;
      distance[nextNode] = distance[node] + 1;
      queue[tail++] = nextNode;
    }
  }

  const alongOrigin = normalizedSide === 0 || normalizedSide === 2 ? origin.x : origin.y;
  const boundedLimit = Math.max(1, Math.min(size, stableInteger(maxCandidates, RAID_ROUTE_CONTRACT.maxLandfallCandidates)));
  const ordered = [...landfalls.values()].sort((a, b) => {
    const aX = a.node % MAP_W;
    const aY = (a.node / MAP_W) | 0;
    const bX = b.node % MAP_W;
    const bY = (b.node / MAP_W) | 0;
    const aAlong = normalizedSide === 0 || normalizedSide === 2 ? aX : aY;
    const bAlong = normalizedSide === 0 || normalizedSide === 2 ? bX : bY;
    return (a.distance - b.distance)
      || (Math.abs(aAlong - alongOrigin) - Math.abs(bAlong - alongOrigin))
      || (a.node - b.node);
  }).slice(0, boundedLimit);

  return Object.freeze(ordered.map(candidate => {
    const path = raidApproachPath(previous, startNode, candidate.waterNode, candidate.node);
    const landfall = path?.at(-1);
    return Object.freeze({ landfall, path: Object.freeze(path || []) });
  }).filter(candidate => candidate.landfall && candidate.path.length > 0));
}

export function findRaidEntryCell(state, start, side) {
  const approach = findRaidLandfallApproaches(state, start, side, 1)[0];
  if (approach) return approach.landfall;
  return Object.freeze({
    x: Math.max(0, Math.min(MAP_W - 1, Math.round(Number(start?.x) || 0))),
    y: Math.max(0, Math.min(MAP_H - 1, Math.round(Number(start?.y) || 0))),
  });
}

function objectiveFromBuilding(building) {
  return {
    id: raidStructureId(building),
    label: BUILDINGS[building.type]?.name || building.type,
    x: building.x,
    y: building.y,
    value: raidObjectiveValue(building),
  };
}

function objectiveCandidates(state, side, raidIndex, firstRaid, forcedTarget) {
  if (firstRaid) {
    const target = liveCompletedStructure(forcedTarget)
      ? forcedTarget
      : raidTargetForIndex(raidIndex, state, side, MAP_W, MAP_H);
    return target ? [objectiveFromBuilding(target)] : [];
  }
  return rankedRaidTargets(state, side, MAP_W, MAP_H)
    .slice(0, RAID_ROUTE_CONTRACT.maxObjectives)
    .map(objectiveFromBuilding);
}

function copyPlanPath(path) {
  if (path.length > RAID_ROUTE_CONTRACT.maxPathCells) {
    throw new RangeError('Combined raid approach exceeds the bounded map route surface.');
  }
  return path.map(point => ({ x: point.x, y: point.y }));
}

export function clearRaidRoute(enemy) {
  if (!enemy) return;
  delete enemy.raidPath;
  delete enemy.raidPathIdx;
  delete enemy.raidPlanEpoch;
  delete enemy.raidIntent;
  delete enemy.raidBreaches;
}

export function routeRaiderToNearestEdge(enemy) {
  if (!enemy) return false;
  clearRaidRoute(enemy);
  enemy.retreating = true;
  const distX = Math.min(enemy.x, MAP_W - 1 - enemy.x);
  const distY = Math.min(enemy.y, MAP_H - 1 - enemy.y);
  if (distX < distY) {
    enemy.tx = enemy.x < MAP_W / 2 ? 0 : MAP_W - 1;
    enemy.ty = enemy.y;
  } else {
    enemy.tx = enemy.x;
    enemy.ty = enemy.y < MAP_H / 2 ? 0 : MAP_H - 1;
  }
  return true;
}

export function routeRaidBandToNearestEdge(state) {
  let routed = 0;
  for (const enemy of state?.enemies || []) {
    if (enemy.retreating) continue;
    if (routeRaiderToNearestEdge(enemy)) routed++;
  }
  return routed;
}

export function assignRaidRoute(enemy, {
  state,
  side,
  raidIndex = 0,
  firstRaid = false,
  attackerCount = 1,
  forcedTarget = null,
  corridorPressure = null,
} = {}) {
  if (!enemy || !state) return null;
  const normalizedSide = safeSide(side);
  const normalizedRaidIndex = Math.max(0, stableInteger(raidIndex, 0));
  const normalizedAttackerCount = Math.max(1, stableInteger(attackerCount, 1));
  const snapshot = buildRaidPlanningSnapshot(state);
  const objectives = objectiveCandidates(
    state,
    normalizedSide,
    normalizedRaidIndex,
    firstRaid === true,
    forcedTarget,
  );
  const assignedPressure = corridorPressure || buildRaidCorridorPressure(state, { exclude: enemy });
  const roundedStart = { x: Math.round(enemy.x), y: Math.round(enemy.y) };
  const approaches = findRaidLandfallApproaches(state, roundedStart, normalizedSide);
  let plan = null;
  let selectedApproach = null;
  for (const approach of approaches) {
    const candidate = planRaidIntent({
      grid: snapshot.grid,
      start: approach.landfall,
      approach: ['north', 'east', 'south', 'west'][normalizedSide],
      objectives,
      destructibles: snapshot.destructibles,
      defenseExposure: snapshot.defenseExposure,
      corridorPressure: assignedPressure,
      attacker: {
        dps: RAID_BREACH_DAMAGE_PER_TICK,
        count: normalizedAttackerCount,
      },
    });
    if (candidate.status !== 'planned' || !candidate.objective || candidate.path.length === 0) continue;
    plan = candidate;
    selectedApproach = approach;
    break;
  }
  if (!plan || !selectedApproach || plan.status !== 'planned' || !plan.objective || plan.path.length === 0) return null;

  const firstBreach = plan.breach;
  const combinedPath = [...selectedApproach.path.slice(0, -1), ...plan.path];
  enemy.tx = plan.objective.x;
  enemy.ty = plan.objective.y;
  enemy.raidPath = copyPlanPath(combinedPath);
  enemy.raidPathIdx = 0;
  enemy.raidPlanEpoch = Math.max(0, stableInteger(state.obstacleEpoch, 0));
  enemy.raidBreaches = plan.breaches.map(breach => ({
    id: breach.id,
    x: breach.x,
    y: breach.y,
  }));
  enemy.raidIntent = {
    side: normalizedSide,
    raidIndex: normalizedRaidIndex,
    firstRaid: firstRaid === true ? 1 : 0,
    attackerCount: normalizedAttackerCount,
    objectiveId: plan.objectiveId,
    targetType: String(plan.objective.id).split('@')[0],
    targetX: plan.objective.x,
    targetY: plan.objective.y,
    routeMode: firstBreach ? 'breach' : 'open',
    breachId: firstBreach?.id || '',
    breachType: firstBreach ? String(firstBreach.id).split('@')[0] : '',
    breachX: firstBreach?.x ?? -1,
    breachY: firstBreach?.y ?? -1,
    defensePresent: snapshot.defenseExposure.some(value => value > 0) ? 1 : 0,
    pressurePresent: assignedPressure.some(value => value > 0) ? 1 : 0,
    travelCost: plan.costs.travel,
    breachCost: plan.costs.breach,
    exposureCost: plan.costs.exposure,
    congestionCost: plan.costs.congestion,
    value: plan.costs.value,
    totalCost: plan.costs.total,
  };
  return plan;
}

export function raidIntentTarget(enemy, state) {
  const intent = enemy?.raidIntent;
  if (!intent || !Number.isSafeInteger(intent.targetX) || !Number.isSafeInteger(intent.targetY)) return null;
  const target = state.buildingGrid?.[intent.targetY]?.[intent.targetX] || null;
  return liveCompletedStructure(target) && raidStructureId(target) === intent.objectiveId ? target : null;
}

export function raidIntentBreach(enemy, state, x = enemy?.raidIntent?.breachX, y = enemy?.raidIntent?.breachY) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Array.isArray(enemy?.raidBreaches)) return null;
  const planned = enemy.raidBreaches.find(entry => entry?.x === x && entry?.y === y) || null;
  if (!planned || typeof planned.id !== 'string') return null;
  const breach = state.buildingGrid?.[y]?.[x] || null;
  return liveCompletedStructure(breach) && raidStructureId(breach) === planned.id ? breach : null;
}

export function raidRouteNeedsReplan(enemy, state) {
  if (!Array.isArray(enemy?.raidPath) || !enemy.raidIntent) return false;
  return enemy.raidPlanEpoch !== Math.max(0, stableInteger(state.obstacleEpoch, 0))
    || raidIntentTarget(enemy, state) === null;
}

export function replanRaidRoute(enemy, state) {
  const prior = enemy?.raidIntent;
  if (!prior) return null;
  return assignRaidRoute(enemy, {
    state,
    side: prior.side,
    raidIndex: prior.raidIndex,
    firstRaid: prior.firstRaid === 1,
    attackerCount: prior.attackerCount,
    corridorPressure: buildRaidCorridorPressure(state, { exclude: enemy }),
  });
}

export function raidIntentReportLine(enemy) {
  const intent = enemy?.raidIntent;
  if (!intent) return '';
  const targetName = BUILDINGS[intent.targetType]?.name || intent.targetType;
  const direction = ['north', 'east', 'south', 'west'][intent.side] || 'outer';
  let sentence;
  if (intent.routeMode === 'breach') {
    const breachName = BUILDINGS[intent.breachType]?.name || 'barrier';
    sentence = `Scouts read their intent: break the ${breachName} at ${intent.breachX},${intent.breachY} to reach the ${targetName}`;
  } else {
    sentence = `Scouts read their intent: circle to the ${targetName} by an open ${direction} route`;
  }
  const cues = [];
  if (intent.defensePresent === 1) {
    cues.push(intent.exposureCost === 0 ? 'avoiding the tower line' : 'accepting tower fire');
  }
  if (intent.pressurePresent === 1) {
    cues.push(intent.congestionCost === 0 ? 'leaving the committed corridor' : 'sharing the committed corridor');
  }
  if (cues.length === 0) cues.push('favoring the quickest approach');
  return `${sentence}, ${cues.join(' and ')}.`;
}
