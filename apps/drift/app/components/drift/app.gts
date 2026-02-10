import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeDrift } from "drift/drift/init";

export default class DriftApp extends Component {
  setupDrift = modifier((element: HTMLElement) => {
    initializeDrift(element);
  });

  <template>
    <div class="drift-app" {{this.setupDrift}}>
      <canvas id="drift-canvas"></canvas>

      <div class="ui-overlay">
        <header class="drift-header">
          <a href="../../" class="back">← All Tools</a>
          <h1>🌊 Drift</h1>
          <p class="subtitle">Generative particle art — click to create gravity wells</p>
        </header>

        <div class="controls-panel" id="controls">
          <div class="control-group">
            <label for="palette">Palette</label>
            <select id="palette">
              <option value="aurora">Aurora</option>
              <option value="ember">Ember</option>
              <option value="ocean">Ocean</option>
              <option value="neon">Neon</option>
              <option value="monochrome">Monochrome</option>
              <option value="sunset">Sunset</option>
              <option value="toxic">Toxic</option>
            </select>
          </div>

          <div class="control-group">
            <label for="particleCount">Particles: <span id="particleCountVal">3000</span></label>
            <input type="range" id="particleCount" min="500" max="8000" value="3000" step="100" />
          </div>

          <div class="control-group">
            <label for="noiseScale">Turbulence: <span id="noiseScaleVal">0.003</span></label>
            <input type="range" id="noiseScale" min="0.001" max="0.010" value="0.003" step="0.001" />
          </div>

          <div class="control-group">
            <label for="speed">Flow Speed: <span id="speedVal">1.5</span></label>
            <input type="range" id="speed" min="0.2" max="5.0" value="1.5" step="0.1" />
          </div>

          <div class="control-group">
            <label for="trailLength">Trail Length: <span id="trailLengthVal">0.92</span></label>
            <input type="range" id="trailLength" min="0.80" max="0.99" value="0.92" step="0.01" />
          </div>

          <div class="control-group">
            <label for="wellStrength">Well Strength: <span id="wellStrengthVal">150</span></label>
            <input type="range" id="wellStrength" min="50" max="500" value="150" step="10" />
          </div>

          <div class="control-row">
            <button id="toggleWellMode" class="ctrl-btn" type="button" title="Toggle attract/repel">
              🧲 Attract
            </button>
            <button id="clearWells" class="ctrl-btn" type="button" title="Clear all gravity wells">
              ✖ Clear Wells
            </button>
          </div>

          <div class="control-row">
            <button id="resetBtn" class="ctrl-btn" type="button" title="Reset canvas">
              🔄 Reset
            </button>
            <button id="exportBtn" class="ctrl-btn accent" type="button" title="Save as PNG">
              📸 Export PNG
            </button>
          </div>

          <button id="toggleControls" class="toggle-btn" type="button">☰</button>
        </div>
      </div>

      <div id="well-indicator" class="well-indicator hidden"></div>
      <div id="status" class="status hidden"></div>

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
