# Shared-world integration — November 22, 2026

Resolved PR #184 against main `d7858990`, preserving the current town library, research allocation, compact controls, fishing piers and coastal art. Asset version: `20261122-shared-world-1`.

Town duplicates now discard the original world claim as well as co-op identity. Switching saves immediately invalidates the old endpoint and clears its scout, map and notes. Pending membership, peer creation and heartbeat results cannot attach to another save. World is available under More.

Validation on the integrated tree:

- 476 game tests passed, including five new controller regressions for switching saves during connected and in-flight states, and expanded duplicate-identity coverage.
- All six Firestore emulator tests passed using the dedicated local `demo-island-coop` project.
- Archive verification passed: 2,029 checks, 34 apps, nine stories.
- Background MCP browser on an isolated localhost origin: new town, More → World, return, duplicate, open copy, research panel; no console warnings/errors. Original user saves were not accessed or modified.
- Original user checkout and its four untracked paths were left unchanged.

The published rules were not re-read in this integration run because the gcloud login requires reauthentication. The unchanged additive rules have prior deployment evidence in REVIEW.md; this run verifies them in the emulator. The October real-peer playthrough is historical evidence, not a newly repeated two-player test. Physical iPad and large-world load remain unverified.
