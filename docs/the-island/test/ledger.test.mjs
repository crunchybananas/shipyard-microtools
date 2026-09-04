// ledger.test.mjs — headless node tests for the stack's ledger (STACK.md §3.1/§3.2).
//
// Run:  node --test "docs/the-island/test/*.test.mjs"
//
// ledger.js is dependency-free for the same reason save-schema.js is: the whole
// contract — recording, inheritance, draft accumulation, and above all the
// SANITATION that slice 8's network marks will land in — is exercised here
// without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEDGER_VERSION, LEDGER_KEY, HAND_KEY, MARK_KINDS, FLAG_MARKS,
  MAX_MARKS_PER_RUNG, MAX_DRAFT, MAX_DISPOSITION_OPS,
  emptyLedger, record, marksAt, inheritedAt, evidenceAt, upstreamEventsAt,
  draftAt, tideFor, handsAbove,
  sanitizeLedger, packLedger, applyLedger, mergeLedgers, localSource, newHandId, loadHandId,
  DISPOSITIONS, dispose, boundaryAt,
} from '../js/ledger.js';

// ---------------- recording ---------------------------------------------------

test('record appends a costed act and returns the mark', () => {
  const led = emptyLedger();
  const m = record(led, { kind: 'valve', rung: 1, hand: 'aaaa', at: [1, 2, 3] });
  assert.ok(m);
  assert.equal(m.k, 'valve');
  assert.equal(m.r, 1);
  assert.equal(m.h, 'aaaa');
  assert.deepEqual(m.at, [1, 2, 3]);
  assert.equal(led.marks.length, 1);
});

test('an unknown kind records nothing — most flags are free', () => {
  const led = emptyLedger();
  assert.equal(record(led, { kind: 'readLetter', rung: 1, hand: 'a' }), null);
  assert.equal(record(led, { kind: 'enteredStudy', rung: 1, hand: 'a' }), null);
  assert.equal(led.marks.length, 0);
});

test('record is idempotent per (hand, rung, kind)', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  assert.equal(led.marks.length, 1, 'turning the valve forty times is one displacement');

  // ...but a different hand, or the same hand a rung down, is a new act
  record(led, { kind: 'valve', rung: 1, hand: 'b' });
  record(led, { kind: 'valve', rung: 2, hand: 'a' });
  assert.equal(led.marks.length, 3);
});

test('record rejects a non-positive rung', () => {
  const led = emptyLedger();
  assert.equal(record(led, { kind: 'valve', rung: 0, hand: 'a' }), null);
  assert.equal(record(led, { kind: 'valve', rung: -3, hand: 'a' }), null);
  assert.equal(led.marks.length, 0);
});

test('a bad position degrades to null rather than poisoning the mark', () => {
  const led = emptyLedger();
  const m = record(led, { kind: 'valve', rung: 1, hand: 'a', at: [1, NaN, 3] });
  assert.equal(m.at, null);
});

// ---------------- inheritance -------------------------------------------------

test('rung 1 inherits nothing — the surface has nobody upstream', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'dive', rung: 1, hand: 'a' });
  assert.deepEqual(inheritedAt(led, 1), []);
  assert.equal(draftAt(led, 1), 0);
});

test('a rung inherits every mark above it, shallowest first', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 2, hand: 'a' });
  record(led, { kind: 'ruler', rung: 1, hand: 'a' });
  record(led, { kind: 'lens', rung: 3, hand: 'a' });   // below — not inherited at 3

  const inh = inheritedAt(led, 3);
  assert.deepEqual(inh.map((m) => m.r), [1, 2]);
  assert.deepEqual(inh.map((m) => m.k), ['ruler', 'valve']);
});

test('marksAt is rung-scoped and excludes the rest of the stack', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'valve', rung: 2, hand: 'a' });
  assert.equal(marksAt(led, 2).length, 1);
  assert.equal(marksAt(led, 2)[0].r, 2);
});

test('evidenceAt shows only inherited kinds worth finding', () => {
  const led = emptyLedger();
  record(led, { kind: 'crank', rung: 1, hand: 'a' });   // evidence: false
  record(led, { kind: 'ruler', rung: 1, hand: 'a' });   // evidence: true
  const ev = evidenceAt(led, 2);
  assert.deepEqual(ev.map((m) => m.k), ['ruler']);
});

// ---------------- the draft ---------------------------------------------------

test('draft accumulates down the stack — the cost runs downhill', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });   // 0.030
  record(led, { kind: 'ruler', rung: 2, hand: 'a' });   // 0.022

  assert.equal(draftAt(led, 1), 0);
  assert.ok(Math.abs(draftAt(led, 2) - 0.030) < 1e-9);
  assert.ok(Math.abs(draftAt(led, 3) - 0.052) < 1e-9, 'rung 3 carries both rungs above it');
});

test('draft is capped so an old rung stays playable', () => {
  const led = emptyLedger();
  // many hands, all working rung 1 — far more displacement than MAX_DRAFT
  for (let i = 0; i < 40; i++) {
    for (const kind of Object.keys(MARK_KINDS)) {
      record(led, { kind, rung: 1, hand: 'h' + i });
    }
  }
  assert.equal(draftAt(led, 2), MAX_DRAFT);
});

test('tideFor adds the inherited draft to the rungs authored baseline', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  assert.ok(Math.abs(tideFor(led, 2, 1.35) - 1.38) < 1e-9);
  assert.equal(tideFor(led, 1, 1.0), 1.0, 'the surface is always the dry island');
});

test('tideFor survives a missing baseline', () => {
  assert.equal(tideFor(emptyLedger(), 1, undefined), 1);
  assert.equal(tideFor(emptyLedger(), 1, NaN), 1);
});

test('handsAbove counts distinct hands, not acts', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'ruler', rung: 1, hand: 'a' });
  record(led, { kind: 'valve', rung: 1, hand: 'b' });
  record(led, { kind: 'valve', rung: 4, hand: 'c' });   // below rung 2
  assert.equal(handsAbove(led, 2), 2);
});

// ---------------- retention ---------------------------------------------------

test('a rung keeps only its most recent marks', () => {
  const led = emptyLedger();
  const kinds = Object.keys(MARK_KINDS);
  for (let i = 0; i < 200; i++) {
    record(led, { kind: kinds[i % kinds.length], rung: 1, hand: 'h' + i });
  }
  assert.equal(marksAt(led, 1).length, MAX_MARKS_PER_RUNG);
});

test('pruning one rung does not touch another', () => {
  const led = emptyLedger();
  const kinds = Object.keys(MARK_KINDS);
  for (let i = 0; i < 200; i++) record(led, { kind: kinds[i % kinds.length], rung: 1, hand: 'h' + i });
  record(led, { kind: 'valve', rung: 2, hand: 'keep' });
  assert.equal(marksAt(led, 2).length, 1);
});

// ---------------- sanitation (the slice-8 contract) ---------------------------

test('sanitize never throws on garbage', () => {
  for (const bad of [null, undefined, 0, 'x', [], {}, { marks: 'no' }, { marks: [null, 7, 'x'] }]) {
    const led = sanitizeLedger(bad);
    assert.deepEqual(led.marks, []);
    assert.equal(led.v, LEDGER_VERSION);
  }
});

test('sanitize drops unknown kinds and absurd rungs', () => {
  const led = sanitizeLedger({
    marks: [
      { k: 'valve', r: 1, h: 'a', n: 0 },
      { k: 'DROP TABLE', r: 1, h: 'a', n: 1 },
      { k: 'valve', r: 0, h: 'b', n: 0 },
      { k: 'valve', r: 9999, h: 'c', n: 0 },
      { k: 'valve', r: 2, h: '', n: 0 },
    ],
  });
  assert.equal(led.marks.length, 1);
  assert.equal(led.marks[0].k, 'valve');
});

test('sanitize clamps hostile positions instead of dropping the mark', () => {
  const led = sanitizeLedger({ marks: [{ k: 'ruler', r: 1, h: 'a', n: 0, at: [1e9, -1e9, 5] }] });
  assert.equal(led.marks.length, 1);
  const [x, y, z] = led.marks[0].at;
  assert.ok(Math.abs(x) <= 400 && Math.abs(y) <= 120 && z === 5);
});

test('sanitize truncates an overlong hand id', () => {
  const led = sanitizeLedger({ marks: [{ k: 'valve', r: 1, h: 'x'.repeat(500), n: 0 }] });
  assert.equal(led.marks[0].h.length, 16);
});

test('sanitize dedupes (hand, rung, kind) across a merged payload', () => {
  const led = sanitizeLedger({
    marks: [
      { k: 'valve', r: 1, h: 'a', n: 0 },
      { k: 'valve', r: 1, h: 'a', n: 1 },
      { k: 'valve', r: 1, h: 'a', n: 2 },
    ],
  });
  assert.equal(led.marks.length, 1);
});

test('a hostile ledger cannot drown a player', () => {
  // 5000 marks from 5000 hands, every one of them the heaviest kind
  const marks = [];
  for (let i = 0; i < 5000; i++) marks.push({ k: 'dive', r: 1, h: 'h' + i, n: 0 });
  const led = sanitizeLedger({ marks });
  assert.ok(marksAt(led, 1).length <= MAX_MARKS_PER_RUNG);
  assert.ok(draftAt(led, 2) <= MAX_DRAFT);
  assert.ok(tideFor(led, 2, 1.35) <= 1.35 + MAX_DRAFT);
});

// ---------------- payload round-trip ------------------------------------------

test('pack → apply round-trips a ledger', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a', at: [1, 2, 3] });
  record(led, { kind: 'ruler', rung: 2, hand: 'b' });
  const back = applyLedger(JSON.parse(JSON.stringify(packLedger(led))));
  assert.equal(back.marks.length, 2);
  assert.deepEqual(back.marks[0].at, [1, 2, 3]);
  assert.equal(draftAt(back, 3), draftAt(led, 3));
});

test('apply accepts only the current ledger epoch', () => {
  const old = { v: LEDGER_VERSION - 1, marks: [{ k: 'valve', r: 1, h: 'a', n: 0 }], ops: [] };
  assert.deepEqual(applyLedger(old), emptyLedger());
});

// ---------------- the local source --------------------------------------------

function fakeIO() {
  const store = new Map();
  return { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), store };
}

test('localSource persists marks under its own key and reloads them', () => {
  const io = fakeIO();
  const src = localSource(io);
  const led = src.load();
  src.pushMark(record(led, { kind: 'valve', rung: 1, hand: 'a' }));

  assert.ok(io.store.has(LEDGER_KEY), 'the stack outlives the save, under its own key');
  const reloaded = localSource(io).load();
  assert.equal(reloaded.marks.length, 1);
  assert.ok(draftAt(reloaded, 2) > 0, 'your own rung-1 acts are what rung 2 wakes up in');
});

test('localSource survives a corrupt payload without losing the island', () => {
  const io = fakeIO();
  io.set(LEDGER_KEY, '{not json');
  assert.deepEqual(localSource(io).load().marks, []);
});

test('localSource pushMark is a no-op for a null mark', () => {
  const io = fakeIO();
  const src = localSource(io);
  src.load();
  src.pushMark(null);
  assert.deepEqual(localSource(fakeIO()).load().marks, []);
});

test('localSource persists disposition operations through an explicit channel', () => {
  const io = fakeIO();
  const src = localSource(io);
  const led = src.load();
  const result = dispose(led, { kind: 'close', rung: 2, hand: 'a' });
  src.pushDisposition(result.operation);

  const reloaded = localSource(io).load();
  assert.equal(boundaryAt(reloaded, 2), 'close');
  assert.equal(src.push, undefined, 'the source has no ambiguous mark-or-operation method');
});

test('newHandId is 8 hex chars', () => {
  const id = newHandId(() => 0.5);
  assert.match(id, /^[0-9a-f]{8}$/);
  assert.notEqual(newHandId(), '');
});

test('loadHandId mints once and is stable across sessions', () => {
  const io = fakeIO();
  const first = loadHandId(io);
  assert.match(first, /^[0-9a-f]{8}$/);
  assert.equal(loadHandId(io), first, 'a new run is a new run, but the same hand');
  assert.equal(io.get(HAND_KEY), first);
});

test('loadHandId replaces a corrupt stored id', () => {
  const io = fakeIO();
  io.set(HAND_KEY, '<script>alert(1)</script>');
  const id = loadHandId(io);
  assert.match(id, /^[0-9a-f]{8}$/);
});

test('the hand id lives apart from the ledger and the save', () => {
  assert.notEqual(HAND_KEY, LEDGER_KEY);
  assert.ok(!LEDGER_KEY.includes('save') && !HAND_KEY.includes('save'),
    'wiping a save must not wipe the stack you are standing in');
});

// ---------------- the flag→act map --------------------------------------------

test('every FLAG_MARKS entry names a real kind', () => {
  for (const [flag, kind] of Object.entries(FLAG_MARKS)) {
    assert.ok(MARK_KINDS[kind], `${flag} → ${kind} is not a MARK_KINDS row`);
  }
});

test('the god-verbs are all costed, and the plate costs the most', () => {
  // the four instruments plus the plate — the acts that reach through the model
  for (const k of ['valve', 'crank', 'ruler', 'lens', 'dive']) assert.ok(MARK_KINDS[k]);
  const heaviest = Object.entries(MARK_KINDS).sort((a, b) => b[1].draft - a[1].draft)[0][0];
  assert.equal(heaviest, 'dive', 'diving makes the rung somebody is born on');
});

test('a full clean surface chain displaces a real but survivable draft', () => {
  const led = emptyLedger();
  for (const kind of Object.values(FLAG_MARKS)) record(led, { kind, rung: 1, hand: 'a' });
  record(led, { kind: 'lens', rung: 1, hand: 'a' });
  const d = draftAt(led, 2);
  assert.ok(d > 0.1 && d < 0.25, `one hand's whole chain displaced ${d}`);
});

// ---------------- the dispositions (STACK.md §6) -------------------------------
// The endings are LEDGER OPERATIONS, not cards. Each one is tested for the thing it
// actually does to the next hand down, because that is the only part that matters.

test('TEND leaves the stack exactly as it is', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  const before = draftAt(led, 2);
  const r = dispose(led, { kind: 'tend', rung: 1, hand: 'a' });
  assert.equal(r.kind, 'tend');
  assert.equal(draftAt(led, 2), before, 'tend costs nothing and helps nobody');
});

test('CARRY erases your own marks and lightens the rung below', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'me' });
  record(led, { kind: 'dive', rung: 1, hand: 'me' });
  record(led, { kind: 'valve', rung: 1, hand: 'other' });
  const before = draftAt(led, 2);
  const r = dispose(led, { kind: 'carry', rung: 1, hand: 'me' });
  assert.equal(r.removed, 2, 'it takes back exactly what you did');
  assert.ok(draftAt(led, 2) < before, 'they inherit less water');
  assert.equal(marksAt(led, 1).length, 1, "another hand's work is untouched");
});

test('CLOSE seals the rung — nothing above reaches anyone deeper', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'dive', rung: 2, hand: 'a' });
  assert.ok(draftAt(led, 3) > 0);
  dispose(led, { kind: 'close', rung: 2, hand: 'a' });
  assert.equal(draftAt(led, 3), 0, 'the door is shut; no water, and no help either');
  assert.deepEqual(inheritedAt(led, 3), [], 'and no evidence of anyone, ever');
});

test('the DEEPEST seal wins — a later hand supersedes an earlier one', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  record(led, { kind: 'valve', rung: 3, hand: 'b' });
  dispose(led, { kind: 'close', rung: 1, hand: 'a' });
  dispose(led, { kind: 'close', rung: 3, hand: 'b' });
  assert.deepEqual(inheritedAt(led, 4), [], 'rung 4 is behind the lowest closed door');
  assert.equal(inheritedAt(led, 2).length, 0, 'rung 2 is behind the rung-1 seal');
});

test('OPEN takes on the water of everyone below, at half weight', () => {
  const led = emptyLedger();
  record(led, { kind: 'dive', rung: 4, hand: 'below' });   // 0.06, deeper than us
  const plain = draftAt(led, 2);
  dispose(led, { kind: 'open', rung: 2, hand: 'me' });
  const opened = draftAt(led, 2);
  assert.equal(plain, 0, 'normally nothing flows uphill');
  assert.ok(Math.abs(opened - 0.03) < 1e-9, 'opened, it flows back at half weight');
});

test('OPEN only affects the rung that opened', () => {
  const led = emptyLedger();
  record(led, { kind: 'dive', rung: 4, hand: 'below' });
  dispose(led, { kind: 'open', rung: 2, hand: 'me' });
  assert.equal(draftAt(led, 3), 0, 'opening rung 2 does not leak the stack onto rung 3');
});

test('an unknown disposition does nothing', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  assert.equal(dispose(led, { kind: 'burn', rung: 1, hand: 'a' }), null);
  assert.equal(led.marks.length, 1);
});

test('hostile disposition operations are validated, bounded, and reduced', () => {
  const led = sanitizeLedger({
    marks: [{ k: 'valve', r: 1, h: 'a', n: 0 }],
    ops: [
      null,
      { k: 'burn', r: 2, h: 'a', n: 1 },
      { k: 'open', r: 0, h: 'a', n: 2 },
      { k: 'open', r: 2, h: '<script>', n: 3 },
      { k: 'open', r: 2, h: 'a', n: 4 },
      { k: 'close', r: 2, h: 'a', n: 5 },
      ...Array.from({ length: MAX_DISPOSITION_OPS + 200 }, (_, i) =>
        ({ k: 'tend', r: (i % 64) + 1, h: 'h' + i, n: i + 6 })),
    ],
  });
  assert.equal(boundaryAt(led, 2), 'close', 'the newest valid boundary is authoritative');
  assert.ok(led.ops.length <= MAX_DISPOSITION_OPS, 'operation state is hard-capped');
  assert.ok(led.ops.every((op) => DISPOSITIONS.includes(op.k) && op.r >= 1 && op.r <= 64));
});

test('dispositions survive the payload round-trip', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'a' });
  dispose(led, { kind: 'close', rung: 2, hand: 'a' });
  dispose(led, { kind: 'open', rung: 3, hand: 'a' });
  const back = applyLedger(JSON.parse(JSON.stringify(packLedger(led))));
  assert.equal(boundaryAt(back, 2), 'close');
  assert.equal(boundaryAt(back, 3), 'open');
  assert.ok(back.ops.every((op) => Object.keys(op).sort().join(',') === 'h,k,n,r'));
});

test('OPEN and CLOSE supersede each other at one rung', () => {
  const led = emptyLedger();
  dispose(led, { kind: 'open', rung: 2, hand: 'a' });
  assert.equal(boundaryAt(led, 2), 'open');
  dispose(led, { kind: 'close', rung: 2, hand: 'a' });
  assert.equal(boundaryAt(led, 2), 'close');
  assert.equal(led.ops.filter((op) => op.r === 2 && ['open', 'close'].includes(op.k)).length, 1,
    'the materialized ledger never contains contradictory boundary sets');
  dispose(led, { kind: 'open', rung: 2, hand: 'b' });
  assert.equal(boundaryAt(led, 2), 'open', 'a later observed operation wins across hands too');
});

test('CARRY tombstones survive stale remote merges and permit genuinely new work', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'me' });
  record(led, { kind: 'dive', rung: 1, hand: 'me' });
  const staleRemote = JSON.parse(JSON.stringify(packLedger(led)));

  dispose(led, { kind: 'carry', rung: 1, hand: 'me' });
  const merged = mergeLedgers(led, staleRemote);
  assert.equal(merged.marks.length, 0, 'immutable remote copies stay behind the carry high-water mark');
  assert.equal(merged.ops.filter((op) => op.k === 'carry' && op.h === 'me').length, 1);

  const fresh = record(merged, { kind: 'valve', rung: 1, hand: 'me' });
  assert.ok(fresh && fresh.n > merged.ops.find((op) => op.k === 'carry').n);
  assert.equal(mergeLedgers(merged, staleRemote).marks.length, 1,
    'post-carry work is active while pre-carry wire copies remain retired');
});

test('operation merges converge regardless of delivery order', () => {
  const left = sanitizeLedger({
    marks: [{ k: 'valve', r: 1, h: 'a', n: 1 }],
    ops: [{ k: 'open', r: 2, h: 'a', n: 2 }],
  });
  const right = sanitizeLedger({
    marks: [{ k: 'valve', r: 1, h: 'a', n: 1 }],
    ops: [{ k: 'close', r: 2, h: 'b', n: 3 }],
  });
  assert.deepEqual(packLedger(mergeLedgers(left, right)), packLedger(mergeLedgers(right, left)));
  assert.equal(boundaryAt(mergeLedgers(left, right), 2), 'close');
});

test('CLOSE blocks inheritance but not the adjacent upstream event required by replay', () => {
  const led = emptyLedger();
  record(led, { kind: 'valve', rung: 1, hand: 'past' });
  dispose(led, { kind: 'close', rung: 1, hand: 'past' });
  assert.equal(inheritedAt(led, 2).length, 0);
  assert.deepEqual(upstreamEventsAt(led, 2, 'valve').map((mark) => mark.h), ['past']);
});
