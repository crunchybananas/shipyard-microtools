import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeBase64Tools } from "base64-tools/base64-tools/init";

export default class Base64ToolsApp extends Component {
  setupBase64Tools = modifier((element: HTMLElement) => {
    initializeBase64Tools(element);
  });

  <template>
    <div class="container" {{this.setupBase64Tools}}>
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>🔐 Base64 Tools</h1>
        <p class="subtitle">Encode and decode text, files, and images to/from
          Base64.</p>
      </header>

      <main>
        <div class="tabs">
          <button class="tab active" data-tab="text" type="button">Text</button>
          <button class="tab" data-tab="file" type="button">File/Image</button>
        </div>

        <div id="text-panel" class="panel active">
          <div class="input-section">
            <label for="textInput">Plain Text</label>
            <textarea
              id="textInput"
              rows="4"
              placeholder="Enter text to encode..."
            ></textarea>
            <button id="encodeTextBtn" class="primary-btn" type="button">Encode
              →</button>
          </div>

          <div class="input-section">
            <label for="base64Input">Base64</label>
            <textarea
              id="base64Input"
              rows="4"
              placeholder="Enter Base64 to decode..."
            ></textarea>
            <button id="decodeTextBtn" class="primary-btn" type="button">←
              Decode</button>
          </div>
        </div>

        <div id="file-panel" class="panel">
          <div class="input-section">
            <label>Upload File or Image</label>
            <div class="drop-zone" id="dropZone">
              <p>
                📁 Drop a file here or
                <label class="file-label">
                  browse
                  <input type="file" id="fileInput" />
                </label>
              </p>
            </div>
            <div id="filePreview" class="file-preview hidden">
              <img id="previewImg" alt="Preview" />
              <p id="fileName"></p>
            </div>
          </div>

          <div class="input-section">
            <label for="fileBase64Output">Base64 Output</label>
            <textarea
              id="fileBase64Output"
              rows="6"
              readonly
              placeholder="Base64 will appear here..."
            ></textarea>
            <div class="button-row">
              <button id="copyBase64Btn" class="secondary-btn" type="button">📋
                Copy</button>
              <button id="copyDataUrlBtn" class="secondary-btn" type="button">🔗
                Copy as Data URL</button>
            </div>
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
