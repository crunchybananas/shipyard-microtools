// save-schema.js — the single source of truth for what persists (#74).
//
// Before this module, world.js hand-enumerated the save fields in three places
// (the save() payload, the load() applier, and the implicit W defaults) with
// inline migration heuristics and no version int — a silent data-loss class:
// add a field to W, forget one of the three spots, and the field quietly stops
// persisting (or loads as undefined) with no error anywhere.
//
// Now there is ONE field descriptor table (SAVE_FIELDS). save() packs through
// it, load() applies through it, and the payload carries an explicit version
// int (v). Old payloads are stepped forward through MIGRATIONS before the
// fields are applied. Adding a persisted field = adding one row here.
//
// This module is deliberately dependency-free (no three.js, no DOM, no
// localStorage) so node can import and test it headlessly. world.js owns the
// storage I/O and the plain-array → THREE.Vector3 conversion at its boundary.

export const SAVE_VERSION = 3;

// The localStorage key. The '-v1' suffix is historical (it predates the
// payload version int) and is frozen: the REAL version is payload.v, and
// renaming the key would orphan every existing save.
export const SAVE_KEY = 'abyme-save-v1';

// Where the outgoing save goes when the player begins anew (#56): wipe() copies
// the payload here before clearing SAVE_KEY — a single-slot undo for the
// destructive button on the title screen (each wipe overwrites the stash).
export const SAVE_KEY_PREV = 'abyme-save-v1-prev';

// ---------------- the field descriptor table ---------------------------------
// One row per persisted field.
//   key   — the payload property name.
//   pack  — (W, ctx) → JSON value written by save(). ctx carries call-scoped
//           extras: the live player-like — ctx.pos (Vector3-like) plus
//           ctx.yaw / ctx.pitch (radians).
//   apply — (W, value) → mutate W from a CURRENT-version payload value.
//           value is undefined when the payload lacks the key, so every apply
//           must land a sane default (these mirror the historical load()
//           semantics exactly — do not tighten them casually, partial/old
//           payloads flow through here).
export const SAVE_FIELDS = [
  { key: 'time',       pack: (W) => W.time,       apply: (W, v) => { W.time = v ?? W.time; } },
  // tide saves the TARGET (a mid-drain save should finish where it was headed)
  // and loads into both current + target so the water doesn't animate on boot.
  { key: 'tide',       pack: (W) => W.tideTarget, apply: (W, v) => { W.tide = W.tideTarget = v ?? 1; } },
  { key: 'lensPlaced', pack: (W) => W.lensPlaced, apply: (W, v) => { W.lensPlaced = !!v; } },
  { key: 'beamAngle',  pack: (W) => W.beamAngle,  apply: (W, v) => { W.beamAngle = v ?? W.beamAngle; } },
  // merge INTO the defaults: flags added since the save was written keep their
  // default false instead of vanishing from W.
  { key: 'flags',      pack: (W) => W.flags,      apply: (W, v) => { Object.assign(W.flags, v || {}); } },
  { key: 'stems',      pack: (W) => W.stems,      apply: (W, v) => { W.stems = v ?? 0; } },
  { key: 'inventory',  pack: (W) => W.inventory,  apply: (W, v) => { W.inventory = v || []; } },
  { key: 'journal',    pack: (W) => W.journal,    apply: (W, v) => { W.journal = v || []; } },
  { key: 'level',      pack: (W) => W.level,      apply: (W, v) => { W.level = v ?? 1; } },
  { key: 'onceKeys',   pack: (W) => W.onceKeys,   apply: (W, v) => { W.onceKeys = v || []; } },
  { key: 'readKeys',   pack: (W) => W.readKeys,   apply: (W, v) => { W.readKeys = v || []; } },
  { key: 'dials',      pack: (W) => W.dials,      apply: (W, v) => { W.dials = Array.isArray(v) && v.length === 4 ? v : [0, 0, 0, 0]; } },
  // merge keeps defaults for region keys added after the save was written.
  { key: 'regions',    pack: (W) => W.regions,    apply: (W, v) => { if (v) W.regions = Object.assign(W.regions, v); } },
  // stored as a plain [x,y,z]; world.js load() turns W.playerPos into a
  // THREE.Vector3 at its boundary (this module stays three-free).
  {
    key: 'pos',
    pack: (W, ctx) => (ctx && ctx.pos ? [ctx.pos.x, ctx.pos.y, ctx.pos.z] : null),
    apply: (W, v) => { W.playerPos = Array.isArray(v) && v.length === 3 ? v : null; },
  },
  // where the player was LOOKING — [yaw, pitch] radians (#58, v3). Continue used
  // to hardcode the beach facing; now the exact view restores with the position.
  // Kept apart from pos: pos predates the version int and gets the Vector3
  // conversion at the world.js boundary; look stays a plain pair.
  {
    key: 'look',
    pack: (W, ctx) => (ctx && Number.isFinite(ctx.yaw) ? [ctx.yaw, Number.isFinite(ctx.pitch) ? ctx.pitch : 0] : null),
    apply: (W, v) => { W.playerLook = Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? v : null; },
  },
];

// ---------------- versioned migrations ---------------------------------------
// MIGRATIONS[i] steps a payload from version `from` to `to`. migrateSave walks
// the chain until the payload reaches SAVE_VERSION. A payload with no v int is
// v1 (every save written before the version stamp existed).
export const MIGRATIONS = [
  {
    from: 1,
    to: 2,
    migrate(s) {
      const flags = s.flags || {};
      // saves from before the chest lid was persistent: the taken ruler proves
      // the chest was open. (v2 saves always write the full flags object, so
      // 'chestOpen' is always present from v2 on — this is genuinely v1-only.)
      if (flags.rulerTaken && !('chestOpen' in flags)) flags.chestOpen = true;
      s.flags = flags;
      return s;
    },
  },
  {
    // v3 added the 'look' field ([yaw, pitch], #58). Purely additive — the
    // apply is defensive, so a v2 payload just loads with the facing unset and
    // Continue falls back to the historical beach yaw. This step exists only to
    // keep the migration chain contiguous and date the change.
    from: 2,
    to: 3,
    migrate: (s) => s,
  },
];

export function migrateSave(payload) {
  let s = payload && typeof payload === 'object' ? payload : {};
  let v = Number.isInteger(s.v) && s.v >= 1 ? s.v : 1;
  for (const m of MIGRATIONS) {
    if (m.from === v) { s = m.migrate(s) || s; v = m.to; }
  }
  // a payload from a NEWER build (rolled-back client) falls through untouched:
  // the appliers are defensive, so we load it best-effort rather than wipe it.
  s.v = v;
  return s;
}

// ---------------- cross-version invariants -----------------------------------
// Repairs that any version can need — these are NOT migrations. Runs after the
// fields are applied, every load.
function normalize(W) {
  // a save written mid-dive has dove=true but level 1: flag('dove') saves at
  // the plate-touch, and W.level only increments seconds later when the dive
  // cinematic snaps (main.js). Quit inside that window — any save version —
  // and the reload must land the dive.
  if (W.flags.dove && W.level < 2) W.level = 2;
}

// ---------------- pack / apply ------------------------------------------------
// `player` is the live player-like ({ pos, yaw, pitch }) — or null when there
// is no player in scope (headless tests). Passed through to each field's pack
// as ctx.
export function packSave(W, player) {
  const out = { v: SAVE_VERSION };
  const ctx = player || null;
  for (const f of SAVE_FIELDS) out[f.key] = f.pack(W, ctx);
  return out;
}

export function applySave(W, payload) {
  const s = migrateSave(payload);
  for (const f of SAVE_FIELDS) f.apply(W, s[f.key]);
  normalize(W);
}
