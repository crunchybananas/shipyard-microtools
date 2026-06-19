// world.js — the single authoritative WorldState.
// Both the island and its 1:240 model render from this object every frame,
// which is why they can never fall out of sync.

import * as THREE from 'three';
import { clamp, lerp, lerpColor, smoothstep, TAU, mulberry32, SEED } from './util.js';

export const SCALE_MODEL = 1 / 240;

// the deepest reachable descent for now. The decay system (gradeBias) and the
// prop divergence run to L5+, but L5 is the keeper's near-dark floor — an empty
// near-black room until a keeper + a warm lamp inhabit it (#14/#15). So the
// playable descent bottoms at L4 (isolation-blue, still legible) until then.
export const MAX_DEPTH = 4;

export const W = {
  // master clock, hours 0..24. Sun stands where you leave it (plus a slow drift).
  time: 7.4,
  timeDrift: 1 / 240, // game-hours per real second when idle

  // tide: 1 = high, 0 = drained. Driven by the brass valve.
  tide: 1,
  tideTarget: 1,

  // lighthouse
  lensPlaced: false,
  lampLit: false,        // derived: lensPlaced && night
  beamAngle: 2.2,        // radians, azimuth of the beam

  // progression flags
  flags: {
    introDone: false,
    enteredStudy: false,
    valveTurned: false,
    crankUsed: false,
    rulerTaken: false,
    rulerPlaced: false,
    chestOpen: false,
    heardBox: false,
    heardBird: false,
    birdSolved: false,
    lensTaken: false,
    shadowRevealed: false,
    glyphsSeen: false,
    hatchOpen: false,
    plumbTaken: false,
    plumbHung: false,
    dove: false,          // level 2: one recursion down
    bellRung: false,
  },

  stems: 0,              // musical layers earned (0..5)
  inventory: [],         // 'ruler' | 'lens' | 'plumb'
  journal: [],           // [{text, sketch}]
  onceKeys: [],          // one-time cinematics already played
  dials: [0, 0, 0, 0],   // hatch glyph dials
  playerPos: null,       // saved position
  level: 1,
};

// ---------------- celestial mechanics (fantasy sky, art-directed) -------------
// Sunrise ~6h in the ENE, sunset ~19.4h in the S — a southern arc so that
// golden-hour shadows from the standing stones point NNW toward the bluff.

export function sunElevation(t) {
  return Math.sin(((t - 6) / 13.4) * Math.PI) * (55 * Math.PI / 180);
}
export function sunAzimuth(t) {
  return (60 + (t - 6) * 9) * Math.PI / 180; // degrees → rad, 0 = +z (north), clockwise toward +x (east)
}
export function sunDir(t, out = new THREE.Vector3()) {
  const el = sunElevation(t), az = sunAzimuth(t);
  out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return out;
}
export function moonDir(t, out = new THREE.Vector3()) {
  const el = Math.sin(((t - 19) / 13) * Math.PI) * (42 * Math.PI / 180);
  const az = sunAzimuth(t) + Math.PI * 0.94;
  out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return out;
}

export const isNight = () => sunElevation(W.time) < -0.06;
export const isDawn = () => W.time > 5.4 && W.time < 8.6;
export const isGolden = () => W.time > 17.1 && W.time < 18.5;

// weather: mist is a pure function of the clock — a deterministic roll per
// 3-hour slot (seeded), eased by the renderer. No save state: scrub the sun
// and the weather scrubs with it, identical on every machine. Golden hour
// is protected (the stone-shadow puzzle needs its sun) and night stays thin
// enough for the beam to write its glyphs.
export function mistTargetAt(t) {
  const h = ((t % 24) + 24) % 24;
  const r = mulberry32((SEED ^ (Math.floor(h / 3) * 2654435761)) >>> 0)();
  // tuned against the actual seeded rolls: sea-fret dawn (0.58), burn-off,
  // a drizzle-crossing midday (0.51), then a clearing golden evening
  const m = r < 0.38 ? 0 : 0.18 + (r - 0.38) * 1.35;
  const ceil = (h > 16.5 && h < 18.6) ? 0.08 : (h < 5 || h > 21) ? 0.45 : 0.8;
  return Math.min(m, ceil);
}

// ---------------- the five master grades -------------------------------------
// Only these palettes exist; every hour interpolates between them.
const G = (skyTop, skyHorizon, sunCol, sunInt, hemiSky, hemiGnd, fog, fogDen, water, waterShallow) => ({
  skyTop: new THREE.Color(skyTop),
  skyHorizon: new THREE.Color(skyHorizon),
  sunCol: new THREE.Color(sunCol),
  sunInt,
  hemiSky: new THREE.Color(hemiSky),
  hemiGnd: new THREE.Color(hemiGnd),
  fog: new THREE.Color(fog),
  fogDen,
  water: new THREE.Color(water),
  waterShallow: new THREE.Color(waterShallow),
});

const GRADES = {
  night:  G(0x070b1c, 0x101b30, 0x9fb8d9, 0.22, 0x1a2440, 0x0b0e14, 0x0a1322, 0.0042, 0x06141c, 0x0d2c33),
  dawn:   G(0x32507c, 0xf5c99b, 0xffd9a0, 0.85, 0x7fa8c9, 0x4a4030, 0xc9b49a, 0.0055, 0x16444e, 0x3f8d85),
  noon:   G(0x3a7ab8, 0xbfe0ee, 0xfff4e0, 1.25, 0x9ec7e0, 0x6a6048, 0xcfe3e8, 0.0030, 0x15454f, 0x4fae9d),
  golden: G(0x4a5e96, 0xff8a5c, 0xffc37a, 1.05, 0x9b89b8, 0x5c4a36, 0xe8b08a, 0.0050, 0x1c4250, 0x52938b),
  dusk:   G(0x1c2350, 0x5c4d7d, 0xff9a76, 0.45, 0x47446e, 0x231f22, 0x4a4366, 0.0052, 0x0c2733, 0x2a5a58),
};

// time → blend of grades, by hour
const KEYS = [
  [0.0, 'night'], [4.6, 'night'], [6.4, 'dawn'], [9.5, 'noon'],
  [16.2, 'noon'], [17.8, 'golden'], [19.2, 'dusk'], [20.6, 'night'], [24.0, 'night'],
];

const _grade = G(0, 0, 0, 0, 0, 0, 0, 0, 0, 0); // scratch, mutated in place

// ---------------- per-depth divergence (the descent's color psychology) ------
// As you dive, the world curdles through emotional eras — desaturated,
// era-cast, darkened, mistier with every level down. Level 1 (the surface) is
// identity, so the normal game is untouched. Keys off W.level so the world and
// its 1:240 model bias together (one WorldState). Casts precomputed — no
// per-frame allocation. The grammar of a life, abstracted; no biography.
const ERA_CASTS = [
  null,                       // L1 — surface, no cast
  new THREE.Color(0x3a4a3a), // L2 — desaturated streetlight green
  new THREE.Color(0x6b5a2a), // L3 — sickly false-gold
  new THREE.Color(0x24304a), // L4 — cold isolation blue
  new THREE.Color(0x141a1c), // L5+ — near-dark, bottoming out toward the keeper
];
const _BIAS_KEYS = ['skyTop', 'skyHorizon', 'sunCol', 'hemiSky', 'hemiGnd', 'fog', 'water', 'waterShallow'];

function gradeBias(g, level) {
  const d = Math.max(0, (level | 0) - 1);
  if (d === 0) return g;                                   // surface: untouched
  const cast = ERA_CASTS[Math.min(d, ERA_CASTS.length - 1)];
  const desat = Math.min(0.16 * d, 0.62);
  const dark = Math.max(1 - 0.11 * d, 0.42);
  const tint = Math.min(0.10 * d, 0.40);
  for (const key of _BIAS_KEYS) {
    const c = g[key];
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    c.r = lerp(lerp(c.r, lum, desat), cast.r, tint) * dark;
    c.g = lerp(lerp(c.g, lum, desat), cast.g, tint) * dark;
    c.b = lerp(lerp(c.b, lum, desat), cast.b, tint) * dark;
  }
  g.sunInt *= dark;
  g.fogDen *= 1 + 0.28 * d;                                // claustrophobia deepens
  return g;
}

export function gradeAt(t) {
  t = ((t % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
  const [t0, k0] = KEYS[i], [t1, k1] = KEYS[i + 1];
  const a = GRADES[k0], b = GRADES[k1];
  const f = smoothstep(t0, t1, t);
  lerpColor(_grade.skyTop, a.skyTop, b.skyTop, f);
  lerpColor(_grade.skyHorizon, a.skyHorizon, b.skyHorizon, f);
  lerpColor(_grade.sunCol, a.sunCol, b.sunCol, f);
  lerpColor(_grade.hemiSky, a.hemiSky, b.hemiSky, f);
  lerpColor(_grade.hemiGnd, a.hemiGnd, b.hemiGnd, f);
  lerpColor(_grade.fog, a.fog, b.fog, f);
  lerpColor(_grade.water, a.water, b.water, f);
  lerpColor(_grade.waterShallow, a.waterShallow, b.waterShallow, f);
  _grade.sunInt = lerp(a.sunInt, b.sunInt, f);
  _grade.fogDen = lerp(a.fogDen, b.fogDen, f);
  return gradeBias(_grade, W.level);
}

// ---------------- water level -------------------------------------------------
export const TIDE_DROP = 4.2; // metres between high and drained
export const waterY = () => -TIDE_DROP * (1 - W.tide);

// the same wave the shader displaces — audio locks onto this
export function wavePhase(timeSec) {
  return 0.5 + 0.5 * Math.sin(timeSec * 0.5) * 0.6 + 0.2 * Math.sin(timeSec * 0.83 + 1.7);
}

// ---------------- save / load --------------------------------------------------
const SAVE_KEY = 'abyme-save-v1';

export function save(playerPos) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      time: W.time, tide: W.tideTarget, lensPlaced: W.lensPlaced,
      beamAngle: W.beamAngle, flags: W.flags, stems: W.stems,
      inventory: W.inventory, journal: W.journal, level: W.level,
      onceKeys: W.onceKeys, dials: W.dials,
      pos: playerPos ? [playerPos.x, playerPos.y, playerPos.z] : null,
    }));
  } catch (_) { /* private mode: the island forgets */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    W.time = s.time ?? W.time;
    W.tide = W.tideTarget = s.tide ?? 1;
    W.lensPlaced = !!s.lensPlaced;
    W.beamAngle = s.beamAngle ?? W.beamAngle;
    Object.assign(W.flags, s.flags || {});
    // saves from before the lid was persistent: the taken ruler proves it
    if (W.flags.rulerTaken && !('chestOpen' in (s.flags || {}))) W.flags.chestOpen = true;
    W.stems = s.stems ?? 0;
    W.inventory = s.inventory || [];
    W.journal = s.journal || [];
    W.onceKeys = s.onceKeys || [];
    W.dials = Array.isArray(s.dials) && s.dials.length === 4 ? s.dials : [0, 0, 0, 0];
    W.level = s.level ?? 1;
    // a save written mid-dive has dove=true but level 1 — land the dive
    if (W.flags.dove && W.level < 2) W.level = 2;
    W.playerPos = s.pos ? new THREE.Vector3(...s.pos) : null;
    return true;
  } catch (_) { return false; }
}

export const hasSave = () => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
};

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}
