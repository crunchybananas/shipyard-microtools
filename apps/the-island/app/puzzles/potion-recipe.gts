/**
 * Potion Recipe Puzzle — The Meadow
 *
 * 6 ingredients shown. A torn recipe hints at 3 correct ones.
 * Player selects 3 ingredients and brews. Wrong combination = potion fizzles.
 * Must figure out which 3 from the hint text.
 *
 * Hint: "Moonpetal for the heart, starroot for the bones, dewdrop for the soul"
 * Correct: moonpetal, starroot, dewdrop (positions 0, 2, 4)
 * Decoys: nightshade, thornberry, fogmoss (positions 1, 3, 5)
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface PotionRecipeSignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

const INGREDIENTS = [
  { id: "moonpetal", name: "Moonpetal", emoji: "🌸", color: "#dd88cc", correct: true },
  { id: "nightshade", name: "Nightshade", emoji: "🍇", color: "#6644aa", correct: false },
  { id: "starroot", name: "Starroot", emoji: "⭐", color: "#ddcc44", correct: true },
  { id: "thornberry", name: "Thornberry", emoji: "🫐", color: "#884444", correct: false },
  { id: "dewdrop", name: "Dewdrop", emoji: "💧", color: "#44aadd", correct: true },
  { id: "fogmoss", name: "Fogmoss", emoji: "🌿", color: "#448844", correct: false },
];

export default class PotionRecipe extends Component<PotionRecipeSignature> {
  @tracked selected: Set<number> = new Set();
  @tracked phase: "select" | "brewing" | "failed" | "solved" = "select";
  @tracked message = "A torn recipe reads: \"Moonpetal for the heart, starroot for the bones, dewdrop for the soul.\" Select 3 ingredients and brew.";
  @tracked attempts = 0;

  private canvas: HTMLCanvasElement | null = null;

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.draw();

    const handleResize = () => { this.resize(); this.draw(); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

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

    ctx.clearRect(0, 0, w, h);

    // Wooden table background
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3a2a18";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * (h / 5));
      ctx.lineTo(w, i * (h / 5));
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "#d4c4a8";
    ctx.font = `bold ${Math.min(w / 22, 18)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("HEALING POTION", w / 2, 28);

    // 6 ingredients in 2 rows of 3
    const itemW = w / 4.5;
    const itemH = h * 0.25;
    const startY = h * 0.2;
    const rowGap = h * 0.32;

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const ix = w * 0.18 + col * w * 0.32;
      const iy = startY + row * rowGap;
      const ing = INGREDIENTS[i]!;
      const isSelected = this.selected.has(i);

      // Jar/container
      ctx.fillStyle = isSelected ? "#3a3020" : "#1a1208";
      ctx.strokeStyle = isSelected ? ing.color : "#3a3028";
      ctx.lineWidth = isSelected ? 3 : 1.5;
      const jarW = itemW * 0.7;
      const jarH = itemH * 0.65;

      // Rounded jar shape
      ctx.beginPath();
      ctx.moveTo(ix - jarW / 2, iy - jarH * 0.3);
      ctx.quadraticCurveTo(ix - jarW / 2, iy - jarH / 2, ix - jarW / 4, iy - jarH / 2);
      ctx.lineTo(ix + jarW / 4, iy - jarH / 2);
      ctx.quadraticCurveTo(ix + jarW / 2, iy - jarH / 2, ix + jarW / 2, iy - jarH * 0.3);
      ctx.lineTo(ix + jarW / 2, iy + jarH * 0.3);
      ctx.quadraticCurveTo(ix + jarW / 2, iy + jarH / 2, ix, iy + jarH / 2);
      ctx.quadraticCurveTo(ix - jarW / 2, iy + jarH / 2, ix - jarW / 2, iy + jarH * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ingredient emoji
      ctx.font = `${jarH * 0.5}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ing.emoji, ix, iy);

      // Name label
      ctx.fillStyle = isSelected ? ing.color : "#8a7a60";
      ctx.font = `${Math.min(w / 35, 12)}px sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(ing.name, ix, iy + jarH / 2 + 15);

      // Selection indicator
      if (isSelected) {
        ctx.fillStyle = ing.color;
        ctx.globalAlpha = 0.15;
        const glow = ctx.createRadialGradient(ix, iy, 0, ix, iy, jarW);
        glow.addColorStop(0, ing.color);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(ix - jarW, iy - jarH, jarW * 2, jarH * 2);
        ctx.globalAlpha = 1;
      }
    }

    // Brew button (if 3 selected)
    if (this.selected.size === 3 && this.phase === "select") {
      const btnX = w / 2;
      const btnY = h - 30;
      ctx.fillStyle = "#4a8a4a";
      ctx.strokeStyle = "#6aba6a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX - 60, btnY - 15, 120, 30, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.min(w / 30, 14)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🧪 BREW", btnX, btnY);
    }

    // Attempt counter
    if (this.attempts > 0) {
      ctx.fillStyle = "#6a5a4a";
      ctx.font = `${Math.min(w / 35, 11)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`Attempts: ${this.attempts}`, w / 2, 48);
    }
  }

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.phase !== "select" || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    // Check brew button
    if (this.selected.size === 3) {
      const btnX = w / 2;
      const btnY = h - 30;
      if (Math.abs(x - btnX) < 60 && Math.abs(y - btnY) < 15) {
        this.brew();
        return;
      }
    }

    // Check ingredient clicks
    const startY = h * 0.2;
    const rowGap = h * 0.32;
    const itemH = h * 0.25;
    const jarH = itemH * 0.65;

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const ix = w * 0.18 + col * w * 0.32;
      const iy = startY + row * rowGap;

      if (Math.abs(x - ix) < w * 0.12 && Math.abs(y - iy) < jarH) {
        const newSelected = new Set(this.selected);
        if (newSelected.has(i)) {
          newSelected.delete(i);
        } else if (newSelected.size < 3) {
          newSelected.add(i);
        }
        this.selected = newSelected;
        this.message = `Selected ${newSelected.size}/3 ingredients. ${newSelected.size === 3 ? "Click BREW to mix!" : ""}`;
        this.draw();
        return;
      }
    }
  };

  brew(): void {
    this.attempts++;
    const selectedIndices = Array.from(this.selected);
    const allCorrect = selectedIndices.every(i => INGREDIENTS[i]?.correct);

    if (allCorrect) {
      this.phase = "solved";
      this.message = "The potion glows warm gold! You pour it on the earth and flowers erupt everywhere!";
      this.draw();
      setTimeout(() => { this.args.onSolve(); }, 2000);
    } else {
      this.phase = "failed";
      this.message = "The potion fizzles and turns gray. Wrong ingredients... Try again.";
      this.draw();
      setTimeout(() => {
        this.phase = "select";
        this.selected = new Set();
        this.message = "\"Moonpetal for the heart, starroot for the bones, dewdrop for the soul.\" Choose wisely.";
        this.draw();
      }, 1500);
    }
  }

  close = (): void => { this.args.onClose(); };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 580px;">
        <canvas class="puzzle-canvas" style="width: 100%; height: 320px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}} {{on "click" this.handleCanvasClick}}></canvas>
        <p class="puzzle-hint" style="margin-top: 0.8rem; text-align: center; color: #d4c4a8; font-size: 0.9rem;">{{this.message}}</p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>Step Back</button>
      </div>
    </div>
  </template>
}
