import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type { LogEntry, LogLevel } from "ship-diagnostics/ship-diagnostics/data/sample-logs";
import { sampleSets } from "ship-diagnostics/ship-diagnostics/data/sample-logs";
import { parseLogText, formatTimestamp } from "ship-diagnostics/ship-diagnostics/log-utils";
import LogItem from "./log-item";
import TimelineHeatmap from "./timeline-heatmap";

// ── Helpers ────────────────────────────────────────────────────

const eq = (a: unknown, b: unknown) => a === b;

// ── Build initial datasets map ─────────────────────────────────

interface Dataset {
  name: string;
  logs: LogEntry[];
}

const INITIAL_DATASETS: Dataset[] = Object.entries(sampleSets).map(
  ([name, logs]) => ({ name, logs }),
);

// ── Component ──────────────────────────────────────────────────

export default class ShipDiagnosticsApp extends Component {
  @tracked datasets: Dataset[] = [...INITIAL_DATASETS];
  @tracked activeDatasetName = INITIAL_DATASETS[0]?.name ?? "Sample";
  @tracked levelFilter = "all";
  @tracked serviceFilter = "all";
  @tracked searchQuery = "";
  @tracked selectedId: string | null = null;
  @tracked timeRange: [number, number] | null = null;
  @tracked isLive = false;
  @tracked unseenLive = 0;
  private liveTimer: ReturnType<typeof setTimeout> | null = null;
  private logListEl: HTMLElement | null = null;
  private liveCounter = 0;

  // ── Computed (auto-tracked) ──────────────────────────────────

  get activeLogs(): LogEntry[] {
    return this.datasets.find((d) => d.name === this.activeDatasetName)?.logs ?? [];
  }

  get services(): string[] {
    return Array.from(new Set(this.activeLogs.map((l) => l.service))).sort();
  }

  // Heatmap operates on the level+service+search-filtered logs but ignores
  // the time range selection, so brushing doesn't shrink the heatmap itself.
  get preTimeFilteredLogs(): LogEntry[] {
    const search = this.searchQuery.trim().toLowerCase();
    return this.activeLogs.filter((log) => {
      if (this.levelFilter !== "all" && log.level !== this.levelFilter) return false;
      if (this.serviceFilter !== "all" && log.service !== this.serviceFilter) return false;
      if (search) {
        const haystack = [
          log.message,
          log.service,
          ...(log.tags ?? []),
          JSON.stringify(log.context ?? {}),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  get filteredLogs(): LogEntry[] {
    const base = this.preTimeFilteredLogs;
    const range = this.timeRange;
    if (!range) return base;
    return base.filter((log) => {
      const t = Date.parse(log.timestamp);
      return t >= range[0] && t < range[1];
    });
  }

  get statsText(): string {
    return `${this.filteredLogs.length.toLocaleString()} / ${this.activeLogs.length.toLocaleString()} logs`;
  }

  get levelDistribution(): {
    info: number;
    warn: number;
    error: number;
    total: number;
    segments: Array<{ level: string; count: number; color: string; dashArray: string; dashOffset: string }>;
  } {
    const logs = this.filteredLogs;
    const info = logs.filter((l) => l.level === "info").length;
    const warn = logs.filter((l) => l.level === "warn").length;
    const error = logs.filter((l) => l.level === "error").length;
    const total = info + warn + error;
    const CIRC = 2 * Math.PI * 32; // r=32
    const segments: Array<{
      level: string;
      count: number;
      color: string;
      dashArray: string;
      dashOffset: string;
    }> = [];
    if (total === 0) return { info, warn, error, total, segments };
    const data = [
      { level: "info", count: info, color: "#5fd3ff" },
      { level: "warn", count: warn, color: "#ffb347" },
      { level: "error", count: error, color: "#ff6b6b" },
    ];
    let accumulated = 0;
    for (const d of data) {
      if (d.count === 0) continue;
      const fraction = d.count / total;
      const arc = CIRC * fraction;
      segments.push({
        level: d.level,
        count: d.count,
        color: d.color,
        dashArray: `${arc} ${CIRC - arc}`,
        dashOffset: `${-accumulated}`,
      });
      accumulated += arc;
    }
    return { info, warn, error, total, segments };
  }

  get selectedLog(): LogEntry | null {
    if (!this.selectedId) return null;
    return this.filteredLogs.find((l) => l.id === this.selectedId) ?? null;
  }

  get detailMeta(): string {
    const log = this.selectedLog;
    if (!log) return "";
    return `${formatTimestamp(log.timestamp)} · ${log.service}`;
  }

  get detailTitle(): string {
    return this.selectedLog?.level.toUpperCase() ?? "Select a log entry";
  }

  get detailMessage(): string {
    return this.selectedLog?.message ?? "";
  }

  get detailContext(): string {
    const log = this.selectedLog;
    if (!log) return "";
    return JSON.stringify(log.context ?? {}, null, 2);
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  onDatasetChange = (e: Event) => {
    const name = (e.target as HTMLSelectElement).value;
    this.activeDatasetName = name;
    this.levelFilter = "all";
    this.serviceFilter = "all";
    this.searchQuery = "";
    this.selectedId = this.activeLogs[0]?.id ?? null;
  };

  onFileUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const logs = parseLogText(text);
        if (logs.length === 0) return;
        const name = `Uploaded: ${file.name}`;
        this.datasets = [...this.datasets, { name, logs }];
        this.activeDatasetName = name;
        this.levelFilter = "all";
        this.serviceFilter = "all";
        this.searchQuery = "";
        this.selectedId = logs[0]?.id ?? null;
      } catch {
        // invalid file
      }
    };
    reader.readAsText(file);
  };

  onLevelChange = (e: Event) => {
    this.levelFilter = (e.target as HTMLSelectElement).value;
  };

  onServiceChange = (e: Event) => {
    this.serviceFilter = (e.target as HTMLSelectElement).value;
  };

  onSearchInput = (e: Event) => {
    this.searchQuery = (e.target as HTMLInputElement).value;
  };

  selectLog = (log: LogEntry) => {
    this.selectedId = log.id;
  };

  clearFilters = () => {
    this.levelFilter = "all";
    this.serviceFilter = "all";
    this.searchQuery = "";
    this.timeRange = null;
  };

  setTimeRange = (range: [number, number] | null) => {
    this.timeRange = range;
  };

  setupLogList = modifier((element: HTMLElement) => {
    this.logListEl = element;
    element.addEventListener("scroll", this.onLogScroll);
    return () => {
      element.removeEventListener("scroll", this.onLogScroll);
      this.logListEl = null;
    };
  });

  onLogScroll = () => {
    if (!this.logListEl) return;
    const atBottom =
      this.logListEl.scrollHeight -
        (this.logListEl.scrollTop + this.logListEl.clientHeight) <
      20;
    if (atBottom && this.unseenLive > 0) {
      this.unseenLive = 0;
    }
  };

  scrollToBottom = () => {
    if (!this.logListEl) return;
    this.logListEl.scrollTop = this.logListEl.scrollHeight;
    this.unseenLive = 0;
  };

  toggleLive = () => {
    if (this.isLive) {
      this.stopLive();
    } else {
      this.startLive();
    }
  };

  private startLive() {
    // Prepare or reuse a "Live Feed" dataset and switch to it
    const liveName = "Live Feed";
    if (!this.datasets.find((d) => d.name === liveName)) {
      this.datasets = [
        ...this.datasets,
        { name: liveName, logs: this.synthesizeSeed() },
      ];
    }
    this.activeDatasetName = liveName;
    this.timeRange = null;
    this.selectedId = null;
    this.isLive = true;
    this.unseenLive = 0;
    this.scheduleNextLive();
  }

  private stopLive() {
    this.isLive = false;
    if (this.liveTimer) {
      clearTimeout(this.liveTimer);
      this.liveTimer = null;
    }
  }

  private scheduleNextLive() {
    if (!this.isLive) return;
    const delay = 400 + Math.random() * 1100;
    this.liveTimer = setTimeout(() => {
      this.emitLiveLog();
      this.scheduleNextLive();
    }, delay);
  }

  private emitLiveLog() {
    const entry = this.synthesizeEntry();
    this.datasets = this.datasets.map((d) =>
      d.name === "Live Feed" ? { ...d, logs: [...d.logs, entry] } : d,
    );
    // Post-render scroll or badge
    queueMicrotask(() => {
      if (!this.logListEl) return;
      const atBottom =
        this.logListEl.scrollHeight -
          (this.logListEl.scrollTop + this.logListEl.clientHeight) <
        40;
      if (atBottom) {
        this.logListEl.scrollTop = this.logListEl.scrollHeight;
      } else {
        this.unseenLive++;
      }
    });
  }

  private synthesizeSeed(): LogEntry[] {
    const now = Date.now();
    return Array.from({ length: 6 }, (_, i) => {
      this.liveCounter++;
      return {
        ...this.synthesizeEntry(),
        id: `live-seed-${this.liveCounter}`,
        timestamp: new Date(now - (6 - i) * 1000).toISOString(),
      };
    });
  }

  private synthesizeEntry(): LogEntry {
    const services = [
      "api-gateway",
      "auth",
      "cache",
      "db",
      "worker",
      "scheduler",
    ];
    const templates: Array<{ level: LogLevel; message: string; tags?: string[] }> = [
      { level: "info", message: "Request served", tags: ["http"] },
      { level: "info", message: "Cache warmed", tags: ["cache"] },
      { level: "info", message: "Job queued" },
      { level: "info", message: "Handshake complete", tags: ["network"] },
      { level: "warn", message: "Slow query detected", tags: ["perf"] },
      { level: "warn", message: "Retry backoff increased", tags: ["retry"] },
      { level: "warn", message: "Rate limit nearing threshold" },
      { level: "error", message: "Connection refused", tags: ["network"] },
      { level: "error", message: "Upstream timeout", tags: ["timeout"] },
    ];
    // Weighted: 65% info, 25% warn, 10% error
    const r = Math.random();
    const pool = templates.filter((t) =>
      r < 0.65 ? t.level === "info" : r < 0.9 ? t.level === "warn" : t.level === "error",
    );
    const template = pool[Math.floor(Math.random() * pool.length)] ??
      templates[0]!;
    const service = services[Math.floor(Math.random() * services.length)]!;
    this.liveCounter++;
    return {
      id: `live-${this.liveCounter}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: template.level,
      service,
      message: template.message,
      tags: template.tags,
      context: {
        latencyMs: Math.round(10 + Math.random() * 500),
        host: `node-${Math.floor(1 + Math.random() * 9)}`,
      },
    };
  }

  get isLiveBtnClass() {
    return this.isLive ? "primary live-on" : "primary";
  }

  get liveBtnLabel() {
    return this.isLive ? "⏸ Stop Live" : "▶ Start Live";
  }

  get hasUnseenLive() {
    return this.unseenLive > 0;
  }

  get unseenLabel() {
    return `${this.unseenLive} new · jump to bottom`;
  }

  exportJson = () => {
    const blob = new Blob([JSON.stringify(this.filteredLogs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "filtered-logs.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="container">
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
            <label>Sample logs</label>
            <select {{on "change" this.onDatasetChange}}>
              {{#each this.datasets as |ds|}}
                <option value={{ds.name}} selected={{eq ds.name this.activeDatasetName}}>{{ds.name}}</option>
              {{/each}}
            </select>

            <label>Or load a file (JSON / JSONL)</label>
            <input type="file" accept="application/json,.json,.jsonl,.log,.txt" {{on "change" this.onFileUpload}} />
          </div>

          <div class="panel">
            <h2>Distribution</h2>
            <div class="donut-wrap">
              <svg class="donut" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10" />
                {{#each this.levelDistribution.segments as |seg|}}
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke={{seg.color}}
                    stroke-width="10"
                    stroke-dasharray={{seg.dashArray}}
                    stroke-dashoffset={{seg.dashOffset}}
                    transform="rotate(-90 40 40)"
                  ></circle>
                {{/each}}
                <text x="40" y="44" text-anchor="middle" font-size="14" fill="#e7ecf3" font-weight="700">{{this.levelDistribution.total}}</text>
              </svg>
              <ul class="donut-legend">
                <li><span class="dot info"></span>Info<span class="n">{{this.levelDistribution.info}}</span></li>
                <li><span class="dot warn"></span>Warn<span class="n">{{this.levelDistribution.warn}}</span></li>
                <li><span class="dot error"></span>Error<span class="n">{{this.levelDistribution.error}}</span></li>
              </ul>
            </div>
          </div>

          <div class="panel">
            <h2>Filters</h2>
            <label>Level</label>
            <select {{on "change" this.onLevelChange}}>
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>

            <label>Service</label>
            <select {{on "change" this.onServiceChange}}>
              <option value="all">All</option>
              {{#each this.services as |svc|}}
                <option value={{svc}}>{{svc}}</option>
              {{/each}}
            </select>

            <label>Search</label>
            <input
              type="text"
              placeholder="message, tag, or context"
              value={{this.searchQuery}}
              {{on "input" this.onSearchInput}}
            />

            <div class="button-row">
              <button class="secondary" type="button" {{on "click" this.clearFilters}}>Clear</button>
              <button class="primary" type="button" {{on "click" this.exportJson}}>Export JSON</button>
            </div>
            <div class="button-row">
              <button class={{this.isLiveBtnClass}} type="button" {{on "click" this.toggleLive}}>{{this.liveBtnLabel}}</button>
            </div>
          </div>
        </aside>

        <section class="stream">
          <TimelineHeatmap
            @logs={{this.preTimeFilteredLogs}}
            @selectedRange={{this.timeRange}}
            @onRangeSelect={{this.setTimeRange}}
          />
          <div class="stream-header">
            <h2>Log Stream {{#if this.isLive}}<span class="live-pill">● LIVE</span>{{/if}}</h2>
            <span class="stats">{{this.statsText}}</span>
          </div>
          <ul class="log-list" {{this.setupLogList}}>
            {{#each this.filteredLogs as |log|}}
              <LogItem
                @log={{log}}
                @isSelected={{eq log.id this.selectedId}}
                @onSelect={{this.selectLog}}
              />
            {{/each}}
          </ul>
          {{#if this.hasUnseenLive}}
            <button class="unseen-badge" type="button" {{on "click" this.scrollToBottom}}>
              ⬇ {{this.unseenLabel}}
            </button>
          {{/if}}
        </section>

        <aside class="detail">
          <div class="detail-header">
            <h2>Detail</h2>
            <span class="detail-meta">{{this.detailMeta}}</span>
          </div>
          <h3>{{this.detailTitle}}</h3>
          {{#if this.selectedLog}}
            <p class="detail-message">{{this.detailMessage}}</p>
            <pre class="detail-context">{{this.detailContext}}</pre>
          {{/if}}
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
