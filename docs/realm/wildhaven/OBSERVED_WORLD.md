# Worlds and scout visits

This feature keeps a town's simulation and complete save on its owner's device. Other players receive a temporary, read-only view when their scout visits. On disconnect, that view is discarded and the plot becomes opaque; only its boundary remains. The shared wilderness outside plots comes from a deterministic world seed. Inside a plot, the owner supplies the actual buildings, walls and gates, trees, stumps, saplings, and visible residents. The visitor never regenerates the owner's woodland.

## Play

1. Sign in through **Play together**. The same account works with both features; a storehouse partnership is not required.
2. Open **World**, name the town, and **Start a world**. Share the link under **Invite a neighbor**.
3. A friend opens **World** in their own town, pastes the invitation, and chooses **Join world**.
4. Choose **Send scout** beside a neighboring town. The scout crosses the wilderness, then contacts the owner at the border. Move by tapping ground, the directional buttons, or arrow keys with the map focused. Zoom with the buttons or mouse wheel.
5. **Go offline** closes the town immediately. The visitor's scene disappears on failure or after at most five seconds without a valid view. **Open town to scouts** reconnects. Returning to the ordinary town screen recalls your scout but leaves your town open to visitors.

Town saves and backups remain local. Importing an older or different backup cannot erase an existing world claim. Each signed-in account can claim one plot per world. A town keeps its original island within a rectangular plot; adding a world does not relocate existing buildings or reset trees. Offline plots remain claimed. There is no offline simulation, combat between player towns, or transfer of ownership. A scout is an independent visitor and does not remove a citizen from either town.

## Stored and transmitted data

The existing Firebase project hosts three small record types beneath an unlisted, random world ID:

- `worlds/{id}`: version, seed and creator ID.
- `members/{uid}` and `claims/{grid-slot}`: account ID where needed, town ID, name, fixed grid position and sector. Atomic, immutable paired records prevent overlapping claims and duplicate plots. Concurrent neighbors retry another slot. Recovering a committed join does not create another town.
- `presence/{uid}`: endpoint ID, connection ticket, session ID and expiry. The owner renews this record every 30 seconds with a 90-second lease; a clean disconnect deletes it. An expired record may remain stored but is never treated as online. No presence history is written.

The map queries only nearby sectors, at most once a minute while open. It does not poll all players' presence. Presence is fetched when the scout contacts a town; an interrupted visit checks again every five seconds. Joining a world never downloads full town saves.

Iroh carries observations over the `realm/observe/1` ALPN. Browser endpoints use end-to-end encrypted relay connections. No application server receives or persists town observations. The directory binds an authenticated account to its current endpoint; the host checks the connection's authenticated endpoint ID against that record before answering. Firebase tokens are never sent to peers.

The host controls scout travel within its territory, a fixed 11-cell sight radius, and a maximum of four visiting scouts. Snapshots contain only an allowlisted visual description inside that radius. No supplies, account credentials, research ledger, or full save is sent. Observations are bounded to 256 KiB, requests to 4 KiB, connections to eight, and all network reads have deadlines. A visitor validates the target town and owner as well as models, positions, IDs, sizes, and sequence numbers before rendering. Remote data is held separately from the home simulation and never saved over it.

Dated visit notes record only the time and visible building/tree counts on the visitor's device. They never retain a remote scene or create server history. Scouts cross the corridors between plots instead of walking through hidden towns.

Local session records permit a same-device reload to reclaim its lease. Another device waits for a live lease to end. Town backup files do not contain these connection records or account credentials. This remains cooperative play with owner-controlled economies; it is not a competitive anti-cheat system.

The existing storehouse contribution ledger is unchanged. Direct player trade, signal towers, and shared research are separate follow-ups; these visits establish the transport and observation model they can use.

## Build and deployment

The game still uses plain JavaScript and vendored Three.js. Iroh is lazy-loaded only when connecting a world; normal local play does not download the Wasm module. Its committed browser artifact is built from the checked-in Rust source and lockfile:

```sh
# Rust with wasm32-unknown-unknown, wasm-bindgen-cli 0.2.122, and LLVM on macOS.
./network/build-iroh.sh
node --test test/*.test.mjs
```

The build script rejects unresolved native Wasm imports. Do not hand-edit generated files under `vendor/iroh`. The networking wrapper follows Peel's browser iroh build approach, with a game-specific bounded observation protocol rather than importing Peel's agent/control stack.

Deploy the additive `service/firestore.rules` to the dedicated `island-town-coop-20261011` project using `service/deploy-rules.py`. Frontend files, including `vendor/iroh/*.wasm`, must be served together over HTTPS (localhost also works). The static host must serve `.wasm` as `application/wasm`. Do not use the repository's root Firebase configuration, which belongs to another application.

Iroh's public relay infrastructure is used by the current N0 preset. Browser traffic still consumes relay bandwidth; this feature reduces stored server data, not all network costs. Production scale and public-relay capacity have not been load-tested. Native transport clients could join this protocol, but no native app is included in this branch.

## Verification

`service/world-rules.test.mjs` runs against the isolated Firestore emulator, alongside the existing co-op rules tests. It covers claim collisions/recovery, immutable membership, bounded queries, rejected town payloads, owner-only presence, session conflicts and clean withdrawal. `test/observed-*.test.mjs` covers wilderness exclusion, actual woodland changes, scout authority, observation validation, local backups, stale/replaced hosts, disconnects, sign-out, and recall during an in-flight request.

For two-browser MCP testing, use separate localhost origins and an isolated Firestore emulator. `review/observed/index.html` creates a disposable fixture only when a local test server explicitly supplies the emulator configuration; it refuses to replace an existing town and cannot run against production. The regular game UI and real iroh browser transport are used after setup. Test evidence and remaining device limitations are recorded in the branch review notes.
