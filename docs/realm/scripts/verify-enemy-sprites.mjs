#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ENEMY_ACTIONS,
  ENEMY_DIRECTIONS,
  ENEMY_FRAMES,
  ENEMY_RUNTIME_ATLASES,
  ENEMY_VARIANTS,
  enemyAtlasFrameRect,
  enemyAtlasRowIndex,
} from '../js/enemy-sprite-contract.js?realm=192';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(root, 'assets/sprites/enemies-source/output');
const packageManifest = JSON.parse(await readFile(join(packageRoot, 'manifest.json'), 'utf8'));
const runtimeManifest = JSON.parse(await readFile(join(root, 'assets/sprites/enemies-runtime-atlases.json'), 'utf8'));
const renderSource = await readFile(join(root, 'js/render.js'), 'utf8');
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

assert.equal(packageManifest.status, 'production-ready');
assert.equal(packageManifest.verification.mechanicalPassed, true);
assert.equal(packageManifest.verification.byteDeterministicSecondPass, true);
assert.deepEqual(packageManifest.verification.failures, []);
assert.deepEqual(runtimeManifest.variants, ENEMY_VARIANTS);
assert.deepEqual(runtimeManifest.actions, ENEMY_ACTIONS);
assert.deepEqual(runtimeManifest.directions, ENEMY_DIRECTIONS);
assert.equal(runtimeManifest.frames, ENEMY_FRAMES);

for (const [variantIndex, variant] of ENEMY_VARIANTS.entries()) {
  for (const [actionIndex, action] of ENEMY_ACTIONS.entries()) {
    for (const [directionIndex, direction] of ENEMY_DIRECTIONS.entries()) {
      const expected = (
        (variantIndex * ENEMY_ACTIONS.length + actionIndex)
        * ENEMY_DIRECTIONS.length
        + directionIndex
      );
      assert.equal(enemyAtlasRowIndex(variant, action, direction), expected);
      const rect = enemyAtlasFrameRect(variant, action, direction, 7);
      assert.deepEqual(rect, {
        sx: 7 * 64,
        sy: expected * 84,
        sw: 64,
        sh: 84,
        row: expected,
        frame: 7,
      });
    }
  }
}

for (const tier of ENEMY_RUNTIME_ATLASES) {
  const record = runtimeManifest.atlases.find((item) => item.key === tier.key);
  assert.ok(record, `missing ${tier.key} enemy atlas record`);
  assert.equal(record.file, tier.file);
  assert.equal(record.frameWidth, tier.frameW);
  assert.equal(record.frameHeight, tier.frameH);
  assert.equal(record.width, tier.frameW * ENEMY_FRAMES);
  assert.equal(
    record.height,
    tier.frameH * ENEMY_VARIANTS.length * ENEMY_ACTIONS.length * ENEMY_DIRECTIONS.length,
  );
  const path = join(root, 'assets/sprites', tier.file);
  const bytes = await readFile(path);
  assert.equal(digest(bytes), record.sha256, `${tier.key} runtime hash changed`);
  const dimensions = execFileSync('magick', ['identify', '-format', '%w %h', path], { encoding: 'utf8' })
    .trim().split(/\s+/).map(Number);
  assert.deepEqual(dimensions, [record.width, record.height]);
}

assert.match(renderSource, /drawEnemyAtlasFrame\(ctx,/);
assert.match(renderSource, /enemyActionForRender\(e\)/);
assert.match(renderSource, /enemyDirectionForRender\(e\)/);
assert.match(renderSource, /enemyAnimationFrame\(e, action\)/);
for (const retiredMarker of ['eBodyX', 'greaveColor', 'eHeadX', 'eLegLx']) {
  assert.ok(!renderSource.includes(retiredMarker), `retired procedural enemy marker remains: ${retiredMarker}`);
}
assert.match(renderSource, /e\.attackCue > 0 \? 'rgba\(255,40,40,0\.5\)'/);
assert.match(renderSource, /14 \* \(e\.hp\/e\.maxHp\)/);

console.log(
  `[enemy-sprites] PASS — ${ENEMY_VARIANTS.length} variants x ${ENEMY_ACTIONS.length} actions x `
  + `${ENEMY_DIRECTIONS.length} directions = ${packageManifest.scope.rows} rows / `
  + `${packageManifest.scope.frames} frames; deterministic tiers and render source verified`,
);
