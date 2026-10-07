import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, serialize } from '../js/sim.js';
import { firstBreadStep } from '../js/bread-guide.js';
import { nextPathResearch } from '../js/path-choice.js';
function town() {
 const state=createGame();state.won=true;state.guidance.goal='first_bread';
 Object.assign(state.resources,{wood:100,stone:100,knowledge:100,planks:14});return state;
}
function workplace(state,type,changes={}) {const b={id:type,type,status:'ready',level:1,paused:false,desiredWorkers:2,workerIds:['c1'],production:{efficiency:.5},...changes};state.buildings.push(b);return b;}

test('first-bread guidance is opt-in, waits for bell foundations and never mutates the town',()=>{
 const state=town();state.guidance.goal=null;assert.equal(firstBreadStep(state),null);
 state.guidance.goal='first_bread';state.won=false;assert.equal(firstBreadStep(state),null);
 state.won=true;const before=serialize(state);assert.equal(firstBreadStep(state).type,'school');assert.equal(serialize(state),before);
});
test('a paused town gets a useful resource-wait action, without preventing affordable building',()=>{
 const state=town();state.resources.wood=14.58;
 const wait=firstBreadStep(state,{paused:true,daily:{wood:19.18}});assert.equal(wait.resume,true);assert.match(wait.description,/3.5 more timber/);
 const running=firstBreadStep(state,{daily:{wood:19.18}});assert.equal(running.resource,'wood');assert.equal(running.resume,undefined);
 state.resources.wood=18;assert.equal(firstBreadStep(state,{paused:true}).type,'school');
});
test('staffing shortages, zero requested workers and paused construction lead to their real controls',()=>{
 const state=town(),school=workplace(state,'school',{workerIds:[]});
 assert.equal(firstBreadStep(state).workforceId,'school');
 school.desiredWorkers=0;assert.equal(firstBreadStep(state).buildingId,'school');
 school.status='building';school.paused=true;school.progress=4;school.workRequired=45;
 const project=firstBreadStep(state,{paused:true});assert.equal(project.tab,'construction');assert.equal(project.resume,undefined);
 school.paused=false;state.builderTarget=0;assert.equal(firstBreadStep(state).tab,'workforce');
});
test('unrelated active research is never replaced with an impossible second project',()=>{
 const state=town();workplace(state,'school');state.research.active={id:'barter',progress:10};
 const result=firstBreadStep(state);assert.equal(result.researchId,'barter');assert.match(result.description,/Finish your current project first/);
 assert.equal(nextPathResearch(state),'barter');
});
test('discoveries hand off to actual workplaces and full intermediate stores allow the next consumer',()=>{
 const state=town();workplace(state,'school');assert.equal(firstBreadStep(state).researchId,'joinery');
 state.research.completed=['joinery'];state.resources.planks=0;assert.equal(firstBreadStep(state).type,'sawmill');workplace(state,'sawmill');
 assert.equal(firstBreadStep(state).researchId,'cultivation');state.research.completed.push('cultivation');assert.equal(firstBreadStep(state).type,'farm');
 workplace(state,'farm',{production:{efficiency:0,blockedReason:'Storage full'}});assert.equal(firstBreadStep(state).researchId,'milling');
 state.research.completed.push('milling');state.resources.planks=14;assert.equal(firstBreadStep(state).type,'windmill');
 workplace(state,'windmill',{production:{efficiency:0,blockedReason:'Storage full'}});assert.equal(firstBreadStep(state).type,'bakery');
});
test('forecast production cannot complete the guide; durable actual proof can',()=>{
 const state=town();state.research.completed=['joinery','cultivation','milling'];for(const type of ['school','farm','windmill','bakery'])workplace(state,type);
 assert.equal(firstBreadStep(state,{paused:true}).resume,true);assert.equal(firstBreadStep(state).finishGoal,undefined);
 state.guidance.firstBread={day:1,buildingId:'bakery'};assert.equal(firstBreadStep(state).finishGoal,true);
});

test('empty input stores never promise that resuming a stalled supply chain will fix it',()=>{
 const state=town();workplace(state,'school',{production:{efficiency:0,blockedReason:'Needs food'}});
 const stalled=firstBreadStep(state,{paused:true,daily:{food:-2}});assert.equal(stalled.resume,undefined);assert.equal(stalled.tab,'workforce');
 const supplying=firstBreadStep(state,{paused:true,daily:{food:4}});assert.equal(supplying.resume,true);
});
test('resource counters never round an unaffordable stock up to the full cost',()=>{
 const state=town();state.resources.wood=17.94;
 const step=firstBreadStep(state,{daily:{wood:10}});assert.equal(step.type,undefined);assert.match(step.count,/17.9 \/ 18/);assert.match(step.count,/First bread/);
 state.resources.wood=17.999995;assert.equal(firstBreadStep(state,{daily:{wood:10}}).type,undefined);
});
