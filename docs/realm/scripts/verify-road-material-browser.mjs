#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {ensureServer} from './_serve.mjs';

const output = new URL(`../tmp/graphics-world/road-material-gate${graphicsBrowserSuffix}/`, import.meta.url);
await mkdir(output, {recursive: true});
const server = await ensureServer();
const browser = await launchGraphicsBrowser();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.gameUrl);
  await page.waitForFunction(() => typeof startNewGame === 'function');
  await page.evaluate(() => { startNewGame(); setSpeed(0); G.debug.pauseRendering = true; });
  const result = await page.evaluate(async () => {
    const {drawLandscape, landscapeDiagnostics} = await import('./js/landscape.js?realm=198');
    const {MAP_W, MAP_H, TW, TH, TILE} = await import('./js/state.js?realm=198');
    G.map = Array.from({length: MAP_H}, () => Array(MAP_W).fill(TILE.GRASS));
    G.fog = G.map.map(row => row.map(() => true));
    G.tileWear = G.map.map(row => row.map(() => 0));
    G.season = 'spring'; G.gameTick = 100;
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    const ctx = canvas.getContext('2d', {willReadFrequently: true}), zoom = 3;
    const sheet = document.createElement('canvas'); sheet.width = 1280; sheet.height = 720;
    const sheetCtx = sheet.getContext('2d'); sheetCtx.fillStyle = '#182321'; sheetCtx.fillRect(0, 0, 1280, 720);
    const reset = () => { G.buildingGrid = G.map.map(row => row.map(() => null)); };
    const road = (x, y, progress = 1) => {
      G.buildingGrid[y][x] = {type: 'road', x, y, buildProgress: progress};
    };
    const frame = (pan = 0, cx = 40, cy = 40) => {
      ctx.setTransform(zoom, 0, 0, zoom,
        canvas.width / 2 - (cx - cy) * TW / 2 * zoom - pan,
        canvas.height / 2 - (cx + cy) * TH / 2 * zoom);
      if (!drawLandscape(ctx, {width: canvas.width, height: canvas.height, daylight: 1})) {
        throw new Error(JSON.stringify(landscapeDiagnostics()));
      }
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const difference = (a, b) => {
      let sum = 0;
      for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) sum += Math.abs(a[i + c] - b[i + c]);
      return sum / (a.length * .75);
    };
    const sampleChange = (a, b, x, y, radius = 1) => {
      const sx = Math.floor(canvas.width / 2 + (x - y) * TW / 2 * zoom);
      const sy = Math.floor(canvas.height / 2 + (x + y) * TH / 2 * zoom);
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const offset = ((sy + dy) * canvas.width + sx + dx) * 4;
        for (let c = 0; c < 3; c++) { sum += Math.abs(a[offset + c] - b[offset + c]); count++; }
      }
      return sum / count;
    };
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const fixtures = [
      ['Isolated', []], ['East / west', [0, 1]], ['North / south', [2, 3]],
      ['Crossroads', [0, 1, 2, 3]],
      ['Bend NW', [0, 2]], ['Bend NE', [1, 2]], ['Bend SW', [0, 3]], ['Bend SE', [1, 3]],
      ...directions.map((_, omit) => [`T junction ${omit + 1}`, [0, 1, 2, 3].filter(n => n !== omit)]),
    ];
    reset(); const grass = frame(), geometry = [];
    for (let index = 0; index < fixtures.length; index++) {
      const [name, ids] = fixtures[index], arms = ids.map(id => directions[id]);
      reset(); road(40, 40);
      for (const [x, y] of arms) for (const distance of [1, 2]) road(40 + x * distance, 40 + y * distance);
      const pixels = frame(), centerline = [], lanes = [];
      for (const [x, y] of arms) {
        // Both sides of each tile boundary must contain the same connected road.
        for (const distance of [.48, .50, .52, .75, 1, 1.5]) centerline.push([x * distance, y * distance]);
        for (const side of [-.21, .21]) lanes.push([x * .75 - y * side, y * .75 + x * side]);
      }
      const bend = arms.length === 2 && arms[0][0] * arms[1][0] + arms[0][1] * arms[1][1] === 0;
      if (bend) {
        const [a, b] = arms, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        const start = Math.atan2(a[1] / 2 - cy, a[0] / 2 - cx);
        const end = Math.atan2(b[1] / 2 - cy, b[0] / 2 - cx);
        const sweep = Math.atan2(Math.sin(end - start), Math.cos(end - start));
        for (let n = 0; n <= 8; n++) {
          const angle = start + sweep * n / 8;
          centerline.push([cx + Math.cos(angle) * .5, cy + Math.sin(angle) * .5]);
          for (const radius of [.29, .71]) lanes.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
        }
      } else centerline.push([0, 0]);
      const outside = [[-.495, -.495], [.495, -.495], [-.495, .495], [.495, .495]];
      geometry.push({name,
        centerlineSamples: centerline.length, laneSamples: lanes.length,
        minimumCenterlineChange: Math.min(...centerline.map(([x, y]) => sampleChange(pixels, grass, x, y))),
        minimumLaneChange: lanes.length ? Math.min(...lanes.map(([x, y]) => sampleChange(pixels, grass, x, y))) : null,
        outsideVergeChange: Math.max(...outside.map(([x, y]) => sampleChange(pixels, grass, x, y, 0))),
        roads: landscapeDiagnostics().knownRoadTiles,
      });
      const sx = (index % 4) * 320, sy = Math.floor(index / 4) * 240;
      sheetCtx.drawImage(canvas, 352, 274, 320, 214, sx, sy + 26, 320, 214);
      sheetCtx.fillStyle = '#e1d8b7'; sheetCtx.font = '14px sans-serif'; sheetCtx.fillText(name, sx + 12, sy + 19);
    }

    reset(); for (let x = 36; x <= 44; x++) road(x, 40);
    const first = frame(), initial = landscapeDiagnostics();
    const repeat = frame(), paused = landscapeDiagnostics();
    G.gameTick += 90; const advanced = frame(), dry = landscapeDiagnostics();
    const shifted = frame(32); let panError = 0, samples = 0;
    for (let y = 60; y < 708; y++) for (let x = 60; x < 920; x++) for (let c = 0; c < 3; c++) {
      panError += Math.abs(shifted[(y * 1024 + x) * 4 + c] - first[(y * 1024 + x + 32) * 4 + c]); samples++;
    }
    let repeatedTileDifference = 0, repeatedSamples = 0;
    for (let x = -.2; x <= .2; x += .02) for (let y = -.12; y <= .12; y += .02) {
      const px = Math.floor(512 + (x - y) * TW / 2 * zoom), py = Math.floor(384 + (x + y) * TH / 2 * zoom);
      for (let c = 0; c < 3; c++) {
        repeatedTileDifference += Math.abs(first[(py * 1024 + px) * 4 + c] - first[((py + TH / 2 * zoom) * 1024 + px + TW / 2 * zoom) * 4 + c]);
        repeatedSamples++;
      }
    }
    const phases = [];
    for (const progress of [0, .5, 1]) {
      for (let x = 36; x <= 44; x++) G.buildingGrid[40][x].buildProgress = progress;
      phases.push(frame());
    }
    const construction = {
      earthToHalf: difference(phases[0], phases[1]), halfToFinished: difference(phases[1], phases[2]),
      centerlineChanges: phases.map(pixels => sampleChange(pixels, grass, 0, 0)),
    };
    G.season = 'winter'; const winterRoad = frame();
    reset(); const winterGrass = frame();
    const winter = {minimumTravelLaneChange: Math.min(...[-.21, 0, .21].map(y => sampleChange(winterRoad, winterGrass, 0, y)))};
    G.season = 'spring';
    reset(); const removed = frame(), removal = landscapeDiagnostics();
    road(40, 40); frame(); const placement = landscapeDiagnostics();
    // A hidden extension must not change even the discovered end of a road.
    G.fog[40][41] = false; const hiddenEmpty = frame();
    road(41, 40); const hiddenRoad = frame();
    G.buildingGrid[40][41] = {type: 'house', x: 41, y: 40, buildProgress: 1};
    const hiddenHouse = frame();
    G.fog[40][41] = true; reset();

    G.map[5][5] = TILE.WATER;
    frame(); const distantWater = landscapeDiagnostics();
    G.gameTick += 90; frame(); const distantWaterAdvanced = landscapeDiagnostics();
    const shoreA = frame(0, 5, 5), shoreStart = landscapeDiagnostics();
    G.gameTick += 90; const shoreB = frame(0, 5, 5), shoreEnd = landscapeDiagnostics();
    G.map[5][5] = TILE.GRASS; G.map[40][40] = TILE.WATER;
    // The water center is outside the viewport, but its shore still overlaps it.
    const edgeA = frame(-544), edgeStart = landscapeDiagnostics();
    G.gameTick += 90; const edgeB = frame(-544), edgeEnd = landscapeDiagnostics();
    G.fog[40][40] = false; frame(); const hiddenWater = landscapeDiagnostics();
    return {geometry, sheet: sheet.toDataURL('image/png'), initial, paused, dry, removal, placement,
      repeatDifference: difference(first, repeat), dryAdvanceDifference: difference(first, advanced), panError: panError / samples,
      repeatedTileDifference: repeatedTileDifference / repeatedSamples,
      construction, winter, removalDifference: difference(removed, grass),
      hiddenRoadDifference: difference(hiddenEmpty, hiddenRoad), hiddenHouseDifference: difference(hiddenEmpty, hiddenHouse),
      distantWater, distantWaterAdvanced, shoreStart, shoreEnd, shoreAnimation: difference(shoreA, shoreB),
      edgeStart, edgeEnd, edgeAnimation: difference(edgeA, edgeB), hiddenWater};
  });
  await writeFile(new URL('junctions.png', output), Buffer.from(result.sheet.split(',')[1], 'base64'));
  delete result.sheet;
  await writeFile(new URL('report.json', output), JSON.stringify({browser: browser.version(), errors, ...result}, null, 2) + '\n');
  assert.deepEqual(errors, []);
  for (const shape of result.geometry) {
    assert.ok(shape.minimumCenterlineChange > 4, `${shape.name} has a gap in its road: ${JSON.stringify(shape)}`);
    if (shape.minimumLaneChange !== null) assert.ok(shape.minimumLaneChange > 4, `${shape.name} loses its usable width: ${JSON.stringify(shape)}`);
    assert.ok(shape.outsideVergeChange < 1, `${shape.name} paints the entire diamond: ${JSON.stringify(shape)}`);
  }
  assert.equal(result.repeatDifference, 0); assert.equal(result.dryAdvanceDifference, 0);
  assert.equal(result.paused.draws, result.initial.draws);
  assert.equal(result.dry.draws, result.initial.draws, 'dry roads must reuse the GPU surface while the clock advances');
  assert.equal(result.dry.uploads, result.initial.uploads);
  assert.ok(result.panError < .1, `panning moves the material within the road: ${result.panError}`);
  assert.ok(result.repeatedTileDifference > 1, 'adjacent road tiles must not repeat the same material');
  assert.ok(result.construction.earthToHalf > .05 && result.construction.halfToFinished > .05, 'actual construction progress must change the surface');
  assert.ok(result.construction.centerlineChanges.every(change => change > 4), 'the road must remain legible throughout construction');
  assert.ok(result.winter.minimumTravelLaneChange > 4, 'winter snow must preserve a readable travel surface');
  assert.equal(result.removalDifference, 0, 'removing roads must restore the original ground');
  assert.ok(result.placement.uploads > result.removal.uploads && result.placement.draws > result.removal.draws, 'paused placement must refresh both the map and the rendered frame');
  assert.equal(result.hiddenRoadDifference, 0, 'hidden roads must not influence revealed road junctions');
  assert.equal(result.hiddenHouseDifference, 0, 'hidden buildings must not disclose their foundations');
  assert.equal(result.distantWater.animatedWater, false);
  assert.equal(result.distantWaterAdvanced.draws, result.distantWater.draws, 'distant offscreen water must not disable surface reuse');
  assert.equal(result.shoreStart.animatedWater, true); assert.ok(result.shoreEnd.draws > result.shoreStart.draws);
  assert.ok(result.shoreAnimation > .005, 'panning onto water must resume its actual pixel animation');
  assert.equal(result.edgeStart.animatedWater, true); assert.ok(result.edgeEnd.draws > result.edgeStart.draws);
  assert.ok(result.edgeAnimation > 0, 'a shore extending into the viewport must still animate');
  assert.equal(result.hiddenWater.animatedWater, false, 'unknown water must not affect the redraw schedule');
  assert.equal(result.initial.mapBytes, 25600); assert.equal(result.initial.knownRoadTiles, 9);
  console.log(`[road material] PASS: ${result.geometry.length} connected junctions, usable width and soft verges; construction, fog, stable world coordinates, nonrepeating gravel, paused edits and water-aware frame reuse`);
} finally { await browser.close(); await server.stop(); }
