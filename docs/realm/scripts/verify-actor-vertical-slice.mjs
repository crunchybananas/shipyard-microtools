#!/usr/bin/env node

// Prove the A5 four-action, four-direction modular guard family on the live
// game canvas without promoting it into the production atlas. The opt-in URL
// must draw every prefiltered row; the ordinary URL must remain untouched.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'tmp', 'actor-a5-vertical-slice');
const screenshotPath = join(outputDir, 'live-canvas.png');
const worldScreenshotPath = join(outputDir, 'live-world.png');
const reportPath = join(outputDir, 'report.json');
const previewId = 'a5-guard-actions';
const previewActions = ['idle', 'walk', 'work', 'carry'];
const previewDirections = ['down', 'up', 'left', 'right'];
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
      if (source.includes('/a5-guard-actions/rows-runtime/')) {
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
    return {
      atlas: window.__realm.actorAtlas(),
      preview: window.__realm.actorPreview(),
      muster: window.__realm.spriteMuster.report(),
      events,
      cache: window.__realm.spriteCache(),
    };
  });

  await page.screenshot({ path: screenshotPath, fullPage: false });

  assert.equal(observed.preview.enabled, true);
  assert.equal(observed.preview.id, previewId);
  assert.deepEqual(observed.preview.scope, {
    role: 'guard',
    actions: previewActions,
    dirs: previewDirections,
  });
  assert.equal(observed.preview.bakedCargo, true);
  assert.equal(observed.atlas.active?.pixelPerfect, true);
  assert.equal(observed.atlas.active?.smoothing, false);
  assert.ok(observed.events.length >= 16, 'live canvas did not draw all A5 rows');
  assert.ok(
    observed.events.every((event) => (
      previewActions.some((action) => previewDirections.some((dir) => (
        event.source.includes(`/watchman/watch-blue/${action}-${dir}.png`)
      )))
      && event.sourceRect[1] === 0
      && event.sourceRect[2] === event.targetRect[2]
      && event.sourceRect[3] === event.targetRect[3]
    )),
    'live canvas drew an unexpected, offset, or fractionally scaled A5 row',
  );
  for (const action of previewActions) {
    for (const dir of previewDirections) {
      assert.ok(
        observed.muster.visibleRows.some((row) => (
          row.key === `guard/${action}/${dir}` && row.drawn
        )),
        `guard/${action}/${dir} was not visible as a drawn row`,
      );
      assert.ok(
        observed.events.some((event) => event.source.includes(
          `/watchman/watch-blue/${action}-${dir}.png`
        )),
        `guard/${action}/${dir} did not draw from the A5 preview`,
      );
    }
  }
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
      './js/citizen-ownership.js?realm=185'
    );
    const renderCache = await import(
      './js/citizen-render-cache.js?realm=185'
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
    const fixtures = [
      { dir: 'down', faceX: 1, faceZ: 1 },
      { dir: 'right', faceX: 1, faceZ: 0 },
      { dir: 'left', faceX: -1, faceZ: 0 },
      { dir: 'up', faceX: -1, faceZ: -1 },
    ];
    let fixtureDirection = null;
    const proto = CanvasRenderingContext2D.prototype;
    const originalDrawImage = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (source.includes('/a5-guard-actions/rows-runtime/')) {
        events.push({
          fixtureDirection,
          canvas: this.canvas.id,
          source,
          sourceRect: args.slice(0, 4),
          targetRect: args.slice(4, 8),
        });
      }
      return originalDrawImage.call(this, image, ...args);
    };
    try {
      // Seed the render-only continuity record with each settled direction;
      // this isolates row selection from the separately tested 67ms pivot
      // hysteresis while still drawing through the real settlement renderer.
      for (const fixture of fixtures) {
        fixtureDirection = fixture.dir;
        citizen.faceX = fixture.faceX;
        citizen.faceZ = fixture.faceZ;
        const continuity = renderCache.citizenRenderRecord(citizen.actorId);
        continuity.dirKey = `${fixture.faceX},${fixture.faceZ}`;
        continuity.dirPending = null;
        continuity.dirPendingMs = 0;
        for (let pass = 0; pass < 2; pass++) {
          game.camera.zoom = 1.3;
          window.forceRender();
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    } finally {
      proto.drawImage = originalDrawImage;
    }
    return {
      events,
      fixtures,
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
    faceX: -1,
    faceZ: -1,
  });
  for (const dir of previewDirections) {
    assert.ok(
      worldObserved.events.some((event) => (
        event.fixtureDirection === dir
        && event.canvas === 'game'
        && event.source.includes(
          `/watchman/watch-blue/carry-${dir}.png`
        )
        && event.source.includes('/rows-runtime/default/')
        && event.sourceRect[1] === 0
        && event.sourceRect[2] === 35
        && event.sourceRect[3] === 46
        && event.targetRect[2] === 27
        && event.targetRect[3] === 35
      )),
      `settlement view did not draw the exact A5 ${dir} carry row`,
    );
  }
  assert.equal(worldObserved.atlas.active?.tier, 'default');
  assert.equal(worldObserved.atlas.active?.pixelPerfect, true);
  assert.equal(worldObserved.atlas.active?.smoothing, false);
  assert.equal(worldErrors.length, 0, worldErrors.join('\n'));

  const report = {
    schema: 'realm.actor-pose.a5-live-canvas-report.v1',
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
  console.log('✓ A5 guard rows drew across four actions and four directions');
  console.log('✓ every preview row uses a prefiltered row-local runtime tier');
  console.log('✓ an actual guard carrier draws all four zoom-matched tiers in-world');
  console.log('✓ the ordinary game URL remains on production art');
  console.log(`muster screenshot: ${screenshotPath}`);
  console.log(`world screenshot: ${worldScreenshotPath}`);
  console.log(`report: ${reportPath}`);
} finally {
  await browser.close();
  await server.stop();
}
