// upstream-hand.js — THE COST ARRIVES.
//
// The player never sees the person above them.  They see one recorded act cross the
// chart table's exact 1:240 boundary: the miniature valve reenacts its pull, a pressure
// filament escapes the model, its wheel-glyph becomes architectural on the study wall,
// and the real bay carries the same ring away.  No light, camera, or UI is created here;
// this is a transient object score driven from absolute phase time.

import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU } from './util.js';

const LH = new THREE.Vector3(-85, 13.5, -40);
const SURGE_AT = 7.25;
const REVEAL_AT = 8.55;
const END_AT = 12.4;

function hash01(value) {
  let h = 2166136261;
  for (const c of String(value || '')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 1, 64, 64, 62);
  r.addColorStop(0, 'rgba(223,253,247,1)');
  r.addColorStop(0.12, 'rgba(119,217,209,.92)');
  r.addColorStop(0.42, 'rgba(63,150,151,.28)');
  r.addColorStop(1, 'rgba(20,60,65,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function ring(material, segments = 96) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, segments), material);
  m.rotation.x = -Math.PI / 2;
  m.frustumCulled = false;
  return m;
}

function wallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAngle: { value: Math.PI },
      uScale: { value: 0 },
      uOpacity: { value: 0 },
      uSeed: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uAngle;
      uniform float uScale;
      uniform float uOpacity;
      uniform float uSeed;
      varying vec3 vLocal;
      const float PI = 3.141592653589793;
      const float TWO_PI = 6.283185307179586;
      void main() {
        float ang = atan(vLocal.x, vLocal.z);
        float da = abs(mod(ang - uAngle + PI, TWO_PI) - PI);
        vec2 p = vec2((da / PI) * 1.32, (vLocal.y / 2.22) * 0.58);
        float d = length(p);
        float a = atan(p.y, p.x);
        float radius = mix(0.035, 0.90, uScale);
        float rim = 1.0 - smoothstep(0.018, 0.052, abs(d - radius));
        float echo = (1.0 - smoothstep(0.012, 0.040, abs(d - radius * 0.73))) * 0.28;
        float hub = 1.0 - smoothstep(0.025, 0.075, d);
        float spokeLine = 1.0 - smoothstep(0.025, 0.075, abs(sin(a * 4.0 + uSeed * 0.7)) * d);
        float spokes = spokeLine * step(0.085, d) * (1.0 - smoothstep(radius * 0.82, radius, d));
        float wash = (1.0 - smoothstep(radius * 0.65, radius, d)) * 0.09;
        float etch = 0.82 + 0.18 * sin(vLocal.y * 19.0 + ang * 23.0 + uSeed * 17.0);
        float alpha = (rim * 0.84 + echo + spokes * 0.64 + hub * 0.82 + wash) * etch * uOpacity;
        vec3 lampblack = vec3(0.012, 0.040, 0.044);
        vec3 brine = vec3(0.34, 0.90, 0.84);
        vec3 bone = vec3(0.87, 0.99, 0.97);
        float signal = clamp(rim + echo + spokes * 0.55 + hub * 0.85, 0.0, 1.0);
        vec3 color = mix(lampblack, brine, signal);
        color = mix(color, bone, rim * rim * 0.30 + hub * 0.22);
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  });
}

export class UpstreamHand {
  constructor({ worldRoot, modelRoot, modelWheel, waterY, reducedMotion }) {
    this.worldRoot = worldRoot;
    this.modelRoot = modelRoot;
    this.modelWheel = modelWheel;
    this.waterY = waterY;
    this.reducedMotion = reducedMotion;
    this.active = false;
    this.t = 0;
    this._phase = 'idle';
    this._surged = false;
    this._revealed = false;
    this._modelPulse = 0;
    this._wallScale = 0;
    this._worldRadius = 0;
    this._build();
  }

  _build() {
    const brine = new THREE.MeshBasicMaterial({
      color: 0x77d9d1, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false,
    });
    const bone = new THREE.MeshBasicMaterial({
      color: 0xdffdf7, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.modelMat = brine.clone();
    this.modelBoneMat = bone.clone();
    this.roomMat = bone.clone();
    this.worldMat = brine.clone();
    this.threadMat = new THREE.LineBasicMaterial({
      color: 0x77d9d1, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });

    // MODEL: three delayed rings make one physical wave, plus a camera-facing pulse
    // at the miniature wheel.  Local values are island metres; modelRoot supplies /240.
    this.modelFx = new THREE.Group();
    this.modelFx.name = 'upstreamHandModel';
    this.modelFx.visible = false;
    this.modelRings = [];
    for (let i = 0; i < 3; i++) {
      // Each delayed ring owns its opacity. Sharing modelMat made the last ring's
      // fade overwrite the middle one, collapsing three echoes into two.
      const r = ring(i === 0 ? this.modelBoneMat : this.modelMat.clone(), 80);
      r.userData.delay = i * 0.38;
      this.modelFx.add(r); this.modelRings.push(r);
    }
    this.modelHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xdffdf7, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.modelHalo.position.y = 9;
    this.modelHalo.scale.setScalar(44);
    this.modelFx.add(this.modelHalo);
    this.modelRoot.add(this.modelFx);

    // ROOM: the 1:240 seam is made legible by a physical ring expanding off the
    // chart table, a filament reaching the masonry, and the wheel-glyph wrapping
    // only the wall arcs that actually exist (never painting across doors/windows).
    this.roomRing = ring(this.roomMat, 112);
    this.worldRoot.add(this.roomRing);

    this.thread = new THREE.Line(new THREE.BufferGeometry(), this.threadMat);
    this.thread.frustumCulled = false;
    this.worldRoot.add(this.thread);

    this.pulse = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0x77d9d1, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.pulse.scale.setScalar(0.7);
    this.worldRoot.add(this.pulse);

    this.wallMat = wallMaterial();
    this.wallMeshes = [];
    const d = (n) => n * Math.PI / 180;
    const arcs = [[d(179), d(3) + TAU], [d(27), d(95)], [d(125), d(151)]];
    for (const [a0, a1] of arcs) {
      const geo = new THREE.CylinderGeometry(5.11, 5.17, 4.42,
        Math.max(12, Math.round((a1 - a0) * 22)), 1, true, a0, a1 - a0);
      const wall = new THREE.Mesh(geo, this.wallMat);
      wall.position.set(LH.x, LH.y + 2.25, LH.z);
      wall.frustumCulled = false;
      wall.renderOrder = 8;
      this.worldRoot.add(wall); this.wallMeshes.push(wall);
    }

    // WORLD: the same narrow crest at full scale.  It is deliberately transient;
    // the +0.06 baseline behind it belongs to WorldState and never recedes.
    this.worldRing = ring(this.worldMat, 144);
    this.worldRing.position.set(LH.x, 0, LH.z);
    this.worldRoot.add(this.worldRing);
    this.worldRoot.visible = false;
  }

  begin(mark, hooks = {}) {
    if (this.active || !mark || mark.k !== 'valve') return false;
    this.active = true;
    this.t = 0;
    this.mark = mark;
    this.hooks = hooks;
    this._phase = 'listening';
    this._surged = false;
    this._revealed = false;
    this._modelPulse = 0;
    this._wallScale = 0;
    this._worldRadius = 0;
    this._modelCalled = false;
    this._seed = hash01(`${mark.h}:${mark.r}:${mark.n}:${mark.k}`);
    this._baseWheel = this.modelWheel ? this.modelWheel.rotation.z : 0;

    const p = this.modelWheel?.position || new THREE.Vector3(-82.7, 14.6, -38.9);
    this.modelFx.position.set(p.x, p.y + 0.08, p.z);
    this.modelFx.visible = false;

    // Bridge from the ACTUAL model wheel in world space to the matching radial
    // station on the masonry.  The slight hand-seeded bend means strangers leave
    // distinct pressure signatures without ever becoming avatars.
    this.modelRoot.updateWorldMatrix(true, true);
    this.worldRoot.updateWorldMatrix(true, false);
    const start = new THREE.Vector3();
    if (this.modelWheel) this.modelWheel.getWorldPosition(start);
    else start.set(-85.34, 14.57, -40.16);
    this.worldRoot.worldToLocal(start);
    // Project across the table onto the south wall—the surface naturally framed
    // behind the model from the valve stance. The cause still begins at the exact
    // miniature wheel; the room, not a forced camera, composes its destination.
    const angle = Math.PI + (this._seed - 0.5) * 0.14;
    const end = new THREE.Vector3(LH.x + Math.sin(angle) * 5.02, LH.y + 2.45, LH.z + Math.cos(angle) * 5.02);
    const bend = (this._seed - 0.5) * 1.1;
    this.curve = new THREE.CatmullRomCurve3([
      start.clone(),
      start.clone().lerp(end, 0.30).add(new THREE.Vector3(-0.25, 1.05, bend)),
      start.clone().lerp(end, 0.68).add(new THREE.Vector3(0.35, 1.65, -bend * 0.5)),
      end,
    ]);
    const pts = this.curve.getPoints(72);
    this.thread.geometry.dispose();
    this.thread.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.thread.geometry.setDrawRange(0, 0);
    this.threadCount = pts.length;
    this.wallMat.uniforms.uAngle.value = angle;
    this.wallMat.uniforms.uSeed.value = this._seed;
    this.roomRing.position.copy(start);
    this.roomRing.position.y += 0.035;
    this.worldRing.position.y = this.waterY() + 0.10;
    this.worldRoot.visible = true;
    return true;
  }

  tick(dt) {
    if (!this.active) return;
    this.t += Math.max(0, dt);
    const t = this.t;
    const still = !!this.reducedMotion?.();

    this._phase = t < 1.15 ? 'listening'
      : t < 3.9 ? 'model'
        : t < SURGE_AT ? 'wall'
          : t < 10.7 ? 'world' : 'settling';

    if (t >= 1.15 && !this._modelCalled) {
      this._modelCalled = true;
      this.hooks.onModel?.();
    }

    // The miniature pull: one complete turn, followed by the model's whole basin
    // answering.  Reduced motion holds the authored mid-composition instead.
    const modelIn = smoothstep(1.05, 1.50, t);
    const modelOut = 1 - smoothstep(5.15, 6.35, t);
    this._modelPulse = modelIn * modelOut;
    this.modelFx.visible = this._modelPulse > 0.002;
    if (this.modelWheel && this._modelPulse > 0.002) {
      const turn = still ? 0.75 : smoothstep(1.35, 3.55, t);
      this.modelWheel.rotation.z = this._baseWheel + turn * TAU * 1.25
        + (still ? 0 : Math.sin(t * 23) * 0.025 * (1 - turn));
    }
    for (const r of this.modelRings) {
      const q = smoothstep(1.45 + r.userData.delay, 4.75 + r.userData.delay, t);
      const radius = still ? 112 + r.userData.delay * 46 : lerp(4, 214, q);
      r.scale.setScalar(radius);
      r.material.opacity = this._modelPulse * (1 - q * 0.72) * 0.72;
    }
    this.modelHalo.material.opacity = this._modelPulse * (still ? 0.68 : 0.56 + 0.22 * Math.sin(t * 8));
    this.modelHalo.scale.setScalar((still ? 58 : 38 + smoothstep(1.1, 3.8, t) * 34));

    // The filament climbs out, carrying one bright knot.  Draw-range, rather than
    // per-frame geometry, makes this deterministic under coarse ticks and tab resume.
    const threadP = still ? (t >= 3.20 ? 1 : 0) : smoothstep(3.20, 5.55, t);
    const threadOut = 1 - smoothstep(8.4, 9.65, t);
    this.thread.geometry.setDrawRange(0, Math.max(0, Math.floor(this.threadCount * threadP)));
    this.threadMat.opacity = threadOut * smoothstep(3.0, 3.6, t) * 0.82;
    this.pulse.visible = threadP > 0.01 && threadOut > 0.01;
    if (this.pulse.visible) this.pulse.position.copy(this.curve.getPointAt(clamp(threadP, 0, 1)));
    this.pulse.material.opacity = this.threadMat.opacity;
    this.pulse.scale.setScalar(still ? 0.85 : lerp(0.25, 1.0, threadP));

    // A ring leaves the tabletop at room scale, then the exact valve geometry
    // becomes a pressure-shadow across the cylindrical masonry.
    const roomP = smoothstep(3.05, 5.95, t);
    const roomOut = 1 - smoothstep(6.2, 7.45, t);
    const roomRadius = still ? 4.7 : lerp(0.16, 6.15, roomP);
    this.roomRing.scale.setScalar(roomRadius);
    this.roomMat.opacity = roomOut * smoothstep(2.9, 3.4, t) * 0.70;

    const wallIn = smoothstep(4.15, 7.15, t);
    const wallOut = 1 - smoothstep(8.65, 10.55, t);
    this._wallScale = wallIn * wallOut;
    this.wallMat.uniforms.uScale.value = still ? (this._wallScale > 0.02 ? 0.84 : 0) : wallIn;
    this.wallMat.uniforms.uOpacity.value = this._wallScale * 0.94;

    if (t >= SURGE_AT && !this._surged) {
      this._surged = true;
      this.hooks.onSurge?.();
    }

    const worldP = smoothstep(SURGE_AT, 11.15, t);
    const worldOut = 1 - smoothstep(10.55, 12.2, t);
    this._worldRadius = t < SURGE_AT ? 0 : (still ? 165 : lerp(4, 245, worldP));
    this.worldRing.visible = this._worldRadius > 0 && worldOut > 0.002;
    this.worldRing.position.y = this.waterY() + 0.10;
    this.worldRing.scale.setScalar(Math.max(this._worldRadius, 0.001));
    this.worldMat.opacity = worldOut * (0.62 - worldP * 0.28);

    if (t >= REVEAL_AT && !this._revealed) {
      this._revealed = true;
      this.hooks.onReveal?.();
    }
    if (t >= END_AT) this._cleanup();
  }

  // Leaving L2 mid-score cannot lose its persisted physical consequence. Resolve
  // callbacks synchronously, then remove every transient draw.
  resolve({ reveal = true } = {}) {
    if (!this.active) return;
    if (!this._surged) { this._surged = true; this.hooks.onSurge?.(); }
    if (!this._revealed) {
      this._revealed = true;
      if (reveal) this.hooks.onReveal?.();
    }
    this._cleanup();
  }

  _clearVisuals() {
    this.active = false;
    this._phase = 'idle';
    this._modelPulse = 0;
    this._wallScale = 0;
    this._worldRadius = 0;
    this.modelFx.visible = false;
    this.worldRoot.visible = false;
    this.worldRing.visible = false;
    this.pulse.visible = false;
    this.thread.geometry.setDrawRange(0, 0);
    this.roomMat.opacity = 0;
    this.worldMat.opacity = 0;
    this.threadMat.opacity = 0;
    this.wallMat.uniforms.uOpacity.value = 0;
    this.wallMat.uniforms.uScale.value = 0;
  }

  _cleanup() {
    this._clearVisuals();
    this.hooks.onComplete?.();
  }

  // A run reset is not a crossing: it cancels the score without manufacturing
  // the persistent surge or reveal that resolve() deliberately commits.
  cancel() {
    const wasActive = this.active;
    if (wasActive) this._cleanup();
    else this._clearVisuals();
    if (this.modelWheel && Number.isFinite(this._baseWheel)) this.modelWheel.rotation.z = this._baseWheel;
    this.t = 0;
    this.mark = null;
    this.hooks = {};
    this.curve = null;
    this.threadCount = 0;
    this._surged = false;
    this._revealed = false;
    this._modelCalled = false;
    this._seed = 0;
    this._baseWheel = null;
    return wasActive;
  }

  inspect() {
    return {
      phase: this._phase,
      active: this.active,
      sourceHand: this.mark ? String(this.mark.h || '').slice(0, 16) : null,
      sourceKind: this.mark?.k || null,
      modelPulse: +this._modelPulse.toFixed(3),
      wallScale: +this._wallScale.toFixed(3),
      worldRadius: +this._worldRadius.toFixed(2),
      surged: this._surged,
      reducedMotion: !!this.reducedMotion?.(),
    };
  }
}
