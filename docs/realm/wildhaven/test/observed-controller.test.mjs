import test from 'node:test';
import assert from 'node:assert/strict';
import {createObservedWorld} from '../js/observed-world.js';
import {createGame} from '../js/sim.js';
import {coopId} from '../js/coop-state.js';
import {publicObservation} from '../js/observed-state.js';
const flush=()=>new Promise(r=>setImmediate(r));
function harness({peerGate=null,enlistGate=null,heartbeatGate=null}={}) {
 let time=100000,reachable=true,session='c'.repeat(32),seq=0,mode='view',wrongTarget=false,closeCount=0;
 const a=coopId(),b=coopId(),worldId=coopId(),s=createGame(),remoteState=createGame();
 let state=s;const heartbeats=[],withdrawals=[],saves=[];
 s.networkWorld={version:1,worldId,uid:a,townId:coopId(),name:'A',gx:0,gz:0,seed:3,phase:'ready'};
 const claim={uid:b,townId:coopId(),name:'B',gx:1,gz:0,sector:'0_0'},data=new Map();
 const peer={id:()=> 'a'.repeat(64),ticket:()=> 'ticket',close:async()=>{closeCount++;},end_visit:()=>{},request:async()=>{if(!reachable)throw new Error('offline');if(mode!=='view')return JSON.stringify({kind:mode});return JSON.stringify({...publicObservation(remoteState,{x:0,z:8},[],++seq),townId:wrongTarget?coopId():claim.townId,owner:claim.uid});}};
 const directory={claims:async()=>[claim],presence:async()=>({data:{endpoint:'b'.repeat(64),ticket:'ticket',session,expiresAt:new Date(time+90000)}}),enlist:async current=>{if(enlistGate)await enlistGate;return {...current,phase:'ready'};},heartbeat:async(current,peer,session)=>{heartbeats.push({current,peer,session});if(heartbeatGate)await heartbeatGate;},withdraw:async(current,session,endpoint)=>{withdrawals.push({current,session,endpoint});},member:async()=>null};
 let handler;const auth={user:{uid:a}},network=createObservedWorld({config:{},auth,getState:()=>state,canUse:()=>true,save:value=>{saves.push(value);return{ok:true};},actors:()=>[],storage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},directory,makePeer:async fn=>{handler=fn;if(peerGate)await peerGate;return peer;},now:()=>time});
 return{network,s,auth,claim,heartbeats,withdrawals,saves,setState:next=>{state=next;},incoming:raw=>JSON.parse(handler('b'.repeat(64),JSON.stringify(raw))),advance:n=>time+=n,reachable:v=>reachable=v,mode:v=>mode=v,wrongTarget:v=>wrongTarget=v,replaceHost:()=>{session=coopId();seq=0;},get closes(){return closeCount;}};
}
test('visit becomes fog on connection loss and reconnect never changes the home town',async()=>{
 const h=harness(),before=JSON.stringify(h.s);await h.network.connect();h.network.scout(h.claim.uid);h.advance(25000);await h.network.tick();await flush();assert.equal(h.network.info().visit.phase,'observing');
 h.reachable(false);h.advance(6000);await h.network.tick();await flush();assert.equal(h.network.info().view,null);assert.equal(h.network.info().visit.phase,'fog');assert.equal(JSON.stringify(h.s),before);
 h.reachable(true);h.advance(4000);await h.network.tick();await flush();assert.equal(h.network.info().visit.phase,'observing');await h.network.dispose();
});
test('a replacement host starts a fresh observation sequence',async()=>{
 const h=harness();await h.network.connect();h.network.watch(true);await flush();h.network.scout(h.claim.uid);h.advance(25000);await h.network.tick();await flush();h.advance(1000);await h.network.tick();await flush();assert.equal(h.network.info().view.seq,2);
 h.replaceHost();h.advance(61000);await h.network.tick();await flush();assert.equal(h.network.info().view.seq,1);await h.network.dispose();
});
test('signing out closes the endpoint and removes the current remote view',async()=>{
 const h=harness();await h.network.connect();h.auth.user=null;await h.network.tick();assert.equal(h.network.info().online,false);assert.equal(h.network.info().view,null);assert.equal(h.closes,1);
});
test('recalling a scout ignores an in-flight response',async()=>{
 const h=harness();await h.network.connect();h.network.scout(h.claim.uid);h.advance(25000);const t=h.network.tick();h.network.recall();await t;await flush();assert.equal(h.network.info().visit,null);assert.equal(h.network.info().view,null);await h.network.dispose();
});

test('a valid snapshot from a different town is rejected',async()=>{
 const h=harness();await h.network.connect();h.network.scout(h.claim.uid);h.advance(25000);await h.network.tick();await flush();assert.equal(h.network.info().visit.phase,'observing');
 h.wrongTarget(true);h.advance(1000);await h.network.tick();await flush();assert.equal(h.network.info().view,null);assert.equal(h.network.info().visit.phase,'fog');await h.network.dispose();
});

test('sign-out rejects incoming requests before the next simulation tick',async()=>{
 const h=harness();await h.network.connect();h.auth.user=null;assert.equal(h.incoming({version:1,kind:'observe'}).kind,'fog');await h.network.dispose();
});

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('opening an unlinked save disconnects the prior town and clears its map and scout',async()=>{
 const h=harness();await h.network.connect();h.network.scout(h.claim.uid);h.advance(25000);await h.network.tick();await flush();assert.ok(h.network.info().view);
 h.setState(createGame());assert.equal(h.incoming({version:1,kind:'observe'}).kind,'fog');await h.network.tick();
 const info=h.network.info();assert.equal(info.online,false);assert.equal(info.view,null);assert.equal(info.visit,null);assert.deepEqual(info.claims,[]);assert.deepEqual(info.notes,{});assert.equal(info.center,null);
 assert.equal(h.closes,1);assert.equal(h.withdrawals[0].current.townId,h.s.networkWorld.townId);h.advance(61000);await h.network.tick();assert.equal(h.heartbeats.length,1);
});
test('switching between linked saves reconnects with the selected town identity',async()=>{
 const h=harness();await h.network.connect();const next=createGame();next.networkWorld={...h.s.networkWorld,worldId:coopId(),townId:coopId(),name:'Another town'};
 h.setState(next);await h.network.tick();assert.equal(h.closes,1);assert.equal(h.network.info().online,true);assert.equal(h.network.info().link.name,'Another town');
 assert.equal(h.heartbeats.length,2);assert.equal(h.heartbeats[1].current.townId,next.networkWorld.townId);assert.equal(h.withdrawals[0].current.townId,h.s.networkWorld.townId);await h.network.dispose();
});
test('switching during peer creation cannot publish the old endpoint for the new save',async()=>{
 const gate=deferred(),h=harness({peerGate:gate.promise}),connecting=h.network.connect();await flush();h.setState(createGame());h.network.syncTown();gate.resolve();await connecting;
 assert.equal(h.heartbeats.length,0);assert.equal(h.closes,1);assert.equal(h.network.info().online,false);
});
test('an in-flight membership result cannot write into a different town',async()=>{
 const gate=deferred(),h=harness({enlistGate:gate.promise});h.s.networkWorld.phase='create';const connecting=h.network.connect();await flush();const next=createGame();h.setState(next);h.network.syncTown();gate.resolve();await connecting;
 assert.equal(h.saves.length,0);assert.equal(next.networkWorld,undefined);assert.equal(h.network.info().online,false);assert.equal(h.heartbeats.length,0);
});
test('a heartbeat completed after switching withdraws only the original town lease',async()=>{
 const gate=deferred(),h=harness({heartbeatGate:gate.promise}),connecting=h.network.connect();await flush();assert.equal(h.heartbeats.length,1);
 h.setState(createGame());h.network.syncTown();gate.resolve();await connecting;assert.equal(h.network.info().online,false);assert.equal(h.closes,1);assert.equal(h.withdrawals.length,1);assert.equal(h.withdrawals[0].current.townId,h.s.networkWorld.townId);
});
