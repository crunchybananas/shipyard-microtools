// experience.mjs — player-facing checks for the evidence notebook.
//
// The full walk proves progression. This pass proves the interface does not invent
// objectives from state, and that help appears only after the player asks for it.

export default async function experience(h) {
  const R = { pass: [], fail: [] };
  const ok = (name, condition) => (condition ? R.pass : R.fail).push(name);
  const port = process.env.SERVE_PORT || 8642;
  const url = `http://127.0.0.1:${port}/the-island/?debug&mute&localstack`;

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });
  await h.navigate(url);
  await ready();
  await h.evaluate(`localStorage.clear(); localStorage.setItem('abyme-muted', '1'); 1`);
  await h.navigate(url);
  await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(1.8);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.4);

  const chrome = await h.evaluate(`(() => {
    const hint = document.getElementById('controls-hint');
    const r = hint.getBoundingClientRect();
    const cs = getComputedStyle(hint);
    const notes = document.getElementById('journal');
    return {
      hint: { left:r.left, right:r.right, bottom:r.bottom, height:r.height,
        size:parseFloat(cs.fontSize), opacity:parseFloat(cs.opacity) },
      role: notes.getAttribute('role'), modal: notes.getAttribute('aria-modal'),
      labelled: notes.getAttribute('aria-labelledby'),
    };
  })()`);
  ok('UX.controls(on-screen)', chrome.hint.left >= 16 && chrome.hint.right <= 1264 && chrome.hint.bottom <= 704);
  ok('UX.controls(readable)', chrome.hint.size >= 13 && chrome.hint.height <= 48 && chrome.hint.opacity >= 0.88);
  ok('UX.fieldNotes(dialog semantics)', chrome.role === 'dialog' && chrome.modal === 'true' && chrome.labelled === 'journal-title');

  const clean = await h.evaluate(`(() => {
    ABYME.resetFlags();
    ABYME.W.flags.introDone = true;
    ABYME.UI.closeJournal();
    ABYME.UI.renderJournal();
    return {
      count: ABYME.notebook.marks().length,
      empty: document.querySelector('#journal-entries .empty')?.textContent,
      folios: document.querySelectorAll('#journal-folios button').length,
      hintLevels: Object.keys(ABYME.W.notebook.hintLevels).length,
    };
  })()`);
  ok('NOTES.fresh(empty evidence)', clean.count === 0 && clean.empty === 'No marks on this leaf.');
  ok('NOTES.five-finite-folios', clean.folios === 5);
  ok('NOTES.fresh(no implicit hints)', clean.hintLevels === 0);

  const flagsOnly = await h.evaluate(`(() => {
    Object.assign(ABYME.W.flags, { valveTurned:true, rulerPlaced:true, glyphsSeen:true, hatchCodeDecoded:true });
    ABYME.UI.renderJournal();
    return {
      entries: ABYME.notebook.marks().length,
      rows: document.querySelectorAll('#journal-entries .field-mark').length,
      empty: document.querySelector('#journal-entries .empty')?.textContent,
    };
  })()`);
  ok('NOTES.state-does-not-author-evidence', flagsOnly.entries === 0 && flagsOnly.rows === 0 && flagsOnly.empty === 'No marks on this leaf.');

  const observed = await h.evaluate(`(() => {
    ABYME.resetFlags(); Object.assign(ABYME.W.flags, { introDone:true, enteredStudy:true });
    const valve = ABYME.game.interact.hotspots.find((spot) => spot.id === 'valve');
    valve.onClick();
    ABYME.UI.renderJournal();
    const entry = ABYME.notebook.marks()[0];
    return {
      count: ABYME.notebook.marks().length,
      id: ABYME.W.notebook.entries[0]?.id,
      rendered: document.querySelectorAll('#journal-entries .field-mark').length,
      text: document.querySelector('#journal-entries .field-mark .mark-copy')?.textContent,
      sketch: !!document.querySelector('#journal-entries .field-mark .sketch svg'),
      entryText: entry?.text,
      hintText: document.getElementById('journal-hint-text').textContent,
      hintLevels: Object.keys(ABYME.W.notebook.hintLevels).length,
    };
  })()`);
  ok('NOTES.observation-earns-stable-id', observed.count === 1 && observed.id === 'evidence.valve');
  ok('NOTES.observation-renders-once', observed.rendered === 1 && observed.text === observed.entryText);
  ok('NOTES.sketch-bound-by-id', observed.sketch);
  ok('HINTS.not-pushed', observed.hintLevels === 0);

  const requested = await h.evaluate(`(() => {
    ABYME.W.flags.refugeLit = true;
    ABYME.notebook.record('event.refuge-lit');
    ABYME.UI.toggleJournal();
    const before = ABYME.notebook.marks().length;
    document.getElementById('journal-hint').click();
    const first = document.getElementById('journal-hint-text').textContent;
    const level0 = ABYME.W.notebook.hintLevels['surface-circuit'];
    document.getElementById('journal-hint').click();
    const second = document.getElementById('journal-hint-text').textContent;
    const level1 = ABYME.W.notebook.hintLevels['surface-circuit'];
    const rect = document.getElementById('journal').getBoundingClientRect();
    const style = getComputedStyle(document.getElementById('journal'));
    return {
      before, after:ABYME.notebook.marks().length,
      first, second, level0, level1,
      open:ABYME.W.notesOpen,
      expanded:document.getElementById('journal-tab').getAttribute('aria-expanded'),
      width:rect.width, right:rect.right,
      columns:style.gridTemplateColumns.split(' ').filter(Boolean).length,
      paper:style.backgroundImage,
      activeLeaf:document.querySelector('#journal-folios button.active')?.dataset.folio,
      causal:document.querySelectorAll('#journal-causal li').length,
    };
  })()`);
  ok('HINTS.trace-is-explicit', requested.first.length > 0 && requested.level0 === 0);
  ok('HINTS.trace-advances-one-thread', requested.second.length > 0 && requested.second !== requested.first && requested.level1 === 1);
  ok('HINTS.separate-from-evidence', requested.before === requested.after);
  ok('UX.fieldNotes(open state)', requested.open && requested.expanded === 'true');
  ok('UX.fieldNotes(two-page desktop)', requested.columns === 2 && requested.width <= 1152 && requested.right <= 1264
    && requested.paper.includes('linear-gradient'));
  ok('UX.fieldNotes(active-leaf-and-facing-line)', requested.activeLeaf === 'changed' && requested.causal > 1);

  const rubbing = await h.evaluate(`(() => {
    ABYME.notebook.record('evidence.beam-glyphs', { glyphs:[1,5,3,4] });
    ABYME.UI.selectJournalFolio('changed');
    return [...document.querySelectorAll('[data-note-id="evidence.beam-glyphs"] .glyph-mark')]
      .map((mark) => Number(mark.dataset.glyph));
  })()`);
  ok('NOTES.beam-rubbing-keeps-source-order', JSON.stringify(rubbing) === '[1,5,3,4]');

  await h.send('Emulation.setDeviceMetricsOverride', {
    width: 520, height: 760, deviceScaleFactor: 1, mobile: false,
  });
  const mobile = await h.evaluate(`(() => {
    const el = document.getElementById('journal');
    const r = el.getBoundingClientRect();
    const grid = getComputedStyle(el).gridTemplateColumns;
    return { width:r.width, columns:grid.split(' ').filter(Boolean).length, grid,
      innerWidth, narrow:matchMedia('(max-width: 560px)').matches };
  })()`);
  // 92vw content plus the field book's 10px binding/border stays inside the pane.
  ok('UX.fieldNotes(single-page narrow)', mobile.narrow && mobile.columns === 1 && mobile.width <= 500);
  await h.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  const readerNote = await h.evaluate(`(() => {
    ABYME.UI.closeJournal();
    const before = ABYME.notebook.marks().length;
    ABYME.UI.openReader('signal_shelf');
    const pinned = ABYME.notebook.marks().length === before;
    ABYME.UI._readerPage(1);
    const added = ABYME.W.notebook.entries.at(-1)?.id;
    const open = ABYME.W.reading && !document.getElementById('reader').classList.contains('hidden');
    ABYME.UI.closeReader();
    return { before, after:ABYME.notebook.marks().length, added, open, pinned };
  })()`);
  ok('NOTES.reader-earns-only-pages-reached', readerNote.open && readerNote.pinned && readerNote.after === readerNote.before + 1
    && readerNote.added === 'artifact.signal-shelf.surface');

  const immediateWhisper = await h.evaluate(`(() => {
    const U = ABYME.UI;
    U.clearWhispers();
    U.whisper('OUTDATED_STATE', 5000);
    U.whisper('STALE_QUEUED_STATE', 5000);
    U.whisperNow('CURRENT_STATE', 5000);
    const result = {
      text:U.whisperEl.textContent,
      show:U.whisperEl.classList.contains('show'),
      queued:U._whisperQueue.length,
    };
    U.clearWhispers();
    return result;
  })()`);
  ok('STORY.immediate-state-feedback-drops-stale-queue', immediateWhisper.show
    && immediateWhisper.text === 'CURRENT_STATE' && immediateWhisper.queued === 0);

  await h.evaluate(`(() => {
    const U = ABYME.UI;
    clearTimeout(U._whisperTimer); U._whisperTimer = null; U._whisperQueue.length = 0;
    U.whisperEl.classList.remove('show'); U.whisperEl.textContent = '';
    U.openReader('keeper_logbook');
    U.whisper('EXPERIENCE_READER_CUE', 500);
    return 1;
  })()`);
  await h.wait(0.35);
  const behind = await h.evaluate(`(() => ({
    show:ABYME.UI.whisperEl.classList.contains('show'),
    queued:ABYME.UI._whisperQueue.some((item) => item.text === 'EXPERIENCE_READER_CUE'),
  }))()`);
  await h.evaluate(`ABYME.UI.closeReader(); 1`);
  await h.wait(0.4);
  const after = await h.evaluate(`(() => ({
    show:ABYME.UI.whisperEl.classList.contains('show'),
    text:ABYME.UI.whisperEl.textContent,
  }))()`);
  ok('STORY.reader-cue-waits-for-page', !behind.show && behind.queued && after.show && after.text === 'EXPERIENCE_READER_CUE');

  console.log(`EXPERIENCE PASS ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) {
    console.log('FAILURES:', JSON.stringify(R.fail));
    process.exitCode = 1;
  }
}
