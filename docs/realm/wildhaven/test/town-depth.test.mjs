import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { RESEARCH, startResearch, fundResearch, pauseResearch, cancelResearch, tickProgression } from '../js/progression.js';
import { researchPlan } from '../js/research-projects.js';
import { mineralStatus, extractMinerals, restoreMinerals, depositFraction } from '../js/minerals.js';
import { buyLivestock, sellLivestock, herdStatus, setBreeding, tickLivestock, restoreLivestock } from '../js/livestock.js';
import { CALENDAR_DAY_SECONDS } from '../js/calendar.js';
import { DISCOVERIES, discoveryModifier } from '../js/discovery.js';
const stocked=()=>{const s=sim.createGame();for(const k of Object.keys(s.resources))s.resources[k]=500;s.research.completed=Object.keys(RESEARCH);return s;};
function ready(s,type,x=2,z=0){const r=sim.build(s,type,x,z);assert.ok(r.ok,r.reason);for(let i=0;i<300&&r.building.status!=='ready';i++)sim.tick(s,1);assert.equal(r.building.status,'ready');sim.pauseBuilding(s,'hearth',true);sim.setPriority(s,r.building.id,0);sim.refreshTown(s);return r.building;}
const roundtrip=s=>{const r=sim.restore(sim.serialize(s));assert.ok(r,'valid town must reload');return r;};

test('partial contributions are reserved exactly once, pause persists, and cancellation returns only the current stage',()=>{
 const s=stocked();s.resources.stone=20;s.research.completed=[];startResearch(s,'joinery');s.resources.wood=2;const before={...s.resources};
 assert.ok(fundResearch(s).ok);assert.equal(s.resources.wood,0);assert.equal(s.research.active.delivered.wood,2);const saved=roundtrip(s);
 tickProgression(saved,100,{researchRate:1});assert.equal(saved.research.active.progress,0);assert.equal(fundResearch(saved).ok,false);
 saved.resources.wood=10;fundResearch(saved);pauseResearch(saved,true);const paused=roundtrip(saved);tickProgression(paused,100,{researchRate:1});assert.equal(paused.research.active.progress,0);
 pauseResearch(paused,false);tickProgression(paused,100,{researchRate:1});assert.equal(paused.research.active.stage,1);assert.equal(paused.research.active.progress,25);assert.deepEqual(paused.research.active.delivered,{});
 const stock={...paused.resources};fundResearch(paused);assert.ok(cancelResearch(paused).ok);assert.deepEqual(paused.resources,stock);assert.equal(paused.resources.knowledge,before.knowledge-4);assert.equal(cancelResearch(paused).ok,false);
});
test('all research requires its full three-stage budget and cannot skip a delivery with a large tick',()=>{
 for(const[id,spec]of Object.entries(RESEARCH)){
  const s=stocked();s.research.completed=s.research.completed.filter(v=>v!==id);const original={...s.resources};assert.ok(startResearch(s,id).ok);
  for(let stage=0;stage<3;stage++){assert.equal(s.research.active.stage,stage);assert.ok(fundResearch(s).ok);tickProgression(s,100000,{researchRate:1});}
  assert.equal(s.research.active,null);assert.ok(s.research.completed.includes(id));
  const costs=researchPlan(id,spec).reduce((sum,step)=>{for(const[k,n]of Object.entries(step.cost))sum[k]=(sum[k]||0)+n;return sum;},{});
  for(const[k,n]of Object.entries(costs))assert.equal(s.resources[k],original[k]-n,`${id} ${k}`);
 }
});
test('paid legacy projects finish without another charge; older saves gain new systems and places without losing discoveries',()=>{
 const s=stocked();s.research.completed=[];s.research.active={id:'joinery',progress:74,duration:75,startedDay:1};
 const raw=JSON.parse(sim.serialize(s));delete raw.minerals;delete raw.livestock;raw.discovery.version=1;raw.discovery.sites=raw.discovery.sites.slice(0,4);
 const loaded=sim.restore(JSON.stringify(raw));assert.ok(loaded);const stock={...loaded.resources};assert.equal(loaded.research.active.fundingVersion,0);tickProgression(loaded,2,{researchRate:1});assert.equal(loaded.research.active,null);assert.deepEqual(loaded.resources,stock);assert.equal(loaded.discovery.sites.length,6);assert.deepEqual(loaded.minerals.deposits,{});assert.deepEqual(loaded.livestock.pens,{});
 const bad=structuredClone(raw);bad.discovery.sites.pop();assert.equal(sim.restore(JSON.stringify(bad)),null);
});
test('corrupt research pledges are rejected and a full store cannot silently discard a returned pledge',()=>{
 const s=stocked();s.research.completed=[];startResearch(s,'joinery');fundResearch(s);
 for(const edit of [a=>a.delivered.wood=1e9,a=>a.stage=4,a=>a.progress=74,a=>a.delivered.magic=1]){const raw=JSON.parse(sim.serialize(s));edit(raw.research.active);assert.equal(sim.restore(JSON.stringify(raw)),null);}
 s.resources.wood=s.storage.wood;const before=sim.serialize(s);assert.equal(cancelResearch(s).ok,false);assert.equal(sim.serialize(s),before);
});
test('nearby mineral works share finite reserves; rebuilding and reload cannot refill the ground',()=>{
 let s=stocked();const a={type:'quarry',x:3,z:0,level:1},b={...a,x:4};const first=mineralStatus(s,a);assert.ok(first.available>0);const common=first.sites.filter(d=>mineralStatus(s,b).sites.some(n=>n.id===d.id));assert.ok(common.length);
 const count=extractMinerals(s,a,1e6);assert.equal(count,first.available);assert.equal(extractMinerals(s,a,10),0);assert.ok(mineralStatus(s,b).available<mineralStatus(stocked(),b).available);
 s=roundtrip(s);assert.equal(mineralStatus(s,{...a,id:'replacement'}).available,0);assert.ok(depositFraction(s,first.sites[0].id)<1);
 assert.equal(mineralStatus(s,{...a,level:2}).available,first.capacity);assert.equal(extractMinerals(s,{...a,level:2},1e6),first.capacity);assert.equal(mineralStatus(s,{...a,level:3}).available,0);
 s.research.completed=[];assert.equal(mineralStatus(s,{...a,level:2}).available,0);
 assert.throws(()=>restoreMinerals({version:1,deposits:{[first.sites[0].id]:{ore:1e6}}}));
});
test('production inspection consumes no rock and a full store stops extraction',()=>{
 const s=stocked(),b=ready(s,'quarry',3,0);const before=JSON.stringify(s.minerals);for(let i=0;i<10;i++){sim.buildingYield(s,b.type,b.x,b.z);sim.refreshTown(s);}assert.equal(JSON.stringify(s.minerals),before);
 s.resources.stone=s.storage.stone;sim.tick(s,4);assert.equal(JSON.stringify(s.minerals),before);
 s.resources.stone=0;sim.tick(s,4);assert.ok(s.resources.stone>0);assert.notEqual(JSON.stringify(s.minerals),before);
});
test('animals cost coin, need grain and keepers, and keep eating with a full pantry',()=>{
 const s=stocked(),b=ready(s,'pasture');const gold=s.resources.gold;assert.ok(buyLivestock(s,b).ok);assert.equal(s.resources.gold,gold-12);sim.refreshTown(s);
 const grain=s.resources.grain;s.resources.food=s.storage.food;sim.tick(s,5);assert.ok(s.resources.grain<grain);assert.equal(herdStatus(s,b).herd.condition,1);
 s.resources.grain=0;const food=s.resources.food;sim.tick(s,20);assert.ok(herdStatus(s,b).herd.condition<1);assert.equal(s.resources.food,food);assert.match(b.production.blockedReason,/grain/);
 const adults=herdStatus(s,b).adults;assert.equal(adults,1);assert.ok(roundtrip(s));
});
test('young animals are born and mature over calendar days, with pauses for breeding and poor care',()=>{
 const s=stocked(),b=ready(s,'pasture');buyLivestock(s,b);buyLivestock(s,b);b.production={efficiency:1};
 for(let i=0;i<3*CALENDAR_DAY_SECONDS-1;i++)tickLivestock(s,1);assert.equal(herdStatus(s,b).total,2);tickLivestock(s,1);assert.equal(herdStatus(s,b).young,1);
 setBreeding(s,b,false);for(let i=0;i<2*CALENDAR_DAY_SECONDS-1;i++)tickLivestock(s,1);assert.equal(herdStatus(s,b).young,1);tickLivestock(s,1);assert.equal(herdStatus(s,b).young,0);assert.equal(herdStatus(s,b).total,3);
 b.production={efficiency:0};tickLivestock(s,CALENDAR_DAY_SECONDS);assert.equal(herdStatus(s,b).herd.condition,0);assert.equal(herdStatus(s,b).total,3);assert.ok(roundtrip(s));
});
test('occupied pens cannot be demolished; upgrades preserve animals and empty demolition leaves a valid save',()=>{
 const s=stocked(),b=ready(s,'henhouse');buyLivestock(s,b);const animals=structuredClone(herdStatus(s,b).herd.animals);assert.equal(sim.demolish(s,b.id).ok,false);
 assert.ok(sim.queueUpgrade(s,b.id).ok);assert.ok(sim.cancelConstruction(s,b.id).ok);assert.deepEqual(herdStatus(s,b).herd.animals,animals);assert.ok(roundtrip(s));
 assert.ok(sellLivestock(s,b).ok);assert.ok(sim.demolish(s,b.id).ok);assert.equal(s.livestock.pens[b.id],undefined);assert.ok(roundtrip(s));
 assert.throws(()=>restoreLivestock({version:1,pens:{ghost:{}}},s.buildings));
});
test('new restored discoveries improve the corresponding real producers, while rumors give no bonus',()=>{
 const s=stocked();for(const[id,type]of [['croft','pasture'],['survey','assay']]){assert.equal(discoveryModifier(s,type),1);s.discovery.sites.find(d=>d.id===id).status='restored';assert.ok(discoveryModifier(s,type)>1);assert.ok(DISCOVERIES.find(d=>d.id===id).types.includes(type));}
});

test('Stores lists animal food sources and grain sinks even when their herd is empty or hungry',async()=>{
 const {resourceDetails}=await import('../js/resource-details.js');const s=stocked(),b=ready(s,'henhouse');
 assert.ok(resourceDetails(s,'food').producerTypes.includes('henhouse'));assert.ok(resourceDetails(s,'food').sources.some(v=>v.id===b.id&&v.rate===0));
 buyLivestock(s,b);sim.refreshTown(s);assert.ok(resourceDetails(s,'grain').sinks.some(v=>v.id===b.id&&v.rate>0));
 s.resources.grain=0;sim.refreshTown(s);assert.ok(resourceDetails(s,'food').sources.some(v=>v.id===b.id&&/grain/.test(v.reason)));
});

test('the final fraction of stone is paid once and production stops on exhaustion',()=>{
 const s=stocked(),b=ready(s,'quarry',3,0);s.resources.stone=0;const available=mineralStatus(s,b).available;extractMinerals(s,b,available-.03);sim.tick(s,5);
 assert.ok(Math.abs(s.resources.stone-.03)<1e-6);assert.equal(mineralStatus(s,b).available,0);assert.match(b.production.blockedReason,/exhausted/);sim.tick(s,5);assert.ok(Math.abs(s.resources.stone-.03)<1e-6);assert.ok(roundtrip(s));
});

test('both new expeditions physically return their reports and restoration benefits survive reload',async()=>{
 const {sendFieldworker}=await import('../js/frontier.js');
 for(const id of ['croft','survey']){
  const s=stocked(),site=s.discovery.sites.find(v=>v.id===id),spec=DISCOVERIES.find(v=>v.id===id);
  for(const[mode,status]of [['survey','surveyed'],['restore','restored']]){
   const result=sendFieldworker(s,id,mode,null,sim.frontierContext(s));assert.ok(result.ok,result.reason);
   let seconds=0;while(site.status!==status&&seconds<900){sim.tick(s,1);seconds++;}assert.equal(site.status,status,`${id} ${mode} returns home`);assert.ok(roundtrip(s));
  }
  assert.ok(discoveryModifier(s,spec.types[0])>1);
 }
});
