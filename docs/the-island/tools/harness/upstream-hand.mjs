// upstream-hand.mjs — the dead L2 valve is answered by the hand above it.
//
// This is deliberately its own browser gate instead of another private-timer check
// in stack.mjs.  The beat is object-led and player-facing now: one real valve mark
// is made on L1, a different local hand inherits it on L2, and the ordinary valve
// click has to stage, surge, clean up, save, and refuse to replay.
//
// `?localstack` is non-negotiable.  The fixture changes hands across reloads to make
// one genuinely remote inherited mark without ever publishing test marks to the
// permanent shared stack.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond, extra) => (cond ? R.pass : R.fail)
    .push(name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  // Chrome itself runs with --mute-audio, so the machine stays silent while the
  // WebAudio graph remains genuinely live and its cancellation handles testable.
  const PAGE = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642)
    + '/the-island/?debug&localstack';
  const HAND_ABOVE = 'a11ce001';
  const HAND_HERE = 'b00b1e55';
  const allErrors = [];

  const ready = async () => {
    for (let i = 0; i < 80; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(0.5);
    }
    throw new Error('app never booted');
  };

  const begin = async () => {
    // Autosave can recreate a just-removed save in the frame before navigation.
    // Handle the real confirmation branch instead of assuming Begin is one click;
    // otherwise a harness can mutate ABYME behind the title screen and call it play.
    await h.evaluate(`(() => {
      document.getElementById('btn-begin').click();
      const confirm = document.getElementById('begin-confirm');
      if (confirm && !confirm.classList.contains('hidden')) {
        document.getElementById('btn-begin-confirm').click();
      }
      return 1;
    })()`);
    await h.wait(1.2);
    await h.evaluate(`ABYME.setIntroT(99); 1`);
    // endIntro owns the next rendered frame. On software GL that can be much later
    // than one nominal frame, so prove play has control before touching the world.
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`!ABYME.player.locked && ABYME.interact.enabled`).catch(() => false)) return;
      await h.wait(0.25);
    }
    throw new Error('intro never released player control');
  };

  const catchErrors = async () => h.evaluate(`(() => {
    window.__upstreamErrs = [];
    addEventListener('error', (e) => window.__upstreamErrs.push('error: ' + e.message));
    addEventListener('unhandledrejection', (e) => window.__upstreamErrs.push('rejection: ' + String(e.reason)));
    return 1;
  })()`);

  const keepErrors = async (where) => {
    const errs = await h.evaluate(`window.__upstreamErrs || []`).catch((e) => [String(e)]);
    for (const err of errs) allErrors.push(where + ': ' + err);
  };

  // Use the real DOM click pipeline.  Setting the already-resolved hover keeps this
  // gate about the authored valve response, not about one fragile camera pixel.
  const clickValve = `(() => {
    const I = ABYME.interact;
    const spot = I.hotspots.find((s) => s.id === 'valve');
    const canvas = document.getElementById('scene');
    if (!spot || !canvas) return false;
    I.enabled = true; I.hovered = spot;
    const x = innerWidth / 2, y = innerHeight / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, button:0, clientX:x, clientY:y }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, button:0, clientX:x, clientY:y }));
    return !I._pending;
  })()`;
  const status = async () => h.evaluate(`(() => {
    const state = typeof ABYME.upstreamHandState === 'function'
      ? ABYME.upstreamHandState() : null;
    return {
      state,
      tide: ABYME.W.tide,
      target: ABYME.W.tideTarget,
      surgeCommitted: ABYME.W.flags.upstreamHandSurged === true,
      witnessed: ABYME.W.flags.upstreamHandWitnessed === true,
      locked: !!ABYME.player.locked,
      interact: !!ABYME.interact.enabled,
      titleGone: document.getElementById('title-screen')?.style.display === 'none',
      audioArmed: typeof ABYME.game._upstreamAudioStop === 'function',
      evidence: ABYME.evidence(2).filter((m) => m.k === 'valve'),
    };
  })()`);

  const budget = async () => h.evaluate(`(() => {
    ABYME.renderer.info.reset();
    ABYME.composer.render();
    const r = ABYME.renderer.info.render;
    let pointLights = 0;
    ABYME.scene.traverse((o) => { if (o.isPointLight) pointLights++; });
    return { calls:r.calls, tris:r.triangles, pointLights };
  })()`);

  await h.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // Mint a deterministic upstream hand, then make the one canonical valve mark
  // through gameplay.  No direct ledger mutation: sanitation, idempotency, position,
  // and persistence all stay on the production path.
  await h.navigate(PAGE); await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','0');
    ['abyme-save','abyme-ledger-v2','abyme-hand-v1']
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('abyme-hand-v1', '${HAND_ABOVE}'); 1`);
  await h.navigate(PAGE); await ready(); await begin(); await catchErrors();
  await h.evaluate(`ABYME.tp(-83.5, -39.0, 0, -0.1); 1`);
  await h.wait(0.3);
  const surfaceClick = await h.evaluate(clickValve);
  const mark = await h.evaluate(`(() => ({
    local: ABYME.localStack === true && ABYME.isShared() === false,
    hand: ABYME.hand,
    level: ABYME.W.level,
    marks: ABYME.ledger().marks,
    valves: ABYME.evidence(2).filter((m) => m.k === 'valve'),
    draft: ABYME.draft(2),
  }))()`);
  ok('fixture stays on the local stack', mark.local, mark);
  ok('ordinary L1 valve input records the canonical one-mark fixture',
    surfaceClick && mark.level === 1 && mark.hand === HAND_ABOVE
      && mark.marks.length === 1 && mark.valves.length === 1
      && mark.valves[0].h === HAND_ABOVE && Math.abs(mark.draft - 0.03) < 1e-9,
    mark);
  await keepErrors('upstream fixture');

  // A new local identity stands one rung lower.  The sole inherited mark is now a
  // real other hand, but the game and source remain completely offline.
  await h.evaluate(`localStorage.removeItem('abyme-save');
    localStorage.setItem('abyme-hand-v1', '${HAND_HERE}'); 1`);
  await h.navigate(PAGE); await ready(); await begin(); await catchErrors();
  await h.evaluate(`ABYME.goLevel(2); 1`);
  await h.wait(3.0);                            // let the authored arrival vista release
  // Software GL can advance the 2.4 simulated-second vista more slowly than wall
  // clock. A normal skip input is part of the player path and establishes the
  // unlocked baseline before the valve event itself is judged.
  await h.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code:'Space', key:' ', bubbles:true }));
    ABYME.tp(-82, -37, Math.PI / 4, -0.08); ABYME.W.timeDrift = 0;
    window.__upstreamHarnessElapsed = 0; 1`);
  await h.wait(0.5);

  const fixture = await status();
  const baselineBudget = await budget();
  ok('L2 inherits exactly one valve mark from another hand',
    fixture.evidence.length === 1 && fixture.evidence[0].h === HAND_ABOVE
      && HAND_ABOVE !== HAND_HERE,
    fixture);
  ok('the public event state is idle before the dead wheel is touched',
    fixture.state && fixture.state.active === false && fixture.state.surged === false,
    fixture.state);

  const beforeTarget = fixture.target;
  const lowerClick = await h.evaluate(clickValve);
  const armed = await status();
  ok('ordinary L2 valve input arms the Upstream Hand without moving water',
    lowerClick && armed.state?.active === true
      && Math.abs(armed.target - beforeTarget) < 1e-9
      && !armed.surgeCommitted && !armed.witnessed,
    { beforeTarget, armed });
  ok('the event names the inherited valve and its remote source hand',
    armed.state?.sourceKind === 'valve'
      && String(armed.state?.sourceHand || '').slice(0, 16) === HAND_ABOVE,
    armed.state);
  ok('the dead-wheel beat stays visible and under player control',
    armed.titleGone && !armed.locked && armed.interact, armed);

  // The arrival is delayed: the hand has time to exist as an event before the tide
  // becomes its consequence. Advance in production-sized 50 ms steps; one giant dt
  // would jump over the very phases this test exists to protect, while raw wall time
  // makes software-GL CI advance the simulation much more slowly than a local GPU.
  await h.evaluate(`(() => { for (let i=0; i<20; i++) {
    window.__upstreamHarnessElapsed += 0.05;
    ABYME.game.tick(0.05, window.__upstreamHarnessElapsed);
  } return 1; })()`);
  const held = await status();
  ok('the tide is still unchanged one second into the event',
    held.state?.active === true && !held.surgeCommitted && !held.witnessed
      && Math.abs(held.target - beforeTarget) < 1e-9,
    { beforeTarget, held });

  const phases = new Set([armed.state?.phase, held.state?.phase].filter(Boolean));
  const peak = { modelPulse: 0, wallScale: 0, worldRadius: 0 };
  let peakBudget = null;
  let shot = null;
  let committed = null;
  let finished = null;
  let sawSurgedState = false;
  let everLocked = armed.locked || held.locked;
  let everInteractionDisabled = !armed.interact || !held.interact;
  const shotDir = process.env.SHOT_DIR;
  if (shotDir) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(shotDir, { recursive: true });
  }

  for (let i = 0; i < 64; i++) {               // 16 simulated seconds: stage, surge, settle
    await h.evaluate(`(() => { for (let j=0; j<5; j++) {
      window.__upstreamHarnessElapsed += 0.05;
      ABYME.game.tick(0.05, window.__upstreamHarnessElapsed);
    } return 1; })()`);
    const cur = await status();
    const s = cur.state || {};
    if (s.phase) phases.add(s.phase);
    peak.modelPulse = Math.max(peak.modelPulse, Number(s.modelPulse) || 0);
    peak.wallScale = Math.max(peak.wallScale, Number(s.wallScale) || 0);
    peak.worldRadius = Math.max(peak.worldRadius, Number(s.worldRadius) || 0);
    everLocked ||= cur.locked;
    everInteractionDisabled ||= !cur.interact;
    sawSurgedState ||= s.surged === true;

    // Sample throughout the score, not at its first faint glimmer. The overlap at
    // ~5.25s is the expensive frame; a first-nonzero sample can miss most channels.
    if (i % 8 === 0) {
      const sample = await budget();
      peakBudget = peakBudget || { calls:0, tris:0, pointLights:0 };
      peakBudget.calls = Math.max(peakBudget.calls, sample.calls);
      peakBudget.tris = Math.max(peakBudget.tris, sample.tris);
      peakBudget.pointLights = Math.max(peakBudget.pointLights, sample.pointLights);
    }
    // Capture the architectural answer, not the first tiny model glimmer. The
    // wall-scale glyph is the image this feature lives or dies by, and this stays in
    // the normal valve-side player composition rather than manufacturing a debug angle.
    if (!shot && shotDir && (Number(s.wallScale) || 0) > 0.80) {
      await h.evaluate(`(() => {
        const p=document.getElementById('debug-panel'); if (p) p.style.display='none';
        // Simulation stepping intentionally outruns wall-clock UI timers. Remove the
        // stale intro line so the optional image shows the event's authored frame.
        clearTimeout(ABYME.UI._whisperTimer); ABYME.UI._whisperTimer = null;
        ABYME.UI._whisperQueue.length = 0; ABYME.UI.whisperEl.classList.remove('show');
        ABYME.UI.whisperEl.style.display = 'none';
        return 1;
      })()`);
      shot = shotDir + '/upstream-hand-peak.png';
      await h.screenshot(shot);
    }
    if (!committed && cur.surgeCommitted
        && Math.abs(cur.target - (beforeTarget + 0.06)) < 1e-6) {
      committed = cur;
    }
    if (committed && s.active === false) { finished = cur; break; }
  }

  ok('the hand moves through more than one authored phase', phases.size >= 2, [...phases]);
  ok('the chart-table model visibly answers the upstream act', peak.modelPulse > 0.02, peak);
  ok('the wall-scale hand becomes materially present', peak.wallScale > 0.02, peak);
  ok('the world-space reach grows beyond zero', peak.worldRadius > 0.02, peak);
  ok('the tide surge commits exactly once and by exactly +0.06 before its reveal',
    !!committed && committed.surgeCommitted && !committed.witnessed
      && Math.abs(committed.target - (beforeTarget + 0.06)) < 1e-6,
    { beforeTarget, committed });
  ok('the public state exposes the surge while it happens', sawSurgedState, { peak, committed, finished });
  ok('the whole physical beat leaves movement and interactions intact',
    !everLocked && !everInteractionDisabled, { armed, held, committed, finished });

  peakBudget ||= await budget();
  // The executable 460k triangle ceiling in walk.mjs is a SURFACE pose; the live
  // L2 baseline is already substantially heavier. Pin the honest incremental cost
  // as well as a broad deep ceiling, so this spectacle cannot hide an unbounded
  // mesh behind work that was already in the stratum.
  ok('the peak frame stays inside the island power ceiling',
    peakBudget.calls < 525 && peakBudget.tris < 1000000
      && peakBudget.calls <= baselineBudget.calls + 16
      && peakBudget.tris <= baselineBudget.tris + 20000,
    { baseline:baselineBudget, peak:peakBudget });
  ok('going big does not add a tenth point light',
    peakBudget.pointLights <= 9 && peakBudget.pointLights <= baselineBudget.pointLights,
    { baseline:baselineBudget, peak:peakBudget });
  ok('the event cleans every transient visual channel away',
    finished?.state?.active === false
      && (Number(finished.state.modelPulse) || 0) <= 0.02
      && (Number(finished.state.wallScale) || 0) <= 0.02
      && (Number(finished.state.worldRadius) || 0) <= 0.02,
    finished);

  const settledTarget = committed?.target ?? (beforeTarget + 0.06);
  const reclicked = await h.evaluate(clickValve);
  await h.wait(1.25);
  const replay = await status();
  ok('re-clicking the dead wheel cannot replay or compound the hand',
    reclicked && replay.surgeCommitted && replay.witnessed && replay.state?.active === false
      && Math.abs(replay.target - settledTarget) < 1e-6,
    { settledTarget, replay });

  // Simulate a ledger merge that lands after the arrival target was sampled: the
  // goLevel promise is queued, then one more valid upstream act enters the mirror
  // before its continuation reads the ledger. The new draft and the permanent
  // +0.06 must compose instead of either one replacing the other.
  const lateSeed = await h.evaluate(`(() => {
    const rawBefore = ABYME.tideAt(2);
    ABYME.goLevel(2);
    ABYME.W.level = 1;
    ABYME.game.flag('rulerPlaced');
    ABYME.W.level = 2;
    return { rawBefore };
  })()`);
  await h.wait(0.2);
  const late = await h.evaluate(`({
    raw:ABYME.tideAt(2), effective:ABYME.effectiveTideAt(2),
    target:ABYME.W.tideTarget, surged:ABYME.W.flags.upstreamHandSurged === true
  })`);
  ok('a late ledger merge composes new draft with the permanent surge',
    late.raw > lateSeed.rawBefore
      && Math.abs(late.effective - (late.raw + 0.06)) < 1e-6
      && Math.abs(late.target - late.effective) < 1e-6 && late.surged,
    { lateSeed, late });

  // A source pull is tagged with the rung that requested it, but merges into one
  // global mirror. Complete an older L3 request after the player is back on L2:
  // the current rung must still re-read the newly merged L1 act.
  const outOfOrderSeed = await h.evaluate(`(() => {
    const rawBefore = ABYME.tideAt(2), targetBefore = ABYME.W.tideTarget;
    ABYME.W.level = 3;
    ABYME.syncStack(3);
    ABYME.W.level = 1;
    ABYME.game.flag('hatchOpen');
    ABYME.W.level = 2;
    return { rawBefore, targetBefore };
  })()`);
  await h.wait(0.2);
  const outOfOrder = await h.evaluate(`({
    level:ABYME.W.level, raw:ABYME.tideAt(2), effective:ABYME.effectiveTideAt(2),
    target:ABYME.W.tideTarget
  })`);
  ok('an out-of-order old-rung pull still reconciles the current rung',
    outOfOrder.level === 2 && outOfOrder.raw > outOfOrderSeed.rawBefore
      && Math.abs(outOfOrder.target - outOfOrder.effective) < 1e-6,
    { outOfOrderSeed, outOfOrder });

  await h.evaluate(`ABYME.goLevel(3); ABYME.goLevel(2); 1`); await h.wait(0.2);
  const revisited = await h.evaluate(`({
    raw:ABYME.tideAt(2), effective:ABYME.effectiveTideAt(2),
    tide:ABYME.W.tide, target:ABYME.W.tideTarget
  })`);
  ok('leaving and revisiting L2 keeps the surge in the waterline',
    Math.abs(revisited.effective - (revisited.raw + 0.06)) < 1e-6
      && Math.abs(revisited.tide - revisited.effective) < 1e-6
      && Math.abs(revisited.target - revisited.effective) < 1e-6,
    revisited);
  await keepErrors('remote event');

  // Consequence and observation are saved independently. Continue must restore
  // both without resurrecting transient geometry.
  await h.navigate(PAGE); await ready();
  const hasContinue = await h.evaluate(`!document.getElementById('btn-continue').classList.contains('hidden')`);
  if (hasContinue) await h.evaluate(`document.getElementById('btn-continue').click(); 1`);
  await h.wait(1.2); await catchErrors();
  const restored0 = await status();
  const reloadClick = await h.evaluate(clickValve);
  await h.wait(1.0);
  const restored = await status();
  ok('save/reload keeps the event spent and cannot resurrect it',
    hasContinue && reloadClick && restored0.surgeCommitted && restored0.witnessed
      && restored.surgeCommitted && restored.witnessed
      && restored.state?.active === false
      && Math.abs(restored.target - restored0.target) < 1e-6,
    { hasContinue, restored0, restored });
  await keepErrors('reload');

  // Negative control: a clean L2 has no causal hand to stage.  Waiting past the
  // early visual window catches implementations that merely check draft or level.
  await h.evaluate(`['abyme-save','abyme-ledger-v2']
    .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('abyme-hand-v1', 'c1ea0001'); 1`);
  await h.navigate(PAGE); await ready(); await begin(); await catchErrors();
  await h.evaluate(`ABYME.goLevel(2); 1`); await h.wait(3.0);
  const quietBefore = await status();
  const quietClick = await h.evaluate(clickValve);
  await h.wait(1.25);
  const quiet = await status();
  ok('a clean L2 dead wheel cannot invent an upstream hand',
    quietClick && quiet.evidence.length === 0 && !quiet.surgeCommitted && !quiet.witnessed
      && quiet.state?.active === false
      && Math.abs(quiet.target - quietBefore.target) < 1e-9,
    { quietBefore, quiet });
  await keepErrors('negative control');

  // Saturated shared history is valid state, not an attack: L2 can begin at 2.10.
  // The former clamp-to-2 path made the event lower that sea and left valve audio
  // running forever. Use a sanitized max-draft fixture to pin a monotonic +0.06
  // and prove easing can actually settle above the old debug-slider ceiling.
  await h.evaluate(`(() => {
    const marks=[{k:'valve',r:1,h:'crowd-valve',n:0,at:[-82.7,13.6,-38.9]}];
    for(let i=1;i<=12;i++) marks.push({k:'dive',r:1,h:'crowd-'+i,n:i,at:[0,0,-100]});
    ['abyme-save','abyme-hand-v1'].forEach(k=>localStorage.removeItem(k));
    localStorage.setItem('abyme-ledger-v2',JSON.stringify({v:2,marks,ops:[]}));
    localStorage.setItem('abyme-hand-v1','crowd-here'); return 1;
  })()`);
  await h.navigate(PAGE); await ready(); await begin(); await catchErrors();
  await h.evaluate(`ABYME.goLevel(2); ABYME.W.reduceMotion=false; 1`); await h.wait(3.0);
  const crowdedBefore = await status();
  const crowdedClick = await h.evaluate(clickValve);
  await h.evaluate(`(() => { for(let i=0;i<260;i++) ABYME.game.tick(0.05,i*0.05); return 1; })()`);
  const crowded = await status();
  const crowdedRaw = await h.evaluate(`ABYME.tideAt(2)`);
  ok('a max-draft L2 surge rises +0.06 above 2 and settles without reversing',
    crowdedClick && Math.abs(crowdedRaw - 2.10) < 1e-6
      && Math.abs(crowdedBefore.target - crowdedRaw) < 1e-6
      && Math.abs(crowded.target - (crowdedRaw + 0.06)) < 1e-6
      && Math.abs(crowded.tide - crowded.target) < 0.001
      && crowded.surgeCommitted && crowded.witnessed && crowded.state?.active === false,
    { crowdedBefore, crowdedRaw, crowded });
  await keepErrors('max-draft event');

  // Continue used to restore L2 only after boot's one eager sync had already
  // queried default L1. Give it a deliberately stale, low-tide save beside the
  // crowded mirror: it must pull the saved rung, compose the permanent rise, and
  // move the no-swimming arrival uphill against the FUTURE target waterline.
  await h.evaluate(`(() => {
    const s=JSON.parse(localStorage.getItem('abyme-save'));
    s.level=2; s.tide=1.38; s.pos=[1.5,0,-105.5]; s.look=[2.19,0.03];
    localStorage.setItem('abyme-save',JSON.stringify(s)); return 1;
  })()`);
  await h.navigate(PAGE); await ready(); await catchErrors();
  await h.evaluate(`document.getElementById('btn-continue').click(); 1`); await h.wait(0.5);
  const continued = await h.evaluate(`(() => {
    const sea=-4.2*(1-ABYME.W.tideTarget);
    return {level:ABYME.W.level, raw:ABYME.tideAt(2), effective:ABYME.effectiveTideAt(2),
      target:ABYME.W.tideTarget, clearance:ABYME.player.pos.y+ABYME.player.eye-sea,
      pos:[ABYME.player.pos.x,ABYME.player.pos.y,ABYME.player.pos.z]};
  })()`);
  ok('Continue reconciles the saved rung and keeps a late-risen arrival above water',
    continued.level === 2 && Math.abs(continued.target - continued.effective) < 1e-6
      && Math.abs(continued.effective - (continued.raw + 0.06)) < 1e-6
      && continued.clearance > 0.3,
    continued);
  await keepErrors('continue reconciliation');

  // Offline single-player is complete in itself: when the one inherited valve mark
  // belongs to this same persistent hand, it is the explicit fallback source.
  await h.evaluate(`['abyme-save','abyme-ledger-v2','abyme-hand-v1']
    .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('abyme-hand-v1', '0ff1ce01'); 1`);
  await h.navigate(PAGE); await ready(); await begin(); await catchErrors();
  await h.evaluate(`ABYME.tp(-83.5, -39.0, 0, -0.1); ABYME.W.reduceMotion = true; 1`); await h.wait(0.3);
  const ownSurfaceClick = await h.evaluate(clickValve);
  await h.evaluate(`ABYME.goLevel(2); 1`); await h.wait(3.0);
  const ownLowerClick = await h.evaluate(clickValve);
  const own = await status();
  ok('the same-hand valve mark is the honest offline fallback',
    ownSurfaceClick && ownLowerClick && own.evidence.length === 1
      && own.state?.active === true && own.state?.sourceKind === 'valve'
      && String(own.state?.sourceHand || '').slice(0, 16) === '0ff1ce01',
    own);

  const stillFrame = async () => h.evaluate(`(() => {
    const u=ABYME.game.upstreamHand, p=u.pulse.position;
    return { wheel:u.modelWheel.rotation.z, rings:u.modelRings.map(r=>r.scale.x),
      halo:u.modelHalo.scale.x, pulse:[p.x,p.y,p.z], room:u.roomRing.scale.x,
      wall:u.wallMat.uniforms.uScale.value, world:u.worldRing.scale.x };
  })()`);
  await h.evaluate(`(() => { for(let i=0;i<100;i++) ABYME.game.tick(0.05,i*0.05); return 1; })()`);
  const stillA = await stillFrame();
  await h.evaluate(`(() => { for(let i=0;i<10;i++) ABYME.game.tick(0.05,5+i*0.05); return 1; })()`);
  const stillB = await stillFrame();
  await h.evaluate(`(() => { for(let i=0;i<50;i++) ABYME.game.tick(0.05,5.5+i*0.05); return 1; })()`);
  const stillC = await stillFrame();
  await h.evaluate(`(() => { for(let i=0;i<10;i++) ABYME.game.tick(0.05,8+i*0.05); return 1; })()`);
  const stillD = await stillFrame();
  const near = (a,b) => Math.abs(a-b) < 1e-6;
  const nearList = (a,b) => a.length === b.length && a.every((v,i)=>near(v,b[i]));
  ok('reduced motion holds the model, filament, wall and bay as spatial tableaux',
    near(stillA.wheel, stillB.wheel) && nearList(stillA.rings, stillB.rings)
      && near(stillA.halo, stillB.halo) && nearList(stillA.pulse, stillB.pulse)
      && near(stillA.room, stillB.room) && near(stillA.wall, stillB.wall)
      && near(stillC.world, stillD.world),
    { stillA, stillB, stillC, stillD });

  // The live-control promise means two systems can ask the island to hold its
  // breath at once. Arm the actual plate while the Hand owns its hush, then step
  // back: releasing either owner must leave the other one intact.
  // Invoke the registered production hotspot directly here. The fixture has already
  // proven the DOM pointer pipeline twice; this assertion is about the plate's audio
  // ownership and should not depend on a stale centre-screen hover after teleporting.
  // Capture in the same task: the normal frame loop may immediately release a debug
  // teleport whose camera matrices have not caught up to its player pose yet.
  const overlap = await h.evaluate(`(() => {
    // The physical score has just reached its reveal. Resolve the other authored
    // L2 encounter through Game's canonical encounter boundary so the plate's new
    // two-evidence gate is honestly ready before testing overlapping hush owners.
    ABYME.game.tick(0.1, 8.6);
    ABYME.game.resolveEncounter('tideFigure');
    ABYME.W.flags.plumbHung = true;
    const p = ABYME.refs.deskPlate.position;
    ABYME.tp(p.x, p.z, 0, 0);
    const spot = ABYME.interact.hotspots.find((s) => s.id === 'plate');
    if (!spot || (spot.when && !spot.when())) return { clicked:false };
    spot.onClick();
    return { clicked:true, brink:!!ABYME.game._brink,
      owners:ABYME.ambientDuckOwners(), active:ABYME.upstreamHandState().active,
      witnessed:ABYME.W.flags.upstreamHandWitnessed,
      tideFigure:ABYME.W.flags.tideFigureSeen,
      player:[ABYME.player.pos.x,ABYME.player.pos.z], plate:[p.x,p.z] };
  })()`);
  ok('the plate and Upstream Hand can own the ambient hush together',
    overlap.clicked && overlap.brink && overlap.active && overlap.witnessed && overlap.tideFigure
      && overlap.owners.includes('gameplay') && overlap.owners.includes('upstreamHand'),
    overlap);

  const crossing = await h.evaluate(`(() => {
    const p = ABYME.refs.deskPlate.position;
    ABYME.tp(p.x + 3, p.z, 0, 0);
    ABYME.game.tick(0, 8.5);                 // release the plate without advancing the score
    const released = ABYME.ambientDuckOwners();
    const handWasLive = ABYME.upstreamHandState().active;
    const started = ABYME.ascend(false);
    return { released, handWasLive, started, ascent:ABYME.getAscent(),
      state:ABYME.upstreamHandState(), owners:ABYME.ambientDuckOwners(),
      law:(ABYME.W.onceKeys||[]).includes('theLaw'), locked:ABYME.player.locked };
  })()`);
  // This score was deliberately advanced to the reveal boundary above. Real rAF
  // time may put the crossing just before or just after that authored line, and a
  // crossing cannot unsay a line already delivered. The fresh early-terminal case
  // below is the deterministic assertion that resolve({reveal:false}) suppresses it.
  ok('plate release preserves the Hand hush and a real crossing takes clean ownership',
    crossing.handWasLive && crossing.released.length === 1
      && crossing.released[0] === 'upstreamHand' && crossing.started
      && crossing.ascent && crossing.state?.active === false
      && crossing.owners.length === 1 && crossing.owners[0] === 'gameplay'
      && crossing.locked,
    crossing);
  await keepErrors('own-hand crossing');

  // Make one fresh answer from the same real ledger mark, then commit a current
  // disposition while it is live. The ending owns all later sound, copy, and draw
  // state absolutely; the nearby bell is deliberately nonterminal now.
  await h.evaluate(`localStorage.removeItem('abyme-save'); 1`);
  await h.navigate(PAGE); await ready(); await begin(); await catchErrors();
  await h.evaluate(`ABYME.goLevel(2); 1`); await h.wait(3.0);
  await h.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code:'Space', key:' ', bubbles:true }));
    ABYME.tp(-82, -37, Math.PI / 4, -0.08); 1`);
  await h.wait(0.4);
  const terminalClick = await h.evaluate(clickValve);
  await h.evaluate(`(() => { for(let i=0;i<50;i++) ABYME.game.tick(0.05, i*0.05); return 1; })()`);
  const terminalBefore = await status();
  const terminal = await h.evaluate(`(() => {
    const targetBefore = ABYME.W.tideTarget;
    ABYME.ending('tend');
    for (let i=0;i<280;i++) ABYME.game.tick(0.05, 9 + i*0.05);
    const s = ABYME.upstreamHandState();
    return { s, targetBefore, target:ABYME.W.tideTarget,
      surfaceTarget:ABYME.effectiveTideAt(1),
      surgeCommitted:ABYME.W.flags.upstreamHandSurged,
      witnessed:ABYME.W.flags.upstreamHandWitnessed,
      audioStopped:ABYME.game._upstreamAudioStop == null,
      owners:ABYME.ambientDuckOwners(),
      law:(ABYME.W.onceKeys||[]).includes('theLaw'), locked:ABYME.player.locked,
      ending:ABYME.W.flags.endingCommitted, kind:ABYME.getFinale()?.kind };
  })()`);
  ok('committing a disposition resolves the active hand without leaking across the finale',
    terminalClick && terminalBefore.state?.active === true && terminalBefore.audioArmed
      && terminal.s?.active === false
      && terminal.s?.modelPulse <= 0.02 && terminal.s?.wallScale <= 0.02
      && terminal.s?.worldRadius <= 0.02 && terminal.audioStopped
      && terminal.owners.length === 1 && terminal.owners[0] === 'gameplay'
      && terminal.locked && terminal.ending && terminal.kind === 'tend'
      && terminal.surgeCommitted && !terminal.witnessed && !terminal.law
      && Math.abs(terminal.target - terminal.surfaceTarget) < 1e-6,
    { terminalBefore, terminal });
  await keepErrors('terminal cleanup');

  ok('the complete Upstream Hand path raises no browser errors', allErrors.length === 0, allErrors);

  for (const p of R.pass) console.log('  ok   ' + p);
  for (const f of R.fail) console.log('  FAIL ' + f);
  console.log(`  power baseline ${baselineBudget.calls} calls / ${baselineBudget.tris} tris`
    + ` · peak ${peakBudget.calls} calls / ${peakBudget.tris} tris`);
  if (shot) console.log('  shot ' + shot);
  console.log(`UPSTREAM-HAND ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) process.exitCode = 1;
  return R;
}
