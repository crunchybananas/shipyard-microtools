import globals from "globals";
import js from "@eslint/js";
import ts from "typescript-eslint";
import ember from "eslint-plugin-ember";
import emberParser from "@babel/eslint-parser";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin, ember },
    languageOptions: {
      globals: { ...globals.browser },
      parser: emberParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { configFile: "./babel.config.cjs" },
      },
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
