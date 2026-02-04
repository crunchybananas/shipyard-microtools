import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import type Owner from "@ember/owner";
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
  lightenColor,
  darkenColor,
} from "cosmos/services/universe-generator";
import {
  type Bookmark,
  saveBookmark,
} from "cosmos/services/bookmark-manager";

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

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;
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

  constructor(owner: Owner, args: CosmosAppSignature["Args"]) {
    super(owner, args);
    this.checkUrlParams();
  }

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

  setupCanvas = (element: HTMLCanvasElement): void => {
    this.canvas = element;
    this.ctx = element.getContext("2d");
    this.resizeCanvas();
    window.addEventListener("resize", this.resizeCanvas);
    this.startRenderLoop();
  };

  willDestroy(): void {
    super.willDestroy();
    window.removeEventListener("resize", this.resizeCanvas);
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private resizeCanvas = (): void => {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
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
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const canvas = this.canvas;

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

    this.drawBackground(ctx, canvas);

    // Calculate visible area
    const viewWidth = canvas.width / this.camera.zoom;
    const viewHeight = canvas.height / this.camera.zoom;
    const left = this.camera.x - viewWidth / 2;
    const right = this.camera.x + viewWidth / 2;
    const top = this.camera.y - viewHeight / 2;
    const bottom = this.camera.y + viewHeight / 2;

    if (this.camera.zoom < 50) {
      this.renderGalaxies(ctx, canvas, left, right, top, bottom);
    } else if (this.camera.zoom < 5000) {
      this.renderStars(ctx, canvas, left, right, top, bottom);
    } else {
      this.renderSystem(ctx, canvas);
    }
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ): void {
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height)
    );
    gradient.addColorStop(0, "#0a0a1a");
    gradient.addColorStop(0.5, "#050510");
    gradient.addColorStop(1, "#000005");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background stars
    const bgRng = new SeededRandom(12345);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < 200; i++) {
      const x = bgRng.next() * canvas.width;
      const y = bgRng.next() * canvas.height;
      const size = bgRng.range(0.5, 1.5);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private worldToScreen(
    wx: number,
    wy: number,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + canvas.width / 2,
      y: (wy - this.camera.y) * this.camera.zoom + canvas.height / 2,
    };
  }

  private renderGalaxies(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    left: number,
    right: number,
    top: number,
    bottom: number
  ): void {
    const gridSize = 200;
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    this.cachedGalaxies = [];

    for (let x = startX; x < right + gridSize; x += gridSize) {
      for (let y = startY; y < bottom + gridSize; y += gridSize) {
        const seed = getSeed(x, y, 0);
        const rng = new SeededRandom(seed);

        if (rng.next() > 0.4) continue;

        const galaxy = generateGalaxy(seed);
        const gx = x + rng.range(20, gridSize - 20);
        const gy = y + rng.range(20, gridSize - 20);

        const screen = this.worldToScreen(gx, gy, canvas);
        const size = 30 * galaxy.size * this.camera.zoom;

        if (
          screen.x > -size &&
          screen.x < canvas.width + size &&
          screen.y > -size &&
          screen.y < canvas.height + size
        ) {
          this.drawGalaxy(ctx, galaxy, screen.x, screen.y, size);

          this.cachedGalaxies.push({
            ...galaxy,
            worldX: gx,
            worldY: gy,
            screenX: screen.x,
            screenY: screen.y,
            screenSize: size,
          });

          if (this.camera.zoom > 10 && size > 40) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.font = "12px SF Pro Display, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(galaxy.name, screen.x, screen.y + size + 20);
          }
        }
      }
    }
  }

  private drawGalaxy(
    ctx: CanvasRenderingContext2D,
    galaxy: Galaxy,
    x: number,
    y: number,
    size: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(galaxy.rotation);
    ctx.scale(1, galaxy.tilt);

    const rng = new SeededRandom(galaxy.seed);

    if (galaxy.type === "spiral" || galaxy.type === "barred_spiral") {
      for (let arm = 0; arm < galaxy.arms; arm++) {
        const armAngle = (arm / galaxy.arms) * Math.PI * 2;

        for (let i = 0; i < galaxy.starCount / galaxy.arms; i++) {
          const t = i / (galaxy.starCount / galaxy.arms);
          const distance = t * size;
          const spread = rng.range(-size * 0.15, size * 0.15);
          const angle = armAngle + t * 3 + spread * 0.01;

          const px = Math.cos(angle) * distance + rng.range(-5, 5);
          const py = Math.sin(angle) * distance + rng.range(-5, 5);

          const brightness = (1 - t * 0.7) * rng.range(0.3, 1);
          const starSize = rng.range(0.5, 2) * (1 - t * 0.5);

          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
          ctx.beginPath();
          ctx.arc(px, py, starSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (galaxy.type === "elliptical") {
      for (let i = 0; i < galaxy.starCount; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const dist = rng.range(0, 1) * rng.range(0, 1) * size;
        const px = Math.cos(angle) * dist * 1.5;
        const py = Math.sin(angle) * dist;

        const brightness = (1 - dist / size) * rng.range(0.3, 1);
        ctx.fillStyle = `rgba(255, 220, 180, ${brightness * 0.5})`;
        ctx.beginPath();
        ctx.arc(px, py, rng.range(0.5, 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < galaxy.starCount; i++) {
        const px = rng.range(-size, size) * rng.range(0.3, 1);
        const py = rng.range(-size * 0.6, size * 0.6) * rng.range(0.3, 1);

        const brightness = rng.range(0.2, 0.8);
        ctx.fillStyle = `rgba(200, 220, 255, ${brightness * 0.5})`;
        ctx.beginPath();
        ctx.arc(px, py, rng.range(0.5, 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bright core
    const coreGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      size * 0.25
    );
    coreGradient.addColorStop(0, "rgba(255, 255, 220, 0.8)");
    coreGradient.addColorStop(0.5, "rgba(255, 240, 200, 0.3)");
    coreGradient.addColorStop(1, "rgba(255, 230, 180, 0)");
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderStars(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    left: number,
    right: number,
    top: number,
    bottom: number
  ): void {
    const gridSize = 50;
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    this.cachedStars = [];

    for (let x = startX; x < right + gridSize; x += gridSize) {
      for (let y = startY; y < bottom + gridSize; y += gridSize) {
        const seed = getSeed(x, y, 1);
        const rng = new SeededRandom(seed);

        if (rng.next() > 0.3) continue;

        const star = generateStar(seed);
        const sx = x + rng.range(5, gridSize - 5);
        const sy = y + rng.range(5, gridSize - 5);

        const screen = this.worldToScreen(sx, sy, canvas);
        const baseSize = 2 + star.radius * 2;
        const size = baseSize * (this.camera.zoom / 100);

        if (
          screen.x > -size * 3 &&
          screen.x < canvas.width + size * 3 &&
          screen.y > -size * 3 &&
          screen.y < canvas.height + size * 3
        ) {
          this.drawStar(ctx, star, screen.x, screen.y, Math.max(1, size));

          this.cachedStars.push({
            ...star,
            worldX: sx,
            worldY: sy,
            screenX: screen.x,
            screenY: screen.y,
            screenSize: size,
          });

          if (this.camera.zoom > 1000 && size > 3) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.font = "11px SF Pro Display, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(star.name, screen.x, screen.y + size * 3 + 15);
          }
        }
      }
    }
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    star: Star,
    x: number,
    y: number,
    size: number
  ): void {
    // Glow
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    glowGradient.addColorStop(0, star.color);
    glowGradient.addColorStop(0.3, star.color + "80");
    glowGradient.addColorStop(1, star.color + "00");
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Main body
    const bodyGradient = ctx.createRadialGradient(
      x - size * 0.2,
      y - size * 0.2,
      0,
      x,
      y,
      size
    );
    bodyGradient.addColorStop(0, "#fff");
    bodyGradient.addColorStop(0.5, star.color);
    bodyGradient.addColorStop(1, star.color + "cc");
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderSystem(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ): void {
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
    const starSize = 40 * (this.camera.zoom / 10000);

    // Star glow
    const glowGradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      starSize * 5
    );
    glowGradient.addColorStop(0, star.color);
    glowGradient.addColorStop(0.2, star.color + "60");
    glowGradient.addColorStop(1, "transparent");
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.drawStar(ctx, star, canvas.width / 2, canvas.height / 2, starSize);

    // Draw planets
    planets.forEach((planet) => {
      const orbitScale = this.camera.zoom / 5000;
      const orbitRadius = planet.orbitRadius * orbitScale;

      // Draw orbit path
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        orbitRadius,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      // Calculate planet position
      const angle = planet.orbitOffset + this.time * planet.orbitSpeed * 100;
      const px = canvas.width / 2 + Math.cos(angle) * orbitRadius;
      const py = canvas.height / 2 + Math.sin(angle) * orbitRadius;

      const planetSize = Math.max(3, planet.radius * 3 * orbitScale);

      this.drawPlanet(
        ctx,
        planet,
        px,
        py,
        planetSize,
        this.camera.zoom > 20000
      );

      if (planetSize > 5) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "11px SF Pro Display, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(planet.name, px, py + planetSize + 15);
      }
    });

    // Star label
    ctx.fillStyle = "#fff";
    ctx.font = "14px SF Pro Display, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(star.name, canvas.width / 2, canvas.height / 2 + starSize + 25);
    ctx.font = "11px SF Pro Display, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(
      `${star.spectralClass}-type • ${star.temperature}K`,
      canvas.width / 2,
      canvas.height / 2 + starSize + 42
    );
  }

  private drawPlanet(
    ctx: CanvasRenderingContext2D,
    planet: Planet,
    x: number,
    y: number,
    size: number,
    showDetail: boolean
  ): void {
    ctx.save();

    // Atmosphere glow
    if (planet.atmosphere && showDetail) {
      const atmosGradient = ctx.createRadialGradient(
        x,
        y,
        size * 0.9,
        x,
        y,
        size * 1.3
      );
      atmosGradient.addColorStop(0, planet.atmosphereColor);
      atmosGradient.addColorStop(1, "transparent");
      ctx.fillStyle = atmosGradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rings (behind planet)
    if (planet.hasRings) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.3);
      ctx.strokeStyle = planet.ringColor;
      ctx.lineWidth = size * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.8, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Planet body
    const planetGradient = ctx.createRadialGradient(
      x - size * 0.3,
      y - size * 0.3,
      0,
      x,
      y,
      size
    );
    planetGradient.addColorStop(0, lightenColor(planet.color, 30));
    planetGradient.addColorStop(0.7, planet.color);
    planetGradient.addColorStop(1, darkenColor(planet.color, 30));
    ctx.fillStyle = planetGradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Surface features for detailed view
    if (showDetail && size > 20) {
      const rng = new SeededRandom(planet.seed);
      ctx.globalAlpha = 0.3;

      if (planet.type === "gas_giant" || planet.type === "ice_giant") {
        for (let i = 0; i < 5; i++) {
          const bandY = y - size + (i + 0.5) * ((size * 2) / 5);
          ctx.fillStyle =
            i % 2 === 0
              ? darkenColor(planet.color, 15)
              : lightenColor(planet.color, 10);
          ctx.beginPath();
          const bandWidth =
            Math.cos(Math.asin((bandY - y) / size)) * size || size * 0.1;
          ctx.ellipse(x, bandY, bandWidth, size * 0.15, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (planet.type === "earth_like" || planet.type === "ocean") {
        for (let i = 0; i < 8; i++) {
          const cx = x + rng.range(-size * 0.6, size * 0.6);
          const cy = y + rng.range(-size * 0.6, size * 0.6);
          const cr = rng.range(size * 0.1, size * 0.3);

          if (Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) + cr < size) {
            ctx.fillStyle = planet.type === "ocean" ? "#fff" : "#228b22";
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.globalAlpha = 1;
    }

    // Rings (in front of planet)
    if (planet.hasRings) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.3);
      ctx.strokeStyle = planet.ringColor;
      ctx.lineWidth = size * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.8, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Shadow
    const shadowGradient = ctx.createLinearGradient(
      x - size,
      y,
      x + size,
      y
    );
    shadowGradient.addColorStop(0, "transparent");
    shadowGradient.addColorStop(0.5, "transparent");
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Event handlers
  handleWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.85 : 1.18;
    this.camera.targetZoom = Math.max(
      0.5,
      Math.min(500000, this.camera.targetZoom * zoomFactor)
    );

    if (this.camera.targetZoom < 5000) {
      this.cachedSystem = null;
    }
  };

  handleMouseDown = (event: MouseEvent): void => {
    this.isDragging = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  };

  handleMouseMove = (event: MouseEvent): void => {
    if (this.isDragging) {
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

  handleMouseUp = (): void => {
    this.isDragging = false;
  };

  handleMouseLeave = (): void => {
    this.isDragging = false;
  };

  handleClick = (event: MouseEvent): void => {
    if (this.isDragging) return;

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
    this.camera.targetZoom = Math.min(500000, zoom);
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
        {{this.registerCanvas}}
        {{on "wheel" this.handleWheel}}
        {{on "mousedown" this.handleMouseDown}}
        {{on "mousemove" this.handleMouseMove}}
        {{on "mouseup" this.handleMouseUp}}
        {{on "mouseleave" this.handleMouseLeave}}
        {{on "click" this.handleClick}}
      ></canvas>

      <header class="cosmos-header">
        <h1>🌌 COSMOS</h1>
        <div class="header-actions">
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

  registerCanvas = (element: HTMLCanvasElement): void => {
    this.setupCanvas(element);
  };
}
