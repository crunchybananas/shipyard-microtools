export class EffectsChain {
  ctx: AudioContext;
  input: GainNode;
  output: GainNode;
  dryGain: GainNode;
  delay: {
    node: DelayNode;
    feedback: GainNode;
    wetGain: GainNode;
    filter: BiquadFilterNode;
  };
  reverb: {
    convolver: ConvolverNode;
    wetGain: GainNode;
    decay: number;
    preDelay: DelayNode;
  };
  distortion: {
    waveshaper: WaveShaperNode;
    inputGain: GainNode;
    outputGain: GainNode;
    wetGain: GainNode;
    filter: BiquadFilterNode;
  };
  delayEnabled = false;
  reverbEnabled = false;
  distortionEnabled = false;
  delayMix = 0;
  reverbMix = 0;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;

    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1;

    this.delay = this.createDelay();
    this.reverb = this.createReverb();
    this.distortion = this.createDistortion();

    this.buildChain();
  }

  createDelay() {
    const delay = {
      node: this.ctx.createDelay(2),
      feedback: this.ctx.createGain(),
      wetGain: this.ctx.createGain(),
      filter: this.ctx.createBiquadFilter(),
    };

    delay.node.delayTime.value = 0.3;
    delay.feedback.gain.value = 0.4;
    delay.wetGain.gain.value = 0;
    delay.filter.type = "lowpass";
    delay.filter.frequency.value = 4000;

    delay.node.connect(delay.filter);
    delay.filter.connect(delay.feedback);
    delay.feedback.connect(delay.node);
    delay.node.connect(delay.wetGain);

    return delay;
  }

  createReverb() {
    const reverb = {
      convolver: this.ctx.createConvolver(),
      wetGain: this.ctx.createGain(),
      decay: 2,
      preDelay: this.ctx.createDelay(0.1),
    };

    reverb.wetGain.gain.value = 0;
    reverb.preDelay.delayTime.value = 0.02;

    this.generateImpulseResponse(reverb.decay).then((buffer) => {
      reverb.convolver.buffer = buffer;
    });

    reverb.preDelay.connect(reverb.convolver);
    reverb.convolver.connect(reverb.wetGain);

    return reverb;
  }

  async generateImpulseResponse(duration: number) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-3 * i / length);
        const earlyReflections =
          i < sampleRate * 0.05
            ? Math.sin(i * 0.1) * 0.3 * Math.exp(-10 * i / sampleRate)
            : 0;
        channelData[i] = (Math.random() * 2 - 1) * decay + earlyReflections;
      }
    }

    return impulse;
  }

  createDistortion() {
    const distortion = {
      waveshaper: this.ctx.createWaveShaper(),
      inputGain: this.ctx.createGain(),
      outputGain: this.ctx.createGain(),
      wetGain: this.ctx.createGain(),
      filter: this.ctx.createBiquadFilter(),
    };

    distortion.inputGain.gain.value = 1;
    distortion.outputGain.gain.value = 0.5;
    distortion.wetGain.gain.value = 0;
    distortion.filter.type = "lowpass";
    distortion.filter.frequency.value = 8000;

    distortion.waveshaper.curve = this.makeDistortionCurve(20);
    distortion.waveshaper.oversample = "4x";

    distortion.inputGain.connect(distortion.waveshaper);
    distortion.waveshaper.connect(distortion.filter);
    distortion.filter.connect(distortion.outputGain);
    distortion.outputGain.connect(distortion.wetGain);

    return distortion;
  }

  makeDistortionCurve(amount: number) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  buildChain() {
    this.input.disconnect();
    this.dryGain.disconnect();

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    this.input.connect(this.delay.node);
    this.delay.wetGain.connect(this.output);

    this.input.connect(this.reverb.preDelay);
    this.reverb.wetGain.connect(this.output);

    this.input.connect(this.distortion.inputGain);
    this.distortion.wetGain.connect(this.output);
  }

  setDelayEnabled(enabled: boolean) {
    this.delayEnabled = enabled;
    this.delay.wetGain.gain.value = enabled ? this.delayMix : 0;
  }

  setDelayParams(time: number, feedback: number, mix: number) {
    this.delay.node.delayTime.linearRampToValueAtTime(
      time,
      this.ctx.currentTime + 0.1
    );
    this.delay.feedback.gain.value = Math.min(feedback, 0.95);
    this.delayMix = mix;
    if (this.delayEnabled) {
      this.delay.wetGain.gain.value = mix;
    }
  }

  setReverbEnabled(enabled: boolean) {
    this.reverbEnabled = enabled;
    this.reverb.wetGain.gain.value = enabled ? this.reverbMix : 0;
  }

  setReverbParams(decay: number, mix: number) {
    if (decay !== this.reverb.decay) {
      this.reverb.decay = decay;
      this.generateImpulseResponse(decay).then((buffer) => {
        this.reverb.convolver.buffer = buffer;
      });
    }
    this.reverbMix = mix;
    if (this.reverbEnabled) {
      this.reverb.wetGain.gain.value = mix;
    }
  }

  setDistortionEnabled(enabled: boolean) {
    this.distortionEnabled = enabled;
    this.distortion.wetGain.gain.value = enabled ? 1 : 0;
    this.dryGain.gain.value = enabled ? 0.3 : 1;
  }

  setDistortionAmount(amount: number) {
    this.distortion.waveshaper.curve = this.makeDistortionCurve(amount);
    this.distortion.inputGain.gain.value = 1 + amount / 50;
    this.distortion.outputGain.gain.value = 1 / (1 + amount / 30);
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }
}
