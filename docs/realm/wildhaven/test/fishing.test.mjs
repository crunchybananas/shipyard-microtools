import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,canBuild,build,setWorkers,tick,serialize,restore,pauseBuilding,objective} from '../js/sim.js';
import {isLand} from '../js/island.js';
import {CATCH_SIZE,pierPoint,fisherPosition} from '../js/fishing.js';

function newPier(){
  const state=createGame();
  setWorkers(state,'hearth',0);
  const result=build(state,'fishingpier',-4,8,0);
  assert.equal(result.ok,true,result.reason);
  tick(state,18);
  return {state,pier:result.building};
}
function until(state,pier,test){
  for(let i=0;i<240 && !test(pier);i++)tick(state,1);
  assert.ok(test(pier),'The trip reached its expected stage');
}
test('piers face open water with an inland entrance, preserve the landing and reserve their stretch of bank',()=>{
  const {state,pier}=newPier();
  const tip=pierPoint(pier,-1),entry=pierPoint(pier,1);
  assert.ok(!isLand(tip.x,tip.z));assert.ok(isLand(entry.x,entry.z));
  assert.equal(pier.rotation,2);
  for(const [x,z] of [[0,1],[2,8],[-3,8],[-4,9]])assert.equal(canBuild(state,'fishingpier',x,z).ok,false);
  assert.equal(canBuild(state,'fishingpier',5,7).ok,true);
  assert.equal(canBuild(state,'cottage',-3,8,2).ok,false);
  assert.ok(restore(serialize(state)));
});
test('manual staffing starts the trip and one returning basket credits food exactly once across reload',()=>{
  const {state,pier}=newPier();
  const before=state.resources.food;
  assert.equal(pier.desiredWorkers,0);
  tick(state,3);assert.equal(state.resources.food,before);
  assert.ok(setWorkers(state,pier.id,1).ok);
  until(state,pier,p=>p.trip?.stage==='casting');
  assert.deepEqual(fisherPosition(pier,0),pierPoint(pier,-1));
  until(state,pier,p=>p.trip.stage==='returning' && p.trip.step===1);
  assert.equal(state.resources.food,before);
  const basket=pier.trip.catch, clone=restore(serialize(state)), other=clone.buildings.find(b=>b.id===pier.id);
  assert.ok(basket>=CATCH_SIZE);assert.deepEqual(pier.trip,other.trip);
  for(const [s,p] of [[state,pier],[clone,other]]){
    until(s,p,q=>q.trip.stage==='unloading');
    assert.equal(s.resources.food,before);
    assert.deepEqual(fisherPosition(p,0),{x:0,z:3});
    until(s,p,q=>q.trip.landed>0);
    assert.equal(s.resources.food,before+basket);
    tick(s,1);assert.equal(p.trip.landed,basket);assert.equal(p.trip.catch,0);
  }
});
test('a full store holds the catch, partial deliveries survive a pause and can finish after reload',()=>{
  const {state,pier}=newPier();setWorkers(state,pier.id,1);
  until(state,pier,p=>p.trip?.stage==='unloading');
  const basket=pier.trip.catch;
  state.resources.food=state.storage.food-2;
  tick(state,3);assert.equal(pier.trip.landed,2);assert.equal(state.resources.food,state.storage.food);
  assert.ok(pauseBuilding(state,pier.id,true).ok);const held=structuredClone(pier.trip);
  tick(state,3);assert.deepEqual(pier.trip,held);
  const s=restore(serialize(state)),p=s.buildings.find(b=>b.id===pier.id);
  pauseBuilding(s,p.id,false);s.resources.food-=10;
  until(s,p,q=>q.trip.catch===0);assert.equal(p.trip.landed,basket);
});
test('a newly blocked walking lane sends the loaded fisher around with the same basket',()=>{
  const {state,pier}=newPier();setWorkers(state,pier.id,1);
  until(state,pier,p=>p.trip?.stage==='returning' && p.trip.z<7 && p.trip.next && p.trip.step===0);
  const blocked={...pier.trip.next}, basket=pier.trip.catch;
  state.frontier.fortifications.push({id:'test-wall',type:'wall',status:'ready',...blocked});
  tick(state,1);
  assert.notDeepEqual(pier.trip.next,blocked); assert.equal(pier.trip.catch,basket);
  until(state,pier,p=>p.trip.landed>0);assert.equal(pier.trip.landed,basket);
});

test('a completed fishing pier counts toward the village food objective',()=>{
  const {state}=newPier();
  assert.ok(build(state,'cottage',-2,0).ok);tick(state,30);
  assert.equal(objective(state).step,2);
});
