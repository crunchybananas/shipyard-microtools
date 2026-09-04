#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  G, BUILDINGS, MAP_W, MAP_H, createResourceStock, setSeed,
} from '../js/state.js?realm=198';
import { generateWorld } from '../js/world.js?realm=198';
import {
  depositFood,
  depositResource,
  establishFounderStockpile,
  findReachableFoodStore,
  foodCapacity,
  foodConservationReport,
  foodSpace,
  storedFood,
  storedResource,
  resourceConservationReport,
  withdrawFood,
  withdrawFoodFromStores,
} from '../js/building-inventory.js?realm=198';
import { getFirstMusterReport } from '../js/first-muster.js?realm=198';
import { plunderBuildingFood, plunderBuildingSupplies, updateEnemies } from '../js/combat.js?realm=198';
import { removeBuilding } from '../js/building-lifecycle.js?realm=198';
import { serializeGame, prepareSave, commitGameLoad } from '../js/save-state.js?realm=198';
import { executeTrade } from '../js/trade.js?realm=198';
import { startResearch } from '../js/tech.js?realm=198';
import { decodeGraphState, encodeGraphState, makeEnvelope } from '../js/save-schema.js?realm=198';

function completeBuilding(type, x, y, extras = {}) {
  return {
    type, x, y, hp: 100, active: true, prodTimer: 0, produced: null,
    prodShowCount: 0, level: 1, buildProgress: 1, buildTotal: 1,
    buildStartedAt: 0, completeTick: 0, ...extras,
  };
}

function localState(buildings = []) {
  return { buildings, resources: { food: 0 } };
}

function resetFreshRealm(seed = 190, food = 80) {
  G.buildings = [];
  G.citizens = [];
  G.soldiers = [];
  G.enemies = [];
  G.projectiles = [];
  G.walkers = [];
  G.caravans = [];
  G.animals = [];
  G.resources = createResourceStock({ wood: 60, stone: 30, food, gold: 25 });
  G.storyFlags = {};
  G.scenario = 'military_rise';
  G.storyState = { lastProverbSeason: null, raid: null };
  G.stats = {
    buildingsBuilt: 0, buildingsLost: 0, raidsFaced: 0,
    citizensBorn: 0, citizensDied: 0, raidsSurvived: 0,
    enemiesKilled: 0, goldEarned: 0, daysLived: 0,
    housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
  };
  G.obstacleEpoch = 0;
  G.nextActorId = 1;
  G._undoStack = [];
  G._raidStolen = null;
  G._raidSpawnCount = 0;
  G.notificationLog = [];
  G.chronicle = [];
  G.particles = [];
  setSeed(seed);
  generateWorld();
  return establishFounderStockpile();
}

function putLiveBuilding(building) {
  G.buildings.push(building);
  G.buildingGrid[building.y][building.x] = building;
  return building;
}

function resetCombatRealm() {
  G.buildings = [];
  G.citizens = [];
  G.soldiers = [];
  G.enemies = [];
  G.projectiles = [];
  G.walkers = [];
  G.caravans = [];
  G.animals = [];
  G.carts = [];
  G.schoolKids = [];
  G.resources = createResourceStock();
  G.buildingGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  G.stats = {
    buildingsBuilt: 0, buildingsLost: 0, raidsFaced: 0,
    citizensBorn: 0, citizensDied: 0, raidsSurvived: 0,
    enemiesKilled: 0, goldEarned: 0, daysLived: 0,
    housesEvolved: 0, scenariosWon: [], everHadBuilding: {},
  };
  G.maxPop = 0;
  G.defense = 0;
  G.obstacleEpoch = 0;
  G._undoStack = [];
  G._raidStolen = null;
  G._raidSpawnCount = 0;
  G.selectedBuilding = null;
  G._refreshPanelFor = null;
  G.particles = [];
  G.notificationLog = [];
  G.day = 1;
  G.gameTick = 1;
}

// Capacity, exact aggregate mirroring, full/empty behavior, and reachability.
{
  const house = completeBuilding('house', 1, 0);
  const granary = completeBuilding('granary', 0, 1);
  const store = completeBuilding('storehouse', 2, 0);
  const founder = completeBuilding('storehouse', 3, 0, { founderStockpile: true });
  const incomplete = { ...completeBuilding('storehouse', 4, 0), buildProgress: 0 };
  const state = localState([house, granary, store, founder, incomplete]);

  assert.equal(foodCapacity(house), 8);
  assert.equal(foodCapacity(granary), 30);
  assert.equal(foodCapacity(store), 40);
  assert.equal(foodCapacity(founder), 120);
  assert.deepEqual(depositFood(incomplete, 3, state), { accepted: 0, remainder: 3, reason: 'invalid-store' });
  assert.deepEqual(depositFood(house, 10, state), { accepted: 8, remainder: 2, reason: 'storage-full' });
  assert.equal(foodSpace(house, state), 0);
  assert.deepEqual(withdrawFood(house, 10, state), { taken: 8, remainder: 2, reason: 'storage-empty' });
  assert.deepEqual(withdrawFood(house, 1, state), { taken: 0, remainder: 1, reason: 'storage-empty' });

  depositFood(house, 1, state);
  depositFood(granary, 1, state);
  assert.equal(findReachableFoodStore({ x: 0, y: 0 }, { state }), house, 'equal-distance lookup uses building order');
  assert.equal(findReachableFoodStore({ x: 0, y: 0 }, {
    state,
    isReachable: building => building !== house,
  }), granary, 'unreachable nearest store is skipped');
  assert.equal(findReachableFoodStore({ x: 0, y: 0 }, {
    state,
    isReachable: () => false,
  }), null);
  assert.equal(withdrawFoodFromStores(2, { state }).taken, 2);
  assert.deepEqual(foodConservationReport(state), {
    wallet: 0, stored: 0, delta: 0, conserved: true, invalid: [],
  });
}

// Same seed produces the same free stockpile; it owns exact starting food and
// is not a player-built food source for First Muster.
function founderFingerprint() {
  const founder = resetFreshRealm(99190, 80);
  return JSON.stringify({
    x: founder.x, y: founder.y, food: storedFood(founder),
    capacity: foodCapacity(founder), wallet: G.resources.food,
    stats: G.stats.buildingsBuilt,
    firstMuster: getFirstMusterReport(G).primary.id,
  });
}
const firstFounder = founderFingerprint();
const secondFounder = founderFingerprint();
assert.equal(firstFounder, secondFounder, 'same-seed founder stockpile must be deterministic');
assert.deepEqual(JSON.parse(firstFounder), {
  x: Math.floor(MAP_W / 2) + 3,
  y: Math.floor(MAP_H / 2),
  food: 80,
  capacity: 120,
  wallet: 80,
  stats: 0,
  firstMuster: 'food_source',
});

// Physical inventory and live graph references survive an immediate save and
// continue from the exact aggregate, including a citizen's routed food target.
{
  const founder = G.buildings.find(building => building.founderStockpile);
  const citizen = G.citizens[0];
  citizen._foodTarget = founder;
  const before = foodConservationReport(G);
  const envelope = serializeGame({ savedAt: 0 });
  const incompatibleGame = decodeGraphState(envelope.state);
  delete incompatibleGame.storyFlags.physicalFoodInventory;
  const incompatibleEnvelope = makeEnvelope(encodeGraphState(
    incompatibleGame,
    envelope.state.roots.rngSeed,
    envelope.state.roots.missions,
  ), 0);
  const incompatible = prepareSave(incompatibleEnvelope);
  assert.equal(incompatible.ok, false, 'unmarked development save was silently migrated');
  assert.equal(incompatible.error.code, 'inconsistent-state');
  assert.equal(incompatible.error.path, '$.state.game.storyFlags.physicalFoodInventory');

  const prepared = prepareSave(envelope);
  assert.equal(prepared.ok, true, prepared.error?.message);
  G.resources.food = 0;
  const committed = commitGameLoad(prepared.value);
  assert.equal(committed.ok, true, committed.error?.message);
  const loadedFounder = G.buildings.find(building => building.founderStockpile);
  assert.ok(loadedFounder);
  assert.equal(G.citizens[0]._foodTarget, loadedFounder);
  assert.deepEqual(foodConservationReport(G), before);
}

// Raiders sack only the struck building. Killing one recovers its bag into
// available capacity once and closes even a zero-valued raid ledger.
{
  resetCombatRealm();
  const attacked = putLiveBuilding(completeBuilding('storehouse', 40, 40));
  const untouched = putLiveBuilding(completeBuilding('house', 41, 40));
  depositFood(attacked, 6);
  depositFood(untouched, 4);
  const enemy = { x: 40, y: 40, hp: 1, plundered: 0 };
  const totalBefore = G.resources.food;
  assert.equal(plunderBuildingFood(enemy, attacked, 2), 2);
  assert.equal(storedFood(attacked), 4);
  assert.equal(storedFood(untouched), 4);
  assert.equal(G.resources.food + enemy.loot.food, totalBefore, 'plunder moves food into the bag without creating it');
  enemy.hp = 0;
  G.enemies.push(enemy);
  updateEnemies();
  assert.equal(G.resources.food, totalBefore);
  assert.equal(G._raidStolen, null);
  const notices = G.notificationLog.length;
  updateEnemies();
  assert.equal(G.notificationLog.length, notices, 'terminal recovery and ledger close happen exactly once');
  assert.equal(foodConservationReport(G).conserved, true);
}

// If every pantry is full before the raider falls, unrecovered loot is lost,
// reported once, and never minted into the wallet or leaked into a later raid.
{
  resetCombatRealm();
  const pantry = putLiveBuilding(completeBuilding('house', 40, 40));
  depositFood(pantry, 8);
  const enemy = { x: 40, y: 40, hp: 1, plundered: 0 };
  plunderBuildingFood(enemy, pantry, 2);
  depositFood(pantry, 2); // new production fills the vacated slots
  const totalBeforeDeath = G.resources.food + enemy.loot.food;
  enemy.hp = 0;
  G.enemies.push(enemy);
  updateEnemies();
  assert.equal(G.resources.food, 8);
  assert.ok(G.resources.food < totalBeforeDeath, 'capacity-limited recovery loses overflow rather than creating storage');
  assert.equal(G._raidStolen, null);
  assert.equal(G.notificationLog.filter(entry => entry.text.includes('could not all be stored')).length, 1);
  updateEnemies();
  assert.equal(G.notificationLog.filter(entry => entry.text.includes('could not all be stored')).length, 1);
}

// Valuable production-chain stock is real raid loot too. Sack order is
// deterministic, the bag conserves every physical mirror, and killing the
// carrier returns each good only to compatible storage.
{
  resetCombatRealm();
  const attacked = putLiveBuilding(completeBuilding('storehouse', 40, 40));
  depositResource(attacked, 'food', 1);
  depositResource(attacked, 'flour', 2);
  depositResource(attacked, 'wheat', 3);
  const enemy = { x: 40, y: 40, hp: 1, plundered: 0 };
  assert.equal(plunderBuildingSupplies(enemy, attacked, 4), 4);
  assert.deepEqual(enemy.loot, { food: 1, flour: 2, wheat: 1 });
  assert.equal(storedResource(attacked, 'food'), 0);
  assert.equal(storedResource(attacked, 'flour'), 0);
  assert.equal(storedResource(attacked, 'wheat'), 2);
  assert.deepEqual(G._raidStolen, { food: 1, flour: 2, wheat: 1 });
  enemy.hp = 0;
  G.enemies.push(enemy);
  updateEnemies();
  assert.deepEqual(
    {
      food: storedResource(attacked, 'food'),
      flour: storedResource(attacked, 'flour'),
      wheat: storedResource(attacked, 'wheat'),
    },
    { food: 1, flour: 2, wheat: 3 },
  );
  assert.equal(G._raidStolen, null);
  for (const resource of ['food', 'wheat', 'flour']) {
    assert.equal(resourceConservationReport(resource, G).conserved, true);
  }
}

// Manual demolition relocates what fits and debits discarded overflow. A free
// founder stockpile never mints the ordinary Storehouse material refund.
{
  resetCombatRealm();
  const source = putLiveBuilding(completeBuilding('house', 40, 40));
  const destination = putLiveBuilding(completeBuilding('storehouse', 41, 40));
  depositFood(source, 6);
  depositFood(destination, 39);
  removeBuilding(source, { cause: 'manual' });
  assert.equal(storedFood(destination), 40);
  assert.equal(G.resources.food, 40, 'five overflow rations are discarded exactly once');
  assert.equal(foodConservationReport(G).conserved, true);

  resetCombatRealm();
  G.resources.wood = 7;
  G.resources.stone = 3;
  const founder = putLiveBuilding(completeBuilding('storehouse', 40, 40, { founderStockpile: true }));
  depositFood(founder, 2);
  removeBuilding(founder, { cause: 'manual' });
  assert.equal(G.resources.food, 0);
  assert.equal(G.resources.wood, 7);
  assert.equal(G.resources.stone, 3);
}

// Existing strategic sinks and trade keep their semantics while paying into
// and out of real storage; a full receiving store rejects a trade atomically.
{
  resetCombatRealm();
  const store = putLiveBuilding(completeBuilding('storehouse', 40, 40));
  depositFood(store, 20);
  assert.deepEqual(executeTrade('orisk', 'food', 10), { given: 10, received: 3, export: 'iron' });
  assert.equal(storedFood(store), 10);
  assert.equal(G.resources.food, 10);
  assert.equal(G.resources.iron, 3);

  G.resources.gold = 10;
  assert.deepEqual(executeTrade('meridian', 'gold', 10), { given: 10, received: 30, export: 'food' });
  assert.equal(storedFood(store), 40);
  G.resources.gold = 1;
  const beforeFullTrade = { gold: G.resources.gold, food: G.resources.food };
  assert.equal(executeTrade('meridian', 'gold', 1), false);
  assert.deepEqual({ gold: G.resources.gold, food: G.resources.food }, beforeFullTrade);
  assert.equal(foodConservationReport(G).conserved, true);

  withdrawFood(store, 20);
  G.researchedTechs = new Set(['agriculture', 'forestry', 'commerce']);
  G.currentResearch = null;
  G.era = 2;
  G.resources.gold = 15;
  assert.equal(startResearch('brewing'), true);
  assert.equal(G.resources.food, 0);
  assert.equal(storedFood(store), 0);
  assert.equal(G.resources.gold, 0);
  assert.equal(foodConservationReport(G).conserved, true);
}

assert.deepEqual(BUILDINGS.farm.prod, { food: 1, wheat: 3 }, 'Farm must truthfully provide a direct ration and bulk wheat');

console.log('[building-inventory] OK — deterministic founder stock, capacities, reachability, conservation, save/continue, trade/research, local plunder, recovery, and demolition');
