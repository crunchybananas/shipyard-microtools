import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import * as f from '../js/frontier.js';
import { CROPS, GATHERING, gardenState, chooseCrop, tickGardens, regionKnown, regionReachable, coastalPacts } from '../js/hinterland.js';
import { CALENDAR_DAY_SECONDS as DAY } from '../js/calendar.js';
import { dailyPressure, cargoThreshold } from '../js/pressure.js';
function send(state,kind,id){const q=f.sendJourney(state,kind,id,sim.frontierContext(state));assert.ok(q.ok,q.reason);sim.refreshTown(state);return q.unit;}
function home(state,u,limit=900){for(let i=0;i<limit&&state.frontier.units.some(v=>v.id===u.id);i++)sim.tick(state,1);assert.ok(!state.frontier.units.some(v=>v.id===u.id),`${u.name} must return within ${limit} seconds`);}
function garden(){const s=sim.createGame(),place=sim.listTiles().find(t=>sim.canBuild(s,'garden',t.x,t.z).ok),q=sim.build(s,'garden',place.x,place.z);assert.ok(q.ok);sim.tick(s,20);return[s,q.building];}
test('a named peaceful scout reserves real labor and charts only after bringing the report home',()=>{
 let s=sim.createGame();const food=s.resources.food,u=send(s,'survey','pineward');assert.equal(s.resources.food,food-6);assert.equal(s.citizens.find(c=>c.id===u.citizenId).job,'ranger');
 assert.equal(regionKnown(s,'pineward'),false);assert.equal(f.sendJourney(s,'survey','pineward',sim.frontierContext(s)).ok,false);
 sim.tick(s,8);assert.equal(regionKnown(s,'pineward'),false);const restored=sim.restore(sim.serialize(s));assert.ok(restored);assert.deepEqual(restored.hinterland,s.hinterland);s=restored;
 home(s,u);assert.equal(regionKnown(s,'pineward'),true);assert.equal(s.hinterland.surveys,1);assert.equal(s.frontier.warning,null);assert.equal(s.frontier.nextRaidAt,null);
});
test('uncharted routes and gathering sites cannot be used until adjoining surveys return',()=>{
 const s=sim.createGame();assert.equal(regionReachable(s,'mistfen'),false);assert.equal(f.journeyOptions(s,'survey','mistfen',sim.frontierContext(s)).ok,false);assert.equal(f.journeyOptions(s,'gather','blackberry_hollow',sim.frontierContext(s)).ok,false);
 for(const id of ['reedmarch','sunmeadow','mistfen']){assert.ok(regionReachable(s,id));home(s,send(s,'survey',id));}
 const u=send(s,'gather','mistfen_herbs');assert.equal(s.hinterland.stock.herbs,0);home(s,u);assert.equal(s.hinterland.stock.herbs,18);assert.ok(s.hinterland.seeds.includes('herbs'));assert.equal(s.hinterland.returned,1);
 const again=f.sendJourney(s,'gather','mistfen_herbs',sim.frontierContext(s));assert.equal(again.ok,false);assert.match(again.reason,/replenish/);assert.ok(sim.restore(sim.serialize(s)));
});
test('every gathering destination has a physical return route on the enlarged island',()=>{
 const s=sim.createGame();s.frontier.discoveredRegions=sim.ISLAND_REGIONS.map(r=>r.id);
 for(const site of GATHERING){s.resources.food=200;const u=send(s,'gather',site.id);home(s,u);assert.ok(s.hinterland.stock[site.good]>=site.amount);}
 assert.equal(s.hinterland.returned,GATHERING.length);assert.ok(sim.restore(sim.serialize(s)));
});
test('garden batches require a full game day and a gardener, keep current crops, and survive reload',()=>{
 let [s,b]=garden();s.hinterland.gardens[b.id]={crop:'roots',next:'roots',progress:0};
 tickGardens(s,DAY-1);assert.equal(s.hinterland.stock.roots,0);tickGardens(s,1);assert.equal(s.hinterland.stock.roots,12);
 tickGardens(s,DAY/2);assert.equal(chooseCrop(s,b.id,'beans').ok,false);s.hinterland.seeds.push('beans');assert.ok(chooseCrop(s,b.id,'beans').ok);assert.equal(gardenState(s,b.id).crop,'roots');
 s=sim.restore(sim.serialize(s));assert.ok(s);b=s.buildings.find(v=>v.id===b.id);const progress=gardenState(s,b.id).progress;
 b.paused=true;tickGardens(s,1000);assert.equal(gardenState(s,b.id).progress,progress);b.paused=false;b.workerIds=[];tickGardens(s,1000);assert.equal(gardenState(s,b.id).progress,progress);
 b.workerIds=['c1'];tickGardens(s,DAY/2);assert.equal(s.hinterland.stock.roots,24);assert.equal(gardenState(s,b.id).crop,'beans');tickGardens(s,DAY*1.5);assert.equal(s.hinterland.stock.beans,18);
});
test('a neighbor delivery consumes the named harvest once and unlocks beans only on return',()=>{
 const s=sim.createGame(),n=s.frontier.neighbors.find(n=>n.id==='reedbank');n.discovered=true;Object.assign(s.hinterland.stock,{roots:18,berries:12});const wood=s.resources.wood;
 const u=send(s,'deliver','reedbank');assert.equal(s.hinterland.stock.roots,0);assert.equal(s.resources.wood,wood-20);assert.equal(s.hinterland.projects.reedbank.step,0);assert.equal(s.hinterland.seeds.includes('beans'),false);
 assert.equal(f.sendJourney(s,'deliver','reedbank',sim.frontierContext(s)).ok,false);sim.tick(s,5);assert.ok(sim.restore(sim.serialize(s)));home(s,u);
 assert.equal(s.hinterland.projects.reedbank.step,1);assert.equal(s.hinterland.projects.reedbank.deliveries,1);assert.ok(s.hinterland.seeds.includes('beans'));assert.equal(n.relation,28);assert.ok(sim.restore(sim.serialize(s)));
});
test('recalling an undelivered project returns its cargo at home without awarding progress',()=>{
 const s=sim.createGame();s.frontier.neighbors[0].discovered=true;Object.assign(s.hinterland.stock,{roots:18,berries:12});const wood=s.resources.wood;
 const u=send(s,'deliver','reedbank');sim.tick(s,5);assert.ok(f.recallJourney(s,u.id).ok);assert.equal(s.hinterland.stock.roots,0);home(s,u);
 assert.equal(s.hinterland.stock.roots,18);assert.ok(s.resources.wood>=wood);assert.equal(s.hinterland.projects.reedbank.step,0);assert.equal(s.hinterland.projects.reedbank.deliveries,0);
});
test('war blocks peaceful deliveries and a truce permits them again',()=>{
 const s=sim.createGame(),n=s.frontier.neighbors[0];n.discovered=true;n.status='war';Object.assign(s.hinterland.stock,{roots:18,berries:12});assert.match(f.journeyOptions(s,'deliver',n.id,sim.frontierContext(s)).reason,/Peace/);n.status='truce';assert.ok(f.journeyOptions(s,'deliver',n.id,sim.frontierContext(s)).ok);
});
test('three completed peaceful patrols prevent new demands; war suspends that protection',()=>{
 const s=sim.createGame();s.won=true;s.population=20;s.citizens=Array.from({length:20},(_,i)=>({id:`c${i+1}`}));s.imports.exportsCompleted=100;
 for(const p of Object.values(s.hinterland.projects))Object.assign(p,{step:3,deliveries:3});assert.equal(coastalPacts(s),3);dailyPressure(s);assert.equal(s.pressure.active,null);
 s.frontier.neighbors[0].status='war';assert.equal(coastalPacts(s),2);assert.equal(cargoThreshold(s),14);dailyPressure(s);assert.ok(s.pressure.active);assert.match(s.pressure.active.templateId,/hungry/);
});
test('old saves gain an empty island record without losing buildings, food, money or woodland',()=>{
 const original=sim.createGame(),raw=JSON.parse(sim.serialize(original));delete raw.hinterland;const s=sim.restore(raw);assert.ok(s);assert.deepEqual(s.resources,original.resources);assert.deepEqual(s.woodland,original.woodland);assert.deepEqual(s.hinterland.stock,{roots:0,beans:0,herbs:0,berries:0,clay:0,wool:0});assert.deepEqual(sim.restore(sim.serialize(s)).hinterland,s.hinterland);
});
test('malformed crops, counters, journey targets and duplicate missions cannot corrupt a saved town',()=>{
 const s=sim.createGame();const u=send(s,'survey','pineward');const raw=JSON.parse(sim.serialize(s));
 for(const mutate of [v=>v.hinterland.stock.roots=-1,v=>v.hinterland.seeds.push('invented'),v=>v.hinterland.projects.reedbank.step=4,v=>v.frontier.units[0].journey.target='nowhere',v=>v.frontier.units[0].journey.work=1,v=>delete v.hinterland]){const bad=structuredClone(raw);mutate(bad);assert.equal(sim.restore(bad),null);}
 assert.ok(u);assert.ok(sim.restore(raw));
});
test('all nine neighbor projects and repeating requests complete through real return journeys',async()=>{
 const {projectSpec}=await import('../js/hinterland.js'),s=sim.createGame();
 for(const n of s.frontier.neighbors){n.discovered=true;for(let step=0;step<3;step++){
  const spec=projectSpec(s,n.id);for(const[k,v]of Object.entries(spec.goods))s.hinterland.stock[k]=v;
  for(const[k,v]of Object.entries(spec.supplies))s.resources[k]=Math.max(s.resources[k],v+30);s.resources.food=200;
  home(s,send(s,'deliver',n.id));assert.equal(s.hinterland.projects[n.id].step,step+1);assert.ok(sim.restore(sim.serialize(s)));
 }}
 assert.equal(coastalPacts(s),3);assert.ok(s.hinterland.seeds.includes('beans'));
 const spec=projectSpec(s,'reedbank');assert.equal(spec.repeat,true);Object.assign(s.hinterland.stock,spec.goods);s.resources.food=200;
 home(s,send(s,'deliver','reedbank'));assert.equal(s.hinterland.projects.reedbank.deliveries,4);
 const next=projectSpec(s,'reedbank');Object.assign(s.hinterland.stock,next.goods);assert.equal(f.journeyOptions(s,'deliver','reedbank',sim.frontierContext(s)).ok,false);
 sim.tick(s,DAY);s.resources.food=200;assert.ok(f.journeyOptions(s,'deliver','reedbank',sim.frontierContext(s)).ok);
 const site=GATHERING[0];s.frontier.discoveredRegions.push('pineward');assert.equal(f.journeyOptions(s,'gather',site.id,sim.frontierContext(s)).work,site.work*.8);
 const [g,b]=garden();Object.assign(g.hinterland.projects.reedbank,{step:2,deliveries:2});g.hinterland.gardens[b.id]={crop:'roots',next:'roots',progress:0};tickGardens(g,DAY);assert.equal(g.hinterland.stock.roots,14);
});
test('full stores preserve returning gatherer and recalled delivery cargo across reload',()=>{
 for(const kind of ['gather','deliver']){
  let s=sim.createGame();s.frontier.discoveredRegions.push('pineward');s.frontier.neighbors[0].discovered=true;Object.assign(s.hinterland.stock,{roots:18,berries:12});
  const u=send(s,kind,kind==='gather'?'blackberry_hollow':'reedbank');if(kind==='deliver'){sim.tick(s,5);f.recallJourney(s,u.id);}
  s.hinterland.stock.berries=9999;sim.tick(s,160);const waiting=s.frontier.units.find(v=>v.id===u.id);assert.ok(waiting?.waitingForStores);assert.equal(s.hinterland.stock.berries,9999);
  s=sim.restore(sim.serialize(s));assert.ok(s);s.hinterland.stock.berries=0;home(s,u);assert.equal(s.hinterland.stock.berries,kind==='gather'?14:12);assert.equal(s.hinterland.projects.reedbank.step,0);
 }
});
test('saves without coastal metadata never count historic trade as new exposure',()=>{
 const s=sim.createGame();s.imports.exportsCompleted=12;const raw=JSON.parse(sim.serialize(s));delete raw.pressure;
 const restored=sim.restore(raw);assert.ok(restored);assert.equal(restored.pressure.tradeAnchor,12);
});
test('new journey logs preserve the displayed calendar date across migration epochs',async()=>{
 const {calendarDay,workPosition}=await import('../js/calendar.js'),s=sim.createGame();s.day=4;s.time=89;s.calendarEpoch=3.7;
 sim.tick(s,12);const shown=calendarDay(s);send(s,'survey','pineward');assert.equal(s.frontier.log[0].calendarDate,shown);
 const restored=sim.restore(sim.serialize(s));assert.ok(restored);assert.equal(restored.frontier.log[0].calendarDate,shown);
 const raw=JSON.parse(sim.serialize(s));raw.frontier.log[0].calendarDate=-1;assert.equal(sim.restore(raw),null);
});
