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
    outDir: "../../docs/ember/gradient-generator",
    emptyOutDir: true,
  },
  base: "./",
});
