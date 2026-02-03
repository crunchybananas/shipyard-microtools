/**
 * Synth Studio - Step Sequencer
 * 16-step pattern sequencer with tempo, swing, and pattern management
 */

class Sequencer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.bpm = 120;
    this.swing = 0;
    this.steps = 16;
    this.currentStep = 0;
    this.isPlaying = false;
    this.isRecording = false;
    
    // Timing
    this.stepInterval = null;
    this.nextStepTime = 0;
    this.lookahead = 25; // ms
    this.scheduleAhead = 0.1; // seconds
    
    // Tracks - synth tracks have note info, drum tracks are triggers
    this.tracks = {
      synth1: { steps: new Array(16).fill(false), note: 'C4', velocity: 0.8 },
      synth2: { steps: new Array(16).fill(false), note: 'E3', velocity: 0.8 },
      kick: { steps: new Array(16).fill(false), velocity: 0.9 },
      snare: { steps: new Array(16).fill(false), velocity: 0.8 },
      hihat: { steps: new Array(16).fill(false), velocity: 0.6 },
      clap: { steps: new Array(16).fill(false), velocity: 0.7 }
    };
    
    // Callbacks
    this.onStep = null;
    this.onSynthTrigger = null;
    this.onDrumTrigger = null;
  }
  
  /**
   * Calculate step duration based on BPM
   */
  getStepDuration() {
    // 16th notes: 4 steps per beat
    return 60 / this.bpm / 4;
  }
  
  /**
   * Calculate swing offset for a step
   */
  getSwingOffset(step) {
    // Apply swing to even steps (off-beats)
    if (step % 2 === 1 && this.swing > 0) {
      return this.getStepDuration() * this.swing;
    }
    return 0;
  }
  
  /**
   * Start playback
   */
  start() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime;
    
    this.schedule();
  }
  
  /**
   * Stop playback
   */
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
  
  /**
   * Toggle recording
   */
  toggleRecord() {
    this.isRecording = !this.isRecording;
    return this.isRecording;
  }
  
  /**
   * Scheduler - schedules steps ahead of time
   */
  schedule() {
    if (!this.isPlaying) return;
    
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    
    this.stepInterval = setTimeout(() => this.schedule(), this.lookahead);
  }
  
  /**
   * Schedule a single step
   */
  scheduleStep(step, time) {
    const swingOffset = this.getSwingOffset(step);
    const actualTime = time + swingOffset;
    
    // Trigger callbacks for UI update
    const displayTime = (actualTime - this.ctx.currentTime) * 1000;
    setTimeout(() => {
      if (this.onStep) {
        this.onStep(step);
      }
    }, Math.max(0, displayTime));
    
    // Check each track
    for (const [trackId, track] of Object.entries(this.tracks)) {
      if (track.steps[step]) {
        if (trackId.startsWith('synth')) {
          // Synth trigger
          if (this.onSynthTrigger) {
            this.onSynthTrigger(track.note, track.velocity, actualTime);
          }
        } else {
          // Drum trigger
          if (this.onDrumTrigger) {
            this.onDrumTrigger(trackId, track.velocity, actualTime);
          }
        }
      }
    }
  }
  
  /**
   * Advance to next step
   */
  advanceStep() {
    this.nextStepTime += this.getStepDuration();
    this.currentStep = (this.currentStep + 1) % this.steps;
  }
  
  /**
   * Set BPM
   */
  setBPM(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
  }
  
  /**
   * Set swing amount (0-0.5)
   */
  setSwing(swing) {
    this.swing = Math.max(0, Math.min(0.5, swing));
  }
  
  /**
   * Toggle a step in a track
   */
  toggleStep(trackId, step) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].steps[step] = !this.tracks[trackId].steps[step];
      return this.tracks[trackId].steps[step];
    }
    return false;
  }
  
  /**
   * Set step state
   */
  setStep(trackId, step, value) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].steps[step] = value;
    }
  }
  
  /**
   * Get step state
   */
  getStep(trackId, step) {
    return this.tracks[trackId]?.steps[step] || false;
  }
  
  /**
   * Set track note (for synth tracks)
   */
  setTrackNote(trackId, note) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].note = note;
    }
  }
  
  /**
   * Set track velocity
   */
  setTrackVelocity(trackId, velocity) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].velocity = velocity;
    }
  }
  
  /**
   * Clear a track
   */
  clearTrack(trackId) {
    if (this.tracks[trackId]) {
      this.tracks[trackId].steps = new Array(16).fill(false);
    }
  }
  
  /**
   * Clear all tracks
   */
  clearAll() {
    for (const trackId in this.tracks) {
      this.clearTrack(trackId);
    }
  }
  
  /**
   * Get pattern data
   */
  getPattern() {
    const pattern = {};
    for (const [trackId, track] of Object.entries(this.tracks)) {
      pattern[trackId] = {
        steps: [...track.steps],
        note: track.note,
        velocity: track.velocity
      };
    }
    return pattern;
  }
  
  /**
   * Load pattern data
   */
  loadPattern(pattern) {
    for (const [trackId, data] of Object.entries(pattern)) {
      if (this.tracks[trackId]) {
        this.tracks[trackId].steps = [...data.steps];
        if (data.note) this.tracks[trackId].note = data.note;
        if (data.velocity) this.tracks[trackId].velocity = data.velocity;
      }
    }
  }
  
  /**
   * Record a note at current position (for live recording)
   */
  recordNote(trackId) {
    if (this.isRecording && this.isPlaying) {
      this.setStep(trackId, this.currentStep, true);
    }
  }
  
  /**
   * Get sequence state for saving
   */
  getState() {
    return {
      bpm: this.bpm,
      swing: this.swing,
      pattern: this.getPattern()
    };
  }
  
  /**
   * Restore sequence state
   */
  loadState(state) {
    if (state.bpm) this.bpm = state.bpm;
    if (state.swing) this.swing = state.swing;
    if (state.pattern) this.loadPattern(state.pattern);
  }
}

// Preset patterns
const PRESET_PATTERNS = {
  basic: {
    kick: { steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
    snare: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
    hihat: { steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false] }
  },
  house: {
    kick: { steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
    snare: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
    hihat: { steps: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false] },
    clap: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] }
  },
  hiphop: {
    kick: { steps: [true, false, false, false, false, false, true, false, true, false, false, false, false, false, false, false] },
    snare: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
    hihat: { steps: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true] }
  },
  techno: {
    kick: { steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
    hihat: { steps: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false] },
    clap: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Sequencer = Sequencer;
  window.PRESET_PATTERNS = PRESET_PATTERNS;
}
