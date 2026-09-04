// ui.js — the few words the game ever says, and the chrome around them.

import { W } from './world.js';
import { MAX_WRITING_LENGTH } from './ledger.js';
import A from './audio.js';
import { SKETCHES_BY_ID, LORE } from './content.js';

const $ = (id) => document.getElementById(id);

// The same eight figures used by the world atlas, redrawn as ink so a copied beam
// order remains exact in the book. The value in data-glyph is the factual source.
const FIELD_GLYPHS = Object.freeze([
  '<circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="2.5" class="fill"/>',
  '<path d="M20 6 33 31H7Z"/>',
  '<path d="M5 20c5-8 10 8 15 0s10 8 15 0"/>',
  '<path d="M21 20c0-5-8-5-8 1 0 8 15 9 15-2 0-14-23-13-23 4 0 14 29 17 31-4"/>',
  '<path d="M20 34V7M8 17 20 7l12 10"/>',
  '<path d="M25 7a13 13 0 1 0 0 26c-8-3-8-23 0-26Z"/>',
  '<rect x="8" y="8" width="24" height="24"/><path d="M8 20h24"/>',
  '<path d="M20 5v30M5 20h30"/><circle cx="20" cy="20" r="5"/>',
]);

const makeGlyphRubbing = (glyphs) => {
  const row = document.createElement('div');
  row.className = 'glyph-rubbing';
  row.setAttribute('aria-label', 'Four beam figures, in copied order');
  glyphs.forEach((glyph, index) => {
    const cell = document.createElement('span');
    cell.className = 'glyph-mark';
    cell.dataset.glyph = String(glyph);
    cell.setAttribute('aria-label', `beam figure ${index + 1}`);
    cell.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">${FIELD_GLYPHS[glyph] || ''}</svg>`;
    row.append(cell);
  });
  return row;
};

export const UI = {
  init({ notebook } = {}) {
    if (!notebook) throw new Error('UI requires a Notebook');
    this.notebook = notebook;
    this.whisperEl = $('whisper');
    this.curtain = $('curtain');
    this.letterbox = $('letterbox');
    this.journalEl = $('journal');
    this.journalEntries = $('journal-entries');
    this.journalFolios = $('journal-folios');
    this.journalLeafTitle = $('journal-leaf-title');
    this.journalLeafDeck = $('journal-leaf-deck');
    this.journalCausal = $('journal-causal');
    this.journalLeadTitle = $('journal-lead-title');
    this.journalTab = $('journal-tab');
    this.soundTab = $('sound-tab');
    this.motionTab = $('motion-tab');
    this.hint = $('controls-hint');
    this.cinematicHint = $('cinematic-hint');
    this.journalHint = $('journal-hint');
    this.journalHintText = $('journal-hint-text');
    this.readerEl = $('reader');
    this.readerTitle = $('reader-title');
    this.readerBody = $('reader-body');
    this.readerPageno = $('reader-pageno');
    this.readerPrev = $('reader-prev');
    this.readerNext = $('reader-next');
    this.sandWriteEl = $('sand-write-overlay');
    this.sandWriteForm = $('sand-write-form');
    this.sandWriteInput = $('sand-write-text');
    this.sandWriteCount = $('sand-write-count');
    this.sandWriteError = $('sand-write-error');
    this._reader = null;
    this._whisperTimer = null;
    this._whisperQueue = [];
    this._journalFolio = null;

    this.journalTab.addEventListener('click', () => this.toggleJournal());
    this.journalHint.addEventListener('click', () => this.traceLead());
    this.journalFolios.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-folio]');
      if (button) this.selectJournalFolio(button.dataset.folio);
    });
    this.soundTab.addEventListener('click', () => this.toggleMute());
    this.soundTab.classList.toggle('muted', A.muted); // reflect the persisted/?param state
    this.motionTab.addEventListener('click', () => this.toggleMotion());
    this.motionTab.classList.toggle('reduced', W.reduceMotion); // reflect persisted/OS state
    this.motionTab.title = W.reduceMotion ? 'Motion: reduced (C)' : 'Motion: full (C)';
    this.readerPrev.addEventListener('click', () => this._readerPage(-1));
    this.readerNext.addEventListener('click', () => this._readerPage(1));
    this.readerEl.addEventListener('click', (e) => { if (e.target === this.readerEl) this.closeReader(); });
    this.sandWriteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = this.sandWriteInput.value;
      const committed = this._sandWriter?.onCommit?.(line);
      if (!committed) {
        this.sandWriteError.textContent = 'Make one mark before you leave it.';
        this.sandWriteInput.focus();
        return;
      }
      this.closeSandWriter(true);
    });
    $('sand-write-cancel').addEventListener('click', () => this.closeSandWriter(false));
    this.sandWriteInput.addEventListener('input', () => {
      const left = Math.max(0, MAX_WRITING_LENGTH - Array.from(this.sandWriteInput.value).length);
      this.sandWriteCount.textContent = left === 1 ? '1 mark remains' : `${left} marks remain`;
      this.sandWriteError.textContent = '';
    });
    this.sandWriteEl.addEventListener('pointerdown', (e) => {
      if (e.target === this.sandWriteEl) this.closeSandWriter(false);
    });
    // Keep typing out of every world-level key listener. Escape is the one key
    // that belongs to the surface itself.
    this.sandWriteEl.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { e.preventDefault(); this.closeSandWriter(false); }
      e.stopPropagation();
    });
    window.addEventListener('keydown', (e) => {
      // while a fragment is open the reader owns input — pages, closes, nothing leaks to the world
      if (W.reading) {
        if (e.code === 'Escape') this.closeReader();
        else if (e.code === 'ArrowLeft') this._readerPage(-1);
        else if (e.code === 'ArrowRight' || e.code === 'Space') this._readerPage(1);
        e.preventDefault();
        return;
      }
      if (W.writing) {
        if (e.code === 'Escape') this.closeSandWriter(false);
        e.preventDefault();
        return;
      }
      if (W.notesOpen) {
        if (e.code === 'KeyJ' || e.code === 'Escape') this.closeJournal();
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyJ') this.toggleJournal();
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'KeyC') this.toggleMotion();   // comfort/reduced-motion, key parity with M + J
    });
    this.renderJournal();
  },

  // ---- the reading surface: open a fragment (book / letter / inscription) and read it ----
  // pages reveal in fragments; a fragment's `deep` pages only surface once you've dived deep
  // enough (W.level >= deepFrom) — the same object says more the further down you've gone.
  openReader(loreId) {
    const lore = LORE[loreId];
    if (!lore || W.reading || W.notesOpen || W.writing) return;
    const deepUnlocked = lore.deep && W.level >= (lore.deepFrom ?? 99);
    const pages = deepUnlocked ? lore.pages.concat(lore.deep) : lore.pages.slice();
    this._reader = { id: loreId, lore, page: 0, pages, surfaceLen: lore.pages.length };
    W.reading = true;
    this.readerEl.classList.remove('hidden');
    this._renderReader();
  },
  closeReader() {
    if (!W.reading) return;
    W.reading = false;
    this.readerEl.classList.add('hidden');
    this._reader = null;
  },

  // ---- the shore-writing surface: one line, then the world owns it ----------
  openSandWriter({ onCommit, onClose } = {}) {
    if (W.reading || W.writing) return false;
    this._sandWriter = { onCommit, onClose };
    W.writing = true;
    this.sandWriteInput.value = '';
    this.sandWriteCount.textContent = `${MAX_WRITING_LENGTH} marks remain`;
    this.sandWriteError.textContent = '';
    this.sandWriteEl.hidden = false;
    setTimeout(() => this.sandWriteInput.focus(), 0);
    return true;
  },
  closeSandWriter(committed = false) {
    if (!W.writing) return;
    const session = this._sandWriter;
    this._sandWriter = null;
    W.writing = false;
    this.sandWriteEl.hidden = true;
    this.sandWriteInput.blur();
    session?.onClose?.(committed);
  },
  _readerPage(delta) {
    const r = this._reader;
    if (!r) return;
    r.page = Math.max(0, Math.min(r.pages.length - 1, r.page + delta));
    this._renderReader();
  },
  _renderReader() {
    const r = this._reader;
    if (!r) return;
    const isDeep = r.page >= r.surfaceLen;  // a colder, later hand for the pages from the deep
    this.readerTitle.textContent = r.lore.title;
    this.readerBody.textContent = r.pages[r.page];
    this.readerBody.classList.toggle('keeper-deep', isDeep);
    this.readerPageno.textContent = r.pages.length > 1 ? `${r.page + 1} / ${r.pages.length}` : '';
    this.readerPrev.disabled = r.page === 0;
    this.readerNext.disabled = r.page >= r.pages.length - 1;
    // Aggregate notes are earned only after the player reaches the last page they
    // summarize. Merely opening a multi-page object cannot grant unread evidence.
    if (!isDeep && r.page === r.surfaceLen - 1 && !this.notebook.hasReadLore(r.id, 'surface')) {
      this.notebook.readLore(r.id, 'surface');
    }
    if (isDeep && r.page === r.pages.length - 1 && !this.notebook.hasReadLore(r.id, 'deep')) {
      this.notebook.readLore(r.id, 'deep');
    }
  },

  // ---- sound: a visible toggle (and the M key), kept in sync ----
  toggleMute() {
    A.setMuted(!A.muted);                                // setMuted persists to localStorage
    this.soundTab.classList.toggle('muted', A.muted);
    this.soundTab.title = A.muted ? 'Sound: off (M)' : 'Sound: on (M)';
    this.whisper(A.muted ? 'The sea goes quiet.' : 'The sea breathes again.', 2400);
  },

  // ---- reduced motion: a visible comfort toggle, persisted ----
  toggleMotion() {
    W.reduceMotion = !W.reduceMotion;
    try { localStorage.setItem('abyme-reduce-motion', W.reduceMotion ? '1' : '0'); } catch (e) {}
    this.motionTab.classList.toggle('reduced', W.reduceMotion);
    this.motionTab.title = W.reduceMotion ? 'Motion: reduced (C)' : 'Motion: full (C)';
    this.whisper(W.reduceMotion ? 'The world steadies.' : 'The world sways again.', 2400);
  },

  // ---- whisper: one quiet italic line at a time ----
  // #143: reading pace — settings scale every whisper's hold (1 / 1.5 / 2)
  _readPace: 1,
  setReadPace(p) { this._readPace = p || 1; },
  whisper(text, holdMs = 4200) {
    if (this.whisperEl.textContent === text && this.whisperEl.classList.contains('show')) return;
    if (this._whisperQueue.some((w) => w.text === text)) return;
    if (this._whisperQueue.length >= 3) this._whisperQueue.shift();
    this._whisperQueue.push({ text, holdMs });
    if (!this._whisperTimer) this._nextWhisper();
  },
  whisperNow(text, holdMs = 4200) {
    // Reversible controls report the state that exists now. Any older queued state
    // is false the instant the dial moves again, so it must not get a later turn.
    this.clearWhispers();
    this.whisperEl.textContent = text;
    this.whisperEl.classList.add('show');
    this._whisperTimer = setTimeout(() => {
      this.whisperEl.classList.remove('show');
      this._whisperTimer = setTimeout(() => this._nextWhisper(), 1500);
    }, holdMs * this._readPace);
  },
  clearWhispers() {
    clearTimeout(this._whisperTimer);
    this._whisperTimer = null;
    this._whisperQueue.length = 0;
    if (this.whisperEl) {
      this.whisperEl.classList.remove('show');
      this.whisperEl.textContent = '';
    }
  },
  _nextWhisper() {
    // A story cue spoken behind an opaque reader or journal is not a cue. Deep
    // pages used to spend their entire acknowledgement behind the parchment, so
    // the player who read carefully was the player guaranteed to miss it.
    const covered = W.reading || W.writing
      || !this.journalEl.classList.contains('hidden')
      || !document.getElementById('settings')?.classList.contains('hidden');
    if (covered) {
      this._whisperTimer = setTimeout(() => this._nextWhisper(), 180);
      return;
    }
    const next = this._whisperQueue.shift();
    if (!next) { this._whisperTimer = null; return; }
    this.whisperEl.textContent = next.text;
    this.whisperEl.classList.add('show');
    this._whisperTimer = setTimeout(() => {
      this.whisperEl.classList.remove('show');
      this._whisperTimer = setTimeout(() => this._nextWhisper(), 1500);
    }, next.holdMs * this._readPace);
  },

  // ---- curtain ----
  fadeIn(slow = true) {
    this.curtain.classList.toggle('fast', !slow);
    this.curtain.classList.add('clear');
  },
  fadeOut(white = false, fast = false) {
    this.curtain.classList.toggle('white', white);
    this.curtain.classList.toggle('fast', fast);
    this.curtain.classList.remove('clear');
  },

  cinematic(on) { this.letterbox.classList.toggle('on', on); },
  showCinematicHint(text) {
    this.cinematicHint.textContent = text;
    this.cinematicHint.classList.add('show');
  },
  hideCinematicHint() { this.cinematicHint.classList.remove('show'); },

  showHint() {
    // #60: a phone is not a keyboard — on coarse pointers the hint teaches the touch
    // grammar instead of naming keys the visitor does not have
    try {
      if (matchMedia('(pointer: coarse)').matches) {
        this.hint.innerHTML = 'drag to look &middot; <b>hold</b> to walk &middot; tap to touch &middot; <b>✦</b> for field notes';
      }
    } catch (_) {}
    this.hint.classList.add('show');
    setTimeout(() => this.hint.classList.remove('show'), 9000);
    this.journalTab.classList.add('show');
    this.soundTab.classList.add('show');
    this.motionTab.classList.add('show');
    document.getElementById('settings-tab')?.classList.add('show');   // #59
  },

  // ---- journal ----
  toggleJournal() {
    if (W.reading || W.writing) return;
    this.journalEl.classList.toggle('hidden');
    const open = !this.journalEl.classList.contains('hidden');
    W.notesOpen = open;
    this.journalTab.setAttribute('aria-expanded', String(open));
    this.journalTab.setAttribute('aria-label', open ? 'Close field notes' : 'Open field notes');
    if (open) {
      this._journalFolio = this.notebook.activeFolioId();
      this.renderJournal();
    }
  },
  closeJournal() {
    this.journalEl.classList.add('hidden');
    W.notesOpen = false;
    this.journalTab.setAttribute('aria-expanded', 'false');
    this.journalTab.setAttribute('aria-label', 'Open field notes');
  },
  notebookChanged(change) {
    if (this.journalEl.classList.contains('hidden')) {
      this._journalFolio = this.notebook.activeFolioId();
    }
    this.renderJournal();
    if (!['record', 'revise'].includes(change?.type)) return;
    this.journalTab.classList.remove('pulse');
    void this.journalTab.offsetWidth; // restart the animation
    this.journalTab.classList.add('pulse');
  },
  selectJournalFolio(id) {
    const exists = this.notebook.folios().some((folio) => folio.id === id);
    if (!exists) return;
    this._journalFolio = id;
    this.renderJournal();
  },
  traceLead() {
    this.notebook.requestHint();
    this.renderJournal();
  },
  renderJournal() {
    const book = this.notebook.fieldbook();
    const selected = book.folios.find((folio) => folio.id === this._journalFolio)
      || book.folios.find((folio) => folio.id === book.activeFolioId)
      || book.folios[0];
    this._journalFolio = selected.id;

    for (const button of this.journalFolios.querySelectorAll('button[data-folio]')) {
      const folio = book.folios.find(({ id }) => id === button.dataset.folio);
      const current = button.dataset.folio === selected.id;
      button.classList.toggle('active', current);
      button.classList.toggle('has-marks', !!folio?.marks.length);
      button.classList.toggle('current-gate', button.dataset.folio === book.activeFolioId);
      button.setAttribute('aria-pressed', String(current));
    }

    this.journalLeafTitle.textContent = selected.title;
    this.journalLeafDeck.textContent = selected.deck;
    this.journalEntries.replaceChildren();
    if (!selected.marks.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No marks on this leaf.';
      this.journalEntries.append(empty);
    } else {
      for (const note of selected.marks) {
        const row = document.createElement('article');
        row.className = `field-mark ${note.markKind}`;
        row.dataset.noteId = note.id;
        const source = document.createElement('span');
        source.className = 'mark-label';
        source.textContent = note.label;
        const body = document.createElement('p');
        body.className = 'mark-copy';
        body.textContent = note.text;
        row.append(source, body);
        if (note.rubbing?.kind === 'glyph-order') {
          row.append(makeGlyphRubbing(note.rubbing.glyphs));
        } else {
          const sketch = note.sketchId && SKETCHES_BY_ID[note.sketchId];
          if (sketch) {
            const drawing = document.createElement('div');
            drawing.className = 'sketch';
            drawing.setAttribute('aria-hidden', 'true');
            drawing.innerHTML = sketch;
            row.append(drawing);
          }
        }
        this.journalEntries.append(row);
      }
    }

    this.journalCausal.replaceChildren();
    for (const node of book.trace) {
      const item = document.createElement('li');
      item.className = node.complete ? 'complete' : 'open';
      item.textContent = node.label;
      this.journalCausal.append(item);
    }

    this.journalLeadTitle.textContent = book.lead.summary;
    this.journalHint.disabled = !book.lead.canTrace;
    this.journalHintText.textContent = book.lead.text
      || (book.lead.canTrace
        ? 'A relation in these marks can be pressed darker.'
        : book.gate.missing.length
          ? 'No further line is supported by the marks on hand.'
          : 'This line is closed.');
    this.journalHintText.classList.toggle('empty', !book.lead.text);
  },
};
