import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { startResearch, RESEARCH, tickProgression, pauseResearch, cancelResearch, setResearchAllocation, fundResearch } from '../js/progression.js';
import { researchProductionShare, receiveResearchProduction } from '../js/research-projects.js';
import { researchHUD } from '../js/research-hud.js';
const project=()=>{const s=sim.createGame();startResearch(s,'joinery');return s;};
test('allocation takes only the selected fraction of new output and caps at stage needs',()=>{
 const s=project(),stock={...s.resources};assert.equal(s.research.active.allocation,25);
 for(const pct of [0,25,50,100]){setResearchAllocation(s,pct);const share=researchProductionShare(s,RESEARCH.joinery,'wood',4,100);assert.equal(share.produced,4);assert.equal(share.research,4*pct/100);}
 setResearchAllocation(s,100);const share=researchProductionShare(s,RESEARCH.joinery,'wood',50,100);assert.equal(share.research,6);receiveResearchProduction(s,'wood',share.research);
 assert.equal(researchProductionShare(s,RESEARCH.joinery,'wood',20,100).research,0);assert.equal(researchProductionShare(s,RESEARCH.joinery,'iron',20,100).research,0);assert.deepEqual(s.resources,stock);
});
test('100% allocation can fill research when stores are full, other shares respect room for their remainder',()=>{
 const s=project();setResearchAllocation(s,100);assert.deepEqual(researchProductionShare(s,RESEARCH.joinery,'wood',20,0),{produced:6,research:6});
 setResearchAllocation(s,50);assert.deepEqual(researchProductionShare(s,RESEARCH.joinery,'wood',20,2),{produced:4,research:2});
});
test('pausing stops collection, stage changes keep allocation and unfinished materials refund exactly once',()=>{
 const s=project();setResearchAllocation(s,50);pauseResearch(s,true);assert.equal(researchProductionShare(s,RESEARCH.joinery,'wood',4,100).research,0);
 pauseResearch(s,false);s.resources.knowledge=100;fundResearch(s);tickProgression(s,25,{researchRate:1});assert.equal(s.research.active.stage,1);assert.equal(s.research.active.allocation,50);
 const stock={...s.resources};receiveResearchProduction(s,'wood',.75);cancelResearch(s);assert.equal(s.resources.wood,stock.wood+.75);assert.equal(cancelResearch(s).ok,false);
});
test('simulation allocates and depletes the same actual output; pause and save partitions are deterministic',()=>{
 const s=project();setResearchAllocation(s,100);const wood=s.resources.wood,delivered=s.research.active.delivered.wood||0;
 sim.tick(s,3);assert.equal(s.resources.wood,wood);assert.ok(s.research.active.delivered.wood>delivered);
 const a=sim.restore(sim.serialize(s)),b=sim.restore(sim.serialize(s));sim.tick(a,10);for(let i=0;i<40;i++)sim.tick(b,.25);
 assert.deepEqual(a.research,b.research);assert.deepEqual(a.resources,b.resources);
 const before={...a.research.active.delivered};pauseResearch(a,true);sim.tick(a,1);assert.deepEqual(a.research.active.delivered,before);
});
test('old paid and manual projects retain their previous behavior, invalid percentages are rejected',()=>{
 const s=project();delete s.research.active.allocation;assert.equal(sim.restore(sim.serialize(s)).research.active.allocation,0);
 s.research.active.allocation=33;assert.equal(sim.restore(sim.serialize(s)),null);
 delete s.research.active.fundingVersion;delete s.research.active.allocation;const old=sim.restore(sim.serialize(s));assert.equal(old.research.active.fundingVersion,0);assert.equal(setResearchAllocation(old,100).ok,false);
 assert.equal(setResearchAllocation(project(),-25).ok,false);
});
test('HUD distinguishes funding, staffing, paused time, and progress',()=>{
 const s=project();assert.equal(researchHUD(s,true).status,'time');assert.equal(researchHUD(s,true).detail,'Time paused');assert.equal(researchHUD(s).status,'supplies');assert.equal(researchHUD(s).detail,'Allocating 25%');
 s.resources.knowledge=100;fundResearch(s);assert.equal(researchHUD(s).status,'workers');
 s.buildings.push({type:'school',status:'ready',production:{efficiency:1}});assert.equal(researchHUD(s,true).status,'time');assert.equal(researchHUD(s).status,'working');
 pauseResearch(s,true);assert.equal(researchHUD(s).status,'paused');s.research.active=null;assert.equal(researchHUD(s).status,'idle');
});

test('HUD stops offering another project after every discovery is learned',()=>{
 const s=sim.createGame();s.research.completed=Object.keys(RESEARCH);
 assert.equal(researchHUD(s).status,'complete');assert.equal(researchHUD(s).title,'Research complete');
 s.research.completed.pop();assert.equal(researchHUD(s).status,'idle');
});
