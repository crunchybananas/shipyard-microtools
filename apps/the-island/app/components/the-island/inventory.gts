import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { ITEMS, type Item } from "the-island/services/game-state";

interface InventorySignature {
  Args: {
    items: string[];
    onExamineItem: (itemId: string) => void;
  };
  Element: HTMLElement;
}

export default class Inventory extends Component<InventorySignature> {
  get inventoryItems(): Item[] {
    return this.args.items
      .map((id) => ITEMS[id])
      .filter((item): item is Item => item !== undefined);
  }

  handleClick = (itemId: string): void => {
    this.args.onExamineItem(itemId);
  };

  <template>
    <footer class="inventory-panel" ...attributes>
      <span class="inventory-label">Inventory</span>
      <div class="inventory-items" role="list" aria-label="Inventory items">
        {{#each this.inventoryItems as |item|}}
          <div
            class="inventory-item"
            role="listitem"
            title={{item.name}}
            {{on "click" (fn this.handleClick item.id)}}
          >
            <span class="item-icon">{{item.icon}}</span>
          </div>
        {{/each}}
      </div>
    </footer>
  </template>
}
