#!/usr/bin/env node

// Browser acceptance gate for completed-House raid shelter presentation.
// The fixture enters through New Game, commissions a House through the real
// building/ownership systems, and starts a raid through checkRaids(). It then
// verifies that the presentation boundary, renderer eligibility, canvas hit
// testing, and House panel all agree about the portal-gated indoor state.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
const REVISION = contract.moduleRevision;
assert.equal(REVISION, 191, 'Update this gate together with current browser module URLs');

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const browserErrors = [];

page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${server.gameUrl}?v=raid-shelters-browser-${REVISION}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && typeof window.G?.debug?.step === 'function'
    && typeof window.G?.debug?.dispatch === 'function'
  ));

  await page.locator('#kingdom-name-input').fill('Shelter Presentation Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => (
    !document.body.classList.contains('title-active')
    && window.G?.citizens?.length === 3
  ));
  await page.evaluate(() => window.setSpeed(0));

  const result = await page.evaluate(async () => {
    const economy = await import('./js/economy.js?realm=191');
    const ownership = await import('./js/citizen-ownership.js?realm=191');
    const presentation = await import('./js/citizen-presentation.js?realm=191');
    const render = await import('./js/render.js?realm=191');
    const residences = await import('./js/residences.js?realm=191');
    const state = await import('./js/state.js?realm=191');
    const ui = await import('./js/ui.js?realm=191');
    const g = window.G;

    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const compactText = element => (element?.textContent || '').replace(/\s+/g, ' ').trim();
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
    const forceHeartbeatNextTick = citizen => {
      citizen._hb = (12 - ((g.gameTick + 1) % 12)) % 12;
    };
    const snapshots = () => presentation.buildCurrentCitizenPresentations();
    const snapshotFor = actorId => snapshots().find(citizen => citizen.actorId === actorId) || null;
    const worldActorIds = () => snapshots()
      .filter(citizen => !citizen.indoors)
      .map(citizen => citizen.actorId);
    const clickCitizenPosition = citizen => {
      const canvas = document.getElementById('game');
      const rect = canvas.getBoundingClientRect();
      const world = render.toScreen(citizen.x, citizen.y);
      g.camera.x = world.x;
      g.camera.y = world.y;
      g.camera.zoom = 1.3;
      window.forceRender();
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
    const stepUntil = (label, predicate, limit = 360) => {
      for (let ticks = 1; ticks <= limit; ticks++) {
        g.debug.step(1);
        if (predicate()) return ticks;
      }
      throw new Error(`${label} did not settle within ${limit} core ticks`);
    };

    g.debug.disableEvents = true;
    g.scenario = 'peaceful_start';
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
      tools: 10_000,
    });
    for (const row of g.fog) row.fill(true);
    for (let y = 34; y <= 48; y++) {
      for (let x = 34; x <= 52; x++) {
        if (!g.buildingGrid[y][x]) g.map[y][x] = state.TILE.GRASS;
      }
    }

    const site = (() => {
      for (let y = 38; y <= 44; y++) {
        for (let x = 38; x <= 44; x++) {
          if (economy.canPlace('house', x, y)) return { x, y };
        }
      }
      return null;
    })();
    requireCondition(site, 'No real House placement was available for the browser fixture');
    const placed = g.debug.dispatch({ type: 'PLACE_BUILDING', building: 'house', ...site });
    requireCondition(placed.ok, `House command failed: ${placed.reason}`);
    const house = g.buildingGrid[site.y][site.x];
    requireCondition(house?.type === 'house', 'House command did not populate the real building grid');

    // Complete through real construction ownership and updateProduction so
    // commissioning, population capacity, and crew release all occur.
    const resident = g.citizens[0];
    ownership.renameCitizen(resident, 'Portal Resident', 'player-rename');
    setPosition(resident, house.x + 1, house.y);
    ownership.claimCitizenAssignment(resident, house, { reason: 'player-command' });
    ownership.transitionCitizenActivity(resident, 'working', 'arrived-at-work');
    house.buildProgress = 1 - (1 / house.buildTotal);
    economy.updateProduction();
    requireCondition(house.buildProgress === 1, 'House did not complete through production authority');
    requireCondition(resident.assignment === null, 'House completion did not release its construction crew');

    // Keep a one-resident fixture using the domain removal API, then establish
    // the target's authoritative residence through the residence policy.
    for (const other of [...g.citizens]) {
      if (other !== resident) ownership.removeCitizenFromWorld(other, 'citizen-removed');
    }
    requireCondition(residences.assignCitizenResidence(resident) === house, 'Residence policy did not assign the completed House');
    requireCondition(residences.citizenHasValidResidence(resident), 'Assigned House was not a valid residence');

    setPosition(resident, house.x + 7, house.y);
    resident.speed = 0.38;
    resident.hunger = 0;
    resident.rest = 100;
    resident.carrying = null;
    resident.carryAmount = 0;
    ownership.transitionCitizenActivity(resident, 'idle', 'idle-wait');
    resident.activityTimer = 100_000;

    // Spawn the real first-raid warband through the raid authority, then park
    // it far away so this bounded presentation gate observes sheltering rather
    // than combat balance.
    g.day = Math.max(3, g.day);
    g.dayPhase = 0;
    g.nextRaidDay = g.day;
    g.stats.raidsFaced = 0;
    g._raidSide = 2;
    economy.checkRaids();
    requireCondition(g.enemies.length > 0, 'checkRaids() did not create a real raider fixture');
    for (const enemy of g.enemies) {
      enemy.x = 72;
      enemy.y = 72;
      enemy.tx = 71;
      enemy.ty = 72;
      enemy.attackTimer = 999;
    }
    g.dayPhase = Math.floor(g.dayLength * 0.35);

    forceHeartbeatNextTick(resident);
    g.debug.step(1);
    const preArrival = snapshotFor(resident.actorId);
    requireCondition(preArrival?.activity.kind === 'seek_shelter', 'Raid did not expose seek_shelter before arrival');
    requireCondition(preArrival.indoors === false, 'Resident presentation hid before portal arrival');
    requireCondition(!residences.citizenAtResidencePortal(resident), 'Pre-arrival fixture already occupied the House portal');
    requireCondition(worldActorIds().includes(resident.actorId), 'Visible pre-arrival resident was absent from world actor presentation');

    g.selectedBuilding = null;
    g.selectedCitizenId = null;
    ui.hideInfoPanel();
    clickCitizenPosition(resident);
    const preArrivalPanel = document.getElementById('info-panel');
    requireCondition(g.selectedCitizenId === resident.actorId, 'Visible pre-arrival resident was not canvas-selectable');
    requireCondition(preArrivalPanel?.dataset.citizenActorId === String(resident.actorId), 'Pre-arrival click did not open the citizen panel');
    requireCondition(compactText(preArrivalPanel).includes('Running home'), 'Pre-arrival citizen panel did not explain the readable shelter route');

    g.selectedBuilding = null;
    g.selectedCitizenId = null;
    ui.hideInfoPanel();
    const approachTicks = stepUntil(
      'resident reaching their actual House portal',
      () => resident.activity.kind === 'sheltered',
    );
    const sheltered = snapshotFor(resident.actorId);
    requireCondition(residences.citizenAtResidencePortal(resident), 'Shelter state began away from the House portal');
    requireCondition(residences.citizenIsIndoors(resident), 'Portal resident did not become genuinely indoor');
    requireCondition(sheltered?.indoors === true, 'Citizen presentation did not publish the indoor fact');
    requireCondition(!worldActorIds().includes(resident.actorId), 'Indoor resident remained eligible for world actor presentation');

    // Regression: an actor omitted by the world renderer must also be omitted
    // by the canvas actor hit-test. It may select the House beneath them or
    // empty ground, but it must never resurrect the invisible citizen panel.
    clickCitizenPosition(resident);
    requireCondition(g.selectedCitizenId === null, 'Invisible sheltered resident stole the canvas click');
    requireCondition(
      document.getElementById('info-panel')?.dataset.citizenActorId !== String(resident.actorId),
      'Sheltered click reopened a stale citizen actor panel',
    );

    g.selectedBuilding = house;
    ui.showInfoPanel(house);
    ui.updateUI();
    const housePanel = document.getElementById('info-panel');
    const housePanelText = compactText(housePanel);
    requireCondition(
      /Inside\s*1\/1\s*·\s*1 sheltering/.test(housePanelText),
      `House panel did not report its sheltered resident as Inside: ${housePanelText}`,
    );
    const shelterActionTargets = [...housePanel.querySelectorAll('button:not(.ip-close)')];
    for (const button of shelterActionTargets) {
      requireCondition(button.getBoundingClientRect().height >= 44, 'House shelter action missed the 44px touch target floor');
    }

    g.enemies.length = 0;
    g.debug.step(1);
    const afterClear = snapshotFor(resident.actorId);
    requireCondition(afterClear?.indoors === false, 'Resident remained absent after the raid cleared');
    requireCondition(
      ['find_job', 'idle'].includes(afterClear.activity.kind),
      `Daytime all-clear did not restore a readable exterior state: ${afterClear.activity.kind}/${afterClear.activity.reason}`,
    );
    requireCondition(worldActorIds().includes(resident.actorId), 'All-clear resident did not re-enter world actor presentation');

    g.selectedBuilding = null;
    g.selectedCitizenId = null;
    ui.hideInfoPanel();
    clickCitizenPosition(resident);
    const allClearPanel = document.getElementById('info-panel');
    const allClearText = compactText(allClearPanel);
    requireCondition(g.selectedCitizenId === resident.actorId, 'All-clear resident did not become canvas-selectable again');
    requireCondition(
      allClearText.includes('Looking for work') || allClearText.includes('Idle'),
      `All-clear citizen panel lacked a readable state: ${allClearText}`,
    );
    requireCondition(
      allClearText.includes(afterClear.activity.reason),
      'All-clear citizen panel did not expose its current activity reason',
    );

    return {
      actorId: resident.actorId,
      approachTicks,
      preArrival: {
        activity: preArrival.activity.kind,
        indoors: preArrival.indoors,
        worldPresent: true,
        selectable: true,
      },
      sheltered: {
        activity: sheltered.activity.kind,
        indoors: sheltered.indoors,
        atPortal: true,
        worldPresent: false,
        selectable: false,
      },
      housePanelText,
      shelterActionTargets: shelterActionTargets.length,
      afterClear: {
        activity: afterClear.activity.kind,
        reason: afterClear.activity.reason,
        indoors: afterClear.indoors,
        worldPresent: true,
        selectable: true,
      },
    };
  });

  assert.equal(result.preArrival.activity, 'seek_shelter');
  assert.equal(result.preArrival.indoors, false);
  assert.equal(result.sheltered.activity, 'sheltered');
  assert.equal(result.sheltered.indoors, true);
  assert.ok(['find_job', 'idle'].includes(result.afterClear.activity));
  assert.match(result.housePanelText, /Inside\s*1\/1\s*·\s*1 sheltering/);
  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' | ')}`);

  console.log(
    `[raid-shelters-browser] PASS — visible/selectable seek_shelter, portal-gated hidden actor after ${result.approachTicks} ticks, House Inside/sheltering report, and readable all-clear return`,
  );
} finally {
  await browser.close();
  await server.stop();
}
