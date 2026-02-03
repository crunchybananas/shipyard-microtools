// Harbor Master - Guide ships to matching docks
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreEl = document.getElementById('score');
const shipCountEl = document.getElementById('shipCount');
const finalScoreEl = document.getElementById('finalScore');
const highScoreEl = document.getElementById('highScore');

// Game state
let gameRunning = false;
let ships = [];
let docks = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('harborHighScore') || '0');
let spawnTimer = 0;
let difficulty = 1;
let selectedShip = null;
let drawingPath = [];

// Ship colors and their docks
const SHIP_TYPES = [
  { color: '#ef4444', name: 'red' },
  { color: '#22c55e', name: 'green' },
  { color: '#3b82f6', name: 'blue' },
  { color: '#f59e0b', name: 'yellow' }
];

// Dock positions (around the edges)
const DOCK_POSITIONS = [
  { x: 580, y: 150, angle: Math.PI },      // right side
  { x: 580, y: 350, angle: Math.PI },      // right side
  { x: 20, y: 150, angle: 0 },             // left side
  { x: 20, y: 350, angle: 0 }              // left side
];

class Ship {
  constructor(type, spawnSide) {
    this.type = type;
    this.color = SHIP_TYPES[type].color;
    this.width = 30;
    this.height = 40;
    this.speed = 40 + difficulty * 5;
    
    // Spawn from edges
    if (spawnSide === 'top') {
      this.x = 100 + Math.random() * 400;
      this.y = -30;
      this.angle = Math.PI / 2;
    } else if (spawnSide === 'bottom') {
      this.x = 100 + Math.random() * 400;
      this.y = canvas.height + 30;
      this.angle = -Math.PI / 2;
    } else if (spawnSide === 'left') {
      this.x = -30;
      this.y = 100 + Math.random() * 300;
      this.angle = 0;
    } else {
      this.x = canvas.width + 30;
      this.y = 100 + Math.random() * 300;
      this.angle = Math.PI;
    }
    
    this.path = [];
    this.pathIndex = 0;
    this.docked = false;
    this.dead = false;
  }

  update(dt) {
    if (this.docked || this.dead) return;
    
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      // Follow path
      const target = this.path[this.pathIndex];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 10) {
        this.pathIndex++;
      } else {
        this.angle = Math.atan2(dy, dx);
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
      }
    } else {
      // Continue in current direction
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
    }
    
    // Remove if way off screen
    if (this.x < -100 || this.x > canvas.width + 100 ||
        this.y < -100 || this.y > canvas.height + 100) {
      this.dead = true;
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    
    // Hull
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.lineTo(this.width / 2, this.height / 3);
    ctx.lineTo(this.width / 3, this.height / 2);
    ctx.lineTo(-this.width / 3, this.height / 2);
    ctx.lineTo(-this.width / 2, this.height / 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Cabin
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-8, -5, 16, 15);
    
    ctx.restore();
    
    // Draw path
    if (this.path.length > 0) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.4;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      for (let i = this.pathIndex; i < this.path.length; i++) {
        ctx.lineTo(this.path[i].x, this.path[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) < 25;
  }
}

class Dock {
  constructor(type, x, y, angle) {
    this.type = type;
    this.color = SHIP_TYPES[type].color;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.width = 50;
    this.height = 70;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    // Dock platform
    ctx.fillStyle = '#5d4e37';
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    
    // Color indicator
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.width / 2 + 5, -this.height / 2 + 5, this.width - 10, 15);
    
    // Planks
    ctx.strokeStyle = '#3d3428';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = -this.height / 2 + 25 + i * 10;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2, y);
      ctx.lineTo(this.width / 2, y);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  containsShip(ship) {
    const dx = ship.x - this.x;
    const dy = ship.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) < 40;
  }
}

function drawWater() {
  ctx.fillStyle = '#0d2847';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Water pattern
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
  ctx.lineWidth = 1;
  const time = Date.now() / 1000;
  for (let y = 0; y < canvas.height; y += 30) {
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 5) {
      const yOff = Math.sin((x + time * 30) * 0.05 + y * 0.1) * 5;
      if (x === 0) ctx.moveTo(x, y + yOff);
      else ctx.lineTo(x, y + yOff);
    }
    ctx.stroke();
  }
}

function checkCollisions() {
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i];
      const b = ships[j];
      if (a.docked || b.docked || a.dead || b.dead) continue;
      
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 30) {
        return true; // Collision!
      }
    }
  }
  return false;
}

function checkDocking() {
  ships.forEach(ship => {
    if (ship.docked || ship.dead) return;
    
    docks.forEach(dock => {
      if (dock.type === ship.type && dock.containsShip(ship)) {
        ship.docked = true;
        score++;
        scoreEl.textContent = score;
        
        // Remove docked ship after a moment
        setTimeout(() => {
          ship.dead = true;
        }, 500);
      }
    });
  });
}

function spawnShip() {
  const type = Math.floor(Math.random() * SHIP_TYPES.length);
  const sides = ['top', 'bottom', 'left', 'right'];
  const side = sides[Math.floor(Math.random() * sides.length)];
  ships.push(new Ship(type, side));
  shipCountEl.textContent = ships.filter(s => !s.dead && !s.docked).length;
}

let lastTime = 0;
function gameLoop(timestamp) {
  if (!gameRunning) return;
  
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  
  // Update
  ships.forEach(ship => ship.update(dt));
  ships = ships.filter(ship => !ship.dead);
  shipCountEl.textContent = ships.filter(s => !s.docked).length;
  
  // Spawn ships
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnShip();
    spawnTimer = Math.max(2, 5 - difficulty * 0.3);
    difficulty += 0.1;
  }
  
  // Check collisions
  if (checkCollisions()) {
    endGame();
    return;
  }
  
  // Check docking
  checkDocking();
  
  // Draw
  drawWater();
  docks.forEach(dock => dock.draw());
  ships.forEach(ship => ship.draw());
  
  // Draw current path being drawn
  if (selectedShip && drawingPath.length > 1) {
    ctx.strokeStyle = selectedShip.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(selectedShip.x, selectedShip.y);
    drawingPath.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  
  requestAnimationFrame(gameLoop);
}

function startGame() {
  ships = [];
  docks = [];
  score = 0;
  difficulty = 1;
  spawnTimer = 1;
  
  // Create docks
  DOCK_POSITIONS.forEach((pos, i) => {
    docks.push(new Dock(i, pos.x, pos.y, pos.angle));
  });
  
  scoreEl.textContent = '0';
  shipCountEl.textContent = '0';
  
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('harborHighScore', highScore.toString());
  }
  
  finalScoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  hud.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// Mouse handling
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

canvas.addEventListener('mousedown', e => {
  if (!gameRunning) return;
  const pos = getMousePos(e);
  
  // Find ship under cursor
  for (const ship of ships) {
    if (!ship.docked && ship.containsPoint(pos.x, pos.y)) {
      selectedShip = ship;
      drawingPath = [];
      break;
    }
  }
});

canvas.addEventListener('mousemove', e => {
  if (!gameRunning || !selectedShip) return;
  const pos = getMousePos(e);
  
  // Add point to path (throttled)
  const last = drawingPath[drawingPath.length - 1];
  if (!last || Math.abs(pos.x - last.x) > 10 || Math.abs(pos.y - last.y) > 10) {
    drawingPath.push(pos);
  }
});

canvas.addEventListener('mouseup', () => {
  if (selectedShip && drawingPath.length > 0) {
    selectedShip.path = [...drawingPath];
    selectedShip.pathIndex = 0;
  }
  selectedShip = null;
  drawingPath = [];
});

canvas.addEventListener('mouseleave', () => {
  if (selectedShip && drawingPath.length > 0) {
    selectedShip.path = [...drawingPath];
    selectedShip.pathIndex = 0;
  }
  selectedShip = null;
  drawingPath = [];
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
drawWater();
