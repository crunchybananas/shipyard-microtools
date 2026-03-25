/**
 * Throne Room — Scene 8 of The Fading Kingdom (ENDGAME)
 *
 * CURSED: A grand dark hall. An empty altar stands in the center.
 *         Seven empty slots wait for restoration tokens.
 *
 * RESTORED: Light pours through stained glass windows. All guardian creatures
 *           gather here. The kingdom is restored. Golden celebration!
 *
 * PUZZLE: Place all 7 restoration tokens on the altar.
 * GUARDIAN: All creatures return here for the celebration.
 */

import type { SceneDefinition, SceneRenderContext } from "the-island/scenes/types";
import { lerp } from "the-island/scenes/types";

function drawHall(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Grand hall background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, visuals.palette.sky[0]);
  grad.addColorStop(1, visuals.palette.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawColumns(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  // Grand stone columns flanking the hall
  const columns = [0.08, 0.22, 0.78, 0.92];
  ctx.fillStyle = visuals.palette.ground[0];

  for (const cx of columns) {
    const x = cx * width;
    const colW = width * 0.035;

    // Column shaft
    ctx.fillRect(x - colW / 2, height * 0.05, colW, height * 0.7);

    // Capital (top)
    ctx.fillStyle = visuals.palette.accent;
    ctx.fillRect(x - colW * 0.7, height * 0.05, colW * 1.4, height * 0.03);

    // Base
    ctx.fillRect(x - colW * 0.7, height * 0.72, colW * 1.4, height * 0.03);
    ctx.fillStyle = visuals.palette.ground[0];
  }
}

function drawStainedGlass(rc: SceneRenderContext): void {
  const { ctx, width, height, time, restorationProgress } = rc;
  // Three stained glass windows at the back wall
  const windows = [
    { x: 0.35, hue: 200 },
    { x: 0.5, hue: 45 },
    { x: 0.65, hue: 320 },
  ];

  for (const w of windows) {
    const wx = w.x * width;
    const wy = height * 0.08;
    const ww = width * 0.08;
    const wh = height * 0.3;

    // Window frame (arched)
    ctx.fillStyle = `hsla(${w.hue}, ${lerp(0, 60, restorationProgress)}%, ${lerp(15, 40, restorationProgress)}%, 1)`;
    ctx.beginPath();
    ctx.moveTo(wx - ww / 2, wy + wh);
    ctx.lineTo(wx - ww / 2, wy + wh * 0.35);
    ctx.quadraticCurveTo(wx, wy, wx + ww / 2, wy + wh * 0.35);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.closePath();
    ctx.fill();

    // Light beam from window (restored)
    if (restorationProgress > 0.3) {
      const beamAlpha = (restorationProgress - 0.3) / 0.7 * 0.12;
      const pulse = Math.sin(time + w.hue * 0.01) * 0.03 + 0.97;
      ctx.globalAlpha = beamAlpha * pulse;
      ctx.fillStyle = `hsla(${w.hue}, 70%, 60%, 0.5)`;
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wy + wh);
      ctx.lineTo(wx - ww * 1.5, height * 0.78);
      ctx.lineTo(wx + ww * 1.5, height * 0.78);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawAltar(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress, time } = rc;
  const altarX = width * 0.5;
  const altarY = height * 0.55;
  const altarW = width * 0.2;
  const altarH = height * 0.12;

  // Altar base
  ctx.fillStyle = visuals.palette.ground[0];
  ctx.beginPath();
  ctx.moveTo(altarX - altarW / 2, altarY);
  ctx.lineTo(altarX - altarW * 0.6, altarY + altarH);
  ctx.lineTo(altarX + altarW * 0.6, altarY + altarH);
  ctx.lineTo(altarX + altarW / 2, altarY);
  ctx.closePath();
  ctx.fill();

  // Altar top surface
  ctx.fillStyle = visuals.palette.accent;
  ctx.fillRect(altarX - altarW / 2, altarY - 5, altarW, 8);

  // 7 token slots
  const slotCount = 7;
  const slotSpacing = altarW * 0.85 / slotCount;
  const slotStartX = altarX - altarW * 0.4;

  for (let i = 0; i < slotCount; i++) {
    const sx = slotStartX + i * slotSpacing + slotSpacing / 2;
    const sy = altarY - 2;

    // Slot circle
    ctx.strokeStyle = visuals.palette.ground[1];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.stroke();

    // If restoration in progress, show filled slots
    if (restorationProgress > i / slotCount) {
      const hues = [0, 30, 60, 120, 200, 280, 330];
      const fillAlpha = Math.min(1, (restorationProgress - i / slotCount) * slotCount);
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = `hsl(${hues[i] ?? 0}, 70%, 55%)`;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Altar glow (when all tokens placed / restored)
  if (restorationProgress > 0.8) {
    const glowAlpha = (restorationProgress - 0.8) / 0.2 * 0.3;
    const pulse = Math.sin(time * 2) * 0.1 + 0.9;
    ctx.globalAlpha = glowAlpha * pulse;
    const glow = ctx.createRadialGradient(altarX, altarY, 0, altarX, altarY, altarW);
    glow.addColorStop(0, "#ffd700");
    glow.addColorStop(0.5, "#ffd70044");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(altarX - altarW, altarY - altarW * 0.5, altarW * 2, altarW);
    ctx.globalAlpha = 1;
  }
}

function drawFloor(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals } = rc;
  const floorY = height * 0.75;

  ctx.fillStyle = visuals.palette.ground[1];
  ctx.fillRect(0, floorY, width, height - floorY);

  // Tile pattern
  ctx.strokeStyle = visuals.palette.accent;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.15;
  const tileSize = width / 16;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 17; c++) {
      const tx = c * tileSize + (r % 2) * tileSize / 2;
      const ty = floorY + r * tileSize * 0.4;
      ctx.strokeRect(tx, ty, tileSize, tileSize * 0.4);
    }
  }
  ctx.globalAlpha = 1;

  // Red carpet leading to altar
  ctx.fillStyle = visuals.palette.accent;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(width * 0.42, floorY, width * 0.16, height - floorY);
  ctx.globalAlpha = 1;
}

function drawBanner(rc: SceneRenderContext): void {
  const { ctx, width, height, visuals, restorationProgress } = rc;
  // Royal banners hanging between columns
  const banners = [
    { x: 0.15, hue: 45 },
    { x: 0.85, hue: 220 },
  ];

  for (const b of banners) {
    const bx = b.x * width;
    const by = height * 0.1;
    const bw = width * 0.06;
    const bh = height * 0.3;

    ctx.fillStyle = `hsla(${b.hue}, ${lerp(5, 50, restorationProgress)}%, ${lerp(20, 40, restorationProgress)}%, 0.8)`;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by);
    ctx.lineTo(bx + bw / 2, by);
    ctx.lineTo(bx + bw / 2, by + bh);
    ctx.lineTo(bx, by + bh + bh * 0.15);
    ctx.lineTo(bx - bw / 2, by + bh);
    ctx.closePath();
    ctx.fill();

    // Banner rod
    ctx.fillStyle = visuals.palette.ground[0];
    ctx.fillRect(bx - bw * 0.6, by - 3, bw * 1.2, 6);
  }
}

export const throneRoom: SceneDefinition = {
  id: "throne_room",
  name: "The Throne Room",
  cursedDescription: "The heart of the kingdom. An altar waits in the center, seven empty circles etched into its surface — one for each region you must restore. Place all seven tokens here to break the curse forever. Click the altar when you are ready.",
  restoredDescription: "The throne room blazes with every color you have gathered. Stained glass windows throw cathedral light across the stone. The altar hums with golden warmth. And they are all here — crab, owl, fox, unicorn, phoenix, cat, and fish — the guardians of a kingdom reborn. You are home.",
  exits: {
    south: "crystal_caverns",
    west: "rainbow_bridge",
    east: "wizards_tower",
  },
  items: [],
  layers: [
    { id: "hall", parallax: 0, draw: drawHall },
    { id: "stained-glass", parallax: 0.05, draw: drawStainedGlass },
    { id: "columns", parallax: 0.15, draw: drawColumns },
    { id: "banners", parallax: 0.2, draw: drawBanner },
    { id: "altar", parallax: 0.35, draw: drawAltar },
    { id: "floor", parallax: 0.4, draw: drawFloor },
  ],
  cursedVisuals: {
    saturation: 0.0,
    brightness: 0.3,
    fogDensity: 0.1,
    palette: {
      sky: ["#0a0a0e", "#121218"],
      ground: ["#1a1a20", "#12121a"],
      accent: "#2a2a30",
      fog: "#2a2a30",
    },
  },
  restoredVisuals: {
    saturation: 1.0,
    brightness: 1.1,
    fogDensity: 0.0,
    palette: {
      sky: ["#1a1020", "#2a2040"],
      ground: ["#3a3040", "#2a2030"],
      accent: "#6a3040",
      fog: "#4a3050",
    },
  },
  hotspots: [
    { id: "altar", bounds: { x: 450, y: 370, width: 300, height: 100 }, action: "puzzle", target: "final_restoration" },
    { id: "stained_glass", bounds: { x: 350, y: 200, width: 500, height: 150 }, action: "examine", target: "windows" },
    { id: "columns", bounds: { x: 80, y: 200, width: 150, height: 400 }, action: "examine", target: "columns" },
  ],
  creatures: [
    { id: "cat_throne", type: "cat", x: 350, y: 520, scale: 0.8, showWhen: "restored" },
    { id: "owl_throne", type: "owl", x: 700, y: 280, scale: 0.7, showWhen: "restored" },
  ],
  particles: [
    {
      id: "dust_motes", x: 100, y: 200, width: 1000, height: 400,
      rate: 0.5, lifetime: [5, 10], velocity: { x: [-2, 2], y: [-3, 1] },
      size: [1, 2], cursedColor: "#3a3a40", restoredColor: "#ffd700",
      shape: "circle", showWhen: "always",
    },
    {
      id: "celebration", x: 200, y: 250, width: 800, height: 300,
      rate: 10, lifetime: [1, 3], velocity: { x: [-30, 30], y: [-50, -10] },
      size: [2, 5], cursedColor: "#333333", restoredColor: "#ffd700",
      shape: "star", blendMode: "lighter", showWhen: "restored",
    },
  ],
  music: {
    droneFreq: 55, droneType: "sine", droneVolume: 0.12,
    baseNote: 60, scale: [0, 2, 4, 5, 7, 9, 11], // major
    tempo: 100, cursedFilterCutoff: 80, restoredFilterCutoff: 8000,
    melodyPattern: [0, 4, 2, 5, 7, 4, 2, 0], melodyRhythm: [1, 1, 1, 1, 2, 1, 1, 2],
    ambientType: "silence", ambientVolume: 0,
  },
  puzzleId: "final_restoration",
  guardianCreature: "cat", // all creatures appear
  restorationToken: "token_throne",
};
