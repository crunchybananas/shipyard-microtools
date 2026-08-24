#!/usr/bin/env node

// Prove the A13 modular fisher family through the isolated preview and the
// production renderer's citizen path before its rows are promoted.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'tmp', 'actor-a13-fisher-vertical-slice');
const familyScreenshot = join(outputDir, 'family-x3.png');
const worldScreenshot = join(outputDir, 'live-world.png');
const reportPath = join(outputDir, 'report.json');
const previewId = 'a13-fisher-actions';
const role = 'fisher';
const parts = 'harborhand/storm-teal';
const actions = ['idle', 'walk', 'work', 'carry'];
const directions = ['down', 'up', 'left', 'right'];
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
  });
  return errors;
}

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1700, height: 1250 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const pageErrors = collectErrors(page);
  await page.goto(`${server.gameUrl}?actorpreview=${previewId}&verify=${Date.now()}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction((id) => {
    const preview = window.__realm?.actorPreview?.();
    return preview?.id === id
      && preview.tiers.length === 4
      && preview.tiers.every((tier) => tier.state === 'ready')
      && window.__realm?.cargoAtlas?.().tiers.every((tier) => tier.state === 'ready');
  }, previewId);

  const family = await page.evaluate(async ({ actions, directions, role }) => {
    const render = await import('./js/render.js?realm=197');
    const game = window.G;
    game.debug.pauseRendering = true;
    game.gameTick = 1000;
    const events = [];
    let fixture = null;
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (source.includes('/a13-fisher-actions/rows-runtime/') || source.includes('/cargo-payloads-')) {
        events.push({
          ...fixture,
          source,
          sourceRect: args.slice(0, 4),
          targetRect: args.slice(4, 8),
          smoothing: this.imageSmoothingEnabled,
        });
      }
      return original.call(this, image, ...args);
    };

    const scale = 3;
    const cellW = 72;
    const cellH = 92;
    const canvas = document.createElement('canvas');
    canvas.id = 'a13-family-proof';
    canvas.width = actions.length * cellW * scale;
    canvas.height = directions.length * cellH * scale;
    Object.assign(canvas.style, {
      display: 'block', position: 'absolute', inset: '0 auto auto 0',
      zIndex: '99999', background: '#14191d',
    });
    document.body.append(canvas);
    const target = canvas.getContext('2d');
    target.setTransform(scale, 0, 0, scale, 0, 0);
    target.imageSmoothingEnabled = false;

    const transitionEntity = {};
    const transitionFrames = {};
    for (const action of actions) {
      const moving = action === 'walk' || action === 'carry';
      const first = render.actorAnimationFrame(
        transitionEntity, role, action, { isMoving: moving, phaseOffset: 0 },
      );
      game.gameTick += action === 'idle' ? 44 : action === 'work' ? 12 : 14;
      const advanced = render.actorAnimationFrame(
        transitionEntity, role, action, { isMoving: moving, phaseOffset: 0 },
      );
      transitionFrames[action] = { first, advanced };
      game.gameTick += 1;
    }

    try {
      for (let row = 0; row < directions.length; row++) {
        for (let column = 0; column < actions.length; column++) {
          const action = actions[column];
          const direction = directions[row];
          const draw = {
            role, action, dir: direction, frame: transitionFrames[action].first,
            x: column * cellW + 4, y: row * cellH + 4, width: 64, height: 84,
          };
          fixture = { action, direction, resource: action === 'carry' ? 'food' : null };
          if (!render.drawActorAtlasFrame(target, draw)) {
            throw new Error(`A13 actor draw failed for ${action}/${direction}`);
          }
          if (action === 'carry' && !render.drawCargoAtlasFrame(target, { ...draw, resource: 'food' })) {
            throw new Error(`A13 food cargo draw failed for carry/${direction}`);
          }
        }
      }
    } finally {
      fixture = null;
      proto.drawImage = original;
    }
    return { preview: window.__realm.actorPreview(), events, transitionFrames };
  }, { actions, directions, role });
  await page.locator('#a13-family-proof').screenshot({ path: familyScreenshot });

  assert.equal(family.preview.id, previewId);
  assert.equal(family.preview.enabled, true);
  assert.equal(family.preview.bakedCargo, true);
  assert.deepEqual(family.preview.scope, { role, actions, dirs: directions });
  for (const action of actions) {
    assert.equal(family.transitionFrames[action].first, 0, `${action} did not reset to frame 0`);
    assert.notEqual(family.transitionFrames[action].advanced, 0, `${action} did not advance at authored cadence`);
    for (const direction of directions) {
      const actor = family.events.find((event) => (
        event.action === action && event.direction === direction
        && event.source.includes('/a13-fisher-actions/rows-runtime/review/')
      ));
      assert.ok(actor, `missing A13 actor draw for ${action}/${direction}`);
      assert.ok(actor.source.includes(`/${parts}/${action}-${direction}.png`));
      assert.deepEqual(actor.sourceRect.slice(1), [0, 64, 84]);
      assert.deepEqual(actor.targetRect.slice(2), [64, 84]);
      assert.equal(actor.smoothing, false);
      if (action === 'carry') {
        const cargo = family.events.find((event) => (
          event.action === action && event.direction === direction
          && event.resource === 'food' && event.source.includes('/cargo-payloads-review.png')
        ));
        assert.ok(cargo, `missing A6 food cargo draw for ${direction}`);
        assert.deepEqual(cargo.targetRect, actor.targetRect);
        assert.equal(cargo.sourceRect[0], actor.sourceRect[0]);
        assert.equal(cargo.smoothing, false);
      }
    }
  }
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  const ordinary = await context.newPage();
  const ordinaryErrors = collectErrors(ordinary);
  await ordinary.goto(`${server.gameUrl}?ordinary=${Date.now()}`);
  await ordinary.waitForLoadState('domcontentloaded');
  await ordinary.waitForFunction(() => window.__realm?.actorPreview);
  const ordinaryState = await ordinary.evaluate(() => ({
    preview: window.__realm.actorPreview(),
    a13Resources: performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('/a13-fisher-actions/')),
  }));
  assert.equal(ordinaryState.preview.enabled, false);
  assert.equal(ordinaryState.preview.id, null);
  assert.deepEqual(ordinaryState.a13Resources, []);
  assert.equal(ordinaryErrors.length, 0, ordinaryErrors.join('\n'));

  const world = await context.newPage();
  const worldErrors = collectErrors(world);
  await world.goto(`${server.gameUrl}?actorpreview=${previewId}&world=${Date.now()}`);
  await world.waitForLoadState('domcontentloaded');
  await world.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && window.__realm?.actorPreview?.().tiers.every((tier) => tier.state === 'ready')
  ));
  await world.evaluate(() => window.startNewGame());
  await world.waitForTimeout(1600);
  const worldState = await world.evaluate(async () => {
    const ownership = await import('./js/citizen-ownership.js?realm=197');
    const renderCache = await import('./js/citizen-render-cache.js?realm=197');
    const game = window.G;
    const citizen = game.citizens[0];
    const centerX = 32;
    const centerY = 32;
    const workplace = {
      type: 'fisherman', x: 2, y: 2, level: 1, hp: 100, maxHp: 100, buildProgress: 1,
    };
    game.speed = 0;
    game.debug.pauseRendering = true;
    game.buildings = [workplace];
    game.buildingGrid = game.map.map((row) => Array(row.length).fill(null));
    game.buildingGrid[workplace.y][workplace.x] = workplace;
    game.citizens = [citizen];
    game.population = 1;
    game.animals = [];
    game.walkers = [];
    game.soldiers = [];
    game.caravans = [];
    game.enemies = [];
    ownership.resetCitizenOwnershipRuntime();
    ownership.claimCitizenAssignment(citizen, workplace, { reason: 'player-command' });
    ownership.transitionCitizenActivity(citizen, 'walk_to_deliver', 'route-to-delivery');
    Object.assign(citizen, {
      x: centerX, y: centerY, tx: centerX, ty: centerY, _px: centerX, _py: centerY,
      faceX: 1, faceZ: 0, carrying: 'food', carryAmount: 3, path: null, pathIdx: 0,
      _movedAt: null,
    });
    game.avatar.x = 2;
    game.avatar.y = 2;
    game.avatar._px = 2;
    game.avatar._py = 2;
    game.camera = { x: (centerX - centerY) * 32, y: (centerX + centerY) * 16, zoom: 1.3 };
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
    const original = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (source.includes('/a13-fisher-actions/rows-runtime/') || source.includes('/cargo-payloads-')) {
        events.push({
          fixtureDirection, canvas: this.canvas.id, source,
          sourceRect: args.slice(0, 4), targetRect: args.slice(4, 8),
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
      events, profession: citizen.profession.kind, activity: citizen.activity.kind,
      carrying: citizen.carrying, atlas: window.__realm.actorAtlas(),
    };
  });
  await world.screenshot({ path: worldScreenshot, fullPage: false });
  assert.equal(worldState.profession, 'fisher');
  assert.equal(worldState.activity, 'walk_to_deliver');
  assert.equal(worldState.carrying, 'food');
  for (const direction of directions) {
    const actor = worldState.events.find((event) => (
      event.fixtureDirection === direction && event.canvas === 'game'
      && event.source.includes(`/${parts}/carry-${direction}.png`)
      && event.source.includes('/rows-runtime/default/')
    ));
    assert.ok(actor, `world did not draw A13 carry/${direction}`);
    assert.deepEqual(actor.sourceRect.slice(1), [0, 35, 46]);
    assert.deepEqual(actor.targetRect.slice(2), [27, 35]);
    assert.equal(actor.smoothing, false);
    const cargo = worldState.events.find((event) => (
      event.fixtureDirection === direction && event.canvas === 'game'
      && event.source.includes('/cargo-payloads-default.png')
    ));
    assert.ok(cargo, `world did not draw A6 food cargo/${direction}`);
    assert.deepEqual(cargo.targetRect, actor.targetRect);
  }
  assert.equal(worldState.atlas.active?.pixelPerfect, true);
  assert.equal(worldState.atlas.active?.smoothing, false);
  assert.equal(worldErrors.length, 0, worldErrors.join('\n'));

  const report = {
    schema: 'realm.actor-pose.a13-live-canvas-report.v1', previewId, actions, directions,
    family, ordinaryState, worldState, pageErrors, worldErrors,
    screenshots: { family: familyScreenshot, world: worldScreenshot }, passed: true,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log('✓ A13 fisher rows draw across four actions and directions');
  console.log('✓ A13 carry and A6 food payloads share exact frame and destination rectangles');
  console.log('✓ an assigned fisher draws all four carry directions in-world');
  console.log('✓ ordinary URLs never request A13 preview assets');
  console.log(`family proof: ${familyScreenshot}`);
  console.log(`world proof: ${worldScreenshot}`);
  console.log(`report: ${reportPath}`);
} finally {
  await browser.close();
  await server.stop();
}
