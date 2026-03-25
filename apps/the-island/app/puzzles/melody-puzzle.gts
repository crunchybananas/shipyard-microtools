/**
 * Melody Puzzle — Wizard's Tower
 *
 * A music box with 5 colored keys. The box plays a melody,
 * then the player must repeat it. Wrong note = restart.
 * Each round adds one more note (Simon Says style).
 *
 * Uses Web Audio API for real sound.
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type MusicEngineService from "the-island/services/music-engine";

interface MelodyPuzzleSignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

const NOTES = [
  { freq: 523.25, color: "#e74c3c", name: "C", label: "Do" },   // red
  { freq: 587.33, color: "#f39c12", name: "D", label: "Re" },   // orange
  { freq: 659.25, color: "#2ecc71", name: "E", label: "Mi" },   // green
  { freq: 783.99, color: "#3498db", name: "G", label: "Sol" },  // blue
  { freq: 880.00, color: "#9b59b6", name: "A", label: "La" },   // purple
];

// The melody to learn: C, E, G, E, A (a simple ascending pattern with a twist)
const MELODY = [0, 2, 3, 2, 4];

export default class MelodyPuzzle extends Component<MelodyPuzzleSignature> {
  @service declare musicEngine: MusicEngineService;

  @tracked phase: "listen" | "play" | "wrong" | "solved" = "listen";
  @tracked currentRound = 1; // how many notes revealed so far
  @tracked playerInput: number[] = [];
  @tracked activeKey: number | null = null; // which key is lit up
  @tracked message = "Listen to the melody...";

  private audioCtx: AudioContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.draw();

    // Start playing the first note after a brief delay
    setTimeout(() => this.playSequence(), 800);

    const handleResize = () => { this.resize(); this.draw(); };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (this.playbackTimer) clearTimeout(this.playbackTimer);
    };
  });

  resize(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    const ctx = this.canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
  }

  draw(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Background — music box wood
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(0, 0, w, h);

    // Decorative border
    ctx.strokeStyle = "#4a3020";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Title
    ctx.fillStyle = "#d4c4a8";
    ctx.font = `bold ${Math.min(w / 18, 20)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("THE MUSIC BOX", w / 2, 35);

    // Round indicator
    ctx.fillStyle = "#8a7a60";
    ctx.font = `${Math.min(w / 28, 14)}px sans-serif`;
    ctx.fillText(`Round ${this.currentRound} of ${MELODY.length}`, w / 2, 55);

    // 5 colored keys
    const keyWidth = w / 7;
    const keyHeight = h * 0.45;
    const keyY = h * 0.35;
    const keySpacing = w / 6;

    for (let i = 0; i < NOTES.length; i++) {
      const note = NOTES[i]!;
      const kx = keySpacing * (i + 0.5);
      const isActive = this.activeKey === i;
      const isDisabled = this.phase === "listen";

      // Key shadow
      ctx.fillStyle = "#1a0a05";
      ctx.fillRect(kx - keyWidth / 2 + 3, keyY + 3, keyWidth, keyHeight);

      // Key body
      const brightness = isActive ? 1.4 : isDisabled ? 0.5 : 0.8;
      ctx.fillStyle = this.adjustBrightness(note.color, brightness);
      ctx.fillRect(kx - keyWidth / 2, keyY, keyWidth, keyHeight);

      // Key highlight when active
      if (isActive) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(kx - keyWidth / 2, keyY, keyWidth, keyHeight * 0.3);

        // Glow
        ctx.shadowColor = note.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = "transparent";
        ctx.fillRect(kx - keyWidth / 2, keyY, keyWidth, keyHeight);
        ctx.shadowBlur = 0;
      }

      // Key border
      ctx.strokeStyle = isActive ? "#ffffff" : "#3a2a20";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(kx - keyWidth / 2, keyY, keyWidth, keyHeight);

      // Note label
      ctx.fillStyle = isActive ? "#ffffff" : "#8a7a60";
      ctx.font = `bold ${Math.min(keyWidth * 0.35, 18)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(note.label, kx, keyY + keyHeight - 15);
    }

    // Progress dots showing which notes in the melody are revealed
    const dotY = h - 20;
    for (let i = 0; i < MELODY.length; i++) {
      const dx = w / 2 + (i - 2) * 20;
      ctx.fillStyle = i < this.currentRound ? "#ffd700" : "#3a3030";
      ctx.beginPath();
      ctx.arc(dx, dotY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  adjustBrightness(hex: string, factor: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) * factor);
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  }

  // ============================================
  // PLAYBACK — play the melody for current round
  // ============================================

  playSequence(): void {
    this.phase = "listen";
    this.message = "Listen...";
    this.playerInput = [];
    this.draw();

    const sequence = MELODY.slice(0, this.currentRound);
    let i = 0;

    const playNext = (): void => {
      if (i >= sequence.length) {
        // Done playing — player's turn
        setTimeout(() => {
          this.phase = "play";
          this.message = "Your turn! Repeat the melody.";
          this.draw();
        }, 400);
        return;
      }

      const noteIdx = sequence[i]!;
      this.activeKey = noteIdx;
      this.playTone(NOTES[noteIdx]!.freq);
      this.draw();

      this.playbackTimer = setTimeout(() => {
        this.activeKey = null;
        this.draw();
        i++;
        this.playbackTimer = setTimeout(playNext, 250);
      }, 500);
    };

    playNext();
  }

  // ============================================
  // PLAYER INPUT
  // ============================================

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.phase !== "play" || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const keyWidth = w / 7;
    const keyHeight = h * 0.45;
    const keyY = h * 0.35;
    const keySpacing = w / 6;

    // Which key was clicked?
    if (y < keyY || y > keyY + keyHeight) return;

    for (let i = 0; i < NOTES.length; i++) {
      const kx = keySpacing * (i + 0.5);
      if (x >= kx - keyWidth / 2 && x <= kx + keyWidth / 2) {
        this.handleNotePress(i);
        return;
      }
    }
  };

  handleNotePress(noteIdx: number): void {
    // Light up and play
    this.activeKey = noteIdx;
    this.playTone(NOTES[noteIdx]!.freq);
    this.draw();

    setTimeout(() => {
      this.activeKey = null;
      this.draw();
    }, 300);

    // Check against expected
    const expectedIdx = this.playerInput.length;
    const expected = MELODY[expectedIdx];

    if (noteIdx !== expected) {
      // WRONG!
      this.phase = "wrong";
      this.message = "Wrong note! Listen again...";
      this.playerInput = [];
      this.draw();

      setTimeout(() => {
        this.playSequence();
      }, 1500);
      return;
    }

    // Correct note
    this.playerInput = [...this.playerInput, noteIdx];

    if (this.playerInput.length === this.currentRound) {
      // Completed this round!
      if (this.currentRound >= MELODY.length) {
        // SOLVED!
        this.phase = "solved";
        this.message = "The melody is complete! The music box sings!";
        this.draw();
        setTimeout(() => {
          this.args.onSolve();
        }, 2000);
      } else {
        // Next round — reveal one more note
        this.currentRound++;
        this.message = `Correct! Round ${this.currentRound}...`;
        this.draw();
        setTimeout(() => {
          this.playSequence();
        }, 1000);
      }
    }
  }

  // ============================================
  // AUDIO
  // ============================================

  playTone(freq: number): void {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === "suspended") {
        void this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;

      // Bell-like envelope
      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.5);
    } catch {
      // Audio not available
    }
  }

  close = (): void => {
    if (this.playbackTimer) clearTimeout(this.playbackTimer);
    this.args.onClose();
  };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 650px;">
        <canvas
          class="puzzle-canvas"
          style="width: 100%; height: 300px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}}
          {{on "click" this.handleCanvasClick}}
        ></canvas>
        <p class="puzzle-hint" style="margin-top: 1rem; text-align: center; color: #d4c4a8; font-size: 1.05rem;">
          {{this.message}}
        </p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>
          Step Back
        </button>
      </div>
    </div>
  </template>
}
