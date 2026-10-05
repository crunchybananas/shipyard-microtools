#!/usr/bin/env node
// The oracle uses the actual raster draw calls, not the game's hit-test data.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
const server = await ensureServer(), browser = await launchGraphicsBrowser();
const out = new URL(`../tmp/graphics-world/visible-picking-214${graphicsBrowserSuffix}/`, import.meta.url);
await mkdir(out, {recursive: true});
const report = {browser: browser.version(), cases: [], errors: []};
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({viewport: {width: 1200, height: 920}, deviceScaleFactor: dpr});
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(server.gameUrl, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof startNewGame === 'function');
    await page.locator('#kingdom-name-input').fill('Visible people');
    await page.evaluate(() => {startNewGame(); setSpeed(0);});
    await page.getByRole('button', {name: 'Skip tutorial', exact: true}).click();
    await page.waitForFunction(() => G.camera.zoom === 1.3 && __realm.houseSprites().ready && __realm.builderSprites().small.length === 4 && __realm.builderSprites().small.every(a => a.state === 'ready'));
    await page.evaluate(async () => {
      const renderer = await import('./js/render.js?realm=198');
      const {TILE} = await import('./js/state.js?realm=198');
      const ownership = await import('./js/citizen-ownership.js?realm=198');
      const cache = await import('./js/citizen-render-cache.js?realm=198');
      const ui = await import('./js/ui.js?realm=198');
      G.debug.pauseRendering = true; G._followAvatar = false; G._renderAlpha = 1; G.photoMode = true;
      Object.assign(G.resources, {wood: 1000, stone: 1000});
      for (let y = 36; y < 47; y++) for (let x = 36; x < 47; x++) if (!G.buildingGrid[y][x]) {G.map[y][x] = TILE.GRASS; G.fog[y][x] = true;}
      const result = G.debug.dispatch({type: 'PLACE_BUILDING', building: 'house', x: 43, y: 42});
      if (!result.ok) throw new Error(result.reason);
      const b = G.buildingGrid[42][43], c = G.citizens[0];
      while (G.citizens.length > 1) ownership.removeCitizenFromWorld(G.citizens.at(-1), 'citizen-removed');
      G.population = 1; G.buildings = [b]; G.avatar = null;
      G.animals = []; G.walkers = []; G.soldiers = []; G.enemies = []; G.caravans = [];
      G.map = G.map.map(row => row.map(() => TILE.GRASS)); G.fog = G.fog.map(row => row.map(() => true));
      window.pickReview = {renderer, ownership, cache, ui, b, c};
    });
    for (const zoom of [1.3, 2.7]) for (const scenario of ['empty-plot-beside-citizen', 'behind-roof', 'in-front-of-wall', 'visible-through-frame']) {
      const target = await page.evaluate(({zoom, scenario}) => {
        const {renderer, ownership, cache, ui, b, c} = pickReview;
        b.level = 1; b.buildProgress = scenario.startsWith('empty') ? 0 : scenario === 'visible-through-frame' ? 4.5 / 15 : 1;
        const offset = scenario.startsWith('empty') ? 0 : scenario === 'in-front-of-wall' ? .2 : -.2;
        Object.assign(c, {x: b.x + offset, y: b.y + offset, _px: b.x + offset, _py: b.y + offset,
          tx: b.x + offset, ty: b.y + offset, path: null, pathIdx: 0, faceX: 1, faceZ: 1, carrying: null, carryAmount: 0});
        ownership.transitionCitizenActivity(c, 'idle', 'idle-wait'); cache.resetCitizenRenderCache();
        G.gameTick++; G.selectedBuild = null; G.selectedCitizenId = null; G.selectedBuilding = null; G.hoveredTile = null; ui.hideInfoPanel();
        const ground = renderer.toScreen(b.x, b.y); G.camera = {x: ground.x, y: ground.y - 25, zoom};
        const canvas = document.getElementById('game'), ctx = canvas.getContext('2d'), rect = canvas.getBoundingClientRect();
        const draws = [], original = ctx.drawImage;
        ctx.drawImage = function(image, ...args) {
          const url = image.src || '', kind = url.includes('/citizens/builder/') ? 'citizen'
            : /\/homes\/(detail\/|complete-|construction-)/.test(url) ? 'house' : null;
          if (kind) draws.push({kind, image, args, transform: this.getTransform()});
          return original.call(this, image, ...args);
        };
        try {renderer.render();} finally {ctx.drawImage = original;}
        const home = draws.find(d => d.kind === 'house'), citizen = draws.find(d => d.kind === 'citizen');
        if (!home || !citizen) throw new Error('Missing source draw in the picking fixture');
        const toClient = (point, transform) => {const p = transform.transformPoint(point); return {
          x: rect.left + p.x * rect.width / canvas.width, y: rect.top + p.y * rect.height / canvas.height};};
        if (scenario.startsWith('empty')) {
          const a = home.args;
          return {...toClient({x: a[4] + a[6] * .5 + 15, y: a[5] + a[7] * .78 + 3}, home.transform), expected: 'house', actorId: c.actorId};
        }
        // Compare independent masks of the observed draws in a small region
        // of backing pixels surrounding the house. No input-module math.
        const side = Math.ceil(220 * devicePixelRatio), ox = Math.floor(canvas.width / 2 - side / 2), oy = Math.floor(canvas.height / 2 - side / 2);
        const mask = draw => {
          const layer = document.createElement('canvas'); layer.width = side; layer.height = side;
          const pen = layer.getContext('2d', {willReadFrequently: true}), t = draw.transform;
          pen.setTransform(t.a, t.b, t.c, t.d, t.e - ox, t.f - oy); pen.drawImage(draw.image, ...draw.args);
          return pen.getImageData(0, 0, side, side).data;
        };
        const housePixels = mask(home), personPixels = mask(citizen), choices = [];
        for (let y = 2; y < side - 2; y++) for (let x = 2; x < side - 2; x++) {
          const i = (y * side + x) * 4 + 3;
          if (personPixels[i] < 245) continue;
          const gap = scenario === 'visible-through-frame';
          if (gap ? housePixels[i] > 2 : housePixels[i] < 245) continue;
          if (personPixels[i - 4] < 230 || personPixels[i + 4] < 230 || personPixels[i - side * 4] < 230 || personPixels[i + side * 4] < 230) continue;
          choices.push({x, y});
        }
        if (!choices.length) throw new Error(`No actual ${scenario} overlap in the fixture`);
        const point = choices[Math.floor(choices.length / 2)];
        return {x: rect.left + (ox + point.x + .5) * rect.width / canvas.width,
          y: rect.top + (oy + point.y + .5) * rect.height / canvas.height,
          expected: scenario === 'behind-roof' ? 'house' : 'citizen', actorId: c.actorId, candidates: choices.length};
      }, {zoom, scenario});
      await page.mouse.click(target.x, target.y);
      const actual = await page.evaluate(() => G.selectedCitizenId ? {kind: 'citizen', actorId: G.selectedCitizenId}
        : G.selectedBuilding ? {kind: G.selectedBuilding.type} : {kind: null});
      const ok = actual.kind === target.expected && (target.expected !== 'citizen' || actual.actorId === target.actorId);
      report.cases.push({dpr, zoom, scenario, target, actual, ok});
      if (dpr === 2 && zoom === 2.7) await page.screenshot({path: new URL(`${scenario}.png`, out).pathname});
    }
    await page.close();
  }
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(report.errors, []);
  assert.ok(report.cases.every(c => c.ok), JSON.stringify(report.cases.filter(c => !c.ok), null, 2));
  console.log(`[visible picking] PASS ${report.browser}: ${report.cases.length} actual silhouette/depth selections`);
} catch (error) {
  console.error('Page errors:', JSON.stringify(report.errors));
  for (const page of browser.contexts().flatMap(c => c.pages())) {
    console.error('Startup state:', await page.evaluate(() => ({ready: typeof startNewGame, started: !!globalThis.G?.started,
      body: document.body.innerText.slice(0, 1600)})).catch(() => null));
  }
  throw error;
} finally {await browser.close(); await server.stop();}
