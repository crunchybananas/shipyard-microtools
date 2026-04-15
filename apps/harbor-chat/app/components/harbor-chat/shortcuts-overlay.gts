import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";

interface ShortcutsOverlaySignature {
  Args: {};
}

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  icon: string;
  shortcuts: ShortcutEntry[];
}

export default class ShortcutsOverlay extends Component<ShortcutsOverlaySignature> {
  @tracked isOpen = false;

  get categories(): ShortcutCategory[] {
    return [
      {
        title: "Navigation",
        icon: "🧭",
        shortcuts: [
          { keys: ["⌘", "K"], description: "Quick switcher" },
          { keys: ["⌘", "/"], description: "This help" },
          { keys: ["Esc"], description: "Close panel" },
        ],
      },
      {
        title: "Messages",
        icon: "💬",
        shortcuts: [
          { keys: ["Enter"], description: "Send message" },
          { keys: ["Shift", "Enter"], description: "New line" },
          { keys: ["↑"], description: "Edit last message (empty composer)" },
        ],
      },
      {
        title: "Formatting",
        icon: "✨",
        shortcuts: [
          { keys: ["⌘", "B"], description: "Bold selection" },
          { keys: ["⌘", "I"], description: "Italic selection" },
          { keys: ["⌘", "E"], description: "Inline code selection" },
        ],
      },
      {
        title: "Commands",
        icon: "⚡",
        shortcuts: [
          { keys: ["/task"], description: "Create or assign a task" },
          { keys: ["/pr"], description: "Link a pull request" },
          { keys: ["/deploy"], description: "Trigger a deployment" },
          { keys: ["/alert"], description: "Set up an alert" },
          { keys: ["/agent"], description: "Invoke an AI agent" },
          { keys: ["/code"], description: "Share a code snippet" },
        ],
      },
    ];
  }

  open = () => {
    this.isOpen = true;
  };

  close = () => {
    this.isOpen = false;
  };

  handleBackdropClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).classList.contains("sk-backdrop")) {
      this.close();
    }
  };

  handleModalKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    }
  };

  registerKeyboardShortcut = modifier((element: Element) => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
    };
  });

  autoFocusTrap = modifier((element: HTMLElement) => {
    requestAnimationFrame(() => {
      element.focus();
    });
  });

  <template>
    <div class="sk-anchor" {{this.registerKeyboardShortcut}}>
      {{#if this.isOpen}}
        <div
          class="sk-backdrop"
          {{on "click" this.handleBackdropClick}}
          {{on "keydown" this.handleModalKeydown}}
        >
          <div
            class="sk-modal"
            tabindex="-1"
            role="dialog"
            aria-label="Keyboard shortcuts"
            {{this.autoFocusTrap}}
            {{on "keydown" this.handleModalKeydown}}
          >
            <div class="sk-header">
              <h2 class="sk-title">⌨️ Keyboard Shortcuts</h2>
              <button class="sk-close-btn" type="button" {{on "click" this.close}}>✕</button>
            </div>

            <div class="sk-grid">
              {{#each this.categories as |category|}}
                <div class="sk-category">
                  <h3 class="sk-category-title">
                    <span class="sk-category-icon">{{category.icon}}</span>
                    {{category.title}}
                  </h3>
                  <ul class="sk-shortcut-list">
                    {{#each category.shortcuts as |shortcut|}}
                      <li class="sk-shortcut-item">
                        <span class="sk-keys">
                          {{#each shortcut.keys as |key|}}
                            <kbd class="sk-kbd">{{key}}</kbd>
                          {{/each}}
                        </span>
                        <span class="sk-desc">{{shortcut.description}}</span>
                      </li>
                    {{/each}}
                  </ul>
                </div>
              {{/each}}
            </div>

            <div class="sk-footer">
              <span class="sk-footer-hint">
                Press <kbd class="sk-kbd sk-kbd-sm">Esc</kbd> or <kbd class="sk-kbd sk-kbd-sm">⌘</kbd><kbd class="sk-kbd sk-kbd-sm">/</kbd> to close
              </span>
            </div>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
