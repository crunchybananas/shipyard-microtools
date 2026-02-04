import globals from "globals";
import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import ember from "eslint-plugin-ember";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  prettier,
  {
    ignores: ["dist/", "node_modules/", "declarations/"],
  },
  {
    files: ["**/*.{js,ts,gjs,gts}"],
    plugins: {
      "@typescript-eslint": ts,
      ember: ember,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
        extraFileExtensions: [".gts", ".gjs"],
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["config/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
