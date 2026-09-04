// notebook.js — the field book as a domain, not a chronological quest log.
// Gameplay records stable evidence ids. This module decides which finite leaf owns
// each raw mark, which leaf is active now, and which requested lead still applies.

import { FIELD_NOTES, HINT_THREADS, LORE, DEEP_FRAGMENTS } from './content.js';
import { challengeState, PROGRESSION } from './progression.js';
import {
  FIELD_FOLIOS,
  folioIdForNote,
  normalizeNotebook,
  normalizeNoteArgs,
  unfiledNoteIds,
} from './notebook-schema.js';

const completionMet = (world, notebook, completion) => {
  if (!completion) return false;
  if (completion.kind === 'flag') return !!world.flags?.[completion.key];
  if (completion.kind === 'state') return !!world[completion.key];
  if (completion.kind === 'notebook') return notebook.has(completion.id);
  return false;
};

const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const FOLIO_DECKS = Object.freeze({
  room: 'Surfaces, fittings, and things found before they moved.',
  changed: 'Marks made by touch; one scale answering another.',
  arrived: 'Where the water, sound, and pressure appeared below.',
  hands: 'Cuts, corrections, measurements, and unsigned work.',
  return: 'What remained, what was carried, and what was left connected.',
});

const ACTIVE_FOLIO = Object.freeze({
  orientation: 'room',
  surfaceFirst: 'changed',
  surfaceDeep: 'changed',
  level2: 'arrived',
  level3: 'hands',
  level4: 'return',
  return: 'return',
});

const TRACE_DEFINITIONS = Object.freeze({
  orientation: Object.freeze([
    Object.freeze({ id: 'study', label: 'the room', requires: ['enteredStudy'] }),
  ]),
  surfaceFirst: Object.freeze([
    Object.freeze({ id: 'refuge', label: 'dry room / small lamp', requires: ['refugeLit'] }),
    Object.freeze({ id: 'water', label: 'basin / bay', requires: ['valveTurned'] }),
    Object.freeze({ id: 'bridge', label: 'rule / bridge', requires: ['rulerPlaced'] }),
    Object.freeze({ id: 'hour', label: 'crank / sky', requires: ['crankUsed'] }),
  ]),
  surfaceDeep: Object.freeze([
    Object.freeze({ id: 'song', label: 'box / bird / stones', requires: ['heardBox', 'heardBird', 'birdSolved'] }),
    Object.freeze({ id: 'beam', label: 'lens / beam order', requires: ['lensPlaced', 'glyphsSeen'] }),
    Object.freeze({ id: 'signal', label: 'index / four wheels', requires: ['hatchCodeDecoded'] }),
    Object.freeze({ id: 'shadow', label: 'hour / joined shadow', requires: ['shadowRevealed'] }),
    Object.freeze({ id: 'below', label: 'buried door / plumb', requires: ['hatchOpen', 'plumbHung'] }),
  ]),
  level2: Object.freeze([
    Object.freeze({ id: 'wheel', label: 'still wheel / rising water', requires: ['upstreamHandWitnessed'] }),
    Object.freeze({ id: 'figure', label: 'distance / stillness', requires: ['tideFigureSeen'] }),
  ]),
  level3: Object.freeze([
    Object.freeze({ id: 'register', label: 'names / blank lines', requires: ['registerRead'] }),
    Object.freeze({ id: 'watcher', label: 'attention / distance', requires: ['watcherSeen'] }),
  ]),
  level4: Object.freeze([
    Object.freeze({ id: 'regard', label: 'lower room / held gaze', requires: ['lowerHandRegarded'] }),
    Object.freeze({ id: 'choice', label: 'two sides / one setting', requires: ['dispositionChosen'] }),
  ]),
  return: Object.freeze([
    Object.freeze({ id: 'choice', label: 'the setting carried upward', requires: ['dispositionChosen'] }),
    Object.freeze({ id: 'shore', label: 'the changed shore', requires: ['returned'] }),
    Object.freeze({ id: 'refuge', label: 'the lit east room', requires: ['endingCommitted'] }),
  ]),
});

const THREAD_GATES = Object.freeze({
  'surface-circuit': 'surfaceFirst',
  'deep-circuit': 'surfaceDeep',
  'signal-hatch': 'surfaceDeep',
  'upstream-hand': 'level2',
  'tide-figure': 'level2',
  watcher: 'level3',
  'lower-account': 'level4',
});

const kindFor = (id, definition) => {
  if (definition.kind === 'transcription' || id.startsWith('collection.') || /\.(?:surface|deep)$/.test(id)) return 'rubbing';
  if (definition.kind === 'inference') return 'joining';
  if (id.startsWith('arrival.') || id.startsWith('event.') || id.startsWith('mechanism.') || id.startsWith('ending.')) return 'change';
  return 'mark';
};

const labelFor = (kind, definition) => definition.label || ({
  rubbing: 'copied mark',
  joining: 'lines joined',
  change: 'change witnessed',
  mark: 'field mark',
}[kind]);

export class Notebook {
  constructor(world, onChange = () => {}) {
    this.world = world;
    this.onChange = onChange;
    const unfiled = unfiledNoteIds();
    if (unfiled.length) throw new Error(`Field-note ids need a folio: ${unfiled.join(', ')}`);
    world.notebook = normalizeNotebook(world.notebook);
  }

  reset(announce = true) {
    this.world.notebook = { entries: [], hintLevels: {} };
    if (announce) this.onChange({ type: 'reset' });
  }

  has(id) {
    return this.world.notebook.entries.some((entry) => entry.id === id);
  }

  record(id, args = undefined) {
    if (!FIELD_NOTES[id] || !folioIdForNote(id)) throw new Error(`Unknown field-note id: ${id}`);
    const clean = normalizeNoteArgs(id, args);
    const existing = this.world.notebook.entries.find((entry) => entry.id === id);
    if (existing) {
      // A physical mark can become more exact (the fallen stone can wake, a count
      // can resolve) without manufacturing a second note with the same identity.
      if (clean === undefined || sameData(existing.args, clean)) return false;
      existing.args = clean;
      this.onChange({ type: 'revise', id });
      return true;
    }
    const entry = { id };
    if (clean !== undefined) entry.args = clean;
    this.world.notebook.entries.push(entry);
    this.onChange({ type: 'record', id });
    return true;
  }

  marks(folioId = null) {
    return this.world.notebook.entries.flatMap((entry, ordinal) => {
      const definition = FIELD_NOTES[entry.id];
      const home = folioIdForNote(entry.id);
      if (!definition || !home || (folioId && home !== folioId)) return [];
      const { deriveArgs, ...view } = definition;
      const args = deriveArgs ? deriveArgs(this.world) : entry.args;
      const text = typeof definition.text === 'function'
        ? definition.text(args || {})
        : definition.text;
      const markKind = kindFor(entry.id, definition);
      const rubbing = entry.id === 'evidence.beam-glyphs' && args?.glyphs?.length === 4
        ? { kind: 'glyph-order', glyphs: [...args.glyphs] }
        : null;
      return [{
        ...view,
        ...entry,
        args,
        ordinal,
        folioId: home,
        markKind,
        label: labelFor(markKind, definition),
        text,
        rubbing,
      }];
    });
  }

  folios() {
    return FIELD_FOLIOS.map((definition) => ({
      id: definition.id,
      title: definition.title,
      deck: FOLIO_DECKS[definition.id],
      marks: this.marks(definition.id).reverse(),
    }));
  }

  readLore(loreId, layer = 'surface') {
    const lore = LORE[loreId];
    const id = lore?.notes?.[layer];
    if (!id) throw new Error(`Lore ${loreId} has no ${layer} note`);
    return this.record(id);
  }

  hasReadLore(loreId, layer = 'surface') {
    const id = LORE[loreId]?.notes?.[layer];
    return !!id && this.has(id);
  }

  // Kept as diagnostic state for the debug panel; it has no player-facing tally,
  // completion condition, or synthesized reward.
  deepCount() {
    return DEEP_FRAGMENTS.reduce((count, key) => {
      const id = LORE[key]?.notes?.deep;
      return count + (id && this.has(id) ? 1 : 0);
    }, 0);
  }

  currentGate() {
    const flags = this.world.flags || {};
    if (flags.returned || flags.climbing || flags.endingCommitted) return 'return';
    const level = Math.max(1, Math.min(4, Number(this.world.level) || 1));
    if (level >= 4) return 'level4';
    if (level === 3) return 'level3';
    if (level === 2) return 'level2';
    if (!flags.enteredStudy) return 'orientation';
    return flags.receiverReturned ? 'surfaceDeep' : 'surfaceFirst';
  }

  activeFolioId() {
    return ACTIVE_FOLIO[this.currentGate()];
  }

  causalTrace() {
    const gate = this.currentGate();
    const state = challengeState(this.world, this);
    const nodes = TRACE_DEFINITIONS[gate] || [];
    return nodes.map((node) => ({
      id: node.id,
      label: node.label,
      complete: node.requires.every((id) => state[id] === true),
    }));
  }

  gateState() {
    const gate = this.currentGate();
    let missing;
    if (Object.hasOwn(PROGRESSION.gates, gate)) {
      missing = PROGRESSION.missing(gate, challengeState(this.world, this));
    } else if (gate === 'return') {
      const state = challengeState(this.world, this);
      missing = ['dispositionChosen', 'returned', 'endingCommitted'].filter((id) => state[id] !== true);
    } else {
      missing = this.world.flags?.enteredStudy ? [] : ['enteredStudy'];
    }
    return { id: gate, missing };
  }

  _eligibleThreads() {
    const gate = this.currentGate();
    const entries = this.world.notebook.entries;
    const indexOf = (id) => entries.findIndex((entry) => entry.id === id);
    return HINT_THREADS
      .filter((thread) => THREAD_GATES[thread.id] === gate)
      .filter((thread) => thread.after.every((id) => this.has(id)))
      .filter((thread) => !completionMet(this.world, this, thread.complete))
      .sort((a, b) => {
        const aLatest = Math.max(-1, ...a.after.map(indexOf));
        const bLatest = Math.max(-1, ...b.after.map(indexOf));
        return bLatest - aLatest;
      });
  }

  currentLead() {
    const trace = this.causalTrace();
    const unresolved = trace.find((node) => !node.complete);
    const thread = this._eligibleThreads()[0] || null;
    const level = thread ? this.world.notebook.hintLevels[thread.id] : undefined;
    const hasRequested = Number.isInteger(level) && level >= 0;
    return {
      gate: this.currentGate(),
      summary: unresolved?.label || 'the line reaches the plate',
      threadId: thread?.id || null,
      level: hasRequested ? level : null,
      text: hasRequested ? thread.steps[level] : '',
      canTrace: !!thread,
    };
  }

  fieldbook() {
    return {
      activeFolioId: this.activeFolioId(),
      gate: this.gateState(),
      trace: this.causalTrace(),
      lead: this.currentLead(),
      folios: this.folios(),
    };
  }

  requestHint() {
    const thread = this._eligibleThreads()[0];
    if (!thread) return null;
    const previous = this.world.notebook.hintLevels[thread.id] ?? -1;
    const level = Math.min(previous + 1, thread.steps.length - 1);
    this.world.notebook.hintLevels[thread.id] = level;
    this.onChange({ type: 'hint', id: thread.id, level });
    return { id: thread.id, level, text: thread.steps[level] };
  }
}

export default Notebook;
