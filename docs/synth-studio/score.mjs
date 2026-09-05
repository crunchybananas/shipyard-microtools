// Musical data and timing are shared by live playback and offline rendering.
export const TRACKS = [
  {
    id: "kick",
    name: "Kick",
    voice: "Soft impact",
    color: "#ffb18d",
    drum: true,
  },
  {
    id: "snare",
    name: "Snare",
    voice: "Paper & wire",
    color: "#e7ca97",
    drum: true,
  },
  {
    id: "hats",
    name: "Hats",
    voice: "Silver dust",
    color: "#90c2c9",
    drum: true,
  },
  { id: "bass", name: "Bass", voice: "Low current", color: "#83dcca" },
  { id: "chords", name: "Chords", voice: "Distant windows", color: "#a5b7ff" },
  { id: "arp", name: "Arp", voice: "Glass signals", color: "#e7a9e5" },
];
export const SCENE_NAMES = [
  "Ignition",
  "Night drive",
  "Weightless",
  "Afterglow",
];
export const SESSION_NAMES = ["Night drive", "Glasshouse", "Daybreak"];
export const MINOR = [0, 2, 3, 5, 7, 8, 10];
export const STORAGE_KEY = "synth-studio-nightshift-v1";
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const stepSeconds = (bpm) => 60 / bpm / 4;
export const barSeconds = (bpm) => 240 / bpm;
export const noteName = (midi) =>
  ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][
    ((midi % 12) + 12) % 12
  ] +
  (Math.floor(midi / 12) - 1);
export function degreeMidi(root, degree) {
  return root + MINOR[((degree % 7) + 7) % 7] + Math.floor(degree / 7) * 12;
}
export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}
function pattern(hits, notes = []) {
  return Array.from({ length: 16 }, (_, i) => ({
    v: hits[i] || 0,
    n: notes[i] ?? 0,
  }));
}
export function createProject(preset = 0) {
  const index = clamp(Math.trunc(preset), 0, 2);
  const root = [50, 53, 57][index]; // D, F, A; melodic voices transpose by register.
  const bass = [0, 0, 0, 0, 0, 0, 4, 0, 7, 0, 0, 0, 0, 4, 6, 4];
  const arp =
    index === 1
      ? [7, 9, 11, 9, 7, 4, 6, 9, 7, 11, 13, 11, 9, 7, 6, 4]
      : [7, 0, 9, 11, 0, 9, 7, 0, 11, 0, 13, 11, 0, 9, 6, 4];
  const scenes = SCENE_NAMES.map((name, i) => ({
    name,
    harmony: [
      [0, 5, 2, 6],
      [0, 5, 2, 6],
      [5, 6, 0, 2],
      [2, 6, 5, 0],
    ][i],
    color: [0.42, 0.7, 0.32, 0.48][i],
    space: [0.42, 0.48, 0.78, 0.6][i],
    levels: [
      [0.85, 0.52, 0.6, 0.72, 0.8, 0.84],
      [1, 0.9, 0.85, 0.95, 0.9, 1],
      [0.35, 0.2, 0.4, 0.6, 1, 0.75],
      [0.72, 0.6, 0.54, 0.78, 0.94, 0.68],
    ][i],
    motion: Array(16).fill(null),
    motionEnabled: false,
    patterns: [
      pattern(
        i === 2
          ? [1, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0]
          : [
              1,
              0,
              0,
              0,
              0.88,
              0,
              0,
              0,
              1,
              0,
              0,
              0,
              0.88,
              0,
              0,
              i === 1 ? 0.48 : 0,
            ],
      ),
      pattern([
        0,
        0,
        0,
        0,
        i === 2 ? 0 : 0.78,
        0,
        0,
        i === 1 ? 0.18 : 0,
        0,
        0,
        0,
        0,
        0.82,
        0,
        0,
        i === 1 ? 0.2 : 0,
      ]),
      pattern(
        Array.from({ length: 16 }, (_, s) =>
          s % 4 === 2
            ? 0.65
            : i === 1 && s % 2
              ? 0.27
              : s % 4 === 0 && i !== 2
                ? 0.25
                : 0,
        ),
      ),
      pattern(
        i === 2
          ? [0.7, 0, 0, 0, 0, 0, 0.45, 0, 0.6, 0, 0, 0, 0, 0, 0, 0]
          : [0.85, 0, 0, 0.5, 0, 0, 0.68, 0, 0.78, 0, 0, 0.48, 0, 0.5, 0.55, 0],
        bass,
      ),
      pattern([0.68, 0, 0, 0, 0, 0, 0, 0, 0.46, 0, 0, 0, 0, 0, 0, 0]),
      pattern(
        Array.from({ length: 16 }, (_, s) =>
          i === 2
            ? s % 4 === 0
              ? 0.55
              : s % 4 === 2
                ? 0.32
                : 0
            : s % 2 === 0
              ? 0.57
              : [3, 7, 11, 15].includes(s)
                ? 0.29
                : 0,
        ),
        arp,
      ),
    ],
  }));
  if (index === 1)
    scenes.forEach((scene) => {
      scene.patterns[0][4].v = 0;
      scene.patterns[0][10].v = 0.65;
      scene.patterns[5].forEach((cell, i) => (cell.v = i % 3 === 0 ? 0.6 : 0));
    });
  if (index === 2)
    scenes.forEach((scene) => {
      scene.color = Math.min(1, scene.color + 0.14);
      scene.patterns[2].forEach(
        (cell, i) => (cell.v = i % 2 ? 0.18 : i % 4 === 2 ? 0.67 : 0.26),
      );
    });
  return {
    format: "nightshift",
    version: 1,
    title: SESSION_NAMES[index],
    bpm: [114, 96, 124][index],
    root,
    swing: [0.1, 0.22, 0.04][index],
    master: 0.72,
    scene: 0,
    tracks: TRACKS.map((track, i) => ({
      level: [0.88, 0.65, 0.5, 0.72, 0.56, 0.5][i],
      tone: [0.5, 0.5, 0.6, 0.38, 0.48, 0.65][i],
      pan: [0, 0.06, -0.14, 0, -0.12, 0.23][i],
      muted: false,
      solo: false,
    })),
    scenes,
    arrangement: scenes.map((_, scene) => ({ scene, bars: 8 })),
  };
}

function fail(message) {
  throw new Error(message);
}
function number(value, low, high, label, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < low ||
    value > high ||
    (integer && !Number.isInteger(value))
  )
    fail(`${label} must be ${low}–${high}.`);
  return value;
}
function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(`${label} needs 1–${max} characters.`);
  return value.trim();
}
function array(value, length, label) {
  if (!Array.isArray(value) || value.length !== length)
    fail(`${label} needs ${length} entries.`);
  return value;
}
function bool(value, label) {
  if (typeof value !== "boolean") fail(`${label} must be true or false.`);
  return value;
}
export function validateProject(input) {
  if (
    !input ||
    typeof input !== "object" ||
    input.format !== "nightshift" ||
    input.version !== 1
  )
    fail(
      "Open a Nightshift project file. Classic projects open in the Classic rack.",
    );
  const p = {
    format: "nightshift",
    version: 1,
    title: text(input.title, 48, "Title"),
    bpm: number(input.bpm, 70, 160, "Tempo", true),
    root: number(input.root, 48, 59, "Key", true),
    swing: number(input.swing, 0, 0.45, "Swing"),
    master: number(input.master, 0, 1, "Volume"),
    scene: number(input.scene, 0, 3, "Scene", true),
    tracks: array(input.tracks, 6, "Tracks").map((t) => ({
      level: number(t.level, 0, 1, "Track volume"),
      tone: number(t.tone, 0, 1, "Tone"),
      pan: number(t.pan, -1, 1, "Pan"),
      muted: bool(t.muted, "Mute"),
      solo: bool(t.solo, "Solo"),
    })),
    scenes: array(input.scenes, 4, "Scenes").map((s) => ({
      name: text(s.name, 24, "Scene name"),
      harmony: array(s.harmony, 4, "Harmony").map((n) =>
        number(n, 0, 6, "Chord", true),
      ),
      color: number(s.color, 0, 1, "Color"),
      space: number(s.space, 0, 1, "Space"),
      levels: array(s.levels, 6, "Scene mix").map((n) =>
        number(n, 0, 1, "Scene volume"),
      ),
      motionEnabled: bool(s.motionEnabled, "Motion"),
      motion: array(s.motion, 16, "Motion steps").map((m) =>
        m === null
          ? null
          : {
              x: number(m.x, 0, 1, "Motion color"),
              y: number(m.y, 0, 1, "Motion space"),
            },
      ),
      patterns: array(s.patterns, 6, "Patterns").map((row) =>
        array(row, 16, "Steps").map((c) => ({
          v: number(c.v, 0, 1, "Velocity"),
          n: number(c.n, 0, 14, "Note", true),
        })),
      ),
    })),
    arrangement: [],
  };
  if (
    !Array.isArray(input.arrangement) ||
    !input.arrangement.length ||
    input.arrangement.length > 8
  )
    fail("An arrangement needs 1–8 sections.");
  p.arrangement = input.arrangement.map((s) => ({
    scene: number(s.scene, 0, 3, "Section scene", true),
    bars: number(s.bars, 1, 16, "Section bars", true),
  }));
  if (songBars(p) > 64) fail("Keep the arrangement within 64 bars.");
  return p;
}
export function songBars(project) {
  return project.arrangement.reduce((total, part) => total + part.bars, 0);
}
export function locateBar(project, bar) {
  let start = 0;
  for (let i = 0; i < project.arrangement.length; i++) {
    const part = project.arrangement[i];
    if (bar < start + part.bars)
      return { scene: part.scene, localBar: bar - start, section: i };
    start += part.bars;
  }
  return null;
}
export function macroAt(scene, step) {
  return scene.motionEnabled && scene.motion[step]
    ? scene.motion[step]
    : { x: scene.color, y: scene.space };
}
export function audible(project, track) {
  return (
    !project.tracks[track].muted &&
    (!project.tracks.some((t) => t.solo) || project.tracks[track].solo)
  );
}
export function eventsForStep(project, sceneIndex, bar, step) {
  const scene = project.scenes[sceneIndex];
  const harmony = scene.harmony[bar % 4];
  return TRACKS.flatMap((track, i) => {
    const cell = scene.patterns[i][step];
    if (!cell.v || !audible(project, i) || !scene.levels[i]) return [];
    const base = project.root + (i === 3 ? -12 : i === 5 ? 0 : 0);
    const degree = cell.n + harmony;
    const notes =
      i === 4
        ? [0, 2, 4, 6].map((interval) => degreeMidi(base, degree + interval))
        : [degreeMidi(base, degree)];
    const duration =
      i === 4
        ? stepSeconds(project.bpm) * 6.5
        : i === 3
          ? stepSeconds(project.bpm) * 1.65
          : stepSeconds(project.bpm) * 1.35;
    return [{ track: i, velocity: cell.v * scene.levels[i], notes, duration }];
  });
}
export function stepOffset(project, step) {
  return stepSeconds(project.bpm) * (step + (step % 2 ? project.swing : 0));
}
export function compileSong(project, mode = "song") {
  const bars = mode === "song" ? songBars(project) : 4;
  return Array.from({ length: bars * 16 }, (_, index) => {
    const bar = Math.floor(index / 16),
      step = index % 16;
    const location =
      mode === "song"
        ? locateBar(project, bar)
        : { scene: project.scene, localBar: bar, section: 0 };
    return {
      ...location,
      bar,
      step,
      time: bar * barSeconds(project.bpm) + stepOffset(project, step),
      macro: macroAt(project.scenes[location.scene], step),
      events: eventsForStep(project, location.scene, location.localBar, step),
    };
  });
}
