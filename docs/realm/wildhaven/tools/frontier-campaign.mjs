/** Earned frontier continuation: all new supplies, people, claims and battles use public actions. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as sim from '../js/sim.js';
import * as frontier from '../js/frontier.js';
import * as progression from '../js/progression.js';
import { createSlowStaffingPolicy } from './slow-staffing.mjs';
const out = new URL('../review/', import.meta.url);
const sourceNames = ['js/sim.js','js/island.js','js/frontier.js','js/catalog.js','js/progression.js','js/pressure.js','tools/frontier-campaign.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceNames.map(async p=>[p,createHash('sha256').update(await readFile(new URL(`../${p}`,import.meta.url))).digest('hex')])));
const seedName = process.env.WILDHAVEN_FRONTIER_SEED || 'campaign-forge-save.json';
if (!/^[a-z][a-z0-9-]*-save\.json$/.test(seedName)) throw new Error('Invalid campaign seed');
const seed = await readFile(new URL(seedName,out),'utf8');
let state = sim.restore(seed); assert.ok(state);
const startTime = state.elapsed;
const report = { startedAt:new Date().toISOString(), seedName, scope:'Automated continuation of the independently earned Forge Town checkpoint named in seedName. No new stock, residents, research, geography, relations, units or damage are injected. All frontier progress uses public actions and the integrated clock. Clock skips are not measured human playtime. Rendered behavior is reviewed separately.', seedSHA256:createHash('sha256').update(seed).digest('hex'), sourceHashesAtStart:await hashes(), actions:[], staffing:[], milestones:{}, reloads:0, maxArmy:0, errors:[] };
const ctx=()=>sim.frontierContext(state), elapsed=()=>state.elapsed-startTime;
const priorities={hearth:0,orchard:1,garden:1,farm:2,windmill:3,bakery:4,lumber:5,quarry:6,sawmill:7,market:8,clinic:9,chapel:10,manor:11,barracks:12,mine:13,smith:14,toolmaker:15};
const policy=createSlowStaffingPolicy({priorities,researchOrder:state.research.completed,resourceTargets:()=>({wood:220,stone:220,food:Math.min(sim.storageCapacity(state).food-5,state.population*3+100),grain:90,flour:65,planks:100,ore:90,iron:80,tools:80,flax:65,cloth:70,ale:70,gold:1600,knowledge:200}),log:a=>report.staffing.push(a)});
function action(label,result){assert.ok(result?.ok,`${label}: ${result?.reason}`);sim.refreshTown(state);report.actions.push({time:elapsed(),day:state.day,label,reason:result.reason,cost:result.cost||null});return result;}
function invariant(){const seen=new Set();for(const b of state.buildings)for(const id of b.workerIds){assert.ok(!seen.has(id));seen.add(id);}for(const a of frontier.frontierAssignments(state)){assert.ok(!seen.has(a.citizenId),'One citizen cannot serve and produce twice');seen.add(a.citizenId);assert.equal(state.citizens.find(c=>c.id===a.citizenId)?.job,a.job);}assert.equal(seen.size,sim.workforce(state).assigned);assert.equal(state.population,state.citizens.length);for(const n of Object.values(state.resources))assert.ok(Number.isFinite(n)&&n>=0);report.maxArmy=Math.max(report.maxArmy,state.frontier.units.filter(u=>u.faction==='player'&&['spearman','archer'].includes(u.kind)&&!['dead','released'].includes(u.status)).length);}
function economy(){
  policy(state);
  for(const [resource,floor]of[['food',state.population*2],['cloth',15],['planks',35]])if(state.resources[resource]<floor){const option=progression.importOptions(state).find(o=>o.id===`import_${resource}`);if(option?.ok)action(`Import ${resource}`,progression.importGoods(state,option.id));}
  if(state.resources.wood<100&&sim.tradeOffer(state,'wood').ok)action('Landing timber exchange',sim.trade(state,'wood'));
  if(state.pressure.active){const offers=sim.pressureOptions(state);if(offers.canPay)action('Pay coastal demand while the company is away',sim.actOnPressure(state,'pay'));}
}
function tick(seconds=1){for(let i=0;i<seconds;i++){economy();sim.tick(state,1);invariant();if(Math.round(elapsed())%30===0){const next=sim.restore(sim.serialize(state));assert.ok(next,'A running frontier must reload');state=next;report.reloads++;}}}
function until(predicate,label,max=500){let i=0;for(;!predicate()&&i<max;i++)tick();assert.ok(predicate(),`${label} did not complete in ${max}s`);}
const unit=id=>state.frontier.units.find(u=>u.id===id);
const company=()=>state.frontier.units.filter(u=>u.faction==='player'&&u.citizenId&&['spearman','archer'].includes(u.kind)&&u.status==='active').map(u=>u.id);
async function checkpoint(name){report.milestones[name]={time:elapsed(),day:state.day,population:state.population,resources:{...state.resources},claims:[...state.frontier.claims],stats:{...state.frontier.stats}};await writeFile(new URL(`frontier-campaign-${name}-save.json`,out),sim.serialize(state));}
function command(label,ids,order){return action(label,frontier.commandTroops(state,ids,order,ctx()));}
try {
  for(const kind of ['spearman','archer','spearman','archer','spearman','archer','spearman','spearman']){
    until(()=>frontier.troopOptions(state).find(o=>o.id===kind).ok,`Equipment for ${kind}`,300);
    action(`Recruit ${kind}`,frontier.recruitTroop(state,kind,null,ctx()));tick(2);
  }
  until(()=>company().length===8,'Train eight residents',100);await checkpoint('company');
  command('Survey Highmeadow',company(),{type:'move',x:0,z:-16});until(()=>state.frontier.discoveredRegions.includes('highmeadow'),'Reach Highmeadow',120);
  until(()=>frontier.claimOptions(state,ctx()).find(o=>o.id==='highmeadow').ok,'Provision Highmeadow outpost',300);
  action('Claim Highmeadow',frontier.claimRegion(state,'highmeadow',ctx()));until(()=>state.frontier.claims.includes('highmeadow'),'Complete Highmeadow',200);
  // A real gate interrupts the wall. It can stay open for a company returning home.
  for(const [type,x,z]of[['wall',-4,-19],['wall',-3,-19],['wall',-2,-19],['wall',-1,-19],['gate',0,-19],['wall',1,-19],['wall',2,-19],['tower',-3,-17]]){
    until(()=>frontier.canPlaceFortification(state,type,x,z,0,ctx()).ok,`Place ${type} at ${x},${z}`,300);
    action(`Build ${type} at ${x},${z}`,frontier.placeFortification(state,type,x,z,0,ctx()));
  }
  until(()=>!state.frontier.fortifications.some(f=>f.faction==='player'&&f.status==='building'),'Finish the defensive line',320);
  const gate=state.frontier.fortifications.find(f=>f.faction==='player'&&f.type==='gate');
  action('Close the gate',frontier.setGateOpen(state,gate.id,false,ctx()));
  action('Open the gate for the company',frontier.setGateOpen(state,gate.id,true,ctx()));
  await checkpoint('walls');
  // Envoys walk through the same island. Their labor remains unavailable until home.
  for(let visit=0;visit<3;visit++){
    action('Send envoy to Reedbank',frontier.sendEnvoy(state,'reedbank',null,ctx()));
    until(()=>!state.frontier.units.some(u=>u.kind==='envoy'&&u.missionNeighborId==='reedbank'),'Envoy returns',160);
    const offer=frontier.neighborOptions(state).find(n=>n.id==='reedbank').trade;
    if(offer.ok)action('Trade with Reedbank',frontier.tradeWithNeighbor(state,'reedbank'));
  }
  action('Ally with Reedbank',frontier.proposeAlliance(state,'reedbank'));
  action('Call allied reinforcements',frontier.requestAid(state,'reedbank',ctx()));
  until(()=>state.frontier.units.some(u=>u.allyFrom==='reedbank'&&Math.hypot(u.x,u.z-3)<4),'Allied reinforcements reach town',160);
  await checkpoint('alliance');
  const regionalHouse=()=>sim.listTiles().filter(t=>t.regionId==='highmeadow').flatMap(t=>[0,1,2,3].map(rotation=>({...t,rotation}))).find(t=>sim.canBuild(state,'cottage',t.x,t.z,t.rotation).ok);
  until(()=>!!regionalHouse(),'Supplies for frontier housing',200);const home=regionalHouse();const homeId=action('Build a Highmeadow cottage',sim.build(state,'cottage',home.x,home.z,home.rotation)).building.id;
  until(()=>state.buildings.find(b=>b.id===homeId).status==='ready','Raise the frontier cottage',100);
  for(const id of ['reedmarch','pineward']){
    const settlement=id==='reedmarch'?'reedbank':'stonehaven';
    if(!state.frontier.discoveredRegions.includes(id)){action(`Send envoy to ${settlement}`,frontier.sendEnvoy(state,settlement,null,ctx()));until(()=>state.frontier.discoveredRegions.includes(id),`Survey ${id}`,150);}
    until(()=>frontier.claimOptions(state,ctx()).find(o=>o.id===id).ok,`Provision ${id}`,300);action(`Claim ${id}`,frontier.claimRegion(state,id,ctx()));until(()=>state.frontier.claims.includes(id),`Build ${id} outpost`,250);
  }
  await checkpoint('expansion');
  until(()=>company().length>=6,'Recover field company',250);
  command('March to Blackthorn',company(),{type:'move',x:0,z:-24});until(()=>state.frontier.neighbors.find(n=>n.id==='blackthorn').discovered,'Find Blackthorn',180);
  until(()=>company().filter(id=>Math.hypot(unit(id).x,unit(id).z+24)<6).length>=6,'Assemble the company',200);
  const beforeGarrison = state.frontier.stats.enemiesDefeated;
  action('Declare war on Blackthorn',frontier.declareWar(state,'blackthorn',ctx()));await checkpoint('battle-start');
  for(let t=0;t<180&&state.frontier.stats.enemiesDefeated<beforeGarrison+3;t++){
    if(t%4===0){const enemy=state.frontier.units.find(u=>u.faction==='blackthorn'&&u.status==='active');if(enemy&&company().length)command('Engage the Blackthorn garrison',company(),{type:'attack',targetId:enemy.id});}
    tick();
  }
  assert.ok(state.frontier.stats.enemiesDefeated>=beforeGarrison+3,'Three new garrison opponents must be defeated; earlier raider kills do not count');
  await checkpoint('battle');
  command('Attack Blackthorn stronghold',company(),{type:'attack',targetId:'settlement-blackthorn'});
  until(()=>state.frontier.neighbors.find(n=>n.id==='blackthorn').defeated,'Take Blackthorn stronghold',280);
  await checkpoint('conquest');
  command('Return the company to the town',company(),{type:'retreat'});
  until(()=>company().every(id=>Math.hypot(unit(id).x,unit(id).z-3)<5),'Company returns',200);
  for(const id of company()){const offer=frontier.healOffer(state,id,ctx());if(offer.ok)action('Tend battle wounds',frontier.healTroop(state,id,ctx()));}
  until(()=>frontier.claimOptions(state,ctx()).find(o=>o.id==='crownhill').ok,'Provision the northern claim',300);action('Claim Crownhill',frontier.claimRegion(state,'crownhill',ctx()));until(()=>state.frontier.claims.includes('crownhill'),'Complete northern claim',250);
  const neighbor=state.frontier.neighbors.find(n=>n.id==='stonehaven');
  if(!neighbor.discovered){action('Meet Stonehaven',frontier.sendEnvoy(state,'stonehaven',null,ctx()));until(()=>state.frontier.neighbors.find(n=>n.id==='stonehaven').discovered,'Reach Stonehaven',160);}
  action('Declare a test conflict with Stonehaven',frontier.declareWar(state,'stonehaven',ctx()));const cost=frontier.neighborOptions(state).find(n=>n.id==='stonehaven').truce.cost,before={...state.resources};
  action('Negotiate an immediate truce',frontier.offerTruce(state,'stonehaven'));for(const[key,n]of Object.entries(cost))assert.ok(Math.abs(state.resources[key]-(before[key]-n))<1e-6);
  tick(60);assert.equal(state.frontier.neighbors.find(n=>n.id==='stonehaven').status,'truce');
  await checkpoint('complete');assert.equal(state.frontier.claims.length,5);assert.ok(state.frontier.stats.conquests>=1);assert.ok(state.frontier.stats.enemiesDefeated>=3);assert.ok(state.frontier.stats.trades>=1);
  report.ok=true;
} catch(error){report.ok=false;report.errors.push(error.stack);await writeFile(new URL('frontier-campaign-failure-save.json',out),sim.serialize(state));process.exitCode=1;}
report.finishedAt=new Date().toISOString();report.simulatedSeconds=elapsed();report.final={day:state.day,population:state.population,resources:state.resources,stats:state.frontier.stats,claims:state.frontier.claims};report.sourceHashesAtEnd=await hashes();report.sourceStable=JSON.stringify(report.sourceHashesAtStart)===JSON.stringify(report.sourceHashesAtEnd);
await writeFile(new URL('frontier-campaign-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,sourceStable:report.sourceStable,simulatedSeconds:report.simulatedSeconds,milestones:Object.keys(report.milestones),reloads:report.reloads,errors:report.errors}));
