// audio.js — every sound is synthesized. The surf gain is driven by the same
// wave function the water shader displaces, so the swell you hear is the
// swell you see. Solved puzzles add permanent stems to the island's score.

import { STONE_NOTES } from './props.js';
import { clamp, lerp } from './util.js';

let ctx = null;

const MASTER_LEVEL = 0.6;

const A = {
  master: null, amb: null, music: null, fx: null,
  diveFilter: null,
  surf: null, wind: null, room: null,
  stems: [],
  ready: false,
  // device preference, not world state: survives saves AND New Game wipes.
  // `?mute` forces silence; `?debug` builds start muted unless the player
  // has explicitly unmuted (abyme-muted==='0') — so developer/agent test
  // sessions are quiet by default, players (no ?debug) are unaffected.
  muted: (() => {
    const stored = localStorage.getItem('abyme-muted');
    if (stored === '1') return true;
    if (stored === '0') return false;
    const q = new URLSearchParams(location.search);
    return q.has('mute') || q.has('debug');
  })(),

  setMuted(m) {
    this.muted = !!m;
    localStorage.setItem('abyme-muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
  },

  init() {
    if (this.ready) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    this.diveFilter = ctx.createBiquadFilter();
    this.diveFilter.type = 'lowpass';
    this.diveFilter.frequency.value = 19000;
    this.master.connect(this.diveFilter).connect(ctx.destination);

    this.amb = ctx.createGain(); this.amb.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.fx = ctx.createGain(); this.fx.connect(this.master);

    // ---- surf: two filtered noise layers ----
    this.surf = this._noiseLoop('brown', 320);
    this.surf.gain.gain.value = 0;
    this.surf.out.connect(this.amb);
    this.surfHiss = this._noiseLoop('white', 2400, 'highpass');
    this.surfHiss.gain.gain.value = 0;
    this.surfHiss.out.connect(this.amb);

    // ---- wind ----
    this.wind = this._noiseLoop('white', 700, 'bandpass', 0.6);
    this.wind.gain.gain.value = 0;
    this.wind.out.connect(this.amb);

    // ---- drizzle: a soft patter bed, alive only when the mist is thick ----
    this.rain = this._noiseLoop('white', 2600, 'bandpass', 0.8);
    this.rain.gain.gain.value = 0;
    this.rain.out.connect(this.amb);

    // ---- interior room tone ----
    this.room = this._noiseLoop('brown', 130);
    this.room.gain.gain.value = 0;
    this.room.out.connect(this.amb);
    const hum = ctx.createOscillator();
    hum.frequency.value = 55;
    const humG = ctx.createGain(); humG.gain.value = 0.12;
    hum.connect(humG).connect(this.room.gain);
    hum.start();

    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  },

  _noiseLoop(kind, freq, type = 'lowpass', q = 0.8) {
    const len = 3 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const gain = ctx.createGain();
    src.connect(filt).connect(gain);
    src.start();
    return { src, filt, gain, out: gain };
  },

  // called every frame from the main loop
  update(dt, s) {
    if (!this.ready) return;
    const t = ctx.currentTime;
    const k = 0.08; // smoothing
    // surf: swell-locked, pulled away by tide, ducked indoors
    const surfBase = s.interior ? 0.05 : clamp(0.34 - s.shoreDist * 0.0022, 0.04, 0.34);
    this.surf.gain.gain.setTargetAtTime(surfBase * (0.55 + 0.45 * s.wavePhase) * s.tideNear, t, k);
    this.surfHiss.gain.gain.setTargetAtTime(surfBase * 0.16 * s.wavePhase * s.tideNear, t, k);
    // wind: altitude raises pitch and volume, ducked indoors
    const windBase = s.interior ? 0.012 : clamp(0.05 + s.altitude * 0.004, 0.05, 0.17);
    this.wind.gain.gain.setTargetAtTime(windBase * (0.7 + 0.3 * Math.sin(t * 0.31)), t, 0.3);
    // drizzle rises with thick mist, muffled under a roof
    const rainBase = (s.mist ?? 0) > 0.45 ? ((s.mist - 0.45) * 0.11) : 0;
    this.rain.gain.gain.setTargetAtTime(rainBase * (s.interior ? 0.3 : 1), t, 1.4);
    this.wind.filt.frequency.setTargetAtTime(550 + s.altitude * 26, t, 0.5);
    // room tone indoors
    this.room.gain.gain.setTargetAtTime(s.interior ? 0.16 : 0.0, t, 0.25);
  },

  // the brink of a dive: the world holds its breath. Surf and wind pull back
  // to near-silence so the choice to descend stands in the quiet alone; it
  // swells back as the dive carries you down (or when you step away).
  duckAmbient(on) {
    if (!this.ready) return;
    this.amb.gain.setTargetAtTime(on ? 0.05 : 1, ctx.currentTime, on ? 0.45 : 1.4);
  },

  // ---------------- one-shots ----------------
  _env(node, t0, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  },

  // FM bell-pluck — the music box voice
  pluck(freq, when = 0, vol = 0.5, decay = 1.4) {
    if (!this.ready) return;
    const t0 = ctx.currentTime + when;
    const car = ctx.createOscillator(); car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.frequency.value = freq * 3.01;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(freq * 1.8, t0);
    mg.gain.exponentialRampToValueAtTime(1, t0 + decay * 0.7);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    this._env(g, t0, 0.006, vol, decay);
    car.connect(g).connect(this.music);
    car.start(t0); mod.start(t0);
    car.stop(t0 + decay + 0.2); mod.stop(t0 + decay + 0.2);
  },

  // the bird sings a note — formant chirp
  chirp(freq, when = 0, vol = 0.35) {
    if (!this.ready) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.9, t0);
    o.frequency.exponentialRampToValueAtTime(freq * 2.5, t0 + 0.07);
    o.frequency.exponentialRampToValueAtTime(freq * 2.1, t0 + 0.16);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq * 2.2; f.Q.value = 4;
    const g = ctx.createGain();
    this._env(g, t0, 0.012, vol, 0.22);
    o.connect(f).connect(g).connect(this.fx);
    o.start(t0); o.stop(t0 + 0.45);
  },

  // a standing stone hums
  stoneTone(i, vol = 0.4) {
    if (!this.ready) return;
    const freq = STONE_NOTES[i] / 2; // an octave down: monoliths, not chimes
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    this._env(g, t0, 0.08, vol, 2.2);
    for (const det of [-4, 3]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0);
      f.frequency.exponentialRampToValueAtTime(220, t0 + 2.0);
      o.connect(f).connect(g);
      o.start(t0); o.stop(t0 + 2.6);
    }
    g.connect(this.fx);
  },

  chime() { this.pluck(1046.5, 0, 0.3, 1.8); this.pluck(1318.5, 0.09, 0.22, 2.2); },
  deny() {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = 72; o.type = 'sine';
    const g = ctx.createGain(); this._env(g, t0, 0.01, 0.5, 0.5);
    o.connect(g).connect(this.fx); o.start(t0); o.stop(t0 + 0.7);
  },

  crankTick() {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1400 + Math.random() * 300;
    const g = ctx.createGain(); this._env(g, t0, 0.001, 0.05, 0.03);
    o.connect(g).connect(this.fx); o.start(t0); o.stop(t0 + 0.06);
  },

  valveRush(on) {
    if (!this.ready) return;
    if (on && !this._rush) {
      this._rush = this._noiseLoop('white', 900, 'bandpass', 0.4);
      this._rush.gain.gain.value = 0;
      this._rush.out.connect(this.fx);
      this._rush.gain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.6);
    } else if (!on && this._rush) {
      const r = this._rush; this._rush = null;
      r.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8);
      setTimeout(() => r.src.stop(), 3000);
    }
  },

  footstep(kind) {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    const len = 0.09 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = kind === 'sand' ? 420 : kind === 'stone' ? 1300 : 700;
    const g = ctx.createGain();
    g.gain.value = kind === 'stone' ? 0.1 : 0.16;
    src.connect(f).connect(g).connect(this.fx);
    src.start(t0);
  },

  // ---------------- the score: stems accumulate as you solve ----------------
  // leitmotif on A-minor pentatonic; root A2
  addStem(n) {
    if (!this.ready || this.stems.includes(n)) return;
    this.stems.push(n);
    const mk = (build) => { const g = ctx.createGain(); g.gain.value = 0; build(g); g.connect(this.music); g.gain.setTargetAtTime(1, ctx.currentTime, 4); return g; };
    const drone = (freq, vol) => mk((g) => {
      for (const det of [-3, 4]) {
        const o = ctx.createOscillator(); o.frequency.value = freq; o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = vol;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + n * 0.013;
        const lg = ctx.createGain(); lg.gain.value = freq * 1.5;
        lfo.connect(lg).connect(f.frequency);
        o.connect(f).connect(og).connect(g);
        o.start(); lfo.start();
      }
    });
    this._stemGains = this._stemGains || {};
    switch (n) {
      case 1: this._stemGains[1] = drone(110, 0.05); break;  // A2 root
      case 2: this._stemGains[2] = drone(164.8, 0.04); break; // E3 fifth
      case 3: { // slow leitmotif arp
        const notes = [329.63, 392.0, 440.0, 293.66, 261.63];
        let i = 0;
        this._arp = setInterval(() => { this.pluck(notes[i % 5] / 2, 0, 0.10, 3.0); i++; }, 3800);
        break;
      }
      case 4: { // deep pulse
        this._pulse = setInterval(() => {
          if (!ctx) return;
          const t0 = ctx.currentTime;
          const o = ctx.createOscillator(); o.frequency.value = 55;
          const g = ctx.createGain(); this._env(g, t0, 0.3, 0.12, 2.4);
          o.connect(g).connect(this.music); o.start(t0); o.stop(t0 + 3);
        }, 7300);
        break;
      }
      case 5: { // high shimmer bells
        this._shimmer = setInterval(() => {
          this.pluck(1760 + Math.random() * 200, 0, 0.05, 4.0);
          this.pluck(2093, 0.4, 0.035, 4.0);
        }, 9100);
        break;
      }
    }
  },

  bellToll() {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    // the final bell: the leitmotif's tonic, vast
    this.pluck(110, 0, 0.7, 9);
    this.pluck(220, 0.02, 0.5, 8);
    // …and every stem the player earned answers it, gathered into one chord
    const has = (n) => this.stems.includes(n);
    for (const n of [1, 2]) {                      // the drones swell against the toll
      const g = this._stemGains?.[n];
      if (g) {
        g.gain.cancelScheduledValues(t0);
        g.gain.setTargetAtTime(2.4, t0 + 0.1, 0.7);
        g.gain.setTargetAtTime(1.0, t0 + 5.5, 2.0);
      }
    }
    if (has(3)) {                                  // the leitmotif itself, strummed as a chord
      const LEIT = [329.63, 392.0, 440.0, 293.66, 261.63]; // E G A D C
      LEIT.forEach((f, i) => this.pluck(f, 0.6 + i * 0.09, 0.22, 7));
    }
    if (has(4)) {                                  // one deep gathered beat
      const o = ctx.createOscillator(); o.frequency.value = 55;
      const g = ctx.createGain(); this._env(g, t0 + 1.2, 0.5, 0.4, 5);
      o.connect(g).connect(this.music); o.start(t0 + 1.2); o.stop(t0 + 7);
    }
    if (has(5)) {                                  // the shimmer crowns it
      this.pluck(1760, 2.2, 0.06, 6);
      this.pluck(2093, 2.5, 0.05, 6);
      this.pluck(2637, 2.9, 0.04, 6);
    }
    // the rising tail — for the bell's own long farewell
    this.pluck(329.63, 1.8, 0.3, 7);
    this.pluck(440, 3.6, 0.3, 7);
    this.pluck(523.25, 5.4, 0.25, 8);
  },

  // the keeper — a voice one floor down, heard through water. NOT words (the
  // whisper text carries those); a vocal TIMBRE: formant pulses on a low glottal
  // source, band-limited to a murmur and echoed as if rising through the floor.
  // Quiet on purpose — a presence, not a narrator. Register bends the contour:
  // curious rises, pleading wavers, resigned falls.
  keeperVoice(register = 'curious') {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    // the drowned bus: lowpass to a murmur, one-floor-down echo, into fx
    const vg = ctx.createGain(); vg.gain.value = 0.85; vg.connect(this.fx);
    const drown = ctx.createBiquadFilter(); drown.type = 'lowpass';
    drown.frequency.value = 1500; drown.Q.value = 0.6; drown.connect(vg);
    const del = ctx.createDelay(0.6); del.delayTime.value = 0.19;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    drown.connect(del); del.connect(fb).connect(del); del.connect(vg);
    const base = register === 'resigned' ? 104 : register === 'pleading' ? 126 : 116;
    const dir = register === 'resigned' ? -1 : register === 'pleading' ? 0 : 1;
    const syls = register === 'resigned' ? 3 : 4;
    for (let i = 0; i < syls; i++) {
      const ts = t0 + i * 0.27;
      const dur = 0.17 + 0.04 * Math.abs(Math.sin(i * 1.3));
      // a small melodic contour so it reads as speech, not a tone
      const semis = dir * i * 0.7 + (i % 2 ? 0.4 : -0.2) + (register === 'pleading' ? Math.sin(i * 2) * 1.2 : 0);
      const f = base * Math.pow(2, semis / 12);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, ts);
      o.frequency.linearRampToValueAtTime(f * (1 + dir * 0.03), ts + dur);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
      const vibg = ctx.createGain(); vibg.gain.value = f * 0.013;
      vib.connect(vibg).connect(o.frequency);
      // two band-pass formants → a vowel-ish color between 'uh' and 'oh'
      const fm1 = ctx.createBiquadFilter(); fm1.type = 'bandpass'; fm1.frequency.value = 430 + i * 18; fm1.Q.value = 6;
      const fm2 = ctx.createBiquadFilter(); fm2.type = 'bandpass'; fm2.frequency.value = 920 - i * 22; fm2.Q.value = 9;
      const g = ctx.createGain(); this._env(g, ts, 0.035, 0.16, dur);
      o.connect(fm1).connect(g);
      o.connect(fm2).connect(g);
      g.connect(drown);
      o.start(ts); o.stop(ts + dur + 0.25);
      vib.start(ts); vib.stop(ts + dur + 0.25);
    }
    setTimeout(() => { try { fb.gain.value = 0; del.disconnect(); fb.disconnect(); drown.disconnect(); vg.disconnect(); } catch (_) {} }, 2600);
  },

  // the dive: the whole island drops an octave and comes back
  diveSweep(durSec) {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    this.diveFilter.frequency.setValueAtTime(19000, t0);
    this.diveFilter.frequency.exponentialRampToValueAtTime(240, t0 + durSec * 0.75);
    this.diveFilter.frequency.exponentialRampToValueAtTime(19000, t0 + durSec + 2);
    this.surf.src.playbackRate.setValueAtTime(1, t0);
    this.surf.src.playbackRate.exponentialRampToValueAtTime(0.5, t0 + durSec * 0.8);
    this.surf.src.playbackRate.exponentialRampToValueAtTime(1, t0 + durSec + 2);
    // riser: shimmering feedback delay fed by plucks
    const del = ctx.createDelay(1.0); del.delayTime.value = 0.31;
    const fb = ctx.createGain(); fb.gain.value = 0.82;
    const wet = ctx.createGain(); wet.gain.value = 0.0;
    del.connect(fb).connect(del);
    del.connect(wet).connect(this.master);
    const feed = ctx.createGain(); feed.gain.value = 0.4;
    feed.connect(del);
    const old = this.music;
    old.connect(feed);
    wet.gain.setTargetAtTime(0.5, t0, durSec * 0.3);
    wet.gain.setTargetAtTime(0.0001, t0 + durSec * 0.85, 1.2);
    const notes = [220, 329.63, 440, 523.25, 659.25, 880];
    notes.forEach((f, i) => this.pluck(f, i * (durSec / 8), 0.12, 2.5));
    setTimeout(() => {
      try {
        old.disconnect(feed);
        fb.gain.value = 0;
        feed.disconnect(); del.disconnect(); fb.disconnect(); wet.disconnect();
      } catch (_) {}
    }, (durSec + 8) * 1000);
  },
};

export default A;
