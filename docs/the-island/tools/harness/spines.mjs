// spines.mjs — the keeper's library says something, and only this can tell.
//
// (Named spines, not shelf: the neighbouring gate is shell.mjs and prints SHELL. One
// character apart in both the filename and the marker is a mistake waiting to be made.)
//
// EVERY spine in the study is lettered. Eighteen of them, in the near bay, are struck
// with a DOUBLED gilt rule above the title and below it while every other volume in the
// tower carries a single rule — and those eighteen, read the way a shelf is read (top
// board down, left to right), spell the one line of canon the game says aloud exactly
// once (STACK.md §2):
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
  const PAGE = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?mute';

  // START CLEAN. run.sh drives every gate through ONE browser, so whatever the gate
  // before this one left in localStorage is still there — and a restored save comes
  // back at a different level with the player somewhere else entirely. This passed on
  // its own and failed inside the full run for exactly that reason: the shelf was
  // built and lit, and the crosshair was in another room.
  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };
  await h.navigate(PAGE); await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save-v1'); localStorage.setItem('abyme-muted','1'); 1`);
  await h.navigate(PAGE); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

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

  // EVERY VOLUME IS LETTERED. A blank spine among lettered ones is a tell: it makes
  // "has a title" the answer again, which is exactly what the doubled rule replaced.
  const st = await h.evaluate(`JSON.stringify(ABYME.SHELF_STATS)`).then(JSON.parse);
  ok('every standing volume carries a title', st.books > 0 && st.lettered === st.books, st);

  // THE KEY ITSELF, read off the atlas. Everything else here checks WHERE volumes are;
  // this checks what actually distinguishes them, by counting the gilt rules struck above
  // each title. Two means the volume is in the message and one means it is not, and if
  // that ever stops being true the shelf still looks perfect and the puzzle is gone.
  const rules = await h.evaluate(`(() => {
    const cv = ABYME.spineAtlas().image;
    const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    g.canvas.width = cv.width; g.canvas.height = cv.height;
    g.drawImage(cv, 0, 0);
    const COLS = 8, ROWS = 8, CW = cv.width / COLS, CH = cv.height / ROWS;
    const out = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const cx = (i % COLS) * CW + Math.round(CW / 2), cy = Math.floor(i / COLS) * CH;
      // The band above the title, where the tooling lives and the lettering does not —
      // and 0.19 is not arbitrary. The label is centred at 0.5 and condensed to fit
      // 0.60 of the cell, so the earliest a letter can start is 0.20. At 0.22 this scan
      // caught the top of the ascenders and counted them as a rule: every message volume
      // read 3 and half the decoys read 2, off by exactly one, on an atlas that was
      // correct.
      const y0 = Math.round(cy + CH * 0.05), y1 = Math.round(cy + CH * 0.19);
      const d = g.getImageData(cx, y0, 1, y1 - y0).data;
      let runs = 0, on = false;
      for (let k = 0; k < d.length; k += 4) {
        // the gilt WEARS per volume (globalAlpha), so this is a presence test, not a level
        const lit = d[k] > 60;
        if (lit && !on) runs++;
        on = lit;
      }
      out.push(runs);
    }
    return JSON.stringify(out);
  })()`).then(JSON.parse);
  const msg = rules.slice(1, 1 + m.titles.length);
  const decoy = rules.slice(1 + m.titles.length);
  ok('every message volume is struck with a DOUBLED rule', msg.every((n) => n === 2),
    msg.map((n, i) => (n === 2 ? null : m.titles[i] + ':' + n)).filter(Boolean));
  ok('every other volume is struck with a SINGLE rule', decoy.every((n) => n === 1),
    decoy.map((n, i) => (n === 1 ? null : 'decoy' + i + ':' + n)).filter(Boolean));
  ok('the blank cell is blank', rules[0] === 0, { cell0: rules[0] });
  ok('exactly the message volumes are doubled', rules.filter((n) => n === 2).length === m.titles.length,
    { doubled: rules.filter((n) => n === 2).length, titles: m.titles.length });

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

  // THE WAY IN. An acrostic nobody can get at is decoration. The bay is a reader — its
  // pages transcribe the eighteen titles into the journal so they can be worked on at
  // leisure — and hovering it lifts the GILT and nothing else, because every lettered
  // spine is the only thing on matJoinery reading a non-blank atlas cell.
  await h.evaluate(`ABYME.W.time = 11; ABYME.W.sunFrozen = true; 1`);
  const a = 285 * Math.PI / 180, d = 2.4;
  await h.evaluate(`ABYME.tp(${-85 + Math.sin(a) * d}, ${-40 + Math.cos(a) * d}, ${a + Math.PI}, 0.02); 1`);
  await h.wait(1.2);
  const gilt = `(() => { let v = null; ABYME.scene.traverse((o) => {
    let q = o, j = false; while (q) { if (q.name === 'staticJoinery') { j = true; break; } q = q.parent; }
    if (j && o.isMesh && v === null) v = o.material.emissiveIntensity; }); return v; })()`;
  await h.evaluate(`ABYME.interact.mouse.set(0.9, -0.9); 1`); await h.wait(1.0);
  const rest = await h.evaluate(gilt);
  await h.evaluate(`ABYME.interact.mouse.set(0, 0); 1`); await h.wait(1.3);
  const hov = await h.evaluate(`(() => { const s = ABYME.interact.hovered;
    return JSON.stringify({ id: s && s.id, gilt: ${gilt} }); })()`).then(JSON.parse);
  ok('the crosshair on the bay finds the reader', hov.id === 'lore_lettered_shelf',
    { ...hov, enabled: await h.evaluate(`ABYME.interact.enabled`), locked: await h.evaluate(`ABYME.player.locked`),
      level: await h.evaluate(`ABYME.W.level`), at: await h.evaluate(`[+ABYME.player.pos.x.toFixed(1), +ABYME.player.pos.z.toFixed(1)]`) });
  ok('hovering lifts the gilt', hov.gilt > rest + 0.05, { rest, hovered: hov.gilt });
  await h.evaluate(`ABYME.interact.mouse.set(0.9, -0.9); 1`); await h.wait(1.4);
  ok('and the gilt settles back', Math.abs((await h.evaluate(gilt)) - rest) < 1e-6, { rest, after: await h.evaluate(gilt) });

  // content.js is pure data and imports cleanly in node, the way coverage.mjs reads it
  // (the page url above is PAGE, not URL: shadowing the global URL constructor here
  // breaks this import with 'URL is not a constructor')
  const { LORE, SHELF_TITLES } = await import(new URL('../../js/content.js', import.meta.url).pathname);
  const L = LORE.lettered_shelf;
  ok('the bay reads as three boards with a deep reading',
    !!L && L.pages.length === 3 && (L.deep || []).length >= 1 && !!L.journal && !!L.journalDeep,
    L && { pages: L.pages.length, deep: (L.deep || []).length });
  // the deep page must give the METHOD, never the sentence: STACK.md's guardrail is that
  // the line is said aloud once, ever, and printing it here would be the second time
  const said = [...L.pages, ...(L.deep || []), L.journal, L.journalDeep].join(' ').toUpperCase().replace(/[^A-Z]/g, '');
  ok('no page says the line outright', !said.includes(CANON), { where: said.indexOf(CANON) });
  // ...and it must not hand over WHICH volumes carry the doubled rule. Listing the
  // eighteen was right when they were the only lettered spines in the room; now that
  // every spine is lettered it is the entire puzzle, printed.
  const printed = [...L.pages, ...(L.deep || []), L.journal, L.journalDeep].join(' ');
  const leaked = SHELF_TITLES.filter((t) => printed.includes(t));
  ok('the reader does not name the message volumes', leaked.length === 0, leaked);

  // THE SURFACE PAGES MUST NOT EXPLAIN THE KEY. Owner: "the letter even gives it
  // completely away. we don't want to hand the puzzle to the person, or not
  // immediately." Two drafts handed it over — one by transcribing the eighteen, one by
  // stating outright that the rule is doubled on some volumes. The mechanism belongs in
  // the DEEP reading, which is gated at rung 3; the surface may only make you look.
  const TELLS = ['doubled', 'double rule', 'two lines', 'twice', 'first letter', 'initial',
                 'left to right', 'top board down', 'eighteen', 'count'];
  const surface = [...L.pages, L.journal].join(' ').toLowerCase();
  const told = TELLS.filter((t) => surface.includes(t));
  ok('the surface pages do not explain the key', told.length === 0, told);
  // ...and the deep reading DOES, or the puzzle has no floor at all
  const deepText = [...(L.deep || []), L.journalDeep].join(' ').toLowerCase();
  ok('the deep reading gives the method', TELLS.filter((t) => deepText.includes(t)).length >= 3,
    TELLS.filter((t) => deepText.includes(t)));

  console.log(`SPINES ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  reads: ${spelled}`);
  console.log(`  ${st.lettered}/${st.books} volumes lettered · ${rules.filter((n) => n === 2).length} doubled · ${rules.filter((n) => n === 1).length} single`);
  console.log(`  ${wired.withUv1}/${wired.chunks} chunks with uv1 · ${wired.distinctCells} distinct cells sampled`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
