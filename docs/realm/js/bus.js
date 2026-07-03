// ════════════════════════════════════════════════════════════
// Event bus — the core → shell boundary (ENGINE.md rule 4).
//
// Core systems emit facts ('sfx', 'notify', 'raid-started', 'victory',
// 'era-advanced', 'realm-event', 'season-changed', 'scenario-won', …);
// shell modules subscribe and render/play/pan. Headless runs (Node
// determinism harness, future server) have zero subscribers and the
// core neither knows nor cares.
//
// Synchronous fan-out on purpose: subscribers run inside the tick that
// emitted, so shell feedback stays frame-accurate. Subscriber errors
// are contained — a broken toast must never kill the simulation.
// ════════════════════════════════════════════════════════════

const _subs = new Map();

export function on(type, fn) {
  if (!_subs.has(type)) _subs.set(type, []);
  _subs.get(type).push(fn);
  return fn;
}

export function off(type, fn) {
  const list = _subs.get(type);
  if (!list) return;
  const i = list.indexOf(fn);
  if (i >= 0) list.splice(i, 1);
}

export function emit(type, payload) {
  const list = _subs.get(type);
  if (!list) return;
  for (const fn of list) {
    try { fn(payload); } catch (e) { console.error(`[bus] '${type}' subscriber failed:`, e); }
  }
}
