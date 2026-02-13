// Shared context passed to all renderer modules
import type { CosmosEngine, ParticleBuilder } from './cosmos-engine';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
  targetX: number;
  targetY: number;
}

export interface RenderContext {
  engine: CosmosEngine;
  particles: ParticleBuilder;
  overlayCtx: CanvasRenderingContext2D | null;
  overlayCanvas: HTMLCanvasElement | null;
  camera: Camera;
  time: number;
  cosmicTime: number;
}

export function worldToScreen(
  wx: number, wy: number,
  camera: Camera,
  overlayCanvas: HTMLCanvasElement | null,
): { x: number; y: number } {
  const cssW = overlayCanvas?.width ?? window.innerWidth;
  const cssH = overlayCanvas?.height ?? window.innerHeight;
  return {
    x: (wx - camera.x) * camera.zoom + cssW / 2,
    y: (wy - camera.y) * camera.zoom + cssH / 2,
  };
}
