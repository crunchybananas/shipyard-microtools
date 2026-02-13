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

/** Read-only snapshot of controller state for the current frame. */
export interface SurfaceCamera {
  /** Horizontal look direction in radians. */
  lookAngle: number;
  /** Vertical look pitch (−π/4 … π/6). */
  lookPitch: number;
  /** Movement speed multiplier (0 = stationary). */
  speed: number;
}

const SURFACE_ZOOM_THRESHOLD = 500_000;

export class CameraController {
  // ─── Surface-mode state ────────────────────────────────────────────
  /** Horizontal look direction in radians. */
  lookAngle = 0;
  /** Vertical look pitch. */
  lookPitch = -0.08;

  private walkSpeed = 0.35;
  private sprintMultiplier = 2.5;
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
    const speed = this.walkSpeed * (input.sprint ? this.sprintMultiplier : 1);

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

  /** Snapshot for the shader uniforms. */
  getSurfaceCamera(): SurfaceCamera {
    return {
      lookAngle: this.lookAngle,
      lookPitch: this.lookPitch,
      speed: Math.sqrt(this.velocityX ** 2 + this.velocityZ ** 2),
    };
  }

  /** Reset state (e.g. when entering surface for the first time). */
  reset(): void {
    this.lookAngle = 0;
    this.lookPitch = -0.08;
    this.velocityX = 0;
    this.velocityZ = 0;
  }
}
