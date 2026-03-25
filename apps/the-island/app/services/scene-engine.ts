/**
 * The Fading Kingdom — Canvas 2D Scene Engine
 *
 * Manages the canvas lifecycle, render loop, scene rendering,
 * hotspot detection, parallax, and cursed→restored transitions.
 */

import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type {
  SceneDefinition,
  SceneRenderContext,
  Hotspot,
  HotspotAction,
} from "the-island/scenes/types";
import { lerpVisuals } from "the-island/scenes/types";
import type ParticleSystemService from "./particle-system";
import type MusicEngineService from "./music-engine";
import type { CreatureState, CreatureRenderer } from "the-island/creatures/types";
import { CrabRenderer } from "the-island/creatures/crab";
import { OwlRenderer } from "the-island/creatures/owl";
import { CatRenderer } from "the-island/creatures/cat";
import { FishRenderer } from "the-island/creatures/fish";

export type HotspotCallback = (action: HotspotAction, target: string) => void;

export default class SceneEngineService extends Service {
  // Canvas state
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private lastTime = 0;
  private sceneStartTime = 0;

  // Scene state
  private activeScene: SceneDefinition | null = null;
  @tracked currentSceneId = "";

  // Mouse tracking for parallax + hotspot hover
  private mouseX = 0.5; // normalized 0-1
  private mouseY = 0.5;

  // Restoration animation
  private restorationTarget = 0;
  private restorationCurrent = 0;
  private restorationSpeed = 0.3; // units per second during transition

  // Scene transition
  private transitionAlpha = 0;
  private transitionTarget = 0;
  private pendingSceneId: string | null = null;

  // Callbacks
  onHotspotClick: HotspotCallback | null = null;

  // Scene registry
  private scenes: Map<string, SceneDefinition> = new Map();

  // Creature system
  private creatureStates: CreatureState[] = [];
  private creatureRenderers: Map<string, CreatureRenderer> = new Map();

  private getCreatureRenderer(type: string): CreatureRenderer {
    if (!this.creatureRenderers.has(type)) {
      switch (type) {
        case "crab":
          this.creatureRenderers.set(type, new CrabRenderer());
          break;
        case "owl":
          this.creatureRenderers.set(type, new OwlRenderer());
          break;
        case "cat":
          this.creatureRenderers.set(type, new CatRenderer());
          break;
        case "fish":
          this.creatureRenderers.set(type, new FishRenderer());
          break;
        default:
          // Placeholder renderer for unimplemented creatures
          this.creatureRenderers.set(type, {
            update: () => {},
            draw: () => {},
          });
      }
    }
    return this.creatureRenderers.get(type)!;
  }

  // Particle system reference (set by component)
  particleSystem: ParticleSystemService | null = null;

  // Music engine reference (set by component)
  musicEngine: MusicEngineService | null = null;

  // ============================================
  // LIFECYCLE
  // ============================================

  registerScene(scene: SceneDefinition): void {
    this.scenes.set(scene.id, scene);
  }

  setupCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();

    // Mouse tracking
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("click", this.handleClick);
    canvas.addEventListener("mouseleave", this.handleMouseLeave);
  }

  resize(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx?.scale(dpr, dpr);
  }

  loadScene(sceneId: string, restorationProgress: number = 0): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) return;

    this.activeScene = scene;
    this.currentSceneId = sceneId;
    this.restorationTarget = restorationProgress;
    this.restorationCurrent = restorationProgress;
    this.sceneStartTime = performance.now() / 1000;

    // Set up particles for this scene
    if (this.particleSystem) {
      this.particleSystem.clear();
      for (const emitter of scene.particles) {
        this.particleSystem.addEmitter(emitter, restorationProgress);
      }
    }

    // Set up creatures for this scene
    this.creatureStates = scene.creatures.map((config) => ({
      x: config.x,
      y: config.y,
      animation: "idle" as const,
      animTime: 0,
      facing: "right" as const,
      scale: config.scale ?? 1,
      visible: config.showWhen === "always" || (config.showWhen === "restored" && restorationProgress >= 0.8),
    }));

    // Start scene music
    if (this.musicEngine) {
      this.musicEngine.playScene(scene.music);
      this.musicEngine.updateRestoration(restorationProgress);
    }
  }

  transitionTo(sceneId: string, restorationProgress: number = 0): void {
    this.pendingSceneId = sceneId;
    this.transitionTarget = 1; // fade to black
    // The render loop will detect when transition completes and swap scenes

    // Store restoration for after transition
    this._pendingRestoration = restorationProgress;
  }

  private _pendingRestoration = 0;

  startRenderLoop(): void {
    this.lastTime = performance.now() / 1000;
    this.renderFrame();
  }

  stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  willDestroy(): void {
    this.stopRenderLoop();
    if (this.canvas) {
      this.canvas.removeEventListener("mousemove", this.handleMouseMove);
      this.canvas.removeEventListener("click", this.handleClick);
      this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
    }
    this.canvas = null;
    this.ctx = null;
    super.willDestroy();
  }

  // ============================================
  // RESTORATION
  // ============================================

  setRestorationProgress(progress: number, animated = true): void {
    this.restorationTarget = Math.max(0, Math.min(1, progress));
    if (!animated) {
      this.restorationCurrent = this.restorationTarget;
    }
  }

  triggerRestoration(): void {
    // Animate from current to 1.0
    this.restorationTarget = 1;
    this.restorationSpeed = 0.6; // dramatic reveal over ~1.7 seconds
  }

  get restorationProgress(): number {
    return this.restorationCurrent;
  }

  // ============================================
  // RENDER LOOP
  // ============================================

  private renderFrame = (): void => {
    this.animationId = requestAnimationFrame(this.renderFrame);

    const now = performance.now() / 1000;
    const dt = Math.min(now - this.lastTime, 0.1); // cap at 100ms
    this.lastTime = now;

    if (!this.ctx || !this.canvas || !this.activeScene) return;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const time = now - this.sceneStartTime;

    // Update restoration animation
    if (this.restorationCurrent !== this.restorationTarget) {
      const diff = this.restorationTarget - this.restorationCurrent;
      const step = this.restorationSpeed * dt;
      if (Math.abs(diff) < step) {
        this.restorationCurrent = this.restorationTarget;
      } else {
        this.restorationCurrent += Math.sign(diff) * step;
      }
      // Update music to match restoration
      this.musicEngine?.updateRestoration(this.restorationCurrent);
    }

    // Update scene transition
    if (this.transitionAlpha !== this.transitionTarget) {
      const diff = this.transitionTarget - this.transitionAlpha;
      const speed = 3.0; // fade speed
      const step = speed * dt;
      if (Math.abs(diff) < step) {
        this.transitionAlpha = this.transitionTarget;
        // If we just reached full black, swap scenes
        if (this.transitionAlpha >= 1 && this.pendingSceneId) {
          this.loadScene(this.pendingSceneId, this._pendingRestoration);
          this.pendingSceneId = null;
          this.transitionTarget = 0; // fade back in
        }
      } else {
        this.transitionAlpha += Math.sign(diff) * step;
      }
    }

    // Compute interpolated visuals
    const visuals = lerpVisuals(
      this.activeScene.cursedVisuals,
      this.activeScene.restoredVisuals,
      this.restorationCurrent,
    );

    // Build render context
    const rc: SceneRenderContext = {
      ctx: this.ctx,
      width,
      height,
      time,
      dt,
      restorationProgress: this.restorationCurrent,
      visuals,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
    };

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply global grayscale + brightness filter based on restoration
    const gray = 1 - visuals.saturation;
    const bright = visuals.brightness;
    this.ctx.filter =
      gray > 0.01 || bright < 0.99
        ? `grayscale(${gray}) brightness(${bright})`
        : "none";

    // Draw scene layers back-to-front with parallax
    const parallaxBaseX = (this.mouseX - 0.5) * width * 0.03;
    const parallaxBaseY = (this.mouseY - 0.5) * height * 0.015;

    for (const layer of this.activeScene.layers) {
      this.ctx.save();
      const offsetX = parallaxBaseX * layer.parallax;
      const offsetY = parallaxBaseY * layer.parallax;
      this.ctx.translate(offsetX, offsetY);
      layer.draw(rc);
      this.ctx.restore();
    }

    // Reset filter for particles and overlays
    this.ctx.filter = "none";

    // Draw particles
    if (this.particleSystem) {
      this.particleSystem.update(dt, this.restorationCurrent);
      this.particleSystem.draw(this.ctx, width, height);
    }

    // Draw creatures
    if (this.activeScene) {
      for (let i = 0; i < this.creatureStates.length; i++) {
        const state = this.creatureStates[i];
        const config = this.activeScene.creatures[i];
        if (!state || !config) continue;

        const renderer = this.getCreatureRenderer(config.type);
        renderer.update(state, dt, this.restorationCurrent);
        renderer.draw(this.ctx, state, this.restorationCurrent, width, height);
      }
    }

    // Draw hotspot hints — subtle shimmer on interactive areas
    this.drawHotspotHints(rc);

    // Draw fog overlay
    if (visuals.fogDensity > 0.01) {
      this.drawFog(rc, visuals.fogDensity, time);
    }

    // Draw transition overlay (black fade)
    if (this.transitionAlpha > 0.01) {
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.transitionAlpha})`;
      this.ctx.fillRect(0, 0, width, height);
    }
  };

  // ============================================
  // FOG
  // ============================================

  // Fog particles — many small soft circles for organic feel
  private fogPuffs: Array<{ x: number; y: number; r: number; speed: number; phase: number }> = [];

  private ensureFogPuffs(): void {
    if (this.fogPuffs.length > 0) return;
    // Generate 20 fog puffs at various positions
    for (let i = 0; i < 20; i++) {
      this.fogPuffs.push({
        x: Math.random() * 1.2 - 0.1, // slightly outside bounds
        y: 0.2 + Math.random() * 0.6,
        r: 0.05 + Math.random() * 0.1,
        speed: 0.01 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private drawFog(
    rc: SceneRenderContext,
    density: number,
    time: number,
  ): void {
    if (density <= 0.01) return;
    this.ensureFogPuffs();

    rc.ctx.save();
    const fogColor = rc.visuals.palette.fog ?? "#8899aa";

    for (const puff of this.fogPuffs) {
      // Drift slowly
      const x = ((puff.x + Math.sin(time * puff.speed + puff.phase) * 0.05) % 1.2) * rc.width;
      const y = puff.y * rc.height + Math.cos(time * puff.speed * 0.7 + puff.phase) * 10;
      const r = puff.r * rc.width;

      // Soft radial gradient for each puff
      const grad = rc.ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, fogColor);
      grad.addColorStop(0.4, fogColor);
      grad.addColorStop(1, "transparent");

      rc.ctx.globalAlpha = density * (0.08 + puff.r * 0.5);
      rc.ctx.fillStyle = grad;
      rc.ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    rc.ctx.restore();
  }

  // ============================================
  // HOTSPOT HINTS
  // ============================================

  private drawHotspotHints(rc: SceneRenderContext): void {
    if (!this.activeScene) return;

    for (const hotspot of this.activeScene.hotspots) {
      // Only show hints for puzzle and pickup actions (not examine)
      // Hide hints on restored scenes (puzzles already solved)
      if (hotspot.action === "examine") continue;
      if (this.restorationCurrent >= 0.9) continue;

      const b = hotspot.bounds;
      const x = (b.x / 1200) * rc.width;
      const y = ((b.y - 180) / 500) * rc.height;
      const w = (b.width / 1200) * rc.width;
      const h = (b.height / 500) * rc.height;
      const cx = x + w / 2;
      const cy = y + h / 2;

      // Pulsing golden glow — clearly visible
      const pulse = Math.sin(rc.time * 2.5 + b.x * 0.01) * 0.4 + 0.6;

      // Outer glow
      rc.ctx.globalAlpha = 0.15 * pulse;
      const outerGrad = rc.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.5);
      outerGrad.addColorStop(0, "#ffd700");
      outerGrad.addColorStop(0.6, "#ffd70044");
      outerGrad.addColorStop(1, "transparent");
      rc.ctx.fillStyle = outerGrad;
      rc.ctx.fillRect(cx - w, cy - h, w * 2, h * 2);

      // Center sparkle dot
      rc.ctx.globalAlpha = 0.4 * pulse;
      rc.ctx.fillStyle = "#ffd700";
      rc.ctx.beginPath();
      rc.ctx.arc(cx, cy, 3 * (rc.width / 1200), 0, Math.PI * 2);
      rc.ctx.fill();

      // Small cross sparkle
      rc.ctx.strokeStyle = "#ffd700";
      rc.ctx.lineWidth = 1;
      rc.ctx.globalAlpha = 0.25 * pulse;
      const sparkleSize = 8 * (rc.width / 1200);
      rc.ctx.beginPath();
      rc.ctx.moveTo(cx - sparkleSize, cy);
      rc.ctx.lineTo(cx + sparkleSize, cy);
      rc.ctx.moveTo(cx, cy - sparkleSize);
      rc.ctx.lineTo(cx, cy + sparkleSize);
      rc.ctx.stroke();
    }
    rc.ctx.globalAlpha = 1;
  }

  // ============================================
  // INPUT
  // ============================================

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = (e.clientX - rect.left) / rect.width;
    this.mouseY = (e.clientY - rect.top) / rect.height;

    // Update cursor based on hotspot hover
    const hotspot = this.hitTestHotspot(this.mouseX, this.mouseY);
    this.canvas.style.cursor = hotspot ? (hotspot.cursor ?? "pointer") : "default";
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.canvas || !this.onHotspotClick) return;
    const rect = this.canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const hotspot = this.hitTestHotspot(nx, ny);
    if (hotspot) {
      this.onHotspotClick(hotspot.action, hotspot.target);
    }
  };

  private handleMouseLeave = (): void => {
    this.mouseX = 0.5;
    this.mouseY = 0.5;
  };

  private hitTestHotspot(nx: number, ny: number): Hotspot | null {
    if (!this.activeScene) return null;

    // Convert normalized coords to scene coordinates
    // ViewBox is "0 180 1200 500" so visible range is X:0-1200, Y:180-680
    const sceneX = nx * 1200;
    const sceneY = ny * 500 + 180;

    // Two-pass: puzzle/pickup first (higher priority), then examine
    let examineHit: Hotspot | null = null;

    for (const hotspot of this.activeScene.hotspots) {
      const b = hotspot.bounds;
      if (
        sceneX >= b.x &&
        sceneX <= b.x + b.width &&
        sceneY >= b.y &&
        sceneY <= b.y + b.height
      ) {
        if (hotspot.action === "puzzle" || hotspot.action === "pickup" || hotspot.action === "use") {
          return hotspot; // High priority — return immediately
        }
        if (!examineHit) {
          examineHit = hotspot; // Low priority — save for later
        }
      }
    }

    return examineHit;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Trigger a particle burst at a position (for pickup effects etc)
   */
  burst(x: number, y: number, color: string, count = 20): void {
    this.particleSystem?.burst(x, y, count, {
      id: "burst",
      x,
      y,
      rate: 0,
      lifetime: [0.5, 1.5],
      velocity: { x: [-100, 100], y: [-150, 50] },
      size: [2, 6],
      cursedColor: color,
      restoredColor: color,
      shape: "star",
      gravity: 80,
      blendMode: "lighter",
    });
  }

  getActiveScene(): SceneDefinition | null {
    return this.activeScene;
  }
}
