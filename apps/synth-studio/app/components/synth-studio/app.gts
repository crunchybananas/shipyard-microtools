import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import { fn } from "@ember/helper";
import { AudioManager, KEY_MAP, type EffectState } from "synth-studio/synth-studio/audio-manager";
import { PATTERN_SLOT_LABELS, PATTERN_SLOT_COUNT } from "synth-studio/synth-studio/sequencer";

// ── Helpers (strict-mode safe) ─────────────────────────────────

const eq = (a: unknown, b: unknown) => a === b;
const includes = (arr: string[], val: string) => arr.includes(val);
const lookupStep = (grid: Record<string, boolean[]>, trackId: string, idx: number) =>
  grid[trackId]?.[idx] ?? false;

// ── Data arrays for template rendering ─────────────────────────

interface PianoKeyDef {
  note: string;
  white: boolean;
  key: string;
  style: string;
}

const PIANO_KEYS: PianoKeyDef[] = (() => {
  const notes = [
    { note: "C3", white: true, key: "A" },
    { note: "C#3", white: false, key: "W" },
    { note: "D3", white: true, key: "S" },
    { note: "D#3", white: false, key: "E" },
    { note: "E3", white: true, key: "D" },
    { note: "F3", white: true, key: "F" },
    { note: "F#3", white: false, key: "T" },
    { note: "G3", white: true, key: "G" },
    { note: "G#3", white: false, key: "Y" },
    { note: "A3", white: true, key: "H" },
    { note: "A#3", white: false, key: "U" },
    { note: "B3", white: true, key: "J" },
    { note: "C4", white: true, key: "K" },
    { note: "C#4", white: false, key: "O" },
    { note: "D4", white: true, key: "L" },
    { note: "D#4", white: false, key: "P" },
    { note: "E4", white: true, key: ";" },
  ];
  const whiteCount = notes.filter(n => n.white).length;
  const w = 100 / whiteCount;
  let wi = 0;
  return notes.map(n => {
    if (n.white) {
      const style = `width:${w}%`;
      wi++;
      return { ...n, style };
    } else {
      const offset = (wi - 1) * w + w * 0.7;
      return { ...n, style: `left:${offset}%` };
    }
  });
})();

interface WaveformDef { value: string; label: string; title: string }
const WAVEFORMS: WaveformDef[] = [
  { value: "sine", label: "∿", title: "Sine" },
  { value: "square", label: "□", title: "Square" },
  { value: "sawtooth", label: "⊿", title: "Sawtooth" },
  { value: "triangle", label: "△", title: "Triangle" },
];

interface LfoTargetDef { value: string; label: string }
const LFO_TARGETS: LfoTargetDef[] = [
  { value: "none", label: "Off" },
  { value: "pitch", label: "Pitch" },
  { value: "filter", label: "Filter" },
];

interface VizModeDef { value: string; label: string }
const VIZ_MODES: VizModeDef[] = [
  { value: "waveform", label: "Waveform" },
  { value: "spectrum", label: "Spectrum" },
];

interface PresetDef { value: string; label: string }
const PRESET_OPTIONS: PresetDef[] = [
  { value: "bass", label: "Bass" },
  { value: "lead", label: "Lead" },
  { value: "pad", label: "Pad" },
  { value: "pluck", label: "Pluck" },
  { value: "brass", label: "Brass" },
  { value: "strings", label: "Strings" },
];

interface TrackDef { id: string; label: string; notes: string[] | null }
const TRACKS: TrackDef[] = [
  { id: "synth1", label: "Synth 1", notes: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"] },
  { id: "synth2", label: "Synth 2", notes: ["C2", "D2", "E2", "F2", "G2", "A2", "B2", "C3"] },
  { id: "kick", label: "Kick", notes: null },
  { id: "snare", label: "Snare", notes: null },
  { id: "hihat", label: "Hi-Hat", notes: null },
  { id: "clap", label: "Clap", notes: null },
];

const STEP_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

interface SlotView { idx: number; label: string }
const PATTERN_SLOTS: SlotView[] = PATTERN_SLOT_LABELS.map((label, idx) => ({ idx, label }));

// ── Component ──────────────────────────────────────────────────

export default class SynthStudioApp extends Component {
  private audio = new AudioManager();
  private activeComputerKeys = new Set<string>();
  private meterInterval: ReturnType<typeof setInterval> | null = null;

  // ── Tracked state ────────────────────────────────────────────

  @tracked waveform = "sine";
  @tracked octave = 0;
  @tracked detune = 0;
  @tracked filterCutoff = 5000;
  @tracked filterResonance = 1;
  @tracked filterEnvAmount = 0;
  @tracked attack = 0.01;
  @tracked decay = 0.1;
  @tracked sustain = 0.7;
  @tracked release = 0.3;
  @tracked lfoRate = 5;
  @tracked lfoDepth = 0;
  @tracked lfoTarget = "none";
  @tracked masterVolume = 0.7;

  @tracked delayEnabled = false;
  @tracked delayTime = 0.3;
  @tracked delayFeedback = 0.4;
  @tracked delayMix = 0.3;
  @tracked reverbEnabled = false;
  @tracked reverbDecay = 2;
  @tracked reverbMix = 0.3;
  @tracked distortionEnabled = false;
  @tracked distortionAmount = 20;

  @tracked bpm = 120;
  @tracked swing = 0;
  @tracked isPlaying = false;
  @tracked isRecording = false;
  @tracked vizMode = "waveform";

  @tracked pressedNotes: string[] = [];
  @tracked currentStep = -1;
  @tracked meterLevel = 0;

  @tracked stepGrid: Record<string, boolean[]> = {
    synth1: new Array(16).fill(false),
    synth2: new Array(16).fill(false),
    kick: new Array(16).fill(false),
    snare: new Array(16).fill(false),
    hihat: new Array(16).fill(false),
    clap: new Array(16).fill(false),
  };

  @tracked activeSlot = 0;
  @tracked filledSlots: boolean[] = new Array(PATTERN_SLOT_COUNT).fill(false);
  @tracked songChain: number[] = [];
  @tracked songMode = false;
  @tracked playingChainPos = 0;
  @tracked trackNotes: Record<string, string> = { synth1: "C4", synth2: "E3" };
  @tracked mutedTracks: Record<string, boolean> = {};
  @tracked soloedTracks: Record<string, boolean> = {};

  // ── Computed display values ──────────────────────────────────

  get octaveDisplay() { return String(this.octave); }
  get detuneDisplay() { return String(this.detune); }
  get cutoffDisplay() { return `${Math.round(this.filterCutoff)} Hz`; }
  get resonanceDisplay() { return this.filterResonance.toFixed(1); }
  get envAmtDisplay() { return String(Math.round(this.filterEnvAmount)); }
  get attackDisplay() { return `${Math.round(this.attack * 1000)}ms`; }
  get decayDisplay() { return `${Math.round(this.decay * 1000)}ms`; }
  get sustainDisplay() { return `${Math.round(this.sustain * 100)}%`; }
  get releaseDisplay() { return `${Math.round(this.release * 1000)}ms`; }
  get lfoRateDisplay() { return `${this.lfoRate.toFixed(1)} Hz`; }
  get lfoDepthDisplay() { return String(Math.round(this.lfoDepth)); }
  get volumeDisplay() { return `${Math.round(this.masterVolume * 100)}%`; }
  get meterWidth() { return `width:${this.meterLevel * 100}%`; }
  get playLabel() { return this.isPlaying ? "⏸" : "▶"; }
  get playClass() { return this.isPlaying ? "transport-btn playing" : "transport-btn"; }
  get recordClass() { return this.isRecording ? "transport-btn recording" : "transport-btn"; }
  get recordingIndicatorClass() { return this.isRecording ? "recording-indicator" : "recording-indicator hidden"; }

  get songModeClass() { return this.songMode ? "btn btn-toggle active" : "btn btn-toggle"; }
  get hasChain() { return this.songChain.length > 0; }
  get chainView() {
    return this.songChain.map((slotIdx, pos) => ({
      pos,
      slotIdx,
      label: PATTERN_SLOT_LABELS[slotIdx] ?? "?",
      cls:
        "chain-item" +
        (this.songMode && this.isPlaying && pos === this.playingChainPos
          ? " playing"
          : ""),
    }));
  }
  get slotsView() {
    return PATTERN_SLOTS.map((s) => {
      const isActive = s.idx === this.activeSlot;
      const filled = this.filledSlots[s.idx] ?? false;
      const isPlayingSlot =
        this.songMode &&
        this.isPlaying &&
        this.songChain[this.playingChainPos] === s.idx;
      return {
        idx: s.idx,
        label: s.label,
        filled,
        active: isActive,
        bars: filled ? this.signatureFor(s.idx) : null,
        cls:
          "pattern-slot" +
          (isActive ? " active" : "") +
          (filled ? " filled" : "") +
          (isPlayingSlot ? " playing" : ""),
      };
    });
  }

  private signatureFor(
    slotIdx: number,
  ): Array<{ x: number; y: number; h: number; color: string }> | null {
    const pat = this.audio.getPatternSlot(slotIdx);
    if (!pat) return null;
    // For each of 16 steps, pick the highest-priority track active on it.
    // Priority (color): kick > snare > clap > hihat > synth2 > synth1
    const priority: Array<[string, string]> = [
      ["kick", "#ff7b72"],
      ["snare", "#ffa657"],
      ["clap", "#d2a8ff"],
      ["hihat", "#79c0ff"],
      ["synth2", "#56d4dd"],
      ["synth1", "#7ee787"],
    ];
    const counts: number[] = new Array(16).fill(0);
    for (const track of Object.values(pat)) {
      track.steps.forEach((on, i) => {
        if (on) counts[i]!++;
      });
    }
    const maxCount = Math.max(1, ...counts);
    return counts.map((c, i) => {
      if (c === 0) return { x: i * 2, y: 12, h: 0, color: "transparent" };
      // Color: pick the first priority track that fires at this step
      let color = "#7ee787";
      for (const [trackId, col] of priority) {
        if (pat[trackId]?.steps[i]) {
          color = col;
          break;
        }
      }
      const h = Math.max(2, Math.round((c / maxCount) * 12));
      return { x: i * 2, y: 12 - h, h, color };
    });
  }

  get effectState(): EffectState {
    return {
      delayEnabled: this.delayEnabled,
      delayTime: this.delayTime,
      delayFeedback: this.delayFeedback,
      delayMix: this.delayMix,
      reverbEnabled: this.reverbEnabled,
      reverbDecay: this.reverbDecay,
      reverbMix: this.reverbMix,
      distortionEnabled: this.distortionEnabled,
      distortionAmount: this.distortionAmount,
    };
  }

  // ── Audio init (lazy, on first interaction) ──────────────────

  private async ensureAudio() {
    await this.audio.init();
    await this.audio.resume();
  }

  private async ensureInit() {
    await this.audio.init();
  }

  // ── Modifier: setup canvases + keyboard listener + meter ─────

  setupApp = modifier((element: HTMLElement) => {
    const waveCanvas = element.querySelector<HTMLCanvasElement>("#waveform-canvas");
    const specCanvas = element.querySelector<HTMLCanvasElement>("#spectrum-canvas");
    const adsrCanvas = element.querySelector<HTMLCanvasElement>("#adsr-canvas");

    const tryInitViz = () => {
      if (this.audio.isReady && waveCanvas && specCanvas && adsrCanvas) {
        this.audio.initVisualizer(waveCanvas, specCanvas, adsrCanvas);
        this.audio.drawADSR(this.attack, this.decay, this.sustain, this.release);
      }
    };

    const onKeyDown = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (this.activeComputerKeys.has(key)) return;
      if (KEY_MAP[key]) {
        e.preventDefault();
        await this.ensureAudio();
        tryInitViz();
        this.activeComputerKeys.add(key);
        this.pressNote(KEY_MAP[key]!);
      }
      if (key === "z") { this.octave = Math.max(-2, this.octave - 1); this.audio.setSynthParam("octave", this.octave); }
      if (key === "x") { this.octave = Math.min(2, this.octave + 1); this.audio.setSynthParam("octave", this.octave); }
      if (key === " ") { e.preventDefault(); this.togglePlayback(); }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key]) { this.activeComputerKeys.delete(key); this.releaseNote(KEY_MAP[key]!); }
    };

    const onResize = () => {
      this.audio.resizeCanvases();
      this.audio.drawADSR(this.attack, this.decay, this.sustain, this.release);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);

    const onFirstInteraction = async () => { await this.ensureAudio(); tryInitViz(); };
    element.addEventListener("click", onFirstInteraction, { once: true });

    this.meterInterval = setInterval(() => { this.meterLevel = this.audio.getPeakLevel(); }, 50);
    this.audio.onStep = (step) => { this.currentStep = step; };
    this.audio.onPatternSwitch = (slot) => {
      this.activeSlot = slot;
      this.playingChainPos = this.audio.getSongChainPos();
      this.syncGridFromAudio();
    };

    // Eager-init audio context (not resumed — that still waits for gesture).
    // This ensures track-note edits made before first click reach the sequencer.
    void this.audio.init().then(() => {
      // Push initial UI note state into the sequencer
      for (const [trackId, note] of Object.entries(this.trackNotes)) {
        this.audio.setTrackNote(trackId, note);
      }
      tryInitViz();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      if (this.meterInterval) clearInterval(this.meterInterval);
    };
  });

  // ── Note playing ─────────────────────────────────────────────

  private pressNote(note: string) {
    if (!this.pressedNotes.includes(note)) this.pressedNotes = [...this.pressedNotes, note];
    this.audio.playNote(note);
  }

  private releaseNote(note: string) {
    this.pressedNotes = this.pressedNotes.filter(n => n !== note);
    this.audio.stopNote(note);
  }

  onPianoDown = async (note: string, e: Event) => { e.preventDefault(); await this.ensureAudio(); this.pressNote(note); };
  onPianoUp = (note: string) => { this.releaseNote(note); };
  onPianoLeave = (note: string) => { if (this.pressedNotes.includes(note)) this.releaseNote(note); };

  // ── Oscillator ───────────────────────────────────────────────

  selectWaveform = (value: string) => { this.waveform = value; this.audio.setSynthParam("waveform", value); };
  onOctaveChange = (e: Event) => { this.octave = parseInt((e.target as HTMLInputElement).value); this.audio.setSynthParam("octave", this.octave); };
  onDetuneChange = (e: Event) => { this.detune = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("detune", this.detune); };

  // ── Filter ───────────────────────────────────────────────────

  onCutoffChange = (e: Event) => { this.filterCutoff = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("filterCutoff", this.filterCutoff); };
  onResonanceChange = (e: Event) => { this.filterResonance = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("filterResonance", this.filterResonance); };
  onEnvAmtChange = (e: Event) => { this.filterEnvAmount = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("filterEnvAmount", this.filterEnvAmount); };

  // ── ADSR ─────────────────────────────────────────────────────

  private updateADSR() { this.audio.drawADSR(this.attack, this.decay, this.sustain, this.release); }
  onAttackChange = (e: Event) => { this.attack = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("attack", this.attack); this.updateADSR(); };
  onDecayChange = (e: Event) => { this.decay = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("decay", this.decay); this.updateADSR(); };
  onSustainChange = (e: Event) => { this.sustain = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("sustain", this.sustain); this.updateADSR(); };
  onReleaseChange = (e: Event) => { this.release = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("release", this.release); this.updateADSR(); };

  // ── Effects ──────────────────────────────────────────────────

  onDelayToggle = (e: Event) => { this.delayEnabled = (e.target as HTMLInputElement).checked; this.audio.setDelayEnabled(this.delayEnabled); };
  onDelayTimeChange = (e: Event) => { this.delayTime = parseFloat((e.target as HTMLInputElement).value); this.audio.setDelayParams(this.delayTime, this.delayFeedback, this.delayMix); };
  onDelayFeedbackChange = (e: Event) => { this.delayFeedback = parseFloat((e.target as HTMLInputElement).value); this.audio.setDelayParams(this.delayTime, this.delayFeedback, this.delayMix); };
  onDelayMixChange = (e: Event) => { this.delayMix = parseFloat((e.target as HTMLInputElement).value); this.audio.setDelayParams(this.delayTime, this.delayFeedback, this.delayMix); };
  onReverbToggle = (e: Event) => { this.reverbEnabled = (e.target as HTMLInputElement).checked; this.audio.setReverbEnabled(this.reverbEnabled); };
  onReverbDecayChange = (e: Event) => { this.reverbDecay = parseFloat((e.target as HTMLInputElement).value); this.audio.setReverbParams(this.reverbDecay, this.reverbMix); };
  onReverbMixChange = (e: Event) => { this.reverbMix = parseFloat((e.target as HTMLInputElement).value); this.audio.setReverbParams(this.reverbDecay, this.reverbMix); };
  onDistortionToggle = (e: Event) => { this.distortionEnabled = (e.target as HTMLInputElement).checked; this.audio.setDistortionEnabled(this.distortionEnabled); };
  onDistortionAmountChange = (e: Event) => { this.distortionAmount = parseFloat((e.target as HTMLInputElement).value); this.audio.setDistortionAmount(this.distortionAmount); };

  // ── LFO ──────────────────────────────────────────────────────

  onLfoRateChange = (e: Event) => { this.lfoRate = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("lfoRate", this.lfoRate); };
  onLfoDepthChange = (e: Event) => { this.lfoDepth = parseFloat((e.target as HTMLInputElement).value); this.audio.setSynthParam("lfoDepth", this.lfoDepth); };
  selectLfoTarget = (value: string) => { this.lfoTarget = value; this.audio.setSynthParam("lfoTarget", value); };

  // ── Master / Viz ─────────────────────────────────────────────

  onVolumeChange = (e: Event) => { this.masterVolume = parseFloat((e.target as HTMLInputElement).value); this.audio.setMasterVolume(this.masterVolume); };
  selectVizMode = (value: string) => { this.vizMode = value; this.audio.setVizMode(value as "waveform" | "spectrum"); };

  // ── Preset ───────────────────────────────────────────────────

  onPresetChange = (e: Event) => {
    const name = (e.target as HTMLSelectElement).value;
    if (!name) return;
    const preset = this.audio.loadPreset(name);
    if (!preset) return;
    if (preset.waveform !== undefined) this.waveform = String(preset.waveform);
    if (preset.octave !== undefined) this.octave = Number(preset.octave);
    if (preset.detune !== undefined) this.detune = Number(preset.detune);
    if (preset.attack !== undefined) this.attack = Number(preset.attack);
    if (preset.decay !== undefined) this.decay = Number(preset.decay);
    if (preset.sustain !== undefined) this.sustain = Number(preset.sustain);
    if (preset.release !== undefined) this.release = Number(preset.release);
    if (preset.filterCutoff !== undefined) this.filterCutoff = Number(preset.filterCutoff);
    if (preset.filterResonance !== undefined) this.filterResonance = Number(preset.filterResonance);
    if (preset.filterEnvAmount !== undefined) this.filterEnvAmount = Number(preset.filterEnvAmount);
    this.updateADSR();
  };

  // ── Sequencer ────────────────────────────────────────────────

  onBpmChange = (e: Event) => { this.bpm = parseInt((e.target as HTMLInputElement).value, 10); this.audio.setBPM(this.bpm); };
  onSwingChange = (e: Event) => { this.swing = parseFloat((e.target as HTMLInputElement).value); this.audio.setSwing(this.swing); };

  togglePlayback = () => {
    if (this.isPlaying) { this.audio.stopSequencer(); this.isPlaying = false; this.currentStep = -1; }
    else { this.audio.startSequencer(); this.isPlaying = true; }
  };

  stopPlayback = () => { this.audio.stopSequencer(); this.isPlaying = false; this.currentStep = -1; };

  toggleRecording = async () => {
    if (this.isRecording) { this.audio.stopRecording(); this.isRecording = false; }
    else { const ok = await this.audio.startRecording(); if (ok) this.isRecording = true; }
  };

  onStepClick = (trackId: string, stepIdx: number) => {
    const isActive = this.audio.toggleStep(trackId, stepIdx);
    const track = [...(this.stepGrid[trackId] ?? [])];
    track[stepIdx] = isActive;
    this.stepGrid = { ...this.stepGrid, [trackId]: track };
  };

  onTrackNoteChange = (trackId: string, e: Event) => {
    const v = (e.target as HTMLSelectElement).value;
    this.audio.setTrackNote(trackId, v);
    this.trackNotes = { ...this.trackNotes, [trackId]: v };
  };

  // ── Pattern bank + song chain ────────────────────────────────

  private syncGridFromAudio() {
    const tracks = this.audio.getCurrentTracks();
    if (!tracks) return;
    const grid: Record<string, boolean[]> = {};
    const notes: Record<string, string> = { ...this.trackNotes };
    for (const [trackId, t] of Object.entries(tracks)) {
      grid[trackId] = [...t.steps];
      if (trackId === "synth1" || trackId === "synth2") {
        notes[trackId] = t.note ?? notes[trackId] ?? "C4";
      }
    }
    this.stepGrid = grid;
    this.trackNotes = notes;
  }

  get tracksView() {
    return TRACKS.map((t) => ({
      id: t.id,
      label: t.label,
      notes: t.notes
        ? t.notes.map((n) => ({
            value: n,
            selected: this.trackNotes[t.id] === n,
          }))
        : null,
      muteCls:
        "track-btn track-btn-mute" + (this.mutedTracks[t.id] ? " active" : ""),
      soloCls:
        "track-btn track-btn-solo" + (this.soloedTracks[t.id] ? " active" : ""),
    }));
  }

  toggleMute = (trackId: string) => {
    const next = !this.mutedTracks[trackId];
    this.mutedTracks = { ...this.mutedTracks, [trackId]: next };
    void this.ensureInit().then(() => {
      this.audio.setTrackMuted(trackId, next);
    });
  };

  toggleSolo = (trackId: string) => {
    const next = !this.soloedTracks[trackId];
    this.soloedTracks = { ...this.soloedTracks, [trackId]: next };
    void this.ensureInit().then(() => {
      this.audio.setTrackSolo(trackId, next);
    });
  };

  private refreshFilledSlots() {
    const filled = new Array(PATTERN_SLOT_COUNT).fill(false);
    for (let i = 0; i < PATTERN_SLOT_COUNT; i++) {
      filled[i] = this.audio.getPatternSlot(i) !== null;
    }
    this.filledSlots = filled;
  }

  selectSlot = (slot: number) => {
    this.activeSlot = slot;
    void this.ensureInit().then(() => {
      if (this.audio.getPatternSlot(slot)) {
        this.audio.loadPatternSlot(slot);
        this.syncGridFromAudio();
      }
    });
  };

  saveSlot = () => {
    void this.ensureInit().then(() => {
      // Flush current UI note selections to sequencer so the snapshot captures them
      for (const [trackId, note] of Object.entries(this.trackNotes)) {
        this.audio.setTrackNote(trackId, note);
      }
      this.audio.savePatternSlot(this.activeSlot);
      this.refreshFilledSlots();
    });
  };

  clearSlot = () => {
    void this.ensureInit().then(() => {
      this.audio.clearPatternSlot(this.activeSlot);
      this.refreshFilledSlots();
    });
  };

  duplicateSlot = () => {
    void this.ensureInit().then(() => {
      let target = -1;
      for (let i = 0; i < PATTERN_SLOT_COUNT; i++) {
        if (!this.audio.getPatternSlot(i)) {
          target = i;
          break;
        }
      }
      if (target < 0) return;
      this.activeSlot = target;
      this.audio.savePatternSlot(target);
      this.refreshFilledSlots();
    });
  };

  addToChain = () => {
    if (!this.filledSlots[this.activeSlot]) return;
    this.songChain = [...this.songChain, this.activeSlot];
    this.audio.setSongChain(this.songChain);
  };

  removeFromChain = (pos: number) => {
    this.songChain = this.songChain.filter((_, i) => i !== pos);
    this.audio.setSongChain(this.songChain);
  };

  moveChainItem = (pos: number, delta: number) => {
    const target = pos + delta;
    if (target < 0 || target >= this.songChain.length) return;
    const next = [...this.songChain];
    const [item] = next.splice(pos, 1);
    if (item === undefined) return;
    next.splice(target, 0, item);
    this.songChain = next;
    this.audio.setSongChain(this.songChain);
  };

  clearChain = () => {
    this.songChain = [];
    this.audio.setSongChain([]);
  };

  toggleSongMode = () => {
    this.songMode = !this.songMode;
    this.audio.setSongMode(this.songMode);
    if (this.songMode && this.songChain.length > 0) {
      this.syncGridFromAudio();
      this.activeSlot = this.songChain[0] ?? 0;
    }
  };

  exportMidi = async () => {
    await this.ensureInit();
    this.audio.exportMidi("synth-studio.mid");
  };

  importMidi = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mid,.midi,audio/midi,audio/x-midi";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await this.ensureInit();
      const buffer = await file.arrayBuffer();
      const ok = this.audio.importMidi(new Uint8Array(buffer));
      if (ok) {
        const bpm = this.audio.getBpm();
        if (bpm) this.bpm = bpm;
        this.syncGridFromAudio();
        this.refreshFilledSlots();
      }
    };
    input.click();
  };

  // ── Header actions ───────────────────────────────────────────

  saveProject = async () => {
    await this.ensureInit();
    const project = this.audio.getProjectState(this.effectState);
    if (!project) return;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "synth-studio-project.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  loadProject = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await this.ensureInit();
        const loaded = this.audio.loadProjectState(data);
        if (loaded) this.applyEffectState(loaded);
        // Hydrate reactive UI state
        if (data?.sequencer) {
          if (typeof data.sequencer.bpm === "number") this.bpm = data.sequencer.bpm;
          if (typeof data.sequencer.swing === "number") this.swing = data.sequencer.swing;
        }
        this.syncGridFromAudio();
        this.refreshFilledSlots();
        this.songChain = [...(data?.bank?.songChain ?? [])];
        this.songMode = !!data?.bank?.songMode;
        if (typeof data?.bank?.activeSlot === "number") {
          this.activeSlot = data.bank.activeSlot;
        }
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    };
    input.click();
  };

  private applyEffectState(e: EffectState) {
    this.delayEnabled = e.delayEnabled;
    this.delayTime = e.delayTime;
    this.delayFeedback = e.delayFeedback;
    this.delayMix = e.delayMix;
    this.reverbEnabled = e.reverbEnabled;
    this.reverbDecay = e.reverbDecay;
    this.reverbMix = e.reverbMix;
    this.distortionEnabled = e.distortionEnabled;
    this.distortionAmount = e.distortionAmount;
  }

  exportWav = () => { this.audio.exportWAV(this.effectState); };

  <template>
    <div class="app" {{this.setupApp}}>
      <header class="header">
        <h1>SYNTH STUDIO</h1>
        <div class="header-controls">
          <select {{on "change" this.onPresetChange}}>
            <option value="">-- Presets --</option>
            {{#each PRESET_OPTIONS as |p|}}
              <option value={{p.value}}>{{p.label}}</option>
            {{/each}}
          </select>
          <button class="btn" type="button" {{on "click" this.saveProject}}>Save</button>
          <button class="btn" type="button" {{on "click" this.loadProject}}>Load</button>
          <button class="btn" type="button" {{on "click" this.importMidi}}>Import MIDI</button>
          <button class="btn" type="button" {{on "click" this.exportMidi}}>Export MIDI</button>
          <button class="btn btn-primary" type="button" {{on "click" this.exportWav}}>Export WAV</button>
        </div>
      </header>

      <main class="main-content">
        <div class="top-row">
          <section class="panel oscillator-panel">
            <h2>OSCILLATOR</h2>
            <div class="waveform-selector">
              {{#each WAVEFORMS as |wf|}}
                <button
                  class="wave-btn {{if (eq wf.value this.waveform) 'active'}}"
                  title={{wf.title}}
                  type="button"
                  {{on "click" (fn this.selectWaveform wf.value)}}
                >{{wf.label}}</button>
              {{/each}}
            </div>
            <div class="control-group">
              <label>Octave</label>
              <input type="range" min="-2" max="2" value="0" step="1" {{on "input" this.onOctaveChange}} />
              <span class="value">{{this.octaveDisplay}}</span>
            </div>
            <div class="control-group">
              <label>Detune</label>
              <input type="range" min="-50" max="50" value="0" {{on "input" this.onDetuneChange}} />
              <span class="value">{{this.detuneDisplay}}</span>
            </div>
          </section>

          <section class="panel filter-panel">
            <h2>FILTER</h2>
            <div class="control-group">
              <label>Cutoff</label>
              <input type="range" min="20" max="20000" value="5000" class="log-slider" {{on "input" this.onCutoffChange}} />
              <span class="value">{{this.cutoffDisplay}}</span>
            </div>
            <div class="control-group">
              <label>Resonance</label>
              <input type="range" min="0" max="30" value="1" step="0.1" {{on "input" this.onResonanceChange}} />
              <span class="value">{{this.resonanceDisplay}}</span>
            </div>
            <div class="control-group">
              <label>Env Amt</label>
              <input type="range" min="0" max="10000" value="0" {{on "input" this.onEnvAmtChange}} />
              <span class="value">{{this.envAmtDisplay}}</span>
            </div>
          </section>

          <section class="panel visualization-panel">
            <h2>VISUALIZATION</h2>
            <div class="viz-container">
              <canvas id="waveform-canvas" width="300" height="80"></canvas>
              <canvas id="spectrum-canvas" width="300" height="80"></canvas>
            </div>
            <div class="viz-toggle">
              {{#each VIZ_MODES as |vm|}}
                <button
                  class="viz-btn {{if (eq vm.value this.vizMode) 'active'}}"
                  type="button"
                  {{on "click" (fn this.selectVizMode vm.value)}}
                >{{vm.label}}</button>
              {{/each}}
            </div>
          </section>
        </div>

        <div class="middle-row">
          <section class="panel envelope-panel">
            <h2>ENVELOPE</h2>
            <div class="adsr-visual">
              <canvas id="adsr-canvas" width="180" height="60"></canvas>
            </div>
            <div class="adsr-controls">
              <div class="adsr-knob">
                <input type="range" min="0.001" max="2" value="0.01" step="0.001" data-orient="vertical" {{on "input" this.onAttackChange}} />
                <label>A</label>
                <span class="value">{{this.attackDisplay}}</span>
              </div>
              <div class="adsr-knob">
                <input type="range" min="0.001" max="2" value="0.1" step="0.001" data-orient="vertical" {{on "input" this.onDecayChange}} />
                <label>D</label>
                <span class="value">{{this.decayDisplay}}</span>
              </div>
              <div class="adsr-knob">
                <input type="range" min="0" max="1" value="0.7" step="0.01" data-orient="vertical" {{on "input" this.onSustainChange}} />
                <label>S</label>
                <span class="value">{{this.sustainDisplay}}</span>
              </div>
              <div class="adsr-knob">
                <input type="range" min="0.001" max="3" value="0.3" step="0.001" data-orient="vertical" {{on "input" this.onReleaseChange}} />
                <label>R</label>
                <span class="value">{{this.releaseDisplay}}</span>
              </div>
            </div>
          </section>

          <section class="panel effects-panel">
            <h2>EFFECTS</h2>
            <div class="effect-row">
              <div class="effect-toggle">
                <input type="checkbox" id="delay-enabled" {{on "change" this.onDelayToggle}} />
                <label for="delay-enabled">Delay</label>
              </div>
              <div class="effect-controls">
                <div class="mini-control">
                  <input type="range" min="0.05" max="1" value="0.3" step="0.01" {{on "input" this.onDelayTimeChange}} />
                  <span>Time</span>
                </div>
                <div class="mini-control">
                  <input type="range" min="0" max="0.9" value="0.4" step="0.01" {{on "input" this.onDelayFeedbackChange}} />
                  <span>Feedback</span>
                </div>
                <div class="mini-control">
                  <input type="range" min="0" max="1" value="0.3" step="0.01" {{on "input" this.onDelayMixChange}} />
                  <span>Mix</span>
                </div>
              </div>
            </div>
            <div class="effect-row">
              <div class="effect-toggle">
                <input type="checkbox" id="reverb-enabled" {{on "change" this.onReverbToggle}} />
                <label for="reverb-enabled">Reverb</label>
              </div>
              <div class="effect-controls">
                <div class="mini-control">
                  <input type="range" min="0.1" max="5" value="2" step="0.1" {{on "input" this.onReverbDecayChange}} />
                  <span>Decay</span>
                </div>
                <div class="mini-control">
                  <input type="range" min="0" max="1" value="0.3" step="0.01" {{on "input" this.onReverbMixChange}} />
                  <span>Mix</span>
                </div>
              </div>
            </div>
            <div class="effect-row">
              <div class="effect-toggle">
                <input type="checkbox" id="distortion-enabled" {{on "change" this.onDistortionToggle}} />
                <label for="distortion-enabled">Distortion</label>
              </div>
              <div class="effect-controls">
                <div class="mini-control">
                  <input type="range" min="0" max="100" value="20" {{on "input" this.onDistortionAmountChange}} />
                  <span>Amount</span>
                </div>
              </div>
            </div>
          </section>

          <section class="panel lfo-panel">
            <h2>LFO</h2>
            <div class="control-group">
              <label>Rate</label>
              <input type="range" min="0.1" max="20" value="5" step="0.1" {{on "input" this.onLfoRateChange}} />
              <span class="value">{{this.lfoRateDisplay}}</span>
            </div>
            <div class="control-group">
              <label>Depth</label>
              <input type="range" min="0" max="100" value="0" {{on "input" this.onLfoDepthChange}} />
              <span class="value">{{this.lfoDepthDisplay}}</span>
            </div>
            <div class="lfo-target">
              {{#each LFO_TARGETS as |lt|}}
                <button
                  class="lfo-target-btn {{if (eq lt.value this.lfoTarget) 'active'}}"
                  type="button"
                  {{on "click" (fn this.selectLfoTarget lt.value)}}
                >{{lt.label}}</button>
              {{/each}}
            </div>
          </section>

          <section class="panel master-panel">
            <h2>MASTER</h2>
            <div class="control-group">
              <label>Volume</label>
              <input type="range" min="0" max="1" value="0.7" step="0.01" {{on "input" this.onVolumeChange}} />
              <span class="value">{{this.volumeDisplay}}</span>
            </div>
            <div class="level-meter">
              <div class="meter-bar" style={{this.meterWidth}}></div>
            </div>
          </section>
        </div>

        <section class="keyboard-section">
          <h2>KEYBOARD
            <span class="keyboard-hint">(Use computer keys A-L or click)</span></h2>
          <div class="keyboard">
            {{#each PIANO_KEYS as |pk|}}
              <div
                class="{{if pk.white 'white-key' 'black-key'}} {{if (includes this.pressedNotes pk.note) 'active'}}"
                style={{pk.style}}
                role="button"
                {{on "mousedown" (fn this.onPianoDown pk.note)}}
                {{on "mouseup" (fn this.onPianoUp pk.note)}}
                {{on "mouseleave" (fn this.onPianoLeave pk.note)}}
                {{on "touchstart" (fn this.onPianoDown pk.note)}}
                {{on "touchend" (fn this.onPianoUp pk.note)}}
              >
                {{#if pk.white}}
                  <span class="note-label">{{pk.note}}</span>
                {{/if}}
                <span class="key-hint">{{pk.key}}</span>
              </div>
            {{/each}}
          </div>
        </section>

        <section class="sequencer-section">
          <div class="sequencer-header">
            <h2>SEQUENCER</h2>
            <div class="sequencer-controls">
              <div class="bpm-control">
                <label>BPM</label>
                <input type="number" value="120" min="40" max="240" {{on "change" this.onBpmChange}} />
              </div>
              <div class="swing-control">
                <label>Swing</label>
                <input type="range" min="0" max="0.5" value="0" step="0.01" {{on "input" this.onSwingChange}} />
              </div>
              <div class="transport">
                <button class={{this.playClass}} title="Play" type="button" {{on "click" this.togglePlayback}}>{{this.playLabel}}</button>
                <button class="transport-btn" title="Stop" type="button" {{on "click" this.stopPlayback}}>⏹</button>
                <button class={{this.recordClass}} title="Record" type="button" {{on "click" this.toggleRecording}}>⏺</button>
              </div>
            </div>
          </div>

          <div class="pattern-bank">
            <div class="pattern-bank-row">
              <span class="bank-label">Pattern</span>
              <div class="pattern-slots">
                {{#each this.slotsView as |slot|}}
                  <button
                    class={{slot.cls}}
                    type="button"
                    title="Click to load slot"
                    {{on "click" (fn this.selectSlot slot.idx)}}
                  >
                    <span class="slot-label">{{slot.label}}</span>
                    {{#if slot.bars}}
                      <svg class="slot-spark" viewBox="0 0 32 12" preserveAspectRatio="none">
                        {{#each slot.bars as |bar|}}
                          <rect x={{bar.x}} y={{bar.y}} width="1.4" height={{bar.h}} fill={{bar.color}} rx="0.3" />
                        {{/each}}
                      </svg>
                    {{/if}}
                  </button>
                {{/each}}
              </div>
              <button class="btn btn-small" type="button" title="Save current grid to active slot" {{on "click" this.saveSlot}}>Save</button>
              <button class="btn btn-small" type="button" title="Duplicate current grid to next empty slot" {{on "click" this.duplicateSlot}}>Duplicate</button>
              <button class="btn btn-small" type="button" title="Clear active slot" {{on "click" this.clearSlot}}>Clear</button>
            </div>
            <div class="pattern-bank-row">
              <span class="bank-label">Song</span>
              <div class="song-chain">
                {{#each this.chainView as |entry|}}
                  <div class={{entry.cls}}>
                    <button type="button" class="chain-nudge" title="Move left" {{on "click" (fn this.moveChainItem entry.pos -1)}}>◀</button>
                    <button type="button" class="chain-label" title="Remove" {{on "click" (fn this.removeFromChain entry.pos)}}>{{entry.label}}</button>
                    <button type="button" class="chain-nudge" title="Move right" {{on "click" (fn this.moveChainItem entry.pos 1)}}>▶</button>
                  </div>
                {{/each}}
                {{#unless this.hasChain}}
                  <span class="chain-empty">Empty — select a saved slot and press +</span>
                {{/unless}}
              </div>
              <button class="btn btn-small" type="button" {{on "click" this.addToChain}}>+</button>
              <button class="btn btn-small" type="button" {{on "click" this.clearChain}}>Clear</button>
              <button class={{this.songModeClass}} type="button" {{on "click" this.toggleSongMode}}>Song Mode</button>
            </div>
          </div>

          <div class="sequencer-grid">
            {{#each this.tracksView as |track|}}
              <div class="seq-track">
                <div class="track-label">
                  {{#if track.notes}}
                    <span>{{track.label}}</span>
                    <select class="track-note" {{on "change" (fn this.onTrackNoteChange track.id)}}>
                      {{#each track.notes as |n|}}
                        <option value={{n.value}} selected={{n.selected}}>{{n.value}}</option>
                      {{/each}}
                    </select>
                  {{else}}
                    <span>{{track.label}}</span>
                  {{/if}}
                  <div class="track-ms">
                    <button type="button" class={{track.muteCls}} title="Mute" {{on "click" (fn this.toggleMute track.id)}}>M</button>
                    <button type="button" class={{track.soloCls}} title="Solo" {{on "click" (fn this.toggleSolo track.id)}}>S</button>
                  </div>
                </div>
                <div class="track-steps">
                  {{#each STEP_INDICES as |stepIdx|}}
                    <div
                      class="step {{if (lookupStep this.stepGrid track.id stepIdx) 'active'}} {{if (eq stepIdx this.currentStep) 'current'}}"
                      role="button"
                      {{on "click" (fn this.onStepClick track.id stepIdx)}}
                    ></div>
                  {{/each}}
                </div>
              </div>
            {{/each}}
          </div>

          <div class="step-indicator">
            {{#each STEP_INDICES as |stepIdx|}}
              <div class="dot {{if (eq stepIdx this.currentStep) 'active'}}"></div>
            {{/each}}
          </div>
        </section>

        <div class={{this.recordingIndicatorClass}}>● Recording</div>
      </main>

      <footer class="app-footer">
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener noreferrer">Cory Loken &amp; Chiron</a>
          using
          <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
