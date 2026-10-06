/** Isolated DOM behavior checks with an explicit simulation test double. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const root = new URL('../', import.meta.url), review = new URL('../review/', import.meta.url);
const base = process.env.WILDHAVEN_URL || 'http://127.0.0.1:4751/wildhaven/';
const report = { startedAt: new Date().toISOString(), scope: 'Frontier DOM component behavior with an explicit simulation test double. Does not verify real economy, combat, navigation, or earned play.', checks: [], errors: [] };
const hash = async file => createHash('sha256').update(await readFile(new URL(file, root))).digest('hex');
report.sources = Object.fromEntries(await Promise.all(['js/frontier-ui.js','frontier.css'].map(async file => [file, await hash(file)])));
await mkdir(review, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error') report.errors.push(entry.text()); });
const click = id => page.locator(`[data-frontier-action="${id}"]`).click();
async function check(name, task) { try { await task(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); } catch (error) { report.checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); } }
try {
  await page.route('**/js/frontier.js', route => route.fulfill({ contentType: 'application/javascript', body: 'export {};' }));
  await page.route('**/frontier-component-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="stylesheet" href="./style.css"><link rel="stylesheet" href="./frontier.css"></head><body><canvas id="world"></canvas><div id="hud"><footer><div class="shelf-heading"><span>Wildhaven</span><div></div></div></footer></div></body></html>' }));
  await page.goto(new URL('frontier-component-fixture.html', base).href);
  await page.evaluate(async () => {
    const { createFrontierUI } = await import('./js/frontier-ui.js');
    const state = { day: 8, population: 20, resources: { wood: 100, food: 80, gold: 30 }, research: {}, frontier: { clock: 0 } };
    const units = [{ id: 'u1', citizenId: 'c1', name: 'Aster', kind: 'spearman', faction: 'player', hp: 40, maxHp: 60, status: 'active', order: { type: 'hold' }, x: 1, z: 1 }, { id: 'u2', citizenId: 'c2', name: 'Birch', kind: 'archer', faction: 'player', hp: 40, maxHp: 40, status: 'training', trainingRemaining: 12, trainingSeconds: 20, order: { type: 'hold' }, x: 2, z: 1 }, { id: 'e1', name: 'Raider', kind: 'raider', faction: 'raiders', hp: 30, maxHp: 50, status: 'active', x: 3, z: 1 }];
    const calls = [], previews = [], selections = [], focuses = [];
    const quote = (ok = true, cost = { gold: 3 }, reason = 'Ready') => ({ ok, cost, reason });
    const record = (name, ...args) => { calls.push({ name, args }); return { ok: true, reason: 'Done' }; };
    const api = {
      frontierOptions: () => ({ units, fortifications: [], log: [] }),
      fortificationOptions: () => [{ id: 'wall', name: 'Timber wall', description: 'Protects a boundary.', cost: { wood: 5 }, work: 12, maxHp: 90, ok: true }, { id: 'tower', name: 'Watchtower', description: 'Covers nearby ground.', cost: { stone: 20 }, work: 30, maxHp: 150, ok: false, reason: 'Research watchkeeping first.' }],
      canPlaceFortification: (_state, _type, x, z) => x < 0 ? quote(false, {}, 'This cell blocks a lane.') : { ...quote(true, { wood: 5 }), x, z },
      planWallLine: (_state, _type, from, to) => ({ ...quote(to.x !== 9, { wood: 15 }, to.x === 9 ? 'A wall cannot cross the water.' : 'Ready'), tiles: [from, { x: from.x + 1, z: from.z }, to] }),
      buildWallLine: (_state, type, from, to) => to.x === 9 ? quote(false, {}, 'A wall cannot cross the water.') : record('line', type, from, to),
      placeFortification: (_state, ...args) => record('place', ...args),
      troopOptions: () => [{ id: 'spearman', name: 'Spear carrier', description: 'Guards on foot.', cost: { food: 10, tools: 2 }, trainingSeconds: 20, maxHp: 60, damage: 8, range: 1, ok: true, availableCitizens: [{ id: 'c3', name: 'Clover', job: 'Farmer' }, { id: 'c4', name: 'Dara', job: 'Builder' }] }],
      recruitTroop: (_state, ...args) => record('recruit', ...args), commandTroops: (_state, ...args) => record('command', ...args),
      healOffer: () => quote(false, { food: 6 }, 'Return to the hearth before healing.'),
      dismissOffer: () => quote(false, {}, 'Return home before returning to civilian work. Supplies are not refunded.'),
      neighborOptions: () => [{ id: 'reedbank', name: 'Reedbank', x: 18, z: -13, discovered: true, relation: 15, status: 'neutral', hp: 200, maxHp: 200, envoy: quote(), trade: { ...quote(), reward: { food: 12 } }, alliance: quote(false, { gold: 20 }, 'Reach 40 relations first.'), aid: quote(false, {}, 'An alliance is required.'), truce: quote(false, {}, 'You are already at peace.'), war: quote(true, {}) }],
      declareWar: (_state, ...args) => record('war', ...args),
      claimOptions: () => [{ id: 'pineward', name: 'Pineward', x: -14, z: -11, claimed: false, discovered: false, ...quote(false, { wood: 20 }, 'Scout the region first.') }],
    };
    window.fixture = { state, units, api, calls, previews, selections, focuses };
    window.frontier = createFrontierUI({ getState: () => state, api, getContext: () => ({ marker: true }), mutate: result => { window.lastResult = result; }, preview: value => previews.push(value), onSelection: value => selections.push(value), focus: value => focuses.push(value) });
  });
  await check('Disabled construction shows its price and an actionable reason', async () => {
    await page.evaluate(() => window.frontier.open('defenses'));
    await expect(page.locator('[data-frontier-action="place-tower"]')).toBeDisabled();
    await expect(page.locator('#frontier-content')).toContainText('20 stone');
    await expect(page.locator('#frontier-content')).toContainText('Research watchkeeping first.');
  });
  await check('Wall lines preview total cost and preserve invalid placement mode', async () => {
    await click('line-wall'); await expect(page.locator('#frontier-panel')).toBeHidden();
    await page.evaluate(() => window.frontier.handleTap({ x: -1, z: 0 }));
    await expect(page.locator('#frontier-command')).toContainText('blocks a lane');
    assert.equal(await page.evaluate(() => window.frontier.command.start), null);
    await page.evaluate(() => { window.frontier.handleTap({ x: 1, z: 0 }); window.frontier.hover({ x: 3, z: 0 }); });
    await expect(page.locator('#frontier-command')).toContainText('15 timber');
    await page.evaluate(() => window.frontier.handleTap({ x: 9, z: 0 }));
    assert.ok(await page.evaluate(() => window.frontier.command));
    await expect(page.locator('#frontier-command')).toContainText('cannot cross the water');
    await page.evaluate(() => window.frontier.handleTap({ x: 3, z: 0 }));
    assert.equal(await page.evaluate(() => window.fixture.calls.filter(c => c.name === 'line').length), 0);
    await expect(page.locator('#frontier-command')).toContainText('15 timber');
    await click('commit-wall-line');
    await expect(page.locator('#frontier-panel')).toBeVisible();
    assert.equal(await page.evaluate(() => window.fixture.calls.filter(c => c.name === 'line').length), 1);
  });
  await check('Named recruitment survives live DOM updates without detached controls', async () => {
    await click('tab-company');
    await page.locator('[data-frontier-action="resident-spearman"]').selectOption('c4');
    await page.evaluate(() => { window.originalRecruit = document.querySelector('[data-frontier-action="recruit-spearman"]'); for (let i = 0; i < 5; i++) { window.fixture.state.frontier.clock++; window.frontier.update(); } });
    assert.equal(await page.evaluate(() => window.originalRecruit === document.querySelector('[data-frontier-action="recruit-spearman"]')), true);
    await expect(page.locator('[data-frontier-action="resident-spearman"]')).toHaveValue('c4');
    await click('recruit-spearman');
    assert.equal(await page.evaluate(() => window.fixture.calls.find(c => c.name === 'recruit').args[1]), 'c4');
  });
  await check('Company targets only player troops and shows training/healing limitations', async () => {
    assert.equal(await page.locator('[data-frontier-action="unit-e1"]').count(), 0);
    await click('unit-u2'); await expect(page.locator('[data-frontier-action="move"]')).toBeDisabled();
    await expect(page.locator('#frontier-content')).toContainText('12 seconds of training remain');
    await click('clear-units'); await click('unit-u1'); await expect(page.locator('#frontier-content')).toContainText('Return to the hearth before healing.');
    await click('move'); await page.evaluate(() => window.frontier.handleTap({ x: 4, z: 3 }));
    const call = await page.evaluate(() => window.fixture.calls.find(c => c.name === 'command'));
    assert.deepEqual(call.args[0], ['u1']); assert.deepEqual(call.args[1], { type: 'move', x: 4, z: 3 }); assert.equal(call.args[2].marker, true);
  });
  await check('A settlement world hit opens diplomacy even when it also has a fortification hit', async () => {
    await page.evaluate(() => window.frontier.handleTap({x:18,z:-13,neighbor:{id:'reedbank'},fortification:{id:'settlement-reedbank'}}));
    assert.equal(await page.evaluate(() => window.frontier.activeTab),'neighbors');
    await expect(page.locator('[data-frontier-action="war-reedbank"]')).toBeVisible();
  });
  await check('War requires a visible consequence confirmation before issuing the action', async () => {
    await click('tab-neighbors'); await click('neighbor-reedbank'); await click('war-reedbank');
    assert.equal(await page.evaluate(() => window.fixture.calls.filter(c => c.name === 'war').length), 0);
    await expect(page.locator('[aria-label="Confirm consequences"]')).toBeInViewport();
    await click('confirm-war-reedbank'); assert.equal(await page.evaluate(() => window.fixture.calls.filter(c => c.name === 'war').length), 1);
  });
  await check('Actual island chart focuses land and closes the panel with keyboard Find alternatives retained', async () => {
    await page.evaluate(() => window.frontier.open('neighbors'));
    const point = await page.evaluate(() => { const c = document.querySelector('.frontier-chart'), r = c.getBoundingClientRect(); return { x: r.x + r.width * .5, y: r.y + r.height * .6 }; });
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#frontier-panel')).toBeHidden();
    assert.equal(await page.evaluate(() => window.fixture.focuses.at(-1).kind), 'region-point');
    await page.evaluate(() => window.frontier.open('neighbors'));
    await expect(page.locator('[data-frontier-action="find-neighbor-reedbank"]')).toBeVisible();
  });
  await check('Phone frontier panels and touch actions fit a 390px viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await click('close'); await expect(page.locator('#frontier-toggle')).toBeVisible(); await click('toggle');
    await expect(page.locator('#frontier-panel')).toBeVisible();
    for (const tab of ['defenses','company','neighbors']) {
      await page.evaluate(tab => window.frontier.open(tab), tab);
      const failures = await page.evaluate(() => [...document.querySelectorAll('#frontier-panel, #frontier-content, .frontier-tabs button, .frontier-actions button, .frontier-choice select')].flatMap(node => { const r = node.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 ? [node.textContent] : []; }));
      assert.deepEqual(failures, []);
    }
    await page.screenshot({ path: new URL('frontier-component-mobile.png', review).pathname });
  });
  await check('No component browser errors', async () => assert.deepEqual(report.errors, []));
} finally {
  await browser.close(); report.finishedAt = new Date().toISOString(); report.passed = report.checks.every(c => c.passed) && report.errors.length === 0;
  await writeFile(new URL('frontier-ui-component-report.json', review), JSON.stringify(report, null, 2) + '\n');
}
if (!report.passed) process.exitCode = 1;
