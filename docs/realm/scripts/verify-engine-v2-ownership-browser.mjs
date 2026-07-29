#!/usr/bin/env node

// Browser acceptance gate for Engine v2 Phase 1A citizen ownership.
// The fixture enters through the real title screen, mutates gameplay through
// current commands/ownership APIs, reads the normal population UI, and crosses
// the public save/Continue boundary. It deliberately defines no source adapter
// or alternate actor/building shape.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
const REVISION = contract.moduleRevision;
assert.equal(REVISION, 166, 'Update this gate together with current browser module URLs');

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
  await page.goto(`${server.gameUrl}?v=engine-v2-ownership-browser-${REVISION}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.dispatch);

  await page.locator('#kingdom-name-input').fill('Ownership Browser Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => (
    !document.body.classList.contains('title-active')
    && window.G?.citizens?.length === 3
  ));
  await page.evaluate(() => window.setSpeed(0));

  const ownership = await page.evaluate(async () => {
    const economy = await import('./js/economy.js?realm=166');
    const ownershipModule = await import('./js/citizen-ownership.js?realm=166');
    const presentation = await import('./js/citizen-presentation.js?realm=166');
    const renderCache = await import('./js/citizen-render-cache.js?realm=166');
    const g = window.G;

    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const dispatch = command => {
      const result = g.debug.dispatch(command);
      if (!result.ok) throw new Error(`${command.type} failed: ${result.reason}`);
      return result;
    };
    const place = type => {
      for (let y = 1; y < g.map.length - 1; y++) {
        for (let x = 1; x < g.map[y].length - 1; x++) {
          if (!economy.canPlace(type, x, y)) continue;
          dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
          const building = g.buildingGrid[y][x];
          requireCondition(building?.type === type, `${type} command did not populate the grid`);
          return building;
        }
      }
      throw new Error(`No real map placement found for ${type}`);
    };
    const completeWithCrew = (citizen, building) => {
      citizen.x = building.x;
      citizen.y = building.y;
      citizen.tx = building.x;
      citizen.ty = building.y;
      ownershipModule.transitionCitizenActivity(citizen, 'working', 'arrived-at-work');
      citizen.activityTimer = 10;
      building.buildProgress = 1 - (1 / building.buildTotal);
      economy.updateProduction();
      requireCondition(building.buildProgress === 1, `${building.type} did not complete through updateProduction`);
      requireCondition(citizen.assignment === null, `${building.type} completion did not release its crew`);
    };
    const hasRemovedCitizenField = citizen => (
      ['name', 'jobBuilding', 'visualJob', 'state', 'stateTimer']
        .some(key => Object.hasOwn(citizen, key))
    );

    g.debug.disableEvents = true;
    g.nextRaidDay = 9999;
    Object.assign(g.resources, {
      wood: 10000,
      stone: 10000,
      food: 10000,
      gold: 10000,
      iron: 10000,
      wheat: 10000,
      flour: 10000,
      planks: 10000,
      tools: 10000,
    });
    for (const row of g.fog) row.fill(true);

    const initialActorIds = g.citizens.map(citizen => citizen.actorId);
    requireCondition(
      initialActorIds.every(id => Number.isSafeInteger(id) && id > 0)
        && new Set(initialActorIds).size === initialActorIds.length,
      'New Game did not create unique positive-safe citizen IDs',
    );
    requireCondition(g.nextActorId > Math.max(...initialActorIds), 'New Game allocator did not advance');
    requireCondition(g.citizens.every(citizen => !hasRemovedCitizenField(citizen)), 'New Game emitted a removed citizen field');

    const events = [];
    ownershipModule.onCitizenTransition(event => events.push(event));
    const citizen = g.citizens[0];
    const duplicate = g.citizens[1];
    const actorId = citizen.actorId;
    const duplicateActorId = duplicate.actorId;
    const appearanceId = citizen.identity.appearanceId;
    ownershipModule.renameCitizen(citizen, 'Twin Browser Citizen', 'player-rename');
    ownershipModule.renameCitizen(duplicate, 'Twin Browser Citizen', 'player-rename');
    requireCondition(citizen.actorId === actorId && duplicate.actorId === duplicateActorId, 'Rename changed a stable actor ID');
    requireCondition(actorId !== duplicateActorId, 'Duplicate names collapsed actor identity');

    // A construction claim is temporary. Completion causally releases it;
    // only the subsequent accepted claim on the completed workplace establishes
    // the durable vocation.
    const farm = place('farm');
    dispatch({ type: 'ASSIGN_CITIZEN', actorId, x: farm.x, y: farm.y });
    requireCondition(citizen.assignment?.purpose === 'temporary', 'Construction claim was not temporary');
    requireCondition(citizen.profession.kind === 'settler', 'Construction claim morphed profession');
    completeWithCrew(citizen, farm);
    requireCondition(citizen.profession.kind === 'settler', 'Construction completion morphed profession');

    dispatch({ type: 'ASSIGN_CITIZEN', actorId, x: farm.x, y: farm.y });
    const vocationSnapshot = presentation.buildCitizenPresentation(citizen, { selectedActorId: actorId });
    requireCondition(vocationSnapshot.profession.kind === 'farmer', 'Completed farm did not establish farmer vocation');
    requireCondition(vocationSnapshot.assignment?.purpose === 'vocation', 'Compatible completed work was not a vocation assignment');
    requireCondition(vocationSnapshot.variant === 'farmer', 'Vocation snapshot selected the wrong painted role');
    dispatch({ type: 'RELEASE_CITIZEN', actorId });
    requireCondition(citizen.profession.kind === 'farmer' && citizen.assignment === null, 'Command release erased durable profession');

    // Construction and then completed-work mismatch both remain visible,
    // temporary duties on the same durable farmer identity.
    const market = place('market');
    dispatch({ type: 'ASSIGN_CITIZEN', actorId, x: market.x, y: market.y });
    const constructionSnapshot = presentation.buildCitizenPresentation(citizen, { selectedActorId: actorId });
    requireCondition(constructionSnapshot.profession.kind === 'farmer', 'Construction duty changed farmer profession');
    requireCondition(constructionSnapshot.assignment?.purpose === 'temporary', 'Construction duty lost temporary purpose');
    requireCondition(constructionSnapshot.assignment?.duty === 'construction', 'Construction duty was not explicit');
    requireCondition(constructionSnapshot.variant === 'farmer', 'Construction snapshot morphed to another body');
    completeWithCrew(citizen, market);

    dispatch({ type: 'ASSIGN_CITIZEN', actorId, x: market.x, y: market.y });
    const mismatchSnapshot = presentation.buildCitizenPresentation(citizen, { selectedActorId: actorId });
    requireCondition(mismatchSnapshot.profession.kind === 'farmer', 'Mismatched completed work changed profession');
    requireCondition(mismatchSnapshot.assignment?.purpose === 'temporary', 'Mismatched completed work was not temporary');
    requireCondition(mismatchSnapshot.assignment?.duty === 'market', 'Mismatched duty did not identify the workplace');
    requireCondition(mismatchSnapshot.variant === 'farmer', 'Mismatch snapshot morphed painted role');
    requireCondition(mismatchSnapshot.activity.kind === 'walk_to_work', 'Command assignment did not expose current activity');
    requireCondition(
      Object.isFrozen(mismatchSnapshot)
        && Object.isFrozen(mismatchSnapshot.identity)
        && Object.isFrozen(mismatchSnapshot.profession)
        && Object.isFrozen(mismatchSnapshot.assignment)
        && Object.isFrozen(mismatchSnapshot.assignment.building)
        && Object.isFrozen(mismatchSnapshot.activity),
      'Citizen presentation snapshot is mutable',
    );
    requireCondition(
      mismatchSnapshot.assignment.building !== market,
      'Presentation snapshot leaked its live building reference',
    );
    requireCondition(
      presentation.presentationActionForActivity(mismatchSnapshot.activity.kind, mismatchSnapshot.carrying, true) === 'walk',
      'Presentation activity did not select the expected movement action',
    );

    g.selectedCitizenId = actorId;
    window.forceRender();
    const cacheAfterRender = renderCache.inspectCitizenRenderCache();
    const liveIds = new Set(g.citizens.map(value => value.actorId));
    requireCondition(cacheAfterRender.length <= g.citizens.length, 'Citizen render cache exceeded the live population');
    requireCondition(cacheAfterRender.every(record => liveIds.has(record.actorId)), 'Citizen render cache retained a non-live ID');

    // serializeGame() captures the complete current-runtime save graph: every
    // authoritative enumerable G field plus saved player-history state, while
    // excluding only STATE_OWNERSHIP-declared process/render/replay state.
    // Byte equality here is therefore at least as strict as the RFC's
    // authoritative-state equality requirement. The hash makes the exact
    // evidence compact enough to report without returning the full graph.
    const saveState = await import('./js/save-state.js?realm=166');
    const stateModule = await import('./js/state.js?realm=166');
    const hashText = async text => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    };
    const renderStateBefore = JSON.stringify(saveState.serializeGame({ savedAt: 0 }).state);
    const renderHashBefore = await hashText(renderStateBefore);
    const renderTickBefore = g.gameTick;
    const renderSeedBefore = stateModule.getSeed();
    window.forceRender();
    window.forceRender();
    window.forceRender();
    const renderStateAfter = JSON.stringify(saveState.serializeGame({ savedAt: 0 }).state);
    const renderHashAfter = await hashText(renderStateAfter);
    requireCondition(renderStateAfter === renderStateBefore, 'Repeated full renders changed current-runtime state bytes');
    requireCondition(renderHashAfter === renderHashBefore, 'Repeated full renders changed the current-runtime state hash');
    requireCondition(g.gameTick === renderTickBefore, 'Repeated full renders advanced the simulation tick');
    requireCondition(stateModule.getSeed() === renderSeedBefore, 'Repeated full renders consumed simulation RNG');

    window.togglePopPanel();
    return {
      actorId,
      duplicateActorId,
      appearanceId,
      initialActorIds,
      nextActorId: g.nextActorId,
      farm: { type: farm.type, x: farm.x, y: farm.y },
      market: { type: market.type, x: market.x, y: market.y },
      vocation: {
        profession: vocationSnapshot.profession.kind,
        purpose: vocationSnapshot.assignment.purpose,
        variant: vocationSnapshot.variant,
      },
      construction: {
        profession: constructionSnapshot.profession.kind,
        purpose: constructionSnapshot.assignment.purpose,
        duty: constructionSnapshot.assignment.duty,
        variant: constructionSnapshot.variant,
      },
      mismatch: {
        profession: mismatchSnapshot.profession.kind,
        purpose: mismatchSnapshot.assignment.purpose,
        duty: mismatchSnapshot.assignment.duty,
        activity: mismatchSnapshot.activity.kind,
        variant: mismatchSnapshot.variant,
      },
      renderPurity: {
        bytes: new TextEncoder().encode(renderStateBefore).byteLength,
        hashBefore: renderHashBefore,
        hashAfter: renderHashAfter,
        tickBefore: renderTickBefore,
        tickAfter: g.gameTick,
        seedStable: stateModule.getSeed() === renderSeedBefore,
      },
      cacheAfterRender: cacheAfterRender.length,
      eventReasons: events.map(event => `${event.field}:${event.reason}`),
      professionEvents: events.filter(event => event.field === 'profession').length,
      appearanceStable: citizen.identity.appearanceId === appearanceId,
      duplicateNames: g.citizens.filter(value => value.identity.name === 'Twin Browser Citizen').length,
      removedCitizenFields: g.citizens.some(hasRemovedCitizenField),
      removedBuildingWorkers: g.buildings.some(building => Object.hasOwn(building, 'workers')),
    };
  });

  assert.deepEqual(ownership.initialActorIds, [1, 2, 3]);
  assert.equal(ownership.duplicateNames, 2);
  assert.notEqual(ownership.actorId, ownership.duplicateActorId);
  assert.equal(ownership.appearanceStable, true);
  assert.equal(ownership.vocation.profession, 'farmer');
  assert.equal(ownership.vocation.purpose, 'vocation');
  assert.equal(ownership.vocation.variant, 'farmer');
  assert.deepEqual(ownership.construction, {
    profession: 'farmer',
    purpose: 'temporary',
    duty: 'construction',
    variant: 'farmer',
  });
  assert.deepEqual(ownership.mismatch, {
    profession: 'farmer',
    purpose: 'temporary',
    duty: 'market',
    activity: 'walk_to_work',
    variant: 'farmer',
  });
  assert.equal(ownership.professionEvents, 1, 'Only the first vocation may establish profession');
  assert.ok(ownership.eventReasons.includes('assignment:construction-complete'));
  assert.ok(ownership.eventReasons.includes('activity:construction-complete'));
  assert.equal(ownership.removedCitizenFields, false);
  assert.equal(ownership.removedBuildingWorkers, false);
  assert.ok(ownership.renderPurity.bytes > 0);
  assert.match(ownership.renderPurity.hashBefore, /^[0-9a-f]{64}$/);
  assert.equal(ownership.renderPurity.hashAfter, ownership.renderPurity.hashBefore);
  assert.equal(ownership.renderPurity.tickAfter, ownership.renderPurity.tickBefore);
  assert.equal(ownership.renderPurity.seedStable, true);

  const populationUi = await page.evaluate(actorId => {
    const rows = [...document.querySelectorAll('#pop-content .pop-row')];
    const row = rows.find(candidate => (
      candidate.querySelector(`.pop-unassign[data-actor-id="${actorId}"]`)
    ));
    const state = row?.querySelector('.pop-state');
    return {
      panelDisplay: document.getElementById('pop-panel')?.style.display,
      header: document.querySelector('#pop-content .pop-header')?.textContent || '',
      rowFound: !!row,
      name: row?.querySelector('.pop-name')?.textContent || '',
      profession: row?.querySelector('.pop-job')?.textContent || '',
      task: state?.textContent || '',
      taskTitle: state?.getAttribute('title') || '',
      duplicateNameRows: [...document.querySelectorAll('#pop-content .pop-name')]
        .filter(node => node.textContent === 'Twin Browser Citizen').length,
    };
  }, ownership.actorId);

  assert.equal(populationUi.panelDisplay, 'block');
  assert.match(populationUi.header, /Vocation/);
  assert.match(populationUi.header, /Current task/);
  assert.equal(populationUi.rowFound, true);
  assert.equal(populationUi.name, 'Twin Browser Citizen');
  assert.equal(populationUi.profession, 'Farmer');
  assert.match(populationUi.task, /Helping:\s*Market/);
  assert.match(populationUi.task, /Going to work/);
  assert.match(populationUi.taskTitle, /temporary/);
  assert.match(populationUi.taskTitle, /market/);
  assert.equal(populationUi.duplicateNameRows, 2);

  // Use the normal population button, not a direct state write, to prove that
  // actor-ID release remains unambiguous with duplicate display names.
  await page.locator(`.pop-unassign[data-actor-id="${ownership.actorId}"]`).click();
  const released = await page.evaluate(({ actorId, duplicateActorId }) => {
    const citizen = window.G.citizens.find(value => value.actorId === actorId);
    const duplicate = window.G.citizens.find(value => value.actorId === duplicateActorId);
    return {
      assignment: citizen.assignment,
      profession: citizen.profession.kind,
      activity: citizen.activity.kind,
      duplicateAssignment: duplicate.assignment,
      duplicateProfession: duplicate.profession.kind,
    };
  }, { actorId: ownership.actorId, duplicateActorId: ownership.duplicateActorId });
  assert.equal(released.assignment, null);
  assert.equal(released.profession, 'farmer');
  assert.equal(released.activity, 'idle');
  assert.equal(released.duplicateAssignment, null);
  assert.equal(released.duplicateProfession, 'settler');

  const removal = await page.evaluate(async ({ actorId }) => {
    const economy = await import('./js/economy.js?realm=166');
    const ownershipModule = await import('./js/citizen-ownership.js?realm=166');
    const g = window.G;
    const events = [];
    const off = ownershipModule.onCitizenTransition(event => events.push(event));
    const dispatch = command => {
      const result = g.debug.dispatch(command);
      if (!result.ok) throw new Error(`${command.type} failed: ${result.reason}`);
      return result;
    };
    const place = type => {
      for (let y = 1; y < g.map.length - 1; y++) {
        for (let x = 1; x < g.map[y].length - 1; x++) {
          if (!economy.canPlace(type, x, y)) continue;
          dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
          return g.buildingGrid[y][x];
        }
      }
      throw new Error(`No real map placement found for ${type}`);
    };

    try {
      const citizen = ownershipModule.findCitizenByActorId(actorId);
      const site = place('tavern');
      dispatch({ type: 'ASSIGN_CITIZEN', actorId, x: site.x, y: site.y });
      const purposeBefore = citizen.assignment?.purpose;
      const dutyBefore = citizen.assignment?.duty;
      const professionBefore = citizen.profession.kind;
      dispatch({ type: 'DEMOLISH', x: site.x, y: site.y });
      return {
        locator: { type: site.type, x: site.x, y: site.y },
        purposeBefore,
        dutyBefore,
        professionBefore,
        professionAfter: citizen.profession.kind,
        assignmentAfter: citizen.assignment,
        activityAfter: citizen.activity.kind,
        liveAfter: g.buildings.includes(site),
        gridAfter: g.buildingGrid[site.y][site.x],
        staffingAfter: ownershipModule.workersForBuilding(site).length,
        hasWorkersField: Object.hasOwn(site, 'workers'),
        causalReasons: events.map(event => `${event.field}:${event.reason}`),
      };
    } finally {
      off();
    }
  }, { actorId: ownership.actorId });

  assert.equal(removal.purposeBefore, 'temporary');
  assert.equal(removal.dutyBefore, 'construction');
  assert.equal(removal.professionBefore, 'farmer');
  assert.equal(removal.professionAfter, 'farmer');
  assert.equal(removal.assignmentAfter, null);
  assert.equal(removal.activityAfter, 'find_job');
  assert.equal(removal.liveAfter, false);
  assert.equal(removal.gridAfter, null);
  assert.equal(removal.staffingAfter, 0);
  assert.equal(removal.hasWorkersField, false);
  assert.ok(removal.causalReasons.includes('assignment:building-removed'));
  assert.ok(removal.causalReasons.includes('activity:building-removed'));

  const actorCacheLifecycle = await page.evaluate(async ({ victimActorId }) => {
    const combat = await import('./js/combat.js?realm=166');
    const economy = await import('./js/economy.js?realm=166');
    const renderCache = await import('./js/citizen-render-cache.js?realm=166');
    const g = window.G;
    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    const victim = g.citizens.find(citizen => citizen.actorId === victimActorId);
    requireCondition(victim, `Missing lifecycle victim actor #${victimActorId}`);
    const populationBefore = g.population;
    const nextActorIdBeforeDeath = g.nextActorId;
    const deathsBefore = g.stats.citizensDied;
    const birthsBefore = g.stats.citizensBorn;

    // Populate the cache through the real renderer, then tag the renderer-only
    // record so actor-ID reuse or record inheritance would be observable.
    window.forceRender();
    const victimRecord = renderCache.citizenRenderRecord(victimActorId);
    victimRecord.animationKey = 'death-spawn-lifecycle-sentinel';
    victimRecord.laneX = 0.375;

    // updateEnemies() owns the canonical combat-death cleanup path. It releases
    // assignment state, removes the citizen, advances death accounting, and
    // leaves presentation cleanup to the next render pass.
    victim.hp = 0;
    combat.updateEnemies();
    const cacheAfterDeathBeforeRender = renderCache.inspectCitizenRenderCache();
    requireCondition(
      !g.citizens.some(citizen => citizen.actorId === victimActorId),
      'Canonical combat death retained the dead citizen',
    );
    requireCondition(g.population === populationBefore - 1, 'Canonical combat death did not decrement population');
    requireCondition(g.nextActorId === nextActorIdBeforeDeath, 'Death advanced or rewound the actor allocator');
    requireCondition(g.stats.citizensDied === deathsBefore + 1, 'Canonical combat death did not advance death accounting');
    requireCondition(
      cacheAfterDeathBeforeRender.some(record => (
        record.actorId === victimActorId
        && record.animationKey === 'death-spawn-lifecycle-sentinel'
      )),
      'Lifecycle fixture never established the dead actor render record',
    );

    window.forceRender();
    const cacheAfterDeathRender = renderCache.inspectCitizenRenderCache();
    requireCondition(
      !cacheAfterDeathRender.some(record => record.actorId === victimActorId),
      'Full render did not prune the dead actor render record',
    );

    // trySpawnSettlers() is the production immigration/spawn path. The empty
    // population slot created above makes exactly one spawn legal without
    // altering capacity or fabricating an actor object in the fixture.
    const expectedSpawnActorId = g.nextActorId;
    economy.trySpawnSettlers(1);
    const spawned = g.citizens.find(citizen => citizen.actorId === expectedSpawnActorId);
    requireCondition(spawned, 'Production immigration did not spawn the expected actor ID');
    requireCondition(spawned.actorId > victimActorId, 'Production spawn reused a dead actor ID');
    requireCondition(g.population === populationBefore, 'Production spawn did not restore population');
    requireCondition(g.nextActorId === expectedSpawnActorId + 1, 'Production spawn did not advance the allocator once');
    requireCondition(g.stats.citizensBorn === birthsBefore + 1, 'Production spawn did not advance birth accounting');

    window.forceRender();
    const cacheAfterSpawnRender = renderCache.inspectCitizenRenderCache();
    const spawnedRecord = cacheAfterSpawnRender.find(record => record.actorId === spawned.actorId);
    const liveIds = new Set(g.citizens.map(citizen => citizen.actorId));
    requireCondition(spawnedRecord, 'Full render did not create the spawned actor render record');
    requireCondition(
      spawnedRecord.animationKey !== 'death-spawn-lifecycle-sentinel'
        && spawnedRecord.laneX !== 0.375,
      'Spawned actor inherited renderer continuity from the dead actor',
    );
    requireCondition(
      cacheAfterSpawnRender.length <= g.citizens.length
        && cacheAfterSpawnRender.every(record => liveIds.has(record.actorId)),
      'Death/spawn render cache is not bounded by live actor IDs',
    );

    return {
      victimActorId,
      spawnedActorId: spawned.actorId,
      nextActorIdBeforeDeath,
      nextActorIdAfterSpawn: g.nextActorId,
      cacheContainedVictimBeforePrune: cacheAfterDeathBeforeRender.some(record => record.actorId === victimActorId),
      cacheContainedVictimAfterPrune: cacheAfterDeathRender.some(record => record.actorId === victimActorId),
      cacheContainedSpawnAfterRender: !!spawnedRecord,
      cacheSize: cacheAfterSpawnRender.length,
      population: g.population,
    };
  }, { victimActorId: ownership.initialActorIds.at(-1) });

  assert.equal(actorCacheLifecycle.victimActorId, 3);
  assert.equal(actorCacheLifecycle.spawnedActorId, actorCacheLifecycle.nextActorIdBeforeDeath);
  assert.ok(actorCacheLifecycle.spawnedActorId > actorCacheLifecycle.victimActorId);
  assert.equal(actorCacheLifecycle.nextActorIdAfterSpawn, actorCacheLifecycle.spawnedActorId + 1);
  assert.equal(actorCacheLifecycle.cacheContainedVictimBeforePrune, true);
  assert.equal(actorCacheLifecycle.cacheContainedVictimAfterPrune, false);
  assert.equal(actorCacheLifecycle.cacheContainedSpawnAfterRender, true);
  assert.ok(actorCacheLifecycle.cacheSize <= actorCacheLifecycle.population);

  const midpoint = await page.evaluate(async ({ actorId, farm }) => {
    const ownershipModule = await import('./js/citizen-ownership.js?realm=166');
    const renderCache = await import('./js/citizen-render-cache.js?realm=166');
    const save = await import('./js/save.js?realm=166');
    const g = window.G;
    const result = g.debug.dispatch({ type: 'ASSIGN_CITIZEN', actorId, x: farm.x, y: farm.y });
    if (!result.ok) throw new Error(`Midpoint assignment failed: ${result.reason}`);
    const citizen = ownershipModule.findCitizenByActorId(actorId);
    g.selectedCitizenId = actorId;

    window.forceRender();
    window.forceRender();
    renderCache.citizenRenderRecord(Number.MAX_SAFE_INTEGER - 1).animationKey = 'stale-browser-probe';
    const withStaleRecord = renderCache.citizenRenderCacheSize();
    window.forceRender();
    const cache = renderCache.inspectCitizenRenderCache();
    const liveIds = new Set(g.citizens.map(value => value.actorId));

    const ok = save.saveGame({ silent: false });
    const raw = localStorage.getItem('realm-engine-v2-save');
    return {
      ok,
      rawPresent: typeof raw === 'string' && raw.length > 0,
      actorId: citizen.actorId,
      name: citizen.identity.name,
      appearanceId: citizen.identity.appearanceId,
      profession: citizen.profession.kind,
      assignmentType: citizen.assignment?.building.type || null,
      assignmentPurpose: citizen.assignment?.purpose || null,
      nextActorId: g.nextActorId,
      withStaleRecord,
      cacheSize: cache.length,
      cacheBounded: cache.length <= g.citizens.length,
      cacheOnlyLive: cache.every(record => liveIds.has(record.actorId)),
      noRemovedCitizenFields: g.citizens.every(value => (
        ['name', 'jobBuilding', 'visualJob', 'state', 'stateTimer']
          .every(key => !Object.hasOwn(value, key))
      )),
      noBuildingWorkers: g.buildings.every(value => !Object.hasOwn(value, 'workers')),
      saveHasRemovedAssignmentFields: /jobBuilding|visualJob/.test(raw || ''),
      saveHasWorkerAuthority: /"workers"/.test(raw || ''),
    };
  }, { actorId: ownership.actorId, farm: ownership.farm });

  assert.equal(midpoint.ok, true);
  assert.equal(midpoint.rawPresent, true);
  assert.equal(midpoint.actorId, ownership.actorId);
  assert.equal(midpoint.name, 'Twin Browser Citizen');
  assert.equal(midpoint.appearanceId, ownership.appearanceId);
  assert.equal(midpoint.profession, 'farmer');
  assert.equal(midpoint.assignmentType, 'farm');
  assert.equal(midpoint.assignmentPurpose, 'vocation');
  assert.ok(midpoint.withStaleRecord > midpoint.cacheSize, 'Render pass did not prune an absent actor ID');
  assert.equal(midpoint.cacheBounded, true);
  assert.equal(midpoint.cacheOnlyLive, true);
  assert.equal(midpoint.noRemovedCitizenFields, true);
  assert.equal(midpoint.noBuildingWorkers, true);
  assert.equal(midpoint.saveHasRemovedAssignmentFields, false);
  assert.equal(midpoint.saveHasWorkerAuthority, false);

  const inGameLoadLedger = await page.evaluate(async ({ actorId, savedName }) => {
    const inspector = await import('./js/citizen-inspector.js?realm=166');
    const ownershipModule = await import('./js/citizen-ownership.js?realm=166');
    const save = await import('./js/save.js?realm=166');
    window.realmNpcDebug.enable(true);
    inspector.resetCitizenTransitionLedger();
    const citizen = window.G.citizens.find(value => value.actorId === actorId);
    ownershipModule.renameCitizen(citizen, 'In-game Load Ledger Sentinel', 'player-rename');
    const beforeLoad = inspector.getCitizenTransitionLedger({ limit: 2_000 }).length;
    const loaded = save.loadGame();
    return {
      beforeLoad,
      loaded,
      afterLoad: inspector.getCitizenTransitionLedger({ limit: 2_000 }).length,
      restoredName: window.G.citizens.find(value => value.actorId === actorId)?.identity.name || null,
      savedName,
    };
  }, { actorId: midpoint.actorId, savedName: midpoint.name });

  assert.ok(inGameLoadLedger.beforeLoad > 0);
  assert.equal(inGameLoadLedger.loaded, true);
  assert.equal(inGameLoadLedger.afterLoad, 0);
  assert.equal(inGameLoadLedger.restoredName, inGameLoadLedger.savedName);

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.loadAndStart === 'function');

  const continued = await page.evaluate(async ({ actorId }) => {
    const renderCache = await import('./js/citizen-render-cache.js?realm=166');
    const staleActorId = Number.MAX_SAFE_INTEGER - 2;
    renderCache.citizenRenderRecord(staleActorId).animationKey = 'continue-reset-browser-probe';
    const cacheBeforeLoad = renderCache.citizenRenderCacheSize();
    window.loadAndStart();
    const g = window.G;
    const citizen = g.citizens.find(value => value.actorId === actorId);
    const cacheAfterLoad = renderCache.inspectCitizenRenderCache();
    const liveIds = new Set(g.citizens.map(value => value.actorId));
    const noRemovedCitizenFields = g.citizens.every(value => (
      ['name', 'jobBuilding', 'visualJob', 'state', 'stateTimer']
        .every(key => !Object.hasOwn(value, key))
    ));
    window.forceRender();
    return {
      titleActive: document.body.classList.contains('title-active'),
      actorFound: !!citizen,
      name: citizen?.identity.name || null,
      appearanceId: citizen?.identity.appearanceId || null,
      profession: citizen?.profession.kind || null,
      assignmentType: citizen?.assignment?.building.type || null,
      assignmentPurpose: citizen?.assignment?.purpose || null,
      duplicateNames: g.citizens.filter(value => value.identity.name === 'Twin Browser Citizen').length,
      nextActorId: g.nextActorId,
      selectedCitizenId: g.selectedCitizenId,
      cacheBeforeLoad,
      cacheAfterLoad: cacheAfterLoad.length,
      cacheAfterLoadOnlyLive: cacheAfterLoad.every(record => liveIds.has(record.actorId)),
      staleCacheReset: !cacheAfterLoad.some(record => record.actorId === staleActorId),
      cacheAfterRender: renderCache.citizenRenderCacheSize(),
      population: g.citizens.length,
      noRemovedCitizenFields,
      noBuildingWorkers: g.buildings.every(value => !Object.hasOwn(value, 'workers')),
    };
  }, { actorId: ownership.actorId });

  assert.equal(continued.titleActive, false);
  assert.equal(continued.actorFound, true);
  assert.equal(continued.name, midpoint.name);
  assert.equal(continued.appearanceId, midpoint.appearanceId);
  assert.equal(continued.profession, midpoint.profession);
  assert.equal(continued.assignmentType, midpoint.assignmentType);
  assert.equal(continued.assignmentPurpose, midpoint.assignmentPurpose);
  assert.equal(continued.duplicateNames, 2);
  assert.equal(continued.nextActorId, midpoint.nextActorId);
  assert.equal(continued.selectedCitizenId, null);
  assert.equal(continued.cacheBeforeLoad, 1);
  assert.equal(continued.staleCacheReset, true, 'Continue retained a stale renderer-owned citizen record');
  assert.equal(continued.cacheAfterLoadOnlyLive, true);
  assert.ok(continued.cacheAfterLoad <= continued.population);
  assert.ok(continued.cacheAfterRender <= continued.population);
  assert.equal(continued.noRemovedCitizenFields, true);
  assert.equal(continued.noBuildingWorkers, true);

  const reset = await page.evaluate(async () => {
    const inspector = await import('./js/citizen-inspector.js?realm=166');
    const ownershipModule = await import('./js/citizen-ownership.js?realm=166');
    const renderCache = await import('./js/citizen-render-cache.js?realm=166');
    window.realmNpcDebug.enable(true);
    inspector.resetCitizenTransitionLedger();
    ownershipModule.renameCitizen(window.G.citizens[0], 'New Game Ledger Sentinel', 'player-rename');
    renderCache.citizenRenderRecord(777).animationKey = 'reset-browser-probe';
    const cacheBefore = renderCache.citizenRenderCacheSize();
    const ledgerBefore = inspector.getCitizenTransitionLedger({ limit: 2_000 }).length;
    window.newGame();
    return {
      cacheBefore,
      cacheAfter: renderCache.citizenRenderCacheSize(),
      ledgerBefore,
      ledgerAfter: inspector.getCitizenTransitionLedger({ limit: 2_000 }).length,
      actorIds: window.G.citizens.map(citizen => citizen.actorId),
      nextActorId: window.G.nextActorId,
      selectedCitizenId: window.G.selectedCitizenId,
      removedCitizenFields: window.G.citizens.some(citizen => (
        ['name', 'jobBuilding', 'visualJob', 'state', 'stateTimer']
          .some(key => Object.hasOwn(citizen, key))
      )),
    };
  });

  assert.ok(reset.cacheBefore > 0);
  assert.equal(reset.cacheAfter, 0);
  assert.ok(reset.ledgerBefore > 0);
  assert.equal(reset.ledgerAfter, 0);
  assert.deepEqual(reset.actorIds, [1, 2, 3]);
  assert.equal(reset.nextActorId, 4);
  assert.equal(reset.selectedCitizenId, null);
  assert.equal(reset.removedCitizenFields, false);
  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' | ')}`);

  console.log(`✓ real New Game created stable citizen IDs ${ownership.initialActorIds.join(', ')}; duplicate names remained actor-ID distinct`);
  console.log('✓ settler → farmer vocation happened once; construction and market mismatch stayed temporary without role morph');
  console.log('✓ population UI showed Farmer + Helping: Market + current activity, and actor-ID release selected the correct duplicate');
  console.log(`✓ construction completion and ${removal.locator.type} removal emitted causal cleanup and left zero derived staff`);
  console.log(`✓ three full renders preserved ${ownership.renderPurity.bytes.toLocaleString()} current-runtime bytes and SHA-256 ${ownership.renderPurity.hashBefore.slice(0, 20)}…`);
  console.log(`✓ combat death pruned actor #${actorCacheLifecycle.victimActorId}; immigration spawned fresh actor #${actorCacheLifecycle.spawnedActorId} with isolated cache continuity`);
  console.log(`✓ render cache pruned stale IDs, stayed ≤ ${midpoint.cacheSize}, reset on Continue/New Game`);
  console.log('✓ transition ledger reset on successful in-game load and in-game New Game');
  console.log(`✓ midpoint save/Continue preserved actor #${midpoint.actorId}, duplicate names, farmer vocation, and farm assignment`);
  console.log('✓ live and saved citizen/building surfaces contain no removed ownership fields');
  console.log(`[engine-v2-ownership-browser] OK — realm${REVISION}`);
} finally {
  await browser.close();
  await server.stop();
}
