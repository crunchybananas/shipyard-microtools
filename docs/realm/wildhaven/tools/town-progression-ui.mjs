/** UI contract review. Prepared API fixtures are explicitly not a browser campaign. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const root = new URL('../', import.meta.url), review = new URL('../review/', import.meta.url);
const url = process.env.WILDHAVEN_URL || 'http://127.0.0.1:4751/wildhaven/?review';
const section = process.env.TOWN_QA_SECTION || 'all';
const campaignFile = process.env.WILDHAVEN_CAMPAIGN_SAVE || 'campaign-services-lanes-save.json';
if (!['all', 'fresh', 'campaign', 'watch', 'smoke'].includes(section)) throw new Error(`Unknown review section: ${section}`);
const prefix = process.env.WILDHAVEN_REVIEW_PREFIX || '';
if (!/^[a-z0-9-]*$/.test(prefix)) throw new Error('Invalid review prefix');
const reportFile = section === 'smoke' ? 'town-progression-ui-smoke-report.json' : section === 'watch' ? 'town-progression-ui-watch-report.json' : 'town-progression-ui-report.json';
const sourcePaths = ['js/discovery.js','js/fieldbook-ui.js','living.css','assets/living-kit.glb','index.html', 'style.css', 'js/main.js', 'js/world.js', 'js/town-ui.js', 'js/audio.js', 'js/catalog.js', 'js/progression.js', 'js/sim.js', 'js/island.js', 'js/frontier.js', 'js/pressure.js', 'assets/village-kit.glb'];
const sha = text => createHash('sha256').update(text).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path => {
  try { return [path, sha(await readFile(new URL(path, root)))]; }
  catch (error) { if (error.code === 'ENOENT' && path === 'js/pressure.js') return [path, null]; throw error; }
})));
await mkdir(review, { recursive: true });
const report = { startedAt: new Date().toISOString(), scope: 'Isolated Chromium UI review, not a browser-played campaign. Fresh school prepared with public build/tick/workforce APIs; late fixture imported from the separately recorded earned simulation campaign. UI buttons perform the reviewed actions. Clock skips are explicit.', section, sourceHashesAtStart: await hashes(), checks: [], errors: [], screenshots: [], fixtures: {} };
let browser;
async function check(name, task, critical = false) {
  if (section === 'watch' && !/Watch shows|Late Stores|390px|No browser/.test(name)) return;
  try { const detail = await task(); report.checks.push({ name, passed: true, ...(detail ? { detail } : {}) }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); if (critical) throw error; }
}
const shot = async (page, name) => { await page.screenshot({ path: new URL(`${prefix}${name}.png`, review).pathname }); report.screenshots.push(`${prefix}${name}.png`); };
const snapshot = page => page.evaluate(() => window.__wildhaven.snapshot());
async function pause(page) { if (await page.locator('#pause').getAttribute('aria-label') !== 'Resume') await page.locator('#pause').click(); }
async function open(page, tab) {
  const book = page.locator('#town-book');
  if (await book.isVisible()) await page.locator(`#town-tabs [data-town-tab="${tab}"]`).click();
  else await page.locator(`#town-tools [data-town-tab="${tab}"]`).click();
  await expect(book).toBeVisible();
}
async function advance(page, seconds) { return page.evaluate(seconds => { const result = window.__wildhaven.advance(seconds); window.__wildhaven.sync(); return result; }, seconds); }
async function restorePreparedCheckpoint(page, raw, key) {
  await page.addInitScript(({ raw, key }) => {
    if (!sessionStorage.getItem(key)) { localStorage.setItem('wildhaven.v2', raw); localStorage.removeItem('wildhaven.v3'); localStorage.removeItem('wildhaven.v4'); sessionStorage.setItem(key, 'loaded'); }
  }, { raw, key });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__wildhaven);
  await page.locator('#continue').click(); await pause(page);
  return page.evaluate(async () => {
    const sim = await import('./js/sim.js'), { getBuildingSpec } = await import('./js/catalog.js');
    const state = window.__wildhaven.state, assignments = [];
    // The campaign automation idles food jobs when its pantry target is met.
    // This independent fixture restores a steady food workforce before clock skips.
    for (const building of state.buildings.filter(building => ['orchard', 'farm', 'windmill', 'bakery', 'lumber', 'sawmill', 'smith', 'toolmaker'].includes(building.type) && building.status === 'ready')) {
      const workers = ['sawmill', 'smith', 'toolmaker'].includes(building.type) ? 0 : getBuildingSpec(building.type, building.level).workers;
      const result = sim.setWorkers(state, building.id, workers); if (!result.ok) throw new Error(result.reason);
      assignments.push({ id: building.id, type: building.type, workers });
    }
    window.__wildhaven.sync();
    return { label: 'Prepared earned checkpoint: food/timber jobs staffed and timber/plank-consuming craft jobs rested through public setWorkers for independent clock skips. No resources or unlocks injected.', assignments, foodPerDay: sim.rates(state).food, timberPerDay: sim.rates(state).wood };
  });
}
async function setup(page, mode, checkpoint) {
  page.on('pageerror', error => report.errors.push({ mode, source: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ mode, source: 'console', message: message.text(), location: message.location() }); });
  if (checkpoint) await page.addInitScript(raw => {
    if (!sessionStorage.getItem('town-qa-checkpoint')) { localStorage.setItem('wildhaven.v2', raw); sessionStorage.setItem('town-qa-checkpoint', 'loaded'); }
  }, checkpoint);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__wildhaven, { timeout: 45000 });
  await page.locator(checkpoint ? '#continue' : '#start').click();
  await pause(page);
  await page.waitForTimeout(300);
}

try {
  browser = await chromium.launch({ headless: true }); report.browser = browser.version();
  if (section === 'smoke') {
    report.scope = 'Scoped browser smoke after renderer-only changes. Verifies load, roof selection, panel navigation and phone glyph bounds, without replaying the separately recorded full functional suite.';
    const raw = await readFile(new URL(campaignFile, review), 'utf8');
    report.fixtures.campaign = { file: campaignFile, sha256: sha(raw), label: 'Previously earned simulation checkpoint, imported into an isolated browser.' };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await setup(page, 'post-renderer-smoke', raw);
      await check('Updated renderer loads the earned town and an actual cottage roof opens its inspector', async () => {
        const target = await page.evaluate(async () => {
          const { Box3, Vector3 } = await import('three'), { state, world } = window.__wildhaven;
          for (const building of state.buildings.filter(building => building.type === 'cottage')) {
            const root = world.buildings.get(building.id), box = new Box3().setFromObject(root), point = box.getCenter(new Vector3());
            point.y = box.max.y - (box.max.y - box.min.y) * .15; point.project(world.camera);
            const x = (point.x + 1) * world.width / 2, y = (1 - point.y) * world.height / 2;
            if (document.elementFromPoint(x, y)?.id === 'world') return { x, y };
          }
        });
        assert.ok(target); await page.mouse.click(target.x, target.y);
        await expect(page.locator('#inspect-title')).toHaveText('Cottage');
        await shot(page, 'town-progression-smoke-roof');
      }, true);
      await check('Council, trade, stores and watch remain accessible with the updated renderer', async () => {
        for (const tab of ['council', 'trade', 'stores', 'watch']) { await open(page, tab); assert.ok((await page.locator('#town-book-content').innerText()).length > 100); }
        await open(page, 'trade'); await page.locator('[data-action-id="trade-jump-imports"]').click();
        await expect(page.locator('[data-action-id="import-import_cloth"]')).toBeVisible();
        await shot(page, 'town-progression-smoke-trade');
      }, true);
      await check('Phone toolbar glyphs and town panels fit after the renderer update', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        for (const tab of ['council', 'trade', 'stores', 'watch']) {
          await open(page, tab);
          const defects = await page.evaluate(() => {
            const failures = [];
            for (const node of document.querySelectorAll('#town-book, #town-tabs button, #close-town-book, .market-quote')) {
              const rect = node.getBoundingClientRect(); if (rect.left < -1 || rect.right > innerWidth + 1) failures.push(node.textContent.slice(0, 60));
            }
            for (const node of document.querySelectorAll('#town-tools strong')) {
              const range = document.createRange(); range.selectNodeContents(node);
              const text = range.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
              if (getComputedStyle(node).overflowX === 'visible' && (text.left < parent.left - 1 || text.right > parent.right + 1)) failures.push(`Overlapping toolbar text: ${node.textContent}`);
            }
            return failures;
          });
          assert.deepEqual(defects, [], tab);
        }
        await shot(page, 'town-progression-smoke-mobile-watch');
      });
    } catch (error) { report.smokeFailure = error.message; await shot(page, 'town-progression-smoke-failure').catch(() => {}); }
    finally { await context.close(); }
  }
  if (section === 'all' || section === 'fresh') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await setup(page, 'prepared-fresh-school');
      report.fixtures.fresh = await page.evaluate(async () => {
        const sim = await import('./js/sim.js'); const state = window.__wildhaven.state;
        const placed = sim.build(state, 'school', -2, 0);
        if (!placed.ok) throw new Error(placed.reason);
        sim.setPriority(state, placed.building.id, 0); sim.setBuilderTarget(state, 2);
        window.__wildhaven.advance(260); window.__wildhaven.sync();
        return { label: 'Prepared school fixture, public simulation APIs only; no injected resources, citizens or research.', schoolId: placed.building.id, day: state.day, population: state.population, knowledge: state.resources.knowledge, setupSeconds: 260 };
      });
      await check('Council exposes research and charter prerequisites before spending', async () => {
        await open(page, 'council');
        const locked = page.locator('[data-action-id="research-metallurgy"]');
        await expect(locked).toBeDisabled();
        await expect(locked.locator('..')).toContainText('First research Timber framing');
        const charter = page.locator('[data-action-id="charter-breadbasket"]');
        await expect(charter).toBeDisabled();
        await expect(charter.locator('..')).toContainText('Research The island charter first');
        await shot(page, 'town-progression-01-prepared-council');
      }, true);
      await check('Visible research action charges knowledge and displays staffed progress', async () => {
        const before = await snapshot(page);
        await page.locator('[data-action-id="research-cultivation"]').click();
        const after = await snapshot(page);
        assert.equal(after.research.active.id, 'cultivation');
        assert.equal(after.resources.knowledge, Math.round((before.resources.knowledge - 12) * 1e6) / 1e6);
        await expect(page.locator('[data-action-id="research-cultivation"]')).toBeDisabled();
        await advance(page, 25);
        const during = await snapshot(page);
        assert.ok(during.research.active.progress > 0 && during.research.active.progress < during.research.active.duration);
        await expect(page.locator('#town-book-content')).toContainText('staffed schools keep the work moving');
        await shot(page, 'town-progression-02-prepared-research');
      }, true);
      await check('Research progress survives reload and the UI changes to Learned', async () => {
        const before = (await snapshot(page)).research.active.progress;
        await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__wildhaven);
        await page.locator('#continue').click(); await pause(page);
        assert.ok((await snapshot(page)).research.active.progress >= before);
        await advance(page, 90); await open(page, 'council');
        assert.ok((await snapshot(page)).research.completed.includes('cultivation'));
        await expect(page.locator('.research-card').filter({ hasText: 'Fieldcraft' })).toContainText('Learned');
      }, true);
      await check('Stores shows every resource, physical capacity, services and production chains', async () => {
        await open(page, 'stores');
        const text = await page.locator('#town-book-content').innerText();
        for (const label of ['Timber', 'Stone', 'Food', 'Grain', 'Flour', 'Planks', 'Iron ore', 'Iron', 'Tools', 'Flax', 'Cloth', 'Ale', 'Coin', 'Knowledge', 'Water access', 'Health access', 'Faith access', 'Grain farm → Windmill → Bakery → Food']) assert.ok(text.includes(label), label);
        assert.ok((await page.locator('.stock-amount em').count()) >= 12);
        await shot(page, 'town-progression-03-prepared-stores');
      });
      await check('Trade UI accepts then delivers a real order, with dates, costs and named trust', async () => {
        await open(page, 'trade');
        const offer = await page.evaluate(async () => (await import('./js/progression.js')).contractOptions(window.__wildhaven.state).find(order => order.status === 'offered' && order.definitionId === 'pantry'));
        assert.ok(offer, 'prepared day offers a pantry order');
        const selector = `[data-action-id="contract-${offer.id}"]`;
        const before = await snapshot(page);
        await page.locator(selector).click();
        assert.deepEqual((await snapshot(page)).resources, before.resources);
        await expect(page.locator(selector).locator('..')).toContainText(`Due by day ${before.day + offer.duration}`);
        await expect(page.locator(selector).locator('..')).toContainText('trust with Reedbank');
        await page.locator(selector).click();
        const delivered = await snapshot(page);
        assert.equal(delivered.resources.food, Math.round((before.resources.food - 18) * 1e6) / 1e6);
        assert.equal(delivered.resources.gold, before.resources.gold + offer.reward.gold);
        assert.equal(delivered.routes.reputation.reedbank, 1);
        await expect(page.locator(selector)).toHaveCount(0);
        const route = page.locator('[data-action-id="route-reedbank"]');
        await expect(route).toBeDisabled(); await expect(route.locator('..')).toContainText('Research Coastal partnerships first');
        await shot(page, 'town-progression-04-prepared-trade');
      }, true);
    } catch (error) { report.freshFailure = error.message; await shot(page, 'town-progression-fresh-failure').catch(() => {}); }
    finally { await context.close(); }
  }

  if (section === 'all' || section === 'campaign' || section === 'watch') {
    const raw = await readFile(new URL(campaignFile, review), 'utf8'), checkpoint = JSON.parse(raw);
    report.fixtures.campaign = { label: 'Imported earned simulation-campaign checkpoint. This UI test did not play that campaign.', file: campaignFile, sha256: sha(raw), day: checkpoint.day, population: checkpoint.population, research: checkpoint.research.completed, charter: checkpoint.policies.charter, contracts: checkpoint.contracts.completed, voyages: checkpoint.routes.completed };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await setup(page, 'earned-checkpoint', raw);
      await check('Earned checkpoint restores the late town and an explicit priced charter choice', async () => {
        assert.equal((await snapshot(page)).population, checkpoint.population);
        await open(page, 'council');
        const choice = page.locator('[data-action-id="charter-freeport"]');
        await expect(choice).toBeEnabled();
        await expect(choice.locator('..')).toContainText('60 coin'); await expect(choice.locator('..')).toContainText('25 knowledge');
        const before = await snapshot(page);
        await choice.click();
        const after = await snapshot(page);
        assert.equal(after.policies.charter, 'freeport');
        assert.equal(after.resources.gold, Math.round((before.resources.gold - 60) * 1e6) / 1e6);
        assert.equal(after.resources.knowledge, Math.round((before.resources.knowledge - 25) * 1e6) / 1e6);
        await expect(choice).toBeDisabled(); await expect(choice).toHaveText('Your charter');
        await shot(page, 'town-progression-05-earned-charter');
      }, true);
      await check('Harbor counter imports and exports spend exact quotes, with visible quotas preserved on reload', async () => {
        await open(page, 'trade');
        await page.locator('[data-action-id="trade-jump-imports"]').click();
        const quote = await page.evaluate(async () => (await import('./js/progression.js')).importOptions(window.__wildhaven.state).find(offer => offer.id === 'import_cloth'));
        assert.ok(quote.canImport, quote.reason); assert.equal(quote.dailyLimit, 3, 'Free Port receives the advertised extra shipment');
        const button = page.locator('[data-action-id="import-import_cloth"]');
        await expect(button.locator('..')).toContainText(`${quote.cost.gold} coin`);
        const before = await snapshot(page);
        for (let shipment = 0; shipment < quote.remaining; shipment++) await button.click();
        const bought = await snapshot(page);
        assert.equal(bought.resources.gold, Math.round((before.resources.gold - quote.cost.gold * quote.remaining) * 1e6) / 1e6);
        assert.equal(bought.resources.cloth, Math.round((before.resources.cloth + quote.reward.cloth * quote.remaining) * 1e6) / 1e6);
        await expect(button).toBeDisabled(); await expect(button.locator('..')).toContainText('next cargo arrives at dawn');
        await shot(page, 'town-progression-13-earned-import-quota');
        await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__wildhaven);
        await page.locator('#continue').click(); await pause(page); await open(page, 'trade');
        await expect(page.locator('[data-action-id="import-import_cloth"]')).toBeDisabled();
        const sale = await page.evaluate(async () => (await import('./js/progression.js')).exportOptions(window.__wildhaven.state).find(offer => offer.id === 'export_food'));
        assert.ok(sale.canExport, sale.reason);
        await page.locator('[data-action-id="trade-jump-exports"]').click();
        const saleBefore = await snapshot(page);
        await page.locator('[data-action-id="export-export_food"]').click();
        const sold = await snapshot(page);
        assert.equal(sold.resources.food, Math.round((saleBefore.resources.food - sale.cost.food) * 1e6) / 1e6);
        assert.equal(sold.resources.gold, Math.round((saleBefore.resources.gold + sale.reward.gold) * 1e6) / 1e6);
        assert.equal(sold.imports.exported.food, (saleBefore.imports.exported.food || 0) + sale.cost.food);
        await shot(page, 'town-progression-14-earned-export');
      }, true);
      await check('An earned town can queue and complete an upgrade through the inspector', async () => {
        await page.locator('#close-town-book').click();
        const target = await page.evaluate(async () => {
          const sim = await import('./js/sim.js'), { Box3, Vector3 } = await import('three');
          const { state, world } = window.__wildhaven;
          for (const building of state.buildings.filter(building => building.type === 'cottage' && sim.canUpgrade(state, building.id).ok)) {
            const root = world.buildings.get(building.id), box = new Box3().setFromObject(root), point = box.getCenter(new Vector3());
            point.y = box.max.y - (box.max.y - box.min.y) * .15; point.project(world.camera);
            const x = (point.x + 1) * world.width / 2, y = (1 - point.y) * world.height / 2;
            if (document.elementFromPoint(x, y)?.id === 'world') return { id: building.id, level: building.level, x, y, cost: sim.canUpgrade(state, building.id).cost };
          }
          return null;
        });
        assert.ok(target, 'an affordable visible cottage must be available in the earned checkpoint');
        await page.mouse.click(target.x, target.y);
        await expect(page.locator('#inspect-title')).toHaveText('Cottage');
        const button = page.locator(`[data-action-id="upgrade-${target.id}"]`);
        await expect(button).toBeEnabled();
        const before = await snapshot(page); await button.click();
        const queued = await snapshot(page), building = queued.buildings.find(building => building.id === target.id);
        assert.equal(building.constructionKind, 'upgrade');
        assert.equal(building.level, target.level);
        for (const [key, amount] of Object.entries(target.cost)) assert.equal(queued.resources[key], Math.round((before.resources[key] - amount) * 1e6) / 1e6);
        await open(page, 'construction');
        await expect(page.locator('#town-book-content')).toContainText('Cottage');
        await advance(page, 5);
        assert.ok((await snapshot(page)).buildings.find(building => building.id === target.id).progress > 0);
        await shot(page, 'town-progression-06-earned-upgrade');
        await advance(page, 180);
        const complete = (await snapshot(page)).buildings.find(building => building.id === target.id);
        assert.equal(complete.status, 'ready'); assert.equal(complete.level, target.level + 1);
      }, true);
      await check('Trade UI dispatches earned cargo and reports its actual return date', async () => {
        // The charter/upgrade review deliberately changes the town's food balance.
        // Start this independent route review from the same earned checkpoint.
        report.fixtures.route = await restorePreparedCheckpoint(page, raw, 'town-qa-route-checkpoint');
        await open(page, 'trade');
        const offer = await page.evaluate(async () => (await import('./js/progression.js')).routeOptions(window.__wildhaven.state).find(route => route.canDispatch));
        assert.ok(offer, 'the earned checkpoint must have a staffed affordable route available');
        const before = await snapshot(page);
        await page.locator(`[data-action-id="route-${offer.id}"]`).click();
        const dispatched = await snapshot(page), voyage = dispatched.routes.active.find(voyage => voyage.routeId === offer.id);
        assert.ok(voyage);
        assert.equal(voyage.returnDay, before.day + offer.duration);
        for (const [key, amount] of Object.entries(offer.cargo)) assert.equal(dispatched.resources[key], Math.round((before.resources[key] - amount) * 1e6) / 1e6);
        await expect(page.locator('#town-book-content')).toContainText(`At sea · expected day ${voyage.returnDay}`);
        await expect(page.locator(`[data-action-id="route-${offer.id}"]`)).toHaveCount(0);
        await shot(page, 'town-progression-07-earned-voyage');
        await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__wildhaven);
        await page.locator('#continue').click(); await pause(page);
        assert.ok((await snapshot(page)).routes.active.some(active => active.id === voyage.id));
        await advance(page, offer.duration * 90); await open(page, 'trade');
        const arrived = await snapshot(page);
        assert.ok(!arrived.routes.active.some(active => active.id === voyage.id));
        assert.ok(arrived.routes.completed >= dispatched.routes.completed + 1);
        assert.ok(arrived.events.some(event => event.type === 'voyage' && event.text.includes(offer.name)));
        await shot(page, 'town-progression-08-earned-return');
      }, true);
      await check('Watch shows a real warning, patrol progress, exact shelter/payment costs and a quiet record', async () => {
        report.fixtures.watch = await restorePreparedCheckpoint(page, raw, 'town-qa-watch-checkpoint');
        for (let dawn = 0; dawn < 9 && !(await snapshot(page)).pressure.active; dawn++) {
          const current = await snapshot(page); await advance(page, 90 - current.time);
        }
        const initial = await page.evaluate(async () => (await import('./js/pressure.js')).pressureOptions(window.__wildhaven.state).active);
        assert.ok(initial, 'public clock progression must announce a coastal warning');
        assert.equal(initial.preparedness, 0, 'this independent fixture arrives exactly at the warning dawn');
        assert.ok(initial.canShelter, initial.shelterReason); assert.ok(initial.canPay, initial.payReason);
        await open(page, 'watch');
        await expect(page.locator('#town-book-content')).toContainText(`At the shore on day ${initial.deadline}`);
        await expect(page.locator('[data-action-id="pressure-defend"]')).toBeDisabled();
        await expect(page.locator('#town-book-content')).toContainText('Complete the patrol rotation');
        await shot(page, 'town-progression-10-prepared-warning');
        const beforeShelter = await snapshot(page);
        await page.locator('[data-action-id="pressure-shelter"]').click();
        const sheltered = await snapshot(page);
        assert.equal(sheltered.pressure.active.sheltered, true);
        for (const [key, amount] of Object.entries(initial.shelterCost)) assert.equal(sheltered.resources[key], Math.round((beforeShelter.resources[key] - amount) * 1e6) / 1e6);
        await expect(page.locator('[data-action-id="pressure-shelter"]')).toHaveCount(0);
        await advance(page, 20);
        const patrol = await page.evaluate(async () => (await import('./js/pressure.js')).pressureOptions(window.__wildhaven.state).active);
        assert.ok(patrol.preparedness > 0 && patrol.preparedness < 1);
        for (const key of Object.keys(initial.maximumLoss)) assert.ok(patrol.maximumLoss[key] <= initial.maximumLoss[key]);
        await page.locator('#town-book-content').evaluate(node => { node.scrollTop = 0; });
        await shot(page, 'town-progression-11-prepared-patrol');
        const beforePay = await snapshot(page);
        await page.locator('[data-action-id="pressure-pay"]').click();
        const paid = await snapshot(page);
        assert.equal(paid.pressure.active, null); assert.equal(paid.pressure.paid, beforePay.pressure.paid + 1);
        for (const [key, amount] of Object.entries(initial.demand)) assert.equal(paid.resources[key], Math.round((beforePay.resources[key] - amount) * 1e6) / 1e6);
        assert.equal(paid.pressure.graceUntilDay, paid.day + 5);
        await expect(page.locator('#town-book-content')).toContainText('Crew provisioned');
        await shot(page, 'town-progression-12-prepared-quiet');
      }, true);
      await check('Late Stores panel includes neighborhood access and the earned economy', async () => {
        await open(page, 'stores');
        await expect(page.locator('#town-book-content')).toContainText('Health access');
        await expect(page.locator('#town-book-content')).toContainText('Leisure access');
        await expect(page.locator('#town-book-content')).toContainText('Timber craft');
        await shot(page, 'town-progression-09-earned-stores');
      });
      await check('Council, Trade and Stores remain legible and operable at 390px', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        for (const [tab, label] of [['council', 'Council'], ['trade', 'Trade'], ['stores', 'Stores']]) {
          await open(page, tab);
          await expect(page.locator('#town-book')).toBeVisible();
          const bounds = await page.evaluate(() => {
            const inside = selector => [...document.querySelectorAll(selector)].map(node => {
              const rect = node.getBoundingClientRect();
              return { text: node.textContent.trim().slice(0, 70), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
            });
            const summaries = [...document.querySelectorAll('#town-tools strong')].map(node => {
              const range = document.createRange(); range.selectNodeContents(node);
              const text = range.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
              return { label: node.textContent, left: text.left, right: text.right, parentLeft: parent.left, parentRight: parent.right, clipped: getComputedStyle(node).overflowX !== 'visible' };
            });
            return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, panel: inside('#town-book'), controls: inside('#town-tabs button, #close-town-book, .trade-jumps button'), cards: inside('.research-card, .stock-row, .town-row, .market-quote'), summaries };
          });
          assert.ok(bounds.scrollWidth <= bounds.width, `${label}: document must not overflow`);
          for (const rect of [...bounds.panel, ...bounds.controls, ...bounds.cards]) assert.ok(rect.left >= -1 && rect.right <= bounds.width + 1, `${label}: ${rect.text} clips horizontally (${rect.left}…${rect.right})`);
          for (const text of bounds.summaries) assert.ok(text.clipped || (text.left >= text.parentLeft - 1 && text.right <= text.parentRight + 1), `${label}: toolbar summary '${text.label}' overlaps a neighboring control`);
          if (tab === 'council') {
            const choice = page.locator('[data-action-id="charter-forge"]');
            await choice.scrollIntoViewIfNeeded(); await expect(choice).toBeVisible();
            const accessible = await choice.evaluate(node => {
              const rect = node.getBoundingClientRect();
              return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
            });
            assert.ok(accessible, 'the bottom charter action must be reachable by scrolling');
          }
          await page.locator('#town-book-content').evaluate(node => { node.scrollTop = 0; });
          await shot(page, `town-progression-mobile-${tab}`);
        }
        await page.locator('#close-town-book').click();
        await expect(page.locator('#town-book')).toBeHidden();
      });
      report.finalEarnedCheckpointState = await snapshot(page);
    } catch (error) { report.campaignFailure = error.message; await shot(page, 'town-progression-earned-failure').catch(() => {}); }
    finally { await context.close(); }
  }
  await check('No browser or application errors in prepared UI review', async () => assert.deepEqual(report.errors, []));
} catch (error) { report.fatalError = error.stack || error.message; }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  report.sourceHashesAtFinish = await hashes(); report.sourcesChangedDuringRun = sourcePaths.filter(path => report.sourceHashesAtStart[path] !== report.sourceHashesAtFinish[path]);
  report.passed = report.checks.length > 0 && report.checks.every(check => check.passed) && !report.fatalError && !report.freshFailure && !report.campaignFailure && !report.smokeFailure && report.sourcesChangedDuringRun.length === 0;
  await writeFile(new URL(prefix + reportFile, review), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failed: report.checks.filter(check => !check.passed).map(check => check.name), errors: report.errors.length, sourcesChangedDuringRun: report.sourcesChangedDuringRun, freshFailure: report.freshFailure, campaignFailure: report.campaignFailure, fatalError: report.fatalError }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
