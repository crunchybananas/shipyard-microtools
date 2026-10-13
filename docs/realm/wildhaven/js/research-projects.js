import { RESOURCES } from './catalog.js';

const MATERIALS = {
 cultivation:{wood:9,food:12}, joinery:{wood:18,stone:9}, barter:{wood:9,food:9}, civic_order:{wood:9,stone:9},
 milling:{grain:18,planks:9,stone:12}, textiles:{wood:12,food:12,planks:6}, metallurgy:{stone:18,wood:18,planks:9},
 logistics:{planks:18,stone:12}, watchkeeping:{wood:12,food:18}, brewing:{grain:24,wood:12},
 public_health:{cloth:12,food:18}, coastal_routes:{planks:18,cloth:6}, mastercraft:{iron:12,planks:24,cloth:9},
 town_charter:{planks:24,stone:24,cloth:12}, navigation:{planks:24,cloth:12,iron:9},
 husbandry:{grain:18,wood:18,food:12}, prospecting:{stone:24,ore:12,planks:12}, husbandry_care:{grain:30,cloth:9,planks:18},
};
const TASKS = {
 cultivation:['Collect soil and seeds','Grow a trial crop','Plan the fields'],
 joinery:['Select and season timber','Test the joints','Draw the framing plans'],
 husbandry:['Prepare feed and shelter','Study animal care','Plan the first smallholdings'],
 prospecting:['Compare rock samples','Test a deeper seam','Map the working faces'],
 husbandry_care:['Test winter rations','Improve the shelters','Write the breeding records'],
};
const round=n=>Math.round(n*1e6)/1e6;
export function researchPlan(id,spec){
 const total={...spec.cost,...MATERIALS[id]},names=TASKS[id]||['Gather materials','Test the method','Prepare the plans'];
 return names.map((name,i)=>({name,work:spec.duration/3,cost:Object.fromEntries(Object.entries(total).map(([k,n])=>[k,Math.floor(n/3)+(i<n%3?1:0)]).filter(([,n])=>n>0))}));
}
export function restoreResearchProject(active,spec,day){
 const progress=Math.max(0,Math.min(spec.duration,Number.isFinite(active.progress)?active.progress:0));
 const common={id:active.id,progress,duration:spec.duration,startedDay:Math.max(1,Number.isInteger(active.startedDay)?active.startedDay:day)};
 // Already-paid projects from earlier releases finish under their old terms.
 if(active.fundingVersion===undefined||active.fundingVersion===0)return {...common,fundingVersion:0};
 if(!Number.isFinite(active.progress)||active.progress<0||active.progress>spec.duration)throw Error('Invalid research work');
 const plan=researchPlan(active.id,spec),stage=active.stage;
 if(active.fundingVersion!==1||!Number.isInteger(stage)||stage<0||stage>2||typeof active.paused!=='boolean'||!active.delivered||typeof active.delivered!=='object'||Array.isArray(active.delivered))throw Error('Invalid research project');
 if(progress+1e-6<stage*spec.duration/3||progress>(stage+1)*spec.duration/3+1e-6)throw Error('Invalid research progress');
 for(const[k,n]of Object.entries(active.delivered))if(!Object.hasOwn(plan[stage].cost,k)||!Number.isFinite(n)||n<0||n>plan[stage].cost[k])throw Error('Invalid research supplies');
 return {...common,fundingVersion:1,stage,paused:active.paused,delivered:{...active.delivered}};
}
export function researchFunding(state,spec){
 const a=state.research.active;if(!a||a.id!==spec.id)return null;
 const plan=researchPlan(a.id,spec),stage=a.stage||0,step=plan[stage];
 const missing=a.fundingVersion===0?{}:Object.fromEntries(Object.entries(step.cost).map(([k,n])=>[k,round(n-(a.delivered[k]||0))]).filter(([,n])=>n>1e-6));
 const contribution=Object.fromEntries(Object.entries(missing).map(([k,n])=>[k,Math.min(n,state.resources[k]||0)]).filter(([,n])=>n>1e-6));
 return {plan,stage,name:step.name,missing,contribution,funded:!Object.keys(missing).length,legacy:a.fundingVersion===0,paused:!!a.paused,delivered:a.delivered||{},stageProgress:a.fundingVersion===0?a.progress/a.duration:Math.max(0,(a.progress-stage*a.duration/3)/(a.duration/3))};
}
export function contributeResearch(state,spec){
 const funding=researchFunding(state,spec);if(!funding)return {ok:false,reason:'Choose a research project first.'};
 if(!Object.keys(funding.contribution).length)return {ok:false,reason:funding.funded?'This stage already has its supplies.':'Make or trade for the missing supplies first.'};
 for(const[k,n]of Object.entries(funding.contribution)){state.resources[k]=round(state.resources[k]-n);state.research.active.delivered[k]=round((state.research.active.delivered[k]||0)+n);}
 return {ok:true,reason:'Supplies set aside for this research stage.',contribution:funding.contribution};
}
export function cancelResearchProject(state){
 const a=state.research.active;if(!a)return {ok:false,reason:'There is no active project.'};
 const refund=a.fundingVersion===1?a.delivered:{};
 for(const[k,n]of Object.entries(refund))if(RESOURCES[k].physical&&(state.resources[k]||0)+n>(state.storage?.[k]??Infinity))return {ok:false,reason:`Make room for ${n} ${RESOURCES[k].name.toLowerCase()} before returning the supplies.`};
 for(const[k,n]of Object.entries(refund))state.resources[k]=round((state.resources[k]||0)+n);
 state.research.active=null;return {ok:true,reason:'Research stopped. Unused stage supplies returned; finished experiments are spent.',refund};
}
