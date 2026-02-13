// Surface-level rendering: atmosphere, terrain, and HUD overlay
import type { Star, Planet, CachedSystem } from 'cosmos/services/universe-generator';
import {
  getSeed,
  generateStar,
  generatePlanet,
} from 'cosmos/services/universe-generator';
import { hexToRGB } from './cosmos-engine';
import { getBiomeConfig } from './terrain-generator';
import type { CameraController } from './camera-controller';
import type { RenderContext } from './render-context';

export interface SurfaceRenderResult {
  focusedPlanet: Planet;
  focusedPlanetStar: Star | null;
  cachedSystem: CachedSystem;
}

export function renderSurface(
  ctx: RenderContext,
  focusedPlanet: Planet | null,
  focusedPlanetStar: Star | null,
  cachedSystem: CachedSystem | null,
  cameraController: CameraController,
): SurfaceRenderResult {
  // We need a focused planet to render surface. If none, pick one from the system.
  if (!focusedPlanet) {
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
    if (planets.length > 0) {
      const posHash = Math.abs(
        Math.floor(ctx.camera.x * 7.3 + ctx.camera.y * 13.7),
      );
      const idx = posHash % planets.length;
      focusedPlanet = planets[idx]!;
      focusedPlanetStar = star;
    } else {
      const seed = getSeed(
        Math.floor(ctx.camera.x / 50),
        Math.floor(ctx.camera.y / 50),
        1,
      );
      const star = generateStar(seed);
      focusedPlanet = generatePlanet(seed + 42, 0, star);
      focusedPlanetStar = star;
    }
  }

  const planet = focusedPlanet!;
  const star = focusedPlanetStar;
  const biome = getBiomeConfig(planet.type);

  // Compute altitude: how deep into surface we are (0=orbit, 1=ground)
  const zoom = ctx.camera.zoom;
  let altitude: number;
  if (zoom < 5000000) {
    altitude = (zoom - 500000) / (5000000 - 500000);
  } else {
    altitude = 1;
  }

  const starColorRGB: [number, number, number] = star
    ? hexToRGB(star.color)
    : [1, 0.95, 0.85];

  // Compute light direction — sun position above horizon
  const lightAngle = ctx.time * 0.005;
  const lightDir: [number, number, number] = [
    Math.cos(lightAngle) * 0.6,
    0.35 + Math.sin(ctx.time * 0.002) * 0.15,
    Math.sin(lightAngle) * 0.6,
  ];

  if (altitude < 1) {
    ctx.engine.drawAtmosphere(
      altitude,
      biome.atmosphereDensity,
      biome.atmosphereHue,
      starColorRGB,
      0.5,
    );
  }

  if (zoom >= 2000000) {
    const surfCam = cameraController.getSurfaceCamera();
    ctx.engine.drawTerrain(
      ctx.camera.x, ctx.camera.y, zoom,
      planet.seed,
      biome.baseColor,
      biome.accentColor,
      biome.waterLevel,
      biome.waterColor,
      biome.hasVegetation,
      biome.vegetationColor,
      biome.roughness,
      lightDir,
      biome.atmosphereDensity,
      biome.atmosphereHue,
      surfCam.lookAngle,
      surfCam.lookPitch,
    );
  }

  // Overlay HUD for surface view
  if (ctx.overlayCtx && ctx.overlayCanvas) {
    const cssW = ctx.overlayCanvas.width;
    const cssH = ctx.overlayCanvas.height;
    const oc = ctx.overlayCtx;
    const surfCam2 = cameraController.getSurfaceCamera();

    // ── Crosshair ──────────────────────────────────────────────────
    if (zoom >= 2000000) {
      const cx2 = cssW / 2;
      const cy2 = cssH / 2;
      const gap = 6;
      const arm = 14;
      oc.strokeStyle = "rgba(255, 255, 255, 0.25)";
      oc.lineWidth = 1;
      oc.beginPath();
      oc.moveTo(cx2 - arm, cy2);
      oc.lineTo(cx2 - gap, cy2);
      oc.moveTo(cx2 + gap, cy2);
      oc.lineTo(cx2 + arm, cy2);
      oc.moveTo(cx2, cy2 - arm);
      oc.lineTo(cx2, cy2 - gap);
      oc.moveTo(cx2, cy2 + gap);
      oc.lineTo(cx2, cy2 + arm);
      oc.stroke();
      oc.fillStyle = "rgba(255, 255, 255, 0.35)";
      oc.beginPath();
      oc.arc(cx2, cy2, 1.5, 0, Math.PI * 2);
      oc.fill();
    }

    // ── Planet name & type ─────────────────────────────────────────
    oc.fillStyle = "rgba(255, 255, 255, 0.8)";
    oc.font = "16px SF Pro Display, sans-serif";
    oc.textAlign = "left";
    oc.fillText(planet.name, 20, cssH - 60);

    const typeName = planet.type
      .replace("_", " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    oc.font = "12px SF Pro Display, sans-serif";
    oc.fillStyle = "rgba(255, 255, 255, 0.5)";
    oc.fillText(typeName, 20, cssH - 42);

    // ── Altitude indicator ─────────────────────────────────────────
    const altKm = altitude < 1
      ? Math.floor((1 - altitude) * 100) + " km"
      : "Surface";
    oc.fillStyle = "rgba(255, 255, 255, 0.6)";
    oc.font = "11px SF Mono, monospace";
    oc.textAlign = "right";
    oc.fillText(`ALT: ${altKm}`, cssW - 20, cssH - 60);

    // ── Speed gauge ──────────────────────────────────────────────
    if (zoom >= 2000000) {
      const gaugeX = cssW - 20;
      const gaugeY = cssH - 140;
      const tierCount = surfCam2.speedTierCount;
      const tierIdx = surfCam2.speedTierIndex;

      oc.fillStyle = "rgba(255, 255, 255, 0.6)";
      oc.font = "10px SF Mono, monospace";
      oc.textAlign = "right";
      oc.fillText(surfCam2.speedTierName.toUpperCase(), gaugeX, gaugeY - 8);

      for (let i = 0; i < tierCount; i++) {
        const dotY = gaugeY + (tierCount - 1 - i) * 10;
        const active = i <= tierIdx;
        oc.fillStyle = active
          ? "rgba(100, 200, 255, 0.7)"
          : "rgba(255, 255, 255, 0.15)";
        oc.beginPath();
        oc.arc(gaugeX - 4, dotY, 3, 0, Math.PI * 2);
        oc.fill();
      }

      oc.fillStyle = "rgba(255, 255, 255, 0.2)";
      oc.font = "8px SF Pro Display, sans-serif";
      oc.textAlign = "right";
      oc.fillText("scroll ↕", gaugeX, gaugeY + tierCount * 10 + 4);
    }

    // ── Compass rose ─────────────────────────────────────────────
    if (zoom >= 2000000) {
      const cx = cssW - 40;
      const cy = cssH - 100;
      const compassAngle = -surfCam2.lookAngle;

      oc.strokeStyle = "rgba(255, 255, 255, 0.3)";
      oc.lineWidth = 1;
      oc.beginPath();
      oc.arc(cx, cy, 15, 0, Math.PI * 2);
      oc.stroke();

      oc.strokeStyle = "rgba(255, 120, 120, 0.7)";
      oc.lineWidth = 2;
      oc.beginPath();
      oc.moveTo(cx, cy);
      oc.lineTo(cx + Math.sin(compassAngle) * 13, cy - Math.cos(compassAngle) * 13);
      oc.stroke();

      oc.fillStyle = "rgba(255, 255, 255, 0.5)";
      oc.font = "8px SF Pro Display, sans-serif";
      oc.textAlign = "center";
      const labels = [
        { t: "N", a: 0 }, { t: "E", a: Math.PI / 2 },
        { t: "S", a: Math.PI }, { t: "W", a: -Math.PI / 2 },
      ];
      for (const l of labels) {
        const la = l.a + compassAngle;
        oc.fillText(l.t, cx + Math.sin(la) * 22, cy - Math.cos(la) * 22 + 3);
      }
    }

    // ── Controls hint ────────────────────────────────────────────
    if (zoom >= 2000000) {
      oc.fillStyle = "rgba(255, 255, 255, 0.2)";
      oc.font = "10px SF Mono, monospace";
      oc.textAlign = "center";
      oc.fillText(
        "WASD walk · Q/E turn · Drag look · Scroll speed",
        cssW / 2, cssH - 16,
      );
    }
  }

  return {
    focusedPlanet: planet,
    focusedPlanetStar,
    cachedSystem: cachedSystem!,
  };
}
