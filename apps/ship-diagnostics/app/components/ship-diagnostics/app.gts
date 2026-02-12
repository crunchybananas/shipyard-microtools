import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import type { LogEntry } from "ship-diagnostics/ship-diagnostics/data/sample-logs";
import { sampleSets } from "ship-diagnostics/ship-diagnostics/data/sample-logs";
import { parseLogText, formatTimestamp } from "ship-diagnostics/ship-diagnostics/log-utils";
import LogItem from "./log-item";

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

  // ── Computed (auto-tracked) ──────────────────────────────────

  get activeLogs(): LogEntry[] {
    return this.datasets.find((d) => d.name === this.activeDatasetName)?.logs ?? [];
  }

  get services(): string[] {
    return Array.from(new Set(this.activeLogs.map((l) => l.service))).sort();
  }

  get filteredLogs(): LogEntry[] {
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

  get statsText(): string {
    return `${this.filteredLogs.length.toLocaleString()} / ${this.activeLogs.length.toLocaleString()} logs`;
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
  };

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
          </div>
        </aside>

        <section class="stream">
          <div class="stream-header">
            <h2>Log Stream</h2>
            <span class="stats">{{this.statsText}}</span>
          </div>
          <ul class="log-list">
            {{#each this.filteredLogs as |log|}}
              <LogItem
                @log={{log}}
                @isSelected={{eq log.id this.selectedId}}
                @onSelect={{this.selectLog}}
              />
            {{/each}}
          </ul>
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
