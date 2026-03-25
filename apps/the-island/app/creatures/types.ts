/**
 * Creature Animation Types
 *
 * Creatures are drawn procedurally on Canvas 2D.
 * Each creature has a state machine (idle, walk, react, freed)
 * and a renderer that draws it based on current state + time.
 */

export interface CreatureState {
  x: number;
  y: number;
  animation: "idle" | "walk" | "react" | "freed";
  animTime: number; // seconds in current animation
  facing: "left" | "right";
  scale: number;
  visible: boolean;
}

export interface CreatureRenderer {
  /** Update animation state each frame */
  update(state: CreatureState, dt: number, restorationProgress: number): void;

  /** Draw the creature onto the canvas */
  draw(
    ctx: CanvasRenderingContext2D,
    state: CreatureState,
    restorationProgress: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void;
}

/** Convert scene coordinates to canvas pixels */
export function sceneToCanvas(
  sceneX: number,
  sceneY: number,
  canvasWidth: number,
  canvasHeight: number,
): [number, number] {
  // Scene coords are 1200x800, viewBox is "0 180 1200 500"
  const px = (sceneX / 1200) * canvasWidth;
  const py = ((sceneY - 180) / 500) * canvasHeight;
  return [px, py];
}
