#!/usr/bin/env node
// Real source pixels, source ownership and production building draws. No PNG
// asset is rewritten; this checks the renderer's reviewed regions/materials.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {ensureServer} from './_serve.mjs';
const output = new URL(`../tmp/graphics-world/building-surfaces-gate${graphicsBrowserSuffix}/`, import.meta.url);
await mkdir(output, {recursive: true});
const server = await ensureServer(), browser = await launchGraphicsBrowser();
try {
  const page = await browser.newPage({viewport: {width: 1360, height: 1000}, deviceScaleFactor: 2});
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.gameUrl); await page.waitForFunction(() => typeof startNewGame === 'function');
  await page.evaluate(() => {startNewGame(); setSpeed(0);});
  await page.getByRole('button', {name: 'Skip tutorial', exact: true}).click();
  await page.waitForFunction(() => G.camera.zoom === 1.3 && __realm.rasterAtlas().state === 'ready' && __realm.supportAtlas().state === 'ready');
  const result = await page.evaluate(async () => {
    const surfaces = await import('./js/building-surfaces.js?realm=198');
    const {render, renderBuildingIsolated} = await import('./js/render.js?realm=198');
    const {BUILDINGS, TILE} = await import('./js/state.js?realm=198');
    G.debug.pauseRendering = true; G._followAvatar = false; G._renderAlpha = 1;
    G.avatar = null; G.citizens = []; G.animals = []; G.enemies = []; G.walkers = []; G.soldiers = []; G.caravans = [];
    G.selectedBuilding = null; G.selectedBuild = null; G.hoveredTile = null;
    G.map = G.map.map(row => row.map(() => TILE.GRASS)); G.fog = G.map.map(row => row.map(() => true));
    G.buildingGrid = G.map.map(row => row.map(() => null));
    G.camera = {x: 0, y: 1280, zoom: 2.8}; G.dayPhase = G.dayLength * .5;
    // The saved house family has its own 192-stage source and runtime gate.
    // This gate continues to own every painted source and its fallback atlas.
    const types = Object.keys(BUILDINGS).filter(type => type !== 'road' && type !== 'house');
    const sources = new Map(), winter = new Map(), composites = new Map(), draws = [];
    const proto = CanvasRenderingContext2D.prototype, original = proto.drawImage;
    let current = null;
    proto.drawImage = function (image, ...args) {
      const source = image.src || '', kind = source.includes('buildings-atlas-painted') ? 'buildings' : source.includes('support-atlas') ? 'support' : null;
      if (kind) sources.set(kind, image);
      if (image.dataset?.realmBuildingWeather) winter.set(image.dataset.realmBuildingWeather, image);
      if (this.canvas.id === 'game' && current) {
        if (kind || image.dataset?.realmBuildingWeather) draws.push({...current, sourceKind: kind || image.dataset.realmBuildingWeather, rect: args.slice(0, 4), destination: args.slice(4)});
        if (image.dataset?.realmBuildingComposite) {
          const key = `${current.type}/${current.level}/${current.season}`;
          if (!composites.has(key)) composites.set(key, new Set()); composites.get(key).add(image);
        }
      }
      return original.call(this, image, ...args);
    };
    try {
      for (const type of types) for (const level of type === 'house' ? [1, 2, 3, 4] : [1]) {
        const b = {type, level, x: 40, y: 40, buildProgress: 1, hp: 100, maxHp: 100, productionTimer: 0, lastProduced: 0};
        G.buildings = [b]; G.buildingGrid[40][40] = b;
        for (const season of ['spring', 'winter']) for (const zoom of [1.3, 2.8, 1.3]) {
          G.season = season; G.camera.zoom = zoom; current = {type, level, season, zoom}; render();
        }
      }
    } finally {proto.drawImage = original; current = null;}
    const pixelsOf = image => {
      const c = document.createElement('canvas'); c.width = image.naturalWidth || image.width; c.height = image.naturalHeight || image.height;
      const ctx = c.getContext('2d', {willReadFrequently: true}); ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const sourcePixels = Object.fromEntries([...sources].map(([kind, image]) => [kind, pixelsOf(image)]));
    const winterPixels = Object.fromEntries([...winter].map(([kind, image]) => [kind, pixelsOf(image)]));
    const atlas = {};
    for (const kind of ['buildings', 'support']) {
      const a = sourcePixels[kind], b = winterPixels[kind]; let alphaChanges = 0, transparentChanges = 0, changedOpaquePixels = 0;
      if (!a || !b) throw new Error(`Production did not draw both ${kind} materials`);
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] !== b[i + 3]) alphaChanges++;
        const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        if (a[i + 3] === 0 && delta) transparentChanges++;
        if (a[i + 3] > 8 && delta > 9) changedOpaquePixels++;
      }
      atlas[kind] = {alphaChanges, transparentChanges, changedOpaquePixels};
    }
    // Recover source components independently of the runtime region table.
    function componentsOf(p) {
    const ids = new Int16Array(512 * 512).fill(-1), components = [];
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] >= 0 || p[i * 4 + 3] < 8) continue;
      const id = components.length, pixels = [i]; ids[i] = id;
      for (let cursor = 0; cursor < pixels.length; cursor++) {
        const index = pixels[cursor], x = index % 512, y = Math.floor(index / 512);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * 512 + nx;
          if (nx < 0 || ny < 0 || nx >= 512 || ny >= 512 || ids[next] >= 0 || p[next * 4 + 3] < 8) continue;
          ids[next] = id; pixels.push(next);
        }
      }
      components.push(pixels);
    }
    return components;
    }
    const p = sourcePixels.support, components = componentsOf(p);
    const inside = (index, r) => index % 512 >= r.x && index % 512 < r.x + r.w && Math.floor(index / 512) >= r.y && Math.floor(index / 512) < r.y + r.h;
    const mainComponents = componentsOf(sourcePixels.buildings);
    const productionSources = draws.filter(draw => draw.season === 'spring').map(draw => {
      const [x, y, w, h] = draw.rect, rect = {x, y, w, h};
      const parts = draw.sourceKind === 'buildings' ? mainComponents : components;
      const counts = parts.map(pixels => pixels.reduce((sum, index) => sum + Number(inside(index, rect)), 0));
      const owner = counts.indexOf(Math.max(...counts));
      return {type: draw.type, level: draw.level, clipped: parts[owner].length - counts[owner],
        foreign: counts.reduce((sum, count, id) => sum + (id !== owner && parts[id].length >= 80 ? count : 0), 0)};
    });
    const old = {school: {x: 262, y: 130, w: 114, h: 126}, chickencoop: {x: 259, y: 256, w: 125, h: 128}, cowpen: {x: 384, y: 256, w: 123, h: 128}};
    const regions = Object.entries(surfaces.SUPPORT_ART_REGIONS).map(([type, rect]) => {
      const counts = components.map(pixels => pixels.reduce((count, pixel) => count + Number(inside(pixel, rect)), 0));
      const owner = counts.indexOf(Math.max(...counts)), own = components[owner];
      const clipped = own.length - counts[owner];
      const foreign = counts.reduce((sum, count, id) => sum + (id !== owner && components[id].length >= 80 ? count : 0), 0);
      const detachedDetailPixels = counts.reduce((sum, count, id) => sum + (id !== owner && components[id].length < 80 ? count : 0), 0);
      const oldClipped = old[type] ? own.filter(pixel => !inside(pixel, old[type])).length : null;
      const oldForeign = old[type] ? components.reduce((sum, pixels, id) => sum + (id === owner ? 0 : pixels.filter(pixel => inside(pixel, old[type])).length), 0) : null;
      let edgePixels = 0;
      for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
        if ((x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1) && p[(y * 512 + x) * 4 + 3] >= 8) edgePixels++;
      }
      return {type, rect, componentPixels: own.length, clipped, foreign, detachedDetailPixels, edgePixels, oldClipped, oldForeign};
    });
    const changedAt = (kind, x, y) => {
      const a = sourcePixels[kind], b = winterPixels[kind], i = (y * 512 + x) * 4;
      return (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    };
    // Semantic landmarks chosen from the source reference, not from mask data.
    const protectedPixels = [
      ['house chimney', 'buildings', 128 + 77, 128 + 25], ['house dormer window', 'buildings', 128 + 70, 128 + 58],
      ['house gable window', 'buildings', 128 + 30, 128 + 54], ['castle banner', 'buildings', 128 + 54, 47],
      ['church window', 'buildings', 256 + 59, 89], ['windmill sail', 'buildings', 384 + 60, 33],
      ['mine entrance', 'support', 384 + 55, 80], ['cow', 'support', 384 + 50, 256 + 47],
    ].map(([name, kind, x, y]) => ({name, change: changedAt(kind, x, y)}));
    const roofs = [
      ['house', 'buildings', 128 + 50, 128 + 52], ['granary', 'buildings', 69, 37],
      ['tavern', 'buildings', 256 + 64, 128 + 42], ['well', 'buildings', 55, 384 + 33],
      ['church', 'buildings', 256 + 62, 57], ['tower', 'buildings', 52, 128 + 20],
      ['bakery', 'buildings', 128 + 59, 256 + 36], ['lumber', 'support', 128 + 74, 42],
      ['chickencoop', 'support', 256 + 59, 256 + 16], ['cowpen', 'support', 384 + 88, 256 + 20],
    ].map(([name, kind, x, y]) => ({name, change: changedAt(kind, x, y)}));

    const sheet = document.createElement('canvas'); sheet.width = 1120; sheet.height = Math.ceil(types.length / 4) * 220;
    const sctx = sheet.getContext('2d'); sctx.fillStyle = '#343e38'; sctx.fillRect(0, 0, sheet.width, sheet.height);
    const silhouettes = [];
    for (let index = 0; index < types.length; index++) {
      const type = types[index], options = {width: 120, height: 145, bgColor: 'rgba(0,0,0,0)', applyTint: false};
      const bare = renderBuildingIsolated(type, {...options, season: 'spring'}), snow = renderBuildingIsolated(type, {...options, season: 'winter'});
      const a = pixelsOf(bare), b = pixelsOf(snow); let alphaChanges = 0, maximumAlphaDifference = 0;
      for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) {
        alphaChanges++; maximumAlphaDifference = Math.max(maximumAlphaDifference, Math.abs(a[i] - b[i]));
      }
      silhouettes.push({type, alphaChanges, maximumAlphaDifference});
      const x = index % 4 * 280, y = Math.floor(index / 4) * 220;
      sctx.drawImage(snow, 0, 0, 120, 145, x + 38, y, 204, 246.5);
      sctx.fillStyle = '#e7dfc9'; sctx.font = '13px sans-serif'; sctx.fillText(type, x + 12, y + 211);
    }
    let warmReadbacks = 0; const read = proto.getImageData;
    proto.getImageData = function (...args) {warmReadbacks++; return read.apply(this, args);};
    try {for (let i = 0; i < 30; i++) render();} finally {proto.getImageData = read;}
    return {regions, productionSources, atlas, protectedPixels, roofs, silhouettes, draws, warmReadbacks,
      composites: [...composites].map(([key, images]) => ({key, copies: images.size})),
      diagnostics: surfaces.buildingSurfaceDiagnostics(), sheet: sheet.toDataURL('image/png'),
      runtimeRegions: __realm.supportAtlas().frames};
  });
  await writeFile(new URL('winter-buildings.png', output), Buffer.from(result.sheet.split(',')[1], 'base64')); delete result.sheet;
  await writeFile(new URL('report.json', output), JSON.stringify({browser: browser.version(), errors, ...result}, null, 2) + '\n');
  assert.deepEqual(errors, []);
  for (const region of result.regions) {
    assert.ok(region.componentPixels > 4000, `${region.type} must retain its complete painted asset`);
    assert.equal(region.clipped, 0, `${region.type} clips source pixels`);
    assert.equal(region.foreign, 0, `${region.type} includes another sprite`);
    assert.ok(region.detachedDetailPixels <= 5, `${region.type} has unexplained detached source pieces`);
    assert.equal(region.edgePixels, 0, `${region.type} needs transparent padding`);
    assert.deepEqual(result.runtimeRegions[region.type], region.rect);
  }
  const repairs = result.regions.filter(region => region.oldClipped || region.oldForeign);
  assert.equal(repairs.length, 3, 'the known school, coop and pen source faults must be reproduced and repaired');
  for (const source of result.productionSources) {
    assert.equal(source.clipped, 0, `${source.type}/${source.level} production crop clips source pixels`);
    assert.equal(source.foreign, 0, `${source.type}/${source.level} production crop contains another source sprite`);
  }
  for (const [name, atlas] of Object.entries(result.atlas)) {
    assert.equal(atlas.alphaChanges, 0, `${name} winter material changes the silhouette`);
    assert.equal(atlas.transparentChanges, 0, `${name} winter material paints outside the source`);
    assert.ok(atlas.changedOpaquePixels > 10000, `${name} winter surface must visibly affect its authored roofs and ground`);
  }
  for (const point of result.protectedPixels) assert.equal(point.change, 0, `${point.name} must remain uncovered`);
  for (const point of result.roofs) assert.ok(point.change > 8, `${point.name} roof must receive visible snow: ${point.change}`);
  // WebKit's image/canvas resampling can round an edge by one alpha unit;
  // an unchanged source-image round trip reproduces this without any snow.
  // The atlas alpha above is still exact. Reject any larger rendered change.
  for (const shape of result.silhouettes) assert.ok(shape.maximumAlphaDifference <= 1, `${shape.type} winter overlay changes its actual body: ${shape.maximumAlphaDifference} alpha levels`);
  for (const composite of result.composites) assert.equal(composite.copies, 1, `${composite.key} duplicates its cached body`);
  const grouped = Map.groupBy(result.draws, draw => `${draw.type}/${draw.level}`);
  for (const [key, draws] of grouped) {
    const bare = draws.find(draw => draw.season === 'spring'), snow = draws.find(draw => draw.season === 'winter');
    assert.ok(bare && snow, `${key} missing a production material`);
    assert.deepEqual(bare.rect, snow.rect, `${key} changes source registration in winter`);
    assert.deepEqual(bare.destination, snow.destination, `${key} changes size or anchor in winter`);
  }
  assert.equal(result.warmReadbacks, 0); assert.equal(result.diagnostics.bakes, 2);
  assert.equal(result.diagnostics.sourceReadbacks, 2); assert.equal(result.diagnostics.retainedBytes, 2 * 512 * 512 * 4);
  console.log(`[building surfaces] PASS: 16 complete source regions; ${result.silhouettes.length} stable winter silhouettes; ${grouped.size} live type/tier pairs; protected windows and chimneys; two cached material atlases and zero warm readbacks`);
} finally {await browser.close(); await server.stop();}
