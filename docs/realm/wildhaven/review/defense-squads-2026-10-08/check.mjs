import { chromium } from '/Users/coryloken/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const repo = '/Users/coryloken/Documents/Codex/2026-10-04/task-2/wildhaven-ui-fixes';
const out = '/tmp/wildhaven-defense-review';
const base = process.env.WILDHAVEN_REVIEW_URL || 'http://127.0.0.1:14727/realm/wildhaven/?review=1';
await fs.mkdir(out, { recursive: true });
const sim = await import(pathToFileURL(`${repo}/docs/realm/wildhaven/js/sim.js`));
const frontier = await import(pathToFileURL(`${repo}/docs/realm/wildhaven/js/frontier.js`));
const fixture = sim.restore(await fs.readFile(`${repo}/docs/realm/wildhaven/review/campaign-forge-save.json`, 'utf8'));
assert.ok(fixture, 'Existing authored Forge campaign restores');
// Authored review fixture: staged supplies, then real recruitment and elapsed
// training. This is an interaction fixture, not a claim of earned campaign play.
for (const key of ['wood', 'food', 'iron', 'tools']) fixture.resources[key] = Math.max(fixture.resources[key], 120);
const barracks = fixture.buildings.find(b => b.type === 'barracks' && b.status === 'ready');
assert.ok(barracks, 'Campaign contains a completed watch-house');
sim.setWorkers(fixture, barracks.id, 3);
const recruited = [];
for (const kind of ['spearman', 'spearman', 'archer']) {
  const result = frontier.recruitTroop(fixture, kind, null, sim.frontierContext(fixture));
  assert.ok(result.ok, result.reason); recruited.push(result.unit.id);
}
sim.tick(fixture, 46);
assert.ok(recruited.every(id => fixture.frontier.units.find(u => u.id === id)?.status === 'active'), 'Recruits completed real training');
const seed = sim.serialize(fixture);
assert.ok(sim.restore(seed), 'Prepared fixture round-trips');
await fs.writeFile(`${out}/authored-fixture.json`, seed);
const report = {
  fixture: 'Existing campaign-forge-save restored through sim.restore; wood/food/iron/tools staged to at least 120. Three residents recruited through recruitTroop and trained by sim.tick(46). No player storage is used.',
  base, recruited, viewports: [], errors: [], browser: 'Headless Chrome, isolated temporary browser contexts; no physical iPad claim.',
};
let browser, currentPage;

async function worldPoint(page, kind, id) {
  return page.evaluate(({ kind, id }) => {
    const w = __wildhaven.world, canvas = document.getElementById('world');
    const eligible = (x, y) => x > 6 && y > 6 && x < innerWidth - 6 && y < innerHeight - 6 && document.elementFromPoint(x, y) === canvas;
    const matches = pick => kind === 'troop' ? pick?.troop?.id === id : kind === 'empty'
      ? pick && !pick.troop && !pick.citizen && !pick.tree && !pick.scenery && !pick.landmark && !pick.discovery && !pick.fortification && !pick.neighbor && w.walkable(pick.x, pick.z)
      : pick && !pick.troop && !pick.citizen && !pick.tree && !pick.scenery && __wildhaven.state.buildings.some(b => b.id === id && b.x === pick.x && b.z === pick.z);
    let candidates = [];
    if (kind === 'troop') {
      const root = w.troops.get(id)?.root; if (!root) return null;
      for (const height of [.25, .45, .65, .85]) {
        const p = root.position.clone(); p.y += height; p.project(w.camera);
        candidates.push({ x: (p.x + 1) * w.width / 2, y: (1 - p.y) * w.height / 2 });
      }
    } else if (kind === 'building') {
      const b = __wildhaven.state.buildings.find(b => b.id === id); if (!b) return null;
      candidates = [w.project(b.x, b.z)];
    } else {
      for (let z = 0; z <= 7; z++) for (let x = -6; x <= 6; x++) candidates.push(w.project(x, z));
    }
    for (const p of candidates) for (const dy of [0, -5, 5, -10, 10, -16]) for (const dx of [0, -5, 5, -10, 10]) {
      const x = Math.round(p.x + dx), y = Math.round(p.y + dy);
      if (!eligible(x, y)) continue;
      const pick = w.pick(x, y); if (matches(pick)) return { x, y, tile: { x: pick.x, z: pick.z }, troop: pick.troop?.id };
    }
    return null;
  }, { kind, id });
}
async function focusTroop(page, id) {
  await page.evaluate(id => { const u = __wildhaven.state.frontier.units.find(u => u.id === id); __wildhaven.world.focusWorld(u.x, u.z, 13); }, id);
  await page.waitForTimeout(450);
  const point = await worldPoint(page, 'troop', id);
  assert.ok(point, `Actual raycast exposes ${id} on the canvas`); return point;
}
const selection = page => page.evaluate(() => [...__wildhaven.frontierUI.selectedTroops].sort());
const clock = page => page.evaluate(() => [__wildhaven.state.day, __wildhaven.state.time, __wildhaven.state.subsecond]);
const consequence = page => page.evaluate(() => ({ resources: { ...__wildhaven.state.resources }, units: __wildhaven.state.frontier.units.map(u => ({ id: u.id, order: structuredClone(u.order), path: structuredClone(u.path), hp: u.hp, status: u.status })) }));

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, width, height, touch] of [
    ['ipad-landscape', 1024, 768, true], ['ipad-portrait', 768, 1024, true],
    ['short-landscape', 667, 375, true], ['phone', 390, 844, true], ['desktop', 1440, 900, false],
  ].filter(([name]) => !process.env.WILDHAVEN_REVIEW_ONLY || process.env.WILDHAVEN_REVIEW_ONLY.split(',').includes(name))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1 });
    try {
      await context.addInitScript(seed => {
        if (!sessionStorage.getItem('defense-review-seeded')) { localStorage.setItem('wildhaven.v4', seed); sessionStorage.setItem('defense-review-seeded', '1'); }
      }, seed);
      const page = currentPage = await context.newPage();
      page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
      page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname !== '/favicon.ico') report.errors.push(`${name}: ${response.status()} ${response.url()}`); });
      const result = { name, width, height, touch, checks: [] }; report.viewports.push(result);
      const click = async selector => { const node = page.locator(selector); await node.scrollIntoViewIfNeeded(); await node[touch ? 'tap' : 'click'](); };
      const action = id => click(`[data-frontier-action="${id}"]`);
      const tapPoint = p => touch ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y);
      const company = async () => { if (await page.locator('#frontier-panel').isHidden()) await click('#frontier-toggle'); await action('tab-company'); };
      await page.goto(base);
      await page.locator('#continue').waitFor({ state: 'visible', timeout: 60000 }); await click('#continue');
      await page.waitForFunction(() => window.__wildhaven && !__wildhaven.companionInfo().blocked);
      await company();
      await action('select-ready'); assert.deepEqual(await selection(page), [...recruited].sort());
      const initial = await consequence(page); await action('defend');
      const defended = await page.evaluate(() => __wildhaven.state.frontier.units.map(u => ({ id: u.id, order: u.order })));
      for (const id of recruited) {
        const order = defended.find(u => u.id === id).order;
        assert.equal(order.type, 'defend'); assert.ok(order.anchor);
        assert.ok(Math.hypot(order.x - order.anchor.x, order.z - order.anchor.z) <= 8 + 1e-6);
      }
      assert.deepEqual((await consequence(page)).resources, initial.resources);
      const cues = await page.evaluate(() => {
        const w = __wildhaven.world, anchor = __wildhaven.state.frontier.units.find(u => u.order.type === 'defend').order.anchor;
        return (w.frontierSelectionGroup?.children || []).filter(o => o.isLine && o.geometry.attributes.position.count === 65).map(o => {
          const a = o.geometry.attributes.position; return Array.from({ length: a.count }, (_, i) => Math.hypot(a.getX(i) / 1.8 - anchor.x, a.getZ(i) / 1.8 - anchor.z));
        });
      });
      assert.ok(cues.length, 'Defend Town has a visible 8-tile anchor-area cue');
      assert.ok(cues.flat().every(radius => Math.abs(radius - 8) < .00001));
      assert.match(await page.locator('.company-order-help').innerText(), /8 tiles/);
      result.checks.push('ready selection, Defend Town, 8-tile anchor cues, no cost');

      await action('save-squad');
      const squad = await page.evaluate(() => structuredClone(__wildhaven.state.frontier.squads[0]));
      assert.deepEqual([...squad.unitIds].sort(), [...recruited].sort());
      await action('clear-units'); const preRecall = await consequence(page);
      await action(`recall-squad-${squad.id}`); assert.deepEqual(await selection(page), [...recruited].sort());
      assert.deepEqual(await consequence(page), preRecall, 'Recall changes selection only');
      await action('hold');
      assert.ok((await consequence(page)).units.filter(u => recruited.includes(u.id)).every(u => u.order.type === 'hold'));
      result.checks.push('save/recall squad without orders or spending; Hold Here');

      const layout = await page.evaluate(() => {
        const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        return { overflow: document.documentElement.scrollWidth > innerWidth, panel: box(document.getElementById('frontier-panel')),
          targets: [...document.querySelectorAll('.company-selection button')].map(node => ({ id: node.dataset.frontierAction, ...box(node) })),
          art: { display: getComputedStyle(document.querySelector('.company-art')).display, ...box(document.querySelector('.company-art')) } };
      });
      assert.equal(layout.overflow, false); assert.ok(layout.panel.x >= -.5 && layout.panel.right <= width + .5 && layout.panel.y >= 0 && layout.panel.bottom <= height + .5, `${name}: panel fits ${JSON.stringify(layout.panel)}`);
      for (const target of layout.targets) assert.ok(target.width >= 44 && target.height >= 44, `${name}: ${target.id} is 44px`);
      if (height < 600) assert.equal(layout.art.display, 'none'); else assert.ok(layout.art.height <= 100.5);
      result.layout = layout; await page.screenshot({ path: `${out}/${name}-company.png` });

      // Selection mode must consume non-soldier taps without opening inspection.
      await action('select-on-island'); await page.locator('#frontier-command').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#frontier-panel').isHidden(), true);
      const beforeCancel = await consequence(page), oldSelection = await selection(page);
      await tapPoint(await focusTroop(page, recruited[0]));
      assert.deepEqual(await selection(page), oldSelection.filter(id => id !== recruited[0]));
      const empty = await worldPoint(page, 'empty'); assert.ok(empty, `${name}: uncovered empty ground`); await tapPoint(empty);
      assert.equal(await page.locator('#inspector').isHidden(), true);
      assert.equal(await page.locator('#town-book').isHidden(), true);
      const hearth = await worldPoint(page, 'building', 'hearth');
      if (hearth) { await tapPoint(hearth); assert.equal(await page.locator('#inspector').isHidden(), true); result.checks.push('building tap consumed in selection'); }
      else result.checks.push('hearth obscured at this viewport; empty-ground consumption checked');
      await action('cancel-command'); assert.deepEqual(await selection(page), oldSelection);
      assert.deepEqual(await consequence(page), beforeCancel, 'Cancel restores prior selection and changes no orders/resources');
      await action('select-on-island'); await tapPoint(await focusTroop(page, recruited[0])); await action('finish-selection');
      assert.deepEqual(await selection(page), oldSelection.filter(id => id !== recruited[0]));
      assert.deepEqual(await consequence(page), beforeCancel, 'Done changes selection only');
      result.checks.push('actual projected troop tap; empty/object taps; Done/Cancel without orders or spending');

      await action('select-ready'); const beforeMove = await consequence(page); await action('move');
      await action('cancel-command'); assert.deepEqual(await consequence(page), beforeMove);
      await action('move'); const destination = await worldPoint(page, 'empty'); assert.ok(destination); await tapPoint(destination);
      assert.equal(await page.locator('#frontier-command').isHidden(), true, 'Valid Move commits');
      assert.ok((await consequence(page)).units.filter(u => recruited.includes(u.id)).every(u => u.order.type === 'move'));
      await action('attack'); const beforeRejected = await consequence(page);
      await tapPoint(await worldPoint(page, 'empty'));
      assert.equal(await page.locator('#frontier-command').isVisible(), true, 'Invalid attack remains aimable');
      assert.match(await page.locator('#frontier-command').innerText(), /enemy|hostile|war/i);
      assert.deepEqual(await consequence(page), beforeRejected); await action('cancel-command');
      result.checks.push('Move/cancel/valid ground; Attack rejects ordinary ground without mutation');

      if (name === 'ipad-landscape' || name === 'desktop') {
        await action('close'); await click('[data-speed="1"]'); await company();
        await action('select-on-island'); await page.waitForTimeout(100);
        const heldClock = await clock(page); await page.waitForTimeout(550); assert.deepEqual(await clock(page), heldClock, 'Reading hold continues with hidden Company during group selection');
        const gestureBefore = await consequence(page), selectionBefore = await selection(page);
        const p = await focusTroop(page, recruited[0]);
        if (touch) {
          const cdp = await context.newCDPSession(page);
          const dispatch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
          await dispatch('touchStart', [{ id: 1, x: p.x, y: p.y }]);
          await dispatch('touchMove', [{ id: 1, x: p.x + 65, y: p.y + 10 }]); await dispatch('touchEnd', []);
          assert.deepEqual(await selection(page), selectionBefore, 'Drag does not toggle soldier');
          const q = await focusTroop(page, recruited[0]);
          await dispatch('touchStart', [{ id: 1, x: q.x - 20, y: q.y }, { id: 2, x: q.x + 20, y: q.y }]);
          await dispatch('touchMove', [{ id: 1, x: q.x - 45, y: q.y }, { id: 2, x: q.x + 45, y: q.y }]);
          await dispatch('touchEnd', [{ id: 2, x: q.x + 45, y: q.y }]); await dispatch('touchEnd', []);
          const r = await focusTroop(page, recruited[0]);
          await dispatch('touchStart', [{ id: 1, x: r.x, y: r.y }]); await dispatch('touchCancel', []); await cdp.detach();
        } else {
          await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 65, p.y + 10, { steps: 5 }); await page.mouse.up();
        }
        assert.deepEqual(await selection(page), selectionBefore); assert.deepEqual(await consequence(page), gestureBefore);
        await action('cancel-command'); result.checks.push('reading hold survives selection; trusted drag/pinch/cancel consumes no click');
        // Closing the reading panel restores its prior 1x speed. Then use the
        // actual Pause button, so later tests do not accidentally resume it.
        await action('close'); await page.waitForTimeout(100);
        if (await page.locator('#pause').getAttribute('aria-label') === 'Pause') await click('#pause');
        await company();
      }

      if (name === 'desktop') {
        await action('clear-units'); await action('close');
        await tapPoint(await focusTroop(page, recruited[0])); assert.deepEqual(await selection(page), [recruited[0]]);
        await action('close'); const second = await focusTroop(page, recruited[1]);
        await page.keyboard.down('Shift'); await page.mouse.click(second.x, second.y); await page.keyboard.up('Shift');
        assert.deepEqual(await selection(page), [recruited[0], recruited[1]].sort()); result.checks.push('desktop real Shift-click adds second troop');
      }

      if (name === 'ipad-landscape') {
        await action('select-ready'); await action('defend');
        await page.reload(); await page.locator('#continue').waitFor({ state: 'visible', timeout: 60000 }); await click('#continue'); await company();
        assert.equal((await page.evaluate(() => __wildhaven.state.frontier.squads)).length, 1);
        assert.ok((await consequence(page)).units.filter(u => recruited.includes(u.id)).every(u => u.order.type === 'defend'));
        await action(`recall-squad-${squad.id}`); assert.deepEqual(await selection(page), [...recruited].sort());
        result.checks.push('reload persists named squad and Defend Town orders');
        await click('#people-details'); await click('#town-tabs [data-town-tab="watch"]');
        const watchText = await page.locator('#town-book-content').innerText(); assert.match(watchText, /cargo/i); assert.match(watchText, /soldier|company|field/i);
        result.watchText = watchText; await page.screenshot({ path: `${out}/watch-distinct-cargo.png` });
        await click('#companion-toggle');
        await page.locator('[data-companion-field="home-name"]').fill('Review home'); await page.locator('[data-companion-field="companion-name"]').fill('Review companion');
        await page.getByRole('button', { name: 'Create the companion town', exact: true }).tap();
        await click('[data-companion-action="manage-companion"]'); await company();
        assert.deepEqual(await selection(page), []); assert.equal(await page.evaluate(() => __wildhaven.state.frontier.squads.length), 0);
        await click('#companion-toggle'); await click('[data-companion-action="manage-home"]'); await company();
        assert.deepEqual(await selection(page), [], 'Town switch does not leak local selection back home');
        assert.equal(await page.evaluate(() => __wildhaven.state.frontier.squads.length), 1); await action(`recall-squad-${squad.id}`);
        assert.deepEqual(await selection(page), [...recruited].sort()); result.checks.push('companion/home selection isolation; squads remain per town');
        // Authored warning metadata checks the actual countdown-rendering path,
        // without waiting through the campaign's nine-minute warning lead-in.
        await page.evaluate(() => {
          const f = __wildhaven.state.frontier;
          f.warning = { id: `raid-${f.nextId++}`, source: 'raiders', announcedAt: f.clock, attackAt: f.clock + 360, amount: 3, entry: { x: 0, z: -24 } };
          __wildhaven.sync();
        });
        await action('close'); await click('#island-safety-status');
        assert.match(await page.locator('#frontier-title').innerText(), /company/i);
        assert.match(await page.locator('.frontier-warning').innerText(), /6m at 1×/);
        await action('tab-neighbors');
        await action('prepare-company'); assert.match(await page.locator('#frontier-title').innerText(), /company/i);
        assert.match(await page.locator('.frontier-warning').innerText(), /Coastal cargo demands.*separately/);
        await page.screenshot({ path: `${out}/authored-warning-company.png` });
        const activeValid = await page.evaluate(async () => {
          const s = __wildhaven.state, f = s.frontier, ctx = __wildhaven.frontierContext();
          let point;
          for (let z = -6; z <= 6 && !point; z++) for (let x = -6; x <= 6 && !point; x++) {
            if (ctx.isWalkable(x, z) && !f.units.some(u => Math.hypot(u.x - x, u.z - z) < 1)) point = { x, z };
          }
          if (!point) return false;
          f.units.push({ ...structuredClone(f.units[0]), ...point, id: `unit-${f.nextId++}`, citizenId: null,
            name: 'Authored review raider', kind: 'raider', faction: 'raiders', hp: 46, maxHp: 46, status: 'active', trainingRemaining: 0, trainingSeconds: 0,
            recoveryRemaining: 0, order: { type: 'raid' }, path: [], routeAt: -10, routeGoal: null, cooldown: 0, attackAt: null, damageAt: null, deathAt: null, targetId: null });
          f.raidActive = true; f.raidOutcome = { spawned: 1, killed: 0, escaped: 0, cargoLost: 0, uncertain: false, completed: false };
          const m = await import('./js/sim.js'); if (!m.restore(m.serialize(s))) return false;
          __wildhaven.sync(); return true;
        });
        assert.equal(activeValid, true, 'Authored simultaneous warning + active troop fixture round-trips');
        await action('close'); await click('#island-safety-status');
        assert.match(await page.locator('#frontier-title').innerText(), /company/i);
        assert.match(await page.locator('.frontier-warning').innerText(), /Hostile troops on the island/);
        assert.match(await page.locator('.frontier-warning').innerText(), /6m at 1×/);
        await page.screenshot({ path: `${out}/authored-warning-active-company.png` });
        result.checks.push('authored warning and simultaneous active troop round-trip; Safety lands Company; 6m at 1× and cargo distinction');
      }
      await page.screenshot({ path: `${out}/${name}-final.png` });
      result.passed = true;
    } catch (error) {
      if (currentPage) {
        await currentPage.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => {});
        await fs.writeFile(`${out}/${name}-failure-dom.txt`, await currentPage.locator('body').innerText().catch(() => 'Page unavailable'));
      }
      throw error;
    } finally { currentPage = null; await context.close(); }
  }
  assert.deepEqual(report.errors, []); report.passed = true; console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.stack;
  if (currentPage) await currentPage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(report, null, 2));
  if (browser) await browser.close();
}
