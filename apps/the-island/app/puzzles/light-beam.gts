/**
 * Light Beam Puzzle — Crystal Caverns
 *
 * A light source on the left emits a beam. 3 prisms on the field can be
 * rotated by clicking (4 orientations: 0°, 90°, 180°, 270°).
 * Each prism deflects the beam 90° based on its orientation.
 *
 * 5 crystals are placed around the field. The beam must pass through
 * all 5 to solve the puzzle. The beam traces through prisms in sequence,
 * bouncing at each one.
 *
 * This is a spatial logic puzzle — you need to figure out which prism
 * orientations create a path that hits all crystals.
 */

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface LightBeamSignature {
  Args: {
    onSolve: () => void;
    onClose: () => void;
  };
  Element: HTMLDivElement;
}

interface Vec2 { x: number; y: number }

interface Prism {
  x: number;
  y: number;
  angle: number; // 0, 1, 2, 3 (×90°) — determines reflection direction
}

interface Crystal {
  x: number;
  y: number;
  lit: boolean;
}

// Grid-based layout: 8 columns × 6 rows
// Light enters from left at row 3
const GRID_COLS = 8;
const GRID_ROWS = 6;

// Prism positions (column, row)
const INITIAL_PRISMS: Array<{ col: number; row: number }> = [
  { col: 2, row: 2 },
  { col: 4, row: 2 },
  { col: 4, row: 4 },
];

// Crystal positions (column, row)
const CRYSTAL_POSITIONS = [
  { col: 1, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 1 },
  { col: 4, row: 3 },
  { col: 6, row: 4 },
];

// Solution: prism angles that create a beam path hitting all crystals
// Light goes right from (0,2) → hits prism(2,2) → depending on angle, deflects
// The puzzle has one valid solution configuration

export default class LightBeam extends Component<LightBeamSignature> {
  @tracked prisms: Prism[] = INITIAL_PRISMS.map(p => ({
    x: p.col,
    y: p.row,
    angle: 0,
  }));
  @tracked crystals: Crystal[] = CRYSTAL_POSITIONS.map(c => ({
    x: c.col,
    y: c.row,
    lit: false,
  }));
  @tracked beamPath: Vec2[] = [];
  @tracked solved = false;
  @tracked message = "Rotate the prisms (△) to direct the light beam through all 5 crystals.";

  private canvas: HTMLCanvasElement | null = null;

  constructor(owner: unknown, args: LightBeamSignature["Args"]) {
    super(owner, args);
    this.traceBeam();
  }

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.resize();
    this.startDrawLoop();

    const handleResize = () => { this.resize(); };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      this.stopDrawLoop();
    };
  });

  private animId: number | null = null;

  startDrawLoop(): void {
    const loop = (): void => {
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopDrawLoop(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  resize(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    const ctx = this.canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
  }

  // ============================================
  // BEAM TRACING
  // ============================================

  traceBeam(): void {
    const path: Vec2[] = [];
    let dir: Vec2 = { x: 1, y: 0 }; // start going right
    let pos: Vec2 = { x: -0.5, y: 2 }; // start from left edge, row 2

    // Reset crystal lit state
    const newCrystals = this.crystals.map(c => ({ ...c, lit: false }));

    // Trace beam step by step
    for (let step = 0; step < 50; step++) {
      const nextPos = { x: pos.x + dir.x, y: pos.y + dir.y };
      path.push({ ...nextPos });

      // Check if beam hits a crystal
      for (const crystal of newCrystals) {
        if (Math.abs(nextPos.x - crystal.x) < 0.3 && Math.abs(nextPos.y - crystal.y) < 0.3) {
          crystal.lit = true;
        }
      }

      // Check if beam hits a prism
      let hitPrism = false;
      for (const prism of this.prisms) {
        if (Math.abs(nextPos.x - prism.x) < 0.3 && Math.abs(nextPos.y - prism.y) < 0.3) {
          // Deflect beam based on prism angle
          dir = this.deflect(dir, prism.angle);
          hitPrism = true;
          break;
        }
      }

      // Check if beam went off grid
      if (nextPos.x < -1 || nextPos.x > GRID_COLS || nextPos.y < -1 || nextPos.y > GRID_ROWS) {
        break;
      }

      pos = nextPos;
      if (!hitPrism) {
        // Continue in same direction — beam passes through empty space
      }
    }

    this.beamPath = path;
    this.crystals = newCrystals;

    // Check if all crystals are lit
    const allLit = newCrystals.every(c => c.lit);
    if (allLit && !this.solved) {
      this.solved = true;
      this.message = "All crystals ablaze! The cavern fills with rainbow light!";
      setTimeout(() => { this.args.onSolve(); }, 2000);
    }
  }

  deflect(dir: Vec2, angle: number): Vec2 {
    // Prism acts as a mirror. Angle determines which way it faces:
    // 0: reflects beam coming right → goes down, beam coming up → goes right (/ mirror)
    // 1: reflects beam coming right → goes up, beam coming down → goes right (\ mirror)
    // 2: same as 0 but inverted
    // 3: same as 1 but inverted

    switch (angle % 4) {
      case 0: // "/" mirror
        if (dir.x === 1) return { x: 0, y: 1 }; // right → down
        if (dir.x === -1) return { x: 0, y: -1 }; // left → up
        if (dir.y === 1) return { x: 1, y: 0 }; // down → right
        if (dir.y === -1) return { x: -1, y: 0 }; // up → left
        break;
      case 1: // "\" mirror
        if (dir.x === 1) return { x: 0, y: -1 }; // right → up
        if (dir.x === -1) return { x: 0, y: 1 }; // left → down
        if (dir.y === 1) return { x: -1, y: 0 }; // down → left
        if (dir.y === -1) return { x: 1, y: 0 }; // up → right
        break;
      case 2: // "/" mirror (same as 0)
        return this.deflect(dir, 0);
      case 3: // "\" mirror (same as 1)
        return this.deflect(dir, 1);
    }
    return dir; // no change if direction doesn't match
  }

  // ============================================
  // DRAWING
  // ============================================

  draw(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const cellW = w / (GRID_COLS + 1);
    const cellH = h / (GRID_ROWS + 1);
    const offsetX = cellW * 0.5;
    const offsetY = cellH * 0.5;

    ctx.clearRect(0, 0, w, h);

    // Dark cave background
    ctx.fillStyle = "#0a0818";
    ctx.fillRect(0, 0, w, h);

    // Grid lines (subtle)
    ctx.strokeStyle = "#1a1828";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * cellW, 0);
      ctx.lineTo(offsetX + c * cellW, h);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, offsetY + r * cellH);
      ctx.lineTo(w, offsetY + r * cellH);
      ctx.stroke();
    }

    // Light source (left side)
    const srcX = offsetX - cellW * 0.3;
    const srcY = offsetY + 2 * cellH;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(srcX, srcY, 8, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    const srcGlow = ctx.createRadialGradient(srcX, srcY, 0, srcX, srcY, 25);
    srcGlow.addColorStop(0, "rgba(255, 215, 0, 0.4)");
    srcGlow.addColorStop(1, "transparent");
    ctx.fillStyle = srcGlow;
    ctx.fillRect(srcX - 25, srcY - 25, 50, 50);

    // Draw beam path
    if (this.beamPath.length > 0) {
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(srcX, srcY);
      for (const p of this.beamPath) {
        ctx.lineTo(offsetX + p.x * cellW, offsetY + p.y * cellH);
      }
      ctx.stroke();

      // Beam glow
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.moveTo(srcX, srcY);
      for (const p of this.beamPath) {
        ctx.lineTo(offsetX + p.x * cellW, offsetY + p.y * cellH);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw crystals
    for (const crystal of this.crystals) {
      const cx = offsetX + crystal.x * cellW;
      const cy = offsetY + crystal.y * cellH;
      const size = Math.min(cellW, cellH) * 0.3;

      // Crystal shape
      ctx.fillStyle = crystal.lit ? "#aa44ff" : "#3a3048";
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size * 0.5, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.4, cy + size * 0.6);
      ctx.lineTo(cx - size * 0.4, cy + size * 0.6);
      ctx.lineTo(cx - size * 0.5, cy - size * 0.3);
      ctx.closePath();
      ctx.fill();

      // Glow when lit
      if (crystal.lit) {
        const t = Date.now() * 0.003;
        const pulse = Math.sin(t + crystal.x) * 0.15 + 0.85;
        ctx.globalAlpha = 0.3 * pulse;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 2);
        glow.addColorStop(0, "#aa44ff");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - size * 2, cy - size * 2, size * 4, size * 4);
        ctx.globalAlpha = 1;
      }
    }

    // Draw prisms (clickable triangles)
    for (const prism of this.prisms) {
      const px = offsetX + prism.x * cellW;
      const py = offsetY + prism.y * cellH;
      const size = Math.min(cellW, cellH) * 0.35;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((prism.angle * Math.PI) / 2);

      // Prism triangle
      ctx.fillStyle = "#4a8aaa";
      ctx.strokeStyle = "#6aaaca";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.87, size * 0.5);
      ctx.lineTo(-size * 0.87, size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glass highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(size * 0.4, size * 0.1);
      ctx.lineTo(-size * 0.2, size * 0.2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Title
    ctx.fillStyle = "#d4c4a8";
    ctx.font = `bold ${Math.min(w / 25, 18)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("LIGHT BEAMS", w / 2, 22);

    // Crystal count
    const litCount = this.crystals.filter(c => c.lit).length;
    ctx.fillStyle = "#8a8a9a";
    ctx.font = `${Math.min(w / 35, 13)}px sans-serif`;
    ctx.fillText(`Crystals lit: ${litCount}/5`, w / 2, h - 10);
  }

  // ============================================
  // INPUT
  // ============================================

  handleCanvasClick = (e: MouseEvent): void => {
    if (this.solved || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cellW = rect.width / (GRID_COLS + 1);
    const cellH = rect.height / (GRID_ROWS + 1);
    const offsetX = cellW * 0.5;
    const offsetY = cellH * 0.5;

    // Check if a prism was clicked
    for (let i = 0; i < this.prisms.length; i++) {
      const prism = this.prisms[i]!;
      const px = offsetX + prism.x * cellW;
      const py = offsetY + prism.y * cellH;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

      if (dist < Math.min(cellW, cellH) * 0.5) {
        // Rotate this prism
        const newPrisms = [...this.prisms];
        newPrisms[i] = { ...prism, angle: (prism.angle + 1) % 4 };
        this.prisms = newPrisms;
        this.traceBeam();
        this.message = `Prism rotated. Crystals lit: ${this.crystals.filter(c => c.lit).length}/5`;
        return;
      }
    }
  };

  close = (): void => {
    this.args.onClose();
  };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container" style="max-width: 650px;">
        <canvas
          class="puzzle-canvas"
          style="width: 100%; height: 340px; border-radius: 8px; cursor: pointer;"
          {{this.setupCanvas}}
          {{on "click" this.handleCanvasClick}}
        ></canvas>
        <p class="puzzle-hint" style="margin-top: 0.8rem; text-align: center; color: #d4c4a8; font-size: 0.95rem;">
          {{this.message}}
        </p>
        <button type="button" class="puzzle-close" {{on "click" this.close}}>
          Step Back
        </button>
      </div>
    </div>
  </template>
}
