/** Browser QA: real controls for actions; the review clock only skips waiting. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const BASE = process.env.WILDHAVEN_URL || 'http://127.0.0.1:4751/wildhaven/?review';
const output = new URL('../review/', import.meta.url);
await mkdir(output, { recursive: true });
const sourcePaths = ['index.html', 'style.css', 'js/main.js', 'js/world.js', 'js/sim.js', 'js/audio.js', 'assets/village-kit.glb'];
async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex')])));
}
const report = {
  startedAt: new Date().toISOString(), url: BASE, browser: 'Chromium',
  scope: 'Isolated browser contexts. UI actions only; review.advance skips day waits. No resources or population are edited.',
  checks: [], errors: [], screenshots: [], desktop: {}, mobile: {},
  sourceHashesAtStart: await sourceHashes(),
};
let browser;
async function check(name, work, { critical = false } = {}) {
  const started = Date.now();
  try {
    const detail = await work();
    report.checks.push({ name, passed: true, elapsedMs: Date.now() - started, ...(detail ? { detail } : {}) });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, elapsedMs: Date.now() - started, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    if (critical) throw error;
  }
}
async function screenshot(page, name) {
  const filename = `${name}.png`;
  await page.screenshot({ path: new URL(filename, output).pathname });
  report.screenshots.push(filename);
}
async function prepare(page, mode) {
  page.on('pageerror', error => report.errors.push({ mode, source: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push({ mode, source: 'console', message: message.text(), location: message.location() });
  });
  await page.addInitScript(() => {
    window.__qaAudioContexts = [];
    const NativeAudioContext = window.AudioContext;
    if (NativeAudioContext) window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__qaAudioContexts.push(this); }
    };
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__wildhaven && window.Wildhaven, { timeout: 30000 });
  await expect(page.locator('#start')).toBeVisible();
}
const snapshot = page => page.evaluate(() => window.__wildhaven.snapshot());
const keyState = state => ({ resources: state.resources, population: state.population, day: state.day, buildings: state.buildings, won: state.won, lastTradeDay: state.lastTradeDay ?? null });
async function pause(page) {
  if (await page.locator('#pause').getAttribute('aria-label') !== 'Resume') await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Resume');
}
async function pointFor(page, x, z) {
  return page.evaluate(({ x, z }) => {
    const point = window.__wildhaven.project(x, z);
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, hit: hit?.id || hit?.tagName || null };
  }, { x, z });
}
async function tapGround(page, x, z, touch = false) {
  const point = await pointFor(page, x, z);
  assert.equal(point.hit, 'world', `tile ${x},${z} at ${Math.round(point.x)},${Math.round(point.y)} is intercepted by ${point.hit}`);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else { await page.mouse.move(point.x, point.y); await page.mouse.click(point.x, point.y); }
  return point;
}
async function place(page, type, x, z, touch = false) {
  const before = await snapshot(page);
  const verdict = await page.evaluate(({ type, x, z }) => window.__wildhaven.canBuild(type, x, z), { type, x, z });
  assert.equal(verdict.ok, true, `${type}: ${verdict.reason}`);
  const choice = page.locator(`[data-build="${type}"]`);
  if (await choice.getAttribute('aria-pressed') !== 'true') {
    if (touch) await choice.tap(); else await choice.click();
  }
  await expect(page.locator('#placement')).toBeVisible();
  await tapGround(page, x, z, touch);
  await expect.poll(async () => (await snapshot(page)).buildings.length).toBe(before.buildings.length + 1);
  const result = await snapshot(page);
  const building = result.buildings.find(building => building.type === type && building.x === x && building.z === z);
  assert.ok(building, `${type} was not placed in the requested cell`);
  return building;
}
async function cancel(page, touch = false) {
  if (await page.locator('#placement').isVisible()) {
    if (touch) await page.locator('#cancel-building').tap(); else await page.keyboard.press('Escape');
  }
  await expect(page.locator('#placement')).toBeHidden();
}
async function dawns(page, count = 1) {
  const before = await snapshot(page);
  await page.evaluate(count => window.__wildhaven.advance(count * 90), count);
  assert.equal((await snapshot(page)).day, before.day + count);
}
async function roofPoint(page, id) {
  return page.evaluate(async id => {
    const { Box3, Vector3 } = await import('three');
    const world = window.__wildhaven.world;
    const root = world.buildings.get(id);
    const box = new Box3().setFromObject(root);
    const center = box.getCenter(new Vector3());
    center.y = box.max.y - (box.max.y - box.min.y) * 0.15;
    center.project(world.camera);
    const point = { x: (center.x + 1) * world.width / 2, y: (1 - center.y) * world.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, hit: hit?.id || hit?.tagName || null };
  }, id);
}

try {
  browser = await chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await desktopContext.newPage();
  try {
    await check('Desktop opens a fresh island without application errors', async () => {
      await prepare(page, 'desktop');
      assert.equal((await snapshot(page)).buildings.length, 2);
      await screenshot(page, 'qa-01-desktop-arrival');
    }, { critical: true });
    await page.locator('#start').click();
    await pause(page);
    await page.locator('#collapse-objective').click();
    await page.waitForTimeout(500);
    await check('Pause freezes the clock; speed controls expose their state', async () => {
      const before = (await snapshot(page)).time;
      await page.waitForTimeout(400);
      assert.equal((await snapshot(page)).time, before);
      await expect(page.locator('#season')).toHaveText('Taking a breath');
      await page.locator('[data-speed="3"]').click();
      await expect(page.locator('[data-speed="3"]')).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(200);
      assert.ok((await snapshot(page)).time > before);
      await pause(page);
    });
    await check('User gesture starts real Web Audio; mute suspends it', async () => {
      await page.locator('#sound').click();
      await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
      await page.waitForFunction(() => window.__qaAudioContexts.some(context => context.state === 'running'));
      await page.locator('#sound').click();
      await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
      await page.waitForFunction(() => window.__qaAudioContexts.every(context => context.state === 'suspended'));
      await page.locator('#sound').click();
      await page.waitForFunction(() => window.__qaAudioContexts.some(context => context.state === 'running'));
    });
    await check('Cottage placement spends once; occupied placement cannot spend', async () => {
      await place(page, 'cottage', -2, 2);
      const before = await snapshot(page);
      await tapGround(page, -2, 2);
      assert.deepEqual(keyState(await snapshot(page)), keyState(before));
      await expect(page.locator('#toast')).toContainText('already a building');
    }, { critical: true });
    await check('Cancel removes the ghost and undo returns every material', async () => {
      await cancel(page);
      assert.equal(await page.evaluate(() => window.__wildhaven.world.highlight.visible), false);
      await page.locator('#undo').click();
      assert.deepEqual((await snapshot(page)).resources, { wood: 60, stone: 35, food: 28 });
      assert.equal((await snapshot(page)).buildings.length, 2);
      await expect(page.locator('#undo')).toBeDisabled();
    }, { critical: true });
    const cottage = await place(page, 'cottage', -2, 2);
    await cancel(page);
    await check('Clicking the visible cottage roof opens its inspector', async () => {
      const point = await roofPoint(page, cottage.id);
      assert.equal(point.hit, 'world');
      await page.mouse.click(point.x, point.y);
      await expect(page.locator('#inspector')).toBeVisible();
      await expect(page.locator('#inspect-title')).toHaveText('Cottage');
      await screenshot(page, 'qa-02-cottage-inspector');
      await page.locator('#close-inspector').click();
    });
    // Escape also safely closes an inspector after a failed independent roof check.
    await page.keyboard.press('Escape');
    await check('Opening production chain is built through the shelf and island', async () => {
      await place(page, 'orchard', 2, 0);
      await place(page, 'lumber', -4, -3);
      await place(page, 'quarry', 5, -3);
      await cancel(page);
      assert.deepEqual((await snapshot(page)).resources, { wood: 6, stone: 11, food: 24 });
      await screenshot(page, 'qa-03-working-village');
    }, { critical: true });
    await check('Dawn yields resources and arrivals; village grows with earned supplies', async () => {
      await dawns(page);
      assert.equal((await snapshot(page)).population, 6);
      await place(page, 'garden', 3, 0);
      await place(page, 'cottage', -2, 3);
      await cancel(page);
      await dawns(page);
      await place(page, 'cottage', -2, 4);
      await cancel(page);
      await dawns(page);
      assert.equal((await snapshot(page)).population, 10);
      assert.equal(await page.evaluate(() => window.__wildhaven.canBuild('bell', 0, -5).ok), false);
      await screenshot(page, 'qa-04-ten-islanders');
    }, { critical: true });
    await check('Reload restores the earned village and Continue resumes it', async () => {
      const before = keyState(await snapshot(page));
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__wildhaven);
      await expect(page.locator('#continue')).toBeVisible();
      await page.locator('#continue').click();
      await pause(page);
      assert.deepEqual(keyState(await snapshot(page)), before);
      await expect(page.locator('#undo')).toBeDisabled();
      report.desktop.restoredVillage = before;
    }, { critical: true });
    await check('Bell restoration and first ending complete through visible controls', async () => {
      await dawns(page, 3);
      await page.locator('[data-build="bell"]').click();
      await expect(page.locator('#inspect-action')).toHaveText('Restore the bell');
      await expect(page.locator('#inspect-action')).toBeEnabled();
      await page.locator('#inspect-action').click();
      await expect(page.locator('#win-dialog')).toBeVisible({ timeout: 6000 });
      assert.equal((await snapshot(page)).won, true);
      await screenshot(page, 'qa-05-welcome-home');
      await page.locator('#win-dialog button.primary').click();
      await expect(page.locator('#win-dialog')).toBeHidden();
      await page.locator('#home').click();
      await page.waitForTimeout(800);
      await screenshot(page, 'qa-06-completed-village');
      await dawns(page);
      assert.equal((await snapshot(page)).won, true);
      report.desktop.finishedVillage = await snapshot(page);
    }, { critical: true });
    await check('Completed village survives reload without repeating the ending', async () => {
      const before = keyState(await snapshot(page));
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__wildhaven);
      await page.locator('#continue').click();
      await pause(page);
      await page.waitForTimeout(1700);
      await expect(page.locator('#win-dialog')).toBeHidden();
      assert.deepEqual(keyState(await snapshot(page)), before);
    });
    await check('Landing exchanges earned food once per day and persists its limit', async () => {
      await page.locator('#landing-button').click();
      await expect(page.locator('#inspect-title')).toHaveText('The landing');
      await expect(page.locator('#inspect-action')).toBeEnabled();
      const before = await snapshot(page);
      await page.locator('#inspect-action').click();
      const after = await snapshot(page);
      assert.equal(after.resources.wood, before.resources.wood + 12);
      assert.equal(after.resources.food, Math.round((before.resources.food - 12) * 1000) / 1000);
      assert.equal(after.resources.stone, before.resources.stone);
      assert.equal(after.lastTradeDay, after.day);
      await expect(page.locator('#inspect-action')).toBeDisabled();
      await expect(page.locator('#inspect-secondary')).toBeDisabled();
      await screenshot(page, 'qa-11-landing-exchange');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__wildhaven);
      await page.locator('#continue').click();
      await pause(page);
      await page.locator('#landing-button').click();
      await expect(page.locator('#inspect-action')).toBeDisabled();
      await expect(page.locator('#inspect-secondary')).toBeDisabled();
      assert.deepEqual(keyState(await snapshot(page)), keyState(after));
      await dawns(page);
      await expect(page.locator('#inspect-secondary')).toBeEnabled();
      const next = await snapshot(page);
      await page.locator('#inspect-secondary').click();
      assert.equal((await snapshot(page)).resources.stone, next.resources.stone + 10);
      report.desktop.afterTrade = keyState(await snapshot(page));
    });
    report.desktop.diagnostics = await page.evaluate(() => window.Wildhaven.getDiagnostics());
  } catch (error) {
    report.desktop.aborted = error.message;
    await screenshot(page, 'qa-desktop-failure').catch(() => {});
  } finally { await desktopContext.close(); }

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  try {
    await check('390×844 touch layout keeps every supply label inside the viewport', async () => {
      await prepare(mobile, 'mobile');
      await screenshot(mobile, 'qa-07-mobile-arrival');
      await mobile.locator('#start').tap();
      await pause(mobile);
      await mobile.locator('#collapse-objective').tap();
      await mobile.waitForTimeout(600);
      const layout = await mobile.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, shelf: document.getElementById('build-shelf').scrollWidth }));
      assert.ok(layout.document <= layout.viewport && layout.body <= layout.viewport, JSON.stringify(layout));
      const supplyBounds = await mobile.evaluate(() => {
        const selectors = ['.supplies', '#wood', '#wood-rate', '#stone', '#stone-rate', '#food', '#food-rate', '#people', '#arrival-status'];
        return selectors.map(selector => {
          const node = document.querySelector(selector), bounds = node.getBoundingClientRect();
          return { selector, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, viewport: innerWidth };
        });
      });
      for (const bounds of supplyBounds) {
        assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport + 0.5, `${bounds.selector} is clipped: ${JSON.stringify(bounds)}`);
      }
      report.mobile.supplyBounds = supplyBounds;
      report.mobile.layout = layout;
      await screenshot(mobile, 'qa-08-mobile-new-village');
    }, { critical: true });
    await check('Touch places and rotates a cottage; visible Done cancels placement', async () => {
      await mobile.locator('[data-build="cottage"]').tap();
      await mobile.locator('#rotate-building').tap();
      const before = (await snapshot(mobile)).buildings.length;
      await tapGround(mobile, -2, 2, true);
      await expect.poll(async () => (await snapshot(mobile)).buildings.length).toBe(before + 1);
      const house = (await snapshot(mobile)).buildings.find(building => building.type === 'cottage');
      assert.equal(house.rotation, 1);
      await cancel(mobile, true);
      await screenshot(mobile, 'qa-09-mobile-cottage');
    }, { critical: true });
    await check('Touch shelf scrolls to the bell; inspector and help remain usable', async () => {
      await mobile.locator('[data-build="bell"]').tap();
      await expect(mobile.locator('#inspect-title')).toHaveText('The old bell');
      await expect(mobile.locator('#inspect-action')).toBeDisabled();
      await screenshot(mobile, 'qa-10-mobile-bell');
      await mobile.locator('#close-inspector').tap();
      await mobile.locator('#help').tap();
      await expect(mobile.locator('#help-dialog')).toBeVisible();
      await mobile.locator('#help-dialog .close-button').tap();
      await expect(mobile.locator('#help-dialog')).toBeHidden();
    });
    report.mobile.smallTouchTargets = await mobile.evaluate(() => [...document.querySelectorAll('#hud button')].filter(button => button.checkVisibility()).map(button => ({ id: button.id || button.dataset.build || button.dataset.speed, label: button.getAttribute('aria-label') || button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })).filter(button => button.width < 44 || button.height < 44));
    report.mobile.diagnostics = await mobile.evaluate(() => window.Wildhaven.getDiagnostics());
  } catch (error) {
    report.mobile.aborted = error.message;
    await screenshot(mobile, 'qa-mobile-failure').catch(() => {});
  } finally { await mobileContext.close(); }
  await check('No application or Web Audio errors during both browser sessions', async () => {
    const errors = report.errors.filter(error => !error.location?.url?.endsWith('/favicon.ico'));
    assert.deepEqual(errors, []);
  });
} catch (error) {
  report.fatalError = error.stack || error.message;
} finally {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  report.sourceHashesAtFinish = await sourceHashes();
  report.sourcesChangedDuringRun = sourcePaths.filter(path => report.sourceHashesAtStart[path] !== report.sourceHashesAtFinish[path]);
  report.passed = report.checks.length > 0 && report.checks.every(check => check.passed) && !report.fatalError && !report.desktop.aborted && !report.mobile.aborted && report.sourcesChangedDuringRun.length === 0;
  await writeFile(new URL('playthrough-report.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failures: report.checks.filter(check => !check.passed).map(check => check.name), errors: report.errors.length, sourcesChangedDuringRun: report.sourcesChangedDuringRun, fatalError: report.fatalError, desktopAborted: report.desktop.aborted, mobileAborted: report.mobile.aborted }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
