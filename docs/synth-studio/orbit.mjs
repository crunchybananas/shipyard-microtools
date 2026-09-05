import { TRACKS, audible } from "./score.mjs";

// A score you can see: one orbit per voice, sixteen possible note positions.
// Animation follows the transport; the spectral deformation is measured audio.
export class Orbit {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.dirty = true;
    this.last = 0;
    this.pulses = Array(6).fill(0);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.reduced.addEventListener("change", () => {
      this.dirty = true;
    });
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(),
      scale = Math.min(devicePixelRatio, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.scale = scale;
    this.canvas.width = Math.round(rect.width * scale);
    this.canvas.height = Math.round(rect.height * scale);
    this.dirty = true;
  }
  trigger(events) {
    events.forEach((event) => (this.pulses[event.track] = event.velocity));
    this.dirty = true;
  }
  draw(project, { playing, step, phase, spectrum }, now) {
    if (
      document.hidden ||
      now - this.last < 32 ||
      (!playing && !this.dirty && this.pulses.every((p) => p < 0.005))
    )
      return;
    this.last = now;
    this.dirty = false;
    const ctx = this.ctx,
      w = this.width,
      h = this.height,
      mobile = w < 520;
    if (!w || !h) return;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = mobile ? w * 0.66 : w * 0.51,
      cy = mobile ? 181 : h * 0.46;
    const radius = mobile ? 133 : Math.min(w * 0.23, h * 0.6),
      tilt = -0.4;
    const energy = spectrum
      ? spectrum.slice(0, 30).reduce((sum, n) => sum + n, 0) / (30 * 255)
      : 0;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.5);
    glow.addColorStop(0, "#18254400");
    glow.addColorStop(0.4, `rgba(39,93,131,${0.045 + energy * 0.055})`);
    glow.addColorStop(1, "#080e1a00");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const rotate = this.reduced.matches
      ? 0
      : playing
        ? (phase * Math.PI) / 40
        : 0;
    const scene = project.scenes[project.scene];
    const position = (angle, orbit, strand = 0) => {
      const ring = radius * (0.57 + orbit * 0.077 + strand * 0.0038);
      const spectral =
        spectrum && !this.reduced.matches
          ? spectrum[
              Math.floor(
                (((angle + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2)) * 100,
              )
            ] / 255
          : 0;
      const ripple = !this.reduced.matches
        ? Math.sin(angle * 7 + orbit * 0.8 + rotate * 6) *
          (1.3 + spectral * 10 + this.pulses[orbit] * 3)
        : 0;
      const a = angle + rotate * (orbit % 2 ? 1 : -0.6);
      const x = Math.cos(a) * (ring + ripple);
      const y =
        Math.sin(a) * (ring * (0.48 + orbit * 0.033)) +
        Math.sin(a * 3 + orbit * 0.65 + strand * 0.07) * radius * 0.036;
      return {
        x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
        y: cy + x * Math.sin(tilt) + y * Math.cos(tilt),
        front: Math.sin(a) > 0,
      };
    };
    ctx.globalCompositeOperation = "screen";
    for (let track = 5; track >= 0; track--) {
      const color = TRACKS[track].color,
        enabled = audible(project, track);
      for (let strand = -6; strand <= 6; strand++) {
        ctx.beginPath();
        for (let segment = 0; segment <= 180; segment++) {
          const p = position((segment / 180) * Math.PI * 2, track, strand);
          if (segment === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = enabled
          ? strand === 0
            ? 0.72
            : 0.12 + energy * 0.1
          : 0.055;
        ctx.lineWidth = strand === 0 ? 1 : 0.65;
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const cell = scene.patterns[track][i],
          p = position((i / 16) * Math.PI * 2 - Math.PI / 2, track);
        const active = playing && i === step && enabled && cell.v;
        ctx.globalAlpha = enabled ? (cell.v ? 0.76 : 0.12) : 0.08;
        if (cell.v && enabled) {
          const r = active ? 24 : 7 + cell.v * 7;
          const bloom = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          bloom.addColorStop(0, color + (active ? "b0" : "35"));
          bloom.addColorStop(1, color + "00");
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = active ? "#f2fbff" : color;
        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          cell.v ? (active ? 3.2 : 1.3 + cell.v) : 0.65,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      this.pulses[track] *= 0.88;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // The center shows the musical phase, with no moving clock at rest.
    ctx.textAlign = "center";
    ctx.fillStyle = "#a7bdd66b";
    ctx.font = '9px "Avenir Next", sans-serif';
    ctx.fillText(
      playing ? `${Math.floor(step / 4) + 1}  /  4` : "P R E S S   P L A Y",
      cx,
      cy + 3,
    );
  }
}
