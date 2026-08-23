// Pure resolution policy shared by the renderer and its Node quality gate.
// The canonical actor art stays 64x84; these helpers only choose the closest
// deterministic runtime derivative for the current physical-pixel footprint.

import { ACTOR_RUNTIME_ATLASES } from './sprite-source-contract.js?realm=196';

const INTEGER_SCALE_EPSILON = 0.055;
const MAX_POSTFX_DPR = 2;

function finitePositive(value, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function projectedActorSize(targetCtx, width, height) {
  const logicalW = finitePositive(width);
  const logicalH = finitePositive(height);
  const matrix = targetCtx?.getTransform?.();
  if (!matrix) return { width: logicalW, height: logicalH };
  const xScale = Math.hypot(matrix.a, matrix.b);
  const yScale = Math.hypot(matrix.c, matrix.d);
  return {
    width: logicalW * finitePositive(xScale),
    height: logicalH * finitePositive(yScale),
  };
}

function tierFit(tier, projected) {
  const scaleX = projected.width / tier.frameW;
  const scaleY = projected.height / tier.frameH;
  const averageScale = (scaleX + scaleY) / 2;
  const integerScale = Math.max(1, Math.round(averageScale));
  const integerError = Math.max(
    Math.abs(scaleX - integerScale),
    Math.abs(scaleY - integerScale),
  );
  const aspectError = Math.abs(Math.log(scaleX / scaleY));
  const nativeError = Math.abs(Math.log(averageScale));
  const pixelPerfect = integerError <= INTEGER_SCALE_EPSILON;

  // Exact 1x/2x/3x presentation wins. Otherwise prefer the source requiring
  // the least resampling while lightly penalizing aspect distortion.
  const score = pixelPerfect
    ? integerError + aspectError + integerScale * 0.001
    : 1 + nativeError + aspectError * 2;
  return { ...tier, scaleX, scaleY, integerScale, pixelPerfect, score };
}

export function chooseActorRuntimeTier(
  projected,
  tiers = ACTOR_RUNTIME_ATLASES,
) {
  const safeProjected = {
    width: finitePositive(projected?.width),
    height: finitePositive(projected?.height),
  };
  return tiers
    .map((tier) => tierFit(tier, safeProjected))
    .sort((a, b) => a.score - b.score || a.frameH - b.frameH)[0];
}

export function shouldSmoothActorTier(selection) {
  return !selection?.pixelPerfect;
}

export function postFXPixelRatio(devicePixelRatio) {
  return Math.min(MAX_POSTFX_DPR, finitePositive(devicePixelRatio));
}

