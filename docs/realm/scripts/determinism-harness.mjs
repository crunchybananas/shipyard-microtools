// Reusable headless Realm runner and lossless canonical-state encoder.
// Every runtime import below uses the canonical URL identity. The revision
// transaction rewrites these literals together with the browser graph.

import { createHash } from 'node:crypto';
import runtimeContract from '../runtime-contract.json?realm=176' with { type: 'json' };
import {
  AUTHORITATIVE_SIMULATION_EXCLUDED_G_KEYS,
  G,
  RESETTABLE_PRESENTATION_ENTITY_FIELDS,
  getSeed,
  setSeed,
} from '../js/state.js?realm=176';
import { generateWorld } from '../js/world.js?realm=176';
import { CORE_SYSTEM_ORDER, coreStateIdentity, coreTick } from '../js/sim.js?realm=176';
import { commandStateIdentity, dispatch } from '../js/commands.js?realm=176';
import { canPlace } from '../js/economy.js?realm=176';
import { initChronicle } from '../js/log.js?realm=176';
import { missions } from '../js/missions.js?realm=176';

export { CORE_SYSTEM_ORDER, G, runtimeContract };

function canonicalFailure(path, message) {
  throw new TypeError(`cannot canonicalize ${path}: ${message}`);
}

/**
 * Return a JSON-safe value with recursively sorted object keys.
 *
 * This is intentionally strict. JSON.stringify silently erases undefined,
 * functions, symbols, non-finite numbers and collection semantics; a replay
 * gate must reject those values rather than bless a lossy hash.
 */
export function strictCanonicalize(value, path = '$', ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) canonicalFailure(path, `non-finite number ${String(value)}`);
    if (Object.is(value, -0)) canonicalFailure(path, 'negative zero');
    return value;
  }
  if (value === undefined) canonicalFailure(path, 'undefined');
  if (typeof value === 'function') canonicalFailure(path, 'function');
  if (typeof value === 'symbol') canonicalFailure(path, 'symbol');
  if (typeof value === 'bigint') canonicalFailure(path, 'bigint');
  if (value instanceof Map) canonicalFailure(path, 'Map must be normalized explicitly');
  if (value instanceof Set) canonicalFailure(path, 'Set must be normalized explicitly');
  if (ancestors.has(value)) canonicalFailure(path, 'cycle');

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    const items = [];
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) canonicalFailure(`${path}[${index}]`, 'sparse array hole');
      items.push(strictCanonicalize(value[index], `${path}[${index}]`, nextAncestors));
    }
    const properties = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') canonicalFailure(path, 'symbol-keyed property');
      if (key === 'length' || (/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length && String(Number(key)) === key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable) canonicalFailure(`${path}.${key}`, 'non-enumerable array property');
      if (!Object.hasOwn(descriptor, 'value')) canonicalFailure(`${path}.${key}`, 'accessor property');
      properties[key] = strictCanonicalize(descriptor.value, `${path}.${key}`, nextAncestors);
    }
    return Object.keys(properties).length ? { $array: items, $properties: properties } : items;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    canonicalFailure(path, `unsupported object prototype ${prototype?.constructor?.name || '<null>'}`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') canonicalFailure(path, 'symbol-keyed property');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable) canonicalFailure(`${path}.${key}`, 'non-enumerable property');
    if (!Object.hasOwn(descriptor, 'value')) canonicalFailure(`${path}.${key}`, 'accessor property');
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    result[key] = strictCanonicalize(value[key], `${path}.${key}`, nextAncestors);
  }
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(strictCanonicalize(value));
}

export function hashCanonical(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function normalizedNumber(value) {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) throw new TypeError(`simulation contains non-finite number ${String(value)}`);
  if (Object.is(value, -0)) throw new TypeError('simulation contains negative zero');
  return value;
}

function normalizeSet(set, normalize) {
  const values = [...set].map(value => normalize(value));
  values.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  return { $set: values };
}

const HASH_EXCLUDED_G_KEYS = new Set(AUTHORITATIVE_SIMULATION_EXCLUDED_G_KEYS);

/**
 * Normalize G without serializing object-reference cycles. Entity references
 * become stable collection-index references; Sets are tagged and ordered.
 */
export function simulationSnapshot() {
  const collections = [
    ['building', G.buildings || []],
    ['citizen', G.citizens || []],
    ['soldier', G.soldiers || []],
    ['enemy', G.enemies || []],
    ['projectile', G.projectiles || []],
    ['walker', G.walkers || []],
    ['caravan', G.caravans || []],
    ['animal', G.animals || []],
  ];
  const references = new Map();
  for (const [kind, values] of collections) {
    values.forEach((value, index) => {
      if (value && typeof value === 'object') references.set(value, `${kind}:${index}`);
    });
  }
  if (G.avatar && typeof G.avatar === 'object') references.set(G.avatar, 'avatar:0');

  function normalize(value, path = '$', entityRoot = null, entityKind = null, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return normalizedNumber(value);
    if (value === undefined) throw new TypeError(`simulation contains undefined at ${path}`);
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
      throw new TypeError(`simulation contains unsupported ${typeof value} at ${path}`);
    }
    if (references.has(value) && value !== entityRoot) return { $ref: references.get(value) };
    if (ancestors.has(value)) throw new TypeError(`simulation contains unresolved cycle at ${path}`);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);
    if (value instanceof Set) return normalizeSet(value, child => normalize(child, `${path}.$set`, null, null, nextAncestors));
    if (value instanceof Map) throw new TypeError(`simulation contains unnormalized Map at ${path}`);
    if (Array.isArray(value)) {
      const items = [];
      for (let index = 0; index < value.length; index++) {
        if (!(index in value)) throw new TypeError(`simulation contains sparse array hole at ${path}[${index}]`);
        items.push(normalize(value[index], `${path}[${index}]`, null, null, nextAncestors));
      }
      const properties = {};
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === 'symbol') throw new TypeError(`simulation contains symbol-keyed property at ${path}`);
        if (key === 'length' || (/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length && String(Number(key)) === key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
          throw new TypeError(`simulation contains unsupported array property at ${path}.${key}`);
        }
        properties[key] = normalize(descriptor.value, `${path}.${key}`, null, null, nextAncestors);
      }
      return Object.keys(properties).length ? { $array: items, $properties: properties } : items;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`simulation contains unsupported ${prototype?.constructor?.name || 'object'} at ${path}`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') throw new TypeError(`simulation contains symbol-keyed property at ${path}`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError(`simulation contains unsupported property at ${path}.${key}`);
      }
    }
    const result = {};
    const resettableFields = entityKind
      ? new Set(RESETTABLE_PRESENTATION_ENTITY_FIELDS[entityKind] || [])
      : null;
    for (const key of Object.keys(value).sort()) {
      if (resettableFields?.has(key)) continue;
      result[key] = normalize(value[key], `${path}.${key}`, null, null, nextAncestors);
    }
    return result;
  }

  const snapshot = {};
  const collectionByKey = new Map(collections.map(([kind, values]) => [
    ({ building: 'buildings', citizen: 'citizens', soldier: 'soldiers', enemy: 'enemies', projectile: 'projectiles', walker: 'walkers', caravan: 'caravans', animal: 'animals' })[kind],
    values,
  ]));
  for (const key of Object.keys(G).sort()) {
    if (HASH_EXCLUDED_G_KEYS.has(key)) continue;
    const values = collectionByKey.get(key);
    if (values) {
      const kind = collections.find(([, collection]) => collection === values)?.[0] || null;
      snapshot[key] = values.map((entity, index) => normalize(entity, `$.${key}[${index}]`, entity, kind));
    } else if (key === 'avatar' && G.avatar) {
      snapshot.avatar = normalize(G.avatar, '$.avatar', G.avatar, 'avatar');
    } else {
      snapshot[key] = normalize(G[key], `$.${key}`);
    }
  }
  snapshot.missions = missions.map(mission => {
    const { check: _derivedPredicate, ...mutableMissionState } = mission;
    return normalize(mutableMissionState, `$.missions.${mission.id || '?'}`);
  });
  return strictCanonicalize(snapshot);
}

function replayEnvelope(snapshot) {
  return {
    simulation: snapshot,
    rngState: getSeed(),
    commandLog: (G._commandLog || []).map(command => ({ ...command })),
  };
}

const BASE_SCRIPT = Object.freeze([
  { at: 10, building: 'house' },
  { at: 40, building: 'house' },
  { at: 90, building: 'farm' },
  { at: 140, building: 'lumber' },
  { at: 200, building: 'well' },
  { at: 260, building: 'granary' },
  { at: 400, building: 'quarry' },
  { at: 600, avatar: { x: 48, y: 48 } },
  { at: 900, research: 'masonry' },
  { at: 1200, building: 'market' },
  { at: 5000, research: 'commerce' },
  { at: 9000, building: 'tavern' },
  { at: 14000, avatar: { x: 34, y: 36 } },
]);

function findSpot(type) {
  const centerX = 40;
  const centerY = 40;
  for (let radius = 0; radius < 25; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = centerX + dx;
        const y = centerY + dy;
        if (canPlace(type, x, y)) return { x, y };
      }
    }
  }
  return null;
}

function applyScriptCommand(command) {
  if (command.building) {
    const spot = findSpot(command.building);
    return {
      label: command.building,
      result: spot
        ? dispatch({ type: 'PLACE_BUILDING', building: command.building, ...spot })
        : { ok: false, reason: 'no-spot' },
      spot,
    };
  }
  if (command.avatar) {
    return { label: 'avatar-goto', result: dispatch({ type: 'AVATAR_GOTO', ...command.avatar }) };
  }
  if (command.research) {
    return { label: command.research, result: dispatch({ type: 'START_RESEARCH', tech: command.research }) };
  }
  if (command.rally) {
    return { label: 'set-rally', result: dispatch({ type: 'SET_RALLY', ...command.rally }) };
  }
  throw new Error(`unknown harness command ${canonicalJson(command)}`);
}

function buildingSummary() {
  return G.buildings.map(building => ({
    type: building.type,
    x: building.x,
    y: building.y,
    hp: building.hp,
    buildProgress: building.buildProgress,
  }));
}

function storySummary() {
  const chronicle = G.chronicle || [];
  const firstTickContaining = fragment => chronicle.find(entry => entry.text.includes(fragment))?.tick ?? null;
  return {
    chronicleCount: chronicle.length,
    namedCharacters: Object.fromEntries(
      Object.entries(G.namedCharacters || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([role, character]) => [role, { ...character }]),
    ),
    milestoneTicks: {
      firstHouse: firstTickContaining('first house is raised'),
      firstFarm: firstTickContaining('farm is established'),
      firstMarket: firstTickContaining('Merchants unpack their wares'),
      firstTavern: firstTickContaining('tavern opens its doors'),
    },
    flags: Object.keys(G.storyFlags || {}).filter(key => G.storyFlags[key] === true).sort(),
    realmEnded: G.realmEnded === true,
  };
}

/** Run one scenario in a fresh process/module graph. */
export function runDeterminismScenario({
  seed,
  changedCommand = false,
  hostileParticleSchedule = false,
  mutateChronicle = false,
} = {}) {
  if (!Number.isSafeInteger(seed)) throw new TypeError('determinism seed must be an integer');
  if (coreStateIdentity() !== G || commandStateIdentity() !== G) {
    throw new Error('split module graph: root, coreTick(), and dispatch() do not share the same G object');
  }
  if (canonicalJson(CORE_SYSTEM_ORDER) !== canonicalJson(runtimeContract.coreSystemOrder)) {
    throw new Error('executable core system order differs from runtime-contract.json');
  }

  setSeed(seed);
  generateWorld();
  initChronicle();
  G.resources = {
    wood: 500, stone: 500, food: 500, gold: 500, iron: 50,
    wheat: 0, flour: 0, planks: 0, tools: 0,
  };
  if (hostileParticleSchedule) {
    G.particles = Array.from({ length: 500 }, (_, index) => ({ type: 'shell-probe', index }));
  }
  const mapFingerprint = hashCanonical(G.map);

  const script = [...BASE_SCRIPT];
  if (changedCommand) script.push({ at: 15000, rally: { x: 31, y: 37 } });
  script.sort((a, b) => a.at - b.at);
  const applied = [];
  const checkpoints = [];
  const ticks = 12 * G.dayLength;

  for (let tick = 1; tick <= ticks; tick++) {
    if (hostileParticleSchedule) {
      // Model an unrelated shell alternately draining and saturating its
      // presentation queue. Neither the branch nor the queue contents may
      // alter simulation RNG or authoritative state.
      if (tick % 5 === 0) G.particles.length = 0;
      if (tick % 7 === 0) {
        while (G.particles.length < 500) G.particles.push({ type: 'shell-probe', tick });
      }
    }
    for (const command of script) {
      if (command.at !== tick) continue;
      const application = applyScriptCommand(command);
      applied.push({
        at: tick,
        label: application.label,
        ok: application.result.ok,
        reason: application.result.reason || null,
        spot: application.spot || null,
      });
    }
    coreTick();
    if (tick === 1 && G.gameTick !== 1) throw new Error('coreTick() did not advance root G');
    if (tick === 10 && ((G._commandLog || []).length !== 1 || G.buildings.length !== 1)) {
      throw new Error('dispatch() did not commit its accepted building to root G');
    }
    if (tick === 21600) {
      const state = simulationSnapshot();
      checkpoints.push({
        tick: G.gameTick,
        day: G.day,
        dayPhase: G.dayPhase,
        population: G.population,
        buildings: buildingSummary(),
        resources: { ...G.resources },
        worldHash: hashCanonical(state),
      });
    }
  }

  if (mutateChronicle) {
    G.chronicle.push({
      day: G.day,
      season: G.season,
      tick: G.gameTick,
      text: 'Determinism control: a different remembered event.',
      tag: 'echo',
    });
  }
  const snapshot = simulationSnapshot();
  const worldHash = hashCanonical(snapshot);
  const replayHash = hashCanonical(replayEnvelope(snapshot));
  return strictCanonicalize({
    contract: {
      simulationVersion: runtimeContract.simulationVersion,
      coreSystemOrderVersion: runtimeContract.coreSystemOrderVersion,
    },
    identity: {
      rootEqualsCore: coreStateIdentity() === G,
      rootEqualsCommands: commandStateIdentity() === G,
    },
    tick: G.gameTick,
    day: G.day,
    dayPhase: G.dayPhase,
    population: G.population,
    mapFingerprint,
    worldHash,
    replayHash,
    commandCount: (G._commandLog || []).length,
    applied,
    checkpoints,
    buildings: buildingSummary(),
    story: storySummary(),
    changedCommandState: {
      armyStance: G.armyStance,
      rallyPoint: G.rallyPoint,
    },
  });
}
