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

export default class Navigation extends Component<NavigationSignature> {
  directions: NavButton[] = [
    { direction: "up", icon: "↑", title: "Go Up" },
    { direction: "north", icon: "⬆", title: "Go North" },
    { direction: "down", icon: "↓", title: "Go Down" },
    { direction: "west", icon: "⬅", title: "Go West" },
    { direction: "east", icon: "➡", title: "Go East" },
    { direction: "south", icon: "⬇", title: "Go South" },
  ];

  isExitAvailable(direction: Direction): boolean {
    return !!this.args.scene.exits[direction];
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
    const classes = ["nav-btn"];
    if (!this.isExitAvailable(direction)) {
      classes.push("hidden");
    } else if (this.isExitLocked(direction)) {
      classes.push("locked");
    }
    return classes.join(" ");
  };

  handleClick = (direction: Direction): void => {
    if (this.isExitAvailable(direction)) {
      this.args.onNavigate(direction);
    }
  };

  <template>
    <nav class="navigation" ...attributes>
      {{#each this.directions as |btn|}}
        <button
          type="button"
          class={{this.getButtonClass btn.direction}}
          title={{btn.title}}
          {{on "click" (fn this.handleClick btn.direction)}}
        >
          {{btn.icon}}
        </button>
      {{/each}}
    </nav>
  </template>
}
