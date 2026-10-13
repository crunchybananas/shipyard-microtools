import { VillageWorld, CELL } from '../../js/world.js';
import * as sim from '../../js/sim.js';
import * as army from '../../js/frontier.js';
const $=id=>document.getElementById(id),world=new VillageWorld($('scene')),state=sim.createGame();
await world.load();
// This is a funded motion fixture, never an earned campaign or saved town.
state.citizens=Array.from({length:14},(_,i)=>({...state.citizens[i%6],id:`motion-${i}`,name:`Resident ${i+1}`,job:'idle',workplace:null}));state.population=14;
state.buildings.push({id:'review-barracks',type:'barracks',x:1,z:4,rotation:0,status:'ready',level:1,workerIds:[],paused:false});
for(const k in state.resources){state.resources[k]=1000;state.storage[k]=5000;}
const ctx=sim.frontierContext(state),units=[];
for(const kind of ['spearman','spearman','archer','medic']){const offer=army.recruitTroop(state,kind,null,ctx);if(!offer.ok)throw Error(offer.reason);units.push(offer.unit);}
army.tickFrontier(state,46,ctx);
// A narrow, real gate in the southern clearing. All moves still use frontier paths.
for(let x=-4;x<=4;x++){
 const type=x===0?'gate':'wall';state.frontier.fortifications.push({id:`review-fort-${x}`,type,name:type,faction:'player',x,z:6,rotation:0,status:'ready',hp:180,maxHp:180,open:type==='gate',progress:12,work:12,escrow:{}});
}
world.sync(state);world.pan.set(-1*CELL,0,5*CELL);world.targetZoom=world.zoom=16;world.targetAzimuth=world.azimuth=.4;
let playing=true,speed=1,last=performance.now(),elapsed=0,route='Ready',recording=null;
function order(type,x,z){const result=army.commandTroops(state,units.map(u=>u.id),{type,...(x===undefined?{}:{x,z})},ctx);route=result.reason;$('status').textContent=route;world.sync(state);}
$('march').onclick=()=>order('move',2,8);$('return').onclick=()=>order('retreat');$('hold').onclick=()=>order('hold');
$('pause').onclick=()=>{playing=!playing;$('pause').textContent=playing?'Pause':'Resume';};$('speed').onchange=()=>{speed=Number($('speed').value);};
$('record').onclick=()=>{
 if(recording)return;
 if($('download').href.startsWith('blob:'))URL.revokeObjectURL($('download').href);
 const stream=$('scene').captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm'});recording=recorder;$('record').disabled=true;
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{const url=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));$('download').href=url;$('download').download=`company-motion-${speed}x.webm`;$('download').hidden=false;$('replay').src=url;$('replay').hidden=false;stream.getTracks().forEach(t=>t.stop());$('record').disabled=false;recording=null;};
 recorder.start();setTimeout(()=>recorder.stop(),12000);
};
$('status').textContent='Ready. Four trained residents, including a medic.';
function frame(now){const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
 if(playing){army.tickFrontier(state,dt*speed,ctx);world.syncFrontier();}
 world.render(dt,{speed:playing?speed:0,playing,dayTime:.4});
 elapsed+=dt;if(elapsed>.2){elapsed=0;$('metrics').textContent=`${playing?'Running':'Paused'} · ${speed}× · simulation ${state.frontier.clock.toFixed(2)}s\n`+units.map(u=>`${u.kind.padEnd(8)} ${u.garrisoned?'inside barracks':u.order.type.padEnd(8)} (${u.x.toFixed(2)}, ${u.z.toFixed(2)})`).join('\n');}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
