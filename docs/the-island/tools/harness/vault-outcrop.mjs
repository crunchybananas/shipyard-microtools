// vault-outcrop.mjs — the lens vault is a sealed outcrop, not a walk-through room.
//
// A field report arrived from the centre of the rock at (124,-150): the rendered
// icosahedron had no physical footprint at all. The slab only reveals a shallow
// lens niche, so solving the bird must never make the whole boulder intangible.
// This drives the real collision oracle and Player._step around the full rotated
// ellipse, pins the exact reported position, then takes the real lens from a legal
// pose outside the stone.

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond, extra) => (cond ? R.pass : R.fail).push(name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute&localstack';
  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.navigate(URL); await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save'); localStorage.setItem('abyme-muted','1'); 1`);
  await h.navigate(URL); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`); await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(2.5);

  const sealed = await h.evaluate(`(() => {
    const T=ABYME.terrain,V=T.VAULT_OUTCROP,P=ABYME.player;
    const c=Math.cos(V.rotation),s=Math.sin(V.rotation);
    const world=(a,k)=>{
      const lx=Math.cos(a)*V.colliderX*k,lz=Math.sin(a)*V.colliderZ*k;
      return [V.x+c*lx+s*lz,V.z-s*lx+c*lz];
    };
    let blocked=0;
    for(let i=0;i<72;i++){
      const a=i/72*Math.PI*2,o=world(a,1.08),n=world(a,.94);
      if(T.wallBlocked(o[0],o[1],n[0],n[1]))blocked++;
    }
    const a=.22,o=world(a,1.08),n=world(a,.94);
    P.pos.set(o[0],T.walkableY(o[0],o[1]),o[1]);
    const playerRefuses=!P._step(n[0],n[1]);
    const spot=ABYME.interact.hotspots.find((x)=>x.id==='lensItem');
    const door=ABYME.refs.vaultDoor,lens=ABYME.refs.lensItem,back=ABYME.core.getObjectByName('vaultNicheBack');
    const depth=(p)=>(p.x-V.x)*V.faceX+(p.z-V.z)*V.faceZ;
    const reported=[123.17,-150.33];
    const reportedPointBlocked=T.wallBlocked(V.x+5,V.z,reported[0],reported[1]);
    return {blocked,total:72,playerRefuses,reportedPointBlocked,lensVisible:ABYME.refs.lensItem.visible,
      lensEligible:spot.when(),renderX:V.radius*V.scaleX,renderZ:V.radius*V.scaleZ,
      colliderX:V.colliderX,colliderZ:V.colliderZ,faceRadius:V.faceRadius,
      doorDepth:depth(door.position),lensDepth:depth(lens.position),backDepth:back&&depth(back.position),
      doorVerts:door.geometry.attributes.position.count};
  })()`);
  ok('the body-margin footprint hugs the rendered outcrop',
    sealed.colliderX>sealed.renderX&&sealed.colliderZ>sealed.renderZ
      &&sealed.colliderX-sealed.renderX<=.3&&sealed.colliderZ-sealed.renderZ<=.3, sealed);
  ok('the authored arch, slab and lens live on the exterior face',
    sealed.backDepth>=sealed.faceRadius&&sealed.doorDepth>sealed.backDepth
      &&sealed.lensDepth>=sealed.faceRadius&&sealed.doorVerts>40, sealed);
  ok('the unsolved outcrop refuses entry around its whole silhouette', sealed.blocked===sealed.total, sealed);
  ok('the exact field-report position is solid stone', sealed.reportedPointBlocked, sealed);
  ok('the real player cannot step through the rock', sealed.playerRefuses, sealed);
  ok('the sealed niche neither shows nor offers the lens', !sealed.lensVisible&&!sealed.lensEligible, sealed);

  await h.evaluate(`ABYME.game.flag('birdSolved'); 1`);
  await h.wait(4.2); // vault ease reaches the slab's authored hidden threshold

  const opened = await h.evaluate(`(() => {
    const T=ABYME.terrain,V=T.VAULT_OUTCROP,P=ABYME.player;
    const c=Math.cos(V.rotation),s=Math.sin(V.rotation);
    const world=(a,k)=>{
      const lx=Math.cos(a)*V.colliderX*k,lz=Math.sin(a)*V.colliderZ*k;
      return [V.x+c*lx+s*lz,V.z-s*lx+c*lz];
    };
    let blocked=0;
    for(let i=0;i<72;i++){
      const a=i/72*Math.PI*2,o=world(a,1.08),n=world(a,.94);
      if(T.wallBlocked(o[0],o[1],n[0],n[1]))blocked++;
    }

    // Stand just outside the actual door-facing ellipse boundary. Derive the
    // pose from the slab, so moving the authored niche cannot stale this check.
    const slab=ABYME.refs.vaultDoor,lens=ABYME.refs.lensItem;
    const dx=slab.position.x-V.x,dz=slab.position.z-V.z,L=Math.hypot(dx,dz);
    const ux=dx/L,uz=dz/L;
    const ldx=c*ux-s*uz,ldz=s*ux+c*uz;
    const edge=1/Math.sqrt((ldx*ldx)/(V.colliderX*V.colliderX)+(ldz*ldz)/(V.colliderZ*V.colliderZ));
    const px=V.x+ux*(edge+1.55),pz=V.z+uz*(edge+1.55);
    ABYME.tp(px,pz,Math.atan2(px-lens.position.x,pz-lens.position.z),0);
    lens.updateWorldMatrix(true,false);
    const lp=new ABYME.THREE.Vector3();lens.getWorldPosition(lp);
    const dist=ABYME.camera.position.distanceTo(lp);
    const spot=ABYME.interact.hotspots.find((x)=>x.id==='lensItem');
    const legal={
      inward:T.wallBlocked(px,pz,V.x+ux*(edge-.15),V.z+uz*(edge-.15)),
      outward:T.wallBlocked(px,pz,px+ux*.35,pz+uz*.35),
      tangent:T.wallBlocked(px,pz,px-uz*.25,pz+ux*.25),
    };
    const eligible=spot.when(),visible=lens.visible,doorGone=!slab.visible;
    if(eligible&&visible&&dist<=spot.maxDist)spot.onClick();

    return {blocked,total:72,visible,eligible,doorGone,dist,maxDist:spot.maxDist,legal,
      lensTaken:ABYME.W.flags.lensTaken,pose:[px,pz]};
  })()`);
  ok('opening the slab never makes the boulder intangible', opened.blocked===opened.total, opened);
  ok('the revealed lens is reachable from legal ground outside the stone',
    opened.visible&&opened.eligible&&opened.doorGone&&opened.dist<=opened.maxDist
      &&opened.legal.inward&&!opened.legal.outward&&!opened.legal.tangent&&opened.lensTaken, opened);
  console.log(`VAULT-OUTCROP ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  radial seal ${sealed.blocked}/${sealed.total} before · ${opened.blocked}/${opened.total} after`);
  console.log(`  lens ${opened.dist.toFixed(2)} m away from legal pose ${opened.pose.map((n)=>n.toFixed(2)).join(', ')}`);
  console.log(`  reported point ${sealed.reportedPointBlocked?'solid':'OPEN'}`);
  if(R.fail.length){console.log('FAILURES: '+JSON.stringify(R.fail));process.exitCode=1;}
}
