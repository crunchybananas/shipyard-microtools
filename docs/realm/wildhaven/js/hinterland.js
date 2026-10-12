/** Crops, journeys and shared projects. Game time and earned progress only. */
import { CALENDAR_DAY_SECONDS as DAY } from './calendar.js';
import { ISLAND_REGIONS } from './island.js';
export const PRODUCE = Object.freeze({roots:{name:'Carrots',color:'#c17d39'},beans:{name:'Beans',color:'#71956e'},herbs:{name:'Herbs',color:'#789c94'},berries:{name:'Berries',color:'#98597b'},clay:{name:'River clay',color:'#b27b61'},wool:{name:'Wild wool',color:'#d6d0af'}});
export const CROPS = Object.freeze({roots:{name:'Carrots',days:1,yield:12,description:'A dependable crop for shared kitchens.'},beans:{name:'Climbing beans',days:1.5,yield:18,description:'Reedbank shares these seeds after its first request.'},herbs:{name:'Kitchen herbs',days:2,yield:14,description:'Bring wild herbs home from Mistfen to learn this crop.'}});
export const REGION_LINKS = Object.freeze({home:['pineward','highmeadow','reedmarch'],pineward:['home','highmeadow','bramblewood'],highmeadow:['home','pineward','reedmarch','crownhill'],reedmarch:['home','highmeadow','sunmeadow'],crownhill:['highmeadow','farreach'],bramblewood:['pineward','farreach'],sunmeadow:['reedmarch','mistfen'],mistfen:['sunmeadow','farreach'],farreach:['bramblewood','crownhill','mistfen']});
export const GATHERING = Object.freeze([
 {id:'blackberry_hollow',name:'Blackberry hollow',region:'pineward',x:-17,z:-8,good:'berries',amount:14,days:1,work:24,story:'Pick the ripe berries; leave the green ones for the next visit.'},
 {id:'reed_clay',name:'Reedbank clay beds',region:'reedmarch',x:12,z:-14,good:'clay',amount:16,days:1.5,work:32,story:'Fine river clay for the potters and the spring channels.'},
 {id:'bramble_baskets',name:'The old berry walk',region:'bramblewood',x:-27,z:-30,good:'berries',amount:28,days:2,work:48,story:'Follow the old orchard walls to a sheltered thicket.'},
 {id:'sunmeadow_flock',name:'The hill flock',region:'sunmeadow',x:26,z:-30,good:'wool',amount:18,days:2,work:42,story:'The shepherd leaves combs on the gate. Gather wool caught on the hedges.'},
 {id:'mistfen_herbs',name:'Mistfen herb banks',region:'mistfen',x:20,z:-47,good:'herbs',amount:18,days:2,work:48,story:'Bring cuttings home; these herbs will take root in a kitchen garden.',seed:'herbs'},
 {id:'farreach_clay',name:'The blue clay shore',region:'farreach',x:-4,z:-49,good:'clay',amount:32,days:2,work:55,story:'A long expedition brings back the clay that holds water through dry summers.'},
]);
export const NEIGHBOR_STORIES = Object.freeze({
 reedbank:{speaker:'Mara, the seed keeper',about:'Reedbank grows food along the river. The spring floods took their seed terraces.',steps:[
  {title:'Supper before sowing',text:'Reedbank needs carrots, berries and timber for the planting season.',goods:{roots:18,berries:12},supplies:{wood:20},reward:{gold:25},seed:'beans',benefit:'Climbing bean seeds for your gardens.'},
  {title:'Mend the terraces',text:'Clay-lined channels will keep the river out and the seedlings in.',goods:{clay:28,beans:24},supplies:{stone:30},reward:{gold:45,knowledge:12},benefit:'A permanent 15% bonus to carrot, bean and herb harvests.'},
  {title:'The riverside kitchen',text:'Raise a kitchen where travelers from both towns can eat.',goods:{roots:36,beans:36,wool:12},supplies:{planks:16},reward:{gold:65,knowledge:20},benefit:'Reedbank joins the shared coastal patrol.'},
 ]},
 stonehaven:{speaker:'Ivo, the quarry keeper',about:'Stonehaven has strong walls and tired hands. Its people need care as much as stone.',steps:[
  {title:'The quarry infirmary',text:'Help the healers stock clean bedding and herb dressings.',goods:{herbs:18,wool:12},supplies:{cloth:8},reward:{iron:12,gold:25},benefit:'Stonehaven shares iron and opens its next project.'},
  {title:'A covered way',text:'The masons need clay and provisions to shelter the road between the towns.',goods:{clay:32,roots:30},supplies:{wood:30},reward:{tools:10,gold:45},benefit:'Gathering trips work 20% faster at their destination.'},
  {title:'The lantern watch',text:'Keep lamps and warm meals at the passes so travelers can walk safely.',goods:{beans:36,herbs:24},supplies:{tools:10,planks:16},reward:{gold:80,knowledge:20},benefit:'Stonehaven joins the shared coastal patrol.'},
 ]},
 blackthorn:{speaker:'Nessa, the hill steward',about:'Blackthorn keeps strangers at a distance. A failed harvest explains more than its banners do.',steps:[
  {title:'An empty winter store',text:'Blackthorn needs vegetables and food to refill its winter stores.',goods:{roots:24,beans:18},supplies:{food:25},reward:{gold:30,tools:5},benefit:'Improves relations with Blackthorn and unlocks its next project.'},
  {title:'House repairs',text:'Patch the sleeping houses before the cold winds return.',goods:{wool:30,clay:24},supplies:{planks:18},reward:{iron:18,knowledge:15},benefit:'Blackthorn opens a regular exchange of supplies.'},
  {title:'The roadside wayhouse',text:'Supply tools and provisions for a wayhouse on the road between your towns.',goods:{herbs:24,berries:36},supplies:{tools:12,wood:35},reward:{gold:90,knowledge:25},benefit:'Blackthorn joins the shared coastal patrol.'},
 ]},
});
const int=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const alive=u=>!['dead','released'].includes(u.status);
const round=n=>Math.round(n*1e6)/1e6;
export const createHinterland=()=>({version:1,stock:Object.fromEntries(Object.keys(PRODUCE).map(k=>[k,0])),seeds:['roots'],gardens:{},gathered:{},projects:Object.fromEntries(Object.keys(NEIGHBOR_STORIES).map(k=>[k,{step:0,deliveries:0,readyAt:0}])),surveys:0,harvests:0,returned:0});
export const fieldGoods=bag=>Object.entries(bag||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${PRODUCE[k]?.name.toLowerCase()||k}`).join(', ');
export const regionKnown=(state,id)=>state.frontier.discoveredRegions.includes(id);
export const regionReachable=(state,id)=>regionKnown(state,id)||(REGION_LINKS[id]||[]).some(key=>regionKnown(state,key));
export const journeyFor=(state,kind,id)=>state.frontier.units.find(u=>u.kind==='ranger'&&alive(u)&&u.journey?.kind===kind&&u.journey.target===id);
export const gardenState=(state,id)=>state.hinterland?.gardens[id]||{crop:'roots',next:'roots',progress:0};
export function chooseCrop(state,id,crop){
 const b=state.buildings.find(b=>b.id===id&&b.type==='garden'&&b.status==='ready');
 if(!b||!Object.hasOwn(CROPS,crop)||!state.hinterland.seeds.includes(crop))return{ok:false,reason:'Choose a finished garden and a crop whose seeds you have learned.'};
 const bed=state.hinterland.gardens[id]||={crop:'roots',next:'roots',progress:0};bed.next=crop;if(bed.progress===0)bed.crop=crop;
 return{ok:true,reason:bed.crop===crop?`${CROPS[crop].name} selected.`:`${CROPS[crop].name} will follow the current harvest. No growing crop is lost.`};
}
export function tickGardens(state,dt){
 const h=state.hinterland;let changed=false;
 for(const b of state.buildings)if(b.type==='garden'&&b.status==='ready'){
  const bed=h.gardens[b.id]||={crop:'roots',next:'roots',progress:0},spec=CROPS[bed.crop];
  if(b.paused||!b.workerIds.length)continue;
  bed.progress=round(Math.min(spec.days*DAY,bed.progress+dt));
  if(bed.progress<spec.days*DAY)continue;
  const amount=Math.round(spec.yield*(b.level||1)*(h.projects.reedbank.step>=2?1.15:1));
  if(h.stock[bed.crop]+amount>9999)continue;
  h.stock[bed.crop]+=amount;h.harvests++;bed.progress=0;bed.crop=bed.next;changed=true;
 }
 for(const id of Object.keys(h.gardens))if(!state.buildings.some(b=>b.id===id&&b.type==='garden'))delete h.gardens[id];
 return changed;
}
export function projectSpec(state,id){
 const story=NEIGHBOR_STORIES[id],p=state.hinterland.projects[id];if(!story||!p)return null;
 if(p.step<story.steps.length)return {...story.steps[p.step],id,step:p.step,repeat:false};
 const items=id==='reedbank'?['roots','beans','berries']:id==='stonehaven'?['herbs','wool','clay']:['beans','berries','wool'];
 const good=items[p.deliveries%items.length];return{id,step:p.step,repeat:true,title:'A standing neighbor request',text:`${story.speaker.split(',')[0]} asks for ${PRODUCE[good].name.toLowerCase()} for the shared stores. There is no deadline.`,goods:{[good]:24},supplies:{},reward:{gold:35,knowledge:8},benefit:'Another request will be available in one game day.'};
}
export function journeyQuote(state,kind,id){
 const h=state.hinterland,f=state.frontier,fail=reason=>({ok:false,reason});let target,work=24,cost={food:6},spec;
 if(!h)return fail('Load the island record first.');
 if(journeyFor(state,kind,id))return fail('A resident is already making this journey.');
 if(kind==='survey'){
  target=ISLAND_REGIONS.find(r=>r.id===id);if(!target||regionKnown(state,id))return fail('This region is already charted.');
  if(!regionReachable(state,id))return fail('Chart an adjoining region to find a route here.');
 }else if(kind==='gather'){
  spec=GATHERING.find(s=>s.id===id);if(!spec||!regionKnown(state,spec.region))return fail('Scout this region before gathering here.');
  if((h.gathered[id]||0)>f.clock)return fail('Leave this place to replenish before gathering again.');
  if(h.stock[spec.good]+spec.amount>9999)return fail('Use some of this harvest before gathering more.');
  target=spec;work=spec.work*(h.projects.stonehaven.step>=2?.8:1);
 }else if(kind==='deliver'){
  target=f.neighbors.find(n=>n.id===id);spec=projectSpec(state,id);
  if(!target?.discovered)return fail('Make first contact with this settlement first.');
  if(['war','defeated'].includes(target.status))return fail('Peace is needed before shared projects can continue.');
  if(h.projects[id].readyAt>f.clock)return fail('The neighbors are using your last delivery. The next request opens after one game day.');
  if(Object.entries(spec.goods).some(([k,n])=>h.stock[k]<n))return fail(`Gather or grow ${fieldGoods(spec.goods)}.`);
  cost={food:6,...spec.supplies};cost.food=(spec.supplies.food||0)+6;work=12;
 }else return fail('Choose scouting, gathering or a neighbor delivery.');
 if(Object.entries(cost).some(([k,n])=>(state.resources[k]||0)<n))return fail('More journey provisions are needed.');
 return{ok:true,reason:'A named resident walks there and back. Rewards arrive when they return.',target:{x:target.x,z:target.z},cost,work,goods:kind==='deliver'?spec.goods:{},step:kind==='deliver'?spec.step:null};
}
export function completeJourney(state,u){
 const j=u.journey,h=state.hinterland;
 if(j.kind==='survey'){
  if(!regionKnown(state,j.target))state.frontier.discoveredRegions.push(j.target);
  h.surveys++;return `${u.name} brought home a map of ${ISLAND_REGIONS.find(r=>r.id===j.target).name}. New gathering places and routes are open.`;
 }
 if(j.kind==='gather'){
  const spec=GATHERING.find(s=>s.id===j.target);h.stock[spec.good]+=spec.amount;h.gathered[spec.id]=state.frontier.clock+spec.days*DAY;h.returned++;
  if(spec.seed&&!h.seeds.includes(spec.seed))h.seeds.push(spec.seed);
  return `${u.name} returned with ${spec.amount} ${PRODUCE[spec.good].name.toLowerCase()}${spec.seed?'; their cuttings unlock herbs for your gardens':''}.`;
 }
 const p=h.projects[j.target],spec=projectSpec(state,j.target),n=state.frontier.neighbors.find(n=>n.id===j.target);
 if(p.step!==j.step||p.deliveries!==j.delivery)return `${u.name} returned. This request was already completed.`;
 p.step=Math.min(3,p.step+1);p.deliveries++;p.readyAt=spec.repeat?state.frontier.clock+DAY:0;
 if(spec.seed&&!h.seeds.includes(spec.seed))h.seeds.push(spec.seed);
 n.relation=Math.min(100,n.relation+18);n.trades++;state.frontier.stats.trades++;
 for(const[k,v]of Object.entries(spec.reward))state.resources[k]=Math.min(state.storage?.[k]??100000,(state.resources[k]||0)+v);
 return `${u.name} returned from ${n.name}: ${spec.title} is complete. ${spec.benefit}`;
}
export const peacefulProjects=state=>Object.values(state.hinterland?.projects||{}).reduce((sum,p)=>sum+p.step,0);
export const coastalPacts=state=>Object.entries(state.hinterland?.projects||{}).filter(([id,p])=>p.step===3&&!['war','defeated'].includes(state.frontier?.neighbors.find(n=>n.id===id)?.status)).length;
export function normalizeHinterland(state,input){
 if(input===undefined){if(state.frontier.units.some(u=>u.kind==='ranger'))throw new Error('Missing journey record');state.hinterland=createHinterland();return;}
 const h=structuredClone(input),fail=()=>{throw new Error('Invalid island record');};
 if(!h||h.version!==1||!h.stock||Object.keys(h.stock).length!==Object.keys(PRODUCE).length||Object.keys(PRODUCE).some(k=>!int(h.stock[k],9999))||!Array.isArray(h.seeds)||new Set(h.seeds).size!==h.seeds.length||!h.seeds.includes('roots')||h.seeds.some(k=>!Object.hasOwn(CROPS,k)))fail();
 for(const key of ['surveys','harvests','returned'])if(!int(h[key]))fail();
 for(const key of ['gardens','gathered','projects'])if(!h[key]||typeof h[key]!=='object'||Array.isArray(h[key]))fail();
 for(const[id,b]of Object.entries(h.gardens)){if(!state.buildings.some(b=>b.id===id&&b.type==='garden')){delete h.gardens[id];continue;}if(!b||!h.seeds.includes(b.crop)||!h.seeds.includes(b.next)||!Number.isFinite(b.progress)||b.progress<0||b.progress>CROPS[b.crop].days*DAY)fail();}
 for(const[id,time]of Object.entries(h.gathered))if(!GATHERING.some(s=>s.id===id)||!Number.isFinite(time)||time<0||time>state.frontier.clock+2*DAY)fail();
 if(Object.keys(h.projects).length!==3)fail();for(const id of Object.keys(NEIGHBOR_STORIES)){const p=h.projects[id];if(!p||!int(p.step,3)||!int(p.deliveries)||p.deliveries<p.step||!Number.isFinite(p.readyAt)||p.readyAt<0||p.readyAt>state.frontier.clock+DAY)fail();}
 state.hinterland=h;
 const missions=new Set();for(const u of state.frontier.units.filter(u=>u.kind==='ranger')){
  const j=u.journey;if(!u.citizenId||u.faction!=='player'||!j||!['survey','gather','deliver'].includes(j.kind)||!['outbound','working','returning'].includes(u.missionStage)||typeof u.missionComplete!=='boolean'||!['journey','retreat'].includes(u.order.type)||!Number.isFinite(j.progress)||j.progress<0||!Number.isFinite(j.work)||j.work<1||j.work>60||j.progress>j.work)fail();
  const known=j.kind==='survey'?ISLAND_REGIONS.some(r=>r.id===j.target):j.kind==='gather'?GATHERING.some(s=>s.id===j.target):Object.hasOwn(NEIGHBOR_STORIES,j.target);if(!known)fail();
  const work=j.kind==='survey'?24:j.kind==='deliver'?12:GATHERING.find(s=>s.id===j.target).work;if(j.work!==work&&!(j.kind==='gather'&&j.work===work*.8))fail();
  if(j.kind==='deliver'&&(!int(j.step,3)||!int(j.delivery)))fail();
  if(j.kind!=='deliver'&&(j.step!==null||j.delivery!==0))fail();
  if(u.waitingForStores!==undefined&&typeof u.waitingForStores!=='boolean')fail();
  if(u.missionComplete&&(u.missionStage!=='returning'||j.progress!==j.work))fail();
  const key=`${j.kind}:${j.target}`;if(alive(u)){if(missions.has(key))fail();missions.add(key);if(j.kind==='deliver'&&(j.step!==h.projects[j.target].step||j.delivery!==h.projects[j.target].deliveries))fail();}
 }
}
