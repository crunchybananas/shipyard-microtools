// ════════════════════════════════════════════════════════════
// Web Audio — SFX + seasonal ambient soundscape
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

export function initAudio() {
  if (G.audioCtx) return;
  try {
    G.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { /* browser doesn't support */ }
}

// ── Helper: one-shot oscillator with gain envelope ────────
function makeOsc(ctx, dest, type, freq, gainPeak, attackTime, decayTime, startTime) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + attackTime);
  gain.gain.linearRampToValueAtTime(0, startTime + attackTime + decayTime);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + attackTime + decayTime + 0.01);
  return osc;
}

// ── Helper: noise burst (white noise via AudioBuffer) ────
function makeNoiseBurst(ctx, dest, gainPeak, durationSec, startTime, filterFreq) {
  const bufSize = Math.ceil(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, startTime);
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);
  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    src.connect(filter);
    filter.connect(gain);
  } else {
    src.connect(gain);
  }
  gain.connect(dest);
  src.start(startTime);
  src.stop(startTime + durationSec + 0.01);
  return src;
}

// ── Diegetic SFX for specific buildings ──────────────────
// Each building type gets a small sonic signature on placement.
export function playBuildingSound(buildingType) {
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const dest = ctx.destination;
  switch (buildingType) {
    case 'farm':
    case 'chickencoop':
    case 'cowpen':
      // Rustling leaves + gentle chime
      makeNoiseBurst(ctx, dest, 0.08, 0.2, t, 2500);
      makeOsc(ctx, dest, 'sine', 660, 0.06, 0.005, 0.22, t + 0.05);
      break;
    case 'lumber':
      // Axe chop
      makeNoiseBurst(ctx, dest, 0.14, 0.1, t, 1500);
      makeOsc(ctx, dest, 'triangle', 220, 0.18, 0.003, 0.15, t);
      break;
    case 'quarry':
    case 'mine':
      // Chisel on stone
      makeNoiseBurst(ctx, dest, 0.16, 0.08, t, 3500);
      makeOsc(ctx, dest, 'square', 180, 0.1, 0.002, 0.1, t + 0.02);
      break;
    case 'blacksmith':
      // Anvil clang
      makeOsc(ctx, dest, 'square', 880, 0.14, 0.002, 0.25, t);
      makeOsc(ctx, dest, 'triangle', 1320, 0.08, 0.002, 0.2, t);
      break;
    case 'tavern':
      // Cheer (two up-notes)
      makeOsc(ctx, dest, 'triangle', 523, 0.1, 0.005, 0.18, t);
      makeOsc(ctx, dest, 'triangle', 784, 0.1, 0.005, 0.2, t + 0.12);
      break;
    case 'church':
      // Bell
      makeOsc(ctx, dest, 'sine', 440, 0.18, 0.003, 0.9, t);
      makeOsc(ctx, dest, 'sine', 880, 0.1, 0.003, 0.7, t);
      makeOsc(ctx, dest, 'sine', 1320, 0.05, 0.003, 0.6, t);
      break;
    case 'market':
      // Coin jingle
      makeOsc(ctx, dest, 'triangle', 1760, 0.08, 0.003, 0.12, t);
      makeOsc(ctx, dest, 'triangle', 2349, 0.06, 0.003, 0.15, t + 0.07);
      makeOsc(ctx, dest, 'triangle', 1976, 0.05, 0.003, 0.12, t + 0.14);
      break;
    case 'barracks':
    case 'tower':
    case 'archery':
      // Horn
      makeOsc(ctx, dest, 'sawtooth', 220, 0.15, 0.02, 0.35, t);
      makeOsc(ctx, dest, 'sawtooth', 165, 0.1, 0.02, 0.35, t);
      break;
    case 'well':
      // Water drop + splash
      makeOsc(ctx, dest, 'sine', 1200, 0.08, 0.002, 0.06, t);
      makeNoiseBurst(ctx, dest, 0.05, 0.18, t + 0.05, 1200);
      break;
    case 'windmill':
      // Whoosh
      makeNoiseBurst(ctx, dest, 0.12, 0.5, t, 800);
      break;
    case 'castle':
      // Triumphant fanfare
      makeOsc(ctx, dest, 'sawtooth', 392, 0.14, 0.02, 0.28, t);
      makeOsc(ctx, dest, 'sawtooth', 523, 0.14, 0.02, 0.28, t + 0.18);
      makeOsc(ctx, dest, 'sawtooth', 659, 0.16, 0.02, 0.5, t + 0.36);
      makeOsc(ctx, dest, 'sawtooth', 784, 0.14, 0.02, 0.7, t + 0.54);
      break;
    default:
      playSound('build');
      return;
  }
  // Always add the base thunk for tactile body
  playSound('build');
}

// Short citizen "voice" bark — randomized pitch sine warble
export function playVoiceBark(kind='happy') {
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const dest = ctx.destination;
  const pitchMap = { happy: 560, sad: 320, work: 460, hungry: 380, cheer: 700, alarm: 640 };
  const base = pitchMap[kind] || 500;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.linearRampToValueAtTime(base * (kind === 'sad' ? 0.7 : 1.3), t + 0.12);
  osc.frequency.linearRampToValueAtTime(base * 0.9, t + 0.22);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.02);
  g.gain.linearRampToValueAtTime(0, t + 0.25);
  osc.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + 0.26);
}

export function playSound(type) {
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const dest = ctx.destination;

  switch (type) {

    // ── Build: low thunk — triangle thud + quick sub decay ──
    case 'build': {
      // Body thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain); gain.connect(dest);
      osc.start(t); osc.stop(t + 0.2);

      // Transient click
      makeOsc(ctx, dest, 'square', 900, 0.04, 0.002, 0.025, t);
      break;
    }

    // ── Produce: bright ascending tick ───────────────────────
    case 'produce': {
      makeOsc(ctx, dest, 'triangle', 880, 0.07, 0.004, 0.12, t);
      makeOsc(ctx, dest, 'triangle', 1320, 0.04, 0.004, 0.1, t + 0.08);
      break;
    }

    // ── Click: ultra-short tick ───────────────────────────────
    case 'click': {
      makeOsc(ctx, dest, 'sine', 1200, 0.06, 0.001, 0.022, t);
      // tiny noise transient for tactile feel
      makeNoiseBurst(ctx, dest, 0.03, 0.018, t, 4000);
      break;
    }

    // ── Mission complete: bright ascending three-note chime ──
    case 'mission': {
      // Note 1: C5
      makeOsc(ctx, dest, 'triangle', 523, 0.12, 0.005, 0.18, t);
      // Note 2: E5 (slightly overlapping)
      makeOsc(ctx, dest, 'triangle', 659, 0.12, 0.005, 0.18, t + 0.13);
      // Note 3: G5 — longer ring
      makeOsc(ctx, dest, 'triangle', 784, 0.14, 0.005, 0.35, t + 0.26);
      // Shimmer layer on top note
      makeOsc(ctx, dest, 'sine', 1568, 0.04, 0.005, 0.3, t + 0.26);
      break;
    }

    // ── Raid warning: ominous low drum pulse ─────────────────
    case 'raidWarning': {
      for (let i = 0; i < 3; i++) {
        const beat = t + i * 0.22;
        const drumOsc = ctx.createOscillator();
        const drumGain = ctx.createGain();
        drumOsc.type = 'triangle';
        drumOsc.frequency.setValueAtTime(90, beat);
        drumOsc.frequency.exponentialRampToValueAtTime(35, beat + 0.12);
        drumGain.gain.setValueAtTime(0, beat);
        drumGain.gain.linearRampToValueAtTime(0.28, beat + 0.004);
        drumGain.gain.exponentialRampToValueAtTime(0.001, beat + 0.18);
        drumOsc.connect(drumGain); drumGain.connect(dest);
        drumOsc.start(beat); drumOsc.stop(beat + 0.2);
        makeNoiseBurst(ctx, dest, 0.04, 0.06, beat, 300);
      }
      break;
    }

    // ── Raid start: aggressive drum + horn burst ─────────────
    case 'raid': {
      // Horn — two detuned saws
      const h1 = ctx.createOscillator();
      const h2 = ctx.createOscillator();
      const hGain = ctx.createGain();
      h1.type = 'sawtooth'; h1.frequency.value = 220;
      h2.type = 'sawtooth'; h2.frequency.value = 223; // slight detune
      hGain.gain.setValueAtTime(0, t);
      hGain.gain.linearRampToValueAtTime(0.16, t + 0.04);
      hGain.gain.setValueAtTime(0.16, t + 0.25);
      hGain.gain.linearRampToValueAtTime(0, t + 0.55);
      h1.connect(hGain); h2.connect(hGain); hGain.connect(dest);
      h1.start(t); h2.start(t);
      h1.stop(t + 0.6); h2.stop(t + 0.6);

      // Frequency sweep up
      h1.frequency.linearRampToValueAtTime(280, t + 0.25);
      h2.frequency.linearRampToValueAtTime(284, t + 0.25);

      // Drum hit
      const d = ctx.createOscillator();
      const dg = ctx.createGain();
      d.type = 'triangle';
      d.frequency.setValueAtTime(120, t);
      d.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      dg.gain.setValueAtTime(0, t);
      dg.gain.linearRampToValueAtTime(0.3, t + 0.003);
      dg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      d.connect(dg); dg.connect(dest);
      d.start(t); d.stop(t + 0.16);
      makeNoiseBurst(ctx, dest, 0.06, 0.08, t, 400);
      break;
    }

    // ── Upgrade: ascending sparkle (two rising notes) ────────
    case 'upgrade': {
      // First note
      makeOsc(ctx, dest, 'triangle', 880, 0.1, 0.005, 0.15, t);
      makeOsc(ctx, dest, 'sine', 1760, 0.04, 0.005, 0.12, t);
      // Second note — higher
      makeOsc(ctx, dest, 'triangle', 1174, 0.1, 0.005, 0.2, t + 0.14);
      makeOsc(ctx, dest, 'sine', 2349, 0.04, 0.005, 0.18, t + 0.14);
      // Sparkle shimmer
      makeOsc(ctx, dest, 'sine', 3136, 0.025, 0.005, 0.22, t + 0.24);
      break;
    }

    // ── Demolish: crash noise + low thud ─────────────────────
    case 'demolish': {
      // Broadband crash
      makeNoiseBurst(ctx, dest, 0.18, 0.35, t, 8000);
      makeNoiseBurst(ctx, dest, 0.1, 0.2, t + 0.02, 600);

      // Low thud
      const thud = ctx.createOscillator();
      const thudG = ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(80, t + 0.04);
      thud.frequency.exponentialRampToValueAtTime(28, t + 0.22);
      thudG.gain.setValueAtTime(0, t + 0.04);
      thudG.gain.linearRampToValueAtTime(0.25, t + 0.045);
      thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      thud.connect(thudG); thudG.connect(dest);
      thud.start(t + 0.04); thud.stop(t + 0.3);
      break;
    }

    // ── Bell toll: day transitions (church exists) ────────────
    case 'bellToll': {
      const hasChurch = G.buildings && G.buildings.some(b => b.type === 'church');
      if (!hasChurch) break;
      // Rich bell with 3 partials + slow decay
      makeOsc(ctx, dest, 'sine', 330, 0.14, 0.005, 1.5, t);
      makeOsc(ctx, dest, 'sine', 660, 0.08, 0.005, 1.2, t);
      makeOsc(ctx, dest, 'sine', 990, 0.04, 0.005, 1.0, t);
      // Second hit
      makeOsc(ctx, dest, 'sine', 330, 0.11, 0.005, 1.4, t + 0.8);
      makeOsc(ctx, dest, 'sine', 660, 0.06, 0.005, 1.1, t + 0.8);
      break;
    }

    // ── Season change: gentle wind-chime cascade ─────────────
    case 'season': {
      // Pentatonic-ish chime sequence
      const notes = [1047, 1175, 1319, 1568, 1760]; // C6 D6 E6 G6 A6
      notes.forEach((freq, i) => {
        const delay = i * 0.09;
        makeOsc(ctx, dest, 'sine', freq, 0.08, 0.003, 0.45, t + delay);
        makeOsc(ctx, dest, 'triangle', freq * 2, 0.02, 0.003, 0.3, t + delay);
      });
      break;
    }
  }
}

// ════════════════════════════════════════════════════════════
// Procedural background music — gentle medieval pentatonic
// ════════════════════════════════════════════════════════════

let musicScheduled = 0;
let musicEnabled = true;

export function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (!musicEnabled && G.audioCtx) {
    try {
      // Silence any lingering music gain — nodes self-stop via scheduled stop()
    } catch {}
  }
  return musicEnabled;
}

// Pentatonic scale in C
const MUSIC_SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

export function tickMusic() {
  if (!musicEnabled || !G.audioCtx) return;
  const ctx = G.audioCtx;
  if (ctx.state === 'suspended') return;
  const now = ctx.currentTime;
  if (now < musicScheduled) return;

  // Schedule next note
  const noteDur = 1.5 + Math.random() * 1.0;
  const freq = MUSIC_SCALE[Math.floor(Math.random() * MUSIC_SCALE.length)];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Soft envelope
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
  gain.gain.linearRampToValueAtTime(0.02, now + noteDur - 0.3);
  gain.gain.linearRampToValueAtTime(0, now + noteDur);

  osc.start(now);
  osc.stop(now + noteDur);

  musicScheduled = now + noteDur * 0.7;
}

// ── Seasonal ambient soundscape ────────────────────────────
// Each season has a unique drone. Cross-fades on season change.
// All pure synthesis — no audio files.

let ambientNodes = null;
let currentAmbientSeason = null;
let ambientEnabled = true;

// Chirp scheduler handle
let chirpTimer = null;

export function toggleAmbient() {
  ambientEnabled = !ambientEnabled;
  if (!ambientEnabled) stopAmbient();
  return ambientEnabled;
}

export function isAmbientEnabled() { return ambientEnabled; }

export function updateAmbient() {
  if (!G.audioCtx || !ambientEnabled) return;
  if (G.audioCtx.state === 'suspended') return;
  if (G.season === currentAmbientSeason && ambientNodes) return;
  startSeasonAmbient(G.season);
}

function stopAmbient() {
  if (chirpTimer !== null) { clearTimeout(chirpTimer); chirpTimer = null; }
  if (!ambientNodes) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  ambientNodes.masterGain.gain.linearRampToValueAtTime(0, t + 1);
  const old = ambientNodes;
  setTimeout(() => {
    try { old.nodes.forEach(n => { try { n.stop(); } catch {} }); } catch {}
    try { old.masterGain.disconnect(); } catch {}
  }, 1500);
  ambientNodes = null;
  currentAmbientSeason = null;
}

// Schedule random bird chirps for spring/summer
function scheduleBirdChirps(ctx, master, season) {
  if (!ambientEnabled || !ambientNodes) return;
  if (currentAmbientSeason !== season) return;

  const t = ctx.currentTime;

  if (season === 'spring') {
    // Two-note chirp: quick high beeps
    const f1 = 2400 + Math.random() * 800;
    const f2 = f1 * 1.25;
    makeOsc(ctx, master, 'sine', f1, 0.025, 0.003, 0.06, t);
    makeOsc(ctx, master, 'sine', f2, 0.02, 0.003, 0.05, t + 0.07);
  } else if (season === 'summer') {
    // Three-note quick chirp
    const base = 2800 + Math.random() * 600;
    makeOsc(ctx, master, 'sine', base, 0.02, 0.002, 0.04, t);
    makeOsc(ctx, master, 'sine', base * 1.1, 0.018, 0.002, 0.04, t + 0.055);
    makeOsc(ctx, master, 'sine', base * 0.95, 0.015, 0.002, 0.04, t + 0.11);
  }

  // Next chirp in 3-12 seconds
  const delay = (3 + Math.random() * 9) * 1000;
  chirpTimer = setTimeout(() => scheduleBirdChirps(ctx, master, season), delay);
}

// Schedule cricket chirps for night/autumn
function scheduleCrickets(ctx, master, season) {
  if (!ambientEnabled || !ambientNodes) return;
  if (currentAmbientSeason !== season) return;

  const t = ctx.currentTime;
  // Cricket: rapid high-frequency trills (3 quick pulses)
  for (let i = 0; i < 3; i++) {
    makeOsc(ctx, master, 'sine', 4200 + Math.random() * 200, 0.012, 0.002, 0.022, t + i * 0.03);
  }

  const delay = (1.5 + Math.random() * 4) * 1000;
  chirpTimer = setTimeout(() => scheduleCrickets(ctx, master, season), delay);
}

function startSeasonAmbient(season) {
  stopAmbient();
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
  master.connect(ctx.destination);
  const nodes = [];

  switch (season) {
    case 'spring': {
      // Warm pad
      const pad = ctx.createOscillator();
      const padG = ctx.createGain();
      pad.type = 'sine';
      pad.frequency.value = 220;
      padG.gain.value = 0.015;
      pad.connect(padG); padG.connect(master);
      pad.start();
      nodes.push(pad);

      // Second harmonic
      const h2 = ctx.createOscillator();
      const h2g = ctx.createGain();
      h2.type = 'sine';
      h2.frequency.value = 330;
      h2g.gain.value = 0.008;
      h2.connect(h2g); h2g.connect(master);
      h2.start();
      nodes.push(h2);

      // Gentle wind: filtered noise via slow-LFO oscillator
      const wind = ctx.createOscillator();
      const windG = ctx.createGain();
      const windFilter = ctx.createBiquadFilter();
      const windLfo = ctx.createOscillator();
      const windLfoG = ctx.createGain();
      wind.type = 'sawtooth';
      wind.frequency.value = 60;
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 400;
      windFilter.Q.value = 0.5;
      windLfo.frequency.value = 0.2;
      windLfoG.gain.value = 0.006;
      windLfo.connect(windLfoG); windLfoG.connect(windG.gain);
      windG.gain.value = 0;
      wind.connect(windFilter); windFilter.connect(windG); windG.connect(master);
      wind.start(); windLfo.start();
      nodes.push(wind, windLfo);

      // Schedule random bird chirps
      ambientNodes = { masterGain: master, nodes };
      currentAmbientSeason = season;
      chirpTimer = setTimeout(() => scheduleBirdChirps(ctx, master, season),
        (1 + Math.random() * 3) * 1000);
      return; // early return — ambientNodes already set
    }

    case 'summer': {
      // Warm drone
      const drone = ctx.createOscillator();
      const dG = ctx.createGain();
      drone.type = 'triangle';
      drone.frequency.value = 165;
      dG.gain.value = 0.018;
      drone.connect(dG); dG.connect(master);
      drone.start();
      nodes.push(drone);

      // Cicada buzz: modulated sawtooth
      const buzz = ctx.createOscillator();
      const buzzG = ctx.createGain();
      const buzzLfo = ctx.createOscillator();
      const buzzLfoG = ctx.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.value = 4400;
      buzzG.gain.value = 0;
      buzzLfo.frequency.value = 7;
      buzzLfoG.gain.value = 0.004;
      buzzLfo.connect(buzzLfoG); buzzLfoG.connect(buzzG.gain);
      buzz.connect(buzzG); buzzG.connect(master);
      buzz.start(); buzzLfo.start();
      nodes.push(buzz, buzzLfo);

      // Gentle wind layer
      const wind = ctx.createOscillator();
      const windG = ctx.createGain();
      const windLfo = ctx.createOscillator();
      const windLfoG = ctx.createGain();
      wind.type = 'sawtooth';
      wind.frequency.value = 70;
      windG.gain.value = 0;
      windLfo.frequency.value = 0.15;
      windLfoG.gain.value = 0.005;
      windLfo.connect(windLfoG); windLfoG.connect(windG.gain);
      wind.connect(windG); windG.connect(master);
      wind.start(); windLfo.start();
      nodes.push(wind, windLfo);

      // Schedule bird chirps
      ambientNodes = { masterGain: master, nodes };
      currentAmbientSeason = season;
      chirpTimer = setTimeout(() => scheduleBirdChirps(ctx, master, season),
        (0.5 + Math.random() * 2) * 1000);
      return;
    }

    case 'autumn': {
      // Mellow minor drone
      const drone = ctx.createOscillator();
      const dG = ctx.createGain();
      drone.type = 'sine';
      drone.frequency.value = 185;
      dG.gain.value = 0.018;
      drone.connect(dG); dG.connect(master);
      drone.start();
      nodes.push(drone);

      const m3 = ctx.createOscillator();
      const m3g = ctx.createGain();
      m3.type = 'sine';
      m3.frequency.value = 220;
      m3g.gain.value = 0.01;
      m3.connect(m3g); m3g.connect(master);
      m3.start();
      nodes.push(m3);

      // Wind gusts: slow LFO on bandpassed sawtooth
      const wind = ctx.createOscillator();
      const wFilter = ctx.createBiquadFilter();
      const wG = ctx.createGain();
      const wLfo = ctx.createOscillator();
      const wLfoG = ctx.createGain();
      wind.type = 'sawtooth';
      wind.frequency.value = 80;
      wFilter.type = 'bandpass';
      wFilter.frequency.value = 600;
      wFilter.Q.value = 0.8;
      wG.gain.value = 0;
      wLfo.frequency.value = 0.25;
      wLfoG.gain.value = 0.012;
      wLfo.connect(wLfoG); wLfoG.connect(wG.gain);
      wind.connect(wFilter); wFilter.connect(wG); wG.connect(master);
      wind.start(); wLfo.start();
      nodes.push(wind, wLfo);

      // Evening crickets
      ambientNodes = { masterGain: master, nodes };
      currentAmbientSeason = season;
      chirpTimer = setTimeout(() => scheduleCrickets(ctx, master, season),
        (2 + Math.random() * 5) * 1000);
      return;
    }

    case 'winter': {
      // Cold sparse drone
      const drone = ctx.createOscillator();
      const dG = ctx.createGain();
      drone.type = 'sine';
      drone.frequency.value = 110;
      dG.gain.value = 0.02;
      drone.connect(dG); dG.connect(master);
      drone.start();
      nodes.push(drone);

      // Howling wind: two detuned saws through bandpass
      const w1 = ctx.createOscillator();
      const w1filter = ctx.createBiquadFilter();
      const w1g = ctx.createGain();
      const w1lfo = ctx.createOscillator();
      const w1lg = ctx.createGain();
      w1.type = 'sawtooth';
      w1.frequency.value = 120;
      w1filter.type = 'bandpass';
      w1filter.frequency.value = 800;
      w1filter.Q.value = 0.6;
      w1g.gain.value = 0;
      w1lfo.frequency.value = 0.12;
      w1lg.gain.value = 0.014;
      w1lfo.connect(w1lg); w1lg.connect(w1g.gain);
      w1.connect(w1filter); w1filter.connect(w1g); w1g.connect(master);
      w1.start(); w1lfo.start();
      nodes.push(w1, w1lfo);

      const w2 = ctx.createOscillator();
      const w2filter = ctx.createBiquadFilter();
      const w2g = ctx.createGain();
      const w2lfo = ctx.createOscillator();
      const w2lg = ctx.createGain();
      w2.type = 'sawtooth';
      w2.frequency.value = 95;
      w2filter.type = 'bandpass';
      w2filter.frequency.value = 500;
      w2filter.Q.value = 1.0;
      w2g.gain.value = 0;
      w2lfo.frequency.value = 0.08;
      w2lg.gain.value = 0.01;
      w2lfo.connect(w2lg); w2lg.connect(w2g.gain);
      w2.connect(w2filter); w2filter.connect(w2g); w2g.connect(master);
      w2.start(); w2lfo.start();
      nodes.push(w2, w2lfo);

      // Occasional icy cricket at night
      ambientNodes = { masterGain: master, nodes };
      currentAmbientSeason = season;
      chirpTimer = setTimeout(() => scheduleCrickets(ctx, master, season),
        (5 + Math.random() * 8) * 1000);
      return;
    }
  }

  ambientNodes = { masterGain: master, nodes };
  currentAmbientSeason = season;
}
