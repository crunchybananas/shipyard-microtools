# Microtools ideas

## Creature Field Notes: The Heartwood Trail

**Status:** Frog Alchemist first playable prototype implemented in `docs/creature-field-notes/`. Added November 13, 2026 at Cory’s request; implementation requested later that day. First playable release prepared for main at Cory’s request.

A small, beautiful browser game and character website that gives the original
Creature Field Notes tile characters a world to live in. Players explore a
Blue Ridge-inspired woodland, help its odd inhabitants, and fill an illustrated
field journal. The physical tiles feel like artifacts from that world rather
than merchandise attached to an unrelated game.

### The first five inhabitants

- **Frog Alchemist:** Mix a gentle remedy from visual ingredient clues. Preserve
  the heart-shaped clasp connecting the cape.
- **Woodland Robot:** Repair a little trail lantern by routing light through a
  short circuit puzzle. Preserve the heart on its chest, replacing the leaf.
- **Blue Ridge Night Creature:** Find the creature by comparing its silhouette,
  tracks and a moonlit ridge scene.
- **Mushroom Cartographer:** Rotate and connect a few map fragments to reveal a
  hidden route through the forest.
- **Creek Salamander Stargazer:** Connect a small constellation using its
  reflection in the creek.

Names beyond these existing character labels are provisional. Keep the accepted
artwork and silhouettes recognizable; do not replace them with generic fantasy
sprites or licensed characters. Use the final heart-edited tile artwork as the
character reference, not the earlier mockups with the original chest/clasp.

### Play loop

1. Open the site and start immediately, without an account or purchase.
2. Choose a stop on a small illustrated trail map.
3. Meet a character, explore a scene and solve a tactile 2–5 minute puzzle.
4. Earn a field-note plate with a short story, animation and journal entry.
5. Finish all five encounters to light the trail for a quiet shared ending.

No combat, grind, timed streak penalties or artificial scarcity. Aim for a
complete 15–25 minute first chapter that is pleasant to replay. Use subtle
movement, sound and reactions to make a small world feel alive, not a giant
simulation to maintain.

### A website that complements the physical work

Each character gets a shareable page combining its journal entry, accepted
illustration, making-of photos and an unobtrusive link to its physical tile or
carving when the product is actually available. Keep play separate from checkout.
A printed card or a small mark on the frame/back could point an independently
sold piece to its character page. No camera, QR scanner or collectible-code
backend is required for the first version. Follow marketplace rules separately
for anything included with Etsy orders; do not route Etsy checkout off-platform.

Purchases are not needed to finish the game. Future physical pieces can inspire
new optional episodes, but no promised unlocks, stock status or maker’s mark
should be invented before those decisions are made.

### Modern web technology, no frameworks

This concept follows Cory’s explicit no-framework request and the current repo
README: canonical apps live under `docs/` as plain HTML/CSS/JavaScript. Do not
revive the archived Ember mirrors or use React, Vue, Svelte, a game engine or a
CSS framework for this project.

- Native JavaScript ES modules and a small explicit state machine for each
  encounter. Start with readable separate modules and no runtime dependencies.
- Semantic HTML for navigation, journal and controls; SVG for crisp illustrated
  scenes and hit targets. Use Canvas 2D only where it materially helps, not as a
  replacement for accessible UI. WebGPU is unnecessary for this first chapter.
- Modern CSS: grid, container queries, custom properties, `clamp()` and `oklch()`.
  Optional View Transitions and scroll-driven effects are progressive
  enhancements with immediate/nonanimated fallbacks.
- Pointer Events for touch, pen and mouse, plus keyboard controls. Every drag
  puzzle must have a tap/select or keyboard alternative.
- Web Animations API for small reactions; `prefers-reduced-motion` respected.
  Web Audio starts only after a deliberate user gesture, with a persistent mute.
- IndexedDB for local progress with a versioned save format. Provide explicit
  export/import and reset controls; explain that local progress does not
  automatically sync between devices. No login or backend for the first chapter.
- A narrowly scoped service worker and manifest can make the finished chapter
  installable/offline. Add only after the online version is reliable; avoid a
  root-scoped worker that could affect other microtools.
- Native `<dialog>` and Popover API where appropriate, with focus management and
  feature checks. Optional APIs never block access to the core game.

### First build, deliberately small

Build one polished vertical slice before all five encounters: one trail stop,
the Frog Alchemist puzzle, the heart-clasp artwork, one journal entry and saved
progress. Test the feel on iPhone/iPad Safari and desktop Safari/Chrome. Then
reuse the common journal/navigation/input pieces for the other four encounters.

Suggested future home: `docs/creature-field-notes/`. Add it to the hub only when
there is something playable. Keep source art provenance, final tile references
and any future animation derivatives separate so the web and physical designs
stay visually consistent.

### Acceptance checks before calling a prototype good

- A new visitor can start, finish and replay the first puzzle without guidance.
- The frog’s heart clasp and robot’s heart chest survive at small mobile sizes.
- Touch and keyboard are both usable, including alternatives to dragging.
- Reload, Back/Forward and repeated taps do not lose or duplicate rewards.
- Save migration/import failures are recoverable; reset requires confirmation.
- Reduced motion and muted audio still leave every puzzle understandable.
- First play works without network calls after local assets load; an eventual
  offline mode has an explicit cache/update strategy.
- Real product photos are distinguished from mockups. No unmade piece appears
  in stock, and buying never changes the game’s completion requirements.

### Reference handoff

The five final heart-edited tile illustrations are included in the game’s
`assets/` directory. The asset README records exact source hashes. Only artwork
is part of the website; no machine files or private manufacturing paths are
published. The first playable encounter has been implemented at Cory’s request.
