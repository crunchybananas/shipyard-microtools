// runtime-reset.mjs — the in-memory new-run boundary owns every pending score.

export default async function runtimeReset(h) {
  const pass = [], fail = [];
  const ok = (name, condition, detail = null) => {
    (condition ? pass : fail).push(name);
    if (!condition && detail) console.log('  FAIL', name, JSON.stringify(detail));
  };
  const port = process.env.SERVE_PORT || 8642;
  const url = `http://127.0.0.1:${port}/the-island/?debug&mute&localstack`;

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!ABYME.game`).catch(() => false)) return;
      await h.wait(0.25);
    }
    throw new Error('app never booted');
  };

  await h.navigate(url);
  await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save'); localStorage.setItem('abyme-muted', '1'); 1`);
  await h.navigate(url);
  await ready();

  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(0.15);
  const duringIntro = await h.evaluate(`(() => {
    ABYME.UI.whisper('STALE RESET CUE', 9000);
    ABYME.W.tide = 0;
    let wet = { x:0, y:0, z:-113 };
    if (ABYME.terrain.heightAt(wet.x, wet.z) >= 0) {
      outer: for (let x = -120; x <= 120; x += 10) for (let z = -140; z <= 100; z += 10) {
        if (ABYME.terrain.heightAt(x, z) < 0) { wet = { x, y:0, z }; break outer; }
      }
    }
    ABYME.player.onFootstep('sand', wet);
    return { spray:!!ABYME.scene.getObjectByName('introSpray'), locked:ABYME.player.locked,
      pending:ABYME.pendingRunTimers() };
  })()`);
  await h.evaluate(`ABYME.resetFlags(); 1`);
  const introReset = await h.evaluate(`({
    spray:!!ABYME.scene.getObjectByName('introSpray'), locked:ABYME.player.locked,
    timers:ABYME.game._runtimeTimers.size, pending:ABYME.pendingRunTimers(),
    whisperTimer:ABYME.UI._whisperTimer != null, whisperQueue:ABYME.UI._whisperQueue.length,
    whisperText:ABYME.UI.whisperEl.textContent
  })`);
  ok('intro reset removes its spray, queued copy, and shared delayed work',
    duringIntro.spray && duringIntro.locked && duringIntro.pending > 0
      && !introReset.spray && !introReset.locked && introReset.pending === 0
      && !introReset.whisperTimer && introReset.whisperQueue === 0 && introReset.whisperText === '',
    { duringIntro, introReset });

  const armed = await h.evaluate(`(() => {
    const valve = ABYME.interact.hotspots.find((spot) => spot.id === 'valve');
    valve.onClick();
    Object.assign(ABYME.W.flags, { heardBox:true, heardBird:true });
    [2,3,4,3,0].forEach((stone) => ABYME.game._touchStone(stone));
    const box = ABYME.interact.hotspots.find((spot) => spot.id === 'musicBox');
    box.onClick();
    Object.assign(ABYME.game, {
      _watcherRegard:2.1, _tideRegard:1.7, watcherEchoT:12, tideFigureEchoT:9,
      _pendHour:3, _breachT:4, _farewellT:5, _brink:true,
    });
    ABYME.game.stoneSeq.push(4);
    ABYME.game.songSeq.push(2);
    return { score:ABYME.audioScore(), timers:ABYME.game._runtimeTimers.size,
      box:ABYME.game.boxPlaying };
  })()`);
  ok('fixture arms drone, interval, delayed notes, and puzzle clocks',
    armed.score.stems.includes(1) && armed.score.stems.includes(3)
      && armed.score.drones.includes(1) && armed.score.intervals.arp
      && armed.timers > 0 && armed.box,
    armed);

  await h.evaluate(`ABYME.resetFlags(); 1`);
  const reset = await h.evaluate(`(() => ({
    score:ABYME.audioScore(), timers:ABYME.game._runtimeTimers.size,
    seq:[ABYME.game.stoneSeq.length,ABYME.game.songSeq.length],
    box:ABYME.game.boxPlaying, bird:ABYME.game.birdTimer,
    regard:[ABYME.game._watcherRegard,ABYME.game._tideRegard],
    echo:[ABYME.game.watcherEchoT,ABYME.game.tideFigureEchoT],
    era:[ABYME.game._pendHour,ABYME.game._breachT,ABYME.game._farewellT],
    brink:ABYME.game._brink, spray:!!ABYME.scene.getObjectByName('introSpray'),
  }))()`);
  ok('Game reset clears pending callbacks, sequences, clocks, and encounter regard',
    reset.timers === 0 && reset.seq.every((n) => n === 0) && !reset.box && reset.bird === 8
      && reset.regard.every((n) => n === 0) && reset.echo.every((n) => n === null)
      && reset.era[0] === 0 && reset.era[1] === null && reset.era[2] === null
      && !reset.brink && !reset.spray,
    reset);
  ok('Audio reset removes stem nodes and every stem interval',
    reset.score.stems.length === 0 && reset.score.drones.length === 0
      && Object.values(reset.score.intervals).every((active) => !active),
    reset.score);

  await h.wait(4.2);
  const settled = await h.evaluate(`({
    timers:ABYME.game._runtimeTimers.size, box:ABYME.game.boxPlaying,
    glow:ABYME.game.anim.stoneGlow.reduce((sum,n)=>sum+n,0),
    staleIntro:['Click, and the sea will hurry.','STALE RESET CUE'].includes(ABYME.UI.whisperEl.textContent)
  })`);
  ok('canceled callbacks stay canceled after their original deadlines',
    settled.timers === 0 && !settled.box && settled.glow === 0 && !settled.staleIntro,
    settled);

  const replayReset = await h.evaluate(`(() => {
    ABYME.resetFlags();
    const report = ABYME.report('clean replay fixture', false);
    const diveMarksBefore = ABYME.ledger().marks.filter((mark) => mark.k === 'dive').length;
    ABYME.dive(false);
    ABYME.UI.whisper('STALE REPLAY CUE', 9000);
    const armed = {
      dive:!!ABYME.getDive(), locked:ABYME.player.locked,
      cinematic:ABYME.UI.letterbox.classList.contains('on'),
    };
    ABYME.applyReport(report);
    return { armed,
      dive:!!ABYME.getDive(), locked:ABYME.player.locked,
      cinematic:ABYME.UI.letterbox.classList.contains('on'),
      timers:ABYME.game._runtimeTimers.size, pending:ABYME.pendingRunTimers(),
      whisperTimer:ABYME.UI._whisperTimer != null, whisperQueue:ABYME.UI._whisperQueue.length,
      whisperText:ABYME.UI.whisperEl.textContent,
      at:[ABYME.player.pos.x,ABYME.player.pos.y,ABYME.player.pos.z], reportAt:report.pos,
      diveMarksBefore,
      diveMarksAfter:ABYME.ledger().marks.filter((mark) => mark.k === 'dive').length,
    };
  })()`);
  ok('report replay cancels the crossing without inheriting state or recording a phantom dive',
    replayReset.armed.dive && replayReset.armed.locked && replayReset.armed.cinematic
      && !replayReset.dive && !replayReset.locked && !replayReset.cinematic
      && replayReset.timers === 0 && replayReset.pending === 0
      && !replayReset.whisperTimer && replayReset.whisperQueue === 0 && replayReset.whisperText === ''
      && replayReset.diveMarksAfter === replayReset.diveMarksBefore
      && replayReset.at.every((value, i) => Math.abs(value - replayReset.reportAt[i]) < 0.011),
    replayReset);

  console.log(`RUNTIME-RESET PASS ${pass.length} / ${pass.length + fail.length}`);
  if (fail.length) {
    console.log('FAILURES:', JSON.stringify(fail));
    process.exitCode = 1;
  }
}
