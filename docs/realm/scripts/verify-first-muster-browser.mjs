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
  await page.goto(`${server.gameUrl}?v=first-muster-browser-190`);
  await page.waitForFunction(() => typeof window.startNewGame === 'function');
  await page.evaluate(() => window.setScenario('military_rise'));
  await page.locator('#kingdom-name-input').fill('First Muster Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(() => window.setSpeed(0));
  await page.waitForFunction(() => document.querySelector('#mission-list')?.textContent.includes('Complete a food source'));
  assert.equal(await page.locator('#mission-list').getByText('Side Goals').count(), 0, 'chapter was buried under unrelated side goals');
  assert.equal(await page.locator('#mission-list .mission-next').count(), 1, 'chapter exposed more than one primary objective');
  assert.match(await page.locator('#mission-list .mission-next').innerText(), /Place food source/, 'primary objective had no direct action');
  assert.ok((await page.locator('.mission-chapter-action').boundingBox()).height >= 44, 'chapter action missed touch target size');
  const barracksBuildButton = page.locator('#build-bar button', { hasText: 'Barracks' });
  await barracksBuildButton.waitFor({ state: 'visible' });
  assert.equal(await barracksBuildButton.isEnabled(), true, 'military scenario advertised barracks but could not afford one');
  const immediateSave = await page.evaluate(async () => {
    const saveState = await import('./js/save-state.js?realm=193');
    const prepared = saveState.prepareSave(saveState.serializeGame({ savedAt: 189 }));
    return {
      ok: prepared.ok,
      era: window.G.era,
      eraStartDay: window.G.eraStartDay,
      failure: prepared.ok ? null : prepared.failure,
    };
  });
  assert.deepEqual(
    immediateSave,
    { ok: true, era: 2, eraStartDay: { 1: 1, 2: 1 }, failure: null },
    'fresh Era 2 military start could not Save/Continue immediately',
  );

  const setup = await page.evaluate(async () => {
    const state = await import('./js/state.js?realm=193');
    const ownership = await import('./js/citizen-ownership.js?realm=193');
    const ui = await import('./js/ui.js?realm=193');
    const g = window.G;
    Object.assign(g.resources, { wood: 100, stone: 100, food: 20, gold: 50, iron: 20, planks: 20 });
    for (const row of g.fog) row.fill(true);
    g.map[40][46] = state.TILE.GRASS;
    const placed = g.debug.dispatch({ type: 'PLACE_BUILDING', building: 'barracks', x: 46, y: 40 });
    if (!placed.ok) throw new Error(`barracks placement failed: ${placed.reason}`);
    const barracks = g.buildingGrid[40][46];
    barracks.buildProgress = 1;
    barracks.completeTick = g.gameTick;
    ownership.claimCitizenAssignment(g.citizens[0], barracks, { reason: 'player-command' });
    ownership.claimCitizenAssignment(g.citizens[1], barracks, { reason: 'player-command' });
    ownership.transitionCitizenActivity(g.citizens[0], 'working', 'arrived-at-work');
    ownership.transitionCitizenActivity(g.citizens[1], 'working', 'arrived-at-work');
    g.selectedBuilding = barracks;
    ui.showInfoPanel(barracks);
    ui.updateUI();
    return {
      era: g.era,
      military: g.researchedTechs.has('military'),
      soldiers: g.soldiers.length,
    };
  });
  assert.deepEqual(setup, { era: 2, military: true, soldiers: 0 }, 'military scenario did not start combat-ready');

  const workforceButtons = page.locator('#info-panel .workforce-priority-btn');
  assert.equal(await workforceButtons.count(), 4, 'staffed building panel did not expose all labor priorities');
  assert.ok((await workforceButtons.first().boundingBox()).height >= 44, 'labor priority missed touch target size');
  await workforceButtons.filter({ hasText: 'High' }).click();
  assert.equal(await page.evaluate(() => window.G.buildingGrid[40][46].workforcePriority), 'high', 'building panel did not dispatch labor priority');
  assert.equal(await workforceButtons.filter({ hasText: 'High' }).getAttribute('aria-pressed'), 'true', 'active labor priority was not visible');

  const musterButton = page.locator('#info-panel button', { hasText: 'Enlist' });
  await musterButton.waitFor({ state: 'visible' });
  assert.equal(await musterButton.isEnabled(), true, 'staffed barracks muster button was disabled');
  const enlistmentLabel = await musterButton.innerText();
  const populationBeforeEnlistment = await page.evaluate(() => window.G.population);
  await musterButton.click();
  const queued = await page.evaluate(() => ({
    name: window.G.buildingGrid[40][46].recruitName,
    type: window.G.buildingGrid[40][46].recruitType,
    soldiers: window.G.soldiers.length,
    population: window.G.population,
  }));
  assert.ok(queued.name, 'muster order did not name its recruit');
  assert.match(enlistmentLabel, new RegExp(queued.name), 'muster control did not preview the exact civilian who would leave the workforce');
  assert.deepEqual(
    { type: queued.type, soldiers: queued.soldiers, population: queued.population },
    { type: 'swordsman', soldiers: 0, population: populationBeforeEnlistment - 1 },
    'browser muster did not convert one civilian into the queued recruit',
  );

  const trained = await page.evaluate(() => {
    window.G.debug.step(360);
    window.forceRender();
    return {
      soldiers: window.G.soldiers.length,
      name: window.G.soldiers[0]?.name,
      queued: !!window.G.buildingGrid[40][46].recruitType,
    };
  });
  assert.deepEqual(trained, { soldiers: 1, name: queued.name, queued: false });
  await page.evaluate(() => window.G.debug.step(900));
  assert.equal(await page.evaluate(() => window.G.soldiers.length), 1, 'browser barracks auto-trained a second unit');

  await page.locator('#btn-founder').click();
  assert.equal(await page.locator('#btn-founder').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => window.G._followAvatar), true, 'Founder HUD control did not enter follow mode');

  await page.evaluate(() => {
    window.G.selectedBuilding = window.G.buildingGrid[40][46];
    window.setArmyStance('rally');
  });
  assert.equal(await page.evaluate(() => window.G._placingRally), true, 'touch rally control did not enter placement mode');
  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  console.log('[first-muster-browser] PASS — military scenario, explicit named queue, Founder HUD, and touch rally mode');
} finally {
  await browser.close();
  await server.stop();
}
