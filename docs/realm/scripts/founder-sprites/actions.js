// Authored beats share a settled pose so a gesture can return to a living idle.
export const FOUNDER_ACTIONS = Object.freeze({
  walk: {label:'Walk', clip:'Realm_Grounded_Walk', source:'Walking_B', frames:24, duration:1.0666667222976685,
    description:'A continuous stride with level boots and a clean swing.',
    beats:[[0,'Left contact'],[8,'Right passing'],[12,'Right contact'],[20,'Left passing']]},
  idle: {label:'Take stock', clip:'Realm_Take_Stock', source:'Founder_Idle', frames:48, duration:4,
    description:'Breathe, shift the shoulders, and quietly survey the settlement.',
    beats:[[0,'Settle'],[12,'Breathe in'],[24,'Look across'],[36,'Exhale']]},
  point: {label:'Work over there', clip:'Realm_Direct_Work', source:'Founder_Point', frames:48, duration:3.2,
    description:'Look first. Gather the hand. Indicate the work. Let the arm settle.',
    beats:[[0,'Ready'],[7,'Look & gather'],[17,'Indicate'],[28,'Hold the direction'],[39,'Recover']]},
  beckon: {label:'Come with me', clip:'Realm_Beckon', source:'Founder_Beckon', frames:48, duration:3.2,
    description:'Catch someone’s eye, then invite them over with two easy sweeps.',
    beats:[[0,'Ready'],[10,'Catch the eye'],[20,'First invitation'],[30,'Again'],[40,'Settle']]},
});
export function actionTiers(action,tiers){return tiers.map(t=>({...t,file:t.file.replace('walk-',`${action}-`)}));}
export function actionFrame(phase,action='walk'){
  const frames=FOUNDER_ACTIONS[action].frames;
  return Math.floor((phase-Math.floor(phase))*frames+1e-9)%frames;
}
