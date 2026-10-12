/** Funded simulation fixtures; these do not represent earned gameplay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as army from '../js/frontier.js';
import * as sim from '../js/sim.js';
import { RESOURCE_NAMES } from '../js/catalog.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function fixture(rotation=0) {
  const state={day:1,population:14,citizens:Array.from({length:14},(_,i)=>({id:`c${i+1}`,name:`Resident ${i+1}`,job:'idle'})),buildings:[{id:'barracks-a',type:'barracks',x:-5,z:4,rotation,status:'ready',paused:false}],resources:Object.fromEntries(RESOURCE_NAMES.map(k=>[k,1000])),storage:Object.fromEntries(RESOURCE_NAMES.map(k=>[k,5000]))};
  const ctx={home:{x:0,z:3},isLand:()=>true,isWalkable:(x,z)=>!state.buildings.some(b=>b.x===x&&b.z===z),regionAt:()=>({id:'home'})};
  state.frontier=army.createFrontierState(ctx);return{state,ctx};
}
function tick(state,seconds,ctx){for(let left=seconds;left>1e-6;left-=.25)army.tickFrontier(state,Math.min(.25,left),ctx);}
function recruit(state,ctx,kind='spearman'){const q=army.recruitTroop(state,kind,null,ctx);assert.ok(q.ok,q.reason);tick(state,q.unit.trainingSeconds,ctx);return q.unit;}
function order(state,ctx,units,type,x,z){const q=army.commandTroops(state,units.map(u=>u.id),{type,...(x===undefined?{}:{x,z})},ctx);assert.ok(q.ok,q.reason);return q;}
function deploy(state,ctx,units,x=3,z=3){order(state,ctx,units,'move',x,z);tick(state,25,ctx);}

test('training uses each rotated barracks doorway and keeps recruits off the roads',()=>{
  for(let rotation=0;rotation<4;rotation++){
    const{state,ctx}=fixture(rotation),before={...state.resources},q=army.recruitTroop(state,'spearman','c1',ctx);
    assert.ok(q.ok);assert.equal(q.unit.quartersId,'barracks-a');assert.equal(q.unit.garrisoned,true);
    assert.equal(distance(q.unit,army.barracksEntrance(state.buildings[0])),0);assert.ok(distance(q.unit,ctx.home)>2);
    for(const[k,n]of Object.entries(q.cost))assert.equal(state.resources[k],before[k]-n);
    tick(state,36,ctx);assert.equal(q.unit.status,'active');assert.equal(q.unit.garrisoned,true);
    assert.equal(army.barracksRoster(state)[0].inside,1);assert.deepEqual(army.reservedCitizenIds(state),['c1']);
  }
});

test('a group leaves distinct doorway cells, walks out and returns inside without gathering at town center',()=>{
  const{state,ctx}=fixture(),units=Array.from({length:8},()=>army.recruitTroop(state,'spearman',null,ctx).unit);
  tick(state,36,ctx);assert.ok(units.every(u=>u.garrisoned));order(state,ctx,units,'move',4,-5);
  assert.ok(units.every(u=>!u.garrisoned));assert.equal(new Set(units.map(u=>`${u.x},${u.z}`)).size,8);
  tick(state,40,ctx);assert.ok(units.every(u=>u.order.type==='hold'));
  const positions=units.map(u=>({x:u.x,z:u.z}));order(state,ctx,units,'retreat');
  assert.deepEqual(units.map(u=>({x:u.x,z:u.z})),positions,'return order does not teleport field troops');
  tick(state,45,ctx);assert.ok(units.every(u=>u.garrisoned));assert.equal(army.barracksRoster(state)[0].inside,8);
});

test('severe wounds require the journey back and ninety seconds of indoor recovery',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx);deploy(state,ctx,[u],4,3);
  Object.assign(u,{status:'wounded',hp:1,recoveryRemaining:90,order:{type:'retreat'}});
  assert.equal(army.healOffer(state,u.id,ctx).ok,false);tick(state,3,ctx);assert.equal(u.recoveryRemaining,90);assert.equal(u.garrisoned,false);
  tick(state,35,ctx);assert.equal(u.garrisoned,true);assert.equal(u.status,'wounded');assert.ok(u.recoveryRemaining>40);
  tick(state,90,ctx);assert.equal(u.status,'active');assert.equal(u.hp,u.maxHp);assert.equal(u.garrisoned,true);
});

test('blocked routes cannot grant remote recovery or teleport a wounded resident indoors',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx);deploy(state,ctx,[u],4,3);
  Object.assign(u,{status:'wounded',hp:1,recoveryRemaining:90,order:{type:'retreat'}});
  const blocked={...ctx,isWalkable:(x,z)=>x>=1&&!state.buildings.some(b=>b.x===x&&b.z===z)};
  tick(state,120,blocked);assert.equal(u.hp,1);assert.equal(u.recoveryRemaining,90);assert.equal(u.garrisoned,false);assert.ok(u.x>=1);
});

test('garrison metadata and orders survive reload, including closed or removed barracks',()=>{
  for(const removed of[false,true]){
    const{state,ctx}=fixture(),u=recruit(state,ctx),copy=structuredClone(state);army.normalizeFrontier(copy,ctx);assert.deepEqual(copy.frontier,state.frontier);
    if(removed)state.buildings=[];else state.buildings[0].paused=true;
    const saved=structuredClone(state);army.normalizeFrontier(saved,ctx);assert.equal(saved.frontier.units[0].garrisoned,false);assert.equal(saved.frontier.units[0].order.type,'retreat');
    tick(state,.25,ctx);assert.equal(u.garrisoned,false);assert.equal(u.status,'active');
  }
});

test('legacy idle soldiers near the town center return to quarters while field orders and economy are preserved',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx);Object.assign(u,{x:0,z:3,order:{type:'hold'}});delete u.quartersId;delete u.garrisoned;
  const before=structuredClone(state.resources);army.normalizeFrontier(state,ctx);assert.equal(u.order.type,'retreat');assert.deepEqual(state.resources,before);tick(state,20,ctx);assert.equal(u.garrisoned,true);
  deploy(state,ctx,[u],8,-12);delete u.quartersId;delete u.garrisoned;const orderBefore=structuredClone(u.order);army.normalizeFrontier(state,ctx);assert.deepEqual(u.order,orderBefore);
});

test('a false indoor flag cannot protect a soldier outside the barracks',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx);u.x=10;army.normalizeFrontier(state,ctx);assert.equal(u.garrisoned,false);
});

test('field medics reserve a resident, accompany their selected troops and spend finite dressings',()=>{
  const{state,ctx}=fixture(),soldier=recruit(state,ctx),medic=recruit(state,ctx,'medic');
  const saved=army.saveSquad(state,{name:'Patrol and medic',unitIds:[soldier.id,medic.id]});assert.ok(saved.ok);assert.equal(army.squadOptions(state)[0].readyIds.length,2);
  deploy(state,ctx,[soldier,medic],4,3);assert.deepEqual(medic.escortIds,[soldier.id]);assert.ok(distance(medic,soldier)<4);
  soldier.hp=20;soldier.damageAt=state.frontier.clock;const charges=medic.medicalCharges;
  tick(state,2.75,ctx);assert.equal(medic.medicalCharges,charges,'cannot heal fresh damage');
  tick(state,15,ctx);assert.ok(soldier.hp>20);assert.ok(medic.medicalCharges<charges);assert.ok(medic.medicalCharges>=0);assert.ok(soldier.hp<=soldier.maxHp);assert.equal(soldier.status,'active');
});

test('medical dressings cannot heal through a wall or replenish in the field',()=>{
  const{state,ctx}=fixture(),soldier=recruit(state,ctx),medic=recruit(state,ctx,'medic');deploy(state,ctx,[soldier,medic]);
  Object.assign(soldier,{x:1,z:3,hp:10});Object.assign(medic,{x:-1,z:3,order:{type:'hold'},escortIds:[],medicalCharges:6});
  const blocked={...ctx,isWalkable:(x,z)=>x!==0&&ctx.isWalkable(x,z)};tick(state,20,blocked);assert.equal(soldier.hp,10);assert.equal(medic.medicalCharges,6);
  medic.medicalCharges=0;const stock={...state.resources};assert.equal(army.resupplyMedic(state,medic.id,ctx).ok,false);assert.deepEqual(state.resources,stock);
});

test('empty medics refill at barracks for the quoted food and cloth, without generating free supplies',()=>{
  const{state,ctx}=fixture(),medic=recruit(state,ctx,'medic');medic.medicalCharges=0;
  const before={...state.resources};assert.ok(army.resupplyMedic(state,medic.id,ctx).ok);assert.equal(medic.medicalCharges,6);assert.equal(state.resources.food,before.food-6);assert.equal(state.resources.cloth,before.cloth-2);
  assert.equal(army.resupplyMedic(state,medic.id,ctx).ok,false);medic.medicalCharges=0;state.resources.cloth=0;tick(state,5,ctx);assert.equal(medic.medicalCharges,0);
});

test('medics cannot receive an attack without soldiers and invalid orders remain atomic',()=>{
  const{state,ctx}=fixture(),medic=recruit(state,ctx,'medic'),before=structuredClone(state);
  assert.equal(army.commandTroops(state,[medic.id],{type:'attack',x:3,z:3},ctx).ok,false);assert.deepEqual(state,before);
});

test('medic kit counts, cooldowns and escort selections save and resume deterministically',()=>{
  const{state,ctx}=fixture(),soldier=recruit(state,ctx),medic=recruit(state,ctx,'medic');deploy(state,ctx,[soldier,medic]);soldier.hp=10;tick(state,4,ctx);
  const copy=structuredClone(state);army.normalizeFrontier(copy,ctx);assert.deepEqual(copy.frontier,state.frontier);
  army.tickFrontier(state,12,ctx);for(let i=0;i<120;i++)army.tickFrontier(copy,.1,ctx);assert.deepEqual(copy.frontier,state.frontier);
  medic.medicalCharges=999;army.normalizeFrontier(state,ctx);assert.equal(medic.medicalCharges,0,'invalid kit data never awards free dressings');
});

test('medics and indoors residents retain valid citizen jobs in a complete game save',()=>{
  const state=sim.createGame();Object.assign(state.resources,Object.fromEntries(RESOURCE_NAMES.map(k=>[k,1000])));
  state.research.completed.push('watchkeeping');const plot=sim.listTiles().find(t=>sim.canBuild(state,'barracks',t.x,t.z,0).ok);assert.ok(plot);assert.ok(sim.build(state,'barracks',plot.x,plot.z,0).ok);sim.tick(state,120);
  const q=army.recruitTroop(state,'medic',null,sim.frontierContext(state));assert.ok(q.ok,q.reason);sim.refreshTown(state);sim.tick(state,40);
  const copy=sim.restore(sim.serialize(state));assert.ok(copy);assert.equal(copy.frontier.units[0].kind,'medic');assert.equal(copy.frontier.units[0].garrisoned,true);assert.deepEqual(copy.resources,state.resources);
});

test('an old Defend Town order retargets distant barracks without getting stuck in the town-center leash',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx);state.buildings[0].x=-14;
  Object.assign(u,{x:0,z:3,garrisoned:false,order:{type:'defend',x:0,z:3,anchor:{x:0,z:3}}});
  tick(state,50,ctx);assert.equal(u.garrisoned,true);assert.deepEqual(u.order.anchor,army.barracksEntrance(state.buildings[0]));
});

test('a medic returns after its escorted soldiers are safely indoors',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx),m=recruit(state,ctx,'medic');deploy(state,ctx,[u,m]);
  order(state,ctx,[u],'retreat');tick(state,50,ctx);assert.equal(u.garrisoned,true);assert.equal(m.garrisoned,true);assert.deepEqual(m.escortIds,[]);
});

test('foreign units cannot keep a forged indoor immunity flag when loading',()=>{
  const{state,ctx}=fixture(),u=recruit(state,ctx);Object.assign(u,{faction:'raiders',citizenId:null,trainingSeconds:0,garrisoned:true});
  u.order={type:'hold'};army.normalizeFrontier(state,ctx);assert.equal(u.garrisoned,false);assert.equal(u.quartersId,null);
});
