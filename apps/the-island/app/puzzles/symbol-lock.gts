/**
 * Symbol Lock Puzzle — Whispering Woods
 *
 * 4 rotating dials on the owl's cage. Each dial cycles through 4 symbols:
 * moon (🌙), star (⭐), sun (☀️), tree (🌲)
 *
 * The correct combination is: star, moon, tree, sun
 * Hinted by the description: "The carvings on the stones tell a story:
 * first the star fell, then the moon wept, then the tree grew, then the sun returned."
 *
 * Click a dial to rotate it. When all 4 are correct, the cage opens.
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface SymbolLockSignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

const SYMBOLS = ["🌙", "⭐", "☀️", "🌲"];
const SYMBOL_NAMES = ["Moon", "Star", "Sun", "Tree"];
const SOLUTION = [1, 0, 3, 2]; // star, moon, tree, sun

export default class SymbolLock extends Component<SymbolLockSignature> {
  @tracked dials = [0, 0, 0, 0]; // current symbol index for each dial
  @tracked solved = false;
  @tracked shaking = false;
  @tracked hint = "The carvings whisper: \"First the star fell, then the moon wept, then the tree grew, then the sun returned.\"";

  private canvas: HTMLCanvasElement | null = null;
  private animId: number | null = null;

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.draw();

    const handleResize = () => { this.resize(); this.draw(); };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (this.animId) cancelAnimationFrame(this.animId);
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

    // Background — dark iron cage texture
    ctx.fillStyle = "#1a1820";
    ctx.fillRect(0, 0, w, h);

    // Cage bars
    ctx.strokeStyle = "#3a3840";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const x = (i / 7) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // 4 dial positions
    const dialY = h * 0.45;
    const dialSpacing = w / 5;
    const dialRadius = Math.min(w / 10, h / 5);

    for (let i = 0; i < 4; i++) {
      const cx = dialSpacing * (i + 1);
      const symbolIdx = this.dials[i] ?? 0;
      const isCorrect = symbolIdx === SOLUTION[i];
      const shake = this.shaking ? Math.sin(Date.now() * 0.05 + i) * 3 : 0;

      // Dial background
      ctx.fillStyle = isCorrect && this.solved ? "#2a4a2a" : "#2a2830";
      ctx.strokeStyle = isCorrect && this.solved ? "#4a8a4a" : "#4a4850";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx + shake, dialY, dialRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Symbol
      ctx.fillStyle = isCorrect && this.solved ? "#88ff88" : "#d4c4a8";
      ctx.font = `${dialRadius * 0.9}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(SYMBOLS[symbolIdx] ?? "?", cx + shake, dialY);

      // Dial number label
      ctx.fillStyle = "#6a6a7a";
      ctx.font = `${dialRadius * 0.3}px sans-serif`;
      ctx.fillText(`${i + 1}`, cx, dialY + dialRadius + 15);

      // "Click to rotate" arrows
      if (!this.solved) {
        ctx.fillStyle = "#5a5a6a";
        ctx.font = `${dialRadius * 0.3}px sans-serif`;
        ctx.fillText("▼", cx, dialY - dialRadius - 8);
      }
    }

    // Title
    ctx.fillStyle = "#d4c4a8";
    ctx.font = `bold ${Math.min(w / 20, 22)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("THE CAGE LOCK", w / 2, 30);

    // Instructions
    ctx.fillStyle = "#8a8a9a";
    ctx.font = `${Math.min(w / 30, 14)}px sans-serif`;
    ctx.fillText("Click each dial to rotate the symbol", w / 2, h - 15);
  }

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.solved || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const dialSpacing = w / 5;
    const dialRadius = Math.min(w / 10, rect.height / 5);
    const dialY = rect.height * 0.45;

    // Check which dial was clicked
    for (let i = 0; i < 4; i++) {
      const cx = dialSpacing * (i + 1);
      const dist = Math.sqrt((x - cx) ** 2 + (e.clientY - rect.top - dialY) ** 2);

      if (dist < dialRadius * 1.3) {
        // Rotate this dial
        const newDials = [...this.dials];
        newDials[i] = ((newDials[i] ?? 0) + 1) % SYMBOLS.length;
        this.dials = newDials;
        this.draw();

        // Check solution
        this.checkSolution();
        return;
      }
    }
  };

  checkSolution(): void {
    const correct = this.dials.every((d, i) => d === SOLUTION[i]);
    if (correct) {
      this.solved = true;
      this.hint = "The lock clicks open! The symbols align!";
      this.draw();
      setTimeout(() => {
        this.args.onSolve();
      }, 1500);
    } else {
      // Check if all dials have been moved (attempted a full solution)
      const allMoved = this.dials.every(d => d !== 0);
      if (allMoved) {
        // Shake feedback for wrong combination
        this.shaking = true;
        this.hint = "The lock resists. That's not the right combination...";
        this.draw();
        setTimeout(() => {
          this.shaking = false;
          this.draw();
        }, 500);
      }
    }
  }

  close = (): void => {
    this.args.onClose();
  };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 600px;">
        <canvas
          class="puzzle-canvas"
          style="width: 100%; height: 280px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}}
          {{on "click" this.handleCanvasClick}}
        ></canvas>
        <p class="puzzle-hint" style="margin-top: 1rem; font-style: italic; text-align: center; color: #d4c4a8;">
          {{this.hint}}
        </p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>
          Step Back
        </button>
      </div>
    </div>
  </template>
}
