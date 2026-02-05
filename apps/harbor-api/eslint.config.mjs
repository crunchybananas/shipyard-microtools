import globals from "globals";

export default [
  {
    ignores: ["dist/", "node_modules/", "tmp/", "declarations/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
