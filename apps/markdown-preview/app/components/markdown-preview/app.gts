import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeMarkdownPreview } from "markdown-preview/markdown-preview/init";

export default class MarkdownPreviewApp extends Component {
  setupMarkdownPreview = modifier((element: HTMLElement) => {
    initializeMarkdownPreview(element);
  });

  <template>
    <div class="container" {{this.setupMarkdownPreview}}>
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
                id="clearBtn"
                class="small-btn"
                type="button"
              >Clear</button>
            </div>
            <textarea
              id="markdownInput"
              placeholder="# Hello World

Write some **markdown** here...

- List item 1
- List item 2

```javascript
const greeting = 'Hello!';
console.log(greeting);
```
"
            ></textarea>
          </div>

          <div class="pane">
            <div class="pane-header">
              <span>Preview</span>
              <button id="copyHtmlBtn" class="small-btn" type="button">Copy HTML</button>
            </div>
            <div id="preview" class="preview"></div>
          </div>
        </div>

        <div id="status" class="status hidden"></div>
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
