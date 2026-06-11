// player.js — first-person body: drag-look, WASD, terrain collision, head bob.
// No pointer lock required (WKWebView-safe); dragging the world looks around.

import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { walkableY, wallBlocked } from './terrain.js';
import { W, waterY } from './world.js';

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.pos = new THREE.Vector3(4, 0, -104);
    this.yaw = Math.PI * 0.92;   // facing the lighthouse, roughly NW
    this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.eye = 1.65;
    this.locked = true;          // cinematics own the camera until play starts
    this.dragCaptured = false;   // true while a drag-hotspot owns the pointer

    this.keys = new Set();
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.onFootstep = null;      // cb(kind)

    this._drag = null;

    dom.addEventListener('pointerdown', (e) => {
      if (this.locked || this.dragCaptured) return;
      this._drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this._drag || this.locked || this.dragCaptured) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      this._drag.moved += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.0036;
      this.pitch = clamp(this.pitch - dy * 0.0030, -1.45, 1.45);
    });
    window.addEventListener('pointerup', () => { this._drag = null; });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get dragging() { return !!this._drag && this._drag.moved > 6; }

  spawn(pos, yaw, pitch = 0) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.syncCamera();
  }

  syncCamera() {
    const groundY = walkableY(this.pos.x, this.pos.z);
    this.pos.y = groundY;
    this.camera.position.set(
      this.pos.x,
      groundY + this.eye + Math.sin(this.bobPhase) * 0.045 * this.bobAmp,
      this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }

  update(dt) {
    if (this.locked) return;

    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = run ? 7.0 : 4.0;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (-sin * fwd + cos * strafe);
    const wishZ = (-cos * fwd - sin * strafe);
    const wish = new THREE.Vector2(wishX, wishZ);
    if (wish.lengthSq() > 1) wish.normalize();

    this.vel.x = lerp(this.vel.x, wish.x * speed, 1 - Math.exp(-10 * dt));
    this.vel.z = lerp(this.vel.z, wish.y * speed, 1 - Math.exp(-10 * dt));

    const step = (nx, nz) => {
      const hereY = walkableY(this.pos.x, this.pos.z);
      const thereY = walkableY(nx, nz);
      if (thereY - hereY > 1.05) return false;          // too steep a step up
      if (hereY - thereY > 2.2) return false;           // no leaping off cliffs
      if (thereY < waterY() - 0.5) return false;        // the sea refuses you
      if (wallBlocked(this.pos.x, this.pos.z, nx, nz)) return false;
      return true;
    };

    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    let blocked = false;
    if (step(nx, nz)) {
      this.pos.x = nx; this.pos.z = nz;
    } else if (step(nx, this.pos.z)) {
      this.pos.x = nx; blocked = true;
    } else if (step(this.pos.x, nz)) {
      this.pos.z = nz; blocked = true;
    } else {
      this.vel.set(0, 0, 0);
      blocked = true;
    }
    this.blockedByWater = blocked && walkableY(nx, nz) < waterY() - 0.5;

    // head bob + footsteps
    const groundSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmp = lerp(this.bobAmp, clamp(groundSpeed / 4, 0, 1), 1 - Math.exp(-6 * dt));
    const prevPhase = this.bobPhase;
    this.bobPhase += groundSpeed * dt * 2.1;
    if (Math.floor(this.bobPhase / Math.PI) !== Math.floor(prevPhase / Math.PI) && groundSpeed > 0.8) {
      const h = walkableY(this.pos.x, this.pos.z);
      const kind = this.interior() ? 'stone' : (h < 2.2 ? 'sand' : 'grass');
      this.onFootstep?.(kind, this.pos);
    }

    this.syncCamera();
  }

  interior() {
    // inside the lighthouse study (or its annex)
    const dx = this.pos.x - (-85), dz = this.pos.z - (-40);
    if (dx * dx + dz * dz < 5.4 * 5.4) return true;
    const ax = this.pos.x - (-85 + Math.sin(0.2618) * 7.4), az = this.pos.z - (-40 + Math.cos(0.2618) * 7.4);
    if (ax * ax + az * az < 2.8 * 2.8) return true;
    // the cellar vault
    if (W.flags.hatchOpen) {
      const lx = this.pos.x - 97, lz = this.pos.z - 32;
      if (lx > -4.5 && lx < 4.5 && lz < -1.2 && lz > -17) return true;
    }
    return false;
  }

  altitude() { return this.pos.y; }
}
