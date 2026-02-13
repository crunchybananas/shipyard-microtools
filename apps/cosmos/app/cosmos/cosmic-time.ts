// Cosmic Time Engine
// Maps a normalized time parameter (0-1) to the 13.8 billion year history
// of the universe. Objects evolve based on their age in cosmic time.

export interface CosmicEra {
  name: string;
  startTime: number; // 0-1 normalized
  endTime: number;
  description: string;
  starFormation: number; // 0-1, rate of new star formation
  galaxyMaturity: number; // 0-1, how developed galaxies are
  metallicity: number; // 0-1, heavy element abundance
  temperature: number; // CMB temperature in Kelvin
  expansionRate: number; // relative expansion rate
}

export const COSMIC_ERAS: CosmicEra[] = [
  {
    name: "Dark Ages",
    startTime: 0,
    endTime: 0.03,
    description: "Before the first stars",
    starFormation: 0,
    galaxyMaturity: 0,
    metallicity: 0,
    temperature: 3000,
    expansionRate: 0.5,
  },
  {
    name: "Cosmic Dawn",
    startTime: 0.03,
    endTime: 0.07,
    description: "First stars ignite",
    starFormation: 0.3,
    galaxyMaturity: 0.05,
    metallicity: 0.01,
    temperature: 200,
    expansionRate: 0.6,
  },
  {
    name: "Reionization",
    startTime: 0.07,
    endTime: 0.12,
    description: "Starlight transforms the cosmos",
    starFormation: 0.7,
    galaxyMaturity: 0.15,
    metallicity: 0.05,
    temperature: 50,
    expansionRate: 0.7,
  },
  {
    name: "Cosmic Noon",
    startTime: 0.12,
    endTime: 0.35,
    description: "Peak star formation",
    starFormation: 1.0,
    galaxyMaturity: 0.5,
    metallicity: 0.3,
    temperature: 15,
    expansionRate: 0.8,
  },
  {
    name: "Galactic Assembly",
    startTime: 0.35,
    endTime: 0.55,
    description: "Galaxies merge and grow",
    starFormation: 0.6,
    galaxyMaturity: 0.75,
    metallicity: 0.6,
    temperature: 6,
    expansionRate: 0.9,
  },
  {
    name: "Present Era",
    startTime: 0.55,
    endTime: 0.75,
    description: "The current epoch",
    starFormation: 0.3,
    galaxyMaturity: 1.0,
    metallicity: 0.8,
    temperature: 2.725,
    expansionRate: 1.0,
  },
  {
    name: "Stellar Twilight",
    startTime: 0.75,
    endTime: 0.9,
    description: "Star formation slows",
    starFormation: 0.1,
    galaxyMaturity: 1.0,
    metallicity: 0.95,
    temperature: 1.5,
    expansionRate: 1.3,
  },
  {
    name: "Degenerate Era",
    startTime: 0.9,
    endTime: 1.0,
    description: "The last stars fade",
    starFormation: 0.01,
    galaxyMaturity: 0.8,
    metallicity: 1.0,
    temperature: 0.5,
    expansionRate: 2.0,
  },
];

export function getCurrentEra(cosmicTime: number): CosmicEra {
  for (const era of COSMIC_ERAS) {
    if (cosmicTime >= era.startTime && cosmicTime < era.endTime) {
      return era;
    }
  }
  return COSMIC_ERAS[COSMIC_ERAS.length - 1]!;
}

/**
 * Get interpolated properties at a given cosmic time.
 */
export function getCosmicProperties(cosmicTime: number): {
  era: CosmicEra;
  starFormation: number;
  galaxyMaturity: number;
  metallicity: number;
  temperature: number;
  yearsBillion: number;
  backgroundTint: [number, number, number];
} {
  const era = getCurrentEra(cosmicTime);
  const t = cosmicTime;

  // Find neighboring eras for interpolation
  let prevEra = era;
  let nextEra = era;
  for (let i = 0; i < COSMIC_ERAS.length; i++) {
    if (COSMIC_ERAS[i] === era) {
      if (i > 0) prevEra = COSMIC_ERAS[i - 1]!;
      if (i < COSMIC_ERAS.length - 1) nextEra = COSMIC_ERAS[i + 1]!;
      break;
    }
  }

  // Interpolate within era
  const eraProgress =
    (t - era.startTime) / (era.endTime - era.startTime);

  const starFormation = lerp(
    era.starFormation,
    nextEra.starFormation,
    eraProgress * 0.3,
  );

  const galaxyMaturity = lerp(
    era.galaxyMaturity,
    nextEra.galaxyMaturity,
    eraProgress * 0.3,
  );

  const metallicity = lerp(
    prevEra.metallicity,
    era.metallicity,
    Math.min(1, eraProgress + 0.5),
  );

  // 13.8 billion years mapped to 0-1
  const yearsBillion = t * 13.8;

  // Background tint based on era
  // Dark Ages: hot orange glow → Present: deep blue-black → Future: pure black
  let backgroundTint: [number, number, number];
  if (t < 0.03) {
    // Dark ages: faint warm glow (recombination)
    const glow = 1 - t / 0.03;
    backgroundTint = [0.15 * glow, 0.05 * glow, 0.01 * glow];
  } else if (t < 0.12) {
    // Early universe: slightly warmer background
    const warmth = (0.12 - t) / 0.09;
    backgroundTint = [0.02 * warmth, 0.01 * warmth, 0.03 * warmth];
  } else if (t < 0.75) {
    // Normal: standard deep space
    backgroundTint = [0, 0, 0];
  } else {
    // Far future: progressively darker, last stars dying
    const fade = (t - 0.75) / 0.25;
    backgroundTint = [-0.02 * fade, -0.02 * fade, -0.03 * fade];
  }

  return {
    era,
    starFormation,
    galaxyMaturity,
    metallicity,
    temperature: era.temperature,
    yearsBillion,
    backgroundTint,
  };
}

/**
 * Modify star generation based on cosmic time.
 * Returns a multiplier for star count and color temperature shift.
 */
export function getStarEvolution(cosmicTime: number): {
  countMultiplier: number;
  tempShift: number;
  sizeMultiplier: number;
  brightnessMult: number;
} {
  const props = getCosmicProperties(cosmicTime);

  return {
    // Fewer visible stars in early/late universe
    countMultiplier: Math.max(0.05, props.starFormation * 0.7 + props.galaxyMaturity * 0.3),
    // Early stars are bluer (Pop III), late universe stars are redder
    tempShift: cosmicTime < 0.12 ? 5000 : cosmicTime > 0.75 ? -2000 : 0,
    // Early stars could be massive, late stars are all small
    sizeMultiplier: cosmicTime < 0.12 ? 2.0 : cosmicTime > 0.75 ? 0.5 : 1.0,
    // Dimmer in far future
    brightnessMult: cosmicTime > 0.9 ? 0.3 : 1.0,
  };
}

/**
 * Modify galaxy appearance based on cosmic time.
 */
export function getGalaxyEvolution(cosmicTime: number): {
  sizeMultiplier: number;
  armDefinition: number;
  brightness: number;
  irregularity: number;
} {
  if (cosmicTime < 0.03) {
    // No galaxies yet
    return { sizeMultiplier: 0, armDefinition: 0, brightness: 0, irregularity: 1 };
  }

  if (cosmicTime < 0.12) {
    // Proto-galaxies: small, irregular blobs
    const growth = (cosmicTime - 0.03) / 0.09;
    return {
      sizeMultiplier: growth * 0.3,
      armDefinition: 0,
      brightness: growth * 0.5,
      irregularity: 1,
    };
  }

  if (cosmicTime < 0.35) {
    // Building structure
    const progress = (cosmicTime - 0.12) / 0.23;
    return {
      sizeMultiplier: 0.3 + progress * 0.5,
      armDefinition: progress * 0.5,
      brightness: 0.5 + progress * 0.5,
      irregularity: 1 - progress * 0.7,
    };
  }

  if (cosmicTime < 0.75) {
    // Mature galaxies
    return { sizeMultiplier: 1.0, armDefinition: 1.0, brightness: 1.0, irregularity: 0.2 };
  }

  // Aging galaxies
  const aging = (cosmicTime - 0.75) / 0.25;
  return {
    sizeMultiplier: 1.0 - aging * 0.3,
    armDefinition: 1.0 - aging * 0.5,
    brightness: 1.0 - aging * 0.7,
    irregularity: 0.2 + aging * 0.3,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
