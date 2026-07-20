// interact.js — the iris cursor, hover glints, click and drag hotspots.
// No UI chrome: interactive things catch the light; the cursor dilates.

import * as THREE from 'three';

// scratch for the per-spot distance pre-cull (perf #29) — never allocated per frame
const _cullC = new THREE.Vector3();
const _cullBox = new THREE.Box3();
const _cullSphere = new THREE.Sphere();

export class Interactions {
  constructor(camera, player, dom) {
    this.camera = camera;
    this.player = player;
    this.dom = dom;
    this.ray = new THREE.Raycaster();
    this.ray.far = 60;   // hoisted (perf #29): the reach never changes, so set it once
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
    // the private glint material is cloned LAZILY, on first hover (see _setHover) — not here.
    // Cloning at add() raced ahead of async texture loads (the material got cloned before its
    // map finished loading, so the clone showed untextured); deferring to first hover lets the
    // shared material settle first, and skips the clone for hotspots the player never hovers.
    this.hotspots.push(spot);
    return spot;
  }

  // world-space radius of a sphere around targets[0]'s origin that encloses every target's
  // bounding box — measured ONCE per spot, on its first eligible update (matrices are long
  // settled by then; measuring at add() would race the async model/prop builds). Multi-target
  // spots (oar+hull, hook+proxy) keep a static relative layout, so one sphere covers them all.
  _measureCullRadius(spot) {
    spot.targets[0].getWorldPosition(_cullC);
    let r = 0;
    for (const t of spot.targets) {
      _cullBox.setFromObject(t);
      if (_cullBox.isEmpty()) continue;
      _cullBox.getBoundingSphere(_cullSphere);
      r = Math.max(r, _cullSphere.center.distanceTo(_cullC) + _cullSphere.radius);
    }
    return r;
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

    let best = null, bestDist = Infinity;
    const camPos = this.camera.position;
    for (const spot of this.hotspots) {
      if (spot.when && !spot.when()) continue;
      // distance pre-cull (perf #29): a hit only ever counts within maxDist of the camera,
      // and every possible hit point lies inside the spot's bounding sphere — so beyond
      // (maxDist + radius + 2m) the recursive raycast cannot land and is pure waste (~33 of
      // them ran every frame from anywhere on the island). Squared distance, no sqrt. The
      // radius is measured once, lazily (prop SIZES are static); the centre is re-read each
      // frame from the cached matrixWorld — one frame stale at worst, which the +2m covers.
      if (spot._cullR === undefined) spot._cullR = this._measureCullRadius(spot);
      const reach = spot.maxDist + spot._cullR + 2;
      _cullC.setFromMatrixPosition(spot.targets[0].matrixWorld);
      if (camPos.distanceToSquared(_cullC) > reach * reach) continue;
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
          if (!(o.material && o.material.emissive !== undefined)) return;
          // clone a private glint material the first time this mesh is hovered (lazily, so any
          // async texture is already on the shared material) — so the highlight can't bleed
          // across other props sharing a module-level material
          if (!o.userData.glintMat) { o.material = o.material.clone(); o.userData.glintMat = true; }
          const mat = o.material;
          if (!this._glinted.has(mat)) {
            this._glinted.set(mat, { hex: mat.emissive.getHex(), intensity: mat.emissiveIntensity ?? 1 });
            if (mat.emissive.r + mat.emissive.g + mat.emissive.b < 0.01) mat.emissive.setHex(0xffb454);
            mat.emissiveIntensity = Math.max(0.25, (mat.emissiveIntensity ?? 1) * 1.6);
          }
        });
      }
    }
  }
}
