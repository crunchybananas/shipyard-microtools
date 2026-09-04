// coverage.mjs — static contract for the field notebook and its evidence graph.
//
// Gameplay records stable ids. Content resolves those ids to prose and optional
// sketches. This gate keeps that boundary complete and makes retired, state-derived
// quest copy a build failure instead of something a player discovers.

import { readFileSync } from 'node:fs';

const JS = new URL('../../js/', import.meta.url);
const content = await import(new URL('content.js', JS));
const progression = await import(new URL('progression.js', JS));

const {
  FIELD_NOTES,
  HINT_THREADS,
  SKETCHES_BY_ID,
  LORE,
  DEEP_FRAGMENTS,
  CLIMBERS,
  CLIMBERS_CLOSE,
  CONGREGATION,
  CONGREGATION_CLOSE,
  LAMPBLACK,
  LAMPBLACK_CLOSE,
} = content;

const R = { pass: [], fail: [] };
const ok = (name, condition, detail = '') => {
  (condition ? R.pass : R.fail).push(detail ? `${name} — ${detail}` : name);
};

const ids = Object.keys(FIELD_NOTES);
const idSet = new Set(ids);
const stableId = /^[a-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)*$/;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

ok('NOTES.nonempty-catalogue', ids.length >= 70, `${ids.length} definitions`);
ok('NOTES.stable-ids', ids.every((id) => stableId.test(id)));
ok('NOTES.valid-definitions', Object.values(FIELD_NOTES).every((note) => {
  if (!note || typeof note !== 'object') return false;
  if (typeof note.text === 'function') {
    try { return nonempty(note.text({ removed: 2, hands: 3, count: 1 })); }
    catch { return false; }
  }
  return nonempty(note.text);
}));
ok('NOTES.valid-labels', Object.values(FIELD_NOTES).every((note) => note.label === undefined || nonempty(note.label)));

const sketchIds = Object.keys(SKETCHES_BY_ID);
ok('SKETCHES.stable-ids', sketchIds.length > 0 && sketchIds.every((id) => stableId.test(id)));
ok('SKETCHES.svg-payloads', Object.values(SKETCHES_BY_ID).every((svg) => nonempty(svg) && svg.startsWith('<svg')));
const missingSketches = ids.filter((id) => {
  const sketchId = FIELD_NOTES[id].sketchId;
  return sketchId && !SKETCHES_BY_ID[sketchId];
});
ok('SKETCHES.note-references', missingSketches.length === 0, missingSketches.join(', '));

const loreEntries = Object.entries(LORE);
const badLoreSurface = loreEntries
  .filter(([, lore]) => !lore.notes?.surface || !idSet.has(lore.notes.surface))
  .map(([id]) => id);
const badLoreDeep = loreEntries
  .filter(([, lore]) => Array.isArray(lore.deep) && lore.deep.length > 0)
  .filter(([, lore]) => !lore.notes?.deep || !idSet.has(lore.notes.deep))
  .map(([id]) => id);
ok('LORE.surface-note-coverage', badLoreSurface.length === 0, badLoreSurface.join(', '));
ok('LORE.deep-note-coverage', badLoreDeep.length === 0, badLoreDeep.join(', '));
ok('LORE.unique-note-layers', loreEntries.every(([, lore]) => !lore.notes?.deep || lore.notes.deep !== lore.notes.surface));

const uniqueDeep = new Set(DEEP_FRAGMENTS);
const badDeep = DEEP_FRAGMENTS.filter((id) => {
  const lore = LORE[id];
  return !lore || !Array.isArray(lore.deep) || lore.deep.length === 0 || !idSet.has(lore.notes?.deep);
});
ok('LORE.deep-set-unique', uniqueDeep.size === DEEP_FRAGMENTS.length);
ok('LORE.deep-set-resolves', badDeep.length === 0, badDeep.join(', '));

const authoredCollections = [
  ...CLIMBERS,
  CLIMBERS_CLOSE,
  ...CONGREGATION,
  CONGREGATION_CLOSE,
  ...LAMPBLACK,
  LAMPBLACK_CLOSE,
];
const badCollectionNotes = authoredCollections
  .filter((item) => !item?.noteId || !idSet.has(item.noteId))
  .map((item) => item?.id || item?.noteId || '(unnamed)');
ok('COLLECTIONS.stable-note-ids', badCollectionNotes.length === 0, badCollectionNotes.join(', '));

const hintIds = HINT_THREADS.map((thread) => thread.id);
const badHints = HINT_THREADS.filter((thread) => (
  !stableId.test(thread.id)
  || !Array.isArray(thread.after)
  || thread.after.length === 0
  || thread.after.some((id) => !idSet.has(id))
  || !Array.isArray(thread.steps)
  || thread.steps.length < 2
  || thread.steps.some((step) => !nonempty(step))
));
ok('HINTS.unique-thread-ids', new Set(hintIds).size === hintIds.length);
ok('HINTS.evidence-backed', badHints.length === 0, badHints.map((thread) => thread.id).join(', '));
ok('HINTS.separate-from-notes', hintIds.every((id) => !idSet.has(id)));

const runtimeFiles = ['main.js', 'notebook.js', 'puzzles.js', 'ui.js', 'world.js', 'save-schema.js'];
const runtime = runtimeFiles.map((file) => readFileSync(new URL(file, JS), 'utf8')).join('\n');
const referenced = new Set(Object.values(progression.NOTE_IDS));

for (const [, lore] of loreEntries) {
  if (lore.notes?.surface) referenced.add(lore.notes.surface);
  if (lore.notes?.deep) referenced.add(lore.notes.deep);
}
for (const item of authoredCollections) if (item?.noteId) referenced.add(item.noteId);
for (const match of runtime.matchAll(/(?:notebook|this\.notebook|this)(?:\.|\?\.)record(?:\?\.)?\(\s*['"`]([^'"`]+)['"`]/g)) {
  if (!match[1].includes('${')) referenced.add(match[1]);
}
for (const match of runtime.matchAll(/_recordEvidence\(\s*['"`]([^'"`]+)['"`]/g)) {
  if (!match[1].includes('${')) referenced.add(match[1]);
}

// These ids are selected by a finite state value rather than a literal call site.
for (const id of [
  'arrival.shallows', 'arrival.inspection', 'arrival.source',
  'ending.tend', 'ending.carry', 'ending.open', 'ending.close',
  'event.round.moor', 'event.round.log', 'event.round.light', 'event.round.wind',
]) referenced.add(id);

const unknownRuntimeIds = [...referenced].filter((id) => !idSet.has(id));
const unreachableDefinitions = ids.filter((id) => !referenced.has(id));
ok('RUNTIME.references-resolve', unknownRuntimeIds.length === 0, unknownRuntimeIds.join(', '));
ok('RUNTIME.every-note-reachable', unreachableDefinitions.length === 0, unreachableDefinitions.join(', '));

const retired = [
  ['imperative journal writes', /(?:UI|this)\.addJournal\s*\(/],
  ['state-derived bearing copy', /currentBearing|journal-bearing/],
  ['mutable prose save state', /W\.(?:journal|readKeys)\b/],
  ['fragment counters', /fragmentsFound|journalDeep/],
  ['prose-matched sketches', /SKETCHES\.find\s*\(/],
  ['versioned storage epoch', /abyme-save-v\d/],
  ['save backup or migration layer', /SAVE_KEY_PREV|migrateSave/],
  ['retired identity reveal', /keeperRose|there (?:was|is) only ever one|(?:he|the figure) is you/i],
  ['retired terminal flags', /bellRung|oarFinale|bellFinale/],
  ['instrument-selected endings', /(?:kind|choice)\s*===?\s*['"](?:oar|bell)['"]/],
];
const retiredHits = retired.filter(([, pattern]) => pattern.test(runtime)).map(([name]) => name);
ok('RUNTIME.no-retired-paths', retiredHits.length === 0, retiredHits.join(', '));

ok('PROGRESSION.note-ids-resolve', Object.values(progression.NOTE_IDS).every((id) => idSet.has(id)));
ok('PROGRESSION.four-dispositions', ['ending.tend', 'ending.carry', 'ending.open', 'ending.close'].every((id) => idSet.has(id)));

console.log(`COVERAGE PASS ${R.pass.length} / ${R.pass.length + R.fail.length}`);
if (R.fail.length) {
  console.log('FAILURES:', JSON.stringify(R.fail));
  process.exitCode = 1;
}
