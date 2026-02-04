export class Visualizer {
  ctx: AudioContext;
  analyser: AnalyserNode;
  waveformData: Uint8Array;
  spectrumData: Uint8Array;
  waveformCanvas: HTMLCanvasElement | null = null;
  spectrumCanvas: HTMLCanvasElement | null = null;
  adsrCanvas: HTMLCanvasElement | null = null;
  animationId: number | null = null;
  isRunning = false;
  mode: "waveform" | "spectrum" = "waveform";
  colors = {
    waveform: "#58a6ff",
    spectrum: "#a371f7",
    spectrumGradient: ["#3fb950", "#d29922", "#f85149"],
    background: "#0d1117",
    grid: "#21262d",
    adsr: "#79c0ff",
  };

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.waveformData = new Uint8Array(this.analyser.frequencyBinCount);
    this.spectrumData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  init(
    waveformCanvas: HTMLCanvasElement | null,
    spectrumCanvas: HTMLCanvasElement | null,
    adsrCanvas: HTMLCanvasElement | null
  ) {
    this.waveformCanvas = waveformCanvas;
    this.spectrumCanvas = spectrumCanvas;
    this.adsrCanvas = adsrCanvas;
    this.resizeCanvases();
    this.start();
  }

  resizeCanvases() {
    const resize = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };

    resize(this.waveformCanvas);
    resize(this.spectrumCanvas);
    resize(this.adsrCanvas);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    if (!this.isRunning) return;
    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  draw() {
    this.drawWaveform();
    this.drawSpectrum();
  }

  drawWaveform() {
    const canvas = this.waveformCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    this.analyser.getByteTimeDomainData(this.waveformData);

    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.strokeStyle = this.colors.waveform;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / this.waveformData.length;
    let x = 0;

    for (let i = 0; i < this.waveformData.length; i++) {
      const v = this.waveformData[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowColor = this.colors.waveform;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawSpectrum() {
    const canvas = this.spectrumCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    this.analyser.getByteFrequencyData(this.spectrumData);

    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);

    const barCount = 64;
    const barWidth = width / barCount;
    const gap = 2;

    for (let i = 0; i < barCount; i++) {
      const startBin = Math.floor((i / barCount) * this.spectrumData.length * 0.5);
      const endBin = Math.floor(((i + 1) / barCount) * this.spectrumData.length * 0.5);

      let sum = 0;
      for (let j = startBin; j < endBin; j++) {
        sum += this.spectrumData[j];
      }
      const average = sum / (endBin - startBin);

      const barHeight = (average / 255) * height * 0.9;
      const x = i * barWidth;
      const y = height - barHeight;

      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, this.colors.spectrumGradient[0]);
      gradient.addColorStop(0.5, this.colors.spectrumGradient[1]);
      gradient.addColorStop(1, this.colors.spectrumGradient[2]);

      ctx.fillStyle = gradient;
      ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);
    }
  }

  drawADSR(attack: number, decay: number, sustain: number, release: number) {
    const canvas = this.adsrCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;

    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);

    const totalTime = attack + decay + 0.3 + release;
    const scale = (width - padding * 2) / totalTime;

    const attackEnd = padding + attack * scale;
    const decayEnd = attackEnd + decay * scale;
    const sustainEnd = decayEnd + 0.3 * scale;
    const releaseEnd = sustainEnd + release * scale;

    const top = padding;
    const bottom = height - padding;
    const sustainY = top + (1 - sustain) * (bottom - top);

    ctx.strokeStyle = this.colors.adsr;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, bottom);
    ctx.lineTo(attackEnd, top);
    ctx.lineTo(decayEnd, sustainY);
    ctx.lineTo(sustainEnd, sustainY);
    ctx.lineTo(releaseEnd, bottom);
    ctx.stroke();

    ctx.shadowColor = this.colors.adsr;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(121, 192, 255, 0.1)";
    ctx.lineTo(padding, bottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.colors.adsr;
    const points = [
      [padding, bottom],
      [attackEnd, top],
      [decayEnd, sustainY],
      [sustainEnd, sustainY],
      [releaseEnd, bottom],
    ];

    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  setMode(mode: "waveform" | "spectrum") {
    this.mode = mode;

    if (this.waveformCanvas && this.spectrumCanvas) {
      this.waveformCanvas.style.opacity = mode === "waveform" ? "1" : "0";
      this.spectrumCanvas.style.opacity = mode === "spectrum" ? "1" : "0";
    }
  }

  getPeakLevel() {
    this.analyser.getByteFrequencyData(this.spectrumData);

    let max = 0;
    for (let i = 0; i < this.spectrumData.length; i++) {
      if (this.spectrumData[i] > max) {
        max = this.spectrumData[i];
      }
    }

    return max / 255;
  }

  connect(source: AudioNode) {
    source.connect(this.analyser);
  }

  getInput() {
    return this.analyser;
  }
}
