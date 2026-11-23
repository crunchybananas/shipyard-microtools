# Observed-world review — 2026-10-12

Branch: `codex/observed-world`, based on `b8e88e2c` (existing online co-op).

## Result

Frontend asset version: `20261012-observed-world-2`.

The owner keeps the complete town and its simulation locally. World membership adds a fixed plot without resetting a save. The directory contains borders, names, the common wilderness seed and short-lived connection addresses. Browser iroh peers exchange only a scout's nearby visual view. Actual felled trees, saplings, construction, gates, walls and visible residents come from the owner. Offline plots become opaque and remain claimed. Shared storehouse goals retain the existing contribution ledger.

The World panel supports creating/joining by private invitation, nearby sector browsing, sending/recalling one scout, tapping or using directional controls, zoom, local dated visit notes, and going offline. Hosts admit four scouts; visitors appear in the owner's town without joining its workforce.

## Automated evidence

- Full game suite: **424 passed, 0 failed** (`node --test docs/realm/wildhaven/test/*.test.mjs`).
- Fifteen final focused observation/controller/Wasm checks (the final focused run also adds backup-claim protection) cover actual woodland changes, closed/open gates, bounded movement and sight, permanent border exclusion, safe wilderness routes, invalid or wrong-town packets, backup restoration, host replacement, disconnect, sign-out (including before the next tick), and in-flight recall.
- Dedicated Firestore emulator: **6 passed, 0 failed**, combining the existing three co-op flows and three new world flows. Claims cannot overlap; membership/claims are immutable and paired; anonymous/outsider queries and town payloads are denied; live leases cannot be stolen; interrupted commits recover.
- Archive verification: **2,020 checks, 33 apps, 9 stories**.
- Vendored Wasm loads as a browser module with no unresolved `env` imports. The build is locked to iroh 1.0.3 and wasm-bindgen 0.2.122. Source, lockfile, rebuild script and dependency notices are included.

## MCP playthrough

Testing used background in-app browser tabs on separate origins (`127.0.0.1:4783` and `:4784`), with disposable **Alder Bay** and **Willow Point** towns. The directory/auth fixture was the isolated `demo-island-coop` emulator. Town views crossed **real iroh browser connections over the public relay**, not an in-process mock. No Screen Sharing or foreground desktop control was used.

Verified through the ordinary game UI: create/join, opening World from an invitation after continuing, two independent local saves, membership recovery after reload, live scout arrival, movement and visible town activity, clean disconnect to an empty fogged plot, and reconnect. Home supplies stayed separate. Visit notes persisted locally through reload. Final invitation auto-open, on-screen toolbar access, and sign-out back to the World sign-in prompt were also verified without console errors. Console error/warning checks were clear on the successful visits. A local emulator interruption also exercised graceful loss of contact and manual reconnection.

Desktop **1280 × 720** and a narrow **665 × 674** viewport were inspected. The added World button exposed a seven-column toolbar overflow; the dock now sizes a single grid column per visible button so Play together stays on screen. Viewport override requests did not produce a real iPad viewport, so **iPad hardware/simulator acceptance is not claimed**. Public relay capacity and large-population load are also untested. These are cooperative owner-authoritative towns, not an anti-cheat economy.

## Deployment status

Frontend is branch-only: no merge and no public Pages deployment.

The additive rules were published to the dedicated `island-town-coop-20261011` project and read back to verify an exact source match. Ruleset: `bf370e01-9b2d-4370-bdca-3549304a2540`, published 2026-10-13 02:07:00 UTC (October 12 locally). SHA-256: `0daedc168e8bbea76903346b26bcd3eb2ea9fd845d3e819e5abc60d457ca0ec6`.

A production directory probe with two disposable Firebase accounts verified create, join, sector queries, committed-join recovery, presence, rejection of town payloads, and withdrawal. The accounts and their entire test world were removed immediately afterward. Live town-view transport was tested in the MCP clients described above; the production probe specifically tested directory/auth/rules behavior.

No other Firebase project or root Firebase configuration was used. The existing public game remains unchanged until this branch is merged and deployed.

## Follow-up

[Issue #183](https://github.com/crunchybananas/shipyard-microtools/issues/183) tracks the player's report of blocky resident/military movement. It requires a separate rendered-motion pass over walking, turning, stopping, formations, medics and barracks behavior without changing simulation speed or collision authority.

## Screenshots

- [Live visit](live-visit.png): the owner's current town revealed around the scout.
- [Offline border](offline-border.png): no town objects remain after the host leaves.
