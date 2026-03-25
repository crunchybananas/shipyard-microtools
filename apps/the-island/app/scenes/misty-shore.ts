/**
 * Misty Shore — Scene 1 of The Fading Kingdom
 *
 * CURSED: Gray fog blankets a lifeless beach. Rain falls steadily.
 *         Dull waves lap at colorless sand. A crab lies motionless.
 *
 * RESTORED: Blue ocean sparkles under clear skies. Golden sand glows warm.
 *           A freed crab scuttles happily. Sparkle motes drift on the breeze.
 *
 * PUZZLE: Find 3 hidden shells in the sand by clicking the right spots.
 * GUARDIAN: Crab
 */

import type {
  SceneDefinition,
  SceneRenderContext,
} from "the-island/scenes/types";

// ============================================
// LAYER DRAWING FUNCTIONS
// ============================================

function drawSky(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.55);
}

function drawStars(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  // Stars only appear as restoration progresses (sky clears)
  const starAlpha = Math.max(0, (restorationProgress - 0.3) / 0.7);
  if (starAlpha <= 0) return;

  ctx.fillStyle = "#fffacd";
  const stars = [
    [0.08, 0.08], [0.2, 0.15], [0.35, 0.06], [0.5, 0.12], [0.65, 0.05],
    [0.78, 0.14], [0.88, 0.08], [0.15, 0.22], [0.45, 0.2], [0.72, 0.18],
    [0.92, 0.12], [0.3, 0.1], [0.58, 0.16], [0.82, 0.06],
  ];

  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    if (!star) continue;
    const twinkle = Math.sin(time * (1.5 + i * 0.3) + i * 2) * 0.3 + 0.7;
    ctx.globalAlpha = starAlpha * twinkle * 0.7;
    const size = (1 + (i % 3) * 0.5) * (width / 1200);
    ctx.beginPath();
    ctx.arc((star[0] ?? 0) * width, (star[1] ?? 0) * height, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMoon(rc: SceneRenderContext): void {
  const { ctx, width, height, restorationProgress } = rc;
  const moonAlpha = Math.max(0.2, restorationProgress);
  const cx = width * 0.82;
  const cy = height * 0.15;
  const r = width * 0.03;

  // Glow
  ctx.save();
  ctx.globalAlpha = moonAlpha * 0.3;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
  glow.addColorStop(0, "#fffacd");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);

  // Moon body
  ctx.globalAlpha = moonAlpha;
  ctx.fillStyle = "#f5edc0";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Craters
  ctx.fillStyle = "#d8cc90";
  ctx.globalAlpha = moonAlpha * 0.4;
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.2, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.2, cy + r * 0.25, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHeadland(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Distant headland silhouette on the left
  ctx.fillStyle = visuals.palette.sky[1];
  ctx.beginPath();
  ctx.moveTo(0, height * 0.48);
  ctx.quadraticCurveTo(width * 0.05, height * 0.42, width * 0.1, height * 0.44);
  ctx.quadraticCurveTo(width * 0.14, height * 0.41, width * 0.18, height * 0.46);
  ctx.lineTo(width * 0.18, height * 0.5);
  ctx.lineTo(0, height * 0.5);
  ctx.closePath();
  ctx.fill();

  // Tiny lighthouse on headland
  ctx.fillStyle = visuals.palette.accent;
  ctx.fillRect(width * 0.09 - 2, height * 0.39, 4, height * 0.05);
  // Light
  ctx.fillStyle = "#ffd700";
  ctx.globalAlpha = 0.4 + Math.sin(rc.time * 2) * 0.2;
  ctx.beginPath();
  ctx.arc(width * 0.09, height * 0.39, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawMoonReflection(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  // Moon reflection on water — only visible when somewhat restored
  const refAlpha = Math.max(0.1, restorationProgress * 0.3);
  const cx = width * 0.82;
  const ry = height * 0.52;

  ctx.fillStyle = "#fffacd";
  ctx.globalAlpha = refAlpha;

  // Shimmering reflection lines
  for (let i = 0; i < 5; i++) {
    const lineY = ry + i * 8;
    const lineW = 20 - i * 3;
    const shimmer = Math.sin(time * 2 + i * 1.5) * 3;
    ctx.fillRect(cx - lineW / 2 + shimmer, lineY, lineW, 1.5);
  }
  ctx.globalAlpha = 1;
}

function drawOcean(rc: SceneRenderContext): void {
  const { ctx, width, height, time, visuals } = rc;
  const oceanTop = height * 0.45;
  const oceanBottom = height * 0.65;

  // Base ocean
  if (visuals.palette.water) {
    const grad = ctx.createLinearGradient(0, oceanTop, 0, oceanBottom);
    grad.addColorStop(0, visuals.palette.water[0]);
    grad.addColorStop(1, visuals.palette.water[1]);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = visuals.palette.sky[1];
  }
  ctx.fillRect(0, oceanTop, width, oceanBottom - oceanTop);

  // Animated wave layers
  for (let layer = 0; layer < 3; layer++) {
    const waveY = oceanTop + (layer + 1) * (oceanBottom - oceanTop) * 0.25;
    const amplitude = 4 + layer * 2;
    const speed = 0.8 - layer * 0.2;
    const freq = 0.005 + layer * 0.002;
    const alpha = 0.3 - layer * 0.08;

    ctx.beginPath();
    ctx.moveTo(0, waveY);
    for (let x = 0; x <= width; x += 4) {
      const y =
        waveY +
        Math.sin(x * freq + time * speed + layer * 1.5) * amplitude +
        Math.sin(x * freq * 2.3 + time * speed * 0.7) * amplitude * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, oceanBottom);
    ctx.lineTo(0, oceanBottom);
    ctx.closePath();

    ctx.fillStyle =
      layer === 0
        ? visuals.palette.water?.[0] ?? "#1e3f5e"
        : layer === 1
          ? visuals.palette.water?.[1] ?? "#162e48"
          : "#0c1e30";
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Foam line
  const foamY = oceanBottom - 5;
  ctx.strokeStyle = "#a0c4d4";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 3) {
    const y = foamY + Math.sin(x * 0.008 + time * 1.2) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBeach(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const beachTop = height * 0.6;

  const grad = ctx.createLinearGradient(0, beachTop, 0, height);
  grad.addColorStop(0, visuals.palette.ground[0]);
  grad.addColorStop(1, visuals.palette.ground[1]);
  ctx.fillStyle = grad;

  // Gentle curve for beach
  ctx.beginPath();
  ctx.moveTo(0, beachTop + 10);
  ctx.quadraticCurveTo(width * 0.3, beachTop - 5, width * 0.5, beachTop + 8);
  ctx.quadraticCurveTo(width * 0.7, beachTop + 20, width, beachTop + 5);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Sand grain texture
  ctx.strokeStyle = visuals.palette.ground[1];
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    const y = beachTop + 20 + i * 15;
    ctx.beginPath();
    ctx.moveTo(width * (i * 0.05), y);
    ctx.quadraticCurveTo(
      width * (0.2 + i * 0.08),
      y - 3,
      width * (0.5 + i * 0.05),
      y + 2,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRocks(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const baseY = height * 0.68;

  // Left rock cluster
  ctx.fillStyle = visuals.palette.accent;
  drawRockShape(ctx, width * 0.15, baseY, width * 0.1, height * 0.06);
  drawRockShape(ctx, width * 0.22, baseY + 5, width * 0.07, height * 0.04);

  // Right rock cluster
  drawRockShape(ctx, width * 0.78, baseY + 3, width * 0.09, height * 0.05);
  drawRockShape(ctx, width * 0.85, baseY - 2, width * 0.06, height * 0.04);

  // Tide pool in right rocks
  ctx.fillStyle = visuals.palette.water?.[1] ?? "#0a1520";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(
    width * 0.82,
    baseY + height * 0.03,
    width * 0.02,
    height * 0.01,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRockShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.quadraticCurveTo(cx - rx * 0.8, cy - ry, cx, cy - ry * 0.9);
  ctx.quadraticCurveTo(cx + rx * 0.8, cy - ry, cx + rx, cy);
  ctx.quadraticCurveTo(cx + rx * 0.6, cy + ry * 0.5, cx, cy + ry * 0.3);
  ctx.quadraticCurveTo(cx - rx * 0.6, cy + ry * 0.5, cx - rx, cy);
  ctx.fill();

  // Highlight edge
  ctx.strokeStyle = "#5a5a68";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.6, cy - ry * 0.6);
  ctx.quadraticCurveTo(cx, cy - ry * 0.8, cx + rx * 0.5, cy - ry * 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawSeaweed(rc: SceneRenderContext): void {
  const { ctx, width, height, time } = rc;
  const baseY = height * 0.82;

  ctx.strokeStyle = "#2d4a3e";
  ctx.lineWidth = 2.5;

  // Several seaweed strands swaying
  const strands = [
    { x: 0.55, h: 0.06 },
    { x: 0.57, h: 0.05 },
    { x: 0.42, h: 0.04 },
  ];
  for (const strand of strands) {
    const sx = strand.x * width;
    const sway = Math.sin(time * 1.5 + strand.x * 10) * 5;
    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.quadraticCurveTo(
      sx + sway,
      baseY - strand.h * height * 0.5,
      sx + sway * 0.5,
      baseY - strand.h * height,
    );
    ctx.stroke();
  }
}

function drawDriftwood(rc: SceneRenderContext): void {
  const { ctx, width, height } = rc;
  const y = height * 0.76;

  ctx.strokeStyle = "#5c4033";
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width * 0.38, y);
  ctx.quadraticCurveTo(width * 0.43, y - 5, width * 0.5, y - 2);
  ctx.stroke();

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.38, y);
  ctx.lineTo(width * 0.35, y + 3);
  ctx.stroke();
}

// ============================================
// SCENE DEFINITION
// ============================================

export const mistyShore: SceneDefinition = {
  id: "misty_shore",
  name: "Misty Shore",

  cursedDescription:
    "You wake on cold, colorless sand. Rain falls from a sky the shade of ash. Three paths lead from this shore — north into dark woods, east across dead fields, west toward a frozen lake. But first: faint golden glimmers in the sand. Three shells hide here. Touch the glowing spots to search...",
  restoredDescription:
    "Warmth floods back like a held breath released. The ocean remembers its blue, the sand its gold, and the sun its place in the sky. A little crab appears from behind a rock, claws raised in triumph. The shore is alive again.",

  exits: {
    north: "whispering_woods",
    east: "the_meadow",
    west: "starfall_lake",
  },

  items: ["shell_1", "shell_2", "shell_3"],

  layers: [
    { id: "sky", parallax: 0, draw: drawSky },
    { id: "stars", parallax: 0.02, draw: drawStars },
    { id: "moon", parallax: 0.05, draw: drawMoon },
    { id: "headland", parallax: 0.1, draw: drawHeadland },
    { id: "ocean", parallax: 0.2, draw: drawOcean },
    { id: "moon-reflection", parallax: 0.22, draw: drawMoonReflection },
    { id: "beach", parallax: 0.4, draw: drawBeach },
    { id: "rocks", parallax: 0.5, draw: drawRocks },
    { id: "driftwood", parallax: 0.55, draw: drawDriftwood },
    { id: "seaweed", parallax: 0.6, draw: drawSeaweed },
  ],

  cursedVisuals: {
    saturation: 0.05,
    brightness: 0.5,
    fogDensity: 0.35,
    palette: {
      sky: ["#1a1a20", "#2a2a30"],
      ground: ["#4a4a48", "#3a3a38"],
      accent: "#3e3e42",
      water: ["#2a2a30", "#1a1a20"],
      fog: "#6a6a70",
    },
  },

  restoredVisuals: {
    saturation: 1.0,
    brightness: 1.0,
    fogDensity: 0.0,
    palette: {
      sky: ["#0a1a3a", "#2a4a6e"],
      ground: ["#c8a870", "#8a7050"],
      accent: "#5a5a68",
      water: ["#1e4a6e", "#0c2a48"],
      fog: "#88aacc",
    },
  },

  hotspots: [
    {
      id: "rocks_left",
      bounds: { x: 100, y: 450, width: 200, height: 120 },
      action: "examine",
      target: "rocks",
    },
    {
      id: "shell_spot_1",
      bounds: { x: 250, y: 380, width: 180, height: 140 },
      action: "puzzle",
      target: "shell_1",
      cursor: "grab",
    },
    {
      id: "shell_spot_2",
      bounds: { x: 460, y: 390, width: 180, height: 140 },
      action: "puzzle",
      target: "shell_2",
      cursor: "grab",
    },
    {
      id: "shell_spot_3",
      bounds: { x: 720, y: 370, width: 180, height: 140 },
      action: "puzzle",
      target: "shell_3",
      cursor: "grab",
    },
    {
      id: "waves",
      bounds: { x: 0, y: 300, width: 1200, height: 150 },
      action: "examine",
      target: "waves",
    },
  ],

  creatures: [
    {
      id: "crab",
      type: "crab",
      x: 600,
      y: 520,
      scale: 1,
      showWhen: "restored",
    },
  ],

  particles: [
    // Rain (cursed state)
    {
      id: "rain",
      x: 0,
      y: 180,
      width: 1200,
      height: 0,
      rate: 80,
      lifetime: [0.8, 1.5],
      velocity: { x: [-20, -10], y: [200, 350] },
      size: [1, 2],
      cursedColor: "#6688aa",
      restoredColor: "#6688aa",
      shape: "line",
      showWhen: "cursed",
    },
    // Sparkle motes (restored state)
    {
      id: "sparkles",
      x: 100,
      y: 300,
      width: 1000,
      height: 300,
      rate: 3,
      lifetime: [3, 6],
      velocity: { x: [-10, 10], y: [-20, -5] },
      size: [1, 3],
      cursedColor: "#555555",
      restoredColor: "#ffd700",
      shape: "star",
      blendMode: "lighter",
      showWhen: "restored",
    },
  ],

  music: {
    droneFreq: 55,
    droneType: "sine",
    droneVolume: 0.15,
    baseNote: 60,
    scale: [0, 2, 3, 5, 7, 8, 10], // natural minor
    tempo: 72,
    cursedFilterCutoff: 200,
    restoredFilterCutoff: 4000,
    melodyPattern: [0, 2, 4, 3, 1, 0],
    melodyRhythm: [2, 1, 1, 2, 1, 3],
    ambientType: "rain",
    ambientVolume: 0.3,
  },

  puzzleId: "shells",
  guardianCreature: "crab",
  restorationToken: "token_shore",
};
