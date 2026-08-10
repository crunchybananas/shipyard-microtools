#!/usr/bin/env node

// Dense production-world traffic proof inspired by the supplied settlement
// reference. The fixture owns no runtime behavior: it arranges real citizens,
// completed buildings, and roads, then measures production pathfinding and
// updateCitizens() while the production renderer supplies the visual proof.

import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proofDir = join(root, 'scripts', 'screenshots');
const screenshotPath = join(proofDir, 'dense-settlement-congestion-peak.png');
const reportPath = join(proofDir, 'dense-settlement-congestion-report.json');
const runtimeContract = JSON.parse(
  await readFile(join(root, 'runtime-contract.json'), 'utf8'),
);
assert.equal(
  runtimeContract.moduleRevision,
  192,
  'Update dense-settlement browser imports with the runtime revision',
);
const viewport = { width: 1556, height: 736 };
const deviceScaleFactor = 2;
const tickLimit = 1500;
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const context = await browser.newContext({ viewport, deviceScaleFactor });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

try {
  await mkdir(proofDir, { recursive: true });
  await page.goto(`${server.gameUrl}?verifyDenseSettlement=${runtimeContract.moduleRevision}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && typeof window.G?.debug?.dispatch === 'function'
    && window.__realm?.actorAtlas?.().tiers?.every(tier => tier.state === 'ready')
  ));
  await page.locator('#kingdom-name-input').fill('Dense Settlement Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => (
    !document.body.classList.contains('title-active')
    && window.__realm?.rasterAtlas?.().state === 'ready'
    && window.__realm?.supportAtlas?.().state === 'ready'
  ));
  await page.evaluate(() => window.setSpeed(0));

  const result = await page.evaluate(async ({ tickLimit: limit }) => {
    const state = await import('./js/state.js?realm=192');
    const pathfinding = await import('./js/pathfinding.js?realm=192');
    const citizens = await import('./js/citizens.js?realm=192');
    const ownership = await import('./js/citizen-ownership.js?realm=192');
    const render = await import('./js/render.js?realm=192');
    const g = window.G;
    if (state.G !== g) throw new Error('dense fixture imported a split runtime state identity');
    const center = { x: 40, y: 40 };
    const arrivalRadius = 0.55;
    const noProgressEpsilon = 0.000001;

    const rounded = (value, digits = 9) => Number(value.toFixed(digits));
    const tileKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;
    const percentile = (values, fraction) => {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
    };
    const locator = building => building
      ? `${building.type}@${building.x},${building.y}`
      : null;

    function resetFixtureWorld() {
      g.map = Array.from({ length: state.MAP_H }, () => (
        Array(state.MAP_W).fill(state.TILE.GRASS)
      ));
      g.fog = Array.from({ length: state.MAP_H }, () => (
        Array(state.MAP_W).fill(true)
      ));
      g.buildingGrid = Array.from({ length: state.MAP_H }, () => (
        Array(state.MAP_W).fill(null)
      ));
      g.buildings = [];
      g.citizens = [];
      g.soldiers = [];
      g.enemies = [];
      g.projectiles = [];
      g.walkers = [];
      g.animals = [];
      g.caravans = [];
      g.carts = [];
      g.particles = [];
      g.tileWear = null;
      g.nextActorId = 1;
      g.population = 0;
      g.maxPop = 100;
      g.gameTick = 0;
      g.day = 1;
      g.dayLength = 100_000;
      g.dayPhase = 50_000;
      g.season = 'spring';
      g.weather = 'clear';
      g.difficulty = 'normal';
      g.speed = 0;
      g.obstacleEpoch = 1;
      g.nextRaidDay = 99_999;
      g.debug.disableEvents = true;
      g.debug.pauseRendering = true;
      g.resources = state.createResourceStock({
        wood: 100_000,
        stone: 100_000,
        food: 100_000,
        gold: 100_000,
        iron: 100_000,
        wheat: 100_000,
        flour: 100_000,
        planks: 100_000,
        tools: 100_000,
      });
      g.eventModifiers = {
        foodProd: 1,
        goldProd: 1,
        happinessOffset: 0,
        speedMult: 1,
      };
      if (g.avatar) {
        g.avatar.x = 26;
        g.avatar.y = 32;
        g.avatar.tx = 26;
        g.avatar.ty = 32;
        g.avatar.path = null;
        g.avatar.pathIdx = 0;
        g.avatar._px = 26;
        g.avatar._py = 32;
      }
      state.setSeed(0xd35e5e77);
      ownership.resetCitizenOwnershipRuntime();
    }

    function arrangeSettlement() {
      const dispatch = command => {
        const result = g.debug.dispatch(command);
        if (!result.ok) {
          throw new Error(`${command.type} failed for ${JSON.stringify(command)}: ${result.reason}`);
        }
      };
      const roadKeys = new Set();
      const addRoad = (x, y) => roadKeys.add(`${x},${y}`);
      for (let x = 28; x <= 52; x++) addRoad(x, 40);
      for (let x = 34; x <= 46; x++) {
        addRoad(x, 36);
        addRoad(x, 44);
      }
      for (let y = 36; y <= 44; y++) {
        addRoad(34, y);
        addRoad(40, y);
        addRoad(46, y);
      }
      for (let y = 32; y <= 48; y++) addRoad(40, y);
      for (const key of [...roadKeys].sort()) {
        const [x, y] = key.split(',').map(Number);
        dispatch({ type: 'PLACE_BUILDING', building: 'road', x, y });
        const road = g.buildingGrid[y][x];
        road.buildProgress = 1;
        road.completeTick = Number.NEGATIVE_INFINITY;
        road.upgradeTick = Number.NEGATIVE_INFINITY;
      }

      const placed = new Map();
      const placeComplete = (type, x, y, tile = state.TILE.GRASS) => {
        g.map[y][x] = tile;
        dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
        const building = g.buildingGrid[y][x];
        if (!building || building.type !== type) {
          throw new Error(`${type}@${x},${y} did not enter the production building grid`);
        }
        building.buildProgress = 1;
        building.completeTick = Number.NEGATIVE_INFINITY;
        building.upgradeTick = Number.NEGATIVE_INFINITY;
        building.hp = building.maxHp || building.hp || 100;
        placed.set(`${type}-${placed.size}`, building);
        return building;
      };

      const houses = [
        placeComplete('house', 38, 38),
        placeComplete('house', 42, 38),
        placeComplete('house', 39, 42),
      ];
      const buildings = {
        houses,
        well: placeComplete('well', 43, 42),
        storehouse: placeComplete('storehouse', 36, 38),
        farm: placeComplete('farm', 38, 43),
        lumber: placeComplete('lumber', 32, 38, state.TILE.FOREST),
        quarry: placeComplete('quarry', 48, 38, state.TILE.STONE),
        mine: placeComplete('mine', 48, 42, state.TILE.IRON),
        market: placeComplete('market', 36, 42),
        tavern: placeComplete('tavern', 42, 42),
        blacksmith: placeComplete('blacksmith', 44, 38),
      };
      // Placement feedback is a shell affordance, not part of the settlement
      // density proof. Without shell ticks these rings would remain frozen on
      // every authored road/building and obscure the clean production frame.
      g._buildRipples = [];
      g.particles = [];
      return { buildings, roadCount: roadKeys.size };
    }

    function makeTripSpecs() {
      const ports = {
        west: [
          [29, 39], [29, 40], [29, 41], [30, 38], [30, 40], [30, 42],
        ],
        east: [
          [51, 39], [51, 40], [51, 41], [50, 38], [50, 40], [50, 42],
        ],
        north: [
          [39, 33], [40, 33], [41, 33], [38, 34], [40, 34], [42, 34],
        ],
        south: [
          [39, 47], [40, 47], [41, 47], [38, 46], [40, 46], [42, 46],
        ],
      };
      const group = (name, starts, goals) => starts.map((start, index) => ({
        group: name,
        start: { x: start[0], y: start[1] },
        goal: { x: goals[index][0], y: goals[index][1] },
      }));
      return [
        ...group('west-to-east', ports.west, ports.east),
        ...group('east-to-north', ports.east, ports.north),
        ...group('north-to-south', ports.north, ports.south),
        ...group('south-to-west', ports.south, ports.west),
      ];
    }

    function buildCitizens(tripSpecs, buildings) {
      const created = tripSpecs.map((spec, index) => ({
        ...ownership.createCitizenOwnership(
          `Traffic ${String(index + 1).padStart(2, '0')}`,
          { appearanceId: index % 2 ? 'identity-02' : 'identity-01' },
        ),
        x: spec.start.x,
        y: spec.start.y,
        tx: spec.start.x,
        ty: spec.start.y,
        faceX: 0,
        faceZ: 0,
        speed: 0.03,
        carrying: null,
        carryAmount: 0,
        hunger: 0,
        rest: 100,
        needs: { joy: 100, faith: 100 },
        home: null,
        activityTimer: 120,
        path: null,
        pathIdx: 0,
        _hb: (index * 5 + 3) % 12,
      }));
      g.citizens = created;
      g.population = created.length;

      const workAnchors = [
        buildings.farm,
        buildings.lumber,
        buildings.quarry,
        buildings.mine,
        buildings.mine,
        buildings.market,
        buildings.tavern,
        buildings.blacksmith,
      ];
      for (let index = 0; index < workAnchors.length; index++) {
        if (!ownership.claimCitizenAssignment(created[index], workAnchors[index], {
          reason: 'player-command',
        })) {
          throw new Error(`could not claim fixture assignment ${index}`);
        }
      }

      const trips = [];
      for (let index = 0; index < created.length; index++) {
        const citizen = created[index];
        const spec = tripSpecs[index];
        const path = pathfinding.findPath(
          spec.start.x,
          spec.start.y,
          spec.goal.x,
          spec.goal.y,
        );
        if (!path) throw new Error(`no authored route for actor ${citizen.actorId}`);
        citizen.path = path;
        citizen.pathIdx = 0;
        citizen.tx = spec.goal.x;
        citizen.ty = spec.goal.y;
        citizen._requestedTx = spec.goal.x;
        citizen._requestedTy = spec.goal.y;
        citizen._pathGoal = { ...spec.goal };
        citizen._pathEpoch = g.obstacleEpoch;
        citizen._pathStartedAt = 0;
        citizen._lastPathX = citizen.x;
        citizen._lastPathY = citizen.y;
        citizen._stuckTicks = 0;
        citizen._wdBest = Math.hypot(
          spec.goal.x - citizen.x,
          spec.goal.y - citizen.y,
        );
        citizen._wdTicks = 0;
        trips.push({
          actorId: citizen.actorId,
          group: spec.group,
          start: spec.start,
          goal: spec.goal,
          initialAssignment: locator(citizen.assignment?.building),
          completionTick: null,
          currentNoProgress: 0,
          currentNoProgressStartTick: null,
          longestNoProgress: 0,
          longestNoProgressStartTick: null,
          longestNoProgressEndTick: null,
          totalNoProgressTicks: 0,
          falseUnreachable: false,
          visitedTiles: [tileKey(citizen.x, citizen.y)],
        });
      }
      return { created, trips };
    }

    function runScenario({ stopAtTick = null } = {}) {
      resetFixtureWorld();
      const settlement = arrangeSettlement();
      const tripSpecs = makeTripSpecs();
      const { created, trips } = buildCitizens(tripSpecs, settlement.buildings);
      const tripByActor = new Map(trips.map(trip => [trip.actorId, trip]));
      const assignmentLosses = new Set();
      const falseUnreachable = new Set();
      const falseUnreachableEvidence = [];
      const penetrationActors = new Set();
      const penetrationEvidence = [];
      let blockedTilePenetrationTicks = 0;
      let minimumCenterDistance = Infinity;
      let minimumCenterPair = null;
      let minimumCenterTick = null;
      let briefOverlapPairTicks = 0;
      let ticksWithBriefOverlap = 0;
      let peakDensity = -1;
      let peakDensityTick = 0;
      let peakDensityMinimumDistance = Infinity;
      let maxConcurrentActiveTrips = 0;
      let ticksRun = 0;

      for (let tick = 1; tick <= limit; tick++) {
        const before = new Map(created.map(citizen => [citizen.actorId, {
          x: citizen.x,
          y: citizen.y,
          active: !!citizen.path && citizen.pathIdx < citizen.path.length,
          pathIdx: citizen.pathIdx,
          pathLength: citizen.path?.length || 0,
        }]));
        g.gameTick = tick;
        citizens.updateCitizens();
        ticksRun = tick;

        let concurrentActiveTrips = 0;
        for (const citizen of created) {
          const trip = tripByActor.get(citizen.actorId);
          const prior = before.get(citizen.actorId);
          if (trip.completionTick === null) {
            concurrentActiveTrips++;
            const moved = Math.hypot(citizen.x - prior.x, citizen.y - prior.y);
            if (prior.active && moved <= noProgressEpsilon) {
              if (trip.currentNoProgress === 0) trip.currentNoProgressStartTick = tick;
              trip.currentNoProgress++;
              trip.totalNoProgressTicks++;
              if (trip.currentNoProgress > trip.longestNoProgress) {
                trip.longestNoProgress = trip.currentNoProgress;
                trip.longestNoProgressStartTick = trip.currentNoProgressStartTick;
                trip.longestNoProgressEndTick = tick;
              }
            } else {
              trip.currentNoProgress = 0;
              trip.currentNoProgressStartTick = null;
            }
            const distanceToGoal = Math.hypot(
              citizen.x - trip.goal.x,
              citizen.y - trip.goal.y,
            );
            // Separation may push an actor outside the half-tile arrival area
            // immediately after it consumes the exact final waypoint. Treat
            // the production path index as the authoritative trip completion,
            // including the following tick when updateCitizens clears it.
            const consumedFinalWaypoint = citizen.activity.reason !== 'path-unreachable'
              && (
                (!!citizen.path && citizen.pathIdx >= citizen.path.length)
                || (prior.pathLength > 0
                  && prior.pathIdx >= prior.pathLength
                  && !citizen.path)
              );
            if (distanceToGoal < arrivalRadius || consumedFinalWaypoint) {
              trip.completionTick = tick;
              trip.currentNoProgress = 0;
              trip.currentNoProgressStartTick = null;
            } else if (citizen.activity.reason === 'path-unreachable') {
              trip.falseUnreachable = true;
              if (!falseUnreachable.has(citizen.actorId)) {
                falseUnreachableEvidence.push({
                  tick,
                  actorId: citizen.actorId,
                  activity: citizen.activity.kind,
                  reason: citizen.activity.reason,
                  distanceToGoal: rounded(distanceToGoal),
                  pathIdx: citizen.pathIdx,
                  pathLength: citizen.path?.length || 0,
                  priorPathIdx: prior.pathIdx,
                  priorPathLength: prior.pathLength,
                  priorActive: prior.active,
                });
              }
              falseUnreachable.add(citizen.actorId);
            }
          }

          if (
            trip.initialAssignment
            && locator(citizen.assignment?.building) !== trip.initialAssignment
          ) assignmentLosses.add(citizen.actorId);

          const currentTile = tileKey(citizen.x, citizen.y);
          if (trip.visitedTiles.at(-1) !== currentTile) trip.visitedTiles.push(currentTile);
          const rx = Math.round(citizen.x);
          const ry = Math.round(citizen.y);
          const occupied = g.buildingGrid[ry]?.[rx];
          if (occupied && occupied.type !== 'road') {
            blockedTilePenetrationTicks++;
            penetrationActors.add(citizen.actorId);
            if (penetrationEvidence.length < 24) {
              penetrationEvidence.push({
                tick,
                actorId: citizen.actorId,
                tile: `${rx},${ry}`,
                building: locator(occupied),
              });
            }
          }
        }
        maxConcurrentActiveTrips = Math.max(maxConcurrentActiveTrips, concurrentActiveTrips);

        let tickMinimumDistance = Infinity;
        let tickMinimumPair = null;
        let tickBriefOverlap = false;
        for (let first = 0; first < created.length; first++) {
          for (let second = first + 1; second < created.length; second++) {
            const a = created[first];
            const b = created[second];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (distance < tickMinimumDistance) {
              tickMinimumDistance = distance;
              tickMinimumPair = [a.actorId, b.actorId];
            }
            if (distance < arrivalRadius) {
              briefOverlapPairTicks++;
              tickBriefOverlap = true;
            }
          }
        }
        if (tickBriefOverlap) ticksWithBriefOverlap++;
        if (tickMinimumDistance < minimumCenterDistance) {
          minimumCenterDistance = tickMinimumDistance;
          minimumCenterPair = tickMinimumPair;
          minimumCenterTick = tick;
        }

        const density = created.filter(citizen => (
          Math.hypot(citizen.x - center.x, citizen.y - center.y) <= 4.5
        )).length;
        if (
          density > peakDensity
          || (density === peakDensity && tickMinimumDistance < peakDensityMinimumDistance)
        ) {
          peakDensity = density;
          peakDensityTick = tick;
          peakDensityMinimumDistance = tickMinimumDistance;
        }

        if (stopAtTick !== null && tick >= stopAtTick) break;
        if (stopAtTick === null && trips.every(trip => trip.completionTick !== null)) break;
      }

      const completed = trips.filter(trip => trip.completionTick !== null);
      const completionTicks = completed.map(trip => trip.completionTick);
      const routeDiversity = {};
      for (const groupName of [...new Set(trips.map(trip => trip.group))].sort()) {
        const groupTrips = trips.filter(trip => trip.group === groupName);
        const counts = new Map();
        for (const trip of groupTrips) {
          const signature = trip.visitedTiles.join('>');
          counts.set(signature, (counts.get(signature) || 0) + 1);
        }
        routeDiversity[groupName] = {
          trips: groupTrips.length,
          distinctRouteSignatures: counts.size,
          dominantRouteShare: rounded(Math.max(...counts.values()) / groupTrips.length),
        };
      }
      const perActor = trips.map(trip => ({
        actorId: trip.actorId,
        group: trip.group,
        start: trip.start,
        goal: trip.goal,
        initialAssignment: trip.initialAssignment,
        completionTick: trip.completionTick,
        longestNoProgress: trip.longestNoProgress,
        longestNoProgressStartTick: trip.longestNoProgressStartTick,
        longestNoProgressEndTick: trip.longestNoProgressEndTick,
        totalNoProgressTicks: trip.totalNoProgressTicks,
        falseUnreachable: trip.falseUnreachable,
        visitedTileCount: trip.visitedTiles.length,
      }));
      const longest = [...perActor]
        .sort((a, b) => b.longestNoProgress - a.longestNoProgress || a.actorId - b.actorId)[0];
      const summary = {
        fixture: {
          citizens: created.length,
          representativeCompletedBuildings: 12,
          roads: settlement.roadCount,
          assignedCitizens: trips.filter(trip => trip.initialAssignment).length,
          center,
          arrivalRadius,
          tickLimit: limit,
        },
        ticksRun,
        completedTrips: completed.length,
        incompleteActorIds: trips
          .filter(trip => trip.completionTick === null)
          .map(trip => trip.actorId),
        completionTickP50: percentile(completionTicks, 0.50),
        completionTickP95: percentile(completionTicks, 0.95),
        completionTickMax: completionTicks.length ? Math.max(...completionTicks) : null,
        longestActiveNoProgress: longest?.longestNoProgress ?? 0,
        longestActiveNoProgressActorId: longest?.actorId ?? null,
        totalActiveNoProgressTicks: perActor.reduce(
          (sum, actor) => sum + actor.totalNoProgressTicks,
          0,
        ),
        falseUnreachableActorIds: [...falseUnreachable].sort((a, b) => a - b),
        falseUnreachableEvidence,
        assignmentLossActorIds: [...assignmentLosses].sort((a, b) => a - b),
        blockedTilePenetrationTicks,
        blockedTilePenetrationActorIds: [...penetrationActors].sort((a, b) => a - b),
        penetrationEvidence,
        minimumCenterDistance: rounded(minimumCenterDistance),
        minimumCenterPair,
        minimumCenterTick,
        briefOverlapPairTicks,
        ticksWithBriefOverlap,
        peakDensity,
        peakDensityTick,
        peakDensityMinimumDistance: rounded(peakDensityMinimumDistance),
        maxConcurrentActiveTrips,
        routeDiversity,
        perActor,
      };

      if (stopAtTick !== null) {
        g.camera = {
          x: render.toScreen(center.x, center.y).x,
          y: render.toScreen(center.x, center.y).y,
          zoom: 1.3,
        };
        g.photoMode = true;
        document.body.classList.add('photo-mode');
        const photoBadge = document.getElementById('photo-mode-badge');
        if (photoBadge) photoBadge.style.display = 'none';
      }
      return summary;
    }

    const first = runScenario();
    const second = runScenario();
    runScenario({ stopAtTick: first.peakDensityTick });
    g.debug.pauseRendering = false;
    const renderEvidence = {
      actorAtlasDraws: 0,
      buildingCompositeBlits: 0,
      roadSurfaceFills: 0,
    };
    const proto = CanvasRenderingContext2D.prototype;
    const originalDrawImage = proto.drawImage;
    const originalFill = proto.fill;
    proto.drawImage = function (image, ...args) {
      if (this.canvas.id === 'game') {
        const source = image?.currentSrc || image?.src || '';
        if (source.includes('/actors-atlas-')) renderEvidence.actorAtlasDraws++;
        if (image instanceof HTMLCanvasElement && image !== this.canvas) {
          renderEvidence.buildingCompositeBlits++;
        }
      }
      return originalDrawImage.call(this, image, ...args);
    };
    proto.fill = function (...args) {
      if (this.canvas.id === 'game' && this.fillStyle === '#9f7548') {
        renderEvidence.roadSurfaceFills++;
      }
      return originalFill.apply(this, args);
    };
    try {
      window.forceRender();
    } finally {
      proto.drawImage = originalDrawImage;
      proto.fill = originalFill;
    }
    return {
      first,
      second,
      renderEvidence,
      captureState: {
        citizens: g.citizens.length,
        representativeCompletedBuildings: g.buildings.filter(building => building.type !== 'road').length,
        roads: g.buildings.filter(building => building.type === 'road').length,
        gameTick: g.gameTick,
        photoMode: g.photoMode,
        photoModeClass: document.body.classList.contains('photo-mode'),
        renderingPaused: g.debug.pauseRendering,
      },
    };
  }, {
    tickLimit,
  });

  const liveCaptureState = await page.evaluate(() => ({
    citizens: window.G.citizens.length,
    representativeCompletedBuildings: window.G.buildings.filter(building => building.type !== 'road').length,
    roads: window.G.buildings.filter(building => building.type === 'road').length,
    gameTick: window.G.gameTick,
    photoMode: window.G.photoMode,
    photoModeClass: document.body.classList.contains('photo-mode'),
    renderingPaused: window.G.debug.pauseRendering,
  }));
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const deterministic = isDeepStrictEqual(result.first, result.second);
  const failures = [];
  const summary = result.first;
  if (summary.completedTrips !== summary.fixture.citizens) {
    failures.push(
      `only ${summary.completedTrips}/${summary.fixture.citizens} authored trips completed within ${tickLimit} ticks`,
    );
  }
  if (summary.longestActiveNoProgress > 90) {
    failures.push(
      `actor ${summary.longestActiveNoProgressActorId} had ${summary.longestActiveNoProgress} continuous active no-progress ticks`,
    );
  }
  if (summary.falseUnreachableActorIds.length) {
    failures.push(`false unreachable actors: ${summary.falseUnreachableActorIds.join(', ')}`);
  }
  if (summary.assignmentLossActorIds.length) {
    failures.push(`fixture assignments were lost by actors: ${summary.assignmentLossActorIds.join(', ')}`);
  }
  if (summary.blockedTilePenetrationTicks) {
    failures.push(
      `${summary.blockedTilePenetrationTicks} actor-ticks penetrated blocked building tiles`,
    );
  }
  if (summary.minimumCenterDistance < 0.30) {
    failures.push(
      `hard actor center-distance floor fell to ${summary.minimumCenterDistance}`,
    );
  }
  if (!deterministic) failures.push('clean deterministic rerun changed the summary');
  if (!isDeepStrictEqual(liveCaptureState, result.captureState)) {
    failures.push(
      `live capture state drifted before screenshot: ${JSON.stringify(liveCaptureState)}`,
    );
  }
  if (
    liveCaptureState.citizens !== 24
    || liveCaptureState.representativeCompletedBuildings !== 12
    || liveCaptureState.roads !== summary.fixture.roads
    || liveCaptureState.gameTick !== summary.peakDensityTick
    || !liveCaptureState.photoMode
    || !liveCaptureState.photoModeClass
    || liveCaptureState.renderingPaused
  ) failures.push(`peak screenshot fixture is incomplete: ${JSON.stringify(liveCaptureState)}`);
  if (result.renderEvidence.actorAtlasDraws < 24) {
    failures.push(
      `peak render drew only ${result.renderEvidence.actorAtlasDraws} actor-atlas frames`,
    );
  }
  if (result.renderEvidence.roadSurfaceFills < 60) {
    failures.push(
      `peak render drew only ${result.renderEvidence.roadSurfaceFills} visible road surfaces`,
    );
  }
  if (browserErrors.length) failures.push(...browserErrors);

  const report = {
    schema: 'realm.browser.dense-settlement-congestion.v1',
    runtimeRevision: runtimeContract.moduleRevision,
    viewport,
    deviceScaleFactor,
    screenshot: screenshotPath,
    thresholds: {
      allTripsCompleteWithinTicks: tickLimit,
      maximumContinuousActiveNoProgressTicks: 90,
      hardMinimumCenterDistance: 0.30,
      briefOverlapReportThreshold: 0.55,
      requireNoFalseUnreachable: true,
      requireNoAssignmentLoss: true,
      requireNoBlockedTilePenetration: true,
      requireDeterministicSummary: true,
      requireZeroBrowserErrors: true,
    },
    deterministic,
    captureState: liveCaptureState,
    renderEvidence: result.renderEvidence,
    summary,
    rerunSummary: result.second,
    browserErrors,
    failures,
    passed: failures.length === 0,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `[dense-settlement] completed=${summary.completedTrips}/${summary.fixture.citizens} `
    + `p95=${summary.completionTickP95} max=${summary.completionTickMax} `
    + `longest-zero=${summary.longestActiveNoProgress}`,
  );
  console.log(
    `[dense-settlement] min-distance=${summary.minimumCenterDistance} `
    + `brief-overlap-pair-ticks=${summary.briefOverlapPairTicks} `
    + `blocked-penetration=${summary.blockedTilePenetrationTicks}`,
  );
  console.log(
    `[dense-settlement] peak=${summary.peakDensity} citizens at tick ${summary.peakDensityTick}; `
    + `deterministic=${deterministic}`,
  );
  console.log(`proof: ${screenshotPath}`);
  console.log(`report: ${reportPath}`);

  assert.equal(failures.length, 0, failures.join('\n'));
} finally {
  await browser.close();
  await server.stop();
}
