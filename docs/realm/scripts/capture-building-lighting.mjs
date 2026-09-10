#!/usr/bin/env node
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {ensureServer} from './_serve.mjs';
const label = process.argv[2] || 'building-lighting';
const output = new URL(`../tmp/graphics-world/${label}${graphicsBrowserSuffix}/`, import.meta.url);
await mkdir(output, {recursive: true});
const server = await ensureServer(), browser = await launchGraphicsBrowser();
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1050}, deviceScaleFactor: 1});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.gameUrl); await page.waitForFunction(() => typeof startNewGame === 'function');
  await page.evaluate(() => {startNewGame(); setSpeed(0);});
  await page.getByRole('button', {name: 'Skip tutorial', exact: true}).click();
  await page.waitForFunction(() => G.camera.zoom === 1.3 && __realm.rasterAtlas().state === 'ready' && __realm.supportAtlas().state === 'ready');
  const save = await readFile(new URL('../tmp/graphics-world/buildings-210-construction-final/save.json', import.meta.url), 'utf8');
  await page.evaluate(async save => {
    const state = await import('./js/save-state.js?realm=198');
    const prepared = state.prepareSave(save); if (!prepared.ok) throw new Error(JSON.stringify(prepared.error));
    const loaded = state.commitGameLoad(prepared.value); if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    G.debug.pauseRendering = true; setSpeed(0); G._followAvatar = false;
    G.camera = {x: -38, y: 1330, zoom: 2.5}; G._renderAlpha = 1;
    const {render, renderBuildingIsolated} = await import('./js/render.js?realm=198');
    const {applyPostFX} = await import('./js/postfx.js?realm=198');
    const {getDaylight, getSeasonIndex} = await import('./js/state.js?realm=198');
    const ui = await import('./js/ui.js?realm=198');
    const {renderMinimap} = await import('./js/minimap.js?realm=198');
    window.lightingReview = async (phase, season) => {
      G.dayPhase = G.dayLength * phase; G.season = season;
      ui.updateUI(); ui.renderBuildBar(); ui.renderMissions();
      render(); applyPostFX(document.getElementById('game'), G.gameTick, getDaylight(), getSeasonIndex()); renderMinimap();
    };
    window.lightingGallery = () => {
      const types = ['house','tavern','church','school','townhall','blacksmith','bakery','barracks','lumber','fisherman','market','windmill'];
      const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1080;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#303936'; ctx.fillRect(0, 0, 1440, 1080);
      types.forEach((type, i) => {
        const c = renderBuildingIsolated(type, {width: 144, height: 166, bgColor: '#303936', dayPhase: G.dayLength * .87, daylight: .7, season: 'winter'});
        const x = i % 4 * 360, y = Math.floor(i / 4) * 360;
        ctx.drawImage(c, x + 36, y, 288, 332);
        ctx.fillStyle = '#eee5cf'; ctx.font = '13px system-ui'; ctx.fillText(type, x + 20, y + 346);
      });
      return canvas.toDataURL('image/png');
    };
  }, save);
  for (const [name, phase, season] of [['day', .5, 'spring'], ['dusk', .72, 'spring'], ['night', .87, 'spring'], ['winter-night', .87, 'winter']]) {
    await page.evaluate(([phase, season]) => lightingReview(phase, season), [phase, season]);
    await page.screenshot({path: new URL(`${name}.png`, output).pathname});
  }
  const gallery = await page.evaluate(() => lightingGallery());
  await writeFile(new URL('gallery.png', output), Buffer.from(gallery.split(',')[1], 'base64'));
  await writeFile(new URL('report.json', output), JSON.stringify({browser: browser.version(), errors}, null, 2) + '\n');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`[building lighting] captured ${label}: day, dusk, night, winter night and source-aligned gallery`);
} finally {await browser.close(); await server.stop();}
