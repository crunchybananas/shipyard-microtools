/**
 * Rune Trace Puzzle — Starfall Lake
 *
 * A target rune pattern (5 dots connected by lines) is shown faintly.
 * Player must click the dots in the correct order to trace the rune.
 * Wrong dot = reset the trace. Must complete the full pattern.
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface RuneTraceSignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

// The rune is a simple "warmth" symbol — like a stylized flame/arrow
// 5 points connected in sequence
const RUNE_POINTS = [
  { x: 0.5, y: 0.85 },   // 0: bottom center (start)
  { x: 0.3, y: 0.55 },   // 1: left mid
  { x: 0.5, y: 0.25 },   // 2: top center (peak)
  { x: 0.7, y: 0.55 },   // 3: right mid
  { x: 0.5, y: 0.45 },   // 4: inner center (end)
];

const CORRECT_ORDER = [0, 1, 2, 3, 4]; // trace from bottom up, around, and to center

export default class RuneTrace extends Component<RuneTraceSignature> {
  @tracked traced: number[] = []; // indices of dots clicked in order
  @tracked wrongFlash = false;
  @tracked solved = false;
  @tracked attempts = 0;
  @tracked message = "Trace the rune of warmth. Click the dots in order, starting from the bottom.";

  private canvas: HTMLCanvasElement | null = null;
  private animId: number | null = null;

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.startLoop();
    const handleResize = () => this.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (this.animId) cancelAnimationFrame(this.animId);
    };
  });

  startLoop(): void {
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
    this.canvas.getContext("2d")?.scale(dpr, dpr);
  }

  draw(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const t = Date.now() * 0.001;

    ctx.clearRect(0, 0, w, h);

    // Frozen lake background
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, w, h);

    // Ice texture
    ctx.strokeStyle = "#1a2a3a";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.sin(i * 2.3) * w * 0.3 + w * 0.5, 0);
      ctx.lineTo(Math.sin(i * 2.3 + 1) * w * 0.3 + w * 0.5, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = "#a0b8d0";
    ctx.font = `bold ${Math.min(w / 22, 18)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("RUNE OF WARMTH", w / 2, 28);

    // Draw target rune pattern (faint guide)
    ctx.strokeStyle = "#2a3a4a";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i < RUNE_POINTS.length; i++) {
      const p = RUNE_POINTS[i]!;
      const px = p.x * w;
      const py = p.y * (h - 60) + 45;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw traced lines (bright)
    if (this.traced.length > 1) {
      ctx.strokeStyle = this.wrongFlash ? "#ff4444" : "#ffd700";
      ctx.lineWidth = 3;
      ctx.shadowColor = this.wrongFlash ? "#ff4444" : "#ffd700";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < this.traced.length; i++) {
        const idx = this.traced[i]!;
        const p = RUNE_POINTS[idx]!;
        const px = p.x * w;
        const py = p.y * (h - 60) + 45;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw dots
    for (let i = 0; i < RUNE_POINTS.length; i++) {
      const p = RUNE_POINTS[i]!;
      const px = p.x * w;
      const py = p.y * (h - 60) + 45;
      const isTraced = this.traced.includes(i);
      const isNext = i === CORRECT_ORDER[this.traced.length];
      const dotR = Math.min(w, h) * 0.035;

      // Outer ring
      ctx.strokeStyle = isTraced ? "#ffd700" : isNext ? "#4a6a8a" : "#2a3a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, dotR + 4, 0, Math.PI * 2);
      ctx.stroke();

      // Dot body
      ctx.fillStyle = isTraced ? "#ffd700" : "#3a4a5a";
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Pulse on next dot
      if (isNext && !this.solved) {
        const pulse = Math.sin(t * 3) * 0.3 + 0.7;
        ctx.globalAlpha = 0.3 * pulse;
        ctx.fillStyle = "#6a9aba";
        ctx.beginPath();
        ctx.arc(px, py, dotR + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Number label
      ctx.fillStyle = isTraced ? "#ffffff" : "#5a6a7a";
      ctx.font = `bold ${dotR * 0.9}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, px, py);
    }

    // Progress
    ctx.fillStyle = "#6a7a8a";
    ctx.font = `${Math.min(w / 35, 12)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${this.traced.length}/${RUNE_POINTS.length} points traced`, w / 2, h - 10);
  }

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.solved || this.wrongFlash || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const dotR = Math.min(w, h) * 0.035;

    for (let i = 0; i < RUNE_POINTS.length; i++) {
      const p = RUNE_POINTS[i]!;
      const px = p.x * w;
      const py = p.y * (h - 60) + 45;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

      if (dist < dotR + 12) {
        // Check if this is the correct next dot
        const expectedIdx = CORRECT_ORDER[this.traced.length];
        if (i === expectedIdx) {
          this.traced = [...this.traced, i];
          this.message = `Point ${this.traced.length} traced...`;

          if (this.traced.length === RUNE_POINTS.length) {
            this.solved = true;
            this.message = "The rune blazes with warmth! The ice begins to crack and melt!";
            setTimeout(() => { this.args.onSolve(); }, 2000);
          }
        } else {
          // Wrong dot!
          this.wrongFlash = true;
          this.attempts++;
          this.message = "Wrong point! The rune fades. Start from the bottom again.";
          setTimeout(() => {
            this.traced = [];
            this.wrongFlash = false;
            this.message = `Trace the rune in order. Start at point 1 (bottom). Attempt ${this.attempts + 1}.`;
          }, 800);
        }
        return;
      }
    }
  };

  close = (): void => { this.args.onClose(); };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 500px;">
        <canvas class="puzzle-canvas" style="width: 100%; height: 340px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}} {{on "click" this.handleCanvasClick}}></canvas>
        <p class="puzzle-hint" style="margin-top: 0.8rem; text-align: center; color: #a0b8d0; font-size: 0.9rem;">{{this.message}}</p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>Step Back</button>
      </div>
    </div>
  </template>
}
