#!/usr/bin/env node
// Render the saved source through one camera. The live game receives ordinary
// PNGs; it never downloads this GLB, initializes Three, or runs a house shader.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from '../_serve.mjs';
import {HOUSE_PROFILE, HOUSE_STEPS, HOUSE_VARIANTS, HOUSE_ANCHOR, HOUSE_CAMERA, HOUSE_CELL, HOUSE_MAPS} from './contract.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, process.argv[2] || 'tmp/house-sprites/houses-213-v2/baked');
const source = resolve(root, process.argv[3] || 'tmp/house-sprites/houses-213-v2/homes.glb');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(join(out, 'detail'), {recursive: true});
const server = await ensureServer();
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage(), errors = [], outputs = [], records = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${server.origin}/scripts/house-sprites/bake.html`); await page.waitForFunction(() => window.ready);
  await page.evaluate(async ({url, maps}) => {
    const {createHouseStudio} = await import('./studio.js');
    window.houses = await createHouseStudio({url}); window.maps = {};
    for (const [id, spec] of Object.entries(maps)) for (const season of id === 'complete' || id === 'construction' ? ['summer', 'winter'] : ['']) {
      const name = `${id}${season ? `-${season}` : ''}`, canvas = document.createElement('canvas');
      canvas.width = spec.width * spec.columns; canvas.height = spec.height * spec.rows;
      window.maps[name] = {...spec, canvas, ctx: canvas.getContext('2d', {willReadFrequently: true})};
    }
    window.scratch = document.createElement('canvas'); scratch.width = 512; scratch.height = 640;
    window.sctx = scratch.getContext('2d', {willReadFrequently: true});
    const linear = Array.from({length: 256}, (_, i) => i <= 10 ? i / 255 / 12.92 : ((i / 255 + .055) / 1.055) ** 2.4);
    window.packHouseCell = (map, column, row, source) => {
      // Integer area sampling in linear light, weighted by coverage. Canvas
      // implementations choose different filters for canvas and image inputs;
      // letting either choose lost thin pegs and grain in the small atlas.
      const scale = 512 / map.width, area = scale * scale, pixels = map.ctx.createImageData(map.width, map.height);
      const encode = v => Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055));
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        let alpha = 0, red = 0, green = 0, blue = 0;
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * 512 + x * scale + dx) * 4, a = source[i + 3];
          alpha += a; red += linear[source[i]] * a; green += linear[source[i + 1]] * a; blue += linear[source[i + 2]] * a;
        }
        const i = (y * map.width + x) * 4; pixels.data[i + 3] = Math.round(alpha / area);
        if (pixels.data[i + 3]) {pixels.data[i] = encode(red / alpha); pixels.data[i + 1] = encode(green / alpha); pixels.data[i + 2] = encode(blue / alpha);}
      }
      map.ctx.putImageData(pixels, column * map.width, row * map.height);
    };
  }, {url: `/${relative(root, source)}`, maps: HOUSE_MAPS});
  async function save(file, bytes) {
    await writeFile(join(out, file), bytes); outputs.push({file, bytes: bytes.length, sha256: hash(bytes)});
  }
  for (let tier = 1; tier <= 4; tier++) for (let variant = 0; variant < 3; variant++) {
    console.log(`[house bake] ${HOUSE_VARIANTS[variant]} tier ${tier}: 16 installed stages, summer/winter, body/shadow/window layers`);
    const result = await page.evaluate(({tier, variant}) => {
      const images = [], records = [], row = (tier - 1) * 3 + variant;
      const measure = data => {
        let left = 512, top = 640, right = -1, bottom = -1, alphaPixels = 0, edgePixels = 0;
        for (let y = 0; y < 640; y++) for (let x = 0; x < 512; x++) if (data[(y * 512 + x) * 4 + 3] > 16) {
          alphaPixels++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          if (x < 2 || x >= 510 || y < 2 || y >= 638) edgePixels++;
        }
        return {bounds: [left, top, right, bottom], alphaPixels, edgePixels};
      };
      const read = () => {sctx.clearRect(0, 0, 512, 640); sctx.drawImage(houses.renderer.domElement, 0, 0); return sctx.getImageData(0, 0, 512, 640).data;};
      let first;
      for (let step = 0; step < 16; step++) {
        houses.select(variant, tier, step); const record = {...houses.landmarks(), layers: {}};
        let bare;
        for (const season of ['summer', 'winter']) {
          houses.render('body', season); const data = read();
          if (season === 'summer') bare = data;
          else {
            let alphaChanges = 0;
            for (let i = 3; i < data.length; i += 4) if (bare[i] !== data[i]) alphaChanges++;
            record.winterAlphaChanges = alphaChanges;
          }
          record.layers[season] = measure(data);
          const map = maps[`${step === 15 ? 'complete' : 'construction'}-${season}`];
          packHouseCell(map, step === 15 ? variant : step, step === 15 ? tier - 1 : row, data);
          const png = scratch.toDataURL(); images.push({file: `detail/${season}-${row}-${step}.png`, png});
          if (step === 0 && season === 'summer') first = png;
        }
        houses.render('ground');
        sctx.clearRect(0, 0, 512, 640); sctx.filter = 'blur(2.4px)'; sctx.drawImage(houses.renderer.domElement, 0, 0); sctx.filter = 'none';
        const groundPixels = sctx.getImageData(0, 0, 512, 640).data;
        record.layers.ground = measure(groundPixels);
        packHouseCell(maps.ground, step, row, groundPixels);
        if (step === 15) {
          houses.render('emission'); const light = read(); record.layers.emission = measure(light);
          // Emission is physically depth-tested through the installed windows.
          // It cannot invent opaque pixels outside the daytime silhouette.
          let outsideBody = 0;
          for (let i = 3; i < light.length; i += 4) if (light[i] > bare[i] + 2) outsideBody++;
          record.emissionOutsideBody = outsideBody;
          packHouseCell(maps.emission, variant, tier - 1, light);
          houses.render('spill'); read();
          const spill = sctx.getImageData(0, 0, 512, 640);
          // Screen-compositing this light must have a transparent exterior.
          // Preserve the depth-tested pool's brightness and chromaticity while
          // dropping the unlit black receiver plane from the PNG.
          for (let i = 0; i < spill.data.length; i += 4) {
            const peak = Math.max(spill.data[i], spill.data[i + 1], spill.data[i + 2]);
            if (!peak) spill.data[i + 3] = 0;
            else {for (let k = 0; k < 3; k++) spill.data[i + k] = Math.round(spill.data[i + k] * 255 / peak); spill.data[i + 3] = peak;}
          }
          sctx.putImageData(spill, 0, 0); record.layers.spill = measure(spill.data);
          packHouseCell(maps.spill, variant, tier - 1, spill.data);
          if (variant === 0 && tier === 1) {
            const icon = document.createElement('canvas'); icon.width = icon.height = 128; const pen = icon.getContext('2d');
            houses.render('body'); const b = record.layers.summer.bounds, w = b[2] - b[0] + 1, h = b[3] - b[1] + 1, scale = 116 / Math.max(w, h);
            pen.drawImage(houses.renderer.domElement, b[0], b[1], w, h, (128 - w * scale) / 2, (128 - h * scale) / 2, w * scale, h * scale);
            images.push({file: 'icon.png', png: icon.toDataURL()});
          }
        }
        records.push(record);
      }
      houses.select(variant, tier, 0); houses.render('body'); read();
      return {images, records, repeatExact: first === scratch.toDataURL()};
    }, {tier, variant});
    assert.deepEqual(errors, []); assert.ok(result.repeatExact, 'A house depends on render history');
    for (const record of result.records) {
      assert.ok(Math.abs(record.anchor.x - HOUSE_ANCHOR.x) < 1e-10 && Math.abs(record.anchor.y - HOUSE_ANCHOR.y) < 1e-10, 'House camera anchor drift');
      for (const [layer, info] of Object.entries(record.layers)) {
        assert.ok(info.alphaPixels > 8, `Blank ${variant}/${tier}/${record.step}/${layer}`);
        assert.equal(info.edgePixels, 0, `Clipped ${variant}/${tier}/${record.step}/${layer}`);
      }
      assert.equal(record.winterAlphaChanges, 0, 'Snow changed source geometry or transparency');
      if (record.step === 15) assert.equal(record.emissionOutsideBody, 0, 'Windows spill outside the house silhouette');
    }
    for (const {file, png} of result.images) await save(file, Buffer.from(png.split(',')[1], 'base64'));
    records.push(...result.records);
  }
  const finished = await page.evaluate(() => {
    const images = Object.entries(maps).map(([id, {canvas}]) => ({file: `${id}.png`, png: canvas.toDataURL()}));
    const stats = houses.stats; houses.dispose(); return {images, stats};
  });
  for (const {file, png} of finished.images) await save(file, Buffer.from(png.split(',')[1], 'base64'));
  await save('quality.json', Buffer.from(JSON.stringify(records, null, 2) + '\n'));
  const witness = JSON.parse(await readFile(join(dirname(source), 'source.json')));
  const elevation = HOUSE_CAMERA.elevation * Math.PI / 180;
  const chimneys = witness.homes.map(home => {
    const part = home.parts.find(part => part.name.includes('/ Chimney flue /'));
    assert.ok(part, 'Every completed home needs its saved chimney mouth');
    const p = part.bounds.min.map((v, axis) => (v + part.bounds.max[axis]) / 2);
    const horizontal = (p[0] - p[2]) / Math.SQRT2;
    const vertical = p[1] * Math.cos(elevation) - (p[0] + p[2]) / Math.SQRT2 * Math.sin(elevation);
    return {row: (home.tier - 1) * 3 + home.variant, variant: home.variant, tier: home.tier,
      x: HOUSE_ANCHOR.x + horizontal / (HOUSE_CAMERA.viewHeight * HOUSE_CAMERA.width / HOUSE_CAMERA.height),
      y: HOUSE_ANCHOR.y - vertical / HOUSE_CAMERA.viewHeight};
  }).sort((a, b) => a.row - b.row);
  await save('anchors.json', Buffer.from(JSON.stringify({profile: HOUSE_PROFILE, chimneys}, null, 2) + '\n'));
  const files = [relative(root, source), relative(root, join(dirname(source), 'homes.blend')), relative(root, join(dirname(source), 'source.json')),
    'scripts/house-sprites/export_blender.py', 'scripts/house-sprites/studio.js', 'scripts/house-sprites/contract.js', 'scripts/house-sprites/bake.mjs',
    'vendor/three/three.module.js', 'vendor/three/three.core.js', 'vendor/three/GLTFLoader.js', 'vendor/three/BufferGeometryUtils.js'];
  const sources = await Promise.all(files.map(async file => ({file, sha256: hash(await readFile(join(root, file)))})));
  await writeFile(join(out, 'manifest.json'), JSON.stringify({version: 1, profile: HOUSE_PROFILE, sourceMode: 'saved-blender-scene',
    authoring: 'Original Realm carpentered architecture', steps: HOUSE_STEPS, variants: HOUSE_VARIANTS, tiers: [1, 2, 3, 4],
    anchor: HOUSE_ANCHOR, camera: HOUSE_CAMERA, cell: HOUSE_CELL, maps: HOUSE_MAPS,
    runtime: {maxDetailFrames: 12, maxConcurrentDetailLoads: 2, liveWebGL: false},
    render: {normalMaps: true, roughnessMaps: true, selfShadows: true, ...finished.stats}, sources, outputs}, null, 2) + '\n');
  console.log(`[house bake] complete: ${records.length} geometry stages, ${outputs.length} output files`);
} finally {await browser.close(); await server.stop();}
