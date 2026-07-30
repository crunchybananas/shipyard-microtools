// ════════════════════════════════════════════════════════════
// Avatar — the player's founder, walking the realm (Phase 3d).
//
// The Stardew turn: you are no longer a disembodied camera. The avatar
// walks on citizen movement rules (same collision, same roads), reveals
// fog as they explore, and quickens production nearby (economy.js —
// the founder's inspiration). In multiplayer, each remote player is
// exactly one of these.
//
// CORE tier: driven only by AVATAR_MOVE / AVATAR_GOTO commands; the
// shell owns the follow-camera and key handling.
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H } from './state.js?realm=172';
import { findPath, stepEntityToward } from './pathfinding.js?realm=172';
import { revealAround } from './world.js?realm=172';

export function makeAvatar(x, y) {
  // Citizen-shaped on purpose: the renderer's citizen sprite path
  // (faceX/faceZ/_movedAt/path) draws the avatar without a new pipeline.
  return {
    x, y, tx: x, ty: y,
    vx: 0, vy: 0,
    path: null, pathIdx: 0,
    speed: 0.05, // brisk — faster than citizens (0.02–0.03)
    name: 'The Founder',
    state: 'idle',
    faceX: 0, faceZ: 1, _movedAt: 0,
  };
}

// Command handlers (called from commands.js only)
export function avatarMove(dx, dy) {
  const a = G.avatar;
  if (!a) return false;
  a.vx = dx; a.vy = dy;
  if (dx || dy) { a.path = null; a.pathIdx = 0; }
  return true;
}

export function avatarGoto(x, y) {
  const a = G.avatar;
  if (!a) return false;
  a.vx = 0; a.vy = 0;
  const path = findPath(Math.round(a.x), Math.round(a.y), Math.round(x), Math.round(y));
  if (!path) return false;
  a.path = path;
  a.pathIdx = 0;
  return true;
}

export function updateAvatar() {
  const a = G.avatar;
  if (!a) return;
  if (a.vx || a.vy) {
    // Direct control (WASD in follow mode): steer toward a point ahead;
    // stepEntityToward slides along buildings like every other mover.
    const len = Math.hypot(a.vx, a.vy) || 1;
    const aim = { x: a.x + (a.vx / len) * 2, y: a.y + (a.vy / len) * 2 };
    if (stepEntityToward(a, aim.x, aim.y, a.speed)) {
      a._movedAt = G.gameTick;
      if (Math.abs(a.vx) > 0.01 || Math.abs(a.vy) > 0.01) {
        a.faceX = a.vx > 0.01 ? 1 : a.vx < -0.01 ? -1 : 0;
        a.faceZ = a.vy > 0.01 ? 1 : a.vy < -0.01 ? -1 : 0;
      }
    }
  } else if (a.path && a.pathIdx < a.path.length) {
    // Click-to-walk: follow the A* waypoints.
    const wp = a.path[a.pathIdx];
    const dx = wp.x - a.x, dy = wp.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d <= Math.max(0.005, a.speed)) {
      if (d > 0.0001) {
        a.x = wp.x;
        a.y = wp.y;
        a._movedAt = G.gameTick;
        if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) {
          a.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
          a.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
        }
      }
      a.pathIdx++;
      if (a.pathIdx >= a.path.length) { a.path = null; a.pathIdx = 0; }
    } else if (stepEntityToward(a, wp.x, wp.y, a.speed)) {
      a._movedAt = G.gameTick;
      if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) {
        a.faceX = dx > 0.04 ? 1 : dx < -0.04 ? -1 : 0;
        a.faceZ = dy > 0.04 ? 1 : dy < -0.04 ? -1 : 0;
      }
    } else {
      a.path = null; // blocked — stop rather than grind
      a.pathIdx = 0;
    }
  }
  a.x = Math.max(0.5, Math.min(MAP_W - 1.5, a.x));
  a.y = Math.max(0.5, Math.min(MAP_H - 1.5, a.y));
  // Exploration: walking IS scouting — the founder reveals the world.
  if (G.gameTick % 15 === 0) {
    revealAround(Math.round(a.x), Math.round(a.y), 3);
  }
}
