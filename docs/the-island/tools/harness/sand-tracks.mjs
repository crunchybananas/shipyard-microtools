import { beginPlay, renderedFrames } from './play-ready.mjs';
export default async function(h) {
  await h.navigate(`http://127.0.0.1:${process.env.SERVE_PORT||8642}/the-island/?debug&mute&localstack`);
  for(let i=0;i<60;i++) {
    if(await h.evaluate('!!window.ABYME').catch(()=>false)) break;
    await h.wait(.5);
  }
  await beginPlay(h);
  console.log('PATCH',await h.evaluate(`(()=>{const a=ABYME;return [-108,-106,-104,-102,-100].map(z=>[z,a.terrain.heightAt(4,z),a.terrain.walkableY(4,z)]);})()`));
  const result = await h.evaluate(`(async()=>{
    const m=await import('./js/sand-tracks.js'); const a=ABYME;
    const tex=m.sandTrackTexture(),ctx=tex.image.getContext('2d');
    const count=()=>{const d=ctx.getImageData(0,0,tex.image.width,tex.image.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>30)n++;return n;};
    const height=a.terrain.heightAt;
    m.clearSandTracks();m.updateSandTracks(.3,{x:4,z:-104,y:height(4,-104)},false,height,-10);
    const clean=count();
    // Follow a short real-ground path in the arrival patch.
    for(let i=0;i<40;i++) {const z=-107+i*.10;m.updateSandTracks(.03,{x:4,z,y:height(4,z)},true,height,-10);}
    const walked=count();
    m.updateSandTracks(.3,{x:4,z:-103,y:height(4,-103)},false,height,10);
    const washed=count();
    m.clearSandTracks();
    for(let i=0;i<40;i++) {const z=-107+i*.10;m.updateSandTracks(.03,{x:4,z,y:height(4,z)},true,height,-10);}
    m.updateSandTracks(91,{x:4,z:-103,y:height(4,-103)},false,height,-10);
    const faded=count();
    return {clean,walked,washed,faded};
  })()`);
  console.log('SAND TRACKS',result);
  if(result.clean!==0||result.walked<30||result.washed!==0||result.faded!==0)throw Error('Footprint lifecycle failed');
  await h.evaluate(`ABYME.W.time=12;ABYME.W.timeDrift=0;ABYME.tp(4,-99,0,-.65);ABYME.player.keys.add('KeyW');1`);
  await h.wait(.65);
  await h.evaluate(`ABYME.player.keys.clear();ABYME.player.yaw=Math.PI;ABYME.player.pitch=-.9;1`);
  await renderedFrames(h);
  const stamped = await h.evaluate(`(async()=>{const m=await import('./js/sand-tracks.js');const c=m.sandTrackTexture().image;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===0&&v>30);})()`);
  if(!stamped)throw Error('Real player movement left no footprints');
  const programs=await h.evaluate('ABYME.renderer.info.programs.map(p=>({name:p.name,ok:p.diagnostics?.runnable??true}))');
  if(programs.some(p=>!p.ok))throw Error('Shader compilation failed: '+JSON.stringify(programs));
  if(process.env.SHOT_DIR)await h.screenshot(process.env.SHOT_DIR+'/sand-footprints.png');
}
