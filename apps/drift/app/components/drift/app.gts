import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { modifier } from "ember-modifier";
import { on } from "@ember/modifier";
import { DriftEngine } from "drift/drift/init";

// Available palette keys — drives the <select> options
const PALETTES = [
  { key: "aurora", label: "Aurora" },
  { key: "ember", label: "Ember" },
  { key: "ocean", label: "Ocean" },
  { key: "neon", label: "Neon" },
  { key: "monochrome", label: "Monochrome" },
  { key: "sunset", label: "Sunset" },
  { key: "toxic", label: "Toxic" },
];

export default class DriftApp extends Component {
  // ── Tracked state (drives template reactivity) ───────────────

  @tracked palette = "aurora";
  @tracked particleCount = 3000;
  @tracked noiseScale = 0.003;
  @tracked speed = 1.5;
  @tracked trailAlpha = 0.92;
  @tracked wellStrength = 150;
  @tracked attractMode = true;
  @tracked controlsVisible = true;
  @tracked statusMessage = "";
  @tracked statusVisible = false;

  engine: DriftEngine | null = null;
  statusTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed getters ─────────────────────────────────────────

  get wellModeLabel() {
    return this.attractMode ? "🧲 Attract" : "💨 Repel";
  }

  get noiseScaleDisplay() {
    return this.noiseScale.toFixed(3);
  }

  get speedDisplay() {
    return this.speed.toFixed(1);
  }

  get trailAlphaDisplay() {
    return this.trailAlpha.toFixed(2);
  }

  get controlsPanelClass() {
    return this.controlsVisible ? "controls-panel" : "controls-panel collapsed";
  }

  get statusClass() {
    return this.statusVisible ? "status success" : "status hidden";
  }

  // ── Canvas setup modifier ────────────────────────────────────

  setupCanvas = modifier((canvas: HTMLCanvasElement) => {
    this.engine = new DriftEngine(canvas, {
      palette: this.palette,
      particleCount: this.particleCount,
      noiseScale: this.noiseScale,
      speed: this.speed,
      trailAlpha: this.trailAlpha,
      wellStrength: this.wellStrength,
      attractMode: this.attractMode,
    });

    this.engine.start();

    return () => {
      this.engine?.destroy();
      this.engine = null;
    };
  });

  // ── Status toast ─────────────────────────────────────────────

  showStatus = (message: string) => {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusMessage = message;
    this.statusVisible = true;
    this.statusTimer = setTimeout(() => {
      this.statusVisible = false;
    }, 2000);
  };

  // ── Event handlers (fat arrows — auto-bound) ────────────────

  onPaletteChange = (e: Event) => {
    this.palette = (e.target as HTMLSelectElement).value;
    this.engine?.setPalette(this.palette);
  };

  onParticleCountInput = (e: Event) => {
    this.particleCount = parseInt((e.target as HTMLInputElement).value);
    this.engine?.setParticleCount(this.particleCount);
  };

  onNoiseScaleInput = (e: Event) => {
    this.noiseScale = parseFloat((e.target as HTMLInputElement).value);
    this.engine?.setNoiseScale(this.noiseScale);
  };

  onSpeedInput = (e: Event) => {
    this.speed = parseFloat((e.target as HTMLInputElement).value);
    this.engine?.setSpeed(this.speed);
  };

  onTrailAlphaInput = (e: Event) => {
    this.trailAlpha = parseFloat((e.target as HTMLInputElement).value);
    this.engine?.setTrailAlpha(this.trailAlpha);
  };

  onWellStrengthInput = (e: Event) => {
    this.wellStrength = parseInt((e.target as HTMLInputElement).value);
    this.engine?.setWellStrength(this.wellStrength);
  };

  toggleWellMode = () => {
    this.attractMode = !this.attractMode;
    this.engine?.setAttractMode(this.attractMode);
  };

  clearWells = () => {
    this.engine?.clearWells();
    this.showStatus("Wells cleared");
  };

  resetCanvas = () => {
    this.engine?.reset();
    this.showStatus("Canvas reset");
  };

  exportPNG = () => {
    this.engine?.exportPNG();
    this.showStatus("Exported PNG");
  };

  toggleControls = () => {
    this.controlsVisible = !this.controlsVisible;
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="drift-app">
      <canvas id="drift-canvas" {{this.setupCanvas}}></canvas>

      <div class="ui-overlay">
        <header class="drift-header">
          <a href="../../" class="back">← All Tools</a>
          <h1>🌊 Drift</h1>
          <p class="subtitle">Generative particle art — click to create gravity wells</p>
        </header>

        <div class={{this.controlsPanelClass}}>
          <div class="control-group">
            <label for="palette">Palette</label>
            <select id="palette" {{on "change" this.onPaletteChange}}>
              {{#each PALETTES as |p|}}
                <option value={{p.key}} selected={{eq p.key this.palette}}>{{p.label}}</option>
              {{/each}}
            </select>
          </div>

          <div class="control-group">
            <label for="particleCount">Particles: {{this.particleCount}}</label>
            <input
              type="range"
              id="particleCount"
              min="500"
              max="8000"
              value={{this.particleCount}}
              step="100"
              {{on "input" this.onParticleCountInput}}
            />
          </div>

          <div class="control-group">
            <label for="noiseScale">Turbulence: {{this.noiseScaleDisplay}}</label>
            <input
              type="range"
              id="noiseScale"
              min="0.001"
              max="0.010"
              value={{this.noiseScale}}
              step="0.001"
              {{on "input" this.onNoiseScaleInput}}
            />
          </div>

          <div class="control-group">
            <label for="speed">Flow Speed: {{this.speedDisplay}}</label>
            <input
              type="range"
              id="speed"
              min="0.2"
              max="5.0"
              value={{this.speed}}
              step="0.1"
              {{on "input" this.onSpeedInput}}
            />
          </div>

          <div class="control-group">
            <label for="trailLength">Trail Length: {{this.trailAlphaDisplay}}</label>
            <input
              type="range"
              id="trailLength"
              min="0.80"
              max="0.99"
              value={{this.trailAlpha}}
              step="0.01"
              {{on "input" this.onTrailAlphaInput}}
            />
          </div>

          <div class="control-group">
            <label for="wellStrength">Well Strength: {{this.wellStrength}}</label>
            <input
              type="range"
              id="wellStrength"
              min="50"
              max="500"
              value={{this.wellStrength}}
              step="10"
              {{on "input" this.onWellStrengthInput}}
            />
          </div>

          <div class="control-row">
            <button class="ctrl-btn" type="button" title="Toggle attract/repel" {{on "click" this.toggleWellMode}}>
              {{this.wellModeLabel}}
            </button>
            <button class="ctrl-btn" type="button" title="Clear all gravity wells" {{on "click" this.clearWells}}>
              ✖ Clear Wells
            </button>
          </div>

          <div class="control-row">
            <button class="ctrl-btn" type="button" title="Reset canvas" {{on "click" this.resetCanvas}}>
              🔄 Reset
            </button>
            <button class="ctrl-btn accent" type="button" title="Save as PNG" {{on "click" this.exportPNG}}>
              📸 Export PNG
            </button>
          </div>

          <button class="toggle-btn" type="button" {{on "click" this.toggleControls}}>☰</button>
        </div>
      </div>

      <div class={{this.statusClass}}>{{this.statusMessage}}</div>

      <footer class="drift-footer">
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener noreferrer">Cory Loken &amp; Chiron</a>
          using
          <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}

// Simple helper for select comparison
function eq(a: string, b: string): boolean {
  return a === b;
}
