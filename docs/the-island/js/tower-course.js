// One stair course for Blender geometry, movement, captures and route verification.
// The generator reads the JSON object between these markers.
export const TOWER = Object.freeze(
// layout:start
{"x":-85,"z":-40,"base":13.5,"rise":20.6,"steps":83,"turns":3.5,"startDegrees":200,"radiusBottom":2.42,"radiusTop":1.64,"halfWidth":0.58}
// layout:end
);
const TAU = Math.PI * 2;
export const TOWER_TOP = TOWER.base + TOWER.rise;
export function stairPose(t) {
  t = Math.max(0, Math.min(1, t));
  const angle = TOWER.startDegrees * Math.PI / 180 + t * TOWER.turns * TAU;
  const radius = TOWER.radiusBottom + (TOWER.radiusTop - TOWER.radiusBottom) * t;
  return { x: TOWER.x + Math.sin(angle) * radius, z: TOWER.z + Math.cos(angle) * radius,
    y: TOWER.base + t * TOWER.rise, yaw: angle - Math.PI / 2, angle, radius };
}
export function stairSurface(x, z, fromY, margin = 0) {
  if (!Number.isFinite(fromY) || fromY < TOWER.base - .5 || fromY > TOWER_TOP + .5) return null;
  const angle = Math.atan2(x - TOWER.x, z - TOWER.z);
  const radius = Math.hypot(x - TOWER.x, z - TOWER.z);
  const start = TOWER.startDegrees * Math.PI / 180, sweep = TOWER.turns * TAU;
  const expected = start + (fromY - TOWER.base) / TOWER.rise * sweep;
  const unwrapped = angle + Math.round((expected - angle) / TAU) * TAU;
  const t = (unwrapped - start) / sweep;
  if (t < -.003 || t > 1.003) return null;
  const clamped = Math.max(0, Math.min(1, t));
  const r = TOWER.radiusBottom + (TOWER.radiusTop - TOWER.radiusBottom) * clamped;
  if (Math.abs(radius - r) > TOWER.halfWidth - margin) return null;
  const y = TOWER.base + Math.ceil(clamped * TOWER.steps - 1e-7) / TOWER.steps * TOWER.rise;
  return Math.abs(y - fromY) < 1.05 ? y : null;
}
