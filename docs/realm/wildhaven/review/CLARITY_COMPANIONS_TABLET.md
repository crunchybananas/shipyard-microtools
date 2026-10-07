# Wildhaven: clearer decisions, companion towns, and touch play

> Follow-up independent release review: [RELEASE_REVIEW_2026-10-07.md](RELEASE_REVIEW_2026-10-07.md). Final source is `1f50826`, with 194 tests and additional touch fixes. The source references and paired captures below retain the first-pass checkpoint.

This is a local review candidate for **Wildhaven**, the town/frontier resource RTS in `docs/realm/wildhaven`. It starts from published main `c3bbc7a03f86ca4de76d23b36d1dad1adc2a49a8` (the full verified revision is recorded in the source checkpoint). It does not change the older Realm game in `docs/realm/js`. No deployment, online service, invitation, or account was created.

## Player-facing changes

- Building placement has broad entrance arrows and a reserved approach. Selected and planned wells show a continuous reach boundary and home markers; actual supplied capacity remains distinct from geographic reach.
- Building choices show their actual recipes, labor and use. A windmill turns grain into flour for a bakery; it does not directly feed residents.
- A scrollable research map connects all 15 discoveries with their 19 actual prerequisites. Tapping a node shows costs and unlocks without spending resources; highlighted links distinguish required and next discoveries. Research exposes costs, all prerequisites and the buildings it opens. The town's three charter paths have direct choices and an actionable research gate.
- Tools enter the stockpile automatically when made or imported. The objective asks for tools **in stock**, with a route to the precise Stores row, local production chain or market quote.
- Watch staffing has direct controls, named guards, requested versus filled posts and food use. Coastal response choices remain separate from labor assignment.
- Job pictograms and selected resident callouts connect visible people to their actual occupation and activity. Paused assignments explain how to resume.
- The village journal survives reload. Optional malformed journal records are filtered without rejecting an otherwise valid earned village or granting rewards.
- A local companion-town prototype supports separate named towns, paused visits, management handoffs and explicitly accepted exchanges. It does not connect devices or enable player-versus-player conflict.
- Touch placement stages a preview before **Build here**. iPad landscape uses an on-demand Build drawer, a compact management dock and a collapsed objective so the island stays visible. Controls retain 44px touch targets.

## Save boundaries

`wildhaven.v4` remains the original home save. The companion envelope owns both snapshots and the offer ledger in `wildhaven.companions.v1`; an accepted exchange is one atomic envelope write. Quota failure before that write moves no goods. A failed home-mirror write after it is recoverable without replaying the exchange. Visits, blocked storage and competing writers cannot advance or mutate the town through normal UI actions. One browser writer lease protects both towns.

Switching towns also resets renderer state: reused building/citizen IDs cannot retain another town's positions or walking routes. Models and approved art were preserved. No economy recipes, resource prices, labor rules or charter effects were changed.

## Verification method

The serial browser runs use isolated storage in the installed Chrome and a loopback-only server. They do not use desktop UI, modify the user's real browser profile, or interact with CNC software. Fresh-play actions use actual controls and elapsed game time, not the review clock or injected resources. Mature UI tests explicitly load independently earned project fixtures. These are different evidence categories.

- Fresh control play: placed a cottage, orchard, quarry, kitchen garden and woodcutter; all five completed through the real 3× clock. Reload retained 11 earned journal entries.
- Companion flow: created two named towns, verified immutable visits, placed same-ID cottages at different locations, exchanged exact cargo with recipient acceptance, reloaded home, and blocked a second writing tab. Both towns' inventories and transforms were checked.
- Research graph: exact node/edge parity with the live catalog, touch details/back navigation, no spending on inspection, retained pan and keyboard focus during live updates; long dependencies route around unrelated cards.
- Mature controls: research prerequisite navigation, guard staffing, well reach/capacity, a named miller's paused activity, and a real-time resumed fieldbook survey, choosing Trading town with the exact displayed switching cost, and importing four tools directly into stock.
- iPad touch emulation: 768×1024, 1024×768, 820×1180 and 1180×820; touch preview, rotation, pan, pinch, confirmation, undo, panel scrolling, companion visits and orientation continuity.
- Before/after evidence uses matching earned town fixtures and viewports. All six earned-fixture pairs match gameplay state exactly after excluding only the deliberately repaired journal fields; their viewports and cameras also match. The separately started fresh placement scene differs in startup clock fractions and is excluded from exact-state claims and the published-style comparison story. Raw snapshots and capture reports are retained in `clarity-companions/`.

The evidence directory also retains initial attempts. One desktop harness initially assumed the wrong founder stock; its corrected run compares actual before/after inventory. The first tablet pass exposed landscape placement occlusion and prompted the compact tray. A graph attempt and a final capture attempt timed out during local module loading. Their clean repeats included request-failure logging; increasing only the local review server connection queue resolved the final capture interruption. Those failed attempts are not presented as passing evidence.

## Remaining limits

Native Safari on a physical iPad, hardware keyboard behavior, sustained iPad GPU performance and a two-person play session have not been verified. Chrome touch/viewport emulation does not prove those properties. No online multiplayer or human-town invasion is implemented. The candidate requires review before publication.

## Review checkpoint

Source commit: `dbae8edaba34a0b6c8e0c470051dae4a20aa008a`, branch `codex/wildhaven-clearer-living-towns`. This commit remains local.

193 game tests pass. The progress archive passes 2,020 checks across 33 apps and 9 stories. Final browser reports contain no page errors; source-pinned capture completed all eight scenes. Six earned-fixture pairs preserve exact gameplay state (except the intended journal repair), viewport and camera.

Open the local candidate at `http://127.0.0.1:14722/realm/wildhaven/`; the new comparison story is `http://127.0.0.1:14722/before-after/wildhaven-clearer-living-towns/`. The server is temporary. The public Wildhaven URL continues to serve the earlier published version. The archive's source link will become accessible only if this local commit is later pushed.

`clarity-companions/release-checkpoint.json` records source/file hashes, browser checks and comparison results. Final screenshots include `ipad-1024-research-overview.png`, `ipad-1180x820-opening.png`, `play-tools-stock.png`, and `play-chosen-path.png`.

Reproduction uses the already installed Chrome and Playwright package. Run `node --test docs/realm/wildhaven/test/*.test.mjs` and `node scripts/verify-before-after.mjs` from the repository root. The five browser harnesses are retained in `clarity-companions/qa/`; run them serially with the candidate served from `docs` at localhost port 14722. The capture harness accepts a label and base URL; use a separate baseline checkout/server for before images. Review hooks are localhost-only, and browser contexts use disposable storage. No browser installation is part of this workflow.

The next bounded milestone is a physical iPad Safari session covering landscape/portrait rotation, keyboard entry, research-map scroll, save/Continue, and a longer mature-town play session. A second person should then try the tools and path objectives without coaching before online companion work is considered.
