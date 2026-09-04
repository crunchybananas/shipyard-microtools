import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Notebook } from '../js/notebook.js';
import { DEEP_FRAGMENTS, FIELD_NOTES, LORE } from '../js/content.js';
import { FIELD_FOLIOS, folioIdForNote, unfiledNoteIds } from '../js/notebook-schema.js';

const fresh = (level = 1) => ({
  level,
  flags: { enteredStudy: false }, lensPlaced: false,
  recDisp: {},
  notebook: { entries: [], hintLevels: {} },
});

test('records one stable id and revises its factual arguments in place', () => {
  const W = fresh();
  const changes = [];
  const notes = new Notebook(W, (change) => changes.push(change));
  assert.equal(notes.record('evidence.fallen-stone', { awake: false }), true);
  assert.equal(notes.record('evidence.fallen-stone', { awake: true }), true);
  assert.equal(notes.record('evidence.fallen-stone', { awake: true }), false);
  assert.deepEqual(W.notebook.entries, [{ id: 'evidence.fallen-stone', args: { awake: true } }]);
  assert.deepEqual(changes, [
    { type: 'record', id: 'evidence.fallen-stone' },
    { type: 'revise', id: 'evidence.fallen-stone' },
  ]);
});

test('unknown evidence is rejected at the domain boundary', () => {
  const notes = new Notebook(fresh());
  assert.throws(() => notes.record('made.up.answer'), /Unknown field-note id/);
});

test('construction keeps only declared evidence and current hint threads', () => {
  const W = {
    level: 1, flags: {}, lensPlaced: false,
    notebook: {
      entries: [
        { id: 'retired.answer' },
        { id: 'evidence.valve' },
        { id: 'evidence.valve' },
      ],
      hintLevels: { retired: 2, 'surface-circuit': 99 },
    },
  };
  new Notebook(W);
  assert.deepEqual(W.notebook, {
    entries: [{ id: 'evidence.valve' }],
    hintLevels: { 'surface-circuit': 2 },
  });
});

test('the beam rubbing preserves exact recorded glyph order', () => {
  const W = fresh();
  const notes = new Notebook(W);
  const source = { glyphs: [1, 5, 3, 4] };
  notes.record('evidence.beam-glyphs', source);
  source.glyphs.reverse();
  const mark = notes.marks('changed')[0];
  assert.deepEqual(mark.args.glyphs, [1, 5, 3, 4]);
  assert.deepEqual(mark.rubbing, { kind: 'glyph-order', glyphs: [1, 5, 3, 4] });
  assert.doesNotMatch(mark.text, /\d\s*[·.]\s*\d/);
});

test('malformed arguments cannot survive the notebook boundary or break rendering', () => {
  const W = {
    level: 1, flags: {}, lensPlaced: false,
    notebook: {
      entries: [
        { id: 'evidence.beam-glyphs', args: { glyphs: [1, 5, 3, 8] } },
        { id: 'ending.carry', args: { removed: -9 } },
      ],
      hintLevels: {},
    },
  };
  const notes = new Notebook(W);
  assert.deepEqual(W.notebook.entries, [
    { id: 'evidence.beam-glyphs', args: { glyphs: [] } },
    { id: 'ending.carry', args: { removed: 0 } },
  ]);
  assert.doesNotThrow(() => notes.marks());
});

test('record notes derive current totals from the canonical dispositions', () => {
  const W = fresh();
  W.recDisp = {
    drain_ledger: 'filed',
    field_slip: 'filed',
    transfer_offer: 'kept',
  };
  W.notebook.entries = [
    { id: 'record.filed', args: { count: 99 } },
    { id: 'record.kept', args: { count: 99 } },
  ];

  const notes = new Notebook(W);
  assert.deepEqual(W.notebook.entries, [
    { id: 'record.filed' },
    { id: 'record.kept' },
  ]);
  assert.match(notes.marks().find(({ id }) => id === 'record.filed').text, /^2 records rest/);
  assert.match(notes.marks().find(({ id }) => id === 'record.kept').text, /^1 record remains/);

  W.recDisp.commendation_copy = 'filed';
  assert.match(notes.marks().find(({ id }) => id === 'record.filed').text, /^3 records rest/);
});

test('five finite folios own every recordable note exactly once', () => {
  assert.deepEqual(FIELD_FOLIOS.map(({ title }) => title), [
    'THE ROOM', 'WHAT I CHANGED', 'WHERE IT ARRIVED', 'OTHER HANDS', 'RETURN',
  ]);
  assert.deepEqual(unfiledNoteIds(), []);
  const ids = FIELD_FOLIOS.flatMap(({ noteIds }) => noteIds);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of Object.keys(FIELD_NOTES)) {
    assert.ok(folioIdForNote(id), `${id} has a finite folio`);
  }
});

test('fieldbook partitions raw marks by leaf and opens the leaf for the current gate', () => {
  const W = fresh();
  const notes = new Notebook(W);
  notes.record('evidence.model-marker');
  notes.record('evidence.valve');
  let book = notes.fieldbook();
  assert.equal(book.activeFolioId, 'room');
  assert.equal(book.gate.id, 'orientation');
  assert.deepEqual(book.folios.find(({ id }) => id === 'room').marks.map(({ id }) => id), ['evidence.model-marker']);
  assert.deepEqual(book.folios.find(({ id }) => id === 'changed').marks.map(({ id }) => id), ['evidence.valve']);

  W.flags.enteredStudy = true;
  assert.equal(notes.activeFolioId(), 'changed');
  assert.equal(notes.currentGate(), 'surfaceFirst');
  W.flags.receiverReturned = true;
  assert.equal(notes.currentGate(), 'surfaceDeep');
  W.level = 2;
  assert.equal(notes.activeFolioId(), 'arrived');
  W.level = 3;
  assert.equal(notes.activeFolioId(), 'hands');
  W.level = 4;
  assert.equal(notes.activeFolioId(), 'return');
  W.level = 1;
  W.flags.returned = true;
  assert.equal(notes.currentGate(), 'return');
});

test('every lore surface and deep page maps to declared evidence', () => {
  for (const [id, lore] of Object.entries(LORE)) {
    assert.ok(lore.notes?.surface, `${id} has a surface note`);
    assert.ok(FIELD_NOTES[lore.notes.surface], `${id} surface note exists`);
    if (lore.deep?.length) {
      assert.ok(lore.notes?.deep, `${id} has a deep note`);
      assert.ok(FIELD_NOTES[lore.notes.deep], `${id} deep note exists`);
    }
  }
});

test('deep progress derives from evidence and includes formerly skipped fragments', () => {
  const W = fresh();
  const notes = new Notebook(W);
  notes.readLore('field_slip', 'deep');
  notes.readLore('transfer_offer', 'deep');
  assert.equal(notes.has('evidence.field-slip.deep'), true);
  assert.equal(notes.has('evidence.transfer-offer.deep'), true);
  assert.equal(notes.deepCount(), 2);
});

test('reading every deep page creates no collectible close or synthesized note', () => {
  const W = fresh();
  const notes = new Notebook(W);
  for (const id of DEEP_FRAGMENTS) notes.readLore(id, 'deep');
  assert.equal(notes.deepCount(), DEEP_FRAGMENTS.length);
  assert.deepEqual(
    W.notebook.entries.map(({ id }) => id).sort(),
    DEEP_FRAGMENTS.map((id) => LORE[id].notes.deep).sort(),
  );
  const count = W.notebook.entries.length;
  assert.equal(notes.readLore(DEEP_FRAGMENTS.at(-1), 'deep'), false);
  assert.equal(W.notebook.entries.length, count);
});

test('hints are requested separately and escalate without adding evidence', () => {
  const W = fresh();
  W.flags.enteredStudy = true;
  const notes = new Notebook(W);
  notes.record('event.refuge-lit');
  const before = W.notebook.entries.length;
  const one = notes.requestHint();
  const two = notes.requestHint();
  const three = notes.requestHint();
  const clamped = notes.requestHint();
  assert.equal(one.id, 'surface-circuit');
  assert.equal(one.level, 0);
  assert.equal(two.level, 1);
  assert.equal(three.level, 2);
  assert.equal(clamped.level, 2);
  assert.equal(W.notebook.entries.length, before);
});

test('a lead cannot leak in from a past or future progression gate', () => {
  const W = fresh(3);
  const notes = new Notebook(W);
  notes.record('evidence.register');
  notes.record('evidence.kelp-slate.surface');
  assert.equal(notes.requestHint(), null, 'L2 tide and L4 lower-account leads stay off the L3 leaf');
  notes.record('evidence.bluff-cairn.surface');
  assert.equal(notes.requestHint().id, 'watcher');
  W.flags.watcherSeen = true;
  assert.equal(notes.requestHint(), null);
});

test('the upstream-hand lead exists before the event resolves', () => {
  const W = fresh(2);
  const notes = new Notebook(W);
  notes.record('evidence.dead-wheel');
  assert.equal(notes.requestHint().id, 'upstream-hand');
  W.flags.upstreamHandWitnessed = true;
  assert.equal(notes.requestHint(), null);
});

test('the facing-page lead is reconstructed from current state and never goes stale', () => {
  const W = fresh(2);
  const notes = new Notebook(W);
  notes.record('evidence.dead-wheel');
  assert.equal(notes.currentLead().text, '');
  notes.requestHint();
  assert.match(notes.currentLead().text, /wheel/i);

  W.flags.upstreamHandWitnessed = true;
  const resolved = notes.currentLead();
  assert.equal(resolved.text, '');
  assert.equal(resolved.threadId, null);

  W.level = 3;
  assert.equal(notes.currentLead().text, '');
  assert.equal(notes.currentLead().gate, 'level3');
});

test('the causal sketch closes only the physical relationships completed at this gate', () => {
  const W = fresh();
  W.flags.enteredStudy = true;
  W.flags.refugeLit = true;
  W.flags.valveTurned = true;
  const notes = new Notebook(W);
  let trace = Object.fromEntries(notes.causalTrace().map((node) => [node.id, node.complete]));
  assert.equal(trace.refuge, true);
  assert.equal(trace.water, true);
  assert.equal(trace.bridge, false);

  W.flags.receiverReturned = true;
  W.flags.heardBox = true;
  trace = Object.fromEntries(notes.causalTrace().map((node) => [node.id, node.complete]));
  assert.equal(trace.song, false);
  assert.equal(trace.signal, false);
  W.flags.hatchCodeDecoded = true;
  assert.equal(notes.causalTrace().find(({ id }) => id === 'signal').complete, true);
});
