/**
 * The Fading Kingdom — Scene Type Definitions
 *
 * Every scene, creature, particle, and hotspot is defined through these types.
 * The Canvas 2D engine reads SceneDefinitions and renders them each frame.
 */

// ============================================
// VISUAL STATE — drives cursed→restored interpolation
// ============================================

export interface ColorPalette {
  sky: [string, string]; // gradient top, bottom
  ground: [string, string];
  accent: string;
  water?: [string, string];
  fog?: string;
}

export interface VisualState {
  saturation: number; // 0 = grayscale, 1 = full color
  brightness: number; // 0.3 = dark cursed, 1 = bright restored
  fogDensity: number; // 1 = thick fog, 0 = clear
  palette: ColorPalette;
}

// ============================================
// SCENE LAYERS — drawn back-to-front each frame
// ============================================

export interface SceneRenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number; // seconds since scene loaded
  dt: number; // delta time this frame
  restorationProgress: number; // 0→1
  visuals: VisualState; // interpolated between cursed/restored
  mouseX: number; // 0-1 normalized mouse position
  mouseY: number;
}

export interface SceneLayer {
  id: string;
  parallax: number; // 0 = static sky, 1 = foreground
  draw: (rc: SceneRenderContext) => void;
}

// ============================================
// HOTSPOTS — clickable regions on canvas
// ============================================

export interface HotspotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HotspotAction = "examine" | "pickup" | "use" | "puzzle";

export interface Hotspot {
  id: string;
  bounds: HotspotBounds;
  action: HotspotAction;
  target: string;
  cursor?: "pointer" | "grab" | "help";
  isVisible?: (restorationProgress: number, flags: GameFlags) => boolean;
}

// ============================================
// CREATURES — animated canvas entities
// ============================================

export type CreatureType =
  | "crab"
  | "owl"
  | "fox"
  | "unicorn"
  | "phoenix"
  | "cat"
  | "fish"
  | "butterfly";

export interface CreatureConfig {
  id: string;
  type: CreatureType;
  x: number; // position in scene coordinates (0-1200)
  y: number;
  scale?: number;
  showWhen: "cursed" | "restored" | "always";
}

// ============================================
// PARTICLES — configurable emitter system
// ============================================

export type ParticleShape = "circle" | "star" | "line" | "snowflake";

export interface ParticleEmitterConfig {
  id: string;
  x: number;
  y: number;
  width?: number; // emission area width (default: point emitter)
  height?: number;
  rate: number; // particles per second
  lifetime: [number, number]; // min, max seconds
  velocity: { x: [number, number]; y: [number, number] };
  size: [number, number]; // min, max radius
  cursedColor: string;
  restoredColor: string;
  shape: ParticleShape;
  gravity?: number;
  fadeIn?: number; // seconds to fade in
  fadeOut?: number; // seconds to fade out
  blendMode?: GlobalCompositeOperation;
  showWhen?: "cursed" | "restored" | "always";
}

// ============================================
// MUSIC — per-scene audio parameters
// ============================================

export interface MusicParams {
  // Base drone (always playing)
  droneFreq: number;
  droneType: OscillatorType;
  droneVolume: number;

  // Musical scale (semitone intervals from base)
  baseNote: number; // MIDI note number (60 = middle C)
  scale: number[]; // e.g. [0, 2, 3, 5, 7, 8, 10] for natural minor

  // Rhythm
  tempo: number; // BPM

  // Filter (opens as restoration progresses)
  cursedFilterCutoff: number; // Hz, low = muffled
  restoredFilterCutoff: number; // Hz, high = bright

  // Restored-state melody (played when progress > 0.5)
  melodyPattern?: number[]; // scale degree indices
  melodyRhythm?: number[]; // durations in beats

  // Ambient sound type
  ambientType: "rain" | "wind" | "silence" | "water" | "fire";
  ambientVolume: number;
}

// ============================================
// GAME FLAGS — per-scene state
// ============================================

export interface GameFlags {
  // Restoration progress per scene (0-1, animated by engine)
  restoration: Record<string, number>;
  // Tokens collected (scene IDs)
  tokens: string[];
  // Scene-specific puzzle state
  shellsFound: number;
  cageSymbols: number[];
  crystalAngles: number[];
  potionIngredients: string[];
  colorFragments: string[];
  melodyAttempt: number[];
  drawingPoints: Array<[number, number]>;
  // General
  currentPuzzle: string | null;
}

// ============================================
// SCENE DEFINITION — the complete scene contract
// ============================================

export interface SceneExit {
  scene: string;
  requires?: string; // flag key that must be truthy
}

export interface SceneDefinition {
  id: string;
  name: string;

  // Story
  cursedDescription: string;
  restoredDescription: string;

  // Navigation
  exits: Record<string, string | SceneExit>;

  // Items available in scene
  items: string[];

  // Rendering
  layers: SceneLayer[];
  cursedVisuals: VisualState;
  restoredVisuals: VisualState;

  // Interactive elements
  hotspots: Hotspot[];

  // Living world
  creatures: CreatureConfig[];
  particles: ParticleEmitterConfig[];

  // Audio
  music: MusicParams;

  // Puzzle
  puzzleId: string;
  guardianCreature: CreatureType;
  restorationToken: string;
}

// ============================================
// HELPERS
// ============================================

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function lerpColor(
  colorA: string,
  colorB: string,
  t: number,
): string {
  // Parse hex colors and interpolate RGB
  const parseHex = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  };
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

export function lerpVisuals(
  cursed: VisualState,
  restored: VisualState,
  t: number,
): VisualState {
  return {
    saturation: lerp(cursed.saturation, restored.saturation, t),
    brightness: lerp(cursed.brightness, restored.brightness, t),
    fogDensity: lerp(cursed.fogDensity, restored.fogDensity, t),
    palette: {
      sky: [
        lerpColor(cursed.palette.sky[0], restored.palette.sky[0], t),
        lerpColor(cursed.palette.sky[1], restored.palette.sky[1], t),
      ],
      ground: [
        lerpColor(cursed.palette.ground[0], restored.palette.ground[0], t),
        lerpColor(cursed.palette.ground[1], restored.palette.ground[1], t),
      ],
      accent: lerpColor(cursed.palette.accent, restored.palette.accent, t),
      water:
        cursed.palette.water && restored.palette.water
          ? [
              lerpColor(cursed.palette.water[0], restored.palette.water[0], t),
              lerpColor(cursed.palette.water[1], restored.palette.water[1], t),
            ]
          : undefined,
      fog: cursed.palette.fog && restored.palette.fog
        ? lerpColor(cursed.palette.fog, restored.palette.fog, t)
        : undefined,
    },
  };
}
