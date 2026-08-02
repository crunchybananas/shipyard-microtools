// Pure Engine v2 state capture, validation, preparation, and atomic commit.
// Storage and DOM feedback live in save.js.

import {
  G, MAP_W, MAP_H, TILE, BUILDINGS, RESOURCE_KEYS,
  RESETTABLE_PRESENTATION_ENTITY_FIELDS, RESET_ON_LOAD_G_KEYS,
  STATE_OWNERSHIP, createResetOnLoadState, getSeed, setSeed,
} from './state.js?realm=187';
import { missions } from './missions.js?realm=187';
import {
  decodeGraphState,
  encodeGraphState,
  makeEnvelope,
  validateSave,
} from './save-schema.js?realm=187';
import {
  ACTIVITY_REASONS,
  ASSIGNMENT_CLAIM_REASONS,
  assignmentPurposeForProfession,
  CITIZEN_ACTIVITIES,
  CITIZEN_APPEARANCE_IDS,
  CITIZEN_PROFESSIONS,
  citizenStaffingCapacity,
  PROFESSION_REASONS,
} from './citizen-ownership.js?realm=187';

// These values are browser-process resources, not realm state. Every other
// enumerable G field is persisted. Unsupported values fail serialization
// instead of being silently dropped.
const PROCESS_LOCAL_G_KEYS = new Set(STATE_OWNERSHIP.processLocalRoot);
const RESET_ON_LOAD_G_KEY_SET = new Set(RESET_ON_LOAD_G_KEYS);
const PREPARED = new WeakMap();
const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);
const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const ARMY_STANCES = new Set(['defend', 'rally', 'patrol']);
const SPEEDS = new Set([0, 1, 2, 4]);
const WEATHER = new Set(['clear', 'rain']);
const SCENARIOS = new Set(['peaceful_start', 'military_rise', 'merchant_kingdom', 'seafaring', 'industrial']);
const TECH_RULES = new Map([
  ['agriculture', { time: 0, prereq: null, era: 1 }],
  ['forestry', { time: 0, prereq: null, era: 1 }],
  ['masonry', { time: 300, prereq: null, era: 1 }],
  ['engineering', { time: 900, prereq: 'masonry', era: 2 }],
  ['metallurgy', { time: 1000, prereq: 'masonry', era: 2 }],
  ['commerce', { time: 350, prereq: null, era: 1 }],
  ['military', { time: 1100, prereq: 'metallurgy', era: 2 }],
  ['brewing', { time: 700, prereq: 'commerce', era: 2 }],
  ['architecture', { time: 2000, prereq: 'military', era: 3 }],
  ['baking', { time: 350, prereq: 'agriculture', era: 1 }],
  ['husbandry', { time: 300, prereq: 'agriculture', era: 1 }],
  ['smithing', { time: 900, prereq: 'metallurgy', era: 2 }],
  ['archery', { time: 900, prereq: 'military', era: 2 }],
  ['guilds', { time: 1500, prereq: 'smithing', era: 3 }],
  ['monuments', { time: 2400, prereq: 'architecture', era: 3 }],
]);
const WONDER_BILLS = Object.freeze([
  Object.freeze({ stone: 200, wood: 100 }),
  Object.freeze({ planks: 150, stone: 100, gold: 80 }),
  Object.freeze({ tools: 40, gold: 150, food: 120 }),
  Object.freeze({}),
]);
const EVENT_IDS = new Set([
  'drought', 'gold_rush', 'migration', 'bountiful', 'bandits', 'festival',
  'iron_discovery', 'wandering_merchant', 'earthquake', 'fog_of_exploration',
  'gold_windfall', 'blessed_harvest', 'winter_storm', 'royal_visit',
  'bandit_raid', 'rainstorm', 'fire', 'plague', 'stranger_trade',
  'bard_song', 'rival_demand',
]);
const NOTIFICATION_TYPES = new Set(['info', 'danger', 'event', 'mission', 'success', 'warn']);
const CHRONICLE_TAGS = new Set([
  'birth', 'character', 'death', 'dream', 'echo', 'era', 'event', 'milestone',
  'misc', 'nightmare', 'raid', 'research', 'requiem', 'season', 'stone', 'victory',
]);
const NAMED_CHARACTER_ROLES = new Set(['mayor', 'bard', 'rival', 'smith', 'merchant', 'teacher']);
const DEATH_CAUSES = new Set(['battle', 'plague', 'raid']);
const PLUNDER_RESOURCE_KEYS = new Set(['gold', 'food', 'wood']);
const CITIZEN_STATES = new Set(CITIZEN_ACTIVITIES);
const CITIZEN_APPEARANCE_ID_SET = new Set(CITIZEN_APPEARANCE_IDS);
const CITIZEN_PROFESSION_SET = new Set(CITIZEN_PROFESSIONS);
const CITIZEN_ACTIVITY_REASON_SET = new Set(ACTIVITY_REASONS);
const CITIZEN_ASSIGNMENT_REASON_SET = new Set(ASSIGNMENT_CLAIM_REASONS);
const CITIZEN_PROFESSION_REASON_SET = new Set(PROFESSION_REASONS);
const RESOURCE_KEY_SET = new Set(RESOURCE_KEYS);

// Exact current Engine v2 root surface. Optional fields are still named here:
// a version-matching blob cannot smuggle arbitrary state into G. When a new
// system adds authoritative root state it must update this schema and, when
// semantics change, the runtime contract.
const ALLOWED_GAME_KEYS = new Set([
  '_buildRipples', '_churchBeam', '_commandLog', '_confetti', '_dailyFoodConsumed',
  '_followAvatar', '_hoveredBiome', '_lastDevolveNotice', '_lastFoodWarnDay',
  '_lastPaintTile', '_lastPlaceFailMsg', '_lastRaidFireDay', '_lastSaveTick',
  '_lightningFlash', '_lightningTimer', '_milestone10', '_milestone25',
  '_milestone50', '_milestone75', '_moodDelta', '_patrolEmptyNotified',
  '_patrolPosts', '_patrolPostsBuildingCount', '_raidSide', '_raidSpawnCount',
  '_raidStolen', '_raidWarningGiven', '_refreshPanelFor', '_renderAlpha',
  '_renderDeltaMs', '_scenarioWon',
  '_undoStack', 'acorns', 'activeEvent', 'animals', 'armyStance', 'avatar',
  'bats', 'bigSnow', 'birds', 'boats', 'bolts', 'buildingGrid',
  'buildings', 'bunnies', 'camStart', 'camera', 'cameraShake', 'caravans',
  'carts', 'chronicle', 'citizens', 'clouds', 'crabs', 'currentResearch', 'day',
  'dayLength', 'dayPhase', 'deathMarkers', 'debug', 'defense', 'difficulty',
  'dragStart', 'dragging', 'dustDevils', 'eagles', 'enemies', 'era',
  'eraStartDay', 'eventModifiers', 'fishJumps', 'flocks', 'fog', 'footprints',
  'frogs', 'gameTick', 'happiness', 'hawks', 'hoveredBiome', 'hoveredTile',
  'kingdomName', 'lastDeathDay', 'lastRaidDay', 'lastResources',
  'lastUnderpopDay', 'map', 'maxPop', 'meteors', 'mouseX', 'mouseY',
  'namedCharacters', 'nextActorId', 'nextRaidDay', 'notificationLog', 'obstacleEpoch', 'owls',
  'particles', 'photoMode', 'pigeons', 'population', 'projectiles', 'raidFlash',
  'raidInterval', 'raidSmoke', 'rallyPoint', 'rams', 'realmEnded',
  'researchSparkles', 'researchedTechs', 'resourceRates', 'resources', 'scenario',
  'schoolKids', 'season', 'selectedBuild', 'selectedBuilding', 'selectedCitizenId',
  'snowmen', 'soldiers', 'speed', 'stats', 'storyFlags', 'storyState', 'tileWear',
  'totalResourcesGathered', 'tradeShips', 'volcanoSmoke', 'walkers', 'weather',
  'wolves', 'won', 'wonder',
]);
const REQUIRED_GAME_KEYS = new Set([
  'map', 'fog', 'buildings', 'citizens', 'soldiers', 'buildingGrid',
  'enemies', 'projectiles', 'resources', 'population', 'maxPop',
  'happiness', 'defense', 'day', 'dayPhase', 'dayLength', 'gameTick', 'speed',
  'camera', 'nextRaidDay',
  'raidInterval', 'researchedTechs', 'currentResearch', 'caravans', 'walkers',
  'raidFlash', 'activeEvent', 'eventModifiers', 'weather', 'season', 'rallyPoint',
  'armyStance', 'won', 'era', 'eraStartDay', 'wonder', 'clouds', 'cameraShake',
  'tileWear', 'difficulty', 'scenario', 'kingdomName', 'resourceRates',
  'notificationLog', 'lastResources', 'stats', 'avatar', 'chronicle',
  'storyFlags', 'storyState', 'namedCharacters', 'debug',
  'nextActorId',
]);
for (const key of RESET_ON_LOAD_G_KEYS) {
  ALLOWED_GAME_KEYS.delete(key);
  REQUIRED_GAME_KEYS.delete(key);
}
// Development epoch: there is one fully initialized authoritative root.
// Optional behavior is represented by null/false/empty collections, never by
// silently absent save fields.
for (const key of ALLOWED_GAME_KEYS) REQUIRED_GAME_KEYS.add(key);

const CITIZEN_KEYS = new Set([
  'actorId', 'identity', 'profession', 'assignment', 'activity',
  'x', 'y', 'tx', 'ty', 'speed', 'hp', 'carrying',
  'carryAmount', 'hunger', 'rest', 'needs', 'home', 'activityTimer',
  'path', 'pathIdx', 'faceX', 'faceZ', 'hurtTimer', 'workTarget', 'forageTarget',
  '_deliveryTarget', '_evacRot', '_evacTarget', '_evacTicks', '_fleeing', '_hb',
  '_lastPathX', '_lastPathY', '_leisureDay',
  '_leisureTarget', '_movedAt', '_needsDeliveryNoticeAt', '_noGo', '_pathEpoch',
  '_pathFailedAt', '_pathGoal', '_pathStartedAt', '_requestedTx', '_requestedTy',
  '_stuckTicks', '_wdBest', '_wdTicks', '_workFaceX', '_workFaceZ',
  '_px', '_py',
]);
const REQUIRED_CITIZEN_KEYS = new Set([
  'actorId', 'identity', 'profession', 'assignment', 'activity',
  'x', 'y', 'tx', 'ty', 'speed', 'carrying',
  'carryAmount', 'hunger', 'rest', 'needs', 'home', 'activityTimer',
  'path', 'pathIdx',
]);
const BUILDING_KEYS = new Set([
  'type', 'x', 'y', 'hp', 'active', 'prodTimer', 'produced',
  'prodShowCount', 'level', 'buildProgress', 'buildTotal', 'buildStartedAt',
  '_fireTimer', 'caravanOut', 'completeTick', 'fireTimer', 'onFire',
  'tierStreak', 'toolCycle', 'trainTimer', 'upgradeTick', 'visits',
]);
const REQUIRED_BUILDING_KEYS = new Set([
  'type', 'x', 'y', 'hp', 'active', 'prodTimer', 'produced',
  'prodShowCount', 'level', 'buildProgress', 'buildTotal', 'buildStartedAt',
]);
const AVATAR_KEYS = new Set(['x', 'y', 'tx', 'ty', 'vx', 'vy', 'path', 'pathIdx', 'speed', 'name', 'state', 'faceX', 'faceZ', '_movedAt', '_px', '_py', '_laneX', '_laneY', '_dirKey', '_dirPend', '_dirPendMs', '_actorAnimationKey', '_actorAnimationStartedAt']);
const REQUIRED_AVATAR_KEYS = new Set(['x', 'y', 'tx', 'ty', 'vx', 'vy', 'path', 'pathIdx', 'speed', 'name', 'state', 'faceX', 'faceZ']);
const SOLDIER_KEYS = new Set(['x', 'y', 'tx', 'ty', 'homeBuilding', 'garrison', 'name', 'type', 'hp', 'maxHp', 'state', 'stateTimer', '_postIdx', 'attackTimer', '_px', '_py', '_pdx', '_pdy', '_mvx', '_mvy', '_movedAt', '_actorAnimationKey', '_actorAnimationStartedAt']);
const ENEMY_KEYS = new Set(['x', 'y', 'tx', 'ty', 'hp', 'maxHp', 'damage', 'plunderGoal', 'type', 'state', 'variant', 'attackCue', 'attackTimer', 'engaged', 'loot', 'plundered', 'retreating', '_px', '_py']);
const PROJECTILE_KEYS = new Set(['x', 'y', 'tx', 'ty', 'target', 'damage', 'life', 'type']);
const WALKER_KEYS = new Set(['x', 'y', 'tx', 'ty', 'home', 'color', 'emoji', 'life', 'visitedHouses', 'hauler', 'src', 'leg', '_px', '_py', '_actorAnimationKey', '_actorAnimationStartedAt']);
const CARAVAN_KEYS = new Set(['x', 'y', 'tx', 'ty', 'homeX', 'homeY', 'phase', 'gold', 'building', 'speed', '_px', '_py']);
const REQUIRED_SOLDIER_KEYS = new Set(['x', 'y', 'tx', 'ty', 'homeBuilding', 'name', 'type', 'hp', 'maxHp', 'state', 'stateTimer']);
const REQUIRED_ENEMY_KEYS = new Set(['x', 'y', 'tx', 'ty', 'hp', 'maxHp', 'damage', 'plunderGoal', 'type', 'state', 'variant']);
const REQUIRED_PROJECTILE_KEYS = PROJECTILE_KEYS;
const REQUIRED_WALKER_KEYS = new Set(['x', 'y', 'tx', 'ty', 'home', 'color', 'emoji', 'life', 'visitedHouses']);
const REQUIRED_CARAVAN_KEYS = new Set(['x', 'y', 'tx', 'ty', 'homeX', 'homeY', 'phase', 'gold', 'building', 'speed']);
for (const [kind, fields] of Object.entries(RESETTABLE_PRESENTATION_ENTITY_FIELDS)) {
  const allowed = {
    citizen: CITIZEN_KEYS,
    avatar: AVATAR_KEYS,
    soldier: SOLDIER_KEYS,
    enemy: ENEMY_KEYS,
    walker: WALKER_KEYS,
    caravan: CARAVAN_KEYS,
  }[kind];
  if (!allowed) throw new TypeError(`Unknown presentation entity kind: ${kind}`);
  for (const field of fields) allowed.delete(field);
}

function failure(code, path, message) {
  return { ok: false, error: { code, path, message } };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateObjectSurface(value, allowed, required, path) {
  if (!isObject(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return failure('wrong-type', path, 'Expected an ordinary object.');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return failure('unknown-field', `${path}.${key}`, `Unknown current-epoch field ${key}.`);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return failure('missing-field', `${path}.${key}`, `Missing required current-epoch field ${key}.`);
  }
  return { ok: true };
}

function validateFiniteFields(value, fields, path) {
  for (const key of fields) {
    if (!isFiniteNumber(value[key])) return failure('non-finite-number', `${path}.${key}`, `${key} must be finite.`);
  }
  return { ok: true };
}

function validatePath(pathValue, pathIndex, path) {
  if (pathValue === null) {
    return pathIndex === 0
      ? { ok: true }
      : failure('out-of-range', `${path}.pathIdx`, 'A null path requires pathIdx 0.');
  }
  if (!Array.isArray(pathValue) || pathValue.length > MAP_W * MAP_H) {
    return failure('invalid-path', `${path}.path`, 'Path must be null or a bounded waypoint array.');
  }
  const named = Object.keys(pathValue).filter(key => !/^(0|[1-9]\d*)$/.test(key));
  if (named.some(key => key !== 'goal')) return failure('unknown-field', `${path}.path`, 'Only path.goal is allowed as named path state.');
  if (!Number.isSafeInteger(pathIndex) || pathIndex < 0 || pathIndex > pathValue.length) {
    return failure('out-of-range', `${path}.pathIdx`, 'pathIdx is outside the waypoint array.');
  }
  const points = [...pathValue];
  if (pathValue.goal !== undefined) points.push(pathValue.goal);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!isObject(point) || Object.keys(point).length !== 2 || !Object.prototype.hasOwnProperty.call(point, 'x') || !Object.prototype.hasOwnProperty.call(point, 'y')) {
      return failure('invalid-path', `${path}.path[${i}]`, 'Waypoints must contain exactly x and y.');
    }
    if (!Number.isInteger(point.x) || point.x < 0 || point.x >= MAP_W || !Number.isInteger(point.y) || point.y < 0 || point.y >= MAP_H) {
      return failure('out-of-range', `${path}.path[${i}]`, 'Waypoint coordinates must be integer map positions.');
    }
  }
  return { ok: true };
}

function validateGrid(grid, path, cellCheck) {
  if (!Array.isArray(grid) || grid.length !== MAP_H) {
    return failure('invalid-dimensions', path, `Expected ${MAP_H} rows.`);
  }
  const surface = validateDenseArray(grid, path, MAP_H);
  if (!surface.ok) return surface;
  for (let y = 0; y < MAP_H; y++) {
    if (!Array.isArray(grid[y]) || grid[y].length !== MAP_W) {
      return failure('invalid-dimensions', `${path}[${y}]`, `Expected ${MAP_W} columns.`);
    }
    const rowSurface = validateDenseArray(grid[y], `${path}[${y}]`, MAP_W);
    if (!rowSurface.ok) return rowSurface;
    for (let x = 0; x < MAP_W; x++) {
      const error = cellCheck(grid[y][x], x, y);
      if (error) return failure(error.code, `${path}[${y}][${x}]`, error.message);
    }
  }
  return { ok: true };
}

function validateDenseArray(value, path, maxLength = Infinity, allowedNamedKeys = new Set()) {
  if (!Array.isArray(value)) return failure('wrong-type', path, 'Expected an array.');
  if (value.length > maxLength) return failure('out-of-range', path, `Array exceeds the ${maxLength}-item limit.`);
  for (let i = 0; i < value.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(value, i)) {
      return failure('sparse-array', `${path}[${i}]`, 'Current save arrays must be dense.');
    }
  }
  for (const key of Object.keys(value)) {
    if (!/^(0|[1-9]\d*)$/.test(key) && !allowedNamedKeys.has(key)) {
      return failure('unknown-field', `${path}.${key}`, `Unknown named array field ${key}.`);
    }
  }
  return { ok: true };
}

function fieldRule(predicate, message, code = 'wrong-type') {
  return (value, path) => predicate(value)
    ? { ok: true }
    : failure(code, path, message);
}

function nullableRule(validator) {
  return (value, path, owner) => value === null ? { ok: true } : validator(value, path, owner);
}

const finiteRule = fieldRule(isFiniteNumber, 'Expected a finite number.', 'non-finite-number');
const nonNegativeFiniteRule = fieldRule(value => isFiniteNumber(value) && value >= 0, 'Expected a non-negative finite number.', 'out-of-range');
const safeIntegerRule = fieldRule(Number.isSafeInteger, 'Expected a safe integer.');
const nonNegativeIntegerRule = fieldRule(value => Number.isSafeInteger(value) && value >= 0, 'Expected a non-negative safe integer.', 'out-of-range');
const positiveIntegerRule = fieldRule(value => Number.isSafeInteger(value) && value >= 1, 'Expected a positive safe integer.', 'out-of-range');
const booleanRule = fieldRule(value => typeof value === 'boolean', 'Expected a boolean.');
const boundedStringRule = fieldRule(value => typeof value === 'string' && value.length > 0 && value.length <= 160, 'Expected a non-empty string no longer than 160 characters.');
const ordinaryObjectRule = fieldRule(value => isObject(value) && Object.getPrototypeOf(value) === Object.prototype, 'Expected an ordinary object.');
const nullableObjectRule = nullableRule(ordinaryObjectRule);
const nullableReferenceRule = nullableRule(ordinaryObjectRule);
const denseArrayRule = (value, path) => validateDenseArray(value, path, 10000);
const pathArrayRule = (value, path) => validateDenseArray(value, path, MAP_W * MAP_H, new Set(['goal']));

function enumRule(values, label) {
  return fieldRule(value => values.has(value), `Unknown ${label}.`, 'invalid-enum');
}

function validateFieldContract(value, validators, path) {
  for (const key of Object.keys(value)) {
    const validator = validators.get(key);
    if (!validator) return failure('validator-missing', `${path}.${key}`, `No current-epoch validator exists for ${key}.`);
    const result = validator(value[key], `${path}.${key}`, value);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function assertContractCoverage(label, allowed, validators) {
  const missing = [...allowed].filter(key => !validators.has(key));
  const stale = [...validators.keys()].filter(key => !allowed.has(key));
  if (missing.length || stale.length) {
    throw new TypeError(`${label} save validator coverage mismatch; missing=[${missing.join(',')}], stale=[${stale.join(',')}]`);
  }
}

const ROOT_FIELD_VALIDATORS = new Map([
  ['_dailyFoodConsumed', nonNegativeIntegerRule],
  ['_lastDevolveNotice', nullableRule(nonNegativeIntegerRule)],
  ['_lastRaidFireDay', nullableRule(positiveIntegerRule)],
  ['_milestone10', booleanRule], ['_milestone25', booleanRule],
  ['_milestone50', booleanRule], ['_milestone75', booleanRule],
  ['_moodDelta', fieldRule(value => isFiniteNumber(value) && value >= -15 && value <= 15, 'Mood delta must be between -15 and 15.', 'out-of-range')],
  ['_patrolEmptyNotified', booleanRule],
  ['_patrolPosts', nullableRule(denseArrayRule)],
  ['_patrolPostsBuildingCount', fieldRule(value => Number.isSafeInteger(value) && value >= -1, 'Expected an integer of at least -1.', 'out-of-range')],
  ['_raidSide', nullableRule(fieldRule(value => Number.isSafeInteger(value) && value >= 0 && value <= 3, 'Raid side must be null or an integer from 0 through 3.', 'out-of-range'))],
  ['_raidSpawnCount', nonNegativeIntegerRule],
  ['_raidStolen', nullableObjectRule],
  ['_raidWarningGiven', booleanRule],
  ['_scenarioWon', booleanRule],
  ['_undoStack', denseArrayRule],
  ['activeEvent', nullableObjectRule],
  ['armyStance', enumRule(ARMY_STANCES, 'army stance')],
  ['avatar', ordinaryObjectRule],
  ['buildingGrid', denseArrayRule],
  ['buildings', denseArrayRule],
  ['camera', ordinaryObjectRule],
  ['caravans', denseArrayRule],
  ['chronicle', denseArrayRule],
  ['citizens', denseArrayRule],
  ['currentResearch', nullableObjectRule],
  ['day', positiveIntegerRule],
  ['dayLength', positiveIntegerRule],
  ['dayPhase', nonNegativeIntegerRule],
  ['deathMarkers', denseArrayRule],
  ['debug', ordinaryObjectRule],
  ['defense', nonNegativeIntegerRule],
  ['difficulty', enumRule(DIFFICULTIES, 'difficulty')],
  ['enemies', denseArrayRule],
  ['era', fieldRule(value => Number.isSafeInteger(value) && value >= 1 && value <= 3, 'Era must be an integer from 1 through 3.', 'out-of-range')],
  ['eraStartDay', ordinaryObjectRule],
  ['eventModifiers', ordinaryObjectRule],
  ['fog', denseArrayRule],
  ['gameTick', nonNegativeIntegerRule],
  ['happiness', fieldRule(value => isFiniteNumber(value) && value >= 0 && value <= 100, 'Happiness must be between 0 and 100.', 'out-of-range')],
  ['kingdomName', fieldRule(value => typeof value === 'string' && value.length >= 1 && value.length <= 20 && value.trim() === value, 'Kingdom name must be trimmed and contain 1 through 20 characters.')],
  ['lastDeathDay', nullableRule(positiveIntegerRule)],
  ['lastRaidDay', nullableRule(positiveIntegerRule)],
  ['lastUnderpopDay', nullableRule(positiveIntegerRule)],
  ['map', denseArrayRule],
  ['maxPop', nonNegativeIntegerRule],
  ['namedCharacters', ordinaryObjectRule],
  ['nextActorId', positiveIntegerRule],
  ['nextRaidDay', positiveIntegerRule],
  ['notificationLog', denseArrayRule],
  ['obstacleEpoch', nonNegativeIntegerRule],
  ['population', nonNegativeIntegerRule],
  ['projectiles', denseArrayRule],
  ['raidInterval', fieldRule(value => Number.isSafeInteger(value) && value >= 8 && value <= 10, 'Raid interval must be an integer from 8 through 10.', 'out-of-range')],
  ['rallyPoint', nullableObjectRule],
  ['realmEnded', booleanRule],
  ['researchedTechs', fieldRule(value => value instanceof Set, 'Expected a Set.')],
  ['resources', ordinaryObjectRule],
  ['scenario', enumRule(SCENARIOS, 'scenario')],
  ['season', enumRule(SEASONS, 'season')],
  ['soldiers', denseArrayRule],
  ['speed', enumRule(SPEEDS, 'simulation speed')],
  ['stats', ordinaryObjectRule],
  ['storyFlags', ordinaryObjectRule],
  ['storyState', ordinaryObjectRule],
  ['tileWear', nullableRule(denseArrayRule)],
  ['totalResourcesGathered', nonNegativeFiniteRule],
  ['walkers', denseArrayRule],
  ['weather', enumRule(WEATHER, 'weather')],
  ['won', booleanRule],
  ['wonder', nullableObjectRule],
]);

const CITIZEN_FIELD_VALIDATORS = new Map([
  ['actorId', positiveIntegerRule],
  ['identity', ordinaryObjectRule],
  ['profession', ordinaryObjectRule],
  ['assignment', nullableReferenceRule],
  ['activity', ordinaryObjectRule],
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['speed', nonNegativeFiniteRule], ['hp', finiteRule],
  ['carrying', nullableRule(enumRule(RESOURCE_KEY_SET, 'carried resource'))],
  ['carryAmount', nonNegativeFiniteRule],
  ['hunger', finiteRule], ['rest', finiteRule], ['needs', ordinaryObjectRule],
  ['home', nullableReferenceRule],
  ['activityTimer', finiteRule], ['path', nullableRule(pathArrayRule)], ['pathIdx', nonNegativeIntegerRule],
  ['faceX', finiteRule], ['faceZ', finiteRule],
  ['workTarget', nullableObjectRule], ['forageTarget', nullableObjectRule],
  ['_deliveryTarget', nullableReferenceRule], ['_evacRot', nonNegativeIntegerRule],
  ['_evacTarget', nullableObjectRule], ['_evacTicks', nonNegativeIntegerRule],
  ['_fleeing', booleanRule], ['_hb', nonNegativeIntegerRule],
  ['_lastPathX', finiteRule], ['_lastPathY', finiteRule], ['_leisureDay', positiveIntegerRule],
  ['_leisureTarget', nullableObjectRule], ['_needsDeliveryNoticeAt', nonNegativeIntegerRule],
  ['_noGo', ordinaryObjectRule], ['_pathEpoch', nonNegativeIntegerRule],
  ['_pathFailedAt', nonNegativeIntegerRule], ['_pathGoal', nullableObjectRule],
  ['_pathStartedAt', nullableRule(nonNegativeIntegerRule)],
  ['_requestedTx', finiteRule], ['_requestedTy', finiteRule],
  ['_stuckTicks', nonNegativeIntegerRule], ['_wdBest', nullableRule(nonNegativeFiniteRule)],
  ['_wdTicks', nonNegativeIntegerRule], ['_workFaceX', finiteRule], ['_workFaceZ', finiteRule],
]);

const BUILDING_FIELD_VALIDATORS = new Map([
  ['type', fieldRule(value => typeof value === 'string' && !!BUILDINGS[value], 'Unknown building type.', 'invalid-enum')],
  ['x', safeIntegerRule], ['y', safeIntegerRule], ['hp', finiteRule],
  ['active', booleanRule], ['prodTimer', finiteRule],
  ['produced', nullableObjectRule], ['prodShowCount', nonNegativeIntegerRule],
  ['level', positiveIntegerRule], ['buildProgress', finiteRule], ['buildTotal', nonNegativeFiniteRule],
  ['buildStartedAt', nonNegativeIntegerRule], ['_fireTimer', nonNegativeFiniteRule],
  ['caravanOut', booleanRule], ['completeTick', nonNegativeIntegerRule],
  ['fireTimer', finiteRule], ['onFire', booleanRule], ['tierStreak', safeIntegerRule],
  ['toolCycle', nonNegativeIntegerRule], ['trainTimer', nonNegativeFiniteRule],
  ['upgradeTick', nonNegativeIntegerRule], ['visits', ordinaryObjectRule],
]);

const AVATAR_FIELD_VALIDATORS = new Map([
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['vx', finiteRule], ['vy', finiteRule], ['path', nullableRule(pathArrayRule)],
  ['pathIdx', nonNegativeIntegerRule], ['speed', nonNegativeFiniteRule],
  ['name', boundedStringRule], ['state', fieldRule(value => value === 'idle', 'Unknown avatar state.', 'invalid-enum')],
  ['faceX', finiteRule], ['faceZ', finiteRule],
]);

const SOLDIER_FIELD_VALIDATORS = new Map([
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['homeBuilding', nullableReferenceRule], ['garrison', nullableReferenceRule],
  ['name', boundedStringRule], ['type', fieldRule(value => value === 'swordsman' || value === 'archer', 'Unknown soldier type.', 'invalid-enum')],
  ['hp', finiteRule], ['maxHp', nonNegativeFiniteRule],
  ['state', fieldRule(value => value === 'patrol', 'Unknown soldier state.', 'invalid-enum')],
  ['stateTimer', finiteRule], ['_postIdx', nonNegativeIntegerRule], ['attackTimer', finiteRule],
]);

const ENEMY_FIELD_VALIDATORS = new Map([
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['hp', finiteRule], ['maxHp', nonNegativeFiniteRule], ['damage', nonNegativeFiniteRule],
  ['plunderGoal', nonNegativeFiniteRule], ['type', fieldRule(value => value === 'raider', 'Unknown enemy type.', 'invalid-enum')],
  ['state', fieldRule(value => value === 'approach', 'Unknown enemy state.', 'invalid-enum')],
  ['variant', fieldRule(value => Number.isSafeInteger(value) && value >= 0 && value <= 2, 'Enemy variant must be 0, 1, or 2.', 'out-of-range')],
  ['attackTimer', finiteRule], ['engaged', nullableReferenceRule], ['loot', ordinaryObjectRule],
  ['plundered', nonNegativeFiniteRule], ['retreating', booleanRule],
]);

const PROJECTILE_FIELD_VALIDATORS = new Map([
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['target', ordinaryObjectRule], ['damage', nonNegativeFiniteRule], ['life', finiteRule],
  ['type', fieldRule(value => value === 'arrow', 'Unknown projectile type.', 'invalid-enum')],
]);

const WALKER_FIELD_VALIDATORS = new Map([
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['home', ordinaryObjectRule], ['color', boundedStringRule], ['emoji', boundedStringRule],
  ['life', finiteRule], ['visitedHouses', fieldRule(value => value instanceof Set, 'visitedHouses must be a Set.')],
  ['hauler', booleanRule], ['src', ordinaryObjectRule],
  ['leg', fieldRule(value => value === 'to-source' || value === 'to-site', 'Unknown walker leg.', 'invalid-enum')],
]);

const CARAVAN_FIELD_VALIDATORS = new Map([
  ['x', finiteRule], ['y', finiteRule], ['tx', finiteRule], ['ty', finiteRule],
  ['homeX', finiteRule], ['homeY', finiteRule],
  ['phase', fieldRule(value => value === 'outbound' || value === 'returning', 'Unknown caravan phase.', 'invalid-enum')],
  ['gold', nonNegativeFiniteRule], ['building', nullableReferenceRule], ['speed', nonNegativeFiniteRule],
]);

assertContractCoverage('root', ALLOWED_GAME_KEYS, ROOT_FIELD_VALIDATORS);
assertContractCoverage('citizen', CITIZEN_KEYS, CITIZEN_FIELD_VALIDATORS);
assertContractCoverage('building', BUILDING_KEYS, BUILDING_FIELD_VALIDATORS);
assertContractCoverage('avatar', AVATAR_KEYS, AVATAR_FIELD_VALIDATORS);
assertContractCoverage('soldier', SOLDIER_KEYS, SOLDIER_FIELD_VALIDATORS);
assertContractCoverage('enemy', ENEMY_KEYS, ENEMY_FIELD_VALIDATORS);
assertContractCoverage('projectile', PROJECTILE_KEYS, PROJECTILE_FIELD_VALIDATORS);
assertContractCoverage('walker', WALKER_KEYS, WALKER_FIELD_VALIDATORS);
assertContractCoverage('caravan', CARAVAN_KEYS, CARAVAN_FIELD_VALIDATORS);

function validateResourceRecord(value, path, { exact = false, nonNegative = true } = {}) {
  const surface = validateObjectSurface(value, RESOURCE_KEY_SET, exact ? RESOURCE_KEY_SET : new Set(), path);
  if (!surface.ok) return surface;
  for (const [key, amount] of Object.entries(value)) {
    if (!isFiniteNumber(amount)) return failure('non-finite-number', `${path}.${key}`, 'Resource amount must be finite.');
    if (nonNegative && amount < 0) return failure('out-of-range', `${path}.${key}`, 'Resource amount must not be negative.');
  }
  return { ok: true };
}

function validatePlunderRecord(value, path) {
  const surface = validateObjectSurface(value, PLUNDER_RESOURCE_KEYS, new Set(), path);
  if (!surface.ok) return surface;
  for (const [key, amount] of Object.entries(value)) {
    if (!Number.isSafeInteger(amount) || amount < 0) return failure('out-of-range', `${path}.${key}`, 'Plunder amounts must be non-negative safe integers.');
  }
  return { ok: true };
}

function validateExactPoint(value, path, optionalKeys = new Set()) {
  const allowed = new Set(['x', 'y', ...optionalKeys]);
  const surface = validateObjectSurface(value, allowed, new Set(['x', 'y']), path);
  if (!surface.ok) return surface;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return failure('non-finite-number', path, 'Point coordinates must be finite.');
  }
  return { ok: true };
}

function validateStoryFlags(value, path) {
  const object = ordinaryObjectRule(value, path);
  if (!object.ok) return object;
  for (const [key, flag] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key)) {
      return failure('unknown-field', `${path}.${key}`, 'Story flag names must use the current identifier form.');
    }
    const scalar = typeof flag === 'boolean' || isFiniteNumber(flag) || (typeof flag === 'string' && flag.length <= 160);
    if (!scalar) return failure('wrong-type', `${path}.${key}`, 'Story flags are flat boolean, finite-number, or bounded-string values.');
  }
  return { ok: true };
}

function validateStats(stats, path) {
  const keys = new Set(['buildingsBuilt', 'buildingsLost', 'raidsFaced', 'citizensBorn', 'citizensDied', 'raidsSurvived', 'enemiesKilled', 'goldEarned', 'daysLived', 'housesEvolved', 'scenariosWon', 'everHadBuilding']);
  const surface = validateObjectSurface(stats, keys, keys, path);
  if (!surface.ok) return surface;
  for (const key of ['buildingsBuilt', 'buildingsLost', 'raidsFaced', 'citizensBorn', 'citizensDied', 'raidsSurvived', 'enemiesKilled', 'goldEarned', 'daysLived', 'housesEvolved']) {
    if (!Number.isSafeInteger(stats[key]) || stats[key] < 0) return failure('out-of-range', `${path}.${key}`, 'Stats must be non-negative safe integers.');
  }
  const scenarios = validateDenseArray(stats.scenariosWon, `${path}.scenariosWon`, SCENARIOS.size);
  if (!scenarios.ok) return scenarios;
  const uniqueScenarios = new Set();
  for (let i = 0; i < stats.scenariosWon.length; i++) {
    const id = stats.scenariosWon[i];
    if (!SCENARIOS.has(id)) return failure('invalid-enum', `${path}.scenariosWon[${i}]`, 'Unknown completed scenario.');
    if (uniqueScenarios.has(id)) return failure('duplicate-reference', `${path}.scenariosWon[${i}]`, 'A scenario may only be recorded once.');
    uniqueScenarios.add(id);
  }
  const history = validateObjectSurface(stats.everHadBuilding, new Set(Object.keys(BUILDINGS)), new Set(), `${path}.everHadBuilding`);
  if (!history.ok) return history;
  for (const [type, seen] of Object.entries(stats.everHadBuilding)) {
    if (seen !== true) return failure('wrong-type', `${path}.everHadBuilding.${type}`, 'Building history contains only true membership flags.');
  }
  return { ok: true };
}

function validateChronicle(entries, path) {
  const array = validateDenseArray(entries, path, 10000);
  if (!array.ok) return array;
  const keys = new Set(['day', 'season', 'tick', 'text', 'tag']);
  for (let i = 0; i < entries.length; i++) {
    const entryPath = `${path}[${i}]`;
    const surface = validateObjectSurface(entries[i], keys, keys, entryPath);
    if (!surface.ok) return surface;
    if (!Number.isSafeInteger(entries[i].day) || entries[i].day < 1) return failure('out-of-range', `${entryPath}.day`, 'Chronicle day must be positive.');
    if (!SEASONS.has(entries[i].season)) return failure('invalid-enum', `${entryPath}.season`, 'Unknown chronicle season.');
    if (!Number.isSafeInteger(entries[i].tick) || entries[i].tick < 0) return failure('out-of-range', `${entryPath}.tick`, 'Chronicle tick must be non-negative.');
    if (typeof entries[i].text !== 'string' || entries[i].text.length === 0 || entries[i].text.length > 2000) return failure('wrong-type', `${entryPath}.text`, 'Chronicle text must be a bounded non-empty string.');
    if (!CHRONICLE_TAGS.has(entries[i].tag)) return failure('invalid-enum', `${entryPath}.tag`, 'Unknown chronicle tag.');
  }
  return { ok: true };
}

function validateNotificationLog(entries, path) {
  const array = validateDenseArray(entries, path, 50);
  if (!array.ok) return array;
  const entryKeys = new Set(['text', 'type', 'day', 'tick', 'meta']);
  const metaKeys = new Set(['chronicle', 'buildingIcon', 'resources']);
  for (let i = 0; i < entries.length; i++) {
    const entryPath = `${path}[${i}]`;
    const surface = validateObjectSurface(entries[i], entryKeys, entryKeys, entryPath);
    if (!surface.ok) return surface;
    if (typeof entries[i].text !== 'string' || entries[i].text.length === 0 || entries[i].text.length > 2000) return failure('wrong-type', `${entryPath}.text`, 'Notification text must be bounded and non-empty.');
    if (!NOTIFICATION_TYPES.has(entries[i].type)) return failure('invalid-enum', `${entryPath}.type`, 'Unknown notification type.');
    if (!Number.isSafeInteger(entries[i].day) || entries[i].day < 1) return failure('out-of-range', `${entryPath}.day`, 'Notification day must be positive.');
    if (!Number.isSafeInteger(entries[i].tick) || entries[i].tick < 0) return failure('out-of-range', `${entryPath}.tick`, 'Notification tick must be non-negative.');
    const metaSurface = validateObjectSurface(entries[i].meta, metaKeys, new Set(), `${entryPath}.meta`);
    if (!metaSurface.ok) return metaSurface;
    if (entries[i].meta.chronicle !== undefined && typeof entries[i].meta.chronicle !== 'boolean') return failure('wrong-type', `${entryPath}.meta.chronicle`, 'chronicle metadata must be boolean.');
    if (entries[i].meta.buildingIcon !== undefined && typeof entries[i].meta.buildingIcon !== 'string') return failure('wrong-type', `${entryPath}.meta.buildingIcon`, 'buildingIcon metadata must be a string.');
    if (entries[i].meta.resources !== undefined) {
      const resources = validateResourceRecord(entries[i].meta.resources, `${entryPath}.meta.resources`, { nonNegative: false });
      if (!resources.ok) return resources;
    }
  }
  return { ok: true };
}

function validateNamedCharacters(cast, path) {
  const surface = validateObjectSurface(cast, NAMED_CHARACTER_ROLES, new Set(), path);
  if (!surface.ok) return surface;
  for (const [role, character] of Object.entries(cast)) {
    const dayKey = role === 'mayor' ? 'appointedDay' : role === 'rival' ? 'noticedDay' : 'arrivedDay';
    const characterPath = `${path}.${role}`;
    const characterSurface = validateObjectSurface(character, new Set(['name', dayKey]), new Set(['name', dayKey]), characterPath);
    if (!characterSurface.ok) return characterSurface;
    if (typeof character.name !== 'string' || character.name.length === 0 || character.name.length > 160) return failure('wrong-type', `${characterPath}.name`, 'Named character name must be bounded and non-empty.');
    if (!Number.isSafeInteger(character[dayKey]) || character[dayKey] < 1) return failure('out-of-range', `${characterPath}.${dayKey}`, 'Named character day must be positive.');
  }
  return { ok: true };
}

function validateRootStructures(game) {
  if (game._lastDevolveNotice !== null && game._lastDevolveNotice > game.gameTick) return failure('out-of-range', '$.state.game._lastDevolveNotice', 'Devolve notice tick cannot be in the future.');
  for (const key of ['_lastRaidFireDay', 'lastDeathDay', 'lastRaidDay', 'lastUnderpopDay']) {
    if (game[key] !== null && game[key] > game.day) return failure('out-of-range', `$.state.game.${key}`, `${key} cannot be later than the current day.`);
  }
  if (game.armyStance === 'rally' && game.rallyPoint === null) return failure('inconsistent-state', '$.state.game.armyStance', 'Rally stance requires a rally point.');
  if (game._scenarioWon !== game.stats.scenariosWon.includes(game.scenario)) return failure('inconsistent-state', '$.state.game._scenarioWon', 'Scenario win flag must agree with the canonical scenario ledger.');

  const cameraSurface = validateObjectSurface(game.camera, new Set(['x', 'y', 'zoom']), new Set(['x', 'y', 'zoom']), '$.state.game.camera');
  if (!cameraSurface.ok) return cameraSurface;
  if (!isFiniteNumber(game.camera.x) || !isFiniteNumber(game.camera.y) || !isFiniteNumber(game.camera.zoom) || game.camera.zoom < 0.3 || game.camera.zoom > 3) {
    return failure('out-of-range', '$.state.game.camera', 'Camera x/y must be finite and zoom must be between 0.3 and 3.');
  }

  const resources = validateResourceRecord(game.resources, '$.state.game.resources', { exact: true });
  if (!resources.ok) return resources;
  const storyFlags = validateStoryFlags(game.storyFlags, '$.state.game.storyFlags');
  if (!storyFlags.ok) return storyFlags;
  const stats = validateStats(game.stats, '$.state.game.stats');
  if (!stats.ok) return stats;
  const chronicle = validateChronicle(game.chronicle, '$.state.game.chronicle');
  if (!chronicle.ok) return chronicle;
  const notifications = validateNotificationLog(game.notificationLog, '$.state.game.notificationLog');
  if (!notifications.ok) return notifications;
  const cast = validateNamedCharacters(game.namedCharacters, '$.state.game.namedCharacters');
  if (!cast.ok) return cast;

  const research = game.currentResearch;
  if (research !== null) {
    const surface = validateObjectSurface(research, new Set(['techId', 'progress', 'total']), new Set(['techId', 'progress', 'total']), '$.state.game.currentResearch');
    if (!surface.ok) return surface;
    const rule = TECH_RULES.get(research.techId);
    if (!rule || game.researchedTechs.has(research.techId)) return failure('invalid-enum', '$.state.game.currentResearch.techId', 'Current research must name an uncompleted current technology.');
    if (!isFiniteNumber(research.progress) || research.progress < 0 || research.total !== rule.time || research.progress >= research.total) return failure('out-of-range', '$.state.game.currentResearch', 'Research progress and total must match the current technology contract.');
    if (rule.era > game.era || (rule.prereq && !game.researchedTechs.has(rule.prereq))) return failure('inconsistent-state', '$.state.game.currentResearch.techId', 'Current research does not satisfy its era and prerequisite gates.');
  }
  for (const techId of game.researchedTechs) {
    const rule = TECH_RULES.get(techId);
    if (!rule) return failure('invalid-enum', '$.state.game.researchedTechs', 'Researched technology set contains an unknown id.');
    if (rule.prereq && !game.researchedTechs.has(rule.prereq)) return failure('inconsistent-state', '$.state.game.researchedTechs', `Researched ${techId} is missing prerequisite ${rule.prereq}.`);
  }

  if (game.activeEvent !== null) {
    const keys = new Set(['id', 'name', 'desc', 'color', 'positive', 'endDay']);
    const surface = validateObjectSurface(game.activeEvent, keys, keys, '$.state.game.activeEvent');
    if (!surface.ok) return surface;
    if (!EVENT_IDS.has(game.activeEvent.id)) return failure('invalid-enum', '$.state.game.activeEvent.id', 'Unknown active event.');
    for (const key of ['name', 'desc', 'color']) {
      if (typeof game.activeEvent[key] !== 'string' || game.activeEvent[key].length === 0 || game.activeEvent[key].length > 2000) return failure('wrong-type', `$.state.game.activeEvent.${key}`, 'Active-event text must be bounded and non-empty.');
    }
    if (typeof game.activeEvent.positive !== 'boolean') return failure('wrong-type', '$.state.game.activeEvent.positive', 'Active-event polarity must be boolean.');
    if (!Number.isSafeInteger(game.activeEvent.endDay) || game.activeEvent.endDay < game.day) return failure('out-of-range', '$.state.game.activeEvent.endDay', 'Active-event end day is invalid.');
  }

  if (game.rallyPoint !== null) {
    const point = validateExactPoint(game.rallyPoint, '$.state.game.rallyPoint');
    if (!point.ok) return point;
  }
  const eraKeys = new Set(['1', '2', '3']);
  const eraRequired = new Set(Array.from({ length: game.era }, (_, i) => String(i + 1)));
  const eraSurface = validateObjectSurface(game.eraStartDay, eraKeys, eraRequired, '$.state.game.eraStartDay');
  if (!eraSurface.ok) return eraSurface;
  let previousEraDay = 0;
  for (const [era, day] of Object.entries(game.eraStartDay)) {
    if (Number(era) > game.era || !Number.isSafeInteger(day) || day < 1 || day > game.day || day < previousEraDay) return failure('out-of-range', `$.state.game.eraStartDay.${era}`, 'Era start days must be contiguous, monotonic, and no later than the current day.');
    previousEraDay = day;
  }

  if (game.wonder !== null) {
    const keys = new Set(['stage', 'delivered', 'completeDay', 'placed']);
    const surface = validateObjectSurface(game.wonder, keys, keys, '$.state.game.wonder');
    if (!surface.ok) return surface;
    if (!Number.isSafeInteger(game.wonder.stage) || game.wonder.stage < 0 || game.wonder.stage > 3) return failure('out-of-range', '$.state.game.wonder.stage', 'Wonder stage must be 0 through 3.');
    const bill = WONDER_BILLS[game.wonder.stage];
    const deliveredSurface = validateObjectSurface(game.wonder.delivered, new Set(Object.keys(bill)), new Set(), '$.state.game.wonder.delivered');
    if (!deliveredSurface.ok) return deliveredSurface;
    for (const [resource, amount] of Object.entries(game.wonder.delivered)) {
      if (!isFiniteNumber(amount) || amount < 0 || amount > bill[resource]) return failure('out-of-range', `$.state.game.wonder.delivered.${resource}`, 'Wonder delivery is outside the current stage bill.');
    }
    if (game.wonder.completeDay !== null && (!Number.isSafeInteger(game.wonder.completeDay) || game.wonder.completeDay < 1 || game.wonder.completeDay > game.day)) return failure('out-of-range', '$.state.game.wonder.completeDay', 'Wonder completion day is invalid.');
    if (typeof game.wonder.placed !== 'boolean') return failure('wrong-type', '$.state.game.wonder.placed', 'Wonder placement must be boolean.');
    if ((game.wonder.stage === 3) !== (game.wonder.completeDay !== null)) return failure('inconsistent-state', '$.state.game.wonder', 'Completed wonder stage and completion day must agree.');
  }
  if (game.won !== (game.wonder?.stage === 3)) return failure('inconsistent-state', '$.state.game.won', 'Realm win flag must agree with completed wonder state.');

  if (game._raidStolen !== undefined && game._raidStolen !== null) {
    const stolen = validatePlunderRecord(game._raidStolen, '$.state.game._raidStolen');
    if (!stolen.ok) return stolen;
  }
  const deathMarkers = validateDenseArray(game.deathMarkers, '$.state.game.deathMarkers', 40);
  if (!deathMarkers.ok) return deathMarkers;
  const markerKeys = new Set(['x', 'y', 'name', 'day', 'cause']);
  for (let i = 0; i < game.deathMarkers.length; i++) {
    const marker = game.deathMarkers[i];
    const path = `$.state.game.deathMarkers[${i}]`;
    const surface = validateObjectSurface(marker, markerKeys, markerKeys, path);
    if (!surface.ok) return surface;
    if (!isFiniteNumber(marker.x) || !isFiniteNumber(marker.y)) return failure('non-finite-number', path, 'Death-marker position must be finite.');
    if (typeof marker.name !== 'string' || marker.name.length === 0 || marker.name.length > 160) return failure('wrong-type', `${path}.name`, 'Death-marker name must be bounded and non-empty.');
    if (!Number.isSafeInteger(marker.day) || marker.day < 1 || marker.day > game.day) return failure('out-of-range', `${path}.day`, 'Death-marker day is invalid.');
    if (!DEATH_CAUSES.has(marker.cause)) return failure('invalid-enum', `${path}.cause`, 'Unknown death-marker cause.');
  }

  return { ok: true };
}

function validateCitizenNestedState(citizen, path) {
  const identitySurface = validateObjectSurface(
    citizen.identity,
    new Set(['name', 'appearanceId']),
    new Set(['name', 'appearanceId']),
    `${path}.identity`,
  );
  if (!identitySurface.ok) return identitySurface;
  if (
    typeof citizen.identity.name !== 'string'
    || citizen.identity.name !== citizen.identity.name.trim()
    || citizen.identity.name.length < 1
    || citizen.identity.name.length > 80
  ) {
    return failure('wrong-type', `${path}.identity.name`, 'Citizen identity name must be a trimmed 1–80 character string.');
  }
  if (!CITIZEN_APPEARANCE_ID_SET.has(citizen.identity.appearanceId)) {
    return failure('invalid-enum', `${path}.identity.appearanceId`, 'Citizen appearanceId must name current actor art.');
  }

  const professionSurface = validateObjectSurface(
    citizen.profession,
    new Set(['kind', 'sinceTick', 'reason']),
    new Set(['kind', 'sinceTick', 'reason']),
    `${path}.profession`,
  );
  if (!professionSurface.ok) return professionSurface;
  if (!CITIZEN_PROFESSION_SET.has(citizen.profession.kind)) return failure('invalid-enum', `${path}.profession.kind`, 'Unknown citizen profession.');
  if (!CITIZEN_PROFESSION_REASON_SET.has(citizen.profession.reason)) return failure('invalid-enum', `${path}.profession.reason`, 'Unknown citizen profession reason.');
  const expectedProfessionReason = citizen.profession.kind === 'settler'
    ? 'spawn-settler'
    : 'first-vocation';
  if (citizen.profession.reason !== expectedProfessionReason) return failure('inconsistent-state', `${path}.profession.reason`, 'Citizen profession and establishment reason disagree.');
  if (!Number.isSafeInteger(citizen.profession.sinceTick) || citizen.profession.sinceTick < 0) return failure('out-of-range', `${path}.profession.sinceTick`, 'Profession tick must be non-negative.');

  const activitySurface = validateObjectSurface(
    citizen.activity,
    new Set(['kind', 'sinceTick', 'reason']),
    new Set(['kind', 'sinceTick', 'reason']),
    `${path}.activity`,
  );
  if (!activitySurface.ok) return activitySurface;
  if (!CITIZEN_STATES.has(citizen.activity.kind)) return failure('invalid-enum', `${path}.activity.kind`, 'Unknown citizen activity.');
  if (!CITIZEN_ACTIVITY_REASON_SET.has(citizen.activity.reason)) return failure('invalid-enum', `${path}.activity.reason`, 'Unknown citizen activity reason.');
  if (!Number.isSafeInteger(citizen.activity.sinceTick) || citizen.activity.sinceTick < 0) return failure('out-of-range', `${path}.activity.sinceTick`, 'Activity tick must be non-negative.');

  if (citizen.assignment !== null) {
    const assignmentSurface = validateObjectSurface(
      citizen.assignment,
      new Set(['kind', 'building', 'duty', 'purpose', 'sinceTick', 'reason']),
      new Set(['kind', 'building', 'duty', 'purpose', 'sinceTick', 'reason']),
      `${path}.assignment`,
    );
    if (!assignmentSurface.ok) return assignmentSurface;
    if (citizen.assignment.kind !== 'work') return failure('invalid-enum', `${path}.assignment.kind`, 'Unknown citizen assignment kind.');
    if (!isObject(citizen.assignment.building)) return failure('wrong-type', `${path}.assignment.building`, 'Assignment building must be a graph reference.');
    if (typeof citizen.assignment.duty !== 'string' || citizen.assignment.duty.length < 1 || citizen.assignment.duty.length > 40) return failure('wrong-type', `${path}.assignment.duty`, 'Assignment duty must be bounded.');
    if (!['vocation', 'temporary'].includes(citizen.assignment.purpose)) return failure('invalid-enum', `${path}.assignment.purpose`, 'Unknown assignment purpose.');
    if (!CITIZEN_ASSIGNMENT_REASON_SET.has(citizen.assignment.reason)) return failure('invalid-enum', `${path}.assignment.reason`, 'Unknown assignment reason.');
    if (!Number.isSafeInteger(citizen.assignment.sinceTick) || citizen.assignment.sinceTick < 0) return failure('out-of-range', `${path}.assignment.sinceTick`, 'Assignment tick must be non-negative.');
  }

  const needsSurface = validateObjectSurface(citizen.needs, new Set(['joy', 'faith']), new Set(['joy', 'faith']), `${path}.needs`);
  if (!needsSurface.ok) return needsSurface;
  for (const key of ['joy', 'faith']) {
    if (!isFiniteNumber(citizen.needs[key]) || citizen.needs[key] < 0 || citizen.needs[key] > 100) return failure('out-of-range', `${path}.needs.${key}`, 'Citizen needs must be between 0 and 100.');
  }
  if (citizen.workTarget !== undefined && citizen.workTarget !== null) {
    const surface = validateObjectSurface(citizen.workTarget, new Set(['x', 'y', 'resource']), new Set(['x', 'y']), `${path}.workTarget`);
    if (!surface.ok) return surface;
    const point = validateExactPoint(citizen.workTarget, `${path}.workTarget`, new Set(['resource']));
    if (!point.ok) return point;
    if (citizen.workTarget.resource !== undefined && (!Number.isSafeInteger(citizen.workTarget.resource) || citizen.workTarget.resource < TILE.WATER || citizen.workTarget.resource > TILE.MOUNTAIN)) return failure('invalid-enum', `${path}.workTarget.resource`, 'Unknown work-target resource tile.');
  }
  if (citizen.forageTarget !== undefined && citizen.forageTarget !== null) {
    const surface = validateObjectSurface(citizen.forageTarget, new Set(['x', 'y', 'tile']), new Set(['x', 'y', 'tile']), `${path}.forageTarget`);
    if (!surface.ok) return surface;
    const point = validateExactPoint(citizen.forageTarget, `${path}.forageTarget`, new Set(['tile']));
    if (!point.ok) return point;
    if (!Number.isSafeInteger(citizen.forageTarget.tile) || citizen.forageTarget.tile < TILE.WATER || citizen.forageTarget.tile > TILE.MOUNTAIN) return failure('invalid-enum', `${path}.forageTarget.tile`, 'Unknown forage tile.');
  }
  for (const key of ['_evacTarget', '_pathGoal']) {
    if (citizen[key] === undefined || citizen[key] === null) continue;
    const extras = key === '_pathGoal' ? new Set(['score']) : new Set();
    const point = validateExactPoint(citizen[key], `${path}.${key}`, extras);
    if (!point.ok) return point;
    if (citizen[key].score !== undefined && !isFiniteNumber(citizen[key].score)) return failure('non-finite-number', `${path}.${key}.score`, 'Path score must be finite.');
  }
  if (citizen._leisureTarget !== undefined && citizen._leisureTarget !== null) {
    const targetPath = `${path}._leisureTarget`;
    const surface = validateObjectSurface(citizen._leisureTarget, new Set(['x', 'y', 'kind']), new Set(['x', 'y', 'kind']), targetPath);
    if (!surface.ok) return surface;
    if (!isFiniteNumber(citizen._leisureTarget.x) || !isFiniteNumber(citizen._leisureTarget.y) || !BUILDINGS[citizen._leisureTarget.kind]) return failure('invalid-enum', targetPath, 'Leisure target must contain a finite position and current building kind.');
  }
  if (citizen._noGo !== undefined) {
    for (const [coordinate, tick] of Object.entries(citizen._noGo)) {
      if (!/^-?\d+,-?\d+$/.test(coordinate)) return failure('unknown-field', `${path}._noGo.${coordinate}`, 'No-go keys must be integer coordinate pairs.');
      if (!Number.isSafeInteger(tick) || tick < 0) return failure('out-of-range', `${path}._noGo.${coordinate}`, 'No-go timestamps must be non-negative ticks.');
    }
  }
  return { ok: true };
}

function validateBuildingNestedState(building, path) {
  if (building.produced !== null) {
    const produced = validateResourceRecord(building.produced, `${path}.produced`);
    if (!produced.ok) return produced;
  }
  if (building.visits !== undefined) {
    const visitSurface = validateObjectSurface(building.visits, new Set(['church', 'tavern', 'well', 'market', 'wonder']), new Set(), `${path}.visits`);
    if (!visitSurface.ok) return visitSurface;
    for (const [kind, tick] of Object.entries(building.visits)) {
      if (!Number.isSafeInteger(tick) || tick < 0) return failure('out-of-range', `${path}.visits.${kind}`, 'Visit timestamps must be non-negative ticks.');
    }
  }
  return { ok: true };
}

function validateCandidateGame(game) {
  const rootSurface = validateObjectSurface(game, ALLOWED_GAME_KEYS, REQUIRED_GAME_KEYS, '$.state.game');
  if (!rootSurface.ok) return rootSurface;
  const rootFields = validateFieldContract(game, ROOT_FIELD_VALIDATORS, '$.state.game');
  if (!rootFields.ok) return rootFields;
  const rootStructures = validateRootStructures(game);
  if (!rootStructures.ok) return rootStructures;

  const map = validateGrid(game.map, '$.state.game.map', value => (
    Number.isInteger(value) && value >= TILE.WATER && value <= TILE.MOUNTAIN
      ? null
      : { code: 'invalid-tile', message: 'Map tile is outside the runtime tile enum.' }
  ));
  if (!map.ok) return map;
  const fog = validateGrid(game.fog, '$.state.game.fog', value => (
    typeof value === 'boolean' ? null : { code: 'wrong-type', message: 'Fog cells must be boolean.' }
  ));
  if (!fog.ok) return fog;

  const requiredArrays = ['buildings', 'citizens', 'soldiers', 'enemies', 'projectiles', 'walkers', 'caravans'];
  for (const key of requiredArrays) {
    if (!Array.isArray(game[key])) return failure('wrong-type', `$.state.game.${key}`, `${key} must be an array.`);
  }
  if (game.population !== game.citizens.length) {
    return failure('inconsistent-count', '$.state.game.population', 'population must exactly equal the current citizen collection length.');
  }
  const resourcesSurface = validateObjectSurface(game.resources, RESOURCE_KEY_SET, RESOURCE_KEY_SET, '$.state.game.resources');
  if (!resourcesSurface.ok) return resourcesSurface;
  for (const [key, value] of Object.entries(game.resources)) {
    if (!isFiniteNumber(value)) return failure('non-finite-number', `$.state.game.resources.${key}`, 'Resource values must be finite.');
  }
  if (!Number.isSafeInteger(game.gameTick) || game.gameTick < 0) return failure('wrong-type', '$.state.game.gameTick', 'gameTick must be a non-negative safe integer.');
  if (!Number.isSafeInteger(game.day) || game.day < 1) return failure('wrong-type', '$.state.game.day', 'day must be a positive safe integer.');
  if (!Number.isSafeInteger(game.dayLength) || game.dayLength < 1) return failure('wrong-type', '$.state.game.dayLength', 'dayLength must be a positive safe integer.');
  if (!isFiniteNumber(game.dayPhase) || game.dayPhase < 0 || game.dayPhase >= game.dayLength) return failure('out-of-range', '$.state.game.dayPhase', 'dayPhase must be within the current day.');
  if (!SEASONS.has(game.season)) return failure('invalid-enum', '$.state.game.season', 'Unknown season.');
  if (!DIFFICULTIES.has(game.difficulty)) return failure('invalid-enum', '$.state.game.difficulty', 'Unknown difficulty.');
  if (!ARMY_STANCES.has(game.armyStance)) return failure('invalid-enum', '$.state.game.armyStance', 'Unknown army stance.');
  if (game.avatar !== null && !isObject(game.avatar)) return failure('wrong-type', '$.state.game.avatar', 'Avatar must be null or an object.');
  if (game.avatar) {
    const avatarSurface = validateObjectSurface(game.avatar, AVATAR_KEYS, REQUIRED_AVATAR_KEYS, '$.state.game.avatar');
    if (!avatarSurface.ok) return avatarSurface;
    const avatarFields = validateFieldContract(game.avatar, AVATAR_FIELD_VALIDATORS, '$.state.game.avatar');
    if (!avatarFields.ok) return avatarFields;
    const avatarNumbers = validateFiniteFields(game.avatar, ['x', 'y', 'tx', 'ty', 'vx', 'vy', 'speed', 'faceX', 'faceZ'], '$.state.game.avatar');
    if (!avatarNumbers.ok) return avatarNumbers;
    const avatarPath = validatePath(game.avatar.path, game.avatar.pathIdx, '$.state.game.avatar');
    if (!avatarPath.ok) return avatarPath;
  }
  if (!(game.researchedTechs instanceof Set)) return failure('wrong-type', '$.state.game.researchedTechs', 'researchedTechs must be a Set.');
  if (!isObject(game.debug) || Object.keys(game.debug).length !== 1 || typeof game.debug.disableEvents !== 'boolean') {
    return failure('wrong-type', '$.state.game.debug', 'Debug state must contain only the deterministic disableEvents flag.');
  }
  const storyStateKeys = new Set(['lastProverbSeason', 'raid']);
  const storyStateSurface = validateObjectSurface(game.storyState, storyStateKeys, storyStateKeys, '$.state.game.storyState');
  if (!storyStateSurface.ok) return storyStateSurface;
  if (game.storyState.lastProverbSeason !== null && !SEASONS.has(game.storyState.lastProverbSeason)) {
    return failure('invalid-enum', '$.state.game.storyState.lastProverbSeason', 'Story proverb season must be null or a current season.');
  }
  if (game.storyState.raid !== null) {
    const raidKeys = new Set(['day', 'killsStart', 'deathsStart']);
    const raidSurface = validateObjectSurface(game.storyState.raid, raidKeys, raidKeys, '$.state.game.storyState.raid');
    if (!raidSurface.ok) return raidSurface;
    for (const key of raidKeys) {
      if (!Number.isSafeInteger(game.storyState.raid[key]) || game.storyState.raid[key] < 0) {
        return failure('out-of-range', `$.state.game.storyState.raid.${key}`, 'Raid narrative counters must be non-negative safe integers.');
      }
    }
  }
  const modifierKeys = new Set(['foodProd', 'goldProd', 'happinessOffset', 'speedMult']);
  const modifierSurface = validateObjectSurface(game.eventModifiers, modifierKeys, modifierKeys, '$.state.game.eventModifiers');
  if (!modifierSurface.ok) return modifierSurface;
  for (const [key, value] of Object.entries(game.eventModifiers)) {
    if (!isFiniteNumber(value)) return failure('non-finite-number', `$.state.game.eventModifiers.${key}`, 'Event modifiers must be finite.');
  }
  const modifierDomains = {
    foodProd: new Set([0.5, 1, 2]),
    goldProd: new Set([1, 1.5]),
    happinessOffset: new Set([0, 15, 20]),
    speedMult: new Set([0.7, 1]),
  };
  for (const [key, values] of Object.entries(modifierDomains)) {
    if (!values.has(game.eventModifiers[key])) return failure('invalid-enum', `$.state.game.eventModifiers.${key}`, 'Event modifier is outside its current domain.');
  }
  const statsKeys = new Set(['buildingsBuilt', 'buildingsLost', 'raidsFaced', 'citizensBorn', 'citizensDied', 'raidsSurvived', 'enemiesKilled', 'goldEarned', 'daysLived', 'housesEvolved', 'scenariosWon', 'everHadBuilding']);
  const statsSurface = validateObjectSurface(game.stats, statsKeys, statsKeys, '$.state.game.stats');
  if (!statsSurface.ok) return statsSurface;
  for (const key of ['buildingsBuilt', 'buildingsLost', 'raidsFaced', 'citizensBorn', 'citizensDied', 'raidsSurvived', 'enemiesKilled', 'goldEarned', 'daysLived', 'housesEvolved']) {
    if (!isFiniteNumber(game.stats[key])) return failure('non-finite-number', `$.state.game.stats.${key}`, 'Stats must be finite.');
  }
  if (!Array.isArray(game.stats.scenariosWon) || !isObject(game.stats.everHadBuilding)) return failure('wrong-type', '$.state.game.stats', 'Stats collections have the wrong type.');

  const buildings = new Set(game.buildings);
  const citizens = new Set(game.citizens);
  const soldiers = new Set(game.soldiers);
  const enemies = new Set(game.enemies);
  for (const [name, values, identities] of [
    ['buildings', game.buildings, buildings], ['citizens', game.citizens, citizens],
    ['soldiers', game.soldiers, soldiers], ['enemies', game.enemies, enemies],
    ['projectiles', game.projectiles, new Set(game.projectiles)],
    ['walkers', game.walkers, new Set(game.walkers)], ['caravans', game.caravans, new Set(game.caravans)],
  ]) {
    if (identities.size !== values.length) return failure('duplicate-reference', `$.state.game.${name}`, `${name} contains duplicate entity references.`);
  }

  const occupied = new Map();
  const assignmentCounts = new Map();
  const actorIds = new Set();
  let maxActorId = 0;
  for (let i = 0; i < game.buildings.length; i++) {
    const building = game.buildings[i];
    const path = `$.state.game.buildings[${i}]`;
    const buildingSurface = validateObjectSurface(building, BUILDING_KEYS, REQUIRED_BUILDING_KEYS, path);
    if (!buildingSurface.ok) return buildingSurface;
    const buildingFields = validateFieldContract(building, BUILDING_FIELD_VALIDATORS, path);
    if (!buildingFields.ok) return buildingFields;
    const buildingNested = validateBuildingNestedState(building, path);
    if (!buildingNested.ok) return buildingNested;
    if (!BUILDINGS[building.type]) return failure('invalid-enum', `${path}.type`, 'Unknown building type.');
    const buildingNumbers = validateFiniteFields(
      building,
      ['hp', 'prodTimer', 'prodShowCount', 'level', 'buildProgress', 'buildTotal', 'buildStartedAt'],
      path,
    );
    if (!buildingNumbers.ok) return buildingNumbers;
    if (!Number.isSafeInteger(building.level) || building.level < 1) {
      return failure('out-of-range', `${path}.level`, 'Building level must be a positive safe integer.');
    }
    if (building.active !== true) return failure('inconsistent-state', `${path}.active`, 'Only active buildings belong to the live building collection.');
    if (building.prodTimer < 0) return failure('out-of-range', `${path}.prodTimer`, 'Building production timer must not be negative.');
    if (building.buildProgress < 0 || building.buildProgress > 1) {
      return failure('out-of-range', `${path}.buildProgress`, 'Building progress must be between 0 and 1.');
    }
    if (building.buildTotal <= 0) {
      return failure('out-of-range', `${path}.buildTotal`, 'Building construction duration must be positive.');
    }
    if (!Number.isSafeInteger(building.buildStartedAt) || building.buildStartedAt < 0) {
      return failure('out-of-range', `${path}.buildStartedAt`, 'Building construction start must be a non-negative safe integer.');
    }
    if (!Number.isInteger(building.x) || building.x < 0 || building.x >= MAP_W || !Number.isInteger(building.y) || building.y < 0 || building.y >= MAP_H) {
      return failure('out-of-range', path, 'Building coordinates must be integer map positions.');
    }
    const tileKey = `${building.x},${building.y}`;
    if (occupied.has(tileKey)) return failure('duplicate-reference', path, 'Two buildings occupy the same tile.');
    occupied.set(tileKey, building);
  }

  for (let i = 0; i < game.citizens.length; i++) {
    const citizen = game.citizens[i];
    const path = `$.state.game.citizens[${i}]`;
    const citizenSurface = validateObjectSurface(citizen, CITIZEN_KEYS, REQUIRED_CITIZEN_KEYS, path);
    if (!citizenSurface.ok) return citizenSurface;
    const citizenFields = validateFieldContract(citizen, CITIZEN_FIELD_VALIDATORS, path);
    if (!citizenFields.ok) return citizenFields;
    const citizenNested = validateCitizenNestedState(citizen, path);
    if (!citizenNested.ok) return citizenNested;
    for (const key of ['x', 'y', 'tx', 'ty', 'speed', 'hunger', 'rest', 'activityTimer']) {
      if (!isFiniteNumber(citizen[key])) return failure('non-finite-number', `${path}.${key}`, `Citizen ${key} must be finite.`);
    }
    if (actorIds.has(citizen.actorId)) return failure('duplicate-reference', `${path}.actorId`, 'Citizen actor IDs must be unique.');
    actorIds.add(citizen.actorId);
    maxActorId = Math.max(maxActorId, citizen.actorId);
    if (citizen.hp !== undefined && !isFiniteNumber(citizen.hp)) {
      return failure('non-finite-number', `${path}.hp`, 'Citizen hp must be finite when present.');
    }
    if (citizen.home !== null && !buildings.has(citizen.home)) return failure('invalid-reference', `${path}.home`, 'Home must reference a current building.');
    if (citizen._deliveryTarget !== null && citizen._deliveryTarget !== undefined && !buildings.has(citizen._deliveryTarget)) return failure('invalid-reference', `${path}._deliveryTarget`, 'Delivery target must reference a current building.');
    if (citizen.profession.sinceTick > game.gameTick) return failure('out-of-range', `${path}.profession.sinceTick`, 'Profession transition cannot be in the future.');
    if (citizen.activity.sinceTick > game.gameTick) return failure('out-of-range', `${path}.activity.sinceTick`, 'Activity transition cannot be in the future.');
    if (citizen.assignment) {
      const building = citizen.assignment.building;
      if (!buildings.has(building)) return failure('invalid-reference', `${path}.assignment.building`, 'Assignment must reference a live building.');
      if (citizen.assignment.sinceTick > game.gameTick) return failure('out-of-range', `${path}.assignment.sinceTick`, 'Assignment transition cannot be in the future.');
      const constructing = building.buildProgress < 1;
      const expectedDuty = constructing ? 'construction' : building.type;
      if (citizen.assignment.duty !== expectedDuty) return failure('inconsistent-state', `${path}.assignment.duty`, 'Assignment duty disagrees with building state.');
      const expectedPurpose = assignmentPurposeForProfession(citizen.profession.kind, building);
      if (citizen.assignment.purpose !== expectedPurpose) return failure('inconsistent-state', `${path}.assignment.purpose`, 'Assignment purpose disagrees with citizen profession and building state.');
      const count = (assignmentCounts.get(building) || 0) + 1;
      const capacity = citizenStaffingCapacity(building);
      if (capacity < 1) return failure('invalid-reference', `${path}.assignment.building`, 'Assignment building has no citizen staffing capacity.');
      if (count > capacity) return failure('out-of-range', `${path}.assignment`, 'Derived building staffing exceeds capacity.');
      assignmentCounts.set(building, count);
    }
    if (typeof citizen.needs?.joy !== 'number' || typeof citizen.needs?.faith !== 'number' || Object.keys(citizen.needs || {}).length !== 2) {
      return failure('wrong-type', `${path}.needs`, 'Citizen needs must contain finite joy and faith values.');
    }
    if (!isFiniteNumber(citizen.needs.joy) || !isFiniteNumber(citizen.needs.faith)) return failure('non-finite-number', `${path}.needs`, 'Citizen needs must be finite.');
    if (citizen.hunger < 0 || citizen.hunger > 100 || citizen.rest < 0 || citizen.rest > 100) return failure('out-of-range', path, 'Citizen hunger and rest must be between 0 and 100.');
    if ((citizen.carrying === null) !== (citizen.carryAmount === 0)) return failure('inconsistent-state', `${path}.carrying`, 'Citizen cargo kind and amount must agree.');
    if (citizen.home && (citizen.home.type !== 'house' || citizen.home.buildProgress < 1)) return failure('invalid-reference', `${path}.home`, 'Citizen home must reference a completed house.');
    for (const key of ['faceX', 'faceZ', '_workFaceX', '_workFaceZ']) {
      if (citizen[key] !== undefined && ![-1, 0, 1].includes(citizen[key])) return failure('out-of-range', `${path}.${key}`, 'Facing components must be -1, 0, or 1.');
    }
    const citizenPath = validatePath(citizen.path, citizen.pathIdx, path);
    if (!citizenPath.ok) return citizenPath;
  }
  if (game.nextActorId <= maxActorId) {
    return failure('out-of-range', '$.state.game.nextActorId', 'Citizen allocator must remain above every live actor ID.');
  }

  const grid = validateGrid(game.buildingGrid, '$.state.game.buildingGrid', (value, x, y) => {
    if (value === null) return occupied.has(`${x},${y}`)
      ? { code: 'invalid-reference', message: 'Building grid omits an occupied tile.' }
      : null;
    if (!buildings.has(value)) return { code: 'invalid-reference', message: 'Grid cell must reference a current building.' };
    if (value.x !== x || value.y !== y) return { code: 'invalid-reference', message: 'Grid reference does not match building coordinates.' };
    return null;
  });
  if (!grid.ok) return grid;

  const buildingRefFields = [
    ['soldiers', 'homeBuilding'], ['soldiers', 'garrison'], ['caravans', 'building'],
    ['walkers', 'home'], ['walkers', 'src'],
  ];
  for (const [collectionName, field] of buildingRefFields) {
    const collection = game[collectionName];
    for (let i = 0; i < collection.length; i++) {
      const value = collection[i]?.[field];
      if (value !== null && value !== undefined && !buildings.has(value)) {
        return failure('invalid-reference', `$.state.game.${collectionName}[${i}].${field}`, `${field} must reference a current building.`);
      }
    }
  }

  for (let i = 0; i < game.soldiers.length; i++) {
    const soldier = game.soldiers[i];
    const path = `$.state.game.soldiers[${i}]`;
    const surface = validateObjectSurface(soldier, SOLDIER_KEYS, REQUIRED_SOLDIER_KEYS, path);
    if (!surface.ok) return surface;
    const fields = validateFieldContract(soldier, SOLDIER_FIELD_VALIDATORS, path);
    if (!fields.ok) return fields;
    const numbers = validateFiniteFields(soldier, ['x', 'y', 'tx', 'ty', 'hp', 'maxHp', 'stateTimer'], path);
    if (!numbers.ok) return numbers;
    if (!['swordsman', 'archer'].includes(soldier.type) || soldier.state !== 'patrol') return failure('invalid-enum', path, 'Unknown soldier type or state.');
    if (soldier.maxHp <= 0 || soldier.hp > soldier.maxHp) return failure('out-of-range', `${path}.hp`, 'Soldier hp must not exceed a positive maximum.');
  }
  for (let i = 0; i < game.enemies.length; i++) {
    const enemy = game.enemies[i];
    const path = `$.state.game.enemies[${i}]`;
    const surface = validateObjectSurface(enemy, ENEMY_KEYS, REQUIRED_ENEMY_KEYS, path);
    if (!surface.ok) return surface;
    const fields = validateFieldContract(enemy, ENEMY_FIELD_VALIDATORS, path);
    if (!fields.ok) return fields;
    const numbers = validateFiniteFields(enemy, ['x', 'y', 'tx', 'ty', 'hp', 'maxHp', 'damage', 'plunderGoal', 'variant'], path);
    if (!numbers.ok) return numbers;
    if (enemy.type !== 'raider' || enemy.state !== 'approach' || !Number.isInteger(enemy.variant) || enemy.variant < 0 || enemy.variant > 2) return failure('invalid-enum', path, 'Unknown enemy type, state, or variant.');
    if (enemy.maxHp <= 0 || enemy.damage <= 0 || enemy.plunderGoal <= 0 || enemy.hp > enemy.maxHp) return failure('out-of-range', path, 'Enemy combat values are outside the current contract.');
    if (enemy.loot !== undefined) {
      const loot = validatePlunderRecord(enemy.loot, `${path}.loot`);
      if (!loot.ok) return loot;
    }
  }
  for (let i = 0; i < game.projectiles.length; i++) {
    const projectile = game.projectiles[i];
    const path = `$.state.game.projectiles[${i}]`;
    const surface = validateObjectSurface(projectile, PROJECTILE_KEYS, REQUIRED_PROJECTILE_KEYS, path);
    if (!surface.ok) return surface;
    const fields = validateFieldContract(projectile, PROJECTILE_FIELD_VALIDATORS, path);
    if (!fields.ok) return fields;
    const numbers = validateFiniteFields(projectile, ['x', 'y', 'tx', 'ty', 'damage', 'life'], path);
    if (!numbers.ok) return numbers;
    if (projectile.type !== 'arrow' || !isObject(projectile.target)) return failure('invalid-enum', path, 'Projectile must be an arrow with an object target.');
    if (projectile.damage <= 0 || projectile.life < 0) return failure('out-of-range', path, 'Projectile damage must be positive and life non-negative.');
    if (!enemies.has(projectile.target)) {
      const snapshotKeys = new Set(['x', 'y', 'hp']);
      const targetPath = `${path}.target`;
      const snapshot = validateObjectSurface(projectile.target, snapshotKeys, snapshotKeys, targetPath);
      if (!snapshot.ok) return snapshot;
      const targetNumbers = validateFiniteFields(projectile.target, ['x', 'y', 'hp'], targetPath);
      if (!targetNumbers.ok) return targetNumbers;
    }
  }
  for (let i = 0; i < game.walkers.length; i++) {
    const walker = game.walkers[i];
    const path = `$.state.game.walkers[${i}]`;
    const surface = validateObjectSurface(walker, WALKER_KEYS, REQUIRED_WALKER_KEYS, path);
    if (!surface.ok) return surface;
    const fields = validateFieldContract(walker, WALKER_FIELD_VALIDATORS, path);
    if (!fields.ok) return fields;
    const numbers = validateFiniteFields(walker, ['x', 'y', 'tx', 'ty', 'life'], path);
    if (!numbers.ok) return numbers;
    if (walker.life <= 0) return failure('out-of-range', `${path}.life`, 'Walker life must be positive while retained.');
    if (walker.hauler !== undefined) {
      if (walker.hauler !== true || !walker.src || !walker.leg) return failure('inconsistent-state', path, 'Hauler walkers require true, a source, and a route leg.');
    } else if (walker.src !== undefined || walker.leg !== undefined) {
      return failure('inconsistent-state', path, 'Ordinary walkers cannot retain hauler-only fields.');
    }
  }
  for (let i = 0; i < game.caravans.length; i++) {
    const caravan = game.caravans[i];
    const path = `$.state.game.caravans[${i}]`;
    const surface = validateObjectSurface(caravan, CARAVAN_KEYS, REQUIRED_CARAVAN_KEYS, path);
    if (!surface.ok) return surface;
    const fields = validateFieldContract(caravan, CARAVAN_FIELD_VALIDATORS, path);
    if (!fields.ok) return fields;
    const numbers = validateFiniteFields(caravan, ['x', 'y', 'tx', 'ty', 'homeX', 'homeY', 'gold', 'speed'], path);
    if (!numbers.ok) return numbers;
    if (!['outbound', 'returning'].includes(caravan.phase)) return failure('invalid-enum', `${path}.phase`, 'Unknown caravan phase.');
  }
  for (let i = 0; i < game.walkers.length; i++) {
    const visited = game.walkers[i]?.visitedHouses;
    if (visited !== undefined && !(visited instanceof Set)) return failure('wrong-type', `$.state.game.walkers[${i}].visitedHouses`, 'visitedHouses must be a Set.');
    if (visited) {
      for (const house of visited) {
        if (!buildings.has(house)) return failure('invalid-reference', `$.state.game.walkers[${i}].visitedHouses`, 'Visited houses must reference current buildings.');
      }
    }
  }
  if (game._patrolPosts !== null && game._patrolPosts !== undefined) {
    if (!Array.isArray(game._patrolPosts)) return failure('wrong-type', '$.state.game._patrolPosts', 'Patrol posts must be null or an array.');
    for (let i = 0; i < game._patrolPosts.length; i++) {
      if (!buildings.has(game._patrolPosts[i])) return failure('invalid-reference', `$.state.game._patrolPosts[${i}]`, 'Patrol posts must reference current buildings.');
    }
  }
  for (let i = 0; i < game.enemies.length; i++) {
    const engaged = game.enemies[i]?.engaged;
    if (engaged !== null && engaged !== undefined && !soldiers.has(engaged)) return failure('invalid-reference', `$.state.game.enemies[${i}].engaged`, 'Enemy engagement must reference a current soldier.');
  }
  if (Array.isArray(game._undoStack)) {
    const undoSurface = validateDenseArray(game._undoStack, '$.state.game._undoStack', 10);
    if (!undoSurface.ok) return undoSurface;
    for (let i = 0; i < game._undoStack.length; i++) {
      const entry = game._undoStack[i];
      const path = `$.state.game._undoStack[${i}]`;
      const keys = new Set(['b', 'flagsSnapshot', 'chronicleLen']);
      const surface = validateObjectSurface(entry, keys, keys, path);
      if (!surface.ok) return surface;
      if (!buildings.has(entry.b)) return failure('invalid-reference', `${path}.b`, 'Undo entries must reference current buildings.');
      if (!isObject(entry.flagsSnapshot)) return failure('wrong-type', `${path}.flagsSnapshot`, 'Undo story flags must be an object.');
      const flags = validateStoryFlags(entry.flagsSnapshot, `${path}.flagsSnapshot`);
      if (!flags.ok) return flags;
      if (!Number.isSafeInteger(entry.chronicleLen) || entry.chronicleLen < 0 || entry.chronicleLen > game.chronicle.length) return failure('out-of-range', `${path}.chronicleLen`, 'Undo chronicle length is invalid.');
    }
  }

  if (game.tileWear !== null && game.tileWear !== undefined) {
    if (!Array.isArray(game.tileWear) || game.tileWear.length !== MAP_H) return failure('invalid-dimensions', '$.state.game.tileWear', `Expected ${MAP_H} tile-wear rows.`);
    for (let y = 0; y < MAP_H; y++) {
      const row = game.tileWear[y];
      if (!(row instanceof Uint8Array) || row.length !== MAP_W) return failure('invalid-dimensions', `$.state.game.tileWear[${y}]`, `Expected a ${MAP_W}-cell Uint8Array.`);
    }
  }
  return { ok: true };
}

function captureGameRoot() {
  const root = {};
  for (const key of Object.keys(G)) {
    if (!PROCESS_LOCAL_G_KEYS.has(key) && !RESET_ON_LOAD_G_KEY_SET.has(key)) root[key] = G[key];
  }
  // Debug methods/perf counters are process-local, but disableEvents is read
  // by the deterministic event system and therefore belongs to the save.
  root.debug = { disableEvents: !!G.debug?.disableEvents };
  return root;
}

function captureMissions() {
  return missions.map(mission => ({
    id: mission.id,
    done: mission.done,
    celebratedTick: Number.isSafeInteger(mission._celebratedTick) ? mission._celebratedTick : null,
  }));
}

export function serializeGame({ savedAt = 0 } = {}) {
  if (!Number.isSafeInteger(savedAt) || savedAt < 0 || Object.is(savedAt, -0)) throw new TypeError('savedAt must be a non-negative safe integer without negative zero');
  const entityKinds = new WeakMap();
  for (const [kind, values] of [
    ['citizen', G.citizens], ['soldier', G.soldiers], ['enemy', G.enemies],
    ['walker', G.walkers], ['caravan', G.caravans],
  ]) {
    for (const value of values || []) {
      if (value && typeof value === 'object') entityKinds.set(value, kind);
    }
  }
  if (G.avatar && typeof G.avatar === 'object') entityKinds.set(G.avatar, 'avatar');
  const state = encodeGraphState(captureGameRoot(), getSeed(), captureMissions(), {
    includeProperty(owner, key) {
      const kind = entityKinds.get(owner);
      return !kind || !RESETTABLE_PRESENTATION_ENTITY_FIELDS[kind].includes(key);
    },
  });
  const envelope = makeEnvelope(state, savedAt);
  // Validate the decoded detached graph, not merely its envelope, so the
  // writer can never persist a save that its own loader would reject.
  const prepared = prepareSave(envelope);
  if (!prepared.ok) throw new TypeError(`${prepared.error.path}: ${prepared.error.message}`);
  return envelope;
}

export function prepareSave(raw) {
  const validated = validateSave(raw);
  if (!validated.ok) return validated;
  const envelope = validated.value;
  let game;
  try {
    game = decodeGraphState(envelope.state);
  } catch (error) {
    return failure('decode-failed', '$.state', error instanceof Error ? error.message : String(error));
  }

  const gameValid = validateCandidateGame(game);
  if (!gameValid.ok) return gameValid;

  const currentIds = missions.map(mission => mission.id);
  const savedIds = envelope.state.roots.missions.map(mission => mission.id);
  if (savedIds.length !== currentIds.length || currentIds.some((id, i) => savedIds[i] !== id)) {
    return failure('invalid-reference', '$.state.roots.missions', 'Mission state must exactly match the current mission catalog.');
  }

  const internal = {
    game,
    gameEntries: Object.entries(game),
    resetEntries: Object.entries(createResetOnLoadState()),
    rngSeed: envelope.state.roots.rngSeed,
    missions: envelope.state.roots.missions.map(mission => ({ ...mission })),
    savedAt: envelope.savedAt,
  };
  const candidate = Object.freeze({ savedAt: envelope.savedAt });
  PREPARED.set(candidate, internal);
  return { ok: true, value: candidate };
}

export function inspectPreparedSave(candidate) {
  const internal = candidate && PREPARED.get(candidate);
  if (!internal) return null;
  const game = internal.game;
  return {
    kingdomName: game.kingdomName,
    day: game.day,
    population: game.population,
    scenariosWon: [...game.stats.scenariosWon],
    savedAt: internal.savedAt,
  };
}

function commitPreparedGame(candidate, failAfterAssignments = null) {
  const prepared = candidate && PREPARED.get(candidate);
  if (!prepared) {
    return failure('unprepared-candidate', '$', 'Only a successfully prepared save candidate can be committed.');
  }
  PREPARED.delete(candidate); // prepared candidates are opaque and single-use

  // Snapshot live references before the first mutation. Construction and all
  // validation are already complete; the commit itself performs only deletes,
  // assignments, Set-free mission flag writes, and a primitive RNG write.
  const oldEntries = Object.entries(G);
  const oldKeys = new Set(oldEntries.map(([key]) => key));
  const processLocal = new Map([...PROCESS_LOCAL_G_KEYS].filter(key => oldKeys.has(key)).map(key => [key, G[key]]));
  const processDebug = G.debug && typeof G.debug === 'object' ? G.debug : null;
  const oldSeed = getSeed();
  const oldMissions = missions.map(mission => ({
    done: mission.done,
    hasCelebratedTick: Object.prototype.hasOwnProperty.call(mission, '_celebratedTick'),
    celebratedTick: mission._celebratedTick,
  }));
  const oldDebugFlag = processDebug ? {
    had: Object.prototype.hasOwnProperty.call(processDebug, 'disableEvents'),
    value: processDebug.disableEvents,
  } : null;
  let assignments = 0;
  const assign = (key, value) => {
    G[key] = value;
    assignments++;
    if (failAfterAssignments !== null && assignments >= failAfterAssignments) {
      throw new Error(`Injected commit failure after ${assignments} assignments`);
    }
  };

  try {
    for (const key of Object.keys(G)) {
      if (!PROCESS_LOCAL_G_KEYS.has(key)) delete G[key];
    }
    for (const [key, value] of prepared.gameEntries) assign(key, value);
    for (const [key, value] of prepared.resetEntries) assign(key, value);
    for (const [key, value] of processLocal) assign(key, value);
    if (processDebug) {
      processDebug.disableEvents = !!prepared.game.debug?.disableEvents;
      G.debug = processDebug;
    }
    setSeed(prepared.rngSeed);
    for (let i = 0; i < missions.length; i++) {
      missions[i].done = prepared.missions[i].done;
      if (prepared.missions[i].celebratedTick === null) delete missions[i]._celebratedTick;
      else missions[i]._celebratedTick = prepared.missions[i].celebratedTick;
    }
    return { ok: true, value: { savedAt: prepared.savedAt } };
  } catch (error) {
    // G is a normal extensible object, so this is only an emergency guard. It
    // keeps the public commit non-throwing and restores exact pre-commit refs.
    try {
      for (const key of Object.keys(G)) delete G[key];
      for (const [key, value] of oldEntries) G[key] = value;
      setSeed(oldSeed);
      for (let i = 0; i < missions.length; i++) {
        missions[i].done = oldMissions[i].done;
        if (oldMissions[i].hasCelebratedTick) missions[i]._celebratedTick = oldMissions[i].celebratedTick;
        else delete missions[i]._celebratedTick;
      }
      if (processDebug && oldDebugFlag) {
        if (oldDebugFlag.had) processDebug.disableEvents = oldDebugFlag.value;
        else delete processDebug.disableEvents;
      }
    } catch (_rollbackError) {}
    return failure('commit-failed', '$', error instanceof Error ? error.message : String(error));
  }
}

export function commitGameLoad(candidate) {
  return commitPreparedGame(candidate);
}

// Focused fault-injection surface for the atomicity gate. Production callers
// use commitGameLoad(); this export exists so a mid-commit assignment failure
// is proven to restore G, RNG, missions, and debug state exactly.
export function commitGameLoadForTest(candidate, failAfterAssignments) {
  if (!Number.isSafeInteger(failAfterAssignments) || failAfterAssignments < 1) {
    throw new TypeError('failAfterAssignments must be a positive safe integer');
  }
  return commitPreparedGame(candidate, failAfterAssignments);
}
