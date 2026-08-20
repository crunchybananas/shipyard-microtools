# THE STACK — the shared ledger (STACK.md slice 8)

This turns the hand one rung above you from **a recording of yourself** into **other
people**. Nothing else in the game changes: the draft, the evidence, the eras and the
dispositions all read through the same source interface they always did.

**The game is complete without any of this.** With no config the island runs on the
local stack exactly as it does today — you are your own upstream hand. Everything
below is optional.

---

## Status: LIVE

The project exists and is configured. Done via CLI/API on 2026-08-18:

| | |
|---|---|
| Project | `abyme-stack` — [console](https://console.firebase.google.com/project/abyme-stack/overview) |
| Web app | `1:592720465800:web:06be6c3d7d11c323c0343d` |
| Config | wired into `docs/the-island/js/stack-config.js` |
| Firestore | `(default)`, Native mode, `nam5`, free tier |
| APIs | firestore, identitytoolkit, firebaserules — enabled |
| **Rules** | **deployed and live** (ruleset `c3a7ad65…`, release `cloud.firestore`) |

Verified against the **live** project, not just the emulator: an unauthenticated
read of the marks collection returns `403 PERMISSION_DENIED`, and an
unauthenticated write of a forged mark returns `403 PERMISSION_DENIED`. The
database is not open, and never was — no ruleset existed before mine, which
Firestore treats as deny-all.

### Anonymous sign-in: ON

Verified end to end against the **live** project (not the emulator):

| | |
|---|---|
| anonymous sign-in | works — `accounts:signUp` returns a uid + token |
| valid mark, `at` present | ALLOW |
| valid mark, `at` omitted | ALLOW |
| read the stack, signed in | ALLOW |
| impersonate another hand | DENY |
| unknown kind · rung 0 · rung 9999 | DENY |
| out-of-bounds coordinates | DENY |
| doc id that lies about the mark | DENY |
| rewrite history · delete | DENY |
| unauthenticated read · write | DENY |

And the game itself connects: `isShared() === true`, sync clean, zero page errors.

**A rule bug the live test caught that the emulator did not.** `at` is documented
optional, but the rule called `okAt(d.at)` unguarded — and reading a field that is
NOT PRESENT is an error in rules rather than null, so a mark omitting `at` was
denied. The emulator tests all sent an explicit `null` (which is present), so they
never exercised it. Fixed (`!('at' in d) || okAt(d.at)`), redeployed, and three
regression tests added. This is the argument for testing against the real thing:
21/21 green in the emulator while production rejected a valid write.

Live probe writes were aimed at `stacks/probe-live/`, never `stacks/v1/`. The rules
forbid deletes, so anything written to the real stack would be permanent evidence
in the world players inherit — a test must not put it there.

### Hosting: LIVE at <https://abyme-stack.web.app>

`firebase deploy --only hosting` from the SUBMODULE ROOT. That is also where
`firebase.json` and `.firebaserc` now live, and it is not cosmetic: the CLI refuses a
`public` path outside the directory holding firebase.json, so while the config sat in
`firebase/` pointing at `../docs/the-island` the only way to ship was to drive the
Hosting REST API by hand (create version → populateFiles → upload blobs → finalize →
release). It scopes `public` to `docs/the-island` and ignores `tools/`, `loop/`,
`test/`, `release/` and `*.md` — **54 files, 4.1 MB**. Two traps worth remembering:

- the repo's `docs/` root holds 30+ unrelated projects (6496 files, 705 MB);
  pointing hosting there publishes all of them
- `docs/the-island` is 467 MB, of which 457 MB is `tools/` (trailer renders + the
  harness). Hosting's free tier is 360 MB/day of transfer — that alone would
  exhaust it on a couple of visitors

### App Check — off, and that is a considered choice

Current state: API enabled, `firestore` and `identitytoolkit` registered but
**UNENFORCED**, no attestation provider on the web app.

It is the one step that cannot be done from here: reCAPTCHA v3 needs a **site key**
from <https://www.google.com/recaptcha/admin>, a separate console tied to the
owner's account, with no gcloud path. (reCAPTCHA Enterprise is the alternative and
requires billing.)

**What is already bounded without it**, by the ledger's own caps:

- one anonymous uid can ever write **576 documents** — 9 kinds × 64 rungs, with
  deterministic ids and `update` denied
- however many forged marks exist, the water is clamped to `MAX_DRAFT` (0.75 tide);
  no island can be drowned past that
- a sync reads at most 256 marks

So forged marks cannot break the *game*.

**And it cannot run up a bill either.** `billingEnabled: false`, no billing account
attached — the project is on the free Spark plan, so it is incapable of charging.
Exhausting the free tier makes Firestore refuse requests until quota resets, and the
game degrades to the local stack (gate-verified). Worst case is a quiet day, not an
invoice. (An earlier version of this file called the cost exposure "unbounded"; that
was wrong for this project, and is corrected here rather than quietly deleted.)

What App Check actually buys, then, is **availability**: without it, someone
scripting anonymous sign-ups could burn the daily free quota and take the shared
tide offline for everyone until it resets.

**To turn it on:** create a reCAPTCHA v3 site key, then register the provider and set
both services to `ENFORCED` via the App Check API
(`projects/{p}/webApps/{app}/recaptchaV3Config`, then `services.patch`).

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
