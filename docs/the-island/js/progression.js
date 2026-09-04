// progression.js — one dependency-free authority for the island's causal path.
//
// Rendering and prose may change freely. These stable facts are the game: what the
// player has physically learned, what each crossing requires, and what a plate touch
// can do. Keeping this module free of THREE, the DOM, timers, and storage makes the
// whole route directly testable.

export const NOTE_IDS = Object.freeze({
  beamGlyphs: 'evidence.beam-glyphs',
  signalShelf: 'artifact.signal-shelf.surface',
  upstreamHand: 'event.upstream-hand',
  register: 'evidence.register',
  lowerHand: 'encounter.lower-hand',
});

// The route crosses the surface boundary twice. The first crossing happens as
// soon as the player has made a refuge and enjoyed the three large-scale
// controls. L2 then returns them to the surface with a receiver's point of view.
// Only the second crossing asks for the signal/hatch/plumb circuit that reaches
// the deeper strata.
export const FIRST_CROSSING_REQUIREMENTS = Object.freeze([
  'refugeLit',
  'valveTurned',
  'crankUsed',
  'rulerPlaced',
]);

export const DEEP_CROSSING_REQUIREMENTS = Object.freeze([
  'heardBox',
  'heardBird',
  'birdSolved',
  'lensPlaced',
  'glyphsSeen',
  'hatchCodeDecoded',
  'shadowRevealed',
  'hatchOpen',
  'plumbHung',
]);

export const SURFACE_REQUIREMENTS = Object.freeze([
  ...FIRST_CROSSING_REQUIREMENTS,
  ...DEEP_CROSSING_REQUIREMENTS,
]);

// Nodes describe local causality; gates describe the proof required to cross a
// threshold. A gate deliberately lists every important surface act rather than only
// its last consequence, so a malformed/debug state cannot silently skip the game.
export const CHALLENGE_NODES = Object.freeze({
  refugeLit: Object.freeze({ requires: [] }),
  valveTurned: Object.freeze({ requires: [] }),
  crankUsed: Object.freeze({ requires: [] }),
  rulerPlaced: Object.freeze({ requires: ['valveTurned', 'rulerTaken'] }),
  heardBox: Object.freeze({ requires: [] }),
  heardBird: Object.freeze({ requires: ['crankUsed'] }),
  birdSolved: Object.freeze({ requires: ['heardBox', 'heardBird'] }),
  lensPlaced: Object.freeze({ requires: ['birdSolved', 'lensTaken'] }),
  glyphsSeen: Object.freeze({ requires: ['lensPlaced'] }),
  shadowRevealed: Object.freeze({ requires: ['rulerPlaced', 'crankUsed'] }),
  hatchCodeDecoded: Object.freeze({ requires: ['shadowRevealed'] }),
  hatchOpen: Object.freeze({ requires: ['hatchCodeDecoded'] }),
  plumbHung: Object.freeze({ requires: ['hatchOpen', 'plumbTaken'] }),
  upstreamHandWitnessed: Object.freeze({ requires: [] }),
  tideFigureSeen: Object.freeze({ requires: [] }),
  registerRead: Object.freeze({ requires: [] }),
  watcherSeen: Object.freeze({ requires: [] }),
  lowerHandRegarded: Object.freeze({ requires: [] }),
  dispositionChosen: Object.freeze({ requires: ['lowerHandRegarded'] }),
});

export const CHALLENGE_GATES = Object.freeze({
  surfaceFirst: Object.freeze({ requires: FIRST_CROSSING_REQUIREMENTS }),
  surfaceDeep: Object.freeze({ requires: SURFACE_REQUIREMENTS }),
  level2: Object.freeze({ requires: Object.freeze(['upstreamHandWitnessed', 'tideFigureSeen']) }),
  level3: Object.freeze({ requires: Object.freeze(['registerRead', 'watcherSeen']) }),
  level4: Object.freeze({ requires: Object.freeze(['lowerHandRegarded', 'dispositionChosen']) }),
});

const truthy = (state, id) => state?.[id] === true;

export class ChallengeGraph {
  constructor({ nodes = CHALLENGE_NODES, gates = CHALLENGE_GATES } = {}) {
    this.nodes = nodes;
    this.gates = gates;
  }

  missing(gate, state) {
    const spec = this.gates[gate];
    if (!spec) throw new Error(`Unknown challenge gate: ${gate}`);
    return spec.requires.filter((id) => !truthy(state, id));
  }

  ready(gate, state) {
    return this.missing(gate, state).length === 0;
  }

  missingFor(node, state) {
    const spec = this.nodes[node];
    if (!spec) throw new Error(`Unknown challenge node: ${node}`);
    return spec.requires.filter((id) => !truthy(state, id));
  }

  canComplete(node, state) {
    return this.missingFor(node, state).length === 0;
  }
}

export const PROGRESSION = new ChallengeGraph();

export const LOWER_HAND_REGARD = Object.freeze({
  seconds: 2.6,
  maxDistance: 2.4,
  minLookDot: 0.82,
  maxSpeed: 0.4,
  decayPerSecond: 1.25,
});

export function challengeState(world, notebook) {
  const flags = world?.flags || {};
  const has = (id) => notebook?.has?.(id) === true;
  return {
    ...flags,
    lensPlaced: world?.lensPlaced === true,
    beamGlyphEvidence: has(NOTE_IDS.beamGlyphs),
  };
}

export function missingRequirements(gate, world, notebook) {
  return PROGRESSION.missing(gate, challengeState(world, notebook));
}

export function canOpenChest(world) {
  return world?.flags?.valveTurned === true && Number(world?.tide) <= 0.28;
}

export function canRevealShimmer(world, golden) {
  return golden === true && world?.flags?.rulerPlaced === true && world?.flags?.crankUsed === true;
}

export function canAttemptStoneSong(world) {
  return world?.flags?.heardBox === true && world?.flags?.heardBird === true;
}

export function advanceDecimalDial(value) {
  const n = Number.isFinite(value) ? Math.trunc(value) : 0;
  return ((n + 1) % 10 + 10) % 10;
}

export function hatchCodeMatches(dials, code) {
  return Array.isArray(dials) && Array.isArray(code)
    && dials.length === code.length
    && dials.every((value, i) => value === code[i]);
}

export function advanceLowerHandRegard(previous, { dt, distance, lookDot, speed }) {
  const elapsed = Math.max(0, Number(dt) || 0);
  const held = distance < LOWER_HAND_REGARD.maxDistance
    && lookDot > LOWER_HAND_REGARD.minLookDot
    && speed < LOWER_HAND_REGARD.maxSpeed;
  const seconds = held
    ? Math.min(Math.max(0, previous) + elapsed, LOWER_HAND_REGARD.seconds)
    : Math.max(Math.max(0, previous) - elapsed * LOWER_HAND_REGARD.decayPerSecond, 0);
  return { held, seconds, complete: seconds >= LOWER_HAND_REGARD.seconds };
}

// Pure plate decision. `armed` is session state owned by the hotspot; committed
// world state lives in flags. Every result is an instruction, never a side effect.
export function nextPlateAction({ world, notebook, maxDepth = 4, armed = false }) {
  const flags = world?.flags || {};
  const level = Math.max(1, Number(world?.level) || 1);

  if (level <= 1 && flags.returned) {
    if (flags.endingCommitted) return { kind: 'complete' };
    return { kind: 'blocked', gate: 'refuge-return', missing: ['endingCommitted'] };
  }

  if (level <= 1) {
    const gate = flags.receiverReturned ? 'surfaceDeep' : 'surfaceFirst';
    const missing = missingRequirements(gate, world, notebook);
    if (missing.length) return { kind: 'blocked', gate, missing };
    return { kind: armed ? 'descend' : 'arm-descent', route: gate };
  }

  // The first encounter with the receiver closes a loop instead of continuing
  // down. The same L2 plate descends on the second visit, so this is a braid in
  // one physical grammar rather than a menu or a one-off teleport.
  if (level === 2 && !flags.receiverReturned && !flags.climbing) {
    const missing = missingRequirements('level2', world, notebook);
    if (missing.length) return { kind: 'blocked', gate: 'level2', missing };
    return { kind: armed ? 'ascend' : 'arm-ascent', route: 'receiver-return' };
  }

  const ascending = flags.climbing === true || level >= maxDepth;
  if (ascending) {
    if (level <= 1) return { kind: 'blocked', gate: 'surface-return', missing: ['returned'] };
    if (level >= maxDepth && !flags.climbing) {
      const missing = missingRequirements('level4', world, notebook);
      if (missing.length) return { kind: 'blocked', gate: 'level4', missing };
    }
    return { kind: armed ? 'ascend' : 'arm-ascent' };
  }

  const gate = level === 2 ? 'level2' : 'level3';
  const missing = missingRequirements(gate, world, notebook);
  if (missing.length) return { kind: 'blocked', gate, missing };
  return { kind: armed ? 'descend' : 'arm-descent' };
}
