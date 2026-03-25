/**
 * The Fading Kingdom — Game State Service
 *
 * Manages the new Canvas game's state: current scene, restoration progress,
 * tokens collected, inventory, and puzzle flags. Persists to localStorage.
 */

import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

const STORAGE_KEY = "fadingKingdom_save";

export interface KingdomPuzzleState {
  shore: boolean;
  woods: boolean;
  caverns: boolean;
  meadow: boolean;
  bridge: boolean;
  tower: boolean;
  lake: boolean;
  throne: boolean;
}

export interface KingdomFlags {
  // Per-scene restoration (0 = cursed, 1 = restored)
  restoration: Record<string, number>;
  // Tokens collected (scene IDs)
  tokens: string[];
  // Puzzle-specific state
  shellsFound: string[];
  bridgeComplete: boolean;
}

export interface KingdomSaveData {
  currentScene: string;
  inventory: string[];
  puzzles: KingdomPuzzleState;
  flags: KingdomFlags;
}

// All scenes and their navigation
export interface KingdomScene {
  id: string;
  name: string;
  exits: Record<string, string | { scene: string; requires: string }>;
}

/**
 * Non-linear scene graph — hub-and-spoke from the Shore.
 *
 * The Shore connects to 3 regions. Each region has 2 scenes.
 * The Throne Room requires all 7 tokens.
 *
 *                    Throne Room
 *                   /     |      \
 *           Tower—Lake  Bridge—Meadow  Caverns—Woods
 *                   \     |      /
 *                    Misty Shore (hub)
 */
export const KINGDOM_SCENES: Record<string, KingdomScene> = {
  misty_shore: {
    id: "misty_shore",
    name: "Misty Shore",
    exits: {
      north: "whispering_woods",
      east: "the_meadow",
      west: "starfall_lake",
    },
  },
  // === NORTH PATH ===
  whispering_woods: {
    id: "whispering_woods",
    name: "Whispering Woods",
    exits: { south: "misty_shore", north: "crystal_caverns" },
  },
  crystal_caverns: {
    id: "crystal_caverns",
    name: "Crystal Caverns",
    exits: { south: "whispering_woods", north: "throne_room" },
  },
  // === EAST PATH ===
  the_meadow: {
    id: "the_meadow",
    name: "The Meadow",
    exits: { west: "misty_shore", east: "rainbow_bridge" },
  },
  rainbow_bridge: {
    id: "rainbow_bridge",
    name: "Rainbow Bridge",
    exits: { west: "the_meadow", east: "throne_room" },
  },
  // === WEST PATH ===
  starfall_lake: {
    id: "starfall_lake",
    name: "Starfall Lake",
    exits: { east: "misty_shore", west: "wizards_tower" },
  },
  wizards_tower: {
    id: "wizards_tower",
    name: "Wizard's Tower",
    exits: { east: "starfall_lake", west: "throne_room" },
  },
  // === ENDGAME ===
  throne_room: {
    id: "throne_room",
    name: "The Throne Room",
    exits: {
      south: "crystal_caverns",
      west: "rainbow_bridge",
      east: "wizards_tower",
    },
  },
};

const DEFAULT_STATE: KingdomSaveData = {
  currentScene: "misty_shore",
  inventory: [],
  puzzles: {
    shore: false,
    woods: false,
    caverns: false,
    meadow: false,
    bridge: false,
    tower: false,
    lake: false,
    throne: false,
  },
  flags: {
    restoration: {},
    tokens: [],
    shellsFound: [],
    bridgeComplete: false,
  },
};

export default class KingdomStateService extends Service {
  @tracked currentScene: string = DEFAULT_STATE.currentScene;
  @tracked inventory: string[] = [...DEFAULT_STATE.inventory];
  @tracked puzzles: KingdomPuzzleState = { ...DEFAULT_STATE.puzzles };
  @tracked flags: KingdomFlags = {
    ...DEFAULT_STATE.flags,
    restoration: {},
    tokens: [],
    shellsFound: [],
  };

  // ============================================
  // SCENE
  // ============================================

  get currentSceneData(): KingdomScene | undefined {
    return KINGDOM_SCENES[this.currentScene];
  }

  get sceneName(): string {
    return this.currentSceneData?.name ?? "Unknown";
  }

  setScene(sceneId: string): void {
    if (KINGDOM_SCENES[sceneId]) {
      this.currentScene = sceneId;
      this.save();
    }
  }

  // ============================================
  // RESTORATION
  // ============================================

  getRestoration(sceneId: string): number {
    return this.flags.restoration[sceneId] ?? 0;
  }

  setRestoration(sceneId: string, value: number): void {
    this.flags = {
      ...this.flags,
      restoration: {
        ...this.flags.restoration,
        [sceneId]: Math.max(0, Math.min(1, value)),
      },
    };
    this.save();
  }

  restoreScene(sceneId: string): void {
    this.setRestoration(sceneId, 1);
    // Mark puzzle as solved
    const puzzleKey = this.sceneToPuzzleKey(sceneId);
    if (puzzleKey) {
      this.puzzles = { ...this.puzzles, [puzzleKey]: true };
    }
    // Collect token
    const token = `token_${sceneId}`;
    if (!this.flags.tokens.includes(token)) {
      this.flags = {
        ...this.flags,
        tokens: [...this.flags.tokens, token],
      };
    }
    this.save();
  }

  get tokensCollected(): number {
    return this.flags.tokens.length;
  }

  private sceneToPuzzleKey(sceneId: string): keyof KingdomPuzzleState | null {
    const map: Record<string, keyof KingdomPuzzleState> = {
      misty_shore: "shore",
      whispering_woods: "woods",
      crystal_caverns: "caverns",
      the_meadow: "meadow",
      rainbow_bridge: "bridge",
      wizards_tower: "tower",
      starfall_lake: "lake",
      throne_room: "throne",
    };
    return map[sceneId] ?? null;
  }

  // ============================================
  // INVENTORY
  // ============================================

  addItem(itemId: string): boolean {
    if (this.inventory.includes(itemId)) return false;
    this.inventory = [...this.inventory, itemId];
    this.save();
    return true;
  }

  hasItem(itemId: string): boolean {
    return this.inventory.includes(itemId);
  }

  removeItem(itemId: string): void {
    this.inventory = this.inventory.filter((id) => id !== itemId);
    this.save();
  }

  // ============================================
  // FLAGS
  // ============================================

  getFlag<K extends keyof KingdomFlags>(key: K): KingdomFlags[K] {
    return this.flags[key];
  }

  setFlag<K extends keyof KingdomFlags>(key: K, value: KingdomFlags[K]): void {
    this.flags = { ...this.flags, [key]: value };
    this.save();
  }

  // ============================================
  // NAVIGATION HELPERS
  // ============================================

  canNavigate(direction: string): boolean {
    const scene = KINGDOM_SCENES[this.currentScene];
    if (!scene) return false;
    const exit = scene.exits[direction];
    if (!exit) return false;
    if (typeof exit === "object" && exit.requires) {
      return !!this.flags[exit.requires as keyof KingdomFlags];
    }
    return true;
  }

  getExitScene(direction: string): string | null {
    const scene = KINGDOM_SCENES[this.currentScene];
    if (!scene) return null;
    const exit = scene.exits[direction];
    if (!exit) return null;
    if (typeof exit === "object") return exit.scene;
    return exit;
  }

  getAvailableExits(): Array<{ direction: string; locked: boolean }> {
    const scene = KINGDOM_SCENES[this.currentScene];
    if (!scene) return [];
    return Object.keys(scene.exits).map((dir) => ({
      direction: dir,
      locked: !this.canNavigate(dir),
    }));
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  save(): void {
    try {
      const data: KingdomSaveData = {
        currentScene: this.currentScene,
        inventory: [...this.inventory],
        puzzles: { ...this.puzzles },
        flags: {
          ...this.flags,
          restoration: { ...this.flags.restoration },
          tokens: [...this.flags.tokens],
          shellsFound: [...this.flags.shellsFound],
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save kingdom state:", e);
    }
  }

  load(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: KingdomSaveData = JSON.parse(saved);
        this.currentScene = data.currentScene;
        this.inventory = [...(data.inventory ?? [])];
        this.puzzles = { ...DEFAULT_STATE.puzzles, ...data.puzzles };
        this.flags = {
          ...DEFAULT_STATE.flags,
          ...data.flags,
          restoration: { ...(data.flags?.restoration ?? {}) },
          tokens: [...(data.flags?.tokens ?? [])],
          shellsFound: [...(data.flags?.shellsFound ?? [])],
        };
        return true;
      }
    } catch (e) {
      console.error("Failed to load kingdom state:", e);
    }
    return false;
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentScene = DEFAULT_STATE.currentScene;
    this.inventory = [...DEFAULT_STATE.inventory];
    this.puzzles = { ...DEFAULT_STATE.puzzles };
    this.flags = {
      ...DEFAULT_STATE.flags,
      restoration: {},
      tokens: [],
      shellsFound: [],
    };
  }
}
