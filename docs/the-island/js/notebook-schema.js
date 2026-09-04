// notebook-schema.js — the current, finite field-book contract.
//
// Saves keep stable evidence ids and factual arguments. Page placement is authored
// here, not persisted, so the book can be redesigned without migrating player data.

import { FIELD_NOTES, HINT_THREADS } from './content.js';

const boundedInt = (value, max) => Number.isInteger(value) && value >= 0
  ? Math.min(value, max)
  : 0;

const noteArgCleaners = Object.freeze({
  // Glyph ids are atlas indices (0...7). Their order is the evidence; sorting or
  // replacing them with translated numerals would destroy the player's clue.
  'evidence.beam-glyphs': (args) => ({
    glyphs: Array.isArray(args?.glyphs) && args.glyphs.length === 4
      && args.glyphs.every((n) => Number.isInteger(n) && n >= 0 && n <= 7)
      ? [...args.glyphs]
      : [],
  }),
  'ending.carry': (args) => ({ removed: boundedInt(args?.removed, 10_000) }),
  'evidence.register': (args) => ({ hands: boundedInt(args?.hands, 1_000_000) }),
  'evidence.tide-gauge': (args) => ({ level: Math.max(1, Math.min(4, boundedInt(args?.level, 4))) }),
  'evidence.fallen-stone': (args) => ({ awake: args?.awake === true }),
});

export const normalizeNoteArgs = (id, args) => noteArgCleaners[id]?.(args);

const folio = (id, title, noteIds) => Object.freeze({
  id,
  title,
  noteIds: Object.freeze(noteIds),
});

// Every recordable observation has one home. The five leaves are narrative
// questions, not content buckets or an ever-growing quest log.
export const FIELD_FOLIOS = Object.freeze([
  folio('room', 'THE ROOM', [
    'evidence.model-marker',
    'artifact.signal-shelf.surface',
    'evidence.hatch-numerals',
    'evidence.tide-gauge',
    'evidence.fallen-stone',
    'evidence.room-disagreement',
    'evidence.bell-buoy',
    'evidence.model-bottle',
    'evidence.model-gauge',
    'evidence.climber-rope',
    'evidence.study-model',
    'evidence.study-unchanged',
  ]),
  folio('changed', 'WHAT I CHANGED', [
    'event.refuge-lit',
    'evidence.valve',
    'evidence.music-box',
    'evidence.ruler',
    'evidence.lens',
    'evidence.bird',
    'evidence.beam-glyphs',
    'evidence.shadow-hatch',
    'evidence.plumb',
    'evidence.crank',
    'mechanism.stone-vault',
    'mechanism.lighthouse',
    'mechanism.reading-glass',
    'evidence.completed-song',
  ]),
  folio('arrived', 'WHERE IT ARRIVED', [
    'arrival.shallows',
    'arrival.inspection',
    'arrival.source',
    'evidence.dead-wheel',
    'event.upstream-hand',
    'encounter.tide-figure',
    'encounter.watcher',
    'encounter.lower-hand',
    'event.capitals-breach',
    'event.beam-farewell',
    'event.fifth-ring',
  ]),
  folio('hands', 'OTHER HANDS', [
    'evidence.register',
    'collection.climber.cmTallies',
    'collection.climber.cmFormal',
    'collection.climber.cmPlain',
    'collection.climber.cmUnfinished',
    'collection.climber.cmChild',
    'collection.climbers-complete',
    'collection.hall.cgRoof',
    'collection.hall.cgCount',
    'collection.hall.cgLight',
    'collection.hall-complete',
    'collection.lampblack.lmValve',
    'collection.lampblack.lmBox',
    'collection.lampblack.lmChest',
    'collection.lampblack.lmDory',
    'collection.lampblack.lmJetty',
    'collection.lampblack.lmStair',
    'collection.lampblack.lmBell',
    'collection.lampblack.lmBuoy',
    'collection.lampblack.lmDrain',
    'collection.lampblack-complete',
    'evidence.logbook.surface',
    'evidence.logbook.deep',
    'evidence.coat-letter.surface',
    'evidence.coat-letter.deep',
    'evidence.standing-stone.surface',
    'evidence.standing-stone.deep',
    'evidence.bottle.surface',
    'evidence.bottle.deep',
    'evidence.kelp-slate.surface',
    'evidence.bluff-cairn.surface',
    'evidence.transfer-sheet.surface',
    'evidence.quarters-journal.surface',
    'evidence.quarters-journal.deep',
    'evidence.lens-study.surface',
    'evidence.lens-study.deep',
    'evidence.lens-stone.surface',
    'evidence.lens-stone.deep',
    'evidence.pool-phial.surface',
    'evidence.drain-ledger.surface',
    'evidence.drain-ledger.deep',
    'evidence.commendation.surface',
    'evidence.commendation.deep',
    'evidence.closure.surface',
    'evidence.closure.deep',
    'evidence.field-slip.surface',
    'evidence.field-slip.deep',
    'evidence.transfer-offer.surface',
    'evidence.transfer-offer.deep',
    'evidence.model-margin.surface',
    'evidence.music-note.surface',
    'evidence.music-note.deep',
  ]),
  folio('return', 'RETURN', [
    'return.receiver',
    'return.surface',
    'event.returned-shore',
    'record.filed',
    'record.kept',
    'event.round.moor',
    'event.round.log',
    'event.round.light',
    'event.round.wind',
    'event.rounds-complete',
    'evidence.disposition',
    'ending.tend',
    'ending.carry',
    'ending.open',
    'ending.close',
  ]),
]);

const noteFolios = new Map();
for (const page of FIELD_FOLIOS) {
  for (const id of page.noteIds) {
    if (noteFolios.has(id)) throw new Error(`Field-note id appears in two folios: ${id}`);
    noteFolios.set(id, page.id);
  }
}

export const folioIdForNote = (id) => noteFolios.get(id) || null;

export const unfiledNoteIds = () => Object.keys(FIELD_NOTES)
  .filter((id) => !noteFolios.has(id));

export function normalizeNotebook(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const seen = new Set();
  const entries = [];
  for (const raw of Array.isArray(source.entries) ? source.entries : []) {
    if (!raw || !FIELD_NOTES[raw.id] || !folioIdForNote(raw.id) || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const entry = { id: raw.id };
    const args = normalizeNoteArgs(raw.id, raw.args);
    if (args !== undefined) entry.args = args;
    entries.push(entry);
  }

  const hintLevels = {};
  for (const thread of HINT_THREADS) {
    const level = source.hintLevels?.[thread.id];
    if (Number.isInteger(level) && level >= 0) {
      hintLevels[thread.id] = Math.min(level, thread.steps.length - 1);
    }
  }
  return { entries, hintLevels };
}
