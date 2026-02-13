import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { modifier } from "ember-modifier";
import InfoPanel from "cosmos/components/cosmos/info-panel";
import BookmarksModal from "cosmos/components/cosmos/bookmarks-modal";
import PlanetPicker from "cosmos/components/cosmos/planet-picker";
import {
  type Scale,
  type Galaxy,
  type Star,
  type Planet,
  type CachedSystem,
  getCurrentScale,
} from "cosmos/services/universe-generator";
import {
  type Bookmark,
  saveBookmark,
} from "cosmos/services/bookmark-manager";
import {
  CosmosEngine,
  ParticleBuilder,
} from "cosmos/cosmos/cosmos-engine";
import { CosmicSoundscape } from "cosmos/cosmos/cosmic-soundscape";
import { InputManager } from "cosmos/cosmos/input-manager";
import { CameraController } from "cosmos/cosmos/camera-controller";
import { getCosmicProperties } from "cosmos/cosmos/cosmic-time";
import { type Camera, type RenderContext } from "cosmos/cosmos/render-context";
import { type CachedGalaxy, renderGalaxies } from "cosmos/cosmos/galaxy-renderer";
import { type CachedStar, renderStars } from "cosmos/cosmos/star-renderer";
import { type CachedPlanetPosition, renderSystem } from "cosmos/cosmos/system-renderer";
import { renderSurface } from "cosmos/cosmos/surface-renderer";

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
  @tracked cosmicTime = 0.6; // Default: present era (normalized 0-1)
  @tracked cosmicEraName = "Present Era";
  @tracked cosmicYears = "8.3";
  @tracked isSurfaceMode = false;
  @tracked showControlsOverlay = false;
  @tracked showPlanetPicker = false;

  // WebGL engine + particle builder
  private engine = new CosmosEngine();
  private particles = new ParticleBuilder();
  private soundscape = new CosmicSoundscape();
  private inputManager = new InputManager();
  private cameraController = new CameraController();
  private lastFrameTime = 0;
  private wasSurface = false;

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

  private cachedGalaxies: CachedGalaxy[] = [];
  private cachedStars: CachedStar[] = [];
  private cachedSystem: CachedSystem | null = null;
  private focusedPlanet: Planet | null = null;
  private focusedPlanetStar: Star | null = null;
  private cachedPlanetScreenPositions: CachedPlanetPosition[] = [];

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

    // Attach keyboard input to the canvas
    this.inputManager.attach(element);

    this.resizeCanvases();
    window.addEventListener("resize", this.resizeCanvases);
    this.startRenderLoop();

    return () => {
      window.removeEventListener("resize", this.resizeCanvases);
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
      }
      this.inputManager.destroy();
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
    // Delta time for frame-rate-independent movement
    const now = performance.now() / 1000;
    const dt = this.lastFrameTime > 0 ? Math.min(now - this.lastFrameTime, 0.1) : 0.016;
    this.lastFrameTime = now;

    // Keyboard-driven surface movement via CameraController
    const isSurface = this.cameraController.mode(this.camera.targetZoom) === 'surface';
    if (isSurface && !this.wasSurface) {
      this.cameraController.reset(); // entering surface for the first time
    }
    this.wasSurface = isSurface;
    this.isSurfaceMode = isSurface;

    const movement = this.cameraController.update(this.inputManager, this.camera.targetZoom, dt);
    if (movement.dx !== 0 || movement.dy !== 0) {
      this.camera.targetX += movement.dx;
      this.camera.targetY += movement.dy;
    }

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

    const zoom = this.camera.zoom;
    const rctx = this.buildRenderContext();

    // Render layers with crossfade zones for smooth transitions
    // Galaxy scale: 0.5 → 80 (fade out 50-80)
    if (zoom < 80) {
      this.cachedGalaxies = renderGalaxies(rctx, left, right, top, bottom);
    }

    // Star scale: 30 → 8000 (fade in 30-60, fade out 4000-8000)
    if (zoom >= 30 && zoom < 8000) {
      this.cachedStars = renderStars(rctx, left, right, top, bottom);
      // Nebulae visible at galaxy/sector scale
      const nebulaIntensity = zoom < 500
        ? (zoom - 50) / 450
        : Math.max(0, 1 - (zoom - 500) / 4500);
      if (nebulaIntensity > 0.01) {
        this.engine.drawNebula(
          this.camera.x, this.camera.y, zoom,
          nebulaIntensity * 0.8,
        );
      }
    }

    // System scale: 3000 → 500K (fade in 3000-6000)
    if (zoom >= 3000 && zoom < 500000) {
      const result = renderSystem(
        rctx, this.cachedSystem, this.focusedPlanet, this.focusedPlanetStar,
      );
      this.cachedSystem = result.cachedSystem;
      this.cachedPlanetScreenPositions = result.cachedPlanetScreenPositions;
      this.focusedPlanet = result.focusedPlanet;
      this.focusedPlanetStar = result.focusedPlanetStar;
    }

    // Show planet picker when approaching surface boundary
    // (zoom 100K-500K) with multiple planets available
    this.showPlanetPicker = zoom >= 100000 && zoom < 500000
      && (this.cachedSystem?.planets?.length ?? 0) > 1;

    // Surface scale: 500K+
    if (zoom >= 500000) {
      const result = renderSurface(
        rctx, this.focusedPlanet, this.focusedPlanetStar,
        this.cachedSystem, this.cameraController,
      );
      this.focusedPlanet = result.focusedPlanet;
      this.focusedPlanetStar = result.focusedPlanetStar;
      this.cachedSystem = result.cachedSystem;
    }

    this.engine.endFrame();
  }

  // ─── Render Context Builder ──────────────────────────────────────────────

  private buildRenderContext(): RenderContext {
    return {
      engine: this.engine,
      particles: this.particles,
      overlayCtx: this.overlayCtx,
      overlayCanvas: this.overlayCanvas,
      camera: this.camera,
      time: this.time,
      cosmicTime: this.cosmicTime,
    };
  }

  // Event handlers
  handleWheel = (event: WheelEvent): void => {
    event.preventDefault();

    // On the terrain surface (zoom ≥ 5M, fully past atmosphere),
    // scroll adjusts walk speed. Hold Alt/Option to zoom out instead.
    if (this.camera.targetZoom >= 5000000 && !event.altKey) {
      const dir = event.deltaY > 0 ? -1 : 1;
      this.cameraController.adjustSpeed(dir);
      return;
    }

    const zoomFactor = event.deltaY > 0 ? 0.85 : 1.18;
    this.camera.targetZoom = Math.max(
      0.5,
      Math.min(500000000, this.camera.targetZoom * zoomFactor)
    );

    if (this.camera.targetZoom < 3000) {
      this.cachedSystem = null;
      this.cachedPlanetScreenPositions = [];
    }
    if (this.camera.targetZoom < 500000) {
      // Only clear focused planet when zooming OUT past atmosphere
      if (zoomFactor < 1) {
        this.focusedPlanet = null;
        this.focusedPlanetStar = null;
      }
    }
  };

  handleKeyDown = (event: KeyboardEvent): void => {
    // Toggle controls overlay with ? or H
    if (event.key === '?' || event.key === 'h' || event.key === 'H') {
      // Don't toggle if actively typing in an input
      if ((event.target as HTMLElement)?.tagName === 'INPUT') return;
      this.showControlsOverlay = !this.showControlsOverlay;
      return;
    }

    // Escape: close controls overlay, or return to orbit from surface
    if (event.key === 'Escape') {
      if (this.showControlsOverlay) {
        this.showControlsOverlay = false;
        return;
      }
      // If on surface, zoom back out to system view
      if (this.camera.targetZoom >= 500000) {
        this.camera.targetZoom = 50000;
        this.focusedPlanet = null;
        this.focusedPlanetStar = null;
        return;
      }
    }
  };

  handleReturnToOrbit = (): void => {
    this.camera.targetZoom = 50000;
    this.focusedPlanet = null;
    this.focusedPlanetStar = null;
  };

  handleSelectPlanet = (planet: Planet): void => {
    this.focusedPlanet = planet;
    if (this.cachedSystem) {
      this.focusedPlanetStar = this.cachedSystem.star;
    }
    this.selectedObject = planet;
    // Zoom toward the planet's surface
    this.camera.targetZoom = Math.min(500000000, this.camera.zoom * 3);
  };

  handleCloseControls = (): void => {
    this.showControlsOverlay = false;
  };

  handleToggleControls = (): void => {
    this.showControlsOverlay = !this.showControlsOverlay;
  };

  handlePointerDown = (event: PointerEvent): void => {
    // Ensure canvas has keyboard focus for WASD controls
    (event.currentTarget as HTMLElement)?.focus();

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
        if (this.camera.targetZoom < 3000) {
          this.cachedSystem = null;
          this.cachedPlanetScreenPositions = [];
        }
      }
    } else if (this.isDragging) {
      const rawDx = event.clientX - this.lastMouseX;
      const rawDy = event.clientY - this.lastMouseY;

      if (this.camera.zoom >= 500000) {
        // Surface scale: mouse drag rotates the view (FPS-style)
        this.cameraController.applyMouseLook(rawDx, rawDy);
      } else {
        // Space scale: drag pans the camera in world space
        const dx = rawDx / this.camera.zoom;
        const dy = rawDy / this.camera.zoom;
        this.camera.targetX -= dx;
        this.camera.targetY -= dy;
        this.camera.x = this.camera.targetX;
        this.camera.y = this.camera.targetY;
      }

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

    // Check planets (system view)
    for (const entry of this.cachedPlanetScreenPositions) {
      const dist = Math.sqrt(
        (mx - entry.px) ** 2 + (my - entry.py) ** 2
      );
      if (dist < Math.max(entry.size * 2.5, 15)) {
        // Focus on this planet and zoom to surface
        this.focusedPlanet = entry.planet;
        if (this.cachedSystem) {
          this.focusedPlanetStar = this.cachedSystem.star;
        }
        this.selectedObject = entry.planet;
        this.camera.targetZoom = Math.min(500000000, this.camera.zoom * 5);
        return;
      }
    }
  };

  private focusOn(x: number, y: number, zoom: number): void {
    this.camera.targetX = x;
    this.camera.targetY = y;
    this.camera.targetZoom = Math.min(500000000, zoom);
    this.cachedSystem = null;
    this.cachedPlanetScreenPositions = [];
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

  handleTimeChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.cosmicTime = parseFloat(input.value);
    const props = getCosmicProperties(this.cosmicTime);
    this.cosmicEraName = props.era.name;
    this.cosmicYears = props.yearsBillion.toFixed(1);
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
        {{on "keydown" this.handleKeyDown}}
      ></canvas>
      <canvas class="cosmos-overlay"></canvas>

      <header class="cosmos-header">
        <h1>🌌 COSMOS</h1>
        <div class="header-actions">
          <button
            type="button"
            title="Controls reference (H)"
            {{on "click" this.handleToggleControls}}
            class={{if this.showControlsOverlay "active"}}
          >
            ❓ Controls
          </button>
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
        @isSurface={{this.isSurfaceMode}}
      />

      <div class="scale-indicator">
        <span>{{this.currentScale.name}}</span>
      </div>

      <div class="time-scrubber">
        <div class="time-label">
          <span class="time-era">{{this.cosmicEraName}}</span>
          <span class="time-years">{{this.cosmicYears}} Gyr</span>
        </div>
        {{! template-lint-disable no-inline-styles }}
        <input
          type="range"
          class="time-slider"
          min="0"
          max="1"
          step="0.005"
          value={{this.cosmicTime}}
          {{on "input" this.handleTimeChange}}
        />
        <div class="time-endpoints">
          <span>Big Bang</span>
          <span>Heat Death</span>
        </div>
      </div>

      {{#if this.showBookmarksModal}}
        <BookmarksModal
          @onClose={{this.handleCloseBookmarks}}
          @onNavigate={{this.handleNavigateToBookmark}}
        />
      {{/if}}

      {{#if this.showPlanetPicker}}
        <PlanetPicker
          @planets={{this.cachedSystem.planets}}
          @focusedPlanet={{this.focusedPlanet}}
          @onSelect={{this.handleSelectPlanet}}
        />
      {{/if}}

      {{#if this.isSurfaceMode}}
        <button
          type="button"
          class="return-to-orbit"
          title="Return to orbit (Escape)"
          {{on "click" this.handleReturnToOrbit}}
        >
          ↑ Return to Orbit
        </button>
      {{/if}}

      {{#if this.showControlsOverlay}}
        <div class="controls-overlay">
          <div class="controls-card">
            <div class="controls-header">
              <h2>Controls</h2>
              <button type="button" class="controls-close" {{on "click" this.handleCloseControls}}>✕</button>
            </div>
            <div class="controls-section">
              <h3>Space Navigation</h3>
              <div class="control-row"><kbd>Scroll</kbd><span>Zoom in / out</span></div>
              <div class="control-row"><kbd>Click + Drag</kbd><span>Pan camera</span></div>
              <div class="control-row"><kbd>Click</kbd><span>Select galaxy / star / planet</span></div>
              <div class="control-row"><kbd>Pinch</kbd><span>Pinch to zoom (trackpad)</span></div>
            </div>
            <div class="controls-section">
              <h3>Surface Exploration</h3>
              <div class="control-row"><kbd>W A S D</kbd><span>Walk forward / left / back / right</span></div>
              <div class="control-row"><kbd>Q / E</kbd><span>Turn left / right</span></div>
              <div class="control-row"><kbd>Drag</kbd><span>Mouse look</span></div>
              <div class="control-row"><kbd>Scroll</kbd><span>Adjust walk speed</span></div>
              <div class="control-row"><kbd>Alt + Scroll</kbd><span>Zoom out</span></div>
              <div class="control-row"><kbd>Escape</kbd><span>Return to orbit</span></div>
            </div>
            <div class="controls-section">
              <h3>General</h3>
              <div class="control-row"><kbd>H</kbd><span>Toggle this overlay</span></div>
              <div class="control-row"><kbd>Time slider</kbd><span>Travel through cosmic history</span></div>
            </div>
          </div>
        </div>
      {{/if}}

      {{#if this.toastVisible}}
        <div class="toast">{{this.toastMessage}}</div>
      {{/if}}
    </div>
  </template>
}
