import { isLand, terrainAt, coastDistance, hasNaturalObstacle, neighborAt, ISLAND_BOUNDS } from './island.js';
import { frontierPath, gateTransition, blocksFortification } from './frontier.js';

export const CATCH_SIZE = 6;
const CAST_SECONDS = 8;
const HEARTH = { x: 0, z: 3 };
const directions = [[0,1],[1,0],[0,-1],[-1,0]];
const same = (a,b) => a.x === b.x && a.z === b.z;
const paths = new WeakMap();

export function pierOrientations(x,z) {
  if (!isLand(x,z) || terrainAt(x,z).kind === 'path' || neighborAt(x,z) ||
      hasNaturalObstacle(x,z) || Math.hypot(x-2,z-8.7)<2.5) return [];
  // The front is the shore entrance. The deck projects one tile behind it.
  return directions.map(([dx,dz],rotation)=>({dx,dz,rotation}))
    .filter(({dx,dz})=> isLand(x+dx,z+dz) && !isLand(x-dx,z-dz) &&
      !isLand(x-dx+dz*.33,z-dz-dx*.33) && !isLand(x-dx-dz*.33,z-dz+dx*.33))
    .sort((a,b)=>coastDistance(x+b.dx,z+b.dz)-coastDistance(x+a.dx,z+a.dz))
    .map(d=>d.rotation);
}
export function pierPoint(pier,offset) {
  const [dx,dz]=directions[pier.rotation];
  return {x:pier.x+dx*offset,z:pier.z+dz*offset};
}
export function newFishingTrip() {
  return {stage:'outbound',x:HEARTH.x,z:HEARTH.z,next:null,step:0,wait:0,catch:0,landed:0,routeLength:0,worker:null};
}
export function restoreFishingTrip(raw) {
  if (raw===undefined) return newFishingTrip();
  const point=p=>p && Number.isInteger(p.x) && Number.isInteger(p.z) &&
    p.x>=ISLAND_BOUNDS.minX-1 && p.x<=ISLAND_BOUNDS.maxX+1 && p.z>=ISLAND_BOUNDS.minZ-1 && p.z<=ISLAND_BOUNDS.maxZ+1;
  if (!raw || !point(raw) || !['outbound','casting','returning','unloading'].includes(raw.stage) ||
      ![0,1].includes(raw.step) || !(raw.next===null || point(raw.next) && Math.abs(raw.next.x-raw.x)+Math.abs(raw.next.z-raw.z)===1) ||
      !Number.isInteger(raw.wait) || raw.wait<0 || raw.wait>CAST_SECONDS ||
      ![raw.catch,raw.landed,raw.routeLength].every(n=>Number.isFinite(n)&&n>=0) || raw.catch>50 ||
      !(raw.worker===null || /^c[1-9]\d*$/.test(raw.worker))) throw Error('Invalid fishing trip');
  const {stage,x,z,next,step,wait:hold,catch:load,landed,routeLength,worker}=raw;
  return {stage,x,z,next:next&&{x:next.x,z:next.z},step,wait:hold,catch:load,landed,routeLength,worker};
}
export function fishingRate(pier) {
  const length=pier.trip?.routeLength || Math.abs(pier.x-HEARTH.x)+Math.abs(pier.z-HEARTH.z)+2;
  return CATCH_SIZE*90/(4*length+CAST_SECONDS+2);
}
export function fishingActivity(pier) {
  const trip=pier.trip;
  if(pier.paused) return 'Fishing paused';
  if(!pier.workerIds?.length) return pier.desiredWorkers?'Waiting for an available fisher':'Assign a fisher to work this pier';
  if(!trip) return 'Heading to the pier';
  if(trip.stage==='casting') return 'Fishing off the end of the pier';
  if(trip.stage==='unloading') return trip.wait?'Unloading the catch at the hearth':'Waiting for room in the food store';
  if(!trip.next && trip.worker) return 'Looking for a clear path';
  return trip.stage==='returning'?'Carrying fish to the hearth':'Walking to the pier';
}
function laneOpen(state,from,to,ctx) {
  return ctx.isWalkable(to.x,to.z) && gateTransition(state,from,to) &&
    !state.frontier.fortifications.some(f=>f.x===to.x && f.z===to.z && blocksFortification(f));
}
function nextStep(state,pier,trip,ctx) {
  const entrance=pierPoint(pier,1), tip=pierPoint(pier,-1), outbound=trip.stage==='outbound';
  if((outbound && same(trip,entrance)) || (!outbound && same(trip,tip))) return {x:pier.x,z:pier.z};
  if(same(trip,pier)) return outbound?tip:entrance;
  const goal=outbound?entrance:HEARTH;
  let path=paths.get(trip);
  if(!path?.length || !same(path.at(-1),goal) || !same(path[0],trip)) {
    path=[{x:trip.x,z:trip.z},...frontierPath(state,trip,goal,ctx)];
    paths.set(trip,path);
  }
  const next=path[1];
  if(!next) return null;
  if(!laneOpen(state,trip,next,ctx)) {
    paths.delete(trip);return null;
  }
  if(same(trip,HEARTH) && outbound) trip.routeLength=path.length+1;
  path.shift();
  return {x:next.x,z:next.z};
}
// The simulation owns the basket and the walking leg. The renderer interpolates
// the same leg between ticks, including the last step into the town store.
export function tickPier(state,pier,ctx,catchSize,deliver) {
  const worker=pier.workerIds[0];
  if(pier.status!=='ready'||pier.paused||!worker) return;
  const trip=pier.trip ||= newFishingTrip();
  if(trip.worker!==worker) {
    const {landed,catch:basket}=trip;
    Object.assign(trip,newFishingTrip(),{worker,landed,catch:basket});
    paths.delete(trip);
  }
  if(trip.stage==='casting') {
    if(--trip.wait>0) return;
    trip.catch ||= catchSize;
    trip.stage='returning';
  } else if(trip.stage==='unloading') {
    trip.wait=Math.max(0,trip.wait-1);
    if(trip.wait) return;
    const received=deliver(trip.catch);
    trip.catch=Math.max(0,Math.round((trip.catch-received)*1e6)/1e6);
    trip.landed=Math.round((trip.landed+received)*1e6)/1e6;
    if(trip.catch>0) return;
    trip.stage='outbound';
  } else if(trip.next) {
    // A building or gate can close a lane after the fisher sets off.
    const onDeck=same(trip,pier)||same(trip.next,pier);
    if(!onDeck && !laneOpen(state,trip,trip.next,ctx)) {
      paths.delete(trip);trip.next=nextStep(state,pier,trip,ctx);trip.step=0;return;
    }
    if(++trip.step<2) return;
    Object.assign(trip,trip.next);trip.next=null;trip.step=0;
    if(trip.stage==='outbound'&&same(trip,pierPoint(pier,-1))) {
      trip.stage='casting';trip.wait=trip.catch?1:CAST_SECONDS;return;
    }
    if(trip.stage==='returning'&&same(trip,HEARTH)) {
      trip.stage='unloading';trip.wait=2;return;
    }
  }
  trip.next=nextStep(state,pier,trip,ctx);
}
export function fisherPosition(pier,subsecond) {
  const trip=pier.trip || newFishingTrip(), f=trip.next?(trip.step+subsecond)/2:0;
  return {x:trip.x+(trip.next?trip.next.x-trip.x:0)*f,z:trip.z+(trip.next?trip.next.z-trip.z:0)*f};
}
