import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,serialize,restore} from '../js/sim.js';
import {coopId} from '../js/coop-state.js';
import {TREE_SITES,createWoodland} from '../js/woodland.js';
import {canImportObservedWorld,scoutRoute,routePoint,wildernessAt,insidePlot,plotBounds,restoreObservedWorld,createScoutHost,publicObservation,validateObservation,SCOUT_RADIUS,parseWorldInvite} from '../js/observed-state.js';
test('shared wilderness is deterministic and never regenerates any claimed town',()=>{
  const claim={gx:-1,gz:2},bounds=plotBounds(claim);assert.equal(insidePlot(bounds.minX,bounds.minZ,claim),true);
  for(let n=0;n<100;n++){const x=n*3,z=n*7;assert.deepEqual(wildernessAt(27,x,z),wildernessAt(27,x,z));}
  assert.equal(wildernessAt(27,bounds.minX,bounds.minZ,[claim]),null);assert.notEqual(wildernessAt(27,bounds.minX-1,bounds.minZ,[claim]),null);
});
test('town changes inside the border are observed from the owner and never expose private state',()=>{
  const s=createGame(),site=TREE_SITES.find(t=>Math.hypot(t.x,t.z)<9);s.woodland=createWoodland();s.resources.wood=123;
  s.woodland.trees[site.id]={wood:0,growth:-1,planting:0};const a=publicObservation(s,{x:site.x,z:site.z},[{id:'c1',x:site.x,z:site.z,heading:0}]);
  assert.equal(a.trees.find(t=>t.id===site.id).growth,-1);assert.equal(a.resources,undefined);assert.equal(a.coop,undefined);assert.equal(a.people[0].name,undefined);assert.ok(validateObservation(a));
  s.woodland.trees[site.id].growth=100;const b=publicObservation(s,{x:site.x,z:site.z});assert.ok(b.trees.find(t=>t.id===site.id).growth>0);
  a.trees.push({...a.trees[0]});assert.equal(validateObservation(a),null);
});
test('the host owns scout speed, sight and expiry; offline views reveal nothing',()=>{
  let now=0,online=true;const s=createGame(),host=createScoutHost({getState:()=>s,now:()=>now,canObserve:()=>online});
  let view=host.handle('a',{version:1,kind:'observe',target:{x:40,z:-50},radius:1000});assert.equal(view.radius,SCOUT_RADIUS);assert.deepEqual(view.scout,{x:0,z:8});
  now=1000;view=host.handle('a',{version:1,kind:'observe',target:{x:0,z:4}});assert.ok(Math.hypot(view.scout.x,view.scout.z-8)<=3.01);
  online=false;assert.deepEqual(host.handle('a',{version:1,kind:'observe'}),{kind:'fog',reason:'Town offline'});assert.equal(host.count,0);
});
test('the directory link survives backup without connection credentials or remote town data',()=>{
  const s=createGame();s.networkWorld={version:1,worldId:coopId(),uid:coopId(),townId:coopId(),name:'Willow',gx:0,gz:-1,seed:32,phase:'ready'};
  assert.deepEqual(restore(serialize(s)).networkWorld,s.networkWorld);assert.throws(()=>restoreObservedWorld({...s.networkWorld,gx:0.5}));
  assert.deepEqual(parseWorldInvite(`${s.networkWorld.worldId}.0.-1`),{worldId:s.networkWorld.worldId,gx:0,gz:-1});assert.equal(parseWorldInvite('missing'),null);
});
test('reject observations with distant objects, invalid models and nonfinite values',()=>{
  const s=createGame(),v=publicObservation(s,{x:0,z:8});assert.ok(validateObservation(v));const bad=structuredClone(v);bad.buildings[0].type='__proto__';assert.equal(validateObservation(bad),null);
  const far=structuredClone(v);far.people=[{id:'a',x:40,z:-50,heading:0,working:false}];assert.equal(validateObservation(far),null);
  const nan=structuredClone(v);nan.scout.x=NaN;assert.equal(validateObservation(nan),null);
});

test('scouts cross wilderness corridors without entering intervening offline plots',()=>{
 const claims=[];for(let gx=-3;gx<=3;gx++)for(let gz=-3;gz<=3;gz++)claims.push({gx,gz});
 for(const target of claims){const route=scoutRoute({gx:0,gz:0},target);for(let i=0;i<=100;i++){const p=routePoint(route,i/100);assert.equal(claims.some(c=>insidePlot(p.x,p.z,c)),false);}}
});

test('scouts see actual walls and gate state without bypassing a closed gate',()=>{
  const s=createGame();s.frontier.fortifications.push({id:'test-gate',type:'gate',x:0,z:6,rotation:0,status:'ready',open:false,progress:12,work:12});
  let now=0;const host=createScoutHost({getState:()=>s,now:()=>now});
  host.handle('a',{version:1,kind:'observe'});now=1000;
  const closed=host.handle('a',{version:1,kind:'observe',target:{x:0,z:6}});assert.equal(closed.scout.z,8);assert.equal(closed.forts.find(f=>f.id==='test-gate').open,false);assert.ok(validateObservation(closed));
  s.frontier.fortifications.at(-1).open=true;now=2000;host.handle('a',{version:1,kind:'observe',target:{x:0,z:5}});now=3000;
  const opened=host.handle('a',{version:1,kind:'observe',target:{x:0,z:6}});assert.equal(opened.scout.z,6);assert.equal(opened.forts.find(f=>f.id==='test-gate').open,true);assert.ok(validateObservation(opened));
  const invalid=structuredClone(opened);invalid.forts[0].type='__proto__';assert.equal(validateObservation(invalid),null);
});

test('backup import cannot erase or replace an existing world claim',()=>{
 const networkWorld={worldId:coopId(),uid:coopId(),townId:coopId()};
 assert.equal(canImportObservedWorld({networkWorld},{}).ok,false);
 assert.equal(canImportObservedWorld({networkWorld},{networkWorld:{...networkWorld,worldId:coopId()}}).ok,false);
 assert.equal(canImportObservedWorld({networkWorld},{networkWorld:{...networkWorld}}).ok,true);
 assert.equal(canImportObservedWorld({},{networkWorld}).ok,true);
});
