# The Island — complete route and capture

The review folder is [the complete playthrough](loop/playthrough/2026-09-05/index.html).
It contains before/after views, numbered screenshots, exact displayed prose, the
complete optional manuscript, source and homecoming saves, and all four endings.
Its README distinguishes a scripted causal route from uninterrupted manual play.

## Full route

1. Begin on the beach. Read the bottle. Follow the path to the lighthouse.
2. Read the keeper's working book. Walk through the open inner door to the east room.
3. Light the small floor lamp. Pull out the spare chair and read both pages underneath.
4. Turn the model valve. Let the bay drain; open the exposed chest and take the ruler.
5. Place the ruler across the model crack. Drag the sun crank.
6. Stand on the brass floor plate. Touch twice to cross to the shallows. The music, lens and plumb are not yet required.
7. Try the full-size valve. Remain for the complete Upstream Hand sequence and its water rise.
8. Read the boatwright's slate and stop approaching the figure in the kelp. Wait for the low note.
9. Return by the same plate. This sets `receiverReturned`, while `returned` stays false. The deeper circuit is still required.
10. Play the music box. At dawn, listen to the bird. Answer on the stones: E, G, A, G, C (stone indices 2, 3, 4, 3, 0).
11. Take the lens from the opened outcrop. Enter the drain by walking west from its mouth at `(142, -150)`; read the ledger in the chamber. Fit the lens to the model lighthouse. The tower stair now opens: touch the newel and walk all 83 treads past three windows to the gallery. Read the watch book, then return down the stair.
12. Read both pages of the instrument index. At night, aim the beam across the cliff and observe its four figures.
13. At late afternoon, inspect the joined stone shadow and uncover the hatch. The ordered readings are five gauge rings, one lens eye, the fourth music tooth, and six stones: 5, 1, 4, 6.
14. Open the hatch with the four decimal wheels. Walk south from `(97, 32.7)` down the stair to `(97, 18.6)`; the floor is at 18.3 m. Look east at the inverted tower. Walk west through the opening and two steps into the second study (floor 17.5 m), then open the bread tin on the drying table. Return to the cellar, take the plumb, walk out by the stair and hang it on the model hook. A surface teleport does not enter these rooms.
15. Cross again. The shallows retain both earlier encounters; the plate now continues down to the old hall.
16. Wait beside the register in the lower study. Read the deeper working book, visitor's ledger and private journal. Hold the shore visitor in view until it looks up.
17. Cross to the source. Read the page beside the unfinished boat and the deeper offer of transfer.
18. Face the small figure in the model at close range and remain still. Proximity alone does not complete the encounter.
19. Set the brass index to hold, reverse, join or seal. The first touch selects hold; subsequent touches cycle in that order.
20. Ascend by the plate through levels 3, 2 and 1. The final landing sets `returned` and records `return.surface`.
21. Optional homecoming: take the stitched boat from the east-room table. Set it in the model water. Look offshore to find the corresponding large hull. Read its afterword on the model.
22. Return to the little refuge lamp. One touch names the chosen operation; the next commits it. Moving away between touches disarms the commitment. The plate, bell and oar do not end the game.

All four endings can be reached from the same earned source checkpoint. The capture
script reuses that checkpoint and performs each entire ascent before committing.

## Reproduce the evidence

Run commands from this directory:

```sh
bash tools/harness/syntax.sh
node --test test/*.test.mjs
SERVE_PORT=8733 CDP_PORT=9493 bash tools/harness/run.sh
SERVE_PORT=8734 CDP_PORT=9494 bash tools/harness/one.sh capture-playthrough.mjs
node tools/harness/build-review.mjs
SERVE_PORT=8735 CDP_PORT=9495 bash tools/harness/one.sh review-viewer.mjs landfall-touch.mjs
```

The exporter writes `loop/playthrough/2026-09-05/landfall`; set `PLAYTHROUGH_DIR` to
choose a different output folder. It uses real hotspot callbacks, earned save
state and the `ABYME.cross()` capture seam. That seam validates the same gate as
the plate, skips only travel, and grants no inventory or progression flags.

The tower, drain ramp and cellar route use the player's actual collision movement.
`landfall.mjs` additionally checks keyboard climbing, every rendered tread against
the movement surface, open windows, the gallery rail, underground entry and return,
a real pointer click on the tin, and Continue restoration. The review folds repeated
frames and groups artifact pages; every source capture remains expandable.
`build-review.mjs` refreshes the review landing page and runtime fingerprints.
The viewer check loads every image, verifies links and folding, and exercises
the 390px touch layout. The touch check holds and releases a real phone gesture
on the first tower flight.

Legacy `ABYME.dive()` and `ABYME.goLevel()` are explicit fixtures for isolated
renderer tests. They must not be used as evidence that the causal route is playable.
`harbor.mjs` separately proves real keyboard movement through the initial doorway,
a pointer click on the new chair, both boat scales and Continue restoration.
