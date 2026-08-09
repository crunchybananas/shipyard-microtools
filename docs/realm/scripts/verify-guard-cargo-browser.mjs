#!/usr/bin/env node

// Close-zoom browser proof for every promoted modular baked-container family
// and its A6 cargo overlays. Both proof canvases draw through the production
// renderer.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'tmp', 'guard-cargo-browser');
const resourcesScreenshot = join(outputDir, 'resources-four-directions-x3.png');
const transitionsScreenshot = join(outputDir, 'actions-four-directions-x3.png');
const reportPath = join(outputDir, 'report.json');
const resources = ['wood', 'stone', 'food', 'gold', 'iron', 'wheat', 'flour', 'planks', 'tools'];
const directions = ['down', 'up', 'left', 'right'];
const actions = ['idle', 'walk', 'work', 'carry'];
const roles = [
  'guard',
  'farmer',
  'rancher',
  'lumber',
  'builder',
  'blacksmith',
  'miner',
  'stonecutter',
  'fisher',
  'settler',
  'trader',
];
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 2100, height: 1300 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`[console] ${message.text()}`);
  });
  await page.goto(`${server.gameUrl}?verifyGuardCargo=${Date.now()}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    window.__realm?.actorAtlas?.().tiers.every((tier) => tier.state === 'ready')
    && window.__realm?.cargoAtlas?.().tiers.every((tier) => tier.state === 'ready')
  ));

  const observed = await page.evaluate(async ({
    resources,
    directions,
    actions,
    roles,
  }) => {
    const render = await import('./js/render.js?realm=191');
    const game = window.G;
    game.debug.pauseRendering = true;
    const events = [];
    let fixture = null;
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    proto.drawImage = function (image, ...args) {
      const source = image?.currentSrc || image?.src || '';
      if (source.includes('/actors-atlas') || source.includes('/cargo-payloads-')) {
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

    function proofCanvas(id, columns, rows) {
      const scale = 3;
      const cellW = 72;
      const cellH = 92;
      const canvas = document.createElement('canvas');
      canvas.id = id;
      canvas.width = columns * cellW * scale;
      canvas.height = rows * cellH * scale;
      Object.assign(canvas.style, {
        display: 'block',
        position: 'absolute',
        left: '0',
        top: id.includes('resource') ? '0' : `${rows * cellH * scale + 24}px`,
        zIndex: '99999',
        background: '#14191d',
      });
      document.body.append(canvas);
      const target = canvas.getContext('2d');
      target.setTransform(scale, 0, 0, scale, 0, 0);
      target.imageSmoothingEnabled = false;
      return { canvas, target, cellW, cellH };
    }

    const transitionFrames = {};
    game.gameTick = 1000;
    for (const role of roles) {
      const transitionEntity = {};
      transitionFrames[role] = {};
      for (const action of actions) {
        const moving = action === 'walk' || action === 'carry';
        const first = render.actorAnimationFrame(
          transitionEntity,
          role,
          action,
          { isMoving: moving, phaseOffset: 0 },
        );
        game.gameTick += action === 'idle' ? 44 : action === 'work' ? 12 : 14;
        const advanced = render.actorAnimationFrame(
          transitionEntity,
          role,
          action,
          { isMoving: moving, phaseOffset: 0 },
        );
        transitionFrames[role][action] = { first, advanced };
        game.gameTick += 1;
      }
    }

    const transitionProof = proofCanvas(
      'a6-transition-proof',
      actions.length,
      directions.length * roles.length,
    );
    for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
      const role = roles[roleIndex];
      for (let directionIndex = 0; directionIndex < directions.length; directionIndex++) {
        const row = roleIndex * directions.length + directionIndex;
        const direction = directions[directionIndex];
        for (let column = 0; column < actions.length; column++) {
          const action = actions[column];
          const target = {
            role,
            action,
            dir: direction,
            frame: transitionFrames[role][action].first,
            x: column * transitionProof.cellW + 4,
            y: row * transitionProof.cellH + 4,
            width: 64,
            height: 84,
          };
          fixture = {
            proof: 'transition',
            role,
            action,
            direction,
            resource: action === 'carry' ? 'wood' : null,
          };
          if (!render.drawActorAtlasFrame(transitionProof.target, target)) {
            throw new Error(`actor proof draw failed for ${role}/${action}/${direction}`);
          }
          if (action === 'carry' && !render.drawCargoAtlasFrame(transitionProof.target, {
            ...target,
            resource: 'wood',
          })) {
            throw new Error(`cargo proof draw failed for ${role}/wood/${direction}`);
          }
        }
      }
    }

    const resourceProof = proofCanvas(
      'a6-resource-proof',
      resources.length,
      directions.length * roles.length,
    );
    for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
      const role = roles[roleIndex];
      for (let directionIndex = 0; directionIndex < directions.length; directionIndex++) {
        const row = roleIndex * directions.length + directionIndex;
        const direction = directions[directionIndex];
        for (let column = 0; column < resources.length; column++) {
          const resource = resources[column];
          const target = {
            role,
            action: 'carry',
            dir: direction,
            frame: column % 8,
            x: column * resourceProof.cellW + 4,
            y: row * resourceProof.cellH + 4,
            width: 64,
            height: 84,
          };
          fixture = {
            proof: 'resource',
            role,
            action: 'carry',
            direction,
            resource,
          };
          if (!render.drawActorAtlasFrame(resourceProof.target, target)) {
            throw new Error(`actor proof draw failed for ${role}/${resource}/${direction}`);
          }
          if (!render.drawCargoAtlasFrame(resourceProof.target, {
            ...target,
            resource,
          })) {
            throw new Error(`cargo proof draw failed for ${role}/${resource}/${direction}`);
          }
        }
      }
    }
    fixture = null;
    proto.drawImage = original;
    return {
      events,
      transitionFrames,
      actor: window.__realm.actorAtlas(),
      cargo: window.__realm.cargoAtlas(),
      preview: window.__realm.actorPreview(),
    };
  }, { resources, directions, actions, roles });

  await page.locator('#a6-resource-proof').screenshot({ path: resourcesScreenshot });
  await page.locator('#a6-transition-proof').screenshot({ path: transitionsScreenshot });

  assert.equal(observed.preview.enabled, false);
  assert.deepEqual(observed.cargo.resources, resources);
  assert.deepEqual(observed.cargo.directions, directions);
  assert.deepEqual(
    observed.cargo.ownerRows,
    [
      'guard/carry',
      'farmer/carry',
      'rancher/carry',
      'lumber/carry',
      'builder/carry',
      'blacksmith/carry',
      'miner/carry',
      'stonecutter/carry',
      'fisher/carry',
      'settler/carry',
      'trader/carry',
    ],
  );
  for (const role of roles) {
    for (const action of actions) {
      assert.equal(
        observed.transitionFrames[role][action].first,
        0,
        `${role}/${action} transition did not reset to frame 0`,
      );
      assert.notEqual(
        observed.transitionFrames[role][action].advanced,
        0,
        `${role}/${action} did not advance after its authored cadence`,
      );
    }
  }

  const cargoEvents = observed.events.filter((event) => event.source.includes('/cargo-payloads-'));
  const resourceCargoEvents = cargoEvents.filter((event) => event.proof === 'resource');
  assert.equal(
    resourceCargoEvents.length,
    roles.length * resources.length * directions.length,
  );
  for (const role of roles) {
    for (const resource of resources) {
      for (const direction of directions) {
        const event = resourceCargoEvents.find((item) => (
          item.role === role
          && item.resource === resource
          && item.direction === direction
        ));
        assert.ok(
          event,
          `missing browser cargo draw for ${role}/${resource}/${direction}`,
        );
        assert.ok(event.source.includes('/cargo-payloads-review.png'));
        assert.deepEqual(event.sourceRect.slice(2), [64, 84]);
        assert.deepEqual(event.targetRect.slice(2), [64, 84]);
        assert.equal(event.smoothing, false);
        const actor = observed.events.find((item) => (
          item.proof === 'resource'
          && item.role === role
          && item.resource === resource
          && item.direction === direction
          && item.source.includes('/actors-atlas')
        ));
        assert.ok(
          actor,
          `missing paired actor draw for ${role}/${resource}/${direction}`,
        );
        assert.deepEqual(event.targetRect, actor.targetRect);
        assert.equal(event.sourceRect[0], actor.sourceRect[0]);
      }
    }
  }
  assert.equal(
    observed.events.some((event) => event.source.includes('/a5-guard-actions/')),
    false,
    'ordinary production proof loaded an A5 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a7-farmer-actions/')),
    false,
    'ordinary production proof loaded an A7 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a8-lumber-actions/')),
    false,
    'ordinary production proof loaded an A8 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a9-builder-actions/')),
    false,
    'ordinary production proof loaded an A9 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a10-blacksmith-actions/')),
    false,
    'ordinary production proof loaded an A10 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a11-miner-actions/')),
    false,
    'ordinary production proof loaded an A11 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a12-stonecutter-actions/')),
    false,
    'ordinary production proof loaded an A12 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a13-fisher-actions/')),
    false,
    'ordinary production proof loaded an A13 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a14-settler-actions/')),
    false,
    'ordinary production proof loaded an A14 preview row',
  );
  assert.equal(
    observed.events.some((event) => event.source.includes('/a15-rancher-actions/')),
    false,
    'ordinary production proof loaded an A15 prototype row',
  );
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  const report = {
    schema: 'realm.modular-cargo-browser-report.v2',
    roles,
    resources,
    directions,
    actions,
    transitionFrames: observed.transitionFrames,
    cargoDraws: resourceCargoEvents.length,
    actorTier: observed.actor.active,
    cargoTiers: observed.cargo.tiers,
    pageErrors,
    screenshots: {
      resources: resourcesScreenshot,
      transitions: transitionsScreenshot,
    },
    passed: true,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log('✓ all 9 cargo kinds draw for eleven modular families in four directions at exact x3 scale');
  console.log('✓ all eleven modular families reset action transitions to authored frame 0');
  console.log('✓ actor and cargo use identical destination rectangles with smoothing off');
  console.log(`resource proof: ${resourcesScreenshot}`);
  console.log(`transition proof: ${transitionsScreenshot}`);
  console.log(`report: ${reportPath}`);
} finally {
  await browser.close();
  await server.stop();
}
