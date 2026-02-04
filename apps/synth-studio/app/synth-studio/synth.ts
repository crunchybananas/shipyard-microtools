export class Synthesizer {
  ctx: AudioContext;
  voices = new Map<string, {
    oscillator: OscillatorNode;
    filter: BiquadFilterNode;
    envelope: GainNode;
    startTime: number;
    note: string;
    velocity: number;
  }>();
  maxVoices = 16;
  params = {
    waveform: "sine",
    octave: 0,
    detune: 0,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    filterCutoff: 5000,
    filterResonance: 1,
    filterEnvAmount: 0,
    lfoRate: 5,
    lfoDepth: 0,
    lfoTarget: "none" as "none" | "pitch" | "filter",
  };

  lfo: OscillatorNode;
  lfoGain: GainNode;
  output: GainNode;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;

    this.lfo = this.ctx.createOscillator();
    this.lfoGain = this.ctx.createGain();
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    this.output = this.ctx.createGain();
    this.output.gain.value = 1;
  }

  noteToFrequency(note: string) {
    const notes: Record<string, number> = {
      C: 0,
      "C#": 1,
      Db: 1,
      D: 2,
      "D#": 3,
      Eb: 3,
      E: 4,
      F: 5,
      "F#": 6,
      Gb: 6,
      G: 7,
      "G#": 8,
      Ab: 8,
      A: 9,
      "A#": 10,
      Bb: 10,
      B: 11,
    };

    const match = note.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 440;

    const noteName = match[1];
    const octave = parseInt(match[2]);
    const semitonesFromA4 = (notes[noteName] - 9) + (octave - 4) * 12;
    const totalSemitones = semitonesFromA4 + this.params.octave * 12;

    return 440 * Math.pow(2, totalSemitones / 12);
  }

  createVoice(note: string, velocity = 1) {
    const freq = this.noteToFrequency(note);
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = this.params.waveform as OscillatorType;
    osc.frequency.value = freq;
    osc.detune.value = this.params.detune;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.params.filterCutoff;
    filter.Q.value = this.params.filterResonance;

    const envelope = this.ctx.createGain();
    envelope.gain.value = 0;

    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.output);

    if (this.params.lfoTarget === "pitch" && this.params.lfoDepth > 0) {
      const lfoToOsc = this.ctx.createGain();
      lfoToOsc.gain.value = this.params.lfoDepth;
      this.lfoGain.connect(lfoToOsc);
      lfoToOsc.connect(osc.detune);
    } else if (this.params.lfoTarget === "filter" && this.params.lfoDepth > 0) {
      const lfoToFilter = this.ctx.createGain();
      lfoToFilter.gain.value = this.params.lfoDepth * 100;
      this.lfoGain.connect(lfoToFilter);
      lfoToFilter.connect(filter.frequency);
    }

    osc.start(now);

    const attackEnd = now + this.params.attack;
    const decayEnd = attackEnd + this.params.decay;
    const peakLevel = velocity * 0.8;
    const sustainLevel = peakLevel * this.params.sustain;

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(peakLevel, attackEnd);
    envelope.gain.linearRampToValueAtTime(sustainLevel, decayEnd);

    if (this.params.filterEnvAmount > 0) {
      const filterPeak = Math.min(
        this.params.filterCutoff + this.params.filterEnvAmount,
        20000
      );
      filter.frequency.setValueAtTime(this.params.filterCutoff, now);
      filter.frequency.linearRampToValueAtTime(filterPeak, attackEnd);
      filter.frequency.linearRampToValueAtTime(this.params.filterCutoff, decayEnd);
    }

    return {
      oscillator: osc,
      filter,
      envelope,
      startTime: now,
      note,
      velocity,
    };
  }

  noteOn(note: string, velocity = 1) {
    if (this.voices.has(note)) {
      this.noteOff(note);
    }

    if (this.voices.size >= this.maxVoices) {
      const oldest = this.voices.keys().next().value as string | undefined;
      if (oldest) this.noteOff(oldest);
    }

    const voice = this.createVoice(note, velocity);
    this.voices.set(note, voice);
    return voice;
  }

  noteOff(note: string) {
    const voice = this.voices.get(note);
    if (!voice) return;

    const now = this.ctx.currentTime;
    const releaseEnd = now + this.params.release;

    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
    voice.envelope.gain.linearRampToValueAtTime(0, releaseEnd);

    voice.oscillator.stop(releaseEnd + 0.1);
    this.voices.delete(note);

    setTimeout(() => {
      voice.oscillator.disconnect();
      voice.filter.disconnect();
      voice.envelope.disconnect();
    }, (this.params.release + 0.2) * 1000);
  }

  allNotesOff() {
    for (const note of this.voices.keys()) {
      this.noteOff(note);
    }
  }

  setParam(param: string, value: number | string) {
    (this.params as Record<string, number | string>)[param] = value as never;

    if (param === "lfoRate") {
      this.lfo.frequency.value = Number(value);
    } else if (param === "lfoDepth") {
      this.lfoGain.gain.value = Number(value) > 0 ? 1 : 0;
    }

    if (param === "filterCutoff" || param === "filterResonance") {
      for (const voice of this.voices.values()) {
        if (param === "filterCutoff") {
          voice.filter.frequency.value = Number(value);
        } else {
          voice.filter.Q.value = Number(value);
        }
      }
    }

    if (param === "detune") {
      for (const voice of this.voices.values()) {
        voice.oscillator.detune.value = Number(value);
      }
    }
  }

  getActiveNotes() {
    return Array.from(this.voices.keys());
  }

  isNotePlaying(note: string) {
    return this.voices.has(note);
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }
}
