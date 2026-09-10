// SHELL: one authored character in the existing Canvas world depth pass.
// Animation state belongs here, never on the saved simulation avatar.
import { G } from './state.js?realm=198';
import { on } from './bus.js?realm=198';
import { makeAtlasLoader } from './atlas-loader.js?realm=198';

const DIRECTIONS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
const CLIPS = {
  walk: { frames: 24, duration: 1.0666667222976685 },
  idle: { frames: 48, duration: 4 },
  point: { frames: 48, duration: 3.2 },
  beckon: { frames: 48, duration: 3.2 },
};
// The adult rig occupies 53–56/84 pixels of its padded cell. Calibrate actual
// body height against the settlers after changing the source proportions.
const CELL_HEIGHT = 44;
const CELL_WIDTH = CELL_HEIGHT * 64 / 84;
// Register the Blender ground origin, rather than the frontmost opaque toe.
const ANCHOR_Y = .86;
export const FOUNDER_MARKER_HEIGHT = 34;
// The settlement's map is compressed relative to its people. Calibrate its
// travel cadence separately from the .64-metre Blender stride: at the existing
// .05 tile/tick scouting speed this gives 1.875 cycles/s, not 4.69.
const STRIDE_TILES = 1.6;
const atlases = new Map();
let actor = null, state = null;
let enlargedInFlight = null;

function atlas(action, size = 64, direction = null) {
  const key = `${action}-${size}${size > 64 ? `-${direction}` : ''}`;
  let load = atlases.get(key);
  if (!load) {
    load = makeAtlasLoader(`assets/sprites/founder/${size > 64 ? 'runtime/' : ''}${key}.png`);
    load.action = action; load.frameSize = size; load.direction = size > 64 ? direction : null;
  }
  atlases.delete(key); atlases.set(key, load);
  return load;
}

function readyAtlas(load) {
  if (enlargedInFlight?.state !== 'loading') enlargedInFlight = null;
  if (load.frameSize <= 64 || load.state === 'ready') return load();
  // A rapid turn uses the ready small map while one enlarged row decodes.
  if (enlargedInFlight && enlargedInFlight !== load) return null;
  const image = load();
  if (load.state === 'loading') enlargedInFlight = load;
  return image;
}

function heading(dx, dy, fallback = 's') {
  if (Math.hypot(dx, dy) < .00001) return fallback;
  return DIRECTIONS[(Math.round(Math.atan2(dx - dy, dx + dy) / (Math.PI / 4)) + 8) % 8];
}

function synchronize(a, tick) {
  if (actor !== a || !state || tick < state.tick - 1.01) {
    actor = a;
    state = { x: a.x, y: a.y, tick, phase: 0, action: 'idle', direction: heading(a.faceX || 0, a.faceZ || 0), gesture: null, drawn: null };
  }
  return state;
}

on('command-applied', command => {
  if (!G.avatar) return;
  const s = synchronize(G.avatar, G.gameTick);
  if (command.type === 'AVATAR_GOTO' || (command.type === 'AVATAR_MOVE' && (command.dx || command.dy))) {
    s.gesture = null;
    return;
  }
  const action = ['PLACE_BUILDING', 'ASSIGN_CITIZEN', 'UPGRADE'].includes(command.type) ? 'point'
    : command.type === 'SET_RALLY' && Number.isFinite(command.x) && Number.isFinite(command.y) ? 'beckon' : null;
  if (!action || Math.hypot(command.x - G.avatar.x, command.y - G.avatar.y) < .2) return;
  // New orders replace old ones; locomotion always takes priority. Never
  // replay stale work orders when a long walk eventually finishes.
  s.gesture = { action, x: command.x, y: command.y, tick: G.gameTick };
  atlas(action)();
});

export function prepareFounderSprites() {
  atlas('idle')();
  atlas('walk')();
}

export function sampleFounder(a, position, tick) {
  const s = synchronize(a, tick);
  tick = Math.max(tick, s.tick);
  const elapsed = Math.max(0, tick - s.tick) / 60;
  const dx = position.x - s.x, dy = position.y - s.y;
  const distance = Math.hypot(dx, dy);
  const moving = distance > .00001 && distance < 1.5 && elapsed > 0;
  if (moving) {
    s.gesture = null;
    s.direction = heading(dx, dy, s.direction);
    if (s.action !== 'walk') s.phase = 0;
    s.phase = (s.phase + distance / STRIDE_TILES) % 1;
    s.action = 'walk';
  } else if (elapsed > 0 || s.gesture) {
    const gesture = s.gesture;
    if (gesture && tick >= gesture.tick && tick - gesture.tick < CLIPS[gesture.action].duration * 60) {
      s.action = gesture.action;
      s.phase = Math.max(0, (tick - gesture.tick) / (CLIPS[s.action].duration * 60));
      s.direction = heading(gesture.x - a.x, gesture.y - a.y, s.direction);
    } else {
      s.gesture = null;
      if (s.action !== 'idle') s.phase = 0;
      else s.phase = (s.phase + elapsed / CLIPS.idle.duration) % 1;
      s.action = 'idle';
    }
  }
  s.x = position.x; s.y = position.y; s.tick = tick;
  return { action: s.action, direction: s.direction, phase: s.phase, frame: Math.floor(s.phase * CLIPS[s.action].frames) % CLIPS[s.action].frames };
}

export function drawFounder(ctx, a, position, screen, daylight) {
  // Interpolation time and position advance together; paused game time freezes
  // the exact pose. Moving the camera does not move the character's feet.
  const tick = G.gameTick + (G.speed > 0 ? (G._renderAlpha || 0) : 0);
  const pose = sampleFounder(a, position, tick);
  const transform = ctx.getTransform();
  const projectedHeight = CELL_HEIGHT * Math.hypot(transform.c, transform.d);
  const resolution = projectedHeight > 168 ? 192 : projectedHeight > 84 ? 128 : 64;
  const requested = atlas(pose.action, resolution, pose.direction);
  const detailed = readyAtlas(requested);
  const small = atlas(pose.action)();
  const image = detailed || small || atlas('idle')();
  if (!image) return false;
  const action = detailed || small ? pose.action : 'idle';
  const size = image.width / CLIPS[action].frames;
  const frameHeight = size * 84 / 64;
  const row = detailed && resolution > 64 ? 0 : DIRECTIONS.indexOf(pose.direction);
  const frame = action === pose.action ? pose.frame : 0;
  ctx.save();
  ctx.globalAlpha = Math.max(.85, daylight);
  for (const [rx, ry, alpha] of [[6.8, 2.8, .07], [5.1, 2.1, .13], [3.2, 1.3, .16]]) {
    ctx.fillStyle = `rgba(21,28,24,${alpha})`;
    ctx.beginPath(); ctx.ellipse(screen.x, screen.y + .8, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (G._followAvatar) {
    ctx.strokeStyle = 'rgba(237,206,139,.85)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.ellipse(screen.x, screen.y + .8, 7.5, 3.3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, frame * size, row * frameHeight, size, frameHeight,
    screen.x - CELL_WIDTH / 2, screen.y - CELL_HEIGHT * ANCHOR_Y, CELL_WIDTH, CELL_HEIGHT);
  ctx.restore();
  state.drawn = { ...pose, action, frame, size, x: screen.x, y: screen.y };
  // Two enlarged direction rows retain the recent idle/walk transition.
  // At the largest tier each row is 8.86 MiB, not a 70.88 MiB whole sheet.
  const enlarged = [...atlases].filter(([, load]) => load.frameSize > 64);
  while (enlarged.length > 2) {
    const victim = enlarged.findIndex(([, load]) => load !== requested && load !== enlargedInFlight);
    if (victim < 0) break;
    const [key] = enlarged.splice(victim, 1)[0]; atlases.delete(key);
  }
  for (const [key, load] of atlases) {
    if (load.frameSize === 64 && !['idle', 'walk', pose.action].includes(load.action)) atlases.delete(key);
  }
  return true;
}

export function founderPresentationDiagnostics() {
  return { pose: state?.drawn ? { ...state.drawn } : null,
    atlases: [...atlases].map(([key, load]) => ({ key, state: load.state, size: load.frameSize,
      direction: load.direction, decodedBytes: load.state === 'ready' ? CLIPS[load.action].frames * load.frameSize * load.frameSize * 84 / 64 * (load.direction ? 1 : 8) * 4 : 0 })),
    clips: Object.fromEntries(Object.entries(CLIPS).map(([key, clip]) => [key, { ...clip }])),
    cellHeight: CELL_HEIGHT, strideTiles: STRIDE_TILES };
}
