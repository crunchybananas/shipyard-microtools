import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { GENERATORS, type GeneratorDef } from "uuid-generator/uuid-generator/generators";

// ── Signature ──────────────────────────────────────────────────

interface BulkGeneratorSignature {
  Args: {
    onStatus: (message: string) => void;
  };
}

// ── Component ──────────────────────────────────────────────────

export default class BulkGenerator extends Component<BulkGeneratorSignature> {
  @tracked selectedType = "uuid4";
  @tracked count = 10;
  @tracked output = "";

  // ── Computed ─────────────────────────────────────────────────

  get generators() {
    return GENERATORS;
  }

  get selectedGenerator(): GeneratorDef | undefined {
    return GENERATORS.find((g) => g.id === this.selectedType);
  }

  get hasOutput() {
    return this.output.length > 0;
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  onTypeChange = (e: Event) => {
    this.selectedType = (e.target as HTMLSelectElement).value;
  };

  onCountInput = (e: Event) => {
    const val = parseInt((e.target as HTMLInputElement).value) || 10;
    this.count = Math.min(100, Math.max(1, val));
  };

  generate = () => {
    const gen = this.selectedGenerator;
    if (!gen) return;
    const ids = Array.from({ length: this.count }, () => gen.generate());
    this.output = ids.join("\n");
  };

  copyAll = () => {
    if (!this.output) return;
    navigator.clipboard.writeText(this.output).then(() => {
      this.args.onStatus("✓ Copied all IDs");
    });
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="bulk-section">
      <h3>Bulk Generate</h3>
      <div class="bulk-controls">
        <select {{on "change" this.onTypeChange}}>
          {{#each this.generators as |gen|}}
            <option value={{gen.id}}>{{gen.title}}</option>
          {{/each}}
        </select>
        <input
          type="number"
          value={{this.count}}
          min="1"
          max="100"
          {{on "input" this.onCountInput}}
        />
        <button class="primary-btn" type="button" {{on "click" this.generate}}>
          Generate
        </button>
      </div>
      <textarea
        rows="8"
        readonly
        placeholder="Bulk IDs will appear here..."
      >{{this.output}}</textarea>
      {{#if this.hasOutput}}
        <button
          class="secondary-btn"
          type="button"
          {{on "click" this.copyAll}}
        >📋 Copy All</button>
      {{/if}}
    </div>
  </template>
}
