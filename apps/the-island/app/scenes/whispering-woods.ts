/**
 * Whispering Woods — Scene 2 of The Fading Kingdom
 *
 * CURSED: Dead gray trees stand like skeletons. No birdsong, no wind.
 *         An owl sits trapped in an iron cage, eyes dim.
 *
 * RESTORED: Lush green canopy alive with birdsong and fireflies.
 *           The freed owl perches proudly on a branch, eyes glowing gold.
 *
 * PUZZLE: Arrange symbols on the owl's cage in the correct order.
 * GUARDIAN: Owl
 */

import type {
  SceneDefinition,
  SceneRenderContext,
} from "the-island/scenes/types";
import { lerp } from "the-island/scenes/types";

// ============================================
// LAYER DRAWING FUNCTIONS
// ============================================

function drawSky(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Barely visible sky through canopy gaps
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.4);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.4);
}

function drawBackTrees(rc: SceneRenderContext): void {
  const { ctx, width, height, restorationProgress } = rc;
  // Distant tree silhouettes — gain color with restoration
  const trunkColor = `rgb(${lerp(30, 28, restorationProgress)}, ${lerp(25, 20, restorationProgress)}, ${lerp(25, 14, restorationProgress)})`;
  const leafColor = `rgb(${lerp(25, 15, restorationProgress)}, ${lerp(30, 45, restorationProgress)}, ${lerp(25, 15, restorationProgress)})`;

  const trees = [
    { x: 0.05, trunkH: 0.7, canopyR: 0.08 },
    { x: 0.15, trunkH: 0.6, canopyR: 0.07 },
    { x: 0.28, trunkH: 0.75, canopyR: 0.09 },
    { x: 0.72, trunkH: 0.65, canopyR: 0.08 },
    { x: 0.85, trunkH: 0.7, canopyR: 0.07 },
    { x: 0.95, trunkH: 0.75, canopyR: 0.09 },
  ];

  ctx.globalAlpha = 0.5;
  for (const tree of trees) {
    const tx = tree.x * width;
    const groundY = height * 0.85;
    const trunkTop = groundY - tree.trunkH * height * 0.5;

    // Trunk
    ctx.fillStyle = trunkColor;
    ctx.fillRect(tx - width * 0.012, trunkTop, width * 0.024, groundY - trunkTop);

    // Canopy
    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.ellipse(tx, trunkTop - height * 0.02, tree.canopyR * width, tree.canopyR * width * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLightShafts(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  // Light shafts visible mostly in restored state
  const shaftAlpha = lerp(0.03, 0.1, restorationProgress);
  if (shaftAlpha <= 0.01) return;

  const shafts = [
    { x1: 0.25, x2: 0.35, speed: 0.15 },
    { x1: 0.55, x2: 0.62, speed: 0.12 },
    { x1: 0.75, x2: 0.82, speed: 0.18 },
  ];

  for (const shaft of shafts) {
    const pulse = Math.sin(time * shaft.speed) * 0.3 + 0.7;
    ctx.globalAlpha = shaftAlpha * pulse;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#c8d8a0");
    grad.addColorStop(0.6, "#a0b880");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(shaft.x1 * width, 0);
    ctx.lineTo(shaft.x2 * width, 0);
    ctx.lineTo((shaft.x2 + 0.08) * width, height * 0.85);
    ctx.lineTo((shaft.x1 - 0.02) * width, height * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGround(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const groundY = height * 0.75;

  const grad = ctx.createLinearGradient(0, groundY, 0, height);
  grad.addColorStop(0, visuals.palette.ground[0]);
  grad.addColorStop(1, visuals.palette.ground[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY, width, height - groundY);

  // Moss patches
  ctx.fillStyle = visuals.palette.accent;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(width * 0.3, groundY + 15, width * 0.06, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width * 0.7, groundY + 20, width * 0.05, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPath(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Winding path through center
  const pathColor = visuals.palette.ground[1];
  ctx.strokeStyle = pathColor;
  ctx.lineCap = "round";

  // Outer path
  ctx.lineWidth = width * 0.06;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.45, height);
  ctx.quadraticCurveTo(width * 0.48, height * 0.85, width * 0.5, height * 0.75);
  ctx.quadraticCurveTo(width * 0.53, height * 0.6, width * 0.48, height * 0.4);
  ctx.quadraticCurveTo(width * 0.44, height * 0.2, width * 0.5, 0);
  ctx.stroke();

  // Inner lighter path
  ctx.lineWidth = width * 0.025;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(width * 0.46, height);
  ctx.quadraticCurveTo(width * 0.49, height * 0.85, width * 0.5, height * 0.75);
  ctx.quadraticCurveTo(width * 0.52, height * 0.6, width * 0.49, height * 0.4);
  ctx.quadraticCurveTo(width * 0.45, height * 0.2, width * 0.5, 0);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function drawForegroundTrees(rc: SceneRenderContext): void {
  const { ctx, width, height, restorationProgress } = rc;

  // Left massive tree
  drawTree(ctx, width * 0.08, height, width * 0.04, height * 0.75, width * 0.15, restorationProgress);

  // Right massive tree
  drawTree(ctx, width * 0.92, height, width * 0.035, height * 0.7, width * 0.14, restorationProgress);

  // Branch reaching across
  const branchColor = `rgb(${lerp(40, 35, restorationProgress)}, ${lerp(30, 22, restorationProgress)}, ${lerp(28, 15, restorationProgress)})`;
  ctx.strokeStyle = branchColor;
  ctx.lineCap = "round";
  ctx.lineWidth = width * 0.012;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, height * 0.35);
  ctx.quadraticCurveTo(width * 0.25, height * 0.32, width * 0.35, height * 0.37);
  ctx.stroke();

  // Small branches off the main branch
  ctx.lineWidth = width * 0.005;
  ctx.beginPath();
  ctx.moveTo(width * 0.25, height * 0.33);
  ctx.quadraticCurveTo(width * 0.28, height * 0.28, width * 0.3, height * 0.3);
  ctx.stroke();
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  trunkW: number,
  trunkH: number,
  canopyR: number,
  progress: number,
): void {
  const trunkTop = groundY - trunkH;

  // Trunk
  const trunkR = lerp(30, 28, progress);
  const trunkG = lerp(22, 18, progress);
  const trunkB = lerp(20, 12, progress);
  ctx.fillStyle = `rgb(${trunkR}, ${trunkG}, ${trunkB})`;
  ctx.beginPath();
  ctx.moveTo(x - trunkW, groundY);
  ctx.quadraticCurveTo(x - trunkW * 0.8, trunkTop + trunkH * 0.3, x - trunkW * 0.6, trunkTop);
  ctx.quadraticCurveTo(x, trunkTop - trunkH * 0.05, x + trunkW * 0.6, trunkTop);
  ctx.quadraticCurveTo(x + trunkW * 0.8, trunkTop + trunkH * 0.3, x + trunkW, groundY);
  ctx.closePath();
  ctx.fill();

  // Bark texture
  ctx.strokeStyle = `rgb(${trunkR + 10}, ${trunkG + 8}, ${trunkB + 5})`;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 3; i++) {
    const bx = x - trunkW * 0.3 + i * trunkW * 0.3;
    ctx.beginPath();
    ctx.moveTo(bx, trunkTop + trunkH * 0.2);
    ctx.quadraticCurveTo(bx + 3, trunkTop + trunkH * 0.5, bx - 2, trunkTop + trunkH * 0.8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Canopy layers (organic, not ellipse)
  const leafR = lerp(18, 15, progress);
  const leafG = lerp(28, 55, progress);
  const leafB = lerp(18, 15, progress);

  for (let layer = 0; layer < 3; layer++) {
    const layerAlpha = 1 - layer * 0.15;
    const layerOffset = layer * canopyR * 0.15;
    const r = canopyR * (1 - layer * 0.15);

    ctx.fillStyle = `rgba(${leafR + layer * 3}, ${leafG + layer * 5}, ${leafB + layer * 3}, ${layerAlpha})`;
    ctx.beginPath();
    ctx.ellipse(
      x + layerOffset * (layer % 2 === 0 ? 1 : -1),
      trunkTop - canopyR * 0.3 + layer * canopyR * 0.1,
      r,
      r * 0.65,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawMushrooms(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  const baseY = height * 0.8;

  const mushrooms = [
    { x: 0.25, scale: 1 },
    { x: 0.27, scale: 0.7 },
    { x: 0.24, scale: 0.85 },
  ];

  for (const m of mushrooms) {
    const mx = m.x * width;
    const ms = m.scale * width * 0.01;

    // Stem
    ctx.fillStyle = `rgb(${lerp(70, 90, restorationProgress)}, ${lerp(55, 64, restorationProgress)}, ${lerp(45, 48, restorationProgress)})`;
    ctx.fillRect(mx - ms * 0.3, baseY - ms * 1.5, ms * 0.6, ms * 1.5);

    // Cap
    ctx.fillStyle = `rgb(${lerp(140, 196, restorationProgress)}, ${lerp(110, 136, restorationProgress)}, ${lerp(80, 58, restorationProgress)})`;
    ctx.beginPath();
    ctx.ellipse(mx, baseY - ms * 1.5, ms, ms * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bioluminescent glow (restored)
    if (restorationProgress > 0.3) {
      const glowAlpha = (restorationProgress - 0.3) / 0.7 * 0.2;
      const pulse = Math.sin(time * 2 + m.x * 10) * 0.1 + 0.9;
      ctx.globalAlpha = glowAlpha * pulse;
      const glow = ctx.createRadialGradient(mx, baseY - ms * 1.2, 0, mx, baseY - ms * 1.2, ms * 3);
      glow.addColorStop(0, "#daa040");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(mx - ms * 3, baseY - ms * 4, ms * 6, ms * 6);
      ctx.globalAlpha = 1;
    }
  }
}

// ============================================
// SCENE DEFINITION
// ============================================

export const whisperingWoods: SceneDefinition = {
  id: "whispering_woods",
  name: "Whispering Woods",

  cursedDescription:
    "The forest holds its breath. Gray trees stand like pillars of stone, their branches bare and reaching. In the hush, you spot a rusted iron cage hanging from a branch — inside, an owl sits still as death, its eyes sealed shut. Something ancient waits here.",
  restoredDescription:
    "The forest exhales. Green surges through every branch like a river finding its bed. Fireflies spark into existence, each one a tiny lantern. The owl spreads its wings and turns its golden eyes toward you — not in fear, but recognition. You are remembered here.",

  exits: {
    south: "misty_shore",
    north: "crystal_caverns",
  },

  items: [],

  layers: [
    { id: "sky", parallax: 0, draw: drawSky },
    { id: "back-trees", parallax: 0.1, draw: drawBackTrees },
    { id: "light-shafts", parallax: 0.15, draw: drawLightShafts },
    { id: "ground", parallax: 0.35, draw: drawGround },
    { id: "path", parallax: 0.4, draw: drawPath },
    { id: "mushrooms", parallax: 0.5, draw: drawMushrooms },
    { id: "foreground-trees", parallax: 0.7, draw: drawForegroundTrees },
  ],

  cursedVisuals: {
    saturation: 0.02,
    brightness: 0.4,
    fogDensity: 0.2,
    palette: {
      sky: ["#0a0a10", "#141418"],
      ground: ["#1a1a18", "#0e0e0c"],
      accent: "#1a2a18",
      fog: "#3a3a40",
    },
  },

  restoredVisuals: {
    saturation: 1.0,
    brightness: 0.95,
    fogDensity: 0.0,
    palette: {
      sky: ["#060810", "#0e1418"],
      ground: ["#1a3018", "#0e1a0c"],
      accent: "#2a4a28",
      fog: "#2a4a2a",
    },
  },

  hotspots: [
    {
      id: "owl_cage",
      bounds: { x: 500, y: 300, width: 200, height: 150 },
      action: "puzzle",
      target: "owl_cage",
    },
    {
      id: "fallen_log",
      bounds: { x: 650, y: 480, width: 200, height: 80 },
      action: "examine",
      target: "log",
    },
    {
      id: "mushrooms",
      bounds: { x: 250, y: 500, width: 100, height: 80 },
      action: "examine",
      target: "mushrooms",
    },
  ],

  creatures: [
    {
      id: "owl",
      type: "owl",
      x: 600,
      y: 350,
      scale: 1.2,
      showWhen: "always", // visible in both states (caged vs freed)
    },
  ],

  particles: [
    // Fireflies (restored state)
    {
      id: "fireflies",
      x: 200,
      y: 250,
      width: 800,
      height: 300,
      rate: 1.5,
      lifetime: [4, 8],
      velocity: { x: [-8, 8], y: [-12, 5] },
      size: [2, 4],
      cursedColor: "#555555",
      restoredColor: "#e8e0a0",
      shape: "circle",
      blendMode: "lighter",
      showWhen: "restored",
    },
  ],

  music: {
    droneFreq: 65,
    droneType: "triangle",
    droneVolume: 0.12,
    baseNote: 62,
    scale: [0, 2, 4, 5, 7, 9, 11], // major scale
    tempo: 80,
    cursedFilterCutoff: 150,
    restoredFilterCutoff: 3500,
    melodyPattern: [0, 4, 2, 5, 3, 1, 0],
    melodyRhythm: [2, 1, 1, 2, 1, 1, 2],
    ambientType: "silence",
    ambientVolume: 0,
  },

  puzzleId: "owl_cage",
  guardianCreature: "owl",
  restorationToken: "token_woods",
};
