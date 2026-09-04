import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRefugeAction } from '../js/refuge.js';

const world = (flags = {}) => ({ flags: {
  refugeLit: false,
  returned: false,
  dispositionChosen: false,
  endingCommitted: false,
  ...flags,
} });

test('the dry room first offers one concrete act of shelter', () => {
  assert.deepEqual(nextRefugeAction({ world: world() }), { kind: 'light-refuge' });
  assert.deepEqual(nextRefugeAction({ world: world({ refugeLit: true }) }), { kind: 'keep-light' });
});

test('the returned refuge uses an explicit two-touch ending commitment', () => {
  const returned = world({ refugeLit: true, returned: true, dispositionChosen: true });
  assert.deepEqual(nextRefugeAction({ world: returned }), { kind: 'arm-ending' });
  assert.deepEqual(nextRefugeAction({ world: returned, armed: true }), { kind: 'commit-ending' });
  returned.flags.endingCommitted = true;
  assert.deepEqual(nextRefugeAction({ world: returned, armed: true }), { kind: 'complete' });
});

test('return alone cannot commit a choice that was never made below', () => {
  const incomplete = world({ refugeLit: true, returned: true });
  assert.deepEqual(nextRefugeAction({ world: incomplete }), { kind: 'keep-light' });
});

