/**
 * Synth Studio - Synthesizer Engine
 * Polyphonic synthesizer with ADSR envelope, filter, and LFO
 */

class Synthesizer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.voices = new Map(); // Active voices (note -> voice)
    this.maxVoices = 16;
    
    // Synth parameters
    this.params = {
      waveform: 'sine',
      octave: 0,
      detune: 0,
      // ADSR
      attack: 0.01,
      decay: 0.1,
      sustain: 0.7,
      release: 0.3,
      // Filter
      filterCutoff: 5000,
      filterResonance: 1,
      filterEnvAmount: 0,
      // LFO
      lfoRate: 5,
      lfoDepth: 0,
      lfoTarget: 'none' // 'none', 'pitch', 'filter'
    };
    
    // Create LFO
    this.lfo = this.ctx.createOscillator();
    this.lfoGain = this.ctx.createGain();
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
    
    // Output node (connect effects chain here)
    this.output = this.ctx.createGain();
    this.output.gain.value = 1;
  }
  
  /**
   * Convert note name to frequency
   */
  noteToFrequency(note) {
    const notes = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    // Parse note (e.g., "C#4" -> { note: "C#", octave: 4 })
    const match = note.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 440; // Default to A4
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    // Calculate semitones from A4
    const semitonesFromA4 = (notes[noteName] - 9) + (octave - 4) * 12;
    
    // Apply octave shift
    const totalSemitones = semitonesFromA4 + (this.params.octave * 12);
    
    return 440 * Math.pow(2, totalSemitones / 12);
  }
  
  /**
   * Create a new voice for a note
   */
  createVoice(note, velocity = 1) {
    const freq = this.noteToFrequency(note);
    const now = this.ctx.currentTime;
    
    // Create oscillator
    const osc = this.ctx.createOscillator();
    osc.type = this.params.waveform;
    osc.frequency.value = freq;
    osc.detune.value = this.params.detune;
    
    // Create filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.params.filterCutoff;
    filter.Q.value = this.params.filterResonance;
    
    // Create gain for ADSR envelope
    const envelope = this.ctx.createGain();
    envelope.gain.value = 0;
    
    // Connect: osc -> filter -> envelope -> output
    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.output);
    
    // Connect LFO based on target
    if (this.params.lfoTarget === 'pitch' && this.params.lfoDepth > 0) {
      const lfoToOsc = this.ctx.createGain();
      lfoToOsc.gain.value = this.params.lfoDepth;
      this.lfoGain.connect(lfoToOsc);
      lfoToOsc.connect(osc.detune);
    } else if (this.params.lfoTarget === 'filter' && this.params.lfoDepth > 0) {
      const lfoToFilter = this.ctx.createGain();
      lfoToFilter.gain.value = this.params.lfoDepth * 100;
      this.lfoGain.connect(lfoToFilter);
      lfoToFilter.connect(filter.frequency);
    }
    
    // Start oscillator
    osc.start(now);
    
    // Apply ADSR attack
    const attackEnd = now + this.params.attack;
    const decayEnd = attackEnd + this.params.decay;
    const peakLevel = velocity * 0.8;
    const sustainLevel = peakLevel * this.params.sustain;
    
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(peakLevel, attackEnd);
    envelope.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
    
    // Filter envelope
    if (this.params.filterEnvAmount > 0) {
      const filterPeak = Math.min(this.params.filterCutoff + this.params.filterEnvAmount, 20000);
      filter.frequency.setValueAtTime(this.params.filterCutoff, now);
      filter.frequency.linearRampToValueAtTime(filterPeak, attackEnd);
      filter.frequency.linearRampToValueAtTime(this.params.filterCutoff, decayEnd);
    }
    
    return {
      oscillator: osc,
      filter: filter,
      envelope: envelope,
      startTime: now,
      note: note,
      velocity: velocity
    };
  }
  
  /**
   * Play a note
   */
  noteOn(note, velocity = 1) {
    // Stop existing voice for this note
    if (this.voices.has(note)) {
      this.noteOff(note);
    }
    
    // Limit polyphony
    if (this.voices.size >= this.maxVoices) {
      // Stop oldest voice
      const oldest = this.voices.keys().next().value;
      this.noteOff(oldest);
    }
    
    const voice = this.createVoice(note, velocity);
    this.voices.set(note, voice);
    
    return voice;
  }
  
  /**
   * Stop a note
   */
  noteOff(note) {
    const voice = this.voices.get(note);
    if (!voice) return;
    
    const now = this.ctx.currentTime;
    const releaseEnd = now + this.params.release;
    
    // Apply release
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
    voice.envelope.gain.linearRampToValueAtTime(0, releaseEnd);
    
    // Stop and cleanup after release
    voice.oscillator.stop(releaseEnd + 0.1);
    
    // Remove from active voices
    this.voices.delete(note);
    
    // Cleanup after release
    setTimeout(() => {
      voice.oscillator.disconnect();
      voice.filter.disconnect();
      voice.envelope.disconnect();
    }, (this.params.release + 0.2) * 1000);
  }
  
  /**
   * Stop all notes
   */
  allNotesOff() {
    for (const note of this.voices.keys()) {
      this.noteOff(note);
    }
  }
  
  /**
   * Update synth parameter
   */
  setParam(param, value) {
    this.params[param] = value;
    
    // Update LFO if needed
    if (param === 'lfoRate') {
      this.lfo.frequency.value = value;
    } else if (param === 'lfoDepth') {
      this.lfoGain.gain.value = value > 0 ? 1 : 0;
    }
    
    // Update active voices for real-time parameters
    if (param === 'filterCutoff' || param === 'filterResonance') {
      for (const voice of this.voices.values()) {
        if (param === 'filterCutoff') {
          voice.filter.frequency.value = value;
        } else {
          voice.filter.Q.value = value;
        }
      }
    }
    
    if (param === 'detune') {
      for (const voice of this.voices.values()) {
        voice.oscillator.detune.value = value;
      }
    }
  }
  
  /**
   * Get current active notes
   */
  getActiveNotes() {
    return Array.from(this.voices.keys());
  }
  
  /**
   * Check if a note is playing
   */
  isNotePlaying(note) {
    return this.voices.has(note);
  }
  
  /**
   * Connect output to destination
   */
  connect(destination) {
    this.output.connect(destination);
  }
  
  /**
   * Disconnect output
   */
  disconnect() {
    this.output.disconnect();
  }
}

// Note frequencies reference (for display/debugging)
const NOTE_FREQUENCIES = {
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31,
  'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61,
  'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23,
  'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Synthesizer = Synthesizer;
  window.NOTE_FREQUENCIES = NOTE_FREQUENCIES;
}
