import {beginPlay,renderedFrames,waitForFrame} from './play-ready.mjs';
// Physical access + loaded asset ownership + two-scale persistence, independent
// of the long route audit. A walk through the doorway uses real keyboard input.
export default async function(h){
 const R={pass:[],fail:[]};const ok=(name,v,detail)=>{(v?R.pass:R.fail).push(name+(v?'':` ${JSON.stringify(detail)}`));};
 const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`;
 const ready=async()=>{for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))return;await h.wait(1);}throw Error('boot timeout');};
 await h.navigate(url);await ready();await h.evaluate('localStorage.clear();1');await beginPlay(h);
 const before=await h.evaluate(`(async()=>{
 const {W,game,refs,THREE}=ABYME;const terrain=await import('/the-island/js/terrain.js');const q=refs.cotLantern.parent;
 terrain.syncGates(W);const axis=new THREE.Vector3(Math.sin(Math.PI/12),0,Math.cos(Math.PI/12));
 const from=new THREE.Vector3(-85,0,-40).addScaledVector(axis,3.8);ABYME.tp(from.x,from.z,Math.PI+Math.PI/12,0);
 const blocked=[];for(let r=3.8;r<8.2;r+=.05){const a=new THREE.Vector3(-85,0,-40).addScaledVector(axis,r);const b=a.clone().addScaledVector(axis,.05);if(terrain.wallBlocked(a.x,a.z,b.x,b.z))blocked.push(r);}
 const floor=[];for(const x of [-1.8,0,1.8])for(const z of [-1.8,0,1.8]){const p=q.localToWorld(new THREE.Vector3(x,0,z));floor.push(terrain.heightAt(p.x,p.z)-q.position.y);}
 const authored=['roomStructure','roomCloth','roomCeramics','spareChair','keepsakeBoat','listeningMobile'].map(n=>{const m=q.getObjectByName(n);return !!m?.isMesh&&!!m.geometry.attributes.color});
 return {blocked,floor,authored,annex:terrain.GATES.annexOpen,refugeLit:W.flags.refugeLit,boatOff:!game.interact.hotspots.find(s=>s.id==='launchBoat').when(),q:q.position.toArray()};})()`);
 ok('refuge doorway is open before any puzzle',before.annex&&!before.refugeLit);
 ok('no hidden collision across the initial doorway',before.blocked.length===0,before.blocked);
 ok('terrain stays below the authored floor',Math.max(...before.floor)<0,before.floor);
 ok('six Blender room parts have real vertex-colored geometry',before.authored.every(Boolean));
 ok('boat cannot launch before the journey',before.boatOff);
 await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
 await waitForFrame(h,`Math.hypot(ABYME.player.pos.x-(${before.q[0]}),ABYME.player.pos.z-(${before.q[2]}))<2.3`,'keyboard movement through the east doorway');
 await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
 const walked=await h.evaluate('ABYME.player.pos.toArray()');
 const d=Math.hypot(walked[0]-before.q[0],walked[2]-before.q[2]);
 ok('real keyboard movement enters the east room',d<2.4,{walked,d});
 // A true pointer click on the chair, not its callback. Frame the chair from the room entrance.
 const click=await h.evaluate(`(()=>{const {refs,player,THREE}=ABYME;const q=refs.cotLantern.parent;const p=q.localToWorld(new THREE.Vector3(.45,0,-.75));const target=q.localToWorld(new THREE.Vector3(.5,.65,.7));ABYME.tp(p.x,p.z,Math.atan2(p.x-target.x,p.z-target.z),-.4);return true;})()`);
 await renderedFrames(h);
 const target=await h.evaluate(`(()=>{const {refs,THREE,camera}=ABYME;const chair=refs.cotLantern.parent.getObjectByName('spareChair');const b=new THREE.Box3().setFromObject(chair);const p=b.getCenter(new THREE.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};})()`);
 await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y});await renderedFrames(h);
 await waitForFrame(h,'ABYME.interact.hovered?.id==="spareChair"','the pointer on the spare chair');
 await h.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:target.x,y:target.y});
 await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:target.x,y:target.y});await h.wait(.4);
 const chair=await h.evaluate(`({made:ABYME.W.flags.placeMade,reader:ABYME.UI._reader?.id,note:ABYME.notebook.has('event.place-made')})`);
 ok('pointer selects the authored chair and opens its note',chair.made&&chair.reader==='spare_place'&&chair.note,chair);
 await h.evaluate('ABYME.UI._readerPage(1);ABYME.UI.closeReader();1');
 // Here the full walk owns the earned prerequisite route; this fixture isolates visual restore.
 await h.evaluate(`(()=>{const {W,game,player}=ABYME;W.flags.returned=true;const hs=id=>game.interact.hotspots.find(s=>s.id===id);hs('keepsakeBoat').onClick();hs('launchBoat').onClick();return true;})()`);await renderedFrames(h);
 const pair=await h.evaluate(`(async()=>{const {refs,game,W,THREE}=ABYME;const {waterY}=await import('/the-island/js/world.js');const core=refs.water.parent;const a=core.getObjectByName('releasedBoat');const b=ABYME.modelRefs.water.parent.getObjectByName('releasedBoatModel');const box=new THREE.Box3().setFromObject(a);return {keel:box.min.y-waterY(),length:box.max.x-box.min.x,full:a?.visible,mini:b?.visible,same:a?.children[0].geometry===b?.children[0].geometry,launched:W.flags.boatLaunched,roomGone:!refs.cotLantern.parent.getObjectByName('keepsakeBoat').visible};})()`);
 ok('one hull appears at both scales after launch',pair.full&&pair.mini&&pair.same&&pair.launched&&pair.roomGone,pair);
 // Pin the ordinary reduced-motion pose for the export's waterline check. The
 // moving hull pitches and rolls; its lowest vertex depends on the sampled wave.
 // Keep the original geometry limits and measure an actual rendered pose.
 const motion=await h.evaluate('(()=>{const previous=ABYME.W.reduceMotion;ABYME.W.reduceMotion=true;return previous;})()');await renderedFrames(h);
 const waterline=await h.evaluate(`(async()=>{const {refs,THREE}=ABYME;const {waterY}=await import('/the-island/js/world.js');const box=new THREE.Box3().setFromObject(refs.water.parent.getObjectByName('releasedBoat'));return {keel:box.min.y-waterY(),length:box.max.x-box.min.x};})()`);
 ok('the exported hull meets the water instead of floating in air',waterline.keel<.12&&waterline.keel>-.2&&waterline.length>15&&waterline.length<35,waterline);
 await h.evaluate(`ABYME.W.reduceMotion=${Boolean(motion)};1`);await renderedFrames(h);
 await h.navigate(url);await ready();await h.evaluate('document.getElementById("btn-continue").click();1');await renderedFrames(h);
 const reload=await h.evaluate(`({made:ABYME.W.flags.placeMade,launched:ABYME.W.flags.boatLaunched,carried:ABYME.W.flags.boatCarried,full:ABYME.refs.water.parent.getObjectByName('releasedBoat')?.visible})`);
 ok('Continue restores the chair and the launched boat',reload.made&&reload.launched&&!reload.carried&&reload.full,reload);
 await h.evaluate('ABYME.W.reduceMotion=true;1');await renderedFrames(h);
 const still=await h.evaluate(`({boat:ABYME.refs.water.parent.getObjectByName('releasedBoat').rotation.toArray(),mobile:ABYME.refs.cotLantern.parent.getObjectByName('listeningMobile').rotation.y})`);
 ok('reduced motion stops the room mobile',still.mobile===0,still);
 console.log(`HARBOR ${R.pass.length} / ${R.pass.length+R.fail.length}`);if(R.fail.length){console.log(JSON.stringify(R.fail));process.exitCode=1;}
}
