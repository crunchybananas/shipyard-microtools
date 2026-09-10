#!/usr/bin/env node
// Independent saved-Blender bounds, source/output hashes, decoded atlas cells,
// snow transparency, and exact detail-to-atlas correspondence in both engines.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {HOUSE_PROFILE, HOUSE_STEPS, HOUSE_ANCHOR, HOUSE_MAPS} from './house-sprites/contract.js';
const root = new URL('../', import.meta.url), asset = new URL('assets/sprites/architecture/homes/', root);
const json = async url => JSON.parse(await readFile(url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await json(new URL('manifest.json', asset)), witness = await json(new URL('source/source.json', asset));
const quality = await json(new URL('quality.json', asset));
for (const file of manifest.sources) assert.equal(hash(await readFile(new URL(file.file, root))), file.sha256, `Stale source ${file.file}`);
for (const file of manifest.outputs) assert.equal(hash(await readFile(new URL(file.file, asset))), file.sha256, `Stale output ${file.file}`);
assert.equal(manifest.sourceMode, 'saved-blender-scene'); assert.equal(manifest.profile, HOUSE_PROFILE);
assert.deepEqual(manifest.maps, HOUSE_MAPS); assert.deepEqual(manifest.anchor, HOUSE_ANCHOR); assert.deepEqual(manifest.steps, HOUSE_STEPS);
assert.equal(witness.homes.length, 12); assert.equal(quality.length, 192);
assert.equal(new Set(witness.homes.map(h => `${h.variant}/${h.tier}`)).size, 12);
const report = {errors: [], maxSourceBoundsError: 0, stages: 0, sourceParts: 0};
for (const home of witness.homes) {
  report.sourceParts += home.parts.length;
  assert.equal(home.stages.length, 16);
  assert.ok(home.parts.some(p => p.name.includes('Scaffold') && p.end === 15));
  assert.ok(home.parts.some(p => p.name.includes('Floor joist') && p.start === 3));
  for (const part of home.parts) assert.ok(part.start >= 0 && part.start < part.end && part.end <= 16, `Invalid installation ${part.name}`);
  for (const stage of home.stages) {
    const rendered = quality.find(p => p.variant === home.variant && p.tier === home.tier && p.step === stage.step);
    assert.ok(rendered, 'Missing house construction stage'); report.stages++;
    for (const edge of ['min', 'max']) for (let axis = 0; axis < 3; axis++) report.maxSourceBoundsError = Math.max(report.maxSourceBoundsError,
      Math.abs(rendered.worldBounds[edge][axis] - stage.bounds[edge][axis]));
    for (const [layer, info] of Object.entries(rendered.layers)) {
      assert.ok(info.alphaPixels > 8, `Blank ${home.variant}/${home.tier}/${stage.step}/${layer}`); assert.equal(info.edgePixels, 0);
    }
    assert.equal(rendered.winterAlphaChanges, 0);
    if (stage.step === 15) assert.equal(rendered.emissionOutsideBody, 0);
  }
}
assert.ok(report.maxSourceBoundsError < .00003, `Rendered components differ from saved Blender by ${report.maxSourceBoundsError} metres`);
assert.equal(report.sourceParts, manifest.render.parts); assert.ok(manifest.render.normalMappedParts > report.sourceParts * .8);
const out = new URL(`tmp/graphics-world/house-source-gate${graphicsBrowserSuffix}/`, root); await mkdir(out, {recursive: true});
const server = await ensureServer(), browser = await launchGraphicsBrowser();
try {
  const page = await browser.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${server.origin}/scripts/house-sprites/bake.html`);
  report.pixels = await page.evaluate(async specs => {
    const load = async name => {const img = new Image(); img.src = `/assets/sprites/architecture/homes/${name}.png`; await img.decode(); return img;};
    const bases = {};
    for (const [name, spec] of Object.entries(specs)) for (const season of ['complete', 'construction'].includes(name) ? ['summer', 'winter'] : ['']) {
      const key = `${name}${season ? `-${season}` : ''}`, image = await load(key);
      if (image.width !== spec.width * spec.columns || image.height !== spec.height * spec.rows) throw new Error(`Wrong dimensions: ${key}`);
      bases[key] = image;
    }
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', {willReadFrequently: true});
    const sample = (image, sx, sy, sw, sh, width, height) => {
      canvas.width = width; canvas.height = height; ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height).data;
    };
    // Compare spatial coverage and radiance, not one engine's chosen resize
    // kernel. Each independent 16x20 region must conserve the full-resolution
    // source's alpha and premultiplied linear color in its packed map.
    const linear = Array.from({length: 256}, (_, i) => 255 * (i <= 10 ? i / 255 / 12.92 : ((i / 255 + .055) / 1.055) ** 2.4));
    function moments(data, width, height) {
      const bins = new Float64Array(16 * 20 * 4), bw = width / 16, bh = height / 20;
      for (let by = 0; by < 20; by++) for (let bx = 0; bx < 16; bx++) {
        const bucket = (by * 16 + bx) * 4;
        for (let y = by * bh; y < (by + 1) * bh; y++) for (let x = bx * bw; x < (bx + 1) * bw; x++) {
          const i = (y * width + x) * 4, alpha = data[i + 3]; if (!alpha) continue;
          for (let c = 0; c < 3; c++) bins[bucket + c] += linear[data[i + c]] * alpha / 255;
          bins[bucket + 3] += alpha;
        }
        for (let c = 0; c < 4; c++) bins[bucket + c] /= bw * bh;
      }
      return bins;
    }
    const rows = []; let cells = 0, maximumSpatialError = 0;
    for (let row = 0; row < 12; row++) {
      const hashes = [];
      for (let step = 0; step < 16; step++) for (const season of ['summer', 'winter']) {
        const id = `${season}-${row}-${step}`, detail = await load(`detail/${id}`);
        if (detail.width !== 512 || detail.height !== 640) throw new Error(`Wrong detail dimensions: ${id}`);
        const group = step === 15 ? 'complete' : 'construction', spec = specs[group];
        const full = sample(detail, 0, 0, 512, 640, 512, 640);
        const actual = sample(bases[`${group}-${season}`], (step === 15 ? row % 3 : step) * spec.width,
          (step === 15 ? Math.floor(row / 3) : row) * spec.height, spec.width, spec.height, spec.width, spec.height);
        const expected = moments(full, 512, 640), packed = moments(actual, spec.width, spec.height);
        const error = Math.max(...expected.map((v, i) => Math.abs(v - packed[i])));
        maximumSpatialError = Math.max(maximumSpatialError, error);
        let alpha = 0; for (let i = 3; i < actual.length; i += 4) if (actual[i] > 16) alpha++;
        if (alpha < 4 || error > 1.7) throw new Error(`Atlas loses or moves source coverage/radiance: ${id}, error ${error}`);
        if (season === 'summer') hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', actual))).join(','));
        detail.src = ''; cells++;
      }
      rows.push({row, distinctStages: new Set(hashes).size});
    }
    return {cells, maximumSpatialError, rows, baseMaps: Object.keys(bases).length};
  }, HOUSE_MAPS);
  assert.equal(report.pixels.cells, 384); assert.equal(report.pixels.baseMaps, 7);
  for (const row of report.pixels.rows) assert.equal(row.distinctStages, 16, `Repeated construction stage in row ${row.row}`);
  assert.deepEqual(report.errors, []); report.browser = browser.version();
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n');
  console.log(`[house source] PASS ${report.browser}: 192 source-matched stages, 384 detailed cells, seven layer maps, unclipped snow and windows`);
} finally {await browser.close(); await server.stop();}
