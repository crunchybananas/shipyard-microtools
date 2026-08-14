// stack-config.js — the switch for THE STACK's shared ledger (STACK.md §8).
//
// EXPORTING a FIREBASE_CONFIG here turns the shared stack ON: the hand one rung
// above you stops being a recording of yourself and becomes other people. Leave it
// null and the game is local-only — which is a complete game, not a degraded one.
//
// This file ships as a placeholder rather than being absent so the boot does not
// 404 on every load. The mechanism is the EXPORT, not the file.
//
// Setup, and what these values are: shipyard-microtools/firebase/README.md
//
// SAFE TO COMMIT. A Firebase web config is a set of public identifiers, not
// secrets — every client that loads the game receives them by necessity. What
// protects the data is firebase/firestore.rules (18 emulator tests) plus App Check.
// If that ever stops being true for a service, it does not belong in this file.

export const FIREBASE_CONFIG = null;
