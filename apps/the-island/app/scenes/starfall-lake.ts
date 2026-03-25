/**
 * Starfall Lake — Scene 7 of The Fading Kingdom
 *
 * CURSED: A frozen gray lake. Bare trees ring the shore. No stars reflect.
 * RESTORED: Liquid starlight shimmers on the water. Fish leap. Trees bloom.
 *
 * PUZZLE: Draw a specific rune pattern on the ice to melt it.
 * GUARDIAN: Fish
 */

import type { SceneDefinition, SceneRenderContext } from "the-island/scenes/types";
import { lerp } from "the-island/scenes/types";

function drawNightSky(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, time, restorationProgress } = rc;
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.4);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.45);

  // Stars (more visible when restored)
  const starBright = lerp(0.15, 0.8, restorationProgress);
  ctx.fillStyle = "#fffacd";
  const stars = [
    [0.1, 0.08], [0.2, 0.15], [0.3, 0.05], [0.45, 0.12], [0.55, 0.07],
    [0.65, 0.14], [0.75, 0.06], [0.85, 0.13], [0.92, 0.09],
    [0.15, 0.22], [0.4, 0.19], [0.6, 0.2], [0.8, 0.18],
  ];
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (!s) continue;
    const twinkle = Math.sin(time * (1.2 + i * 0.4) + i * 3) * 0.3 + 0.7;
    ctx.globalAlpha = starBright * twinkle;
    const size = (1.2 + (i % 3) * 0.5) * (width / 1200);
    ctx.beginPath();
    ctx.arc((s[0] ?? 0) * width, (s[1] ?? 0) * height, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDistantTrees(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress } = rc;
  const treeY = height * 0.38;

  const positions = [0.05, 0.12, 0.22, 0.3, 0.7, 0.78, 0.88, 0.95];
  for (const px of positions) {
    const tx = px * width;
    const th = height * 0.15 + Math.sin(px * 17) * height * 0.05;

    // Trunk
    ctx.fillStyle = visuals.palette.ground[1];
    ctx.fillRect(tx - 3, treeY - th * 0.3, 6, th * 0.7);

    // Canopy (dead = bare branches, restored = full leaves)
    if (restorationProgress < 0.4) {
      // Bare branches
      ctx.strokeStyle = visuals.palette.ground[1];
      ctx.lineWidth = 1.5;
      for (let b = 0; b < 3; b++) {
        const angle = -0.5 + b * 0.5;
        ctx.beginPath();
        ctx.moveTo(tx, treeY - th * 0.3);
        ctx.lineTo(tx + Math.cos(angle) * 20, treeY - th * 0.3 - Math.sin(Math.abs(angle)) * 18);
        ctx.stroke();
      }
    } else {
      // Leafy canopy
      const leafAlpha = (restorationProgress - 0.4) / 0.6;
      ctx.globalAlpha = leafAlpha;
      ctx.fillStyle = visuals.palette.accent;
      ctx.beginPath();
      ctx.ellipse(tx, treeY - th * 0.45, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawLake(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, time, restorationProgress } = rc;
  const lakeY = height * 0.45;
  const lakeH = height * 0.3;

  // Lake surface
  if (visuals.palette.water) {
    const grad = ctx.createLinearGradient(0, lakeY, 0, lakeY + lakeH);
    grad.addColorStop(0, visuals.palette.water[0]);
    grad.addColorStop(1, visuals.palette.water[1]);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = visuals.palette.sky[1];
  }
  ctx.fillRect(0, lakeY, width, lakeH);

  // Ice cracks (cursed) or gentle ripples (restored)
  if (restorationProgress < 0.5) {
    // Ice cracks
    ctx.strokeStyle = "#4a5a6a";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, lakeY + 20);
    ctx.lineTo(width * 0.4, lakeY + 40);
    ctx.lineTo(width * 0.35, lakeY + 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.6, lakeY + 15);
    ctx.lineTo(width * 0.75, lakeY + 35);
    ctx.lineTo(width * 0.7, lakeY + 55);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    // Water ripples
    const rippleAlpha = (restorationProgress - 0.5) / 0.5 * 0.2;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.globalAlpha = rippleAlpha;
    for (let r = 0; r < 3; r++) {
      const rx = width * (0.3 + r * 0.2) + Math.sin(time * 0.5 + r) * 20;
      const ry = lakeY + lakeH * 0.4 + Math.sin(time * 0.3 + r * 2) * 10;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 30 + Math.sin(time + r) * 10, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Star reflections in water (restored)
  if (restorationProgress > 0.6) {
    const refAlpha = (restorationProgress - 0.6) / 0.4 * 0.3;
    ctx.fillStyle = "#fffacd";
    ctx.globalAlpha = refAlpha;
    for (let i = 0; i < 8; i++) {
      const sx = width * (0.1 + i * 0.1 + Math.sin(i * 3) * 0.03);
      const sy = lakeY + lakeH * 0.3 + Math.sin(time * 0.8 + i * 2) * 5;
      const shimmer = Math.sin(time * 2 + i * 1.5) * 0.4 + 0.6;
      ctx.globalAlpha = refAlpha * shimmer;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawShore(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const shoreY = height * 0.72;

  const grad = ctx.createLinearGradient(0, shoreY, 0, height);
  grad.addColorStop(0, visuals.palette.ground[0]);
  grad.addColorStop(1, visuals.palette.ground[1]);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, shoreY + 5);
  ctx.quadraticCurveTo(width * 0.25, shoreY - 5, width * 0.5, shoreY + 8);
  ctx.quadraticCurveTo(width * 0.75, shoreY + 15, width, shoreY + 3);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Pebbles
  ctx.fillStyle = visuals.palette.accent;
  ctx.globalAlpha = 0.4;
  const pebbles = [0.15, 0.3, 0.5, 0.65, 0.8, 0.9];
  for (const px of pebbles) {
    ctx.beginPath();
    ctx.ellipse(px * width, shoreY + 10 + Math.sin(px * 11) * 5, 4, 2.5, Math.sin(px * 7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export const starfallLake: SceneDefinition = {
  id: "starfall_lake",
  name: "Starfall Lake",
  cursedDescription: "A frozen lake stretches before you, its surface cracked gray ice. Bare skeletal trees ring the shore. Not a single star reflects in its dead surface.",
  restoredDescription: "The lake shimmers with liquid starlight! Every star above has its twin below. Fish leap in silver arcs. Trees along the shore have burst into bloom.",
  exits: {
    west: "wizards_tower",
    north: "throne_room",
  },
  items: [],
  layers: [
    { id: "sky", parallax: 0, draw: drawNightSky },
    { id: "trees", parallax: 0.1, draw: drawDistantTrees },
    { id: "lake", parallax: 0.25, draw: drawLake },
    { id: "shore", parallax: 0.4, draw: drawShore },
  ],
  cursedVisuals: {
    saturation: 0.0,
    brightness: 0.35,
    fogDensity: 0.15,
    palette: {
      sky: ["#0a0a10", "#1a1a20"],
      ground: ["#2a2a28", "#1a1a18"],
      accent: "#3a3a38",
      water: ["#1a1a20", "#101018"],
      fog: "#3a3a40",
    },
  },
  restoredVisuals: {
    saturation: 1.0,
    brightness: 0.9,
    fogDensity: 0.0,
    palette: {
      sky: ["#060818", "#0e1430"],
      ground: ["#2a3a28", "#1a2a18"],
      accent: "#4a5a48",
      water: ["#0e1840", "#081030"],
      fog: "#2a3a50",
    },
  },
  hotspots: [
    { id: "lake_surface", bounds: { x: 200, y: 320, width: 800, height: 180 }, action: "puzzle", target: "ice_drawing" },
    { id: "shore_examine", bounds: { x: 100, y: 500, width: 400, height: 80 }, action: "examine", target: "shore" },
  ],
  creatures: [
    { id: "fish", type: "fish", x: 500, y: 400, scale: 1, showWhen: "restored" },
  ],
  particles: [
    {
      id: "snow", x: 0, y: 180, width: 1200, height: 0,
      rate: 10, lifetime: [3, 6], velocity: { x: [-8, 8], y: [15, 35] },
      size: [1, 3], cursedColor: "#8a8a90", restoredColor: "#ffffff",
      shape: "snowflake", showWhen: "cursed",
    },
    {
      id: "star_motes", x: 100, y: 300, width: 1000, height: 200,
      rate: 2, lifetime: [3, 7], velocity: { x: [-5, 5], y: [-8, 3] },
      size: [1, 3], cursedColor: "#333333", restoredColor: "#fffacd",
      shape: "star", blendMode: "lighter", showWhen: "restored",
    },
  ],
  music: {
    droneFreq: 48, droneType: "sine", droneVolume: 0.1,
    baseNote: 60, scale: [0, 2, 4, 7, 9], // major pentatonic
    tempo: 55, cursedFilterCutoff: 100, restoredFilterCutoff: 4000,
    melodyPattern: [4, 2, 0, 3, 1, 4, 2, 0], melodyRhythm: [3, 1, 2, 2, 1, 2, 1, 4],
    ambientType: "silence", ambientVolume: 0,
  },
  puzzleId: "ice_drawing",
  guardianCreature: "fish",
  restorationToken: "token_lake",
};
