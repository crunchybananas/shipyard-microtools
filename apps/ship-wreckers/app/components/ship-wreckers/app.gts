import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import { service } from "@ember/service";
import type GameEngineService from "ship-wreckers/services/game-engine";

export default class ShipWreckersApp extends Component {
  @service declare gameEngine: GameEngineService;
  canvasElement: HTMLCanvasElement | null = null;

  setupCanvas = modifier((element: HTMLElement) => {
    const canvas = element.querySelector("#gameCanvas") as HTMLCanvasElement | null;
    if (canvas) {
      this.canvasElement = canvas;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        this.drawInitialWater(ctx);
      }
    }

    // Setup keyboard listeners
    const handleKeyDown = (e: KeyboardEvent): void => {
      this.gameEngine.handleKeyDown(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      this.gameEngine.handleKeyUp(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      this.gameEngine.stopGame();
    };
  });

  drawInitialWater(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#0d2847";
    ctx.fillRect(0, 0, 600, 500);

    ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      for (let x = 0; x < 600; x += 10) {
        const y = 60 * i + Math.sin((x + i * 50) * 0.02) * 10;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  startGame = (): void => {
    if (!this.canvasElement) return;
    const ctx = this.canvasElement.getContext("2d");
    if (ctx) {
      this.gameEngine.startGame(ctx);
    }
  };

  get score(): number {
    return Math.floor(this.gameEngine.score);
  }

  get cargoCollected(): number {
    return this.gameEngine.cargoCollected;
  }

  get health(): number {
    return this.gameEngine.health;
  }

  get isStartScreen(): boolean {
    return this.gameEngine.gameScreen === "start";
  }

  get isPlaying(): boolean {
    return this.gameEngine.gameScreen === "playing";
  }

  get isGameOver(): boolean {
    return this.gameEngine.gameScreen === "gameOver";
  }

  <template>
    <div class="container" ...attributes>
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>⛵ Ship Wreckers</h1>
        <p class="subtitle">
          Dodge rocks, blast pirates, collect cargo. How long can you survive?
        </p>
      </header>

      <main>
        <div
          class="game-container"
          tabindex="0"
          autofocus
          {{this.setupCanvas}}
        >
          <canvas id="gameCanvas" width="600" height="500"></canvas>

          {{#if this.isStartScreen}}
            <div class="overlay">
              <h2>⛵ Ship Wreckers</h2>
              <p>Navigate the treacherous waters!</p>
              <div class="controls-info">
                <p><strong>WASD</strong> or <strong>Arrow Keys</strong> — Move</p>
                <p><strong>Space</strong> — Fire cannons</p>
              </div>
              <button
                type="button"
                class="play-btn"
                {{on "click" this.startGame}}
              >
                ▶ Start Game
              </button>
            </div>
          {{/if}}

          {{#if this.isGameOver}}
            <div class="overlay">
              <h2>💀 Ship Wrecked!</h2>
              <p>Final Score: {{this.score}}</p>
              <p>Cargo Collected: {{this.cargoCollected}}</p>
              <button
                type="button"
                class="play-btn"
                {{on "click" this.startGame}}
              >
                🔄 Play Again
              </button>
            </div>
          {{/if}}

          {{#if this.isPlaying}}
            <div class="hud">
              <div class="hud-item">
                <span class="hud-label">Score</span>
                <span class="hud-value">{{this.score}}</span>
              </div>
              <div class="hud-item">
                <span class="hud-label">Cargo</span>
                <span class="hud-value">{{this.cargoCollected}}</span>
              </div>
              <div class="hud-item">
                <span class="hud-label">Health</span>
                <div class="health-bar">
                  <div
                    class="health-fill"
                    style="width: {{this.health}}%"
                  ></div>
                </div>
              </div>
            </div>
          {{/if}}
        </div>
      </main>

      <footer>
        <p>Part of <a href="https://shipyard.bot">Shipyard</a> Microtools</p>
      </footer>
    </div>
  </template>
}
