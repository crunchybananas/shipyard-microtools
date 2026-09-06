import {readFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, join, relative} from 'node:path';
export default async function(h){
 const dir=resolve(process.env.PLAYTHROUGH_DIR||'loop/playthrough/2026-09-05/working-coast');
 const data=JSON.parse(readFileSync(join(dir,'stages.json')));
 const shots=join(dir,'viewer');mkdirSync(shots,{recursive:true});
 const folder=relative(process.cwd(),dir).split('\\').join('/');
 const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/${folder}/index.html`;
 const failures=[];let passed=0;const ok=(label,value)=>value?passed++:failures.push(label);
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await h.navigate(url);
 const state=await h.evaluate(`(async()=>{const images=[...document.images];images.forEach(i=>i.loading='eager');await Promise.all(images.map(i=>i.decode().catch(()=>{})));const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {broken:images.filter(i=>!i.naturalWidth).map(i=>i.src),moments:document.querySelectorAll('.moment').length,extras:document.querySelectorAll('.extra').length,open:document.querySelectorAll('.extra[open]').length,missing:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash),duplicateIds:ids.filter((v,i)=>ids.indexOf(v)!==i),overflow:document.documentElement.scrollWidth>innerWidth};})()`);
 ok('every captured image loads',!state.broken.length);
 ok('the illustrated sequence matches the image audit',state.moments===data.review.moments&&state.extras===data.stages.length-data.review.moments);
 ok('repeated captures begin folded',state.open===0);
 ok('chapter links have unique targets',!state.missing.length&&!state.duplicateIds.length);
 ok('desktop has no horizontal overflow',!state.overflow);
 await h.screenshot(join(shots,'desktop.png'));
 await h.evaluate(`document.getElementById('captures').click();1`);
 ok('all source captures can be expanded',await h.evaluate('document.querySelectorAll(".extra[open]").length')===state.extras);
 await h.evaluate(`document.getElementById('captures').click();1`);
 const repeated=data.stages.find(s=>s.presentation==='repeat');
 await h.evaluate(`location.hash='stage-${repeated.number}';1`);await h.wait(.2);
 ok('deep linking reveals a folded source capture',await h.evaluate(`document.getElementById('stage-${repeated.number}').open`));
 await h.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await h.navigate(url);await h.wait(.5);
 ok('mobile has no horizontal overflow',await h.evaluate('document.documentElement.scrollWidth<=innerWidth'));
 await h.screenshot(join(shots,'mobile.png'));
 const target=await h.evaluate(`(()=>{const b=document.getElementById('captures');b.scrollIntoView({behavior:'instant',block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...target,id:1}]});
 await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await h.wait(.2);
 ok('a phone tap expands the source record',await h.evaluate('document.getElementById("captures").getAttribute("aria-pressed")==="true"'));
 await h.evaluate(`document.getElementById('captures').click();1`);
 for(const [title,file] of [['Above the whole island','mobile-tower.png'],['The inverted lighthouse','mobile-cellar.png']]){
  const s=data.stages.find(s=>s.title===title);
  await h.evaluate(`document.getElementById('stage-${s.number}').scrollIntoView({behavior:'instant',block:'start'});1`);await h.wait(.3);await h.screenshot(join(shots,file));
 }
 if(existsSync(join(dir,'comparison/index.html'))){
  await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await h.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await h.navigate(url.replace('/index.html','/comparison/index.html'));
  const comparison=await h.evaluate(`(async()=>{const sources=[...document.querySelectorAll('option')].flatMap(o=>[o.value+'-before.jpg',o.value+'-after.jpg']);const loaded=await Promise.all(sources.map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth===1440&&image.naturalHeight===900);image.onerror=()=>resolve(false);image.src=src;})));return loaded.length===12&&loaded.every(Boolean);})()`);
  ok('all six before and after pairs load at their captured size',comparison);
  await h.evaluate('document.getElementById("split").focus();1');
  await h.send('Input.dispatchKeyEvent',{type:'keyDown',code:'ArrowRight',key:'ArrowRight',windowsVirtualKeyCode:39});
  await h.send('Input.dispatchKeyEvent',{type:'keyUp',code:'ArrowRight',key:'ArrowRight',windowsVirtualKeyCode:39});
  ok('the comparison divider responds to the keyboard',await h.evaluate('document.getElementById("images").style.getPropertyValue("--split")==="51%"'));
  await h.screenshot(join(shots,'comparison-desktop.png'));
  await h.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const slider=await h.evaluate('(()=>{const s=document.getElementById("split");s.scrollIntoView({block:"center",behavior:"instant"});const r=s.getBoundingClientRect();return {x:r.x+r.width*.8,y:r.y+r.height*.5};})()');
  await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...slider,id:1}]});
  await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  ok('the comparison works by phone touch without horizontal overflow',await h.evaluate('Number(document.getElementById("split").value)>70&&document.documentElement.scrollWidth<=innerWidth'));
  await h.screenshot(join(shots,'comparison-mobile.png'));
 }
 console.log(`REVIEW-VIEWER ${passed} / ${passed+failures.length}`);
 if(failures.length){console.log(JSON.stringify({failures,state}));process.exitCode=1;}
}
