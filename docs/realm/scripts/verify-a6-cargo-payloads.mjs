#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARGO_DIRECTIONS,
  CARGO_FRAMES,
  CARGO_OWNER_ROWS,
  CARGO_RESOURCES,
  CARGO_RUNTIME_ATLASES,
  cargoOwnerRow,
  cargoRowIndex,
} from '../js/cargo-source-contract.js?realm=176';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(CARGO_RESOURCES.length, 9);
assert.deepEqual(CARGO_DIRECTIONS, ['down', 'up', 'left', 'right']);
assert.equal(CARGO_FRAMES, 8);
assert.deepEqual(CARGO_OWNER_ROWS, ['guard/carry', 'farmer/carry']);
assert.equal(cargoOwnerRow('guard', 'carry'), true);
assert.equal(cargoOwnerRow('farmer', 'carry'), true);
assert.equal(cargoOwnerRow('guard', 'walk'), false);
assert.equal(cargoOwnerRow('settler', 'carry'), false);
assert.equal(CARGO_RUNTIME_ATLASES.length, 4);

let expectedRow = 0;
for (const resource of CARGO_RESOURCES) {
  for (const direction of CARGO_DIRECTIONS) {
    assert.equal(cargoRowIndex(resource, direction), expectedRow++);
  }
}
assert.equal(cargoRowIndex('unknown', 'down'), -1);
assert.equal(cargoRowIndex('wood', 'unknown'), -1);

const result = spawnSync(
  'python3',
  [join(root, 'scripts', 'verify-a6-cargo-payloads.py')],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
