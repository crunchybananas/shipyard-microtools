# The Island — Landfall playthrough

Open index.html. 103 illustrated moments organise 161 source captures of the complete route and all four endings. The tower stair, drain, cellar and western study are physically traversed.

Scripted playthrough using the game’s real hotspot callbacks and crossing gates. Walking between scenes and long crossing cameras are skipped through the public debug capture API. Queued travel whispers are cleared at accelerated camera changes. The sun is advanced to puzzle hours; actor placement uses encounter fixtures, while stillness and regard run in the live game. No progression flags or puzzle answers are granted. The tower stair and underground connectors run through the actual player collision code in both directions. The opening, first return, final return, boat launch, persistence and all four endings are checked. This is a route audit with screenshots, not a recording of an uninterrupted manual play session.

Every image was captured from this build at 1440 × 900. stages.json records actual reading text, flags, notebook evidence and camera position. manuscript.md and manuscript.json include all 56 pages across 23 artifacts. source-checkpoint.json and homecoming-save.json preserve earned replay states for an isolated browser.

Run tools/harness/capture-playthrough.mjs through one.sh to regenerate. review-audit.py groups artifact pages and folds similar images; build-review.mjs refreshes the viewer, revision overview and build fingerprints.
