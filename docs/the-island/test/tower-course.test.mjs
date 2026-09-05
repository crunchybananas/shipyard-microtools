import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, TOWER_TOP, stairPose, stairSurface } from '../js/tower-course.js';

test('83 physical treads form a connected course in both directions', () => {
  for (const reverse of [false, true]) {
    let y = reverse ? TOWER_TOP : TOWER.base;
    for (let i = 0; i <= 1660; i++) {
      const t = reverse ? 1 - i / 1660 : i / 1660;
      const p = stairPose(t), next = stairSurface(p.x, p.z, y, .12);
      assert.notEqual(next, null, `disconnected at ${t}`);
      assert.ok(Math.abs(next - y) < .26);
      y = next;
    }
    assert.ok(Math.abs(y - (reverse ? TOWER.base : TOWER_TOP)) < 1e-6);
  }
});
test('overlapping flights never pull a player through the floor above', () => {
  for (const t of [.08, .32, .61, .89]) {
    const p = stairPose(t);
    assert.ok(Math.abs(stairSurface(p.x, p.z, p.y) - p.y) < .25);
    assert.equal(stairSurface(p.x, p.z, 0), null);
    assert.equal(stairSurface(TOWER.x, TOWER.z, p.y), null);
  }
});
test('an approach outside the stair and the gallery does not invent a floor', () => {
  assert.equal(stairSurface(TOWER.x + 5, TOWER.z, 25), null);
  assert.equal(stairSurface(TOWER.x, TOWER.z + 2, undefined), null);
});
