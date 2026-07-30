#!/usr/bin/env node

// Canonical browser lifecycle gate for Engine v2 Phase 1A ownership.
//
// The fixture enters through New Game, places real buildings through replayable
// commands, and advances the production core through G.debug.step(). Direct
// writes are limited to arranging deterministic preconditions (completed test
// buildings, terrain, needs, and clocks); every lifecycle transition under
// test is owned by the production citizen, economy, building-lifecycle, or
// story system.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
const REVISION = contract.moduleRevision;

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${server.gameUrl}?v=engine-v2-citizen-lifecycle-browser-${REVISION}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && typeof window.G?.debug?.step === 'function'
    && typeof window.G?.debug?.dispatch === 'function'
  ));

  await page.locator('#kingdom-name-input').fill('Citizen Lifecycle Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => (
    !document.body.classList.contains('title-active')
    && window.G?.citizens?.length === 3
  ));
  await page.evaluate(() => window.setSpeed(0));

  const result = await page.evaluate(async () => {
    const ownership = await import('./js/citizen-ownership.js?realm=172');
    const presentation = await import('./js/citizen-presentation.js?realm=172');
    const render = await import('./js/render.js?realm=172');
    const state = await import('./js/state.js?realm=172');
    const ui = await import('./js/ui.js?realm=172');
    const g = window.G;

    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const dispatch = command => {
      const applied = g.debug.dispatch(command);
      if (!applied.ok) throw new Error(`${command.type} failed: ${applied.reason}`);
      return applied;
    };
    const clearMotion = citizen => {
      citizen.path = null;
      citizen.pathIdx = 0;
      citizen.tx = citizen.x;
      citizen.ty = citizen.y;
      citizen._requestedTx = undefined;
      citizen._requestedTy = undefined;
      citizen._pathGoal = null;
      citizen._wdBest = null;
      citizen._wdTicks = 0;
      citizen._stuckTicks = 0;
    };
    const setPosition = (citizen, x, y) => {
      citizen.x = x;
      citizen.y = y;
      clearMotion(citizen);
    };
    const park = (citizen, x, y) => {
      setPosition(citizen, x, y);
      ownership.transitionCitizenActivity(citizen, 'idle', 'idle-wait');
      citizen.activityTimer = 100_000;
      citizen.hunger = 0;
      citizen.rest = 100;
      citizen.carrying = null;
      citizen.carryAmount = 0;
    };
    const forceHeartbeatNextTick = citizen => {
      citizen._hb = (12 - ((g.gameTick + 1) % 12)) % 12;
    };
    const avoidHeartbeatNextTick = citizen => {
      citizen._hb = (13 - ((g.gameTick + 1) % 12)) % 12;
    };
    const stepUntil = (label, predicate, limit = 240) => {
      for (let steps = 1; steps <= limit; steps++) {
        g.debug.step(1);
        if (predicate()) return steps;
      }
      throw new Error(`${label} did not settle within ${limit} core ticks`);
    };
    const placeComplete = (type, x, y, tile = state.TILE.GRASS) => {
      g.map[y][x] = tile;
      g.fog[y][x] = true;
      dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
      const building = g.buildingGrid[y][x];
      requireCondition(building?.type === type, `${type} did not enter the real building grid`);
      building.buildProgress = 1;
      building.completeTick = g.gameTick;
      return building;
    };
    const clickCitizen = citizen => {
      const canvas = document.getElementById('game');
      const rect = canvas.getBoundingClientRect();
      const world = render.toScreen(citizen.x, citizen.y);
      const canvasX = (world.x - g.camera.x) * g.camera.zoom + canvas.width / 2;
      const canvasY = (world.y - 8 - g.camera.y) * g.camera.zoom + canvas.height / 2;
      const clientX = rect.left + canvasX * (rect.width / canvas.width);
      const clientY = rect.top + canvasY * (rect.height / canvas.height);
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX,
        clientY,
      }));
    };
    const compactText = element => (element?.textContent || '').replace(/\s+/g, ' ').trim();

    g.debug.disableEvents = true;
    g.nextRaidDay = 9_999;
    g.enemies.length = 0;
    Object.assign(g.resources, {
      wood: 10_000,
      stone: 10_000,
      food: 10_000,
      gold: 10_000,
      iron: 10_000,
      wheat: 10_000,
      flour: 10_000,
      planks: 10_000,
      tools: 0,
    });
    for (const row of g.fog) row.fill(true);
    for (let y = 34; y <= 48; y++) {
      for (let x = 34; x <= 52; x++) {
        if (!g.buildingGrid[y][x]) g.map[y][x] = state.TILE.GRASS;
      }
    }
    g.dayPhase = Math.floor(g.dayLength * 0.2);

    const target = g.citizens.at(-1);
    const helper = g.citizens.at(-2);
    const bystander = g.citizens[0];
    const stable = {
      actorId: target.actorId,
      appearanceId: target.identity.appearanceId,
    };
    const events = [];
    const off = ownership.onCitizenTransition(event => events.push(event));
    const phases = [];
    const phase = label => {
      window.forceRender();
      const snapshot = presentation.buildCitizenPresentation(target, {
        selectedActorId: target.actorId,
      });
      const action = presentation.presentationActionForActivity(
        snapshot.activity.kind,
        snapshot.carrying,
        snapshot.pathActive,
      );
      phases.push({
        label,
        actorId: snapshot.actorId,
        appearanceId: snapshot.identity.appearanceId,
        profession: snapshot.profession.kind,
        activity: snapshot.activity.kind,
        assignmentPurpose: snapshot.assignment?.purpose || null,
        assignmentDuty: snapshot.assignment?.duty || null,
        variant: snapshot.variant,
        action,
      });
      requireCondition(snapshot.actorId === stable.actorId, `${label}: actor ID changed`);
      requireCondition(snapshot.identity.appearanceId === stable.appearanceId, `${label}: appearance changed`);
      requireCondition(snapshot.profession.kind === 'miner', `${label}: profession changed`);
      requireCondition(snapshot.variant === 'miner', `${label}: renderer role morphed`);
      return snapshot;
    };

    try {
      ownership.renameCitizen(target, 'Lifecycle Miner', 'player-rename');
      park(bystander, 37, 46);
      setPosition(helper, 42, 42);
      setPosition(target, 42, 40);
      helper.speed = 0.45;
      target.speed = 0.45;

      const mine = placeComplete('mine', 44, 40, state.TILE.IRON);
      const storehouse = placeComplete('storehouse', 49, 40);
      dispatch({ type: 'ASSIGN_CITIZEN', actorId: helper.actorId, x: mine.x, y: mine.y });
      dispatch({ type: 'ASSIGN_CITIZEN', actorId: target.actorId, x: mine.x, y: mine.y });
      const mineApproachTicks = stepUntil(
        'mine workers reaching real work positions',
        () => helper.activity.kind === 'working' && target.activity.kind === 'working',
      );
      requireCondition(target.profession.kind === 'miner', 'Completed mine did not establish miner vocation');
      requireCondition(target.assignment?.purpose === 'vocation', 'Mine assignment was not vocational');
      phase('mine-work');

      // Real production creates a batch, then the citizen state machine takes
      // it, routes to a real storehouse, carries it, and credits delivery.
      helper.activityTimer = 1_000;
      target.activityTimer = 1_000;
      mine.prodTimer = Math.floor(g.dayLength / 5) - 1;
      g.debug.step(1);
      requireCondition(mine.produced?.iron > 0, 'Real mine production did not create an iron batch');
      target.activityTimer = 0;
      avoidHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.activity.kind === 'walk_to_deliver', 'Miner did not enter delivery route');
      requireCondition(target.carrying === 'iron' && target.carryAmount > 0, 'Miner did not pick up iron cargo');
      requireCondition(target._deliveryTarget === storehouse, 'Iron did not route to the real storehouse');
      const carryAmount = target.carryAmount;
      const ironBeforeDelivery = g.resources.iron;
      phase('mine-carry');

      const deliveryApproachTicks = stepUntil(
        'iron carrier reaching delivery state',
        () => target.activity.kind === 'deliver',
      );
      phase('mine-deliver');
      target.activityTimer = 0;
      avoidHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.carrying === null && target.carryAmount === 0, 'Delivery retained cargo');
      requireCondition(
        g.resources.iron === ironBeforeDelivery + carryAmount,
        'Delivery did not credit the exact carried iron amount',
      );
      requireCondition(target.assignment?.building === mine, 'Delivery erased the vocational mine assignment');
      phase('mine-delivered');

      // Enclose the citizen for one real routing decision. findPath() fails,
      // the citizen system emits causal path-unreachable cleanup, and a later
      // command succeeds after the terrain is reopened.
      setPosition(target, 36, 36);
      target.workTarget = null;
      const enclosedTiles = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          enclosedTiles.push({ x: 36 + dx, y: 36 + dy, tile: g.map[36 + dy][36 + dx] });
          g.map[36 + dy][36 + dx] = state.TILE.MOUNTAIN;
        }
      }
      ownership.transitionCitizenActivity(target, 'find_job', 'seek-work');
      target.activityTimer = 0;
      avoidHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.assignment === null, 'Unreachable mine retained assignment');
      requireCondition(
        target.activity.kind === 'idle' && target.activity.reason === 'path-unreachable',
        'Unreachable mine did not enter causal recovery',
      );
      phase('path-failure-recovery');

      for (const entry of enclosedTiles) g.map[entry.y][entry.x] = entry.tile;
      setPosition(target, 42, 40);
      target.workTarget = null;
      dispatch({ type: 'ASSIGN_CITIZEN', actorId: target.actorId, x: mine.x, y: mine.y });
      const routeRecoveryTicks = stepUntil(
        'miner recovering after route failure',
        () => target.activity.kind === 'working' && target.assignment?.building === mine,
      );
      phase('path-recovered-work');

      // A deterministic real heartbeat releases non-food work during a food
      // crisis. The ordinary job market then claims an open farm as temporary
      // cover without retraining the miner.
      const farm = placeComplete('farm', 44, 45);
      dispatch({ type: 'RELEASE_CITIZEN', actorId: helper.actorId });
      park(helper, 39, 46);
      target.activityTimer = 10_000;
      g.resources.food = 0;
      g.resources.wheat = 0;
      g.resources.flour = 0;
      state.setSeed(0);
      forceHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.assignment?.building === farm, 'Food crisis did not claim the open farm');
      requireCondition(target.assignment?.purpose === 'temporary', 'Food-crisis cover was not temporary');
      requireCondition(target.assignment?.reason === 'food-crisis', 'Food-crisis cover lost its causal reason');
      phase('food-crisis-cover');

      // With productive jobs removed and the larder empty, the same miner
      // enters and completes the real forage branch. Forage credits directly
      // and must not leave phantom cargo behind.
      dispatch({ type: 'DEMOLISH', x: farm.x, y: farm.y });
      dispatch({ type: 'DEMOLISH', x: mine.x, y: mine.y });
      setPosition(target, 36, 40);
      g.map[40][36] = state.TILE.FOREST;
      g.fog[40][36] = true;
      target.workTarget = null;
      target.forageTarget = null;
      ownership.transitionCitizenActivity(target, 'find_job', 'seek-work');
      target.activityTimer = 0;
      avoidHeartbeatNextTick(target);
      const woodBeforeForage = g.resources.wood;
      g.debug.step(1);
      requireCondition(target.activity.kind === 'foraging', 'Empty-larder citizen did not enter foraging');
      requireCondition(target.assignment === null, 'Foraging retained a work assignment');
      phase('food-crisis-forage');
      const forageTicks = stepUntil(
        'forage completion',
        () => target.activity.kind === 'find_job' && target.activity.reason === 'forage-complete',
        12,
      );
      requireCondition(g.resources.wood === woodBeforeForage + 1, 'Forage did not credit one real resource');
      requireCondition(target.carrying === null && target.carryAmount === 0, 'Forage left phantom cargo');
      phase('food-crisis-forage-complete');

      // Eat through the production state machine, avoiding the separate
      // heartbeat snack path so the explicit eating activity is observable.
      target.hunger = 80;
      g.resources.food = 5;
      target.activityTimer = 0;
      avoidHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.activity.kind === 'eating', 'Hungry miner did not enter eating');
      requireCondition(target.activity.reason === 'eat-food', 'Eating lost its causal reason');
      requireCondition(target.hunger === 20 && g.resources.food === 4, 'Eating did not consume one food and reduce hunger');
      phase('eat');

      // The night schedule owns go-home and sleep. Sleep restores rest; dawn
      // owns the recovery transition back to find_job.
      setPosition(target, 47, 40);
      target.home = null;
      target.hunger = 0;
      target.rest = 10;
      ownership.transitionCitizenActivity(target, 'idle', 'idle-wait');
      target.activityTimer = 100_000;
      g.dayPhase = Math.floor(g.dayLength * 0.8);
      forceHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.activity.kind === 'go_home', 'Night schedule did not route the miner home');
      const sleepApproachTicks = stepUntil(
        'night route reaching sleep',
        () => target.activity.kind === 'sleep',
      );
      phase('sleep');
      const restBeforeRecovery = target.rest;
      target.activityTimer = 1;
      avoidHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(target.rest > restBeforeRecovery, 'Sleep did not restore rest');
      const restAfterRecovery = target.rest;

      g.dayPhase = Math.floor(g.dayLength * 0.2);
      state.setSeed(1);
      forceHeartbeatNextTick(target);
      g.debug.step(1);
      requireCondition(
        target.activity.kind === 'find_job' && target.activity.reason === 'wake-day',
        'Dawn did not causally recover the sleeping miner',
      );
      phase('wake-recovery');

      // Fire the actual story@60 namesake beat. Its after(G) hook must rename
      // the newest real citizen through the ownership transition surface.
      for (const citizen of g.citizens) {
        clearMotion(citizen);
        ownership.transitionCitizenActivity(citizen, 'sleep', 'sleep-rest');
        citizen.activityTimer = 60;
      }
      g.dayPhase = Math.floor(g.dayLength * 0.8);
      g.storyFlags.founders_named = true;
      g.storyFlags.founder1 = 'Aster Vale';
      g.storyFlags.founder2 = 'Bram Vale';
      g.storyFlags.founder3 = 'Cyra Vale';
      delete g.storyFlags.namesake_born;
      g.stats.citizensBorn = 5;
      const storyTicks = 60 - (g.gameTick % 60);
      g.debug.step(storyTicks);
      requireCondition(g.storyFlags.namesake_born === true, 'Story cadence did not fire namesake_born');
      requireCondition(
        ['Aster Vale', 'Bram Vale', 'Cyra Vale'].includes(target.identity.name),
        'Namesake story did not rename the newest citizen to a founder',
      );
      phase('causal-namesake');

      // Select through the real canvas hit-test. The info panel must be built
      // from the immutable presentation shape and carry the stable actor ID,
      // never a list index or display name.
      const selectedSnapshot = presentation.buildCitizenPresentation(target, {
        selectedActorId: target.actorId,
      });
      clickCitizen(target);
      const citizenPanel = document.getElementById('info-panel');
      const citizenPanelText = compactText(citizenPanel);
      requireCondition(citizenPanel?.style.display === 'block', 'Canvas selection did not open the citizen info panel');
      requireCondition(
        citizenPanel?.dataset.citizenActorId === String(target.actorId),
        'Citizen info panel was not tagged by stable actor ID',
      );
      requireCondition(g.selectedCitizenId === target.actorId, 'Canvas selection did not select by actor ID');
      requireCondition(
        citizenPanelText.includes(selectedSnapshot.identity.name)
          && citizenPanelText.includes(selectedSnapshot.profession.kind)
          && citizenPanelText.includes(selectedSnapshot.activity.reason),
        'Citizen info panel disagrees with its presentation snapshot',
      );
      requireCondition(
        Object.isFrozen(selectedSnapshot)
          && Object.isFrozen(selectedSnapshot.identity)
          && Object.isFrozen(selectedSnapshot.profession)
          && Object.isFrozen(selectedSnapshot.activity),
        'Citizen info panel input was not an immutable presentation snapshot',
      );
      const citizenPanelBeforeRemoval = {
        display: citizenPanel.style.display,
        actorId: citizenPanel.dataset.citizenActorId,
        text: citizenPanelText,
      };

      // Domain removal clears selection ownership. updateUI() must notice that
      // the tagged actor no longer has a current snapshot and close the stale
      // panel while removing its actor tag.
      ownership.removeCitizenFromWorld(target, 'citizen-removed');
      ui.updateUI();
      const citizenPanelAfterRemoval = {
        display: citizenPanel.style.display,
        actorId: citizenPanel.dataset.citizenActorId || null,
        selectedCitizenId: g.selectedCitizenId,
      };
      requireCondition(
        citizenPanelAfterRemoval.display === 'none',
        'Selected citizen removal left the stale info panel open',
      );
      requireCondition(
        citizenPanelAfterRemoval.actorId === null,
        'Selected citizen removal left a stale actor tag on the info panel',
      );
      requireCondition(
        citizenPanelAfterRemoval.selectedCitizenId === null,
        'Selected citizen removal left stale selection ownership',
      );

      // Roads and walls are realm-laid infrastructure, not citizen projects.
      // Their real construction panels may show progress, but must not invent
      // a 0/2 builder crew or invite citizens to take a builder job.
      g.map[47][40] = state.TILE.GRASS;
      g.map[47][41] = state.TILE.GRASS;
      dispatch({ type: 'PLACE_BUILDING', building: 'road', x: 40, y: 47 });
      dispatch({ type: 'PLACE_BUILDING', building: 'wall', x: 41, y: 47 });
      const infrastructurePanels = [
        g.buildingGrid[47][40],
        g.buildingGrid[47][41],
      ].map(building => {
        requireCondition(building?.buildProgress < 1, `${building?.type || 'infrastructure'} was not a live construction project`);
        requireCondition(
          ownership.citizenStaffingCapacity(building) === 0,
          `${building.type} construction exposed citizen staffing capacity`,
        );
        ui.showInfoPanel(building);
        const text = compactText(citizenPanel);
        requireCondition(citizenPanel.style.display === 'block', `${building.type} construction panel did not open`);
        requireCondition(
          text.includes('Under construction') && text.includes('Realm-laid infrastructure'),
          `${building.type} construction panel did not explain its infrastructure owner`,
        );
        requireCondition(
          !/\b\d+\s*\/\s*2\b/.test(text)
            && !/Idle site/i.test(text)
            && !/free citizens/i.test(text)
            && !/builder job/i.test(text),
          `${building.type} construction panel advertised a fake citizen crew`,
        );
        requireCondition(
          !Object.hasOwn(citizenPanel.dataset, 'citizenActorId'),
          `${building.type} construction panel retained a citizen actor tag`,
        );
        return { type: building.type, text };
      });

      const targetEvents = events.filter(event => event.actorId === target.actorId);
      const professionEvents = targetEvents.filter(event => event.field === 'profession');
      const namesakeEvents = targetEvents.filter(event => (
        event.field === 'identity' && event.reason === 'story-namesake'
      ));
      requireCondition(professionEvents.length === 1, 'Lifecycle emitted a second profession transition');
      requireCondition(namesakeEvents.length === 1, 'Namesake did not emit exactly one causal identity transition');
      requireCondition(
        namesakeEvents[0].newValue.name === target.identity.name,
        'Namesake event disagrees with current identity',
      );
      requireCondition(target.actorId === stable.actorId, 'Namesake changed actor ID');
      requireCondition(target.identity.appearanceId === stable.appearanceId, 'Namesake changed appearance');
      requireCondition(target.profession.kind === 'miner', 'Namesake changed profession');
      requireCondition(
        phases.every(entry => entry.variant === 'miner' && entry.profession === 'miner'),
        'At least one lifecycle presentation morphed away from miner',
      );

      return {
        actorId: target.actorId,
        finalName: target.identity.name,
        appearanceId: target.identity.appearanceId,
        profession: target.profession.kind,
        mineApproachTicks,
        deliveryApproachTicks,
        routeRecoveryTicks,
        forageTicks,
        sleepApproachTicks,
        storyTicks,
        carryAmount,
        restBeforeRecovery,
        restAfterRecovery,
        phaseLabels: phases.map(entry => entry.label),
        phases,
        citizenPanelBeforeRemoval,
        citizenPanelAfterRemoval,
        infrastructurePanels,
        eventReasons: targetEvents.map(event => `${event.field}:${event.reason}`),
        professionEvents: professionEvents.length,
        namesakeEvents: namesakeEvents.length,
      };
    } finally {
      off();
    }
  });

  assert.equal(result.profession, 'miner');
  assert.equal(result.professionEvents, 1);
  assert.equal(result.namesakeEvents, 1);
  assert.ok(result.carryAmount > 0);
  assert.ok(result.restAfterRecovery > result.restBeforeRecovery);
  assert.equal(result.citizenPanelBeforeRemoval.actorId, String(result.actorId));
  assert.equal(result.citizenPanelAfterRemoval.display, 'none');
  assert.equal(result.citizenPanelAfterRemoval.actorId, null);
  assert.equal(result.citizenPanelAfterRemoval.selectedCitizenId, null);
  assert.deepEqual(result.infrastructurePanels.map(panel => panel.type), ['road', 'wall']);
  assert.ok(result.infrastructurePanels.every(panel => (
    panel.text.includes('Realm-laid infrastructure')
    && !/\b\d+\s*\/\s*2\b/.test(panel.text)
  )));
  assert.deepEqual(result.phaseLabels, [
    'mine-work',
    'mine-carry',
    'mine-deliver',
    'mine-delivered',
    'path-failure-recovery',
    'path-recovered-work',
    'food-crisis-cover',
    'food-crisis-forage',
    'food-crisis-forage-complete',
    'eat',
    'sleep',
    'wake-recovery',
    'causal-namesake',
  ]);
  for (const reason of [
    'profession:first-vocation',
    'activity:cargo-ready',
    'activity:cargo-delivered',
    'assignment:path-unreachable',
    'activity:path-unreachable',
    'assignment:food-crisis',
    'activity:food-crisis',
    'activity:forage-started',
    'activity:forage-complete',
    'activity:eat-food',
    'activity:sleep-rest',
    'activity:wake-day',
    'identity:story-namesake',
  ]) {
    assert.ok(result.eventReasons.includes(reason), `Missing browser lifecycle event ${reason}`);
  }
  assert.ok(result.phases.every(entry => (
    entry.actorId === result.actorId
    && entry.appearanceId === result.appearanceId
    && entry.profession === 'miner'
    && entry.variant === 'miner'
  )));
  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' | ')}`);

  console.log(`✓ actor #${result.actorId} established miner vocation and reached real mine work in ${result.mineApproachTicks} ticks`);
  console.log(`✓ real ${result.carryAmount}-iron cargo crossed carry → deliver in ${result.deliveryApproachTicks} ticks without role morph`);
  console.log(`✓ route failure emitted causal recovery and returned to mine work in ${result.routeRecoveryTicks} ticks`);
  console.log(`✓ food crisis used temporary farm cover, then completed forage in ${result.forageTicks} ticks`);
  console.log(`✓ eat, sleep, and dawn recovery preserved actor ID, appearance, and miner profession (rest ${result.restBeforeRecovery.toFixed(1)} → ${result.restAfterRecovery.toFixed(1)})`);
  console.log(`✓ story@60 causally renamed the same actor to ${result.finalName} after ${result.storyTicks} ticks`);
  console.log(`✓ actor-tagged snapshot panel opened for #${result.actorId}, then closed and cleared after domain removal`);
  console.log('✓ road and wall construction panels identify realm-laid infrastructure without fake builder crews');
  console.log(`✓ ${result.phases.length} native browser lifecycle snapshots all selected the miner renderer variant`);
  console.log(`[engine-v2-citizen-lifecycle-browser] OK — realm${REVISION}`);
} finally {
  await browser.close();
  await server.stop();
}
