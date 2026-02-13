// Cosmos WebGL2 Rendering Engine
// Instanced particle rendering for galaxies and stars with bloom post-processing

import {
  FULLSCREEN_VERT,
  BACKGROUND_FRAG,
  PARTICLE_VERT,
  PARTICLE_FRAG,
  BLOOM_BRIGHT_FRAG,
  BLOOM_BLUR_FRAG,
  BLOOM_COMPOSITE_FRAG,
  PLANET_VERT,
  PLANET_FRAG,
  GALAXY_DISC_FRAG,
  NEBULA_FRAG,
  TERRAIN_FRAG,
  ATMOSPHERE_FRAG,
} from './shaders';

// ─── INLINE_SHADERS_REMOVED ─────────────────────────────────────────────────
// All 13 GLSL shaders have been extracted to ./shaders/ directory.
// See shaders/index.ts for the full list.

// ─── WebGL Helpers ───────────────────────────────────────────────────────────

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attribs: Record<string, number>;
}

interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface ParticleData {
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  glows: Float32Array;
  count: number;
}

// ─── Engine Class ────────────────────────────────────────────────────────────

export class CosmosEngine {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private animationId: number | null = null;

  // Shader programs
  private bgProgram: ShaderProgram | null = null;
  private particleProgram: ShaderProgram | null = null;
  private bloomBrightProgram: ShaderProgram | null = null;
  private bloomBlurProgram: ShaderProgram | null = null;
  private bloomCompositeProgram: ShaderProgram | null = null;
  private planetProgram: ShaderProgram | null = null;
  private terrainProgram: ShaderProgram | null = null;
  private atmosphereProgram: ShaderProgram | null = null;
  private nebulaProgram: ShaderProgram | null = null;
  private galaxyDiscProgram: ShaderProgram | null = null;

  // Geometry
  private quadVAO: WebGLVertexArrayObject | null = null;
  private particleVAO: WebGLVertexArrayObject | null = null;
  private planetVAO: WebGLVertexArrayObject | null = null;

  // Instance buffers
  private positionBuffer: WebGLBuffer | null = null;
  private sizeBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private glowBuffer: WebGLBuffer | null = null;

  // FBOs for bloom
  private sceneFBO: FBO | null = null;
  private brightFBO: FBO | null = null;
  private blurFBOs: FBO[] = [];

  // State
  private width = 0;
  private height = 0;
  private time = 0;
  private bloomEnabled = true;
  private bloomStrength = 0.35;
  private bloomThreshold = 0.4;
  private canRenderToFloat = false;

  // Max particles we can render in one draw call
  private maxParticles = 200000;

  // ─── Public API ──────────────────────────────────────────────────────────

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.error('WebGL2 not supported');
      return false;
    }

    this.gl = gl;

    // Enable float framebuffer rendering if supported
    this.canRenderToFloat = !!gl.getExtension('EXT_color_buffer_float');

    this.resize();

    // Compile all shader programs
    this.bgProgram = this.createProgram(FULLSCREEN_VERT, BACKGROUND_FRAG,
      ['uResolution', 'uTime'], []);
    this.particleProgram = this.createProgram(PARTICLE_VERT, PARTICLE_FRAG,
      ['uResolution', 'uCameraPos', 'uZoom'],
      ['aQuadPos', 'aPosition', 'aSize', 'aColor', 'aGlow']);
    this.bloomBrightProgram = this.createProgram(FULLSCREEN_VERT, BLOOM_BRIGHT_FRAG,
      ['uScene', 'uThreshold'], []);
    this.bloomBlurProgram = this.createProgram(FULLSCREEN_VERT, BLOOM_BLUR_FRAG,
      ['uTexture', 'uDirection', 'uResolution'], []);
    this.bloomCompositeProgram = this.createProgram(FULLSCREEN_VERT, BLOOM_COMPOSITE_FRAG,
      ['uScene', 'uBloom', 'uBloomStrength'], []);
    this.planetProgram = this.createProgram(PLANET_VERT, PLANET_FRAG,
      ['uCenter', 'uRadius', 'uResolution', 'uColor', 'uLightDir',
        'uHasAtmosphere', 'uAtmosphereColor', 'uPlanetType', 'uSeed', 'uTime'],
      ['aPosition']);

    this.terrainProgram = this.createProgram(FULLSCREEN_VERT, TERRAIN_FRAG,
      ['uResolution', 'uCameraPos', 'uZoom', 'uSeed', 'uTime',
        'uBaseColor', 'uAccentColor', 'uWaterLevel', 'uWaterColor',
        'uHasVegetation', 'uVegetationColor', 'uRoughness', 'uLightDir',
        'uAtmosphereDensity', 'uAtmosphereHue', 'uLookAngle', 'uLookPitch'],
      []);

    this.atmosphereProgram = this.createProgram(FULLSCREEN_VERT, ATMOSPHERE_FRAG,
      ['uResolution', 'uAltitude', 'uDensity', 'uHue', 'uStarColor',
        'uTime', 'uPlanetRadius'],
      []);

    this.nebulaProgram = this.createProgram(FULLSCREEN_VERT, NEBULA_FRAG,
      ['uResolution', 'uCameraPos', 'uZoom', 'uTime', 'uIntensity'],
      []);

    this.galaxyDiscProgram = this.createProgram(FULLSCREEN_VERT, GALAXY_DISC_FRAG,
      ['uResolution', 'uCenterPx', 'uRadiusPx', 'uRotation', 'uTilt',
        'uArmCount', 'uArmDef', 'uBrightness', 'uSeed', 'uGalaxyType'],
      []);

    if (!this.bgProgram || !this.particleProgram || !this.bloomBrightProgram ||
      !this.bloomBlurProgram || !this.bloomCompositeProgram || !this.planetProgram ||
      !this.terrainProgram || !this.atmosphereProgram || !this.nebulaProgram ||
      !this.galaxyDiscProgram) {
      console.error('Failed to compile shaders');
      return false;
    }

    // Setup geometry and buffers
    this.setupFullscreenQuad();
    this.setupParticleBuffers();
    this.setupPlanetGeometry();

    // GL state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  resize(): void {
    if (!this.canvas || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.width = Math.floor(this.canvas.clientWidth * dpr);
    this.height = Math.floor(this.canvas.clientHeight * dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.gl.viewport(0, 0, this.width, this.height);
    this.createFBOs();
  }

  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.deleteFBOs();
    this.gl = null;
    this.canvas = null;
  }

  setBloom(enabled: boolean, strength?: number, threshold?: number): void {
    this.bloomEnabled = enabled;
    if (strength !== undefined) this.bloomStrength = strength;
    if (threshold !== undefined) this.bloomThreshold = threshold;
  }

  // ─── Render Methods ──────────────────────────────────────────────────────

  /**
   * Render a complete frame. Called by the Ember component's render loop.
   * The component decides WHAT to render; the engine just draws it.
   */
  beginFrame(): void {
    if (!this.gl) return;
    const gl = this.gl;

    this.time += 0.016;

    // Render to scene FBO if bloom is enabled
    if (this.bloomEnabled && this.sceneFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.framebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawBackground(): void {
    if (!this.gl || !this.bgProgram) return;
    const gl = this.gl;
    const p = this.bgProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform1f(p.uniforms.uTime!, this.time);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawParticles(data: ParticleData, cameraX: number, cameraY: number, zoom: number): void {
    if (!this.gl || !this.particleProgram || data.count === 0) return;
    const gl = this.gl;
    const p = this.particleProgram;

    // Switch to additive blending for stars/galaxies
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCameraPos!, cameraX, cameraY);
    gl.uniform1f(p.uniforms.uZoom!, zoom);

    // Upload instance data
    const count = Math.min(data.count, this.maxParticles);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions.subarray(0, count * 2), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.sizes.subarray(0, count), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.colors.subarray(0, count * 4), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.glows.subarray(0, count), gl.DYNAMIC_DRAW);

    gl.bindVertexArray(this.particleVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);

    // Restore normal blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  drawPlanetSphere(
    centerX: number, centerY: number, radius: number,
    color: [number, number, number],
    lightDir: [number, number, number],
    hasAtmosphere: boolean,
    atmosphereColor: [number, number, number],
    planetTypeIndex: number,
    seed: number,
  ): void {
    if (!this.gl || !this.planetProgram || radius < 2) return;
    const gl = this.gl;
    const p = this.planetProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uCenter!, centerX, centerY);
    gl.uniform1f(p.uniforms.uRadius!, radius);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform3f(p.uniforms.uColor!, color[0], color[1], color[2]);
    gl.uniform3f(p.uniforms.uLightDir!, lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform1f(p.uniforms.uHasAtmosphere!, hasAtmosphere ? 1.0 : 0.0);
    gl.uniform3f(p.uniforms.uAtmosphereColor!, atmosphereColor[0], atmosphereColor[1], atmosphereColor[2]);
    gl.uniform1f(p.uniforms.uPlanetType!, planetTypeIndex);
    gl.uniform1f(p.uniforms.uSeed!, seed);
    gl.uniform1f(p.uniforms.uTime!, this.time);

    gl.bindVertexArray(this.planetVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  drawRing(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, radius: number,
    ringColor: string, behind: boolean
  ): void {
    // Rings still use Canvas 2D overlay for simplicity
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.3);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    if (behind) {
      ctx.arc(0, 0, radius * 1.8, Math.PI, Math.PI * 2);
    } else {
      ctx.arc(0, 0, radius * 1.8, 0, Math.PI);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawTerrain(
    cameraX: number, cameraY: number, zoom: number,
    seed: number,
    baseColor: [number, number, number],
    accentColor: [number, number, number],
    waterLevel: number,
    waterColor: [number, number, number],
    hasVegetation: boolean,
    vegetationColor: [number, number, number],
    roughness: number,
    lightDir: [number, number, number],
    atmosphereDensity: number,
    atmosphereHue: number,
    lookAngle: number,
    lookPitch: number,
  ): void {
    if (!this.gl || !this.terrainProgram) return;
    const gl = this.gl;
    const p = this.terrainProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCameraPos!, cameraX, cameraY);
    gl.uniform1f(p.uniforms.uZoom!, zoom);
    gl.uniform1f(p.uniforms.uSeed!, seed);
    gl.uniform1f(p.uniforms.uTime!, this.time);
    gl.uniform3f(p.uniforms.uBaseColor!, baseColor[0], baseColor[1], baseColor[2]);
    gl.uniform3f(p.uniforms.uAccentColor!, accentColor[0], accentColor[1], accentColor[2]);
    gl.uniform1f(p.uniforms.uWaterLevel!, waterLevel);
    gl.uniform3f(p.uniforms.uWaterColor!, waterColor[0], waterColor[1], waterColor[2]);
    gl.uniform1f(p.uniforms.uHasVegetation!, hasVegetation ? 1.0 : 0.0);
    gl.uniform3f(p.uniforms.uVegetationColor!, vegetationColor[0], vegetationColor[1], vegetationColor[2]);
    gl.uniform1f(p.uniforms.uRoughness!, roughness);
    gl.uniform3f(p.uniforms.uLightDir!, lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform1f(p.uniforms.uAtmosphereDensity!, atmosphereDensity);
    gl.uniform1f(p.uniforms.uAtmosphereHue!, atmosphereHue);
    gl.uniform1f(p.uniforms.uLookAngle!, lookAngle);
    gl.uniform1f(p.uniforms.uLookPitch!, lookPitch);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawAtmosphere(
    altitude: number,
    density: number,
    hue: number,
    starColor: [number, number, number],
    planetRadius: number,
  ): void {
    if (!this.gl || !this.atmosphereProgram) return;
    const gl = this.gl;
    const p = this.atmosphereProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform1f(p.uniforms.uAltitude!, altitude);
    gl.uniform1f(p.uniforms.uDensity!, density);
    gl.uniform1f(p.uniforms.uHue!, hue);
    gl.uniform3f(p.uniforms.uStarColor!, starColor[0], starColor[1], starColor[2]);
    gl.uniform1f(p.uniforms.uTime!, this.time);
    gl.uniform1f(p.uniforms.uPlanetRadius!, planetRadius);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawNebula(
    cameraX: number, cameraY: number, zoom: number,
    intensity: number,
  ): void {
    if (!this.gl || !this.nebulaProgram || intensity < 0.01) return;
    const gl = this.gl;
    const p = this.nebulaProgram;

    // Additive blending for nebulae
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCameraPos!, cameraX, cameraY);
    gl.uniform1f(p.uniforms.uZoom!, zoom);
    gl.uniform1f(p.uniforms.uTime!, this.time);
    gl.uniform1f(p.uniforms.uIntensity!, intensity);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // Restore normal blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  drawGalaxyDisc(
    centerPxX: number, centerPxY: number, radiusPx: number,
    rotation: number, tilt: number, armCount: number,
    armDef: number, brightness: number, seed: number,
    galaxyType: number, // 0=spiral, 1=elliptical, 2=irregular
  ): void {
    if (!this.gl || !this.galaxyDiscProgram || radiusPx < 3) return;
    const gl = this.gl;
    const p = this.galaxyDiscProgram;

    // Additive blending for galaxy glow
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCenterPx!, centerPxX, centerPxY);
    gl.uniform1f(p.uniforms.uRadiusPx!, radiusPx);
    gl.uniform1f(p.uniforms.uRotation!, rotation);
    gl.uniform1f(p.uniforms.uTilt!, tilt);
    gl.uniform1f(p.uniforms.uArmCount!, armCount);
    gl.uniform1f(p.uniforms.uArmDef!, armDef);
    gl.uniform1f(p.uniforms.uBrightness!, brightness);
    gl.uniform1f(p.uniforms.uSeed!, seed);
    gl.uniform1f(p.uniforms.uGalaxyType!, galaxyType);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // Restore normal blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  endFrame(): void {
    if (!this.gl || !this.bloomEnabled) return;
    this.applyBloom();
  }

  getTime(): number {
    return this.time;
  }

  getResolution(): [number, number] {
    return [this.width, this.height];
  }

  // ─── Private: Shader Compilation ─────────────────────────────────────────

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      console.error('Shader source:', source.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createProgram(
    vertSrc: string, fragSrc: string,
    uniformNames: string[], attribNames: string[]
  ): ShaderProgram | null {
    const gl = this.gl!;

    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    const attribs: Record<string, number> = {};
    for (const name of attribNames) {
      attribs[name] = gl.getAttribLocation(program, name);
    }

    return { program, uniforms, attribs };
  }

  // ─── Private: Geometry Setup ─────────────────────────────────────────────

  private setupFullscreenQuad(): void {
    const gl = this.gl!;
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    // No buffers needed — vertex positions generated in shader from gl_VertexID
    gl.bindVertexArray(null);
  }

  private setupParticleBuffers(): void {
    const gl = this.gl!;
    const p = this.particleProgram!;

    this.particleVAO = gl.createVertexArray();
    gl.bindVertexArray(this.particleVAO);

    // Quad geometry (shared across all instances) — a 2x2 square
    const quadData = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);
    const quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aQuadPos!);
    gl.vertexAttribPointer(p.attribs.aQuadPos!, 2, gl.FLOAT, false, 0, 0);

    // Instance buffers
    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 2 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aPosition!);
    gl.vertexAttribPointer(p.attribs.aPosition!, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aPosition!, 1);

    this.sizeBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aSize!);
    gl.vertexAttribPointer(p.attribs.aSize!, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aSize!, 1);

    this.colorBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 4 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aColor!);
    gl.vertexAttribPointer(p.attribs.aColor!, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aColor!, 1);

    this.glowBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aGlow!);
    gl.vertexAttribPointer(p.attribs.aGlow!, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aGlow!, 1);

    gl.bindVertexArray(null);
  }

  private setupPlanetGeometry(): void {
    const gl = this.gl!;
    const p = this.planetProgram!;

    this.planetVAO = gl.createVertexArray();
    gl.bindVertexArray(this.planetVAO);

    // A quad from -1.3 to 1.3 (slightly oversized for atmosphere)
    const quadData = new Float32Array([
      -1.3, -1.3,
      1.3, -1.3,
      -1.3, 1.3,
      1.3, 1.3,
    ]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aPosition!);
    gl.vertexAttribPointer(p.attribs.aPosition!, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  // ─── Private: FBO Management ─────────────────────────────────────────────

  private createFBO(width: number, height: number): FBO | null {
    const gl = this.gl!;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (this.canRenderToFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('FBO creation failed:', status);
      return null;
    }

    return { framebuffer, texture, width, height };
  }

  private createFBOs(): void {
    if (!this.gl || this.width === 0 || this.height === 0) return;

    // Clean up old FBOs before creating new ones
    this.deleteFBOs();

    const halfW = Math.floor(this.width / 2);
    const halfH = Math.floor(this.height / 2);

    this.sceneFBO = this.createFBO(this.width, this.height);
    this.brightFBO = this.createFBO(halfW, halfH);
    this.blurFBOs = [];
    const blur0 = this.createFBO(halfW, halfH);
    const blur1 = this.createFBO(halfW, halfH);
    if (blur0 && blur1) {
      this.blurFBOs = [blur0, blur1];
    }
  }

  private deleteFBOs(): void {
    const gl = this.gl;
    if (!gl) return;
    const fbos = [this.sceneFBO, this.brightFBO, ...this.blurFBOs];
    for (const fbo of fbos) {
      if (fbo) {
        gl.deleteFramebuffer(fbo.framebuffer);
        gl.deleteTexture(fbo.texture);
      }
    }
    this.sceneFBO = null;
    this.brightFBO = null;
    this.blurFBOs = [];
  }

  // ─── Private: Bloom Post-Processing ──────────────────────────────────────

  private applyBloom(): void {
    const gl = this.gl!;
    if (!this.sceneFBO || !this.brightFBO || this.blurFBOs.length < 2 ||
      !this.blurFBOs[0] || !this.blurFBOs[1]) return;

    // Disable blending for all bloom passes — critical for RGBA16F FBOs
    // where accumulated particle alpha > 1.0 would create negative blend
    // factors and subtract light instead of adding it.
    gl.disable(gl.BLEND);

    // 1. Extract bright pixels
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFBO.framebuffer);
    gl.viewport(0, 0, this.brightFBO.width, this.brightFBO.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.bloomBrightProgram!.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture);
    gl.uniform1i(this.bloomBrightProgram!.uniforms.uScene!, 0);
    gl.uniform1f(this.bloomBrightProgram!.uniforms.uThreshold!, this.bloomThreshold);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Gaussian blur passes (horizontal then vertical, 2 iterations)
    gl.useProgram(this.bloomBlurProgram!.program);
    const blurW = this.brightFBO.width;
    const blurH = this.brightFBO.height;
    gl.uniform2f(this.bloomBlurProgram!.uniforms.uResolution!, blurW, blurH);

    let readFBO = this.brightFBO;
    for (let i = 0; i < 2; i++) {
      // Horizontal
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOs[0]!.framebuffer);
      gl.viewport(0, 0, blurW, blurH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
      gl.uniform1i(this.bloomBlurProgram!.uniforms.uTexture!, 0);
      gl.uniform2f(this.bloomBlurProgram!.uniforms.uDirection!, 1.0, 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Vertical
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOs[1]!.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurFBOs[0]!.texture);
      gl.uniform2f(this.bloomBlurProgram!.uniforms.uDirection!, 0.0, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      readFBO = this.blurFBOs[1]!;
    }

    // 3. Composite: scene + bloom → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.bloomCompositeProgram!.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture);
    gl.uniform1i(this.bloomCompositeProgram!.uniforms.uScene!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurFBOs[1]!.texture);
    gl.uniform1i(this.bloomCompositeProgram!.uniforms.uBloom!, 1);
    gl.uniform1f(this.bloomCompositeProgram!.uniforms.uBloomStrength!, this.bloomStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);

    // Restore blending for next frame's scene rendering
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
}

// ─── Particle Data Builder ───────────────────────────────────────────────────

/**
 * Pre-allocated typed arrays for building particle data.
 * Reused each frame to avoid GC pressure.
 */
export class ParticleBuilder {
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  glows: Float32Array;
  count = 0;
  private capacity: number;

  constructor(capacity = 200000) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 2);
    this.sizes = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 4);
    this.glows = new Float32Array(capacity);
  }

  reset(): void {
    this.count = 0;
  }

  add(x: number, y: number, size: number, r: number, g: number, b: number, a: number, glow: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count;
    this.positions[i * 2] = x;
    this.positions[i * 2 + 1] = y;
    this.sizes[i] = size;
    this.colors[i * 4] = r;
    this.colors[i * 4 + 1] = g;
    this.colors[i * 4 + 2] = b;
    this.colors[i * 4 + 3] = a;
    this.glows[i] = glow;
    this.count++;
  }

  getData(): ParticleData {
    return {
      positions: this.positions,
      sizes: this.sizes,
      colors: this.colors,
      glows: this.glows,
      count: this.count,
    };
  }
}

// ─── Color Parsing Utility ───────────────────────────────────────────────────

/** Parse a hex color (#rrggbb) to normalized [0-1] RGB tuple */
export function hexToRGB(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16);
  return [
    ((num >> 16) & 0xFF) / 255,
    ((num >> 8) & 0xFF) / 255,
    (num & 0xFF) / 255,
  ];
}

/** Parse an HSL/HSLA string to normalized RGB */
export function hslToRGB(hsl: string): [number, number, number] {
  const match = hsl.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
  if (!match) return [1, 1, 1];
  const h = parseInt(match[1]!) / 360;
  const s = parseInt(match[2]!) / 100;
  const l = parseInt(match[3]!) / 100;

  if (s === 0) return [l, l, l];

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3),
  ];
}

/** Map planet type string to shader index */
export function planetTypeToIndex(type: string): number {
  const map: Record<string, number> = {
    rocky: 0, gas_giant: 1, earth_like: 2, ocean: 3,
    lava: 4, ice: 5, desert: 6, ice_giant: 7,
  };
  return map[type] ?? 0;
}
