// world.js — the single authoritative WorldState.
// Both the island and its 1:240 model render from this object every frame,
// which is why they can never fall out of sync.

import * as THREE from 'three';
import { clamp, lerp, lerpColor, smoothstep, TAU, mulberry32, SEED } from './util.js';
import { SAVE_KEY, SAVE_KEY_PREV, packSave, applySave } from './save-schema.js';
import {
  FLAG_MARKS, DISPOSITIONS, localSource, loadHandId,
  record as ledgerRecord, dispose as ledgerDispose,
  draftAt, tideFor, handsAbove, evidenceAt, writingsAt, sanitizeWriting,
} from './ledger.js';
export { DISPOSITIONS };
export { sanitizeWriting };

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

  // accessibility: when set, dampen head-bob + the intro flight's sway/bank.
  // Honors the OS prefers-reduced-motion by default; the in-game toggle overrides
  // and persists. NOT in flags — it's a client comfort preference, not save state.
  reduceMotion: (() => {
    try {
      const s = localStorage.getItem('abyme-reduce-motion');
      if (s !== null) return s === '1';
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  })(),

  // tide: 1 = high, 0 = drained. Driven by the brass valve.
  tide: 1,
  tideTarget: 1,

  // lighthouse
  lensPlaced: false,
  lampLit: false,        // derived: lensPlaced && night
  atTop: false,          // transient: standing on the lamp-room gallery (the climb, hub Phase B)
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
    carried: false,       // the twist's embrace happened (the pair exists; #53 figures key off this)
    dove: false,          // level 2: one recursion down
    climbing: false,      // one-way ascent mode: reached the bottom, now rising back up (#12)
    keeperSilenced: false,// the keeper's last words spoken on the first ascent; then silence (#12)
    returned: false,      // climbed all the way back to the surface: the return left its mark (#12)
    bellRung: false,
    // fire 35: EVERY flag the code reads gets a default. An absent flag in a boolean
    // chain leaks undefined — `(a || undefined) && b` — and three.js renders
    // visible:undefined (it only culls on === false). The beach figure taught us.
    readGlass: false, phialTaken: false, phialDried: false, keeperSong: false,
    tideFigureSeen: false, watcherSeen: false, keeperRose: false, beamDeepSeen: false,
    beamFarewell: false, roundMoor: false, roundLog: false, roundLight: false,
    roundWind: false,
  },

  stems: 0,              // musical layers earned (0..5)
  inventory: [],         // 'ruler' | 'lens' | 'plumb'
  recDisp: {},          // #132: the inspector's record — per-artifact null | 'carried' | 'filed' | 'kept'
  journal: [],           // [{text, sketch}]
  onceKeys: [],          // one-time cinematics already played
  readKeys: [],          // lore fragment ids the player has READ (the unfolding story; saved)
  reading: false,        // transient: the reading surface is open (input paused while reading)
  writing: false,        // transient: the shore-writing surface owns keyboard + movement
  dials: [0, 0, 0, 0],   // hatch glyph dials
  playerPos: null,       // saved position
  playerLook: null,      // saved facing [yaw, pitch] radians, or null (pre-v3 saves; #58)
  level: 1,
  // SEA-STRATA (loop #117): persisted explored-state per drowned region — which deeper
  // levels you have reached + the fragments found, so the Meow-Wolf map stays "grown".
  regions: { l2seen: false, l3seen: false, l4seen: false, fragmentsFound: [] },
  // THE DISPOSITION (STACK.md §6): which of the four the player has selected at the
  // plate. Not applied until they take an ending — until then it is only an intent.
  disposition: 'tend',
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
// exposure (last arg) feeds renderer.toneMappingExposure per grade — the ACES tonemap
// was running at a FIXED 1.06, so the five grades differed only in hue, never in TONE.
// Now noon reads airy/lifted, night crushed/cool — five MOODS, not five colour swaps.
// (Modest deltas around 1.06; depth-decay stays colour-based so it never compounds to black.)
const G = (skyTop, skyHorizon, sunCol, sunInt, hemiSky, hemiGnd, fog, fogDen, water, waterShallow, exposure = 1.06) => ({
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
  exposure,
});

const GRADES = {
  night:  G(0x070b1c, 0x101b30, 0x9fb8d9, 0.22, 0x1a2440, 0x0b0e14, 0x0a1322, 0.0042, 0x06141c, 0x0d2c33, 0.92),
  dawn:   G(0x32507c, 0xf5c99b, 0xffd9a0, 0.85, 0x7fa8c9, 0x4a4030, 0xc9b49a, 0.0055, 0x16444e, 0x3f8d85, 1.05),
  noon:   G(0x3a7ab8, 0xbfe0ee, 0xfff4e0, 1.25, 0x9ec7e0, 0x6a6048, 0xcfe3e8, 0.0030, 0x15454f, 0x4fae9d, 1.16),
  golden: G(0x4a5e96, 0xff8a5c, 0xffc37a, 1.05, 0x9b89b8, 0x5c4a36, 0xe8b08a, 0.0050, 0x1c4250, 0x52938b, 1.10),
  dusk:   G(0x1c2350, 0x5c4d7d, 0xff9a76, 0.45, 0x47446e, 0x231f22, 0x4a4366, 0.0052, 0x0c2733, 0x2a5a58, 0.98),
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
// The casts carry the EMOTION through chroma, not darkness — saturated and
// hue-separated, sequenced as a felt descent: sickly-warm false comforts up top
// (sodium green, jaundice gold) draining into cold isolation, then a dead violet
// floor. Depth itself is supplied by the dark multiplier, not by muddy casts.
const ERA_CASTS = [
  null,                       // L1 — the last day: surface, no cast
  new THREE.Color(0x74a83e), // L2 — the arrival years: living warm green (wonder, not sickness)
  new THREE.Color(0x8f9aa6), // L3 — the inspection years: steel grey-blue (measurement)
  new THREE.Color(0x2f6cc8), // L4 — the last winter: cold isolation blue
  new THREE.Color(0x573a72), // L5+ — dead violet, the keeper's near-dark floor
];
// ---- SEA-STRATA level-areas (loop #117): the canonical per-level descriptor table ----
// Each dive-level is a deeper register of the SAME island, drowned further by a rising
// tide. A region<N> content group (built once in props.buildWorld, shown by W.level in
// puzzles _apply) plus the per-level spawn / tide / encounter live HERE so designers edit
// one place instead of the scattered {2:,3:,4:} literals.
//   tide > 1 RAISES the sea ABOVE high-water (waterY = -TIDE_DROP*(1-tide), so tide 1.35
//   ≈ +1.5m). The spawn-override + tide-raise are wired with each level's content; this
//   table is the data they read. Indexed by W.level (1..MAX_DEPTH); [0] unused.
// The strata are not depths — they are ERAS of the keeper's tenancy (AAA-A1, #129):
// diving is remembering; the island drowns in order, and the order is his. Each era
// also owns what the water UNCOVERED of the deeper past during it (the founders'
// stone at L2, the congregation's capitals at L3). Story/art/audio systems key off
// era.key; era.name is the designers' shared vocabulary (never shown raw in UI).
export const LEVELS = [
  null,
  { id: 'surface',  era: { key: 'lastday',    name: 'the last day' },        region: null,       spawn: { pos: [4, 0, -104],      yaw: 2.19, pitch: 0.02 },  tide: 1.0,  encounter: 'songbird' },
  { id: 'shallows', era: { key: 'arrival',    name: 'the arrival years' },   region: 'region2',  spawn: { pos: [1.5, 0, -105.5],  yaw: 2.19, pitch: 0.03 },  tide: 1.35, encounter: 'tideFigure' },   // #135: two meters seaward — the fronds frame the lighthouse instead of walling it
  { id: 'midwater', era: { key: 'inspection', name: 'the inspection years' }, region: 'region3', spawn: { pos: [0, 0, -78],       yaw: -0.114, pitch: -0.08 }, tide: 1.65, encounter: 'watcher' }, // revisit the wake-up shore from higher ground: the drowned hall breaches directly ahead while the Watcher enters from the right
  { id: 'source',   era: { key: 'lastwinter', name: 'the last winter' },     region: 'region4',  spawn: { pos: [-82.8, 0, -41.4], yaw: 2.19, pitch: 0.02 },  tide: 1.9,  encounter: 'keeper' },
];

const _BIAS_KEYS = ['skyTop', 'skyHorizon', 'sunCol', 'hemiSky', 'hemiGnd', 'fog', 'water', 'waterShallow'];
const _LUM_FLOOR = 0.045; // no channel crushes to unresolvable black (night × depth)

// The COLOR SCRIPT (#136, AAA-B2): per-era grading rows replacing the old linear
// depth formulas — the same pipeline, art-directed per era. Read with loop/ERAS.md:
//   arrival    — warm-green WONDER: hue-rich, barely desaturated, gently dim
//   inspection — steel-grey MEASUREMENT: the desat does the talking, cast goes cold
//   lastwinter — near-MONOCHROME cold: heaviest desat, darkest, thickest air
// dark values are deliberately spread (0.93/0.80/0.66) so the eras stay separable
// in pure grayscale luminance too (the colorblind-safe requirement).
const ERA_GRADES = [
  null, null,                                              // [0] unused, L1 identity
  { tint: 0.22, desat: 0.07, dark: 0.93, fogMul: 1.22 },   // L2 — the arrival years
  { tint: 0.30, desat: 0.34, dark: 0.80, fogMul: 1.50 },   // L3 — the inspection years
  { tint: 0.28, desat: 0.55, dark: 0.66, fogMul: 1.80 },   // L4 — the last winter
  { tint: 0.55, desat: 0.50, dark: 0.50, fogMul: 2.05 },   // L5+ — the near-dark floor
];

function gradeBias(g, level) {
  const d = Math.max(0, (level | 0) - 1);
  if (d === 0) return g;                                   // surface: untouched
  const cast = ERA_CASTS[Math.min(d, ERA_CASTS.length - 1)];
  // ORDER MATTERS (#13 redux): tint the cast onto the FULL-chroma colour FIRST
  // so the hue actually shifts, THEN desaturate the tinted result toward grey,
  // THEN darken. (The old order desaturated first and killed the hue before the
  // cast could speak — a neutral wall landed one 8-bit value off pure grey.)
  const row = ERA_GRADES[Math.min(d + 1, ERA_GRADES.length - 1)];
  const tint = row.tint;
  const desat = row.desat;
  const dark = row.dark;
  for (const key of _BIAS_KEYS) {
    const c = g[key];
    let r = lerp(c.r, cast.r, tint), gg = lerp(c.g, cast.g, tint), b = lerp(c.b, cast.b, tint);
    const lum = r * 0.299 + gg * 0.587 + b * 0.114;
    r = lerp(r, lum, desat) * dark;
    gg = lerp(gg, lum, desat) * dark;
    b = lerp(b, lum, desat) * dark;
    // darkness floor — lift toward a resolvable ember rather than pure black,
    // preserving hue (capped so a near-black input can't over-brighten/clip)
    const l2 = r * 0.299 + gg * 0.587 + b * 0.114;
    if (l2 > 1e-5 && l2 < _LUM_FLOOR) { const s = Math.min(_LUM_FLOOR / l2, 4); r *= s; gg *= s; b *= s; }
    c.r = r; c.g = gg; c.b = b;
  }
  g.sunInt *= dark;
  g.fogDen *= row.fogMul;                                  // claustrophobia, per era
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
  _grade.exposure = lerp(a.exposure, b.exposure, f);
  // the finale is the resolution — it must NOT inherit the descent's curdle.
  // W._finaleWarm forces the clean (level-1) grade so the ending lands warm,
  // not desaturated by how deep you rang the bell (#22).
  return gradeBias(_grade, W._finaleWarm ? 1 : W.level);
}

// ---------------- water level -------------------------------------------------
export const TIDE_DROP = 4.2; // metres between high and drained
export const waterY = () => -TIDE_DROP * (1 - W.tide);

// the same wave the shader displaces — audio locks onto this
export function wavePhase(timeSec) {
  return 0.5 + 0.5 * Math.sin(timeSec * 0.5) * 0.6 + 0.2 * Math.sin(timeSec * 0.83 + 1.7);
}

// ---------------- save / load --------------------------------------------------
// The save contract — WHAT persists, the payload version int, and the v(N)→v(N+1)
// migrations — lives in save-schema.js (#74): one field descriptor table instead
// of hand-enumerated fields here. This file only owns the storage I/O and the
// plain-array → THREE.Vector3 conversion at the boundary.

// `player` is the live player-like ({ pos, yaw, pitch }) — position AND facing
// persist (#58), so callers pass the player itself, not just its position.
export function save(player) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(packSave(W, player)));
  } catch (_) { /* private mode: the island forgets */ }
}

export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    applySave(W, JSON.parse(raw)); // migrates old payloads, applies the field table
    W.playerPos = W.playerPos ? new THREE.Vector3(...W.playerPos) : null;
    return true;
  } catch (_) {
    // #140: a corrupt save fails safe to a fresh start — but the payload is
    // PRESERVED (the first autosave would otherwise clobber the evidence ~12s in)
    try { if (raw !== null) localStorage.setItem(SAVE_KEY + '-corrupt', raw); } catch (_2) { /* private mode */ }
    return false;
  }
}

export const hasSave = () => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
};

// ---------------- the stack's ledger (STACK.md §3.1/§3.2) ---------------------
// The law: a solution is never dissolved, only displaced. The acts you perform on
// a rung become the water — and the evidence — the rung below wakes up in.
//
// ledger.js is storage-free so node can test it; this is its I/O boundary, the
// same split save-schema.js gets. The source is an INTERFACE: today it is local
// (the hand one rung up is your own past self, so the whole thesis is playable
// offline and single-player), and slice 8 swaps in an HTTP source without any
// consumer changing.

const _io = {
  get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
};

export const HAND = loadHandId(_io);

// THE SOURCE (STACK.md §8). Local by default and ALWAYS: the island must be whole
// with the wire cut, so the game boots on the local stack and never waits for a
// network. If — and only if — a `stack-config.js` exists beside this file, the
// source is upgraded in place to the shared one. A missing config is not an error,
// it is the normal build; the dynamic import simply fails and is swallowed.
let _source = localSource(_io);
let _shared = false;
// Harnesses that write must never touch the permanent shared stack. The explicit
// query switch keeps all gameplay identical while holding the source local.
export const LOCAL_STACK = (() => {
  try { return new URLSearchParams(location.search).has('localstack'); } catch (_) { return false; }
})();

if (!LOCAL_STACK) import('./stack-config.js')
  .then(async (cfg) => {
    if (!cfg || !cfg.FIREBASE_CONFIG) return;
    const { firestoreSource } = await import('./ledger-firebase.js');
    const src = firestoreSource(cfg.FIREBASE_CONFIG, _io);
    src.load();          // seed from the same local mirror, so nothing is lost in the swap
    _source = src;
    _shared = true;
    // tell the player, on the title screen, before they can displace anything
    try { const n = document.getElementById('title-shared'); if (n) n.hidden = false; } catch (_) {}
    syncStack(W.level); // and pull whoever is above us right now
  })
  .catch(() => { /* no config, offline build, or blocked — the local stack stands */ });

export const isShared = () => _shared;

// The hand id ACTUALLY in use. Once anonymous auth resolves this is the Firebase
// uid (which the rules require marks to carry); before that, and offline forever,
// it is the local id. The debug readout must report this rather than the constant
// HAND, or it claims marks are being filed under a hand that is not writing them.
export const handId = () => (_source.uid && _source.uid()) || HAND;

// Pull the rungs above this one. A no-op on the local source, and never awaited by
// the game: the draft and the evidence re-read the ledger every rung change, so
// results simply appear when they arrive.
export function syncStack(level = W.level) {
  if (_source.sync) { try { _source.sync(level); } catch (_) { /* offline */ } }
}

export const ledger = () => _source.load();

// Record one act on the CURRENT rung. Called from puzzles.js `flag()` — the single
// choke point every progression flag passes through — so the recording surface is
// FLAG_MARKS and nothing else. `player` supplies the position when there is one.
// Returns the mark, or null when the flag costs nobody anything (most of them).
export function recordAct(kind, player) {
  const p = player && player.pos;
  const mark = ledgerRecord(_source.load(), {
    kind,
    rung: W.level,
    // once anonymous auth resolves, the uid IS the hand — unique per player and
    // proof against impersonation (the rules require h == uid). Until then, the
    // local id; a mark made in the first second is still attributed, just offline.
    hand: (_source.uid && _source.uid()) || HAND,
    at: p ? [p.x, p.y, p.z] : null,
  });
  if (mark) _source.push(mark);
  return mark;
}

// The flag→act lookup, so puzzles.js never has to know the mark vocabulary.
export const actForFlag = (name) => FLAG_MARKS[name] || null;

// THE DRAFT: the water everything above this rung displaces onto it. 0 at the
// surface, always — nobody is upstream of the first island.
export const draft = (level = W.level) => draftAt(_source.load(), level);

// The tide a rung actually sits at: LEVELS[n].tide plus what it inherited.
export const tideAt = (level = W.level) =>
  tideFor(_source.load(), level, (LEVELS[level] || LEVELS[1]).tide);

// How many distinct hands have worked at or above this rung (the chart tally's
// new unit — hands, not levels).
export const hands = (level = W.level) => handsAbove(_source.load(), level);

// The inherited marks worth SHOWING, for the evidence pass (slice 4).
export const evidence = (level = W.level) => evidenceAt(_source.load(), level);

// The generous mark: one line per hand per rung, persisted in the same append-only
// ledger but carrying zero draft. The renderer reads inherited + this hand's fresh
// line through writings(); no call site ever reaches into the payload shape.
export function recordWriting(text, player = null) {
  const p = player && player.pos;
  const mark = ledgerRecord(_source.load(), {
    kind: 'writing',
    rung: W.level,
    hand: handId(),
    at: p ? [p.x, p.y, p.z] : null,
    text,
  });
  if (mark) _source.push(mark);
  return mark;
}

export const writings = (level = W.level) => writingsAt(_source.load(), level, handId());

// Forget the whole stack, in place. Deliberately NOT wired to "Begin again" — the
// stack outliving your run is the thesis (STACK.md §3.1). This exists for the
// playtest harness and the debug panel.
export const clearStack = () => { _source.clear(); };

// THE DISPOSITIONS (STACK.md §6) — the last act of displacement, performed on the
// rung you are standing on. Returns what actually changed so the coda can say the
// true number ("you took back seven marks"), and persists immediately: this is the
// one write in the game that outlives the ending it belongs to.
export function disposeStack(kind) {
  const led = _source.load();
  const res = ledgerDispose(led, { kind, rung: W.level, hand: (_source.uid && _source.uid()) || HAND });
  if (res) _source.push(res);   // any non-null result forces the ledger to disk
  return res;
}

export const disposition = () => W.disposition || 'tend';

export function wipe() {
  // Begin-anew safety net (#56): stash the outgoing payload one slot deep
  // before clearing, so a mistaken fresh start stays recoverable (a single-slot
  // undo — the NEXT wipe overwrites it). Restore by copying SAVE_KEY_PREV back
  // over SAVE_KEY; every wipe path (title screen, debug panel) gets this.
  try {
    const cur = localStorage.getItem(SAVE_KEY);
    if (cur !== null) localStorage.setItem(SAVE_KEY_PREV, cur);
  } catch (_) { /* private mode: nothing to stash */ }
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}
