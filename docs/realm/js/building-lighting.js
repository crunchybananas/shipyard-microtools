// SHELL: light belongs to painted apertures, using the same source rectangle
// and transform as the building. No simulated state or image asset is changed.
const pane = (points, kind = 'warm', gain = 1) => ({points, kind, gain});
const box = (x, y, w, h, kind, gain) => pane([[x,y],[x+w,y],[x+w,y+h],[x,y+h]], kind, gain);
export const BUILDING_LIGHTS = Object.freeze({
  house: {origin: [128,128], panes: [
    box(27,47,6,14), pane([[65,57],[70,54],[74,57],[74,62],[65,63]], 'warm', .8),
    pane([[60,85],[65,83],[65,92],[60,94]]), pane([[82,77],[88,75],[88,83],[82,86]]),
  ], pools: [[64,119,34,13],[102,104,28,12]]},
  tavern: {origin: [256,128], panes: [
    pane([[39,44],[45,43],[45,53],[39,52]]), pane([[80,49],[84,47],[84,54],[80,56]]),
    pane([[70,85],[74,82],[78,84],[78,93],[70,95]]), pane([[83,81],[88,78],[88,86],[83,89]]),
  ], pools: [[78,120,32,12],[108,101,30,10]]},
  church: {origin: [256,0], panes: [
    pane([[20,69],[23,67],[26,70],[26,76],[20,77]], 'glass', .8),
    pane([[58,91],[61,87],[64,91],[64,96],[58,99]], 'glass'),
    pane([[69,86],[73,81],[76,84],[76,91],[69,94]], 'glass'),
    pane([[83,81],[86,76],[89,80],[89,86],[83,89]], 'glass'),
  ], pools: [[68,121,30,11],[105,105,28,10]]},
  school: {origin: [256,128], panes: [
    box(43,59,3,6), pane([[70,78],[73,74],[76,76],[76,82],[70,85]]),
    pane([[87,68],[90,64],[92,67],[92,73],[87,76]]),
  ], pools: [[75,108,28,10],[108,91,26,10]]},
  townhall: {origin: [384,256], panes: [
    pane([[33,58],[36,54],[39,58],[39,66],[33,68]]),
    pane([[83,82],[86,78],[89,81],[89,90],[83,93]]),
    box(44,32,3,8,'warm',.55), box(55,33,2,7,'warm',.55),
  ], pools: [[109,105,32,12]]},
  castle: {origin: [128,0], panes: [
    box(35,18,2,5,'warm',.65), box(14,68,2,5,'warm',.65),
    pane([[78,72],[80,70],[80,77],[78,78]],'warm',.65),
    pane([[84,78],[86,76],[86,82],[84,84]],'warm',.65),
  ], pools: []},
  blacksmith: {origin: [384,128], panes: [
    pane([[37,82],[50,80],[52,91],[37,92]],'fire'),
  ], pools: [[45,119,38,14]], fire: true},
  bakery: {origin: [128,256], panes: [
    pane([[32,77],[37,73],[42,77],[44,84],[34,86]],'fire'),
  ], pools: [[31,114,32,12]], fire: true},
  barracks: {origin: [256,256], panes: [
    box(42,36,4,6,'warm',.65), pane([[54,71],[59,69],[59,81],[54,84]],'warm',.6),
  ], pools: [[52,117,30,11]]},
  lumber: {origin: [128,0], panes: [
    pane([[40,72],[45,73],[45,79],[40,77]],'warm',.8),
  ], pools: [[34,119,28,10]]},
  fisherman: {origin: [0,128], panes: [
    pane([[71,55],[77,53],[77,60],[71,63]]),
  ], pools: [[103,83,28,10]]},
  windmill: {origin: [384,0], panes: [
    pane([[71,103],[74,100],[77,102],[77,108],[71,110]],'warm',.7),
  ], pools: [[89,121,28,10]]},
  tradingpost: {origin: [128,128], panes: [box(94,48,3,4)], pools: [[116,90,32,12]]},
});

const clamp = n => Math.max(0, Math.min(1, n));
function smooth(a, b, value) {const n = clamp((value - a) / (b - a)); return n * n * (3 - 2 * n);}
export function buildingNightStrength(dayPhase, dayLength) {
  const t = ((dayPhase / dayLength) % 1 + 1) % 1;
  return t < .5 ? 1 - smooth(0, .1, t) : smooth(.6, .8, t);
}
export function buildingLightIntensity(building, dayPhase, dayLength, tick) {
  if (building.buildProgress < 1) return 0;
  const night = buildingNightStrength(dayPhase, dayLength);
  if (!night) return 0;
  const phase = building.x * 2.713 + building.y * 1.931;
  // A small, slow flame variation is tied to the simulation clock: pause is
  // exactly still, and neighboring rooms do not pulse in unison.
  return night * (.92 + Math.sin(tick * .025 + phase) * .035 + Math.sin(tick * .011 + phase * 1.7) * .025);
}

const atlases = new WeakMap();
let bakes = 0, sourceReadbacks = 0, pool = null;
export function buildingEmissionAtlas(source, support = false) {
  if (atlases.has(source)) return atlases.get(source);
  const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
  if (width !== 512 || height !== 512) throw new Error('Building lights require the reviewed 512px painted source');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.dataset.realmBuildingLight = support ? 'support' : 'buildings';
  const ctx = canvas.getContext('2d', {willReadFrequently: true}); ctx.drawImage(source, 0, 0);
  const sourcePixels = ctx.getImageData(0, 0, width, height).data; sourceReadbacks++;
  ctx.clearRect(0, 0, width, height);
  const entries = Object.entries(BUILDING_LIGHTS).filter(([type]) => ['school','lumber','fisherman','tradingpost'].includes(type) === support);
  const mask = document.createElement('canvas'); mask.width = width; mask.height = height;
  const mctx = mask.getContext('2d', {willReadFrequently: true});
  const centers = [];
  for (const [type, {origin: [ox, oy], panes}] of entries) {
    for (const aperture of panes) {
      const {points, kind, gain} = aperture;
      mctx.fillStyle = `rgb(${Math.round(gain * 255)},${kind === 'glass' ? 127 : kind === 'fire' ? 255 : 0},0)`;
      mctx.beginPath(); points.forEach(([x,y], i) => i ? mctx.lineTo(ox+x,oy+y) : mctx.moveTo(ox+x,oy+y));
      mctx.closePath(); mctx.fill();
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      centers.push({type, x: ox + (Math.min(...xs) + Math.max(...xs)) / 2,
        y: oy + (Math.min(...ys) + Math.max(...ys)) / 2,
        rx: (Math.max(...xs)-Math.min(...xs)) * .6 + 4,
        ry: (Math.max(...ys)-Math.min(...ys)) * .5 + 3, gain});
    }
  }
  const coverage = mctx.getImageData(0, 0, width, height).data;
  const result = ctx.createImageData(width, height), data = result.data;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, a = sourcePixels[i + 3]; if (!a) continue;
    const r = sourcePixels[i], g = sourcePixels[i+1], b = sourcePixels[i+2];
    const luma = r * .2126 + g * .7152 + b * .0722;
    let bounce = 0;
    for (const c of centers) {
      const dx = (x-c.x)/c.rx, dy = (y-c.y)/c.ry, distance = dx*dx+dy*dy;
      if (distance < 5) bounce = Math.max(bounce, Math.exp(-distance * 1.2) * .13 * c.gain);
    }
    const aperture = coverage[i + 3] / 255 * coverage[i] / 255;
    const strength = aperture * (.2 + .8 * clamp((luma - 8) / 125));
    const kind = coverage[i + 1];
    let red = 249, green = 178, blue = 89;
    if (aperture && kind > 190) {green = 142; blue = 48;}
    else if (aperture && kind > 60) {
      const peak = Math.max(r,g,b,1); red = 245*r/peak; green = 245*g/peak; blue = 245*b/peak;
    }
    data[i] = Math.round(red); data[i+1] = Math.round(green); data[i+2] = Math.round(blue);
    data[i+3] = Math.round(a * Math.max(strength * .94, bounce));
  }
  ctx.putImageData(result, 0, 0); atlases.set(source, canvas); bakes++;
  return canvas;
}

export function buildingGroundLight() {
  if (pool) return pool;
  pool = document.createElement('canvas'); pool.width = pool.height = 64;
  pool.dataset.realmBuildingLight = 'ground';
  const ctx = pool.getContext('2d'), glow = ctx.createRadialGradient(32,32,0,32,32,32);
  glow.addColorStop(0,'rgba(245,175,77,.34)'); glow.addColorStop(.4,'rgba(215,139,52,.15)'); glow.addColorStop(1,'rgba(193,119,43,0)');
  ctx.fillStyle = glow; ctx.fillRect(0,0,64,64);
  return pool;
}
export function buildingLightingDiagnostics() {
  return {bakes, sourceReadbacks, retainedBytes: bakes * 512 * 512 * 4 + (pool ? 64 * 64 * 4 : 0), profiles: Object.keys(BUILDING_LIGHTS).length};
}
