#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from '../_serve.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(root, process.argv[2] || 'tmp/house-sprites/houses-213/homes.glb');
const output = resolve(root, process.argv[3] || 'tmp/house-sprites/houses-213/review');
await mkdir(output, {recursive: true});
const server = await ensureServer();
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${server.origin}/scripts/house-sprites/bake.html`); await page.waitForFunction(() => window.ready);
  const result = await page.evaluate(async url => {
    const {createHouseStudio} = await import('./studio.js');
    const studio = await createHouseStudio({url}), images = [], records = [];
    const panel = (columns, rows, cw, ch) => {
      const canvas = document.createElement('canvas'); canvas.width = columns * cw; canvas.height = rows * ch;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#424b3b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      return {canvas, ctx};
    };
    const {canvas, ctx} = panel(3, 4, 256, 328);
    for (let tier = 1; tier <= 4; tier++) for (let variant = 0; variant < 3; variant++) {
      studio.select(variant, tier, 15);
      ctx.drawImage(studio.render('ground'), variant * 256, (tier - 1) * 328, 256, 320);
      ctx.drawImage(studio.render(), variant * 256, (tier - 1) * 328, 256, 320);
      ctx.fillStyle = '#d8d7c6'; ctx.font = '12px system-ui'; ctx.fillText(`${['Reed', 'Slate', 'Clay'][variant]} · tier ${tier}`, variant * 256 + 16, tier * 328 - 10);
      records.push(studio.landmarks());
      if (tier === 1 || tier === 3) images.push({id: `home-${variant}-${tier}`, png: studio.renderer.domElement.toDataURL()});
    }
    images.push({id: 'family', png: canvas.toDataURL()});
    const construction = panel(4, 4, 256, 328);
    for (let step = 0; step < 16; step++) {
      studio.select(0, 1, step);
      const x = (step % 4) * 256, y = Math.floor(step / 4) * 328;
      construction.ctx.drawImage(studio.render('ground'), x, y, 256, 320);
      construction.ctx.drawImage(studio.render(), x, y, 256, 320);
      construction.ctx.fillStyle = '#d8d7c6'; construction.ctx.font = '12px system-ui'; construction.ctx.fillText(`Step ${step}`, x + 16, y + 312);
      records.push(studio.landmarks());
      if ([0, 5, 9, 12].includes(step)) images.push({id: `frame-${step}`, png: studio.renderer.domElement.toDataURL()});
    }
    images.push({id: 'construction', png: construction.canvas.toDataURL()});
    for (const layer of ['body', 'ground', 'emission', 'spill']) for (const season of ['summer', 'winter']) {
      studio.select(1, 3, 15); studio.render(layer, season);
      images.push({id: `${layer}-${season}`, png: studio.renderer.domElement.toDataURL()});
    }
    const stats = studio.stats; studio.dispose(); return {images, records, stats};
  }, `/${relative(root, source)}`);
  assert.deepEqual(errors, []);
  for (const {id, png} of result.images) await writeFile(resolve(output, `${id}.png`), Buffer.from(png.split(',')[1], 'base64'));
  await writeFile(resolve(output, 'report.json'), JSON.stringify({...result, images: result.images.map(i => i.id), errors}, null, 2) + '\n');
  console.log(JSON.stringify({output, stats: result.stats, errors}));
} finally {await browser.close(); await server.stop();}
