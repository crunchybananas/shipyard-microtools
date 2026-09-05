export default async function(h){
 await h.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT}/the-island/?debug&mute&localstack`);
 for(let i=0;i<45;i++){if(await h.evaluate('typeof ABYME!=="undefined"').catch(()=>false))break;await h.wait(1);}
 await h.evaluate(`localStorage.clear();document.getElementById('btn-begin').click();1`);await h.wait(1.5);
 await h.evaluate('ABYME.setIntroT(99);1');await h.wait(2.5);
 await h.evaluate(`ABYME.W.lensPlaced=true;ABYME.game.interact.hotspots.find(s=>s.id==='climbStair').onClick();1`);await h.wait(.1);
 const start=await h.evaluate('ABYME.player.pos.y');
 await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:350,id:1}]});await h.wait(.52);
 const holding=await h.evaluate('({walking:ABYME.player.touchWalk,y:ABYME.player.pos.y})');
 await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await h.wait(.2);
 const released=await h.evaluate('!ABYME.player.touchWalk');
 const count=Number(holding.walking&&holding.y>start)+Number(released);
 console.log(`LANDFALL-TOUCH ${count} / 2`,JSON.stringify({start,holding,released}));
 if(count!==2)process.exitCode=1;
}
