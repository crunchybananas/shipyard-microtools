// player.js — first-person body: drag-look, WASD, terrain collision, head bob.
// No pointer lock required (WKWebView-safe); dragging the world looks around.

import * as THREE from 'three';
import { clamp, lerp, TAU } from './util.js';
import { walkableY, wallBlocked, heightAt } from './terrain.js';
import { W, waterY } from './world.js';

const _wish = new THREE.Vector2();   // scratch: the per-frame movement wish (no alloc in update())

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
    this._stuckT = 0;            // seconds fully pinned while pushing (wedge net)
    this.onFootstep = null;      // cb(kind)
    this.onRescue = null;        // cb() when the wedge net repositions the player

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
      groundY + this.eye + Math.sin(this.bobPhase) * 0.045 * this.bobAmp * (W.reduceMotion ? 0 : 1),
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
    const wish = _wish.set(wishX, wishZ);
    if (wish.lengthSq() > 1) wish.normalize();

    this.vel.x = lerp(this.vel.x, wish.x * speed, 1 - Math.exp(-10 * dt));
    this.vel.z = lerp(this.vel.z, wish.y * speed, 1 - Math.exp(-10 * dt));

    const px0 = this.pos.x, pz0 = this.pos.z;
    const pushing = wish.lengthSq() > 1e-3;
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    if (this._step(nx, nz)) {
      this.pos.x = nx; this.pos.z = nz;
    } else if (this._step(nx, this.pos.z)) {
      this.pos.x = nx;
    } else if (this._step(this.pos.x, nz)) {
      this.pos.z = nz;
    } else {
      this.vel.set(0, 0, 0);
    }

    // wedge safety net: if the player is pushing but fully pinned for >0.6s
    // AND no heading out is walkable (steep walls up, water/clamp down), they
    // are wedged — set them back on the nearest safe ground. The ring test is
    // the real guard: against a normal wall some heading is always open, so
    // this never fires for ordinary "walking into a wall." Rare by design.
    const moved = Math.abs(this.pos.x - px0) + Math.abs(this.pos.z - pz0) > 1e-4;
    this._stuckT = (pushing && !moved) ? this._stuckT + dt : 0;
    if (this._stuckT > 0.6) {
      let anyOut = false;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        if (this._step(px0 + Math.cos(a) * 0.5, pz0 + Math.sin(a) * 0.5)) { anyOut = true; break; }
      }
      if (!anyOut) { this._escapeWedge(); this._stuckT = 0; }
    }

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

  // one walk-collision probe from the current position toward (nx,nz) — moved out of update()
  // so the closure is not rebuilt every frame (GC). Body is the former step() closure, verbatim.
  _step(nx, nz) {
    const hereY = walkableY(this.pos.x, this.pos.z);
    const thereY = walkableY(nx, nz);
    if (thereY - hereY > 1.05) return false;          // too steep a step up
    if (hereY - thereY > 2.2) return false;           // no leaping off cliffs
    // natural slopes steeper than ~53° are unclimbable (cliffs, the bluff,
    // chasm walls) — structures (bridge, stairs, pads) are exempt because
    // their walkable height diverges from the raw terrain
    const tHere = heightAt(this.pos.x, this.pos.z), tThere = heightAt(nx, nz);
    const structural = Math.abs(hereY - tHere) > 0.4 || Math.abs(thereY - tThere) > 0.4;
    if (!structural) {
      // measure the terrain gradient over a FIXED look-ahead, not the per-frame step.
      // dividing the rise by the tiny per-frame stride turned any local hummock into a
      // phantom cliff — a 0.6 m bump crossed in a 0.06 m step read as slope ~10 and walled
      // the player anywhere on noisy ground (this stranded the causeway crossing). A fixed
      // reference reads the real slope and ignores sub-step noise; the absolute per-step
      // rise is still capped by the `thereY - hereY > 1.05` gate above.
      const stride = Math.max(Math.hypot(nx - this.pos.x, nz - this.pos.z), 1e-4);
      const LOOK = 0.7;   // longer than a noise hummock, shorter than a real wall:
      const tAhead = heightAt(  // ignores sub-step pits, still catches sustained cliffs
        this.pos.x + (nx - this.pos.x) / stride * LOOK,
        this.pos.z + (nz - this.pos.z) / stride * LOOK);
      if ((tAhead - tHere) / LOOK > 1.35) return false;
      // the drained bay still refuses you: below-tide basins (the chasm's drowned ends,
      // bay-floor bowls) walk in but never out. Block the descent at the rim; upslope
      // stays open so the causeway crest and a stale save below the line still pass.
      if (tThere < -2.2 && tThere <= tHere + 0.02) return false;
    }
    // the sea refuses you — but if the tide caught you, wade out
    if (thereY < waterY() - 0.5) {
      if (hereY >= waterY() - 0.45) return false;        // no walking in
      if (thereY < hereY - 0.05) return false;           // submerged: only upslope
    }
    if (wallBlocked(this.pos.x, this.pos.z, nx, nz)) return false;
    return true;
  }

  // spiral outward for the nearest dry, gently-sloped ground and set the
  // player there — the wedge net's extraction. Conservative thresholds so it
  // lands on real walkable terrain, never back in the trap.
  _escapeWedge() {
    const px = this.pos.x, pz = this.pos.z, e = 0.7;
    const grad = (x, z) => Math.hypot(
      heightAt(x + e, z) - heightAt(x - e, z),
      heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    for (let R = 3; R <= 60; R += 1.5) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const x = px + Math.cos(a) * R, z = pz + Math.sin(a) * R;
        if (heightAt(x, z) > waterY() + 0.4 && grad(x, z) < 0.9) {
          this.pos.set(x, walkableY(x, z), z);
          this.vel.set(0, 0, 0);
          this.onRescue?.();
          return;
        }
      }
    }
  }

  interior() {
    // inside the lighthouse study (or its annex)
    const dx = this.pos.x - (-85), dz = this.pos.z - (-40);
    if (dx * dx + dz * dz < 5.4 * 5.4) return true;
    const ax = this.pos.x - (-85 + Math.sin(0.2618) * 8.1), az = this.pos.z - (-40 + Math.cos(0.2618) * 8.1);
    if (ax * ax + az * az < 2.8 * 2.8) return true;
    // the cellar vault
    if (W.flags.hatchOpen) {
      const lx = this.pos.x - 97, lz = this.pos.z - 32;
      if (lx > -4.5 && lx < 4.5 && lz < -1.2 && lz > -17) return true;
    }
    return false;
  }
}
