// Kraken Attack - Boss battle game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Logical game size comes from the canvas attributes; scale the backing
// store by devicePixelRatio so rendering stays crisp on high-DPI displays.
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const dpr = window.devicePixelRatio || 1;
canvas.width = WIDTH * dpr;
canvas.height = HEIGHT * dpr;
canvas.style.width = `${WIDTH}px`;
canvas.style.height = `${HEIGHT}px`;
ctx.scale(dpr, dpr);

const startScreen = document.getElementById('startScreen');
const victoryScreen = document.getElementById('victoryScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('startBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const restartBtn = document.getElementById('restartBtn');

const scoreEl = document.getElementById('score');
const bossFill = document.getElementById('bossFill');
const healthFill = document.getElementById('healthFill');
const finalScoreEl = document.getElementById('finalScore');
const victoryScoreEl = document.getElementById('victoryScore');

const CX = WIDTH / 2;
const CY = HEIGHT / 2;

const PLAYER_ORBIT = 180; // Player's distance from the kraken (arena radius)

let gameRunning = false;
let score = 0;
let player, kraken, bullets, tentacles, particles;
let keys = {};
let lastTime = 0;

class Player {
  constructor() {
    this.angle = -Math.PI / 2; // Start at top
    this.radius = PLAYER_ORBIT; // Distance from center
    this.speed = 2.5;
    this.width = 30;
    this.height = 40;
    this.health = 100;
    this.maxHealth = 100;
    this.fireRate = 0.3;
    this.lastFire = 0;
    this.invincible = 0;
  }

  get x() { return CX + Math.cos(this.angle) * this.radius; }
  get y() { return CY + Math.sin(this.angle) * this.radius; }

  update(dt) {
    if (keys['ArrowLeft'] || keys['KeyA']) this.angle -= this.speed * dt;
    if (keys['ArrowRight'] || keys['KeyD']) this.angle += this.speed * dt;

    this.lastFire -= dt;
    if (keys['Space'] && this.lastFire <= 0) {
      // Fire toward center (kraken)
      const fireAngle = this.angle + Math.PI;
      bullets.push(new Bullet(this.x, this.y, fireAngle));
      this.lastFire = this.fireRate;
    }

    if (this.invincible > 0) this.invincible -= dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2 + Math.PI);

    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Hull
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.lineTo(this.width / 2, this.height / 3);
    ctx.lineTo(this.width / 3, this.height / 2);
    ctx.lineTo(-this.width / 3, this.height / 2);
    ctx.lineTo(-this.width / 2, this.height / 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sail
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2 + 5);
    ctx.lineTo(12, 5);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.health -= amount;
    this.invincible = 1;
    healthFill.style.width = `${Math.max(0, this.health)}%`;
    
    for (let i = 0; i < 5; i++) {
      particles.push(new Particle(this.x, this.y, '#ff6b6b'));
    }
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 350;
    this.radius = 5;
    this.dead = false;
    this.grazedBody = false;
  }

  update(dt) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Check if hit kraken
    const dx = this.x - CX;
    const dy = this.y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < kraken.bodyRadius) {
      if (kraken.hitsEye(this.x, this.y)) {
        // Struck the eye itself
        this.dead = true;
        if (kraken.eyeVulnerable) {
          // Direct hit on the glowing eye — bonus damage
          kraken.takeDamage(20);
          score += 200;
          for (let i = 0; i < 6; i++) {
            particles.push(new Particle(this.x, this.y, '#fbbf24'));
          }
        } else {
          // Closed eye is armored
          score += 5;
          for (let i = 0; i < 3; i++) {
            particles.push(new Particle(this.x, this.y, '#7c3aed'));
          }
        }
      } else if (!this.grazedBody) {
        this.grazedBody = true;
        if (kraken.eyeVulnerable) {
          // Soft mantle while the eye glows — base damage, punch through toward the eye
          kraken.takeDamage(10);
          score += 100;
        } else {
          // Armored hide deflects the shot
          this.dead = true;
          score += 5;
          for (let i = 0; i < 3; i++) {
            particles.push(new Particle(this.x, this.y, '#7c3aed'));
          }
        }
      }
    }

    // Off screen
    if (this.x < 0 || this.x > WIDTH || this.y < 0 || this.y > HEIGHT) {
      this.dead = true;
    }
  }

  draw() {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Trail
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.beginPath();
    ctx.arc(
      this.x - Math.cos(this.angle) * 10,
      this.y - Math.sin(this.angle) * 10,
      this.radius * 0.6, 0, Math.PI * 2
    );
    ctx.fill();
  }
}

class Kraken {
  constructor() {
    this.x = CX;
    this.y = CY;
    this.bodyRadius = 60;
    this.eyeRx = 25;
    this.eyeRy = 35;
    this.health = 500;
    this.maxHealth = 500;
    this.phase = 1;
    this.eyeVulnerable = false;
    this.eyeTimer = 0;
    this.attackTimer = 2;
    this.tentacleCount = 6;
    this.rotation = 0;
  }

  update(dt) {
    this.rotation += dt * 0.3;
    
    // Eye vulnerability cycle
    this.eyeTimer -= dt;
    if (this.eyeTimer <= 0) {
      this.eyeVulnerable = !this.eyeVulnerable;
      this.eyeTimer = this.eyeVulnerable ? 2 : 4;
    }

    // Attack patterns based on phase
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attack();
      this.attackTimer = Math.max(1, 3 - this.phase * 0.5);
    }

    // Update phase based on health
    if (this.health < this.maxHealth * 0.3) this.phase = 3;
    else if (this.health < this.maxHealth * 0.6) this.phase = 2;
  }

  hitsEye(x, y) {
    // Point-in-ellipse test against the drawn eye
    const dx = x - this.x;
    const dy = y - this.y;
    return (dx * dx) / (this.eyeRx * this.eyeRx) + (dy * dy) / (this.eyeRy * this.eyeRy) <= 1;
  }

  attack() {
    // Spawn tentacle slams
    const count = this.phase + 1;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      tentacles.push(new Tentacle(angle));
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    bossFill.style.width = `${Math.max(0, (this.health / this.maxHealth) * 100)}%`;
    
    for (let i = 0; i < 8; i++) {
      particles.push(new Particle(CX, CY, '#a78bfa'));
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Body
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.bodyRadius);
    gradient.addColorStop(0, '#5b21b6');
    gradient.addColorStop(1, '#3b0764');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.bodyRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tentacle bases
    ctx.fillStyle = '#4c1d95';
    for (let i = 0; i < this.tentacleCount; i++) {
      const angle = (Math.PI * 2 / this.tentacleCount) * i + this.rotation;
      const x = Math.cos(angle) * this.bodyRadius * 0.8;
      const y = Math.sin(angle) * this.bodyRadius * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eye
    const eyeColor = this.eyeVulnerable ? '#ef4444' : '#1e1b4b';
    const eyeGlow = this.eyeVulnerable ? 'rgba(239, 68, 68, 0.5)' : 'transparent';
    
    if (this.eyeVulnerable) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
    }
    
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.eyeRx, this.eyeRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

class Tentacle {
  constructor(angle) {
    this.angle = angle;
    this.progress = 0;
    this.speed = 1.5;
    this.maxLength = 200;
    this.width = 25;
    this.dead = false;
    this.warned = false;
    this.warningTime = 0.8;
  }

  update(dt) {
    if (!this.warned) {
      this.warningTime -= dt;
      if (this.warningTime <= 0) this.warned = true;
      return;
    }

    this.progress += this.speed * dt;
    
    if (this.progress >= 1) {
      // Check collision with player
      const tipX = CX + Math.cos(this.angle) * (this.maxLength + 60);
      const tipY = CY + Math.sin(this.angle) * (this.maxLength + 60);
      
      const dx = player.x - tipX;
      const dy = player.y - tipY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Also check along the tentacle
      const playerAngle = Math.atan2(player.y - CY, player.x - CX);
      const angleDiff = Math.abs(playerAngle - this.angle);
      const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      
      if (normalizedDiff < 0.3 && player.radius < this.maxLength + 30) {
        player.takeDamage(20);
      }
    }

    if (this.progress >= 1.5) {
      this.dead = true;
    }
  }

  draw() {
    const length = this.warned ? Math.min(this.progress, 1) * this.maxLength : 0;
    
    // Warning indicator
    if (!this.warned) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${1 - this.warningTime})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(
        CX + Math.cos(this.angle) * 250,
        CY + Math.sin(this.angle) * 250
      );
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // Tentacle
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(this.angle);

    const gradient = ctx.createLinearGradient(60, 0, 60 + length, 0);
    gradient.addColorStop(0, '#5b21b6');
    gradient.addColorStop(1, '#7c3aed');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(60, -this.width / 2);
    ctx.lineTo(60 + length, -this.width / 4);
    ctx.lineTo(60 + length + 20, 0);
    ctx.lineTo(60 + length, this.width / 4);
    ctx.lineTo(60, this.width / 2);
    ctx.closePath();
    ctx.fill();

    // Suckers
    ctx.fillStyle = '#a78bfa';
    for (let i = 0; i < 4; i++) {
      const x = 70 + (length / 4) * i;
      if (x < 60 + length) {
        ctx.beginPath();
        ctx.arc(x, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 200;
    this.vy = (Math.random() - 0.5) * 200;
    this.life = 0.5 + Math.random() * 0.3;
    this.maxLife = this.life;
    this.radius = 3 + Math.random() * 4;
    this.color = color;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBackground() {
  // Deep ocean
  const gradient = ctx.createRadialGradient(CX, CY, 0, CX, CY, 400);
  gradient.addColorStop(0, '#1a0a2e');
  gradient.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Murky particles
  ctx.fillStyle = 'rgba(124, 58, 237, 0.05)';
  const time = Date.now() / 1000;
  for (let i = 0; i < 20; i++) {
    const x = (Math.sin(time * 0.5 + i) * 0.5 + 0.5) * WIDTH;
    const y = (Math.cos(time * 0.3 + i * 1.5) * 0.5 + 0.5) * HEIGHT;
    ctx.beginPath();
    ctx.arc(x, y, 20 + Math.sin(time + i) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Battle arena circle (player may not exist yet on the start screen)
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.arc(CX, CY, player ? player.radius : PLAYER_ORBIT, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function gameLoop(timestamp) {
  if (!gameRunning) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  // Update
  player.update(dt);
  kraken.update(dt);

  bullets.forEach(b => b.update(dt));
  bullets = bullets.filter(b => !b.dead);

  tentacles.forEach(t => t.update(dt));
  tentacles = tentacles.filter(t => !t.dead);

  particles.forEach(p => p.update(dt));
  particles = particles.filter(p => !p.dead);

  scoreEl.textContent = score;

  // Check win/lose
  if (kraken.health <= 0) {
    victory();
    return;
  }
  if (player.health <= 0) {
    defeat();
    return;
  }

  // Draw
  drawBackground();
  tentacles.forEach(t => t.draw());
  kraken.draw();
  player.draw();
  bullets.forEach(b => b.draw());
  particles.forEach(p => p.draw());

  requestAnimationFrame(gameLoop);
}

function startGame() {
  player = new Player();
  kraken = new Kraken();
  bullets = [];
  tentacles = [];
  particles = [];
  score = 0;

  scoreEl.textContent = '0';
  bossFill.style.width = '100%';
  healthFill.style.width = '100%';

  startScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function victory() {
  gameRunning = false;
  score += 1000;
  victoryScoreEl.textContent = score;
  hud.classList.add('hidden');
  victoryScreen.classList.remove('hidden');
}

function defeat() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  hud.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// Input
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

startBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
drawBackground();
