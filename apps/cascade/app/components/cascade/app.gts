import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { modifier } from "ember-modifier";
import { on } from "@ember/modifier";
import { CascadeEngine } from "cascade/cascade/init";

const KEY_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

export default class CascadeApp extends Component {
  // ── Tracked state ────────────────────────────────────────────

  @tracked score = 0;
  @tracked best = parseInt(localStorage.getItem("cascade-best") || "0");
  @tracked message = "";
  @tracked messageVisible = false;

  engine: CascadeEngine | null = null;

  // Input state (not tracked — no template dependency)
  private touchStartX = 0;
  private touchStartY = 0;
  private mouseDown = false;
  private touchPainting = false;
  private prevMX = 0;
  private prevMY = 0;

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

  // Document-level keyboard modifier (attach/teardown lifecycle)
  setupKeyboard = modifier((element: Element) => {
    const handler = this.onKeyDown;
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  // ── Event handlers (fat arrows) ──────────────────────────────

  newGame = () => {
    this.engine?.startGame();
  };

  onKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      this.engine?.move(dir);
    }
  };

  onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]!;
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    // Start paint tracking for canvas fluid
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    this.prevMX = (t.clientX - rect.left) / canvas.clientWidth;
    this.prevMY = 1 - (t.clientY - rect.top) / canvas.clientHeight;
    this.touchPainting = false;
  };

  onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0]!;
    const dx = Math.abs(t.clientX - this.touchStartX);
    const dy = Math.abs(t.clientY - this.touchStartY);
    // After moving enough, treat as paint rather than swipe
    if (dx > 15 || dy > 15) {
      this.touchPainting = true;
      e.preventDefault();
      const canvas = e.currentTarget as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const mx = (t.clientX - rect.left) / canvas.clientWidth;
      const my = 1 - (t.clientY - rect.top) / canvas.clientHeight;
      const ddx = mx - this.prevMX;
      const ddy = my - this.prevMY;
      if (Math.abs(ddx) > 0 || Math.abs(ddy) > 0) {
        this.engine?.paint(mx, my, ddx, ddy);
      }
      this.prevMX = mx;
      this.prevMY = my;
    }
  };

  onTouchEnd = (e: TouchEvent) => {
    if (this.touchPainting) {
      this.touchPainting = false;
      return;
    }
    const t = e.changedTouches[0]!;
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 30) return;
    e.preventDefault();

    if (absDx > absDy) {
      this.engine?.move(dx > 0 ? "right" : "left");
    } else {
      this.engine?.move(dy > 0 ? "down" : "up");
    }
  };

  onMouseDown = (e: MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    this.mouseDown = true;
    this.prevMX = e.offsetX / canvas.clientWidth;
    this.prevMY = 1 - e.offsetY / canvas.clientHeight;
  };

  onMouseMove = (e: MouseEvent) => {
    if (!this.mouseDown) return;
    const canvas = e.currentTarget as HTMLCanvasElement;
    const mx = e.offsetX / canvas.clientWidth;
    const my = 1 - e.offsetY / canvas.clientHeight;
    const dx = mx - this.prevMX;
    const dy = my - this.prevMY;
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      this.engine?.paint(mx, my, dx, dy);
    }
    this.prevMX = mx;
    this.prevMY = my;
  };

  onMouseUp = () => {
    this.mouseDown = false;
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="cascade-root" {{this.setupKeyboard}}>
      <canvas
        id="cascade-canvas"
        {{this.setupCanvas}}
        {{on "touchstart" this.onTouchStart}}
        {{on "touchmove" this.onTouchMove}}
        {{on "touchend" this.onTouchEnd}}
        {{on "mousedown" this.onMouseDown}}
        {{on "mousemove" this.onMouseMove}}
        {{on "mouseup" this.onMouseUp}}
      ></canvas>

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
