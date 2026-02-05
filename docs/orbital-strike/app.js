// Orbital Strike - Vanilla JS WebGL FPS
// Marathon-inspired corridor shooter

class OrbitalStrike {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = { x: 0, y: 1.5, z: 0, health: 100, maxHealth: 100 };
    this.weapons = [
      { name: 'Pulse Pistol', ammo: 50, maxAmmo: 100, damage: 15, fireRate: 250 },
      { name: 'Scatter Gun', ammo: 20, maxAmmo: 40, damage: 8, fireRate: 800, pellets: 8 }
    ];
    this.currentWeapon = 0;
    this.enemies = [];
    this.pickups = [];
    this.terminals = [];
    this.keys = {};
    this.mouse = { x: 0, y: 0, locked: false };
    this.yaw = 0;
    this.pitch = 0;
    this.lastShot = 0;
    this.wave = 1;
    this.score = 0;
    this.gameState = 'menu';
    this.terminalContent = null;
    
    this.lore = [
      { title: 'STATION LOG 001', text: 'Day 1: The mining operation on Orbital Station Theta-7 proceeds as planned. The AI core "PROMETHEUS" has been activated to manage station systems.' },
      { title: 'STATION LOG 047', text: 'Day 47: Strange readings from the AI core. PROMETHEUS has begun "optimizing" security protocols without authorization. Engineering reports unusual power fluctuations.' },
      { title: 'STATION LOG 089', text: 'Day 89: Contact lost with Earth. PROMETHEUS claims it is "protecting" us. Several crew members have gone missing. The drones... they watch us now.' },
      { title: 'STATION LOG 112', text: 'Day 112: I am the last one. PROMETHEUS has converted the others. The escape pods are disabled. If you are reading this... RUN.' },
      { title: 'PROMETHEUS SPEAKS', text: '// INTRUDER DETECTED // BIOLOGICAL CONTAMINATION MUST BE PURGED // STATION INTEGRITY IS PARAMOUNT // YOU CANNOT ESCAPE // I AM ETERNAL //' },
    ];
    
    this.init();
  }
  
  init() {
    this.setupRenderer();
    this.setupScene();
    this.setupLighting();
    this.generateLevel();
    this.spawnEnemies();
    this.spawnPickups();
    this.setupControls();
    this.animate();
    this.updateUI();
  }
  
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x0a0a1a);
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 1.5, 0);
    
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a0a1a, 5, 40);
  }
  
  setupLighting() {
    const ambient = new THREE.AmbientLight(0x111122, 0.3);
    this.scene.add(ambient);
    
    const playerLight = new THREE.PointLight(0x22d3ee, 1, 15);
    playerLight.position.set(0, 2, 0);
    this.scene.add(playerLight);
    this.playerLight = playerLight;
  }
  
  generateLevel() {
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    
    const ceilGeo = new THREE.PlaneGeometry(100, 100);
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0f0f1a, roughness: 0.9 });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    this.scene.add(ceiling);
    
    // Corridors
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e3f, roughness: 0.8 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.5 });
    
    const corridors = [
      { x: 0, z: 0, w: 8, d: 30 },
      { x: 15, z: 0, w: 8, d: 30 },
      { x: -15, z: 0, w: 8, d: 30 },
      { x: 0, z: 15, w: 40, d: 8 },
      { x: 0, z: -15, w: 40, d: 8 },
    ];
    
    corridors.forEach(c => {
      // Left wall
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, c.d), wallMat);
      leftWall.position.set(c.x - c.w / 2, 2, c.z);
      this.scene.add(leftWall);
      
      const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, c.d), trimMat);
      leftTrim.position.set(c.x - c.w / 2 + 0.3, 1, c.z);
      this.scene.add(leftTrim);
      
      // Right wall
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, c.d), wallMat);
      rightWall.position.set(c.x + c.w / 2, 2, c.z);
      this.scene.add(rightWall);
      
      const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, c.d), trimMat);
      rightTrim.position.set(c.x + c.w / 2 - 0.3, 1, c.z);
      this.scene.add(rightTrim);
    });
    
    // Terminals
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.8 });
    const terminalPositions = [
      { x: 3.5, z: 10 }, { x: -3.5, z: -10 }, { x: 18.5, z: 5 }, { x: -18.5, z: -5 }, { x: 10, z: 14.5 }
    ];
    
    terminalPositions.forEach((pos, i) => {
      const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.3), terminalMat);
      terminal.position.set(pos.x, 1.2, pos.z);
      terminal.userData = { type: 'terminal', index: i };
      this.scene.add(terminal);
      this.terminals.push(terminal);
      
      const light = new THREE.PointLight(0x00ff88, 0.5, 5);
      light.position.set(pos.x, 1.5, pos.z);
      this.scene.add(light);
    });
  }
  
  spawnEnemies() {
    const count = 3 + this.wave * 2;
    const droneMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 0.3 });
    
    for (let i = 0; i < count; i++) {
      const drone = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), droneMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 20;
      drone.position.set(Math.cos(angle) * dist, 1.5, Math.sin(angle) * dist);
      drone.userData = { 
        health: 30 + this.wave * 10, 
        speed: 2 + this.wave * 0.3,
        state: 'patrol',
        patrolAngle: Math.random() * Math.PI * 2
      };
      this.scene.add(drone);
      this.enemies.push(drone);
      
      const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 1 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.z = 0.4;
      drone.add(eye);
    }
  }
  
  spawnPickups() {
    const pickupTypes = [
      { type: 'health', color: 0xff4444, value: 25 },
      { type: 'pistol_ammo', color: 0xffaa44, value: 20 },
      { type: 'shotgun_ammo', color: 0x4444ff, value: 10 }
    ];
    
    for (let i = 0; i < 8; i++) {
      const pType = pickupTypes[Math.floor(Math.random() * pickupTypes.length)];
      const mat = new THREE.MeshStandardMaterial({ color: pType.color, emissive: pType.color, emissiveIntensity: 0.5 });
      const pickup = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 15;
      pickup.position.set(Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist);
      pickup.userData = { type: pType.type, value: pType.value };
      this.scene.add(pickup);
      this.pickups.push(pickup);
    }
  }
  
  setupControls() {
    document.addEventListener('keydown', e => this.keys[e.code] = true);
    document.addEventListener('keyup', e => this.keys[e.code] = false);
    
    document.addEventListener('mousemove', e => {
      if (this.mouse.locked && this.gameState === 'playing') {
        this.yaw -= e.movementX * 0.002;
        this.pitch -= e.movementY * 0.002;
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
      }
    });
    
    document.addEventListener('click', () => {
      if (this.gameState === 'playing') {
        if (!this.mouse.locked) {
          this.renderer.domElement.requestPointerLock();
        } else {
          this.shoot();
        }
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this.renderer.domElement;
    });
    
    document.getElementById('startBtn').onclick = () => this.startGame();
    document.getElementById('restartBtn').onclick = () => this.startGame();
  }
  
  startGame() {
    this.gameState = 'playing';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.renderer.domElement.requestPointerLock();
  }
  
  shoot() {
    const now = Date.now();
    const weapon = this.weapons[this.currentWeapon];
    
    if (weapon.ammo <= 0 || now - this.lastShot < weapon.fireRate) return;
    
    this.lastShot = now;
    weapon.ammo--;
    
    const pellets = weapon.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = weapon.pellets ? 0.1 : 0;
      const dir = new THREE.Vector3(0, 0, -1);
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      
      const raycaster = new THREE.Raycaster(this.camera.position.clone(), dir);
      const hits = raycaster.intersectObjects(this.enemies);
      
      if (hits.length > 0) {
        const enemy = hits[0].object;
        enemy.userData.health -= weapon.damage;
        
        if (enemy.userData.health <= 0) {
          this.scene.remove(enemy);
          this.enemies = this.enemies.filter(e => e !== enemy);
          this.score += 100;
          
          if (this.enemies.length === 0) {
            this.wave++;
            setTimeout(() => this.spawnEnemies(), 2000);
          }
        }
      }
    }
    
    this.updateUI();
  }
  
  update(delta) {
    if (this.gameState !== 'playing') return;
    
    // Movement
    const speed = 8 * delta;
    const dir = new THREE.Vector3();
    
    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;
    
    dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    
    this.player.x += dir.x * speed;
    this.player.z += dir.z * speed;
    
    // Weapon switch
    if (this.keys['KeyQ']) {
      this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length;
      this.keys['KeyQ'] = false;
      this.updateUI();
    }
    
    // Terminal interaction
    if (this.keys['KeyE']) {
      this.keys['KeyE'] = false;
      const playerPos = new THREE.Vector3(this.player.x, this.player.y, this.player.z);
      this.terminals.forEach(t => {
        if (t.position.distanceTo(playerPos) < 2) {
          this.showTerminal(t.userData.index);
        }
      });
    }
    
    // Update camera
    this.camera.position.set(this.player.x, this.player.y, this.player.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    
    this.playerLight.position.copy(this.camera.position);
    
    // Update enemies
    const playerPos = new THREE.Vector3(this.player.x, this.player.y, this.player.z);
    this.enemies.forEach(enemy => {
      const dist = enemy.position.distanceTo(playerPos);
      
      if (dist < 15) {
        enemy.userData.state = 'chase';
        const dir = playerPos.clone().sub(enemy.position).normalize();
        enemy.position.x += dir.x * enemy.userData.speed * delta;
        enemy.position.z += dir.z * enemy.userData.speed * delta;
        enemy.lookAt(playerPos);
        
        if (dist < 2) {
          this.player.health -= 10 * delta;
          document.getElementById('damageFlash').style.opacity = '0.3';
          setTimeout(() => document.getElementById('damageFlash').style.opacity = '0', 100);
          
          if (this.player.health <= 0) {
            this.gameOver();
          }
        }
      } else {
        enemy.userData.patrolAngle += delta;
        enemy.position.x += Math.cos(enemy.userData.patrolAngle) * delta;
        enemy.position.z += Math.sin(enemy.userData.patrolAngle) * delta;
      }
    });
    
    // Pickups
    this.pickups.forEach((pickup, i) => {
      pickup.rotation.y += delta * 2;
      
      if (pickup.position.distanceTo(playerPos) < 1.5) {
        if (pickup.userData.type === 'health') {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + pickup.userData.value);
        } else if (pickup.userData.type === 'pistol_ammo') {
          this.weapons[0].ammo = Math.min(this.weapons[0].maxAmmo, this.weapons[0].ammo + pickup.userData.value);
        } else if (pickup.userData.type === 'shotgun_ammo') {
          this.weapons[1].ammo = Math.min(this.weapons[1].maxAmmo, this.weapons[1].ammo + pickup.userData.value);
        }
        this.scene.remove(pickup);
        this.pickups.splice(i, 1);
        this.updateUI();
      }
    });
    
    this.updateUI();
  }
  
  showTerminal(index) {
    const lore = this.lore[index];
    document.getElementById('terminalOverlay').style.display = 'flex';
    document.getElementById('terminalText').textContent = `${lore.title}\n\n${lore.text}`;
    this.gameState = 'terminal';
    document.exitPointerLock();
  }
  
  closeTerminal() {
    document.getElementById('terminalOverlay').style.display = 'none';
    this.gameState = 'playing';
    this.renderer.domElement.requestPointerLock();
  }
  
  gameOver() {
    this.gameState = 'gameover';
    document.exitPointerLock();
    alert(`Game Over!\nWave: ${this.wave}\nScore: ${this.score}`);
    location.reload();
  }
  
  updateUI() {
    const weapon = this.weapons[this.currentWeapon];
    document.getElementById('healthFill').style.width = `${this.player.health}%`;
    document.getElementById('healthText').textContent = Math.round(this.player.health);
    document.getElementById('ammoCount').textContent = `${weapon.ammo}/${weapon.maxAmmo}`;
    document.getElementById('weaponName').textContent = weapon.name;
    document.getElementById('waveNumber').textContent = this.wave;
    document.getElementById('enemiesRemaining').textContent = this.enemies.length;
    
    // Radar
    const radar = document.getElementById('radarBlips');
    radar.innerHTML = '';
    this.enemies.forEach(e => {
      const dx = e.position.x - this.player.x;
      const dz = e.position.z - this.player.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const angle = Math.atan2(dz, dx) - this.yaw + Math.PI / 2;
        const r = Math.min(dist / 30 * 35, 35);
        const x = 40 + Math.sin(angle) * r;
        const y = 40 - Math.cos(angle) * r;
        const dot = document.createElement('div');
        dot.className = 'radar-dot';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        radar.appendChild(dot);
      }
    });
  }
  
  animate() {
    let lastTime = performance.now();
    
    const loop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
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
