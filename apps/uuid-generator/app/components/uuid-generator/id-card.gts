import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import type { GeneratorDef } from "uuid-generator/uuid-generator/generators";

// ── Signature ──────────────────────────────────────────────────

interface IdCardSignature {
  Args: {
    generator: GeneratorDef;
    onStatus: (message: string) => void;
  };
}

// ── Component ──────────────────────────────────────────────────

export default class IdCard extends Component<IdCardSignature> {
  @tracked value = this.args.generator.generate();

  // ── Event handlers (fat arrows) ──────────────────────────────

  regenerate = () => {
    this.value = this.args.generator.generate();
  };

  copy = () => {
    navigator.clipboard.writeText(this.value).then(() => {
      this.args.onStatus("✓ Copied to clipboard");
    });
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="generator-card">
      <h3>{{@generator.title}}</h3>
      <p class="desc">{{@generator.description}}</p>
      <div class="output-row">
        <input type="text" readonly value={{this.value}} />
        <button class="copy-btn" type="button" {{on "click" this.copy}}>📋</button>
      </div>
      <button class="regen-btn" type="button" {{on "click" this.regenerate}}>
        🔄 Regenerate
      </button>
    </div>
  </template>
}
