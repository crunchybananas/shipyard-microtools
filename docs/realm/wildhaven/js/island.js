/** The whole island, in grid coordinates. Shared by economy, navigation and rendering. */
export const ISLAND_BOUNDS = Object.freeze({ minX: -28, maxX: 28, minZ: -34, maxZ: 12 });
export const ISLAND_REGIONS = Object.freeze([
  { id: 'home', name: 'Hearthvale', x: 0, z: 1, radius: 10 },
  { id: 'pineward', name: 'Pineward', x: -14, z: -11, radius: 9 },
  { id: 'highmeadow', name: 'Highmeadow', x: -2, z: -18, radius: 9 },
  { id: 'reedmarch', name: 'Reedmarch', x: 14, z: -12, radius: 9 },
  { id: 'crownhill', name: 'Crownhill', x: -2, z: -25, radius: 7 },
]);
export const ISLAND_NEIGHBORS = Object.freeze([
  { id: 'reedbank', name: 'Reedbank', x: 18, z: -13, temper: 'friendly', radius: 2.2 },
  { id: 'stonehaven', name: 'Stonehaven', x: -18, z: -14, temper: 'neutral', radius: 2.2 },
  { id: 'blackthorn', name: 'Blackthorn', x: 2, z: -28, temper: 'hostile', radius: 2.2 },
]);
const finite = Number.isFinite;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
function ellipse(x, z, cx, cz, rx, rz, seed = .4) {
  const angle = Math.atan2((z - cz) / rz, (x - cx) / rx);
  const coast = 1 + .045 * Math.sin(angle * 3 + seed) + .025 * Math.cos(angle * 5);
  return Math.hypot((x - cx) / rx, (z - cz) / rz) / coast;
}
export function legacyIslandShape(x, z) { return ellipse(x, z, 0, 0, 10.5, 9); }
export function islandShape(x, z) {
  return Math.min(legacyIslandShape(x, z), ellipse(x, z, 0, -19, 19, 13, .7), ellipse(x, z, -15, -11, 11, 10, 1.8), ellipse(x, z, 15, -11, 11, 10, 2.4));
}
export function isLand(x, z) {
  return finite(x) && finite(z) && x >= ISLAND_BOUNDS.minX && x <= ISLAND_BOUNDS.maxX && z >= ISLAND_BOUNDS.minZ && z <= ISLAND_BOUNDS.maxZ && islandShape(x, z) <= 1;
}
/** Approximate signed distance from the coast in grid cells, positive inland. */
export function coastDistance(x, z) { return (1 - islandShape(x, z)) * 9; }
export function regionAt(x, z) {
  if (!isLand(x, z)) return null;
  if (legacyIslandShape(x, z) <= 1.04) return ISLAND_REGIONS[0];
  return ISLAND_REGIONS.slice(1).reduce((a, b) => Math.hypot(x - a.x, z - a.z) / a.radius < Math.hypot(x - b.x, z - b.z) / b.radius ? a : b);
}
export function neighborAt(x, z, margin = 0) { return ISLAND_NEIGHBORS.find(n => Math.hypot(x - n.x, z - n.z) <= n.radius + margin) || null; }
export function isNeighborCompoundCell(x, z) {
  return ISLAND_NEIGHBORS.some(n => Math.abs(Math.round(x) - n.x) <= 1 && Math.abs(Math.round(z) - n.z) <= 1);
}
export function groundHeight(x, z) {
  if (!isLand(x, z)) return -.12;
  const old = legacyIslandShape(x, z), r = islandShape(x, z);
  const knoll = Math.exp(-((x * x) / 18 + ((z + 5) * (z + 5)) / 10)) * .82;
  const rolling = .035 * Math.sin(x * .65) * Math.cos(z * .55);
  const legacy = .18 + smooth((1 - old) * 4) * (.65 + knoll + rolling);
  const ridges = 1.65 * Math.exp(-(((x + 13) / 7) ** 2 + ((z + 15) / 10) ** 2)) + 1.25 * Math.exp(-(((x - 1) / 9) ** 2 + ((z + 28) / 5) ** 2));
  const expanded = .18 + smooth((1 - r) * 4) * (.65 + ridges + rolling);
  // Interior village terrain and its building foundations remain exactly as before.
  const blend = smooth((old - .86) / .24);
  return legacy * (1 - blend) + expanded * blend;
}
function segmentDistance(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
}
const trails = [[0,-7,0,-18], [0,-16,-18,-14], [0,-16,18,-13], [0,-18,2,-28]];
export function onFrontierTrail(x, z, width = .52) { return z < -7 && trails.some(s => segmentDistance(x, z, ...s) < width); }
export function terrainAt(x, z) {
  if (!isLand(x, z)) return { kind: 'water', height: -.12, buildable: false, coastDistance: coastDistance(x, z), regionId: null };
  let kind = 'grass';
  if (((x + 6) / 3.1) ** 2 + ((z + 3) / 3.5) ** 2 < 1 || ((x + 5) / 2) ** 2 + ((z - 3) / 2.1) ** 2 < 1) kind = 'forest';
  if (((x - 6) / 2.4) ** 2 + ((z + 4) / 2.8) ** 2 < 1) kind = 'rock';
  if (legacyIslandShape(x, z) > 1.08) {
    if (((x + 16) / 7) ** 2 + ((z + 8) / 6) ** 2 < 1 || ((x - 8) / 4.5) ** 2 + ((z + 23) / 5) ** 2 < 1) kind = 'forest';
    if (((x + 11) / 3) ** 2 + ((z + 21) / 3.7) ** 2 < 1 || ((x - 21) / 2.2) ** 2 + ((z + 6) / 2.7) ** 2 < 1) kind = 'rock';
  }
  const onPath = (Math.abs(x) < .38 && z >= -4.5 && z <= 6.4)
    || (Math.abs(z - 6) < .38 && x >= 0 && x <= 2.3)
    || (Math.abs(x - 2) < .38 && z >= 6 && z <= 8.5) || (legacyIslandShape(x, z) > 1.04 && onFrontierTrail(x, z));
  if (onPath) kind = 'path';
  const settlement = neighborAt(x, z), regionalClearing = ISLAND_REGIONS.slice(1).some(r => Math.hypot(x - r.x, z - r.z) < 1.8);
  if ((settlement || regionalClearing) && kind !== 'path') kind = 'grass';
  const reserved = !!settlement || (Math.abs(x) < .55 && (Math.abs(z + 5) < .55 || Math.abs(z - 2) < .55)) || (Math.abs(x - 2) < .7 && z >= 7.5);
  const footprintFits = [-.5, .5].every(dx => [-.5, .5].every(dz => isLand(x + dx, z + dz)));
  return { kind, height: groundHeight(x, z), buildable: kind !== 'path' && !reserved && footprintFits, coastDistance: coastDistance(x, z), regionId: regionAt(x, z)?.id };
}
export function listTiles() {
  const tiles = [];
  for (let z = ISLAND_BOUNDS.minZ; z <= ISLAND_BOUNDS.maxZ; z++) for (let x = ISLAND_BOUNDS.minX; x <= ISLAND_BOUNDS.maxX; x++) tiles.push({ x, z, ...terrainAt(x, z) });
  return tiles;
}
const natureNoise = (x, z, seed = 1) => { const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return value - Math.floor(value); };
export function hasNaturalObstacle(x, z) {
  const tile = terrainAt(x, z);
  if (tile.kind === 'water' || tile.kind === 'path' || ISLAND_REGIONS.slice(1).some(r => Math.hypot(x - r.x, z - r.z) < 1.8) || neighborAt(x, z, 1.2) || onFrontierTrail(x, z, 1.3)) return false;
  if (tile.kind === 'rock') return true;
  const forest = tile.kind === 'forest';
  if (Math.hypot(x, z + 5) < 2 || (Math.abs(x) < 3 && z > -4) || (!forest && natureNoise(x, z, 3) > .11)) return false;
  for (let j = 0; j < (forest ? 2 : 1); j++) {
    const tx = x + (natureNoise(x, z, j + 9) - .5) * .72, tz = z + (natureNoise(x, z, j + 11) - .5) * .72;
    if (isLand(tx + .5, tz + .5) && isLand(tx - .5, tz - .5)) return true;
  }
  return false;
}
