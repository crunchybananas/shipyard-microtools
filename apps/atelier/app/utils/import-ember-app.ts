/**
 * Import Ember App
 *
 * Parses an Ember project's file structure and extracts metadata
 * that can be used to generate design elements or upgrade the app.
 *
 * This is the foundation for:
 * 1. Importing existing Ember apps into Atelier for visual editing
 * 2. Detecting app version and suggesting upgrade paths
 * 3. Analyzing component structure for design token extraction
 */

// ============================================================
// Types
// ============================================================

export interface EmberAppInfo {
  name: string;
  version: string; // Ember version detected
  isOctane: boolean;
  isEmbroider: boolean;
  usesVite: boolean;
  usesTailwind: boolean;
  locationType: "hash" | "history" | "auto" | "none" | "unknown";
  routes: ImportedRoute[];
  components: ImportedComponent[];
  services: string[];
  helpers: string[];
  modifiers: string[];
  issues: UpgradeIssue[];
}

export interface ImportedRoute {
  name: string;
  path: string;
  hasTemplate: boolean;
  hasRoute: boolean;
  hasController: boolean; // Legacy pattern
  nested: ImportedRoute[];
}

export interface ImportedComponent {
  name: string;
  filePath: string;
  format: "gts" | "gjs" | "hbs+ts" | "hbs+js" | "hbs-only";
  isGlimmer: boolean; // Uses @glimmer/component vs @ember/component
  usesTracked: boolean;
  usesComputed: boolean; // Legacy pattern
  usesClassicActions: boolean; // Legacy pattern
  templateBindings: string[]; // {{this.foo}} references found
}

export interface UpgradeIssue {
  severity: "error" | "warning" | "info";
  category: "deprecation" | "addon" | "pattern" | "config";
  message: string;
  file?: string;
  fix?: string;
}

// ============================================================
// Parser
// ============================================================

/**
 * Analyze an Ember app from its file contents.
 * Accepts a Map of file paths to file contents (as from a zip upload or directory read).
 */
export function analyzeEmberApp(
  files: Record<string, string>,
): EmberAppInfo {
  const info: EmberAppInfo = {
    name: "unknown",
    version: "unknown",
    isOctane: false,
    isEmbroider: false,
    usesVite: false,
    usesTailwind: false,
    locationType: "unknown",
    routes: [],
    components: [],
    services: [],
    helpers: [],
    modifiers: [],
    issues: [],
  };

  // Parse package.json
  const pkgJson = files["package.json"];
  if (pkgJson) {
    parsePackageJson(pkgJson, info);
  }

  // Parse environment config
  const envConfig =
    files["config/environment.js"] ?? files["config/environment.ts"];
  if (envConfig) {
    parseEnvironmentConfig(envConfig, info);
  }

  // Parse router
  const router =
    files["app/router.js"] ?? files["app/router.ts"];
  if (router) {
    parseRouter(router, info);
  }

  // Detect build system
  if (files["vite.config.mjs"] ?? files["vite.config.js"] ?? files["vite.config.ts"]) {
    info.usesVite = true;
  }

  // Scan components
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith("app/components/") || path.startsWith("addon/components/")) {
      analyzeComponent(path, content, info);
    }
    if (path.startsWith("app/services/")) {
      const name = extractModuleName(path);
      if (name) info.services.push(name);
    }
    if (path.startsWith("app/helpers/")) {
      const name = extractModuleName(path);
      if (name) info.helpers.push(name);
    }
    if (path.startsWith("app/modifiers/")) {
      const name = extractModuleName(path);
      if (name) info.modifiers.push(name);
    }
  }

  // Detect Tailwind
  for (const path of Object.keys(files)) {
    if (path.includes("tailwind.config") || path.includes("tailwindcss")) {
      info.usesTailwind = true;
      break;
    }
  }
  for (const content of Object.values(files)) {
    if (content.includes("tailwindcss") || content.includes("@tailwind")) {
      info.usesTailwind = true;
      break;
    }
  }

  // Run upgrade checks
  detectUpgradeIssues(files, info);

  return info;
}

// ============================================================
// Parsers
// ============================================================

function parsePackageJson(content: string, info: EmberAppInfo): void {
  try {
    const pkg = JSON.parse(content);
    info.name = pkg.name ?? "unknown";

    // Detect Ember version
    const emberVersion =
      pkg.dependencies?.["ember-source"] ??
      pkg.devDependencies?.["ember-source"] ?? "";
    info.version = emberVersion.replace(/[^0-9.]/g, "").split(".").slice(0, 2).join(".") || "unknown";

    const majorVersion = parseInt(info.version);
    info.isOctane = majorVersion >= 4 || (pkg.ember?.edition === "octane");

    // Detect Embroider
    info.isEmbroider = !!(
      pkg.devDependencies?.["@embroider/core"] ??
      pkg.devDependencies?.["@embroider/vite"] ??
      pkg.dependencies?.["@embroider/core"]
    );
  } catch {
    info.issues.push({
      severity: "error",
      category: "config",
      message: "Failed to parse package.json",
      file: "package.json",
    });
  }
}

function parseEnvironmentConfig(content: string, info: EmberAppInfo): void {
  if (content.includes('"hash"') || content.includes("'hash'")) {
    info.locationType = "hash";
  } else if (content.includes('"history"') || content.includes("'history'")) {
    info.locationType = "history";
  } else if (content.includes('"auto"') || content.includes("'auto'")) {
    info.locationType = "auto";
  } else if (content.includes('"none"') || content.includes("'none'")) {
    info.locationType = "none";
  }
}

function parseRouter(content: string, info: EmberAppInfo): void {
  // Match this.route('name') or this.route('name', { path: '...' })
  const routePattern = /this\.route\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = routePattern.exec(content)) !== null) {
    info.routes.push({
      name: match[1]!,
      path: `/${match[1]!}`,
      hasTemplate: false,
      hasRoute: false,
      hasController: false,
      nested: [],
    });
  }

  // Check for route files
  for (const route of info.routes) {
    // Will be filled in by the file scanner
    route.hasTemplate = false;
    route.hasRoute = false;
    route.hasController = false;
  }
}

function analyzeComponent(
  path: string,
  content: string,
  info: EmberAppInfo,
): void {
  const name = extractComponentName(path);
  if (!name) return;

  let format: ImportedComponent["format"] = "hbs-only";
  if (path.endsWith(".gts")) format = "gts";
  else if (path.endsWith(".gjs")) format = "gjs";
  else if (path.endsWith(".ts")) format = "hbs+ts";
  else if (path.endsWith(".js")) format = "hbs+js";

  const isGlimmer = content.includes("@glimmer/component") || content.includes("<template>");
  const usesTracked = content.includes("@tracked");
  const usesComputed = content.includes("computed(") || content.includes("@computed");
  const usesClassicActions = content.includes("actions:") || content.includes("sendAction");

  // Extract template bindings
  const bindings: string[] = [];
  const bindingPattern = /\{\{this\.(\w+)\}\}/g;
  let bindMatch;
  while ((bindMatch = bindingPattern.exec(content)) !== null) {
    bindings.push(bindMatch[1]!);
  }

  info.components.push({
    name,
    filePath: path,
    format,
    isGlimmer,
    usesTracked,
    usesComputed,
    usesClassicActions,
    templateBindings: bindings,
  });
}

// ============================================================
// Upgrade Detection
// ============================================================

function detectUpgradeIssues(
  files: Record<string, string>,
  info: EmberAppInfo,
): void {
  const pkg = files["package.json"];
  let pkgObj: Record<string, unknown> = {};
  try { if (pkg) pkgObj = JSON.parse(pkg); } catch { /* skip */ }
  const allDeps = {
    ...(pkgObj.dependencies as Record<string, string> ?? {}),
    ...(pkgObj.devDependencies as Record<string, string> ?? {}),
  };

  // Check for v1 addons (major upgrade blocker)
  const knownV1Addons = [
    "ember-cli-sass", "ember-cli-less", "ember-cli-compass-compiler",
    "ember-component-css", "ember-cli-coffeescript",
    "ember-computed-decorators", "ember-decorators",
  ];
  for (const addon of knownV1Addons) {
    if (allDeps[addon]) {
      info.issues.push({
        severity: "error",
        category: "addon",
        message: `v1 addon "${addon}" is not compatible with Embroider/Vite. Must be removed or replaced.`,
        fix: `Remove ${addon} and migrate to native alternatives`,
      });
    }
  }

  // Check for classic patterns
  for (const comp of info.components) {
    if (comp.usesComputed) {
      info.issues.push({
        severity: "warning",
        category: "pattern",
        message: `${comp.name} uses computed properties — migrate to @tracked`,
        file: comp.filePath,
        fix: "Replace computed() with @tracked properties and getters",
      });
    }
    if (comp.usesClassicActions) {
      info.issues.push({
        severity: "warning",
        category: "pattern",
        message: `${comp.name} uses classic actions — migrate to @action`,
        file: comp.filePath,
        fix: "Replace actions hash with @action decorator methods",
      });
    }
    if (!comp.isGlimmer && comp.format !== "gts" && comp.format !== "gjs") {
      info.issues.push({
        severity: "info",
        category: "pattern",
        message: `${comp.name} uses classic component — consider migrating to Glimmer`,
        file: comp.filePath,
        fix: "Extend from @glimmer/component instead of @ember/component",
      });
    }
    if (comp.format === "hbs+js" || comp.format === "hbs+ts") {
      info.issues.push({
        severity: "info",
        category: "pattern",
        message: `${comp.name} uses separate .hbs template — consider migrating to .gts`,
        file: comp.filePath,
        fix: "Combine template and class into a single .gts file with <template> tag",
      });
    }
  }

  // Check if not using Embroider
  if (!info.isEmbroider) {
    info.issues.push({
      severity: "warning",
      category: "config",
      message: "App is not using Embroider — required for Vite and modern Ember",
      fix: "Install @embroider/core, @embroider/compat, and @embroider/vite",
    });
  }

  // Check if not using Vite
  if (!info.usesVite) {
    info.issues.push({
      severity: "info",
      category: "config",
      message: "App is not using Vite — the recommended build tool for Ember 6+",
      fix: "Migrate from ember-cli to Vite with @embroider/vite",
    });
  }

  // Check for controllers (legacy pattern)
  for (const path of Object.keys(files)) {
    if (path.startsWith("app/controllers/")) {
      const name = extractModuleName(path);
      info.issues.push({
        severity: "info",
        category: "deprecation",
        message: `Controller "${name}" found — controllers are legacy, consider migrating state to services or components`,
        file: path,
      });
    }
  }

  // Check for mixins (deprecated)
  for (const path of Object.keys(files)) {
    if (path.startsWith("app/mixins/") || path.includes("/mixins/")) {
      info.issues.push({
        severity: "warning",
        category: "deprecation",
        message: `Mixin found at ${path} — mixins are deprecated, use composition`,
        file: path,
        fix: "Extract mixin behavior into a service, utility function, or decorator",
      });
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function extractModuleName(path: string): string | null {
  const parts = path.split("/");
  const filename = parts[parts.length - 1];
  if (!filename) return null;
  return filename.replace(/\.(ts|js|gts|gjs|hbs)$/, "");
}

function extractComponentName(path: string): string | null {
  // app/components/my-component.gts → my-component
  // app/components/my-component/index.gts → my-component
  const match = path.match(/components\/(.+?)(?:\/index)?\.(gts|gjs|ts|js|hbs)$/);
  if (!match) return null;
  return match[1]!.replace(/\//g, "/");
}
