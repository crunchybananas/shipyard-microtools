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
  MAX_MARKS_PER_RUNG, MAX_DRAFT,
  emptyLedger, record, marksAt, inheritedAt, evidenceAt,
  draftAt, tideFor, handsAbove,
  sanitizeLedger, packLedger, applyLedger, localSource, newHandId, loadHandId,
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

// ---------------- the local source --------------------------------------------

function fakeIO() {
  const store = new Map();
  return { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), store };
}

test('localSource persists marks under its own key and reloads them', () => {
  const io = fakeIO();
  const src = localSource(io);
  const led = src.load();
  src.push(record(led, { kind: 'valve', rung: 1, hand: 'a' }));

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

test('localSource push is a no-op for a null mark', () => {
  const io = fakeIO();
  const src = localSource(io);
  src.load();
  src.push(null);
  assert.deepEqual(localSource(fakeIO()).load().marks, []);
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
