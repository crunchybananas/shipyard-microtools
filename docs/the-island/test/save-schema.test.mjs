import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION, SAVE_KEY, SAVE_FLAG_DEFAULTS, SAVE_FIELDS, packSave, applySave,
  isCurrentSavePayload,
} from '../js/save-schema.js';

function freshState() {
  return {
    time: 7.4,
    tide: 1, tideTarget: 1,
    lensPlaced: false,
    beamAngle: 2.2,
    disposition: 'tend',
    endingOutcome: null,
    flags: {
      introDone: false, enteredStudy: false, valveTurned: false, crankUsed: false,
      rulerTaken: false, rulerPlaced: false, chestOpen: false, heardBox: false,
      heardBird: false, birdSolved: false, lensTaken: false, shadowRevealed: false,
      glyphsSeen: false, hatchCodeDecoded: false, hatchOpen: false,
      plumbTaken: false, plumbHung: false, dove: false, climbing: false,
      returned: false, upstreamHandSurged: false, upstreamHandWitnessed: false, registerRead: false,
      lowerHandRegarded: false, dispositionChosen: false, endingCommitted: false,
    },
    stems: 0,
    inventory: [],
    notebook: { entries: [], hintLevels: {} },
    onceKeys: [],
    recDisp: {},
    dials: [0, 0, 0, 0],
    playerPos: null,
    playerLook: null,
    level: 1,
    regions: { l2seen: false, l3seen: false, l4seen: false },
  };
}

test('the current contract has one clean storage key', () => {
  const payload = packSave(freshState(), null);
  assert.equal(payload.v, 2);
  assert.equal(SAVE_VERSION, 2);
  assert.equal(SAVE_KEY, 'abyme-save');
  assert.deepEqual(new Set(Object.keys(payload)), new Set(['v', ...SAVE_FIELDS.map((f) => f.key)]));
  assert.deepEqual(Object.keys(payload.flags), Object.keys(SAVE_FLAG_DEFAULTS));
  assert.ok(!('journal' in payload));
  assert.ok(!('readKeys' in payload));
  assert.ok(!('fragmentsFound' in payload.regions));
});

test('save and load round-trip stable evidence and the full progression state', () => {
  const before = freshState();
  before.time = 18.25;
  before.tideTarget = 0.4;
  before.lensPlaced = true;
  before.beamAngle = 1.1;
  before.disposition = 'carry';
  before.endingOutcome = { kind: 'carry', removed: 7 };
  before.flags.endingCommitted = true;
  before.flags.hatchCodeDecoded = true;
  before.flags.hatchOpen = true;
  before.flags.upstreamHandSurged = true;
  before.flags.upstreamHandWitnessed = true;
  before.flags.dispositionChosen = true;
  before.stems = 4;
  before.inventory = ['lens', 'plumb'];
  before.notebook.entries = [
    { id: 'evidence.beam-glyphs', args: { glyphs: [1, 5, 3, 4] } },
    { id: 'artifact.signal-shelf.surface' },
  ];
  before.notebook.hintLevels = { 'signal-hatch': 1 };
  before.onceKeys = ['introFlight'];
  before.recDisp = { field_slip: 'kept' };
  before.dials = [5, 1, 4, 6];
  before.level = 3;
  before.regions = { l2seen: true, l3seen: true, l4seen: false };
  const wire = JSON.parse(JSON.stringify(packSave(before, {
    pos: { x: 4.5, y: 0, z: -104.25 }, yaw: 2.1, pitch: -0.4,
  })));

  const after = freshState();
  assert.equal(applySave(after, wire), true);
  assert.equal(after.time, 18.25);
  assert.equal(after.tide, 0.4);
  assert.equal(after.tideTarget, 0.4);
  assert.equal(after.disposition, 'carry');
  assert.deepEqual(after.endingOutcome, { kind: 'carry', removed: 7 });
  assert.equal(after.flags.endingCommitted, true);
  assert.equal(after.flags.hatchCodeDecoded, true);
  assert.equal(after.flags.hatchOpen, true);
  assert.equal(after.flags.upstreamHandSurged, true);
  assert.equal(after.flags.upstreamHandWitnessed, true);
  assert.equal(after.stems, 4);
  assert.deepEqual(after.inventory, ['lens', 'plumb']);
  assert.deepEqual(after.notebook, before.notebook);
  assert.deepEqual(after.onceKeys, ['introFlight']);
  assert.deepEqual(after.recDisp, { field_slip: 'kept' });
  assert.deepEqual(after.dials, [5, 1, 4, 6]);
  assert.equal(after.level, 3);
  assert.deepEqual(after.regions, before.regions);
  assert.deepEqual(after.playerPos, [4.5, 0, -104.25]);
  assert.deepEqual(after.playerLook, [2.1, -0.4]);
});

test('the upstream physical effect persists before its later observation', () => {
  const before = freshState();
  before.tideTarget = 1.44;
  before.flags.upstreamHandSurged = true;
  before.flags.upstreamHandWitnessed = false;

  const after = freshState();
  assert.equal(applySave(after, JSON.parse(JSON.stringify(packSave(before)))), true);
  assert.equal(after.tideTarget, 1.44);
  assert.equal(after.flags.upstreamHandSurged, true);
  assert.equal(after.flags.upstreamHandWitnessed, false);
});

test('anything except the current payload version is rejected without mutating state', () => {
  for (const payload of [
    { time: 9, journal: [{ text: 'old' }] },
    { v: 3, time: 9, readKeys: ['old'] },
    { v: 1, time: 9 },
  ]) {
    const state = freshState();
    assert.equal(applySave(state, payload), false);
    assert.equal(state.time, 7.4);
    assert.deepEqual(state.notebook.entries, []);
  }
});

test('malformed current data is normalized at the boundary', () => {
  const state = freshState();
  const applied = applySave(state, {
    v: 2,
    flags: { introDone: true, valveTurned: 'yes', retiredFlag: true },
    inventory: ['lens', 'lens', 'retired-item', 4, 'phial'],
    recDisp: {
      field_slip: 'kept',
      closure_notice: 'burned',
      retired_record: 'carried',
    },
    notebook: {
      entries: [null, { id: 'retired.answer' }, { id: 'evidence.valve' }, { id: 'evidence.valve' }, { nope: true }],
      hintLevels: { retired: 2, 'surface-circuit': 99, negative: -1, float: 1.5 },
    },
    dials: [3, 10, -1, 5],
    regions: { l2seen: 1 },
    pos: [1, 'bad', 3],
    look: [1],
    disposition: 'invented',
    endingOutcome: { kind: 'carry', removed: -5 },
  });
  assert.equal(applied, true);
  assert.deepEqual(state.notebook, {
    entries: [{ id: 'evidence.valve' }],
    hintLevels: { 'surface-circuit': 2 },
  });
  assert.deepEqual(state.dials, [3, 0, 0, 5]);
  assert.deepEqual(state.regions, { l2seen: true, l3seen: false, l4seen: false });
  assert.equal(state.playerPos, null);
  assert.equal(state.playerLook, null);
  assert.equal(state.disposition, 'tend');
  assert.equal(state.endingOutcome, null);
  assert.equal(state.flags.introDone, true);
  assert.equal(state.flags.valveTurned, false);
  assert.equal('retiredFlag' in state.flags, false);
  assert.deepEqual(state.inventory, ['lens', 'phial']);
  assert.deepEqual(state.recDisp, { field_slip: 'kept' });
});

test('ending commitment, disposition, and outcome remain one consistent unit', () => {
  const valid = freshState();
  valid.disposition = 'carry';
  valid.endingOutcome = { kind: 'carry', removed: 7 };
  valid.flags.endingCommitted = true;
  const validWire = packSave(valid);
  assert.deepEqual(validWire.endingOutcome, { kind: 'carry', removed: 7 });
  assert.equal(validWire.flags.endingCommitted, true);

  for (const payload of [
    { v: 2, disposition: 'open', endingOutcome: { kind: 'carry', removed: 7 }, flags: { endingCommitted: true } },
    { v: 2, disposition: 'carry', endingOutcome: null, flags: { endingCommitted: true } },
    { v: 2, disposition: 'close', endingOutcome: { kind: 'close' }, flags: { endingCommitted: false } },
  ]) {
    const state = freshState();
    assert.equal(applySave(state, payload), true);
    assert.equal(state.flags.endingCommitted, false);
    assert.equal(state.endingOutcome, null);
  }

  const inconsistent = freshState();
  inconsistent.disposition = 'open';
  inconsistent.endingOutcome = { kind: 'carry', removed: 3 };
  inconsistent.flags.endingCommitted = true;
  const packed = packSave(inconsistent);
  assert.equal(packed.flags.endingCommitted, false);
  assert.equal(packed.endingOutcome, null);
});

test('current save recognition is non-mutating and version-exact', () => {
  const payload = packSave(freshState());
  assert.equal(isCurrentSavePayload(payload), true);
  assert.equal(isCurrentSavePayload({ ...payload, v: 1 }), false);
  assert.equal(isCurrentSavePayload(null), false);
});

test('packing cannot expand the contract with accidental runtime state', () => {
  const state = freshState();
  state.flags.retiredFlag = true;
  state.inventory = ['plumb', 'retired-item', 'plumb'];
  state.recDisp = { transfer_offer: 'filed', mystery: 'carried', field_slip: 'burned' };
  const payload = packSave(state);
  assert.equal('retiredFlag' in payload.flags, false);
  assert.deepEqual(payload.inventory, ['plumb']);
  assert.deepEqual(payload.recDisp, { transfer_offer: 'filed' });
});

test('crossing flags never rewrite the saved rung', () => {
  const state = freshState();
  assert.equal(applySave(state, { v: 2, flags: { dove: true }, level: 1 }), true);
  assert.equal(state.level, 1);
  assert.equal(state.flags.dove, true);
});

test('hatch flags persist only as one exact solved mechanical state', () => {
  const solved = freshState();
  solved.dials = [5, 1, 4, 6];
  solved.flags.hatchCodeDecoded = true;
  solved.flags.hatchOpen = true;
  const wire = packSave(solved);
  assert.equal(wire.flags.hatchCodeDecoded, true);
  assert.equal(wire.flags.hatchOpen, true);

  for (const broken of [
    { dials: [5, 1, 4, 6], flags: { hatchCodeDecoded: true, hatchOpen: false } },
    { dials: [5, 1, 4, 5], flags: { hatchCodeDecoded: true, hatchOpen: true } },
  ]) {
    const state = freshState();
    assert.equal(applySave(state, { v: 2, ...broken }), true);
    assert.equal(state.flags.hatchCodeDecoded, false);
    assert.equal(state.flags.hatchOpen, false);
  }
});
