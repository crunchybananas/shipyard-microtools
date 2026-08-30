// ui.js — the few words the game ever says, and the chrome around them.

import { W } from './world.js';
import { MAX_WRITING_LENGTH } from './ledger.js';
import A from './audio.js';
import { SKETCHES, LORE, DEEP_FRAGMENTS } from './content.js';

const $ = (id) => document.getElementById(id);

export const UI = {
  init() {
    this.whisperEl = $('whisper');
    this.curtain = $('curtain');
    this.letterbox = $('letterbox');
    this.journalEl = $('journal');
    this.journalEntries = $('journal-entries');
    this.journalTab = $('journal-tab');
    this.soundTab = $('sound-tab');
    this.motionTab = $('motion-tab');
    this.hint = $('controls-hint');
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

    this.journalTab.addEventListener('click', () => this.toggleJournal());
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
      if (e.code === 'KeyJ') this.toggleJournal();
      if (e.code === 'Escape') this.journalEl.classList.add('hidden');
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
    if (!lore || W.reading) return;
    const deepUnlocked = lore.deep && W.level >= (lore.deepFrom ?? 99);
    const pages = deepUnlocked ? lore.pages.concat(lore.deep) : lore.pages.slice();
    this._reader = { id: loreId, lore, page: 0, pages, surfaceLen: lore.pages.length };
    // first time read: remember it (persists) and let the journal note that it was found
    if (!W.readKeys.includes(loreId)) {
      W.readKeys.push(loreId);
      if (lore.journal) this.addJournal(lore.journal, '', 'self');
    }
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
    // the first time the player actually reaches a fragment's deep page, the deep read
    // accretes its OWN journal line (the keeper's colder hand) — so the story assembles as
    // you descend, the same object saying more the further down you've gone (Meow-Wolf).
    if (isDeep && r.lore.journalDeep && !W.regions.fragmentsFound.includes(r.id)) {
      W.regions.fragmentsFound.push(r.id);
      this.addJournal(r.lore.journalDeep, '', 'keeper');
      if (DEEP_FRAGMENTS.includes(r.id)) {
        // the canonical set — a count-AGNOSTIC cue (#76: no prose may assume "four") that the
        // deep-read is a SYSTEM accreting; the close is _maybeIntegrate's own whisper.
        const deep = DEEP_FRAGMENTS.filter((id) => W.regions.fragmentsFound.includes(id)).length;
        if (deep < DEEP_FRAGMENTS.length) {
          this.whisper(
            deep === 1 ? 'It said more this time — because you came back to it from further down. Others here will do the same, if you return to them deeper.'
            : deep === DEEP_FRAGMENTS.length - 1 ? 'One remains unread from below. Then they will want to be laid side by side.'
            : 'Another turns its colder hand. The deeper readings are starting to rhyme with one another.', 5200);
        }
        this._maybeIntegrate();
      } else {
        // a BONUS deep reading — not one of the four that close the circle, but it deepens the story
        // all the same; a quieter acknowledgement, and it stays out of the 'N of 4' tally.
        this.whisper('This one, too, says more from the deep — a page you would have walked past, on the way down.', 5000);
      }
    }
  },
  // when EVERY deep-reading fragment has been read at depth, they close into one: the
  // grief→integration payoff — a final self-hand entry naming the shape, and a whisper. Once.
  _maybeIntegrate() {
    if (W.onceKeys.includes('deepIntegrated')) return;
    if (!DEEP_FRAGMENTS.every((id) => W.regions.fragmentsFound.includes(id))) return;
    W.onceKeys.push('deepIntegrated');
    this.addJournal('Every one of them said more the deeper I read it. Laid end to end they stop being his story and become the shape of the thing: whoever washes up is who went down; there is no bottom but the one you make; the wrong note is not the flaw but the playing; turn the light to face the deep — and climb back toward it carrying what you found. One person, holding both ends of the same rope. That is the whole of it.', '', 'self');
    this.whisper('The fragments close like a hand. There was only ever one of you — the one who fell, and the one who keeps the light. Hold both, and climb.', 6000);
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
  _nextWhisper() {
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

  showHint() {
    // #60: a phone is not a keyboard — on coarse pointers the hint teaches the touch
    // grammar instead of naming keys the visitor does not have
    try {
      if (matchMedia('(pointer: coarse)').matches) {
        this.hint.innerHTML = 'drag to look &middot; <b>hold</b> to walk &middot; tap to touch the world';
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
    this.journalEl.classList.toggle('hidden');
    // re-render on open: a loaded save fills W.journal after init()
    if (!this.journalEl.classList.contains('hidden')) this.renderJournal();
  },
  addJournal(text, sketch = '', hand = 'self') {
    if (W.journal.some((j) => j.text === text)) return;
    W.journal.push({ text, sketch, hand });
    this.renderJournal();
    this.journalTab.classList.remove('pulse');
    void this.journalTab.offsetWidth; // restart the animation
    this.journalTab.classList.add('pulse');
  },
  renderJournal() {
    // codex tally: how many fragments have given up their DEEPEST pages (the cross-level deep-read
    // economy) — a persistent progress cue in the header so the assembly is legible (loop #137)
    const h2 = this.journalEl.querySelector('h2');
    if (h2) {
      const deep = DEEP_FRAGMENTS.filter((id) => W.regions.fragmentsFound.includes(id)).length;
      // #132: the record drawer — what the player has done with the record of a life
      const disp = Object.values(W.recDisp || {});
      const filedN = disp.filter((d) => d === 'filed').length;
      const keptN = disp.filter((d) => d === 'kept').length;
      const bits = [];
      if (deep > 0) bits.push(`${deep} of ${DEEP_FRAGMENTS.length} read from the deep`);
      if (filedN + keptN > 0) bits.push(`the record: ${filedN} filed · ${keptN} kept`);
      h2.innerHTML = bits.length
        ? `Field Notes<span class="deep-tally">${bits.join(' — ')}</span>`
        : 'Field Notes';
    }
    if (!W.journal.length) {
      this.journalEntries.innerHTML = '<div class="empty">Nothing written yet. The island will dictate.</div>';
      return;
    }
    this.journalEntries.innerHTML = W.journal.map((j) => {
      const sk = j.sketch || (SKETCHES.find(([m]) => j.text.includes(m))?.[1] ?? '');
      const cls = j.hand === 'keeper' ? 'entry keeper' : 'entry';
      return `<div class="${cls}">${j.text}${sk ? `<div class="sketch">${sk}</div>` : ''}</div>`;
    }).join('');
  },
};

// the journal's marginalia sketches (SKETCHES) now live in content.js, beside the
// keeper's lines — renderJournal() above imports them (loop #84, the content layer).
