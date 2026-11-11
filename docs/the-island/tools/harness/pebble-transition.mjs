import {beginPlay, renderedFrames} from './play-ready.mjs';
export default async function(h) {
  await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT||8642}/the-island/?debug&mute&localstack`);
  for(let i=0;i<100;i++) {
    if(await h.evaluate('!!window.ABYME').catch(()=>false))break;
    await h.wait(.4);
  }
  await beginPlay(h);
  await h.evaluate(`ABYME.W.time=12;ABYME.W.timeDrift=0;ABYME.tp(0,-99,0,-.75);1`);
  await renderedFrames(h);
  const result=await h.evaluate(`(()=>{
    const a=ABYME,bed=a.core.getObjectByName('pebbleApron'),fringe=a.core.getObjectByName('pebbleFringe');
    let floating=0,escaped=0;const m=new a.THREE.Matrix4(),p=new a.THREE.Vector3();
    for(let i=0;i<fringe.count;i++){
      fringe.getMatrixAt(i,m);p.setFromMatrixPosition(m);
      if(Math.abs(p.y-a.terrain.heightAt(p.x,p.z)-.012)>.001)floating++;
      if(p.x < -32 || p.x >16 ||p.z < -103.5 ||p.z > -96)escaped++;
    }
    return {count:fringe.count,floating,escaped,transparent:bed.material.transparent,
      depthWrite:bed.material.depthWrite,flat:bed.material.flatShading,
      programs:a.renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)};
  })()`);
  console.log('PEBBLE TRANSITION',result);
  if(!result.programs||!result.transparent||result.depthWrite||result.flat||result.count<50||result.count>2000||result.floating||result.escaped)throw Error('Pebble transition failed');
  if(process.env.SHOT_DIR)await h.screenshot(process.env.SHOT_DIR+'/pebble-transition.png');
}
