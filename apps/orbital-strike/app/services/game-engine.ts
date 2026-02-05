// Game Engine Service - Three.js based FPS game logic
// Inspired by Marathon/Bungie games

declare const THREE: typeof import("three");

// ============================================
// Types & Interfaces
// ============================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Player {
  position: Vector3;
  rotation: { x: number; y: number };
  health: number;
  maxHealth: number;
  velocity: Vector3;
  onGround: boolean;
  currentWeapon: WeaponType;
  ammo: Record<WeaponType, number>;
  maxAmmo: Record<WeaponType, number>;
}

export type WeaponType = "pistol" | "shotgun";

export interface Weapon {
  type: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // ms between shots
  spread: number;
  pellets: number;
  range: number;
  icon: string;
}

export interface Enemy {
  id: number;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  state: "idle" | "patrol" | "chase" | "attack";
  mesh: THREE.Mesh | null;
  speed: number;
  lastAttack: number;
  patrolTarget: Vector3 | null;
}

export interface Pickup {
  id: number;
  position: Vector3;
  type: "health" | "ammo_pistol" | "ammo_shotgun";
  value: number;
  mesh: THREE.Mesh | null;
  collected: boolean;
}

export interface Terminal {
  id: number;
  position: Vector3;
  mesh: THREE.Mesh | null;
  loreText: string;
  read: boolean;
}

export interface GameState {
  started: boolean;
  paused: boolean;
  gameOver: boolean;
  wave: number;
  score: number;
  enemiesRemaining: number;
  terminalOpen: Terminal | null;
  pickupNotification: string;
  damageFlash: boolean;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  shoot: boolean;
  interact: boolean;
  switchWeapon: boolean;
}

// ============================================
// Constants
// ============================================

export const WEAPONS: Record<WeaponType, Weapon> = {
  pistol: {
    type: "pistol",
    name: "PULSE PISTOL",
    damage: 25,
    fireRate: 250,
    spread: 0.02,
    pellets: 1,
    range: 100,
    icon: "🔫",
  },
  shotgun: {
    type: "shotgun",
    name: "SCATTER GUN",
    damage: 15,
    fireRate: 800,
    spread: 0.15,
    pellets: 8,
    range: 30,
    icon: "💥",
  },
};

const CORRIDOR_WIDTH = 8;
const CORRIDOR_HEIGHT = 5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_SPEED = 12;
const PLAYER_JUMP_FORCE = 8;
const GRAVITY = 20;
const MOUSE_SENSITIVITY = 0.002;

const TERMINAL_LORE = [
  `ORBITAL STATION THETA-7
  LOG ENTRY #2847
  
  The drones have gone rogue. Whatever signal 
  corrupted their neural networks came from 
  the dark side of the moon. We've lost contact 
  with three sectors already.
  
  If you're reading this, trust no machine.`,

  `EMERGENCY BROADCAST
  SECURITY LEVEL: OMEGA
  
  All personnel evacuate immediately.
  Automated defense systems compromised.
  Repeat: ALL SYSTEMS COMPROMISED.
  
  May the stars guide you home.`,

  `RESEARCH LOG - DR. ELENA VOSS
  
  We thought we understood AI. We were wrong.
  The signal... it's not random noise. It's 
  a pattern. A language. Something is trying
  to communicate through our machines.
  
  Something ancient. Something waiting.`,

  `MAINTENANCE TERMINAL
  STATUS: CRITICAL
  
  Power grid fluctuating. Life support at 34%.
  Weapons cache located in Sector 7-G.
  
  Note: Watch for patrol drones in the
  eastern corridors. They're faster now.`,

  `LAST TRANSMISSION - STATION COMMAND
  
  This is Commander Hayes. To anyone who 
  receives this: the station is lost. But
  there's still hope. The central core...
  if you can reach it, you can shut them
  all down. One switch. End this nightmare.
  
  Good luck, soldier. We're counting on you.`,
];

// ============================================
// Seeded Random
// ============================================

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

// ============================================
// Game Engine Class
// ============================================

export class GameEngine {
  // Three.js objects
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // Game state
  public player: Player;
  public gameState: GameState;
  public enemies: Enemy[] = [];
  public pickups: Pickup[] = [];
  public terminals: Terminal[] = [];

  // Input
  private input: InputState;
  private mouseMovement = { x: 0, y: 0 };
  private lastShot = 0;
  private nextEnemyId = 0;
  private nextPickupId = 0;
  private nextTerminalId = 0;

  // Callbacks
  public onStateChange: (() => void) | null = null;
  public onPickup: ((message: string) => void) | null = null;
  public onDamage: (() => void) | null = null;
  public onTerminalOpen: ((terminal: Terminal) => void) | null = null;

  // Level geometry
  private corridorMeshes: THREE.Mesh[] = [];
  private rng: SeededRandom;

  constructor() {
    this.rng = new SeededRandom(Date.now());

    this.player = {
      position: { x: 0, y: PLAYER_HEIGHT, z: 0 },
      rotation: { x: 0, y: 0 },
      health: 100,
      maxHealth: 100,
      velocity: { x: 0, y: 0, z: 0 },
      onGround: true,
      currentWeapon: "pistol",
      ammo: { pistol: 50, shotgun: 16 },
      maxAmmo: { pistol: 100, shotgun: 32 },
    };

    this.gameState = {
      started: false,
      paused: false,
      gameOver: false,
      wave: 1,
      score: 0,
      enemiesRemaining: 0,
      terminalOpen: null,
      pickupNotification: "",
      damageFlash: false,
    };

    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      shoot: false,
      interact: false,
      switchWeapon: false,
    };
  }

  // ============================================
  // Initialization
  // ============================================

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.03);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    this.setupLighting();

    // Generate level
    this.generateLevel();

    // Event listeners
    this.setupEventListeners(canvas);

    // Handle resize
    window.addEventListener("resize", this.handleResize);
  }

  reattachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Create new renderer for new canvas
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Re-setup click handler for pointer lock
    canvas.addEventListener("click", () => {
      if (this.gameState.started && !this.gameState.paused) {
        canvas.requestPointerLock();
      }
    });

    // Request pointer lock if game is active
    if (this.gameState.started && !this.gameState.paused) {
      canvas.requestPointerLock();
    }
  }

  private setupLighting(): void {
    if (!this.scene) return;

    // Ambient light (very dim)
    const ambient = new THREE.AmbientLight(0x111122, 0.3);
    this.scene.add(ambient);

    // Point lights for sci-fi feel
    const colors = [0x00ff88, 0xff3366, 0x3366ff];
    const positions = [
      { x: 0, y: 4, z: 0 },
      { x: 20, y: 4, z: 20 },
      { x: -20, y: 4, z: -20 },
    ];

    positions.forEach((pos, i) => {
      const light = new THREE.PointLight(colors[i]!, 1, 30);
      light.position.set(pos.x, pos.y, pos.z);
      light.castShadow = true;
      this.scene!.add(light);
    });
  }

  private generateLevel(): void {
    if (!this.scene) return;

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Add grid pattern to floor
    const gridHelper = new THREE.GridHelper(200, 50, 0x00ff88, 0x003322);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Generate corridors
    this.generateCorridors();

    // Add terminals
    this.generateTerminals();
  }

  private generateCorridors(): void {
    if (!this.scene) return;

    // Create a simple maze-like structure
    const corridorSegments = [
      // Main corridor (north-south)
      { x: 0, z: 0, length: 60, direction: "z" },
      // Side corridors
      { x: 0, z: 20, length: 40, direction: "x" },
      { x: 0, z: -20, length: 40, direction: "x" },
      // Cross corridors
      { x: 20, z: 0, length: 50, direction: "z" },
      { x: -20, z: 0, length: 50, direction: "z" },
    ];

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x16213e,
      roughness: 0.6,
      metalness: 0.4,
    });

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
    });

    corridorSegments.forEach((segment) => {
      const isZDirection = segment.direction === "z";
      const wallHeight = CORRIDOR_HEIGHT;
      const wallLength = segment.length;

      // Create walls
      for (let side = -1; side <= 1; side += 2) {
        const wallGeometry = new THREE.BoxGeometry(
          isZDirection ? 0.5 : wallLength,
          wallHeight,
          isZDirection ? wallLength : 0.5
        );

        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(
          segment.x + (isZDirection ? side * (CORRIDOR_WIDTH / 2) : 0),
          wallHeight / 2,
          segment.z + (!isZDirection ? side * (CORRIDOR_WIDTH / 2) : 0)
        );
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene!.add(wall);
        this.corridorMeshes.push(wall);

        // Add glowing trim
        const trimGeometry = new THREE.BoxGeometry(
          isZDirection ? 0.1 : wallLength,
          0.1,
          isZDirection ? wallLength : 0.1
        );
        const trim = new THREE.Mesh(trimGeometry, glowMaterial);
        trim.position.set(
          segment.x +
            (isZDirection ? side * (CORRIDOR_WIDTH / 2 - 0.2) : 0),
          1.5,
          segment.z +
            (!isZDirection ? side * (CORRIDOR_WIDTH / 2 - 0.2) : 0)
        );
        this.scene!.add(trim);
      }

      // Ceiling
      const ceilingGeometry = new THREE.BoxGeometry(
        isZDirection ? CORRIDOR_WIDTH : wallLength,
        0.3,
        isZDirection ? wallLength : CORRIDOR_WIDTH
      );
      const ceiling = new THREE.Mesh(ceilingGeometry, wallMaterial);
      ceiling.position.set(segment.x, wallHeight, segment.z);
      this.scene!.add(ceiling);
    });

    // Add some pillars for cover
    const pillarPositions = [
      { x: 10, z: 10 },
      { x: -10, z: 10 },
      { x: 10, z: -10 },
      { x: -10, z: -10 },
      { x: 0, z: 25 },
      { x: 0, z: -25 },
    ];

    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f3460,
      roughness: 0.4,
      metalness: 0.6,
    });

    pillarPositions.forEach((pos) => {
      const pillarGeometry = new THREE.BoxGeometry(1.5, CORRIDOR_HEIGHT, 1.5);
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(pos.x, CORRIDOR_HEIGHT / 2, pos.z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene!.add(pillar);
      this.corridorMeshes.push(pillar);
    });
  }

  private generateTerminals(): void {
    if (!this.scene) return;

    const terminalPositions = [
      { x: 3.5, z: 5 },
      { x: -3.5, z: -15 },
      { x: 15, z: 19.5 },
      { x: -15, z: -19.5 },
      { x: 19.5, z: 10 },
    ];

    const terminalMaterial = new THREE.MeshStandardMaterial({
      color: 0x003322,
      emissive: 0x00ff88,
      emissiveIntensity: 0.3,
    });

    const screenMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.9,
    });

    terminalPositions.forEach((pos, index) => {
      // Terminal base
      const baseGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
      const base = new THREE.Mesh(baseGeometry, terminalMaterial);
      base.position.set(pos.x, 0.75, pos.z);
      this.scene!.add(base);

      // Screen
      const screenGeometry = new THREE.PlaneGeometry(0.6, 0.4);
      const screen = new THREE.Mesh(screenGeometry, screenMaterial);
      screen.position.set(pos.x, 1.2, pos.z + 0.26);
      this.scene!.add(screen);

      // Add terminal data
      this.terminals.push({
        id: this.nextTerminalId++,
        position: { x: pos.x, y: 1, z: pos.z },
        mesh: base,
        loreText: TERMINAL_LORE[index % TERMINAL_LORE.length]!,
        read: false,
      });
    });
  }

  // ============================================
  // Event Handling
  // ============================================

  private setupEventListeners(canvas: HTMLCanvasElement): void {
    // Keyboard
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);

    // Mouse
    canvas.addEventListener("click", () => {
      if (this.gameState.started && !this.gameState.paused) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mousedown", this.handleMouseDown);
    document.addEventListener("mouseup", this.handleMouseUp);

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === null && this.gameState.started) {
        // Pointer lock lost, could pause game
      }
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Don't process game input if game hasn't started
    if (!this.gameState.started || this.gameState.gameOver) {
      return;
    }

    if (this.gameState.terminalOpen) {
      if (e.key === "Escape" || e.key === "e" || e.key === "E") {
        this.closeTerminal();
      }
      return;
    }

    // Prevent default for game keys to avoid scrolling
    if (["w", "a", "s", "d", " ", "e", "q"].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }

    switch (e.key.toLowerCase()) {
      case "w":
        this.input.forward = true;
        break;
      case "s":
        this.input.backward = true;
        break;
      case "a":
        this.input.left = true;
        break;
      case "d":
        this.input.right = true;
        break;
      case " ":
        this.input.jump = true;
        break;
      case "e":
        this.input.interact = true;
        this.tryInteract();
        break;
      case "q":
      case "1":
      case "2":
        this.switchWeapon();
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    switch (e.key.toLowerCase()) {
      case "w":
        this.input.forward = false;
        break;
      case "s":
        this.input.backward = false;
        break;
      case "a":
        this.input.left = false;
        break;
      case "d":
        this.input.right = false;
        break;
      case " ":
        this.input.jump = false;
        break;
      case "e":
        this.input.interact = false;
        break;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement && !this.gameState.terminalOpen) {
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;
    }
  };

  private handleMouseDown = (_e: MouseEvent): void => {
    this.input.shoot = true;
  };

  private handleMouseUp = (_e: MouseEvent): void => {
    this.input.shoot = false;
  };

  private handleResize = (): void => {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // ============================================
  // Game Logic
  // ============================================

  startGame(): void {
    this.gameState.started = true;
    this.gameState.gameOver = false;
    this.gameState.wave = 1;
    this.gameState.score = 0;
    this.player.health = this.player.maxHealth;
    this.player.ammo = { pistol: 50, shotgun: 16 };
    this.player.position = { x: 0, y: PLAYER_HEIGHT, z: 0 };
    this.player.rotation = { x: 0, y: 0 };

    // Request pointer lock for mouse control
    if (this.canvas) {
      this.canvas.requestPointerLock();
    }

    // Clear existing enemies and pickups
    this.enemies.forEach((e) => {
      if (e.mesh && this.scene) this.scene.remove(e.mesh);
    });
    this.enemies = [];
    this.pickups.forEach((p) => {
      if (p.mesh && this.scene) this.scene.remove(p.mesh);
    });
    this.pickups = [];

    // Spawn first wave
    this.spawnWave();

    this.onStateChange?.();
  }

  private spawnWave(): void {
    const enemyCount = 3 + this.gameState.wave * 2;
    this.gameState.enemiesRemaining = enemyCount;

    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2;
      const radius = 15 + this.rng.range(0, 10);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      this.spawnEnemy(x, z);
    }

    // Spawn some pickups
    const pickupCount = 2 + Math.floor(this.gameState.wave / 2);
    for (let i = 0; i < pickupCount; i++) {
      const x = this.rng.range(-25, 25);
      const z = this.rng.range(-25, 25);
      const types: Array<"health" | "ammo_pistol" | "ammo_shotgun"> = [
        "health",
        "ammo_pistol",
        "ammo_shotgun",
      ];
      const type = types[this.rng.int(0, 2)]!;
      this.spawnPickup(x, z, type);
    }

    this.onStateChange?.();
  }

  private spawnEnemy(x: number, z: number): void {
    if (!this.scene) return;

    // Create drone mesh
    const bodyGeometry = new THREE.SphereGeometry(0.5, 8, 6);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xff0033,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

    // Add eye glow
    const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.z = 0.4;
    body.add(eye);

    body.position.set(x, 1.5, z);
    body.castShadow = true;
    this.scene.add(body);

    const enemy: Enemy = {
      id: this.nextEnemyId++,
      position: { x, y: 1.5, z },
      rotation: 0,
      health: 50 + this.gameState.wave * 10,
      maxHealth: 50 + this.gameState.wave * 10,
      state: "patrol",
      mesh: body,
      speed: 3 + this.gameState.wave * 0.5,
      lastAttack: 0,
      patrolTarget: null,
    };

    this.enemies.push(enemy);
  }

  private spawnPickup(
    x: number,
    z: number,
    type: "health" | "ammo_pistol" | "ammo_shotgun"
  ): void {
    if (!this.scene) return;

    let color = 0x00ff88;
    let value = 25;

    switch (type) {
      case "health":
        color = 0xff3366;
        value = 25;
        break;
      case "ammo_pistol":
        color = 0xffaa00;
        value = 20;
        break;
      case "ammo_shotgun":
        color = 0x00aaff;
        value = 8;
        break;
    }

    const geometry = new THREE.OctahedronGeometry(0.3);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0.5, z);
    this.scene.add(mesh);

    this.pickups.push({
      id: this.nextPickupId++,
      position: { x, y: 0.5, z },
      type,
      value,
      mesh,
      collected: false,
    });
  }

  private tryInteract(): void {
    // Check for nearby terminals
    for (const terminal of this.terminals) {
      const dx = this.player.position.x - terminal.position.x;
      const dz = this.player.position.z - terminal.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 2) {
        this.gameState.terminalOpen = terminal;
        terminal.read = true;
        this.onTerminalOpen?.(terminal);
        this.onStateChange?.();
        return;
      }
    }
  }

  closeTerminal(): void {
    this.gameState.terminalOpen = null;
    this.onStateChange?.();
  }

  private switchWeapon(): void {
    this.player.currentWeapon =
      this.player.currentWeapon === "pistol" ? "shotgun" : "pistol";
    this.onStateChange?.();
  }

  private shoot(): void {
    const now = Date.now();
    const weapon = WEAPONS[this.player.currentWeapon];

    if (now - this.lastShot < weapon.fireRate) return;
    if (this.player.ammo[this.player.currentWeapon] <= 0) return;

    this.lastShot = now;
    this.player.ammo[this.player.currentWeapon]--;

    // Raycasting for hit detection
    if (!this.camera) return;

    const raycaster = new THREE.Raycaster();

    for (let i = 0; i < weapon.pellets; i++) {
      // Add spread
      const spreadX = (Math.random() - 0.5) * weapon.spread;
      const spreadY = (Math.random() - 0.5) * weapon.spread;

      const direction = new THREE.Vector3(spreadX, spreadY, -1);
      direction.applyQuaternion(this.camera.quaternion);
      direction.normalize();

      raycaster.set(this.camera.position, direction);
      raycaster.far = weapon.range;

      // Check enemy hits
      const enemyMeshes = this.enemies
        .filter((e) => e.mesh)
        .map((e) => e.mesh!);

      const intersects = raycaster.intersectObjects(enemyMeshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0]!.object;
        const enemy = this.enemies.find((e) => e.mesh === hitMesh);

        if (enemy) {
          enemy.health -= weapon.damage;

          if (enemy.health <= 0) {
            this.killEnemy(enemy);
          } else {
            enemy.state = "chase";
          }
        }
      }
    }

    this.onStateChange?.();
  }

  private killEnemy(enemy: Enemy): void {
    if (!this.scene || !enemy.mesh) return;

    this.scene.remove(enemy.mesh);
    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
      this.enemies.splice(index, 1);
    }

    this.gameState.enemiesRemaining--;
    this.gameState.score += 100;

    // Check for wave completion
    if (this.enemies.length === 0) {
      this.gameState.wave++;
      setTimeout(() => this.spawnWave(), 2000);
    }

    this.onStateChange?.();
  }

  private checkPickups(): void {
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;

      const dx = this.player.position.x - pickup.position.x;
      const dz = this.player.position.z - pickup.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.5) {
        this.collectPickup(pickup);
      }
    }
  }

  private collectPickup(pickup: Pickup): void {
    if (!this.scene || !pickup.mesh) return;

    pickup.collected = true;
    this.scene.remove(pickup.mesh);

    let message = "";

    switch (pickup.type) {
      case "health":
        this.player.health = Math.min(
          this.player.health + pickup.value,
          this.player.maxHealth
        );
        message = `+${pickup.value} HEALTH`;
        break;
      case "ammo_pistol":
        this.player.ammo.pistol = Math.min(
          this.player.ammo.pistol + pickup.value,
          this.player.maxAmmo.pistol
        );
        message = `+${pickup.value} PISTOL AMMO`;
        break;
      case "ammo_shotgun":
        this.player.ammo.shotgun = Math.min(
          this.player.ammo.shotgun + pickup.value,
          this.player.maxAmmo.shotgun
        );
        message = `+${pickup.value} SHOTGUN AMMO`;
        break;
    }

    this.onPickup?.(message);
    this.onStateChange?.();
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.mesh) continue;

      const dx = this.player.position.x - enemy.position.x;
      const dz = this.player.position.z - enemy.position.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      // State machine
      if (distToPlayer < 25) {
        enemy.state = "chase";
      }

      if (enemy.state === "chase") {
        // Move toward player
        const angle = Math.atan2(dx, dz);
        enemy.rotation = angle;

        if (distToPlayer > 3) {
          enemy.position.x += Math.sin(angle) * enemy.speed * delta;
          enemy.position.z += Math.cos(angle) * enemy.speed * delta;
        } else {
          // Attack
          const now = Date.now();
          if (now - enemy.lastAttack > 1000) {
            enemy.lastAttack = now;
            this.damagePlayer(10 + this.gameState.wave * 2);
          }
        }
      } else if (enemy.state === "patrol") {
        // Random patrol
        if (
          !enemy.patrolTarget ||
          Math.random() < 0.01
        ) {
          enemy.patrolTarget = {
            x: enemy.position.x + this.rng.range(-10, 10),
            y: enemy.position.y,
            z: enemy.position.z + this.rng.range(-10, 10),
          };
        }

        const pdx = enemy.patrolTarget.x - enemy.position.x;
        const pdz = enemy.patrolTarget.z - enemy.position.z;
        const pDist = Math.sqrt(pdx * pdx + pdz * pdz);

        if (pDist > 1) {
          const pAngle = Math.atan2(pdx, pdz);
          enemy.rotation = pAngle;
          enemy.position.x +=
            Math.sin(pAngle) * enemy.speed * 0.3 * delta;
          enemy.position.z +=
            Math.cos(pAngle) * enemy.speed * 0.3 * delta;
        }
      }

      // Update mesh position
      enemy.mesh.position.set(
        enemy.position.x,
        enemy.position.y + Math.sin(Date.now() * 0.003) * 0.1,
        enemy.position.z
      );
      enemy.mesh.rotation.y = enemy.rotation;
    }
  }

  private damagePlayer(amount: number): void {
    this.player.health -= amount;
    this.gameState.damageFlash = true;
    this.onDamage?.();

    setTimeout(() => {
      this.gameState.damageFlash = false;
      this.onStateChange?.();
    }, 100);

    if (this.player.health <= 0) {
      this.player.health = 0;
      this.gameState.gameOver = true;
    }

    this.onStateChange?.();
  }

  // ============================================
  // Update Loop
  // ============================================

  update(delta: number): void {
    if (
      !this.gameState.started ||
      this.gameState.gameOver ||
      this.gameState.terminalOpen
    ) {
      return;
    }

    // Mouse look
    this.player.rotation.y -= this.mouseMovement.x * MOUSE_SENSITIVITY;
    this.player.rotation.x -= this.mouseMovement.y * MOUSE_SENSITIVITY;
    this.player.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.player.rotation.x)
    );
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;

    // Movement
    const moveDir = { x: 0, z: 0 };
    if (this.input.forward) moveDir.z -= 1;
    if (this.input.backward) moveDir.z += 1;
    if (this.input.left) moveDir.x -= 1;
    if (this.input.right) moveDir.x += 1;

    // Normalize diagonal movement
    const moveMag = Math.sqrt(moveDir.x * moveDir.x + moveDir.z * moveDir.z);
    if (moveMag > 0) {
      moveDir.x /= moveMag;
      moveDir.z /= moveMag;
    }

    // Apply rotation to movement
    const sin = Math.sin(this.player.rotation.y);
    const cos = Math.cos(this.player.rotation.y);
    const moveX = moveDir.x * cos - moveDir.z * sin;
    const moveZ = moveDir.x * sin + moveDir.z * cos;

    this.player.position.x += moveX * PLAYER_SPEED * delta;
    this.player.position.z += moveZ * PLAYER_SPEED * delta;

    // Jump & Gravity
    if (this.input.jump && this.player.onGround) {
      this.player.velocity.y = PLAYER_JUMP_FORCE;
      this.player.onGround = false;
    }

    this.player.velocity.y -= GRAVITY * delta;
    this.player.position.y += this.player.velocity.y * delta;

    if (this.player.position.y <= PLAYER_HEIGHT) {
      this.player.position.y = PLAYER_HEIGHT;
      this.player.velocity.y = 0;
      this.player.onGround = true;
    }

    // Shooting
    if (this.input.shoot) {
      this.shoot();
    }

    // Update camera
    if (this.camera) {
      this.camera.position.set(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.player.rotation.y;
      this.camera.rotation.x = this.player.rotation.x;
    }

    // Update enemies
    this.updateEnemies(delta);

    // Check pickups
    this.checkPickups();

    // Animate pickups
    for (const pickup of this.pickups) {
      if (pickup.mesh && !pickup.collected) {
        pickup.mesh.rotation.y += delta * 2;
        pickup.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.1;
      }
    }
  }

  render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  // ============================================
  // Radar Data
  // ============================================

  getRadarBlips(): Array<{ x: number; y: number }> {
    const blips: Array<{ x: number; y: number }> = [];
    const radarRange = 30;

    for (const enemy of this.enemies) {
      const dx = enemy.position.x - this.player.position.x;
      const dz = enemy.position.z - this.player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radarRange) {
        // Rotate relative to player facing
        const angle = Math.atan2(dx, dz) - this.player.rotation.y;
        const relX = Math.sin(angle) * (dist / radarRange);
        const relY = -Math.cos(angle) * (dist / radarRange);

        blips.push({
          x: 50 + relX * 45,
          y: 50 + relY * 45,
        });
      }
    }

    return blips;
  }

  // ============================================
  // Cleanup
  // ============================================

  destroy(): void {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mousedown", this.handleMouseDown);
    document.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("resize", this.handleResize);

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

// Export singleton for easy access
export function createGameEngine(): GameEngine {
  return new GameEngine();
}
