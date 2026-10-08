/** Funded deterministic fixtures, not earned play or balance-duration evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as f from '../js/frontier.js';
import * as sim from '../js/sim.js';
import { RESOURCE_NAMES } from '../js/catalog.js';
const copy = value => structuredClone(value), distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
function context(state, overrides = {}) { return { bounds:f.FRONTIER_BOUNDS, home:{x:0,z:3}, isLand:(x,z)=>x>=-28&&x<=28&&z>=-34&&z<=12, isWalkable:(x,z)=>!state.buildings.some(b=>b.x===x&&b.z===z), regionAt:()=>({id:'home'}), ...overrides }; }
function fixture(count = 12, overrides = {}) {
  const state={version:3,day:1,population:count,citizens:Array.from({length:count},(_,i)=>({id:`c${i+1}`,name:`Resident ${i+1}`,job:'idle'})),buildings:[{id:'watch',type:'barracks',status:'ready',x:-9,z:8}],resources:Object.fromEntries(RESOURCE_NAMES.map(r=>[r,1000])),storage:Object.fromEntries(RESOURCE_NAMES.map(r=>[r,5000])),won:false};
  const ctx=context(state,overrides);state.frontier=f.createFrontierState(ctx);return{state,ctx};
}
function advance(state,seconds,ctx,inspect=()=>{}) { for(let left=seconds;left>1e-7;) { const dt=Math.min(.25,left),result=f.tickFrontier(state,dt,ctx);state.citizens=state.citizens.filter(c=>!result.casualties.includes(c.id));state.population=state.citizens.length;state.day=1+Math.floor(state.frontier.clock/90);left-=dt;inspect(); } }
function soldiers(state,ctx,count=1) { const units=Array.from({length:count},(_,i)=>{const result=f.recruitTroop(state,i%2?'archer':'spearman',null,ctx);assert.ok(result.ok,result.reason);return result.unit;});advance(state,45,ctx);return units; }
function raider(state,x,z) {
  const sample=state.frontier.units[0],spec=f.TROOPS.raider;
  const unit={...copy(sample),id:`unit-${state.frontier.nextId++}`,name:'Raider',citizenId:null,kind:'raider',faction:'raiders',x,z,hp:spec.maxHp,maxHp:spec.maxHp,status:'active',trainingSeconds:0,trainingRemaining:0,recoveryRemaining:0,cooldown:0,order:{type:'hold'},path:[],targetId:null,attackAt:null,damageAt:null,deathAt:null,routeGoal:null,routeAt:-10};
  state.frontier.units.push(unit);return unit;
}
function wall(state,x,z,type='wall') { const spec=f.FORTIFICATIONS[type],fort={id:`fort-${state.frontier.nextId++}`,type,name:spec.name,faction:'player',x,z,rotation:0,status:'ready',hp:spec.maxHp,maxHp:spec.maxHp,progress:spec.work,work:spec.work,escrow:{},open:false,damageAt:null,regionId:null,completedAt:state.frontier.clock,repairing:false};state.frontier.fortifications.push(fort);return fort; }

test('squads save all ten valid recruits in a twelve-resident town without changing their orders or economy',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,10),before=copy({units:state.frontier.units,resources:state.resources});
  const saved=f.saveSquad(state,{name:'Harbor guard',unitIds:units.map(u=>u.id)});assert.ok(saved.ok,saved.reason);assert.equal(saved.squad.unitIds.length,10);
  assert.deepEqual({units:state.frontier.units,resources:state.resources},before);assert.equal(f.squadOptions(state)[0].readyIds.length,10);
  const recalled=f.recallSquad(state,saved.squad.id);assert.deepEqual(recalled.unitIds,units.map(u=>u.id));assert.deepEqual(recalled.memberIds,recalled.unitIds);
});

test('saving/updating/deleting named squads is bounded and atomic, with overlapping selections allowed',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,2),ids=units.map(u=>u.id);
  const first=f.saveSquad(state,{name:'Harbor',unitIds:ids}).squad;
  assert.ok(f.saveSquad(state,{id:first.id,name:' North watch ',unitIds:[ids[1]]}).ok);assert.equal(f.squadOptions(state)[0].name,'North watch');
  for(let i=1;i<f.MAX_SQUADS;i++)assert.ok(f.saveSquad(state,{name:`Group ${i}`,unitIds:ids}).ok);
  for(const request of [{name:'Seventh',unitIds:ids},{id:'missing',name:'Missing',unitIds:ids},{name:'',unitIds:ids},{name:'A'.repeat(33),unitIds:ids},{name:'Bad',unitIds:[]},{name:'Bad',unitIds:[ids[0],ids[0]]},{name:'Bad',unitIds:['unknown']}]){const before=copy(state);assert.equal(f.saveSquad(state,request).ok,false);assert.deepEqual(state,before);}
  const before=copy(state.frontier.units);assert.ok(f.deleteSquad(state,first.id).ok);assert.deepEqual(state.frontier.units,before);assert.equal(f.deleteSquad(state,first.id).ok,false);
});

test('recall is a pure ready-only selection and retains honest wounded/training membership',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,5),id=f.saveSquad(state,{name:'Mixed readiness',unitIds:units.map(u=>u.id)}).squad.id;
  Object.assign(units[1],{status:'wounded',hp:1,recoveryRemaining:60,order:{type:'retreat'}});Object.assign(units[2],{status:'training',trainingRemaining:10});Object.assign(units[3],{status:'dead',hp:0,deathAt:state.frontier.clock});units[4].status='released';
  const before=copy(state),offer=f.recallSquad(state,id);assert.ok(offer.ok);assert.deepEqual(offer.unitIds,[units[0].id]);assert.deepEqual(offer.memberIds,units.slice(0,3).map(u=>u.id));assert.deepEqual(offer.unavailableIds,units.slice(1,3).map(u=>u.id));assert.match(offer.reason,/2 training or recovering/);assert.deepEqual(state,before);
  units[0].status='wounded';assert.equal(f.recallSquad(state,id).ok,false);assert.deepEqual(f.recallSquad(state,id).unitIds,[]);
});

test('allies, foreign troops and civilian frontier workers cannot enter squads',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx),enemy=raider(state,9,3),neighbor=state.frontier.neighbors[0];Object.assign(neighbor,{discovered:true,status:'allied',relation:60,envoys:3});
  const ally=f.requestAid(state,neighbor.id,ctx).units[0];const builder=f.placeFortification(state,'wall',4,1,0,ctx);assert.ok(builder.ok);const engineer=state.frontier.units.find(u=>u.kind==='engineer');
  for(const invalid of[enemy,ally,engineer]){const before=copy(state);assert.equal(f.saveSquad(state,{name:'No foreign members',unitIds:[unit.id,invalid.id]}).ok,false);assert.deepEqual(state,before);}
  assert.equal(f.commandTroops(state,[ally.id],{type:'defend'},ctx).ok,false);
});

test('squad metadata migrates optionally, removes stale members, and remains independent per town',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx),other=fixture().state;f.saveSquad(state,{name:'Home watch',unitIds:[unit.id]});
  assert.deepEqual(f.squadOptions(other),[]);const saved=copy(state);f.normalizeFrontier(saved,context(saved));assert.deepEqual(f.squadOptions(saved),f.squadOptions(state));
  saved.frontier.squads[0].unitIds.push('missing',unit.id);saved.frontier.squads.push({id:'broken',name:3,unitIds:null});saved.frontier.nextSquadId=0;f.normalizeFrontier(saved,context(saved));assert.deepEqual(saved.frontier.squads[0].unitIds,[unit.id]);assert.equal(saved.frontier.nextSquadId,2);
  const legacy=copy(state);delete legacy.frontier.squads;delete legacy.frontier.nextSquadId;const unitsBefore=copy(legacy.frontier.units);f.normalizeFrontier(legacy,context(legacy));assert.deepEqual(legacy.frontier.squads,[]);assert.deepEqual(legacy.frontier.units,unitsBefore);
  const options=f.squadOptions(state);options[0].unitIds.length=0;assert.equal(state.frontier.squads[0].unitIds.length,1);
});

test('dead and released members leave saved squads while the named empty squad stays available to update',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx),id=f.saveSquad(state,{name:'Keep this name',unitIds:[unit.id]}).squad.id;
  assert.ok(f.dismissTroop(state,unit.id,ctx).ok);advance(state,.25,ctx);assert.deepEqual(state.frontier.squads[0].unitIds,[]);assert.equal(f.recallSquad(state,id).ok,false);assert.match(f.recallSquad(state,id).reason,/no members remain/);
});

test('Defend Town physically returns a distant company to home positions without teleporting',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,2);units.forEach((u,i)=>Object.assign(u,{x:12,z:3+i}));const before=units.map(u=>({x:u.x,z:u.z}));
  assert.ok(f.commandTroops(state,units.map(u=>u.id),{type:'defend'},ctx).ok);assert.deepEqual(units.map(u=>({x:u.x,z:u.z})),before);
  advance(state,.25,ctx);units.forEach((u,i)=>assert.ok(distance(u,before[i])<=f.TROOPS[u.kind].speed*.25+1e-5));
  advance(state,18,ctx);assert.ok(units.every(u=>u.order.type==='defend'&&distance(u,u.order)<.03),JSON.stringify(units.map(u=>({x:u.x,z:u.z,order:u.order,path:u.path,routeGoal:u.routeGoal}))));assert.ok(units.every(u=>u.order.anchor.x===0&&u.order.anchor.z===3));
});

test('Defend Town intercepts a real hostile inside the home zone and returns after the target is gone',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx),enemy=raider(state,4,3);assert.ok(f.commandTroops(state,[unit.id],{type:'defend'},ctx).ok);const home=copy(unit.order);
  advance(state,3,ctx,()=>assert.ok(distance(unit,ctx.home)<=f.DEFEND_RADIUS+1e-5));assert.ok(unit.x>1,'The defender actually approaches the threat');
  advance(state,4,ctx);assert.ok(enemy.hp<enemy.maxHp,'Actual combat reduces hostile HP');state.frontier.units=state.frontier.units.filter(u=>u!==enemy);
  advance(state,10,ctx);assert.equal(unit.order.type,'defend');assert.equal(unit.targetId,null);assert.ok(distance(unit,home)<.03);
});

test('the defense leash stops pursuit at eight tiles, including ranged targets just outside it',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,2),unit=units[1];units[0].status='released';Object.assign(unit,{x:7.8,z:3});const enemy=raider(state,8.3,3),hp=enemy.hp;
  assert.ok(f.commandTroops(state,[unit.id],{type:'defend'},ctx).ok);advance(state,2,ctx,()=>assert.ok(distance(unit,ctx.home)<=f.DEFEND_RADIUS+1e-5));assert.equal(enemy.hp,hp,'Range alone cannot lure a defender outside its town boundary');
  Object.assign(enemy,{x:7.6,z:3});advance(state,2,ctx,()=>assert.ok(distance(unit,ctx.home)<=f.DEFEND_RADIUS+1e-5));assert.ok(enemy.hp<hp||state.frontier.projectiles.length);
  Object.assign(enemy,{x:12,z:3});const escapedHp=enemy.hp;advance(state,12,ctx,()=>assert.ok(distance(unit,ctx.home)<=f.DEFEND_RADIUS+1e-5));assert.equal(enemy.hp,escapedHp);assert.ok(distance(unit,unit.order)<.03);
});

test('Hold Here is stationary while explicit Attack can pursue the deliberately selected distant enemy',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx),enemy=raider(state,2,3);const start={x:unit.x,z:unit.z};assert.ok(f.commandTroops(state,[unit.id],{type:'hold'},ctx).ok);
  advance(state,4,ctx);assert.deepEqual({x:unit.x,z:unit.z},start);assert.equal(enemy.hp,enemy.maxHp);
  Object.assign(enemy,{x:12,z:3});const diplomacy=state.frontier.neighbors.map(n=>n.status);assert.ok(f.commandTroops(state,[unit.id],{type:'attack',targetId:enemy.id},ctx).ok);advance(state,9,ctx);assert.ok(distance(unit,ctx.home)>8);assert.deepEqual(state.frontier.neighbors.map(n=>n.status),diplomacy);
  state.frontier.units=state.frontier.units.filter(u=>u!==enemy);advance(state,.25,ctx);assert.equal(unit.order.type,'hold');assert.equal(unit.targetId,null);
});

test('Defend Town never attacks neutral neighbors or settlement structures',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx);const neighbor=state.frontier.neighbors[0],fort=state.frontier.fortifications[0],before=copy(state.frontier.neighbors);
  const neutral={...copy(raider(state,1,3)),faction:neighbor.id};state.frontier.units[state.frontier.units.length-1]=neutral;
  assert.ok(f.commandTroops(state,[unit.id],{type:'defend'},ctx).ok);advance(state,4,ctx);assert.equal(neutral.hp,neutral.maxHp);assert.equal(fort.hp,fort.maxHp);assert.deepEqual(state.frontier.neighbors.map(n=>n.status),before.map(n=>n.status));
  assert.equal(f.commandTroops(state,[unit.id],{type:'attack',targetId:fort.id},ctx).ok,false);
});

test('walls/gates constrain defensive movement and arrows; reopening gives the company a real route',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,2),archer=units[1];units[0].status='released';const enemy=raider(state,0,-2);
  const walls=Array.from({length:17},(_,i)=>wall(state,i-8,1,i===8?'gate':'wall')),gate=walls[8];
  assert.ok(f.commandTroops(state,[archer.id],{type:'defend'},ctx).ok);const start={x:archer.x,z:archer.z};advance(state,8,ctx);assert.equal(enemy.hp,enemy.maxHp);assert.ok(archer.z>1);
  assert.ok(f.setGateOpen(state,gate.id,true,ctx).ok);advance(state,12,ctx,()=>{assert.ok(distance(archer,ctx.home)<=8+1e-5);assert.ok(!state.frontier.fortifications.some(fort=>f.blocksFortification(fort)&&Math.round(archer.x)===fort.x&&Math.round(archer.z)===fort.z));});
  assert.ok(enemy.hp<enemy.maxHp||enemy.status==='dead');assert.ok(distance(archer,start)>.5);
});

test('empty, stale, mixed-unready and unreachable defense commands leave every unit unchanged',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,2);units[1].status='training';units[1].trainingRemaining=10;
  for(const ids of[[],['missing'],[units[0].id,'missing'],units.map(u=>u.id)]){const before=copy(state.frontier.units);assert.equal(f.commandTroops(state,ids,{type:'defend'},ctx).ok,false);assert.deepEqual(state.frontier.units,before);}
  Object.assign(units[0],{x:0,z:-20});const blocked={...ctx,isWalkable:(x,z)=>z===-20&&Math.abs(x)<2};const before=copy(state.frontier.units);assert.equal(f.commandTroops(state,[units[0].id],{type:'defend'},blocked).ok,false);assert.deepEqual(state.frontier.units,before);
});

test('defense orders and squads persist and partition identically through combat and save reload',()=>{
  const{state,ctx}=fixture(),units=soldiers(state,ctx,2);raider(state,6,3);f.saveSquad(state,{name:'Two at home',unitIds:units.map(u=>u.id)});assert.ok(f.commandTroops(state,units.map(u=>u.id),{type:'defend'},ctx).ok);
  advance(state,1.3,ctx);const restored=copy(state);f.normalizeFrontier(restored,context(restored));assert.deepEqual(restored.frontier,state.frontier);
  f.tickFrontier(state,11.2,ctx);for(let i=0;i<112;i++)f.tickFrontier(restored,.1,context(restored));assert.deepEqual(restored.frontier,state.frontier);
  const invalid=copy(state);invalid.frontier.units.find(u=>u.order.type==='defend').order.anchor.x=1;assert.throws(()=>f.normalizeFrontier(invalid,context(invalid)),/Invalid frontier save/);
});

test('civilian and frontier construction protect the saved defensive rally cell',()=>{
  const state=sim.createGame();Object.assign(state.resources,Object.fromEntries(RESOURCE_NAMES.map(r=>[r,1000])));
  state.buildings.push({id:'fixture-watch',type:'barracks',x:4,z:4,status:'ready',desiredWorkers:0,level:1,workerIds:[],priority:1,builtDay:1,paused:false});
  const ctx=sim.frontierContext(state),unit=f.recruitTroop(state,'spearman',null,ctx).unit;assert.ok(unit);f.tickFrontier(state,36,ctx);assert.ok(f.commandTroops(state,[unit.id],{type:'defend'},ctx).ok);
  // Put the actor elsewhere and use a buildable valid home-zone rally to isolate
  // the saved-destination reservation from the separate occupied-cell guard.
  Object.assign(unit,{x:0,z:3});unit.order.x=2;unit.order.z=2;
  const denied=sim.canBuild(state,'cottage',2,2);assert.equal(denied.ok,false);assert.match(denied.reason,/ordered destination/);
  const fort=f.canPlaceFortification(state,'wall',2,2,0,ctx);assert.equal(fort.ok,false);assert.match(fort.reason,/ordered destination/);
});

test('new automatic raids use exact 540/360/900 timing from frontier involvement, without changing intentional wars',()=>{
  const{state,ctx}=fixture();soldiers(state,ctx);state.frontier.neighbors[0].envoys=1;const unlockedAt=state.frontier.clock;advance(state,.25,ctx);
  assert.equal(state.frontier.nextRaidAt,unlockedAt+.25+f.FRONTIER_RAID_PACING.firstWarningSeconds);
  advance(state,539.75,ctx);assert.equal(state.frontier.warning,null);advance(state,.25,ctx);
  const warning=copy(state.frontier.warning);assert.equal(warning.announcedAt,unlockedAt+.25+540);assert.equal(warning.attackAt-warning.announcedAt,360);
  advance(state,359.75,ctx);assert.equal(state.frontier.raidActive,false);advance(state,.25,ctx);assert.ok(state.frontier.raidActive);
  for(const unit of state.frontier.units.filter(u=>u.faction==='raiders')){unit.status='dead';unit.hp=0;unit.deathAt=state.frontier.clock;}state.frontier.raidOutcome.killed=state.frontier.raidOutcome.spawned;
  advance(state,.25,ctx);assert.equal(state.frontier.nextRaidAt,state.frontier.clock+900);
  const neighbor=state.frontier.neighbors[1];neighbor.discovered=true;assert.ok(f.declareWar(state,neighbor.id,ctx).ok);assert.equal(neighbor.nextAttackAt,state.frontier.clock+90);advance(state,90,ctx);assert.equal(neighbor.nextAttackAt,state.frontier.clock+270);
});

test('legacy pending warnings and scheduled dates survive reload exactly; new warning durations also validate',()=>{
  for(const duration of[180,360]){
    const{state,ctx}=fixture();state.frontier.nextRaidAt=12;state.frontier.warning={id:`raid-${state.frontier.nextId++}`,source:'raiders',announcedAt:0,attackAt:duration,amount:2,entry:{x:3,z:-5}};
    const before=copy({warning:state.frontier.warning,nextRaidAt:state.frontier.nextRaidAt});f.normalizeFrontier(state,ctx);assert.deepEqual({warning:state.frontier.warning,nextRaidAt:state.frontier.nextRaidAt},before);
    advance(state,duration-.25,ctx);assert.ok(state.frontier.warning);advance(state,.25,ctx);assert.equal(state.frontier.warning,null);assert.equal(state.frontier.raidActive,true);
  }
});

test('only new physical announcements wait for an active coastal incident; promised landings keep their deadline',()=>{
  const{state,ctx}=fixture();state.frontier.nextRaidAt=.25;state.pressure={active:{id:'coast'}};advance(state,4,ctx);assert.equal(state.frontier.warning,null);assert.equal(state.frontier.nextRaidAt,.25);
  f.normalizeFrontier(copy(state),ctx);state.pressure.active=null;advance(state,.25,ctx);assert.ok(state.frontier.warning);const deadline=state.frontier.warning.attackAt;
  state.pressure.active={id:'already-promised-coast'};advance(state,deadline-state.frontier.clock,ctx);assert.equal(state.frontier.warning,null);assert.equal(state.frontier.raidActive,true);
});


test('default-context defenders route around buildings instead of bypassing normal occupancy',()=>{
  const{state,ctx}=fixture(),[unit]=soldiers(state,ctx);state.buildings.push({id:'test-cottage',type:'cottage',status:'ready',x:1,z:3});Object.assign(unit,{x:3,z:3});
  assert.ok(f.commandTroops(state,[unit.id],{type:'defend'}).ok);
  advance(state,10,{},()=>{assert.ok(!(Math.round(unit.x)===1&&Math.round(unit.z)===3));f.normalizeFrontier(copy(state));});
  assert.ok(distance(unit,unit.order)<.03);
});

test('complete v4 serialization restores squad names and defend orders without changing the economy or a second town',()=>{
  const source=readFileSync(new URL('../review/campaign-forge-save.json',import.meta.url),'utf8'),state=sim.restore(source),second=sim.restore(source);assert.ok(state&&second);
  const context=()=>sim.frontierContext(state),recruited=f.recruitTroop(state,'spearman',null,context());assert.ok(recruited.ok,recruited.reason);sim.refreshTown(state);sim.tick(state,36.5);
  const unit=recruited.unit;assert.ok(f.saveSquad(state,{name:'The harbor watch',unitIds:[unit.id]}).ok);assert.ok(f.commandTroops(state,[unit.id],{type:'defend'},context()).ok);sim.tick(state,.25);
  const before=copy(state.resources),restored=sim.restore(sim.serialize(state));assert.ok(restored);assert.deepEqual(restored.resources,before);assert.deepEqual(restored.frontier,state.frontier);assert.deepEqual(f.squadOptions(second),[]);
  sim.tick(state,4);for(let i=0;i<16;i++)sim.tick(restored,.25);assert.deepEqual(restored.frontier,state.frontier);assert.deepEqual(restored.resources,state.resources);
});
