import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initialize } from "cascade/cascade/init";

export default class CascadeApp extends Component {
  setup = modifier((element: HTMLElement) => {
    initialize(element);
  });

  <template>
    <div class="cascade-root" {{this.setup}}>
      <canvas id="cascade-canvas"></canvas>

      <div class="game-container">
        <div class="header">
          <div class="title-area">
            <a href="../../" class="back">←</a>
            <h1>🌊 Cascade</h1>
          </div>
          <div class="scores">
            <div class="score-box">
              <span class="score-label">SCORE</span>
              <span id="score" class="score-value">0</span>
            </div>
            <div class="score-box">
              <span class="score-label">BEST</span>
              <span id="best" class="score-value">0</span>
            </div>
          </div>
        </div>

        <div class="sub-header">
          <p class="tagline">Merge tiles. Paint the canvas.</p>
          <button id="newGameBtn" class="new-game-btn">New Game</button>
        </div>

        <div class="grid-wrapper">
          <div id="grid" class="grid"></div>
          <div id="message" class="message"></div>
        </div>

        <p class="hint">Arrow keys or swipe · also try painting on the canvas</p>

        <p class="credits">
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener noreferrer">Cory Loken &amp; Chiron</a>
          · <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </div>
    </div>
  </template>
}
