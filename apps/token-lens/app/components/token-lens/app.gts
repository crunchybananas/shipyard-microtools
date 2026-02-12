import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";

// ── Pure utilities ─────────────────────────────────────────────

function base64UrlDecode(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function unixToDate(value?: number): string {
  if (!value) return "—";
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

// ── Decoded JWT shape ──────────────────────────────────────────

interface DecodedJwt {
  header: string;
  payload: string;
  signature: string;
  iat: string;
  exp: string;
}

function decodeToken(token: string): DecodedJwt | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  try {
    const headerJson = JSON.parse(base64UrlDecode(parts[0] ?? ""));
    const payloadJson = JSON.parse(base64UrlDecode(parts[1] ?? ""));
    return {
      header: prettyJson(headerJson),
      payload: prettyJson(payloadJson),
      signature: parts[2] ?? "—",
      iat: unixToDate(payloadJson.iat as number | undefined),
      exp: unixToDate(payloadJson.exp as number | undefined),
    };
  } catch {
    return null;
  }
}

// ── Component ──────────────────────────────────────────────────

export default class TokenLensApp extends Component {
  @tracked jwtInput = "";
  @tracked secret = "";
  @tracked verifyStatus = "No verification attempted.";

  // ── Computed (auto-tracked) ──────────────────────────────────

  get decoded(): DecodedJwt | null {
    return decodeToken(this.jwtInput.trim());
  }

  get headerText() {
    return this.decoded?.header ?? "—";
  }

  get payloadText() {
    return this.decoded?.payload ?? "—";
  }

  get signatureText() {
    return this.decoded?.signature ?? "—";
  }

  get iatText() {
    return this.decoded?.iat ?? "—";
  }

  get expText() {
    return this.decoded?.exp ?? "—";
  }

  get hasToken() {
    return this.jwtInput.trim().length > 0;
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  onJwtInput = (e: Event) => {
    this.jwtInput = (e.target as HTMLTextAreaElement).value;
  };

  onSecretInput = (e: Event) => {
    this.secret = (e.target as HTMLInputElement).value;
  };

  clear = () => {
    this.jwtInput = "";
    this.secret = "";
    this.verifyStatus = "No verification attempted.";
  };

  verify = async () => {
    const token = this.jwtInput.trim();
    const secret = this.secret.trim();
    if (!token || !secret) {
      this.verifyStatus = "Provide a JWT and secret.";
      return;
    }

    const [header, payload, signature] = token.split(".");
    const data = new TextEncoder().encode(`${header}.${payload}`);
    const keyData = new TextEncoder().encode(secret);

    try {
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
      const signatureBytes = new Uint8Array(signatureBuffer);
      const computed = btoa(String.fromCharCode(...signatureBytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      this.verifyStatus =
        computed === signature ? "Signature valid ✅" : "Signature invalid ❌";
    } catch {
      this.verifyStatus = "Verification failed.";
    }
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="app">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>Token Lens</h1>
        <p>JWT decode + verify. Runs 100% in your browser. No data is stored or
          sent.</p>
      </header>

      <section class="input">
        <label>JWT</label>
        <textarea
          placeholder="paste your JWT here..."
          {{on "input" this.onJwtInput}}
        >{{this.jwtInput}}</textarea>
        <div class="actions">
          <button class="btn primary" type="button" {{on "click" this.verify}}>Decode</button>
          <button class="btn" type="button" {{on "click" this.clear}}>Clear</button>
        </div>
      </section>

      <section class="panel">
        <div>
          <h3>Header</h3>
          <pre>{{this.headerText}}</pre>
        </div>
        <div>
          <h3>Payload</h3>
          <pre>{{this.payloadText}}</pre>
        </div>
      </section>

      <section class="panel">
        <div>
          <h3>Signature</h3>
          <pre>{{this.signatureText}}</pre>
        </div>
        <div>
          <h3>Verification (HS256)</h3>
          <p class="helper">Checks HMAC signatures only. No data leaves your
            browser.</p>
          <div class="verify-row">
            <input
              type="text"
              placeholder="paste HS256 secret"
              value={{this.secret}}
              {{on "input" this.onSecretInput}}
            />
            <button class="btn" type="button" {{on "click" this.verify}}>Verify</button>
          </div>
          <p class="muted">{{this.verifyStatus}}</p>
        </div>
      </section>

      <section class="meta">
        <div class="meta-card">
          <h4>Times</h4>
          <p>Issued at: {{this.iatText}}</p>
          <p>Expires at: {{this.expText}}</p>
        </div>
        <div class="meta-card">
          <h4>Privacy</h4>
          <p>All decoding happens locally. Nothing is stored or transmitted.</p>
        </div>
      </section>
    </div>

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
  </template>
}
