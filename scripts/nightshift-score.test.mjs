import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  validateProject,
  clone,
  compileSong,
  locateBar,
  songBars,
  barSeconds,
  degreeMidi,
  MINOR,
  eventsForStep,
  macroAt,
} from "../docs/synth-studio/score.mjs";

test("all authored sessions survive strict serialization and have different scores", () => {
  const projects = [0, 1, 2].map(createProject);
  for (const p of projects) {
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
    assert.equal(songBars(p), 32);
    assert.equal(compileSong(p).length, 512);
  }
  assert.equal(new Set(projects.map((p) => JSON.stringify(p.scenes))).size, 3);
});
test("bar positions, swing, and arrangement boundaries have no accumulated timing drift", () => {
  for (const bpm of [70, 96, 114, 160])
    for (const swing of [0, 0.1, 0.45]) {
      const p = createProject();
      p.bpm = bpm;
      p.swing = swing;
      p.arrangement = [
        { scene: 2, bars: 3 },
        { scene: 0, bars: 16 },
        { scene: 3, bars: 1 },
      ];
      const frames = compileSong(p);
      let previous = -1;
      for (const f of frames) {
        assert(f.time > previous);
        previous = f.time;
        assert(f.time < 20 * barSeconds(bpm));
        if (f.step === 0) assert.equal(f.time, f.bar * barSeconds(bpm));
      }
      assert.equal(frames[48].scene, 0);
      assert.equal(frames[48].localBar, 0);
      assert.equal(frames[304].scene, 3);
      assert.equal(locateBar(p, 20), null);
    }
});
test("voices stay in the selected key across the entire harmony and note editor range", () => {
  for (let root = 48; root <= 59; root++)
    for (let degree = -14; degree <= 28; degree++) {
      const midi = degreeMidi(root, degree);
      assert(MINOR.includes((((midi - root) % 12) + 12) % 12));
      assert(Number.isInteger(midi));
    }
  const p = createProject();
  for (const scene of p.scenes)
    for (const row of scene.patterns)
      for (const cell of row) {
        cell.n = 14;
        cell.v = 1;
      }
  for (const f of compileSong(p))
    for (const e of f.events) {
      assert(e.duration > 0);
      for (const note of e.notes) assert(note >= 0 && note < 128);
    }
});
test("mute, solo, scene density, and captured motion affect the compiled export", () => {
  const p = createProject(),
    initial = compileSong(p);
  assert(initial.some((f) => f.events.length > 3));
  p.tracks.forEach((t) => (t.muted = true));
  assert(compileSong(p).every((f) => f.events.length === 0));
  p.tracks.forEach((t) => (t.muted = false));
  p.tracks[3].solo = true;
  assert(compileSong(p).every((f) => f.events.every((e) => e.track === 3)));
  p.tracks[3].muted = true;
  assert(compileSong(p).every((f) => f.events.length === 0));
  p.scenes[0].motion = Array.from({ length: 16 }, (_, i) => ({
    x: i / 15,
    y: 1 - i / 15,
  }));
  p.scenes[0].motionEnabled = true;
  assert.deepEqual(compileSong(p)[15].macro, { x: 1, y: 0 });
  assert.deepEqual(compileSong(p)[31].macro, { x: 1, y: 0 });
  p.scenes[0].motionEnabled = false;
  assert.deepEqual(macroAt(p.scenes[0], 15), {
    x: p.scenes[0].color,
    y: p.scenes[0].space,
  });
});
test("invalid or oversized imports fail without modifying the previous project", () => {
  const original = createProject();
  const mutations = [
    (p) => (p.version = 99),
    (p) => (p.bpm = NaN),
    (p) => (p.root = 60),
    (p) => (p.swing = 1),
    (p) => p.tracks.pop(),
    (p) => (p.tracks[0].muted = "false"),
    (p) => p.scenes[0].patterns[0].push({ v: 1, n: 0 }),
    (p) => (p.scenes[0].patterns[0][0].n = 1.5),
    (p) => (p.scenes[0].motion[0] = { x: 2, y: 0 }),
    (p) => (p.scenes[0].harmony[0] = 7),
    (p) => (p.arrangement = []),
    (p) =>
      (p.arrangement = [
        { scene: 0, bars: 16 },
        { scene: 1, bars: 16 },
        { scene: 2, bars: 16 },
        { scene: 3, bars: 16 },
        { scene: 0, bars: 1 },
      ]),
    (p) => (p.title = "x".repeat(49)),
  ];
  for (const mutate of mutations) {
    const bad = clone(original);
    mutate(bad);
    assert.throws(() => validateProject(bad));
    assert.deepEqual(original, createProject());
  }
});
test("dense legal sessions stay within the explicit 64-bar export bound", () => {
  const p = createProject();
  p.arrangement = Array.from({ length: 4 }, (_, scene) => ({
    scene,
    bars: 16,
  }));
  for (const scene of p.scenes)
    scene.patterns.forEach((row) => row.forEach((cell) => (cell.v = 1)));
  assert.equal(validateProject(p).arrangement.length, 4);
  assert.equal(compileSong(p).length, 1024);
  assert.equal(eventsForStep(p, 0, 0, 0).length, 6);
  assert.equal(compileSong(p, "loop").length, 64);
});
