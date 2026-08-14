#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'scripts/screenshots');
const screenshotPath = join(outputDir, 'enemy-raiders-live.png');
const reportPath = join(outputDir, 'enemy-raiders-live-report.json');
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    // Retina is Realm's default-tier exact-presentation contract:
    // 27x35 logical actors at the 1.3 camera land closest to the 35x46
    // source tier at an integer physical scale.
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`[console] ${message.text()}`);
  });
  await page.goto(`${server.gameUrl}?verifyEnemySprites=${Date.now()}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function');
  await page.evaluate(() => window.startNewGame());
  await page.waitForTimeout(900);

  const observed = await page.evaluate(async () => {
    const render = await import('./js/render.js?realm=195');
    const contract = await import('./js/enemy-sprite-contract.js?realm=195');
    const game = window.G;
    game.speed = 0;
    game.debug.pauseRendering = true;
    game.citizens = [];
    game.animals = [];
    game.walkers = [];
    game.soldiers = [];
    game.caravans = [];
    game.buildings = [];
    game.buildingGrid = game.map.map((row) => Array(row.length).fill(null));
    game.avatar.x = 2;
    game.avatar.y = 2;
    game.avatar._px = 2;
    game.avatar._py = 2;
    game.camera = { x: 0, y: 1024, zoom: 1.3 };

    const actions = ['idle', 'walk', 'attack', 'retreat'];
    const enemies = [];
    for (let variant = 0; variant < 3; variant++) {
      const screenSum = 57 + variant * 7;
      for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
        const screenDiff = -9 + actionIndex * 6;
        const x = (screenSum + screenDiff) / 2;
        const y = (screenSum - screenDiff) / 2;
        const action = actions[actionIndex];
        enemies.push({
          x, y, _px: x, _py: y,
          tx: action === 'idle' ? x : x + (action === 'retreat' ? -3 : 3),
          ty: action === 'idle' ? y : y,
          hp: actionIndex % 2 ? 19 : 30,
          maxHp: 30,
          damage: 7,
          plunderGoal: 30,
          type: 'raider',
          state: 'approach',
          variant,
          attackCue: action === 'attack' ? 8 : 0,
          retreating: action === 'retreat',
        });
      }
    }
    game.enemies = enemies;
    for (let y = 20; y < 45; y++) {
      for (let x = 20; x < 45; x++) {
        game.map[y][x] = 2;
        game.fog[y][x] = true;
      }
    }

    let exactTierReady = false;
    for (let pass = 0; pass < 24; pass++) {
      window.forceRender();
      const dataset = document.getElementById('game')?.dataset;
      exactTierReady = dataset?.enemyAtlasTier === 'default'
        && dataset?.enemyAtlasPixelPerfect === 'true'
        && dataset?.enemyAtlasSmoothing === 'false';
      if (exactTierReady) break;
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    if (!exactTierReady) throw new Error('default Retina enemy atlas tier never became pixel-perfect');

    const events = [];
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (this.canvas.id === 'game' && source.includes('/enemies-atlas-default.png')) {
        events.push({
          source,
          sourceRect: args.slice(0, 4),
          targetRect: args.slice(4, 8),
          smoothing: this.imageSmoothingEnabled,
        });
      }
      return original.call(this, image, ...args);
    };
    try {
      window.forceRender();
    } finally {
      proto.drawImage = original;
    }

    const expected = enemies.map((enemy) => {
      const action = render.enemyActionForRender(enemy);
      const direction = render.enemyDirectionForRender(enemy);
      const frame = render.enemyAnimationFrame(enemy, action);
      return {
        variant: enemy.variant,
        action,
        direction,
        frame,
        sourceY: contract.enemyAtlasFrameRect(
          enemy.variant, action, direction, frame, 35, 46,
        ).sy,
      };
    });
    const canvas = document.getElementById('game');
    return {
      events,
      expected,
      canvas: {
        tier: canvas.dataset.enemyAtlasTier,
        frame: canvas.dataset.enemyAtlasFrame,
        pixelPerfect: canvas.dataset.enemyAtlasPixelPerfect,
        smoothing: canvas.dataset.enemyAtlasSmoothing,
      },
    };
  });

  await page.screenshot({ path: screenshotPath, fullPage: false });
  assert.equal(observed.canvas.tier, 'default');
  assert.equal(observed.canvas.frame, '35x46');
  assert.equal(observed.canvas.pixelPerfect, 'true');
  assert.equal(observed.canvas.smoothing, 'false');
  assert.equal(observed.events.length, 12, `expected 12 raider draws, got ${observed.events.length}`);
  assert.deepEqual(new Set(observed.expected.map((item) => item.variant)), new Set([0, 1, 2]));
  assert.deepEqual(new Set(observed.expected.map((item) => item.action)), new Set(['idle', 'walk', 'attack', 'retreat']));
  const expectedSourceRows = observed.expected.map((item) => item.sourceY).sort((a, b) => a - b);
  const observedSourceRows = observed.events.map((item) => item.sourceRect[1]).sort((a, b) => a - b);
  assert.deepEqual(observedSourceRows, expectedSourceRows);
  for (const event of observed.events) {
    assert.deepEqual(event.sourceRect.slice(2), [35, 46]);
    assert.deepEqual(event.targetRect.slice(2), [27, 35]);
    assert.equal(event.smoothing, false);
  }
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  const report = {
    schema: 'realm.enemy-sprites.raider-browser-report.v1',
    screenshot: 'scripts/screenshots/enemy-raiders-live.png',
    observed,
    pageErrors,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `[enemy-sprites-browser] PASS — 12 live raiders; 3 variants x 4 states; `
    + `default 35x46 source -> 27x35 target; proof ${screenshotPath}`,
  );
} finally {
  await browser.close();
  await server.stop();
}
