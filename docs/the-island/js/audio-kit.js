// audio-kit.js — synthesized foley and space for the island. Pure Web Audio: every voice
// here is built from one cached noise buffer, oscillators and filters at the moment it
// plays, and every node stops itself. audio.js owns the graph and decides WHEN; this file
// only knows HOW a thing sounds. Nothing is downloaded.
//
// Player walk, October 2026: footsteps were one 90 ms noise burst for every surface, half
// the interactions (every book, letter and slate) made no sound at all, and nothing in the
// game had a room around it. The voices below are the fix:
//
//   reverbIR      a generated impulse response: exponential decay, early reflections, and a
//                 lowpass that closes over the tail so it darkens the way a real room does
//   footstep      heel and toe on pebble, sand, grass, wood, stone, iron and water
//   paper         a book's cover and pages, a letter unfolding, a slate brushed, a page turned
//   creak         rope, hinge and stair timber under load
//   drawer, glass small handled things
//   waveBreak     one breaking wave: the curl, the crash, the long wash and its foam fizz
//   drip          one drop into standing water underground

const _noise = new WeakMap();
function noiseBuffer(ctx) {
  let b = _noise.get(ctx);
  if (!b) {
    const len = 2 * ctx.sampleRate;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    _noise.set(ctx, b);
  }
  return b;
}

const rnd = (a, b) => a + Math.random() * (b - a);

// a shaped noise burst: filtered, enveloped, self-stopping
function burst(ctx, dest, t, dur, { type = 'bandpass', freq = 1000, q = 0.8, gain = 0.2, attack = 0.002, sweepTo = null, loop = false } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = loop;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  src.connect(f).connect(g).connect(dest);
  const off = Math.random() * 1.5;
  src.start(t, off);
  src.stop(t + attack + dur + 0.02);
  return { src, f, g };
}

// a short pitched body: the weight of a foot, the knock of a board
function thud(ctx, dest, t, { freq = 110, drop = 1.7, dur = 0.07, gain = 0.4, type = 'sine' } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq * drop, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

// a scatter of tiny grains: shingle shifting, sand crunching, paper crinkling
function grains(ctx, dest, t, span, n, { lo = 1500, hi = 4500, q = 5, gain = 0.25, dur = [0.002, 0.006], early = 1.6 } = {}) {
  for (let i = 0; i < n; i++) {
    const at = t + span * Math.pow(Math.random(), early);   // denser at the start of the contact
    burst(ctx, dest, at, rnd(dur[0], dur[1]), { freq: rnd(lo, hi), q: rnd(q * 0.6, q * 1.4), gain: gain * rnd(0.35, 1) });
  }
}

// ------------------------------------------------------------------- reverb --
// Stereo, decorrelated channels. `seconds` is the -60 dB time. The lowpass that walks
// down the tail (bright -> dark) is what makes a generated tail sound like air and stone
// rather than like hiss.
export function reverbIR(ctx, { seconds = 2, bright = 7000, dark = 900, early = [], predelay = 0.01 } = {}) {
  const sr = ctx.sampleRate, len = Math.ceil((seconds + predelay) * sr);
  const buf = ctx.createBuffer(2, len, sr);
  const tau = seconds / 6.9;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const p0 = Math.floor(predelay * sr);
    for (let i = p0; i < len; i++) {
      const t = (i - p0) / sr;
      const cutoff = dark + (bright - dark) * Math.exp(-t / (tau * 0.9));
      const a = Math.exp(-2 * Math.PI * cutoff / sr);
      lp = (1 - a) * (Math.random() * 2 - 1) + a * lp;
      d[i] = lp * Math.exp(-t / tau) * (1.6 + 0.4 * (1 - a));
    }
    // early reflections: the room's walls, a few discrete taps
    for (const [ms, amp] of early) {
      const i = p0 + Math.floor((ms / 1000) * sr * (ch ? 1.07 : 1));
      if (i < len) d[i] += amp * (ch ? -1 : 1);
    }
  }
  // normalize so the wet send level means the same thing for every IR
  let e = 0;
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) e += d[i] * d[i]; }
  const k = 1 / Math.sqrt(e / 2 + 1e-9) * 0.9;
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] *= k; }
  return buf;
}

// ----------------------------------------------------------------- footsteps --
// `surface`: pebble | sand | grass | wood | stone | iron | water. `weight` 0.6..1.2
// (heel vs toe), `dest` already panned and levelled by the caller.
function footfall(ctx, dest, t, surface, weight) {
  const w = weight;
  switch (surface) {
    case 'pebble':    // shingle: the stones shift and clack against each other
      thud(ctx, dest, t, { freq: rnd(85, 110), dur: 0.05, gain: 0.2 * w });
      grains(ctx, dest, t, 0.12, Math.round(rnd(14, 20) * w), { lo: 1900, hi: 6200, q: 5, gain: 0.5 * w });
      burst(ctx, dest, t, 0.07, { freq: 3200, q: 0.8, gain: 0.07 * w });
      break;
    case 'sand':      // soft: a dull press and a dry hush, a few fine grains
      thud(ctx, dest, t, { freq: rnd(70, 95), dur: 0.08, gain: 0.36 * w, drop: 1.3 });
      burst(ctx, dest, t, 0.12, { freq: 1100, q: 0.6, gain: 0.12 * w, attack: 0.014 });
      grains(ctx, dest, t, 0.09, Math.round(5 * w), { lo: 1700, hi: 3400, q: 3, gain: 0.05 * w });
      break;
    case 'grass':
      thud(ctx, dest, t, { freq: rnd(75, 95), dur: 0.07, gain: 0.24 * w, drop: 1.3 });
      burst(ctx, dest, t, 0.15, { freq: 2600, q: 0.55, gain: 0.12 * w, attack: 0.045 });
      grains(ctx, dest, t + 0.02, 0.1, Math.round(4 * w), { lo: 4500, hi: 7000, q: 2, gain: 0.04 * w });
      break;
    case 'wood': {
      thud(ctx, dest, t, { freq: rnd(100, 125), dur: 0.09, gain: 0.42 * w });
      const f0 = rnd(165, 235);   // the board's own note
      burst(ctx, dest, t, 0.006, { freq: f0, q: 11, gain: 1.4 * w });
      burst(ctx, dest, t, 0.006, { freq: f0 * 2.31, q: 9, gain: 0.5 * w });
      burst(ctx, dest, t, 0.02, { type: 'highpass', freq: 1800, q: 0.7, gain: 0.05 * w });
      if (w > 0.9 && Math.random() < 0.07) creak(ctx, dest, t + 0.03, { base: rnd(420, 560), dur: 0.28, gain: 0.02 });
      break;
    }
    case 'stone':
      thud(ctx, dest, t, { freq: rnd(120, 150), dur: 0.05, gain: 0.3 * w });
      burst(ctx, dest, t, 0.012, { type: 'highpass', freq: 1700, q: 0.7, gain: 0.26 * w });
      grains(ctx, dest, t, 0.05, Math.round(3 * w), { lo: 2500, hi: 5000, q: 4, gain: 0.06 * w });
      break;
    case 'iron':
      burst(ctx, dest, t, 0.012, { type: 'highpass', freq: 1500, q: 0.7, gain: 0.22 * w });
      thud(ctx, dest, t, { freq: 140, dur: 0.05, gain: 0.25 * w });
      for (const [f, a, d] of [[612, 0.11, 0.5], [1003, 0.07, 0.38], [1730, 0.035, 0.24]]) {   // the plate rings under the boot
        const o = ctx.createOscillator(); o.frequency.value = f * rnd(0.98, 1.02);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * w, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(dest); o.start(t); o.stop(t + d + 0.02);
      }
      break;
    case 'water':
      burst(ctx, dest, t, 0.28, { type: 'lowpass', freq: 2800, sweepTo: 600, q: 0.9, gain: 0.28 * w, attack: 0.012 });
      thud(ctx, dest, t, { freq: 70, dur: 0.1, gain: 0.18 * w, drop: 1.2 });
      for (let i = 0; i < 3; i++) {
        const at = t + rnd(0.04, 0.22), f = rnd(500, 1300);
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 1.6, at + 0.04);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.035 * w, at + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        o.connect(g).connect(dest); o.start(at); o.stop(at + 0.07);
      }
      break;
    default:
      thud(ctx, dest, t, { gain: 0.3 * w });
  }
}

export function footstep(ctx, dest, surface, { t = ctx.currentTime, gain = 1 } = {}) {
  const g = ctx.createGain(); g.gain.value = gain * rnd(0.85, 1.1);
  g.connect(dest);
  footfall(ctx, g, t, surface, 1);
  // the toe follows the heel, lighter; wading is one push through the water
  if (surface !== 'water') footfall(ctx, g, t + rnd(0.035, 0.06), surface, 0.5);
  setTimeout(() => { try { g.disconnect(); } catch (_) {} }, 1500);
}

// --------------------------------------------------------------------- paper --
export function paper(ctx, dest, kind, { t = ctx.currentTime, gain = 1 } = {}) {
  const g = ctx.createGain(); g.gain.value = gain; g.connect(dest);
  switch (kind) {
    case 'book':      // the cover lifts and drops open, then a few pages fall over
      thud(ctx, g, t, { freq: 95, dur: 0.09, gain: 0.32, drop: 1.4 });
      burst(ctx, g, t, 0.05, { type: 'lowpass', freq: 700, gain: 0.12 });
      for (let i = 0; i < 3; i++) {
        const at = t + 0.12 + i * rnd(0.06, 0.09);
        burst(ctx, g, at, 0.07, { freq: 3400, q: 0.8, gain: 0.07 * (1 - i * 0.25), attack: 0.02 });
        grains(ctx, g, at, 0.06, 4, { lo: 3000, hi: 7000, q: 2, gain: 0.04 });
      }
      break;
    case 'letter':    // folded paper opened: a crinkle that swells and settles
      burst(ctx, g, t, 0.35, { type: 'lowpass', freq: 3200, gain: 0.09, attack: 0.1 });
      grains(ctx, g, t, 0.4, 34, { lo: 1800, hi: 7000, q: 2.2, gain: 0.18, dur: [0.003, 0.016], early: 0.8 });
      break;
    case 'inscription':   // a hand brushing grit off stone, wax or a slate
      burst(ctx, g, t, 0.34, { freq: 1300, q: 0.6, gain: 0.16, attack: 0.12 });
      grains(ctx, g, t + 0.05, 0.3, 12, { lo: 1800, hi: 3800, q: 4, gain: 0.1 });
      break;
    case 'shelf':     // a volume drawn out along the board
      burst(ctx, g, t, 0.26, { freq: 900, q: 2, gain: 0.06, attack: 0.06 });
      thud(ctx, g, t + 0.3, { freq: 120, dur: 0.07, gain: 0.25 });
      break;
    case 'page':      // one leaf turned over
      burst(ctx, g, t, 0.11, { freq: 3200, q: 0.7, gain: 0.2, attack: 0.03 });
      grains(ctx, g, t + 0.02, 0.12, 10, { lo: 2400, hi: 6500, q: 2, gain: 0.12 });
      break;
    case 'close':     // the thing set back down
      burst(ctx, g, t, 0.12, { type: 'lowpass', freq: 2000, gain: 0.07, attack: 0.02 });
      thud(ctx, g, t + 0.05, { freq: 105, dur: 0.06, gain: 0.12 });
      break;
  }
  setTimeout(() => { try { g.disconnect(); } catch (_) {} }, 2000);
}

// --------------------------------------------------------------- creak, etc --
// friction: a sawtooth whose pitch wanders and whose level is chopped into stick-slip
// grains — the sound a loaded rope or a dry hinge actually makes
export function creak(ctx, dest, t = ctx.currentTime, { base = 340, dur = 0.5, gain = 0.05, slip = 22 } = {}) {
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * rnd(0.82, 0.92), t + dur);
  const vib = ctx.createOscillator(); vib.frequency.value = rnd(5, 9);
  const vibG = ctx.createGain(); vibG.gain.value = base * 0.04;
  vib.connect(vibG).connect(o.frequency);
  const chop = ctx.createOscillator(); chop.type = 'square'; chop.frequency.value = slip * rnd(0.85, 1.2);
  const chopG = ctx.createGain(); chopG.gain.value = 0.5;
  const amp = ctx.createGain(); amp.gain.value = 0.5;
  chop.connect(chopG).connect(amp.gain);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 2.6; bp.Q.value = 2.5;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(amp).connect(bp).connect(env).connect(dest);
  for (const n of [o, vib, chop]) { n.start(t); n.stop(t + dur + 0.05); }
}

export function hatch(ctx, dest, t = ctx.currentTime) {
  creak(ctx, dest, t, { base: 300, dur: 0.6, gain: 0.05, slip: 17 });
  thud(ctx, dest, t + 0.62, { freq: 90, dur: 0.14, gain: 0.4, drop: 1.5 });
  burst(ctx, dest, t + 0.62, 0.08, { type: 'lowpass', freq: 900, gain: 0.12 });
}

export function rope(ctx, dest, t = ctx.currentTime) {
  creak(ctx, dest, t, { base: 190, dur: 0.32, gain: 0.4, slip: 30 });
  creak(ctx, dest, t + 0.36, { base: 170, dur: 0.4, gain: 0.3, slip: 26 });
  burst(ctx, dest, t + 0.05, 0.25, { freq: 1500, q: 1, gain: 0.06, attack: 0.08 });   // fibre against the rail
}

export function drawer(ctx, dest, t = ctx.currentTime) {
  burst(ctx, dest, t, 0.42, { freq: 700, q: 1.6, gain: 0.07, attack: 0.08 });
  creak(ctx, dest, t + 0.05, { base: 520, dur: 0.3, gain: 0.012, slip: 40 });
  thud(ctx, dest, t + 0.46, { freq: 130, dur: 0.07, gain: 0.3 });
  burst(ctx, dest, t + 0.46, 0.02, { type: 'highpass', freq: 1500, gain: 0.08 });
}

export function glass(ctx, dest, t = ctx.currentTime) {
  burst(ctx, dest, t, 0.004, { type: 'highpass', freq: 4000, gain: 0.25 });
  for (const [f, a, d] of [[2637, 0.06, 0.9], [4186, 0.03, 0.6], [5920, 0.015, 0.4]]) {
    const o = ctx.createOscillator(); o.frequency.value = f * rnd(0.995, 1.005);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest); o.start(t); o.stop(t + d + 0.02);
  }
}

// ---------------------------------------------------------------- the sea --
// One wave breaking: the curl tightens (filter rising), the lip lands (peak), then the
// wash runs up the shingle and drains back (long darkening tail) with foam fizzing on top.
export function waveBreak(ctx, dest, t = ctx.currentTime, size = 1) {
  const dur = 2.4 + size * 1.4;
  const body = burst(ctx, dest, t, dur, { type: 'lowpass', freq: 380, q: 0.6, gain: 0.0002, attack: 0.01, loop: true });
  size *= 1.8;   // a break has to stand clear of the continuous surf bed under it
  body.f.frequency.cancelScheduledValues(t);
  body.f.frequency.setValueAtTime(380, t);
  body.f.frequency.exponentialRampToValueAtTime(2300 + 900 * size, t + 0.38);
  body.f.frequency.exponentialRampToValueAtTime(520, t + dur);
  body.g.gain.cancelScheduledValues(t);
  body.g.gain.setValueAtTime(0.0001, t);
  body.g.gain.exponentialRampToValueAtTime(0.03 * size, t + 0.25);
  body.g.gain.exponentialRampToValueAtTime(0.26 * size, t + 0.42);
  body.g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  body.src.stop(t + dur + 0.1);
  // the foam
  const fizz = burst(ctx, dest, t + 0.4, dur * 0.8, { type: 'highpass', freq: 4200, q: 0.5, gain: 0.05 * size, attack: 0.15, loop: true });
  fizz.src.stop(t + 0.4 + dur * 0.8 + 0.2);
  // the drag back through the stones: a late scatter of grains as the wash retreats
  grains(ctx, dest, t + dur * 0.45, dur * 0.45, Math.round(18 * size), { lo: 1800, hi: 4500, q: 5, gain: 0.03 * size, early: 0.7 });
}

// ------------------------------------------------------------ underground --
// A drop falling into standing water: the tick of the impact, then the air it drives under
// ringing UP in pitch as the bubble closes (the plink is a rising resonance, not a falling
// one). A tenth of a second; the room reverb is what makes it a cellar.
export function drip(ctx, dest, t = ctx.currentTime, { gain = 1 } = {}) {
  burst(ctx, dest, t, 0.003, { type: 'highpass', freq: 3500, q: 0.7, gain: 0.04 * gain });
  const at = t + rnd(0.002, 0.007), f0 = rnd(800, 1600);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.6, 2.3), at + rnd(0.03, 0.05));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.5 * gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + rnd(0.06, 0.11));
  o.connect(g).connect(dest);
  o.start(at); o.stop(at + 0.14);
}
