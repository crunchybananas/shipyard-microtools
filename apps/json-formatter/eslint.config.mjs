// eslint.config.mjs

import { FlatCompat } from "@eslint/eslintrc";
import typescriptEslintParser from "@typescript-eslint/parser";
import emberPlugin from "eslint-plugin-ember";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import js from "@eslint/js";
import globals from "globals";

const compat = new FlatCompat({
  baseDirectory: import.meta.url,
  resolvePluginsRelativeTo: import.meta.url,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      parser: typescriptEslintParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      ember: emberPlugin,
      "@typescript-eslint": typescriptEslintPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:ember/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
  ),
  {
    ignores: [
      "node_modules/",
      "dist/",
      "declarations/",
      ".template-lintrc.cjs",
      "config/environment.js",
      "babel.config.cjs",
    ],
  },
];
