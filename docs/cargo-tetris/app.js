// Cargo Tetris - Classic Tetris with a shipping twist
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const nextPieceDiv = document.getElementById('nextPiece');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const finalScoreEl = document.getElementById('finalScore');
const finalLinesEl = document.getElementById('finalLines');

// Grid settings
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const BOARD_WIDTH = COLS * BLOCK_SIZE;
const BOARD_HEIGHT = ROWS * BLOCK_SIZE;
const OFFSET_X = (canvas.width - BOARD_WIDTH) / 2;
const OFFSET_Y = canvas.height - BOARD_HEIGHT - 20;

// Container colors (cargo themed)
const COLORS = [
  null,
  '#ef4444', // Red container
  '#22c55e', // Green container
  '#3b82f6', // Blue container
  '#f59e0b', // Orange container
  '#8b5cf6', // Purple container
  '#06b6d4', // Cyan container
  '#ec4899'  // Pink container
];

// Tetromino shapes
const SHAPES = [
  null,
  [[1, 1, 1, 1]],                     // I
  [[2, 0, 0], [2, 2, 2]],             // J
  [[0, 0, 3], [3, 3, 3]],             // L
  [[4, 4], [4, 4]],                   // O
  [[0, 5, 5], [5, 5, 0]],             // S
  [[0, 6, 0], [6, 6, 6]],             // T
  [[7, 7, 0], [0, 7, 7]]              // Z
];

let board, currentPiece, nextPiece;
let score, lines, level;
let dropCounter, dropInterval, lastTime;
let gameRunning = false;

class Piece {
  constructor(type) {
    this.type = type;
    this.shape = SHAPES[type].map(row => [...row]);
    this.color = COLORS[type];
    this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
    this.y = 0;
  }

  rotate() {
    const rows = this.shape.length;
    const cols = this.shape[0].length;
    const rotated = [];
    
    for (let c = 0; c < cols; c++) {
      rotated[c] = [];
      for (let r = rows - 1; r >= 0; r--) {
        rotated[c].push(this.shape[r][c]);
      }
    }
    
    return rotated;
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  return new Piece(type);
}

function collision(piece, offsetX = 0, offsetY = 0, shape = piece.shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const newX = piece.x + x + offsetX;
        const newY = piece.y + y + offsetY;
        
        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        if (newY >= 0 && board[newY][newX]) return true;
      }
    }
  }
  return false;
}

function merge(piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = piece.y + y;
        if (boardY >= 0) {
          board[boardY][piece.x + x] = piece.type;
        }
      }
    });
  });
}

function clearLines() {
  let cleared = 0;
  
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++; // Check same row again
    }
  }
  
  if (cleared > 0) {
    // Scoring: 100, 300, 500, 800
    const points = [0, 100, 300, 500, 800][cleared] * level;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }
}

function drop() {
  if (collision(currentPiece, 0, 1)) {
    merge(currentPiece);
    clearLines();
    
    currentPiece = nextPiece;
    nextPiece = randomPiece();
    drawNextPiece();
    
    if (collision(currentPiece)) {
      endGame();
    }
  } else {
    currentPiece.y++;
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collision(currentPiece, 0, 1)) {
    currentPiece.y++;
    score += 2;
  }
  drop();
}

function move(dir) {
  if (!collision(currentPiece, dir, 0)) {
    currentPiece.x += dir;
  }
}

function rotate() {
  const rotated = currentPiece.rotate();
  
  // Wall kicks
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collision(currentPiece, kick, 0, rotated)) {
      currentPiece.shape = rotated;
      currentPiece.x += kick;
      return;
    }
  }
}

function drawBlock(ctx, x, y, type, size = BLOCK_SIZE) {
  const color = COLORS[type];
  if (!color) return;
  
  // Container body
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  
  // Container ridges (shipping container look)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 1, y + size / 3, size - 2, 2);
  ctx.fillRect(x + 1, y + size * 2 / 3, size - 2, 2);
  
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 1, y + 1, size - 2, 4);
  
  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
}

function drawBoard() {
  // Ocean background
  ctx.fillStyle = '#0d2847';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Water waves
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.lineWidth = 2;
  const time = Date.now() / 1000;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 10) {
      const y = canvas.height - 15 + Math.sin((x + time * 50 + i * 30) * 0.03) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  
  // Ship hull
  ctx.fillStyle = '#5d4e37';
  ctx.beginPath();
  ctx.moveTo(OFFSET_X - 15, OFFSET_Y + BOARD_HEIGHT);
  ctx.lineTo(OFFSET_X - 5, canvas.height);
  ctx.lineTo(OFFSET_X + BOARD_WIDTH + 5, canvas.height);
  ctx.lineTo(OFFSET_X + BOARD_WIDTH + 15, OFFSET_Y + BOARD_HEIGHT);
  ctx.closePath();
  ctx.fill();
  
  // Board background (deck)
  ctx.fillStyle = '#3d3428';
  ctx.fillRect(OFFSET_X, OFFSET_Y, BOARD_WIDTH, BOARD_HEIGHT);
  
  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(OFFSET_X + x * BLOCK_SIZE, OFFSET_Y);
    ctx.lineTo(OFFSET_X + x * BLOCK_SIZE, OFFSET_Y + BOARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(OFFSET_X, OFFSET_Y + y * BLOCK_SIZE);
    ctx.lineTo(OFFSET_X + BOARD_WIDTH, OFFSET_Y + y * BLOCK_SIZE);
    ctx.stroke();
  }
  
  // Draw placed blocks
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(ctx, OFFSET_X + x * BLOCK_SIZE, OFFSET_Y + y * BLOCK_SIZE, value);
      }
    });
  });
  
  // Draw ghost piece
  if (currentPiece) {
    let ghostY = currentPiece.y;
    while (!collision(currentPiece, 0, ghostY - currentPiece.y + 1)) {
      ghostY++;
    }
    
    ctx.globalAlpha = 0.3;
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawBlock(ctx,
            OFFSET_X + (currentPiece.x + x) * BLOCK_SIZE,
            OFFSET_Y + (ghostY + y) * BLOCK_SIZE,
            currentPiece.type
          );
        }
      });
    });
    ctx.globalAlpha = 1;
    
    // Draw current piece
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawBlock(ctx,
            OFFSET_X + (currentPiece.x + x) * BLOCK_SIZE,
            OFFSET_Y + (currentPiece.y + y) * BLOCK_SIZE,
            currentPiece.type
          );
        }
      });
    });
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = 'transparent';
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  
  const blockSize = 20;
  const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSize) / 2;
  const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSize) / 2;
  
  nextPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(nextCtx, offsetX + x * blockSize, offsetY + y * blockSize, nextPiece.type, blockSize);
      }
    });
  });
}

function gameLoop(timestamp) {
  if (!gameRunning) return;
  
  const dt = timestamp - lastTime;
  lastTime = timestamp;
  dropCounter += dt;
  
  if (dropCounter > dropInterval) {
    drop();
  }
  
  drawBoard();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  board = createBoard();
  currentPiece = randomPiece();
  nextPiece = randomPiece();
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  dropInterval = 1000;
  
  scoreEl.textContent = '0';
  linesEl.textContent = '0';
  levelEl.textContent = '1';
  
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  nextPieceDiv.classList.remove('hidden');
  
  drawNextPiece();
  
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  finalLinesEl.textContent = lines;
  hud.classList.add('hidden');
  nextPieceDiv.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// Input
document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      move(-1);
      break;
    case 'ArrowRight':
    case 'KeyD':
      move(1);
      break;
    case 'ArrowDown':
    case 'KeyS':
      drop();
      score += 1;
      break;
    case 'ArrowUp':
    case 'KeyW':
      rotate();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
drawBoard();
