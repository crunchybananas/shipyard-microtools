import { coopId, ensureCoop, validId, validTownName } from './coop-state.js';
import { createWorldDirectory } from './observed-directory.js';
import { createScoutHost, scoutRoute, restoreObservedWorld, parseWorldInvite, isPresent, validateObservation, MAX_VIEW_BYTES } from './observed-state.js';

async function openPeer(handler) { const module=await import('../vendor/iroh/town_peer.js');await module.default();const peer=await module.TownPeer.open(handler);try{await peer.ready();return peer;}catch(e){await peer.close();throw e;} }
export function createObservedWorld({config,auth,getState,canUse,save,actors,storage=globalThis.localStorage,onChange=()=>{},directory=createWorldDirectory(config,auth),makePeer=openPeer,now=()=>Date.now()}) {
  let peer=null,session=null,online=false,busy=false,message='',claims=[],presences=new Map(),view=null,visit=null,center=null,networkTask=false,polling=false,lastDirectory=0,lastBeat=0,lastView=0,generation=0,linkState=null,connecting=false;
  let watching=false;let autoTried=null;let notesKey=null,notes={},lastNote=0;const admitted=new Map(),pending=new Set();
  const host=createScoutHost({getState,actors,now,canObserve:()=>online&&canUse()&&getState()===linkState});
  const changed=()=>onChange();
  const link=()=>getState().networkWorld;
  function persist(next) {const s=getState(),before=s.networkWorld;s.networkWorld=restoreObservedWorld(next);const result=save(s);if(!result.ok){s.networkWorld=before;throw new Error(result.reason);}changed();}
  function loadNotes(){const current=link();if(!current)return;const key=`island-town.scout-notes.v1:${current.worldId}:${current.uid}`;if(key===notesKey)return;notesKey=key;notes={};try{const saved=JSON.parse(storage?.getItem(key)||'{}');for(const [uid,n]of Object.entries(saved).slice(-64))if(validId(uid)&&Number.isFinite(n.seenAt)&&Number.isInteger(n.buildings)&&Number.isInteger(n.trees)&&n.buildings>=0&&n.buildings<=256&&n.trees>=0&&n.trees<=1024)notes[uid]={seenAt:n.seenAt,buildings:n.buildings,trees:n.trees};}catch{}}
  function keepNote(){if(!visit?.seenAt||!view)return;loadNotes();notes[visit.target.uid]={seenAt:visit.seenAt,buildings:view.buildings.length,trees:view.trees.length};notes=Object.fromEntries(Object.entries(notes).sort((a,b)=>a[1].seenAt-b[1].seenAt).slice(-64));try{storage?.setItem(notesKey,JSON.stringify(notes));}catch{}lastNote=now();}
  async function action(fn){if(busy)return;busy=true;message='';changed();try{await fn();}catch(e){message=e.code==='OFFLINE'?'The world connection was interrupted. Your town remains saved on this device.':e.message||'The world could not connect. Try again.';}finally{busy=false;changed();}}
  function incoming(endpoint,raw) {
    try {
      if(!online||!canUse()||getState()!==linkState||auth.user?.uid!==link()?.uid)return JSON.stringify({kind:'fog'});
      if(raw.length>4096)return JSON.stringify({kind:'error'});
      const request=JSON.parse(raw),current=link();
      if(request.worldId!==current.worldId||request.townId!==current.townId||request.owner!==current.uid||!validId(request.uid)||request.uid===auth.user?.uid)return JSON.stringify({kind:'denied'});
      const known=admitted.get(endpoint);
      if(!known||known.uid!==request.uid||known.until<now()){
        if(pending.size<8&&!pending.has(endpoint)){pending.add(endpoint);const gen=generation;
          Promise.all([directory.member(current.worldId,request.uid),directory.presence(current.worldId,request.uid)]).then(([m,p])=>{
            if(gen===generation&&m&&isPresent(p?.data,now())&&p.data.endpoint===endpoint&&m.data.townId===p.data.townId)admitted.set(endpoint,{uid:request.uid,until:now()+25000});
          }).catch(()=>{}).finally(()=>pending.delete(endpoint));}
        if(admitted.size>128)admitted.clear();
        return JSON.stringify({kind:'checking'});
      }
      return JSON.stringify({...host.handle(endpoint,request),townId:current.townId,owner:current.uid});
    }catch{return JSON.stringify({kind:'error'});}
  }
  async function refreshDirectory() {
    const current=link();if(!current||current.phase!=='ready'||!auth.user||auth.user.uid!==current.uid)return;
    const gen=generation,c=center||current,sectors=new Map();
    for(const dx of[-2,0,2])for(const dz of[-2,0,2]){const gx=c.gx+dx,gz=c.gz+dz;sectors.set(`${Math.floor(gx/8)}_${Math.floor(gz/8)}`,{gx,gz});}
    const lists=await Promise.all([...sectors.values()].map(p=>directory.claims(current.worldId,p.gx,p.gz)));
    if(gen!==generation)return;
    claims=[...new Map(lists.flat().map(c=>[c.uid,c])).values()];
    // Presence is learned by contact. Browsing the map downloads borders only.
    if(visit){const uid=visit.target.uid,record=await directory.presence(current.worldId,uid);if(gen===generation)presences.set(uid,record?.data);}
    if(gen!==generation)return;lastDirectory=now();changed();
  }
  async function connect() {
    if(online||connecting)return;
    const current=link();if(!current||!auth.user||auth.user.uid!==current.uid||!canUse())throw new Error('Open your home town and sign in with its account first.');
    connecting=true;const gen=++generation;let candidate;
    try{
      if(current.phase!=='ready'){const next=await directory.enlist(current);if(gen!==generation)return;persist(next);}
      candidate=await makePeer(incoming);if(gen!==generation){await candidate.close();return;}
      const leaseKey=`island-town.world-session.v1:${current.worldId}`;let nextSession=storage?.getItem(leaseKey);if(!validId(nextSession)){nextSession=coopId();storage?.setItem(leaseKey,nextSession);}await directory.heartbeat(link(),candidate,nextSession);
      if(gen!==generation){await directory.withdraw(current,nextSession,candidate.id()).catch(()=>{});await candidate.close();return;}
      peer=candidate;session=nextSession;linkState=getState();online=true;lastBeat=now();center={gx:current.gx,gz:current.gz};message='Your town is open to scouts.';await refreshDirectory();
    }catch(e){if(candidate&&candidate!==peer)await candidate.close().catch(()=>{});throw e;}finally{connecting=false;changed();}
  }
  async function disconnect() {
    keepNote();const previous=peer,oldSession=session,current=linkState?.networkWorld||link();++generation;online=false;peer=null;session=null;view=null;admitted.clear();host.clear();pending.clear();
    if(visit)visit={...visit,phase:'fog',reason:'Your town is offline. Reconnect to send the scout again.'};changed();
    await Promise.allSettled([previous?.close(),current&&oldSession&&directory.withdraw(current,oldSession,previous?.id())]);
  }
  async function begin(name,invitation) {
    if(!canUse()||!auth.user)throw new Error('Sign in through Play together, then return to World.');
    if(!validTownName(name))throw new Error('Give your town a name with 1–40 characters.');
    if(link())throw new Error('This town already belongs to a world.');
    const s=getState(),townId=ensureCoop(s).townId,parsed=invitation?parseWorldInvite(invitation):null;
    if(invitation&&!parsed)throw new Error('Paste the full world invitation link.');
    let worldId=parsed?.worldId||coopId(),position={gx:0,gz:0},seed=crypto.getRandomValues(new Uint32Array(1))[0];
    if(parsed){const w=await directory.world(worldId);if(!w)throw new Error('That world was not found.');seed=w.data.seed;position=await directory.openSlot(worldId,parsed.gx,parsed.gz);}
    if(s!==getState()||!canUse())return;
    persist({version:1,worldId,uid:auth.user.uid,townId,name:name.trim(),...position,seed,phase:parsed?'join':'create'});
    await connect();
  }
  function scout(uid) {
    const target=claims.find(c=>c.uid===uid);if(!online||!target||uid===auth.user.uid)return;
    peer.end_visit();view=null;
    const home=link(),distance=Math.hypot(target.gx-home.gx,target.gz-home.gz);
    visit={target,phase:'travelling',started:now(),duration:Math.min(20000,4000+distance*2000),progress:0,route:scoutRoute(home,target),command:null,seq:0};message='Scout travelling through the shared wilderness.';changed();
  }
  function recall(){keepNote();if(visit&&peer){const target=presences.get(visit.target.uid);if(target)peer.request(target.ticket,JSON.stringify({version:1,kind:'recall',worldId:link().worldId,uid:auth.user.uid,townId:visit.target.townId,owner:visit.target.uid})).catch(()=>{});}visit=null;view=null;message='';peer?.end_visit();changed();}
  async function observe() {
    if(!online||!visit||polling||visit.phase==='travelling'||!peer)return;
    const active=visit,gen=generation,connection=peer;
    let target=presences.get(active.target.uid);
    if((!target||active.phase==='fog'||!isPresent(target,now()))&&now()-(active.checkedAt||0)>5000){
      polling=true;active.checkedAt=now();try{const record=await directory.presence(link().worldId,active.target.uid);if(gen!==generation||visit!==active)return;target=record?.data;presences.set(active.target.uid,target);}catch{target=null;}finally{polling=false;}
    }
    if(gen!==generation||visit!==active)return;
    if(!isPresent(target,now())){view=null;visit.phase='fog';visit.reason='Town offline. Your scout is waiting at the border.';changed();return;}
    polling=true;lastView=now();
    try{
      if(active.hostSession!==target.session||active.endpoint!==target.endpoint){active.seq=0;active.hostSession=target.session;active.endpoint=target.endpoint;}
      const raw=await connection.request(target.ticket,JSON.stringify({version:1,kind:'observe',worldId:link().worldId,uid:auth.user.uid,townId:active.target.townId,owner:active.target.uid,target:active.command}));
      if(gen!==generation||visit!==active)return;
      if(raw.length>MAX_VIEW_BYTES)throw new Error('The town sent an oversized view.');
      const value=JSON.parse(raw);
      if(value.kind==='checking'){view=null;visit.phase='connecting';visit.reason='Making contact with the town.';return;}
      if(value.kind!=='view'){view=null;visit.phase='fog';visit.reason=value.kind==='busy'?'Four scouts are visiting. Yours is waiting outside.':'Town offline. Your scout is waiting at the border.';return;}
      const next=validateObservation(value);if(!next||value.townId!==active.target.townId||value.owner!==active.target.uid||next.seq<=active.seq)throw new Error('The town sent an invalid or old view.');
      message='';active.seq=next.seq;view=next;visit.phase='observing';visit.reason='Live scout view';visit.seenAt=now();if(now()-lastNote>30000)keepNote();
    }catch{if(gen===generation&&visit===active){view=null;visit.phase='fog';visit.reason='Contact lost. Your scout is waiting at the border.';visit.seq=0;admitted.clear();}}
    finally{polling=false;changed();}
  }
  async function tick() {
    if(!canUse()||(link()&&auth.user?.uid!==link().uid)){if(online)await disconnect();return;}
    const current=link();if(!current)return;loadNotes();
    if(!online&&!busy&&!connecting&&autoTried!==current.worldId&&auth.user?.uid===current.uid){autoTried=current.worldId;await action(connect);}
    if(!online)return;
    if(visit?.phase==='travelling'){visit.progress=Math.min(1,(now()-visit.started)/visit.duration);if(visit.progress===1){visit.phase='connecting';visit.reason='Scout at the border.';}changed();}
    if(visit?.seenAt&&now()-visit.seenAt>5000&&view){view=null;visit.phase='fog';visit.reason='Contact lost. Your scout is waiting at the border.';changed();}
    if(!networkTask&&(now()-lastBeat>30000||watching&&now()-lastDirectory>60000)){
      networkTask=true;const gen=generation;
      try{if(now()-lastBeat>30000){await directory.heartbeat(current,peer,session);lastBeat=now();}if(watching)await refreshDirectory();}
      catch(e){if(gen===generation){message=e.code==='OFFLINE'?'The world connection was interrupted. Your town remains saved on this device.':e.message;await disconnect();}}finally{networkTask=false;}
    }
    if(visit&&now()-lastView>(visit.phase==='fog'?3000:500))void observe();
  }
  return {tick,info:()=>({link:link(),online,busy:busy||connecting,message,claims,presences,view,visit,center,visitors:host.count,scouts:host.positions(),notes,user:auth.user}),
    begin:(name,invitation)=>action(()=>begin(name,invitation)),connect:()=>action(connect),disconnect:()=>action(async()=>{autoTried=link()?.worldId;await disconnect();message='Your town is offline. Its border stays on the map.';}),
    scout,recall,moveScout:(x,z)=>{if(visit?.phase==='observing')visit.command={x,z};},
    watch:value=>{watching=value;if(value&&link()?.phase==='ready')void action(refreshDirectory);},refresh:()=>action(refreshDirectory),pan:(dx,dz)=>action(async()=>{const c=center||link();center={gx:Math.max(-1024,Math.min(1023,c.gx+dx)),gz:Math.max(-1024,Math.min(1023,c.gz+dz))};await refreshDirectory();}),
    async dispose(){await disconnect();},
  };
}
