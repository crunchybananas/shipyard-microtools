import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, build, tick, serialize, restore } from '../js/sim.js';

test('earned construction history survives repeated returns without replaying rewards', () => {
  let state = createGame();
  assert.equal(build(state, 'cottage', -2, 0).ok, true);
  tick(state, 25);
  const journal = structuredClone(state.events), resources = structuredClone(state.resources);
  assert.ok(journal.some(event => event.type === 'complete'));
  for (let i = 0; i < 6; i++) {
    const loaded = restore(serialize(state));
    assert.ok(loaded);
    assert.deepEqual(loaded.events, journal);
    assert.deepEqual(loaded.resources, resources);
    assert.equal(loaded.elapsed, state.elapsed);
    state = loaded;
  }
  const next = state.nextEventId;
  assert.equal(build(state, 'garden', -3, 1).ok, true);
  assert.equal(state.events[0].id, next);
  assert.deepEqual(state.events.slice(1), journal);
});

test('optional malformed journal records do not discard an otherwise valid town', () => {
  const original = createGame(), raw = JSON.parse(serialize(original));
  raw.events = [
    { id: 12, day: 1, text: 'Finn brought the waystone story home.', type: 'field-report', reward: { gold: 10000 } },
    { id: 12, day: 1, text: 'Duplicate record', type: 'info' },
    { id: 11, day: 2, text: 'Future record', type: 'info' },
    { id: 10, day: 1, text: 'x'.repeat(641), type: 'info' },
    { id: 9, day: 1, text: 'bad\u0000text', type: 'info' },
    { id: 8, day: 1, text: 'A remembered first roof.', type: { unexpected: true } },
    null, 'not a record', { id: Infinity, day: 1, text: 'Invalid ID' },
  ];
  raw.nextEventId = -50;
  const loaded = restore(raw);
  assert.ok(loaded);
  assert.deepEqual(loaded.events, [
    { id: 12, day: 1, text: 'Finn brought the waystone story home.', type: 'field-report' },
    { id: 8, day: 1, text: 'A remembered first roof.', type: 'info' },
  ]);
  assert.equal(loaded.nextEventId, 13);
  assert.deepEqual(loaded.resources, original.resources);
  assert.deepEqual(raw.events[0].reward, { gold: 10000 }, 'input was not mutated');
});

test('history is bounded, newest first, and cannot acquire duplicate IDs after return', () => {
  const raw = JSON.parse(serialize(createGame()));
  raw.events = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, day: 1, text: `Milestone ${i + 1}`, type: 'info' }));
  raw.nextEventId = 2;
  const loaded = restore(raw);
  assert.ok(loaded);
  assert.equal(loaded.events.length, 60);
  assert.equal(loaded.events[0].id, 100);
  assert.equal(loaded.events.at(-1).id, 41);
  assert.equal(loaded.nextEventId, 101);
  assert.equal(build(loaded, 'cottage', -2, 0).ok, true);
  assert.equal(loaded.events.length, 60);
  assert.equal(new Set(loaded.events.map(event => event.id)).size, 60);
});

test('older saves without journal fields still restore without invented milestones', () => {
  const raw = JSON.parse(serialize(createGame()));
  delete raw.events;
  delete raw.nextEventId;
  const loaded = restore(raw);
  assert.ok(loaded);
  assert.deepEqual(loaded.events, []);
  assert.equal(loaded.nextEventId, 1);
  assert.deepEqual(loaded.resources, raw.resources);
});
