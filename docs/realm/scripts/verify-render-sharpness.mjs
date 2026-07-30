import assert from 'node:assert/strict';
import {
  chooseActorRuntimeTier,
  postFXPixelRatio,
  shouldSmoothActorTier,
} from '../js/render-resolution.js?realm=174';

const atDefaultOneX = chooseActorRuntimeTier({ width: 27 * 1.3, height: 35 * 1.3 });
assert.equal(atDefaultOneX.key, 'default');
assert.equal(shouldSmoothActorTier(atDefaultOneX), false);

const atDefaultRetina = chooseActorRuntimeTier({ width: 27 * 1.3 * 2, height: 35 * 1.3 * 2 });
assert.equal(atDefaultRetina.key, 'default');
assert.equal(atDefaultRetina.integerScale, 2);
assert.equal(shouldSmoothActorTier(atDefaultRetina), false);

const atNativeOneX = chooseActorRuntimeTier({ width: 27, height: 35 });
assert.equal(atNativeOneX.key, 'native');
assert.equal(shouldSmoothActorTier(atNativeOneX), false);

const atNativeRetina = chooseActorRuntimeTier({ width: 27 * 2, height: 35 * 2 });
assert.equal(atNativeRetina.key, 'double');
assert.equal(shouldSmoothActorTier(atNativeRetina), false);

const atReviewScale = chooseActorRuntimeTier({ width: 64, height: 84 });
assert.equal(atReviewScale.key, 'review');
assert.equal(shouldSmoothActorTier(atReviewScale), false);

assert.equal(postFXPixelRatio(1), 1);
assert.equal(postFXPixelRatio(2), 2);
assert.equal(postFXPixelRatio(3), 2);
assert.equal(postFXPixelRatio(Number.NaN), 1);

console.log('[render-sharpness] native/default/review actor tiers land on integer physical pixels');
console.log('[render-sharpness] post-processing preserves full 1x/2x backing resolution');
