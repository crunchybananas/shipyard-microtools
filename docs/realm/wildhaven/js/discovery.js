/** Original places and durable fieldwork. No renderer, timers, or random rewards. */
export const DISCOVERIES = Object.freeze([
  { id:'waystone', name:'The mason’s waystone', region:'Hearthvale', x:4,z:-4, mark:'I', tint:'#b98248',
    rumor:'There are measuring marks beneath the lichen. Someone built here long before us.',
    story:'The scratches are a mason’s lesson: a square, a plumb line, and the same cottage drawn three ways. The smallest drawing has the strongest roof. A town does not need to be grand to be well made.',
    restoration:'Set the stone upright', benefit:'Builders complete town projects 10% faster.', cost:{wood:12,stone:18}, work:38, salvage:{stone:24,gold:8},
    note:'The old measurements are copied into every builder’s notebook.', types:[], construction:.10 },
  { id:'spring', name:'The foxglove spring', region:'Pineward', x:-14,z:-9, mark:'II', tint:'#578f83',
    rumor:'A ribbon of clear water disappears under roots. The birds always stop here.',
    story:'Behind the roots is a little stone basin, worn smooth by hands. Mint grows where the water escapes. Someone once left a cup for the next traveler. The cup is still there.',
    restoration:'Mend the springhouse', benefit:'Gardens and orchards produce 15% more food.', cost:{wood:22,stone:14}, work:48, salvage:{food:42},
    note:'Cuttings from the spring thrive in the village’s gardens.', types:['garden','orchard'], production:.15 },
  { id:'kiln', name:'The sleeping kiln', region:'Highmeadow', x:-11,z:-18, mark:'III', tint:'#bb7454',
    rumor:'A round chimney leans into the hill. Its bricks are still warm in the afternoon sun.',
    story:'Inside the kiln are clay test pieces: a roof tile, a cup, and one very unsuccessful duck. On the wall, a potter recorded the firing temperatures. The useful thing is not the kiln. It is the patient record of trying again.',
    restoration:'Fire the kiln again', benefit:'Quarries, smithies and toolmakers produce 12% more.', cost:{wood:26,stone:28,planks:6}, work:65, salvage:{stone:30,iron:8,tools:4},
    note:'The potter’s firing notes are shared with the town’s craftspeople.', types:['quarry','smith','toolmaker'], production:.12 },
  { id:'stars', name:'The star garden', region:'Crownhill trail', x:4,z:-23, mark:'IV', tint:'#7a829b',
    rumor:'A brass ring catches the light above the eastern trees. It points at nothing on the ground.',
    story:'The ring is a map of the night sky. Four names are scratched around its rim, followed by “we waited for the clouds.” In the little garden below, each stone marks the first day of a season. This was a place to notice time together.',
    restoration:'Raise the sky ring', benefit:'Schools produce 20% more lore.', cost:{wood:18,stone:24,iron:6,gold:20}, work:75, salvage:{knowledge:22,gold:35},
    note:'At dusk, residents learn the names of the stars from the restored ring.', types:['school'], production:.20 },
]);
export const discoverySpec=id=>DISCOVERIES.find(s=>s.id===id);
export const isFieldworker=u=>['explorer','restorer'].includes(u.kind);
export function createDiscoveryState(){return {version:1,sites:DISCOVERIES.map(d=>({id:d.id,status:'rumor',surveyProgress:0,project:null,progress:0,reportedBy:null,reportedDay:null,finishedBy:null,finishedDay:null,received:{}}))};}
export function discoveryModifier(state,type,kind='production'){
  let bonus=0;for(const site of state.discovery?.sites||[]){if(site.status!=='restored')continue;const spec=discoverySpec(site.id);if(kind==='construction')bonus+=spec.construction||0;else if(spec.types.includes(type))bonus+=spec.production||0;}return 1+bonus;
}
export const fieldworkDuration=(site,mode)=>mode==='survey'?22:mode==='salvage'?25:discoverySpec(site.id).work;
export function fieldworkerFor(state,id){return state.frontier?.units.find(u=>isFieldworker(u)&&u.missionSiteId===id&&!['dead','released'].includes(u.status));}
export function normalizeDiscovery(state){
  const fail=()=>{throw new Error('Invalid fieldbook save');},d=state.discovery;
  if(!d||d.version!==1||!Array.isArray(d.sites)||d.sites.length!==DISCOVERIES.length)fail();
  const seen=new Set();for(const s of d.sites){const spec=discoverySpec(s?.id);if(!spec||seen.has(s.id)||!['rumor','surveyed','restored','salvaged'].includes(s.status)||![null,'restore','salvage'].includes(s.project))fail();seen.add(s.id);
    if(!Number.isFinite(s.surveyProgress)||s.surveyProgress<0||s.surveyProgress>22||!Number.isFinite(s.progress)||s.progress<0||s.progress>(s.project==='restore'?spec.work:s.project==='salvage'?25:0))fail();
    for(const [name,day] of [['reportedBy','reportedDay'],['finishedBy','finishedDay']])if(s[name]!==null&&(typeof s[name]!=='string'||!s[name].trim()||s[name].length>60||/[<>\x00-\x1f]/.test(s[name])||!Number.isInteger(s[day])||s[day]<1||s[day]>state.day)||s[name]===null&&s[day]!==null)fail();
    if(s.status==='rumor'?(s.reportedBy!==null||s.project!==null):(s.surveyProgress!==22||s.reportedBy===null))fail();
    const complete=['restored','salvaged'].includes(s.status);if(complete?(s.project!==(s.status==='restored'?'restore':'salvage')||s.progress!==fieldworkDuration(s,s.project)||s.finishedBy===null):s.finishedBy!==null)fail();
    if(!s.received||Array.isArray(s.received)||typeof s.received!=='object'||Object.entries(s.received).some(([r,n])=>!Object.hasOwn(spec.salvage,r)||!Number.isFinite(n)||n<0||n>spec.salvage[r])||(s.status!=='salvaged'&&Object.keys(s.received).length))fail();
  }
  const assigned=new Set();for(const u of state.frontier.units.filter(isFieldworker)){
    const site=d.sites.find(s=>s.id===u.missionSiteId);if(!site||u.faction!=='player'||!u.citizenId||!['survey','restore','salvage'].includes(u.missionMode)||!['outbound','working','returning'].includes(u.missionStage)||typeof u.missionComplete!=='boolean'||!['fieldwork','retreat'].includes(u.order.type))fail();
    if(u.fieldBlocked!==undefined&&typeof u.fieldBlocked!=='boolean')fail();
    if(['dead','released'].includes(u.status))continue;
    if(assigned.has(site.id)||['restored','salvaged'].includes(site.status)||u.missionMode==='survey'&&site.status!=='rumor'||u.missionMode!=='survey'&&(site.status!=='surveyed'||site.project!==u.missionMode)||u.kind!==(u.missionMode==='survey'?'explorer':'restorer'))fail();assigned.add(site.id);
    if(u.missionComplete&&(u.missionStage!=='returning'||(u.missionMode==='survey'?site.surveyProgress:site.progress)!==fieldworkDuration(site,u.missionMode)))fail();
  }
  return d;
}
