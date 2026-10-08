// Presentation only. The forest GLB shares one clay material across leaves and
// trunks; target its four verified foliage vertex colors, never the material.
const FOLIAGE_TONES = Object.freeze([
  [0.019382360956935, 0.18116424424986, 0.147027266497595], // #26766b
  [0.059511238162981, 0.270497791013066, 0.144128470858058], // #458e6a
  [0.012286488356915, 0.119538427988346, 0.090841711174799], // #1d6155
  [0.187820772300678, 0.296138270798321, 0.076185381481308], // #78944e
]);
export function foliageTone(r, g, b) {
  return FOLIAGE_TONES.findIndex(color => Math.abs(color[0] - r) < .0001 && Math.abs(color[1] - g) < .0001 && Math.abs(color[2] - b) < .0001);
}
const palette = value => Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Array.isArray(item) ? Object.freeze(item) : item])));
export const SEASON_PALETTES = Object.freeze({
  spring: palette({ grass: '#9cad70', shade: '#789765', foliage: ['#5c9164', '#80a761', '#386c58', '#a3b963'], evergreen: ['#387e68', '#559675', '#2a6758', '#87a469'], flowers: ['#edd4c4', '#e8db9c', '#d7baca', '#91ad6d'], flowerDensity: 1, skyLight: '#e1ecd7', groundLight: '#7c8564', sun: [1, .94, .85] }),
  summer: palette({ grass: '#809b60', shade: '#557c53', foliage: ['#38774f', '#568b51', '#255d4b', '#809849'], evergreen: ['#2d705b', '#428766', '#23594e', '#739359'], flowers: ['#ecd195', '#d4be84', '#d7967f', '#74965e'], flowerDensity: .8, skyLight: '#dcebd9', groundLight: '#737e5b', sun: [1, .92, .81] }),
  autumn: palette({ grass: '#aa9b6c', shade: '#857c54', foliage: ['#b86c4f', '#c99956', '#875447', '#dfb563'], evergreen: ['#397566', '#518174', '#2b5b57', '#779371'], flowers: ['#c18b65', '#d7b67c', '#ad7761', '#929468'], flowerDensity: .5, skyLight: '#eee2cd', groundLight: '#85775c', sun: [1, .90, .78] }),
  winter: palette({ grass: '#a3b4aa', shade: '#7d968d', foliage: ['#99b0a6', '#bdcdc0', '#6d8c83', '#c3c9ad'], evergreen: ['#648b80', '#91aea0', '#476e65', '#aabcab'], flowers: ['#bdc7b9', '#aab6a5', '#a3b4ad', '#8d9f96'], flowerDensity: .25, skyLight: '#d9e8eb', groundLight: '#7e9390', sun: [.88, .95, 1] }),
});
export const seasonPalette = id => SEASON_PALETTES[id] || SEASON_PALETTES.spring;
