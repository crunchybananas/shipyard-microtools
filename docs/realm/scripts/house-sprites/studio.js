import * as THREE from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {mergeGeometries} from '../../vendor/three/BufferGeometryUtils.js';
import {HOUSE_ANCHOR, HOUSE_CAMERA, HOUSE_PROFILE, houseRow} from './contract.js';

// Source parts stay individually editable in Blender. Only this disposable
// offline renderer batches pieces with identical materials and install times.
export async function createHouseStudio({url, width = HOUSE_CAMERA.width, height = HOUSE_CAMERA.height} = {}) {
  const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
  renderer.setSize(width, height); renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const viewHeight = HOUSE_CAMERA.viewHeight;
  const camera = new THREE.OrthographicCamera(-viewHeight * width / height / 2, viewHeight * width / height / 2,
    viewHeight / 2, -viewHeight / 2, .1, 90);
  const elevation = HOUSE_CAMERA.elevation * Math.PI / 180;
  const target = new THREE.Vector3(0, (HOUSE_ANCHOR.y - .5) * viewHeight / Math.cos(elevation), 0);
  camera.position.copy(target).add(new THREE.Vector3(6, Math.sqrt(72) * Math.tan(elevation), 6).multiplyScalar(2));
  camera.lookAt(target); camera.updateMatrixWorld();
  const sky = new THREE.HemisphereLight('#c7d4db', '#756b52', 2.1); scene.add(sky);
  const sun = new THREE.DirectionalLight('#ffe5c3', 3.8);
  sun.position.set(-3.5, 16, 8); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 9, bottom: -6, near: .1, far: 35});
  sun.shadow.bias = -.00013; sun.shadow.normalBias = .025; sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#b1c6d5', .75); fill.position.set(5, 4, -4); scene.add(fill);
  const groundMat = new THREE.ShadowMaterial({color: '#252a20', opacity: .25, depthWrite: false});
  const spillMat = new THREE.MeshStandardMaterial({color: '#d2bea0', roughness: 1});
  const spillExtent = new THREE.Vector2(1.4, 1.22);
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.realmContactExtent = {value: spillExtent};
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 realmContactPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nrealmContactPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 realmContactPoint;\nuniform vec2 realmContactExtent;')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.a *= 1.0 - smoothstep(0.45, 1.28, length(max(abs(realmContactPoint.xz) - realmContactExtent, 0.0)));\n#include <tonemapping_fragment>');
  };
  spillMat.onBeforeCompile = shader => {
    shader.uniforms.realmSpillExtent = {value: spillExtent};
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 realmGroundPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nrealmGroundPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 realmGroundPoint;\nuniform vec2 realmSpillExtent;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb *= 1.0 - smoothstep(0.12, 1.12, length(max(abs(realmGroundPoint.xz) - realmSpillExtent, 0.0)));');
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; ground.receiveShadow = true; scene.add(ground);
  const gltf = await new GLTFLoader().loadAsync(url);
  const roots = [];
  gltf.scene.traverse(o => {if (typeof o.userData.realm_home === 'number') roots.push(o);});
  if (roots.length !== 12 || roots.some(o => o.userData.realm_profile !== HOUSE_PROFILE)) throw new Error('Expected the saved twelve-home architectural library');
  const bank = [], materials = new Set(), stats = {parts: 0, triangles: 0, batches: 0, normalMappedParts: 0};
  for (const source of roots) {
    const variant = source.userData.realm_home, tier = source.userData.realm_tier;
    source.position.set(0, 0, 0); source.updateMatrixWorld(true);
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const bins = new Map(), windows = [], lightGroup = new THREE.Group(); scene.add(lightGroup); lightGroup.visible = false;
    source.traverse(o => {
      if (!o.isMesh) return;
      const {realm_start: start, realm_end: end, realm_light: light} = o.userData;
      if (!(start >= 0 && start < end && end <= 16) || Array.isArray(o.material)) throw new Error(`Invalid house component ${o.name}`);
      if (light) {
        const bounds = new THREE.Box3().setFromObject(o), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        const normal = size.x < size.z ? new THREE.Vector3(Math.sign(center.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(center.z));
        windows.push({center, normal});
        if (normal.dot(camera.position.clone().sub(target)) > 0) {
          // A lamp sits just inside the real aperture. Frames, sills and wall
          // infill physically shadow its pool on the ground below the window.
          const lamp = new THREE.SpotLight('#ffd49a', 1.35, 7, .95, .65, 1.5);
          lamp.position.copy(center).addScaledVector(normal, -.018);
          lamp.target.position.copy(center).addScaledVector(normal, .9); lamp.target.position.y = 0;
          lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -.0001; lamp.shadow.normalBias = .006;
          lamp.shadow.camera.near = .01; lamp.shadow.camera.far = 8;
          lightGroup.add(lamp, lamp.target);
        }
      }
      const key = `${o.material.uuid}/${start}/${end}/${!!light}`;
      if (!bins.has(key)) bins.set(key, {material: o.material, start, end, light: !!light, geometry: []});
      bins.get(key).geometry.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      stats.parts++; stats.triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
      if (o.material.normalMap) stats.normalMappedParts++;
    });
    for (const bin of bins.values()) {
      const geometry = mergeGeometries(bin.geometry, false);
      if (!geometry) throw new Error('House component batch has incompatible geometry');
      for (const original of bin.geometry) original.dispose();
      const bodyMaterial = bin.material.clone();
      // A thin plaster gable is an authored wall, with both faces visible from
      // inside its unfinished timber frame.
      bodyMaterial.side = THREE.DoubleSide;
      const winterMaterial = bodyMaterial.clone();
      if (/House (thatch|slate|tile)/.test(bodyMaterial.name)) {
        winterMaterial.color.set('#d0d9d7'); winterMaterial.roughness = .97;
        winterMaterial.map = null;
        winterMaterial.metalness = 0; winterMaterial.normalScale.multiplyScalar(.65);
      }
      const emissionMaterial = new THREE.MeshBasicMaterial({color: '#ffd58b', toneMapped: false,
        side: THREE.DoubleSide, colorWrite: bin.light, depthWrite: true});
      for (const mat of [bodyMaterial, winterMaterial, emissionMaterial]) materials.add(mat);
      const part = new THREE.Mesh(geometry, bodyMaterial);
      part.castShadow = !bin.light; part.receiveShadow = true;
      part.userData = {start: bin.start, end: bin.end, light: bin.light, bodyMaterial, winterMaterial, emissionMaterial};
      group.add(part); stats.batches++;
    }
    bank[houseRow(variant, tier)] = {group, lightGroup, windows, variant, tier, dimensions: JSON.parse(source.userData.realm_dimensions)};
  }
  let selected, step = 15;
  function select(variant, tier, stage) {
    if (selected) {selected.group.visible = false; selected.lightGroup.visible = false;}
    selected = bank[houseRow(variant, tier)]; step = stage;
    if (!selected || !Number.isInteger(stage) || stage < 0 || stage > 15) throw new Error('Invalid home or construction stage');
    selected.group.visible = true;
    spillExtent.set(selected.dimensions.halfWidth, selected.dimensions.halfDepth);
    for (const part of selected.group.children) part.visible = part.userData.start <= stage && stage < part.userData.end;
  }
  function render(layer = 'body', season = 'summer') {
    if (!selected) throw new Error('Select a home before rendering');
    if (!['body', 'ground', 'emission', 'spill'].includes(layer)) throw new Error(`Unknown home layer ${layer}`);
    ground.visible = layer === 'ground' || layer === 'spill';
    ground.material = layer === 'spill' ? spillMat : groundMat;
    for (const lamp of [sky, sun, fill]) lamp.visible = layer !== 'spill';
    selected.lightGroup.visible = layer === 'spill' && step === 15;
    renderer.shadowMap.enabled = layer !== 'emission';
    for (const part of selected.group.children) {
      const data = part.userData;
      part.renderOrder = layer === 'emission' && data.light ? 1 : 0;
      part.material = layer === 'emission' ? data.emissionMaterial : season === 'winter' ? data.winterMaterial : data.bodyMaterial;
      if (layer !== 'emission') {
        part.material.colorWrite = layer === 'body';
        part.material.depthWrite = layer === 'body';
      }
    }
    renderer.render(scene, camera);
    return renderer.domElement;
  }
  function landmarks() {
    scene.updateMatrixWorld(true);
    const project = p => {const q = p.clone().project(camera); return {x: (q.x + 1) / 2, y: (1 - q.y) / 2};};
    const bounds = new THREE.Box3();
    for (const part of selected.group.children) if (part.visible) bounds.expandByObject(part);
    return {variant: selected.variant, tier: selected.tier, step, anchor: project(new THREE.Vector3()),
      worldBounds: {min: bounds.min.toArray(), max: bounds.max.toArray()},
      windows: selected.windows.map(({center, normal}) => ({...project(center), position: center.toArray(), normal: normal.toArray()}))};
  }
  function dispose() {
    for (const {group} of bank) for (const part of group.children) part.geometry.dispose();
    for (const mat of materials) mat.dispose();
    ground.geometry.dispose(); groundMat.dispose(); spillMat.dispose(); renderer.dispose();
  }
  return {renderer, camera, scene, bank, stats, select, render, landmarks, dispose};
}
