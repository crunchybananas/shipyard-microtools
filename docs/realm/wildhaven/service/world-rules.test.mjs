import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldDirectory} from '../js/observed-directory.js';
import {coopId} from '../js/coop-state.js';
import {sectorKey} from '../js/observed-state.js';
const token=uid=>`${Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({iss:'https://securetoken.google.com/demo-island-coop',aud:'demo-island-coop',sub:uid,user_id:uid,iat:0,exp:9999999999,firebase:{sign_in_provider:'password',identities:{}}})).toString('base64url')}.`;
const client=uid=>createWorldDirectory({projectId:'demo-island-coop',firestoreEndpoint:'http://127.0.0.1:8085/v1'},{user:{uid},token:async()=>token(uid)});
const link=(uid,worldId,gx=0,gz=0,phase='join')=>({version:1,uid,worldId,townId:coopId(),name:'Town',gx,gz,seed:829,phase});
const denied=fn=>assert.rejects(fn,e=>e.code==='PERMISSION_DENIED');
test('worlds have private bounded membership, immutable disjoint plots, and no town payload storage',async()=>{
  const aId=coopId(),bId=coopId(),worldId=coopId(),a=client(aId),b=client(bId),stranger=client(coopId());
  const first=link(aId,worldId,0,0,'create');await a.enlist(first);const second=link(bId,worldId,-1,-1);await b.enlist(second);
  assert.equal((await b.claims(worldId,-1,-1)).length,1);assert.equal((await a.claims(worldId,0,0)).length,1);
  await denied(()=>stranger.claims(worldId,0,0));await denied(()=>a.db.call(':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{from:[{collectionId:'worlds'}],limit:10}})}));
  await denied(()=>a.db.commit([a.db.write(`worlds/${worldId}/claims/0_0`,{trees:{secret:'forbidden'}},{fields:['trees']})]));
  await denied(()=>a.db.commit([a.db.write(`worlds/${worldId}/claims/1_0`,{uid:aId,townId:first.townId,name:'Another',gx:1,gz:0,sector:'0_0'})]));
  const newUid=coopId(),relocated=await client(newUid).enlist(link(newUid,worldId,0,0));assert.notDeepEqual([relocated.gx,relocated.gz],[0,0]);
  assert.deepEqual((await a.enlist(first)).phase,'ready');
});
test('simultaneous claims cannot overlap and joining can recover after a committed response is lost',async()=>{
  const owner=coopId(),worldId=coopId();await client(owner).enlist(link(owner,worldId,0,0,'create'));
  const uidB=coopId(),uidC=coopId(),b=client(uidB),c=client(uidC),lB=link(uidB,worldId,1,0),lC=link(uidC,worldId,1,0);
  const results=await Promise.allSettled([b.enlist(lB),c.enlist(lC)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.notDeepEqual([results[0].value.gx,results[0].value.gz],[results[1].value.gx,results[1].value.gz]);
  const winner=results[0].status==='fulfilled'?b:c,record=results[0].status==='fulfilled'?lB:lC;assert.equal((await winner.enlist(record)).phase,'ready');
});
test('presence is owner-only, bounded, recoverable, and cannot be stolen by another live session',async()=>{
  const uid=coopId(),worldId=coopId(),a=client(uid),l=link(uid,worldId,0,0,'create');await a.enlist(l);
  const session=coopId(),peer={id:()=> 'a'.repeat(64),ticket:()=> 'endpoint-test-ticket'};await a.heartbeat(l,peer,session);assert.equal((await a.presence(worldId,uid)).data.session,session);
  await assert.rejects(()=>a.heartbeat(l,peer,coopId()),/already online/);
  const stranger=client(coopId());await denied(()=>stranger.presence(worldId,uid));
  await denied(()=>a.db.commit([a.db.write(`worlds/${worldId}/presence/${uid}`,{buildings:[]},{fields:['buildings']})]));
  await a.withdraw(l,'wrong-session');assert.ok(await a.presence(worldId,uid));await a.withdraw(l,session);assert.equal(await a.presence(worldId,uid),null);
  await a.heartbeat(l,peer,coopId());
});
