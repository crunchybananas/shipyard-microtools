import {mkdirSync,writeFileSync} from 'node:fs';
import {beginPlay,renderedFrames} from './play-ready.mjs';
export default async function(h){
 const dir=process.env.SHOT_DIR||'/tmp/island-life-frames';mkdirSync(dir,{recursive:true});
 await h.send('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:1,mobile:false});
 await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`);
 for(let i=0;i<40;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}
 await beginPlay(h);await h.evaluate(`(()=>{const {W,perched,player,camera,UI}=ABYME;W.time=12;W.timeDrift=0;W.sunFrozen=true;document.getElementById('debug-panel').style.display='none';const b=perched[0],u=b.userData;ABYME.tp(u.px+10,u.pz+.7,0,0);player.yaw=Math.atan2(player.pos.x-u.px,player.pos.z-u.pz);player.pitch=Math.atan2(u.py+.27-player.pos.y-player.eye,Math.hypot(player.pos.x-u.px,player.pos.z-u.pz));player.syncCamera();camera.zoom=5;camera.updateProjectionMatrix();UI.clearWhispers();return true;})()`);await renderedFrames(h);
 let n=0;const frames=[];
 const listen=e=>{const m=JSON.parse(e.data);if(m.method!=='Page.screencastFrame')return;const p=m.params;const file=`frame-${String(n++).padStart(5,'0')}.jpg`;writeFileSync(dir+'/'+file,Buffer.from(p.data,'base64'));frames.push({file,t:p.metadata.timestamp});void h.send('Page.screencastFrameAck',{sessionId:p.sessionId});};
 h.ws.addEventListener('message',listen);await h.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:960,maxHeight:600,everyNthFrame:3});await h.wait(28);await h.send('Page.stopScreencast');h.ws.removeEventListener('message',listen);
 writeFileSync(dir+'/timing.json',JSON.stringify(frames,null,2));writeFileSync(dir+'/concat.txt',frames.flatMap((f,i)=>[`file '${f.file}'`,`duration ${i+1<frames.length?Math.max(.001,frames[i+1].t-f.t):.05}`]).join('\n')+'\n');console.log(`Captured ${n} real browser frames over ${frames.at(-1).t-frames[0].t} seconds.`);
}
