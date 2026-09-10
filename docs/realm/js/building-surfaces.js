// SHELL: source-aligned building surfaces. The painted support atlas is an
// irregular sheet; its artwork does not obey a 128px grid. These rectangles
// include the complete connected asset and a two-pixel transparent margin.
export const SUPPORT_ART_REGIONS = Object.freeze(Object.fromEntries(Object.entries({
  farm: [6, 39, 123, 81], lumber: [137, 25, 116, 96],
  quarry: [263, 26, 113, 95], mine: [387, 25, 118, 94],
  fisherman: [7, 139, 116, 98], tradingpost: [135, 136, 114, 104],
  school: [264, 132, 109, 105], archery: [385, 142, 121, 95],
  wall: [13, 265, 96, 76], road: [127, 266, 122, 72],
  chickencoop: [261, 248, 115, 99], cowpen: [382, 255, 123, 91],
  palisade: [5, 366, 115, 108], campfire: [131, 371, 119, 100],
  orchard: [258, 376, 118, 100], hay: [382, 374, 122, 98],
}).map(([type, [x, y, w, h]]) => [type, Object.freeze({x, y, w, h})])));

// One town-hall edge pixel crosses the nominal column boundary. Keep it with
// its owner and remove it from the barracks crop immediately to its left.
export const MAIN_ART_OVERRIDES = Object.freeze({
  barracks: Object.freeze({x: 256, y: 265, w: 120, h: 109}),
  townhall: Object.freeze({x: 381, y: 256, w: 115, h: 121}),
});

// Roof planes are traced in source pixels, relative to their original sheet
// positions. They are independent of camera zoom, house tier and ground anchor.
// Slate pigment rejects timber, warm windows and stone chimneys inside a plane;
// explicit cutouts protect dormers on thatch and tile roofs.
const plane = (points, kind = 'slate', coat = .94, shade = 1) => ({points, kind, coat, shade});
const MAIN_SURFACES = {
  granary: {planes: [plane([[46,33],[81,15],[103,46],[63,63]], 'thatch'), plane([[28,48],[43,32],[49,34],[31,51]], 'thatch', .68, .87)]},
  castle: {planes: [
    plane([[33,20],[28,30],[36,32]], 'slate', .85), plane([[84,36],[78,49],[92,50]], 'slate', .85),
    plane([[30,29],[41,30],[63,27],[66,33],[48,39],[29,34]], 'stone', .73),
    plane([[17,49],[24,45],[32,46],[30,52],[18,56]], 'stone', .65),
    plane([[40,64],[59,61],[70,65],[70,70],[49,72]], 'stone', .70),
    plane([[75,47],[92,47],[96,50],[86,55],[74,52]], 'stone', .65),
  ]},
  church: {planes: [plane([[29,20],[16,41],[30,46]], 'slate', .88), plane([[29,20],[30,46],[44,40]], 'slate', .78, .86),
    plane([[44,53],[77,42],[94,63],[57,80],[43,65]])]},
  windmill: {planes: [plane([[54,23],[41,41],[35,51],[51,57],[75,49]], 'slate', .82)]},
  tower: {planes: [plane([[61,5],[35,26],[63,32]]), plane([[61,5],[63,32],[88,24]], 'slate', .91, .85)]},
  house: {planes: [plane([[28,35],[74,25],[102,62],[49,79]], 'thatch'), plane([[10,62],[27,36],[30,41],[13,63]], 'thatch', .70, .85)],
    holes: [[[68,16],[87,16],[87,40],[78,44],[69,34]], [[62,54],[72,50],[79,59],[73,65],[62,65]]]},
  tavern: {planes: [plane([[35,17],[84,29],[65,70],[17,61]]), plane([[83,29],[104,54],[94,58]], 'slate', .80, .85),
    plane([[17,71],[53,78],[45,88],[16,79]], 'slate', .85)]},
  blacksmith: {planes: [plane([[33,29],[80,36],[81,75],[60,80],[14,62]]), plane([[81,36],[99,62],[88,65]], 'slate', .86, .84)]},
  market: {planes: [plane([[35,31],[78,42],[66,63],[42,65],[17,52]], 'canvas', .74)]},
  bakery: {planes: [plane([[31,32],[76,18],[99,48],[51,65]], 'tile'),
    plane([[74,57],[100,54],[109,64],[69,79],[61,70]], 'canvas', .68)],
    holes: [[[17,22],[33,21],[34,38],[25,49],[18,48]]]},
  barracks: {planes: [plane([[44,22],[82,15],[108,41],[62,52]]), plane([[28,44],[53,52],[47,60],[15,51]])]},
  townhall: {planes: [plane([[49,12],[38,24],[51,28]]), plane([[49,12],[51,28],[62,23]], 'slate', .90, .84),
    plane([[22,40],[52,47],[76,49],[72,68],[38,63],[11,56]])]},
  well: {planes: [plane([[43,12],[83,22],[64,51],[25,40]]), plane([[82,22],[97,40],[87,40]], 'slate', .83, .86)]},
};
const SUPPORT_SURFACES = {
  farm: {groundY: 54, planes: [plane([[21,70],[63,53],[103,78],[58,103]], 'plants', .57, .94)]},
  lumber: {planes: [plane([[51,40],[92,29],[106,51],[72,62]], 'slate'), plane([[43,47],[66,64],[55,75],[30,59]], 'slate', .84)]},
  quarry: {groundY: 83, planes: [
    plane([[49,29],[61,30],[56,37],[48,34]], 'stone', .85), plane([[61,36],[66,31],[75,34],[72,39]], 'stone', .85),
    plane([[70,41],[73,36],[83,38],[82,44]], 'stone', .82), plane([[79,46],[84,41],[93,44],[92,49]], 'stone', .80),
    plane([[88,52],[92,47],[100,51],[98,56]], 'stone', .82), plane([[48,57],[58,53],[64,57],[54,62]], 'stone', .70),
    plane([[79,63],[88,60],[98,63],[90,68]], 'stone', .74), plane([[18,70],[23,68],[31,75],[23,78]], 'stone', .70),
  ]},
  mine: {groundY: 86, planes: [plane([[43,44],[51,36],[62,40],[68,33],[74,29],[83,32],[82,41],[72,47],[55,47]], 'stone', .70),
    plane([[81,49],[90,44],[94,48],[86,54]], 'stone', .70), plane([[88,64],[96,62],[101,66],[94,70]], 'stone', .62)]},
  fisherman: {planes: [plane([[49,16],[84,28],[64,52],[35,40]])], groundY: 200},
  tradingpost: {planes: [plane([[35,14],[41,22],[58,28],[79,27],[64,44],[51,49],[15,37]], 'canvas', .79)], groundY: 200},
  school: {planes: [plane([[60,17],[50,29],[61,33]]), plane([[60,17],[61,33],[69,29]], 'slate', .88, .84),
    plane([[46,46],[85,29],[100,53],[61,70]])]},
  archery: {planes: [plane([[44,22],[56,28],[81,36],[75,44],[52,53],[21,40]], 'canvas', .71)], groundY: 77},
  wall: {planes: [plane([[27,15],[34,12],[93,39],[85,45]], 'stone', .84)], groundY: 44},
  chickencoop: {planes: [plane([[36,12],[65,-5],[85,20],[50,36]], 'thatch')], groundY: 52},
  cowpen: {planes: [plane([[64,8],[85,15],[106,22],[101,31],[67,22],[58,17]], 'thatch', .91)], groundY: 40,
    holes: [[[36,29],[47,24],[59,33],[65,47],[60,57],[52,55],[44,51],[37,45]]]},
};
const MAIN_TYPES = ['granary','castle','church','windmill','tower','house','tavern','blacksmith','market','bakery','barracks','townhall','well'];
const SUPPORT_TYPES = Object.keys(SUPPORT_ART_REGIONS);
const KIND = {thatch: 0, tile: 0, canvas: 0, slate: 1, plants: 2, stone: 3};
const winterAtlases = new WeakMap();
let bakes = 0, sourceReadbacks = 0, retainedBytes = 0;
const clamp = value => Math.max(0, Math.min(1, value));
function grain(x, y) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function winterBuildingAtlas(source, support = false) {
  if (winterAtlases.has(source)) return winterAtlases.get(source);
  const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
  if (width !== 512 || height !== 512) throw new Error('Building surface masks require the reviewed 512px painted atlases');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.dataset.realmBuildingWeather = support ? 'support' : 'buildings';
  const ctx = canvas.getContext('2d', {willReadFrequently: true}); ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height); sourceReadbacks++;
  const mask = document.createElement('canvas'); mask.width = width; mask.height = height;
  const mctx = mask.getContext('2d', {willReadFrequently: true});
  const types = support ? SUPPORT_TYPES : MAIN_TYPES, profiles = support ? SUPPORT_SURFACES : MAIN_SURFACES;
  for (let index = 0; index < types.length; index++) {
    const type = types[index], profile = profiles[type]; if (!profile) continue;
    const ox = index % 4 * 128, oy = Math.floor(index / 4) * 128;
    const region = support ? SUPPORT_ART_REGIONS[type] : MAIN_ART_OVERRIDES[type] || {x: ox, y: oy, w: 128, h: 128};
    const groundY = profile.groundY ?? (support ? 82 : 94);
    mctx.save();
    // Frost follows colored plants within the source silhouette, not a tile
    // diamond painted over the field, fences and nearby actors.
    mctx.fillStyle = 'rgb(125,242,170)';
    const top = Math.max(region.y, oy + groundY), bottom = region.y + region.h;
    if (bottom > top) mctx.fillRect(region.x, top, region.w, bottom - top);
    mctx.translate(ox, oy);
    for (const surface of profile.planes || []) {
      mctx.fillStyle = `rgb(${Math.round(surface.coat * 255)},${Math.round(surface.shade * 255)},${KIND[surface.kind] * 85})`;
      mctx.beginPath(); surface.points.forEach(([x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y));
      mctx.closePath(); mctx.fill();
    }
    mctx.globalCompositeOperation = 'destination-out';
    for (const points of profile.holes || []) {
      mctx.beginPath(); points.forEach(([x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y));
      mctx.closePath(); mctx.fill();
    }
    mctx.restore();
  }
  const coverage = mctx.getImageData(0, 0, width, height).data, data = pixels.data;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!data[i + 3] || !coverage[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2], luminance = r * .2126 + g * .7152 + b * .0722;
    const kind = Math.round(coverage[i + 2] / 85), shade = coverage[i + 1] / 255;
    let amount = coverage[i] / 255 * coverage[i + 3] / 255;
    if (kind === 1) amount *= clamp((b - r + 8) / 24);
    if (kind === 2) amount *= clamp((g - r * .8) / 24) * clamp((g - b * 1.35) / 40);
    amount *= (.38 + .62 * clamp((luminance - 22) / 120)) * (.85 + grain(x >> 2, y >> 2) * .15);
    const white = (168 + luminance * .32 + (grain(x, y) - .5) * 7) * shade;
    data[i] = Math.round(r + (white * .95 - r) * amount);
    data[i + 1] = Math.round(g + (white * .99 - g) * amount);
    data[i + 2] = Math.round(b + (white * 1.03 - b) * amount);
    // Alpha and all pixels outside reviewed surfaces remain byte-identical.
  }
  ctx.putImageData(pixels, 0, 0);
  winterAtlases.set(source, canvas); bakes++; retainedBytes += width * height * 4;
  return canvas;
}

export function buildingSurfaceDiagnostics() {
  return {bakes, sourceReadbacks, retainedBytes, supportRegions: SUPPORT_TYPES.length, winterProfiles: MAIN_TYPES.length + Object.keys(SUPPORT_SURFACES).length};
}
