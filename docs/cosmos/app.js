// ============================================
// COSMOS - Procedural Universe Explorer
// ============================================

// Seeded Random Number Generator
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
  
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  
  weighted(arr, weightFn) {
    const totalWeight = arr.reduce((sum, item) => sum + weightFn(item), 0);
    let r = this.next() * totalWeight;
    for (const item of arr) {
      r -= weightFn(item);
      if (r <= 0) return item;
    }
    return arr[arr.length - 1];
  }
}

// Hash function for coordinates
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getSeed(x, y, scale = 0) {
  return hashCode(`${Math.floor(x)},${Math.floor(y)},${scale}`);
}

// ============================================
// STAR DATA
// ============================================

const SPECTRAL_CLASSES = [
  { class: 'O', temp: 30000, color: '#9bb0ff', rarity: 0.00003, radius: 10 },
  { class: 'B', temp: 20000, color: '#aabfff', rarity: 0.001, radius: 6 },
  { class: 'A', temp: 8500,  color: '#cad7ff', rarity: 0.006, radius: 2.5 },
  { class: 'F', temp: 6500,  color: '#f8f7ff', rarity: 0.03, radius: 1.5 },
  { class: 'G', temp: 5500,  color: '#fff4ea', rarity: 0.076, radius: 1.0 },
  { class: 'K', temp: 4000,  color: '#ffd2a1', rarity: 0.121, radius: 0.8 },
  { class: 'M', temp: 3000,  color: '#ffcc6f', rarity: 0.765, radius: 0.5 }
];

const PLANET_TYPES = [
  { type: 'gas_giant', colors: ['#c4a77d', '#8b7355', '#d4a574', '#b8860b'], minSize: 8, maxSize: 14 },
  { type: 'ice_giant', colors: ['#a8d8ea', '#87ceeb', '#b0e0e6', '#4682b4'], minSize: 5, maxSize: 9 },
  { type: 'rocky', colors: ['#8b7355', '#a0522d', '#696969', '#808080'], minSize: 0.4, maxSize: 1.5 },
  { type: 'ocean', colors: ['#1e90ff', '#4169e1', '#006994', '#0077be'], minSize: 0.6, maxSize: 1.8 },
  { type: 'lava', colors: ['#ff4500', '#dc143c', '#8b0000', '#ff6347'], minSize: 0.3, maxSize: 1.0 },
  { type: 'earth_like', colors: ['#228b22', '#4169e1', '#f4a460', '#90ee90'], minSize: 0.8, maxSize: 1.4 },
  { type: 'ice', colors: ['#f0f8ff', '#e0ffff', '#b0c4de', '#add8e6'], minSize: 0.4, maxSize: 1.2 },
  { type: 'desert', colors: ['#deb887', '#d2691e', '#f4a460', '#cd853f'], minSize: 0.5, maxSize: 1.3 }
];

const GALAXY_TYPES = ['spiral', 'elliptical', 'irregular', 'barred_spiral'];

// Name generation
const PREFIXES = ['Al', 'Be', 'Cy', 'De', 'El', 'Fa', 'Ga', 'He', 'Io', 'Ja', 'Ka', 'Lo', 'Ma', 'Ne', 'Or', 'Pa', 'Qu', 'Ra', 'Sa', 'Ta', 'Ul', 'Ve', 'Wa', 'Xe', 'Yo', 'Za'];
const MIDDLES = ['pha', 'tar', 'rix', 'don', 'nar', 'ven', 'kor', 'mel', 'sar', 'thi', 'ron', 'dan', 'lex', 'mar', 'nis', 'por', 'qui', 'rel', 'sol', 'tel'];
const SUFFIXES = ['is', 'us', 'a', 'on', 'ar', 'ix', 'or', 'ia', 'um', 'es', 'i', 'ae', 'os', 'an', 'en'];

function generateName(seed) {
  const rng = new SeededRandom(seed);
  
  if (rng.next() > 0.7) {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const l1 = letters[Math.floor(rng.next() * letters.length)];
    const l2 = letters[Math.floor(rng.next() * letters.length)];
    const num = Math.floor(rng.range(100, 9999));
    return `${l1}${l2}-${num}`;
  }
  
  return rng.pick(PREFIXES) + rng.pick(MIDDLES) + rng.pick(SUFFIXES);
}

// ============================================
// SCALE DEFINITIONS
// ============================================

const SCALES = {
  UNIVERSE: { name: 'Universe', minZoom: 0.5, maxZoom: 5 },
  CLUSTER: { name: 'Galaxy Cluster', minZoom: 5, maxZoom: 50 },
  GALAXY: { name: 'Galaxy', minZoom: 50, maxZoom: 500 },
  SECTOR: { name: 'Sector', minZoom: 500, maxZoom: 5000 },
  SYSTEM: { name: 'Star System', minZoom: 5000, maxZoom: 50000 },
  PLANET: { name: 'Planet', minZoom: 50000, maxZoom: 500000 }
};

function getCurrentScale(zoom) {
  if (zoom < 5) return SCALES.UNIVERSE;
  if (zoom < 50) return SCALES.CLUSTER;
  if (zoom < 500) return SCALES.GALAXY;
  if (zoom < 5000) return SCALES.SECTOR;
  if (zoom < 50000) return SCALES.SYSTEM;
  return SCALES.PLANET;
}

// ============================================
// GENERATION FUNCTIONS
// ============================================

function generateGalaxy(seed) {
  const rng = new SeededRandom(seed);
  const type = rng.pick(GALAXY_TYPES);
  
  return {
    seed,
    name: generateName(seed),
    type,
    arms: type.includes('spiral') ? rng.int(2, 5) : 0,
    size: rng.range(0.6, 1.5),
    rotation: rng.range(0, Math.PI * 2),
    tilt: rng.range(0.2, 0.8),
    coreColor: `hsl(${rng.range(30, 60)}, ${rng.range(50, 80)}%, ${rng.range(70, 90)}%)`,
    armColor: `hsl(${rng.range(200, 280)}, ${rng.range(30, 60)}%, ${rng.range(60, 80)}%)`,
    starCount: Math.floor(rng.range(200, 800))
  };
}

function generateStar(seed) {
  const rng = new SeededRandom(seed);
  const spectral = rng.weighted(SPECTRAL_CLASSES, s => s.rarity);
  
  return {
    seed,
    name: generateName(seed),
    spectralClass: spectral.class,
    temperature: spectral.temp + rng.range(-500, 500),
    color: spectral.color,
    radius: spectral.radius * rng.range(0.8, 1.3),
    luminosity: spectral.radius * spectral.radius,
    planets: rng.int(0, 8)
  };
}

function generatePlanet(seed, orbitIndex, star) {
  const rng = new SeededRandom(seed);
  
  // Inner planets more likely rocky, outer more likely gas giants
  let typeOptions;
  if (orbitIndex < 2) {
    typeOptions = PLANET_TYPES.filter(t => ['rocky', 'lava', 'desert'].includes(t.type));
  } else if (orbitIndex < 4) {
    typeOptions = PLANET_TYPES.filter(t => ['rocky', 'ocean', 'earth_like', 'desert'].includes(t.type));
  } else {
    typeOptions = PLANET_TYPES.filter(t => ['gas_giant', 'ice_giant', 'ice'].includes(t.type));
  }
  
  const planetType = rng.pick(typeOptions);
  const baseColor = rng.pick(planetType.colors);
  
  return {
    seed,
    name: generateName(seed),
    type: planetType.type,
    radius: rng.range(planetType.minSize, planetType.maxSize),
    orbitRadius: 80 + orbitIndex * 60 + rng.range(-10, 10),
    orbitSpeed: 0.0002 / (orbitIndex + 1),
    orbitOffset: rng.range(0, Math.PI * 2),
    color: baseColor,
    hasRings: planetType.type === 'gas_giant' && rng.next() > 0.6,
    ringColor: `hsla(${rng.range(30, 60)}, 40%, 70%, 0.5)`,
    moons: planetType.type === 'gas_giant' ? rng.int(1, 6) : rng.int(0, 2),
    atmosphere: ['ocean', 'earth_like', 'gas_giant', 'ice_giant'].includes(planetType.type),
    atmosphereColor: `hsla(${rng.range(180, 240)}, 50%, 70%, 0.2)`
  };
}

// ============================================
// CAMERA & STATE
// ============================================

const canvas = document.getElementById('cosmos');
const ctx = canvas.getContext('2d');

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
  targetZoom: 1,
  targetX: 0,
  targetY: 0
};

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let time = 0;

// Cached objects
let cachedGalaxies = [];
let cachedStars = [];
let cachedSystem = null;
let hoveredObject = null;
let selectedObject = null;

// ============================================
// RENDERING
// ============================================

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - canvas.width / 2) / camera.zoom + camera.x,
    y: (sy - canvas.height / 2) / camera.zoom + camera.y
  };
}

function worldToScreen(wx, wy) {
  return {
    x: (wx - camera.x) * camera.zoom + canvas.width / 2,
    y: (wy - camera.y) * camera.zoom + canvas.height / 2
  };
}

function drawBackground() {
  // Deep space gradient
  const gradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
  );
  gradient.addColorStop(0, '#0a0a1a');
  gradient.addColorStop(0.5, '#050510');
  gradient.addColorStop(1, '#000005');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Background stars (fixed, not affected by camera)
  const bgRng = new SeededRandom(12345);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (let i = 0; i < 200; i++) {
    const x = bgRng.next() * canvas.width;
    const y = bgRng.next() * canvas.height;
    const size = bgRng.range(0.5, 1.5);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGalaxy(galaxy, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(galaxy.rotation);
  ctx.scale(1, galaxy.tilt);
  
  const rng = new SeededRandom(galaxy.seed);
  
  if (galaxy.type === 'spiral' || galaxy.type === 'barred_spiral') {
    // Draw spiral arms
    for (let arm = 0; arm < galaxy.arms; arm++) {
      const armAngle = (arm / galaxy.arms) * Math.PI * 2;
      
      for (let i = 0; i < galaxy.starCount / galaxy.arms; i++) {
        const t = i / (galaxy.starCount / galaxy.arms);
        const distance = t * size;
        const spread = rng.range(-size * 0.15, size * 0.15);
        const angle = armAngle + t * 3 + spread * 0.01;
        
        const px = Math.cos(angle) * distance + rng.range(-5, 5);
        const py = Math.sin(angle) * distance + rng.range(-5, 5);
        
        const brightness = (1 - t * 0.7) * rng.range(0.3, 1);
        const starSize = rng.range(0.5, 2) * (1 - t * 0.5);
        
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
        ctx.beginPath();
        ctx.arc(px, py, starSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (galaxy.type === 'elliptical') {
    // Elliptical galaxy - concentrated toward center
    for (let i = 0; i < galaxy.starCount; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(0, 1) * rng.range(0, 1) * size;
      const px = Math.cos(angle) * dist * 1.5;
      const py = Math.sin(angle) * dist;
      
      const brightness = (1 - dist / size) * rng.range(0.3, 1);
      ctx.fillStyle = `rgba(255, 220, 180, ${brightness * 0.5})`;
      ctx.beginPath();
      ctx.arc(px, py, rng.range(0.5, 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Irregular galaxy
    for (let i = 0; i < galaxy.starCount; i++) {
      const px = rng.range(-size, size) * rng.range(0.3, 1);
      const py = rng.range(-size * 0.6, size * 0.6) * rng.range(0.3, 1);
      
      const brightness = rng.range(0.2, 0.8);
      ctx.fillStyle = `rgba(200, 220, 255, ${brightness * 0.5})`;
      ctx.beginPath();
      ctx.arc(px, py, rng.range(0.5, 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Bright core
  const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.25);
  coreGradient.addColorStop(0, 'rgba(255, 255, 220, 0.8)');
  coreGradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.3)');
  coreGradient.addColorStop(1, 'rgba(255, 230, 180, 0)');
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawStar(star, x, y, size) {
  // Glow
  const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
  glowGradient.addColorStop(0, star.color);
  glowGradient.addColorStop(0.3, star.color + '80');
  glowGradient.addColorStop(1, star.color + '00');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, size * 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Core
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Main body
  const bodyGradient = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
  bodyGradient.addColorStop(0, '#fff');
  bodyGradient.addColorStop(0.5, star.color);
  bodyGradient.addColorStop(1, star.color + 'cc');
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlanet(planet, x, y, size, showDetail = false) {
  ctx.save();
  
  // Atmosphere glow
  if (planet.atmosphere && showDetail) {
    const atmosGradient = ctx.createRadialGradient(x, y, size * 0.9, x, y, size * 1.3);
    atmosGradient.addColorStop(0, planet.atmosphereColor);
    atmosGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = atmosGradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Rings (behind planet)
  if (planet.hasRings) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.3);
    ctx.strokeStyle = planet.ringColor;
    ctx.lineWidth = size * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.8, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  
  // Planet body
  const planetGradient = ctx.createRadialGradient(x - size * 0.3, y - size * 0.3, 0, x, y, size);
  planetGradient.addColorStop(0, lightenColor(planet.color, 30));
  planetGradient.addColorStop(0.7, planet.color);
  planetGradient.addColorStop(1, darkenColor(planet.color, 30));
  ctx.fillStyle = planetGradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  
  // Surface features for detailed view
  if (showDetail && size > 20) {
    const rng = new SeededRandom(planet.seed);
    ctx.globalAlpha = 0.3;
    
    if (planet.type === 'gas_giant' || planet.type === 'ice_giant') {
      // Bands
      for (let i = 0; i < 5; i++) {
        const bandY = y - size + (i + 0.5) * (size * 2 / 5);
        ctx.fillStyle = i % 2 === 0 ? darkenColor(planet.color, 15) : lightenColor(planet.color, 10);
        ctx.beginPath();
        ctx.ellipse(x, bandY, size * Math.cos(Math.asin((bandY - y) / size)) || size * 0.1, size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (planet.type === 'earth_like' || planet.type === 'ocean') {
      // Continents / clouds
      for (let i = 0; i < 8; i++) {
        const cx = x + rng.range(-size * 0.6, size * 0.6);
        const cy = y + rng.range(-size * 0.6, size * 0.6);
        const cr = rng.range(size * 0.1, size * 0.3);
        
        if (Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) + cr < size) {
          ctx.fillStyle = planet.type === 'ocean' ? '#fff' : '#228b22';
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    ctx.globalAlpha = 1;
  }
  
  // Rings (in front of planet)
  if (planet.hasRings) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.3);
    ctx.strokeStyle = planet.ringColor;
    ctx.lineWidth = size * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.8, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  
  // Shadow
  const shadowGradient = ctx.createLinearGradient(x - size, y, x + size, y);
  shadowGradient.addColorStop(0, 'transparent');
  shadowGradient.addColorStop(0.5, 'transparent');
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = shadowGradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}

function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return `rgb(${R}, ${G}, ${B})`;
}

// ============================================
// MAIN RENDER LOOP
// ============================================

function render() {
  // Smooth camera
  camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;
  camera.x += (camera.targetX - camera.x) * 0.1;
  camera.y += (camera.targetY - camera.y) * 0.1;
  
  time += 0.016;
  
  drawBackground();
  
  const scale = getCurrentScale(camera.zoom);
  
  // Calculate visible area
  const viewWidth = canvas.width / camera.zoom;
  const viewHeight = canvas.height / camera.zoom;
  const left = camera.x - viewWidth / 2;
  const right = camera.x + viewWidth / 2;
  const top = camera.y - viewHeight / 2;
  const bottom = camera.y + viewHeight / 2;
  
  if (camera.zoom < 50) {
    // Universe/Cluster scale - draw galaxies
    renderGalaxies(left, right, top, bottom);
  } else if (camera.zoom < 5000) {
    // Galaxy/Sector scale - draw stars
    renderStars(left, right, top, bottom);
  } else {
    // System/Planet scale - draw solar system
    renderSystem();
  }
  
  // Update UI
  updateUI(scale);
  
  requestAnimationFrame(render);
}

function renderGalaxies(left, right, top, bottom) {
  const gridSize = 200;
  const startX = Math.floor(left / gridSize) * gridSize;
  const startY = Math.floor(top / gridSize) * gridSize;
  
  cachedGalaxies = [];
  
  for (let x = startX; x < right + gridSize; x += gridSize) {
    for (let y = startY; y < bottom + gridSize; y += gridSize) {
      const seed = getSeed(x, y, 0);
      const rng = new SeededRandom(seed);
      
      // Not every cell has a galaxy
      if (rng.next() > 0.4) continue;
      
      const galaxy = generateGalaxy(seed);
      const gx = x + rng.range(20, gridSize - 20);
      const gy = y + rng.range(20, gridSize - 20);
      
      const screen = worldToScreen(gx, gy);
      const size = 30 * galaxy.size * camera.zoom;
      
      if (screen.x > -size && screen.x < canvas.width + size &&
          screen.y > -size && screen.y < canvas.height + size) {
        
        drawGalaxy(galaxy, screen.x, screen.y, size);
        
        // Store for hover detection
        cachedGalaxies.push({
          ...galaxy,
          worldX: gx,
          worldY: gy,
          screenX: screen.x,
          screenY: screen.y,
          screenSize: size
        });
        
        // Draw name at cluster level
        if (camera.zoom > 10 && size > 40) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '12px SF Pro Display, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(galaxy.name, screen.x, screen.y + size + 20);
        }
      }
    }
  }
}

function renderStars(left, right, top, bottom) {
  const gridSize = 50;
  const startX = Math.floor(left / gridSize) * gridSize;
  const startY = Math.floor(top / gridSize) * gridSize;
  
  cachedStars = [];
  
  for (let x = startX; x < right + gridSize; x += gridSize) {
    for (let y = startY; y < bottom + gridSize; y += gridSize) {
      const seed = getSeed(x, y, 1);
      const rng = new SeededRandom(seed);
      
      if (rng.next() > 0.3) continue;
      
      const star = generateStar(seed);
      const sx = x + rng.range(5, gridSize - 5);
      const sy = y + rng.range(5, gridSize - 5);
      
      const screen = worldToScreen(sx, sy);
      const baseSize = 2 + star.radius * 2;
      const size = baseSize * (camera.zoom / 100);
      
      if (screen.x > -size * 3 && screen.x < canvas.width + size * 3 &&
          screen.y > -size * 3 && screen.y < canvas.height + size * 3) {
        
        drawStar(star, screen.x, screen.y, Math.max(1, size));
        
        cachedStars.push({
          ...star,
          worldX: sx,
          worldY: sy,
          screenX: screen.x,
          screenY: screen.y,
          screenSize: size
        });
        
        // Draw name at sector level
        if (camera.zoom > 1000 && size > 3) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.font = '11px SF Pro Display, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(star.name, screen.x, screen.y + size * 3 + 15);
        }
      }
    }
  }
}

function renderSystem() {
  // Find the closest star to focus on
  if (!cachedSystem || cachedStars.length === 0) {
    // Generate a system based on camera position
    const seed = getSeed(Math.floor(camera.x / 50), Math.floor(camera.y / 50), 1);
    const star = generateStar(seed);
    
    // Generate planets
    const planets = [];
    const planetRng = new SeededRandom(seed + 1000);
    for (let i = 0; i < star.planets; i++) {
      planets.push(generatePlanet(seed + i + 100, i, star));
    }
    
    cachedSystem = { star, planets };
  }
  
  const { star, planets } = cachedSystem;
  
  // Draw star in center
  const starScreen = worldToScreen(camera.x, camera.y);
  const starSize = 40 * (camera.zoom / 10000);
  
  // Star glow
  const glowGradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, starSize * 5
  );
  glowGradient.addColorStop(0, star.color);
  glowGradient.addColorStop(0.2, star.color + '60');
  glowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  drawStar(star, canvas.width / 2, canvas.height / 2, starSize);
  
  // Draw planets
  planets.forEach((planet, i) => {
    const orbitScale = camera.zoom / 5000;
    const orbitRadius = planet.orbitRadius * orbitScale;
    
    // Draw orbit path
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Calculate planet position
    const angle = planet.orbitOffset + time * planet.orbitSpeed * 100;
    const px = canvas.width / 2 + Math.cos(angle) * orbitRadius;
    const py = canvas.height / 2 + Math.sin(angle) * orbitRadius;
    
    const planetSize = Math.max(3, planet.radius * 3 * orbitScale);
    
    drawPlanet(planet, px, py, planetSize, camera.zoom > 20000);
    
    // Planet label
    if (planetSize > 5) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '11px SF Pro Display, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(planet.name, px, py + planetSize + 15);
    }
  });
  
  // Star label
  ctx.fillStyle = '#fff';
  ctx.font = '14px SF Pro Display, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(star.name, canvas.width / 2, canvas.height / 2 + starSize + 25);
  ctx.font = '11px SF Pro Display, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`${star.spectralClass}-type • ${star.temperature}K`, canvas.width / 2, canvas.height / 2 + starSize + 42);
}

function updateUI(scale) {
  // Scale name
  document.getElementById('scale-name').textContent = scale.name;
  
  // Coordinates
  const coordsDisplay = document.getElementById('coords-display');
  coordsDisplay.textContent = `${camera.x.toFixed(2)}, ${camera.y.toFixed(2)} @ ${camera.zoom.toFixed(1)}x`;
  
  // Zoom bar
  const minZoom = Math.log10(0.5);
  const maxZoom = Math.log10(500000);
  const currentZoom = Math.log10(camera.zoom);
  const zoomPercent = ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100;
  document.getElementById('zoom-fill').style.width = `${zoomPercent}%`;
  
  // Location info
  const locationInfo = document.getElementById('location-info');
  const objectInfo = document.getElementById('object-info');
  
  if (selectedObject) {
    locationInfo.innerHTML = `
      <div class="info-title">${selectedObject.name}</div>
      <div class="info-subtitle">${getObjectDescription(selectedObject)}</div>
    `;
  } else {
    locationInfo.innerHTML = `
      <div class="info-title">Exploring the ${scale.name}</div>
      <div class="info-subtitle">Scroll to zoom • Drag to pan • Click to focus</div>
    `;
  }
}

function getObjectDescription(obj) {
  if (obj.type && GALAXY_TYPES.includes(obj.type)) {
    const typeName = obj.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${typeName} Galaxy • ${obj.arms ? obj.arms + ' arms' : 'Ancient structure'}`;
  }
  if (obj.spectralClass) {
    return `${obj.spectralClass}-type Star • ${obj.temperature}K • ${obj.planets} planets`;
  }
  if (obj.orbitRadius) {
    const typeName = obj.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${typeName} • ${obj.moons} moon${obj.moons !== 1 ? 's' : ''}${obj.hasRings ? ' • Ringed' : ''}`;
  }
  return '';
}

// ============================================
// INPUT HANDLING
// ============================================

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  
  const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
  camera.targetZoom = Math.max(0.5, Math.min(500000, camera.targetZoom * zoomFactor));
  
  // Clear cached system when zooming out
  if (camera.targetZoom < 5000) {
    cachedSystem = null;
  }
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = (e.clientX - lastMouseX) / camera.zoom;
    const dy = (e.clientY - lastMouseY) / camera.zoom;
    camera.targetX -= dx;
    camera.targetY -= dy;
    camera.x = camera.targetX;
    camera.y = camera.targetY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
  canvas.style.cursor = 'grab';
});

canvas.addEventListener('mouseleave', () => {
  isDragging = false;
  canvas.style.cursor = 'grab';
});

canvas.addEventListener('click', (e) => {
  if (isDragging) return;
  
  const mx = e.clientX;
  const my = e.clientY;
  
  // Check galaxies
  for (const galaxy of cachedGalaxies) {
    const dist = Math.sqrt((mx - galaxy.screenX) ** 2 + (my - galaxy.screenY) ** 2);
    if (dist < galaxy.screenSize) {
      focusOn(galaxy.worldX, galaxy.worldY, camera.zoom * 3);
      selectedObject = galaxy;
      return;
    }
  }
  
  // Check stars
  for (const star of cachedStars) {
    const dist = Math.sqrt((mx - star.screenX) ** 2 + (my - star.screenY) ** 2);
    if (dist < Math.max(star.screenSize * 3, 20)) {
      focusOn(star.worldX, star.worldY, camera.zoom * 3);
      selectedObject = star;
      return;
    }
  }
});

function focusOn(x, y, zoom) {
  camera.targetX = x;
  camera.targetY = y;
  camera.targetZoom = Math.min(500000, zoom);
  cachedSystem = null;
}

// ============================================
// BOOKMARKS
// ============================================

function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem('cosmos_bookmarks') || '[]');
  } catch {
    return [];
  }
}

function saveBookmark() {
  const bookmarks = getBookmarks();
  const name = selectedObject?.name || `Location ${bookmarks.length + 1}`;
  
  bookmarks.push({
    id: Date.now(),
    name,
    x: camera.x,
    y: camera.y,
    zoom: camera.zoom,
    timestamp: new Date().toISOString()
  });
  
  localStorage.setItem('cosmos_bookmarks', JSON.stringify(bookmarks));
  showToast(`Bookmarked: ${name}`);
}

function showBookmarks() {
  const modal = document.getElementById('bookmarks-modal');
  const list = document.getElementById('bookmarks-list');
  const bookmarks = getBookmarks();
  
  if (bookmarks.length === 0) {
    list.innerHTML = '<div class="empty-bookmarks">No bookmarks yet. Click ☆ to save a location.</div>';
  } else {
    list.innerHTML = bookmarks.map(b => `
      <div class="bookmark-item" data-id="${b.id}">
        <div>
          <div class="bookmark-name">${b.name}</div>
          <div class="bookmark-coords">${b.x.toFixed(2)}, ${b.y.toFixed(2)} @ ${b.zoom.toFixed(1)}x</div>
        </div>
        <button class="bookmark-delete" data-id="${b.id}">×</button>
      </div>
    `).join('');
    
    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-delete')) {
          e.stopPropagation();
          deleteBookmark(parseInt(e.target.dataset.id));
          return;
        }
        
        const id = parseInt(item.dataset.id);
        const bookmark = bookmarks.find(b => b.id === id);
        if (bookmark) {
          camera.targetX = bookmark.x;
          camera.targetY = bookmark.y;
          camera.targetZoom = bookmark.zoom;
          cachedSystem = null;
          modal.classList.add('hidden');
        }
      });
    });
  }
  
  modal.classList.remove('hidden');
}

function deleteBookmark(id) {
  const bookmarks = getBookmarks().filter(b => b.id !== id);
  localStorage.setItem('cosmos_bookmarks', JSON.stringify(bookmarks));
  showBookmarks();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

// ============================================
// INITIALIZATION
// ============================================

document.getElementById('bookmarkBtn').addEventListener('click', saveBookmark);
document.getElementById('bookmarksBtn').addEventListener('click', showBookmarks);
document.getElementById('bookmarks-modal').querySelector('.close-btn').addEventListener('click', () => {
  document.getElementById('bookmarks-modal').classList.add('hidden');
});
document.getElementById('copyCoords').addEventListener('click', () => {
  const coords = `${camera.x.toFixed(4)},${camera.y.toFixed(4)},${camera.zoom.toFixed(2)}`;
  navigator.clipboard.writeText(coords);
  showToast('Coordinates copied!');
});

// Check for shared coordinates in URL
const params = new URLSearchParams(window.location.search);
if (params.has('coords')) {
  const [x, y, z] = params.get('coords').split(',').map(Number);
  if (!isNaN(x) && !isNaN(y)) {
    camera.x = camera.targetX = x;
    camera.y = camera.targetY = y;
    if (!isNaN(z)) camera.zoom = camera.targetZoom = z;
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
render();
