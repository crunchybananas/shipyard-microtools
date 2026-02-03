/**
 * Synth Studio - Effects Engine
 * Delay, Reverb, and Distortion effects with wet/dry mix
 */

class EffectsChain {
  constructor(audioContext) {
    this.ctx = audioContext;
    
    // Input and output nodes
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    
    // Dry signal path
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1;
    
    // Create effects
    this.delay = this.createDelay();
    this.reverb = this.createReverb();
    this.distortion = this.createDistortion();
    
    // Effects enabled state
    this.delayEnabled = false;
    this.reverbEnabled = false;
    this.distortionEnabled = false;
    
    // Build signal chain
    this.buildChain();
  }
  
  /**
   * Create delay effect
   */
  createDelay() {
    const delay = {
      node: this.ctx.createDelay(2),
      feedback: this.ctx.createGain(),
      wetGain: this.ctx.createGain(),
      filter: this.ctx.createBiquadFilter()
    };
    
    // Default settings
    delay.node.delayTime.value = 0.3;
    delay.feedback.gain.value = 0.4;
    delay.wetGain.gain.value = 0;
    delay.filter.type = 'lowpass';
    delay.filter.frequency.value = 4000;
    
    // Connect delay feedback loop with filter
    delay.node.connect(delay.filter);
    delay.filter.connect(delay.feedback);
    delay.feedback.connect(delay.node);
    delay.node.connect(delay.wetGain);
    
    return delay;
  }
  
  /**
   * Create reverb effect using convolution
   */
  createReverb() {
    const reverb = {
      convolver: this.ctx.createConvolver(),
      wetGain: this.ctx.createGain(),
      decay: 2,
      preDelay: this.ctx.createDelay(0.1)
    };
    
    reverb.wetGain.gain.value = 0;
    reverb.preDelay.delayTime.value = 0.02;
    
    // Generate impulse response
    this.generateImpulseResponse(reverb.decay).then(buffer => {
      reverb.convolver.buffer = buffer;
    });
    
    // Connect
    reverb.preDelay.connect(reverb.convolver);
    reverb.convolver.connect(reverb.wetGain);
    
    return reverb;
  }
  
  /**
   * Generate impulse response for reverb
   */
  async generateImpulseResponse(duration) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with noise
        const decay = Math.exp(-3 * i / length);
        // Add some early reflections for character
        const earlyReflections = i < sampleRate * 0.05 ? 
          Math.sin(i * 0.1) * 0.3 * Math.exp(-10 * i / sampleRate) : 0;
        channelData[i] = (Math.random() * 2 - 1) * decay + earlyReflections;
      }
    }
    
    return impulse;
  }
  
  /**
   * Create distortion effect using waveshaper
   */
  createDistortion() {
    const distortion = {
      waveshaper: this.ctx.createWaveShaper(),
      inputGain: this.ctx.createGain(),
      outputGain: this.ctx.createGain(),
      wetGain: this.ctx.createGain(),
      filter: this.ctx.createBiquadFilter()
    };
    
    distortion.inputGain.gain.value = 1;
    distortion.outputGain.gain.value = 0.5;
    distortion.wetGain.gain.value = 0;
    distortion.filter.type = 'lowpass';
    distortion.filter.frequency.value = 8000;
    
    // Generate distortion curve
    distortion.waveshaper.curve = this.makeDistortionCurve(20);
    distortion.waveshaper.oversample = '4x';
    
    // Connect
    distortion.inputGain.connect(distortion.waveshaper);
    distortion.waveshaper.connect(distortion.filter);
    distortion.filter.connect(distortion.outputGain);
    distortion.outputGain.connect(distortion.wetGain);
    
    return distortion;
  }
  
  /**
   * Generate soft-clip distortion curve
   */
  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping using tanh-like function
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }
  
  /**
   * Build the effects chain
   */
  buildChain() {
    // Disconnect everything first
    this.input.disconnect();
    this.dryGain.disconnect();
    
    // Input splits to dry and effects
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Delay chain
    this.input.connect(this.delay.node);
    this.delay.wetGain.connect(this.output);
    
    // Reverb chain
    this.input.connect(this.reverb.preDelay);
    this.reverb.wetGain.connect(this.output);
    
    // Distortion chain (in series before delay/reverb)
    this.input.connect(this.distortion.inputGain);
    this.distortion.wetGain.connect(this.output);
  }
  
  /**
   * Enable/disable delay
   */
  setDelayEnabled(enabled) {
    this.delayEnabled = enabled;
    this.delay.wetGain.gain.value = enabled ? this.delayMix : 0;
  }
  
  /**
   * Set delay parameters
   */
  setDelayParams(time, feedback, mix) {
    this.delay.node.delayTime.linearRampToValueAtTime(time, this.ctx.currentTime + 0.1);
    this.delay.feedback.gain.value = Math.min(feedback, 0.95); // Prevent runaway feedback
    this.delayMix = mix;
    if (this.delayEnabled) {
      this.delay.wetGain.gain.value = mix;
    }
  }
  
  /**
   * Enable/disable reverb
   */
  setReverbEnabled(enabled) {
    this.reverbEnabled = enabled;
    this.reverb.wetGain.gain.value = enabled ? this.reverbMix : 0;
  }
  
  /**
   * Set reverb parameters
   */
  setReverbParams(decay, mix) {
    if (decay !== this.reverb.decay) {
      this.reverb.decay = decay;
      this.generateImpulseResponse(decay).then(buffer => {
        this.reverb.convolver.buffer = buffer;
      });
    }
    this.reverbMix = mix;
    if (this.reverbEnabled) {
      this.reverb.wetGain.gain.value = mix;
    }
  }
  
  /**
   * Enable/disable distortion
   */
  setDistortionEnabled(enabled) {
    this.distortionEnabled = enabled;
    this.distortion.wetGain.gain.value = enabled ? 1 : 0;
    // Reduce dry when distortion is on
    this.dryGain.gain.value = enabled ? 0.3 : 1;
  }
  
  /**
   * Set distortion amount
   */
  setDistortionAmount(amount) {
    this.distortion.waveshaper.curve = this.makeDistortionCurve(amount);
    this.distortion.inputGain.gain.value = 1 + amount / 50;
    this.distortion.outputGain.gain.value = 1 / (1 + amount / 30);
  }
  
  /**
   * Connect to destination
   */
  connect(destination) {
    this.output.connect(destination);
  }
  
  /**
   * Disconnect
   */
  disconnect() {
    this.output.disconnect();
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EffectsChain = EffectsChain;
}
