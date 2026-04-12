// ════════════════════════════════════════════════════════════
// Shared game state — imported by all modules
// ════════════════════════════════════════════════════════════

export const TILE = { WATER:0, SAND:1, GRASS:2, FOREST:3, STONE:4, IRON:5, MOUNTAIN:6 };
export const TW = 64, TH = 32;
export const MAP_W = 48, MAP_H = 48;

export const TILE_COLORS = {
  [TILE.WATER]:   ['#1e3a5f','#1a3050'],
  [TILE.SAND]:    ['#d4a76a','#c99a5c'],
  [TILE.GRASS]:   ['#4a7c4f','#3d6b42'],
  [TILE.FOREST]:  ['#2d5a30','#265028'],
  [TILE.STONE]:   ['#6b7280','#5a616d'],
  [TILE.IRON]:    ['#4b6fa0','#405e8a'],
  [TILE.MOUNTAIN]:['#4a4a5a','#3d3d4d'],
};

export const BUILDINGS = {
  house:     { name:'House',       icon:'🏠', cost:{wood:15,stone:5},  pop:3, desc:'Shelters 3 settlers' },
  farm:      { name:'Farm',        icon:'🌾', cost:{wood:10},          prod:{food:2}, workers:1, desc:'Produces food each cycle' },
  lumber:    { name:'Lumber Mill',  icon:'🪓', cost:{wood:5,stone:10}, prod:{wood:3}, workers:1, on:[TILE.FOREST], desc:'Harvests wood from forest' },
  quarry:    { name:'Quarry',      icon:'⛏️', cost:{wood:10},          prod:{stone:2}, workers:1, on:[TILE.STONE], desc:'Extracts stone' },
  mine:      { name:'Iron Mine',   icon:'🏭', cost:{wood:15,stone:15}, prod:{iron:1}, workers:2, on:[TILE.IRON], desc:'Mines iron ore' },
  market:    { name:'Market',      icon:'🏪', cost:{wood:20,stone:15}, prod:{gold:2}, workers:1, desc:'Generates gold from trade' },
  barracks:  { name:'Barracks',    icon:'⚔️', cost:{wood:20,stone:20,iron:5}, defense:10, workers:2, desc:'Trains soldiers for defense' },
  tower:     { name:'Watch Tower', icon:'🗼', cost:{stone:25,iron:5},  defense:15, reveal:4, desc:'Reveals fog and defends' },
  well:      { name:'Well',        icon:'🪣', cost:{stone:10},         happiness:5, desc:'Provides water, boosts happiness' },
  tavern:    { name:'Tavern',      icon:'🍺', cost:{wood:20,gold:10},  happiness:10, workers:1, desc:'Entertainment, big happiness boost' },
  wall:      { name:'Wall',        icon:'🧱', cost:{stone:8},          defense:5, desc:'Fortification segment' },
  road:      { name:'Road',        icon:'🛤️', cost:{stone:3},          speedBonus:true, desc:'Citizens move faster on roads' },
  tradingpost:{ name:'Trading Post',icon:'⛵', cost:{wood:20,stone:15}, workers:1, on:[1], desc:'Sends caravans for gold (build on sand)' },
};

// ── Mutable game state (single source of truth) ───────────
export const G = {
  map: [],
  fog: [],
  buildings: [],
  citizens: [],
  buildingGrid: [],    // MAP_H x MAP_W, null or building ref
  particles: [],
  resources: { wood:60, stone:30, food:40, gold:25, iron:0 },
  population: 3,
  maxPop: 3,
  happiness: 50,
  defense: 0,
  day: 1,
  dayPhase: 0,
  dayLength: 600,
  gameTick: 0,
  speed: 1,
  camera: { x: MAP_W/2 * TW/2, y: 0, zoom: 1 },
  selectedBuild: null,
  selectedBuilding: null,
  hoveredTile: null,
  dragging: false,
  dragStart: {x:0,y:0},
  camStart: {x:0,y:0},
  nextRaidDay: 8,
  raidInterval: 8,
  audioCtx: null,
  researchedTechs: new Set(['agriculture', 'forestry']),
  currentResearch: null,
  caravans: [], // { x, y, tx, ty, phase:'outbound'|'returning', gold, building, speed }
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
