import { NOTES, DURATION, mod, distance } from './engine.mjs';

const TAU = Math.PI * 2;
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };

export class Renderer {
  constructor(canvas, stage, bellButtons) {
    this.canvas = canvas;
    this.stage = stage;
    this.buttons = bellButtons;
    this.ctx = canvas.getContext('2d');
    this.flashes = NOTES.map(() => 0);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(stage);
    this.resize();
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.scale = Math.min(this.width / 880, this.height / 680);
    this.ox = (this.width - 1000 * this.scale) / 2;
    this.oy = (this.height - 720 * this.scale) / 2;
    this.buttons.forEach((button, index) => {
      button.style.left = `${this.ox + NOTES[index].x * this.scale}px`;
      button.style.top = `${this.oy + NOTES[index].y * this.scale}px`;
      button.style.width = `${Math.max(44, 84 * this.scale)}px`;
      button.style.height = `${Math.max(44, 84 * this.scale)}px`;
    });
  }

  point(clientX, clientY) {
    const rect = this.stage.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1000, (clientX - rect.left - this.ox) / this.scale)),
      y: Math.max(0, Math.min(720, (clientY - rect.top - this.oy) / this.scale)) };
  }

  flash(index) { this.flashes[index] = 1; }

  draw({ score, time, actors, study, progress, recording, armed, live, paused, visitor }) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.translate(this.ox, this.oy);
    c.scale(this.scale, this.scale);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // The concentric scale is an actual clock: eight divisions, one revolution.
    const wash = c.createRadialGradient(500, 330, 50, 500, 350, 317);
    wash.addColorStop(0, '#f8fbfd');
    wash.addColorStop(.76, '#eef4f8');
    wash.addColorStop(1, '#dce6ee00');
    c.fillStyle = wash; circle(c, 500, 350, 318); c.fill();
    for (const r of [293, 299, 312]) {
      c.strokeStyle = r === 299 ? '#a6bccc' : '#bfced94d';
      c.lineWidth = r === 299 ? .8 : 1;
      circle(c, 500, 350, r); c.stroke();
    }
    for (let i = 0; i < 96; i++) {
      const a = -Math.PI / 2 + i / 96 * TAU;
      const major = i % 12 === 0;
      c.strokeStyle = major ? '#8ea5b9' : '#a6bdcc88';
      c.lineWidth = major ? 1.25 : .6;
      c.beginPath();
      c.moveTo(500 + Math.cos(a) * 293, 350 + Math.sin(a) * 293);
      c.lineTo(500 + Math.cos(a) * (major ? 281 : 288), 350 + Math.sin(a) * (major ? 281 : 288));
      c.stroke();
      if (major) {
        c.fillStyle = '#70879c'; c.font = `${Math.max(12, 9 / this.scale)}px "Avenir Next", sans-serif`; c.textAlign = 'center';
        c.fillText(String(i / 12), 500 + Math.cos(a) * 325, 354 + Math.sin(a) * 325);
      }
    }

    const phase = mod(time, DURATION) / DURATION;
    c.strokeStyle = paused ? '#8fa2b8' : armed ? '#b8707e' : '#617ec4'; c.lineWidth = 2.3;
    c.beginPath(); c.arc(500, 350, 299, -Math.PI / 2, -Math.PI / 2 + phase * TAU); c.stroke();
    if (!paused) {
      const a = -Math.PI / 2 + phase * TAU;
      circle(c, 500 + Math.cos(a) * 299, 350 + Math.sin(a) * 299, 3.2); c.fillStyle = c.strokeStyle; c.fill();
    }

    // Light construction lines give the bells a common resonating body.
    c.strokeStyle = '#aec2d040'; c.lineWidth = .7;
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        c.beginPath(); c.moveTo(NOTES[i].x, NOTES[i].y); c.lineTo(NOTES[j].x, NOTES[j].y); c.stroke();
      }
    }
    if (study.targets.length && !progress.complete && !visitor) {
      c.strokeStyle = '#7994c364'; c.setLineDash([2, 6]); c.lineWidth = 1;
      c.beginPath();
      study.targets.forEach((n, i) => i ? c.lineTo(NOTES[n].x, NOTES[n].y) : c.moveTo(NOTES[n].x, NOTES[n].y));
      if (study.targets.length > 2) c.closePath();
      c.stroke(); c.setLineDash([]);
    }

    // Every curve below is recorded input. No decorative pre-drawn trails.
    for (const hand of score.hands) {
      c.save();
      c.globalAlpha = hand.muted ? .14 : .48;
      c.strokeStyle = hand.color; c.lineWidth = Math.max(1.8, 1.1 / this.scale);
      if (hand.reverse) c.setLineDash([5, 4]);
      this.path(hand.points);
      c.stroke();
      c.setLineDash([]);
      const start = hand.points[0], end = hand.points.at(-1);
      if (distance(start, end) > 12) {
        c.globalAlpha = .24;
        c.setLineDash([2, 7]); c.lineWidth = .8;
        c.beginPath(); c.moveTo(end.x, end.y); c.lineTo(start.x, start.y); c.stroke();
        c.setLineDash([]);
      }
      c.restore();
    }
    if (recording) { c.strokeStyle = '#ac5868'; c.lineWidth = 2.4; this.path(recording.points); c.stroke(); }

    for (let i = 0; i < NOTES.length; i++) {
      const note = NOTES[i], present = actors.filter(a => distance(a, note) <= 44);
      const target = study.targets.includes(i) && !progress.complete && !visitor;
      const glow = this.flashes[i];
      this.flashes[i] *= this.reduced ? .5 : .93;
      c.save();
      const bellScale = Math.max(1, 22 / (37 * this.scale));
      c.translate(note.x, note.y); c.scale(bellScale, bellScale); c.translate(-note.x, -note.y);
      if (glow > .02 && !this.reduced) {
        c.strokeStyle = `${present[0]?.color || '#6484bc'}${Math.round(glow * 72).toString(16).padStart(2, '0')}`;
        c.lineWidth = 1;
        circle(c, note.x, note.y, 47 + (1 - glow) * 37); c.stroke();
      }
      if (target) {
        circle(c, note.x, note.y, 48); c.strokeStyle = '#8b9fc2'; c.lineWidth = .8; c.stroke();
        c.fillStyle = '#6c80a8'; circle(c, note.x, note.y - 55, 2.5); c.fill();
      }
      c.shadowColor = '#546d8f20'; c.shadowBlur = 14; c.shadowOffsetY = 5;
      const glass = c.createLinearGradient(note.x - 30, note.y - 35, note.x + 35, note.y + 40);
      glass.addColorStop(0, '#ffffff'); glass.addColorStop(.47, '#f3f7fb'); glass.addColorStop(1, '#cbdce8');
      c.fillStyle = glass; circle(c, note.x, note.y, 37); c.fill();
      c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.lineWidth = 1; c.strokeStyle = '#afc3d4'; c.stroke();
      c.beginPath(); c.arc(note.x, note.y, 33, Math.PI * .98, Math.PI * 1.82); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
      if (present.length) {
        c.globalAlpha = .13; c.fillStyle = present[0].color; circle(c, note.x, note.y, 36); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = present[0].color; c.lineWidth = 1.7; circle(c, note.x, note.y, 40); c.stroke();
      }
      c.fillStyle = present[0]?.color || '#57708e'; c.font = '24px Baskerville, Georgia, serif'; c.textAlign = 'center';
      c.fillText(note.name, note.x, note.y + 7);
      c.fillStyle = '#6d839a'; c.font = '10px "Avenir Next", sans-serif';
      c.fillText(String(i + 1), note.x, note.y + 25);
      if (i !== 6 && this.scale >= .6) {
        const shift = note.y < 200 ? -69 : note.y > 500 ? 73 : 70;
        c.fillStyle = '#738ba0'; c.font = 'italic 15px Baskerville, Georgia, serif'; c.fillText(note.word, note.x, note.y + shift);
      }
      c.restore();
    }

    for (const actor of actors) {
      if (!actor.echo) continue;
      c.strokeStyle = actor.color; c.fillStyle = actor.color;
      c.lineWidth = 1.4; circle(c, actor.x, actor.y, 10); c.stroke();
      circle(c, actor.x, actor.y, 3); c.fill();
      // Three short offset arcs identify an echo even without color.
      c.beginPath(); c.arc(actor.x, actor.y, 15, .3, 2.1); c.stroke();
    }
    if (live) {
      c.strokeStyle = armed ? '#ac5868' : '#263b53'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(live.x - 7, live.y); c.lineTo(live.x + 7, live.y); c.moveTo(live.x, live.y - 7); c.lineTo(live.x, live.y + 7); c.stroke();
    }

  }

  path(points) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
  }
}

const escapeXML = text => text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export function scoreSVG(score) {
  const paths = score.hands.map(hand => `<polyline points="${hand.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${hand.color}" stroke-width="2" opacity="${hand.muted ? .18 : .72}"${hand.reverse ? ' stroke-dasharray="5 4"' : ''}/>`).join('');
  const bells = NOTES.map(n => `<circle cx="${n.x}" cy="${n.y}" r="30" fill="#edf3f7" stroke="#9bb3ca"/><text x="${n.x}" y="${n.y + 7}" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#445e7c">${n.name}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 950" width="1000" height="950"><title>${escapeXML(score.title)}</title><desc>A score of ${score.hands.length} recorded gestures, repeating every eight seconds. Dashed gestures play backward.</desc><rect width="1000" height="950" fill="#e6edf3"/><text x="500" y="77" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#263b53">${escapeXML(score.title)}</text><g transform="translate(0 90)"><circle cx="500" cy="350" r="299" fill="#f1f6fa" stroke="#acc0d1"/>${paths}${bells}</g><text x="500" y="842" text-anchor="middle" font-family="Georgia,serif" font-size="21" fill="#263b53">Elsewhen.</text><text x="500" y="876" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#53667c">${score.hands.length} borrowed hands / 8 seconds / one person</text></svg>`;
}
