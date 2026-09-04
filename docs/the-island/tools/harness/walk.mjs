// walk.mjs — full future-facing route: observation → manipulation → crossing → account.
//
// This uses the shipped hotspot callbacks for every puzzle action and the pure
// ChallengeGraph for threshold inspection. Long camera travel is skipped through the
// public debug crossing, so the gate measures causality rather than GPU wall-clock.

export default async function walk(h) {
  const R = { pass: [], fail: [] };
  const ok = (name, condition, detail = undefined) => (condition ? R.pass : R.fail)
    .push(condition || detail === undefined ? name : `${name} :: ${JSON.stringify(detail)}`);
  const port = process.env.SERVE_PORT || 8642;
  const url = `http://127.0.0.1:${port}/the-island/?debug&mute&localstack`;

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  const startFresh = async () => {
    await h.navigate(url);
    await ready();
    await h.evaluate(`localStorage.clear(); localStorage.setItem('abyme-muted', '1'); 1`);
    await h.navigate(url);
    await ready();
    await h.evaluate(`window.__walkErrors = [];
      addEventListener('error', (event) => window.__walkErrors.push(event.message));
      addEventListener('unhandledrejection', (event) => window.__walkErrors.push(String(event.reason)));
      document.getElementById('btn-begin').click(); 1`);
    await h.wait(1.5);
    await h.evaluate(`ABYME.setIntroT(99); 1`);
    await h.wait(2.2);
  };

  await h.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });
  await startFresh();

  const boot = await h.evaluate(`(async () => {
    const schema = await import('/the-island/js/save-schema.js');
    ABYME.resetFlags(); ABYME.W.flags.introDone = true;
    const raw = localStorage.getItem(schema.SAVE_KEY);
    const saved = raw && JSON.parse(raw);
    return {
      level:ABYME.W.level,
      key:schema.SAVE_KEY,
      version:schema.SAVE_VERSION,
      savedVersion:saved?.v,
      notebook:Array.isArray(saved?.notebook?.entries) && !!saved?.notebook?.hintLevels,
      dials:Array.isArray(saved?.dials) && saved.dials.length === 4,
    };
  })()`);
  ok('BOOT.surface-play-state', boot.level === 1);
  ok('SAVE.clean-epoch', boot.key === 'abyme-save' && boot.version === 2 && boot.savedVersion === 2);
  ok('SAVE.future-payload', boot.notebook && boot.dials);

  // The revealed wheels are always physical controls. Sources inform a player but
  // never pin the mechanism or create an intermediate solved flag.
  const isolatedDecoder = await h.evaluate(`(() => {
    const hs = (id) => ABYME.game.interact.hotspots.find((spot) => spot.id === id);
    const result = {};

    ABYME.resetFlags(); ABYME.W.flags.introDone = true;
    ABYME.W.flags.shadowRevealed = true;
    hs('lore_signal_shelf').onClick(); ABYME.UI._readerPage(1); ABYME.UI.closeReader();
    hs('dial0').onClick();
    result.shelf = {
      value:ABYME.W.dials[0], decoded:ABYME.W.flags.hatchCodeDecoded,
      beam:ABYME.notebook.has('evidence.beam-glyphs'),
      shelf:ABYME.notebook.has('artifact.signal-shelf.surface'),
    };

    ABYME.resetFlags(); ABYME.W.flags.introDone = true;
    ABYME.W.flags.shadowRevealed = true;
    ABYME.W.flags.glyphsSeen = true;
    ABYME.notebook.record('evidence.beam-glyphs', { glyphs:[1,5,3,4] });
    hs('dial0').onClick();
    result.beam = {
      value:ABYME.W.dials[0], decoded:ABYME.W.flags.hatchCodeDecoded,
      beam:ABYME.notebook.has('evidence.beam-glyphs'),
      shelf:ABYME.notebook.has('artifact.signal-shelf.surface'),
    };
    return result;
  })()`);
  ok('DECODER.shelf-alone-still-turns-wheels', isolatedDecoder.shelf.shelf && !isolatedDecoder.shelf.beam
    && isolatedDecoder.shelf.value === 1 && !isolatedDecoder.shelf.decoded);
  ok('DECODER.beam-alone-still-turns-wheels', isolatedDecoder.beam.beam && !isolatedDecoder.beam.shelf
    && isolatedDecoder.beam.value === 1 && !isolatedDecoder.beam.decoded);

  const surface = await h.evaluate(`(async () => {
    const progression = await import('/the-island/js/progression.js');
    const W = ABYME.W;
    const game = ABYME.game;
    const hs = (id) => game.interact.hotspots.find((spot) => spot.id === id);
    const out = {};

    ABYME.resetFlags(); W.flags.introDone = true;
    out.initialMissing = progression.missingRequirements('surface', W, ABYME.notebook);

    hs('chest').onClick();
    out.chestBlocked = !W.flags.chestOpen && !W.flags.rulerTaken;

    hs('valve').onClick(); W.tide = W.tideTarget;
    out.valve = W.flags.valveTurned && W.tideTarget === 0
      && ABYME.notebook.has('evidence.valve');

    hs('chest').onClick(); hs('chest').onClick();
    out.chest = W.flags.chestOpen && W.flags.rulerTaken && W.inventory.includes('ruler');

    hs('crack').onClick();
    out.ruler = W.flags.rulerPlaced && !W.inventory.includes('ruler')
      && ABYME.notebook.has('evidence.ruler');

    hs('crank').onDrag(48);
    out.crank = W.flags.crankUsed && ABYME.notebook.has('evidence.crank');

    for (const note of [2,3,4,3,0]) game._touchStone(note);
    out.noSongs = !W.flags.birdSolved && game.stoneSeq.length === 0;

    hs('musicBox').onClick();
    out.box = W.flags.heardBox && ABYME.notebook.has('evidence.music-box');
    for (const note of [2,3,4,3,0]) game._touchStone(note);
    out.boxOnly = !W.flags.birdSolved && game.stoneSeq.length === 0;

    W.time = 6.5; W.timeDrift = 0;
    ABYME.tp(135, -158, 0, 0); game._birdSing();
    out.bird = W.flags.heardBird && ABYME.notebook.has('evidence.bird');
    for (const note of [2,3,4,3,0]) game._touchStone(note);
    out.stones = W.flags.birdSolved && ABYME.notebook.has('mechanism.stone-vault');

    hs('lensItem').onClick();
    out.lensTaken = W.flags.lensTaken && W.inventory.includes('lens');
    hs('lensSlot').onClick();
    out.lensPlaced = W.lensPlaced && !W.inventory.includes('lens')
      && ABYME.notebook.has('evidence.lens');

    W.time = 17.8; W.timeDrift = 0; game.tick(0.05, 1);
    out.shimmerAvailable = hs('shimmer').when();
    hs('shimmer').onClick();
    out.shadow = W.flags.shadowRevealed && ABYME.notebook.has('evidence.shadow-hatch');

    W.time = 22; W.timeDrift = 0;
    W.beamAngle = Math.atan2(57.5 - (-85), 50 - (-40));
    ABYME.tp(40, 38, 0, 0); game.tick(0.1, 2);
    out.glyphs = W.flags.glyphsSeen && ABYME.notebook.has('evidence.beam-glyphs');

    const beforeTurn = W.dials[0]; hs('dial0').onClick();
    out.beamOnly = W.dials[0] === (beforeTurn + 1) % 10 && !W.flags.hatchCodeDecoded;

    hs('lore_signal_shelf').onClick();
    out.shelfOpen = W.reading && !ABYME.notebook.has('artifact.signal-shelf.surface');
    ABYME.UI._readerPage(1);
    out.shelfReader = ABYME.notebook.has('artifact.signal-shelf.surface');
    ABYME.UI.closeReader(); game.tick(0.05, 3);
    out.decodeWaitsForCorrectState = !W.flags.hatchCodeDecoded
      && !ABYME.notebook.has('inference.hatch-code');

    for (let i = 0; i < ABYME.HATCH_CODE.length; i++) {
      const remaining = (ABYME.HATCH_CODE[i] - W.dials[i] + 10) % 10;
      for (let n = 0; n < remaining; n++) hs('dial' + i).onClick();
    }
    out.decimal = W.dials.every((value) => Number.isInteger(value) && value >= 0 && value <= 9);
    out.hatch = W.flags.hatchCodeDecoded && W.flags.hatchOpen
      && W.dials.join(',') === ABYME.HATCH_CODE.join(',');

    hs('plumb').onClick();
    out.plumbTaken = W.flags.plumbTaken && W.inventory.includes('plumb');
    hs('hook').onClick();
    out.plumbHung = W.flags.plumbHung && !W.inventory.includes('plumb')
      && ABYME.notebook.has('evidence.plumb');

    out.missing = progression.missingRequirements('surface', W, ABYME.notebook);
    out.arm = progression.nextPlateAction({ world:W, notebook:ABYME.notebook, armed:false }).kind;
    out.cross = progression.nextPlateAction({ world:W, notebook:ABYME.notebook, armed:true }).kind;
    out.notes = W.notebook.entries.map((entry) => entry.id);

    const schema = await import('/the-island/js/save-schema.js');
    const persisted = JSON.parse(localStorage.getItem(schema.SAVE_KEY) || 'null');
    out.persisted = persisted?.v === schema.SAVE_VERSION
      && persisted?.flags?.plumbHung === true
      && persisted?.flags?.hatchCodeDecoded === true
      && persisted?.flags?.hatchOpen === true
      && persisted?.dials?.join(',') === ABYME.HATCH_CODE.join(',')
      && !persisted?.notebook?.entries?.some((entry) => entry.id === 'inference.hatch-code');
    return out;
  })()`);

  ok('SURFACE.gate-names-whole-circuit', surface.initialMissing.length === 12);
  ok('SURFACE.chest-requires-drained-tide', surface.chestBlocked);
  ok('SURFACE.valve-moves-basin-and-bay', surface.valve);
  ok('SURFACE.chest-yields-ruler', surface.chest);
  ok('SURFACE.ruler-makes-bridge', surface.ruler);
  ok('SURFACE.crank-earns-the-hour', surface.crank);
  ok('SURFACE.stones-reject-no-songs', surface.noSongs);
  ok('SURFACE.music-box-is-first-source', surface.box);
  ok('SURFACE.stones-reject-one-song', surface.boxOnly);
  ok('SURFACE.dawn-bird-is-second-source', surface.bird);
  ok('SURFACE.bird-sequence-opens-vault', surface.stones);
  ok('SURFACE.vault-yields-lens', surface.lensTaken);
  ok('SURFACE.lens-couples-lighthouses', surface.lensPlaced);
  ok('SURFACE.golden-shadow-reveals-hatch', surface.shimmerAvailable && surface.shadow);
  ok('SURFACE.beam-writes-ordered-figures', surface.glyphs);
  ok('DECODER.revealed-wheels-always-turn', surface.beamOnly);
  ok('DECODER.index-is-read-in-world', surface.shelfOpen && surface.shelfReader);
  ok('DECODER.no-auto-solved-inference', surface.decodeWaitsForCorrectState);
  ok('HATCH.wheels-are-decimal', surface.decimal);
  ok('HATCH.physical-readings-open-stone', surface.hatch);
  ok('SURFACE.cellar-yields-plumb', surface.plumbTaken);
  ok('SURFACE.plumb-closes-circuit', surface.plumbHung);
  ok('GATE.surface-ready', surface.missing.length === 0 && surface.arm === 'arm-descent' && surface.cross === 'descend');
  ok('NOTES.route-is-earned-evidence', [
    'evidence.valve', 'evidence.music-box', 'evidence.bird', 'evidence.beam-glyphs',
    'artifact.signal-shelf.surface', 'evidence.plumb',
  ].every((id) => surface.notes.includes(id)));
  ok('SAVE.route-persists-current-contract', surface.persisted);

  const level2 = await h.evaluate(`(async () => {
    const progression = await import('/the-island/js/progression.js');
    ABYME.dive(true);
    const W = ABYME.W, game = ABYME.game;
    const hs = (id) => game.interact.hotspots.find((spot) => spot.id === id);
    const before = progression.missingRequirements('level2', W, ABYME.notebook);

    const plate = ABYME.refs.deskPlate.position;
    ABYME.tp(plate.x, plate.z, 0, 0); hs('plate').onClick();
    const blocked = W.level === 2 && !game.atBrink();

    hs('valve').onClick();
    const armed = game.upstreamState().active;
    game.resolveUpstreamHand({ reveal:true });
    const upstream = W.flags.upstreamHandWitnessed && ABYME.notebook.has('event.upstream-hand');

    ABYME.tideFigure();
    for (let i = 0; i < 30; i++) game.tick(0.1, 10 + i * 0.1);
    const tideFigure = W.flags.tideFigureSeen && ABYME.notebook.has('encounter.tide-figure');
    const missing = progression.missingRequirements('level2', W, ABYME.notebook);
    const action = progression.nextPlateAction({ world:W, notebook:ABYME.notebook, armed:false }).kind;
    return { level:W.level, before, blocked, armed, upstream, tideFigure, missing, action };
  })()`);
  ok('CROSSING.arrives-at-shallows', level2.level === 2);
  ok('GATE.level2-blocks-two-unwitnessed-events', level2.before.length === 2 && level2.blocked);
  ok('LEVEL2.dead-valve-reveals-upstream-hand', level2.armed && level2.upstream);
  ok('LEVEL2.stillness-resolves-tide-figure', level2.tideFigure);
  ok('GATE.level2-ready', level2.missing.length === 0 && level2.action === 'arm-descent');

  const level3 = await h.evaluate(`(async () => {
    const progression = await import('/the-island/js/progression.js');
    ABYME.dive(true);
    const W = ABYME.W, game = ABYME.game;
    const hs = (id) => game.interact.hotspots.find((spot) => spot.id === id);
    const before = progression.missingRequirements('level3', W, ABYME.notebook);

    const plate = ABYME.refs.deskPlate.position;
    ABYME.tp(plate.x, plate.z, 0, 0); hs('plate').onClick();
    const blocked = W.level === 3 && !game.atBrink();

    ABYME.tp(-86.4, -39.3, 0, 0);
    for (let i = 0; i < 20; i++) game.tick(0.1, 20 + i * 0.1);
    const register = W.flags.registerRead && ABYME.notebook.has('evidence.register');

    ABYME.watcher('spawn');
    for (let i = 0; i < 30; i++) game.tick(0.1, 24 + i * 0.1);
    const watcher = W.flags.watcherSeen && ABYME.notebook.has('encounter.watcher');
    const missing = progression.missingRequirements('level3', W, ABYME.notebook);
    const action = progression.nextPlateAction({ world:W, notebook:ABYME.notebook, armed:false }).kind;
    return { level:W.level, before, blocked, register, watcher, missing, action };
  })()`);
  ok('CROSSING.arrives-at-inspection', level3.level === 3);
  ok('GATE.level3-blocks-record-and-watcher', level3.before.length === 2 && level3.blocked);
  ok('LEVEL3.register-requires-table-dwell', level3.register);
  ok('LEVEL3.held-gaze-resolves-watcher', level3.watcher);
  ok('GATE.level3-ready', level3.missing.length === 0 && level3.action === 'arm-descent');

  const source = await h.evaluate(`(async () => {
    const progression = await import('/the-island/js/progression.js');
    ABYME.dive(true);
    const W = ABYME.W, game = ABYME.game;
    const hs = (id) => game.interact.hotspots.find((spot) => spot.id === id);
    const before = progression.missingRequirements('level4', W, ABYME.notebook);

    const plate = ABYME.refs.deskPlate.position;
    ABYME.tp(plate.x, plate.z, 0, 0); hs('plate').onClick();
    const blocked = W.level === 4 && !game.atBrink();

    ABYME.bottom();
    const figure = new ABYME.THREE.Vector3();
    game.modelRefs.tinyFigure.getWorldPosition(figure);
    const dx = figure.x - ABYME.player.pos.x, dz = figure.z - ABYME.player.pos.z;
    const toward = Math.atan2(-dx, -dz);
    const yawError = Math.atan2(Math.sin(ABYME.player.yaw - toward), Math.cos(ABYME.player.yaw - toward));
    const bottomFrames = Math.abs(yawError) < 0.02;
    ABYME.player.yaw = toward + Math.PI;
    for (let i = 0; i < 30; i++) game.tick(0.1, 30 + i * 0.1);
    const proximityOnly = !W.flags.lowerHandRegarded;

    ABYME.player.yaw = toward; game._lowerPrev = null;
    for (let i = 0; i < 30; i++) game.tick(0.1, 34 + i * 0.1);
    const regarded = W.flags.lowerHandRegarded && ABYME.notebook.has('encounter.lower-hand');
    const choiceMissing = progression.missingRequirements('level4', W, ABYME.notebook);

    ABYME.tp(plate.x, plate.z, 0, 0); hs('plate').onClick();
    const blockedWithoutChoice = !game.atBrink();

    hs('dispSet').onClick();
    const selected = W.flags.dispositionChosen && W.disposition === 'tend'
      && ABYME.notebook.has('evidence.disposition');
    const missing = progression.missingRequirements('level4', W, ABYME.notebook);
    const action = progression.nextPlateAction({ world:W, notebook:ABYME.notebook, armed:false }).kind;

    hs('bell').onClick();
    const bellIsInstrument = !W.flags.endingCommitted && !ABYME.getFinale();
    const diveRungs = ABYME.ledger().marks.filter((mark) => mark.k === 'dive').map((mark) => mark.r).sort();
    return { level:W.level, before, blocked, bottomFrames, proximityOnly, regarded, choiceMissing,
      blockedWithoutChoice, selected, missing, action, bellIsInstrument, diveRungs };
  })()`);
  ok('CROSSING.arrives-at-source', source.level === 4);
  ok('CROSSING.commits-one-shared-act-per-rung', source.diveRungs.join(',') === '1,2,3');
  ok('DEBUG.bottom-frames-the-lower-hand', source.bottomFrames);
  ok('GATE.level4-blocks-regard-and-choice', source.before.length === 2 && source.blocked);
  ok('LEVEL4.proximity-alone-does-not-resolve', source.proximityOnly);
  ok('LEVEL4.gaze-plus-stillness-regards-hand', source.regarded);
  ok('GATE.level4-still-needs-disposition', source.choiceMissing.length === 1
    && source.choiceMissing[0] === 'dispositionChosen' && source.blockedWithoutChoice);
  ok('LEVEL4.first-index-touch-explicitly-tends', source.selected);
  ok('GATE.level4-ready-for-ascent', source.missing.length === 0 && source.action === 'arm-ascent');
  ok('INSTRUMENT.bell-is-nonterminal', source.bellIsInstrument);

  const returned = await h.evaluate(`(() => {
    const W = ABYME.W, game = ABYME.game;
    const hs = (id) => game.interact.hotspots.find((spot) => spot.id === id);
    game.flag('climbing');
    const levels = [], landingSaves = [];
    for (let i = 0; i < 3; i++) {
      ABYME.ascend(true); levels.push(W.level);
      const persisted = JSON.parse(localStorage.getItem('abyme-save'));
      landingSaves.push(persisted.level === W.level
        && persisted.pos.every((value, axis) => Math.abs(value - [ABYME.player.pos.x, ABYME.player.pos.y, ABYME.player.pos.z][axis]) < 1e-6));
    }
    const oar = hs('oar');
    const oarAvailable = oar.when(); oar.onClick();
    const oarIsInstrument = !W.flags.endingCommitted && !ABYME.getFinale();
    const plate = ABYME.refs.deskPlate.position;
    ABYME.tp(plate.x, plate.z, 0, 0);
    hs('plate').onClick();
    const armed = game.atBrink() && !W.flags.endingCommitted;
    hs('plate').onClick();
    ABYME.setFinaleT(10);
    return {
      levels, landingSaves, returned:W.flags.returned, climbing:W.flags.climbing,
      returnNote:ABYME.notebook.has('return.surface'),
      oarAvailable, oarIsInstrument, armed,
      committed:W.flags.endingCommitted, kind:ABYME.getFinale()?.kind,
      endingNote:ABYME.notebook.has('ending.tend'),
      regions:{...W.regions},
    };
  })()`);
  await h.wait(0.35);
  const tendShown = await h.evaluate(`ABYME.getFinale()?.shown === true`);
  ok('ASCENT.returns-through-every-level', returned.levels.join(',') === '3,2,1');
  ok('ASCENT.destination-pose-saves-atomically', returned.landingSaves.every(Boolean));
  ok('ASCENT.surface-state-and-note', returned.returned && !returned.climbing && returned.returnNote);
  ok('INSTRUMENT.oar-is-nonterminal', returned.oarAvailable && returned.oarIsInstrument);
  ok('ENDING.surface-plate-arms-before-commit', returned.armed);
  ok('ENDING.tend-commits-at-returned-plate', returned.committed && returned.kind === 'tend'
    && returned.endingNote && tendShown);
  ok('JOURNEY.all-regions-visited', returned.regions.l2seen && returned.regions.l3seen && returned.regions.l4seen);

  const branchResults = [];
  for (const [choice, touches] of [['carry', 2], ['open', 3], ['close', 4]]) {
    await startFresh();
    const staged = await h.evaluate(`(() => {
      const choice = ${JSON.stringify(choice)};
      const touches = ${touches};
      const W = ABYME.W, game = ABYME.game;
      const hs = (id) => game.interact.hotspots.find((spot) => spot.id === id);
      ABYME.resetFlags(); W.flags.introDone = true; W.flags.plumbHung = true;
      // Give OPEN real weight to carry uphill through the canonical landing seam;
      // debug goLevel is intentionally non-causal, and every submerged valve is
      // intentionally dead. A real dive from L3 records one rung-3 act and lands
      // at L4, matching the history an ordinary full descent always creates.
      if (choice === 'open') { ABYME.goLevel(3); ABYME.dive(true); }
      else ABYME.goLevel(4);
      ABYME.bottom();
      W.flags.lowerHandRegarded = true; ABYME.notebook.record('encounter.lower-hand');
      for (let i = 0; i < touches; i++) hs('dispSet').onClick();
      const dial = W.disposition;
      hs('bell').onClick();
      const bellSafe = !W.flags.endingCommitted && !ABYME.getFinale();
      W.flags.climbing = true;
      ABYME.ascend(true); ABYME.ascend(true); ABYME.ascend(true);
      hs('oar').onClick();
      const oarSafe = !W.flags.endingCommitted && !ABYME.getFinale();
      const plate = ABYME.refs.deskPlate.position;
      ABYME.tp(plate.x, plate.z, 0, 0);
      hs('plate').onClick(); const armed = game.atBrink();
      hs('plate').onClick(); ABYME.setFinaleT(10);
      return { choice, dial, bellSafe, oarSafe, armed,
        committed:W.flags.endingCommitted,
        finale:ABYME.getFinale()?.kind,
        note:ABYME.notebook.has('ending.' + choice),
        tideTarget:W.tideTarget,
      };
    })()`);
    await h.wait(0.35);
    staged.shown = await h.evaluate(`ABYME.getFinale()?.shown === true`);
    staged.errors = await h.evaluate(`window.__walkErrors || []`);
    branchResults.push(staged);
  }

  for (const branch of branchResults) {
    ok(`ENDING.${branch.choice}-selected-by-four-stop-index`, branch.dial === branch.choice);
    ok(`ENDING.${branch.choice}-commits-only-at-returned-plate`, branch.bellSafe && branch.oarSafe
      && branch.armed && branch.committed && branch.finale === branch.choice && branch.note && branch.shown
      && (branch.choice !== 'open' || branch.tideTarget > 1), branch);
  }

  const errors = [
    ...(await h.evaluate(`window.__walkErrors || []`)),
    ...branchResults.flatMap((branch) => branch.errors),
  ];
  ok('RUNTIME.zero-window-errors', errors.length === 0);

  console.log(`WALK PASS ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) {
    console.log('FAILURES:', JSON.stringify(R.fail));
    console.log('WINDOW ERRORS:', JSON.stringify(errors));
    process.exitCode = 1;
  }
}
