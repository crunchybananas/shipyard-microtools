import { DISCOVERIES, discoverySpec, fieldworkerFor, fieldworkDuration } from './discovery.js';
import { fieldworkOffer, sendFieldworker, recallFieldworker } from './frontier.js';
import { JOBS } from './catalog.js';
import { resourceText } from './town-ui.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,id,run,cls='')=>{const b=el('button',cls,text);b.dataset.fieldAction=id;b.onclick=run;return b;};
export function createFieldbook({getState,getContext,getIcons,mutate,beforeOpen,focus}){
  const panel=el('aside');panel.id='fieldbook';panel.hidden=true;panel.setAttribute('aria-label','Island fieldbook');
  const head=el('div','field-heading'),title=el('div');title.append(el('small','','A record of this place'),el('h2','','Island fieldbook'));
  head.append(title,button('×','close',()=>close(),'field-close'));head.lastChild.setAttribute('aria-label','Close fieldbook');
  const tabs=el('nav','field-tabs');tabs.setAttribute('aria-label','Places in the fieldbook');
  const content=el('div','field-content');content.tabIndex=0;panel.append(head,tabs,content);document.getElementById('hud').append(panel);
  const toggle=button('Fieldbook','toggle',()=>panel.hidden?open():close());toggle.id='fieldbook-toggle';toggle.setAttribute('aria-controls','fieldbook');toggle.title='Island fieldbook (B)';document.querySelector('.controls-hint>div').append(toggle);
  let active='waystone',signature='',resident='',previousFocus=null;
  function close(){document.body.classList.remove('fieldbook-active');panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(panel.contains(document.activeElement))previousFocus?.focus();}
  function open(id=active){beforeOpen();document.body.classList.add('fieldbook-active');previousFocus=document.activeElement;active=discoverySpec(id)?id:active;panel.hidden=false;toggle.setAttribute('aria-expanded','true');signature='';update();panel.querySelector(`[data-field-action="place-${active}"]`)?.focus({preventScroll:true});}
  function action(mode){const result=sendFieldworker(getState(),active,mode,resident||null,getContext());mutate(result,'depart');signature='';update();}
  function update(){
    const state=getState(),done=state.discovery.sites.filter(s=>s.status==='restored'||s.status==='salvaged').length,busy=state.frontier.units.filter(u=>u.missionSiteId&&!['released','dead'].includes(u.status)).length;
    toggle.textContent=busy?`Fieldbook · ${busy} away`:done?`Fieldbook · ${done}/4`:'Fieldbook';
    if(panel.hidden)return;
    const site=state.discovery.sites.find(s=>s.id===active),spec=discoverySpec(active),worker=fieldworkerFor(state,active);
    const next=JSON.stringify([active,site,worker&&[worker.id,worker.missionStage,worker.status,worker.missionComplete,worker.path.length===0,worker.fieldBlocked],Object.values(state.resources).map(Math.floor),state.citizens.map(c=>[c.id,c.job]),busy]);
    if(next===signature||document.activeElement?.tagName==='SELECT'&&panel.contains(document.activeElement))return;signature=next;
    const scroll=content.scrollTop,focused=document.activeElement?.dataset?.fieldAction;
    tabs.replaceChildren(...DISCOVERIES.map(d=>{const s=state.discovery.sites.find(s=>s.id===d.id),b=button(d.mark,`place-${d.id}`,()=>{active=d.id;signature='';content.scrollTop=0;update();});b.setAttribute('aria-label',d.name);b.setAttribute('aria-pressed',String(active===d.id));b.title=d.name;b.classList.toggle('field-finished',['restored','salvaged'].includes(s.status));return b;}));
    content.replaceChildren();const illustration=el('div','field-illustration'),img=el('img');img.src=getIcons()['discovery_'+active+(site.status==='restored'?'_restored':'')];img.alt='';illustration.style.setProperty('--place-ink',spec.tint);illustration.append(el('span','field-plate',spec.mark),img,el('span','field-region',spec.region));
    const title=el('h3','',spec.name);content.append(illustration,title,el('p','field-story',site.status==='rumor'?spec.rumor:spec.story));
    content.append(button('Find this place ↗','find',()=>{close();focus(spec);},'field-link'));
    if(site.reportedBy)content.append(el('p','field-byline',`Recorded by ${site.reportedBy} · Day ${site.reportedDay}`));
    if(worker){
      const card=el('section','field-assignment'),phase=worker.status==='wounded'?(Math.hypot(worker.x,worker.z-3)<1.5?'Recovering at home':'Wounded · making for home'):worker.fieldBlocked?'Route blocked · check gates and the approach':worker.missionStage==='outbound'?'Walking to the site':worker.missionStage==='working'?(worker.missionMode==='survey'?'Reading the place':worker.missionMode==='restore'?'Restoring the place':'Gathering the materials'):worker.missionComplete?'Bringing the findings home':'Returning home';
      card.append(el('small','','In the field'),el('h4','',`${worker.name} · ${JOBS[worker.kind].name}`),el('p','',phase));
      const progress=worker.missionMode==='survey'?site.surveyProgress:site.progress,total=fieldworkDuration(site,worker.missionMode),bar=el('progress');bar.max=total;bar.value=progress;bar.setAttribute('aria-label','Work at the site');card.append(bar,el('small','',`${Math.floor(progress)} / ${total} seconds of site work`));
      card.append(button('Follow this resident ↗','follow',()=>{close();focus(worker);},'field-link'));
      if(worker.missionStage!=='returning')card.append(button('Call them home','recall',()=>{mutate(recallFieldworker(getState(),worker.id),'depart');signature='';update();}));
      card.append(el('p','field-fine','Their village job is reserved while they travel. Reports and recovered goods arrive at the hearth.'));content.append(card);
    }else if(['restored','salvaged'].includes(site.status)){
      const result=el('section','field-keepsake');result.append(el('small','',site.status==='restored'?'A place in village life':'Recovered for the village'),el('h4','',site.status==='restored'?spec.benefit:resourceText(site.received)),el('p','',site.status==='restored'?spec.note:'The useful materials have found another life. This place’s story remains in the fieldbook.'),el('small','',`${site.finishedBy} · Day ${site.finishedDay}`));content.append(result);
    }else{
      const mode=site.status==='rumor'?'survey':site.project||'restore',offer=fieldworkOffer(state,active,mode,getContext());
      const label=el('label','field-resident','Send a resident'),select=el('select');select.dataset.fieldAction='resident';select.setAttribute('aria-label','Resident for fieldwork');
      if(!offer.availableCitizens?.some(c=>c.id===resident))resident='';
      const automatic=el('option','','Choose an available resident');automatic.value='';select.append(automatic);
      for(const c of offer.availableCitizens||[]){const option=el('option','',`${c.name} · ${JOBS[c.job]?.name||'Available'}`);option.value=c.id;select.append(option);}select.value=resident;select.onchange=()=>{resident=select.value;};label.append(select);content.append(label);
      if(site.status==='rumor'){
        content.append(el('p','field-fine','A short expedition: walk there, study for 22 seconds, then return. Costs 6 food for provisions.'));
        const go=button('Send a surveyor','survey',()=>action('survey'),'primary');go.disabled=!offer.ok;content.append(go,el('p','field-reason',offer.reason));
      }else{
        for(const choice of ['restore','salvage']){
          if(site.project&&site.project!==choice)continue;
          const q=fieldworkOffer(state,active,choice,getContext()),card=el('section','field-choice');
          card.append(el('h4','',choice==='restore'?spec.restoration:'Give the materials another life'),el('p','',choice==='restore'?spec.benefit:`Recover up to ${resourceText(spec.salvage)}. This replaces the restoration benefit.`),el('small','',site.project?`${Math.floor(site.progress)} / ${q.duration} seconds completed · materials paid`:choice==='restore'?`${resourceText(q.cost)} · ${q.duration} seconds of site work`:`No extra supplies · ${q.duration} seconds of site work`));
          const go=button(site.project?'Resume the work':choice==='restore'?'Commission restoration':'Commission salvage',choice,()=>action(choice),choice==='restore'?'primary':'');go.disabled=!q.ok;card.append(go,el('p','field-reason',q.reason));content.append(card);
        }
        if(!site.project)content.append(el('p','field-fine','Choose one future for this place. Commissioning commits the project; recalling a worker keeps its progress and paid materials.'));
      }
    }
    content.scrollTop=scroll;if(focused)panel.querySelector(`[data-field-action="${focused}"]`)?.focus({preventScroll:true});
  }
  return {open,close,update,get active(){return !panel.hidden;}};
}
