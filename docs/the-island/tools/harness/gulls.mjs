import {beginPlay} from './play-ready.mjs';
// gulls.mjs — the dawn percher must not fly through the lighthouse.
//
// At dawn gulls[0] leaves the wheeling gyre and settles on the gallery rail. It used to
// get there by lerping its CARTESIAN position from the gyre (radius 24, 32 m up) to the
// rail (radius 3.05, 21.95 m up) — a straight line that passes through the lantern and
// the dome. At mid-settle it parks the bird inside them, and the owner caught it exactly
// there: "seems like a bird caught in the tower?".
//
// It interpolates in the gyre's polar frame now, so the radius only ever shrinks toward
// the rail and the bird stays outside by construction. This walks the whole transition
// and checks that, because "it looks fine at settle 1" is not the question — the bug
// lives entirely in the middle.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const PAGE = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute&localstack';
  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };
  await h.navigate(PAGE); await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save'); localStorage.setItem('abyme-muted','1'); 1`);
  await h.navigate(PAGE); await ready();
  await beginPlay(h);
  // This gate reads motion, soles and geometry; it never judges pixels. Keep the
  // production animation loop running at its normal rate on software-GL runners
  // by suspending draw submission for these samples. The rendered visual gates
  // and power budget run separately with the complete renderer intact.
  if(process.env.CI==='true')await h.evaluate(`(()=>{
    const {renderer,composer,scene}=ABYME;
    window.__gullRestoreDraws=()=>{renderer.render=draw;composer.render=compose;};
    const draw=renderer.render,compose=composer.render;
    renderer.render=composer.render=()=>scene.updateMatrixWorld(true);return true;
  })()`);

  try {
  // THE TRANSITION IS THE TEST, and by the time a probe gets here it is already over —
  // the settle ramp takes 4.5 s and the harness spends longer than that booting. So drive
  // the bird back OUT to the gyre first (out of dawn, the ramp falls in 3 s), then put
  // dawn back and watch the whole descent. Sampling only the settled state measures the
  // one moment the bug was never in: reinstating the straight lerp scored identically.
  await h.evaluate(`ABYME.W.time = 12; ABYME.W.sunFrozen = true; 1`);
  await h.wait(4.2);
  await h.evaluate(`ABYME.W.time = 7.2; 1`);
  const m = await h.evaluate(`(() => new Promise((res) => {
    // SPOTS entries are 2D map points: .x and .y are WORLD X AND Z. The tower's heights
    // are measured from the ground under it, which is heightAt — subtracting .y from a
    // world height is subtracting a z coordinate, and it silently reports huge clearances.
    const LH = ABYME.terrain.SPOTS.lighthouse;
    const BASE = ABYME.terrain.heightAt(LH.x, LH.y);
    // the tower's own radius at a height, from its build: shaft 4.05->2.45 over 4.6..20.5,
    // the lantern 2.06 to 23.3, the dome 2.55 falling to nothing at 25.6. Take the widest
    // thing present at each height — a bird must clear ALL of it.
    const towerR = (y) => {
      const t = y - BASE;
      if (t < 4.6) return 5.35;                       // the drum
      if (t < 20.5) return 4.05 + (2.45 - 4.05) * (t - 4.6) / 15.9;
      if (t < 21.0) return 3.35;                      // the gallery deck
      if (t < 23.3) return 2.12;                      // the lantern
      if (t < 25.7) return 2.55 * Math.sqrt(Math.max(0, 1 - ((t - 23.3) / 2.3) ** 2));
      return 0.45;                                    // the vent
    };
    let worst = 1e9, worstAt = null, n = 0;
    const step = () => {
      const g = ABYME.gulls && ABYME.gulls[0];
      if (g && g.visible) {
        const rr = Math.hypot(g.position.x - LH.x, g.position.z - LH.y);
        const clear = rr - towerR(g.position.y);
        if (clear < worst) { worst = clear; worstAt = [+rr.toFixed(2), +g.position.y.toFixed(2)]; }
      }
      if (++n > 420) return res(JSON.stringify({ worstClearance: +worst.toFixed(2), worstAt, frames: n }));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }))()`).then(JSON.parse);

  // THE WINGSPAN IS THE POINT. This measures the bird's ORIGIN against the tower, and a
  // gull is 2.64 m across — so an origin clearance of 0.98 m, which the straight lerp
  // achieves, still buries a third of a metre of wing in the copper. That is precisely
  // what the owner photographed. The bar is the half-span, not zero.
  const HALF_SPAN = 1.32;
  ok('no part of the dawn percher enters the tower', m.worstClearance > HALF_SPAN, { ...m, HALF_SPAN });
  const anatomy = await h.evaluate(`(() => {
    const gull=ABYME.perched.find(b=>b.userData.species==='gull'),u=gull.userData,m=u.mesh;
    const p=m.geometry.attributes.position,c=m.geometry.attributes.color,j=m.geometry.attributes.skinIndex;
    const wings=new Set(['wingL','wingR','handL','handR'].map(n=>m.skeleton.bones.findIndex(b=>b.name===n)));
    let wingVerts=0,dark=0;for(let i=0;i<p.count;i++){if(wings.has(j.getX(i)))wingVerts++;if(c.getX(i)<.05)dark++;}
    return {bodyVerts:p.count,skinned:m.isSkinnedMesh,bones:Object.keys(u.bones),singleMaterial:!Array.isArray(m.material),wingVerts,dark};
  })()`);
  ok('Blender anatomy renders as one skin with all twelve anatomical joints', anatomy.skinned&&anatomy.singleMaterial&&anatomy.bones.length===12, anatomy);
  ok('feathered wings have weighted shoulders, hands and dark primaries',anatomy.wingVerts>250&&anatomy.dark>30,anatomy);

  // Two field reports named what a still screenshot cannot: the grounded birds
  // hovered/wobbled, then vanished less than a second into takeoff. First hold every
  // shore gull far from the player and measure the actual sole + root for three seconds.
  const idle = await h.evaluate(`(() => new Promise((res) => {
    ABYME.W.time=7.5; ABYME.W.sunFrozen=true; ABYME.tp(-82.8,-41.4,0,0);
    const birds=ABYME.perched.filter((b)=>b.userData.species==='gull');
    const base=birds.map((b)=>{ const u=b.userData; u.flush=0; u.cool=0;u.returning=false;
      b.position.set(u.px,u.py,u.pz); b.rotation.set(0,u.yaw,0);
      const body=b.userData.mesh;body.computeBoundingBox();
      const p=body.geometry.attributes.position,feet=[];for(let i=0;i<p.count;i++)if(p.getY(i)<.009)feet.push(i);
      return {x:u.px,y:u.py,z:u.pz,yaw:u.yaw,feet,ground:u.groundY}; });
    let frames=0,soleError=0,rootDrift=0,yawDrift=0,wingMin=Infinity,wingMax=-Infinity;
    const step=()=>{
      birds.forEach((b,i)=>{ const q=base[i];
        b.updateMatrixWorld(true);b.userData.mesh.skeleton.update();let sole=Infinity;
        for(const i of q.feet){const v=b.userData.mesh.getVertexPosition(i,new ABYME.THREE.Vector3());b.userData.mesh.localToWorld(v);sole=Math.min(sole,v.y);}
        soleError=Math.max(soleError,Math.abs(sole-q.ground));
        rootDrift=Math.max(rootDrift,Math.hypot(b.position.x-q.x,b.position.y-q.y,b.position.z-q.z));
        const dy=Math.atan2(Math.sin(b.rotation.y-q.yaw),Math.cos(b.rotation.y-q.yaw));
        yawDrift=Math.max(yawDrift,Math.abs(dy));
      });
      if(birds[0]?.lw){ wingMin=Math.min(wingMin,birds[0].lw.rotation.z); wingMax=Math.max(wingMax,birds[0].lw.rotation.z); }
      if(++frames>=180) return res(JSON.stringify({frames,soleError,rootDrift,yawDrift,wingRange:wingMax-wingMin}));
      requestAnimationFrame(step);
    }; requestAnimationFrame(step);
  }))()`).then(JSON.parse);
  ok('idle gull soles meet the terrain', idle.soleError<=0.002, idle);
  ok('grounded gull roots and feet do not hover or swivel',
    idle.rootDrift<=0.001&&idle.yawDrift<=0.001, idle);
  // Three seconds can catch less than the full 0.9-rad/s cycle; 0.01 still proves
  // deliberate wing life without encouraging a visible whole-body substitute.
  ok('a grounded gull still breathes through its folded wings', idle.wingRange>=0.01, idle);

  // Trigger one actual proximity flush and watch until it leaves the draw list. The
  // departure must remain continuous and visible long enough to reach far-water scale.
  const flight = await h.evaluate(`(() => new Promise((res) => {
    const bird=ABYME.perched.find((b)=>b.userData.species==='gull'),u=bird.userData;
    u.flush=0; u.cool=0;u.returning=false; bird.position.set(u.px,u.py,u.pz); bird.rotation.set(0,u.yaw,0); bird.visible=true;
    ABYME.tp(u.px+2,u.pz,0,0);
    let startedAt=null,samplingAt=null,lastFlush=0,lastPos=[u.px,u.py,u.pz],maxSpeed=0,finite=true,frames=0;
    const checks=[1.2,3.2,5.2].map((at)=>({at,visible:null}));
    const step=(now)=>{
      if(samplingAt===null)samplingAt=now;
      if(startedAt===null&&now-samplingAt>5000)return res(JSON.stringify({firstHidden:null,displacement:0,rise:0,checks,maxSpeed,finite,frames,timeout:'flush never started'}));
      if(startedAt===null&&u.flush>0){ startedAt=now; lastFlush=u.flush; lastPos=[bird.position.x,bird.position.y,bird.position.z]; }
      if(startedAt!==null){
        const t=(now-startedAt)/1000;
        for(const c of checks) if(c.visible===null&&t>=c.at)c.visible=bird.visible;
        const vals=[bird.position.x,bird.position.y,bird.position.z];
        finite=finite&&vals.every(Number.isFinite);
        const simDt=u.flush-lastFlush;
        if(simDt>1e-6) maxSpeed=Math.max(maxSpeed,Math.hypot(vals[0]-lastPos[0],vals[1]-lastPos[1],vals[2]-lastPos[2])/simDt);
        lastFlush=u.flush; lastPos=vals;
        if(!bird.visible) return res(JSON.stringify({firstHidden:t,displacement:Math.hypot(vals[0]-u.px,vals[2]-u.pz),
          rise:vals[1]-u.py,checks,maxSpeed,finite,frames}));
        if(t>9) return res(JSON.stringify({firstHidden:null,displacement:0,rise:0,checks,maxSpeed,finite,frames,timeout:true}));
      }
      frames++; requestAnimationFrame(step);
    }; requestAnimationFrame(step);
  }))()`).then(JSON.parse);
  ok('takeoff earns its disappearance with a continuous far-water exit',
    flight.firstHidden>=6.15&&flight.displacement>=78&&flight.rise>=24
      &&flight.checks.every((c)=>c.visible===true)&&flight.maxSpeed<=35&&flight.finite,
    flight);
  // Observe the actual cooldown -> returning -> landing state machine. Only shorten
  // the hidden cooldown; the visible flight still takes its real six seconds.
  const returned=await h.evaluate(`new Promise(resolve=>{
    const b=ABYME.perched.find(b=>b.userData.species==='gull'),u=b.userData;
    ABYME.tp(-82.8,-41.4,0,0);u.cool=.01;
    let seen=false,visible=true,last=null,lastT=0,maxSpeed=0,frames=0,landing=false;
    function step(){
      if(u.returning){seen=true;visible=visible&&b.visible;landing=landing||u.pose.landing>.2;
        if(last&&u.returnT>lastT)maxSpeed=Math.max(maxSpeed,b.position.distanceTo(last)/(u.returnT-lastT));
        last=b.position.clone();lastT=u.returnT;
      }
      if(seen&&!u.returning)return resolve({seen,visible,landing,maxSpeed,home:b.position.distanceTo(new ABYME.THREE.Vector3(u.px,u.py,u.pz)),frames});
      if(++frames>900)return resolve({seen,visible,landing,maxSpeed,timeout:true});requestAnimationFrame(step);
    }requestAnimationFrame(step);
  })`);
  ok('return is a visible continuous flight with a braking landing at home',returned.seen&&returned.visible&&returned.landing&&returned.home<.002&&returned.maxSpeed<32,returned);
  const gestures=await h.evaluate(`(async()=>{
    const {poseBird}=await import('/the-island/js/island-life.js');
    const b=ABYME.perched.find(b=>b.userData.species==='gull'),u=b.userData,base=b.position.clone();
    const rows=[];for(const [name,t,opts] of [['watch',1,{}],['forage',8.5/.62,{}],['preen',13.6/.62,{}],['blink',0,{}],['call',1,{calling:true}],['glide',2,{flight:1}],['land',2,{flight:1,landing:1}]]){
      poseBird(b,t,{phase:0,...opts});b.updateMatrixWorld(true);u.mesh.skeleton.update();
      rows.push({name,behavior:u.behavior,head:u.bones.head.node.rotation.toArray().slice(0,3),jaw:u.bones.jaw.node.rotation.x,eye:u.bones.eyes.node.scale.y,foot:u.bones.footL.node.rotation.x,root:b.position.distanceTo(base),pose:{...u.pose}});
    }return rows;
  })()`);
  const row=n=>gestures.find(r=>r.name===n);
  ok('foraging and preening use different head gestures with the root planted',row('forage').behavior==='forage'&&row('preen').behavior==='preen'&&Math.abs(row('forage').head[0]-row('watch').head[0])>.9&&Math.abs(row('preen').head[1])>.7&&gestures.every(r=>r.root===0),gestures);
  ok('blinks and calls articulate the face',row('blink').eye<.2&&row('call').jaw>.03&&row('watch').jaw===0,gestures);
  ok('landing extends the feet independently of flight',Math.abs(row('glide').foot-row('land').foot)>.6,gestures);
  console.log('  return '+JSON.stringify(returned));
  console.log(`GULLS ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  closest approach ${m.worstClearance} m clear, at radius ${m.worstAt && m.worstAt[0]} / y ${m.worstAt && m.worstAt[1]}`);
  console.log(`  grounded skin ${anatomy.bodyVerts} verts · ${anatomy.bones.length} joints · ${anatomy.wingVerts} wing verts`);
  console.log(`  sole error ${idle.soleError.toFixed(4)} m · root drift ${idle.rootDrift.toFixed(4)} m · wing breath ${idle.wingRange.toFixed(3)} rad`);
  console.log(`  exit ${flight.firstHidden?.toFixed(2)} s · ${flight.displacement?.toFixed(1)} m out · ${flight.rise?.toFixed(1)} m up · max ${flight.maxSpeed?.toFixed(1)} m/s`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
  } finally {
    if(process.env.CI==='true')await h.evaluate('window.__gullRestoreDraws?.();delete window.__gullRestoreDraws;true').catch(()=>{});
  }
}
