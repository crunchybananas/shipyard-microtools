/**
 * The Fading Kingdom — Procedural Music Engine
 *
 * Generates music dynamically via Web Audio API.
 * No audio files — everything is synthesized.
 *
 * Architecture:
 *   AudioContext
 *     ├── masterGain
 *     │     ├── droneGain → droneOsc → droneFilter
 *     │     ├── melodyGain → [scheduled note oscillators]
 *     │     ├── ambientGain → [noise buffer]
 *     │     └── sfxGain → [transient oscillators]
 *     └── (optional reverb convolver)
 *
 * Music evolves with restoration progress:
 *   0.0: drone only, filter closed, ambient noise
 *   0.3: filter begins opening
 *   0.5: melody notes start appearing
 *   0.8: full melody, harmony hints
 *   1.0: bright, open, full sound
 */

import Service from "@ember/service";
import type { MusicParams } from "the-island/scenes/types";

// MIDI note to frequency
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export default class MusicEngineService extends Service {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private melodyGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;

  private currentParams: MusicParams | null = null;
  private melodyInterval: ReturnType<typeof setInterval> | null = null;
  private melodyIndex = 0;
  private initialized = false;

  // ============================================
  // LIFECYCLE
  // ============================================

  initAudio(): void {
    if (this.initialized) return;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      // Drone chain: osc → filter → gain → master
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = "lowpass";
      this.droneFilter.frequency.value = 200;
      this.droneFilter.Q.value = 1;

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0;
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      // Melody gain
      this.melodyGain = this.ctx.createGain();
      this.melodyGain.gain.value = 0;
      this.melodyGain.connect(this.masterGain);

      // Ambient gain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.masterGain);

      // SFX gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn("Music engine: Web Audio not available", e);
    }
  }

  // ============================================
  // SCENE MUSIC
  // ============================================

  playScene(params: MusicParams): void {
    if (!this.ctx || !this.initialized) return;

    // Resume context if suspended (autoplay policy)
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }

    // Stop current music
    this.stopDrone();
    this.stopMelody();
    this.stopAmbient();

    this.currentParams = params;

    // Start drone
    this.startDrone(params);

    // Start ambient
    if (params.ambientVolume > 0) {
      this.startAmbient(params);
    }
  }

  stopAll(): void {
    this.stopDrone();
    this.stopMelody();
    this.stopAmbient();
    this.currentParams = null;
  }

  // ============================================
  // RESTORATION PROGRESS UPDATE
  // ============================================

  updateRestoration(progress: number): void {
    if (!this.ctx || !this.currentParams) return;
    const params = this.currentParams;

    // Filter opens with restoration
    const cutoff =
      params.cursedFilterCutoff +
      (params.restoredFilterCutoff - params.cursedFilterCutoff) * progress;
    if (this.droneFilter) {
      this.droneFilter.frequency.setTargetAtTime(
        cutoff,
        this.ctx.currentTime,
        0.5,
      );
    }

    // Drone volume adjusts slightly
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(
        params.droneVolume * (0.8 + progress * 0.2),
        this.ctx.currentTime,
        0.3,
      );
    }

    // Melody appears at progress > 0.4
    if (progress > 0.4 && !this.melodyInterval && params.melodyPattern) {
      this.startMelody(params);
    }
    if (progress <= 0.3 && this.melodyInterval) {
      this.stopMelody();
    }

    // Melody volume scales with progress
    if (this.melodyGain) {
      const melodyVol = Math.max(0, (progress - 0.4) / 0.6) * 0.25;
      this.melodyGain.gain.setTargetAtTime(
        melodyVol,
        this.ctx.currentTime,
        0.3,
      );
    }

    // Ambient fades as restoration progresses (rain stops, wind calms)
    if (this.ambientGain) {
      const ambientVol = params.ambientVolume * (1 - progress * 0.8);
      this.ambientGain.gain.setTargetAtTime(
        ambientVol,
        this.ctx.currentTime,
        0.5,
      );
    }
  }

  // ============================================
  // DRONE
  // ============================================

  private startDrone(params: MusicParams): void {
    if (!this.ctx || !this.droneFilter) return;

    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = params.droneType;
    this.droneOsc.frequency.value = params.droneFreq;
    this.droneOsc.connect(this.droneFilter);
    this.droneOsc.start();

    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(
        params.droneVolume,
        this.ctx.currentTime,
        1.0,
      );
    }
  }

  private stopDrone(): void {
    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
      } catch {
        // already stopped
      }
      this.droneOsc.disconnect();
      this.droneOsc = null;
    }
    if (this.droneGain) {
      this.droneGain.gain.value = 0;
    }
  }

  // ============================================
  // MELODY
  // ============================================

  private startMelody(params: MusicParams): void {
    if (
      !this.ctx ||
      !this.melodyGain ||
      !params.melodyPattern ||
      !params.melodyRhythm
    )
      return;

    this.melodyIndex = 0;
    const beatDuration = 60 / params.tempo;

    this.melodyInterval = setInterval(() => {
      if (!this.ctx || !this.melodyGain || !params.melodyPattern) return;

      const pattern = params.melodyPattern;
      const rhythm = params.melodyRhythm ?? [1];
      const scaleIdx = pattern[this.melodyIndex % pattern.length] ?? 0;
      const scaleDegree = params.scale[scaleIdx % params.scale.length] ?? 0;
      const freq = midiToFreq(params.baseNote + scaleDegree);
      const duration =
        (rhythm[this.melodyIndex % rhythm.length] ?? 1) * beatDuration;

      this.playNote(freq, duration * 0.8, this.melodyGain);

      this.melodyIndex++;
    }, beatDuration * 1000);
  }

  private stopMelody(): void {
    if (this.melodyInterval) {
      clearInterval(this.melodyInterval);
      this.melodyInterval = null;
    }
    this.melodyIndex = 0;
  }

  private playNote(
    freq: number,
    duration: number,
    destination: GainNode,
  ): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    noteGain.gain.value = 0;
    noteGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.05);
    noteGain.gain.setTargetAtTime(0, this.ctx.currentTime + duration * 0.7, 0.1);

    osc.connect(noteGain);
    noteGain.connect(destination);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  // ============================================
  // AMBIENT NOISE
  // ============================================

  private startAmbient(params: MusicParams): void {
    if (!this.ctx || !this.ambientGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise based on type
    switch (params.ambientType) {
      case "rain":
        // Pink-ish noise (filtered white noise)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.5;
          // Simple low-pass
          if (i > 0) {
            data[i] = (data[i]! + (data[i - 1] ?? 0)) * 0.5;
          }
        }
        break;
      case "wind":
        // Brown noise (deeper)
        let lastVal = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastVal = (lastVal + 0.02 * white) / 1.02;
          data[i] = lastVal * 3.5;
        }
        break;
      case "water":
        // Gentle lapping
        for (let i = 0; i < bufferSize; i++) {
          const t = i / this.ctx.sampleRate;
          data[i] =
            Math.sin(t * 2.5) * 0.1 * (Math.random() * 0.3 + 0.7) +
            (Math.random() * 2 - 1) * 0.05;
        }
        break;
      case "fire":
        // Crackle
        for (let i = 0; i < bufferSize; i++) {
          data[i] =
            Math.random() < 0.02
              ? (Math.random() * 2 - 1) * 0.8
              : (Math.random() * 2 - 1) * 0.05;
        }
        break;
      case "silence":
      default:
        break;
    }

    this.ambientSource = this.ctx.createBufferSource();
    this.ambientSource.buffer = buffer;
    this.ambientSource.loop = true;
    this.ambientSource.connect(this.ambientGain);
    this.ambientSource.start();

    this.ambientGain.gain.setTargetAtTime(
      params.ambientVolume,
      this.ctx.currentTime,
      1.0,
    );
  }

  private stopAmbient(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // already stopped
      }
      this.ambientSource.disconnect();
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.gain.value = 0;
    }
  }

  // ============================================
  // SOUND EFFECTS
  // ============================================

  playPickup(): void {
    if (!this.ctx || !this.sfxGain) return;
    // Rising frequency sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playSolve(): void {
    if (!this.ctx || !this.sfxGain) return;
    // Triumphant chord arpeggio
    const notes = [60, 64, 67, 72, 76]; // C major spread
    notes.forEach((note, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToFreq(note);
      const startTime = this.ctx!.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
      gain.gain.setTargetAtTime(0, startTime + 0.4, 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(startTime);
      osc.stop(startTime + 1.0);
    });
  }

  playClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // ============================================
  // PUZZLE SOLVE CRESCENDO
  // ============================================

  playCrescendo(): void {
    if (!this.ctx || !this.currentParams) return;
    const params = this.currentParams;

    // Rising arpeggio through the scene's scale
    params.scale.forEach((interval, i) => {
      const freq = midiToFreq(params.baseNote + interval);
      const startTime = this.ctx!.currentTime + i * 0.15;

      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.08);
      gain.gain.setTargetAtTime(0.05, startTime + 0.3, 0.3);
      gain.gain.setTargetAtTime(0, startTime + 1.5, 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 2.0);
    });

    // Sustained chord at the end
    const chordTime =
      this.ctx.currentTime + params.scale.length * 0.15 + 0.1;
    [0, 4, 7].forEach((interval) => {
      const freq = midiToFreq(params.baseNote + interval);
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, chordTime);
      gain.gain.linearRampToValueAtTime(0.15, chordTime + 0.3);
      gain.gain.setTargetAtTime(0, chordTime + 1.5, 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(chordTime);
      osc.stop(chordTime + 3.0);
    });
  }

  // ============================================
  // CLEANUP
  // ============================================

  willDestroy(): void {
    this.stopAll();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
    super.willDestroy();
  }
}
