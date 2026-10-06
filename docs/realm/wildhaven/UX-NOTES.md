# Wildhaven interaction review notes

## Town expansion — October 2, 2026

The notes below began as the v1 design brief. Where the town simulation differs, these rules take precedence:

- A plan reserves its cost and enters the construction queue. Undo/cancellation refunds only the unused proportion; finished buildings salvage 75%. The project card states the refund before cancellation.
- Finite named workers are shared among construction, food, industry, services and the watch. Production requires staff and actual inputs. Resting a workplace releases its people; raising priority changes allocation order.
- Inspecting a workplace explains staffing, recipes, blocked inputs and the next upgrade's before/after values. The town book keeps the longer People, Projects, Stores, Council, Trade and Watch views in one consistent place.
- New plans preserve connected front entrances. The grounded entrance marker rotates with the model. Service boundaries show physical reach; individual home inspection and Stores report actual supplied capacity.
- Research, charter decisions, imports, exports and voyages state exact costs and unmet requirements. The three charter ambitions permit different industries and research choices. Selling surplus can fund imported goods instead of a local production chain.
- Coastal warnings expose deadlines, goods at risk, supplied guards and patrol work. Payment, shelter and prepared defense are distinct actions. No resident or building disappears after a failed defense.
- A saved town opens paused. V1 migration writes a separate v2 save and preserves the original. Browser test fixtures never replace the user's town.
- Phone summaries use short labels; text bounds are checked, not only document width. Town-book scrolling retains keyboard focus and scroll position while values update.

Rendered reviews remain required: legal paths and separated bodies alone do not prove a crowd is moving. Workstation tools must read at the gameplay camera scale, and both sustained movement and sampled poses matter.

## First ninety seconds

1. Begin with a readable island, the old bell, a few people and a modest stockpile. Keep the camera close enough to see a villager's hat and stride. The first instruction is a single action: “Make a place to come home to. Build a cottage.”
2. Hovering or focusing the cottage card shows its timber/stone cost and housing gain. Selecting it immediately puts a full-size ghost on the island. Valid siting should feel affirmative: the ghost retains its material color, with a small grounded perimeter. Invalid siting explains the exact reason beside the pointer and never spends resources.
3. The first cottage should visibly attract someone. A small world event (a person walking toward the new door, a window warming) communicates success before any counter changes. The next instruction is an orchard, with food production and habitat clearly explained.
4. Show the resource loop early: an orchard produces food; a timber yard earns back what the next home consumes; a quarry supports the village bell. Restore the bell only after the player understands that cycle. The bell is a landmark visible from the opening frame.

## Information hierarchy

- The world is primary. The top supplies bar gives current quantities and net production per day. A total without a rate leaves the player guessing whether waiting can solve a shortage.
- One current ambition belongs in the notebook, with explicit progress toward the next useful action. Past achievements can fold away; new instructions should not compete with five checklists.
- Building cards show costs before selection and remain legible when unaffordable. Explain a shortage on the card; do not silently disable it.
- The contextual inspector explains the selected building's actual output and why it has that output. “Timber: 4/day · 3 nearby trees” teaches siting. Avoid invisible adjacency bonuses.
- Do not put tutorial prose in transient toasts. Toasts confirm a completed action or explain a failed one; persistent guidance stays in the notebook.
- Supply changes should primarily live in the compact HUD. Avoid floating +1 effects over every building and any decoration that looks like a clickable object.

## Controls and accessibility

- Primary click/tap places a selected building or inspects an existing one. Escape or right click cancels placement, then closes the inspector. A visible Cancel action is necessary on touch.
- Drag moves the camera; mouse wheel or a two-finger gesture zooms. Ignore tiny pointer motion when distinguishing a click from a drag. Losing pointer capture must end the gesture.
- A visible home-camera button recovers the composition. Keep zoom bounds tight enough that the island and people remain useful to look at.
- Rotation should have an explicit button as well as a keyboard shortcut. Building cards should support keyboard focus, Enter/Space activation and a visible focus ring.
- Pause, speed and sound belong in a stable location and expose their current state. Use names such as “Sound on” and “Sound off” rather than a speaker glyph alone.
- Touch targets should be at least 44px. At a narrow width the building shelf can scroll horizontally, while the current ambition collapses to one concise line. Keep the resource totals visible.
- Honor reduced motion for camera easing, flourish and celebratory motion. Keep the information and victory state available without animation.

## Avoiding deadlocks

- The opening budget must cover shelter, food and a renewable source of building materials even after one reasonable mistaken placement.
- Undo should restore the complete pre-placement state for the last placement; salvage should disclose its refund before demolition. The last essential food or timber producer deserves a clear consequence preview.
- No population death spiral is necessary for this gentle setting. At zero food, pause new arrivals and explain how to recover. Preserve existing residents and the ability to build a food source.
- Waiting should earn something useful whenever production is established. Show “+4/day” and the day countdown so the player understands the path out of a shortage.
- The bell goal must be achievable with the generated island's resource coverage and legal sites. Do not require a rare tree/rock placement that an unlucky seed cannot supply.
- Autosave after irreversible actions and at day changes. Do not advance simulation while the tab is hidden. Reset needs a deliberate second step and must not share placement shortcuts.

## Sound integration

`js/audio.js` exports `createAudio(options)` both named and as default; `Soundscape` is also named. Construction never creates an AudioContext. Call `start()` within a user gesture, optionally awaiting it before a first sound. The sound control calls `mute(boolean)` or `mute()` to toggle; it returns the new muted state. The caller owns preference persistence.

`play(kind)` accepts `build`, `remove`, `select`, `error`, `day`, `bell`, and `win`. It returns whether a sound was accepted. `dispose()` removes the visibility listener and closes the AudioContext. Visibility changes automatically silence every active and future note, stop the bird timer, and suspend audio. Returning resumes the quiet ambience if sound was already started and unmuted.

The sound palette is original synthesized timber percussion, low metallic bell partials, filtered wind and infrequent restrained birds. No melody loops or asset downloads. `win` is the substantial bell harmony; call it only once when the bell is restored. Continued play can use `bell` for occasional intentional interaction with the landmark. Do not ring the celebration on reload merely because a saved village has already won.

Audio is optional: unsupported Web Audio or a refused context does not interrupt the game. Muting cancels scheduled notes immediately, including the delayed victory harmony. Repeated hover feedback is rate-limited. Actual perceived balance still needs a listening pass on headphones and speakers alongside the renderer.
