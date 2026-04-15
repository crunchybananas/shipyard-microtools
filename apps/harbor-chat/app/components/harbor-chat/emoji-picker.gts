import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "😊", "😇", "🥰", "😍", "😘", "😜", "🤔",
      "😏", "😢", "😭", "😤",
    ],
  },
  {
    name: "People",
    icon: "👋",
    emojis: [
      "👋", "🤚", "✋", "🖖", "👌", "🤌", "🤏", "✌️",
      "🤞", "🫶", "👍", "👎", "👏", "🙌", "🤝", "🙏",
      "💪", "🧠", "👀", "🫡",
    ],
  },
  {
    name: "Nature",
    icon: "🌿",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐨", "🐯", "🦁", "🐸", "🌸", "🌺", "🌻", "🌿",
      "🍀", "🌊", "⭐", "🔥",
    ],
  },
  {
    name: "Food",
    icon: "🍕",
    emojis: [
      "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
      "🍕", "🍔", "🌮", "🍜", "🍣", "🍩", "🍪", "☕",
      "🍺", "🍷", "🧁", "🎂",
    ],
  },
  {
    name: "Objects",
    icon: "💡",
    emojis: [
      "💡", "🔑", "💻", "📱", "📷", "🎮", "🎧", "🎸",
      "📚", "✏️", "📎", "🔧", "💰", "💎", "🎁", "🏆",
      "🚀", "✈️", "🏠", "⏰",
    ],
  },
  {
    name: "Symbols",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💯", "💢", "💥", "💫", "✅", "❌", "⚠️", "🔴",
      "🟢", "🔵", "⬆️", "⬇️",
    ],
  },
];

interface EmojiPickerSignature {
  Args: {
    onSelect: (emoji: string) => void;
    onClose: () => void;
  };
}

export default class EmojiPicker extends Component<EmojiPickerSignature> {
  @tracked activeCategory = 0;
  @tracked searchQuery = "";

  get categories(): EmojiCategory[] {
    return CATEGORIES;
  }

  get filteredEmojis(): string[] | null {
    if (!this.searchQuery) return null;
    const results: string[] = [];
    for (const category of CATEGORIES) {
      for (const emoji of category.emojis) {
        results.push(emoji);
      }
    }
    return results.length > 0 ? results : null;
  }

  get activeEmojis(): string[] {
    if (this.filteredEmojis) return this.filteredEmojis;
    return CATEGORIES[this.activeCategory]?.emojis ?? [];
  }

  get activeCategoryName(): string {
    if (this.filteredEmojis) return "Search Results";
    return CATEGORIES[this.activeCategory]?.name ?? "";
  }

  isActiveCategory = (index: number): boolean => {
    return index === this.activeCategory && !this.searchQuery;
  };

  selectCategory = (index: number) => {
    this.activeCategory = index;
    this.searchQuery = "";
  };

  handleSearch = (event: Event) => {
    this.searchQuery = (event.target as HTMLInputElement).value;
  };

  selectEmoji = (emoji: string) => {
    this.args.onSelect(emoji);
  };

  handleBackdropClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).classList.contains("emoji-picker-backdrop")) {
      this.args.onClose();
    }
  };

  <template>
    <div class="emoji-picker-backdrop" {{on "click" this.handleBackdropClick}}>
      <div class="emoji-picker">
        <div class="emoji-picker-header">
          <input
            class="emoji-picker-search"
            type="text"
            placeholder="Search emoji..."
            value={{this.searchQuery}}
            {{on "input" this.handleSearch}}
          />
          <button class="emoji-picker-close" {{on "click" @onClose}}>✕</button>
        </div>

        <div class="emoji-picker-tabs">
          {{#each this.categories as |cat index|}}
            <button
              class="emoji-picker-tab {{if (this.isActiveCategory index) 'active'}}"
              title={{cat.name}}
              {{on "click" (fn this.selectCategory index)}}
            >
              {{cat.icon}}
            </button>
          {{/each}}
        </div>

        <div class="emoji-picker-category-label">{{this.activeCategoryName}}</div>

        <div class="emoji-picker-grid">
          {{#each this.activeEmojis as |emoji|}}
            <button
              class="emoji-picker-item"
              {{on "click" (fn this.selectEmoji emoji)}}
            >
              {{emoji}}
            </button>
          {{/each}}
        </div>
      </div>
    </div>
  </template>
}
