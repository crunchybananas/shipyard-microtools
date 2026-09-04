#!/usr/bin/env node

// Focused opening-flow gate. A tutorial target must never impersonate active
// build mode, the fading title must not swallow the first touch, and reversible
// Farm selection must keep the tutorial truthful through Cancel, Escape, New
// Game, and successful placement.

import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const realmRoot = fileURLToPath(new URL('..', import.meta.url));
const proofDir = join(realmRoot, 'tmp', 'opening-build-tutorial');
const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
assert.equal(contract.moduleRevision, 198, 'Update this gate together with current browser module URLs');
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

async function grassTarget(page, minY = 190) {
  return page.evaluate(minimumY => {
    const g = window.G;
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    const candidates = [];
    for (let y = 0; y < g.map.length; y++) {
      for (let x = 0; x < g.map[y].length; x++) {
        if (g.map[y][x] !== 2 || !g.fog[y]?.[x] || g.buildingGrid[y]?.[x]) continue;
        const sx = (x - y) * 32;
        const sy = (x + y) * 16;
        const clientX = rect.left + (sx - g.camera.x) * g.camera.zoom + rect.width / 2;
        const clientY = rect.top + (sy - g.camera.y) * g.camera.zoom + rect.height / 2;
        if (clientX < 28 || clientX > rect.width - 28 || clientY < minimumY || clientY > rect.height - 170) continue;
        if (document.elementFromPoint(clientX, clientY) !== canvas) continue;
        candidates.push({ x, y, clientX, clientY });
      }
    }
    candidates.sort((a, b) => (
      Math.abs(a.clientX - rect.width / 2) + Math.abs(a.clientY - rect.height / 2)
      - Math.abs(b.clientX - rect.width / 2) - Math.abs(b.clientY - rect.height / 2)
    ));
    return candidates[0] || null;
  }, minY);
}

async function openingState(page) {
  return page.evaluate(() => {
    const farm = document.querySelector('[data-build-key="farm"]');
    const title = document.getElementById('title-screen');
    const tip = document.getElementById('tutorial-tip');
    const farmStyle = farm ? getComputedStyle(farm) : null;
    return {
      selectedBuild: window.G.selectedBuild,
      buildings: window.G.buildings.filter(building => building.founderStockpile !== true).length,
      founderStockpiles: window.G.buildings.filter(building => building.founderStockpile === true).length,
      farmActive: farm?.classList.contains('active') || false,
      farmGuided: farm?.classList.contains('tut-highlight') || false,
      farmPressed: farm?.getAttribute('aria-pressed'),
      farmHint: farm?.dataset.tutorialHint || '',
      farmBorder: farmStyle?.borderColor || '',
      farmOutline: farmStyle?.outlineColor || '',
      cancelPresent: !!document.querySelector('.build-cancel'),
      tutorialText: tip?.textContent?.replace(/\s+/g, ' ').trim() || '',
      speed: window.G.speed,
      titlePointerEvents: title ? getComputedStyle(title).pointerEvents : '',
      titleInert: title?.inert || false,
      startHeight: tip?.querySelector('.tut-next')?.getBoundingClientRect().height || 0,
      placeCommands: window.G._commandLog.filter(command => command.type === 'PLACE_BUILDING').length,
    };
  });
}

async function startFresh(page, name, touch = false) {
  await page.goto(`${server.gameUrl}?v=opening-build-tutorial-${contract.moduleRevision}-${touch ? 'touch' : 'desktop'}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.step);
  await page.locator('#kingdom-name-input').fill(name);
  const newGame = page.locator('#title-screen .title-btn.primary');
  if (touch) {
    const box = await newGame.boundingBox();
    assert.ok(box, 'New Game touch target is not visible');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await newGame.click();
  }
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  const welcome = await openingState(page);
  assert.equal(welcome.titlePointerEvents, 'none', 'fading title still intercepts the first game interaction');
  assert.equal(welcome.titleInert, true, 'fading title remains keyboard-interactive');
  assert.equal(welcome.selectedBuild, null);
  assert.equal(welcome.founderStockpiles, 1, 'fresh realm lacked its physical founder food store');
  assert.equal(welcome.farmActive, false);
  assert.equal(welcome.farmGuided, false);
  assert.equal(welcome.speed, 1, 'New Game left the realm frozen behind the tutorial welcome');
  assert.match(welcome.tutorialText, /realm is live/i);
  return welcome;
}

async function acknowledgeWelcome(page, touch = false) {
  const start = page.locator('.tut-next');
  if (touch) {
    const box = await start.boundingBox();
    assert.ok(box, 'Tutorial continue touch target is not visible');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await start.click();
  }
  await page.waitForFunction(() => document.querySelector('[data-build-key="farm"]')?.classList.contains('tut-highlight'));
  return openingState(page);
}

const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const desktop = await desktopContext.newPage();
const desktopErrors = [];
desktop.on('pageerror', error => desktopErrors.push(`pageerror: ${error.message}`));
desktop.on('console', message => {
  if (message.type() === 'error') desktopErrors.push(`console: ${message.text()}`);
});

try {
  await mkdir(proofDir, { recursive: true });
  await startFresh(desktop, 'Opening Truth Gate');
  const guided = await acknowledgeWelcome(desktop);
  assert.equal(guided.selectedBuild, null);
  assert.equal(guided.farmActive, false);
  assert.equal(guided.farmGuided, true);
  assert.equal(guided.farmPressed, 'false');
  assert.equal(guided.farmHint, 'Select');
  assert.equal(guided.cancelPresent, false);
  assert.match(guided.tutorialText, /Select Farm from the build bar/);
  assert.match(guided.farmOutline, /141, 230, 208/, 'tutorial target is not the teal guide language');
  await desktop.screenshot({ path: join(proofDir, 'desktop-next-action.png') });

  const target = await grassTarget(desktop);
  assert.ok(target, 'No uncovered desktop grass tile found');
  await desktop.mouse.click(target.clientX, target.clientY);
  const ignoredGround = await openingState(desktop);
  assert.equal(ignoredGround.buildings, 0, 'unselected tutorial target placed a building');
  assert.equal(ignoredGround.placeCommands, 0, 'unselected ground click dispatched a placement command');
  assert.match(ignoredGround.tutorialText, /Select Farm from the build bar/);

  await desktop.locator('[data-build-key="farm"]').click();
  const selected = await openingState(desktop);
  assert.equal(selected.selectedBuild, 'farm');
  assert.equal(selected.farmActive, true);
  assert.equal(selected.farmGuided, false);
  assert.equal(selected.farmPressed, 'true');
  assert.equal(selected.cancelPresent, true);
  assert.match(selected.tutorialText, /Click a grass tile on the island/);
  assert.match(selected.farmBorder, /255, 209, 102/, 'active build mode is not the gold selection language');
  assert.notEqual(selected.farmBorder, guided.farmOutline, 'guide and active states use the same visual signal');

  await desktop.locator('.build-cancel').click();
  const cancelled = await openingState(desktop);
  assert.equal(cancelled.selectedBuild, null);
  assert.equal(cancelled.farmActive, false);
  assert.equal(cancelled.farmGuided, true);
  assert.equal(cancelled.cancelPresent, false);
  assert.match(cancelled.tutorialText, /Select Farm from the build bar/);

  await desktop.locator('[data-build-key="farm"]').click();
  await desktop.keyboard.press('Escape');
  const escaped = await openingState(desktop);
  assert.equal(escaped.selectedBuild, null);
  assert.equal(escaped.farmGuided, true);
  assert.match(escaped.tutorialText, /Select Farm from the build bar/);

  await desktop.locator('[data-build-key="farm"]').click();
  await desktop.keyboard.press('2');
  const repeatedHotkey = await openingState(desktop);
  assert.equal(repeatedHotkey.selectedBuild, 'farm', 'repeating the selected hotkey silently cancelled build mode');
  assert.match(repeatedHotkey.tutorialText, /Click a grass tile on the island/);
  await desktop.screenshot({ path: join(proofDir, 'desktop-active-placement.png') });

  const placementTarget = await grassTarget(desktop);
  assert.ok(placementTarget, 'No desktop grass tile found after selection');
  await desktop.mouse.click(placementTarget.clientX, placementTarget.clientY);
  await desktop.waitForFunction(() => window.G.buildings.some(building => building.type === 'farm'));
  const placed = await openingState(desktop);
  assert.equal(placed.buildings, 1);
  assert.equal(placed.placeCommands, 1);
  assert.equal(placed.selectedBuild, 'farm', 'successful placement did not preserve deliberate repeat-build mode');
  assert.match(placed.tutorialText, /Select Lumber Mill from the build bar/);
  assert.equal(await desktop.locator('[data-build-key="lumber"]').getAttribute('data-tutorial-hint'), 'Select');

  await desktop.locator('#btn-newgame').click();
  const restarted = await openingState(desktop);
  assert.equal(restarted.buildings, 0);
  assert.equal(restarted.selectedBuild, null);
  assert.equal(restarted.farmActive, false);
  assert.equal(restarted.farmGuided, false);
  assert.equal(restarted.speed, 1, 'in-game New did not restart the live simulation');
  assert.match(restarted.tutorialText, /realm is live/i);
  assert.deepEqual(desktopErrors, [], desktopErrors.join(' | '));

  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const phone = await phoneContext.newPage();
  const phoneErrors = [];
  phone.on('pageerror', error => phoneErrors.push(`pageerror: ${error.message}`));
  phone.on('console', message => {
    if (message.type() === 'error') phoneErrors.push(`console: ${message.text()}`);
  });
  try {
    const phoneWelcome = await startFresh(phone, 'Opening Touch Gate', true);
    assert.ok(phoneWelcome.startHeight >= 44, `phone tutorial continue target is ${phoneWelcome.startHeight}px high`);
    const phoneGuided = await acknowledgeWelcome(phone, true);
    assert.equal(phoneGuided.selectedBuild, null);
    assert.equal(phoneGuided.farmGuided, true);
    assert.equal(phoneGuided.farmActive, false);
    await phone.screenshot({ path: join(proofDir, 'phone-next-action.png') });

    const farm = phone.locator('[data-build-key="farm"]');
    const farmBox = await farm.boundingBox();
    assert.ok(farmBox, 'phone Farm target is not visible');
    await phone.touchscreen.tap(farmBox.x + farmBox.width / 2, farmBox.y + farmBox.height / 2);
    const phoneSelected = await openingState(phone);
    assert.equal(phoneSelected.selectedBuild, 'farm', 'first phone Farm tap was swallowed by the fading title');
    assert.equal(phoneSelected.farmActive, true);
    assert.equal(phoneSelected.farmGuided, false);
    assert.equal(phoneSelected.cancelPresent, true);
    assert.match(phoneSelected.tutorialText, /Click a grass tile on the island/);
    await phone.screenshot({ path: join(proofDir, 'phone-active-placement.png') });
    assert.deepEqual(phoneErrors, [], phoneErrors.join(' | '));
  } finally {
    await phoneContext.close();
  }

  console.log('✓ tutorial target is teal guidance, while active Farm placement is gold and aria-pressed');
  console.log('✓ unselected ground click is inert; Cancel and Escape return to the Farm selection instruction');
  console.log('✓ first phone Farm tap survives the title fade; New Game restores the truthful welcome state');
  console.log(`[opening-build-tutorial-browser] OK — realm${contract.moduleRevision}`);
} finally {
  await desktopContext.close();
  await browser.close();
  await server.stop();
}
