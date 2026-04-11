export type PatternData = Record<
  string,
  { steps: boolean[]; note?: string; velocity: number }
>;

export const PATTERN_SLOT_COUNT = 8;
export const PATTERN_SLOT_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function makeEmptyTracks(): PatternData {
  return {
    synth1: { steps: new Array(16).fill(false), note: "C4", velocity: 0.8 },
    synth2: { steps: new Array(16).fill(false), note: "E3", velocity: 0.8 },
    kick: { steps: new Array(16).fill(false), velocity: 0.9 },
    snare: { steps: new Array(16).fill(false), velocity: 0.8 },
    hihat: { steps: new Array(16).fill(false), velocity: 0.6 },
    clap: { steps: new Array(16).fill(false), velocity: 0.7 },
  };
}

function clonePattern(p: PatternData): PatternData {
  const out: PatternData = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = { steps: [...v.steps], note: v.note, velocity: v.velocity };
  }
  return out;
}

function isPatternEmpty(p: PatternData): boolean {
  for (const v of Object.values(p)) {
    if (v.steps.some((s) => s)) return false;
  }
  return true;
}

export class Sequencer {
  ctx: AudioContext;
  bpm = 120;
  swing = 0;
  steps = 16;
  currentStep = 0;
  isPlaying = false;
  isRecording = false;

  stepInterval: ReturnType<typeof setTimeout> | null = null;
  nextStepTime = 0;
  lookahead = 25;
  scheduleAhead = 0.1;

  tracks: PatternData = makeEmptyTracks();

  patternSlots: (PatternData | null)[] = new Array(PATTERN_SLOT_COUNT).fill(
    null,
  );
  activeSlot = 0;
  songChain: number[] = [];
  songMode = false;
  songChainPos = 0;

  mutedTracks = new Set<string>();
  soloedTracks = new Set<string>();

  onStep: ((step: number) => void) | null = null;
  onPatternSwitch: ((slotIdx: number) => void) | null = null;
  onSynthTrigger:
    | ((note: string, velocity: number, time: number) => void)
    | null = null;
  onDrumTrigger:
    | ((drumType: string, velocity: number, time: number) => void)
    | null = null;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
  }

  getStepDuration() {
    return 60 / this.bpm / 4;
  }

  getSwingOffset(step: number) {
    if (step % 2 === 1 && this.swing > 0) {
      return this.getStepDuration() * this.swing;
    }
    return 0;
  }

  start() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime;

    this.schedule();
  }

  stop() {
    this.isPlaying = false;
    this.isRecording = false;
    this.currentStep = 0;

    if (this.stepInterval) {
      clearTimeout(this.stepInterval);
      this.stepInterval = null;
    }

    if (this.onStep) {
      this.onStep(-1);
    }
  }

  toggleRecord() {
    this.isRecording = !this.isRecording;
    return this.isRecording;
  }

  schedule() {
    if (!this.isPlaying) return;

    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    this.stepInterval = setTimeout(() => this.schedule(), this.lookahead);
  }

  private isAudibleTrack(trackId: string): boolean {
    if (this.soloedTracks.size > 0) {
      return this.soloedTracks.has(trackId);
    }
    return !this.mutedTracks.has(trackId);
  }

  scheduleStep(step: number, time: number) {
    const swingOffset = this.getSwingOffset(step);
    const actualTime = time + swingOffset;

    const displayTime = (actualTime - this.ctx.currentTime) * 1000;
    setTimeout(
      () => {
        if (this.onStep) {
          this.onStep(step);
        }
      },
      Math.max(0, displayTime),
    );

    for (const [trackId, track] of Object.entries(this.tracks)) {
      if (!track.steps[step]) continue;
      if (!this.isAudibleTrack(trackId)) continue;
      if (trackId.startsWith("synth")) {
        if (this.onSynthTrigger && track.note) {
          this.onSynthTrigger(track.note, track.velocity, actualTime);
        }
      } else {
        if (this.onDrumTrigger) {
          this.onDrumTrigger(trackId, track.velocity, actualTime);
        }
      }
    }
  }

  setTrackMuted(trackId: string, muted: boolean) {
    if (muted) this.mutedTracks.add(trackId);
    else this.mutedTracks.delete(trackId);
  }

  setTrackSolo(trackId: string, solo: boolean) {
    if (solo) this.soloedTracks.add(trackId);
    else this.soloedTracks.delete(trackId);
  }

  advanceStep() {
    this.nextStepTime += this.getStepDuration();
    const next = (this.currentStep + 1) % this.steps;
    this.currentStep = next;
    if (next === 0 && this.songMode && this.songChain.length > 0) {
      this.songChainPos = (this.songChainPos + 1) % this.songChain.length;
      const slot = this.songChain[this.songChainPos];
      if (slot !== undefined) this.switchToSlot(slot);
    }
  }

  savePatternToSlot(slot: number) {
    if (slot < 0 || slot >= PATTERN_SLOT_COUNT) return;
    this.patternSlots[slot] = clonePattern(this.tracks);
    this.activeSlot = slot;
  }

  loadPatternFromSlot(slot: number): boolean {
    if (slot < 0 || slot >= PATTERN_SLOT_COUNT) return false;
    const pat = this.patternSlots[slot];
    if (!pat) return false;
    this.tracks = clonePattern(pat);
    this.activeSlot = slot;
    return true;
  }

  switchToSlot(slot: number) {
    if (this.loadPatternFromSlot(slot)) {
      this.onPatternSwitch?.(slot);
    }
  }

  clearSlot(slot: number) {
    if (slot < 0 || slot >= PATTERN_SLOT_COUNT) return;
    this.patternSlots[slot] = null;
  }

  slotIsEmpty(slot: number): boolean {
    const p = this.patternSlots[slot];
    return !p || isPatternEmpty(p);
  }

  setSongChain(chain: number[]) {
    this.songChain = [...chain];
    this.songChainPos = 0;
  }

  setSongMode(enabled: boolean) {
    this.songMode = enabled;
    this.songChainPos = 0;
    if (enabled && this.songChain.length > 0) {
      const first = this.songChain[0];
      if (first !== undefined) this.switchToSlot(first);
    }
  }

  setBPM(bpm: number) {
    this.bpm = Math.max(40, Math.min(240, bpm));
  }

  setSwing(swing: number) {
    this.swing = Math.max(0, Math.min(0.5, swing));
  }

  toggleStep(trackId: string, step: number) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].steps[step] = !this.tracks[trackId].steps[step];
      return this.tracks[trackId].steps[step];
    }
    return false;
  }

  setStep(trackId: string, step: number, value: boolean) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].steps[step] = value;
    }
  }

  getStep(trackId: string, step: number) {
    return this.tracks[trackId]?.steps[step] || false;
  }

  setTrackNote(trackId: string, note: string) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].note = note;
    }
  }

  setTrackVelocity(trackId: string, velocity: number) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].velocity = velocity;
    }
  }

  clearTrack(trackId: string) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].steps = new Array(16).fill(false);
    }
  }

  clearAll() {
    for (const trackId in this.tracks) {
      this.clearTrack(trackId);
    }
  }

  getPattern() {
    const pattern: Record<
      string,
      { steps: boolean[]; note?: string; velocity: number }
    > = {};
    for (const [trackId, track] of Object.entries(this.tracks)) {
      pattern[trackId] = {
        steps: [...track.steps],
        note: track.note,
        velocity: track.velocity,
      };
    }
    return pattern;
  }

  loadPattern(
    pattern: Record<
      string,
      { steps: boolean[]; note?: string; velocity: number }
    >,
  ) {
    for (const [trackId, data] of Object.entries(pattern)) {
      if (this.tracks[trackId]) {
        this.tracks[trackId].steps = [...data.steps];
        if (data.note) this.tracks[trackId].note = data.note;
        if (data.velocity) this.tracks[trackId].velocity = data.velocity;
      }
    }
  }

  recordNote(trackId: string) {
    if (this.isRecording && this.isPlaying) {
      this.setStep(trackId, this.currentStep, true);
    }
  }

  getState() {
    return {
      bpm: this.bpm,
      swing: this.swing,
      pattern: this.getPattern(),
    };
  }

  loadState(state: {
    bpm?: number;
    swing?: number;
    pattern?: Record<
      string,
      { steps: boolean[]; note?: string; velocity: number }
    >;
  }) {
    if (state.bpm) this.bpm = state.bpm;
    if (state.swing) this.swing = state.swing;
    if (state.pattern) this.loadPattern(state.pattern);
  }
}

export const PRESET_PATTERNS = {
  basic: {
    kick: {
      steps: [
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
    snare: {
      steps: [
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
    hihat: {
      steps: [
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
      ],
    },
  },
  house: {
    kick: {
      steps: [
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
    snare: {
      steps: [
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
    hihat: {
      steps: [
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
      ],
    },
    clap: {
      steps: [
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        true,
      ],
    },
  },
  hiphop: {
    kick: {
      steps: [
        true,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    },
    snare: {
      steps: [
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
    hihat: {
      steps: [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      ],
    },
  },
  techno: {
    kick: {
      steps: [
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
    hihat: {
      steps: [
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
      ],
    },
    clap: {
      steps: [
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    },
  },
};
