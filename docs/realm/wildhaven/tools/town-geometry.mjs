/** Geometry and motion fixtures; no browser, save, or simulation progress is changed. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
const sources=['js/discovery.js','assets/living-kit.glb','js/world.js','js/sim.js','js/catalog.js','assets/village-kit.glb','assets/village-kit.json','assets/town-kit.glb','assets/town-kit.json','tools/town-geometry.mjs','tools/worksite-fixture.mjs'];
const hashes=()=>Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
const sourceHashesAtStart=hashes();
const threeUrl = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'three') return { url: ${JSON.stringify(threeUrl)}, shortCircuit: true }; return next(specifier, context); }`));
const THREE = await import('three');
const { GLTFLoader } = await import('../../vendor/three/GLTFLoader.js');
const { VillageWorld, CELL } = await import('../js/world.js');
const { createGame, groundHeight, isLand, restore, setWorkers, buildingEntrance } = await import('../js/sim.js');
const { BUILDINGS, getBuildingSpec } = await import('../js/catalog.js');
const assets = new URL('../assets/', import.meta.url).pathname;
const templates=new Map();for(const name of ['village-kit','town-kit','living-kit']){const raw=fs.readFileSync(assets+name+'.glb');const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');for(const root of gltf.scene.children)templates.set(root.name,root);}
function makeWorld(type,rotation=0){const w=Object.create(VillageWorld.prototype);Object.assign(w,{templates,state:createGame(),scene:new THREE.Scene(),buildings:new Map(),decor:new Map(),actors:[],clock:0,assetMetadata:JSON.parse(fs.readFileSync(assets+'town-kit.json')).assets});const b={id:'job',type,x:3,z:1,rotation,level:1,status:'ready',workerIds:['worker'],production:{efficiency:1}};w.state.buildings.push(b);for(const building of w.state.buildings)w.buildings.set(building.id,w.makeBuilding(building));w.updatePaths();const a=w.addActor(0,{id:'worker',job:BUILDINGS[type]?.job||'farmer',workplace:'job'});return{w,b,a};}
const results=[];for(const type of Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].job)){for(let rotation=0;rotation<4;rotation++){const{w,b,a}=makeWorld(type,rotation),station=w.workStation(a,b);if(station){for(let frame=0;frame<500;frame++){w.clock+=.1;w.updateActors(.1);}results.push({type,rotation,tool:a.toolType,station:true,position:[a.root.position.x,a.root.position.z].map(v=>+v.toFixed(2)),state:a.root.userData.workState,workSeconds:+a.workTime.toFixed(1)});}else results.push({type,rotation,tool:a.toolType,station:false});}}

assert.equal(results.filter(r=>r.station).length,results.length);
const checks={stations:results.length};
{
 const {w,b,a}=makeWorld('smith');
 const blocker={id:'wall',type:'cottage',x:3,z:2,level:1,status:'ready'};w.state.buildings.push(blocker);w.buildings.set(blocker.id,w.makeBuilding(blocker));w.updatePaths();const alternate=w.workStation(a,b);assert.ok(alternate);assert.equal(alternate.access,'side');for(const[dx,dz]of[[1,0],[-1,0],[0,-1]]){const wall={id:'wall-'+dx+','+dz,type:'cottage',x:b.x+dx,z:b.z+dz,level:1,status:'ready'};w.state.buildings.push(wall);w.buildings.set(wall.id,w.makeBuilding(wall));}w.updatePaths();assert.equal(w.workStation(a,b),null);checks.blockedEntrance='real anvil side access; enclosed site waits';
}
{
 const {w,b,a}=makeWorld('sawmill');w.routeActor(a);assert.ok(a.station);const oldExit=a.station.exit;const p=a.root.position.clone();a.activity=null;w.routeActor(a);assert.ok(Math.hypot(a.path[0].x*CELL-p.x,a.path[0].z*CELL-p.z)<CELL*1.1);assert.notDeepEqual(a.path[0],oldExit);checks.midRouteReassignment='cardinal first waypoint';
 const stationary=w.workStation(a,b);a.station=stationary;a.path=[];a.activity='work';a.wait=8;a.root.position.set(stationary.point.x*CELL,stationary.point.y,stationary.point.z*CELL);b.production.efficiency=0;w.updateActors(.1);assert.equal(a.root.userData.workState,'waiting');assert.equal(a.workTime,0);b.production.efficiency=1;w.updateActors(.1);assert.equal(a.root.userData.workState,'working');checks.productionGate='blocked inputs stop work motion';
}
{
 const {w}=makeWorld('well');w.state.buildings.push(...[[4,0],[5,0],[3,4],[4,4]].map(([x,z],i)=>({id:'h'+i,type:'cottage',x,z,level:1,status:'ready'})));
 assert.deepEqual(w.showServiceArea('well',{x:0,z:0},1).servedIds,['hearth','h0']);assert.deepEqual(w.showServiceArea('well',{x:0,z:0},2).servedIds,['hearth','h0','h1','h2']);assert.equal(w.showServiceArea('clinic',{x:0,z:0},1).servedHomes,4);w.showServiceArea(null,null);assert.equal(w.serviceArea.visible,false);checks.coverage='Euclidean boundaries and upgraded radius exact';
 w.reduced=true;let last=Infinity;const snapshots=[];for(let i=0;i<=30;i++){w.state.pressure={active:{id:'qa',announcedDay:5,deadline:8}};w.state.day=5+Math.floor(i/10);w.state.time=i%10*9;const before=JSON.stringify(w.state);w.updatePressure();assert.equal(JSON.stringify(w.state),before);const r=Math.hypot(w.pressureBoat.position.x,w.pressureBoat.position.z);assert.ok(r<=last);last=r;w.pressureBoat.updateWorldMatrix(true,true);let vertices=0;w.pressureBoat.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let n=0;n<p.count;n++){const v=new THREE.Vector3().fromBufferAttribute(p,n).applyMatrix4(o.matrixWorld);assert.equal(isLand(v.x/CELL,v.z/CELL),false);vertices++;}});snapshots.push(vertices);}w.state.pressure.active=null;w.updatePressure();assert.equal(w.pressureBoat.visible,false);assert.equal(w.pressureFlag.visible,false);checks.pressure={poses:31,verticesChecked:snapshots.reduce((a,b)=>a+b,0),readOnly:true};
}
{
 const {w}=makeWorld('farm');w.pathMaterial=new THREE.MeshStandardMaterial();w.state.citizens=Array.from({length:76},(_,i)=>({id:'citizen-'+i,job:'idle',workplace:null}));w.sync(w.state);assert.equal(w.actors.length,76);assert.ok(w.actors.find(a=>a.citizen.id==='citizen-75'));checks.population=76;
}

{
 const {w}=makeWorld('farm');w.state=createGame();w.state.citizens=[];w.pathMaterial=new THREE.MeshStandardMaterial();w.birds=[];w.nature();w.replaceTrees();
 const types=['sawmill','smith','bakery','farm','clinic','barracks','school','lumber','quarry','mine','market','orchard'];
 types.forEach((type,i)=>{const b={id:'site-'+i,type,x:[-5,-2,1,4][i%4],z:-3+Math.floor(i/4)*3,rotation:i%4,level:1,status:'ready',workerIds:[],production:{efficiency:1}};for(let n=0;n<3;n++){const c={id:b.id+'-'+n,job:BUILDINGS[type].job,workplace:b.id};b.workerIds.push(c.id);w.state.citizens.push(c);}w.state.buildings.push(b);});
 w.sync(w.state);let steps=0,working=0,walking=0;const stations=new Set();
 for(let frame=0;frame<2400;frame++){w.clock+=.05;w.updateActors(.05);for(const a of w.actors){const p=a.root.position,cx=Math.round(p.x/CELL),cz=Math.round(p.z/CELL),own=[a.station?.buildingId,a.path[0]?.stationBuilding];assert.ok(isLand(p.x/CELL,p.z/CELL));assert.ok(!w.state.buildings.some(b=>b.x===cx&&b.z===cz&&!own.includes(b.id)),`other building collision ${a.citizen.id} at ${cx},${cz}`);assert.ok(!w.decor.has(`${cx},${cz}`)||w.state.buildings.some(b=>b.x===cx&&b.z===cz&&own.includes(b.id)));if(a.root.userData.workState==='working'||a.root.userData.workState==='watching'){working++;stations.add(a.workplace);}if(a.root.userData.workState==='walking')walking++;steps++;}}
 checks.mixedTown={actors:w.actors.length,seconds:120,positionSamples:steps,workingSamples:working,walkingSamples:walking,productiveSites:stations.size,naturalObstacleTiles:w.decor.size};assert.ok(stations.size>=8);
}
{
 const raw=fs.readFileSync(new URL('../review/campaign-save.json',import.meta.url),'utf8');
 checks.crowd=[];
 for(const idleOnly of[false,true]){
  const {w}=makeWorld('farm');w.state=restore(raw);assert.ok(w.state,'campaign checkpoint restores');
  if(idleOnly)for(const c of w.state.citizens){c.job='idle';c.workplace=null;}
  w.pathMaterial=new THREE.MeshStandardMaterial();w.birds=[];w.nature();w.replaceTrees();w.sync(w.state);
  const before=JSON.stringify(w.state);let minimum=Infinity,hardOverlaps=0,closePairs=0,pairSamples=0,illegal=0;
  for(let frame=0;frame<3600;frame++){w.clock+=.05;w.updateActors(.05);if(frame<600||frame%20!==0)continue;
   for(let i=0;i<w.actors.length;i++){const a=w.actors[i],p=a.root.position,cx=Math.round(p.x/CELL),cz=Math.round(p.z/CELL),owners=[a.station?.buildingId,a.path[0]?.stationBuilding];
    if(!isLand(p.x/CELL,p.z/CELL)||w.state.buildings.some(b=>b.x===cx&&b.z===cz&&!owners.includes(b.id)))illegal++;
    for(let j=i+1;j<w.actors.length;j++){const q=w.actors[j].root.position,d=Math.hypot(p.x-q.x,p.z-q.z);minimum=Math.min(minimum,d);if(d<.34)hardOverlaps++;if(d<.415)closePairs++;pairSamples++;}
   }
  }
  const settledCells=new Set(w.actors.filter(a=>!a.path.length).map(a=>Math.round(a.root.position.x/CELL)+','+Math.round(a.root.position.z/CELL))).size;
  const result={fixture:idleOnly?'76 idle citizens':'earned 76-citizen town',seconds:180,pairSamples,minimumSeparation:+minimum.toFixed(4),hardOverlaps,closePairs,illegal,settledCells};
  checks.crowd.push(result);console.error(JSON.stringify(result));assert.equal(JSON.stringify(w.state),before);assert.equal(hardOverlaps,0);assert.equal(closePairs,0);assert.ok(minimum>=.415);assert.equal(illegal,0);if(idleOnly)assert.ok(settledCells>=25);
 }
}
{
 const {createOpenWorksiteState}=await import('./worksite-fixture.mjs');
 const {w}=makeWorld('farm');w.state=createOpenWorksiteState();w.pathMaterial=new THREE.MeshStandardMaterial();w.birds=[];w.nature();w.replaceTrees();w.sync(w.state);
 const workFrames=new Map(),firstWork=new Map(),workersSeen=new Set();let walking=0;
 for(let frame=0;frame<3600;frame++){w.clock+=.05;w.updateActors(.05);for(const a of w.actors){if(a.root.userData.workState==='working'||a.root.userData.workState==='watching'){workFrames.set(a.workplace,(workFrames.get(a.workplace)||0)+1);if(!firstWork.has(a.workplace))firstWork.set(a.workplace,+(frame*.05).toFixed(2));workersSeen.add(a.citizen.id);}if(a.root.userData.workState==='walking')walking++;}}
 checks.openWorksites={sites:w.state.buildings.length-2,actors:w.actors.length,seconds:180,productiveSites:workFrames.size,workersWhoWorked:workersSeen.size,firstWork:Object.fromEntries(firstWork),walkingSamples:walking,atEnd:Object.fromEntries([...new Set(w.actors.map(a=>a.root.userData.workState))].map(key=>[key,w.actors.filter(a=>a.root.userData.workState===key).length]))};console.error(JSON.stringify(checks.openWorksites));assert.equal(workFrames.size,w.state.buildings.length-2);assert.ok(workersSeen.size>=w.actors.length*.85);
}
{
 const {w}=makeWorld('farm');w.state=restore(fs.readFileSync(new URL('../review/campaign-services-lanes-save.json',import.meta.url),'utf8'));assert.ok(w.state);w.pathMaterial=new THREE.MeshStandardMaterial();w.birds=[];w.nature();w.replaceTrees();
 for(const b of w.state.buildings)if(b.status==='ready'&&getBuildingSpec(b.type,b.level).workers)setWorkers(w.state,b.id,getBuildingSpec(b.type,b.level).workers);
 w.sync(w.state);const staffed=w.state.buildings.filter(b=>b.workerIds?.length),stations=staffed.filter(b=>w.workStation(w.actors.find(a=>a.workplace===b.id),b)).length,productive=new Set();let workSamples=0;
 const before=JSON.stringify(w.state);for(let frame=0;frame<1200;frame++){w.clock+=.1;w.updateActors(.1);for(const a of w.actors)if(a.root.userData.workState==='working'||a.root.userData.workState==='watching'){productive.add(a.workplace);workSamples++;}}
 const finalStates=Object.fromEntries([...new Set(w.actors.map(a=>a.root.userData.workState))].map(key=>[key,w.actors.filter(a=>a.root.userData.workState===key).length]));
 checks.earnedLaneTown={actors:w.actors.length,buildings:w.state.buildings.length,staffedSites:staffed.length,reachableStations:stations,productiveSites:productive.size,workSamples,seconds:120,finalStates};assert.equal(stations,staffed.length);assert.ok(productive.size>=staffed.length-2);assert.ok((finalStates.working||0)>=w.actors.length*.35);assert.equal(JSON.stringify(w.state),before);
 w.createPreview();for(let rotation=0;rotation<4;rotation++){const tile={x:0,z:0},front=buildingEntrance({...tile,rotation});w.showPreview('smith',tile,true,rotation);const p=w.entranceMark.geometry.attributes.position;assert.ok(Math.abs(p.getX(0)-front.x*1.14)<.001);assert.ok(Math.abs(p.getZ(0)-front.z*1.14)<.001);assert.ok(Math.abs(p.getY(0)-groundHeight(p.getX(0)/CELL,p.getZ(0)/CELL)-.045)<.001);}w.showPreview(null,null);assert.equal(w.entranceMark.visible,false);checks.entrancePreview='four rotated arrows follow terrain and clear with preview';
}
const sourceHashesAtEnd=hashes(),sourcesStable=JSON.stringify(sourceHashesAtStart)===JSON.stringify(sourceHashesAtEnd);
const report={scope:'Isolated real-GLB geometry and renderer motion fixtures. No browser or user save is used. Rendered visual review is a separate check.',checkedAt:new Date().toISOString(),sourceHashesAtStart,sourceHashesAtEnd,sourcesStable,checks};
fs.writeFileSync(new URL('../review/town-geometry-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
assert.ok(sourcesStable);
