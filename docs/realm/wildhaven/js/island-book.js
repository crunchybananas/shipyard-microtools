import { ISLAND_BOUNDS, ISLAND_REGIONS, regionAt, listTiles } from './island.js';
import { CALENDAR_DAY_SECONDS as DAY, duration } from './calendar.js';
import { CROPS, PRODUCE, GATHERING, NEIGHBOR_STORIES, REGION_LINKS, regionKnown, regionReachable, gardenState, chooseCrop, projectSpec, journeyFor, fieldGoods, peacefulProjects, coastalPacts } from './hinterland.js';
import { sendJourney, journeyOptions, recallJourney } from './frontier.js';
import { cargoExposure, cargoThreshold } from './pressure.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function button(label,id,run,disabled=false){const b=el('button','',label);b.dataset.frontierAction=id;b.onclick=run;b.disabled=disabled;return b;}
const goods=bag=>Object.entries(bag||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${k==='gold'?'coin':k==='wood'?'timber':k}`).join(', ');
function note(text){return el('p','island-note',text);}
function section(title,text){const n=el('section','island-section');n.append(el('h3','',title));if(text)n.append(el('p','',text));return n;}
function missionCard(state,u,{action,focus}){
 const j=u.journey,title=j.kind==='survey'?ISLAND_REGIONS.find(r=>r.id===j.target)?.name:j.kind==='gather'?GATHERING.find(s=>s.id===j.target)?.name:state.frontier.neighbors.find(n=>n.id===j.target)?.name;
 const phase=u.status==='wounded'?'Recovering after danger':u.waitingForStores?'Home with cargo. Use some gathering stores to make room.':u.fieldBlocked?'Route blocked; check gates':u.missionStage==='working'?'Working at the destination':u.missionStage==='outbound'?'Walking out':u.missionComplete?'Bringing the findings home':'Returning home';
 const card=section(`${u.name} · ${title}`,phase),p=el('progress');p.max=j.work;p.value=j.progress;p.setAttribute('aria-label',`${u.name}: work at the destination`);card.append(p);
 const controls=el('div','island-actions');controls.append(button('Find resident',`journey-find-${u.id}`,()=>focus(u)));
 if(u.missionStage!=='returning')controls.append(button('Call home',`journey-recall-${u.id}`,()=>action(()=>recallJourney(state,u.id))));card.append(controls);return card;
}
function sendControl(state,kind,id,label,ctx){
 const q=journeyOptions(state,kind,id,ctx.getContext()),wrap=el('div','island-send');
 wrap.append(button(label,`${kind}-${id}`,()=>ctx.action(()=>sendJourney(state,kind,id,ctx.getContext())),!q.ok),note(q.ok?`Provisions: ${goods(q.cost)}. A resident walks there and back.`:q.reason));return wrap;
}
export function mapFigure(){const f=el('figure','island-map-wrap'),c=el('canvas','island-map');c.setAttribute('role','img');c.setAttribute('aria-label','Island map. Surveyed regions are colored; uncharted regions are covered. Choose a region below to scout.');f.append(c,el('figcaption','','Your maps grow when explorers return. Pale routes lead into uncharted land.'));return f;}
const tiles=listTiles();
export function paintIslandMap(canvas,state){
 if(!canvas)return;const w=canvas.clientWidth||500,h=canvas.clientHeight||290,dpr=Math.min(2,globalThis.devicePixelRatio||1);canvas.width=w*dpr;canvas.height=h*dpr;
 const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#183e48';c.fillRect(0,0,w,h);
 const scale=Math.min((w-32)/(ISLAND_BOUNDS.maxX-ISLAND_BOUNDS.minX),(h-26)/(ISLAND_BOUNDS.maxZ-ISLAND_BOUNDS.minZ)),x0=w/2,z0=13-ISLAND_BOUNDS.minZ*scale;
 const at=(x,z)=>[x0+x*scale,z0+z*scale];
 c.strokeStyle='#35606a';c.lineWidth=.5;for(let x=20;x<w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=16;y<h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 for(const t of tiles){if(t.kind==='water'||!regionKnown(state,t.regionId))continue;const [x,z]=at(t.x,t.z);c.fillStyle=t.kind==='forest'?'#73907a':t.kind==='rock'?'#adac93':state.frontier.claims.includes(t.regionId)?'#c4c693':'#a3b789';c.fillRect(x-scale/2,z-scale/2,scale+1,scale+1);}
 for(const region of ISLAND_REGIONS){if(!regionReachable(state,region.id))continue;
  for(const id of REGION_LINKS[region.id]||[]){if(!regionKnown(state,region.id)||!regionReachable(state,id))continue;const dest=ISLAND_REGIONS.find(r=>r.id===id),a=at(region.x,region.z),b=at(dest.x,dest.z);c.strokeStyle='#dddbc099';c.setLineDash([3,5]);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}
 }
 c.setLineDash([]);c.textAlign='center';c.font='600 11px system-ui';
 for(const r of ISLAND_REGIONS){if(!regionReachable(state,r.id))continue;const [x,z]=at(r.x,r.z),known=regionKnown(state,r.id);c.fillStyle=known?'#244d43':'#e3dfbd';c.beginPath();c.arc(x,z,known?3:8,0,Math.PI*2);c.fill();if(!known){c.fillStyle='#244b51';c.fillText('?',x,z+4);}c.fillStyle=known?'#153d34':'#dddcc4';c.fillText(r.name,x,z+18);}
 for(const n of state.frontier.neighbors){if(!n.discovered||!regionKnown(state,regionAt(n.x,n.z)?.id))continue;const[x,z]=at(n.x,n.z);c.fillStyle=n.status==='war'?'#be7159':'#f1cc86';c.fillRect(x-3,z-3,6,6);}
 c.textAlign='left';c.fillStyle='#d0dccc';c.font='12px Georgia';c.fillText('N ↑',12,20);
}
export function explorationContent(state,ctx,chosen='home'){
 const nodes=[mapFigure()],h=state.hinterland;
 const header=section('The wider island',`${state.frontier.discoveredRegions.length} of ${ISLAND_REGIONS.length} regions charted. ${peacefulProjects(state)} of 9 shared projects completed.`);
 header.append(note('Scout with an available resident, gather local produce, and bring it to your neighbors. Every journey reserves that resident until they return.'));
 const regions=el('div','island-regions');regions.setAttribute('aria-label','Choose a region');
 for(const r of ISLAND_REGIONS){const known=regionKnown(state,r.id),reachable=regionReachable(state,r.id),b=button(reachable?r.name:'Uncharted reach',`region-${r.id}`,()=>ctx.selectRegion(r.id),!reachable);b.setAttribute('aria-pressed',String(r.id===chosen));b.dataset.known=String(known);regions.append(b);}header.append(regions);nodes.push(header);
 const region=ISLAND_REGIONS.find(r=>r.id===chosen)||ISLAND_REGIONS[0];
 if(regionReachable(state,region.id)){
  const known=regionKnown(state,region.id),card=section(region.name,known?'The routes are in your field maps. Gather without claiming this land; an outpost is needed only for new buildings.':'Beyond the last familiar path. Send someone to chart the routes and bring home a report.');
  if(!known&&!journeyFor(state,'survey',region.id))card.append(sendControl(state,'survey',region.id,'Send a scout',ctx));
  if(known)card.append(button('Look at this region',`look-region-${region.id}`,()=>ctx.focus({...region,kind:'region'})));
  for(const site of GATHERING.filter(s=>known&&s.region===region.id)){
   const patch=el('div','island-patch');patch.append(el('h4','',site.name),el('p','',site.story),note(`Bring home ${site.amount} ${PRODUCE[site.good].name.toLowerCase()}. Replenishes in ${site.days} game ${site.days===1?'day':'days'} after each trip.`));
   if((h.gathered[site.id]||0)>state.frontier.clock)patch.append(note(`Ready again in ${duration(h.gathered[site.id]-state.frontier.clock)} at 1×.`));
   if(!journeyFor(state,'gather',site.id))patch.append(sendControl(state,'gather',site.id,'Send a gatherer',ctx));card.append(patch);
  }
  if(known&&!GATHERING.some(s=>s.region===region.id))card.append(note(region.id==='home'?'Plant a kitchen garden for carrots. Meet Reedbank to exchange your first harvest.':'This region opens routes toward the outer gathering grounds.'));
  nodes.push(card);
 }
 const away=state.frontier.units.filter(u=>u.kind==='ranger'&&!['dead','released'].includes(u.status));if(away.length){nodes.push(el('h3','island-subtitle','People on the paths'));for(const u of away)nodes.push(missionCard(state,u,ctx));}
 const peace=section('Why trouble reaches the shore',`Neighbor armies march only after war is declared. Peaceful scouting and elapsed days never schedule an invasion.`);
 const pacts=coastalPacts(state);peace.append(note(pacts===3?'All three shared patrols are established. New cargo demands are prevented while these neighbors remain at peace.':`${cargoExposure(state)} / ${cargoThreshold(state)} exposed export orders and voyages. Reaching this threshold can attract a cargo demand. Complete neighbor projects to raise it; three peaceful coastal pacts protect future trade.`));nodes.push(peace);return nodes;
}
export function gardensContent(state,ctx){
 const h=state.hinterland,stocks=section('The gathering stores','Named crops and gathered goods are saved here for neighbor projects. Everyday food stays in the village pantry.'),rack=el('dl','island-stock');
 for(const[k,v]of Object.entries(PRODUCE)){const cell=el('div');cell.style.setProperty('--produce-color',v.color);cell.append(el('dt','',v.name),el('dd','',String(h.stock[k])));rack.append(cell);}stocks.append(rack);
 const nodes=[stocks],gardens=state.buildings.filter(b=>b.type==='garden'&&b.status==='ready');
 if(!gardens.length)nodes.push(note('Build a kitchen garden from the building shelf to start a carrot harvest.'));
 for(const b of gardens){const bed=gardenState(state,b.id),spec=CROPS[bed.crop],card=section(`Kitchen garden · ${b.x}, ${b.z}`,`${spec.name}: ${Math.floor(bed.progress/(spec.days*DAY)*100)}% grown. ${spec.days} game ${spec.days===1?'day':'days'} with a gardener.`);
 const bar=el('progress');bar.max=spec.days*DAY;bar.value=bed.progress;bar.setAttribute('aria-label',`${spec.name} growth`);card.append(bar,note(b.paused?'This workplace is resting. Resume it to grow crops.':!b.workerIds.length?'Assign a gardener in Town → People to grow this crop.':`A harvest brings ${Math.round(spec.yield*(b.level||1)*(h.projects.reedbank.step>=2?1.15:1))} ${PRODUCE[bed.crop].name.toLowerCase()}.`));
 const choices=el('div','island-actions');for(const[k,crop]of Object.entries(CROPS)){const learned=h.seeds.includes(k),btt=button(crop.name,`crop-${b.id}-${k}`,()=>ctx.action(()=>chooseCrop(state,b.id,k)),!learned);btt.setAttribute('aria-pressed',String(bed.next===k));choices.append(btt);}card.append(choices,note(bed.next!==bed.crop?`Next harvest: ${CROPS[bed.next].name}. The current crop finishes first.`:'Choose what grows after this harvest. Changing a crop keeps its current progress.'),button('Find garden',`garden-find-${b.id}`,()=>ctx.focus(b)));nodes.push(card);}
 if(!h.seeds.includes('beans'))nodes.push(note('Bean seeds: finish Reedbank’s first shared project.'));
 if(!h.seeds.includes('herbs'))nodes.push(note('Herb cuttings: scout Mistfen, then bring home a gathering trip from its herb banks.'));return nodes;
}
export function neighborProjectCard(state,id,ctx){
 const story=NEIGHBOR_STORIES[id],p=state.hinterland.projects[id],n=state.frontier.neighbors.find(n=>n.id===id),spec=projectSpec(state,id);
 const card=section(story.speaker,story.about);card.classList.add('neighbor-story');
 if(!n.discovered){card.append(note('First contact reveals their requests. An envoy costs 8 food and 15 coin.'));return card;}
 card.append(el('h4','',spec.title),el('p','',spec.text),note(`${p.step}/3 shared projects · ${p.deliveries} deliveries. No deadline.`));
 const list=el('ul','neighbor-needs');for(const[k,amount]of Object.entries(spec.goods)){const have=state.hinterland.stock[k],li=el('li','',`${PRODUCE[k].name}: ${have} / ${amount}`);li.dataset.ready=String(have>=amount);list.append(li);}for(const[k,amount]of Object.entries(spec.supplies)){const li=el('li','',`${k==='wood'?'Timber':k==='gold'?'Coin':k}: ${Math.floor(state.resources[k]||0)} / ${amount}`);li.dataset.ready=String(state.resources[k]>=amount);list.append(li);}card.append(list,note(`Their thanks: ${goods(spec.reward)}. ${spec.benefit}`));
 const mission=journeyFor(state,'deliver',id);if(mission)card.append(missionCard(state,mission,ctx));else card.append(sendControl(state,'deliver',id,'Send the delivery',ctx));
 return card;
}
