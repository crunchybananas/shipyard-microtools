import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";

// ── Signature ──────────────────────────────────────────────────

interface StatusMessageSignature {
  Args: {
    text: string;
    type: "success" | "error" | "";
  };
}

// ── Component ──────────────────────────────────────────────────

export default class StatusMessage extends Component<StatusMessageSignature> {
  get statusClass() {
    const { text, type } = this.args;
    if (!text || !type) return "status hidden";
    return `status ${type}`;
  }

  <template>
    <div class={{this.statusClass}}>{{@text}}</div>
  </template>
}
