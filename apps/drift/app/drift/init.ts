// Drift — Generative Particle Art Engine
// Perlin noise + particle system + gravity wells

// ── Simplex-ish noise (fast 2D) ──────────────────────────────────

const PERM = new Uint8Array(512);
const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function seedNoise() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]!;
}

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }

function dot(gi: number, x: number, y: number) {
  const g = GRAD[gi % 8]!;
  return g[0]! * x + g[1]! * y;
}

function noise2D(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = PERM[PERM[xi]! + yi]!;
  const ab = PERM[PERM[xi]! + yi + 1]!;
  const ba = PERM[PERM[xi + 1]! + yi]!;
  const bb = PERM[PERM[xi + 1]! + yi + 1]!;
  return lerp(
    lerp(dot(aa, xf, yf), dot(ba, xf - 1, yf), u),
    lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u),
    v,
  );
}

// ── Color palettes ───────────────────────────────────────────────

interface HSL { h: number; s: number; l: number }

const PALETTES: Record<string, HSL[]> = {
  aurora: [
    { h: 160, s: 90, l: 55 }, { h: 180, s: 85, l: 50 },
    { h: 200, s: 80, l: 60 }, { h: 280, s: 70, l: 55 },
    { h: 130, s: 75, l: 50 }, { h: 220, s: 85, l: 65 },
  ],
  ember: [
    { h: 0, s: 90, l: 50 }, { h: 20, s: 95, l: 55 },
    { h: 40, s: 100, l: 50 }, { h: 350, s: 85, l: 45 },
    { h: 30, s: 90, l: 60 }, { h: 15, s: 100, l: 40 },
  ],
  ocean: [
    { h: 200, s: 85, l: 45 }, { h: 210, s: 90, l: 55 },
    { h: 190, s: 80, l: 50 }, { h: 230, s: 70, l: 60 },
    { h: 180, s: 95, l: 40 }, { h: 220, s: 80, l: 50 },
  ],
  neon: [
    { h: 300, s: 100, l: 60 }, { h: 180, s: 100, l: 50 },
    { h: 60, s: 100, l: 50 }, { h: 330, s: 100, l: 55 },
    { h: 120, s: 100, l: 45 }, { h: 270, s: 100, l: 60 },
  ],
  monochrome: [
    { h: 0, s: 0, l: 90 }, { h: 0, s: 0, l: 75 },
    { h: 0, s: 0, l: 60 }, { h: 0, s: 0, l: 95 },
    { h: 0, s: 0, l: 50 }, { h: 0, s: 0, l: 85 },
  ],
  sunset: [
    { h: 340, s: 90, l: 55 }, { h: 20, s: 95, l: 60 },
    { h: 45, s: 100, l: 55 }, { h: 280, s: 60, l: 45 },
    { h: 0, s: 80, l: 50 }, { h: 35, s: 100, l: 50 },
  ],
  toxic: [
    { h: 100, s: 100, l: 45 }, { h: 130, s: 90, l: 50 },
    { h: 80, s: 95, l: 40 }, { h: 150, s: 85, l: 55 },
    { h: 60, s: 100, l: 50 }, { h: 110, s: 90, l: 35 },
  ],
};

// ── Types ────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface GravityWell {
  x: number;
  y: number;
  strength: number;
  radius: number;
  born: number;
}

// ── Engine ───────────────────────────────────────────────────────

export interface DriftConfig {
  palette: string;
  particleCount: number;
  noiseScale: number;
  speed: number;
  trailAlpha: number;
  wellStrength: number;
  attractMode: boolean;
}

export class DriftEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private wells: GravityWell[] = [];
  private animationId = 0;
  private time = 0;
  private paletteKey: string;
  private particleCount: number;
  private noiseScale: number;
  private speed: number;
  private trailAlpha: number;
  private wellStrength: number;
  private attractMode: boolean;
  private resizeHandler: (() => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private contextHandler: ((e: MouseEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, config: DriftConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: false })!;
    this.paletteKey = config.palette;
    this.particleCount = config.particleCount;
    this.noiseScale = config.noiseScale;
    this.speed = config.speed;
    this.trailAlpha = config.trailAlpha;
    this.wellStrength = config.wellStrength;
    this.attractMode = config.attractMode;
  }

  // ── Public API (called from Ember component) ────────────────

  start() {
    seedNoise();
    this.resize();

    this.resizeHandler = () => this.resize();
    window.addEventListener("resize", this.resizeHandler);

    // Canvas interactions
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".controls-panel")) return;
      this.wells.push({
        x: e.clientX,
        y: e.clientY,
        strength: this.attractMode ? this.wellStrength : -this.wellStrength,
        radius: 300,
        born: this.time,
      });
    };
    this.canvas.addEventListener("click", this.clickHandler);

    this.contextHandler = (e: MouseEvent) => {
      e.preventDefault();
      if (this.wells.length === 0) return;
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < this.wells.length; i++) {
        const dx = this.wells[i]!.x - e.clientX;
        const dy = this.wells[i]!.y - e.clientY;
        const d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      this.wells.splice(nearestIdx, 1);
    };
    this.canvas.addEventListener("contextmenu", this.contextHandler);

    // Clear to dark
    this.ctx.fillStyle = "rgb(8, 8, 18)";
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    this.spawnParticles();
    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    if (this.clickHandler) this.canvas.removeEventListener("click", this.clickHandler);
    if (this.contextHandler) this.canvas.removeEventListener("contextmenu", this.contextHandler);
  }

  setPalette(key: string) {
    this.paletteKey = key;
    // Re-color every 3rd particle for a gradual blend
    for (let i = 0; i < this.particles.length; i += 3) {
      this.particles[i]!.color = this.randomColor();
    }
  }

  setParticleCount(count: number) {
    if (count > this.particleCount) {
      for (let i = this.particleCount; i < count; i++) {
        this.particles.push(this.createParticle());
      }
    } else {
      this.particles.length = count;
    }
    this.particleCount = count;
  }

  setNoiseScale(value: number) { this.noiseScale = value; }
  setSpeed(value: number) { this.speed = value; }
  setTrailAlpha(value: number) { this.trailAlpha = value; }
  setWellStrength(value: number) { this.wellStrength = value; }
  setAttractMode(attract: boolean) { this.attractMode = attract; }

  clearWells() { this.wells = []; }

  reset() {
    this.wells = [];
    seedNoise();
    this.spawnParticles();
    this.ctx.fillStyle = "rgb(8, 8, 18)";
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  exportPNG() {
    const link = document.createElement("a");
    link.download = `drift-${Date.now()}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }

  // ── Private ──────────────────────────────────────────────────

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private randomColor(): string {
    const palette = PALETTES[this.paletteKey] ?? PALETTES["aurora"]!;
    const c = palette[Math.floor(Math.random() * palette.length)]!;
    const hJitter = c.h + (Math.random() - 0.5) * 20;
    const lJitter = c.l + (Math.random() - 0.5) * 10;
    return `hsl(${hJitter}, ${c.s}%, ${lJitter}%)`;
  }

  private createParticle(): Particle {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: 0,
      vy: 0,
      color: this.randomColor(),
      alpha: 0.4 + Math.random() * 0.6,
      size: 0.5 + Math.random() * 1.5,
    };
  }

  private spawnParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private updateParticles() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = this.time * 0.0003;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;

      // Noise-driven flow field
      const angle = noise2D(p.x * this.noiseScale + t, p.y * this.noiseScale + t) * Math.PI * 4;
      p.vx += Math.cos(angle) * this.speed * 0.15;
      p.vy += Math.sin(angle) * this.speed * 0.15;

      // Gravity wells
      for (let j = 0; j < this.wells.length; j++) {
        const well = this.wells[j]!;
        const dx = well.x - p.x;
        const dy = well.y - p.y;
        const distSq = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(distSq);
        if (dist < well.radius) {
          const force = well.strength / distSq;
          p.vx += dx * force;
          p.vy += dy * force;
        }
      }

      // Damping
      p.vx *= 0.97;
      p.vy *= 0.97;

      // Clamp velocity
      const maxV = this.speed * 3;
      const vm = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (vm > maxV) {
        p.vx = (p.vx / vm) * maxV;
        p.vy = (p.vy / vm) * maxV;
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x < 0) p.x += w;
      if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      if (p.y > h) p.y -= h;
    }
  }

  private render() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Semi-transparent overlay for trails
    this.ctx.fillStyle = `rgba(8, 8, 18, ${1 - this.trailAlpha})`;
    this.ctx.fillRect(0, 0, w, h);

    // Draw particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw well indicators (subtle rings)
    this.ctx.globalAlpha = 0.15;
    for (let j = 0; j < this.wells.length; j++) {
      const well = this.wells[j]!;
      const age = (this.time - well.born) * 0.001;
      const pulse = 1 + Math.sin(age * 3) * 0.1;
      this.ctx.strokeStyle = well.strength > 0 ? "#818cf8" : "#f87171";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(well.x, well.y, 20 * pulse, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
  }

  private loop(timestamp: number) {
    this.time = timestamp;
    this.updateParticles();
    this.render();
    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }
}
