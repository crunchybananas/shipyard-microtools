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
  await page.waitForFunction(() => document.querySelector('#mission-list')?.textContent.includes('Operate a food source'));
  assert.equal(await page.locator('#mission-list').getByText('Side Goals').count(), 0, 'chapter was buried under unrelated side goals');
  assert.equal(await page.locator('#mission-list .mission-next').count(), 1, 'chapter exposed more than one primary objective');
  assert.match(await page.locator('#mission-list .mission-next').innerText(), /Place food source/, 'primary objective had no direct action');
  assert.match(await page.locator('#mission-list .mission-next').innerText(), /18 rations · about 6 days/, 'military opening did not communicate its ration runway');
  assert.ok((await page.locator('.mission-chapter-action').boundingBox()).height >= 44, 'chapter action missed touch target size');
  const barracksBuildButton = page.locator('#build-bar button', { hasText: 'Barracks' });
  await barracksBuildButton.waitFor({ state: 'visible' });
  assert.equal(await barracksBuildButton.isEnabled(), true, 'military scenario advertised barracks but could not afford one');
  const immediateSave = await page.evaluate(async () => {
    const saveState = await import('./js/save-state.js?realm=197');
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
    const state = await import('./js/state.js?realm=197');
    const ownership = await import('./js/citizen-ownership.js?realm=197');
    const ui = await import('./js/ui.js?realm=197');
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
  await page.evaluate(async () => {
    window.G.debug.step(900);
    const ownership = await import('./js/citizen-ownership.js?realm=197');
    const ui = await import('./js/ui.js?realm=197');
    const barracks = window.G.buildingGrid[40][46];
    const activeCivilians = window.G.citizens.filter(citizen => citizen.assignment?.building === barracks);
    ownership.transitionCitizenActivity(activeCivilians[0], 'idle', 'idle-wait');
    window.G.selectedBuilding = barracks;
    ui.showInfoPanel(barracks);
    ui.updateUI();
  });
  assert.equal(await page.evaluate(() => window.G.soldiers.length), 1, 'browser barracks auto-trained a second unit');
  const drillCrewRow = page.locator('#info-panel .ip-row', { hasText: 'Drill crew' });
  assert.match(
    await drillCrewRow.innerText(),
    /2\/2.*1 civilian.*1 company soldier/i,
    'Barracks panel did not explain how its company replaces an off-duty instructor',
  );
  const operationRow = page.locator('#info-panel .ip-row', { hasText: 'Operating' }).first();
  assert.match(await operationRow.innerText(), /1 civilian.*1 soldier/i, 'Barracks status hid the effective company crew');

  assert.match(await page.locator('#soldier-count').innerText(), /READY/, 'company HUD omitted supply readiness');
  const companyTitle = await page.locator('#soldier-count').evaluate(element => element.closest('.res')?.title || '');
  assert.match(companyTitle, /Next dawn: −1 food, −1 iron/, 'company HUD omitted visible upkeep');
  const advanceButton = page.locator('[data-company-objective]');
  await advanceButton.click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('company-objective-placement')), true, 'Advance control did not enter ground placement');
  const advance = await page.evaluate(async () => {
    const render = await import('./js/render.js?realm=197');
    const pathfinding = await import('./js/pathfinding.js?realm=197');
    const g = window.G;
    const soldier = g.soldiers[0];
    let target = null;
    for (let radius = 3; radius <= 8 && !target; radius++) {
      for (let dy = -radius; dy <= radius && !target; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = Math.round(soldier.x) + dx;
          const y = Math.round(soldier.y) + dy;
          if (pathfinding.isWalkable(x, y)) { target = { x, y }; break; }
        }
      }
    }
    if (!target) throw new Error('No nearby open company objective');
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    const world = render.toScreen(target.x, target.y);
    const canvasX = (world.x - g.camera.x) * g.camera.zoom + canvas.width / 2;
    const canvasY = (world.y - g.camera.y) * g.camera.zoom + canvas.height / 2;
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: rect.left + canvasX * (rect.width / canvas.width),
      clientY: rect.top + canvasY * (rect.height / canvas.height),
    }));
    window.forceRender();
    return { target, objective: g.armyObjective };
  });
  assert.deepEqual(advance.objective, { ...advance.target, mode: 'attack-move' }, 'ground tap did not issue the strict company objective');
  assert.equal(await page.locator('#army-order-label').innerText(), 'Attack-move', 'HUD did not expose the active company order');

  await page.locator('#btn-founder').click();
  assert.equal(await page.locator('#btn-founder').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => window.G._followAvatar), true, 'Founder HUD control did not enter follow mode');

  await page.evaluate(() => {
    window.G.selectedBuilding = window.G.buildingGrid[40][46];
    window.setArmyStance('rally');
  });
  assert.equal(await page.evaluate(() => window.G._placingRally), true, 'touch rally control did not enter placement mode');
  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  console.log('[first-muster-browser] PASS — military scenario, explicit named queue, visible company drill crew, supply HUD, touch Advance, Founder controls, and rally mode');
} finally {
  await browser.close();
  await server.stop();
}
