import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import InfoPanel from "cosmos/components/cosmos/info-panel";
import BookmarksModal from "cosmos/components/cosmos/bookmarks-modal";
import {
  type Scale,
  type Galaxy,
  type Star,
  type Planet,
  type CachedSystem,
  SeededRandom,
  getSeed,
  getCurrentScale,
  generateGalaxy,
  generateStar,
  generatePlanet,
} from "cosmos/services/universe-generator";
import {
  type Bookmark,
  saveBookmark,
} from "cosmos/services/bookmark-manager";
import {
  CosmosEngine,
  ParticleBuilder,
  hexToRGB,
  hslToRGB,
  planetTypeToIndex,
} from "cosmos/cosmos/cosmos-engine";
import { getBiomeConfig } from "cosmos/cosmos/terrain-generator";
import { CosmicSoundscape } from "cosmos/cosmos/cosmic-soundscape";

interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
  targetX: number;
  targetY: number;
}

export default class CosmosApp extends Component {
  @tracked isDragging = false;
  @tracked showBookmarksModal = false;
  @tracked toastMessage = "";
  @tracked toastVisible = false;
  @tracked cameraX = 0;
  @tracked cameraY = 0;
  @tracked cameraZoom = 1;
  @tracked currentScale: Scale = getCurrentScale(1);
  @tracked selectedObject: Galaxy | Star | Planet | null = null;
  @tracked soundEnabled = false;

  // WebGL engine + particle builder
  private engine = new CosmosEngine();
  private particles = new ParticleBuilder();
  private soundscape = new CosmicSoundscape();

  // Canvas overlay for text labels & rings
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private glCanvas: HTMLCanvasElement | null = null;
  private animationId: number | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private activePointers = new Map<number, { x: number; y: number }>();
  private time = 0;

  private camera: Camera = {
    x: 0,
    y: 0,
    zoom: 1,
    targetZoom: 1,
    targetX: 0,
    targetY: 0,
  };

  private cachedGalaxies: Galaxy[] = [];
  private cachedStars: Star[] = [];
  private cachedSystem: CachedSystem | null = null;
  private focusedPlanet: Planet | null = null;
  private focusedPlanetStar: Star | null = null;

  private checkUrlParams(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.has("coords")) {
      const coordStr = params.get("coords");
      if (coordStr) {
        const [x, y, z] = coordStr.split(",").map(Number);
        if (!isNaN(x!) && !isNaN(y!)) {
          this.camera.x = this.camera.targetX = x!;
          this.camera.y = this.camera.targetY = y!;
          if (!isNaN(z!)) this.camera.zoom = this.camera.targetZoom = z!;
        }
      }
    }
  }

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.checkUrlParams();

    // Element is the WebGL canvas
    this.glCanvas = element;

    // Find overlay canvas (sibling)
    const container = element.parentElement;
    this.overlayCanvas = container?.querySelector(".cosmos-overlay") as HTMLCanvasElement | null;
    if (this.overlayCanvas) {
      this.overlayCtx = this.overlayCanvas.getContext("2d");
    }

    // Init WebGL engine
    const success = this.engine.init(element);
    if (!success) {
      console.error("WebGL2 init failed");
      return;
    }

    this.resizeCanvases();
    window.addEventListener("resize", this.resizeCanvases);
    this.startRenderLoop();

    return () => {
      window.removeEventListener("resize", this.resizeCanvases);
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
      }
      this.engine.destroy();
      this.soundscape.destroy();
    };
  });

  private resizeCanvases = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.glCanvas) {
      this.glCanvas.style.width = `${w}px`;
      this.glCanvas.style.height = `${h}px`;
      this.engine.resize();
    }

    if (this.overlayCanvas) {
      this.overlayCanvas.width = w;
      this.overlayCanvas.height = h;
    }
  };

  private startRenderLoop(): void {
    const render = (): void => {
      this.renderFrame();
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  private renderFrame(): void {
    // Smooth camera
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.1;
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;

    // Update tracked properties
    this.cameraX = this.camera.x;
    this.cameraY = this.camera.y;
    this.cameraZoom = this.camera.zoom;
    this.currentScale = getCurrentScale(this.camera.zoom);

    this.time += 0.016;

    // Update soundscape with current zoom/position
    this.soundscape.update(this.camera.zoom, this.camera.x, this.camera.y);

    // Calculate visible area (CSS pixels)
    const cssW = this.overlayCanvas?.width ?? window.innerWidth;
    const cssH = this.overlayCanvas?.height ?? window.innerHeight;
    const viewWidth = cssW / this.camera.zoom;
    const viewHeight = cssH / this.camera.zoom;
    const left = this.camera.x - viewWidth / 2;
    const right = this.camera.x + viewWidth / 2;
    const top = this.camera.y - viewHeight / 2;
    const bottom = this.camera.y + viewHeight / 2;

    // Clear overlay
    if (this.overlayCtx && this.overlayCanvas) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    // WebGL rendering
    this.engine.beginFrame();
    this.engine.drawBackground();

    if (this.camera.zoom < 50) {
      this.renderGalaxiesWebGL(left, right, top, bottom);
    } else if (this.camera.zoom < 5000) {
      this.renderStarsWebGL(left, right, top, bottom);
    } else if (this.camera.zoom < 500000) {
      this.renderSystemWebGL();
    } else {
      this.renderSurfaceWebGL();
    }

    this.engine.endFrame();
  }

  // ─── World → Screen (CSS pixel space for overlay) ────────────────────────

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cssW = this.overlayCanvas?.width ?? window.innerWidth;
    const cssH = this.overlayCanvas?.height ?? window.innerHeight;
    return {
      x: (wx - this.camera.x) * this.camera.zoom + cssW / 2,
      y: (wy - this.camera.y) * this.camera.zoom + cssH / 2,
    };
  }

  // ─── Galaxy Rendering (WebGL instanced + overlay labels) ────────────────

  private renderGalaxiesWebGL(
    left: number, right: number, top: number, bottom: number
  ): void {
    const gridSize = 200;
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    this.particles.reset();
    this.cachedGalaxies = [];

    const cssW = this.overlayCanvas?.width ?? window.innerWidth;
    const cssH = this.overlayCanvas?.height ?? window.innerHeight;

    for (let x = startX; x < right + gridSize; x += gridSize) {
      for (let y = startY; y < bottom + gridSize; y += gridSize) {
        const seed = getSeed(x, y, 0);
        const rng = new SeededRandom(seed);

        if (rng.next() > 0.4) continue;

        const galaxy = generateGalaxy(seed);
        const gx = x + rng.range(20, gridSize - 20);
        const gy = y + rng.range(20, gridSize - 20);

        const screen = this.worldToScreen(gx, gy);
        const size = 30 * galaxy.size * this.camera.zoom;

        if (
          screen.x > -size && screen.x < cssW + size &&
          screen.y > -size && screen.y < cssH + size
        ) {
          this.addGalaxyParticles(galaxy, gx, gy, 30 * galaxy.size);

          this.cachedGalaxies.push({
            ...galaxy,
            worldX: gx, worldY: gy,
            screenX: screen.x, screenY: screen.y, screenSize: size,
          });

          if (this.camera.zoom > 10 && size > 40 && this.overlayCtx) {
            this.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
            this.overlayCtx.font = "12px SF Pro Display, sans-serif";
            this.overlayCtx.textAlign = "center";
            this.overlayCtx.fillText(galaxy.name, screen.x, screen.y + size + 20);
          }
        }
      }
    }

    this.engine.drawParticles(
      this.particles.getData(),
      this.camera.x, this.camera.y, this.camera.zoom
    );
  }

  private addGalaxyParticles(
    galaxy: Galaxy, worldX: number, worldY: number, worldSize: number
  ): void {
    const rng = new SeededRandom(galaxy.seed);

    if (galaxy.type === "spiral" || galaxy.type === "barred_spiral") {
      for (let arm = 0; arm < galaxy.arms; arm++) {
        const armAngle = (arm / galaxy.arms) * Math.PI * 2;
        const perArm = galaxy.starCount / galaxy.arms;
        for (let i = 0; i < perArm; i++) {
          const t = i / perArm;
          const distance = t * worldSize;
          const spread = rng.range(-worldSize * 0.15, worldSize * 0.15);
          const angle = armAngle + t * 3 + spread * 0.01 + galaxy.rotation;
          const px = worldX + Math.cos(angle) * distance + rng.range(-0.5, 0.5);
          const py = worldY + Math.sin(angle) * distance * galaxy.tilt + rng.range(-0.5, 0.5);
          const brightness = (1 - t * 0.7) * rng.range(0.3, 1);
          const starSize = rng.range(0.3, 1.2) * (1 - t * 0.5);
          this.particles.add(px, py, starSize, 1, 1, 1, brightness * 0.6, brightness * 0.3);
        }
      }
    } else if (galaxy.type === "elliptical") {
      for (let i = 0; i < galaxy.starCount; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const dist = rng.range(0, 1) * rng.range(0, 1) * worldSize;
        const px = worldX + Math.cos(angle) * dist * 1.5;
        const py = worldY + Math.sin(angle) * dist;
        const brightness = (1 - dist / worldSize) * rng.range(0.3, 1);
        this.particles.add(px, py, rng.range(0.3, 1.0), 1, 0.86, 0.7, brightness * 0.5, brightness * 0.2);
      }
    } else {
      for (let i = 0; i < galaxy.starCount; i++) {
        const px = worldX + rng.range(-worldSize, worldSize) * rng.range(0.3, 1);
        const py = worldY + rng.range(-worldSize * 0.6, worldSize * 0.6) * rng.range(0.3, 1);
        const brightness = rng.range(0.2, 0.8);
        this.particles.add(px, py, rng.range(0.3, 1.0), 0.78, 0.86, 1, brightness * 0.5, brightness * 0.2);
      }
    }

    // Bright core
    for (let i = 0; i < 30; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(0, worldSize * 0.15) * rng.range(0, 1);
      const px = worldX + Math.cos(angle) * dist;
      const py = worldY + Math.sin(angle) * dist * galaxy.tilt;
      const brightness = rng.range(0.5, 1.0);
      this.particles.add(px, py, rng.range(0.5, 2.0), 1, 0.96, 0.86, brightness * 0.8, 1.0);
    }
  }

  // ─── Star Rendering (WebGL instanced + overlay labels) ──────────────────

  private renderStarsWebGL(
    left: number, right: number, top: number, bottom: number
  ): void {
    const gridSize = 50;
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    this.particles.reset();
    this.cachedStars = [];

    const cssW = this.overlayCanvas?.width ?? window.innerWidth;
    const cssH = this.overlayCanvas?.height ?? window.innerHeight;

    for (let x = startX; x < right + gridSize; x += gridSize) {
      for (let y = startY; y < bottom + gridSize; y += gridSize) {
        const seed = getSeed(x, y, 1);
        const rng = new SeededRandom(seed);

        if (rng.next() > 0.3) continue;

        const star = generateStar(seed);
        const sx = x + rng.range(5, gridSize - 5);
        const sy = y + rng.range(5, gridSize - 5);

        const screen = this.worldToScreen(sx, sy);
        const baseSize = 2 + star.radius * 2;
        const screenSize = baseSize * (this.camera.zoom / 100);

        if (
          screen.x > -screenSize * 3 && screen.x < cssW + screenSize * 3 &&
          screen.y > -screenSize * 3 && screen.y < cssH + screenSize * 3
        ) {
          const [r, g, b] = hexToRGB(star.color);
          this.particles.add(sx, sy, baseSize, r, g, b, 1.0, 1.0);

          this.cachedStars.push({
            ...star,
            worldX: sx, worldY: sy,
            screenX: screen.x, screenY: screen.y, screenSize,
          });

          if (this.camera.zoom > 1000 && screenSize > 3 && this.overlayCtx) {
            this.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
            this.overlayCtx.font = "11px SF Pro Display, sans-serif";
            this.overlayCtx.textAlign = "center";
            this.overlayCtx.fillText(star.name, screen.x, screen.y + screenSize * 3 + 15);
          }
        }
      }
    }

    this.engine.drawParticles(
      this.particles.getData(),
      this.camera.x, this.camera.y, this.camera.zoom
    );
  }

  // ─── System Rendering (WebGL planets + overlay text) ─────────────────────

  private renderSystemWebGL(): void {
    if (!this.cachedSystem || this.cachedStars.length === 0) {
      const seed = getSeed(
        Math.floor(this.camera.x / 50),
        Math.floor(this.camera.y / 50),
        1
      );
      const star = generateStar(seed);

      const planets: Planet[] = [];
      for (let i = 0; i < star.planets; i++) {
        planets.push(generatePlanet(seed + i + 100, i, star));
      }

      this.cachedSystem = { star, planets };
    }

    const { star, planets } = this.cachedSystem;
    const cssW = this.overlayCanvas?.width ?? window.innerWidth;
    const cssH = this.overlayCanvas?.height ?? window.innerHeight;
    const [resW] = this.engine.getResolution();
    const dpr = resW / cssW;

    // Star as bright particles
    this.particles.reset();
    const starWorldSize = 40 / 10000;
    const [sr, sg, sb] = hexToRGB(star.color);
    const starCenterX = this.camera.x;
    const starCenterY = this.camera.y;

    for (let i = 0; i < 5; i++) {
      const scale = 1 + i * 0.8;
      const alpha = 1.0 - i * 0.18;
      this.particles.add(
        starCenterX, starCenterY, starWorldSize * scale * 3,
        sr, sg, sb, alpha, 1.5 - i * 0.2
      );
    }
    this.particles.add(starCenterX, starCenterY, starWorldSize * 0.5, 1, 1, 1, 1.0, 0.5);

    this.engine.drawParticles(
      this.particles.getData(),
      this.camera.x, this.camera.y, this.camera.zoom
    );

    // Planets
    planets.forEach((planet) => {
      const orbitScale = this.camera.zoom / 5000;
      const orbitRadius = planet.orbitRadius * orbitScale;

      const angle = planet.orbitOffset + this.time * planet.orbitSpeed * 100;
      const px = cssW / 2 + Math.cos(angle) * orbitRadius;
      const py = cssH / 2 + Math.sin(angle) * orbitRadius;
      const planetSize = Math.max(3, planet.radius * 3 * orbitScale);

      // Orbit path on overlay
      if (this.overlayCtx) {
        this.overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.beginPath();
        this.overlayCtx.arc(cssW / 2, cssH / 2, orbitRadius, 0, Math.PI * 2);
        this.overlayCtx.stroke();
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
      if (planet.hasRings && this.overlayCtx) {
        this.engine.drawRing(this.overlayCtx, px, py, planetSize, planet.ringColor, true);
      }

      // Planet sphere (WebGL)
      if (planetSize > 2) {
        this.engine.drawPlanetSphere(
          px * dpr, py * dpr, planetSize * dpr,
          [pr, pg, pb], lightDir,
          planet.atmosphere, atmosColor,
          planetTypeToIndex(planet.type), planet.seed,
        );
      }

      // Ring in front (overlay)
      if (planet.hasRings && this.overlayCtx) {
        this.engine.drawRing(this.overlayCtx, px, py, planetSize, planet.ringColor, false);
      }

      // Label
      if (planetSize > 5 && this.overlayCtx) {
        this.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
        this.overlayCtx.font = "11px SF Pro Display, sans-serif";
        this.overlayCtx.textAlign = "center";
        this.overlayCtx.fillText(planet.name, px, py + planetSize + 15);
      }

      // Track closest planet for surface dive
      const distToCenter = Math.sqrt((px - cssW / 2) ** 2 + (py - cssH / 2) ** 2);
      if (distToCenter < planetSize * 2 || (this.camera.zoom > 100000 && distToCenter < 200)) {
        this.focusedPlanet = planet;
        this.focusedPlanetStar = star;
      }
    });

    // Star label on overlay
    if (this.overlayCtx) {
      const starSize = 40 * (this.camera.zoom / 10000);
      this.overlayCtx.fillStyle = "#fff";
      this.overlayCtx.font = "14px SF Pro Display, sans-serif";
      this.overlayCtx.textAlign = "center";
      this.overlayCtx.fillText(star.name, cssW / 2, cssH / 2 + starSize + 25);
      this.overlayCtx.font = "11px SF Pro Display, sans-serif";
      this.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
      this.overlayCtx.fillText(
        `${star.spectralClass}-type • ${star.temperature}K`,
        cssW / 2, cssH / 2 + starSize + 42
      );
    }
  }

  // ─── Surface / Terrain / Atmosphere Rendering ─────────────────────────────

  private renderSurfaceWebGL(): void {
    // We need a focused planet to render surface. If none, pick one.
    if (!this.focusedPlanet) {
      // Generate default planet from camera position
      const seed = getSeed(
        Math.floor(this.camera.x / 50),
        Math.floor(this.camera.y / 50),
        1
      );
      const star = generateStar(seed);
      if (star.planets > 0) {
        this.focusedPlanet = generatePlanet(seed + 100, 0, star);
        this.focusedPlanetStar = star;
      } else {
        // No planet — fall back to rocky world
        this.focusedPlanet = generatePlanet(seed + 42, 0, star);
        this.focusedPlanetStar = star;
      }
    }

    const planet = this.focusedPlanet!;
    const star = this.focusedPlanetStar;
    const biome = getBiomeConfig(planet.type);

    // Compute altitude: how deep into surface we are (0=orbit, 1=ground)
    // ATMOSPHERE: 500K → 5M zoom, SURFACE: 5M → 50M, TERRAIN: 50M → 500M
    const zoom = this.camera.zoom;
    let altitude: number;
    if (zoom < 5000000) {
      // Atmosphere phase: 500K→5M
      altitude = (zoom - 500000) / (5000000 - 500000); // 0→1
    } else {
      altitude = 1;
    }

    const starColorRGB: [number, number, number] = star
      ? hexToRGB(star.color)
      : [1, 0.95, 0.85];

    // Compute light direction (based on star position — simplified)
    const lightAngle = this.time * 0.005;
    const lightDir: [number, number, number] = [
      Math.cos(lightAngle) * 0.7,
      -0.3,
      Math.sin(lightAngle) * 0.7 + 0.3,
    ];

    if (altitude < 1) {
      // In atmosphere — draw atmosphere effect
      this.engine.drawAtmosphere(
        altitude,
        biome.atmosphereDensity,
        biome.atmosphereHue,
        starColorRGB,
        0.5,
      );
    }

    if (zoom >= 5000000) {
      // Surface/terrain — draw procedural terrain
      this.engine.drawTerrain(
        this.camera.x, this.camera.y, zoom,
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
      );
    }

    // Overlay HUD for surface view
    if (this.overlayCtx && this.overlayCanvas) {
      const cssW = this.overlayCanvas.width;
      const cssH = this.overlayCanvas.height;
      const ctx = this.overlayCtx;

      // Planet name & type
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "16px SF Pro Display, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(planet.name, 20, cssH - 60);

      const typeName = planet.type
        .replace("_", " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      ctx.font = "12px SF Pro Display, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText(typeName, 20, cssH - 42);

      // Altitude indicator
      const altKm = altitude < 1
        ? Math.floor((1 - altitude) * 100) + " km"
        : "Surface";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "11px SF Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`ALT: ${altKm}`, cssW - 20, cssH - 60);

      // Compass rose
      if (zoom >= 5000000) {
        const cx = cssW - 40;
        const cy = cssH - 100;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "8px SF Pro Display, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", cx, cy - 18);
        ctx.fillText("S", cx, cy + 24);
        ctx.fillText("E", cx + 22, cy + 4);
        ctx.fillText("W", cx - 22, cy + 4);
      }
    }
  }

  // Event handlers
  handleWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.85 : 1.18;
    this.camera.targetZoom = Math.max(
      0.5,
      Math.min(500000000, this.camera.targetZoom * zoomFactor)
    );

    if (this.camera.targetZoom < 5000) {
      this.cachedSystem = null;
      this.focusedPlanet = null;
      this.focusedPlanetStar = null;
    }
    if (this.camera.targetZoom < 500000) {
      // Reset focused planet if zooming back above atmosphere
      this.focusedPlanet = null;
      this.focusedPlanetStar = null;
    }
  };

  handlePointerDown = (event: PointerEvent): void => {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      // Start pinch
      const pts = [...this.activePointers.values()];
      this.pinchStartDist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      this.pinchStartZoom = this.camera.targetZoom;
      this.isDragging = false;
    } else if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  };

  handlePointerMove = (event: PointerEvent): void => {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      // Pinch zoom
      const pts = [...this.activePointers.values()];
      const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      if (this.pinchStartDist > 0) {
        const scale = dist / this.pinchStartDist;
        this.camera.targetZoom = Math.max(0.5, Math.min(500000000, this.pinchStartZoom * scale));
        if (this.camera.targetZoom < 5000) this.cachedSystem = null;
        if (this.camera.targetZoom < 500000) {
          this.focusedPlanet = null;
          this.focusedPlanetStar = null;
        }
      }
    } else if (this.isDragging) {
      const dx = (event.clientX - this.lastMouseX) / this.camera.zoom;
      const dy = (event.clientY - this.lastMouseY) / this.camera.zoom;
      this.camera.targetX -= dx;
      this.camera.targetY -= dy;
      this.camera.x = this.camera.targetX;
      this.camera.y = this.camera.targetY;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  };

  handlePointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.pinchStartDist = 0;
    }
    if (this.activePointers.size === 0) {
      this.isDragging = false;
    }
  };

  handlePointerLeave = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) {
      this.isDragging = false;
    }
  };

  handleClick = (event: MouseEvent): void => {
    if (this.isDragging || this.activePointers.size > 1) return;

    const mx = event.clientX;
    const my = event.clientY;

    // Check galaxies
    for (const galaxy of this.cachedGalaxies) {
      const dist = Math.sqrt(
        (mx - galaxy.screenX!) ** 2 + (my - galaxy.screenY!) ** 2
      );
      if (dist < galaxy.screenSize!) {
        this.focusOn(galaxy.worldX!, galaxy.worldY!, this.camera.zoom * 3);
        this.selectedObject = galaxy;
        return;
      }
    }

    // Check stars
    for (const star of this.cachedStars) {
      const dist = Math.sqrt(
        (mx - star.screenX!) ** 2 + (my - star.screenY!) ** 2
      );
      if (dist < Math.max(star.screenSize! * 3, 20)) {
        this.focusOn(star.worldX!, star.worldY!, this.camera.zoom * 3);
        this.selectedObject = star;
        return;
      }
    }
  };

  private focusOn(x: number, y: number, zoom: number): void {
    this.camera.targetX = x;
    this.camera.targetY = y;
    this.camera.targetZoom = Math.min(500000000, zoom);
    this.cachedSystem = null;
  }

  handleBookmark = (): void => {
    const name = this.selectedObject?.name || `Location ${Date.now()}`;
    saveBookmark(name, this.camera.x, this.camera.y, this.camera.zoom);
    this.showToast(`Bookmarked: ${name}`);
  };

  handleShowBookmarks = (): void => {
    this.showBookmarksModal = true;
  };

  handleCloseBookmarks = (): void => {
    this.showBookmarksModal = false;
  };

  handleNavigateToBookmark = (bookmark: Bookmark): void => {
    this.camera.targetX = bookmark.x;
    this.camera.targetY = bookmark.y;
    this.camera.targetZoom = bookmark.zoom;
    this.cachedSystem = null;
  };

  handleCopyCoords = (): void => {
    const coords = `${this.camera.x.toFixed(4)},${this.camera.y.toFixed(4)},${this.camera.zoom.toFixed(2)}`;
    navigator.clipboard.writeText(coords);
    this.showToast("Coordinates copied!");
  };

  handleToggleSound = async (): Promise<void> => {
    if (this.soundEnabled) {
      this.soundscape.stop();
      this.soundEnabled = false;
    } else {
      await this.soundscape.start();
      this.soundEnabled = true;
    }
  };

  private showToast(message: string): void {
    this.toastMessage = message;
    this.toastVisible = true;
    setTimeout(() => {
      this.toastVisible = false;
    }, 2000);
  }

  <template>
    <div class="cosmos-container" ...attributes>
      {{! template-lint-disable no-invalid-interactive no-pointer-down-event-binding }}
      <canvas
        class="cosmos-canvas {{if this.isDragging 'grabbing'}}"
        {{this.setupCanvas}}
        {{on "wheel" this.handleWheel}}
        {{on "pointerdown" this.handlePointerDown}}
        {{on "pointermove" this.handlePointerMove}}
        {{on "pointerup" this.handlePointerUp}}
        {{on "pointerleave" this.handlePointerLeave}}
        {{on "pointercancel" this.handlePointerUp}}
        {{on "click" this.handleClick}}
      ></canvas>
      <canvas class="cosmos-overlay"></canvas>

      <header class="cosmos-header">
        <h1>🌌 COSMOS</h1>
        <div class="header-actions">
          <button
            type="button"
            title="{{if this.soundEnabled 'Mute cosmic soundscape' 'Enable cosmic soundscape'}}"
            {{on "click" this.handleToggleSound}}
          >
            {{if this.soundEnabled "🔊 Sound" "🔇 Sound"}}
          </button>
          <button type="button" title="Bookmark this location" {{on "click" this.handleBookmark}}>
            ☆ Bookmark
          </button>
          <button type="button" title="View bookmarks" {{on "click" this.handleShowBookmarks}}>
            📚 Bookmarks
          </button>
        </div>
      </header>

      <InfoPanel
        @scale={{this.currentScale}}
        @selectedObject={{this.selectedObject}}
        @cameraX={{this.cameraX}}
        @cameraY={{this.cameraY}}
        @cameraZoom={{this.cameraZoom}}
        @onCopyCoords={{this.handleCopyCoords}}
      />

      <div class="scale-indicator">
        <span>{{this.currentScale.name}}</span>
      </div>

      {{#if this.showBookmarksModal}}
        <BookmarksModal
          @onClose={{this.handleCloseBookmarks}}
          @onNavigate={{this.handleNavigateToBookmark}}
        />
      {{/if}}

      {{#if this.toastVisible}}
        <div class="toast">{{this.toastMessage}}</div>
      {{/if}}
    </div>
  </template>
}
