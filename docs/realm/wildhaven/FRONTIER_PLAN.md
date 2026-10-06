# Wildhaven frontier expansion — delivered locally

This playable increment expands the actual island, adds labor-built walls and gates, and connects named troops, neighboring settlements, diplomacy and spatial combat to the existing town economy. The southern town and its save remain compatible. The v2 source is preserved at `/private/tmp/wildhaven-v2-before-frontier-20261002.tar.gz`; v2 evidence remains historical. Current results and limits are in `review/FRONTIER_VERIFICATION.md` and exact hashes in `review/frontier-release-checkpoint.json`.

Completion gates:

1. A connected, substantially larger island has distinct regions, clear settlement approaches, a readable coastline and navigation/camera limits derived from its true bounds. No fog overlay or decorative off-map motion substitutes for geography.
2. Defenses spend materials, take real named labor, retain progress, obstruct enemies, permit friendly gates, take damage and can be repaired. Placement cannot strand the town or exploit occupied terrain.
3. Recruitment reserves real citizens from civilian jobs, consumes resources and takes time. Troops visibly move, hold, attack, retreat and recover or die according to authoritative saved state. No duplicate civilian and military labor.
4. Neighbor discovery, envoys, trade, alliance, war and truce have explicit requirements and consequences. Claims permit real expansion. Enemy attacks have actual moving units and can be intercepted, blocked or repelled.
5. Desktop and touch controls expose command targeting, selection, reasons for failure, costs and battle results. Panels do not cover the command target. Escape/cancel leaves a recoverable state.
6. Existing town mechanics regress cleanly. Saves migrate without changing the old key and reject corrupt frontier structures. Pause, reload and interruption do not create time, labor or resources.
7. Focused deterministic tests cover each mechanic and integrated play demonstrates an earned expansion, contact, wall construction and combat. Rendered evidence checks terrain, obstacle navigation, all new art, attacks, damage and mobile usability. Reports distinguish prepared fixtures from earned gameplay and record limitations.

All implementation stays under `wildhaven/`. No deployment, push or reset of the user's live village is required.

All seven completion gates have current scoped evidence: 114 deterministic tests, an earned new-town foundation and five-region frontier campaign with 34 reloads, 40 unique real browser checks, nine separately labeled component checks, Blender/terrain/gate geometry, civilian movement and visually reviewed earned walls/settlements/combat. The current saved village is open in a fresh preview and paused. Original browser tab left untouched after its control connection failed. No implementation or verification process remains running; the local play server remains available. Physical devices, Safari/Firefox, human-session pacing and unique art for every ordinary upgrade remain outside the verified scope.
