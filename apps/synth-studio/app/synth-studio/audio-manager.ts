import { Synthesizer } from "./synth";
import { EffectsChain } from "./effects";
import { DrumMachine } from "./drums";
import { Sequencer } from "./sequencer";
import { Visualizer } from "./visualizer";

// ── Presets ────────────────────────────────────────────────────

export const PRESETS: Record<string, Record<string, number | string>> = {
  bass: {
    waveform: "sawtooth", octave: -1, detune: 0,
    attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3,
    filterCutoff: 400, filterResonance: 5, filterEnvAmount: 2000,
  },
  lead: {
    waveform: "square", octave: 0, detune: 10,
    attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2,
    filterCutoff: 2000, filterResonance: 2, filterEnvAmount: 500,
  },
  pad: {
    waveform: "sine", octave: 0, detune: 5,
    attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0,
    filterCutoff: 1000, filterResonance: 1, filterEnvAmount: 0,
  },
  pluck: {
    waveform: "triangle", octave: 0, detune: 0,
    attack: 0.001, decay: 0.3, sustain: 0, release: 0.2,
    filterCutoff: 3000, filterResonance: 3, filterEnvAmount: 5000,
  },
  brass: {
    waveform: "sawtooth", octave: 0, detune: 15,
    attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.15,
    filterCutoff: 1500, filterResonance: 2, filterEnvAmount: 3000,
  },
  strings: {
    waveform: "sawtooth", octave: 0, detune: 8,
    attack: 0.3, decay: 0.1, sustain: 0.9, release: 0.5,
    filterCutoff: 2500, filterResonance: 1, filterEnvAmount: 0,
  },
};

// ── Key map ────────────────────────────────────────────────────

export const KEY_MAP: Record<string, string> = {
  a: "C3", w: "C#3", s: "D3", e: "D#3", d: "E3",
  f: "F3", t: "F#3", g: "G3", y: "G#3", h: "A3",
  u: "A#3", j: "B3", k: "C4", o: "C#4", l: "D4",
  p: "D#4", ";": "E4", "'": "F4",
};

// ── WAV encoding ───────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch]![i]!));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}

// ── Effect state snapshot (for WAV export) ─────────────────────

export interface EffectState {
  delayEnabled: boolean;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  reverbEnabled: boolean;
  reverbDecay: number;
  reverbMix: number;
  distortionEnabled: boolean;
  distortionAmount: number;
}

// ── AudioManager ───────────────────────────────────────────────

export class AudioManager {
  private ctx: AudioContext | null = null;
  private synth: Synthesizer | null = null;
  private effects: EffectsChain | null = null;
  private drums: DrumMachine | null = null;
  private sequencer: Sequencer | null = null;
  private visualizer: Visualizer | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  onStep: ((step: number) => void) | null = null;

  get isReady() { return this.initialized; }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    this.synth = new Synthesizer(this.ctx);
    this.effects = new EffectsChain(this.ctx);
    this.drums = new DrumMachine(this.ctx);
    this.sequencer = new Sequencer(this.ctx);
    this.visualizer = new Visualizer(this.ctx);

    this.synth.connect(this.effects.input);
    this.effects.connect(this.masterGain);
    this.drums.connect(this.masterGain);

    this.masterGain.connect(limiter);
    limiter.connect(this.visualizer.getInput());
    this.visualizer.getInput().connect(this.ctx.destination);

    this.sequencer.onSynthTrigger = (note, velocity) => {
      this.synth?.noteOn(note, velocity);
      setTimeout(() => this.synth?.noteOff(note), 150);
    };

    this.sequencer.onDrumTrigger = (drumType, velocity, time) => {
      this.drums?.play(drumType, velocity, time);
    };

    this.sequencer.onStep = (step) => {
      this.onStep?.(step);
    };

    this.initialized = true;
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume();
    }
  }

  initVisualizer(waveform: HTMLCanvasElement, spectrum: HTMLCanvasElement, adsr: HTMLCanvasElement) {
    this.visualizer?.init(waveform, spectrum, adsr);
  }

  // ── Notes ────────────────────────────────────────────────────

  playNote(note: string, velocity = 0.8) { this.synth?.noteOn(note, velocity); }
  stopNote(note: string) { this.synth?.noteOff(note); }

  // ── Synth params ─────────────────────────────────────────────

  setSynthParam(param: string, value: number | string) {
    this.synth?.setParam(param, value);
  }

  setMasterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  // ── Effects ──────────────────────────────────────────────────

  setDelayEnabled(v: boolean) { this.effects?.setDelayEnabled(v); }
  setDelayParams(time: number, feedback: number, mix: number) {
    this.effects?.setDelayParams(time, feedback, mix);
  }
  setReverbEnabled(v: boolean) { this.effects?.setReverbEnabled(v); }
  setReverbParams(decay: number, mix: number) { this.effects?.setReverbParams(decay, mix); }
  setDistortionEnabled(v: boolean) { this.effects?.setDistortionEnabled(v); }
  setDistortionAmount(v: number) { this.effects?.setDistortionAmount(v); }

  // ── Sequencer ────────────────────────────────────────────────

  toggleStep(trackId: string, step: number): boolean {
    return this.sequencer?.toggleStep(trackId, step) ?? false;
  }

  setTrackNote(trackId: string, note: string) { this.sequencer?.setTrackNote(trackId, note); }
  setBPM(v: number) { this.sequencer?.setBPM(v); }
  setSwing(v: number) { this.sequencer?.setSwing(v); }
  startSequencer() { this.sequencer?.start(); }

  stopSequencer() {
    this.sequencer?.stop();
    this.onStep?.(-1);
  }

  get isSequencerPlaying() { return this.sequencer?.isPlaying ?? false; }

  // ── Visualizer ───────────────────────────────────────────────

  setVizMode(mode: "waveform" | "spectrum") { this.visualizer?.setMode(mode); }
  drawADSR(a: number, d: number, s: number, r: number) { this.visualizer?.drawADSR(a, d, s, r); }
  getPeakLevel(): number { return this.visualizer?.getPeakLevel() ?? 0; }
  resizeCanvases() { this.visualizer?.resizeCanvases(); }

  // ── Presets ──────────────────────────────────────────────────

  loadPreset(name: string): Record<string, number | string> | null {
    const preset = PRESETS[name];
    if (!preset || !this.synth) return null;
    for (const [key, value] of Object.entries(preset)) {
      this.synth.setParam(key, value);
    }
    return preset;
  }

  // ── Recording ────────────────────────────────────────────────

  async startRecording(): Promise<boolean> {
    if (!this.ctx || !this.masterGain) return false;
    try {
      const dest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(dest);
      this.mediaRecorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "synth-studio-recording.webm";
        link.click();
        URL.revokeObjectURL(url);
      };

      this.mediaRecorder.start();
      return true;
    } catch (err) {
      console.error("Recording failed:", err);
      return false;
    }
  }

  stopRecording() { this.mediaRecorder?.stop(); }

  // ── WAV export ───────────────────────────────────────────────

  async exportWAV(effectState: EffectState): Promise<void> {
    if (!this.ctx || !this.sequencer || !this.synth || !this.drums) return;

    const duration = (60 / this.sequencer.bpm) * 4;
    const sampleRate = this.ctx.sampleRate;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    const offlineSynth = new Synthesizer(offlineCtx);
    const offlineDrums = new DrumMachine(offlineCtx);
    const offlineEffects = new EffectsChain(offlineCtx);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.gain.value = 0.7;

    Object.assign(offlineSynth.params, this.synth.params);
    offlineSynth.connect(offlineEffects.input);
    offlineEffects.connect(offlineMaster);
    offlineDrums.connect(offlineMaster);
    offlineMaster.connect(offlineCtx.destination);

    offlineEffects.setDelayEnabled(effectState.delayEnabled);
    offlineEffects.setDelayParams(effectState.delayTime, effectState.delayFeedback, effectState.delayMix);
    offlineEffects.setReverbEnabled(effectState.reverbEnabled);
    offlineEffects.setReverbParams(effectState.reverbDecay, effectState.reverbMix);
    offlineEffects.setDistortionEnabled(effectState.distortionEnabled);
    offlineEffects.setDistortionAmount(effectState.distortionAmount);

    const stepDuration = 60 / this.sequencer.bpm / 4;
    for (let step = 0; step < 64; step++) {
      const time = step * stepDuration;
      const patternStep = step % 16;
      for (const [trackId, track] of Object.entries(this.sequencer.tracks)) {
        if (track.steps[patternStep]) {
          if (trackId.startsWith("synth") && track.note) {
            offlineSynth.noteOn(track.note, track.velocity);
          } else {
            offlineDrums.play(trackId, track.velocity, time);
          }
        }
      }
    }

    const buffer = await offlineCtx.startRendering();
    const wav = audioBufferToWav(buffer);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "synth-studio-export.wav";
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Save project ─────────────────────────────────────────────

  getProjectState(effectState: EffectState): object | null {
    if (!this.synth || !this.sequencer) return null;
    return {
      synth: { ...this.synth.params },
      sequencer: this.sequencer.getState(),
      effects: effectState,
    };
  }
}
