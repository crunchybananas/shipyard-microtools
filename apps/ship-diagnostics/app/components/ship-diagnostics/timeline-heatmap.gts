import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import type {
  LogEntry,
  LogLevel,
} from "ship-diagnostics/ship-diagnostics/data/sample-logs";

const BUCKET_COUNT = 48;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  info: 1,
  warn: 2,
  error: 3,
};

interface Bucket {
  start: number;
  end: number;
  info: number;
  warn: number;
  error: number;
  total: number;
  maxLevel: LogLevel | null;
}

interface RenderBucket extends Bucket {
  cls: string;
  style: string;
  title: string;
}

interface ServiceRow {
  service: string;
  buckets: RenderBucket[];
  total: number;
}

interface TimelineHeatmapSignature {
  Args: {
    logs: LogEntry[];
    selectedRange: [number, number] | null;
    onRangeSelect: (range: [number, number] | null) => void;
  };
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export default class TimelineHeatmap extends Component<TimelineHeatmapSignature> {
  get minTime(): number {
    const logs = this.args.logs;
    if (logs.length === 0) return 0;
    return Math.min(...logs.map((l) => Date.parse(l.timestamp)));
  }

  get maxTime(): number {
    const logs = this.args.logs;
    if (logs.length === 0) return 0;
    return Math.max(...logs.map((l) => Date.parse(l.timestamp)));
  }

  get span(): number {
    return Math.max(1, this.maxTime - this.minTime);
  }

  get bucketSizeMs(): number {
    return Math.max(1, Math.ceil(this.span / BUCKET_COUNT));
  }

  get services(): string[] {
    return Array.from(new Set(this.args.logs.map((l) => l.service))).sort();
  }

  get rows(): ServiceRow[] {
    const { logs, selectedRange } = this.args;
    if (logs.length === 0) return [];
    const minT = this.minTime;
    const bucketSize = this.bucketSizeMs;
    const services = this.services;

    // Phase 1: allocate + count
    const raw: Array<{ service: string; buckets: Bucket[]; total: number }> =
      services.map((service) => ({
        service,
        total: 0,
        buckets: Array.from({ length: BUCKET_COUNT }, (_, i) => ({
          start: minT + i * bucketSize,
          end: minT + (i + 1) * bucketSize,
          info: 0,
          warn: 0,
          error: 0,
          total: 0,
          maxLevel: null,
        })),
      }));

    const rowIndex = new Map(services.map((s, i) => [s, i]));

    for (const log of logs) {
      const t = Date.parse(log.timestamp);
      const idx = Math.min(
        BUCKET_COUNT - 1,
        Math.floor((t - minT) / bucketSize),
      );
      const rowI = rowIndex.get(log.service);
      if (rowI === undefined) continue;
      const row = raw[rowI]!;
      const bucket = row.buckets[idx]!;
      bucket[log.level]++;
      bucket.total++;
      row.total++;
      if (
        !bucket.maxLevel ||
        LEVEL_WEIGHT[log.level] > LEVEL_WEIGHT[bucket.maxLevel]
      ) {
        bucket.maxLevel = log.level;
      }
    }

    // Find global max for intensity normalization
    let maxBucketTotal = 0;
    for (const row of raw) {
      for (const b of row.buckets) {
        if (b.total > maxBucketTotal) maxBucketTotal = b.total;
      }
    }

    // Phase 2: decorate with display data
    return raw.map((row) => ({
      ...row,
      buckets: row.buckets.map((b) => {
        const style = this.computeStyle(b, maxBucketTotal);
        const cls = this.computeCls(b, selectedRange);
        const title = this.computeTitle(b);
        return { ...b, style, cls, title };
      }),
    }));
  }

  private computeStyle(bucket: Bucket, maxBucketTotal: number): string {
    if (bucket.total === 0) {
      return "background: rgba(255, 255, 255, 0.03)";
    }
    const intensity = Math.min(
      1,
      0.3 + (0.7 * bucket.total) / Math.max(1, maxBucketTotal),
    );
    let rgb = "96, 165, 250";
    if (bucket.maxLevel === "warn") rgb = "251, 191, 36";
    if (bucket.maxLevel === "error") rgb = "248, 113, 113";
    return `background: rgba(${rgb}, ${intensity.toFixed(2)})`;
  }

  private computeCls(
    bucket: Bucket,
    selectedRange: [number, number] | null,
  ): string {
    const parts = ["hm-cell"];
    parts.push(bucket.total === 0 ? "empty" : "filled");
    if (
      selectedRange &&
      bucket.start >= selectedRange[0] &&
      bucket.end <= selectedRange[1]
    ) {
      parts.push("selected");
    }
    return parts.join(" ");
  }

  private computeTitle(bucket: Bucket): string {
    if (bucket.total === 0) {
      return `${fmtTime(bucket.start)} — no events`;
    }
    const bits: string[] = [];
    if (bucket.error) bits.push(`${bucket.error} error`);
    if (bucket.warn) bits.push(`${bucket.warn} warn`);
    if (bucket.info) bits.push(`${bucket.info} info`);
    return `${fmtTime(bucket.start)} — ${bits.join(", ")}`;
  }

  get timeAxisTicks(): Array<{ label: string; leftPct: string }> {
    const ticks: Array<{ label: string; leftPct: string }> = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      const t = this.minTime + (this.span * i) / count;
      ticks.push({
        label: fmtTime(t),
        leftPct: `${(i * 100) / count}%`,
      });
    }
    return ticks;
  }

  get durationLabel(): string {
    return `${fmtDuration(this.span)} window · ${fmtDuration(
      this.bucketSizeMs,
    )}/bucket`;
  }

  get hasSelection(): boolean {
    return !!this.args.selectedRange;
  }

  get selectionLabel(): string {
    const r = this.args.selectedRange;
    if (!r) return "";
    return `${fmtTime(r[0])} → ${fmtTime(r[1])}`;
  }

  selectBucket = (bucket: RenderBucket) => {
    if (bucket.total === 0) return;
    this.args.onRangeSelect([bucket.start, bucket.end]);
  };

  clearSelection = () => {
    this.args.onRangeSelect(null);
  };

  <template>
    {{#if this.rows.length}}
      <section class="heatmap">
        <div class="hm-header">
          <h2>Timeline</h2>
          <span class="hm-meta">{{this.durationLabel}}</span>
          {{#if this.hasSelection}}
            <span class="hm-selection">{{this.selectionLabel}}</span>
            <button type="button" class="hm-clear" {{on "click" this.clearSelection}}>Clear</button>
          {{/if}}
        </div>
        <div class="hm-grid">
          {{#each this.rows as |row|}}
            <div class="hm-row">
              <div class="hm-row-label" title={{row.service}}>{{row.service}}</div>
              <div class="hm-row-cells">
                {{#each row.buckets as |bucket|}}
                  <button
                    type="button"
                    class={{bucket.cls}}
                    style={{bucket.style}}
                    title={{bucket.title}}
                    {{on "click" (fn this.selectBucket bucket)}}
                  ></button>
                {{/each}}
              </div>
            </div>
          {{/each}}
        </div>
        <div class="hm-axis">
          {{#each this.timeAxisTicks as |tick|}}
            <span class="hm-tick" style="left:{{tick.leftPct}}">{{tick.label}}</span>
          {{/each}}
        </div>
      </section>
    {{/if}}
  </template>
}
