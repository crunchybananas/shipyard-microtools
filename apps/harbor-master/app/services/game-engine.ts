// Ship types with colors
export const SHIP_TYPES = [
  { color: "#ef4444", name: "red" },
  { color: "#22c55e", name: "green" },
  { color: "#3b82f6", name: "blue" },
  { color: "#f59e0b", name: "yellow" },
] as const;

// Dock positions around the edges
export const DOCK_POSITIONS = [
  { x: 580, y: 150, angle: Math.PI }, // right side
  { x: 580, y: 350, angle: Math.PI }, // right side
  { x: 20, y: 150, angle: 0 }, // left side
  { x: 20, y: 350, angle: 0 }, // left side
] as const;

export interface Point {
  x: number;
  y: number;
}

export class Ship {
  type: number;
  color: string;
  x: number;
  y: number;
  width = 30;
  height = 40;
  speed: number;
  angle: number;
  path: Point[] = [];
  pathIndex = 0;
  docked = false;
  dead = false;

  constructor(
    type: number,
    spawnSide: string,
    canvasWidth: number,
    canvasHeight: number,
    difficulty: number,
  ) {
    this.type = type;
    this.color = SHIP_TYPES[type]?.color ?? "#ffffff";
    this.speed = 40 + difficulty * 5;

    // Spawn from edges
    if (spawnSide === "top") {
      this.x = 100 + Math.random() * 400;
      this.y = -30;
      this.angle = Math.PI / 2;
    } else if (spawnSide === "bottom") {
      this.x = 100 + Math.random() * 400;
      this.y = canvasHeight + 30;
      this.angle = -Math.PI / 2;
    } else if (spawnSide === "left") {
      this.x = -30;
      this.y = 100 + Math.random() * 300;
      this.angle = 0;
    } else {
      this.x = canvasWidth + 30;
      this.y = 100 + Math.random() * 300;
      this.angle = Math.PI;
    }
  }

  update(dt: number, canvasWidth: number, canvasHeight: number): void {
    if (this.docked || this.dead) return;

    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      // Follow path
      const target = this.path[this.pathIndex];
      if (target) {
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
      }
    } else {
      // Continue in current direction
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
    }

    // Remove if way off screen
    if (
      this.x < -100 ||
      this.x > canvasWidth + 100 ||
      this.y < -100 ||
      this.y > canvasHeight + 100
    ) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
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
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cabin
    ctx.fillStyle = "rgba(255,255,255,0.3)";
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
        const point = this.path[i];
        if (point) {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  containsPoint(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) < 25;
  }
}

export class Dock {
  type: number;
  color: string;
  x: number;
  y: number;
  angle: number;
  width = 50;
  height = 70;

  constructor(type: number, x: number, y: number, angle: number) {
    this.type = type;
    this.color = SHIP_TYPES[type]?.color ?? "#ffffff";
    this.x = x;
    this.y = y;
    this.angle = angle;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Dock platform
    ctx.fillStyle = "#5d4e37";
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

    // Color indicator
    ctx.fillStyle = this.color;
    ctx.fillRect(
      -this.width / 2 + 5,
      -this.height / 2 + 5,
      this.width - 10,
      15,
    );

    // Planks
    ctx.strokeStyle = "#3d3428";
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

  containsShip(ship: Ship): boolean {
    const dx = ship.x - this.x;
    const dy = ship.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) < 40;
  }
}

export interface GameState {
  ships: Ship[];
  docks: Dock[];
  score: number;
  highScore: number;
  difficulty: number;
  spawnTimer: number;
  gameRunning: boolean;
  selectedShip: Ship | null;
  drawingPath: Point[];
}

export function createInitialState(): GameState {
  const highScore = parseInt(localStorage.getItem("harborHighScore") ?? "0");
  return {
    ships: [],
    docks: [],
    score: 0,
    highScore,
    difficulty: 1,
    spawnTimer: 1,
    gameRunning: false,
    selectedShip: null,
    drawingPath: [],
  };
}

export function initDocks(): Dock[] {
  return DOCK_POSITIONS.map((pos, i) => new Dock(i, pos.x, pos.y, pos.angle));
}

export function spawnShip(
  ships: Ship[],
  canvasWidth: number,
  canvasHeight: number,
  difficulty: number,
): Ship {
  const type = Math.floor(Math.random() * SHIP_TYPES.length);
  const sides = ["top", "bottom", "left", "right"];
  const side = sides[Math.floor(Math.random() * sides.length)] ?? "top";
  const ship = new Ship(type, side, canvasWidth, canvasHeight, difficulty);
  ships.push(ship);
  return ship;
}

export function checkCollisions(ships: Ship[]): boolean {
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i];
      const b = ships[j];
      if (!a || !b) continue;
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

export function checkDocking(ships: Ship[], docks: Dock[]): number {
  let dockedCount = 0;
  ships.forEach((ship) => {
    if (ship.docked || ship.dead) return;

    docks.forEach((dock) => {
      if (dock.type === ship.type && dock.containsShip(ship)) {
        ship.docked = true;
        dockedCount++;

        // Remove docked ship after a moment
        setTimeout(() => {
          ship.dead = true;
        }, 500);
      }
    });
  });
  return dockedCount;
}

export function drawWater(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.fillStyle = "#0d2847";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Water pattern
  ctx.strokeStyle = "rgba(59, 130, 246, 0.08)";
  ctx.lineWidth = 1;
  const time = Date.now() / 1000;
  for (let y = 0; y < canvasHeight; y += 30) {
    ctx.beginPath();
    for (let x = 0; x < canvasWidth; x += 5) {
      const yOff = Math.sin((x + time * 30) * 0.05 + y * 0.1) * 5;
      if (x === 0) ctx.moveTo(x, y + yOff);
      else ctx.lineTo(x, y + yOff);
    }
    ctx.stroke();
  }
}

export function getMousePos(e: MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
