#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# new-microtool.sh — scaffold a new Ember microtool app
#
# Usage:
#   ./scripts/new-microtool.sh <app-name> [options]
#
# Options:
#   --emoji  <emoji>    Favicon emoji         (default: 🛠)
#   --title  <title>    Display title          (default: derived from app-name)
#   --desc   <desc>     Short description      (default: "A Shipyard microtool")
#
# Example:
#   ./scripts/new-microtool.sh jwt-decoder --emoji "🔑" --title "JWT Decoder" --desc "Decode and inspect JSON Web Tokens"
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APPS_DIR="$ROOT_DIR/apps"

# ── Parse arguments ─────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <app-name> [--emoji <emoji>] [--title <title>] [--desc <desc>]"
  echo ""
  echo "  app-name   kebab-case name (e.g. jwt-decoder)"
  exit 1
fi

APP_NAME="$1"
shift

EMOJI="🛠"
TITLE=""
DESC="A Shipyard microtool"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --emoji) EMOJI="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --desc)  DESC="$2";  shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Derive title from app-name if not specified (kebab-case → Title Case)
if [[ -z "$TITLE" ]]; then
  TITLE=$(echo "$APP_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')
fi

APP_DIR="$APPS_DIR/$APP_NAME"

if [[ -d "$APP_DIR" ]]; then
  echo "Error: $APP_DIR already exists"
  exit 1
fi

echo "Creating microtool: $APP_NAME"
echo "  Title: $EMOJI $TITLE"
echo "  Desc:  $DESC"
echo "  Path:  $APP_DIR"
echo ""

# ── Create directory structure ──────────────────────────────────

mkdir -p "$APP_DIR/app/components/$APP_NAME"
mkdir -p "$APP_DIR/app/$APP_NAME"
mkdir -p "$APP_DIR/app/config"
mkdir -p "$APP_DIR/app/styles"
mkdir -p "$APP_DIR/app/templates"
mkdir -p "$APP_DIR/config"

# ── Identical boilerplate (no templating) ───────────────────────

cat > "$APP_DIR/babel.config.cjs" << 'BABEL_EOF'
const { babelCompatSupport, templateCompatSupport } = require("@embroider/compat/babel");

module.exports = {
  plugins: [
    [
      "@babel/plugin-transform-typescript",
      {
        allExtensions: true,
        onlyRemoveTypeImports: true,
        allowDeclareFields: true,
      },
    ],
    [
      "babel-plugin-ember-template-compilation",
      {
        compilerPath: "ember-source/dist/ember-template-compiler.js",
        transforms: [...templateCompatSupport()],
      },
    ],
    [
      "module:decorator-transforms",
      {
        runtime: {
          import: require.resolve("decorator-transforms/runtime-esm"),
        },
      },
    ],
    [
      "@babel/plugin-transform-runtime",
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
BABEL_EOF

cat > "$APP_DIR/ember-cli-build.js" << 'EMBERCLI_EOF'
/* eslint-disable */

"use strict";
const EmberApp = require("ember-cli/lib/broccoli/ember-app");

const { compatBuild } = require("@embroider/compat");

module.exports = async function (defaults) {
  const { buildOnce } = await import("@embroider/vite");

  let app = new EmberApp(defaults, {
    "ember-cli-babel": { enableTypeScriptTransform: true },
    minifyJS: {
      enabled: EmberApp.env() === "production",
      options: {
        keep_fnames: true,
        keep_classnames: true,
      },
    },
  });

  return compatBuild(app, buildOnce, {
    staticInvokables: true,
  });
};
EMBERCLI_EOF

cat > "$APP_DIR/config/optional-features.json" << 'OPTFEAT_EOF'
{
  "application-template-wrapper": false,
  "default-async-observers": true,
  "jquery-integration": false,
  "template-only-glimmer-components": true
}
OPTFEAT_EOF

cat > "$APP_DIR/app/templates/application.gts" << 'APPGTS_EOF'
import type { TOC } from "@ember/component/template-only";

const Application: TOC<{ Blocks: { default: [] } }> = <template>
  {{outlet}}
</template>;

export default Application;
APPGTS_EOF

# ── Templated files ─────────────────────────────────────────────

cat > "$APP_DIR/package.json" << PKGJSON_EOF
{
  "name": "$APP_NAME",
  "version": "0.0.0",
  "private": true,
  "description": "$DESC",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "start": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "npm-run-all --aggregate-output --continue-on-error --parallel \"lint:!(fix)\"",
    "lint:fix": "npm-run-all --aggregate-output --continue-on-error --parallel lint:*:fix",
    "lint:prettier": "prettier ./app -c --plugin prettier-plugin-ember-template-tag",
    "lint:prettier:fix": "prettier ./app -w --plugin prettier-plugin-ember-template-tag",
    "lint:hbs": "ember-template-lint .",
    "lint:hbs:fix": "ember-template-lint . --fix",
    "lint:js": "eslint . --cache",
    "lint:js:fix": "eslint . --fix",
    "lint:types": "ember-tsc"
  },
  "devDependencies": {
    "@babel/core": "catalog:",
    "@babel/eslint-parser": "^7.28.4",
    "@babel/plugin-proposal-decorators": "^7.28.0",
    "@babel/plugin-transform-runtime": "^7.28.3",
    "@babel/plugin-transform-typescript": "^7.28.0",
    "babel-plugin-ember-template-compilation": "^2.4.1",
    "@ember/optional-features": "^2.3.0",
    "@ember/test-helpers": "catalog:",
    "@embroider/compat": "^4.1.12",
    "@embroider/config-meta-loader": "^1.0.0",
    "@embroider/core": "^4.4.2",
    "@embroider/vite": "1.5.0",
    "@glimmer/component": "^2.0.0",
    "@glimmer/tracking": "^1.1.2",
    "@glint/ember-tsc": "catalog:glint",
    "@glint/template": "catalog:glint",
    "@glint/tsserver-plugin": "catalog:glint",
    "@rollup/plugin-babel": "^6.1.0",
    "@types/qunit": "^2.19.13",
    "@typescript-eslint/eslint-plugin": "^8.46.1",
    "@typescript-eslint/parser": "^8.46.1",
    "concurrently": "^9.2.1",
    "decorator-transforms": "^2.3.0",
    "ember-cli": "catalog:",
    "ember-cli-babel": "^8.2.0",
    "ember-load-initializers": "^3.0.1",
    "ember-qunit": "^9.0.4",
    "ember-resolver": "^13.1.1",
    "ember-source": "catalog:",
    "ember-template-lint": "catalog:glint",
    "eslint": "catalog:lint",
    "eslint-config-prettier": "catalog:lint",
    "eslint-plugin-ember": "catalog:lint",
    "eslint-plugin-prettier": "^5.5.4",
    "globals": "^15.15.0",
    "loader.js": "^4.7.0",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.6.2",
    "prettier-plugin-ember-template-tag": "^2.1.0",
    "qunit": "^2.24.2",
    "qunit-dom": "^3.5.0",
    "testem": "^3.15.0",
    "tracked-built-ins": "^4.0.0",
    "typescript": "catalog:",
    "vite": "catalog:"
  },
  "engines": {
    "node": ">= v20.19.0"
  },
  "ember": {
    "edition": "octane"
  },
  "dependencies": {
    "@ember/string": "^4.0.1",
    "ember-modifier": "^4.2.2"
  },
  "exports": {
    "./tests/*": "./tests/*",
    "./*": "./app/*"
  }
}
PKGJSON_EOF

cat > "$APP_DIR/index.html" << INDEXHTML_EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>$TITLE</title>
    <meta name="description" content="$DESC" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>$EMOJI</text></svg>" />
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
INDEXHTML_EOF

cat > "$APP_DIR/vite.config.mjs" << VITE_EOF
import { babel } from "@rollup/plugin-babel";
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
    outDir: "../../docs/ember/$APP_NAME",
    emptyOutDir: true,
  },
  base: "./",
});
VITE_EOF

cat > "$APP_DIR/tsconfig.json" << TSCONFIG_EOF
{
  "extends": "../../tsconfig.app.json",
  "glint": {
    "environment": ["ember-loose", "ember-template-imports"]
  },
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": ".",
    "outDir": "dist",
    "paths": {
      "$APP_NAME/*": ["./app/*"],
      "$APP_NAME/tests/*": ["./tests/*"]
    }
  },
  "include": ["app/**/*", "tests/**/*", "types/**/*"]
}
TSCONFIG_EOF

cat > "$APP_DIR/config/environment.js" << CONFIGENV_EOF
"use strict";

module.exports = function (environment) {
  const ENV = {
    modulePrefix: "$APP_NAME",
    environment,
    rootURL: "./",
    locationType: "hash",
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {},
    },
    APP: {},
  };

  if (environment === "development") {
    // Development-specific settings
  }

  if (environment === "test") {
    ENV.locationType = "none";
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;
    ENV.APP.rootElement = "#ember-testing";
    ENV.APP.autoboot = false;
  }

  if (environment === "production") {
    ENV.rootURL = "./";
    ENV.locationType = "hash";
  }

  return ENV;
};
CONFIGENV_EOF

cat > "$APP_DIR/app/app.ts" << APPTS_EOF
import Application from "@ember/application";
import compatModules from "@embroider/virtual/compat-modules";
import Resolver from "ember-resolver";
import loadInitializers from "ember-load-initializers";
import config from "./config/environment";

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  Resolver = Resolver.withModules(compatModules);
}

loadInitializers(App, config.modulePrefix, compatModules);
APPTS_EOF

cat > "$APP_DIR/app/router.ts" << ROUTER_EOF
import EmberRouter from "@ember/routing/router";
import config from "$APP_NAME/config/environment";

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {});
ROUTER_EOF

cat > "$APP_DIR/app/config/environment.js" << APPCONFENV_EOF
import loadConfigFromMeta from "@embroider/config-meta-loader";

export default loadConfigFromMeta("$APP_NAME");
APPCONFENV_EOF

cat > "$APP_DIR/app/config/environment.d.ts" << APPCONFENVD_EOF
/**
 * Type declarations for
 *    import config from '$APP_NAME/config/environment'
 */
declare const config: {
  environment: string;
  modulePrefix: string;
  locationType: "history" | "hash" | "none" | "auto";
  rootURL: string;
  APP: Record<string, unknown>;
};

export default config;
APPCONFENVD_EOF

# ── Index route template ────────────────────────────────────────

cat > "$APP_DIR/app/templates/index.gts" << INDEXGTS_EOF
import AppComponent from "$APP_NAME/components/$APP_NAME/app";

const IndexRoute = <template><AppComponent /></template>;

export default IndexRoute;
INDEXGTS_EOF

# ── Stub component ──────────────────────────────────────────────

cat > "$APP_DIR/app/components/$APP_NAME/app.gts" << COMPONENT_EOF
import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initialize } from "$APP_NAME/$APP_NAME/init";

export default class ${TITLE// /}App extends Component {
  setup = modifier((element: HTMLElement) => {
    initialize(element);
  });

  <template>
    <div class="container" {{this.setup}}>
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>$EMOJI $TITLE</h1>
        <p class="subtitle">$DESC</p>
      </header>

      <main>
        <!-- Your app content here -->
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener noreferrer">Cory Loken &amp; Chiron</a>
          using
          <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
COMPONENT_EOF

# ── Stub init ───────────────────────────────────────────────────

cat > "$APP_DIR/app/$APP_NAME/init.ts" << INIT_EOF
export function initialize(_element: HTMLElement) {
  // Your app logic here.
  // The element is the root container div — query children from it.
}
INIT_EOF

# ── Base CSS ────────────────────────────────────────────────────

cat > "$APP_DIR/app/styles/app.css" << CSS_EOF
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e4e4e7;
  min-height: 100vh;
  line-height: 1.6;
}

.container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

.back {
  display: inline-block;
  color: #818cf8;
  text-decoration: none;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.back:hover {
  text-decoration: underline;
}

h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #fff;
}

.subtitle {
  color: #a1a1aa;
  font-size: 1rem;
}

main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

footer {
  text-align: center;
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #71717a;
  font-size: 0.875rem;
}

footer a {
  color: #818cf8;
  text-decoration: none;
}

footer a:hover {
  text-decoration: underline;
}
CSS_EOF

# ── Done ────────────────────────────────────────────────────────

echo ""
echo "✅ Created $APP_NAME at $APP_DIR"
echo ""
echo "Next steps:"
echo "  cd apps/$APP_NAME"
echo "  pnpm install"
echo "  pnpm dev          # start dev server on :4200"
echo ""
echo "  # Edit your app:"
echo "  #   app/components/$APP_NAME/app.gts   — template"
echo "  #   app/$APP_NAME/init.ts              — logic"
echo "  #   app/styles/app.css                 — styles"
echo ""
echo "  pnpm build         # build to docs/ember/$APP_NAME/"
