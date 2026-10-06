/** Presentation-only traffic regression on the earned town, matching town-render.mjs staffing. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
const sources=['js/discovery.js','assets/living-kit.glb','js/world.js','js/island.js','js/frontier.js','js/sim.js','js/catalog.js','assets/village-kit.glb','assets/town-kit.glb','assets/town-kit.json','tools/town-traffic.mjs','review/campaign-services-lanes-save.json'];
const hashes=()=>Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
const sourceHashesAtStart=hashes();
const threeUrl = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'three') return { url: ${JSON.stringify(threeUrl)}, shortCircuit: true }; return next(specifier, context); }`));
const THREE=await import('three'),{GLTFLoader}=await import('../../vendor/three/GLTFLoader.js');
const {VillageWorld,CELL}=await import('../js/world.js');
const {restore,setWorkers,isLand}=await import('../js/sim.js');
const {getBuildingSpec}=await import('../js/catalog.js');
const assets=new URL('../assets/',import.meta.url).pathname,templates=new Map();
for(const name of['village-kit','town-kit','living-kit']){const raw=fs.readFileSync(assets+name+'.glb'),gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');for(const root of gltf.scene.children)templates.set(root.name,root);}
const w=Object.create(VillageWorld.prototype),state=restore(fs.readFileSync(new URL('../review/campaign-services-lanes-save.json',import.meta.url),'utf8'));
Object.assign(w,{templates,state,scene:new THREE.Scene(),buildings:new Map(),decor:new Map(),actors:[],clock:0,birds:[],pathMaterial:new THREE.MeshStandardMaterial(),assetMetadata:JSON.parse(fs.readFileSync(assets+'town-kit.json')).assets});
w.nature();w.replaceTrees();w.sync(state);
for(const b of state.buildings)if(b.status==='ready'&&getBuildingSpec(b.type,b.level).workers)setWorkers(state,b.id,getBuildingSpec(b.type,b.level).workers);
w.sync(state);
const before=JSON.stringify(state),records=new Map(),illegalExamples=[];let illegal=0,minSeparation=Infinity,minimumPair=null,maxNoWaypointSeconds=0;
const sampleSeconds=Number(process.env.TRAFFIC_SECONDS||180);
for(let frame=0;frame<sampleSeconds*10;frame++){
 w.clock+=.1;w.updateActors(.1);
 for(const a of w.actors){
  const p=a.root.position;let r=records.get(a.citizen.id);
  if(!r){r={id:a.citizen.id,job:a.citizen.job,workplace:a.workplace,workSeconds:0,walkSeconds:0,walkMeters:0,start:[p.x,p.z],last:[p.x,p.z],min:[p.x,p.z],max:[p.x,p.z],waypoints:0,lastWaypoint:null,noWaypointSeconds:0,maxNoWaypointSeconds:0};records.set(r.id,r);}
  if(frame===sampleSeconds*10-600){r.start=[p.x,p.z];r.min=[p.x,p.z];r.max=[p.x,p.z];r.walkMeters=0;r.walkSeconds=0;r.workSeconds=0;r.waypoints=0;}
  if(a.root.userData.workState==='walking'){r.walkSeconds+=.1;r.walkMeters+=Math.hypot(p.x-r.last[0],p.z-r.last[1]);}
  if(['working','watching'].includes(a.root.userData.workState))r.workSeconds+=.1;
  if(a.lastCell!==r.lastWaypoint){r.lastWaypoint=a.lastCell;r.waypoints++;r.noWaypointSeconds=0;}
  else if(a.root.userData.workState==='walking'){r.noWaypointSeconds+=.1;r.maxNoWaypointSeconds=Math.max(r.maxNoWaypointSeconds,r.noWaypointSeconds);maxNoWaypointSeconds=Math.max(maxNoWaypointSeconds,r.noWaypointSeconds);if(r.noWaypointSeconds>20&&!r.delayExample)r.delayExample={at:w.clock,position:p.toArray(),next:a.path[0],activity:a.activity,near:w.actors.filter(b=>b!==a&&p.distanceTo(b.root.position)<1.2).map(b=>({id:b.citizen.id,position:b.root.position.toArray(),state:b.root.userData.workState,station:b.station?.buildingId}))};}
  else r.noWaypointSeconds=0;
  r.min=[Math.min(r.min[0],p.x),Math.min(r.min[1],p.z)];r.max=[Math.max(r.max[0],p.x),Math.max(r.max[1],p.z)];r.last=[p.x,p.z];
  const cx=Math.round(p.x/CELL),cz=Math.round(p.z/CELL),owners=[a.station?.buildingId,a.path[0]?.stationBuilding];
  if(!isLand(p.x/CELL,p.z/CELL)||state.buildings.some(b=>b.x===cx&&b.z===cz&&!owners.includes(b.id))){illegal++;if(illegalExamples.length<8)illegalExamples.push({time:w.clock,id:a.citizen.id,activity:a.activity,position:p.toArray(),next:a.path[0],station:a.station?.buildingId,building:state.buildings.find(b=>b.x===cx&&b.z===cz)?.id});}
 }
 if(frame>=300&&frame%10===0)for(let i=0;i<w.actors.length;i++)for(let j=i+1;j<w.actors.length;j++){const a=w.actors[i],b=w.actors[j],d=Math.hypot(a.root.position.x-b.root.position.x,a.root.position.z-b.root.position.z);if(d<minSeparation){minSeparation=d;minimumPair={at:w.clock,a:a.citizen.id,b:b.citizen.id,states:[a.root.userData.workState,b.root.userData.workState],stations:[a.station?.buildingId,b.station?.buildingId]};}}
}
const actors=w.actors.map(a=>{const r=records.get(a.citizen.id);delete r.lastWaypoint;return{...r,netMeters:Math.hypot(r.last[0]-r.start[0],r.last[1]-r.start[1]),rangeMeters:Math.hypot(r.max[0]-r.min[0],r.max[1]-r.min[1]),state:a.root.userData.workState,activity:a.activity,path:a.path.slice(0,3),remainingWaypoints:a.path.length,goal:a.goal?.id,station:a.station?.buildingId};});
const stalled=actors.filter(a=>a.walkSeconds>50&&(a.rangeMeters<1.5||a.waypoints<2));
const summary={seconds:sampleSeconds,measurementSeconds:60,actors:actors.length,walking:actors.filter(a=>a.state==='walking').length,working:actors.filter(a=>a.state==='working').length,stalled:stalled.map(a=>({id:a.id,job:a.job,range:+a.rangeMeters.toFixed(3),meters:+a.walkMeters.toFixed(3),waypoints:a.waypoints,goal:a.goal,position:a.last,next:a.path[0]})),maxNoWaypointSeconds,illegal,illegalExamples,minSeparation,minimumPair,stateUnchanged:before===JSON.stringify(state)};
const sourceHashesAtEnd=hashes(),sourcesStable=JSON.stringify(sourceHashesAtStart)===JSON.stringify(sourceHashesAtEnd);
const report={checkedAt:new Date().toISOString(),scope:'Presentation-only replay of the earned campaign with public full-staff requests. Every actor is measured; the final 60-second window reports walked distance, spatial range, net displacement and completed waypoints. No browser or save is changed.',sourceHashesAtStart,sourceHashesAtEnd,sourcesStable,summary,actors};
fs.writeFileSync(new URL('../review/'+(process.env.TRAFFIC_REPORT||'town-traffic-report.json'),import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
assert.ok(sourcesStable);assert.equal(summary.stateUnchanged,true);assert.equal(illegal,0);assert.equal(stalled.length,0);assert.ok(maxNoWaypointSeconds<30,`A walker made no route progress for ${maxNoWaypointSeconds} seconds`);
