#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G,
  MAP_H,
  MAP_W,
  TILE,
  createResourceStock,
  setSeed,
} from '../js/state.js?realm=198';
import { updateEnemies } from '../js/combat.js?realm=198';
import { checkRaids, updateFires } from '../js/economy.js?realm=198';
import { removeBuilding } from '../js/building-lifecycle.js?realm=198';
import { raidTargetForIndex } from '../js/raid-targeting.js?realm=198';
import {
  RAID_ROUTE_CONTRACT,
  RAID_ROUTE_ENEMY_FIELDS,
  assignRaidRoute,
  buildRaidPlanningSnapshot,
  findRaidLandfallApproaches,
  raidIntentReportLine,
  raidObjectiveValue,
  raidStructureId,
} from '../js/raid-intelligence.js?realm=198';

function freshStats(raidsFaced = 0) {
  return {
    buildingsBuilt: 0,
    buildingsLost: 0,
    raidsFaced,
    citizensBorn: 0,
    citizensDied: 0,
    raidsSurvived: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    daysLived: 0,
    housesEvolved: 0,
    scenariosWon: [],
    everHadBuilding: {},
  };
}

function resetWorld(fill = TILE.MOUNTAIN, raidsFaced = 0) {
  G.map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
  G.fog = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(true));
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.buildings = [];
  G.enemies = [];
  G.soldiers = [];
  G.citizens = [];
  G.projectiles = [];
  G.particles = [];
  G.deathMarkers = [];
  G.resources = createResourceStock();
  G.population = 0;
  G.maxPop = 0;
  G.nextActorId = 1;
  G.stats = freshStats(raidsFaced);
  G.storyFlags = {};
  G.storyState = { lastProverbSeason: null, raid: null };
  G.namedCharacters = {};
  G.scenario = 'peaceful_start';
  G.difficulty = 'normal';
  G.researchedTechs = new Set(['agriculture', 'forestry']);
  G.era = 1;
  G.day = 8;
  G.dayPhase = 0;
  G.dayLength = 3600;
  G.gameTick = 1;
  G.nextRaidDay = 8;
  G.raidInterval = 8;
  G.obstacleEpoch = 1;
  G.defense = 0;
  G._raidSide = 3;
  G._raidSpawnCount = 0;
  G._raidStolen = null;
  G._raidWarningGiven = false;
  G._lastRaidFireDay = null;
  G._undoStack = [];
  G.notificationLog = [];
  G.selectedCitizenId = null;
  G.selectedBuilding = null;
  G.armyStance = 'defend';
  G.rallyPoint = null;
}

function makeBuilding(type, x, y, hp = 100, inventory = undefined) {
  const building = {
    type,
    x,
    y,
    hp,
    active: true,
    buildProgress: 1,
    buildTotal: 1,
    buildStartedAt: 0,
    completeTick: 0,
    level: 1,
    prodTimer: 0,
    produced: null,
    prodShowCount: 0,
  };
  if (inventory) building.inventory = { ...inventory };
  return building;
}

function put(building) {
  G.buildings.push(building);
  G.buildingGrid[building.y][building.x] = building;
  return building;
}

function makeRaider(x, y) {
  return {
    x,
    y,
    tx: x,
    ty: y,
    hp: 30,
    maxHp: 30,
    damage: 7,
    plunderGoal: 30,
    type: 'raider',
    state: 'approach',
    variant: 0,
  };
}

function setGround(x, y) {
  G.map[y][x] = TILE.GRASS;
}

function carveRow(y, fromX, toX) {
  for (let x = fromX; x <= toX; x++) setGround(x, y);
}

function pathHas(enemy, x, y) {
  return enemy.raidPath?.some(point => point.x === x && point.y === y) || false;
}

function assignFirstRoute(enemy, target, attackerCount = 1) {
  return assignRaidRoute(enemy, {
    state: G,
    side: 3,
    raidIndex: 0,
    firstRaid: true,
    attackerCount,
    forcedTarget: target,
  });
}

function wallGapFixture(wallHp) {
  resetWorld();
  carveRow(40, 10, 20);
  carveRow(39, 14, 16);
  const wall = put(makeBuilding('wall', 15, 40, wallHp));
  const target = put(makeBuilding('storehouse', 20, 40));
  const enemy = makeRaider(10, 40);
  const plan = assignFirstRoute(enemy, target);
  assert.ok(plan, 'wall-gap fixture did not plan');
  G.enemies = [enemy];
  return { wall, target, enemy, plan };
}

function runUntilTargetHit(target, enemy, limit = 1600) {
  let ticks = 0;
  let minimumY = enemy.y;
  while (target.hp === 100 && G.enemies.includes(enemy) && ticks < limit) {
    G.gameTick++;
    updateEnemies();
    minimumY = Math.min(minimumY, enemy.y);
    ticks++;
  }
  return { ticks, minimumY };
}

// An authored offshore spawn reaches the locally connected coast through a
// real, adjacent water route. A much shallower but disconnected promontory
// cannot steal the landfall, and live movement never tunnels through the
// mountain or wall beside the channel.
resetWorld(TILE.MOUNTAIN);
for (const [x, y] of [[0, 40], [1, 40], [1, 39], [2, 39], [3, 39]]) G.map[y][x] = TILE.WATER;
carveRow(39, 4, 10);
setGround(1, 8);
setGround(2, 40);
const channelWall = put(makeBuilding('wall', 2, 40));
const coastalTarget = put(makeBuilding('storehouse', 10, 39));
const coastalRaider = makeRaider(0, 40);
const approaches = findRaidLandfallApproaches(G, coastalRaider, 3);
assert.deepEqual(approaches[0].landfall, { x: 4, y: 39 }, 'landfall drifted to a disconnected shallow coast');
assert.deepEqual(
  approaches[0].path,
  [[0, 40], [1, 40], [1, 39], [2, 39], [3, 39], [4, 39]].map(([x, y]) => ({ x, y })),
  'coastal approach did not preserve its exact water corridor',
);
assert.ok(assignFirstRoute(coastalRaider, coastalTarget));
assert.deepEqual(coastalRaider.raidPath.slice(0, 6), approaches[0].path);
for (let index = 1; index < coastalRaider.raidPath.length; index++) {
  const before = coastalRaider.raidPath[index - 1];
  const after = coastalRaider.raidPath[index];
  assert.equal(Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y)), 1, 'raid route contains a jump');
}
G.enemies = [coastalRaider];
let coastalTicks = 0;
while (coastalTarget.hp === 100 && coastalTicks < 1800) {
  G.gameTick++;
  updateEnemies();
  const x = Math.round(coastalRaider.x);
  const y = Math.round(coastalRaider.y);
  assert.notEqual(G.map[y]?.[x], TILE.MOUNTAIN, 'live raider entered mountain terrain');
  const occupied = G.buildingGrid[y]?.[x];
  assert.ok(!occupied || occupied.type === 'road', 'live raider tunnelled through a non-road building');
  coastalTicks++;
}
assert.ok(coastalTicks < 1800, 'coast-aware raider never reached its objective');
assert.equal(channelWall.hp, 100, 'coast-aware route struck the wall outside its channel');

// A healthy wall with a nearby one-row gap must produce and execute an open
// route. Merely placing the wall on the straight line may not damage it.
const healthy = wallGapFixture(100);
assert.equal(healthy.enemy.raidIntent.routeMode, 'open');
assert.equal(healthy.enemy.raidIntent.breachId, '');
assert.equal(pathHas(healthy.enemy, 15, 39), true, 'planner did not select the nearby gap');
assert.equal(pathHas(healthy.enemy, 15, 40), false, 'planner path crossed the healthy wall');
const healthyRun = runUntilTargetHit(healthy.target, healthy.enemy);
assert.ok(healthyRun.ticks < 1600, 'gap-following raider became stuck');
assert.ok(healthyRun.minimumY < 39.4, 'live movement did not visibly take the upper gap');
assert.equal(healthy.wall.hp, 100, 'raider damaged a wall outside its plan');
assert.ok(healthy.target.hp < 100, 'raider did not attack from the target engagement ring');

// The same geometry with a weak barrier must deliberately name, reach, and
// destroy that breach before continuing to the target.
const weak = wallGapFixture(0.2);
assert.equal(weak.enemy.raidIntent.routeMode, 'breach');
assert.equal(weak.enemy.raidIntent.breachId, raidStructureId(weak.wall));
assert.deepEqual(
  { x: weak.enemy.raidIntent.breachX, y: weak.enemy.raidIntent.breachY },
  { x: 15, y: 40 },
);
const weakRun = runUntilTargetHit(weak.target, weak.enemy);
assert.ok(weakRun.ticks < 1600, 'breaching raider became stuck');
assert.equal(G.buildings.includes(weak.wall), false, 'planned weak wall was not breached');
assert.ok(weak.wall.hp <= 0);
assert.ok(weak.target.hp < 100, 'raider did not resume after the topology-changing breach');

// Ordered breach intent is preserved for a route through more than one weak
// barrier. Combat may strike only those exact ids/cells, then topology-driven
// replanning carries the still-live remainder forward.
resetWorld();
carveRow(40, 10, 20);
const firstWall = put(makeBuilding('wall', 14, 40, 0.2));
const secondWall = put(makeBuilding('wall', 16, 40, 0.2));
const doubleTarget = put(makeBuilding('storehouse', 20, 40));
const doubleBreacher = makeRaider(10, 40);
assert.ok(assignFirstRoute(doubleBreacher, doubleTarget));
assert.deepEqual(
  doubleBreacher.raidBreaches,
  [firstWall, secondWall].map(wall => ({ id: raidStructureId(wall), x: wall.x, y: wall.y })),
  'multi-breach route did not persist its ordered exact blockers',
);
G.enemies = [doubleBreacher];
const doubleRun = runUntilTargetHit(doubleTarget, doubleBreacher, 2000);
assert.ok(doubleRun.ticks < 2000, 'multi-breach raider became stuck');
assert.equal(G.buildings.includes(firstWall), false, 'first planned breach survived');
assert.equal(G.buildings.includes(secondWall), false, 'second planned breach survived');
assert.ok(doubleTarget.hp < 100, 'multi-breach raider never resumed toward its objective');

// One strategic sack completes the whole warband's mission. The wingman has a
// distinct valid objective but must withdraw before touching it.
resetWorld(TILE.GRASS);
const sackedTarget = put(makeBuilding('storehouse', 12, 40, 5));
const sparedWorkshop = put(makeBuilding('lumber', 15, 40));
const objectiveRaider = makeRaider(10, 40);
const wingman = makeRaider(14, 40);
wingman.attackTimer = 10_000;
assert.ok(assignFirstRoute(objectiveRaider, sackedTarget));
assert.ok(assignFirstRoute(wingman, sparedWorkshop));
G.enemies = [wingman, objectiveRaider];
G._raidSpawnCount = 2;
let sackTicks = 0;
while (G.buildings.includes(sackedTarget) && sackTicks < 500) {
  G.gameTick++;
  updateEnemies();
  sackTicks++;
}
assert.ok(sackTicks < 500, 'raider never completed its selected objective');
assert.equal(objectiveRaider.retreating, true, 'successful sacker did not withdraw');
assert.equal(wingman.retreating, true, 'shared success did not withdraw the whole warband');
assert.equal(objectiveRaider.raidPath, undefined, 'withdrawal retained an attack route');
assert.equal(wingman.raidPath, undefined, 'wingman withdrawal retained an attack route');
for (let tick = 0; tick < 30; tick++) {
  G.gameTick++;
  updateEnemies();
}
assert.equal(sparedWorkshop.hp, 100, 'successful sacker chained into an unrelated workshop');

// Plunder is also a shared ambition. Two partial loads can fill the band goal
// even though neither individual raider reached that amount alone.
resetWorld(TILE.GRASS);
const lootTarget = put(makeBuilding('storehouse', 12, 40, 100, { food: 4 }));
G.resources.food = 4;
const firstLooter = makeRaider(11, 40);
const secondLooter = makeRaider(11, 41);
firstLooter.plunderGoal = 3;
secondLooter.plunderGoal = 3;
assert.ok(assignFirstRoute(firstLooter, lootTarget, 2));
assert.ok(assignFirstRoute(secondLooter, lootTarget, 2));
G.enemies = [firstLooter, secondLooter];
G._raidSpawnCount = 2;
for (let ticks = 0; ticks < 120 && !G.enemies.every(enemy => enemy.retreating); ticks++) {
  G.gameTick++;
  updateEnemies();
}
assert.ok(G.enemies.every(enemy => enemy.retreating), 'shared plunder did not withdraw the band');
assert.equal(firstLooter.plundered, 2);
assert.equal(secondLooter.plundered, 2);
assert.equal(G._raidStolen.food, 4);
assert.equal(lootTarget.hp, 86, 'shared plunder required an extra attack cycle');

// Raid-started fire resolves the same shared objective before the next enemy
// action. This also proves a non-objective wingman cannot squeeze in one last
// hit merely because it appears later in the action order.
resetWorld(TILE.GRASS);
const burningTarget = put(makeBuilding('storehouse', 12, 40, 0.25));
const fireSparedTarget = put(makeBuilding('farm', 15, 40));
const fireOwner = makeRaider(10, 40);
const fireWingman = makeRaider(14, 40);
assert.ok(assignFirstRoute(fireOwner, burningTarget));
assert.ok(assignFirstRoute(fireWingman, fireSparedTarget));
G.enemies = [fireOwner, fireWingman];
G._raidSpawnCount = 2;
burningTarget.onFire = true;
burningTarget._fireTimer = 0;
setSeed(1);
updateFires();
assert.equal(G.buildings.includes(burningTarget), false, 'raid objective did not burn down');
assert.ok(G.enemies.every(enemy => enemy.retreating), 'fire-completed objective did not withdraw the band');
G.gameTick++;
updateEnemies();
assert.equal(fireSparedTarget.hp, 100, 'wingman attacked after fire completed the shared objective');

// A topology epoch change replans once around a newly completed wall. Losing
// the objective then deterministically retargets through the same bounded path
// surface instead of walking toward stale tx/ty coordinates.
resetWorld(TILE.GRASS);
const topologyTarget = put(makeBuilding('storehouse', 20, 40));
const fallbackTarget = put(makeBuilding('farm', 24, 40));
const topologyRaider = makeRaider(10, 40);
assert.ok(assignFirstRoute(topologyRaider, topologyTarget));
G.enemies = [topologyRaider];
const originalEpoch = topologyRaider.raidPlanEpoch;
const newWall = put(makeBuilding('wall', 15, 40, 100));
G.obstacleEpoch++;
G.gameTick++;
updateEnemies();
assert.equal(topologyRaider.raidPlanEpoch, G.obstacleEpoch, 'topology invalidation did not refresh the route epoch');
assert.notEqual(topologyRaider.raidPlanEpoch, originalEpoch);
assert.equal(pathHas(topologyRaider, newWall.x, newWall.y), false, 'topology replan retained the healthy wall cell');
assert.equal(topologyRaider.raidIntent.objectiveId, raidStructureId(topologyTarget));
removeBuilding(topologyTarget, { cause: 'manual' });
const targetLossEpoch = G.obstacleEpoch;
G.gameTick++;
updateEnemies();
assert.equal(topologyRaider.raidPlanEpoch, targetLossEpoch, 'target loss did not replan at the new epoch');
assert.equal(topologyRaider.raidIntent.objectiveId, raidStructureId(fallbackTarget));
assert.deepEqual({ x: topologyRaider.tx, y: topologyRaider.ty }, { x: fallbackTarget.x, y: fallbackTarget.y });
assert.ok(topologyRaider.raidPath.length <= RAID_ROUTE_CONTRACT.maxPathCells, 'replanned route exceeded its bound');

// Sequential intent assignment feeds the first path back as corridor pressure,
// splitting a geometrically equivalent second raider to the other approach.
resetWorld();
setGround(10, 40);
setGround(11, 40);
setGround(18, 40);
setGround(19, 40);
setGround(20, 40);
carveRow(39, 11, 18);
carveRow(41, 11, 18);
const splitTarget = put(makeBuilding('storehouse', 20, 40));
const northRaider = makeRaider(10, 40);
assert.ok(assignFirstRoute(northRaider, splitTarget, 2));
G.enemies.push(northRaider);
const southRaider = makeRaider(10, 40);
assert.ok(assignFirstRoute(southRaider, splitTarget, 2));
G.enemies.push(southRaider);
assert.equal(pathHas(northRaider, 15, 39), true, 'first stable tie did not take northern corridor');
assert.equal(pathHas(southRaider, 15, 41), true, 'sequential pressure did not split the second route');
assert.equal(southRaider.raidIntent.pressurePresent, 1);

// The enemy route/intent surface is JSON-shaped, bounded, scalar where nested,
// and byte-identical for the same explicit world snapshot.
function deterministicRouteSurface() {
  const fixture = wallGapFixture(0.2);
  const enemy = fixture.enemy;
  const surface = Object.fromEntries(RAID_ROUTE_ENEMY_FIELDS.map(key => [key, enemy[key]]));
  assert.deepEqual(Object.keys(surface), [...RAID_ROUTE_ENEMY_FIELDS]);
  assert.ok(surface.raidPath.length > 0 && surface.raidPath.length <= MAP_W * MAP_H);
  for (const point of surface.raidPath) {
    assert.deepEqual(Object.keys(point).sort(), ['x', 'y']);
    assert.ok(Number.isSafeInteger(point.x) && Number.isSafeInteger(point.y));
  }
  assert.ok(Number.isSafeInteger(surface.raidPathIdx) && surface.raidPathIdx >= 0);
  assert.ok(Number.isSafeInteger(surface.raidPlanEpoch) && surface.raidPlanEpoch >= 0);
  assert.ok(surface.raidBreaches.length <= surface.raidPath.length);
  for (const breach of surface.raidBreaches) {
    assert.deepEqual(Object.keys(breach).sort(), ['id', 'x', 'y']);
    assert.equal(typeof breach.id, 'string');
    assert.ok(Number.isSafeInteger(breach.x) && Number.isSafeInteger(breach.y));
  }
  for (const [key, value] of Object.entries(surface.raidIntent)) {
    assert.ok(
      typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value)),
      `raidIntent.${key} is not a bounded scalar/string`,
    );
    if (typeof value === 'string') assert.ok(value.length <= 80, `raidIntent.${key} string is unbounded`);
  }
  return JSON.stringify(surface);
}
const serialA = deterministicRouteSurface();
const serialB = deterministicRouteSurface();
assert.equal(serialA, serialB, 'same world snapshot produced a different save-shaped route surface');
assert.deepEqual(JSON.parse(serialA), JSON.parse(serialB));

// Snapshot adaptation proves terrain, roads, tower threat, completed
// destructibles, and physical building inventory all enter through explicit
// planner inputs. Global mirror quantities do not contribute to objective value.
resetWorld(TILE.GRASS);
G.map[0][0] = TILE.WATER;
G.map[0][1] = TILE.MOUNTAIN;
const road = put(makeBuilding('road', 31, 30));
const tower = put(makeBuilding('tower', 30, 30));
const stocked = put(makeBuilding('storehouse', 35, 30, 100, { food: 5, wheat: 3, flour: 2 }));
G.resources.food = 999;
G.resources.wheat = 999;
G.resources.flour = 999;
const expectedStockValue = 6 * 20_000 + 5 * 1000 + 3 * 550 + 2 * 800;
assert.equal(raidObjectiveValue(stocked), expectedStockValue);
const adapted = buildRaidPlanningSnapshot(G);
assert.equal(adapted.grid.cells[0], 0, 'water entered the planner as traversable');
assert.equal(adapted.grid.cells[1], 0, 'mountain entered the planner as traversable');
assert.equal(adapted.grid.travelCosts[road.y * MAP_W + road.x], 500, 'road did not receive fixed fast travel');
assert.equal(adapted.grid.travelCosts[29 * MAP_W + 29], 1000, 'ground did not receive fixed base travel');
assert.ok(adapted.defenseExposure[30 * MAP_W + 29] > 0, 'tower created no bounded exposure field');
assert.equal(adapted.defenseExposure[79 * MAP_W + 79], 0, 'tower exposure escaped its bounded radius');
assert.ok(adapted.destructibles.some(entry => entry.id === raidStructureId(tower)));
assert.ok(adapted.destructibles.some(entry => entry.id === raidStructureId(stocked)));
assert.equal(adapted.destructibles.some(entry => entry.id === raidStructureId(road)), false);

// Actual first-raid spawning preserves the legacy objective chosen for each
// index, adds routes immediately, and reports exactly one scout sentence.
resetWorld(TILE.GRASS);
const spawnStore = put(makeBuilding('storehouse', 43, 40));
const spawnFarm = put(makeBuilding('farm', 44, 39));
put(makeBuilding('wall', 45, 40));
G._raidSide = 1;
setSeed(812_440);
const expectedFirstTargets = [0, 1].map(index => raidTargetForIndex(index, G, 1, MAP_W, MAP_H));
checkRaids();
assert.equal(G.enemies.length, 2);
assert.ok(G.enemies.every(enemy => enemy.x === MAP_W - 1), 'charted eastern raid did not visibly spawn on its map edge');
assert.deepEqual(
  G.enemies.map(enemy => ({ x: enemy.tx, y: enemy.ty })),
  expectedFirstTargets.map(target => ({ x: target.x, y: target.y })),
  'first raid no longer preserves raidTargetForIndex objectives',
);
assert.ok(G.enemies.every(enemy => Array.isArray(enemy.raidPath) && enemy.raidIntent?.firstRaid === 1));
const scoutLines = G.notificationLog.filter(entry => entry.text.startsWith('Scouts read their intent:'));
assert.equal(scoutLines.length, 1, 'spawn report must contain one lead-raider intent line');
assert.match(scoutLines[0].text, /Storehouse|Farm/);
assert.match(scoutLines[0].text, /open|break the/);
assert.doesNotMatch(scoutLines[0].text, /travel \d|breach \d|value \d/, 'player toast leaked raw fixed-cost diagnostics');
assert.ok([spawnStore, spawnFarm].includes(expectedFirstTargets[0]));

// Physical cargo in a slain carrier was never stored and therefore cannot be
// credited to a global mirror. Existing nonphysical recovery remains intact.
resetWorld(TILE.GRASS);
function deadCarrier(actorId, resource) {
  return {
    actorId,
    identity: { name: `Carrier ${actorId}`, appearanceId: 'identity-01' },
    profession: { kind: 'settler', sinceTick: 0, reason: 'spawn-settler' },
    assignment: null,
    activity: { kind: 'idle', sinceTick: 0, reason: 'spawn-idle' },
    x: 20,
    y: 20,
    tx: 20,
    ty: 20,
    hp: 0,
    home: null,
    carrying: resource,
    carryAmount: 5,
  };
}
G.citizens = ['food', 'wheat', 'flour', 'wood'].map((resource, index) => deadCarrier(index + 1, resource));
G.population = G.citizens.length;
G.nextActorId = G.citizens.length + 1;
updateEnemies();
assert.equal(G.resources.food, 0, 'dead carrier minted food into the store mirror');
assert.equal(G.resources.wheat, 0, 'dead carrier minted wheat into the store mirror');
assert.equal(G.resources.flour, 0, 'dead carrier minted flour into the store mirror');
assert.equal(G.resources.wood, 5, 'nonphysical cargo recovery regressed');
assert.equal(G.citizens.length, 0);

console.log(`[raid-route-integration] PASS — local coast ${coastalTicks} ticks, healthy gap ${healthyRun.ticks} ticks, deliberate weak breach ${weakRun.ticks} ticks, ordered double breach ${doubleRun.ticks} ticks, shared objective/loot/fire withdrawal, topology/target replans, corridor split, deterministic save surface, tower/loot adaptation, first-raid target compatibility, scout UX, and physical cargo-loss integrity`);
