import {tmpdir} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

export default async function(h) {
  const out=resolve(process.env.SHOT_DIR||join(tmpdir(),'island-working-coast-review'));
  mkdirSync(out,{recursive:true});
  const errors=[],pass=[],fail=[];
  const ok=(name,condition,data)=>{(condition?pass:fail).push({name,...(!condition?{data}:{})});};
  h.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`;
  const ready=async()=>{for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))return;await h.wait(1);}throw Error('boot failed '+JSON.stringify(errors));};
  const frame=()=>h.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
  // A software renderer advances far fewer simulation seconds than wall seconds.
  // Keep the real pointer and tide easing; CI advances the production tick in the
  // same 50 ms steps used by the Upstream Hand gate, then renders the float.
  const advance=async seconds=>{
    if(process.env.CI==='true')await h.evaluate(`(()=>{for(let i=0;i<${Math.ceil(seconds/.05)};i++)ABYME.game.tick(.05,performance.now()/1000+i*.05);return true;})()`);
    else await h.wait(seconds);
    await frame();
  };
  await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await h.navigate(url);await ready();await h.evaluate('localStorage.clear();1');await h.navigate(url);await ready();
  await h.evaluate(`document.getElementById('btn-begin').click();if(!document.getElementById('begin-confirm').classList.contains('hidden'))document.getElementById('btn-begin-confirm').click();1`);
  await h.wait(1.5);await h.evaluate('ABYME.setIntroT(99);1');await frame();
  if(!await h.evaluate('!ABYME.player.locked&&ABYME.interact.enabled'))throw new Error('Intro did not release player control');
  await h.evaluate(`document.getElementById('debug-panel').style.display='none';ABYME.W.timeDrift=0;ABYME.UI.clearWhispers();1`);
  const shots=[];
  async function shot(name,pose,hour) {
    await h.evaluate(`ABYME.W.time=${hour};ABYME.UI.clearWhispers();ABYME.tp(${pose.join(',')});1`);await h.wait(.8);
    await h.screenshot(join(out,name+'.png'));
    const state=await h.evaluate(`(()=>{ABYME.renderer.info.reset();ABYME.composer.render();return {position:ABYME.player.pos.toArray(),tide:ABYME.W.tide,render:{...ABYME.renderer.info.render}};})()`);
    shots.push({name,hour,...state});
  }
  await shot('01-landfall',[4,-104,2.19,-.06],7.4);
  await shot('02-forest',[-58,-58,1.5,.12],12);
  await shot('03-study',[-82,-37,Math.atan2(6,6),-.12],11);
  await shot('04-instruments',[-82,-37,Math.atan2(3,3),-.45],11);
  await shot('05-working-ledge',[-85,-42,Math.atan2(2.9,1.2),-.22],15);
  await shot('06-study-dusk',[-82,-37,Math.atan2(6,6),-.12],18.6);
  await shot('07-forest-dusk',[-58,-58,1.5,.12],18.6);
  const crowns=await h.evaluate(`ABYME.core.children.find(o=>o.name==='canopies').children.map(m=>({source:m.geometry.userData.authoring,closed:m.geometry.userData.closedNeedleVolumes,triangles:m.geometry.index.count/3,weight:Math.max(...m.geometry.attributes.aRim.array)}))`);
  ok('all four crowns have authored near and far geometry',crowns.length===8&&crowns.every(g=>g.closed&&g.source==='Blender working_coast.py'),crowns);
  ok('wind weights survive the Blender export',crowns.every(g=>g.weight>.9),crowns);
  ok('far crowns are substantially lighter',crowns.slice(4).every((g,i)=>g.triangles<crowns[i].triangles*.25),crowns);
  const model=await h.evaluate(`({full:!!ABYME.core.getObjectByName('workingStudy'),mini:!!ABYME.core.getObjectByName('modelAnchor').getObjectByName('workingStudy')})`);
  ok('the fitted study is loaded without duplicating it in the miniature',model.full&&!model.mini,model);
  await shot('08-tide-high',[-81.9,-38.6,Math.atan2(-.91,2.05),-.24],11);
  const before=await h.evaluate(`({tide:ABYME.W.tide,y:ABYME.core.getObjectByName('tideGaugeFloat').position.y})`);
  // Project the real wheel and operate it with a pointer, not a granted flag.
  await h.evaluate(`(()=>{const {player,refs,THREE}=ABYME;const p=refs.valveWheel.getWorldPosition(new THREE.Vector3());player.yaw=Math.atan2(player.pos.x-p.x,player.pos.z-p.z);player.pitch=Math.atan2(p.y-player.pos.y-player.eye,Math.hypot(player.pos.x-p.x,player.pos.z-p.z));player.syncCamera();return true;})()`);await h.wait(.3);
  await frame();
  // Aim at the brass rim. The wheel centre also carries a tiny optional reading
  // mark; it is not an unambiguous target from every animated camera position.
  const point=await h.evaluate(`(()=>{const p=ABYME.refs.valveWheel.localToWorld(new ABYME.THREE.Vector3(.38,0,0));p.project(ABYME.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};})()`);
  await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await h.wait(.2);
  await frame();
  const pointerState=await h.evaluate('({hover:ABYME.interact.hovered?.id,enabled:ABYME.interact.enabled,locked:ABYME.player.locked,mouse:ABYME.interact.mouse.toArray()})');
  await h.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await advance(3.2);
  const during=await h.evaluate(`({tide:ABYME.W.tide,y:ABYME.core.getObjectByName('tideGaugeFloat').position.y,turned:ABYME.W.flags.valveTurned})`);
  ok('a pointer on the wheel moves both the sea and float',during.turned&&during.tide<before.tide&&during.y<before.y,{before,during,pointerState,point});
  ok('the float follows the actual water during travel',Math.abs(during.y-(.445+during.tide*.64))<.003,during);
  await advance(10.5);
  await h.evaluate('ABYME.tp(-81.9,-38.6,Math.atan2(-.91,2.05),-.24);ABYME.UI.clearWhispers();1');await h.wait(.5);
  await h.screenshot(join(out,'09-tide-low.png'));
  const low=await h.evaluate(`({tide:ABYME.W.tide,y:ABYME.core.getObjectByName('tideGaugeFloat').position.y})`);
  ok('the falling tide reaches the bottom of the tube',low.tide<.005&&Math.abs(low.y-.445)<.005,low);
  const range=await h.evaluate(`(async()=>{const {MAX_TIDE}=await import('/the-island/js/world.js');const {W,core,THREE}=ABYME;const prior=[W.tide,W.tideTarget];W.tide=W.tideTarget=MAX_TIDE;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));core.updateMatrixWorld(true);const glass=new THREE.Box3().setFromObject(core.getObjectByName('tideGaugeGlass'));const float=new THREE.Box3().setFromObject(core.getObjectByName('tideGaugeFloat'));const water=new THREE.Box3().setFromObject(core.getObjectByName('tideGaugeWater'));const result={max:MAX_TIDE,glass:[glass.min.y,glass.max.y],float:[float.min.y,float.max.y],water:[water.min.y,water.max.y],contained:glass.containsBox(float)&&glass.containsBox(water)};[W.tide,W.tideTarget]=prior;return result;})()`);
  ok('the tube contains the float and water at the maximum shared draft',range.contained,range);
  await frame();
  // Indoor finish must leave the real window's sightline and both doors open.
  const openings=await h.evaluate(`(()=>{const {core,THREE}=ABYME;const r=new THREE.Raycaster();core.updateMatrixWorld(true);return [15,110,165].map(a=>{a*=Math.PI/180;const d=new THREE.Vector3(Math.sin(a),0,Math.cos(a));r.set(new THREE.Vector3(-85,15.4,-40).addScaledVector(d,3.9),d);r.far=1.2;return r.intersectObject(core.getObjectByName('studyPlaster')).length;});})()`);
  ok('the new finish preserves both doors and the window',openings.every(n=>n===0),openings);
  ok('no runtime errors occur',errors.length===0,errors);
  writeFileSync(join(out,'validation.json'),JSON.stringify({pass,fail,shots,crowns},null,2)+'\n');
  console.log(`WORKING COAST ${pass.length} / ${pass.length+fail.length}`);
  console.log(JSON.stringify({fail,shots:shots.map(s=>({name:s.name,...s.render})),crowns},null,2));
  if(fail.length)process.exitCode=1;
}
