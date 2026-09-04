// dispositions.js — the four operations available at the lower boundary.
//
// These are not moral labels and they are not ending prose.  They are the
// instrument legend the player reads before choosing: one verb, one physical
// operation, and one tiny two-basin diagram.  Runtime, geometry, and the finale
// all consume this same ordered contract.

export const DISPOSITION_OPERATIONS = Object.freeze([
  Object.freeze({
    id: 'tend',
    verb: 'HOLD',
    operation: 'hold both sides at their marked levels',
    diagram: Object.freeze({ upper: 'hold', lower: 'hold', link: 'metered' }),
  }),
  Object.freeze({
    id: 'carry',
    verb: 'REVERSE',
    operation: 'draw your transfers back to the upper side',
    diagram: Object.freeze({ upper: 'rise', lower: 'fall', link: 'upstream' }),
  }),
  Object.freeze({
    id: 'open',
    verb: 'JOIN',
    operation: 'open both sides until their levels meet',
    diagram: Object.freeze({ upper: 'meet', lower: 'meet', link: 'both' }),
  }),
  Object.freeze({
    id: 'close',
    verb: 'SEAL',
    operation: 'close the upper side and leave received water below',
    diagram: Object.freeze({ upper: 'closed', lower: 'hold', link: 'sealed' }),
  }),
]);

export const DISPOSITION_IDS = Object.freeze(DISPOSITION_OPERATIONS.map(({ id }) => id));

const BY_ID = new Map(DISPOSITION_OPERATIONS.map((entry) => [entry.id, entry]));

export function dispositionOperation(id) {
  return BY_ID.get(id) || DISPOSITION_OPERATIONS[0];
}

export function nextDisposition(id) {
  const index = DISPOSITION_IDS.indexOf(id);
  return DISPOSITION_OPERATIONS[(index + 1 + DISPOSITION_OPERATIONS.length)
    % DISPOSITION_OPERATIONS.length];
}
