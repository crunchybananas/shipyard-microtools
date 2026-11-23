import { blocksFortification, gateTransition, FORTIFICATIONS } from './frontier.js';
import { ISLAND_BOUNDS, isLand, hasNaturalObstacle } from './island.js';
import { TREE_SITES, treeState, SAPLING_SECONDS, woodlandOccupancy } from './woodland.js';
import { BUILDINGS, JOBS } from './catalog.js';
import { validId, validTownName } from './coop-state.js';

export const WORLD_VERSION = 1;
export const PLOT_STEP = 112;
export const SCOUT_RADIUS = 11;
export const SCOUT_SPEED = 3;
export const ENTRY = Object.freeze({ x: 0, z: 8 });
export const SECTOR_SIZE = 8;
export const MAX_VIEW_BYTES = 262144;
const finite = Number.isFinite;
const round = n => Math.round(n * 100) / 100;
export const slotKey = (x,z) => `${x}_${z}`;
export const sectorKey = (x,z) => `${Math.floor(x/SECTOR_SIZE)}_${Math.floor(z/SECTOR_SIZE)}`;
export const validGrid = n => Number.isInteger(n) && n >= -1024 && n <= 1023;
export function plotBounds(claim) {
  return { minX: claim.gx*PLOT_STEP+ISLAND_BOUNDS.minX, maxX: claim.gx*PLOT_STEP+ISLAND_BOUNDS.maxX,
    minZ: claim.gz*PLOT_STEP+ISLAND_BOUNDS.minZ, maxZ: claim.gz*PLOT_STEP+ISLAND_BOUNDS.maxZ };
}
export function insidePlot(x,z,claim) { const b=plotBounds(claim); return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ; }
export function wildernessAt(seed,x,z,claims=[]) {
  if (claims.some(c=>insidePlot(x,z,c))) return null;
  // Integer hash: the same ground outside claims on every client, independent of town saves.
  let n=(Math.imul(Math.floor(x),374761393)^Math.imul(Math.floor(z),668265263)^seed)>>>0;
  n=Math.imul(n^(n>>>13),1274126177)>>>0; n=(n^(n>>>16))>>>0;
  return { kind:n%31===0?'rock':n%7<3?'tree':'grass', scale:.7+(n%100)/150, turn:(n%628)/100 };
}
export function scoutRoute(home,target) {
  const ax=home.gx*PLOT_STEP,az=home.gz*PLOT_STEP+13,bx=target.gx*PLOT_STEP,bz=target.gz*PLOT_STEP+13;
  // Corridors between fixed plots stay in shared wilderness, even when intervening towns are offline.
  return [{x:ax,z:az},{x:ax,z:az+5},{x:ax+56,z:az+5},{x:ax+56,z:bz+5},{x:bx,z:bz+5},{x:bx,z:bz}];
}
export function routePoint(route,fraction) {
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.z-route[i].z));
  let distance=Math.max(0,Math.min(1,fraction))*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++){const length=lengths[i];if(distance<=length&&length>0){const t=distance/length;return{x:route[i].x+(route[i+1].x-route[i].x)*t,z:route[i].z+(route[i+1].z-route[i].z)*t};}distance-=length;}
  return route.at(-1);
}
export function restoreObservedWorld(value) {
  if (value===undefined || value===null) return null;
  if (!value || value.version!==1 || !validId(value.worldId)||!validId(value.uid)||!validId(value.townId)
      ||!validTownName(value.name)||!validGrid(value.gx)||!validGrid(value.gz)||!Number.isInteger(value.seed)||value.seed<0||value.seed>4294967295
      || !['create','join','ready'].includes(value.phase)) throw new Error('Invalid world link');
  return { version:1, worldId:value.worldId, uid:value.uid,townId:value.townId,name:value.name,
    gx:value.gx,gz:value.gz,seed:value.seed,phase:value.phase };
}
export function canImportObservedWorld(current,next) {
  const a=current.networkWorld,b=next.networkWorld;
  if(a&&(!b||['worldId','uid','townId'].some(key=>a[key]!==b[key])))return{ok:false,reason:'This backup would lose this town’s world claim. Import a backup made after joining the same world.'};
  return{ok:true};
}
export function parseWorldInvite(text) {
  try { let value=String(text).trim(); if(value.includes('://')) value=new URLSearchParams(new URL(value).hash.slice(1)).get('world')||'';
    const [id,x,z,...rest]=value.split('.');return validId(id)&&rest.length===0&&validGrid(Number(x))&&validGrid(Number(z))&&x!==undefined&&z!==undefined?{worldId:id,gx:Number(x),gz:Number(z)}:null;
  } catch {return null;}
}
export function validClaim(c) {return !!c&&validId(c.uid)&&validId(c.townId)&&validTownName(c.name)&&validGrid(c.gx)&&validGrid(c.gz)&&c.sector===sectorKey(c.gx,c.gz);}
export function isPresent(p,now=Date.now()) {return !!p && typeof p.endpoint==='string'&&/^[a-f0-9]{64}$/.test(p.endpoint)&&typeof p.ticket==='string'&&p.ticket.length<4096&&validId(p.session)&&new Date(p.expiresAt).getTime()>now;}

/** One host-authoritative scout per visiting endpoint. Requests never supply their own sight radius. */
export function createScoutHost({getState, actors=()=>[], now=()=>performance.now(), canObserve=()=>true}) {
  const scouts=new Map();
  function handle(peer, request) {
    const time=now();
    for(const [id,s] of scouts) if(time-s.last>15000) scouts.delete(id);
    if(!canObserve()) {scouts.clear();return {kind:'fog',reason:'Town offline'};}
    if(!request||request.version!==1||!['observe','recall'].includes(request.kind)) return {kind:'error',reason:'Unsupported visit'};
    if(request.kind==='recall'){scouts.delete(peer);return {kind:'recalled'};}
    let scout=scouts.get(peer);
    if(!scout){if(scouts.size>=4)return {kind:'busy',reason:'Four scouts are already visiting. Try again shortly.'};scout={...ENTRY,path:[],last:time,seq:0,command:null};scouts.set(peer,scout);}
    const state=getState(),dt=Math.min(2,Math.max(0,(time-scout.last)/1000));scout.last=time;
    if(request.target&&finite(request.target.x)&&finite(request.target.z)) {
      const destination={x:Math.round(request.target.x),z:Math.round(request.target.z)};
      const key=`${destination.x},${destination.z}`;
      if(key!==scout.command){scout.path=scoutPath(state,scout,destination);scout.command=key;}
    }
    if(scout.path.some(p=>state.buildings.some(b=>b.x===p.x&&b.z===p.z)||(state.frontier?.fortifications||[]).some(f=>f.x===p.x&&f.z===p.z&&blocksFortification(f))))scout.path=[];
    let remaining=SCOUT_SPEED*dt;
    while(scout.path.length&&remaining>0){const next=scout.path[0],d=Math.hypot(next.x-scout.x,next.z-scout.z);if(d<=remaining){scout.x=next.x;scout.z=next.z;remaining-=d;scout.path.shift();}else{scout.x+=(next.x-scout.x)*remaining/d;scout.z+=(next.z-scout.z)*remaining/d;remaining=0;}}
    return publicObservation(state,scout,actors(),++scout.seq);
  }
  return {handle,clear:()=>scouts.clear(),positions:()=>[...scouts.values()].filter(s=>now()-s.last<15000).map(s=>({x:s.x,z:s.z})),get count(){return scouts.size;}};
}
export function scoutPath(state,start,end) {
  const sx=Math.round(start.x),sz=Math.round(start.z),occupied=new Set(state.buildings.map(b=>`${b.x},${b.z}`));
  const pass=(x,z)=>isLand(x,z)&&!occupied.has(`${x},${z}`)&&!hasNaturalObstacle(x,z)&&!(state.frontier?.fortifications||[]).some(f=>f.x===x&&f.z===z&&blocksFortification(f));
  if(!pass(end.x,end.z))return [];
  const queue=[{x:sx,z:sz}],seen=new Map([[`${sx},${sz}`,null]]);let found=null;
  for(let i=0;i<queue.length&&i<8000;i++){const p=queue[i];if(p.x===end.x&&p.z===end.z){found=p;break;}
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,key=`${x},${z}`;if(!seen.has(key)&&pass(x,z)&&(!state.frontier||gateTransition(state,p,{x,z}))){seen.set(key,p);queue.push({x,z});}}}
  if(!found)return [];
  const path=[];while(found){path.push(found);found=seen.get(`${found.x},${found.z}`);}path.reverse();return path;
}
export function publicObservation(state,scout,actors=[],seq=1) {
  const near=p=>Math.hypot(p.x-scout.x,p.z-scout.z)<=SCOUT_RADIUS;
  const occupied=woodlandOccupancy(state);
  return { version:1,kind:'view',seq,scout:{x:round(scout.x),z:round(scout.z)},radius:SCOUT_RADIUS,
    buildings:state.buildings.filter(near).slice(0,256).map(b=>({id:b.id,type:b.type,x:b.x,z:b.z,rotation:b.rotation||0,level:b.level||1,status:b.status,
      progress:round(b.progress||0),restored:!!b.restored})),
    forts:(state.frontier?.fortifications||[]).filter(near).slice(0,256).map(f=>({id:f.id,type:f.type,x:f.x,z:f.z,rotation:f.rotation||0,status:f.status,open:!!f.open,progress:round(f.status==='building'?Math.min(1,(f.progress||0)/Math.max(1,f.work||1)):1)})),
    trees:TREE_SITES.filter(t=>near(t)&&!occupied.has(`${t.tile.x},${t.tile.z}`)).slice(0,1024).map(t=>({id:t.id,x:round(t.x),z:round(t.z),scale:round(t.s),growth:treeState(state,t.id).growth<0?-1:round(treeState(state,t.id).growth/SAPLING_SECONDS)})),
    people:actors.filter(near).slice(0,256).map(a=>({id:String(a.id).slice(0,48),x:round(a.x),z:round(a.z),heading:round(a.heading||0),working:!!a.working,job:Object.hasOwn(JOBS,a.job)?a.job:'idle',pose:Array.isArray(a.pose)&&a.pose.length===4?a.pose.map(r=>r.map(round)):[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]})),
  };
}
/** Host data is untrusted input to the renderer; never merge it into a local save. */
export function validateObservation(v) {
  if(!v||v.version!==1||v.kind!=='view'||!Number.isSafeInteger(v.seq)||v.seq<1||v.radius!==SCOUT_RADIUS||!point(v.scout))return null;
  const near=p=>point(p)&&Math.hypot(p.x-v.scout.x,p.z-v.scout.z)<=SCOUT_RADIUS+.1;
  const list=(a,max,valid)=>Array.isArray(a)&&a.length<=max&&a.every(valid)&&new Set(a.map(i=>i.id)).size===a.length;
  const id=p=>typeof p.id==='string'&&p.id.length>0&&p.id.length<80;
  if(!list(v.buildings,256,b=>id(b)&&near(b)&&Object.hasOwn(BUILDINGS,b.type)&&Number.isInteger(b.level)&&b.level>=1&&b.level<=4&&finite(b.rotation)&&Math.abs(b.rotation)<=7&&['ready','building','upgrading'].includes(b.status)&&finite(b.progress)&&b.progress>=0&&b.progress<1e7&&typeof b.restored==='boolean')
    ||!list(v.forts,256,f=>id(f)&&near(f)&&Object.hasOwn(FORTIFICATIONS,f.type)&&Number.isInteger(f.rotation)&&f.rotation>=0&&f.rotation<=3&&['ready','building','ruined'].includes(f.status)&&typeof f.open==='boolean'&&finite(f.progress)&&f.progress>=0&&f.progress<=1)
    ||!list(v.trees,1024,t=>id(t)&&near(t)&&finite(t.scale)&&t.scale>=.1&&t.scale<=2&&finite(t.growth)&&t.growth>=-1&&t.growth<=1)
    ||!list(v.people,256,p=>id(p)&&near(p)&&finite(p.heading)&&Math.abs(p.heading)<100&&typeof p.working==='boolean'&&(p.job==='idle'||Object.hasOwn(JOBS,p.job))&&Array.isArray(p.pose)&&p.pose.length===4&&p.pose.every(r=>Array.isArray(r)&&r.length===3&&r.every(a=>finite(a)&&Math.abs(a)<100))))return null;
  return v;
}
function point(p){return p&&finite(p.x)&&finite(p.z)&&p.x>=ISLAND_BOUNDS.minX&&p.x<=ISLAND_BOUNDS.maxX&&p.z>=ISLAND_BOUNDS.minZ&&p.z<=ISLAND_BOUNDS.maxZ;}
