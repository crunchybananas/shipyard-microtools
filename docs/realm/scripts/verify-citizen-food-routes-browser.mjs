#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
assert.equal(contract.moduleRevision, 196, 'Update food-route browser imports with the runtime revision');

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${server.gameUrl}?v=citizen-food-routes-browser-193`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && typeof window.G?.debug?.step === 'function'
    && typeof window.G?.debug?.dispatch === 'function'
  ));
  await page.locator('#kingdom-name-input').fill('Physical Supper Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => (
    !document.body.classList.contains('title-active')
    && window.G?.citizens?.length === 3
    && window.G?.buildings?.some(building => building.founderStockpile === true)
  ));
  await page.evaluate(() => window.setSpeed(0));

  const result = await page.evaluate(async () => {
    const economy = await import('./js/economy.js?realm=196');
    const inventory = await import('./js/building-inventory.js?realm=196');
    const ownership = await import('./js/citizen-ownership.js?realm=196');
    const render = await import('./js/render.js?realm=196');
    const state = await import('./js/state.js?realm=196');
    const ui = await import('./js/ui.js?realm=196');
    const g = window.G;

    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
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
    const heartbeatNextTick = citizen => {
      citizen._hb = (12 - ((g.gameTick + 1) % 12)) % 12;
      g.debug.step(1);
    };
    const stepUntil = (label, predicate, limit = 500) => {
      for (let ticks = 1; ticks <= limit; ticks++) {
        g.debug.step(1);
        if (predicate()) return ticks;
      }
      throw new Error(`${label} did not settle within ${limit} core ticks`);
    };
    const clickCitizen = citizen => {
      const canvas = document.getElementById('game');
      const rect = canvas.getBoundingClientRect();
      const world = render.toScreen(citizen.x, citizen.y);
      g.camera.x = world.x;
      g.camera.y = world.y;
      g.camera.zoom = 1.3;
      window.forceRender();
      const canvasX = (world.x - g.camera.x) * g.camera.zoom + canvas.width / 2;
      const canvasY = (world.y - 8 - g.camera.y) * g.camera.zoom + canvas.height / 2;
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + canvasX * (rect.width / canvas.width),
        clientY: rect.top + canvasY * (rect.height / canvas.height),
      }));
    };
    const panelText = () => (document.getElementById('info-panel')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const selectAndReadCitizen = citizen => {
      g.selectedBuilding = null;
      g.selectedCitizenId = null;
      ui.hideInfoPanel();
      clickCitizen(citizen);
      requireCondition(g.selectedCitizenId === citizen.actorId, 'Canvas did not select the visible food-route citizen');
      return panelText();
    };
    const findPlacement = (type, excluded = []) => {
      for (let y = 34; y <= 48; y++) {
        for (let x = 34; x <= 52; x++) {
          if (excluded.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) < 5)) continue;
          if (economy.canPlace(type, x, y)) return { x, y };
        }
      }
      throw new Error(`No real placement found for ${type}`);
    };
    const completeBuilding = (type, citizen, excluded = []) => {
      const site = findPlacement(type, excluded);
      const command = g.debug.dispatch({ type: 'PLACE_BUILDING', building: type, ...site });
      requireCondition(command.ok, `${type} placement failed: ${command.reason}`);
      const building = g.buildingGrid[site.y][site.x];
      setPosition(citizen, building.x + 1, building.y);
      ownership.claimCitizenAssignment(citizen, building, { reason: 'player-command' });
      ownership.transitionCitizenActivity(citizen, 'working', 'arrived-at-work');
      building.buildProgress = 1 - (1 / building.buildTotal);
      economy.updateProduction();
      requireCondition(building.buildProgress === 1, `${type} did not complete through production authority`);
      requireCondition(citizen.assignment === null, `${type} completion retained construction ownership`);
      return building;
    };

    g.debug.disableEvents = true;
    g.nextRaidDay = 9_999;
    Object.assign(g.resources, {
      wood: 10_000,
      stone: 10_000,
      gold: 10_000,
      iron: 10_000,
      wheat: 0,
      flour: 0,
      planks: 10_000,
      tools: 10_000,
    });
    for (const row of g.fog) row.fill(true);
    for (let y = 34; y <= 52; y++) {
      for (let x = 34; x <= 56; x++) {
        if (!g.buildingGrid[y][x]) g.map[y][x] = state.TILE.GRASS;
      }
    }
    g.dayPhase = Math.floor(g.dayLength * 0.35);

    const worker = g.citizens[0];
    ownership.renameCitizen(worker, 'Crown Supper Worker', 'player-rename');
    const founderStore = g.buildings.find(building => building.founderStockpile === true);
    requireCondition(founderStore && inventory.storedFood(founderStore) > 1, 'Fresh game lacked a stocked founder Storehouse');
    const farm = completeBuilding('farm', worker, [founderStore]);
    const islandStore = completeBuilding('storehouse', worker, [founderStore, farm]);

    ui.updateUI();
    g.selectedCitizenId = null;
    g.selectedBuilding = founderStore;
    ui.showInfoPanel(founderStore);
    const stockPanel = panelText();
    const expectedFounderStock = `${inventory.storedFood(founderStore)}/${inventory.foodCapacity(founderStore)}`;
    const foodHudTitle = document.getElementById('r-food')?.closest('.res')?.title || '';
    requireCondition(stockPanel.includes('Founder Stockpile'), `Founder stock label was missing: ${stockPanel}`);
    requireCondition(stockPanel.includes(expectedFounderStock), `Founder local stock was missing: ${stockPanel}`);
    requireCondition(foodHudTitle.includes('physically stored'), `Food HUD hid physical storage: ${foodHudTitle}`);
    requireCondition(foodHudTitle.includes('Citizens walk there to eat'), `Food HUD hid the citizen route: ${foodHudTitle}`);

    ownership.claimCitizenAssignment(worker, farm, { reason: 'player-command' });
    ownership.transitionCitizenActivity(worker, 'working', 'arrived-at-work');
    setPosition(worker, farm.x + 1, farm.y);
    worker.speed = 0.38;
    worker.hunger = 80;
    worker.rest = 100;
    worker.activityTimer = 100_000;
    const crownAssignment = worker.assignment;
    const foodBeforeRoute = g.resources.food;
    const storeBeforeRoute = inventory.storedFood(founderStore);
    const consumedBefore = g._dailyFoodConsumed || 0;

    heartbeatNextTick(worker);
    requireCondition(worker.activity.kind === 'walk_to_eat', 'Crown worker did not visibly leave for food');
    requireCondition(worker._foodTarget === founderStore, 'Crown worker did not target the stocked reachable Storehouse');
    requireCondition(worker.assignment === crownAssignment, 'Food route replaced the Crown workplace');
    requireCondition(g.resources.food === foodBeforeRoute, 'Food wallet decremented before Storehouse arrival');
    requireCondition(inventory.storedFood(founderStore) === storeBeforeRoute, 'Storehouse decremented before citizen arrival');
    const routePanel = selectAndReadCitizen(worker);
    requireCondition(routePanel.includes('Going to eat'), `Food route was not readable in the citizen panel: ${routePanel}`);
    requireCondition(routePanel.includes('Crown order'), 'Food route hid the Crown work order');

    const approachTicks = stepUntil('Crown worker reaching Storehouse meal', () => worker.activity.kind === 'eating');
    requireCondition(approachTicks > 0, 'Crown worker ate without a visible route');
    requireCondition(worker._foodTarget === founderStore, 'Meal completed at a different Storehouse');
    requireCondition(g.resources.food === foodBeforeRoute - 1, 'Arrival did not withdraw exactly one mirrored food');
    requireCondition(inventory.storedFood(founderStore) === storeBeforeRoute - 1, 'Arrival did not withdraw exactly one physical food');
    requireCondition(worker.hunger === 20, 'Arrival meal did not satisfy hunger');
    requireCondition((g._dailyFoodConsumed || 0) === consumedBefore + 1, 'Meal did not update truthful daily consumption');
    requireCondition(worker.assignment === crownAssignment, 'Eating erased the Crown assignment');

    const returnTicks = stepUntil('Crown worker returning to the same workplace', () => (
      worker.activity.kind === 'working' && worker.assignment === crownAssignment
    ), 600);
    const returnPanel = selectAndReadCitizen(worker);
    requireCondition(returnPanel.includes('Working'), `Return-to-work state was unreadable: ${returnPanel}`);
    requireCondition(returnPanel.includes('Crown order'), 'Returned worker lost the visible Crown order');

    // Remove all reachable food through the inventory authority, then stock a
    // completed but physically islanded Storehouse. The nonzero wallet must
    // remain untouched while the worker visibly waits and retries.
    for (const store of inventory.foodStores(g, { withFood: true })) {
      inventory.withdrawFood(store, inventory.storedFood(store), g);
    }
    inventory.depositFood(islandStore, 1, g);
    for (let y = islandStore.y - 3; y <= islandStore.y + 3; y++) {
      for (let x = islandStore.x - 3; x <= islandStore.x + 3; x++) {
        if (x !== islandStore.x || y !== islandStore.y) g.map[y][x] = state.TILE.WATER;
      }
    }
    g.obstacleEpoch++;
    setPosition(worker, farm.x + 1, farm.y);
    ownership.transitionCitizenActivity(worker, 'working', 'arrived-at-work');
    worker.activityTimer = 100_000;
    worker.hunger = 80;
    const waitingWallet = g.resources.food;
    heartbeatNextTick(worker);
    requireCondition(worker.activity.kind === 'waiting_for_food', 'Unreachable pantry did not expose visible waiting');
    requireCondition(worker._foodTarget === null, 'Waiting citizen retained an unreachable food target');
    requireCondition(worker.assignment === crownAssignment, 'Waiting cleared the Crown assignment');
    const waitingPanel = selectAndReadCitizen(worker);
    requireCondition(waitingPanel.includes('Waiting for food'), `Food shortage was not readable: ${waitingPanel}`);
    requireCondition(waitingPanel.includes('Crown order'), 'Food shortage hid the Crown work order');
    g.debug.step(150);
    requireCondition(worker.activity.kind === 'waiting_for_food', 'Bounded empty retry thrashed out of waiting');
    requireCondition(g.resources.food === waitingWallet, 'Unreachable stored food was remotely withdrawn');
    requireCondition(inventory.storedFood(islandStore) === 1, 'Unreachable pantry changed during waiting');
    requireCondition(inventory.foodConservationReport(g).conserved, 'Browser food route broke inventory conservation');

    return {
      approachTicks,
      returnTicks,
      routePanel,
      returnPanel,
      waitingPanel,
      stockPanel,
      foodHudTitle,
      waitingWallet,
      crownReason: crownAssignment.reason,
    };
  });

  assert.equal(result.crownReason, 'player-command');
  assert.match(result.routePanel, /Going to eat/);
  assert.match(result.returnPanel, /Working/);
  assert.match(result.waitingPanel, /Waiting for food/);
  assert.match(result.stockPanel, /Founder Stockpile/);
  assert.match(result.foodHudTitle, /physically stored/);
  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  console.log(
    `[citizen-food-routes-browser] PASS — Crown worker walked ${result.approachTicks} ticks to eat, returned in ${result.returnTicks}, and visibly waited without remote withdrawal when food was unreachable`,
  );
} finally {
  await browser.close();
  await server.stop();
}
