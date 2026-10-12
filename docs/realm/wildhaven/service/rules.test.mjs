import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoopTransport } from '../js/coop-transport.js';
import { coopId, COOP_COST, deliveryChange } from '../js/coop-state.js';
// Emulator-only unsigned Firebase tokens. Production never accepts these.
const token = uid => `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ iss: 'https://securetoken.google.com/demo-island-coop', aud: 'demo-island-coop', sub: uid, user_id: uid, iat: 0, exp: 9999999999, firebase: { sign_in_provider: 'password', identities: {} } })).toString('base64url')}.`;
const client = uid => createCoopTransport({ projectId: 'demo-island-coop', firestoreEndpoint: 'http://127.0.0.1:8085/v1' }, { user: { uid }, token: async () => token(uid) });
const denied = fn => assert.rejects(fn, e => e.code === 'PERMISSION_DENIED');
test('private pair, atomic progress, concurrency, revocation and closed-room recovery', async () => {
  const owner = coopId(), guest = coopId(), stranger = coopId(), roomId = coopId(), townA = coopId(), townB = coopId(), invite = coopId();
  const a = client(owner), b = client(guest), c = client(stranger);
  await a.create({ roomId, uid: owner, townId: townA, name: 'Birch town', invite });
  await denied(() => b.room(roomId));
  await denied(() => c.join({ roomId, invite: coopId(), townId: coopId(), name: 'Intruder' }));
  await b.join({ roomId, invite, townId: townB, name: 'Willow town' });
  assert.equal((await a.room(roomId)).guest, guest);
  await denied(() => c.join({ roomId, invite, townId: coopId(), name: 'Third town' }));
  await denied(() => c.room(roomId));
  await denied(() => a.commit([a.write(`rooms/${roomId}`, { totals: { ...COOP_COST }, completed: true }, { fields: ['totals','completed'], stamp: true })]));
  const p = { id: coopId(), requested: { wood: 40, stone: 30, food: 30 }, sequence: 1 };
  const q = { id: coopId(), requested: { wood: 40, stone: 30, food: 30 }, sequence: 1 };
  const [ar, br] = await Promise.all([a.deliver(roomId, townA, p), b.deliver(roomId, townB, q)]);
  for (const k of Object.keys(COOP_COST)) assert.equal(ar.accepted[k] + br.accepted[k], COOP_COST[k]);
  assert.deepEqual(await a.deliver(roomId, townA, p), ar);
  const completed = await b.room(roomId); assert.ok(completed.completed); assert.equal(completed.revision, 2);
  await denied(() => b.commit([b.write(`rooms/${roomId}/receipts/${owner}_${p.id}`, { accepted: { wood: 0, stone: 0, food: 0 } }, { fields: ['accepted'] })]));
  await denied(() => b.commit([{ delete: `projects/demo-island-coop/databases/(default)/documents/rooms/${roomId}` }]));
  await a.close(roomId);
  const zero = await b.deliver(roomId, townB, { id: coopId(), requested: { wood: 10, stone: 0, food: 0 }, sequence: 2 }); assert.equal(zero.accepted.wood, 0);
  const nextRoom = coopId(), nextInvite = coopId();
  await a.create({ roomId: nextRoom, uid: owner, townId: townA, name: 'Birch town', invite: nextInvite });
  await a.invitation(nextRoom, '');
  await denied(() => b.join({ roomId: nextRoom, invite: nextInvite, townId: townB, name: 'Willow town' }));
  await a.invitation(nextRoom, invite);
  await b.join({ roomId: nextRoom, invite, townId: townB, name: 'Willow town' });
  assert.equal((await b.profile()).data.roomId, nextRoom);
});

test('forged receipts, malformed deliveries and membership bypasses are rejected', async () => {
  const owner = coopId(), guest = coopId(), roomId = coopId(), townA = coopId(), townB = coopId(), invite = coopId();
  const a = client(owner), b = client(guest);
  await a.create({ roomId, uid: owner, townId: townA, name: 'Alder', invite });
  await b.join({ roomId, invite, townId: townB, name: 'Birch' });
  await denied(() => a.create({ roomId: coopId(), uid: owner, townId: coopId(), name: 'Duplicate', invite: coopId() }));
  const room = await a.room(roomId);
  const pending = { id: coopId(), requested: { wood: 10, stone: 0, food: 0 }, sequence: 1 };
  const change = deliveryChange(room, owner, townA, pending);
  const writes = (r, receipt) => [
    a.write(`rooms/${roomId}`, r, { fields: ['totals','supplied','sequence','completed','revision','lastOperation','lastActor'], stamp: true }),
    a.write(`rooms/${roomId}/receipts/${owner}_${pending.id}`, receipt, { precondition: { exists: false } })
  ];
  await denied(() => a.commit([writes(change.room, change.receipt)[1]]));
  for (const mutate of [
    (r,p) => { p.requested.wood = -1; },
    (r,p) => { p.requested.wood = 61; },
    (r,p) => { p.accepted.wood = 11; },
    (r,p) => { p.uid = guest; },
    (r,p) => { p.townId = townB; },
    (r,p) => { p.sequence = 2; },
    (r,p) => { p.extra = true; },
    r => { r.totals.extra = 1; },
    r => { r.supplied.owner.extra = 1; },
    r => { r.supplied.guest.wood = 10; },
    r => { r.sequence.guest = 1; },
    r => { r.completed = true; }
  ]) {
    const copy = structuredClone(change); mutate(copy.room, copy.receipt);
    await denied(() => a.commit(writes(copy.room, copy.receipt)));
  }
  assert.equal((await a.room(roomId)).revision, 0);
  await a.deliver(roomId, townA, pending);
  await denied(() => b.get(`rooms/${roomId}/receipts/${owner}_${pending.id}`));
  await a.close(roomId);
  await denied(() => a.commit([a.write(`rooms/${roomId}`, { closed: false }, { fields: ['closed'], stamp: true })]));
  const endpoint = 'http://127.0.0.1:8085/v1/projects/demo-island-coop/databases/(default)/documents';
  assert.equal((await fetch(`${endpoint}/rooms/${roomId}`)).status, 403);
  assert.equal((await fetch(`${endpoint}/rooms`, { headers: { Authorization: `Bearer ${token(owner)}` } })).status, 403);
});

test('a lost commit response can be recovered from a reloaded town without charging twice', async () => {
  const { createGame, serialize, restore } = await import('../js/sim.js');
  const { ensureCoop, reserveDelivery, settleDelivery } = await import('../js/coop-state.js');
  const owner = coopId(), guest = coopId(), roomId = coopId(), invite = coopId();
  const a = client(owner), b = client(guest), state = createGame(), c = ensureCoop(state);
  c.link = { uid: owner, roomId, name: 'Alder' };
  await a.create({ roomId, uid: owner, townId: c.townId, name: 'Alder', invite });
  await b.join({ roomId, invite, townId: coopId(), name: 'Birch' });
  let durable; const save = s => { durable = serialize(s); return { ok: true }; };
  assert.ok(reserveDelivery(state, { wood: 30, stone: 0, food: 0 }, save).ok);
  const realFetch = globalThis.fetch; let dropped = false;
  globalThis.fetch = async (url, options) => {
    const response = await realFetch(url, options);
    if (String(url).endsWith(':commit') && response.ok && !dropped) { dropped = true; throw new TypeError('Simulated lost response after commit'); }
    return response;
  };
  try { await assert.rejects(a.deliver(roomId, c.townId, c.pending), e => e.code === 'OFFLINE'); }
  finally { globalThis.fetch = realFetch; }
  assert.ok(dropped); assert.ok(state.coop.pending);
  const reloaded = restore(durable), before = reloaded.resources.wood;
  const receipt = await client(owner).deliver(roomId, reloaded.coop.townId, reloaded.coop.pending);
  assert.ok(settleDelivery(reloaded, receipt, save).ok);
  assert.equal(reloaded.resources.wood, before);
  assert.equal(reloaded.coop.pending, null);
  assert.equal((await a.room(roomId)).totals.wood, 30);
  assert.equal((await a.room(roomId)).sequence.owner, 1);
});
