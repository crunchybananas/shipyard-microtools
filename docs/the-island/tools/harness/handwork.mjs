import{mkdirSync,writeFileSync}from'node:fs';
import{beginPlay,renderedFrames,advanceGameplay,waitForFrame}from'./play-ready.mjs';
export default async function(h){
 const out=process.env.SHOT_DIR||'/tmp/island-handwork-checks';mkdirSync(out,{recursive:true});const pass=[],fail=[],errors=[];
 const ok=(name,condition,data)=>{(condition?pass:fail).push({name,...(!condition?{data}:{})});};
 h.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`);
 for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}await beginPlay(h);
 await h.evaluate('ABYME.W.time=12;ABYME.W.timeDrift=0;ABYME.W.sunFrozen=true;document.getElementById("debug-panel").style.display="none";1');
 const surface=await h.evaluate('({full:ABYME.refs.tinyFigure.visible,mini:ABYME.game.modelRefs.tinyFigure.visible})');
 ok('the lower keeper is absent at the surface',!surface.full&&!surface.mini,surface);
 // Read the recovered copy with the real pointer. A formerly buried triangle
 // can still pass a name lookup, so check physical corners and the user action.
 await h.evaluate(`(()=>{const{THREE,player,core,UI}=ABYME;const paper=core.getObjectByName('lore_commendation_copy'),q=paper.parent,p=q.localToWorld(new THREE.Vector3(-.4,0,-.2)),t=paper.getWorldPosition(new THREE.Vector3());ABYME.tp(p.x,p.z,0,0);player.yaw=Math.atan2(p.x-t.x,p.z-t.z);player.pitch=Math.atan2(t.y-player.pos.y-player.eye,Math.hypot(p.x-t.x,p.z-t.z));player.syncCamera();UI.clearWhispers();return true;})()`);await renderedFrames(h);
 const paper=await h.evaluate(`(()=>{const{THREE,core,camera}=ABYME;core.updateMatrixWorld(true);const page=core.getObjectByName('lore_commendation_copy'),cloth=core.getObjectByName('roomCloth'),ray=new THREE.Raycaster(),gaps=[];const v=page.geometry.attributes.position;for(let i=0;i<v.count;i++){const p=page.localToWorld(new THREE.Vector3().fromBufferAttribute(v,i));ray.set(p.clone().add(new THREE.Vector3(0,.05,0)),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(cloth,false)[0];gaps.push(hit?p.y-hit.point.y:null);}const p=page.getWorldPosition(new THREE.Vector3()).project(camera);return{gaps,point:{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}};})()`);
 ok('all four paper corners sit above the blanket',paper.gaps.every(g=>g!==null&&g>=0&&g<.005),paper);
 await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...paper.point});await waitForFrame(h,'ABYME.interact.hovered?.id==="lore_commendation_copy"','the readable copy on the cot');
 await h.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...paper.point});await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...paper.point});await renderedFrames(h);
 const reader=await h.evaluate('ABYME.UI._reader?.id');ok('the visible copy opens its actual text',reader==='commendation_copy',reader);
 await h.evaluate('ABYME.UI.closeReader();1');
 await h.evaluate(`(()=>{const{THREE,player,game,UI}=ABYME;ABYME.goLevel(4);const p=game.modelRefs.tinyFigure.getWorldPosition(new THREE.Vector3());ABYME.tp(p.x+.65,p.z+.72,Math.atan2(.65,.72)+Math.PI,-.6);UI.clearWhispers();return true;})()`);
 await advanceGameplay(h,.5);
 const away=await h.evaluate('({regarded:ABYME.W.flags.lowerHandRegarded,gesture:ABYME.game.modelRefs.tinyFigure.userData.gesture})');
 ok('proximity without regard does not start the encounter',!away.regarded&&away.gesture==='working',away);
 const sample=async()=>h.evaluate(`(()=>{const{THREE,game,refs}=ABYME,a=game.modelRefs.tinyFigure,skin=a.getObjectByName('keeperCraft'),bench=a.getObjectByName('keeperBenchCraft');a.updateWorldMatrix(true,true);skin.skeleton.update();const box=new THREE.Box3().setFromObject(bench),palms=[];for(const name of ['keeperPalmL','keeperPalmR']){const bone=skin.skeleton.bones.findIndex(b=>b.name===name),v=new THREE.Vector3();let low=Infinity;for(let i=0;i<skin.geometry.attributes.position.count;i++){if(skin.geometry.attributes.skinIndex.getX(i)!==bone)continue;skin.getVertexPosition(i,v);skin.localToWorld(v);low=Math.min(low,v.y);}palms.push({name,low,gap:low-box.max.y});}return{palms,foot:a.getWorldPosition(new THREE.Vector3()).toArray(),pitch:a.rotation.x,full:refs.tinyFigure.visible,mini:a.visible,gesture:a.userData.gesture,head:a.getObjectByName('keeperHead').quaternion.toArray(),regarded:ABYME.W.flags.lowerHandRegarded};})()`);
 const idle=await sample();
 await h.evaluate(`(()=>{const{THREE,player,game}=ABYME,p=game.modelRefs.tinyFigure.getWorldPosition(new THREE.Vector3());player.yaw=Math.atan2(player.pos.x-p.x,player.pos.z-p.z);player.pitch=Math.atan2(p.y+.012-player.pos.y-player.eye,Math.hypot(player.pos.x-p.x,player.pos.z-p.z));player.syncCamera();return true;})()`);
 await advanceGameplay(h,.35);ok('the authored gesture preserves the stillness threshold',!await h.evaluate('ABYME.W.flags.lowerHandRegarded'));
 await advanceGameplay(h,3);const resting=await sample();
 ok('held regard reaches the authored hands-resting pose',resting.regarded&&resting.gesture==='hands-resting',resting);
 ok('both palms meet the actual table top',resting.palms.every(p=>p.gap>-.000035&&p.gap<.00009),resting.palms);
 ok('hands rise independently while the feet stay planted',resting.palms.every((p,i)=>p.low>idle.palms[i].low+.0005)&&resting.foot.every((p,i)=>Math.abs(p-idle.foot[i])<1e-8)&&resting.pitch===0,{idle,resting});
 ok('only the nested figure appears in the source era',!resting.full&&resting.mini,resting);
 const ground=await h.evaluate(`(async()=>{const{heightAt}=await import('./js/terrain.js'),{MAX_TIDE,TIDE_DROP}=await import('./js/world.js');const a=ABYME.game.modelRefs.tinyFigure,p=a.position;return{height:p.y,terrain:heightAt(p.x,p.z),maxSea:TIDE_DROP*(MAX_TIDE-1)};})()`);
 ok('the keeper remains on dry ground at the maximum supported tide',Math.abs(ground.height-ground.terrain)<1e-7&&ground.height>ground.maxSea+.35,ground);
 await h.evaluate('ABYME.UI.clearWhispers();1');await renderedFrames(h);const shot=await h.send('Page.captureScreenshot',{format:'jpeg',quality:91});writeFileSync(out+'/keeper-gameplay.jpg',Buffer.from(shot.result.data,'base64'));
 await h.evaluate('ABYME.camera.zoom=5;ABYME.camera.updateProjectionMatrix();1');await renderedFrames(h);const detail=await h.send('Page.captureScreenshot',{format:'jpeg',quality:91});writeFileSync(out+'/keeper-detail.jpg',Buffer.from(detail.result.data,'base64'));
 ok('no runtime exceptions during the handwork checks',errors.length===0,errors);
 writeFileSync(out+'/validation.json',JSON.stringify({pass,fail,paper,idle,resting,ground,errors},null,2)+'\n');console.log(`HANDWORK ${pass.length} / ${pass.length+fail.length}`);console.log(JSON.stringify({fail,ground,idle,resting},null,2));if(fail.length)process.exitCode=1;
}
