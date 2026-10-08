const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Wheel events may be pixels, lines or pages. Keep equal gestures consistent
// at every map scale, while bounding unusual device deltas.
export function wheelZoom(current, delta, mode = 0, viewportHeight = 800, min = 10, max = 180) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? viewportHeight : 1);
  if (!Number.isFinite(pixels)) return current;
  return clamp(current * Math.exp(clamp(pixels * .0025, -.6, .6)), min, max);
}

export function pinchZoom(current, previousDistance, distance, min = 10, max = 180) {
  if (!(previousDistance > 0 && distance > 0)) return current;
  return clamp(current * clamp(previousDistance / distance, .6, 1 / .6), min, max);
}
