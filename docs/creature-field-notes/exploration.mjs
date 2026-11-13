// Deterministic turn-based exploration: no timer, collision physics, or touch gestures.
export const TRAIL = ['..F.#L.','.##.#..','L...#D.','.#.....','.#.##..','M...#L.','H......'];
export const HOME = 42;
export const LIGHT = 12;
const items = { F:['moonflower','Moonflower','✿'], M:['moss','River moss','≋'], D:['dew','Morning dew','◊'] };
export function newJourney() { return { position:HOME, light:LIGHT, moves:0, rescues:0, collected:[], lanterns:[], complete:false }; }
export function terrain(index) { return TRAIL[Math.floor(index/7)]?.[index%7]; }
export function advance(state, next) {
 const result = { ...state, collected:[...state.collected], lanterns:[...state.lanterns] };
 if(state.complete) return { state:result, message:'The pond is safe. Your ingredients are ready at the workbench.' };
 if(!Number.isInteger(next)||next<0||next>48||Math.abs(next%7-state.position%7)+Math.abs(Math.floor(next/7)-Math.floor(state.position/7))!==1) return { state:result, message:'Choose a neighboring stepping stone, or use the direction buttons.' };
 if(terrain(next)==='#') return { state:result, message:'Deep water blocks that route. Find another stepping stone.' };
 if(state.light===0) return { state:result, message:'Your light has faded. Return safely to camp to refill; discoveries are kept.' };
 result.position=next; result.light--; result.moves++;
 let message='One careful step. Watch your light and plan your next lantern stop.';
 const item=items[terrain(next)];
 let collected;
 if(item&&!result.collected.includes(item[0])) { result.collected.push(item[0]); collected=item[0]; message=`${item[1]} found! ${result.collected.length} of 3 ingredients in your basket.`; }
 if(terrain(next)==='L') { if(!result.lanterns.includes(next))result.lanterns.push(next); result.light=LIGHT; message=`Lantern kindled. ${result.lanterns.length} of 3 lit; your traveling light is full.`; }
 if(next===HOME) { result.light=LIGHT; message='Back at camp. Your light is full. Find all three ingredients and kindle all three lanterns.'; }
 result.complete=next===HOME&&result.collected.length===3&&result.lanterns.length===3;
 if(result.complete) message=`You restored the pond in ${result.moves} steps with ${result.rescues} camp returns! ${result.rescues===0?'Trailkeeper route: every lantern reached on your own light.':'Steady explorer: every discovery brought home safely.'} All three ingredients are ready. Brew your remedy below.`;
 else if(result.light===0) message+=' Your light has faded. Use Return to camp to continue safely.';
 return {state:result,message,collected};
}
export function initExploration({onCollect=()=>{},onComplete=()=>{},onReset=()=>{}}={}) {
 const mount=document.querySelector('#exploration'); if(!mount)return;
 let state=newJourney();
 mount.innerHTML=`<div class="exp-heading"><div><p class="chapter">Chapter 01 · Restore the lantern path</p><h2>A little courage. A little light.</h2><p>Find three ingredients, kindle three lanterns, then return to the frog’s camp. Each step uses light. Lanterns refill it.</p></div><img src="assets/frog-alchemist.svg" width="100" height="100" alt="The original Frog Alchemist, waiting at camp"></div><div class="exp-layout"><div><div class="exp-hud" aria-label="Journey progress"><span>Light <b id="exp-light">12 / 12</b></span><span>Basket <b id="exp-basket">0 / 3</b></span><span>Lanterns <b id="exp-lanterns">0 / 3</b></span><span>Steps <b id="exp-steps">0</b></span><span>Returns <b id="exp-returns">0</b></span></div><div class="exp-board-scroll"><div class="exp-board" role="group" aria-label="Lantern path. Use arrow keys or W A S D while focused, or tap a neighboring tile." tabindex="0"></div></div><p class="exp-legend">✦ You · ⌂ Camp · ♧ Lantern · ✿ ≋ ◊ Ingredients · Dark tiles are deep water</p></div><div class="exp-controls"><p id="exp-feedback" role="status">You are at camp, in the bottom-left corner. Tap a neighboring stepping stone to begin.</p><div class="exp-pad" role="group" aria-label="Move around the pond"><button type="button" data-step="up" aria-label="Move up">↑</button><button type="button" data-step="left" aria-label="Move left">←</button><button type="button" data-step="down" aria-label="Move down">↓</button><button type="button" data-step="right" aria-label="Move right">→</button></div><button type="button" id="exp-rescue">Return to camp · refill light</button><button type="button" id="exp-restart">Try a fresh route</button><p class="exp-tip">No rush: time never runs out. Return to camp whenever you need; discoveries stay in your basket. Try finishing with fewer steps and no returns.</p><button type="button" id="exp-finish" hidden>Ingredients ready → Brew your remedy</button></div></div>`;
 const board=mount.querySelector('.exp-board'), feedback=mount.querySelector('#exp-feedback');
 mount.querySelector('.exp-heading').after(feedback);
 const tiles=[];
 for(let i=0;i<49;i++) { const tile=document.createElement('button'); tile.type='button'; tile.className='exp-tile'; tile.dataset.cell=i; tile.tabIndex=-1; tile.addEventListener('click',()=>move(i)); tiles.push(tile); board.append(tile); }
 const token=document.createElement('span');token.className='exp-player';token.setAttribute('aria-hidden','true');token.textContent='✦';board.append(token);
 function paint() {
  mount.querySelector('#exp-light').textContent=`${state.light} / ${LIGHT}`;mount.querySelector('#exp-basket').textContent=`${state.collected.length} / 3`;mount.querySelector('#exp-lanterns').textContent=`${state.lanterns.length} / 3`;mount.querySelector('#exp-steps').textContent=String(state.moves);mount.querySelector('#exp-returns').textContent=String(state.rescues);
  mount.dataset.complete=String(state.complete);mount.dataset.lowlight=String(state.light<=3);
  for(let i=0;i<49;i++) { const t=terrain(i),item=items[t],lit=state.lanterns.includes(i),found=item&&state.collected.includes(item[0]);const near=Math.abs(i%7-state.position%7)+Math.abs(Math.floor(i/7)-Math.floor(state.position/7))===1;
   tiles[i].dataset.kind=t==='#'?'water':t==='L'?'lantern':t==='H'?'camp':'stone';tiles[i].classList.toggle('is-near',near&&t!=='#');tiles[i].classList.toggle('is-lit',lit);tiles[i].classList.toggle('is-player',i===state.position);
   tiles[i].textContent=t==='#'?'':t==='H'?'⌂':t==='L'?'♧':item&&!found?item[2]:'';
   const name=t==='#'?'Deep water':t==='H'?'Camp':t==='L'?`${lit?'Lit':'Unlit'} lantern`:item&&!found?item[1]:'Stepping stone';
   tiles[i].setAttribute('aria-label',`Row ${Math.floor(i/7)+1}, column ${i%7+1}: ${name}${i===state.position?', you are here':near?', adjacent':''}`);
  }
  token.style.left=`${(state.position%7+.5)*100/7}%`;token.style.top=`${(Math.floor(state.position/7)+.5)*100/7}%`;
  mount.querySelector('#exp-finish').hidden=!state.complete;
 }
 function move(next) {const result=advance(state,next);state=result.state;feedback.textContent=result.message;paint();if(result.collected)onCollect(result.collected);if(state.complete&&!move.completed){move.completed=true;onComplete({...state});}}
 function direction(name) { const offset={up:-7,down:7,left:-1,right:1}[name];move(state.position+offset); }
 mount.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>direction(button.dataset.step)));
 board.addEventListener('keydown',event=>{if(event.target!==board&&!tiles.includes(event.target))return;const key={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[event.key];if(key){event.preventDefault();direction(key);}});
 mount.querySelector('#exp-rescue').addEventListener('click',()=>{if(state.complete){feedback.textContent='The path is restored. Brew your remedy below, or try a fresh route.';return;}state.position=HOME;state.light=LIGHT;state.rescues++;feedback.textContent=`Safely back at camp. Light refilled; discoveries kept. Camp returns: ${state.rescues}.`;paint();});
 function reset(){state=newJourney();move.completed=false;feedback.textContent='A fresh route. Your journal and gathered ingredients at the workbench are safe.';paint();onReset();}
 mount.querySelector('#exp-restart').addEventListener('click',reset);
 mount.querySelector('#exp-finish').addEventListener('click',()=>{ const stage=document.querySelector('#brewing-stage'); if(stage){stage.scrollIntoView({block:'start',behavior:'instant'}); const target=stage.querySelector('button:not(:disabled)');target?.focus({preventScroll:true});} });
 paint();return {reset,getState:()=>structuredClone(state)};
}
