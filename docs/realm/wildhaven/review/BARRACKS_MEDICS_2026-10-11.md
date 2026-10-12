# Army polish — October 11, 2026

Implementation: PR #176 (413b5889066a4bfc7c9478ead10d24dfb4440fb2) and presentation/playtest follow-up PR #177 (c8e25871395e35e3b28e1d51c7b284e1f5f48ba8).

Automated validation: 399 Node tests; 2,020 archive checks. Covers rotated entrances, training indoors, group exit/return, physical wounded return, blocked routes, paused/removed quarters, old-save routing, foreign flag sanitization, medic charges, paid supplies, no healing through walls, escort return, full-game save roundtrip and deterministic timestep partitions.

Live saved-town check: opened the existing village paused. Day 8, 18/18 people, 200 timber, 200 stone, 187 food were retained. Build → Defenses opens the wall catalog and instructions. Company shows the field medic, cost and barracks requirements. No materials spent and no game time advanced.

Live isolated playtest: recruited Amina as a medic, completed training, selected all three troops and tapped a ground destination. Observed walking and medic following; treatment raised the spearman from 20 to 34 HP and consumed one dressing. In-memory reload preserved HP, orders and remaining dressings. A severely wounded soldier reached barracks with 69 seconds of recovery remaining; after further time, all three troops were indoors and healthy. An empty medical kit refilled from six food and two cloth. Drew a three-section wall line, reviewed the 21 stone / 6 timber quote, committed it, advanced the simulation, and verified the completed wall. A further in-memory reload succeeded. No browser console warnings/errors were recorded. It uses funded starting resources and pre-trained troops, not earned progression. No localStorage, save-store or companion connection is loaded by the playtest page.

Browser review found a stale defense marker over the barracks after soldiers went indoors; final presentation follow-up suppresses indoor orders and refreshes the marker cache when garrison state changes.

Limit: this was a funded mechanics playtest, not an earned campaign or a large-army live battle. Automated tests cover combat restrictions, line of sight and guard behavior.
