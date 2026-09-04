// Orbital Strike - Vanilla JS WebGL FPS
// Marathon-inspired corridor shooter

class OrbitalStrike {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = { x: 0, y: 1.5, z: 0, health: 100, maxHealth: 100 };
    // Reusable world-space player position; refreshed by syncPlayerPos() rather than
    // rebuilt at each call site, so every consumer reads the same current value.
    this.playerPos = new THREE.Vector3(this.player.x, this.player.y, this.player.z);
    this.weapons = [
      { name: 'Pulse Pistol', ammo: 50, startAmmo: 50, maxAmmo: 100, damage: 15, fireRate: 250, spread: 0, color: 0x9fffe4 },
      { name: 'Scatter Gun', ammo: 20, startAmmo: 20, maxAmmo: 40, damage: 8, fireRate: 800, pellets: 8, spread: 0.1, color: 0xffb45a }
    ];
    this.currentWeapon = 0;
    this.enemies = [];
    this.pickups = [];
    this.terminals = [];
    this.worldColliders = [];
    this.spawnNodes = [];
    this.effects = [];
    this.scorchMarks = [];
    this.keys = {};
    this.mouse = { x: 0, y: 0, locked: false };
    this.yaw = 0;
    this.pitch = 0;
    this.lastShot = 0;
    this.waveTimer = null;
    this.waveCountdown = 0;
    this.waveTransitionPending = false;
    this.muzzleTimer = null;
    this.hitMarkerTimer = null;
    this.damageTimer = null;
    this.pickupTimer = null;
    this.wave = 1;
    this.score = 0;
    this.gameState = 'menu';
    this.terminalContent = null;
    this.clockTime = 0;
    this.weaponRig = null;
    this.weaponModels = [];
    this.weaponKick = 0;
    this.cameraShake = 0;
    this.hasPointerLockSession = false;
    this.resumeState = 'playing';
    this.activeTerminal = null;
    this.visitedTerminals = new Set();
    this.logsRequired = 3;
    this.pendingCompletion = false;
    this.strike = { charge: 0, maxCharge: 100, state: 'idle', timer: 0, target: null, visual: null };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    this.lore = [
      { title: 'STATION LOG 001', text: 'Day 1: The mining operation on Orbital Station Theta-7 proceeds as planned. The AI core "PROMETHEUS" has been activated to manage station systems.' },
      { title: 'STATION LOG 047', text: 'Day 47: Strange readings from the AI core. PROMETHEUS has begun "optimizing" security protocols without authorization. Engineering reports unusual power fluctuations.' },
      { title: 'STATION LOG 089', text: 'Day 89: Contact lost with Earth. PROMETHEUS claims it is "protecting" us. Several crew members have gone missing. The drones... they watch us now.' },
      { title: 'STATION LOG 112', text: 'Day 112: I am the last one. PROMETHEUS has converted the others. The escape pods are disabled. If you are reading this... RUN.' },
      { title: 'PROMETHEUS SPEAKS', text: '// INTRUDER DETECTED // BIOLOGICAL CONTAMINATION MUST BE PURGED // STATION INTEGRITY IS PARAMOUNT // YOU CANNOT ESCAPE // I AM ETERNAL //' },
    ];
    
    this.init();
  }

  byId(id) {
    return document.getElementById(id);
  }

  setText(id, value) {
    const element = this.byId(id);
    if (!element) return;
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
  }

  setVisible(id, visible, display = 'flex') {
    const element = this.byId(id);
    if (!element) return;
    element.style.display = visible ? display : 'none';
    element.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  setStatus(message) {
    const status = this.byId('missionStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.add('visible', 'is-visible');
  }

  showWaveBanner(message) {
    const banner = this.byId('waveBanner');
    if (!banner) return;
    banner.textContent = '';
    void banner.offsetWidth;
    banner.textContent = message;
  }
  
  init() {
    this.radarCanvas = this.byId('radarCanvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
    this.setupRenderer();
    this.setupScene();
    this.setupLighting();
    this.generateLevel();
    this.spawnEnemies();
    this.spawnPickups();
    this.setupWeaponRig();
    this.setupControls();
    this.animate();
    this.updateUI();
  }
  
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x03090b);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'First-person view of the Theta-7 mining decks');
    this.renderer.domElement.setAttribute('tabindex', '-1');
    this.renderer.domElement.textContent = 'Orbital Strike game view. Use the HUD controls or keyboard to navigate.';
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 1.5, 0);
    
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03090b);
    this.scene.fog = new THREE.Fog(0x03090b, 7, 42);
    this.scene.add(this.camera);
  }
  
  setupLighting() {
    const ambient = new THREE.AmbientLight(0x86b8b1, 0.48);
    this.scene.add(ambient);
    const hemisphere = new THREE.HemisphereLight(0xa6ddd5, 0x071011, 0.26);
    this.scene.add(hemisphere);
    
    const playerLight = new THREE.PointLight(0x8fffe2, 1.55, 19, 1.8);
    playerLight.position.set(0, 2, 0);
    this.scene.add(playerLight);
    this.playerLight = playerLight;
  }
  
  generateLevel() {
    this.corridors = [
      { x: 0, z: 0, w: 8, d: 30 },
      { x: 15, z: 0, w: 8, d: 30 },
      { x: -15, z: 0, w: 8, d: 30 },
      { x: 0, z: 15, w: 40, d: 8 },
      { x: 0, z: -15, w: 40, d: 8 }
    ];

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x182527, roughness: 0.82, metalness: 0.35 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    this.scene.add(floor);
    this.worldColliders.push(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x071011, roughness: 0.86, metalness: 0.28 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    this.scene.add(ceiling);
    this.worldColliders.push(ceiling);

    const segments = this.collectBoundarySegments();
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x10191c, roughness: 0.72, metalness: 0.58 });
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2c2f, emissive: 0x030b0c, emissiveIntensity: 0.34, roughness: 0.5, metalness: 0.72 });
    const bulkheadMaterial = new THREE.MeshStandardMaterial({ color: 0x182629, emissive: 0x061112, emissiveIntensity: 0.28, roughness: 0.54, metalness: 0.76 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x52696b, emissive: 0x0b1718, emissiveIntensity: 0.24, roughness: 0.32, metalness: 0.9 });
    const panelFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x314447, roughness: 0.42, metalness: 0.82 });
    const coolantMaterial = new THREE.MeshStandardMaterial({ color: 0x7df8e7, emissive: 0x32bfae, emissiveIntensity: 1.05, roughness: 0.26, metalness: 0.45 });
    const amberMaterial = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xb86318, emissiveIntensity: 0.92, roughness: 0.3, metalness: 0.42 });
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, segments.length);
    const panels = new THREE.InstancedMesh(wallGeometry.clone(), panelMaterial, segments.length);
    const trims = new THREE.InstancedMesh(wallGeometry.clone(), coolantMaterial, segments.length);
    const dummy = new THREE.Object3D();
    const unitX = new THREE.Vector3(1, 0, 0);

    const beamMatrix = (start, end, thickness = 0.12) => {
      const direction = end.clone().sub(start);
      const length = direction.length();
      const position = start.clone().add(end).multiplyScalar(0.5);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(unitX, direction.normalize());
      return new THREE.Matrix4().compose(
        position,
        quaternion,
        new THREE.Vector3(length, thickness, thickness)
      );
    };

    const plateMatrix = (start, end, tangent, length, thickness = 0.11) => {
      const slope = end.clone().sub(start);
      const xAxis = tangent.clone().normalize();
      const yAxis = slope.clone().normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
      return new THREE.Matrix4().compose(
        start.clone().add(end).multiplyScalar(0.5),
        quaternion,
        new THREE.Vector3(length, slope.length(), thickness)
      );
    };

    const addInstanced = (name, material, matrices) => {
      if (!matrices.length) return null;
      const mesh = new THREE.InstancedMesh(wallGeometry.clone(), material, matrices.length);
      mesh.name = name;
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      return mesh;
    };

    const bulkheadMatrices = [];
    const bulkheadSeamMatrices = [];
    const panelFrameMatrices = [];
    const coolantIndicatorMatrices = [];
    const amberIndicatorMatrices = [];

    segments.forEach((segment, index) => {
      const tangent = segment.vertical
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(1, 0, 0);
      const inward = new THREE.Vector3(-segment.nx, 0, -segment.nz);
      const boundary = new THREE.Vector3(segment.x, 0, segment.z);
      const pointAt = (along, y, inset) => boundary.clone()
        .addScaledVector(tangent, along)
        .addScaledVector(inward, inset)
        .setY(y);

      dummy.position.set(segment.x, 2, segment.z);
      dummy.scale.set(segment.vertical ? 0.5 : segment.length + 0.03, 4, segment.vertical ? segment.length + 0.03 : 0.5);
      dummy.updateMatrix();
      walls.setMatrixAt(index, dummy.matrix);

      dummy.position.set(segment.x - segment.nx * 0.285, 2.02, segment.z - segment.nz * 0.285);
      dummy.scale.set(segment.vertical ? 0.035 : segment.length * 0.7, 1.28, segment.vertical ? segment.length * 0.7 : 0.035);
      dummy.updateMatrix();
      panels.setMatrixAt(index, dummy.matrix);

      dummy.position.set(segment.x - segment.nx * 0.3, 0.88, segment.z - segment.nz * 0.3);
      dummy.scale.set(segment.vertical ? 0.05 : segment.length * 0.9, 0.055, segment.vertical ? segment.length * 0.9 : 0.05);
      dummy.updateMatrix();
      trims.setMatrixAt(index, dummy.matrix);

      const lowerStart = pointAt(0, 0.08, 0.25);
      const lowerEnd = pointAt(0, 0.76, 0.96);
      const upperStart = pointAt(0, 3.92, 0.25);
      const upperEnd = pointAt(0, 3.18, 0.96);
      bulkheadMatrices.push(
        plateMatrix(lowerStart, lowerEnd, tangent, segment.length + 0.055),
        plateMatrix(upperStart, upperEnd, tangent, segment.length + 0.055)
      );

      const halfSegment = segment.length / 2 + 0.025;
      bulkheadSeamMatrices.push(
        beamMatrix(
          lowerEnd.clone().addScaledVector(tangent, -halfSegment),
          lowerEnd.clone().addScaledVector(tangent, halfSegment),
          0.065
        ),
        beamMatrix(
          upperEnd.clone().addScaledVector(tangent, -halfSegment),
          upperEnd.clone().addScaledVector(tangent, halfSegment),
          0.065
        )
      );

      const panelHalfWidth = segment.length * 0.34;
      const panelBottom = 1.35;
      const panelTop = 2.69;
      panelFrameMatrices.push(
        beamMatrix(pointAt(-panelHalfWidth, panelBottom, 0.325), pointAt(panelHalfWidth, panelBottom, 0.325), 0.065),
        beamMatrix(pointAt(-panelHalfWidth, panelTop, 0.325), pointAt(panelHalfWidth, panelTop, 0.325), 0.065),
        beamMatrix(pointAt(-panelHalfWidth, panelBottom, 0.325), pointAt(-panelHalfWidth, panelTop, 0.325), 0.065),
        beamMatrix(pointAt(panelHalfWidth, panelBottom, 0.325), pointAt(panelHalfWidth, panelTop, 0.325), 0.065)
      );

      const indicatorStart = pointAt(-0.2, 2.47, 0.355);
      const indicatorEnd = pointAt(0.2, 2.47, 0.355);
      (index % 5 === 0 ? amberIndicatorMatrices : coolantIndicatorMatrices)
        .push(beamMatrix(indicatorStart, indicatorEnd, 0.055));
    });

    [walls, panels, trims].forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    });
    this.worldColliders.push(walls);

    addInstanced('canted-bulkhead-plates', bulkheadMaterial, bulkheadMatrices);
    addInstanced('bulkhead-knee-seams', frameMaterial, bulkheadSeamMatrices);
    addInstanced('service-panel-frames', panelFrameMaterial, panelFrameMatrices);
    addInstanced('service-panel-coolant-status', coolantMaterial, coolantIndicatorMatrices);
    addInstanced('service-panel-amber-status', amberMaterial, amberIndicatorMatrices);

    const ribMatrices = [];
    this.corridors.forEach(corridor => {
      const vertical = corridor.d >= corridor.w;
      const runStart = vertical ? corridor.z - corridor.d / 2 + 2.5 : corridor.x - corridor.w / 2 + 2.5;
      const runEnd = vertical ? corridor.z + corridor.d / 2 - 2.5 : corridor.x + corridor.w / 2 - 2.5;
      const halfSpan = (vertical ? corridor.w : corridor.d) / 2 - 0.27;
      const bevel = Math.min(0.76, halfSpan * 0.23);
      const section = [
        [-halfSpan + bevel, 0.08],
        [halfSpan - bevel, 0.08],
        [halfSpan, 0.76],
        [halfSpan, 3.18],
        [halfSpan - bevel, 3.92],
        [-halfSpan + bevel, 3.92],
        [-halfSpan, 3.18],
        [-halfSpan, 0.76]
      ];
      const sectionPoint = (axis, lateral, y) => vertical
        ? new THREE.Vector3(corridor.x + lateral, y, axis)
        : new THREE.Vector3(axis, y, corridor.z + lateral);

      for (let axis = runStart; axis <= runEnd + 0.01; axis += 5) {
        section.forEach((point, index) => {
          const next = section[(index + 1) % section.length];
          ribMatrices.push(beamMatrix(
            sectionPoint(axis, point[0], point[1]),
            sectionPoint(axis, next[0], next[1]),
            0.17
          ));
        });
      }
    });
    addInstanced('continuous-octagonal-ribs', frameMaterial, ribMatrices);

    [[0, 0, 0x8fffe2], [0, 14, 0xffb45a], [0, -14, 0xff6657], [15, 0, 0x8fffe2], [-15, 0, 0x8fffe2]].forEach(([x, z, color]) => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.18), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 }));
      fixture.position.set(x, 3.78, z);
      this.scene.add(fixture);
      const light = new THREE.PointLight(color, 0.45, 11, 2);
      light.position.set(x, 3.4, z);
      this.scene.add(light);
    });

    const terminalPositions = [
      { x: 3.5, z: 10 }, { x: -3.5, z: -10 }, { x: 18.5, z: 5 }, { x: -18.5, z: -5 }, { x: 10, z: 11.5 }
    ];
    terminalPositions.forEach((pos, i) => {
      const terminalMat = new THREE.MeshStandardMaterial({ color: 0x79f5d6, emissive: 0x34c6a8, emissiveIntensity: 1.25, roughness: 0.3 });
      const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.55, 0.34), terminalMat);
      terminal.position.set(pos.x, 1.2, pos.z);
      terminal.userData = { type: 'terminal', index: i, visited: false };
      this.scene.add(terminal);
      this.terminals.push(terminal);
      const light = new THREE.PointLight(0x59f5d2, 0.35, 4.5, 2);
      light.position.set(pos.x, 1.5, pos.z);
      this.scene.add(light);
      terminal.userData.light = light;
    });
    this.buildSpawnNodes();
  }

  pointInLevel(x, z, margin = 0) {
    return this.corridors.some(corridor =>
      Math.abs(x - corridor.x) <= corridor.w / 2 - margin &&
      Math.abs(z - corridor.z) <= corridor.d / 2 - margin
    );
  }

  collectBoundarySegments() {
    const segments = [];
    const seen = new Set();
    const add = (x, z, length, vertical, nx, nz) => {
      const key = `${vertical ? 'v' : 'h'}:${x.toFixed(2)}:${z.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      segments.push({ x, z, length, vertical, nx, nz });
    };
    this.corridors.forEach(corridor => {
      const minX = corridor.x - corridor.w / 2;
      const maxX = corridor.x + corridor.w / 2;
      const minZ = corridor.z - corridor.d / 2;
      const maxZ = corridor.z + corridor.d / 2;
      for (let z = minZ; z < maxZ - 0.001; z += 2) {
        const length = Math.min(2, maxZ - z);
        const mid = z + length / 2;
        if (!this.pointInLevel(minX - 0.08, mid)) add(minX, mid, length, true, -1, 0);
        if (!this.pointInLevel(maxX + 0.08, mid)) add(maxX, mid, length, true, 1, 0);
      }
      for (let x = minX; x < maxX - 0.001; x += 2) {
        const length = Math.min(2, maxX - x);
        const mid = x + length / 2;
        if (!this.pointInLevel(mid, minZ - 0.08)) add(mid, minZ, length, false, 0, -1);
        if (!this.pointInLevel(mid, maxZ + 0.08)) add(mid, maxZ, length, false, 0, 1);
      }
    });
    return segments;
  }

  isWalkable(x, z, margin = 0.62) {
    return this.pointInLevel(x, z, margin);
  }

  buildSpawnNodes() {
    this.spawnNodes = [];
    for (let x = -19; x <= 19; x += 2.5) {
      for (let z = -18.5; z <= 18.5; z += 2.5) {
        if (this.isWalkable(x, z, 0.95)) this.spawnNodes.push(new THREE.Vector3(x, 0, z));
      }
    }
  }

  randomWalkablePoint(minPlayerDistance = 0, occupied = []) {
    if (!this.spawnNodes.length) return new THREE.Vector3(0, 0, 8);
    const start = Math.floor(Math.random() * this.spawnNodes.length);
    for (let offset = 0; offset < this.spawnNodes.length; offset++) {
      const node = this.spawnNodes[(start + offset) % this.spawnNodes.length];
      if (Math.hypot(node.x - this.player.x, node.z - this.player.z) < minPlayerDistance) continue;
      if (occupied.some(point => Math.hypot(node.x - point.x, node.z - point.z) < 2.2)) continue;
      return node.clone();
    }
    return this.spawnNodes[start].clone();
  }

  spawnEnemies() {
    this.waveTransitionPending = false;
    this.waveCountdown = 0;
    const count = Math.min(4 + (this.wave - 1) * 2, 16);
    const occupied = [];
    for (let i = 0; i < count; i++) {
      const type = this.wave >= 3 && i % 5 === 0 ? 'heavy' : this.wave >= 2 && i % 3 === 0 ? 'hunter' : 'scout';
      const drone = this.createDrone(type);
      const point = this.randomWalkablePoint(9, occupied);
      occupied.push(point);
      drone.position.set(point.x, drone.userData.baseY, point.z);
      drone.scale.setScalar(0.05);
      this.scene.add(drone);
      this.enemies.push(drone);
    }
    this.setStatus(`Wave ${this.wave}. ${count} drone contacts inbound.`);
    this.showWaveBanner(`Wave ${this.wave} // ${count} contacts`);
    this.updateUI();
  }

  createDrone(type = 'scout') {
    const heavy = type === 'heavy';
    const hunter = type === 'hunter';
    const drone = new THREE.Group();
    const signalColor = heavy ? 0xffa34a : hunter ? 0xd778ff : 0xff6657;
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: heavy ? 0x512b23 : hunter ? 0x38253f : 0x342526,
      emissive: signalColor,
      emissiveIntensity: 0.24,
      roughness: 0.34,
      metalness: 0.72,
      flatShading: true
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(heavy ? 0.72 : 0.56, 0), coreMaterial);
    core.scale.y = heavy ? 0.78 : 0.7;
    drone.add(core);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: signalColor, emissive: signalColor, emissiveIntensity: 0.78, roughness: 0.25, metalness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(heavy ? 0.86 : 0.7, 0.075, 4, 8), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    drone.add(ring);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffe29a, emissive: signalColor, emissiveIntensity: 2.2 });
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(heavy ? 0.19 : 0.14, 0), eyeMaterial);
    eye.position.z = heavy ? 0.68 : 0.55;
    drone.add(eye);
    const fins = new THREE.Group();
    for (let i = 0; i < (heavy ? 4 : 3); i++) {
      const angle = i / (heavy ? 4 : 3) * Math.PI * 2;
      const fin = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, heavy ? 0.68 : 0.5, 3),
        new THREE.MeshStandardMaterial({ color: 0x657477, roughness: 0.36, metalness: 0.82, flatShading: true })
      );
      fin.position.set(Math.cos(angle) * (heavy ? 0.87 : 0.7), 0, Math.sin(angle) * (heavy ? 0.87 : 0.7));
      fin.rotation.z = angle + Math.PI / 2;
      fin.rotation.y = angle;
      fins.add(fin);
    }
    drone.add(fins);
    const healthBase = heavy ? 82 : hunter ? 48 : 32;
    drone.userData = {
      type,
      health: healthBase + this.wave * (heavy ? 13 : 8),
      speed: (heavy ? 1.35 : hunter ? 2.65 : 1.9) + this.wave * 0.12,
      state: 'patrol',
      patrolAngle: Math.random() * Math.PI * 2,
      attackCooldown: 0.7 + Math.random() * 0.4,
      spawnProgress: 0,
      phase: Math.random() * Math.PI * 2,
      baseY: heavy ? 1.62 : 1.52,
      ring,
      fins,
      core,
      eye,
      signalColor,
      hitFlash: 0
    };
    // Preserve the convenient material/geometry surface that older smoke tests used.
    drone.material = coreMaterial;
    drone.geometry = core.geometry;
    drone.traverse(child => {
      if (child.isMesh) child.userData.enemyRoot = drone;
    });
    return drone;
  }
  
  spawnPickups() {
    const pickupTypes = [
      { type: 'health', color: 0xff4444, value: 25 },
      { type: 'pistol_ammo', color: 0xffaa44, value: 20 },
      { type: 'shotgun_ammo', color: 0x4444ff, value: 10 }
    ];
    
    const occupied = [];
    for (let i = 0; i < 6; i++) {
      const pType = pickupTypes[i % pickupTypes.length];
      const mat = new THREE.MeshStandardMaterial({ color: pType.color, emissive: pType.color, emissiveIntensity: 0.5 });
      const pickup = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
      const point = this.randomWalkablePoint(3.5, occupied);
      occupied.push(point);
      pickup.position.set(point.x, 0.55, point.z);
      pickup.userData = { type: pType.type, value: pType.value, baseY: 0.55, phase: Math.random() * Math.PI * 2 };
      this.scene.add(pickup);
      this.pickups.push(pickup);
    }
  }

  setupWeaponRig() {
    this.weaponRig = new THREE.Group();
    this.weaponRig.position.set(0.38, -0.36, -0.72);
    this.weaponRig.visible = false;
    this.camera.add(this.weaponRig);
    this.weaponModels = [this.createWeaponModel(false), this.createWeaponModel(true)];
    this.weaponModels.forEach((model, index) => {
      model.visible = index === this.currentWeapon;
      this.weaponRig.add(model);
    });
  }

  createWeaponModel(scatter) {
    const model = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x253436, roughness: 0.34, metalness: 0.82 });
    const shell = new THREE.MeshStandardMaterial({ color: scatter ? 0x684a30 : 0x426260, roughness: 0.38, metalness: 0.68 });
    const glowColor = scatter ? 0xffb45a : 0x8fffe2;
    const glow = new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 1.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(scatter ? 0.36 : 0.28, 0.22, scatter ? 0.78 : 0.58), dark);
    body.position.z = -0.06;
    model.add(body);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(scatter ? 0.43 : 0.32, 0.1, scatter ? 0.48 : 0.36), shell);
    shroud.position.set(0, 0.12, -0.18);
    model.add(shroud);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(scatter ? 0.07 : 0.045, scatter ? 0.08 : 0.055, scatter ? 0.58 : 0.46, scatter ? 6 : 5), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = scatter ? -0.62 : -0.49;
    model.add(barrel);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(scatter ? 0.24 : 0.18, 0.035, 0.28), glow);
    strip.position.set(0, 0.18, -0.12);
    model.add(strip);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.2), shell);
    grip.position.set(0, -0.23, 0.14);
    grip.rotation.x = -0.2;
    model.add(grip);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, scatter ? -0.93 : -0.75);
    model.add(muzzle);
    model.userData.muzzle = muzzle;
    return model;
  }

  updateWeaponRig(delta, moving) {
    if (!this.weaponRig) return;
    this.weaponKick = Math.max(0, this.weaponKick - delta * 7.5);
    const bob = moving ? Math.sin(this.clockTime * 10.5) * 0.012 : 0;
    const blend = Math.min(1, delta * 12);
    this.weaponRig.position.x += (0.38 + bob - this.weaponRig.position.x) * blend;
    this.weaponRig.position.y += (-0.36 - Math.abs(bob) - this.weaponKick * 0.055 - this.weaponRig.position.y) * blend;
    this.weaponRig.position.z += (-0.72 + this.weaponKick * 0.15 - this.weaponRig.position.z) * blend;
    this.weaponRig.rotation.x = this.weaponKick * 0.12;
    this.weaponRig.rotation.z = -bob * 0.7;
  }

  cycleWeapon() {
    if (this.gameState !== 'playing') return;
    this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length;
    this.weaponModels.forEach((model, index) => { model.visible = index === this.currentWeapon; });
    this.setStatus(`${this.weapons[this.currentWeapon].name} armed.`);
    this.updateUI();
  }

  syncPlayerPos() {
    return this.playerPos.set(this.player.x, this.player.y, this.player.z);
  }

  nearestTerminal() {
    const playerPos = this.syncPlayerPos();
    let terminal = null;
    let distance = Infinity;
    this.terminals.forEach(candidate => {
      const candidateDistance = candidate.position.distanceTo(playerPos);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        terminal = candidate;
      }
    });
    return { terminal, distance };
  }

  interactWithNearestTerminal() {
    if (this.gameState !== 'playing') return;
    const { terminal, distance } = this.nearestTerminal();
    if (terminal && distance < 2.25) this.showTerminal(terminal.userData.index);
  }
  
  setupControls() {
    document.addEventListener('keydown', e => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyP', 'Space'].includes(e.code)) e.preventDefault();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) this.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyR' && this.gameState === 'playing' && typeof this.requestOrbitalStrike === 'function') this.requestOrbitalStrike();
      if (e.code === 'KeyQ') this.cycleWeapon();
      if (e.code === 'KeyE') this.interactWithNearestTerminal();
    });
    document.addEventListener('keyup', e => this.keys[e.code] = false);
    
    document.addEventListener('mousemove', e => {
      if (this.mouse.locked && this.gameState === 'playing') {
        this.yaw -= e.movementX * 0.002;
        this.pitch -= e.movementY * 0.002;
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
      }
    });
    
    document.addEventListener('click', e => {
      if (e.target.closest('.touch-controls, .overlay, .terminal-overlay, .suite-home')) return;
      if (this.gameState === 'playing') {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        if (!this.mouse.locked) {
          this.requestPointerLock();
        } else {
          this.shoot();
        }
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.mouse.locked;
      this.mouse.locked = document.pointerLockElement === this.renderer.domElement;
      if (this.mouse.locked) this.hasPointerLockSession = true;
      if (wasLocked && !this.mouse.locked && this.gameState === 'playing') this.pauseGame('pointer');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameState === 'playing') this.pauseGame('visibility');
    });

    const startButton = this.byId('startBtn');
    const restartButton = this.byId('restartBtn');
    const extractionButton = this.byId('extractionBtn');
    const resumeButton = this.byId('resumeBtn');
    if (startButton) startButton.onclick = () => this.startGame();
    if (restartButton) restartButton.onclick = () => this.startGame();
    if (extractionButton) extractionButton.onclick = () => this.returnToBriefing();
    if (resumeButton) resumeButton.onclick = () => this.resumeGame();

    document.querySelectorAll('.touch-key').forEach(button => {
      const release = event => {
        event.preventDefault();
        event.stopPropagation();
        this.keys[button.dataset.key] = false;
        button.classList.remove('is-active');
        button.setAttribute('aria-pressed', 'false');
      };

      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        this.keys[button.dataset.key] = true;
        button.classList.add('is-active');
        button.setAttribute('aria-pressed', 'true');
        try { button.setPointerCapture(event.pointerId); } catch (_) { /* synthetic pointer */ }
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });

    document.querySelectorAll('.touch-action').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (this.gameState !== 'playing') return;
        if (button.dataset.action === 'fire') this.shoot();
        if (button.dataset.action === 'weapon') this.cycleWeapon();
        if (button.dataset.action === 'interact') this.interactWithNearestTerminal();
        if (button.dataset.action === 'strike' && typeof this.requestOrbitalStrike === 'function') this.requestOrbitalStrike();
      });
    });

    let touchLook = null;
    this.renderer.domElement.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || this.gameState !== 'playing') return;
      touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
      try { this.renderer.domElement.setPointerCapture(event.pointerId); } catch (_) { /* synthetic pointer */ }
    });
    this.renderer.domElement.addEventListener('pointermove', event => {
      if (!touchLook || event.pointerId !== touchLook.id) return;
      event.preventDefault();
      this.yaw -= (event.clientX - touchLook.x) * 0.006;
      this.pitch -= (event.clientY - touchLook.y) * 0.006;
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
      touchLook.x = event.clientX;
      touchLook.y = event.clientY;
    });
    const endTouchLook = event => {
      if (touchLook && event.pointerId === touchLook.id) touchLook = null;
    };
    this.renderer.domElement.addEventListener('pointerup', endTouchLook);
    this.renderer.domElement.addEventListener('pointercancel', endTouchLook);
  }

  requestPointerLock() {
    if (!this.renderer?.domElement?.requestPointerLock || window.matchMedia('(pointer: coarse)').matches) return;
    try {
      const result = this.renderer.domElement.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {
      // Pointer lock is optional in embedded and synthetic browsers.
    }
  }
  
  startGame() {
    this.resetGame();
    this.gameState = 'playing';
    this.setVisible('startScreen', false);
    this.setVisible('gameOverScreen', false);
    this.setVisible('missionCompleteScreen', false);
    this.setVisible('pauseScreen', false);
    this.setVisible('hud', true, 'block');
    document.body.classList.add('is-playing');
    document.body.classList.remove('is-paused');
    if (this.weaponRig) this.weaponRig.visible = true;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.focus({ preventScroll: true });
    this.requestPointerLock();
    this.setStatus('Deck insertion complete. Recover three station logs.');
  }

  resetGame(spawn = true) {
    clearTimeout(this.waveTimer);
    clearTimeout(this.muzzleTimer);
    clearTimeout(this.hitMarkerTimer);
    clearTimeout(this.damageTimer);
    clearTimeout(this.pickupTimer);
    this.waveTimer = null;
    this.waveCountdown = 0;
    this.waveTransitionPending = false;
    this.player.x = 0;
    this.player.z = 0;
    this.player.health = this.player.maxHealth;
    this.yaw = 0;
    this.pitch = 0;
    this.wave = 1;
    this.score = 0;
    this.lastShot = 0;
    this.currentWeapon = 0;
    this.weaponKick = 0;
    this.cameraShake = 0;
    this.pendingCompletion = false;
    this.activeTerminal = null;
    this.keys = {};
    this.weapons.forEach(w => w.ammo = w.startAmmo);
    this.clearActors();
    this.clearEffects();
    this.visitedTerminals.clear();
    this.terminals.forEach(terminal => this.setTerminalVisited(terminal, false));
    this.strike.charge = 0;
    this.strike.state = 'idle';
    this.strike.timer = 0;
    this.strike.target = null;
    document.body.classList.remove('strike-locking', 'strike-impact', 'is-critical');
    this.byId('strikeReticle')?.classList.remove('active', 'is-active', 'is-armed', 'is-locked');
    this.byId('strikeFlash')?.classList.remove('active', 'is-active');
    this.setText('interactionPrompt', '');
    this.setText('waveBanner', '');
    this.setVisible('terminalOverlay', false);
    this.weaponModels.forEach((model, index) => { model.visible = index === 0; });
    if (spawn) {
      this.spawnEnemies();
      this.spawnPickups();
    }
    this.updateUI();
  }

  returnToBriefing() {
    this.resetGame(false);
    this.gameState = 'menu';
    this.setVisible('hud', false);
    this.setVisible('gameOverScreen', false);
    this.setVisible('missionCompleteScreen', false);
    this.setVisible('pauseScreen', false);
    this.setVisible('startScreen', true);
    document.body.classList.remove('is-playing', 'is-paused', 'strike-impact', 'strike-locking');
    if (this.weaponRig) this.weaponRig.visible = false;
    this.byId('startBtn')?.focus({ preventScroll: true });
  }

  clearActors() {
    this.enemies.forEach(enemy => {
      this.scene.remove(enemy);
      this.disposeObject(enemy);
    });
    this.pickups.forEach(pickup => {
      this.scene.remove(pickup);
      this.disposeObject(pickup);
    });
    this.enemies = [];
    this.pickups = [];
  }

  clearEffects() {
    this.effects.forEach(effect => {
      this.scene.remove(effect.object);
      this.disposeObject(effect.object);
    });
    this.effects = [];
    if (this.strike.visual) {
      this.scene.remove(this.strike.visual);
      this.disposeObject(this.strike.visual);
      this.strike.visual = null;
    }
    this.scorchMarks.forEach(mark => {
      this.scene.remove(mark);
      this.disposeObject(mark);
    });
    this.scorchMarks = [];
  }

  disposeObject(object) {
    object?.traverse?.(child => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
      else child.material?.dispose?.();
    });
  }

  setTerminalVisited(terminal, visited) {
    terminal.userData.visited = visited;
    terminal.material.color.setHex(visited ? 0x6f755e : 0x79f5d6);
    terminal.material.emissive.setHex(visited ? 0xa26422 : 0x34c6a8);
    terminal.material.emissiveIntensity = visited ? 0.45 : 1.25;
    if (terminal.userData.light) {
      terminal.userData.light.color.setHex(visited ? 0xffa94f : 0x59f5d2);
      terminal.userData.light.intensity = visited ? 0.18 : 0.35;
    }
  }

  pauseGame(reason = 'manual') {
    if (this.gameState !== 'playing') return false;
    this.resumeState = 'playing';
    this.gameState = 'paused';
    this.setVisible('pauseScreen', true);
    document.body.classList.add('is-paused');
    this.setStatus(reason === 'visibility' ? 'Mission paused while this tab is hidden.' : 'Mission paused. Press P to resume.');
    if (reason !== 'pointer' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    this.byId('resumeBtn')?.focus({ preventScroll: true });
    return true;
  }

  resumeGame() {
    if (this.gameState !== 'paused') return false;
    this.gameState = this.resumeState;
    this.setVisible('pauseScreen', false);
    document.body.classList.remove('is-paused');
    this.renderer.domElement.focus({ preventScroll: true });
    this.requestPointerLock();
    return true;
  }

  togglePause() {
    if (this.gameState === 'playing') return this.pauseGame('manual');
    if (this.gameState === 'paused') return this.resumeGame();
    return false;
  }
  
  shoot() {
    if (this.gameState !== 'playing') return false;
    const now = Date.now();
    const weapon = this.weapons[this.currentWeapon];
    if (weapon.ammo <= 0 || now - this.lastShot < weapon.fireRate) return false;
    this.lastShot = now;
    weapon.ammo--;
    this.weaponKick = this.currentWeapon === 1 ? 1 : 0.62;

    const muzzleFlash = this.byId('muzzleFlash');
    if (muzzleFlash) {
      muzzleFlash.classList.add('active');
      clearTimeout(this.muzzleTimer);
      this.muzzleTimer = setTimeout(() => muzzleFlash.classList.remove('active'), 70);
    }

    this.camera.updateMatrixWorld(true);
    const muzzle = this.weaponModels[this.currentWeapon]?.userData.muzzle;
    const tracerStart = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : this.camera.position.clone();
    const pellets = weapon.pellets || 1;
    let landedHit = false;
    for (let i = 0; i < pellets; i++) {
      const dir = new THREE.Vector3(0, 0, -1);
      dir.x += (Math.random() - 0.5) * weapon.spread;
      dir.y += (Math.random() - 0.5) * weapon.spread;
      dir.normalize().applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const raycaster = new THREE.Raycaster(this.camera.position.clone(), dir, 0, 55);
      const hit = raycaster.intersectObjects([...this.worldColliders, ...this.enemies], true)[0];
      const endpoint = hit ? hit.point.clone() : this.camera.position.clone().addScaledVector(dir, 42);
      if (i < 4) this.createTracer(tracerStart, endpoint, weapon.color);
      if (!hit) continue;
      const enemy = this.getEnemyRoot(hit.object);
      if (enemy && this.enemies.includes(enemy)) {
        landedHit = true;
        this.damageEnemy(enemy, weapon.damage, 'weapon');
      } else {
        this.createImpact(hit.point, weapon.color);
      }
    }
    if (landedHit) this.showHitMarker();
    this.checkWaveCleared();
    this.updateUI();
    return true;
  }

  getEnemyRoot(object) {
    let current = object;
    while (current) {
      if (current.userData?.enemyRoot) return current.userData.enemyRoot;
      if (this.enemies.includes(current)) return current;
      current = current.parent;
    }
    return null;
  }

  showHitMarker() {
    const marker = this.byId('hitMarker');
    if (!marker) return;
    marker.classList.add('active');
    clearTimeout(this.hitMarkerTimer);
    this.hitMarkerTimer = setTimeout(() => marker.classList.remove('active'), 110);
  }

  damageEnemy(enemy, damage, source = 'weapon') {
    if (!this.enemies.includes(enemy)) return false;
    enemy.userData.health -= damage;
    enemy.userData.hitFlash = 0.11;
    enemy.userData.core.material.emissiveIntensity = 1.8;
    enemy.userData.eye.scale.setScalar(1.35);
    if (enemy.userData.health <= 0) {
      this.destroyEnemy(enemy, source);
      return true;
    }
    return false;
  }

  destroyEnemy(enemy, source = 'weapon') {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.enemies.splice(index, 1);
    const position = enemy.position.clone();
    const signalColor = enemy.userData.signalColor;
    const type = enemy.userData.type;
    this.scene.remove(enemy);
    this.disposeObject(enemy);
    this.createExplosion(position, signalColor, type === 'heavy' ? 22 : 14);
    this.score += type === 'heavy' ? 240 : type === 'hunter' ? 150 : 100;
    this.gainStrikeCharge(source === 'strike' ? 7 : type === 'heavy' ? 34 : 25);
  }

  checkWaveCleared() {
    if (this.enemies.length || this.waveTransitionPending || this.gameState !== 'playing') return;
    this.waveTransitionPending = true;
    this.wave++;
    this.waveCountdown = 2.3;
    this.setStatus(`Cordon broken. Wave ${this.wave} inbound.`);
    this.showWaveBanner(`Cordon clear // wave ${this.wave} inbound`);
    clearTimeout(this.waveTimer);
    this.waveTimer = null;
  }

  gainStrikeCharge(amount) {
    const wasReady = this.strike.charge >= this.strike.maxCharge;
    this.strike.charge = THREE.MathUtils.clamp(this.strike.charge + amount, 0, this.strike.maxCharge);
    if (!wasReady && this.strike.charge >= this.strike.maxCharge) this.setStatus('Orbital solution ready. Press R to designate impact.');
    this.updateStrikeUI();
  }

  updateStrikeUI() {
    const charge = Math.round(this.strike.charge);
    const percent = `${charge}%`;
    this.setText('strikeCharge', percent);
    const meter = this.byId('strikeMeter');
    if (meter) {
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', String(this.strike.maxCharge));
      meter.setAttribute('aria-valuenow', String(charge));
      meter.style.setProperty('--strike-charge', percent);
      if (meter.matches('progress, meter')) meter.value = charge;
      if (meter.classList.contains('strike-meter-fill') || meter.dataset.role === 'fill') meter.style.width = percent;
      const fill = this.byId('strikeFill') || meter.querySelector('.strike-fill, .strike-meter-fill, [data-strike-fill]');
      if (fill) fill.style.width = percent;
      meter.classList.toggle('is-ready', charge >= this.strike.maxCharge && this.strike.state === 'idle');
      const state = meter.querySelector('.strike-state');
      if (state) {
        state.textContent = this.strike.state === 'locking'
          ? 'Solution locking'
          : this.strike.state === 'impact'
            ? 'Penetrator away'
            : charge >= this.strike.maxCharge ? 'Solution ready' : 'Charging';
      }
    }
    document.querySelectorAll('[data-action="strike"]').forEach(button => {
      const ready = charge >= this.strike.maxCharge && this.strike.state === 'idle';
      button.disabled = !ready;
      button.setAttribute('aria-disabled', String(!ready));
      button.classList.toggle('is-ready', ready);
    });
  }

  resolveStrikeTarget() {
    this.camera.updateMatrixWorld(true);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const direction = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const floorDistance = direction.y < -0.035 ? (0.06 - origin.y) / direction.y : 14;
    const preferredDistance = THREE.MathUtils.clamp(floorDistance, 5, 20);
    const candidate = origin.clone().addScaledVector(direction, preferredDistance);
    if (this.isWalkable(candidate.x, candidate.z, 0.9)) {
      candidate.y = 0.06;
      return candidate;
    }

    const horizontal = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    for (let distance = 18; distance >= 3; distance -= 1) {
      const fallback = new THREE.Vector3(
        this.player.x + horizontal.x * distance,
        0.06,
        this.player.z + horizontal.z * distance
      );
      if (this.isWalkable(fallback.x, fallback.z, 0.9)) return fallback;
    }
    return new THREE.Vector3(this.player.x, 0.06, this.player.z);
  }

  requestOrbitalStrike() {
    if (this.gameState !== 'playing' || this.strike.state !== 'idle') return false;
    if (this.strike.charge < this.strike.maxCharge) {
      this.setStatus(`Orbital solution charging — ${Math.round(this.strike.charge)}%.`);
      return false;
    }

    this.strike.charge = 0;
    this.strike.state = 'locking';
    this.strike.timer = this.reducedMotion ? 0.12 : 0.82;
    this.strike.target = this.resolveStrikeTarget();
    this.createStrikeTelegraph(this.strike.target);
    document.body.classList.add('strike-locking');
    const reticle = this.byId('strikeReticle');
    reticle?.classList.add('active', 'is-active', 'is-armed');
    reticle?.classList.remove('is-locked');
    this.setStatus('Deck coordinates acquired. Hold vector for penetrator lock.');
    this.updateStrikeUI();
    return true;
  }

  createStrikeTelegraph(target) {
    if (this.strike.visual) {
      this.scene.remove(this.strike.visual);
      this.disposeObject(this.strike.visual);
    }
    const group = new THREE.Group();
    group.position.copy(target);
    const rings = [];
    [0.75, 1.45, 2.2].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.045, radius + 0.045, 48),
        new THREE.MeshBasicMaterial({
          color: index === 2 ? 0xff6657 : 0xffb14a,
          transparent: true,
          opacity: 0.84 - index * 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = index * 0.012;
      group.add(ring);
      rings.push(ring);
    });
    const guide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 4.4, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    );
    guide.position.y = 2.2;
    group.add(guide);
    const pin = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff1c4, blending: THREE.AdditiveBlending })
    );
    pin.position.y = 0.16;
    group.add(pin);
    group.userData = { rings, guide, pin };
    this.scene.add(group);
    this.strike.visual = group;
  }

  detonateOrbitalStrike() {
    const target = this.strike.target?.clone();
    if (!target) return;
    if (this.strike.visual) {
      this.scene.remove(this.strike.visual);
      this.disposeObject(this.strike.visual);
      this.strike.visual = null;
    }

    const group = new THREE.Group();
    group.position.copy(target);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.72, 24, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff6d5,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    beam.position.y = 12;
    group.add(beam);
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.72, 64),
      new THREE.MeshBasicMaterial({ color: 0xff6657, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    shock.rotation.x = -Math.PI / 2;
    shock.position.y = 0.08;
    group.add(shock);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    core.position.y = 0.38;
    group.add(core);
    const light = new THREE.PointLight(0xffd28a, 5.5, 18, 2);
    light.position.y = 1.6;
    group.add(light);
    group.userData = { beam, shock, core, light };
    this.scene.add(group);
    this.effects.push({ kind: 'strike', object: group, life: 0.72, maxLife: 0.72 });

    const casualties = this.applyBlastDamage(target, 6.5);
    this.createExplosion(target.clone().setY(0.55), 0xffb14a, 34);
    this.createExplosion(target.clone().setY(1.1), 0xfff6d5, 22);
    this.strike.state = 'impact';
    this.strike.timer = 0.72;
    this.cameraShake = this.reducedMotion ? 0 : 0.62;
    document.body.classList.remove('strike-locking');
    document.body.classList.add('strike-impact');
    const reticle = this.byId('strikeReticle');
    reticle?.classList.remove('is-armed');
    reticle?.classList.add('is-locked');
    const flash = this.byId('strikeFlash');
    if (flash) {
      flash.classList.remove('active', 'is-active');
      void flash.offsetWidth;
      flash.classList.add('active', 'is-active');
    }
    this.setStatus(casualties
      ? `Orbital penetrator confirmed. ${casualties} hostile${casualties === 1 ? '' : 's'} erased.`
      : 'Orbital penetrator confirmed. Deck structure breached.');
    this.checkWaveCleared();
    this.updateStrikeUI();
  }

  applyBlastDamage(target, radius) {
    let casualties = 0;
    [...this.enemies].forEach(enemy => {
      const distance = Math.hypot(enemy.position.x - target.x, enemy.position.z - target.z);
      if (distance > radius) return;
      const damage = 55 + (1 - distance / radius) * 125;
      if (this.damageEnemy(enemy, damage, 'strike')) casualties++;
    });
    return casualties;
  }

  updateStrike(delta) {
    if (this.strike.state === 'idle') return;
    this.strike.timer -= delta;
    if (this.strike.state === 'locking') {
      const progress = 1 - Math.max(0, this.strike.timer) / (this.reducedMotion ? 0.12 : 0.82);
      const visual = this.strike.visual;
      if (visual) {
        visual.rotation.y += delta * 0.9;
        visual.userData.rings?.forEach((ring, index) => {
          const scale = 1.12 - progress * 0.12 + Math.sin(this.clockTime * 8 + index) * 0.018;
          ring.scale.setScalar(scale);
        });
        visual.userData.pin.rotation.y += delta * 3;
      }
      if (progress > 0.62) this.byId('strikeReticle')?.classList.add('is-locked');
      if (this.strike.timer <= 0) this.detonateOrbitalStrike();
      return;
    }
    if (this.strike.state === 'impact' && this.strike.timer <= 0) {
      this.strike.state = 'idle';
      this.strike.target = null;
      document.body.classList.remove('strike-impact');
      const reticle = this.byId('strikeReticle');
      reticle?.classList.remove('active', 'is-active', 'is-armed', 'is-locked');
      this.byId('strikeFlash')?.classList.remove('active', 'is-active');
      this.updateStrikeUI();
    }
  }

  createTracer(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending });
    const tracer = new THREE.Line(geometry, material);
    this.scene.add(tracer);
    this.effects.push({ kind: 'tracer', object: tracer, life: 0.085, maxLife: 0.085 });
  }

  createImpact(point, color) {
    const impact = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    impact.position.copy(point);
    this.scene.add(impact);
    this.effects.push({ kind: 'impact', object: impact, life: 0.2, maxLife: 0.2 });
  }

  createExplosion(position, color, count) {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.1, Math.random() - 0.5).normalize().multiplyScalar(2.5 + Math.random() * 3));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.13, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(particles);
    this.effects.push({ kind: 'particles', object: particles, life: 0.62, maxLife: 0.62, velocities });
  }

  updateEffects(delta) {
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index];
      effect.life -= delta;
      const progress = 1 - Math.max(0, effect.life) / effect.maxLife;
      if (effect.kind === 'tracer' || effect.kind === 'impact') {
        effect.object.material.opacity = Math.max(0, 1 - progress);
        if (effect.kind === 'impact') effect.object.scale.setScalar(1 + progress * 3.2);
      } else if (effect.kind === 'particles') {
        const positions = effect.object.geometry.attributes.position;
        for (let i = 0; i < effect.velocities.length; i++) {
          const velocity = effect.velocities[i];
          velocity.y -= delta * 2.8;
          positions.array[i * 3] += velocity.x * delta;
          positions.array[i * 3 + 1] += velocity.y * delta;
          positions.array[i * 3 + 2] += velocity.z * delta;
        }
        positions.needsUpdate = true;
        effect.object.material.opacity = Math.max(0, 1 - progress);
      } else if (effect.kind === 'strike') {
        const { beam, shock, core, light } = effect.object.userData;
        beam.material.opacity = Math.max(0, 0.95 - progress * 0.72);
        beam.scale.x = beam.scale.z = 1 + progress * 0.45;
        shock.scale.setScalar(1 + progress * 9);
        shock.material.opacity = Math.max(0, 0.95 - progress);
        core.scale.setScalar(1 + progress * 4.5);
        core.material.opacity = Math.max(0, 1 - progress * 1.2);
        light.intensity = Math.max(0, 5.5 * (1 - progress));
      }
      if (effect.life > 0) continue;
      this.scene.remove(effect.object);
      this.disposeObject(effect.object);
      this.effects.splice(index, 1);
    }
  }
  
  update(delta) {
    if (this.gameState !== 'playing') return;
    this.clockTime += delta;
    this.syncPlayerPos();
    this.updateStrike(delta);
    this.updateEffects(delta);
    if (this.waveTransitionPending) {
      this.waveCountdown -= delta;
      if (this.waveCountdown <= 0) this.spawnEnemies();
    }
    if (this.keys.Space) this.shoot();

    const speed = 8 * delta;
    const dir = new THREE.Vector3();
    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    const nextX = this.player.x + dir.x * speed;
    if (this.isWalkable(nextX, this.player.z)) this.player.x = nextX;
    const nextZ = this.player.z + dir.z * speed;
    if (this.isWalkable(this.player.x, nextZ)) this.player.z = nextZ;

    const { terminal: nearestTerminal, distance: nearestDistance } = this.nearestTerminal();
    this.setText('interactionPrompt', nearestTerminal && nearestDistance < 2.25
      ? nearestTerminal.userData.visited ? 'Review recovered station log' : 'Recover station log'
      : '');

    this.cameraShake = Math.max(0, this.cameraShake - delta * 2.3);
    const shake = this.reducedMotion ? 0 : this.cameraShake;
    this.camera.position.set(
      this.player.x + (Math.random() - 0.5) * shake * 0.12,
      this.player.y + (Math.random() - 0.5) * shake * 0.09,
      this.player.z + (Math.random() - 0.5) * shake * 0.12
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.playerLight.position.copy(this.camera.position);
    this.updateWeaponRig(delta, moving);

    this.enemies.forEach(enemy => {
      const data = enemy.userData;
      data.spawnProgress = Math.min(1, data.spawnProgress + delta * 2.8);
      const spawnScale = 0.05 + (1 - Math.pow(1 - data.spawnProgress, 3)) * 0.95;
      enemy.scale.setScalar(spawnScale);
      enemy.position.y = data.baseY + Math.sin(this.clockTime * 2.7 + data.phase) * 0.12;
      data.ring.rotation.z += delta * (data.type === 'hunter' ? 3.8 : 2.2);
      data.fins.rotation.y -= delta * (data.type === 'heavy' ? 0.7 : 1.5);
      if (data.hitFlash > 0) {
        data.hitFlash -= delta;
        if (data.hitFlash <= 0) {
          data.core.material.emissiveIntensity = 0.24;
          data.eye.scale.setScalar(1);
        }
      }

      const dx = this.player.x - enemy.position.x;
      const dz = this.player.z - enemy.position.z;
      const dist = Math.hypot(dx, dz);
      let moveX = 0;
      let moveZ = 0;
      if (dist < 15) {
        data.state = 'chase';
        if (dist > 0.001) {
          moveX = dx / dist;
          moveZ = dz / dist;
        }
        data.attackCooldown -= delta;
        if (dist < (data.type === 'heavy' ? 2.15 : 1.72) && data.attackCooldown <= 0) {
          this.player.health -= data.type === 'heavy' ? 18 : data.type === 'hunter' ? 13 : 10;
          data.attackCooldown = data.type === 'heavy' ? 1.15 : 0.82;
          this.cameraShake = Math.max(this.cameraShake, 0.34);
          const damageFlash = this.byId('damageFlash');
          if (damageFlash) {
            damageFlash.classList.add('active');
            clearTimeout(this.damageTimer);
            this.damageTimer = setTimeout(() => damageFlash.classList.remove('active'), 150);
          }
          if (this.player.health <= 0) this.gameOver();
        }
      } else {
        data.state = 'patrol';
        data.patrolAngle += delta * 0.55;
        moveX = Math.cos(data.patrolAngle) * 0.28;
        moveZ = Math.sin(data.patrolAngle) * 0.28;
      }

      const step = data.speed * delta;
      const enemyNextX = enemy.position.x + moveX * step;
      const enemyNextZ = enemy.position.z + moveZ * step;
      if (this.isWalkable(enemyNextX, enemy.position.z, data.type === 'heavy' ? 1.0 : 0.78)) enemy.position.x = enemyNextX;
      else data.patrolAngle += Math.PI * 0.7;
      if (this.isWalkable(enemy.position.x, enemyNextZ, data.type === 'heavy' ? 1.0 : 0.78)) enemy.position.z = enemyNextZ;
      else data.patrolAngle += Math.PI * 0.7;
      enemy.lookAt(this.player.x, enemy.position.y, this.player.z);
    });

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.rotation.y += delta * 2;
      pickup.rotation.x += delta * 0.6;
      pickup.position.y = pickup.userData.baseY + Math.sin(this.clockTime * 2.4 + pickup.userData.phase) * 0.09;
      if (pickup.position.distanceTo(this.playerPos) < 1.5) {
        let label = '';
        if (pickup.userData.type === 'health') {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + pickup.userData.value);
          label = `Suit integrity +${pickup.userData.value}`;
        } else if (pickup.userData.type === 'pistol_ammo') {
          this.weapons[0].ammo = Math.min(this.weapons[0].maxAmmo, this.weapons[0].ammo + pickup.userData.value);
          label = `Pulse cells +${pickup.userData.value}`;
        } else if (pickup.userData.type === 'shotgun_ammo') {
          this.weapons[1].ammo = Math.min(this.weapons[1].maxAmmo, this.weapons[1].ammo + pickup.userData.value);
          label = `Scatter shells +${pickup.userData.value}`;
        }
        this.scene.remove(pickup);
        this.disposeObject(pickup);
        this.pickups.splice(i, 1);
        const notification = this.byId('pickupNotification');
        if (notification) {
          notification.textContent = label;
          notification.classList.add('visible');
          clearTimeout(this.pickupTimer);
          this.pickupTimer = setTimeout(() => notification.classList.remove('visible'), 1200);
        }
      }
    }

    this.updateUI();
  }
  
  showTerminal(index) {
    const lore = this.lore[index];
    const terminal = this.terminals.find(item => item.userData.index === index);
    if (!lore || !terminal) return;
    let recovered = false;
    if (!this.visitedTerminals.has(index)) {
      recovered = true;
      this.visitedTerminals.add(index);
      this.setTerminalVisited(terminal, true);
      this.score += 250;
      this.gainStrikeCharge(35);
      this.pendingCompletion = this.visitedTerminals.size >= this.logsRequired;
      this.setStatus(this.pendingCompletion
        ? 'Three station logs recovered. Extraction solution acquired.'
        : `Station log recovered. ${this.logsRequired - this.visitedTerminals.size} remain.`);
    }
    this.activeTerminal = terminal;
    this.setVisible('terminalOverlay', true);
    this.setText('terminalText', `${lore.title}\n\n${lore.text}${recovered ? '\n\n// LOG SEALED TO ORBITAL UPLINK //' : '\n\n// ARCHIVE ALREADY SYNCHRONIZED //'}`);
    this.gameState = 'terminal';
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    this.byId('closeTerminalBtn')?.focus({ preventScroll: true });
    this.updateUI();
  }
  
  closeTerminal() {
    this.setVisible('terminalOverlay', false);
    this.activeTerminal = null;
    if (this.pendingCompletion) {
      this.missionComplete();
      return;
    }
    this.gameState = 'playing';
    this.renderer.domElement.focus({ preventScroll: true });
    this.requestPointerLock();
  }

  missionComplete() {
    this.pendingCompletion = false;
    this.gameState = 'complete';
    clearTimeout(this.waveTimer);
    this.waveTransitionPending = false;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    this.score += 1000;
    this.setVisible('hud', false);
    this.setVisible('missionCompleteScreen', true);
    this.setText('completeScore', this.score);
    this.setText('completeLogs', `${this.visitedTerminals.size} / ${this.logsRequired}`);
    document.body.classList.remove('is-playing', 'is-paused', 'strike-impact', 'strike-locking');
    if (this.weaponRig) this.weaponRig.visible = false;
    this.byId('extractionBtn')?.focus({ preventScroll: true });
  }
  
  gameOver() {
    this.gameState = 'gameover';
    clearTimeout(this.waveTimer);
    this.waveTransitionPending = false;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    this.setVisible('hud', false);
    this.setText('finalScore', this.score);
    this.setText('finalWave', Math.max(0, this.wave - 1));
    this.setVisible('gameOverScreen', true);
    document.body.classList.remove('is-playing', 'is-paused', 'strike-impact', 'strike-locking');
    if (this.weaponRig) this.weaponRig.visible = false;
    this.byId('restartBtn')?.focus({ preventScroll: true });
  }
  
  updateUI() {
    const weapon = this.weapons[this.currentWeapon];
    const health = Math.max(0, this.player.health);
    const roundedHealth = Math.round(health);
    const healthFill = this.byId('healthFill');
    const healthWidth = `${THREE.MathUtils.clamp(health, 0, 100)}%`;
    if (healthFill && healthFill.style.width !== healthWidth) healthFill.style.width = healthWidth;
    this.setText('healthText', roundedHealth);
    const healthBar = document.querySelector('.health-bar');
    if (healthBar && healthBar.getAttribute('aria-valuenow') !== String(roundedHealth)) {
      healthBar.setAttribute('aria-valuenow', String(roundedHealth));
    }
    document.body.classList.toggle('is-critical', roundedHealth <= 28 && this.gameState === 'playing');
    this.setText('ammoCount', weapon.ammo);
    this.setText('maxAmmo', weapon.maxAmmo);
    const ammoDisplay = document.querySelector('.ammo-display');
    const ammoLabel = `${weapon.name}, ${weapon.ammo} of ${weapon.maxAmmo} rounds`;
    if (ammoDisplay && ammoDisplay.getAttribute('aria-label') !== ammoLabel) ammoDisplay.setAttribute('aria-label', ammoLabel);
    this.setText('weaponName', weapon.name);
    this.setText('waveNumber', this.wave);
    this.setText('enemiesRemaining', this.enemies.length);
    this.setText('logsRecovered', this.visitedTerminals.size);
    this.setText('logsRequired', this.logsRequired);
    this.setText('objectiveText', this.visitedTerminals.size >= this.logsRequired
      ? 'Extraction solution acquired'
      : this.visitedTerminals.size ? 'Recover remaining station logs' : 'Breach the drone cordon');
    const heading = ((214 - this.yaw * 180 / Math.PI) % 360 + 360) % 360;
    this.setText('headingValue', String(Math.round(heading)).padStart(3, '0'));
    const bearingRing = this.byId('bearingRing');
    if (bearingRing) bearingRing.style.transform = `translate(-50%, -50%) rotate(${-this.yaw * 180 / Math.PI * 0.14}deg)`;
    this.updateStrikeUI();

    const ctx = this.radarCtx;
    if (!ctx || !this.radarCanvas) return;
    const size = this.radarCanvas.width;
    const half = size / 2;
    ctx.clearRect(0, 0, size, size);
    this.enemies.forEach(e => {
      const dx = e.position.x - this.player.x;
      const dz = e.position.z - this.player.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const angle = Math.atan2(dz, dx) - this.yaw + Math.PI / 2;
        const r = (dist / 30) * (half - 6);
        ctx.fillStyle = e.userData.type === 'heavy' ? '#ffb14a' : e.userData.type === 'hunter' ? '#d778ff' : '#ff5c55';
        ctx.beginPath();
        ctx.arc(half + Math.sin(angle) * r, half - Math.cos(angle) * r, e.userData.type === 'heavy' ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    this.terminals.forEach(terminal => {
      const dx = terminal.position.x - this.player.x;
      const dz = terminal.position.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= 30) return;
      const angle = Math.atan2(dz, dx) - this.yaw + Math.PI / 2;
      const r = (dist / 30) * (half - 6);
      const x = half + Math.sin(angle) * r;
      const y = half - Math.cos(angle) * r;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = terminal.userData.visited ? '#688f88' : '#ffb14a';
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    });
    if (this.strike.target && this.strike.state !== 'idle') {
      const dx = this.strike.target.x - this.player.x;
      const dz = this.strike.target.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx) - this.yaw + Math.PI / 2;
      const r = Math.min(dist / 30, 1) * (half - 6);
      ctx.strokeStyle = '#fff1c4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(half + Math.sin(angle) * r, half - Math.cos(angle) * r, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const unrecovered = Math.max(0, this.logsRequired - this.visitedTerminals.size);
    const radarLabel = `${this.enemies.length} hostiles and ${unrecovered} unrecovered station logs in proximity view`;
    if (this.radarCanvas.getAttribute('aria-label') !== radarLabel) this.radarCanvas.setAttribute('aria-label', radarLabel);
  }
  
  animate() {
    let lastTime = performance.now();
    
    const loop = () => {
      const now = performance.now();
      // Clamp delta so a paused tab can't produce a huge step that tunnels through walls
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      
      this.update(delta);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    
    loop();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.game = new OrbitalStrike();
  
  document.getElementById('closeTerminalBtn').onclick = () => game.closeTerminal();
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && game.gameState === 'terminal') {
      game.closeTerminal();
    }
  });
});
