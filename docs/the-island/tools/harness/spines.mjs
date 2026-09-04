// spines.mjs — the study's physical glyph-to-instrument decoder.
//
// Eight index volumes route the figure alphabet to instruments already handled in
// play. The beam supplies four figures; observations at those instruments supply four
// readings; the hatch accepts the result. No spine is allowed to print a value.

import { readFile } from 'node:fs/promises';

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, condition, detail) =>
    (condition ? R.pass : R.fail).push(name + (condition ? '' : ' :: ' + JSON.stringify(detail)));
  const PAGE = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute&localstack';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };
  await h.navigate(PAGE); await ready();
  await h.evaluate(`import('./js/save-schema.js').then(({ SAVE_KEY }) => {
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem('abyme-muted', '1'); return 1;
  })`);
  await h.navigate(PAGE); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  const scene = await h.evaluate(`Promise.all([import('./js/props.js'), import('./js/content.js')]).then(([P, C]) => {
    const realNamed = (name) => {
      let found = null;
      ABYME.scene.traverse((o) => {
        if (found || o.name !== name) return;
        let q = o.parent;
        while (q) { if (q.name === 'modelAnchor') return; q = q.parent; }
        found = o;
      });
      return found;
    };
    const texIndex = (o, cells) => o?.material?.map
      ? Math.round((((o.material.map.offset.x % 1) + 1) % 1) * cells) % cells
      : null;
    const inkByCell = (canvas, cells) => {
      const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      g.canvas.width = canvas.width; g.canvas.height = canvas.height;
      g.drawImage(canvas, 0, 0);
      const cw = canvas.width / cells;
      const out = [];
      for (let c = 0; c < cells; c++) {
        const data = g.getImageData(Math.round(c * cw), 0, Math.round(cw), canvas.height).data;
        let ink = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 32) ink++;
        out.push(ink);
      }
      return out;
    };

    const decoder = realNamed('signalShelf');
    const volumes = decoder ? decoder.children.filter((o) => o.name.startsWith('signalVolume')) : [];
    const volumeData = volumes.map((v) => {
      const glyph = v.getObjectByName('signalGlyph' + v.userData.glyph);
      const instrument = v.getObjectByName('signalInstrument' + v.userData.glyph);
      const bodies = v.children.filter((o) => o.isMesh && !o.name).length;
      return {
        name: v.name,
        glyph: v.userData.glyph,
        instrument: v.userData.instrument,
        label: v.userData.label,
        hasNumeralData: Object.hasOwn(v.userData, 'numeral'),
        glyphCell: texIndex(glyph, P.GLYPHS),
        instrumentCell: texIndex(instrument, P.GLYPHS),
        x: +v.position.x.toFixed(3), y: +v.position.y.toFixed(3),
        glyphAttached: glyph?.parent === v,
        instrumentAttached: instrument?.parent === v,
        retiredNumeral: !!v.getObjectByName('decoderNumeral' + v.userData.glyph),
        physicalPieces: bodies,
      };
    });
    const beam = realNamed('glyphPlane');
    const hall = realNamed('hallGlyphs');
    const dials = [0, 1, 2, 3].map((i) => {
      const dial = realNamed('dial' + i);
      const number = realNamed('dialNumber' + i);
      return {
        dial: !!dial, number: !!number,
        numeralIndex: dial?.userData?.numeralIndex,
        cell: texIndex(number, P.NUMERALS),
        repeat: number?.material?.map?.repeat?.x,
        parent: number?.parent?.name,
      };
    });
    const glyphAtlas = P.makeGlyphAtlas();
    const instrumentAtlas = P.makeInstrumentAtlas();
    const numeralAtlas = P.makeNumeralAtlas();
    const plates = [0, 2, 7].map((glyph) => {
      const plate = realNamed('apparatusPlate' + glyph);
      const mark = realNamed('apparatusMark' + glyph);
      return {
        glyph, plate: !!plate, mark: !!mark,
        anchored: !!plate && !!mark && Math.hypot(plate.position.x - mark.position.x,
          plate.position.z - mark.position.z) < 0.001 && mark.position.y - plate.position.y < 0.03,
      };
    });
    const pivot = realNamed('orreryPivot');
    const lamp = realNamed('orreryLamp');
    const crank = realNamed('crankHandle');
    return JSON.stringify({
      GLYPHS: P.GLYPHS, NUMERALS: P.NUMERALS,
      bindings: P.SIGNAL_BINDINGS.map((binding) => ({ ...binding })), beamGlyphs: [...P.BEAM_GLYPHS], hatchCode: [...P.HATCH_CODE],
      marks: P.SHELF_BINDING_MARKS.map((m) => ({ ...m })),
      decoder: !!decoder, volumeData,
      beamCells: beam ? beam.children.map((o) => texIndex(o, P.GLYPHS)) : [],
      hallCells: hall ? hall.children.map((o) => texIndex(o, P.GLYPHS)) : [],
      dials,
      oldDialVisuals: [0, 1, 2, 3].filter((i) => !!realNamed('dialGlyph' + i)),
      reader: !!realNamed('lore_signal_shelf'),
      retiredReaders: ['lore_decoder_shelf', 'lore_lettered_shelf'].filter((name) => !!realNamed(name)),
      atlases: {
        glyph: [glyphAtlas.image.width, glyphAtlas.image.height],
        instrument: [instrumentAtlas.image.width, instrumentAtlas.image.height],
        numeral: [numeralAtlas.image.width, numeralAtlas.image.height],
        distinctImages: new Set([glyphAtlas.image, instrumentAtlas.image, numeralAtlas.image]).size === 3,
        glyphInk: inkByCell(glyphAtlas.image, P.GLYPHS),
        instrumentInk: inkByCell(instrumentAtlas.image, P.GLYPHS),
        numeralInk: inkByCell(numeralAtlas.image, P.NUMERALS),
      },
      apparatus: {
        plates,
        lampRadius: lamp ? +lamp.position.x.toFixed(3) : null,
        crankRadius: pivot && crank ? +Math.hypot(crank.position.x - pivot.position.x,
          crank.position.z - pivot.position.z).toFixed(3) : null,
      },
      content: {
        lore: C.LORE.signal_shelf || null,
        shelfExports: Object.keys(C).filter((key) => key.startsWith('SHELF_')),
      },
    });
  })`).then(JSON.parse);

  const expectedBeam = [1, 5, 3, 4];
  const expectedCode = [5, 1, 4, 6];
  ok('the decoder exports one distinct physical instrument for every glyph',
    scene.bindings.length === 8
      && JSON.stringify(scene.bindings.map(({ glyph }) => glyph)) === JSON.stringify([0,1,2,3,4,5,6,7])
      && new Set(scene.bindings.map(({ instrument }) => instrument)).size === 8,
    scene.bindings);
  ok('the beam projects figures rather than hatch numbers',
    JSON.stringify(scene.beamGlyphs) === JSON.stringify(expectedBeam), scene.beamGlyphs);
  ok('the hatch code is derived through physical instrument readings',
    JSON.stringify(scene.beamGlyphs.map((g) => scene.bindings.find((b) => b.glyph === g)?.reading)) === JSON.stringify(scene.hatchCode)
      && JSON.stringify(scene.hatchCode) === JSON.stringify(expectedCode),
    { beam: scene.beamGlyphs, bindings: scene.bindings, code: scene.hatchCode });

  ok('exactly eight physical index volumes exist', scene.decoder && scene.volumeData.length === 8,
    scene.volumeData.map((v) => v.name));
  ok('each volume physically binds its matching glyph and named instrument', scene.volumeData.every((v) =>
    v.glyphAttached && v.instrumentAttached && v.glyphCell === v.glyph && v.instrumentCell === v.glyph
      && v.instrument && v.label && !v.hasNumeralData && !v.retiredNumeral
      && v.physicalPieces >= 6), scene.volumeData);
  ok('the index is arranged as two legible rows of four',
    new Set(scene.volumeData.map((v) => v.y)).size === 2
      && [...new Set(scene.volumeData.map((v) => v.y))].every((y) => scene.volumeData.filter((v) => v.y === y).length === 4),
    scene.volumeData.map((v) => [v.glyph, v.x, v.y]));
  ok('recorded shelf evidence matches every physical volume', scene.marks.length === 8 && scene.marks.every((m) => {
    const v = scene.volumeData.find((x) => x.glyph === m.glyph);
    return !!v && v.instrument === m.instrument && v.label === m.label
      && !Object.hasOwn(m, 'numeral') && Math.abs(v.x - m.localX) < 0.001;
  }), { marks: scene.marks, volumes: scene.volumeData });
  ok('no index volume is visually privileged as part of the answer',
    new Set(scene.volumeData.map((v) => v.physicalPieces)).size === 1,
    scene.volumeData.map((v) => [v.glyph, v.physicalPieces]));

  ok('the cliff and drowned hall carry the same four beam figures',
    JSON.stringify(scene.beamCells) === JSON.stringify(expectedBeam)
      && JSON.stringify(scene.hallCells) === JSON.stringify(expectedBeam),
    { cliff: scene.beamCells, hall: scene.hallCells });
  ok('the hatch exposes four decimal dials at zero', scene.dials.every((d, i) =>
    d.dial && d.number && d.parent === 'dial' + i && d.numeralIndex === 0 && d.cell === 0
      && Math.abs(d.repeat - 0.1) < 1e-9), scene.dials);
  ok('glyphs, instrument labels, and dial numerals live in separate atlases',
    scene.atlases.distinctImages
      && scene.atlases.glyph[0] === scene.atlases.glyph[1] * 8
      && scene.atlases.instrument[0] === scene.atlases.instrument[1] * 8
      && scene.atlases.numeral[0] === scene.atlases.numeral[1] * 10, scene.atlases);
  ok('every glyph, instrument, and numeral atlas cell contains a readable mark',
    scene.atlases.glyphInk.every((n) => n > 20)
      && scene.atlases.instrumentInk.every((n) => n > 20)
      && scene.atlases.numeralInk.every((n) => n > 20), scene.atlases);
  ok('no glyph visual remains on the decimal dials', scene.oldDialVisuals.length === 0,
    scene.oldDialVisuals);
  ok('the reader belongs to the instrument shelf and retired proxies are gone',
    scene.reader && scene.retiredReaders.length === 0, { reader: scene.reader, retired: scene.retiredReaders });

  ok('the chart marks are seated on three instrument plates',
    scene.apparatus.plates.every((p) => p.plate && p.mark && p.anchored), scene.apparatus.plates);
  ok('the orrery and crank stay inside the chart-table footprint',
    scene.apparatus.lampRadius <= 0.9 && scene.apparatus.crankRadius <= 1.8, scene.apparatus);

  const lore = scene.content.lore;
  const prose = lore ? JSON.stringify(lore) : '';
  const compact = prose.toUpperCase().replace(/[^A-Z0-9]/g, '');
  ok('the instrument index has a reader observation', !!lore && Array.isArray(lore.pages) && lore.pages.length > 0,
    lore && { pages: lore.pages.length });
  ok('reader prose never prints the four-number answer',
    !/5\D{0,12}1\D{0,12}4\D{0,12}6/.test(prose) && !/numeral/i.test(prose), prose);
  ok('the old hidden sentence and title arrays are absent',
    !compact.includes('ITHASTOGOSOMEWHERE') && scene.content.shelfExports.length === 0,
    scene.content.shelfExports);

  const propsSource = await readFile(new URL('../../js/props.js', import.meta.url), 'utf8');
  const oldMachinery = ['GLYPH_CODE', 'SHELF_TITLES', 'SHELF_DECOYS', 'SHELF_MARKS',
    'SHELF_STATS', 'SPINE_TITLE0', 'SPINE_DECOY0', 'spineAtlas', 'spineCell', 'lore_lettered_shelf',
    'SIGNAL_INDEX', 'GLYPH_TO_NUMERAL', 'SHELF_DECODER_MARKS', 'decoderNumeral'];
  ok('no answer-key or acrostic-era machinery remains in props',
    oldMachinery.every((token) => !propsSource.includes(token)),
    oldMachinery.filter((token) => propsSource.includes(token)));

  console.log(`SPINES ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  figures ${scene.beamGlyphs.join(' ')} → instruments → readings ${scene.hatchCode.join(' ')}`);
  console.log(`  ${scene.volumeData.length} index volumes · ${scene.atlases.instrumentInk.length}-instrument atlas · ${scene.atlases.numeralInk.length}-dial atlas`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
