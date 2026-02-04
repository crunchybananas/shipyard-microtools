// Color Palette Generator - Pure Vanilla JS
// No dependencies, no frameworks, just pure JavaScript magic

let baseColor = '#7C3AED';
let harmony = 'analogous';
let colorCount = 5;
let includeShades = true;
let currentPalette = [];
let currentFormat = 'css';

// Color conversion utilities
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// Harmony generation
function generateHarmony(baseHex, rule, count) {
  const rgb = hexToRgb(baseHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors = [];

  switch (rule) {
    case 'monochromatic':
      for (let i = 0; i < count; i++) {
        const newL = Math.max(10, Math.min(90, hsl.l + (i - Math.floor(count/2)) * 15));
        const newRgb = hslToRgb(hsl.h, hsl.s, newL);
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;

    case 'complementary':
      colors.push(baseHex);
      const compHue = (hsl.h + 180) % 360;
      const compRgb = hslToRgb(compHue, hsl.s, hsl.l);
      colors.push(rgbToHex(compRgb.r, compRgb.g, compRgb.b));
      // Fill with variations
      for (let i = 2; i < count; i++) {
        const useComp = i % 2 === 0;
        const h = useComp ? compHue : hsl.h;
        const newL = hsl.l + (i - count/2) * 10;
        const newRgb = hslToRgb(h, hsl.s, Math.max(10, Math.min(90, newL)));
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;

    case 'analogous':
      const angleStep = 30;
      for (let i = 0; i < count; i++) {
        const offset = (i - Math.floor(count/2)) * angleStep;
        const newH = (hsl.h + offset + 360) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;

    case 'triadic':
      for (let i = 0; i < count; i++) {
        const angle = (i * 120) % 360;
        const newH = (hsl.h + angle) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;

    case 'tetradic':
      for (let i = 0; i < count; i++) {
        const angle = (i * 90) % 360;
        const newH = (hsl.h + angle) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;

    case 'split-complementary':
      colors.push(baseHex);
      const splitHue1 = (hsl.h + 150) % 360;
      const splitHue2 = (hsl.h + 210) % 360;
      const split1 = hslToRgb(splitHue1, hsl.s, hsl.l);
      const split2 = hslToRgb(splitHue2, hsl.s, hsl.l);
      colors.push(rgbToHex(split1.r, split1.g, split1.b));
      colors.push(rgbToHex(split2.r, split2.g, split2.b));
      // Fill remaining
      for (let i = 3; i < count; i++) {
        const h = [hsl.h, splitHue1, splitHue2][i % 3];
        const newL = hsl.l + (i - count/2) * 8;
        const newRgb = hslToRgb(h, hsl.s, Math.max(10, Math.min(90, newL)));
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;
  }

  return colors.slice(0, count);
}

// Generate shades and tints
function generateShades(hex) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const shades = [];
  
  for (let i = 0; i < 5; i++) {
    const lightness = 20 + (i * 20);
    const newRgb = hslToRgb(hsl.h, hsl.s, lightness);
    shades.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }
  
  return shades;
}

// Calculate contrast ratio for accessibility
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Render palette
function renderPalette() {
  const palette = document.getElementById('palette');
  palette.innerHTML = '';
  
  currentPalette.forEach((color, index) => {
    const card = document.createElement('div');
    card.className = 'color-card';
    
    const rgb = hexToRgb(color);
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    
    const info = document.createElement('div');
    info.className = 'color-info';
    info.innerHTML = `
      <div class="color-hex">${color.toUpperCase()}</div>
      <div class="color-rgb">RGB(${rgb.r}, ${rgb.g}, ${rgb.b})</div>
    `;
    
    card.appendChild(swatch);
    card.appendChild(info);
    
    if (includeShades) {
      const shadeRow = document.createElement('div');
      shadeRow.className = 'shade-row';
      const shades = generateShades(color);
      shades.forEach(shade => {
        const shadeSwatch = document.createElement('div');
        shadeSwatch.className = 'shade-swatch';
        shadeSwatch.style.backgroundColor = shade;
        shadeSwatch.title = shade;
        shadeSwatch.onclick = () => copyToClipboard(shade);
        shadeRow.appendChild(shadeSwatch);
      });
      info.appendChild(shadeRow);
    }
    
    card.onclick = () => copyToClipboard(color);
    palette.appendChild(card);
  });
  
  renderAccessibility();
  renderExport();
}

// Render accessibility checks
function renderAccessibility() {
  const grid = document.getElementById('a11yGrid');
  grid.innerHTML = '';
  
  // Check first few color combinations
  const checks = Math.min(6, currentPalette.length * (currentPalette.length - 1) / 2);
  let count = 0;
  
  for (let i = 0; i < currentPalette.length && count < checks; i++) {
    for (let j = i + 1; j < currentPalette.length && count < checks; j++) {
      const ratio = getContrastRatio(currentPalette[i], currentPalette[j]);
      const card = document.createElement('div');
      card.className = 'a11y-card';
      
      const passAA = ratio >= 4.5;
      const passAAA = ratio >= 7;
      
      card.innerHTML = `
        <div class="a11y-colors">
          <div class="a11y-swatch" style="background: ${currentPalette[i]}"></div>
          <div class="a11y-swatch" style="background: ${currentPalette[j]}"></div>
        </div>
        <div class="a11y-ratio">${ratio.toFixed(2)}:1</div>
        <div class="a11y-badges">
          <span class="badge ${passAA ? 'pass' : 'fail'}">${passAA ? '✓' : '✗'} WCAG AA</span>
          <span class="badge ${passAAA ? 'pass' : 'fail'}">${passAAA ? '✓' : '✗'} WCAG AAA</span>
        </div>
      `;
      
      grid.appendChild(card);
      count++;
    }
  }
}

// Export formats
function renderExport() {
  const output = document.getElementById('exportOutput');
  let content = '';
  
  switch (currentFormat) {
    case 'css':
      content = ':root {\n';
      currentPalette.forEach((color, i) => {
        content += `  --color-${i + 1}: ${color};\n`;
      });
      content += '}';
      break;
      
    case 'scss':
      currentPalette.forEach((color, i) => {
        content += `$color-${i + 1}: ${color};\n`;
      });
      break;
      
    case 'tailwind':
      content = 'module.exports = {\n  theme: {\n    extend: {\n      colors: {\n';
      currentPalette.forEach((color, i) => {
        content += `        'palette-${i + 1}': '${color}',\n`;
      });
      content += '      }\n    }\n  }\n}';
      break;
      
    case 'json':
      const palette = {};
      currentPalette.forEach((color, i) => {
        palette[`color${i + 1}`] = color;
      });
      content = JSON.stringify(palette, null, 2);
      break;
  }
  
  output.textContent = content;
}

// Utilities
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${text}`);
  });
}

function showToast(message) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: #1f2937;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const baseColorInput = document.getElementById('baseColor');
  const baseColorHex = document.getElementById('baseColorHex');
  const harmonySelect = document.getElementById('harmony');
  const countRange = document.getElementById('count');
  const countValue = document.getElementById('countValue');
  const includeShadesCheckbox = document.getElementById('includeShades');
  const generateBtn = document.getElementById('generate');
  const exportBtn = document.getElementById('export');
  const copyExportBtn = document.getElementById('copyExport');
  const tabs = document.querySelectorAll('.tab');
  
  // Sync color inputs
  baseColorInput.addEventListener('input', (e) => {
    baseColor = e.target.value;
    baseColorHex.value = baseColor.toUpperCase();
    renderPalette();
  });
  
  baseColorHex.addEventListener('input', (e) => {
    const hex = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      baseColor = hex;
      baseColorInput.value = hex;
      renderPalette();
    }
  });
  
  harmonySelect.addEventListener('change', (e) => {
    harmony = e.target.value;
    currentPalette = generateHarmony(baseColor, harmony, colorCount);
    renderPalette();
  });
  
  countRange.addEventListener('input', (e) => {
    colorCount = parseInt(e.target.value);
    countValue.textContent = colorCount;
    currentPalette = generateHarmony(baseColor, harmony, colorCount);
    renderPalette();
  });
  
  includeShadesCheckbox.addEventListener('change', (e) => {
    includeShades = e.target.checked;
    renderPalette();
  });
  
  generateBtn.addEventListener('click', () => {
    // Generate random base color
    baseColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    baseColorInput.value = baseColor;
    baseColorHex.value = baseColor.toUpperCase();
    currentPalette = generateHarmony(baseColor, harmony, colorCount);
    renderPalette();
  });
  
  exportBtn.addEventListener('click', () => {
    document.querySelector('.export-formats').scrollIntoView({ behavior: 'smooth' });
  });
  
  copyExportBtn.addEventListener('click', () => {
    const content = document.getElementById('exportOutput').textContent;
    copyToClipboard(content);
  });
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFormat = tab.dataset.format;
      renderExport();
    });
  });
  
  // Initial generation
  currentPalette = generateHarmony(baseColor, harmony, colorCount);
  renderPalette();
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
