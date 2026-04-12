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

export function playSound(type) {
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime;

  switch (type) {
    case 'build':
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
      break;
    case 'produce':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
      break;
    case 'raid':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(400, t + 0.3);
      osc.frequency.linearRampToValueAtTime(200, t + 0.6);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      osc.start(t); osc.stop(t + 0.6);
      break;
    case 'mission':
      osc.frequency.setValueAtTime(523, t);
      osc.frequency.setValueAtTime(659, t + 0.12);
      osc.frequency.setValueAtTime(784, t + 0.24);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
      break;
    case 'click':
      osc.frequency.setValueAtTime(1000, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.03);
      osc.start(t); osc.stop(t + 0.03);
      break;
  }
}

// ── Seasonal ambient soundscape ────────────────────────────
// Each season has a unique drone. Cross-fades on season change.
// All pure synthesis — no audio files.

let ambientNodes = null;
let currentAmbientSeason = null;
let ambientEnabled = true;

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
  if (!ambientNodes) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  // Fade out over 1 second
  ambientNodes.masterGain.gain.linearRampToValueAtTime(0, t + 1);
  const old = ambientNodes;
  setTimeout(() => {
    try { old.nodes.forEach(n => { try { n.stop(); } catch {} }); } catch {}
    try { old.masterGain.disconnect(); } catch {}
  }, 1500);
  ambientNodes = null;
  currentAmbientSeason = null;
}

function startSeasonAmbient(season) {
  stopAmbient();
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2); // fade in
  master.connect(ctx.destination);
  const nodes = [];

  switch (season) {
    case 'spring': {
      // Warm pad + gentle birdsong chirps via modulated sine
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

      // Bird chirp via LFO-modulated high oscillator
      const bird = ctx.createOscillator();
      const birdG = ctx.createGain();
      const birdLfo = ctx.createOscillator();
      const birdLfoG = ctx.createGain();
      bird.type = 'sine';
      bird.frequency.value = 2200;
      birdG.gain.value = 0;
      birdLfo.frequency.value = 3;
      birdLfoG.gain.value = 0.006;
      birdLfo.connect(birdLfoG); birdLfoG.connect(birdG.gain);
      bird.connect(birdG); birdG.connect(master);
      bird.start(); birdLfo.start();
      nodes.push(bird, birdLfo);
      break;
    }
    case 'summer': {
      // Rich warm drone + cicada buzz
      const drone = ctx.createOscillator();
      const dG = ctx.createGain();
      drone.type = 'triangle';
      drone.frequency.value = 165;
      dG.gain.value = 0.02;
      drone.connect(dG); dG.connect(master);
      drone.start();
      nodes.push(drone);

      // Cicada: filtered noise-like high buzz
      const buzz = ctx.createOscillator();
      const buzzG = ctx.createGain();
      const buzzLfo = ctx.createOscillator();
      const buzzLfoG = ctx.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.value = 4400;
      buzzG.gain.value = 0;
      buzzLfo.frequency.value = 6;
      buzzLfoG.gain.value = 0.003;
      buzzLfo.connect(buzzLfoG); buzzLfoG.connect(buzzG.gain);
      buzz.connect(buzzG); buzzG.connect(master);
      buzz.start(); buzzLfo.start();
      nodes.push(buzz, buzzLfo);
      break;
    }
    case 'autumn': {
      // Mellow minor drone + wind gusts
      const drone = ctx.createOscillator();
      const dG = ctx.createGain();
      drone.type = 'sine';
      drone.frequency.value = 185;
      dG.gain.value = 0.018;
      drone.connect(dG); dG.connect(master);
      drone.start();
      nodes.push(drone);

      // Minor third
      const m3 = ctx.createOscillator();
      const m3g = ctx.createGain();
      m3.type = 'sine';
      m3.frequency.value = 220;
      m3g.gain.value = 0.012;
      m3.connect(m3g); m3g.connect(master);
      m3.start();
      nodes.push(m3);

      // Wind: slow LFO on filtered noise
      const wind = ctx.createOscillator();
      const wG = ctx.createGain();
      const wLfo = ctx.createOscillator();
      const wLfoG = ctx.createGain();
      wind.type = 'sawtooth';
      wind.frequency.value = 80;
      wG.gain.value = 0;
      wLfo.frequency.value = 0.3;
      wLfoG.gain.value = 0.008;
      wLfo.connect(wLfoG); wLfoG.connect(wG.gain);
      wind.connect(wG); wG.connect(master);
      wind.start(); wLfo.start();
      nodes.push(wind, wLfo);
      break;
    }
    case 'winter': {
      // Cold, sparse: low drone + howling wind
      const drone = ctx.createOscillator();
      const dG = ctx.createGain();
      drone.type = 'sine';
      drone.frequency.value = 110;
      dG.gain.value = 0.02;
      drone.connect(dG); dG.connect(master);
      drone.start();
      nodes.push(drone);

      // Wind howl: two detuned saws
      const w1 = ctx.createOscillator();
      const w1g = ctx.createGain();
      const w1lfo = ctx.createOscillator();
      const w1lg = ctx.createGain();
      w1.type = 'sawtooth';
      w1.frequency.value = 120;
      w1g.gain.value = 0;
      w1lfo.frequency.value = 0.15;
      w1lg.gain.value = 0.012;
      w1lfo.connect(w1lg); w1lg.connect(w1g.gain);
      w1.connect(w1g); w1g.connect(master);
      w1.start(); w1lfo.start();
      nodes.push(w1, w1lfo);

      const w2 = ctx.createOscillator();
      const w2g = ctx.createGain();
      w2.type = 'sawtooth';
      w2.frequency.value = 95;
      w2g.gain.value = 0.005;
      w2.connect(w2g); w2g.connect(master);
      w2.start();
      nodes.push(w2);
      break;
    }
  }

  ambientNodes = { masterGain: master, nodes };
  currentAmbientSeason = season;
}
