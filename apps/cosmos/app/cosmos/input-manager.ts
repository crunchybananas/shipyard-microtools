/**
 * InputManager — centralised keyboard & modifier state tracking.
 *
 * Lifecycle: attach(element) → reads keydown / keyup / blur → destroy()
 *
 * Designed to be consumed by CameraController each frame.
 */
export interface MovementVector {
  /** Strafe: −1 left … +1 right */
  x: number;
  /** Forward/back: −1 back … +1 forward */
  z: number;
  /** Vertical: −1 down … +1 up */
  y: number;
}

export class InputManager {
  private keys = new Set<string>();
  private target: HTMLElement | null = null;

  private onKeyDown = (e: KeyboardEvent): void => {
    // Avoid capturing browser-level shortcuts (Cmd/Ctrl combos)
    if (e.metaKey || e.ctrlKey) return;
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onBlur = (): void => {
    // Prevent stuck keys when window/element loses focus
    this.keys.clear();
  };

  /** Start listening on the given element (must be focusable). */
  attach(el: HTMLElement): void {
    this.target = el;

    // Ensure the canvas can receive keyboard focus
    if (!el.hasAttribute("tabindex")) {
      el.setAttribute("tabindex", "0");
    }
    el.style.outline = "none"; // hide focus ring

    el.addEventListener("keydown", this.onKeyDown);
    el.addEventListener("keyup", this.onKeyUp);
    el.addEventListener("blur", this.onBlur);
    window.addEventListener("blur", this.onBlur);
  }

  /** Clean up all listeners. */
  destroy(): void {
    if (this.target) {
      this.target.removeEventListener("keydown", this.onKeyDown);
      this.target.removeEventListener("keyup", this.onKeyUp);
      this.target.removeEventListener("blur", this.onBlur);
    }
    window.removeEventListener("blur", this.onBlur);
    this.keys.clear();
    this.target = null;
  }

  /** True if the named key is currently held. */
  isDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /** Sprint modifier (Shift). */
  get sprint(): boolean {
    return this.keys.has("shift");
  }

  /**
   * Normalised WASD / Arrow movement vector (length 0 or ~1).
   * +z = forward, +x = right.
   */
  getMovement(): MovementVector {
    let x = 0;
    let z = 0;
    let y = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) z += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) z -= 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("e") || this.keys.has(" ")) y += 1;
    if (this.keys.has("q")) y -= 1;

    // Normalise diagonal movement
    const len = Math.sqrt(x * x + z * z);
    if (len > 1) {
      x /= len;
      z /= len;
    }

    return { x, z, y };
  }

  /** True when any movement key is held. */
  get hasMovement(): boolean {
    const m = this.getMovement();
    return m.x !== 0 || m.z !== 0 || m.y !== 0;
  }
}
