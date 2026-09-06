import {mkdirSync} from 'node:fs';
export default async function(h){
 const pass=[],fail=[];const ok=(s,v,d)=>{(v?pass:fail).push(s+(v?'':' '+JSON.stringify(d)));};
 const errors=[];h.ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.text);});
 const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`;
 const ready=async()=>{for(let i=0;i<40;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))return;await h.wait(1);}throw Error('boot failed: '+errors.join('; '));};
 await h.navigate(url);await ready();await h.evaluate('localStorage.clear();1');await h.navigate(url);await ready();
 await h.evaluate('document.getElementById("btn-begin").click();1');await h.wait(1.5);await h.evaluate('ABYME.setIntroT(99);1');await h.wait(2.5);
 await h.evaluate(`document.getElementById('debug-panel').style.display='none';ABYME.W.time=13;ABYME.W.timeDrift=0;1`);
 const kit=await h.evaluate(`(()=>{const {core,game}=ABYME;return {parts:['towerShaft','towerStair','towerRails','vaultRibs','archiveFurniture','coastalPines'].every(n=>!!core.getObjectByName(n)),locked:!game.interact.hotspots.find(s=>s.id==='climbStair').when()};})()`);
 ok('authored architecture is loaded',kit.parts);ok('the unseated lens still guards the stair',kit.locked);
 await h.evaluate(`(()=>{const {W,game}=ABYME;W.lensPlaced=true;ABYME.tp(-86,-42,3.5,0);game.interact.hotspots.find(s=>s.id==='climbStair').onClick();return true;})()`);await h.wait(.2);
 const start=await h.evaluate('({y:ABYME.player.pos.y,locked:ABYME.player.locked,top:ABYME.W.atTop,night:ABYME.W.lampLit})');
 ok('touch starts on the first tread without skipping the climb',start.y<14&&!start.locked&&!start.top,start);
 ok('the seated lens permits a daylight climb',!start.night);
 await h.send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await h.wait(.25);await h.send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await h.wait(.2);
 const keyed=await h.evaluate('ABYME.player.pos.toArray()');ok('real keyboard input climbs the first flight',keyed[1]>start.y,keyed);
 const course=await h.evaluate(`(async()=>{const {player,W,core,THREE}=ABYME;const {stairPose,TOWER}=await import('/the-island/js/tower-course.js');const {syncGates}=await import('/the-island/js/terrain.js');const blocked=[],meshMiss=[];
  let p=stairPose(0);player.pos.set(p.x,p.y,p.z);player.syncCamera();
  const rc=new THREE.Raycaster();const stair=core.getObjectByName('towerStair');core.updateMatrixWorld(true);
  for(let i=1;i<=1660;i++){syncGates(W);p=stairPose(i/1660);if(!player._step(p.x,p.z)){blocked.push(i);break;}player.pos.x=p.x;player.pos.z=p.z;player.syncCamera();
   if(i%20===10){rc.set(new THREE.Vector3(p.x,player.pos.y+.3,p.z),new THREE.Vector3(0,-1,0));rc.far=.5;const hit=rc.intersectObject(stair);if(!hit.length||Math.abs(hit[0].point.y-player.pos.y)>.012)meshMiss.push(i);}}
  const windows=[];for(const y of [6.4,11.2,16]){p=stairPose(y/TOWER.rise);const dir=new THREE.Vector3(Math.sin(p.angle),0,Math.cos(p.angle));rc.set(new THREE.Vector3(p.x,TOWER.base+y+1.25,p.z),dir);rc.far=6;windows.push(rc.intersectObject(core.getObjectByName('towerShaft')).length);}
  return {blocked,meshMiss,windows,y:player.pos.y,top:W.atTop};})()`);
 ok('every tread is reachable through player collision',course.blocked.length===0,course);
 ok('rendered treads meet the physical floor',course.meshMiss.length===0,course.meshMiss);
 ok('all three shaft windows are real openings',course.windows.every(n=>n===0),course.windows);
 ok('the climb reaches the gallery',course.top&&Math.abs(course.y-34.1)<.001,course);
 await h.wait(.2);ok('the visit records earned evidence',await h.evaluate('ABYME.W.flags.towerVisited&&ABYME.notebook.has("place.lamp-gallery")'));
 const balcony=await h.evaluate(`(async()=>{const {player,W}=ABYME;const {stairPose,TOWER}=await import('/the-island/js/tower-course.js');const {syncGates}=await import('/the-island/js/terrain.js');const p=stairPose(1);let blocked=[];
  for(let r=p.radius;r<3.2;r+=.04){const x=TOWER.x+Math.sin(p.angle)*r,z=TOWER.z+Math.cos(p.angle)*r;syncGates(W);if(!player._step(x,z)){blocked.push(r);break;}player.pos.x=x;player.pos.z=z;player.syncCamera();}
  return {blocked,y:player.pos.y,rail:!player._step(TOWER.x+Math.sin(p.angle)*3.7,TOWER.z+Math.cos(p.angle)*3.7)};})()`);
 ok('the stair landing reaches the outside balcony',balcony.blocked.length===0,balcony);ok('the balcony rail prevents a fall',balcony.rail);
 const down=await h.evaluate(`(async()=>{const {player,W}=ABYME;const {stairPose}=await import('/the-island/js/tower-course.js');const {syncGates}=await import('/the-island/js/terrain.js');let p=stairPose(1);player.pos.set(p.x,p.y,p.z);player.syncCamera();const blocked=[];for(let i=1659;i>=0;i--){syncGates(W);p=stairPose(i/1660);if(!player._step(p.x,p.z)){blocked.push(i);break;}player.pos.x=p.x;player.pos.z=p.z;player.syncCamera();}syncGates(W);return {blocked,y:player.pos.y,top:W.atTop};})()`);
 ok('all flights can be walked back down',down.blocked.length===0&&Math.abs(down.y-13.5)<.001&&!down.top,down);
 const underground=await h.evaluate(`(async()=>{const {W,player}=ABYME;const {syncGates}=await import('/the-island/js/terrain.js');W.atTop=false;W.tide=W.tideTarget=0;W.flags.hatchOpen=true;syncGates(W);const failures=[];
  function walk(x,z){const n=Math.ceil(Math.hypot(x-player.pos.x,z-player.pos.z)/.045),sx=player.pos.x,sz=player.pos.z;for(let i=1;i<=n;i++){const xx=sx+(x-sx)*i/n,zz=sz+(z-sz)*i/n;if(!player._step(xx,zz)){failures.push([xx,zz,player.pos.y]);return;}player.pos.x=xx;player.pos.z=zz;player.syncCamera();}}
  ABYME.tp(142,-150,Math.PI/2,0);walk(132,-150);const drain=player.pos.y;walk(142,-150);const drainExit=player.pos.y;
  ABYME.tp(97,32.7,0,0);walk(97,18.6);const cellar=player.pos.y;walk(89.8,18.6);const west=player.pos.y;
  return {failures,drain,drainExit,cellar,west};})()`);
 ok('the drain can be entered and exited on its ramp',underground.drain===4&&underground.drainExit>8.7,underground);
 ok('the cellar stair leads into the western room',underground.cellar===18.3&&underground.west===17.5&&underground.failures.length===0,underground);
 await h.wait(.3);
 await h.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 const buried=await h.evaluate('({value:ABYME.core.getObjectByName("terrain").material.userData.shader.uniforms.uBuriedView.value,pos:ABYME.player.pos.toArray(),camera:ABYME.camera.position.toArray()})');
 ok('the underground view cuts obstructing terrain',buried.value===1,buried);
 const reread=await h.evaluate(`(()=>{const {W,game,UI,notebook}=ABYME;const ledger=game.interact.hotspots.find(s=>s.id==='drainLedger');W.level=1;ledger.onClick();UI._readerPage(1);UI.closeReader();W.level=3;ledger.onClick();const reopened=UI._reader?.id==='drain_ledger'&&!W.recDisp.drain_ledger;while(UI._reader&&UI._reader.page<UI._reader.pages.length-1)UI._readerPage(1);UI.closeReader();const deep=notebook.hasReadLore('drain_ledger','deep');ledger.onClick();const carried=W.recDisp.drain_ledger==='carried';W.level=1;return {reopened,deep,carried};})()`);
 ok('returning to a read record reveals newly available pages',reread.reopened&&reread.deep,reread);
 ok('the record can be carried after its new pages are read',reread.carried,reread);
 await h.evaluate(`(()=>{const {player}=ABYME;player.pos.set(89.6,17.5,20.35);player.yaw=Math.atan2(89.6-88.4,20.35-21.56);player.pitch=-.17;player.syncCamera();return true;})()`);await h.wait(.4);
 const target=await h.evaluate(`(()=>{const {core,THREE,camera}=ABYME;const p=new THREE.Vector3();core.getObjectByName('archiveTin').children[0].getWorldPosition(p);p.project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};})()`);
 await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...target});await h.wait(.2);
 await h.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...target});await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...target});await h.wait(.3);
 const tin=await h.evaluate('({open:ABYME.W.flags.archiveTinOpened,read:ABYME.UI._reader?.id,note:ABYME.notebook.has("event.archive-opened")})');
 ok('a real pointer opens the bread tin and its papers',tin.open&&tin.read==='drying_papers'&&tin.note,tin);
 await h.evaluate('ABYME.UI.closeReader();1');await h.navigate(url);await ready();await h.evaluate('document.getElementById("btn-continue").click();1');await h.wait(1.2);
 ok('the gallery visit and opened tin persist',await h.evaluate('ABYME.W.flags.towerVisited&&ABYME.W.flags.archiveTinOpened'));
 ok('the browser reports no runtime errors',errors.length===0,errors);
 console.log(`LANDFALL ${pass.length} / ${pass.length+fail.length}`);if(fail.length){console.log(JSON.stringify(fail,null,2));process.exitCode=1;}
}
