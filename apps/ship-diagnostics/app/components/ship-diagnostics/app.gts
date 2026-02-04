import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeShipDiagnostics } from "ship-diagnostics/ship-diagnostics/init";

export default class ShipDiagnosticsApp extends Component {
  setupDiagnostics = modifier((element: HTMLElement) => {
    initializeShipDiagnostics(element);
  });

  <template>
    <div class="container" {{this.setupDiagnostics}}>
      <header>
        <a href="../../" class="back">← All Tools</a>
        <div class="title">
          <h1>🧭 Ship Diagnostics Studio</h1>
          <p class="subtitle">Local-first log explorer with filters, search, and export.</p>
        </div>
      </header>

      <main>
        <aside class="filters">
          <div class="panel">
            <h2>Dataset</h2>
            <label for="datasetSelect">Sample logs</label>
            <select id="datasetSelect"></select>

            <label for="fileInput">Or load a file (JSON / JSONL)</label>
            <input id="fileInput" type="file" accept="application/json,.json,.jsonl,.log,.txt" />
          </div>

          <div class="panel">
            <h2>Filters</h2>
            <label for="levelSelect">Level</label>
            <select id="levelSelect">
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>

            <label for="serviceSelect">Service</label>
            <select id="serviceSelect">
              <option value="all">All</option>
            </select>

            <label for="searchInput">Search</label>
            <input id="searchInput" type="text" placeholder="message, tag, or context" />

            <div class="button-row">
              <button id="clearBtn" class="secondary" type="button">Clear</button>
              <button id="exportBtn" class="primary" type="button">Export JSON</button>
            </div>
          </div>
        </aside>

        <section class="stream">
          <div class="stream-header">
            <h2>Log Stream</h2>
            <span id="logStats" class="stats"></span>
          </div>
          <ul id="logList" class="log-list"></ul>
        </section>

        <aside class="detail">
          <div class="detail-header">
            <h2>Detail</h2>
            <span id="detailMeta" class="detail-meta"></span>
          </div>
          <h3 id="detailTitle">Select a log entry</h3>
          <p id="detailMessage" class="detail-message"></p>
          <pre id="detailContext" class="detail-context"></pre>
        </aside>
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
