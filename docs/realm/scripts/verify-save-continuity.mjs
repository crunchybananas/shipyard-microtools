#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const MIDPOINT = 7_200;
const OFFSETS = [0, 1, 60, 3_600];
const FINAL_TICK = MIDPOINT + OFFSETS.at(-1);

function hash(text) {
  return createHash('sha256').update(text).digest('hex');
}

if (process.env.REALM_SAVE_CONTINUITY_CHILD) {
  const mode = process.env.REALM_SAVE_CONTINUITY_CHILD;
  const output = process.env.REALM_SAVE_CONTINUITY_OUTPUT;
  const input = process.env.REALM_SAVE_CONTINUITY_INPUT;
  const { G, setSeed } = await import('../js/state.js?realm=166');
  const { generateWorld } = await import('../js/world.js?realm=166');
  const { coreTick } = await import('../js/sim.js?realm=166');
  const { dispatch } = await import('../js/commands.js?realm=166');
  const { canPlace } = await import('../js/economy.js?realm=166');
  const { initChronicle } = await import('../js/log.js?realm=166');
  const { serializeGame, prepareSave, commitGameLoad } = await import('../js/save-state.js?realm=166');
  const {
    claimCitizenAssignment,
    releaseAssignmentsForBuilding,
    renameCitizen,
    transitionCitizenActivity,
  } = await import('../js/citizen-ownership.js?realm=166');

  function findSpot(type) {
    for (let radius = 0; radius < 25; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (canPlace(type, 40 + dx, 40 + dy)) return { x: 40 + dx, y: 40 + dy };
        }
      }
    }
    throw new Error(`No placement found for ${type}`);
  }

  const schedule = new Map([
    [10, { building: 'house' }],
    [40, { building: 'house' }],
    [90, { building: 'farm' }],
    [140, { building: 'lumber' }],
    [200, { building: 'well' }],
    [260, { building: 'granary' }],
    [400, { building: 'quarry' }],
    [600, { avatar: { x: 48, y: 48 } }],
    [900, { research: 'masonry' }],
    [1_200, { building: 'market' }],
    [5_000, { research: 'commerce' }],
    // Commands after the save prove the consumer follows the same absolute
    // schedule instead of merely coasting from a normalized checkpoint.
    [7_230, { building: 'tavern' }],
    [8_000, { avatar: { x: 34, y: 36 } }],
  ]);

  function applyScheduledCommand(absoluteTick) {
    const command = schedule.get(absoluteTick);
    if (!command) return;
    let result;
    if (command.building) {
      const spot = findSpot(command.building);
      result = dispatch({ type: 'PLACE_BUILDING', building: command.building, ...spot });
    } else if (command.research) {
      result = dispatch({ type: 'START_RESEARCH', tech: command.research });
    } else {
      result = dispatch({ type: 'AVATAR_GOTO', ...command.avatar });
    }
    if (!result.ok) throw new Error(`Scheduled command ${absoluteTick} failed: ${result.reason}`);
  }

  let continuityMatrixInstalled = false;
  function installContinuityMatrix() {
    if (continuityMatrixInstalled) return;
    continuityMatrixInstalled = true;
    const farm = G.buildings.find(building => building.type === 'farm');
    const market = G.buildings.find(building => building.type === 'market');
    const house = G.buildings.find(building => building.type === 'house');
    if (!farm || !market || !house) throw new Error('Continuity matrix requires farm, market, and house');

    // Object key order is simulation state: working consumes the first entry.
    const produced = {};
    produced.stone = 2;
    produced.wood = 1;
    farm.produced = produced;
    const worker = G.citizens[0];
    releaseAssignmentsForBuilding(farm, 'assignment-invalid');
    claimCitizenAssignment(worker, farm, { reason: 'job-market' });
    worker.workTarget = { x: farm.x, y: farm.y };
    worker.carrying = null;
    worker.carryAmount = 0;
    transitionCitizenActivity(worker, 'working', 'work-cycle');
    worker.activityTimer = 1;
    worker.path = null;
    worker.pathIdx = 0;
    worker.tx = worker.x;
    worker.ty = worker.y;
    renameCitizen(worker, 'Continuity Worker', 'player-rename');

    const soldier = {
      x: 32, y: 32, tx: 32, ty: 32,
      homeBuilding: market, garrison: null,
      name: 'Continuity Guard', type: 'swordsman',
      hp: 75, maxHp: 75, state: 'patrol', stateTimer: 50,
    };
    const enemy = {
      x: 32.8, y: 32, tx: 40, ty: 40,
      hp: 30, maxHp: 30, damage: 7, plunderGoal: 42,
      type: 'raider', state: 'approach', variant: 1,
      engaged: soldier, attackTimer: 20, plundered: 3,
    };
    const projectile = {
      x: 4, y: 4, tx: enemy.x, ty: enemy.y,
      target: enemy, damage: 8, life: 500, type: 'arrow',
    };
    G.soldiers = [soldier];
    G.enemies = [enemy];
    G.projectiles = [projectile];
    G.caravans = [{
      x: 20, y: 20, tx: 1, ty: 1,
      homeX: market.x, homeY: market.y,
      phase: 'outbound', gold: 17, building: market, speed: 0.03,
    }];
    market.caravanOut = true;
    G.walkers = [{
      x: 38, y: 38, tx: 39, ty: 38,
      home: market, color: '#ffd166', emoji: '🛒', life: 300,
      visitedHouses: new Set([house]),
    }];
    G.carts = [{
      x: 2, y: 2, tx: market.x, ty: market.y,
      state: 'arriving', stateTimer: 0, market,
      bobPhase: 0.25, path: [{ x: 3, y: 3 }], pathIdx: 0,
    }];
    G._patrolPosts = [market];
    G._patrolPostsBuildingCount = G.buildings.length;
    G._raidSpawnCount = 1;
    G._raidStolen = { gold: 3, food: 2 };
    G._raidSide = 2;
    G._raidWarningGiven = true;
    G.storyState.raid = {
      day: G.day,
      killsStart: G.stats.enemiesKilled,
      deathsStart: G.stats.citizensDied,
    };
    G.debug = { ...(G.debug || {}), disableEvents: true };

  }

  function observe() {
    const worker = G.citizens.find(citizen => citizen.identity.name === 'Continuity Worker');
    const farm = G.buildings.find(building => building.type === 'farm');
    return {
      producedKeys: farm?.produced ? Object.keys(farm.produced) : [],
      workerCargo: worker?.carrying || null,
      workerActorId: worker?.actorId || null,
      workerAssignedByIdentity: worker?.assignment?.building === farm,
      farmHasNoWorkerAuthority: !!farm && !Object.hasOwn(farm, 'workers'),
      projectileTargetLinked: !!G.projectiles[0] && G.projectiles[0].target === G.enemies[0],
      enemyEngagedLinked: !!G.enemies[0] && G.enemies[0].engaged === G.soldiers[0],
      caravanBuildingLinked: !!G.caravans[0] && G.buildings.includes(G.caravans[0].building),
      walkerHomeLinked: !!G.walkers[0] && G.buildings.includes(G.walkers[0].home),
      patrolPostsLinked: Array.isArray(G._patrolPosts) && G._patrolPosts.every(building => G.buildings.includes(building)),
      raidSpawnCount: G._raidSpawnCount,
      raidStoryTracked: Number.isSafeInteger(G.storyState?.raid?.day),
      debugEventsDisabled: G.debug?.disableEvents === true,
      storyFirstMarket: G.storyFlags?.firstMarket === true,
      storyMerchantNamed: typeof G.namedCharacters?.merchant?.name === 'string',
      storyFirstMarketTick: (G.chronicle || []).find(entry => entry.text.includes('Merchants unpack their wares'))?.tick ?? null,
    };
  }

  function capture() {
    return { snapshot: snapshot(), observation: observe() };
  }

  function snapshot() {
    // The canonical writer covers RNG, missions, every persisted G field,
    // typed arrays, paths/watchdogs, all actors, grids, refs, undo/scenario
    // state, and cosmetic collections whose lengths can gate core RNG.
    return JSON.stringify(serializeGame({ savedAt: 0 }));
  }

  function boot() {
    setSeed(12345);
    generateWorld();
    initChronicle();
    G.resources = { wood: 500, stone: 500, food: 500, gold: 500, iron: 50, wheat: 0, flour: 0, planks: 0, tools: 0 };
  }

  function advanceTo(targetTick, captures) {
    while (G.gameTick < targetTick) {
      const absoluteTick = G.gameTick + 1;
      applyScheduledCommand(absoluteTick);
      coreTick();
      if (G.gameTick === MIDPOINT) installContinuityMatrix();
      if (captures.has(G.gameTick)) captures.set(G.gameTick, capture());
    }
  }

  if (mode === 'control') {
    boot();
    const wanted = new Map(OFFSETS.map(offset => [MIDPOINT + offset, null]));
    advanceTo(FINAL_TICK, wanted);
    writeFileSync(output, JSON.stringify(Object.fromEntries(wanted)), 'utf8');
  } else if (mode === 'producer') {
    boot();
    advanceTo(MIDPOINT, new Map());
    writeFileSync(output, snapshot(), 'utf8');
  } else if (mode === 'consumer') {
    const raw = readFileSync(input, 'utf8');
    const prepared = prepareSave(raw);
    if (!prepared.ok) throw new Error(`Consumer preparation failed: ${JSON.stringify(prepared.error)}`);
    const committed = commitGameLoad(prepared.value);
    if (!committed.ok) throw new Error(`Consumer commit failed: ${JSON.stringify(committed.error)}`);
    const wanted = new Map(OFFSETS.map(offset => [MIDPOINT + offset, null]));
    wanted.set(MIDPOINT, capture());
    advanceTo(FINAL_TICK, wanted);
    writeFileSync(output, JSON.stringify(Object.fromEntries(wanted)), 'utf8');
  } else {
    throw new Error(`Unknown child mode: ${mode}`);
  }
  process.exit(0);
}

const directory = mkdtempSync(join(tmpdir(), 'realm-save-continuity-'));
const controlPath = join(directory, 'control.json');
const savePath = join(directory, 'midpoint-save.json');
const consumerPath = join(directory, 'consumer.json');

function run(mode, output, input = '') {
  const result = spawnSync(process.execPath, [thisFile], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      REALM_SAVE_CONTINUITY_CHILD: mode,
      REALM_SAVE_CONTINUITY_OUTPUT: output,
      REALM_SAVE_CONTINUITY_INPUT: input,
    },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${mode} process failed:\n${result.stderr || result.stdout}`);
  }
}

try {
  run('control', controlPath);
  run('producer', savePath);
  run('consumer', consumerPath, savePath);

  const control = JSON.parse(readFileSync(controlPath, 'utf8'));
  const producer = readFileSync(savePath, 'utf8');
  const consumer = JSON.parse(readFileSync(consumerPath, 'utf8'));
  if (control[String(MIDPOINT)].snapshot !== producer) {
    throw new Error(`Producer diverged from uninterrupted control at midpoint: control=${hash(control[String(MIDPOINT)].snapshot)}, producer=${hash(producer)}`);
  }
  for (const offset of OFFSETS) {
    const tick = String(MIDPOINT + offset);
    if (control[tick].snapshot !== consumer[tick].snapshot) {
      throw new Error(`Fresh-process continuity diverged after ${offset} ticks: control=${hash(control[tick].snapshot)}, resumed=${hash(consumer[tick].snapshot)}`);
    }
    if (JSON.stringify(control[tick].observation) !== JSON.stringify(consumer[tick].observation)) {
      throw new Error(`Actor/reference observations diverged after ${offset} ticks`);
    }
    console.log(`✓ save continuity +${offset} ticks (${hash(control[tick].snapshot).slice(0, 16)}…)`);
  }
  const atSave = control[String(MIDPOINT)].observation;
  const afterOne = control[String(MIDPOINT + 1)].observation;
  if (JSON.stringify(atSave.producedKeys) !== JSON.stringify(['stone', 'wood']) || afterOne.workerCargo !== 'stone') {
    throw new Error(`Object key order changed behavior: keys=${JSON.stringify(atSave.producedKeys)}, cargo=${afterOne.workerCargo}`);
  }
  for (const field of [
    'workerAssignedByIdentity', 'farmHasNoWorkerAuthority',
    'projectileTargetLinked', 'enemyEngagedLinked', 'caravanBuildingLinked',
    'walkerHomeLinked', 'patrolPostsLinked', 'raidStoryTracked',
    'debugEventsDisabled',
  ]) {
    if (!atSave[field]) throw new Error(`Continuity matrix did not establish ${field}`);
  }
  if (!Number.isSafeInteger(atSave.workerActorId) || atSave.workerActorId < 1) {
    throw new Error(`Continuity matrix lost the stable worker actor ID: ${atSave.workerActorId}`);
  }
  if (!atSave.storyFirstMarket || !atSave.storyMerchantNamed || atSave.storyFirstMarketTick !== 1_200) {
    throw new Error(`Core story cadence was not preserved at save: ${JSON.stringify({
      firstMarket: atSave.storyFirstMarket,
      merchant: atSave.storyMerchantNamed,
      tick: atSave.storyFirstMarketTick,
    })}`);
  }
  console.log('✓ story@60 continuity — first-market flag + named merchant persist from exact tick 1200');
  console.log('✓ actor/ref matrix — citizen assignment/ID, soldier, enemy, projectile, caravan, walker, patrol, raid, debug, ordered cargo');
  console.log(`[save-continuity] OK — independent control, producer, and consumer converge through tick ${FINAL_TICK}`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
