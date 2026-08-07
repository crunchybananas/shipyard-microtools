// SEA-STRATA region modules (#71) — one file per drowned level-area, the seam new
// level content lands in. Each build(ctx) receives its region group (already parented
// under core, visibility-driven by puzzles _apply) and draws ONLY from its own
// mulberry32(SEED ^ salt) stream — no region can shift the world scatter, and no
// region can shift another. Everything else a region needs is a pure leaf import
// (THREE, util, terrain.heightAt).
import { build as buildShallows } from './l2_shallows.js';
import { build as buildGallery } from './l3_gallery.js';
import { build as buildSeabed } from './l4_seabed.js';

export function buildRegions(ctx) {
  buildShallows(ctx);
  buildGallery(ctx);
  buildSeabed(ctx);
}
