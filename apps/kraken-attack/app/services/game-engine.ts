import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface Player {
  angle: number;
  radius: number;
  speed: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  fireRate: number;
  lastFire: number;
  invincible: number;
  x: number;
  y: number;
}

export interface Bullet {
  x: number;
  y: number;
  angle: number;
  speed: number;
  radius: number;
  dead: boolean;
}

export interface Kraken {
  x: number;
  y: number;
  bodyRadius: number;
  health: number;
  maxHealth: number;
  phase: number;
  eyeVulnerable: boolean;
  eyeTimer: number;
  attackTimer: number;
  tentacleCount: number;
  rotation: number;
}

export interface Tentacle {
  angle: number;
  progress: number;
  speed: number;
  maxLength: number;
  width: number;
  dead: boolean;
  warned: boolean;
  warningTime: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  dead: boolean;
}

export default class GameEngineService extends Service {
  @tracked score = 0;
  @tracked gameRunning = false;
  @tracked gameState: "start" | "playing" | "victory" | "defeat" = "start";

  canvasWidth = 600;
  canvasHeight = 500;

  get CX(): number {
    return this.canvasWidth / 2;
  }
  get CY(): number {
    return this.canvasHeight / 2;
  }

  player: Player | null = null;
  kraken: Kraken | null = null;
  bullets: Bullet[] = [];
  tentacles: Tentacle[] = [];
  particles: Particle[] = [];
  keys: Record<string, boolean> = {};

  createPlayer(): Player {
    return {
      angle: -Math.PI / 2,
      radius: 180,
      speed: 2.5,
      width: 30,
      height: 40,
      health: 100,
      maxHealth: 100,
      fireRate: 0.3,
      lastFire: 0,
      invincible: 0,
      get x() {
        return 300 + Math.cos(this.angle) * this.radius;
      },
      get y() {
        return 250 + Math.sin(this.angle) * this.radius;
      },
    };
  }

  createKraken(): Kraken {
    return {
      x: this.CX,
      y: this.CY,
      bodyRadius: 60,
      health: 500,
      maxHealth: 500,
      phase: 1,
      eyeVulnerable: false,
      eyeTimer: 0,
      attackTimer: 2,
      tentacleCount: 6,
      rotation: 0,
    };
  }

  createBullet(x: number, y: number, angle: number): Bullet {
    return {
      x,
      y,
      angle,
      speed: 350,
      radius: 5,
      dead: false,
    };
  }

  createTentacle(angle: number): Tentacle {
    return {
      angle,
      progress: 0,
      speed: 1.5,
      maxLength: 200,
      width: 25,
      dead: false,
      warned: false,
      warningTime: 0.8,
    };
  }

  createParticle(x: number, y: number, color: string): Particle {
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.5 + Math.random() * 0.3,
      radius: 3 + Math.random() * 4,
      color,
      dead: false,
    };
  }

  startGame(): void {
    this.player = this.createPlayer();
    this.kraken = this.createKraken();
    this.bullets = [];
    this.tentacles = [];
    this.particles = [];
    this.score = 0;
    this.gameRunning = true;
    this.gameState = "playing";
  }

  stopGame(): void {
    this.gameRunning = false;
  }

  victory(): void {
    this.gameRunning = false;
    this.score += 1000;
    this.gameState = "victory";
  }

  defeat(): void {
    this.gameRunning = false;
    this.gameState = "defeat";
  }

  handleKeyDown(code: string): void {
    this.keys[code] = true;
  }

  handleKeyUp(code: string): void {
    this.keys[code] = false;
  }

  getPlayerX(): number {
    if (!this.player) return this.CX;
    return this.CX + Math.cos(this.player.angle) * this.player.radius;
  }

  getPlayerY(): number {
    if (!this.player) return this.CY;
    return this.CY + Math.sin(this.player.angle) * this.player.radius;
  }

  updatePlayer(dt: number): void {
    if (!this.player) return;

    if (this.keys["ArrowLeft"] || this.keys["KeyA"]) {
      this.player.angle -= this.player.speed * dt;
    }
    if (this.keys["ArrowRight"] || this.keys["KeyD"]) {
      this.player.angle += this.player.speed * dt;
    }

    this.player.lastFire -= dt;
    if (this.keys["Space"] && this.player.lastFire <= 0) {
      const fireAngle = this.player.angle + Math.PI;
      this.bullets.push(
        this.createBullet(this.getPlayerX(), this.getPlayerY(), fireAngle),
      );
      this.player.lastFire = this.player.fireRate;
    }

    if (this.player.invincible > 0) {
      this.player.invincible -= dt;
    }
  }

  updateKraken(dt: number): void {
    if (!this.kraken) return;

    this.kraken.rotation += dt * 0.3;

    // Eye vulnerability cycle
    this.kraken.eyeTimer -= dt;
    if (this.kraken.eyeTimer <= 0) {
      this.kraken.eyeVulnerable = !this.kraken.eyeVulnerable;
      this.kraken.eyeTimer = this.kraken.eyeVulnerable ? 2 : 4;
    }

    // Attack patterns based on phase
    this.kraken.attackTimer -= dt;
    if (this.kraken.attackTimer <= 0) {
      this.attack();
      this.kraken.attackTimer = Math.max(1, 3 - this.kraken.phase * 0.5);
    }

    // Update phase based on health
    if (this.kraken.health < this.kraken.maxHealth * 0.3) {
      this.kraken.phase = 3;
    } else if (this.kraken.health < this.kraken.maxHealth * 0.6) {
      this.kraken.phase = 2;
    }
  }

  attack(): void {
    if (!this.kraken) return;

    const count = this.kraken.phase + 1;
    for (let i = 0; i < count; i++) {
      const angle = ((Math.PI * 2) / count) * i + Math.random() * 0.5;
      this.tentacles.push(this.createTentacle(angle));
    }
  }

  updateBullets(dt: number): void {
    if (!this.kraken) return;

    for (const bullet of this.bullets) {
      bullet.x += Math.cos(bullet.angle) * bullet.speed * dt;
      bullet.y += Math.sin(bullet.angle) * bullet.speed * dt;

      // Check if hit kraken body
      const dx = bullet.x - this.CX;
      const dy = bullet.y - this.CY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.kraken.bodyRadius) {
        bullet.dead = true;
        if (this.kraken.eyeVulnerable) {
          this.krakenTakeDamage(10);
          this.score += 100;
        } else {
          this.score += 5;
          for (let i = 0; i < 3; i++) {
            this.particles.push(
              this.createParticle(bullet.x, bullet.y, "#7c3aed"),
            );
          }
        }
      }

      // Off screen
      if (
        bullet.x < 0 ||
        bullet.x > this.canvasWidth ||
        bullet.y < 0 ||
        bullet.y > this.canvasHeight
      ) {
        bullet.dead = true;
      }
    }

    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  krakenTakeDamage(amount: number): void {
    if (!this.kraken) return;
    this.kraken.health -= amount;
    for (let i = 0; i < 8; i++) {
      this.particles.push(this.createParticle(this.CX, this.CY, "#a78bfa"));
    }
  }

  playerTakeDamage(amount: number): void {
    if (!this.player || this.player.invincible > 0) return;
    this.player.health -= amount;
    this.player.invincible = 1;

    for (let i = 0; i < 5; i++) {
      this.particles.push(
        this.createParticle(this.getPlayerX(), this.getPlayerY(), "#ff6b6b"),
      );
    }
  }

  updateTentacles(dt: number): void {
    if (!this.player) return;

    for (const tentacle of this.tentacles) {
      if (!tentacle.warned) {
        tentacle.warningTime -= dt;
        if (tentacle.warningTime <= 0) {
          tentacle.warned = true;
        }
        continue;
      }

      tentacle.progress += tentacle.speed * dt;

      if (tentacle.progress >= 1) {
        // Check collision with player
        const playerAngle = Math.atan2(
          this.getPlayerY() - this.CY,
          this.getPlayerX() - this.CX,
        );
        const angleDiff = Math.abs(playerAngle - tentacle.angle);
        const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

        if (
          normalizedDiff < 0.3 &&
          this.player.radius < tentacle.maxLength + 30
        ) {
          this.playerTakeDamage(20);
        }
      }

      if (tentacle.progress >= 1.5) {
        tentacle.dead = true;
      }
    }

    this.tentacles = this.tentacles.filter((t) => !t.dead);
  }

  updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.dead = true;
      }
    }

    this.particles = this.particles.filter((p) => !p.dead);
  }

  update(dt: number): void {
    if (!this.gameRunning) return;

    this.updatePlayer(dt);
    this.updateKraken(dt);
    this.updateBullets(dt);
    this.updateTentacles(dt);
    this.updateParticles(dt);

    // Check win/lose
    if (this.kraken && this.kraken.health <= 0) {
      this.victory();
    }
    if (this.player && this.player.health <= 0) {
      this.defeat();
    }
  }

  getPlayerHealthPercent(): number {
    if (!this.player) return 100;
    return Math.max(0, (this.player.health / this.player.maxHealth) * 100);
  }

  getBossHealthPercent(): number {
    if (!this.kraken) return 100;
    return Math.max(0, (this.kraken.health / this.kraken.maxHealth) * 100);
  }
}

declare module "@ember/service" {
  interface Registry {
    "game-engine": GameEngineService;
  }
}
