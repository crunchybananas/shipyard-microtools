# Resource clarity, seasons, and harvest festival

Ready for review, **not published**. Based on deployed commit `718656174209da49e273baebf0f93dce23d030bc`; branch `codex/wildhaven-resource-seasons`. Runtime version `20261008-seasons-1`.

Tapping a HUD resource now opens its own detail inside Stores. All 14 goods use the same surface; People opens jobs. Food distinguishes production, workplace use, and household meals, explains the next meal, and shows how many meals the current pantry alone covers. Other declining stocks offer a conditional estimate at current rates. One-time spending and full-storage throttling are explicitly explained. Manage jobs and Get more sit immediately below the forecast; local plans and actual import quotes show their costs before any purchase. Looking, backing out, and canceling spend nothing.

[Landscape Food panel](resource-seasons-2026-10-08/ipad-landscape-food.png) · [Portrait](resource-seasons-2026-10-08/ipad-portrait-food.png) · [Phone](resource-seasons-2026-10-08/phone-food.png)

## Seasons and celebration

The existing in-game calendar drives Spring, Summer, Autumn, and Winter. Each lasts three displayed days, or 18 minutes at 1×; a year is 12 days. The first autumn starts after 36 minutes at 1×. Pausing, reading, speed changes, and being away preserve the existing clock behavior. The date button opens the seasonal calendar within Food, avoiding another HUD panel.

Scenery changes through existing terrain and foliage colors, flowers, and daylight. Evergreen trees retain their character; trunks, navigation, actors, water, and production rules are preserved. Winter imposes no crop or economic penalties.

[Spring](resource-seasons-2026-10-08/season-spring.png) · [Summer](resource-seasons-2026-10-08/season-summer.png) · [Autumn](resource-seasons-2026-10-08/season-autumn.png) · [Winter](resource-seasons-2026-10-08/season-winter.png)

The harvest festival is available once per autumn/year. Its food cost is `max(12, ceil(population × 1.5))`; at least two modified household meals must remain when paying. That food remains available for ordinary town use afterward. The preview shows cost, remaining food, and **+8 effective morale, capped at 100, for one calendar day / 360 simulation seconds**. Baseline morale is stored separately and continues its normal meal/service behavior, so the festival cannot permanently inflate it. Temporary hearth bunting follows the same timer. Confirmation rechecks the quote and affordability; repeated presses cannot repeat the purchase.

[Confirmed festival](resource-seasons-2026-10-08/festival-confirmed.png)

Optional per-town metadata preserves v1–v4 saves, separate companion histories, active celebrations on reload, and annual eligibility. There is no real-world event deadline or offline catch-up. Ration settings and later crop/trade/winter systems were not added.

## Illustration library and compact layouts

One ImageGen request produced the reusable pantry illustration in `assets/resource-pantry.jpg` (312 KB). The original PNG is preserved in the task workspace. `ASSETS.md` records provenance and the runtime hash. The art is decorative, reduced in Food, and hidden on short screens. Existing resource icons remain unchanged. The future creator-signature concept is separate and has not been substituted here.

All new controls have 44px targets. Resource and calendar navigation retain reading pause, exclusive panel behavior, disclosure state, scroll, and keyboard focus. At short landscape heights, the Town book occupies the space above the dock with a compact heading and opaque backdrop, instead of leaving only a narrow content strip.

## Validation

- **305 / 305 Node tests pass**, including new rate accounting, meal forecasts, v1–v4 migration, stale affordability, annual repeat protection, fractional expiry, pause/3× progression, reload, per-town isolation, real GLB foliage preservation, and geometry reuse.
- All **33 runtime JavaScript modules parse**. `git diff --check` passes. The existing archive verifier passes **2,020 checks**. The local ESLint executable was unavailable; no package/application was installed.
- Serial isolated Chromium checks at **1180×820 touch, 820×1180 touch, 390×844 touch, and 1440×900 mouse** pass: HUD and all 14 resource destinations, actual jobs/import/plan links, non-spending previews/cancellation, festival confirmation/reload/expiry, focus return, and panel bounds. Food's first actions are visible above the fold on landscape iPad.
- Additional actual input checks pass: food becomes insufficient while Confirm is held; canceled pointer press spends nothing; successful confirmation retains focus; rotation; **667×375 touch** layout with more than 120px of reading space; 3× reading pause and explicit Run while open; immutable active and persisted companion visits. No application page/loading errors in the final checks. Physical iPad Safari, hardware input, and sustained native-device performance still need device testing.
- Seasonal dates and boundary stocks in browser checks are explicitly staged engineering fixtures, not newly earned play. Calendar/food progression itself is also tested with normal simulation ticks. Screenshots cover the four ordinary viewports; the short-screen backdrop opacity was finalized after its bounds/input check without changing layout.

Evidence: [browser receipt](resource-seasons-2026-10-08/receipt.json), [edge receipt](resource-seasons-2026-10-08/edge-receipt.json), [test log](resource-seasons-2026-10-08/unit-tests-final.log), [47 runtime hashes](resource-seasons-2026-10-08/runtime-sha256.json), and both browser harnesses in the same folder. Early attempts are retained: a resize assertion before styles settled, one preview loading timeout, and a missing preview-server favicon subsequently excluded from application-error checks. No evidence was deleted.

No push, PR, merge, or deployment occurred. The first-bread draft remains separate. No desktop UI, CNC/controller/Makera files, moth design, MyStory, local memories, settings, or installed applications were changed.

The next seasonal design step should be a small, clearly forecast seasonal trade or preparation choice with a visible payoff. Crop penalties or survival winters should wait until players can understand and prepare for them; this first slice establishes the calendar and a voluntary celebration.
