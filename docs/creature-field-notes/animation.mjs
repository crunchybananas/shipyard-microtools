// Animation is a presentation layer: it cannot change puzzle state or block controls.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reduced.matches;
let running = false;
let inViewport = false;
let frame = 0;
let last = 0;
let elapsed = 0;
let canvas, ctx, width = 0, height = 0;
let activeAnimations = [];
const motes = Array.from({ length: 22 }, (_, index) => ({
  x: ((index * 0.61803398875) % 1), y: ((index * 0.38196601125 + .17) % 1),
  phase: index * 1.73, radius: index % 4 === 0 ? 2.3 : 1.1,
}));
function visible() { return inViewport && !document.hidden && !document.querySelector('#pond').hidden; }
function paint(now) {
  if (!running) return;
  const delta = last ? Math.min((now-last)/1000, .05) : 0; last=now; elapsed+=delta;
  ctx.clearRect(0,0,width,height);
  for (const mote of motes) {
    const x=mote.x*width+Math.sin(elapsed*.25+mote.phase)*15;
    const y=mote.y*height+Math.cos(elapsed*.32+mote.phase)*11;
    const alpha=.18+.33*(.5+.5*Math.sin(elapsed*1.2+mote.phase));
    const glow=ctx.createRadialGradient(x,y,0,x,y,mote.radius*5);
    glow.addColorStop(0,`rgba(255,237,163,${alpha})`); glow.addColorStop(1,'rgba(255,237,163,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(x,y,mote.radius*5,0,Math.PI*2); ctx.fill();
  }
  frame=requestAnimationFrame(paint);
}
export function syncAnimation() {
  document.documentElement.classList.toggle('motion-on', motion);
  const button=document.querySelector('#motion');
  button.textContent=motion?'Motion on':'Motion off'; button.setAttribute('aria-pressed',String(motion));
  cancelAnimationFrame(frame); running=motion&&visible()&&Boolean(ctx); last=0;
  if(running) frame=requestAnimationFrame(paint);
  else ctx?.clearRect(0,0,width,height);
  if(!motion) { const plate=document.querySelector('.living-plate'); plate.style.setProperty('--tilt-x','0deg'); plate.style.setProperty('--tilt-y','0deg'); activeAnimations.forEach(animation=>animation.cancel()); activeAnimations=[]; }
}
export function initAnimation() {
  canvas=document.querySelector('#fireflies'); ctx=canvas.getContext('2d');
  const resize=()=>{ const box=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio||1,2); width=box.width; height=box.height; canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio); ctx?.setTransform(ratio,0,0,ratio,0,0); };
  new ResizeObserver(resize).observe(canvas); resize();
  new IntersectionObserver(entries=>{ inViewport=entries[0].isIntersecting; syncAnimation(); }).observe(canvas);
  document.querySelector('#motion').addEventListener('click',()=>{ motion=!motion; syncAnimation(); });
  reduced.addEventListener('change',()=>{ motion=!reduced.matches; syncAnimation(); });
  document.addEventListener('visibilitychange',syncAnimation);
  const plate=document.querySelector('.living-plate');
  plate.addEventListener('pointermove',event=>{ if(!motion||event.pointerType==='touch') return; const box=plate.getBoundingClientRect(); plate.style.setProperty('--tilt-x',`${(event.clientX-box.left-box.width/2)/box.width*3}deg`); plate.style.setProperty('--tilt-y',`${-(event.clientY-box.top-box.height/2)/box.height*3}deg`); });
  plate.addEventListener('pointerleave',()=>{ plate.style.setProperty('--tilt-x','0deg'); plate.style.setProperty('--tilt-y','0deg'); });
  syncAnimation();
}
export function animateIngredient(button, symbol, color) {
  if(!motion) return;
  const from=button.getBoundingClientRect();
  const bottle=document.querySelector('.potion-light').getBoundingClientRect();
  const bottleVisible=bottle.top>0 && bottle.bottom<innerHeight;
  const to=bottleVisible?bottle:document.querySelector('.pot').getBoundingClientRect();
  const sprite=document.createElement('span'); sprite.className='ingredient-flight'; sprite.setAttribute('aria-hidden','true'); sprite.textContent=symbol;
  sprite.style.setProperty('--ingredient-color',color); sprite.style.left=`${from.left+from.width/2-18}px`; sprite.style.top=`${from.top+15}px`; document.body.append(sprite);
  const dx=to.left+to.width/2-from.left-from.width/2, dy=to.top+(bottleVisible?to.height/2:60)-from.top-15;
  const flight=sprite.animate([{transform:'translate(0,0) scale(.7)',opacity:0},{transform:`translate(${dx*.4}px,${Math.min(-55,dy*.2)}px) scale(1.3)`,opacity:1,offset:.4},{transform:`translate(${dx}px,${dy}px) scale(.25)`,opacity:0}],{duration:760,easing:'cubic-bezier(.22,.6,.4,1)'});
  activeAnimations.push(flight); flight.finished.catch(()=>{}).finally(()=>{sprite.remove();activeAnimations=activeAnimations.filter(item=>item!==flight);});
}
export function celebrate() {
  document.querySelector('.living-plate').classList.add('lantern-lit');
  if(!motion) return;
  const plate=document.querySelector('.living-plate');
  const animation=plate.animate([{filter:'brightness(1)'},{filter:'brightness(1.14)',offset:.35},{filter:'brightness(1)'}],{duration:1600,easing:'ease-out'});
  activeAnimations.push(animation); animation.finished.catch(()=>{}).finally(()=>activeAnimations=activeAnimations.filter(item=>item!==animation));
  const area=plate.getBoundingClientRect();
  for(let index=0;index<18;index++) {
    const spark=document.createElement('i'); spark.className='reward-spark'; spark.setAttribute('aria-hidden','true'); spark.style.left=`${area.left+area.width*.56}px`; spark.style.top=`${area.top+area.height*.5}px`;document.body.append(spark);
    const angle=index/18*Math.PI*2, distance=60+(index%4)*25;
    const burst=spark.animate([{transform:'translate(0,0) scale(0)',opacity:0},{opacity:1,offset:.12},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance-70}px) scale(.2)`,opacity:0}],{duration:1400+(index%3)*220,delay:index*25,easing:'ease-out'});
    activeAnimations.push(burst);burst.finished.catch(()=>{}).finally(()=>{spark.remove();activeAnimations=activeAnimations.filter(item=>item!==burst);});
  }
}
