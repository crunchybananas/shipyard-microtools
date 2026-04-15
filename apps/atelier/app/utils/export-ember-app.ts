/**
 * One-Click Ember App Export
 *
 * Takes a set of DesignElements from Atelier and generates a complete,
 * working Ember 6.10 + Vite project that can be downloaded as a ZIP.
 *
 * The generated project uses:
 * - Ember 6.10 (Octane) with Embroider + Vite
 * - .gts template-tag components (Glimmer)
 * - Tailwind CSS via CDN (no build-time Tailwind config needed)
 * - TypeScript
 * - Hash-based routing
 *
 * Route detection: top-level frames (parentId === null, type === "frame")
 * become routes. Their children become the route's component content.
 */

import type { DesignElement } from "atelier/services/design-store";
import type TokenRegistryService from "atelier/services/token-registry";
import { generateEmberComponent, generateEmberComponentTailwind } from "atelier/utils/export-ember-component";

// ============================================================
// Public API
// ============================================================

export interface EmberAppFiles {
  [path: string]: string;
}

export function generateEmberApp(
  elements: DesignElement[],
  projectName: string,
  tokenRegistry?: TokenRegistryService,
): EmberAppFiles {
  const files: EmberAppFiles = {};
  const kebabName = toKebabCase(projectName);
  const visible = elements.filter((el) => el.visible);

  // Detect routes from top-level frames
  const routes = detectRoutes(visible);

  // Generate project scaffolding
  files["package.json"] = genPackageJson(kebabName);
  files["vite.config.mjs"] = genViteConfig();
  files["babel.config.cjs"] = genBabelConfig();
  files["ember-cli-build.js"] = genEmberCliBuild();
  files["config/environment.js"] = genEnvironmentConfig(kebabName);
  files["app/config/environment.js"] = genAppEnvironment(kebabName);
  files["tsconfig.json"] = genTsConfig(kebabName);
  files[".ember-cli"] = genEmberCli();
  files["index.html"] = genIndexHtml(projectName, kebabName);
  files["app/styles/app.css"] = genAppCss();

  // Generate app boot files
  files["app/app.ts"] = genAppTs(kebabName);
  files["app/router.ts"] = genRouterTs(kebabName, routes);

  // Generate components and routes for each detected route
  for (const route of routes) {
    const componentFileName = route.kebabName;
    const componentClassName = route.pascalName;
    const routeElements = getRouteElements(visible, route);

    // Generate component using existing Tailwind exporter
    const componentCode = tokenRegistry
      ? generateEmberComponentTailwind(routeElements, componentClassName, tokenRegistry)
      : generateFallbackComponent(routeElements, componentClassName);

    files[`app/components/${componentFileName}.gts`] = componentCode;

    // Route template (.gts with <template> tag)
    files[`app/templates/${route.routeName}.gts`] = genRouteTemplate(
      kebabName,
      componentFileName,
      componentClassName,
    );

    // Route file with mock model hook
    files[`app/routes/${route.routeName}.ts`] = genRouteFile(route, routeElements);
  }

  // Application template with navigation
  files["app/templates/application.gts"] = genApplicationTemplate(routes);

  return files;
}

// ============================================================
// Route Detection
// ============================================================

interface DetectedRoute {
  routeName: string;  // e.g. "index", "dashboard"
  kebabName: string;  // e.g. "home-page", "dashboard"
  pascalName: string; // e.g. "HomePage", "Dashboard"
  frameId: string | null; // id of the top-level frame (null for synthetic index)
  frameName: string;  // original frame name
}

function detectRoutes(elements: DesignElement[]): DetectedRoute[] {
  // Find top-level frames (parentId === null, type === "frame")
  const topFrames = elements.filter(
    (el) => el.parentId === null && el.type === "frame",
  );

  if (topFrames.length === 0) {
    // No frames — create a single index route from all elements
    return [
      {
        routeName: "index",
        kebabName: "main-view",
        pascalName: "MainView",
        frameId: null,
        frameName: "Main",
      },
    ];
  }

  if (topFrames.length === 1) {
    const frame = topFrames[0]!;
    return [
      {
        routeName: "index",
        kebabName: toKebabCase(frame.name),
        pascalName: toPascalCase(frame.name),
        frameId: frame.id,
        frameName: frame.name,
      },
    ];
  }

  // Multiple frames — first becomes index, rest become named routes
  const routes: DetectedRoute[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < topFrames.length; i++) {
    const frame = topFrames[i]!;
    let routeName = i === 0 ? "index" : toKebabCase(frame.name);

    // Deduplicate route names
    if (routeName !== "index" && usedNames.has(routeName)) {
      routeName = `${routeName}-${i}`;
    }
    usedNames.add(routeName);

    routes.push({
      routeName,
      kebabName: toKebabCase(frame.name),
      pascalName: toPascalCase(frame.name),
      frameId: frame.id,
      frameName: frame.name,
    });
  }

  return routes;
}

/**
 * Get elements belonging to a route.
 * If frameId is set, returns the frame's children.
 * Otherwise returns all top-level non-frame elements.
 */
function getRouteElements(elements: DesignElement[], route: DetectedRoute): DesignElement[] {
  if (route.frameId) {
    const frame = elements.find((el) => el.id === route.frameId);
    if (!frame) return elements;

    // Return the frame + descendants (by parentId) + elements geometrically inside
    const descendants = getDescendants(elements, route.frameId);
    const descendantIds = new Set(descendants.map((el) => el.id));

    // Also include elements that are visually inside the frame bounds
    // (they may not have parentId set, especially from AI generation)
    for (const el of elements) {
      if (descendantIds.has(el.id)) continue;
      if (el.id === route.frameId) continue;
      if (
        el.x >= frame.x &&
        el.y >= frame.y &&
        el.x + el.width <= frame.x + frame.width &&
        el.y + el.height <= frame.y + frame.height
      ) {
        descendants.push(el);
      }
    }

    return descendants;
  }
  // No frame — return all elements
  return elements;
}

function getDescendants(elements: DesignElement[], rootId: string): DesignElement[] {
  const result: DesignElement[] = [];
  const root = elements.find((el) => el.id === rootId);
  if (root) result.push(root);

  // BFS to collect all descendants
  const queue = [rootId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const el of elements) {
      if (el.parentId === parentId) {
        result.push(el);
        queue.push(el.id);
      }
    }
  }

  return result;
}

// ============================================================
// Naming Utilities
// ============================================================

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "design";
}

function toPascalCase(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "Design";
  return cleaned
    .split(/[\s\-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

// ============================================================
// File Generators
// ============================================================

function genPackageJson(name: string): string {
  const pkg = {
    name,
    private: true,
    exports: {
      "./*": "./app/*",
      "./tests/*": "./tests/*",
    },
    scripts: {
      start: "vite",
      build: "vite build",
    },
    dependencies: {
      "ember-source": "~6.10.0",
      "@glimmer/component": "^2.0.0",
      "@glimmer/tracking": "^1.1.2",
      "ember-modifier": "^4.2.0",
    },
    devDependencies: {
      "@embroider/vite": "^1.5.0",
      "@embroider/compat": "^4.1.0",
      "@embroider/core": "^4.4.0",
      "@embroider/config-meta-loader": "^1.0.0",
      vite: "^6.3.0",
      "@rollup/plugin-babel": "^6.0.0",
      "@babel/core": "^7.26.0",
      "@babel/runtime": "^7.27.0",
      "@babel/plugin-transform-typescript": "^7.27.0",
      "@babel/plugin-transform-runtime": "^7.27.0",
      "babel-plugin-ember-template-compilation": "^2.4.0",
      "decorator-transforms": "^2.3.0",
      "ember-cli": "~6.9.0",
      "ember-cli-babel": "^8.2.0",
      "ember-load-initializers": "^3.0.0",
      "ember-resolver": "^13.1.0",
      "loader.js": "^4.7.0",
      typescript: "^5.8.0",
    },
    ember: { edition: "octane" },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function genViteConfig(): string {
  return `import { babel } from "@rollup/plugin-babel";
import { classicEmberSupport, ember } from "@embroider/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    babel({
      babelHelpers: "runtime",
      extensions: [".gjs", ".gts", ".js", ".ts"],
    }),
  ],
  build: {
    target: ["chrome109", "edge112", "firefox102", "safari16"],
  },
  base: "/",
});
`;
}

function genEmberCliBuild(): string {
  return `'use strict';
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { compatBuild } = require('@embroider/compat');

module.exports = async function (defaults) {
  const { buildOnce } = await import('@embroider/vite');

  let app = new EmberApp(defaults, {
    'ember-cli-babel': { enableTypeScriptTransform: true },
  });

  return compatBuild(app, buildOnce, {
    staticInvokables: true,
  });
};
`;
}

function genBabelConfig(): string {
  return `const { babelCompatSupport, templateCompatSupport } = require('@embroider/compat/babel');

module.exports = {
  plugins: [
    [
      '@babel/plugin-transform-typescript',
      {
        allExtensions: true,
        onlyRemoveTypeImports: true,
        allowDeclareFields: true,
      },
    ],
    [
      'babel-plugin-ember-template-compilation',
      {
        compilerPath: 'ember-source/dist/ember-template-compiler.js',
        transforms: [...templateCompatSupport()],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: require.resolve('decorator-transforms/runtime-esm'),
        },
      },
    ],
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: __dirname,
        useESModules: true,
        regenerator: false,
      },
    ],
    ...babelCompatSupport(),
  ],

  generatorOpts: {
    compact: false,
  },
};
`;
}

function genAppEnvironment(modulePrefix: string): string {
  return `import loadConfigFromMeta from "@embroider/config-meta-loader";

export default loadConfigFromMeta("${modulePrefix}");
`;
}

function genEnvironmentConfig(modulePrefix: string): string {
  return `"use strict";

module.exports = function (environment) {
  const ENV = {
    modulePrefix: "${modulePrefix}",
    environment,
    rootURL: "/",
    locationType: "hash",
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {},
    },
    APP: {},
  };

  if (environment === "test") {
    ENV.locationType = "none";
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;
    ENV.APP.rootElement = "#ember-testing";
    ENV.APP.autoboot = false;
  }

  return ENV;
};
`;
}

function genTsConfig(modulePrefix: string): string {
  const config = {
    compilerOptions: {
      target: "ES2021",
      module: "ES2020",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
      declaration: true,
      declarationMap: true,
      esModuleInterop: true,
      allowImportingTsExtensions: true,
      baseUrl: ".",
      rootDir: ".",
      outDir: "dist",
      paths: {
        [`${modulePrefix}/*`]: ["./app/*"],
      },
    },
    glint: {
      environment: ["ember-loose", "ember-template-imports"],
    },
    include: ["app/**/*", "types/**/*"],
  };
  return JSON.stringify(config, null, 2) + "\n";
}

function genEmberCli(): string {
  return `{
  "disableAnalytics": true
}
`;
}

function genIndexHtml(title: string, _modulePrefix: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link integrity="" rel="stylesheet" href="./app/styles/app.css" />

    {{content-for "head"}}
  </head>
  <body>
    {{content-for "body"}}

    <script type="module">
      import Application from "./app/app";
      import environment from "./app/config/environment";

      Application.create(environment.APP);
    </script>

    {{content-for "body-footer"}}
  </body>
</html>
`;
}

function genAppCss(): string {
  return `/* App styles — Tailwind utilities are loaded via CDN in index.html */

body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
`;
}

function genAppTs(_modulePrefix: string): string {
  return `import Application from "@ember/application";
import compatModules from "@embroider/virtual/compat-modules";
import Resolver from "ember-resolver";
import loadInitializers from "ember-load-initializers";
import config from "./config/environment";

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  Resolver = Resolver.withModules(compatModules);
}

loadInitializers(App, config.modulePrefix, compatModules);
`;
}

function genRouterTs(modulePrefix: string, routes: DetectedRoute[]): string {
  const routeLines = routes
    .filter((r) => r.routeName !== "index")
    .map((r) => `  this.route('${r.routeName}');`)
    .join("\n");

  return `import EmberRouter from "@ember/routing/router";
import config from "${modulePrefix}/config/environment";

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
${routeLines}
});
`;
}

function genRouteTemplate(
  modulePrefix: string,
  componentKebab: string,
  componentPascal: string,
): string {
  return `import ${componentPascal} from "${modulePrefix}/components/${componentKebab}";

<template><${componentPascal} /></template>
`;
}

function genRouteFile(route: DetectedRoute, elements: DesignElement[]): string {
  // Detect list-like patterns — repeated similar child elements
  const mockData = detectMockData(elements);

  if (mockData) {
    return `import Route from "@ember/routing/route";

export default class ${route.pascalName}Route extends Route {
  model() {
    return {
      ${mockData}
    };
  }
}
`;
  }

  return `import Route from "@ember/routing/route";

export default class ${route.pascalName}Route extends Route {
  // Add model hook if this route needs data
}
`;
}

function genApplicationTemplate(routes: DetectedRoute[]): string {
  if (routes.length <= 1) {
    return `<template>{{outlet}}</template>
`;
  }

  // Multiple routes — generate a nav bar
  const navLinks = routes.map((r) => {
    const label = escapeHtml(r.frameName);
    return `      <a href="#/${r.routeName === "index" ? "" : r.routeName}" class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md">${label}</a>`;
  });

  return `<template>
  <div class="min-h-screen">
    <nav class="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-200">
${navLinks.join("\n")}
    </nav>
    <main class="p-6">
      {{outlet}}
    </main>
  </div>
</template>
`;
}

// ============================================================
// Mock Data Detection
// ============================================================

/**
 * Detect repeated patterns in elements that suggest list data.
 * Returns a mock data string for the route model, or null.
 */
function detectMockData(elements: DesignElement[]): string | null {
  // Look for groups of similar children (same type, similar sizes)
  const topLevel = elements.filter((el) => el.parentId === null || el.type === "frame");
  if (topLevel.length === 0) return null;

  // For each frame, check if it has repeated similar children
  for (const frame of topLevel) {
    if (frame.type !== "frame") continue;
    const children = elements.filter((el) => el.parentId === frame.id);
    if (children.length < 3) continue;

    // Group children by type + similar dimensions
    const groups = groupBySimilarity(children);
    for (const group of groups) {
      if (group.length >= 3) {
        // Found a repeated pattern — generate mock items
        const itemCount = group.length;
        const hasText = group.some((el) => el.type === "text" || el.text);
        const hasImage = group.some((el) => el.type === "image");

        const fields: string[] = ['id: i + 1'];
        if (hasText) fields.push('title: `Item ${i + 1}`');
        if (hasImage) fields.push('imageUrl: "https://via.placeholder.com/150"');
        fields.push('description: `Description for item ${i + 1}`');

        return `items: Array.from({ length: ${itemCount} }, (_, i) => ({
        ${fields.join(",\n        ")},
      }))`;
      }
    }
  }

  return null;
}

function groupBySimilarity(elements: DesignElement[]): DesignElement[][] {
  const groups: DesignElement[][] = [];
  const used = new Set<string>();

  for (const el of elements) {
    if (used.has(el.id)) continue;

    const group = [el];
    used.add(el.id);

    for (const other of elements) {
      if (used.has(other.id)) continue;
      if (isSimilar(el, other)) {
        group.push(other);
        used.add(other.id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

function isSimilar(a: DesignElement, b: DesignElement): boolean {
  if (a.type !== b.type) return false;
  const widthRatio = Math.abs(a.width - b.width) / Math.max(a.width, 1);
  const heightRatio = Math.abs(a.height - b.height) / Math.max(a.height, 1);
  return widthRatio < 0.15 && heightRatio < 0.15;
}

// ============================================================
// Fallback Component Generator (no token registry)
// ============================================================

/**
 * Generate a basic component when no TokenRegistry is available.
 * Uses inline styles instead of Tailwind classes.
 */
function generateFallbackComponent(
  elements: DesignElement[],
  componentName: string,
): string {
  return generateEmberComponent(elements, componentName);
}

// ============================================================
// Helpers
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
