import { freshSave, validateSave } from './model.mjs';
const DB_NAME = 'creature-field-notes-v1';
export async function openStore() {
  if (!globalThis.indexedDB) throw Error('Local saving is unavailable.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(Error('Local storage took too long to open.')); }, 3000);
    request.onupgradeneeded = () => request.result.createObjectStore('journal');
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onblocked = () => { expired = true; clearTimeout(timer); reject(Error('Close other Heartwood tabs to enable saving.')); };
    request.onsuccess = () => { clearTimeout(timer); if (expired) request.result.close(); else resolve(request.result); };
  });
}
export async function readSave(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('journal').objectStore('journal').get('progress');
    request.onsuccess = () => { try { resolve(request.result ? validateSave(request.result) : freshSave()); } catch (error) { reject(error); } };
    request.onerror = () => reject(request.error);
  });
}
export async function writeSave(db, save) {
  const copy = validateSave(save);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('journal', 'readwrite');
    transaction.objectStore('journal').put(copy, 'progress');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || Error('Saving interrupted.'));
  });
}
