/** Bounded navigation/motion regression. All mutations below are isolated QA fixtures. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const output = new URL('../review/', import.meta.url);
const url = process.env.WILDHAVEN_URL || 'http://127.0.0.1:4751/wildhaven/?review';
const sources = ['js/world.js', 'js/main.js', 'js/sim.js', 'assets/village-kit.glb'];
const hashes = async () => Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex')])));
await mkdir(output, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), url, scope: 'Isolated Chromium context. Controlled navigation fixtures directly construct funded villages and reposition one actor. This is not ordinary gameplay progression evidence. No user save is read or written.',
  sourceHashesAtStart: await hashes(), checks: [], errors: [], screenshots: [],
};
let browser;
async function check(name, operation) {
  const start = Date.now();
  try { const detail = await operation(); report.checks.push({ name, passed: true, elapsedMs: Date.now() - start, detail }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, elapsedMs: Date.now() - start, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__wildhaven && window.Wildhaven);
  await page.locator('#start').click();
  await page.locator('#pause').click();
  assert.equal(await page.locator('#pause').getAttribute('aria-label'), 'Resume');
  const testingStarted = Date.now();

  await check('Fixture: representative shortest paths avoid natural obstacles and occupied buildings', async () => {
    const detail = await page.evaluate(async () => {
      const sim = await import('./js/sim.js');
      const world = window.__wildhaven.world;
      world.sync(sim.createGame());
      const state = sim.createGame(); state.resources = { wood: 10000, stone: 10000, food: 10000 };
      for (const [type, x, z] of [['cottage', -2, 2], ['orchard', 2, 0], ['lumber', -4, -3], ['quarry', 5, -3], ['garden', 3, 0], ['cottage', -2, 3], ['cottage', -2, 4], ['windmill', 4, 0]]) {
        const result = sim.build(state, type, x, z); if (!result.ok) throw new Error(`${type}: ${result.reason}`);
      }
      sim.tick(state, sim.DAY_LENGTH * 5); world.sync(state); window.__navigationFixture = state;
      const nodes = [...world.reachable].map(key => { const [x, z] = key.split(',').map(Number); return { x, z }; });
      const errors = []; let paths = 0, traversedCells = 0;
      for (let i = 0; i < nodes.length; i += 3) {
        const start = nodes[i], end = nodes[(i * 17 + 29) % nodes.length];
        const path = world.findPath(start, end); paths++;
        if ((start.x !== end.x || start.z !== end.z) && !path.length) errors.push({ reason: 'No path inside connected component', start, end });
        let previous = start;
        for (const cell of path) {
          traversedCells++;
          if (!world.walkable(cell.x, cell.z) || world.decor.has(`${cell.x},${cell.z}`) || state.buildings.some(b => b.x === cell.x && b.z === cell.z)) errors.push({ reason: 'Obstacle crossed', cell });
          if (Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z) !== 1) errors.push({ reason: 'Non-cardinal step', previous, cell });
          previous = cell;
        }
      }
      return { paths, traversedCells, reachableCells: nodes.length, buildings: state.buildings.length, population: state.population, errors };
    });
    assert.ok(detail.paths > 20); assert.ok(detail.traversedCells > 100); assert.deepEqual(detail.errors, []);
    return detail;
  });

  await check('Fixture: every villager moves through legal cells during 30 simulated seconds', async () => {
    const detail = await page.evaluate(() => {
      const world = window.__wildhaven.world;
      const travel = world.actors.map(() => 0), illegal = [], legRange = world.actors.map(() => ({ min: Infinity, max: -Infinity }));
      for (let step = 0; step < 600; step++) {
        const before = world.actors.map(a => ({ x: a.root.position.x, z: a.root.position.z }));
        world.clock += 0.05; world.updateActors(0.05);
        world.actors.forEach((actor, index) => {
          const p = actor.root.position; travel[index] += Math.hypot(p.x - before[index].x, p.z - before[index].z);
          const cell = { x: Math.round(p.x / 1.8), z: Math.round(p.z / 1.8) };
          if (!world.walkable(cell.x, cell.z)) illegal.push({ actor: index, step, cell });
          const angle = actor.limbs.left_leg?.rotation.x;
          if (Number.isFinite(angle)) { legRange[index].min = Math.min(legRange[index].min, angle); legRange[index].max = Math.max(legRange[index].max, angle); }
        });
      }
      return { simulatedSeconds: 30, actorCount: world.actors.length, distances: travel.map(value => Math.round(value * 100) / 100), legRanges: legRange, illegal };
    });
    assert.equal(detail.actorCount, 13);
    assert.ok(detail.distances.every(value => value > 3), `Insufficient travel: ${detail.distances}`);
    assert.ok(detail.legRanges.every(value => value.max - value.min > 0.8), 'Every walking actor should swing both sides of the gait');
    assert.deepEqual(detail.illegal, []);
    return detail;
  });

  await check('Real pause control freezes actor positions and articulated limbs', async () => {
    const poses = () => page.evaluate(() => window.__wildhaven.world.actors.map(a => ({ position: a.root.position.toArray(), rotation: a.root.rotation.toArray(), limbs: Object.fromEntries(Object.entries(a.limbs).map(([name, limb]) => [name, limb.rotation.x])) })));
    const before = await poses(); await page.waitForTimeout(300); const after = await poses();
    assert.deepEqual(after, before); return { actorsChecked: before.length, pauseWallTimeMs: 300 };
  });

  await check('Fixture: enclosing construction rescues a villager into the hearth-connected component', async () => {
    const detail = await page.evaluate(async () => {
      const sim = await import('./js/sim.js'), world = window.__wildhaven.world;
      const state = sim.createGame(); state.resources = { wood: 10000, stone: 10000, food: 10000 };
      world.sync(state);
      const actor = world.actors[0]; actor.root.position.set(1.8, sim.groundHeight(1, 2), 3.6); actor.path = []; actor.wait = 0;
      for (const [x, z] of [[2, 2], [1, 1], [1, 3]]) {
        const result = sim.build(state, 'cottage', x, z); if (!result.ok) throw new Error(result.reason);
      }
      world.sync(state);
      const cell = { x: Math.round(actor.root.position.x / 1.8), z: Math.round(actor.root.position.z / 1.8) };
      return { before: { x: 1, z: 2 }, after: cell, reachable: world.reachable.has(`${cell.x},${cell.z}`), walkable: world.walkable(cell.x, cell.z), pathToHearth: world.findPath(cell, { x: 0, z: 3 }) };
    });
    assert.notDeepEqual(detail.after, detail.before); assert.equal(detail.reachable, true); assert.equal(detail.walkable, true);
    assert.ok(detail.pathToHearth.length || (detail.after.x === 0 && detail.after.z === 3));
    return detail;
  });

  await check('Fixture: capture three actual rendered gait poses for visual review', async () => {
    await page.evaluate(async () => {
      const sim = await import('./js/sim.js'), world = window.__wildhaven.world;
      world.sync(sim.createGame()); world.sync(window.__navigationFixture);
      document.body.classList.add('photo');
      world.actors.forEach((actor, index) => { actor.root.visible = index < 3; });
      const actor = world.actors[0]; actor.root.position.set(1.8, sim.groundHeight(1, 3), 5.4); actor.phase = 0; actor.parcel.visible = false; actor.path = [{ x: 1, z: 4 }, { x: 1, z: 5 }, { x: 1, z: 6 }];
      actor.root.rotation.y = 0; world.pan.set(1.8, 0, 6.1); world.zoom = world.targetZoom = 4.6; world.updateCamera(1); world.render(0, { playing: false, speed: 0 });
    });
    const poses = [];
    for (let i = 0; i < 3; i++) {
      const pose = await page.evaluate(index => {
        const world = window.__wildhaven.world;
        for (let j = 0; j < (index ? 8 : 2); j++) { world.clock += 0.05; world.updateActors(0.05); }
        world.render(0, { playing: false, speed: 0 });
        const actor = world.actors[0]; return { position: actor.root.position.toArray(), limbs: Object.fromEntries(Object.entries(actor.limbs).map(([name, limb]) => [name, limb.rotation.x])) };
      }, i);
      const name = `navigation-pose-${i + 1}.png`; await page.screenshot({ path: new URL(name, output).pathname }); report.screenshots.push(name); poses.push(pose);
    }
    return { cameraZoom: 4.6, poses, note: 'Close-up actual game meshes, lighting, shadows and movement. Camera/position staged only for inspection.' };
  });
  report.testWallTimeMs = Date.now() - testingStarted;
  report.diagnostics = await page.evaluate(() => window.Wildhaven.getDiagnostics());
  assert.ok(report.testWallTimeMs < 30000, 'Navigation checks exceeded the 30-second run bound');
  await context.close();
} catch (error) {
  report.fatalError = error.stack || error.message;
  console.error(report.fatalError);
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString(); report.sourceHashesAtEnd = await hashes();
  report.sourcesStable = JSON.stringify(report.sourceHashesAtStart) === JSON.stringify(report.sourceHashesAtEnd);
  report.passed = !report.fatalError && !report.errors.length && report.sourcesStable && report.checks.every(check => check.passed);
  await writeFile(new URL('navigation-report.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, errors: report.errors, testWallTimeMs: report.testWallTimeMs, sourcesStable: report.sourcesStable }, null, 2));
  process.exitCode = report.passed ? 0 : 1;
}
