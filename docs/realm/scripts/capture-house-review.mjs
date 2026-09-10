#!/usr/bin/env node
// Real construction commands and ticks, retained as visual review evidence.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
const out = new URL(`../tmp/graphics-world/house-review-213${graphicsBrowserSuffix}/`, import.meta.url); await mkdir(out, {recursive: true});
const server = await ensureServer(), browser = await launchGraphicsBrowser();
const report = {browser: browser.version(), errors: [], frames: []};
try {
  const page = await browser.newPage({viewport: {width: 1360, height: 960}, deviceScaleFactor: 2});
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.gameUrl); await page.waitForFunction(() => typeof startNewGame === 'function');
  await page.locator('#kingdom-name-input').fill('The carpenter’s row');
  await page.evaluate(() => {startNewGame(); setSpeed(0);});
  await page.getByRole('button', {name: 'Skip tutorial', exact: true}).click();
  await page.waitForFunction(() => G.camera.zoom === 1.3 && __realm.houseSprites().ready && __realm.builderSprites().small.length === 4 && __realm.builderSprites().small.every(a => a.state === 'ready'));
  await page.evaluate(async () => {
    const {TILE} = await import('./js/state.js?realm=198');
    const renderer = await import('./js/render.js?realm=198');
    const view = await import('./js/house-presentation.js?realm=198');
    const ui = await import('./js/ui.js?realm=198');
    const particles = await import('./js/particles.js?realm=198');
    const cache = await import('./js/citizen-render-cache.js?realm=198');
    const save = await import('./js/save-state.js?realm=198');
    G.debug.pauseRendering = true; G.debug.disableEvents = true; G._followAvatar = false; G._renderAlpha = 1;
    Object.assign(G.resources, {wood: 1000, stone: 1000, gold: 1000});
    for (let y = 39; y < 48; y++) for (let x = 41; x < 49; x++) if (!G.buildingGrid[y][x]) {G.map[y][x] = TILE.GRASS; G.fog[y][x] = true;}
    const sites = [];
    for (let y = 41; y < 47; y++) for (let x = 42; x < 48; x++) sites.push([x,y]);
    sites.sort((a,b) => Math.abs(a[0]-43)+Math.abs(a[1]-42)-Math.abs(b[0]-43)-Math.abs(b[1]-42));
    const bpos = sites.find(([x,y]) => !G.buildingGrid[y][x] && view.houseArtKey({x,y}).variant === 0);
    if (!bpos) throw new Error('No reed-house review site');
    const [x,y] = bpos, placed = G.debug.dispatch({type: 'PLACE_BUILDING', building: 'house', x, y});
    if (!placed.ok) throw new Error(placed.reason);
    const b = G.buildingGrid[y][x], c = G.citizens[0];
    const assigned = G.debug.dispatch({type: 'ASSIGN_CITIZEN', actorId: c.actorId, x, y});
    if (!assigned.ok) throw new Error(assigned.reason);
    const s = renderer.toScreen(x,y); G.camera = {x: s.x, y: s.y - 25, zoom: 3};
    G.photoMode = true; G.selectedBuilding = null; G.selectedBuild = null; G.hoveredTile = null;
    G.dayPhase = G.dayLength * .5;
    window.homeReview = {b,c,renderer,view,ui,particles,cache,save};
  });
  for (const stage of [0, 4, 9, 13, 15]) {
    const frame = await page.evaluate(async target => {
      const r = homeReview; let advanced = 0;
      while (r.view.houseArtKey(r.b).step < target && advanced < 2000) {G.debug.step(1); r.renderer.render(); advanced++;}
      if (r.view.houseArtKey(r.b).step < target) throw new Error(`Construction did not reach stage ${target}`);
      for (let n = 0; n < 20; n++) {r.renderer.render(); await new Promise(requestAnimationFrame);}
      return {stage: r.view.houseArtKey(r.b).step, label: r.view.houseConstructionStage(r.b), tick: G.gameTick,
        progress: r.b.buildProgress, actor: r.cache.inspectCitizenRenderCache().find(a => a.actorId === r.c.actorId)?.builder?.drawn,
        png: document.getElementById('game').toDataURL()};
    }, stage);
    await writeFile(new URL(`construction-${stage}.png`, out), Buffer.from(frame.png.split(',')[1], 'base64'));
    delete frame.png; report.frames.push(frame);
  }
  for (const season of ['summer', 'winter']) for (const period of ['day', 'night']) {
    const png = await page.evaluate(async ({season, period}) => {
      const r = homeReview; G.season = season; G.dayPhase = G.dayLength * (period === 'day' ? .5 : .87);
      G.particles = []; r.ui.updateUI();
      for (let n = 0; n < 20; n++) {r.renderer.render(); await new Promise(requestAnimationFrame);}
      return document.getElementById('game').toDataURL();
    }, {season, period});
    await writeFile(new URL(`${season}-${period}.png`, out), Buffer.from(png.split(',')[1], 'base64'));
  }
  report.saveUnchanged = await page.evaluate(() => {
    const r = homeReview, before = JSON.stringify(r.save.serializeGame());
    for (let n = 0; n < 30; n++) r.renderer.render();
    return before === JSON.stringify(r.save.serializeGame());
  });
  assert.equal(report.saveUnchanged, true); assert.equal(report.frames.at(-1).progress, 1);
  assert.ok(report.frames.some(f => f.actor?.action === 'work')); assert.deepEqual(report.errors, []);
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n');
  console.log(`[house review] PASS ${report.browser}: real construction completed at tick ${report.frames.at(-1).tick}, work poses and four seasonal/light views`);
} finally {await browser.close(); await server.stop();}
