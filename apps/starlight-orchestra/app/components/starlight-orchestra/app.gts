import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface OrbitalNote {
  id: number;
  angle: number;
  radius: number;
  speed: number;
  hue: number;
  size: number;
  noteIndex: number;
  lastTriggerTime: number;
}

const SCALE = [0, 3, 5, 7, 10, 12, 15];
const PULSE_OFFSETS = [0, 0.25, 0.5, 0.75];

const hexToRgb = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
};

export default class StarlightOrchestraApp extends Component {
  @tracked audioEnabled = false;
  @tracked showTrails = true;
  @tracked showOrbits = true;
  @tracked showConstellations = true;
  @tracked pulseSpeed = 0.6;
  @tracked orbitSpeed = 0.7;
  @tracked brushDensity = 0.6;
  @tracked masterVolume = 0.35;
  @tracked paletteId = "aurora";
  @tracked starCount = 0;
  @tracked noteCount = 0;

  canvasElement: HTMLCanvasElement | null = null;
  canvasContext: CanvasRenderingContext2D | null = null;
  canvasWidth = 0;
  canvasHeight = 0;
  animationFrame = 0;
  lastFrameTime = 0;
  lastSpawnTime = 0;
  stars: OrbitalNote[] = [];
  starId = 0;
  isDrawing = false;

  audioContext: AudioContext | null = null;
  masterGain: GainNode | null = null;

  paletteOptions = [
    { id: "aurora", label: "Aurora Veil", accent: "#7ad7ff", glow: "#7bffba" },
    { id: "ember", label: "Ember Rift", accent: "#ff9b7b", glow: "#ff7ad1" },
    { id: "neon", label: "Neon Drift", accent: "#8b7bff", glow: "#7ad1ff" },
    { id: "obsidian", label: "Obsidian Tide", accent: "#c3d4ff", glow: "#7a9bff" },
  ];

  setupCanvas = modifier((element: HTMLElement) => {
    const canvas = element.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    this.canvasElement = canvas;
    this.canvasContext = canvas.getContext("2d");
    this.handleResize();
    this.applyPalette();
    this.startAnimation();

    window.addEventListener("resize", this.handleResize);

    return () => {
      window.removeEventListener("resize", this.handleResize);
      cancelAnimationFrame(this.animationFrame);
      this.audioContext?.close();
    };
  });

  handleResize = (): void => {
    if (!this.canvasElement || !this.canvasContext) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    this.canvasElement.width = rect.width * ratio;
    this.canvasElement.height = rect.height * ratio;
    this.canvasContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    this.drawBackdrop();
  };

  startAnimation = (): void => {
    this.lastFrameTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.animateScene);
  };

  animateScene = (time: number): void => {
    if (!this.canvasContext) return;

    const delta = time - this.lastFrameTime;
    this.lastFrameTime = time;

    this.updateScene(delta, time);

    this.animationFrame = requestAnimationFrame(this.animateScene);
  };

  updateScene = (delta: number, time: number): void => {
    if (!this.canvasContext) return;

    if (this.showTrails) {
      this.canvasContext.fillStyle = "rgba(4, 8, 18, 0.18)";
      this.canvasContext.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    } else {
      this.drawBackdrop();
    }

    this.drawPulses(time);
    this.drawOrbits();
    this.updateStars(delta, time);

    if (this.showConstellations) {
      this.drawConstellations();
    }
  };

  drawBackdrop = (): void => {
    const ctx = this.canvasContext;
    if (!ctx) return;
    const gradient = ctx.createRadialGradient(
      this.canvasWidth * 0.5,
      this.canvasHeight * 0.45,
      40,
      this.canvasWidth * 0.5,
      this.canvasHeight * 0.45,
      this.canvasWidth * 0.7,
    );
    gradient.addColorStop(0, "rgba(40, 50, 90, 0.65)");
    gradient.addColorStop(1, "rgba(6, 8, 16, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  };

  drawPulses = (time: number): void => {
    const ctx = this.canvasContext;
    if (!ctx) return;
    const maxRadius = this.maxRadius;
    const pulseRate = time * 0.00008 * this.pulseSpeed;
    const pulseColor = hexToRgb(this.currentPalette.accent);

    PULSE_OFFSETS.forEach((offset, index) => {
      const radius = ((pulseRate + offset) % 1) * maxRadius;
      const alpha = 0.2 + 0.2 * (index / PULSE_OFFSETS.length);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${pulseColor}, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  };

  drawOrbits = (): void => {
    const ctx = this.canvasContext;
    if (!ctx || !this.showOrbits) return;
    ctx.strokeStyle = "rgba(120, 140, 220, 0.18)";
    ctx.lineWidth = 1;

    for (let i = 1; i <= 5; i += 1) {
      const radius = (this.maxRadius / 5) * i;
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  updateStars = (delta: number, time: number): void => {
    const ctx = this.canvasContext;
    if (!ctx) return;

    const maxRadius = this.maxRadius;
    const pulseRate = time * 0.00008 * this.pulseSpeed;

    for (const star of this.stars) {
      star.angle += delta * star.speed * this.orbitSpeed * 0.7;
      const x = this.centerX + Math.cos(star.angle) * star.radius;
      const y = this.centerY + Math.sin(star.angle) * star.radius;

      ctx.beginPath();
      ctx.fillStyle = `hsla(${star.hue}, 85%, 70%, 0.9)`;
      ctx.shadowColor = `hsla(${star.hue}, 90%, 65%, 0.8)`;
      ctx.shadowBlur = 14;
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      PULSE_OFFSETS.forEach((offset) => {
        const radius = ((pulseRate + offset) % 1) * maxRadius;
        if (Math.abs(star.radius - radius) < 8 && time - star.lastTriggerTime > 140) {
          star.lastTriggerTime = time;
          this.playNote(star, 0.8 - star.radius / maxRadius);
        }
      });
    }
  };

  drawConstellations = (): void => {
    const ctx = this.canvasContext;
    if (!ctx || this.stars.length < 2) return;

    ctx.strokeStyle = "rgba(120, 200, 255, 0.25)";
    ctx.lineWidth = 0.8;

    for (let i = 0; i < this.stars.length; i += 1) {
      const source = this.stars[i];
      if (!source) continue;
      let nearest: OrbitalNote | null = null;
      let nearestDistance = Infinity;

      for (let j = i + 1; j < this.stars.length; j += 1) {
        const target = this.stars[j];
        if (!target) continue;
        const distance = Math.abs(source.radius - target.radius);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = target;
        }
      }

      if (nearest && nearestDistance < this.maxRadius * 0.2) {
        const sourceX = this.centerX + Math.cos(source.angle) * source.radius;
        const sourceY = this.centerY + Math.sin(source.angle) * source.radius;
        const targetX = this.centerX + Math.cos(nearest.angle) * nearest.radius;
        const targetY = this.centerY + Math.sin(nearest.angle) * nearest.radius;

        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }
    }
  };

  playNote = (star: OrbitalNote, velocity: number): void => {
    if (!this.audioEnabled || !this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    const frequency = this.noteFrequency(star);

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200 + star.hue * 2, now);

    const volume = Math.max(0.05, 0.25 * (1 - velocity));
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + 0.5);

    this.noteCount += 1;
  };

  noteFrequency = (star: OrbitalNote): number => {
    const base = 196;
    const octave = star.radius > this.maxRadius * 0.7 ? 0 : 1;
    const semitone = (SCALE[star.noteIndex % SCALE.length] ?? 0) + octave * 12;
    return base * Math.pow(2, semitone / 12);
  };

  get centerX(): number {
    return this.canvasWidth / 2;
  }

  get centerY(): number {
    return this.canvasHeight / 2;
  }

  get maxRadius(): number {
    return Math.min(this.canvasWidth, this.canvasHeight) * 0.42;
  }

  handlePointerDown = (event: PointerEvent): void => {
    if (!this.canvasElement) return;
    this.isDrawing = true;
    this.canvasElement.setPointerCapture(event.pointerId);
    this.spawnFromPointer(event, true);
  };

  handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) return;
    this.spawnFromPointer(event, false);
  };

  handlePointerUp = (event: PointerEvent): void => {
    if (!this.canvasElement) return;
    this.isDrawing = false;
    this.canvasElement.releasePointerCapture(event.pointerId);
  };

  spawnFromPointer = (event: PointerEvent, force: boolean): void => {
    if (!this.canvasElement) return;
    const now = performance.now();
    const interval = 80 - this.brushDensity * 60;
    if (!force && now - this.lastSpawnTime < interval) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.addStar(x, y);
    this.lastSpawnTime = now;
  };

  addStar = (x: number, y: number): void => {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const radius = Math.hypot(dx, dy);
    if (radius < 20 || radius > this.maxRadius) return;

    const hue = (x / this.canvasWidth) * 360;
    const noteIndex = Math.max(
      0,
      Math.min(SCALE.length - 1, Math.floor(((this.canvasHeight - y) / this.canvasHeight) * SCALE.length)),
    );

    const star: OrbitalNote = {
      id: this.starId,
      angle: Math.atan2(dy, dx),
      radius,
      speed: 0.0004 + (1 - radius / this.maxRadius) * 0.0007,
      hue,
      size: 1.6 + (1 - radius / this.maxRadius) * 2.6,
      noteIndex,
      lastTriggerTime: 0,
    };

    this.stars.push(star);
    this.starId += 1;
    if (this.stars.length > 120) {
      this.stars.shift();
    }
    this.starCount = this.stars.length;
  };

  enableAudio = (): void => {
    if (this.audioEnabled) {
      this.audioEnabled = false;
      this.masterGain?.gain.setValueAtTime(0, this.audioContext?.currentTime ?? 0);
      return;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
    }

    this.masterGain?.gain.setValueAtTime(
      this.masterVolume,
      this.audioContext?.currentTime ?? 0,
    );

    this.audioEnabled = true;
  };

  clearStars = (): void => {
    this.stars = [];
    this.starCount = 0;
  };

  randomize = (): void => {
    if (!this.canvasWidth) return;
    const count = 30 + Math.floor(Math.random() * 40);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * (this.maxRadius - 20);
      const x = this.centerX + Math.cos(angle) * radius;
      const y = this.centerY + Math.sin(angle) * radius;
      this.addStar(x, y);
    }
  };

  updatePulseSpeed = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.pulseSpeed = Number(target.value);
  };

  updateOrbitSpeed = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.orbitSpeed = Number(target.value);
  };

  updateBrushDensity = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.brushDensity = Number(target.value);
  };

  updateMasterVolume = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.masterVolume = Number(target.value);
    if (this.audioEnabled && this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        this.masterVolume,
        this.audioContext?.currentTime ?? 0,
      );
    }
  };

  updatePalette = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    this.paletteId = target.value;
    this.applyPalette();
  };

  applyPalette = (): void => {
    const palette = this.currentPalette;
    document.documentElement.style.setProperty("--accent", palette.accent);
    document.documentElement.style.setProperty("--accent-2", palette.glow);
    document.documentElement.style.setProperty(
      "--glow",
      `rgba(${hexToRgb(palette.accent)}, 0.35)`,
    );
  };

  get currentPalette(): { id: string; label: string; accent: string; glow: string } {
    return (
      this.paletteOptions.find((option) => option.id === this.paletteId) ??
      this.paletteOptions[0] ??
      {
        id: "aurora",
        label: "Aurora Veil",
        accent: "#7ad7ff",
        glow: "#7bffba",
      }
    );
  }

  get paletteLabel(): string {
    return this.paletteOptions.find((option) => option.id === this.paletteId)?.label ?? "Aurora Veil";
  }

  get audioButtonLabel(): string {
    return this.audioEnabled ? "Mute Audio" : "Enable Audio";
  }

  get canRandomize(): boolean {
    return this.canvasWidth > 0;
  }

  toggleTrails = (event: Event): void => {
    this.showTrails = (event.target as HTMLInputElement).checked;
  };

  toggleOrbits = (event: Event): void => {
    this.showOrbits = (event.target as HTMLInputElement).checked;
  };

  toggleConstellations = (event: Event): void => {
    this.showConstellations = (event.target as HTMLInputElement).checked;
  };

  <template>
    <div class="app" ...attributes {{this.setupCanvas}}>
      <header class="hero">
        <div>
          <a class="badge" href="../">← All Tools</a>
          <h1>Starlight Orchestra</h1>
          <p>
            Paint constellations, then watch them orbit into a living score.
            Each pulse ring is a conductor, each orbit a voice. Drag to compose.
          </p>
        </div>
        <div class="hero-actions">
          <button type="button" class="btn primary" {{on "click" this.enableAudio}}>
            {{this.audioButtonLabel}}
          </button>
          <button type="button" class="btn" {{on "click" this.randomize}}>
            Seed a Constellation
          </button>
          <button type="button" class="btn ghost" {{on "click" this.clearStars}}>Clear Sky</button>
        </div>
      </header>

      <section class="layout">
        <aside class="panel">
          <h2>Conductor Controls</h2>

          <label class="control">
            Pulse Speed
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={{this.pulseSpeed}}
              {{on "input" this.updatePulseSpeed}}
            />
          </label>

          <label class="control">
            Orbit Drift
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={{this.orbitSpeed}}
              {{on "input" this.updateOrbitSpeed}}
            />
          </label>

          <label class="control">
            Brush Density
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={{this.brushDensity}}
              {{on "input" this.updateBrushDensity}}
            />
          </label>

          <label class="control">
            Master Volume
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.01"
              value={{this.masterVolume}}
              {{on "input" this.updateMasterVolume}}
            />
          </label>

          <label class="control">
            Palette
            <select class="select" value={{this.paletteId}} {{on "change" this.updatePalette}}>
              {{#each this.paletteOptions as |palette|}}
                <option value={{palette.id}}>
                  {{palette.label}}
                </option>
              {{/each}}
            </select>
          </label>

          <div class="toggle">
            <input id="trails" type="checkbox" checked={{this.showTrails}} {{on "change" this.toggleTrails}} />
            <label for="trails">Trails</label>
          </div>
          <div class="toggle">
            <input id="orbits" type="checkbox" checked={{this.showOrbits}} {{on "change" this.toggleOrbits}} />
            <label for="orbits">Orbit Rings</label>
          </div>
          <div class="toggle">
            <input
              id="constellations"
              type="checkbox"
              checked={{this.showConstellations}}
              {{on "change" this.toggleConstellations}}
            />
            <label for="constellations">Constellation Links</label>
          </div>
        </aside>

        <div class="canvas-shell">
          <canvas
            class="canvas-stage"
            {{on "pointerdown" this.handlePointerDown}}
            {{on "pointermove" this.handlePointerMove}}
            {{on "pointerup" this.handlePointerUp}}
            {{on "pointerleave" this.handlePointerUp}}
          ></canvas>
          <div class="hint">
            Click or drag to place stars · Pulse rings trigger tones · {{this.paletteLabel}}
          </div>
        </div>

        <aside class="panel">
          <h2>Sky Metrics</h2>
          <div class="stats">
            <div class="stat-card">
              <span>Stars</span>
              <strong>{{this.starCount}}</strong>
            </div>
            <div class="stat-card">
              <span>Notes Fired</span>
              <strong>{{this.noteCount}}</strong>
            </div>
          </div>

          <div>
            <h2>Guidance</h2>
            <p class="control">
              Use slow pulses for ambient pads. Speed up to create shimmering arpeggios. Mixing
              dense inner orbits with sparse outer notes creates contrast.
            </p>
          </div>
        </aside>
      </section>

      <footer class="footer">
        Part of <a href="https://shipyard.bot">Shipyard</a> Microtools
      </footer>
    </div>
  </template>
}
