#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import { ensureServer } from './_serve.mjs';

const server = await ensureServer();
const browser = await launchGraphicsBrowser();
const output = new URL(`../tmp/graphics-world/road-depth-gate${graphicsBrowserSuffix}/`, import.meta.url);
await mkdir(output, {recursive: true});

try {
  for (const fallback of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (fallback) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto(server.gameUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && window.__realm?.actorAtlas?.().tiers?.some(tier => tier.state === 'ready')
  ));
  await page.evaluate(async () => {
    window.startNewGame();window.setSpeed(0);
    window.roadFounder = await import('./js/founder-presentation.js?realm=198');
  });
  await page.waitForFunction(() => window.roadFounder.founderPresentationDiagnostics().pose && G.camera.zoom === 1.3);

  const result = await page.evaluate(() => {
    const game = window.G;
    const centerX = 32;
    const centerY = 32;
    const roadTiles = [
      [centerX, centerY],
      [centerX - 1, centerY],
      [centerX + 1, centerY],
      [centerX, centerY - 1],
      [centerX, centerY + 1],
    ];

    game.speed = 0;
    game.debug.pauseRendering = true;
    game.selectedBuild = null;
    game.selectedBuilding = null;
    game.hoveredTile = null;
    game.buildings = [];
    game.buildingGrid = game.map.map(row => Array(row.length).fill(null));
    const citizen = game.citizens[0];
    Object.assign(citizen, {x:centerX+.25,y:centerY+.25,_px:centerX+.25,_py:centerY+.25,
      tx:centerX+.25,ty:centerY+.25,path:null,pathIdx:0});
    game.citizens = [citizen];
    game.animals = [];
    game.walkers = [];
    game.soldiers = [];
    game.caravans = [];
    game.enemies = [];
    game.camera = {
      x: (centerX - centerY) * 32,
      y: (centerX + centerY) * 16,
      zoom: 1.3,
    };

    for (const [x, y] of roadTiles) {
      game.map[y][x] = 2;
      game.fog[y][x] = true;
      const road = {
        type: 'road',
        x,
        y,
        level: 1,
        hp: 100,
        maxHp: 100,
        buildProgress: 1,
      };
      game.buildings.push(road);
      game.buildingGrid[y][x] = road;
    }

    game.avatar.x = centerX;
    game.avatar.y = centerY;
    game.avatar._px = centerX;
    game.avatar._py = centerY;

    const events = [], citizenDraws = [];
    const proto = CanvasRenderingContext2D.prototype;
    const originalStroke = proto.stroke;
    const originalDrawImage = proto.drawImage;

    proto.stroke = function (...args) {
      if (this.canvas.id === 'game' && this.strokeStyle === '#777463') {
        events.push('road-surface');
      }
      return originalStroke.apply(this, args);
    };
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (this.canvas.id === 'game' && (source.includes('actors-atlas') || source.includes('/citizens/builder/'))) {
        events.push('actor');
        citizenDraws.push({source,frameWidth:args[2],frameHeight:args[3],smoothing:this.imageSmoothingEnabled});
      }
      if (this.canvas.id === 'game' && source.includes('/founder/')) events.push('founder');
      if (this.canvas.id === 'game' && image?.dataset?.realmLandscape) events.push('landscape');
      return originalDrawImage.call(this, image, ...args);
    };

    try {
      window.forceRender();
    } finally {
      proto.stroke = originalStroke;
      proto.drawImage = originalDrawImage;
    }

    return {
      actorDraws: events.filter(event => event === 'actor').length,
      citizenDraws,
      founderDraws: events.filter(event => event === 'founder').length,
      firstFounder: events.indexOf('founder'),
      actorResolution: { ...document.getElementById('game').dataset },
      firstActor: events.indexOf('actor'),
      lastRoad: Math.max(events.lastIndexOf('road-surface'), events.lastIndexOf('landscape')),
      postfxResolution: { ...document.getElementById('postfx').dataset },
      roadSurfaces: events.filter(event => event === 'road-surface').length,
      landscapeLayers: events.filter(event => event === 'landscape').length,
      landscape: window.__realm.landscape(),
    };
  });

  assert.deepEqual(errors, [], 'road fixture must render without browser errors');
  assert.equal(result.landscapeLayers, fallback ? 0 : 1, 'live roads belong to the single landscape composite');
  assert.equal(result.roadSurfaces, fallback ? 20 : 0, 'Canvas fallback uses four soft verge strokes per road cell');
  assert.equal(result.landscape.state, fallback ? 'unavailable' : 'ready');
  if (!fallback) assert.equal(result.landscape.knownRoadTiles, 5, 'all five roads must reach the landscape material');
  assert.ok(result.actorDraws > 0, 'the citizen must render in the road fixture');
  assert.ok(result.founderDraws > 0, 'the authored Founder must render in the road fixture');
  assert.ok(result.lastRoad < result.firstActor, 'all roads must render before the first actor');
  assert.ok(result.lastRoad < result.firstFounder, 'all roads must render before the Founder');
  for(const draw of result.citizenDraws){
    if(draw.source.includes('/citizens/builder/')){
      assert.ok([64,128].includes(draw.frameWidth));
      assert.equal(draw.frameHeight,draw.frameWidth*84/64);
      assert.equal(draw.smoothing,true);
    }else{
      assert.equal(draw.frameWidth,35);assert.equal(draw.frameHeight,46);
      assert.equal(draw.smoothing,false);
    }
  }
  assert.equal(result.postfxResolution.pixelRatio, result.postfxResolution.sourcePixelRatio);

  const winter = await page.evaluate(async () => {
    const {applyPostFX} = await import('./js/postfx.js?realm=198');
    const {getDaylight, getSeasonIndex} = await import('./js/state.js?realm=198');
    G.avatar = null; G.citizens = []; G.dayPhase = G.dayLength * .5;
    G.season = 'winter'; G.photoMode = true; G.camera.zoom = 3.3;
    G.map = G.map.map(row => row.map(() => 2)); G.fog = G.map.map(row => row.map(() => true));
    // Leave a real curved junction for the visual fallback proof.
    G.buildings = G.buildings.filter(b => b.x <= 32 && b.y <= 32);
    G.buildingGrid = G.map.map(row => row.map(() => null));
    for (const b of G.buildings) G.buildingGrid[b.y][b.x] = b;
    document.body.classList.add('photo-mode');
    forceRender();
    const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
    applyPostFX(canvas, G.gameTick, getDaylight(), getSeasonIndex());
    return G.buildings.map(b => {
      const x = Math.round(canvas.width / 2 + ((b.x - b.y) * 32 - G.camera.x + 12) * G.camera.zoom);
      const y = Math.round(canvas.height / 2 + ((b.x + b.y) * 16 - G.camera.y + 4) * G.camera.zoom);
      const pixels = ctx.getImageData(x - 2, y - 1, 5, 3).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      return sum / (pixels.length / 4);
    });
  });
  assert.ok(winter.every(light => light < 220), `winter roads must not acquire bright oval snow stamps: ${winter}`);
  await page.screenshot({path: new URL(fallback ? 'canvas-bend.png' : 'webgl-bend.png', output).pathname});
  console.log(`✓ ${fallback ? 'Canvas fallback' : 'WebGL landscape'} roads render before the citizen and Founder`);
  console.log('✓ default actor tier and post-processing preserve physical pixels');
  console.log('✓ winter travel surfaces remain clear of repeated snow stamps');
  await page.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
