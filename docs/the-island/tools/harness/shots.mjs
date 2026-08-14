// shots.mjs — the VISUAL playtest pass: stand where the player stands and look.
//
// probe.mjs proves the collision rules are self-consistent; it cannot tell you
// whether the wall you hit has a rock in front of it. This does. Every slice that
// touches the world should end with a run of this and a look at the frames.
//
//   SHOT_DIR=<dir>   where the PNGs land (default: ./shots)
//   SHOT_ONLY=<a,b>  capture only these named poses
//   SHOT_TIDE=<0..2> override the tide for every pose that doesn't set its own
//
// Pose fields: { name, at:[x,z], look:[x,z] | yaw, time, tide, flags, level, note }
// `look` aims the camera at a world point — yaw = atan2(px-rx, pz-rz), matching
// the engine's forward = (-sin yaw, -cos yaw).

export const POSES = [
  // --- the reported bug sites -------------------------------------------------
  { name: 'causeway-approach', at: [44, -72], look: [52, -80], tide: 0, time: 11,
    note: 'the drained causeway, walking on — is anything solid actually there?' },
  { name: 'causeway-collider', at: [46, -75], look: [51, -79], tide: 0, time: 11,
    note: 'the r=1.96 collider at ~(51,-79): a boulder, or an invisible wall?' },
  { name: 'causeway-collider-close', at: [49, -77], look: [51, -79], tide: 0, time: 11,
    note: 'nose to it' },
  { name: 'causeway-mid', at: [96, -118], look: [98, -121], tide: 0, time: 11,
    note: 'the r=1.80 collider pair at (98,-120..-122)' },
  { name: 'stones-pad', at: [135, -140], look: [133, -150], tide: 0, time: 11,
    note: 'the standing stones pad — the music puzzle' },
  { name: 'stones-drain-mouth', at: [139, -150], look: [131, -150], tide: 0, time: 11,
    note: 'the collapsed drain on the stones pad: the hole you can fall into' },
  { name: 'stones-drain-inside', at: [131, -150], look: [140, -150], tide: 0, time: 11,
    note: 'standing IN the buried chamber, looking back at the ramp — is there a way out?' },
  { name: 'study-musicbox', at: [-85, -40], look: [-88.6, -42.6], tide: 1, time: 11,
    note: 'the music box shelf in the study' },
  { name: 'study-wide', at: [-82, -37], look: [-88, -43], tide: 1, time: 11,
    note: 'the study interior' },
  // --- general orientation ------------------------------------------------------
  { name: 'beach-wake', at: [4, -104], yaw: 2.19, tide: 1, time: 7.4, note: 'where you wake' },
  { name: 'beach-drained', at: [4, -104], yaw: 2.19, tide: 0, time: 11, note: 'the same beach, drained' },

  // --- THE DRAFT (STACK.md §3.2): the same rung, arrived at two ways -----------
  // The whole thesis has to be VISIBLE or it is a spreadsheet. These two frames are
  // the same place at the same hour; the only difference is how much a hand above
  // displaced onto it.
  // `tide: 'keep'` leaves the water wherever the level logic put it — the whole
  // point of these two frames is what the ENGINE chose, not what the harness set.
  // at:'spawn' leaves the player exactly where the ENGINE set them down. A forced tp
  // would override spawnAboveWater and show a frame no player can ever be in.
  { name: 'draft-clean-L2', at: 'spawn', time: 11, tide: 'keep',
    then: `ABYME.clearStack(); ABYME.goLevel(2);`, note: 'rung 2 with an EMPTY stack — the authored waterline' },
  { name: 'draft-worked-L2', at: 'spawn', time: 11, tide: 'keep',
    // back to the surface FIRST: marks record on the rung you are standing on, so a
    // chain played at L2 would cost L2 and inherit nothing.
    then: `ABYME.goLevel(1); PLAY_CHAIN(); ABYME.goLevel(2);`,
    note: 'rung 2 after one hand worked the whole surface chain above it' },
];

export default async function (h) {
  const { mkdirSync } = await import('node:fs');
  const DIR = process.env.SHOT_DIR || 'shots';
  mkdirSync(DIR, { recursive: true });
  const only = process.env.SHOT_ONLY ? new Set(process.env.SHOT_ONLY.split(',')) : null;
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  await h.navigate(URL); await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','1');
    ['abyme-save-v1','abyme-ledger-v1'].forEach(k => localStorage.removeItem(k)); 1`);
  await h.navigate(URL); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);   // endIntro's spawn fires next tick…
  await h.wait(2.5);                            // …so never tp in the same eval
  // the debug panel covers a third of the frame — a playtest shot must show the GAME
  await h.evaluate(`(() => { const p = document.getElementById('debug-panel'); if (p) p.style.display = 'none';
    if (${process.env.SHOT_COLLIDERS === '1'}) ABYME.showColliders(true); return 1; })()`);

  const shot = [];
  for (const p of POSES) {
    if (only && !only.has(p.name)) continue;
    if (p.pre) { await h.evaluate(`(() => { ${p.pre} return 1; })()`); await h.wait(2); await ready();
      await h.evaluate(`document.getElementById('btn-begin')?.click(); 1`); await h.wait(2);
      await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(2.5);
      await h.evaluate(`(() => { const q = document.getElementById('debug-panel'); if (q) q.style.display='none'; return 1; })()`); }
    // `then` runs BEFORE the pose is set (it may change level/tide/spawn).
    // PLAY_CHAIN() drives the real surface chain so the ledger fills the way play does.
    if (p.then) {
      await h.evaluate(`(() => {
        const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find(s => s.id === id);
        const PLAY_CHAIN = () => {
          W.timeDrift = 0;
          hs('valve')?.onClick(); g.flag('crankUsed'); W.tide = W.tideTarget = 0;
          hs('chest')?.onClick(); hs('chest')?.onClick(); hs('crack')?.onClick();
          g.flag('birdSolved'); hs('lensItem')?.onClick(); hs('lensSlot')?.onClick();
          g.flag('shadowRevealed'); g.flag('hatchOpen'); hs('plumb')?.onClick(); hs('hook')?.onClick();
        };
        ${p.then}
        return 1;
      })()`);
      await h.wait(1.2);
    }
    // NOT `??` — 'keep' is a real value and null is nullish; be explicit
    const tide = p.tide === 'keep' ? null
      : p.tide !== undefined ? p.tide
      : (process.env.SHOT_TIDE !== undefined ? +process.env.SHOT_TIDE : 1);
    const yaw = p.yaw ?? null;
    await h.evaluate(`(() => {
      const W = ABYME.W;
      W.timeDrift = 0; W.time = ${p.time ?? 11};
      ${tide === null ? '' : `W.tide = W.tideTarget = ${tide};`}
      ${p.level ? `W.level = ${p.level};` : ''}
      ${p.flags ? Object.entries(p.flags).map(([k, v]) => `W.flags[${JSON.stringify(k)}] = ${JSON.stringify(v)};`).join('') : ''}
      ${p.at === 'spawn' ? '' : `
      const yaw = ${yaw !== null ? yaw : `Math.atan2(${p.look[0]} - (${p.at[0]}), ${p.look[1]} - (${p.at[1]}))`};
      ABYME.tp(${p.at[0]}, ${p.at[1]}, yaw, ${p.pitch ?? -0.06});`}
      return 1;
    })()`);
    await h.wait(1.8);                          // the camera copies from the player on a tick
    const st = await h.evaluate(`(() => ({
      pos: [+ABYME.player.pos.x.toFixed(2), +ABYME.player.pos.y.toFixed(2), +ABYME.player.pos.z.toFixed(2)],
      tide: +ABYME.W.tide.toFixed(3), target: +ABYME.W.tideTarget.toFixed(3),
      level: ABYME.W.level, draft: +ABYME.draft().toFixed(3), marks: ABYME.ledger().marks.length,
      waterY: +(-4.2 * (1 - ABYME.W.tide)).toFixed(2) }))()`);
    // a tp into water gets tide-rescued to the beach — read back, don't assume
    const drift = p.at === "spawn" ? 0 : Math.hypot(st.pos[0] - p.at[0], st.pos[2] - p.at[1]);
    const file = `${DIR}/${p.name}.png`;
    await h.screenshot(file);
    shot.push({ name: p.name, file, at: st.pos, tide: st.tide, moved: +drift.toFixed(2) });
    console.log(`  ${p.name.padEnd(24)} L${st.level} pos=${JSON.stringify(st.pos)} tide=${st.tide}(→${st.target}) waterY=${st.waterY} draft=${st.draft} marks=${st.marks}` +
      (drift > 1.5 ? `  ⚠ RESCUED ${drift.toFixed(1)}m off target` : '') + `  ${p.note || ''}`);
  }
  console.log(`SHOTS ${shot.length} → ${DIR}`);
  return shot;
}
