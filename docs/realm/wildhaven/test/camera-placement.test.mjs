import test from 'node:test';
import assert from 'node:assert/strict';
import { wheelZoom, pinchZoom } from '../js/camera-input.js';
import { placementInfoPosition } from '../js/placement-layout.js';

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
test('placement card sits above the actual roof and clamps to screen edge', () => {
  const viewport={left:12,top:100,right:1000,bottom:700},size={width:280,height:100};
  const p=placementInfoPosition({left:900,right:980,top:300,bottom:440},size,viewport);
  assert.equal(p.side,'above'); assert.equal(p.right,1000);assert.ok(p.bottom<300);
});
test('placement card clears roofs near top edge and other HUD controls', () => {
  const viewport={left:12,top:100,right:1000,bottom:700},size={width:280,height:100};
  const target={left:500,right:600,top:110,bottom:220};
  const p=placementInfoPosition(target,size,viewport,[{left:12,top:100,right:490,bottom:250}]);
  assert.equal(p.side,'right');assert.ok(p.left>target.right);
});
test('narrow touch screen uses clear lower space without overlaying the plan', () => {
  const target={left:110,right:280,top:165,bottom:300};
  const p=placementInfoPosition(target,{width:260,height:110},{left:12,top:145,right:378,bottom:690});
  assert.equal(p.side,'below');assert.ok(p.top>target.bottom);assert.ok(p.left>=12&&p.right<=378);
});
test('an impossibly small clear area hides information rather than covering the plan', () => {
  assert.equal(placementInfoPosition({left:0,right:200,top:0,bottom:200},{width:180,height:80},{left:0,top:0,right:200,bottom:200}),null);
});
test('phone card can shift sideways below a roof to clear the camera toolbar', () => {
  const target={left:222,right:268,top:305,bottom:365};
  const p=placementInfoPosition(target,{width:260,height:124},{left:12,top:188,right:378,bottom:696},[{left:334,right:378,top:188,bottom:476}]);
  assert.equal(p.side,'below');assert.equal(p.top,377);assert.ok(p.right<334);
});
