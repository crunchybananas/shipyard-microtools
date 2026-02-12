import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { modifier } from "ember-modifier";
import { on } from "@ember/modifier";
import { CascadeEngine } from "cascade/cascade/init";

export default class CascadeApp extends Component {
  // ── Tracked state ────────────────────────────────────────────

  @tracked score = 0;
  @tracked best = parseInt(localStorage.getItem("cascade-best") || "0");
  @tracked message = "";
  @tracked messageVisible = false;

  engine: CascadeEngine | null = null;

  // ── Computed ─────────────────────────────────────────────────

  get messageClass() {
    return this.messageVisible ? "message show" : "message";
  }

  // ── Canvas + grid setup modifier ─────────────────────────────

  setupCanvas = modifier((canvas: HTMLCanvasElement) => {
    const gridEl = document.getElementById("grid") as HTMLDivElement;
    if (!gridEl) return;

    this.engine = new CascadeEngine(canvas, gridEl, {
      onScoreUpdate: (score: number, best: number) => {
        this.score = score;
        this.best = best;
      },
      onMessage: (text: string, visible: boolean) => {
        this.message = text;
        this.messageVisible = visible;
      },
    });

    this.engine.start();

    return () => {
      this.engine?.destroy();
      this.engine = null;
    };
  });

  // ── Event handlers (fat arrows) ──────────────────────────────

  newGame = () => {
    this.engine?.startGame();
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="cascade-root">
      <canvas id="cascade-canvas" {{this.setupCanvas}}></canvas>

      <div class="game-container">
        <div class="header">
          <div class="title-area">
            <a href="../../" class="back">←</a>
            <h1>🌊 Cascade</h1>
          </div>
          <div class="scores">
            <div class="score-box">
              <span class="score-label">SCORE</span>
              <span class="score-value">{{this.score}}</span>
            </div>
            <div class="score-box">
              <span class="score-label">BEST</span>
              <span class="score-value">{{this.best}}</span>
            </div>
          </div>
        </div>

        <div class="sub-header">
          <p class="tagline">Merge tiles. Paint the canvas.</p>
          <button class="new-game-btn" type="button" {{on "click" this.newGame}}>New Game</button>
        </div>

        <div class="grid-wrapper">
          <div id="grid" class="grid"></div>
          <div class={{this.messageClass}}>{{this.message}}</div>
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
