export class DrumMachine {
  ctx: AudioContext;
  output: GainNode;
  compressor: DynamicsCompressorNode;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.output = this.ctx.createGain();
    this.output.gain.value = 0.8;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;

    this.compressor.connect(this.output);
  }

  play(drumType: string, velocity = 1, time: number | null = null) {
    const startTime = time || this.ctx.currentTime;
    const vel = Math.min(Math.max(velocity, 0), 1);

    switch (drumType) {
      case "kick":
        this.playKick(startTime, vel);
        break;
      case "snare":
        this.playSnare(startTime, vel);
        break;
      case "hihat":
        this.playHiHat(startTime, vel, false);
        break;
      case "hihat-open":
        this.playHiHat(startTime, vel, true);
        break;
      case "clap":
        this.playClap(startTime, vel);
        break;
      case "tom-high":
        this.playTom(startTime, vel, 200);
        break;
      case "tom-low":
        this.playTom(startTime, vel, 100);
        break;
      case "rim":
        this.playRimshot(startTime, vel);
        break;
      default:
        break;
    }
  }

  playKick(time: number, velocity: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    gain.gain.setValueAtTime(velocity * 1.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

    osc.connect(gain);
    gain.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.5);

    click.type = "square";
    click.frequency.setValueAtTime(800, time);
    click.frequency.exponentialRampToValueAtTime(200, time + 0.02);

    clickGain.gain.setValueAtTime(velocity * 0.3, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    click.connect(clickGain);
    clickGain.connect(this.compressor);

    click.start(time);
    click.stop(time + 0.05);
  }

  playSnare(time: number, velocity: number) {
    const noiseBuffer = this.createNoiseBuffer(0.2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.compressor);

    noise.start(time);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.05);

    oscGain.gain.setValueAtTime(velocity * 0.6, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.15);
  }

  playHiHat(time: number, velocity: number, open = false) {
    const noiseBuffer = this.createNoiseBuffer(open ? 0.4 : 0.08);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 10000;
    bandpass.Q.value = 1;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 7000;

    const gain = this.ctx.createGain();
    const decayTime = open ? 0.3 : 0.05;
    gain.gain.setValueAtTime(velocity * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.compressor);

    noise.start(time);
  }

  playClap(time: number, velocity: number) {
    for (let i = 0; i < 3; i++) {
      const burstTime = time + i * 0.01;

      const noiseBuffer = this.createNoiseBuffer(0.02);
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(velocity * 0.4, burstTime);
      gain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);

      noise.start(burstTime);
    }

    const mainNoise = this.createNoiseBuffer(0.15);
    const noise = this.ctx.createBufferSource();
    noise.buffer = mainNoise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity * 0.6, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    noise.start(time);
  }

  playTom(time: number, velocity: number, pitch: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(pitch, time + 0.1);

    gain.gain.setValueAtTime(velocity * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(gain);
    gain.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.3);

    const noiseBuffer = this.createNoiseBuffer(0.05);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.15, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    noise.connect(noiseGain);
    noiseGain.connect(this.compressor);

    noise.start(time);
  }

  playRimshot(time: number, velocity: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(800, time + 0.02);

    gain.gain.setValueAtTime(velocity * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  createNoiseBuffer(duration: number) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }
}
