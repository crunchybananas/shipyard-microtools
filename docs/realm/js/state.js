// ════════════════════════════════════════════════════════════
// Shared game state — imported by all modules
// ════════════════════════════════════════════════════════════

export const TILE = { WATER:0, SAND:1, GRASS:2, FOREST:3, STONE:4, IRON:5, MOUNTAIN:6 };
export const TW = 64, TH = 32;
export const MAP_W = 80, MAP_H = 80;

// Loop 45 (render S4): tightened the per-tile two-color alternation so
// the checkerboard pulse is less visible. Deltas were 8-16pt which read
// as a visible iso-diamond grid overlaid on every field. Now ≤4pt —
// same base tone with a subtle darker cousin.
export const TILE_COLORS = {
  [TILE.WATER]:   ['#1872b8','#1668b0'],
  [TILE.SAND]:    ['#e4c478','#dec074'],
  [TILE.GRASS]:   ['#4aa352','#479d4e'],
  [TILE.FOREST]:  ['#2d7a35','#2a7432'],
  [TILE.STONE]:   ['#9a9490','#948e8a'],
  [TILE.IRON]:    ['#5a85b8','#547fb2'],
  [TILE.MOUNTAIN]:['#6a6a7a','#656575'],
};

export const BUILDINGS = {
  house:     { name:'House',       icon:'🏠', cost:{wood:15,stone:5},  pop:4, desc:'Shelters 4 settlers. Generates tax income based on happiness.' },
  farm:      { name:'Farm',        icon:'🌾', cost:{wood:10},          prod:{food:3}, workers:1, desc:'Produces food each cycle',
    upgrades: [
      { cost:{wood:15,stone:8},          prodMult:1.5, name:'Level 2' },
      { cost:{wood:25,stone:20,iron:5},  prodMult:2.0, name:'Level 3' },
    ] },
  lumber:    { name:'Lumber Mill',  icon:'🪓', cost:{wood:5,stone:10}, prod:{wood:3}, workers:1, on:[TILE.FOREST], desc:'Harvests wood from forest',
    upgrades: [
      { cost:{wood:8,stone:15},          prodMult:1.5, name:'Level 2' },
      { cost:{wood:15,stone:25,iron:5},  prodMult:2.0, name:'Level 3' },
    ] },
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
  barracks:  { name:'Barracks',    icon:'⚔️', cost:{wood:20,stone:20,iron:5}, defense:10, workers:2, desc:'Trains soldiers for defense' },
  tower:     { name:'Watch Tower', icon:'🗼', cost:{stone:25,iron:5},  defense:15, reveal:4, desc:'Reveals fog and defends' },
  well:      { name:'Well',        icon:'🪣', cost:{stone:10},         happiness:5,  radius:4, desc:'Provides water, boosts happiness' },
  tavern:    { name:'Tavern',      icon:'🍺', cost:{wood:20,gold:10},  happiness:10, radius:5, workers:1, desc:'Entertainment, big happiness boost' },
  wall:      { name:'Wall',        icon:'🧱', cost:{stone:8},          defense:5, desc:'Fortification segment' },
  road:      { name:'Road',        icon:'🛤️', cost:{stone:3},          speedBonus:true, desc:'Citizens move faster on roads' },
  tradingpost:{ name:'Trading Post',icon:'⛵', cost:{wood:20,stone:15}, workers:1, on:[1], desc:'Sends caravans for gold (build on sand)' },
  castle:    { name:'Castle',      icon:'🏰', cost:{stone:80,wood:60,iron:30,gold:50}, defense:50, happiness:20, pop:10, desc:'The ultimate structure. Build this to win!' },
  granary:   { name:'Granary',     icon:'🏺', cost:{wood:20,stone:10}, foodStore:30, desc:'Stores +30 food reserves, halves winter food loss' },
  church:    { name:'Church',      icon:'⛪', cost:{stone:30,gold:15}, happiness:15, radius:6, desc:'Major happiness boost for your settlement' },
  school:    { name:'School',      icon:'📚', cost:{wood:15,stone:15,gold:10}, researchSpeed:0.5, workers:1, desc:'Speeds up research by 50%' },
  windmill:  { name:'Windmill',    icon:'🌬️', cost:{wood:25,stone:10}, workers:1, boost:{type:'food',radius:4,multiplier:1.5,target:'farm'}, desc:'Boosts nearby farms by 50%. Works with wind!' },
  bakery:    { name:'Bakery',      icon:'🍞', cost:{wood:20,stone:15}, workers:1, boost:{type:'food',radius:3,multiplier:1.3,target:'farm'}, happiness:5, desc:'Produces bread from nearby farms. Small happiness boost.' },
  chickencoop: { name:'Chicken Coop', icon:'🐔', cost:{wood:15}, prod:{food:1}, workers:1, desc:'Small chicken coop producing eggs and meat' },
  cowpen:    { name:'Cow Pen',     icon:'🐄', cost:{wood:25,stone:5}, prod:{food:2}, workers:1, desc:'Pastures cattle for milk and meat' },
  fisherman: { name:"Fisherman's Hut", icon:'🐟', cost:{wood:15}, prod:{food:3}, workers:1, on:[TILE.SAND], desc:'Catches fish from nearby waters. Must be on sand adjacent to water.' },
  blacksmith: { name:'Blacksmith', icon:'🔨', cost:{wood:20,stone:15}, workers:1, desc:'Forges weapons. Boosts soldier damage by 50%.', boost:{type:'soldier',radius:8,multiplier:1.5} },
  archery:   { name:'Archery Range', icon:'🏹', cost:{wood:30,stone:10}, workers:1, defense:5, desc:'Trains archer units. Archers have longer range but less HP.' },
  // Loop 243 (the-fixer, 101 filed ~140 ticks): mayor structural-unlock.
  // Town Hall — civic governance building gated on a named mayor (set by
  // tavern-build per 034 hook). Closes the named-character cast filing arc
  // (101/102/105+153/201/206/209/243). Effect: realm-wide happiness +8
  // radius 6 + pop +5 — civic governance brings stability + housing
  // capacity. Cost mirrors mid-tier civic buildings (church 30 stone +
  // 15 gold; townhall is stone-heavier as governance is durable).
  // Loop 255: SVG sprite shipped (Phase E — 12-of-12 roster).
  // Loop 258 (the-fixer, 256 MEDIUM finding): maxCount:1 — townhall is a
  // ONE-SHOT structural unlock per realm. Narrative-coherence rationale:
  // 244 BUILDING_FIRST_BEATS + 253 mayor_first_in_hall both presume a
  // SINGULAR town hall ("the long window," "the long table"); multiple
  // townhalls break the named-character-gate framing. Real-world towns
  // also have one civic seat. First use of the maxCount schema field;
  // tech.js isBuildingUnlocked enforces it generically.
  townhall:  { name:'Town Hall',   icon:'🏛️', cost:{stone:40,wood:30,gold:20}, happiness:8, radius:6, pop:5, maxCount:1, desc:'Civic governance — boosts realm happiness + housing. Requires a named mayor. One per realm.' },
};

// ── Mutable game state (single source of truth) ───────────
export const G = {
  map: [],
  fog: [],
  buildings: [],
  citizens: [],
  soldiers: [],
  buildingGrid: [],    // MAP_H x MAP_W, null or building ref
  particles: [],
  animals: [],
  enemies: [],
  projectiles: [],
  resources: { wood:60, stone:30, food:80, gold:25, iron:0 },
  population: 3,
  maxPop: 3,
  happiness: 50,
  defense: 0,
  day: 1,
  dayPhase: 0,
  dayLength: 3600, // ~60 seconds per day at 1x speed — deliberate pacing
  gameTick: 0,
  speed: 1,
  // Loop 035 (the-fixer, closing 003/011/018 photo-mode cluster):
  // when true, HUD / build-bar / mission panel / minimap / pause-overlay
  // are hidden so the player can compose a clean screenshot. Toggled by
  // H key via togglePhotoMode in main.js.
  photoMode: false,
  camera: { x: 0, y: (MAP_W/2 + MAP_H/2) * TH/2, zoom: 1.3 },
  selectedBuild: null,
  selectedBuilding: null,
  selectedCitizen: null,
  hoveredTile: null,
  dragging: false,
  dragStart: {x:0,y:0},
  camStart: {x:0,y:0},
  nextRaidDay: 8,
  raidInterval: 8,
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
  won: false,
  clouds: null,
  cameraShake: 0,
  tileWear: null,  // 2D array [MAP_H][MAP_W] of 0-255 wear values, lazy-init
  difficulty: 'normal', // easy, normal, hard
  scenario: 'peaceful_start', // selected scenario id
  kingdomName: 'Realm',
  resourceRates: { wood:0, stone:0, food:0, gold:0, iron:0 },
  notificationLog: [], // { text, type:'info'|'danger'|'event'|'mission', day }
  lastResources: null, // snapshot for rate calculation
  buildQueue: [],   // [{type, x, y}] — queued builds awaiting resources
  stats: {
    buildingsBuilt: 0,
    buildingsLost: 0,
    citizensBorn: 0,
    citizensDied: 0,
    raidsSurvived: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    daysLived: 0,
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

// ── Seeded RNG ─────────────────────────────────────────────
let _seed = Date.now() % 100000;
export function rng() { _seed=(_seed*1103515245+12345)&0x7fffffff; return _seed/0x7fffffff; }
export function rngRange(a,b) { return a + rng()*(b-a); }
export function rngInt(a,b) { return Math.floor(rngRange(a,b+1)); }
export function getSeed() { return _seed; }
export function setSeed(s) { _seed = s; }

// ── Names ──────────────────────────────────────────────────
const FIRST = ['Ada','Bjorn','Celia','Dag','Elsa','Finn','Greta','Hans','Inga','Jon','Kara','Lars','Mia','Nils','Olga','Per','Quinn','Runa','Sven','Thea','Ulf','Vera','Wren','Xander','Yara','Zev'];
const LAST = ['Stone','Brook','Field','Hill','Dale','Wood','Lake','Ridge','Vale','Forge','Thorn','Frost','Marsh','Glen','Pike','Ash','Birch','Elm','Oak','Pine'];
export function randomName() { return FIRST[rngInt(0,FIRST.length-1)]+' '+LAST[rngInt(0,LAST.length-1)]; }

export function resourceEmoji(k) { return {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️'}[k]||k; }

export const DIFFICULTY = {
  easy:   { label:'🟢 Easy',   startFood:120, startWood:80, startGold:40, foodMult:0.6, raidMult:0.5, raidStart:12 },
  normal: { label:'🟡 Normal', startFood:80,  startWood:60, startGold:25, foodMult:1.0, raidMult:1.0, raidStart:8 },
  hard:   { label:'🔴 Hard',   startFood:50,  startWood:40, startGold:15, foodMult:1.5, raidMult:1.5, raidStart:5 },
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
  if (t < 0.1) return 0.55 + (t/0.1)*0.45;
  if (t < 0.6) return 1;
  if (t < 0.75) return 1 - ((t-0.6)/0.15)*0.35;
  return 0.65 - ((t-0.75)/0.25)*0.1;
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
