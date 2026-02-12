import type { LogEntry, LogLevel } from "ship-diagnostics/ship-diagnostics/data/sample-logs";

type RawLog = Record<string, unknown>;
type LogContext = Record<string, unknown>;

const toString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return undefined;
};

const normalizeLevel = (value: unknown): LogLevel => {
  const level = String(value ?? "").toLowerCase();
  if (level === "warn" || level === "error" || level === "info") return level;
  if (level === "warning") return "warn";
  return "info";
};

const normalizeEntry = (raw: RawLog, index: number): LogEntry => {
  const timestamp =
    toString(raw.timestamp ?? raw.time ?? raw.ts) ?? new Date().toISOString();
  const service = toString(raw.service ?? raw.source ?? raw.app) ?? "unknown";
  const message =
    toString(raw.message ?? raw.msg ?? raw.event) ?? "Log entry";
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag))
    : Array.isArray(raw.labels)
      ? raw.labels.map((tag) => String(tag))
      : undefined;
  const context: LogContext =
    typeof raw.context === "object" && raw.context !== null
      ? (raw.context as LogContext)
      : raw;

  return {
    id: `${timestamp}-${index}`,
    timestamp,
    level: normalizeLevel(raw.level ?? raw.severity),
    service,
    message,
    tags,
    context,
  };
};

export function parseLogText(text: string): LogEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as RawLog[];
    return parsed.map(normalizeEntry);
  }

  return trimmed
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => normalizeEntry(JSON.parse(line), index));
}

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
