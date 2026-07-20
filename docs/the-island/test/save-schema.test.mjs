// save-schema.test.mjs — headless node tests for the save contract (#74).
//
// Run:  node --test "docs/the-island/test/*.test.mjs"
//
// save-schema.js is dependency-free (no three.js / DOM / localStorage) exactly
// so this file can exercise the full save→load round-trip and the v1→v2
// migration without a browser. world.js itself imports 'three' via the page
// importmap and is not node-loadable — which is why the schema lives apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION, SAVE_KEY, SAVE_KEY_PREV, SAVE_FIELDS, MIGRATIONS,
  packSave, applySave, migrateSave,
} from '../js/save-schema.js';

// A W-shaped fixture covering the persisted subset (mirrors world.js defaults).
// applySave only requires flags/regions to exist as objects (merge targets);
// everything else is assigned outright.
function freshState() {
  return {
    time: 7.4,
    tide: 1, tideTarget: 1,
    lensPlaced: false,
    beamAngle: 2.2,
    flags: {
      introDone: false, enteredStudy: false, valveTurned: false, crankUsed: false,
      rulerTaken: false, rulerPlaced: false, chestOpen: false, heardBox: false,
      heardBird: false, birdSolved: false, lensTaken: false, shadowRevealed: false,
      glyphsSeen: false, hatchOpen: false, plumbTaken: false, plumbHung: false,
      dove: false, climbing: false, keeperSilenced: false, returned: false, bellRung: false,
    },
    stems: 0,
    inventory: [],
    journal: [],
    onceKeys: [],
    readKeys: [],
    dials: [0, 0, 0, 0],
    playerPos: null,
    playerLook: null,
    level: 1,
    regions: { l2seen: false, l3seen: false, l4seen: false, fragmentsFound: [] },
  };
}

test('payload is stamped with the current version and exactly the table fields', () => {
  const p = packSave(freshState(), null);
  assert.equal(p.v, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 3);
  const expected = new Set(['v', ...SAVE_FIELDS.map((f) => f.key)]);
  assert.deepEqual(new Set(Object.keys(p)), expected);
  assert.equal(SAVE_KEY, 'abyme-save-v1'); // frozen: renaming orphans every save
  assert.equal(SAVE_KEY_PREV, 'abyme-save-v1-prev'); // frozen too: the begin-anew stash (#56)
});

test('save → load round-trips every field through JSON', () => {
  const a = freshState();
  a.time = 18.25;
  a.tideTarget = 0.4; a.tide = 0.7; // mid-drain: the TARGET is what persists
  a.lensPlaced = true;
  a.beamAngle = 1.1;
  a.flags.introDone = true; a.flags.rulerTaken = true; a.flags.chestOpen = true; a.flags.dove = true;
  a.stems = 3;
  a.inventory = ['lens', 'plumb'];
  a.journal = [{ text: 'the same sand', sketch: '' }];
  a.onceKeys = ['introFlight'];
  a.readKeys = ['frag-01', 'frag-07'];
  a.dials = [2, 0, 3, 1];
  a.level = 3;
  a.regions = { l2seen: true, l3seen: true, l4seen: false, fragmentsFound: ['f1'] };

  // the player-like ctx: position AND facing persist (#58, v3)
  const pos = { x: 4.5, y: 0, z: -104.25 };
  const wire = JSON.parse(JSON.stringify(packSave(a, { pos, yaw: 2.1, pitch: -0.4 })));

  const b = freshState();
  applySave(b, wire);

  assert.equal(b.time, 18.25);
  assert.equal(b.tide, 0.4);
  assert.equal(b.tideTarget, 0.4);
  assert.equal(b.lensPlaced, true);
  assert.equal(b.beamAngle, 1.1);
  assert.equal(b.flags.introDone, true);
  assert.equal(b.flags.rulerTaken, true);
  assert.equal(b.flags.dove, true);
  assert.equal(b.flags.bellRung, false); // untouched default survives the merge
  assert.equal(b.stems, 3);
  assert.deepEqual(b.inventory, ['lens', 'plumb']);
  assert.deepEqual(b.journal, [{ text: 'the same sand', sketch: '' }]);
  assert.deepEqual(b.onceKeys, ['introFlight']);
  assert.deepEqual(b.readKeys, ['frag-01', 'frag-07']);
  assert.deepEqual(b.dials, [2, 0, 3, 1]);
  assert.equal(b.level, 3);
  assert.deepEqual(b.regions, { l2seen: true, l3seen: true, l4seen: false, fragmentsFound: ['f1'] });
  assert.deepEqual(b.playerPos, [4.5, 0, -104.25]); // plain array; world.js makes the Vector3
  assert.deepEqual(b.playerLook, [2.1, -0.4]);      // the facing rides along (#58)
});

test('a synthetic v1 payload (no version int) migrates and loads', () => {
  // exactly what world.js wrote before the version stamp existed — including a
  // flags object from before chestOpen was persisted at all.
  const v1 = {
    time: 9.1,
    tide: 0,
    lensPlaced: false,
    beamAngle: 2.2,
    flags: { introDone: true, enteredStudy: true, valveTurned: true, rulerTaken: true },
    stems: 1,
    inventory: ['ruler'],
    journal: [],
    level: 1,
    onceKeys: [], readKeys: [], dials: [1, 1, 1, 1],
    regions: { l2seen: false, l3seen: false, l4seen: false, fragmentsFound: [] },
    pos: [10, 0, -90],
  };

  const migrated = migrateSave(JSON.parse(JSON.stringify(v1)));
  assert.equal(migrated.v, SAVE_VERSION);
  // v1→v2 heuristic: the taken ruler proves the chest lid was open
  assert.equal(migrated.flags.chestOpen, true);

  const w = freshState();
  applySave(w, JSON.parse(JSON.stringify(v1)));
  assert.equal(w.flags.chestOpen, true);
  assert.equal(w.flags.rulerTaken, true);
  assert.equal(w.time, 9.1);
  assert.equal(w.tide, 0); // tide 0 (drained) must survive ?? — falsy but valid
  assert.equal(w.stems, 1);
  assert.deepEqual(w.inventory, ['ruler']);
  assert.deepEqual(w.dials, [1, 1, 1, 1]);
  assert.deepEqual(w.playerPos, [10, 0, -90]);
  assert.equal(w.playerLook, null); // pre-v3: no facing in the save
});

test('a v2 payload (pre-look) migrates to v3 with the facing unset', () => {
  const migrated = migrateSave({ v: 2, flags: {} });
  assert.equal(migrated.v, SAVE_VERSION);
  const w = freshState();
  w.playerLook = [1, 1]; // a stale pre-load value must not survive the apply
  applySave(w, { v: 2, flags: { introDone: true } });
  assert.equal(w.playerLook, null);
  assert.equal(w.flags.introDone, true);
});

test('v1 migration respects an explicit chestOpen:false', () => {
  const migrated = migrateSave({ flags: { rulerTaken: true, chestOpen: false } });
  assert.equal(migrated.flags.chestOpen, false); // present in the save = trusted
});

test('mid-dive saves land the dive on load — any version', () => {
  // flag('dove') saves at the plate-touch; W.level increments seconds later at
  // the dive-cinematic snap. Quit in that window and the save says dove+level 1.
  for (const payload of [
    { flags: { dove: true }, level: 1 },                    // v1 shape
    { v: 2, flags: { dove: true }, level: 1 },              // v2 shape
    { v: 3, flags: { dove: true }, level: 1 },              // current shape
  ]) {
    const w = freshState();
    applySave(w, payload);
    assert.equal(w.level, 2, `dive not landed for payload v=${payload.v ?? 1}`);
  }
});

test('an empty/partial payload lands every documented default', () => {
  const w = freshState();
  w.time = 12; w.beamAngle = 0.5; // pre-load values the ?? fallbacks should keep
  applySave(w, {});
  assert.equal(w.time, 12);
  assert.equal(w.beamAngle, 0.5);
  assert.equal(w.tide, 1);
  assert.equal(w.tideTarget, 1);
  assert.equal(w.lensPlaced, false);
  assert.equal(w.stems, 0);
  assert.deepEqual(w.inventory, []);
  assert.deepEqual(w.journal, []);
  assert.deepEqual(w.onceKeys, []);
  assert.deepEqual(w.readKeys, []);
  assert.deepEqual(w.dials, [0, 0, 0, 0]);
  assert.equal(w.level, 1);
  assert.equal(w.playerPos, null);
  assert.equal(w.playerLook, null);
});

test('malformed dials/look reset; regions/flags merges keep new default keys', () => {
  const w = freshState();
  applySave(w, {
    v: 3,
    dials: [1, 2],                       // wrong length → reset
    look: [1.5],                         // wrong length → null (fallback facing)
    regions: { l2seen: true },           // no fragmentsFound in the save
    flags: { introDone: true },          // sparse flags
  });
  assert.deepEqual(w.dials, [0, 0, 0, 0]);
  assert.equal(w.playerLook, null);
  const w2 = freshState();
  applySave(w2, { v: 3, look: ['a', 'b'] }); // non-numeric → null
  assert.equal(w2.playerLook, null);
  assert.equal(w.regions.l2seen, true);
  assert.deepEqual(w.regions.fragmentsFound, []); // default key survived the merge
  assert.equal(w.flags.introDone, true);
  assert.equal(w.flags.valveTurned, false);       // default flag survived the merge
});

test('a payload from a NEWER build loads best-effort, never wipes', () => {
  const w = freshState();
  applySave(w, { v: 99, time: 3.3, level: 2, someFutureField: { deep: true } });
  assert.equal(w.time, 3.3);
  assert.equal(w.level, 2);
});

test('the migration chain is contiguous and ends at SAVE_VERSION', () => {
  // guards the next person who bumps SAVE_VERSION without writing the step
  let v = 1;
  for (const m of MIGRATIONS) {
    assert.equal(m.from, v, 'migration chain has a gap');
    assert.equal(m.to, v + 1, 'migrations must step one version at a time');
    v = m.to;
  }
  assert.equal(v, SAVE_VERSION, 'no migration path reaches SAVE_VERSION');
});
