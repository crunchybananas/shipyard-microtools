/**
 * Synth Studio - Visualizer
 * Real-time waveform oscilloscope and FFT spectrum analyzer
 */

class Visualizer {
  constructor(audioContext) {
    this.ctx = audioContext;
    
    // Create analyser nodes
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    // Data buffers
    this.waveformData = new Uint8Array(this.analyser.frequencyBinCount);
    this.spectrumData = new Uint8Array(this.analyser.frequencyBinCount);
    
    // Canvas references
    this.waveformCanvas = null;
    this.spectrumCanvas = null;
    this.adsrCanvas = null;
    
    // Animation
    this.animationId = null;
    this.isRunning = false;
    
    // Display mode
    this.mode = 'waveform'; // 'waveform' or 'spectrum'
    
    // Colors
    this.colors = {
      waveform: '#58a6ff',
      spectrum: '#a371f7',
      spectrumGradient: ['#3fb950', '#d29922', '#f85149'],
      background: '#0d1117',
      grid: '#21262d',
      adsr: '#79c0ff'
    };
  }
  
  /**
   * Initialize canvas elements
   */
  init(waveformCanvas, spectrumCanvas, adsrCanvas) {
    this.waveformCanvas = waveformCanvas;
    this.spectrumCanvas = spectrumCanvas;
    this.adsrCanvas = adsrCanvas;
    
    // Set canvas sizes
    this.resizeCanvases();
    
    // Start animation
    this.start();
  }
  
  /**
   * Resize canvases to match display size
   */
  resizeCanvases() {
    const resize = (canvas) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };
    
    resize(this.waveformCanvas);
    resize(this.spectrumCanvas);
    resize(this.adsrCanvas);
  }
  
  /**
   * Start visualization
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }
  
  /**
   * Stop visualization
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * Animation loop
   */
  animate() {
    if (!this.isRunning) return;
    
    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  /**
   * Main draw function
   */
  draw() {
    this.drawWaveform();
    this.drawSpectrum();
  }
  
  /**
   * Draw waveform oscilloscope
   */
  drawWaveform() {
    const canvas = this.waveformCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Get waveform data
    this.analyser.getByteTimeDomainData(this.waveformData);
    
    // Clear
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Draw waveform
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
    
    // Add glow effect
    ctx.shadowColor = this.colors.waveform;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  
  /**
   * Draw frequency spectrum
   */
  drawSpectrum() {
    const canvas = this.spectrumCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.spectrumData);
    
    // Clear
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw spectrum bars
    const barCount = 64;
    const barWidth = width / barCount;
    const gap = 2;
    
    for (let i = 0; i < barCount; i++) {
      // Average frequency bins for this bar
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
      
      // Create gradient based on height
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, this.colors.spectrumGradient[0]);
      gradient.addColorStop(0.5, this.colors.spectrumGradient[1]);
      gradient.addColorStop(1, this.colors.spectrumGradient[2]);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);
    }
  }
  
  /**
   * Draw ADSR envelope visualization
   */
  drawADSR(attack, decay, sustain, release) {
    const canvas = this.adsrCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;
    
    // Clear
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);
    
    // Calculate positions
    const totalTime = attack + decay + 0.3 + release; // 0.3 for sustain hold
    const scale = (width - padding * 2) / totalTime;
    
    const attackEnd = padding + attack * scale;
    const decayEnd = attackEnd + decay * scale;
    const sustainEnd = decayEnd + 0.3 * scale;
    const releaseEnd = sustainEnd + release * scale;
    
    const top = padding;
    const bottom = height - padding;
    const sustainY = top + (1 - sustain) * (bottom - top);
    
    // Draw envelope shape
    ctx.strokeStyle = this.colors.adsr;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Start
    ctx.moveTo(padding, bottom);
    
    // Attack
    ctx.lineTo(attackEnd, top);
    
    // Decay
    ctx.lineTo(decayEnd, sustainY);
    
    // Sustain hold
    ctx.lineTo(sustainEnd, sustainY);
    
    // Release
    ctx.lineTo(releaseEnd, bottom);
    
    ctx.stroke();
    
    // Add glow
    ctx.shadowColor = this.colors.adsr;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Fill under curve
    ctx.fillStyle = 'rgba(121, 192, 255, 0.1)';
    ctx.lineTo(padding, bottom);
    ctx.closePath();
    ctx.fill();
    
    // Draw points
    ctx.fillStyle = this.colors.adsr;
    const points = [
      [padding, bottom],
      [attackEnd, top],
      [decayEnd, sustainY],
      [sustainEnd, sustainY],
      [releaseEnd, bottom]
    ];
    
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  /**
   * Set display mode
   */
  setMode(mode) {
    this.mode = mode;
    
    if (this.waveformCanvas && this.spectrumCanvas) {
      this.waveformCanvas.style.opacity = mode === 'waveform' ? '1' : '0';
      this.spectrumCanvas.style.opacity = mode === 'spectrum' ? '1' : '0';
    }
  }
  
  /**
   * Get peak level (for meter)
   */
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
  
  /**
   * Connect to audio source
   */
  connect(source) {
    source.connect(this.analyser);
  }
  
  /**
   * Get input node for connecting
   */
  getInput() {
    return this.analyser;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Visualizer = Visualizer;
}
