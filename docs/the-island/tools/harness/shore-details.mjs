// A rendered gate for the Blender / imagegen landing-beach kit.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {beginPlay,renderedFrames} from './play-ready.mjs';
export default async function(h) {
  const out=resolve(process.env.SHOT_DIR||join(tmpdir(),'island-shore-details'));
  mkdirSync(out,{recursive:true});
  const baseline=JSON.parse(readFileSync(new URL('../../loop/shore-details/before/power.json',import.meta.url)));
  const errors=[],pass=[],fail=[],samples=[];
  const ok=(name,value,data)=>{(value?pass:fail).push({name,...(!value?{data}:{})});};
  h.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description));});
  await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`);
  for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}
  await beginPlay(h);
  await h.evaluate(`ABYME.W.timeDrift=0;ABYME.W.tide=ABYME.W.tideTarget=1;document.getElementById('debug-panel').style.display='none';1`);
  for(const before of baseline.samples) {
    const {name,hour,pose}=before;
    await h.evaluate(`ABYME.W.time=${hour};ABYME.UI.clearWhispers();ABYME.tp(${pose.join(',')});1`);await h.wait(2);await renderedFrames(h);
    const gpu=[];for(let i=0;i<7;i++){gpu.push(await h.evaluate('ABYME.gpuMs()'));await h.wait(.15);}
    const state=await h.evaluate(`(()=>{ABYME.renderer.info.reset();ABYME.composer.render();return {...ABYME.renderer.info.render,gpuMode:ABYME.gpuMode()};})()`);
    const image=`${name}-${hour}.png`;await h.screenshot(join(out,image));
    const row={name,hour,pose,image,...state,deltaCalls:state.calls-before.calls,deltaTriangles:state.triangles-before.triangles,gpuMedianMs:gpu.sort((a,b)=>a-b)[3],gpuSamplesMs:gpu};samples.push(row);
    // This bounded addition is explicit. Do not increase the game's event ceiling.
    ok(`${name} at ${hour}: addition stays within 14 calls / 30,000 triangles`,row.deltaCalls<=14&&row.deltaTriangles<=30000,row);
    ok(`${name} at ${hour}: existing total ceiling holds`,state.calls<525&&state.triangles<1000000,state);
  }
  async function aim(name,level,hour,pose,target) {
    await h.evaluate(`(()=>{const {W,player,UI}=ABYME;W.level=${level};W.time=${hour};UI.clearWhispers();ABYME.tp(${pose[0]},${pose[1]},0,0);player.yaw=Math.atan2(player.pos.x-(${target[0]}),player.pos.z-(${target[2]}));player.pitch=Math.atan2(${target[1]}-player.pos.y-player.eye,Math.hypot(player.pos.x-(${target[0]}),player.pos.z-(${target[2]})));player.syncCamera();return true;})()`);
    await h.wait(.5);await renderedFrames(h);await h.screenshot(join(out,name+'.png'));
  }
  for(let level=1;level<=4;level++) {
    for(const hour of [12,22])await aim(`rack-era-${level}-${hour}`,level,hour,[-27,-100.8],[-29,2.85,-96]);
    await aim(`model-era-${level}`,level,12,[-82,-37],[-85,14.5,-40]);
  }
  await aim('rack-day',1,12,[-26.2,-99.4],[-28.6,2.65,-96]);
  const kit=await h.evaluate(`(()=>{const {core,THREE}=ABYME;const root=core.getObjectByName('shoreDetails'),rack=root.getObjectByName('shoreRack'),mini=core.getObjectByName('modelIsland').getObjectByName('shoreRackMini');const wood=root.getObjectByName('shoreTimber');let lights=0;ABYME.scene.traverse(o=>{if(o.isPointLight)lights++;});return {near:rack.levels[0].object.visible,far:rack.levels[1].object.visible,texture:[wood.material.map.image.width,wood.material.map.image.height],miniTriangles:mini.geometry.index.count/3,miniChildren:mini.children.length,authored:root.userData.authoring,parts:root.children.map(o=>o.name),lights};})()`);
  ok('the near rack uses its authored net and imagegen timber',kit.near&&!kit.far&&kit.texture.every(n=>n===512)&&kit.authored==='Blender shore_details.py',kit);
  ok('miniature uses the 98-triangle silhouette',kit.miniTriangles===98&&kit.miniChildren===0,kit);
  ok('shells and pools are merged into three shore batches',kit.parts.length===4&&['shoreRock','shoreLife','shorePool'].every(n=>kit.parts.includes(n)),kit);
  const collision=await h.evaluate(`(async()=>{const {SHORE_RACK,SHORE_ROCKS}=await import('/the-island/js/shore-details.js');const {player}=ABYME;const rack=SHORE_RACK;ABYME.tp(rack.x,rack.z-3,0,0);const solid=!player._step(rack.x-.35,rack.z);const clear=player._step(rack.x,rack.z-2);const rocks=SHORE_ROCKS.map(p=>{ABYME.tp(p.x,p.z-2,0,0);return !player._step(p.x,p.z);});return {solid,clear,rocks};})()`);
  ok('rack and rocks block walking while the approach stays open',collision.solid&&collision.clear&&collision.rocks.every(Boolean),collision);
  await aim('tide-rock',1,12,[-29.5,-103.4],[-32.5,1.55,-101]);
  await aim('landing-dawn',1,7.5,[-22,-104.5],[-29,2.7,-96]);
  await h.evaluate('ABYME.tp(-82,-37,.78,-.12);1');await renderedFrames(h);
  const lod=await h.evaluate(`(()=>{const r=ABYME.core.getObjectByName('shoreRack');return {near:r.levels[0].object.visible,far:r.levels[1].object.visible};})()`);
  ok('distant rack selects its small silhouette',!lod.near&&lod.far,lod);
  ok('no shader, asset or runtime errors',errors.length===0,errors);
  writeFileSync(join(out,'validation.json'),JSON.stringify({pass,fail,samples,kit,collision,errors,method:'Fixed baseline cameras at 1440x900; live GPU samples are host observations. Era images use explicit debug fixtures, not earned progression.'},null,2)+'\n');
  console.log(`SHORE DETAILS ${pass.length} / ${pass.length+fail.length}`);console.log(JSON.stringify({fail,samples,kit,collision},null,2));
  if(fail.length)process.exitCode=1;
}
