// Pure deterministic raid intent planning.
//
// This module deliberately imports no Realm state and touches no platform API.
// Callers provide the complete belief snapshot that a warband is allowed to
// reason about. In particular, presentation-only tile wear and global G state
// cannot influence a plan unless a future caller deliberately promotes an
// authoritative signal into one of the explicit fixed-cost fields below.

export const RAID_PLANNER_CONTRACT = Object.freeze({
  version: 1,
  maxWidth: 80,
  maxHeight: 80,
  fixedCostScale: 1000,
  diagonalCostNumerator: 1414,
  scoreFormula: 'travel + breach + exposure + congestion - value',
});

const {
  maxWidth: MAX_WIDTH,
  maxHeight: MAX_HEIGHT,
  fixedCostScale: FIXED_COST_SCALE,
  diagonalCostNumerator: DIAGONAL_COST_NUMERATOR,
} = RAID_PLANNER_CONTRACT;

const MAX_FIXED_CELL_COST = 1_000_000_000;
const DIRS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
  Object.freeze([0, 1]),
  Object.freeze([-1, -1]),
  Object.freeze([1, -1]),
  Object.freeze([-1, 1]),
  Object.freeze([1, 1]),
]);

class BinaryHeap {
  constructor() {
    this.entries = [];
  }

  get size() {
    return this.entries.length;
  }

  push(entry) {
    this.entries.push(entry);
    this.#bubbleUp(this.entries.length - 1);
  }

  pop() {
    if (this.entries.length === 0) return null;
    const first = this.entries[0];
    const last = this.entries.pop();
    if (this.entries.length > 0) {
      this.entries[0] = last;
      this.#sinkDown(0);
    }
    return first;
  }

  #compare(a, b) {
    return compareCostTuple(a, b) || (a.node - b.node);
  }

  #bubbleUp(index) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#compare(this.entries[parent], this.entries[index]) <= 0) break;
      [this.entries[parent], this.entries[index]] = [this.entries[index], this.entries[parent]];
      index = parent;
    }
  }

  #sinkDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < this.entries.length && this.#compare(this.entries[left], this.entries[best]) < 0) best = left;
      if (right < this.entries.length && this.#compare(this.entries[right], this.entries[best]) < 0) best = right;
      if (best === index) return;
      [this.entries[index], this.entries[best]] = [this.entries[best], this.entries[index]];
      index = best;
    }
  }
}

function compareCostTuple(a, b) {
  return (a.total - b.total)
    || (a.breach - b.breach)
    || (a.exposure - b.exposure)
    || (a.congestion - b.congestion)
    || (a.travel - b.travel);
}

function compareStableStrings(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function isArrayLike(value) {
  return Array.isArray(value)
    || (ArrayBuffer.isView(value) && !(value instanceof DataView));
}

function flattenField(source, width, height) {
  if (!isArrayLike(source)) return null;
  const size = width * height;
  if (source.length === height && height > 0 && isArrayLike(source[0])) {
    const flat = [];
    for (let y = 0; y < height; y++) {
      if (!isArrayLike(source[y]) || source[y].length !== width) return null;
      for (let x = 0; x < width; x++) flat.push(source[y][x]);
    }
    return flat;
  }
  if (source.length !== size) return null;
  return source;
}

function normalizeTopology(grid) {
  if (!grid || typeof grid !== 'object') return null;
  const { width, height } = grid;
  if (!Number.isSafeInteger(width) || width <= 0 || width > MAX_WIDTH) return null;
  if (!Number.isSafeInteger(height) || height <= 0 || height > MAX_HEIGHT) return null;
  const raw = flattenField(grid.cells, width, height);
  if (!raw) return null;
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    const value = Number(raw[i]);
    if (!Number.isSafeInteger(value) || value < 0 || value > 255) return null;
    cells[i] = value === 0 ? 0 : 1;
  }
  return { width, height, cells };
}

function normalizeFixedField(source, width, height, fallback) {
  if (source === undefined || source === null) {
    const field = new Float64Array(width * height);
    if (fallback !== 0) field.fill(fallback);
    return field;
  }
  const raw = flattenField(source?.cells ?? source, width, height);
  if (!raw) return null;
  const field = new Float64Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    const value = Number(raw[i]);
    if (!Number.isFinite(value) || value < 0) return null;
    const fixed = Math.round(value);
    if (!Number.isSafeInteger(fixed) || fixed > MAX_FIXED_CELL_COST) return null;
    field[i] = fixed;
  }
  return field;
}

function normalizePoint(point, width, height) {
  if (!point || typeof point !== 'object') return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if (x < 0 || x >= width || y < 0 || y >= height) return null;
  return { x, y };
}

function normalizeApproach(approach) {
  if (typeof approach === 'string' && approach.trim()) return approach.trim();
  if (Number.isSafeInteger(approach)) return String(approach);
  if (approach && typeof approach === 'object') {
    const label = approach.id ?? approach.side ?? approach.edge;
    if (typeof label === 'string' && label.trim()) return label.trim();
    if (Number.isSafeInteger(label)) return String(label);
  }
  return 'unspecified';
}

function fixedDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  const fixed = Math.round(number * FIXED_COST_SCALE);
  return Number.isSafeInteger(fixed) ? fixed : null;
}

function normalizeAttacker(input) {
  const dps = input?.attacker?.dps ?? input?.attackerDps;
  const count = input?.attacker?.count ?? input?.attackerCount;
  const fixedDps = fixedDecimal(dps);
  if (!fixedDps || !Number.isSafeInteger(count) || count <= 0) return null;
  return { fixedDps, count };
}

function normalizeDestructibles(entries, topology, attacker) {
  const byCell = new Map();
  if (entries === undefined || entries === null) return byCell;
  if (!Array.isArray(entries) || entries.length > topology.width * topology.height) return null;

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') return null;
    const rawId = entry.id;
    if ((typeof rawId !== 'string' || !rawId.trim()) && !Number.isSafeInteger(rawId)) return null;
    const id = String(rawId).trim();
    const hpFixed = fixedDecimal(entry.hp);
    if (hpFixed === null) return null;
    const breachCost = Math.ceil(
      (hpFixed * FIXED_COST_SCALE) / (attacker.fixedDps * attacker.count),
    );
    if (!Number.isSafeInteger(breachCost) || breachCost > Number.MAX_SAFE_INTEGER) return null;
    const label = typeof entry.label === 'string' && entry.label.trim()
      ? entry.label.trim()
      : id;
    const rawCells = Array.isArray(entry.cells) ? entry.cells : [entry];
    if (rawCells.length === 0) return null;
    for (const rawPoint of rawCells) {
      const point = normalizePoint(rawPoint, topology.width, topology.height);
      if (!point) return null;
      const node = point.y * topology.width + point.x;
      if (byCell.has(node)) return null;
      byCell.set(node, {
        id,
        label,
        x: point.x,
        y: point.y,
        hpFixed,
        cost: breachCost,
      });
    }
  }
  return byCell;
}

function cellIsOpen(topology, node) {
  return node >= 0 && node < topology.cells.length && topology.cells[node] !== 0;
}

function cellIsEnterable(topology, destructibles, node) {
  return cellIsOpen(topology, node) || destructibles.has(node);
}

function defaultEngagementNodes(objective, topology, destructibles) {
  const center = objective.y * topology.width + objective.x;
  if (cellIsOpen(topology, center) && !destructibles.has(center)) return [center];
  const nodes = [];
  for (let y = objective.y - 1; y <= objective.y + 1; y++) {
    for (let x = objective.x - 1; x <= objective.x + 1; x++) {
      if (x === objective.x && y === objective.y) continue;
      if (x < 0 || x >= topology.width || y < 0 || y >= topology.height) continue;
      const node = y * topology.width + x;
      if (cellIsEnterable(topology, destructibles, node)) nodes.push(node);
    }
  }
  nodes.sort((a, b) => a - b);
  return nodes;
}

function normalizeObjectives(entries, topology, destructibles) {
  if (!Array.isArray(entries)) return null;
  const objectives = [];
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const rawId = entry.id;
    if ((typeof rawId !== 'string' || !rawId.trim()) && !Number.isSafeInteger(rawId)) continue;
    const id = String(rawId).trim();
    if (ids.has(id)) return null;
    const point = normalizePoint(entry, topology.width, topology.height);
    const value = Number(entry.value ?? 0);
    if (!point || !Number.isFinite(value) || value < 0) continue;
    const fixedValue = Math.round(value);
    if (!Number.isSafeInteger(fixedValue) || fixedValue > MAX_FIXED_CELL_COST) continue;

    let engagementNodes;
    if (entry.engagementCells !== undefined) {
      if (!Array.isArray(entry.engagementCells)) continue;
      engagementNodes = [];
      const seen = new Set();
      for (const rawEngagement of entry.engagementCells) {
        const engagement = normalizePoint(rawEngagement, topology.width, topology.height);
        if (!engagement) continue;
        const node = engagement.y * topology.width + engagement.x;
        if (!seen.has(node) && cellIsEnterable(topology, destructibles, node)) {
          seen.add(node);
          engagementNodes.push(node);
        }
      }
      engagementNodes.sort((a, b) => a - b);
    } else {
      engagementNodes = defaultEngagementNodes(point, topology, destructibles);
    }

    ids.add(id);
    objectives.push({
      id,
      label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : id,
      x: point.x,
      y: point.y,
      value: fixedValue,
      engagementNodes,
    });
  }
  objectives.sort((a, b) => compareStableStrings(a.id, b.id));
  return objectives;
}

function searchRoutes({
  topology,
  startNode,
  destructibles,
  travelCosts,
  defenseExposure,
  corridorPressure,
  maxExpanded,
}) {
  const size = topology.width * topology.height;
  const total = new Float64Array(size);
  const travel = new Float64Array(size);
  const breach = new Float64Array(size);
  const exposure = new Float64Array(size);
  const congestion = new Float64Array(size);
  total.fill(Infinity);
  travel.fill(Infinity);
  breach.fill(Infinity);
  exposure.fill(Infinity);
  congestion.fill(Infinity);
  const previous = new Int32Array(size);
  previous.fill(-1);
  const settled = new Uint8Array(size);
  const open = new BinaryHeap();

  const startEntry = {
    node: startNode,
    total: 0,
    travel: 0,
    breach: 0,
    exposure: 0,
    congestion: 0,
  };
  total[startNode] = 0;
  travel[startNode] = 0;
  breach[startNode] = 0;
  exposure[startNode] = 0;
  congestion[startNode] = 0;
  open.push(startEntry);

  let expandedNodes = 0;
  while (open.size > 0 && expandedNodes < maxExpanded) {
    const current = open.pop();
    if (!current || settled[current.node]) continue;
    if (
      current.total !== total[current.node]
      || current.travel !== travel[current.node]
      || current.breach !== breach[current.node]
      || current.exposure !== exposure[current.node]
      || current.congestion !== congestion[current.node]
    ) continue;
    settled[current.node] = 1;
    expandedNodes++;

    const x = current.node % topology.width;
    const y = (current.node / topology.width) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= topology.width || ny < 0 || ny >= topology.height) continue;
      const nextNode = ny * topology.width + nx;
      if (settled[nextNode] || !cellIsEnterable(topology, destructibles, nextNode)) continue;

      // A destructible cell may be entered and paid for. It does not, however,
      // make the orthogonal shoulders of a diagonal open: raiders cannot slip
      // through the corner shared by two closed cells without first occupying
      // and breaching one of them.
      if (dx !== 0 && dy !== 0) {
        const horizontal = y * topology.width + nx;
        const vertical = ny * topology.width + x;
        if (!cellIsOpen(topology, horizontal) || !cellIsOpen(topology, vertical)) continue;
      }

      const stepTravel = dx !== 0 && dy !== 0
        ? Math.round((travelCosts[nextNode] * DIAGONAL_COST_NUMERATOR) / FIXED_COST_SCALE)
        : travelCosts[nextNode];
      const stepBreach = destructibles.get(nextNode)?.cost ?? 0;
      const candidate = {
        node: nextNode,
        travel: current.travel + stepTravel,
        breach: current.breach + stepBreach,
        exposure: current.exposure + defenseExposure[nextNode],
        congestion: current.congestion + corridorPressure[nextNode],
      };
      candidate.total = candidate.travel + candidate.breach + candidate.exposure + candidate.congestion;
      const existing = {
        total: total[nextNode],
        travel: travel[nextNode],
        breach: breach[nextNode],
        exposure: exposure[nextNode],
        congestion: congestion[nextNode],
      };
      const comparison = compareCostTuple(candidate, existing);
      if (comparison > 0) continue;
      if (comparison === 0 && previous[nextNode] !== -1 && current.node >= previous[nextNode]) continue;

      total[nextNode] = candidate.total;
      travel[nextNode] = candidate.travel;
      breach[nextNode] = candidate.breach;
      exposure[nextNode] = candidate.exposure;
      congestion[nextNode] = candidate.congestion;
      previous[nextNode] = current.node;
      open.push(candidate);
    }
  }

  return {
    total,
    travel,
    breach,
    exposure,
    congestion,
    previous,
    expandedNodes,
  };
}

function compareObjectiveChoice(a, b) {
  if (!b) return -1;
  return (a.score - b.score)
    || (a.routeTotal - b.routeTotal)
    || (a.breach - b.breach)
    || (a.exposure - b.exposure)
    || (a.congestion - b.congestion)
    || (a.travel - b.travel)
    || compareStableStrings(a.objective.id, b.objective.id)
    || (a.goalNode - b.goalNode);
}

function chooseObjective(objectives, routes) {
  let best = null;
  for (const objective of objectives) {
    for (const goalNode of objective.engagementNodes) {
      if (!Number.isFinite(routes.total[goalNode])) continue;
      const choice = {
        objective,
        goalNode,
        routeTotal: routes.total[goalNode],
        travel: routes.travel[goalNode],
        breach: routes.breach[goalNode],
        exposure: routes.exposure[goalNode],
        congestion: routes.congestion[goalNode],
        score: routes.total[goalNode] - objective.value,
      };
      if (compareObjectiveChoice(choice, best) < 0) best = choice;
    }
  }
  return best;
}

function reconstructPath(startNode, goalNode, previous, width) {
  const nodes = [];
  let cursor = goalNode;
  while (cursor !== -1) {
    nodes.push(cursor);
    if (cursor === startNode) break;
    cursor = previous[cursor];
  }
  if (nodes[nodes.length - 1] !== startNode) return null;
  nodes.reverse();
  return nodes.map(node => ({ x: node % width, y: (node / width) | 0 }));
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function compressWaypoints(path, breachKeys) {
  if (path.length <= 2) return path.slice();
  const waypoints = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const before = path[i - 1];
    const current = path[i];
    const after = path[i + 1];
    const incomingX = Math.sign(current.x - before.x);
    const incomingY = Math.sign(current.y - before.y);
    const outgoingX = Math.sign(after.x - current.x);
    const outgoingY = Math.sign(after.y - current.y);
    if (incomingX !== outgoingX || incomingY !== outgoingY || breachKeys.has(pointKey(current))) {
      waypoints.push(current);
    }
  }
  waypoints.push(path[path.length - 1]);
  return waypoints;
}

function freezePoint(point) {
  return Object.freeze({ x: point.x, y: point.y });
}

function freezeBreach(entry) {
  return Object.freeze({
    id: entry.id,
    label: entry.label,
    x: entry.x,
    y: entry.y,
    hpFixed: entry.hpFixed,
    cost: entry.cost,
  });
}

function freezeCosts(costs) {
  return Object.freeze({
    travel: costs.travel,
    breach: costs.breach,
    exposure: costs.exposure,
    congestion: costs.congestion,
    value: costs.value,
    total: costs.total,
  });
}

function freezePlan(plan) {
  const path = Object.freeze(plan.path.map(freezePoint));
  const waypoints = Object.freeze(plan.waypoints.map(freezePoint));
  const breaches = Object.freeze(plan.breaches.map(freezeBreach));
  return Object.freeze({
    version: RAID_PLANNER_CONTRACT.version,
    status: plan.status,
    reason: plan.reason,
    approach: plan.approach,
    objectiveId: plan.objectiveId,
    objective: plan.objective ? Object.freeze({ ...plan.objective }) : null,
    path,
    waypoints,
    breach: breaches[0] ?? null,
    breaches,
    costs: freezeCosts(plan.costs),
    rationaleTokens: Object.freeze(plan.rationaleTokens.slice()),
    expandedNodes: plan.expandedNodes,
  });
}

function noPlan(reason, approach = 'unspecified', expandedNodes = 0) {
  return freezePlan({
    status: 'no-plan',
    reason,
    approach,
    objectiveId: null,
    objective: null,
    path: [],
    waypoints: [],
    breaches: [],
    costs: { travel: 0, breach: 0, exposure: 0, congestion: 0, value: 0, total: 0 },
    rationaleTokens: [`No raid plan: ${reason}.`],
    expandedNodes,
  });
}

function buildRationale({ approach, objective, breaches, costs, hasExposure, hasPressure }) {
  const tokens = [];
  if (approach !== 'unspecified') tokens.push(`Approach from ${approach}.`);
  tokens.push(`Target ${objective.label}.`);
  if (breaches.length > 0) {
    const first = breaches[0];
    tokens.push(`Breach ${first.label} at ${first.x},${first.y}.`);
    if (breaches.length > 1) tokens.push(`Clear ${breaches.length} destructible cells.`);
  } else {
    tokens.push(`Use an open route to ${objective.label}.`);
  }
  if (hasExposure) {
    tokens.push(costs.exposure === 0
      ? 'Avoid known defensive exposure.'
      : `Accept ${costs.exposure} fixed units of known defensive exposure.`);
  }
  if (hasPressure) {
    tokens.push(costs.congestion === 0
      ? 'Use an uncommitted assault corridor.'
      : `Share ${costs.congestion} fixed units of corridor assignment pressure.`);
  }
  if (costs.value > 0) tokens.push(`Objective value offsets ${costs.value} fixed cost units.`);
  return tokens;
}

/**
 * Plans one deterministic raid intent from an explicit, partial-information
 * snapshot. Unknown object fields are ignored.
 *
 * Required input:
 *   grid: { width, height, cells, travelCosts? }
 *     - cells may be flat or rows; 0 is blocked and non-zero is traversable.
 *     - travelCosts are fixed integer orthogonal-step costs (default 1000).
 *   start: { x, y }
 *   objectives: [{ id, label?, x, y, value?, engagementCells? }]
 *   attacker: { dps, count } (top-level attackerDps/attackerCount also work)
 *
 * Optional input:
 *   approach: stable UI label/edge id
 *   destructibles: [{ id, label?, x, y, hp }] or entries with cells:[{x,y}]
 *   defenseExposure: fixed non-negative cost per cell
 *   corridorPressure: fixed non-negative assignment cost per cell
 *   maxExpanded: explicit search budget, clamped to width * height
 *
 * Objective value is a positive reward. The returned total follows the frozen
 * RAID_PLANNER_CONTRACT score formula.
 */
export function planRaidIntent(input = {}) {
  const approach = normalizeApproach(input.approach);
  const topology = normalizeTopology(input.grid ?? input.snapshot);
  if (!topology) return noPlan('invalid-grid', approach);

  const start = normalizePoint(input.start, topology.width, topology.height);
  if (!start) return noPlan('invalid-start', approach);
  const startNode = start.y * topology.width + start.x;
  if (!cellIsOpen(topology, startNode)) return noPlan('blocked-start', approach);

  const attacker = normalizeAttacker(input);
  if (!attacker) return noPlan('invalid-attacker', approach);
  const destructibles = normalizeDestructibles(input.destructibles, topology, attacker);
  if (!destructibles) return noPlan('invalid-destructibles', approach);

  const objectives = normalizeObjectives(input.objectives, topology, destructibles);
  if (!objectives) return noPlan('invalid-objectives', approach);
  if (objectives.length === 0) return noPlan('no-valid-objectives', approach);

  const travelCosts = normalizeFixedField(
    input.travelCosts ?? input.grid?.travelCosts ?? input.snapshot?.travelCosts,
    topology.width,
    topology.height,
    FIXED_COST_SCALE,
  );
  if (!travelCosts || travelCosts.some(cost => cost <= 0)) return noPlan('invalid-travel-costs', approach);
  const defenseExposure = normalizeFixedField(
    input.defenseExposure,
    topology.width,
    topology.height,
    0,
  );
  if (!defenseExposure) return noPlan('invalid-defense-exposure', approach);
  const corridorPressure = normalizeFixedField(
    input.corridorPressure,
    topology.width,
    topology.height,
    0,
  );
  if (!corridorPressure) return noPlan('invalid-corridor-pressure', approach);

  const requestedBudget = input.maxExpanded === undefined
    ? topology.width * topology.height
    : Math.floor(Number(input.maxExpanded));
  if (!Number.isFinite(requestedBudget) || requestedBudget <= 0) {
    return noPlan('invalid-search-budget', approach);
  }
  const maxExpanded = Math.min(topology.width * topology.height, requestedBudget);
  const routes = searchRoutes({
    topology,
    startNode,
    destructibles,
    travelCosts,
    defenseExposure,
    corridorPressure,
    maxExpanded,
  });
  const choice = chooseObjective(objectives, routes);
  if (!choice) return noPlan('unreachable-objectives', approach, routes.expandedNodes);

  const rawPath = reconstructPath(startNode, choice.goalNode, routes.previous, topology.width);
  if (!rawPath) return noPlan('unreachable-objectives', approach, routes.expandedNodes);
  const breachEntries = [];
  const breachKeys = new Set();
  for (let i = 1; i < rawPath.length; i++) {
    const point = rawPath[i];
    const entry = destructibles.get(point.y * topology.width + point.x);
    if (!entry) continue;
    breachEntries.push(entry);
    breachKeys.add(pointKey(point));
  }
  const rawWaypoints = compressWaypoints(rawPath, breachKeys);
  const costs = {
    travel: choice.travel,
    breach: choice.breach,
    exposure: choice.exposure,
    congestion: choice.congestion,
    value: choice.objective.value,
    total: choice.score,
  };
  const rationaleTokens = buildRationale({
    approach,
    objective: choice.objective,
    breaches: breachEntries,
    costs,
    hasExposure: defenseExposure.some(value => value > 0),
    hasPressure: corridorPressure.some(value => value > 0),
  });

  return freezePlan({
    status: 'planned',
    reason: null,
    approach,
    objectiveId: choice.objective.id,
    objective: {
      id: choice.objective.id,
      label: choice.objective.label,
      x: choice.objective.x,
      y: choice.objective.y,
    },
    path: rawPath,
    waypoints: rawWaypoints,
    breaches: breachEntries,
    costs,
    rationaleTokens,
    expandedNodes: routes.expandedNodes,
  });
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function canonicalPlanDecision(plan) {
  const path = Array.isArray(plan?.path)
    ? plan.path.map(point => `${point.x},${point.y}`).join(';')
    : '';
  const breaches = Array.isArray(plan?.breaches)
    ? plan.breaches.map(entry => `${entry.id}@${entry.x},${entry.y}:${entry.cost}`).join(';')
    : '';
  const costs = plan?.costs ?? {};
  return [
    `v=${plan?.version ?? ''}`,
    `status=${plan?.status ?? ''}`,
    `reason=${plan?.reason ?? ''}`,
    `approach=${plan?.approach ?? ''}`,
    `objective=${plan?.objectiveId ?? ''}`,
    `path=${path}`,
    `breaches=${breaches}`,
    `travel=${costs.travel ?? ''}`,
    `breach=${costs.breach ?? ''}`,
    `exposure=${costs.exposure ?? ''}`,
    `congestion=${costs.congestion ?? ''}`,
    `value=${costs.value ?? ''}`,
    `total=${costs.total ?? ''}`,
  ].join('|');
}

// Compact, immutable proof surface for save/replay fixtures and browser probes.
// The fingerprint intentionally excludes presentation labels, rationale copy,
// expansion count, and unknown input fields: it hashes only the chosen intent.
export function raidPlanDiagnostics(plan) {
  const validPlan = plan && typeof plan === 'object' ? plan : noPlan('invalid-plan');
  return Object.freeze({
    version: RAID_PLANNER_CONTRACT.version,
    status: validPlan.status,
    objectiveId: validPlan.objectiveId,
    pathLength: Array.isArray(validPlan.path) ? validPlan.path.length : 0,
    waypointCount: Array.isArray(validPlan.waypoints) ? validPlan.waypoints.length : 0,
    breachCount: Array.isArray(validPlan.breaches) ? validPlan.breaches.length : 0,
    expandedNodes: Number.isSafeInteger(validPlan.expandedNodes) ? validPlan.expandedNodes : 0,
    fingerprint: `raid-plan-v1-${fnv1a32(canonicalPlanDecision(validPlan))}`,
  });
}
