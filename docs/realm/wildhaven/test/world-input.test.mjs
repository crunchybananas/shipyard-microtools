import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const threeURL = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'three') return { url: ${JSON.stringify(threeURL)}, shortCircuit: true }; return next(specifier, context); }`));
const { VillageWorld } = await import('../js/world.js');

function input() {
  const canvas = new EventTarget(); canvas.setPointerCapture = () => {};
  const taps = [], hovers = [], pans = [], zooms = [];
  const world = Object.create(VillageWorld.prototype);
  Object.assign(world, { canvas, zoom: 20, height: 800, pick: (x, z) => ({ x, z }),
    onTap: (...args) => taps.push(args), onHover: (...args) => hovers.push(args),
    moveCamera: (...args) => pans.push(args), zoomBy: value => zooms.push(value) });
  world.bindInput();
  const send = (type, pointerId = 1, x = 10, y = 10, pointerType = 'touch') => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId, clientX: x, clientY: y, pointerType, button: 0 }); canvas.dispatchEvent(event);
  };
  return { world, taps, hovers, pans, zooms, send };
}

test('stationary taps and hover expose the actual pointer type for staged touch placement', () => {
  const { taps, hovers, send } = input();
  for (const [i, pointerType] of ['mouse', 'touch', 'pen'].entries()) {
    send('pointerdown', i, 12, 34, pointerType); send('pointermove', i, 12, 34, pointerType);
    send('pointerup', i, 12, 34, pointerType); send('lostpointercapture', i);
    assert.deepEqual(taps[i], [{ x: 12, z: 34 }, { pointerType }]);
    assert.equal(hovers[i][1].pointerType, pointerType);
  }
});

test('unexpected capture loss or pointer cancellation cannot turn a later release into a tap', () => {
  for (const cancellation of ['lostpointercapture', 'pointercancel']) {
    const { world, taps, send } = input();
    send('pointerdown'); send(cancellation); send('pointerup');
    assert.equal(taps.length, 0, cancellation); assert.equal(world.pointers.size, 0);
    send('pointerdown', 2); send('pointerup', 2);
    assert.equal(taps.length, 1, 'The next independent gesture still works');
  }
});

test('pinch release keeps the remaining pointer tracked and never emits a placement tap', () => {
  const { world, taps, zooms, send } = input();
  send('pointerdown', 1, 10, 10); send('pointerdown', 2, 100, 10);
  send('pointermove', 2, 150, 10); assert.ok(zooms.length);
  send('pointerup', 2, 150, 10); send('lostpointercapture', 2, 150, 10);
  assert.equal(world.pointers.size, 1, 'Normal release of one finger must not cancel the other pointer');
  send('pointerup', 1); send('lostpointercapture', 1);
  assert.equal(taps.length, 0); assert.equal(world.pointers.size, 0);
  send('pointerdown', 3); send('pointerup', 3); assert.equal(taps.length, 1);
});

test('dragging pans but cannot tap, including capture loss during the drag', () => {
  const { taps, pans, send } = input();
  send('pointerdown'); send('pointermove', 1, 70, 55); assert.equal(pans.length, 1);
  send('lostpointercapture'); send('pointerup', 1, 70, 55); assert.equal(taps.length, 0);
});
