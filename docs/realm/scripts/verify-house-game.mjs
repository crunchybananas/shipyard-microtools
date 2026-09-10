#!/usr/bin/env node
// The real painter, loading failures, camera input, day/night and construction.
// Each browser context is disposable; the player's town is never loaded here.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
const server = await ensureServer(), browser = await launchGraphicsBrowser();
const out = new URL(`../tmp/graphics-world/house-game-gate${graphicsBrowserSuffix}/`, import.meta.url); await mkdir(out, {recursive: true});
const report = {browser: browser.version(), errors: [], picking: [], emptyPlots: [], failures: []};
async function start(page, ready = true) {
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.gameUrl, {waitUntil: 'domcontentloaded'}); await page.waitForFunction(() => typeof startNewGame === 'function');
  await page.locator('#kingdom-name-input').fill('Carpentered homes');
  await page.evaluate(() => {startNewGame(); setSpeed(0);});
  await page.getByRole('button', {name: 'Skip tutorial', exact: true}).click();
  await page.waitForFunction(() => G.camera.zoom === 1.3 && __realm.rasterAtlas().state === 'ready');
  if (ready) await page.waitForFunction(() => __realm.houseSprites().ready);
}
async function fixture(page) {
  return page.evaluate(async () => {
    const view = await import('./js/house-presentation.js?realm=198');
    const renderer = await import('./js/render.js?realm=198');
    const {TILE} = await import('./js/state.js?realm=198');
    G.debug.pauseRendering = true; G._followAvatar = false; G._renderAlpha = 1; G.photoMode = true;
    Object.assign(G.resources, {wood: 10000, stone: 10000, gold: 10000});
    for (let y = 32; y < 49; y++) for (let x = 32; x < 49; x++) if (!G.buildingGrid[y][x]) {G.map[y][x] = TILE.GRASS; G.fog[y][x] = true;}
    const homes = [];
    for (let variant = 0; variant < 3; variant++) {
      let found;
      for (let y = 38; y < 46 && !found; y++) for (let x = 38; x < 46 && !found; x++) {
        if (view.houseArtKey({x, y}).variant !== variant) continue;
        const placed = G.debug.dispatch({type: 'PLACE_BUILDING', building: 'house', x, y});
        if (placed.ok) found = G.buildingGrid[y][x];
      }
      if (!found) throw new Error(`No authored home site for variant ${variant}`);
      homes.push(found);
    }
    const citizen = G.citizens[0], avatar = G.avatar;
    G.citizens = []; G.avatar = null; G.animals = []; G.soldiers = []; G.walkers = []; G.caravans = []; G.enemies = [];
    G.map = G.map.map(row => row.map(() => TILE.GRASS)); G.fog = G.fog.map(row => row.map(() => true));
    G.selectedBuilding = null; G.selectedBuild = null; G.hoveredTile = null;
    const ctx = document.getElementById('game').getContext('2d');
    const install = (variant = 0, tier = 1, step = 15) => {
      const b = homes[variant]; b.level = tier; b.buildProgress = step === 15 ? 1 : (step + .5) / 15;
      G.buildings = [b]; const p = renderer.toScreen(b.x, b.y); G.camera = {x: p.x + 13, y: p.y - 25, zoom: 2.7};
      G.dayPhase = G.dayLength * .5; G.season = 'summer'; return b;
    };
    const paint = () => {
      const calls = [], original = ctx.drawImage;
      ctx.drawImage = function (image, ...args) {
        const src = image.src || '';
        const kind = src.includes('/homes/ground.png') ? 'ground' : src.includes('/homes/spill.png') ? 'spill'
          : src.includes('/homes/emission.png') ? 'emission' : /\/homes\/(detail\/|complete-|construction-)/.test(src) ? 'body'
            : image.dataset?.realmBuildingComposite || src.includes('buildings-atlas-painted') ? 'painted'
              : src.includes('/citizens/builder/') || src.includes('actors-atlas') ? 'citizen' : src.includes('/founder/') ? 'founder' : null;
        if (kind) calls.push({kind, src, args, alpha: this.globalAlpha, blend: this.globalCompositeOperation, matrix: [...this.getTransform().toFloat64Array()]});
        return original.call(this, image, ...args);
      };
      try {renderer.render();} finally {ctx.drawImage = original;}
      return calls;
    };
    window.houseProbe = {view, renderer, ctx, homes, install, paint, citizen, avatar};
    install(); return homes.map(b => ({x: b.x, y: b.y}));
  });
}
try {
  const page = await browser.newPage({viewport: {width: 1360, height: 980}, deviceScaleFactor: 2});
  await start(page); await fixture(page);
  report.layers = await page.evaluate(() => {
    const {install, paint, renderer, homes} = houseProbe, records = [], conditions = [], depths = [];
    for (let tier = 1; tier <= 4; tier++) for (let variant = 0; variant < 3; variant++) for (let step = 0; step < 16; step++) {
      const b = install(variant, tier, step), point = renderer.toScreen(b.x, b.y);
      for (const season of ['summer', 'winter']) {
        G.season = season; const calls = paint(), body = calls.find(c => c.kind === 'body');
        if (!body) throw new Error('The game did not draw its authored house');
        records.push({tier, variant, step, season, kinds: calls.map(c => c.kind),
          anchorError: Math.hypot(body.args[4] + body.args[6] * .5 - point.x, body.args[5] + body.args[7] * .78 - point.y)});
      }
    }
    const b = install(1, 4);
    const attempt = (name, phase, progress = 1, visible = true) => {
      b.buildProgress = progress; G.fog[b.y][b.x] = visible; G.dayPhase = G.dayLength * phase;
      conditions.push({name, calls: paint()});
    };
    attempt('day', .5); attempt('foundation', .87, .1); attempt('almost-complete', .87, .999);
    attempt('hidden', .87, 1, false); attempt('complete', .87);
    attempt('dusk-before', .74999); attempt('dusk-after', .75001);
    attempt('wrap-before', .99999); attempt('wrap-after', 0);
    attempt('paused-a', .87); attempt('paused-b', .87); G.gameTick += 47; attempt('later', .87);
    const x = b.x; b.x++; attempt('neighbor', .87); b.x = x;
    for (const offset of [-.7, .7]) {
      G.citizens = [houseProbe.citizen]; G.avatar = houseProbe.avatar;
      for (const actor of [G.citizens[0], G.avatar]) Object.assign(actor, {x: b.x + offset, y: b.y + offset,
        _px: b.x + offset, _py: b.y + offset, tx: b.x + offset, ty: b.y + offset, path: null, pathIdx: 0});
      G.gameTick++; depths.push({offset, order: paint().map(c => c.kind)});
    }
    G.citizens = []; G.avatar = null; paint();
    const proto = CanvasRenderingContext2D.prototype, read = proto.getImageData; let warmReadbacks = 0;
    proto.getImageData = function (...args) {warmReadbacks++; return read.apply(this, args);};
    try {for (let f = 0; f < 30; f++) renderer.render();} finally {proto.getImageData = read;}
    return {records, conditions, depths, warmReadbacks, sites: homes.map(b => ({x: b.x, y: b.y}))};
  });
  assert.equal(report.layers.records.length, 384);
  for (const r of report.layers.records) {
    assert.deepEqual(r.kinds, ['ground', 'body']); assert.ok(r.anchorError < 1e-7);
  }
  const calls = name => report.layers.conditions.find(c => c.name === name).calls;
  for (const name of ['day', 'foundation', 'almost-complete', 'hidden']) assert.ok(calls(name).every(c => !['emission', 'spill'].includes(c.kind)));
  assert.deepEqual(calls('hidden'), []);
  for (const name of ['complete', 'dusk-before', 'dusk-after', 'paused-a']) assert.deepEqual(calls(name).map(c => c.kind), ['ground', 'spill', 'body', 'emission']);
  const light = name => calls(name).find(c => c.kind === 'emission').alpha;
  assert.ok(light('complete') > .8); assert.ok(Math.abs(light('dusk-before') - light('dusk-after')) < .001);
  assert.ok(Math.abs(light('wrap-before') - light('wrap-after')) < .000001); assert.equal(light('paused-a'), light('paused-b'));
  assert.ok(Math.abs(light('later') - light('paused-b')) > .001); assert.ok(Math.abs(light('neighbor') - light('later')) > .001);
  for (const {offset, order} of report.layers.depths) for (const actor of ['citizen', 'founder']) {
    assert.ok(order.includes(actor), `${actor} was missing from the depth probe`);
    assert.ok(order.indexOf('ground') < order.indexOf(actor) && order.indexOf('spill') < order.indexOf(actor));
    assert.ok(offset < 0 ? order.indexOf(actor) < order.indexOf('body') : order.indexOf(actor) > order.indexOf('emission'));
  }
  assert.equal(report.layers.warmReadbacks, 0);

  // Additional probes below share this fully decoded production fixture.
  report.cache = await page.evaluate(async () => {
    const {view, homes} = houseProbe, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.width = 400; canvas.height = 500; ctx.scale(3, 3); const requests = [];
    for (let tier = 1; tier <= 4; tier++) for (let variant = 0; variant < 3; variant++) for (const step of [0, 5, 9, 15]) {
      requests.push({...homes[variant], level: tier, buildProgress: step === 15 ? 1 : (step + .5) / 15});
    }
    G.season = 'summer';
    for (const b of requests) {
      for (let n = 0; n < 3; n++) view.beginHouseSpritesFrame();
      const key = view.houseArtKey(b); let found = false;
      for (let retry = 0; retry < 120; retry++) {
        view.drawHouseLayer(ctx, b, {x: 55, y: 110});
        found = view.inspectHouseSprites().detail.some(d => d.key === `summer-${key.row}-${key.step}` && d.state === 'ready');
        if (found) break; await new Promise(requestAnimationFrame);
      }
      if (!found) throw new Error(`No detail for ${key.row}/${key.step}`);
    }
    for (let f = 0; f < 8; f++) {view.beginHouseSpritesFrame(); for (const b of requests) view.drawHouseLayer(ctx, b, {x: 55, y: 110}); await new Promise(requestAnimationFrame);}
    const count = () => performance.getEntriesByType('resource').filter(r => r.name.includes('/homes/detail/')).length;
    const before = count();
    for (let f = 0; f < 15; f++) {view.beginHouseSpritesFrame(); for (const b of requests) view.drawHouseLayer(ctx, b, {x: 55, y: 110}); await new Promise(requestAnimationFrame);}
    return {...view.inspectHouseSprites(), warmAdditionalRequests: count() - before,
      sourceDownloads: performance.getEntriesByType('resource').filter(r => r.name.includes('/homes/source/')).length};
  });
  assert.ok(report.cache.detail.length <= 12); assert.ok(report.cache.decodedBytes <= 33 * 1024 * 1024);
  assert.equal(report.cache.warmAdditionalRequests, 0); assert.equal(report.cache.sourceDownloads, 0);

  // Pointer positions come from opaque pixels in the actual draw rectangle,
  // transformed back from device pixels. They do not reuse the input formula.
  for (const dpr of [1, 2]) {
    const picking = await browser.newPage({viewport: {width: 1100, height: 900}, deviceScaleFactor: dpr});
    await start(picking); await fixture(picking);
    for (const zoom of [1.3, 2.7]) for (let tier = 1; tier <= 4; tier++) for (let variant = 0; variant < 3; variant++) {
      const target = await picking.evaluate(({zoom, tier, variant}) => {
        const {install, renderer, ctx} = houseProbe, b = install(variant, tier);
        G.camera.zoom = zoom; G.selectedBuilding = null; G.selectedCitizenId = null;
        let body; const original = ctx.drawImage;
        ctx.drawImage = function (image, ...args) {
          if (/\/homes\/(detail\/|complete-)/.test(image.src || '')) body = {image, args, matrix: this.getTransform()};
          return original.call(this, image, ...args);
        };
        try {renderer.render();} finally {ctx.drawImage = original;}
        if (!body) throw new Error('Missing house input source');
        const [sx, sy, sw, sh, dx, dy, dw, dh] = body.args;
        const canvas = document.createElement('canvas'); canvas.width = sw; canvas.height = sh;
        const pen = canvas.getContext('2d', {willReadFrequently: true}); pen.drawImage(body.image, sx, sy, sw, sh, 0, 0, sw, sh);
        const pixels = pen.getImageData(0, 0, sw, sh).data, choices = [];
        for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) if (pixels[(y * sw + x) * 4 + 3] > 245 &&
          pixels[(y * sw + x - 1) * 4 + 3] > 245 && pixels[(y * sw + x + 1) * 4 + 3] > 245) choices.push({x, y});
        const top = Math.min(...choices.map(c => c.y));
        const rows = choices.filter(c => c.y >= top + sh * .018 && c.y < top + sh * .06);
        const point = rows[Math.floor(rows.length / 2)]; if (!point) throw new Error('No opaque roof target');
        const world = {x: dx + dw * (point.x + .5) / sw, y: dy + dh * (point.y + .5) / sh};
        const screen = body.matrix.transformPoint(world), rect = document.getElementById('game').getBoundingClientRect();
        return {x: screen.x / devicePixelRatio + rect.left, y: screen.y / devicePixelRatio + rect.top,
          tileX: b.x, tileY: b.y, roofHeight: renderer.toScreen(b.x, b.y).y - world.y};
      }, {zoom, tier, variant});
      await picking.mouse.move(25, 200); await picking.mouse.move(target.x, target.y);
      assert.deepEqual(await picking.evaluate(() => G.hoveredTile), {x: target.tileX, y: target.tileY}, 'Roof hover identified the terrain behind the house');
      const tooltip = await picking.evaluate(() => {
        const {ctx, renderer} = houseProbe, labels = [], original = ctx.fillText;
        G.photoMode = false;
        ctx.fillText = function (text, ...args) {labels.push(text); return original.call(this, text, ...args);};
        try {renderer.render();} finally {ctx.fillText = original; G.photoMode = true;}
        return labels;
      });
      assert.ok(tooltip.includes('House') && tooltip.includes('Click to inspect'), 'Roof tooltip does not identify the building');
      assert.ok(!tooltip.includes('Most buildings go here') && !tooltip.includes('Impassable terrain'));
      await picking.mouse.click(target.x, target.y);
      const selected = await picking.evaluate(() => G.selectedBuilding ? {x: G.selectedBuilding.x, y: G.selectedBuilding.y} : null);
      assert.deepEqual(selected, {x: target.tileX, y: target.tileY}, `Roof click missed at DPR ${dpr}, tier ${tier}, variant ${variant}, zoom ${zoom}`);
      if (tier >= 3) assert.ok(target.roofHeight > 56, 'Tall-roof regression must exceed the old hit box');
      report.picking.push({dpr, zoom, tier, variant, ...target});
    }
    for (const zoom of [1.3, 2.7]) {
      const target = await picking.evaluate(zoom => {
        const {install, paint} = houseProbe, b = install(0, 1, 0); G.camera.zoom = zoom;
        const body = paint().find(c => c.kind === 'body'), a = body.args;
        const x = a[4] + a[6] * .5, y = a[5] + a[7] * .78, t = body.matrix;
        const rect = document.getElementById('game').getBoundingClientRect();
        G.selectedBuilding = null; G.selectedCitizenId = null;
        // toFloat64Array is a 4 by 4 DOMMatrix, not the six-value Canvas form.
        return {x: (t[0] * x + t[4] * y + t[12]) / devicePixelRatio + rect.left,
          y: (t[1] * x + t[5] * y + t[13]) / devicePixelRatio + rect.top, tileX: b.x, tileY: b.y};
      }, zoom);
      await picking.mouse.click(target.x, target.y);
      assert.deepEqual(await picking.evaluate(() => G.selectedBuilding ? {x: G.selectedBuilding.x, y: G.selectedBuilding.y} : null),
        {x: target.tileX, y: target.tileY}, 'The empty construction plot cannot be selected');
      assert.ok(await picking.locator('#info-panel').textContent().then(t => t.includes('Setting out')));
      report.emptyPlots.push({dpr, zoom, ...target});
    }
    await picking.close();
  }

  report.smoke = await page.evaluate(async () => {
    const {updateSmokeEmitters} = await import('./js/particles.js?realm=198');
    const {install, view} = houseProbe, records = [];
    G.gameTick = 24; G.dayPhase = G.dayLength * .5; G.season = 'summer';
    for (let tier = 1; tier <= 4; tier++) for (let variant = 0; variant < 3; variant++) {
      const b = install(variant, tier), mouth = view.houseChimney(b); G.particles = [];
      updateSmokeEmitters(); const p = G.particles.find(p => p.type === 'smoke');
      records.push({tier, variant, mouth, emitted: !!p, xError: p ? Math.abs(p.offsetX - mouth.x) : null,
        yError: p ? Math.abs(p.offsetY - mouth.y) : null});
      b.buildProgress = .99; G.particles = []; updateSmokeEmitters();
      if (G.particles.some(p => p.type === 'smoke')) throw new Error('An unfinished home emits chimney smoke');
      b.buildProgress = 1; G.fog[b.y][b.x] = false; G.particles = []; updateSmokeEmitters();
      if (G.particles.some(p => p.type === 'smoke')) throw new Error('A hidden home emits chimney smoke');
      G.fog[b.y][b.x] = true;
    }
    return records;
  });
  assert.ok(report.smoke.every(s => s.emitted && s.xError < 1e-8 && s.yError <= 1));

  // Fail each required map or the geometric anchors. The complete old house
  // family remains visible until every part of the new family is available.
  const required = ['complete-summer.png', 'complete-winter.png', 'construction-summer.png', 'construction-winter.png',
    'ground.png', 'emission.png', 'spill.png', 'anchors.json'];
  for (const file of required) {
    const failed = await browser.newPage({viewport: {width: 1000, height: 820}});
    await failed.route(`**/homes/${file}`, route => route.abort()); await start(failed, false); await fixture(failed);
    const result = await failed.evaluate(() => ({ready: houseProbe.view.houseFamilyReady(), kinds: houseProbe.paint().map(c => c.kind)}));
    assert.equal(result.ready, false); assert.ok(result.kinds.includes('painted'));
    assert.ok(!result.kinds.some(k => ['body', 'ground', 'emission', 'spill'].includes(k)));
    report.failures.push({file, ...result}); await failed.close();
  }
  const delayed = await browser.newPage({viewport: {width: 1000, height: 820}}); let release;
  await delayed.route('**/homes/complete-winter.png', route => new Promise(resolve => {release = async () => {await route.continue(); resolve();};}));
  await start(delayed, false); await fixture(delayed);
  report.delayedBefore = await delayed.evaluate(() => ({ready: houseProbe.view.houseFamilyReady(), kinds: houseProbe.paint().map(c => c.kind)}));
  assert.equal(report.delayedBefore.ready, false); assert.ok(report.delayedBefore.kinds.includes('painted'));
  assert.ok(release); await release(); await delayed.waitForFunction(() => __realm.houseSprites().ready);
  report.delayedAfter = await delayed.evaluate(() => ({ready: houseProbe.view.houseFamilyReady(), kinds: houseProbe.paint().map(c => c.kind)}));
  assert.equal(report.delayedAfter.ready, true); assert.deepEqual(report.delayedAfter.kinds, ['ground', 'body']); await delayed.close();

  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(report.errors, []);
  console.log(`[house game] PASS ${report.browser}: 384 bodies, 48 roof clicks/hovers, four empty-plot clicks, eight atomic fallbacks, aligned lighting/smoke, painter depth and bounded cache`);
} finally {await browser.close(); await server.stop();}
