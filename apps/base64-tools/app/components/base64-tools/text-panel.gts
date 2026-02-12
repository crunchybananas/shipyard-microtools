import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";

// ── Signature ──────────────────────────────────────────────────

interface TextPanelSignature {
  Args: {
    onStatus: (message: string, type: "success" | "error") => void;
  };
}

// ── Component ──────────────────────────────────────────────────

export default class TextPanel extends Component<TextPanelSignature> {
  @tracked plainText = "";
  @tracked base64Text = "";

  // ── Event handlers (fat arrows) ──────────────────────────────

  onPlainTextInput = (e: Event) => {
    this.plainText = (e.target as HTMLTextAreaElement).value;
  };

  onBase64Input = (e: Event) => {
    this.base64Text = (e.target as HTMLTextAreaElement).value;
  };

  encode = () => {
    if (!this.plainText) {
      this.args.onStatus("Enter some text to encode", "error");
      return;
    }
    try {
      this.base64Text = btoa(unescape(encodeURIComponent(this.plainText)));
      this.args.onStatus("✓ Encoded successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.args.onStatus(`Encoding failed: ${msg}`, "error");
    }
  };

  decode = () => {
    if (!this.base64Text.trim()) {
      this.args.onStatus("Enter some Base64 to decode", "error");
      return;
    }
    try {
      this.plainText = decodeURIComponent(escape(atob(this.base64Text.trim())));
      this.args.onStatus("✓ Decoded successfully", "success");
    } catch {
      this.args.onStatus("Decoding failed: Invalid Base64", "error");
    }
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="panel active">
      <div class="input-section">
        <label>Plain Text</label>
        <textarea
          rows="4"
          placeholder="Enter text to encode..."
          {{on "input" this.onPlainTextInput}}
        >{{this.plainText}}</textarea>
        <button class="primary-btn" type="button" {{on "click" this.encode}}>
          Encode →
        </button>
      </div>

      <div class="input-section">
        <label>Base64</label>
        <textarea
          rows="4"
          placeholder="Enter Base64 to decode..."
          {{on "input" this.onBase64Input}}
        >{{this.base64Text}}</textarea>
        <button class="primary-btn" type="button" {{on "click" this.decode}}>
          ← Decode
        </button>
      </div>
    </div>
  </template>
}
