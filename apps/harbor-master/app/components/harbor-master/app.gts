import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type Owner from "@ember/owner";
import {
  type Point,
  initDocks,
  spawnShip,
  checkCollisions,
  checkDocking,
  drawWater,
  getMousePos,
} from "harbor-master/services/game-engine";
import type { Ship, Dock } from "harbor-master/services/game-engine";

export interface HarborMasterAppSignature {
  Element: HTMLDivElement;
  Args: Record<string, never>;
}

export default class HarborMasterApp extends Component<HarborMasterAppSignature> {
  @tracked gameRunning = false;
  @tracked score = 0;
  @tracked highScore = parseInt(localStorage.getItem("harborHighScore") ?? "0");
  @tracked shipCount = 0;
  @tracked showStartScreen = true;
  @tracked showGameOver = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ships: Ship[] = [];
  private docks: Dock[] = [];
  private difficulty = 1;
  private spawnTimer = 1;
  private selectedShip: Ship | null = null;
  private drawingPath: Point[] = [];
  private lastTime = 0;
  private animationId: number | null = null;

  constructor(owner: Owner, args: HarborMasterAppSignature["Args"]) {
    super(owner, args);
  }

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.ctx = element.getContext("2d");
    this.drawInitialState();

    return () => {
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
      }
    };
  });

  private drawInitialState(): void {
    if (!this.ctx || !this.canvas) return;
    drawWater(this.ctx, this.canvas.width, this.canvas.height);
  }

  startGame = (): void => {
    this.ships = [];
    this.docks = initDocks();
    this.score = 0;
    this.difficulty = 1;
    this.spawnTimer = 1;
    this.shipCount = 0;

    this.showStartScreen = false;
    this.showGameOver = false;
    this.gameRunning = true;
    this.lastTime = performance.now();

    this.gameLoop(this.lastTime);
  };

  private gameLoop = (timestamp: number): void => {
    if (!this.gameRunning || !this.ctx || !this.canvas) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    // Update ships
    this.ships.forEach((ship) =>
      ship.update(dt, this.canvas!.width, this.canvas!.height)
    );
    this.ships = this.ships.filter((ship) => !ship.dead);
    this.shipCount = this.ships.filter((s) => !s.docked).length;

    // Spawn ships
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      spawnShip(
        this.ships,
        this.canvas.width,
        this.canvas.height,
        this.difficulty
      );
      this.spawnTimer = Math.max(2, 5 - this.difficulty * 0.3);
      this.difficulty += 0.1;
      this.shipCount = this.ships.filter((s) => !s.docked).length;
    }

    // Check collisions
    if (checkCollisions(this.ships)) {
      this.endGame();
      return;
    }

    // Check docking
    const dockedCount = checkDocking(this.ships, this.docks);
    if (dockedCount > 0) {
      this.score += dockedCount;
    }

    // Draw
    this.draw();

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  private draw(): void {
    if (!this.ctx || !this.canvas) return;

    drawWater(this.ctx, this.canvas.width, this.canvas.height);
    this.docks.forEach((dock) => dock.draw(this.ctx!));
    this.ships.forEach((ship) => ship.draw(this.ctx!));

    // Draw current path being drawn
    if (this.selectedShip && this.drawingPath.length > 1) {
      this.ctx.strokeStyle = this.selectedShip.color;
      this.ctx.lineWidth = 3;
      this.ctx.globalAlpha = 0.6;
      this.ctx.beginPath();
      this.ctx.moveTo(this.selectedShip.x, this.selectedShip.y);
      this.drawingPath.forEach((p) => this.ctx!.lineTo(p.x, p.y));
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    }
  }

  private endGame(): void {
    this.gameRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("harborHighScore", this.highScore.toString());
    }

    this.showGameOver = true;
  }

  handleMouseDown = (event: MouseEvent): void => {
    if (!this.gameRunning || !this.canvas) return;
    const pos = getMousePos(event, this.canvas);

    // Find ship under cursor
    for (const ship of this.ships) {
      if (!ship.docked && ship.containsPoint(pos.x, pos.y)) {
        this.selectedShip = ship;
        this.drawingPath = [];
        break;
      }
    }
  };

  handleMouseMove = (event: MouseEvent): void => {
    if (!this.gameRunning || !this.selectedShip || !this.canvas) return;
    const pos = getMousePos(event, this.canvas);

    // Add point to path (throttled)
    const last = this.drawingPath[this.drawingPath.length - 1];
    if (!last || Math.abs(pos.x - last.x) > 10 || Math.abs(pos.y - last.y) > 10) {
      this.drawingPath.push(pos);
    }
  };

  handleMouseUp = (): void => {
    if (this.selectedShip && this.drawingPath.length > 0) {
      this.selectedShip.path = [...this.drawingPath];
      this.selectedShip.pathIndex = 0;
    }
    this.selectedShip = null;
    this.drawingPath = [];
  };

  handleMouseLeave = (): void => {
    if (this.selectedShip && this.drawingPath.length > 0) {
      this.selectedShip.path = [...this.drawingPath];
      this.selectedShip.pathIndex = 0;
    }
    this.selectedShip = null;
    this.drawingPath = [];
  };

  <template>
    <div class="container" ...attributes>
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>🚢 Harbor Master</h1>
        <p class="subtitle">Draw paths to guide ships to matching docks. Don't let them collide!</p>
      </header>

      <main>
        <div class="game-container">
          <canvas
            width="600"
            height="500"
            {{this.setupCanvas}}
            {{on "mousedown" this.handleMouseDown}}
            {{on "mousemove" this.handleMouseMove}}
            {{on "mouseup" this.handleMouseUp}}
            {{on "mouseleave" this.handleMouseLeave}}
          ></canvas>

          {{#if this.showStartScreen}}
            <div class="overlay">
              <h2>🚢 Harbor Master</h2>
              <p>Guide incoming ships to their matching colored docks!</p>
              <div class="controls-info">
                <p><strong>Click &amp; Drag</strong> from a ship to draw its path</p>
                <p><strong>Match colors</strong> — Red ships → Red dock</p>
                <p><strong>Avoid collisions</strong> — Game over if ships crash!</p>
              </div>
              <button type="button" class="play-btn" {{on "click" this.startGame}}>▶ Start Game</button>
            </div>
          {{/if}}

          {{#if this.showGameOver}}
            <div class="overlay">
              <h2>💥 Collision!</h2>
              <p>Ships Docked: {{this.score}}</p>
              <p>High Score: {{this.highScore}}</p>
              <button type="button" class="play-btn" {{on "click" this.startGame}}>🔄 Play Again</button>
            </div>
          {{/if}}

          {{#unless (or this.showStartScreen this.showGameOver)}}
            <div class="hud">
              <div class="hud-item">
                <span class="hud-label">Docked</span>
                <span class="hud-value">{{this.score}}</span>
              </div>
              <div class="hud-item">
                <span class="hud-label">Ships</span>
                <span class="hud-value">{{this.shipCount}}</span>
              </div>
            </div>
          {{/unless}}
        </div>
      </main>

      <footer>
        <p>Part of <a href="https://shipyard.bot">Shipyard</a> Microtools</p>
      </footer>
    </div>
  </template>
}

function or(a: boolean, b: boolean): boolean {
  return a || b;
}
