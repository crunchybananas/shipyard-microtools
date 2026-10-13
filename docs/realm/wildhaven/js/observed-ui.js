import { ObservedView } from './observed-view.js';
import { isPresent } from './observed-state.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const button=(text,run)=>{const b=el('button','',text);b.type='button';b.onclick=run;return b;};
export function createObservedUI({network,beforeOpen,openAccount,cloneModel}) {
  const panel=el('section','observed-panel');panel.id='observed-panel';panel.hidden=true;panel.setAttribute('aria-label','Shared world');
  const header=el('div','observed-heading'),title=el('h2','','World'),status=el('p','observed-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const closeButton=button('Return to town',close);header.append(title,status,closeButton);
  const layout=el('div','observed-layout'),mapArea=el('div','observed-map'),canvas=el('canvas'),hint=el('p','observed-map-hint','Shared wilderness surrounds each town. Town borders stay visible when their owners leave.');
  canvas.setAttribute('aria-label','Shared wilderness and town borders. Select a town from the list to send your scout.');canvas.tabIndex=0;
  const zoom=el('div','observed-zoom');zoom.append(button('Zoom in',()=>viewer?.setZoom(.8)),button('Zoom out',()=>viewer?.setZoom(1.25)));mapArea.append(canvas,hint,zoom);const sidebar=el('div','observed-sidebar');layout.append(mapArea,sidebar);panel.append(header,layout);document.getElementById('hud').append(panel);
  const toggle=button('World',()=>panel.hidden?open():close());toggle.id='observed-toggle';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');document.querySelector('.controls-hint>div').append(toggle);
  let viewer=null,lastLayout='',lastList='',priorFocus=null,last=performance.now(),values={name:'',invitation:new URLSearchParams(location.hash.slice(1)).get('world')||''},controls,list,visitStatus,visitActions;
  function field(label,key){const wrap=el('label','observed-field',label),input=el('input');input.value=values[key];input.maxLength=key==='name'?40:1000;input.autocomplete='off';input.spellcheck=false;input.oninput=()=>values[key]=input.value;wrap.append(input);return{wrap,input};}
  function renderSetup(info){
    if(!info.user){sidebar.append(el('h3','','Settle near your friends'),el('p','','Your town stays on this device. Scouts can visit while you are online; when you leave, only the border remains.'),button('Sign in to play together',()=>{close();openAccount();}));return;}
    if(info.link&&info.user.uid!==info.link.uid){sidebar.append(el('h3','','Sign in with this town’s account'),el('p','','This town belongs to another account. Sign in with the account that placed it in this world.'),button('Open account',()=>{close();openAccount();}));return;}
    if(info.link){sidebar.append(el('h3','','Finish joining'),el('p','','Your place is reserved locally. Reconnect to confirm the world record.'),button('Reconnect',()=>network.connect()));return;}
    sidebar.append(el('h3','','A place for your town'),el('p','','Start a world and invite friends, or settle near the town that invited you. Each town keeps its own land and trees.'));
    const form=el('form','observed-form'),name=field('Your town’s name','name'),invitation=field('World invitation link or code','invitation');name.input.required=true;
    const actions=el('div','observed-actions');for(const[text,value]of[['Start a world','create'],['Join world','join']]){const b=el('button',value==='create'?'primary':'',text);b.type='submit';b.value=value;b.disabled=info.busy;actions.append(b);}
    form.append(name.wrap,invitation.wrap,actions);form.onsubmit=async e=>{e.preventDefault();if(e.submitter?.value==='join'&&!invitation.input.value.trim()){invitation.input.setCustomValidity('Paste a world invitation first.');invitation.input.reportValidity();invitation.input.setCustomValidity('');return;}await network.begin(name.input.value,e.submitter?.value==='join'?invitation.input.value:'');update();};sidebar.append(form);
    sidebar.append(el('p','observed-note','World invitations are private links. Anyone you share one with can settle here. Your buildings, trees, people, and supplies are never uploaded to the world directory.'));
  }
  function renderWorld(info){
    const name=el('h3','',info.link.name);controls=el('div','observed-actions');const connect=button(info.online?'Go offline':'Open town to scouts',()=>info.online?network.disconnect():network.connect());connect.disabled=info.busy;controls.append(connect,button('Refresh map',()=>network.refresh()));sidebar.append(name,controls);
    const details=el('details','observed-invite'),summary=el('summary','','Invite a neighbor'),label=el('label','observed-field','World invitation'),input=el('input');input.readOnly=true;const url=new URL(location.href);url.search='';url.hash=new URLSearchParams({world:`${info.link.worldId}.${info.link.gx}.${info.link.gz}`});input.value=url.href;input.setAttribute('aria-label','World invitation link');label.append(input);details.append(summary,label,button('Copy world invitation',async()=>{try{await navigator.clipboard.writeText(input.value);status.textContent='World invitation copied.';}catch{input.select();status.textContent='Select and copy the world invitation.';}}));sidebar.append(details);
    const heading=el('h3','','Nearby towns');list=el('div','observed-town-list');list.setAttribute('aria-label','Nearby towns');sidebar.append(heading,list);
    const navigation=el('div','observed-navigation');for(const[text,x,z]of[['West',-4,0],['North',0,-4],['South',0,4],['East',4,0]])navigation.append(button(text,()=>{network.recall();network.pan(x,z);}));sidebar.append(navigation);
    visitStatus=el('p','observed-visit-status');visitStatus.setAttribute('role','status');visitActions=el('div','observed-actions');sidebar.append(visitStatus,visitActions);
    sidebar.append(el('p','observed-note','One scout, one view. Inside a town, tap the ground or use the scout controls to explore. Your home town stays yours; a visit cannot change it.'));
  }
  function update(){
    const info=network.info();if(panel.hidden)return;
    status.textContent=info.busy?'Connecting…':info.message||(info.visit?.phase==='observing'?`Visiting ${info.visit.target.name}`:'')||(info.online?'Your town is open to scouts.':'Your town is offline.');
    const linked=info.link?.phase==='ready'&&info.user?.uid===info.link.uid;
    const signature=JSON.stringify([info.user?.uid,info.link?.phase,info.online,info.busy]);if(signature!==lastLayout){lastLayout=signature;lastList='';sidebar.replaceChildren();list=null;if(linked)renderWorld(info);else renderSetup(info);}
    if(list&&linked){
      const c=info.center||info.link,nearby=info.claims.filter(t=>Math.abs(t.gx-c.gx)<=3&&Math.abs(t.gz-c.gz)<=3).sort((a,b)=>Math.hypot(a.gx-c.gx,a.gz-c.gz)-Math.hypot(b.gx-c.gx,b.gz-c.gz));
      const listKey=JSON.stringify(nearby.map(t=>[t.uid,t.name,isPresent(info.presences.get(t.uid)),t.uid===info.visit?.target.uid,info.notes[t.uid]?.seenAt]));
      if(listKey!==lastList){lastList=listKey;list.replaceChildren();for(const t of nearby){const row=el('div','observed-town'),mine=t.uid===info.user.uid,present=isPresent(info.presences.get(t.uid));row.append(el('strong','',t.name),el('small','',mine?'Your town':info.presences.has(t.uid)?(present?'Contact established':'Offline · border only'):'Send a scout to make contact'));
        if(!mine&&info.notes[t.uid]){const n=info.notes[t.uid];row.append(el('small','',`Last visited ${new Date(n.seenAt).toLocaleDateString()} · ${n.buildings} buildings seen`));}
        if(!mine){const b=button(`Send scout to ${t.name}`,()=>network.scout(t.uid));b.disabled=!info.online;row.append(b);}list.append(row);}if(!nearby.length)list.append(el('p','','No towns in this area.'));
      }
      const v=info.visit;visitStatus.textContent=v?`${v.target.name}: ${v.phase==='travelling'?`scout travelling (${Math.round(v.progress*100)}%)`:v.reason||v.phase}${v.seenAt&&v.phase==='fog'?` Last seen ${new Date(v.seenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.`:''}`:'Your scout is at home.';
      const key=`${v?.target.uid}:${v?.phase}`;if(visitActions.dataset.state!==key){visitActions.dataset.state=key;visitActions.replaceChildren();if(v){visitActions.append(button('Recall scout',()=>network.recall()));if(v.phase==='observing'){for(const[text,dx,dz]of[['Scout west',-5,0],['Scout north',0,-5],['Scout south',0,5],['Scout east',5,0]])visitActions.append(button(text,()=>{const s=network.info().view?.scout;if(s)network.moveScout(s.x+dx,s.z+dz);}));}}}
      hint.textContent=info.view?'Only the ground around your scout is visible. Tap to move.':v?.phase==='travelling'?'Your scout is crossing the shared wilderness.':v?'The town is hidden. Its owner keeps everything inside these borders.':'Shared wilderness · dashed lines mark town borders';
    }
    viewer?.update(info);
  }
  function open(){beforeOpen();priorFocus=document.activeElement;panel.hidden=false;network.watch(true);toggle.setAttribute('aria-expanded','true');if(!viewer)viewer=new ObservedView(canvas,{cloneModel,onMove:(x,z)=>network.moveScout(x,z),onSelect:uid=>network.scout(uid)});viewer.resize();update();closeButton.focus({preventScroll:true});}
  function close(){panel.hidden=true;network.watch(false);toggle.setAttribute('aria-expanded','false');network.recall();if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});}
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.target===canvas&&e.key.startsWith('Arrow')){e.preventDefault();e.stopPropagation();const s=network.info().view?.scout;if(s){const d={ArrowUp:[0,-5],ArrowDown:[0,5],ArrowLeft:[-5,0],ArrowRight:[5,0]}[e.key];network.moveScout(s.x+d[0],s.z+d[1]);}}});
  function frame(time){requestAnimationFrame(frame);const dt=Math.min(.1,(time-last)/1000);last=time;if(!panel.hidden)viewer?.render(dt);}requestAnimationFrame(frame);
  return{open,close,update,get incoming(){return !!values.invitation;},get active(){return !panel.hidden;}};
}
