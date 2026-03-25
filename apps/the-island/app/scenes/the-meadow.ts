/**
 * The Meadow — Scene 4 of The Fading Kingdom
 *
 * CURSED: Dead brown grass under heavy gray skies. No flowers, no life.
 * RESTORED: Wildflowers bloom in every color. Butterflies dance. A unicorn grazes.
 *
 * PUZZLE: Gather 3 potion ingredients and brew a healing mixture.
 * GUARDIAN: Unicorn
 */

import type { SceneDefinition, SceneRenderContext } from "the-island/scenes/types";
// lerp available from types if needed

function drawSky(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.5);
}

function drawHills(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Rolling hills in background
  ctx.fillStyle = visuals.palette.ground[0];
  ctx.beginPath();
  ctx.moveTo(0, height * 0.5);
  ctx.quadraticCurveTo(width * 0.2, height * 0.4, width * 0.4, height * 0.48);
  ctx.quadraticCurveTo(width * 0.6, height * 0.42, width * 0.8, height * 0.46);
  ctx.quadraticCurveTo(width * 0.9, height * 0.44, width, height * 0.5);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

function drawGrass(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress } = rc;
  const grassY = height * 0.55;

  const grad = ctx.createLinearGradient(0, grassY, 0, height);
  grad.addColorStop(0, visuals.palette.ground[0]);
  grad.addColorStop(1, visuals.palette.ground[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, grassY, width, height - grassY);

  // Grass blades (more visible when restored)
  if (restorationProgress > 0.3) {
    const bladeAlpha = (restorationProgress - 0.3) / 0.7 * 0.4;
    ctx.strokeStyle = visuals.palette.accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = bladeAlpha;

    for (let x = 0; x < width; x += 12) {
      const h = 8 + Math.sin(x * 0.3) * 4;
      const sway = Math.sin(rc.time * 1.5 + x * 0.05) * 2;
      ctx.beginPath();
      ctx.moveTo(x, grassY + 5);
      ctx.quadraticCurveTo(x + sway, grassY + 5 - h, x + sway * 1.5, grassY - h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawFlowers(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  if (restorationProgress < 0.5) return;

  const flowerAlpha = (restorationProgress - 0.5) / 0.5;
  ctx.globalAlpha = flowerAlpha;

  const flowers = [
    { x: 0.15, y: 0.62, hue: 0, size: 6 },
    { x: 0.25, y: 0.65, hue: 45, size: 5 },
    { x: 0.35, y: 0.6, hue: 280, size: 7 },
    { x: 0.45, y: 0.67, hue: 200, size: 5 },
    { x: 0.55, y: 0.63, hue: 340, size: 6 },
    { x: 0.65, y: 0.66, hue: 120, size: 5 },
    { x: 0.75, y: 0.61, hue: 60, size: 7 },
    { x: 0.85, y: 0.64, hue: 180, size: 5 },
    { x: 0.2, y: 0.68, hue: 30, size: 4 },
    { x: 0.5, y: 0.7, hue: 300, size: 4 },
    { x: 0.7, y: 0.69, hue: 150, size: 5 },
    { x: 0.9, y: 0.62, hue: 90, size: 6 },
  ];

  for (const f of flowers) {
    const fx = f.x * width;
    const fy = f.y * height;
    const sway = Math.sin(time * 1.2 + f.x * 8) * 2;

    // Stem
    ctx.strokeStyle = "#3a7030";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 8);
    ctx.quadraticCurveTo(fx + sway, fy + 2, fx + sway, fy - f.size);
    ctx.stroke();

    // Petals
    ctx.fillStyle = `hsl(${f.hue}, 80%, 60%)`;
    const petalX = fx + sway;
    const petalY = fy - f.size;
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        petalX + Math.cos(angle) * f.size * 0.4,
        petalY + Math.sin(angle) * f.size * 0.4,
        f.size * 0.35, f.size * 0.2,
        angle, 0, Math.PI * 2,
      );
      ctx.fill();
    }

    // Center
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(petalX, petalY, f.size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawRainbow(rc: SceneRenderContext): void {
  const { ctx, width, height, restorationProgress } = rc;
  if (restorationProgress < 0.7) return;

  const alpha = (restorationProgress - 0.7) / 0.3 * 0.3;
  ctx.globalAlpha = alpha;

  const colors = ["#ff0000", "#ff7700", "#ffff00", "#00ff00", "#0077ff", "#4400ff", "#8800ff"];
  const cx = width * 0.5;
  const cy = height * 0.6;
  const baseR = width * 0.5;

  for (let i = 0; i < colors.length; i++) {
    const r = baseR - i * 8;
    ctx.strokeStyle = colors[i]!;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

export const theMeadow: SceneDefinition = {
  id: "the_meadow",
  name: "The Meadow",
  cursedDescription: "A dead meadow under a tin sky. But look — faint glimmers in the grass. Three ingredients for a healing potion hide here: moonpetal, starroot, and dewdrop. Search the glowing spots to gather them.",
  restoredDescription: "The meadow remembers spring. Wildflowers erupt in waves — crimson, gold, violet, azure — as if the earth is laughing. Butterflies spiral up from the petals like living confetti. And there, at the meadow's heart, a unicorn grazes in a pool of light, its horn catching every color the world has to offer.",
  exits: {
    west: "crystal_caverns",
    north: "rainbow_bridge",
  },
  items: ["herb_moonpetal", "herb_starroot", "herb_dewdrop"],
  layers: [
    { id: "sky", parallax: 0, draw: drawSky },
    { id: "rainbow", parallax: 0.05, draw: drawRainbow },
    { id: "hills", parallax: 0.2, draw: drawHills },
    { id: "grass", parallax: 0.4, draw: drawGrass },
    { id: "flowers", parallax: 0.5, draw: drawFlowers },
  ],
  cursedVisuals: {
    saturation: 0.03,
    brightness: 0.45,
    fogDensity: 0.25,
    palette: {
      sky: ["#2a2a28", "#3a3a38"],
      ground: ["#3a3828", "#2a2820"],
      accent: "#4a4830",
      fog: "#5a5a58",
    },
  },
  restoredVisuals: {
    saturation: 1.0,
    brightness: 1.05,
    fogDensity: 0.0,
    palette: {
      sky: ["#3080c0", "#80c0e0"],
      ground: ["#40802a", "#2a6020"],
      accent: "#50a038",
      fog: "#a0d0f0",
    },
  },
  hotspots: [
    { id: "herb_1", bounds: { x: 200, y: 420, width: 80, height: 60 }, action: "pickup", target: "herb_moonpetal" },
    { id: "herb_2", bounds: { x: 600, y: 440, width: 80, height: 60 }, action: "pickup", target: "herb_starroot" },
    { id: "herb_3", bounds: { x: 900, y: 430, width: 80, height: 60 }, action: "pickup", target: "herb_dewdrop" },
    { id: "mixing_stone", bounds: { x: 500, y: 480, width: 120, height: 80 }, action: "puzzle", target: "unicorn_healing" },
  ],
  creatures: [
    { id: "unicorn", type: "unicorn", x: 700, y: 420, scale: 1.5, showWhen: "restored" },
  ],
  particles: [
    {
      id: "butterflies", x: 100, y: 300, width: 1000, height: 200,
      rate: 0.8, lifetime: [5, 10], velocity: { x: [-15, 15], y: [-25, 5] },
      size: [3, 6], cursedColor: "#555555", restoredColor: "#ff88cc",
      shape: "circle", showWhen: "restored",
    },
    {
      id: "petals", x: 0, y: 250, width: 1200, height: 0,
      rate: 2, lifetime: [3, 6], velocity: { x: [10, 40], y: [5, 20] },
      size: [2, 4], cursedColor: "#555555", restoredColor: "#ffaadd",
      shape: "circle", showWhen: "restored",
    },
  ],
  music: {
    droneFreq: 65, droneType: "sine", droneVolume: 0.1,
    baseNote: 65, scale: [0, 2, 4, 7, 9], // major pentatonic
    tempo: 96, cursedFilterCutoff: 180, restoredFilterCutoff: 6000,
    melodyPattern: [0, 2, 4, 3, 1, 4, 2, 0], melodyRhythm: [1, 1, 2, 1, 1, 1, 1, 2],
    ambientType: "wind", ambientVolume: 0.2,
  },
  puzzleId: "unicorn_healing",
  guardianCreature: "unicorn",
  restorationToken: "token_meadow",
};
