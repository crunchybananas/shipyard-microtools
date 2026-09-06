import {tmpdir} from 'node:os';
// Fixed camera/hour comparisons. Run against both checkouts, one browser at a time.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
export default async function(h){
 const out=resolve(process.env.SHOT_DIR||join(tmpdir(),'island-coast-power'));mkdirSync(out,{recursive:true});
 const errors=[];
 h.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description||'').join(' '));});
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`;
 const ready=async()=>{for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))return;await h.wait(1);}throw Error('boot failed');};
 await h.navigate(url);await ready();await h.evaluate('localStorage.clear();1');await h.navigate(url);await ready();
 await h.evaluate('document.getElementById("btn-begin").click();1');await h.wait(1.5);await h.evaluate('ABYME.setIntroT(99);1');await h.wait(2.5);
 await h.evaluate(`document.getElementById('debug-panel').style.display='none';ABYME.W.timeDrift=0;ABYME.W.tide=ABYME.W.tideTarget=1;1`);
 const samples=[];
 for(const [name,pose] of [['study',[-82,-37,Math.PI/4,-.12]],['forest',[-58,-58,1.5,.12]],['beach',[4,-104,2.19,-.06]]]){
  for(const hour of [12,22]){
   await h.evaluate(`ABYME.W.time=${hour};ABYME.UI.clearWhispers();ABYME.tp(${pose.join(',')});1`);await h.wait(2);
   const gpu=[];
   for(let i=0;i<7;i++){gpu.push(await h.evaluate('ABYME.gpuMs()'));await h.wait(.15);}
   const state=await h.evaluate(`(()=>{ABYME.renderer.info.reset();ABYME.composer.render();const {calls,triangles}=ABYME.renderer.info.render;return {calls,triangles,gpuMode:ABYME.gpuMode(),position:ABYME.player.pos.toArray()};})()`);
   const shot=await h.send('Page.captureScreenshot',{format:'jpeg',quality:91});const image=name+'-'+hour+'.jpg';
   writeFileSync(join(out,image),Buffer.from(shot.result.data,'base64'));
   samples.push({name,hour,pose,image,...state,gpuMedianMs:gpu.sort((a,b)=>a-b)[3],gpuSamplesMs:gpu});
  }
 }
 writeFileSync(join(out,'power.json'),JSON.stringify({viewport:[1440,900],method:'Same camera and hour, isolated Chromium sessions, seven live timing samples per pose. Host GPU load is not controlled; geometry counts are the deterministic comparison.',samples,errors},null,2)+'\n');
 console.log(JSON.stringify({samples,errors},null,2));
 if(errors.length)process.exitCode=1;
}
