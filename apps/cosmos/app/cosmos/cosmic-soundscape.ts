// Cosmic Soundscape Engine
// Generative ambient audio that responds to zoom level and camera position.
// Each scale level has its own sonic character, with smooth crossfades between them.

type ScaleLayer =
  | "universe"
  | "cluster"
  | "galaxy"
  | "sector"
  | "system"
  | "planet"
  | "atmosphere"
  | "surface"
  | "terrain";

interface LayerConfig {
  baseFreq: number;
  harmonics: number[];
  type: OscillatorType;
  filterFreq: number;
  filterQ: number;
  volume: number;
  lfoRate: number;
  lfoDepth: number;
  reverbMix: number;
  detune: number;
}

// Each scale level has a distinct sonic palette
const LAYER_CONFIGS: Record<ScaleLayer, LayerConfig> = {
  universe: {
    baseFreq: 32, // Sub-bass drone — the cosmic hum
    harmonics: [1, 2, 3, 5],
    type: "sine",
    filterFreq: 200,
    filterQ: 1,
    volume: 0.12,
    lfoRate: 0.03,
    lfoDepth: 5,
    reverbMix: 0.9,
    detune: -10,
  },
  cluster: {
    baseFreq: 55,
    harmonics: [1, 1.5, 2, 3, 4],
    type: "sine",
    filterFreq: 400,
    filterQ: 2,
    volume: 0.1,
    lfoRate: 0.05,
    lfoDepth: 8,
    reverbMix: 0.85,
    detune: 0,
  },
  galaxy: {
    baseFreq: 82.4, // E2 — spiral arm resonance
    harmonics: [1, 2, 3, 4, 5, 7],
    type: "triangle",
    filterFreq: 600,
    filterQ: 3,
    volume: 0.08,
    lfoRate: 0.08,
    lfoDepth: 12,
    reverbMix: 0.8,
    detune: 5,
  },
  sector: {
    baseFreq: 110, // A2
    harmonics: [1, 2, 3, 5],
    type: "triangle",
    filterFreq: 800,
    filterQ: 2,
    volume: 0.07,
    lfoRate: 0.1,
    lfoDepth: 10,
    reverbMix: 0.7,
    detune: 0,
  },
  system: {
    baseFreq: 146.8, // D3 — orbital mechanics
    harmonics: [1, 1.5, 2, 2.5, 3, 4],
    type: "sine",
    filterFreq: 1200,
    filterQ: 4,
    volume: 0.06,
    lfoRate: 0.15,
    lfoDepth: 15,
    reverbMix: 0.6,
    detune: 3,
  },
  planet: {
    baseFreq: 196, // G3
    harmonics: [1, 2, 3, 4, 6],
    type: "sine",
    filterFreq: 1500,
    filterQ: 3,
    volume: 0.06,
    lfoRate: 0.2,
    lfoDepth: 20,
    reverbMix: 0.55,
    detune: -5,
  },
  atmosphere: {
    baseFreq: 220, // A3 — wind and pressure
    harmonics: [1, 1.5, 2, 3],
    type: "sawtooth",
    filterFreq: 800,
    filterQ: 8,
    volume: 0.05,
    lfoRate: 0.4,
    lfoDepth: 30,
    reverbMix: 0.5,
    detune: 0,
  },
  surface: {
    baseFreq: 293.7, // D4 — geological rumble
    harmonics: [1, 2, 3, 5, 7],
    type: "triangle",
    filterFreq: 2000,
    filterQ: 2,
    volume: 0.05,
    lfoRate: 0.3,
    lfoDepth: 15,
    reverbMix: 0.4,
    detune: 7,
  },
  terrain: {
    baseFreq: 392, // G4 — close detail, wind in the grass
    harmonics: [1, 2, 3, 4],
    type: "sine",
    filterFreq: 3000,
    filterQ: 1.5,
    volume: 0.04,
    lfoRate: 0.5,
    lfoDepth: 8,
    reverbMix: 0.3,
    detune: -3,
  },
};

interface ActiveLayer {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  masterGain: GainNode;
}

// Map zoom ranges to scale layers
function zoomToLayer(zoom: number): ScaleLayer {
  if (zoom < 5) return "universe";
  if (zoom < 50) return "cluster";
  if (zoom < 500) return "galaxy";
  if (zoom < 5000) return "sector";
  if (zoom < 50000) return "system";
  if (zoom < 500000) return "planet";
  if (zoom < 5000000) return "atmosphere";
  if (zoom < 50000000) return "surface";
  return "terrain";
}

// Get crossfade amount (0-1) between current and next layer
function getLayerBlend(zoom: number): { current: ScaleLayer; next: ScaleLayer; blend: number } {
  const thresholds: [number, ScaleLayer][] = [
    [5, "universe"],
    [50, "cluster"],
    [500, "galaxy"],
    [5000, "sector"],
    [50000, "system"],
    [500000, "planet"],
    [5000000, "atmosphere"],
    [50000000, "surface"],
    [500000000, "terrain"],
  ];

  for (let i = 0; i < thresholds.length - 1; i++) {
    const [threshold, layer] = thresholds[i]!;
    const [nextThreshold, nextLayer] = thresholds[i + 1]!;

    if (zoom < nextThreshold) {
      // Crossfade in the upper 30% of each zone
      const logZoom = Math.log10(zoom);
      const logThreshold = Math.log10(threshold);
      const logNext = Math.log10(nextThreshold);
      const progress = (logZoom - logThreshold) / (logNext - logThreshold);
      const blend = Math.max(0, (progress - 0.7) / 0.3);

      return { current: layer, next: nextLayer, blend };
    }
  }

  return { current: "terrain", next: "terrain", blend: 0 };
}

export class CosmicSoundscape {
  private ctx: AudioContext | null = null;
  private layers = new Map<ScaleLayer, ActiveLayer>();
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  private _enabled = false;
  private _masterVolume = 0.3;
  private currentLayer: ScaleLayer = "universe";
  private animFrameId: number | null = null;

  get enabled(): boolean {
    return this._enabled;
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  async init(): Promise<boolean> {
    try {
      this.ctx = new AudioContext();

      // Master chain: layers → dry/wet split → compressor → destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._masterVolume;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;

      // Create impulse response for reverb (algorithmic)
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.createReverbIR(4.0, 0.8);

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.5;

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.7;

      // Routing
      this.masterGain.connect(this.dryGain);
      this.masterGain.connect(this.convolver);
      this.convolver.connect(this.reverbGain);
      this.reverbGain.connect(this.compressor);
      this.dryGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      return true;
    } catch {
      console.error("Web Audio API not available");
      return false;
    }
  }

  async start(): Promise<void> {
    if (!this.ctx) {
      const ok = await this.init();
      if (!ok) return;
    }

    if (this.ctx!.state === "suspended") {
      await this.ctx!.resume();
    }

    this._enabled = true;

    // Build initial layer
    this.activateLayer("universe");
  }

  stop(): void {
    this._enabled = false;

    // Fade out all layers
    for (const [, layer] of this.layers) {
      this.fadeOutLayer(layer, 1.0);
    }

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    setTimeout(() => {
      this.destroyAllLayers();
      if (this.ctx && this.ctx.state !== "closed") {
        this.ctx.suspend();
      }
    }, 1500);
  }

  destroy(): void {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
  }

  setVolume(volume: number): void {
    this._masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this._masterVolume,
        this.ctx.currentTime,
        0.1,
      );
    }
  }

  /**
   * Call each frame with current zoom level. Handles crossfades.
   */
  update(zoom: number, _cameraX: number, _cameraY: number): void {
    if (!this._enabled || !this.ctx) return;

    const { current, next, blend } = getLayerBlend(zoom);

    // Activate layers if needed
    if (!this.layers.has(current)) {
      this.activateLayer(current);
    }
    if (blend > 0 && !this.layers.has(next)) {
      this.activateLayer(next);
    }

    // Set volumes based on crossfade
    const currentLayer = this.layers.get(current);
    const nextLayer = this.layers.get(next);
    const cfg = LAYER_CONFIGS[current];
    const nextCfg = LAYER_CONFIGS[next];

    if (currentLayer) {
      const targetVol = cfg.volume * (1 - blend);
      currentLayer.masterGain.gain.setTargetAtTime(
        targetVol,
        this.ctx.currentTime,
        0.3,
      );
    }

    if (nextLayer && blend > 0) {
      const targetVol = nextCfg.volume * blend;
      nextLayer.masterGain.gain.setTargetAtTime(
        targetVol,
        this.ctx.currentTime,
        0.3,
      );
    }

    // Deactivate layers that are too far away
    for (const [name, layer] of this.layers) {
      if (name !== current && name !== next) {
        this.fadeOutLayer(layer, 2.0);
        // Clean up after fade
        setTimeout(() => {
          if (!this._enabled) return;
          const { current: c, next: n } = getLayerBlend(zoom);
          if (name !== c && name !== n) {
            this.destroyLayer(name);
          }
        }, 3000);
      }
    }

    // Reverb mix based on current layer's config
    if (this.reverbGain) {
      const reverbMix = cfg.reverbMix * (1 - blend) + nextCfg.reverbMix * blend;
      this.reverbGain.gain.setTargetAtTime(
        reverbMix * 0.5,
        this.ctx.currentTime,
        0.5,
      );
    }

    this.currentLayer = current;
  }

  // ─── Private: Layer Management ─────────────────────────────────────────

  private activateLayer(name: ScaleLayer): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.layers.has(name)) return;

    const cfg = LAYER_CONFIGS[name];
    const now = this.ctx.currentTime;

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cfg.filterFreq;
    filter.Q.value = cfg.filterQ;

    // LFO for filter modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = cfg.lfoRate;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = cfg.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    // Master gain for this layer
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0;

    // Create oscillators for each harmonic
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    for (const harmonic of cfg.harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = cfg.type;
      osc.frequency.value = cfg.baseFreq * harmonic;
      osc.detune.value = cfg.detune + (Math.random() - 0.5) * 5;

      const gain = this.ctx.createGain();
      // Higher harmonics are quieter
      gain.gain.value = 1 / (harmonic * harmonic) * 0.5;

      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);

      oscillators.push(osc);
      gains.push(gain);
    }

    // Connect: filter → layer gain → master
    filter.connect(masterGain);
    masterGain.connect(this.masterGain);

    // Fade in
    masterGain.gain.setTargetAtTime(cfg.volume, now, 1.0);

    this.layers.set(name, {
      oscillators,
      gains,
      filter,
      lfo,
      lfoGain,
      masterGain,
    });
  }

  private fadeOutLayer(layer: ActiveLayer, duration: number): void {
    if (!this.ctx) return;
    layer.masterGain.gain.setTargetAtTime(
      0,
      this.ctx.currentTime,
      duration / 3,
    );
  }

  private destroyLayer(name: ScaleLayer): void {
    const layer = this.layers.get(name);
    if (!layer) return;

    for (const osc of layer.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Already stopped
      }
    }
    for (const gain of layer.gains) {
      gain.disconnect();
    }
    try {
      layer.lfo.stop();
      layer.lfo.disconnect();
    } catch {
      // Already stopped
    }
    layer.lfoGain.disconnect();
    layer.filter.disconnect();
    layer.masterGain.disconnect();

    this.layers.delete(name);
  }

  private destroyAllLayers(): void {
    for (const name of [...this.layers.keys()]) {
      this.destroyLayer(name);
    }
  }

  // ─── Private: Reverb Impulse Response ──────────────────────────────────

  private createReverbIR(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with random noise
        data[i] =
          (Math.random() * 2 - 1) *
          Math.pow(1 - i / length, decay) *
          0.5;
      }
    }

    return buffer;
  }
}
