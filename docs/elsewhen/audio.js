// All sound is synthesized after a user gesture. No files or network requests.
export class Instrument {
  constructor() { this.context = null; this.enabled = false; this.voices = new Set(); }

  async enable() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!this.context) {
      this.context = new Audio();
      const c = this.context;
      this.master = c.createGain();
      this.master.gain.value = .48;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 5;
      this.master.connect(compressor).connect(c.destination);
      this.reverb = c.createConvolver();
      const impulse = c.createBuffer(2, c.sampleRate * 2.3, c.sampleRate);
      let seed = 7613;
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          seed = (seed * 16807) % 2147483647;
          data[i] = (seed / 1073741824 - 1) * Math.pow(1 - i / data.length, 3.8) * .4;
        }
      }
      this.reverb.buffer = impulse;
      const wet = c.createGain();
      wet.gain.value = .32;
      this.reverb.connect(wet).connect(this.master);
    }
    await this.context.resume();
    this.enabled = this.context.state === 'running';
    this.master.gain.setTargetAtTime(this.enabled ? .48 : 0, this.context.currentTime, .04);
    return this.enabled;
  }

  mute() {
    this.enabled = false;
    if (this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, .035);
  }

  async suspend() { if (this.context?.state === 'running') await this.context.suspend(); }

  ring(midi, pan = 0, strength = 1) {
    if (!this.enabled || this.context?.state !== 'running' || this.voices.size > 48) return;
    const c = this.context, now = c.currentTime;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const envelope = c.createGain();
    const panner = c.createStereoPanner();
    panner.pan.value = Math.max(-.8, Math.min(.8, pan));
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(.18 * strength, now + .009);
    envelope.gain.exponentialRampToValueAtTime(.001, now + 2.5);
    envelope.connect(panner).connect(this.master);
    panner.connect(this.reverb);
    const partials = [[1, 1], [2.001, .21], [3.997, .08]];
    const nodes = [];
    for (const [ratio, level] of partials) {
      const oscillator = c.createOscillator();
      const gain = c.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      gain.gain.value = level;
      oscillator.connect(gain).connect(envelope);
      oscillator.start(now);
      oscillator.stop(now + 2.6);
      nodes.push(oscillator, gain);
    }
    this.voices.add(envelope);
    nodes[0].onended = () => {
      nodes.forEach(n => n.disconnect());
      envelope.disconnect();
      panner.disconnect();
      this.voices.delete(envelope);
    };
  }

  celebrate() { [62, 69, 74, 78].forEach((n, i) => this.ring(n, (i - 1.5) * .25, .65)); }
}
