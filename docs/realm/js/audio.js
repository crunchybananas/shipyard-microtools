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
// Loop 23 (render S3): voice barks now have per-kind pitch contours and an
// optional voice-seed shift so not every settler sounds identical. Prior
// code was one frequency-sweep shape for all kinds; only the base pitch
// varied. Now happy/sad/work/hungry/cheer/alarm each have their own shape.
export function playVoiceBark(kind = 'happy', voiceSeed = 0) {
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const dest = ctx.destination;
  const pitchMap = { happy: 560, sad: 320, work: 460, hungry: 380, cheer: 700, alarm: 640 };
  // Per-citizen detune: ±12% from seed (0..255 hash). Voices keep their ratio
  // but each settler sounds a bit different.
  const detune = 1 + (((voiceSeed & 0xff) / 255) - 0.5) * 0.24;
  const base = (pitchMap[kind] || 500) * detune;

  // Shared helper
  const playShape = (type, points, peak) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.connect(g); g.connect(dest);
    for (const [dt, f] of points) {
      osc.frequency.linearRampToValueAtTime(f, t + dt);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.linearRampToValueAtTime(peak * 0.6, t + points[points.length - 1][0] - 0.05);
    g.gain.linearRampToValueAtTime(0, t + points[points.length - 1][0]);
    osc.start(t);
    osc.stop(t + points[points.length - 1][0] + 0.01);
  };
  // Set starting freq on the oscillator (first point with dt=0)
  const makeOscAt = (type, f) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    return {osc, g};
  };
  const emit = (type, seq, peak) => {
    const {osc, g} = makeOscAt(type, seq[0][1]);
    osc.connect(g); g.connect(dest);
    for (let i = 1; i < seq.length; i++) {
      osc.frequency.linearRampToValueAtTime(seq[i][1], t + seq[i][0]);
    }
    const end = seq[seq.length - 1][0];
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.linearRampToValueAtTime(peak * 0.6, t + end - 0.05);
    g.gain.linearRampToValueAtTime(0, t + end);
    osc.start(t); osc.stop(t + end + 0.01);
  };

  if (kind === 'happy') {
    // Two-note up lilt: hop + softer settle
    emit('sine', [[0, base], [0.08, base * 1.2], [0.18, base * 1.1]], 0.035);
  } else if (kind === 'sad') {
    // Slow downward sigh
    emit('sine', [[0, base], [0.22, base * 0.72], [0.38, base * 0.62]], 0.028);
  } else if (kind === 'work') {
    // Two-syllable grunt "uh-huh"
    emit('triangle', [[0, base], [0.05, base * 0.85], [0.09, base * 0.85], [0.14, base]], 0.035);
  } else if (kind === 'hungry') {
    // Whiny wobble
    emit('sine', [[0, base], [0.08, base * 1.1], [0.16, base * 0.95], [0.24, base * 1.05], [0.32, base * 0.9]], 0.03);
  } else if (kind === 'cheer') {
    // Bright three-note ascending arpeggio
    emit('sine', [[0, base], [0.06, base * 1.18], [0.12, base * 1.4], [0.22, base * 1.35]], 0.04);
  } else if (kind === 'alarm') {
    // Sharp up-down
    emit('square', [[0, base], [0.04, base * 1.35], [0.12, base * 0.85]], 0.028);
  } else {
    // Fallback — original shape
    emit('sine', [[0, base], [0.12, base * 1.3], [0.22, base * 0.9]], 0.035);
  }
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
    // ── Citizen death: somber descending sigh ──────────────
    // Loop 12 (render S3): dedicated death sound. Was reusing 'demolish'
    // (a building-collapse crash) which read as "a wall fell" instead of
    // "a person died". This is a soft downward triangle sigh + faint
    // subharmonic tail, so raid losses feel mournful rather than brash.
    case 'death': {
      const sigh = ctx.createOscillator();
      const sighG = ctx.createGain();
      sigh.type = 'triangle';
      sigh.frequency.setValueAtTime(440, t);
      sigh.frequency.exponentialRampToValueAtTime(146, t + 0.9);
      sighG.gain.setValueAtTime(0, t);
      sighG.gain.linearRampToValueAtTime(0.08, t + 0.05);
      sighG.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
      sigh.connect(sighG); sighG.connect(dest);
      sigh.start(t); sigh.stop(t + 1.0);
      // Sub tail
      makeOsc(ctx, dest, 'sine', 110, 0.05, 0.02, 1.2, t + 0.15);
      break;
    }

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

    // ── Combat clang: sword/shield impact ──────────────────
    case 'combat': {
      makeOsc(ctx, dest, 'square', 1600, 0.1, 0.001, 0.04, t);
      makeNoiseBurst(ctx, dest, 0.12, 0.08, t + 0.01, 6000);
      makeOsc(ctx, dest, 'triangle', 280, 0.08, 0.003, 0.12, t + 0.02);
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

    // ── Nightmare: Loop 106 (surprise, un-filed). A single low chord
    //    with a dissonant overtone that wavers. Long attack + long
    //    decay so it SNEAKS IN instead of startling. Plays exactly
    //    once per realm (043 nightmare is once-per-realm). Gain is
    //    low — a player absorbed in the UI might miss it, which fits
    //    the "rarest moment" philosophy. 64Hz is C2; 68Hz is a flat
    //    C#2, ~11 cents minor-second above → beating creates unease.
    case 'nightmare': {
      makeOsc(ctx, dest, 'triangle', 64, 0.10, 0.5, 2.2, t);
      makeOsc(ctx, dest, 'triangle', 68, 0.07, 0.5, 2.4, t);
      // High ghost overtone — barely audible, feels like a distant
      // bell no one remembered ringing.
      makeOsc(ctx, dest, 'sine',     384, 0.015, 0.3, 1.8, t + 0.15);
      break;
    }

    // ── Requiem: Loop 111 (surprise, 106-filed). Inverse of nightmare:
    //    a single church-bell toll when the realm falls (103 realm_fell
    //    beat). Clean sine + matched harmonic overtones (stack of 2, 3x
    //    fundamental) produce a bell-like partial profile — inharmonic
    //    but consonant. 196 Hz (G3) low, mournful. Long decay (5s) so it
    //    RINGS AWAY instead of starting and stopping. Low gain — this
    //    is a distant bell, not a dinner bell. Plays once per realm
    //    iff requiem beat fires. One toll, not a sequence; the realm
    //    is over, not mid-story.
    case 'requiem': {
      makeOsc(ctx, dest, 'sine',     196, 0.08,  0.02, 5.0, t);
      makeOsc(ctx, dest, 'sine',     392, 0.035, 0.02, 4.5, t);
      makeOsc(ctx, dest, 'sine',     588, 0.015, 0.02, 3.5, t);
      break;
    }

    // ── Stone: Loop 113 (the-fixer, 106-filed). Ascending perfect-
    //    fifth chime — E5 (659 Hz) then B5 (988 Hz) at +80ms. Short
    //    attack (chime struck), mid decay. Bright, consonant, discovery-
    //    coded. Contrasts 106 (dissonant low triangle) and 111 (mournful
    //    low bell) — audio-surfaces.md's 8-axis contrast table gets a
    //    3rd row. Plays once per realm when 056 checkStoneBeat fires.
    case 'stone': {
      makeOsc(ctx, dest, 'sine', 659, 0.07,  0.01, 1.3, t);
      makeOsc(ctx, dest, 'sine', 988, 0.055, 0.01, 1.5, t + 0.08);
      // High shimmer overtone — faint, sparkly.
      makeOsc(ctx, dest, 'sine', 1976, 0.015, 0.01, 0.9, t + 0.12);
      break;
    }

    // ── Founders: Loop 115 (the-composer, 106/111-filed; first use
    //    of the tick-114 expanded challenge pool). Three ascending
    //    minor-triad notes, one per founder slot. Slower pacing
    //    (~0.25s between notes) than stone's quick chime — reads as
    //    ceremonial rather than incidental. C5-Eb5-G5 = a minor triad;
    //    ceremonial but not heavy.
    case 'founders': {
      // C5, E♭5, G5 — rising minor triad
      makeOsc(ctx, dest, 'sine', 523, 0.06, 0.05, 0.9, t);
      makeOsc(ctx, dest, 'sine', 622, 0.06, 0.05, 0.9, t + 0.25);
      makeOsc(ctx, dest, 'sine', 784, 0.06, 0.05, 1.1, t + 0.50);
      break;
    }

    // ── First-snow: Loop 124 (the-composer, 115-filed; validates 123
    //    onFire refactor). Soft high-frequency noise burst at 8kHz cut
    //    — reads as "snow landing." Two overlapping bursts staggered by
    //    150ms create a subtle shimmer. Very quiet (0.04 peak) — the
    //    sound is less heard than felt, matching 106/111/113/115's
    //    "miss-able" philosophy. High-freq noise is distinct from every
    //    prior cue (all tonal); breaks pure-sine pattern deliberately.
    case 'first-snow': {
      makeNoiseBurst(ctx, dest, 0.04, 0.9, t, 8000);
      makeNoiseBurst(ctx, dest, 0.025, 0.7, t + 0.15, 6000);
      // Single high sine — like a distant bell at the frost threshold.
      makeOsc(ctx, dest, 'sine', 1568, 0.02, 0.02, 1.2, t + 0.05);
      break;
    }

    // ── Offering: Loop 125 (the-composer, 106-filed — CLOSES
    //    ORIGINAL 106 CUE LIST). Sibling to 106 nightmare: same D-root
    //    minor interval at t, but lifts to major within 0.3s. The
    //    minor F4 decays while F#4 arrives — audible "resolution"
    //    felt more than parsed. Pure sines; gain 0.05 (between stone's
    //    0.07 and first-snow's 0.04). Short-ish decay — offering is a
    //    quiet moment, not ceremonial.
    case 'offering': {
      // D4 fundamental held throughout
      makeOsc(ctx, dest, 'sine', 293, 0.05, 0.03, 1.8, t);
      // F4 (minor 3rd) — short, decays as F#4 arrives
      makeOsc(ctx, dest, 'sine', 349, 0.04, 0.03, 0.35, t);
      // F#4 (major 3rd) — arrives at +0.3s as the resolution
      makeOsc(ctx, dest, 'sine', 370, 0.045, 0.05, 1.5, t + 0.30);
      // A4 (perfect 5th) — also at +0.3s, completes major triad
      makeOsc(ctx, dest, 'sine', 440, 0.035, 0.05, 1.5, t + 0.30);
      break;
    }
  }
}

// ════════════════════════════════════════════════════════════
// Procedural background music — gentle medieval pentatonic
// ════════════════════════════════════════════════════════════

let musicScheduled = 0;
let musicEnabled = true;
let musicMasterGain = null;

function getMusicMaster() {
  if (!G.audioCtx) return null;
  if (!musicMasterGain || musicMasterGain.context !== G.audioCtx) {
    musicMasterGain = G.audioCtx.createGain();
    musicMasterGain.gain.setValueAtTime(musicEnabled ? 1 : 0, G.audioCtx.currentTime);
    musicMasterGain.connect(G.audioCtx.destination);
  }
  return musicMasterGain;
}

export function toggleMusic() {
  musicEnabled = !musicEnabled;
  const m = getMusicMaster();
  if (m && G.audioCtx) {
    const t = G.audioCtx.currentTime;
    m.gain.cancelScheduledValues(t);
    // 80ms ramp avoids click artifact while still feeling instant
    m.gain.linearRampToValueAtTime(musicEnabled ? 1 : 0, t + 0.08);
  }
  return musicEnabled;
}

// Season-specific scales for procedural music
const SEASON_SCALES = {
  // C major pentatonic — bright, hopeful
  spring: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],
  // G mixolydian pentatonic — warm, full
  summer: [196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00],
  // D minor pentatonic — melancholy, reflective
  autumn: [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46],
  // A natural minor — cold, sparse
  winter: [220.00, 246.94, 261.63, 329.63, 349.23, 440.00, 493.88],
};

// Loop 17 (render S3): music state — track position in scale + phrase to
// drive harmony decisions. Prior code picked random notes with no musical
// coherence; now we bias toward melodic steps, occasionally add a fifth
// below, and punctuate every ~8 notes with a root tonic — giving the
// ambient synth texture a phrase-like shape.
let _musicPhraseIdx = 0;
let _musicLastScaleIdx = 0;

export function tickMusic() {
  if (!musicEnabled || !G.audioCtx) return;
  const ctx = G.audioCtx;
  if (ctx.state === 'suspended') return;
  const now = ctx.currentTime;
  if (now < musicScheduled) return;

  const scale = SEASON_SCALES[G.season] || SEASON_SCALES.spring;
  // Melodic motion: step within ±2 of the previous note 70% of the time,
  // free jump 30%. Tonic (index 0) every 8 notes to close a phrase.
  let scaleIdx;
  if (_musicPhraseIdx % 8 === 0) {
    scaleIdx = 0;
  } else if (Math.random() < 0.7) {
    const step = Math.floor(Math.random() * 5) - 2; // -2..+2
    scaleIdx = Math.max(0, Math.min(scale.length - 1, _musicLastScaleIdx + step));
  } else {
    scaleIdx = Math.floor(Math.random() * scale.length);
  }
  _musicLastScaleIdx = scaleIdx;
  _musicPhraseIdx++;
  const freq = scale[scaleIdx];

  const tempoMult = { spring: 1.0, summer: 0.8, autumn: 1.1, winter: 1.4 }[G.season] || 1;
  const noteDur = (1.5 + Math.random() * 1.0) * tempoMult;
  const master = getMusicMaster() || ctx.destination;

  const playTone = (f, type, peak, dur) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.3);
    g.gain.linearRampToValueAtTime(peak * 0.5, now + dur - 0.3);
    g.gain.linearRampToValueAtTime(0, now + dur);
    o.start(now);
    o.stop(now + dur);
  };

  // Lead note
  playTone(freq, G.season === 'winter' ? 'triangle' : 'sine', 0.04, noteDur);

  // Harmony: perfect fifth below on ~30% of notes, slightly softer and
  // triangle-toned. Adds harmonic depth without doubling the loudness.
  if (Math.random() < 0.3 && freq > 200) {
    playTone(freq * (2 / 3), 'triangle', 0.022, noteDur * 0.9);
  }

  // Phrase-closing tonic gets an octave-up shimmer (summer only — warmer)
  if (_musicPhraseIdx % 8 === 1 && G.season === 'summer') {
    playTone(freq * 2, 'sine', 0.018, noteDur * 0.6);
  }

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
