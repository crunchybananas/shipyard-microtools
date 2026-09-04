import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPOSITION_IDS, DISPOSITION_OPERATIONS, dispositionOperation, nextDisposition,
} from '../js/dispositions.js';

test('the four positions carry distinct factual operations in dial order', () => {
  assert.deepEqual(DISPOSITION_OPERATIONS.map(({ id }) => id), ['tend', 'carry', 'open', 'close']);
  assert.deepEqual(DISPOSITION_IDS, ['tend', 'carry', 'open', 'close']);
  assert.equal(new Set(DISPOSITION_OPERATIONS.map(({ verb }) => verb)).size, 4);
  assert.equal(new Set(DISPOSITION_OPERATIONS.map(({ operation }) => operation)).size, 4);
  assert.ok(DISPOSITION_OPERATIONS.every(({ diagram }) => diagram.upper && diagram.lower && diagram.link));
});

test('the physical index cycles one authoritative operation contract', () => {
  assert.equal(nextDisposition('tend').id, 'carry');
  assert.equal(nextDisposition('carry').id, 'open');
  assert.equal(nextDisposition('open').id, 'close');
  assert.equal(nextDisposition('close').id, 'tend');
  assert.equal(nextDisposition('unknown').id, 'tend');
  assert.equal(dispositionOperation('unknown').id, 'tend');
});
