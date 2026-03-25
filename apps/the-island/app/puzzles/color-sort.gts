/**
 * Color Sort Puzzle — Rainbow Bridge
 *
 * 7 color orbs shown in a scrambled row. Player clicks two orbs to swap them.
 * Goal: arrange in spectral order (ROYGBIV — red, orange, yellow, green, blue, indigo, violet).
 *
 * Each swap animates. Correct position = orb glows. All correct = bridge forms.
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface ColorSortSignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

const COLORS = [
  { hex: "#ff0000", name: "Red" },
  { hex: "#ff7700", name: "Orange" },
  { hex: "#ffdd00", name: "Yellow" },
  { hex: "#00cc00", name: "Green" },
  { hex: "#0077ff", name: "Blue" },
  { hex: "#4400cc", name: "Indigo" },
  { hex: "#8800ff", name: "Violet" },
];

export default class ColorSort extends Component<ColorSortSignature> {
  @tracked orbs: number[] = []; // indices into COLORS, scrambled
  @tracked selected: number | null = null; // index in orbs array currently selected
  @tracked solved = false;
  @tracked swaps = 0;
  @tracked message = "Swap the orbs to arrange them in rainbow order: Red → Violet";

  private canvas: HTMLCanvasElement | null = null;
  private animId: number | null = null;

  constructor(owner: unknown, args: ColorSortSignature["Args"]) {
    super(owner, args);
    this.scramble();
  }

  scramble(): void {
    // Create array [0,1,2,3,4,5,6] and shuffle
    const arr = [0, 1, 2, 3, 4, 5, 6];
    // Fisher-Yates shuffle, but ensure it's not already solved
    do {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
    } while (arr.every((v, i) => v === i));
    this.orbs = arr;
  }

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.startDrawLoop();

    const handleResize = () => this.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (this.animId) cancelAnimationFrame(this.animId);
    };
  });

  startDrawLoop(): void {
    const loop = (): void => {
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

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

    // Sky background with chasm
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = "#d4c4a8";
    ctx.font = `bold ${Math.min(w / 22, 18)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("RAINBOW FRAGMENTS", w / 2, 28);

    // Target order label
    ctx.fillStyle = "#6a6a7a";
    ctx.font = `${Math.min(w / 35, 12)}px sans-serif`;
    ctx.fillText("R  O  Y  G  B  I  V", w / 2, h - 12);

    // 7 orbs in a row
    const orbRadius = Math.min(w / 18, h / 6);
    const spacing = w / 8;
    const orbY = h * 0.5;

    for (let i = 0; i < 7; i++) {
      const ox = spacing * (i + 1);
      const colorIdx = this.orbs[i] ?? 0;
      const color = COLORS[colorIdx]!;
      const isSelected = this.selected === i;
      const isCorrect = colorIdx === i;

      // Correct position glow
      if (isCorrect) {
        ctx.globalAlpha = 0.2;
        const glow = ctx.createRadialGradient(ox, orbY, 0, ox, orbY, orbRadius * 2);
        glow.addColorStop(0, color.hex);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(ox - orbRadius * 2, orbY - orbRadius * 2, orbRadius * 4, orbRadius * 4);
        ctx.globalAlpha = 1;
      }

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ox, orbY, orbRadius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Orb body
      const orbGrad = ctx.createRadialGradient(
        ox - orbRadius * 0.3, orbY - orbRadius * 0.3, 0,
        ox, orbY, orbRadius,
      );
      orbGrad.addColorStop(0, this.lighten(color.hex, 1.4));
      orbGrad.addColorStop(0.7, color.hex);
      orbGrad.addColorStop(1, this.darken(color.hex, 0.6));
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(ox, orbY, orbRadius, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.ellipse(ox - orbRadius * 0.2, orbY - orbRadius * 0.3, orbRadius * 0.3, orbRadius * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Slot number
      ctx.fillStyle = isCorrect ? "#ffffff" : "#4a4a5a";
      ctx.font = `${orbRadius * 0.4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, ox, orbY + orbRadius + 18);

      // Checkmark for correct position
      if (isCorrect) {
        ctx.fillStyle = "#00ff00";
        ctx.font = `${orbRadius * 0.5}px sans-serif`;
        ctx.fillText("✓", ox, orbY + orbRadius + 32);
      }
    }

    // Swap counter
    ctx.fillStyle = "#8a8a9a";
    ctx.font = `${Math.min(w / 32, 13)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Swaps: ${this.swaps}`, w / 2, 50);
  }

  lighten(hex: string, factor: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) * factor);
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  }

  darken(hex: string, factor: number): string {
    return this.lighten(hex, factor);
  }

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.solved || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const orbRadius = Math.min(w / 18, rect.height / 6);
    const spacing = w / 8;
    const orbY = rect.height * 0.5;

    for (let i = 0; i < 7; i++) {
      const ox = spacing * (i + 1);
      const dist = Math.sqrt((x - ox) ** 2 + (y - orbY) ** 2);

      if (dist < orbRadius * 1.3) {
        if (this.selected === null) {
          // First selection
          this.selected = i;
        } else if (this.selected === i) {
          // Deselect
          this.selected = null;
        } else {
          // Swap!
          const newOrbs = [...this.orbs];
          const temp = newOrbs[this.selected]!;
          newOrbs[this.selected] = newOrbs[i]!;
          newOrbs[i] = temp;
          this.orbs = newOrbs;
          this.selected = null;
          this.swaps++;

          // Check if solved
          if (this.orbs.every((v, idx) => v === idx)) {
            this.solved = true;
            this.message = "The rainbow is complete! Seven colors shine as one!";
            setTimeout(() => { this.args.onSolve(); }, 2000);
          } else {
            const correct = this.orbs.filter((v, idx) => v === idx).length;
            this.message = `${correct}/7 in place. Click two orbs to swap them.`;
          }
        }
        return;
      }
    }
  };

  close = (): void => {
    this.args.onClose();
  };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 650px;">
        <canvas
          class="puzzle-canvas"
          style="width: 100%; height: 280px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}}
          {{on "click" this.handleCanvasClick}}
        ></canvas>
        <p class="puzzle-hint" style="margin-top: 0.8rem; text-align: center; color: #d4c4a8; font-size: 0.95rem;">
          {{this.message}}
        </p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>
          Step Back
        </button>
      </div>
    </div>
  </template>
}
