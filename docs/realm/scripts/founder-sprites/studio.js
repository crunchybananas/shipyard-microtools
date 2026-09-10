import {
  FOUNDER_DIRECTIONS as DIRECTIONS,
  FOUNDER_ANCHOR as ANCHOR, FOUNDER_STRIDE as STRIDE,
  FOUNDER_DURATION as DURATION, FOUNDER_VIEW_HEIGHT as VIEW_HEIGHT,
  FOUNDER_TIERS as TIERS, founderFrameRect, founderContact, founderDirection,
} from './contract.js';
import { FOUNDER_ACTIONS as ACTIONS } from './actions.js';
const frameCount=()=>ACTIONS[state.action].frames;
const actionDuration=()=>ACTIONS[state.action].duration;
const contact=(phase,side)=>state.action!=='walk'||founderContact(phase,side);

const $=id=>document.getElementById(id);
const stage=$('stage'),canvas=$('scene'),ctx=canvas.getContext('2d');
const names={s:'South',se:'Southeast',e:'East',ne:'Northeast',n:'North',nw:'Northwest',w:'West',sw:'Southwest'};
const state={action:'point',mode:'detail',direction:'se',phase:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,rate:1,turnClock:0,position:{x:0,z:0},target:null,travel:0,settling:false};
const keys=new Set(),tiles=[];
let w=800,h=520,dpr=1,sourceRig=null,sourceLoading=false,sourceYaw=Math.PI/4,dragStart=null;
let images,landmarks,manifest,lastRendered=null;
let detailed=null,detailLoading=false,highResolutionRequest=0,needsDraw=true;

function loadImage(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Could not load ${url}`));i.src=url;});}
function resized(){
  needsDraw=true;
  const r=stage.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(sourceRig)resizeSource();
  if(detailed)detailed.resize(w,h);
}
new ResizeObserver(resized).observe(stage);

function selectDirection(direction,manual=true){
  needsDraw=true;
  state.direction=direction;sourceYaw=DIRECTIONS.indexOf(direction)*Math.PI/4;
  if(manual)$('turns').checked=false;
  $('view-label').textContent=names[direction];
  for(const tile of tiles)tile.button.setAttribute('aria-pressed',String(tile.direction===direction));
}
function setPlaying(value){state.playing=value;needsDraw=true;$('play').textContent=value?'Pause':'Play';$('play').setAttribute('aria-label',value?'Pause animation':'Play animation');}
function setPhase(frame){const frames=frameCount();state.phase=((Number(frame)%frames)+frames)%frames/frames;setPlaying(false);draw();}
function selectAction(id,{play=true}={}){
  state.action=id;state.phase=0;state.turnClock=0;
  const a=ACTIONS[id];
  document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===id)));
  $('action-title').textContent=a.label;$('action-description').textContent=a.description;
  $('phase').max=String(a.frames-1);
  $('beats').replaceChildren(...a.beats.map(([frame,label])=>{const b=document.createElement('button');b.dataset.frame=frame;b.textContent=label;b.addEventListener('click',()=>setPhase(frame));return b;}));
  $('control-note').textContent=`${a.frames} poses · ${a.duration.toFixed(2).replace(/0$/,'')} seconds. Choose a named beat or scrub any pose. Each angle keeps the same gesture.`;
  $('stage-hint').textContent=a.description;
  $('download-map').href=`assets/sprites/founder/${id}-128.png`;$('download-map').download=`founder-${id}.png`;
  setPlaying(play);
  if(images&&['cycle','compare'].includes(state.mode))loadLargeSprite(id);
}
async function loadLargeSprite(id){
  if(images[id].studio)return;
  const request=++highResolutionRequest,file=`${id}-192.png`;
  try{
    const image=await loadImage(`assets/sprites/founder/${file}?v=${manifest.outputs.find(o=>o.file===file).sha256}`);
    if(request!==highResolutionRequest)return;
    // A standing 192px atlas decodes to 71 MiB. Retain only the active one;
    // eight-angle thumbnails and gameplay scale use the small atlases.
    for(const asset of Object.values(images))if(asset&&typeof asset==='object'&&'studio' in asset)asset.studio=null;
    images[id].studio=image;
    needsDraw=true;
  }catch(error){console.warn(error.message);}
}
function geometry(){const spriteH=state.mode==='roam'?Math.min(155,h*.36):Math.min(480,h*.80);return{spriteH,unit:spriteH/VIEW_HEIGHT,ox:w/2,oy:h*.77};}
function screen(x,z,g){return{x:g.ox+x*g.unit,y:g.oy+z*g.unit*.5};}

for(const direction of ['n','ne','e','se','s','sw','w','nw']){
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Face ${names[direction].toLowerCase()}`);button.setAttribute('aria-pressed',String(direction===state.direction));
  const preview=document.createElement('canvas');preview.width=192;preview.height=210;
  const label=document.createElement('span');label.textContent=names[direction];
  button.append(preview,label);button.addEventListener('click',()=>selectDirection(direction));$('directions').append(button);
  tiles.push({button,canvas:preview,ctx:preview.getContext('2d'),direction});
}

function sprite(target,direction,phase,x,y,height,{alpha=1}={}){
  const large=height>92&&images[state.action].studio;
  const tier=large?TIERS[2]:TIERS[0],image=large||images[state.action].game;
  const rect=founderFrameRect(direction,phase,tier,frameCount()),width=height*tier.frameW/tier.frameH;
  target.save();target.globalAlpha*=alpha;target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';
  target.drawImage(image,rect.x,rect.y,rect.w,rect.h,x-width*ANCHOR.x,y-height*ANCHOR.y,width,height);target.restore();
}
function shadow(target,x,y,r,alpha=.24){target.save();target.fillStyle=`rgba(9,29,31,${alpha})`;target.beginPath();target.ellipse(x,y+2,r,r*.32,0,0,Math.PI*2);target.fill();target.restore();}

function ground(g){
  const gradient=ctx.createRadialGradient(w*.5,h*.45,0,w*.5,h*.48,w*.76);
  gradient.addColorStop(0,'#49655f');gradient.addColorStop(.65,'#304d50');gradient.addColorStop(1,'#253e46');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  if(state.mode==='roam'){
    // A fixed world grid makes foot sliding visible. Camera and grid do not
    // follow the character, and phase advances from traveled ground distance.
    const extent=Math.ceil(w/g.unit)+3;
    for(let z=-extent;z<=extent;z++)for(let x=-extent;x<=extent;x++){
      const p=screen(x,z,g);if(p.y<h*.2||p.y>h-30)continue;
      const tone=((Math.imul(x+29,374761393)^Math.imul(z+31,668265263))>>>0)%3;
      ctx.fillStyle=['#5b7064','#627768','#587064'][tone];ctx.strokeStyle='#455d55';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(p.x-g.unit*.48,p.y);ctx.lineTo(p.x,p.y-g.unit*.24);ctx.lineTo(p.x+g.unit*.48,p.y);ctx.lineTo(p.x,p.y+g.unit*.24);ctx.closePath();ctx.fill();ctx.stroke();
    }
  }else{
    ctx.fillStyle='#617669';ctx.beginPath();ctx.ellipse(g.ox,g.oy+8,Math.min(w*.35,265),Math.min(w*.35,265)*.28,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#a5ad80';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(g.ox,g.oy+5,Math.min(w*.33,248),Math.min(w*.33,248)*.28,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#879b7d55';
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(g.ox+Math.sin(a)*105,g.oy+5+Math.cos(a)*31);ctx.lineTo(g.ox+Math.sin(a)*Math.min(w*.31,229),g.oy+5+Math.cos(a)*Math.min(w*.31,229)*.28);ctx.stroke();}
  }
}
function footGuides(g,p,phase,direction){
  if(!$('contacts').checked)return;
  const row=DIRECTIONS.indexOf(direction),frame=founderFrameRect(direction,phase,TIERS[0],frameCount()).frame;
  const pose=state.mode==='source'&&sourceRig?{landmarks:sourceRig.landmarks()}:landmarks[state.action][row*frameCount()+frame];
  for(const [side,bone] of [['left','foot.l'],['right','foot.r']]){
    const [px,py]=pose.landmarks[bone].pixel;
    const x=p.x+(px/384-ANCHOR.x)*g.spriteH*128/168;
    const y=p.y+(py/504-ANCHOR.y)*g.spriteH;
    ctx.strokeStyle=contact(phase,side)?'#bef1bc':'#e5be79';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(x,y+g.spriteH*.047,6,2.5,0,0,Math.PI*2);ctx.stroke();
  }
}

function drawComparison(g){
  const y=g.oy,hgt=Math.min(290,g.spriteH),left=w*.28,right=w*.72;
  const dir={s:'down',se:'right',e:'right',ne:'right',n:'up',nw:'left',w:'left',sw:'left'}[state.direction];
  const row=(state.action==='walk'?4:0)+['down','up','left','right'].indexOf(dir),frame=Math.floor(state.phase*8)%8;
  const oldH=hgt*.92,oldW=oldH*64/84;
  shadow(ctx,left,y,oldW*.14);shadow(ctx,right,y,hgt*.14);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(images.old,frame*64,row*84,64,84,left-oldW/2,y-oldH*79/84,oldW,oldH);
  sprite(ctx,state.direction,state.phase,right,y,hgt);
  ctx.fillStyle='#e0e5d7';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('Current settler (4 views)',left,y+44);ctx.fillText('Founder (8 views)',right,y+44);
}
function draw(dt=0){
  if(!images)return;
  needsDraw=false;
  if(state.mode==='source'&&sourceRig){sourceRig.pose(ACTIONS[state.action].clip,state.phase,sourceYaw);sourceRig.render();}
  if(state.mode==='detail'&&detailed)detailed.render(ACTIONS[state.action].clip,state.phase,sourceYaw,dt,state.playing,$('contacts').checked);
  const g=geometry();ground(g);
  if(state.mode==='compare')drawComparison(g);
  else{
    const p=state.mode==='roam'?screen(state.position.x,state.position.z,g):{x:g.ox,y:g.oy};
    shadow(ctx,p.x,p.y,g.spriteH*.125);
    if(state.target&&state.mode==='roam'){
      const t=screen(state.target.x,state.target.z,g);ctx.strokeStyle='#e0c37c';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(t.x,t.y,8,4,0,0,Math.PI*2);ctx.stroke();
    }
    if((state.mode!=='source'||!sourceRig)&&(state.mode!=='detail'||!detailed)){
      if($('onion').checked){sprite(ctx,state.direction,state.phase-1/frameCount(),p.x,p.y,g.spriteH,{alpha:.17});sprite(ctx,state.direction,state.phase+1/frameCount(),p.x,p.y,g.spriteH,{alpha:.17});}
      sprite(ctx,state.direction,state.phase,p.x,p.y,g.spriteH);
    }
    footGuides(g,p,state.phase,state.direction);
  }
  for(const tile of tiles){const c=tile.ctx;c.clearRect(0,0,192,210);shadow(c,96,178,24,.2);sprite(c,tile.direction,state.phase,96,178,190);}
  const small=$('small').getContext('2d');small.clearRect(0,0,220,82);shadow(small,46,55,5);sprite(small,state.direction,state.phase,46,55,42);shadow(small,134,60,10);sprite(small,state.direction,state.phase,134,60,70);small.fillStyle='#afc0bb';small.font='10px system-ui';small.textAlign='center';small.fillText('1×',46,77);small.fillText('Detail',134,77);
  const frame=founderFrameRect(state.direction,state.phase,TIERS[0],frameCount()).frame;
  $('phase').value=String(frame);$('pose-label').textContent=`Pose ${frame+1} / ${frameCount()}`;
  for(const b of $('beats').children){const next=ACTIONS[state.action].beats.find(([f])=>f>Number(b.dataset.frame))?.[0]??frameCount();b.classList.toggle('active',frame>=Number(b.dataset.frame)&&frame<next);}
  lastRendered={action:state.action,phase:state.phase,direction:state.direction,mode:state.mode};
  for(const side of ['left','right']){const planted=contact(state.phase,side);$(`${side}-foot`).textContent=`${side==='left'?'Left':'Right'} ${planted?'planted':'swinging'}`;$(`${side}-foot`).classList.toggle('planted',planted);}
}

function update(dt){
  if(!state.playing)return;
  const elapsed=dt*state.rate;
  if(state.mode==='roam'){
    const g=geometry();let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    let dz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(dx||dz)state.target=null;
    else if(state.target){dx=state.target.x-state.position.x;dz=state.target.z-state.position.z;}
    const len=Math.hypot(dx,dz);
    if(len>1e-5){
      const travel=Math.min(len,elapsed*STRIDE/DURATION*(keys.has('shift')?2:1));
      const old={...state.position};state.position.x+=dx/len*travel;state.position.z+=dz/len*travel;
      state.position.x=Math.max((-g.ox+48)/g.unit,Math.min((w-g.ox-48)/g.unit,state.position.x));
      state.position.z=Math.max((h*.27-g.oy)/(g.unit*.5),Math.min((h-54-g.oy)/(g.unit*.5),state.position.z));
      const moved=Math.hypot(state.position.x-old.x,state.position.z-old.z);
      if(moved>1e-6){state.phase=(state.phase+moved/STRIDE)%1;state.travel+=moved;selectDirection(founderDirection(dx,dz*.5,state.direction),false);state.settling=true;}
      else state.target=null;
      if(travel>=len)state.target=null;
    }else if(state.settling){
      // Finish at the next double-support pose; both feet rest on the floor.
      const within=(state.phase%0.5);
      const remaining=(0.5-within)%0.5;
      if(remaining<.015){state.phase=(Math.round(state.phase*2)/2)%1;state.settling=false;}
      else state.phase=(state.phase+Math.min(remaining,elapsed*2.5))%1;
    }
  }else{
    const previousPhase=state.phase;
    state.phase=(state.phase+elapsed/actionDuration())%1;
    // Let a complete gesture read before changing the automatic view.
    if($('turns').checked){state.turnClock+=elapsed;if(state.phase<previousPhase&&state.turnClock>=2.6){state.turnClock=0;selectDirection(DIRECTIONS[(DIRECTIONS.indexOf(state.direction)+1)%8],false);}}
  }
}
function resizeSource(){
  const g=geometry();const width=g.spriteH*128/168,height=g.spriteH;
  sourceRig.renderer.setSize(Math.round(width*dpr),Math.round(height*dpr),false);
  const c=sourceRig.renderer.domElement;c.style.width=`${width}px`;c.style.height=`${height}px`;c.style.left=`${g.ox}px`;c.style.top=`${g.oy+height*(.5-ANCHOR.y)}px`;
}
async function setMode(mode){
  needsDraw=true;
  state.mode=mode;state.target=null;keys.clear();
  document.body.classList.toggle('detail-active',mode==='detail');$('material-controls').hidden=mode!=='detail';
  $('onion').disabled=mode==='detail'||mode==='source';
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  $('stage-hint').textContent={detail:'Drag to turn · move the light · come closer to see the surfaces',cycle:ACTIONS[state.action].description,roam:'Click to walk · WASD or arrow keys · Shift for a brisk pace',source:'Drag to turn · the same skeleton behind the sprite maps',compare:'Both characters share the same cycle position'}[mode];
  if(sourceRig)sourceRig.renderer.domElement.hidden=mode!=='source';
  if(detailed)detailed.canvas.hidden=mode!=='detail';
  if(['cycle','compare'].includes(mode))loadLargeSprite(state.action);
  if(mode==='roam'){selectAction('walk');$('turns').checked=false;setPlaying(true);stage.focus({preventScroll:true});}
  if(mode==='source'&&!sourceRig&&!sourceLoading){
    sourceLoading=true;
    try{const {createFounderRig}=await import('./rig.js');sourceRig=await createFounderRig({width:384,height:504,modelURL:new URL(`../../assets/sprites/founder/founder-actions.glb?v=${manifest.outputs.find(o=>o.file==='founder-actions.glb').sha256}`,import.meta.url).href,applyGrounding:false,clipName:'Realm_Grounded_Walk'});sourceRig.renderer.domElement.className='source-canvas';sourceRig.renderer.domElement.hidden=state.mode!=='source';stage.append(sourceRig.renderer.domElement);resizeSource();}
    catch(error){$('stage-hint').textContent='3D preview could not start. The sprite preview and Blender scene are still available.';console.error(error);}
    finally{sourceLoading=false;}
  }
  if(mode==='detail'&&!detailed&&!detailLoading){
    detailLoading=true;
    try{
      const {createDetailedScene}=await import('./detailed-scene.js');
      detailed=await createDetailedScene({modelURL:new URL(`../../assets/sprites/founder/founder-actions.glb?v=${manifest.outputs.find(o=>o.file==='founder-actions.glb').sha256}`,import.meta.url).href,
        onStatus:text=>$('render-stats').textContent=text,
        onContextLost:()=>{$('stage-hint').textContent='Graphics paused. Showing the sprite study while the graphics context recovers.';setMode('cycle');}});
      detailed.canvas.hidden=state.mode!=='detail';stage.append(detailed.canvas);detailed.resize(w,h);applyMaterialControls();draw();
    }catch(error){$('render-stats').textContent='Live graphics unavailable. The sprite study is ready.';console.warn(error.message);if(state.mode==='detail')setMode('cycle');}
    finally{detailLoading=false;}
  }
  draw();
}
function applyMaterialControls(){if(!detailed)return;detailed.setLight(document.querySelector('[data-light][aria-pressed=true]').dataset.light,Number($('light-angle').value));detailed.setZoom(Number($('detail-zoom').value));detailed.setQuality($('render-quality').value);detailed.setDetail($('surface-detail').checked);detailed.setWireframe($('wireframe').checked);}
document.querySelectorAll('[data-light]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-light]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));applyMaterialControls();draw();}));
for(const id of ['light-angle','detail-zoom'])$(id).addEventListener('input',()=>{if(id==='detail-zoom')detailed?.setZoom(Number($(id).value));else detailed?.setLight(undefined,Number($(id).value));draw();});
for(const id of ['surface-detail','wireframe','render-quality'])$(id).addEventListener('change',()=>{applyMaterialControls();draw();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{if(state.mode==='roam')setMode('cycle');selectAction(b.dataset.action,{play:!matchMedia('(prefers-reduced-motion: reduce)').matches});}));
$('play').addEventListener('click',()=>setPlaying(!state.playing));
$('previous').addEventListener('click',()=>setPhase(Math.floor(state.phase*frameCount()+1e-9)-1));$('next').addEventListener('click',()=>setPhase(Math.floor(state.phase*frameCount()+1e-9)+1));
$('phase').addEventListener('input',e=>setPhase(e.target.value));$('rate').addEventListener('change',e=>state.rate=Number(e.target.value));
$('contacts').addEventListener('change',()=>{$('contact-readout').hidden=!$('contacts').checked;draw();});
$('onion').addEventListener('change',()=>draw());
stage.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown','shift'].includes(key)){e.preventDefault();keys.add(key);if(state.mode==='roam')setPlaying(true);}if(key===' '){e.preventDefault();setPlaying(!state.playing);}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
stage.addEventListener('pointerdown',e=>{
  if(state.mode==='source'||state.mode==='detail'){dragStart={x:e.clientX,yaw:sourceYaw};stage.setPointerCapture(e.pointerId);$('turns').checked=false;}
  if(state.mode==='roam'){const g=geometry(),r=stage.getBoundingClientRect();state.target={x:(e.clientX-r.left-g.ox)/g.unit,z:(e.clientY-r.top-g.oy)/(g.unit*.5)};setPlaying(true);stage.focus({preventScroll:true});}
});
stage.addEventListener('pointermove',e=>{if(dragStart){sourceYaw=dragStart.yaw+(e.clientX-dragStart.x)*.012;needsDraw=true;$('view-label').textContent=`${Math.round((sourceYaw*180/Math.PI%360+360)%360)}° free turn`;}});
stage.addEventListener('pointerup',()=>dragStart=null);stage.addEventListener('pointercancel',()=>{dragStart=null;keys.clear();});

try{
  manifest=await fetch('assets/sprites/founder/manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Could not load the animation manifest');return r.json();});
  const loaded=await Promise.all(Object.keys(ACTIONS).map(async id=>{
    const url=file=>`assets/sprites/founder/${file}?v=${manifest.outputs.find(o=>o.file===file)?.sha256||manifest.version}`;
    const [game,poses]=await Promise.all([loadImage(url(`${id}-64.png`)),fetch(`assets/sprites/founder/${id==='walk'?'landmarks':id+'-landmarks'}.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Could not load pose landmarks');return r.json();})]);
    return{id,game,studio:null,poses};
  }));
  images=Object.fromEntries(loaded.map(({id,game,studio})=>[id,{game,studio}]));
  images.old=await loadImage('assets/sprites/actors-compiled/settler.png');landmarks=Object.fromEntries(loaded.map(({id,poses})=>[id,poses]));
  $('load-status').textContent='Four actions · eight views';
  selectAction('point',{play:state.playing});resized();selectDirection('se',false);
  setMode('detail');
  let previous=performance.now();
  function animate(now){const elapsed=(now-previous)/1000;previous=now;if(!document.hidden){update(Math.min(.05,elapsed));if(state.playing||needsDraw)draw(elapsed);}requestAnimationFrame(animate);}
  requestAnimationFrame(animate);
  // The local browser gate observes the same controls and motion state.
  window.__walkStudio={state,get ready(){return !!images;},get sourceReady(){return !!sourceRig;},get detailReady(){return !!detailed;},get detailDiagnostics(){return detailed?.diagnostics;},get detailLandmarks(){return detailed?.landmarks();},get detailRenderer(){return detailed?.renderer;},get rendered(){return lastRendered;},get sourceLandmarks(){return sourceRig?.landmarks();},get sourceYaw(){return sourceYaw;},get loadedAsset(){return (images[state.action].studio||images[state.action].game).src;},get largeAtlasCount(){return Object.values(images).filter(a=>a.studio).length;}};
}catch(error){$('load-status').textContent=`The actions could not load. ${error.message}`;console.error(error);}
