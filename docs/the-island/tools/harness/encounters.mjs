import{mkdirSync,writeFileSync}from'node:fs';
import{beginPlay,renderedFrames,advanceGameplay}from'./play-ready.mjs';
export default async function(h){
 const dir=process.env.SHOT_DIR||'/tmp/island-encounter-review';mkdirSync(dir,{recursive:true});const pass=[],fail=[],errors=[];const ok=(name,c,data)=>(c?pass:fail).push({name,...(!c?{data}:{})});
 h.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT||8772}/the-island/?debug&mute&localstack`);for(let i=0;i<40;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}await beginPlay(h);await h.evaluate('ABYME.W.time=12;ABYME.W.timeDrift=0;ABYME.W.sunFrozen=true;document.getElementById("debug-panel").style.display="none";1');
 const anatomy=await h.evaluate(`(()=>{const{refs,THREE}=ABYME;return['watcher','tideFigure'].map(n=>{const f=refs[n];const b=new THREE.Box3().setFromObject(f);return{name:n,source:f.userData.authoring,height:b.max.y-b.min.y,meshes:f.children.length,triangles:f.children[0].geometry.index.count/3};});})()`);
 ok('both coastal figures use the authored human-scale mesh',anatomy.every(f=>f.source==='Blender island_life.py'&&f.height>1.65&&f.height<1.9&&f.meshes===1),anatomy);
 async function place(name,era,px,pz,x,z){await h.evaluate(`(async()=>{const{heightAt}=await import('./js/terrain.js');const{W,player,refs,game,core,UI}=ABYME;W.level=${era};W.tide=W.tideTarget=${era===2?1.35:1.65};W.flags.${name==='watcher'?'watcherSeen':'tideFigureSeen'}=false;game.${name==='watcher'?'_watcherRegard':'_tideRegard'}=0;game._tfPrev=null;const f=refs.${name};f.position.set(${x},heightAt(${x},${z}),${z});f.scale.setScalar(1);f.visible=true;f.userData.mats[0].opacity=${era===2?.8:1};ABYME.tp(${px},${pz},0,0);player.yaw=Math.atan2(player.pos.x-f.position.x,player.pos.z-f.position.z);player.pitch=Math.atan2(f.position.y+1.48-player.pos.y-player.eye,Math.hypot(player.pos.x-f.position.x,player.pos.z-f.position.z));player.syncCamera();core.updateMatrixWorld(true);UI.clearWhispers();return true;})()`);await renderedFrames(h);}
 // Locate an actual shore-rock obstruction, the way the canopy probe below does: the rocks
 // are an authored kit now (fractured blocks, not eggs), so a fixed coordinate that one
 // stone used to cover can be open past another stone's lower profile. The fixture stands
 // the figure where a ray from the eye to its head really meets rock geometry.
 await place('watcher',3,-23,-84,24,-88);
 const rockSite=await h.evaluate(`(async()=>{const{heightAt}=await import('./js/terrain.js');const{THREE,core,player,refs}=ABYME;core.updateMatrixWorld(true);const eye=player.camera.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster(),target=new THREE.Vector3();const rocks=[];core.traverse(o=>{if(o.isInstancedMesh&&(o.name==='rocks'||o.name==='erratics')){const s=new THREE.Vector3();o.getWorldScale(s);if(s.x>.5)rocks.push(o);}});
 for(const x of [24,23,25,22,26,21,27,20,28]){for(const z of [-88,-89,-87,-90,-86,-91,-85]){target.set(x,heightAt(x,z)+1.48,z);ray.set(eye,target.clone().sub(eye).normalize());ray.far=eye.distanceTo(target)-.12;if(ray.intersectObjects(rocks,true).length){const f=refs.watcher;f.position.set(x,heightAt(x,z),z);player.yaw=Math.atan2(player.pos.x-x,player.pos.z-z);player.pitch=Math.atan2(f.position.y+1.48-player.pos.y-player.eye,Math.hypot(player.pos.x-x,player.pos.z-z));player.syncCamera();core.updateMatrixWorld(true);return{x,z};}}}return null;})()`);
 await renderedFrames(h);
 const blocked=rockSite&&await h.evaluate('!ABYME.game._encounterInView(ABYME.player,ABYME.refs.watcher)');await advanceGameplay(h,.15);ok('a figure hidden by shore rock cannot accrue regard',blocked&&await h.evaluate('!ABYME.W.flags.watcherSeen&&ABYME.game._watcherRegard===0'),{rockSite,blocked});
 // Locate an actual branch obstruction. A thinner crown can open a formerly
 // blocked fixed coordinate, and the Watcher is allowed to drift out of cover.
 await place('watcher',3,0,-78,14,-82);
 const canopy=await h.evaluate(`(async()=>{const{heightAt}=await import('./js/terrain.js');const{THREE,core,player,refs,game,W}=ABYME;core.updateMatrixWorld(true);const eye=player.camera.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster(),target=new THREE.Vector3();let site;
 // The crowns are alpha-tested needle cards: a ray through a card quad may pass through the
 // air between twigs, and the production sightline reads the card's coverage at the hit. So a
 // real obstruction is one the production rule itself calls hidden — place the figure at each
 // candidate and ask the sightline, exactly as the shore-rock fixture above does.
 const f=refs.watcher;
 for(const x of [14,13,15,12,16,11,17,10,18]){for(const z of [-82,-83,-81,-84,-80,-85,-79,-86]){target.set(x,heightAt(x,z)+1.48,z);ray.set(eye,target.clone().sub(eye).normalize());ray.far=eye.distanceTo(target)-.12;if(!ray.intersectObject(core.children.find(o=>o.name==='canopies'),true).length)continue;
  f.position.set(x,heightAt(x,z),z);player.yaw=Math.atan2(player.pos.x-x,player.pos.z-z);player.pitch=Math.atan2(f.position.y+1.48-player.pos.y-player.eye,Math.hypot(player.pos.x-x,player.pos.z-z));player.syncCamera();core.updateMatrixWorld(true);
  if(!game._encounterInView(player,f)){site={x,z};break;}}if(site)break;}
 if(!site)return{error:'No real branch obstruction found'};
 const samples=[];
 for(let i=0;i<60&&!W.flags.watcherSeen;i++){const hidden=!game._encounterInView(player,f),before=game._watcherRegard;game.tick(.05,40+i*.05);samples.push({hidden,before,after:game._watcherRegard,resolved:W.flags.watcherSeen});}
 return{site,samples};})()`);
 const hidden=canopy.samples?.filter(s=>s.hidden)||[];
 ok('a figure hidden by a canopy cannot earn regard',hidden.length>0&&hidden.every(s=>s.after<=s.before&&!s.resolved),canopy);
 await place('watcher',3,0,-78,8,-84);await h.evaluate('ABYME.player.pitch=1.25;ABYME.player.syncCamera();1');await advanceGameplay(h,3);ok('looking at the sky does not count as seeing the figure',await h.evaluate('!ABYME.W.flags.watcherSeen&&ABYME.game._watcherRegard===0'));
 for(const[name,era,px,pz,x,z]of[['watcher',3,0,-78,8,-84],['tideFigure',2,4,-104,12,-100]]){
  await place(name,era,px,pz,x,z);const inView=await h.evaluate(`ABYME.game._encounterInView(ABYME.player,ABYME.refs.${name})`);const shot=await h.send('Page.captureScreenshot',{format:'jpeg',quality:90});writeFileSync(dir+'/'+name+'.jpg',Buffer.from(shot.result.data,'base64'));await advanceGameplay(h,3);ok('visible '+name+' resolves through ordinary held regard',inView&&await h.evaluate(`ABYME.W.flags.${name==='watcher'?'watcherSeen':'tideFigureSeen'}`),{inView});
 }
 const reset=await h.evaluate(`(()=>{ABYME.game.resetRuntime();const f=ABYME.refs.tideFigure,w=ABYME.refs.watcher;return{opacity:f.userData.mats[0].opacity,scale:f.scale.x,watcher:w.position.toArray()};})()`);ok('reset restores figure opacity, scale and the authored starting site',reset.opacity===.8&&reset.scale===1&&reset.watcher[0]===8&&reset.watcher[2]===-84,reset);
 ok('the encounter review has no runtime exceptions',errors.length===0,errors);writeFileSync(dir+'/validation.json',JSON.stringify({pass,fail,anatomy,canopy,reset,errors,method:'Explicit era and position fixtures; visual regard and dissolution run ordinary game time, except the canopy drift probe uses explicit 50 ms production ticks. Tests deliberately inspect blocked and clear sightlines.'},null,2));console.log(`ENCOUNTERS ${pass.length} / ${pass.length+fail.length}`);console.log(JSON.stringify({fail,anatomy},null,2));if(fail.length)process.exitCode=1;
}
