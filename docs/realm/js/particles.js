// ════════════════════════════════════════════════════════════
// Particles — floating resource numbers, smoke, sparkles
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

export function updateParticles() {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.offsetY += p.vy;
    p.alpha -= p.decay || 0.012;
    if (p.type === 'smoke') {
      p.tx += (Math.sin(G.gameTick * 0.01 + p.tx) * 0.002);
      p.size = (p.size || 2) + 0.015;
    }
    if (p.type === 'dust') {
      p.tx += (p.vx || 0) * 0.02;
      p.size = (p.size || 2) * 0.995;
    }
    if (p.type === 'petal') {
      p.tx += (p.vx || 0) * 0.5 + Math.sin(G.gameTick * 0.015 + p.tx) * 0.003;
      p.size = (p.size || 2) * 0.999;
    }
    if (p.type === 'leaf') {
      p.tx += (p.vx || 0) * 0.5 + Math.sin(G.gameTick * 0.01 + p.tx * 2) * 0.004;
      p.rotation = (p.rotation || 0) + 0.03;
    }
    if (p.alpha <= 0) G.particles.splice(i, 1);
  }
}

export function spawnParticle(tx, ty, text) {
  G.particles.push({ tx, ty, offsetY: 0, text, alpha: 1.5, vy: -0.4, type: 'text' });
}

export function spawnSmoke(tx, ty) {
  G.particles.push({
    tx: tx + (Math.random() - 0.5) * 0.1,
    ty: ty + (Math.random() - 0.5) * 0.1,
    offsetY: -30 - Math.random() * 5,
    text: null,
    alpha: 0.35 + Math.random() * 0.15,
    vy: -0.15 - Math.random() * 0.1,
    decay: 0.003 + Math.random() * 0.002,
    type: 'smoke',
    size: 1.5 + Math.random(),
  });
}

export function spawnDust(tx, ty) {
  for (let i = 0; i < 8; i++) {
    G.particles.push({
      tx: tx + (Math.random() - 0.5) * 0.6,
      ty: ty + (Math.random() - 0.5) * 0.6,
      offsetY: -5 - Math.random() * 10,
      text: null,
      alpha: 0.5 + Math.random() * 0.3,
      vy: -0.2 - Math.random() * 0.15,
      decay: 0.008 + Math.random() * 0.005,
      type: 'dust',
      size: 1.5 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.3,
    });
  }
}

export function updateSmokeEmitters() {
  if (G.gameTick % 8 !== 0) return;
  for (const b of G.buildings) {
    if (b.type === 'house' || b.type === 'tavern' || b.type === 'lumber') {
      if (G.particles.length < 200) spawnSmoke(b.x, b.y);
    }
  }
  // Snowflakes in winter
  if (G.season === 'winter' && G.gameTick % 4 === 0 && G.particles.length < 250) {
    const cx = G.camera.x / 32, cy = G.camera.y / 16;
    G.particles.push({
      tx: cx + (Math.random() - 0.5) * 20,
      ty: cy + (Math.random() - 0.5) * 15,
      offsetY: -60 - Math.random() * 20,
      text: null,
      alpha: 0.4 + Math.random() * 0.3,
      vy: 0.15 + Math.random() * 0.1,
      decay: 0.002,
      type: 'snow',
      size: 1 + Math.random() * 1.5,
    });
  }

  // Spring flower petals floating in the wind
  if (G.season === 'spring' && G.gameTick % 12 === 0 && G.particles.length < 250) {
    const cx = G.camera.x / 32, cy = G.camera.y / 16;
    G.particles.push({
      tx: cx + (Math.random() - 0.5) * 20,
      ty: cy + (Math.random() - 0.5) * 15,
      offsetY: -20 - Math.random() * 30,
      text: null,
      alpha: 0.5 + Math.random() * 0.3,
      vy: 0.08 + Math.random() * 0.06,
      decay: 0.002,
      type: 'petal',
      size: 1.5 + Math.random(),
      vx: 0.02 + Math.random() * 0.02,
      color: ['#ffb0c8','#ff90a8','#ffe066','#fff0f0'][Math.floor(Math.random()*4)],
    });
  }

  // Autumn falling leaves
  if (G.season === 'autumn' && G.gameTick % 10 === 0 && G.particles.length < 250) {
    const cx = G.camera.x / 32, cy = G.camera.y / 16;
    G.particles.push({
      tx: cx + (Math.random() - 0.5) * 20,
      ty: cy + (Math.random() - 0.5) * 15,
      offsetY: -25 - Math.random() * 25,
      text: null,
      alpha: 0.6 + Math.random() * 0.3,
      vy: 0.1 + Math.random() * 0.08,
      decay: 0.0015,
      type: 'leaf',
      size: 2 + Math.random() * 1.5,
      vx: (Math.random() - 0.3) * 0.03,
      color: ['#c85020','#d4a020','#b83018','#e8a830'][Math.floor(Math.random()*4)],
      rotation: Math.random() * Math.PI * 2,
    });
  }
}
