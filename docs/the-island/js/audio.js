// audio.js — nearly every sound is synthesized: the surf gain is driven by the
// same wave function the water shader displaces, so the swell you hear is the
// swell you see, and solved puzzles add permanent stems to the island's score.

import { STONE_NOTES } from './props.js';
import { clamp, lerp } from './util.js';

let ctx = null;

const MASTER_LEVEL = 0.6;

// the leitmotif — E G A D C: the figure the music box turns, the bird corrects,
// the stems arpeggiate, and the final bell gathers. One constant, every voice.
const LEIT = [329.63, 392.0, 440.0, 293.66, 261.63];

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

  _vol: 1,   // #59: master volume multiplier (device preference, applied over MASTER_LEVEL)
  setVolume(v) {
    this._vol = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = MASTER_LEVEL * this._vol;
  },

  setMuted(m) {
    this.muted = !!m;
    localStorage.setItem('abyme-muted', this.muted ? '1' : '0');
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL * this._vol;
    // mute used to be a volume knob only: six noise loops + the stem LFOs kept
    // rendering at gain 0 (#68). Halt the whole graph instead. Unmute resumes
    // through the same autoplay-safe path as #62 — the toggle itself is a
    // gesture, so in practice it succeeds immediately.
    if (this.muted) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); }
    else { this._tryResume(); this._installUnlock(); }
  },

  init() {
    if (this.ready) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL * this._vol;
    this.diveFilter = ctx.createBiquadFilter();
    this.diveFilter.type = 'lowpass';
    this.diveFilter.frequency.value = 19000;
    this.master.connect(this.diveFilter).connect(ctx.destination);

    this.amb = ctx.createGain();
    // walls are a FILTER, not a volume knob (#67): the whole ambient bed passes
    // through one shared biquad — wide open outdoors, closing to ~750Hz through
    // the tower's stone. The hiss and sparkle die at the door; the low sea stays.
    this.wallFilter = ctx.createBiquadFilter();
    this.wallFilter.type = 'lowpass';
    this.wallFilter.frequency.value = 19000;
    this.wallFilter.Q.value = 0.5;
    this.amb.connect(this.wallFilter).connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.musicBed = ctx.createGain(); this.musicBed.gain.value = 0.55; this.musicBed.connect(this.master); // the era music stems
    this._music = null; this._musicLevel = 0;
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

    // ---- crickets: the night's own bed (#64) ----
    // one loop node pair: high bandpass noise, its gain pulsed ~13Hz by an LFO so it
    // trills instead of hissing. Driven in update() — night, surface level, outdoors.
    this.crickets = this._noiseLoop('white', 4300, 'bandpass', 9);
    this.crickets.gain.gain.value = 0;
    this.crickets.out.connect(this.amb);
    this.cricketLfo = ctx.createOscillator();
    this.cricketLfo.frequency.value = 13;
    this.cricketLfoG = ctx.createGain();
    this.cricketLfoG.gain.value = 0;                       // depth follows the bed level (update)
    this.cricketLfo.connect(this.cricketLfoG).connect(this.crickets.gain.gain);
    this.cricketLfo.start();

    // ---- interior room tone ----
    this.room = this._noiseLoop('brown', 130);
    this.room.gain.gain.value = 0;
    this.room.out.connect(this.amb);
    // the old steady 55Hz sine read as electrical mains hum — wrong for a tower
    // with no wiring (#67). The interior presence is a second, DEEPER brown
    // layer instead: sub-70Hz filtered noise, the building's own slow breath.
    // It rides this.room.gain, so it fades in and out with the room tone.
    this.roomAir = this._noiseLoop('brown', 68);
    this.roomAir.gain.gain.value = 0.5;
    this.roomAir.out.connect(this.room.gain);

    this.ready = true;
    if (this.muted && ctx.state === 'running') ctx.suspend().catch(() => {}); // muted renders NOTHING (#68)
    this._tryResume();
    this._installUnlock();
  },

  // ---- autoplay unlock (#62): a replay reload ('begin again') re-enters via
  // sessionStorage autostart, so init() runs with NO user activation and the
  // one-shot resume() above is rejected — the whole second playthrough used to
  // stay silent. Keep permanent gesture listeners plus a per-frame suspended
  // check (see update()); once the context is actually running, the listeners
  // come off.
  _tryResume() {
    if (this.muted || !ctx || ctx.state !== 'suspended') return;   // muted-suspend (#68) stays suspended
    ctx.resume().catch(() => {});   // rejected without a gesture; the unlock listeners retry
  },

  // one-shots must not schedule while the context is halted (muted suspend #68,
  // pre-unlock #62): their clock is frozen, so scheduled nodes would pile up
  // and all fire in one burst the moment the context resumes.
  _running() { return this.ready && !!ctx && ctx.state === 'running'; },
  _installUnlock() {
    if (this._unlockFn) return;
    this._unlockFn = () => this._tryResume();
    window.addEventListener('pointerdown', this._unlockFn, true);
    window.addEventListener('keydown', this._unlockFn, true);
  },
  _removeUnlock() {
    if (!this._unlockFn) return;
    window.removeEventListener('pointerdown', this._unlockFn, true);
    window.removeEventListener('keydown', this._unlockFn, true);
    this._unlockFn = null;
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
    if (ctx.state === 'suspended') {
      // autoplay policy rejected init()'s resume() (#62): keep retrying here —
      // sticky activation means this succeeds on the first frame after ANY
      // gesture — but throttled, since a rejected resume() per frame is just
      // promise churn. Nothing below matters while the clock is frozen.
      this._resumeT = (this._resumeT || 0) + dt;
      if (this._resumeT > 0.5) { this._resumeT = 0; this._tryResume(); }
      return;
    }
    if (this._unlockFn) this._removeUnlock();   // running: the unlock job is done
    // spatial pose cache (#63): every world-anchored one-shot pans from this
    this._px = s.px ?? this._px; this._pz = s.pz ?? this._pz; this._pyaw = s.yaw ?? this._pyaw;
    const t = ctx.currentTime;
    const k = 0.08; // smoothing
    // walls close in (#67): one shared lowpass over the whole ambient bed swings
    // from wide open outside to ~750Hz inside — smoothly, so crossing the door
    // reads as mass, not a volume knob. The hiss dies; the low swell survives.
    this.wallFilter.frequency.setTargetAtTime(s.interior ? 750 : 19000, t, 0.35);
    // surf: swell-locked, pulled away by tide. No interior gain-gate here any
    // more — shoreDist already grows +60 through the door (main.js), and the
    // wall filter does the muffling.
    const surfBase = clamp(0.34 - s.shoreDist * 0.0022, 0.04, 0.34);
    this.surf.gain.gain.setTargetAtTime(surfBase * (0.55 + 0.45 * s.wavePhase) * s.tideNear, t, k);
    this.surfHiss.gain.gain.setTargetAtTime(surfBase * 0.16 * s.wavePhase * s.tideNear, t, k);
    // wind: altitude raises pitch and volume; walls take most of it (the rest is timbre)
    const windBase = clamp(0.05 + s.altitude * 0.004, 0.05, 0.17) * (s.interior ? 0.35 : 1);
    this.wind.gain.gain.setTargetAtTime(windBase * (0.7 + 0.3 * Math.sin(t * 0.31)), t, 0.3);
    // drizzle rises with thick mist, muffled under a roof
    const rainBase = (s.mist ?? 0) > 0.45 ? ((s.mist - 0.45) * 0.11) : 0;
    this.rain.gain.gain.setTargetAtTime(rainBase * (s.interior ? 0.3 : 1), t, 1.4);
    this.wind.filt.frequency.setTargetAtTime(550 + s.altitude * 26, t, 0.5);
    // room tone indoors
    this.room.gain.gain.setTargetAtTime(s.interior ? 0.16 : 0.0, t, 0.25);
    // crickets (#64): night, surface only — the drowned levels do not gain new life.
    // Base gain + LFO depth move together so the trill scales with the bed.
    const cricketBase = (s.night ?? 0) * ((s.level ?? 1) <= 1 ? 1 : 0) * (s.interior ? 0.2 : 1) * 0.045;
    this.crickets.gain.gain.setTargetAtTime(cricketBase, t, 2.2);
    this.cricketLfoG.gain.setTargetAtTime(cricketBase * 0.75, t, 2.2);
    // dawn chorus (#64): scattered distant chirps, unscheduled and unrepeating — the
    // island waking. Never indoors, never below the surface; the stones' puzzle bird
    // (BIRD_MELODY, vol 0.35) always reads over these 0.05-0.10 far-field calls.
    if ((s.dawn ?? 0) > 0 && (s.level ?? 1) <= 1 && !s.interior) {
      this._chorusT = (this._chorusT ?? 1.5) - dt;
      if (this._chorusT <= 0) {
        this._chorusT = 0.9 + Math.random() * 2.8;
        // each call comes from somewhere real (#63): a random bearing 14-40m out,
        // so the dawn arrives around you instead of inside your head
        const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 26;
        this.chirp(460 + Math.random() * 430, 0, 0.05 + Math.random() * 0.05,
          { x: this._px + Math.sin(a) * d, z: this._pz + Math.cos(a) * d, ref: 30 });
      }
    }
  },

  // The brink of a dive and authored beats can overlap now that the Upstream Hand
  // leaves control live. Give independent systems ownership of the held breath:
  // releasing one must not swell the surf while another still needs the quiet.
  // Ordinary gameplay beats share one owner; long-running independent effects name
  // their own owner so releasing one cannot restore the surf beneath another.
  duckAmbient(on, owner = 'gameplay') {
    this._ambientDuckOwners ||= new Set();
    const key = String(owner || 'gameplay');
    if (on) this._ambientDuckOwners.add(key);
    else this._ambientDuckOwners.delete(key);
    const ducked = this._ambientDuckOwners.size > 0;
    if (this.ready) this.amb.gain.setTargetAtTime(ducked ? 0.05 : 1, ctx.currentTime, ducked ? 0.45 : 1.4);
    return ducked;
  },

  ambientDuckOwners() {
    return [...(this._ambientDuckOwners || [])].sort();
  },

  // ---------------- one-shots ----------------
  _env(node, t0, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  },

  // ---- spatial one-shots (#63): sound gets a BEARING, kept flat (no HRTF) ----
  // The player pose is cached each frame from update(s); _at() turns a world (x,z)
  // into stereo pan (bearing vs facing) + distance gain (soft rolloff, ref metres to
  // half-volume-ish). _out() builds a per-shot gain→StereoPanner chain onto the given
  // bus — nodes live only as long as the shot, so steady-state DSP stays exactly flat.
  _px: 0, _pz: 0, _pyaw: 0,
  _at(x, z, ref = 18) {
    const dx = x - this._px, dz = z - this._pz;
    const d = Math.hypot(dx, dz) || 1e-4;
    // camera at yaw faces (-sin,-cos); its right hand is (cos,-sin) — project the bearing
    const pan = (dx * Math.cos(this._pyaw) - dz * Math.sin(this._pyaw)) / d;
    return { pan: clamp(pan, -1, 1), gain: ref / (ref + d) };
  },
  _out(at, bus) {
    bus = bus || this.fx;
    if (!at || !ctx.createStereoPanner) return bus;
    const { pan, gain } = this._at(at.x, at.z, at.ref);
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p).connect(bus);
    return g;
  },

  // FM bell-pluck — the music box voice
  pluck(freq, when = 0, vol = 0.5, decay = 1.4, at = null) {
    if (!this._running()) return;
    const t0 = ctx.currentTime + when;
    const car = ctx.createOscillator(); car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.frequency.value = freq * 3.01;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(freq * 1.8, t0);
    mg.gain.exponentialRampToValueAtTime(1, t0 + decay * 0.7);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    this._env(g, t0, 0.006, vol, decay);
    car.connect(g).connect(this._out(at, this.music));
    car.start(t0); mod.start(t0);
    car.stop(t0 + decay + 0.2); mod.stop(t0 + decay + 0.2);
    // Most callers let a pluck finish. Cinematics may compress time, so return a tiny
    // cancellation handle that can silence even a voice whose scheduled start is still
    // in the future. Existing fire-and-forget call sites remain unchanged.
    return () => {
      const t = ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0.0001, t, 0.025);
        car.stop(t + 0.14); mod.stop(t + 0.14);
      } catch (_) {}
    };
  },

  // a gull cries (#64) — two-syllable "kee-yaa": sawtooth through a swept bandpass,
  // the second syllable falling. vol is pre-scaled by the caller for distance.
  gullCry(vol = 0.2, at = null) {
    if (!this._running()) return;
    const t0 = ctx.currentTime;
    for (const [syl, f0, f1, dur, v] of [[0, 1240, 990, 0.14, 0.7], [0.18, 1120, 640, 0.3, 1]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t0 + syl);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + syl + dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.4;
      bp.frequency.setValueAtTime(f0 * 1.5, t0 + syl);
      bp.frequency.exponentialRampToValueAtTime(f1 * 1.4, t0 + syl + dur);
      const g = ctx.createGain(); this._env(g, t0 + syl, 0.02, vol * v, dur);
      o.connect(bp).connect(g).connect(this._out(at));
      o.start(t0 + syl); o.stop(t0 + syl + dur + 0.12);
    }
  },

  // a crow caws (#64) — one or two harsh flat pulses, the lone voice of an island
  // gone quiet. Rasp comes from a fast square tremolo chopping the sawtooth.
  crowCaw(vol = 0.2, double = Math.random() < 0.45, at = null) {
    if (!this._running()) return;
    const t0 = ctx.currentTime;
    const pulses = double ? [0, 0.26] : [0];
    for (const syl of pulses) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(640, t0 + syl);
      o.frequency.exponentialRampToValueAtTime(470, t0 + syl + 0.18);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.6;
      const trem = ctx.createOscillator(); trem.type = 'square'; trem.frequency.value = 26;
      const tg = ctx.createGain(); tg.gain.value = 0.5;
      const tbase = ctx.createGain(); tbase.gain.value = 0.55;
      trem.connect(tg).connect(tbase.gain);
      const g = ctx.createGain(); this._env(g, t0 + syl, 0.015, vol, 0.2);
      o.connect(bp).connect(tbase).connect(g).connect(this._out(at));
      o.start(t0 + syl); o.stop(t0 + syl + 0.3);
      trem.start(t0 + syl); trem.stop(t0 + syl + 0.3);
    }
  },

  // the bird sings a note — formant chirp
  chirp(freq, when = 0, vol = 0.35, at = null) {
    if (!this._running()) return;
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
    o.connect(f).connect(g).connect(this._out(at));
    o.start(t0); o.stop(t0 + 0.45);
  },

  // a standing stone hums. damp 0..1 (#51): the deep's version — darker filter, a shade
  // flat, quieter and longer, the hum arriving as through water.
  stoneTone(i, vol = 0.4, damp = 0, at = null) {
    if (!this._running()) return;
    const freq = (STONE_NOTES[i] / 2) * (1 - damp * 0.028); // an octave down: monoliths, not chimes
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    this._env(g, t0, 0.08 + damp * 0.07, vol * (1 - damp * 0.4), 2.2 + damp * 0.9);
    for (const det of [-4, 3]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(900 - damp * 560, t0);
      f.frequency.exponentialRampToValueAtTime(220 - damp * 90, t0 + 2.0 + damp * 0.8);
      o.connect(f).connect(g);
      o.start(t0); o.stop(t0 + 2.6 + damp);
    }
    g.connect(this._out(at));
  },

  chime() { this.pluck(1046.5, 0, 0.3, 1.8); this.pluck(1318.5, 0.09, 0.22, 2.2); },
  // the fallen stone before its note comes home (#49): a dead knock — all thump, no
  // pitch, the sound of a door with no room behind it
  stoneDead() {
    if (!this._running()) return;
    const t0 = ctx.currentTime;
    const len = 0.12 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(f).connect(g).connect(this.fx);
    src.start(t0);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(82, t0);
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.16);
    const og = ctx.createGain(); this._env(og, t0, 0.004, 0.3, 0.16);
    o.connect(og).connect(this.fx); o.start(t0); o.stop(t0 + 0.25);
  },
  // the five stem-earning solves answer in the island's OWN figure (#65): the
  // leitmotif strummed quickly — the final bell's crown in miniature — while the
  // ~10 ordinary solves keep the generic two-note chime.
  leitStrum() {
    LEIT.forEach((f, i) => this.pluck(f, i * 0.085, 0.2 - i * 0.018, 2.8));
  },

  // #137 (AAA-B3): each of HIS ROUNDS voices the theme on its own instrument — the
  // same five notes, three more hands (the WIND round IS the music box, so it plays
  // itself). Quiet, under the beds; the fourth bends down the way his hands bent it.
  themeRound(kind) {
    if (!this._running()) return;
    const P = {
      Moor:  { oct: 0.25, vol: 0.16, dec: 1.1, gap: 0.55 },   // low wood — dory-hull knocks
      Log:   { oct: 2,    vol: 0.07, dec: 0.35, gap: 0.27 },  // dry exact ticks — pen on a return
      Light: { oct: 1,    vol: 0.11, dec: 6.0, gap: 0.9 },    // warm glass — long-held
    }[kind];
    if (!P) return;
    this._lastRound = { kind, notes: [] };
    LEIT.forEach((f, i) => {
      this.pluck(f * P.oct * (i === 3 ? 0.985 : 1), i * P.gap, P.vol, P.dec);
      this._lastRound.notes.push(i);
    });
  },
  deny() {
    if (!this._running()) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = 72; o.type = 'sine';
    const g = ctx.createGain(); this._env(g, t0, 0.01, 0.5, 0.5);
    o.connect(g).connect(this.fx); o.start(t0); o.stop(t0 + 0.7);
  },

  crankTick() {
    if (!this._running()) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1400 + Math.random() * 300;
    const g = ctx.createGain(); this._env(g, t0, 0.001, 0.05, 0.03);
    o.connect(g).connect(this.fx); o.start(t0); o.stop(t0 + 0.06);
  },

  // THE UPSTREAM HAND: make the scale break audible. A bright mechanism falls
  // through the audible range toward a room-sized pressure tone while four brass
  // ticks mark the miniature wheel. It is a one-shot graph—zero steady-state DSP.
  upstreamHand(at = null) {
    if (!this._running()) return;
    const t0 = ctx.currentTime;
    const out = this._out(at, this.fx);
    const body = ctx.createGain();
    body.gain.setValueAtTime(0.0001, t0);
    body.gain.exponentialRampToValueAtTime(0.16, t0 + 0.65);
    body.gain.exponentialRampToValueAtTime(0.22, t0 + 4.8);
    body.gain.exponentialRampToValueAtTime(0.0001, t0 + 8.2);
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.Q.value = 0.8;
    low.frequency.setValueAtTime(5200, t0);
    low.frequency.exponentialRampToValueAtTime(180, t0 + 6.8);
    body.connect(low).connect(out);
    const voices = [];
    for (const [type, start, end, vol] of [
      ['sine', 1760, 55, 1],
      ['triangle', 1320, 82.4, 0.42],
    ]) {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(start, t0);
      o.frequency.exponentialRampToValueAtTime(end, t0 + 7.4);
      const g = ctx.createGain(); g.gain.value = vol;
      o.connect(g).connect(body); o.start(t0); o.stop(t0 + 8.3);
      voices.push(o);
    }
    const stopTicks = [0.15, 0.48, 0.86, 1.32].map((when, i) =>
      this.pluck(1568 * Math.pow(0.84, i), when, 0.11 - i * 0.012, 1.9, at));

    // Leaving L2 resolves the visual score immediately. Return the same kind of
    // cancellation handle as pluck() so its descending pressure voice and any
    // not-yet-started ticks cannot leak for eight seconds into the next stratum.
    return () => {
      const now = ctx.currentTime;
      try {
        body.gain.cancelScheduledValues(now);
        body.gain.setTargetAtTime(0.0001, now, 0.025);
        voices.forEach((o) => { try { o.stop(now + 0.14); } catch (_) {} });
        stopTicks.forEach((stop) => stop?.());
      } catch (_) {}
    };
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
    if (!this._running()) return;
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
    const drone = (freq, vol) => {
      const voices = [];
      const gain = mk((g) => {
      for (const det of [-3, 4]) {
        const o = ctx.createOscillator(); o.frequency.value = freq; o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = vol;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + n * 0.013;
        const lg = ctx.createGain(); lg.gain.value = freq * 1.5;
        lfo.connect(lg).connect(f.frequency);
        o.connect(f).connect(og).connect(g);
        o.start(); lfo.start();
        voices.push(o, lfo);
      }
      });
      this._stemStops[n] = () => {
        const now = ctx.currentTime;
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0.0001, now);
          voices.forEach((node) => { try { node.stop(now); } catch (_) {} });
          gain.disconnect();
        } catch (_) {}
      };
      return gain;
    };
    this._stemGains = this._stemGains || {};
    this._stemStops = this._stemStops || {};
    switch (n) {
      case 1: this._stemGains[1] = drone(110, 0.05); break;  // A2 root
      case 2: this._stemGains[2] = drone(164.8, 0.04); break; // E3 fifth
      case 3: { // slow leitmotif arp
        let i = 0;
        this._arp = setInterval(() => { this.pluck(LEIT[i % 5] / 2, 0, 0.10, 3.0); i++; }, 3800);
        break;
      }
      case 4: { // deep pulse
        this._pulse = setInterval(() => {
          if (!this._running()) return;   // muted-suspend (#68): no beats onto a frozen clock
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
      case 6: { // the sixth note (#49): the keeper's song accepted — a soft B under the
        // score (a held second against the A-root drones, longing made tonal) + a slow
        // answering B-bell. The era bed also starts resolving fragments onto B.
        this._stemGains[6] = drone(123.47, 0.028);   // B2 against the A2 root
        this._sixth = setInterval(() => {
          this.pluck(493.88, 0, 0.055, 5.0);
        }, 12700);
        break;
      }
    }
  },

  resetScore() {
    for (const key of ['_arp', '_pulse', '_shimmer', '_sixth']) {
      clearInterval(this[key]);
      this[key] = null;
    }
    for (const stop of Object.values(this._stemStops || {})) stop();
    this._stemStops = {};
    this._stemGains = {};
    this.stems = [];
    this._lastRound = null;
    this._lastTheme = null;
    this.musicStop();
  },

  scoreState() {
    return {
      stems: [...this.stems],
      drones: Object.keys(this._stemStops || {}).map(Number).sort((a, b) => a - b),
      intervals: {
        arp: this._arp != null, pulse: this._pulse != null,
        shimmer: this._shimmer != null, sixth: this._sixth != null,
      },
    };
  },

  bellToll(withhold = false) {
    if (!this.ready) return;
    const t0 = ctx.currentTime;
    // the bell rung at depth WITHHOLDS — the gathered score thins instead of
    // swelling, and the leitmotif never crowns. Awe and dread live in
    // subtraction; the bottom must sound like the bottom (#22).
    if (withhold) {
      this.pluck(110, 0, 0.5, 9);          // a lone tonic, no answering chord
      this.pluck(220, 0.02, 0.28, 8);
      for (const n of [1, 2, 6]) {         // the drones you earned fade away (the sixth too)
        const g = this._stemGains?.[n];
        if (g) { g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(0.0001, t0 + 0.4, 3.2); }
      }
      clearInterval(this._arp); clearInterval(this._pulse); clearInterval(this._shimmer); clearInterval(this._sixth);
      // a single falling figure into the quiet — descent, not crown
      this.pluck(329.63, 1.3, 0.18, 6);
      this.pluck(261.63, 3.1, 0.16, 7);
      this.pluck(174.61, 5.4, 0.14, 9);
      return;
    }
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
    if (has(6)) {                                  // the sixth note answers too (#49):
      this.pluck(493.88, 1.0, 0.2, 7);             // the song he could not finish, in the crown
      this.pluck(987.77, 2.7, 0.06, 6);
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
    if (!this._running()) return;
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

  // ---------------- the era MUSIC bed: GENERATIVE (owner: the canned stems were not great) ----
  // The color-psychology arc made HEARD by the island's own synth voice, not a 12-second loop:
  // per-level ROOT from the leitmotif's own family (E G A D C), a breathing two-osc drone + fifth,
  // a slow sea-breath noise pad, and a sparse melody that walks fragments of the LEITMOTIF
  // transposed into the era's key. Depth darkens everything — cutoff falls, detune widens, the
  // fragments thin — and the melody carries the story's own wound: the FOURTH note (the one the
  // keeper bends down where the bird bends it up) plays a shade flat one level down, flatter the
  // deeper, and at the source it does not come at all (the box's #51 behavior, in the score).
  // Endless, non-repeating, ~7 nodes; musicTo() keeps its API — it RETARGETS one persistent
  // graph instead of crossfading buffers.
  // #137 (AAA-B3): each era ARRANGES the same five notes its own way — `arr` is the
  // phrasing: stated (in order, even, the box's own voice), rising (upward figures,
  // quicker — wonder), measured (clipped metronomic pairs — the inspection), sinking
  // (downward, slowest — the last winter). oct lifts the figure's octave; step is the
  // base note spacing (s); jitter humanizes it (0 = quantized exactly).
  _ERAS: [null,
    { root: 82.41, cutoff: 950, det: 4, gapLo: 9, gapHi: 15, breath: 16, vol: 1.00, arr: 'stated', oct: 1, step: 1.5, jitter: 0.5 },   // L1 E2 — the last day
    { root: 98.00, cutoff: 620, det: 7, gapLo: 11, gapHi: 17, breath: 19, vol: 0.95, arr: 'rising', oct: 2, step: 1.0, jitter: 0.6 },  // L2 G2 — the arrival years
    { root: 110.0, cutoff: 420, det: 11, gapLo: 14, gapHi: 21, breath: 23, vol: 0.90, arr: 'measured', oct: 1, step: 1.2, jitter: 0 }, // L3 A2 — the inspection years
    { root: 73.42, cutoff: 300, det: 16, gapLo: 17, gapHi: 25, breath: 28, vol: 0.85, arr: 'sinking', oct: 1, step: 2.4, jitter: 0.9 },// L4 D2 — the last winter
  ],
  _buildBed() {
    const bed = { master: ctx.createGain() };
    bed.master.gain.value = 0;
    bed.master.connect(this.musicBed);
    // the drone: root pair (sine+triangle, detuned) + a quiet fifth, through one breathing lowpass
    bed.filt = ctx.createBiquadFilter(); bed.filt.type = 'lowpass'; bed.filt.frequency.value = 950; bed.filt.Q.value = 0.4;
    bed.filt.connect(bed.master);
    bed.oscs = [];
    const mkOsc = (type, ratio, vol) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 82.41 * ratio;
      const g = ctx.createGain(); g.gain.value = vol;
      o.connect(g).connect(bed.filt); o.start();
      bed.oscs.push({ o, g, ratio });
      return o;
    };
    mkOsc('sine', 1, 0.16); mkOsc('triangle', 1, 0.07); mkOsc('sine', 1.5, 0.05);
    // the filter breathes on a slow LFO — the sea's own tempo, slower with depth
    bed.lfo = ctx.createOscillator(); bed.lfo.frequency.value = 1 / 16;
    bed.lfoG = ctx.createGain(); bed.lfoG.gain.value = 120;
    bed.lfo.connect(bed.lfoG).connect(bed.filt.frequency); bed.lfo.start();
    // sea-breath pad: a slow band of noise that swells against the drone
    bed.breath = this._noiseLoop('brown', 240, 'lowpass', 0.5);
    bed.breath.gain.gain.value = 0.05;
    bed.breath.out.connect(bed.master);
    return bed;
  },
  // one soft bed voice: sine swell with slow attack — a pad note, not a pluck
  _bedNote(freq, when, vol, dur) {
    if (!this._running()) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const ov = ctx.createOscillator(); ov.type = 'sine'; ov.frequency.value = freq * 2.01; // faint octave shimmer
    const og = ctx.createGain(); og.gain.value = 0.18;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); ov.connect(og).connect(g); g.connect(this._bed.master);
    o.start(t0); o.stop(t0 + dur + 0.1); ov.start(t0); ov.stop(t0 + dur + 0.1);
  },
  _bedMelody() {
    // a sparse fragment of the leitmotif, transposed into the era key (LEIT is rooted on E;
    // multiplying by root/E2's octave keeps the figure, moves the mode). Depth thins it.
    const lv = this._musicLevel || 1;
    const era = this._ERAS[Math.max(1, Math.min(this._ERAS.length - 1, lv))];
    const depth = Math.max(0, lv - 1);
    const T = (era.root / 82.41) / 2 * (era.oct || 1);      // era octave over the bed register
    // #137: the era chooses the PHRASING of the same five notes
    let seq;
    switch (era.arr) {
      case 'stated':   seq = [0, 1, 2, 3, 4]; break;                                   // the box's own order
      case 'rising':   seq = [0, 1, 2, (Math.random() * 5) | 0]; break;                // upward figure + a reach
      case 'measured': seq = [(Math.random() * 5) | 0, (Math.random() * 5) | 0]; break;// clipped pairs, exact
      default: {        // sinking — downward from wherever it starts
        const s0 = 2 + ((Math.random() * 3) | 0);
        seq = [s0, Math.max(0, s0 - 1), Math.max(0, s0 - 2)];
      }
    }
    const depthCut = depth > 1 && era.arr !== 'stated' && era.arr !== 'measured' ? seq.length - 1 : seq.length;   // measured pairs ARE the sparseness
    this._lastTheme = { arr: era.arr, notes: [] };          // structural probe (headless verify)
    let when = 0;
    for (let k = 0; k < depthCut; k++) {
      const idx = seq[k];
      let f = LEIT[idx] * T;
      if (idx === 3) {                                       // the FOURTH note carries the wound
        if (lv >= 4) continue;                               // at the source it does not come
        if (depth) f *= 1 - 0.015 * depth;                   // a shade flat, flatter deeper
      }
      this._bedNote(f, when, 0.10 - depth * 0.012, 5.5 + depth * 0.8);
      this._lastTheme.notes.push(idx);
      when += (era.step ?? 1.6) + Math.random() * (era.jitter ?? 1.4) + depth * 0.3;
    }
    // #49: once the keeper's song has been accepted (stem 6), the island's own music
    // carries the sixth — fragments sometimes resolve onto the B the pentatonic never had
    if (this.stems.includes(6) && Math.random() < 0.35) {
      this._bedNote(493.88 * T, when, 0.075 - depth * 0.01, 6.5);
    }
  },
  _bedTick() {
    if (!this._bed || this._bedStopped) return;
    if (this._running() && this._musicLevel >= 1) this._bedMelody();
    const era = this._ERAS[Math.max(1, Math.min(this._ERAS.length - 1, this._musicLevel || 1))];
    const gap = era.gapLo + Math.random() * (era.gapHi - era.gapLo);
    this._bedTimer = setTimeout(() => this._bedTick(), gap * 1000);
  },
  musicTo(level) {
    // halted (muted #68 / pre-unlock #62): skip — called every play frame, catches up on resume.
    if (!this._running()) return;
    const lv = Math.max(1, Math.min(this._ERAS.length - 1, level | 0));
    if (this._musicLevel === lv && this._bed && !this._bedStopped) return;
    const wasStopped = this._bedStopped;
    this._musicLevel = lv;
    this._bedStopped = false;
    if (!this._bed) { this._bed = this._buildBed(); this._bedTick(); }
    else if (wasStopped) { clearTimeout(this._bedTimer); this._bedTick(); }   // finale-stop → re-enter: re-arm the melody
    const bed = this._bed, era = this._ERAS[lv], t = ctx.currentTime;
    // retarget the one persistent graph — the era transition IS the crossfade
    bed.master.gain.setTargetAtTime(0.30 * era.vol, t, 3.5);
    bed.filt.frequency.setTargetAtTime(era.cutoff, t, 3.5);
    bed.lfo.frequency.setTargetAtTime(1 / era.breath, t, 3.5);
    for (const { o, g, ratio } of bed.oscs) {
      o.frequency.setTargetAtTime(era.root * ratio, t, 2.8);
      g.gain.setTargetAtTime(g.gain.value, t, 3.5);         // (volumes are static per-osc)
    }
    // widen the root pair's detune with depth (the drone loses its certainty going down)
    if (bed.oscs[0]) bed.oscs[0].o.detune.setTargetAtTime(-era.det, t, 3.0);
    if (bed.oscs[1]) bed.oscs[1].o.detune.setTargetAtTime(era.det, t, 3.0);
    bed.breath.filt.frequency.setTargetAtTime(Math.max(140, era.cutoff * 0.4), t, 3.5);
  },

  // stop the era bed (the finale / leaving owns the soundscape from here)
  musicStop() {
    this._musicLevel = 0;
    this._bedStopped = true;
    clearTimeout(this._bedTimer);
    if (this._bed) { try { this._bed.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 2); } catch (_) {} }
  },

  // the dive: the whole island drops an octave and comes back
  diveSweep(durSec) {
    if (!this.ready) return () => {};
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
    const voices = notes.map((f, i) => this.pluck(f, i * (durSec / 8), 0.12, 2.5)).filter(Boolean);
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      const t = ctx.currentTime;
      // An accelerated crossing lands long before the original 21-second automation.
      // Return the sea to its ordinary filter and pitch instead of letting the old dive
      // continue invisibly underneath the next level for another quarter-minute.
      try {
        this.diveFilter.frequency.cancelScheduledValues(t);
        this.diveFilter.frequency.setTargetAtTime(19000, t, 0.08);
        this.surf.src.playbackRate.cancelScheduledValues(t);
        this.surf.src.playbackRate.setTargetAtTime(1, t, 0.08);
        wet.gain.cancelScheduledValues(t);
        wet.gain.setTargetAtTime(0.0001, t, 0.045);
      } catch (_) {}
      voices.forEach((stop) => stop());
      setTimeout(() => {
        try {
          old.disconnect(feed);
          fb.gain.value = 0;
          feed.disconnect(); del.disconnect(); fb.disconnect(); wet.disconnect();
        } catch (_) {}
      }, 500);
    };
    const timer = setTimeout(dispose, (durSec + 8) * 1000);
    return dispose;
  },
};

export default A;
