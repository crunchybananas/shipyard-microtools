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

import { G, BUILDINGS, rngRange } from './state.js?realm=192';
import { placeBuilding, upgradeBuilding } from './economy.js?realm=192';
import { removeBuilding, undoLastBuildingPlacement } from './building-lifecycle.js?realm=192';
import { startResearch } from './tech.js?realm=192';
import { executeTrade } from './trade.js?realm=192';
import { avatarMove, avatarGoto } from './avatar.js?realm=192';
import { queueRecruit } from './military.js?realm=192';
import { setBuildingWorkforcePriority } from './workforce-policy.js?realm=192';
import { choosePostRaidDoctrine } from './post-raid-recovery.js?realm=192';
import {
  commandAssignCitizen,
  commandReleaseCitizen,
} from './citizen-ownership.js?realm=192';

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
    removeBuilding(b, { cause: 'manual' });
    return { ok: true };
  },

  UNDO() {
    return undoLastBuildingPlacement() ? { ok: true } : { ok: false, reason: 'nothing-to-undo' };
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

  ASSIGN_CITIZEN({ actorId, x, y }) {
    try {
      return commandAssignCitizen(actorId, x, y);
    } catch (error) {
      return { ok: false, reason: error instanceof RangeError ? 'assignment-rejected' : 'invalid-assignment-command' };
    }
  },

  RELEASE_CITIZEN({ actorId }) {
    try {
      return commandReleaseCitizen(actorId);
    } catch (error) {
      return { ok: false, reason: error instanceof RangeError ? 'release-rejected' : 'invalid-release-command' };
    }
  },

  SET_WORKFORCE_PRIORITY({ x, y, priority }) {
    const building = buildingAt(x, y);
    if (!building) return { ok: false, reason: 'no-building' };
    try {
      return setBuildingWorkforcePriority(building, priority);
    } catch (_error) {
      return { ok: false, reason: 'invalid-workforce-policy' };
    }
  },

  RECRUIT_UNIT({ x, y }) {
    return queueRecruit(buildingAt(x, y));
  },

  CHOOSE_RECOVERY_DOCTRINE({ doctrine }) {
    return choosePostRaidDoctrine(doctrine, G);
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

function canonicalNumber(value) {
  return Object.is(value, -0) ? 0 : value;
}

const FIELD = Object.freeze({
  string(value) {
    return typeof value === 'string' ? { ok: true, value } : { ok: false };
  },
  finiteNumber(value) {
    return Number.isFinite(value)
      ? { ok: true, value: canonicalNumber(value) }
      : { ok: false };
  },
  safeInteger(value) {
    return Number.isSafeInteger(value)
      ? { ok: true, value: canonicalNumber(value) }
      : { ok: false };
  },
  positiveSafeInteger(value) {
    return Number.isSafeInteger(value) && value > 0
      ? { ok: true, value }
      : { ok: false };
  },
  nullableSafeInteger(value) {
    if (value === null) return { ok: true, value: null };
    return Number.isSafeInteger(value)
      ? { ok: true, value: canonicalNumber(value) }
      : { ok: false };
  },
});

function schema(...entries) {
  return Object.freeze(entries.map(([name, normalize]) => Object.freeze({ name, normalize })));
}

// This table is the command wire surface. Handlers never receive the caller's
// object: dispatch first produces one primitive-only record in this declared
// field order. Unknown fields are rejected rather than copied into replay
// provenance. `tick` is the sole envelope field accepted in addition to a
// command schema so a recorded command can be replayed through dispatch; the
// caller's value is validated and then replaced by the authoritative G tick.
const COMMAND_SCHEMAS = Object.freeze({
  PLACE_BUILDING: schema(
    ['building', FIELD.string],
    ['x', FIELD.safeInteger],
    ['y', FIELD.safeInteger],
  ),
  DEMOLISH: schema(['x', FIELD.safeInteger], ['y', FIELD.safeInteger]),
  UNDO: schema(),
  UPGRADE: schema(['x', FIELD.safeInteger], ['y', FIELD.safeInteger]),
  START_RESEARCH: schema(['tech', FIELD.string]),
  TRADE: schema(
    ['partner', FIELD.string],
    ['resource', FIELD.string],
    ['amount', FIELD.finiteNumber],
  ),
  ASSIGN_CITIZEN: schema(
    ['actorId', FIELD.positiveSafeInteger],
    ['x', FIELD.safeInteger],
    ['y', FIELD.safeInteger],
  ),
  RELEASE_CITIZEN: schema(['actorId', FIELD.positiveSafeInteger]),
  SET_WORKFORCE_PRIORITY: schema(
    ['x', FIELD.safeInteger],
    ['y', FIELD.safeInteger],
    ['priority', FIELD.string],
  ),
  RECRUIT_UNIT: schema(
    ['x', FIELD.safeInteger],
    ['y', FIELD.safeInteger],
  ),
  CHOOSE_RECOVERY_DOCTRINE: schema(['doctrine', FIELD.string]),
  SET_RALLY: schema(
    ['x', FIELD.nullableSafeInteger],
    ['y', FIELD.nullableSafeInteger],
  ),
  SET_STANCE: schema(['stance', FIELD.string]),
  GARRISON: schema(['x', FIELD.safeInteger], ['y', FIELD.safeInteger]),
  AVATAR_MOVE: schema(['dx', FIELD.finiteNumber], ['dy', FIELD.finiteNumber]),
  AVATAR_GOTO: schema(['x', FIELD.safeInteger], ['y', FIELD.safeInteger]),
  EJECT_GARRISON: schema(['x', FIELD.safeInteger], ['y', FIELD.safeInteger]),
});

function ownDataValue(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return { ok: false };
  return { ok: true, value: descriptor.value };
}

function normalizeCommand(cmd) {
  if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd)) {
    return { ok: false, result: { ok: false, reason: 'invalid-command' } };
  }
  const prototype = Object.getPrototypeOf(cmd);
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, result: { ok: false, reason: 'invalid-command' } };
  }

  const typeField = ownDataValue(cmd, 'type');
  if (!typeField.ok || typeof typeField.value !== 'string') {
    return {
      ok: false,
      result: { ok: false, reason: 'invalid-command-field', field: 'type' },
    };
  }
  const type = typeField.value;
  const commandSchema = COMMAND_SCHEMAS[type];
  if (!commandSchema) {
    return { ok: false, result: { ok: false, reason: 'unknown-command' } };
  }
  const allowed = new Set(['type', 'tick', ...commandSchema.map(field => field.name)]);
  for (const key of Reflect.ownKeys(cmd)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      return {
        ok: false,
        result: {
          ok: false,
          reason: 'unknown-command-field',
          field: typeof key === 'symbol' ? key.toString() : key,
        },
      };
    }
  }

  if (Object.hasOwn(cmd, 'tick')) {
    const tickField = ownDataValue(cmd, 'tick');
    if (
      !tickField.ok
      || !Number.isSafeInteger(tickField.value)
      || tickField.value < 0
    ) {
      return {
        ok: false,
        result: { ok: false, reason: 'invalid-command-field', field: 'tick' },
      };
    }
  }

  const normalized = { type };
  for (const field of commandSchema) {
    const input = ownDataValue(cmd, field.name);
    if (!input.ok) {
      return {
        ok: false,
        result: { ok: false, reason: 'invalid-command-field', field: field.name },
      };
    }
    const output = field.normalize(input.value);
    if (!output.ok) {
      return {
        ok: false,
        result: { ok: false, reason: 'invalid-command-field', field: field.name },
      };
    }
    normalized[field.name] = output.value;
  }
  if (
    type === 'SET_RALLY'
    && ((normalized.x === null) !== (normalized.y === null))
  ) {
    return {
      ok: false,
      result: { ok: false, reason: 'invalid-command-field', field: 'x,y' },
    };
  }
  return { ok: true, command: Object.freeze(normalized) };
}

const LOG_CAP = 4000;

export function dispatch(cmd) {
  const normalized = normalizeCommand(cmd);
  if (!normalized.ok) return normalized.result;
  const command = normalized.command;
  const handler = HANDLERS[command.type];
  const res = handler(command) || { ok: false, reason: 'handler-returned-nothing' };
  if (res.ok) {
    G._commandLog = G._commandLog || [];
    G._commandLog.push(Object.freeze({ ...command, tick: G.gameTick }));
    if (G._commandLog.length > LOG_CAP) G._commandLog.splice(0, G._commandLog.length - LOG_CAP);
  }
  return res;
}

// See sim.js coreStateIdentity(). This intentionally exposes only object
// identity; command mutation still goes through dispatch().
export function commandStateIdentity() { return G; }
