import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import type { Scene } from "the-island/services/game-state";

type StarSpec = {
  x: number;
  y: number;
  size: number;
  hue: number;
  delay: number;
};

const STARFIELD: StarSpec[] = [
  { x: 8, y: 12, size: 2.2, hue: 200, delay: 0.2 },
  { x: 15, y: 28, size: 1.4, hue: 215, delay: 1.1 },
  { x: 22, y: 18, size: 1.8, hue: 260, delay: 2.4 },
  { x: 32, y: 8, size: 1.2, hue: 190, delay: 3.2 },
  { x: 38, y: 24, size: 2.6, hue: 240, delay: 0.6 },
  { x: 44, y: 14, size: 1.6, hue: 210, delay: 1.6 },
  { x: 52, y: 32, size: 1.8, hue: 280, delay: 2.1 },
  { x: 60, y: 10, size: 1.2, hue: 200, delay: 3.1 },
  { x: 68, y: 22, size: 2.2, hue: 250, delay: 0.8 },
  { x: 74, y: 14, size: 1.4, hue: 235, delay: 1.3 },
  { x: 80, y: 30, size: 1.8, hue: 195, delay: 2.6 },
  { x: 90, y: 18, size: 2.6, hue: 270, delay: 0.4 },
  { x: 12, y: 48, size: 1.6, hue: 230, delay: 2.9 },
  { x: 24, y: 54, size: 2.4, hue: 210, delay: 0.9 },
  { x: 36, y: 46, size: 1.6, hue: 255, delay: 1.9 },
  { x: 48, y: 58, size: 1.8, hue: 190, delay: 3.4 },
  { x: 60, y: 50, size: 2.8, hue: 275, delay: 0.3 },
  { x: 72, y: 56, size: 1.4, hue: 220, delay: 2.2 },
  { x: 84, y: 48, size: 2.2, hue: 245, delay: 1.4 },
  { x: 92, y: 60, size: 1.2, hue: 205, delay: 3.0 },
  { x: 18, y: 78, size: 2.2, hue: 225, delay: 0.5 },
  { x: 30, y: 70, size: 1.6, hue: 260, delay: 1.7 },
  { x: 48, y: 82, size: 2.4, hue: 200, delay: 2.5 },
  { x: 64, y: 74, size: 1.2, hue: 240, delay: 3.6 },
  { x: 78, y: 86, size: 2.0, hue: 280, delay: 0.1 },
  { x: 88, y: 76, size: 1.6, hue: 210, delay: 1.8 },
];

interface SignalDeckSignature {
  Args: {
    onClose: () => void;
    scene: Scene;
  };
  Element: HTMLDivElement;
}

export default class SignalDeck extends Component<SignalDeckSignature> {
  @tracked cursorX = 50;
  @tracked cursorY = 50;
  @tracked tide = 0.4;
  @tracked sky = 0.65;
  @tracked resonance = 0.72;

  get stars(): Array<{ style: string }> {
    return STARFIELD.map((star) => ({
      style: `left: ${star.x}%; top: ${star.y}%; --star-size: ${star.size}px; --star-hue: ${star.hue}; --star-delay: ${star.delay}s;`,
    }));
  }

  get signalStyle(): string {
    const skyHue = Math.round(200 + this.sky * 120);
    const tideGlow = (0.2 + this.tide * 0.6).toFixed(2);
    const resonanceGlow = (0.3 + this.resonance * 0.7).toFixed(2);
    return `--cursor-x: ${this.cursorX}%; --cursor-y: ${this.cursorY}%; --tide: ${this.tide}; --sky: ${this.sky}; --resonance: ${this.resonance}; --sky-hue: ${skyHue}deg; --tide-glow: ${tideGlow}; --resonance-glow: ${resonanceGlow};`;
  }

  get tideLabel(): string {
    if (this.tide < 0.34) return "Ebb";
    if (this.tide < 0.67) return "Flow";
    return "Surge";
  }

  get skyLabel(): string {
    if (this.sky < 0.34) return "Dusk";
    if (this.sky < 0.67) return "Starlight";
    return "Aurora";
  }

  get resonanceLabel(): string {
    if (this.resonance < 0.34) return "Faint";
    if (this.resonance < 0.67) return "Harmonic";
    return "Resonant";
  }

  @action
  handleMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.cursorX = Math.max(0, Math.min(100, x));
    this.cursorY = Math.max(0, Math.min(100, y));
  }

  @action
  resetCursor(): void {
    this.cursorX = 50;
    this.cursorY = 50;
  }

  @action
  updateTide(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.tide = Number.isFinite(value) ? value : this.tide;
  }

  @action
  updateSky(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.sky = Number.isFinite(value) ? value : this.sky;
  }

  @action
  updateResonance(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.resonance = Number.isFinite(value) ? value : this.resonance;
  }

  @action
  close(): void {
    this.args.onClose();
  }

  <template>
    <div
      class="signal-deck"
      role="dialog"
      aria-label="Beacon Signal Deck"
      style={{this.signalStyle}}
      {{on "mousemove" this.handleMouseMove}}
      {{on "mouseleave" this.resetCursor}}
      ...attributes
    >
      <div class="signal-shell">
        <section class="signal-sky" aria-label="Signal visualization">
          <div class="signal-grid"></div>
          <div class="signal-beam"></div>
          <div class="signal-halo"></div>
          <div class="signal-constellations">
            {{#each this.stars as |star|}}
              <span class="signal-star" style={{star.style}}></span>
            {{/each}}
          </div>
          <div class="signal-label">
            <p class="signal-overline">Beacon Relay</p>
            <h2>{{@scene.name}}</h2>
            <p class="signal-description">{{@scene.description}}</p>
          </div>
        </section>

        <aside class="signal-console">
          <div class="signal-panel">
            <header class="signal-panel-header">
              <h3>Resonance Console</h3>
              <p>Align the tide, sky, and beam to reveal a passage on the cliffs.</p>
            </header>

            <div class="signal-metrics">
              <div class="signal-metric">
                <span class="signal-metric-label">Tide Phase</span>
                <span class="signal-metric-value">{{this.tideLabel}}</span>
              </div>
              <div class="signal-metric">
                <span class="signal-metric-label">Sky State</span>
                <span class="signal-metric-value">{{this.skyLabel}}</span>
              </div>
              <div class="signal-metric">
                <span class="signal-metric-label">Beam Resonance</span>
                <span class="signal-metric-value">{{this.resonanceLabel}}</span>
              </div>
            </div>

            <div class="signal-slider-group">
              <label class="signal-slider">
                <span>Adjust Tide</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={{this.tide}}
                  {{on "input" this.updateTide}}
                />
              </label>
              <label class="signal-slider">
                <span>Shift Sky</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={{this.sky}}
                  {{on "input" this.updateSky}}
                />
              </label>
              <label class="signal-slider">
                <span>Tune Beam</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={{this.resonance}}
                  {{on "input" this.updateResonance}}
                />
              </label>
            </div>

            <div class="signal-readout">
              <p>Signal Integrity</p>
              <div class="signal-meter">
                <div class="signal-meter-fill"></div>
              </div>
              <p class="signal-hint">Move your cursor across the sky to steer the beam.</p>
            </div>
          </div>

          <button type="button" class="signal-close" {{on "click" this.close}}>
            Return to Shore
          </button>
        </aside>
      </div>
    </div>
  </template>
}
