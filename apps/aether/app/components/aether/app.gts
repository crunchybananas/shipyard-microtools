import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initialize } from "aether/aether/init";

export default class AetherApp extends Component {
  setup = modifier((element: HTMLElement) => {
    initialize(element);
  });

  <template>
    <div class="aether-root" {{this.setup}}>
      <canvas id="aether-canvas"></canvas>

      <button id="toggleControls" class="toggle-btn" title="Toggle Controls">⚙</button>

      <div id="controls" class="controls-panel">
        <div class="controls-header">
          <a href="../../" class="back">←</a>
          <h2>🌀 Aether</h2>
        </div>

        <label>
          <span>Curl <span id="curlVal">30</span></span>
          <input id="curlAmount" type="range" min="0" max="50" step="1" value="30" />
        </label>

        <label>
          <span>Splat Size <span id="splatVal">25.0</span></span>
          <input id="splatSize" type="range" min="5" max="80" step="1" value="25" />
        </label>

        <label>
          <span>Velocity Decay <span id="velDissVal">0.10</span></span>
          <input id="velDissipation" type="range" min="0" max="4" step="0.05" value="0.1" />
        </label>

        <label>
          <span>Dye Decay <span id="dyeDissVal">0.30</span></span>
          <input id="dyeDissipation" type="range" min="0" max="5" step="0.1" value="0.3" />
        </label>

        <label>
          <span>Pressure Iters <span id="pressVal">20</span></span>
          <input id="pressureIter" type="range" min="5" max="60" step="1" value="20" />
        </label>

        <div class="btn-row">
          <button id="randomSplat" class="ctrl-btn">🎲 Burst</button>
          <button id="resetBtn" class="ctrl-btn">🔄 Reset</button>
          <button id="exportBtn" class="ctrl-btn">📸 Export</button>
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
