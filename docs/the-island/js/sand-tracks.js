// One session-only arrival-beach prototype. Metres in terrain-local XZ.
import * as THREE from 'three';
export const TRACK_PATCH = Object.freeze({ x: 4, z: -104, size: 16 });
const RESOLUTION = 1024;
const LIFE = 90, LIMIT = 64, STEP = .64;
let texture, ctx, previous, stride = 0, side = 1, clock = 0, repaint = 0;
const tracks = [];
export function sandTrackTexture() {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RESOLUTION;
  ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black'; ctx.fillRect(0, 0, RESOLUTION, RESOLUTION);
  texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  return texture;
}
export function clearSandTracks() {
  tracks.length = 0; previous = null; stride = 0; side = 1; repaint = 1;
}
export function updateSandTracks(dt, pos, active, heightAt, tide) {
  clock += dt;
  const p = TRACK_PATCH;
  const eligible = active && Math.abs(pos.x-p.x) < p.size/2-.3 && Math.abs(pos.z-p.z) < p.size/2-.3
    && pos.y > tide + .12 && pos.y < 2.8 && Math.abs(pos.y-heightAt(pos.x,pos.z)) < .12
    && Math.hypot(heightAt(pos.x+.2,pos.z)-heightAt(pos.x-.2,pos.z),
      heightAt(pos.x,pos.z+.2)-heightAt(pos.x,pos.z-.2))/.4 < .38;
  if (eligible && previous) {
    const dx = pos.x-previous.x, dz = pos.z-previous.z, distance = Math.hypot(dx,dz);
    // Teleports and camera arrivals must never draw a trail across the patch.
    if (distance < 1.5) {
      stride += distance;
      if (stride >= STEP) {
        stride %= STEP;
        const angle = Math.atan2(dx,dz), offset = .10*side;
        tracks.push({ x:pos.x+Math.cos(angle)*offset, z:pos.z-Math.sin(angle)*offset,
          y:pos.y, angle, born:clock });
        if (tracks.length > LIMIT) tracks.shift();
        side *= -1; repaint = 1;
      }
    } else stride = 0;
  } else stride = 0;
  previous = eligible ? { x:pos.x, z:pos.z } : null;
  for (let i=tracks.length-1;i>=0;i--) {
    if (clock-tracks[i].born >= LIFE || tide > tracks[i].y-.03) { tracks.splice(i,1); repaint=1; }
  }
  repaint += tracks.length ? dt : 0;
  if (repaint < .25 || !texture) return;
  repaint = 0;
  ctx.fillStyle = 'black'; ctx.fillRect(0,0,RESOLUTION,RESOLUTION);
  const scale = RESOLUTION/p.size;
  for (const t of tracks) {
    ctx.save();
    ctx.translate((t.x-p.x+p.size/2)*scale,(t.z-p.z+p.size/2)*scale);
    ctx.rotate(-t.angle); ctx.scale(scale,scale);
    ctx.globalAlpha = Math.min(1,(LIFE-(clock-t.born))/20);
    // Soft edges form a depression in the terrain's lighting, not a floating decal.
    for (const [z,rx,rz] of [[.065,.083,.115],[-.105,.062,.065]]) {
      ctx.save(); ctx.translate(0,z); ctx.scale(rx,rz);
      const g=ctx.createRadialGradient(0,0,.25,0,0,1);
      g.addColorStop(0,'white'); g.addColorStop(.65,'#b0b0b0'); g.addColorStop(1,'black');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  texture.needsUpdate = true;
}
