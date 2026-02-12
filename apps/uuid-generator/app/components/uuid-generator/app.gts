import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { GENERATORS } from "uuid-generator/uuid-generator/generators";
import IdCard from "./id-card";
import BulkGenerator from "./bulk-generator";

export default class UuidGeneratorApp extends Component {
  @tracked statusText = "";

  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ─────────────────────────────────────────────────

  get generators() {
    return GENERATORS;
  }

  get statusClass() {
    return this.statusText ? "status success" : "status hidden";
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  showStatus = (message: string) => {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusText = message;
    this.statusTimer = setTimeout(() => {
      this.statusText = "";
    }, 2000);
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>🎲 UUID Generator</h1>
        <p class="subtitle">Generate UUIDs, ULIDs, and random IDs instantly.</p>
      </header>

      <main>
        <div class="generator-section">
          {{#each this.generators as |gen|}}
            <IdCard @generator={{gen}} @onStatus={{this.showStatus}} />
          {{/each}}
        </div>

        <BulkGenerator @onStatus={{this.showStatus}} />

        <div class={{this.statusClass}}>{{this.statusText}}</div>
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a
            href="https://crunchybananas.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >Cory Loken & Chiron</a>
          using
          <a
            href="https://emberjs.com"
            target="_blank"
            rel="noopener noreferrer"
          >Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
