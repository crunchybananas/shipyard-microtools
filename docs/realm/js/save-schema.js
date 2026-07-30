// Engine v2 save schema and object-graph codec.
//
// This module is deliberately a leaf: it has no game-state, DOM, storage, or
// event-bus dependencies. The repository contract is the single source for
// every epoch/version value.

import contract from '../runtime-contract.json?realm=174' with { type: 'json' };

export const SAVE_KEY = contract.saveKey;
export const SAVE_SCHEMA = contract.saveSchema;
export const SAVE_VERSION = contract.saveVersion;
export const SIMULATION_VERSION = contract.simulationVersion;
export const CORE_SYSTEM_ORDER_VERSION = contract.coreSystemOrderVersion;

const GRAPH_FORMAT = 'realm.object-graph-v1';
const MAX_NODES = 250_000;
const MAX_COLLECTION_ITEMS = 200_000;
const MAX_TOTAL_VALUES = 2_000_000;
const MAX_STRING_LENGTH = 1_000_000;
const MAX_DEPTH = 512;
const TYPED_ARRAYS = new Map([
  ['Int8Array', Int8Array],
  ['Uint8Array', Uint8Array],
  ['Uint8ClampedArray', Uint8ClampedArray],
  ['Int16Array', Int16Array],
  ['Uint16Array', Uint16Array],
  ['Int32Array', Int32Array],
  ['Uint32Array', Uint32Array],
  ['Float32Array', Float32Array],
  ['Float64Array', Float64Array],
]);

function failure(code, path, message) {
  return { ok: false, error: { code, path, message } };
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, path) {
  if (!isPlainObject(value)) return failure('wrong-type', path, 'Expected an object.');
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, i) => key !== wanted[i])) {
    return failure('incompatible-fields', path, `Expected fields: ${wanted.join(', ')}.`);
  }
  return { ok: true };
}

function validFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0);
}

function validateMissionState(value, path) {
  const keys = exactKeys(value, ['id', 'done', 'celebratedTick'], path);
  if (!keys.ok) return keys;
  if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 128) {
    return failure('wrong-type', `${path}.id`, 'Mission id must be a non-empty bounded string.');
  }
  if (typeof value.done !== 'boolean') {
    return failure('wrong-type', `${path}.done`, 'Mission done must be boolean.');
  }
  if (value.celebratedTick !== null && (!Number.isSafeInteger(value.celebratedTick) || value.celebratedTick < 0 || Object.is(value.celebratedTick, -0))) {
    return failure('wrong-type', `${path}.celebratedTick`, 'Mission celebratedTick must be null or a non-negative safe integer.');
  }
  return { ok: true };
}

function validateEncodedValue(value, path, nodeCount, budget) {
  budget.count++;
  if (budget.count > MAX_TOTAL_VALUES) {
    return failure('collection-too-large', path, `Save exceeds ${MAX_TOTAL_VALUES} encoded values.`);
  }
  if (value === null || typeof value === 'boolean') return { ok: true };
  if (typeof value === 'number') {
    return validFiniteNumber(value)
      ? { ok: true }
      : failure('non-finite-number', path, 'Numbers must be finite.');
  }
  if (typeof value === 'string') {
    return value.length <= MAX_STRING_LENGTH
      ? { ok: true }
      : failure('string-too-large', path, `String exceeds ${MAX_STRING_LENGTH} characters.`);
  }
  const tagged = exactKeys(value, value?.$ === 'ref' ? ['$', 'id'] : ['$'], path);
  if (!tagged.ok) return tagged;
  if (value.$ === 'undefined' || value.$ === 'hole') return { ok: true };
  if (value.$ !== 'ref') return failure('unknown-value-tag', `${path}.$`, 'Unknown encoded value tag.');
  if (!Number.isSafeInteger(value.id) || value.id < 0 || value.id >= nodeCount) {
    return failure('invalid-reference', `${path}.id`, 'Graph reference is outside the node table.');
  }
  return { ok: true };
}

function validateNode(node, index, nodeCount, budget) {
  const path = `$.state.nodes[${index}]`;
  if (!isPlainObject(node) || typeof node.kind !== 'string') {
    return failure('wrong-type', path, 'Graph node must be an object with a kind.');
  }
  if (node.kind === 'object') {
    const keys = exactKeys(node, ['kind', 'entries'], path);
    if (!keys.ok) return keys;
    if (!Array.isArray(node.entries) || node.entries.length > MAX_COLLECTION_ITEMS) {
      return failure('collection-too-large', `${path}.entries`, 'Object entries must be a bounded array.');
    }
    const seen = new Set();
    for (let i = 0; i < node.entries.length; i++) {
      const pair = node.entries[i];
      const pairPath = `${path}.entries[${i}]`;
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') {
        return failure('wrong-type', pairPath, 'Object entry must be [string, encodedValue].');
      }
      const key = pair[0];
      if (key.length > MAX_STRING_LENGTH || key === '__proto__' || key === 'prototype' || key === 'constructor') {
        return failure('invalid-object-key', `${pairPath}[0]`, 'Object key is unsafe or too large.');
      }
      if (seen.has(key)) return failure('duplicate-key', `${pairPath}[0]`, `Duplicate object key ${key}.`);
      seen.add(key);
      const valid = validateEncodedValue(pair[1], `${pairPath}[1]`, nodeCount, budget);
      if (!valid.ok) return valid;
    }
    return { ok: true };
  }
  if (node.kind === 'array' || node.kind === 'set') {
    const field = node.kind === 'array' ? 'items' : 'values';
    const keys = exactKeys(node, node.kind === 'array' ? ['kind', field, 'entries'] : ['kind', field], path);
    if (!keys.ok) return keys;
    if (!Array.isArray(node[field]) || node[field].length > MAX_COLLECTION_ITEMS) {
      return failure('collection-too-large', `${path}.${field}`, `${node.kind} values must be a bounded array.`);
    }
    const setValues = node.kind === 'set' ? new Set() : null;
    for (let i = 0; i < node[field].length; i++) {
      const valid = validateEncodedValue(node[field][i], `${path}.${field}[${i}]`, nodeCount, budget);
      if (!valid.ok) return valid;
      if (setValues) {
        const identity = JSON.stringify(node[field][i]);
        if (setValues.has(identity)) return failure('duplicate-reference', `${path}.${field}[${i}]`, 'Set contains a duplicate encoded value.');
        setValues.add(identity);
      }
    }
    if (node.kind === 'array') {
      if (!Array.isArray(node.entries) || node.entries.length > MAX_COLLECTION_ITEMS) {
        return failure('collection-too-large', `${path}.entries`, 'Array custom entries must be a bounded array.');
      }
      const seen = new Set();
      for (let i = 0; i < node.entries.length; i++) {
        const pair = node.entries[i];
        const pairPath = `${path}.entries[${i}]`;
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') {
          return failure('wrong-type', pairPath, 'Array custom entry must be [string, encodedValue].');
        }
        const key = pair[0];
        if (key.length > MAX_STRING_LENGTH || /^(0|[1-9]\d*)$/.test(key) || key === 'length' || key === '__proto__' || key === 'prototype' || key === 'constructor') {
          return failure('invalid-object-key', `${pairPath}[0]`, 'Array custom key is unsafe or conflicts with an index.');
        }
        if (seen.has(key)) return failure('duplicate-key', `${pairPath}[0]`, `Duplicate array key ${key}.`);
        seen.add(key);
        const valid = validateEncodedValue(pair[1], `${pairPath}[1]`, nodeCount, budget);
        if (!valid.ok) return valid;
      }
    }
    return { ok: true };
  }
  if (node.kind === 'typed-array') {
    const keys = exactKeys(node, ['kind', 'type', 'values'], path);
    if (!keys.ok) return keys;
    const Constructor = TYPED_ARRAYS.get(node.type);
    if (!Constructor) return failure('unknown-typed-array', `${path}.type`, 'Unsupported typed-array type.');
    if (!Array.isArray(node.values) || node.values.length > MAX_COLLECTION_ITEMS) {
      return failure('collection-too-large', `${path}.values`, 'Typed-array values must be a bounded array.');
    }
    for (let i = 0; i < node.values.length; i++) {
      const n = node.values[i];
      if (!validFiniteNumber(n)) return failure('non-finite-number', `${path}.values[${i}]`, 'Typed-array values must be finite and not negative zero.');
      if (!node.type.startsWith('Float') && !Number.isSafeInteger(n)) {
        return failure('wrong-type', `${path}.values[${i}]`, 'Integer typed arrays require integer values.');
      }
      if (new Constructor([n])[0] !== n) {
        return failure('out-of-range', `${path}.values[${i}]`, `Value is outside ${node.type} range.`);
      }
    }
    budget.count += node.values.length;
    if (budget.count > MAX_TOTAL_VALUES) {
      return failure('collection-too-large', path, `Save exceeds ${MAX_TOTAL_VALUES} encoded values.`);
    }
    return { ok: true };
  }
  return failure('unknown-node-kind', `${path}.kind`, 'Unknown graph node kind.');
}

export function validateSave(raw) {
  let envelope = raw;
  if (typeof raw === 'string') {
    try {
      envelope = JSON.parse(raw);
    } catch (_error) {
      return failure('malformed-json', '$', 'Save is not valid JSON.');
    }
  }

  const envelopeKeys = exactKeys(envelope, [
    'schema',
    'saveVersion',
    'simulationVersion',
    'coreSystemOrderVersion',
    'savedAt',
    'state',
  ], '$');
  if (!envelopeKeys.ok) return envelopeKeys;
  if (envelope.schema !== SAVE_SCHEMA) return failure('wrong-schema', '$.schema', 'Save schema does not match this runtime.');
  if (envelope.saveVersion !== SAVE_VERSION) return failure('wrong-save-version', '$.saveVersion', 'Save version does not match this runtime.');
  if (envelope.simulationVersion !== SIMULATION_VERSION) return failure('wrong-simulation-version', '$.simulationVersion', 'Simulation version does not match this runtime.');
  if (envelope.coreSystemOrderVersion !== CORE_SYSTEM_ORDER_VERSION) {
    return failure('wrong-system-order-version', '$.coreSystemOrderVersion', 'Core system order version does not match this runtime.');
  }
  if (!Number.isSafeInteger(envelope.savedAt) || envelope.savedAt < 0 || Object.is(envelope.savedAt, -0)) {
    return failure('wrong-type', '$.savedAt', 'savedAt must be a non-negative safe integer.');
  }

  const stateKeys = exactKeys(envelope.state, ['graphFormat', 'roots', 'nodes'], '$.state');
  if (!stateKeys.ok) return stateKeys;
  if (envelope.state.graphFormat !== GRAPH_FORMAT) {
    return failure('wrong-graph-format', '$.state.graphFormat', 'Unknown save graph format.');
  }
  if (!Array.isArray(envelope.state.nodes) || envelope.state.nodes.length === 0 || envelope.state.nodes.length > MAX_NODES) {
    return failure('collection-too-large', '$.state.nodes', `Node table must contain 1-${MAX_NODES} nodes.`);
  }

  const rootKeys = exactKeys(envelope.state.roots, ['game', 'rngSeed', 'missions'], '$.state.roots');
  if (!rootKeys.ok) return rootKeys;
  if (!Number.isSafeInteger(envelope.state.roots.rngSeed) || envelope.state.roots.rngSeed < 0 || envelope.state.roots.rngSeed > 0x7fffffff || Object.is(envelope.state.roots.rngSeed, -0)) {
    return failure('invalid-rng-seed', '$.state.roots.rngSeed', 'RNG seed must be an integer in the runtime RNG range.');
  }
  if (!Array.isArray(envelope.state.roots.missions) || envelope.state.roots.missions.length > 10_000) {
    return failure('collection-too-large', '$.state.roots.missions', 'Mission state must be a bounded array.');
  }
  const missionIds = new Set();
  for (let i = 0; i < envelope.state.roots.missions.length; i++) {
    const mission = envelope.state.roots.missions[i];
    const valid = validateMissionState(mission, `$.state.roots.missions[${i}]`);
    if (!valid.ok) return valid;
    if (missionIds.has(mission.id)) return failure('duplicate-reference', `$.state.roots.missions[${i}].id`, 'Mission ids must be unique.');
    missionIds.add(mission.id);
  }

  const budget = { count: 0 };
  const rootValid = validateEncodedValue(envelope.state.roots.game, '$.state.roots.game', envelope.state.nodes.length, budget);
  if (!rootValid.ok) return rootValid;
  if (!isPlainObject(envelope.state.roots.game) || envelope.state.roots.game.$ !== 'ref') {
    return failure('wrong-type', '$.state.roots.game', 'Game root must be a graph reference.');
  }
  for (let i = 0; i < envelope.state.nodes.length; i++) {
    const valid = validateNode(envelope.state.nodes[i], i, envelope.state.nodes.length, budget);
    if (!valid.ok) return valid;
  }
  const rootNode = envelope.state.nodes[envelope.state.roots.game.id];
  if (!rootNode || rootNode.kind !== 'object') {
    return failure('wrong-type', '$.state.roots.game', 'Game root must reference an object node.');
  }
  const reachable = new Set();
  const pending = [envelope.state.roots.game.id];
  const enqueue = value => {
    if (value && typeof value === 'object' && value.$ === 'ref' && !reachable.has(value.id)) pending.push(value.id);
  };
  while (pending.length) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = envelope.state.nodes[id];
    if (node.kind === 'object') for (const [, value] of node.entries) enqueue(value);
    else if (node.kind === 'array') {
      for (const value of node.items) enqueue(value);
      for (const [, value] of node.entries) enqueue(value);
    } else if (node.kind === 'set') for (const value of node.values) enqueue(value);
  }
  if (reachable.size !== envelope.state.nodes.length) {
    return failure('unreachable-node', '$.state.nodes', 'Graph contains state that is unreachable from the game root.');
  }
  return { ok: true, value: envelope };
}

export function encodeGraphState(game, rngSeed, missionState, { includeProperty = () => true } = {}) {
  if (typeof includeProperty !== 'function') throw new TypeError('includeProperty must be a function');
  const ids = new Map();
  const nodes = [];
  const seenBuffers = new Set();

  function encode(value, path, depth = 0) {
    if (depth > MAX_DEPTH) throw new TypeError(`${path}: graph exceeds maximum depth ${MAX_DEPTH}`);
    if (value === undefined) return { $: 'undefined' };
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError(`${path}: non-finite or negative-zero number`);
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > MAX_STRING_LENGTH) throw new TypeError(`${path}: string too large`);
      return value;
    }
    if (typeof value !== 'object') throw new TypeError(`${path}: unsupported ${typeof value}`);
    if (ids.has(value)) return { $: 'ref', id: ids.get(value) };
    if (nodes.length >= MAX_NODES) throw new TypeError(`${path}: graph has too many nodes`);

    const id = nodes.length;
    ids.set(value, id);
    nodes.push(null);

    if (Array.isArray(value)) {
      const extraKeys = Object.keys(value).filter(key => (
        !/^(0|[1-9]\d*)$/.test(key) && includeProperty(value, key, path)
      ));
      if (Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path}: symbol-keyed array state is unsupported`);
      if (!Object.getOwnPropertyDescriptor(value, 'length')?.writable) throw new TypeError(`${path}: non-writable array length is unsupported`);
      const hiddenKeys = Object.getOwnPropertyNames(value).filter(key => key !== 'length' && !Object.getOwnPropertyDescriptor(value, key)?.enumerable);
      if (hiddenKeys.length) throw new TypeError(`${path}: non-enumerable array state is unsupported`);
      if (value.length > MAX_COLLECTION_ITEMS) throw new TypeError(`${path}: array too large`);
      const items = new Array(value.length);
      for (let i = 0; i < value.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(value, i)) {
          items[i] = { $: 'hole' };
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable || !descriptor.writable || !descriptor.configurable) {
          throw new TypeError(`${path}[${i}]: array indices must be ordinary writable data properties`);
        }
        items[i] = encode(descriptor.value, `${path}[${i}]`, depth + 1);
      }
      nodes[id] = {
        kind: 'array',
        items,
        // Named array properties (notably path.goal) are observable in their
        // own insertion order just like ordinary object properties.
        entries: extraKeys.map(key => {
          if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new TypeError(`${path}: unsafe array key`);
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable || !descriptor.writable || !descriptor.configurable) {
            throw new TypeError(`${path}.${key}: array properties must be ordinary writable data properties`);
          }
          return [key, encode(descriptor.value, `${path}.${key}`, depth + 1)];
        }),
      };
      return { $: 'ref', id };
    }

    if (value instanceof Set) {
      if (value.size > MAX_COLLECTION_ITEMS) throw new TypeError(`${path}: set too large`);
      if (Object.getOwnPropertyNames(value).length || Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path}: custom Set properties are unsupported`);
      nodes[id] = { kind: 'set', values: [...value].map((item, i) => encode(item, `${path}<${i}>`, depth + 1)) };
      return { $: 'ref', id };
    }

    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      const type = value.constructor.name;
      if (!TYPED_ARRAYS.has(type)) throw new TypeError(`${path}: unsupported typed array ${type}`);
      if (value.length > MAX_COLLECTION_ITEMS) throw new TypeError(`${path}: typed array too large`);
      const extraKeys = Object.keys(value).filter(key => !/^(0|[1-9]\d*)$/.test(key));
      const ownNames = Object.getOwnPropertyNames(value).filter(key => !/^(0|[1-9]\d*)$/.test(key));
      if (extraKeys.length || ownNames.length || Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path}: custom typed-array properties are unsupported`);
      if (value.byteOffset !== 0 || value.byteLength !== value.buffer.byteLength) throw new TypeError(`${path}: sliced typed-array views are unsupported`);
      if (seenBuffers.has(value.buffer)) throw new TypeError(`${path}: shared typed-array buffers are unsupported`);
      seenBuffers.add(value.buffer);
      for (let i = 0; i < value.length; i++) {
        if (Object.is(value[i], -0)) throw new TypeError(`${path}[${i}]: negative zero is unsupported`);
      }
      nodes[id] = { kind: 'typed-array', type, values: Array.from(value) };
      return { $: 'ref', id };
    }

    if (!isPlainObject(value)) {
      throw new TypeError(`${path}: unsupported object prototype ${value.constructor?.name || 'unknown'}`);
    }
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length) throw new TypeError(`${path}: symbol-keyed state is unsupported`);
    const hiddenKeys = Object.getOwnPropertyNames(value).filter(key => !Object.getOwnPropertyDescriptor(value, key)?.enumerable);
    if (hiddenKeys.length) throw new TypeError(`${path}: non-enumerable state is unsupported`);
    // Preserve ECMAScript own-key enumeration order. Simulation code such as
    // Object.entries(building.produced)[0] observes it when choosing cargo;
    // sorting here would silently change the future after a load.
    const keys = Object.keys(value).filter(key => includeProperty(value, key, path));
    if (keys.length > MAX_COLLECTION_ITEMS) throw new TypeError(`${path}: object too large`);
    const entries = keys.map(key => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new TypeError(`${path}: unsafe object key`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable || !descriptor.writable || !descriptor.configurable) {
        throw new TypeError(`${path}.${key}: object properties must be ordinary writable data properties`);
      }
      return [key, encode(descriptor.value, `${path}.${key}`, depth + 1)];
    });
    nodes[id] = { kind: 'object', entries };
    return { $: 'ref', id };
  }

  const state = {
    graphFormat: GRAPH_FORMAT,
    roots: {
      game: encode(game, '$.game'),
      rngSeed,
      missions: missionState.map(mission => ({ ...mission })),
    },
    nodes,
  };
  return state;
}

export function decodeGraphState(state) {
  const shells = state.nodes.map(node => {
    if (node.kind === 'object') return {};
    if (node.kind === 'array') return new Array(node.items.length);
    if (node.kind === 'set') return new Set();
    if (node.kind === 'typed-array') return new (TYPED_ARRAYS.get(node.type))(node.values);
    throw new TypeError(`Unknown graph node kind: ${node.kind}`);
  });

  function decode(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value.$ === 'undefined') return undefined;
    if (value.$ === 'hole') return decodeGraphState.HOLE;
    if (value.$ === 'ref') return shells[value.id];
    throw new TypeError(`Unknown encoded value tag: ${String(value.$)}`);
  }

  for (let i = 0; i < state.nodes.length; i++) {
    const node = state.nodes[i];
    const shell = shells[i];
    if (node.kind === 'object') {
      for (const [key, value] of node.entries) {
        Object.defineProperty(shell, key, {
          value: decode(value), enumerable: true, configurable: true, writable: true,
        });
      }
    } else if (node.kind === 'array') {
      for (let j = 0; j < node.items.length; j++) {
        const value = decode(node.items[j]);
        if (value !== decodeGraphState.HOLE) shell[j] = value;
      }
      for (const [key, encoded] of node.entries) {
        Object.defineProperty(shell, key, {
          value: decode(encoded), enumerable: true, configurable: true, writable: true,
        });
      }
    } else if (node.kind === 'set') {
      for (const value of node.values) shell.add(decode(value));
    }
  }
  return shells[state.roots.game.id];
}

decodeGraphState.HOLE = Symbol('save-array-hole');

export function makeEnvelope(state, savedAt = 0) {
  return {
    schema: SAVE_SCHEMA,
    saveVersion: SAVE_VERSION,
    simulationVersion: SIMULATION_VERSION,
    coreSystemOrderVersion: CORE_SYSTEM_ORDER_VERSION,
    savedAt,
    state,
  };
}
