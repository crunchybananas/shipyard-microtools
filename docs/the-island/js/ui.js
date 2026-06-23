// ui.js — the few words the game ever says, and the chrome around them.

import { W } from './world.js';
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
    window.addEventListener('keydown', (e) => {
      // while a fragment is open the reader owns input — pages, closes, nothing leaks to the world
      if (W.reading) {
        if (e.code === 'Escape') this.closeReader();
        else if (e.code === 'ArrowLeft') this._readerPage(-1);
        else if (e.code === 'ArrowRight' || e.code === 'Space') this._readerPage(1);
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
      this._maybeIntegrate();
    }
  },
  // when EVERY deep-reading fragment has been read at depth, they close into one: the
  // grief→integration payoff — a final self-hand entry naming the shape, and a whisper. Once.
  _maybeIntegrate() {
    if (W.onceKeys.includes('deepIntegrated')) return;
    if (!DEEP_FRAGMENTS.every((id) => W.regions.fragmentsFound.includes(id))) return;
    W.onceKeys.push('deepIntegrated');
    this.addJournal('All four said more the deeper I read them. Laid end to end they stop being his story and become the shape of the thing: whoever washes up is who went down; there is no bottom but the one you make; the wrong note is not the flaw but the playing; turn the light to face the deep — and climb back toward it carrying what you found. One person, holding both ends of the same rope. That is the whole of it.', '', 'self');
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
    }, next.holdMs);
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
    this.hint.classList.add('show');
    setTimeout(() => this.hint.classList.remove('show'), 9000);
    this.journalTab.classList.add('show');
    this.soundTab.classList.add('show');
    this.motionTab.classList.add('show');
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
