// Focused phone gate for build-mode gesture arbitration. A selected building
// must keep tap-to-place while allowing one-finger camera drag and pinch zoom.
// Touch users need an explicit, reachable way to leave build mode, after which
// ordinary building selection must still work.

import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const realmRoot = fileURLToPath(new URL('..', import.meta.url));
const proofDir = join(realmRoot, 'tmp', 'responsive-build-mode');
const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

try {
  await mkdir(proofDir, { recursive: true });
  await page.goto(`${server.gameUrl}?v=responsive-build-mode-${contract.moduleRevision}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G);
  await page.locator('#kingdom-name-input').fill('Touch Gate');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(() => {
    window.setSpeed(0);
    window.dismissTutorial();
  });

  await page.locator('[data-build-key="farm"]').click();
  const selected = await page.evaluate(() => ({
    key: window.G.selectedBuild,
    viewport: [window.innerWidth, window.innerHeight],
    cancelText: document.querySelector('.build-cancel')?.textContent?.trim() || '',
  }));
  assert.equal(selected.key, 'farm');
  assert.deepEqual(selected.viewport, [390, 844]);
  assert.match(selected.cancelText, /Cancel/);

  const cancelBox = await page.locator('.build-cancel').boundingBox();
  assert.ok(cancelBox, 'selected build did not expose the Cancel control');
  assert.ok(cancelBox.width >= 44 && cancelBox.height >= 44, `Cancel target is ${cancelBox.width}x${cancelBox.height}`);
  const cancelHit = await page.evaluate(({ x, y }) => (
    document.elementFromPoint(x, y)?.closest('.build-cancel') !== null
  ), { x: cancelBox.x + cancelBox.width / 2, y: cancelBox.y + cancelBox.height / 2 });
  assert.equal(cancelHit, true, 'Cancel control is covered by another mobile surface');

  const placement = await page.evaluate(() => {
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
        if (clientX < 24 || clientX > rect.width - 24 || clientY < 330 || clientY > 600) continue;
        const hit = document.elementFromPoint(clientX, clientY);
        if (hit !== canvas) continue;
        candidates.push({ x, y, clientX, clientY });
      }
    }
    candidates.sort((a, b) => Math.abs(a.clientX - rect.width / 2) - Math.abs(b.clientX - rect.width / 2));
    return {
      target: candidates[0] || null,
      buildings: g.buildings.length,
    };
  });
  assert.ok(placement.target, 'No uncovered visible grass tile found for phone tap placement');

  await page.touchscreen.tap(placement.target.clientX, placement.target.clientY);
  await page.waitForFunction(count => window.G.buildings.length === count + 1, placement.buildings);
  const afterTap = await page.evaluate(() => ({
    buildings: window.G.buildings.length,
    selectedBuild: window.G.selectedBuild,
    cancelVisible: !!document.querySelector('.build-cancel'),
  }));
  assert.equal(afterTap.selectedBuild, 'farm', 'tap placement unexpectedly exited repeat-build mode');
  assert.equal(afterTap.cancelVisible, true, 'Cancel disappeared while repeat-build mode remained active');

  const dragStart = { x: 195, y: 520 };
  const dragEnd = { x: 135, y: 460 };
  const dragBefore = await page.evaluate(() => ({
    camera: { ...window.G.camera },
    buildings: window.G.buildings.length,
  }));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: dragStart.x, y: dragStart.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: dragEnd.x, y: dragEnd.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const dragAfter = await page.evaluate(() => ({
    camera: { ...window.G.camera },
    buildings: window.G.buildings.length,
    selectedBuild: window.G.selectedBuild,
    dragging: window.G.dragging,
  }));
  assert.notDeepEqual(dragAfter.camera, dragBefore.camera, 'one-finger drag did not pan while build mode was active');
  assert.equal(dragAfter.buildings, dragBefore.buildings, 'one-finger drag placed another building');
  assert.equal(dragAfter.selectedBuild, 'farm', 'camera drag unexpectedly exited build mode');
  assert.equal(dragAfter.dragging, false, 'touchend left camera dragging active');

  const pinchBefore = await page.evaluate(() => ({
    camera: { ...window.G.camera },
    buildings: window.G.buildings.length,
  }));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 140, y: 500 }, { x: 250, y: 500 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 110, y: 500 }, { x: 280, y: 500 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const pinchAfter = await page.evaluate(() => ({
    camera: { ...window.G.camera },
    buildings: window.G.buildings.length,
    selectedBuild: window.G.selectedBuild,
    dragging: window.G.dragging,
  }));
  assert.ok(pinchAfter.camera.zoom > pinchBefore.camera.zoom, 'outward pinch did not zoom in');
  assert.equal(pinchAfter.camera.x, pinchBefore.camera.x, 'pinch unexpectedly panned camera horizontally');
  assert.equal(pinchAfter.camera.y, pinchBefore.camera.y, 'pinch unexpectedly panned camera vertically');
  assert.equal(pinchAfter.buildings, pinchBefore.buildings, 'pinch placed another building');
  assert.equal(pinchAfter.selectedBuild, 'farm', 'pinch unexpectedly exited build mode');
  assert.equal(pinchAfter.dragging, false, 'pinch end left camera dragging active');

  await page.screenshot({ path: join(proofDir, 'phone-build-mode-active.png') });
  await page.locator('.build-cancel').click();
  const afterCancel = await page.evaluate(() => ({
    selectedBuild: window.G.selectedBuild,
    cancelPresent: !!document.querySelector('.build-cancel'),
  }));
  assert.equal(afterCancel.selectedBuild, null, 'Cancel did not leave build mode');
  assert.equal(afterCancel.cancelPresent, false, 'Cancel remained after leaving build mode');

  const selectionTarget = await page.evaluate(() => {
    const g = window.G;
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    const building = g.buildings[g.buildings.length - 1];
    const screenX = (building.x - building.y) * 32;
    const screenY = (building.x + building.y) * 16;
    g.camera.x = screenX;
    g.camera.y = screenY;
    return {
      actor: { x: building.x, y: building.y, type: building.type },
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
  });
  await page.touchscreen.tap(selectionTarget.clientX, selectionTarget.clientY);
  const afterSelection = await page.evaluate(() => ({
    selectedBuilding: window.G.selectedBuilding && {
      x: window.G.selectedBuilding.x,
      y: window.G.selectedBuilding.y,
      type: window.G.selectedBuilding.type,
    },
    panelVisible: document.getElementById('info-panel')?.style.display === 'block',
  }));
  assert.deepEqual(afterSelection.selectedBuilding, selectionTarget.actor, 'post-Cancel touch did not select the placed building');
  assert.equal(afterSelection.panelVisible, true, 'post-Cancel building tap did not open its info panel');

  await page.screenshot({ path: join(proofDir, 'phone-build-mode-cancelled.png') });
  assert.deepEqual(browserErrors, [], browserErrors.join(' | '));
  console.log(`✓ 390x844 tap placed one farm and preserved repeat-build mode`);
  console.log(`✓ selected-build drag panned camera without placing; Cancel target ${Math.round(cancelBox.width)}x${Math.round(cancelBox.height)}`);
  console.log(`✓ pinch zoomed without placement and post-Cancel touch selected the farm`);
  console.log(`[responsive-build-mode] OK — realm${contract.moduleRevision}`);
} finally {
  await browser.close();
  await server.stop();
}
