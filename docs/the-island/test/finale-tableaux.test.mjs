import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINALE_KINDS, finaleTableau, sampleFinaleTableau,
} from '../js/finale-tableaux.js';

const key = (values) => values.map((n) => n.toFixed(3)).join(',');

test('all four dispositions have equally timed but spatially distinct tableaux', () => {
  assert.deepEqual(FINALE_KINDS, ['tend', 'carry', 'open', 'close']);
  const specs = FINALE_KINDS.map(finaleTableau);
  assert.equal(new Set(specs.map(({ timing }) => JSON.stringify(timing))).size, 1);
  assert.equal(new Set(specs.map(({ camera }) => key(camera.start))).size, 1,
    'every ending begins at the east-room refuge');
  assert.equal(new Set(specs.map(({ camera }) => key(camera.end))).size, 4);
  assert.equal(new Set(specs.map(({ look }) => key(look.end))).size, 4);
});

test('water and threshold actions remain literal', () => {
  const carryA = sampleFinaleTableau('carry', 0.15).tide;
  const carryB = sampleFinaleTableau('carry', 0.8).tide;
  const openA = sampleFinaleTableau('open', 0.15).tide;
  const openB = sampleFinaleTableau('open', 0.8).tide;
  assert.ok(carryB < carryA, 'carry visibly draws water back');
  assert.ok(openB > openA, 'open visibly advances joined water');
  assert.equal(sampleFinaleTableau('tend', 0.8).tide, 1);
  assert.equal(sampleFinaleTableau('close', 0.8).tide, 1.45);
  assert.equal(sampleFinaleTableau('close', 0.8).door, 0);
  assert.equal(sampleFinaleTableau('tend', 0.8).door, 1);
});

test('reduced motion holds each distinct final result without flattening choices', () => {
  const early = FINALE_KINDS.map((kind) => sampleFinaleTableau(kind, 0.05, { reducedMotion: true }));
  const late = FINALE_KINDS.map((kind) => sampleFinaleTableau(kind, 0.95, { reducedMotion: true }));
  assert.deepEqual(early, late);
  assert.equal(new Set(early.map(({ camera }) => key(camera))).size, 4);
  assert.equal(new Set(early.map(({ tide }) => tide.toFixed(3))).size, 4);
  assert.equal(new Set(early.map(({ door }) => door.toFixed(3))).size, 2);
});

test('unknown saved dispositions fall back to the maintained tableau', () => {
  assert.equal(finaleTableau('retired').id, 'tend');
  assert.deepEqual(sampleFinaleTableau('retired', 1), sampleFinaleTableau('tend', 1));
});
