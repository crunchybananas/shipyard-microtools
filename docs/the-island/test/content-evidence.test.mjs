import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as content from '../js/content.js';

const {
  LORE, FIELD_NOTES, HINT_THREADS, SIGNAL_BINDINGS, SIGNAL_ROUTE, SIGNAL_HATCH_CODE,
  SKETCHES_BY_ID, CLIMBERS, CLIMBERS_CLOSE, CONGREGATION, CONGREGATION_CLOSE,
  LAMPBLACK, LAMPBLACK_CLOSE, finaleCoda,
} = content;

test('every readable page records a stable known evidence id', () => {
  const ids = [];
  for (const [loreId, lore] of Object.entries(LORE)) {
    assert.ok(lore.notes?.surface, `${loreId} needs a surface note id`);
    assert.ok(FIELD_NOTES[lore.notes.surface], `${loreId} surface note is unknown`);
    ids.push(lore.notes.surface);
    if (lore.deep?.length) {
      assert.ok(lore.notes.deep, `${loreId} needs a deep note id`);
      assert.ok(FIELD_NOTES[lore.notes.deep], `${loreId} deep note is unknown`);
      ids.push(lore.notes.deep);
    }
    assert.equal('journal' in lore, false, `${loreId} carries retired journal prose`);
    assert.equal('journalDeep' in lore, false, `${loreId} carries retired deep journal prose`);
  }
  assert.equal(new Set(ids).size, ids.length, 'lore evidence ids must be unique');
});

test('the shelf routes beam figures to earned physical readings without printing values', () => {
  assert.deepEqual(SIGNAL_BINDINGS.map(({ glyph }) => glyph), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(SIGNAL_BINDINGS.map(({ instrument }) => instrument)).size, 8);
  assert.deepEqual(SIGNAL_ROUTE, [1, 5, 3, 4]);
  assert.deepEqual(SIGNAL_HATCH_CODE, [5, 1, 4, 6]);
  assert.deepEqual(SIGNAL_ROUTE.map((glyph) => SIGNAL_BINDINGS[glyph].readingLabel), [
    'five gauge rings', 'one lens eye', 'fourth filed tooth', 'six sounding stones',
  ]);
  for (const binding of SIGNAL_BINDINGS) assert.ok(FIELD_NOTES[binding.evidenceId]);
  assert.ok(LORE.signal_shelf);
  assert.equal('decoder_shelf' in LORE, false);
  assert.equal('lettered_shelf' in LORE, false);
  assert.equal('SIGNAL_INDEX' in content, false);
  assert.equal('SIGNAL_MANUAL_TITLES' in content, false);
  assert.equal('SHELF_TITLES' in content, false);
  assert.equal('SHELF_DECOYS' in content, false);

  const prose = LORE.signal_shelf.pages.join('\n');
  assert.doesNotMatch(prose, /numeral|\b[0-9]\b/i);
  assert.doesNotMatch(prose, /5\D{0,12}1\D{0,12}4\D{0,12}6/);
  assert.doesNotMatch(prose.replace(/[^a-z]/gi, ''), /ithastogosomewhere/i);
});

test('artifact prose supplies observations rather than instructions or identity answers', () => {
  const prose = Object.values(LORE)
    .flatMap((lore) => [...lore.pages, ...(lore.deep || [])])
    .join('\n');
  assert.doesNotMatch(prose, /\b(stand on|touch again|go to|turn him|carry him|do not run|hold its gaze)\b/i);
  assert.doesNotMatch(prose, /\b(the someone was always you|you are the patient hand|he is you|there was only ever one)\b/i);
});

test('collection content owns its stable field-note ids', () => {
  const entries = [
    ...CLIMBERS, CLIMBERS_CLOSE,
    ...CONGREGATION, CONGREGATION_CLOSE,
    ...LAMPBLACK, LAMPBLACK_CLOSE,
  ];
  for (const entry of entries) {
    assert.ok(entry.noteId, `${entry.id || entry.whisper} needs a note id`);
    assert.ok(FIELD_NOTES[entry.noteId], `${entry.noteId} is unknown`);
  }
});

test('every illustrated field note resolves by id and hints remain a separate opt-in layer', () => {
  for (const [id, note] of Object.entries(FIELD_NOTES)) {
    assert.ok(note.text, `${id} needs text`);
    if (note.sketchId) assert.ok(SKETCHES_BY_ID[note.sketchId], `${id} has unknown sketch ${note.sketchId}`);
  }
  for (const thread of HINT_THREADS) {
    assert.ok(thread.id && thread.after.length && thread.steps.length);
    for (const id of thread.after) assert.ok(FIELD_NOTES[id], `${thread.id} depends on unknown note ${id}`);
  }
});

test('finale copy recognizes only the four physical dispositions', () => {
  for (const kind of ['tend', 'carry', 'open', 'close']) assert.ok(finaleCoda(kind, { removed: 3 }).length);
  assert.deepEqual(finaleCoda('oar', {}), []);
  assert.deepEqual(finaleCoda('bell', {}), []);
  assert.match(finaleCoda('carry', { removed: 3 })[0], /^3 interventions reversed$/);
  assert.match(finaleCoda('carry', { removed: 1 })[0], /^1 intervention reversed$/);
});
