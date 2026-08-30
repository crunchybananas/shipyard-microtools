// terrain-finish.mjs — pin what the final pixels depend on, not merely whether an
// image decoded. The former sand heightmap repeated its complete authored shape every
// 6.25 m; the coarse terrain grid stair-stepped every tide cut; the composer's non-MSAA
// target made both faults harder in broad daylight.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond, extra) => (cond ? R.pass : R.fail)
    .push(name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  const port = process.env.SERVE_PORT || 8642;
  await h.navigate(`http://127.0.0.1:${port}/the-island/?debug&mute`);
  for (let i = 0; i < 50; i++) {
    if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) break;
    await h.wait(.4);
  }
  await h.evaluate(`localStorage.setItem('abyme-muted','1'); localStorage.removeItem('abyme-save-v1'); document.getElementById('btn-begin').click(); 1`);
  await h.wait(1.3); await h.evaluate(`ABYME.setIntroT(99); ABYME.W.timeDrift=0; 1`); await h.wait(3);

  const s = await h.evaluate(`(() => {
    const terrain = ABYME.core.getObjectByName('terrain');
    const sh = terrain?.material?.userData?.shader;
    const waterMat = ABYME.core.getObjectByName('water')?.material;
    const depth = waterMat?.uniforms?.uHeightTex?.value;
    const frag = sh?.fragmentShader || '';
    const waterFrag = waterMat?.fragmentShader || '';
    return {
      contract: terrain?.material?.userData?.sandRelief || null,
      coast: terrain?.material?.userData?.coastRefinement || null,
      terrainTriangles: terrain?.geometry?.index?.count / 3 || 0,
      terrainChildren: terrain?.children?.length || 0,
      fragment: frag,
      depth: depth ? { width: depth.image?.width, height: depth.image?.height, halfFloat: depth.type === ABYME.THREE.HalfFloatType } : null,
      waterFrag,
      bloomBase: ABYME.bloomPass?.userData?.baseStrength,
    };
  })()`);

  ok('sand relief declares one continuous analytic field and no repeat period',
    s.contract?.textureSamples === 0 && s.contract?.worldSpan === 620
      && s.contract?.encoding === 'analytic-slope' && s.contract?.repeatPeriod === 0
      && s.contract?.continuous === true && s.contract?.locallyTurning === true, s.contract);
  ok('the compiled relief turns and bows its wind sets in world metres',
    /sandTurnField/.test(s.fragment) && /sandDA/.test(s.fragment)
      && /sandBend/.test(s.fragment) && /sandPA/.test(s.fragment),
    { turn: /sandTurnField/.test(s.fragment), bend: /sandBend/.test(s.fragment), carrier: /sandPA/.test(s.fragment) });
  const fieldFetches = (s.fragment.match(/texture2D\(uSand/g) || []).length;
  ok('sand relief requires no texture fetch', fieldFetches === 0, { fieldFetches });
  ok('the stamped height tile is absent from the compiled terrain shader',
    !/uSandH|uSandSlope|sand_height|vWPos\.xz\s*\*\s*0\.16/.test(s.fragment),
    { legacy: /uSandH|uSandSlope|sand_height|vWPos\.xz\s*\*\s*0\.16/.test(s.fragment) });

  ok('the coast depth field is a 512² fp16 mask',
    s.depth?.width === 512 && s.depth?.height === 512 && s.depth?.halfFloat, s.depth);
  ok('the water shader registers texel centres for the 512² coast field',
    /511\.0\s*\/\s*512\.0/.test(s.waterFrag) && /0\.5\s*\/\s*512\.0/.test(s.waterFrag)
      && !/255\.0\s*\/\s*256\.0/.test(s.waterFrag),
    { newMapping: /511\.0\s*\/\s*512\.0/.test(s.waterFrag), oldMapping: /255\.0\s*\/\s*256\.0/.test(s.waterFrag) });
  ok('one topology-preserving mesh resolves every story tide under the geometry ceiling',
    s.coast?.method === 'adaptive-cell-replacement'
      && s.coast?.subdivisions?.surface === 4 && s.coast?.subdivisions?.raised === 3
      && s.coast?.refinedCellMetres?.surface < 0.61 && s.coast?.refinedCellMetres?.raised < 0.81
      && s.coast?.tideBand?.[0] <= -4.2 && s.coast?.tideBand?.[1] >= 4.2
      && s.coast?.stableTideLevels?.length === 6
      && s.coast?.watertight === true && s.coast?.topologyPreserving === true
      && s.coast?.deepCeiling <= -9.5
      && s.coast?.deepBlockCells?.join(',') === '16,8,4'
      && s.coast?.removedDeepTriangles > s.coast?.addedTriangles
      && s.terrainTriangles === 127852 && s.terrainChildren === 0,
    { coast: s.coast, triangles: s.terrainTriangles, children: s.terrainChildren });

  const at = async (time) => {
    await h.evaluate(`ABYME.W.time=${time}; ABYME.W.timeDrift=0; 1`); await h.wait(1.2);
    return h.evaluate(`({strength:ABYME.bloomPass.strength,base:ABYME.bloomPass.userData.baseStrength,draws:ABYME.renderer.info.render.calls})`);
  };
  const noon = await at(12), golden = await at(17.7), night = await at(23);
  ok('high daylight fades bloom fully out and regains direct-render MSAA',
    noon.strength <= 0.001 && noon.draws < golden.draws,
    { noon, golden });
  ok('golden hour keeps the authored bloom',
    golden.base === s.bloomBase && golden.strength >= golden.base * 0.98, { golden, bloomBase: s.bloomBase });
  ok('night keeps the authored bloom',
    night.base === s.bloomBase && night.strength >= night.base * 0.98, { night, bloomBase: s.bloomBase });

  console.log(`TERRAIN-FINISH ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
