// Harbor API — Core types for the API client

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestTab {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  bodyType: "none" | "json" | "text" | "form";
  body: string;
  authType: "none" | "bearer" | "basic";
  authToken: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyType: "json" | "xml" | "html" | "text";
  size: number;
  duration: number;
  timestamp: number;
}

export interface HistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  timestamp: number;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

export const HTTP_METHODS: HttpMethod[] = [
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
];

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#a855f7",
  DELETE: "#ef4444",
  HEAD: "#6b7280",
  OPTIONS: "#06b6d4",
};

export function createKeyValuePair(key = "", value = ""): KeyValuePair {
  return {
    id: `kv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    key,
    value,
    enabled: true,
  };
}

export function createRequestTab(name = "Untitled"): RequestTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/users/1",
    headers: [createKeyValuePair("Content-Type", "application/json")],
    params: [],
    bodyType: "none",
    body: "",
    authType: "none",
    authToken: "",
  };
}

export function createEnvironment(name = "Default"): Environment {
  return {
    id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    variables: [
      createKeyValuePair("BASE_URL", "https://jsonplaceholder.typicode.com"),
    ],
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function detectBodyType(
  contentType: string,
  body: string,
): "json" | "xml" | "html" | "text" {
  if (contentType.includes("json")) return "json";
  if (contentType.includes("xml")) return "xml";
  if (contentType.includes("html")) return "html";
  // Fallback: try to parse as JSON
  try {
    JSON.parse(body);
    return "json";
  } catch {
    return "text";
  }
}
