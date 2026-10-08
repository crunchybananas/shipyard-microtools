import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,listTiles,canBuild,tick,pauseBuilding,setBuilderTarget,constructionQueue,serialize,restore} from '../js/sim.js';
import {constructionFeedback} from '../js/clarity.js';
function place(state,type){for(const tile of listTiles())for(let rotation=0;rotation<4;rotation++){if(!canBuild(state,type,tile.x,tile.z,rotation).ok)continue;return build(state,type,tile.x,tile.z,rotation).building}assert.fail('No site for '+type)}
test('construction summary follows the working project past a paused first site',()=>{
 const state=createGame(),first=place(state,'cottage');pauseBuilding(state,first.id,true);const active=place(state,'garden');tick(state,4);
 assert.equal(first.progress,0);assert.ok(active.progress>0);assert.equal(active.workerIds.length,2);
 const before=serialize(state),feedback=constructionFeedback(state,constructionQueue(state));
 assert.equal(feedback.activeId,active.id);assert.match(feedback.summary,new RegExp(Math.round(active.progress/active.workRequired*100)+'%'));assert.doesNotMatch(feedback.summary,/ · 0%$/);assert.equal(serialize(state),before);
});
test('paused clock reports the actual assigned crew without advancing or reallocating',()=>{
 const state=createGame(),site=place(state,'cottage'),before=serialize(state);
 const feedback=constructionFeedback(state,constructionQueue(state),{paused:true});
 assert.equal(feedback.ready,2);assert.match(feedback.summary,/time paused/);assert.match(feedback.reason,/Time is paused/);assert.equal(site.progress,0);assert.equal(serialize(state),before);
 const returned=restore(before);assert.deepEqual(constructionFeedback(returned,constructionQueue(returned),{paused:true}),feedback);
});
test('a paused site and a zero requested crew are distinct from paused time',()=>{
 const state=createGame(),site=place(state,'cottage');pauseBuilding(state,site.id,true);
 let feedback=constructionFeedback(state,constructionQueue(state),{paused:true});assert.equal(feedback.ready,0);assert.match(feedback.summary,/sites paused/);
 pauseBuilding(state,site.id,false);setBuilderTarget(state,0);feedback=constructionFeedback(state,constructionQueue(state));
 assert.equal(feedback.ready,0);assert.match(feedback.reason,/crew is set to zero/);assert.match(feedback.summary,/no crew requested/);
});
test('unavailable civilian crew never points to an imaginary earlier project or promises ready builders',()=>{
 const state=createGame(),site=place(state,'cottage');
 // Presentation fixture for an older reserved-workforce save; no reassigning
 // soldiers or introducing an automatic recruitment policy.
 const queue=constructionQueue(state).map(row=>({...row,workers:0}));
 const feedback=constructionFeedback(state,queue);assert.equal(feedback.activeId,site.id);assert.equal(feedback.ready,0);assert.match(feedback.reason,/Company or on fieldwork/);assert.doesNotMatch(feedback.reason,/ahead|earlier/);
});
