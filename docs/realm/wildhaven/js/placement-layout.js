const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Prefer the roof, then a clear side. Never move the confirmation controls. */
export function placementInfoPosition(target, size, viewport, obstacles = []) {
  const { width, height } = size, gap = 12;
  const rect = (left, top, side) => ({ left, top, right: left + width, bottom: top + height, side });
  const inside = r => r.left >= viewport.left && r.top >= viewport.top && r.right <= viewport.right && r.bottom <= viewport.bottom;
  const clear = r => inside(r) && !obstacles.some(o => intersects(r, o)) && (!target || !intersects(r, target));
  if (target) {
    const left = clamp((target.left + target.right - width) / 2, viewport.left, viewport.right - width);
    const top = clamp((target.top + target.bottom - height) / 2, viewport.top, viewport.bottom - height);
    const horizontal = [left, ...obstacles.flatMap(o => [o.left - width - gap, o.right + gap])].map(x => clamp(x, viewport.left, viewport.right - width));
    const choices = [...horizontal.map(x => rect(x, target.top - height - gap, 'above')), rect(target.left - width - gap, top, 'left'), rect(target.right + gap, top, 'right'), ...horizontal.map(x => rect(x, target.bottom + gap, 'below'))];
    const choice = choices.find(clear); if (choice) return choice;
  }
  // Offscreen/very large previews still leave the nearest clear viewport corner
  // available. An exceptional cramped viewport hides the card, never the plan.
  for (const top of [viewport.top, viewport.bottom - height]) {
    for (const left of [viewport.left, viewport.right - width]) {
      const choice = rect(left, top, 'corner'); if (clear(choice)) return choice;
    }
  }
  return null;
}
