import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface PuzzlesSolved {
  lighthouse: boolean;
  musicBox: boolean;
  gears: boolean;
  stars: boolean;
  finalDoor: boolean;
}

export interface GameFlags {
  lanternLit: boolean;
  tideOut: boolean;
  lighthouseDoorOpen: boolean;
  foundGear1: boolean;
  foundGear2: boolean;
  foundGear3: boolean;
  foundGear4: boolean;
  gearsPlaced: number;
  mirrorAngles: [number, number, number, number];
  examinedStones: boolean;
  readJournal1: boolean;
}

export interface GameStateData {
  currentScene: string;
  previousScene: string | null;
  inventory: string[];
  puzzlesSolved: PuzzlesSolved;
  flags: GameFlags;
  journalEntries: string[];
}

export interface SceneExit {
  scene: string;
  requires?: keyof GameFlags;
}

export interface Scene {
  id: string;
  name: string;
  ambient: "ocean" | "forest" | "cave";
  exits: Record<string, string | SceneExit>;
  items: string[];
  description: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  icon: string;
  isGear?: boolean;
  isJournal?: boolean;
}

const STORAGE_KEY = "theIsland_save";

const DEFAULT_STATE: GameStateData = {
  currentScene: "beach",
  previousScene: null,
  inventory: [],
  puzzlesSolved: {
    lighthouse: false,
    musicBox: false,
    gears: false,
    stars: false,
    finalDoor: false,
  },
  flags: {
    lanternLit: false,
    tideOut: false,
    lighthouseDoorOpen: false,
    foundGear1: false,
    foundGear2: false,
    foundGear3: false,
    foundGear4: false,
    gearsPlaced: 0,
    mirrorAngles: [0, 0, 0, 0],
    examinedStones: false,
    readJournal1: false,
  },
  journalEntries: [],
};

export const SCENES: Record<string, Scene> = {
  beach: {
    id: "beach",
    name: "The Beach",
    ambient: "ocean",
    exits: {
      north: "forest",
    },
    items: ["rusty_key"],
    description:
      "You wake on a rocky beach. Waves crash against weathered stones. A path leads into a dark forest to the north.",
  },
  forest: {
    id: "forest",
    name: "Forest Path",
    ambient: "forest",
    exits: {
      south: "beach",
      north: "clearing",
    },
    items: ["gear1"],
    description:
      "Twisted trees form a canopy overhead. Shafts of pale light pierce the gloom. The path continues north.",
  },
  clearing: {
    id: "clearing",
    name: "Stone Circle",
    ambient: "forest",
    exits: {
      south: "forest",
      east: "lighthouse_base",
    },
    items: ["journal_page1"],
    description:
      "Ancient standing stones form a circle. Strange symbols are carved into their surfaces.",
  },
  lighthouse_base: {
    id: "lighthouse_base",
    name: "Lighthouse Base",
    ambient: "ocean",
    exits: {
      west: "clearing",
      up: { scene: "lighthouse_top", requires: "lighthouseDoorOpen" },
    },
    items: ["gear2"],
    description:
      "The lighthouse tower looms above. A heavy iron door blocks the entrance. Four gear-shaped slots surround the lock.",
  },
  lighthouse_top: {
    id: "lighthouse_top",
    name: "Lighthouse Lantern Room",
    ambient: "ocean",
    exits: {
      down: "lighthouse_base",
    },
    items: [],
    description:
      "The lantern room offers a stunning view of the island. Four mirrors surround a central lens. Something glints on the distant cliffs.",
  },
};

export const ITEMS: Record<string, Item> = {
  rusty_key: {
    id: "rusty_key",
    name: "Rusty Key",
    description:
      "An old iron key, crusted with salt. The head is shaped like a wave.",
    icon: "🗝️",
  },
  gear1: {
    id: "gear1",
    name: "Bronze Gear",
    description:
      "A tarnished bronze gear with 8 teeth. Part of some mechanism.",
    icon: "⚙️",
    isGear: true,
  },
  gear2: {
    id: "gear2",
    name: "Iron Gear",
    description: "A heavy iron gear. It looks like it fits with others.",
    icon: "⚙️",
    isGear: true,
  },
  gear3: {
    id: "gear3",
    name: "Copper Gear",
    description: "A greenish copper gear with intricate patterns.",
    icon: "⚙️",
    isGear: true,
  },
  gear4: {
    id: "gear4",
    name: "Steel Gear",
    description: "A pristine steel gear. Recently oiled.",
    icon: "⚙️",
    isGear: true,
  },
  journal_page1: {
    id: "journal_page1",
    name: "Journal Page",
    description:
      '"The lighthouse holds the key to seeing. Four gears turn as one. The mirrors must align to reveal what was hidden."',
    icon: "📜",
    isJournal: true,
  },
  lantern: {
    id: "lantern",
    name: "Lantern",
    description: "An oil lantern. It casts a warm glow when lit.",
    icon: "🏮",
  },
};

export default class GameStateService extends Service {
  @tracked currentScene: string = DEFAULT_STATE.currentScene;
  @tracked previousScene: string | null = DEFAULT_STATE.previousScene;
  @tracked inventory: string[] = [...DEFAULT_STATE.inventory];
  @tracked puzzlesSolved: PuzzlesSolved = { ...DEFAULT_STATE.puzzlesSolved };
  @tracked flags: GameFlags = { ...DEFAULT_STATE.flags };
  @tracked journalEntries: string[] = [...DEFAULT_STATE.journalEntries];

  get currentSceneData(): Scene {
    const scene = SCENES[this.currentScene];
    if (!scene) {
      return SCENES.beach as Scene;
    }
    return scene;
  }

  loadGame(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: GameStateData = JSON.parse(saved);
        this.currentScene = data.currentScene;
        this.previousScene = data.previousScene;
        this.inventory = [...data.inventory];
        this.puzzlesSolved = { ...data.puzzlesSolved };
        this.flags = {
          ...data.flags,
          mirrorAngles: [...data.flags.mirrorAngles] as [
            number,
            number,
            number,
            number,
          ],
        };
        this.journalEntries = [...data.journalEntries];
        return true;
      }
    } catch (e) {
      console.error("Failed to load game:", e);
    }
    return false;
  }

  saveGame(): void {
    try {
      const data: GameStateData = {
        currentScene: this.currentScene,
        previousScene: this.previousScene,
        inventory: [...this.inventory],
        puzzlesSolved: { ...this.puzzlesSolved },
        flags: {
          ...this.flags,
          mirrorAngles: [...this.flags.mirrorAngles] as [
            number,
            number,
            number,
            number,
          ],
        },
        journalEntries: [...this.journalEntries],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save game:", e);
    }
  }

  resetGame(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentScene = DEFAULT_STATE.currentScene;
    this.previousScene = DEFAULT_STATE.previousScene;
    this.inventory = [...DEFAULT_STATE.inventory];
    this.puzzlesSolved = { ...DEFAULT_STATE.puzzlesSolved };
    this.flags = {
      ...DEFAULT_STATE.flags,
      mirrorAngles: [...DEFAULT_STATE.flags.mirrorAngles] as [
        number,
        number,
        number,
        number,
      ],
    };
    this.journalEntries = [...DEFAULT_STATE.journalEntries];
  }

  setScene(sceneId: string): void {
    if (SCENES[sceneId]) {
      this.previousScene = this.currentScene;
      this.currentScene = sceneId;
      this.saveGame();
    }
  }

  addToInventory(itemId: string): boolean {
    if (!this.inventory.includes(itemId) && ITEMS[itemId]) {
      this.inventory = [...this.inventory, itemId];
      this.saveGame();
      return true;
    }
    return false;
  }

  removeFromInventory(itemId: string): boolean {
    if (this.inventory.includes(itemId)) {
      this.inventory = this.inventory.filter((id) => id !== itemId);
      this.saveGame();
      return true;
    }
    return false;
  }

  hasItem(itemId: string): boolean {
    return this.inventory.includes(itemId);
  }

  setFlag<K extends keyof GameFlags>(key: K, value: GameFlags[K]): void {
    this.flags = { ...this.flags, [key]: value };
    this.saveGame();
  }

  getFlag<K extends keyof GameFlags>(key: K): GameFlags[K] {
    return this.flags[key];
  }

  solvePuzzle(puzzleId: keyof PuzzlesSolved): void {
    this.puzzlesSolved = { ...this.puzzlesSolved, [puzzleId]: true };
    this.saveGame();
  }

  isPuzzleSolved(puzzleId: keyof PuzzlesSolved): boolean {
    return this.puzzlesSolved[puzzleId];
  }

  rotateMirror(index: number): void {
    if (index < 0 || index > 3) return;
    const newAngles = [...this.flags.mirrorAngles] as [
      number,
      number,
      number,
      number,
    ];
    const current = newAngles[index] ?? 0;
    newAngles[index] = (current + 45) % 360;
    this.flags = { ...this.flags, mirrorAngles: newAngles };
    this.saveGame();
  }

  checkMirrorSolution(): boolean {
    // Solution: Mirror 0 at 45° (NE)
    return this.flags.mirrorAngles[0] === 45;
  }
}
