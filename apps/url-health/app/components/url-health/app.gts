import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { on } from "@ember/modifier";

interface UrlIssue {
  text: string;
  type: "error" | "warn";
}

interface UrlResult {
  url: string;
  status: "checking" | "healthy" | "warning" | "error";
  statusCode: number | null;
  loadTime: number | null;
  ssl: boolean | null;
  issues: UrlIssue[];
  details: Record<string, string>;
}

export default class UrlHealthApp extends Component {
  @tracked urlsInput = "";
  @tracked checkSsl = true;
  @tracked checkSpeed = true;
  @tracked isChecking = false;
  @tracked showResults = false;
  @tracked results: UrlResult[] = [];
  @tracked healthyCount = 0;
  @tracked warningCount = 0;
  @tracked errorCount = 0;

  get totalCount(): number {
    return this.results.length;
  }

  @action
  updateUrls(event: Event): void {
    this.urlsInput = (event.target as HTMLTextAreaElement).value;
  }

  @action
  toggleSsl(): void {
    this.checkSsl = !this.checkSsl;
  }

  @action
  toggleSpeed(): void {
    this.checkSpeed = !this.checkSpeed;
  }

  @action
  async checkAllUrls(): Promise<void> {
    const urlsText = this.urlsInput.trim();
    if (!urlsText) {
      alert("Please enter at least one URL");
      return;
    }

    const urls = urlsText
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      alert("Please enter valid URLs");
      return;
    }

    this.isChecking = true;
    this.showResults = true;
    this.healthyCount = 0;
    this.warningCount = 0;
    this.errorCount = 0;

    // Create placeholder results
    this.results = urls.map((url) => ({
      url,
      status: "checking" as const,
      statusCode: null,
      loadTime: null,
      ssl: null,
      issues: [],
      details: {},
    }));

    // Check each URL
    for (let i = 0; i < urls.length; i++) {
      const result = await this.checkUrl(urls[i]!);
      // Update results array immutably
      this.results = [
        ...this.results.slice(0, i),
        result,
        ...this.results.slice(i + 1),
      ];

      if (result.status === "healthy") this.healthyCount++;
      else if (result.status === "warning") this.warningCount++;
      else if (result.status === "error") this.errorCount++;

      // Small delay between checks
      if (i < urls.length - 1) {
        await this.sleep(200);
      }
    }

    this.isChecking = false;
  }

  async checkUrl(url: string): Promise<UrlResult> {
    const result: UrlResult = {
      url,
      status: "healthy",
      statusCode: null,
      loadTime: null,
      ssl: null,
      issues: [],
      details: {},
    };

    let normalizedUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      normalizedUrl = "https://" + url;
    }

    try {
      const urlObj = new URL(normalizedUrl);
      result.details["protocol"] = urlObj.protocol.replace(":", "");
      result.details["host"] = urlObj.host;

      if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") {
        result.status = "error";
        result.issues.push({
          text: "Localhost URL - not publicly accessible",
          type: "error",
        });
        return result;
      }

      if (this.checkSsl) {
        if (urlObj.protocol === "https:") {
          result.ssl = true;
          result.details["ssl"] = "Valid";
        } else {
          result.ssl = false;
          result.details["ssl"] = "No HTTPS";
          result.issues.push({
            text: "No SSL/HTTPS - security risk",
            type: "warn",
          });
          if (result.status === "healthy") result.status = "warning";
        }
      }

      const startTime = performance.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(normalizedUrl, {
          method: "HEAD",
          mode: "cors",
          signal: controller.signal,
        }).catch(async () => {
          return fetch(normalizedUrl, {
            method: "HEAD",
            mode: "no-cors",
            signal: controller.signal,
          });
        });

        clearTimeout(timeout);

        const endTime = performance.now();
        const loadTime = Math.round(endTime - startTime);

        if (this.checkSpeed) {
          result.loadTime = loadTime;
          result.details["loadTime"] = `${loadTime}ms`;

          if (loadTime > 5000) {
            result.issues.push({
              text: "Very slow response (>5s)",
              type: "warn",
            });
            if (result.status === "healthy") result.status = "warning";
          } else if (loadTime > 2000) {
            result.issues.push({ text: "Slow response (>2s)", type: "warn" });
          }
        }

        if (response.type !== "opaque") {
          result.statusCode = response.status;
          result.details["statusCode"] = String(response.status);

          if (response.status >= 200 && response.status < 300) {
            result.details["statusText"] = "OK";
          } else if (response.status >= 300 && response.status < 400) {
            result.details["statusText"] = "Redirect";
            result.issues.push({
              text: `Redirects (${response.status})`,
              type: "warn",
            });
          } else if (response.status >= 400 && response.status < 500) {
            result.details["statusText"] = "Client Error";
            result.issues.push({
              text: `Client error (${response.status})`,
              type: "error",
            });
            result.status = "error";
          } else if (response.status >= 500) {
            result.details["statusText"] = "Server Error";
            result.issues.push({
              text: `Server error (${response.status})`,
              type: "error",
            });
            result.status = "error";
          }
        } else {
          result.details["statusCode"] = "(CORS blocked)";
          result.details["statusText"] = "Reachable";
        }
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          result.status = "error";
          result.issues.push({ text: "Request timeout (>10s)", type: "error" });
          result.details["statusText"] = "Timeout";
        } else {
          result.status = "warning";
          result.issues.push({
            text: "Could not verify (CORS/network issue)",
            type: "warn",
          });
          result.details["statusText"] = "Unknown";
        }
      }
    } catch {
      result.status = "error";
      result.issues.push({ text: "Invalid URL format", type: "error" });
    }

    return result;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>🏥 Proof URL Health Checker</h1>
        <p class="subtitle">Batch validate your proof URLs before ships go stale.</p>
      </header>

      <main>
        <div class="input-section">
          <label for="urlsInput">Proof URLs (one per line)</label>
          <textarea
            id="urlsInput"
            rows="6"
            placeholder="https://github.com/you/project1
https://your-demo.vercel.app
https://example.com/proof"
            {{on "input" this.updateUrls}}
          >{{this.urlsInput}}</textarea>

          <div class="options">
            <label class="checkbox-label">
              <input type="checkbox" checked={{this.checkSsl}} {{on "change" this.toggleSsl}} />
              Check SSL certificate
            </label>
            <label class="checkbox-label">
              <input type="checkbox" checked={{this.checkSpeed}} {{on "change" this.toggleSpeed}} />
              Measure load time
            </label>
          </div>

          <button
            type="button"
            class="primary-btn"
            disabled={{this.isChecking}}
            {{on "click" this.checkAllUrls}}
          >
            {{#if this.isChecking}}
              <span>Checking...</span>
            {{else}}
              <span>🔍 Check All URLs</span>
            {{/if}}
          </button>
        </div>

        {{#if this.showResults}}
          <div class="results">
            <div class="summary-bar">
              <div class="summary-stat">
                <span class="stat-value">{{this.totalCount}}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="summary-stat healthy">
                <span class="stat-value">{{this.healthyCount}}</span>
                <span class="stat-label">Healthy</span>
              </div>
              <div class="summary-stat warning">
                <span class="stat-value">{{this.warningCount}}</span>
                <span class="stat-label">Warnings</span>
              </div>
              <div class="summary-stat error">
                <span class="stat-value">{{this.errorCount}}</span>
                <span class="stat-label">Errors</span>
              </div>
            </div>

            <div class="results-list">
              {{#each this.results as |result|}}
                <div class="result-card {{result.status}}">
                  <div class="result-header">
                    <span class="status-icon">
                      {{#if (eq result.status "checking")}}⏳{{/if}}
                      {{#if (eq result.status "healthy")}}✅{{/if}}
                      {{#if (eq result.status "warning")}}⚠️{{/if}}
                      {{#if (eq result.status "error")}}❌{{/if}}
                    </span>
                    <span class="result-url">{{result.url}}</span>
                  </div>
                  {{#if result.issues.length}}
                    <ul class="issues-list">
                      {{#each result.issues as |issue|}}
                        <li class="issue {{issue.type}}">{{issue.text}}</li>
                      {{/each}}
                    </ul>
                  {{/if}}
                  {{#if result.loadTime}}
                    <div class="result-meta">
                      <span>Load time: {{result.loadTime}}ms</span>
                    </div>
                  {{/if}}
                </div>
              {{/each}}
            </div>
          </div>
        {{/if}}
      </main>

      <footer>
        <p class="note">Note: Some checks may be limited by browser CORS policies.</p>
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener">Cory Loken & Chiron</a>
          using <a href="https://emberjs.com" target="_blank" rel="noopener">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}
