// Star rendering: instanced particles + overlay labels
import type { Star } from 'cosmos/services/universe-generator';
import {
  SeededRandom,
  getSeed,
  generateStar,
} from 'cosmos/services/universe-generator';
import { hexToRGB } from './cosmos-engine';
import { getStarEvolution } from './cosmic-time';
import { type RenderContext, worldToScreen } from './render-context';

export interface CachedStar extends Star {
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  screenSize: number;
}

export function renderStars(
  ctx: RenderContext,
  left: number, right: number, top: number, bottom: number,
): CachedStar[] {
  const gridSize = 50;
  const startX = Math.floor(left / gridSize) * gridSize;
  const startY = Math.floor(top / gridSize) * gridSize;
  const starEvo = getStarEvolution(ctx.cosmicTime);

  ctx.particles.reset();
  const cached: CachedStar[] = [];

  const cssW = ctx.overlayCanvas?.width ?? window.innerWidth;
  const cssH = ctx.overlayCanvas?.height ?? window.innerHeight;

  for (let x = startX; x < right + gridSize; x += gridSize) {
    for (let y = startY; y < bottom + gridSize; y += gridSize) {
      const seed = getSeed(x, y, 1);
      const rng = new SeededRandom(seed);

      if (rng.next() > 0.3) continue;

      // Skip stars based on cosmic time (fewer stars in early/late universe)
      if (rng.next() > starEvo.countMultiplier) continue;

      const star = generateStar(seed);
      const sx = x + rng.range(5, gridSize - 5);
      const sy = y + rng.range(5, gridSize - 5);

      const screen = worldToScreen(sx, sy, ctx.camera, ctx.overlayCanvas);
      const baseSize = 2 + star.radius * 2;
      const screenSize = baseSize * (ctx.camera.zoom / 100);

      if (
        screen.x > -screenSize * 3 && screen.x < cssW + screenSize * 3 &&
        screen.y > -screenSize * 3 && screen.y < cssH + screenSize * 3
      ) {
        const [r, g, b] = hexToRGB(star.color);
        const evoAlpha = starEvo.brightnessMult;
        ctx.particles.add(
          sx, sy, baseSize * starEvo.sizeMultiplier, r, g, b, evoAlpha, 1.0,
        );

        cached.push({
          ...star,
          worldX: sx, worldY: sy,
          screenX: screen.x, screenY: screen.y, screenSize,
        });

        if (ctx.camera.zoom > 1000 && screenSize > 3 && ctx.overlayCtx) {
          ctx.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.overlayCtx.font = "11px SF Pro Display, sans-serif";
          ctx.overlayCtx.textAlign = "center";
          ctx.overlayCtx.fillText(star.name, screen.x, screen.y + screenSize * 3 + 15);
        }
      }
    }
  }

  ctx.engine.drawParticles(
    ctx.particles.getData(),
    ctx.camera.x, ctx.camera.y, ctx.camera.zoom,
  );

  return cached;
}
