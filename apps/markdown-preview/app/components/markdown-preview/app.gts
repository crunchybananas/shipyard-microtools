import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { htmlSafe } from "@ember/template";
import type { SafeString } from "@ember/template/-private/handlebars";

// ── Pure utility: regex-based markdown → HTML ──────────────────

function parseMarkdown(markdown: string): string {
  let html = markdown;

  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank">$1</a>',
  );

  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" />',
  );

  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "<hr />");

  html = html.replace(/^[*\-+] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  const lines = html.split("\n");
  const processed: string[] = [];
  let inPre = false;

  for (const line of lines) {
    if (line.includes("<pre>")) inPre = true;
    if (line.includes("</pre>")) inPre = false;

    if (
      !inPre &&
      line.trim() &&
      !line.startsWith("<h") &&
      !line.startsWith("<ul") &&
      !line.startsWith("<ol") &&
      !line.startsWith("<li") &&
      !line.startsWith("<blockquote") &&
      !line.startsWith("<hr") &&
      !line.startsWith("<pre") &&
      !line.startsWith("</")
    ) {
      processed.push(`<p>${line}</p>`);
    } else {
      processed.push(line);
    }
  }

  html = processed.join("\n");
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

// ── Default content ────────────────────────────────────────────

const DEFAULT_MARKDOWN = `# Hello Shipyard! 🚀

This is a **live markdown preview** tool.

## Features

- Real-time preview
- Syntax highlighting for code
- Copy rendered HTML

### Code Example

\`\`\`javascript
const ship = {
  name: 'My Awesome Ship',
  status: 'verified'
};
console.log(ship);
\`\`\`

> Pro tip: Use \`inline code\` for short snippets.

---

Built with **Ember** • [Support Crunchy Bananas](https://crunchybananas.com/donate)
`;

// ── Component ──────────────────────────────────────────────────

export default class MarkdownPreviewApp extends Component {
  @tracked markdown = DEFAULT_MARKDOWN;
  @tracked statusText = "";
  @tracked statusVisible = false;

  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ─────────────────────────────────────────────────

  get renderedHtml(): string {
    return parseMarkdown(this.markdown);
  }

  get safeHtml(): SafeString {
    return htmlSafe(this.renderedHtml);
  }

  get statusClass() {
    return this.statusVisible ? "status success" : "status hidden";
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  onInput = (e: Event) => {
    this.markdown = (e.target as HTMLTextAreaElement).value;
  };

  clear = () => {
    this.markdown = "";
  };

  copyHtml = async () => {
    if (!this.renderedHtml) return;
    try {
      await navigator.clipboard.writeText(this.renderedHtml);
      this.showStatus("✓ HTML copied to clipboard");
    } catch {
      // clipboard access denied
    }
  };

  private showStatus(message: string) {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusText = message;
    this.statusVisible = true;
    this.statusTimer = setTimeout(() => {
      this.statusVisible = false;
    }, 2000);
  }

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>📝 Markdown Preview</h1>
        <p class="subtitle">Live preview your Markdown with syntax highlighting.</p>
      </header>

      <main>
        <div class="editor-container">
          <div class="pane">
            <div class="pane-header">
              <span>Markdown</span>
              <button
                class="small-btn"
                type="button"
                {{on "click" this.clear}}
              >Clear</button>
            </div>
            <textarea
              placeholder="# Hello World

Write some **markdown** here..."
              {{on "input" this.onInput}}
            >{{this.markdown}}</textarea>
          </div>

          <div class="pane">
            <div class="pane-header">
              <span>Preview</span>
              <button class="small-btn" type="button" {{on "click" this.copyHtml}}>Copy HTML</button>
            </div>
            <div class="preview">{{{this.safeHtml}}}</div>
          </div>
        </div>

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
