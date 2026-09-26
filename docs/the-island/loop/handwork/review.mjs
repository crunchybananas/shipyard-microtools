import{mkdirSync,writeFileSync}from'node:fs';
export default async function(h){
 const dir=process.env.SHOT_DIR;mkdirSync(dir,{recursive:true});const pass=[],fail=[];const ok=(name,value,data)=>(value?pass:fail).push({name,...(!value?{data}:{})});
 const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/loop/handwork/`;
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await h.navigate(url);
 const state=await h.evaluate(`(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));const links=await Promise.all([...document.querySelectorAll('a[href]')].filter(a=>!a.hash).map(async a=>({url:a.getAttribute('href'),status:(await fetch(a.href,{method:'HEAD'})).status})));return{images:document.images.length,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),missing:links.filter(l=>l.status!==200),overflow:document.documentElement.scrollWidth>innerWidth,placeholders:document.body.innerText.includes('verification is being recorded')};})()`);
 ok('all review images load',state.images>=17&&!state.broken.length,state);ok('all evidence and source links resolve',!state.missing.length,state.missing);ok('desktop layout fits without placeholders',!state.overflow&&!state.placeholders,state);
 await h.screenshot(dir+'/desktop.png');
 const video=await h.evaluate(`new Promise(resolve=>{const v=document.querySelector('video');v.addEventListener('loadedmetadata',()=>resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight}),{once:true});v.addEventListener('error',()=>resolve({error:true}),{once:true});v.load();})`);
 ok('the actual walk video has valid duration and dimensions',video.duration>20&&video.duration<40&&video.width===960,video);
 await h.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await h.navigate(url);
 ok('phone layout has no horizontal overflow',await h.evaluate('document.documentElement.scrollWidth<=innerWidth'));await h.screenshot(dir+'/phone.png');
 const p=await h.evaluate(`(()=>{const s=document.querySelector('summary');s.scrollIntoView({block:'center'});const r=s.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 ok('source details open by phone touch',await h.evaluate('document.querySelector("details").open'));
 writeFileSync(dir+'/validation.json',JSON.stringify({pass,fail,state,video},null,2)+'\n');console.log(`HANDWORK REVIEW ${pass.length} / ${pass.length+fail.length}`);if(fail.length){console.log(JSON.stringify(fail));process.exitCode=1;}
}
