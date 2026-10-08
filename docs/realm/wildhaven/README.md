# Wildhaven

A browser-native 3D town and frontier game alongside Realm. Start with six named neighbors, employ a construction crew, turn raw materials into useful goods, and decide how the town grows. The bell is the first milestone; the economy continues through civic services, research, upgraded neighborhoods and coastal trade. Beyond the village are four more regions, three neighboring settlements, physical walls and gates, and a company recruited from the same named population. An island fieldbook now gives named surveyors and restorers four old places to investigate and return to village life. Nearby work has its own original sound.

All new implementation and original art live in this folder. Existing Realm files and saves are separate. The broader goal is an RTS with sustained depth inspired by Stronghold, Caesar III, SimCity and Warcraft; see `FRONTIER_PLAN.md` and `review/FRONTIER_VERIFICATION.md` for scope and evidence limits.

## Public release

[Play Wildhaven](https://crunchybananas.github.io/shipyard-microtools/realm/). The Realm entry URL redirects to `wildhaven/`; the original game remains at `../legacy.html` with its save keys unchanged. GitHub Pages publishes `main` through `.github/workflows/deploy.yml`. A development-branch push alone does not publish.

The repository retains editable Blender sources and verification history. The Pages artifact includes runtime code, GLB models and metadata, while excluding the Wildhaven review archive, source `.blend` files, generator tools and tests. The workflow runs the simulation suite before publishing. Localhost and GitHub Pages have separate browser storage.

## Play locally

Serve the **Realm directory**, so the existing vendored Three.js modules are available:

```sh
python3 scripts/_serve.py --port 4751 --bind 127.0.0.1 --directory .
```

Open [Wildhaven](http://127.0.0.1:4751/wildhaven/). No install, build step, CDN or account is needed. A current WebGL 2 browser is required. The ES modules need HTTP.

## Starting a town

1. Queue a cottage, then an orchard or kitchen garden. Materials are reserved when you place the plan. Builders raise one project at a time; housing and output begin after completion.
2. Add a woodcutter near forest and stoneworks near rock. Open **People & jobs** to divide your finite workforce. Builders take priority while projects are active, then return to other work. Raised workplace priorities fill first. The founders are reserve gatherers when other jobs leave people free.
3. Keep food and spare beds for arrivals. Three completed cottages, two orchards/gardens and ten residents permit the bell restoration. Its completion opens the longer town ambitions.
4. Staff a school or deliver coastal orders to earn knowledge. Research branches unlock farming, joinery, metalwork, textiles, navigation, public services and the watch. A town charter favors harvests, industry or trade, with stated costs and disadvantages.
5. Upgrade homes and workplaces using crafted goods. Upgrades enter the same construction queue and close production until finished. Existing residents retain their beds during a home upgrade. Cottages provide 4, 7, then 10 beds; upgraded cottages have a new two-story model.

A calendar day is six minutes at 1×; the existing 90-second economy cycle is unchanged. Pause freely or use 3×. Building placement explains siting, cost and work; inspection shows staff, inputs, output, shortages and upgrades. The construction book supports reorder, pause and proportional unused-material refunds. Completed buildings salvage 75% of invested materials; occupied housing is protected.

## Production, neighborhoods and the coast

The 25 building types use 14 resources and 18 town occupations; spearmen, archers, engineers, envoys, surveyors and restorers add six frontier roles. Every assigned citizen has one workplace and retained job experience. Chains include grain → flour → bread, timber → planks, ore → iron → tools, and flax → cloth. Fuel, food, linen and other inputs are consumed by actual staffed work. Warehouses expand physical storage.

Growth creates neighborhood requirements: beyond 20 residents, wells must cover half the housing; beyond 40, staffed and supplied clinics must cover 40%; beyond 60, a chapel or supplied brewhouse must serve 35%. Service placement and inspection mark reach on the ground and highlight homes. Actual access also depends on supplied service capacity: partially staffed clinics serve fewer beds, and overlapping catchments cannot count the same household twice. Food and morale still matter, and existing residents stay when growth is blocked.

A supplied market can buy selected grain, food, planks, cloth, iron, tools and ale for coin, or sell a surplus under visible daily quotas. A Free Port buys more cargo at lower prices; this can replace entire local production chains. Each charter has a different specialty ambition instead of requiring every technology and building.

Deliver timed coastal orders for coin, knowledge and named-harbor trust. Trust and research open voyages; distant routes require a staffed market and escort readiness. Departure cargo and returns are fixed when a voyage begins, and capacity can limit unloading. A daily landing exchange remains a small recovery option.

After the bell and twenty residents, lookouts begin warning of coastal raiders. **The watch** shows the arrival day, demand, readiness, patrol progress and bounded cargo losses. You can provision the crew, spend materials to shelter stores, or keep supplied guards on patrol. Researched organization and experienced guards improve readiness. Warehouses reduce exposure. A prepared defense earns coin and partner trust; a failed defense takes supplies, leaves people/buildings intact and grants five quiet days to recover. These coastal cargo incidents remain a separate economic decision from the physical armies on the island.

## The island and its neighbors

Open **Frontier** (F) for Defenses, Company and Neighbors. The interactive chart shows the whole coastline, claimed regions, settlements and troops. Tap it or use a Find button to move the camera. The land has no fog overlay.

A watch house trains spearmen and archers from named residents. Recruitment pays equipment and provisions, takes time, and vacates that citizen’s civilian job. Select one or several troops, then Move, Attack, Hold or Retreat; the panel folds away while you choose a point or enemy. Ground rings identify selected troops. Archers need line of sight and their arrows take time to arrive. Wounded residents return home to recover; repeated defeats can be fatal. Treatment costs food and linen. At home, healthy troops can return to civilian work; training can also be cancelled, without an equipment refund.

Walls, gates, towers and claiming outposts reserve materials and assign a real resident to walk to the site and build it. A wall line shows its full quote before **Build sections** spends anything. Rotated open gates permit passage through their opening; closed gates block both sides. Keep a route to town entrances. A nearby archer gives a tower its firepower. Defenses take real damage, become rubble, and require labor and supplies to repair. Cancel unfinished work for unused materials or salvage a completed defense for its stated recovery. Removing a claiming outpost closes that region to new construction; existing homes and workplaces remain.

An envoy physically travels to a settlement and back, leaving a town job vacant. Contact opens explicit trades, relations and diplomacy. Repeated exchanges can earn an alliance and temporary reinforcements. Declaring war creates an armed garrison and schedules attacking columns; a paid truce or the fall of its stronghold ends attacks. Frontier exploration also attracts announced bandit raids. Intercept them, hold a gate or watch them retreat with stolen cargo.

Scouting reveals a region for settlement. Pay for an outpost and let its builder finish before placing ordinary town buildings there. Hearthvale, Pineward, Highmeadow, Reedmarch and Crownhill are connected, traversable parts of the same island. Neighbors’ compounds and their approaches remain reserved.

## The living island

Press **B** or open **Fieldbook**. Choose a resident to survey the mason’s waystone, foxglove spring, sleeping kiln or star garden. Each trip costs six food, reserves that person from village work, follows actual paths and gates, and takes 22 seconds of study at the site. The report becomes available only when the surveyor reaches home. Nearby hostile troops trigger a retreat.

The building catalog folds while you read and returns when you close the book. Find turns the camera toward the place from its open approach. Short laptop windows use a compact illustrated page; longer reports and restoration choices scroll within the book.

After the report, choose a lasting restoration or a one-time material recovery. Restorations consume their quoted supplies, take a named restorer to the site, and activate on return: faster town construction, better garden/orchard yields, more output from stone and metal crafts, or more school knowledge. Salvage gives the listed goods up to available storage instead. Commissioning commits the choice. Recall retains paid materials and site progress; resuming a commissioned project costs nothing more. The fieldbook credits the actual resident and day.

Workshop deliveries now show the job’s output: logs, stone, ore, planks, iron, tools, fruit, vegetables, grain, flour, bread, flax, cloth or ale. These ordinary delivery animations present existing production; they do not award duplicate resources. Tap a resident to see their current activity and actual job.

Sound remains opt-in. Thirteen original procedural Foley cues cover footsteps, axes, hammers, chisels, anvils, saws, rustling, cloth, pages, cargo, bows, impacts and gates. Camera position controls stereo placement and distance; pause silences ongoing work cues. **Sound settings** separates work/action volume from breeze/birds. Muting and hiding the page stop scheduled sources. No audio downloads or sound library are required.

## Controls and saves

Drag to pan; scroll/pinch to zoom. Q/E or right-drag turns the island; WASD/arrows pan; Home recenters. Space pauses. 1–8 select from the current building category; R rotates; Escape cancels. T opens the town book; F opens Frontier; B opens the fieldbook; Ctrl/Command Z cancels the latest unfinished construction for unused materials. H opens help; P hides the interface for a photo. Tap a citizen to inspect their actual job and experience.

The shelf and town book scroll on touch. Every core action also has a visible control. Sound is optional, starts after a user gesture, and defaults off.

V4 saves use `wildhaven.v4`; sound and mixer preferences use `wildhaven.preferences.v1`. If no v4 save exists, a valid v3, v2 or v1 village is migrated, preserving all older keys. Projects, named citizens, experience, research, trade, frontier orders, wounds, diplomacy, claims, defenses, fieldwork, paid restoration progress and discovery choices persist. Resumed towns open paused. Hidden tabs, dialogs and time away do not advance the game. Realm save keys are untouched.

## Source and verification

- `js/sim.js`: authoritative labor, recipes, construction, needs, upgrades, shared timing and saves.
- `js/island.js`: canonical island geography, regions, compounds and natural obstacles.
- `js/frontier.js`: paid recruitment, physical movement/combat, defenses, diplomacy and claims.
- `js/catalog.js`, `js/progression.js`, `js/pressure.js`: shared economy definitions, research/trade choices and coastal incidents.
- `js/world.js`: Three.js terrain, models, articulated workers, station routing, coverage and coastal presentation.
- `js/main.js`, `js/town-ui.js`, `js/frontier-ui.js`, `style.css`, `frontier.css`: plain DOM controls and town management.
- `js/discovery.js`, `js/fieldbook-ui.js`, `living.css`: canonical places, durable fieldwork validation, bonuses and fieldbook controls.
- `js/audio.js`: original Web Audio ambience, spatial Foley and independent mix buses.
- `tools/create_assets.py`, `tools/create_town_assets.py`, `tools/create_frontier_assets.py`, `tools/create_living_assets.py`: reproducible editable Blender sources; see `ASSETS.md`.

Three.js 0.180.0 is the only game library, reused from `../vendor/three/` under MIT. There is no UI framework. Playwright is a development dependency only.

```sh
node --test wildhaven/test/*.test.mjs
node wildhaven/tools/living-campaign.mjs
TRAFFIC_SECONDS=120 TRAFFIC_REPORT=living-traffic-report.json node wildhaven/tools/town-traffic.mjs
# With the local server running:
node wildhaven/tools/living-review.mjs
WILDHAVEN_REVIEW_PREFIX=living- node wildhaven/tools/town-playthrough.mjs
```

Browser tests use isolated contexts and never overwrite the user's town. Opening tests use real controls with the review clock to skip waits. Some late-game interface and rendering checks use a separately earned campaign checkpoint; those reports label this distinction. The writable review API exists only on localhost with `?review`.

`review-town.html` is a separate visual review page for the three earned town checkpoints. It runs worker motion, offers camera/worker controls and shows render diagnostics, while leaving the economy frozen and never reading or writing the player's local save. `review/LIVING_ISLAND_VERIFICATION.md` records current evidence and limits. The v3 frontier checkpoint remains in `review/FRONTIER_VERIFICATION.md`.

The original `tools/playthrough.mjs`, `tools/navigation.mjs` and older `review/qa-*` evidence belong to v1 and are retained as history. The v2 town reports remain historical; the v3 frontier reports have a `frontier-` prefix and this v4 increment uses `living-`. The original local checkpoint was committed as `30dbd2fb`; its reports retain their historical status and source hashes. The public release brings this Wildhaven directory and its vendored Three.js dependencies onto `main` without merging unrelated development-branch work.

## Calendar and compact controls (October 2026)

A displayed day now lasts six minutes at 1×. The original 90-second economy cycle is retained for production, meals, arrivals, market quotas and saved deadlines; movement, combat, construction and fieldwork keep their previous timings. The sky, calendar and day chime use the slower clock. Goods rates are shown per minute and pending deliveries or threats use countdowns at 1×. Pausing and 3× retain their existing behavior.

V4 saves remain compatible. A validated calendar epoch preserves the current day and time on the first load of an older village, preserves earlier date labels, and prevents later reloads from re-anchoring the clock.

Build and Town are now available in the bottom dock on all devices. The building catalogue opens on request and closes during placement. Home camera control lives beside the camera buttons; the large title is removed from the HUD. Generated transparent painted resource icons replace the CSS resource shapes. Their source prompt is in `assets/resource-icons-prompt.txt`; model-derived building and landmark thumbnails remain actual views of the 3D assets.

The entry document versions its styles and native import-map module URLs together. Bump the shared `v` token in `index.html` for runtime releases so cached modules cannot mix old and new interface behavior. The 3D vendor library remains unchanged.


## Living woodland and deliberate controls (October 7, 2026)

Woodcutters draw timber from the nearest twelve original island trees. Those trees have shared stock (8 timber each): overlapping yards cannot harvest the same stock twice. Exhausting a tree leaves a visible stump. A staffed, ready yard automatically replants its stumps (12 person-seconds per sapling); a planted sapling grows independently for 180 seconds at 1× before it can yield timber again. A yard can still work at a distance, retaining the previous forest adjacency bonus. Hearth gatherers retain their small recovery supply of loose wood. Felling does not change construction or walking-route rules. Groves exclude footprints occupied by buildings, defenses and discoveries, using the same occupancy set as the renderer. This pass visualizes harvesting and regrowth; resident routes still use the yard's chopping stations rather than individual tree visits.

Woodland history is optional, validated data in the existing v4 envelope. Older saves receive mature woodland without changing resources, dates or assignments. Inspection of a tree shows stock or growth; Find young woodland follows a replanted tree through its next harvest; woodcutter inspection and the workforce book show mature trees, saplings and stumps. The axe attachment turns the blade about the shaft, preserving the grip and vertical cutting plane.

Opening Town, Fieldbook, Frontier, Journal or Companion pauses simulation while reading and restores the previous speed when all reading screens close. A visible notice offers Run while open. Explicit speed choices override that automatic hold; a manually paused village stays paused. Construction placement and ordinary inspection continue at the chosen speed.

World selection uses the nearest rendered physical surface, including tree and rock instances and terrain. Invisible ancestors, hidden carried props, zero-opacity materials, non-depth-writing cues, dead units and clipped construction geometry cannot intercept a click. Trees expose their own inspection instead of selecting a resident hidden behind them.

Validation: 229 Node tests, including shared forest stock, depletion/regrowth, save migration, explicit/manual reading-clock choices, 17 real Three.js picking cases and the authored GLB axe across a swing. Runtime import-map and CSS tokens use 20261007-living-woodland-2.
