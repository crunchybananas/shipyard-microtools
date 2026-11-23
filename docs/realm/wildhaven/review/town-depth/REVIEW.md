# Town progression review — October 12, 2026

Release: `20261012-town-depth-1`. Integration branch: `codex/town-depth`, based on main `b8e88e2c`. The observed-world networking feature remains on its separate PR #184. The already-reviewed movement/medic increment from `e17d5a28` is included independently; its earlier recordings are in `../movement/`.

## What changed

- Three-stage research projects reserve real materials through partial deliveries. Staffed, supplied schools and survey workshops do the work. Stage boundaries wait for another delivery; pausing retains escrow, stopping returns only the current stage. Already-paid older projects finish without another charge.
- Goat pastures, henhouses and survey workshops, with original Blender models and upgrade variants. Goat kids and chicks mature through care over two and one calendar days respectively. Herds need grain and keepers, keep eating with full food storage, breed while space/care permit, and survive upgrades. Demolition cannot discard animals. Milk pails and egg baskets match keeper deliveries.
- Stone and iron ore reserves are finite and attached to land. The nearest three deposits within five tiles are shared between works. Rebuilding cannot reset extraction. Surveying plus level-two works opens a second finite reserve. Placement/inspection show remaining stock, and surface rocks shrink as extracted.
- Three research topics and two fieldbook expeditions connect these systems. Existing fieldwork state is preserved and new places appended.
- Stores includes animal feed and food flows; upgrade requirements use research names; help explains the new systems. No new library, frontend framework, or remote service.

## Verification

- `node --test test/*.test.mjs`: **434 passed**, no failures. Includes existing save/workforce/combat suites and new escrow conservation, stage gates, corruption rejection, legacy research/fieldbook migration, shared deposits, exhaustion, full-store behavior, births/maturation, upgrade cancellation, demolition protection, actual round-trip fieldwork at both new sites, and GLB bounds/pivot/pause tests. See `game-tests.txt`.
- `node scripts/verify-before-after.mjs` from repository root: **2020 checks, 33 apps, 9 stories**. See `archive-check.txt`.
- Background Codex in-app browser MCP, isolated localhost origin `127.0.0.1:4787`. No desktop or Screen Sharing control and no real saves. Default 1280×720, tablet 768×1024 and phone 390×844 reviewed. No document horizontal overflow at tablet/phone widths. Browser error log was empty.
- Started from the explicitly **prepared** town in `prepared-save.json`, using `setup.html`. Resources and completed prerequisite research are fixtures, not an earned campaign. Real game controls planned Winter feed and breeding, reserved a partial delivery, reloaded, completed its supply table, advanced all three stages at normal/3× game speeds, paused/resumed research, and completed the research. Each stage stopped for supplies.
- The real upgrade control then queued and completed pasture level two, preserving the herd. The prepared kid matured through normal simulation. A further kid was born during play (3 adults + 1 young). When grain ran out, food production stopped and condition declined. Exported `browser-save.json` validates through `sim.restore`, retains the completed research, level-two pasture and four animals (the youngest at age 184/720 seconds).
- `research-tablet.png` and `research-phone.png` show funded/partial research. `upgraded-pasture.png` shows the expanded shelter. `new-kid.png` records the birth and subsequent grain shortage.
- Original model source: `tools/create_husbandry_assets.py`, sharing the town generator's palette/helpers. Editable `.blend`, GLB and contact sheet retained. Buildings use one painted static mesh each; goat/hen animation retains separate head/leg pivots. The final GLB bounds and pivot tests pass.

## Limits and balance choices

This is targeted system and UI acceptance, not a new complete earned campaign or physical iPad run. Older saves begin with untouched mineral reserves because past extraction was not recorded. Works without deposits in range need a new site. Milk and eggs use the existing Food resource; this release does not add a separate dairy/egg inventory or additional ore species. Animals lose condition and stop growing under neglect but do not die. Breeding is an abstract husbandry process with two adults, not a sex/genetics simulation. Level three reuses the improved shelter with the existing level plaque and adds capacity. Woodland retains its existing three-day replanting system.

## Reproduce

Serve the Realm directory on an isolated localhost port, then open `wildhaven/review/town-depth/setup.html`. It refuses fixture writes on public origins. `node tools/town-depth-fixture.mjs` rebuilds the prepared save using public simulation build/workforce APIs with explicitly supplied stock/unlocks. Public Pages excludes this review folder, tests, tools, contact sheets and Blender sources.
