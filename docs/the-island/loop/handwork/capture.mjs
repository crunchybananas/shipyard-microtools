// Matched cameras and explicitly magnified source detail for the local review.
import {mkdirSync,writeFileSync} from 'node:fs';
import {beginPlay,renderedFrames} from '../../tools/harness/play-ready.mjs';
export default async function(h){
 const out=process.env.SHOT_DIR;mkdirSync(out,{recursive:true});
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`);
 for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}await beginPlay(h);
 await h.evaluate('ABYME.W.time=12;ABYME.W.timeDrift=0;ABYME.W.sunFrozen=true;document.getElementById("debug-panel").style.display="none";1');
 async function shot(name){await h.evaluate('ABYME.UI.clearWhispers();1');await renderedFrames(h);const r=await h.send('Page.captureScreenshot',{format:'jpeg',quality:91});writeFileSync(out+'/'+name+'.jpg',Buffer.from(r.result.data,'base64'));}
 for(const[n,x,z,tx,ty,tz]of[['forest',-58,-58,-64,12.8,-58],['pine-close',0,-78,8,6,-84],['forest-path',-60,-64,-66,14,-59]]){
  await h.evaluate(`(()=>{const{player}=ABYME;ABYME.tp(${x},${z},0,0);player.yaw=Math.atan2(player.pos.x-(${tx}),player.pos.z-(${tz}));player.pitch=Math.atan2(${ty}-player.pos.y-player.eye,Math.hypot(player.pos.x-(${tx}),player.pos.z-(${tz})));player.syncCamera();return true;})()`);await shot(n);
 }
 async function room(n,x,z,tx,ty,tz){
  await h.evaluate(`(()=>{const{refs,THREE,player}=ABYME,q=refs.cotLantern.parent,p=q.localToWorld(new THREE.Vector3(${x},0,${z})),t=q.localToWorld(new THREE.Vector3(${tx},${ty},${tz}));ABYME.tp(p.x,p.z,0,0);player.yaw=Math.atan2(p.x-t.x,p.z-t.z);player.pitch=Math.atan2(t.y-player.pos.y-player.eye,Math.hypot(p.x-t.x,p.z-t.z));player.syncCamera();return true;})()`);await shot(n);
 }
 await room('textiles',-.4,-.2,-1,.57,1.35);await room('refuge',.45,-.75,.3,.7,.6);
 for(const era of [1,2,3,4])for(const hour of [12,22]){
  await h.evaluate(`ABYME.W.level=${era};ABYME.W.time=${hour};1`);await h.wait(1.5);await room('refuge-era-'+era+'-'+hour,.45,-.75,.3,.7,.6);
 }
 await h.evaluate(`(()=>{const{W,player,game,THREE}=ABYME;W.level=4;W.time=12;W.tide=W.tideTarget=1.9;const p=game.modelRefs.tinyFigure.getWorldPosition(new THREE.Vector3());ABYME.tp(p.x+.6,p.z+.7,Math.atan2(.6,.7),-.9);player.pitch=Math.atan2(p.y+.02-player.pos.y-player.eye,Math.hypot(player.pos.x-p.x,player.pos.z-p.z));player.syncCamera();return true;})()`);
 await shot('keeper-gameplay');await h.evaluate('ABYME.camera.zoom=5;ABYME.camera.updateProjectionMatrix();1');await shot('keeper-detail');await h.wait(3);await shot('keeper-regard');
 console.log('HANDWORK CAPTURES COMPLETE');
}
