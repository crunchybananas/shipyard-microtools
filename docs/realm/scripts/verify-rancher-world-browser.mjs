#!/usr/bin/env node

// Production-world proof for the promoted A15 rancher family. This exercises
// the citizen ownership/presentation path, not the prototype preview path.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'tmp', 'a15-rancher-world');
const screenshotPath = join(outputDir, 'live-world.png');
const reportPath = join(outputDir, 'report.json');
const directions = ['down', 'up', 'left', 'right'];
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`[console] ${message.text()}`);
  });
  await page.goto(`${server.gameUrl}?verifyRancherWorld=${Date.now()}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && window.__realm?.actorAtlas?.().tiers.every((tier) => tier.state === 'ready')
    && window.__realm?.cargoAtlas?.().tiers.every((tier) => tier.state === 'ready')
  ));
  await page.evaluate(() => window.startNewGame());
  await page.waitForTimeout(1600);

  const observed = await page.evaluate(async () => {
    const ownership = await import('./js/citizen-ownership.js?realm=198');
    const renderCache = await import('./js/citizen-render-cache.js?realm=198');
    const render = await import('./js/render.js?realm=198');
    const game = window.G;
    const citizen = game.citizens[0];
    const centerX = 32;
    const centerY = 32;
    const cowpen = {
      type: 'cowpen', x: 2, y: 2, level: 1,
      hp: 100, maxHp: 100, buildProgress: 1,
    };

    game.speed = 0;
    game.debug.pauseRendering = true;
    game.buildings = [cowpen];
    game.buildingGrid = game.map.map((row) => Array(row.length).fill(null));
    game.buildingGrid[cowpen.y][cowpen.x] = cowpen;
    game.citizens = [citizen];
    game.population = 1;
    game.animals = [];
    game.walkers = [];
    game.soldiers = [];
    game.caravans = [];
    game.enemies = [];
    ownership.resetCitizenOwnershipRuntime();
    ownership.claimCitizenAssignment(citizen, cowpen, { reason: 'player-command' });
    ownership.transitionCitizenActivity(citizen, 'walk_to_deliver', 'route-to-delivery');
    Object.assign(citizen, {
      x: centerX, y: centerY, tx: centerX, ty: centerY,
      _px: centerX, _py: centerY,
      faceX: 1, faceZ: 0,
      carrying: 'food', carryAmount: 3,
      path: null, pathIdx: 0, _movedAt: null,
    });
    game.avatar.x = 2;
    game.avatar.y = 2;
    game.avatar._px = 2;
    game.avatar._py = 2;
    game.camera = {
      x: (centerX - centerY) * 32,
      y: (centerX + centerY) * 16,
      zoom: 1.3,
    };
    for (let y = centerY - 5; y <= centerY + 5; y++) {
      for (let x = centerX - 5; x <= centerX + 5; x++) {
        game.map[y][x] = 2;
        game.fog[y][x] = true;
      }
    }

    const fixtures = [
      { dir: 'down', faceX: 1, faceZ: 1 },
      { dir: 'right', faceX: 1, faceZ: 0 },
      { dir: 'left', faceX: -1, faceZ: 0 },
      { dir: 'up', faceX: -1, faceZ: -1 },
    ];
    const expectedRows = Object.fromEntries(fixtures.map(({ dir }) => [
      dir,
      render.actorAtlasFrameRect('rancher', 'carry', dir, 0, 35, 46).sy,
    ]));
    const events = [];
    let fixtureDirection = null;
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (this.canvas.id === 'game'
        && (source.includes('/actors-atlas-default.png')
          || source.includes('/cargo-payloads-default.png'))) {
        events.push({
          fixtureDirection,
          source,
          sourceRect: args.slice(0, 4),
          targetRect: args.slice(4, 8),
          smoothing: this.imageSmoothingEnabled,
        });
      }
      return original.call(this, image, ...args);
    };
    try {
      for (const fixture of fixtures) {
        fixtureDirection = fixture.dir;
        citizen.faceX = fixture.faceX;
        citizen.faceZ = fixture.faceZ;
        const continuity = renderCache.citizenRenderRecord(citizen.actorId);
        continuity.dirKey = `${fixture.faceX},${fixture.faceZ}`;
        continuity.dirPending = null;
        continuity.dirPendingMs = 0;
        for (let pass = 0; pass < 2; pass++) {
          window.forceRender();
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    } finally {
      proto.drawImage = original;
    }
    return {
      events,
      expectedRows,
      profession: citizen.profession.kind,
      activity: citizen.activity.kind,
      carrying: citizen.carrying,
      atlas: window.__realm.actorAtlas(),
      cargo: window.__realm.cargoAtlas(),
    };
  });

  await page.screenshot({ path: screenshotPath, fullPage: false });
  assert.equal(observed.profession, 'rancher');
  assert.equal(observed.activity, 'walk_to_deliver');
  assert.equal(observed.carrying, 'food');
  assert.ok(observed.cargo.ownerRows.includes('rancher/carry'));
  for (const direction of directions) {
    const actor = observed.events.find((event) => (
      event.fixtureDirection === direction
      && event.source.includes('/actors-atlas-default.png')
      && event.sourceRect[1] === observed.expectedRows[direction]
    ));
    assert.ok(actor, `world did not draw production rancher carry/${direction}`);
    assert.deepEqual(actor.sourceRect.slice(2), [35, 46]);
    assert.deepEqual(actor.targetRect.slice(2), [27, 35]);
    assert.equal(actor.smoothing, false);
    const cargo = observed.events.find((event) => (
      event.fixtureDirection === direction
      && event.source.includes('/cargo-payloads-default.png')
    ));
    assert.ok(cargo, `world did not draw food cargo/${direction}`);
    assert.deepEqual(cargo.targetRect, actor.targetRect);
    assert.equal(cargo.smoothing, false);
  }
  assert.equal(observed.atlas.active?.pixelPerfect, true);
  assert.equal(observed.atlas.active?.smoothing, false);
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  const report = {
    schema: 'realm.actor-pose.a15-rancher-world-report.v1',
    directions,
    ...observed,
    pageErrors,
    screenshot: screenshotPath,
    passed: true,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log('✓ an assigned cowpen rancher draws all four production carry directions in-world');
  console.log('✓ rancher actor and food payload use exact default-tier rectangles with smoothing off');
  console.log(`world proof: ${screenshotPath}`);
  console.log(`report: ${reportPath}`);
} finally {
  await browser.close();
  await server.stop();
}
