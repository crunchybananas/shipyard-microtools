// Presentation history is deliberately outside the save and authoritative units.
// Draw only between completed simulation steps; never predict through a wall.
export const FRONTIER_STEP = .25;
const history = new WeakMap();
const point = u => ({ x:u.x, z:u.z, yaw:u.yaw||0, garrisoned:!!u.garrisoned, status:u.status });
export const captureUnitMotion = units => new Map(units.map(u => [u, point(u)]));
export function recordUnitMotion(units, before, clock) {
  for (const unit of units) history.set(unit, { from:before.get(unit)||point(unit), to:point(unit), clock });
}
export const angleBetween = (from, to) => Math.atan2(Math.sin(to-from), Math.cos(to-from));
export function sampleUnitMotion(unit, frontier) {
  const current = point(unit), frame = history.get(unit);
  // Loads, spawns, deployment from quarters and explicit relocations start here.
  if (!frame || frame.clock !== frontier.clock || frame.to.x !== unit.x || frame.to.z !== unit.z ||
      frame.to.garrisoned !== current.garrisoned || frame.from.garrisoned !== current.garrisoned ||
      frame.from.status === 'dead' || current.status === 'dead' ||
      Math.hypot(frame.to.x-frame.from.x, frame.to.z-frame.from.z) > 1) return { ...current, reset:true };
  const alpha = Math.max(0, Math.min(1, (frontier.subsecond||0)/FRONTIER_STEP));
  return { x:frame.from.x+(current.x-frame.from.x)*alpha, z:frame.from.z+(current.z-frame.from.z)*alpha,
    yaw:frame.from.yaw+angleBetween(frame.from.yaw, current.yaw)*alpha, reset:false };
}
// Distance drives footfalls. The weight settles the legs when yielding or stopping.
export function stride(actor, distance, dt, reset=false) {
  actor.walkWeight ??= 0;
  if (reset) { actor.walkWeight=0; return 0; }
  if (dt > 0) {
    actor.phase += distance*10;
    const target = Math.min(1, distance/Math.max(.001, dt*.35));
    actor.walkWeight += (target-actor.walkWeight)*(1-Math.exp(-dt*18));
  }
  return Math.sin(actor.phase)*actor.walkWeight;
}
