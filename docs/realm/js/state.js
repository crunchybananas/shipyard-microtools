// ════════════════════════════════════════════════════════════
// Shared game state — imported by all modules
// ════════════════════════════════════════════════════════════

export const TILE = { WATER:0, SAND:1, GRASS:2, FOREST:3, STONE:4, IRON:5, MOUNTAIN:6 };
export const TW = 64, TH = 32;
export const MAP_W = 80, MAP_H = 80;
export const RESOURCE_KEYS = Object.freeze([
  'wood', 'stone', 'food', 'gold', 'iron', 'wheat', 'flour', 'planks', 'tools',
]);

export function createResourceStock(overrides = {}) {
  const stock = Object.fromEntries(RESOURCE_KEYS.map(key => [key, 0]));
  for (const [key, value] of Object.entries(overrides)) {
    if (!RESOURCE_KEYS.includes(key)) throw new TypeError(`Unknown resource key: ${key}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Invalid ${key} resource value`);
    stock[key] = value;
  }
  return stock;
}

// Loop 45 (render S4): tightened the per-tile two-color alternation so
// the checkerboard pulse is less visible. Deltas were 8-16pt which read
// as a visible iso-diamond grid overlaid on every field. Now ≤4pt —
// same base tone with a subtle darker cousin.
export const TILE_COLORS = {
  [TILE.WATER]:   ['#1d5f96','#1a5688'],
  [TILE.SAND]:    ['#c6a466','#b99758'],
  [TILE.GRASS]:   ['#408042','#3b7840'],
  [TILE.FOREST]:  ['#285a34','#244f2f'],
  [TILE.STONE]:   ['#85817c','#79756f'],
  [TILE.IRON]:    ['#496f8f','#41657f'],
  [TILE.MOUNTAIN]:['#5f6068','#565760'],
};

export const BUILDINGS = {
  house:     { name:'House',       icon:'🏠', cost:{wood:15,stone:5},  pop:4, foodStore:8, desc:'Shelters settlers, holds 8 pantry food, and pays taxes. Evolves Hovel → Manor with well, market, church, and tavern coverage.' },
  farm:      { name:'Farm',        icon:'🌾', cost:{wood:10},          prod:{food:1,wheat:3}, workers:1, desc:'Harvests one direct ration plus bulk wheat for milling into much more bread',
    upgrades: [
      { cost:{wood:15,stone:8},          prodMult:1.5, name:'Level 2' },
      { cost:{wood:25,stone:20,iron:5},  prodMult:2.0, name:'Level 3' },
    ] },
  lumber:    { name:'Lumber Mill',  icon:'🪓', cost:{wood:5,stone:10}, prod:{wood:3}, workers:1, on:[TILE.FOREST], desc:'Harvests wood from forest',
    upgrades: [
      { cost:{wood:8,stone:15},          prodMult:1.5, name:'Level 2' },
      { cost:{wood:15,stone:25,iron:5},  prodMult:2.0, name:'Level 3' },
    ] },
  sawmill:   { name:'Sawmill',     icon:'🪚', cost:{wood:20,stone:12}, workers:1, convert:{from:'wood',to:'planks',amount:3,cap:40}, desc:'Cuts stored wood into planks for advanced construction' },
  quarry:    { name:'Quarry',      icon:'⛏️', cost:{wood:10},          prod:{stone:2}, workers:1, on:[TILE.STONE], desc:'Extracts stone',
    upgrades: [
      { cost:{wood:15,stone:10},         prodMult:1.5, name:'Level 2' },
      { cost:{wood:25,stone:20,iron:5},  prodMult:2.0, name:'Level 3' },
    ] },
  mine:      { name:'Iron Mine',   icon:'🏭', cost:{wood:15,stone:15}, prod:{iron:1}, workers:2, on:[TILE.IRON], desc:'Mines iron ore',
    upgrades: [
      { cost:{wood:22,stone:22,iron:3},  prodMult:1.5, name:'Level 2' },
      { cost:{wood:38,stone:38,iron:8},  prodMult:2.0, name:'Level 3' },
    ] },
  market:    { name:'Market',      icon:'🏪', cost:{wood:20,stone:15}, prod:{gold:2}, radius:5, workers:1, desc:'Generates gold from trade',
    upgrades: [
      { cost:{wood:30,stone:22,gold:10}, prodMult:1.5, name:'Level 2' },
      { cost:{wood:50,stone:38,gold:25,iron:5}, prodMult:2.0, name:'Level 3' },
    ] },
  barracks:  { name:'Barracks',    icon:'⚔️', cost:{wood:20,stone:20,iron:5,planks:10}, defense:10, workers:2, desc:'A staffed drill yard where you can muster swordsmen' },
  tower:     { name:'Watch Tower', icon:'🗼', cost:{stone:25,iron:5,planks:8},  defense:15, reveal:4, desc:'Reveals fog and defends' },
  well:      { name:'Well',        icon:'🪣', cost:{stone:10},         happiness:5,  radius:4, desc:'Provides water, boosts happiness' },
  tavern:    { name:'Tavern',      icon:'🍺', cost:{wood:20,gold:10},  happiness:10, radius:5, workers:1, desc:'Entertainment, big happiness boost' },
  wall:      { name:'Wall',        icon:'🧱', cost:{stone:8},          defense:5, desc:'Fortification segment' },
  road:      { name:'Road',        icon:'🛤️', cost:{stone:3},          speedBonus:true, desc:'Citizens move faster on roads' },
  tradingpost:{ name:'Trading Post',icon:'⛵', cost:{wood:20,stone:15}, workers:1, on:[1], desc:'Sends caravans for gold (build on sand)' },
  castle:    { name:'Castle',      icon:'🏰', cost:{stone:80,wood:60,iron:30,gold:50,planks:20}, defense:50, happiness:20, pop:10, desc:'The realm\'s mightiest defense — and the Wonder\'s foundation stone' },
  wonder:    { name:'Hall of Ages', icon:'🕍', cost:{stone:50,planks:20,gold:40}, workers:4, happiness:10, radius:8, maxCount:1, desc:'The Wonder. Raise all three stages to win the age' },
  granary:   { name:'Granary',     icon:'🏺', cost:{wood:20,stone:10}, foodStore:30, desc:'Stores +30 food reserves, halves winter food loss' },
  storehouse:{ name:'Storehouse',  icon:'📦', cost:{wood:18,stone:8},  storage:true, foodStore:40, desc:'Receives delivered goods and holds up to 40 food' },
  church:    { name:'Church',      icon:'⛪', cost:{stone:30,gold:15,planks:8}, happiness:15, radius:6, desc:'Major happiness boost for your settlement' },
  school:    { name:'School',      icon:'📚', cost:{wood:15,stone:15,gold:10}, researchSpeed:0.5, workers:1, desc:'Speeds up research by 50%' },
  windmill:  { name:'Windmill',    icon:'🌬️', cost:{wood:25,stone:10}, workers:1, convert:{from:'wheat',to:'flour',amount:4}, desc:'Mills wheat into flour for the bakery' },
  bakery:    { name:'Bakery',      icon:'🍞', cost:{wood:20,stone:15}, workers:1, convert:{from:'flour',to:'food',amount:3,yield:2}, happiness:5, desc:'Bakes flour into bread — two food per flour. Small happiness boost.' },
  chickencoop: { name:'Chicken Coop', icon:'🐔', cost:{wood:15}, prod:{food:1}, workers:1, desc:'Small chicken coop producing eggs and meat' },
  cowpen:    { name:'Cow Pen',     icon:'🐄', cost:{wood:25,stone:5}, prod:{food:2}, workers:1, desc:'Pastures cattle for milk and meat' },
  fisherman: { name:"Fisherman's Hut", icon:'🐟', cost:{wood:15}, prod:{food:3}, workers:1, on:[TILE.SAND], desc:'Catches fish from nearby waters. Must be on sand adjacent to water.' },
  blacksmith: { name:'Blacksmith', icon:'🔨', cost:{wood:20,stone:15}, workers:1, convert:{from:'iron',to:'tools',amount:2,cap:20}, desc:'Forges iron into tools that speed production. Boosts soldier damage by 50%.', boost:{type:'soldier',radius:8,multiplier:1.5} },
  archery:   { name:'Archery Range', icon:'🏹', cost:{wood:30,stone:10}, workers:1, defense:5, desc:'A staffed range where you can muster archers with longer reach' },
  // Loop 243 (the-fixer, 101 filed ~140 ticks): mayor structural-unlock.
  // Town Hall — civic governance building gated on a named mayor (set by
  // tavern-build per 034 hook). Closes the named-character cast filing arc
  // (101/102/105+153/201/206/209/243). Effect: realm-wide happiness +8
  // radius 6 + pop +5 — civic governance brings stability + housing
  // capacity. Cost mirrors mid-tier civic buildings (church 30 stone +
  // 15 gold; townhall is stone-heavier as governance is durable).
  // Loop 255: townhall art shipped (Phase E — 12-of-12 roster).
  // Loop 258 (the-fixer, 256 MEDIUM finding): maxCount:1 — townhall is a
  // ONE-SHOT structural unlock per realm. Narrative-coherence rationale:
  // 244 BUILDING_FIRST_BEATS + 253 mayor_first_in_hall both presume a
  // SINGULAR town hall ("the long window," "the long table"); multiple
  // townhalls break the named-character-gate framing. Real-world towns
  // also have one civic seat. First use of the maxCount schema field;
  // tech.js isBuildingUnlocked enforces it generically.
  townhall:  { name:'Town Hall',   icon:'🏛️', cost:{stone:40,wood:30,gold:20,planks:12}, happiness:8, radius:6, pop:5, maxCount:1, desc:'Civic governance — boosts realm happiness + housing. Requires a named mayor. One per realm.' },
};

// ── Mutable game state (single source of truth) ───────────
export const G = {
  map: [],
  fog: [],
  buildings: [],
  citizens: [],
  nextActorId: 1,
  soldiers: [],
  buildingGrid: [],    // MAP_H x MAP_W, null or building ref
  avatar: null,
  particles: [],
  animals: [],
  enemies: [],
  projectiles: [],
  chronicle: [],
  storyFlags: {},
  namedCharacters: {},
  deathMarkers: [],
  debug: { disableEvents: false },
  resources: createResourceStock({ wood:60, stone:30, food:80, gold:25 }),
  population: 3,
  maxPop: 3,
  happiness: 50,
  defense: 0,
  day: 1,
  dayPhase: 0,
  dayLength: 3600, // ~60 seconds per day at 1x speed — deliberate pacing
  gameTick: 0,
  speed: 1,
  obstacleEpoch: 0,
  totalResourcesGathered: 0,
  // Loop 035 (the-fixer, closing 003/011/018 photo-mode cluster):
  // when true, HUD / build-bar / mission panel / minimap / pause-overlay
  // are hidden so the player can compose a clean screenshot. Toggled by
  // H key via togglePhotoMode in main.js.
  photoMode: false,
  camera: { x: 0, y: (MAP_W/2 + MAP_H/2) * TH/2, zoom: 1.3 },
  selectedBuild: null,
  selectedBuilding: null,
  selectedCitizenId: null,
  hoveredTile: null,
  dragging: false,
  dragStart: {x:0,y:0},
  camStart: {x:0,y:0},
  nextRaidDay: 8,
  raidInterval: 8,
  lastRaidDay: null,
  lastDeathDay: null,
  lastUnderpopDay: null,
  realmEnded: false,
  audioCtx: null,
  researchedTechs: new Set(['agriculture', 'forestry']),
  currentResearch: null,
  caravans: [],
  walkers: [],
  raidFlash: 0,
  activeEvent: null,
  eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
  weather: 'clear',
  season: 'spring',
  rallyPoint: null,
  armyStance: 'defend', // defend | rally | patrol — the army is a posture, not units to drive
  won: false,
  era: 1,                   // The Three Ages (tech.js ERAS): 1 Hearth · 2 Charter · 3 Crown
  eraStartDay: { 1: 1 },    // era id -> G.day it began
  wonder: null,             // { placed, stage 0-3, delivered:{res:n}, completeDay } — survives demolish (wonder.js)
  clouds: null,
  cameraShake: 0,
  tileWear: null,  // 2D array [MAP_H][MAP_W] of 0-255 wear values, lazy-init
  difficulty: 'normal', // easy, normal, hard
  scenario: 'peaceful_start', // selected scenario id
  kingdomName: 'Realm',
  resourceRates: { wood:0, stone:0, food:0, gold:0, iron:0, wheat:0, flour:0, planks:0, tools:0 },
  notificationLog: [], // { text, type:'info'|'danger'|'event'|'mission', day }
  storyState: { lastProverbSeason: null, raid: null },
  _dailyFoodConsumed: 0,
  _lastDevolveNotice: null,
  _lastRaidFireDay: null,
  _milestone10: false,
  _milestone25: false,
  _milestone50: false,
  _milestone75: false,
  _moodDelta: 0,
  _patrolEmptyNotified: false,
  _patrolPosts: null,
  _patrolPostsBuildingCount: -1,
  _raidSide: null,
  _raidSpawnCount: 0,
  _raidStolen: null,
  _raidWarningGiven: false,
  _scenarioWon: false,
  _undoStack: [],
  lastResources: null, // snapshot for rate calculation
  stats: {
    buildingsBuilt: 0,
    buildingsLost: 0,
    raidsFaced: 0,
    citizensBorn: 0,
    citizensDied: 0,
    raidsSurvived: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    daysLived: 0,
    housesEvolved: 0,
    scenariosWon: [],
    // Loop 311 (310 [code] filing): track whether each building type
    // was EVER placed in this realm. Used by narrative gates that should
    // fire if the realm has experience of a structure even after it is
    // destroyed (silent_morning_known carries practice independent of
    // current church). Distinct from G.buildings.some() check which
    // requires the building to currently exist.
    everHadBuilding: {},
  },
};

// Shell-owned state is deliberately absent from Engine v2 saves. These values
// are frame/input/ambient queues: they can be rebuilt without changing the
// deterministic realm and must never make a save large, stale, or schedule-
// dependent. Add new presentation state here at the same time it is introduced.
const RESETTABLE_PRESENTATION_ROOT_KEYS = Object.freeze([
  '_buildRipples', '_churchBeam', '_confetti', '_followAvatar', '_hoveredBiome',
  '_lastPaintTile', '_lastPlaceFailMsg', '_lightningFlash', '_lightningTimer', '_placingRally',
  '_lastFoodWarnDay', '_lastSaveTick', '_refreshPanelFor', '_renderAlpha',
  '_renderDeltaMs',
  'acorns', 'animals', 'bats', 'bigSnow', 'birds', 'boats', 'bolts',
  'bunnies', 'camStart', 'cameraShake', 'carts', 'clouds', 'crabs', 'dragStart',
  'dragging', 'dustDevils', 'eagles', 'fishJumps', 'flocks', 'footprints', 'frogs',
  'hawks', 'hoveredBiome', 'hoveredTile', 'meteors', 'mouseX', 'mouseY', 'owls',
  'lastResources', 'particles', 'photoMode', 'pigeons', 'raidFlash', 'raidSmoke',
  'rams', 'resourceRates',
  'researchSparkles', 'schoolKids', 'selectedBuild', 'selectedBuilding',
  'selectedCitizenId', 'snowmen', 'tradeShips', 'volcanoSmoke', 'wolves',
]);

const RESETTABLE_PRESENTATION_ENTITY_KEYS = Object.freeze({
  citizen: Object.freeze([
    '_px', '_py', '_movedAt', 'hurtTimer',
  ]),
  avatar: Object.freeze([
    '_px', '_py', '_laneX', '_laneY', '_dirKey', '_dirPend', '_dirPendMs',
    '_actorAnimationKey', '_actorAnimationStartedAt', '_movedAt',
  ]),
  soldier: Object.freeze([
    '_px', '_py', '_pdx', '_pdy', '_mvx', '_mvy', '_movedAt',
    '_actorAnimationKey', '_actorAnimationStartedAt',
  ]),
  enemy: Object.freeze(['_px', '_py', 'attackCue']),
  walker: Object.freeze(['_px', '_py', '_actorAnimationKey', '_actorAnimationStartedAt']),
  caravan: Object.freeze(['_px', '_py']),
});

export const STATE_OWNERSHIP = Object.freeze({
  processLocalRoot: Object.freeze(['audioCtx']),
  resettablePresentationRoot: RESETTABLE_PRESENTATION_ROOT_KEYS,
  // These are deliberately saved for player experience/history but cannot
  // influence deterministic simulation outcomes.
  durableNonAuthoritativeRoot: Object.freeze(['camera', 'deathMarkers', 'tileWear', 'notificationLog']),
  replayProvenanceRoot: Object.freeze(['_commandLog']),
  resettablePresentationEntity: RESETTABLE_PRESENTATION_ENTITY_KEYS,
});

export const RESETTABLE_PRESENTATION_ENTITY_FIELDS = STATE_OWNERSHIP.resettablePresentationEntity;
export const RESET_ON_LOAD_G_KEYS = Object.freeze([
  ...STATE_OWNERSHIP.resettablePresentationRoot,
  ...STATE_OWNERSHIP.replayProvenanceRoot,
]);
export const AUTHORITATIVE_SIMULATION_EXCLUDED_G_KEYS = Object.freeze([
  ...STATE_OWNERSHIP.processLocalRoot,
  ...STATE_OWNERSHIP.resettablePresentationRoot,
  ...STATE_OWNERSHIP.durableNonAuthoritativeRoot,
  ...STATE_OWNERSHIP.replayProvenanceRoot,
]);

function createPresentationState() {
  return {
    _buildRipples: [],
    _churchBeam: 0,
    _confetti: [],
    _followAvatar: false,
    _placingRally: false,
    _hoveredBiome: null,
    _lastPaintTile: null,
    _lastPlaceFailMsg: 0,
    _lastFoodWarnDay: 0,
    _lastSaveTick: 0,
    _lightningFlash: 0,
    _lightningTimer: null,
    _refreshPanelFor: null,
    _renderAlpha: 1,
    _renderDeltaMs: 1000 / 60,
    acorns: [],
    animals: [],
    bats: [],
    bigSnow: [],
    birds: [],
    boats: [],
    bolts: [],
    bunnies: [],
    camStart: { x: 0, y: 0 },
    cameraShake: 0,
    carts: [],
    clouds: null,
    crabs: [],
    dragStart: { x: 0, y: 0 },
    dragging: false,
    dustDevils: [],
    eagles: [],
    fishJumps: [],
    flocks: [],
    footprints: [],
    frogs: [],
    hawks: [],
    hoveredBiome: null,
    hoveredTile: null,
    lastResources: null,
    meteors: [],
    mouseX: 0,
    mouseY: 0,
    owls: [],
    particles: [],
    photoMode: false,
    pigeons: [],
    raidFlash: 0,
    raidSmoke: [],
    rams: [],
    resourceRates: createResourceStock(),
    researchSparkles: [],
    schoolKids: [],
    selectedBuild: null,
    selectedBuilding: null,
    selectedCitizenId: null,
    snowmen: [],
    tradeShips: [],
    volcanoSmoke: [],
    wolves: [],
  };
}

export function createResetOnLoadState() {
  return { ...createPresentationState(), _commandLog: [] };
}

export function resetRuntimeTransientState(target = G, prepared = createResetOnLoadState()) {
  Object.assign(target, prepared);
  return target;
}

// ── Seeded RNG ─────────────────────────────────────────────
let _seed = 1; // fixed default — every entry point calls setSeed (ENGINE.md rule 2)
export function rng() { _seed=(_seed*1103515245+12345)&0x7fffffff; return _seed/0x7fffffff; }
export function rngRange(a,b) { return a + rng()*(b-a); }
export function rngInt(a,b) { return Math.floor(rngRange(a,b+1)); }
export function getSeed() { return _seed; }
export function setSeed(s) { _seed = s; }

// ── Names ──────────────────────────────────────────────────
const FIRST = ['Ada','Bjorn','Celia','Dag','Elsa','Finn','Greta','Hans','Inga','Jon','Kara','Lars','Mia','Nils','Olga','Per','Quinn','Runa','Sven','Thea','Ulf','Vera','Wren','Xander','Yara','Zev'];
const LAST = ['Stone','Brook','Field','Hill','Dale','Wood','Lake','Ridge','Vale','Forge','Thorn','Frost','Marsh','Glen','Pike','Ash','Birch','Elm','Oak','Pine'];
export function randomName() { return FIRST[rngInt(0,FIRST.length-1)]+' '+LAST[rngInt(0,LAST.length-1)]; }

// Housing evolution ladder (index = b.level - 1). A house's b.level is its
// TIER — never add def.upgrades to the house def, the paid-upgrade path
// would fight the evolution simulation for the same field.
// Invariant: HOUSE_TIERS[0].cap === BUILDINGS.house.pop.
export const HOUSE_TIERS = [
  { name: 'Hovel',     cap: 4,  taxMult: 0.8, reqs: {} },
  { name: 'Cottage',   cap: 6,  taxMult: 1.0, reqs: { services: ['well'], food: true } },
  { name: 'Homestead', cap: 8,  taxMult: 1.4, reqs: { services: ['well', 'market'], anyOf: ['church', 'tavern'], food: true }, evolveCost: { planks: 2 } },
  { name: 'Manor',     cap: 10, taxMult: 2.0, reqs: { services: ['well', 'market', 'church', 'tavern'], food: true, foodVariety: 2 }, evolveCost: { planks: 2, tools: 1 } },
];

export function resourceEmoji(k) { return {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️',wheat:'🌾',flour:'🫓',planks:'🪚',tools:'🛠️'}[k]||k; }

export const DIFFICULTY = {
  easy:   { label:'🟢 Easy',   foodMult:0.6, raidMult:0.5 },
  normal: { label:'🟡 Normal', foodMult:1.0, raidMult:1.0 },
  hard:   { label:'🔴 Hard',   foodMult:1.5, raidMult:1.5 },
};

export function getDifficulty() { return DIFFICULTY[G.difficulty] || DIFFICULTY.normal; }

// ── Seasons ────────────────────────────────────────────────
// Loop 047 (the-fixer, 045's HIGH finding): added per-season
// `skyShift`. 045 pixel-sampled midday sky across all 4 seasons
// and found them identical within ±1/channel — the sky palette
// at render.js:118-121 hardcoded dayTop/dayBot without consulting
// SEASONS, so only the ground carried a seasonal signal. skyShift
// is applied to dayTop/dayBot only (not dawn/dusk) so the 012
// hue-variation thread stays intact. Magnitude ≤ 15/channel per
// 045 calibration.
export const SEASONS = {
  spring: { name:'🌱 Spring', foodMult:1.2, speedMult:1.0, tileShift:[0,12,0],    skyShift:[  0,  5,  5], label:'Spring' },
  summer: { name:'☀️ Summer', foodMult:1.5, speedMult:1.1, tileShift:[8,5,-5],    skyShift:[ 10,  5, -8], label:'Summer' },
  autumn: { name:'🍂 Autumn', foodMult:0.8, speedMult:1.0, tileShift:[15,-5,-10], skyShift:[ 15, -5,-12], label:'Autumn' },
  // Loop 017 (the-fixer, 013 finding): winter tileShift tuned from
  // [-10,-5,+15] to [-5,-3,+8]. The previous values produced a uniformly
  // blue-washed drained winter-midday (the multiply overlay is off at
  // daylight=1.0 so the tileShift was unopposed for ~42% of each winter
  // day). Half-magnitude preserves the cool winter cue without reading
  // as under-exposed. Dusk/night hue-variation (012) still supplies the
  // warm/cool contrast; winter midday no longer has to carry a cold feel
  // on its own.
  winter: { name:'❄️ Winter', foodMult:0.3, speedMult:0.8, tileShift:[-5,-3,8],   skyShift:[-10, -5, 15], label:'Winter' },
};
const SEASON_ORDER = ['spring','summer','autumn','winter'];
export const SEASON_IDX = { spring: 0, summer: 1, autumn: 2, winter: 3 };
export function getSeasonIndex() { return SEASON_IDX[G.season] ?? 0; }

export function updateSeason() {
  const idx = Math.floor((G.day - 1) / 7) % 4;
  const newSeason = SEASON_ORDER[idx];
  if (newSeason !== G.season) {
    G.season = newSeason;
    return true; // season changed
  }
  return false;
}

export function getSeasonData() {
  return SEASONS[G.season] || SEASONS.spring;
}

export function getDaylight() {
  const t = G.dayPhase / G.dayLength;
  if (t < 0.1) return 0.72 + (t/0.1)*0.28;
  if (t < 0.6) return 1;
  if (t < 0.75) return 1 - ((t-0.6)/0.15)*0.35;
  return 0.72 - ((t-0.75)/0.25)*0.04;
}

// Day period for citizen schedules (Phase 3a). Boundaries mirror the
// getDaylight() curve above: dawn ramp 0–0.10, full day to 0.60, dusk
// fade to 0.75, night after.
export function getDayPeriod() {
  const t = G.dayPhase / G.dayLength;
  if (t < 0.10) return 'dawn';
  if (t < 0.60) return 'day';
  if (t < 0.75) return 'dusk';
  return 'night';
}

// Instrumentation for loop 004 (the-profiler): sample the lighting
// pipeline across a day without changing gameplay. The multiply-blend
// night overlay in render.js kicks in when daylight < 0.95; its
// darkness is capped at 0.7. Effective luminance below is a rough
// proxy for what hits mid-grey pixels after the overlay multiply.
export function lightCurve({ samples = 24, season = null } = {}) {
  const savedPhase = G.dayPhase;
  const savedSeason = G.season;
  if (season) G.season = season;
  const rows = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    G.dayPhase = t * G.dayLength;
    const dl = getDaylight();
    const row = {
      t: +t.toFixed(3),
      dayPhase: Math.round(G.dayPhase),
      hour: +(t * 24).toFixed(1),
      daylight: +dl.toFixed(3),
    };
    if (dl < 0.95) {
      const darkness = Math.min(1 - dl, 0.7);
      row.overlayR = Math.round(255 - darkness * 160);
      row.overlayG = Math.round(255 - darkness * 150);
      row.overlayB = Math.round(255 - darkness * 100);
      row.effLum = +((row.overlayR + row.overlayG + row.overlayB) / 765).toFixed(3);
    } else {
      row.overlayR = 255; row.overlayG = 255; row.overlayB = 255;
      row.effLum = 1;
    }
    rows.push(row);
  }
  G.dayPhase = savedPhase;
  G.season = savedSeason;
  return rows;
}

// Instrumentation for loop 037 (silent-module): sample the tint overlay
// coefficients across a day. Mirrors render.js:2515-2530 as a pure
// function — no game-state mutation beyond the save/restore dayPhase
// bracket. Useful for any future tick that needs to numerically diff
// 012's hue-variation (e.g., before shipping a further tint change).
//
// NOTE: lightCurve (004) reports `overlayR/G/B` using the PRE-012
// static coefficients (160/150/100). Those values are now stale. Prefer
// tintCurve for current tint math; lightCurve remains correct for the
// daylight-curve shape (`t`, `daylight`, `effLum`).
export function tintCurve({ samples = 24 } = {}) {
  const savedPhase = G.dayPhase;
  const rows = [];
  for (let i = 0; i <= samples; i++) {
    const dayT = i / samples;
    G.dayPhase = dayT * G.dayLength;
    const dl = getDaylight();
    const row = {
      t: +dayT.toFixed(3),
      hour: +(dayT * 24).toFixed(1),
      daylight: +dl.toFixed(3),
    };
    if (dl < 0.95) {
      const darkness = Math.min(1 - dl, 0.7);
      let kR, kG, kB;
      if (dayT < 0.10) {
        // Dawn — soft rose (render.js:2524-2528).
        kR = 80; kG = 140; kB = 160;
      } else {
        // Dusk (t=0.70) → night (t=1.0) lerp.
        const nightBlend = Math.max(0, Math.min(1, (dayT - 0.70) / 0.30));
        kR = 80  + (180 - 80)  * nightBlend;
        kG = 120 + (140 - 120) * nightBlend;
        kB = 180 + (100 - 180) * nightBlend;
      }
      row.kR = Math.round(kR);
      row.kG = Math.round(kG);
      row.kB = Math.round(kB);
      row.tintR = Math.round(255 - darkness * kR);
      row.tintG = Math.round(255 - darkness * kG);
      row.tintB = Math.round(255 - darkness * kB);
    } else {
      row.kR = 0; row.kG = 0; row.kB = 0;
      row.tintR = 255; row.tintG = 255; row.tintB = 255;
    }
    rows.push(row);
  }
  G.dayPhase = savedPhase;
  return rows;
}
