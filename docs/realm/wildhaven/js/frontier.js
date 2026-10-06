import { discoverySpec, fieldworkerFor, fieldworkDuration, isFieldworker } from './discovery.js';
/** Deterministic island frontier: named labor, physical armies, defenses and neighbors. */
export const FRONTIER_VERSION = 1;
export const FRONTIER_BOUNDS = Object.freeze({ minX: -28, maxX: 28, minZ: -34, maxZ: 12 });
export const FRONTIER_REGIONS = Object.freeze([
  { id: 'home', name: 'Hearthvale', x: 0, z: 1, radius: 10 },
  { id: 'pineward', name: 'Pineward', x: -14, z: -11, radius: 9 },
  { id: 'highmeadow', name: 'Highmeadow', x: -2, z: -18, radius: 9 },
  { id: 'reedmarch', name: 'Reedmarch', x: 14, z: -12, radius: 9 },
  { id: 'crownhill', name: 'Crownhill', x: -2, z: -25, radius: 7 },
]);
export const FRONTIER_NEIGHBORS = Object.freeze([
  { id: 'reedbank', name: 'Reedbank', x: 18, z: -13, temper: 'friendly' },
  { id: 'stonehaven', name: 'Stonehaven', x: -18, z: -14, temper: 'neutral' },
  { id: 'blackthorn', name: 'Blackthorn', x: 2, z: -28, temper: 'hostile' },
]);
export const TROOPS = Object.freeze({
  spearman: { name: 'Spearman', description: 'A named resident trains to hold a lane and fight at close range.', cost: { wood: 10, iron: 2, food: 8 }, trainingSeconds: 36, maxHp: 70, damage: 9, range: .62, interval: 1.15, speed: 1.12 },
  archer: { name: 'Archer', description: 'A named resident attacks at range. Arrows need a clear line of sight and take time to land.', cost: { wood: 14, tools: 2, food: 8 }, trainingSeconds: 45, maxHp: 42, damage: 7, range: 4.3, interval: 1.6, speed: 1.05 },
  engineer: { name: 'Frontier builder', cost: {}, trainingSeconds: 0, maxHp: 45, damage: 0, range: 0, interval: 1, speed: .95 },
  envoy: { name: 'Envoy', cost: { food: 8, gold: 15 }, trainingSeconds: 0, maxHp: 35, damage: 0, range: 0, interval: 1, speed: 1.25 },
  explorer: { name: 'Surveyor', cost: { food: 6 }, trainingSeconds: 0, maxHp: 40, damage: 0, range: 0, interval: 1, speed: 1.18 },
  restorer: { name: 'Restorer', cost: {}, trainingSeconds: 0, maxHp: 48, damage: 0, range: 0, interval: 1, speed: 1.05 },
  raider: { name: 'Raider', cost: {}, trainingSeconds: 0, maxHp: 46, damage: 6, range: .48, interval: 1.35, speed: .92 },
});
export const FORTIFICATIONS = Object.freeze({
  wall: { name: 'Stone wall', description: 'Blocks movement and arrows. Enemies must go around or breach it.', cost: { stone: 7, wood: 2 }, work: 12, maxHp: 180 },
  gate: { name: 'Gate', description: 'Closed gates block everyone. Open gates also admit enemies.', cost: { stone: 9, wood: 8, tools: 1 }, work: 20, maxHp: 150 },
  tower: { name: 'Watchtower', description: 'A nearby active archer fires farther and receives protection; an empty tower does not shoot.', cost: { stone: 24, planks: 10, tools: 2 }, work: 45, maxHp: 260 },
  outpost: { name: 'Outpost', description: 'Complete an outpost to claim discovered land for homes and industry.', cost: { wood: 30, stone: 16, planks: 8, gold: 25 }, work: 45, maxHp: 220 },
});
const STEP = .25, DAY = 90, HOME = { x: 0, z: 3 }, MAX_UNITS = 160, MAX_FORTS = 900;
const EPS = 1e-6, finite = n => typeof n === 'number' && Number.isFinite(n), int = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n)), round = n => Math.round(n * 1e6) / 1e6, key = p => `${Math.round(p.x)},${Math.round(p.z)}`, distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const home = ctx => ctx.home || HOME, regions = ctx => ctx.regions || FRONTIER_REGIONS, definitions = ctx => ctx.neighbors || FRONTIER_NEIGHBORS;
const quote = (ok, reason, cost = {}, extra = {}) => ({ ok, reason, cost: { ...cost }, ...extra });
const enough = (state, cost) => Object.entries(cost).every(([r, n]) => finite(state.resources?.[r]) && state.resources[r] + EPS >= n);
const costText = cost => Object.entries(cost).filter(([, n]) => n).map(([r, n]) => `${Math.ceil(n)} ${r === 'gold' ? 'coin' : r}`).join(', ') || 'no goods';
function spend(state, cost) { for (const [r, n] of Object.entries(cost)) state.resources[r] = round(Math.max(0, state.resources[r] - n)); }
function reward(state, bag) { const actual = {}; for (const [r, n] of Object.entries(bag)) { const amount = Math.min(n, Math.max(0, (state.storage?.[r] ?? 100000) - (state.resources[r] || 0))); state.resources[r] = round((state.resources[r] || 0) + amount); actual[r] = amount; } return actual; }
function log(state, text, type = 'frontier') { const f = state.frontier, event = { id: `frontier-log-${f.nextLogId++}`, time: f.clock, day: state.day || 1, type, text }; f.log.unshift(event); f.log.length = Math.min(80, f.log.length); return event; }
const alive = unit => !['dead', 'released'].includes(unit.status);
const battleReady = unit => unit.status === 'active' && TROOPS[unit.kind].damage > 0;
export const blocksFortification = fort => fort.status !== 'ruined' && !(fort.type === 'gate' && fort.open);
const blocking = blocksFortification;
function fortAt(state, x, z) { return state.frontier.fortifications.find(f => f.x === x && f.z === z && blocking(f)); }
function regionFor(x, z, ctx) { const supplied = ctx.regionAt?.(x, z); return typeof supplied === 'string' ? supplied : supplied?.id || [...regions(ctx)].sort((a, b) => distance({ x, z }, a) / a.radius - distance({ x, z }, b) / b.radius)[0]?.id || 'home'; }
function baseOpen(state, x, z, ctx) {
  const b = ctx.bounds || FRONTIER_BOUNDS;
  return int(x, b.minX, b.maxX) && int(z, b.minZ, b.maxZ) && (ctx.isLand ? ctx.isLand(x, z) : true) && (ctx.isWalkable ? ctx.isWalkable(x, z) : !(state.buildings || []).some(b => b.x === x && b.z === z));
}
function hostile(state, a, b) {
  if (a === b) return false;
  if (a === 'raiders' || b === 'raiders') return true;
  if (a !== 'player' && b !== 'player') return false;
  return state.frontier.neighbors.find(n => n.id === (a === 'player' ? b : a))?.status === 'war';
}
function open(state, x, z, ctx) { return baseOpen(state, x, z, ctx) && !fortAt(state, x, z); }
export function gateTransition(state, from, to) {
  for(const point of [from,to]){const gate=state.frontier.fortifications.find(f=>f.type==='gate'&&f.status!=='ruined'&&f.open&&f.x===point.x&&f.z===point.z);if(gate&&((gate.rotation%2===0&&from.x!==to.x)||(gate.rotation%2===1&&from.z!==to.z)))return false;}return true;
}
function clearSegment(state,from,to,ctx) {
  const a={x:Math.round(from.x),z:Math.round(from.z)},b={x:Math.round(to.x),z:Math.round(to.z)};
  if(!open(state,b.x,b.z,ctx)||!gateTransition(state,a,b))return false;
  if(a.x!==b.x&&a.z!==b.z){const x={x:b.x,z:a.z},z={x:a.x,z:b.z};if(!open(state,x.x,x.z,ctx)||!open(state,z.x,z.z,ctx)||!gateTransition(state,a,x)||!gateTransition(state,x,b)||!gateTransition(state,a,z)||!gateTransition(state,z,b))return false;}return true;
}
function nearestOpen(state, point, ctx, radius = 8, used = false) {
  const candidates = [];
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    const p = { x: Math.round(point.x) + dx, z: Math.round(point.z) + dz };
    if (open(state, p.x, p.z, ctx) && (!used || !state.frontier.units.some(u => alive(u) && distance(u, p) < .4))) candidates.push(p);
  }
  return candidates.sort((a, b) => distance(a, point) - distance(b, point) || a.z - b.z || a.x - b.x)[0] || null;
}

/** A* paths use actual terrain/buildings/fort cells; enemies can choose to breach costly walls. */
export function frontierPath(state, start, end, ctx = {}, { faction = 'player', breach = false } = {}) {
  const origin = { x: Math.round(start.x), z: Math.round(start.z) }, goal = { x: Math.round(end.x), z: Math.round(end.z) };
  if (!baseOpen(state, goal.x, goal.z, ctx)) return [];
  const costs = new Map([[key(origin), 0]]), from = new Map(), pending = [{ ...origin, cost: 0 }]; let visited = 0;
  while (pending.length && visited++ < 6500) {
    pending.sort((a, b) => (a.cost + Math.abs(a.x-goal.x)+Math.abs(a.z-goal.z)) - (b.cost + Math.abs(b.x-goal.x)+Math.abs(b.z-goal.z)) || distance(a, goal) - distance(b, goal));
    const p = pending.shift(); if (p.cost !== costs.get(key(p))) continue;
    if (p.x === goal.x && p.z === goal.z) { const result = []; let cursor = p; while (key(cursor) !== key(origin)) { result.unshift({ x: cursor.x, z: cursor.z }); cursor = from.get(key(cursor)); } return result; }
    for (const [dx, dz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const n = { x: p.x + dx, z: p.z + dz }; if (!baseOpen(state, n.x, n.z, ctx) || !gateTransition(state,p,n)) continue;
      const fort = fortAt(state, n.x, n.z); if (fort && !(breach && hostile(state, faction, fort.faction))) continue;
      const cost = p.cost + 1 + (fort ? 8 + fort.hp / 12 : 0);
      if (cost + EPS < (costs.get(key(n)) ?? Infinity)) { costs.set(key(n), cost); from.set(key(n), p); pending.push({ ...n, cost }); }
    }
  }
  return [];
}
function route(state, unit, target, ctx, breach = false) { unit.path = frontierPath(state, unit, target, ctx, { faction: unit.faction, breach }); unit.routeAt = state.frontier.clock; unit.routeGoal = { x: Math.round(target.x), z: Math.round(target.z) }; }
function lineOfSight(state, a, b, ctx) {
  const length = distance(a, b), steps = Math.max(1, Math.ceil(length * 5));
  for (let i = 1; i < steps; i++) { const t = i / steps, x = Math.round(a.x + (b.x - a.x) * t), z = Math.round(a.z + (b.z - a.z) * t); if ((x === Math.round(a.x) && z === Math.round(a.z)) || (x === Math.round(b.x) && z === Math.round(b.z))) continue; const targetCompound=b.id?.startsWith('settlement-')&&Math.abs(x-b.x)<=1&&Math.abs(z-b.z)<=1;if(!targetCompound&&(!baseOpen(state, x, z, ctx) || fortAt(state, x, z))) return false; }
  return true;
}
function emptyStats() { return { recruited: 0, wounded: 0, deaths: 0, enemiesDefeated: 0, raidsDefeated: 0, cargoLost: 0, wallsBreached: 0, trades: 0, missions: 0, conquests: 0, deathsThisWave: 0 }; }
export function createFrontierState(ctx = {}) {
  const neighbors = definitions(ctx).map(n => ({ ...n, discovered: false, relation: n.temper === 'friendly' ? 10 : n.temper === 'hostile' ? -15 : 0, status: 'neutral', envoys: 0, trades: 0, lastTradeDay: 0, aidReadyAt: 0, nextAttackAt: null, truceUntil: 0, hp: 360, maxHp: 360, defeated: false }));
  return { version: FRONTIER_VERSION, clock: 0, subsecond: 0, nextId: 1, nextLogId: 1, units: [], fortifications: neighbors.map(n => ({ id: `settlement-${n.id}`, type: 'outpost', name: n.name, faction: n.id, x: n.x, z: n.z, rotation: 0, status: 'ready', hp: 360, maxHp: 360, progress: 0, work: 0, escrow: {}, open: false, damageAt: null, regionId: null })), neighbors, claims: ['home'], discoveredRegions: ['home'], projectiles: [], log: [], warning: null, nextRaidAt: null, raidActive: false, raidOutcome: null, builderTarget: 1, stats: emptyStats() };
}
export function reservedCitizenIds(state) { return (state.frontier?.units || []).filter(u => u.citizenId && alive(u)).map(u => u.citizenId); }
export function frontierAssignments(state) { return (state.frontier?.units || []).filter(u => u.citizenId && alive(u)).map(u => ({ citizenId: u.citizenId, job: u.kind, workplace: u.id })); }
function availableCitizens(state) { const reserved = new Set(reservedCitizenIds(state)); return (state.citizens || []).filter(c => !reserved.has(c.id)).sort((a, b) => Number(b.job === 'idle') - Number(a.job === 'idle') || a.id.localeCompare(b.id)); }
function newUnit(state, kind, faction, point, citizen = null) {
  const spec = TROOPS[kind], f = state.frontier;
  const unit = { id: `unit-${f.nextId++}`, citizenId: citizen?.id || null, name: citizen?.name || (faction === 'player' ? 'Allied ' : '') + spec.name, kind, faction, x: point.x, z: point.z, yaw: 0, hp: spec.maxHp, maxHp: spec.maxHp, status: citizen && spec.trainingSeconds ? 'training' : 'active', trainingRemaining: citizen ? spec.trainingSeconds : 0, trainingSeconds: citizen ? spec.trainingSeconds : 0, recoveryRemaining: 0, order: { type: faction === 'player' ? 'hold' : 'raid' }, path: [], routeAt: -10, routeGoal: null, cooldown: 0, attackAt: null, damageAt: null, deathAt: null, targetId: null, missionNeighborId: null, missionStage: null, wounds: 0 };
  f.units.push(unit); return unit;
}
function troopPermission(state, kind) {
  const spec = TROOPS[kind]; if (!['spearman', 'archer'].includes(kind)) return quote(false, 'Choose spearmen or archers.');
  if (!(state.buildings || []).some(b => b.type === 'barracks' && b.status === 'ready' && !b.paused)) return quote(false, 'Complete a watch house before training troops.', spec.cost);
  if (state.frontier.units.length >= MAX_UNITS) return quote(false, 'The company is at its limit.', spec.cost);
  if (availableCitizens(state).length <= 2) return quote(false, 'Keep at least two residents available for civilian work.', spec.cost);
  return quote(enough(state, spec.cost), enough(state, spec.cost) ? 'Training reserves one named resident from civilian work.' : `Needs ${costText(spec.cost)}.`, spec.cost);
}
export function troopOptions(state) { return ['spearman', 'archer'].map(id => ({ id, ...TROOPS[id], ...troopPermission(state, id), availableCitizens: availableCitizens(state).map(({ id, name, job }) => ({ id, name, job })) })); }
export function recruitTroop(state, kind, citizenId = null, ctx = {}) {
  const offer = troopPermission(state, kind); if (!offer.ok) return offer;
  const person = availableCitizens(state).find(c => !citizenId || c.id === citizenId); if (!person) return quote(false, 'That resident is unavailable.', offer.cost);
  const point = nearestOpen(state, home(ctx), ctx, 6, true); if (!point) return quote(false, 'Leave clear ground beside the village footpath.', offer.cost);
  spend(state, offer.cost); const unit = newUnit(state, kind, 'player', point, person); state.frontier.stats.recruited++; log(state, `${person.name} begins ${TROOPS[kind].name.toLowerCase()} training; their civilian job is vacant.`, 'recruit');
  return { ...offer, unit, reason: `${person.name} is training for ${unit.trainingSeconds} seconds.` };
}
export function fortificationOptions(state) { return Object.entries(FORTIFICATIONS).map(([id, spec]) => ({ id, ...spec, ...quote(enough(state, spec.cost), enough(state, spec.cost) ? 'A resident must walk here and complete the work.' : `Needs ${costText(spec.cost)}.`, spec.cost) })); }
function placePermission(state, type, x, z, rotation, ctx, { ignoreCost = false, regionId = null } = {}) {
  const spec = Object.hasOwn(FORTIFICATIONS,type) ? FORTIFICATIONS[type] : null; if (!spec || !int(rotation, 0, 3)) return quote(false, 'Choose a valid defense and orientation.');
  if (!int(x, -256, 256) || !int(z, -256, 256) || !baseOpen(state, x, z, ctx)) return quote(false, 'Defenses need clear, dry, walkable ground.', spec.cost);
  if (state.frontier.units.some(u => alive(u) && Math.round(u.x) === x && Math.round(u.z) === z)) return quote(false, 'Let frontier troops clear this cell before building.', spec.cost);
  if (type !== 'gate' && state.frontier.units.some(u => alive(u) && ['move','retreat'].includes(u.order.type) && u.order.x === x && u.order.z === z)) return quote(false, 'This is a troop’s ordered destination. Give it another destination before placing a solid defense.', spec.cost);
  if (state.frontier.fortifications.some(f => f.x === x && f.z === z && f.status !== 'ruined')) return quote(false, 'A defense already occupies this cell.', spec.cost);
  if (distance({ x, z }, home(ctx)) < 1 || definitions(ctx).some(n => distance({ x, z }, n) < 2.3)) return quote(false, 'Keep the village footpath and settlement approaches clear.', spec.cost);
  if (!regionId && !state.frontier.claims.includes(regionFor(x, z, ctx))) return quote(false, 'Claim this region with an outpost first.', spec.cost);
  if (state.frontier.fortifications.length >= MAX_FORTS) return quote(false, 'The island has reached its defense limit.', spec.cost);
  const local = ctx.canPlaceDefense?.(type, x, z, rotation); if (local === false || local?.ok === false) return quote(false, local?.reason || 'Leave a usable route for nearby homes and workplaces.', spec.cost);
  const neighbor = [[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dz]) => ({x:x+dx,z:z+dz})).find(p => open(state,p.x,p.z,ctx) && (key(p) === key(home(ctx)) || frontierPath(state, home(ctx), p, ctx).length));
  if (!neighbor) return quote(false, 'A builder needs an open route to an adjacent cell.', spec.cost);
  if (!state.frontier.units.some(u => u.kind === 'engineer' && alive(u)) && (availableCitizens(state).length <= 2 || state.frontier.units.length >= MAX_UNITS)) return quote(false, 'A named builder is needed while two residents remain available for civilian work.', spec.cost);
  if (!ignoreCost && !enough(state, spec.cost)) return quote(false, `Needs ${costText(spec.cost)}.`, spec.cost);
  return quote(true, 'Materials are reserved now; a named builder completes the site.', spec.cost, { x, z, rotation, work: spec.work });
}
export function canPlaceFortification(state, type, x, z, rotation = 0, ctx = {}) { return placePermission(state, type, x, z, rotation, ctx); }
function ensureEngineer(state, ctx) {
  let unit = state.frontier.units.find(u => u.kind === 'engineer' && alive(u)); if (unit) { if (unit.status === 'returning') unit.status = 'active'; return unit; }
  const citizen = availableCitizens(state).length > 2 ? availableCitizens(state)[0] : null, point = nearestOpen(state, home(ctx), ctx, 6, true); if (!citizen || !point) return null;
  unit = newUnit(state, 'engineer', 'player', point, citizen); unit.order = { type: 'build' }; return unit;
}
function makeSite(state, type, x, z, rotation, cost, ctx, regionId = null) {
  const spec = FORTIFICATIONS[type], f = state.frontier;
  const site = { id: `fort-${f.nextId++}`, type, name: spec.name, faction: 'player', x, z, rotation, status: 'building', hp: 1, maxHp: spec.maxHp, progress: 0, work: spec.work, escrow: { ...cost }, open: type === 'gate', damageAt: null, regionId, completedAt: null, repairing: false };
  f.fortifications.push(site); ensureEngineer(state, ctx); return site;
}
export function placeFortification(state, type, x, z, rotation = 0, ctx = {}) {
  const offer = canPlaceFortification(state, type, x, z, rotation, ctx); if (!offer.ok) return offer;
  spend(state, offer.cost); const fortification = makeSite(state,type,x,z,rotation,offer.cost,ctx); log(state, `${FORTIFICATIONS[type].name} planned at ${x}, ${z}; materials reserved.`, 'construction'); return { ...offer, fortification };
}
export function planWallLine(state, type, from, to, ctx = {}) {
  if (!['wall','gate'].includes(type) || ![from?.x,from?.z,to?.x,to?.z].every(n=>int(n,-256,256)) || (from.x!==to.x && from.z!==to.z)) return quote(false,'Draw a straight horizontal or vertical wall line.');
  const length=Math.abs(to.x-from.x)+Math.abs(to.z-from.z)+1;if(length>24)return quote(false,'Plan at most 24 defense cells at once.');
  const dx=Math.sign(to.x-from.x),dz=Math.sign(to.z-from.z),tiles=[],cost={};
  for(let i=0;i<length;i++){const p={x:from.x+dx*i,z:from.z+dz*i,rotation:dx?0:1};const check=placePermission(state,type,p.x,p.z,p.rotation,ctx,{ignoreCost:true});if(!check.ok)return{...check,tiles:[]};tiles.push(p);for(const[r,n]of Object.entries(check.cost))cost[r]=(cost[r]||0)+n;}
  const planned=tiles.map(p=>({...p,type,status:'building',open:type==='gate',faction:'player'})),draft={...state,frontier:{...state.frontier,fortifications:[...state.frontier.fortifications,...planned]}};
  for(const p of tiles){const check=ctx.canPlaceDefense?.(type,p.x,p.z,p.rotation,{planned});if(check===false||check?.ok===false)return quote(false,check?.reason||'The full wall line would cut off a civilian entrance.',cost,{tiles:[]});const approaches=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dz])=>({x:p.x+dx,z:p.z+dz}));if(!approaches.some(a=>open(draft,a.x,a.z,ctx)&&(key(a)===key(home(ctx))||frontierPath(draft,home(ctx),a,ctx).length)))return quote(false,'This line would leave a construction site without a builder route.',cost,{tiles:[]});}
  return quote(enough(state,cost),enough(state,cost)?`${length} sites; one builder works through them in order.`:`Needs ${costText(cost)}.`,cost,{tiles});
}
export function buildWallLine(state,type,from,to,ctx={}) { const offer=planWallLine(state,type,from,to,ctx);if(!offer.ok)return offer;spend(state,offer.cost);const fortifications=offer.tiles.map(p=>makeSite(state,type,p.x,p.z,p.rotation,FORTIFICATIONS[type].cost,ctx));log(state,`${fortifications.length} ${type} sites planned; one named builder is assigned.`,'construction');return{...offer,fortifications}; }
export function cancelFortification(state,id) {
  const f=state.frontier.fortifications.find(v=>v.id===id);if(!f||f.faction!=='player'||f.status!=='building')return quote(false,'Choose an unfinished player defense.');
  const refund=Object.fromEntries(Object.entries(f.escrow).map(([r,n])=>[r,Math.floor(n*Math.max(0,1-f.progress/f.work))]));reward(state,refund);if(f.repairing){f.hp=Math.min(f.hp,f.repairStartHp);f.status=f.hp>0?'ready':'ruined';f.progress=f.work=FORTIFICATIONS[f.type].work;f.escrow={};f.repairing=false;}else state.frontier.fortifications=state.frontier.fortifications.filter(v=>v!==f);for(const u of state.frontier.units)if(u.targetId===id||u.order.targetId===id||u.breachId===id){u.targetId=null;u.breachId=null;u.order={type:u.kind==='engineer'?'build':'hold'};u.path=[];}state.frontier.projectiles=state.frontier.projectiles.filter(p=>p.targetId!==id);return quote(true,'Unused construction materials recovered.',{}, {refund});
}
export function repairOffer(state,id,ctx={}) {
  const f=state.frontier.fortifications.find(v=>v.id===id);if(!f||f.faction!=='player'||f.status==='building')return quote(false,'Choose a damaged completed defense.');
  const fraction=1-f.hp/f.maxHp,cost=Object.fromEntries(Object.entries(FORTIFICATIONS[f.type].cost).map(([r,n])=>[r,Math.ceil(n*fraction*.6)]).filter(([,n])=>n));
  if(fraction<EPS)return quote(false,'This defense is intact.',cost);
  if(state.frontier.fortifications.some(v=>v!==f&&v.status!=='ruined'&&v.x===f.x&&v.z===f.z))return quote(false,'Another defense now occupies this ruined site.',cost);
  if(state.frontier.units.some(u=>alive(u)&&Math.round(u.x)===f.x&&Math.round(u.z)===f.z))return quote(false,'Let troops clear the ruined defense before repairs begin.',cost);
  return quote(enough(state,cost),enough(state,cost)?'Repair costs materials and takes a builder back to the site.':`Needs ${costText(cost)}.`,cost,{work:Math.max(4,Math.ceil(FORTIFICATIONS[f.type].work*fraction*.6))});
}
export function repairFortification(state,id,ctx={}) {const offer=repairOffer(state,id,ctx);if(!offer.ok)return offer;if(availableCitizens(state).length<=2&&!state.frontier.units.some(u=>u.kind==='engineer'&&alive(u)))return quote(false,'A builder and two available civilians are needed for repairs.',offer.cost);spend(state,offer.cost);const f=state.frontier.fortifications.find(v=>v.id===id);f.repairing=true;f.repairStartHp=f.hp;f.status='building';f.progress=0;f.work=offer.work;f.escrow={...offer.cost};ensureEngineer(state,ctx);return{...offer,fortification:f};}
export function salvageOffer(state,id,ctx={}) {
  const fort=state.frontier.fortifications.find(v=>v.id===id);
  if(!fort||fort.faction!=='player'||!['ready','ruined'].includes(fort.status))return quote(false,'Choose a completed or ruined player defense. Cancel unfinished work instead.');
  if(state.frontier.units.some(u=>alive(u)&&Math.round(u.x)===fort.x&&Math.round(u.z)===fort.z))return quote(false,'Let troops clear this defense before dismantling it.');
  const original={...FORTIFICATIONS[fort.type].cost};if(fort.regionId==='crownhill'){original.stone+=20;original.gold+=25;}
  const nominalRefund=fort.status==='ready'?Object.fromEntries(Object.entries(original).map(([r,n])=>[r,Math.floor(n*.5*fort.hp/fort.maxHp)]).filter(([,n])=>n)):{};
  const refund=Object.fromEntries(Object.entries(nominalRefund).map(([r,n])=>[r,Math.min(n,Math.max(0,(state.storage?.[r]??100000)-(state.resources[r]||0)))]).filter(([,n])=>n));
  return quote(true,fort.regionId?'Dismantle this outpost and revoke the land claim. Existing homes remain; new construction needs another outpost.':fort.status==='ruined'?'Clear these ruins; no reusable materials remain.':'Dismantle this defense and recover up to half its original materials, reduced by damage and available storage.',{}, {refund,nominalRefund,regionId:fort.regionId||null});
}
export function salvageFortification(state,id,ctx={}) {
  const offer=salvageOffer(state,id,ctx);if(!offer.ok)return offer;const fort=state.frontier.fortifications.find(v=>v.id===id);
  const refund=reward(state,offer.refund);state.frontier.fortifications=state.frontier.fortifications.filter(v=>v!==fort);
  if(fort.regionId&&!state.frontier.fortifications.some(v=>v.regionId===fort.regionId&&v.status!=='ruined'&&v.completedAt!==null))state.frontier.claims=state.frontier.claims.filter(r=>r!==fort.regionId);
  for(const u of state.frontier.units){if(u.targetId===id)u.targetId=null;if(u.breachId===id)u.breachId=null;if(u.order.targetId===id){u.order={type:'hold'};u.path=[];}}
  state.frontier.projectiles=state.frontier.projectiles.filter(p=>p.targetId!==id);
  log(state,`${fort.name} dismantled${fort.regionId?'; the land claim was revoked':''}. Recovered ${costText(refund)}.`,'construction');return {...offer,refund};
}
export function setGateOpen(state,id,value,ctx={}) {const f=state.frontier.fortifications.find(v=>v.id===id);if(!f||f.type!=='gate'||f.faction!=='player'||f.status!=='ready'||typeof value!=='boolean')return quote(false,'Choose a completed gate.');if(!value&&state.frontier.units.some(u=>alive(u)&&distance(u,f)<.7))return quote(false,'Let troops clear the gate before closing it.');if(!value){const check=ctx.canCloseGate?.(id);if(check===false||check?.ok===false)return quote(false,check?.reason||'Closing this gate would cut off a civilian entrance.');}f.open=value;for(const u of state.frontier.units)u.path=[];return quote(true,value?'Gate open: everyone can pass, including enemies.':'Gate closed: it blocks movement and arrows.');}

export function commandTroops(state,ids,order,ctx={}) {
  if(!Array.isArray(ids)||!ids.length||!order||!['move','attack','hold','retreat'].includes(order.type))return quote(false,'Choose troops and a valid order.');
  const units=state.frontier.units.filter(u=>ids.includes(u.id)&&u.faction==='player'&&['spearman','archer'].includes(u.kind)&&u.status==='active');if(units.length!==new Set(ids).size)return quote(false,'Only ready player troops accept orders.');
  let target=order.type==='retreat'?{...home(ctx)}:null;
  if(order.type==='move'||(order.type==='attack'&&!order.targetId)){if(!finite(order.x)||!finite(order.z)||!open(state,Math.round(order.x),Math.round(order.z),ctx))return quote(false,'Choose reachable dry ground outside a defense.');target={x:Math.round(order.x),z:Math.round(order.z)};for(const u of units)if(key(u)!==key(target)&&!frontierPath(state,u,target,ctx).length)return quote(false,'A wall, closed gate or terrain blocks that route.');}
  if(order.type==='attack'&&order.targetId){const enemy=state.frontier.units.find(u=>u.id===order.targetId&&alive(u))||state.frontier.fortifications.find(f=>f.id===order.targetId&&f.status!=='ruined');if(!enemy||!hostile(state,'player',enemy.faction))return quote(false,'Choose an enemy; declare war before attacking a settlement.');}
  const formation=[];
  if(target){for(let radius=0;radius<=14&&formation.length<units.length;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;const p={x:target.x+dx,z:target.z+dz};if(open(state,p.x,p.z,ctx)&&!state.frontier.units.some(t=>!units.includes(t)&&alive(t)&&distance(t,p)<.4)&&units.every(u=>key(u)===key(p)||frontierPath(state,u,p,ctx).length))formation.push(p);if(formation.length>=units.length)break;}if(formation.length<units.length)return quote(false,'There is not enough reachable clear ground for this company formation.');}
  for(const[index,u]of units.entries()){u.order={type:order.type,...(formation[index]||target||{}),...(order.targetId?{targetId:order.targetId}:{})};u.path=[];u.targetId=null;u.routeAt=-10;}
  return quote(true,`${units.length} troop${units.length===1?'':'s'}: ${order.type}.`);
}
export function healOffer(state,id,ctx={}) {const u=state.frontier.units.find(u=>u.id===id),cost={food:8,cloth:1};if(!u||u.faction!=='player'||!u.citizenId||!alive(u))return quote(false,'Choose a living resident in frontier service.',cost);if(distance(u,home(ctx))>2)return quote(false,'Retreat to the village footpath for treatment.',cost);if(u.hp>=u.maxHp&&u.status!=='wounded')return quote(false,'This person is healthy.',cost);return quote(enough(state,cost),enough(state,cost)?'Restore health and finish recovery at home.':`Needs ${costText(cost)}.`,cost);}
export function healTroop(state,id,ctx={}) {const offer=healOffer(state,id,ctx);if(!offer.ok)return offer;spend(state,offer.cost);const u=state.frontier.units.find(u=>u.id===id);u.hp=u.maxHp;u.recoveryRemaining=0;u.status='active';u.order={type:isFieldworker(u)?'retreat':'hold'};if(isFieldworker(u))u.missionStage='returning';u.path=[];u.targetId=null;return{...offer,unit:u};}
export function dismissOffer(state,id,ctx={}) {
  const unit=state.frontier.units.find(u=>u.id===id);
  if(!unit||unit.faction!=='player'||!unit.citizenId||!['spearman','archer'].includes(unit.kind)||!alive(unit))return quote(false,'Choose a recruited resident in your company.');
  if(unit.status==='wounded')return quote(false,'This resident must recover before returning to civilian work.');
  if(distance(unit,home(ctx))>2)return quote(false,'Retreat to the village footpath before returning to civilian work.');
  return quote(true,unit.status==='training'?'Cancel training and return this resident to civilian work. Supplies already spent are not refunded.':'Return this resident to civilian work. Training supplies and equipment are not refunded.',{}, {refund:{},citizenId:unit.citizenId});
}
export function dismissTroop(state,id,ctx={}) {
  const offer=dismissOffer(state,id,ctx);if(!offer.ok)return offer;
  const unit=state.frontier.units.find(u=>u.id===id);unit.status='released';unit.path=[];unit.targetId=null;unit.order={type:'hold'};
  log(state,`${unit.name} left the company and returned to civilian work. Equipment and training supplies were not refunded.`,'recruit');
  return {...offer,unit};
}
function neighborTrade(n) {return n.id==='reedbank'?{cost:{wood:18},reward:{food:32,gold:8}}:n.id==='stonehaven'?{cost:{food:20},reward:{stone:26,iron:3}}:{cost:{food:24,gold:8},reward:{tools:6,iron:5}};}
export function neighborOptions(state) {
  return state.frontier.neighbors.map(n=>{const peaceful=n.discovered&&!['war','defeated'].includes(n.status),trading=neighborTrade(n),envoyCost=TROOPS.envoy.cost,truceCost={gold:45,food:15},allianceCost={gold:60,food:20},aidCost={food:15};
    const cargoFits=Object.entries(trading.reward).every(([r,n])=>(state.resources[r]||0)+n<=(state.storage?.[r]??100000)+EPS);
    const baseReason=!n.discovered?'Send an envoy or approach with troops to make contact.':n.status==='war'?'Trade and diplomacy are closed during war.':'',canEnvoy=!n.defeated&&n.status!=='war'&&availableCitizens(state).length>2&&!state.frontier.units.some(u=>alive(u)&&u.missionNeighborId===n.id)&&enough(state,envoyCost);
    return{...n,nextAttackIn:n.nextAttackAt===null?null:Math.max(0,n.nextAttackAt-state.frontier.clock),envoy:quote(canEnvoy,canEnvoy?'A named envoy walks to the settlement and returns; arrival improves relations.':n.status==='war'?'Agree a truce before sending an envoy.':`Need an available resident, no mission already en route, and ${costText(envoyCost)}.`,envoyCost),trade:quote(peaceful&&n.relation>=0&&n.lastTradeDay!==(state.day||1)&&enough(state,trading.cost)&&cargoFits,baseReason||n.lastTradeDay===(state.day||1)?baseReason||'This settlement has traded with you today.':!cargoFits?'Make room in storage for the full quoted cargo.':n.relation<0?'Improve relations with an envoy first.':`Exchange ${costText(trading.cost)} for ${costText(trading.reward)}.`,trading.cost,{reward:trading.reward}),war:quote(n.discovered&&!n.defeated&&n.status!=='war','War closes trade, creates a real enemy garrison and warns of an attack in one day.'),truce:quote(n.status==='war'&&enough(state,truceCost),'Pay reparations to stop attacks and send surviving armies home.',truceCost),alliance:quote(peaceful&&n.status!=='allied'&&n.relation>=35&&n.trades+n.envoys>=3&&enough(state,allianceCost),'Requires 35 relations and three completed exchanges; allies can send real reinforcements.',allianceCost),aid:quote(n.status==='allied'&&state.frontier.clock>=n.aidReadyAt&&state.frontier.units.length<=MAX_UNITS-2&&enough(state,aidCost),'Call two allied spearmen for three days; food and a three-day cooldown apply.',aidCost)};
  });
}
export function sendEnvoy(state,id,citizenId=null,ctx={}) {const n=state.frontier.neighbors.find(n=>n.id===id),offer=neighborOptions(state).find(n=>n.id===id)?.envoy;if(!n||!offer?.ok)return offer||quote(false,'Unknown settlement.');if(state.frontier.units.length>=MAX_UNITS)return quote(false,'The frontier is at its unit limit.',offer.cost);const person=availableCitizens(state).find(c=>!citizenId||c.id===citizenId),point=nearestOpen(state,home(ctx),ctx,6,true),destination=nearestOpen(state,n,ctx,4);if(!person||!point||!destination||!frontierPath(state,point,destination,ctx).length)return quote(false,'No clear land route is available for this envoy.',offer.cost);spend(state,offer.cost);const unit=newUnit(state,'envoy','player',point,person);unit.missionNeighborId=id;unit.missionStage='outbound';unit.order={type:'envoy',x:destination.x,z:destination.z};route(state,unit,destination,ctx);log(state,`${person.name} leaves for ${n.name}. Their civilian work waits until they return.`,'diplomacy');return{...offer,unit};}
export function tradeWithNeighbor(state,id) {const n=state.frontier.neighbors.find(n=>n.id===id),offer=neighborOptions(state).find(n=>n.id===id)?.trade;if(!offer?.ok)return offer||quote(false,'Unknown settlement.');spend(state,offer.cost);const received=reward(state,offer.reward);n.lastTradeDay=state.day||1;n.relation=Math.min(100,n.relation+4);n.trades++;state.frontier.stats.trades++;log(state,`Traded with ${n.name}; relations improved.`,'trade');return{...offer,reward:received};}
function spawnForce(state,faction,point,amount,ctx,{allied=false}={}) {const units=[];for(let i=0;i<amount&&state.frontier.units.length<MAX_UNITS;i++){const p=nearestOpen(state,{x:point.x+(i%3)-1,z:point.z+Math.floor(i/3)},ctx,7,true);if(!p)continue;const kind=i%3===2?'archer':allied?'spearman':'raider',u=newUnit(state,kind,faction,p);if(allied){u.order={type:'attack',x:home(ctx).x,z:home(ctx).z};u.expiresAt=state.frontier.clock+DAY*3;}units.push(u);}return units;}
export function declareWar(state,id,ctx={}) {const n=state.frontier.neighbors.find(n=>n.id===id),offer=neighborOptions(state).find(n=>n.id===id)?.war;if(!offer?.ok)return offer||quote(false,'Unknown settlement.');n.status='war';n.relation=-70;n.nextAttackAt=state.frontier.clock+DAY;state.frontier.stats.deathsThisWave=0;for(const u of spawnForce(state,n.id,n,3,ctx))u.order={type:'hold'};for(const u of state.frontier.units)if(u.allyFrom===id&&alive(u)){u.status='returning';u.order={type:'retreat',x:n.x,z:n.z};u.path=[];}log(state,`War with ${n.name}. Its garrison is armed; an attacking column follows in one day.`,'war');return{...offer,neighbor:n};}
export function offerTruce(state,id) {const n=state.frontier.neighbors.find(n=>n.id===id),offer=neighborOptions(state).find(n=>n.id===id)?.truce;if(!offer?.ok)return offer||quote(false,'Unknown settlement.');spend(state,offer.cost);n.status='truce';n.relation=-5;n.truceUntil=state.frontier.clock+DAY*5;n.nextAttackAt=null;for(const u of state.frontier.units)if(u.faction===id&&alive(u)){u.status='returning';u.order={type:'retreat',x:n.x,z:n.z};u.path=[];}state.frontier.projectiles=state.frontier.projectiles.filter(p=>p.faction!==id&&p.targetFaction!==id);log(state,`A five-day truce with ${n.name}; armies withdraw and trade can resume through diplomacy.`,'peace');return{...offer,neighbor:n};}
export function proposeAlliance(state,id) {const n=state.frontier.neighbors.find(n=>n.id===id),offer=neighborOptions(state).find(n=>n.id===id)?.alliance;if(!offer?.ok)return offer||quote(false,'Unknown settlement.');spend(state,offer.cost);n.status='allied';n.relation=Math.min(100,n.relation+10);log(state,`${n.name} becomes an ally. Reinforcements are available for food.`,'alliance');return{...offer,neighbor:n};}
export function requestAid(state,id,ctx={}) {const n=state.frontier.neighbors.find(n=>n.id===id),offer=neighborOptions(state).find(n=>n.id===id)?.aid;if(!offer?.ok)return offer||quote(false,'Unknown settlement.');spend(state,offer.cost);n.aidReadyAt=state.frontier.clock+DAY*3;const units=spawnForce(state,'player',n,2,ctx,{allied:true});for(const u of units){u.name=`${n.name} ally`;u.allyFrom=n.id;}log(state,`Two allies leave ${n.name} to help defend the village for three days.`,'alliance');return{...offer,units};}
export function claimOptions(state,ctx={}) {return regions(ctx).filter(r=>r.id!=='home').map(r=>{const claimed=state.frontier.claims.includes(r.id),discovered=state.frontier.discoveredRegions.includes(r.id),pending=state.frontier.fortifications.find(f=>f.regionId===r.id&&f.status!=='ruined'),site=nearestOpen(state,r,ctx,3,true),cost={...FORTIFICATIONS.outpost.cost};if(r.id==='crownhill'){cost.stone+=20;cost.gold+=25;}let reason=claimed?'This region is part of the town.':!discovered?'Walk a troop into this region to survey it.':pending?'The claiming outpost is still being built.':!site?'No clear outpost site is available.':state.frontier.units.some(u=>alive(u)&&u.faction!=='player'&&hostile(state,'player',u.faction)&&distance(u,r)<r.radius)?'Clear hostile troops from this region first.':!enough(state,cost)?`Needs ${costText(cost)}.`:'Pay for an outpost; its completed construction opens this region to civilian buildings.';let ok=!claimed&&discovered&&!pending&&!!site&&!reason.startsWith('Clear')&&enough(state,cost);if(ok){const permission=placePermission(state,'outpost',site.x,site.z,0,ctx,{ignoreCost:true,regionId:r.id});if(!permission.ok){ok=false;reason=permission.reason;}}return{...r,claimed,discovered,...quote(ok,reason,cost),site,requirements:['Survey with a troop','Clear nearby hostile troops','Complete an outpost with a named builder']};});}
export function claimRegion(state,id,ctx={}) {const offer=claimOptions(state,ctx).find(r=>r.id===id);if(!offer?.ok)return offer||quote(false,'Unknown claim region.');spend(state,offer.cost);const fortification=makeSite(state,'outpost',offer.site.x,offer.site.z,0,offer.cost,ctx,id);log(state,`${offer.name} outpost funded. Land opens when the builder finishes it.`,'claim');return{...offer,fortification};}

function defenseFactor(state,ctx) {const value=typeof ctx.defenseMultiplier==='function'?ctx.defenseMultiplier(state):ctx.defenseMultiplier;return finite(value)?clamp(value,1,2):1;}
function towerNear(state,u) {return state.frontier.fortifications.find(f=>f.type==='tower'&&f.faction===u.faction&&f.status==='ready'&&distance(f,u)<1.5);}
function die(state,u,casualties) {u.hp=0;u.status='dead';u.deathAt=state.frontier.clock;u.path=[];u.targetId=null;if(u.citizenId){casualties.push(u.citizenId);state.frontier.stats.deaths++;state.frontier.stats.deathsThisWave++;log(state,`${u.name} fell in battle.`,'casualty');}else if(u.faction!=='player')state.frontier.stats.enemiesDefeated++;if(u.faction==='raiders'&&state.frontier.raidActive&&state.frontier.raidOutcome)state.frontier.raidOutcome.killed++;}
function damage(state,target,amount,attacker,ctx,casualties) {
  if(target.kind){if(!alive(target))return;let armor=target.faction==='player'?1/defenseFactor(state,ctx):1;if(towerNear(state,target))armor*=.65;target.hp=round(Math.max(0,target.hp-amount*armor));target.damageAt=state.frontier.clock;
    if(target.hp<=EPS){if(target.citizenId&&target.status!=='wounded'){target.status='wounded';if(isFieldworker(target))target.missionStage='returning';target.hp=1;target.recoveryRemaining=90;target.wounds++;target.order={type:'retreat'};target.path=[];target.targetId=null;state.frontier.stats.wounded++;log(state,`${target.name} is wounded and is trying to withdraw. Treatment is available at home.`,'wounded');}else if(target.citizenId&&((state.citizens?.length||0)-casualties.length<=6||state.frontier.stats.deathsThisWave>=2)){target.hp=1;target.protectedUntil=state.frontier.clock+20;}else die(state,target,casualties);}
  }else{if(target.status==='ruined')return;target.hp=round(Math.max(0,target.hp-amount));target.damageAt=state.frontier.clock;if(target.hp<=EPS){target.status='ruined';target.open=true;target.escrow={};target.repairing=false;state.frontier.stats.wallsBreached++;log(state,`${target.name} has been breached.`,'breach');if(target.faction!=='player'){const n=state.frontier.neighbors.find(n=>n.id===target.faction);if(n&&!n.defeated){n.hp=0;n.defeated=true;n.status='defeated';n.nextAttackAt=null;state.frontier.stats.conquests++;reward(state,{gold:60,stone:30});log(state,`${n.name}'s stronghold falls. Its attacks end; 60 coin and 30 stone are recovered if stores have room.`,'conquest');for(const u of state.frontier.units)if(u.faction===n.id&&alive(u)){u.status='returning';u.order={type:'retreat',x:n.x,z:n.z};u.path=[];}}}else if(target.regionId){state.frontier.claims=state.frontier.claims.filter(id=>id!==target.regionId);log(state,`${target.regionId} outpost lost. Existing homes remain, but new construction needs a repaired outpost.`,'claim');}}}
}
function attack(state,u,target,ctx,casualties) {
  if(u.cooldown>0)return;const spec=TROOPS[u.kind],factor=u.faction==='player'?defenseFactor(state,ctx):1;
  u.attackAt=state.frontier.clock;u.cooldown=spec.interval;u.targetId=target.id;u.yaw=Math.atan2(target.x-u.x,target.z-u.z);
  if(u.kind==='archer'){state.frontier.projectiles.push({id:`arrow-${state.frontier.nextId++}`,from:{x:u.x,z:u.z},to:{x:target.x,z:target.z},faction:u.faction,targetFaction:target.faction,startAt:state.frontier.clock,hitAt:state.frontier.clock+Math.max(.2,distance(u,target)/8),targetId:target.id,damage:spec.damage*factor});}
  else damage(state,target,spec.damage*factor,u,ctx,casualties);
}
function move(state,u,goal,dt,ctx,{breach=false,speed=1}={}) {
  if(distance(u,goal)<.025){u.path=[];return true;}
  if(key(u)===key(goal)&&!fortAt(state,Math.round(goal.x),Math.round(goal.z))){u.path=[{x:Math.round(goal.x),z:Math.round(goal.z)}];u.routeGoal={...goal};u.routeAt=state.frontier.clock;}else if(!u.path.length||state.frontier.clock-u.routeAt>5||!u.routeGoal||key(u.routeGoal)!==key(goal))route(state,u,goal,ctx,breach);
  const step=u.path[0];if(!step)return false;const fort=fortAt(state,step.x,step.z);if(fort){if(breach&&hostile(state,u.faction,fort.faction))u.breachId=fort.id;else u.path=[];return false;}
  if(!baseOpen(state,step.x,step.z,ctx)){u.path=[];return false;}
  const final=u.path.length===1,lane=final?0:.18,dx0=step.x-u.x,dz0=step.z-u.z,tx=final?goal.x:step.x+(Math.abs(dz0)>Math.abs(dx0)?-Math.sign(dz0)*lane:0),tz=final?goal.z:step.z+(Math.abs(dx0)>=Math.abs(dz0)?Math.sign(dx0)*lane:0);
  const dx=tx-u.x,dz=tz-u.z,d=Math.hypot(dx,dz),amount=Math.min(d,TROOPS[u.kind].speed*speed*dt),near=state.frontier.units.filter(t=>t!==u&&alive(t)&&distance(t,u)<1.2),heading=Math.atan2(dz,dx);let chosen=null,best=Infinity;
  for(const angle of [0,.45,-.45,.9,-.9,1.45,-1.45,Math.PI]){const x=u.x+Math.cos(heading+angle)*amount,z=u.z+Math.sin(heading+angle)*amount;if(!clearSegment(state,u,{x,z},ctx))continue;let penalty=0,blocked=false;for(const t of near){const before=distance(u,t),after=Math.hypot(x-t.x,z-t.z);if(after<.29&&after<before-EPS){blocked=true;break;}penalty+=Math.max(0,.4-after)*.5;}if(blocked)continue;const score=Math.hypot(tx-x,tz-z)+penalty+Math.abs(angle)*.012;if(score<best){chosen={x,z};best=score;}}
  if(!chosen)return false;const mx=chosen.x-u.x,mz=chosen.z-u.z;u.x=round(chosen.x);u.z=round(chosen.z);u.yaw=Math.atan2(mx,mz);
  if(Math.hypot(tx-u.x,tz-u.z)<(final?.025:.23)){if(final&&!near.some(t=>Math.hypot(t.x-tx,t.z-tz)<.29)){u.x=tx;u.z=tz;}u.path.shift();}
  if(distance(u,goal)<.025){u.path=[];return true;}return false;
}
function discover(state,u,ctx) {if(u.faction!=='player'||u.status==='training'||!alive(u))return;for(const r of regions(ctx))if(distance(u,r)<Math.max(3,r.radius*.6)&&!state.frontier.discoveredRegions.includes(r.id)){state.frontier.discoveredRegions.push(r.id);log(state,`${u.name} surveyed ${r.name}. An outpost can claim its building land.`,'discovery');}for(const n of state.frontier.neighbors)if(!n.discovered&&distance(u,n)<5){n.discovered=true;log(state,`${u.name} made contact with ${n.name}.`,'discovery');}}
function engineerTick(state,u,dt,ctx) {
  const site=state.frontier.fortifications.find(f=>f.faction==='player'&&f.status==='building');
  if(!site){u.status='returning';u.order={type:'retreat'};if(distance(u,home(ctx))<1.5||move(state,u,home(ctx),dt,ctx)){u.status='released';log(state,`${u.name} finished frontier work and returned to civilian life.`,'construction');}return;}
  u.status='active';u.order={type:'build',targetId:site.id};u.targetId=site.id;
  if(u.buildSite!==site.id||!u.buildGoal||!open(state,u.buildGoal.x,u.buildGoal.z,ctx)){const adjacent=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dz])=>({x:site.x+dx,z:site.z+dz})).filter(p=>open(state,p.x,p.z,ctx)).sort((a,b)=>distance(a,u)-distance(b,u));u.buildGoal=adjacent.find(p=>key(p)===key(u)||frontierPath(state,u,p,ctx).length)||null;u.buildSite=site.id;}
  const goal=u.buildGoal;if(!goal){u.path=[];return;}
  if(distance(u,site)<=1.1){site.progress=round(Math.min(site.work,site.progress+dt));site.hp=round(Math.max(site.hp,site.maxHp*site.progress/site.work));u.path=[];u.yaw=Math.atan2(site.x-u.x,site.z-u.z);if(site.progress>=site.work){site.status='ready';site.hp=site.maxHp;site.escrow={};site.completedAt??=state.frontier.clock;site.repairing=false;log(state,`${site.name} completed.`,'construction');if(site.regionId&&!state.frontier.claims.includes(site.regionId)){state.frontier.claims.push(site.regionId);log(state,`${regions(ctx).find(r=>r.id===site.regionId)?.name||site.regionId} is now open for town construction.`,'claim');}}}else move(state,u,goal,dt,ctx);
}
function envoyTick(state,u,dt,ctx) {const n=state.frontier.neighbors.find(n=>n.id===u.missionNeighborId);if(!n){u.status='returning';u.order={type:'retreat'};return;}if(u.missionStage==='outbound'&&n.status==='war'){u.missionStage='returning';u.order={type:'retreat'};u.path=[];}if(u.missionStage==='outbound'){const goal=nearestOpen(state,n,ctx,4);if(goal&&(distance(u,n)<2.1||move(state,u,goal,dt,ctx))){n.discovered=true;n.relation=Math.min(100,n.relation+12);n.envoys++;state.frontier.stats.missions++;u.missionStage='returning';u.order={type:'retreat'};u.path=[];log(state,`${u.name} reached ${n.name}; relations improved by 12. The envoy is returning.`,'diplomacy');}}else if(distance(u,home(ctx))<1.5||move(state,u,home(ctx),dt,ctx)){u.status='released';log(state,`${u.name} returned from ${n.name}.`,'diplomacy');}}

/** Fieldwork shares the frontier's actual routes and exclusive named labor. */
function fieldApproach(state, spec, from, ctx) {
  const cell=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dz])=>({x:spec.x+dx,z:spec.z+dz}))
    .filter(p=>open(state,p.x,p.z,ctx)).sort((a,b)=>distance(a,from)-distance(b,from))
    .find(p=>key(p)===key(from)||frontierPath(state,from,p,ctx).length);
  // Stand within the open approach cell, close enough to work on the footing.
  // The occupied landmark cell remains blocked to both armies and civilians.
  return cell?{x:cell.x+(spec.x-cell.x)*.32,z:cell.z+(spec.z-cell.z)*.32}:null;
}
export function fieldworkOffer(state,id,mode='survey',ctx={}) {
  const site=state.discovery?.sites.find(s=>s.id===id),spec=discoverySpec(id);
  if(!site||!['survey','restore','salvage'].includes(mode))return quote(false,'Choose a place and a fieldwork task.');
  const cost=mode==='survey'?{food:6}:mode==='restore'&&!site.project?spec.cost:{};
  const people=availableCitizens(state).map(({id,name,job})=>({id,name,job}));
  const extra={availableCitizens:people,duration:fieldworkDuration(site,mode),progress:mode==='survey'?site.surveyProgress:site.progress};
  const fail=reason=>quote(false,reason,cost,extra);
  if(fieldworkerFor(state,id))return fail('A resident is already working on this place.');
  if(mode==='survey'?site.status!=='rumor':site.status!=='surveyed')return fail(mode==='survey'?'This report is already in the fieldbook.':'Bring a survey report home before choosing this place’s future.');
  if(site.project&&site.project!==mode)return fail('This place already has a commissioned project. Resume that work.');
  if(people.length<=2)return fail('Keep at least two residents available for village work.');
  if(state.frontier.units.length>=MAX_UNITS)return fail('There are too many people in frontier service.');
  if(!enough(state,cost))return fail(`Needs ${costText(cost)}.`);
  if(state.frontier.units.some(u=>alive(u)&&hostile(state,'player',u.faction)&&distance(u,spec)<5))return fail('Hostile troops are nearby. Wait until the approach is safe.');
  const destination=fieldApproach(state,spec,home(ctx),ctx);if(!destination)return fail('Open a route from the hearth to this place.');
  return quote(true,mode==='survey'?'Six food provisions the trip. Findings arrive when your surveyor returns.':site.project?'Paid materials and completed work are waiting. No further cost.':mode==='restore'?'Commission this restoration. Materials stay at the site if the worker is recalled.':'Recover these materials instead of restoring the place. Cargo is credited on return, up to available storage.',cost,{...extra,destination});
}
export function sendFieldworker(state,id,mode='survey',citizenId=null,ctx={}) {
  const offer=fieldworkOffer(state,id,mode,ctx);if(!offer.ok)return offer;
  const person=availableCitizens(state).find(c=>!citizenId||c.id===citizenId),point=nearestOpen(state,home(ctx),ctx,6,true);
  if(!person||!point)return quote(false,'That resident is unavailable or the hearth approach is blocked.',offer.cost);
  const destination=fieldApproach(state,discoverySpec(id),point,ctx);if(!destination)return quote(false,'This resident has no open route to the place.',offer.cost);
  const site=state.discovery.sites.find(s=>s.id===id);spend(state,offer.cost);if(mode!=='survey')site.project=mode;
  const unit=newUnit(state,mode==='survey'?'explorer':'restorer','player',point,person);
  Object.assign(unit,{missionSiteId:id,missionMode:mode,missionStage:'outbound',missionComplete:false,order:{type:'fieldwork'}});
  route(state,unit,destination,ctx);log(state,`${person.name} leaves to ${mode==='survey'?'survey':mode==='restore'?'restore':'recover materials from'} ${discoverySpec(id).name.toLowerCase()}.`,'fieldwork');
  return {...offer,unit,reason:`${person.name} is on the way. Their village job waits until they return.`};
}
export function recallFieldworker(state,id) {
  const u=state.frontier.units.find(u=>u.id===id&&isFieldworker(u)&&alive(u));if(!u)return quote(false,'Choose a resident who is still in the field.');
  u.missionStage='returning';u.order={type:'retreat'};u.path=[];u.routeAt=-10;
  return quote(true,`${u.name} is heading home${u.missionComplete?' with the completed report':'; site progress and paid materials are kept'}.`);
}
function fieldworkTick(state,u,dt,ctx) {
  const site=state.discovery.sites.find(s=>s.id===u.missionSiteId),spec=discoverySpec(site.id);u.fieldBlocked=false;
  if(u.missionStage!=='returning'&&state.frontier.units.some(t=>alive(t)&&hostile(state,'player',t.faction)&&distance(u,t)<5)){
    recallFieldworker(state,u.id);log(state,`${u.name} spotted danger and is returning from ${spec.name.toLowerCase()}. The unfinished work will wait.`,'fieldwork');
  }
  if(u.missionStage==='returning'){
    if(distance(u,home(ctx))<1.3||move(state,u,home(ctx),dt,ctx)){
      if(u.missionComplete){
        if(u.missionMode==='survey'){site.status='surveyed';site.reportedBy=u.name;site.reportedDay=state.day;log(state,`${u.name} brought home the story of ${spec.name.toLowerCase()}. Open the fieldbook to decide its future.`,'field-report');}
        else {site.status=u.missionMode==='restore'?'restored':'salvaged';site.finishedBy=u.name;site.finishedDay=state.day;if(u.missionMode==='salvage')site.received=reward(state,spec.salvage);log(state,`${u.name} ${u.missionMode==='restore'?`restored ${spec.name.toLowerCase()}. ${spec.benefit}`:`returned from ${spec.name.toLowerCase()} with ${costText(site.received)}.`}`,'field-complete');}
      }else log(state,`${u.name} is home. Work at ${spec.name.toLowerCase()} can be resumed.`,'fieldwork');
      u.status='released';u.path=[];
    }else u.fieldBlocked=!u.path.length;return;
  }
  const goal=fieldApproach(state,spec,u,ctx);if(!goal){u.path=[];u.fieldBlocked=true;return;}
  if(distance(u,goal)>.025){u.missionStage='outbound';const reached=move(state,u,goal,dt,ctx);u.fieldBlocked=!reached&&!u.path.length;return;}
  u.missionStage='working';u.path=[];u.yaw=Math.atan2(spec.x-u.x,spec.z-u.z);
  const field=u.missionMode==='survey'?'surveyProgress':'progress',duration=fieldworkDuration(site,u.missionMode);
  site[field]=round(Math.min(duration,site[field]+dt));
  const citizen=state.citizens.find(c=>c.id===u.citizenId);if(citizen)citizen.experience[u.kind]=Math.min(72000,(citizen.experience[u.kind]||0)+dt);
  if(site[field]>=duration){u.missionComplete=true;u.missionStage='returning';u.order={type:'retreat'};u.path=[];log(state,`${u.name} finished at ${spec.name.toLowerCase()} and is bringing the report home.`,'fieldwork');}
}

function combatTick(state,u,dt,ctx,casualties) {
  const spec=TROOPS[u.kind];u.cooldown=Math.max(0,u.cooldown-dt);const h=home(ctx);
  if(u.expiresAt&&state.frontier.clock>=u.expiresAt){u.status='returning';u.order={type:'retreat',...(state.frontier.neighbors.find(n=>n.id===u.allyFrom)||h)};u.path=[];}
  if(u.status==='returning'||u.order.type==='retreat'){const goal=u.faction==='player'&&!u.allyFrom?(u.order.x!==undefined?u.order:h):nearestOpen(state,u.order.x!==undefined?u.order:state.frontier.neighbors.find(n=>n.id===u.faction)||h,ctx,5);if(goal&&(move(state,u,goal,dt,ctx)||(u.status==='returning'&&distance(u,goal)<1.4))){if(u.status==='returning'){u.status='released';if(u.faction==='raiders'&&state.frontier.raidActive&&state.frontier.raidOutcome)state.frontier.raidOutcome.escaped++;}else u.order={type:'hold'};}return;}
  const range=spec.range+(u.kind==='archer'&&towerNear(state,u)?2:0);
  const explicit=u.order.type==='attack'&&u.order.targetId?(state.frontier.units.find(t=>t.id===u.order.targetId&&alive(t))||state.frontier.fortifications.find(t=>t.id===u.order.targetId&&t.status!=='ruined')):null;
  if(u.order.type==='attack'&&u.order.targetId&&!explicit){u.order={type:'hold'};u.targetId=null;u.path=[];}
  const candidates=state.frontier.units.filter(t=>alive(t)&&t.status!=='training'&&(!t.protectedUntil||t.protectedUntil<=state.frontier.clock)&&hostile(state,u.faction,t.faction)&&distance(u,t)<=range+2).sort((a,b)=>distance(u,a)-distance(u,b)||a.id.localeCompare(b.id));
  let target=explicit&&hostile(state,u.faction,explicit.faction)?explicit:candidates[0];
  if(u.breachId){const fort=state.frontier.fortifications.find(f=>f.id===u.breachId&&f.status!=='ruined');if(fort)target=fort;else u.breachId=null;}
  if(target){u.targetId=target.id;const d=distance(u,target),stronghold=target.id.startsWith('settlement-'),reach=range+(stronghold?1.15:target.kind?0:.5);if(d<=reach&&lineOfSight(state,u,target,ctx)){attack(state,u,target,ctx,casualties);u.path=[];return;}if(u.order.type!=='hold'){const theta=Math.atan2(u.z-target.z,u.x-target.x),radius=reach*.91,goals=[0,.55,-.55,1.1,-1.1,Math.PI].map(angle=>({x:target.x+Math.cos(theta+angle)*radius,z:target.z+Math.sin(theta+angle)*radius})).filter(p=>baseOpen(state,Math.round(p.x),Math.round(p.z),ctx)&&!fortAt(state,Math.round(p.x),Math.round(p.z))&&!state.frontier.units.some(t=>t!==u&&t!==target&&alive(t)&&distance(t,p)<.32));const goal=goals.find(p=>key(u)===key(p)||frontierPath(state,u,p,ctx,{faction:u.faction,breach:u.faction!=='player'}).length);if(goal)move(state,u,goal,dt,ctx,{breach:u.faction!=='player'});return;}}
  u.targetId=null;if(u.order.type==='hold')return;
  const goal=u.order.x!==undefined?{x:u.order.x,z:u.order.z}:h;
  if(u.faction!=='player'&&distance(u,h)<1.4){const cost={food:Math.min(6,state.resources.food||0),gold:Math.min(4,state.resources.gold||0)};spend(state,cost);const lost=Object.values(cost).reduce((a,b)=>a+b,0);state.frontier.stats.cargoLost+=lost;if(u.faction==='raiders'&&state.frontier.raidActive&&state.frontier.raidOutcome)state.frontier.raidOutcome.cargoLost=round(state.frontier.raidOutcome.cargoLost+lost);u.status='returning';u.order={type:'retreat',...(state.frontier.neighbors.find(n=>n.id===u.faction)||ctx.raiderSpawn||{x:0,z:-25})};u.path=[];log(state,'A raider reached the stores and is withdrawing with up to 6 food and 4 coin.','raid');return;}
  if(move(state,u,goal,dt,ctx,{breach:u.faction!=='player'})&&u.faction==='player')u.order={type:'hold'};
}
function step(state,dt,ctx,events,casualties) {
  const f=state.frontier;f.clock=round(f.clock+dt);const beforeLog=f.nextLogId;
  if(f.nextRaidAt===null&&!f.raidActive&&!f.warning&&(f.claims.length>1||f.neighbors.some(n=>n.envoys>0||n.status==='war')))f.nextRaidAt=f.clock+DAY*3;
  if(!f.warning&&!f.raidActive&&f.nextRaidAt!==null&&f.clock>=f.nextRaidAt){const amount=Math.min(8,2+Math.floor((state.population||state.citizens?.length||0)/20));f.warning={id:`raid-${f.nextId++}`,source:'raiders',announcedAt:f.clock,attackAt:f.clock+DAY*2,amount,entry:{...(ctx.raiderSpawn||{x:0,z:-24})}};log(state,`Lookouts warn of ${amount} raiders arriving in two days. Close gates, train defenders, or meet them on the road.`,'warning');}
  if(f.warning&&f.clock>=f.warning.attackAt){const raiders=spawnForce(state,'raiders',f.warning.entry,f.warning.amount,ctx);f.raidOutcome={spawned:raiders.length,killed:0,escaped:0,cargoLost:0,uncertain:false,completed:false};f.warning=null;f.raidActive=true;f.stats.deathsThisWave=0;f.nextRaidAt=null;log(state,'Raiders have landed. Their troops are moving toward the village stores.','battle');}
  for(const n of f.neighbors){if(n.status==='truce'&&f.clock>=n.truceUntil)n.status='neutral';if(n.status==='war'&&n.nextAttackAt!==null&&f.clock>=n.nextAttackAt){spawnForce(state,n.id,n,3,ctx);n.nextAttackAt=f.clock+DAY*3;f.stats.deathsThisWave=0;log(state,`${n.name}'s attacking column is on the road. Another is expected in three days unless peace or conquest ends the war.`,'battle');}}
  for(const p of [...f.projectiles])if(f.clock>=p.hitAt){const target=f.units.find(u=>u.id===p.targetId&&alive(u))||f.fortifications.find(v=>v.id===p.targetId&&v.status!=='ruined');if(target&&hostile(state,p.faction,target.faction)&&distance(target,p.to)<=.8)damage(state,target,p.damage,{faction:p.faction},ctx,casualties);f.projectiles=f.projectiles.filter(v=>v!==p);}
  for(const u of [...f.units]){
    if(!alive(u))continue;discover(state,u,ctx);
    if(u.status==='training'){u.trainingRemaining=round(Math.max(0,u.trainingRemaining-dt));if(!u.trainingRemaining){u.status='active';log(state,`${u.name} is ready for orders.`,'training');}continue;}
    if(u.status==='wounded'){if(distance(u,home(ctx))<1.5){u.recoveryRemaining=round(Math.max(0,u.recoveryRemaining-dt));u.hp=Math.max(1,round(u.maxHp*(1-u.recoveryRemaining/90)));if(!u.recoveryRemaining){u.status='active';u.hp=u.maxHp;u.order={type:isFieldworker(u)?'retreat':'hold'};log(state,`${u.name} recovered at home and can return to service.`,'recovery');}}else move(state,u,home(ctx),dt,ctx,{speed:.5});continue;}
    if(isFieldworker(u))fieldworkTick(state,u,dt,ctx);else if(u.kind==='engineer')engineerTick(state,u,dt,ctx);else if(u.kind==='envoy')envoyTick(state,u,dt,ctx);else combatTick(state,u,dt,ctx,casualties);
  }
  if(f.raidActive&&!f.units.some(u=>u.faction==='raiders'&&alive(u))){f.raidActive=false;f.nextRaidAt=f.clock+DAY*5;const outcome=f.raidOutcome,defeated=outcome&&!outcome.uncertain&&outcome.spawned>0&&outcome.killed===outcome.spawned&&outcome.escaped===0;if(outcome)outcome.completed=true;if(defeated)f.stats.raidsDefeated++;log(state,`${defeated?'The raiding force was defeated.':`The raid ended${outcome?` with ${outcome.escaped} escaped and ${round(outcome.cargoLost)} supplies lost`:''}.`} The coast has five quiet days before another warning.`,'battle');}
  for(const n of f.neighbors){const fort=f.fortifications.find(v=>v.id===`settlement-${n.id}`);if(fort)n.hp=fort.hp;}
  f.units=f.units.filter(u=>u.status!=='released'&&(u.status!=='dead'||f.clock-u.deathAt<30));
  const liveIds=new Set([...f.units,...f.fortifications].map(v=>v.id));for(const u of f.units){if(u.targetId&&!liveIds.has(u.targetId))u.targetId=null;if(u.breachId&&!liveIds.has(u.breachId))u.breachId=null;if(u.order.targetId&&!liveIds.has(u.order.targetId)){u.order={type:'hold'};u.path=[];}}f.projectiles=f.projectiles.filter(p=>liveIds.has(p.targetId));
  for(const event of f.log.filter(e=>Number(e.id.slice(13))>=beforeLog).reverse())events.push(event);
}
export function tickFrontier(state,dt,ctx={}) {
  if(!finite(dt)||dt<0||dt>3600)throw new Error('Invalid frontier tick duration');if(!state.frontier)state.frontier=createFrontierState(ctx);
  const events=[],casualties=[],f=state.frontier,signature=()=>JSON.stringify([f.units.map(u=>[u.id,u.x,u.z,u.hp,u.status,u.trainingRemaining,u.recoveryRemaining,u.order,u.attackAt]),f.fortifications.map(v=>[v.id,v.status,v.hp,v.progress,v.open]),f.warning,f.claims,f.discoveredRegions,f.nextLogId,f.projectiles]);const before=signature();f.subsecond=round(f.subsecond+dt);let steps=0;
  while(f.subsecond+EPS>=STEP){f.subsecond=round(Math.max(0,f.subsecond-STEP));step(state,STEP,ctx,events,casualties);steps++;}
  return{events,casualties:[...new Set(casualties)],changed:before!==signature(),steps};
}
export function frontierOptions(state,ctx={}) {const f=state.frontier||createFrontierState(ctx);return{...f,reservedCitizens:reservedCitizenIds(state),activeBattles:f.units.filter(u=>alive(u)&&u.faction!=='player'&&hostile(state,'player',u.faction)).length,training:f.units.filter(u=>u.status==='training').length,wounded:f.units.filter(u=>u.status==='wounded').length,readyTroops:f.units.filter(u=>u.faction==='player'&&battleReady(u)).length,claims:[...f.claims],log:[...f.log]};}

/** Defensive save validation. Canonical costs, HP limits and neighbor geography are never trusted from saves. */
export function normalizeFrontier(state,ctx={}) {
  if(state.frontier===undefined){state.frontier=createFrontierState(ctx);return state.frontier;}
  const f=state.frontier,fail=()=>{throw new Error('Invalid frontier save');},validPoint=p=>p&&finite(p.x)&&finite(p.z)&&Math.abs(p.x)<=256&&Math.abs(p.z)<=256;
  if(!f||f.version!==1||!finite(f.clock)||f.clock<0||!finite(f.subsecond)||f.subsecond<0||f.subsecond>=STEP||!int(f.nextId,1,100000000)||!int(f.nextLogId,1,100000000)||!Array.isArray(f.units)||f.units.length>MAX_UNITS||!Array.isArray(f.fortifications)||f.fortifications.length>MAX_FORTS||!Array.isArray(f.neighbors)||f.neighbors.length!==definitions(ctx).length)fail();
  const citizenIds=new Set((state.citizens||[]).map(c=>c.id)),ids=new Set(),reserved=new Set(),validFactions=new Set(['player','raiders',...definitions(ctx).map(n=>n.id)]),validRegions=new Set(regions(ctx).map(r=>r.id));let highestId=0;
  const validBag=bag=>bag&&typeof bag==='object'&&!Array.isArray(bag)&&Object.entries(bag).every(([r,n])=>Object.hasOwn(state.resources||{},r)&&finite(n)&&n>=0&&n<=100000);
  for(const u of f.units){const spec=Object.hasOwn(TROOPS,u?.kind)?TROOPS[u.kind]:null;if(!spec||typeof u.id!=='string'||ids.has(u.id)||!validFactions.has(u.faction)||!validPoint(u)||!finite(u.yaw)||!['training','active','wounded','returning','dead','released'].includes(u.status)||u.maxHp!==spec.maxHp||!finite(u.hp)||u.hp<0||u.hp>u.maxHp||!finite(u.cooldown)||u.cooldown<0||u.cooldown>spec.interval+EPS||!finite(u.trainingRemaining)||u.trainingRemaining<0||u.trainingRemaining>spec.trainingSeconds||!finite(u.recoveryRemaining)||u.recoveryRemaining<0||u.recoveryRemaining>90||!u.order||!['hold','move','attack','retreat','build','envoy','fieldwork','raid'].includes(u.order.type)||!Array.isArray(u.path)||u.path.length>6500||!u.path.every(p=>validPoint(p)&&Number.isInteger(p.x)&&Number.isInteger(p.z)))fail();ids.add(u.id);if(u.citizenId){if(u.faction!=='player'||(alive(u)&&(!citizenIds.has(u.citizenId)||reserved.has(u.citizenId))))fail();if(alive(u))reserved.add(u.citizenId);}if(u.order.x!==undefined&&!validPoint(u.order))fail();if(u.routeGoal!==null&&u.routeGoal!==undefined&&!validPoint(u.routeGoal))fail();for(const t of ['attackAt','damageAt','deathAt'])if(u[t]!==null&&(!finite(u[t])||u[t]<0||u[t]>f.clock+EPS))fail();if(u.expiresAt!==undefined&&(!finite(u.expiresAt)||u.expiresAt<0))fail();if(u.protectedUntil!==undefined&&(!finite(u.protectedUntil)||u.protectedUntil<0||u.protectedUntil>f.clock+20+EPS))fail();}
  for(const u of f.units){if(!/^unit-[1-9]\d*$/.test(u.id)||typeof u.name!=='string'||u.name.length>120||!baseOpen(state,Math.round(u.x),Math.round(u.z),ctx))fail();highestId=Math.max(highestId,Number(u.id.slice(5)));if(u.status==='dead'?u.hp!==0:u.hp<=0)fail();if(!finite(u.routeAt)||u.routeAt>f.clock||u.routeAt< -10||!int(u.wounds,0,100000))fail();if(u.faction!=='player'&&u.citizenId)fail();if(u.faction==='player'&&!u.citizenId&&(!definitions(ctx).some(n=>n.id===u.allyFrom)||!finite(u.expiresAt)))fail();if(u.kind==='envoy'&&!definitions(ctx).some(n=>n.id===u.missionNeighborId))fail();if(u.trainingSeconds!==(u.citizenId?TROOPS[u.kind].trainingSeconds:0))fail();let previous={x:Math.round(u.x),z:Math.round(u.z)},blockedCache=false;const bounds=ctx.bounds||FRONTIER_BOUNDS;for(const p of u.path){if(!int(p.x,bounds.minX,bounds.maxX)||!int(p.z,bounds.minZ,bounds.maxZ)||Math.abs(p.x-previous.x)+Math.abs(p.z-previous.z)>1)fail();if(!baseOpen(state,p.x,p.z,ctx))blockedCache=true;previous=p;}if(blockedCache){u.path=[];u.routeAt=-10;}if(u.order.x!==undefined&&(!int(u.order.x,-256,256)||!int(u.order.z,-256,256)))fail();}
  const occupied=new Set();for(const fort of f.fortifications){const spec=Object.hasOwn(FORTIFICATIONS,fort?.type)?FORTIFICATIONS[fort.type]:null,maxHp=fort?.faction==='player'?spec?.maxHp:360;if(!spec||typeof fort.id!=='string'||ids.has(fort.id)||!validFactions.has(fort.faction)||fort.faction==='raiders'||!validPoint(fort)||!Number.isInteger(fort.x)||!Number.isInteger(fort.z)||!int(fort.rotation,0,3)||!['building','ready','ruined'].includes(fort.status)||fort.maxHp!==maxHp||!finite(fort.hp)||fort.hp<0||fort.hp>maxHp||!finite(fort.progress)||fort.progress<0||!finite(fort.work)||fort.work<0||fort.work>90||fort.progress>fort.work+EPS||!validBag(fort.escrow)||typeof fort.open!=='boolean')fail();ids.add(fort.id);if(fort.status!=='ruined'){if(occupied.has(key(fort)))fail();occupied.add(key(fort));}if(fort.regionId!==null&&fort.regionId!==undefined&&!validRegions.has(fort.regionId))fail();if(fort.status==='building'){const cap=fort.regionId==='crownhill'?{...spec.cost,stone:spec.cost.stone+20,gold:spec.cost.gold+25}:spec.cost;for(const[r,n]of Object.entries(fort.escrow))if(n>(cap[r]||0))fail();if(fort.work<=0)fail();}else if(fort.status==='ruined')fort.escrow={};else if(Object.values(fort.escrow).some(n=>n>0))fail();}
  for(const fort of f.fortifications){if(fort.faction==='player'){if(!/^fort-[1-9]\d*$/.test(fort.id)||!baseOpen(state,fort.x,fort.z,ctx)||definitions(ctx).some(n=>distance(fort,n)<2.3))fail();highestId=Math.max(highestId,Number(fort.id.slice(5)));if(fort.completedAt!==null&&(!finite(fort.completedAt)||fort.completedAt<0||fort.completedAt>f.clock))fail();if(typeof fort.repairing!=='boolean')fail();if(fort.repairing&&(!finite(fort.repairStartHp)||fort.repairStartHp<0||fort.repairStartHp>fort.maxHp))fail();}else if(fort.id!==`settlement-${fort.faction}`)fail();if(fort.status==='ruined'&&fort.hp!==0)fail();if(fort.damageAt!==null&&(!finite(fort.damageAt)||fort.damageAt<0||fort.damageAt>f.clock))fail();}
  const neighborIds=new Set();for(const n of f.neighbors){const canonical=definitions(ctx).find(v=>v.id===n.id);if(neighborIds.has(n.id))fail();neighborIds.add(n.id);if(!canonical||n.x!==canonical.x||n.z!==canonical.z||typeof n.discovered!=='boolean'||!finite(n.relation)||n.relation< -100||n.relation>100||!['neutral','allied','war','truce','defeated'].includes(n.status)||!int(n.envoys,0,100000)||!int(n.trades,0,100000)||!int(n.lastTradeDay,0,state.day||100000)||!finite(n.aidReadyAt)||n.aidReadyAt<0||!finite(n.truceUntil)||n.truceUntil<0||typeof n.defeated!=='boolean'||n.maxHp!==360||!finite(n.hp)||n.hp<0||n.hp>360)fail();if(n.nextAttackAt!==null&&(!finite(n.nextAttackAt)||n.nextAttackAt<0))fail();const fort=f.fortifications.find(v=>v.id===`settlement-${n.id}`);if(!fort||fort.x!==n.x||fort.z!==n.z||fort.hp!==n.hp||fort.faction!==n.id)fail();}
  for(const field of ['claims','discoveredRegions'])if(!Array.isArray(f[field])||f[field].length>regions(ctx).length||new Set(f[field]).size!==f[field].length||!f[field].includes('home')||f[field].some(id=>!validRegions.has(id)))fail();
  for(const id of f.claims)if(id!=='home'&&!f.fortifications.some(v=>v.regionId===id&&v.status!=='ruined'&&v.completedAt!==null&&v.faction==='player'))fail();
  if(!Array.isArray(f.projectiles)||f.projectiles.length>500||!Array.isArray(f.log)||f.log.length>80||!f.stats||!Object.keys(emptyStats()).every(k=>k==='cargoLost'?finite(f.stats[k])&&f.stats[k]>=0&&f.stats[k]<=10000000:int(f.stats[k],0,10000000))||typeof f.raidActive!=='boolean'||!int(f.builderTarget,1,4))fail();
  for(const p of f.projectiles)if(typeof p.id!=='string'||!validPoint(p.from)||!validPoint(p.to)||!validFactions.has(p.faction)||!validFactions.has(p.targetFaction)||!finite(p.startAt)||p.startAt<0||p.startAt>f.clock||!finite(p.hitAt)||p.hitAt<p.startAt||p.hitAt>f.clock+20||!finite(p.damage)||p.damage<0||p.damage>30||typeof p.targetId!=='string')fail();
  for(const p of f.projectiles){if(!/^arrow-[1-9]\d*$/.test(p.id)||ids.has(p.id)||!ids.has(p.targetId))fail();ids.add(p.id);highestId=Math.max(highestId,Number(p.id.slice(6)));}if(f.nextId<=highestId)fail();
  for(const u of f.units){if(u.order.targetId!==undefined&&(typeof u.order.targetId!=='string'||!ids.has(u.order.targetId)))fail();if(u.targetId!==null&&u.targetId!==undefined&&(typeof u.targetId!=='string'||!ids.has(u.targetId)))fail();}
  const logIds=new Set();let highestLog=0;for(const e of f.log){if(!e||typeof e.id!=='string'||!/^frontier-log-[1-9]\d*$/.test(e.id)||logIds.has(e.id)||typeof e.text!=='string'||e.text.length>1000||!finite(e.time)||e.time<0||e.time>f.clock||typeof e.type!=='string')fail();logIds.add(e.id);highestLog=Math.max(highestLog,Number(e.id.slice(13)));}if(f.nextLogId<=highestLog)fail();
  if(f.nextRaidAt!==null&&(!finite(f.nextRaidAt)||f.nextRaidAt<0))fail();if(f.warning){const w=f.warning;if(typeof w.id!=='string'||!/^raid-[1-9]\d*$/.test(w.id)||f.nextId<=Number(w.id.slice(5))||w.source!=='raiders'||!finite(w.announcedAt)||w.announcedAt<0||w.attackAt!==w.announcedAt+DAY*2||w.attackAt<f.clock||!int(w.amount,2,8)||!validPoint(w.entry))fail();}
  if(!Object.hasOwn(f,'raidOutcome')){const raiders=f.units.filter(u=>u.faction==='raiders');f.raidOutcome=f.raidActive?{spawned:raiders.length,killed:raiders.filter(u=>u.status==='dead').length,escaped:0,cargoLost:0,uncertain:true,completed:false}:null;}
  if(f.raidOutcome!==null){const r=f.raidOutcome;if(!r||!int(r.spawned,0,8)||!int(r.killed,0,r.spawned)||!int(r.escaped,0,r.spawned)||r.killed+r.escaped>r.spawned||!finite(r.cargoLost)||r.cargoLost<0||r.cargoLost>r.spawned*10+EPS||typeof r.uncertain!=='boolean'||typeof r.completed!=='boolean'||r.completed===f.raidActive)fail();if(f.raidActive&&f.units.filter(u=>u.faction==='raiders'&&alive(u)).length!==r.spawned-r.killed-r.escaped)fail();if(r.completed&&!r.uncertain&&r.killed+r.escaped!==r.spawned)fail();}else if(f.raidActive)fail();
  for(const n of f.neighbors){const canonical=definitions(ctx).find(v=>v.id===n.id);n.name=canonical.name;n.temper=canonical.temper;}
  for(const u of f.units){const citizen=state.citizens.find(c=>c.id===u.citizenId);if(citizen)u.name=citizen.name;else if(!u.citizenId)u.name=u.allyFrom?`${f.neighbors.find(n=>n.id===u.allyFrom).name} ally`:TROOPS[u.kind].name;}
  for(const fort of f.fortifications)fort.name=fort.faction==='player'?FORTIFICATIONS[fort.type].name:f.neighbors.find(n=>n.id===fort.faction).name;
  return f;
}
