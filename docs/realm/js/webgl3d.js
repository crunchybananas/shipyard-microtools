// ════════════════════════════════════════════════════════════
// WebGL 3D Terrain Renderer — isometric settlement-builder
// Parallel 3D renderer using the same tile grid as real 3D
// geometry with directional lighting.
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H, TW, TH } from './state.js';
import { loadGLBGeometry } from './glb-loader.js';

// ── GLB tree geometry (loaded async, used in buildTerrainMesh) ─
let glbTreeVariants = null; // array of {positions, normals, indices} once loaded

// ── GLB building geometry (loaded async, keyed by building type) ─
const glbBuildings = {}; // { house, tower, church, farm, … } → {positions,normals,indices}
const BUILDING_GLB_MAP = {
  house:      './assets/meshes/buildings/building_house.glb',
  farm:       './assets/meshes/buildings/building_farm.glb',
  tower:      './assets/meshes/buildings/building_tower.glb',
  church:     './assets/meshes/buildings/building_church.glb',
  barracks:   './assets/meshes/buildings/building_barracks.glb',
  market:     './assets/meshes/buildings/building_market.glb',
  castle:     './assets/meshes/buildings/building_castle.glb',
  tavern:     './assets/meshes/buildings/building_tavern.glb',
  blacksmith: './assets/meshes/buildings/building_blacksmith.glb',
  windmill:   './assets/meshes/buildings/building_windmill.glb',
};

// ── Module-level GL state ──────────────────────────────────
let gl = null;
let program = null;
let vao = null;          // WebGL2 VAO (or null for WebGL1)
let vertexBuf = null;
let indexBuf = null;
let indexCount = 0;
let terrainIndexCount = 0;
let treeIndexCount = 0;
let isWebGL2 = false;

// Buildings mesh state
let buildingsVao = null;
let buildingsVertexBuf = null;
let buildingsIndexBuf = null;
let buildingsIndexCount = 0;
let lastBuildingRebuild = 0;

// Citizens mesh state (rebuilt every frame for smooth movement)
let citizensVao = null;
let citizensVertexBuf = null;
let citizensIndexBuf = null;
let citizensIndexCount = 0;

// Uniform locations
let uViewProjLoc = null;
let uLightDirLoc = null;
let uTimeLoc = null;
let uSeasonTintLoc = null;
let uCameraCenterLoc = null;
let uSnowAmountLoc = null;
let uAutumnAmountLoc = null;
let uDayPhaseLoc = null;
let uRainAmountLoc = null;

// Extension for VAO in WebGL1
let oeVao = null;

// ── Tile heights ───────────────────────────────────────────
const TILE_HEIGHT = {
  [TILE.WATER]:    0.0,
  [TILE.SAND]:     0.4,
  [TILE.GRASS]:    0.8,
  [TILE.FOREST]:   0.8,
  [TILE.STONE]:    1.3,
  [TILE.IRON]:     1.3,
  [TILE.MOUNTAIN]: 3.5,
};

// ── Tile colors (RGB 0–1 matching existing palette) ────────
const TILE_COLOR_3D = {
  [TILE.WATER]:    [0.38, 0.65, 0.87],
  [TILE.SAND]:     [0.91, 0.78, 0.49],
  [TILE.GRASS]:    [0.40, 0.78, 0.42],
  [TILE.FOREST]:   [0.18, 0.48, 0.21],
  [TILE.STONE]:    [0.60, 0.58, 0.56],
  [TILE.IRON]:     [0.35, 0.52, 0.72],
  [TILE.MOUNTAIN]: [0.42, 0.42, 0.48],
};

// ── Shader sources ─────────────────────────────────────────
const VS_SRC_300 = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec3 aColor;
uniform mat4 uViewProj;
uniform float uTime;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorldPos;
void main() {
  vec3 pos = aPos;
  // Water animation: tiles where color is water blue get wave displacement
  bool isWater = aColor.b > 0.6 && aColor.r < 0.2;
  if (isWater && aPos.y < 0.01) {
    float wave = sin(aPos.x * 0.8 + uTime * 1.5) * 0.08
               + cos(aPos.z * 0.8 + uTime * 1.2) * 0.06;
    pos.y += wave;
  }
  // Grass wind sway: gentle ripple on top faces of green tiles
  bool isGrassV = aColor.g > aColor.r * 1.1 && aColor.g > aColor.b && aColor.b < 0.55;
  if (isGrassV && aNormal.y > 0.5) {
    float sway = sin(aPos.x * 1.3 + aPos.z * 0.9 + uTime * 1.1) * 0.025
               + cos(aPos.x * 0.8 + aPos.z * 1.4 + uTime * 0.8) * 0.018;
    pos.y += sway;
  }
  gl_Position = uViewProj * vec4(pos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldPos = pos;
}`;

const FS_SRC_300 = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorldPos;
out vec4 fragColor;
uniform vec3 uLightDir;
uniform vec3 uSeasonTint;
uniform float uTime;
uniform vec2 uCameraCenter;
uniform float uSnowAmount;
uniform float uAutumnAmount;
uniform float uDayPhase;
uniform float uRainAmount;
void main() {
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, dot(N, uLightDir));
  vec3 ambient = vColor * 0.25;
  vec3 diffuse = vColor * NdotL * 1.1;
  vec3 litColor = (ambient + diffuse) * uSeasonTint;
  bool isGrass = vColor.g > vColor.r * 1.1 && vColor.g > vColor.b && vColor.b < 0.55;
  // Grass micro-variation: per-tile hash breaks up uniform green carpet
  if (isGrass && N.y > 0.5) {
    vec2 tileId = floor(vWorldPos.xz);
    float h = fract(sin(dot(tileId, vec2(23.7, 57.3))) * 31241.9);
    float brightVar = 0.88 + h * 0.22;
    float hueShift = h * 0.08 - 0.04; // subtle yellow↔cool shift
    litColor *= vec3(brightVar + hueShift, brightVar, brightVar - hueShift * 0.5);
  }
  // Sand ripple: noise-based shading on warm sandy tiles (beach/desert)
  bool isSand = vColor.r > 0.80 && vColor.g > 0.68 && vColor.g < 0.85 && vColor.b < 0.60;
  if (isSand && N.y > 0.5) {
    vec2 rp = vWorldPos.xz * 2.4 + vec2(uTime * 0.06, uTime * 0.04);
    float ripple = sin(rp.x + sin(rp.y * 0.7)) * 0.5 + 0.5;
    litColor *= 0.90 + ripple * 0.18;
    float wetness = 1.0 - smoothstep(0.0, 0.85, vWorldPos.y);
    vec3 wetSandCol = vec3(0.58, 0.46, 0.26);
    litColor = mix(litColor, wetSandCol * (0.38 + NdotL * 0.75), wetness * 0.60);
  }
  // Stone mottling: mineral veins and rock surface texture variation
  bool isStone = vColor.r > 0.38 && vColor.r < 0.72 && abs(vColor.r - vColor.g) < 0.10 && abs(vColor.g - vColor.b) < 0.10;
  if (isStone) {
    float sv1 = sin(vWorldPos.x * 3.7 + vWorldPos.y * 2.1 + vWorldPos.z * 4.3);
    float sv2 = cos(vWorldPos.x * 2.9 + vWorldPos.z * 3.1 + vWorldPos.y * 1.7);
    float mottle = sv1 * sv2 * 0.5 + 0.5;
    float vein = smoothstep(0.68, 0.74, mottle) * 0.18;
    litColor = mix(litColor * (0.88 + mottle * 0.18), litColor + vec3(0.08, 0.07, 0.05) * vein, 0.8);
  }
  // Autumn: shift green foliage/grass to orange-amber
  if (isGrass && uAutumnAmount > 0.0) {
    vec3 autumnCol = vec3(0.88, 0.50, 0.06);
    litColor = mix(litColor, autumnCol * (0.40 + NdotL * 0.9), uAutumnAmount * 0.72);
  }
  // Compute night amount early — needed for water and sky sections
  float nightPhase = abs(uDayPhase - 0.5); // 0=noon, 0.5=midnight
  float nightAmt = smoothstep(0.30, 0.47, nightPhase);
  // Cloud shadows: drifting dark patches on top-facing terrain during daytime
  if (N.y > 0.5 && nightAmt < 0.8 && uRainAmount < 0.5) {
    vec2 cUV = vWorldPos.xz * 0.07 + vec2(uTime * 0.018, uTime * 0.011);
    float c1 = sin(cUV.x * 3.1 + sin(cUV.y * 2.3)) * 0.5 + 0.5;
    float c2 = sin(cUV.x * 1.7 + cUV.y * 2.9 + 1.4) * 0.5 + 0.5;
    float cloud = smoothstep(0.55, 0.75, c1 * c2);
    litColor *= 1.0 - cloud * 0.22 * (1.0 - nightAmt);
  }
  // Winter snow: height-scaled gradient + crisp alpine snowline above y=2.5
  bool isWater = vColor.b > 0.55 && vColor.r < 0.25;
  if (!isWater && uSnowAmount > 0.0) {
    float heightFactor = clamp((vWorldPos.y - 0.5) / 2.0, 0.12, 1.0);
    float snowLine = smoothstep(2.3, 2.65, vWorldPos.y); // sharp alpine line
    float snowBlend = mix(heightFactor, 1.0, snowLine);
    vec3 snowCol = vec3(0.90, 0.93, 0.98);
    litColor = mix(litColor, snowCol * (0.55 + NdotL * 0.6), uSnowAmount * snowBlend);
    // Snow specular: sun glint on snowfields and alpine peaks
    if (N.y > 0.4) {
      vec3 viewDir = normalize(vec3(0.57, 1.0, 0.57));
      vec3 halfVec = normalize(uLightDir + viewDir);
      float snowSpec = pow(max(0.0, dot(N, halfVec)), 28.0);
      litColor += vec3(0.95, 0.97, 1.0) * snowSpec * uSnowAmount * snowBlend * 0.6;
    }
  }
  // Animated water sparkle + specular — sun glint by day, moonpath by night
  if (isWater) {
    // Depth variation: shallow coastal water is turquoise, deep open water is navy
    float depthNoise = sin(vWorldPos.x * 0.22 + 1.3) * cos(vWorldPos.z * 0.19 + 0.7) * 0.5 + 0.5;
    vec3 shallowCol = vec3(0.28, 0.68, 0.75); // turquoise-teal
    vec3 deepCol    = vec3(0.08, 0.18, 0.42); // deep navy
    vec3 waterBase  = mix(deepCol, shallowCol, depthNoise * 0.65);
    litColor = mix(waterBase * (0.3 + NdotL * 0.5), litColor, 0.35);
    float s = sin(vWorldPos.x * 2.8 + uTime * 2.2) * cos(vWorldPos.z * 2.1 + uTime * 1.7);
    float sparkle = pow(max(0.0, s), 6.0) * 0.35;
    litColor += mix(vec3(sparkle * 0.7, sparkle * 0.85, sparkle),
                    vec3(sparkle * 0.55, sparkle * 0.65, sparkle), nightAmt);
    float wnx = sin(vWorldPos.x * 4.1 + uTime * 1.8) * 0.28;
    float wnz = cos(vWorldPos.z * 3.7 + uTime * 2.1) * 0.28;
    vec3 waveN = normalize(vec3(-wnx, 1.0, -wnz));
    vec3 viewDir = normalize(vec3(0.57, 1.0, 0.57));
    vec3 halfVec = normalize(uLightDir + viewDir);
    float spec = pow(max(0.0, dot(waveN, halfVec)), 12.0);
    // Day: warm sun glint. Night: bright silver moonpath (boosted intensity)
    litColor += mix(vec3(1.0, 0.97, 0.88) * spec * 0.5,
                    vec3(0.75, 0.85, 1.0) * spec * 1.2, nightAmt);
    // Whitecap foam: wave crests bleach to white-blue
    float crest = smoothstep(0.05, 0.10, vWorldPos.y);
    litColor = mix(litColor, vec3(0.91, 0.95, 1.0), crest * 0.75 * (1.0 - nightAmt * 0.5));
  }
  // Rooftop sun specular: bright spot on building tops from direct sunlight
  bool isRooftop = N.y > 0.7 && vWorldPos.y > 1.0 && !isGrass && !isWater && !isSand;
  if (isRooftop && nightAmt < 0.7) {
    vec3 roofView = normalize(vec3(0.57, 1.0, 0.57));
    vec3 roofHalf = normalize(uLightDir + roofView);
    float roofSpec = pow(max(0.0, dot(N, roofHalf)), 18.0) * (1.0 - nightAmt);
    litColor += vec3(1.0, 0.96, 0.88) * roofSpec * 0.45;
  }
  // Night window glow: warm amber patches on building walls simulate lit windows
  bool isBuildingWall = N.y < 0.3 && vWorldPos.y > 0.5 && vColor.r > 0.55 && vColor.r > vColor.b * 1.3;
  if (isBuildingWall && nightAmt > 0.1) {
    vec2 winHash = floor(vWorldPos.xz * 3.0 + vec2(vWorldPos.y * 1.7, 0.0));
    float h = fract(sin(dot(winHash, vec2(17.3, 41.7))) * 8273.5);
    float flicker = 0.85 + 0.15 * sin(uTime * (3.0 + h * 5.0) + h * 6.28);
    float windowGlow = step(0.55, h) * nightAmt * 0.55 * flicker;
    litColor += vec3(1.0, 0.72, 0.20) * windowGlow;
  }
  // Rain: overcast darkening + diagonal streaks on terrain tops
  if (uRainAmount > 0.0) {
    litColor *= mix(1.0, 0.70, uRainAmount);
    if (N.y > 0.5) {
      float streak = fract((vWorldPos.x - vWorldPos.z * 0.5) * 5.0 + uTime * 9.0);
      float drop = step(0.93, streak) * 0.4;
      litColor += vec3(0.55, 0.65, 0.80) * drop * uRainAmount;
    }
  }
  float fogDist = length(vec2(vWorldPos.x - uCameraCenter.x, vWorldPos.z - uCameraCenter.y));
  float fog = smoothstep(30.0, 46.0, fogDist);
  // Atmospheric perspective: distant tiles desaturate before fog takes over
  float atmDist = smoothstep(18.0, 30.0, fogDist);
  float lum = dot(litColor, vec3(0.299, 0.587, 0.114));
  litColor = mix(litColor, vec3(lum) * 0.9 + vec3(0.06, 0.09, 0.14) * 0.1, atmDist * 0.45);
  // Sky/fog color shifts with time of day: dawn amber → noon blue → dusk purple → night navy
  float dawn = max(0.0, 1.0 - abs(uDayPhase - 0.15) * 6.0);
  float dusk = max(0.0, 1.0 - abs(uDayPhase - 0.85) * 6.0);
  vec3 skyNoon  = vec3(0.45, 0.68, 0.88);
  vec3 skyDawn  = vec3(0.96, 0.65, 0.38);
  vec3 skyDusk  = vec3(0.70, 0.45, 0.72);
  vec3 skyNight = vec3(0.04, 0.07, 0.18);
  vec3 skyCol = mix(mix(mix(skyNoon, skyDawn, dawn), skyDusk, dusk), skyNight, nightAmt);
  // Warm sunrise/sunset tint bleeds into lit surfaces
  litColor = mix(litColor, litColor * mix(vec3(1.0), vec3(1.18, 0.90, 0.72), dawn + dusk * 0.7), 0.35);
  // God rays: diagonal light shafts sweep terrain at dawn/dusk
  float goldenHour = max(dawn, dusk * 0.8);
  if (goldenHour > 0.05 && N.y > 0.4) {
    float rayDir = dawn > dusk ? 1.0 : -1.0;
    float shaftCoord = (vWorldPos.x * 0.6 + vWorldPos.z * 0.4) * 0.18 + uTime * 0.04 * rayDir;
    float shaft = pow(max(0.0, sin(shaftCoord * 6.28318) * 0.5 + 0.5), 6.0);
    vec3 rayCol = mix(vec3(1.0, 0.80, 0.45), vec3(0.90, 0.55, 0.70), dusk);
    litColor += rayCol * shaft * goldenHour * 0.22;
  }
  // Night: dim scene to moonlit blue-silver
  vec3 moonlit = vec3(0.50, 0.60, 0.82) * 0.15;
  litColor = mix(litColor, litColor * 0.10 + moonlit, nightAmt);
  vec3 finalCol = mix(litColor, skyCol, fog * 0.8);
  // Stars: random bright points in the dark fogged sky
  if (nightAmt > 0.2 && fog > 0.55) {
    vec2 sGrid = floor(vWorldPos.xz * 1.8);
    float h = fract(sin(dot(sGrid, vec2(127.1, 311.7))) * 43758.5453);
    float twinkle = 0.5 + 0.5 * sin(uTime * (2.0 + h * 4.0) + h * 31.4);
    float star = step(0.965, h) * twinkle * nightAmt * fog;
    finalCol += vec3(0.88, 0.92, 1.0) * star * 1.4;
  }
  fragColor = vec4(finalCol, 1.0);
}`;

// WebGL1 fallback shaders
const VS_SRC_100 = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uViewProj;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vWorldPos;
void main() {
  vec3 pos = aPos;
  bool isWater = aColor.b > 0.6 && aColor.r < 0.2;
  if (isWater && aPos.y < 0.01) {
    float wave = sin(aPos.x * 0.8 + uTime * 1.5) * 0.08
               + cos(aPos.z * 0.8 + uTime * 1.2) * 0.06;
    pos.y += wave;
  }
  bool isGrassV = aColor.g > aColor.r * 1.1 && aColor.g > aColor.b && aColor.b < 0.55;
  if (isGrassV && aNormal.y > 0.5) {
    float sway = sin(aPos.x * 1.3 + aPos.z * 0.9 + uTime * 1.1) * 0.025
               + cos(aPos.x * 0.8 + aPos.z * 1.4 + uTime * 0.8) * 0.018;
    pos.y += sway;
  }
  gl_Position = uViewProj * vec4(pos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldPos = pos;
}`;

const FS_SRC_100 = `
precision highp float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vWorldPos;
uniform vec3 uLightDir;
uniform vec3 uSeasonTint;
uniform float uTime;
uniform vec2 uCameraCenter;
uniform float uSnowAmount;
uniform float uAutumnAmount;
uniform float uDayPhase;
uniform float uRainAmount;
void main() {
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, dot(N, uLightDir));
  vec3 ambient = vColor * 0.25;
  vec3 diffuse = vColor * NdotL * 1.1;
  vec3 litColor = (ambient + diffuse) * uSeasonTint;
  bool isGrass = vColor.g > vColor.r * 1.1 && vColor.g > vColor.b && vColor.b < 0.55;
  if (isGrass && N.y > 0.5) {
    vec2 tileId = floor(vWorldPos.xz);
    float h = fract(sin(dot(tileId, vec2(23.7, 57.3))) * 31241.9);
    float brightVar = 0.88 + h * 0.22;
    float hueShift = h * 0.08 - 0.04;
    litColor *= vec3(brightVar + hueShift, brightVar, brightVar - hueShift * 0.5);
  }
  bool isSand = vColor.r > 0.80 && vColor.g > 0.68 && vColor.g < 0.85 && vColor.b < 0.60;
  if (isSand && N.y > 0.5) {
    vec2 rp = vWorldPos.xz * 2.4 + vec2(uTime * 0.06, uTime * 0.04);
    float ripple = sin(rp.x + sin(rp.y * 0.7)) * 0.5 + 0.5;
    litColor *= 0.90 + ripple * 0.18;
    // Wet sand near waterline: darker, cooler, more saturated toward y=0
    float wetness = 1.0 - smoothstep(0.0, 0.85, vWorldPos.y);
    vec3 wetSandCol = vec3(0.58, 0.46, 0.26);
    litColor = mix(litColor, wetSandCol * (0.38 + NdotL * 0.75), wetness * 0.60);
  }
  bool isStone = vColor.r > 0.38 && vColor.r < 0.72 && abs(vColor.r - vColor.g) < 0.10 && abs(vColor.g - vColor.b) < 0.10;
  if (isStone) {
    float sv1 = sin(vWorldPos.x * 3.7 + vWorldPos.y * 2.1 + vWorldPos.z * 4.3);
    float sv2 = cos(vWorldPos.x * 2.9 + vWorldPos.z * 3.1 + vWorldPos.y * 1.7);
    float mottle = sv1 * sv2 * 0.5 + 0.5;
    float vein = smoothstep(0.68, 0.74, mottle) * 0.18;
    litColor = mix(litColor * (0.88 + mottle * 0.18), litColor + vec3(0.08, 0.07, 0.05) * vein, 0.8);
  }
  if (isGrass && uAutumnAmount > 0.0) {
    vec3 autumnCol = vec3(0.88, 0.50, 0.06);
    litColor = mix(litColor, autumnCol * (0.40 + NdotL * 0.9), uAutumnAmount * 0.72);
  }
  float nightPhase = abs(uDayPhase - 0.5);
  float nightAmt = smoothstep(0.30, 0.47, nightPhase);
  if (N.y > 0.5 && nightAmt < 0.8 && uRainAmount < 0.5) {
    vec2 cUV = vWorldPos.xz * 0.07 + vec2(uTime * 0.018, uTime * 0.011);
    float c1 = sin(cUV.x * 3.1 + sin(cUV.y * 2.3)) * 0.5 + 0.5;
    float c2 = sin(cUV.x * 1.7 + cUV.y * 2.9 + 1.4) * 0.5 + 0.5;
    float cloud = smoothstep(0.55, 0.75, c1 * c2);
    litColor *= 1.0 - cloud * 0.22 * (1.0 - nightAmt);
  }
  bool isWater = vColor.b > 0.55 && vColor.r < 0.25;
  if (!isWater && uSnowAmount > 0.0) {
    float heightFactor = clamp((vWorldPos.y - 0.5) / 2.0, 0.12, 1.0);
    float snowLine = smoothstep(2.3, 2.65, vWorldPos.y);
    float snowBlend = mix(heightFactor, 1.0, snowLine);
    vec3 snowCol = vec3(0.90, 0.93, 0.98);
    litColor = mix(litColor, snowCol * (0.55 + NdotL * 0.6), uSnowAmount * snowBlend);
    if (N.y > 0.4) {
      vec3 viewDir2 = normalize(vec3(0.57, 1.0, 0.57));
      vec3 halfVec2 = normalize(uLightDir + viewDir2);
      float snowSpec = pow(max(0.0, dot(N, halfVec2)), 28.0);
      litColor += vec3(0.95, 0.97, 1.0) * snowSpec * uSnowAmount * snowBlend * 0.6;
    }
  }
  if (isWater) {
    float depthNoise = sin(vWorldPos.x * 0.22 + 1.3) * cos(vWorldPos.z * 0.19 + 0.7) * 0.5 + 0.5;
    vec3 shallowCol = vec3(0.28, 0.68, 0.75);
    vec3 deepCol    = vec3(0.08, 0.18, 0.42);
    vec3 waterBase  = mix(deepCol, shallowCol, depthNoise * 0.65);
    litColor = mix(waterBase * (0.3 + NdotL * 0.5), litColor, 0.35);
    float s = sin(vWorldPos.x * 2.8 + uTime * 2.2) * cos(vWorldPos.z * 2.1 + uTime * 1.7);
    float sparkle = pow(max(0.0, s), 6.0) * 0.35;
    litColor += mix(vec3(sparkle * 0.7, sparkle * 0.85, sparkle),
                    vec3(sparkle * 0.55, sparkle * 0.65, sparkle), nightAmt);
    float wnx = sin(vWorldPos.x * 4.1 + uTime * 1.8) * 0.28;
    float wnz = cos(vWorldPos.z * 3.7 + uTime * 2.1) * 0.28;
    vec3 waveN = normalize(vec3(-wnx, 1.0, -wnz));
    vec3 viewDir = normalize(vec3(0.57, 1.0, 0.57));
    vec3 halfVec = normalize(uLightDir + viewDir);
    float spec = pow(max(0.0, dot(waveN, halfVec)), 12.0);
    litColor += mix(vec3(1.0, 0.97, 0.88) * spec * 0.5,
                    vec3(0.75, 0.85, 1.0) * spec * 1.2, nightAmt);
    float crest = smoothstep(0.05, 0.10, vWorldPos.y);
    litColor = mix(litColor, vec3(0.91, 0.95, 1.0), crest * 0.75 * (1.0 - nightAmt * 0.5));
  }
  bool isRooftop = N.y > 0.7 && vWorldPos.y > 1.0 && !isGrass && !isWater && !isSand;
  if (isRooftop && nightAmt < 0.7) {
    vec3 roofView = normalize(vec3(0.57, 1.0, 0.57));
    vec3 roofHalf = normalize(uLightDir + roofView);
    float roofSpec = pow(max(0.0, dot(N, roofHalf)), 18.0) * (1.0 - nightAmt);
    litColor += vec3(1.0, 0.96, 0.88) * roofSpec * 0.45;
  }
  bool isBuildingWall = N.y < 0.3 && vWorldPos.y > 0.5 && vColor.r > 0.55 && vColor.r > vColor.b * 1.3;
  if (isBuildingWall && nightAmt > 0.1) {
    vec2 winHash = floor(vWorldPos.xz * 3.0 + vec2(vWorldPos.y * 1.7, 0.0));
    float h = fract(sin(dot(winHash, vec2(17.3, 41.7))) * 8273.5);
    float flicker = 0.85 + 0.15 * sin(uTime * (3.0 + h * 5.0) + h * 6.28);
    float windowGlow = step(0.55, h) * nightAmt * 0.55 * flicker;
    litColor += vec3(1.0, 0.72, 0.20) * windowGlow;
  }
  if (uRainAmount > 0.0) {
    litColor *= mix(1.0, 0.70, uRainAmount);
    if (N.y > 0.5) {
      float streak = fract((vWorldPos.x - vWorldPos.z * 0.5) * 5.0 + uTime * 9.0);
      float drop = step(0.93, streak) * 0.4;
      litColor += vec3(0.55, 0.65, 0.80) * drop * uRainAmount;
    }
  }
  float fogDist = length(vec2(vWorldPos.x - uCameraCenter.x, vWorldPos.z - uCameraCenter.y));
  float fog = smoothstep(30.0, 46.0, fogDist);
  float atmDist = smoothstep(18.0, 30.0, fogDist);
  float lum = dot(litColor, vec3(0.299, 0.587, 0.114));
  litColor = mix(litColor, vec3(lum) * 0.9 + vec3(0.06, 0.09, 0.14) * 0.1, atmDist * 0.45);
  float dawn = max(0.0, 1.0 - abs(uDayPhase - 0.15) * 6.0);
  float dusk = max(0.0, 1.0 - abs(uDayPhase - 0.85) * 6.0);
  vec3 skyNoon  = vec3(0.45, 0.68, 0.88);
  vec3 skyDawn  = vec3(0.96, 0.65, 0.38);
  vec3 skyDusk  = vec3(0.70, 0.45, 0.72);
  vec3 skyNight = vec3(0.04, 0.07, 0.18);
  vec3 skyCol = mix(mix(mix(skyNoon, skyDawn, dawn), skyDusk, dusk), skyNight, nightAmt);
  litColor = mix(litColor, litColor * mix(vec3(1.0), vec3(1.18, 0.90, 0.72), dawn + dusk * 0.7), 0.35);
  float goldenHour = max(dawn, dusk * 0.8);
  if (goldenHour > 0.05 && N.y > 0.4) {
    float rayDir = dawn > dusk ? 1.0 : -1.0;
    float shaftCoord = (vWorldPos.x * 0.6 + vWorldPos.z * 0.4) * 0.18 + uTime * 0.04 * rayDir;
    float shaft = pow(max(0.0, sin(shaftCoord * 6.28318) * 0.5 + 0.5), 6.0);
    vec3 rayCol = mix(vec3(1.0, 0.80, 0.45), vec3(0.90, 0.55, 0.70), dusk);
    litColor += rayCol * shaft * goldenHour * 0.22;
  }
  vec3 moonlit = vec3(0.50, 0.60, 0.82) * 0.15;
  litColor = mix(litColor, litColor * 0.10 + moonlit, nightAmt);
  vec3 finalCol = mix(litColor, skyCol, fog * 0.8);
  if (nightAmt > 0.2 && fog > 0.55) {
    vec2 sGrid = floor(vWorldPos.xz * 1.8);
    float h = fract(sin(dot(sGrid, vec2(127.1, 311.7))) * 43758.5453);
    float twinkle = 0.5 + 0.5 * sin(uTime * (2.0 + h * 4.0) + h * 31.4);
    float star = step(0.965, h) * twinkle * nightAmt * fog;
    finalCol += vec3(0.88, 0.92, 1.0) * star * 1.4;
  }
  gl_FragColor = vec4(finalCol, 1.0);
}`;

// ── Matrix math ────────────────────────────────────────────
function mat4Identity() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[r + k*4] * b[k + c*4];
      }
      out[r + c*4] = sum;
    }
  }
  return out;
}

function mat4Ortho(left, right, bottom, top, near, far) {
  const out = new Float32Array(16);
  const rl = right - left;
  const tb = top - bottom;
  const fn = far - near;
  out[0]  =  2 / rl;
  out[5]  =  2 / tb;
  out[10] = -2 / fn;
  out[12] = -(right + left) / rl;
  out[13] = -(top + bottom) / tb;
  out[14] = -(far + near) / fn;
  out[15] = 1;
  return out;
}

function mat4RotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
    1, 0,  0, 0,
    0, c,  s, 0,
    0,-s,  c, 0,
    0, 0,  0, 1,
  ]);
}

function mat4RotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
     c, 0,-s, 0,
     0, 1, 0, 0,
     s, 0, c, 0,
     0, 0, 0, 1,
  ]);
}

function mat4Translate(tx, ty, tz) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1,
  ]);
}

// ── Shader compilation helpers ─────────────────────────────
function compileShader(glCtx, type, src) {
  const sh = glCtx.createShader(type);
  glCtx.shaderSource(sh, src);
  glCtx.compileShader(sh);
  if (!glCtx.getShaderParameter(sh, glCtx.COMPILE_STATUS)) {
    const log = glCtx.getShaderInfoLog(sh);
    glCtx.deleteShader(sh);
    throw new Error('Shader compile error: ' + log);
  }
  return sh;
}

function createProgram(glCtx, vsSrc, fsSrc) {
  const vs = compileShader(glCtx, glCtx.VERTEX_SHADER, vsSrc);
  const fs = compileShader(glCtx, glCtx.FRAGMENT_SHADER, fsSrc);
  const prog = glCtx.createProgram();
  glCtx.attachShader(prog, vs);
  glCtx.attachShader(prog, fs);
  glCtx.linkProgram(prog);
  if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
    const log = glCtx.getProgramInfoLog(prog);
    glCtx.deleteProgram(prog);
    throw new Error('Program link error: ' + log);
  }
  glCtx.deleteShader(vs);
  glCtx.deleteShader(fs);
  return prog;
}

// ── Mesh geometry helpers ──────────────────────────────────
// We build a flat array:  [x,y,z, nx,ny,nz, r,g,b]  per vertex
// and a separate Uint32Array of indices.

function pushFace(verts, indices, positions, normal, color) {
  // positions: array of 4 [x,y,z], normal: [nx,ny,nz], color: [r,g,b]
  const base = verts.length / 9;  // 9 floats per vertex
  for (const p of positions) {
    verts.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }
  // Two triangles: base+0,1,2 and base+0,2,3
  indices.push(base, base+1, base+2, base, base+2, base+3);
}

// Per-vertex normals variant — for height-field top faces
function pushFaceNormals(verts, indices, positions, normals, color) {
  const base = verts.length / 9;
  for (let i = 0; i < 4; i++) {
    const p = positions[i], n = normals[i];
    verts.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2]);
  }
  indices.push(base, base+1, base+2, base, base+2, base+3);
}

function pushTri(verts, indices, p0, p1, p2, normal, color) {
  const base = verts.length / 9;
  for (const p of [p0, p1, p2]) {
    verts.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }
  indices.push(base, base+1, base+2);
}

function pushBox(verts, indices, x0, y0, z0, x1, y1, z1, color) {
  // Top
  pushFace(verts, indices, [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], [0,1,0], color);
  // Bottom
  pushFace(verts, indices, [[x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0]], [0,-1,0], color);
  // Front (+Z)
  pushFace(verts, indices, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [0,0,1], color);
  // Back (-Z)
  pushFace(verts, indices, [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [0,0,-1], color);
  // Right (+X)
  pushFace(verts, indices, [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], [1,0,0], color);
  // Left (-X)
  pushFace(verts, indices, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], [-1,0,0], color);
}

// ── Tree geometry ──────────────────────────────────────────
function addTree(verts, indices, cx, cz, groundY, S = 2.8) {
  const baseY = groundY;
  // Canopy only — no trunk box, keeps forest floor readable
  const trunkH = 0.3 * S;  // canopy base height above ground
  const canopyColor     = [0.18, 0.60, 0.22];
  const canopyColorDark = [0.11, 0.40, 0.14];
  const topY = baseY + trunkH + 1.6 * S;
  const midY = baseY + trunkH;
  const cw = 0.6 * S;
  const apex = [cx, topY, cz];
  // Front
  pushTri(verts, indices,
    [cx-cw, midY, cz+cw], [cx+cw, midY, cz+cw], apex,
    [0, 0.3, 1], canopyColor
  );
  // Right
  pushTri(verts, indices,
    [cx+cw, midY, cz+cw], [cx+cw, midY, cz-cw], apex,
    [1, 0.3, 0], canopyColorDark
  );
  // Back
  pushTri(verts, indices,
    [cx+cw, midY, cz-cw], [cx-cw, midY, cz-cw], apex,
    [0, 0.3, -1], canopyColor
  );
  // Left
  pushTri(verts, indices,
    [cx-cw, midY, cz-cw], [cx-cw, midY, cz+cw], apex,
    [-1, 0.3, 0], canopyColorDark
  );
}

// ── Inline a GLB geometry at (cx, groundY, cz) with uniform scale ──
// baseColor: optional color for the lower 38% of model height (hex base layer)
// If omitted, the entire model uses `color`.
// clipBase: if true, skip all triangles whose verts are in the bottom 36% of the model height.
// Used for buildings to remove the Kenney hex tile base platform.
// color = mid/wall color, trunkColor = lower 28%, roofColor = upper 32%
function inlineGLBTree(verts, indices, geom, cx, groundY, cz, scale, color, clipBase, trunkColor, roofColor) {
  const { positions, normals } = geom;
  const vCount = positions.length / 3;

  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < minY) minY = positions[i];
    if (positions[i] > maxY) maxY = positions[i];
  }
  const range = maxY - minY;
  const baseThreshold = minY + range * 0.36;
  const trunkThreshold = minY + range * 0.28; // lower 28% = trunk/base
  const roofThreshold  = minY + range * 0.68; // upper 32% = roof/top

  // Map original vert index → new packed index (-1 = skipped)
  const vertMap = new Int32Array(vCount).fill(-1);
  const vertBase = verts.length / 9;
  let newIdx = 0;

  for (let i = 0; i < vCount; i++) {
    if (clipBase && positions[i*3+1] < baseThreshold) continue;
    vertMap[i] = vertBase + newIdx++;
    const px = positions[i*3+0] * scale + cx;
    const py = (positions[i*3+1] - minY) * scale + groundY;
    const pz = positions[i*3+2] * scale + cz;
    let c = color;
    if (trunkColor && positions[i*3+1] < trunkThreshold) c = trunkColor;
    else if (roofColor && positions[i*3+1] > roofThreshold)  c = roofColor;
    verts.push(px, py, pz,
      normals[i*3+0], normals[i*3+1], normals[i*3+2],
      c[0], c[1], c[2]);
  }

  // Only emit triangles where all 3 verts survived clipping
  const idxArr = geom.indices;
  for (let t = 0; t < idxArr.length; t += 3) {
    const a = vertMap[idxArr[t]], b = vertMap[idxArr[t+1]], c = vertMap[idxArr[t+2]];
    if (a < 0 || b < 0 || c < 0) continue;
    indices.push(a, b, c);
  }
}

// ── Building geometry helpers ──────────────────────────────

function addBuildingMesh(verts, indices, b, groundY) {
  const cx = b.x + 0.5;
  const cz = b.y + 0.5;
  const gy = groundY;
  const type = b.type;
  const S = 4.0; // global building size multiplier for visibility

  // Record vertex count before building; we'll scale them at the end
  const vertStart = verts.length;
  if (type === 'house') {
    // Base box
    const baseColor = [0.94, 0.88, 0.72];
    const hw = 0.4;
    const bh = 0.6;
    pushBox(verts, indices, cx-hw, gy, cz-hw, cx+hw, gy+bh, cz+hw, baseColor);
    // Pyramid roof
    const roofColor = [0.88, 0.18, 0.12];
    const roofBase = gy + bh;
    const roofApex = roofBase + 0.5;
    const rw = 0.42;
    const apex = [cx, roofApex, cz];
    pushTri(verts, indices, [cx-rw,roofBase,cz+rw], [cx+rw,roofBase,cz+rw], apex, [0,0.3,1], roofColor);
    pushTri(verts, indices, [cx+rw,roofBase,cz+rw], [cx+rw,roofBase,cz-rw], apex, [1,0.3,0], roofColor);
    pushTri(verts, indices, [cx+rw,roofBase,cz-rw], [cx-rw,roofBase,cz-rw], apex, [0,0.3,-1], roofColor);
    pushTri(verts, indices, [cx-rw,roofBase,cz-rw], [cx-rw,roofBase,cz+rw], apex, [-1,0.3,0], roofColor);

  } else if (type === 'farm') {
    // Flat wooden platform
    const platformColor = [0.72, 0.55, 0.30];
    pushBox(verts, indices, cx-0.48, gy, cz-0.48, cx+0.48, gy+0.05, cz+0.48, platformColor);
    // 4 crop boxes in 2x2 grid
    const cropColor = [0.35, 0.22, 0.10];
    const offsets = [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]];
    for (const [ox, oz] of offsets) {
      pushBox(verts, indices, cx+ox-0.08, gy+0.05, cz+oz-0.08, cx+ox+0.08, gy+0.18, cz+oz+0.08, cropColor);
    }

  } else if (type === 'tower') {
    // Tall thin box
    const towerColor = [0.55, 0.55, 0.60];
    pushBox(verts, indices, cx-0.2, gy, cz-0.2, cx+0.2, gy+1.4, cz+0.2, towerColor);
    // Turret on top
    const turretColor = [0.40, 0.40, 0.45];
    pushBox(verts, indices, cx-0.25, gy+1.4, cz-0.25, cx+0.25, gy+1.65, cz+0.25, turretColor);

  } else if (type === 'church') {
    // Wide base
    const stoneColor = [0.87, 0.82, 0.74];
    pushBox(verts, indices, cx-0.45, gy, cz-0.45, cx+0.45, gy+0.7, cz+0.45, stoneColor);
    // Steeple tower on +X side
    const steepleColor = [0.80, 0.75, 0.68];
    pushBox(verts, indices, cx+0.15, gy, cz-0.15, cx+0.45, gy+1.4, cz+0.15, steepleColor);
    // Steeple apex
    const apexY = gy + 1.4 + 0.4;
    const sc = 0.15;
    const sa = [cx+0.3, apexY, cz];
    pushTri(verts, indices, [cx+0.15,gy+1.4,cz+sc],[cx+0.45,gy+1.4,cz+sc], sa, [0,0.3,1], steepleColor);
    pushTri(verts, indices, [cx+0.45,gy+1.4,cz+sc],[cx+0.45,gy+1.4,cz-sc], sa, [1,0.3,0], steepleColor);
    pushTri(verts, indices, [cx+0.45,gy+1.4,cz-sc],[cx+0.15,gy+1.4,cz-sc], sa, [0,0.3,-1], steepleColor);
    pushTri(verts, indices, [cx+0.15,gy+1.4,cz-sc],[cx+0.15,gy+1.4,cz+sc], sa, [-1,0.3,0], steepleColor);

  } else if (type === 'barracks') {
    // Grey stone, wide and lower
    const barColor = [0.42, 0.45, 0.52];
    pushBox(verts, indices, cx-0.48, gy, cz-0.38, cx+0.48, gy+0.55, cz+0.38, barColor);
    // Flag stick (thin dark red box on top)
    const flagColor = [0.55, 0.10, 0.10];
    pushBox(verts, indices, cx+0.35, gy+0.55, cz-0.03, cx+0.42, gy+0.9, cz+0.03, flagColor);

  } else if (type === 'market') {
    // Low open platform
    const platColor = [0.80, 0.72, 0.55];
    pushBox(verts, indices, cx-0.48, gy, cz-0.48, cx+0.48, gy+0.2, cz+0.48, platColor);
    // Red awning
    const awningColor = [0.85, 0.22, 0.18];
    pushBox(verts, indices, cx-0.4, gy+0.2, cz-0.4, cx+0.4, gy+0.35, cz+0.4, awningColor);

  } else if (type === 'castle') {
    // Main keep
    const castleColor = [0.65, 0.62, 0.60];
    pushBox(verts, indices, cx-0.35, gy, cz-0.35, cx+0.35, gy+1.3, cz+0.35, castleColor);
    // Corner towers
    const towerColor2 = [0.58, 0.55, 0.52];
    pushBox(verts, indices, cx-0.48, gy, cz-0.48, cx-0.22, gy+1.0, cz-0.22, towerColor2);
    pushBox(verts, indices, cx+0.22, gy, cz+0.22, cx+0.48, gy+1.0, cz+0.48, towerColor2);

  } else if (type === 'well') {
    // Stone ring base
    const wellColor = [0.62, 0.58, 0.55];
    pushBox(verts, indices, cx-0.22, gy, cz-0.22, cx+0.22, gy+0.25, cz+0.22, wellColor);
    // Hollow out the top by just leaving a platform (visual approximation)
    // Wooden crossbar
    const woodColor = [0.55, 0.38, 0.18];
    pushBox(verts, indices, cx-0.25, gy+0.25, cz-0.04, cx+0.25, gy+0.32, cz+0.04, woodColor);

  } else if (type === 'tavern') {
    // Warmer wood color, similar to house
    const tavColor = [0.72, 0.48, 0.25];
    pushBox(verts, indices, cx-0.42, gy, cz-0.42, cx+0.42, gy+0.65, cz+0.42, tavColor);
    // Roof
    const roofColor = [0.55, 0.30, 0.15];
    const rb = gy + 0.65;
    const ra = rb + 0.45;
    const rw = 0.44;
    const rapex = [cx, ra, cz];
    pushTri(verts, indices, [cx-rw,rb,cz+rw],[cx+rw,rb,cz+rw], rapex, [0,0.3,1], roofColor);
    pushTri(verts, indices, [cx+rw,rb,cz+rw],[cx+rw,rb,cz-rw], rapex, [1,0.3,0], roofColor);
    pushTri(verts, indices, [cx+rw,rb,cz-rw],[cx-rw,rb,cz-rw], rapex, [0,0.3,-1], roofColor);
    pushTri(verts, indices, [cx-rw,rb,cz-rw],[cx-rw,rb,cz+rw], rapex, [-1,0.3,0], roofColor);
    // Chimney
    const chimneyColor = [0.50, 0.45, 0.42];
    pushBox(verts, indices, cx+0.2, gy+0.65, cz-0.08, cx+0.30, gy+0.95, cz+0.08, chimneyColor);

  } else if (type === 'blacksmith') {
    // Dark grey box
    const smithColor = [0.35, 0.35, 0.40];
    pushBox(verts, indices, cx-0.38, gy, cz-0.38, cx+0.38, gy+0.6, cz+0.38, smithColor);
    // Chimney
    const chimneyColor = [0.28, 0.28, 0.32];
    pushBox(verts, indices, cx+0.18, gy+0.6, cz-0.08, cx+0.28, gy+0.95, cz+0.08, chimneyColor);

  } else if (type === 'windmill') {
    // Tall body
    const wmColor = [0.78, 0.72, 0.62];
    pushBox(verts, indices, cx-0.2, gy, cz-0.2, cx+0.2, gy+1.1, cz+0.2, wmColor);
    // Cross blades (2 overlapping flat boxes)
    const bladeColor = [0.90, 0.85, 0.70];
    pushBox(verts, indices, cx-0.55, gy+0.85, cz-0.04, cx+0.55, gy+0.96, cz+0.04, bladeColor);
    pushBox(verts, indices, cx-0.04, gy+0.55, cz-0.04, cx+0.04, gy+1.25, cz+0.04, bladeColor);

  } else {
    // Generic grey box for all others (quarry, mine, lumber, granary, etc.)
    const genericColor = [0.55, 0.55, 0.55];
    pushBox(verts, indices, cx-0.35, gy, cz-0.35, cx+0.35, gy+0.55, cz+0.35, genericColor);
  }

  // Scale all vertices of this building by S around (cx, gy, cz)
  // Vertex layout is [x,y,z, nx,ny,nz, r,g,b] — 9 floats per vertex
  for (let i = vertStart; i < verts.length; i += 9) {
    verts[i]   = cx + (verts[i]   - cx) * S;
    verts[i+1] = gy + (verts[i+1] - gy) * S;
    verts[i+2] = cz + (verts[i+2] - cz) * S;
  }
}

// ── Upload a mesh to a VAO/buffer pair ─────────────────────
function uploadMesh(targetVao, targetVertBuf, targetIdxBuf, verts, indices) {
  const vertData = new Float32Array(verts);
  const idxData  = new Uint32Array(indices);
  const STRIDE   = 9 * 4;

  if (isWebGL2) {
    gl.bindVertexArray(targetVao);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(targetVao);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, targetVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.DYNAMIC_DRAW);

  const aPosLoc    = gl.getAttribLocation(program, 'aPos');
  const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
  const aColorLoc  = gl.getAttribLocation(program, 'aColor');

  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);

  gl.enableVertexAttribArray(aNormalLoc);
  gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);

  gl.enableVertexAttribArray(aColorLoc);
  gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, targetIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return idxData.length;
}

export function buildTerrainMesh() {
  if (!gl) return;

  const verts = [];
  const indices = [];
  const treeTiles = []; // collected during terrain loop, drawn after terrain

  // Base height of a tile — used for side-face culling (only draw when neighbor is lower)
  const tileBaseH = (r, c) => {
    const tr = Math.max(0, Math.min(MAP_H - 1, r));
    const tc = Math.max(0, Math.min(MAP_W - 1, c));
    const tt = (G.map[tr] && G.map[tr][tc] !== undefined) ? G.map[tr][tc] : TILE.GRASS;
    return TILE_HEIGHT[tt] !== undefined ? TILE_HEIGHT[tt] : 0.5;
  };

  // Noisy height for slope-normal computation only (not for geometry)
  const tileH = (r, c) => {
    const tr = Math.max(0, Math.min(MAP_H - 1, r));
    const tc = Math.max(0, Math.min(MAP_W - 1, c));
    const tt = (G.map[tr] && G.map[tr][tc] !== undefined) ? G.map[tr][tc] : TILE.GRASS;
    const bh = TILE_HEIGHT[tt] !== undefined ? TILE_HEIGHT[tt] : 0.5;
    if (tt === TILE.WATER) return bh;
    const s = (tc * 374761 + tr * 668265) >>> 0;
    return bh + ((s & 0xff) / 255 - 0.5) * 0.12;
  };

  // Compute smooth normal for a top-face vertex at (row, col) using Sobel-filter on heights
  const vertNormal = (r, c) => {
    const dx = (tileH(r, c + 1) - tileH(r, c - 1)) * 0.4; // moderate slope factor
    const dz = (tileH(r + 1, c) - tileH(r - 1, c)) * 0.4;
    const nx = -dx, ny = 1.0, nz = -dz;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len];
  };

  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      const tileType = (G.map[row] && G.map[row][col] !== undefined) ? G.map[row][col] : TILE.GRASS;
      const baseH = TILE_HEIGHT[tileType] !== undefined ? TILE_HEIGHT[tileType] : 0.5;
      const baseColor = TILE_COLOR_3D[tileType] || [0.5, 0.5, 0.5];

      // Per-tile deterministic noise for variety (breaks up the uniform-square look)
      const seed = (col * 374761 + row * 668265) >>> 0;
      const noise1 = ((seed & 0xff) / 255 - 0.5); // -0.5..0.5
      const noise2 = (((seed >>> 8) & 0xff) / 255 - 0.5);

      // Flat geometry within each biome — eliminates tile-edge ledges and triangle grid.
      // tileH() still uses noise for slope normal computation (subtle shading variation).
      const h = baseH;

      // Subtle per-tile brightness jitter (±10%) breaks up the uniform-square look
      const cv = 0.20 * noise1;
      const color = [
        Math.max(0, Math.min(1, baseColor[0] * (1 + cv))),
        Math.max(0, Math.min(1, baseColor[1] * (1 + cv))),
        Math.max(0, Math.min(1, baseColor[2] * (1 + cv))),
      ];

      const x0 = col;
      const x1 = col + 1;
      const z0 = row;
      const z1 = row + 1;
      const y  = h;    // top face at height h
      const yb = -0.5;  // bottom goes below sea so no gaps

      // Top face normal: flat for water (no grid), slope-based for land
      let tileNormal;
      if (tileType === TILE.WATER) {
        tileNormal = [0, 1, 0];
      } else {
        const dx3 = (tileH(row, col + 1) - tileH(row, col - 1)) * 0.4;
        const dz3 = (tileH(row + 1, col) - tileH(row - 1, col)) * 0.4;
        const tnx = -dx3, tny = 1.0, tnz = -dz3;
        const tlen = Math.sqrt(tnx * tnx + tny * tny + tnz * tnz);
        tileNormal = [tnx / tlen, tny / tlen, tnz / tlen];
      }
      // Rock/mountain top faces get a lighter cap; grey sides stay dark
      const topColor = tileType === TILE.MOUNTAIN
        ? [0.88, 0.88, 0.92]   // snow cap
        : tileType === TILE.STONE
        ? [0.74, 0.70, 0.66]   // warm pale rock top
        : color;
      pushFace(verts, indices,
        [ [x0,y,z0], [x1,y,z0], [x1,y,z1], [x0,y,z1] ],
        tileNormal,
        topColor
      );

      // Skip water side faces entirely — water is a flat plane
      if (tileType === TILE.WATER) continue;

      // Only draw a side face when the neighbor on that side is lower — avoids
      // same-height tile walls that create the triangle grid within flat biomes
      if (h > 0.0) {
        const sideColor = color;
        if (tileBaseH(row + 1, col) < h) {
          pushFace(verts, indices,
            [ [x0,yb,z1], [x1,yb,z1], [x1,y,z1], [x0,y,z1] ],
            [0, 0, 1], sideColor
          );
        }
        if (tileBaseH(row - 1, col) < h) {
          pushFace(verts, indices,
            [ [x1,yb,z0], [x0,yb,z0], [x0,y,z0], [x1,y,z0] ],
            [0, 0, -1], sideColor
          );
        }
        if (tileBaseH(row, col + 1) < h) {
          pushFace(verts, indices,
            [ [x1,yb,z1], [x1,yb,z0], [x1,y,z0], [x1,y,z1] ],
            [1, 0, 0], sideColor
          );
        }
        if (tileBaseH(row, col - 1) < h) {
          pushFace(verts, indices,
            [ [x0,yb,z0], [x0,yb,z1], [x0,y,z1], [x0,y,z0] ],
            [-1, 0, 0], sideColor
          );
        }
      }

      // ~28% of FOREST tiles get a tree — keeps canopy readable without solid carpet
      if (tileType === TILE.FOREST) {
        const treeSeed = (col * 4517 + row * 2971) >>> 0;
        if ((treeSeed % 25) < 7) {
          // Vary tree height 1.4–2.6 — smaller canopy radius reduces overlap
          const treeScale = 1.4 + ((treeSeed >>> 8) & 0xff) / 255 * 1.2;
          treeTiles.push([col + 0.5, row + 0.5, h, treeScale, treeSeed]);
        }
      }
    }
  }

  // Record terrain-only index count, then append tree geometry
  terrainIndexCount = indices.length;
  for (const [cx, cz, groundY, scale, treeSeed] of treeTiles) {
    if (glbTreeVariants && glbTreeVariants.length > 0) {
      const variantIdx = treeSeed % glbTreeVariants.length;
      const variant = glbTreeVariants[variantIdx];
      const glbScale = scale * 0.55;
      // Slight color variation per variant so forest isn't uniform
      const treeColors = [
        [0.18, 0.60, 0.22], // default — medium forest green
        [0.14, 0.50, 0.18], // tall — darker spruce
        [0.22, 0.64, 0.26], // small — lighter young pine
      ];
      const canopyColor = treeColors[variantIdx];
      const trunkColor = [0.42, 0.28, 0.14]; // warm brown bark
      // Raise tree 0.08 above ground so base geometry doesn't clip terrain
      inlineGLBTree(verts, indices, variant, cx, groundY + 0.08, cz, glbScale, canopyColor, false, trunkColor);
    } else {
      addTree(verts, indices, cx, cz, groundY, scale);
    }
  }
  treeIndexCount = indices.length - terrainIndexCount;

  const vertData = new Float32Array(verts);
  const idxData  = new Uint32Array(indices);
  indexCount = idxData.length;

  const STRIDE = 9 * 4; // 9 floats × 4 bytes

  if (isWebGL2) {
    // Bind VAO then upload buffers
    gl.bindVertexArray(vao);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(vao);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.STATIC_DRAW);

  const aPosLoc    = gl.getAttribLocation(program, 'aPos');
  const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
  const aColorLoc  = gl.getAttribLocation(program, 'aColor');

  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);

  gl.enableVertexAttribArray(aNormalLoc);
  gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);

  gl.enableVertexAttribArray(aColorLoc);
  gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

// ── Buildings mesh ─────────────────────────────────────────
export function buildBuildingsMesh() {
  if (!gl || !program) return;

  const verts   = [];
  const indices = [];

  if (!G.buildings || G.buildings.length === 0) {
    buildingsIndexCount = 0;
    lastBuildingRebuild = performance.now();
    return;
  }
  for (const b of G.buildings) {
    // Skip non-structural types that have no visual presence worth rendering
    if (b.type === 'road' || b.type === 'wall') continue;

    const row = b.y;
    const col = b.x;
    const tileType = (G.map[row] && G.map[row][col] !== undefined)
      ? G.map[row][col]
      : TILE.GRASS;
    const baseH = TILE_HEIGHT[tileType] !== undefined ? TILE_HEIGHT[tileType] : 0.8;
    const seed = (col * 374761 + row * 668265) >>> 0;
    const noise1 = ((seed & 0xff) / 255 - 0.5);
    const groundY = baseH + (tileType === TILE.WATER ? 0 : noise1 * 0.12) + 0.02;

    const glbGeom = glbBuildings[b.type];
    if (glbGeom) {
      const cx = col + 0.5, cz = row + 0.5;
      const bldScale = 0.80;
      const GLB_COLORS = {
        house:      [0.95, 0.82, 0.60],
        farm:       [0.68, 0.52, 0.28],
        tower:      [0.62, 0.65, 0.70],
        church:     [0.95, 0.90, 0.80],
        barracks:   [0.48, 0.52, 0.58],
        market:     [0.92, 0.72, 0.28],
        castle:     [0.58, 0.55, 0.52],
        tavern:     [0.78, 0.50, 0.25],
        blacksmith: [0.32, 0.32, 0.38],
        windmill:   [0.88, 0.82, 0.65],
      };
      // Contrasting roof/top color per building type for visual identity
      const GLB_ROOF = {
        house:      [0.70, 0.22, 0.18], // red tile roof
        farm:       [0.55, 0.40, 0.18], // brown thatch
        tower:      [0.38, 0.42, 0.48], // dark slate cap
        church:     [0.48, 0.46, 0.44], // stone spire
        barracks:   [0.50, 0.20, 0.16], // dark red roof
        market:     [0.82, 0.24, 0.14], // bright red awning
        castle:     [0.42, 0.40, 0.38], // dark stone merlon
        tavern:     [0.55, 0.35, 0.16], // brown thatch
        blacksmith: [0.22, 0.22, 0.26], // dark iron roof
        windmill:   [0.72, 0.28, 0.18], // red cap
      };
      const color    = GLB_COLORS[b.type] || [0.80, 0.78, 0.72];
      const roofColor = GLB_ROOF[b.type] || null;
      // Clip bottom 36% of model (Kenney hex base platform) — building structure only
      inlineGLBTree(verts, indices, glbGeom, cx, groundY - 0.30, cz, bldScale, color, true, null, roofColor);
    } else {
      addBuildingMesh(verts, indices, b, groundY);
    }
  }

  if (indices.length === 0) {
    buildingsIndexCount = 0;
    lastBuildingRebuild = performance.now();
    return;
  }

  buildingsIndexCount = uploadMesh(buildingsVao, buildingsVertexBuf, buildingsIndexBuf, verts, indices);
  lastBuildingRebuild = performance.now();
}

// ── Citizens mesh (rebuilt every frame) ────────────────────
const CITIZEN_COLORS = [
  [0.85, 0.25, 0.20], // red
  [0.25, 0.45, 0.85], // blue
  [0.20, 0.70, 0.25], // green
  [0.85, 0.72, 0.18], // yellow
  [0.70, 0.25, 0.75], // purple
  [0.20, 0.72, 0.72], // teal
];
const SKIN = [0.92, 0.75, 0.55];

function buildCitizensMesh() {
  if (!gl || !program || !G.citizens || G.citizens.length === 0) {
    citizensIndexCount = 0;
    return;
  }
  const verts = [], indices = [];

  function addPerson(cx, cz, bodyColor, S) {
    const col = Math.floor(cx), row = Math.floor(cz);
    const tileType = (G.map[row] && G.map[row][col] !== undefined) ? G.map[row][col] : TILE.GRASS;
    const groundY = (TILE_HEIGHT[tileType] !== undefined ? TILE_HEIGHT[tileType] : 0.8) + 0.02;
    pushBox(verts, indices, cx-S, groundY,       cz-S, cx+S,      groundY+S*3.5, cz+S,      bodyColor);
    pushBox(verts, indices, cx-S*0.85, groundY+S*3.5, cz-S*0.85, cx+S*0.85, groundY+S*5.5, cz+S*0.85, SKIN);
  }

  for (let i = 0; i < G.citizens.length; i++) {
    const c = G.citizens[i];
    addPerson(c.x, c.y, CITIZEN_COLORS[i % CITIZEN_COLORS.length], 0.10);
  }

  // Enemies render as slightly larger dark-red figures
  const ENEMY_COLOR = [0.72, 0.08, 0.08];
  for (const e of (G.enemies || [])) {
    addPerson(e.x, e.y, ENEMY_COLOR, 0.13);
  }

  if (indices.length === 0) { citizensIndexCount = 0; return; }
  citizensIndexCount = uploadMesh(citizensVao, citizensVertexBuf, citizensIndexBuf, verts, indices);
}

// ── Camera / VP matrix ─────────────────────────────────────
function buildViewProjection() {
  const zoom = (G.camera && G.camera.zoom) ? G.camera.zoom : 1.7;
  const orthoSize = 26 / zoom;

  const aspect = (gl.drawingBufferWidth || 800) / (gl.drawingBufferHeight || 600);
  const hw = orthoSize * aspect;
  const hh = orthoSize;

  const ortho = mat4Ortho(-hw, hw, -hh, hh, -300, 300);

  // Pitch: arctan(1/sqrt(2)) ≈ 35.264° (true isometric)
  const pitchRad = -Math.atan(1 / Math.sqrt(2));
  const yawRad   = -Math.PI / 4; // -45°

  const rx = mat4RotateX(pitchRad);
  const ry = mat4RotateY(yawRad);

  // Convert 2D isometric screen-pixel camera to 3D tile coordinates
  // G.camera.x/y are isometric screen offsets; toWorld formula: wx=camX/(TW/2), wy=camY/(TH/2)
  const halfTW = TW / 2, halfTH = TH / 2;
  const wx = (G.camera?.x ?? 0) / halfTW;
  const wy = (G.camera?.y ?? (MAP_H * halfTH)) / halfTH;
  const cx = (wx + wy) / 2;   // 3D world X = tile col
  const cz = (wy - wx) / 2;   // 3D world Z = tile row
  const tr = mat4Translate(-cx, 0, -cz);

  // VP = ortho * rotateX * rotateY * translate
  const vp = mat4Multiply(ortho, mat4Multiply(rx, mat4Multiply(ry, tr)));
  return vp;
}

// ── Public API ─────────────────────────────────────────────

export function initGL3D(canvas) {
  if (!canvas) {
    console.warn('initGL3D: no canvas provided');
    return false;
  }

  // Try WebGL2 first, fall back to WebGL1
  gl = canvas.getContext('webgl2', { antialias: true, depth: true });
  if (gl) {
    isWebGL2 = true;
  } else {
    gl = canvas.getContext('webgl', { antialias: true, depth: true }) ||
         canvas.getContext('experimental-webgl', { antialias: true, depth: true });
    isWebGL2 = false;
    if (!gl) {
      console.error('WebGL not supported');
      return false;
    }
    // Check for VAO extension in WebGL1
    oeVao = gl.getExtension('OES_vertex_array_object');
  }

  // Compile shaders
  try {
    if (isWebGL2) {
      program = createProgram(gl, VS_SRC_300, FS_SRC_300);
    } else {
      program = createProgram(gl, VS_SRC_100, FS_SRC_100);
    }
  } catch (e) {
    console.error('WebGL3D shader error:', e);
    return false;
  }

  // Get uniform locations
  uViewProjLoc      = gl.getUniformLocation(program, 'uViewProj');
  uLightDirLoc      = gl.getUniformLocation(program, 'uLightDir');
  uTimeLoc          = gl.getUniformLocation(program, 'uTime');
  uSeasonTintLoc    = gl.getUniformLocation(program, 'uSeasonTint');
  uCameraCenterLoc  = gl.getUniformLocation(program, 'uCameraCenter');
  uSnowAmountLoc    = gl.getUniformLocation(program, 'uSnowAmount');
  uAutumnAmountLoc  = gl.getUniformLocation(program, 'uAutumnAmount');
  uDayPhaseLoc      = gl.getUniformLocation(program, 'uDayPhase');
  uRainAmountLoc    = gl.getUniformLocation(program, 'uRainAmount');

  // Create terrain VAO
  if (isWebGL2) {
    vao = gl.createVertexArray();
  } else if (oeVao) {
    vao = oeVao.createVertexArrayOES();
  }

  // Create terrain GPU buffers
  vertexBuf = gl.createBuffer();
  indexBuf  = gl.createBuffer();

  // Create buildings VAO
  if (isWebGL2) {
    buildingsVao = gl.createVertexArray();
  } else if (oeVao) {
    buildingsVao = oeVao.createVertexArrayOES();
  }

  // Create buildings GPU buffers
  buildingsVertexBuf = gl.createBuffer();
  buildingsIndexBuf  = gl.createBuffer();

  // Create citizens VAO + buffers
  if (isWebGL2) {
    citizensVao = gl.createVertexArray();
  } else if (oeVao) {
    citizensVao = oeVao.createVertexArrayOES();
  }
  citizensVertexBuf = gl.createBuffer();
  citizensIndexBuf  = gl.createBuffer();

  // GL state
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.45, 0.68, 0.88, 1.0);

  // Size canvas to match display
  resize3D();

  // Load Kenney tree GLBs asynchronously — terrain rebuilds when ready
  Promise.all([
    loadGLBGeometry('./assets/meshes/tree_pineDefaultA.glb'),
    loadGLBGeometry('./assets/meshes/tree_pineTallA.glb'),
    loadGLBGeometry('./assets/meshes/tree_pineSmallC.glb'),
  ]).then(variants => {
    glbTreeVariants = variants;
    buildTerrainMesh();
    console.log('GLB tree meshes loaded');
  }).catch(e => console.warn('GLB tree load failed, using pyramids:', e));

  // Load building GLBs — buildings mesh rebuilds when ready
  Promise.all(
    Object.entries(BUILDING_GLB_MAP).map(([type, url]) =>
      loadGLBGeometry(url).then(geom => { glbBuildings[type] = geom; })
        .catch(e => console.warn(`GLB building ${type} failed:`, e))
    )
  ).then(() => {
    lastBuildingRebuild = 0; // force rebuild on next render tick
    console.log('GLB building meshes loaded');
  });

  console.log(`WebGL3D initialized (WebGL${isWebGL2 ? '2' : '1'})`);
  return true;
}

export function render3D() {
  if (!gl || !program || indexCount === 0) return;

  // Throttled buildings mesh rebuild (~500ms)
  const now = performance.now();
  if (now - lastBuildingRebuild > 500) {
    buildBuildingsMesh();
  }

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  // Dynamic clear color tracks day/night phase so background matches fog sky
  {
    const t = (G.dayPhase ?? 0) / (G.dayLength ?? 3600);
    const dawn = Math.max(0, 1 - Math.abs(t - 0.15) * 6);
    const dusk = Math.max(0, 1 - Math.abs(t - 0.85) * 6);
    const nightPhase = Math.abs(t - 0.5);
    const night = Math.max(0, Math.min(1, (nightPhase - 0.30) / 0.17));
    const lerp = (a, b, f) => a + (b - a) * f;
    let r = lerp(lerp(0.45, 0.96, dawn), 0.70, dusk);
    let g = lerp(lerp(0.68, 0.65, dawn), 0.45, dusk);
    let b = lerp(lerp(0.88, 0.38, dawn), 0.72, dusk);
    r = lerp(r, 0.04, night); g = lerp(g, 0.07, night); b = lerp(b, 0.18, night);
    gl.clearColor(r, g, b, 1.0);
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  // View-projection matrix
  const vp = buildViewProjection();
  gl.uniformMatrix4fv(uViewProjLoc, false, vp);

  // Directional light: upper-right-front — illuminates both visible isometric faces
  // (+X right face and +Z front face both lit, right face slightly brighter)
  const lx = 0.6, ly = 0.8, lz = 0.5;
  const len = Math.sqrt(lx*lx + ly*ly + lz*lz);
  gl.uniform3f(uLightDirLoc, lx/len, ly/len, lz/len);

  // Time uniform for water animation
  if (uTimeLoc) gl.uniform1f(uTimeLoc, performance.now() * 0.001);

  // Season tint: shifts entire scene color to match current season
  if (uSeasonTintLoc) {
    const ST = {
      spring: [1.00, 1.00, 1.00],
      summer: [1.06, 1.02, 0.93],
      autumn: [1.14, 0.90, 0.80],
      winter: [0.85, 0.90, 1.10],
    }[G.season] || [1, 1, 1];
    gl.uniform3f(uSeasonTintLoc, ST[0], ST[1], ST[2]);
  }

  // Snow cover: full white blanket in winter, none otherwise
  if (uSnowAmountLoc) {
    gl.uniform1f(uSnowAmountLoc, G.season === 'winter' ? 1.0 : 0.0);
  }
  // Autumn foliage: shift green grass/trees to amber-orange
  if (uAutumnAmountLoc) {
    gl.uniform1f(uAutumnAmountLoc, G.season === 'autumn' ? 1.0 : 0.0);
  }
  // Day phase: 0=midnight, 0.15=dawn, 0.5=noon, 0.85=dusk, 1=midnight
  if (uDayPhaseLoc) {
    gl.uniform1f(uDayPhaseLoc, (G.dayPhase ?? 0) / (G.dayLength ?? 3600));
  }
  if (uRainAmountLoc) {
    gl.uniform1f(uRainAmountLoc, G.weather === 'rain' || G.weather === 'storm' ? 1.0 : 0.0);
  }

  // Fog center: follow camera tile position so fog fades from view center
  if (uCameraCenterLoc) {
    const halfTW2 = TW / 2, halfTH2 = TH / 2;
    const wx2 = (G.camera?.x ?? 0) / halfTW2;
    const wy2 = (G.camera?.y ?? (MAP_H * halfTH2)) / halfTH2;
    gl.uniform2f(uCameraCenterLoc, (wx2 + wy2) / 2, (wy2 - wx2) / 2);
  }

  // ── Draw terrain (includes trees) ──────────────────────────
  if (isWebGL2) {
    gl.bindVertexArray(vao);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(vao);
  } else {
    // No VAO support: re-bind attributes manually
    const STRIDE = 9 * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    const aPosLoc    = gl.getAttribLocation(program, 'aPos');
    const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
    const aColorLoc  = gl.getAttribLocation(program, 'aColor');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(aNormalLoc);
    gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);
    gl.enableVertexAttribArray(aColorLoc);
    gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);
  }

  gl.drawElements(gl.TRIANGLES, terrainIndexCount, gl.UNSIGNED_INT, 0);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
  }

  // ── Draw trees — after terrain, depth ALWAYS so they appear above their tiles ──
  if (treeIndexCount > 0) {
    if (isWebGL2) {
      gl.bindVertexArray(vao);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(vao);
    } else {
      const STRIDE = 9 * 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
      const aPosLoc2    = gl.getAttribLocation(program, 'aPos');
      const aNormalLoc2 = gl.getAttribLocation(program, 'aNormal');
      const aColorLoc2  = gl.getAttribLocation(program, 'aColor');
      gl.enableVertexAttribArray(aPosLoc2);
      gl.vertexAttribPointer(aPosLoc2,    3, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(aNormalLoc2);
      gl.vertexAttribPointer(aNormalLoc2, 3, gl.FLOAT, false, STRIDE, 3*4);
      gl.enableVertexAttribArray(aColorLoc2);
      gl.vertexAttribPointer(aColorLoc2,  3, gl.FLOAT, false, STRIDE, 6*4);
    }
    gl.depthFunc(gl.ALWAYS);
    gl.drawElements(gl.TRIANGLES, treeIndexCount, gl.UNSIGNED_INT, terrainIndexCount * 4);
    gl.depthFunc(gl.LEQUAL);
    if (isWebGL2) {
      gl.bindVertexArray(null);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(null);
    }
  }

  // ── Draw buildings ──────────────────────────────────────────
  if (buildingsIndexCount > 0) {
    if (isWebGL2) {
      gl.bindVertexArray(buildingsVao);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(buildingsVao);
    } else {
      const STRIDE = 9 * 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, buildingsVertexBuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buildingsIndexBuf);
      const aPosLoc    = gl.getAttribLocation(program, 'aPos');
      const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
      const aColorLoc  = gl.getAttribLocation(program, 'aColor');
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(aNormalLoc);
      gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);
      gl.enableVertexAttribArray(aColorLoc);
      gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);
    }

    gl.depthFunc(gl.ALWAYS);
    gl.drawElements(gl.TRIANGLES, buildingsIndexCount, gl.UNSIGNED_INT, 0);
    gl.depthFunc(gl.LEQUAL);

    if (isWebGL2) {
      gl.bindVertexArray(null);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(null);
    }
  }

  // ── Draw citizens (rebuilt every frame for smooth movement) ──
  buildCitizensMesh();
  if (citizensIndexCount > 0) {
    if (isWebGL2) {
      gl.bindVertexArray(citizensVao);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(citizensVao);
    } else {
      const STRIDE = 9 * 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, citizensVertexBuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, citizensIndexBuf);
      const aPosLoc    = gl.getAttribLocation(program, 'aPos');
      const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
      const aColorLoc  = gl.getAttribLocation(program, 'aColor');
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(aNormalLoc);
      gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);
      gl.enableVertexAttribArray(aColorLoc);
      gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);
    }
    gl.depthFunc(gl.ALWAYS);
    gl.drawElements(gl.TRIANGLES, citizensIndexCount, gl.UNSIGNED_INT, 0);
    gl.depthFunc(gl.LEQUAL);
    if (isWebGL2) {
      gl.bindVertexArray(null);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(null);
    }
  }
}

export function resize3D() {
  if (!gl) return;
  const canvas = gl.canvas;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}
