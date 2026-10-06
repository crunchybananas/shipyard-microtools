// Exercise the actual tutorial state/UI source without a browser or renderer.
// DOM adapters capture guidance; production commands and visuals are covered
// separately by verify-opening-build-tutorial-browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/ui.js', import.meta.url),'utf8');
const tutorial=source.slice(source.indexOf('const TUTORIAL_STEPS = ['),source.indexOf('export function dismissTutorial()')).replaceAll('export function','function');
function run({buildings=[],selectedBuild=null,step=0,acknowledged=true,day=1,speed=1,techs=['agriculture','forestry'],research=null,researchOpen=false}={}) {
 const tip={style:{},innerHTML:'',querySelector:()=>null};
 const G={buildings,selectedBuild,day,population:3,scenario:'peaceful',speed,researchedTechs:new Set(techs),currentResearch:research,gameTick:0};
 const panel={style:{display:researchOpen?'flex':'none'}};
 const ctx=vm.createContext({G,document:{getElementById:id=>id==='research-panel'?panel:tip,querySelectorAll:()=>[],querySelector:()=>null},getResearchProgress:()=>research?{name:'Masonry',fraction:0.5}:null,authoredBuildingCount:g=>g.buildings.length,getActiveScenario:()=>({raidStart:7}),dismissTutorial:()=>{}});
 vm.runInContext(tutorial,ctx);
 vm.runInContext(`tutorialStep=${step};tutorialWelcomeAcknowledged=${acknowledged};updateTutorialTip()`,ctx);
 return tip.innerHTML;
}
assert.match(run({acknowledged:false}),/Show me how/,'welcome requires acknowledgment');
assert.match(run(),/Select Farm from the build bar/,'unbuilt farm retains guidance');
assert.match(run({step:2}),/Select Farm from the build bar/,'cancel unplaced farm restores selection');
assert.match(run({selectedBuild:'farm'}),/Click a grass tile/,'selected farm advances to placement');
assert.match(run({buildings:[{type:'farm'}]}),/Select Lumber Mill/,'an existing farm skips redundant selection and placement');
assert.match(run({buildings:[{type:'farm'}],step:2}),/Select Lumber Mill/,'cancel after successful placement preserves completed farm guidance');
console.log('[opening-tutorial-state] PASS — welcome, selection, cancellation, placement and already-built progression');

const opening=[{type:'farm',buildProgress:1},{type:'lumber',buildProgress:1}];
assert.match(run({buildings:opening,day:2}),/Give your settlers a home/,'shelter precedes research');
assert.match(run({buildings:[...opening,{type:'house',buildProgress:0.5}],speed:0}),/50% built[\s\S]*Resume time/,'unfinished home describes progress and pause');
const home=[...opening,{type:'house',buildProgress:1,level:1}];
assert.match(run({buildings:home,day:2}),/Open the Research panel/);
assert.match(run({buildings:home,day:2,researchOpen:true}),/Choose an available Research button/,'open panel is acknowledged');
assert.match(run({buildings:home,day:2,research:{techId:'masonry'},speed:0}),/50% researched[\s\S]*Resume time/,'active paused research is explained');
const masonry=['agriculture','forestry','masonry'];
assert.match(run({buildings:home,day:2,techs:masonry}),/place it beside your House/,'Masonry gets a tangible next step');
assert.match(run({buildings:[...home,{type:'well',buildProgress:1}],day:6,techs:masonry}),/Inspect your House/,'active guidance survives the fourth building and day six');
assert.match(run({buildings:[...opening,{type:'house',buildProgress:1,level:2}],day:2,techs:masonry}),/neighborhood is taking shape/,'Cottage completes the opening reward');
assert.match(run({buildings:home,day:2,techs:['agriculture','forestry','husbandry']}),/neighborhood is taking shape/,'another first discovery does not require locked Wells');
console.log('[opening-tutorial-state] PASS — home, research, pause, first upgrade and alternate discovery');
