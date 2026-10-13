import test from 'node:test';
import assert from 'node:assert/strict';
import { captureUnitMotion, recordUnitMotion, sampleUnitMotion, stride, angleBetween } from '../js/unit-motion.js';
import * as army from '../js/frontier.js';
import { RESOURCE_NAMES } from '../js/catalog.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function segment(u,from,to,clock=1){Object.assign(u,from);const prior=captureUnitMotion([u]);Object.assign(u,to);recordUnitMotion([u],prior,clock);}
test('a completed step has constant visual speed at 15, 30, 60 and 144 Hz, independent of game speed',()=>{
 for(const fps of [15,30,60,144])for(const speed of [1,3]){
  const u={x:0,z:0,yaw:0,status:'active'},f={clock:1,subsecond:0};segment(u,{x:0},{x:.28});
  const original=JSON.stringify(u);let last=sampleUnitMotion(u,f);
  for(let dt=speed/fps;f.subsecond+dt<.25;){f.subsecond+=dt;const p=sampleUnitMotion(u,f);close((p.x-last.x)/dt,1.12);last=p;}
  assert.equal(JSON.stringify(u),original,'sampling cannot mutate authority');
 }
});
test('corners follow the two completed segments without cutting diagonally across the inside',()=>{
 const u={x:0,z:0,yaw:0,status:'active'},f={clock:1,subsecond:0};segment(u,{x:0,z:0},{x:.2,z:0});
 for(let i=0;i<=10;i++){f.subsecond=i*.025;close(sampleUnitMotion(u,f).z,0);}
 segment(u,{x:.2,z:0},{x:.2,z:.2},1.25);f.clock=1.25;
 for(let i=0;i<=10;i++){f.subsecond=i*.025;close(sampleUnitMotion(u,f).x,.2);}
});
test('pause keeps the same intermediate position and shortest-arc facing',()=>{
 const u={x:0,z:0,yaw:3.1,status:'active'},f={clock:1,subsecond:.12};segment(u,{x:0,yaw:3.1},{x:.28,yaw:-3.1});
 const p=sampleUnitMotion(u,f);for(let i=0;i<90;i++)assert.deepEqual(sampleUnitMotion(u,f),p);
 assert.ok(Math.abs(angleBetween(3.1,p.yaw))<.05);
 const actor={phase:1,walkWeight:1};const a=stride(actor,0,0);for(let i=0;i<90;i++)close(stride(actor,0,0),a);
});
test('spawn, restore, out-of-band relocation and barracks deployment reset motion without sweeping across the map',()=>{
 const u={x:0,z:0,yaw:0,status:'active'},f={clock:1,subsecond:.1};assert.equal(sampleUnitMotion(u,f).reset,true);
 segment(u,{x:0},{x:.28});const restored=JSON.parse(JSON.stringify(u));assert.equal(sampleUnitMotion(restored,f).reset,true);
 u.x=20;close(sampleUnitMotion(u,f).x,20);assert.equal(sampleUnitMotion(u,f).reset,true);
 segment(u,{x:0,garrisoned:true},{x:.28,garrisoned:false});assert.equal(sampleUnitMotion(u,f).reset,true);
 segment(u,{x:0,garrisoned:false},{x:5});assert.equal(sampleUnitMotion(u,f).reset,true);
});
test('stride advances with distance and settles when a walker waits, with no frame-rate dependence',()=>{
 const stopped=[];
 for(const fps of [30,60,144]){const actor={phase:0,walkWeight:0};for(let i=0;i<fps;i++)stride(actor,1/fps,1/fps);close(actor.phase,10);
  for(let i=0;i<fps/2;i++)stride(actor,0,1/fps);stopped.push(actor.walkWeight);assert.ok(actor.walkWeight<.001);
 }
 close(stopped[0],stopped[2]);
});
function fixture(){
 const state={day:1,population:8,citizens:Array.from({length:8},(_,i)=>({id:`c${i}`,name:`Person ${i}`,job:'idle'})),buildings:[{id:'b',type:'barracks',x:-3,z:0,status:'ready',rotation:0}],resources:Object.fromEntries(RESOURCE_NAMES.map(r=>[r,1000])),storage:Object.fromEntries(RESOURCE_NAMES.map(r=>[r,5000]))};
 const ctx={home:{x:0,z:3},isLand:()=>true,isWalkable:(x,z)=>!state.buildings.some(b=>b.x===x&&b.z===z),regionAt:()=>({id:'home'})};
 state.frontier=army.createFrontierState(ctx);const u=army.recruitTroop(state,'spearman',null,ctx).unit;army.tickFrontier(state,36,ctx);return{state,u,ctx};
}
test('real frontier ticks record completed movement, preserve save format and determinism across partitions',()=>{
 const {state,u,ctx}=fixture();assert.ok(army.commandTroops(state,[u.id],{type:'move',x:3,z:3},ctx).ok);
 for(let i=0;i<240;i++)army.tickFrontier(state,1/60,ctx);
 const exact=JSON.parse(JSON.stringify(state)),split=JSON.parse(JSON.stringify(state));army.tickFrontier(exact,4,ctx);for(let i=0;i<16;i++)army.tickFrontier(split,.25,ctx);assert.deepEqual(exact,split);
 const text=JSON.stringify(state);assert.ok(!text.includes('walkWeight')&&!text.includes('fromYaw'));
 const p=sampleUnitMotion(u,state.frontier);assert.equal(p.reset,false);assert.ok(Math.hypot(p.x-u.x,p.z-u.z)<=.3);
});
test('interpolated real routes stay out of solid walls and a closed gate',()=>{
 const {state,u,ctx}=fixture();const f=state.frontier;
 for(let z=-3;z<=5;z++)f.fortifications.push({id:`w${z}`,type:z===1?'gate':'wall',x:0,z,rotation:1,faction:'player',status:'ready',open:false});
 assert.ok(army.commandTroops(state,[u.id],{type:'move',x:3,z:3},ctx).ok);
 for(let i=0;i<1200;i++){army.tickFrontier(state,1/60,ctx);const p=sampleUnitMotion(u,f);assert.ok(!f.fortifications.some(w=>Math.round(p.x)===w.x&&Math.round(p.z)===w.z),'No interpolation through a solid tile');}
 assert.equal(u.order.type,'hold');
});
