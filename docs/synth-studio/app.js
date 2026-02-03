/**
 * Synth Studio - Main Application
 * UI bindings, keyboard input, recording/export, and presets
 */

// Global state
let audioContext = null;
let synth = null;
let effects = null;
let drums = null;
let sequencer = null;
let visualizer = null;
let masterGain = null;
let isAudioInitialized = false;

// Recording state
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Keyboard mappings
const KEY_MAP = {
  'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3',
  'f': 'F3', 't': 'F#3', 'g': 'G3', 'y': 'G#3', 'h': 'A3',
  'u': 'A#3', 'j': 'B3', 'k': 'C4', 'o': 'C#4', 'l': 'D4',
  'p': 'D#4', ';': 'E4', "'": 'F4'
};

// Presets
const PRESETS = {
  bass: {
    waveform: 'sawtooth',
    octave: -1,
    detune: 0,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.6,
    release: 0.3,
    filterCutoff: 400,
    filterResonance: 5,
    filterEnvAmount: 2000
  },
  lead: {
    waveform: 'square',
    octave: 0,
    detune: 10,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.8,
    release: 0.2,
    filterCutoff: 2000,
    filterResonance: 2,
    filterEnvAmount: 500
  },
  pad: {
    waveform: 'sine',
    octave: 0,
    detune: 5,
    attack: 0.5,
    decay: 0.3,
    sustain: 0.7,
    release: 1.0,
    filterCutoff: 1000,
    filterResonance: 1,
    filterEnvAmount: 0
  },
  pluck: {
    waveform: 'triangle',
    octave: 0,
    detune: 0,
    attack: 0.001,
    decay: 0.3,
    sustain: 0,
    release: 0.2,
    filterCutoff: 3000,
    filterResonance: 3,
    filterEnvAmount: 5000
  },
  brass: {
    waveform: 'sawtooth',
    octave: 0,
    detune: 15,
    attack: 0.08,
    decay: 0.2,
    sustain: 0.6,
    release: 0.15,
    filterCutoff: 1500,
    filterResonance: 2,
    filterEnvAmount: 3000
  },
  strings: {
    waveform: 'sawtooth',
    octave: 0,
    detune: 8,
    attack: 0.3,
    decay: 0.1,
    sustain: 0.9,
    release: 0.5,
    filterCutoff: 2500,
    filterResonance: 1,
    filterEnvAmount: 0
  }
};

/**
 * Initialize audio system
 */
async function initAudio() {
  if (isAudioInitialized) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create master gain with limiter
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.7;
    
    // Create limiter (compressor with high ratio)
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    
    // Initialize components
    synth = new Synthesizer(audioContext);
    effects = new EffectsChain(audioContext);
    drums = new DrumMachine(audioContext);
    sequencer = new Sequencer(audioContext);
    visualizer = new Visualizer(audioContext);
    
    // Connect signal chain
    // Synth -> Effects -> Master
    synth.connect(effects.input);
    effects.connect(masterGain);
    
    // Drums -> Master (bypass effects for punch)
    drums.connect(masterGain);
    
    // Master -> Limiter -> Visualizer -> Output
    masterGain.connect(limiter);
    limiter.connect(visualizer.getInput());
    visualizer.getInput().connect(audioContext.destination);
    
    // Initialize visualizer
    visualizer.init(
      document.getElementById('waveform-canvas'),
      document.getElementById('spectrum-canvas'),
      document.getElementById('adsr-canvas')
    );
    
    // Set up sequencer callbacks
    sequencer.onSynthTrigger = (note, velocity, time) => {
      // For sequencer, use a short note
      const voice = synth.noteOn(note, velocity);
      setTimeout(() => synth.noteOff(note), 150);
    };
    
    sequencer.onDrumTrigger = (drumType, velocity, time) => {
      drums.play(drumType, velocity, time);
    };
    
    sequencer.onStep = (step) => {
      updateStepIndicator(step);
    };
    
    isAudioInitialized = true;
    console.log('Audio initialized successfully');
    
    // Update initial ADSR visualization
    updateADSRVisualization();
    
  } catch (error) {
    console.error('Failed to initialize audio:', error);
  }
}

/**
 * Resume audio context (required for user interaction)
 */
async function resumeAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

// ===== UI Setup =====

document.addEventListener('DOMContentLoaded', () => {
  setupKeyboard();
  setupSequencerGrid();
  setupStepIndicator();
  setupControls();
  setupKeyboardInput();
  
  // Initialize audio on first user interaction
  document.body.addEventListener('click', async () => {
    await initAudio();
    await resumeAudio();
  }, { once: true });
  
  document.body.addEventListener('keydown', async () => {
    await initAudio();
    await resumeAudio();
  }, { once: true });
});

/**
 * Set up on-screen keyboard
 */
function setupKeyboard() {
  const keyboard = document.getElementById('keyboard');
  const notes = [
    { note: 'C3', white: true, key: 'A' },
    { note: 'C#3', white: false, key: 'W' },
    { note: 'D3', white: true, key: 'S' },
    { note: 'D#3', white: false, key: 'E' },
    { note: 'E3', white: true, key: 'D' },
    { note: 'F3', white: true, key: 'F' },
    { note: 'F#3', white: false, key: 'T' },
    { note: 'G3', white: true, key: 'G' },
    { note: 'G#3', white: false, key: 'Y' },
    { note: 'A3', white: true, key: 'H' },
    { note: 'A#3', white: false, key: 'U' },
    { note: 'B3', white: true, key: 'J' },
    { note: 'C4', white: true, key: 'K' },
    { note: 'C#4', white: false, key: 'O' },
    { note: 'D4', white: true, key: 'L' },
    { note: 'D#4', white: false, key: 'P' },
    { note: 'E4', white: true, key: ';' }
  ];
  
  let whiteKeyIndex = 0;
  const whiteKeyWidth = 100 / notes.filter(n => n.white).length;
  
  notes.forEach((noteInfo, index) => {
    const key = document.createElement('div');
    key.className = noteInfo.white ? 'white-key' : 'black-key';
    key.dataset.note = noteInfo.note;
    
    if (noteInfo.white) {
      key.innerHTML = `
        <span class="note-label">${noteInfo.note}</span>
        <span class="key-hint">${noteInfo.key}</span>
      `;
      key.style.width = `${whiteKeyWidth}%`;
      whiteKeyIndex++;
    } else {
      key.innerHTML = `<span class="key-hint">${noteInfo.key}</span>`;
      // Position black keys
      const offset = (whiteKeyIndex - 1) * whiteKeyWidth + whiteKeyWidth * 0.7;
      key.style.left = `${offset}%`;
    }
    
    // Mouse events
    key.addEventListener('mousedown', (e) => {
      e.preventDefault();
      playNote(noteInfo.note);
      key.classList.add('active');
    });
    
    key.addEventListener('mouseup', () => {
      stopNote(noteInfo.note);
      key.classList.remove('active');
    });
    
    key.addEventListener('mouseleave', () => {
      if (key.classList.contains('active')) {
        stopNote(noteInfo.note);
        key.classList.remove('active');
      }
    });
    
    // Touch events
    key.addEventListener('touchstart', (e) => {
      e.preventDefault();
      playNote(noteInfo.note);
      key.classList.add('active');
    });
    
    key.addEventListener('touchend', () => {
      stopNote(noteInfo.note);
      key.classList.remove('active');
    });
    
    keyboard.appendChild(key);
  });
}

/**
 * Set up computer keyboard input
 */
function setupKeyboardInput() {
  const activeKeys = new Set();
  
  document.addEventListener('keydown', async (e) => {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    const key = e.key.toLowerCase();
    
    // Prevent repeat
    if (activeKeys.has(key)) return;
    
    // Note input
    if (KEY_MAP[key]) {
      e.preventDefault();
      activeKeys.add(key);
      playNote(KEY_MAP[key]);
      highlightKey(KEY_MAP[key], true);
    }
    
    // Octave shift
    if (key === 'z' && synth) {
      const octave = Math.max(-2, synth.params.octave - 1);
      synth.setParam('octave', octave);
      document.getElementById('octave').value = octave;
      document.getElementById('octave-value').textContent = octave;
    }
    if (key === 'x' && synth) {
      const octave = Math.min(2, synth.params.octave + 1);
      synth.setParam('octave', octave);
      document.getElementById('octave').value = octave;
      document.getElementById('octave-value').textContent = octave;
    }
    
    // Space for play/stop
    if (key === ' ') {
      e.preventDefault();
      togglePlayback();
    }
  });
  
  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    
    if (KEY_MAP[key]) {
      activeKeys.delete(key);
      stopNote(KEY_MAP[key]);
      highlightKey(KEY_MAP[key], false);
    }
  });
}

/**
 * Highlight keyboard key
 */
function highlightKey(note, active) {
  const key = document.querySelector(`[data-note="${note}"]`);
  if (key) {
    key.classList.toggle('active', active);
  }
}

/**
 * Play a note
 */
function playNote(note) {
  if (!synth) return;
  synth.noteOn(note, 0.8);
}

/**
 * Stop a note
 */
function stopNote(note) {
  if (!synth) return;
  synth.noteOff(note);
}

/**
 * Set up sequencer grid
 */
function setupSequencerGrid() {
  const tracks = document.querySelectorAll('.seq-track');
  
  tracks.forEach(track => {
    const trackId = track.dataset.track;
    const stepsContainer = track.querySelector('.track-steps');
    
    // Create 16 steps
    for (let i = 0; i < 16; i++) {
      const step = document.createElement('div');
      step.className = 'step';
      step.dataset.step = i;
      
      step.addEventListener('click', () => {
        if (!sequencer) return;
        const isActive = sequencer.toggleStep(trackId, i);
        step.classList.toggle('active', isActive);
      });
      
      stepsContainer.appendChild(step);
    }
    
    // Track note selector (for synth tracks)
    const noteSelect = track.querySelector('.track-note');
    if (noteSelect) {
      noteSelect.addEventListener('change', () => {
        if (!sequencer) return;
        sequencer.setTrackNote(trackId, noteSelect.value);
      });
    }
  });
}

/**
 * Set up step indicator
 */
function setupStepIndicator() {
  const indicator = document.getElementById('step-indicator');
  for (let i = 0; i < 16; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.dataset.step = i;
    indicator.appendChild(dot);
  }
}

/**
 * Update step indicator
 */
function updateStepIndicator(step) {
  const dots = document.querySelectorAll('.step-indicator .dot');
  const steps = document.querySelectorAll('.step');
  
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === step);
  });
  
  steps.forEach(s => {
    const stepIndex = parseInt(s.dataset.step);
    s.classList.toggle('current', stepIndex === step);
  });
}

/**
 * Set up all controls
 */
function setupControls() {
  // Waveform selector
  document.querySelectorAll('.wave-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (synth) synth.setParam('waveform', btn.dataset.wave);
    });
  });
  
  // Oscillator controls
  setupSlider('octave', 'octave', (v) => v, 0);
  setupSlider('detune', 'detune', (v) => v, 0);
  
  // Filter controls
  setupSlider('filter-cutoff', 'filterCutoff', (v) => `${Math.round(v)} Hz`);
  setupSlider('filter-resonance', 'filterResonance', (v) => v.toFixed(1));
  setupSlider('filter-env-amount', 'filterEnvAmount', (v) => Math.round(v));
  
  // ADSR controls
  setupSlider('attack', 'attack', (v) => `${Math.round(v * 1000)}ms`);
  setupSlider('decay', 'decay', (v) => `${Math.round(v * 1000)}ms`);
  setupSlider('sustain', 'sustain', (v) => `${Math.round(v * 100)}%`);
  setupSlider('release', 'release', (v) => `${Math.round(v * 1000)}ms`);
  
  // LFO controls
  setupSlider('lfo-rate', 'lfoRate', (v) => `${v.toFixed(1)} Hz`);
  setupSlider('lfo-depth', 'lfoDepth', (v) => Math.round(v));
  
  document.querySelectorAll('.lfo-target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lfo-target-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (synth) synth.setParam('lfoTarget', btn.dataset.target);
    });
  });
  
  // Master volume
  const masterSlider = document.getElementById('master-volume');
  masterSlider.addEventListener('input', () => {
    const value = parseFloat(masterSlider.value);
    if (masterGain) masterGain.gain.value = value;
    document.getElementById('master-volume-value').textContent = `${Math.round(value * 100)}%`;
  });
  
  // Effects
  setupEffectControls();
  
  // Visualization toggle
  document.querySelectorAll('.viz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (visualizer) visualizer.setMode(btn.dataset.viz);
    });
  });
  
  // BPM control
  const bpmInput = document.getElementById('bpm');
  bpmInput.addEventListener('change', () => {
    if (sequencer) sequencer.setBPM(parseInt(bpmInput.value));
  });
  
  // Swing control
  const swingSlider = document.getElementById('swing');
  swingSlider.addEventListener('input', () => {
    if (sequencer) sequencer.setSwing(parseFloat(swingSlider.value));
  });
  
  // Transport controls
  document.getElementById('play-btn').addEventListener('click', togglePlayback);
  document.getElementById('stop-btn').addEventListener('click', stopPlayback);
  document.getElementById('record-btn').addEventListener('click', toggleRecording);
  
  // Preset selector
  document.getElementById('preset-select').addEventListener('change', (e) => {
    if (e.target.value && PRESETS[e.target.value]) {
      loadPreset(PRESETS[e.target.value]);
    }
  });
  
  // Export button
  document.getElementById('export-btn').addEventListener('click', exportWAV);
  
  // Save button
  document.getElementById('save-btn').addEventListener('click', saveProject);
  
  // Level meter animation
  setInterval(updateLevelMeter, 50);
}

/**
 * Set up a slider control
 */
function setupSlider(id, param, format, defaultVal = null) {
  const slider = document.getElementById(id);
  const valueDisplay = document.getElementById(`${id}-value`);
  
  slider.addEventListener('input', () => {
    const value = parseFloat(slider.value);
    if (synth) synth.setParam(param, value);
    if (valueDisplay) valueDisplay.textContent = format(value);
    
    // Update ADSR visualization
    if (['attack', 'decay', 'sustain', 'release'].includes(param)) {
      updateADSRVisualization();
    }
  });
}

/**
 * Set up effects controls
 */
function setupEffectControls() {
  // Delay
  document.getElementById('delay-enabled').addEventListener('change', (e) => {
    if (effects) effects.setDelayEnabled(e.target.checked);
  });
  
  ['delay-time', 'delay-feedback', 'delay-mix'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateDelay);
  });
  
  // Reverb
  document.getElementById('reverb-enabled').addEventListener('change', (e) => {
    if (effects) effects.setReverbEnabled(e.target.checked);
  });
  
  ['reverb-decay', 'reverb-mix'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateReverb);
  });
  
  // Distortion
  document.getElementById('distortion-enabled').addEventListener('change', (e) => {
    if (effects) effects.setDistortionEnabled(e.target.checked);
  });
  
  document.getElementById('distortion-amount').addEventListener('input', () => {
    const amount = parseFloat(document.getElementById('distortion-amount').value);
    if (effects) effects.setDistortionAmount(amount);
  });
}

function updateDelay() {
  if (!effects) return;
  const time = parseFloat(document.getElementById('delay-time').value);
  const feedback = parseFloat(document.getElementById('delay-feedback').value);
  const mix = parseFloat(document.getElementById('delay-mix').value);
  effects.setDelayParams(time, feedback, mix);
}

function updateReverb() {
  if (!effects) return;
  const decay = parseFloat(document.getElementById('reverb-decay').value);
  const mix = parseFloat(document.getElementById('reverb-mix').value);
  effects.setReverbParams(decay, mix);
}

/**
 * Update ADSR visualization
 */
function updateADSRVisualization() {
  if (!visualizer) return;
  
  const attack = parseFloat(document.getElementById('attack').value);
  const decay = parseFloat(document.getElementById('decay').value);
  const sustain = parseFloat(document.getElementById('sustain').value);
  const release = parseFloat(document.getElementById('release').value);
  
  visualizer.drawADSR(attack, decay, sustain, release);
}

/**
 * Update level meter
 */
function updateLevelMeter() {
  if (!visualizer) return;
  const level = visualizer.getPeakLevel();
  const meter = document.getElementById('meter-bar');
  meter.style.width = `${level * 100}%`;
}

/**
 * Toggle playback
 */
function togglePlayback() {
  if (!sequencer) return;
  
  const playBtn = document.getElementById('play-btn');
  
  if (sequencer.isPlaying) {
    sequencer.stop();
    playBtn.classList.remove('playing');
    playBtn.textContent = '▶';
  } else {
    sequencer.start();
    playBtn.classList.add('playing');
    playBtn.textContent = '⏸';
  }
}

/**
 * Stop playback
 */
function stopPlayback() {
  if (!sequencer) return;
  
  sequencer.stop();
  document.getElementById('play-btn').classList.remove('playing');
  document.getElementById('play-btn').textContent = '▶';
  
  // Clear step highlights
  document.querySelectorAll('.step').forEach(s => s.classList.remove('current'));
  document.querySelectorAll('.step-indicator .dot').forEach(d => d.classList.remove('active'));
}

/**
 * Toggle recording
 */
async function toggleRecording() {
  if (!audioContext) return;
  
  const recordBtn = document.getElementById('record-btn');
  const indicator = document.getElementById('recording-indicator');
  
  if (isRecording) {
    // Stop recording
    mediaRecorder.stop();
    recordBtn.classList.remove('recording');
    indicator.classList.add('hidden');
    isRecording = false;
  } else {
    // Start recording
    try {
      const dest = audioContext.createMediaStreamDestination();
      masterGain.connect(dest);
      
      mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: 'audio/webm'
      });
      
      recordedChunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'synth-studio-recording.webm';
        a.click();
        URL.revokeObjectURL(url);
      };
      
      mediaRecorder.start();
      recordBtn.classList.add('recording');
      indicator.classList.remove('hidden');
      isRecording = true;
      
    } catch (error) {
      console.error('Recording failed:', error);
    }
  }
}

/**
 * Export as WAV
 */
async function exportWAV() {
  if (!audioContext || !sequencer) return;
  
  // Create offline context
  const duration = (60 / sequencer.bpm) * 4; // 4 bars
  const sampleRate = audioContext.sampleRate;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
  
  // Create offline synth and drums
  const offlineSynth = new Synthesizer(offlineCtx);
  const offlineDrums = new DrumMachine(offlineCtx);
  const offlineEffects = new EffectsChain(offlineCtx);
  const offlineMaster = offlineCtx.createGain();
  offlineMaster.gain.value = 0.7;
  
  // Copy synth settings
  Object.assign(offlineSynth.params, synth.params);
  
  // Connect
  offlineSynth.connect(offlineEffects.input);
  offlineEffects.connect(offlineMaster);
  offlineDrums.connect(offlineMaster);
  offlineMaster.connect(offlineCtx.destination);
  
  // Copy effect settings
  offlineEffects.setDelayEnabled(document.getElementById('delay-enabled').checked);
  offlineEffects.setDelayParams(
    parseFloat(document.getElementById('delay-time').value),
    parseFloat(document.getElementById('delay-feedback').value),
    parseFloat(document.getElementById('delay-mix').value)
  );
  offlineEffects.setReverbEnabled(document.getElementById('reverb-enabled').checked);
  offlineEffects.setReverbParams(
    parseFloat(document.getElementById('reverb-decay').value),
    parseFloat(document.getElementById('reverb-mix').value)
  );
  
  // Schedule all events
  const stepDuration = 60 / sequencer.bpm / 4;
  const totalSteps = 64; // 4 patterns
  
  for (let step = 0; step < totalSteps; step++) {
    const time = step * stepDuration;
    const patternStep = step % 16;
    
    // Check each track
    for (const [trackId, track] of Object.entries(sequencer.tracks)) {
      if (track.steps[patternStep]) {
        if (trackId.startsWith('synth')) {
          // Schedule synth note
          const voice = offlineSynth.noteOn(track.note, track.velocity);
          // Schedule note off
          const noteOffTime = time + 0.1;
          offlineSynth.voices.get(track.note);
        } else {
          // Schedule drum hit
          offlineDrums.play(trackId, track.velocity, time);
        }
      }
    }
  }
  
  // Render
  const buffer = await offlineCtx.startRendering();
  
  // Convert to WAV
  const wav = audioBufferToWav(buffer);
  const blob = new Blob([wav], { type: 'audio/wav' });
  
  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'synth-studio-export.wav';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert AudioBuffer to WAV format
 */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Interleave channels and write samples
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Load a preset
 */
function loadPreset(preset) {
  if (!synth) return;
  
  // Update synth params
  for (const [key, value] of Object.entries(preset)) {
    synth.setParam(key, value);
  }
  
  // Update UI
  if (preset.waveform) {
    document.querySelectorAll('.wave-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.wave === preset.waveform);
    });
  }
  
  const updates = {
    'octave': preset.octave,
    'detune': preset.detune,
    'attack': preset.attack,
    'decay': preset.decay,
    'sustain': preset.sustain,
    'release': preset.release,
    'filter-cutoff': preset.filterCutoff,
    'filter-resonance': preset.filterResonance,
    'filter-env-amount': preset.filterEnvAmount
  };
  
  for (const [id, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const slider = document.getElementById(id);
      if (slider) {
        slider.value = value;
        slider.dispatchEvent(new Event('input'));
      }
    }
  }
  
  updateADSRVisualization();
}

/**
 * Save project state
 */
function saveProject() {
  if (!synth || !sequencer) return;
  
  const project = {
    synth: { ...synth.params },
    sequencer: sequencer.getState(),
    effects: {
      delayEnabled: document.getElementById('delay-enabled').checked,
      delayTime: parseFloat(document.getElementById('delay-time').value),
      delayFeedback: parseFloat(document.getElementById('delay-feedback').value),
      delayMix: parseFloat(document.getElementById('delay-mix').value),
      reverbEnabled: document.getElementById('reverb-enabled').checked,
      reverbDecay: parseFloat(document.getElementById('reverb-decay').value),
      reverbMix: parseFloat(document.getElementById('reverb-mix').value),
      distortionEnabled: document.getElementById('distortion-enabled').checked,
      distortionAmount: parseFloat(document.getElementById('distortion-amount').value)
    }
  };
  
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'synth-studio-project.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Handle window resize
window.addEventListener('resize', () => {
  if (visualizer) {
    visualizer.resizeCanvases();
    updateADSRVisualization();
  }
});
