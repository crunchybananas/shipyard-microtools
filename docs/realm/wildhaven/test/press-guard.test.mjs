import test from 'node:test';
import assert from 'node:assert/strict';
import { createPressGuard } from '../js/press-guard.js';

class Events {
  listeners = new Map();
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  fire(type, event = {}) { for (const fn of [...this.listeners.get(type) || []]) fn(event); }
}
function fixture() {
  const document = new Events(), window = new Events(), root = new Events();
  document.defaultView = window; root.ownerDocument = document;
  const control = { disabled: false, closest: () => control }, plain = { closest: () => null };
  root.contains = node => node === control;
  let now = 0, id = 0, releases = 0; const timers = new Map();
  const guard = createPressGuard(root, { onRelease: () => releases++, schedule: (fn, delay) => { const key = ++id; timers.set(key, { at: now + delay, fn }); return key; }, unschedule: key => timers.delete(key) });
  function advance(ms) {
    now += ms;
    for (;;) { const next = [...timers].find(([, timer]) => timer.at <= now); if (!next) break; timers.delete(next[0]); next[1].fn(); }
  }
  const down = (pointerId = 1, target = control, button = 0) => root.fire('pointerdown', { pointerId, target, button });
  const send = (type, pointerId = 1) => document.fire(type, { pointerId });
  return { document, window, root, control, plain, guard, down, send, advance, get releases() { return releases; } };
}

test('a held control survives pointerup and normal capture loss through its one native click', () => {
  const f = fixture(); let actions = 0;
  f.down(); f.advance(1200); assert.equal(f.guard.held, true);
  f.send('pointerup'); f.send('lostpointercapture'); f.advance(100);
  assert.equal(f.guard.held, true, 'Native touch click can arrive after pointerup');
  actions++; // The browser calls the actual control handler, not the guard.
  assert.equal(f.guard.held, true, 'The native handler can explicitly force its own render');
  f.send('click'); assert.equal(f.guard.held, false); assert.equal(f.releases, 0);
  f.advance(0); assert.equal(f.releases, 1); f.advance(1000);
  assert.equal(f.releases, 1); assert.equal(actions, 1, 'Release never replays an action');
});
test('pointer cancellation and unexpected capture loss release the hold without an action', () => {
  for (const event of ['pointercancel', 'lostpointercapture']) {
    const f = fixture(); f.down(); f.send(event); assert.equal(f.guard.held, false);
    f.advance(0); assert.equal(f.releases, 1);
    f.send('pointerup'); f.send('click'); f.advance(1000); assert.equal(f.releases, 1);
    f.down(2); assert.equal(f.guard.held, true, 'A new independent press is protected');
  }
});
test('scroll text, disabled controls and secondary mouse presses do not hold live updates', () => {
  const f = fixture(); f.down(1, f.plain); assert.equal(f.guard.held, false);
  f.control.disabled = true; f.down(); assert.equal(f.guard.held, false);
  f.control.disabled = false; f.down(1, f.control, 2); assert.equal(f.guard.held, false);
  f.advance(1000); assert.equal(f.releases, 0);
});
test('native touch scrolling cancels promptly and releasing one of two pointers keeps the other protected', () => {
  const f = fixture(); f.down(1); f.down(2);
  f.send('pointercancel', 1); assert.equal(f.guard.held, true);
  f.send('pointercancel', 2); assert.equal(f.guard.held, false);
  f.advance(0); assert.equal(f.releases, 1, 'No delay survives a scroll cancellation');
});
test('an outside release without click has a bounded hold and never needs a second user action', () => {
  const f = fixture(); f.down(); f.send('pointerup'); f.advance(499); assert.equal(f.guard.held, true);
  f.advance(1); assert.equal(f.guard.held, false); assert.equal(f.releases, 1);
});
test('blur, hiding the document, explicit reset and disposal cannot leave a stuck hold', () => {
  const f = fixture(); f.down(); f.window.fire('blur'); assert.equal(f.guard.held, false); f.advance(0);
  f.down(); f.document.hidden = true; f.send('visibilitychange'); assert.equal(f.guard.held, false); f.advance(0);
  assert.equal(f.releases, 2);
  f.down(); f.send('pointerup'); f.guard.reset(); f.advance(1000); assert.equal(f.releases, 2);
  f.down(); f.guard.dispose(); assert.equal(f.guard.held, false); f.down(); f.advance(1000);
  assert.equal(f.guard.held, false); assert.equal(f.releases, 2);
});
