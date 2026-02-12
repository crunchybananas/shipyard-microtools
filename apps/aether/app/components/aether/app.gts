import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import { AetherEngine } from "aether/aether/engine";

export default class AetherApp extends Component {
  private engine: AetherEngine | null = null;

  // ── Tracked UI state (controls) ──────────────────────────────

  @tracked curl = 30;
  @tracked splatSize = 25;
  @tracked velocityDissipation = 0.1;
  @tracked dyeDissipation = 0.3;
  @tracked pressureIterations = 20;
  @tracked controlsVisible = true;

  // ── Computed display values ──────────────────────────────────

  get curlDisplay() { return String(this.curl); }
  get splatDisplay() { return this.splatSize.toFixed(1); }
  get velDissDisplay() { return this.velocityDissipation.toFixed(2); }
  get dyeDissDisplay() { return this.dyeDissipation.toFixed(2); }
  get pressDisplay() { return String(this.pressureIterations); }
  get panelClass() { return this.controlsVisible ? "controls-panel" : "controls-panel collapsed"; }

  // ── Modifier (literal defaults → no auto-tracking gotcha) ───

  setupCanvas = modifier((element: HTMLElement) => {
    const canvas = element.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) return;
    try {
      const engine = new AetherEngine(canvas);
      this.engine = engine;
      engine.start();
      return () => engine.destroy();
    } catch {
      element.innerHTML = "<p style='color:#f87171;text-align:center;margin-top:4rem'>WebGL not supported</p>";
    }
    return undefined;
  });

  // ── Event handlers (fat arrows) ──────────────────────────────

  onCurlChange = (e: Event) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.curl = v;
    this.engine?.setCurl(v);
  };

  onSplatSizeChange = (e: Event) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.splatSize = v;
    this.engine?.setSplatRadius(v);
  };

  onVelDissChange = (e: Event) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.velocityDissipation = v;
    this.engine?.setVelocityDissipation(v);
  };

  onDyeDissChange = (e: Event) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.dyeDissipation = v;
    this.engine?.setDyeDissipation(v);
  };

  onPressIterChange = (e: Event) => {
    const v = parseInt((e.target as HTMLInputElement).value);
    this.pressureIterations = v;
    this.engine?.setPressureIterations(v);
  };

  toggleControls = () => {
    this.controlsVisible = !this.controlsVisible;
  };

  burst = () => { this.engine?.randomBurst(); };
  reset = () => { this.engine?.reset(); };
  exportImage = () => { this.engine?.exportImage(); };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="aether-root" {{this.setupCanvas}}>
      <canvas></canvas>

      <button class="toggle-btn" title="Toggle Controls" type="button" {{on "click" this.toggleControls}}>⚙</button>

      <div class={{this.panelClass}}>
        <div class="controls-header">
          <a href="../../" class="back">←</a>
          <h2>🌀 Aether</h2>
        </div>

        <label>
          <span>Curl <span>{{this.curlDisplay}}</span></span>
          <input type="range" min="0" max="50" step="1" value="30" {{on "input" this.onCurlChange}} />
        </label>

        <label>
          <span>Splat Size <span>{{this.splatDisplay}}</span></span>
          <input type="range" min="5" max="80" step="1" value="25" {{on "input" this.onSplatSizeChange}} />
        </label>

        <label>
          <span>Velocity Decay <span>{{this.velDissDisplay}}</span></span>
          <input type="range" min="0" max="4" step="0.05" value="0.1" {{on "input" this.onVelDissChange}} />
        </label>

        <label>
          <span>Dye Decay <span>{{this.dyeDissDisplay}}</span></span>
          <input type="range" min="0" max="5" step="0.1" value="0.3" {{on "input" this.onDyeDissChange}} />
        </label>

        <label>
          <span>Pressure Iters <span>{{this.pressDisplay}}</span></span>
          <input type="range" min="5" max="60" step="1" value="20" {{on "input" this.onPressIterChange}} />
        </label>

        <div class="btn-row">
          <button class="ctrl-btn" type="button" {{on "click" this.burst}}>🎲 Burst</button>
          <button class="ctrl-btn" type="button" {{on "click" this.reset}}>🔄 Reset</button>
          <button class="ctrl-btn" type="button" {{on "click" this.exportImage}}>📸 Export</button>
        </div>

        <p class="hint">Click &amp; drag to inject fluid</p>

        <p class="credits">
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener noreferrer">Cory Loken &amp; Chiron</a>
          · <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </div>
    </div>
  </template>
}
