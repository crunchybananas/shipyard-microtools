import { createCoopTransport, decode } from './coop-transport.js';
import { validClaim, sectorKey, slotKey, validGrid } from './observed-state.js';

/** Only claims and short-lived connection addresses go into the directory. */
export function createWorldDirectory(config,auth) {
  const db=createCoopTransport(config,auth);
  const path=id=>`worlds/${id}`;
  const member=(id,uid=auth.user.uid)=>db.get(`${path(id)}/members/${uid}`);
  async function enlist(link,attempt=0) {
    const existing=await member(link.worldId);
    if(existing){if(existing.data.townId!==link.townId)throw new Error('This account already has a town in this world. Import its latest backup to use it here.');return {...link,...existing.data,phase:'ready'};}
    const world=await db.get(path(link.worldId));
    if(!world && link.phase!=='create')throw new Error('That world invitation was not found. Check the full link.');
    const writes=[];
    if(!world)writes.push(db.write(path(link.worldId),{version:1,owner:auth.user.uid,seed:link.seed},{precondition:{exists:false}}));
    const c={uid:auth.user.uid,townId:link.townId,name:link.name,gx:link.gx,gz:link.gz,sector:sectorKey(link.gx,link.gz)};
    const record={townId:c.townId,name:c.name,gx:c.gx,gz:c.gz,sector:c.sector};
    writes.push(db.write(`${path(link.worldId)}/claims/${slotKey(c.gx,c.gz)}`,c,{precondition:{exists:false}}),db.write(`${path(link.worldId)}/members/${auth.user.uid}`,record,{precondition:{exists:false}}));
    try { await db.commit(writes); } catch(error) {
      const joined=await member(link.worldId);if(joined?.data.townId===link.townId)return {...link,...joined.data,phase:'ready'};
      const occupied=await db.get(`${path(link.worldId)}/claims/${slotKey(link.gx,link.gz)}`);
      if(attempt<3 && occupied && occupied.data.uid!==auth.user.uid){const next=await openSlot(link.worldId,link.gx,link.gz);return enlist({...link,...next},attempt+1);}
      throw error;
    }
    return {...link,seed:world?.data.seed??link.seed,phase:'ready'};
  }
  async function openSlot(worldId,gx,gz) {
    // Keep friends near the invite's settlement; no global registry download.
    for(let radius=1;radius<=8;radius++)for(let z=-radius;z<=radius;z++)for(let x=-radius;x<=radius;x++){
      if(Math.max(Math.abs(x),Math.abs(z))!==radius||!validGrid(gx+x)||!validGrid(gz+z))continue;
      if(!await db.get(`${path(worldId)}/claims/${slotKey(gx+x,gz+z)}`))return {gx:gx+x,gz:gz+z};
    }
    throw new Error('This area is full. Ask for an invitation from a town farther away.');
  }
  async function claims(worldId,gx,gz) {
    const result=await db.call(`/${path(worldId)}:runQuery`,{method:'POST',body:JSON.stringify({structuredQuery:{from:[{collectionId:'claims'}],where:{fieldFilter:{field:{fieldPath:'sector'},op:'EQUAL',value:{stringValue:sectorKey(gx,gz)}}},limit:64}})});
    return result.filter(r=>r.document).map(r=>decode({mapValue:{fields:r.document.fields}})).filter(validClaim);
  }
  const presence=(worldId,uid)=>db.get(`${path(worldId)}/presence/${uid}`);
  async function heartbeat(link,peer,session) {
    const key=`${path(link.worldId)}/presence/${auth.user.uid}`,current=await db.get(key);
    if(current&&current.data.session!==session&&new Date(current.data.expiresAt).getTime()>Date.now())throw new Error('This town is already online on another device. Close its world connection and try again.');
    const value={townId:link.townId,endpoint:peer.id(),ticket:peer.ticket(),session,expiresAt:new Date(Date.now()+90000)};
    await db.commit([db.write(key,value,{precondition:current?{updateTime:current.updateTime}:{exists:false},stamp:true})]);
    return value;
  }
  async function withdraw(link,session,endpoint) {
    const key=`${path(link.worldId)}/presence/${auth.user.uid}`,current=await db.get(key);
    if(current?.data.session===session&&(!endpoint||current.data.endpoint===endpoint))await db.commit([{delete:`projects/${config.projectId}/databases/(default)/documents/${key}`,currentDocument:{updateTime:current.updateTime}}]);
  }
  return {enlist,openSlot,claims,presence,heartbeat,withdraw,member,world:id=>db.get(path(id)), db};
}
