import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import {
  type GameEngine,
  type Terminal,
  type WeaponType,
  createGameEngine,
  WEAPONS,
} from "orbital-strike/services/game-engine";

export default class OrbitalStrikeApp extends Component {
  @tracked gameStarted = false;
  @tracked gameOver = false;
  @tracked wave = 1;
  @tracked score = 0;
  @tracked health = 100;
  @tracked maxHealth = 100;
  @tracked currentWeapon: WeaponType = "pistol";
  @tracked ammo = 50;
  @tracked maxAmmo = 100;
  @tracked enemiesRemaining = 0;
  @tracked terminalOpen: Terminal | null = null;
  @tracked pickupNotification = "";
  @tracked damageFlash = false;
  @tracked radarBlips: Array<{ x: number; y: number }> = [];

  private engine: GameEngine | null = null;
  private animationId: number | null = null;
  private lastTime = 0;
  private pickupTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private canvasElement: HTMLCanvasElement | null = null;

  setupGame = modifier((element: HTMLCanvasElement) => {
    // If engine already exists, just reattach to new canvas
    if (this.engine) {
      this.engine.reattachCanvas(element);
      this.canvasElement = element;
      return () => {};
    }

    this.initialized = true;
    this.canvasElement = element;
    this.engine = createGameEngine();
    this.engine.init(element);

    // Set up callbacks
    this.engine.onStateChange = () => this.syncState();
    this.engine.onPickup = (msg: string) => this.showPickup(msg);
    this.engine.onDamage = () => this.flashDamage();
    this.engine.onTerminalOpen = () => this.syncState();

    // Start game loop
    this.lastTime = performance.now();
    this.gameLoop();

    return () => {
      // Only fully destroy on true component unmount
      if (!document.contains(element)) {
        if (this.animationId !== null) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
        if (this.pickupTimeout) {
          clearTimeout(this.pickupTimeout);
          this.pickupTimeout = null;
        }
        this.engine?.destroy();
        this.engine = null;
        this.initialized = false;
        this.canvasElement = null;
      }
    };
  });

  private gameLoop = (): void => {
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.engine) {
      this.engine.update(delta);
      this.engine.render();

      // Update radar
      if (this.gameStarted && !this.gameOver) {
        this.radarBlips = this.engine.getRadarBlips();
      }
    }

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  private syncState(): void {
    if (!this.engine) return;

    this.gameStarted = this.engine.gameState.started;
    this.gameOver = this.engine.gameState.gameOver;
    this.wave = this.engine.gameState.wave;
    this.score = this.engine.gameState.score;
    this.health = this.engine.player.health;
    this.maxHealth = this.engine.player.maxHealth;
    this.currentWeapon = this.engine.player.currentWeapon;
    this.ammo = this.engine.player.ammo[this.currentWeapon];
    this.maxAmmo = this.engine.player.maxAmmo[this.currentWeapon];
    this.enemiesRemaining = this.engine.gameState.enemiesRemaining;
    this.terminalOpen = this.engine.gameState.terminalOpen;
    this.damageFlash = this.engine.gameState.damageFlash;
  }

  private showPickup(message: string): void {
    this.pickupNotification = message;
    if (this.pickupTimeout) {
      clearTimeout(this.pickupTimeout);
    }
    this.pickupTimeout = setTimeout(() => {
      this.pickupNotification = "";
    }, 2000);
  }

  private flashDamage(): void {
    this.damageFlash = true;
    setTimeout(() => {
      this.damageFlash = false;
    }, 100);
  }

  startGame = (): void => {
    if (this.engine) {
      this.engine.startGame();
      this.syncState();
    }
  };

  closeTerminal = (): void => {
    this.engine?.closeTerminal();
  };

  get weaponName(): string {
    return WEAPONS[this.currentWeapon].name;
  }

  get weaponIcon(): string {
    return WEAPONS[this.currentWeapon].icon;
  }

  get healthPercent(): number {
    return (this.health / this.maxHealth) * 100;
  }

  <template>
    <div class="orbital-strike-container">
      <div class="mobile-notice">
        <div class="mobile-notice-content">
          <div class="mobile-notice-icon">🖥️</div>
          <h2>Desktop Only</h2>
          <p>Orbital Strike requires a keyboard &amp; mouse for FPS controls (pointer lock, WASD movement, mouse aiming).</p>
          <p>Please play on a desktop or laptop computer.</p>
          <a href="../../" class="mobile-notice-btn">← Back to All Tools</a>
        </div>
      </div>
      <canvas class="game-canvas" {{this.setupGame}}></canvas>

      {{#if this.gameStarted}}
        {{#unless this.gameOver}}
          <div class="hud">
            {{! Crosshair }}
            <div class="crosshair">
              <div class="crosshair-dot"></div>
            </div>

            {{! Wave Info }}
            <div class="wave-info">
              <div class="wave-number">WAVE</div>
              <div class="wave-value">{{this.wave}}</div>
              <div class="enemies-remaining">
                {{this.enemiesRemaining}} HOSTILES REMAINING
              </div>
            </div>

            {{! Radar }}
            <div class="radar">
              <div class="radar-sweep"></div>
              <div class="radar-center"></div>
              {{#each this.radarBlips as |blip|}}
                <div
                  class="radar-blip"
                  style="left: {{blip.x}}%; top: {{blip.y}}%;"
                ></div>
              {{/each}}
            </div>

            {{! Health Bar }}
            <div class="health-bar">
              <span class="health-icon">❤️</span>
              <div class="health-track">
                <div
                  class="health-fill"
                  style="width: {{this.healthPercent}}%;"
                ></div>
              </div>
              <span class="health-text">{{this.health}}</span>
            </div>

            {{! Ammo Display }}
            <div class="ammo-display">
              <div class="weapon-name">{{this.weaponName}}</div>
              <div class="ammo-count">{{this.ammo}}</div>
              <div class="ammo-reserve">/ {{this.maxAmmo}}</div>
            </div>

            {{! Weapon Icon }}
            <div class="weapon-icon">{{this.weaponIcon}}</div>

            {{! Pickup Notification }}
            {{#if this.pickupNotification}}
              <div class="pickup-notification">{{this.pickupNotification}}</div>
            {{/if}}

            {{! Damage Flash }}
            <div class="damage-flash {{if this.damageFlash 'active'}}"></div>

            {{! Scanlines }}
            <div class="scanlines"></div>

            {{! Vignette }}
            <div class="vignette"></div>
          </div>

          {{! Terminal Overlay }}
          {{#if this.terminalOpen}}
            <div class="terminal-overlay">
              <div class="terminal-header">
                <span class="terminal-title">TERMINAL ACCESS</span>
                <button
                  class="terminal-close"
                  type="button"
                  {{on "click" this.closeTerminal}}
                >
                  [ESC] CLOSE
                </button>
              </div>
              <div class="terminal-content">
                <div class="terminal-text">{{this.terminalOpen.loreText}}</div>
              </div>
            </div>
          {{/if}}
        {{/unless}}

        {{! Game Over Screen }}
        {{#if this.gameOver}}
          <div class="game-over-screen">
            <div class="game-over-title">MISSION FAILED</div>
            <div class="final-score">
              FINAL SCORE: {{this.score}}<br />
              WAVES SURVIVED: {{this.wave}}
            </div>
            <button
              class="start-button"
              type="button"
              {{on "click" this.startGame}}
            >
              TRY AGAIN
            </button>
          </div>
        {{/if}}
      {{else}}
        {{! Start Screen }}
        <div class="start-screen">
          <div class="game-title">ORBITAL STRIKE</div>
          <div class="game-subtitle">STATION THETA-7</div>
          <button
            class="start-button"
            type="button"
            {{on "click" this.startGame}}
          >
            BEGIN MISSION
          </button>
          <div class="controls-hint">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move<br />
            <kbd>MOUSE</kbd> Aim &nbsp;|&nbsp; <kbd>CLICK</kbd> Shoot<br />
            <kbd>SPACE</kbd> Jump &nbsp;|&nbsp; <kbd>Q</kbd> Switch Weapon<br />
            <kbd>E</kbd> Interact with Terminals
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
