// stack-config.js — the switch for THE STACK's shared ledger (STACK.md §8).
//
// EXPORTING a FIREBASE_CONFIG here turns the shared stack ON: the hand one rung
// above you stops being a recording of yourself and becomes other people. Set it
// back to null and the game is local-only — which is a complete game, not a
// degraded one.
//
// Setup and the threat model: shipyard-microtools/firebase/README.md
//
// SAFE TO COMMIT. A Firebase web config is a set of PUBLIC IDENTIFIERS, not
// secrets — every client that loads the game receives them by necessity, and
// Google documents them as such. What actually protects the data is
// firebase/firestore.rules (18 emulator tests, every one an attack that must
// fail) plus App Check. If that ever stops being true for a service, its
// credentials do not belong in this file.
//
// The `apiKey` in particular is an API *identifier*, not an authorisation: it
// says which project a request is for. It grants nothing on its own.

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAlYgtjTAqwXpss-Z0EzXb8FUq32sij7wk',
  authDomain: 'abyme-stack.firebaseapp.com',
  projectId: 'abyme-stack',
  storageBucket: 'abyme-stack.firebasestorage.app',
  messagingSenderId: '592720465800',
  appId: '1:592720465800:web:06be6c3d7d11c323c0343d',
};
