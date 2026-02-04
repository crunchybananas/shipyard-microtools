import Component from "@glimmer/component";
import { service } from "@ember/service";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type GameEngineService from "cargo-tetris/services/game-engine";
import CargoTetrisHud from "./hud";

export default class CargoTetrisApp extends Component {
  @service declare gameEngine: GameEngineService;

  setupCanvas = modifier((element: HTMLElement) => {
    const mainCanvas = element.querySelector(
      "#gameCanvas",
    ) as HTMLCanvasElement | null;
    const nextCanvas = element.querySelector(
      "#nextCanvas",
    ) as HTMLCanvasElement | null;

    if (mainCanvas && nextCanvas) {
      this.gameEngine.setCanvases(mainCanvas, nextCanvas);
    }
  });

  handleKeydown = (event: KeyboardEvent): void => {
    const handled = this.gameEngine.handleKeydown(event.code);
    if (
      handled ||
      ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(
        event.code,
      )
    ) {
      event.preventDefault();
    }
  };

  startGame = (): void => {
    this.gameEngine.startGame();
  };

  get isStartScreen(): boolean {
    return this.gameEngine.screen === "start";
  }

  get isPlaying(): boolean {
    return this.gameEngine.screen === "playing";
  }

  get isGameOver(): boolean {
    return this.gameEngine.screen === "gameover";
  }

  get score(): number {
    return this.gameEngine.score;
  }

  get lines(): number {
    return this.gameEngine.lines;
  }

  get level(): number {
    return this.gameEngine.level;
  }

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>📦 Cargo Tetris</h1>
        <p class="subtitle">Stack containers on the ship deck. Clear rows,
          don't let it overflow!</p>
      </header>

      <main>
        <div
          class="game-container"
          tabindex="0"
          autofocus
          {{on "keydown" this.handleKeydown}}
          {{this.setupCanvas}}
        >
          <canvas id="gameCanvas" width="360" height="500"></canvas>

          {{#if this.isStartScreen}}
            <div class="overlay">
              <h2>📦 Cargo Tetris</h2>
              <p>Load the cargo ship!</p>
              <div class="controls-info">
                <p><strong>← →</strong> — Move piece</p>
                <p><strong>↑</strong> — Rotate</p>
                <p><strong>↓</strong> — Soft drop</p>
                <p><strong>Space</strong> — Hard drop</p>
              </div>
              <button
                type="button"
                class="play-btn"
                {{on "click" this.startGame}}
              >▶ Start Loading</button>
            </div>
          {{/if}}

          {{#if this.isGameOver}}
            <div class="overlay">
              <h2>🚢 Ship Overloaded!</h2>
              <p>Final Score: {{this.score}}</p>
              <p>Lines Cleared: {{this.lines}}</p>
              <button
                type="button"
                class="play-btn"
                {{on "click" this.startGame}}
              >🔄 Try Again</button>
            </div>
          {{/if}}

          {{#if this.isPlaying}}
            <CargoTetrisHud
              @score={{this.score}}
              @lines={{this.lines}}
              @level={{this.level}}
            />
          {{/if}}

          <div class="next-piece {{unless this.isPlaying 'hidden'}}">
            <span class="next-label">NEXT</span>
            <canvas id="nextCanvas" width="100" height="80"></canvas>
          </div>
        </div>
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a
            href="https://crunchybananas.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >Cory Loken & Chiron</a>
          using
          <a
            href="https://emberjs.com"
            target="_blank"
            rel="noopener noreferrer"
          >Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
