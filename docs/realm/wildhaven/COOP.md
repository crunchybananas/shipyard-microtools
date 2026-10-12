# Online co-op

Two players manage separate towns and contribute to one shared storehouse. Open **Play together**, create an account, name your town and create a partnership. Give its private invitation to your partner; they sign in with their own account and join from their own town. The invitation lasts seven days and can be replaced or revoked before it is used.

The storehouse needs 60 timber, 40 stone and 40 food. Either town can send any portion. The ledger shows each town's deliveries and the remaining cost. Completion permanently adds 20 capacity to each ordinary stored resource in both towns. Coin and knowledge are excluded. Completing another partnership does not stack the reward. The model in the panel changes from a construction frame to the finished storehouse.

Each town runs only while its owner plays. Opening the co-op panel uses the existing reading pause. A partner can contribute while the other is away; their reward is applied when they reconnect. Progress refreshes every 15 seconds while the home town is visible. Visits, direct player trade and additional shared projects are follow-up work in issues #180 and #181.

## Saves and account recovery

Accounts recover partnership membership, not the full town. Towns remain in the existing local v4 save and companion-town record. **Town backup & moving devices** downloads the town as JSON and can import a validated backup. Download the current town before confirming an import. Use one device at a time per town. An older backup whose delivery sequence disagrees with the server is blocked from sending further goods.

The original local companion-town prototype remains available inside Play together. Online actions are available only for the original home town. Switching towns while a request is in flight cannot apply its response to the newly selected town. Linked towns cannot be replaced with a new village until their partnership is ended and unlinked.

A delivery reserves inventory in the same durable save as its operation ID before contacting the service. The service atomically updates project progress and writes an immutable receipt. The town then refunds any excess and records that receipt in one save. If the connection fails after the service accepts a delivery, retrying retrieves the original receipt. A failed local write retains the reservation. Closing a partnership allows outstanding deliveries to settle; unaccepted goods are refunded, confirmed project contributions are not withdrawn. Either member can end the partnership after an explicit confirmation; earned storage remains.

## Service

The browser uses native fetch, Firebase Authentication REST and Firestore REST. There is no additional client library or game framework. Public connection information is in `js/coop-config.js`; it is not an administrator credential. Email/password sessions are kept separately from town exports. Passwords are never stored by the game. Password reset uses Firebase's recovery email flow.

The isolated project is `island-town-coop-20261011`, Firestore Native/Standard in `nam5`. It has no billing account attached as of deployment. Free service quotas can make online actions temporarily unavailable; local play continues. Do not deploy this service using the repository's root Firebase configuration, which belongs to a different application.

Firestore rules permit member-only room reads, single-use invited joins, one active partnership per account, bounded atomic contributions, immutable receipts and private player profiles. Room/receipt listing and client deletion are denied. This is cooperative local-town play: the shared ledger is protected, but the browser's local town economy is not an authoritative server simulation or an anti-cheat system.

Deploy the rules with the account authorized for this dedicated project:

```sh
gcloud auth login
python3 service/deploy-rules.py
```

Authentication, Firestore and the project must already exist. The script deploys only `service/firestore.rules` to the named project and prints the resulting ruleset/release identifiers. Frontend assets continue to ship through the repository's normal GitHub Pages workflow.

## Verification

```sh
node --test test/*.test.mjs
```

For the service tests, run the official Firestore emulator with project `demo-island-coop`, host `127.0.0.1`, port `8085` and `service/firestore.rules`. No live accounts or credentials are needed. The tests use unsigned tokens accepted only by the emulator.

```sh
node service/load-rules.mjs
node --test service/rules.test.mjs
```

The service tests cover concurrent final deliveries, immutable retry receipts, private reads, invalid/revoked invites, a third player, duplicate membership, forged receipts and resource deltas, extra fields, room reopening, and loss of a commit response followed by recovery from a serialized town. Game tests cover save failures, duplicate refunds, stale saves, permanent rewards, background-refresh interaction and switching towns during a request.

Release checks on 2026-10-11 used three isolated test accounts against the live service, then two independent browser saves through computer-control MCP. A private invite linked Alder Bay and Willow Point. Willow supplied 40 stone; Alder supplied 60 timber and 40 food. Both showed the complete ledger and 220 capacity, with separate inventories. Reload/reconnect retained membership and progress. A town backup downloaded without authentication credentials.

The iPad Pro 11-inch (M5) simulator on iPadOS 27 loaded the actual WebGL game and co-op form in Safari. Native MCP touch/input worked intermittently, then failed with unavailable-window errors; a full iPad co-op playthrough was not completed. Keyboard-aware panel sizing and explicit Safari button styling are included, but physical iPad testing remains necessary.
