// ════════════════════════════════════════════════════════════
// Web Audio SFX — pure oscillator synthesis, no files
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
    case 'produce': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
      break;
    }
    case 'raid': {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(400, t + 0.3);
      osc.frequency.linearRampToValueAtTime(200, t + 0.6);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      osc.start(t); osc.stop(t + 0.6);
      break;
    }
    case 'mission': {
      osc.frequency.setValueAtTime(523, t);
      osc.frequency.setValueAtTime(659, t + 0.12);
      osc.frequency.setValueAtTime(784, t + 0.24);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
      break;
    }
    case 'click': {
      osc.frequency.setValueAtTime(1000, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.03);
      osc.start(t); osc.stop(t + 0.03);
      break;
    }
  }
}
