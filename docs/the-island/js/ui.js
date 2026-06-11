// ui.js — the few words the game ever says, and the chrome around them.

import { W } from './world.js';

const $ = (id) => document.getElementById(id);

export const UI = {
  init() {
    this.whisperEl = $('whisper');
    this.curtain = $('curtain');
    this.letterbox = $('letterbox');
    this.journalEl = $('journal');
    this.journalEntries = $('journal-entries');
    this.journalTab = $('journal-tab');
    this.hint = $('controls-hint');
    this._whisperTimer = null;
    this._whisperQueue = [];

    this.journalTab.addEventListener('click', () => this.toggleJournal());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') this.toggleJournal();
      if (e.code === 'Escape') this.journalEl.classList.add('hidden');
    });
    this.renderJournal();
  },

  // ---- whisper: one quiet italic line at a time ----
  whisper(text, holdMs = 4200) {
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
  },

  // ---- journal ----
  toggleJournal() {
    this.journalEl.classList.toggle('hidden');
  },
  addJournal(text, sketch = '') {
    if (W.journal.some((j) => j.text === text)) return;
    W.journal.push({ text, sketch });
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
    this.journalEntries.innerHTML = W.journal.map((j) =>
      `<div class="entry">${j.text}${j.sketch ? `<div class="sketch">${j.sketch}</div>` : ''}</div>`
    ).join('');
  },
};
