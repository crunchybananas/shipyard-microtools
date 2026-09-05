import {
  TRACKS,
  audible,
  rng,
  compileSong,
  songBars,
  barSeconds,
  clamp,
} from "./score.mjs";

const frequency = (note) => 440 * 2 ** ((note - 69) / 12);
const FLOOR = 0.00001;
export const TAIL_SECONDS = 6;

// Every voice has explicit audio-clock start/end times. The same graph renders WAVs.
export class SoundEngine {
  constructor(context, project, { offline = false } = {}) {
    this.ctx = context;
    this.project = project;
    this.offline = offline;
    this.nodes = new Set();
    this.disposed = false;
    this.output = context.createGain();
    this.output.gain.value = project.master * 0.76;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.18;
    this.compressor.connect(this.output);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.78;
    this.output.connect(this.analyser);
    this.analyser.connect(context.destination);
    this.scope = new Uint8Array(this.analyser.frequencyBinCount);
    this.delay = context.createDelay(2);
    this.delay.delayTime.value = (60 / project.bpm) * 0.75;
    this.feedback = context.createGain();
    this.feedback.gain.value = 0.28;
    const damp = context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3600;
    this.delay.connect(damp);
    damp.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delayReturn = context.createGain();
    this.delayReturn.gain.value = 0.46;
    this.delay.connect(this.delayReturn);
    this.delayReturn.connect(this.compressor);
    this.reverb = context.createConvolver();
    this.reverb.buffer = this.impulse();
    this.reverbReturn = context.createGain();
    this.reverbReturn.gain.value = 0.5;
    this.reverb.connect(this.reverbReturn);
    this.reverbReturn.connect(this.compressor);
    this.noise = context.createBuffer(
      1,
      context.sampleRate,
      context.sampleRate,
    );
    const random = rng(98347),
      samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
    this.buses = TRACKS.map((track, index) => {
      const gain = context.createGain(),
        filter = context.createBiquadFilter(),
        pan = context.createStereoPanner();
      const room = context.createGain(),
        echo = context.createGain();
      filter.type = "lowpass";
      filter.Q.value = index === 3 ? 0.8 : 0.5;
      gain.connect(filter);
      filter.connect(pan);
      pan.connect(this.compressor);
      pan.connect(room);
      room.connect(this.reverb);
      pan.connect(echo);
      echo.connect(this.delay);
      gain.gain.value = audible(project, index)
        ? project.tracks[index].level
        : 0;
      pan.pan.value = project.tracks[index].pan;
      return { gain, filter, pan, room, echo };
    });
    this.setMacro(0.5, 0.4, context.currentTime, true);
  }
  impulse() {
    const ctx = this.ctx,
      length = Math.floor(ctx.sampleRate * 2.8),
      buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    const random = rng(245912);
    for (let channel = 0; channel < 2; channel++) {
      const samples = buffer.getChannelData(channel);
      let previous = 0;
      for (let i = 0; i < length; i++) {
        previous = previous * 0.35 + (random() * 2 - 1) * 0.65;
        samples[i] =
          previous *
          (1 - i / length) ** 3 *
          Math.min(1, i / (ctx.sampleRate * 0.02));
      }
    }
    return buffer;
  }
  param(parameter, value, time, immediate = false) {
    if (immediate) {
      parameter.cancelScheduledValues(time);
      parameter.setValueAtTime(value, time);
    } else parameter.setTargetAtTime(value, time, 0.025);
  }
  setMacro(x, y, time = this.ctx.currentTime, immediate = false) {
    this.buses.forEach((bus, i) => {
      const tone = this.project.tracks[i].tone;
      const cutoff =
        i < 3
          ? 3500 + tone * 12500
          : i === 3
            ? 170 + x * 1500 + tone * 900
            : 380 + x * x * 11500 + tone * 1800;
      this.param(bus.filter.frequency, cutoff, time, immediate);
      this.param(
        bus.room.gain,
        i === 0 || i === 3 ? 0.018 : 0.07 + y * 0.5,
        time,
        immediate,
      );
      this.param(
        bus.echo.gain,
        i === 5
          ? 0.18 + y * 0.36
          : i === 4
            ? y * 0.13
            : i === 2
              ? y * 0.045
              : 0,
        time,
        immediate,
      );
    });
  }
  updateMix() {
    const time = this.ctx.currentTime;
    this.param(this.output.gain, this.project.master * 0.76, time);
    this.buses.forEach((bus, i) => {
      this.param(
        bus.gain.gain,
        audible(this.project, i) ? this.project.tracks[i].level : 0,
        time,
      );
      this.param(bus.pan.pan, this.project.tracks[i].pan, time);
    });
    this.param(this.delay.delayTime, (60 / this.project.bpm) * 0.75, time);
  }
  voice({
    type = "sine",
    note = 60,
    hz,
    endHz,
    time,
    length,
    attack = 0.004,
    release = 0.1,
    volume = 0.2,
    track = 0,
    detune = 0,
    pan = 0,
    noise = false,
    highpass = 0,
    cutoff = 0,
  }) {
    if (this.disposed) return;
    const ctx = this.ctx,
      source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    const gain = ctx.createGain(),
      panner = ctx.createStereoPanner();
    const local = [gain, panner];
    if (noise) source.buffer = this.noise;
    else {
      source.type = type;
      source.frequency.setValueAtTime(hz || frequency(note), time);
      source.detune.value = detune;
      if (endHz)
        source.frequency.exponentialRampToValueAtTime(
          endHz,
          time + Math.min(0.12, length),
        );
    }
    let previous = source;
    if (highpass || cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = highpass ? "highpass" : "lowpass";
      filter.frequency.value = highpass || cutoff;
      previous.connect(filter);
      previous = filter;
      local.push(filter);
    }
    previous.connect(gain);
    gain.connect(panner);
    panner.pan.value = pan;
    panner.connect(this.buses[track].gain);
    gain.gain.setValueAtTime(FLOOR, time);
    gain.gain.linearRampToValueAtTime(Math.max(FLOOR, volume), time + attack);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(FLOOR, volume * 0.32),
      time + Math.max(attack + 0.001, length),
    );
    gain.gain.exponentialRampToValueAtTime(FLOOR, time + length + release);
    this.nodes.add(source);
    source.onended = () => {
      source.disconnect();
      local.forEach((node) => node.disconnect());
      this.nodes.delete(source);
    };
    source.start(time);
    source.stop(time + length + release + 0.015);
  }
  trigger(event, time) {
    const { track, velocity: v, notes, duration } = event;
    const tone = this.project.tracks[track].tone;
    if (track === 0) {
      this.voice({
        track,
        time,
        hz: 145 + tone * 45,
        endHz: 43 + tone * 12,
        length: 0.2,
        release: 0.15,
        volume: v * 0.86,
      });
      this.voice({
        track,
        time,
        noise: true,
        highpass: 1800,
        length: 0.007,
        release: 0.008,
        volume: v * 0.08,
      });
    } else if (track === 1) {
      this.voice({
        track,
        time,
        noise: true,
        highpass: 1200 + tone * 1800,
        length: 0.055,
        release: 0.12,
        volume: v * 0.31,
      });
      this.voice({
        track,
        time,
        type: "triangle",
        hz: 180,
        endHz: 125,
        length: 0.04,
        release: 0.07,
        volume: v * 0.2,
      });
      this.voice({
        track,
        time: time + 0.012,
        noise: true,
        highpass: 2200,
        length: 0.018,
        release: 0.04,
        volume: v * 0.09,
        pan: 0.2,
      });
    } else if (track === 2) {
      this.voice({
        track,
        time,
        noise: true,
        highpass: 5700 + tone * 2200,
        length: 0.018,
        release: 0.035 + v * 0.065,
        volume: v * 0.24,
        pan: -0.12,
      });
    } else if (track === 3) {
      this.voice({
        track,
        time,
        type: "triangle",
        note: notes[0],
        length: duration,
        release: 0.09,
        volume: v * 0.48,
      });
      this.voice({
        track,
        time,
        type: "sawtooth",
        note: notes[0],
        length: duration * 0.85,
        release: 0.1,
        volume: v * (0.13 + tone * 0.12),
        detune: 4,
      });
    } else if (track === 4) {
      notes.forEach((note, i) => {
        this.voice({
          track,
          time,
          type: "triangle",
          note,
          length: duration,
          attack: 0.12,
          release: 1.35,
          volume: v * 0.15,
          detune: -7,
          pan: -0.45 + i * 0.08,
        });
        this.voice({
          track,
          time,
          type: "sawtooth",
          note,
          length: duration,
          attack: 0.18,
          release: 1.6,
          volume: v * (0.032 + tone * 0.024),
          detune: 8,
          pan: 0.45 - i * 0.08,
        });
      });
    } else {
      this.voice({
        track,
        time,
        type: "sine",
        note: notes[0],
        length: duration * 0.45,
        release: 0.48,
        volume: v * 0.45,
        pan: 0.1,
      });
      this.voice({
        track,
        time,
        type: "triangle",
        note: notes[0] + 12,
        length: duration * 0.3,
        release: 0.23,
        volume: v * 0.065,
        detune: 3,
        pan: -0.2,
      });
    }
  }
  schedule(frame, time) {
    this.setMacro(frame.macro.x, frame.macro.y, time);
    frame.events.forEach((event) => this.trigger(event, time));
  }
  spectrum() {
    this.analyser.getByteFrequencyData(this.scope);
    return this.scope;
  }
  stop() {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(0, now, 0.016);
    setTimeout(() => {
      for (const source of this.nodes) {
        try {
          source.stop();
          source.disconnect();
        } catch {}
      }
      this.nodes.clear();
      this.analyser.disconnect();
      this.output.disconnect();
      this.compressor.disconnect();
      this.delay.disconnect();
      this.feedback.disconnect();
      this.delayReturn.disconnect();
      this.reverb.disconnect();
      this.reverbReturn.disconnect();
      this.buses.forEach((bus) =>
        Object.values(bus).forEach((node) => node.disconnect()),
      );
    }, 100);
  }
}

export async function renderAudio(project, mode = "song") {
  const sampleRate = 44100,
    bars = mode === "song" ? songBars(project) : 4;
  const seconds = bars * barSeconds(project.bpm) + TAIL_SECONDS;
  const Offline =
    globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline)
    throw new Error(
      "This browser cannot render offline audio. Try a current Chrome, Safari, or Firefox.",
    );
  const context = new Offline(2, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = new SoundEngine(context, project, { offline: true });
  compileSong(project, mode).forEach((frame) =>
    engine.schedule(frame, frame.time),
  );
  const buffer = await context.startRendering();
  return { buffer, bars, seconds };
}
export function encodeWav(buffer) {
  const length = buffer.length,
    channels = buffer.numberOfChannels;
  const bytes = new ArrayBuffer(44 + length * channels * 2),
    view = new DataView(bytes);
  const string = (offset, value) =>
    [...value].forEach((letter, i) =>
      view.setUint8(offset + i, letter.charCodeAt(0)),
    );
  string(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  string(8, "WAVE");
  string(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  string(36, "data");
  view.setUint32(40, length * channels * 2, true);
  const data = Array.from({ length: channels }, (_, i) =>
    buffer.getChannelData(i),
  );
  let offset = 44;
  for (let i = 0; i < length; i++)
    for (let channel = 0; channel < channels; channel++) {
      const sample = clamp(data[channel][i], -1, 1);
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  return bytes;
}
