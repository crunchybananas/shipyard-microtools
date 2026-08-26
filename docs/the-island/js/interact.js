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
    // the glint runs as eased GROUPS, not one flat set: _live rises, and anything the
    // cursor has left decays in _fading rather than snapping back (see tickGlint)
    this._live = null;
    this._fading = [];
    this.glintStyle = 'rim';    // 'rim' | 'wash' | 'pulse' — see _applyGlint

    this.iris = document.getElementById('iris');
    // the dwell caption (#57): rest on a hotspot ~700ms and its authored label surfaces
    // in the whisper's own hand, riding beside the iris. Cleared on unhover/click/drag.
    this.labelEl = document.getElementById('hotlabel');
    this._labelTimer = null;

    dom.addEventListener('pointermove', (e) => {
      this.mousePx.x = e.clientX; this.mousePx.y = e.clientY;
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      this.iris.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (this.labelEl) this.labelEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (this.activeDrag) {
        this.activeDrag.spot.onDrag?.(e.movementX, e.movementY);
      }
    });

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button !== 0) return;   // #61: only the primary button touches the world
      this._hideLabel();   // the hand is acting now; the caption yields
      // #60: a touch has no hover history — raycast at the tap point NOW, so a single
      // tap interacts and a touch-drag on the crank turns it (the branches below then
      // see the freshly-set hover exactly as a mouse would)
      if (e.pointerType === 'touch') {
        this.mousePx.x = e.clientX; this.mousePx.y = e.clientY;
        this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
        this.update();
      }
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

  _hideLabel() {
    clearTimeout(this._labelTimer);
    this._labelTimer = null;
    if (this.labelEl) this.labelEl.classList.remove('show');
  }

  // ---- the hover glint -------------------------------------------------------
  //
  // It used to be a binary step: cross a hotspot and the prop was instantly amber,
  // leave and it was instantly not. Everything else in this UI eases — the iris ring
  // over 0.22s, the dwell caption over 0.35s — and the glint was the one hard cut in
  // the game, which is why it read as jarring. Worse, sweeping the crosshair along a
  // bookshelf STROBED: each spine hit full intensity for the frame or two the ray was
  // on it. A ramp fixes both at once, because a fast pass never reaches full.
  //
  // Groups, not one set. A→B hover changes push the old set into _fading and let it
  // decay while the new one rises, so brushing past three props leaves three settling
  // embers rather than three cuts.

  // THE CHARACTER, and why it is a rim. Switchable live via ABYME.glintStyle('wash'),
  // and tools/harness/glint.mjs photographs all three on the same prop from the same
  // camera so the choice is a look rather than an argument. What the photographs showed:
  //
  //   wash  — the old behaviour, warm the whole body. It does not highlight the prop,
  //           it REPLACES it. The rosewood music box became a featureless cream block
  //           with its brass escutcheon and grain gone; the brass valve wheel lost all
  //           its specular shading and read as a flat cutout. This is the same failure
  //           as #147 ("the music box banding unreadable"), self-inflicted on hover.
  //   pulse — wash that breathes. Same problem, now moving.
  //   rim   — a fresnel on the silhouette. The prop still looks like itself; only its
  //           edge warms. Kept the wood grain, the brass, the label, all of it.
  //
  // wash and pulse stay switchable on purpose: "why not just brighten it" is the
  // obvious next suggestion, and it is one console line away from being answered.
  _captureGlint(spot) {
    const mats = new Map();
    // size-aware (#44 catch): a fixed intensity reads as a catch-light on a fist-sized
    // ruler and as a FLOODLIT SLAB on a 3.4m standing stone. Scale by measured radius.
    const gain = Math.min(1.5, Math.max(0.14, 0.65 / Math.max(spot._cullR ?? 0.5, 0.3)));
    for (const t of spot.targets) {
      t.traverse((o) => {
        if (!(o.material && o.material.emissive !== undefined)) return;
        // clone a private glint material the first time this mesh is hovered (lazily, so any
        // async texture is already on the shared material) — so the highlight can't bleed
        // across other props sharing a module-level material
        if (!o.userData.glintMat) { o.material = o.material.clone(); o.userData.glintMat = true; }
        const mat = o.material;
        if (mats.has(mat)) return;
        // The base is stored ONCE, on the material, and never re-read from a value this
        // code may itself have written. Re-hovering a prop mid-fade would otherwise
        // capture the half-lit value as "normal" and the prop would never return.
        if (!mat.userData._glintBase) {
          mat.userData._glintBase = { hex: mat.emissive.getHex(), intensity: mat.emissiveIntensity ?? 1 };
        }
        if (this.glintStyle === 'rim') this._patchRim(mat);
        mats.set(mat, mat.userData._glintBase);
      });
    }
    return { mats, t: 0, dir: 1, gain, spot };
  }

  // A fresnel rim, injected into whichever lit shader the prop already uses. The body
  // colour is left alone entirely — only the silhouette warms.
  //
  // customProgramCacheKey is NOT optional here. three caches compiled programs by
  // material type + defines, and onBeforeCompile's edits are invisible to that key —
  // so a patched and an unpatched MeshStandardMaterial with identical parameters share
  // one program, and whichever compiles second gets the other's shader. An unpatched
  // material would then run the rim code against a uniform it does not own.
  _patchRim(mat) {
    if (mat.userData._rimPatched) return;
    mat.userData._rimPatched = true;
    mat.userData._rimU = { value: 0 };
    mat.userData._rimC = { value: new THREE.Color(0xffc270) };
    mat.onBeforeCompile = (s) => {
      s.uniforms.uRim = mat.userData._rimU;
      s.uniforms.uRimC = mat.userData._rimC;
      s.fragmentShader = s.fragmentShader
        .replace('void main() {', 'uniform float uRim;\nuniform vec3 uRimC;\nvoid main() {')
        // after <emissivemap_fragment> both `normal` (from normal_fragment_begin) and
        // `totalEmissiveRadiance` are in scope, and vViewPosition is a varying on every
        // lit material — standard, physical, phong and lambert alike.
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n\tfloat rimF = 1.0 - abs(dot(normalize(vViewPosition), normal));\n\ttotalEmissiveRadiance += uRimC * uRim * pow(rimF, 3.2);');
    };
    mat.customProgramCacheKey = () => 'abyme-rim';
    mat.needsUpdate = true;
  }

  _releaseGlint(g) {
    g.spot?.onGlint?.(0);
    for (const [mat, base] of g.mats) {
      mat.emissive.setHex(base.hex);
      mat.emissiveIntensity = base.intensity;
      if (mat.userData._rimU) mat.userData._rimU.value = 0;
      mat.userData._glintWrote = null;
    }
  }

  tickGlint(dt, elapsed) {
    const IN = 5.5, OUT = 3.2;                        // 1/seconds: ~0.18s up, ~0.31s down
    for (let i = this._fading.length - 1; i >= 0; i--) {
      const g = this._fading[i];
      g.t = Math.max(0, g.t - dt * OUT);
      if (g.t <= 0) { this._releaseGlint(g); this._fading.splice(i, 1); }
      else this._applyGlint(g, elapsed);
    }
    const live = this._live;
    if (!live) return;
    live.t = Math.min(1, live.t + dt * IN);
    this._applyGlint(live, elapsed);
  }

  _applyGlint(g, elapsed) {
    // smoothstep, so the ramp has no corner at either end
    const e = g.t * g.t * (3 - 2 * g.t);
    // 'pulse' only breathes once it has arrived, so the rise itself stays clean
    const beat = this.glintStyle === 'pulse' ? 1 + 0.13 * e * Math.sin(elapsed * 3.1) : 1;
    // A hotspot whose right response is not "light this mesh up" gets the EASED value
    // and does its own thing with it. The keeper's shelf is the case that wanted it:
    // its books are baked into a merged batch it shares with the boards and the doors,
    // so there is no mesh to glint — but every gilt letter on that batch is the only
    // thing reading a non-blank atlas cell, so nudging one emissive lifts the LETTERING
    // and nothing else. It arrives eased for free, which is the whole point of routing
    // it through here rather than through a raw hover boolean.
    g.spot?.onGlint?.(e * beat);
    for (const [mat, base] of g.mats) {
      // If something ELSE wrote this material since our last frame — a puzzle drive
      // pulsing a lamp — adopt its value as the base for this frame instead of
      // stomping it. game.tick runs before interact.update, so the drive is always
      // this frame's truth and we are the layer on top of it.
      const w = mat.userData._glintWrote;
      let bh = base.hex, bi = base.intensity;
      if (w && (mat.emissive.getHex() !== w.hex || mat.emissiveIntensity !== w.intensity)) {
        bh = mat.emissive.getHex(); bi = mat.emissiveIntensity ?? 1;
      }
      // RIM is the shipped one, and the body lift beside it is not decoration.
      // A fresnel term is zero wherever the surface faces you, so a flat prop seen
      // head-on — a sheet of paper on the desk, a notice on the wall — gets no rim at
      // all: 1 - cos(40 deg) raised to 2.2 is 0.036, which is nothing. The floor of
      // body lift is what those props run on, and it is ~4x gentler than the wash was,
      // so on a solid prop it never reaches "different material".
      const rim = this.glintStyle === 'rim';
      if (rim && mat.userData._rimU) mat.userData._rimU.value = e * beat * 1.25;
      if (bh < 0x030303) {
        // glint-from-dark: give it the amber and ride the intensity up from nothing.
        // NOT size-scaled under rim. g.gain exists because a body wash grows with the
        // prop's AREA, so one number is a catch-light on a ruler and a floodlit slab on
        // a standing stone. A rim is edge-only and scales itself, and running the lift
        // through gain made it worst exactly where it was least wanted: both the paper
        // notice and the music box clamp to gain 1.5, which is barely a tint on white
        // paper and a wash on dark rosewood.
        mat.emissive.setHex(0xffb454);
        mat.emissiveIntensity = (rim ? 0.12 : g.gain * 0.72) * e * beat;
      } else {
        // already-lit props keep their own colour and merely warm
        mat.emissiveIntensity = bi * (1 + (rim ? 0.10 : 0.55) * e * beat);
      }
      mat.userData._glintWrote = { hex: mat.emissive.getHex(), intensity: mat.emissiveIntensity };
    }
  }

  setGlintStyle(style) {
    if (style === this.glintStyle) return style;
    if (this._live) { this._releaseGlint(this._live); this._live = null; }
    for (const g of this._fading) this._releaseGlint(g);
    this._fading.length = 0;
    this.glintStyle = style;
    this.hovered = null;        // so the next update re-captures under the new style
    return style;
  }

  _setHover(spot) {
    if (spot === this.hovered) return;
    // the outgoing set does not snap back — it decays while the new one rises
    if (this._live) { this._live.dir = -1; this._fading.push(this._live); this._live = null; }
    this.hovered = spot;
    this.iris.classList.toggle('hot', !!spot);
    // drag affordance (#57): chevrons flank the iris over a drag hotspot — turn, not tap
    this.iris.classList.toggle('draggable', !!spot && spot.type === 'drag');
    // the dwell caption (#57): 700ms of rest surfaces the label (a function label may
    // depend on state — per-depth names — so it resolves at show time)
    this._hideLabel();
    if (spot && spot.label && this.labelEl) {
      this._labelTimer = setTimeout(() => {
        this.labelEl.textContent = typeof spot.label === 'function' ? spot.label() : spot.label;
        this.labelEl.classList.add('show');
      }, 700);
    }
    if (spot && !spot.noGlint) this._live = this._captureGlint(spot);
  }
}
