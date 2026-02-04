import type { LogEntry, LogLevel } from "ship-diagnostics/ship-diagnostics/data/sample-logs";
import { sampleSets } from "ship-diagnostics/ship-diagnostics/data/sample-logs";

type LogContext = Record<string, unknown>;

type RawLog = Record<string, unknown>;

const defaultDatasetName = Object.keys(sampleSets)[0] ?? "Sample";

const normalizeLevel = (value: unknown): LogLevel => {
  const level = String(value ?? "").toLowerCase();
  if (level === "warn" || level === "error" || level === "info") {
    return level;
  }
  if (level === "warning") {
    return "warn";
  }
  return "info";
};

const toString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return undefined;
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

const parseLogText = (text: string): LogEntry[] => {
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
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export function initializeShipDiagnostics(_element: HTMLElement) {
  const datasetSelect = document.getElementById(
    "datasetSelect",
  ) as HTMLSelectElement | null;
  const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;
  const levelSelect = document.getElementById(
    "levelSelect",
  ) as HTMLSelectElement | null;
  const serviceSelect = document.getElementById(
    "serviceSelect",
  ) as HTMLSelectElement | null;
  const searchInput = document.getElementById(
    "searchInput",
  ) as HTMLInputElement | null;
  const logList = document.getElementById("logList") as HTMLUListElement | null;
  const logStats = document.getElementById("logStats") as HTMLSpanElement | null;
  const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement | null;
  const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement | null;
  const detailMeta = document.getElementById("detailMeta") as HTMLSpanElement | null;
  const detailTitle = document.getElementById("detailTitle") as HTMLHeadingElement | null;
  const detailMessage = document.getElementById(
    "detailMessage",
  ) as HTMLParagraphElement | null;
  const detailContext = document.getElementById(
    "detailContext",
  ) as HTMLPreElement | null;

  if (
    !datasetSelect ||
    !fileInput ||
    !levelSelect ||
    !serviceSelect ||
    !searchInput ||
    !logList ||
    !logStats ||
    !clearBtn ||
    !exportBtn ||
    !detailMeta ||
    !detailTitle ||
    !detailMessage ||
    !detailContext
  ) {
    return;
  }

  const datasets = new Map<string, LogEntry[]>();
  Object.entries(sampleSets).forEach(([name, logs]) => datasets.set(name, logs));

  let activeDataset = defaultDatasetName;
  let activeLogs = datasets.get(activeDataset) ?? [];
  let filteredLogs: LogEntry[] = [];
  let selectedId: string | null = null;

  const renderDatasetOptions = () => {
    datasetSelect.innerHTML = "";
    datasets.forEach((_logs, name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (name === activeDataset) option.selected = true;
      datasetSelect.appendChild(option);
    });
  };

  const renderServiceOptions = (logs: LogEntry[]) => {
    const services = Array.from(new Set(logs.map((log) => log.service))).sort();
    serviceSelect.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    serviceSelect.appendChild(allOption);

    services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service;
      option.textContent = service;
      serviceSelect.appendChild(option);
    });
  };

  const renderDetail = (log: LogEntry | null) => {
    if (!log) {
      detailMeta.textContent = "";
      detailTitle.textContent = "Select a log entry";
      detailMessage.textContent = "";
      detailContext.textContent = "";
      return;
    }

    detailMeta.textContent = `${formatTimestamp(log.timestamp)} · ${log.service}`;
    detailTitle.textContent = log.level.toUpperCase();
    detailMessage.textContent = log.message;
    detailContext.textContent = JSON.stringify(log.context ?? {}, null, 2);
  };

  const renderList = () => {
    logList.innerHTML = "";

    filteredLogs.forEach((log) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `log-item level-${log.level}`;
      button.dataset.id = log.id;
      button.setAttribute("aria-selected", log.id === selectedId ? "true" : "false");

      const meta = document.createElement("div");
      meta.className = "log-meta";

      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = formatTime(log.timestamp);

      const level = document.createElement("span");
      level.className = `log-level ${log.level}`;
      level.textContent = log.level.toUpperCase();

      const service = document.createElement("span");
      service.className = "log-service";
      service.textContent = log.service;

      meta.append(time, level, service);

      const message = document.createElement("div");
      message.className = "log-message";
      message.textContent = log.message;

      button.append(meta, message);
      button.addEventListener("click", () => {
        selectedId = log.id;
        renderList();
        renderDetail(log);
      });

      item.appendChild(button);
      logList.appendChild(item);
    });
  };

  const updateStats = () => {
    logStats.textContent = `${filteredLogs.length.toLocaleString()} / ${activeLogs.length.toLocaleString()} logs`;
  };

  const applyFilters = () => {
    const levelFilter = levelSelect.value;
    const serviceFilter = serviceSelect.value;
    const search = searchInput.value.trim().toLowerCase();

    filteredLogs = activeLogs.filter((log) => {
      const matchesLevel = levelFilter === "all" || log.level === levelFilter;
      const matchesService = serviceFilter === "all" || log.service === serviceFilter;
      const haystack = [
        log.message,
        log.service,
        ...(log.tags ?? []),
        JSON.stringify(log.context ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      return matchesLevel && matchesService && matchesSearch;
    });

    if (selectedId && !filteredLogs.find((log) => log.id === selectedId)) {
      selectedId = filteredLogs[0]?.id ?? null;
    }

    renderList();
    renderDetail(filteredLogs.find((log) => log.id === selectedId) ?? null);
    updateStats();
  };

  const setDataset = (name: string) => {
    activeDataset = name;
    activeLogs = datasets.get(name) ?? [];
    renderServiceOptions(activeLogs);
    selectedId = activeLogs[0]?.id ?? null;
    levelSelect.value = "all";
    serviceSelect.value = "all";
    searchInput.value = "";
    applyFilters();
  };

  const addUploadedDataset = (name: string, logs: LogEntry[]) => {
    datasets.set(name, logs);
    setDataset(name);
    renderDatasetOptions();
  };

  datasetSelect.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    setDataset(value);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const logs = parseLogText(text);
        if (logs.length === 0) {
          return;
        }
        addUploadedDataset(`Uploaded: ${file.name}`, logs);
      } catch {
        return;
      }
    };
    reader.readAsText(file);
  });

  [levelSelect, serviceSelect].forEach((select) => {
    select.addEventListener("change", applyFilters);
  });

  searchInput.addEventListener("input", applyFilters);

  clearBtn.addEventListener("click", () => {
    levelSelect.value = "all";
    serviceSelect.value = "all";
    searchInput.value = "";
    applyFilters();
  });

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "filtered-logs.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  renderDatasetOptions();
  setDataset(activeDataset);
}
