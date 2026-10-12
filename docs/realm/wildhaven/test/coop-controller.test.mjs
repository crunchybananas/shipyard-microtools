import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop } from '../js/coop.js';
import { coopId, ensureCoop, newRoom, deliveryChange } from '../js/coop-state.js';
import { createGame } from '../js/sim.js';

test('a delivery clicked during a background refresh waits instead of disappearing', async () => {
  const state = createGame(), c = ensureCoop(state), uid = coopId(), roomId = coopId();
  c.link = { uid, roomId, name: 'Alder' };
  let room = { ...newRoom({ uid, townId: c.townId, name: 'Alder', invite: coopId() }), guest: coopId(), guestTown: coopId(), guestName: 'Willow' };
  let release, first = true, sends = 0, writes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const remote = {
    profile: async () => { if (first) { first = false; await gate; } return { data: { roomId, townId: c.townId } }; },
    room: async () => room,
    deliver: async (id, townId, pending) => { sends++; const next = deliveryChange(room, uid, townId, pending); room = next.room; return next.receipt; }
  };
  const oldDocument = globalThis.document; globalThis.document = { hidden: false };
  try {
    const coop = createCoop({ config: { apiKey: 'test' }, auth: { user: { uid } }, remote,
      getState: () => state, canUse: () => true, save: () => { writes++; return { ok: true }; } });
    const initial = state.resources.wood;
    const poll = coop.tick();
    const send = coop.contribute({ wood: 10, stone: 0, food: 0 });
    assert.equal(sends, 0); release();
    await Promise.all([poll, send]);
    assert.equal(sends, 1); assert.equal(state.resources.wood, initial - 10);
    assert.equal(room.totals.wood, 10); assert.equal(state.coop.pending, null); assert.equal(writes, 2);
  } finally { globalThis.document = oldDocument; }
});

test('an outstanding response cannot write into a different town after switching away', async () => {
  let state = createGame(), available = true, writes = 0, release;
  const original = state, uid = coopId(), c = ensureCoop(state), roomId = coopId();
  c.link = { uid, roomId, name: 'Alder' };
  const gate = new Promise(resolve => { release = resolve; });
  const coop = createCoop({ config: { apiKey: 'test' }, auth: { user: { uid } },
    remote: { profile: () => gate }, getState: () => state, canUse: () => available, save: () => { writes++; return { ok: true }; } });
  const pending = coop.reconnect(); state = createGame(); available = false;
  release({ data: { roomId, townId: c.townId } }); await pending;
  assert.equal(writes, 0); assert.equal(state.coop, undefined); assert.equal(original.coop.link.roomId, roomId);
});
