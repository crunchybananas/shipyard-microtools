# Companion towns: local playable slice

This increment links two separate towns on one device. It does not connect Cory’s and Melissa’s devices, create accounts, invite anyone, upload saves, or claim that another player is present. Town names are editable labels. The second town is explicitly a local draft, starting from its own six founders rather than a copy of the first town’s earned economy.

## What is playable

- Create the second town, name both towns, and take turns managing them.
- Visit the other island without advancing time or enabling town decisions. A persistent banner offers **Take the chair** and **Return home**.
- Propose a resource exchange or a one-way gift. The sender approves the offer; the receiving town must be managed and explicitly accept it. The interface asks the person at the device to confirm which town they are reviewing for. This is consent within a shared-device prototype, not identity authentication.
- Decline or withdraw an offer without moving goods. Review recent closed exchanges.
- Resume either town’s construction, fieldwork, research and frontier state after returning. Only the managed town runs. Reloading always resumes the original home, paused through the normal entry flow.

Offers do not escrow goods. Both inventories and receiving capacity are checked again at acceptance. An offer whose goods were spent remains pending and explains why it cannot execute. Knowledge is not transferable. Quantities must be positive whole numbers; an empty requested bag means a gift. Accepted offers cannot execute again. No cargo is silently discarded to make an exchange fit.

## Integration contract

`js/companion-store.js` is independent of the DOM and renderer. `createCompanionStore({ storage })` returns:

- `ready`: await the browser writer lock before enabling the game or calling `loadHome`.
- `loadHome(fallbackState)`: restore the authoritative home, with migration fallback supplied by the existing loader.
- `save(state)`: save the active managed town. Visits skip saving their disposable view snapshot. The result includes `ok`, `reason`, and a `warning` when the home mirror is awaiting retry.
- `create({ homeName, companionName }, state)`, `renameTown(id, name, state)`.
- `switchTown(id, state, { visit })`: persist the town being left before changing context; return the next `state`, `id`, and `mode`. Failed persistence leaves the active town unchanged.
- `proposeOffer({ give, request }, state)`, `acceptOffer(id, state)`, `closeOffer(id, state)`.
- `info(state?)`, `activeId`, and `readOnly` for presentation; `canManage` guards every mutation while visiting, waiting for the writer lease, or blocked by storage.

`js/companion-ui.js` provides `createCompanionUI({ store, getState, onStateChange, beforeOpen, announce })`. It mounts the panel, toggle, and persistent location banner; returns `open`, `close`, `update`, and `active`; and marks other HUD children inert during visits. `main.js` additionally guards simulation advancement, speed, keyboard actions and world decisions during a visit. Applying a returned state clears world selections and enters paused. All save paths, including visibility and page-exit saves, use the adapter.

Touch layouts use at least 44px controls on phones and tablets, 16px form fields, native numeric input, safe-area spacing, and a scrolling content region. The away panel follows the measured banner height, including wrapped names. When an on-screen keyboard reduces the visual viewport, the panel fits within that viewport and keeps the focused field visible. Failed forms retain their values and show feedback inside the panel. These safeguards support tablet use; actual iPad hardware and keyboard behavior still require device verification rather than a claim of perfection from viewport emulation.

## Durable storage and recovery

The core save version stays v4. `wildhaven.v4` remains exclusively the original home; no companion snapshot is ever written there. Before opt-in the adapter writes only that normal home key.

After opt-in, `wildhaven.companions.v1` contains a validated envelope with both serialized v4 town snapshots, their names, revision, bounded offer ledger, next offer ID, and the previous home mirror. Both town snapshots pass the existing simulation restore validator. Names and resource bags have independent bounds and validation. A malformed envelope is preserved verbatim and blocks writes rather than silently replacing either town.

Each mutation follows this order:

1. Check the browser writer lease and that both storage keys still match what this instance read.
2. Work on copies; include the latest live managed state in the candidate envelope. Do not mutate the caller’s state or inventories.
3. Write the complete envelope with one atomic `localStorage.setItem`. If this fails, neither town’s stored state changes and switching or transfer fails.
4. Mirror the envelope’s home snapshot to `wildhaven.v4` only when it differs. A companion autosave with unchanged home leaves that key byte-for-byte intact.
5. If mirroring fails after the envelope committed, the operation is already durable for both towns. Expose a warning. On reload, an unchanged previous home mirror is recognized and the complete home snapshot is retried. Never replay resource deltas during recovery.

If the original home key has unexpectedly changed to neither the recorded previous mirror nor the committed home, retain both records and block further town changes. The UI explains the conflict. No automated destructive recovery, export, or upload is provided in this slice. A storage/quota failure keeps unsaved live work in the current tab; a failed switch does not discard it.

An exclusive Web Locks lease named `wildhaven.local-towns.writer` is held for the page lifetime. A second tab cannot become a writer while the first is open. Closing the first tab and reloading the second permits a fresh read under its own lease. If the browser cannot acquire a safe lease or does not support Web Locks, writes fail safely with a visible reason. Key comparison is an additional check for older Wildhaven tabs or other code that does not use the lease; it is not represented as an atomic compare-and-swap primitive. Pure Node tests may omit the browser lease or inject a fake lock manager explicitly.

## Direction for a real shared world

The local slice establishes town isolation, paused visits, offers, acceptance, and complete transaction records. A future shared version would need an authenticated authoritative service to assign each town an owner, issue revocable friend invitations, expose a deliberate visit permission, serialize inventory transactions, and retain transaction IDs across retries. Two local labels and a consent checkbox are not substitutes for those systems.

Friendship should open useful, low-pressure play: visiting a lived-in town, discovering a friend’s production specialty, and choosing when an exchange helps both places. Visits should not require surrendering control of the home economy. Shared simulation timing and how away towns progress require an explicit product decision before online implementation.

Human-town conflict is not implemented. If added later, it should require a separate invitation accepted by both town owners, state the allowed stakes and duration before acceptance, protect nonparticipants, and provide a clear way to leave. Its transaction and ownership checks must use the same authoritative boundaries as trade. Existing island NPC diplomacy and raids are separate systems and do not imply permission to attack a human town.

## Evidence and limits

`test/companion.test.mjs` covers home-key isolation, both directions of exchange, gifts and recipient consent, visit immutability, replay prevention, storage capacity and precision, retained construction/fieldwork/citizens/journal, malformed records, quota failures, interrupted mirror recovery, stale writers and exclusive browser-lock behavior. These are pure simulation/storage tests. The complete isolated browser flow and four tablet touch layouts passed serial verification; see `review/CLARITY_COMPANIONS_TABLET.md`. Native iPad keyboard behavior remains unverified. This document does not claim an online or two-person playtest.
