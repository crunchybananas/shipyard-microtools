// Harbor API — HTTP Client Service
// Handles request execution, history, and environment variable interpolation

import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

import type {
  RequestTab,
  ResponseData,
  HistoryEntry,
  Environment,
  KeyValuePair,
} from "harbor-api/types/api";
import {
  createEnvironment,
  detectBodyType,
} from "harbor-api/types/api";

export default class HttpClientService extends Service {
  @tracked history: HistoryEntry[] = [];
  @tracked environments: Environment[] = [createEnvironment()];
  @tracked activeEnvironmentId: string = this.environments[0]?.id ?? "";
  @tracked isLoading = false;
  @tracked responseTimes: number[] = [];

  storageKeyHistory = "harbor-api-history";
  storageKeyEnvs = "harbor-api-environments";

  constructor(properties?: object) {
    super(properties);
    this.loadFromStorage();
  }

  get activeEnvironment(): Environment | undefined {
    return this.environments.find((e) => e.id === this.activeEnvironmentId);
  }

  /**
   * Interpolate {{VARIABLE}} references with active environment values
   */
  interpolate(text: string): string {
    const env = this.activeEnvironment;
    if (!env) return text;

    return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const variable = env.variables.find(
        (v) => v.key === key && v.enabled,
      );
      return variable?.value ?? `{{${key}}}`;
    });
  }

  /**
   * Execute an HTTP request from a tab
   */
  sendRequest = async (tab: RequestTab): Promise<ResponseData> => {
    this.isLoading = true;

    const url = this.buildUrl(tab);
    const headers = this.buildHeaders(tab);
    const body = this.buildBody(tab);

    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        method: tab.method,
        headers,
        body: ["GET", "HEAD", "OPTIONS"].includes(tab.method) ? undefined : body,
      });

      const duration = performance.now() - startTime;
      const responseBody = await response.text();

      const contentType =
        response.headers.get("content-type") ?? "text/plain";

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const result: ResponseData = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        bodyType: detectBodyType(contentType, responseBody),
        size: new Blob([responseBody]).size,
        duration,
        timestamp: Date.now(),
      };

      // Track response time
      this.responseTimes = [...this.responseTimes.slice(-29), duration];

      // Add to history
      const entry: HistoryEntry = {
        id: `hist-${Date.now()}`,
        method: tab.method,
        url: this.interpolate(tab.url),
        status: response.status,
        duration,
        timestamp: Date.now(),
      };
      this.history = [entry, ...this.history.slice(0, 49)];
      this.saveToStorage();

      this.isLoading = false;
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.isLoading = false;

      this.responseTimes = [...this.responseTimes.slice(-29), duration];

      const result: ResponseData = {
        status: 0,
        statusText: (error as Error).message,
        headers: {},
        body: `Error: ${(error as Error).message}\n\nThis could be a CORS issue, network error, or invalid URL.`,
        bodyType: "text",
        size: 0,
        duration,
        timestamp: Date.now(),
      };

      return result;
    }
  };

  private buildUrl(tab: RequestTab): string {
    let url = this.interpolate(tab.url);

    const enabledParams = tab.params.filter(
      (p) => p.enabled && p.key.trim(),
    );
    if (enabledParams.length > 0) {
      const params = new URLSearchParams();
      for (const param of enabledParams) {
        params.set(
          this.interpolate(param.key),
          this.interpolate(param.value),
        );
      }
      const separator = url.includes("?") ? "&" : "?";
      url += separator + params.toString();
    }

    return url;
  }

  private buildHeaders(tab: RequestTab): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const h of tab.headers) {
      if (h.enabled && h.key.trim()) {
        headers[this.interpolate(h.key)] = this.interpolate(h.value);
      }
    }

    // Auth headers
    if (tab.authType === "bearer" && tab.authToken) {
      headers["Authorization"] = `Bearer ${this.interpolate(tab.authToken)}`;
    } else if (tab.authType === "basic" && tab.authToken) {
      headers["Authorization"] = `Basic ${btoa(this.interpolate(tab.authToken))}`;
    }

    return headers;
  }

  private buildBody(tab: RequestTab): string | undefined {
    if (tab.bodyType === "none") return undefined;
    return this.interpolate(tab.body);
  }

  // Environment management
  addEnvironment = (name: string): void => {
    const env = createEnvironment(name);
    this.environments = [...this.environments, env];
    this.saveToStorage();
  };

  setActiveEnvironment = (envId: string): void => {
    this.activeEnvironmentId = envId;
  };

  updateEnvironmentVariable = (
    envId: string,
    varId: string,
    field: "key" | "value",
    newValue: string,
  ): void => {
    this.environments = this.environments.map((env) => {
      if (env.id !== envId) return env;
      return {
        ...env,
        variables: env.variables.map((v) =>
          v.id === varId ? { ...v, [field]: newValue } : v,
        ),
      };
    });
    this.saveToStorage();
  };

  addEnvironmentVariable = (envId: string): void => {
    this.environments = this.environments.map((env) => {
      if (env.id !== envId) return env;
      const newVar: KeyValuePair = {
        id: `kv-${Date.now()}`,
        key: "",
        value: "",
        enabled: true,
      };
      return { ...env, variables: [...env.variables, newVar] };
    });
    this.saveToStorage();
  };

  clearHistory = (): void => {
    this.history = [];
    this.responseTimes = [];
    this.saveToStorage();
  };

  // Storage
  private saveToStorage(): void {
    try {
      localStorage.setItem(
        this.storageKeyHistory,
        JSON.stringify(this.history),
      );
      localStorage.setItem(
        this.storageKeyEnvs,
        JSON.stringify(this.environments),
      );
    } catch {
      // Ignore storage errors
    }
  }

  private loadFromStorage(): void {
    try {
      const historyRaw = localStorage.getItem(this.storageKeyHistory);
      if (historyRaw) {
        this.history = JSON.parse(historyRaw) as HistoryEntry[];
      }
      const envsRaw = localStorage.getItem(this.storageKeyEnvs);
      if (envsRaw) {
        this.environments = JSON.parse(envsRaw) as Environment[];
        if (this.environments.length > 0) {
          this.activeEnvironmentId = this.environments[0]?.id ?? "";
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
}

declare module "@ember/service" {
  interface Registry {
    "http-client": HttpClientService;
  }
}
