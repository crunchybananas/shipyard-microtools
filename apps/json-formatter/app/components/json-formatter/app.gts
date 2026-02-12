import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { htmlSafe } from "@ember/template";
import type { SafeString } from "@ember/template/-private/handlebars";

// ── Pure utility: syntax highlight JSON ────────────────────────

function syntaxHighlight(json: string): string {
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "key" : "string";
      } else if (/true|false/.test(match)) {
        cls = "boolean";
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

// ── Component ──────────────────────────────────────────────────

export default class JsonFormatterApp extends Component {
  @tracked input = "";
  @tracked outputHtml = "";
  @tracked statsText = "";
  @tracked statusText = "";
  @tracked statusType: "success" | "error" | "" = "";

  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ─────────────────────────────────────────────────

  get statusClass() {
    if (!this.statusType) return "status hidden";
    return `status ${this.statusType}`;
  }

  get safeOutputHtml(): SafeString {
    return htmlSafe(this.outputHtml);
  }

  // ── Status toast ─────────────────────────────────────────────

  showStatus = (message: string, type: "success" | "error") => {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusText = message;
    this.statusType = type;
    this.statusTimer = setTimeout(() => {
      this.statusText = "";
      this.statusType = "";
    }, 3000);
  };

  // ── Event handlers (fat arrows) ──────────────────────────────

  onInput = (e: Event) => {
    this.input = (e.target as HTMLTextAreaElement).value;
  };

  onPaste = () => {
    // Defer so textarea value is updated
    setTimeout(() => this.format(), 50);
  };

  format = () => {
    const raw = this.input.trim();
    if (!raw) {
      this.showStatus("Please enter some JSON", "error");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const formatted = JSON.stringify(parsed, null, 2);
      this.outputHtml = syntaxHighlight(formatted);
      this.updateStats(formatted);
      this.showStatus("✓ Formatted successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.outputHtml = "";
      this.showStatus(`Invalid JSON: ${msg}`, "error");
    }
  };

  minify = () => {
    const raw = this.input.trim();
    if (!raw) {
      this.showStatus("Please enter some JSON", "error");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const minified = JSON.stringify(parsed);
      this.outputHtml = syntaxHighlight(minified);
      this.updateStats(minified);
      this.showStatus(
        `✓ Minified: ${raw.length} → ${minified.length} chars`,
        "success",
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.outputHtml = "";
      this.showStatus(`Invalid JSON: ${msg}`, "error");
    }
  };

  validate = () => {
    const raw = this.input.trim();
    if (!raw) {
      this.showStatus("Please enter some JSON", "error");
      return;
    }
    try {
      JSON.parse(raw);
      this.showStatus("✓ Valid JSON!", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.showStatus(`✗ Invalid: ${msg}`, "error");
    }
  };

  copy = async () => {
    // Extract text content from highlighted HTML
    const tmp = document.createElement("div");
    tmp.innerHTML = this.outputHtml;
    const text = tmp.textContent ?? "";
    if (!text) {
      this.showStatus("Nothing to copy", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.showStatus("✓ Copied to clipboard", "success");
    } catch {
      this.showStatus("Failed to copy", "error");
    }
  };

  // ── Private ──────────────────────────────────────────────────

  private updateStats(json: string) {
    try {
      const parsed = JSON.parse(json);
      const keys = JSON.stringify(parsed).match(/"[^"]+"\s*:/g) || [];
      this.statsText = `${keys.length} keys · ${json.length.toLocaleString()} chars`;
    } catch {
      this.statsText = "";
    }
  }

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>📋 JSON Formatter</h1>
        <p class="subtitle">Format, validate, and minify JSON instantly.</p>
      </header>

      <main>
        <div class="input-section">
          <label>Paste JSON</label>
          <textarea
            rows="12"
            placeholder='{"name": "example", "value": 42}'
            {{on "input" this.onInput}}
            {{on "paste" this.onPaste}}
          ></textarea>

          <div class="button-row">
            <button class="primary-btn" type="button" {{on "click" this.format}}>✨ Format</button>
            <button class="secondary-btn" type="button" {{on "click" this.minify}}>📦 Minify</button>
            <button class="secondary-btn" type="button" {{on "click" this.validate}}>✅ Validate</button>
            <button class="secondary-btn" type="button" {{on "click" this.copy}}>📋 Copy</button>
          </div>
        </div>

        <div class={{this.statusClass}}>{{this.statusText}}</div>

        <div class="output-section">
          <div class="output-header">
            <label>Output</label>
            {{#if this.statsText}}
              <span class="stats">{{this.statsText}}</span>
            {{/if}}
          </div>
          <pre class="output">{{{this.safeOutputHtml}}}</pre>
        </div>
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a
            href="https://crunchybananas.github.io"
            target="_blank" rel="noopener noreferrer"
          >Cory Loken & Chiron</a>
          using
          <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
