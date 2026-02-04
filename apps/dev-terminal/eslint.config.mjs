import js from "@eslint/js";
import ts from "typescript-eslint";

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    ignores: ["node_modules/", "dist/", "declarations/"],
  },
  {
    rules: {
      "prefer-const": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
