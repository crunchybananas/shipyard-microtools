/**
 * Wizard's Tower — Scene 6 of The Fading Kingdom
 *
 * CURSED: A dusty, silent room. Books lie scattered. A music box sits broken.
 * RESTORED: Warm firelight fills the room. Embers float. A cat purrs by the hearth.
 *           The music box plays a gentle melody.
 *
 * PUZZLE: Listen to a melody, then repeat it by clicking colored note buttons.
 * GUARDIAN: Cat
 */

import type { SceneDefinition, SceneRenderContext } from "the-island/scenes/types";
// lerp available from types if needed

function drawWalls(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Stone walls
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Wall texture — stone blocks
  ctx.strokeStyle = visuals.palette.accent;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.1;
  for (let row = 0; row < 10; row++) {
    const y = row * (height / 10);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    const offset = row % 2 === 0 ? 0 : width / 8;
    for (let col = 0; col < 5; col++) {
      ctx.beginPath();
      ctx.moveTo(offset + col * width / 4, y);
      ctx.lineTo(offset + col * width / 4, y + height / 10);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBookshelf(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress } = rc;
  // Left bookshelf
  const shelfX = width * 0.05;
  const shelfW = width * 0.2;
  const shelfH = height * 0.65;
  const shelfY = height * 0.1;

  ctx.fillStyle = visuals.palette.ground[0];
  ctx.fillRect(shelfX, shelfY, shelfW, shelfH);

  // Shelf dividers
  ctx.fillStyle = visuals.palette.ground[1];
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(shelfX, shelfY + i * (shelfH / 4), shelfW, 4);
  }

  // Books
  const bookColors = ["#4a2020", "#203a4a", "#3a4020", "#4a3050", "#50302a", "#2a3a50"];
  for (let shelf = 0; shelf < 4; shelf++) {
    const by = shelfY + shelf * (shelfH / 4) + 6;
    let bx = shelfX + 5;
    for (let b = 0; b < 6 + shelf; b++) {
      const bw = 6 + Math.sin(b * 3 + shelf * 7) * 3;
      const bh = shelfH / 4 - 10 + Math.sin(b * 5) * 3;
      const baseColor = bookColors[b % bookColors.length] ?? "#3a3020";
      ctx.fillStyle = restorationProgress > 0.3 ? baseColor : visuals.palette.accent;
      ctx.fillRect(bx, by, bw, bh);
      bx += bw + 2;
      if (bx > shelfX + shelfW - 10) break;
    }
  }
}

function drawWorkbench(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Right side workbench
  const benchX = width * 0.6;
  const benchY = height * 0.55;
  const benchW = width * 0.35;

  // Table top
  ctx.fillStyle = visuals.palette.ground[0];
  ctx.fillRect(benchX, benchY, benchW, 8);

  // Legs
  ctx.fillRect(benchX + 10, benchY + 8, 8, height * 0.2);
  ctx.fillRect(benchX + benchW - 18, benchY + 8, 8, height * 0.2);

  // Music box on bench
  ctx.fillStyle = visuals.palette.accent;
  ctx.fillRect(benchX + benchW * 0.3, benchY - 25, 50, 25);
  ctx.fillRect(benchX + benchW * 0.3 + 3, benchY - 22, 44, 20);

  // Scattered papers
  ctx.fillStyle = "#c8c0a0";
  ctx.globalAlpha = 0.4;
  ctx.save();
  ctx.translate(benchX + 20, benchY - 10);
  ctx.rotate(-0.15);
  ctx.fillRect(0, 0, 30, 22);
  ctx.restore();
  ctx.save();
  ctx.translate(benchX + benchW - 60, benchY - 12);
  ctx.rotate(0.1);
  ctx.fillRect(0, 0, 25, 18);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawFireplace(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress, time } = rc;
  const fpX = width * 0.35;
  const fpY = height * 0.5;
  const fpW = width * 0.18;
  const fpH = height * 0.3;

  // Fireplace frame
  ctx.fillStyle = visuals.palette.ground[1];
  ctx.fillRect(fpX - 10, fpY - fpH, fpW + 20, fpH + 10);
  ctx.fillStyle = visuals.palette.ground[0];
  ctx.fillRect(fpX, fpY - fpH + 10, fpW, fpH - 10);

  // Fire (restored)
  if (restorationProgress > 0.2) {
    const fireAlpha = (restorationProgress - 0.2) / 0.8;

    // Fire glow
    ctx.globalAlpha = fireAlpha * 0.3;
    const glow = ctx.createRadialGradient(fpX + fpW / 2, fpY - 20, 0, fpX + fpW / 2, fpY - 20, fpW * 1.5);
    glow.addColorStop(0, "#ff8820");
    glow.addColorStop(0.5, "#ff440088");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(fpX - fpW, fpY - fpH, fpW * 3, fpH * 2);

    // Flames
    ctx.globalAlpha = fireAlpha * 0.8;
    for (let f = 0; f < 5; f++) {
      const fx = fpX + fpW * 0.2 + f * fpW * 0.15;
      const fh = 30 + Math.sin(time * 5 + f * 2) * 15;
      const fw = 10 + Math.sin(time * 4 + f * 3) * 4;
      ctx.fillStyle = f % 2 === 0 ? "#ff6600" : "#ffaa00";
      ctx.beginPath();
      ctx.moveTo(fx - fw / 2, fpY - 5);
      ctx.quadraticCurveTo(fx - fw / 4, fpY - fh * 0.6, fx, fpY - fh);
      ctx.quadraticCurveTo(fx + fw / 4, fpY - fh * 0.6, fx + fw / 2, fpY - 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawFloor(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const floorY = height * 0.78;
  ctx.fillStyle = visuals.palette.ground[1];
  ctx.fillRect(0, floorY, width, height - floorY);

  // Rug
  ctx.fillStyle = visuals.palette.accent;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, floorY + 15, width * 0.25, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawWindow(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress } = rc;
  // Arched window on right wall
  const wx = width * 0.82;
  const wy = height * 0.15;
  const ww = width * 0.1;
  const wh = height * 0.3;

  ctx.fillStyle = visuals.palette.sky[1];
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh);
  ctx.lineTo(wx, wy + wh * 0.3);
  ctx.quadraticCurveTo(wx + ww / 2, wy, wx + ww, wy + wh * 0.3);
  ctx.lineTo(wx + ww, wy + wh);
  ctx.closePath();
  ctx.fill();

  // Starlight through window (restored)
  if (restorationProgress > 0.5) {
    const lightAlpha = (restorationProgress - 0.5) / 0.5 * 0.15;
    ctx.globalAlpha = lightAlpha;
    ctx.fillStyle = "#fffacd";
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx - 30, height * 0.78);
    ctx.lineTo(wx + ww + 30, height * 0.78);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Window frame
  ctx.strokeStyle = visuals.palette.ground[0];
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh);
  ctx.lineTo(wx, wy + wh * 0.3);
  ctx.quadraticCurveTo(wx + ww / 2, wy, wx + ww, wy + wh * 0.3);
  ctx.lineTo(wx + ww, wy + wh);
  ctx.stroke();
  // Cross bar
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy + 5);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh * 0.55);
  ctx.lineTo(wx + ww, wy + wh * 0.55);
  ctx.stroke();
}

export const wizardsTower: SceneDefinition = {
  id: "wizards_tower",
  name: "Wizard's Tower",
  cursedDescription: "Dust hangs frozen in still air. A wizard's study, abandoned mid-thought — books lie open on desks, a quill rests in dried ink. The fireplace is cold and dark. On a workbench, a music box sits silent, its mechanism stiff. Someone left in a hurry and never came back.",
  restoredDescription: "The fire crackles to life and the tower remembers. Books settle comfortably on their shelves, embers drift like tiny stars, and the music box begins to play — a melody so tender it makes the walls hum. By the hearth, a gray cat has appeared from nowhere, curled up and purring as though it never left.",
  exits: {
    south: "rainbow_bridge",
    east: "starfall_lake",
  },
  items: [],
  layers: [
    { id: "walls", parallax: 0, draw: drawWalls },
    { id: "window", parallax: 0.05, draw: drawWindow },
    { id: "bookshelf", parallax: 0.15, draw: drawBookshelf },
    { id: "fireplace", parallax: 0.25, draw: drawFireplace },
    { id: "workbench", parallax: 0.35, draw: drawWorkbench },
    { id: "floor", parallax: 0.4, draw: drawFloor },
  ],
  cursedVisuals: {
    saturation: 0.02,
    brightness: 0.35,
    fogDensity: 0.1,
    palette: {
      sky: ["#141218", "#1a181e"],
      ground: ["#201e24", "#18161c"],
      accent: "#2a2830",
      fog: "#3a3840",
    },
  },
  restoredVisuals: {
    saturation: 0.9,
    brightness: 0.9,
    fogDensity: 0.0,
    palette: {
      sky: ["#2a1810", "#3a2818"],
      ground: ["#4a3828", "#3a2818"],
      accent: "#6a4830",
      fog: "#5a4030",
    },
  },
  hotspots: [
    { id: "music_box", bounds: { x: 780, y: 370, width: 80, height: 50 }, action: "puzzle", target: "music_box" },
    { id: "bookshelf", bounds: { x: 60, y: 200, width: 240, height: 400 }, action: "examine", target: "books" },
    { id: "fireplace", bounds: { x: 400, y: 300, width: 220, height: 200 }, action: "examine", target: "fireplace" },
  ],
  creatures: [
    { id: "cat", type: "cat", x: 480, y: 550, scale: 1, showWhen: "restored" },
  ],
  particles: [
    {
      id: "dust", x: 100, y: 200, width: 1000, height: 400,
      rate: 1, lifetime: [4, 8], velocity: { x: [-3, 3], y: [-2, 2] },
      size: [1, 2], cursedColor: "#4a4a50", restoredColor: "#8a7a60",
      shape: "circle", showWhen: "cursed",
    },
    {
      id: "embers", x: 400, y: 350, width: 200, height: 0,
      rate: 3, lifetime: [2, 5], velocity: { x: [-10, 10], y: [-40, -10] },
      size: [1, 3], cursedColor: "#555555", restoredColor: "#ff8820",
      shape: "circle", blendMode: "lighter", showWhen: "restored",
    },
    {
      id: "magic_sparks", x: 200, y: 300, width: 800, height: 200,
      rate: 1.5, lifetime: [2, 4], velocity: { x: [-5, 5], y: [-15, -3] },
      size: [1, 3], cursedColor: "#333333", restoredColor: "#ffd700",
      shape: "star", blendMode: "lighter", showWhen: "restored",
    },
  ],
  music: {
    droneFreq: 58, droneType: "triangle", droneVolume: 0.08,
    baseNote: 62, scale: [0, 2, 3, 5, 7, 8, 11], // harmonic minor
    tempo: 70, cursedFilterCutoff: 100, restoredFilterCutoff: 3000,
    melodyPattern: [0, 3, 5, 4, 2, 6, 4, 1, 0], melodyRhythm: [2, 1, 1, 2, 1, 1, 1, 1, 3],
    ambientType: "fire", ambientVolume: 0.15,
  },
  puzzleId: "music_box",
  guardianCreature: "cat",
  restorationToken: "token_tower",
};
