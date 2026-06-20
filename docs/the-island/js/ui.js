// ui.js — the few words the game ever says, and the chrome around them.

import { W } from './world.js';
import A from './audio.js';
import { SKETCHES } from './content.js';

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
    this._whisperTimer = null;
    this._whisperQueue = [];

    this.journalTab.addEventListener('click', () => this.toggleJournal());
    this.soundTab.addEventListener('click', () => this.toggleMute());
    this.soundTab.classList.toggle('muted', A.muted); // reflect the persisted/?param state
    this.motionTab.addEventListener('click', () => this.toggleMotion());
    this.motionTab.classList.toggle('reduced', W.reduceMotion); // reflect persisted/OS state
    this.motionTab.title = W.reduceMotion ? 'Motion: reduced (C)' : 'Motion: full (C)';
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') this.toggleJournal();
      if (e.code === 'Escape') this.journalEl.classList.add('hidden');
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'KeyC') this.toggleMotion();   // comfort/reduced-motion, key parity with M + J
    });
    this.renderJournal();
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
