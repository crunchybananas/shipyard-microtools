// Ship Wreckers - Asteroids-style boat game
// Dodge rocks, blast pirates, collect cargo!

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const scoreEl = document.getElementById('score');
const cargoEl = document.getElementById('cargo');
const healthFill = document.getElementById('healthFill');
const finalScoreEl = document.getElementById('finalScore');
const finalCargoEl = document.getElementById('finalCargo');

// Game state
let gameRunning = false;
let score = 0;
let cargoCollected = 0;
let player, bullets, rocks, pirates, crates, particles;
let keys = {};
let lastTime = 0;
let spawnTimer = 0;
let difficulty = 1;

// Player ship
class Ship {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height - 80;
    this.width = 40;
    this.height = 50;
    this.speed = 250;
    this.health = 100;
    this.maxHealth = 100;
    this.fireRate = 0.25;
    this.lastFire = 0;
    this.invincible = 0;
  }

  update(dt) {
    // Movement
    if (keys['ArrowLeft'] || keys['KeyA']) this.x -= this.speed * dt;
    if (keys['ArrowRight'] || keys['KeyD']) this.x += this.speed * dt;
    if (keys['ArrowUp'] || keys['KeyW']) this.y -= this.speed * dt;
    if (keys['ArrowDown'] || keys['KeyS']) this.y += this.speed * dt;

    // Bounds
    this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
    this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2, this.y));

    // Fire
    this.lastFire -= dt;
    if (keys['Space'] && this.lastFire <= 0) {
      bullets.push(new Bullet(this.x, this.y - this.height / 2));
      this.lastFire = this.fireRate;
    }

    // Invincibility timer
    if (this.invincible > 0) this.invincible -= dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Flash when invincible
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
    ctx.lineTo(15, 5);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.stroke();

    // Mast
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2 + 5);
    ctx.lineTo(0, this.height / 3);
    ctx.stroke();

    ctx.restore();
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.health -= amount;
    this.invincible = 1;
    healthFill.style.width = `${Math.max(0, this.health)}%`;
    
    // Screen shake effect via particles
    for (let i = 0; i < 5; i++) {
      particles.push(new Particle(this.x, this.y, '#ff6b6b'));
    }
  }
}

// Bullet
class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 4;
    this.speed = 500;
    this.dead = false;
  }

  update(dt) {
    this.y -= this.speed * dt;
    if (this.y < -10) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Trail
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.beginPath();
    ctx.arc(this.x, this.y + 8, this.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Rock obstacle
class Rock {
  constructor() {
    this.x = Math.random() * (canvas.width - 60) + 30;
    this.y = -40;
    this.radius = 20 + Math.random() * 25;
    this.speed = 80 + Math.random() * 60 * difficulty;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 2;
    this.vertices = this.generateVertices();
    this.dead = false;
  }

  generateVertices() {
    const verts = [];
    const count = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = this.radius * (0.7 + Math.random() * 0.3);
      verts.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    }
    return verts;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.rotation += this.rotSpeed * dt;
    if (this.y > canvas.height + 50) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.fillStyle = '#4a5568';
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let v of this.vertices) {
      ctx.lineTo(v.x, v.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// Pirate ship
class Pirate {
  constructor() {
    this.x = Math.random() * (canvas.width - 80) + 40;
    this.y = -50;
    this.width = 35;
    this.height = 45;
    this.speed = 60 + Math.random() * 40 * difficulty;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
    this.health = 2;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.wobble += dt * 3;
    this.x += Math.sin(this.wobble) * 0.5;
    if (this.y > canvas.height + 50) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Hull (dark)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.lineTo(this.width / 2, this.height / 3);
    ctx.lineTo(this.width / 3, this.height / 2);
    ctx.lineTo(-this.width / 3, this.height / 2);
    ctx.lineTo(-this.width / 2, this.height / 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0f0f1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sail (black with skull)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2 + 5);
    ctx.lineTo(12, 5);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();

    // Skull symbol
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  takeDamage() {
    this.health--;
    if (this.health <= 0) {
      this.dead = true;
      score += 50;
      for (let i = 0; i < 10; i++) {
        particles.push(new Particle(this.x, this.y, '#ff4757'));
      }
    }
  }
}

// Cargo crate
class Crate {
  constructor() {
    this.x = Math.random() * (canvas.width - 60) + 30;
    this.y = -30;
    this.size = 25;
    this.speed = 70 + Math.random() * 30;
    this.rotation = 0;
    this.rotSpeed = (Math.random() - 0.5) * 1.5;
    this.dead = false;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.rotation += this.rotSpeed * dt;
    if (this.y > canvas.height + 30) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Box
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);

    // Straps
    ctx.strokeStyle = '#5d4e37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-this.size / 2, 0);
    ctx.lineTo(this.size / 2, 0);
    ctx.moveTo(0, -this.size / 2);
    ctx.lineTo(0, this.size / 2);
    ctx.stroke();

    ctx.restore();
  }
}

// Particle effect
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 200;
    this.vy = (Math.random() - 0.5) * 200;
    this.life = 0.5 + Math.random() * 0.5;
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

// Water ripple effect
function drawWater(time) {
  ctx.fillStyle = '#0d2847';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Animated waves
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 10) {
      const y = 60 * i + Math.sin((x + time * 50 + i * 50) * 0.02) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Collision detection
function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}

function circleCircle(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return (dx * dx + dy * dy) < ((r1 + r2) * (r1 + r2));
}

// Game loop
function gameLoop(timestamp) {
  if (!gameRunning) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  // Update
  player.update(dt);

  bullets.forEach(b => b.update(dt));
  bullets = bullets.filter(b => !b.dead);

  rocks.forEach(r => r.update(dt));
  rocks = rocks.filter(r => !r.dead);

  pirates.forEach(p => p.update(dt));
  pirates = pirates.filter(p => !p.dead);

  crates.forEach(c => c.update(dt));
  crates = crates.filter(c => !c.dead);

  particles.forEach(p => p.update(dt));
  particles = particles.filter(p => !p.dead);

  // Spawn enemies
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const roll = Math.random();
    if (roll < 0.5) {
      rocks.push(new Rock());
    } else if (roll < 0.8) {
      pirates.push(new Pirate());
    } else {
      crates.push(new Crate());
    }
    spawnTimer = 1.5 / difficulty;
    difficulty += 0.01;
  }

  // Collisions
  // Bullets vs rocks
  bullets.forEach(b => {
    rocks.forEach(r => {
      if (circleCircle(b.x, b.y, b.radius, r.x, r.y, r.radius)) {
        b.dead = true;
        r.dead = true;
        score += 10;
        for (let i = 0; i < 6; i++) {
          particles.push(new Particle(r.x, r.y, '#718096'));
        }
      }
    });
  });

  // Bullets vs pirates
  bullets.forEach(b => {
    pirates.forEach(p => {
      if (circleRect(b.x, b.y, b.radius, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height)) {
        b.dead = true;
        p.takeDamage();
      }
    });
  });

  // Player vs rocks
  rocks.forEach(r => {
    if (circleRect(r.x, r.y, r.radius, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height)) {
      r.dead = true;
      player.takeDamage(25);
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(r.x, r.y, '#718096'));
      }
    }
  });

  // Player vs pirates
  pirates.forEach(p => {
    if (circleRect(player.x, player.y, player.width / 2, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height)) {
      p.dead = true;
      player.takeDamage(35);
      for (let i = 0; i < 10; i++) {
        particles.push(new Particle(p.x, p.y, '#ff4757'));
      }
    }
  });

  // Player vs crates
  crates.forEach(c => {
    if (circleRect(player.x, player.y, player.width / 2, c.x - c.size / 2, c.y - c.size / 2, c.size, c.size)) {
      c.dead = true;
      cargoCollected++;
      score += 25;
      cargoEl.textContent = cargoCollected;
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(c.x, c.y, '#fbbf24'));
      }
    }
  });

  // Score over time
  score += dt * 5;
  scoreEl.textContent = Math.floor(score);

  // Check death
  if (player.health <= 0) {
    endGame();
    return;
  }

  // Draw
  drawWater(timestamp / 1000);
  crates.forEach(c => c.draw());
  rocks.forEach(r => r.draw());
  pirates.forEach(p => p.draw());
  player.draw();
  bullets.forEach(b => b.draw());
  particles.forEach(p => p.draw());

  requestAnimationFrame(gameLoop);
}

function startGame() {
  player = new Ship();
  bullets = [];
  rocks = [];
  pirates = [];
  crates = [];
  particles = [];
  score = 0;
  cargoCollected = 0;
  difficulty = 1;
  spawnTimer = 0;

  scoreEl.textContent = '0';
  cargoEl.textContent = '0';
  healthFill.style.width = '100%';

  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  finalScoreEl.textContent = Math.floor(score);
  finalCargoEl.textContent = cargoCollected;
  hud.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// Input
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
drawWater(0);
