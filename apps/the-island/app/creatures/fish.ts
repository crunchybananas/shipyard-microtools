/**
 * Fish — Guardian Creature of Starfall Lake
 *
 * A silver fish that leaps from the restored lake in graceful arcs.
 * Only appears when the lake is restored.
 */

import type { CreatureState, CreatureRenderer } from "./types";
import { sceneToCanvas } from "./types";

export class FishRenderer implements CreatureRenderer {
  private jumpTimer = 0;
  private isJumping = false;
  private jumpProgress = 0;
  private jumpStartX = 0;
  private jumpArcHeight = 80;
  private splashTimer = 0;

  update(state: CreatureState, dt: number, restorationProgress: number): void {
    state.visible = restorationProgress >= 0.8;
    if (!state.visible) return;

    state.animTime += dt;

    if (!this.isJumping) {
      this.jumpTimer += dt;
      // Jump every 3-5 seconds
      if (this.jumpTimer > 3 + Math.sin(state.animTime * 0.7) * 1) {
        this.isJumping = true;
        this.jumpProgress = 0;
        this.jumpTimer = 0;
        this.jumpStartX = 350 + Math.random() * 500; // random position across lake
        this.jumpArcHeight = 60 + Math.random() * 40;
        state.x = this.jumpStartX;
      }
    }

    if (this.isJumping) {
      this.jumpProgress += dt * 0.8; // ~1.25 seconds per jump
      if (this.jumpProgress >= 1) {
        this.isJumping = false;
        this.splashTimer = 0.3;
      }
    }

    if (this.splashTimer > 0) {
      this.splashTimer -= dt;
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

    const s = state.scale * (canvasWidth / 1200) * 10;
    const waterY = state.y; // Y position of the water surface in scene coords

    if (this.isJumping) {
      // Fish arcing out of water
      const t = this.jumpProgress;
      const arcX = this.jumpStartX + t * 80; // move sideways during jump
      const arcY = waterY - Math.sin(t * Math.PI) * this.jumpArcHeight;
      const angle = Math.atan2(
        -Math.cos(t * Math.PI) * this.jumpArcHeight,
        80,
      );

      const [px, py] = sceneToCanvas(arcX, arcY, canvasWidth, canvasHeight);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);

      // Fish body
      ctx.fillStyle = "#c0d0e0";
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.5, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Silver shine
      ctx.fillStyle = "#e0e8f0";
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 0.1, s * 0.8, s * 0.25, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = "#222222";
      ctx.beginPath();
      ctx.arc(-s * 0.9, -s * 0.05, s * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Tail fin
      ctx.fillStyle = "#a0b0c8";
      ctx.beginPath();
      ctx.moveTo(s * 1.3, 0);
      ctx.lineTo(s * 2.0, -s * 0.5);
      ctx.lineTo(s * 2.0, s * 0.5);
      ctx.closePath();
      ctx.fill();

      // Dorsal fin
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.4);
      ctx.lineTo(s * 0.3, -s * 0.8);
      ctx.lineTo(s * 0.6, -s * 0.4);
      ctx.closePath();
      ctx.fill();

      // Water droplets trailing
      ctx.fillStyle = "#88bbdd";
      for (let d = 0; d < 3; d++) {
        const dx = s * (1 + d * 0.8);
        const dy = s * (d * 0.3);
        ctx.globalAlpha = fadeIn * (1 - t) * 0.5;
        ctx.beginPath();
        ctx.arc(dx, dy, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Splash rings when entering/exiting water
    if (this.splashTimer > 0 || (this.isJumping && this.jumpProgress < 0.1)) {
      const splashX = this.jumpStartX + (this.isJumping ? 0 : 80);
      const [sx, sy] = sceneToCanvas(splashX, waterY, canvasWidth, canvasHeight);
      const ring = this.isJumping ? this.jumpProgress * 3 : (0.3 - this.splashTimer) * 3;

      ctx.globalAlpha = fadeIn * Math.max(0, 0.4 - ring * 0.3);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, (10 + ring * 15) * (canvasWidth / 1200), 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(sx, sy, (5 + ring * 10) * (canvasWidth / 1200), 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
