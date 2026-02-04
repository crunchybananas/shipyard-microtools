// Seeded Random Number Generator
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  weighted<T>(arr: T[], weightFn: (item: T) => number): T {
    const totalWeight = arr.reduce((sum, item) => sum + weightFn(item), 0);
    let r = this.next() * totalWeight;
    for (const item of arr) {
      r -= weightFn(item);
      if (r <= 0) return item;
    }
    return arr[arr.length - 1]!;
  }
}

// Hash function for coordinates
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getSeed(x: number, y: number, scale = 0): number {
  return hashCode(`${Math.floor(x)},${Math.floor(y)},${scale}`);
}

// Star data types
export interface SpectralClass {
  class: string;
  temp: number;
  color: string;
  rarity: number;
  radius: number;
}

export const SPECTRAL_CLASSES: SpectralClass[] = [
  { class: "O", temp: 30000, color: "#9bb0ff", rarity: 0.00003, radius: 10 },
  { class: "B", temp: 20000, color: "#aabfff", rarity: 0.001, radius: 6 },
  { class: "A", temp: 8500, color: "#cad7ff", rarity: 0.006, radius: 2.5 },
  { class: "F", temp: 6500, color: "#f8f7ff", rarity: 0.03, radius: 1.5 },
  { class: "G", temp: 5500, color: "#fff4ea", rarity: 0.076, radius: 1.0 },
  { class: "K", temp: 4000, color: "#ffd2a1", rarity: 0.121, radius: 0.8 },
  { class: "M", temp: 3000, color: "#ffcc6f", rarity: 0.765, radius: 0.5 },
];

export interface PlanetType {
  type: string;
  colors: string[];
  minSize: number;
  maxSize: number;
}

export const PLANET_TYPES: PlanetType[] = [
  {
    type: "gas_giant",
    colors: ["#c4a77d", "#8b7355", "#d4a574", "#b8860b"],
    minSize: 8,
    maxSize: 14,
  },
  {
    type: "ice_giant",
    colors: ["#a8d8ea", "#87ceeb", "#b0e0e6", "#4682b4"],
    minSize: 5,
    maxSize: 9,
  },
  {
    type: "rocky",
    colors: ["#8b7355", "#a0522d", "#696969", "#808080"],
    minSize: 0.4,
    maxSize: 1.5,
  },
  {
    type: "ocean",
    colors: ["#1e90ff", "#4169e1", "#006994", "#0077be"],
    minSize: 0.6,
    maxSize: 1.8,
  },
  {
    type: "lava",
    colors: ["#ff4500", "#dc143c", "#8b0000", "#ff6347"],
    minSize: 0.3,
    maxSize: 1.0,
  },
  {
    type: "earth_like",
    colors: ["#228b22", "#4169e1", "#f4a460", "#90ee90"],
    minSize: 0.8,
    maxSize: 1.4,
  },
  {
    type: "ice",
    colors: ["#f0f8ff", "#e0ffff", "#b0c4de", "#add8e6"],
    minSize: 0.4,
    maxSize: 1.2,
  },
  {
    type: "desert",
    colors: ["#deb887", "#d2691e", "#f4a460", "#cd853f"],
    minSize: 0.5,
    maxSize: 1.3,
  },
];

export type GalaxyType =
  | "spiral"
  | "elliptical"
  | "irregular"
  | "barred_spiral";
export const GALAXY_TYPES: GalaxyType[] = [
  "spiral",
  "elliptical",
  "irregular",
  "barred_spiral",
];

// Name generation constants
const PREFIXES = [
  "Al",
  "Be",
  "Cy",
  "De",
  "El",
  "Fa",
  "Ga",
  "He",
  "Io",
  "Ja",
  "Ka",
  "Lo",
  "Ma",
  "Ne",
  "Or",
  "Pa",
  "Qu",
  "Ra",
  "Sa",
  "Ta",
  "Ul",
  "Ve",
  "Wa",
  "Xe",
  "Yo",
  "Za",
];
const MIDDLES = [
  "pha",
  "tar",
  "rix",
  "don",
  "nar",
  "ven",
  "kor",
  "mel",
  "sar",
  "thi",
  "ron",
  "dan",
  "lex",
  "mar",
  "nis",
  "por",
  "qui",
  "rel",
  "sol",
  "tel",
];
const SUFFIXES = [
  "is",
  "us",
  "a",
  "on",
  "ar",
  "ix",
  "or",
  "ia",
  "um",
  "es",
  "i",
  "ae",
  "os",
  "an",
  "en",
];

export function generateName(seed: number): string {
  const rng = new SeededRandom(seed);

  if (rng.next() > 0.7) {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const l1 = letters[Math.floor(rng.next() * letters.length)];
    const l2 = letters[Math.floor(rng.next() * letters.length)];
    const num = Math.floor(rng.range(100, 9999));
    return `${l1}${l2}-${num}`;
  }

  return rng.pick(PREFIXES) + rng.pick(MIDDLES) + rng.pick(SUFFIXES);
}

// Scale definitions
export interface Scale {
  name: string;
  minZoom: number;
  maxZoom: number;
}

export const SCALES: Record<string, Scale> = {
  UNIVERSE: { name: "Universe", minZoom: 0.5, maxZoom: 5 },
  CLUSTER: { name: "Galaxy Cluster", minZoom: 5, maxZoom: 50 },
  GALAXY: { name: "Galaxy", minZoom: 50, maxZoom: 500 },
  SECTOR: { name: "Sector", minZoom: 500, maxZoom: 5000 },
  SYSTEM: { name: "Star System", minZoom: 5000, maxZoom: 50000 },
  PLANET: { name: "Planet", minZoom: 50000, maxZoom: 500000 },
};

export function getCurrentScale(zoom: number): Scale {
  if (zoom < 5) return SCALES.UNIVERSE!;
  if (zoom < 50) return SCALES.CLUSTER!;
  if (zoom < 500) return SCALES.GALAXY!;
  if (zoom < 5000) return SCALES.SECTOR!;
  if (zoom < 50000) return SCALES.SYSTEM!;
  return SCALES.PLANET!;
}

// Generated object types
export interface Galaxy {
  seed: number;
  name: string;
  type: GalaxyType;
  arms: number;
  size: number;
  rotation: number;
  tilt: number;
  coreColor: string;
  armColor: string;
  starCount: number;
  worldX?: number;
  worldY?: number;
  screenX?: number;
  screenY?: number;
  screenSize?: number;
}

export interface Star {
  seed: number;
  name: string;
  spectralClass: string;
  temperature: number;
  color: string;
  radius: number;
  luminosity: number;
  planets: number;
  worldX?: number;
  worldY?: number;
  screenX?: number;
  screenY?: number;
  screenSize?: number;
}

export interface Planet {
  seed: number;
  name: string;
  type: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitOffset: number;
  color: string;
  hasRings: boolean;
  ringColor: string;
  moons: number;
  atmosphere: boolean;
  atmosphereColor: string;
}

export interface CachedSystem {
  star: Star;
  planets: Planet[];
}

// Generation functions
export function generateGalaxy(seed: number): Galaxy {
  const rng = new SeededRandom(seed);
  const type = rng.pick(GALAXY_TYPES);

  return {
    seed,
    name: generateName(seed),
    type,
    arms: type.includes("spiral") ? rng.int(2, 5) : 0,
    size: rng.range(0.6, 1.5),
    rotation: rng.range(0, Math.PI * 2),
    tilt: rng.range(0.2, 0.8),
    coreColor: `hsl(${rng.range(30, 60)}, ${rng.range(50, 80)}%, ${rng.range(70, 90)}%)`,
    armColor: `hsl(${rng.range(200, 280)}, ${rng.range(30, 60)}%, ${rng.range(60, 80)}%)`,
    starCount: Math.floor(rng.range(200, 800)),
  };
}

export function generateStar(seed: number): Star {
  const rng = new SeededRandom(seed);
  const spectral = rng.weighted(SPECTRAL_CLASSES, (s) => s.rarity);

  return {
    seed,
    name: generateName(seed),
    spectralClass: spectral.class,
    temperature: spectral.temp + rng.range(-500, 500),
    color: spectral.color,
    radius: spectral.radius * rng.range(0.8, 1.3),
    luminosity: spectral.radius * spectral.radius,
    planets: rng.int(0, 8),
  };
}

export function generatePlanet(
  seed: number,
  orbitIndex: number,
  _star: Star,
): Planet {
  const rng = new SeededRandom(seed);

  // Inner planets more likely rocky, outer more likely gas giants
  let typeOptions: PlanetType[];
  if (orbitIndex < 2) {
    typeOptions = PLANET_TYPES.filter((t) =>
      ["rocky", "lava", "desert"].includes(t.type),
    );
  } else if (orbitIndex < 4) {
    typeOptions = PLANET_TYPES.filter((t) =>
      ["rocky", "ocean", "earth_like", "desert"].includes(t.type),
    );
  } else {
    typeOptions = PLANET_TYPES.filter((t) =>
      ["gas_giant", "ice_giant", "ice"].includes(t.type),
    );
  }

  const planetType = rng.pick(typeOptions);
  const baseColor = rng.pick(planetType.colors);

  return {
    seed,
    name: generateName(seed),
    type: planetType.type,
    radius: rng.range(planetType.minSize, planetType.maxSize),
    orbitRadius: 80 + orbitIndex * 60 + rng.range(-10, 10),
    orbitSpeed: 0.0002 / (orbitIndex + 1),
    orbitOffset: rng.range(0, Math.PI * 2),
    color: baseColor,
    hasRings: planetType.type === "gas_giant" && rng.next() > 0.6,
    ringColor: `hsla(${rng.range(30, 60)}, 40%, 70%, 0.5)`,
    moons: planetType.type === "gas_giant" ? rng.int(1, 6) : rng.int(0, 2),
    atmosphere: ["ocean", "earth_like", "gas_giant", "ice_giant"].includes(
      planetType.type,
    ),
    atmosphereColor: `hsla(${rng.range(180, 240)}, 50%, 70%, 0.2)`,
  };
}

// Color utility functions
export function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}

export function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `rgb(${R}, ${G}, ${B})`;
}

// Object description helper
export function getObjectDescription(
  obj: Galaxy | Star | Planet | null,
): string {
  if (!obj) return "";

  if ("type" in obj && GALAXY_TYPES.includes(obj.type as GalaxyType)) {
    const galaxy = obj as Galaxy;
    const typeName = galaxy.type
      .replace("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${typeName} Galaxy • ${galaxy.arms ? galaxy.arms + " arms" : "Ancient structure"}`;
  }

  if ("spectralClass" in obj) {
    const star = obj as Star;
    return `${star.spectralClass}-type Star • ${star.temperature}K • ${star.planets} planets`;
  }

  if ("orbitRadius" in obj) {
    const planet = obj as Planet;
    const typeName = planet.type
      .replace("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${typeName} • ${planet.moons} moon${planet.moons !== 1 ? "s" : ""}${planet.hasRings ? " • Ringed" : ""}`;
  }

  return "";
}
