#!/usr/bin/env node

// Focused gameplay gate for player work orders. The ordinary population panel
// must let the player move an employed citizen directly, explain who controls
// the job, preserve that order through survival AI and Save/Continue, and hand
// the citizen cleanly back to automatic staffing on request.

import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const realmRoot = fileURLToPath(new URL('..', import.meta.url));
const proofDir = join(realmRoot, 'tmp', 'citizen-work-orders');
const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
assert.equal(contract.moduleRevision, 188, 'Update this gate together with current browser module URLs');
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
  await mkdir(proofDir, { recursive: true });
  await page.goto(`${server.gameUrl}?v=citizen-work-orders-${contract.moduleRevision}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.dispatch);
  await page.locator('#kingdom-name-input').fill('Work Order Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(() => {
    window.setSpeed(0);
    window.dismissTutorial();
  });

  const fixture = await page.evaluate(async () => {
    const economy = await import('./js/economy.js?realm=188');
    const ownership = await import('./js/citizen-ownership.js?realm=188');
    const g = window.G;
    Object.assign(g.resources, {
      wood: 10_000, stone: 10_000, food: 100, gold: 10_000, iron: 10_000,
      wheat: 100, flour: 100, planks: 100, tools: 100,
    });
    for (const row of g.fog) row.fill(true);

    const placeCompleted = type => {
      for (let y = 1; y < g.map.length - 1; y++) {
        for (let x = 1; x < g.map[y].length - 1; x++) {
          if (!economy.canPlace(type, x, y)) continue;
          const result = g.debug.dispatch({ type: 'PLACE_BUILDING', building: type, x, y });
          if (!result.ok) throw new Error(`${type} placement failed: ${result.reason}`);
          const building = g.buildingGrid[y][x];
          building.buildProgress = 1;
          building.completeTick = g.gameTick;
          return building;
        }
      }
      throw new Error(`No placement found for ${type}`);
    };

    while (g.citizens.length > 2) {
      ownership.removeCitizenFromWorld(g.citizens.at(-1), 'citizen-removed');
    }
    const ordered = g.citizens[0];
    const adaptive = g.citizens[1];
    const farm = placeCompleted('farm');
    const lumber = placeCompleted('lumber');
    const market = placeCompleted('market');
    ownership.claimCitizenAssignment(ordered, farm, { reason: 'job-market' });
    ownership.transitionCitizenActivity(ordered, 'working', 'arrived-at-work');
    ordered.activityTimer = 10_000;
    ordered.x = farm.x;
    ordered.y = farm.y;
    ordered.tx = farm.x;
    ordered.ty = farm.y;
    ownership.claimCitizenAssignment(adaptive, market, { reason: 'job-market' });
    ownership.transitionCitizenActivity(adaptive, 'working', 'arrived-at-work');
    adaptive.activityTimer = 10_000;
    adaptive.x = market.x;
    adaptive.y = market.y;
    adaptive.tx = market.x;
    adaptive.ty = market.y;
    return {
      ordered: { actorId: ordered.actorId, name: ordered.identity.name },
      adaptive: { actorId: adaptive.actorId, name: adaptive.identity.name },
      farm: { x: farm.x, y: farm.y },
      lumber: { x: lumber.x, y: lumber.y },
      market: { x: market.x, y: market.y },
    };
  });

  await page.locator('#pop-display').click();
  const orderedControl = page.locator(`.pop-work-control[data-actor-id="${fixture.ordered.actorId}"]`);
  const orderedRow = orderedControl.locator('xpath=..');
  assert.match(await orderedRow.innerText(), /AI assigned/i);
  assert.match(await orderedRow.innerText(), /AI: Farm/);
  const orderSelect = orderedControl.locator('.pop-assign');
  const lumberValue = `${fixture.lumber.x},${fixture.lumber.y}`;
  assert.ok(await orderSelect.locator(`option[value="${lumberValue}"]`).count(), 'employed citizen could not be reassigned directly');

  await orderSelect.selectOption(lumberValue);
  await page.waitForFunction(({ actorId, x, y }) => {
    const citizen = window.G.citizens.find(value => value.actorId === actorId);
    return citizen?.assignment?.building.x === x
      && citizen.assignment.building.y === y
      && citizen.assignment.reason === 'player-command';
  }, { actorId: fixture.ordered.actorId, ...fixture.lumber });
  const orderedState = await page.evaluate(actorId => {
    const citizen = window.G.citizens.find(value => value.actorId === actorId);
    return {
      profession: citizen.profession.kind,
      purpose: citizen.assignment.purpose,
      reason: citizen.assignment.reason,
      command: window.G._commandLog.at(-1),
      toast: document.getElementById('toast')?.textContent || '',
    };
  }, fixture.ordered.actorId);
  assert.equal(orderedState.profession, 'farmer', 'manual workplace move erased the citizen vocation');
  assert.equal(orderedState.purpose, 'temporary', 'cross-vocation work was not presented as temporary help');
  assert.equal(orderedState.reason, 'player-command');
  assert.equal(orderedState.command.type, 'ASSIGN_CITIZEN');
  assert.match(orderedState.toast, new RegExp(`${fixture.ordered.name} ordered to Lumber Mill`));
  await page.waitForFunction(actorId => (
    document.querySelector(`.pop-work-control[data-actor-id="${actorId}"]`)?.textContent.includes('Crown order')
  ), fixture.ordered.actorId);
  assert.match(await orderedRow.innerText(), /Ordered: Lumber Mill/);
  await page.screenshot({ path: join(proofDir, 'desktop-crown-order.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(actorId => {
    const panel = document.getElementById('pop-panel');
    const control = document.querySelector(`.pop-work-control[data-actor-id="${actorId}"]`);
    const select = control?.querySelector('.pop-assign');
    const auto = control?.querySelector('.pop-auto');
    const panelRect = panel.getBoundingClientRect();
    const selectRect = select?.getBoundingClientRect();
    const autoRect = auto?.getBoundingClientRect();
    return {
      panel: { left: panelRect.left, right: panelRect.right, width: panelRect.width },
      viewport: window.innerWidth,
      contentClientWidth: document.getElementById('pop-content').clientWidth,
      contentScrollWidth: document.getElementById('pop-content').scrollWidth,
      selectHeight: selectRect?.height || 0,
      autoHeight: autoRect?.height || 0,
    };
  }, fixture.ordered.actorId);
  assert.ok(mobileLayout.panel.left >= 0 && mobileLayout.panel.right <= mobileLayout.viewport, 'phone roster overflowed the viewport');
  assert.ok(mobileLayout.contentScrollWidth <= mobileLayout.contentClientWidth + 1, 'phone roster requires horizontal scrolling');
  assert.ok(mobileLayout.selectHeight >= 44 && mobileLayout.autoHeight >= 44, 'phone work-order controls are smaller than 44px');
  await page.screenshot({ path: join(proofDir, 'phone-crown-order.png') });
  await page.setViewportSize({ width: 1280, height: 800 });

  const crisis = await page.evaluate(async ({ orderedId, adaptiveId, farm, lumber, market }) => {
    const ownership = await import('./js/citizen-ownership.js?realm=188');
    const state = await import('./js/state.js?realm=188');
    const g = window.G;
    const ordered = g.citizens.find(value => value.actorId === orderedId);
    const adaptive = g.citizens.find(value => value.actorId === adaptiveId);
    const at = locator => g.buildingGrid[locator.y][locator.x];
    Object.assign(g.resources, { food: 0, wheat: 0, flour: 0 });
    g.dayPhase = Math.floor(g.dayLength * 0.2);
    ordered.x = lumber.x;
    ordered.y = lumber.y;
    ordered.tx = lumber.x;
    ordered.ty = lumber.y;
    ordered.path = null;
    ordered.pathIdx = 0;
    ownership.transitionCitizenActivity(ordered, 'working', 'arrived-at-work');
    ordered.activityTimer = 1;
    adaptive.x = market.x;
    adaptive.y = market.y;
    adaptive.tx = market.x;
    adaptive.ty = market.y;
    adaptive.path = null;
    adaptive.pathIdx = 0;
    ownership.transitionCitizenActivity(adaptive, 'working', 'arrived-at-work');
    adaptive.activityTimer = 1;
    state.setSeed(37);
    g.debug.step(1_440);
    return {
      ordered: {
        assignment: ordered.assignment && {
          x: ordered.assignment.building.x,
          y: ordered.assignment.building.y,
          reason: ordered.assignment.reason,
        },
      },
      adaptive: {
        assignment: adaptive.assignment && {
          x: adaptive.assignment.building.x,
          y: adaptive.assignment.building.y,
          reason: adaptive.assignment.reason,
        },
      },
      farmStaff: ownership.staffingCount(at(farm)),
    };
  }, {
    orderedId: fixture.ordered.actorId,
    adaptiveId: fixture.adaptive.actorId,
    farm: fixture.farm,
    lumber: fixture.lumber,
    market: fixture.market,
  });
  assert.deepEqual(crisis.ordered.assignment, {
    ...fixture.lumber,
    reason: 'player-command',
  }, 'survival AI silently discarded a direct work order');
  assert.ok(
    crisis.adaptive.assignment?.reason !== 'player-command',
    'automatic worker unexpectedly became a player order',
  );
  assert.ok(
    crisis.adaptive.assignment?.x !== fixture.market.x
      || crisis.adaptive.assignment?.y !== fixture.market.y,
    'automatic non-food worker did not adapt during a sustained food crisis',
  );
  assert.equal(crisis.farmStaff, 1, 'automatic AI did not fill the open food job');

  await page.locator('#btn-save').click();
  await page.reload();
  await page.waitForFunction(() => typeof window.loadAndStart === 'function' && window.G);
  await page.locator('#title-load').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(() => window.setSpeed(0));
  const continued = await page.evaluate(({ actorId, lumber }) => {
    const citizen = window.G.citizens.find(value => value.actorId === actorId);
    return {
      actorId: citizen?.actorId,
      assignment: citizen?.assignment && {
        x: citizen.assignment.building.x,
        y: citizen.assignment.building.y,
        reason: citizen.assignment.reason,
      },
      lumber,
    };
  }, { actorId: fixture.ordered.actorId, lumber: fixture.lumber });
  assert.equal(continued.actorId, fixture.ordered.actorId);
  assert.deepEqual(continued.assignment, { ...fixture.lumber, reason: 'player-command' });

  await page.locator('#pop-display').click();
  const continuedControl = page.locator(`.pop-work-control[data-actor-id="${fixture.ordered.actorId}"]`);
  const returnToAI = continuedControl.locator('.pop-auto');
  assert.equal(await returnToAI.count(), 1, 'continued Crown order did not expose Return to AI');
  await returnToAI.click();
  await page.evaluate(actorId => {
    const g = window.G;
    const citizen = g.citizens.find(value => value.actorId === actorId);
    Object.assign(g.resources, { food: 100, wheat: 100, flour: 100 });
    g.dayPhase = Math.floor(g.dayLength * 0.2);
    citizen.hunger = 0;
    citizen.carrying = null;
    citizen.carryAmount = 0;
    citizen.activityTimer = 0;
    g.debug.step(2);
  }, fixture.ordered.actorId);
  const automaticAgain = await page.evaluate(actorId => {
    const citizen = window.G.citizens.find(value => value.actorId === actorId);
    return {
      assignment: citizen.assignment && {
        type: citizen.assignment.building.type,
        reason: citizen.assignment.reason,
      },
      activity: citizen.activity.kind,
      toast: document.getElementById('toast')?.textContent || '',
    };
  }, fixture.ordered.actorId);
  assert.ok(automaticAgain.assignment, 'Return to AI did not re-enter automatic staffing');
  assert.notEqual(automaticAgain.assignment.reason, 'player-command');
  assert.match(automaticAgain.toast, /returned to automatic work/);

  assert.deepEqual(browserErrors, [], browserErrors.join(' | '));
  console.log('✓ employed citizen moved directly from an AI job to a Crown order with immediate feedback');
  console.log('✓ Crown order survived adaptive survival AI and Save/Continue; automatic worker filled the food vacancy');
  console.log(`✓ Return to AI resumed automatic staffing; phone controls ${Math.round(mobileLayout.selectHeight)}px/${Math.round(mobileLayout.autoHeight)}px high`);
  console.log(`[citizen-work-orders-browser] OK — realm${contract.moduleRevision}`);
} finally {
  await browser.close();
  await server.stop();
}
