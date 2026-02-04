import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeUuidGenerator } from "uuid-generator/uuid-generator/init";

export default class UuidGeneratorApp extends Component {
  setupUuidGenerator = modifier((element: HTMLElement) => {
    initializeUuidGenerator(element);
  });

  <template>
    <div class="container" {{this.setupUuidGenerator}}>
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>🎲 UUID Generator</h1>
        <p class="subtitle">Generate UUIDs, ULIDs, and random IDs instantly.</p>
      </header>

      <main>
        <div class="generator-section">
          <div class="generator-card">
            <h3>UUID v4</h3>
            <p class="desc">Random 128-bit identifier</p>
            <div class="output-row">
              <input type="text" id="uuid4" readonly />
              <button
                class="copy-btn"
                data-target="uuid4"
                type="button"
              >📋</button>
            </div>
            <button class="regen-btn" data-type="uuid4" type="button">🔄
              Regenerate</button>
          </div>

          <div class="generator-card">
            <h3>UUID v7</h3>
            <p class="desc">Time-ordered, sortable UUID</p>
            <div class="output-row">
              <input type="text" id="uuid7" readonly />
              <button
                class="copy-btn"
                data-target="uuid7"
                type="button"
              >📋</button>
            </div>
            <button class="regen-btn" data-type="uuid7" type="button">🔄
              Regenerate</button>
          </div>

          <div class="generator-card">
            <h3>Nano ID</h3>
            <p class="desc">Compact URL-safe ID (21 chars)</p>
            <div class="output-row">
              <input type="text" id="nanoid" readonly />
              <button
                class="copy-btn"
                data-target="nanoid"
                type="button"
              >📋</button>
            </div>
            <button class="regen-btn" data-type="nanoid" type="button">🔄
              Regenerate</button>
          </div>

          <div class="generator-card">
            <h3>Short ID</h3>
            <p class="desc">8-character alphanumeric</p>
            <div class="output-row">
              <input type="text" id="shortid" readonly />
              <button
                class="copy-btn"
                data-target="shortid"
                type="button"
              >📋</button>
            </div>
            <button class="regen-btn" data-type="shortid" type="button">🔄
              Regenerate</button>
          </div>
        </div>

        <div class="bulk-section">
          <h3>Bulk Generate</h3>
          <div class="bulk-controls">
            <select id="bulkType">
              <option value="uuid4">UUID v4</option>
              <option value="uuid7">UUID v7</option>
              <option value="nanoid">Nano ID</option>
              <option value="shortid">Short ID</option>
            </select>
            <input type="number" id="bulkCount" value="10" min="1" max="100" />
            <button
              id="bulkGenBtn"
              class="primary-btn"
              type="button"
            >Generate</button>
          </div>
          <textarea
            id="bulkOutput"
            rows="8"
            readonly
            placeholder="Bulk IDs will appear here..."
          ></textarea>
          <button id="copyBulkBtn" class="secondary-btn" type="button">📋 Copy
            All</button>
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
