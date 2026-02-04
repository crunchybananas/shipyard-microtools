import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

// Grid settings
export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30;
export const BOARD_WIDTH = COLS * BLOCK_SIZE;
export const BOARD_HEIGHT = ROWS * BLOCK_SIZE;

// Container colors (cargo themed)
export const COLORS: (string | null)[] = [
  null,
  "#ef4444", // Red container
  "#22c55e", // Green container
  "#3b82f6", // Blue container
  "#f59e0b", // Orange container
  "#8b5cf6", // Purple container
  "#06b6d4", // Cyan container
  "#ec4899", // Pink container
];

// Tetromino shapes
export const SHAPES: (number[][] | null)[] = [
  null,
  [[1, 1, 1, 1]], // I
  [
    [2, 0, 0],
    [2, 2, 2],
  ], // J
  [
    [0, 0, 3],
    [3, 3, 3],
  ], // L
  [
    [4, 4],
    [4, 4],
  ], // O
  [
    [0, 5, 5],
    [5, 5, 0],
  ], // S
  [
    [0, 6, 0],
    [6, 6, 6],
  ], // T
  [
    [7, 7, 0],
    [0, 7, 7],
  ], // Z
];

export interface Piece {
  type: number;
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

export type GameScreen = "start" | "playing" | "gameover";

export default class GameEngineService extends Service {
  @tracked board: number[][] = [];
  @tracked currentPiece: Piece | null = null;
  @tracked nextPiece: Piece | null = null;
  @tracked score = 0;
  @tracked lines = 0;
  @tracked level = 1;
  @tracked screen: GameScreen = "start";

  dropCounter = 0;
  dropInterval = 1000;
  lastTime = 0;
  animationId: number | null = null;

  mainCanvas: HTMLCanvasElement | null = null;
  mainCtx: CanvasRenderingContext2D | null = null;
  nextCanvas: HTMLCanvasElement | null = null;
  nextCtx: CanvasRenderingContext2D | null = null;

  get offsetX(): number {
    if (!this.mainCanvas) return 0;
    return (this.mainCanvas.width - BOARD_WIDTH) / 2;
  }

  get offsetY(): number {
    if (!this.mainCanvas) return 0;
    return this.mainCanvas.height - BOARD_HEIGHT - 20;
  }

  get isPlaying(): boolean {
    return this.screen === "playing";
  }

  setCanvases(
    mainCanvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement,
  ): void {
    this.mainCanvas = mainCanvas;
    this.mainCtx = mainCanvas.getContext("2d");
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext("2d");
    this.drawBoard();
  }

  createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  createPiece(type: number): Piece {
    const shapeTemplate = SHAPES[type];
    if (!shapeTemplate) {
      throw new Error(`Invalid piece type: ${type}`);
    }
    const shape = shapeTemplate.map((row) => [...row]);
    const color = COLORS[type] ?? "#fff";
    const firstRow = shape[0];
    const colOffset = firstRow ? Math.floor(firstRow.length / 2) : 0;

    return {
      type,
      shape,
      color,
      x: Math.floor(COLS / 2) - colOffset,
      y: 0,
    };
  }

  randomPiece(): Piece {
    const type = Math.floor(Math.random() * 7) + 1;
    return this.createPiece(type);
  }

  rotatePiece(piece: Piece): number[][] {
    const rows = piece.shape.length;
    const firstRow = piece.shape[0];
    if (!firstRow) return piece.shape;
    const cols = firstRow.length;
    const rotated: number[][] = [];

    for (let c = 0; c < cols; c++) {
      rotated[c] = [];
      for (let r = rows - 1; r >= 0; r--) {
        const row = piece.shape[r];
        const rotatedRow = rotated[c];
        if (row && rotatedRow) {
          rotatedRow.push(row[c] ?? 0);
        }
      }
    }

    return rotated;
  }

  collision(
    piece: Piece,
    offsetX = 0,
    offsetY = 0,
    shape = piece.shape,
  ): boolean {
    for (let y = 0; y < shape.length; y++) {
      const row = shape[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        if (row[x]) {
          const newX = piece.x + x + offsetX;
          const newY = piece.y + y + offsetY;

          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          const boardRow = this.board[newY];
          if (newY >= 0 && boardRow && boardRow[newX]) return true;
        }
      }
    }
    return false;
  }

  merge(piece: Piece): void {
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const boardY = piece.y + y;
          const boardRow = this.board[boardY];
          if (boardY >= 0 && boardRow) {
            boardRow[piece.x + x] = piece.type;
          }
        }
      });
    });
    // Trigger reactivity
    this.board = [...this.board];
  }

  clearLines(): void {
    let cleared = 0;

    for (let y = ROWS - 1; y >= 0; y--) {
      const row = this.board[y];
      if (row && row.every((cell) => cell !== 0)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(COLS).fill(0));
        cleared++;
        y++; // Check same row again
      }
    }

    if (cleared > 0) {
      // Scoring: 100, 300, 500, 800
      const scoreTable = [0, 100, 300, 500, 800];
      const points = (scoreTable[cleared] ?? 0) * this.level;
      this.score += points;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
      // Trigger reactivity
      this.board = [...this.board];
    }
  }

  drop(): void {
    if (!this.currentPiece) return;

    if (this.collision(this.currentPiece, 0, 1)) {
      this.merge(this.currentPiece);
      this.clearLines();

      this.currentPiece = this.nextPiece;
      this.nextPiece = this.randomPiece();
      this.drawNextPiece();

      if (this.currentPiece && this.collision(this.currentPiece)) {
        this.endGame();
      }
    } else {
      this.currentPiece.y++;
    }
    this.dropCounter = 0;
  }

  hardDrop(): void {
    if (!this.currentPiece) return;

    while (!this.collision(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
      this.score += 2;
    }
    this.drop();
  }

  move(dir: number): void {
    if (!this.currentPiece) return;

    if (!this.collision(this.currentPiece, dir, 0)) {
      this.currentPiece.x += dir;
    }
  }

  rotate(): void {
    if (!this.currentPiece) return;

    const rotated = this.rotatePiece(this.currentPiece);

    // Wall kicks
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collision(this.currentPiece, kick, 0, rotated)) {
        this.currentPiece.shape = rotated;
        this.currentPiece.x += kick;
        return;
      }
    }
  }

  drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: number,
    size = BLOCK_SIZE,
  ): void {
    const color = COLORS[type];
    if (!color) return;

    // Container body
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    // Container ridges (shipping container look)
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 1, y + size / 3, size - 2, 2);
    ctx.fillRect(x + 1, y + (size * 2) / 3, size - 2, 2);

    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x + 1, y + 1, size - 2, 4);

    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  }

  drawBoard(): void {
    if (!this.mainCtx || !this.mainCanvas) return;

    const ctx = this.mainCtx;
    const canvas = this.mainCanvas;

    // Ocean background
    ctx.fillStyle = "#0d2847";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Water waves
    ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
    ctx.lineWidth = 2;
    const time = Date.now() / 1000;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 10) {
        const y =
          canvas.height - 15 + Math.sin((x + time * 50 + i * 30) * 0.03) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Ship hull
    ctx.fillStyle = "#5d4e37";
    ctx.beginPath();
    ctx.moveTo(this.offsetX - 15, this.offsetY + BOARD_HEIGHT);
    ctx.lineTo(this.offsetX - 5, canvas.height);
    ctx.lineTo(this.offsetX + BOARD_WIDTH + 5, canvas.height);
    ctx.lineTo(this.offsetX + BOARD_WIDTH + 15, this.offsetY + BOARD_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Board background (deck)
    ctx.fillStyle = "#3d3428";
    ctx.fillRect(this.offsetX, this.offsetY, BOARD_WIDTH, BOARD_HEIGHT);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + x * BLOCK_SIZE, this.offsetY);
      ctx.lineTo(this.offsetX + x * BLOCK_SIZE, this.offsetY + BOARD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + y * BLOCK_SIZE);
      ctx.lineTo(this.offsetX + BOARD_WIDTH, this.offsetY + y * BLOCK_SIZE);
      ctx.stroke();
    }

    // Draw placed blocks
    this.board.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          this.drawBlock(
            ctx,
            this.offsetX + x * BLOCK_SIZE,
            this.offsetY + y * BLOCK_SIZE,
            value,
          );
        }
      });
    });

    // Draw ghost piece and current piece
    if (this.currentPiece) {
      let ghostY = this.currentPiece.y;
      while (
        !this.collision(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)
      ) {
        ghostY++;
      }

      ctx.globalAlpha = 0.3;
      this.currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value && this.currentPiece) {
            this.drawBlock(
              ctx,
              this.offsetX + (this.currentPiece.x + x) * BLOCK_SIZE,
              this.offsetY + (ghostY + y) * BLOCK_SIZE,
              this.currentPiece.type,
            );
          }
        });
      });
      ctx.globalAlpha = 1;

      // Draw current piece
      this.currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value && this.currentPiece) {
            this.drawBlock(
              ctx,
              this.offsetX + (this.currentPiece.x + x) * BLOCK_SIZE,
              this.offsetY + (this.currentPiece.y + y) * BLOCK_SIZE,
              this.currentPiece.type,
            );
          }
        });
      });
    }
  }

  drawNextPiece(): void {
    if (!this.nextCtx || !this.nextCanvas || !this.nextPiece) return;

    const ctx = this.nextCtx;
    const canvas = this.nextCanvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const blockSize = 20;
    const firstRow = this.nextPiece.shape[0];
    const shapeWidth = firstRow ? firstRow.length : 0;
    const offsetX = (canvas.width - shapeWidth * blockSize) / 2;
    const offsetY =
      (canvas.height - this.nextPiece.shape.length * blockSize) / 2;

    this.nextPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value && this.nextPiece) {
          this.drawBlock(
            ctx,
            offsetX + x * blockSize,
            offsetY + y * blockSize,
            this.nextPiece.type,
            blockSize,
          );
        }
      });
    });
  }

  gameLoop = (timestamp: number): void => {
    if (this.screen !== "playing") return;

    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.dropCounter += dt;

    if (this.dropCounter > this.dropInterval) {
      this.drop();
    }

    this.drawBoard();
    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  startGame(): void {
    this.board = this.createBoard();
    this.currentPiece = this.randomPiece();
    this.nextPiece = this.randomPiece();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropCounter = 0;
    this.dropInterval = 1000;

    this.screen = "playing";
    this.drawNextPiece();

    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  endGame(): void {
    this.screen = "gameover";
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  handleKeydown(code: string): boolean {
    if (this.screen !== "playing") return false;

    switch (code) {
      case "ArrowLeft":
      case "KeyA":
        this.move(-1);
        break;
      case "ArrowRight":
      case "KeyD":
        this.move(1);
        break;
      case "ArrowDown":
      case "KeyS":
        this.drop();
        this.score += 1;
        break;
      case "ArrowUp":
      case "KeyW":
        this.rotate();
        break;
      case "Space":
        this.hardDrop();
        break;
      default:
        return false;
    }

    return true;
  }
}
