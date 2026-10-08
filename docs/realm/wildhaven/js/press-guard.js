/** Keep native controls alive until their native click has finished. */
export function createPressGuard(root, { onRelease = () => {}, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  const document = root.ownerDocument, window = document.defaultView;
  const down = new Set(), released = new Map();
  let refresh = null, disposed = false;
  const held = () => down.size > 0 || released.size > 0;
  function notify() {
    if (held() || refresh !== null || disposed) return;
    refresh = schedule(() => { refresh = null; if (!held() && !disposed) onRelease(); }, 0);
  }
  function forget(id) {
    down.delete(id);
    if (released.has(id)) { unschedule(released.get(id)); released.delete(id); }
  }
  function reset() {
    down.clear(); for (const timer of released.values()) unschedule(timer); released.clear();
    if (refresh !== null) { unschedule(refresh); refresh = null; }
  }
  function start(event) {
    const control = event.target.closest?.('button,input,select,summary,a[href],[role="button"]');
    if (event.button !== 0 || !control || !root.contains(control) || control.disabled) return;
    forget(event.pointerId); down.add(event.pointerId);
  }
  function end(event) {
    if (!down.delete(event.pointerId)) return;
    // Pointerup precedes click (and normal lostpointercapture). Keep the target
    // connected for delayed native touch clicks; never generate a click here.
    released.set(event.pointerId, schedule(() => { released.delete(event.pointerId); notify(); }, 500));
  }
  function cancel(event) {
    if (!down.has(event.pointerId) && !released.has(event.pointerId)) return;
    forget(event.pointerId); notify();
  }
  function lost(event) { if (down.has(event.pointerId)) cancel(event); }
  function clicked() { if (!released.size) return; for (const id of [...released.keys()]) forget(id); notify(); }
  function blurred() { const wasHeld = held(); reset(); if (wasHeld) notify(); }
  function visibility() { if (document.hidden) blurred(); }
  root.addEventListener('pointerdown', start, true);
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('lostpointercapture', lost, true);
  document.addEventListener('click', clicked);
  document.addEventListener('visibilitychange', visibility);
  window?.addEventListener('blur', blurred);
  return {
    get held() { return held(); }, reset,
    dispose() {
      disposed = true; reset(); root.removeEventListener('pointerdown', start, true);
      document.removeEventListener('pointerup', end, true); document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('lostpointercapture', lost, true); document.removeEventListener('click', clicked);
      document.removeEventListener('visibilitychange', visibility); window?.removeEventListener('blur', blurred);
    },
  };
}
