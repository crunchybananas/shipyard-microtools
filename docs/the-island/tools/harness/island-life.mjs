import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {beginPlay,renderedFrames} from './play-ready.mjs';
export default async function(h){
 const out=process.env.SHOT_DIR,pass=[],fail=[],errors=[],shots=[];
 if(out)mkdirSync(out,{recursive:true});
 const ok=(name,value,data)=>{(value?pass:fail).push({name,...(!value?{data}:{})});};
 h.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description));});
 await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`);
 for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}
 await beginPlay(h);await h.evaluate(`ABYME.W.time=12;ABYME.W.timeDrift=0;ABYME.W.sunFrozen=true;document.getElementById('debug-panel').style.display='none';1`);
 const beach=await h.evaluate(`(async()=>{const {SHORE_ROCKS}=await import('/the-island/js/shore-details.js');const {core,perched,THREE,player}=ABYME;const logs=core.children.find(o=>o.name==='driftwood'),wrack=core.children.find(o=>o.name==='wrack');let eastern=-Infinity;const m=new THREE.Matrix4();for(let i=0;i<logs.count;i++){logs.getMatrixAt(i,m);eastern=Math.max(eastern,m.elements[12]);}
 ABYME.tp(4,-100,0,0);const blocked=[];for(let x=4;x>=-20;x-=.2){if(!player._step(x,-100))blocked.push(x);else{player.pos.x=x;player.pos.z=-100;}}player.syncCamera();
 return {logs:logs.count,wrack:wrack.count,gulls:perched.filter(b=>b.userData.species==='gull').length,eastern,rocks:SHORE_ROCKS,blocked};})()`);
 ok('shore scatter is deliberately sparse',beach.logs===6&&beach.wrack===9&&beach.gulls===3,beach);
 ok('driftwood stays west of the open arrival',beach.eastern<=-15,beach);
 ok('one tide-rock cluster belongs beside the working shore',beach.rocks.length===1&&beach.rocks[0].x<-30,beach);
 ok('the arrival-to-working-shore walking line remains clear',beach.blocked.length===0,beach.blocked);
 await h.evaluate(`(()=>{const u=ABYME.perched[0].userData;ABYME.tp(u.px+10,u.pz,0,0);return true;})()`);await renderedFrames(h);
 const near=await h.evaluate(`(()=>{const u=ABYME.perched[0].userData;return u.mesh.visible&&!u.farMesh.visible;})()`);
 await h.evaluate('ABYME.tp(-82,-37,0,0);1');await renderedFrames(h);
 const far=await h.evaluate(`(()=>{const u=ABYME.perched[0].userData;return !u.mesh.visible&&u.farMesh.visible&&u.farMesh.geometry.index.count<u.mesh.geometry.index.count*.35&&u.mesh.skeleton.bones.every((b,i)=>b===u.farMesh.skeleton.bones[i]);})()`);
 ok('distance selects one lighter skin on the same animated joints',near&&far,{near,far});
 const boat=await h.evaluate(`(()=>{const {refs,modelRefs,THREE}=ABYME,h=refs.doryHull;h.updateWorldMatrix(true,false);const ray=new THREE.Raycaster(h.localToWorld(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0).transformDirection(h.matrixWorld),0,3);const hit=ray.intersectObject(h,false)[0];h.geometry.computeBoundingBox();const b=h.geometry.boundingBox;return {source:h.geometry.userData.authoring,triangles:h.geometry.index.count/3,floor:hit?h.worldToLocal(hit.point.clone()).y:null,width:b.max.x-b.min.x,length:b.max.z-b.min.z,same:h.geometry===modelRefs.doryHull.geometry,oldSeats:h.parent.children.filter(o=>o.isMesh&&!o.name).length};})()`);
 ok('the full-size dory uses the authored hull',boat.source==='Blender island_life.py'&&boat.triangles===4836,boat);
 ok('open hull contains a floor below its gunwale',boat.floor<-.18&&boat.floor>-.3,boat);
 ok('the dory keeps its human scale and replaces the old seats',boat.width>1.2&&boat.width<1.4&&boat.length>3&&boat.length<3.3&&boat.oldSeats===0,boat);
 ok('the miniature shares the same authored boat geometry',boat.same,boat);
 await h.evaluate(`(()=>{const {W,refs,player,THREE,UI}=ABYME;W.flags.returned=true;UI.clearWhispers();ABYME.tp(-24.2,-103.7,0,0);const p=refs.doryOar.getWorldPosition(new THREE.Vector3());player.yaw=Math.atan2(player.pos.x-p.x,player.pos.z-p.z);player.pitch=Math.atan2(p.y-player.pos.y-player.eye,Math.hypot(player.pos.x-p.x,player.pos.z-p.z));player.syncCamera();return true;})()`);await renderedFrames(h);
 const point=await h.evaluate(`(()=>{const p=ABYME.refs.doryOar.getWorldPosition(new ABYME.THREE.Vector3()).project(ABYME.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};})()`);
 await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await renderedFrames(h);
 const hovered=await h.evaluate('ABYME.interact.hovered?.id');
 await h.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await renderedFrames(h);
 const oar=await h.evaluate(`({text:document.getElementById('whisper').textContent,queued:ABYME.UI._whisperQueue.map(w=>w.text)})`);
 ok('a real pointer still operates the rebuilt dory',hovered==='oar'&&[oar.text,...oar.queued].some(t=>t.includes('oar lifts freely')),{hovered,oar});
 const clue=await h.evaluate(`(()=>{const a=ABYME.refs.songBird.children[0],b=ABYME.modelRefs.songBird.children[0];const crown=ABYME.refs.stone2;const foot=ABYME.refs.songBird.getWorldPosition(new ABYME.THREE.Vector3());const ray=new ABYME.THREE.Raycaster(foot.clone().add(new ABYME.THREE.Vector3(0,.1,0)),new ABYME.THREE.Vector3(0,-1,0));const hit=ray.intersectObject(crown,false)[0];return {perchError:hit?Math.abs(hit.point.y-foot.y):99,species:a.userData.species,independent:a.userData.mesh.skeleton!==b.userData.mesh.skeleton,joints:Object.keys(a.userData.bones).length};})()`);
 ok('the stone clue has its own rig at both scales',clue.species==='songbird'&&clue.independent&&clue.joints===12&&clue.perchError<.002,clue);
 await h.evaluate(`ABYME.W.time=7.2;ABYME.tp(135,-146,0,0);ABYME.game._birdSing();1`);await h.wait(.12);await renderedFrames(h);
 const singing=await h.evaluate(`(()=>{const b=ABYME.refs.songBird;return {live:b.userData.callUntilMs>performance.now(),jaw:b.children[0].userData.bones.jaw.node.rotation.x};})()`);
 ok('the actual musical clue opens the bird beak with its note',singing.live&&singing.jaw>.02,singing);
 await h.evaluate(`ABYME.game.resetRuntime();1`);await h.wait(.8);
 ok('a fresh runtime cancels pending beak gestures with the notes',await h.evaluate('ABYME.refs.songBird.userData.callUntilMs===0&&ABYME.modelRefs.songBird.userData.callUntilMs===0'));
 const apron=await h.evaluate(`(()=>{const m=ABYME.core.children.find(o=>o.name==='pebbleApron').material;return {transparent:m.transparent,depthWrite:m.depthWrite};})()`);
 ok('the shingle transition blends continuously over the terrain',apron.transparent&&!apron.depthWrite,apron);
 for(let era=1;era<=4;era++){
  await h.evaluate(`ABYME.W.level=${era};ABYME.W.time=12;ABYME.tp(-82,-37,.78,-.12);1`);await renderedFrames(h);
  const state=await h.evaluate(`({groundBirds:ABYME.perched.some(b=>b.visible),songRig:!!ABYME.refs.songBird.children[0].userData.bones})`);
  ok(`era ${era} preserves the clue and the surface wildlife rule`,state.songRig&&(era===1?state.groundBirds:!state.groundBirds),state);
 }
 const stones=await h.evaluate(`(()=>{const out=[];for(let k=0;k<6;k++){const g=ABYME.refs['stone'+k].geometry,p=g.attributes.position,idx=g.index.array,keys=[];for(let i=0;i<p.count;i++)keys.push([p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*100000)).join(','));const edges=new Map();for(let i=0;i<idx.length;i+=3)for(let j=0;j<3;j++){const pair=[keys[idx[i+j]],keys[idx[i+(j+1)%3]]].sort().join('|');edges.set(pair,(edges.get(pair)||0)+1);}out.push([...edges.values()].filter(n=>n!==2).length);}return out;})()`);
 ok('all six stone crowns have closed corners rather than split faces',stones.every(n=>n===0),stones);
 const paper=await h.evaluate(`(()=>{const {refs,core,THREE}=ABYME;core.updateMatrixWorld(true);const paper=refs.sourceNote.children[0],p=refs.sourceNote.getWorldPosition(new THREE.Vector3());const floor=core.getObjectByName('workingStudy').getObjectByName('studyTimber');const ray=new THREE.Raycaster(new THREE.Vector3(p.x,14.1,p.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(floor,false)[0];const b=new THREE.Box3().setFromObject(paper),rest=new THREE.Box3().setFromObject(refs.sourceRest);return {paper:b.min.y-hit.point.y,rest:rest.min.y-hit.point.y};})()`);
 ok('the final note and kept-record slab sit above the fitted boards',paper.paper>0&&paper.paper<.04&&paper.rest>=0&&paper.rest<.04,paper);
 async function aim(name,pos,target,{zoom=1,era=1,hour=12,tide=1}={}){
  await h.evaluate(`(()=>{const {W,player,camera,UI}=ABYME;W.level=${era};W.time=${hour};W.tide=W.tideTarget=${tide};UI.clearWhispers();ABYME.tp(${pos[0]},${pos[1]},0,0);${pos.length>2?'player.pos.y='+pos[2]+';':''}player.yaw=Math.atan2(player.pos.x-(${target[0]}),player.pos.z-(${target[2]}));player.pitch=Math.atan2((${target[1]})-player.pos.y-player.eye,Math.hypot(player.pos.x-(${target[0]}),player.pos.z-(${target[2]})));player.syncCamera();camera.zoom=${zoom};camera.updateProjectionMatrix();return true;})()`);
  await h.wait(.45);await renderedFrames(h);
  const image=name+'.jpg',r=await h.send('Page.captureScreenshot',{format:'jpeg',quality:87});writeFileSync(join(out,image),Buffer.from(r.result.data,'base64'));
  shots.push({name,image,era,hour,tide,zoom,position:await h.evaluate('ABYME.player.pos.toArray()')});console.log('  captured '+name);
 }
 if(out){
  await aim('01-arrival',[4,-104],[-19,3.2,-98]);await aim('02-worked-shore',[-22,-104.5],[-29,2.7,-96]);
  await aim('03-open-dory',[-26,-99.2],[-26,1,-102]);
  const bird=await h.evaluate(`(()=>{const b=ABYME.perched[0];return {p:[b.userData.px,b.userData.py,b.userData.pz]};})()`),p=bird.p;
  await aim('04-gull-gameplay',[p[0]+5,p[2]+.7],[p[0],p[1]+.3,p[2]]);
  await aim('05-gull-detail',[p[0]+10,p[2]+.7],[p[0],p[1]+.3,p[2]],{zoom:5});
  // A fixed pose inspection uses the production deformation code, sampled after its tick.
  // It is explicitly distinct from the continuous production-time capture in capture-wildlife.mjs.
  for(const [name,t] of [['forage',8.28/.62],['preen',13.6/.62],['glide',2]]){
   const data=await h.evaluate(`(async()=>{const {poseBird}=await import('/the-island/js/island-life.js');const b=ABYME.perched[0];poseBird(b,${t},{phase:0,flight:${name==='glide'?1:0}});ABYME.renderer.info.reset();ABYME.composer.render();return ABYME.renderer.domElement.toDataURL('image/jpeg',.89).split(',')[1];})()`);writeFileSync(join(out,'pose-'+name+'.jpg'),Buffer.from(data,'base64'));
  }
  await aim('06-forest',[-58,-58],[-64,12.8,-58]);
  await aim('07-study',[-82,-37],[-88,14.7,-43]);
  await aim('08-instruments',[-85.5,-41.7],[-85.66,14.81,-43.84]);
  await aim('09-music-box',[-85,-40],[-88.6,14.65,-42.6]);
  const room=await h.evaluate(`(()=>{const q=ABYME.refs.cotLantern.parent;const p=q.localToWorld(new ABYME.THREE.Vector3(.45,0,-.75)),t=q.localToWorld(new ABYME.THREE.Vector3(.3,.7,.6));return {p:[p.x,p.z],t:t.toArray()};})()`);
  await aim('10-refuge-room',room.p,room.t);
  await aim('11-stone-circle',[135,-146],[135,10.8,-139.5],{hour:7.2,tide:0});
  const song=await h.evaluate(`ABYME.refs.songBird.getWorldPosition(new ABYME.THREE.Vector3()).toArray()`);await aim('12-songbird',[song[0]+4,song[2]+2],[song[0],song[1]+.15,song[2]],{hour:7.2,tide:0,zoom:3});
  await aim('13-drain',[131,-150,4],[140,5.4,-150],{tide:0});
  await h.evaluate('ABYME.W.flags.hatchOpen=true;1');await renderedFrames(h);await aim('14-archive',[89.8,18.6,17.5],[86.3,18.5,22]);
  await aim('15-lighthouse',[-68,-57],[-85,29,-40]);
  for(let era=1;era<=4;era++)for(const hour of [12,22])await aim(`era-${era}-${hour}`,[-82,-37],[-85,14.5,-40],{era,hour,tide:era===1?1:1+(era-1)*.35});
  await aim('16-shallows',[43,-76],[57,1,-91],{era:2,tide:1.35});
  await aim('17-gallery-bluff',[91.5,34.5],[100,18.5,18.4],{era:3,tide:1.70});
  await aim('18-source',[-82.8,-41],[-84.5,13.65,-41.55],{era:4,tide:2.05});
 }
 ok('asset assembly, all era grades and wildlife produce no runtime errors',errors.length===0,errors);
 const result={pass,fail,beach,boat,clue,singing,paper,shots,errors,method:'Real rendered frames. Era and prerequisite fixtures are explicit debug staging, not earned progression. Detail cameras use labelled zoom; the wildlife video runs ordinary production time.'};
 if(out)writeFileSync(join(out,'validation.json'),JSON.stringify(result,null,2)+'\n');
 console.log(`ISLAND LIFE ${pass.length} / ${pass.length+fail.length}`);console.log(JSON.stringify({fail,beach,boat,clue,singing,errors},null,2));if(fail.length)process.exitCode=1;
}
