import test from 'node:test';
import assert from 'node:assert/strict';
import { wheelZoom, pinchZoom } from '../js/camera-input.js';

test('wheel normalizes pixels, lines and pages and scales proportionally', () => {
  assert.equal(wheelZoom(40, -100), wheelZoom(40, -6.25, 1));
  assert.equal(wheelZoom(40, -100), wheelZoom(40, -.125, 2, 800));
  assert.equal(wheelZoom(80, -100) / 80, wheelZoom(40, -100) / 40);
  assert.ok(wheelZoom(29, -100) < 24); // One notch is a visible response.
  assert.equal(wheelZoom(10, -100), 10);
  assert.equal(wheelZoom(170, 1e6), 180);
  assert.equal(wheelZoom(29, NaN), 29);
});
test('pinch follows finger span and reverses without a scale-dependent gain', () => {
  assert.ok(Math.abs(pinchZoom(40, 200, 300) - 40 * 2 / 3) < 1e-10);
  assert.ok(Math.abs(pinchZoom(pinchZoom(40, 200, 300), 300, 200) - 40) < 1e-10);
  assert.equal(pinchZoom(40, 0, 0), 40);
  assert.equal(pinchZoom(10, 100, 200), 10);
});
