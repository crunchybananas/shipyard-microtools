import Service from "@ember/service";

export type AmbientType = "ocean" | "forest" | "cave";
export type SoundType = "click" | "pickup" | "solve" | "gear" | "mirror";

export default class AudioEngineService extends Service {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: AudioBufferSourceNode | OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  initAudio(): void {
    if (this.ctx) return;

    try {
      this.ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3;
    } catch (e) {
      console.error("Failed to initialize audio context:", e);
    }
  }

  playAmbient(type: AmbientType = "ocean"): void {
    if (!this.ctx) this.initAudio();
    const ctx = this.ctx;
    const masterGain = this.masterGain;
    if (!ctx || !masterGain) return;

    this.stopAmbient();

    const now = ctx.currentTime;
    this.ambientGain = ctx.createGain();
    const ambientGain = this.ambientGain;
    ambientGain.connect(masterGain);
    ambientGain.gain.setValueAtTime(0, now);
    ambientGain.gain.linearRampToValueAtTime(0.15, now + 2);

    if (type === "ocean") {
      // Brown noise for ocean waves
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const newVal = (lastOut + 0.02 * white) / 1.02;
        data[i] = newVal;
        lastOut = newVal;
        data[i] = newVal * 3.5;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;

      source.connect(filter);
      filter.connect(ambientGain);
      source.start();
      this.ambientOsc = source;
    } else if (type === "forest") {
      // Wind through trees - filtered noise
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      source.connect(filter);
      filter.connect(ambientGain);
      source.start();
      this.ambientOsc = source;
    } else if (type === "cave") {
      // Deep resonant drone
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 55;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 200;

      osc.connect(filter);
      filter.connect(ambientGain);
      osc.start();
      this.ambientOsc = osc;
    }
  }

  stopAmbient(): void {
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
      } catch (_e) {
        // Already stopped
      }
      this.ambientOsc = null;
    }
  }

  playSound(type: SoundType): void {
    if (!this.ctx) this.initAudio();
    const ctx = this.ctx;
    const masterGain = this.masterGain;
    if (!ctx || !masterGain) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.connect(masterGain);

    if (type === "click") {
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "pickup") {
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "solve") {
      // Chord arpeggio
      [400, 500, 600, 800].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = freq;
        o.type = "triangle";
        g.gain.setValueAtTime(0, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
        o.connect(g);
        g.connect(masterGain);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.5);
      });
      return; // Early return since we don't use the main osc
    } else if (type === "gear") {
      // Mechanical click
      osc.type = "square";
      osc.frequency.value = 100;
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "mirror") {
      // Glass tone
      osc.type = "sine";
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  willDestroy(): void {
    super.willDestroy();
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
