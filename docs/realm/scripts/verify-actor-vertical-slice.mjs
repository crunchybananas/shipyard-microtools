#!/usr/bin/env node

// Prove the A3 modular actor candidate on the live game canvas without
// promoting it into the production atlas. The opt-in URL must draw the
// prefiltered tier row; the ordinary URL must remain untouched.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'tmp', 'actor-a3-vertical-slice');
const screenshotPath = join(outputDir, 'live-canvas.png');
const worldScreenshotPath = join(outputDir, 'live-world.png');
const reportPath = join(outputDir, 'report.json');
const previewId = 'a3-watchman-blue-cargo';
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

  await page.goto(
    `${server.gameUrl}?spritemuster=1&actorpreview=${previewId}`
    + `&verify=${Date.now()}`,
  );
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction((id) => {
    const preview = window.__realm?.actorPreview?.();
    return preview?.id === id
      && preview.tiers.length === 4
      && preview.tiers.every((tier) => tier.state === 'ready')
      && window.__realm?.spriteMuster?.report?.().ready === true;
  }, previewId);

  const observed = await page.evaluate(async () => {
    const events = [];
    const proto = CanvasRenderingContext2D.prototype;
    const originalDrawImage = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (source.includes('/a3-interchange/rows-runtime/')) {
        events.push({
          source,
          sourceRect: args.slice(0, 4),
          targetRect: args.slice(4, 8),
        });
      }
      return originalDrawImage.call(this, image, ...args);
    };
    try {
      window.__realm.spriteMuster.setPlaying(false);
      // At desktop width the second role page contains guard and all actions.
      window.__realm.spriteMuster.setPage(1);
      await new Promise((resolve) => requestAnimationFrame(
        () => requestAnimationFrame(resolve),
      ));
    } finally {
      proto.drawImage = originalDrawImage;
    }
    const response = await fetch(
      `assets/sprites/actor-rows/manifest.json?verticalSlice=${Date.now()}`,
      { cache: 'no-store' },
    );
    const manifest = await response.json();
    return {
      atlas: window.__realm.actorAtlas(),
      preview: window.__realm.actorPreview(),
      muster: window.__realm.spriteMuster.report(),
      events,
      candidate: manifest.rows?.['guard/carry/right'] || null,
      cache: window.__realm.spriteCache(),
    };
  });

  await page.screenshot({ path: screenshotPath, fullPage: false });

  assert.equal(observed.preview.enabled, true);
  assert.equal(observed.preview.id, previewId);
  assert.deepEqual(observed.preview.scope, {
    role: 'guard',
    action: 'carry',
    dir: 'right',
  });
  assert.equal(observed.preview.bakedCargo, true);
  assert.equal(observed.atlas.active?.pixelPerfect, true);
  assert.equal(observed.atlas.active?.smoothing, false);
  assert.ok(observed.events.length > 0, 'live canvas did not draw the A3 row');
  assert.ok(
    observed.events.every((event) => (
      event.source.includes('/watchman/watch-blue/cargo-crate/carry-right.png')
      && event.sourceRect[1] === 0
      && event.sourceRect[2] === event.targetRect[2]
      && event.sourceRect[3] === event.targetRect[3]
    )),
    'live canvas drew an unexpected, offset, or fractionally scaled A3 row',
  );
  assert.ok(
    observed.muster.visibleRows.some((row) => (
      row.key === 'guard/carry/right'
      && row.drawn
      && row.status === 'CANDIDATE'
    )),
    'guard/carry/right was not visible as a drawn candidate',
  );
  assert.equal(observed.candidate?.status, 'candidate');
  assert.equal(observed.candidate?.provenance, 'a3-modular-skeletal');
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  const ordinary = await context.newPage();
  await ordinary.goto(`${server.gameUrl}?spritemuster=1&verify=${Date.now()}`);
  await ordinary.waitForLoadState('domcontentloaded');
  await ordinary.waitForFunction(() => window.__realm?.actorPreview);
  const ordinaryState = await ordinary.evaluate(() => ({
    preview: window.__realm.actorPreview(),
    cache: window.__realm.spriteCache(),
  }));
  assert.equal(ordinaryState.preview.enabled, false);
  assert.equal(ordinaryState.preview.id, null);
  assert.equal(ordinaryState.preview.tiers.length, 0);
  assert.equal(
    ordinaryState.cache.some((entry) => entry.type.startsWith('actor-preview-')),
    false,
  );

  const world = await context.newPage();
  const worldErrors = [];
  world.on('pageerror', (error) => worldErrors.push(error.message));
  world.on('console', (message) => {
    if (message.type() === 'error') worldErrors.push(`[console] ${message.text()}`);
  });
  await world.goto(
    `${server.gameUrl}?actorpreview=${previewId}&verifyWorld=${Date.now()}`,
  );
  await world.waitForLoadState('domcontentloaded');
  await world.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && window.__realm?.actorPreview?.().tiers.every(
      (tier) => tier.state === 'ready',
    )
  ));
  await world.evaluate(() => window.startNewGame());
  // Let the title fade and founding camera tween finish so the fixture owns
  // a stable transform during both the direction-settle and screenshot.
  await world.waitForTimeout(1600);
  const worldObserved = await world.evaluate(async () => {
    const game = window.G;
    const centerX = 32;
    const centerY = 32;
    const ownership = await import(
      './js/citizen-ownership.js?realm=171'
    );
    const citizen = game.citizens[0];
    const barracks = {
      type: 'barracks',
      x: 2,
      y: 2,
      level: 1,
      hp: 100,
      maxHp: 100,
      buildProgress: 1,
    };

    game.speed = 0;
    game.debug.pauseRendering = true;
    game.buildings = [barracks];
    game.buildingGrid = game.map.map((row) => Array(row.length).fill(null));
    game.buildingGrid[barracks.y][barracks.x] = barracks;
    game.citizens = [citizen];
    game.population = 1;
    game.animals = [];
    game.walkers = [];
    game.soldiers = [];
    game.caravans = [];
    game.enemies = [];
    ownership.resetCitizenOwnershipRuntime();
    ownership.claimCitizenAssignment(citizen, barracks, {
      reason: 'player-command',
    });
    ownership.transitionCitizenActivity(
      citizen,
      'walk_to_deliver',
      'route-to-delivery',
    );
    Object.assign(citizen, {
      x: centerX,
      y: centerY,
      tx: centerX,
      ty: centerY,
      _px: centerX,
      _py: centerY,
      faceX: 1,
      faceZ: 0,
      carrying: 'wood',
      carryAmount: 3,
      path: null,
      pathIdx: 0,
      _movedAt: null,
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

    const events = [];
    const proto = CanvasRenderingContext2D.prototype;
    const originalDrawImage = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (source.includes('/a3-interchange/rows-runtime/')) {
        events.push({
          canvas: this.canvas.id,
          source,
          sourceRect: args.slice(0, 4),
          targetRect: args.slice(4, 8),
        });
      }
      return originalDrawImage.call(this, image, ...args);
    };
    try {
      // Direction hysteresis intentionally rejects one-frame pivots. Hold the
      // authored right-facing fixture long enough for the live renderer to
      // adopt it, then capture the settled row.
      for (let pass = 0; pass < 6; pass++) {
        game.camera.zoom = 1.3;
        window.forceRender();
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } finally {
      proto.drawImage = originalDrawImage;
    }
    return {
      events,
      atlas: window.__realm.actorAtlas(),
      preview: window.__realm.actorPreview(),
      citizen: {
        profession: citizen.profession.kind,
        activity: citizen.activity.kind,
        carrying: citizen.carrying,
        faceX: citizen.faceX,
        faceZ: citizen.faceZ,
      },
      canvas: { ...document.getElementById('game').dataset },
    };
  });
  await world.screenshot({ path: worldScreenshotPath, fullPage: false });
  if (process.env.DEBUG_VERTICAL_SLICE === '1') {
    console.log(JSON.stringify(worldObserved, null, 2));
  }
  assert.deepEqual(worldObserved.citizen, {
    profession: 'guard',
    activity: 'walk_to_deliver',
    carrying: 'wood',
    faceX: 1,
    faceZ: 0,
  });
  assert.ok(
    worldObserved.events.some((event) => (
      event.canvas === 'game'
      && event.source.includes('/watchman/watch-blue/cargo-crate/carry-right.png')
      && event.source.includes('/rows-runtime/default/')
      && event.sourceRect[1] === 0
      && event.sourceRect[2] === 35
      && event.sourceRect[3] === 46
      && event.targetRect[2] === 27
      && event.targetRect[3] === 35
    )),
    'actual settlement view did not draw the exact zoom-matched A3 carry row',
  );
  assert.equal(worldObserved.atlas.active?.tier, 'default');
  assert.equal(worldObserved.atlas.active?.pixelPerfect, true);
  assert.equal(worldObserved.atlas.active?.smoothing, false);
  assert.equal(worldErrors.length, 0, worldErrors.join('\n'));

  const report = {
    schema: 'realm.actor-pose.a3-live-canvas-report.v1',
    previewId,
    pageErrors,
    observed,
    ordinaryState,
    worldObserved,
    screenshots: {
      muster: screenshotPath,
      world: worldScreenshotPath,
    },
    passed: true,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log('✓ A3 watchman + blue kit + cargo row drew on the live canvas');
  console.log('✓ the preview uses a prefiltered runtime tier with row-local addressing');
  console.log('✓ an actual guard carrier draws the zoom-matched tier in-world');
  console.log('✓ the ordinary game URL remains on production art');
  console.log(`muster screenshot: ${screenshotPath}`);
  console.log(`world screenshot: ${worldScreenshotPath}`);
  console.log(`report: ${reportPath}`);
} finally {
  await browser.close();
  await server.stop();
}
