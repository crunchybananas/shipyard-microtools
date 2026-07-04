// ════════════════════════════════════════════════════════════
// Commands — the ONLY surface through which player intent mutates
// sim state (ENGINE.md rule 3). UI/input handlers build a command
// object and dispatch() it; they never touch G directly.
//
// Contract:
// - Commands address buildings by TILE COORDINATES, never object refs
//   (coordinates survive serialization; refs don't cross a wire).
// - Every applied command is stamped with G.gameTick and appended to
//   G._commandLog (in-memory ring, not saved). Same seed + same log →
//   identical state; verify-determinism.mjs enforces it.
// - Handlers return { ok, reason?, ... }. Shell code may render the
//   reason but must not re-implement the validation.
// - Camera / zoom / selection / open panels are client-local and are
//   NOT commands.
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, rngRange } from './state.js?realm=131';
import { placeBuilding, demolishBuilding, undoLastBuild, upgradeBuilding } from './economy.js?realm=131';
import { startResearch } from './tech.js?realm=131';
import { executeTrade } from './trade.js?realm=131';
import { avatarMove, avatarGoto } from './avatar.js?realm=131';

function buildingAt(x, y) {
  return G.buildingGrid[Math.round(y)]?.[Math.round(x)] || null;
}

// Snap every soldier's wander target to its stance anchor immediately so a
// stance change FEELS instant instead of waiting out each wander timer.
// (Moved from input.js — it mutates sim state, so it lives command-side.)
export function setArmyTargets() {
  for (const s of G.soldiers) {
    if (G.armyStance === 'rally' && G.rallyPoint) {
      s.tx = G.rallyPoint.x + rngRange(-2, 2);
      s.ty = G.rallyPoint.y + rngRange(-2, 2);
    } else if (G.armyStance === 'defend' && s.homeBuilding) {
      s.tx = s.homeBuilding.x + rngRange(-3, 3);
      s.ty = s.homeBuilding.y + rngRange(-3, 3);
    }
    s.stateTimer = 1; // re-anchor (incl. patrol posts) on next tick
  }
}

const HANDLERS = {
  PLACE_BUILDING({ building, x, y }) {
    if (!BUILDINGS[building]) return { ok: false, reason: 'unknown-building' };
    return placeBuilding(building, x, y)
      ? { ok: true }
      : { ok: false, reason: 'cannot-place' };
  },

  DEMOLISH({ x, y }) {
    const b = buildingAt(x, y);
    if (!b) return { ok: false, reason: 'no-building' };
    demolishBuilding(b);
    return { ok: true };
  },

  UNDO() {
    return undoLastBuild() ? { ok: true } : { ok: false, reason: 'nothing-to-undo' };
  },

  UPGRADE({ x, y }) {
    const b = buildingAt(x, y);
    if (!b) return { ok: false, reason: 'no-building' };
    return upgradeBuilding(b) ? { ok: true } : { ok: false, reason: 'cannot-upgrade' };
  },

  START_RESEARCH({ tech }) {
    return startResearch(tech) ? { ok: true } : { ok: false, reason: 'cannot-research' };
  },

  TRADE({ partner, resource, amount }) {
    const result = executeTrade(partner, resource, amount);
    return result ? { ok: true, result } : { ok: false, reason: 'cannot-trade' };
  },

  SET_RALLY({ x, y }) {
    if (x == null || y == null) {
      G.rallyPoint = null;
      G.armyStance = 'defend';
    } else {
      G.rallyPoint = { x, y };
      G.armyStance = 'rally';
    }
    setArmyTargets();
    return { ok: true };
  },

  SET_STANCE({ stance }) {
    if (!['defend', 'rally', 'patrol'].includes(stance)) return { ok: false, reason: 'bad-stance' };
    if (stance === 'rally' && !G.rallyPoint) return { ok: false, reason: 'no-rally-point' };
    G.armyStance = stance;
    setArmyTargets();
    return { ok: true };
  },

  GARRISON({ x, y }) {
    const b = buildingAt(x, y);
    if (!b || b.type !== 'tower') return { ok: false, reason: 'no-tower' };
    const occ = G.soldiers.filter(s => s.garrison === b).length;
    const free = G.soldiers
      .filter(s => !s.garrison)
      .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))
      .slice(0, Math.max(0, 2 - occ));
    for (const s of free) s.garrison = b;
    return free.length ? { ok: true, count: free.length } : { ok: false, reason: 'no-free-soldiers' };
  },

  AVATAR_MOVE({ dx, dy }) {
    return avatarMove(dx || 0, dy || 0) ? { ok: true } : { ok: false, reason: 'no-avatar' };
  },

  AVATAR_GOTO({ x, y }) {
    return avatarGoto(x, y) ? { ok: true } : { ok: false, reason: 'no-path' };
  },

  EJECT_GARRISON({ x, y }) {
    const b = buildingAt(x, y);
    if (!b) return { ok: false, reason: 'no-building' };
    let n = 0;
    for (const s of G.soldiers) {
      if (s.garrison === b) {
        s.garrison = null;
        s.x = b.x + 1; s.y = b.y + 1; s.tx = s.x; s.ty = s.y; s.stateTimer = 1;
        n++;
      }
    }
    return { ok: true, count: n };
  },
};

const LOG_CAP = 4000;

export function dispatch(cmd) {
  const handler = HANDLERS[cmd.type];
  if (!handler) return { ok: false, reason: 'unknown-command' };
  const res = handler(cmd) || { ok: false, reason: 'handler-returned-nothing' };
  if (res.ok) {
    G._commandLog = G._commandLog || [];
    G._commandLog.push({ tick: G.gameTick, ...cmd });
    if (G._commandLog.length > LOG_CAP) G._commandLog.splice(0, G._commandLog.length - LOG_CAP);
  }
  return res;
}
