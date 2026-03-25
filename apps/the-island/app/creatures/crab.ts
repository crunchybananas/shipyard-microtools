/**
 * Crab — Guardian Creature of Misty Shore
 *
 * A cute little crab that scuttles sideways across the beach.
 * Cursed: invisible (crab doesn't appear)
 * Restored: scuttles happily, occasionally stops to wave claws
 */

import type { CreatureState, CreatureRenderer } from "./types";
import { sceneToCanvas } from "./types";

export class CrabRenderer implements CreatureRenderer {
  private walkSpeed = 30; // pixels per second in scene coords
  private walkDirection = 1; // 1 = right, -1 = left
  private idleTimer = 0;
  private walkTimer = 0;

  update(state: CreatureState, dt: number, restorationProgress: number): void {
    state.visible = restorationProgress >= 0.8;
    if (!state.visible) return;

    state.animTime += dt;

    switch (state.animation) {
      case "idle":
        this.idleTimer += dt;
        // After 2-4 seconds of idle, start walking
        if (this.idleTimer > 2 + Math.sin(state.animTime) * 1) {
          state.animation = "walk";
          this.idleTimer = 0;
          this.walkTimer = 0;
          // Pick random direction
          this.walkDirection = Math.random() > 0.5 ? 1 : -1;
          state.facing = this.walkDirection > 0 ? "right" : "left";
        }
        break;

      case "walk":
        this.walkTimer += dt;
        state.x += this.walkDirection * this.walkSpeed * dt;

        // Bounce off edges
        if (state.x < 300 || state.x > 900) {
          this.walkDirection *= -1;
          state.facing = this.walkDirection > 0 ? "right" : "left";
        }

        // After 1-3 seconds, stop
        if (this.walkTimer > 1.5 + Math.sin(state.animTime * 2) * 0.8) {
          state.animation = "idle";
          this.walkTimer = 0;
        }
        break;

      case "react":
        // Wave claws excitedly
        this.idleTimer += dt;
        if (this.idleTimer > 1.5) {
          state.animation = "idle";
          this.idleTimer = 0;
        }
        break;

      default:
        state.animation = "idle";
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: CreatureState,
    restorationProgress: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!state.visible || restorationProgress < 0.5) return;

    const fadeIn = Math.min(1, (restorationProgress - 0.5) / 0.3);
    ctx.globalAlpha = fadeIn;

    const [cx, cy] = sceneToCanvas(state.x, state.y, canvasWidth, canvasHeight);
    const s = state.scale * (canvasWidth / 1200) * 18; // base size
    const flip = state.facing === "left" ? -1 : 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flip, 1);

    // Walking bob animation
    const bob =
      state.animation === "walk"
        ? Math.sin(state.animTime * 12) * 2
        : 0;
    ctx.translate(0, bob);

    // --- BODY ---
    // Shell (main body)
    ctx.fillStyle = "#c44d20";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.2, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shell highlight
    ctx.fillStyle = "#d06830";
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, -s * 0.2, s * 0.6, s * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Shell pattern dots
    ctx.fillStyle = "#a03818";
    for (let i = 0; i < 3; i++) {
      const dx = -s * 0.3 + i * s * 0.3;
      const dy = s * 0.1;
      ctx.beginPath();
      ctx.arc(dx, dy, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- EYES ---
    // Eye stalks
    ctx.strokeStyle = "#c44d20";
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = "round";

    // Left eye stalk
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.5);
    ctx.lineTo(-s * 0.5, -s * 1.0);
    ctx.stroke();
    // Right eye stalk
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.5);
    ctx.lineTo(s * 0.5, -s * 1.0);
    ctx.stroke();

    // Eye balls
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-s * 0.5, -s * 1.0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.5, -s * 1.0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (look in walking direction)
    const pupilOffset = state.animation === "walk" ? s * 0.05 : 0;
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(-s * 0.5 + pupilOffset, -s * 1.0, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.5 + pupilOffset, -s * 1.0, s * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // --- CLAWS ---
    const clawWave =
      state.animation === "react"
        ? Math.sin(state.animTime * 10) * 0.4
        : state.animation === "walk"
          ? Math.sin(state.animTime * 6) * 0.15
          : 0;

    // Left claw
    ctx.save();
    ctx.translate(-s * 1.1, -s * 0.1);
    ctx.rotate(-0.5 + clawWave);
    ctx.fillStyle = "#c44d20";
    // Arm
    ctx.fillRect(-s * 0.6, -s * 0.08, s * 0.6, s * 0.16);
    // Claw pincer (top)
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.08);
    ctx.lineTo(-s * 0.9, -s * 0.25);
    ctx.lineTo(-s * 0.65, -s * 0.08);
    ctx.fill();
    // Claw pincer (bottom)
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, s * 0.08);
    ctx.lineTo(-s * 0.9, s * 0.2);
    ctx.lineTo(-s * 0.65, s * 0.08);
    ctx.fill();
    ctx.restore();

    // Right claw
    ctx.save();
    ctx.translate(s * 1.1, -s * 0.1);
    ctx.rotate(0.5 - clawWave);
    ctx.fillStyle = "#c44d20";
    ctx.fillRect(0, -s * 0.08, s * 0.6, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 0.08);
    ctx.lineTo(s * 0.9, -s * 0.25);
    ctx.lineTo(s * 0.65, -s * 0.08);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.6, s * 0.08);
    ctx.lineTo(s * 0.9, s * 0.2);
    ctx.lineTo(s * 0.65, s * 0.08);
    ctx.fill();
    ctx.restore();

    // --- LEGS ---
    ctx.strokeStyle = "#a03818";
    ctx.lineWidth = s * 0.08;
    for (let leg = 0; leg < 3; leg++) {
      const legPhase =
        state.animation === "walk"
          ? Math.sin(state.animTime * 8 + leg * 1.2) * 0.3
          : 0;

      // Left leg
      const lx = -s * 0.5 - leg * s * 0.25;
      ctx.beginPath();
      ctx.moveTo(lx, s * 0.4);
      ctx.lineTo(lx - s * 0.3, s * 0.8 + legPhase * s);
      ctx.stroke();

      // Right leg
      const rx = s * 0.5 + leg * s * 0.25;
      ctx.beginPath();
      ctx.moveTo(rx, s * 0.4);
      ctx.lineTo(rx + s * 0.3, s * 0.8 - legPhase * s);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
