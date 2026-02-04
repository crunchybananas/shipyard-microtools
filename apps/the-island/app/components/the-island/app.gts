import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import type Owner from "@ember/owner";
import type GameStateService from "the-island/services/game-state";
import type AudioEngineService from "the-island/services/audio-engine";
import {
  SCENES,
  ITEMS,
  type Scene,
  type SceneExit,
  type GameFlags,
} from "the-island/services/game-state";
import SceneRenderer from "./scene-renderer";
import Inventory from "./inventory";
import MessageLog from "./message-log";
import Navigation from "./navigation";
import MirrorPuzzle from "./mirror-puzzle";

type Direction = "north" | "south" | "east" | "west" | "up" | "down";

interface TheIslandAppSignature {
  Element: HTMLDivElement;
  Args: Record<string, never>;
}

export default class TheIslandApp extends Component<TheIslandAppSignature> {
  @service declare gameState: GameStateService;
  @service declare audioEngine: AudioEngineService;

  @tracked message: string = "";
  @tracked messageVisible: boolean = false;
  @tracked showMirrorPuzzle: boolean = false;
  @tracked isIntro: boolean = true;
  @tracked audioInitialized: boolean = false;

  private messageTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(owner: Owner, args: TheIslandAppSignature["Args"]) {
    super(owner, args);
    this.initGame();
  }

  initGame(): void {
    const loaded = this.gameState.loadGame();
    if (!loaded) {
      this.showMessage(
        "You wake on a strange beach, waves lapping at your feet...",
      );
    } else {
      this.showMessage(this.gameState.currentSceneData.description);
    }

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

  showMessage(text: string): void {
    this.message = text;
    this.messageVisible = true;

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      this.messageVisible = false;
    }, 5000);
  }

  @action
  initializeAudio(): void {
    if (!this.audioInitialized) {
      this.audioEngine.initAudio();
      this.audioEngine.playAmbient(this.currentScene.ambient);
      this.audioInitialized = true;
    }
  }

  @action
  handleSceneClick(event: MouseEvent): void {
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
      rocks:
        "Worn smooth by countless tides. Something metallic glints beneath one...",
      waves: "The endless rhythm of the sea. Cold and deep.",
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

    // Add to inventory
    this.gameState.addToInventory(itemId);

    const item = ITEMS[itemId];
    this.showMessage(`Picked up: ${item?.name ?? itemId}`);
    this.audioEngine.playSound("pickup");
  }

  @action
  examineItem(itemId: string): void {
    const item = ITEMS[itemId];
    if (item) {
      this.showMessage(`${item.name}: ${item.description}`);
      this.audioEngine.playSound("click");
    }
  }

  useItem(target: string): void {
    // Context-specific item use
    if (
      target === "gear_slot" &&
      this.gameState.currentScene === "lighthouse_base"
    ) {
      this.useGearOnSlot();
    }
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
    }
  }

  @action
  rotateMirror(index: number): void {
    this.gameState.rotateMirror(index);
    this.audioEngine.playSound("mirror");

    if (this.gameState.checkMirrorSolution()) {
      this.solveMirrorPuzzle();
    }
  }

  solveMirrorPuzzle(): void {
    if (this.gameState.isPuzzleSolved("lighthouse")) return;

    this.gameState.solvePuzzle("lighthouse");
    this.audioEngine.playSound("solve");

    setTimeout(() => {
      this.showMirrorPuzzle = false;
      this.showMessage(
        'The beam illuminates the distant cliffs! Ancient text becomes visible: "TIDE REVEALS THE CAVE AT DAWN"',
      );
    }, 1000);
  }

  @action
  closePuzzle(): void {
    this.showMirrorPuzzle = false;
  }

  @action
  navigate(direction: Direction): void {
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

    this.gameState.setScene(sceneId);

    // Update ambient audio
    this.audioEngine.playAmbient(scene.ambient);

    // Show description
    this.showMessage(scene.description);
  }

  @action
  saveGame(): void {
    this.gameState.saveGame();
    this.showMessage("Game saved.");
  }

  @action
  loadGame(): void {
    if (this.gameState.loadGame()) {
      this.showMessage("Game loaded.");
      this.audioEngine.playAmbient(this.currentScene.ambient);
    } else {
      this.showMessage("No saved game found.");
    }
  }

  @action
  newGame(): void {
    // eslint-disable-next-line no-alert
    if (confirm("Start a new game? Your progress will be lost.")) {
      this.gameState.resetGame();
      this.showMessage(
        "You wake on a strange beach, waves lapping at your feet...",
      );
      this.audioEngine.playAmbient(this.currentScene.ambient);
    }
  }

  <template>
    <div class={{this.wrapperClass}}>
      {{! Header }}
      <header class="game-header">
        <h1 class="game-title">THE ISLAND</h1>
        <span class="location-name">{{this.currentScene.name}}</span>
        <div class="menu-buttons">
          <button type="button" class="menu-btn" {{on "click" this.saveGame}}>Save</button>
          <button type="button" class="menu-btn" {{on "click" this.loadGame}}>Load</button>
          <button type="button" class="menu-btn" {{on "click" this.newGame}}>New Game</button>
        </div>
      </header>

      {{! Main Game Area }}
      <main class="game-main">
        {{! Scene Container }}
        {{! template-lint-disable no-invalid-interactive }}
        <div {{on "click" this.handleSceneClick}}>
          <SceneRenderer
            @sceneId={{this.sceneId}}
            @onInteraction={{this.handleInteraction}}
          />
        </div>

        {{! Navigation Controls }}
        <Navigation
          @scene={{this.currentScene}}
          @flags={{this.flags}}
          @onNavigate={{this.navigate}}
        />

        {{! Message Display }}
        <MessageLog @message={{this.message}} @visible={{this.messageVisible}} />
      </main>

      {{! Inventory Panel }}
      <Inventory @items={{this.inventory}} @onExamineItem={{this.examineItem}} />

      {{! Mirror Puzzle Overlay }}
      {{#if this.showMirrorPuzzle}}
        <MirrorPuzzle
          @mirrorAngles={{this.mirrorAngles}}
          @onRotateMirror={{this.rotateMirror}}
          @onClose={{this.closePuzzle}}
          @isSolved={{this.isLighthousePuzzleSolved}}
        />
      {{/if}}
    </div>
  </template>
}
