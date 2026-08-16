# THE STACK — the shared ledger (STACK.md slice 8)

This turns the hand one rung above you from **a recording of yourself** into **other
people**. Nothing else in the game changes: the draft, the evidence, the eras and the
dispositions all read through the same source interface they always did.

**The game is complete without any of this.** With no config the island runs on the
local stack exactly as it does today — you are your own upstream hand. Everything
below is optional.

---

## What you have to do (I can't do these — they need your account)

1. **Create the project** at <https://console.firebase.google.com> — any name.
2. **Enable Anonymous auth**: Authentication → Sign-in method → Anonymous → Enable.
   Nothing else. We never ask for, store or transmit anything about who anyone is.
3. **Create Firestore**: Firestore Database → Create → *production mode* (the rules
   in this folder replace the default deny-all; don't pick test mode, it's open).
4. **Register a web app** (Project settings → General → Your apps → Web) and copy the
   `firebaseConfig` object.
5. **Paste it** into `docs/the-island/js/stack-config.js`, replacing the `null`.
   The file already exists as a placeholder; the EXPORT is the switch, not the file.

   ```js
   export const FIREBASE_CONFIG = {
     apiKey: '…', authDomain: '…', projectId: '…',
     appId: '…', storageBucket: '…', messagingSenderId: '…',
   };
   ```

6. **Deploy the rules** — do this *before* the first player ever connects:

   ```bash
   cd shipyard-microtools/firebase && firebase deploy --only firestore:rules
   ```

7. **Turn on App Check** (recommended, not required): App Check → Register →
   reCAPTCHA v3, then enforce on Firestore. This is what stops someone scripting
   writes outside the game. The rules already bound *what* can be written; App Check
   bounds *who* is writing.

Optional: `firebase deploy --only hosting` serves the whole static game from
`docs/` — no build step, so it's one command.

---

## What's already done and proven

- **`docs/the-island/js/ledger-firebase.js`** — the source. Anonymous auth, a
  deterministic document id per (hand, rung, kind), an offline mirror, a 4-second
  timeout on every call, and a pending queue that survives a failed push.
- **`firestore.rules`** — the entire server. There is no backend code.
- **`rules.test.mjs`** — 18 tests, all passing against the Firestore emulator. Every
  one is an attack the trust model depends on failing.

You do not need to run these — they already pass, and nothing here is needed to
deploy or to play. Re-run them if you edit `firestore.rules`:

```bash
cd shipyard-microtools/firebase && npm i --no-save @firebase/rules-unit-testing firebase && npm test
```

*Nothing to install.* The Firestore emulator happens to be a Java program, and
macOS's `/usr/bin/java` is a stub that reports "Unable to locate a Java Runtime" —
but this machine already has Homebrew's `openjdk`, which is keg-only (deliberately
kept off PATH so it doesn't clash with Apple's stub). The `npm test` script points
at it, so this is a footnote rather than a step.

---

## The threat model, and what answers it

The client is a text editor in the hands of whoever runs it. Anyone can open devtools
and call `setDoc` with anything. So the rules assume that, and every line of them is
load-bearing:

| Attack | What stops it |
|---|---|
| **Drowning** a stranger's island with forged marks | `k` must be one of the nine costed kinds; `r` must be an integer 1–64; the client clamps total draft to `MAX_DRAFT` on read regardless |
| **Impersonating** another player's hand | `h` must equal `request.auth.uid`, and the doc id must be `uid_rung_kind` |
| **Injecting geometry** into the void | `at` is clamped to the island's actual extent (±400 / ±120) or must be `null` |
| **Erasing** history — anyone's, including your own | `allow update, delete: if false`. The log is append-only for everybody, forever |
| **Running up a bill** | Closed document shape (no extra fields), and the deterministic id caps any one hand at kinds × rungs documents |

A note on **CARRY**: the disposition that "takes your marks back out" removes them from
*your* view of the stack. It deliberately does **not** delete them from the shared
world — that would let any client rewrite what other people have already inherited.
There is a test asserting exactly that.

---

## Cost

Reads dominate: entering a rung reads at most 256 marks (`MAX_MARKS_PER_RUNG * 4`),
and rung 1 reads nothing at all because the surface inherits nothing. The free tier is
50k reads/day. This is comfortably free at any scale you're likely to see, and the
read cap means it stays bounded even if it isn't.

## Privacy

A mark is: a random anonymous uid, a rung number, one of nine kind strings, and game
coordinates. No names, no email, no IP-derived anything, no analytics. It is still
user data leaving the machine and it is effectively permanent, which is worth one
honest line in the UI before you ship it publicly.
