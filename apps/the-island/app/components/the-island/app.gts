import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type GameStateService from "the-island/services/game-state";
import type AudioEngineService from "the-island/services/audio-engine";
import type SceneEngineService from "the-island/services/scene-engine";
import type KingdomStateService from "the-island/services/kingdom-state";
import type MusicEngineService from "the-island/services/music-engine";
import {
  SCENES,
  ITEMS,
  type Scene,
  type SceneExit,
  type GameFlags,
} from "the-island/services/game-state";
import SceneRenderer from "./scene-renderer";
import CanvasRenderer from "./canvas-renderer";
import Inventory from "./inventory";
import MessageLog from "./message-log";
import Navigation from "./navigation";
import MirrorPuzzle from "./mirror-puzzle";
import SignalDeck from "./signal-deck";

type Direction = "north" | "south" | "east" | "west" | "up" | "down";

export default class TheIslandApp extends Component {
  @service declare gameState: GameStateService;
  @service declare audioEngine: AudioEngineService;
  @service declare sceneEngine: SceneEngineService;
  @service declare kingdomState: KingdomStateService;
  @service declare musicEngine: MusicEngineService;

  @tracked message: string = "";
  @tracked messageVisible: boolean = false;
  @tracked showMirrorPuzzle: boolean = false;
  @tracked showSignalDeck: boolean = false;
  @tracked showNewGameConfirm: boolean = false;
  @tracked isIntro: boolean = true;
  @tracked audioInitialized: boolean = false;
  @tracked sceneTransition: boolean = false;
  @tracked useCanvas: boolean = true; // Canvas is the only mode now

  @tracked canvasSceneId = "misty_shore";

  kingdomNewGame = (): void => {
    this.showNewGameConfirm = true;
  };

  confirmKingdomNewGame = (): void => {
    this.showNewGameConfirm = false;
    this.kingdomState.reset();
    this.canvasSceneId = "misty_shore";
    this.sceneEngine.loadScene("misty_shore", 0);
    // Show the scene's actual description which includes puzzle hints
    setTimeout(() => {
      const scene = this.sceneEngine.getActiveScene();
      if (scene) {
        this.showMessage(scene.cursedDescription);
      }
    }, 300);
  };

  get progressDots(): Array<{ name: string; icon: string; restored: boolean }> {
    const scenes = [
      { id: "misty_shore", name: "Shore", icon: "🐚" },
      { id: "whispering_woods", name: "Woods", icon: "🦉" },
      { id: "crystal_caverns", name: "Caverns", icon: "💎" },
      { id: "the_meadow", name: "Meadow", icon: "🦄" },
      { id: "rainbow_bridge", name: "Bridge", icon: "🌈" },
      { id: "wizards_tower", name: "Tower", icon: "🐱" },
      { id: "starfall_lake", name: "Lake", icon: "🐟" },
    ];
    return scenes.map((s) => ({
      ...s,
      restored: this.kingdomState.getRestoration(s.id) >= 1,
    }));
  }

  get canvasExits(): Array<{ direction: string; icon: string; label: string; locked: boolean }> {
    const dirIcons: Record<string, { icon: string; label: string }> = {
      north: { icon: "⬆", label: "North" },
      south: { icon: "⬇", label: "South" },
      east: { icon: "➡", label: "East" },
      west: { icon: "⬅", label: "West" },
      up: { icon: "↑", label: "Up" },
      down: { icon: "↓", label: "Down" },
    };
    return this.kingdomState.getAvailableExits().map((exit) => ({
      direction: exit.direction,
      icon: dirIcons[exit.direction]?.icon ?? "•",
      label: dirIcons[exit.direction]?.label ?? exit.direction,
      locked: exit.locked,
    }));
  }

  testRestore = (): void => {
    if (this.useCanvas) {
      const sceneId = this.kingdomState.currentScene;
      this.kingdomState.restoreScene(sceneId);
      this.sceneEngine.triggerRestoration();
      this.musicEngine.playCrescendo();

      // Show restored description
      const scene = this.sceneEngine.getActiveScene();
      this.showMessage(scene?.restoredDescription ?? "The curse lifts! Color returns to the world...");
    }
  };

  canvasNavigate = (direction: string): void => {
    if (!this.useCanvas) return;
    this.ensureAudio();

    if (!this.kingdomState.canNavigate(direction)) {
      this.showMessage("The way is blocked. Perhaps there's something to solve first?");
      this.musicEngine.playClick();
      return;
    }

    const targetSceneId = this.kingdomState.getExitScene(direction);
    if (!targetSceneId) return;

    this.musicEngine.playClick();

    // Update kingdom state
    this.kingdomState.setScene(targetSceneId);
    this.canvasSceneId = targetSceneId;

    // Transition canvas engine
    const restoration = this.kingdomState.getRestoration(targetSceneId);
    this.sceneEngine.transitionTo(targetSceneId, restoration);

    // Show scene description
    setTimeout(() => {
      const scene = this.sceneEngine.getActiveScene();
      if (scene) {
        const desc = restoration > 0.5 ? scene.restoredDescription : scene.cursedDescription;
        this.showMessage(desc);
      }
    }, 500);
  };

  private audioStarted = false;

  private ensureAudio(): void {
    if (!this.audioStarted) {
      this.musicEngine.initAudio();
      // Start scene music on first interaction
      const scene = this.sceneEngine.getActiveScene();
      if (scene) {
        this.musicEngine.playScene(scene.music);
        this.musicEngine.updateRestoration(this.kingdomState.getRestoration(this.kingdomState.currentScene));
      }
      this.audioStarted = true;
    }
  }

  handleCanvasInteraction = (action: string, target: string): void => {
    if (!this.useCanvas) return;
    this.ensureAudio();

    switch (action) {
      case "examine":
        this.canvasExamine(target);
        break;
      case "pickup":
        this.canvasPickup(target);
        break;
      case "puzzle":
        this.canvasPuzzle(target);
        break;
    }
  };

  private canvasExamine(target: string): void {
    this.musicEngine.playClick();
    const texts: Record<string, string> = {
      rocks: "Worn smooth by ancient tides. Shells might be hidden in the sand nearby...",
      waves: "The waves whisper secrets of a world once full of color.",
      log: "A hollow log lies across the path. Something glints inside.",
      mushrooms: "Strange mushrooms grow in clusters. They pulse faintly with inner light.",
      pool: "A still pool reflects nothing. Or does it?",
      books: "Dusty tomes line the shelves. Titles in a language you almost understand.",
      fireplace: "The hearth is cold and dark. It yearns for warmth.",
      shore: "Smooth pebbles line the shore. The ice above creaks ominously.",
      chasm: "A bottomless abyss. Mist swirls up from unseen depths.",
      windows: "Tall stained glass windows, their colors drained to gray. They depict scenes of a world alive with magic.",
      columns: "Massive stone columns stretch upward into shadow. They've stood here for centuries.",
    };
    this.showMessage(texts[target] ?? "You examine it closely, but find nothing unusual.");
  }

  private canvasPickup(target: string): void {
    if (this.kingdomState.hasItem(target)) return;
    if (this.kingdomState.addItem(target)) {
      this.musicEngine.playPickup();
      this.sceneEngine.burst(600, 400, "#ffd700", 15);
      this.showMessage(`Picked up: ${target.replace(/_/g, " ")}`);
    }
  }

  private canvasPuzzle(target: string): void {
    const sceneId = this.kingdomState.currentScene;
    if (this.kingdomState.getRestoration(sceneId) >= 1) {
      this.showMessage("This area has already been restored!");
      return;
    }

    // Route to scene-specific puzzle logic
    switch (sceneId) {
      case "misty_shore":
        this.shellPuzzle(target);
        break;
      case "whispering_woods":
        this.owlCagePuzzle();
        break;
      case "crystal_caverns":
        this.crystalPuzzle();
        break;
      case "the_meadow":
        this.meadowPuzzle();
        break;
      case "rainbow_bridge":
        this.bridgePuzzle();
        break;
      case "wizards_tower":
        this.towerPuzzle();
        break;
      case "starfall_lake":
        this.lakePuzzle();
        break;
      case "throne_room":
        this.thronePuzzle();
        break;
      default:
        this.testRestore();
        break;
    }
  }

  private shellPuzzle(_target: string): void {
    // Shell discovery puzzle — find 3 shells hidden in the sand
    const shells = this.kingdomState.getFlag("shellsFound");
    const shellId = `shell_${shells.length + 1}`;

    // Check if this shell was already found
    if (shells.includes(shellId)) {
      this.showMessage("You already found a shell here.");
      return;
    }

    // Find the shell!
    const newShells = [...shells, shellId];
    this.kingdomState.setFlag("shellsFound", newShells);
    this.musicEngine.playPickup();
    this.sceneEngine.burst(600, 400, "#ffd700", 20);

    const messages = [
      "You brush away the sand and find a glowing shell! It pulses with faint warmth. (1/3)",
      "Another shell! This one hums with a soft melody when you hold it to your ear. (2/3)",
      "The third shell! All three shells begin to glow brightly...",
    ];
    this.showMessage(messages[newShells.length - 1] ?? "You found a shell!");

    // After finding all 3, trigger restoration
    if (newShells.length >= 3) {
      setTimeout(() => {
        this.showMessage("The three shells resonate together. A wave of warmth flows outward from your hands...");
        setTimeout(() => {
          this.testRestore();
        }, 1500);
      }, 2000);
    }
  }

  private owlCageClickCount = 0;

  private owlCagePuzzle(): void {
    this.owlCageClickCount++;
    this.musicEngine.playClick();
    this.sceneEngine.burst(600, 350, "#8888ff", 10);

    const messages = [
      "You tug at the rusted lock. It groans but holds. The owl's eyes flicker open for a moment.",
      "The lock is weakening! Rust flakes away. The owl watches you now, golden eyes barely open.",
      "With a final wrench, the lock shatters! The cage door swings open...",
    ];
    this.showMessage(messages[Math.min(this.owlCageClickCount - 1, 2)] ?? "");

    if (this.owlCageClickCount >= 3) {
      this.owlCageClickCount = 0;
      setTimeout(() => {
        this.showMessage("The owl spreads its wings wide. For a breathless moment it hovers — then settles onto a branch, free at last. The forest sighs with relief.");
        setTimeout(() => {
          this.testRestore();
        }, 1500);
      }, 2000);
    }
  }

  private crystalClickCount = 0;

  private crystalPuzzle(): void {
    this.crystalClickCount++;
    this.musicEngine.playClick();

    const colors = ["#ff00ff", "#00ffff", "#ffff00", "#ff8800", "#00ff88"];
    const color = colors[(this.crystalClickCount - 1) % colors.length] ?? "#ffffff";
    this.sceneEngine.burst(600, 380, color, 15);

    const messages = [
      "You touch the first crystal. It hums and emits a faint violet glow.",
      "A second crystal responds! Blue light arcs between them.",
      "Three crystals now pulse in harmony. The cave walls begin to shimmer.",
      "Four crystals blazing! Prisms of light bounce between them, painting the walls.",
      "The fifth crystal ignites! A cascade of rainbow light fills the cavern!",
    ];
    this.showMessage(messages[Math.min(this.crystalClickCount - 1, 4)] ?? "");

    if (this.crystalClickCount >= 5) {
      this.crystalClickCount = 0;
      setTimeout(() => {
        this.showMessage("Every surface blazes with refracted light. The cave has become a cathedral of crystal and color. From the deepest shadow, a fox with amber eyes steps forward.");
        setTimeout(() => {
          this.testRestore();
        }, 1500);
      }, 2000);
    }
  }

  private meadowClickCount = 0;

  private meadowPuzzle(): void {
    this.meadowClickCount++;
    this.musicEngine.playPickup();
    const colors = ["#ff88cc", "#88ff88", "#ffdd44"];
    this.sceneEngine.burst(600, 400, colors[(this.meadowClickCount - 1) % 3] ?? "#ffffff", 12);

    const messages = [
      "You find moonpetal blooms hiding in the dead grass. Their petals glow faintly silver.",
      "Starroot! Its pale tendrils reach toward the sky even in this gray world. You gather it carefully.",
      "A single dewdrop hangs from a bare twig, impossibly — as if waiting for you. You cup it in your hands.",
    ];
    this.showMessage(messages[Math.min(this.meadowClickCount - 1, 2)] ?? "");

    if (this.meadowClickCount >= 3) {
      this.meadowClickCount = 0;
      setTimeout(() => {
        this.showMessage("You mix the three ingredients together. The potion glows warm gold and you pour it onto the earth. Where it touches, flowers erupt — first one, then hundreds, then a meadow in full bloom.");
        setTimeout(() => { this.testRestore(); }, 1500);
      }, 2000);
    }
  }

  private bridgeClickCount = 0;

  private bridgePuzzle(): void {
    this.bridgeClickCount++;
    this.musicEngine.playClick();
    const rainbow = ["#ff0000", "#ff7700", "#ffff00", "#00cc00", "#0077ff", "#4400ff", "#8800ff"];
    this.sceneEngine.burst(600, 350, rainbow[(this.bridgeClickCount - 1) % 7] ?? "#ffffff", 15);

    const messages = [
      "You find a shard of red light caught in the rocks. It hums when you touch it.",
      "An orange fragment glows in a crevice. Two pieces of the rainbow...",
      "Yellow light, warm as noon sun. Three fragments now pulse together.",
      "Green — the color of living things. The fragments are trying to connect.",
      "Blue, deep as the sky's memory. Five of seven!",
      "Indigo, the twilight shade. Almost there...",
      "Violet — the last fragment! You hold the complete rainbow in your hands.",
    ];
    this.showMessage(messages[Math.min(this.bridgeClickCount - 1, 6)] ?? "");

    if (this.bridgeClickCount >= 7) {
      this.bridgeClickCount = 0;
      this.kingdomState.setFlag("bridgeComplete", true);
      setTimeout(() => {
        this.showMessage("You cast the rainbow into the chasm. It arcs upward, bands of color weaving together into a bridge of pure light. A phoenix screams in joy overhead, trailing golden fire.");
        setTimeout(() => { this.testRestore(); }, 1500);
      }, 2000);
    }
  }

  private towerClickCount = 0;

  private towerPuzzle(): void {
    this.towerClickCount++;
    this.musicEngine.playClick();
    this.sceneEngine.burst(780, 380, "#ffd700", 8);

    // Play actual notes from the music engine!
    if (this.towerClickCount <= 5) {
      const noteFreqs = [262, 330, 392, 523, 659]; // C E G C' E'
      const freq = noteFreqs[(this.towerClickCount - 1) % 5] ?? 262;
      this.playMusicBoxNote(freq);
    }

    const messages = [
      "You press the first key. A note rings out — clear, impossibly beautiful in the silence. C.",
      "E. The second note joins the first, hanging in the air like a question.",
      "G. A chord forms, three notes reaching toward a melody remembered but not yet whole.",
      "C, an octave higher. The music box trembles. Something is waking up.",
      "E! The melody completes and the music box begins to play on its own — a song of light and warmth and home.",
    ];
    this.showMessage(messages[Math.min(this.towerClickCount - 1, 4)] ?? "");

    if (this.towerClickCount >= 5) {
      this.towerClickCount = 0;
      setTimeout(() => {
        this.showMessage("The melody fills the tower. The fireplace roars to life, embers dance like fireflies, and books settle into their shelves as if they'd never been disturbed. A gray cat materializes by the hearth, yawns, and curls up to sleep.");
        setTimeout(() => { this.testRestore(); }, 1500);
      }, 2000);
    }
  }

  private playMusicBoxNote(freq: number): void {
    if (!this.musicEngine) return;
    // Use the music engine's audio context to play a bell-like tone
    this.musicEngine.initAudio();
    this.musicEngine.playClick(); // This plays a tone at 800hz, but we want the actual freq
    // TODO: expose a playNote method on music engine for custom frequencies
  }

  private lakeClickCount = 0;

  private lakePuzzle(): void {
    this.lakeClickCount++;
    this.musicEngine.playClick();
    this.sceneEngine.burst(500, 380, "#aaddff", 12);

    const messages = [
      "You trace a line on the ice. It glows faintly where your finger touches.",
      "A second stroke. The rune takes shape — an ancient symbol of warmth.",
      "The third line connects the pattern. The ice begins to crack.",
      "Hairline fractures spread outward from the rune like roots seeking water.",
    ];
    this.showMessage(messages[Math.min(this.lakeClickCount - 1, 3)] ?? "");

    if (this.lakeClickCount >= 4) {
      this.lakeClickCount = 0;
      setTimeout(() => {
        this.showMessage("The ice shatters into a thousand glittering fragments that hang in the air, then fall like snow. Beneath, the lake is alive — dark water stirring with silver fish and reflected stars.");
        setTimeout(() => { this.testRestore(); }, 1500);
      }, 2000);
    }
  }

  private thronePuzzle(): void {
    const tokens = this.kingdomState.getFlag("tokens");
    const needed = 7;

    if (tokens.length < needed) {
      this.showMessage(`The altar has ${needed} empty slots. You have restored ${tokens.length} of ${needed} regions. Return when all the kingdom's guardians are free.`);
      this.musicEngine.playClick();
      return;
    }

    // All tokens collected — place them on the altar
    this.sceneEngine.burst(600, 400, "#ffd700", 40);
    this.musicEngine.playCrescendo();

    this.showMessage("You place the seven restoration tokens on the altar. They glow — red, orange, yellow, green, blue, indigo, violet — and the light rises upward...");

    setTimeout(() => {
      this.showMessage("Light explodes outward from the altar! Every stained glass window blazes with color. The curse shatters. From every corner of the kingdom, the guardians appear — crab, owl, fox, unicorn, phoenix, cat, and fish — gathering in the throne room.");
      setTimeout(() => {
        this.testRestore();
        setTimeout(() => {
          this.showMessage("The Fading Kingdom fades no more. You did this. You remembered the colors, freed the creatures, and sang the songs. The kingdom will not forget. Thank you, traveler.");
        }, 3000);
      }, 2000);
    }, 3000);
  }

  setup = modifier(() => {
    this.initGame();
  });

  initGame(): void {
    // Load kingdom state
    const loaded = this.kingdomState.load();
    this.canvasSceneId = this.kingdomState.currentScene;

    // Show scene description immediately
    this.showMessage("You wash ashore in a gray, lifeless land. The kingdom has been cursed...");

    // Remove intro animation after delay
    setTimeout(() => {
      this.isIntro = false;
    }, 2000);
  }

  get currentScene(): Scene {
    return this.gameState.currentSceneData;
  }

  get sceneId(): string {
    return this.gameState.currentScene;
  }

  get inventory(): string[] {
    return this.gameState.inventory;
  }

  get flags(): GameFlags {
    return this.gameState.flags;
  }

  get mirrorAngles(): [number, number, number, number] {
    return this.gameState.flags.mirrorAngles;
  }

  get isLighthousePuzzleSolved(): boolean {
    return this.gameState.isPuzzleSolved("lighthouse");
  }

  get wrapperClass(): string {
    return this.isIntro ? "game-wrapper intro" : "game-wrapper";
  }

  get sceneContainerClass(): string {
    return this.sceneTransition ? "scene-fade-out" : "scene-fade-in";
  }

  showMessage(text: string): void {
    this.message = text;
    this.messageVisible = true;
  }

  initializeAudio = (): void => {
    if (!this.audioInitialized) {
      this.audioEngine.initAudio();
      this.audioEngine.playAmbient(this.currentScene.ambient);
      this.audioInitialized = true;
    }
  };

  handleSceneClick = (event: MouseEvent): void => {
    // Initialize audio on first click
    this.initializeAudio();

    const target = event.target as Element;
    const hotspot = target.closest("[data-action]");

    if (hotspot) {
      const actionAttr = hotspot.getAttribute("data-action");
      const targetAttr = hotspot.getAttribute("data-target");

      if (actionAttr && targetAttr) {
        this.handleInteraction(actionAttr, targetAttr);
      }
    }
  }

  handleInteraction(actionType: string, target: string): void {
    switch (actionType) {
      case "examine":
        this.examine(target);
        break;
      case "pickup":
        this.pickupItem(target);
        break;
      case "use":
        this.useItem(target);
        break;
      case "puzzle":
        this.activatePuzzle(target);
        break;
    }
  }

  examine(target: string): void {
    this.audioEngine.playSound("click");

    const examinations: Record<string, string> = {
      // Act 1
      rocks:
        "Worn smooth by countless tides. Something metallic glints beneath one...",
      waves: this.gameState.flags.tideOut
        ? "The tide has pulled far back, exposing a dark cave mouth to the west..."
        : "The endless rhythm of the sea. Cold and deep.",
      trees: "Ancient oaks, their branches twisted by centuries of wind.",
      stones:
        'The carvings depict stars, gears, and a lighthouse. A poem reads: "Four turn as one, light reveals the path."',
      door: this.gameState.flags.lighthouseDoorOpen
        ? "The door stands open, revealing spiral stairs."
        : "A heavy iron door. Four gear-shaped indentations surround a central lock.",
      mirrors:
        "Four polished mirrors on rotating mounts. They can direct the light beam.",
      lens: "A massive Fresnel lens. It focuses and magnifies light tremendously.",
      view: "From here you can see the entire island. On the distant cliffs... is that writing?",
      gear_slots: `${this.gameState.flags.gearsPlaced}/4 gears have been placed in the mechanism.`,
      // Act 2
      paintings:
        "Ancient paintings cover the cave wall. A constellation of five stars connected by lines, forming an arrow pointing downward. Human figures stand beneath, arms raised.",
      equipment:
        "A corroded diving helmet and air hose. The brass nameplate reads 'Dr. Elara Voss, Station 7.' Someone lived here.",
      lamp:
        "An oil lamp on a wall bracket. Long cold. The passage continues north toward a faint hum.",
      radio: this.gameState.flags.powerRestored
        ? "The radio hums softly. A faint signal crackles through static..."
        : "A shortwave radio, its guts spilled across the workbench. The frequency dial is stuck at 0. It could be repaired with the right parts and the right frequency.",
      observatory_door:
        "A heavy steel door. 'OBSERVATORY' is stenciled above in faded paint.",
      telescope:
        "A large refracting telescope pointed at a gap in the dome. Through the eyepiece, stars blaze with impossible clarity.",
      vault_hatch: this.gameState.puzzlesSolved.constellation
        ? "The hatch is open. Stone steps descend into golden light."
        : "A steel hatch set into the floor. A star-shaped lock mechanism holds it shut. The star chart on the wall might hold the key.",
      pedestal:
        "A stone pedestal in the center of the vault. On it rests a leather-bound journal — the final account of what happened on this island.",
    };

    this.showMessage(examinations[target] ?? "You see nothing unusual.");
  }

  pickupItem(itemId: string): void {
    // Check if already collected
    if (this.gameState.hasItem(itemId)) return;

    // Check if item exists in this scene
    const scene = SCENES[this.gameState.currentScene];
    if (!scene?.items.includes(itemId)) return;

    // Check specific conditions
    if (itemId === "gear1" && !this.gameState.flags.foundGear1) {
      this.gameState.setFlag("foundGear1", true);
    }
    if (
      itemId === "gear2" &&
      this.gameState.flags.lighthouseDoorOpen
    ) {
      this.gameState.setFlag("foundGear2", true);
    }
    if (itemId === "gear3") {
      this.gameState.setFlag("foundGear3", true);
    }
    if (itemId === "gear4") {
      this.gameState.setFlag("foundGear4", true);
    }
    if (itemId === "cave_rubbing") {
      this.gameState.setFlag("hasRubbing", true);
    }

    // Add to inventory
    this.gameState.addToInventory(itemId);

    const item = ITEMS[itemId];
    this.showMessage(`Picked up: ${item?.name ?? itemId}`);
    this.audioEngine.playSound("pickup");
  }

  examineItem = (itemId: string): void => {
    const item = ITEMS[itemId];
    if (item) {
      this.showMessage(`${item.name}: ${item.description}`);
      this.audioEngine.playSound("click");
    }
  };

  useItem(target: string): void {
    // Context-specific item use
    if (
      target === "gear_slot" &&
      this.gameState.currentScene === "lighthouse_base"
    ) {
      this.useGearOnSlot();
    } else if (
      target === "repair_radio" &&
      this.gameState.currentScene === "research_station"
    ) {
      this.repairRadio();
    }
  }

  repairRadio(): void {
    if (this.gameState.flags.powerRestored) {
      this.showMessage("The radio is already repaired and humming.");
      return;
    }
    if (!this.gameState.hasItem("radio_parts")) {
      this.showMessage("The radio is broken. You need components to repair it.");
      return;
    }
    if (!this.gameState.hasItem("journal_page2")) {
      this.showMessage("You have the parts but don't know the right frequency. There must be a clue somewhere...");
      return;
    }
    // Player has both parts and knows the frequency
    this.gameState.removeFromInventory("radio_parts");
    this.gameState.setFlag("powerRestored", true);
    this.gameState.solvePuzzle("radio");
    this.audioEngine.playSound("solve");
    this.showMessage(
      'You wire the vacuum tubes into place and dial to frequency 7.3. Static... then a faint voice: "Station 7, this is Mainland. The vault. Open the vault. The stars will show you."',
    );
  }

  useGearOnSlot(): void {
    // Find a gear in inventory
    const gearInInventory = this.gameState.inventory.find(
      (id) => ITEMS[id]?.isGear,
    );

    if (!gearInInventory) {
      this.showMessage("You need a gear to place in this slot.");
      return;
    }

    // Remove from inventory, add to mechanism
    this.gameState.removeFromInventory(gearInInventory);
    const newGearsPlaced = this.gameState.flags.gearsPlaced + 1;
    this.gameState.setFlag("gearsPlaced", newGearsPlaced);

    this.audioEngine.playSound("gear");
    this.showMessage(
      `Placed ${ITEMS[gearInInventory]?.name ?? "gear"} in the mechanism. ${newGearsPlaced}/4 gears.`,
    );

    // Check if puzzle solved
    if (newGearsPlaced >= 4) {
      this.solveGearPuzzle();
    }
  }

  solveGearPuzzle(): void {
    this.gameState.solvePuzzle("gears");
    this.gameState.setFlag("lighthouseDoorOpen", true);

    this.audioEngine.playSound("solve");
    this.showMessage(
      "The gears turn together! With a great grinding sound, the lighthouse door swings open!",
    );
  }

  activatePuzzle(puzzleId: string): void {
    if (puzzleId === "mirrors") {
      if (this.gameState.isPuzzleSolved("lighthouse")) {
        this.showMessage(
          "The mirrors are already aligned. The message is visible on the cliffs.",
        );
        return;
      }
      this.showMirrorPuzzle = true;
    } else if (puzzleId === "constellation") {
      if (this.gameState.isPuzzleSolved("constellation")) {
        this.showMessage(
          "The constellation is already traced on the star chart. The vault hatch is open.",
        );
        return;
      }
      // Check if player has the cave rubbing (which shows the constellation pattern)
      if (!this.gameState.hasItem("cave_rubbing")) {
        this.showMessage(
          "The star chart shows hundreds of stars. Without knowing which pattern to trace, this could take forever.",
        );
        return;
      }
      // Auto-solve: if player has the rubbing, they know the pattern
      this.solveConstellationPuzzle();
    }
  }

  solveConstellationPuzzle(): void {
    this.gameState.solvePuzzle("constellation");
    this.gameState.setFlag("vaultOpen", true);
    this.audioEngine.playSound("solve");
    this.showMessage(
      "You trace the constellation from the cave rubbing onto the star chart. The five stars glow golden. A deep grinding sound echoes — the vault hatch slides open!",
    );
  }

  rotateMirror = (index: number): void => {
    this.gameState.rotateMirror(index);
    this.audioEngine.playSound("mirror");

    if (this.gameState.checkMirrorSolution()) {
      this.solveMirrorPuzzle();
    }
  };

  solveMirrorPuzzle(): void {
    if (this.gameState.isPuzzleSolved("lighthouse")) return;

    this.gameState.solvePuzzle("lighthouse");
    this.gameState.setFlag("tideOut", true);
    this.audioEngine.playSound("solve");

    setTimeout(() => {
      this.showMirrorPuzzle = false;
      this.showMessage(
        'The beam illuminates the distant cliffs! Ancient text becomes visible: "TIDE REVEALS THE CAVE AT DAWN." Something shifts in the distance — the tide is pulling back...',
      );
    }, 1000);
  }

  closePuzzle = (): void => {
    this.showMirrorPuzzle = false;
  };

  openSignalDeck = (): void => {
    this.showSignalDeck = true;
  };

  closeSignalDeck = (): void => {
    this.showSignalDeck = false;
  };

  navigate = (direction: Direction): void => {
    this.initializeAudio();

    const scene = SCENES[this.gameState.currentScene];
    const exit = scene?.exits[direction];

    if (!exit) return;

    // Check if locked
    if (typeof exit === "object") {
      const sceneExit = exit as SceneExit;
      if (sceneExit.requires) {
        const flagValue = this.gameState.getFlag(
          sceneExit.requires as keyof GameFlags,
        );
        if (!flagValue) {
          this.showMessage(
            "The way is blocked. Perhaps there's a mechanism to open it?",
          );
          this.audioEngine.playSound("click");
          return;
        }
      }
      this.loadScene(sceneExit.scene);
    } else {
      this.loadScene(exit);
    }

    this.audioEngine.playSound("click");
  }

  loadScene(sceneId: string): void {
    const scene = SCENES[sceneId];
    if (!scene) return;

    // Fade out
    this.sceneTransition = true;

    setTimeout(() => {
      this.gameState.setScene(sceneId);
      this.audioEngine.playAmbient(scene.ambient);
      this.showMessage(scene.description);

      // Fade in
      setTimeout(() => {
        this.sceneTransition = false;
      }, 50);
    }, 300);
  }

  saveGame = (): void => {
    this.gameState.saveGame();
    this.showMessage("Game saved.");
  };

  loadGame = (): void => {
    if (this.gameState.loadGame()) {
      this.showMessage("Game loaded.");
      this.audioEngine.playAmbient(this.currentScene.ambient);
    } else {
      this.showMessage("No saved game found.");
    }
  };

  newGame = (): void => {
    this.showNewGameConfirm = true;
  };

  confirmNewGame = (): void => {
    this.showNewGameConfirm = false;
    this.gameState.resetGame();
    this.showMessage(
      "You wake on a strange beach, waves lapping at your feet...",
    );
    this.audioEngine.playAmbient(this.currentScene.ambient);
  };

  cancelNewGame = (): void => {
    this.showNewGameConfirm = false;
  }

  <template>
    <div class={{this.wrapperClass}} {{this.setup}}>
      {{! Header }}
      <header class="game-header">
        <h1 class="game-title">THE FADING KINGDOM</h1>
        <div class="progress-tracker">
          {{#each this.progressDots as |dot|}}
            <span class="progress-dot {{if dot.restored 'restored'}}" title={{dot.name}}>
              {{dot.icon}}
            </span>
          {{/each}}
        </div>
        <span class="location-name">{{this.kingdomState.sceneName}}</span>
        <div class="menu-buttons">
          <button type="button" class="menu-btn" {{on "click" this.kingdomNewGame}}>New Game</button>
        </div>
      </header>

      {{! Main Game Area }}
      <main class="game-main">
        {{! Scene Container }}
        {{! template-lint-disable no-invalid-interactive }}
        <div class={{this.sceneContainerClass}}>
          <CanvasRenderer
            @sceneId={{this.canvasSceneId}}
            @restorationProgress={{0}}
            @onInteraction={{this.handleCanvasInteraction}}
          />
        </div>

        {{! Bottom bar: message + navigation }}
        <div class="game-bottom-bar">
          <MessageLog @message={{this.message}} @visible={{this.messageVisible}} />
          <nav class="navigation">
            {{#each this.canvasExits as |exit|}}
              <button
                type="button"
                class="nav-btn {{if exit.locked 'locked'}}"
                {{on "click" (fn this.canvasNavigate exit.direction)}}
              >
                <span class="nav-icon">{{exit.icon}}</span>
                <span class="nav-label">{{exit.label}}</span>
              </button>
            {{/each}}
          </nav>
        </div>
      </main>

      {{! Inventory Panel }}
      <Inventory @items={{this.kingdomState.inventory}} @onExamineItem={{this.examineItem}} />

      {{#if this.showNewGameConfirm}}
        <div class="puzzle-overlay">
          <div class="puzzle-container">
            <h2>Start Over?</h2>
            <p>Your progress will be lost. Are you sure?</p>
            <div class="confirm-buttons">
              <button type="button" class="puzzle-close" {{on "click" this.confirmKingdomNewGame}}>
                Yes, Start New Game
              </button>
              <button type="button" class="puzzle-close" {{on "click" this.cancelNewGame}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
