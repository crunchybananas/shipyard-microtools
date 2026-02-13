// Galaxy rendering: instanced particles + procedural disc shader + overlay labels
import type { Galaxy } from 'cosmos/services/universe-generator';
import {
  SeededRandom,
  getSeed,
  generateGalaxy,
} from 'cosmos/services/universe-generator';
import { getGalaxyEvolution } from './cosmic-time';
import { type RenderContext, worldToScreen } from './render-context';

export interface CachedGalaxy extends Galaxy {
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  screenSize: number;
}

export function renderGalaxies(
  ctx: RenderContext,
  left: number, right: number, top: number, bottom: number,
): CachedGalaxy[] {
  const gridSize = 200;
  const startX = Math.floor(left / gridSize) * gridSize;
  const startY = Math.floor(top / gridSize) * gridSize;
  const galaxyEvo = getGalaxyEvolution(ctx.cosmicTime);

  ctx.particles.reset();
  const cached: CachedGalaxy[] = [];

  const cssW = ctx.overlayCanvas?.width ?? window.innerWidth;
  const cssH = ctx.overlayCanvas?.height ?? window.innerHeight;

  for (let x = startX; x < right + gridSize; x += gridSize) {
    for (let y = startY; y < bottom + gridSize; y += gridSize) {
      const seed = getSeed(x, y, 0);
      const rng = new SeededRandom(seed);

      if (rng.next() > 0.4) continue;

      const galaxy = generateGalaxy(seed);
      const gx = x + rng.range(20, gridSize - 20);
      const gy = y + rng.range(20, gridSize - 20);

      const screen = worldToScreen(gx, gy, ctx.camera, ctx.overlayCanvas);
      const size = 30 * galaxy.size * ctx.camera.zoom;

      if (
        screen.x > -size && screen.x < cssW + size &&
        screen.y > -size && screen.y < cssH + size
      ) {
        // Skip galaxies that don't exist yet in the current era
        if (galaxyEvo.brightness < 0.01) continue;

        // Draw procedural galaxy disc shader (background layer)
        const [resW] = ctx.engine.getResolution();
        const dpr = resW / cssW;
        const galaxyTypeIdx = galaxy.type === "elliptical" ? 1
          : (galaxy.type === "irregular" ? 2 : 0);
        ctx.engine.drawGalaxyDisc(
          screen.x * dpr, (cssH - screen.y) * dpr, size * dpr,
          galaxy.rotation, galaxy.tilt,
          galaxy.arms, galaxyEvo.armDefinition,
          galaxyEvo.brightness, galaxy.seed,
          galaxyTypeIdx,
        );

        addGalaxyParticles(
          ctx, galaxy, gx, gy,
          30 * galaxy.size * galaxyEvo.sizeMultiplier,
          galaxyEvo.brightness,
          galaxyEvo.armDefinition,
        );

        cached.push({
          ...galaxy,
          worldX: gx, worldY: gy,
          screenX: screen.x, screenY: screen.y, screenSize: size,
        });

        if (ctx.camera.zoom > 10 && size > 40 && ctx.overlayCtx) {
          ctx.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.overlayCtx.font = "12px SF Pro Display, sans-serif";
          ctx.overlayCtx.textAlign = "center";
          ctx.overlayCtx.fillText(galaxy.name, screen.x, screen.y + size + 20);
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

function addGalaxyParticles(
  ctx: RenderContext,
  galaxy: Galaxy, worldX: number, worldY: number, worldSize: number,
  brightness = 1.0, armDef = 1.0,
): void {
  const rng = new SeededRandom(galaxy.seed);

  // Soft-disc glow underlay behind each galaxy (removes "box" look)
  for (let i = 0; i < 5; i++) {
    const glowDist = rng.range(0, worldSize * 0.3) * rng.range(0, 1);
    const glowAngle = rng.range(0, Math.PI * 2);
    const gx = worldX + Math.cos(glowAngle) * glowDist;
    const gy = worldY + Math.sin(glowAngle) * glowDist * galaxy.tilt;
    const glowSize = worldSize * rng.range(0.5, 0.9);
    ctx.particles.add(gx, gy, glowSize, 0.7, 0.75, 1.0, brightness * 0.04, 0.8);
  }

  // Extend particle spread slightly beyond worldSize for feathered edges
  const outerSize = worldSize * 1.15;

  if ((galaxy.type === "spiral" || galaxy.type === "barred_spiral") && armDef > 0.1) {
    for (let arm = 0; arm < galaxy.arms; arm++) {
      const armAngle = (arm / galaxy.arms) * Math.PI * 2;
      const perArm = galaxy.starCount / galaxy.arms;
      for (let i = 0; i < perArm; i++) {
        const t = i / perArm;
        const distance = t * outerSize;
        const baseSpread = outerSize * 0.15;
        const spread = rng.range(-baseSpread, baseSpread) * (2 - armDef);
        const angle = armAngle + t * 3 * armDef + spread * 0.01 + galaxy.rotation;
        const px = worldX + Math.cos(angle) * distance + rng.range(-0.5, 0.5);
        const py = worldY + Math.sin(angle) * distance * galaxy.tilt + rng.range(-0.5, 0.5);
        const radialDist = Math.sqrt((px - worldX) ** 2 + ((py - worldY) / galaxy.tilt) ** 2);
        const radialFade = 1.0 - Math.pow(Math.min(radialDist / outerSize, 1.0), 2.0);
        const b = (1 - t * 0.7) * rng.range(0.3, 1) * brightness * radialFade;
        const starSize = rng.range(0.3, 1.2) * (1 - t * 0.5);
        if (b > 0.01) {
          ctx.particles.add(px, py, starSize, 1, 1, 1, b * 0.6, b * 0.3);
        }
      }
    }
  } else if (galaxy.type === "elliptical") {
    for (let i = 0; i < galaxy.starCount; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(0, 1) * rng.range(0, 1) * outerSize;
      const px = worldX + Math.cos(angle) * dist * 1.5;
      const py = worldY + Math.sin(angle) * dist;
      const radialDist = Math.sqrt(((px - worldX) / 1.5) ** 2 + (py - worldY) ** 2);
      const radialFade = 1.0 - Math.pow(Math.min(radialDist / outerSize, 1.0), 2.0);
      const b = (1 - dist / outerSize) * rng.range(0.3, 1) * brightness * radialFade;
      if (b > 0.01) {
        ctx.particles.add(px, py, rng.range(0.3, 1.0), 1, 0.86, 0.7, b * 0.5, b * 0.2);
      }
    }
  } else {
    for (let i = 0; i < galaxy.starCount; i++) {
      const px = worldX + rng.range(-outerSize, outerSize) * rng.range(0.3, 1);
      const py = worldY + rng.range(-outerSize * 0.6, outerSize * 0.6) * rng.range(0.3, 1);
      const radialDist = Math.sqrt((px - worldX) ** 2 + ((py - worldY) / 0.6) ** 2);
      const radialFade = 1.0 - Math.pow(Math.min(radialDist / outerSize, 1.0), 2.0);
      const b = rng.range(0.2, 0.8) * brightness * radialFade;
      if (b > 0.01) {
        ctx.particles.add(px, py, rng.range(0.3, 1.0), 0.78, 0.86, 1, b * 0.5, b * 0.2);
      }
    }
  }

  // Bright core
  for (let i = 0; i < 30; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(0, worldSize * 0.15) * rng.range(0, 1);
    const px = worldX + Math.cos(angle) * dist;
    const py = worldY + Math.sin(angle) * dist * galaxy.tilt;
    const b = rng.range(0.5, 1.0) * brightness;
    ctx.particles.add(px, py, rng.range(0.5, 2.0), 1, 0.96, 0.86, b * 0.8, 1.0);
  }
}
