// interact.js — the iris cursor, hover glints, click and drag hotspots.
// No UI chrome: interactive things catch the light; the cursor dilates.

import * as THREE from 'three';

export class Interactions {
  constructor(camera, player, dom) {
    this.camera = camera;
    this.player = player;
    this.dom = dom;
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);
    this.mousePx = { x: innerWidth / 2, y: innerHeight / 2 };
    this.hotspots = [];      // {id, targets:[Object3D], label, type, maxDist, when, onClick, onDrag, onDragEnd}
    this.hovered = null;
    this.activeDrag = null;
    this.enabled = false;
    this._glinted = new Map(); // material → original emissive intensity

    this.iris = document.getElementById('iris');

    dom.addEventListener('pointermove', (e) => {
      this.mousePx.x = e.clientX; this.mousePx.y = e.clientY;
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      this.iris.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (this.activeDrag) {
        this.activeDrag.spot.onDrag?.(e.movementX, e.movementY);
      }
    });

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (this.hovered && this.hovered.type === 'drag') {
        this.activeDrag = { spot: this.hovered };
        this.player.dragCaptured = true;
        this.iris.classList.add('drag');
        e.stopPropagation();
      } else if (this.hovered) {
        this._pending = { spot: this.hovered, x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.activeDrag) {
        this.activeDrag.spot.onDragEnd?.();
        this.activeDrag = null;
        this.player.dragCaptured = false;
        this.iris.classList.remove('drag');
      }
      if (this._pending) {
        const moved = Math.abs(e.clientX - this._pending.x) + Math.abs(e.clientY - this._pending.y);
        if (moved < 8 && this.hovered === this._pending.spot) {
          this._pending.spot.onClick?.();
        }
        this._pending = null;
      }
    });

    // releasing the button outside the window must not latch the drag
    const dropDrag = () => {
      if (this.activeDrag) {
        this.activeDrag.spot.onDragEnd?.();
        this.activeDrag = null;
        this.player.dragCaptured = false;
        this.iris.classList.remove('drag');
      }
      this._pending = null;
    };
    window.addEventListener('pointercancel', dropDrag);
    window.addEventListener('blur', dropDrag);
  }

  add(spot) {
    spot.maxDist = spot.maxDist ?? 4.5;
    spot.type = spot.type ?? 'click';
    // glintable meshes get a private material so the hover highlight can't
    // bleed across every prop sharing a module-level material (both islands!)
    if (!spot.noGlint) {
      for (const t of spot.targets) {
        t.traverse((o) => {
          if (o.material && o.material.emissive !== undefined && !o.userData.glintMat) {
            o.material = o.material.clone();
            o.userData.glintMat = true;
          }
        });
      }
    }
    this.hotspots.push(spot);
    return spot;
  }

  // invisible raycast proxy sphere, parented anywhere
  static proxy(radius = 0.12) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.raycastable = true;
    return m;
  }

  update() {
    if (!this.enabled || this.player.locked || this.player.dragging || this.activeDrag) {
      if (!this.activeDrag) this._setHover(null);
      return;
    }
    this.ray.setFromCamera(this.mouse, this.camera);
    this.ray.far = 60;

    let best = null, bestDist = Infinity;
    const camPos = this.camera.position;
    for (const spot of this.hotspots) {
      if (spot.when && !spot.when()) continue;
      const hits = this.ray.intersectObjects(spot.targets, true);
      if (!hits.length) continue;
      const hit = hits[0];
      if (camPos.distanceTo(hit.point) > spot.maxDist) continue;
      if (hit.distance < bestDist) { bestDist = hit.distance; best = spot; }
    }
    this._setHover(best);
  }

  _setHover(spot) {
    if (spot === this.hovered) return;
    // restore old glint: both the emissive color and its intensity
    for (const [mat, orig] of this._glinted) {
      mat.emissive.setHex(orig.hex);
      mat.emissiveIntensity = orig.intensity;
    }
    this._glinted.clear();
    this.hovered = spot;
    this.iris.classList.toggle('hot', !!spot);
    if (spot && !spot.noGlint) {
      for (const t of spot.targets) {
        t.traverse((o) => {
          const mat = o.material;
          if (mat && mat.emissive !== undefined && !this._glinted.has(mat)) {
            this._glinted.set(mat, { hex: mat.emissive.getHex(), intensity: mat.emissiveIntensity ?? 1 });
            if (mat.emissive.r + mat.emissive.g + mat.emissive.b < 0.01) mat.emissive.setHex(0xffb454);
            mat.emissiveIntensity = Math.max(0.25, (mat.emissiveIntensity ?? 1) * 1.6);
          }
        });
      }
    }
  }
}
