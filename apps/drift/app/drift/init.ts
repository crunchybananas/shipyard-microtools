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

export function initializeDrift(_element: HTMLElement) {
  const canvas = document.getElementById("drift-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
  const status = document.getElementById("status") as HTMLDivElement | null;

  // State
  let particles: Particle[] = [];
  let wells: GravityWell[] = [];
  let animationId = 0;
  let time = 0;
  let paletteKey = "aurora";
  let particleCount = 3000;
  let noiseScale = 0.003;
  let speed = 1.5;
  let trailAlpha = 0.92;
  let wellStrength = 150;
  let attractMode = true;
  let controlsVisible = true;

  // ── Canvas sizing ────────────────────────────────────────────

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas!.width = window.innerWidth * dpr;
    canvas!.height = window.innerHeight * dpr;
    canvas!.style.width = window.innerWidth + "px";
    canvas!.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Particle factory ────────────────────────────────────────

  function randomColor(): string {
    const palette = PALETTES[paletteKey] ?? PALETTES["aurora"]!;
    const c = palette[Math.floor(Math.random() * palette.length)]!;
    const hJitter = c.h + (Math.random() - 0.5) * 20;
    const lJitter = c.l + (Math.random() - 0.5) * 10;
    return `hsl(${hJitter}, ${c.s}%, ${lJitter}%)`;
  }

  function createParticle(): Particle {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: 0,
      vy: 0,
      color: randomColor(),
      alpha: 0.4 + Math.random() * 0.6,
      size: 0.5 + Math.random() * 1.5,
    };
  }

  function spawnParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle());
    }
  }

  // ── Physics ──────────────────────────────────────────────────

  function updateParticles() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = time * 0.0003;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;

      // Noise-driven flow field
      const angle = noise2D(p.x * noiseScale + t, p.y * noiseScale + t) * Math.PI * 4;
      p.vx += Math.cos(angle) * speed * 0.15;
      p.vy += Math.sin(angle) * speed * 0.15;

      // Gravity wells
      for (let j = 0; j < wells.length; j++) {
        const well = wells[j]!;
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
      const maxV = speed * 3;
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

  // ── Rendering ────────────────────────────────────────────────

  function render() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Semi-transparent overlay for trails
    ctx.fillStyle = `rgba(8, 8, 18, ${1 - trailAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw well indicators (subtle rings)
    ctx.globalAlpha = 0.15;
    for (let j = 0; j < wells.length; j++) {
      const well = wells[j]!;
      const age = (time - well.born) * 0.001;
      const pulse = 1 + Math.sin(age * 3) * 0.1;
      ctx.strokeStyle = well.strength > 0 ? "#818cf8" : "#f87171";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(well.x, well.y, 20 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // ── Loop ─────────────────────────────────────────────────────

  function loop(timestamp: number) {
    time = timestamp;
    updateParticles();
    render();
    animationId = requestAnimationFrame(loop);
  }

  // ── Status helper ────────────────────────────────────────────

  function showStatus(message: string) {
    if (!status) return;
    status.textContent = message;
    status.className = "status success";
    setTimeout(() => status.classList.add("hidden"), 2000);
  }

  // ── Controls wiring ─────────────────────────────────────────

  function wireControls() {
    const paletteSelect = document.getElementById("palette") as HTMLSelectElement;
    const particleSlider = document.getElementById("particleCount") as HTMLInputElement;
    const noiseSlider = document.getElementById("noiseScale") as HTMLInputElement;
    const speedSlider = document.getElementById("speed") as HTMLInputElement;
    const trailSlider = document.getElementById("trailLength") as HTMLInputElement;
    const wellSlider = document.getElementById("wellStrength") as HTMLInputElement;
    const toggleWellBtn = document.getElementById("toggleWellMode") as HTMLButtonElement;
    const clearWellsBtn = document.getElementById("clearWells") as HTMLButtonElement;
    const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
    const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
    const toggleCtrlBtn = document.getElementById("toggleControls") as HTMLButtonElement;
    const controlsPanel = document.getElementById("controls") as HTMLDivElement;

    paletteSelect?.addEventListener("change", () => {
      paletteKey = paletteSelect.value;
      // Re-color existing particles gradually
      for (let i = 0; i < particles.length; i += 3) {
        particles[i]!.color = randomColor();
      }
    });

    particleSlider?.addEventListener("input", () => {
      const val = parseInt(particleSlider.value);
      document.getElementById("particleCountVal")!.textContent = String(val);
      if (val > particleCount) {
        for (let i = particleCount; i < val; i++) particles.push(createParticle());
      } else {
        particles.length = val;
      }
      particleCount = val;
    });

    noiseSlider?.addEventListener("input", () => {
      noiseScale = parseFloat(noiseSlider.value);
      document.getElementById("noiseScaleVal")!.textContent = noiseScale.toFixed(3);
    });

    speedSlider?.addEventListener("input", () => {
      speed = parseFloat(speedSlider.value);
      document.getElementById("speedVal")!.textContent = speed.toFixed(1);
    });

    trailSlider?.addEventListener("input", () => {
      trailAlpha = parseFloat(trailSlider.value);
      document.getElementById("trailLengthVal")!.textContent = trailAlpha.toFixed(2);
    });

    wellSlider?.addEventListener("input", () => {
      wellStrength = parseInt(wellSlider.value);
      document.getElementById("wellStrengthVal")!.textContent = String(wellStrength);
    });

    toggleWellBtn?.addEventListener("click", () => {
      attractMode = !attractMode;
      toggleWellBtn.textContent = attractMode ? "🧲 Attract" : "💨 Repel";
    });

    clearWellsBtn?.addEventListener("click", () => {
      wells = [];
      showStatus("Wells cleared");
    });

    resetBtn?.addEventListener("click", () => {
      wells = [];
      seedNoise();
      spawnParticles();
      // Clear canvas fully
      ctx.fillStyle = "rgb(8, 8, 18)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      showStatus("Canvas reset");
    });

    exportBtn?.addEventListener("click", () => {
      // Temporarily hide UI and export
      const link = document.createElement("a");
      link.download = `drift-${Date.now()}.png`;
      link.href = canvas!.toDataURL("image/png");
      link.click();
      showStatus("Exported PNG");
    });

    toggleCtrlBtn?.addEventListener("click", () => {
      controlsVisible = !controlsVisible;
      controlsPanel.classList.toggle("collapsed", !controlsVisible);
    });

    // Canvas click → add gravity well
    canvas!.addEventListener("click", (e: MouseEvent) => {
      // Ignore if click is on controls
      const target = e.target as HTMLElement;
      if (target.closest(".controls-panel")) return;

      wells.push({
        x: e.clientX,
        y: e.clientY,
        strength: attractMode ? wellStrength : -wellStrength,
        radius: 300,
        born: time,
      });
    });

    // Right-click → remove nearest well
    canvas!.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      if (wells.length === 0) return;
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < wells.length; i++) {
        const dx = wells[i]!.x - e.clientX;
        const dy = wells[i]!.y - e.clientY;
        const d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      wells.splice(nearestIdx, 1);
    });
  }

  // ── Init ─────────────────────────────────────────────────────

  seedNoise();
  resize();
  window.addEventListener("resize", resize);

  // Clear to dark
  ctx.fillStyle = "rgb(8, 8, 18)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  spawnParticles();
  wireControls();
  animationId = requestAnimationFrame(loop);

  // Cleanup if element is destroyed
  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resize);
  };
}
