# Three.js for the Founder authoring pilot

Pinned npm release: `three@0.180.0`, MIT (see `LICENSE`).

Vendored files are `build/three.module.js`, `build/three.core.js`,
`examples/jsm/loaders/GLTFLoader.js`, and
`examples/jsm/utils/BufferGeometryUtils.js`. GLTFLoader's relative utility
import is changed to `./BufferGeometryUtils.js` to match this flat folder.
Other source is unmodified. Retrieved from the npm package through jsDelivr.

These modules are used by the offline Founder bake and its optional 3D review
view. They are not dependencies of the ordinary Realm game renderer.
