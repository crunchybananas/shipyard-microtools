import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingClock } from '../js/reading-clock.js';
for(const speed of [1,3])test(`opening books holds ${speed}× and closing restores it`,()=>{
  const c=createReadingClock(speed);assert.equal(c.observe(true),0);assert.equal(c.held,true);
  assert.equal(c.observe(true),0);assert.equal(c.observe(false),speed);assert.equal(c.held,false);
});
test('a manually paused village stays paused after reading',()=>{
  const c=createReadingClock(0);c.observe(true);assert.equal(c.held,false);assert.equal(c.observe(false),0);
});
test('explicit run while open overrides the reading hold and survives closing',()=>{
  const c=createReadingClock(3);c.observe(true);c.choose(1);assert.equal(c.held,false);assert.equal(c.observe(true),1);assert.equal(c.observe(false),1);
  assert.equal(c.observe(true),0,'A later reading session pauses again');assert.equal(c.observe(false),1);
});
test('explicit pause during a reading hold must not auto-resume',()=>{
  const c=createReadingClock(1);c.observe(true);c.choose(0);assert.equal(c.observe(false),0);
});
test('changing towns clears the old village reading speed',()=>{
  const c=createReadingClock(3);c.observe(true);c.reset(0);assert.equal(c.observe(false),0);assert.equal(c.held,false);
});
