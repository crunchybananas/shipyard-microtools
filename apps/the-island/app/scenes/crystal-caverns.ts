/**
 * Crystal Caverns — Scene 3 of The Fading Kingdom
 *
 * CURSED: A pitch-dark cave. Water drips. Crystals are dull and lifeless.
 * RESTORED: A dazzling crystal grotto refracting rainbow light everywhere.
 *
 * PUZZLE: Redirect light beams through prisms to illuminate all crystals.
 * GUARDIAN: Fox
 */

import type { SceneDefinition, SceneRenderContext } from "the-island/scenes/types";
import { lerp } from "the-island/scenes/types";

function drawCaveBackground(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawCaveWalls(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  ctx.fillStyle = visuals.palette.ground[0];

  // Left wall
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.12, 0);
  ctx.quadraticCurveTo(width * 0.15, height * 0.3, width * 0.1, height * 0.6);
  ctx.quadraticCurveTo(width * 0.08, height * 0.8, 0, height);
  ctx.closePath();
  ctx.fill();

  // Right wall
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.88, 0);
  ctx.quadraticCurveTo(width * 0.85, height * 0.3, width * 0.9, height * 0.6);
  ctx.quadraticCurveTo(width * 0.92, height * 0.8, width, height);
  ctx.closePath();
  ctx.fill();

  // Stalactites
  const stalactites = [0.2, 0.35, 0.5, 0.65, 0.8];
  ctx.fillStyle = visuals.palette.ground[1];
  for (const sx of stalactites) {
    const tipLen = 20 + Math.sin(sx * 13) * 15;
    ctx.beginPath();
    ctx.moveTo(sx * width - 8, 0);
    ctx.lineTo(sx * width, tipLen);
    ctx.lineTo(sx * width + 8, 0);
    ctx.fill();
  }
}

function drawCrystals(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;

  const crystals = [
    { x: 0.25, y: 0.45, size: 35, hue: 280 },
    { x: 0.4, y: 0.55, size: 28, hue: 200 },
    { x: 0.55, y: 0.4, size: 40, hue: 320 },
    { x: 0.7, y: 0.5, size: 32, hue: 160 },
    { x: 0.82, y: 0.42, size: 25, hue: 60 },
  ];

  for (const crystal of crystals) {
    const cx = crystal.x * width;
    const cy = crystal.y * height;
    const s = crystal.size * (width / 1200);

    // Crystal shape (hexagonal prism)
    ctx.save();
    ctx.translate(cx, cy);

    // Glow (restored)
    if (restorationProgress > 0.2) {
      const glowAlpha = (restorationProgress - 0.2) / 0.8 * 0.4;
      const pulse = Math.sin(time * 2 + crystal.hue * 0.01) * 0.15 + 0.85;
      ctx.globalAlpha = glowAlpha * pulse;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.5);
      glow.addColorStop(0, `hsla(${crystal.hue}, 70%, 60%, 0.6)`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(-s * 2.5, -s * 2.5, s * 5, s * 5);
      ctx.globalAlpha = 1;
    }

    // Crystal body
    const sat = lerp(5, 70, restorationProgress);
    const light = lerp(25, 55, restorationProgress);
    ctx.fillStyle = `hsl(${crystal.hue}, ${sat}%, ${light}%)`;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.5, -s * 0.3);
    ctx.lineTo(s * 0.4, s * 0.6);
    ctx.lineTo(-s * 0.4, s * 0.6);
    ctx.lineTo(-s * 0.5, -s * 0.3);
    ctx.closePath();
    ctx.fill();

    // Highlight facet
    ctx.fillStyle = `hsla(${crystal.hue}, ${sat}%, ${light + 20}%, 0.4)`;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.5, -s * 0.3);
    ctx.lineTo(s * 0.1, s * 0.2);
    ctx.lineTo(-s * 0.2, -s * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

function drawCaveFloor(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const floorY = height * 0.75;
  const grad = ctx.createLinearGradient(0, floorY, 0, height);
  grad.addColorStop(0, visuals.palette.ground[0]);
  grad.addColorStop(1, visuals.palette.ground[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, floorY, width, height - floorY);

  // Water puddles
  ctx.fillStyle = visuals.palette.water?.[0] ?? "#0a1020";
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(width * 0.4, floorY + 20, width * 0.08, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width * 0.65, floorY + 30, width * 0.06, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export const crystalCaverns: SceneDefinition = {
  id: "crystal_caverns",
  name: "Crystal Caverns",
  cursedDescription: "Darkness presses against you like a living thing. Water drips in a slow, hollow rhythm — the cave's only heartbeat. Crystal formations jut from the walls like teeth, gray and dead. Each one should hold a universe of color, but the curse has swallowed every last photon.",
  restoredDescription: "The cavern ignites. Every crystal catches the light and throws it further — violet to blue to green to gold — until the walls are a cathedral of living color. From the deepest shadow, a fox with amber eyes steps forward, its fur rippling with reflected prisms.",
  exits: {
    south: "whispering_woods",
    east: "the_meadow",
  },
  items: [],
  layers: [
    { id: "bg", parallax: 0, draw: drawCaveBackground },
    { id: "walls", parallax: 0.1, draw: drawCaveWalls },
    { id: "crystals", parallax: 0.3, draw: drawCrystals },
    { id: "floor", parallax: 0.4, draw: drawCaveFloor },
  ],
  cursedVisuals: {
    saturation: 0.0,
    brightness: 0.3,
    fogDensity: 0.15,
    palette: {
      sky: ["#060608", "#080a0e"],
      ground: ["#0e0e12", "#0a0a0e"],
      accent: "#1a1a20",
      water: ["#0a0a12", "#060610"],
      fog: "#2a2a30",
    },
  },
  restoredVisuals: {
    saturation: 1.0,
    brightness: 0.85,
    fogDensity: 0.0,
    palette: {
      sky: ["#0a0818", "#0e0c1e"],
      ground: ["#14121c", "#0e0c16"],
      accent: "#2a2840",
      water: ["#1a1830", "#0e0c20"],
      fog: "#2a2840",
    },
  },
  hotspots: [
    { id: "crystal_1", bounds: { x: 250, y: 320, width: 100, height: 100 }, action: "puzzle", target: "crystal_lighting" },
    { id: "cave_pool", bounds: { x: 400, y: 520, width: 150, height: 60 }, action: "examine", target: "pool" },
  ],
  creatures: [
    { id: "fox", type: "fox", x: 850, y: 450, scale: 0.8, showWhen: "restored" },
  ],
  particles: [
    {
      id: "drips", x: 100, y: 180, width: 1000, height: 0,
      rate: 2, lifetime: [1, 2], velocity: { x: [0, 0], y: [100, 200] },
      size: [1, 2], cursedColor: "#3a4050", restoredColor: "#6080a0",
      shape: "line", showWhen: "always",
    },
    {
      id: "crystal_sparkles", x: 200, y: 250, width: 700, height: 300,
      rate: 5, lifetime: [1, 3], velocity: { x: [-15, 15], y: [-20, 10] },
      size: [1, 4], cursedColor: "#333333", restoredColor: "#ffffff",
      shape: "star", blendMode: "lighter", showWhen: "restored",
    },
  ],
  music: {
    droneFreq: 50, droneType: "sine", droneVolume: 0.1,
    baseNote: 57, scale: [0, 1, 4, 5, 7, 8, 11], // harmonic minor
    tempo: 60, cursedFilterCutoff: 120, restoredFilterCutoff: 5000,
    melodyPattern: [0, 4, 2, 6, 3, 1], melodyRhythm: [3, 1, 2, 1, 2, 3],
    ambientType: "water", ambientVolume: 0.2,
  },
  puzzleId: "crystal_lighting",
  guardianCreature: "fox",
  restorationToken: "token_caverns",
};
