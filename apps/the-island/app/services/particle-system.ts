/**
 * The Fading Kingdom — Particle System
 *
 * Manages particle emitters, pools, updates, and rendering.
 * Supports ambient particles, burst effects, and color interpolation
 * based on restoration progress.
 */

import Service from "@ember/service";
import type { ParticleEmitterConfig, ParticleShape } from "the-island/scenes/types";
import { lerpColor } from "the-island/scenes/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: ParticleShape;
  alpha: number;
  blendMode: GlobalCompositeOperation;
}

interface ActiveEmitter {
  config: ParticleEmitterConfig;
  accumulator: number;
  active: boolean;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export default class ParticleSystemService extends Service {
  private particles: Particle[] = [];
  private emitters: Map<string, ActiveEmitter> = new Map();
  private maxParticles = 500;

  // ============================================
  // EMITTER MANAGEMENT
  // ============================================

  addEmitter(config: ParticleEmitterConfig, restorationProgress: number): void {
    // Check if emitter should be active based on showWhen
    const active = this.shouldShow(config.showWhen, restorationProgress);
    this.emitters.set(config.id, {
      config,
      accumulator: 0,
      active,
    });
  }

  removeEmitter(id: string): void {
    this.emitters.delete(id);
  }

  clear(): void {
    this.particles = [];
    this.emitters.clear();
  }

  private shouldShow(
    showWhen: "cursed" | "restored" | "always" | undefined,
    progress: number,
  ): boolean {
    if (!showWhen || showWhen === "always") return true;
    if (showWhen === "cursed") return progress < 0.5;
    if (showWhen === "restored") return progress >= 0.5;
    return true;
  }

  // ============================================
  // UPDATE
  // ============================================

  update(dt: number, restorationProgress: number): void {
    // Update emitters — spawn new particles
    for (const [, emitter] of this.emitters) {
      emitter.active = this.shouldShow(
        emitter.config.showWhen,
        restorationProgress,
      );
      if (!emitter.active) continue;

      emitter.accumulator += dt;
      const interval = 1 / emitter.config.rate;

      while (
        emitter.accumulator >= interval &&
        this.particles.length < this.maxParticles
      ) {
        emitter.accumulator -= interval;
        this.spawnParticle(emitter.config, restorationProgress);
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;

      if (p.life <= 0) {
        // Remove dead particle (swap with last for O(1))
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
        continue;
      }

      // Physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Alpha based on lifetime
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio > 0.8) {
        // Fade in
        p.alpha = (1 - lifeRatio) / 0.2;
      } else if (lifeRatio < 0.3) {
        // Fade out
        p.alpha = lifeRatio / 0.3;
      } else {
        p.alpha = 1;
      }
    }
  }

  private spawnParticle(
    config: ParticleEmitterConfig,
    progress: number,
  ): void {
    const emitX = config.x + (config.width ? rand(0, config.width) : 0);
    const emitY = config.y + (config.height ? rand(0, config.height) : 0);
    const life = rand(config.lifetime[0], config.lifetime[1]);
    const color = lerpColor(config.cursedColor, config.restoredColor, progress);

    this.particles.push({
      x: emitX,
      y: emitY,
      vx: rand(config.velocity.x[0], config.velocity.x[1]),
      vy: rand(config.velocity.y[0], config.velocity.y[1]),
      life,
      maxLife: life,
      size: rand(config.size[0], config.size[1]),
      color,
      shape: config.shape,
      alpha: 0,
      blendMode: config.blendMode ?? "source-over",
    });
  }

  // ============================================
  // BURST — instant spawn for pickup/solve effects
  // ============================================

  burst(
    x: number,
    y: number,
    count: number,
    config: ParticleEmitterConfig,
  ): void {
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const life = rand(config.lifetime[0], config.lifetime[1]);
      this.particles.push({
        x: x + rand(-5, 5),
        y: y + rand(-5, 5),
        vx: rand(config.velocity.x[0], config.velocity.x[1]),
        vy: rand(config.velocity.y[0], config.velocity.y[1]),
        life,
        maxLife: life,
        size: rand(config.size[0], config.size[1]),
        color: config.restoredColor,
        shape: config.shape,
        alpha: 1,
        blendMode: config.blendMode ?? "lighter",
      });
    }
  }

  // ============================================
  // DRAW
  // ============================================

  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (this.particles.length === 0) return;

    // Scale from scene coords (1200x800) to canvas size
    const scaleX = canvasWidth / 1200;
    const scaleY = canvasHeight / 800;

    ctx.save();

    for (const p of this.particles) {
      if (p.alpha <= 0.01) continue;

      const screenX = p.x * scaleX;
      const screenY = p.y * scaleY;
      const screenSize = p.size * Math.min(scaleX, scaleY);

      ctx.globalAlpha = p.alpha;
      ctx.globalCompositeOperation = p.blendMode;
      ctx.fillStyle = p.color;

      switch (p.shape) {
        case "circle":
          ctx.beginPath();
          ctx.arc(screenX, screenY, screenSize, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "star":
          this.drawStar(ctx, screenX, screenY, screenSize);
          break;

        case "line":
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(screenX + p.vx * 0.02, screenY + p.vy * 0.02);
          ctx.stroke();
          break;

        case "snowflake":
          this.drawSnowflake(ctx, screenX, screenY, screenSize);
          break;
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
  ): void {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const outerX = x + Math.cos(angle) * r;
      const outerY = y + Math.sin(angle) * r;
      const innerAngle = angle + Math.PI / 5;
      const innerX = x + Math.cos(innerAngle) * r * 0.4;
      const innerY = y + Math.sin(innerAngle) * r * 0.4;

      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawSnowflake(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
  ): void {
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
      ctx.stroke();
    }
  }
}
