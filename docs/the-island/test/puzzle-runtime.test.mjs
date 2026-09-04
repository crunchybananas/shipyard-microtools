import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetPuzzleRuntimeState } from '../js/puzzle-runtime.js';

const RUNTIME_FIELDS = [
  'anim', 'stoneSeq', 'songSeq', 'birdTimer', 'boxPlaying', 'glyphsLit', 'hallLit',
  '_brink', '_pendHour', '_pendHold', '_crankAcc', '_crankAcc2', '_eraLineT',
  '_lawT', '_breachT', '_farewellT', '_farewellA0', '_regT', '_buoyT', '_buoyRing',
  '_watcherRegard', '_tideRegard', '_tfPrev', 'watcherEchoT', 'tideFigureEchoT',
  '_lowerLook', '_lowerLookTarget', '_lowerRegard', '_lowerPrev',
  '_tabMoor', '_tabMoorSaved', '_tabLog', '_tabLogSaved', '_tabLogP', '_tabLight',
  '_tabWind', '_tabWindChirped', '_causewayNoted', '_lampLitOnce', '_walkedBridge',
  '_sawOarNudge', '_level2Study', '_leftStudy', '_roomDisagrees', '_marks', '_marksFor',
  '_heardMarks', '_markCool', '_writingFor', '_upstreamAudioStop',
];

test('puzzle runtime reset covers every transient field with fresh containers', () => {
  const first = resetPuzzleRuntimeState({ stale: 'persistent dependency' });
  assert.deepEqual(Object.keys(first).filter((key) => key !== 'stale').sort(), [...RUNTIME_FIELDS].sort());

  assert.equal(first.birdTimer, 8);
  assert.equal(first.boxPlaying, false);
  assert.deepEqual(first.stoneSeq, []);
  assert.deepEqual(first.songSeq, []);
  assert.deepEqual(first.anim.stoneGlow, [0, 0, 0, 0, 0, 0]);
  assert.equal(first._breachT, null);
  assert.equal(first._farewellT, null);
  assert.equal(first.watcherEchoT, null);
  assert.equal(first.tideFigureEchoT, null);
  assert.ok(first._heardMarks instanceof Set);
  assert.equal(first._heardMarks.size, 0);

  first.stoneSeq.push(2);
  first.anim.stoneGlow[2] = 1;
  first._heardMarks.add('old-hand');
  const second = resetPuzzleRuntimeState({});
  assert.notEqual(second.stoneSeq, first.stoneSeq);
  assert.notEqual(second.anim, first.anim);
  assert.notEqual(second.anim.stoneGlow, first.anim.stoneGlow);
  assert.notEqual(second._heardMarks, first._heardMarks);
});
