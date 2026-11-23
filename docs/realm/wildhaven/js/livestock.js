import { CALENDAR_DAY_SECONDS } from './calendar.js';

export const LIVESTOCK=Object.freeze({
 pasture:{name:'goat',plural:'goats',model:'goat',capacity:[4,6,8],mature:2*CALENDAR_DAY_SECONDS,birth:3*CALENDAR_DAY_SECONDS,price:12,sale:6,feed:1.4,food:6},
 henhouse:{name:'hen',plural:'hens',model:'hen',capacity:[6,9,12],mature:CALENDAR_DAY_SECONDS,birth:2*CALENDAR_DAY_SECONDS,price:6,sale:3,feed:.8,food:3.8},
});
const round=n=>Math.round(n*1e6)/1e6;
export const createLivestock=()=>({version:1,pens:{}});
const empty=()=>({animals:[],nextId:1,condition:1,breeding:true,birthProgress:0});
export function herdFor(state,b){return state.livestock?.pens[b.id]||empty();}
function writableHerd(state,b){state.livestock||=createLivestock();return state.livestock.pens[b.id]||=empty();}
export function herdStatus(state,b){
 const spec=LIVESTOCK[b.type];if(!spec)return null;const herd=herdFor(state,b),adults=herd.animals.filter(a=>a.age>=spec.mature).length;
 return {spec,herd,adults,young:herd.animals.length-adults,total:herd.animals.length,capacity:spec.capacity[(b.level||1)-1],feed:(adults+(herd.animals.length-adults)*.5)*spec.feed,food:adults*spec.food*herd.condition};
}
export function buyLivestock(state,b){
 const status=herdStatus(state,b);if(!status||b.status!=='ready')return {ok:false,reason:'Finish an animal shelter first.'};
 if(status.total>=status.capacity)return {ok:false,reason:'This shelter is full. Upgrade it for more room.'};
 if((state.resources.gold||0)<status.spec.price)return {ok:false,reason:`Needs ${status.spec.price} coin.`};
 state.resources.gold-=status.spec.price;const herd=writableHerd(state,b);herd.animals.push({id:herd.nextId++,age:status.spec.mature});return {ok:true,reason:`One ${status.spec.name} has arrived. Keep grain and animal keepers available.`};
}
export function sellLivestock(state,b){
 const status=herdStatus(state,b);if(!status?.total)return {ok:false,reason:'There are no animals to sell.'};
 const herd=writableHerd(state,b),animal=herd.animals.pop(),coin=animal.age>=status.spec.mature?status.spec.sale:1;
 state.resources.gold=round(state.resources.gold+coin);return {ok:true,reason:`Sold one ${status.spec.name} for ${coin} coin.`};
}
export function setBreeding(state,b,on){if(!LIVESTOCK[b.type])return {ok:false,reason:'Choose an animal shelter.'};writableHerd(state,b).breeding=!!on;return {ok:true,reason:on?'Breeding allowed while there is room.':'Breeding paused. Existing young keep growing.'};}
export function tickLivestock(state,dt){
 let changed=false;
 for(const b of state.buildings){const status=herdStatus(state,b);if(!status?.total)continue;const herd=writableHerd(state,b),care=Math.min(1,b.production?.efficiency||0),oldAdults=status.adults;
  herd.condition=Math.max(0,Math.min(1,round(herd.condition+dt/CALENDAR_DAY_SECONDS*(care>=.75?.5:-(1-care)))));
  for(const animal of herd.animals)animal.age=Math.min(status.spec.mature,animal.age+dt*care);
  if(herd.breeding&&status.adults>=2&&status.total<status.capacity&&herd.condition>=.75&&care>=.75){herd.birthProgress+=dt*care;if(herd.birthProgress>=status.spec.birth){herd.birthProgress-=status.spec.birth;herd.animals.push({id:herd.nextId++,age:0});changed=true;}}
  changed ||= herd.animals.filter(a=>a.age>=status.spec.mature).length!==oldAdults;
 }
 return changed;
}
export function restoreLivestock(input,buildings){
 if(input===undefined)return createLivestock();if(!input||input.version!==1||!input.pens||typeof input.pens!=='object'||Array.isArray(input.pens))throw Error('Invalid livestock');
 const out=createLivestock();
 for(const[id,h]of Object.entries(input.pens)){
  const b=buildings.find(b=>b.id===id),spec=b&&LIVESTOCK[b.type];if(!spec||!h||!Array.isArray(h.animals)||h.animals.length>spec.capacity[(b.level||1)-1]||!Number.isSafeInteger(h.nextId)||h.nextId<1||typeof h.breeding!=='boolean'||!Number.isFinite(h.condition)||h.condition<0||h.condition>1||!Number.isFinite(h.birthProgress)||h.birthProgress<0||h.birthProgress>=spec.birth)throw Error('Invalid animal shelter');
  const ids=new Set();for(const a of h.animals){if(!a||!Number.isInteger(a.id)||a.id<1||a.id>=h.nextId||ids.has(a.id)||!Number.isFinite(a.age)||a.age<0||a.age>spec.mature)throw Error('Invalid farm animal');ids.add(a.id);}
  out.pens[id]={animals:h.animals.map(a=>({id:a.id,age:a.age})),nextId:h.nextId,condition:h.condition,breeding:h.breeding,birthProgress:h.birthProgress};
 }
 return out;
}
