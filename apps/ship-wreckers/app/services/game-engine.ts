import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

// Entity interfaces
export interface Ship {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  health: number;
  maxHealth: number;
  fireRate: number;
  lastFire: number;
  invincible: number;
}

export interface Bullet {
  x: number;
  y: number;
  radius: number;
  speed: number;
  dead: boolean;
}

export interface Rock {
  x: number;
  y: number;
  radius: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  vertices: { x: number; y: number }[];
  dead: boolean;
}

export interface Pirate {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  wobble: number;
  dead: boolean;
  health: number;
}

export interface Crate {
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  dead: boolean;
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

export type GameScreen = "start" | "playing" | "gameOver";

export default class GameEngineService extends Service {
  @tracked score = 0;
  @tracked cargoCollected = 0;
  @tracked health = 100;
  @tracked gameScreen: GameScreen = "start";

  canvasWidth = 600;
  canvasHeight = 500;

  player: Ship | null = null;
  bullets: Bullet[] = [];
  rocks: Rock[] = [];
  pirates: Pirate[] = [];
  crates: Crate[] = [];
  particles: Particle[] = [];

  keys: Record<string, boolean> = {};
  lastTime = 0;
  spawnTimer = 0;
  difficulty = 1;
  animationFrameId: number | null = null;
  ctx: CanvasRenderingContext2D | null = null;

  createShip(): Ship {
    return {
      x: this.canvasWidth / 2,
      y: this.canvasHeight - 80,
      width: 40,
      height: 50,
      speed: 250,
      health: 100,
      maxHealth: 100,
      fireRate: 0.25,
      lastFire: 0,
      invincible: 0,
    };
  }

  createBullet(x: number, y: number): Bullet {
    return {
      x,
      y,
      radius: 4,
      speed: 500,
      dead: false,
    };
  }

  createRock(): Rock {
    const radius = 20 + Math.random() * 25;
    const vertices: { x: number; y: number }[] = [];
    const count = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = radius * (0.7 + Math.random() * 0.3);
      vertices.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    }

    return {
      x: Math.random() * (this.canvasWidth - 60) + 30,
      y: -40,
      radius,
      speed: 80 + Math.random() * 60 * this.difficulty,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 2,
      vertices,
      dead: false,
    };
  }

  createPirate(): Pirate {
    return {
      x: Math.random() * (this.canvasWidth - 80) + 40,
      y: -50,
      width: 35,
      height: 45,
      speed: 60 + Math.random() * 40 * this.difficulty,
      wobble: Math.random() * Math.PI * 2,
      dead: false,
      health: 2,
    };
  }

  createCrate(): Crate {
    return {
      x: Math.random() * (this.canvasWidth - 60) + 30,
      y: -30,
      size: 25,
      speed: 70 + Math.random() * 30,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 1.5,
      dead: false,
    };
  }

  createParticle(x: number, y: number, color: string): Particle {
    const life = 0.5 + Math.random() * 0.5;
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life,
      maxLife: life,
      radius: 3 + Math.random() * 4,
      color,
      dead: false,
    };
  }

  startGame(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
    this.player = this.createShip();
    this.bullets = [];
    this.rocks = [];
    this.pirates = [];
    this.crates = [];
    this.particles = [];
    this.score = 0;
    this.cargoCollected = 0;
    this.difficulty = 1;
    this.spawnTimer = 0;
    this.health = 100;
    this.gameScreen = "playing";
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  stopGame(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  endGame(): void {
    this.stopGame();
    this.gameScreen = "gameOver";
  }

  handleKeyDown(code: string): void {
    this.keys[code] = true;
  }

  handleKeyUp(code: string): void {
    this.keys[code] = false;
  }

  gameLoop = (timestamp: number): void => {
    if (this.gameScreen !== "playing" || !this.ctx || !this.player) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.draw(timestamp / 1000);

    if (this.player.health <= 0) {
      this.endGame();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  update(dt: number): void {
    if (!this.player) return;

    // Update player
    this.updatePlayer(dt);

    // Update bullets
    for (const b of this.bullets) {
      b.y -= b.speed * dt;
      if (b.y < -10) b.dead = true;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Update rocks
    for (const r of this.rocks) {
      r.y += r.speed * dt;
      r.rotation += r.rotSpeed * dt;
      if (r.y > this.canvasHeight + 50) r.dead = true;
    }
    this.rocks = this.rocks.filter((r) => !r.dead);

    // Update pirates
    for (const p of this.pirates) {
      p.y += p.speed * dt;
      p.wobble += dt * 3;
      p.x += Math.sin(p.wobble) * 0.5;
      if (p.y > this.canvasHeight + 50) p.dead = true;
    }
    this.pirates = this.pirates.filter((p) => !p.dead);

    // Update crates
    for (const c of this.crates) {
      c.y += c.speed * dt;
      c.rotation += c.rotSpeed * dt;
      if (c.y > this.canvasHeight + 30) c.dead = true;
    }
    this.crates = this.crates.filter((c) => !c.dead);

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    }
    this.particles = this.particles.filter((p) => !p.dead);

    // Spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.5) {
        this.rocks.push(this.createRock());
      } else if (roll < 0.8) {
        this.pirates.push(this.createPirate());
      } else {
        this.crates.push(this.createCrate());
      }
      this.spawnTimer = 1.5 / this.difficulty;
      this.difficulty += 0.01;
    }

    // Handle collisions
    this.handleCollisions();

    // Score over time
    this.score += dt * 5;
  }

  updatePlayer(dt: number): void {
    if (!this.player) return;

    // Movement
    if (this.keys["ArrowLeft"] || this.keys["KeyA"]) {
      this.player.x -= this.player.speed * dt;
    }
    if (this.keys["ArrowRight"] || this.keys["KeyD"]) {
      this.player.x += this.player.speed * dt;
    }
    if (this.keys["ArrowUp"] || this.keys["KeyW"]) {
      this.player.y -= this.player.speed * dt;
    }
    if (this.keys["ArrowDown"] || this.keys["KeyS"]) {
      this.player.y += this.player.speed * dt;
    }

    // Bounds
    this.player.x = Math.max(
      this.player.width / 2,
      Math.min(this.canvasWidth - this.player.width / 2, this.player.x),
    );
    this.player.y = Math.max(
      this.player.height / 2,
      Math.min(this.canvasHeight - this.player.height / 2, this.player.y),
    );

    // Fire
    this.player.lastFire -= dt;
    if (this.keys["Space"] && this.player.lastFire <= 0) {
      this.bullets.push(
        this.createBullet(
          this.player.x,
          this.player.y - this.player.height / 2,
        ),
      );
      this.player.lastFire = this.player.fireRate;
    }

    // Invincibility timer
    if (this.player.invincible > 0) {
      this.player.invincible -= dt;
    }
  }

  handleCollisions(): void {
    if (!this.player) return;

    // Bullets vs rocks
    for (const b of this.bullets) {
      for (const r of this.rocks) {
        if (this.circleCircle(b.x, b.y, b.radius, r.x, r.y, r.radius)) {
          b.dead = true;
          r.dead = true;
          this.score += 10;
          for (let i = 0; i < 6; i++) {
            this.particles.push(this.createParticle(r.x, r.y, "#718096"));
          }
        }
      }
    }

    // Bullets vs pirates
    for (const b of this.bullets) {
      for (const p of this.pirates) {
        if (
          this.circleRect(
            b.x,
            b.y,
            b.radius,
            p.x - p.width / 2,
            p.y - p.height / 2,
            p.width,
            p.height,
          )
        ) {
          b.dead = true;
          p.health--;
          if (p.health <= 0) {
            p.dead = true;
            this.score += 50;
            for (let i = 0; i < 10; i++) {
              this.particles.push(this.createParticle(p.x, p.y, "#ff4757"));
            }
          }
        }
      }
    }

    // Player vs rocks
    for (const r of this.rocks) {
      if (
        this.circleRect(
          r.x,
          r.y,
          r.radius,
          this.player.x - this.player.width / 2,
          this.player.y - this.player.height / 2,
          this.player.width,
          this.player.height,
        )
      ) {
        r.dead = true;
        this.takeDamage(25);
        for (let i = 0; i < 8; i++) {
          this.particles.push(this.createParticle(r.x, r.y, "#718096"));
        }
      }
    }

    // Player vs pirates
    for (const p of this.pirates) {
      if (
        this.circleRect(
          this.player.x,
          this.player.y,
          this.player.width / 2,
          p.x - p.width / 2,
          p.y - p.height / 2,
          p.width,
          p.height,
        )
      ) {
        p.dead = true;
        this.takeDamage(35);
        for (let i = 0; i < 10; i++) {
          this.particles.push(this.createParticle(p.x, p.y, "#ff4757"));
        }
      }
    }

    // Player vs crates
    for (const c of this.crates) {
      if (
        this.circleRect(
          this.player.x,
          this.player.y,
          this.player.width / 2,
          c.x - c.size / 2,
          c.y - c.size / 2,
          c.size,
          c.size,
        )
      ) {
        c.dead = true;
        this.cargoCollected++;
        this.score += 25;
        for (let i = 0; i < 8; i++) {
          this.particles.push(this.createParticle(c.x, c.y, "#fbbf24"));
        }
      }
    }
  }

  takeDamage(amount: number): void {
    if (!this.player || this.player.invincible > 0) return;
    this.player.health -= amount;
    this.player.invincible = 1;
    this.health = Math.max(0, this.player.health);

    // Damage particles
    for (let i = 0; i < 5; i++) {
      this.particles.push(
        this.createParticle(this.player.x, this.player.y, "#ff6b6b"),
      );
    }
  }

  circleRect(
    cx: number,
    cy: number,
    cr: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ): boolean {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  }

  circleCircle(
    x1: number,
    y1: number,
    r1: number,
    x2: number,
    y2: number,
    r2: number,
  ): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
  }

  draw(time: number): void {
    if (!this.ctx || !this.player) return;

    // Draw water
    this.drawWater(time);

    // Draw entities
    for (const c of this.crates) this.drawCrate(c);
    for (const r of this.rocks) this.drawRock(r);
    for (const p of this.pirates) this.drawPirate(p);
    this.drawPlayer();
    for (const b of this.bullets) this.drawBullet(b);
    for (const p of this.particles) this.drawParticle(p);
  }

  drawWater(time: number): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = "#0d2847";
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Animated waves
    this.ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      this.ctx.beginPath();
      for (let x = 0; x < this.canvasWidth; x += 10) {
        const y = 60 * i + Math.sin((x + time * 50 + i * 50) * 0.02) * 10;
        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }
  }

  drawPlayer(): void {
    if (!this.ctx || !this.player) return;

    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);

    // Flash when invincible
    if (
      this.player.invincible > 0 &&
      Math.floor(this.player.invincible * 10) % 2 === 0
    ) {
      this.ctx.globalAlpha = 0.5;
    }

    // Hull
    this.ctx.fillStyle = "#8b5a2b";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -this.player.height / 2);
    this.ctx.lineTo(this.player.width / 2, this.player.height / 3);
    this.ctx.lineTo(this.player.width / 3, this.player.height / 2);
    this.ctx.lineTo(-this.player.width / 3, this.player.height / 2);
    this.ctx.lineTo(-this.player.width / 2, this.player.height / 3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "#5d3a1a";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Sail
    this.ctx.fillStyle = "#f5f5f5";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -this.player.height / 2 + 5);
    this.ctx.lineTo(15, 5);
    this.ctx.lineTo(-15, 5);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "#ccc";
    this.ctx.stroke();

    // Mast
    this.ctx.strokeStyle = "#5d3a1a";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -this.player.height / 2 + 5);
    this.ctx.lineTo(0, this.player.height / 3);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawBullet(b: Bullet): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = "#fbbf24";
    this.ctx.beginPath();
    this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Trail
    this.ctx.fillStyle = "rgba(251, 191, 36, 0.3)";
    this.ctx.beginPath();
    this.ctx.arc(b.x, b.y + 8, b.radius * 0.7, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawRock(r: Rock): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(r.x, r.y);
    this.ctx.rotate(r.rotation);

    this.ctx.fillStyle = "#4a5568";
    this.ctx.strokeStyle = "#2d3748";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    if (r.vertices.length > 0) {
      this.ctx.moveTo(r.vertices[0]!.x, r.vertices[0]!.y);
      for (const v of r.vertices) {
        this.ctx.lineTo(v.x, v.y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPirate(p: Pirate): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(p.x, p.y);

    // Hull (dark)
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -p.height / 2);
    this.ctx.lineTo(p.width / 2, p.height / 3);
    this.ctx.lineTo(p.width / 3, p.height / 2);
    this.ctx.lineTo(-p.width / 3, p.height / 2);
    this.ctx.lineTo(-p.width / 2, p.height / 3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "#0f0f1a";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Sail (black with skull)
    this.ctx.fillStyle = "#111";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -p.height / 2 + 5);
    this.ctx.lineTo(12, 5);
    this.ctx.lineTo(-12, 5);
    this.ctx.closePath();
    this.ctx.fill();

    // Skull symbol
    this.ctx.fillStyle = "#fff";
    this.ctx.beginPath();
    this.ctx.arc(0, -5, 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawCrate(c: Crate): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(c.x, c.y);
    this.ctx.rotate(c.rotation);

    // Box
    this.ctx.fillStyle = "#c4a35a";
    this.ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
    this.ctx.strokeStyle = "#8b7355";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(-c.size / 2, -c.size / 2, c.size, c.size);

    // Straps
    this.ctx.strokeStyle = "#5d4e37";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(-c.size / 2, 0);
    this.ctx.lineTo(c.size / 2, 0);
    this.ctx.moveTo(0, -c.size / 2);
    this.ctx.lineTo(0, c.size / 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawParticle(p: Particle): void {
    if (!this.ctx) return;

    const alpha = p.life / p.maxLife;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = p.color;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }

  willDestroy(): void {
    super.willDestroy();
    this.stopGame();
  }
}

declare module "@ember/service" {
  interface Registry {
    "game-engine": GameEngineService;
  }
}
