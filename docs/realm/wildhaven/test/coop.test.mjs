import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, restore, serialize, storageCapacity } from '../js/sim.js';
import { COOP_COST, newRoom, deliveryChange, ensureCoop, reserveDelivery, settleDelivery, claimStorehouse } from '../js/coop-state.js';
const owner = 'owner012345678901234567890', guest = 'guest012345678901234567890';
const townA = 'townA012345678901234567890', townB = 'townB012345678901234567890';
function pair() { const r = newRoom({ uid: owner, townId: townA, name: 'Birch town', invite: 'invite012345678901234567890' }); Object.assign(r, { guest, guestTown: townB, guestName: 'Willow town' }); return r; }
function town() { const s = createGame(); ensureCoop(s); s.coop.townId = townA; s.coop.link = { roomId: 'room012345678901234567890', uid: owner, name: 'Birch town' }; Object.assign(s.resources, { wood: 60, stone: 100, food: 100 }); return s; }
const saved = () => ({ ok: true });
test('reservation is durable with the inventory and survives restore', () => {
  const s = town(); let raw; const result = reserveDelivery(s, { wood: 20, stone: 10, food: 5 }, state => { raw = serialize(state); return saved(); });
  assert.ok(result.ok); const loaded = restore(raw); assert.equal(loaded.resources.wood, 40); assert.deepEqual(loaded.coop, s.coop);
});
test('save failure rolls back a reservation before any network submission', () => {
  const s = town(), before = structuredClone(s.resources); assert.equal(reserveDelivery(s, COOP_COST, () => ({ ok: false })).ok, false);
  assert.deepEqual(s.resources, before); assert.equal(s.coop.pending, null);
});
test('concurrent last deliveries accept only what is still needed and refund the rest once', () => {
  const s = town(), r = pair(); reserveDelivery(s, { wood: 30, stone: 20, food: 20 }, saved);
  const first = deliveryChange(r, guest, townB, { id: 'first012345678901234567890', sequence: 1, requested: { wood: 50, stone: 30, food: 30 } });
  const second = deliveryChange(first.room, owner, townA, s.coop.pending); assert.deepEqual(second.receipt.accepted, { wood: 10, stone: 10, food: 10 }); assert.ok(second.room.completed);
  assert.ok(settleDelivery(s, second.receipt, saved).ok); assert.equal(s.resources.wood, 50); const inventory = structuredClone(s.resources);
  settleDelivery(s, second.receipt, saved); assert.deepEqual(s.resources, inventory);
});
test('failed receipt save can be retried without losing refunds', () => {
  const s = town(), r = pair(); r.closed = true; reserveDelivery(s, { wood: 10, stone: 0, food: 0 }, saved);
  const receipt = deliveryChange(r, owner, townA, s.coop.pending).receipt;
  assert.equal(settleDelivery(s, receipt, () => ({ ok: false })).ok, false); assert.equal(s.resources.wood, 50); assert.ok(s.coop.pending);
  assert.ok(settleDelivery(s, receipt, saved).ok); assert.equal(s.resources.wood, 60);
});
test('old saves cannot spend again after another device advanced the delivery sequence', () => {
  const s = town(), r = pair(); reserveDelivery(s, { wood: 10, stone: 0, food: 0 }, saved); r.sequence.owner = 1;
  assert.throws(() => deliveryChange(r, owner, townA, s.coop.pending), /older/);
});
test('completion benefit persists, is not multiplied by retries, and survives leaving', () => {
  const s = town(), r = pair(); r.totals = { ...COOP_COST }; r.completed = true; const before = storageCapacity(s);
  claimStorehouse(s, r, owner, saved); claimStorehouse(s, r, owner, saved); assert.equal(storageCapacity(s).wood, before.wood + 20);
  s.coop.link = null; const loaded = restore(serialize(s)); assert.equal(storageCapacity(loaded).wood, before.wood + 20);
  assert.equal(storageCapacity(loaded).knowledge, before.knowledge);
});
test('a forged or mismatched receipt never releases reserved supplies', () => {
  const s = town(); reserveDelivery(s, { wood: 10, stone: 0, food: 0 }, saved);
  const receipt = deliveryChange(pair(), owner, townA, s.coop.pending).receipt; receipt.uid = guest;
  assert.equal(settleDelivery(s, receipt, saved).ok, false); assert.ok(s.coop.pending); assert.equal(s.resources.wood, 50);
});
test('malformed co-op journals reject the save instead of forgetting paid supplies', () => {
  const s = town(); reserveDelivery(s, { wood: 10, stone: 0, food: 0 }, saved); s.coop.pending.requested.wood = -5;
  assert.equal(restore(serialize(s)), null);
});

test('a newer confirmed backup can recover an obsolete reservation, but unrelated or older backups cannot', async () => {
  const { canImportCoop, ensureCoop, coopId } = await import('../js/coop-state.js');
  const state = createGame(), c = ensureCoop(state);
  c.link = { uid: coopId(), roomId: coopId(), name: 'Alder' };
  c.pending = { id: coopId(), requested: { wood: 10, stone: 0, food: 0 }, sequence: 1 };
  const latest = structuredClone(state); latest.coop.pending = null; latest.coop.sequence = 1;
  assert.ok(canImportCoop(state, latest).ok);
  const older = structuredClone(latest); older.coop.sequence = 0;
  assert.equal(canImportCoop(state, older).ok, false);
  const unrelated = structuredClone(latest); unrelated.coop.townId = coopId();
  assert.equal(canImportCoop(state, unrelated).ok, false);
  const otherRoom = structuredClone(latest); otherRoom.coop.link.roomId = coopId();
  assert.equal(canImportCoop(state, otherRoom).ok, false);
});
