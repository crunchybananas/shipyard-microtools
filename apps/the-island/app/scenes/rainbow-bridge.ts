/**
 * Rainbow Bridge — Scene 5 of The Fading Kingdom
 *
 * CURSED: A shattered stone bridge over a bottomless chasm. Gray mist rises.
 * RESTORED: A complete rainbow bridge arcs across the chasm, clouds below shimmer.
 *
 * PUZZLE: Collect and sort 7 color fragments into spectral order (ROYGBIV).
 * GUARDIAN: Phoenix
 */

import type { SceneDefinition, SceneRenderContext } from "the-island/scenes/types";
import { lerp } from "the-island/scenes/types";

function drawSky(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.4);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.4);
}

function drawChasm(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, time } = rc;
  // Deep chasm below — dark abyss
  const chasmY = height * 0.55;
  ctx.fillStyle = visuals.palette.ground[1];
  ctx.fillRect(0, chasmY, width, height - chasmY);

  // Rising mist from chasm
  ctx.globalAlpha = lerp(0.4, 0.1, rc.restorationProgress);
  ctx.fillStyle = visuals.palette.fog ?? "#4a4a50";
  for (let i = 0; i < 4; i++) {
    const mx = width * (0.2 + i * 0.2) + Math.sin(time * 0.3 + i * 2) * 40;
    const my = chasmY - 10 + Math.sin(time * 0.2 + i) * 15;
    ctx.beginPath();
    ctx.ellipse(mx, my, width * 0.12, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCliffs(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const cliffY = height * 0.4;

  // Left cliff
  ctx.fillStyle = visuals.palette.ground[0];
  ctx.beginPath();
  ctx.moveTo(0, cliffY);
  ctx.lineTo(width * 0.28, cliffY);
  ctx.lineTo(width * 0.3, cliffY + 15);
  ctx.lineTo(width * 0.25, height * 0.55);
  ctx.lineTo(0, height * 0.55);
  ctx.closePath();
  ctx.fill();

  // Right cliff
  ctx.beginPath();
  ctx.moveTo(width, cliffY);
  ctx.lineTo(width * 0.72, cliffY);
  ctx.lineTo(width * 0.7, cliffY + 15);
  ctx.lineTo(width * 0.75, height * 0.55);
  ctx.lineTo(width, height * 0.55);
  ctx.closePath();
  ctx.fill();

  // Cliff edges / texture
  ctx.strokeStyle = visuals.palette.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(width * 0.28, cliffY);
  ctx.lineTo(width * 0.25, height * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width * 0.72, cliffY);
  ctx.lineTo(width * 0.75, height * 0.55);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBridge(rc: SceneRenderContext): void {
  const { ctx, width, height, restorationProgress, time } = rc;
  const bridgeY = height * 0.42;

  if (restorationProgress < 0.3) {
    // Broken bridge — just stumps on each side
    ctx.fillStyle = "#3a3830";
    ctx.fillRect(width * 0.25, bridgeY, width * 0.05, 20);
    ctx.fillRect(width * 0.7, bridgeY, width * 0.05, 20);
    // Broken planks hanging
    ctx.strokeStyle = "#4a4838";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.3, bridgeY + 10);
    ctx.lineTo(width * 0.35, bridgeY + 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.7, bridgeY + 10);
    ctx.lineTo(width * 0.65, bridgeY + 35);
    ctx.stroke();
    return;
  }

  // Rainbow bridge forming
  const bridgeAlpha = (restorationProgress - 0.3) / 0.7;
  ctx.globalAlpha = bridgeAlpha;

  const colors = ["#ff0000", "#ff7700", "#ffff00", "#00cc00", "#0077ff", "#4400ff", "#8800ff"];
  const bridgeWidth = width * 0.45;
  const startX = width * 0.275;
  const arcHeight = 60;

  for (let i = 0; i < colors.length; i++) {
    const y = bridgeY - 5 + i * 4;
    ctx.strokeStyle = colors[i]!;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.quadraticCurveTo(startX + bridgeWidth / 2, y - arcHeight, startX + bridgeWidth, y);
    ctx.stroke();

    // Shimmer
    const shimmer = Math.sin(time * 3 + i * 0.5) * 0.2 + 0.8;
    ctx.globalAlpha = bridgeAlpha * shimmer * 0.3;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.globalAlpha = bridgeAlpha;
  }

  ctx.globalAlpha = 1;
}

function drawClouds(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  if (restorationProgress < 0.5) return;

  const cloudAlpha = (restorationProgress - 0.5) / 0.5 * 0.4;
  ctx.globalAlpha = cloudAlpha;
  ctx.fillStyle = "#ffffff";

  const clouds = [
    { x: 0.2, y: 0.15, rx: 60, ry: 20 },
    { x: 0.5, y: 0.1, rx: 80, ry: 25 },
    { x: 0.8, y: 0.18, rx: 50, ry: 18 },
  ];

  for (const c of clouds) {
    const cx = c.x * width + Math.sin(time * 0.15 + c.x * 5) * 20;
    ctx.beginPath();
    ctx.ellipse(cx, c.y * height, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + c.rx * 0.5, c.y * height + 5, c.rx * 0.7, c.ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export const rainbowBridge: SceneDefinition = {
  id: "rainbow_bridge",
  name: "Rainbow Bridge",
  cursedDescription: "A shattered bridge over a bottomless chasm. The far side is tantalizingly close. Scattered along the cliff edge, seven colored shards of light flicker — fragments of the rainbow that once spanned this gap. Collect them all to rebuild the bridge.",
  restoredDescription: "Seven bands of pure light arc across the void — red, orange, yellow, green, blue, indigo, violet — a bridge made of the spectrum itself. Above it, a phoenix wheels in circles of golden fire, and below, clouds have gathered like an audience at a miracle.",
  exits: {
    south: "the_meadow",
    north: { scene: "wizards_tower", requires: "bridgeComplete" },
  },
  items: [],
  layers: [
    { id: "sky", parallax: 0, draw: drawSky },
    { id: "clouds", parallax: 0.08, draw: drawClouds },
    { id: "chasm", parallax: 0.15, draw: drawChasm },
    { id: "cliffs", parallax: 0.3, draw: drawCliffs },
    { id: "bridge", parallax: 0.35, draw: drawBridge },
  ],
  cursedVisuals: {
    saturation: 0.02,
    brightness: 0.4,
    fogDensity: 0.3,
    palette: {
      sky: ["#1a1a1e", "#2a2a30"],
      ground: ["#2a2a2e", "#1a1a1e"],
      accent: "#3a3a40",
      fog: "#5a5a60",
    },
  },
  restoredVisuals: {
    saturation: 1.0,
    brightness: 1.1,
    fogDensity: 0.0,
    palette: {
      sky: ["#2060b0", "#60a0d0"],
      ground: ["#4a4840", "#3a3830"],
      accent: "#6a6860",
      fog: "#c0d0e0",
    },
  },
  hotspots: [
    { id: "bridge_center", bounds: { x: 400, y: 280, width: 400, height: 80 }, action: "puzzle", target: "rainbow_fragments" },
    { id: "chasm_look", bounds: { x: 300, y: 400, width: 600, height: 100 }, action: "examine", target: "chasm" },
  ],
  creatures: [
    { id: "phoenix", type: "phoenix", x: 600, y: 200, scale: 1.5, showWhen: "restored" },
  ],
  particles: [
    {
      id: "chasm_mist", x: 200, y: 450, width: 800, height: 0,
      rate: 3, lifetime: [3, 6], velocity: { x: [-5, 5], y: [-30, -10] },
      size: [5, 12], cursedColor: "#4a4a50", restoredColor: "#c0d0e0",
      shape: "circle", showWhen: "always",
    },
    {
      id: "rainbow_sparks", x: 300, y: 280, width: 600, height: 60,
      rate: 8, lifetime: [0.5, 1.5], velocity: { x: [-20, 20], y: [-30, 10] },
      size: [1, 3], cursedColor: "#555555", restoredColor: "#ffd700",
      shape: "star", blendMode: "lighter", showWhen: "restored",
    },
  ],
  music: {
    droneFreq: 73, droneType: "sine", droneVolume: 0.12,
    baseNote: 67, scale: [0, 2, 4, 5, 7, 9, 11], // Lydian
    tempo: 110, cursedFilterCutoff: 150, restoredFilterCutoff: 7000,
    melodyPattern: [0, 2, 4, 6, 4, 2, 0, 3], melodyRhythm: [1, 1, 1, 2, 1, 1, 1, 2],
    ambientType: "wind", ambientVolume: 0.25,
  },
  puzzleId: "rainbow_fragments",
  guardianCreature: "phoenix",
  restorationToken: "token_bridge",
};
