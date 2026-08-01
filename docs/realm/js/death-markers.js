// Death-marker lifecycle — the simulation records graves at the moment a
// death is committed; presentation code only reads the resulting history.

import { G } from './state.js?realm=185';

export const DEATH_MARKER_LIMIT = 40;

export function recordDeathMarker({ x, y, name, cause }) {
  const marker = { x, y, name, day: G.day, cause };
  G.deathMarkers = [
    ...G.deathMarkers.slice(-(DEATH_MARKER_LIMIT - 1)),
    marker,
  ];
  return marker;
}
