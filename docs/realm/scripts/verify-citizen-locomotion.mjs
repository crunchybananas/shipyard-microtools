#!/usr/bin/env node
import assert from 'node:assert/strict';
import {G} from '../js/state.js?realm=198';
import {sampleCitizenMotion,sampleActorMotion,resetCitizenRenderCache,inspectCitizenRenderCache} from '../js/citizen-render-cache.js?realm=198';
globalThis.location ||= new URL('http://127.0.0.1/index.html');
const {actorAnimationFrame}=await import('../js/render.js?realm=198');
const citizen=(actorId,x=4,y=5)=>Object.freeze({presentationKind:'citizen',actorId,x,y,previousX:x,previousY:y,pathActive:true});
const sample=(c,tick,action='walk')=>{
  G.gameTick=tick;G._renderAlpha=1;
  return actorAnimationFrame(c,'settler',action,{isMoving:true});
};

resetCitizenRenderCache();
const blocked=citizen(1),before=structuredClone(blocked);
const blockedFrames=[];
for(let tick=0;tick<=112;tick++)blockedFrames.push(sample(blocked,tick));
assert.deepEqual([...new Set(blockedFrames)],[0],'A blocked route cycles its walk frames');
assert.deepEqual(blocked,before,'Animation modified the immutable citizen');

function travel(id,{ticks,framesPerTick=1,distance=.7,pauseAt=-1}){
  resetCitizenRenderCache();
  sampleCitizenMotion(citizen(id),{x:4,y:5},0);
  const frames=[],phases=[];
  for(let frame=1;frame<=ticks*framesPerTick;frame++){
    const t=frame/framesPerTick;
    const c=citizen(id,4+distance*t/ticks,5);
    const motion=sampleCitizenMotion(c,c,t);
    frames.push(actorAnimationFrame(c,'settler','walk',{motion,isMoving:true}));
    phases.push(motion.phase);
    if(frame===pauseAt){
      const held=motion.phase;
      for(let repeat=0;repeat<40;repeat++)assert.equal(sampleCitizenMotion(c,c,t).phase,held,'Repeated paused draws advance the gait');
    }
  }
  return {frames,phase:phases.at(-1)};
}
const fast=travel(2,{ticks:35,pauseAt:15});
const slow=travel(3,{ticks:140});
const highRefresh=travel(4,{ticks:35,framesPerTick:4});
assert.ok(new Set(fast.frames).size>=4,'Walking never advances its feet');
assert.ok(Math.abs(fast.phase-slow.phase)<1e-10,'Equal travel produces different gait at a different speed');
assert.ok(Math.abs(fast.phase-highRefresh.phase)<1e-10,'Display refresh rate changes gait distance');
assert.deepEqual(highRefresh.frames.filter((_,i)=>i%4===3),fast.frames,'High-refresh interpolation changes contact frames');

resetCitizenRenderCache();
let c=citizen(5);sampleCitizenMotion(c,c,0);
c=citizen(5,4.22,5);const walking=sampleCitizenMotion(c,c,7),phase=walking.phase;
assert.ok(walking.moving);
assert.equal(sampleCitizenMotion(c,c,9).phase,phase,'A short route gap runs the feet in place');
assert.ok(sampleCitizenMotion(c,c,9).moving,'A short route gap changes the animation row');
const rested=sampleCitizenMotion(c,c,14);
assert.equal(rested.moving,false);
assert.ok(rested.phase===0||rested.phase===.5,'A long wait leaves an airborne contact pose');
const carry=[];
for(let tick=14;tick<70;tick++)carry.push(sample(c,tick,'carry'));
assert.equal(new Set(carry).size,1,'Stationary cargo keeps walking');

const prior=inspectCitizenRenderCache()[0].motion.phase;
c=citizen(5,4.36,5);sampleCitizenMotion(c,c,71);
assert.ok(inspectCitizenRenderCache()[0].motion.phase>prior,'Resuming from a wait does not advance the gait');
c=citizen(5,30,30);const teleported=sampleCitizenMotion(c,c,72);
assert.equal(teleported.phase,0,'A teleport becomes a giant stride');
assert.equal(teleported.moving,false);
assert.equal(sampleCitizenMotion(c,c,1).phase,0,'A rewound clock retains an old gait');
sampleCitizenMotion(citizen(5,30.7,30),{x:30.7,y:30},10);
const reappeared=sampleCitizenMotion(citizen(5,30.7,30),{x:30.7,y:30},100);
assert.equal(reappeared.phase,0,'Reappearing after culling replays an unseen stride');
assert.equal(reappeared.moving,false);
assert.equal(Object.isFrozen(inspectCitizenRenderCache()[0].motion),true);

const fallbackRecord={motion:null},fallback=Object.freeze({x:4,y:5});
const citizensBeforeFallback=inspectCitizenRenderCache().length;
sampleActorMotion(fallbackRecord,fallback,fallback,0);
assert.equal(sampleActorMotion(fallbackRecord,fallback,{x:4.14,y:5},7).moving,true);
assert.equal(inspectCitizenRenderCache().length,citizensBeforeFallback,'Founder fallback entered the citizen ID cache');

console.log('[citizen locomotion] PASS — actual distance drives gait; blocked routes and cargo hold; planted waits; speed/refresh independence; pause, teleport and immutable state');
