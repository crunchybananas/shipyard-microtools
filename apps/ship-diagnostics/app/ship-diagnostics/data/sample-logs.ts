export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  tags?: string[];
  context?: Record<string, unknown>;
};

export const sampleSets: Record<string, LogEntry[]> = {
  "Dockhand Boot": [
    {
      id: "boot-001",
      timestamp: "2026-02-04T09:00:12.341Z",
      level: "info",
      service: "core",
      message: "Dockhand starting up",
      tags: ["startup"],
      context: { version: "0.14.0", target: "macOS 26" },
    },
    {
      id: "boot-002",
      timestamp: "2026-02-04T09:00:12.882Z",
      level: "info",
      service: "config",
      message: "Loaded user preferences",
      tags: ["settings"],
      context: { theme: "midnight", analytics: false },
    },
    {
      id: "boot-003",
      timestamp: "2026-02-04T09:00:13.104Z",
      level: "warn",
      service: "auth",
      message: "Keychain item missing, creating new token",
      tags: ["keychain"],
      context: { key: "shipyard.api.token" },
    },
    {
      id: "boot-004",
      timestamp: "2026-02-04T09:00:13.552Z",
      level: "info",
      service: "shipyard",
      message: "Handshake complete",
      tags: ["network"],
      context: { region: "SFO", latencyMs: 132 },
    },
    {
      id: "boot-005",
      timestamp: "2026-02-04T09:00:14.021Z",
      level: "error",
      service: "feed",
      message: "Feed sync failed: timeout",
      tags: ["network", "retry"],
      context: { attempt: 1, timeoutMs: 5000 },
    },
    {
      id: "boot-006",
      timestamp: "2026-02-04T09:00:15.210Z",
      level: "info",
      service: "feed",
      message: "Feed sync succeeded",
      tags: ["network"],
      context: { attempt: 2, items: 28 },
    },
  ],
  "API Incident": [
    {
      id: "api-101",
      timestamp: "2026-02-03T22:14:08.012Z",
      level: "warn",
      service: "api-gateway",
      message: "Rate limit threshold reached",
      tags: ["rate-limit"],
      context: { limit: 120, windowSec: 60, tenant: "atlas" },
    },
    {
      id: "api-102",
      timestamp: "2026-02-03T22:14:10.881Z",
      level: "error",
      service: "auth",
      message: "Token refresh failed",
      tags: ["auth"],
      context: { error: "invalid_grant", retries: 2 },
    },
    {
      id: "api-103",
      timestamp: "2026-02-03T22:14:13.244Z",
      level: "error",
      service: "api-gateway",
      message: "Upstream returned 503",
      tags: ["upstream", "incident"],
      context: { upstream: "shipyard", traceId: "f7a9" },
    },
    {
      id: "api-104",
      timestamp: "2026-02-03T22:14:19.501Z",
      level: "warn",
      service: "queue",
      message: "Backpressure enabled",
      tags: ["queue"],
      context: { depth: 812, threshold: 600 },
    },
    {
      id: "api-105",
      timestamp: "2026-02-03T22:14:24.032Z",
      level: "info",
      service: "api-gateway",
      message: "Traffic normalized",
      tags: ["recovery"],
      context: { windowSec: 60 },
    },
  ],
};
