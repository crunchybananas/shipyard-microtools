/**
 * Owl — Guardian Creature of Whispering Woods
 *
 * Cursed: Sits in a cage, eyes closed, gray and lifeless
 * Restored: Perches on a branch, eyes glow golden, occasionally blinks
 */

import type { CreatureState, CreatureRenderer } from "./types";
import { sceneToCanvas } from "./types";

export class OwlRenderer implements CreatureRenderer {
  private blinkTimer = 0;
  private isBlinking = false;
  private headTilt = 0;

  update(state: CreatureState, dt: number, restorationProgress: number): void {
    state.visible = true; // visible in both states (caged vs freed)
    state.animTime += dt;

    // Blinking
    this.blinkTimer += dt;
    if (this.blinkTimer > 3 + Math.sin(state.animTime) * 1.5) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }
    if (this.isBlinking && this.blinkTimer > 0.15) {
      this.isBlinking = false;
    }

    // Head tilt (restored only)
    if (restorationProgress > 0.8) {
      this.headTilt = Math.sin(state.animTime * 0.8) * 0.1;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: CreatureState,
    restorationProgress: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!state.visible) return;

    const [cx, cy] = sceneToCanvas(state.x, state.y, canvasWidth, canvasHeight);
    const s = state.scale * (canvasWidth / 1200) * 14;

    ctx.save();
    ctx.translate(cx, cy);

    // --- CAGE (cursed state) ---
    if (restorationProgress < 0.8) {
      const cageAlpha = 1 - restorationProgress;
      ctx.globalAlpha = cageAlpha;
      ctx.strokeStyle = "#5a5a60";
      ctx.lineWidth = 2;

      // Cage bars
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.5, -s * 2);
        ctx.lineTo(i * s * 0.5, s * 1.2);
        ctx.stroke();
      }
      // Cage top arc
      ctx.beginPath();
      ctx.arc(0, -s * 2, s * 1.5, 0, Math.PI, true);
      ctx.stroke();
      // Cage bottom
      ctx.beginPath();
      ctx.moveTo(-s * 1.5, s * 1.2);
      ctx.lineTo(s * 1.5, s * 1.2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    // Head tilt
    ctx.rotate(this.headTilt);

    // Body color — gray when cursed, warm brown when restored
    const r = Math.round(60 + restorationProgress * 80);
    const g = Math.round(50 + restorationProgress * 50);
    const b = Math.round(45 + restorationProgress * 20);

    // --- BODY ---
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.0, s * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly (lighter)
    ctx.fillStyle = `rgb(${r + 30}, ${g + 30}, ${b + 20})`;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.3, s * 0.6, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly feather pattern
    ctx.strokeStyle = `rgb(${r - 10}, ${g - 10}, ${b - 10})`;
    ctx.lineWidth = 0.8;
    for (let row = 0; row < 4; row++) {
      for (let col = -1; col <= 1; col++) {
        const px = col * s * 0.25;
        const py = s * 0.1 + row * s * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, s * 0.08, 0, Math.PI);
        ctx.stroke();
      }
    }

    // --- HEAD ---
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.beginPath();
    ctx.arc(0, -s * 1.1, s * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Ear tufts
    ctx.fillStyle = `rgb(${r + 10}, ${g + 5}, ${b})`;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 1.6);
    ctx.lineTo(-s * 0.3, -s * 2.1);
    ctx.lineTo(-s * 0.1, -s * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 1.6);
    ctx.lineTo(s * 0.3, -s * 2.1);
    ctx.lineTo(s * 0.1, -s * 1.5);
    ctx.closePath();
    ctx.fill();

    // --- EYES ---
    // Facial disc (lighter area around eyes)
    ctx.fillStyle = `rgb(${r + 20}, ${g + 20}, ${b + 15})`;
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 1.1, s * 0.35, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.3, -s * 1.1, s * 0.35, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.isBlinking || restorationProgress < 0.3) {
      // Closed eyes — horizontal lines
      ctx.strokeStyle = `rgb(${r - 20}, ${g - 20}, ${b - 20})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 1.1);
      ctx.lineTo(-s * 0.15, -s * 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -s * 1.1);
      ctx.lineTo(s * 0.45, -s * 1.1);
      ctx.stroke();
    } else {
      // Open eyes
      // Eye white
      ctx.fillStyle = restorationProgress > 0.5 ? "#ffd700" : "#888888";
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 1.1, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.3, -s * 1.1, s * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 1.1, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.3, -s * 1.1, s * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Eye glow (restored)
      if (restorationProgress > 0.6) {
        const glowAlpha = (restorationProgress - 0.6) / 0.4 * 0.15;
        ctx.globalAlpha = glowAlpha;
        const eyeGlow = ctx.createRadialGradient(-s * 0.3, -s * 1.1, 0, -s * 0.3, -s * 1.1, s * 0.6);
        eyeGlow.addColorStop(0, "#ffd700");
        eyeGlow.addColorStop(1, "transparent");
        ctx.fillStyle = eyeGlow;
        ctx.fillRect(-s * 1, -s * 2, s * 2, s * 2);
        ctx.globalAlpha = 1;
      }
    }

    // --- BEAK ---
    ctx.fillStyle = "#c8a030";
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.85);
    ctx.lineTo(-s * 0.12, -s * 0.7);
    ctx.lineTo(0, -s * 0.6);
    ctx.lineTo(s * 0.12, -s * 0.7);
    ctx.closePath();
    ctx.fill();

    // --- FEET ---
    ctx.strokeStyle = `rgb(${r - 10}, ${g - 10}, ${b})`;
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = "round";
    // Left foot
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 1.2);
    ctx.lineTo(-s * 0.5, s * 1.5);
    ctx.moveTo(-s * 0.3, s * 1.2);
    ctx.lineTo(-s * 0.2, s * 1.5);
    ctx.moveTo(-s * 0.3, s * 1.2);
    ctx.lineTo(-s * 0.4, s * 1.5);
    ctx.stroke();
    // Right foot
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 1.2);
    ctx.lineTo(s * 0.5, s * 1.5);
    ctx.moveTo(s * 0.3, s * 1.2);
    ctx.lineTo(s * 0.2, s * 1.5);
    ctx.moveTo(s * 0.3, s * 1.2);
    ctx.lineTo(s * 0.4, s * 1.5);
    ctx.stroke();

    ctx.restore();
  }
}
