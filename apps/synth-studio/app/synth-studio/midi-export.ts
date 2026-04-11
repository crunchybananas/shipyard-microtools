import type { PatternData } from "./sequencer";

const TICKS_PER_QUARTER = 96;
const TICKS_PER_STEP = TICKS_PER_QUARTER / 4;
const STEPS_PER_BAR = 16;

const DRUM_NOTES: Record<string, number> = {
  kick: 36,
  snare: 38,
  hihat: 42,
  clap: 39,
};

interface MidiEvent {
  tick: number;
  data: number[];
}

function writeVarLen(value: number): number[] {
  const bytes: number[] = [];
  let v = value & 0x7f;
  bytes.unshift(v);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

function noteNameToMidi(note: string): number {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
  if (!match) return 60;
  const letter = match[1]!;
  const accidental = match[2];
  const octave = parseInt(match[3]!, 10);
  const names: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let n = names[letter]!;
  if (accidental === "#") n += 1;
  if (accidental === "b") n -= 1;
  return 12 * (octave + 1) + n;
}

function encodeTrackEvents(events: MidiEvent[]): Uint8Array {
  events.sort((a, b) => a.tick - b.tick);
  const bytes: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - lastTick);
    for (const b of writeVarLen(delta)) bytes.push(b);
    for (const b of ev.data) bytes.push(b);
    lastTick = ev.tick;
  }
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return new Uint8Array(bytes);
}

function wrapTrackChunk(body: Uint8Array): Uint8Array {
  const head = new Uint8Array(8 + body.length);
  head[0] = 0x4d;
  head[1] = 0x54;
  head[2] = 0x72;
  head[3] = 0x6b;
  const len = body.length;
  head[4] = (len >>> 24) & 0xff;
  head[5] = (len >>> 16) & 0xff;
  head[6] = (len >>> 8) & 0xff;
  head[7] = len & 0xff;
  head.set(body, 8);
  return head;
}

function pushBarEvents(
  pattern: PatternData,
  barStartTick: number,
  synthEventsByChannel: Map<number, MidiEvent[]>,
  drumEvents: MidiEvent[],
) {
  for (const [trackId, track] of Object.entries(pattern)) {
    const vel = Math.max(
      1,
      Math.min(127, Math.round(track.velocity * 127)),
    );
    if (trackId.startsWith("synth")) {
      const channel = trackId === "synth1" ? 0 : 1;
      const midiNote = noteNameToMidi(track.note ?? "C4");
      if (!synthEventsByChannel.has(channel)) {
        synthEventsByChannel.set(channel, []);
      }
      const events = synthEventsByChannel.get(channel)!;
      track.steps.forEach((on, i) => {
        if (!on) return;
        const tick = barStartTick + i * TICKS_PER_STEP;
        events.push({ tick, data: [0x90 | channel, midiNote, vel] });
        events.push({
          tick: tick + TICKS_PER_STEP - 1,
          data: [0x80 | channel, midiNote, 0],
        });
      });
    } else {
      const drumNote = DRUM_NOTES[trackId];
      if (drumNote === undefined) continue;
      track.steps.forEach((on, i) => {
        if (!on) return;
        const tick = barStartTick + i * TICKS_PER_STEP;
        drumEvents.push({ tick, data: [0x99, drumNote, vel] });
        drumEvents.push({
          tick: tick + TICKS_PER_STEP - 1,
          data: [0x89, drumNote, 0],
        });
      });
    }
  }
}

export interface MidiExportInput {
  bpm: number;
  patterns: PatternData[];
}

export function buildMidiFile(input: MidiExportInput): Uint8Array {
  const { bpm, patterns } = input;
  const microsPerQuarter = Math.max(1, Math.round(60_000_000 / bpm));

  const synthEventsByChannel = new Map<number, MidiEvent[]>();
  const drumEvents: MidiEvent[] = [];

  patterns.forEach((pat, barIdx) => {
    pushBarEvents(
      pat,
      barIdx * STEPS_PER_BAR * TICKS_PER_STEP,
      synthEventsByChannel,
      drumEvents,
    );
  });

  const tempoBody = encodeTrackEvents([
    {
      tick: 0,
      data: [
        0xff,
        0x51,
        0x03,
        (microsPerQuarter >>> 16) & 0xff,
        (microsPerQuarter >>> 8) & 0xff,
        microsPerQuarter & 0xff,
      ],
    },
  ]);

  const chunks: Uint8Array[] = [];
  chunks.push(wrapTrackChunk(tempoBody));

  const synthChannels = [...synthEventsByChannel.keys()].sort();
  for (const channel of synthChannels) {
    const events = synthEventsByChannel.get(channel)!;
    if (events.length === 0) continue;
    chunks.push(wrapTrackChunk(encodeTrackEvents(events)));
  }
  if (drumEvents.length > 0) {
    chunks.push(wrapTrackChunk(encodeTrackEvents(drumEvents)));
  }

  const ntrks = chunks.length;
  const header = new Uint8Array(14);
  header[0] = 0x4d;
  header[1] = 0x54;
  header[2] = 0x68;
  header[3] = 0x64;
  header[4] = 0;
  header[5] = 0;
  header[6] = 0;
  header[7] = 6;
  header[8] = 0;
  header[9] = 1;
  header[10] = (ntrks >>> 8) & 0xff;
  header[11] = ntrks & 0xff;
  header[12] = (TICKS_PER_QUARTER >>> 8) & 0xff;
  header[13] = TICKS_PER_QUARTER & 0xff;

  let total = header.length;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  out.set(header, 0);
  let offset = header.length;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function downloadMidi(data: Uint8Array, filename: string) {
  const ab = new ArrayBuffer(data.byteLength);
  new Uint8Array(ab).set(data);
  const blob = new Blob([ab], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── MIDI parsing ───────────────────────────────────────────────

const DRUM_NOTE_TO_TRACK: Record<number, string> = {
  35: "kick",
  36: "kick",
  38: "snare",
  40: "snare",
  39: "clap",
  42: "hihat",
  44: "hihat",
  46: "hihat",
};

const SYNTH_NOTE_NAMES: Record<number, string> = {
  0: "C", 1: "C#", 2: "D", 3: "D#", 4: "E", 5: "F",
  6: "F#", 7: "G", 8: "G#", 9: "A", 10: "A#", 11: "B",
};

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = SYNTH_NOTE_NAMES[midi % 12] ?? "C";
  return `${name}${octave}`;
}

interface ParsedEvent {
  tick: number;
  channel: number;
  type: "noteOn" | "noteOff";
  note: number;
  velocity: number;
}

interface ParsedMidi {
  ticksPerQuarter: number;
  bpm: number;
  events: ParsedEvent[];
}

class MidiReader {
  private view: DataView;
  private pos: number;

  constructor(data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.pos = 0;
  }

  readUint8(): number {
    return this.view.getUint8(this.pos++);
  }
  readUint16(): number {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }
  readUint32(): number {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }
  readString(len: number): string {
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(this.readUint8());
    return s;
  }
  readVarLen(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.readUint8();
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
    return v;
  }
  skip(n: number) {
    this.pos += n;
  }
  get position() {
    return this.pos;
  }
}

export function parseMidiFile(data: Uint8Array): ParsedMidi | null {
  try {
    const r = new MidiReader(data);
    if (r.readString(4) !== "MThd") return null;
    const headerLen = r.readUint32();
    if (headerLen < 6) return null;
    const format = r.readUint16();
    const ntrks = r.readUint16();
    const division = r.readUint16();
    if (format > 1) return null;
    if (division & 0x8000) return null; // SMPTE not supported
    const ticksPerQuarter = division;

    let bpm = 120;
    const events: ParsedEvent[] = [];

    for (let t = 0; t < ntrks; t++) {
      if (r.readString(4) !== "MTrk") return null;
      const trackLen = r.readUint32();
      const trackEnd = r.position + trackLen;
      let absTick = 0;
      let runningStatus = 0;

      while (r.position < trackEnd) {
        absTick += r.readVarLen();
        let status = r.readUint8();
        if (status < 0x80) {
          // Running status
          r.skip(-1);
          status = runningStatus;
        } else {
          runningStatus = status;
        }

        if (status === 0xff) {
          // Meta
          const metaType = r.readUint8();
          const len = r.readVarLen();
          if (metaType === 0x51 && len === 3) {
            const micros =
              (r.readUint8() << 16) | (r.readUint8() << 8) | r.readUint8();
            if (micros > 0) bpm = Math.round(60_000_000 / micros);
          } else {
            r.skip(len);
          }
        } else if (status === 0xf0 || status === 0xf7) {
          // SysEx
          const len = r.readVarLen();
          r.skip(len);
        } else {
          const high = status & 0xf0;
          const channel = status & 0x0f;
          if (high === 0x80 || high === 0x90) {
            const note = r.readUint8();
            const vel = r.readUint8();
            if (high === 0x90 && vel > 0) {
              events.push({
                tick: absTick,
                channel,
                type: "noteOn",
                note,
                velocity: vel,
              });
            } else {
              events.push({
                tick: absTick,
                channel,
                type: "noteOff",
                note,
                velocity: vel,
              });
            }
          } else if (high === 0xa0 || high === 0xb0 || high === 0xe0) {
            r.skip(2);
          } else if (high === 0xc0 || high === 0xd0) {
            r.skip(1);
          }
        }
      }

      // Ensure we're at track end
      while (r.position < trackEnd) r.readUint8();
    }

    return { ticksPerQuarter, bpm, events };
  } catch {
    return null;
  }
}

/**
 * Quantize a parsed MIDI into a 16-step pattern. Uses the first bar of
 * note-on events found; drums route by GM note, synths map to synth1/synth2
 * by channel. Pitches outside the synth track ranges are clamped.
 */
export function midiToPattern(parsed: ParsedMidi): {
  pattern: PatternData;
  bpm: number;
} {
  const pattern: PatternData = {
    synth1: { steps: new Array(16).fill(false), note: "C4", velocity: 0.8 },
    synth2: { steps: new Array(16).fill(false), note: "E3", velocity: 0.8 },
    kick: { steps: new Array(16).fill(false), velocity: 0.9 },
    snare: { steps: new Array(16).fill(false), velocity: 0.8 },
    hihat: { steps: new Array(16).fill(false), velocity: 0.6 },
    clap: { steps: new Array(16).fill(false), velocity: 0.7 },
  };

  const ticksPerStep = parsed.ticksPerQuarter / 4;
  const barTicks = ticksPerStep * 16;

  // Capture the first encountered pitch per synth channel so we set track.note
  const synthNotesSeen: Record<string, number> = {};

  for (const ev of parsed.events) {
    if (ev.type !== "noteOn") continue;
    const barPos = ev.tick % barTicks;
    const step = Math.round(barPos / ticksPerStep) % 16;
    if (ev.channel === 9) {
      const trackId = DRUM_NOTE_TO_TRACK[ev.note];
      if (trackId && pattern[trackId]) {
        pattern[trackId]!.steps[step] = true;
      }
    } else {
      const trackId = ev.channel === 0 ? "synth1" : "synth2";
      pattern[trackId]!.steps[step] = true;
      if (!(trackId in synthNotesSeen)) {
        synthNotesSeen[trackId] = ev.note;
      }
    }
  }

  for (const trackId of ["synth1", "synth2"] as const) {
    const midiNote = synthNotesSeen[trackId];
    if (midiNote !== undefined) {
      pattern[trackId]!.note = midiToNoteName(midiNote);
    }
  }

  return { pattern, bpm: parsed.bpm };
}
