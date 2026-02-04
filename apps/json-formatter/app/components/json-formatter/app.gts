import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeJsonFormatter } from "json-formatter/json-formatter/init";

export default class JsonFormatterApp extends Component {
  setupJsonFormatter = modifier((element: HTMLElement) => {
    initializeJsonFormatter(element);
  });

  <template>
    <div class="container" {{this.setupJsonFormatter}}>
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>📋 JSON Formatter</h1>
        <p class="subtitle">Format, validate, and minify JSON instantly.</p>
      </header>

      <main>
        <div class="input-section">
          <label for="jsonInput">Paste JSON</label>
          <textarea
            id="jsonInput"
            rows="12"
            placeholder='{"name": "example", "value": 42}'
          ></textarea>

          <div class="button-row">
            <button id="formatBtn" class="primary-btn" type="button">✨ Format</button>
            <button id="minifyBtn" class="secondary-btn" type="button">📦 Minify</button>
            <button id="validateBtn" class="secondary-btn" type="button">✅ Validate</button>
            <button id="copyBtn" class="secondary-btn" type="button">📋 Copy</button>
          </div>
        </div>

        <div id="status" class="status hidden"></div>

        <div class="output-section">
          <div class="output-header">
            <label>Output</label>
            <span id="stats" class="stats"></span>
          </div>
          <pre id="output" class="output"></pre>
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
