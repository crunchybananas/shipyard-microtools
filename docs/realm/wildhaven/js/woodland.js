import { DISCOVERIES } from './discovery.js';
import { listTiles, hasNaturalObstacle, isLand } from './island.js';

export const TREE_TIMBER = 8;
export const SAPLING_SECONDS = 180;
export const PLANTING_WORK = 12;
const random = (x, z, seed = 1) => { const v = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
// Stable IDs and positions are shared by the save, resource budget and renderer.
export const TREE_SITES = Object.freeze(listTiles().flatMap(tile => {
  const forest = tile.kind === 'forest';
  if (!hasNaturalObstacle(tile.x, tile.z) || tile.kind === 'rock' || Math.hypot(tile.x, tile.z + 5) < 2 || (Math.abs(tile.x) < 3 && tile.z > -4) || (!forest && random(tile.x, tile.z, 3) > .11)) return [];
  return Array.from({ length: forest ? 2 : 1 }, (_, j) => {
    const x = tile.x + (random(tile.x, tile.z, j + 9) - .5) * .72, z = tile.z + (random(tile.x, tile.z, j + 11) - .5) * .72;
    return { id: `${tile.x},${tile.z}:${j}`, x, z, tile, s: .7 + random(x, z) * .62 };
  }).filter(t => isLand(t.x + .5, t.z + .5) && isLand(t.x - .5, t.z - .5));
}));
const byId = new Map(TREE_SITES.map(t => [t.id, t]));
const groves = new WeakMap();
export const createWoodland = () => ({ trees: {}, felled: 0, planted: 0 });
export function restoreWoodland(input) {
  if (input === undefined) return createWoodland();
  if (!input || typeof input !== 'object' || !input.trees || Array.isArray(input.trees) || typeof input.trees !== 'object' || Object.keys(input.trees).length > TREE_SITES.length) throw new Error('Invalid woodland');
  const result = createWoodland();
  for (const key of ['felled', 'planted']) {
    if (!Number.isSafeInteger(input[key]) || input[key] < 0) throw new Error('Invalid woodland history');
    result[key] = input[key];
  }
  for (const [id, tree] of Object.entries(input.trees)) {
    if (!byId.has(id) || !tree || !Number.isFinite(tree.wood) || tree.wood < 0 || tree.wood > TREE_TIMBER || !Number.isFinite(tree.growth) || tree.growth < -1 || tree.growth > SAPLING_SECONDS || (tree.growth < 0 && tree.growth !== -1) || !Number.isFinite(tree.planting) || tree.planting < 0 || tree.planting >= PLANTING_WORK || (tree.growth < SAPLING_SECONDS && tree.wood !== 0) || (tree.growth >= 0 && tree.planting !== 0) || (tree.growth === SAPLING_SECONDS && tree.wood === 0)) throw new Error('Invalid tree');
    result.trees[id] = { wood: tree.wood, growth: tree.growth, planting: tree.planting };
  }
  return result;
}
function woodlandCache(state) {
  const sites = [...state.buildings, ...(state.frontier?.fortifications || []), ...DISCOVERIES];
  const signature = sites.map(t=>`${t.x},${t.z}`).join('|');
  let cache = groves.get(state);
  if (cache?.signature !== signature) {
    cache = { signature, occupied: new Set(sites.map(t=>`${t.x},${t.z}`)), yards: new Map() };
    groves.set(state, cache);
  }
  return cache;
}
export function woodlandOccupancy(state) { return woodlandCache(state).occupied; }
export function groveFor(state, building) {
  const cache = woodlandCache(state), key = `${building.x},${building.z}`;
  if (!cache.yards.has(key)) cache.yards.set(key, TREE_SITES.filter(t=>!cache.occupied.has(`${t.tile.x},${t.tile.z}`)).sort((a, b) => Math.hypot(a.x-building.x,a.z-building.z)-Math.hypot(b.x-building.x,b.z-building.z) || a.id.localeCompare(b.id)).slice(0, 12));
  return cache.yards.get(key);
}
export function treeState(state, id) { return state.woodland?.trees[id] || { wood: TREE_TIMBER, growth: SAPLING_SECONDS, planting: 0 }; }
export function woodlandStatus(state, building) {
  const grove = groveFor(state, building), trees = grove.map(t => treeState(state, t.id));
  const ready = trees.filter(t => t.growth === SAPLING_SECONDS), saplings = trees.filter(t => t.growth >= 0 && t.growth < SAPLING_SECONDS);
  return { mature: ready.length, saplings: saplings.length, stumps: trees.length-ready.length-saplings.length, available: ready.reduce((sum,t) => sum+t.wood,0), youngTarget: grove.find(t=>treeState(state,t.id).growth < SAPLING_SECONDS) || null, nextGrowth: saplings.length ? Math.ceil(Math.min(...saplings.map(t=>SAPLING_SECONDS-t.growth))) : null, target: grove.find(t=>treeState(state,t.id).wood>0) || grove[0] };
}
export function harvestWood(state, building, requested) {
  state.woodland ||= createWoodland();
  let left = requested;
  for (const site of groveFor(state, building)) {
    const prior = treeState(state, site.id);
    if (!prior.wood || left <= 1e-8) continue;
    const taken = Math.min(left, prior.wood), wood = Math.max(0, Math.round((prior.wood-taken)*1e6)/1e6);
    state.woodland.trees[site.id] = { wood, growth: wood > 0 ? SAPLING_SECONDS : -1, planting: 0 };
    left -= taken;
    if (!wood) state.woodland.felled++;
  }
  return requested - Math.max(0, left);
}
export function tickWoodland(state, dt) {
  state.woodland ||= createWoodland();
  let changed = false;
  // Once planted, young trees grow even if their yard closes or is demolished.
  for (const tree of Object.values(state.woodland.trees)) if (tree.growth >= 0 && tree.growth < SAPLING_SECONDS) {
    tree.growth = Math.min(SAPLING_SECONDS, tree.growth + dt);
    if (tree.growth === SAPLING_SECONDS) { tree.wood = TREE_TIMBER; changed = true; }
  }
  // One shared stock prevents overlapping yards from duplicating a tree.
  for (const yard of state.buildings) if (yard.type === 'lumber' && yard.status === 'ready' && !yard.paused && yard.workerIds.length) {
    let work = yard.workerIds.length * dt;
    for (const site of groveFor(state, yard)) {
      const tree = state.woodland.trees[site.id];
      if (!tree || tree.growth !== -1 || work <= 0) continue;
      const used = Math.min(work, PLANTING_WORK-tree.planting); tree.planting += used; work -= used;
      if (tree.planting >= PLANTING_WORK) { tree.growth = 0; tree.planting = 0; state.woodland.planted++; changed = true; }
    }
  }
  return changed;
}
