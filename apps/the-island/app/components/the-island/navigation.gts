import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import type { Scene, SceneExit, GameFlags } from "the-island/services/game-state";

type Direction = "north" | "south" | "east" | "west" | "up" | "down";

interface NavigationSignature {
  Args: {
    scene: Scene;
    flags: GameFlags;
    onNavigate: (direction: Direction) => void;
  };
  Element: HTMLElement;
}

interface NavButton {
  direction: Direction;
  icon: string;
  title: string;
}

const ALL_DIRECTIONS: NavButton[] = [
  { direction: "up", icon: "↑", title: "Go Up" },
  { direction: "north", icon: "⬆", title: "North" },
  { direction: "south", icon: "⬇", title: "South" },
  { direction: "west", icon: "⬅", title: "West" },
  { direction: "east", icon: "➡", title: "East" },
  { direction: "down", icon: "↓", title: "Go Down" },
];

export default class Navigation extends Component<NavigationSignature> {
  get availableDirections(): NavButton[] {
    return ALL_DIRECTIONS.filter(
      (btn) => !!this.args.scene.exits[btn.direction],
    );
  }

  isExitLocked(direction: Direction): boolean {
    const exit = this.args.scene.exits[direction];
    if (!exit) return false;
    if (typeof exit === "object" && (exit as SceneExit).requires) {
      const requiredFlag = (exit as SceneExit).requires as keyof GameFlags;
      return !this.args.flags[requiredFlag];
    }
    return false;
  }

  getButtonClass = (direction: Direction): string => {
    return this.isExitLocked(direction) ? "nav-btn locked" : "nav-btn";
  };

  handleClick = (direction: Direction): void => {
    this.args.onNavigate(direction);
  };

  <template>
    <nav class="navigation" ...attributes>
      {{#each this.availableDirections as |btn|}}
        <button
          type="button"
          class={{this.getButtonClass btn.direction}}
          title={{btn.title}}
          {{on "click" (fn this.handleClick btn.direction)}}
        >
          <span class="nav-icon">{{btn.icon}}</span>
          <span class="nav-label">{{btn.title}}</span>
        </button>
      {{/each}}
    </nav>
  </template>
}
