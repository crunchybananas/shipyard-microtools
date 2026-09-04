import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packSave } from '../js/save-schema.js';
import {
  REPORT_VERSION, STABLE_PLAY_REPLAY, OBSERVATION_ONLY,
  REPORT_THUMBNAIL_MAX_CHARS, observationOnly, parseFieldReport, parseReplayReport, stablePlayReplay,
} from '../js/report-schema.js';

const world = () => ({
  disposition: 'tend', endingOutcome: null,
  time: 7.4, tideTarget: 1, lensPlaced: false, beamAngle: 2.2,
  flags: {}, stems: 0, inventory: [], notebook: { entries: [], hintLevels: {} },
  level: 1, onceKeys: [], recDisp: {}, dials: [0, 0, 0, 0],
  regions: { l2seen: false, l3seen: false, l4seen: false },
});

const report = (overrides = {}) => ({
  v: REPORT_VERSION,
  t: '2026-09-04T01:29:16.424Z',
  mode: 'play',
  replay: { kind: STABLE_PLAY_REPLAY, atTop: false },
  pos: [4, 14.5, -104],
  yaw: 2.19,
  pitch: 0.05,
  save: packSave(world()),
  ...overrides,
});

test('stable play reports carry a discriminated gallery-aware replay state', () => {
  assert.deepEqual(stablePlayReplay('play', true), { kind: STABLE_PLAY_REPLAY, atTop: true });
  assert.throws(() => stablePlayReplay('dive', false), /settled play only/);

  const parsed = parseReplayReport(JSON.stringify(report({
    replay: { kind: STABLE_PLAY_REPLAY, atTop: true },
  })));
  assert.equal(parsed.atTop, true);
  assert.deepEqual(parsed.pos, [4, 14.5, -104]);
});

test('unsettled frames remain valid observation reports but cannot be replayed', () => {
  const finale = report({
    mode: 'finale',
    replay: observationOnly('finale', 'the finale is active'),
    thumbnail: 'data:image/jpeg;base64,frame',
  });
  const parsed = parseFieldReport(finale);
  assert.equal(parsed.replayable, false);
  assert.equal(parsed.report.replay.kind, OBSERVATION_ONLY);
  assert.equal(parsed.report.thumbnail, 'data:image/jpeg;base64,frame');
  assert.throws(() => parseReplayReport(finale), /observation-only finale report/);
});

test('observation reports retain their actual runtime mode', () => {
  for (const mode of ['title', 'intro', 'dive', 'ascend', 'finale']) {
    const captured = report({
      mode,
      replay: observationOnly(mode, `${mode} is active`),
    });
    const parsed = parseFieldReport(captured);
    assert.equal(parsed.report.mode, mode);
    assert.equal(parsed.report.replay.mode, mode);
    assert.equal(parsed.replayable, false);
  }
  assert.throws(() => observationOnly('inventory', 'unsupported'), /unsupported field report mode/);
  assert.throws(() => parseFieldReport(report({
    mode: 'inventory',
    replay: { kind: OBSERVATION_ONLY, mode: 'inventory', reason: 'unsupported' },
  })), /unsupported field report mode/);
});

test('report validation rejects malformed capture kinds, poses, and non-current saves', () => {
  for (const bad of [
    report({ replay: { kind: 'cinematic', atTop: false } }),
    report({ replay: { kind: STABLE_PLAY_REPLAY } }),
    report({ mode: 'dive', replay: { kind: OBSERVATION_ONLY, mode: 'ascent', reason: 'moving' } }),
    report({ thumbnail: `data:image/jpeg;base64,${'x'.repeat(REPORT_THUMBNAIL_MAX_CHARS)}` }),
    report({ pos: [4, Number.NaN, -104] }),
    report({ save: { v: 1 } }),
    report({ save: { ...packSave(world()), v: 0 } }),
  ]) assert.throws(() => parseFieldReport(bad));
});

test('report validation does not mutate its input', () => {
  const input = report();
  const before = structuredClone(input);
  parseFieldReport(input);
  assert.deepEqual(input, before);
});
