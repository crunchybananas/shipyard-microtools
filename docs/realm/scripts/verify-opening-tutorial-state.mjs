// Exercise the actual tutorial state/UI source without a browser or renderer.
// DOM adapters capture guidance; production commands and visuals are covered
// separately by verify-opening-build-tutorial-browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/ui.js', import.meta.url),'utf8');
const tutorial=source.slice(source.indexOf('const TUTORIAL_STEPS = ['),source.indexOf('export function dismissTutorial()')).replaceAll('export function','function');
function run({buildings=[],selectedBuild=null,step=0,acknowledged=true}={}) {
 const tip={style:{},innerHTML:'',querySelector:()=>null};
 const G={buildings,selectedBuild,day:1,population:3,scenario:'peaceful',speed:1,researchedTechs:new Set(['a','b']),gameTick:0};
 const ctx=vm.createContext({G,document:{getElementById:()=>tip,querySelectorAll:()=>[],querySelector:()=>null},authoredBuildingCount:g=>g.buildings.length,getActiveScenario:()=>({raidStart:7}),dismissTutorial:()=>{}});
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
