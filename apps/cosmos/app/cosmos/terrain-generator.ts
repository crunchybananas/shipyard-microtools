// Procedural Terrain Generator
// Generates biome-appropriate heightmaps and surface detail from planet seeds

import { SeededRandom } from "cosmos/services/universe-generator";

// ─── Biome Definitions ──────────────────────────────────────────────────────

export interface BiomeConfig {
  baseColor: [number, number, number];
  accentColor: [number, number, number];
  roughness: number;    // 0-1, how jagged the terrain is
  waterLevel: number;   // 0-1, flood fill below this height
  waterColor: [number, number, number];
  hasVegetation: boolean;
  vegetationColor: [number, number, number];
  hasClouds: boolean;
  atmosphereHue: number;  // 0-360
  atmosphereDensity: number; // 0-1
}

const BIOME_CONFIGS: Record<string, BiomeConfig> = {
  rocky: {
    baseColor: [0.45, 0.35, 0.28],
    accentColor: [0.6, 0.5, 0.4],
    roughness: 0.7,
    waterLevel: 0.0,
    waterColor: [0, 0, 0],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: false,
    atmosphereHue: 30,
    atmosphereDensity: 0.1,
  },
  gas_giant: {
    baseColor: [0.77, 0.65, 0.49],
    accentColor: [0.55, 0.45, 0.33],
    roughness: 0.1,
    waterLevel: 0.0,
    waterColor: [0, 0, 0],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: true,
    atmosphereHue: 35,
    atmosphereDensity: 0.95,
  },
  earth_like: {
    baseColor: [0.22, 0.55, 0.22],
    accentColor: [0.5, 0.42, 0.3],
    roughness: 0.5,
    waterLevel: 0.45,
    waterColor: [0.05, 0.2, 0.55],
    hasVegetation: true,
    vegetationColor: [0.15, 0.5, 0.15],
    hasClouds: true,
    atmosphereHue: 210,
    atmosphereDensity: 0.4,
  },
  ocean: {
    baseColor: [0.05, 0.15, 0.5],
    accentColor: [0.1, 0.3, 0.6],
    roughness: 0.2,
    waterLevel: 0.85,
    waterColor: [0.03, 0.12, 0.4],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: true,
    atmosphereHue: 200,
    atmosphereDensity: 0.5,
  },
  lava: {
    baseColor: [0.15, 0.08, 0.05],
    accentColor: [1.0, 0.35, 0.0],
    roughness: 0.6,
    waterLevel: 0.35,
    waterColor: [1.0, 0.2, 0.0],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: false,
    atmosphereHue: 15,
    atmosphereDensity: 0.3,
  },
  ice: {
    baseColor: [0.75, 0.88, 0.95],
    accentColor: [0.45, 0.55, 0.7],
    roughness: 0.4,
    waterLevel: 0.0,
    waterColor: [0, 0, 0],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: false,
    atmosphereHue: 200,
    atmosphereDensity: 0.15,
  },
  desert: {
    baseColor: [0.87, 0.72, 0.53],
    accentColor: [0.82, 0.52, 0.25],
    roughness: 0.35,
    waterLevel: 0.0,
    waterColor: [0, 0, 0],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: false,
    atmosphereHue: 40,
    atmosphereDensity: 0.2,
  },
  ice_giant: {
    baseColor: [0.5, 0.7, 0.85],
    accentColor: [0.3, 0.5, 0.7],
    roughness: 0.1,
    waterLevel: 0.0,
    waterColor: [0, 0, 0],
    hasVegetation: false,
    vegetationColor: [0, 0, 0],
    hasClouds: true,
    atmosphereHue: 195,
    atmosphereDensity: 0.9,
  },
};

export function getBiomeConfig(planetType: string): BiomeConfig {
  return BIOME_CONFIGS[planetType] ?? BIOME_CONFIGS.rocky!;
}

// ─── Terrain Height Generation ──────────────────────────────────────────────

/**
 * Generate a deterministic heightmap tile for a given planet and position.
 * Returns Float32Array of height values in [0, 1].
 */
export function generateHeightmap(
  seed: number,
  tileX: number,
  tileY: number,
  resolution: number,
  roughness: number,
): Float32Array {
  const data = new Float32Array(resolution * resolution);
  const rng = new SeededRandom(seed);

  // Permutation table for noise
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) {
    perm[i] = Math.floor(rng.next() * 256);
  }
  for (let i = 0; i < 256; i++) {
    perm[256 + i] = perm[i]!;
  }

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const wx = (tileX + x / resolution) * 4;
      const wy = (tileY + y / resolution) * 4;

      let height = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxAmp = 0;

      // 6 octaves of value noise
      for (let oct = 0; oct < 6; oct++) {
        const nx = wx * frequency;
        const ny = wy * frequency;
        height += valueNoise(nx, ny, perm) * amplitude;
        maxAmp += amplitude;
        amplitude *= 0.5 * (0.5 + roughness * 0.5);
        frequency *= 2.1;
      }

      data[y * resolution + x] = (height / maxAmp) * 0.5 + 0.5;
    }
  }

  return data;
}

function valueNoise(x: number, y: number, perm: Uint8Array): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[xi]! + yi]! / 255;
  const ab = perm[perm[xi]! + yi + 1]! / 255;
  const ba = perm[perm[xi + 1]! + yi]! / 255;
  const bb = perm[perm[xi + 1]! + yi + 1]! / 255;

  const x1 = lerp(aa, ba, u);
  const x2 = lerp(ab, bb, u);
  return lerp(x1, x2, v) * 2 - 1; // -1 to 1
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Surface Color Mapping ──────────────────────────────────────────────────

/**
 * Given a height value and biome config, return an RGB color.
 */
export function getTerrainColor(
  height: number,
  biome: BiomeConfig,
  _seed: number,
  _x: number,
  _y: number,
): [number, number, number] {
  // Below water level
  if (height < biome.waterLevel) {
    const depth = 1 - height / biome.waterLevel;
    return [
      biome.waterColor[0] * (1 - depth * 0.3),
      biome.waterColor[1] * (1 - depth * 0.3),
      biome.waterColor[2] * (1 - depth * 0.2),
    ];
  }

  // Normalize height above water
  const normalizedHeight = (height - biome.waterLevel) / (1 - biome.waterLevel);

  // Base terrain color
  let r = lerp(biome.baseColor[0], biome.accentColor[0], normalizedHeight);
  let g = lerp(biome.baseColor[1], biome.accentColor[1], normalizedHeight);
  let b = lerp(biome.baseColor[2], biome.accentColor[2], normalizedHeight);

  // Vegetation band (mid-altitudes)
  if (biome.hasVegetation && normalizedHeight > 0.05 && normalizedHeight < 0.4) {
    const vegStrength = 1 - Math.abs(normalizedHeight - 0.2) / 0.2;
    r = lerp(r, biome.vegetationColor[0], vegStrength * 0.7);
    g = lerp(g, biome.vegetationColor[1], vegStrength * 0.7);
    b = lerp(b, biome.vegetationColor[2], vegStrength * 0.7);
  }

  // Snow caps (high altitude)
  if (normalizedHeight > 0.75) {
    const snowStrength = (normalizedHeight - 0.75) / 0.25;
    r = lerp(r, 0.95, snowStrength);
    g = lerp(g, 0.97, snowStrength);
    b = lerp(b, 1.0, snowStrength);
  }

  return [r, g, b];
}

// ─── Atmosphere Gradient ────────────────────────────────────────────────────

/**
 * Calculate atmosphere sky color based on viewing angle and biome.
 * Returns RGBA with alpha for blending.
 */
export function getAtmosphereColor(
  normalizedAltitude: number, // 0 = surface, 1 = space
  biome: BiomeConfig,
  starColorRGB: [number, number, number],
): [number, number, number, number] {
  if (biome.atmosphereDensity < 0.05) {
    return [0, 0, 0, 0]; // No atmosphere
  }

  // Sky color from atmosphere hue
  const hue = biome.atmosphereHue;
  const [sr, sg, sb] = hslToRgb(hue / 360, 0.5, 0.6);

  // Fade from sky color at surface to black at space
  const density = biome.atmosphereDensity;
  const fadeOut = Math.pow(1 - normalizedAltitude, 2);
  const alpha = fadeOut * density;

  // Blend with star color near horizon (sunset effect)
  const horizonBlend = Math.pow(1 - normalizedAltitude, 8);
  const r = lerp(sr, starColorRGB[0], horizonBlend * 0.3);
  const g = lerp(sg, starColorRGB[1], horizonBlend * 0.3);
  const b = lerp(sb, starColorRGB[2], horizonBlend * 0.3);

  return [r, g, b, alpha];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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
