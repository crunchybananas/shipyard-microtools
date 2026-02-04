import { Synthesizer } from "./synth";
import { EffectsChain } from "./effects";
import { DrumMachine } from "./drums";
import { Sequencer } from "./sequencer";
import { Visualizer } from "./visualizer";

let audioContext: AudioContext | null = null;
let synth: Synthesizer | null = null;
let effects: EffectsChain | null = null;
let drums: DrumMachine | null = null;
let sequencer: Sequencer | null = null;
let visualizer: Visualizer | null = null;
let masterGain: GainNode | null = null;
let isAudioInitialized = false;

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let isRecording = false;

const KEY_MAP: Record<string, string> = {
  a: "C3",
  w: "C#3",
  s: "D3",
  e: "D#3",
  d: "E3",
  f: "F3",
  t: "F#3",
  g: "G3",
  y: "G#3",
  h: "A3",
  u: "A#3",
  j: "B3",
  k: "C4",
  o: "C#4",
  l: "D4",
  p: "D#4",
  ";": "E4",
  "'": "F4",
};

const PRESETS: Record<string, Record<string, number | string>> = {
  bass: {
    waveform: "sawtooth",
    octave: -1,
    detune: 0,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.6,
    release: 0.3,
    filterCutoff: 400,
    filterResonance: 5,
    filterEnvAmount: 2000,
  },
  lead: {
    waveform: "square",
    octave: 0,
    detune: 10,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.8,
    release: 0.2,
    filterCutoff: 2000,
    filterResonance: 2,
    filterEnvAmount: 500,
  },
  pad: {
    waveform: "sine",
    octave: 0,
    detune: 5,
    attack: 0.5,
    decay: 0.3,
    sustain: 0.7,
    release: 1.0,
    filterCutoff: 1000,
    filterResonance: 1,
    filterEnvAmount: 0,
  },
  pluck: {
    waveform: "triangle",
    octave: 0,
    detune: 0,
    attack: 0.001,
    decay: 0.3,
    sustain: 0,
    release: 0.2,
    filterCutoff: 3000,
    filterResonance: 3,
    filterEnvAmount: 5000,
  },
  brass: {
    waveform: "sawtooth",
    octave: 0,
    detune: 15,
    attack: 0.08,
    decay: 0.2,
    sustain: 0.6,
    release: 0.15,
    filterCutoff: 1500,
    filterResonance: 2,
    filterEnvAmount: 3000,
  },
  strings: {
    waveform: "sawtooth",
    octave: 0,
    detune: 8,
    attack: 0.3,
    decay: 0.1,
    sustain: 0.9,
    release: 0.5,
    filterCutoff: 2500,
    filterResonance: 1,
    filterEnvAmount: 0,
  },
};

let initialized = false;

export function initializeSynthStudio(_element: HTMLElement) {
  if (initialized) return;
  initialized = true;

  setupKeyboard();
  setupSequencerGrid();
  setupStepIndicator();
  setupControls();
  setupKeyboardInput();

  document.body.addEventListener(
    "click",
    async () => {
      await initAudio();
      await resumeAudio();
    },
    { once: true }
  );

  document.body.addEventListener(
    "keydown",
    async () => {
      await initAudio();
      await resumeAudio();
    },
    { once: true }
  );
}

async function initAudio() {
  if (isAudioInitialized) return;

  try {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.7;

    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    synth = new Synthesizer(audioContext);
    effects = new EffectsChain(audioContext);
    drums = new DrumMachine(audioContext);
    sequencer = new Sequencer(audioContext);
    visualizer = new Visualizer(audioContext);

    synth.connect(effects.input);
    effects.connect(masterGain);
    drums.connect(masterGain);

    masterGain.connect(limiter);
    limiter.connect(visualizer.getInput());
    visualizer.getInput().connect(audioContext.destination);

    visualizer.init(
      document.getElementById("waveform-canvas") as HTMLCanvasElement,
      document.getElementById("spectrum-canvas") as HTMLCanvasElement,
      document.getElementById("adsr-canvas") as HTMLCanvasElement
    );

    sequencer.onSynthTrigger = (note, velocity) => {
      synth?.noteOn(note, velocity);
      setTimeout(() => synth?.noteOff(note), 150);
    };

    sequencer.onDrumTrigger = (drumType, velocity, time) => {
      drums?.play(drumType, velocity, time);
    };

    sequencer.onStep = (step) => {
      updateStepIndicator(step);
    };

    isAudioInitialized = true;
    updateADSRVisualization();
  } catch (error) {
    console.error("Failed to initialize audio:", error);
  }
}

async function resumeAudio() {
  if (audioContext && audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function setupKeyboard() {
  const keyboard = document.getElementById("keyboard");
  if (!keyboard) return;

  const notes = [
    { note: "C3", white: true, key: "A" },
    { note: "C#3", white: false, key: "W" },
    { note: "D3", white: true, key: "S" },
    { note: "D#3", white: false, key: "E" },
    { note: "E3", white: true, key: "D" },
    { note: "F3", white: true, key: "F" },
    { note: "F#3", white: false, key: "T" },
    { note: "G3", white: true, key: "G" },
    { note: "G#3", white: false, key: "Y" },
    { note: "A3", white: true, key: "H" },
    { note: "A#3", white: false, key: "U" },
    { note: "B3", white: true, key: "J" },
    { note: "C4", white: true, key: "K" },
    { note: "C#4", white: false, key: "O" },
    { note: "D4", white: true, key: "L" },
    { note: "D#4", white: false, key: "P" },
    { note: "E4", white: true, key: ";" },
  ];

  let whiteKeyIndex = 0;
  const whiteKeyWidth = 100 / notes.filter((note) => note.white).length;

  notes.forEach((noteInfo) => {
    const key = document.createElement("div");
    key.className = noteInfo.white ? "white-key" : "black-key";
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
      const offset = (whiteKeyIndex - 1) * whiteKeyWidth + whiteKeyWidth * 0.7;
      key.style.left = `${offset}%`;
    }

    key.addEventListener("mousedown", (event) => {
      event.preventDefault();
      playNote(noteInfo.note);
      key.classList.add("active");
    });

    key.addEventListener("mouseup", () => {
      stopNote(noteInfo.note);
      key.classList.remove("active");
    });

    key.addEventListener("mouseleave", () => {
      if (key.classList.contains("active")) {
        stopNote(noteInfo.note);
        key.classList.remove("active");
      }
    });

    key.addEventListener("touchstart", (event) => {
      event.preventDefault();
      playNote(noteInfo.note);
      key.classList.add("active");
    });

    key.addEventListener("touchend", () => {
      stopNote(noteInfo.note);
      key.classList.remove("active");
    });

    keyboard.appendChild(key);
  });
}

function setupKeyboardInput() {
  const activeKeys = new Set<string>();

  document.addEventListener("keydown", async (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (activeKeys.has(key)) return;

    if (KEY_MAP[key]) {
      event.preventDefault();
      activeKeys.add(key);
      playNote(KEY_MAP[key]);
      highlightKey(KEY_MAP[key], true);
    }

    if (key === "z" && synth) {
      const octave = Math.max(-2, synth.params.octave - 1);
      synth.setParam("octave", octave);
      const octaveSlider = document.getElementById("octave") as HTMLInputElement | null;
      const octaveValue = document.getElementById("octave-value");
      if (octaveSlider) octaveSlider.value = octave.toString();
      if (octaveValue) octaveValue.textContent = octave.toString();
    }

    if (key === "x" && synth) {
      const octave = Math.min(2, synth.params.octave + 1);
      synth.setParam("octave", octave);
      const octaveSlider = document.getElementById("octave") as HTMLInputElement | null;
      const octaveValue = document.getElementById("octave-value");
      if (octaveSlider) octaveSlider.value = octave.toString();
      if (octaveValue) octaveValue.textContent = octave.toString();
    }

    if (key === " ") {
      event.preventDefault();
      togglePlayback();
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if (KEY_MAP[key]) {
      activeKeys.delete(key);
      stopNote(KEY_MAP[key]);
      highlightKey(KEY_MAP[key], false);
    }
  });
}

function highlightKey(note: string, active: boolean) {
  const key = document.querySelector(`[data-note="${note}"]`);
  if (key) {
    key.classList.toggle("active", active);
  }
}

function playNote(note: string) {
  synth?.noteOn(note, 0.8);
}

function stopNote(note: string) {
  synth?.noteOff(note);
}

function setupSequencerGrid() {
  const tracks = document.querySelectorAll(".seq-track");

  tracks.forEach((track) => {
    const trackId = (track as HTMLElement).dataset.track as string;
    const stepsContainer = track.querySelector(".track-steps");
    if (!stepsContainer) return;

    for (let i = 0; i < 16; i++) {
      const step = document.createElement("div");
      step.className = "step";
      step.dataset.step = i.toString();

      step.addEventListener("click", () => {
        if (!sequencer) return;
        const isActive = sequencer.toggleStep(trackId, i);
        step.classList.toggle("active", isActive);
      });

      stepsContainer.appendChild(step);
    }

    const noteSelect = track.querySelector(".track-note") as HTMLSelectElement | null;
    if (noteSelect) {
      noteSelect.addEventListener("change", () => {
        if (!sequencer) return;
        sequencer.setTrackNote(trackId, noteSelect.value);
      });
    }
  });
}

function setupStepIndicator() {
  const indicator = document.getElementById("step-indicator");
  if (!indicator) return;

  for (let i = 0; i < 16; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.dataset.step = i.toString();
    indicator.appendChild(dot);
  }
}

function updateStepIndicator(step: number) {
  const dots = document.querySelectorAll(".step-indicator .dot");
  const steps = document.querySelectorAll(".step");

  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === step);
  });

  steps.forEach((stepEl) => {
    const stepIndex = parseInt((stepEl as HTMLElement).dataset.step ?? "0", 10);
    stepEl.classList.toggle("current", stepIndex === step);
  });
}

function setupControls() {
  document.querySelectorAll(".wave-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".wave-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (synth) synth.setParam("waveform", (btn as HTMLElement).dataset.wave ?? "sine");
    });
  });

  setupSlider("octave", "octave", (value) => value, 0);
  setupSlider("detune", "detune", (value) => value, 0);

  setupSlider("filter-cutoff", "filterCutoff", (value) => `${Math.round(value)} Hz`);
  setupSlider("filter-resonance", "filterResonance", (value) => value.toFixed(1));
  setupSlider("filter-env-amount", "filterEnvAmount", (value) => Math.round(value));

  setupSlider("attack", "attack", (value) => `${Math.round(value * 1000)}ms`);
  setupSlider("decay", "decay", (value) => `${Math.round(value * 1000)}ms`);
  setupSlider("sustain", "sustain", (value) => `${Math.round(value * 100)}%`);
  setupSlider("release", "release", (value) => `${Math.round(value * 1000)}ms`);

  setupSlider("lfo-rate", "lfoRate", (value) => `${value.toFixed(1)} Hz`);
  setupSlider("lfo-depth", "lfoDepth", (value) => Math.round(value));

  document.querySelectorAll(".lfo-target-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lfo-target-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (synth) synth.setParam("lfoTarget", (btn as HTMLElement).dataset.target ?? "none");
    });
  });

  const masterSlider = document.getElementById("master-volume") as HTMLInputElement | null;
  masterSlider?.addEventListener("input", () => {
    const value = parseFloat(masterSlider.value);
    if (masterGain) masterGain.gain.value = value;
    const display = document.getElementById("master-volume-value");
    if (display) display.textContent = `${Math.round(value * 100)}%`;
  });

  setupEffectControls();

  document.querySelectorAll(".viz-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".viz-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (visualizer) {
        visualizer.setMode(((btn as HTMLElement).dataset.viz ?? "waveform") as "waveform" | "spectrum");
      }
    });
  });

  const bpmInput = document.getElementById("bpm") as HTMLInputElement | null;
  bpmInput?.addEventListener("change", () => {
    if (sequencer) sequencer.setBPM(parseInt(bpmInput.value, 10));
  });

  const swingSlider = document.getElementById("swing") as HTMLInputElement | null;
  swingSlider?.addEventListener("input", () => {
    if (sequencer) sequencer.setSwing(parseFloat(swingSlider.value));
  });

  document.getElementById("play-btn")?.addEventListener("click", togglePlayback);
  document.getElementById("stop-btn")?.addEventListener("click", stopPlayback);
  document.getElementById("record-btn")?.addEventListener("click", toggleRecording);

  const presetSelect = document.getElementById("preset-select") as HTMLSelectElement | null;
  presetSelect?.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    if (target.value && PRESETS[target.value]) {
      loadPreset(PRESETS[target.value]);
    }
  });

  document.getElementById("export-btn")?.addEventListener("click", exportWAV);
  document.getElementById("save-btn")?.addEventListener("click", saveProject);

  setInterval(updateLevelMeter, 50);
}

function setupSlider(
  id: string,
  param: string,
  format: (value: number) => string | number,
  _defaultVal: number | null = null
) {
  const slider = document.getElementById(id) as HTMLInputElement | null;
  const valueDisplay = document.getElementById(`${id}-value`);

  slider?.addEventListener("input", () => {
    const value = parseFloat(slider.value);
    if (synth) synth.setParam(param, value);
    if (valueDisplay) valueDisplay.textContent = String(format(value));

    if (["attack", "decay", "sustain", "release"].includes(param)) {
      updateADSRVisualization();
    }
  });
}

function setupEffectControls() {
  const delayEnabled = document.getElementById("delay-enabled") as HTMLInputElement | null;
  delayEnabled?.addEventListener("change", () => {
    if (effects) effects.setDelayEnabled(delayEnabled.checked);
  });

  ["delay-time", "delay-feedback", "delay-mix"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateDelay);
  });

  const reverbEnabled = document.getElementById("reverb-enabled") as HTMLInputElement | null;
  reverbEnabled?.addEventListener("change", () => {
    if (effects) effects.setReverbEnabled(reverbEnabled.checked);
  });

  ["reverb-decay", "reverb-mix"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateReverb);
  });

  const distortionEnabled = document.getElementById("distortion-enabled") as HTMLInputElement | null;
  distortionEnabled?.addEventListener("change", () => {
    if (effects) effects.setDistortionEnabled(distortionEnabled.checked);
  });

  document.getElementById("distortion-amount")?.addEventListener("input", () => {
    const amount = parseFloat(
      (document.getElementById("distortion-amount") as HTMLInputElement).value
    );
    if (effects) effects.setDistortionAmount(amount);
  });
}

function updateDelay() {
  if (!effects) return;
  const time = parseFloat((document.getElementById("delay-time") as HTMLInputElement).value);
  const feedback = parseFloat(
    (document.getElementById("delay-feedback") as HTMLInputElement).value
  );
  const mix = parseFloat((document.getElementById("delay-mix") as HTMLInputElement).value);
  effects.setDelayParams(time, feedback, mix);
}

function updateReverb() {
  if (!effects) return;
  const decay = parseFloat((document.getElementById("reverb-decay") as HTMLInputElement).value);
  const mix = parseFloat((document.getElementById("reverb-mix") as HTMLInputElement).value);
  effects.setReverbParams(decay, mix);
}

function updateADSRVisualization() {
  if (!visualizer) return;

  const attack = parseFloat((document.getElementById("attack") as HTMLInputElement).value);
  const decay = parseFloat((document.getElementById("decay") as HTMLInputElement).value);
  const sustain = parseFloat((document.getElementById("sustain") as HTMLInputElement).value);
  const release = parseFloat((document.getElementById("release") as HTMLInputElement).value);

  visualizer.drawADSR(attack, decay, sustain, release);
}

function updateLevelMeter() {
  if (!visualizer) return;
  const level = visualizer.getPeakLevel();
  const meter = document.getElementById("meter-bar") as HTMLDivElement | null;
  if (meter) meter.style.width = `${level * 100}%`;
}

function togglePlayback() {
  if (!sequencer) return;

  const playBtn = document.getElementById("play-btn") as HTMLButtonElement | null;

  if (sequencer.isPlaying) {
    sequencer.stop();
    playBtn?.classList.remove("playing");
    if (playBtn) playBtn.textContent = "▶";
  } else {
    sequencer.start();
    playBtn?.classList.add("playing");
    if (playBtn) playBtn.textContent = "⏸";
  }
}

function stopPlayback() {
  if (!sequencer) return;

  sequencer.stop();
  const playBtn = document.getElementById("play-btn");
  playBtn?.classList.remove("playing");
  if (playBtn) playBtn.textContent = "▶";

  document.querySelectorAll(".step").forEach((step) => step.classList.remove("current"));
  document.querySelectorAll(".step-indicator .dot").forEach((dot) => dot.classList.remove("active"));
}

async function toggleRecording() {
  if (!audioContext || !masterGain) return;

  const recordBtn = document.getElementById("record-btn");
  const indicator = document.getElementById("recording-indicator");

  if (isRecording) {
    mediaRecorder?.stop();
    recordBtn?.classList.remove("recording");
    indicator?.classList.add("hidden");
    isRecording = false;
  } else {
    try {
      const dest = audioContext.createMediaStreamDestination();
      masterGain.connect(dest);

      mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm",
      });

      recordedChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "synth-studio-recording.webm";
        link.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      recordBtn?.classList.add("recording");
      indicator?.classList.remove("hidden");
      isRecording = true;
    } catch (error) {
      console.error("Recording failed:", error);
    }
  }
}

async function exportWAV() {
  if (!audioContext || !sequencer || !synth || !effects || !drums) return;

  const duration = (60 / sequencer.bpm) * 4;
  const sampleRate = audioContext.sampleRate;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  const offlineSynth = new Synthesizer(offlineCtx);
  const offlineDrums = new DrumMachine(offlineCtx);
  const offlineEffects = new EffectsChain(offlineCtx);
  const offlineMaster = offlineCtx.createGain();
  offlineMaster.gain.value = 0.7;

  Object.assign(offlineSynth.params, synth.params);

  offlineSynth.connect(offlineEffects.input);
  offlineEffects.connect(offlineMaster);
  offlineDrums.connect(offlineMaster);
  offlineMaster.connect(offlineCtx.destination);

  const delayEnabled = (document.getElementById("delay-enabled") as HTMLInputElement).checked;
  offlineEffects.setDelayEnabled(delayEnabled);
  offlineEffects.setDelayParams(
    parseFloat((document.getElementById("delay-time") as HTMLInputElement).value),
    parseFloat((document.getElementById("delay-feedback") as HTMLInputElement).value),
    parseFloat((document.getElementById("delay-mix") as HTMLInputElement).value)
  );
  const reverbEnabled = (document.getElementById("reverb-enabled") as HTMLInputElement).checked;
  offlineEffects.setReverbEnabled(reverbEnabled);
  offlineEffects.setReverbParams(
    parseFloat((document.getElementById("reverb-decay") as HTMLInputElement).value),
    parseFloat((document.getElementById("reverb-mix") as HTMLInputElement).value)
  );

  const stepDuration = 60 / sequencer.bpm / 4;
  const totalSteps = 64;

  for (let step = 0; step < totalSteps; step++) {
    const time = step * stepDuration;
    const patternStep = step % 16;

    for (const [trackId, track] of Object.entries(sequencer.tracks)) {
      if (track.steps[patternStep]) {
        if (trackId.startsWith("synth") && track.note) {
          offlineSynth.noteOn(track.note, track.velocity);
        } else {
          offlineDrums.play(trackId, track.velocity, time);
        }
      }
    }
  }

  const buffer = await offlineCtx.startRendering();

  const wav = audioBufferToWav(buffer);
  const blob = new Blob([wav], { type: "audio/wav" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "synth-studio-export.wav";
  link.click();
  URL.revokeObjectURL(url);
}

function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function loadPreset(preset: Record<string, number | string>) {
  if (!synth) return;

  for (const [key, value] of Object.entries(preset)) {
    synth.setParam(key, value);
  }

  if (preset.waveform) {
    document.querySelectorAll(".wave-btn").forEach((btn) => {
      btn.classList.toggle("active", (btn as HTMLElement).dataset.wave === preset.waveform);
    });
  }

  const updates: Record<string, number | string> = {
    octave: preset.octave,
    detune: preset.detune,
    attack: preset.attack,
    decay: preset.decay,
    sustain: preset.sustain,
    release: preset.release,
    "filter-cutoff": preset.filterCutoff,
    "filter-resonance": preset.filterResonance,
    "filter-env-amount": preset.filterEnvAmount,
  };

  for (const [id, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const slider = document.getElementById(id) as HTMLInputElement | null;
      if (slider) {
        slider.value = String(value);
        slider.dispatchEvent(new Event("input"));
      }
    }
  }

  updateADSRVisualization();
}

function saveProject() {
  if (!synth || !sequencer) return;

  const project = {
    synth: { ...synth.params },
    sequencer: sequencer.getState(),
    effects: {
      delayEnabled: (document.getElementById("delay-enabled") as HTMLInputElement).checked,
      delayTime: parseFloat((document.getElementById("delay-time") as HTMLInputElement).value),
      delayFeedback: parseFloat(
        (document.getElementById("delay-feedback") as HTMLInputElement).value
      ),
      delayMix: parseFloat((document.getElementById("delay-mix") as HTMLInputElement).value),
      reverbEnabled: (document.getElementById("reverb-enabled") as HTMLInputElement).checked,
      reverbDecay: parseFloat((document.getElementById("reverb-decay") as HTMLInputElement).value),
      reverbMix: parseFloat((document.getElementById("reverb-mix") as HTMLInputElement).value),
      distortionEnabled: (document.getElementById("distortion-enabled") as HTMLInputElement).checked,
      distortionAmount: parseFloat(
        (document.getElementById("distortion-amount") as HTMLInputElement).value
      ),
    },
  };

  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "synth-studio-project.json";
  link.click();
  URL.revokeObjectURL(url);
}

window.addEventListener("resize", () => {
  if (visualizer) {
    visualizer.resizeCanvases();
    updateADSRVisualization();
  }
});
