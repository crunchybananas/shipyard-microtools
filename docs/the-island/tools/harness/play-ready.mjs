// Enter real play before judging a frame. Autosave may recreate a removed save
// before navigation, so Begin can legitimately open its confirmation dialog.
export async function beginPlay(h) {
  await h.evaluate(`document.getElementById('btn-begin').click();
    if(!document.getElementById('begin-confirm').classList.contains('hidden'))
      document.getElementById('btn-begin-confirm').click();1`);
  await h.wait(1.2);
  if(!await h.evaluate('ABYME.setIntroT(99)'))throw new Error('Begin did not start the arrival');
  const ready=await h.evaluate(`new Promise(resolve=>{let frames=0;function next(){
    if(!ABYME.player.locked&&ABYME.interact.enabled&&ABYME.W.flags.introDone
      &&document.getElementById('title-screen').style.display==='none'){
      requestAnimationFrame(()=>resolve(true));return;
    }if(++frames>=30){resolve(false);return;}requestAnimationFrame(next);
  }requestAnimationFrame(next);})`);
  if(!ready)throw new Error('The arrival did not release player control');
}

export const renderedFrames=h=>h.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');

export async function waitForFrame(h,predicate,label,maxFrames=60) {
  const reached=await h.evaluate(`new Promise(resolve=>{let n=0;function step(){
    if(${predicate}){resolve(true);return;}if(++n>=${maxFrames}){resolve(false);return;}
    requestAnimationFrame(step);
  }requestAnimationFrame(step);})`);
  if(!reached){
    const state=await h.evaluate('({position:ABYME.player.pos.toArray(),locked:ABYME.player.locked,hover:ABYME.interact.hovered?.id,enabled:ABYME.interact.enabled,mouse:ABYME.interact.mouse.toArray(),reader:ABYME.UI._reader?.id})');
    throw new Error(`Rendered state never arrived: ${label} ${JSON.stringify(state)}`);
  }
}

// Advance an existing gameplay animation, never assign its end state. Native
// checks keep wall time; software GL uses the same production-sized tick steps.
export async function advanceGameplay(h,seconds) {
  if(process.env.CI==='true')await h.evaluate(`(()=>{
    for(let i=0;i<${Math.ceil(seconds/.05)};i++)ABYME.game.tick(.05,performance.now()/1000+i*.05);return true;
  })()`);
  else await h.wait(seconds);
  await renderedFrames(h);
}
