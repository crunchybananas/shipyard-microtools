#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {ensureServer} from './_serve.mjs';
const output = new URL(`../tmp/graphics-world/building-lighting-gate${graphicsBrowserSuffix}/`, import.meta.url);
await mkdir(output, {recursive: true});
const server = await ensureServer(), browser = await launchGraphicsBrowser();
try {
  const page = await browser.newPage({viewport: {width: 1320, height: 980}, deviceScaleFactor: 2});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.gameUrl); await page.waitForFunction(() => typeof startNewGame === 'function');
  await page.evaluate(() => {startNewGame(); setSpeed(0);});
  await page.getByRole('button', {name: 'Skip tutorial', exact: true}).click();
  await page.waitForFunction(() => G.camera.zoom === 1.3 && __realm.rasterAtlas().state === 'ready' && __realm.supportAtlas().state === 'ready' && __realm.actorAtlas().tiers.some(t => t.state === 'ready'));
  const result = await page.evaluate(async () => {
    const lighting = await import('./js/building-lighting.js?realm=198');
    const {BUILDINGS, TILE} = await import('./js/state.js?realm=198');
    const {render, renderBuildingIsolated} = await import('./js/render.js?realm=198');
    const proto = CanvasRenderingContext2D.prototype, draw = proto.drawImage;
    const originalCitizen = G.citizens[0], originalAvatar = G.avatar;
    G.debug.pauseRendering = true; G._followAvatar = false; G._renderAlpha = 1;
    G.avatar = null; G.citizens = []; G.animals = []; G.walkers = []; G.soldiers = []; G.caravans = []; G.enemies = [];
    G.selectedBuilding = null; G.selectedBuild = null; G.hoveredTile = null;
    G.map = G.map.map(row => row.map(() => TILE.GRASS)); G.fog = G.map.map(row => row.map(() => true));
    G.buildingGrid = G.map.map(row => row.map(() => null));
    G.camera = {x: 0, y: 1280, zoom: 2.8}; G.gameTick = 1700;
    const atlases = new Map(), sources = new Map(), calls = [], registrations = [], conditions = [], order = [];
    let current, suppress = false, recordOrder = false;
    proto.drawImage = function(image, ...args) {
      const emission = image.dataset?.realmBuildingLight;
      const src = image.src || '';
      const source = src.includes('buildings-atlas-painted') ? 'buildings' : src.includes('support-atlas') ? 'support' : null;
      if (source) sources.set(source, image);
      if (emission && emission !== 'ground') atlases.set(emission, image);
      if (suppress && emission) return;
      if (this.canvas.id === 'game') {
        if (current && emission) calls.push({...current, kind: emission, alpha: this.globalAlpha, rect: args.slice(0,4), destination: args.slice(4), transform: [...this.getTransform().toFloat64Array()]});
        if (current?.type && (source || image.dataset?.realmBuildingWeather)) registrations.push({...current, rect: args.slice(0,4), destination: args.slice(4), transform: [...this.getTransform().toFloat64Array()]});
        if (recordOrder) {
          if (emission) order.push(emission === 'ground' ? 'ground-light' : 'facade-light');
          else if (src.includes('actors-atlas') || src.includes('/citizens/builder/')) order.push('citizen');
          else if (src.includes('/founder/')) order.push('founder');
          else if (source || image.dataset?.realmBuildingWeather || image.dataset?.realmBuildingComposite) order.push('building');
        }
      }
      return draw.call(this, image, ...args);
    };
    const make = (type, level = 1) => ({type, level, x:40, y:40, buildProgress:1, hp:100, maxHp:100, productionTimer:0, lastProduced:0});
    const install = b => {G.buildings = [b]; G.buildingGrid[40][40] = b;};
    const frame = (phase = .87) => {G.dayPhase = G.dayLength * phase; render();};
    const pixelData = canvas => canvas.getContext('2d', {willReadFrequently: true}).getImageData(0,0,canvas.width,canvas.height).data;
    const fromImage = image => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      canvas.getContext('2d').drawImage(image,0,0); return pixelData(canvas);
    };
    const aliases = {wonder:'castle',sawmill:'lumber'};
    // Saved Blender houses have separate emission/spill assets and are gated
    // in verify-house-game. Keep the painted-source registration test here.
    const types = Object.keys(BUILDINGS).filter(type => type !== 'house' && lighting.BUILDING_LIGHTS[aliases[type] || type]);
    try {
      for (const type of types) for (const level of type === 'house' ? [1,2,3,4] : [1]) {
        install(make(type, level));
        for (const season of ['spring','winter']) for (const zoom of [1.3,2.8,1.3]) {
          G.season = season; G.camera.zoom = zoom; current = {type,level,season,zoom}; frame();
        }
      }
      install(make('tavern')); G.camera.zoom = 2.8; G.season = 'winter';
      const attempt = (name, phase, progress = 1, visible = true) => {
        const start = calls.length; G.buildings[0].buildProgress = progress; G.fog[40][40] = visible;
        current = {name}; frame(phase);
        conditions.push({name, calls: calls.slice(start).map(c => ({kind:c.kind,alpha:c.alpha}))});
      };
      attempt('day',.5); attempt('foundation',.87,.1); attempt('almost-complete',.87,.999);
      attempt('hidden',.87,1,false); attempt('complete',.87);
      attempt('dusk-before-boundary',.74999); attempt('dusk-after-boundary',.75001);
      attempt('midnight-before-wrap',.99999); attempt('midnight-after-wrap',0);
      attempt('paused-a',.87); attempt('paused-b',.87);
      G.gameTick += 47; attempt('later',.87);
      G.buildings[0].x = 41; attempt('neighbor',.87); G.buildings[0].x = 40;
      current = null;

      // Real production pixels, with only the light-layer draw suppressed for
      // the control. Keep terrain, season, tick, body and all other effects.
      frame(); const lit = pixelData(document.getElementById('game'));
      suppress = true; frame(); const unlit = pixelData(document.getElementById('game')); suppress = false;
      let changedPixels = 0, totalChange = 0;
      for (let i=0;i<lit.length;i+=4) {
        const change = Math.abs(lit[i]-unlit[i])+Math.abs(lit[i+1]-unlit[i+1])+Math.abs(lit[i+2]-unlit[i+2]);
        if (change > 3) changedPixels++; totalChange += change;
      }

      const atlas = {};
      for (const [kind,image] of atlases) {
        const pixels = fromImage(image), source = fromImage(sources.get(kind));
        let outside = 0, alphaExceedsSource = 0, visible = 0;
        for(let i=3;i<pixels.length;i+=4) {
          if (pixels[i] && !source[i]) outside++;
          if (pixels[i] > source[i]) alphaExceedsSource++;
          if (pixels[i] > 16) visible++;
        }
        atlas[kind] = {outside,alphaExceedsSource,visible};
      }
      const landmarks = [
        ['house gable','buildings',158,181,true], ['house chimney','buildings',207,152,false],
        ['tavern room','buildings',330,217,true], ['tavern ridge','buildings',320,161,false],
        ['church glass','buildings',329,86,true], ['church roof','buildings',318,57,false],
        ['school room','support',329,207,true], ['school roof','support',328,171,false],
        ['forge hearth','buildings',429,215,true], ['forge chimney','buildings',468,172,false],
        ['baker oven','buildings',166,337,true], ['baker roof','buildings',192,293,false],
        ['fisher window','support',74,186,true], ['fisher roof','support',54,161,false],
      ].map(([name,kind,x,y,lit]) => ({name,lit,alpha:fromImage(atlases.get(kind))[(y*512+x)*4+3]}));

      G.citizens = [originalCitizen]; G.avatar = originalAvatar;
      const depths = [];
      for (const offset of [-.6,.6]) {
        for (const actor of [originalCitizen, originalAvatar]) {
          Object.assign(actor,{x:40+offset,y:40+offset,_px:40+offset,_py:40+offset,tx:40+offset,ty:40+offset,path:null,pathIdx:0});
        }
        order.length = 0; recordOrder = true; G.gameTick++; frame(); recordOrder = false;
        depths.push({offset,order:[...order]});
      }
      G.citizens = []; G.avatar = null;
      frame(); let warmReadbacks = 0;
      const read = proto.getImageData; proto.getImageData = function(...args) {warmReadbacks++; return read.apply(this,args);};
      try {for(let n=0;n<30;n++) frame();} finally {proto.getImageData=read;}
      // Retain an enlarged real render as a review artifact.
      G.dayPhase = G.dayLength * .87;
      const detail = renderBuildingIsolated('tavern',{width:140,height:170,season:'winter',dayPhase:G.dayPhase,daylight:.7,bgColor:'#303936'});
      return {atlas,landmarks,calls,registrations,conditions,depths,warmReadbacks,changedPixels,totalChange,
        diagnostics:lighting.buildingLightingDiagnostics(),detail:detail.toDataURL('image/png')};
    } finally {proto.drawImage=draw;}
  });
  await writeFile(new URL('tavern.png',output),Buffer.from(result.detail.split(',')[1],'base64')); delete result.detail;
  await writeFile(new URL('report.json',output),JSON.stringify({browser:browser.version(),errors,...result},null,2)+'\n');
  assert.deepEqual(errors,[]);
  for (const [kind,a] of Object.entries(result.atlas)) {assert.equal(a.outside,0,`${kind} light escapes painted source`);assert.equal(a.alphaExceedsSource,0);assert.ok(a.visible>50);}
  for (const p of result.landmarks) assert.ok(p.lit?p.alpha>20:p.alpha===0,`${p.name}: ${p.alpha}`);
  for (const b of result.registrations) {
    const emission=result.calls.find(c=>c.type===b.type&&c.level===b.level&&c.season===b.season&&c.zoom===b.zoom&&c.kind!=='ground');
    assert.ok(emission,`${b.type}/${b.level} missing light`);
    assert.deepEqual(emission.rect,b.rect);assert.deepEqual(emission.destination,b.destination);assert.deepEqual(emission.transform,b.transform);
  }
  const condition = name => result.conditions.find(c=>c.name===name).calls;
  for (const name of ['day','foundation','almost-complete','hidden']) assert.deepEqual(condition(name),[],`${name} must not emit light`);
  const alpha=name=>condition(name).find(c=>c.kind!=='ground').alpha;
  assert.ok(alpha('complete')>.8);
  assert.ok(Math.abs(alpha('dusk-before-boundary')-alpha('dusk-after-boundary'))<.001);
  assert.ok(Math.abs(alpha('midnight-before-wrap')-alpha('midnight-after-wrap'))<.000001);
  assert.equal(alpha('paused-a'),alpha('paused-b'));
  assert.ok(Math.abs(alpha('later')-alpha('paused-b'))>.001);assert.ok(Math.abs(alpha('neighbor')-alpha('later'))>.001);
  assert.ok(result.changedPixels>100,'light must change actual game pixels');
  for (const {offset,order} of result.depths) for (const actor of ['citizen','founder']) {
    assert.ok(order.indexOf(actor)>=0,`${actor} must be drawn`);
    assert.ok(order.lastIndexOf('ground-light')<order.indexOf(actor),'ground light must remain below actors');
    assert.ok(offset<0?order.indexOf(actor)<order.indexOf('facade-light'):order.indexOf(actor)>order.indexOf('facade-light'),`${actor}/${offset} facade light violates depth`);
  }
  assert.equal(result.warmReadbacks,0);assert.equal(result.diagnostics.bakes,2);assert.equal(result.diagnostics.sourceReadbacks,2);
  assert.equal(result.diagnostics.retainedBytes,2*512*512*4+64*64*4);
  console.log(`[building lighting] PASS: ${result.registrations.length} production registrations, protected source landmarks, construction/fog gating, continuous twilight, paused flames, actor depth and two cached atlases`);
} finally {await browser.close();await server.stop();}
