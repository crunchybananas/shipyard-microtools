// Shell-owned countdowns for transient damage/attack presentation. Rendering
// reads these fields but never mutates simulation objects; they are excluded
// from saves and authoritative hashes by STATE_OWNERSHIP.

import { G } from './state.js?realm=191';

export function updatePresentationCues() {
  for (const citizen of G.citizens || []) {
    if (citizen.hurtTimer > 0) citizen.hurtTimer -= 1;
  }
  for (const enemy of G.enemies || []) {
    if (enemy.attackCue > 0) enemy.attackCue -= 1;
  }
}
