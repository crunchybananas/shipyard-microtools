// System-level rendering: star glow, planet spheres, orbits, labels
import type { Star, Planet, CachedSystem } from 'cosmos/services/universe-generator';
import {
  getSeed,
  generateStar,
  generatePlanet,
} from 'cosmos/services/universe-generator';
import { hexToRGB, hslToRGB, planetTypeToIndex } from './cosmos-engine';
import type { RenderContext } from './render-context';

export interface CachedPlanetPosition {
  planet: Planet;
  px: number;
  py: number;
  size: number;
}

export interface SystemRenderResult {
  cachedSystem: CachedSystem;
  cachedPlanetScreenPositions: CachedPlanetPosition[];
  focusedPlanet: Planet | null;
  focusedPlanetStar: Star | null;
}

export function renderSystem(
  ctx: RenderContext,
  cachedSystem: CachedSystem | null,
  focusedPlanet: Planet | null,
  focusedPlanetStar: Star | null,
): SystemRenderResult {
  // Build or reuse the cached system
  if (!cachedSystem) {
    const seed = getSeed(
      Math.floor(ctx.camera.x / 50),
      Math.floor(ctx.camera.y / 50),
      1,
    );
    const star = generateStar(seed);
    const planets: Planet[] = [];
    for (let i = 0; i < star.planets; i++) {
      planets.push(generatePlanet(seed + i + 100, i, star));
    }
    cachedSystem = { star, planets };
  }

  const { star, planets } = cachedSystem;
  const cssW = ctx.overlayCanvas?.width ?? window.innerWidth;
  const cssH = ctx.overlayCanvas?.height ?? window.innerHeight;
  const [resW] = ctx.engine.getResolution();
  const dpr = resW / cssW;

  // Star as bright particles
  ctx.particles.reset();
  const starWorldSize = 40 / 10000;
  const [sr, sg, sb] = hexToRGB(star.color);
  const starCenterX = ctx.camera.x;
  const starCenterY = ctx.camera.y;

  for (let i = 0; i < 5; i++) {
    const scale = 1 + i * 0.8;
    const alpha = 1.0 - i * 0.18;
    ctx.particles.add(
      starCenterX, starCenterY, starWorldSize * scale * 3,
      sr, sg, sb, alpha, 1.5 - i * 0.2,
    );
  }
  ctx.particles.add(starCenterX, starCenterY, starWorldSize * 0.5, 1, 1, 1, 1.0, 0.5);

  ctx.engine.drawParticles(
    ctx.particles.getData(),
    ctx.camera.x, ctx.camera.y, ctx.camera.zoom,
  );

  // Planets
  const cachedPlanetScreenPositions: CachedPlanetPosition[] = [];
  let newFocusedPlanet = focusedPlanet;
  let newFocusedPlanetStar = focusedPlanetStar;

  planets.forEach((planet) => {
    const orbitScale = ctx.camera.zoom / 5000;
    const orbitRadius = planet.orbitRadius * orbitScale;

    const angle = planet.orbitOffset + ctx.time * planet.orbitSpeed * 100;
    const px = cssW / 2 + Math.cos(angle) * orbitRadius;
    const py = cssH / 2 + Math.sin(angle) * orbitRadius;
    const planetSize = Math.max(3, planet.radius * 3 * orbitScale);

    cachedPlanetScreenPositions.push({ planet, px, py, size: planetSize });

    // Orbit path on overlay
    if (ctx.overlayCtx) {
      ctx.overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.overlayCtx.lineWidth = 1;
      ctx.overlayCtx.beginPath();
      ctx.overlayCtx.arc(cssW / 2, cssH / 2, orbitRadius, 0, Math.PI * 2);
      ctx.overlayCtx.stroke();
    }

    // Light direction
    const dx = px - cssW / 2;
    const dy = py - cssH / 2;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const lightDir: [number, number, number] = [-dx / dist, -dy / dist, 0.5];

    const [pr, pg, pb] = hexToRGB(planet.color);
    const atmosColor = planet.atmosphere
      ? hslToRGB(planet.atmosphereColor)
      : [0, 0, 0] as [number, number, number];

    // Ring behind (overlay)
    if (planet.hasRings && ctx.overlayCtx) {
      ctx.engine.drawRing(ctx.overlayCtx, px, py, planetSize, planet.ringColor, true);
    }

    // Planet sphere (WebGL)
    if (planetSize > 2) {
      ctx.engine.drawPlanetSphere(
        px * dpr, py * dpr, planetSize * dpr,
        [pr, pg, pb], lightDir,
        planet.atmosphere, atmosColor,
        planetTypeToIndex(planet.type), planet.seed,
      );
    }

    // Ring in front (overlay)
    if (planet.hasRings && ctx.overlayCtx) {
      ctx.engine.drawRing(ctx.overlayCtx, px, py, planetSize, planet.ringColor, false);
    }

    // Label + click hint
    if (planetSize > 5 && ctx.overlayCtx) {
      // Highlight focused planet
      if (focusedPlanet && focusedPlanet.seed === planet.seed) {
        ctx.overlayCtx.strokeStyle = "rgba(100, 180, 255, 0.5)";
        ctx.overlayCtx.lineWidth = 1.5;
        ctx.overlayCtx.beginPath();
        ctx.overlayCtx.arc(px, py, planetSize + 4, 0, Math.PI * 2);
        ctx.overlayCtx.stroke();
      }

      ctx.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.overlayCtx.font = "11px SF Pro Display, sans-serif";
      ctx.overlayCtx.textAlign = "center";
      ctx.overlayCtx.fillText(planet.name, px, py + planetSize + 15);

      if (planetSize > 12) {
        const typeName = planet.type.replace("_", " ");
        ctx.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.overlayCtx.font = "9px SF Pro Display, sans-serif";
        ctx.overlayCtx.fillText(typeName, px, py + planetSize + 27);
      }
    }

    // Track closest planet for surface dive
    const distToCenter = Math.sqrt((px - cssW / 2) ** 2 + (py - cssH / 2) ** 2);
    if (distToCenter < planetSize * 2 || (ctx.camera.zoom > 100000 && distToCenter < 200)) {
      newFocusedPlanet = planet;
      newFocusedPlanetStar = star;
    }
  });

  // Star label on overlay
  if (ctx.overlayCtx) {
    const starSize = 40 * (ctx.camera.zoom / 10000);
    ctx.overlayCtx.fillStyle = "#fff";
    ctx.overlayCtx.font = "14px SF Pro Display, sans-serif";
    ctx.overlayCtx.textAlign = "center";
    ctx.overlayCtx.fillText(star.name, cssW / 2, cssH / 2 + starSize + 25);
    ctx.overlayCtx.font = "11px SF Pro Display, sans-serif";
    ctx.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.overlayCtx.fillText(
      `${star.spectralClass}-type • ${star.temperature}K`,
      cssW / 2, cssH / 2 + starSize + 42,
    );
  }

  return {
    cachedSystem,
    cachedPlanetScreenPositions,
    focusedPlanet: newFocusedPlanet,
    focusedPlanetStar: newFocusedPlanetStar,
  };
}
