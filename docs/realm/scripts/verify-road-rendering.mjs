#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(server.gameUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && window.__realm?.actorAtlas?.().state === 'ready'
  ));
  await page.evaluate(() => window.startNewGame());
  await page.waitForTimeout(100);

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
    game.citizens = [];
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

    const events = [];
    const proto = CanvasRenderingContext2D.prototype;
    const originalFill = proto.fill;
    const originalStroke = proto.stroke;
    const originalDrawImage = proto.drawImage;

    proto.fill = function (...args) {
      if (this.canvas.id === 'game' && this.fillStyle === '#9f7548') {
        events.push('road-surface');
      }
      return originalFill.apply(this, args);
    };
    proto.stroke = function (...args) {
      if (this.canvas.id === 'game' && this.strokeStyle === '#65452d') {
        events.push('road-edge');
      }
      return originalStroke.apply(this, args);
    };
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (this.canvas.id === 'game' && source.includes('actors-atlas.png')) {
        events.push('actor');
      }
      return originalDrawImage.call(this, image, ...args);
    };

    try {
      window.forceRender();
    } finally {
      proto.fill = originalFill;
      proto.stroke = originalStroke;
      proto.drawImage = originalDrawImage;
    }

    return {
      actorDraws: events.filter(event => event === 'actor').length,
      edgeStrokes: events.filter(event => event === 'road-edge').length,
      firstActor: events.indexOf('actor'),
      lastRoad: events.lastIndexOf('road-surface'),
      roadSurfaces: events.filter(event => event === 'road-surface').length,
    };
  });

  assert.equal(result.roadSurfaces, 5, 'each visible road tile must draw one ground surface');
  assert.equal(result.edgeStrokes, 12, 'shared road edges must be omitted from a four-way junction');
  assert.ok(result.actorDraws > 0, 'the founder actor must render in the road fixture');
  assert.ok(result.lastRoad < result.firstActor, 'all roads must render before the first actor');

  console.log('✓ connected roads omit shared edges');
  console.log('✓ roads render as ground before actors');
} finally {
  await browser.close();
  await server.stop();
}
