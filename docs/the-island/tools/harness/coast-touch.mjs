import {tmpdir} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
export default async function(h){
 const out=resolve(process.env.SHOT_DIR||join(tmpdir(),'island-coast-touch'));mkdirSync(out,{recursive:true});
 const url=`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`;
 const pass=[],fail=[],errors=[];const ok=(n,c,d)=>(c?pass:fail).push({name:n,...(!c?{data:d}:{})});
 h.ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.text);});
 await h.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const ready=async()=>{for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))return;await h.wait(1);}throw Error('boot failed');};
 await h.navigate(url);await ready();await h.evaluate('localStorage.clear();1');await h.navigate(url);await ready();
 await h.evaluate('document.getElementById("btn-begin").click();1');await h.wait(1.5);await h.evaluate('ABYME.setIntroT(99);1');await h.wait(2.5);
 await h.evaluate(`document.getElementById('debug-panel').style.display='none';ABYME.W.time=11;ABYME.W.timeDrift=0;ABYME.tp(-81.9,-38.6,0,0);(()=>{const {player,refs,THREE}=ABYME;const p=refs.valveWheel.getWorldPosition(new THREE.Vector3());player.yaw=Math.atan2(player.pos.x-p.x,player.pos.z-p.z);player.pitch=Math.atan2(p.y-player.pos.y-player.eye,Math.hypot(player.pos.x-p.x,player.pos.z-p.z));player.syncCamera();})()`);
 await h.wait(.5);
 const p=await h.evaluate(`(()=>{const v=new ABYME.THREE.Vector3();ABYME.refs.valveWheel.getWorldPosition(v);v.project(ABYME.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};})()`);
 const tap=async()=>{await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 await tap();await h.wait(2);
 const down=await h.evaluate(`({tide:ABYME.W.tide,target:ABYME.W.tideTarget,turned:ABYME.W.flags.valveTurned,y:ABYME.core.getObjectByName('tideGaugeFloat').position.y})`);
 ok('one phone tap turns the tide wheel',down.turned&&down.target===0&&down.tide<.95,down);
 ok('the phone view shows the same live float',Math.abs(down.y-(.445+down.tide*.64))<.003,down);
 await tap();await h.wait(1);
 const up=await h.evaluate(`({tide:ABYME.W.tide,target:ABYME.W.tideTarget})`);
 ok('a second phone tap reverses the water',up.target===1&&up.tide>down.tide,up);
 await h.evaluate('ABYME.tp(-81.9,-38.6,Math.atan2(-.91,2.05),-.24);ABYME.UI.clearWhispers();1');await h.wait(.5);
 await h.screenshot(join(out,'sight-glass-mobile.png'));
 ok('mobile controls raise no runtime errors',errors.length===0,errors);
 writeFileSync(join(out,'validation.json'),JSON.stringify({pass,fail,viewport:[390,844]},null,2)+'\n');
 console.log(`COAST TOUCH ${pass.length} / ${pass.length+fail.length}`);if(fail.length){console.log(fail);process.exitCode=1;}
}
