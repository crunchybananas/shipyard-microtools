/**
 * CameraController — scale-aware camera with first-person surface mode.
 *
 * Modes:
 *   SPACE  — drag-to-pan the universe (existing behaviour, delegated to app.gts).
 *   SURFACE — FPS-style: mouse drag rotates the view, WASD walks over terrain.
 *
 * The controller exposes `lookAngle` and position deltas each frame which the
 * renderer feeds into the terrain shader.
 */
import { type InputManager, type MovementVector } from './input-manager';

export type CameraMode = 'space' | 'surface';

/** Named speed tiers for surface exploration. */
export interface SpeedTier {
  name: string;
  speed: number;
}

const SPEED_TIERS: SpeedTier[] = [
  { name: 'Creep', speed: 0.08 },
  { name: 'Walk', speed: 0.25 },
  { name: 'Jog', speed: 0.55 },
  { name: 'Run', speed: 1.2 },
  { name: 'Sprint', speed: 2.5 },
  { name: 'Fly', speed: 6.0 },
];

/** Read-only snapshot of controller state for the current frame. */
export interface SurfaceCamera {
  /** Horizontal look direction in radians. */
  lookAngle: number;
  /** Vertical look pitch (−π/4 … π/6). */
  lookPitch: number;
  /** Current speed magnitude. */
  speed: number;
  /** Current speed tier name. */
  speedTierName: string;
  /** Current speed tier index (0-based). */
  speedTierIndex: number;
  /** Total number of speed tiers. */
  speedTierCount: number;
}

const SURFACE_ZOOM_THRESHOLD = 500_000;

export class CameraController {
  // ─── Surface-mode state ────────────────────────────────────────────
  /** Horizontal look direction in radians. */
  lookAngle = 0;
  /** Vertical look pitch. */
  lookPitch = -0.08;

  private speedTierIndex = 2; // Start at "Jog"
  private sprintMultiplier = 2.0;
  private turnSpeed = 1.8; // radians · s⁻¹ via keyboard Q/E

  /** Damped velocity for smooth starts/stops. */
  private velocityX = 0;
  private velocityZ = 0;
  private damping = 0.82;

  // ─── Public API ────────────────────────────────────────────────────

  /** Current camera mode based on zoom level. */
  mode(zoom: number): CameraMode {
    return zoom >= SURFACE_ZOOM_THRESHOLD ? 'surface' : 'space';
  }

  /** Cycle speed tier up (+1) or down (−1). Returns true if changed. */
  adjustSpeed(direction: number): boolean {
    const next = this.speedTierIndex + (direction > 0 ? 1 : -1);
    if (next < 0 || next >= SPEED_TIERS.length) return false;
    this.speedTierIndex = next;
    return true;
  }

  /**
   * Call once per frame.
   *
   * @returns position delta {dx, dy} to apply to the camera in app.gts.
   */
  update(
    input: InputManager,
    zoom: number,
    dt: number,
  ): { dx: number; dy: number } {
    if (this.mode(zoom) !== 'surface') {
      // Reset surface state when leaving surface mode
      this.velocityX = 0;
      this.velocityZ = 0;
      return { dx: 0, dy: 0 };
    }

    const mv: MovementVector = input.getMovement();
    const tier = SPEED_TIERS[this.speedTierIndex]!;
    const speed = tier.speed * (input.sprint ? this.sprintMultiplier : 1);

    // Rotate look via Q / E
    if (input.isDown('q')) this.lookAngle -= this.turnSpeed * dt;
    if (input.isDown('e')) this.lookAngle += this.turnSpeed * dt;

    // Forward/right vectors in world-plane (XZ → XY screen)
    const fwdX = Math.cos(this.lookAngle);
    const fwdY = Math.sin(this.lookAngle);
    const rightX = -fwdY; // perpendicular
    const rightY = fwdX;

    // Target velocity from input
    const targetVX = (fwdX * mv.z + rightX * mv.x) * speed;
    const targetVZ = (fwdY * mv.z + rightY * mv.x) * speed;

    // Damped interpolation
    this.velocityX += (targetVX - this.velocityX) * (1 - this.damping);
    this.velocityZ += (targetVZ - this.velocityZ) * (1 - this.damping);

    // Kill tiny residual drift
    if (Math.abs(this.velocityX) < 0.001) this.velocityX = 0;
    if (Math.abs(this.velocityZ) < 0.001) this.velocityZ = 0;

    return {
      dx: this.velocityX * dt * 60, // frame-rate independent
      dy: this.velocityZ * dt * 60,
    };
  }

  /**
   * Apply mouse drag delta (pixels) to view direction when in surface mode.
   * Called from the pointer-move handler.
   */
  applyMouseLook(rawDx: number, rawDy: number): void {
    const sensitivity = 0.004;
    this.lookAngle += rawDx * sensitivity;
    this.lookPitch = Math.max(
      -Math.PI / 4,
      Math.min(Math.PI / 6, this.lookPitch - rawDy * sensitivity),
    );
  }

  /** Snapshot for the shader uniforms and HUD. */
  getSurfaceCamera(): SurfaceCamera {
    return {
      lookAngle: this.lookAngle,
      lookPitch: this.lookPitch,
      speed: Math.sqrt(this.velocityX ** 2 + this.velocityZ ** 2),
      speedTierName: SPEED_TIERS[this.speedTierIndex]!.name,
      speedTierIndex: this.speedTierIndex,
      speedTierCount: SPEED_TIERS.length,
    };
  }

  /** Reset state (e.g. when entering surface for the first time). */
  reset(): void {
    this.lookAngle = 0;
    this.lookPitch = -0.08;
    this.velocityX = 0;
    this.velocityZ = 0;
    this.speedTierIndex = 2; // Reset to "Jog"
  }
}
