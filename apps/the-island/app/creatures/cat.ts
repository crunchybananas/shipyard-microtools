/**
 * Cat — Guardian Creature of Wizard's Tower
 *
 * A cozy cat that sleeps by the fire, occasionally twitching ears or stretching.
 * Cursed: invisible (cat only appears when tower is restored)
 * Restored: curled up purring, breathing animation, ear flicks, stretches
 */

import type { CreatureState, CreatureRenderer } from "./types";
import { sceneToCanvas } from "./types";

export class CatRenderer implements CreatureRenderer {
  private breathPhase = 0;
  private earFlickTimer = 0;
  private earFlicking = false;
  private tailSwayPhase = 0;
  private stretchTimer = 0;
  private isStretching = false;
  private stretchProgress = 0;

  update(state: CreatureState, dt: number, restorationProgress: number): void {
    state.visible = restorationProgress >= 0.8;
    if (!state.visible) return;

    state.animTime += dt;
    this.breathPhase += dt * 1.2;
    this.tailSwayPhase += dt * 0.8;

    // Ear flick every 4-7 seconds
    this.earFlickTimer += dt;
    if (this.earFlickTimer > 4 + Math.sin(state.animTime) * 1.5) {
      this.earFlicking = true;
      this.earFlickTimer = 0;
    }
    if (this.earFlicking && this.earFlickTimer > 0.2) {
      this.earFlicking = false;
    }

    // Occasional stretch every 12-18 seconds
    this.stretchTimer += dt;
    if (!this.isStretching && this.stretchTimer > 12 + Math.sin(state.animTime * 0.3) * 3) {
      this.isStretching = true;
      this.stretchProgress = 0;
      this.stretchTimer = 0;
    }
    if (this.isStretching) {
      this.stretchProgress += dt * 0.5;
      if (this.stretchProgress >= 1) {
        this.isStretching = false;
        this.stretchProgress = 0;
      }
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
    const s = state.scale * (canvasWidth / 1200) * 12;
    const breathScale = 1 + Math.sin(this.breathPhase) * 0.02;

    // Stretch deformation
    const stretchX = this.isStretching
      ? 1 + Math.sin(this.stretchProgress * Math.PI) * 0.3
      : 1;
    const stretchY = this.isStretching
      ? 1 - Math.sin(this.stretchProgress * Math.PI) * 0.15
      : 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(stretchX, stretchY * breathScale);

    // --- BODY (curled up oval) ---
    // Main body
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.8, s * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lighter belly showing (curled)
    ctx.fillStyle = "#5a5a5a";
    ctx.beginPath();
    ctx.ellipse(s * 0.3, s * 0.2, s * 0.8, s * 0.5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Fur texture stripes
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = s * 0.06;
    for (let i = 0; i < 4; i++) {
      const sx = -s * 0.8 + i * s * 0.5;
      ctx.beginPath();
      ctx.arc(sx, -s * 0.2, s * 0.3, 0.5, 2.5);
      ctx.stroke();
    }

    // --- HEAD ---
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.arc(-s * 1.4, -s * 0.3, s * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // --- EARS ---
    const earFlick = this.earFlicking ? Math.sin(this.earFlickTimer * 30) * 0.3 : 0;

    // Left ear
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.moveTo(-s * 1.7, -s * 0.8);
    ctx.lineTo(-s * 1.9 + earFlick * s, -s * 1.4);
    ctx.lineTo(-s * 1.5, -s * 0.9);
    ctx.closePath();
    ctx.fill();
    // Inner ear
    ctx.fillStyle = "#8a6a6a";
    ctx.beginPath();
    ctx.moveTo(-s * 1.7, -s * 0.85);
    ctx.lineTo(-s * 1.85 + earFlick * s, -s * 1.3);
    ctx.lineTo(-s * 1.55, -s * 0.9);
    ctx.closePath();
    ctx.fill();

    // Right ear
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 0.85);
    ctx.lineTo(-s * 1.1, -s * 1.4);
    ctx.lineTo(-s * 0.9, -s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6a6a";
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 0.9);
    ctx.lineTo(-s * 1.12, -s * 1.3);
    ctx.lineTo(-s * 0.95, -s * 0.85);
    ctx.closePath();
    ctx.fill();

    // --- EYES (closed — sleeping) ---
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = "round";

    // Peaceful closed eyes — curved lines
    ctx.beginPath();
    ctx.arc(-s * 1.55, -s * 0.3, s * 0.12, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-s * 1.25, -s * 0.3, s * 0.12, 0.3, Math.PI - 0.3);
    ctx.stroke();

    // --- NOSE ---
    ctx.fillStyle = "#8a6060";
    ctx.beginPath();
    ctx.moveTo(-s * 1.4, -s * 0.15);
    ctx.lineTo(-s * 1.45, -s * 0.08);
    ctx.lineTo(-s * 1.35, -s * 0.08);
    ctx.closePath();
    ctx.fill();

    // --- WHISKERS ---
    ctx.strokeStyle = "#6a6a6a";
    ctx.lineWidth = 0.5;
    // Left whiskers
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, -s * 0.1);
    ctx.lineTo(-s * 2.2, -s * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, -s * 0.05);
    ctx.lineTo(-s * 2.2, 0);
    ctx.stroke();
    // Right whiskers
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 0.1);
    ctx.lineTo(-s * 0.6, -s * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 0.05);
    ctx.lineTo(-s * 0.6, -s * 0.05);
    ctx.stroke();

    // --- TAIL (curled around body) ---
    const tailSway = Math.sin(this.tailSwayPhase) * s * 0.15;
    ctx.strokeStyle = "#4a4a4a";
    ctx.lineWidth = s * 0.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s * 1.5, s * 0.1);
    ctx.quadraticCurveTo(
      s * 2.0 + tailSway,
      -s * 0.5,
      s * 1.8 + tailSway,
      -s * 1.0,
    );
    ctx.stroke();
    // Tail tip (slightly darker)
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(s * 1.85 + tailSway, -s * 0.7);
    ctx.quadraticCurveTo(s * 1.9 + tailSway, -s * 0.9, s * 1.8 + tailSway, -s * 1.0);
    ctx.stroke();

    // --- PAWS (tucked under) ---
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.ellipse(-s * 0.8, s * 0.6, s * 0.25, s * 0.15, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Paw pads
    ctx.fillStyle = "#8a6a6a";
    ctx.beginPath();
    ctx.arc(-s * 0.85, s * 0.62, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // --- PURR INDICATOR (zzz) ---
    if (!this.isStretching) {
      const zAlpha = (Math.sin(state.animTime * 1.5) * 0.3 + 0.5) * 0.4;
      ctx.globalAlpha = fadeIn * zAlpha;
      ctx.fillStyle = "#8888aa";
      ctx.font = `${s * 0.5}px serif`;
      ctx.fillText("z", -s * 1.0, -s * 1.6);
      ctx.font = `${s * 0.4}px serif`;
      ctx.fillText("z", -s * 0.7, -s * 1.9);
      ctx.font = `${s * 0.3}px serif`;
      ctx.fillText("z", -s * 0.5, -s * 2.1);
      ctx.globalAlpha = fadeIn;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
