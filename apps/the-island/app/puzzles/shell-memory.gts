/**
 * Shell Memory Puzzle — Misty Shore
 *
 * 6 sand mounds in a grid. 3 contain shells, 3 are empty.
 * Click to dig — shell = stays revealed. Empty = all reset after a pause.
 * Find all 3 shells without hitting empty to win.
 *
 * The shell positions are randomized each game but stay fixed during a round.
 * Wrong dig shows the empty hole briefly, then all mounds reset.
 * Found shells stay revealed across attempts.
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface ShellMemorySignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

interface Mound {
  hasShell: boolean;
  revealed: boolean;
  found: boolean; // permanently found (persists across resets)
  digging: boolean; // animation state
  wrong: boolean; // briefly shown as wrong
}

export default class ShellMemory extends Component<ShellMemorySignature> {
  @tracked mounds: Mound[] = [];
  @tracked message = "Three shells hide in the sand. Dig carefully — a wrong guess covers them all again.";
  @tracked shellsFound = 0;
  @tracked attempts = 0;
  @tracked solved = false;
  @tracked locked = false; // prevent clicking during animation

  private canvas: HTMLCanvasElement | null = null;

  constructor(owner: unknown, args: ShellMemorySignature["Args"]) {
    super(owner, args);
    this.initMounds();
  }

  initMounds(): void {
    // 6 positions, randomly assign 3 shells
    const positions = [0, 1, 2, 3, 4, 5];
    // Shuffle and pick first 3 for shells
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j]!, positions[i]!];
    }
    const shellPositions = new Set(positions.slice(0, 3));

    this.mounds = Array.from({ length: 6 }, (_, i) => ({
      hasShell: shellPositions.has(i),
      revealed: false,
      found: false,
      digging: false,
      wrong: false,
    }));
  }

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.draw();

    const handleResize = () => { this.resize(); this.draw(); };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
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

    // Sandy background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#5a4a3a");
    grad.addColorStop(1, "#3a3229");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sand grain texture
    ctx.fillStyle = "#6a5a4a";
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 50; i++) {
      const gx = (Math.sin(i * 137.5) * 0.5 + 0.5) * w;
      const gy = (Math.cos(i * 83.3) * 0.5 + 0.5) * h;
      ctx.fillRect(gx, gy, 2, 1);
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = "#d4c4a8";
    ctx.font = `bold ${Math.min(w / 20, 20)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("SAND MOUNDS", w / 2, 28);

    // Shells found counter
    ctx.fillStyle = "#8a7a60";
    ctx.font = `${Math.min(w / 28, 14)}px sans-serif`;
    ctx.fillText(`Shells found: ${this.shellsFound}/3  |  Attempts: ${this.attempts}`, w / 2, 48);

    // 6 mounds in 2 rows of 3
    const moundW = w / 5;
    const moundH = h / 5;
    const startY = h * 0.3;
    const rowGap = h * 0.28;

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const mx = w * 0.2 + col * w * 0.3;
      const my = startY + row * rowGap;
      const mound = this.mounds[i]!;

      if (mound.found) {
        // Permanently found shell — show shell on flat sand
        ctx.fillStyle = "#4a3a2a";
        ctx.beginPath();
        ctx.ellipse(mx, my, moundW * 0.6, moundH * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shell
        ctx.fillStyle = "#ffd700";
        ctx.font = `${moundW * 0.5}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🐚", mx, my);

        // Glow
        ctx.globalAlpha = 0.2;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, moundW * 0.6);
        glow.addColorStop(0, "#ffd700");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(mx - moundW, my - moundH, moundW * 2, moundH * 2);
        ctx.globalAlpha = 1;

      } else if (mound.wrong) {
        // Wrong dig — show empty hole briefly
        ctx.fillStyle = "#2a1a10";
        ctx.beginPath();
        ctx.ellipse(mx, my, moundW * 0.5, moundH * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#8a4a4a";
        ctx.font = `${moundW * 0.3}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("empty", mx, my);

      } else if (mound.digging) {
        // Digging animation
        ctx.fillStyle = "#5a4a3a";
        ctx.beginPath();
        ctx.ellipse(mx, my + 5, moundW * 0.55, moundH * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6a5a4a";
        ctx.beginPath();
        ctx.ellipse(mx, my, moundW * 0.5, moundH * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Undigged mound — sandy bump
        ctx.fillStyle = "#6a5a4a";
        ctx.beginPath();
        ctx.ellipse(mx, my + 8, moundW * 0.65, moundH * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7a6a5a";
        ctx.beginPath();
        ctx.ellipse(mx, my, moundW * 0.6, moundH * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = "#8a7a6a";
        ctx.beginPath();
        ctx.ellipse(mx - moundW * 0.1, my - moundH * 0.1, moundW * 0.3, moundH * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Subtle sparkle if has shell (very faint hint)
        if (mound.hasShell) {
          ctx.fillStyle = "#ffd700";
          ctx.globalAlpha = 0.15 + Math.sin(Date.now() * 0.003 + i * 2) * 0.1;
          ctx.beginPath();
          ctx.arc(mx + moundW * 0.15, my - moundH * 0.1, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.solved || this.locked || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const moundW = w / 5;
    const startY = h * 0.3;
    const rowGap = h * 0.28;

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const mx = w * 0.2 + col * w * 0.3;
      const my = startY + row * rowGap;
      const mound = this.mounds[i]!;

      if (mound.found) continue; // already found

      const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
      if (dist < moundW * 0.7) {
        this.digMound(i);
        return;
      }
    }
  };

  digMound(index: number): void {
    const mound = this.mounds[index]!;
    this.locked = true;

    // Digging animation
    const updated = [...this.mounds];
    updated[index] = { ...mound, digging: true };
    this.mounds = updated;
    this.draw();

    setTimeout(() => {
      if (mound.hasShell) {
        // Found a shell!
        const updated2 = [...this.mounds];
        updated2[index] = { ...mound, found: true, digging: false, revealed: true };
        this.mounds = updated2;
        this.shellsFound++;
        this.message = `A shell! ${3 - this.shellsFound} more to find.`;
        this.draw();
        this.locked = false;

        if (this.shellsFound >= 3) {
          this.solved = true;
          this.message = "All three shells found! The shore remembers...";
          this.draw();
          setTimeout(() => { this.args.onSolve(); }, 1500);
        }
      } else {
        // Wrong! Show the empty hole, then reset unfound mounds
        this.attempts++;
        const updated2 = [...this.mounds];
        updated2[index] = { ...mound, wrong: true, digging: false };
        this.mounds = updated2;
        this.message = "Empty! The sand shifts and covers the mounds again...";
        this.draw();

        setTimeout(() => {
          // Reset all non-found mounds
          this.mounds = this.mounds.map(m =>
            m.found ? m : { ...m, revealed: false, wrong: false, digging: false }
          );
          this.message = `Try again. Remember where the shells were... (${this.shellsFound}/3 found)`;
          this.draw();
          this.locked = false;
        }, 1200);
      }
    }, 400);
  }

  close = (): void => {
    this.args.onClose();
  };

  // Animate sparkles on shell mounds
  private drawLoop = (): void => {
    if (this.canvas) {
      this.draw();
      requestAnimationFrame(this.drawLoop);
    }
  };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 550px;">
        <canvas
          class="puzzle-canvas"
          style="width: 100%; height: 320px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}}
          {{on "click" this.handleCanvasClick}}
        ></canvas>
        <p class="puzzle-hint" style="margin-top: 1rem; text-align: center; color: #d4c4a8;">
          {{this.message}}
        </p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>
          Step Back
        </button>
      </div>
    </div>
  </template>
}
