# Creature Field Notes: The Heartwood Trail

Playable chapter: explore the Frog Alchemist's pond, restore its lantern path, then solve the lantern-remedy riddle. Plain HTML, CSS and native JavaScript modules. No runtime dependencies, build step, framework, analytics or external requests.

Serve `docs/` with any static server, then visit `/creature-field-notes/`. For example:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs
```

The game uses semantic buttons for touch and keyboard (no dragging required), hash routes for Back/Forward, IndexedDB for a versioned local journal, native dialogs for destructive changes, and optional synthesized Web Audio. Sound defaults off. Reduced-motion preferences are honored. The only playable encounter is the pond; other inhabitants are explicitly future work. Purchases are not required and no shop inventory is claimed.

## Test

```sh
node scripts/verify-heartwood.mjs
node scripts/verify-heartwood-browser.mjs
```

The browser check uses the repository's existing Playwright installation and isolated profiles, not the user's signed-in browser. It exercises completion, wrong recipes, replay, reload, navigation, reset cancellation/confirmation, import validation and mobile layout. It does not install a browser or alter other game saves.

## Art

The final heart-edited Frog Alchemist tile master is the character source. Keep the source unmodified and document provenance in `assets/README.md`. Do not substitute generic fantasy artwork. Native SVG scene decoration is illustrative, not a new character design. All five final SVGs are included without contour changes. The frog’s heart clasp and robot’s chest heart are intact.

Canvas fireflies, native Web Animations ingredient flights, bubbling potion/heart light, and progressive View Transitions provide movement around the original art. Motion and sound have independent controls. Motion follows the system reduced-motion preference and the canvas stops offscreen or when the page is hidden.

## Deliberate scope

No service worker yet, no cloud sync, no checkout, and no other four puzzles. Local journal export/import is supported. A static HTTP origin is required for ES modules; opening `index.html` directly as a `file:` URL is not supported.

## Exploration update

A 7×7 turn-based path game adds route planning: collect three ingredients, kindle three refill lanterns, and return home before brewing. Each move spends light. A safe return preserves discoveries and records an assist; a 32-step, zero-return route is possible. Map feedback sits above the board, ingredient buttons only add once, and removal has separate named controls. Touch tiles, directional buttons, and board-scoped keyboard movement are supported. There is no timer. Route state resets on page reload; collected ingredients and the earned journal remain saved.
