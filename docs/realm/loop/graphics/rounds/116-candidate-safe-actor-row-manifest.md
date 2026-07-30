# Round 116 — Candidate-safe actor-row manifest

Date: 2026-07-30
Runtime revision: 174

## Problem

The v1 manifest stored one record per `role/action/direction`. Staging a
candidate over an accepted key replaced the production record and reduced the
next clean atlas build to inherited base art. The row bytes remained in Git,
but the compiler had lost their authority. That made complete-family review
unsafe precisely when the new modular workflow began producing coherent
multi-action candidates.

## Decision

Manifest v2 gives each logical row two independent slots:

```json
{
  "production": { "status": "accepted", "file": "...", "sha256": "..." },
  "candidate": { "status": "candidate", "file": "...", "sha256": "..." }
}
```

The compiler reads only `production`. Sprite Lab prefers `candidate` for
review and shows the actual runtime authority beside it. Version 1 remains a
supported read format and is deterministically normalized by the migration
command.

New candidate files are isolated under `candidates/`. Promotions write
content-addressed production filenames before atomically replacing the
manifest, so a failed write cannot corrupt the currently referenced source.
`promote-family` validates the full requested action/direction set before one
manifest transaction.

## Guard exercise

All A5 guard rows were staged twice: the first pass established the complete
peer set; the second refreshed cross-direction metrics against that set.
Results:

- 16 candidates, all warning-free
- 12 candidates coexist with hash-locked production
- 4 carry candidates retain base runtime art
- 191 production overrides remain
- all four production atlas hashes are byte-identical before and after a clean
  build
- ordinary game URLs load no candidate row images

The old four A4 carry candidate files were removed after their A5 replacements
became manifest-authoritative. They remain recoverable from Git history.

## Automated proof

`verify-actor-row-manifest-v2.py` runs the destructive operations against an
isolated temporary manifest and source tree. It proves migration, stage,
reject, atomic family promotion, production preservation, and candidate hash
corruption rejection.

`verify-actor-row-candidate-browser.mjs` opens Sprite Lab on a Retina-sized
canvas, confirms all 16 candidate badges, verifies the fetched candidate
SHA-256, checks both `runtime LOCKED` and `runtime BASE` states, and then starts
an ordinary game to prove that no candidate asset was requested.

## Remaining guard decision

This round intentionally does not promote the A5 family. The candidate's baked
crate owns the hand socket, while the production renderer currently draws
resource-specific loads as a separate overlay. Close-zoom review must choose
an explicit cargo contract rather than either duplicating the load or silently
discarding resource identity.
