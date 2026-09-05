import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// A reproducible, causal route capture. Only long travel/time and actor placement
// are accelerated; progression goes through the same hotspot callbacks and gates.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { LORE, T, KEEPER, FIELD_NOTES, CLIMBERS, CONGREGATION, LAMPBLACK } from '../../js/content.js';
import { renderPlaythrough } from './playthrough-html.mjs';

export default async function(h) {
 const dir=resolve(process.env.PLAYTHROUGH_DIR || 'loop/playthrough/2026-09-05/landfall');
 mkdirSync(dir,{recursive:true});
 const url=`http://127.0.0.1:${process.env.SERVE_PORT||8642}/the-island/?debug&mute&localstack`;
 const stages=[]; let chapter='01-arrival';
 const ev=async code=>h.evaluate(`(async()=>{const {W,game,UI,player,notebook,refs,THREE}=ABYME;
   const hs=id=>game.interact.hotspots.find(s=>s.id===id);
   ${code}; return true;})()`);
 const ready=async()=>{for(let i=0;i<50;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))return;await h.wait(1);}throw Error('The game did not boot');};
 const setup=async()=>ev(`window.__captureErrors=[];addEventListener('error',e=>window.__captureErrors.push(e.message));
  addEventListener('unhandledrejection',e=>window.__captureErrors.push(String(e.reason)));
  document.getElementById('debug-panel').style.display='none';W.timeDrift=0;`);
 const check=async(expr,label)=>{if(!await h.evaluate(expr))throw Error('Stage failed: '+label);};
 await h.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await h.navigate(url);await ready();await h.evaluate(`localStorage.clear();localStorage.setItem('abyme-muted','1');1`);
 await h.navigate(url);await ready();await setup();
 await ev(`document.getElementById('btn-begin').click()`);await h.wait(1.5);await ev('ABYME.setIntroT(99)');await h.wait(2.5);

 async function capture(title,action,code='',condition='',delay=.55,kind='scene'){
  if(code)await ev(code);
  await h.wait(delay);
  if(condition)await check(condition,title);
  const num=String(stages.length+1).padStart(3,'0');mkdirSync(join(dir,chapter),{recursive:true});
  const file=`${chapter}/${num}.jpg`;
  const shot=await h.send('Page.captureScreenshot',{format:'jpeg',quality:86});
  if(!shot.result?.data)throw Error('Screenshot failed at '+title);
  writeFileSync(join(dir,file),Buffer.from(shot.result.data,'base64'));
  const state=await h.evaluate(`(()=>{const {W,UI,player,notebook}=ABYME;return {level:W.level,flags:{...W.flags},tide:W.tide,
   position:player.pos.toArray(),yaw:player.yaw,pitch:player.pitch,notes:W.notebook.entries.map(e=>e.id),
   whisper:parseFloat(getComputedStyle(document.getElementById('whisper')).opacity)>.15?document.getElementById('whisper').textContent:'',
   reading:W.reading?{title:UI._reader?.lore.title,page:UI._reader.page+1,text:UI._reader.pages[UI._reader.page],lore:UI._reader.id,hand:document.getElementById('reader-byline')?.textContent||''}:null,
   finale:ABYME.getFinale(),finaleText:document.getElementById('finale').classList.contains('hidden')?'':document.getElementById('finale').innerText,errors:window.__captureErrors||[]};})()`);
  if(state.errors.length)throw Error(state.errors.join('\n'));
  stages.push({number:stages.length+1,chapter,title,action,image:file,kind,...state});
  writeFileSync(join(dir,'stages.json'),JSON.stringify({method:METHOD,stages},null,2));
  console.log(`${num} L${state.level} ${chapter} — ${title}`);
 }
 const look=async(x,z,tx,tz,pitch=-.12)=>ev(`UI.clearWhispers();ABYME.tp(${x},${z},Math.atan2(${x-tx},${z-tz}),${pitch})`);
 const room=async()=>ev(`(()=>{const q=refs.cotLantern.parent;const p=q.localToWorld(new THREE.Vector3(0,0,-1.4));const t=q.localToWorld(new THREE.Vector3(0,1,1.2));ABYME.tp(p.x,p.z,Math.atan2(p.x-t.x,p.z-t.z),-.12)})()`);
 // Underground and tower travel uses the actual body collision; a fresh teleport
 // deliberately resolves to the surface, so it cannot prove entry into a buried room.
 async function walkTo(x,z){
  await ev(`(()=>{const sx=player.pos.x,sz=player.pos.z,n=Math.ceil(Math.hypot(${x}-sx,${z}-sz)/.045);for(let i=1;i<=n;i++){const x=sx+(${x}-sx)*i/n,z=sz+(${z}-sz)*i/n;if(!player._step(x,z))throw Error('Blocked walking to '+x+','+z+' at y '+player.pos.y);player.pos.x=x;player.pos.z=z;player.syncCamera();}})()`);
 }
 async function face(tx,ty,tz){await ev(`UI.clearWhispers();player.yaw=Math.atan2(player.pos.x-(${tx}),player.pos.z-(${tz}));player.pitch=Math.atan2((${ty})-(player.pos.y+player.eye),Math.hypot(player.pos.x-(${tx}),player.pos.z-(${tz})));player.syncCamera()`);}
 async function stairTo(from,to){
  await ev(`const {stairPose}=await import('/the-island/js/tower-course.js');const {syncGates}=await import('/the-island/js/terrain.js');const n=Math.ceil(Math.abs(${to}-${from})*1660);for(let i=1;i<=n;i++){const p=stairPose(${from}+(${to}-${from})*i/n);syncGates(W);if(!player._step(p.x,p.z))throw Error('Blocked on tower stair '+i);player.pos.x=p.x;player.pos.z=p.z;player.yaw=p.yaw+(${to}<${from}?Math.PI:0);player.pitch=${to}<${from}?-.22:.08;player.syncCamera();}`);
 }
 async function enterDrain(){await look(142,-150,132,-150,-.15);await walkTo(139,-150);await capture('Below the standing stones','Walk down the stone drain ramp.');await walkTo(135.7,-150);await face(129.2,5.6,-150);await capture('The drain chamber','The carved arch continues beneath the islet.','','ABYME.player.pos.y===4');}
 async function leaveDrain(){await walkTo(142,-150);}
 async function reader(id,hotspot){
  if(hotspot)await ev(`if(hs(${JSON.stringify(hotspot)}).when && !hs(${JSON.stringify(hotspot)}).when())throw Error('Unreadable hotspot: '+${JSON.stringify(hotspot)});hs(${JSON.stringify(hotspot)}).onClick()`);
  else await ev(`UI.openReader(${JSON.stringify(id)})`);
  const pages=await h.evaluate('ABYME.UI._reader?.pages.length');
  if(!pages)throw Error('Reader failed: '+id);
  for(let i=0;i<pages;i++)await capture(`${LORE[id].title} · ${i+1}/${pages}`,'Read this page.',i?'UI._readerPage(1)':'','',.15,'page');
  await ev('UI.closeReader()');
 }
 async function crossing(title){
  await ev(`const p=refs.deskPlate.position;ABYME.tp(p.x,p.z,.7,-.5);hs('plate').onClick()`);
  await capture(title+' · threshold','Touch the brass plate once to prepare the crossing.','','ABYME.game.atBrink()');
  await capture(title,'Complete the plate crossing; the long camera travel is skipped.',`const r=ABYME.cross();if(!r.crossed)throw Error(JSON.stringify(r))`,'',2.8);
 }
 await capture('Ashore','Begin a fresh journey. The arrival camera has been advanced to the landing.',`W.time=7.4;ABYME.tp(4,-104,2.19,-.06)`);
 await reader('bottle_note','bottle');
 await reader('stone_inscription','inscription');
 await look(-63,-64,-85,-40,.18);await capture('The western lighthouse','Follow the headland path toward the chalked tower.');
 await look(-102,-75,-105,-86,-.05);await capture('An opening in the headland','The coastal arch opens toward the sea.');
 chapter='02-east-room';await look(-82,-37,-88,-43);
 await capture('A model of this room','Enter the lighthouse study.',`W.time=11`);
 await reader('keeper_logbook','logbook');
 await room();await capture('The east room','Walk through the open inner door.');
 await reader('quarters_journal','quartersJournal');
 await capture('A lamp to return to','Light the small lamp beside the bed.',`hs('refugeLamp').onClick()`,'ABYME.W.flags.refugeLit');
 await reader('spare_place','spareChair');
 await capture('A place beside the table','The pulled-out chair remains where you left it.','','ABYME.W.flags.placeMade');
 chapter='03-the-working-model';await look(-82,-37,-85,-40,-.45);
 await capture('The sea leaves the road','Turn the model valve. Allow the tide to fall.',`hs('valve').onClick()`,'ABYME.W.flags.valveTurned',4);
 await ev('W.tide=W.tideTarget');await look(121,-173,118,-176,-.2);
 await capture('The exposed chest','Open the chest uncovered by the lower water.',`hs('chest').onClick()`,'ABYME.W.flags.chestOpen');
 await capture('The survey rule','Lift the brass ruler from the chest.',`hs('chest').onClick()`,'ABYME.W.flags.rulerTaken');
 await look(-82,-37,-85,-40,-.5);
 await capture('A bridge under your hand','Lay the ruler across the crack in the model.',`hs('crack').onClick()`,'ABYME.W.flags.rulerPlaced');
 await capture('Turn the afternoon','Drag the crank. The sky follows the small sun.',`hs('crank').onDrag(48)`,'ABYME.W.flags.crankUsed');
 await check('!ABYME.W.flags.plumbHung && !ABYME.W.flags.heardBox','The first crossing has not granted the deeper circuit');
 chapter='04-the-first-crossing';await crossing('Down to the shallows');
 await reader('kelp_slate','tideBench');
 await reader('coat_letter','coatLetter');
 await look(-82,-37,-85,-40,-.10);
 await capture('The wheel below','Try the full-size valve. It is no longer yours to turn.',`hs('valve').onClick()`,'ABYME.game.upstreamState().active',.2);
 await capture('A hand above the room','Remain by the wheel. The other hand becomes visible.','','',3.2);
 await capture('The water arrives','Watch the displaced water enter this level.','','',5.4);
 await capture('After the hand','The wheel holds the mark of the encounter.','','ABYME.W.flags.upstreamHandWitnessed',5.0);
 await ev('ABYME.tideFigure()');await capture('Someone in the kelp','Stop approaching and let the figure remain.','','',.25);
 await capture('An answer across the water','Wait without moving. The low note is earned here.','','ABYME.W.flags.tideFigureSeen',3.4);
 await crossing('Back to the lit room');
 await check('ABYME.W.flags.receiverReturned && !ABYME.W.flags.returned && !ABYME.W.flags.plumbHung','First return remains distinct from the final homecoming');
 chapter='05-listening';await room();await capture('The room kept ready','Return to the room before continuing the instrument circuit.');
 await look(-85,-40,-88.6,-42.6,-.18);await reader('music_note','musicNote');
 await capture('A song with a catch','Wind the music box and hear its five-note phrase.',`hs('musicBox').onClick()`,'ABYME.W.flags.heardBox');
 await look(135,-158,135,-152.5,-.03);
 await capture('The dawn answer','Use the crank to reach dawn; listen to the bird by the stone arc.',`W.time=6.5;W.timeDrift=0;game._birdSing()`,'ABYME.W.flags.heardBird');
 await look(135,-146,135,-152.5,-.16);
 await capture('The higher fourth note','Play E, G, A, G, C on the standing stones.',`for(const note of [2,3,4,3,0])game._touchStone(note)`,'ABYME.W.flags.birdSolved');
 await look(129.7,-149.1,126.6,-149.6,-.28);
 await capture('The opened lens shelf','Take the fitted lens from the opened outcrop.',`hs('lensItem').onClick()`,'ABYME.W.flags.lensTaken');
 chapter='05b-the-drain';await enterDrain();await reader('drain_ledger','drainLedger');await leaveDrain();
 chapter='06a-the-tower';await look(-82,-37,-85,-40,-.40);
 await capture('A light above the island','Seat the little lens in the model lighthouse.',`hs('lensSlot').onClick()`,'ABYME.W.lensPlaced');
 chapter='06a-the-tower';
 await capture('The foot of the long stair','Touch the newel, then walk the treads around the open light shaft.',`hs('climbStair').onClick()`,'ABYME.player.pos.y<14');
 let stairT=.001;
 for(const [height,title] of [[6.4,'The first window'],[11.2,'The bay from halfway up'],[16,'The high window']]){
   const next=height/20.6;await stairTo(stairT,next);stairT=next;
   await ev(`const {stairPose}=await import('/the-island/js/tower-course.js');const p=stairPose(${next});UI.clearWhispers();player.yaw=p.angle+Math.PI+.18;player.pitch=-.10;player.syncCamera()`);
   await capture(title,'Stop on the stair. The window opens onto the actual island below.');
 }
 await stairTo(stairT,1);
 await ev(`const {stairPose,TOWER}=await import('/the-island/js/tower-course.js');const p=stairPose(1);for(let r=p.radius;r<=3.18;r+=.035){const x=TOWER.x+Math.sin(p.angle)*r,z=TOWER.z+Math.cos(p.angle)*r;if(!player._step(x,z))throw Error('Balcony landing');player.pos.x=x;player.pos.z=z;player.syncCamera();}player.yaw=-1.16;player.pitch=-.24;player.syncCamera()`);
 await capture('Above the whole island','Walk out through the lantern doorway. The bay and the headland path lie below.','','ABYME.W.flags.towerVisited');
 await ev(`const {TOWER,stairPose}=await import('/the-island/js/tower-course.js');const start=stairPose(1).angle;for(let i=1;i<=140;i++){const a=start+(4.46-start%(Math.PI*2))*i/140;const x=TOWER.x+Math.sin(a)*3.15,z=TOWER.z+Math.cos(a)*3.15;if(!player._step(x,z))throw Error('Gallery rail');player.pos.x=x;player.pos.z=z;player.syncCamera();}`);
 await face(-87.8,35.15,-40.7);await reader('watch_book','towerLog');
 await ev(`hs('galleryHatch').onClick()`);await stairTo(.999,.77);
 await capture('The light shaft below your feet','Walk back down. The stair remains open if you turn around.');
 await stairTo(.77,0);await capture('Back in the study','Return down all eighty-three treads.','','Math.abs(ABYME.player.pos.y-13.5)<.01');
 chapter='06b-the-signal';await look(-82,-37,-85,-40,-.40);

 await reader('signal_shelf','lore_signal_shelf');
 await look(40,38,57.5,50,-.02);
 await capture('Four figures on the cliff','Turn to night and sweep the beam across the western cliff.',`W.time=22;W.timeDrift=0;W.beamAngle=Math.atan2(57.5-(-85),50-(-40));game.tick(.1,2)`,'ABYME.W.flags.glyphsSeen');
 await ev(`const t=hs('shimmer').targets[0];const p=new THREE.Vector3();t.getWorldPosition(p);ABYME.tp(p.x+2,p.z+2,Math.PI/4,-.6);W.time=17.8;game.tick(.1,3)`);
 await capture('The joined shadow','At late afternoon, inspect the shadow where the stones point.',`hs('shimmer').onClick()`,'ABYME.W.flags.shadowRevealed');
 await capture('The four readings','Read the tide staff, lens, filed music tooth and six stones. Set the wheels to 5, 1, 4, 6.',`for(let i=0;i<4;i++){const n=(ABYME.HATCH_CODE[i]-W.dials[i]+10)%10;for(let j=0;j<n;j++)hs('dial'+i).onClick()}`,'ABYME.W.flags.hatchOpen');
 chapter='06c-beneath-the-bluff';
 await look(97,32.7,97,23,-.32);await capture('The open hatch','Step into the lit stair beneath the bluff.');
 await walkTo(97,27);await capture('The cellar stair','Descend beneath the surface along the actual stair.');
 await walkTo(97,18.6);await face(127,22,18.4);
 await capture('The inverted lighthouse','Look through the east arch. The lighthouse hangs above the dark water.','','ABYME.player.pos.y===18.3');
 await walkTo(89.8,18.6);await face(85.8,19.2,21.1);
 await capture('Through the western doorway','Enter the second study, past the two low stone steps.','','ABYME.player.pos.y===17.5');
 await walkTo(89.8,20.35);await face(88.4,18.95,21.56);
 await capture('The drying table','Open the bread tin among the sheets weighted with stones.',`hs('archiveTin').onClick()`,'ABYME.W.flags.archiveTinOpened',.5,'page');
 await ev('UI.closeReader()');await reader('drying_papers','archiveTin');
 await face(86.3,19,22);await capture('Leave the lid loose','The lid stays open beside the damp papers.');
 await walkTo(89.8,18.6);await walkTo(97,18.6);await face(97,19.5,18.5);
 await capture('The line in the cellar','Take the plumb weight from its pedestal.',`hs('plumb').onClick()`,'ABYME.W.flags.plumbTaken');
 await walkTo(97,32.7);await capture('Daylight at the hatch','Walk all the way back to the surface.');
 chapter='06d-the-line';
 await look(-82,-37,-85,-40,-.35);
 await capture('A longer crossing','Hang the line on the model hook.',`hs('hook').onClick()`,'ABYME.W.flags.plumbHung');
 chapter='07-the-other-hands';await crossing('Down again');
 await check('ABYME.W.flags.tideFigureSeen && ABYME.W.flags.upstreamHandWitnessed','The shallows remember the first visit');
 await crossing('The old hall');
 await look(-86.4,-39.3,-85,-40,-.35);await capture('People took a watch','Remain beside the study register.','','ABYME.W.flags.registerRead',2.2);
 await reader('keeper_logbook','logbook');
 await look(12,-92,4,-111,-.08);await capture('The drowned hall','Walk to the shore. The old capitals stand in the changed water.');
 await enterDrain();await capture('Water in the room','Return to the drain chamber after descending. The rising water has reached the shelves.');await reader('drain_ledger','drainLedger');await leaveDrain();await look(-82,-37,-85,-40,-.3);
 await reader('commendation_copy','lore_commendation_copy');
 await room();await reader('quarters_journal','quartersJournal');
 await ev('ABYME.tp(24,-88,0,0);ABYME.watcher("spawn")');
 await capture('The shore visitor','Look toward the figure instead of chasing it.');
 await capture('The visitor looks up','Hold the view until the encounter resolves.','','ABYME.W.flags.watcherSeen',3.2);
 chapter='08-the-unfinished-boat';await crossing('The lowest room');
 await look(-81.7,-40.8,-82.8,-42.8,-.35);await reader('source_note','sourceCradle');
 await reader('transfer_offer','lore_transfer_offer');await reader('closure_notice','lore_closure_notice');
 // Approach the actual figure without the debug bottom() helper's level mutation.
 await ev(`const p=new THREE.Vector3();game.modelRefs.tinyFigure.getWorldPosition(p);ABYME.tp(p.x+.8,p.z+.8,Math.PI/4,-.5)`);
 await capture('Beside the small figure','Remain near the lower model and look toward the waiting figure.');
 await capture('Hands at rest','Stay still long enough for the figure to turn.','','ABYME.W.flags.lowerHandRegarded',3.0);
 await capture('Four ways to leave the water','Read the physical operation selected by the brass index.',`hs('dispSet').onClick()`,'ABYME.W.flags.dispositionChosen');
 const checkpoint=await h.evaluate(`({save:localStorage.getItem('abyme-save'),ledger:localStorage.getItem('abyme-ledger-v2')})`);
 writeFileSync(join(dir,'source-checkpoint.json'),JSON.stringify(checkpoint,null,2));
 for(const [choice,touches] of [['tend',0],['carry',1],['open',2],['close',3]]){
  if(choice!=='tend'){
   await h.evaluate(`localStorage.setItem('abyme-save',${JSON.stringify(checkpoint.save)});localStorage.setItem('abyme-ledger-v2',${JSON.stringify(checkpoint.ledger)});1`);
   await h.navigate(url);await ready();await setup();await ev(`document.getElementById('btn-continue').click()`);await h.wait(1.4);
  }
  chapter=choice==='tend'?'09-homecoming':`ending-${choice}`;
  if(touches)await capture('Choose '+choice,'Turn the four-stop index to this operation.',`for(let i=0;i<${touches};i++)hs('dispSet').onClick()`,`ABYME.W.disposition===${JSON.stringify(choice)}`);
  for(const name of ['The old hall above','Through the shallows','The original study'])await crossing(name);
  await check('ABYME.W.flags.returned && ABYME.notebook.has("return.surface")','Earned final return');
  await room();await capture('The east room again','Return with the chosen operation. The lamp is the final threshold.');
  if(choice==='tend'){
   await capture('The little boat in your hand','Take the stitched boat from beside the cups.',`hs('keepsakeBoat').onClick()`,'ABYME.W.flags.boatCarried');
   await look(-82,-37,-85,-40,-.55);
   await capture('It floats','Set the boat in the model sea.',`hs('launchBoat').onClick()`,'ABYME.W.flags.boatLaunched');
   await look(4,-94,28,-165,-.04);await capture('Across the bay','Look offshore. The same blue-stitched hull floats at the island’s scale.');
   await look(-82,-37,-85,-40,-.55);await reader('boat_return','boatAfterword');
   const saved=await h.evaluate(`localStorage.getItem('abyme-save')`);writeFileSync(join(dir,'homecoming-save.json'),saved);
   // Verify that the payoff is really restored, then continue from the same save.
   await h.navigate(url);await ready();await setup();await ev(`document.getElementById('btn-continue').click()`);await h.wait(1.6);
   await check('ABYME.W.flags.boatLaunched && !ABYME.W.flags.boatCarried && ABYME.W.flags.placeMade','Homecoming survives reload');
  }
  chapter=`ending-${choice}`;await room();
  await ev(`const q=refs.cotLantern.parent;const p=q.localToWorld(new THREE.Vector3(-.65,0,-.1));const t=new THREE.Vector3();refs.cotLantern.getWorldPosition(t);ABYME.tp(p.x,p.z,Math.atan2(p.x-t.x,p.z-t.z),-.55)`);
  await capture('The last touch · '+choice,'Touch the refuge lamp once to review the operation.',`hs('refugeLamp').onClick()`,'ABYME.game.atBrink()');
  await capture('The room · '+choice,'Touch the lamp again to commit this ending.',`hs('refugeLamp').onClick()`,'ABYME.W.flags.endingCommitted',.6);
  await capture('The changed shore · '+choice,'The ending camera shows the physical result.',`ABYME.setFinaleT(9.4)`,'',.35);
  await capture('Afterward · '+choice,'The final words, after the physical result is visible.',`ABYME.setFinaleT(12)`,'ABYME.getFinale().shown',.5);
 }
 const manuscript={lore:LORE,keeper:KEEPER,cues:T,fieldNotes:Object.fromEntries(Object.entries(FIELD_NOTES).filter(([,v])=>typeof v.text==='string')),climbers:CLIMBERS,hall:CONGREGATION,lampblack:LAMPBLACK};
 writeFileSync(join(dir,'manuscript.json'),JSON.stringify(manuscript,null,2));
 writeFileSync(join(dir,'manuscript.md'),Object.entries(LORE).map(([id,l])=>`## ${l.title}\n\nVoice: ${l.hand}. Artifact: ${id}.\n\n${l.pages.join('\n\n---\n\n')}${l.deep?.length?'\n\n### Pages revealed below\n\n'+l.deep.join('\n\n---\n\n'):''}`).join('\n\n'));
 execFileSync('python3',[fileURLToPath(new URL('./review-audit.py',import.meta.url)),dir],{stdio:'inherit'});
 const audited=JSON.parse(readFileSync(join(dir,'stages.json'),'utf8'));
 writeFileSync(join(dir,'index.html'),renderPlaythrough({...audited,manuscript}));
 writeFileSync(join(dir,'README.md'),`# The Island — complete playthrough\n\nOpen index.html. ${stages.length} captured stages include the physical tower climb, drain chamber, cellar, western study, and the complete causal route and four endings from one earned source checkpoint.\n\n${METHOD}\n\nEvery image was captured from this build in Chromium at 1440 × 900. Stages record actual displayed text, flags, notebook evidence and camera position. manuscript.md and manuscript.json include all readable pages, including optional pages absent from the main route. source-checkpoint.json and homecoming-save.json allow exact replay in an isolated browser.\n`);
 console.log(`PLAYTHROUGH COMPLETE: ${stages.length} stages, four endings, zero browser errors. ${dir}`);
}
const METHOD='Scripted playthrough using the game’s real hotspot callbacks and crossing gates. Walking between scenes and long crossing cameras are skipped through the public debug capture API. Queued travel whispers are cleared at accelerated camera changes. The sun is advanced to puzzle hours; actor placement uses encounter fixtures, while stillness and regard run in the live game. No progression flags or puzzle answers are granted. The tower stair and underground connectors run through the actual player collision code in both directions. The opening, first return, final return, boat launch, persistence and all four endings are checked. This is a route audit with screenshots, not a recording of an uninterrupted manual play session.';
