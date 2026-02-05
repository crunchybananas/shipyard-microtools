import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import { service } from "@ember/service";
import type GameEngineService from "kraken-attack/services/game-engine";

export default class KrakenAttackApp extends Component {
  @service declare gameEngine: GameEngineService;

  @tracked canvasElement: HTMLCanvasElement | null = null;
  @tracked animationId: number | null = null;
  @tracked lastTime = 0;

  setupCanvas = modifier((element: HTMLElement) => {
    const canvas = element as HTMLCanvasElement;
    this.canvasElement = canvas;
    this.drawBackground();
    canvas.focus();
  });

  get isStartScreen(): boolean {
    return this.gameEngine.gameState === "start";
  }

  get isPlaying(): boolean {
    return this.gameEngine.gameState === "playing";
  }

  get isVictory(): boolean {
    return this.gameEngine.gameState === "victory";
  }

  get isDefeat(): boolean {
    return this.gameEngine.gameState === "defeat";
  }

  get score(): number {
    return this.gameEngine.score;
  }

  get playerHealthPercent(): number {
    return this.gameEngine.getPlayerHealthPercent();
  }

  get bossHealthPercent(): number {
    return this.gameEngine.getBossHealthPercent();
  }

  startGame = (): void => {
    this.gameEngine.startGame();
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
    // Ensure canvas has focus for keyboard input
    this.canvasElement?.focus();
  };

  gameLoop = (timestamp: number): void => {
    if (!this.gameEngine.gameRunning) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.gameEngine.update(dt);
    this.draw();

    if (this.gameEngine.gameRunning) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };

  handleKeydown = (event: KeyboardEvent): void => {
    this.gameEngine.handleKeyDown(event.code);
    if (["Space", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
  };

  handleKeyup = (event: KeyboardEvent): void => {
    this.gameEngine.handleKeyUp(event.code);
  };

  drawBackground(): void {
    if (!this.canvasElement) return;
    const ctx = this.canvasElement.getContext("2d");
    if (!ctx) return;

    const CX = this.gameEngine.CX;
    const CY = this.gameEngine.CY;

    // Deep ocean
    const gradient = ctx.createRadialGradient(CX, CY, 0, CX, CY, 400);
    gradient.addColorStop(0, "#1a0a2e");
    gradient.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Murky particles
    ctx.fillStyle = "rgba(124, 58, 237, 0.05)";
    const time = Date.now() / 1000;
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(time * 0.5 + i) * 0.5 + 0.5) * this.canvasElement.width;
      const y =
        (Math.cos(time * 0.3 + i * 1.5) * 0.5 + 0.5) * this.canvasElement.height;
      ctx.beginPath();
      ctx.arc(x, y, 20 + Math.sin(time + i) * 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Battle arena circle
    if (this.gameEngine.player) {
      ctx.strokeStyle = "rgba(124, 58, 237, 0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(CX, CY, this.gameEngine.player.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawPlayer(ctx: CanvasRenderingContext2D): void {
    const player = this.gameEngine.player;
    if (!player) return;

    const x = this.gameEngine.getPlayerX();
    const y = this.gameEngine.getPlayerY();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.angle + Math.PI / 2 + Math.PI);

    if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Hull
    ctx.fillStyle = "#8b5a2b";
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(player.width / 2, player.height / 3);
    ctx.lineTo(player.width / 3, player.height / 2);
    ctx.lineTo(-player.width / 3, player.height / 2);
    ctx.lineTo(-player.width / 2, player.height / 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#5d3a1a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sail
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2 + 5);
    ctx.lineTo(12, 5);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawKraken(ctx: CanvasRenderingContext2D): void {
    const kraken = this.gameEngine.kraken;
    if (!kraken) return;

    const CX = this.gameEngine.CX;
    const CY = this.gameEngine.CY;

    ctx.save();
    ctx.translate(CX, CY);

    // Body
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, kraken.bodyRadius);
    gradient.addColorStop(0, "#5b21b6");
    gradient.addColorStop(1, "#3b0764");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, kraken.bodyRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tentacle bases
    ctx.fillStyle = "#4c1d95";
    for (let i = 0; i < kraken.tentacleCount; i++) {
      const angle = ((Math.PI * 2) / kraken.tentacleCount) * i + kraken.rotation;
      const bx = Math.cos(angle) * kraken.bodyRadius * 0.8;
      const by = Math.sin(angle) * kraken.bodyRadius * 0.8;
      ctx.beginPath();
      ctx.arc(bx, by, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eye
    if (kraken.eyeVulnerable) {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 20;
    }

    ctx.fillStyle = kraken.eyeVulnerable ? "#ef4444" : "#1e1b4b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawBullets(ctx: CanvasRenderingContext2D): void {
    for (const bullet of this.gameEngine.bullets) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      ctx.fillStyle = "rgba(251, 191, 36, 0.3)";
      ctx.beginPath();
      ctx.arc(
        bullet.x - Math.cos(bullet.angle) * 10,
        bullet.y - Math.sin(bullet.angle) * 10,
        bullet.radius * 0.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  drawTentacles(ctx: CanvasRenderingContext2D): void {
    const CX = this.gameEngine.CX;
    const CY = this.gameEngine.CY;

    for (const tentacle of this.gameEngine.tentacles) {
      const length = tentacle.warned
        ? Math.min(tentacle.progress, 1) * tentacle.maxLength
        : 0;

      // Warning indicator
      if (!tentacle.warned) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${1 - tentacle.warningTime})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(
          CX + Math.cos(tentacle.angle) * 250,
          CY + Math.sin(tentacle.angle) * 250,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      // Tentacle
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(tentacle.angle);

      const gradient = ctx.createLinearGradient(60, 0, 60 + length, 0);
      gradient.addColorStop(0, "#5b21b6");
      gradient.addColorStop(1, "#7c3aed");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(60, -tentacle.width / 2);
      ctx.lineTo(60 + length, -tentacle.width / 4);
      ctx.lineTo(60 + length + 20, 0);
      ctx.lineTo(60 + length, tentacle.width / 4);
      ctx.lineTo(60, tentacle.width / 2);
      ctx.closePath();
      ctx.fill();

      // Suckers
      ctx.fillStyle = "#a78bfa";
      for (let i = 0; i < 4; i++) {
        const sx = 70 + (length / 4) * i;
        if (sx < 60 + length) {
          ctx.beginPath();
          ctx.arc(sx, 0, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.gameEngine.particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  draw(): void {
    if (!this.canvasElement) return;
    const ctx = this.canvasElement.getContext("2d");
    if (!ctx) return;

    this.drawBackground();
    this.drawTentacles(ctx);
    this.drawKraken(ctx);
    this.drawPlayer(ctx);
    this.drawBullets(ctx);
    this.drawParticles(ctx);
  }

  <template>
    <div class="container" ...attributes>
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>🦑 Kraken Attack</h1>
        <p class="subtitle">Circle the beast. Dodge tentacles. Aim for the eyes!</p>
      </header>

      <main>
        <div class="game-container">
          <canvas
            width="600"
            height="500"
            tabindex="0"
            autofocus
            {{on "keydown" this.handleKeydown}}
            {{on "keyup" this.handleKeyup}}
            {{this.setupCanvas}}
          ></canvas>

          {{#if this.isStartScreen}}
            <div class="overlay">
              <h2>🦑 Kraken Attack</h2>
              <p>The legendary Kraken rises from the depths!</p>
              <div class="controls-info">
                <p><strong>← →</strong> or <strong>A D</strong> — Circle around</p>
                <p><strong>Space</strong> — Fire cannons</p>
                <p><strong>Aim for the eyes</strong> when they glow!</p>
              </div>
              <button type="button" class="play-btn" {{on "click" this.startGame}}>
                ⚔️ Battle!
              </button>
            </div>
          {{/if}}

          {{#if this.isVictory}}
            <div class="overlay">
              <h2>🏆 Victory!</h2>
              <p>You defeated the Kraken!</p>
              <p>Final Score: {{this.score}}</p>
              <button type="button" class="play-btn" {{on "click" this.startGame}}>
                🦑 Fight Again
              </button>
            </div>
          {{/if}}

          {{#if this.isDefeat}}
            <div class="overlay">
              <h2>💀 Defeated!</h2>
              <p>The Kraken drags you to the depths...</p>
              <p>Score: {{this.score}}</p>
              <button type="button" class="play-btn" {{on "click" this.startGame}}>
                🔄 Try Again
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
                <span class="hud-label">Kraken</span>
                <div class="boss-bar">
                  <div
                    class="boss-fill"
                    style="width: {{this.bossHealthPercent}}%"
                  ></div>
                </div>
              </div>
              <div class="hud-item">
                <span class="hud-label">Ship</span>
                <div class="health-bar">
                  <div
                    class="health-fill"
                    style="width: {{this.playerHealthPercent}}%"
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
