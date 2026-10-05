/**
 * Wildhaven's small, original instrument set. No sound files or dependencies.
 * Audio is deliberately lazy: call start() from a click, tap or key press.
 * Muting, hiding the page and disposal cancel every scheduled note.
 */
export class Soundscape {
  constructor({ muted = false, volume = 0.65, effects = .8, ambience = .55 } = {}) {
    this.muted = Boolean(muted);
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    this.effectsLevel = Math.max(0,Math.min(1,Number(effects)||0));this.ambienceLevel = Math.max(0,Math.min(1,Number(ambience)||0));this._route=null;this.cues=[];this.cueCount=0;
    this.context = null;
    this.master = null;
    this.started = false;
    this.disposed = false;
    this._sources = new Set();
    this._birdTimer = null;
    this._breeze = null;
    this._lastPlayed = new Map();
    this._revision = 0;
    this._onVisibility = () => {
      if (document.hidden) this._quiet();
      else if (this.started && !this.muted) void this._wake();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibility);
    }
  }

  get available() {
    return typeof globalThis.AudioContext !== 'undefined'
      || typeof globalThis.webkitAudioContext !== 'undefined';
  }

  get active() {
    return this.started && !this.muted && !this.disposed
      && !this._hidden() && this.context?.state === 'running';
  }

  async start() {
    if (this.disposed || !this.available) return false;
    if (!this.context) {
      try {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.effects=this.context.createGain();this.effects.gain.value=this.effectsLevel;this.effects.connect(this.master);
        this.ambience=this.context.createGain();this.ambience.gain.value=this.ambienceLevel;this.ambience.connect(this.master);
        // A little headroom for overlapping placement and bell notes.
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 12;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.008;
        limiter.release.value = 0.18;
        this.master.connect(limiter);
        limiter.connect(this.context.destination);
      } catch {
        // Sound is optional. A browser/device refusal must never stop play.
        this.context = null;
        this.master = null;
        return false;
      }
    }
    this.started = true;
    if (this.muted || this._hidden()) {
      this._quiet();
      return false;
    }
    return this._wake();
  }

  mute(value = !this.muted) {
    this.muted = Boolean(value);
    if (this.muted) this._quiet();
    else if (this.started) void this._wake();
    return this.muted;
  }

  play(kind) {
    if (!this.active) return false;
    const time = this.context.currentTime;
    // Dragging across cards or holding a key should never make a rattle.
    const cooldown = kind === 'select' ? 0.09 : kind === 'error' ? 0.3 : 0.055;
    if (time - (this._lastPlayed.get(kind) ?? -Infinity) < cooldown) return false;
    this._lastPlayed.set(kind, time);
    const at = time + 0.012;
    switch (kind) {
      case 'build': {
        const root = [261.63, 293.66, 392, 440][Math.floor(Math.random() * 4)];
        this._wood(root, at, 0.10);
        this._wood(root * 1.5, at + 0.065, 0.064);
        break;
      }
      case 'remove':
        this._wood(261.63, at, 0.065);
        this._wood(196, at + 0.08, 0.065);
        break;
      case 'select':
        this._wood(587.33, at, 0.035, 0.13);
        break;
      case 'error':
        this._tone(155.56, at, 0.16, 0.05, 'triangle', 146.83);
        break;
      case 'day':
        this._wood(392, at, 0.055, 0.45);
        this._wood(523.25, at + 0.16, 0.038, 0.5);
        break;
      case 'bell':
        this._bell(392, at, 0.15);
        this._bell(587.33, at + 0.14, 0.075);
        break;
      case 'discovery':
        this._wood(523.25,at,.09,.65);this._wood(659.25,at+.13,.065,.7);this._bell(783.99,at+.29,.045);break;
      case 'depart':
        this._wood(329.63,at,.055,.25);this._wood(440,at+.12,.045,.35);break;
      case 'win':
        // A physical village bell, followed by a warm open harmony.
        this._bell(261.63, at, 0.15);
        this._bell(392, at + 0.38, 0.12);
        this._bell(523.25, at + 0.8, 0.09);
        this._bell(293.66, at + 1.55, 0.085);
        this._bell(392, at + 1.55, 0.075);
        this._bell(523.25, at + 1.55, 0.06);
        break;
      default:
        return false;
    }
    return true;
  }


  setMix({effects=this.effectsLevel,ambience=this.ambienceLevel}={}) {
    this.effectsLevel=Math.max(0,Math.min(1,Number(effects)||0));this.ambienceLevel=Math.max(0,Math.min(1,Number(ambience)||0));
    if(this.context){this.effects.gain.setTargetAtTime(this.effectsLevel,this.context.currentTime,.04);this.ambience.gain.setTargetAtTime(this.ambienceLevel,this.context.currentTime,.12);}
    return {effects:this.effectsLevel,ambience:this.ambienceLevel};
  }
  _connect(envelope){
    const output=this._route?.bus||this.effects||this.master;
    if(this._route?.pan!==undefined&&this.context.createStereoPanner){const pan=this.context.createStereoPanner();pan.pan.value=this._route.pan;envelope.connect(pan);pan.connect(output);return[pan];}
    envelope.connect(output);return[];
  }
  _noise(at,duration,level,frequency=900,type='lowpass'){
    if(!this.active)return;
    const c=this.context,source=c.createBufferSource(),buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);
    source.buffer=buffer;const filter=c.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7;
    const envelope=c.createGain();envelope.gain.setValueAtTime(.0001,at);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,level*(this._route?.gain??1)),at+.003);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(envelope);const routed=this._connect(envelope);this._track(source,[filter,envelope,...routed]);source.start(at);source.stop(at+duration+.02);
  }
  /** Short original Foley. The renderer supplies camera-relative level and pan. */
  effect(kind,{gain=1,pan=0}={}){
    if(!this.active||this.effectsLevel===0||!Number.isFinite(gain)||gain<=0)return false;
    const cooldown={step:.11,hammer:.17,anvil:.25,axe:.23,chisel:.24,saw:.40,rustle:.6,cloth:.7,page:1.8,cargo:.35,bow:.16,impact:.15,gate:.65}[kind];if(cooldown===undefined)return false;
    const now=this.context.currentTime,key='fx:'+kind;if(now-(this._lastPlayed.get(key)??-Infinity)<cooldown)return false;
    this._lastPlayed.set(key,now);this._route={gain:Math.min(1,gain),pan:Math.max(-1,Math.min(1,Number(pan)||0))};const at=now+.008,pitch=.94+Math.random()*.12;
    switch(kind){
      case 'step':this._noise(at,.07,.13,440);this._tone(92*pitch,at,.07,.065,'sine',58);break;
      case 'hammer':this._wood(178*pitch,at,.13,.13);this._noise(at,.055,.16,1450);break;
      case 'axe':this._wood(114*pitch,at,.17,.14);this._noise(at,.10,.20,1100);break;
      case 'chisel':this._tone(1450*pitch,at,.095,.054);this._tone(2360*pitch,at,.05,.019);this._noise(at,.075,.12,2900,'highpass');break;
      case 'anvil':this._tone(830*pitch,at,.40,.08);this._tone(1515*pitch,at,.24,.045);this._tone(2460*pitch,at,.12,.018);this._noise(at,.04,.12,2100);break;
      case 'saw':this._noise(at,.21,.12,1700,'bandpass');this._noise(at+.24,.17,.08,2200,'bandpass');break;
      case 'rustle':case 'cloth':case 'page':this._noise(at,kind==='page'?.16:.24,kind==='page'?.032:.06,kind==='cloth'?780:2400,'bandpass');break;
      case 'cargo':this._wood(142*pitch,at,.09,.16);this._noise(at,.11,.08,650);this._wood(200*pitch,at+.075,.04,.1);break;
      case 'bow':this._tone(260*pitch,at,.12,.065,'triangle',95);this._noise(at+.025,.15,.10,2200,'bandpass');break;
      case 'impact':this._wood(130*pitch,at,.11,.10);this._noise(at,.10,.15,1200);break;
      case 'gate':this._tone(155,at,.36,.05,'triangle',88);this._noise(at,.40,.065,800,'bandpass');this._wood(115,at+.32,.11,.15);break;
    }
    this._route=null;this.cueCount++;this.cues.push({kind,at:now,gain,pan});if(this.cues.length>32)this.cues.shift();return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._quiet();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    if (this.context && this.context.state !== 'closed') {
      void this.context.close().catch(() => {});
    }
    this._lastPlayed.clear();
  }

  _hidden() {
    return typeof document !== 'undefined' && document.hidden;
  }

  async _wake() {
    if (!this.context || this.disposed || this.muted || this._hidden()) return false;
    const revision = this._revision;
    try {
      // Always enqueue resume: an immediately preceding mute may still have a
      // pending suspend even while the context reports itself as running.
      await this.context.resume();
    } catch { return false; }
    if (revision !== this._revision || !this.active) return false;
    this._startBreeze();
    if (this._birdTimer === null) this._scheduleBird(12000 + Math.random() * 14000);
    return true;
  }

  _quiet() {
    this._revision += 1;
    if (this._birdTimer !== null) clearTimeout(this._birdTimer);
    this._birdTimer = null;
    for (const source of this._sources) {
      try { source.stop(); } catch { /* It may have ended already. */ }
      source.onended?.();
    }
    this._sources.clear();
    this._breeze = null;
    // Suspend also removes the cost of the long, looping noise buffer.
    // Enqueue even if currently suspended; a pending resume may not yet have
    // changed state when the player mutes or switches tabs.
    if (this.context && this.context.state !== 'closed') {
      void this.context.suspend().catch(() => {});
    }
  }

  _track(source, connectedNodes) {
    // Bound accumulated voices even if repeated user input is unusually fast.
    if (this._sources.size >= 80) {
      const oldest = [...this._sources].find(source => source !== this._breeze);
      if (oldest) {
        try { oldest.stop(); } catch { /* Already stopped. */ }
        oldest.onended?.();
      }
    }
    this._sources.add(source);
    source.onended = () => {
      this._sources.delete(source);
      for (const node of [source, ...connectedNodes]) {
        try { node.disconnect(); } catch { /* Safe during teardown. */ }
      }
    };
  }

  _tone(frequency, at, duration, level, type = 'sine', endFrequency = frequency) {
    if (!this.active) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (endFrequency !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration * 0.8);
    }
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level*(this._route?.gain??1)), at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    const routed=this._connect(envelope);
    this._track(oscillator, [envelope,...routed]);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }

  _wood(frequency, at, level, duration = 0.24) {
    this._tone(frequency, at, duration, level, 'sine', frequency * 0.995);
    this._tone(frequency * 2.76, at, duration * 0.29, level * 0.2);
    this._tone(frequency * 4.08, at, duration * 0.14, level * 0.08);
  }

  _bell(frequency, at, level) {
    for (const [ratio, amplitude, duration] of [
      [1, 1, 3.8], [2, 0.34, 2.7], [2.76, 0.13, 1.55], [4.08, 0.065, 0.65],
    ]) {
      this._tone(frequency * ratio, at, duration, level * amplitude);
    }
  }

  _startBreeze() {
    if (this._breeze || !this.active) return;
    const context = this.context;
    const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * 4), context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      // Low-passed random motion avoids a bright, fatiguing white-noise bed.
      let value = 0;
      for (let i = 0; i < data.length; i += 1) {
        value = (value + (Math.random() * 2 - 1) * 0.02) / 1.02;
        data[i] = value * 3.5;
      }
      // Bring both edges to zero over a tiny window to avoid a loop click.
      const seam = Math.min(512, Math.floor(data.length / 4));
      for (let i = 0; i < seam; i += 1) {
        const blend = i / seam;
        data[i] *= blend;
        data[data.length - 1 - i] *= blend;
      }
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 160;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 850;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, context.currentTime + 2.4);
    noise.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.ambience);
    this._breeze = noise;
    this._track(noise, [highpass, lowpass, gain]);
    noise.start();
  }

  _scheduleBird(delay) {
    this._birdTimer = setTimeout(() => {
      this._birdTimer = null;
      if (!this.active) return;
      const at = this.context.currentTime + 0.03;
      const frequency = 1850 + Math.random() * 420;
      this._route={bus:this.ambience};
      this._tone(frequency, at, 0.095, 0.012, 'sine', frequency * 1.25);
      this._tone(frequency * 1.04, at + 0.16, 0.12, 0.009, 'sine', frequency * 1.42);
      if (Math.random() > 0.55) {
        this._tone(frequency * 1.12, at + 0.38, 0.09, 0.006, 'sine', frequency * 0.94);
      }
      this._route=null;
      this._scheduleBird(18000 + Math.random() * 28000);
    }, delay);
  }
}

export function createAudio(options) {
  return new Soundscape(options);
}

export default createAudio;
