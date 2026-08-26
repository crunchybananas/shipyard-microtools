// spines.mjs — the keeper's library says something, and only this can tell.
//
// (Named spines, not shelf: the neighbouring gate is shell.mjs and prints SHELL. One
// character apart in both the filename and the marker is a mistake waiting to be made.)
//
// The study's near bay carries eighteen gilt-lettered volumes whose initials, read the
// way a shelf is read — top board down, left to right — spell the one line of canon the
// game says aloud exactly once (STACK.md §2):
//
//     I T H A S T O G O S O M E W H E R E
//
// Nothing else in the gate can see that. The geometry is fine either way, the atlas is
// fine either way, the draw call is fine either way, and the message is scrambled. It
// takes one line in the placement loop, and the first pass shipped it BOTTOM-UP AND
// MIRRORED — every letter present, in an order nobody would ever try — because `sh`
// counts upward from the floor and bx runs right-to-left on screen from inside the room.
// Both axes were wrong and the shelf looked perfect.
//
// So the build records where each volume landed and this spells it back, in the reading
// order a person would actually use. It also checks the lettering is REACHABLE: an
// atlas cell that lands on the wrong uv channel, or a Baker that drops uv1 in the
// regional chunk build, produces a shelf of blank spines and no error anywhere.

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?mute';

  await h.navigate(URL);
  for (let i = 0; i < 40; i++) {
    if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) break;
    await h.wait(1);
  }
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2);

  const m = await h.evaluate(`JSON.stringify({
    marks: ABYME.SHELF_MARKS, titles: ABYME.SHELF_TITLES,
  })`).then(JSON.parse);

  ok('every lettered volume was placed', m.marks.length === m.titles.length,
    { placed: m.marks.length, titles: m.titles.length });
  ok('no volume is shelved twice', new Set(m.marks.map((x) => x.n)).size === m.marks.length, m.marks.length);

  // TOP BOARD DOWN (shelf index counts upward from the floor, so descending), then
  // LEFT TO RIGHT (bx runs along +tangent, which is right-to-left on screen from inside
  // the room, so descending too). Getting either of these backwards is the bug.
  const read = [...m.marks].sort((a, b) => (b.shelf - a.shelf) || (b.bx - a.bx));
  const spelled = read.map((x) => (m.titles[x.n] || '?')[0]).join('');
  const CANON = 'ITHASTOGOSOMEWHERE';
  ok('the spines spell the line, read top-down and left-to-right', spelled === CANON, { spelled, CANON });
  ok('the volumes are shelved in title order', read.every((x, i) => x.n === i),
    read.map((x) => x.n).join(','));

  // the lettering has to actually reach the shader: uv1 on every joinery chunk, an
  // emissive map bound to channel 1, and cells that are not all the blank one
  const wired = await h.evaluate(`(() => {
    let chunks = 0, withUv1 = 0, mat = null, spread = new Set();
    ABYME.scene.traverse((o) => {
      let q = o, inJoinery = false;
      while (q) { if (q.name === 'staticJoinery') { inJoinery = true; break; } q = q.parent; }
      if (!inJoinery || !o.isMesh || !o.geometry) return;
      chunks++;
      const a = o.geometry.attributes.uv1;
      if (a) {
        withUv1++;
        // decode the ATLAS CELL each vertex lands on (8 cols x 4 rows), not the raw uv.
        // Rounding the uv itself was useless: almost every joinery vertex is a shelf or
        // a door board sitting on the blank cell, so a coarse bucket of the whole batch
        // reported four values and said nothing about whether any book got lettered.
        for (let i = 0; i < a.count; i++) {
          const c = Math.floor(a.getX(i) * 8), rw = Math.floor((1 - a.getY(i)) * 4);
          spread.add(rw * 8 + c);
        }
      }
      mat = mat || { emap: !!o.material.emissiveMap, ch: o.material.emissiveMap && o.material.emissiveMap.channel,
                     ei: o.material.emissiveIntensity, hex: o.material.emissive.getHex() };
    });
    return JSON.stringify({ chunks, withUv1, distinctCells: spread.size, mat });
  })()`).then(JSON.parse);
  ok('every joinery chunk carries uv1', wired.chunks > 0 && wired.withUv1 === wired.chunks, wired);
  ok('the atlas is bound as an emissive map on uv channel 1', !!wired.mat && wired.mat.emap && wired.mat.ch === 1, wired.mat);
  // 1 blank + 18 titles + up to 6 tooling ornaments; if the atlas were not reaching the
  // geometry at all this would be exactly 1
  ok('the spines land on the lettered cells, not all on the blank one', wired.distinctCells >= 19, wired);
  // gilt is a MARK, not a light: this rides on the same material as the shelves and the
  // door boards, so a heavy hand here would set the whole study glowing (see bloom.mjs)
  ok('the gilt stays well under the bloom threshold', !!wired.mat && wired.mat.ei <= 0.6, wired.mat);

  console.log(`SPINES ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  reads: ${spelled}`);
  console.log(`  ${wired.withUv1}/${wired.chunks} chunks with uv1 · ${wired.distinctCells} distinct cells sampled`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
