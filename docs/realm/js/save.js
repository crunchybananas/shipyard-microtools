// Engine v2 save shell. Importing this module is headless-safe: storage and
// DOM are touched only when an exported shell function is called.

import { SAVE_KEY } from './save-schema.js?realm=175';
import {
  commitGameLoad,
  inspectPreparedSave,
  prepareSave,
  serializeGame,
} from './save-state.js?realm=175';
import { resetCitizenOwnershipRuntime } from './citizen-ownership.js?realm=175';
import { resetCitizenRenderCache } from './citizen-render-cache.js?realm=175';
import { resetCitizenTransitionLedger } from './citizen-inspector.js?realm=175';

let lastLoadedSavedAt = 0;

function storage() {
  return typeof globalThis.localStorage === 'object' ? globalThis.localStorage : null;
}

function showToast(message, danger = false) {
  if (typeof document === 'undefined') return;
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.style.color = danger ? 'var(--danger)' : 'var(--gold)';
  element.classList.add('show');
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.remove('show'), 2500);
}

function showSaveIndicator() {
  if (typeof document === 'undefined') return;
  document.getElementById('save-indicator')?.remove();
  const element = document.createElement('div');
  element.id = 'save-indicator';
  element.textContent = '💾 Saved';
  element.style.cssText = 'position:fixed;top:3.5rem;left:0.8rem;background:rgba(15,15,30,0.9);color:var(--gold);padding:0.3rem 0.6rem;border-radius:6px;font-size:0.7rem;opacity:0;transition:opacity 0.3s;z-index:20;pointer-events:none';
  document.body.appendChild(element);
  requestAnimationFrame(() => { element.style.opacity = '1'; });
  setTimeout(() => { element.style.opacity = '0'; }, 1500);
  setTimeout(() => { element.remove(); }, 2000);
}

function readPrepared() {
  const store = storage();
  if (!store) return { ok: false, error: { code: 'storage-unavailable', path: '$', message: 'Storage is unavailable.' } };
  const raw = store.getItem(SAVE_KEY);
  if (raw === null) return { ok: false, error: { code: 'missing-save', path: '$', message: 'No current Engine v2 save exists.' } };
  return prepareSave(raw);
}

export function hasSave() {
  return readPrepared().ok;
}

export function getSaveSummary() {
  const prepared = readPrepared();
  if (!prepared.ok) return null;
  return inspectPreparedSave(prepared.value);
}

export function getLastLoadedSavedAt() {
  return lastLoadedSavedAt;
}

export function saveGame({ silent = false } = {}) {
  try {
    const store = storage();
    if (!store) throw new Error('Storage is unavailable.');
    const envelope = serializeGame({ savedAt: Date.now() });
    store.setItem(SAVE_KEY, JSON.stringify(envelope));
    if (silent) showSaveIndicator();
    else showToast('Game saved.');
    return true;
  } catch (error) {
    console.error('Save failed:', error);
    showToast('Save failed.', true);
    return false;
  }
}

export function loadGame() {
  const prepared = readPrepared();
  if (!prepared.ok) {
    if (prepared.error.code === 'missing-save') showToast('No current save found.', true);
    else showToast('Current save is incompatible or damaged.', true);
    return false;
  }
  const committed = commitGameLoad(prepared.value);
  if (!committed.ok) {
    console.error('Load failed:', committed.error);
    showToast('Load failed.', true);
    return false;
  }
  resetCitizenOwnershipRuntime();
  resetCitizenRenderCache();
  resetCitizenTransitionLedger();
  lastLoadedSavedAt = committed.value.savedAt;
  showToast('Game loaded.');
  return true;
}
