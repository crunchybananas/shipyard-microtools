// ROOT-RUN ONLY. One isolated browser; no persistent user profile or live save.
// Engineering fixture: authored watch house at buildable (0,7), two supplied
// guards assigned to worker slots 0 and 2, with deterministic shore starts.
// Manually advances presentation movement for 20 seconds; does not earn a town
// or measure economy, real-time frame rate, human play, or native iPad Safari.
const { chromium } = await import(process.env.WILDHAVEN_PLAYWRIGHT || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const URL = 'http://127.0.0.1:14725/candidate/realm/wildhaven/?review';
const OUT = '/tmp/wildhaven-ui-review';
const report = { fixture: 'Engineering fixture, not an earned town: authored shore watch house; guard worker slots 0 and 2; 20 seconds of actual presentation movement.', url: URL, errors: [], samples: [] };
let browser, context, page;
await fs.mkdir(OUT, { recursive: true });
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(URL);
  await page.locator('#start').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#start').tap(); await page.locator('#pause').tap();
  report.setup = await page.evaluate(async () => {
    const q = window.__wildhaven, world = q.world, state = q.state;
    const { groundHeight, terrainAt, isLand } = await import('./js/island.js');
    const CELL = 1.8, site = { x: 0, z: 7 };
    if (!terrainAt(site.x, site.z).buildable) throw new Error('Engineering watch-house site is not buildable terrain.');
    state.citizens = state.citizens.slice(0, 2); state.population = 2; state.builderTarget = 0;
    const house = { id: 'fixture-shore-watch', type: 'barracks', ...site, rotation: 0, level: 1, status: 'ready', builtDay: 1,
      constructionKind: null, targetLevel: 1, progress: 0, workRequired: 0, escrow: {}, investment: {}, queueOrder: 0,
      desiredWorkers: 2, workerIds: [], paused: false, priority: 0, production: null };
    state.buildings.push(house); q.sync();
    if (state.citizens.some(c => c.job !== 'guard' || c.workplace !== house.id)) throw new Error('Fixture guards were not assigned by the canonical workforce refresh.');
    // A reserved middle slot specifically exercises clamped arrival ports.
    // This deliberate index fixture changes neither the authored GLB nor poses.
    house.workerIds = [state.citizens[0].id, 'fixture-unoccupied-middle-slot', state.citizens[1].id];
    const actors = state.citizens.map(c => world.actors.find(a => a.citizen.id === c.id));
    if (actors.some(a => !a)) throw new Error('Missing rendered guard.');
    const starts = [{ x: -3, z: 8 }, { x: 3, z: 8 }];
    actors.forEach((a, i) => {
      a.index = i ? 2 : 0; a.station = null; a.blockedWaypoint = null;
      a.root.position.set(starts[i].x * CELL, groundHeight(starts[i].x, starts[i].z), starts[i].z * CELL);
      world.resetActorRoute(a); world.routeActor(a);
      if (!a.station || !a.path.length) throw new Error(`Guard ${i} has no authored-model approach: ${a.root.userData.workReason}`);
    });
    const ports = actors.map(a => ({ ...a.station.approach }));
    const portSeparation = Math.hypot(ports[0].x - ports[1].x, ports[0].z - ports[1].z) * CELL;
    let meshCount = 0, vertices = 0;
    world.buildings.get(house.id).userData.model.traverse(node => { if (node.isMesh) { meshCount++; vertices += node.geometry?.attributes.position?.count || 0; } });
    world.pan.set(0, 0, 7 * CELL); world.targetZoom = 14; world.updateCamera(1);
    world.render(0, { speed: 0, playing: true, dayTime: .3, won: false });
    const overlay = document.createElement('div'); overlay.textContent = 'ENGINEERING FIXTURE · two shore guards · manual movement clock · no earned-town claim';
    overlay.style.cssText = 'position:fixed;left:12px;bottom:85px;z-index:9999;background:#183b39;color:white;padding:8px 12px;font:13px system-ui;pointer-events:none;border-radius:5px'; document.body.append(overlay);
    const snapshot = () => actors.map(a => ({ id: a.citizen.id, x: a.root.position.x, z: a.root.position.z, activity: a.activity, workState: a.root.userData.workState,
      pathLength: a.path.length, workTime: a.workTime, blockedWaypoint: a.blockedWaypoint || null, station: a.station && { point: a.station.point, approach: a.station.approach, access: a.station.access } }));
    window.__shoreGuardFixture = { actors, isLand, CELL, elapsed: 0, dryViolations: [], blockedTileViolations: [], maxStep: 0, minSeparation: Infinity,
      firstWatching: {}, distanceTravelled: actors.map(() => 0), starts: actors.map(a => a.root.position.clone()), snapshot,
      economyBefore: JSON.stringify({ resources: state.resources, population: state.population, elapsed: state.elapsed, day: state.day, time: state.time }) };
    const imports = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const sourceURL = new window.URL(imports['./js/world.js'], location.href).href, source = await (await fetch(sourceURL)).arrayBuffer();
    const worldSourceSHA256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', source))].map(n => n.toString(16).padStart(2, '0')).join('');
    return { site, terrain: terrainAt(site.x, site.z), portSeparation, ports, meshCount, vertices, worldSourceSHA256, sourceURL, actors: snapshot() };
  });
  assert.ok(report.setup.meshCount > 0 && report.setup.vertices > 100, 'Actual authored watch-house mesh is present');
  assert.ok(report.setup.portSeparation >= .445, `Overlapping arrival ports: ${report.setup.portSeparation}`);
  await page.screenshot({ path: `${OUT}/shore-guards-entry.png` });

  async function step(seconds, stage) {
    const sample = await page.evaluate(({ seconds, stage }) => {
      const q = __wildhaven, world = q.world, f = __shoreGuardFixture, dt = .05;
      for (let frame = 0; frame < Math.round(seconds / dt); frame++) {
        const previous = f.actors.map(a => a.root.position.clone()); world.clock += dt; world.updateActors(dt); f.elapsed += dt;
        f.actors.forEach((a, i) => {
          const x = a.root.position.x / f.CELL, z = a.root.position.z / f.CELL;
          if (!f.isLand(x + .13, z + .13) || !f.isLand(x - .13, z - .13)) f.dryViolations.push({ at: f.elapsed, id: a.citizen.id, x, z });
          if (!world.actorWaypointValid({ x, z, stationBuilding: a.station?.buildingId })) f.blockedTileViolations.push({ at: f.elapsed, id: a.citizen.id, x, z });
          const moved = Math.hypot(a.root.position.x - previous[i].x, a.root.position.z - previous[i].z); f.maxStep = Math.max(f.maxStep, moved); f.distanceTravelled[i] += moved;
          if (a.root.userData.workState === 'watching' && !a.path.length) f.firstWatching[a.citizen.id] ??= f.elapsed;
        });
        const [a, b] = f.actors; f.minSeparation = Math.min(f.minSeparation, Math.hypot(a.root.position.x - b.root.position.x, a.root.position.z - b.root.position.z));
      }
      world.render(0, { speed: 0, playing: true, dayTime: .3, won: false });
      return { stage, elapsed: f.elapsed, actors: f.snapshot(), minSeparation: f.minSeparation, maxStep: f.maxStep, firstWatching: { ...f.firstWatching }, distanceTravelled: [...f.distanceTravelled], dryViolations: f.dryViolations, blockedTileViolations: f.blockedTileViolations };
    }, { seconds, stage });
    report.samples.push(sample);
    assert.deepEqual(sample.dryViolations, [], 'Every sampled position stays on dry land');
    assert.deepEqual(sample.blockedTileViolations, [], 'Every sampled position respects building/fence cells');
    assert.ok(sample.maxStep < .25, `Unexpected relocation in a 50 ms movement step: ${sample.maxStep}`);
    return sample;
  }
  for (let chunk = 0; chunk < 7; chunk++) await step(2, 'entry');
  const entered = report.samples.at(-1);
  assert.equal(Object.keys(entered.firstWatching).length, 2, 'Both guards actually reach watching within 14 movement seconds');
  assert.ok(entered.actors.every(a => a.workState === 'watching' && a.pathLength === 0), 'Both hold real work stances');
  assert.ok(entered.distanceTravelled.every(d => d > 3), 'Both guards made meaningful physical progress');
  await page.screenshot({ path: `${OUT}/shore-guards-watching.png` });

  report.patrolStart = await page.evaluate(() => {
    const f = __shoreGuardFixture;
    f.patrolStarts = f.actors.map(a => a.root.position.clone());
    // Skip the cosmetic standing dwell, then let the real guard routeActor
    // choose its normal patrol. No route or position is supplied here.
    for (const a of f.actors) a.wait = 0;
    return f.snapshot();
  });
  for (let chunk = 0; chunk < 3; chunk++) await step(2, 'patrol');
  report.final = await page.evaluate(() => {
    const f = __shoreGuardFixture, state = __wildhaven.state;
    return { actors: f.snapshot(), minSeparation: f.minSeparation, maxStep: f.maxStep, firstWatching: f.firstWatching,
      patrolDisplacement: f.actors.map((a, i) => Math.hypot(a.root.position.x - f.patrolStarts[i].x, a.root.position.z - f.patrolStarts[i].z)),
      economyUnchanged: f.economyBefore === JSON.stringify({ resources: state.resources, population: state.population, elapsed: state.elapsed, day: state.day, time: state.time }) };
  });
  assert.ok(report.final.patrolDisplacement.every(d => d > .35), 'Each guard leaves its work stance and physically patrols');
  assert.ok(report.final.minSeparation >= .43, `Guard bodies overlap: ${report.final.minSeparation}`);
  assert.equal(report.final.economyUnchanged, true, 'Presentation fixture does not advance the economy');
  assert.deepEqual(report.errors, [], 'No runtime or asset-loading errors');
  await page.screenshot({ path: `${OUT}/shore-guards-patrol.png` });
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack;
  if (page) await page.screenshot({ path: `${OUT}/shore-guards-failed.png` }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(`${OUT}/shore-guards.json`, JSON.stringify(report, null, 2));
  await context?.close(); await browser?.close();
  console.log(JSON.stringify({ passed: report.passed, fixture: report.fixture, report: `${OUT}/shore-guards.json`, error: report.failure || null }, null, 2));
}
