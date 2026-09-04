import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEEP_CROSSING_REQUIREMENTS, FIRST_CROSSING_REQUIREMENTS,
  NOTE_IDS, PROGRESSION, SURFACE_REQUIREMENTS, advanceDecimalDial,
  advanceLowerHandRegard, canAttemptStoneSong, canOpenChest, canRevealShimmer,
  challengeState, hatchCodeMatches, missingRequirements,
  nextPlateAction,
} from '../js/progression.js';

const notebook = (...ids) => {
  const held = new Set(ids);
  return { has: (id) => held.has(id) };
};

function world(level = 1, flags = {}) {
  return {
    level,
    tide: 1,
    lensPlaced: false,
    flags: {
      valveTurned: false, crankUsed: false, rulerTaken: false, rulerPlaced: false,
      refugeLit: false, receiverReturned: false,
      heardBox: false, heardBird: false, birdSolved: false, lensTaken: false,
      glyphsSeen: false, hatchCodeDecoded: false, shadowRevealed: false,
      hatchOpen: false, plumbTaken: false, plumbHung: false,
      upstreamHandWitnessed: false, tideFigureSeen: false,
      registerRead: false, watcherSeen: false,
      lowerHandRegarded: false, dispositionChosen: false,
      climbing: false, returned: false, endingCommitted: false,
      ...flags,
    },
  };
}

function completeSurface() {
  const w = world(1);
  for (const id of SURFACE_REQUIREMENTS) {
    if (id === 'lensPlaced') continue;
    w.flags[id] = true;
  }
  w.lensPlaced = true;
  w.flags.rulerTaken = true;
  w.flags.lensTaken = true;
  w.flags.plumbTaken = true;
  return w;
}

test('surface gate lists every authored act and reports exact missing evidence', () => {
  assert.deepEqual(SURFACE_REQUIREMENTS, [
    'refugeLit', 'valveTurned', 'crankUsed', 'rulerPlaced', 'heardBox', 'heardBird',
    'birdSolved', 'lensPlaced', 'glyphsSeen',
    'hatchCodeDecoded', 'shadowRevealed', 'hatchOpen', 'plumbHung',
  ]);
  const w = completeSurface();
  assert.deepEqual(missingRequirements('surfaceDeep', w, notebook()), []);
});

test('the first crossing asks for shelter and mastery, not the whole escape room', () => {
  assert.deepEqual(FIRST_CROSSING_REQUIREMENTS, [
    'refugeLit', 'valveTurned', 'crankUsed', 'rulerPlaced',
  ]);
  assert.deepEqual(DEEP_CROSSING_REQUIREMENTS, [
    'heardBox', 'heardBird', 'birdSolved', 'lensPlaced', 'glyphsSeen',
    'hatchCodeDecoded', 'shadowRevealed', 'hatchOpen', 'plumbHung',
  ]);
  const first = world(1, { refugeLit: true, valveTurned: true, crankUsed: true, rulerPlaced: true });
  assert.deepEqual(nextPlateAction({ world: first }), {
    kind: 'arm-descent', route: 'surfaceFirst',
  });
});

test('node causality prevents completing consequences before their evidence', () => {
  const s = challengeState(world(), notebook());
  assert.deepEqual(PROGRESSION.missingFor('birdSolved', s), ['heardBox', 'heardBird']);
  assert.deepEqual(PROGRESSION.missingFor('hatchCodeDecoded', s), ['shadowRevealed']);
  assert.deepEqual(PROGRESSION.missingFor('dispositionChosen', s), ['lowerHandRegarded']);
});

test('chest only yields after the turned valve has physically drained the tide', () => {
  const w = world(1, { valveTurned: true });
  w.tide = 0.29;
  assert.equal(canOpenChest(w), false);
  w.tide = 0.28;
  assert.equal(canOpenChest(w), true);
  w.flags.valveTurned = false;
  assert.equal(canOpenChest(w), false);
});

test('stone song and golden shimmer each require both halves of their setup', () => {
  const w = world(1, { heardBox: true });
  assert.equal(canAttemptStoneSong(w), false);
  w.flags.heardBird = true;
  assert.equal(canAttemptStoneSong(w), true);

  assert.equal(canRevealShimmer(w, true), false);
  w.flags.rulerPlaced = true;
  assert.equal(canRevealShimmer(w, true), false);
  w.flags.crankUsed = true;
  assert.equal(canRevealShimmer(w, false), false);
  assert.equal(canRevealShimmer(w, true), true);
});

test('the hatch solve is proved only by manipulating revealed dials', () => {
  const hidden = challengeState(world(), notebook(NOTE_IDS.beamGlyphs));
  assert.equal(PROGRESSION.canComplete('hatchCodeDecoded', hidden), false);
  const revealed = challengeState(world(1, { shadowRevealed: true }), notebook());
  assert.equal(PROGRESSION.canComplete('hatchCodeDecoded', revealed), true);
});

test('hatch controls are decimal and compare all four positions exactly', () => {
  assert.equal(advanceDecimalDial(8), 9);
  assert.equal(advanceDecimalDial(9), 0);
  assert.equal(advanceDecimalDial(-1), 0);
  assert.equal(advanceDecimalDial(Number.NaN), 1);
  assert.equal(hatchCodeMatches([5, 1, 4, 6], [5, 1, 4, 6]), true);
  assert.equal(hatchCodeMatches([5, 1, 4, 5], [5, 1, 4, 6]), false);
  assert.equal(hatchCodeMatches([5, 1, 4], [5, 1, 4, 6]), false);
});

test('surface plate blocks on missing work, then uses an explicit two-touch descent', () => {
  const nb = notebook();
  const incomplete = completeSurface();
  incomplete.flags.heardBird = false;
  incomplete.flags.receiverReturned = true;
  assert.deepEqual(nextPlateAction({ world: incomplete, notebook: nb }), {
    kind: 'blocked', gate: 'surfaceDeep', missing: ['heardBird'],
  });

  const ready = completeSurface();
  ready.flags.receiverReturned = true;
  assert.deepEqual(nextPlateAction({ world: ready, notebook: nb }), {
    kind: 'arm-descent', route: 'surfaceDeep',
  });
  assert.deepEqual(nextPlateAction({ world: ready, notebook: nb, armed: true }), {
    kind: 'descend', route: 'surfaceDeep',
  });
});

test('each descent stratum is gated by its embodied challenge', () => {
  const l2 = world(2);
  assert.deepEqual(nextPlateAction({ world: l2 }), {
    kind: 'blocked', gate: 'level2', missing: ['upstreamHandWitnessed', 'tideFigureSeen'],
  });
  l2.flags.upstreamHandWitnessed = true;
  l2.flags.tideFigureSeen = true;
  assert.deepEqual(nextPlateAction({ world: l2 }), {
    kind: 'arm-ascent', route: 'receiver-return',
  });
  assert.deepEqual(nextPlateAction({ world: l2, armed: true }), {
    kind: 'ascend', route: 'receiver-return',
  });
  l2.flags.receiverReturned = true;
  assert.deepEqual(nextPlateAction({ world: l2 }), { kind: 'arm-descent' });

  const l3 = world(3, { registerRead: true });
  assert.deepEqual(nextPlateAction({ world: l3 }), {
    kind: 'blocked', gate: 'level3', missing: ['watcherSeen'],
  });
  l3.flags.watcherSeen = true;
  assert.deepEqual(nextPlateAction({ world: l3, armed: true }), { kind: 'descend' });
});

test('the bottom requires regard and a disposition before the two-touch ascent', () => {
  const bottom = world(4, { lowerHandRegarded: true });
  assert.deepEqual(nextPlateAction({ world: bottom }), {
    kind: 'blocked', gate: 'level4', missing: ['dispositionChosen'],
  });
  bottom.flags.dispositionChosen = true;
  assert.deepEqual(nextPlateAction({ world: bottom }), { kind: 'arm-ascent' });
  assert.deepEqual(nextPlateAction({ world: bottom, armed: true }), { kind: 'ascend' });

  const climbing = world(3, { climbing: true });
  assert.deepEqual(nextPlateAction({ world: climbing }), { kind: 'arm-ascent' });
});

test('lower hand regard requires close gaze and stillness for a full 2.6 seconds', () => {
  let regard = advanceLowerHandRegard(0, { dt: 1.3, distance: 2.39, lookDot: 0.83, speed: 0.39 });
  assert.deepEqual(regard, { held: true, seconds: 1.3, complete: false });
  regard = advanceLowerHandRegard(regard.seconds, { dt: 1.3, distance: 2.39, lookDot: 0.83, speed: 0.39 });
  assert.deepEqual(regard, { held: true, seconds: 2.6, complete: true });

  assert.equal(advanceLowerHandRegard(2, { dt: 0.1, distance: 2.4, lookDot: 1, speed: 0 }).held, false);
  assert.equal(advanceLowerHandRegard(2, { dt: 0.1, distance: 2, lookDot: 0.82, speed: 0 }).held, false);
  assert.equal(advanceLowerHandRegard(2, { dt: 0.1, distance: 2, lookDot: 1, speed: 0.4 }).held, false);
});

test('the returned surface plate directs commitment back to the refuge', () => {
  const returned = world(1, { returned: true });
  assert.deepEqual(nextPlateAction({ world: returned }), {
    kind: 'blocked', gate: 'refuge-return', missing: ['endingCommitted'],
  });
  returned.flags.endingCommitted = true;
  assert.deepEqual(nextPlateAction({ world: returned, armed: true }), { kind: 'complete' });
});

test('puzzle runtime contains no legacy journal or identity-ending authority', async () => {
  const source = await readFile(new URL('../js/puzzles.js', import.meta.url), 'utf8');
  for (const retired of [
    'UI.addJournal', 'W.readKeys', 'fragmentsFound', 'W.flags.keeperRose',
    'W.flags.carried', 'onFinale', 'onLeave', 'A.say(',
  ]) {
    assert.equal(source.includes(retired), false, `retired runtime path remains: ${retired}`);
  }
});
