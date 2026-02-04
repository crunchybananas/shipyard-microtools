import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeTokenLens } from "token-lens/token-lens/init";

export default class TokenLensApp extends Component {
  setupTokenLens = modifier((element: HTMLElement) => {
    initializeTokenLens(element);
  });

  <template>
    <div class="app" {{this.setupTokenLens}}>
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>Token Lens</h1>
        <p>JWT decode + verify. Runs 100% in your browser. No data is stored or sent.</p>
      </header>

      <section class="input">
        <label>JWT</label>
        <textarea id="jwtInput" placeholder="paste your JWT here..."></textarea>
        <div class="actions">
          <button id="decodeBtn" class="btn primary">Decode</button>
          <button id="clearBtn" class="btn">Clear</button>
        </div>
      </section>

      <section class="panel">
        <div>
          <h3>Header</h3>
          <pre id="headerOutput">—</pre>
        </div>
        <div>
          <h3>Payload</h3>
          <pre id="payloadOutput">—</pre>
        </div>
      </section>

      <section class="panel">
        <div>
          <h3>Signature</h3>
          <pre id="signatureOutput">—</pre>
        </div>
        <div>
          <h3>Verification (HS256)</h3>
          <p class="helper">Checks HMAC signatures only. No data leaves your browser.</p>
          <div class="verify-row">
            <input id="secretInput" type="text" placeholder="paste HS256 secret" />
            <button id="verifyBtn" class="btn">Verify</button>
          </div>
          <p id="verifyStatus" class="muted">No verification attempted.</p>
        </div>
      </section>

      <section class="meta">
        <div class="meta-card">
          <h4>Times</h4>
          <p>Issued at: <span id="iat">—</span></p>
          <p>Expires at: <span id="exp">—</span></p>
        </div>
        <div class="meta-card">
          <h4>Privacy</h4>
          <p>All decoding happens locally. Nothing is stored or transmitted.</p>
        </div>
      </section>
    </div>

    <footer>
      Built with Ember •
      <a href="https://crunchybananas.com/donate">Support Crunchy Bananas</a>
    </footer>
  </template>
}
