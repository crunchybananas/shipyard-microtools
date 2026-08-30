// writing.mjs — the one generous mark in the stack.
//
// A line scratched into the shore must travel to the rung below without adding
// any draft. This gate owns the whole contract: the actual in-world hotspot and
// input surface, hostile-text sanitation, ledger persistence outside the save,
// and the terrain-conforming weathered rendering on the next shoreline.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond, extra) => (cond ? R.pass : R.fail).push(name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute&localstack';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(0.5);
    }
    throw new Error('app never booted');
  };

  await h.navigate(URL); await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','1');
    ['abyme-save-v1','abyme-ledger-v1','abyme-hand-v1'].forEach(k => localStorage.removeItem(k)); 1`);
  await h.navigate(URL); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(1.2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(1.5);

  const surface = await h.evaluate(`(() => ({
    hotspot: !!ABYME.interact.hotspots.find(s => s.id === 'sandWriting'),
    mesh: !!ABYME.refs.sandWriting,
    stylus: !!ABYME.refs.sandStylus,
    local: ABYME.localStack === true,
    orientation: (() => {
      const mesh = ABYME.refs.sandWriting;
      if (!mesh) return null;
      const p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
      let near = -Infinity, far = Infinity, nearV = null, farV = null;
      for (let i = 0; i < p.count; i++) {
        if (p.getZ(i) > near) { near = p.getZ(i); nearV = uv.getY(i); }
        if (p.getZ(i) < far) { far = p.getZ(i); farV = uv.getY(i); }
      }
      return { nearV, farV };
    })(),
  }))()`);
  ok('the shore exposes a real writing hotspot', surface.hotspot && surface.mesh && surface.stylus, surface);
  ok('the harness cannot write permanent shared text', surface.local === true, surface);
  ok('the glyphs face the landward reader, not upside down',
    surface.orientation?.nearV < 0.05 && surface.orientation?.farV > 0.95, surface.orientation);

  if (surface.hotspot) {
    const opened = await h.evaluate(`(() => {
      ABYME.player.locked = false; ABYME.interact.enabled = true;
      ABYME.interact.hotspots.find(s => s.id === 'sandWriting').onClick();
      const el = document.getElementById('sand-write-overlay');
      const input = document.getElementById('sand-write-text');
      return { open: !el.hidden, writing: ABYME.W.writing, locked: ABYME.player.locked,
        role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), max: input.maxLength,
        copy: document.getElementById('sand-write-share').textContent };
    })()`);
    ok('the sand dialog is bounded and names the next rung', opened.open && opened.role === 'dialog' && opened.modal === 'true'
      && opened.max > 0 && opened.max <= 64 && /next rung/i.test(opened.copy), opened);
    ok('the writing surface owns movement while it is open', opened.writing === true && opened.locked === true, opened);

    const committed = await h.evaluate(`(() => {
      const input = document.getElementById('sand-write-text');
      input.value = '  Hold   fast\\u0000  ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('sand-write-form').requestSubmit();
      const mark = ABYME.ledger().marks.find(m => m.k === 'writing');
      return { hidden: document.getElementById('sand-write-overlay').hidden,
        writing: ABYME.W.writing, locked: ABYME.player.locked, mark,
        draft2: ABYME.draft(2), stored: localStorage.getItem('abyme-ledger-v1') };
    })()`);
    ok('committing returns control to the island', committed.hidden && !committed.writing && !committed.locked, committed);
    ok('the ledger stores one normalized line, not raw input', committed.mark?.t === 'Hold fast' && committed.mark.r === 1, committed.mark);
    ok('words add exactly zero draft', committed.draft2 === 0, committed);
    ok('the line persists in the ledger immediately', /Hold fast/.test(committed.stored || ''), committed.stored);

    await h.wait(0.5);
    const fresh = await h.evaluate(`(() => {
      const s = ABYME.refs.sandWriting.userData.writingState || {};
      const before = ABYME.ledger().marks.filter(m => m.k === 'writing').length;
      const again = ABYME.recordWriting('A SECOND LINE');
      return { s, before, after: ABYME.ledger().marks.filter(m => m.k === 'writing').length, again };
    })()`);
    ok('the current rung renders the fresh hand', fresh.s.lines?.some(l => l.text === 'Hold fast' && l.age === 0), fresh.s);
    ok('the rendered line puts real ink in the texture', fresh.s.inkPixels > 0, fresh.s);
    ok('one hand gets one line per rung', fresh.before === 1 && fresh.after === 1 && fresh.again === null, fresh);

    // The ledger outlives the save. Remove only the save, reload, and the shore must
    // still remember; localstack keeps this test forever away from production.
    await h.evaluate(`localStorage.removeItem('abyme-save-v1'); 1`);
    await h.navigate(URL); await ready();
    const reloaded = await h.evaluate(`(() => {
      document.getElementById('btn-begin').click();
      return ABYME.ledger().marks.filter(m => m.k === 'writing').map(m => m.t);
    })()`);
    ok('the line survives a wiped save and reload', reloaded.includes('Hold fast'), reloaded);
    await h.wait(1.2); await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(1.2);

    await h.evaluate(`ABYME.goLevel(2); ABYME.player.locked = false; 1`);
    await h.wait(1.2);
    const below = await h.evaluate(`(() => {
      const s = ABYME.refs.sandWriting.userData.writingState || {};
      const p = ABYME.refs.sandWriting.userData.anchor || {};
      const sea = -4.2 * (1 - ABYME.W.tide);
      return { inherited: ABYME.writings(2).map(m => ({t:m.t, r:m.r})), s,
        clearance: Number.isFinite(p.y) ? p.y - sea : -999,
        scuffs: ABYME.refs.handMarks.count,
        canWrite: !!ABYME.interact.hotspots.find(x => x.id === 'sandWriting')?.when() };
    })()`);
    ok('the next rung inherits the exact words', below.inherited.some(m => m.t === 'Hold fast' && m.r === 1), below);
    ok('the inherited hand is visibly weathered',
      below.s.lines?.some(l => l.text === 'Hold fast' && l.age === 1 && l.weather >= 0.3)
        && below.s.inkPixels < fresh.s.inkPixels * 0.94,
      { fresh: fresh.s, inherited: below.s });
    ok('the writing surface follows the dry shoreline', below.clearance > 0.45, below);
    ok('helpful words never masquerade as harmful scuffs', below.scuffs === 0, below);
    ok('an inherited line leaves room to write onward', below.canWrite === true, below);

    // Inbound text is stranger-controlled. Controls collapse, the line is capped,
    // and an empty hostile payload disappears rather than becoming geometry.
    const hostile = await h.evaluate(`(() => ({
      line: ABYME.sanitizeWriting('\\u202e\\u0000  ' + 'x'.repeat(200)),
      blank: ABYME.sanitizeWriting('\\u202e\\u200b')
    }))()`);
    ok('shared text is control-stripped and hard-capped',
      !/[\u0000-\u001f\u202a-\u202e]/.test(hostile.line)
        && hostile.line.length === 48 && hostile.blank === '', hostile);
  } else {
    while (R.pass.length + R.fail.length < 19) ok('sand-writing implementation is present', false, surface);
  }

  console.log(`WRITING ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) { console.log('FAILURES:', JSON.stringify(R.fail)); process.exitCode = 1; }
}
