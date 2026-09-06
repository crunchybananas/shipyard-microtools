// The Blender crowns and runtime trunk placement share these proportions.
// forest-layout:start
const profiles = [
  {"name":"broad fir","weight":0.30,"scale":1,"p":{"n":8,"baseY":1.02,"baseR":1.88,"taperK":0.86,"tierH":1.18,"spacing":0.52,"lean":0.09,"droop":0.42,"fullness":1.18,"seedXor":31292}},
  {"name":"slim spruce","weight":0.28,"scale":1,"p":{"n":9,"baseY":1.22,"baseR":1.38,"taperK":0.91,"tierH":1.10,"spacing":0.54,"lean":0.065,"droop":0.35,"fullness":1,"seedXor":15217}},
  {"name":"sapling","weight":0.24,"scale":0.64,"p":{"n":7,"baseY":0.54,"baseR":1.08,"taperK":0.70,"tierH":0.84,"spacing":0.36,"lean":0.04,"droop":0.24,"fullness":1.08,"seedXor":8649}},
  {"name":"storm elder","weight":0.18,"scale":1.12,"p":{"n":7,"baseY":1.34,"baseR":1.84,"taperK":0.90,"tierH":1.34,"spacing":0.72,"lean":0.19,"droop":0.58,"fullness":0.82,"broken":0.18,"seedXor":28420}}
];
// forest-layout:end
export const FOREST_PROFILES = Object.freeze(profiles.map(p => Object.freeze({...p, p:Object.freeze(p.p)})));
