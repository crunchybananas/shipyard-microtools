#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(`${server.gameUrl}?v=post-raid-recovery-browser-190`);
  await page.waitForFunction(() => typeof window.startNewGame === 'function');
  await page.evaluate(() => window.setScenario('military_rise'));
  await page.locator('#kingdom-name-input').fill('Recovery Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(async () => {
    const state = await import('./js/state.js?realm=197');
    const firstMuster = await import('./js/first-muster.js?realm=197');
    const residences = await import('./js/residences.js?realm=197');
    const ui = await import('./js/ui.js?realm=197');
    window.setSpeed(0);
    window.G.gameTick = 240;
    window.G.enemies = [];
    window.G._scenarioWon = false;
    window.G.storyFlags = {
      firstMusterStep: firstMuster.FIRST_MUSTER_STEPS.length,
      firstRaidApproach: 1,
    };
    const x = 44, y = 40;
    window.G.map[y][x] = state.TILE.GRASS;
    window.G.fog[y][x] = true;
    const placed = window.G.debug.dispatch({ type: 'PLACE_BUILDING', building: 'house', x, y });
    if (!placed.ok) throw new Error(`recovery House placement failed: ${placed.reason}`);
    const house = window.G.buildingGrid[y][x];
    house.buildProgress = 1;
    house.completeTick = window.G.gameTick;
    if (!residences.assignCitizenResidence(window.G.citizens[0])) {
      throw new Error('recovery resident did not receive the completed House');
    }
    window.__recoveryHouse = { x, y, actorId: window.G.citizens[0].actorId };
    ui.renderMissions();
    ui.updateUI();
  });

  assert.match(await page.locator('#mission-list .scen-progress').innerText(), /7\/8/);
  assert.equal(await page.locator('#mission-list .recovery-choice').count(), 3, 'recovery did not expose exactly three doctrine choices');
  assert.equal(await page.locator('#mission-list .mission-next').count(), 0, 'unchosen recovery exposed a fake objective');
  assert.equal(await page.locator('#mission-list').getByText('Side Goals').count(), 0, 'recovery was buried under global goals');
  for (const button of await page.locator('#mission-list .recovery-choice').all()) {
    assert.ok((await button.boundingBox()).height >= 44, 'recovery doctrine missed the touch target floor');
  }

  await page.locator('#mission-list .recovery-fortify').click();
  assert.equal(await page.evaluate(() => window.G.storyFlags.postRaidDoctrine), 'fortify');
  assert.equal(await page.locator('#mission-list .recovery-choice').count(), 0, 'latched doctrine cards remained actionable');
  const primary = page.locator('#mission-list .mission-next');
  assert.equal(await primary.count(), 1, 'chosen recovery did not collapse to one primary objective');
  assert.match(await primary.innerText(), /new Wall or Tower/i);
  assert.match(await primary.innerText(), /east/i, 'preserved scouting intelligence was not visible');
  const action = primary.locator('.mission-chapter-action');
  assert.match(await action.innerText(), /Place Wall/);
  assert.ok((await action.boundingBox()).height >= 44);
  await action.click();
  assert.equal(await page.evaluate(() => window.G.selectedBuild), 'wall', 'Fortify action did not enter Wall placement');

  const aftermath = await page.evaluate(async () => {
    const state = await import('./js/state.js?realm=197');
    const recovery = await import('./js/post-raid-recovery.js?realm=197');
    const ui = await import('./js/ui.js?realm=197');
    const x = state.MAP_W - 6, y = 40;
    window.G.map[y][x] = state.TILE.GRASS;
    window.G.fog[y][x] = true;
    const placed = window.G.debug.dispatch({ type: 'PLACE_BUILDING', building: 'wall', x, y });
    if (!placed.ok) throw new Error(`recovery Wall placement failed: ${placed.reason}`);
    const wall = window.G.buildingGrid[y][x];
    wall.buildProgress = 1;
    wall.completeTick = ++window.G.gameTick;
    const report = recovery.updatePostRaidRecovery();
    ui.renderMissions();
    ui.updateUI();
    return {
      complete: report.complete,
      doctrineSatisfied: report.doctrine.satisfied,
      primary: report.primary.id,
    };
  });
  assert.deepEqual(aftermath, {
    complete: false,
    doctrineSatisfied: true,
    primary: 'stabilize_household',
  }, 'Fortify did not hand off to physical household recovery');
  const household = page.locator('#mission-list .mission-next');
  assert.match(await household.innerText(), /Stabilize one household/i);
  assert.match(await household.innerText(), /\(0\/1\)/);
  const houseAction = household.locator('.mission-chapter-action');
  assert.match(await houseAction.innerText(), /Open House/);
  assert.ok((await houseAction.boundingBox()).height >= 44);
  await houseAction.click();
  assert.deepEqual(
    await page.evaluate(() => ({
      type: window.G.selectedBuilding?.type,
      x: window.G.selectedBuilding?.x,
      panelVisible: getComputedStyle(document.getElementById('info-panel')).display !== 'none',
    })),
    { type: 'house', x: 44, panelVisible: true },
    'household CTA did not open the resident House',
  );
  const householdComplete = await page.evaluate(async () => {
    const ownership = await import('./js/citizen-ownership.js?realm=197');
    const recovery = await import('./js/post-raid-recovery.js?realm=197');
    const residences = await import('./js/residences.js?realm=197');
    const ui = await import('./js/ui.js?realm=197');
    const resident = window.G.citizens.find(citizen => citizen.actorId === window.__recoveryHouse.actorId);
    const portal = residences.residencePortalForCitizen(resident);
    window.G.gameTick++;
    resident.x = portal.x;
    resident.y = portal.y;
    resident.tx = portal.x;
    resident.ty = portal.y;
    ownership.transitionCitizenActivity(resident, 'sleep', 'sleep-rest');
    const report = recovery.updatePostRaidRecovery();
    ui.renderMissions();
    ui.updateUI();
    return { complete: report.complete, progress: report.primary.progress.current };
  });
  assert.deepEqual(householdComplete, { complete: true, progress: 1 });
  assert.match(await page.locator('#mission-list .scen-progress').innerText(), /8\/8/);

  // Phone acceptance: the collapsed mission surface is a real 44px button,
  // recovery cards remain reachable, and Rebuild opens the food workplace
  // that can actually increase the post-choice operational baseline.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on('pageerror', error => errors.push(error.message));
  mobile.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mobile.goto(`${server.gameUrl}?v=post-raid-recovery-phone-190`);
  await mobile.waitForFunction(() => typeof window.startNewGame === 'function');
  await mobile.evaluate(() => window.setScenario('military_rise'));
  await mobile.locator('#kingdom-name-input').fill('Recovery Phone');
  await mobile.locator('#title-screen .title-btn.primary').click();
  await mobile.waitForFunction(() => !document.body.classList.contains('title-active'));
  const foodTargets = await mobile.evaluate(async () => {
    const state = await import('./js/state.js?realm=197');
    const firstMuster = await import('./js/first-muster.js?realm=197');
    const ownership = await import('./js/citizen-ownership.js?realm=197');
    const ui = await import('./js/ui.js?realm=197');
    const g = window.G;
    window.setSpeed(0);
    g.gameTick = 240;
    g.enemies = [];
    g._scenarioWon = false;
    g.storyFlags = {
      firstMusterStep: firstMuster.FIRST_MUSTER_STEPS.length,
      firstRaidApproach: 0,
    };
    for (const x of [42, 44]) {
      g.map[40][x] = state.TILE.GRASS;
      const placed = g.debug.dispatch({ type: 'PLACE_BUILDING', building: 'farm', x, y: 40 });
      if (!placed.ok) throw new Error(`phone farm ${x} placement failed: ${placed.reason}`);
      const farm = g.buildingGrid[40][x];
      farm.buildProgress = 1;
      farm.completeTick = g.gameTick;
    }
    const operating = g.buildingGrid[40][42];
    const unstaffed = g.buildingGrid[40][44];
    ownership.claimCitizenAssignment(g.citizens[0], operating, { reason: 'player-command' });
    ownership.transitionCitizenActivity(g.citizens[0], 'working', 'arrived-at-work');
    ui.renderMissions();
    ui.updateUI();
    return { operating: operating.x, unstaffed: unstaffed.x };
  });
  assert.deepEqual(foodTargets, { operating: 42, unstaffed: 44 });

  const heading = mobile.locator('#missions-heading');
  const headingBox = await heading.boundingBox();
  assert.ok(headingBox.height >= 44, 'phone Missions opener missed the touch target floor');
  assert.equal(await heading.evaluate(element => element.tagName), 'BUTTON');
  assert.equal(await heading.evaluate(element => element.tabIndex), 0);
  assert.equal(await heading.getAttribute('aria-expanded'), 'false');
  await heading.click();
  assert.equal(await heading.getAttribute('aria-expanded'), 'true');
  assert.equal(await mobile.locator('#mission-list .recovery-choice').count(), 3);
  await mobile.locator('#mission-list .recovery-rebuild').click();
  const rebuildAction = mobile.locator('#mission-list .mission-next .mission-chapter-action');
  assert.match(await rebuildAction.innerText(), /Open food workplace/);
  assert.ok((await rebuildAction.boundingBox()).height >= 44);
  await rebuildAction.click();
  assert.equal(
    await mobile.evaluate(() => window.G.selectedBuilding?.x),
    44,
    'Rebuild CTA opened an already-counted operational workplace',
  );
  await mobile.close();

  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  console.log('[post-raid-recovery-browser] PASS — desktop Fortify-to-household recovery, Open House control, phone-accessible doctrine cards, and truthful Rebuild targeting');
} finally {
  await browser.close();
  await server.stop();
}
