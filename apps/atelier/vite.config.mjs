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
    outDir: "../../docs/ember/atelier",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunk: Ember, Glimmer, Firebase
          if (
            id.includes("node_modules/ember-source") ||
            id.includes("node_modules/@ember") ||
            id.includes("node_modules/@glimmer") ||
            id.includes("node_modules/firebase") ||
            id.includes("node_modules/@firebase")
          ) {
            return "vendor";
          }

          // Export utilities chunk (loaded on demand when user exports)
          if (
            id.includes("utils/export-ember-app") ||
            id.includes("utils/export-ember-component") ||
            id.includes("utils/export-react-component") ||
            id.includes("utils/export-swiftui") ||
            id.includes("utils/export-html") ||
            id.includes("utils/zip")
          ) {
            return "export-utils";
          }

          // Canvas renderer chunk (loaded on demand when toggling Canvas2D)
          if (id.includes("utils/canvas-renderer")) {
            return "canvas-renderer";
          }
        },
      },
    },
  },
  base: "./",
});
